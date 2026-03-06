"use client";

import { useState } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  RotateCcw,
  Cpu,
  Monitor,
  Globe,
  Wrench,
  ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RewritePanel, AmendedChip } from "@/components/checker/RewritePanel";
import { detectRewriteableField } from "@/lib/rewrite-utils";
import type {
  ComplianceChecklistItem,
  ChecklistStatus,
  ChecklistLayer,
  ChecklistOverride,
  AdContentPayload,
  AcceptedRewrite,
} from "@/lib/ai/runComplianceCheck";

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterTab = "all" | "fail" | "warning" | "pass";

interface ComplianceChecklistProps {
  items: ComplianceChecklistItem[];
  overrides: ChecklistOverride[];
  onOverride: (itemId: string, reason: string) => void;
  onUndoOverride: (itemId: string) => void;
  // Rewrite props
  adContent?: AdContentPayload;
  checkId?: string;
  acceptedRewrites?: AcceptedRewrite[];
  onAcceptRewrite?: (rewrite: AcceptedRewrite) => void;
  onUndoRewrite?: (itemId: string) => void;
}

// ─── Layer metadata ───────────────────────────────────────────────────────────

const LAYER_META: Record<
  ChecklistLayer,
  { label: string; Icon: React.ElementType; description: string; color?: string; bg?: string; border?: string }
> = {
  technical: {
    label: "Technical Requirements",
    Icon: Wrench,
    description: "Character limits and format specifications",
  },
  platform_rule: {
    label: "Platform Rules",
    Icon: Monitor,
    description: "Platform advertising policies",
  },
  geo_rule: {
    label: "Geographic Rules",
    Icon: Globe,
    description: "Local laws and regulations",
  },
  ai_text: {
    label: "AI Content Analysis",
    Icon: Cpu,
    description: "Content-based compliance review",
  },
  image: {
    label: "Image Analysis",
    Icon: ImageIcon,
    description: "Visual content and creative compliance",
    color: "text-purple-500",
    bg: "bg-purple-50",
    border: "border-purple-200",
  },
};

// ─── Status config ────────────────────────────────────────────────────────────

function statusConfig(status: ChecklistStatus, overridden: boolean) {
  if (overridden) {
    return {
      icon: RotateCcw,
      badgeClass: "bg-purple-100 text-purple-700 border-purple-200",
      iconClass: "text-purple-500",
      rowClass: "border-purple-100 bg-purple-50/30 opacity-70",
      label: "Overridden",
    };
  }
  switch (status) {
    case "FAIL":
      return {
        icon: XCircle,
        badgeClass: "bg-red-100 text-red-700 border-red-200",
        iconClass: "text-red-500",
        rowClass: "border-red-100 bg-red-50/30",
        label: "Fail",
      };
    case "WARNING":
      return {
        icon: AlertTriangle,
        badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
        iconClass: "text-amber-500",
        rowClass: "border-amber-100 bg-amber-50/30",
        label: "Warning",
      };
    case "PASS":
      return {
        icon: ShieldCheck,
        badgeClass: "bg-green-100 text-green-700 border-green-200",
        iconClass: "text-green-500",
        rowClass: "border-slate-100 bg-white",
        label: "Pass",
      };
  }
}

// ─── Override modal ───────────────────────────────────────────────────────────

