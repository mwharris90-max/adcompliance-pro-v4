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

  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/billing/checkout").then((r) => r.json()),
      fetch("/api/billing/balance").then((r) => r.json()),
      fetch("/api/billing/history").then((r) => r.json()),
    ]).then(([packData, balanceData, historyData]) => {
      setPacks(packData.packs ?? []);
      setBalance(balanceData.creditBalance ?? 0);
      setTransactions(historyData.transactions ?? []);
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
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setPurchasing(null);
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
        <h1 className="text-xl font-semibold text-slate-900">Billing</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Purchase Checkdit credits to run compliance checks.
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
      {cancelled && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <Clock className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-700">
            Payment was cancelled. No credits were charged.
          </p>
        </div>
      )}

      {/* Balance card */}
      <Card className="border-slate-200 shadow-sm border-l-[3px] border-l-violet-500">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100">
              <Zap className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Current Balance</p>
              <p className="text-2xl font-semibold text-slate-900 tabular-nums">
                {balance} <span className="text-base font-normal text-slate-400">Checkdits</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Credit packs */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">Buy Checkdits</h2>
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
                    Popular
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
                  className={cn(
                    "w-full",
                    pack.popular
                      ? "bg-[#1A56DB] hover:bg-[#1A56DB]/90"
                      : ""
                  )}
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
                const isCredit = tx.type === "PURCHASE" || tx.type === "GRANT";
                return (
                  <div
                    key={tx.id}
                    className="flex items-center gap-4 px-5 py-4"
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full shrink-0",
                        isCredit
                          ? "bg-green-100 text-green-600"
                          : "bg-red-100 text-red-600"
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
