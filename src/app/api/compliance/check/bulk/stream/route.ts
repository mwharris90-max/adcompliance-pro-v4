import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Prisma, type BulkCheckRow } from "@prisma/client";
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
import { isOverLimit, getMonthlyUsage, deductCredits } from "@/lib/usage";
import { parseGoogleAdsCsv, toAdContentPayload } from "@/lib/bulk/csv-parser";
import { detectDelta, copyPreviousResults } from "@/lib/bulk/delta-detect";
import { detectCategoriesForRows, buildDetectionText } from "@/lib/bulk/detect-categories";

export const maxDuration = 60; // Vercel Hobby max — needed for category detection + AI checks

const INSTANT_RATE = 0.5;
const BATCH_SIZE = 5; // concurrent rows per batch

const bulkSchema = z.object({
  csvText: z.string().min(1),
  filename: z.string().default("upload.csv"),
  platformIds: z.array(z.string()).min(1),
  categoryIds: z.array(z.string()).min(1),
  countryIds: z.array(z.string()).min(1),
  recheckAll: z.boolean().default(false),
  autoDetectCategories: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  if (await isOverLimit(session.user.id)) {
    return new Response(
      JSON.stringify({ error: "You have no Checkdits remaining. Purchase more credits from the Billing page." }),
      { status: 429 }
    );
  }

  const body = await req.json();
  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Validation failed" }), { status: 400 });
  }

  const { csvText, filename, platformIds, categoryIds, countryIds, recheckAll, autoDetectCategories } = parsed.data;

  // Parse CSV
  const parseResult = parseGoogleAdsCsv(csvText);
  if (!parseResult.success) {
    return new Response(JSON.stringify({ error: parseResult.error }), { status: 422 });
  }

  // Delta detection — find unchanged rows from previous upload
  const delta = recheckAll ? null : await detectDelta(
    session.user.id,
    parseResult.rows.map((r) => ({ rowIndex: r.rowIndex, contentHash: r.contentHash })),
    filename
  );
  const unchangedCount = delta ? delta.unchangedHashes.size : 0;
  const rowsToCheck = parseResult.uniqueRows - unchangedCount;

  // Check affordability (only charge for changed/new rows)
  const usage = await getMonthlyUsage(session.user.id);
  const cost = Math.ceil(rowsToCheck * INSTANT_RATE * 10) / 10;
  if (usage.limit !== null && usage.used + cost > usage.limit) {
    return new Response(
      JSON.stringify({ error: `Insufficient Checkdits. Need ${cost}, have ${usage.limit - usage.used} remaining.` }),
      { status: 429 }
    );
  }

  // Get user's org
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { organisationId: true },
  });

  // Create bulk job
  const bulkJob = await db.bulkCheckJob.create({
    data: {
      userId: session.user.id,
      organisationId: user?.organisationId ?? null,
      filename,
      rowCount: parseResult.totalRows,
      uniqueRowCount: parseResult.uniqueRows,
      duplicateCount: parseResult.duplicateRows,
      mode: "INSTANT",
      status: "PROCESSING",
      checkditsCost: new Prisma.Decimal(cost),
      platformIds,
      categoryIds,
      countryIds,
      columnMapping: parseResult.columnMapping as unknown as Prisma.InputJsonValue,
      startedAt: new Date(),
    },
  });

  // Create row records — mark duplicates
  const firstByHash = new Map<string, string>(); // contentHash → rowId
  const rowRecords: BulkCheckRow[] = [];

  for (const row of parseResult.rows) {
    const existingId = firstByHash.get(row.contentHash);
    const isDuplicate = !!existingId;

    const record = await db.bulkCheckRow.create({
      data: {
        bulkJobId: bulkJob.id,
        rowIndex: row.rowIndex,
        contentHash: row.contentHash,
        adContent: row.adContent as Prisma.InputJsonValue,
        rawCsvRow: row.rawCsvRow as Prisma.InputJsonValue,
        isDuplicate,
        duplicateOfId: existingId ?? null,
        status: isDuplicate ? "SKIPPED_DUPLICATE" : "PENDING",
      },
    });

    if (!isDuplicate) {
      firstByHash.set(row.contentHash, record.id);
    }
    rowRecords.push(record);
  }

  // ── Delta: copy previous results for unchanged rows ────────────────────────
  let deltaReusedCount = 0;
  if (delta && delta.unchangedHashes.size > 0) {
    deltaReusedCount = await copyPreviousResults(
      delta.previousJobId,
      bulkJob.id,
      delta.unchangedHashes
    );
  }

  // Only process rows that are PENDING (excludes duplicates AND delta-reused rows)
  const uniqueRows = rowRecords.filter((r) => !r.isDuplicate);
  const rowsToProcess = recheckAll
    ? uniqueRows
    : uniqueRows.filter((r) => !delta?.unchangedHashes.has(r.contentHash));

  // ── Start stream immediately — heavy work (category detection, AI) runs inside ──
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function emit(event: string, data: unknown) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      // Emit start event immediately so the response begins and Vercel doesn't timeout
      emit("start", {
        jobId: bulkJob.id,
        totalRows: parseResult.totalRows,
        uniqueRows: parseResult.uniqueRows,
        duplicateRows: parseResult.duplicateRows,
        deltaReused: deltaReusedCount,
        rowsToProcess: rowsToProcess.length,
      });

      // ── Per-row category detection (runs inside stream to avoid timeout) ──
      const rowCategoryMap = new Map<string, { categoryId: string; categoryName: string }>();

      if (autoDetectCategories && rowsToProcess.length > 0) {
        console.log(`[bulk-stream] Starting category detection for ${rowsToProcess.length} rows`);
        emit("progress", { phase: "detecting_categories", processed: 0, total: rowsToProcess.length });

        const rowsForDetection = rowsToProcess.map((r) => ({
          key: r.id,
          text: buildDetectionText(r.adContent as Record<string, string>),
        }));

        try {
          const detectStart = Date.now();
          const detected = await Promise.race([
            detectCategoriesForRows(rowsForDetection),
            new Promise<Map<string, never>>((_, reject) =>
              setTimeout(() => reject(new Error("Category detection timed out after 30s")), 30_000)
            ),
          ]);
          const detectMs = Date.now() - detectStart;
          console.log(`[bulk-stream] Detection returned ${detected.size} results in ${detectMs}ms`);
          emit("progress", { phase: "categories_complete", detected: detected.size, total: rowsToProcess.length, ms: detectMs });

          for (const [key, det] of detected) {
            rowCategoryMap.set(key, { categoryId: det.categoryId, categoryName: det.categoryName });
          }

          // Save detected categories to DB
          if (rowCategoryMap.size > 0) {
            await Promise.all(
              rowsToProcess.map((r) => {
                const det = rowCategoryMap.get(r.id);
                if (!det) return Promise.resolve();
                return db.bulkCheckRow.update({
                  where: { id: r.id },
                  data: { detectedCategoryId: det.categoryId, detectedCategoryName: det.categoryName },
                });
              })
            );
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error("[bulk-stream] Category detection failed:", errMsg);
          emit("progress", { phase: "categories_failed", error: errMsg });
        }
      }

      // Emit detected categories so the UI can display them
      if (rowCategoryMap.size > 0) {
        const catEntries: Record<number, { categoryId: string; categoryName: string }> = {};
        for (const row of rowsToProcess) {
          const det = rowCategoryMap.get(row.id);
          if (det) catEntries[row.rowIndex] = det;
        }
        emit("categories_detected", catEntries);
      }

      // ── Build compliance contexts per category ──────────────────────────────
      const allCategoryIds = new Set(categoryIds);
      for (const det of rowCategoryMap.values()) {
        allCategoryIds.add(det.categoryId);
      }
      const allCategoryIdsArray = Array.from(allCategoryIds);

      const [sharedCtx, heldCerts] = await Promise.all([
        fetchComplianceContext({
          platformIds,
          categoryIds: allCategoryIdsArray,
          countryIds,
          adContent: {} as AdContentPayload,
          assetUrls: [],
          assets: [],
        }),
        fetchHeldCertifications(session.user.id, platformIds, allCategoryIdsArray),
      ]);
      const heldCertNames = heldCerts.map((c) => c.certificationName);

      function rulesForCategory(catIds: string[]) {
        const catSet = new Set(catIds);
        const pRules = sharedCtx.platformRules.filter((r) => catSet.has(r.categoryId));
        const gRules = sharedCtx.geoRules.filter((r) => catSet.has(r.categoryId));
        const pConfigs = sharedCtx.prohibitionConfigs.filter((r) => catSet.has(r.categoryId));
        return { pRules, gRules, pConfigs };
      }

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
      let processedCount = 0;
      let cacheHits = 0;

      // Emit delta-reused rows immediately (already COMPLETE from copyPreviousResults)
      if (deltaReusedCount > 0) {
        const reusedRows = await db.bulkCheckRow.findMany({
          where: {
            bulkJobId: bulkJob.id,
            status: "COMPLETE",
            isDuplicate: false,
          },
          select: { rowIndex: true, overallStatus: true },
        });

        for (const row of reusedRows) {
          processedCount++;
          if (row.overallStatus === "CLEAN") passCount++;
          else if (row.overallStatus === "WARNINGS") warningCount++;
          else if (row.overallStatus === "VIOLATIONS") failCount++;

          emit("row_complete", {
            rowIndex: row.rowIndex,
            overallStatus: row.overallStatus,
            processed: processedCount,
            total: rowsToProcess.length + deltaReusedCount,
            cached: true,
            deltaReused: true,
          });
        }
      }

      const totalToReport = rowsToProcess.length + deltaReusedCount;

      // Process changed/new rows in batches
      for (let i = 0; i < rowsToProcess.length; i += BATCH_SIZE) {
        const batch = rowsToProcess.slice(i, i + BATCH_SIZE);

        // ── Phase 1: Transform content + check cache ──────────────────────
        const batchItems: {
          rowRecord: BulkCheckRow;
          adContent: AdContentPayload;
          cacheKey: string;
          cached: ComplianceResult | null;
        }[] = [];

        await Promise.all(
          batch.map(async (rowRecord) => {
            const adContent = toAdContentPayload(
              rowRecord.adContent as Record<string, string>
            ) as AdContentPayload;

            const cacheKey = buildCacheKey({
              adContent,
              platformIds,
              categoryIds,
              countryIds,
              rulesSnapshot,
            });

            const cached = await getCached<ComplianceResult>(cacheKey);

            batchItems.push({ rowRecord, adContent, cacheKey, cached });
          })
        );

        // ── Phase 2: Emit cached results immediately ──────────────────────
        const uncachedItems: typeof batchItems = [];

        for (const item of batchItems) {
          if (item.cached) {
            cacheHits++;
            processedCount++;
            const { rowRecord, cached } = item;
            const overallStatus = cached.overallStatus;

            if (overallStatus === "CLEAN") passCount++;
            else if (overallStatus === "WARNINGS") warningCount++;
            else if (overallStatus === "VIOLATIONS") failCount++;

            // Save to DB
            await db.bulkCheckRow.update({
              where: { id: rowRecord.id },
              data: {
                status: "COMPLETE",
                overallStatus,
                results: cached as unknown as Prisma.InputJsonValue,
                completedAt: new Date(),
              },
            });

            await db.complianceCheck.create({
              data: {
                userId: session.user.id,
                platformIds,
                categoryIds,
                countryIds,
                adContent: item.adContent as unknown as Prisma.InputJsonValue,
                assetUrls: [],
                status: overallStatus,
                overallStatus,
                results: cached as unknown as Prisma.InputJsonValue,
                completedAt: new Date(),
                bulkRowId: rowRecord.id,
              },
            });

            emit("row_complete", {
              rowIndex: rowRecord.rowIndex,
              overallStatus,
              processed: processedCount,
              total: totalToReport,
              cached: true,
            });
          } else {
            uncachedItems.push(item);
          }
        }

        if (uncachedItems.length === 0) {
          emit("progress", {
            processed: processedCount,
            total: totalToReport,
            passCount, warningCount, failCount, errorCount, cacheHits,
          });
          continue;
        }

        // ── Phase 3: Mark uncached rows as processing ─────────────────────
        await Promise.all(
          uncachedItems.map((item) =>
            db.bulkCheckRow.update({
              where: { id: item.rowRecord.id },
              data: { status: "PROCESSING" },
            })
          )
        );

        // ── Phase 4: Run AI analysis ──────────────────────────────────────
        const part1Promises = hasApiKey
          ? uncachedItems.map((item) => {
              const det = rowCategoryMap.get(item.rowRecord.id);
              let rowRulesForEval = sharedRulesForEval;
              let rowCatNames = sharedCtx.categoryNames;
              let rowDeterministic = sharedDeterministicItems;
              let rowFallbacks = sharedRestrictedFallbacks;

              if (det) {
                const { pRules, gRules, pConfigs } = rulesForCategory([det.categoryId]);
                if (pRules.length > 0 || gRules.length > 0) {
                  rowRulesForEval = buildRulesForEvaluation(pRules, gRules, sharedCtx.platformNames, pConfigs);
                  rowCatNames = [det.categoryName];
                  rowDeterministic = checkDeterministicRules(pRules, gRules, sharedCtx.platformNames);
                  rowFallbacks = buildRestrictedFallbacks(pRules, gRules, sharedCtx.platformNames);
                }
              }

              (item as Record<string, unknown>)._rowRulesForEval = rowRulesForEval;
              (item as Record<string, unknown>)._rowCatNames = rowCatNames;
              (item as Record<string, unknown>)._rowDeterministic = rowDeterministic;
              (item as Record<string, unknown>)._rowFallbacks = rowFallbacks;
              (item as Record<string, unknown>)._rowCatIds = det ? [det.categoryId] : categoryIds;

              if (rowRulesForEval.length === 0) return Promise.resolve(null);

              return Promise.race([
                runAiAnalysis(
                  item.adContent, [], sharedCtx.platformNames,
                  rowCatNames, sharedCtx.countryNames,
                  rowRulesForEval, [], heldCertNames,
                  { skipPart2: true, modelOverride: "claude-haiku-4-5-20251001" }
                ),
                new Promise<null>((_, reject) =>
                  setTimeout(() => reject(new Error("AI timeout (30s)")), 30_000)
                ),
              ]).catch((err) => {
                console.error(`[bulk] Part1 AI failed for row ${item.rowRecord.rowIndex}:`, err);
                return null;
              });
            })
          : uncachedItems.map(() => Promise.resolve(null));

        const part2Promise = hasApiKey
          ? runBatchedPart2Analysis(
              uncachedItems.map((item) => ({
                key: item.rowRecord.id,
                adContent: item.adContent,
              })),
              sharedCtx.platformNames,
              sharedCtx.categoryNames,
              sharedCtx.countryNames
            ).catch((err) => {
              console.error("[bulk] Batched Part2 failed:", err);
              return new Map<string, never[]>();
            })
          : Promise.resolve(new Map<string, never[]>());

        const [part1Results, part2Map] = await Promise.all([
          Promise.all(part1Promises),
          part2Promise,
        ]);

        // ── Phase 5: Merge results and emit ───────────────────────────────
        for (let j = 0; j < uncachedItems.length; j++) {
          const item = uncachedItems[j];
          const { rowRecord, adContent, cacheKey } = item;
          processedCount++;

          try {
            const rowDeterministic = (item as Record<string, unknown>)._rowDeterministic as typeof sharedDeterministicItems ?? sharedDeterministicItems;
            const rowFallbacks = (item as Record<string, unknown>)._rowFallbacks as typeof sharedRestrictedFallbacks ?? sharedRestrictedFallbacks;
            const rowCatIds = (item as Record<string, unknown>)._rowCatIds as string[] ?? categoryIds;

            const technicalItems = checkTechnicalSpecs(
              adContent, sharedCtx.channelRequirements, []
            );

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
              technicalItems, rowDeterministic, rowFallbacks,
              aiOutput, sharedCtx.platformNames
            );
            const checklist = applyCertificationOverrides(rawChecklist, heldCerts, rowCatIds);
            const overallStatus = computeOverallStatus(checklist);
            const summary = aiOutput?.summary || generateSummary(
              checklist, sharedCtx.platformNames, sharedCtx.countryNames
            );

            const result: ComplianceResult = {
              overallStatus,
              checklist,
              overrides: [],
              summary,
              checkedAt: new Date().toISOString(),
              issues: deriveIssues(checklist),
            };

            setCached(cacheKey, result).catch(() => {});

            await db.bulkCheckRow.update({
              where: { id: rowRecord.id },
              data: {
                status: "COMPLETE",
                overallStatus,
                results: result as unknown as Prisma.InputJsonValue,
                completedAt: new Date(),
              },
            });

            await db.complianceCheck.create({
              data: {
                userId: session.user.id,
                platformIds,
                categoryIds: rowCatIds,
                countryIds,
                adContent: adContent as unknown as Prisma.InputJsonValue,
                assetUrls: [],
                status: overallStatus,
                overallStatus,
                results: result as unknown as Prisma.InputJsonValue,
                completedAt: new Date(),
                bulkRowId: rowRecord.id,
              },
            });

            if (overallStatus === "CLEAN") passCount++;
            else if (overallStatus === "WARNINGS") warningCount++;
            else if (overallStatus === "VIOLATIONS") failCount++;

            emit("row_complete", {
              rowIndex: rowRecord.rowIndex,
              overallStatus,
              processed: processedCount,
              total: totalToReport,
            });
          } catch (err) {
            console.error(`[bulk] Fatal error for row ${rowRecord.rowIndex}:`, err);
            errorCount++;

            await db.bulkCheckRow.update({
              where: { id: rowRecord.id },
              data: { status: "FAILED", completedAt: new Date() },
            }).catch(() => {});

            emit("row_error", {
              rowIndex: rowRecord.rowIndex,
              processed: processedCount,
              total: totalToReport,
            });
          }
        }

        emit("progress", {
          processed: processedCount,
          total: totalToReport,
          passCount, warningCount, failCount, errorCount, cacheHits,
        });
      }

      // Copy results to duplicate rows
      for (const row of rowRecords.filter((r) => r.isDuplicate && r.duplicateOfId)) {
        const original = await db.bulkCheckRow.findUnique({
          where: { id: row.duplicateOfId! },
          select: { overallStatus: true, results: true },
        });
        if (original) {
          await db.bulkCheckRow.update({
            where: { id: row.id },
            data: {
              overallStatus: original.overallStatus,
              results: original.results ?? Prisma.DbNull,
              completedAt: new Date(),
            },
          });
        }
      }

      // Refund for any failed rows
      const refundAmount = errorCount * INSTANT_RATE;

      // Finalise job
      const summary = { passCount, warningCount, failCount, errorCount, cacheHits };
      await db.bulkCheckJob.update({
        where: { id: bulkJob.id },
        data: {
          status: errorCount === rowsToProcess.length && deltaReusedCount === 0 ? "FAILED" : "COMPLETE",
          resultsSummary: summary as unknown as Prisma.InputJsonValue,
          checkditsRefund: new Prisma.Decimal(refundAmount),
          completedAt: new Date(),
        },
      });

      // Deduct net credits (cost minus refund for failed rows)
      const netCredits = Math.max(0, Math.ceil((cost - refundAmount) * 10) / 10);
      if (netCredits > 0) {
        await deductCredits(session.user.id, Math.ceil(netCredits));
      }

      emit("complete", {
        jobId: bulkJob.id,
        summary,
        refund: refundAmount > 0 ? refundAmount : undefined,
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
