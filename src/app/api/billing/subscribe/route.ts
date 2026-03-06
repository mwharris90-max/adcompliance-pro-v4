import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getStripe, getPlanByTier, SUBSCRIPTION_PLANS } from "@/lib/stripe";

/**
 * POST /api/billing/subscribe
 * Creates a Stripe Checkout session for a subscription plan.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tier } = await req.json();
  const plan = getPlanByTier(tier);
  if (!plan || !plan.priceId) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const stripe = getStripe();
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { stripeCustomerId: true, email: true, name: true, organisationId: true },
  });

  // Check if org already has a subscription
  if (user?.organisationId) {
    const org = await db.organisation.findUnique({
      where: { id: user.organisationId },
      select: { stripeSubscriptionId: true, subscriptionStatus: true },
    });
    if (org?.stripeSubscriptionId && org.subscriptionStatus === "active") {
      return NextResponse.json(
        { error: "You already have an active subscription. Please manage it from the billing portal." },
        { status: 400 }
      );
    }
  }

  // Get or create Stripe customer
  let customerId = user?.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user?.email ?? undefined,
      name: user?.name ?? undefined,
      metadata: { userId: session.user.id },
    });
    customerId = customer.id;
    await db.user.update({
      where: { id: session.user.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: plan.priceId, quantity: 1 }],
    success_url: `${appUrl}/app/billing?subscribed=true&plan=${plan.tier}`,
    cancel_url: `${appUrl}/app/billing?cancelled=true`,
    metadata: {
      userId: session.user.id,
      tier: plan.tier,
      monthlyCredits: String(plan.monthlyCredits),
    },
  });

  return NextResponse.json({ url: checkoutSession.url });
}

/**
 * GET /api/billing/subscribe
 * Returns available subscription plans.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    plans: SUBSCRIPTION_PLANS.map((p) => ({
      tier: p.tier,
      name: p.name,
      monthlyCredits: p.monthlyCredits,
      amount: p.amount,
      currency: p.currency,
      features: p.features,
      hasPrice: !!p.priceId,
    })),
  });
}
