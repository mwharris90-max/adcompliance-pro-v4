import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Prisma, type BulkCheckRow } from "@prisma/client";
import { parseGoogleAdsCsv } from "@/lib/bulk/csv-parser";
import { getMonthlyUsage } from "@/lib/usage";
import { detectDelta, copyPreviousResults } from "@/lib/bulk/delta-detect";

const BATCH_RATE = 0.1;

const batchSchema = z.object({
  csvText: z.string().min(1),
  filename: z.string().default("upload.csv"),
  platformIds: z.array(z.string()).min(1),
  categoryIds: z.array(z.string()).min(1),
  countryIds: z.array(z.string()).min(1),
  recheckAll: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const { csvText, filename, platformIds, categoryIds, countryIds, recheckAll } = parsed.data;

  const parseResult = parseGoogleAdsCsv(csvText);
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error }, { status: 422 });
  }

  // Delta detection
  const delta = recheckAll ? null : await detectDelta(
    session.user.id,
    parseResult.rows.map((r) => ({ rowIndex: r.rowIndex, contentHash: r.contentHash })),
    filename
  );
  const unchangedCount = delta ? delta.unchangedHashes.size : 0;
  const rowsToCheck = parseResult.uniqueRows - unchangedCount;

  // Check affordability (only charge for changed/new rows)
  const usage = await getMonthlyUsage(session.user.id);
  const cost = Math.ceil(rowsToCheck * BATCH_RATE * 10) / 10;
  if (usage.limit !== null && usage.used + cost > usage.limit) {
    return NextResponse.json(
      { error: `Insufficient Checkdits. Need ${cost}, have ${usage.limit - usage.used} remaining.` },
      { status: 429 }
    );
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { organisationId: true },
  });

  // Create job (PENDING — will be picked up by cron)
  const bulkJob = await db.bulkCheckJob.create({
    data: {
      userId: session.user.id,
      organisationId: user?.organisationId ?? null,
      filename,
      rowCount: parseResult.totalRows,
      uniqueRowCount: parseResult.uniqueRows,
      duplicateCount: parseResult.duplicateRows,
      mode: "BATCH",
      status: "PENDING",
      checkditsCost: new Prisma.Decimal(cost),
      platformIds,
      categoryIds,
      countryIds,
      columnMapping: parseResult.columnMapping as unknown as Prisma.InputJsonValue,
    },
  });

  // Create row records
  const firstByHash = new Map<string, string>();
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
  }

  // Copy previous results for unchanged rows (they won't be processed by cron)
  if (delta && delta.unchangedHashes.size > 0) {
    await copyPreviousResults(delta.previousJobId, bulkJob.id, delta.unchangedHashes);
  }

  return NextResponse.json({
    success: true,
    jobId: bulkJob.id,
    message: `Batch job queued. ${rowsToCheck} rows will be processed (${unchangedCount} unchanged rows reused). You'll be notified when complete.`,
    cost,
  });
}
