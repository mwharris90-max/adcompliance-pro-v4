"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Zap } from "lucide-react";

type Balance = { used: number; limit: number | null; remaining: number | null; percentage: number | null; creditBalance: number };

export function CheckditBalance() {
  const [balance, setBalance] = useState<Balance | null>(null);

  async function fetchBalance() {
    try {
      const res = await fetch("/api/user/checkdits");
      if (!res.ok) return;
      const data = await res.json();
      setBalance(data);
    } catch { /* non-fatal */ }
  }

  useEffect(() => {
    fetchBalance();
    window.addEventListener("focus", fetchBalance);
    window.addEventListener("checkdit-used", fetchBalance);
    return () => {
      window.removeEventListener("focus", fetchBalance);
      window.removeEventListener("checkdit-used", fetchBalance);
    };
  }, []);

  if (!balance) return null;

  const credits = balance.creditBalance;
  const colour =
    credits <= 0 ? "text-red-500" :
    credits <= 10 ? "text-amber-500" :
    "text-violet-600";

  return (
    <Link
      href="/app/billing"
      className={`hidden md:flex items-center gap-1.5 text-sm font-medium ${colour} hover:opacity-80 transition-opacity`}
    >
      <Zap className="h-4 w-4" />
      <span>{credits.toLocaleString()} Checkdits</span>
    </Link>
  );
}
