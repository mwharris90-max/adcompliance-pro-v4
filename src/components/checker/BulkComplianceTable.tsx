"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Filter,
  Download,
  ChevronDown,
  ChevronRight,
  Copy,
  Wand2,
  Pencil,
  Check,
  X,
  Info,
  Ban,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ComplianceChecklistItem } from "@/lib/ai/runComplianceCheck";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BulkRowResult {
  rowIndex: number;
  adContent: Record<string, string>;
  rawCsvRow: Record<string, string>;
  overallStatus: "CLEAN" | "WARNINGS" | "VIOLATIONS" | "ERROR" | "PENDING" | "PROCESSING" | null;
  results: {
    checklist?: ComplianceChecklistItem[];
    issues?: Array<{
      severity: string;
      field: string;
      title: string;
      explanation: string;
      suggestion?: string;
      applicablePlatforms?: string[];
      applicableCountries?: string[];
      ruleReference?: { source: string; url?: string; ruleText: string };
      // Legacy compat
      message?: string;
    }>;
    summary?: string;
  } | null;
  isDuplicate: boolean;
  editedContent?: Record<string, string> | null;
  detectedCategoryId?: string | null;
  detectedCategoryName?: string | null;
  overrideCategoryIds?: string[] | null;
  /** DB row ID for API calls */
  bulkRowId?: string | null;
  bulkJobId?: string | null;
}

/** An issue mapped to a specific ad content field (or "general" if unmapped) */
interface FieldIssue {
  field: string;
  itemId?: string;
  title: string;
  explanation: string;
  suggestion: string;
  severity: "warning" | "violation";
  quotedContent?: string;
  ruleReference?: { source: string; url?: string; ruleText: string };
  applicablePlatforms?: string[];
}

export interface CategoryOption {
  id: string;
  name: string;
  restrictionLevel?: "allowed" | "restricted" | "prohibited";
}

interface BulkComplianceTableProps {
  rows: BulkRowResult[];
  processing: boolean;
  processedCount: number;
  totalUniqueRows: number;
  summary: { passCount: number; warningCount: number; failCount: number; errorCount: number } | null;
  onEditCell: (rowIndex: number, field: string, value: string) => void;
  onRowUpdated?: (rowIndex: number, result: BulkRowResult["results"], overallStatus: BulkRowResult["overallStatus"]) => void;
  onCategoryChange?: (rowIndex: number, categoryId: string, categoryName: string) => void;
  onCategoryOverrideAcknowledged?: (
    rowIndex: number,
    originalCatId: string,
    originalCatName: string,
    newCatId: string,
    newCatName: string,
    restrictionLevel: string,
    acknowledgement: string
  ) => void;
  onDownloadCsv: () => void;
  platformIds?: string[];
  categoryIds?: string[];
  countryIds?: string[];
  availableCategories?: CategoryOption[];
}

type FilterStatus = "all" | "VIOLATIONS" | "WARNINGS" | "CLEAN" | "duplicates";

