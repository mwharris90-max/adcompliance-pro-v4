import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getMonthlyUsage } from "@/lib/usage";
import { format } from "date-fns";
import Link from "next/link";

function badgeStyle(status: string) {
  const base = "text-[9px] font-bold py-[2px] px-[7px] rounded-[3px] font-mono shrink-0 tracking-wide";
  if (status === "CLEAN") return `${base} bg-emerald-50 text-emerald-600 border border-emerald-200`;
  if (status === "WARNINGS") return `${base} bg-amber-50 text-amber-600 border border-amber-200`;
  if (status === "VIOLATIONS") return `${base} bg-red-50 text-red-600 border border-red-200`;
  return `${base} bg-slate-100 text-slate-500 border border-slate-200`;
}

function statusLabel(status: string) {
  if (status === "CLEAN") return "PASS";
  if (status === "WARNINGS") return "WARNING";
  if (status === "VIOLATIONS") return "VIOLATION";
  return status;
}

export default async function DashboardPage() {
  const session = await auth();

  const recentChecks = await db.complianceCheck.findMany({
    where: { userId: session!.user.id },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true, status: true, overallStatus: true,
      platformIds: true, countryIds: true, source: true, createdAt: true,
    },
  });

  const allPlatformIds = [...new Set(recentChecks.flatMap((c) => c.platformIds))];
  const platformRows = allPlatformIds.length
    ? await db.platform.findMany({ where: { id: { in: allPlatformIds } }, select: { id: true, name: true } })
    : [];
  const platformMap = new Map(platformRows.map((p) => [p.id, p.name]));

  const recentWithNames = recentChecks.map((c) => ({
    ...c,
    platformNames: c.platformIds.map((id) => platformMap.get(id) ?? id),
    effectiveStatus: c.overallStatus ?? c.status,
    effectiveSource: c.source ?? "WEB",
  }));

  const totalChecks = await db.complianceCheck.count({ where: { userId: session!.user.id } });
  const cleanChecks = await db.complianceCheck.count({ where: { userId: session!.user.id, overallStatus: "CLEAN" } });
  const passRate = totalChecks > 0 ? Math.round((cleanChecks / totalChecks) * 100) : 0;
  const issuesCaught = await db.complianceCheck.count({
    where: { userId: session!.user.id, overallStatus: { in: ["WARNINGS", "VIOLATIONS"] } },
  });
  const usage = await getMonthlyUsage(session!.user.id);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const [monthClean, monthWarnings, monthViolations] = await Promise.all([
    db.complianceCheck.count({ where: { userId: session!.user.id, createdAt: { gte: monthStart }, overallStatus: "CLEAN" } }),
    db.complianceCheck.count({ where: { userId: session!.user.id, createdAt: { gte: monthStart }, overallStatus: "WARNINGS" } }),
    db.complianceCheck.count({ where: { userId: session!.user.id, createdAt: { gte: monthStart }, overallStatus: "VIOLATIONS" } }),
  ]);
  const monthTotal = monthClean + monthWarnings + monthViolations;

  const usagePct = usage.limit ? Math.min(100, (usage.used / usage.limit) * 100) : 0;
  const usageColor = usage.limit && usage.used / usage.limit > 0.9 ? "#ef4444" : usage.limit && usage.used / usage.limit > 0.7 ? "#f59e0b" : "#0d9488";

  // Platform breakdown — aggregate checks by platform
  const allChecks = await db.complianceCheck.findMany({
    where: { userId: session!.user.id },
    select: { platformIds: true, overallStatus: true },
  });

  const platformStats = new Map<string, { total: number; clean: number; issues: number }>();
  for (const check of allChecks) {
    for (const pid of check.platformIds) {
      const stat = platformStats.get(pid) ?? { total: 0, clean: 0, issues: 0 };
      stat.total++;
      if (check.overallStatus === "CLEAN") stat.clean++;
      else stat.issues++;
      platformStats.set(pid, stat);
    }
  }

  const platformBreakdownIds = [...platformStats.keys()];
  const breakdownPlatforms = platformBreakdownIds.length
    ? await db.platform.findMany({ where: { id: { in: platformBreakdownIds } }, select: { id: true, name: true } })
    : [];
  const breakdownNameMap = new Map(breakdownPlatforms.map((p) => [p.id, p.name]));

  const platformBreakdown = [...platformStats.entries()]
    .map(([id, stat]) => ({ name: breakdownNameMap.get(id) ?? id, ...stat }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const featuredArticles = await db.policyArticle.findMany({
    where: { published: true, featured: true },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    take: 6,
    select: {
      id: true, title: true, slug: true, summary: true, tags: true,
      platform: { select: { name: true } },
      category: { select: { name: true } },
    },
  });

  return (
    <div className="min-h-full">
      {/* Topbar */}
      <div className="flex items-center justify-between gap-6 border-b border-slate-200 bg-white px-7 py-4">
        <div className="min-w-0">
          <h1 className="text-[15px] font-bold text-slate-900 truncate">
            Welcome back, {session?.user.name?.split(" ")[0]}
          </h1>
          <p className="text-[11px] text-slate-400 mt-px truncate">
            Check your advertising campaigns for compliance across platforms and jurisdictions
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/app/brief"
            className="px-3.5 py-[7px] rounded-[7px] text-xs font-semibold text-slate-600 border border-slate-300 bg-white hover:bg-slate-50 transition-colors"
          >
            Generate Brief
          </Link>
          <Link
            href="/app/check"
            className="px-3.5 py-[7px] rounded-[7px] text-xs font-semibold text-white bg-[#0d9488] hover:bg-[#0f766e] transition-colors"
          >
            + New Check
          </Link>
        </div>
      </div>

      {/* Body */}
      <div className="p-7">
        {/* Metric cards */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {/* Total Checks */}
          <div className="bg-white border border-slate-200 rounded-xl p-[18px] shadow-sm">
            <div className="text-[10px] font-mono tracking-[0.1em] uppercase text-slate-400 mb-2">Total Checks</div>
            <div className="text-[32px] font-extrabold text-slate-900 leading-none mb-1">{totalChecks}</div>
            <div className="text-xs text-slate-400">All time</div>
          </div>

          {/* Checkdits */}
          <div className="bg-teal-50/60 border border-teal-200 rounded-xl p-[18px] shadow-sm">
            <div className="text-[10px] font-mono tracking-[0.1em] uppercase text-teal-600/70 mb-2">Checkdits This Month</div>
            <div className="text-[32px] font-extrabold text-teal-700 leading-none mb-1">{usage.used}</div>
            <div className="text-xs text-teal-600/60">
              {usage.limit !== null ? `of ${usage.limit} plan limit` : "Unlimited"}
            </div>
            {usage.limit !== null && (
              <div className="mt-3 h-[3px] bg-teal-100 rounded-sm overflow-hidden">
                <div className="h-full rounded-sm transition-all" style={{ width: `${usagePct}%`, background: usageColor }} />
              </div>
            )}
          </div>

          {/* Issues Caught */}
          <div className="bg-white border border-slate-200 rounded-xl p-[18px] shadow-sm">
            <div className="text-[10px] font-mono tracking-[0.1em] uppercase text-slate-400 mb-2">Issues Caught</div>
            <div className="text-[32px] font-extrabold text-red-500 leading-none mb-1">{issuesCaught}</div>
            <div className="text-xs text-slate-400">Before campaigns went live</div>
          </div>

          {/* Pass Rate */}
          <div className="bg-white border border-slate-200 rounded-xl p-[18px] shadow-sm">
            <div className="text-[10px] font-mono tracking-[0.1em] uppercase text-slate-400 mb-2">Pass Rate</div>
            <div className="text-[32px] font-extrabold text-emerald-500 leading-none mb-1">{passRate}%</div>
            <div className="text-xs text-slate-400">{passRate >= 80 ? "Looking good" : "Room to improve"}</div>
          </div>
        </div>

        {/* Lower panels */}
        <div className="grid grid-cols-2 gap-3.5">
          {/* Recent Checks */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-[18px] py-3.5 border-b border-slate-100">
              <span className="text-[13px] font-bold text-slate-900">Recent Checks</span>
              <Link href="/app/checks" className="text-[11px] text-teal-600 no-underline hover:text-teal-700">
                View all &rarr;
              </Link>
            </div>
            <div className="py-1">
              {recentWithNames.length === 0 ? (
                <div className="py-6 px-[18px] text-center text-xs text-slate-400">
                  No checks yet. Run your first compliance check to see results here.
                </div>
              ) : (
                recentWithNames.map((check) => (
                  <Link
                    key={check.id}
                    href={`/app/check/results/${check.id}`}
                    className="flex items-center gap-2.5 px-[18px] py-2.5 border-b border-slate-50 last:border-b-0 no-underline hover:bg-slate-50/60 transition-colors"
                  >
                    <span className={badgeStyle(check.effectiveStatus)}>
                      {statusLabel(check.effectiveStatus)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-slate-700 truncate">
                        {check.platformNames.join(" + ")}
                        {check.countryIds.length > 0 && (
                          <> &middot; {check.countryIds.length} {check.countryIds.length === 1 ? "country" : "countries"}</>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">{check.effectiveSource}</div>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0">
                      {format(new Date(check.createdAt), "d MMM, HH:mm")}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Monthly Chart */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-[18px] py-3.5 border-b border-slate-100">
              <span className="text-[13px] font-bold text-slate-900">Monthly checks</span>
              <span className="text-[10px] font-mono text-slate-400">{format(new Date(), "MMMM yyyy")}</span>
            </div>

            {monthTotal > 0 ? (
              <>
                <div className="px-[18px] py-3 pb-4">
                  <div className="flex items-end gap-[3px] h-14">
                    {monthClean > 0 && (
                      <div
                        className="rounded-t-sm"
                        style={{ flex: monthClean, height: "100%", background: "#d1fae5", border: "1px solid #a7f3d0" }}
                      />
                    )}
                    {monthWarnings > 0 && (
                      <div
                        className="rounded-t-sm"
                        style={{ flex: monthWarnings, height: "100%", background: "#fef3c7", border: "1px solid #fde68a" }}
                      />
                    )}
                    {monthViolations > 0 && (
                      <div
                        className="rounded-t-sm"
                        style={{ flex: monthViolations, height: "100%", background: "#fee2e2", border: "1px solid #fecaca" }}
                      />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 px-4 pb-4 text-center">
                  <div className="p-2 bg-red-50 rounded-md">
                    <div className="text-base font-extrabold text-red-500 mb-0.5">{monthViolations}</div>
                    <div className="text-[10px] text-slate-500">Violations</div>
                  </div>
                  <div className="p-2 bg-amber-50 rounded-md">
                    <div className="text-base font-extrabold text-amber-500 mb-0.5">{monthWarnings}</div>
                    <div className="text-[10px] text-slate-500">Warnings</div>
                  </div>
                  <div className="p-2 bg-emerald-50 rounded-md">
                    <div className="text-base font-extrabold text-emerald-500 mb-0.5">{monthClean}</div>
                    <div className="text-[10px] text-slate-500">Clean</div>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-8 px-[18px] text-center text-xs text-slate-400">
                No checks this month yet.
              </div>
            )}
          </div>
        </div>

        {/* Platform Breakdown + Quick Actions */}
        <div className="grid grid-cols-2 gap-3.5 mt-3.5">
          {/* Platform Breakdown */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-[18px] py-3.5 border-b border-slate-100">
              <span className="text-[13px] font-bold text-slate-900">Platform Breakdown</span>
              <span className="text-[10px] font-mono text-slate-400">All time</span>
            </div>
            <div className="p-4">
              {platformBreakdown.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400">
                  Run checks to see your platform breakdown.
                </div>
              ) : (
                <div className="space-y-3">
                  {platformBreakdown.map((p) => {
                    const cleanPct = p.total > 0 ? Math.round((p.clean / p.total) * 100) : 0;
                    return (
                      <div key={p.name}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-slate-700">{p.name}</span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {p.total} check{p.total !== 1 ? "s" : ""} &middot; {cleanPct}% clean
                          </span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
                          {p.clean > 0 && (
                            <div
                              className="h-full bg-emerald-400"
                              style={{ width: `${(p.clean / p.total) * 100}%` }}
                            />
                          )}
                          {p.issues > 0 && (
                            <div
                              className="h-full bg-red-300"
                              style={{ width: `${(p.issues / p.total) * 100}%` }}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-[18px] py-3.5 border-b border-slate-100">
              <span className="text-[13px] font-bold text-slate-900">Quick Actions</span>
            </div>
            <div className="p-4 grid grid-cols-2 gap-2.5">
              <Link
                href="/app/check"
                className="flex items-center gap-2.5 p-3 rounded-lg bg-teal-50 border border-teal-200 no-underline hover:bg-teal-100 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
                </div>
                <div>
                  <div className="text-xs font-semibold text-teal-800">New Check</div>
                  <div className="text-[10px] text-teal-600/70">Run a compliance check</div>
                </div>
              </Link>
              <Link
                href="/app/bulk-jobs"
                className="flex items-center gap-2.5 p-3 rounded-lg bg-violet-50 border border-violet-200 no-underline hover:bg-violet-100 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-violet-500 flex items-center justify-center shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>
                </div>
                <div>
                  <div className="text-xs font-semibold text-violet-800">Bulk Upload</div>
                  <div className="text-[10px] text-violet-600/70">Check a CSV batch</div>
                </div>
              </Link>
              <Link
                href="/app/brief"
                className="flex items-center gap-2.5 p-3 rounded-lg bg-sky-50 border border-sky-200 no-underline hover:bg-sky-100 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <div>
                  <div className="text-xs font-semibold text-sky-800">Generate Brief</div>
                  <div className="text-[10px] text-sky-600/70">Compliance guidance PDF</div>
                </div>
              </Link>
              <Link
                href="/app/learn"
                className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-50 border border-emerald-200 no-underline hover:bg-emerald-100 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>
                </div>
                <div>
                  <div className="text-xs font-semibold text-emerald-800">Policy Library</div>
                  <div className="text-[10px] text-emerald-600/70">Learn the rules</div>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Featured Learning Resources */}
        {featuredArticles.length > 0 && (
          <div className="mt-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13px] font-bold text-slate-900">Featured Learning Resources</span>
              <Link href="/app/learn" className="text-[11px] text-teal-600 no-underline hover:text-teal-700">
                View all &rarr;
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {featuredArticles.map((article) => (
                <Link
                  key={article.id}
                  href={`/app/learn/${article.slug}`}
                  className="block bg-white border border-slate-200 rounded-xl p-4 no-underline shadow-sm hover:border-teal-300 hover:shadow-md transition-all"
                >
                  <h3 className="text-xs font-bold text-slate-900 mb-1.5 line-clamp-2">{article.title}</h3>
                  <p className="text-[11px] text-slate-500 leading-relaxed mb-3 line-clamp-2">{article.summary}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {article.platform && (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-teal-50 text-teal-600 border border-teal-200">
                        {article.platform.name}
                      </span>
                    )}
                    {article.category && (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200">
                        {article.category.name}
                      </span>
                    )}
                    {article.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                        {tag}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
