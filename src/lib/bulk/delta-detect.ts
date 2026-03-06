import { db } from "@/lib/db";

export interface DeltaResult {
  unchangedHashes: Set<string>;
  changedRowIndexes: number[];
  newRowIndexes: number[];
  removedRowIndexes: number[];
  previousJobId: string;
}

/**
 * Compare a new CSV upload against the most recent bulk job for this user.
 * Returns which rows are unchanged (can reuse results) vs changed/new.
 */
export async function detectDelta(
  userId: string,
  rowHashes: Array<{ rowIndex: number; contentHash: string }>,
  filename: string
): Promise<DeltaResult | null> {
  // Find the most recent completed bulk job for this user with the same filename
  const previousJob = await db.bulkCheckJob.findFirst({
    where: {
      userId,
      filename,
      status: "COMPLETE",
    },
    orderBy: { completedAt: "desc" },
    select: { id: true },
  });

  if (!previousJob) return null;

  // Get all row hashes from the previous job
  const previousRows = await db.bulkCheckRow.findMany({
    where: { bulkJobId: previousJob.id },
    select: { rowIndex: true, contentHash: true },
  });

  const previousHashSet = new Set(previousRows.map((r) => r.contentHash));
  const newHashSet = new Set(rowHashes.map((r) => r.contentHash));

  const unchangedHashes = new Set<string>();
  const changedRowIndexes: number[] = [];
  const newRowIndexes: number[] = [];

  for (const row of rowHashes) {
    if (previousHashSet.has(row.contentHash)) {
      unchangedHashes.add(row.contentHash);
    } else {
      changedRowIndexes.push(row.rowIndex);
      newRowIndexes.push(row.rowIndex);
    }
  }

  // Rows in previous but not in new = removed
  const removedRowIndexes: number[] = [];
  for (const prevRow of previousRows) {
    if (!newHashSet.has(prevRow.contentHash)) {
      removedRowIndexes.push(prevRow.rowIndex);
    }
  }

  return {
    unchangedHashes,
    changedRowIndexes,
    newRowIndexes,
    removedRowIndexes,
    previousJobId: previousJob.id,
  };
}

/**
 * Copy results from a previous job's rows for unchanged content hashes.
 */
export async function copyPreviousResults(
  previousJobId: string,
  targetJobId: string,
  unchangedHashes: Set<string>
): Promise<number> {
  if (unchangedHashes.size === 0) return 0;

  // Get results from previous rows
  const previousRows = await db.bulkCheckRow.findMany({
    where: {
      bulkJobId: previousJobId,
      contentHash: { in: Array.from(unchangedHashes) },
      status: "COMPLETE",
    },
    select: { contentHash: true, overallStatus: true, results: true },
  });

  const resultsByHash = new Map(previousRows.map((r) => [r.contentHash, r]));

  // Update target rows that match
  const targetRows = await db.bulkCheckRow.findMany({
    where: {
      bulkJobId: targetJobId,
      contentHash: { in: Array.from(unchangedHashes) },
    },
    select: { id: true, contentHash: true },
  });

  let copied = 0;
  for (const targetRow of targetRows) {
    const prev = resultsByHash.get(targetRow.contentHash);
    if (prev) {
      await db.bulkCheckRow.update({
        where: { id: targetRow.id },
        data: {
          status: "COMPLETE",
          overallStatus: prev.overallStatus,
          results: prev.results ?? undefined,
          completedAt: new Date(),
        },
      });
      copied++;
    }
  }

  return copied;
}
