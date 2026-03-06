import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getMonthlyUsage } from "@/lib/usage";
import { format } from "date-fns";
import Link from "next/link";
import {
  ClipboardCheck,
  ShieldCheck,
  Globe,
  AlertTriangle,
  XCircle,
  Monitor,
  ArrowRight,
  TrendingUp,
  FileSpreadsheet,
  Zap,
  FileText,
  BookOpen,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function StatusBadge({ status }: { status: string }) {
  if (status === "CLEAN") {
    return (
      <Badge className="bg-green-100 text-green-700 border-green-200 gap-1 hover:bg-green-100 shrink-0">
        <ShieldCheck className="h-3 w-3" />
        Clean
      </Badge>
    );
  }
  if (status === "WARNINGS") {
    return (
      <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1 hover:bg-amber-100 shrink-0">
        <AlertTriangle className="h-3 w-3" />
        Warnings
      </Badge>
    );
  }
  if (status === "VIOLATIONS") {
    return (
      <Badge className="bg-red-100 text-red-700 border-red-200 gap-1 hover:bg-red-100 shrink-0">
        <XCircle className="h-3 w-3" />
        Violations
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="shrink-0 text-slate-500">
      {status}
    </Badge>
  );
}

export default async function DashboardPage() {
  const session = await auth();

  // Fetch recent checks
  const recentChecks = await db.complianceCheck.findMany({
    where: { userId: session!.user.id },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      status: true,
      overallStatus: true,
      platformIds: true,
      countryIds: true,
      source: true,
      createdAt: true,
    },
  });

  // Resolve platform names
  const allPlatformIds = [
    ...new Set(recentChecks.flatMap((c) => c.platformIds)),
  ];
  const platformRows = allPlatformIds.length
    ? await db.platform.findMany({
        where: { id: { in: allPlatformIds } },
        select: { id: true, name: true },
      })
    : [];
  const platformMap = new Map(platformRows.map((p) => [p.id, p.name]));

  const recentWithNames = recentChecks.map((c) => ({
    ...c,
    platformNames: c.platformIds.map((id) => platformMap.get(id) ?? id),
    effectiveStatus: c.overallStatus ?? c.status,
    effectiveSource: c.source ?? "WEB",
  }));

  // Stats
  const totalChecks = await db.complianceCheck.count({
    where: { userId: session!.user.id },
  });
  const cleanChecks = await db.complianceCheck.count({
    where: { userId: session!.user.id, overallStatus: "CLEAN" },
  });
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const issuesToday = await db.complianceCheck.count({
    where: {
      userId: session!.user.id,
      createdAt: { gte: todayStart },
      overallStatus: { in: ["WARNINGS", "VIOLATIONS"] },
    },
  });
  const passRate =
    totalChecks > 0 ? Math.round((cleanChecks / totalChecks) * 100) : 0;

  // Usage / Checkdits
  const usage = await getMonthlyUsage(session!.user.id);

  // Recent bulk jobs
  const recentBulkJobs = await db.bulkCheckJob.findMany({
    where: { userId: session!.user.id },
    orderBy: { submittedAt: "desc" },
    take: 3,
    select: {
      id: true,
      filename: true,
      rowCount: true,
      uniqueRowCount: true,
      status: true,
      submittedAt: true,
    },
  });

  // This month's breakdown
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const [monthClean, monthWarnings, monthViolations] = await Promise.all([
    db.complianceCheck.count({ where: { userId: session!.user.id, createdAt: { gte: monthStart }, overallStatus: "CLEAN" } }),
    db.complianceCheck.count({ where: { userId: session!.user.id, createdAt: { gte: monthStart }, overallStatus: "WARNINGS" } }),
    db.complianceCheck.count({ where: { userId: session!.user.id, createdAt: { gte: monthStart }, overallStatus: "VIOLATIONS" } }),
  ]);

  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <div className="border-l-[3px] border-[#1A56DB] pl-3">
        <h1 className="text-xl font-semibold text-slate-900">
          Welcome back, {session?.user.name?.split(" ")[0]}
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          Check your advertising campaigns for compliance across platforms and
          jurisdictions.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-sm border-l-[3px] border-l-[#1A56DB]">
          <CardContent className="pt-5 pb-5">
            <p className="text-3xl font-semibold text-slate-900 tabular-nums">
              {totalChecks}
            </p>
            <p className="text-sm text-slate-500 mt-1">Total Checks</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm border-l-[3px] border-l-green-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-end gap-2">
              <p className="text-3xl font-semibold text-slate-900 tabular-nums">
                {passRate}%
              </p>
              <TrendingUp className="h-4 w-4 text-green-500 mb-1.5" />
            </div>
            <p className="text-sm text-slate-500 mt-1">Pass Rate</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm border-l-[3px] border-l-amber-500">
          <CardContent className="pt-5 pb-5">
            <p
              className={cn(
                "text-3xl font-semibold tabular-nums",
                issuesToday > 0 ? "text-amber-600" : "text-slate-900"
              )}
            >
              {issuesToday}
            </p>
            <p className="text-sm text-slate-500 mt-1">Issues Today</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm border-l-[3px] border-l-violet-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-end gap-2">
              <p className="text-3xl font-semibold text-slate-900 tabular-nums">
                {usage.used}
              </p>
              {usage.limit !== null && (
                <span className="text-sm text-slate-400 mb-0.5">/ {usage.limit}</span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-1">
              <Zap className="inline h-3.5 w-3.5 text-violet-500 -mt-0.5 mr-0.5" />
              Checkdits This Month
            </p>
            {usage.limit !== null && (
              <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    usage.used / usage.limit > 0.9 ? "bg-red-500" : usage.used / usage.limit > 0.7 ? "bg-amber-500" : "bg-violet-500"
                  )}
                  style={{ width: `${Math.min(100, (usage.used / usage.limit) * 100)}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly breakdown */}
      {(monthClean + monthWarnings + monthViolations) > 0 && (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="pt-5 pb-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">This Month</p>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                <span className="text-sm text-slate-600"><span className="font-semibold text-slate-900">{monthClean}</span> Clean</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                <span className="text-sm text-slate-600"><span className="font-semibold text-slate-900">{monthWarnings}</span> Warnings</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                <span className="text-sm text-slate-600"><span className="font-semibold text-slate-900">{monthViolations}</span> Violations</span>
              </div>
            </div>
            {/* Visual bar */}
            {(() => {
              const total = monthClean + monthWarnings + monthViolations;
              return (
                <div className="mt-3 flex h-2 rounded-full overflow-hidden bg-slate-100">
                  {monthClean > 0 && <div className="bg-green-500" style={{ width: `${(monthClean / total) * 100}%` }} />}
                  {monthWarnings > 0 && <div className="bg-amber-500" style={{ width: `${(monthWarnings / total) * 100}%` }} />}
                  {monthViolations > 0 && <div className="bg-red-500" style={{ width: `${(monthViolations / total) * 100}%` }} />}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Quick start — brand gradient */}
      <Card
        className="border-0 text-white overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #1A56DB, #E4168A)",
        }}
      >
        <CardContent className="pt-6 pb-6 relative">
          {/* Faint watermark shield */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-[0.05] pointer-events-none select-none">
            <ShieldCheck className="h-32 w-32 text-white" />
          </div>
          <div className="flex items-start justify-between gap-4 relative">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="h-5 w-5 text-white/70" />
                <span className="text-white/70 text-sm font-medium">
                  Quick Start
                </span>
              </div>
              <h2 className="text-xl font-semibold mb-1">
                Run a compliance check
              </h2>
              <p className="text-white/80 text-sm max-w-md">
                Select your advertising channels, paste your ad content, choose
                your target countries, and let AI flag any compliance issues
                before you publish.
              </p>
            </div>
            <Link href="/app/check">
              <Button className="bg-white text-[#1A56DB] hover:bg-white/90 shrink-0 font-semibold">
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Start Check
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Recent checks */}
      {recentWithNames.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              Recent Checks
              {totalChecks > 5 && (
                <span className="ml-2 text-sm font-normal text-slate-400">
                  ({totalChecks} total)
                </span>
              )}
            </h2>
            <Link
              href="/app/checks"
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div className="divide-y divide-slate-100">
              {recentWithNames.map((check) => {
                const statusColor =
                  check.effectiveStatus === "CLEAN"
                    ? "border-l-green-500"
                    : check.effectiveStatus === "WARNINGS"
                    ? "border-l-amber-500"
                    : check.effectiveStatus === "VIOLATIONS"
                    ? "border-l-red-500"
                    : "border-l-slate-200";
                return (
                  <Link
                    key={check.id}
                    href={`/app/check/results/${check.id}`}
                    className={cn(
                      "flex items-center gap-4 pl-4 pr-5 py-4 hover:bg-slate-50 transition-colors border-l-[3px]",
                      statusColor,
                      check.effectiveStatus === "ERROR" && "opacity-60"
                    )}
                  >
                    <StatusBadge status={check.effectiveStatus} />

                    {/* Platforms */}
                    <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                      <Monitor className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      {check.platformNames.slice(0, 2).map((name, i) => (
                        <span
                          key={i}
                          className="text-xs bg-slate-100 text-slate-600 rounded px-1.5 py-0.5"
                        >
                          {name}
                        </span>
                      ))}
                      {check.platformNames.length > 2 && (
                        <span className="text-xs text-slate-400">
                          +{check.platformNames.length - 2}
                        </span>
                      )}
                    </div>

                    {/* Source + Countries + date */}
                    <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 shrink-0">
                      <span className="bg-slate-100 text-slate-500 rounded px-1.5 py-0.5 text-[10px] uppercase font-medium tracking-wide">
                        {check.effectiveSource}
                      </span>
                      <span className="mx-0.5 text-slate-200">·</span>
                      <Globe className="h-3.5 w-3.5" />
                      <span>{check.countryIds.length}</span>
                      <span className="mx-0.5 text-slate-200">·</span>
                      <span>
                        {format(new Date(check.createdAt), "d MMM, HH:mm")}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Recent bulk jobs */}
      {recentBulkJobs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              Recent Bulk Jobs
            </h2>
            <Link
              href="/app/bulk-jobs"
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div className="divide-y divide-slate-100">
              {recentBulkJobs.map((job) => {
                const isComplete = job.status === "COMPLETE";
                const isProcessing = job.status === "PROCESSING" || job.status === "PENDING";
                return (
                  <Link
                    key={job.id}
                    href={`/app/bulk-jobs/${job.id}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors"
                  >
                    <FileSpreadsheet className={cn("h-5 w-5 shrink-0", isComplete ? "text-green-500" : isProcessing ? "text-blue-500" : "text-slate-400")} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{job.filename}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {job.uniqueRowCount}/{job.rowCount} unique rows
                        {isProcessing && " — processing..."}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">
                      {format(new Date(job.submittedAt), "d MMM, HH:mm")}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Feature cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/app/brief" className="group">
          <Card className="border-slate-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#1A56DB] to-[#1A56DB]/70">
                  <FileText className="h-4 w-4 text-white" />
                </div>
                <CardTitle className="text-base">Compliance Brief</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-slate-500">
              Generate a pre-check brief of all applicable rules, restrictions,
              and technical specs for your ad campaign.
            </CardContent>
          </Card>
        </Link>

        <Link href="/app/learn" className="group">
          <Card className="border-slate-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-emerald-400">
                  <BookOpen className="h-4 w-4 text-white" />
                </div>
                <CardTitle className="text-base">Policy Library</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-slate-500">
              Learn about advertising policies with explanations, real-world
              examples, and video guides for each platform and category.
            </CardContent>
          </Card>
        </Link>

        <Link href="/app/check" className="group">
          <Card className="border-slate-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-400">
                  <ClipboardCheck className="h-4 w-4 text-white" />
                </div>
                <CardTitle className="text-base">Run a Check</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-slate-500">
              Check your ad copy and assets against platform rules, geographic
              regulations, and technical requirements.
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
