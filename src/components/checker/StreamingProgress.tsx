"use client";

import { useRouter } from "next/navigation";
import {
  Wrench,
  Monitor,
  Globe,
  Cpu,
  ImageIcon,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Clock,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ComplianceChecklistItem, ChecklistLayer } from "@/lib/ai/runComplianceCheck";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LayerPhase = "pending" | "running" | "done" | "skipped";

export interface LayerProgress {
  phase: LayerPhase;
  items: ComplianceChecklistItem[];
  elapsedMs?: number;
}

export interface StreamingState {
  technical: LayerProgress;
  platform_rule: LayerProgress;
  geo_rule: LayerProgress;
  ai_text: LayerProgress;
  image: LayerProgress;
  complete: boolean;
  error: string | null;
  checkId: string | null;
  overallStatus: "CLEAN" | "WARNINGS" | "VIOLATIONS" | null;
  summary: string | null;
}

export function initialStreamingState(): StreamingState {
  return {
    technical:     { phase: "pending", items: [] },
    platform_rule: { phase: "pending", items: [] },
    geo_rule:      { phase: "pending", items: [] },
    ai_text:       { phase: "pending", items: [] },
    image:         { phase: "pending", items: [] },
    complete:      false,
    error:         null,
    checkId:       null,
    overallStatus: null,
    summary:       null,
  };
}

// ─── Layer config ─────────────────────────────────────────────────────────────

const LAYER_CONFIG: Record<
  ChecklistLayer,
  { label: string; description: string; Icon: React.ElementType }
> = {
  technical:     { label: "Technical Checks",       description: "Character limits and format specs",      Icon: Wrench },
  platform_rule: { label: "Platform Rules",          description: "Platform advertising policies",         Icon: Monitor },
  geo_rule:      { label: "Geographic Regulations",  description: "Local laws and restrictions",           Icon: Globe },
  ai_text:       { label: "AI Content Analysis",     description: "Per-rule content review",               Icon: Cpu },
  image:         { label: "Image Analysis",          description: "Visual content and creative compliance", Icon: ImageIcon },
};

const LAYER_ORDER: ChecklistLayer[] = ["technical", "platform_rule", "geo_rule", "ai_text", "image"];

// ─── Item counts by status ────────────────────────────────────────────────────

function StatusCounts({ items }: { items: ComplianceChecklistItem[] }) {
  const fails    = items.filter((i) => i.status === "FAIL").length;
  const warnings = items.filter((i) => i.status === "WARNING").length;
  const passes   = items.filter((i) => i.status === "PASS").length;

  if (items.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {fails > 0 && (
        <span className="flex items-center gap-1 text-xs text-red-600">
          <XCircle className="h-3 w-3" />{fails} fail{fails !== 1 ? "s" : ""}
        </span>
      )}
      {warnings > 0 && (
        <span className="flex items-center gap-1 text-xs text-amber-600">
          <AlertTriangle className="h-3 w-3" />{warnings} warning{warnings !== 1 ? "s" : ""}
        </span>
      )}
      {passes > 0 && (
        <span className="flex items-center gap-1 text-xs text-green-600">
          <ShieldCheck className="h-3 w-3" />{passes} passed
        </span>
      )}
    </div>
  );
}

// ─── Single layer row ─────────────────────────────────────────────────────────

function LayerRow({
  layer,
  progress,
}: {
  layer: ChecklistLayer;
  progress: LayerProgress;
}) {
  const cfg = LAYER_CONFIG[layer];
  const Icon = cfg.Icon;
  const { phase, items, elapsedMs } = progress;

  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-xl border px-4 py-3 transition-all duration-300",
        phase === "done"    && "border-slate-200 bg-white",
        phase === "running" && "border-blue-200 bg-blue-50",
        phase === "pending" && "border-slate-100 bg-slate-50 opacity-60",
        phase === "skipped" && "border-slate-100 bg-slate-50 opacity-40",
      )}
    >
      {/* Status icon */}
      <div className="shrink-0">
        {phase === "done"    && <CheckCircle2 className="h-5 w-5 text-green-500" />}
        {phase === "running" && <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />}
        {phase === "pending" && <Clock className="h-5 w-5 text-slate-300" />}
        {phase === "skipped" && <Clock className="h-5 w-5 text-slate-300" />}
      </div>

      {/* Layer icon + label */}
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <Icon className={cn(
          "h-4 w-4 shrink-0",
          phase === "done"    ? "text-slate-500"  : "",
          phase === "running" ? "text-blue-500"   : "",
          phase === "pending" ? "text-slate-300"  : "",
        )} />
        <div className="min-w-0">
          <p className={cn(
            "text-sm font-medium",
            phase === "done"    && "text-slate-800",
            phase === "running" && "text-blue-800",
            phase === "pending" && "text-slate-400",
          )}>
            {cfg.label}
          </p>
          <p className="text-xs text-slate-400 truncate">{cfg.description}</p>
        </div>
      </div>

      {/* Right side — counts or status */}
      <div className="shrink-0 text-right">
        {phase === "done" && (
          <div className="space-y-0.5">
            <StatusCounts items={items} />
            {elapsedMs !== undefined && (
              <p className="text-xs text-slate-300">{(elapsedMs / 1000).toFixed(1)}s</p>
            )}
          </div>
        )}
        {phase === "running" && (
          <p className="text-xs text-blue-500 font-medium">Analysing…</p>
        )}
        {phase === "pending" && (
          <p className="text-xs text-slate-300">Waiting</p>
        )}
      </div>
    </div>
  );
}

