import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return stripeInstance;
}

// ─── One-off credit packs ───

export const CREDIT_PACKS = [
  {
    name: "Starter Pack",
    credits: 50,
    priceId: "price_1T80Fc989wmDp0YIB8tt1kgM",
    amount: 999,   // £9.99
    currency: "gbp",
    popular: false,
  },
  {
    name: "Growth Pack",
    credits: 200,
    priceId: "price_1T80Fd989wmDp0YIihGPN8zk",
    amount: 2999,  // £29.99
    currency: "gbp",
    popular: true,
  },
  {
    name: "Agency Pack",
    credits: 500,
    priceId: "price_1T80Fd989wmDp0YI1PL5u4pO",
    amount: 5999,  // £59.99
    currency: "gbp",
    popular: false,
  },
] as const;

export function getPackByPriceId(priceId: string) {
  return CREDIT_PACKS.find((p) => p.priceId === priceId) ?? null;
}

// ─── Subscription plans ───

export interface SubscriptionPlan {
  tier: string;
  name: string;
  monthlyCredits: number;
  priceId: string | null;  // null for Free tier
  amount: number;          // in pence/month
  currency: string;
  features: string[];
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    tier: "FREE",
    name: "Free",
    monthlyCredits: 10,
    priceId: null,
    amount: 0,
    currency: "gbp",
    features: [
      "10 Checkdits/month",
      "All platforms & countries",
      "AI-powered analysis",
      "Basic results history",
    ],
  },
  {
    tier: "PRO",
    name: "Pro",
    monthlyCredits: 150,
    priceId: process.env.STRIPE_PRO_PRICE_ID ?? "price_pro_placeholder",
    amount: 1999,  // £19.99/month
    currency: "gbp",
    features: [
      "150 Checkdits/month",
      "Everything in Free",
      "Bulk CSV upload",
      "Chrome extension",
      "Priority AI processing",
    ],
  },
  {
    tier: "AGENCY",
    name: "Agency",
    monthlyCredits: 500,
    priceId: process.env.STRIPE_AGENCY_PRICE_ID ?? "price_agency_placeholder",
    amount: 4999,  // £49.99/month
    currency: "gbp",
    features: [
      "500 Checkdits/month",
      "Everything in Pro",
      "Integration auto-sync",
      "Team collaboration",
      "Dedicated support",
      "API access",
    ],
  },
];

export function getPlanByTier(tier: string): SubscriptionPlan | null {
  return SUBSCRIPTION_PLANS.find((p) => p.tier === tier) ?? null;
}

export function getPlanByPriceId(priceId: string): SubscriptionPlan | null {
  return SUBSCRIPTION_PLANS.find((p) => p.priceId === priceId) ?? null;
}

// ─── Welcome credits for new signups ───

export const WELCOME_CREDITS = 10;
