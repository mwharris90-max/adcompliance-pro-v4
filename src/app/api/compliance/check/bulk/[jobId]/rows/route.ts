import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await params;

  const job = await db.bulkCheckJob.findUnique({
    where: { id: jobId },
    select: { userId: true, columnMapping: true },
  });

  if (!job || job.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await db.bulkCheckRow.findMany({
    where: { bulkJobId: jobId },
    orderBy: { rowIndex: "asc" },
    select: {
      id: true,
      rowIndex: true,
      adContent: true,
      rawCsvRow: true,
      overallStatus: true,
      results: true,
      isDuplicate: true,
      editedContent: true,
      status: true,
      detectedCategoryId: true,
      detectedCategoryName: true,
      overrideCategoryIds: true,
    },
  });

  return NextResponse.json({
    rows: rows.map((r) => ({
      rowIndex: r.rowIndex,
      adContent: r.adContent as Record<string, string>,
      rawCsvRow: r.rawCsvRow as Record<string, string>,
      overallStatus: r.overallStatus,
      results: r.results as Record<string, unknown> | null,
      isDuplicate: r.isDuplicate,
      editedContent: r.editedContent as Record<string, string> | null,
      detectedCategoryId: r.detectedCategoryId,
      detectedCategoryName: r.detectedCategoryName,
      overrideCategoryIds: r.overrideCategoryIds as string[] | null,
      bulkRowId: r.id,
      bulkJobId: jobId,
    })),
    columnMapping: job.columnMapping,
  });
}
