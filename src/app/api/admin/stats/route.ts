import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [checksToday, pendingChanges, approvedCountries, lastScan, recentActivity] =
    await Promise.all([
      db.complianceCheck.count({ where: { createdAt: { gte: today } } }),
      db.proposedChange.count({ where: { status: "PENDING" } }),
      db.country.count({ where: { approved: true } }),
      db.scanSource.findFirst({
        where: { lastScannedAt: { not: null } },
        orderBy: { lastScannedAt: "desc" },
        select: { lastScannedAt: true },
      }),
      db.proposedChange.findMany({
        where: { status: { in: ["CONFIRMED", "REJECTED"] } },
        orderBy: { reviewedAt: "desc" },
        take: 10,
        select: {
          id: true,
          changeType: true,
          ruleType: true,
          status: true,
          reviewedAt: true,
          aiSummary: true,
          reviewedBy: { select: { name: true } },
        },
      }),
    ]);

  return NextResponse.json({
    success: true,
    data: {
      checksToday,
      pendingChanges,
      approvedCountries,
      lastScanAt: lastScan?.lastScannedAt ?? null,
      recentActivity,
    },
  });
}
