import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  fetchComplianceContext,
  checkTechnicalSpecs,
  checkDeterministicRules,
  buildRestrictedFallbacks,
  buildRulesForEvaluation,
  runAiAnalysis,
  mergeChecklist,
  deriveIssues,
  computeOverallStatus,
  generateSummary,
  fetchHeldCertifications,
  applyCertificationOverrides,
  type AdContentPayload,
  type AiAnalysisOutput,
  type AssetMetadata,
  type ComplianceResult,
} from "@/lib/ai/runComplianceCheck";
import { runAiImageAnalysis, type ImageAnalysisOutput } from "@/lib/ai/runImageAnalysis";
import { buildCacheKey, getCached, setCached } from "@/lib/cache";
import { isOverLimit, deductCredits } from "@/lib/usage";

const assetSchema = z.object({
  url: z.string(),
  format: z.string().default(""),
  width: z.number().default(0),
  height: z.number().default(0),
  bytes: z.number().default(0),
});

const checkSchema = z.object({
  platformIds: z.array(z.string()).min(1),
  categoryIds: z.array(z.string()).min(1),
  countryIds: z.array(z.string()).min(1),
  adContent: z.record(z.string(), z.unknown()),
  assets: z.array(assetSchema).default([]),
  // Keep assetUrls for backward compat
  assetUrls: z.array(z.string()).default([]),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  // Usage limit check — soft block when org is over monthly limit
  if (await isOverLimit(session.user.id)) {
    return new Response(
      JSON.stringify({ error: "You have no Checkdits remaining. Purchase more credits from the Billing page to continue running compliance checks." }),
      { status: 429 }
    );
  }

  const body = await req.json();
  const parsed = checkSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Validation failed" }), { status: 400 });
  }

  const { platformIds, categoryIds, countryIds, adContent, assets, assetUrls } = parsed.data;

  // Merge: prefer full asset objects; fall back to bare URL list for compat
  const resolvedAssets: AssetMetadata[] =
    assets.length > 0
      ? assets
      : assetUrls.map((url) => ({ url, format: "", width: 0, height: 0, bytes: 0 }));

  const resolvedAssetUrls = resolvedAssets.map((a) => a.url);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function emit(event: string, data: unknown) {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      }

      // Create DB record
      const check = await db.complianceCheck.create({
        data: {
          userId: session.user.id,
          platformIds,
          categoryIds,
          countryIds,
          adContent: adContent as Prisma.InputJsonValue,
          assetUrls: resolvedAssetUrls,
          status: "RUNNING",
        },
      });

      emit("start", { checkId: check.id });

      try {
        // ── Fetch all context data ───────────────────────────────────────────
        const [ctx, heldCerts] = await Promise.all([
          fetchComplianceContext({
            platformIds,
            categoryIds,
            countryIds,
            adContent: adContent as AdContentPayload,
            assetUrls: resolvedAssetUrls,
            assets: resolvedAssets,
          }),
          fetchHeldCertifications(session.user.id, platformIds, categoryIds),
        ]);
        const heldCertNames = heldCerts.map((c) => c.certificationName);

        // ── Cache check ──────────────────────────────────────────────────────
        const rulesSnapshot = [
          ...ctx.platformRules.map((r) => `pr:${r.id}:${(r as Record<string, unknown>).updatedAt instanceof Date ? ((r as Record<string, unknown>).updatedAt as Date).toISOString() : ""}`),
          ...ctx.geoRules.map((r) => `gr:${r.id}:${(r as Record<string, unknown>).updatedAt instanceof Date ? ((r as Record<string, unknown>).updatedAt as Date).toISOString() : ""}`),
        ].sort().join("|");

        const cacheKey = buildCacheKey({
          adContent: ctx.adContent,
          platformIds,
          categoryIds,
          countryIds,
          rulesSnapshot,
        });

        const cached = await getCached<ComplianceResult>(cacheKey);
        if (cached) {
          console.log("[stream] cache hit");
          const byLayer = (l: string) => cached.checklist.filter((i) => i.layer === l);
          emit("layer", { layer: "technical",     items: byLayer("technical") });
          emit("layer", { layer: "platform_rule", items: byLayer("platform_rule") });
          emit("layer", { layer: "geo_rule",      items: byLayer("geo_rule") });
          const aiItems = byLayer("ai_text");
          if (aiItems.length > 0) {
            emit("layer_start", { layer: "ai_text" });
            emit("layer", { layer: "ai_text", items: aiItems, summary: cached.summary });
          }
          const imgItems = byLayer("image");
          if (imgItems.length > 0 || (cached.imageAnalyses?.length ?? 0) > 0) {
            emit("layer_start", { layer: "image" });
            emit("layer", { layer: "image", items: imgItems, imageAnalyses: cached.imageAnalyses });
          }
          await db.complianceCheck.update({
            where: { id: check.id },
            data: {
              status: cached.overallStatus,
              overallStatus: cached.overallStatus,
              results: cached as unknown as Prisma.InputJsonValue,
              completedAt: new Date(),
            },
          });
          await deductCredits(session.user.id, 1);
          emit("complete", { checkId: check.id, overallStatus: cached.overallStatus, summary: cached.summary });
          return;
        }

        // ── Layer 1: Technical ───────────────────────────────────────────────
        const technicalItems = checkTechnicalSpecs(
          ctx.adContent,
          ctx.channelRequirements,
          ctx.assets
        );
        emit("layer", { layer: "technical", items: technicalItems });

        // ── Layer 2: Deterministic rules ─────────────────────────────────────
        const deterministicItems = checkDeterministicRules(
          ctx.platformRules, ctx.geoRules, ctx.platformNames
        );
        const platformRuleItems = deterministicItems.filter((i) => i.layer === "platform_rule");
        const geoRuleItems = deterministicItems.filter((i) => i.layer === "geo_rule");
        const restrictedFallbacks = buildRestrictedFallbacks(
          ctx.platformRules, ctx.geoRules, ctx.platformNames
        );

        emit("layer", { layer: "platform_rule", items: platformRuleItems });
        emit("layer", { layer: "geo_rule", items: geoRuleItems });

        // ── Layers 3 + 4: AI text + image in parallel ────────────────────────
        const hasApiKey = !!(process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY.includes("REPLACE"));

        if (hasApiKey) emit("layer_start", { layer: "ai_text" });
        if (hasApiKey && ctx.assets.length > 0) emit("layer_start", { layer: "image" });

        const layer3Promise = hasApiKey
          ? (async (): Promise<AiAnalysisOutput | null> => {
              try {
                const rulesForEval = buildRulesForEvaluation(
                  ctx.platformRules, ctx.geoRules, ctx.platformNames, ctx.prohibitionConfigs
                );
                const output = await runAiAnalysis(
                  ctx.adContent,
                  ctx.assetUrls,
                  ctx.platformNames,
                  ctx.categoryNames,
                  ctx.countryNames,
                  rulesForEval,
                  [],
                  heldCertNames,
                  { modelOverride: "claude-haiku-4-5-20251001" }
                );
                const tempMerged = mergeChecklist([], [], restrictedFallbacks, output, ctx.platformNames);
                const aiItems = tempMerged.filter((i) => i.aiGenerated);
                emit("layer", { layer: "ai_text", items: aiItems, summary: output.summary });
                return output;
              } catch (err) {
                console.error("[stream] AI text analysis failed:", err);
                emit("layer", { layer: "ai_text", items: [] });
                return null;
              }
            })()
          : Promise.resolve(null);

        const layer4Promise = hasApiKey && ctx.assets.length > 0
          ? (async () => {
              try {
                const results = await Promise.all(
                  ctx.assets.map((asset, i) =>
                    runAiImageAnalysis(
                      asset.url,
                      i,
                      ctx.platformNames,
                      ctx.categoryNames,
                      ctx.countryNames,
                      ctx.platformRules,
                      ctx.geoRules
                    )
                  )
                );
                const allItems = results.flatMap((r) => r.checklistItems);
                emit("layer", { layer: "image", items: allItems, imageAnalyses: results });
                return { items: allItems, analyses: results };
              } catch (err) {
                console.error("[stream] Image analysis failed:", err);
                emit("layer", { layer: "image", items: [] });
                return { items: [] as ReturnType<typeof mergeChecklist>, analyses: [] as ImageAnalysisOutput[] };
              }
            })()
          : Promise.resolve({ items: [] as ReturnType<typeof mergeChecklist>, analyses: [] as ImageAnalysisOutput[] });

        const [aiOutput, imageResult] = await Promise.all([layer3Promise, layer4Promise]);

        // ── Merge and finalise ────────────────────────────────────────────────
        const allImageChecklistItems = imageResult.analyses.flatMap((a) => a.checklistItems);
        const rawChecklist = [
          ...mergeChecklist(
            technicalItems, deterministicItems, restrictedFallbacks, aiOutput, ctx.platformNames
          ),
          ...allImageChecklistItems,
        ];
        const checklist = applyCertificationOverrides(rawChecklist, heldCerts, categoryIds);
        const overallStatus = computeOverallStatus(checklist);
        const summary = aiOutput?.summary || generateSummary(checklist, ctx.platformNames, ctx.countryNames);

        const result: ComplianceResult = {
          overallStatus,
          checklist,
          overrides: [],
          summary,
          checkedAt: new Date().toISOString(),
          issues: deriveIssues(checklist),
          imageAnalyses: imageResult.analyses,
        };

        await setCached(cacheKey, result);

        await db.complianceCheck.update({
          where: { id: check.id },
          data: {
            status: overallStatus,
            overallStatus,
            results: result as unknown as Prisma.InputJsonValue,
            completedAt: new Date(),
          },
        });

        // Deduct 1 Checkdit credit
        await deductCredits(session.user.id, 1);

        emit("complete", { checkId: check.id, overallStatus, summary });
      } catch (err) {
        console.error("[stream] Fatal error:", err);
        await db.complianceCheck.update({
          where: { id: check.id },
          data: { status: "ERROR" },
        }).catch(() => {});
        emit("error", { message: "Compliance check failed. Please try again." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
