import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getPlanByTier } from "@/lib/stripe";

/**
 * GET /api/billing/subscription
 * Returns the current user's subscription status.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { organisationId: true },
  });

  if (!user?.organisationId) {
    return NextResponse.json({
      subscription: null,
      tier: "FREE",
      plan: getPlanByTier("FREE"),
    });
  }

  const org = await db.organisation.findUnique({
    where: { id: user.organisationId },
    select: {
      subscriptionTier: true,
      subscriptionStatus: true,
      monthlyCreditsIncluded: true,
      monthlyCreditsUsed: true,
      currentPeriodEnd: true,
      creditBalance: true,
    },
  });

  const tier = org?.subscriptionTier ?? "FREE";
  const plan = getPlanByTier(tier);

  return NextResponse.json({
    subscription: org?.subscriptionStatus
      ? {
          tier,
          status: org.subscriptionStatus,
          monthlyCreditsIncluded: org.monthlyCreditsIncluded,
          monthlyCreditsUsed: org.monthlyCreditsUsed,
          currentPeriodEnd: org.currentPeriodEnd?.toISOString() ?? null,
        }
      : null,
    tier,
    plan,
    creditBalance: org?.creditBalance ?? 0,
  });
}
