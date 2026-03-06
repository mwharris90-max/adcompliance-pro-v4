import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { toAdContentPayload } from "@/lib/bulk/csv-parser";
import {
  fetchComplianceContext,
  checkTechnicalSpecs,
  checkDeterministicRules,
  buildRestrictedFallbacks,
  buildRulesForEvaluation,
  runAiAnalysis,
  runBatchedPart2Analysis,
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
import { buildCacheKey, getCached, setCached } from "@/lib/cache";

const BATCH_SIZE = 3; // Lower concurrency for batch to avoid rate limits
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  // Verify cron secret (Vercel Cron sends this header)
  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find oldest PENDING batch job
  const job = await db.bulkCheckJob.findFirst({
    where: { mode: "BATCH", status: "PENDING" },
    orderBy: { submittedAt: "asc" },
  });

  if (!job) {
    return NextResponse.json({ message: "No pending batch jobs" });
  }

  // Mark as processing
  await db.bulkCheckJob.update({
    where: { id: job.id },
    data: { status: "PROCESSING", startedAt: new Date() },
  });

  const pendingRows = await db.bulkCheckRow.findMany({
    where: { bulkJobId: job.id, status: "PENDING" },
    orderBy: { rowIndex: "asc" },
  });

  // ── Shared setup: fetch context + certs ONCE for the whole job ─────────────
  const [sharedCtx, heldCerts] = await Promise.all([
    fetchComplianceContext({
      platformIds: job.platformIds,
      categoryIds: job.categoryIds,
      countryIds: job.countryIds,
      adContent: {} as AdContentPayload,
      assetUrls: [],
      assets: [],
    }),
    fetchHeldCertifications(job.userId, job.platformIds, job.categoryIds),
  ]);
  const heldCertNames = heldCerts.map((c) => c.certificationName);

  const sharedDeterministicItems = checkDeterministicRules(
    sharedCtx.platformRules, sharedCtx.geoRules, sharedCtx.platformNames
  );
  const sharedRestrictedFallbacks = buildRestrictedFallbacks(
    sharedCtx.platformRules, sharedCtx.geoRules, sharedCtx.platformNames
  );
  const sharedRulesForEval = buildRulesForEvaluation(
    sharedCtx.platformRules, sharedCtx.geoRules, sharedCtx.platformNames, sharedCtx.prohibitionConfigs
  );

  const hasApiKey = !!(process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY.includes("REPLACE"));

  const rulesSnapshot = [
    ...sharedCtx.platformRules.map((r) => `pr:${r.id}:${(r as Record<string, unknown>).updatedAt instanceof Date ? ((r as Record<string, unknown>).updatedAt as Date).toISOString() : ""}`),
    ...sharedCtx.geoRules.map((r) => `gr:${r.id}:${(r as Record<string, unknown>).updatedAt instanceof Date ? ((r as Record<string, unknown>).updatedAt as Date).toISOString() : ""}`),
  ].sort().join("|");

  let passCount = 0;
  let warningCount = 0;
  let failCount = 0;
  let errorCount = 0;
  let cacheHits = 0;
  const BATCH_RATE = 0.1;

  // Process in batches
  for (let i = 0; i < pendingRows.length; i += BATCH_SIZE) {
    const batch = pendingRows.slice(i, i + BATCH_SIZE);

    // Transform and check cache
    const batchItems = await Promise.all(
      batch.map(async (rowRecord) => {
        const adContent = toAdContentPayload(
          rowRecord.adContent as Record<string, string>
        ) as AdContentPayload;
        const cacheKey = buildCacheKey({ adContent, platformIds: job.platformIds, categoryIds: job.categoryIds, countryIds: job.countryIds, rulesSnapshot });
        const cached = await getCached<ComplianceResult>(cacheKey);
        return { rowRecord, adContent, cacheKey, cached };
      })
    );

    // Process cached items
    const uncachedItems: typeof batchItems = [];
    for (const item of batchItems) {
      if (item.cached) {
        cacheHits++;
        const { rowRecord, cached } = item;
        const overallStatus = cached.overallStatus;

        if (overallStatus === "CLEAN") passCount++;
        else if (overallStatus === "WARNINGS") warningCount++;
        else if (overallStatus === "VIOLATIONS") failCount++;

        await db.bulkCheckRow.update({
          where: { id: rowRecord.id },
          data: { status: "COMPLETE", overallStatus, results: cached as unknown as Prisma.InputJsonValue, completedAt: new Date() },
        });
        await db.complianceCheck.create({
          data: {
            userId: job.userId, platformIds: job.platformIds, categoryIds: job.categoryIds, countryIds: job.countryIds,
            adContent: item.adContent as unknown as Prisma.InputJsonValue, assetUrls: [],
            status: overallStatus, overallStatus, results: cached as unknown as Prisma.InputJsonValue,
            completedAt: new Date(), bulkRowId: rowRecord.id,
          },
        });
      } else {
        uncachedItems.push(item);
      }
    }

    if (uncachedItems.length === 0) continue;

    // Mark as processing
    await Promise.all(
      uncachedItems.map((item) =>
        db.bulkCheckRow.update({ where: { id: item.rowRecord.id }, data: { status: "PROCESSING" } })
      )
    );

    // Run AI: Part 1 per-row + Part 2 batched
    const part1Promises = hasApiKey && sharedRulesForEval.length > 0
      ? uncachedItems.map((item) =>
          Promise.race([
            runAiAnalysis(
              item.adContent, [], sharedCtx.platformNames,
              sharedCtx.categoryNames, sharedCtx.countryNames,
              sharedRulesForEval, [], heldCertNames,
              { skipPart2: true, modelOverride: "claude-haiku-4-5-20251001" }
            ),
            new Promise<null>((_, reject) =>
              setTimeout(() => reject(new Error("AI timeout (30s)")), 30_000)
            ),
          ]).catch((err) => {
            console.error(`[bulk-cron] AI failed for row ${item.rowRecord.rowIndex}:`, err);
            return null;
          })
        )
      : uncachedItems.map(() => Promise.resolve(null));

    const part2Promise = hasApiKey
      ? runBatchedPart2Analysis(
          uncachedItems.map((item) => ({ key: item.rowRecord.id, adContent: item.adContent })),
          sharedCtx.platformNames, sharedCtx.categoryNames, sharedCtx.countryNames
        ).catch((err) => {
          console.error("[bulk-cron] Batched Part2 failed:", err);
          return new Map<string, never[]>();
        })
      : Promise.resolve(new Map<string, never[]>());

    const [part1Results, part2Map] = await Promise.all([
      Promise.all(part1Promises),
      part2Promise,
    ]);

    // Merge and save
    for (let j = 0; j < uncachedItems.length; j++) {
      const item = uncachedItems[j];
      const { rowRecord, adContent, cacheKey } = item;

      try {
        const technicalItems = checkTechnicalSpecs(adContent, sharedCtx.channelRequirements, []);

        const part1 = part1Results[j] as AiAnalysisOutput | null;
        const part2Items = part2Map.get(rowRecord.id) ?? [];

        const aiOutput: AiAnalysisOutput | null = part1
          ? {
              ruleEvaluations: part1.ruleEvaluations,
              additionalItems: [...part1.additionalItems, ...part2Items],
              summary: part1.summary,
            }
          : part2Items.length > 0
            ? { ruleEvaluations: [], additionalItems: part2Items, summary: "" }
            : null;

        const rawChecklist = mergeChecklist(
          technicalItems, sharedDeterministicItems, sharedRestrictedFallbacks,
          aiOutput, sharedCtx.platformNames
        );
        const checklist = applyCertificationOverrides(rawChecklist, heldCerts, job.categoryIds);
        const overallStatus = computeOverallStatus(checklist);
        const summary = aiOutput?.summary || generateSummary(checklist, sharedCtx.platformNames, sharedCtx.countryNames);

        const result: ComplianceResult = {
          overallStatus, checklist, overrides: [], summary,
          checkedAt: new Date().toISOString(), issues: deriveIssues(checklist),
        };

        setCached(cacheKey, result).catch(() => {});

        await db.bulkCheckRow.update({
          where: { id: rowRecord.id },
          data: { status: "COMPLETE", overallStatus, results: result as unknown as Prisma.InputJsonValue, completedAt: new Date() },
        });
        await db.complianceCheck.create({
          data: {
            userId: job.userId, platformIds: job.platformIds, categoryIds: job.categoryIds, countryIds: job.countryIds,
            adContent: adContent as unknown as Prisma.InputJsonValue, assetUrls: [],
            status: overallStatus, overallStatus, results: result as unknown as Prisma.InputJsonValue,
            completedAt: new Date(), bulkRowId: rowRecord.id,
          },
        });

        if (overallStatus === "CLEAN") passCount++;
        else if (overallStatus === "WARNINGS") warningCount++;
        else if (overallStatus === "VIOLATIONS") failCount++;
      } catch (err) {
        console.error(`[bulk-cron] Fatal error row ${rowRecord.rowIndex}:`, err);
        errorCount++;
        await db.bulkCheckRow.update({
          where: { id: rowRecord.id },
          data: { status: "FAILED", completedAt: new Date() },
        }).catch(() => {});
      }
    }
  }

  // Copy results to duplicate rows
  const duplicateRows = await db.bulkCheckRow.findMany({
    where: { bulkJobId: job.id, isDuplicate: true, duplicateOfId: { not: null } },
  });

  for (const dup of duplicateRows) {
    const original = await db.bulkCheckRow.findUnique({
      where: { id: dup.duplicateOfId! },
      select: { overallStatus: true, results: true },
    });
    if (original) {
      await db.bulkCheckRow.update({
        where: { id: dup.id },
        data: {
          overallStatus: original.overallStatus,
          results: original.results ?? Prisma.DbNull,
          completedAt: new Date(),
        },
      });
    }
  }

  const refundAmount = errorCount * BATCH_RATE;
  const summary = { passCount, warningCount, failCount, errorCount, cacheHits };

  await db.bulkCheckJob.update({
    where: { id: job.id },
    data: {
      status: errorCount === pendingRows.length ? "FAILED" : "COMPLETE",
      resultsSummary: summary as unknown as Prisma.InputJsonValue,
      checkditsRefund: new Prisma.Decimal(refundAmount),
      completedAt: new Date(),
    },
  });

  return NextResponse.json({
    jobId: job.id,
    processed: pendingRows.length,
    summary,
    refund: refundAmount > 0 ? refundAmount : undefined,
  });
}
