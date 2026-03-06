import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getMonthlyUsage, getCreditBalance } from "@/lib/usage";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [{ used, limit }, creditBalance] = await Promise.all([
    getMonthlyUsage(session.user.id),
    getCreditBalance(session.user.id),
  ]);

  const remaining = limit !== null ? Math.max(0, limit - used) : null;
  const percentage = limit !== null ? Math.round((used / limit) * 100) : null;

  return NextResponse.json({ used, limit, remaining, percentage, creditBalance });
}
