"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  Zap,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface BulkJob {
  id: string;
  filename: string;
  rowCount: number;
  uniqueRowCount: number;
  duplicateCount: number;
  mode: "INSTANT" | "BATCH";
  status: "PENDING" | "PROCESSING" | "COMPLETE" | "FAILED";
  checkditsCost: string;
  checkditsRefund: string;
  resultsSummary: { passCount: number; warningCount: number; failCount: number; errorCount: number } | null;
  submittedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

const STATUS_STYLES: Record<string, { icon: typeof CheckCircle2; label: string; colour: string }> = {
  PENDING: { icon: Clock, label: "Queued", colour: "text-slate-500" },
  PROCESSING: { icon: Loader2, label: "Processing", colour: "text-blue-500" },
  COMPLETE: { icon: CheckCircle2, label: "Complete", colour: "text-emerald-600" },
  FAILED: { icon: XCircle, label: "Failed", colour: "text-red-600" },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BulkJobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<BulkJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/compliance/check/bulk/jobs");
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs);
      }
    } catch { /* non-fatal */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchJobs();

    // Poll for updates if any jobs are pending/processing
    const interval = setInterval(() => {
      fetchJobs();
    }, 15000);

    return () => clearInterval(interval);
  }, [fetchJobs]);

  // Show toast when a job completes
  useEffect(() => {
    const completed = jobs.filter((j) => j.status === "COMPLETE" && !j.completedAt);
    // Simple check — in real implementation we'd track notified jobs
  }, [jobs]);

  const hasActiveJobs = jobs.some((j) => j.status === "PENDING" || j.status === "PROCESSING");

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bulk Check Jobs</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Track your CSV bulk compliance checks.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasActiveJobs && (
            <Badge variant="secondary" className="text-xs">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Active jobs
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={fetchJobs}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => router.push("/app/check")}>
            New Check
          </Button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 text-slate-400 animate-spin" />
        </div>
      )}

      {!loading && jobs.length === 0 && (
        <Card className="border-slate-200">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileSpreadsheet className="h-10 w-10 text-slate-300 mb-3" />
            <p className="text-sm text-slate-500">No bulk checks yet.</p>
            <p className="text-xs text-slate-400 mt-1">
              Upload a Google Ads CSV on the check page to get started.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && jobs.length > 0 && (
        <div className="space-y-3">
          {jobs.map((job) => {
            const statusConfig = STATUS_STYLES[job.status] ?? STATUS_STYLES.PENDING;
            const StatusIcon = statusConfig.icon;
            const refund = parseFloat(job.checkditsRefund);

            return (
              <Card key={job.id} className="border-slate-200 hover:border-slate-300 transition-colors">
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 shrink-0">
                      <FileSpreadsheet className="h-5 w-5 text-slate-500" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-900 truncate">{job.filename}</p>
                        <Badge variant="outline" className="text-[10px] px-1.5 shrink-0">
                          {job.mode === "INSTANT" ? (
                            <><Zap className="h-2.5 w-2.5 mr-0.5" />Instant</>
                          ) : (
                            <><Clock className="h-2.5 w-2.5 mr-0.5" />Batch</>
                          )}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {job.rowCount} rows ({job.uniqueRowCount} unique) · {parseFloat(job.checkditsCost)} Checkdits
                        {refund > 0 && <span className="text-emerald-600"> · {refund} refunded</span>}
                        {" · "}Submitted {formatDate(job.submittedAt)}
                      </p>
                    </div>

                    {/* Status */}
                    <div className={cn("flex items-center gap-1.5 text-xs font-medium shrink-0", statusConfig.colour)}>
                      <StatusIcon className={cn("h-4 w-4", job.status === "PROCESSING" && "animate-spin")} />
                      {statusConfig.label}
                    </div>

                    {/* Results summary */}
                    {job.resultsSummary && (
                      <div className="flex items-center gap-3 text-xs shrink-0">
                        <span className="flex items-center gap-1 text-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5" />{job.resultsSummary.passCount}
                        </span>
                        <span className="flex items-center gap-1 text-amber-600">
                          <AlertTriangle className="h-3.5 w-3.5" />{job.resultsSummary.warningCount}
                        </span>
                        <span className="flex items-center gap-1 text-red-600">
                          <XCircle className="h-3.5 w-3.5" />{job.resultsSummary.failCount}
                        </span>
                      </div>
                    )}

                    {/* View link */}
                    {job.status === "COMPLETE" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/app/bulk-jobs/${job.id}`)}
                        className="shrink-0"
                      >
                        View <ExternalLink className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
