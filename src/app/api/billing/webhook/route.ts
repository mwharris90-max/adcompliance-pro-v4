import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const credits = parseInt(session.metadata?.credits ?? "0");
    const packName = session.metadata?.packName ?? "Unknown";

    if (!userId || credits <= 0) {
      console.error("[stripe-webhook] Missing metadata:", session.metadata);
      return NextResponse.json({ error: "Invalid metadata" }, { status: 400 });
    }

    // Idempotency: check if this session was already processed
    const existing = await db.creditTransaction.findUnique({
      where: { stripeSessionId: session.id },
    });
    if (existing) {
      console.log("[stripe-webhook] Already processed session:", session.id);
      return NextResponse.json({ received: true });
    }

    // Get user's org
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { organisationId: true },
    });

    // Create transaction record and add credits
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
      // Add credits to org (or increase monthly limit if no org)
      ...(user?.organisationId
        ? [
            db.organisation.update({
              where: { id: user.organisationId },
              data: { creditBalance: { increment: credits } },
            }),
          ]
        : []),
    ]);

    console.log(`[stripe-webhook] Added ${credits} credits for user ${userId} (session: ${session.id})`);
  }

  return NextResponse.json({ received: true });
}
