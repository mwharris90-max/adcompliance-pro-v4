import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getStripe, getPackByPriceId, CREDIT_PACKS } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { priceId } = await req.json();
  const pack = getPackByPriceId(priceId);
  if (!pack) {
    return NextResponse.json({ error: "Invalid price" }, { status: 400 });
  }

  const stripe = getStripe();
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { stripeCustomerId: true, email: true, name: true },
  });

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
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/app/billing?success=true&credits=${pack.credits}`,
    cancel_url: `${appUrl}/app/billing?cancelled=true`,
    metadata: {
      userId: session.user.id,
      credits: String(pack.credits),
      packName: pack.name,
    },
  });

  return NextResponse.json({ url: checkoutSession.url });
}

// Return available packs
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    packs: CREDIT_PACKS.map((p) => ({
      name: p.name,
      credits: p.credits,
      priceId: p.priceId,
      amount: p.amount,
      currency: p.currency,
      popular: p.popular,
    })),
  });
}
