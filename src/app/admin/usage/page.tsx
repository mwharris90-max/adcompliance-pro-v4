"use client";

import { useEffect, useState } from "react";
import { BarChart3, Users, Building2, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

type UserStat = { id: string; name: string; email: string; checksThisMonth: number };
type OrgStat = {
  id: string;
  name: string;
  monthlyLimit: number;
  checksThisMonth: number;
  userCount: number;
  users: UserStat[];
};
type UsageData = {
  totalThisMonth: number;
  totalAllTime: number;
  month: string;
  organisations: OrgStat[];
  unassigned: UserStat[];
};

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ElementType }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5 flex items-center gap-4">
      <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
        <Icon className="h-5 w-5 text-blue-600" />
      </div>
      <div>
        <p className="text-2xl font-semibold text-slate-900">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
}

export default function UsagePage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/usage")
      .then((r) => r.json())
      .then((json) => { if (json.success) setData(json.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (!data) return <p className="text-sm text-red-500">Failed to load usage data.</p>;

  const pct = (used: number, limit: number) => Math.min(Math.round((used / limit) * 100), 100);
  const limitColor = (used: number, limit: number) =>
    used >= limit ? "bg-red-500" : used >= limit * 0.8 ? "bg-amber-500" : "bg-blue-500";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Usage</h1>
        <p className="text-sm text-slate-500 mt-0.5">{data.month}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Checks this month" value={data.totalThisMonth} icon={BarChart3} />
        <StatCard label="Total checks (all time)" value={data.totalAllTime} icon={TrendingUp} />
        <StatCard label="Active organisations" value={data.organisations.length} icon={Building2} />
      </div>

      {/* Org breakdown */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-slate-800">By organisation</h2>
        {data.organisations.length === 0 && (
          <p className="text-sm text-slate-400">No organisations yet.</p>
        )}
        {data.organisations.map((org) => (
          <div key={org.id} className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-slate-900">{org.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{org.userCount} user{org.userCount !== 1 ? "s" : ""}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-medium text-slate-900">{org.checksThisMonth} / {org.monthlyLimit}</p>
                <p className="text-xs text-slate-400">checks this month</p>
              </div>
            </div>

            <div className="space-y-1">
              <Progress
                value={pct(org.checksThisMonth, org.monthlyLimit)}
                className="h-2"
              />
              <div className="flex justify-between text-xs text-slate-400">
                <span>{pct(org.checksThisMonth, org.monthlyLimit)}% used</span>
                {org.checksThisMonth >= org.monthlyLimit && (
                  <Badge className="bg-red-100 text-red-700 border-0 text-xs">Limit reached</Badge>
                )}
                {org.checksThisMonth >= org.monthlyLimit * 0.8 && org.checksThisMonth < org.monthlyLimit && (
                  <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">Near limit</Badge>
                )}
              </div>
            </div>

            {/* Per-user breakdown */}
            <div className="border-t border-slate-100 pt-3 space-y-1.5">
              {org.users.map((u) => (
                <div key={u.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-slate-300" />
                    <span className="text-slate-700">{u.name}</span>
                    <span className="text-slate-400 text-xs">{u.email}</span>
                  </div>
                  <span className="text-slate-500 font-medium">{u.checksThisMonth}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Unassigned users */}
      {data.unassigned.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-800">Unassigned users</h2>
          <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
            {data.unassigned.map((u) => (
              <div key={u.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <span className="text-slate-700 font-medium">{u.name}</span>
                  <span className="text-slate-400 ml-2 text-xs">{u.email}</span>
                </div>
                <span className="text-slate-500">{u.checksThisMonth} checks</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