// ─── Overall status banner (shown when complete) ──────────────────────────────

function CompleteBanner({
  overallStatus,
  summary,
  checkId,
}: {
  overallStatus: "CLEAN" | "WARNINGS" | "VIOLATIONS";
  summary: string;
  checkId: string;
}) {
  const router = useRouter();

  const config = {
    CLEAN:      { Icon: ShieldCheck, border: "border-green-200", bg: "bg-green-50", iconBg: "bg-green-100", iconColor: "text-green-600", title: "No compliance issues found", titleColor: "text-green-800", textColor: "text-green-700", btnClass: "bg-green-700 hover:bg-green-800" },
    WARNINGS:   { Icon: AlertTriangle, border: "border-amber-200", bg: "bg-amber-50", iconBg: "bg-amber-100", iconColor: "text-amber-600", title: "Warnings found — review before submitting", titleColor: "text-amber-800", textColor: "text-amber-700", btnClass: "bg-amber-700 hover:bg-amber-800" },
    VIOLATIONS: { Icon: XCircle, border: "border-red-200", bg: "bg-red-50", iconBg: "bg-red-100", iconColor: "text-red-600", title: "Violations found — resolve before submitting", titleColor: "text-red-800", textColor: "text-red-700", btnClass: "bg-red-700 hover:bg-red-800" },
  }[overallStatus];

  const { Icon } = config;

  return (
    <div className={cn("rounded-2xl border p-5 space-y-4", config.border, config.bg)}>
      <div className="flex items-start gap-4">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", config.iconBg)}>
          <Icon className={cn("h-6 w-6", config.iconColor)} />
        </div>
        <div className="flex-1">
          <h3 className={cn("font-semibold", config.titleColor)}>{config.title}</h3>
          <p className={cn("text-sm mt-1", config.textColor)}>{summary}</p>
        </div>
      </div>
      <Button
        onClick={() => router.push(`/app/check/results/${checkId}`)}
        className={cn("w-full sm:w-auto", config.btnClass, "text-white")}
      >
        View Full Results
        <ChevronRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

// ─── Live items preview ───────────────────────────────────────────────────────

function LiveItemsPreview({ items }: { items: ComplianceChecklistItem[] }) {
  const visible = items.filter((i) => i.status !== "PASS").slice(0, 6);
  const passCount = items.filter((i) => i.status === "PASS").length;

  if (items.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {visible.map((item) => (
        <div
          key={item.id}
          className={cn(
            "flex items-start gap-2.5 rounded-lg border px-3 py-2 text-sm",
            item.status === "FAIL"    && "border-red-100 bg-red-50/50",
            item.status === "WARNING" && "border-amber-100 bg-amber-50/50",
          )}
        >
          {item.status === "FAIL"    && <XCircle       className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />}
          {item.status === "WARNING" && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className="text-slate-800 font-medium truncate leading-snug">{item.ruleTitle}</p>
            <p className="text-xs text-slate-500 truncate mt-0.5">{item.reason}</p>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "text-xs shrink-0",
              item.status === "FAIL"    && "bg-red-100 text-red-700 border-red-200",
              item.status === "WARNING" && "bg-amber-100 text-amber-700 border-amber-200",
            )}
          >
            {item.status === "FAIL" ? "Fail" : "Warning"}
          </Badge>
        </div>
      ))}
      {passCount > 0 && (
        <p className="text-xs text-slate-400 pl-1">
          + {passCount} passed rule{passCount !== 1 ? "s" : ""} (shown in full results)
        </p>
      )}
      {items.filter((i) => i.status !== "PASS").length > 6 && (
        <p className="text-xs text-slate-400 pl-1">
          … and {items.filter((i) => i.status !== "PASS").length - 6} more issue{items.filter((i) => i.status !== "PASS").length - 6 !== 1 ? "s" : ""} in full results
        </p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StreamingProgress({ state }: { state: StreamingState }) {
  const allItems = [
    ...state.technical.items,
    ...state.platform_rule.items,
    ...state.geo_rule.items,
    ...state.ai_text.items,
    ...state.image.items,
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        {!state.complete && !state.error && (
          <Loader2 className="h-5 w-5 animate-spin text-slate-400 shrink-0" />
        )}
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            {state.complete ? "Analysis complete" : state.error ? "Analysis failed" : "Analysing your advertisement…"}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {state.complete
              ? "All layers checked — view your full results below."
              : state.error
              ? state.error
              : "Checking each layer in sequence. AI analysis takes a few seconds."}
          </p>
        </div>
      </div>

      {/* Layer progress rows */}
      <div className="space-y-2">
        {LAYER_ORDER.map((layer) => (
          <LayerRow key={layer} layer={layer} progress={state[layer]} />
        ))}
      </div>

      {/* Live issues preview */}
      {allItems.length > 0 && !state.complete && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Issues found so far
          </p>
          <LiveItemsPreview items={allItems} />
        </div>
      )}

      {/* Complete banner */}
      {state.complete && state.checkId && state.overallStatus && state.summary && (
        <CompleteBanner
          overallStatus={state.overallStatus}
          summary={state.summary}
          checkId={state.checkId}
        />
      )}

      {/* Error state */}
      {state.error && !state.complete && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{state.error}</p>
        </div>
      )}
    </div>
  );
}
