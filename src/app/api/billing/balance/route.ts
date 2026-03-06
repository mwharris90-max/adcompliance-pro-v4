import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { organisationId: true },
  });

  let creditBalance = 0;
  if (user?.organisationId) {
    const org = await db.organisation.findUnique({
      where: { id: user.organisationId },
      select: { creditBalance: true },
    });
    creditBalance = org?.creditBalance ?? 0;
  }

  return NextResponse.json({ creditBalance });
}