function OverrideModal({
  item,
  onConfirm,
  onCancel,
}: {
  item: ComplianceChecklistItem;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-6 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Override warning
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            You are overriding:{" "}
            <span className="font-medium text-slate-700">{item.ruleTitle}</span>
          </p>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          Overrides are recorded for audit purposes. The compliance status will
          reflect this override in your PDF report.
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">
            Reason for override{" "}
            <span className="text-slate-400 font-normal">(required)</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. We have pre-approval from the platform for this content category."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 resize-none"
            rows={3}
            autoFocus
          />
          <p className="text-xs text-slate-400">
            {reason.length}/10 minimum characters
          </p>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => onConfirm(reason)}
            disabled={reason.trim().length < 10}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            Confirm Override
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Single checklist row ─────────────────────────────────────────────────────

function ChecklistRow({
  item,
  isOverridden,
  override,
  onOverride,
  onUndoOverride,
  adContent,
  checkId,
  acceptedRewrite,
  onAcceptRewrite,
  onUndoRewrite,
}: {
  item: ComplianceChecklistItem;
  isOverridden: boolean;
  override?: ChecklistOverride;
  onOverride: () => void;
  onUndoOverride: () => void;
  adContent?: AdContentPayload;
  checkId?: string;
  acceptedRewrite?: AcceptedRewrite;
  onAcceptRewrite?: (rewrite: AcceptedRewrite) => void;
  onUndoRewrite?: (itemId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = statusConfig(item.status, isOverridden);
  const StatusIcon = cfg.icon;

  const showRewritePanel =
    !isOverridden &&
    item.status !== "PASS" &&
    adContent !== undefined &&
    checkId !== undefined &&
    onAcceptRewrite !== undefined &&
    onUndoRewrite !== undefined &&
    detectRewriteableField(item, adContent) !== null;

  return (
    <div className={cn("rounded-xl border transition-all", cfg.rowClass)}>
      {/* Collapsed header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        {/* Status icon */}
        <StatusIcon className={cn("h-4 w-4 shrink-0", cfg.iconClass)} />

        {/* Title + reason */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-slate-800 leading-snug">
              {item.ruleTitle}
            </span>
            <Badge
              variant="outline"
              className={cn("text-xs shrink-0 capitalize", cfg.badgeClass)}
            >
              {cfg.label}
            </Badge>
            {item.aiGenerated && (
              <Badge
                variant="outline"
                className="text-xs shrink-0 bg-slate-50 text-slate-500 border-slate-200"
              >
                AI
              </Badge>
            )}
            {acceptedRewrite && <AmendedChip />}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 leading-snug line-clamp-1">
            {item.reason}
          </p>
        </div>

        {/* Expand chevron */}
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
        )}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-slate-100">
          {/* Quoted content */}
          {item.quotedContent && (
            <div className="rounded-md bg-slate-100 border border-slate-200 px-3 py-2">
              <p className="text-xs text-slate-500 mb-1 font-medium">
                Flagged content
              </p>
              <p className="text-sm text-slate-700 italic">
                &ldquo;{item.quotedContent}&rdquo;
              </p>
            </div>
          )}

          {/* Full explanation */}
          <p className="text-sm text-slate-700 leading-relaxed">
            {item.explanation}
          </p>

          {/* Platform / country badges */}
          {(item.applicablePlatforms.length > 0 ||
            item.applicableCountries.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {item.applicablePlatforms.map((p) => (
                <Badge
                  key={p}
                  variant="secondary"
                  className="text-xs bg-slate-100 text-slate-600"
                >
                  {p}
                </Badge>
              ))}
              {item.applicableCountries.map((c) => (
                <Badge
                  key={c}
                  variant="secondary"
                  className="text-xs bg-blue-50 text-blue-700 border border-blue-200"
                >
                  {c}
                </Badge>
              ))}
            </div>
          )}

          {/* Suggestion */}
          {item.suggestion && (
            <div className="flex items-start gap-2 rounded-lg bg-white border border-slate-200 px-3 py-2.5">
              <ChevronRight className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-700">
                <span className="font-medium text-slate-800">Suggestion: </span>
                {item.suggestion}
              </p>
            </div>
          )}

          {/* Rule reference */}
          {item.ruleReference && (
            <div className="text-xs text-slate-500 space-y-0.5 pl-1">
              <span className="font-medium">Source: </span>
              {item.ruleReference.url ? (
                <a
                  href={item.ruleReference.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-blue-600 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {item.ruleReference.source}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span>{item.ruleReference.source}</span>
              )}
              {item.ruleReference.ruleText && (
                <p className="text-slate-400 italic mt-0.5">
                  &ldquo;{item.ruleReference.ruleText}&rdquo;
                </p>
              )}
            </div>
          )}

          {/* Override section */}
          {isOverridden && override && (
            <div className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-2.5 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-purple-800">
                  Warning overridden
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUndoOverride();
                  }}
                  className="text-xs text-purple-600 hover:underline"
                >
                  Undo
                </button>
              </div>
              <p className="text-xs text-purple-700">{override.reason}</p>
              <p className="text-xs text-purple-500">
                {new Date(override.overriddenAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </div>
          )}

          {/* Override button — for any overrideable item (WARNING or FAIL) */}
          {item.isOverrideable && !isOverridden && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onOverride();
                }}
                className="text-xs text-purple-600 border-purple-200 hover:bg-purple-50"
              >
                Override {item.status === "FAIL" ? "failure" : "warning"}
              </Button>
            </div>
          )}

          {/* Rewrite panel */}
          {showRewritePanel && (
            <RewritePanel
              item={item}
              adContent={adContent!}
              checkId={checkId!}
              acceptedRewrite={acceptedRewrite}
              onAccept={onAcceptRewrite!}
              onUndo={onUndoRewrite!}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Layer group ──────────────────────────────────────────────────────────────

function LayerGroup({
  layer,
  items,
  overrides,
  overrideMap,
  onOverride,
  onUndoOverride,
  adContent,
  checkId,
  acceptedRewrites,
  onAcceptRewrite,
  onUndoRewrite,
}: {
  layer: ChecklistLayer;
  items: ComplianceChecklistItem[];
  overrides: ChecklistOverride[];
  overrideMap: Map<string, ChecklistOverride>;
  onOverride: (itemId: string) => void;
  onUndoOverride: (itemId: string) => void;
  adContent?: AdContentPayload;
  checkId?: string;
  acceptedRewrites?: AcceptedRewrite[];
  onAcceptRewrite?: (rewrite: AcceptedRewrite) => void;
  onUndoRewrite?: (itemId: string) => void;
}) {
  const meta = LAYER_META[layer];
  const Icon = meta.Icon;

  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <Icon className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          {meta.label}
        </span>
        <span className="text-xs text-slate-400">— {meta.description}</span>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <ChecklistRow
            key={item.id}
            item={item}
            isOverridden={overrideMap.has(item.id)}
            override={overrideMap.get(item.id)}
            onOverride={() => onOverride(item.id)}
            onUndoOverride={() => onUndoOverride(item.id)}
            adContent={adContent}
            checkId={checkId}
            acceptedRewrite={acceptedRewrites?.find((r) => r.itemId === item.id)}
            onAcceptRewrite={onAcceptRewrite}
            onUndoRewrite={onUndoRewrite}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ComplianceChecklist({
  items,
  overrides,
  onOverride,
  onUndoOverride,
  adContent,
  checkId,
  acceptedRewrites,
  onAcceptRewrite,
  onUndoRewrite,
}: ComplianceChecklistProps) {
  const [filter, setFilter] = useState<FilterTab>("all");
  const [overrideTarget, setOverrideTarget] = useState<string | null>(null);

  const overrideMap = new Map(overrides.map((o) => [o.itemId, o]));

  function effectiveStatus(item: ComplianceChecklistItem): ChecklistStatus {
    return overrideMap.has(item.id) ? "PASS" : item.status;
  }

  const filtered = items.filter((item) => {
    const eff = effectiveStatus(item);
    if (filter === "fail") return item.status === "FAIL" && !overrideMap.has(item.id);
    if (filter === "warning") return item.status === "WARNING" && !overrideMap.has(item.id);
    if (filter === "pass") return eff === "PASS";
    return true;
  });

  const failCount = items.filter(
    (i) => i.status === "FAIL" && !overrideMap.has(i.id)
  ).length;
  const warnCount = items.filter(
    (i) => i.status === "WARNING" && !overrideMap.has(i.id)
  ).length;
  const passCount = items.filter((i) => effectiveStatus(i) === "PASS").length;

  const layers: ChecklistLayer[] = ["technical", "platform_rule", "geo_rule", "ai_text", "image"];

  const overrideItem = overrideTarget ? items.find((i) => i.id === overrideTarget) : null;

  function handleOverrideConfirm(reason: string) {
    if (!overrideTarget) return;
    onOverride(overrideTarget, reason);
    setOverrideTarget(null);
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <ShieldCheck className="h-6 w-6 text-green-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-700">
            No rules checked yet
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Run a compliance check to see results here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Override modal */}
      {overrideItem && (
        <OverrideModal
          item={overrideItem}
          onConfirm={handleOverrideConfirm}
          onCancel={() => setOverrideTarget(null)}
        />
      )}

      <div className="space-y-4">
        {/* Filter tabs */}
        <div className="flex items-center gap-1 flex-wrap">
          {(
            [
              { key: "all", label: `All (${items.length})` },
              {
                key: "fail",
                label: `Fails (${failCount})`,
                activeClass: "bg-red-100 text-red-700 border-red-200",
              },
              {
                key: "warning",
                label: `Warnings (${warnCount})`,
                activeClass: "bg-amber-100 text-amber-700 border-amber-200",
              },
              {
                key: "pass",
                label: `Passed (${passCount})`,
                activeClass: "bg-green-100 text-green-700 border-green-200",
              },
            ] as {
              key: FilterTab;
              label: string;
              activeClass?: string;
            }[]
          ).map(({ key, label, activeClass }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                filter === key
                  ? activeClass ?? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Layer groups */}
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">
            No {filter !== "all" ? filter + " " : ""}items to show.
          </p>
        ) : (
          <div className="space-y-6">
            {layers.map((layer) => {
              const layerItems = filtered.filter((i) => i.layer === layer);
              return (
                <LayerGroup
                  key={layer}
                  layer={layer}
                  items={layerItems}
                  overrides={overrides}
                  overrideMap={overrideMap}
                  onOverride={(id) => setOverrideTarget(id)}
                  onUndoOverride={onUndoOverride}
                  adContent={adContent}
                  checkId={checkId}
                  acceptedRewrites={acceptedRewrites}
                  onAcceptRewrite={onAcceptRewrite}
                  onUndoRewrite={onUndoRewrite}
                />
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
