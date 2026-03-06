"use client";

import { useState } from "react";
import { AlertTriangle, XCircle, Eye, EyeOff, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SafeZoneOverlay } from "@/components/checker/SafeZoneOverlay";
import type { ImageZone, ZonePosition } from "@/lib/ai/runImageAnalysis";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImageCompliancePanelProps {
  imageUrl: string;
  alt: string;
  platformSlugs: string[];
  zones: ImageZone[];
  detectedText?: string;
  imageDescription?: string;
  confidence?: number;
}

// ─── Zone position → CSS classes ─────────────────────────────────────────────

const ZONE_CSS: Record<ZonePosition, string> = {
  "top-left":      "top-2 left-2",
  "top-center":    "top-2 left-1/2 -translate-x-1/2",
  "top-right":     "top-2 right-2",
  "middle-left":   "top-1/2 left-2 -translate-y-1/2",
  "center":        "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
  "middle-right":  "top-1/2 right-2 -translate-y-1/2",
  "bottom-left":   "bottom-2 left-2",
  "bottom-center": "bottom-2 left-1/2 -translate-x-1/2",
  "bottom-right":  "bottom-2 right-2",
};

// ─── Single zone badge ────────────────────────────────────────────────────────

function ZoneBadge({
  zone,
  index,
}: {
  zone: ImageZone;
  index: number;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const posClass = ZONE_CSS[zone.position];
  const isWarn = zone.severity === "WARNING";

  return (
    <div
      className={cn("absolute z-10", posClass)}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Badge */}
      <div
        className={cn(
          "flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-xs font-bold text-white shadow-md",
          isWarn ? "bg-amber-500" : "bg-red-500"
        )}
      >
        {index + 1}
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div
          className={cn(
            "absolute z-20 w-52 rounded-lg border p-2.5 shadow-lg text-xs",
            isWarn
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-red-200 bg-red-50 text-red-900",
            // Position tooltip away from edges
            zone.position.includes("right") ? "right-8 top-0" : "left-8 top-0"
          )}
        >
          <div className="flex items-center gap-1.5 mb-1">
            {isWarn ? (
              <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
            ) : (
              <XCircle className="h-3 w-3 text-red-500 shrink-0" />
            )}
            <span className="font-semibold leading-tight">{zone.issueTitle}</span>
          </div>
          <p className="leading-snug text-xs opacity-80">{zone.issueDescription}</p>
          {zone.ruleReference && (
            <p className="mt-1 text-xs italic opacity-60">{zone.ruleReference}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ImageCompliancePanel({
  imageUrl,
  alt,
  platformSlugs,
  zones,
  detectedText,
  imageDescription,
  confidence,
}: ImageCompliancePanelProps) {
  const [showZoneBadges, setShowZoneBadges] = useState(true);
  const hasZones = zones.length > 0;
  const lowConfidence = confidence !== undefined && confidence < 0.7;

  // Derive highlight border from worst severity
  const hasFailZone = zones.some((z) => z.severity === "FAIL");
  const hasWarnZone = zones.some((z) => z.severity === "WARNING");

  return (
    <div className="space-y-2">
      {/* Image + zone badge overlays */}
      <div
        className={cn(
          "relative overflow-hidden rounded-lg border bg-slate-100",
          hasFailZone ? "border-red-300" : hasWarnZone ? "border-amber-300" : "border-slate-200"
        )}
      >
        {/* Base image via SafeZoneOverlay (handles safe-zone rendering) */}
        <SafeZoneOverlay imageUrl={imageUrl} alt={alt} platformSlugs={platformSlugs} />

        {/* Zone badge overlays */}
        {showZoneBadges &&
          zones.map((zone, i) => (
            <ZoneBadge key={i} zone={zone} index={i} />
          ))}
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Low-confidence badge */}
          {lowConfidence && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              <AlertTriangle className="h-3 w-3" />
              Limited confidence ({Math.round((confidence ?? 0) * 100)}%)
            </span>
          )}
          {/* Detected text pill */}
          {detectedText && detectedText.trim() && (
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
              <FileText className="h-3 w-3" />
              Text detected in image
            </span>
          )}
        </div>

        {/* Toggle zone badges */}
        {hasZones && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowZoneBadges((v) => !v)}
            className="h-7 text-xs text-slate-500 hover:text-slate-800"
          >
            {showZoneBadges ? (
              <EyeOff className="mr-1.5 h-3.5 w-3.5" />
            ) : (
              <Eye className="mr-1.5 h-3.5 w-3.5" />
            )}
            {showZoneBadges ? "Hide" : "Show"} issues ({zones.length})
          </Button>
        )}
      </div>

      {/* Zone legend */}
      {hasZones && showZoneBadges && (
        <div className="space-y-1">
          {zones.map((zone, i) => (
            <div
              key={i}
              className={cn(
                "flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-xs",
                zone.severity === "FAIL"
                  ? "border-red-100 bg-red-50/60 text-red-800"
                  : "border-amber-100 bg-amber-50/60 text-amber-800"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
                  zone.severity === "FAIL" ? "bg-red-500" : "bg-amber-500"
                )}
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <span className="font-medium">{zone.issueTitle}</span>
                <span className="ml-1 opacity-70">— {zone.issueDescription}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image description (collapsed) */}
      {imageDescription && (
        <p className="text-xs text-slate-400 line-clamp-2 px-0.5">{imageDescription}</p>
      )}
    </div>
  );
}
