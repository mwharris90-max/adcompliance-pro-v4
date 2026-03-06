"use client";

import { useState } from "react";
import {
  FileSpreadsheet,
  Zap,
  Clock,
  Coins,
  AlertTriangle,
  Copy,
  CheckCircle2,
  Columns3,
  X,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface BulkPreviewData {
  totalRows: number;
  uniqueRows: number;
  duplicateRows: number;
  duplicateGroups: number;
  columnsDetected: Array<{ csvHeader: string; field: string }>;
  unmappedColumns: string[];
  delta?: {
    unchangedRows: number;
    changedRows: number;
    previousJobId: string;
  } | null;
  pricing: {
    instant: { ratePerRow: number; totalCost: number; rowsCharged?: number; description: string };
    batch: { ratePerRow: number; totalCost: number; rowsCharged?: number; description: string };
  };
  balance: {
    remaining: number | null;
    limit: number | null;
    used: number;
    canAffordInstant: boolean;
    canAffordBatch: boolean;
  };
}

interface BulkPreviewDialogProps {
  filename: string;
  preview: BulkPreviewData;
  onRunInstant: () => void;
  onRunBatch: () => void;
  onCancel: () => void;
  loading?: boolean;
  recheckAll?: boolean;
  onRecheckAllChange?: (checked: boolean) => void;
  recheckLoading?: boolean;
}

const FIELD_LABELS: Record<string, string> = {
  headline1: "Headline 1",
  headline2: "Headline 2",
  headline3: "Headline 3",
  headline4: "Headline 4",
  headline5: "Headline 5",
  headline6: "Headline 6",
  headline7: "Headline 7",
  headline8: "Headline 8",
  headline9: "Headline 9",
  headline10: "Headline 10",
  headline11: "Headline 11",
  headline12: "Headline 12",
  headline13: "Headline 13",
  headline14: "Headline 14",
  headline15: "Headline 15",
  description1: "Description 1",
  description2: "Description 2",
  description3: "Description 3",
  description4: "Description 4",
  path1: "Path 1",
  path2: "Path 2",
  finalUrl: "Final URL",
  finalMobileUrl: "Final Mobile URL",
  campaign: "Campaign",
  adGroup: "Ad Group",
  adType: "Ad Type",
  adStatus: "Ad Status",
  labels: "Labels",
};

export function BulkPreviewDialog({
  filename,
  preview,
  onRunInstant,
  onRunBatch,
  onCancel,
  loading,
  recheckAll,
  onRecheckAllChange,
  recheckLoading,
}: BulkPreviewDialogProps) {
  const [selectedMode, setSelectedMode] = useState<"instant" | "batch">("instant");

  const cost =
    selectedMode === "instant"
      ? preview.pricing.instant.totalCost
      : preview.pricing.batch.totalCost;
  const canAfford =
    selectedMode === "instant"
      ? preview.balance.canAffordInstant
      : preview.balance.canAffordBatch;

  // All rows unchanged and user hasn't opted to recheck
  const allUnchanged = !recheckAll &&
    preview.delta != null &&
    preview.delta.unchangedRows > 0 &&
    preview.delta.changedRows === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#1A56DB]/10 to-[#E4168A]/10">
            <FileSpreadsheet className="h-5 w-5 text-[#1A56DB]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{filename}</h2>
            <p className="text-sm text-slate-500">Bulk compliance check preview</p>
          </div>
        </div>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
          <p className="text-2xl font-bold text-slate-900">{preview.totalRows}</p>
          <p className="text-xs text-slate-500">Total rows</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
          <p className="text-2xl font-bold text-emerald-600">{preview.uniqueRows}</p>
          <p className="text-xs text-slate-500">Unique rows</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
          <p className={cn("text-2xl font-bold", preview.duplicateRows > 0 ? "text-amber-500" : "text-slate-300")}>
            {preview.duplicateRows}
          </p>
          <p className="text-xs text-slate-500">Duplicates</p>
        </div>
      </div>

      {/* Duplicate notice */}
      {preview.duplicateRows > 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
          <Copy className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700">
            <strong>{preview.duplicateRows} duplicate row{preview.duplicateRows !== 1 ? "s" : ""}</strong>{" "}
            detected across {preview.duplicateGroups} group{preview.duplicateGroups !== 1 ? "s" : ""}.
            Duplicates will reuse results from the first occurrence — you&apos;ll only be charged for{" "}
            <strong>{preview.uniqueRows} unique rows</strong>.
          </p>
        </div>
      )}

      {/* Delta detection notice — partial unchanged */}
      {preview.delta && preview.delta.unchangedRows > 0 && preview.delta.changedRows > 0 && !recheckAll && (
        <div className="flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
          <p className="text-sm text-emerald-700">
            <strong>{preview.delta.unchangedRows} row{preview.delta.unchangedRows !== 1 ? "s" : ""} unchanged</strong>{" "}
            since your last upload. Previous results will be reused for free — you&apos;ll only be charged for{" "}
            <strong>{preview.delta.changedRows} new/changed row{preview.delta.changedRows !== 1 ? "s" : ""}</strong>.
          </p>
        </div>
      )}

      {/* All rows unchanged — blocking notice */}
      {allUnchanged && (
        <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5">
          <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700">
            <strong>No changes detected.</strong> All {preview.delta!.unchangedRows} row{preview.delta!.unchangedRows !== 1 ? "s are" : " is"}{" "}
            identical to your last upload. To run a fresh check on all rows, tick &quot;Recheck all rows&quot; below.
          </p>
        </div>
      )}

      {/* Recheck all rows toggle — only show when delta detected unchanged rows */}
      {preview.delta && preview.delta.unchangedRows > 0 && onRecheckAllChange && (
        <button
          type="button"
          onClick={() => onRecheckAllChange(!recheckAll)}
          disabled={recheckLoading}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-all",
            recheckAll
              ? "border-amber-300 bg-amber-50"
              : "border-slate-200 bg-white hover:border-slate-300"
          )}
        >
          <div className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
            recheckAll
              ? "border-amber-500 bg-amber-500"
              : "border-slate-300 bg-white"
          )}>
            {recheckAll && (
              <svg viewBox="0 0 12 12" className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 6l3 3 5-5" />
              </svg>
            )}
          </div>
          <div className="flex items-center gap-2">
            <RefreshCw className={cn("h-3.5 w-3.5", recheckAll ? "text-amber-600" : "text-slate-400", recheckLoading && "animate-spin")} />
            <span className={cn("text-sm font-medium", recheckAll ? "text-amber-700" : "text-slate-600")}>
              Recheck all rows (including unchanged)
            </span>
          </div>
          {recheckLoading && (
            <span className="ml-auto text-xs text-slate-400">Updating cost...</span>
          )}
        </button>
      )}

      {/* Columns detected */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Columns3 className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">
            Columns detected ({preview.columnsDetected.length})
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {preview.columnsDetected.map((col) => (
            <Badge key={col.field} variant="secondary" className="text-xs">
              <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-500" />
              {FIELD_LABELS[col.field] ?? col.field}
            </Badge>
          ))}
          {preview.unmappedColumns.length > 0 && (
            <Badge variant="outline" className="text-xs text-slate-400">
              +{preview.unmappedColumns.length} other columns (preserved)
            </Badge>
          )}
        </div>
      </div>

      <Separator />

      {/* Pricing tiers */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-700">Choose processing mode</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Instant */}
          <button
            onClick={() => setSelectedMode("instant")}
            disabled={!preview.balance.canAffordInstant}
            className={cn(
              "rounded-xl border-2 p-4 text-left transition-all",
              selectedMode === "instant"
                ? "border-[#1A56DB] bg-blue-50/50"
                : "border-slate-200 bg-white hover:border-slate-300",
              !preview.balance.canAffordInstant && "opacity-50 cursor-not-allowed"
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-[#1A56DB]" />
              <span className="text-sm font-semibold text-slate-900">Instant Check</span>
            </div>
            <p className="text-xs text-slate-500 mb-3">{preview.pricing.instant.description}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-slate-900">{preview.pricing.instant.totalCost}</span>
              <span className="text-xs text-slate-500">Checkdits</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {preview.pricing.instant.ratePerRow} per row × {preview.pricing.instant.rowsCharged ?? preview.uniqueRows} rows
            </p>
          </button>

          {/* Batch */}
          <button
            onClick={() => setSelectedMode("batch")}
            disabled={!preview.balance.canAffordBatch}
            className={cn(
              "rounded-xl border-2 p-4 text-left transition-all",
              selectedMode === "batch"
                ? "border-[#1A56DB] bg-blue-50/50"
                : "border-slate-200 bg-white hover:border-slate-300",
              !preview.balance.canAffordBatch && "opacity-50 cursor-not-allowed"
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-slate-600" />
              <span className="text-sm font-semibold text-slate-900">Batch Check</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Save 80%</Badge>
            </div>
            <p className="text-xs text-slate-500 mb-3">{preview.pricing.batch.description}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-slate-900">{preview.pricing.batch.totalCost}</span>
              <span className="text-xs text-slate-500">Checkdits</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {preview.pricing.batch.ratePerRow} per row × {preview.pricing.batch.rowsCharged ?? preview.uniqueRows} rows
            </p>
          </button>
        </div>
      </div>

      {/* Balance */}
      <div className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
        canAfford
          ? "bg-blue-50 border border-blue-200 text-blue-700"
          : "bg-red-50 border border-red-200 text-red-700"
      )}>
        <Coins className="h-4 w-4 shrink-0" />
        {canAfford ? (
          <span>
            This will use <strong>{cost} Checkdits</strong>.
            {preview.balance.remaining !== null && (
              <> You have <strong>{preview.balance.remaining}</strong> remaining this month.</>
            )}
          </span>
        ) : (
          <span>
            <strong>Insufficient Checkdits.</strong> You need {cost} but only have{" "}
            {preview.balance.remaining ?? 0} remaining. Contact your administrator to increase your allocation.
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Button variant="ghost" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={selectedMode === "instant" ? onRunInstant : onRunBatch}
          disabled={!canAfford || loading || allUnchanged}
          className="bg-gradient-to-r from-[#1A56DB] to-[#E4168A] text-white hover:opacity-90 border-0"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Starting...
            </span>
          ) : selectedMode === "instant" ? (
            <>
              <Zap className="mr-1.5 h-4 w-4" />
              Run Instant Check ({cost} Checkdits)
            </>
          ) : (
            <>
              <Clock className="mr-1.5 h-4 w-4" />
              Queue Batch Check ({cost} Checkdits)
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
