"use client";

import { useState } from "react";
import { Wand2, Loader2, Check, Undo2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  detectRewriteableField,
  computeWordDiff,
  getOriginalText,
  fieldLabelFor,
} from "@/lib/rewrite-utils";
import type {
  ComplianceChecklistItem,
  AdContentPayload,
  AcceptedRewrite,
  RewriteableField,
} from "@/lib/ai/runComplianceCheck";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RewritePanelProps {
  item: ComplianceChecklistItem;
  adContent: AdContentPayload;
  checkId: string;
  acceptedRewrite?: AcceptedRewrite;
  onAccept: (rewrite: AcceptedRewrite) => void;
  onUndo: (itemId: string) => void;
}

type PanelState = "idle" | "loading" | "showing" | "error";

// ─── Word diff renderer ───────────────────────────────────────────────────────

function WordDiff({ original, revised }: { original: string; revised: string }) {
  const tokens = computeWordDiff(original, revised);

  return (
    <span className="font-mono text-sm leading-relaxed">
      {tokens.map((token, i) => {
        if (token.type === "remove") {
          return (
            <span
              key={i}
              className="bg-red-100 text-red-700 line-through decoration-red-400"
            >
              {token.text}
            </span>
          );
        }
        if (token.type === "add") {
          return (
            <span key={i} className="bg-green-100 text-green-700">
              {token.text}
            </span>
          );
        }
        return <span key={i}>{token.text}</span>;
      })}
    </span>
  );
}

// ─── RewritePanel ─────────────────────────────────────────────────────────────

export function RewritePanel({
  item,
  adContent,
  checkId,
  acceptedRewrite,
  onAccept,
  onUndo,
}: RewritePanelProps) {
  const [panelState, setPanelState] = useState<PanelState>("idle");
  const [rewrittenText, setRewrittenText] = useState<string>("");
  const [changesSummary, setChangesSummary] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Detect which field this item relates to
  const field = detectRewriteableField(item, adContent);

  // Don't render if we can't detect a field, or item already accepted
  if (!field) return null;

  const originalText = getOriginalText(field, adContent);
  const label = fieldLabelFor(field);

  // ── Accepted state ──────────────────────────────────────────────────────────
  if (acceptedRewrite) {
    return (
      <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
        <div className="flex items-center gap-2">
          <Check className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
          <span className="text-xs font-medium text-indigo-800">
            {label} amended — re-check to verify
          </span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onUndo(item.id);
          }}
          className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 hover:underline"
        >
          <Undo2 className="h-3 w-3" />
          Undo
        </button>
      </div>
    );
  }

  // ── Loading state ───────────────────────────────────────────────────────────
  if (panelState === "loading") {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400 shrink-0" />
        <span className="text-xs text-slate-500">Generating compliant copy…</span>
      </div>
    );
  }

  // ── Diff view state ─────────────────────────────────────────────────────────
  if (panelState === "showing") {
    return (
      <div
        className="mt-3 rounded-lg border border-slate-200 bg-white p-3 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Field label */}
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label} — suggested rewrite</p>

        {/* Word diff */}
        <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2.5">
          <WordDiff original={originalText} revised={rewrittenText} />
        </div>

        {/* Changes summary */}
        {changesSummary && (
          <p className="text-xs text-slate-600 leading-relaxed">{changesSummary}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 justify-end flex-wrap">
          <button
            type="button"
            onClick={() => setPanelState("idle")}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            Dismiss
          </button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 px-2"
            onClick={() => handleSuggest()}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
          <Button
            size="sm"
            className="text-xs h-7 px-3 bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={handleAccept}
          >
            <Check className="h-3 w-3 mr-1" />
            Accept change
          </Button>
        </div>
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (panelState === "error") {
    return (
      <div
        className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 space-y-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-red-700">{errorMessage}</p>
          <button
            type="button"
            onClick={() => setPanelState("idle")}
            className="text-red-400 hover:text-red-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="text-xs h-7 px-2 border-red-200 text-red-600 hover:bg-red-100"
          onClick={() => handleSuggest()}
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Try again
        </Button>
      </div>
    );
  }

  // ── Idle state ──────────────────────────────────────────────────────────────
  async function handleSuggest() {
    setPanelState("loading");
    setErrorMessage("");

    try {
      const res = await fetch(`/api/compliance/${checkId}/rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, field }),
      });

      const json = await res.json();

      if (!res.ok) {
        const msg = json?.error?.message ?? "Failed to generate suggestion.";
        setErrorMessage(msg);
        setPanelState("error");
        return;
      }

      setRewrittenText(json.data.rewrittenText);
      setChangesSummary(json.data.changesSummary);
      setPanelState("showing");
    } catch {
      setErrorMessage("Network error. Please try again.");
      setPanelState("error");
    }
  }

  function handleAccept() {
    onAccept({
      itemId: item.id,
      field: field as RewriteableField,
      originalText,
      newText: rewrittenText,
      acceptedAt: new Date().toISOString(),
    });
  }

  return (
    <div className="mt-3 flex items-center justify-end">
      <Button
        size="sm"
        variant="outline"
        className="text-xs h-7 px-2.5 border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300"
        onClick={(e) => {
          e.stopPropagation();
          handleSuggest();
        }}
      >
        <Wand2 className="h-3 w-3 mr-1.5" />
        Suggest fix
      </Button>
    </div>
  );
}

// ─── Amended chip (for collapsed row header) ──────────────────────────────────

export function AmendedChip() {
  return (
    <Badge
      variant="outline"
      className="text-xs shrink-0 bg-indigo-50 text-indigo-700 border-indigo-200"
    >
      Amended
    </Badge>
  );
}
