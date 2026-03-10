import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getMonthlyUsage } from "@/lib/usage";
import { format } from "date-fns";
import Link from "next/link";

function badgeStyle(status: string) {
  const base = "text-[9px] font-bold py-[2px] px-[7px] rounded-[3px] font-mono shrink-0 tracking-wide";
  if (status === "CLEAN") return `${base} bg-[rgba(74,222,128,0.08)] text-[#4ade80] border border-[rgba(74,222,128,0.18)]`;
  if (status === "WARNINGS") return `${base} bg-[rgba(45,212,191,0.1)] text-[#2dd4bf] border border-[rgba(45,212,191,0.18)]`;
  if (status === "VIOLATIONS") return `${base} bg-[rgba(248,113,113,0.12)] text-[#f87171] border border-[rgba(248,113,113,0.2)]`;
  return `${base} bg-[rgba(125,147,178,0.1)] text-[#7d93b2] border border-[rgba(125,147,178,0.18)]`;
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
  const usageColor = usage.limit && usage.used / usage.limit > 0.9 ? "#f87171" : usage.limit && usage.used / usage.limit > 0.7 ? "#f59e0b" : "#2dd4bf";

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
      {/* ── Topbar ── */}
      <div className="flex items-center justify-between gap-6 border-b border-[#1d2a3a] bg-[#0f1520] px-7 py-4">
        <div className="min-w-0">
          <h1 className="text-[15px] font-bold text-white truncate">
            Welcome back, {session?.user.name?.split(" ")[0]}
          </h1>
          <p className="text-[11px] text-[#3a4d66] mt-px truncate">
            Check your advertising campaigns for compliance across platforms and jurisdictions
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/app/brief"
            className="px-3.5 py-[7px] rounded-[7px] text-xs font-semibold text-[#7d93b2] border border-[#243348] bg-transparent hover:opacity-80"
          >
            Generate Brief
          </Link>
          <Link
            href="/app/check"
            className="px-3.5 py-[7px] rounded-[7px] text-xs font-semibold text-[#021c1a] bg-[#2dd4bf] hover:opacity-85"
          >
            + New Check
          </Link>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="p-7">
        {/* Metric cards */}
        <div className="grid grid-cols-4 gap-2.5 mb-5">
          {/* Total Checks */}
          <div className="bg-[#131b28] border border-[#1d2a3a] rounded-[10px] p-[18px]">
            <div className="text-[10px] font-mono tracking-[0.1em] uppercase text-[#3a4d66] mb-2">Total Checks</div>
            <div className="text-[32px] font-extrabold text-white leading-none mb-1">{totalChecks}</div>
            <div className="text-xs text-[#3a4d66]">All time</div>
          </div>

          {/* Checkdits */}
          <div className="bg-[rgba(45,212,191,0.04)] border border-[rgba(45,212,191,0.2)] rounded-[10px] p-[18px]">
            <div className="text-[10px] font-mono tracking-[0.1em] uppercase text-[#3a4d66] mb-2">Checkdits This Month</div>
            <div className="text-[32px] font-extrabold text-[#2dd4bf] leading-none mb-1">{usage.used}</div>
            <div className="text-xs text-[#3a4d66]">
              {usage.limit !== null ? `of ${usage.limit} plan limit` : "Unlimited"}
            </div>
            {usage.limit !== null && (
              <div className="mt-3 h-[3px] bg-[#18222f] rounded-sm overflow-hidden">
                <div className="h-full rounded-sm" style={{ width: `${usagePct}%`, background: usageColor }} />
              </div>
            )}
          </div>

          {/* Issues Caught */}
          <div className="bg-[#131b28] border border-[#1d2a3a] rounded-[10px] p-[18px]">
            <div className="text-[10px] font-mono tracking-[0.1em] uppercase text-[#3a4d66] mb-2">Issues Caught</div>
            <div className="text-[32px] font-extrabold text-[#f87171] leading-none mb-1">{issuesCaught}</div>
            <div className="text-xs text-[#3a4d66]">Before campaigns went live</div>
          </div>

          {/* Pass Rate */}
          <div className="bg-[#131b28] border border-[#1d2a3a] rounded-[10px] p-[18px]">
            <div className="text-[10px] font-mono tracking-[0.1em] uppercase text-[#3a4d66] mb-2">Pass Rate</div>
            <div className="text-[32px] font-extrabold text-[#4ade80] leading-none mb-1">{passRate}%</div>
            <div className="text-xs text-[#3a4d66]">{passRate >= 80 ? "Looking good" : "Room to improve"}</div>
          </div>
        </div>

        {/* ── Lower panels ── */}
        <div className="grid grid-cols-2 gap-3.5">
          {/* Recent Checks */}
          <div className="bg-[#131b28] border border-[#1d2a3a] rounded-[10px] overflow-hidden">
            <div className="flex items-center justify-between px-[18px] py-3.5 border-b border-[#1d2a3a]">
              <span className="text-[13px] font-bold text-white">Recent Checks</span>
              <Link href="/app/checks" className="text-[11px] text-[#2dd4bf] no-underline hover:opacity-80">
                View all &rarr;
              </Link>
            </div>
            <div className="py-1">
              {recentWithNames.length === 0 ? (
                <div className="py-6 px-[18px] text-center text-xs text-[#3a4d66]">
                  No checks yet. Run your first compliance check to see results here.
                </div>
              ) : (
                recentWithNames.map((check) => (
                  <Link
                    key={check.id}
                    href={`/app/check/results/${check.id}`}
                    className="flex items-center gap-2.5 px-[18px] py-2.5 border-b border-[rgba(29,42,58,0.5)] last:border-b-0 no-underline hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                  >
                    <span className={badgeStyle(check.effectiveStatus)}>
                      {statusLabel(check.effectiveStatus)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-[#dde5f0] truncate">
                        {check.platformNames.join(" + ")}
                        {check.countryIds.length > 0 && (
                          <> &middot; {check.countryIds.length} {check.countryIds.length === 1 ? "country" : "countries"}</>
                        )}
                      </div>
                      <div className="text-[10px] text-[#3a4d66] font-mono">{check.effectiveSource}</div>
                    </div>
                    <span className="text-[10px] text-[#3a4d66] font-mono shrink-0">
                      {format(new Date(check.createdAt), "d MMM, HH:mm")}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Monthly Chart */}
          <div className="bg-[#131b28] border border-[#1d2a3a] rounded-[10px] overflow-hidden">
            <div className="flex items-center justify-between px-[18px] py-3.5 border-b border-[#1d2a3a]">
              <span className="text-[13px] font-bold text-white">Monthly checks</span>
              <span className="text-[10px] font-mono text-[#3a4d66]">{format(new Date(), "MMMM yyyy")}</span>
            </div>

            {monthTotal > 0 ? (
              <>
                {/* Bar chart */}
                <div className="px-[18px] py-3 pb-4">
                  <div className="flex items-end gap-[3px] h-14">
                    {monthClean > 0 && (
                      <div
                        className="rounded-t-sm"
                        style={{ flex: monthClean, height: "100%", background: "rgba(74,222,128,0.25)", border: "1px solid rgba(74,222,128,0.2)" }}
                      />
                    )}
                    {monthWarnings > 0 && (
                      <div
                        className="rounded-t-sm"
                        style={{ flex: monthWarnings, height: "100%", background: "rgba(45,212,191,0.25)", border: "1px solid rgba(45,212,191,0.2)" }}
                      />
                    )}
                    {monthViolations > 0 && (
                      <div
                        className="rounded-t-sm"
                        style={{ flex: monthViolations, height: "100%", background: "rgba(248,113,113,0.25)", border: "1px solid rgba(248,113,113,0.2)" }}
                      />
                    )}
                  </div>
                </div>

                {/* Score labels */}
                <div className="grid grid-cols-3 gap-2 px-4 pb-4 text-center">
                  <div className="p-2 bg-[#0f1520] rounded-md">
                    <div className="text-base font-extrabold text-[#f87171] mb-0.5">{monthViolations}</div>
                    <div className="text-[10px] text-[#3a4d66]">Violations</div>
                  </div>
                  <div className="p-2 bg-[#0f1520] rounded-md">
                    <div className="text-base font-extrabold text-[#2dd4bf] mb-0.5">{monthWarnings}</div>
                    <div className="text-[10px] text-[#3a4d66]">Warnings</div>
                  </div>
                  <div className="p-2 bg-[#0f1520] rounded-md">
                    <div className="text-base font-extrabold text-[#4ade80] mb-0.5">{monthClean}</div>
                    <div className="text-[10px] text-[#3a4d66]">Clean</div>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-8 px-[18px] text-center text-xs text-[#3a4d66]">
                No checks this month yet.
              </div>
            )}
          </div>
        </div>

        {/* ── Featured Learning Resources ── */}
        {featuredArticles.length > 0 && (
          <div className="mt-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13px] font-bold text-white">Featured Learning Resources</span>
              <Link href="/app/learn" className="text-[11px] text-[#2dd4bf] no-underline hover:opacity-80">
                View all &rarr;
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {featuredArticles.map((article) => (
                <Link
                  key={article.id}
                  href={`/app/learn/${article.slug}`}
                  className="block bg-[#131b28] border border-[#1d2a3a] rounded-[10px] p-4 no-underline hover:border-[rgba(45,212,191,0.3)] hover:bg-[rgba(45,212,191,0.03)] transition-colors"
                >
                  <h3 className="text-xs font-bold text-white mb-1.5 line-clamp-2">{article.title}</h3>
                  <p className="text-[11px] text-[#7d93b2] leading-relaxed mb-3 line-clamp-2">{article.summary}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {article.platform && (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[rgba(45,212,191,0.08)] text-[#2dd4bf] border border-[rgba(45,212,191,0.15)]">
                        {article.platform.name}
                      </span>
                    )}
                    {article.category && (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[rgba(96,165,250,0.08)] text-[#60a5fa] border border-[rgba(96,165,250,0.15)]">
                        {article.category.name}
                      </span>
                    )}
                    {article.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#18222f] text-[#3a4d66]">
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
