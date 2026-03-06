import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobs = await db.bulkCheckJob.findMany({
    where: { userId: session.user.id },
    orderBy: { submittedAt: "desc" },
    take: 50,
    select: {
      id: true,
      filename: true,
      rowCount: true,
      uniqueRowCount: true,
      duplicateCount: true,
      mode: true,
      status: true,
      checkditsCost: true,
      checkditsRefund: true,
      resultsSummary: true,
      submittedAt: true,
      startedAt: true,
      completedAt: true,
    },
  });

  return NextResponse.json({ jobs });
}
