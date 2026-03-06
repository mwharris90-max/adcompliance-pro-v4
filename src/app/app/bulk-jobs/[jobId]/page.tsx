"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BulkComplianceTable, type BulkRowResult } from "@/components/checker/BulkComplianceTable";

interface JobMeta {
  filename: string;
  status: string;
  platformIds: string[];
  categoryIds: string[];
  countryIds: string[];
  resultsSummary: { passCount: number; warningCount: number; failCount: number; errorCount: number } | null;
}

export default function BulkJobDetailPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params);
  const router = useRouter();
  const [rows, setRows] = useState<BulkRowResult[]>([]);
  const [meta, setMeta] = useState<JobMeta | null>(null);
  const [columnMapping, setColumnMapping] = useState<{ mapped: Record<string, string>; unmapped: string[]; originalHeaders: string[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [rowsRes, jobsRes] = await Promise.all([
        fetch(`/api/compliance/check/bulk/${jobId}/rows`),
        fetch("/api/compliance/check/bulk/jobs"),
      ]);

      if (rowsRes.ok) {
        const data = await rowsRes.json();
        setRows(data.rows);
        setColumnMapping(data.columnMapping ?? null);
      }

      if (jobsRes.ok) {
        const data = await jobsRes.json();
        const job = data.jobs.find((j: { id: string }) => j.id === jobId);
        if (job) {
          setMeta({
            filename: job.filename,
            status: job.status,
            platformIds: [],
            categoryIds: [],
            countryIds: [],
            resultsSummary: job.resultsSummary,
          });
        }
      }
    } catch { /* non-fatal */ }
    setLoading(false);
  }, [jobId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleEditCell(rowIndex: number, field: string, value: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.rowIndex !== rowIndex) return r;
        return { ...r, editedContent: { ...(r.editedContent ?? {}), [field]: value } };
      })
    );
  }

  function handleDownloadCsv() {
    if (!columnMapping || !rows.length) return;

    import("papaparse").then((Papa) => {
      const fieldToHeader: Record<string, string> = {};
      for (const [csvHeader, fieldName] of Object.entries(columnMapping.mapped)) {
        fieldToHeader[fieldName] = csvHeader;
      }

      const outputRows = rows.map((row) => {
        const outputRow = { ...row.rawCsvRow };
        if (row.editedContent) {
          for (const [fieldName, val] of Object.entries(row.editedContent)) {
            const csvHeader = fieldToHeader[fieldName];
            if (csvHeader) outputRow[csvHeader] = val;
          }
        }
        return outputRow;
      });

      const csv = Papa.default.unparse(outputRows, {
        columns: columnMapping.originalHeaders,
        newline: "\r\n",
      });

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (meta?.filename ?? "bulk").replace(/\.csv$/i, "") + "_checked.csv";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/app/bulk-jobs")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{meta?.filename ?? "Bulk Check"}</h1>
          <p className="text-slate-500 text-sm">{rows.length} rows</p>
        </div>
      </div>

      <BulkComplianceTable
        rows={rows}
        processing={false}
        processedCount={0}
        totalUniqueRows={0}
        summary={meta?.resultsSummary ?? null}
        onEditCell={handleEditCell}
        onDownloadCsv={handleDownloadCsv}
        platformIds={meta?.platformIds}
        categoryIds={meta?.categoryIds}
        countryIds={meta?.countryIds}
      />
    </div>
  );
}
