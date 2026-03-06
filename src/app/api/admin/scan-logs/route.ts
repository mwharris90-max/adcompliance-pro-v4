import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const logs = await db.scanLog.findMany({
    orderBy: { startedAt: "desc" },
    take: 30,
  });

  return NextResponse.json({ success: true, data: logs });
}
