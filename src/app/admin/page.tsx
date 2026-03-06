import Link from "next/link";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import {
  Tag,
  Globe,
  MonitorPlay,
  ShieldCheck,
  MapPin,
  GitPullRequest,
  Radar,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

async function getStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [checksToday, pendingChanges, approvedCountries, lastScan, recentActivity] =
    await Promise.all([
      db.complianceCheck.count({ where: { createdAt: { gte: today } } }),
      db.proposedChange.count({ where: { status: "PENDING" } }),
      db.country.count({ where: { approved: true } }),
      db.scanSource.findFirst({
        where: { lastScannedAt: { not: null } },
        orderBy: { lastScannedAt: "desc" },
        select: { lastScannedAt: true },
      }),
      db.proposedChange.findMany({
        where: { status: { in: ["CONFIRMED", "REJECTED"] } },
        orderBy: { reviewedAt: "desc" },
        take: 10,
        select: {
          id: true,
          changeType: true,
          ruleType: true,
          status: true,
          reviewedAt: true,
          aiSummary: true,
          reviewedBy: { select: { name: true } },
        },
      }),
    ]);

  return { checksToday, pendingChanges, approvedCountries, lastScan, recentActivity };
}

export default async function AdminDashboard() {
  const session = await auth();
  const { checksToday, pendingChanges, approvedCountries, lastScan, recentActivity } =
    await getStats();

  const stats = [
    { label: "Checks Today", value: checksToday, icon: ShieldCheck, color: "text-blue-600" },
    { label: "Pending Changes", value: pendingChanges, icon: GitPullRequest, color: pendingChanges > 0 ? "text-amber-600" : "text-slate-600" },
    { label: "Approved Countries", value: approvedCountries, icon: Globe, color: "text-green-600" },
    {
      label: "Last Scan",
      value: lastScan?.lastScannedAt
        ? new Date(lastScan.lastScannedAt).toLocaleDateString()
        : "Never",
      icon: Radar,
      color: "text-slate-600",
    },
  ];

  const quickActions = [
    { href: "/admin/platform-rules", label: "Manage Platform Rules", icon: ShieldCheck },
    { href: "/admin/geo-rules", label: "Manage Geo Rules", icon: MapPin },
    { href: "/admin/categories", label: "Manage Categories", icon: Tag },
    { href: "/admin/countries", label: "Manage Countries", icon: Globe },
    { href: "/admin/channel-requirements", label: "Channel Requirements", icon: MonitorPlay },
    { href: "/admin/users", label: "Manage Users", icon: Users },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome back, {session?.user.name?.split(" ")[0]}
        </h1>
        <p className="text-slate-500 mt-1">Here&apos;s what&apos;s happening in AdCompliance Pro.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-slate-200">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">{stat.label}</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
                </div>
                <stat.icon className={`h-8 w-8 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-base font-semibold text-slate-900 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-3 gap-3">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href}>
              <Button variant="outline" className="w-full justify-start gap-2 h-auto py-3">
                <action.icon className="h-4 w-4 text-slate-500" />
                <span className="text-sm">{action.label}</span>
              </Button>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      {recentActivity.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-slate-900 mb-3">Recent Activity</h2>
          <Card className="border-slate-200">
            <CardContent className="pt-4 divide-y divide-slate-100">
              {recentActivity.map((item) => (
                <div key={item.id} className="flex items-start gap-3 py-3">
                  {item.status === "CONFIRMED" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 line-clamp-2">{item.aiSummary}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {item.changeType.replace("_", " ")} · {item.ruleType.replace("_", " ")} ·{" "}
                      {item.reviewedBy?.name ?? "Unknown"} ·{" "}
                      {item.reviewedAt ? new Date(item.reviewedAt).toLocaleDateString() : ""}
                    </p>
                  </div>
                  <Badge
                    variant={item.status === "CONFIRMED" ? "default" : "destructive"}
                    className="text-xs flex-shrink-0"
                  >
                    {item.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
