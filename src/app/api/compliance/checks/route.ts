import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * GET /api/compliance/checks
 * Returns the user's compliance check history with optional source filtering.
 *
 * Query params:
 *   source: "WEB" | "EXTENSION" | "BULK" | "INTEGRATION" (optional, filters by source)
 *   status: "CLEAN" | "WARNINGS" | "VIOLATIONS" (optional, filters by overallStatus)
 *   limit: number (default 50)
 *   offset: number (default 0)
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const source = params.get("source");
  const status = params.get("status");
  const limit = Math.min(parseInt(params.get("limit") ?? "50"), 100);
  const offset = parseInt(params.get("offset") ?? "0");

  // Build the where clause
  const where: Record<string, unknown> = { userId: session.user.id };
  if (source) where.source = source;
  if (status) where.overallStatus = status;

  const [checks, total] = await Promise.all([
    db.complianceCheck.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        status: true,
        overallStatus: true,
        platformIds: true,
        categoryIds: true,
        countryIds: true,
        adContent: true,
        source: true,
        createdAt: true,
        completedAt: true,
      },
    }),
    db.complianceCheck.count({ where }),
  ]);

  // Resolve platform names
  const allPlatformIds = [...new Set(checks.flatMap((c) => c.platformIds))];
  const platformRows = allPlatformIds.length
    ? await db.platform.findMany({
        where: { id: { in: allPlatformIds } },
        select: { id: true, name: true },
      })
    : [];
  const platformMap = Object.fromEntries(platformRows.map((p) => [p.id, p.name]));

  // Source counts for filter tabs
  const sourceCounts = await db.$queryRawUnsafe<{ source: string | null; _count: bigint }[]>(
    `SELECT source, COUNT(*) as "_count" FROM "compliance_checks" WHERE "userId" = $1 GROUP BY source`,
    session.user.id
  );

  const allTotal = await db.complianceCheck.count({ where: { userId: session.user.id } });
  const sourceCountMap: Record<string, number> = { ALL: allTotal };
  for (const row of sourceCounts) {
    const key = row.source ?? "WEB";
    sourceCountMap[key] = (sourceCountMap[key] ?? 0) + Number(row._count);
  }

  return NextResponse.json({
    checks: checks.map((c) => {
      const content = c.adContent as Record<string, string> | null;
      return {
        id: c.id,
        status: c.overallStatus ?? c.status,
        platformIds: c.platformIds,
        platformNames: c.platformIds.map((id) => platformMap[id] ?? id),
        countryCount: c.countryIds.length,
        headline: content?.headline ?? content?.title ?? "",
        source: c.source ?? "WEB",
        createdAt: c.createdAt,
        completedAt: c.completedAt,
      };
    }),
    total,
    sourceCounts: sourceCountMap,
  });
}
