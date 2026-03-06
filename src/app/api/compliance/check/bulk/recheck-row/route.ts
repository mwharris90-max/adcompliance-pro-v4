import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
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
  type ComplianceResult,
} from "@/lib/ai/runComplianceCheck";
import { toAdContentPayload } from "@/lib/bulk/csv-parser";

const HAIKU = "claude-haiku-4-5-20251001";

const schema = z.object({
  adContent: z.record(z.string(), z.string()),
  platformIds: z.array(z.string()).min(1),
  categoryIds: z.array(z.string()).min(1),
  countryIds: z.array(z.string()).min(1),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const { adContent: rawContent, platformIds, categoryIds, countryIds } = parsed.data;

  // Convert flat bulk fields (headline1, description1...) to AdContentPayload format
  const adContent = toAdContentPayload(rawContent) as AdContentPayload;

  try {
    const [ctx, heldCerts] = await Promise.all([
      fetchComplianceContext({
        platformIds,
        categoryIds,
        countryIds,
        adContent,
        assetUrls: [],
        assets: [],
      }),
      fetchHeldCertifications(session.user.id, platformIds, categoryIds),
    ]);
    const heldCertNames = heldCerts.map((c) => c.certificationName);

    // Layer 1: Technical checks
    const technicalItems = checkTechnicalSpecs(
      adContent,
      ctx.channelRequirements,
      []
    );

    // Layer 2: Deterministic rules
    const deterministicItems = checkDeterministicRules(
      ctx.platformRules, ctx.geoRules, ctx.platformNames
    );

    // Layer 3: AI — use Haiku for speed
    const hasApiKey = !!(process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY.includes("REPLACE"));
    const rulesForEval = buildRulesForEvaluation(ctx.platformRules, ctx.geoRules, ctx.platformNames, ctx.prohibitionConfigs);
    const restrictedFallbacks = buildRestrictedFallbacks(ctx.platformRules, ctx.geoRules, ctx.platformNames);

    let aiOutput: AiAnalysisOutput | null = null;

    if (hasApiKey && (rulesForEval.length > 0)) {
      try {
        aiOutput = await Promise.race([
          runAiAnalysis(
            adContent, [], ctx.platformNames,
            ctx.categoryNames, ctx.countryNames,
            rulesForEval, [], heldCertNames,
            { skipPart2: false, modelOverride: HAIKU }
          ),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error("AI timeout")), 15_000)
          ),
        ]);
      } catch {
        // Fall through — deterministic results still valid
      }
    }

    const rawChecklist = mergeChecklist(
      technicalItems, deterministicItems, restrictedFallbacks,
      aiOutput, ctx.platformNames
    );
    const checklist = applyCertificationOverrides(rawChecklist, heldCerts, categoryIds);
    const overallStatus = computeOverallStatus(checklist);
    const summary = aiOutput?.summary || generateSummary(
      checklist, ctx.platformNames, ctx.countryNames
    );

    const result: ComplianceResult = {
      overallStatus,
      checklist,
      overrides: [],
      summary,
      checkedAt: new Date().toISOString(),
      issues: deriveIssues(checklist),
    };

    return NextResponse.json({ success: true, result });
  } catch (err) {
    console.error("[recheck-row] Error:", err);
    return NextResponse.json({ error: "Recheck failed" }, { status: 500 });
  }
}
