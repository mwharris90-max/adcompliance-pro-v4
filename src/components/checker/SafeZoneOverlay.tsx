"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Safe zone data sourced from seeded ChannelRequirements
const SAFE_ZONES: Record<
  string,
  { topPct: number; bottomPct: number; color: string; label: string }
> = {
  instagram: { topPct: 14, bottomPct: 20, color: "#E1306C", label: "Instagram" },
  facebook: { topPct: 14, bottomPct: 20, color: "#1877F2", label: "Facebook" },
  "google-ads": { topPct: 0, bottomPct: 0, color: "#4285F4", label: "Google Ads" },
};

interface SafeZoneEntry {
  topPct: number;
  bottomPct: number;
  color: string;
  label: string;
}

function getZonesForSlugs(slugs: string[]): SafeZoneEntry[] {
  const seen = new Set<string>();
  const zones: SafeZoneEntry[] = [];
  for (const slug of slugs) {
    const key = Object.keys(SAFE_ZONES).find((k) => slug.toLowerCase().includes(k));
    if (key && !seen.has(key) && (SAFE_ZONES[key].topPct > 0 || SAFE_ZONES[key].bottomPct > 0)) {
      seen.add(key);
      zones.push(SAFE_ZONES[key]);
    }
  }
  return zones;
}

interface SafeZoneOverlayProps {
  /** URL of the image to display */
  imageUrl: string;
  /** Alt text for the image */
  alt?: string;
  /** Platform slugs to determine which safe zones to draw */
  platformSlugs: string[];
  className?: string;
}

export function SafeZoneOverlay({
  imageUrl,
  alt = "Uploaded asset",
  platformSlugs,
  className,
}: SafeZoneOverlayProps) {
  const [showZones, setShowZones] = useState(false);
  const zones = getZonesForSlugs(platformSlugs);

  return (
    <div className={cn("space-y-2", className)}>
      {/* Image with SVG overlay */}
      <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={alt}
          className="block w-full object-contain"
        />

        {/* Safe zone overlays */}
        {showZones && zones.length > 0 && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {zones.map((zone, i) => (
              <g key={i}>
                {/* Top unsafe zone */}
                {zone.topPct > 0 && (
                  <rect
                    x="0"
                    y="0"
                    width="100"
                    height={zone.topPct}
                    fill={zone.color}
                    fillOpacity="0.25"
                  />
                )}
                {/* Bottom unsafe zone */}
                {zone.bottomPct > 0 && (
                  <rect
                    x="0"
                    y={100 - zone.bottomPct}
                    width="100"
                    height={zone.bottomPct}
                    fill={zone.color}
                    fillOpacity="0.25"
                  />
                )}
              </g>
            ))}

            {/* Platform labels on the zones */}
            {zones.map((zone, i) => (
              <g key={`label-${i}`}>
                {zone.topPct > 0 && (
                  <text
                    x="2"
                    y={zone.topPct / 2 + 1.5}
                    fill={zone.color}
                    fontSize="4"
                    fontFamily="system-ui, sans-serif"
                    fontWeight="600"
                    fillOpacity="0.9"
                  >
                    {zone.label} UI zone
                  </text>
                )}
                {zone.bottomPct > 0 && (
                  <text
                    x="2"
                    y={100 - zone.bottomPct / 2 + 1.5}
                    fill={zone.color}
                    fontSize="4"
                    fontFamily="system-ui, sans-serif"
                    fontWeight="600"
                    fillOpacity="0.9"
                  >
                    {zone.label} UI zone
                  </text>
                )}
              </g>
            ))}

            {/* Safe zone border lines */}
            {zones.map((zone, i) => (
              <g key={`border-${i}`}>
                {zone.topPct > 0 && (
                  <line
                    x1="0"
                    y1={zone.topPct}
                    x2="100"
                    y2={zone.topPct}
                    stroke={zone.color}
                    strokeWidth="0.5"
                    strokeDasharray="2,1"
                    strokeOpacity="0.8"
                  />
                )}
                {zone.bottomPct > 0 && (
                  <line
                    x1="0"
                    y1={100 - zone.bottomPct}
                    x2="100"
                    y2={100 - zone.bottomPct}
                    stroke={zone.color}
                    strokeWidth="0.5"
                    strokeDasharray="2,1"
                    strokeOpacity="0.8"
                  />
                )}
              </g>
            ))}
          </svg>
        )}
      </div>

      {/* Toggle button + legend */}
      {zones.length > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowZones((v) => !v)}
            className="h-7 text-xs text-slate-500 hover:text-slate-800"
          >
            {showZones ? (
              <EyeOff className="mr-1.5 h-3.5 w-3.5" />
            ) : (
              <Eye className="mr-1.5 h-3.5 w-3.5" />
            )}
            {showZones ? "Hide" : "Show"} safety zones
          </Button>

          {showZones && (
            <div className="flex items-center gap-3 flex-wrap">
              {zones.map((zone, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span
                    className="inline-block h-2.5 w-4 rounded-sm opacity-50"
                    style={{ backgroundColor: zone.color }}
                  />
                  {zone.label}: top {zone.topPct}%, bottom {zone.bottomPct}%
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
