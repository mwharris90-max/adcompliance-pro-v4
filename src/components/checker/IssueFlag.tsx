"use client";

import { AlertTriangle, ExternalLink, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ComplianceIssue } from "@/lib/ai/runComplianceCheck";

interface IssueFlagProps {
  issues: ComplianceIssue[];
  children: React.ReactNode;
  /** Where to anchor the tooltip relative to the trigger icon */
  side?: "top" | "bottom" | "left" | "right";
}

function IssueTooltipContent({ issues }: { issues: ComplianceIssue[] }) {
  return (
    <div className="w-80 max-h-96 overflow-y-auto divide-y divide-slate-100">
      {issues.map((issue, i) => {
        const isViolation = issue.severity === "violation";
        return (
          <div key={i} className="p-3 space-y-2">
            {/* Title row */}
            <div className="flex items-start gap-2">
              <div className="mt-0.5 shrink-0">
                {isViolation ? (
                  <XCircle className="h-3.5 w-3.5 text-red-500" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                )}
              </div>
              <p
                className={cn(
                  "text-xs font-semibold leading-snug",
                  isViolation ? "text-red-700" : "text-amber-700"
                )}
              >
                {issue.title}
              </p>
            </div>

            {/* Explanation */}
            <p className="text-xs text-slate-600 leading-relaxed pl-5">
              {issue.explanation}
            </p>

            {/* Source links */}
            {issue.ruleReference && (
              <div className="pl-5 space-y-0.5">
                {issue.ruleReference.url ? (
                  <a
                    href={issue.ruleReference.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-xs text-blue-600 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {issue.ruleReference.source}
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                ) : (
                  <span className="text-xs text-slate-400">
                    Source: {issue.ruleReference.source}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function IssueFlag({
  issues,
  children,
  side = "top",
}: IssueFlagProps) {
  // No issues — render children transparently
  if (!issues.length) return <>{children}</>;

  const hasViolation = issues.some((i) => i.severity === "violation");

  return (
    <div className="relative">
      {children}

      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`${issues.length} compliance issue${issues.length !== 1 ? "s" : ""}`}
              className={cn(
                "absolute -top-2 -right-2 z-10 flex h-5 w-5 items-center justify-center rounded-full shadow-md transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2",
                hasViolation
                  ? "bg-red-500 focus-visible:ring-red-400"
                  : "bg-amber-400 focus-visible:ring-amber-300"
              )}
            >
              {hasViolation ? (
                <XCircle className="h-3.5 w-3.5 text-white" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 text-white" />
              )}
              {issues.length > 1 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-900 text-white text-[9px] font-bold leading-none">
                  {issues.length}
                </span>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent
            side={side}
            sideOffset={8}
            className="p-0 bg-white text-slate-900 border border-slate-200 shadow-xl"
          >
            <IssueTooltipContent issues={issues} />
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
