"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Scale,
  ExternalLink,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Globe,
  Ban,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface RegulatoryWarning {
  id: string;
  type: "geo" | "platform";
  categoryName: string;
  categorySlug: string;
  countryName: string | null;
  countryCode: string | null;
  platformName: string | null;
  notes: string | null;
  legislationUrl: string | null;
  legalReference: string | null;
  warningTitle: string | null;
  confirmationMessage: string | null;
}

interface RegulatoryConfirmationProps {
  platformIds: string[];
  categoryIds: string[];
  countryIds: string[];
  onResolved: (warnings: RegulatoryWarning[], allConfirmed: boolean) => void;
}

export function RegulatoryConfirmation({
  platformIds,
  categoryIds,
  countryIds,
  onResolved,
}: RegulatoryConfirmationProps) {
  const [loading, setLoading] = useState(false);
  const [warnings, setWarnings] = useState<RegulatoryWarning[]>([]);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());

  // Fetch warnings when selections change
  useEffect(() => {
    if (!categoryIds.length || !countryIds.length) {
      setWarnings([]);
      setConfirmed(new Set());
      onResolved([], true);
      return;
    }

    setLoading(true);
    setConfirmed(new Set());
    fetch("/api/compliance/regulatory-warnings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platformIds, categoryIds, countryIds }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          const w = data.warnings as RegulatoryWarning[];
          setWarnings(w);
          onResolved(w, w.length === 0);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platformIds.join(","), categoryIds.join(","), countryIds.join(",")]);

  const handleConfirm = useCallback(
    (warningId: string) => {
      const next = new Set(confirmed);
      next.add(warningId);
      setConfirmed(next);
      onResolved(warnings, warnings.every((w) => next.has(w.id)));
    },
    [confirmed, warnings, onResolved]
  );

  const handleConfirmAll = useCallback(() => {
    const next = new Set(warnings.map((w) => w.id));
    setConfirmed(next);
    onResolved(warnings, true);
  }, [warnings, onResolved]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking regulatory restrictions...
      </div>
    );
  }

  if (!warnings.length) return null;

  const allConfirmed = warnings.every((w) => confirmed.has(w.id));
  const unresolvedCount = warnings.filter((w) => !confirmed.has(w.id)).length;

  // Group warnings by category for cleaner display
  const grouped = new Map<string, RegulatoryWarning[]>();
  for (const w of warnings) {
    const key = w.categoryName;
    const existing = grouped.get(key) ?? [];
    existing.push(w);
    grouped.set(key, existing);
  }

  return (
    <div className="space-y-3">
      {/* Banner */}
      {!allConfirmed && (
        <div className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3">
          <Ban className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-900">
              Regulatory restrictions detected
            </p>
            <p className="text-sm text-red-800 mt-1">
              Your selected categories and target regions include jurisdictions where certain
              types of advertising are <strong>prohibited by law</strong>. Please review each
              restriction below and confirm your adverts do not contravene these regulations
              before proceeding.
            </p>
          </div>
        </div>
      )}

      {/* Warning cards grouped by category */}
      {Array.from(grouped.entries()).map(([categoryName, categoryWarnings]) => (
        <div key={categoryName} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {/* Category header */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
            <Scale className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-700">
              It looks like your adverts are related to {categoryName}
            </span>
          </div>

          {/* Individual restrictions */}
          <div className="divide-y divide-slate-100">
            {categoryWarnings.map((warning) => {
              const isConfirmed = confirmed.has(warning.id);
              const location = warning.countryName
                ? warning.countryName
                : warning.platformName ?? "Selected platforms";

              return (
                <div
                  key={warning.id}
                  className={cn(
                    "px-4 py-3 transition-colors",
                    isConfirmed && "bg-emerald-50/50"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Location badge */}
                    <div className="shrink-0 mt-0.5">
                      {warning.type === "geo" ? (
                        <div className="flex items-center gap-1.5">
                          <Globe className="h-4 w-4 text-slate-400" />
                          <Badge variant="outline" className="text-xs px-2 py-0.5">
                            {warning.countryCode ?? location}
                          </Badge>
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-xs px-2 py-0.5">
                          {warning.platformName}
                        </Badge>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
                          Prohibited
                        </Badge>
                        <span className="text-xs text-slate-500">{location}</span>
                      </div>

                      {warning.notes && (
                        <p className="text-sm text-slate-700 leading-relaxed mb-2">
                          {warning.notes}
                        </p>
                      )}

                      {warning.legislationUrl && (
                        <div className="flex items-center gap-1.5 mb-1 px-2.5 py-1.5 rounded-md bg-slate-50 border border-slate-200 w-fit">
                          <Scale className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                          <span className="text-xs font-medium text-slate-600">
                            {warning.legalReference || "Source Policy"}:
                          </span>
                          <a
                            href={warning.legislationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-[#1A56DB] hover:text-[#1A56DB]/80"
                          >
                            View policy
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Confirmation */}
                  <div className="mt-3 ml-9">
                    {isConfirmed ? (
                      <div className="flex items-center gap-2 text-sm text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Confirmed — {warning.confirmationMessage}</span>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleConfirm(warning.id)}
                        className="border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 hover:text-amber-900"
                      >
                        <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
                        {warning.confirmationMessage}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Confirm all shortcut when multiple */}
      {warnings.length > 1 && !allConfirmed && (
        <div className="flex justify-center">
          <Button
            size="sm"
            variant="outline"
            onClick={handleConfirmAll}
            className="text-slate-600"
          >
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
            Confirm all {unresolvedCount} restriction{unresolvedCount !== 1 ? "s" : ""}
          </Button>
        </div>
      )}

      {/* All confirmed summary */}
      {allConfirmed && (
        <div className="flex items-center justify-center gap-2 text-xs text-emerald-600 py-1">
          <CheckCircle2 className="h-3.5 w-3.5" />
          All regulatory restrictions confirmed
        </div>
      )}
    </div>
  );
}
