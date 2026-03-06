import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { parseGoogleAdsCsv, toAdContentPayload } from "@/lib/bulk/csv-parser";
import { getMonthlyUsage } from "@/lib/usage";
import { detectDelta } from "@/lib/bulk/delta-detect";

const INSTANT_RATE = 0.5; // Checkdits per row
const BATCH_RATE = 0.1;   // Checkdits per row

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const csvText = body.csvText as string | undefined;
  const filename = (body.filename as string) ?? "upload.csv";
  const recheckAll = body.recheckAll === true;

  if (!csvText || typeof csvText !== "string") {
    return NextResponse.json(
      { error: "Missing csvText in request body" },
      { status: 400 }
    );
  }

  const result = parseGoogleAdsCsv(csvText);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  // Delta detection — compare against previous upload of same file
  // Skip delta detection if user chose to recheck all rows
  const delta = recheckAll ? null : await detectDelta(
    session.user.id,
    result.rows.map((r) => ({ rowIndex: r.rowIndex, contentHash: r.contentHash })),
    filename
  );

  const unchangedCount = delta ? delta.unchangedHashes.size : 0;
  const rowsToCheck = result.uniqueRows - unchangedCount;

  // Get user's remaining Checkdits
  const usage = await getMonthlyUsage(session.user.id);
  const remaining = usage.limit !== null ? usage.limit - usage.used : null;

  const instantCost = Math.ceil(rowsToCheck * INSTANT_RATE * 10) / 10;
  const batchCost = Math.ceil(rowsToCheck * BATCH_RATE * 10) / 10;

  // Extract headline + body from first row for category auto-detection
  let firstRowContent: { headline?: string; body?: string } | null = null;
  if (result.rows.length > 0) {
    const payload = toAdContentPayload(result.rows[0].adContent);
    firstRowContent = {
      headline: payload.headline as string | undefined,
      body: payload.body as string | undefined,
    };
  }

  return NextResponse.json({
    success: true,
    columnMapping: result.columnMapping,
    firstRowContent,
    preview: {
      totalRows: result.totalRows,
      uniqueRows: result.uniqueRows,
      duplicateRows: result.duplicateRows,
      duplicateGroups: Object.keys(result.duplicateGroups).length,
      columnsDetected: Object.entries(result.columnMapping.mapped).map(
        ([csvHeader, field]) => ({ csvHeader, field })
      ),
      unmappedColumns: result.columnMapping.unmapped,
      delta: delta ? {
        unchangedRows: unchangedCount,
        changedRows: rowsToCheck,
        previousJobId: delta.previousJobId,
      } : null,
      pricing: {
        instant: {
          ratePerRow: INSTANT_RATE,
          totalCost: instantCost,
          rowsCharged: rowsToCheck,
          description: unchangedCount > 0
            ? `Results in ~60 seconds (${unchangedCount} rows reused from previous check)`
            : "Results in ~60 seconds",
        },
        batch: {
          ratePerRow: BATCH_RATE,
          totalCost: batchCost,
          rowsCharged: rowsToCheck,
          description: "Results within 24 hours",
        },
      },
      balance: {
        remaining,
        limit: usage.limit,
        used: usage.used,
        canAffordInstant: remaining === null || remaining >= instantCost,
        canAffordBatch: remaining === null || remaining >= batchCost,
      },
    },
  });
}
