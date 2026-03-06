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
    name: "Small Top-Up",
    credits: 50,
    priceId: "price_1T80Fc989wmDp0YIB8tt1kgM",
    amount: 3500,   // £35 (£0.70/credit)
    currency: "gbp",
    popular: false,
  },
  {
    name: "Medium Top-Up",
    credits: 200,
    priceId: "price_1T80Fd989wmDp0YIihGPN8zk",
    amount: 11900,  // £119 (£0.595/credit)
    currency: "gbp",
    popular: true,
  },
  {
    name: "Large Top-Up",
    credits: 500,
    priceId: "price_1T80Fd989wmDp0YI1PL5u4pO",
    amount: 24900,  // £249 (£0.498/credit)
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
    tier: "STARTER",
    name: "Starter",
    monthlyCredits: 150,
    priceId: process.env.STRIPE_STARTER_PRICE_ID ?? "price_starter_placeholder",
    amount: 7900,  // £79/month
    currency: "gbp",
    features: [
      "150 Checkdits/month",
      "Everything in Free",
      "Bulk CSV upload",
      "Chrome extension",
      "Results history & export",
    ],
  },
  {
    tier: "PRO",
    name: "Pro",
    monthlyCredits: 600,
    priceId: process.env.STRIPE_PRO_PRICE_ID ?? "price_pro_placeholder",
    amount: 24900,  // £249/month
    currency: "gbp",
    features: [
      "600 Checkdits/month",
      "Everything in Starter",
      "Integration auto-sync",
      "Priority AI processing",
      "Team collaboration",
      "API access",
    ],
  },
  {
    tier: "MAX",
    name: "Max",
    monthlyCredits: 2000,
    priceId: process.env.STRIPE_MAX_PRICE_ID ?? "price_max_placeholder",
    amount: 59900,  // £599/month
    currency: "gbp",
    features: [
      "2,000 Checkdits/month",
      "Everything in Pro",
      "Dedicated support",
      "Custom rule configuration",
      "Advanced reporting",
      "SLA guarantee",
    ],
  },
  {
    tier: "ENTERPRISE",
    name: "Enterprise",
    monthlyCredits: 0,
    priceId: null,
    amount: 0,
    currency: "gbp",
    features: [
      "Custom Checkdit volume",
      "Everything in Max",
      "White-label options",
      "Dedicated account manager",
      "Custom integrations",
      "On-premise deployment",
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
