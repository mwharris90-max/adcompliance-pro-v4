"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CreditCard,
  Zap,
  CheckCircle,
  Clock,
  ArrowDownCircle,
  ArrowUpCircle,
  Loader2,
  Star,
  Check,
  ExternalLink,
  Crown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CreditPack {
  name: string;
  credits: number;
  priceId: string;
  amount: number;
  currency: string;
  popular: boolean;
}

interface SubPlan {
  tier: string;
  name: string;
  monthlyCredits: number;
  amount: number;
  currency: string;
  features: string[];
  hasPrice: boolean;
}

interface SubscriptionInfo {
  tier: string;
  status: string;
  monthlyCreditsIncluded: number;
  monthlyCreditsUsed: number;
  currentPeriodEnd: string | null;
}

interface Transaction {
  id: string;
  type: string;
  credits: number;
  packName: string | null;
  amountPaid: number | null;
  currency: string;
  createdAt: string;
}

export default function BillingPage() {
  const searchParams = useSearchParams();
  const success = searchParams.get("success");
  const cancelled = searchParams.get("cancelled");
  const creditsAdded = searchParams.get("credits");
  const subscribed = searchParams.get("subscribed");
  const subscribedPlan = searchParams.get("plan");

  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [plans, setPlans] = useState<SubPlan[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [currentTier, setCurrentTier] = useState("FREE");
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/billing/checkout").then((r) => r.json()),
      fetch("/api/billing/balance").then((r) => r.json()),
      fetch("/api/billing/history").then((r) => r.json()),
      fetch("/api/billing/subscribe").then((r) => r.json()),
      fetch("/api/billing/subscription").then((r) => r.json()),
    ]).then(([packData, balanceData, historyData, planData, subData]) => {
      setPacks(packData.packs ?? []);
      setBalance(balanceData.creditBalance ?? 0);
      setTransactions(historyData.transactions ?? []);
      setPlans(planData.plans ?? []);
      setSubscription(subData.subscription ?? null);
      setCurrentTier(subData.tier ?? "FREE");
      setLoading(false);
    });
  }, []);

  async function handlePurchase(priceId: string) {
    setPurchasing(priceId);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      setPurchasing(null);
    }
  }

  async function handleSubscribe(tier: string) {
    setSubscribing(tier);
    try {
      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setSubscribing(null);
    } catch {
      setSubscribing(null);
    }
  }

  async function handleManageSubscription() {
    setOpeningPortal(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setOpeningPortal(false);
    } catch {
      setOpeningPortal(false);
    }
  }

  function formatAmount(amount: number, currency: string) {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-l-[3px] border-[#1A56DB] pl-3">
        <h1 className="text-xl font-semibold text-slate-900">Billing & Credits</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Manage your subscription and purchase Checkdit credits.
        </p>
      </div>

      {/* Success / cancel banners */}
      {success && (
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-800">Payment successful!</p>
            <p className="text-sm text-green-600">
              {creditsAdded} Checkdits have been added to your account.
            </p>
          </div>
        </div>
      )}
      {subscribed && (
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-800">Subscription activated!</p>
            <p className="text-sm text-green-600">
              You are now on the {subscribedPlan} plan. Monthly credits will be allocated automatically.
            </p>
          </div>
        </div>
      )}
      {cancelled && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <Clock className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-700">
            Payment was cancelled. No changes were made.
          </p>
        </div>
      )}

      {/* Balance + Subscription status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-slate-200 shadow-sm border-l-[3px] border-l-violet-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100">
                <Zap className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Credit Balance</p>
                <p className="text-2xl font-semibold text-slate-900 tabular-nums">
                  {balance} <span className="text-base font-normal text-slate-400">Checkdits</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm border-l-[3px] border-l-[#1A56DB]">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                  <Crown className="h-5 w-5 text-[#1A56DB]" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Current Plan</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {currentTier === "FREE" ? "Free" : currentTier === "PRO" ? "Pro" : "Agency"}
                    {subscription?.status === "active" && (
                      <Badge className="ml-2 bg-green-100 text-green-700 border-green-200 text-xs">Active</Badge>
                    )}
                  </p>
                  {subscription?.currentPeriodEnd && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  )}
                </div>
              </div>
              {subscription?.status === "active" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManageSubscription}
                  disabled={openingPortal}
                  className="shrink-0"
                >
                  {openingPortal ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                      Manage
                    </>
                  )}
                </Button>
              )}
            </div>
            {subscription && (
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#1A56DB] rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (subscription.monthlyCreditsUsed / subscription.monthlyCreditsIncluded) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-xs text-slate-500 tabular-nums shrink-0">
                  {subscription.monthlyCreditsUsed}/{subscription.monthlyCreditsIncluded} used
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Subscription plans */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">Subscription Plans</h2>
        <p className="text-sm text-slate-500">
          Monthly plans with recurring credit allocations. Credits refresh each billing cycle.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const isCurrent = plan.tier === currentTier;
            const isHigher = plans.findIndex((p) => p.tier === plan.tier) > plans.findIndex((p) => p.tier === currentTier);
            return (
              <Card
                key={plan.tier}
                className={cn(
                  "border-slate-200 shadow-sm relative overflow-hidden transition-all",
                  plan.tier === "PRO" && "border-[#1A56DB] ring-1 ring-[#1A56DB]/20",
                  isCurrent && "bg-slate-50"
                )}
              >
                {plan.tier === "PRO" && (
                  <div className="absolute top-0 right-0">
                    <Badge className="rounded-none rounded-bl-lg bg-[#1A56DB] text-white text-xs gap-1">
                      <Star className="h-3 w-3" />
                      Most Popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    {plan.name}
                    {isCurrent && (
                      <Badge variant="secondary" className="text-xs">Current</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-3xl font-semibold text-slate-900 tabular-nums">
                      {plan.amount === 0 ? "Free" : formatAmount(plan.amount, plan.currency)}
                    </p>
                    {plan.amount > 0 && (
                      <p className="text-sm text-slate-500 mt-0.5">per month</p>
                    )}
                    <p className="text-sm text-slate-500 mt-1">
                      {plan.monthlyCredits} Checkdits/month
                      {plan.amount > 0 && (
                        <span className="text-slate-400">
                          {" "}({formatAmount(Math.round(plan.amount / plan.monthlyCredits), plan.currency)}/each)
                        </span>
                      )}
                    </p>
                  </div>
                  <ul className="space-y-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                        <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : plan.tier === "FREE" ? (
                    <Button variant="outline" className="w-full" disabled>
                      Included
                    </Button>
                  ) : (
                    <Button
                      className={cn(
                        "w-full",
                        plan.tier === "PRO" ? "bg-[#1A56DB] hover:bg-[#1A56DB]/90" : ""
                      )}
                      variant={plan.tier === "PRO" ? "default" : "outline"}
                      disabled={subscribing !== null}
                      onClick={() => handleSubscribe(plan.tier)}
                    >
                      {subscribing === plan.tier ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      {subscribing === plan.tier
                        ? "Redirecting..."
                        : isHigher
                        ? "Upgrade"
                        : "Subscribe"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* One-off credit packs */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">Top-Up Packs</h2>
        <p className="text-sm text-slate-500">
          One-off credit packs. These add to your balance on top of any subscription allowance.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {packs.map((pack) => (
            <Card
              key={pack.priceId}
              className={cn(
                "border-slate-200 shadow-sm relative overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5",
                pack.popular && "border-[#1A56DB] ring-1 ring-[#1A56DB]/20"
              )}
            >
              {pack.popular && (
                <div className="absolute top-0 right-0">
                  <Badge className="rounded-none rounded-bl-lg bg-[#1A56DB] text-white text-xs gap-1">
                    <Star className="h-3 w-3" />
                    Best Value
                  </Badge>
                </div>
              )}
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{pack.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-3xl font-semibold text-slate-900 tabular-nums">
                    {formatAmount(pack.amount, pack.currency)}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    {pack.credits} Checkdits
                    <span className="text-slate-400">
                      {" "}({formatAmount(Math.round(pack.amount / pack.credits), pack.currency)}/each)
                    </span>
                  </p>
                </div>
                <Button
                  className={cn("w-full", pack.popular ? "bg-[#1A56DB] hover:bg-[#1A56DB]/90" : "")}
                  variant={pack.popular ? "default" : "outline"}
                  disabled={purchasing !== null}
                  onClick={() => handlePurchase(pack.priceId)}
                >
                  {purchasing === pack.priceId ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CreditCard className="h-4 w-4 mr-2" />
                  )}
                  {purchasing === pack.priceId ? "Redirecting..." : "Purchase"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Transaction history */}
      {transactions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Transaction History</h2>
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div className="divide-y divide-slate-100">
              {transactions.map((tx) => {
                const isCredit = tx.type === "PURCHASE" || tx.type === "GRANT" || tx.type === "SUBSCRIPTION" || tx.type === "WELCOME";
                return (
                  <div key={tx.id} className="flex items-center gap-4 px-5 py-4">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full shrink-0",
                        isCredit ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                      )}
                    >
                      {isCredit ? (
                        <ArrowDownCircle className="h-4 w-4" />
                      ) : (
                        <ArrowUpCircle className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        {tx.packName ?? tx.type}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(tx.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          isCredit ? "text-green-600" : "text-red-600"
                        )}
                      >
                        {isCredit ? "+" : "-"}{tx.credits} Checkdits
                      </p>
                      {tx.amountPaid != null && (
                        <p className="text-xs text-slate-400">
                          {formatAmount(tx.amountPaid, tx.currency)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
