import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const status = req.nextUrl.searchParams.get("status") ?? "PENDING";
  const ruleType = req.nextUrl.searchParams.get("ruleType");

  const changes = await db.proposedChange.findMany({
    where: {
      ...(status !== "ALL" ? { status: status as never } : {}),
      ...(ruleType ? { ruleType: ruleType as never } : {}),
    },
    orderBy: { detectedAt: "desc" },
    include: {
      category: { select: { id: true, name: true } },
      country: { select: { id: true, name: true, code: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ success: true, data: changes });
}
