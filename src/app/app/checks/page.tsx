"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  AlertTriangle,
  XCircle,
  Clock,
  ExternalLink,
  ClipboardCheck,
  Monitor,
  Globe,
  Loader2,
  Chrome,
  FileSpreadsheet,
  Link2,
  Laptop,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Check {
  id: string;
  status: string;
  platformNames: string[];
  countryCount: number;
  headline: string;
  source: string;
  createdAt: string;
  completedAt: string | null;
}

interface ChecksResponse {
  checks: Check[];
  total: number;
  sourceCounts: Record<string, number>;
}

const PAGE_SIZE = 25;

const sourceConfig: Record<string, { label: string; icon: typeof Laptop; color: string }> = {
  ALL: { label: "All", icon: ClipboardCheck, color: "text-slate-600" },
  WEB: { label: "Web", icon: Laptop, color: "text-blue-600" },
  EXTENSION: { label: "Extension", icon: Chrome, color: "text-green-600" },
  BULK: { label: "Bulk", icon: FileSpreadsheet, color: "text-purple-600" },
  INTEGRATION: { label: "Integration", icon: Link2, color: "text-orange-600" },
};

function StatusBadge({ status }: { status: string }) {
  if (status === "CLEAN")
    return (
      <Badge className="bg-green-100 text-green-700 border-green-200 gap-1 hover:bg-green-100">
        <ShieldCheck className="h-3 w-3" /> Clean
      </Badge>
    );
  if (status === "WARNINGS")
    return (
      <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1 hover:bg-amber-100">
        <AlertTriangle className="h-3 w-3" /> Warnings
      </Badge>
    );
  if (status === "VIOLATIONS")
    return (
      <Badge className="bg-red-100 text-red-700 border-red-200 gap-1 hover:bg-red-100">
        <XCircle className="h-3 w-3" /> Violations
      </Badge>
    );
  if (status === "RUNNING" || status === "PENDING")
    return (
      <Badge variant="secondary" className="gap-1">
        <Clock className="h-3 w-3" /> {status === "RUNNING" ? "Running" : "Pending"}
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-slate-500">
      Error
    </Badge>
  );
}

function SourceBadge({ source }: { source: string }) {
  const cfg = sourceConfig[source] ?? sourceConfig.WEB;
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", cfg.color)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CheckHistoryPage() {
  const [data, setData] = useState<ChecksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const fetchChecks = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (source) params.set("source", source);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(page * PAGE_SIZE));

    try {
      const res = await fetch(`/api/compliance/checks?${params}`);
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, [source, page]);

  useEffect(() => {
    fetchChecks();
  }, [fetchChecks]);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Compliance Dashboard</h1>
          <p className="text-slate-500 mt-1 text-sm">
            All compliance checks across every source — web, extension, bulk uploads, and integrations.
          </p>
        </div>
        <Link href="/app/check">
          <Button className="bg-slate-900 hover:bg-slate-800">
            <ClipboardCheck className="mr-2 h-4 w-4" />
            New Check
          </Button>
        </Link>
      </div>

      {/* Source filter tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
        {Object.entries(sourceConfig).map(([key, cfg]) => {
          const Icon = cfg.icon;
          const isActive = key === "ALL" ? source === null : source === key;
          const count = data?.sourceCounts?.[key] ?? 0;

          return (
            <button
              key={key}
              onClick={() => {
                setSource(key === "ALL" ? null : key);
                setPage(0);
              }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap border-b-2 -mb-px",
                isActive
                  ? "text-[#1A56DB] border-[#1A56DB]"
                  : "text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-300"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {cfg.label}
              {count > 0 && (
                <span
                  className={cn(
                    "text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center",
                    isActive ? "bg-[#1A56DB]/10 text-[#1A56DB]" : "bg-slate-100 text-slate-500"
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      )}

      {/* Empty state */}
      {!loading && data && data.checks.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 mb-4">
            <ClipboardCheck className="h-6 w-6 text-slate-400" />
          </div>
          <p className="text-slate-500 font-medium mb-1">
            {source ? `No ${sourceConfig[source]?.label ?? source} checks yet` : "No checks yet"}
          </p>
          <p className="text-sm text-slate-400 mb-6">
            Run your first compliance check to see results here.
          </p>
          <Link href="/app/check">
            <Button variant="outline">Run a Check</Button>
          </Link>
        </div>
      )}

      {/* Results table */}
      {!loading && data && data.checks.length > 0 && (
        <>
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="divide-y divide-slate-100">
              {data.checks.map((check) => {
                const isCompleted =
                  check.status !== "RUNNING" &&
                  check.status !== "PENDING" &&
                  check.status !== "ERROR";

                return (
                  <Link
                    key={check.id}
                    href={`/app/check/results/${check.id}`}
                    className={cn(
                      "flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors",
                      !isCompleted && "opacity-60"
                    )}
                  >
                    {/* Status */}
                    <div className="w-28 shrink-0">
                      <StatusBadge status={check.status} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {check.headline ? (
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {check.headline}
                        </p>
                      ) : (
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
                              +{check.platformNames.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Source */}
                    <div className="hidden sm:block w-24 shrink-0">
                      <SourceBadge source={check.source} />
                    </div>

                    {/* Countries */}
                    <div className="hidden md:flex items-center gap-1.5 w-24 shrink-0">
                      <Globe className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-xs text-slate-500">
                        {check.countryCount} countr{check.countryCount !== 1 ? "ies" : "y"}
                      </span>
                    </div>

                    {/* Date */}
                    <div className="hidden lg:block w-40 shrink-0 text-xs text-slate-400">
                      {formatDate(check.createdAt)}
                    </div>

                    {/* Action */}
                    <div className="shrink-0">
                      {isCompleted && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                          <ExternalLink className="h-3 w-3" />
                          View
                        </Button>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, data.total)} of{" "}
                {data.total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-slate-600">
                  Page {page + 1} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
