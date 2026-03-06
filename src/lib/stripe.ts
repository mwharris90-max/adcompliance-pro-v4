import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return stripeInstance;
}

// Credit pack definitions — must match Stripe price metadata
export const CREDIT_PACKS = [
  {
    name: "Starter Pack",
    credits: 50,
    priceId: "price_1T80Fc989wmDp0YIB8tt1kgM",
    amount: 999,
    currency: "gbp",
    popular: false,
  },
  {
    name: "Growth Pack",
    credits: 200,
    priceId: "price_1T80Fd989wmDp0YIihGPN8zk",
    amount: 2999,
    currency: "gbp",
    popular: true,
  },
  {
    name: "Agency Pack",
    credits: 500,
    priceId: "price_1T80Fd989wmDp0YI1PL5u4pO",
    amount: 5999,
    currency: "gbp",
    popular: false,
  },
] as const;

export function getPackByPriceId(priceId: string) {
  return CREDIT_PACKS.find((p) => p.priceId === priceId) ?? null;
}