const STATUS_CONFIG = {
  CLEAN: { icon: CheckCircle2, label: "Clean", colour: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  WARNINGS: { icon: AlertTriangle, label: "Warnings", colour: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
  VIOLATIONS: { icon: XCircle, label: "Violations", colour: "text-red-600", bg: "bg-red-50 border-red-200" },
  ERROR: { icon: XCircle, label: "Error", colour: "text-slate-500", bg: "bg-slate-50 border-slate-200" },
  PENDING: { icon: Loader2, label: "Pending", colour: "text-slate-400", bg: "bg-slate-50 border-slate-200" },
  PROCESSING: { icon: Loader2, label: "Checking...", colour: "text-blue-500", bg: "bg-blue-50 border-blue-200" },
};

const FIELD_ORDER = [
  "headline1", "headline2", "headline3", "headline4", "headline5",
  "headline6", "headline7", "headline8", "headline9", "headline10",
  "headline11", "headline12", "headline13", "headline14", "headline15",
  "description1", "description2", "description3", "description4",
  "path1", "path2", "finalUrl",
];

const FIELD_LABELS: Record<string, string> = {
  headline1: "H1", headline2: "H2", headline3: "H3", headline4: "H4", headline5: "H5",
  headline6: "H6", headline7: "H7", headline8: "H8", headline9: "H9", headline10: "H10",
  headline11: "H11", headline12: "H12", headline13: "H13", headline14: "H14", headline15: "H15",
  description1: "D1", description2: "D2", description3: "D3", description4: "D4",
  path1: "Path 1", path2: "Path 2", finalUrl: "URL",
};

const FIELD_FULL_LABELS: Record<string, string> = {
  headline1: "Headline 1", headline2: "Headline 2", headline3: "Headline 3",
  headline4: "Headline 4", headline5: "Headline 5", headline6: "Headline 6",
  headline7: "Headline 7", headline8: "Headline 8", headline9: "Headline 9",
  headline10: "Headline 10", headline11: "Headline 11", headline12: "Headline 12",
  headline13: "Headline 13", headline14: "Headline 14", headline15: "Headline 15",
  description1: "Description 1", description2: "Description 2",
  description3: "Description 3", description4: "Description 4",
  path1: "Path 1", path2: "Path 2", finalUrl: "Final URL",
};

// ─── Field matching ─────────────────────────────────────────────────────────

/**
 * Maps issues to specific ad content fields by matching quotedContent against
 * actual field values. Falls back to parsing the title/explanation for field
 * names like "Headline 1", "Description 2", etc.
 */
function mapIssuesToFields(
  row: BulkRowResult,
  fieldsInUse: string[]
): { fieldIssues: Map<string, FieldIssue[]>; generalIssues: FieldIssue[] } {
  const fieldIssues = new Map<string, FieldIssue[]>();
  const generalIssues: FieldIssue[] = [];

  // Build issues from checklist (richer data) if available, otherwise from issues array
  const rawIssues: FieldIssue[] = [];

  if (row.results?.checklist) {
    for (const item of row.results.checklist) {
      if (item.status === "PASS") continue;
      rawIssues.push({
        field: "",
        itemId: item.id,
        title: item.ruleTitle,
        explanation: item.explanation,
        suggestion: item.suggestion ?? "Review and amend your content to comply with this rule.",
        severity: item.status === "FAIL" ? "violation" : "warning",
        quotedContent: item.quotedContent,
        ruleReference: item.ruleReference,
        applicablePlatforms: item.applicablePlatforms,
      });
    }
  } else if (row.results?.issues) {
    for (const issue of row.results.issues) {
      rawIssues.push({
        field: issue.field,
        title: issue.title || issue.message || "Compliance issue",
        explanation: issue.explanation || issue.message || "",
        suggestion: issue.suggestion ?? "Review and amend your content to comply with this rule.",
        severity: issue.severity === "violation" || issue.severity === "FAIL" ? "violation" : "warning",
        ruleReference: issue.ruleReference,
        applicablePlatforms: issue.applicablePlatforms,
      });
    }
  }

  // Try to match each issue to a specific field
  for (const issue of rawIssues) {
    let matchedField: string | null = null;

    // Method 0: Parse the structured checklist item ID (most reliable for technical checks)
    // IDs like "technical:headline_char_limit:platformId:0" → headline1
    // IDs like "technical:description_char_limit:platformId:1" → description2
    // IDs like "technical:display_url_char_limit:platformId" → path1
    if (issue.itemId) {
      const parts = issue.itemId.split(":");
      if (parts[0] === "technical") {
        const specKey = parts[1];
        const idx = parts.length >= 4 ? parseInt(parts[3]) : -1;
        if (specKey === "headline_char_limit" && idx >= 0) {
          const candidate = `headline${idx + 1}`;
          if (fieldsInUse.includes(candidate)) matchedField = candidate;
        } else if (specKey === "description_char_limit" && idx >= 0) {
          const candidate = `description${idx + 1}`;
          if (fieldsInUse.includes(candidate)) matchedField = candidate;
        } else if (specKey === "display_url_char_limit") {
          if (fieldsInUse.includes("path1")) matchedField = "path1";
          else if (fieldsInUse.includes("finalUrl")) matchedField = "finalUrl";
        } else if (specKey === "primary_text_char_limit") {
          if (fieldsInUse.includes("description1")) matchedField = "description1";
        }
      }
    }

    // Method 1: Parse title/explanation for field references like "Headline 1", "Description 2"
    if (!matchedField) {
      const textToSearch = `${issue.title} ${issue.explanation}`.toLowerCase();
      for (const field of fieldsInUse) {
        const fullLabel = FIELD_FULL_LABELS[field];
        if (fullLabel && textToSearch.includes(fullLabel.toLowerCase())) {
          matchedField = field;
          break;
        }
      }
    }

    // Method 2: Match quotedContent against field values (exact or high-overlap only)
    if (!matchedField && issue.quotedContent && issue.quotedContent.length > 0) {
      const quoted = issue.quotedContent.replace(/…$/, ""); // strip trailing ellipsis
      let bestField: string | null = null;
      let bestOverlap = 0;

      for (const field of fieldsInUse) {
        const val = row.editedContent?.[field] ?? row.adContent[field];
        if (val && val.length > 0) {
          // Exact containment: field value contains the quoted text
          if (val.includes(quoted)) {
            const overlap = quoted.length / val.length;
            if (overlap > bestOverlap) {
              bestOverlap = overlap;
              bestField = field;
            }
          }
          // Reverse: quoted text contains the field value — only if high overlap
          else if (quoted.includes(val) && val.length / quoted.length > 0.5) {
            const overlap = val.length / quoted.length;
            if (overlap > bestOverlap) {
              bestOverlap = overlap;
              bestField = field;
            }
          }
        }
      }
      matchedField = bestField;
    }

    if (matchedField) {
      issue.field = matchedField;
      const existing = fieldIssues.get(matchedField) ?? [];
      existing.push(issue);
      fieldIssues.set(matchedField, existing);
    } else {
      generalIssues.push(issue);
    }
  }

  return { fieldIssues, generalIssues };
}

// ─── Editable Cell ──────────────────────────────────────────────────────────

function EditableCell({
  value,
  issues,
  isEdited,
  onSave,
}: {
  value: string;
  issues: FieldIssue[];
  isEdited: boolean;
  onSave: (newValue: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const hasViolation = issues.some((i) => i.severity === "violation");
  const hasWarning = issues.some((i) => i.severity === "warning");

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(value);
    setEditing(true);
  }, [value]);

  const handleSave = useCallback(() => {
    if (draft !== value) onSave(draft);
    setEditing(false);
  }, [draft, value, onSave]);

  const handleCancel = useCallback(() => {
    setDraft(value);
    setEditing(false);
  }, [value]);

  if (editing) {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") handleCancel();
          }}
          className="w-full text-xs border border-blue-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
          autoFocus
        />
        <button onClick={handleSave} className="text-emerald-500 hover:text-emerald-700">
          <Check className="h-3.5 w-3.5" />
        </button>
        <button onClick={handleCancel} className="text-slate-400 hover:text-slate-600">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      onDoubleClick={handleDoubleClick}
      className={cn(
        "px-3 py-2 text-xs max-w-[200px] truncate cursor-text group relative",
        hasViolation && !isEdited && "bg-red-50 border-l-2 border-l-red-400",
        hasWarning && !hasViolation && !isEdited && "bg-amber-50 border-l-2 border-l-amber-400",
        isEdited && "bg-blue-50 border-l-2 border-l-blue-400"
      )}
      title={`${value}${issues.length > 0 ? `\n\n${issues.length} issue${issues.length !== 1 ? "s" : ""} found` : ""}\n\nDouble-click to edit`}
    >
      <span className="flex items-center gap-1">
        {value || <span className="text-slate-300">—</span>}
        {issues.length > 0 && !isEdited && (
          <span className="shrink-0">
            {hasViolation ? (
              <XCircle className="h-3 w-3 text-red-400" />
            ) : (
              <AlertTriangle className="h-3 w-3 text-amber-400" />
            )}
          </span>
        )}
      </span>
      {value && (
        <Pencil className="h-3 w-3 text-slate-300 absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </div>
  );
}

// ─── Issue Detail Card ──────────────────────────────────────────────────────

function IssueCard({
  issue,
  onSuggestFix,
  suggestedFix,
  onAcceptFix,
  onDismissFix,
  fixing,
  canFix,
}: {
  issue: FieldIssue;
  onSuggestFix: () => void;
  suggestedFix?: string;
  onAcceptFix: () => void;
  onDismissFix: () => void;
  fixing: boolean;
  canFix: boolean;
}) {
  const isViolation = issue.severity === "violation";

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5 text-xs",
        isViolation ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
      )}
    >
      {/* Header: severity + title */}
      <div className="flex items-start gap-2">
        {isViolation ? (
          <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          {/* Field + severity badge */}
          <div className="flex items-center gap-2 mb-1">
            {issue.field && issue.field !== "category" && issue.field !== "headline" && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                {FIELD_FULL_LABELS[issue.field] ?? issue.field}
              </Badge>
            )}
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0",
                isViolation ? "border-red-300 text-red-700" : "border-amber-300 text-amber-700"
              )}
            >
              {isViolation ? "Violation" : "Warning"}
            </Badge>
            {issue.applicablePlatforms && issue.applicablePlatforms.length > 0 && (
              <span className="text-[10px] text-slate-400">
                {issue.applicablePlatforms.join(", ")}
              </span>
            )}
          </div>

          {/* Title */}
          <p className={cn(
            "font-semibold mb-1",
            isViolation ? "text-red-800" : "text-amber-800"
          )}>
            {issue.title}
          </p>

          {/* Explanation */}
          <p className="text-slate-600 mb-1.5 leading-relaxed">{issue.explanation}</p>

          {/* Quoted content */}
          {issue.quotedContent && (
            <div className="rounded bg-white/60 border border-slate-200 px-2 py-1 mb-1.5 font-mono text-[11px] text-slate-700">
              &ldquo;{issue.quotedContent}&rdquo;
            </div>
          )}

          {/* Suggestion */}
          {issue.suggestion && (
            <div className="flex items-start gap-1.5 mb-1">
              <Info className="h-3 w-3 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-blue-700">{issue.suggestion}</p>
            </div>
          )}

          {/* Rule reference */}
          {issue.ruleReference && (
            <p className="text-[10px] text-slate-400 mt-1">
              Source: {issue.ruleReference.source}
              {issue.ruleReference.url && (
                <>
                  {" — "}
                  <a href={issue.ruleReference.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">
                    View rule
                  </a>
                </>
              )}
            </p>
          )}

          {/* Suggest fix button — inline below suggestion */}
          {canFix && !suggestedFix && (
            <button
              onClick={(e) => { e.stopPropagation(); onSuggestFix(); }}
              disabled={fixing}
              className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-[#1A56DB] hover:text-[#1A56DB]/80"
            >
              {fixing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wand2 className="h-3.5 w-3.5" />
              )}
              Suggest Fix
            </button>
          )}

          {/* Suggested fix from AI */}
          {suggestedFix && (
            <div className="mt-2 rounded border border-emerald-200 bg-emerald-50 px-2 py-1.5">
              <p className="text-[10px] font-semibold text-emerald-700 mb-1">AI suggested fix:</p>
              <p className="text-xs text-emerald-800">{suggestedFix}</p>
              <div className="flex gap-2 mt-1.5">
                <button
                  onClick={(e) => { e.stopPropagation(); onAcceptFix(); }}
                  className="flex items-center gap-1 text-[10px] font-medium text-emerald-700 hover:text-emerald-900"
                >
                  <Check className="h-3 w-3" /> Accept
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDismissFix(); }}
                  className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700"
                >
                  <X className="h-3 w-3" /> Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Category cell with icon display + override confirmation ────────────────

function CategoryCell({
  detectedCategoryId,
  detectedCategoryName,
  overrideCategoryIds,
  userCategoryIds,
  availableCategories,
  onCategoryChange,
  onCategoryOverrideAcknowledged,
}: {
  detectedCategoryId: string;
  detectedCategoryName: string;
  overrideCategoryIds?: string[] | null;
  userCategoryIds?: string[];
  availableCategories?: CategoryOption[];
  onCategoryChange?: (catId: string, catName: string) => void;
  onCategoryOverrideAcknowledged?: (
    originalCatId: string,
    originalCatName: string,
    newCatId: string,
    newCatName: string,
    restrictionLevel: string,
    acknowledgement: string
  ) => void;
}) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const activeCatId = overrideCategoryIds?.[0] ?? detectedCategoryId;
  const detectedCat = availableCategories?.find((c) => c.id === detectedCategoryId);
  const activeCat = availableCategories?.find((c) => c.id === activeCatId);
  const restriction = detectedCat?.restrictionLevel ?? "allowed";
  const matchesUserSelection = userCategoryIds?.includes(activeCatId) ?? false;
  const isOverridden = overrideCategoryIds && overrideCategoryIds.length > 0;

  // Determine icon and colour based on DETECTED category restriction (not active/override)
  let icon: React.ReactNode;
  let bgClass: string;
  let borderClass: string;

  if (restriction === "prohibited" && !isOverridden) {
    icon = <Ban className="h-3.5 w-3.5 text-red-600" />;
    bgClass = "bg-red-50";
    borderClass = "border-red-300";
  } else if (restriction === "restricted" && !isOverridden) {
    icon = <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />;
    bgClass = "bg-amber-50";
    borderClass = "border-amber-300";
  } else if (matchesUserSelection || isOverridden) {
    icon = <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
    bgClass = "bg-emerald-50";
    borderClass = "border-emerald-200";
  } else {
    icon = <Info className="h-3.5 w-3.5 text-blue-500" />;
    bgClass = "bg-blue-50";
    borderClass = "border-blue-200";
  }

  // Close popover on outside click
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
      setPopoverOpen(false);
      setShowCategoryPicker(false);
    }
  }, []);

  useEffect(() => {
    if (popoverOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [popoverOpen, handleClickOutside]);

  const handleAcknowledgeDismiss = () => {
    if (!detectedCat || !onCategoryOverrideAcknowledged) return;
    // User says "it's definitely not this prohibited/restricted category" → pick a replacement
    setShowCategoryPicker(true);
  };

  const handleCategorySelect = (cat: CategoryOption) => {
    const detectedRestriction = detectedCat?.restrictionLevel ?? "allowed";

    if (detectedRestriction === "prohibited" || detectedRestriction === "restricted") {
      const acknowledgement =
        detectedRestriction === "prohibited"
          ? `I confirm this ad is NOT in the "${detectedCategoryName}" (PROHIBITED) category. I accept responsibility if this ad is found to breach prohibition rules, which will very likely result in the ad being rejected.`
          : `I confirm this ad is NOT in the "${detectedCategoryName}" (RESTRICTED) category. I accept responsibility if this ad is found to breach restriction rules.`;

      onCategoryOverrideAcknowledged?.(
        detectedCategoryId,
        detectedCategoryName,
        cat.id,
        cat.name,
        detectedRestriction,
        acknowledgement
      );
    }

    onCategoryChange?.(cat.id, cat.name);
    setPopoverOpen(false);
    setShowCategoryPicker(false);
    setAcknowledged(false);
  };

  const handleSuggestedCategoryAccept = () => {
    // For non-prohibited mismatch — accept the AI-detected category
    if (detectedCat) {
      onCategoryChange?.(detectedCat.id, detectedCat.name);
    }
    setPopoverOpen(false);
  };

  // ── Popover content ──────────────────────────────────────────────────
  const renderPopover = () => {
    if (!popoverOpen) return null;

    // Category picker sub-view
    if (showCategoryPicker && availableCategories) {
      return (
        <div
          ref={popoverRef}
          className="absolute z-50 left-1/2 -translate-x-1/2 top-8 w-56 rounded-lg border border-slate-200 bg-white shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 border-b border-slate-100">
            <p className="text-[10px] font-semibold text-slate-700">Select the correct category</p>
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            {availableCategories
              .filter((c) => c.id !== detectedCategoryId)
              .map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategorySelect(cat)}
                  className="w-full text-left px-3 py-1.5 text-[10px] text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                >
                  <span className="truncate">{cat.name}</span>
                  {cat.restrictionLevel === "prohibited" && (
                    <span className="ml-1 text-[8px] font-bold text-red-500 shrink-0">PROHIBITED</span>
                  )}
                  {cat.restrictionLevel === "restricted" && (
                    <span className="ml-1 text-[8px] font-bold text-amber-500 shrink-0">RESTRICTED</span>
                  )}
                </button>
              ))}
          </div>
          <div className="px-3 py-2 border-t border-slate-100">
            <button
              onClick={() => setShowCategoryPicker(false)}
              className="text-[10px] text-slate-400 hover:text-slate-600"
            >
              &larr; Back
            </button>
          </div>
        </div>
      );
    }

    // Prohibited/restricted popover
    if ((restriction === "prohibited" || restriction === "restricted") && !isOverridden) {
      const isProhibited = restriction === "prohibited";
      return (
        <div
          ref={popoverRef}
          className={cn(
            "absolute z-50 left-1/2 -translate-x-1/2 top-8 w-72 rounded-lg border-2 bg-white shadow-xl p-3",
            isProhibited ? "border-red-300" : "border-amber-300"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-2 mb-2">
            <ShieldAlert className={cn("h-4 w-4 shrink-0 mt-0.5", isProhibited ? "text-red-500" : "text-amber-500")} />
            <div>
              <p className={cn("text-xs font-bold", isProhibited ? "text-red-800" : "text-amber-800")}>
                {isProhibited ? "Potentially Prohibited Category" : "Potentially Restricted Category"}
              </p>
              <p className="text-[10px] text-slate-600 mt-1">
                We think this ad may fall under{" "}
                <strong className={isProhibited ? "text-red-700" : "text-amber-700"}>
                  {detectedCategoryName}
                </strong>
                , which is {isProhibited ? "prohibited" : "restricted"} on certain platforms.
              </p>
            </div>
          </div>

          <div className={cn(
            "rounded-md border px-2.5 py-2 text-[10px] mb-3",
            isProhibited ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-700"
          )}>
            {isProhibited ? (
              <>
                Ads promoting prohibited products (e.g., prescription medicines to consumers) are <strong>very likely to be rejected</strong>.
                If this ad is not in this category, please confirm below.
              </>
            ) : (
              <>
                Ads in restricted categories may require additional certifications or approvals.
                If this ad is not in this category, please confirm below.
              </>
            )}
          </div>

          <label className="flex items-start gap-2 cursor-pointer group mb-3">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className={cn(
                "mt-0.5 h-3.5 w-3.5 rounded border-2 accent-current",
                isProhibited ? "accent-red-600" : "accent-amber-600"
              )}
            />
            <span className="text-[10px] text-slate-700 leading-tight">
              I confirm this ad is <strong>not</strong> in the{" "}
              <strong>{detectedCategoryName}</strong> category
            </span>
          </label>

          <div className="flex justify-end gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] px-2"
              onClick={() => { setPopoverOpen(false); setAcknowledged(false); }}
            >
              Dismiss
            </Button>
            <Button
              size="sm"
              disabled={!acknowledged}
              variant={isProhibited ? "destructive" : "default"}
              className={cn(
                "h-6 text-[10px] px-2",
                !isProhibited && acknowledged ? "bg-amber-600 hover:bg-amber-700 text-white" : ""
              )}
              onClick={handleAcknowledgeDismiss}
            >
              Override Category
            </Button>
          </div>
        </div>
      );
    }

    // Non-prohibited mismatch — AI suggests a different category
    if (!matchesUserSelection && !isOverridden) {
      return (
        <div
          ref={popoverRef}
          className="absolute z-50 left-1/2 -translate-x-1/2 top-8 w-64 rounded-lg border border-blue-200 bg-white shadow-xl p-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-2 mb-2">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
            <div>
              <p className="text-xs font-bold text-blue-800">Category Suggestion</p>
              <p className="text-[10px] text-slate-600 mt-1">
                We think this ad should be classified as{" "}
                <strong className="text-blue-700">{detectedCategoryName}</strong>{" "}
                instead. Would you like to update it for a more accurate compliance check?
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-1.5 mt-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] px-2"
              onClick={() => setPopoverOpen(false)}
            >
              Keep Current
            </Button>
            <Button
              size="sm"
              className="h-6 text-[10px] px-2"
              onClick={handleSuggestedCategoryAccept}
            >
              Use {detectedCategoryName}
            </Button>
          </div>
        </div>
      );
    }

    // Already overridden or matches — just show info
    return (
      <div
        ref={popoverRef}
        className="absolute z-50 left-1/2 -translate-x-1/2 top-8 w-52 rounded-lg border border-slate-200 bg-white shadow-xl p-3"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[10px] text-slate-600">
          <strong className="text-slate-800">{activeCat?.name ?? detectedCategoryName}</strong>
          {isOverridden && (
            <span className="block mt-1 text-emerald-600">
              Overridden from: {detectedCategoryName}
            </span>
          )}
        </p>
        {onCategoryChange && (
          <button
            onClick={() => setShowCategoryPicker(true)}
            className="mt-2 text-[10px] text-blue-500 hover:text-blue-700 underline"
          >
            Change category
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="relative inline-flex">
      <button
        onClick={(e) => { e.stopPropagation(); setPopoverOpen(!popoverOpen); }}
        className={cn(
          "inline-flex items-center justify-center h-6 w-6 rounded-full border transition-colors",
          bgClass, borderClass, "hover:opacity-80",
          (restriction === "prohibited" && !isOverridden) && "ring-2 ring-red-300 ring-offset-1 animate-pulse",
          (restriction === "restricted" && !isOverridden) && "ring-2 ring-amber-300 ring-offset-1 animate-pulse"
        )}
      >
        {icon}
      </button>
      {renderPopover()}
    </div>
  );
}

// ─── Row component ──────────────────────────────────────────────────────────

function BulkRow({
  row,
  fieldsInUse,
  onEditCell,
  onRowUpdated,
  onCategoryChange,
  onCategoryOverrideAcknowledged,
  platformIds,
  categoryIds,
  countryIds,
  availableCategories,
  showCategoryColumn,
}: {
  row: BulkRowResult;
  fieldsInUse: string[];
  onEditCell: (rowIndex: number, field: string, value: string) => void;
  onRowUpdated?: (rowIndex: number, result: BulkRowResult["results"], overallStatus: BulkRowResult["overallStatus"]) => void;
  onCategoryChange?: (rowIndex: number, categoryId: string, categoryName: string) => void;
  onCategoryOverrideAcknowledged?: (
    rowIndex: number,
    originalCatId: string,
    originalCatName: string,
    newCatId: string,
    newCatName: string,
    restrictionLevel: string,
    acknowledgement: string
  ) => void;
  platformIds?: string[];
  categoryIds?: string[];
  countryIds?: string[];
  availableCategories?: CategoryOption[];
  showCategoryColumn: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [fixingField, setFixingField] = useState<string | null>(null);
  const [suggestedFix, setSuggestedFix] = useState<Record<string, string>>({});
  const [rechecking, setRechecking] = useState(false);
  const recheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const status = row.overallStatus ?? "PENDING";
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.PENDING;
  const Icon = config.icon;

  // Determine restriction level for the row's active category
  const rowActiveCatId = row.overrideCategoryIds?.[0] ?? row.detectedCategoryId;
  const rowActiveCat = availableCategories?.find((c) => c.id === rowActiveCatId);
  const rowRestriction = rowActiveCat?.restrictionLevel ?? "allowed";

  // Map issues to specific fields
  const { fieldIssues, generalIssues } = useMemo(
    () => mapIssuesToFields(row, fieldsInUse),
    [row, fieldsInUse]
  );

  const totalIssues = useMemo(() => {
    let count = generalIssues.length;
    for (const issues of fieldIssues.values()) count += issues.length;
    return count;
  }, [fieldIssues, generalIssues]);

  const allIssues = useMemo(() => {
    const all: FieldIssue[] = [];
    // Field-specific issues first, grouped by field
    for (const field of fieldsInUse) {
      const issues = fieldIssues.get(field);
      if (issues) all.push(...issues);
    }
    // General issues last
    all.push(...generalIssues);
    return all;
  }, [fieldsInUse, fieldIssues, generalIssues]);

  const handleSuggestFix = useCallback(async (issue: FieldIssue) => {
    if (!platformIds?.length || !categoryIds?.length || !countryIds?.length) return;
    const field = issue.field;
    if (!field || field === "category" || field === "headline") return;

    const originalText = row.editedContent?.[field] ?? row.adContent[field] ?? "";
    if (!originalText) return;

    setFixingField(field);
    try {
      const res = await fetch("/api/compliance/rewrite-field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalText,
          fieldLabel: FIELD_FULL_LABELS[field] ?? field,
          issueTitle: issue.title,
          issueExplanation: issue.explanation,
          suggestion: issue.suggestion,
          platformIds,
          categoryIds,
          countryIds,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data?.rewrittenText) {
          setSuggestedFix((prev) => ({ ...prev, [field]: data.data.rewrittenText }));
        }
      }
    } catch { /* non-fatal */ }
    setFixingField(null);
  }, [row.adContent, row.editedContent, platformIds, categoryIds, countryIds]);

  // Recheck row after edit — debounced to avoid spamming during rapid edits
  // Uses the row's detected/override category so prohibition rules are preserved
  const triggerRecheck = useCallback((updatedContent: Record<string, string>) => {
    if (!platformIds?.length || !categoryIds?.length || !countryIds?.length) return;
    if (!onRowUpdated) return;

    // Use per-row detected category if available, otherwise fall back to campaign categories
    const rowCategoryIds = row.overrideCategoryIds?.length
      ? row.overrideCategoryIds
      : row.detectedCategoryId
        ? [row.detectedCategoryId]
        : categoryIds;

    if (recheckTimerRef.current) clearTimeout(recheckTimerRef.current);
    recheckTimerRef.current = setTimeout(async () => {
      setRechecking(true);
      try {
        const res = await fetch("/api/compliance/check/bulk/recheck-row", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            adContent: updatedContent,
            platformIds,
            categoryIds: rowCategoryIds,
            countryIds,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.result) {
            onRowUpdated(row.rowIndex, data.result, data.result.overallStatus);
          }
        }
      } catch { /* non-fatal */ }
      setRechecking(false);
    }, 800);
  }, [platformIds, categoryIds, countryIds, onRowUpdated, row.rowIndex, row.detectedCategoryId, row.overrideCategoryIds]);

  const handleEditAndRecheck = useCallback((field: string, value: string) => {
    onEditCell(row.rowIndex, field, value);
    // Build merged content with the edit applied
    const merged = { ...row.adContent, ...(row.editedContent ?? {}), [field]: value };
    triggerRecheck(merged);
  }, [onEditCell, row.rowIndex, row.adContent, row.editedContent, triggerRecheck]);

  const handleAcceptFix = useCallback((field: string) => {
    const fix = suggestedFix[field];
    if (fix) {
      handleEditAndRecheck(field, fix);
      setSuggestedFix((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }, [suggestedFix, handleEditAndRecheck]);

  return (
    <>
      <tr
        className={cn(
          "border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors",
          expanded && "bg-slate-50",
          status === "CLEAN" && !expanded && "bg-emerald-50/50"
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-3 py-2 text-xs text-slate-400 text-center w-10">
          {row.rowIndex + 1}
        </td>

        <td className="px-3 py-2 w-28">
          {rechecking ? (
            <div className="flex items-center gap-1.5 text-xs font-medium text-blue-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Rechecking...
            </div>
          ) : (
            <>
              <div className={cn("flex items-center gap-1.5 text-xs font-medium", config.colour)}>
                <Icon className={cn("h-3.5 w-3.5", status === "PROCESSING" && "animate-spin")} />
                {config.label}
                {row.isDuplicate && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0 ml-1">
                    <Copy className="h-2.5 w-2.5 mr-0.5" />dup
                  </Badge>
                )}
              </div>
              {totalIssues > 0 && (
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  {totalIssues} issue{totalIssues !== 1 ? "s" : ""}
                </span>
              )}
            </>
          )}
        </td>

        {showCategoryColumn && (
          <td className="px-2 py-1.5 w-10 text-center" onClick={(e) => e.stopPropagation()}>
            {row.detectedCategoryId ? (
              <CategoryCell
                detectedCategoryId={row.detectedCategoryId}
                detectedCategoryName={row.detectedCategoryName ?? ""}
                overrideCategoryIds={row.overrideCategoryIds}
                userCategoryIds={categoryIds}
                availableCategories={availableCategories}
                onCategoryChange={onCategoryChange ? (catId, catName) => onCategoryChange(row.rowIndex, catId, catName) : undefined}
                onCategoryOverrideAcknowledged={onCategoryOverrideAcknowledged
                  ? (origId, origName, newId, newName, level, ack) =>
                      onCategoryOverrideAcknowledged(row.rowIndex, origId, origName, newId, newName, level, ack)
                  : undefined}
              />
            ) : (
              <span className="text-[10px] text-slate-300">—</span>
            )}
          </td>
        )}

        {fieldsInUse.map((field) => {
          const value = row.editedContent?.[field] ?? row.adContent[field] ?? "";
          const issues = fieldIssues.get(field) ?? [];
          const isEdited = row.editedContent?.[field] !== undefined;

          return (
            <td key={field} className="p-0">
              <EditableCell
                value={value}
                issues={issues}
                isEdited={isEdited}
                onSave={(newValue) => handleEditAndRecheck(field, newValue)}
              />
            </td>
          );
        })}

        <td className="px-3 py-2 w-8">
          {(totalIssues > 0 || rowRestriction !== "allowed") && (
            expanded
              ? <ChevronDown className="h-4 w-4 text-slate-400" />
              : <ChevronRight className="h-4 w-4 text-slate-400" />
          )}
        </td>
      </tr>

      {expanded && (totalIssues > 0 || rowRestriction !== "allowed") && (
        <tr>
          <td colSpan={fieldsInUse.length + (showCategoryColumn ? 4 : 3)} className="px-6 py-3 bg-slate-50/80">
            <div className="space-y-2 max-w-2xl">
              {/* Prohibition/restriction warning banner */}
              {rowRestriction !== "allowed" && (
                <div className={cn(
                  "rounded-lg border-2 px-4 py-3 flex items-start gap-3",
                  rowRestriction === "prohibited"
                    ? "border-red-300 bg-red-50"
                    : "border-amber-300 bg-amber-50"
                )}>
                  <ShieldAlert className={cn(
                    "h-5 w-5 shrink-0 mt-0.5",
                    rowRestriction === "prohibited" ? "text-red-600" : "text-amber-600"
                  )} />
                  <div className="flex-1">
                    <p className={cn(
                      "text-xs font-bold mb-1",
                      rowRestriction === "prohibited" ? "text-red-800" : "text-amber-800"
                    )}>
                      {rowRestriction === "prohibited" ? "PROHIBITED CATEGORY DETECTED" : "RESTRICTED CATEGORY DETECTED"}
                    </p>
                    <p className={cn(
                      "text-xs leading-relaxed",
                      rowRestriction === "prohibited" ? "text-red-700" : "text-amber-700"
                    )}>
                      {rowRestriction === "prohibited" ? (
                        <>
                          AI has categorised this ad as <strong>{row.detectedCategoryName}</strong>, which is a{" "}
                          <strong>prohibited</strong> advertising category. Ads promoting prohibited products or services
                          (e.g., prescription medicines to consumers) are <strong>very likely to be rejected</strong> by
                          the advertising platform. If you believe this categorisation is incorrect, you can override it
                          by clicking the category icon — this will require acknowledgement and be recorded in the audit trail.
                        </>
                      ) : (
                        <>
                          AI has categorised this ad as <strong>{row.detectedCategoryName}</strong>, which is a{" "}
                          <strong>restricted</strong> advertising category. Additional compliance requirements may apply.
                          If you believe this categorisation is incorrect, you can override it by clicking the category icon.
                        </>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {totalIssues > 0 && (
              <p className="text-xs font-semibold text-slate-600 mb-2">
                {totalIssues} issue{totalIssues !== 1 ? "s" : ""} found in row {row.rowIndex + 1}:
              </p>
              )}

              {allIssues.map((issue, i) => {
                const canFix = !!(
                  issue.field &&
                  issue.field !== "category" &&
                  issue.field !== "headline" &&
                  row.adContent[issue.field]
                );

                return (
                  <IssueCard
                    key={i}
                    issue={issue}
                    onSuggestFix={() => handleSuggestFix(issue)}
                    suggestedFix={issue.field ? suggestedFix[issue.field] : undefined}
                    onAcceptFix={() => issue.field && handleAcceptFix(issue.field)}
                    onDismissFix={() => {
                      if (issue.field) {
                        setSuggestedFix((prev) => { const n = { ...prev }; delete n[issue.field]; return n; });
                      }
                    }}
                    fixing={fixingField === issue.field}
                    canFix={canFix}
                  />
                );
              })}

              {row.results?.summary && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[10px] font-semibold text-slate-500 mb-1">Summary</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{row.results.summary}</p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main table ─────────────────────────────────────────────────────────────

export function BulkComplianceTable({
  rows,
  processing,
  processedCount,
  totalUniqueRows,
  summary,
  onEditCell,
  onRowUpdated,
  onCategoryChange,
  onCategoryOverrideAcknowledged,
  onDownloadCsv,
  platformIds,
  categoryIds,
  countryIds,
  availableCategories,
}: BulkComplianceTableProps) {
  const [filter, setFilter] = useState<FilterStatus>("all");

  // Show category column if any row has a detected category
  const showCategoryColumn = useMemo(
    () => rows.some((r) => r.detectedCategoryName),
    [rows]
  );

  const fieldsInUse = useMemo(() => {
    const seen = new Set<string>();
    for (const row of rows) {
      for (const key of Object.keys(row.adContent)) {
        seen.add(key);
      }
    }
    return FIELD_ORDER.filter((f) => seen.has(f));
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "duplicates") return rows.filter((r) => r.isDuplicate);
    return rows.filter((r) => r.overallStatus === filter);
  }, [rows, filter]);

  const counts = useMemo(() => {
    const c = { CLEAN: 0, WARNINGS: 0, VIOLATIONS: 0, duplicates: 0 };
    for (const row of rows) {
      if (row.isDuplicate) c.duplicates++;
      if (row.overallStatus === "CLEAN") c.CLEAN++;
      else if (row.overallStatus === "WARNINGS") c.WARNINGS++;
      else if (row.overallStatus === "VIOLATIONS") c.VIOLATIONS++;
    }
    return c;
  }, [rows]);

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      {processing && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">
              Checking rows... {processedCount} / {totalUniqueRows}
            </span>
            <span className="text-slate-400">
              {totalUniqueRows > 0 ? Math.round((processedCount / totalUniqueRows) * 100) : 0}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#1A56DB] to-[#E4168A] transition-all duration-300"
              style={{ width: `${totalUniqueRows > 0 ? (processedCount / totalUniqueRows) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Summary bar */}
      {summary && !processing && (
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <span className="text-sm font-medium text-slate-700">Results:</span>
          <div className="flex items-center gap-1.5 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-emerald-700 font-medium">{summary.passCount} clean</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="text-amber-700 font-medium">{summary.warningCount} warnings</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <XCircle className="h-4 w-4 text-red-500" />
            <span className="text-red-700 font-medium">{summary.failCount} violations</span>
          </div>
          {summary.errorCount > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-slate-500">
              {summary.errorCount} errors
            </div>
          )}
          <div className="ml-auto">
            <Button variant="outline" size="sm" onClick={onDownloadCsv}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Download CSV
            </Button>
          </div>
        </div>
      )}

      {/* Editing hint */}
      {summary && !processing && (counts.VIOLATIONS > 0 || counts.WARNINGS > 0) && (
        <div className="flex items-center gap-2 text-xs text-slate-400 px-1">
          <Pencil className="h-3 w-3" />
          <span>Double-click any cell to edit. Click a row to expand and see detailed issues with AI fix suggestions.</span>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-slate-400" />
        {(
          [
            { key: "all", label: "All", count: rows.length },
            { key: "VIOLATIONS", label: "Violations", count: counts.VIOLATIONS },
            { key: "WARNINGS", label: "Warnings", count: counts.WARNINGS },
            { key: "CLEAN", label: "Clean", count: counts.CLEAN },
            { key: "duplicates", label: "Duplicates", count: counts.duplicates },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
              filter === tab.key
                ? "bg-[#1A56DB] text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            {tab.label}
            <span className={cn(
              "rounded-full px-1.5 text-[10px]",
              filter === tab.key ? "bg-white/20 text-white" : "bg-slate-200 text-slate-500"
            )}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase w-10">#</th>
              <th className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase w-28">Status</th>
              {showCategoryColumn && (
                <th className="px-2 py-2 text-[10px] font-semibold text-slate-500 uppercase w-10 text-center" title="AI-detected category. Green = matches campaign category. Orange = restricted. Red = prohibited. Click to change.">Cat</th>
              )}
              {fieldsInUse.map((field) => (
                <th key={field} className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase max-w-[200px]">
                  {FIELD_LABELS[field] ?? field}
                </th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <BulkRow
                key={row.rowIndex}
                row={row}
                fieldsInUse={fieldsInUse}
                onEditCell={onEditCell}
                onRowUpdated={onRowUpdated}
                onCategoryChange={onCategoryChange}
                onCategoryOverrideAcknowledged={onCategoryOverrideAcknowledged}
                platformIds={platformIds}
                categoryIds={categoryIds}
                countryIds={countryIds}
                availableCategories={availableCategories}
                showCategoryColumn={showCategoryColumn}
              />
            ))}
          </tbody>
        </table>

        {filteredRows.length === 0 && (
          <div className="flex items-center justify-center py-8 text-sm text-slate-400">
            No rows match this filter.
          </div>
        )}
      </div>
    </div>
  );
}
