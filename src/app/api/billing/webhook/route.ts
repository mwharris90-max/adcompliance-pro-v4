import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getStripe, getPlanByPriceId } from "@/lib/stripe";
import type Stripe from "stripe";

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("[stripe-webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
      break;
    case "invoice.paid":
      await handleInvoicePaid(event.data.object as Stripe.Invoice);
      break;
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
}

/**
 * One-off credit pack purchase completed.
 */
async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  // Only handle one-time payments (subscriptions are handled by invoice.paid)
  if (session.mode === "subscription") {
    // Subscription checkout — store the subscription ID on the org
    const userId = session.metadata?.userId;
    const tier = session.metadata?.tier;
    const monthlyCredits = parseInt(session.metadata?.monthlyCredits ?? "0");

    if (!userId || !tier) return;

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { organisationId: true },
    });

    if (!user?.organisationId) return;

    const subscriptionId = session.subscription as string;

    await db.organisation.update({
      where: { id: user.organisationId },
      data: {
        subscriptionTier: tier,
        stripeSubscriptionId: subscriptionId,
        subscriptionStatus: "active",
        monthlyCreditsIncluded: monthlyCredits,
        monthlyCreditsUsed: 0,
      },
    });

    console.log(`[stripe-webhook] Subscription ${tier} activated for org ${user.organisationId}`);
    return;
  }

  // One-time payment
  const userId = session.metadata?.userId;
  const credits = parseInt(session.metadata?.credits ?? "0");
  const packName = session.metadata?.packName ?? "Unknown";

  if (!userId || credits <= 0) {
    console.error("[stripe-webhook] Missing metadata:", session.metadata);
    return;
  }

  // Idempotency
  const existing = await db.creditTransaction.findUnique({
    where: { stripeSessionId: session.id },
  });
  if (existing) return;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { organisationId: true },
  });

  await db.$transaction([
    db.creditTransaction.create({
      data: {
        userId,
        organisationId: user?.organisationId ?? undefined,
        type: "PURCHASE",
        credits,
        stripeSessionId: session.id,
        stripePaymentId: session.payment_intent as string | undefined,
        packName,
        amountPaid: session.amount_total ?? undefined,
        currency: session.currency ?? "gbp",
      },
    }),
    ...(user?.organisationId
      ? [
          db.organisation.update({
            where: { id: user.organisationId },
            data: { creditBalance: { increment: credits } },
          }),
        ]
      : []),
  ]);

  console.log(`[stripe-webhook] Added ${credits} credits for user ${userId}`);
}

/**
 * Subscription renewal invoice paid — allocate monthly credits.
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const sub = (invoice as unknown as { subscription?: string | { id: string } }).subscription;
  const subscriptionId = typeof sub === "string" ? sub : sub?.id ?? null;
  if (!subscriptionId) return;

  // Find the org with this subscription
  const org = await db.organisation.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
  });
  if (!org) return;

  const plan = org.subscriptionTier
    ? await import("@/lib/stripe").then((m) => m.getPlanByTier(org.subscriptionTier!))
    : null;
  if (!plan) return;

  // Get the period from the invoice
  const periodStart = invoice.period_start
    ? new Date(invoice.period_start * 1000)
    : new Date();
  const periodEnd = invoice.period_end
    ? new Date(invoice.period_end * 1000)
    : new Date();

  // Reset monthly usage and add subscription credits to balance
  await db.$transaction([
    db.organisation.update({
      where: { id: org.id },
      data: {
        monthlyCreditsUsed: 0,
        creditBalance: { increment: plan.monthlyCredits },
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        subscriptionStatus: "active",
      },
    }),
    db.creditTransaction.create({
      data: {
        userId: (await db.user.findFirst({ where: { organisationId: org.id }, select: { id: true } }))?.id ?? "system",
        organisationId: org.id,
        type: "SUBSCRIPTION",
        credits: plan.monthlyCredits,
        packName: `${plan.name} Plan — Monthly Allocation`,
        currency: "gbp",
      },
    }),
  ]);

  console.log(`[stripe-webhook] Renewed ${plan.monthlyCredits} credits for org ${org.id} (${plan.name})`);
}

/**
 * Subscription updated (upgrade/downgrade, status change).
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const org = await db.organisation.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });
  if (!org) return;

  const priceId = subscription.items.data[0]?.price?.id;
  const plan = priceId ? getPlanByPriceId(priceId) : null;

  await db.organisation.update({
    where: { id: org.id },
    data: {
      subscriptionStatus: subscription.status,
      ...(plan
        ? {
            subscriptionTier: plan.tier,
            monthlyCreditsIncluded: plan.monthlyCredits,
          }
        : {}),
      currentPeriodEnd: new Date((subscription as unknown as { current_period_end: number }).current_period_end * 1000),
    },
  });

  console.log(`[stripe-webhook] Subscription updated for org ${org.id}: ${subscription.status}`);
}

/**
 * Subscription cancelled/deleted.
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const org = await db.organisation.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });
  if (!org) return;

  await db.organisation.update({
    where: { id: org.id },
    data: {
      subscriptionStatus: "canceled",
      subscriptionTier: "FREE",
      monthlyCreditsIncluded: 0,
    },
  });

  console.log(`[stripe-webhook] Subscription canceled for org ${org.id}`);
}
