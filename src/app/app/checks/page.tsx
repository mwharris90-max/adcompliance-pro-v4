import { auth } from "@/auth";
import { db } from "@/lib/db";
import { format } from "date-fns";
import Link from "next/link";
import {
  ShieldCheck,
  AlertTriangle,
  XCircle,
  Clock,
  FileDown,
  ExternalLink,
  ClipboardCheck,
  Monitor,
  Globe,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "CLEAN") {
    return (
      <Badge className="bg-green-100 text-green-700 border-green-200 gap-1 hover:bg-green-100">
        <ShieldCheck className="h-3 w-3" />
        Clean
      </Badge>
    );
  }
  if (status === "WARNINGS") {
    return (
      <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1 hover:bg-amber-100">
        <AlertTriangle className="h-3 w-3" />
        Warnings
      </Badge>
    );
  }
  if (status === "VIOLATIONS") {
    return (
      <Badge className="bg-red-100 text-red-700 border-red-200 gap-1 hover:bg-red-100">
        <XCircle className="h-3 w-3" />
        Violations
      </Badge>
    );
  }
  if (status === "RUNNING" || status === "PENDING") {
    return (
      <Badge variant="secondary" className="gap-1">
        <Clock className="h-3 w-3" />
        {status === "RUNNING" ? "Running" : "Pending"}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-slate-500">
      Error
    </Badge>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CheckHistoryPage() {
  const session = await auth();

  // Fetch checks with platform resolution
  const checks = await db.complianceCheck.findMany({
    where: { userId: session!.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      status: true,
      overallStatus: true,
      platformIds: true,
      categoryIds: true,
      countryIds: true,
      createdAt: true,
      completedAt: true,
    },
  });

  // Resolve platform names once
  const allPlatformIds = [...new Set(checks.flatMap((c) => c.platformIds))];
  const platformRows = allPlatformIds.length
    ? await db.platform.findMany({
        where: { id: { in: allPlatformIds } },
        select: { id: true, name: true },
      })
    : [];
  const platformMap = new Map(platformRows.map((p) => [p.id, p.name]));

  const checksWithNames = checks.map((c) => ({
    ...c,
    platformNames: c.platformIds.map((id) => platformMap.get(id) ?? id),
    effectiveStatus: c.overallStatus ?? c.status,
  }));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Check History</h1>
          <p className="text-slate-500 mt-1 text-sm">
            All your past compliance checks, most recent first.
          </p>
        </div>
        <Link href="/app/check">
          <Button className="bg-slate-900 hover:bg-slate-800">
            <ClipboardCheck className="mr-2 h-4 w-4" />
            New Check
          </Button>
        </Link>
      </div>

      {/* Empty state */}
      {checksWithNames.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 mb-4">
            <ClipboardCheck className="h-6 w-6 text-slate-400" />
          </div>
          <p className="text-slate-500 font-medium mb-1">No checks yet</p>
          <p className="text-sm text-slate-400 mb-6">
            Run your first compliance check to see results here.
          </p>
          <Link href="/app/check">
            <Button variant="outline">Run a Check</Button>
          </Link>
        </div>
      )}

      {/* Table */}
      {checksWithNames.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="divide-y divide-slate-100">
            {checksWithNames.map((check) => {
              const isCompleted =
                check.effectiveStatus !== "RUNNING" &&
                check.effectiveStatus !== "PENDING" &&
                check.effectiveStatus !== "ERROR";

              return (
                <div
                  key={check.id}
                  className={cn(
                    "flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors",
                    !isCompleted && "opacity-60"
                  )}
                >
                  {/* Status */}
                  <div className="w-28 shrink-0">
                    <StatusBadge status={check.effectiveStatus} />
                  </div>

                  {/* Platforms */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Monitor className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      {check.platformNames.slice(0, 3).map((name, i) => (
                        <span
                          key={i}
                          className="text-xs bg-slate-100 text-slate-600 rounded px-1.5 py-0.5"
                        >
                          {name}
                        </span>
                      ))}
                      {check.platformNames.length > 3 && (
                        <span className="text-xs text-slate-400">
                          +{check.platformNames.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Countries */}
                  <div className="hidden sm:flex items-center gap-1.5 w-28 shrink-0">
                    <Globe className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-xs text-slate-500">
                      {check.countryIds.length} countr
                      {check.countryIds.length !== 1 ? "ies" : "y"}
                    </span>
                  </div>

                  {/* Date */}
                  <div className="hidden md:block w-36 shrink-0 text-xs text-slate-400">
                    {format(new Date(check.createdAt), "d MMM yyyy, HH:mm")}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isCompleted && (
                      <>
                        <Link href={`/app/check/results/${check.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs gap-1.5"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            View
                          </Button>
                        </Link>
                        <a
                          href={`/api/compliance/${check.id}/report`}
                          download
                          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                          title="Download PDF report"
                        >
                          <FileDown className="h-3.5 w-3.5" />
                          PDF
                        </a>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {checksWithNames.length >= 50 && (
            <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400 text-center">
              Showing 50 most recent checks
            </div>
          )}
        </div>
      )}
    </div>
  );
}
