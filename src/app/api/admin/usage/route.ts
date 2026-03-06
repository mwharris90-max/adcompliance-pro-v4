import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  // Per-organisation usage this month
  const orgs = await db.organisation.findMany({
    where: { active: true },
    include: {
      users: {
        select: {
          id: true,
          name: true,
          email: true,
          _count: { select: { complianceChecks: { where: { createdAt: { gte: start } } } } },
        },
      },
    },
  });

  // Users with no org
  const unassigned = await db.user.findMany({
    where: { organisationId: null, role: "USER", active: true },
    select: {
      id: true,
      name: true,
      email: true,
      _count: { select: { complianceChecks: { where: { createdAt: { gte: start } } } } },
    },
  });

  // Total checks this month
  const totalThisMonth = await db.complianceCheck.count({ where: { createdAt: { gte: start } } });

  // Total all time
  const totalAllTime = await db.complianceCheck.count();

  const orgStats = orgs.map((org) => ({
    id: org.id,
    name: org.name,
    monthlyLimit: org.monthlyLimit,
    checksThisMonth: org.users.reduce((sum, u) => sum + u._count.complianceChecks, 0),
    userCount: org.users.length,
    users: org.users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      checksThisMonth: u._count.complianceChecks,
    })),
  }));

  return NextResponse.json({
    success: true,
    data: {
      totalThisMonth,
      totalAllTime,
      month: start.toLocaleString("default", { month: "long", year: "numeric" }),
      organisations: orgStats,
      unassigned: unassigned.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        checksThisMonth: u._count.complianceChecks,
      })),
    },
  });
}
