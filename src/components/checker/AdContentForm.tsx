"use client";

import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { Platform } from "./ChannelSelector";

export interface AdContent {
  headline: string;
  body: string;
  callToAction: string;
  // Google Ads specific
  googleHeadlines: string[];
  googleDescriptions: string[];
  displayUrl: string;
}

export function defaultAdContent(): AdContent {
  return {
    headline: "",
    body: "",
    callToAction: "",
    googleHeadlines: ["", "", ""],
    googleDescriptions: ["", ""],
    displayUrl: "",
  };
}

/** Character limits by platform slug fragment */
const PLATFORM_LIMITS: Record<string, { headline: number; body: number }> = {
  google: { headline: 30, body: 90 },
  instagram: { headline: 125, body: 2200 },
  facebook: { headline: 255, body: 500 },
};

function getLimit(
  selectedPlatformData: Platform[],
  field: "headline" | "body"
): { limit: number; label: string } {
  if (!selectedPlatformData.length) {
    return { limit: field === "headline" ? 255 : 2200, label: "" };
  }

  let minLimit = Infinity;
  let minPlatformName = "";

  for (const platform of selectedPlatformData) {
    const entry = Object.entries(PLATFORM_LIMITS).find(([key]) =>
      platform.slug.toLowerCase().includes(key)
    );
    if (entry) {
      const limit = entry[1][field];
      if (limit < minLimit) {
        minLimit = limit;
        minPlatformName = platform.name;
      }
    }
  }

  if (minLimit === Infinity) {
    return { limit: field === "headline" ? 255 : 2200, label: "" };
  }
  return { limit: minLimit, label: minPlatformName };
}

function CharCounter({
  current,
  limit,
}: {
  current: number;
  limit: number;
}) {
  const pct = limit > 0 ? current / limit : 0;
  return (
    <span
      className={cn(
        "text-xs tabular-nums",
        pct > 1
          ? "text-red-500 font-medium"
          : pct >= 0.9
          ? "text-amber-500"
          : "text-slate-400"
      )}
    >
      {current}/{limit}
    </span>
  );
}

interface AdContentFormProps {
  selectedPlatformData: Platform[];
  adContent: AdContent;
  onChange: (content: AdContent) => void;
}

function isGooglePlatform(p: Platform) {
  return p.slug.toLowerCase().includes("google");
}

function isMetaPlatform(p: Platform) {
  return (
    p.slug.toLowerCase().includes("instagram") ||
    p.slug.toLowerCase().includes("facebook") ||
    p.slug.toLowerCase().includes("meta")
  );
}

export function AdContentForm({
  selectedPlatformData,
  adContent,
  onChange,
}: AdContentFormProps) {
  const hasGoogle = selectedPlatformData.some(isGooglePlatform);
  const hasMeta = selectedPlatformData.some(isMetaPlatform);
  const hasAnyPlatform = selectedPlatformData.length > 0;

  // When only Google is selected (no Meta), show only Google Ads fields
  const showUnifiedFields = !hasAnyPlatform || hasMeta || (!hasGoogle && hasAnyPlatform);
  const showGoogleFields = hasGoogle;

  const headlineLimit = getLimit(
    selectedPlatformData.filter((p) => !isGooglePlatform(p)),
    "headline"
  );
  const bodyLimit = getLimit(
    selectedPlatformData.filter((p) => !isGooglePlatform(p)),
    "body"
  );

  function update(patch: Partial<AdContent>) {
    onChange({ ...adContent, ...patch });
  }

  function updateGoogleHeadline(index: number, value: string) {
    const next = [...adContent.googleHeadlines];
    next[index] = value;
    update({ googleHeadlines: next });
  }

  function updateGoogleDescription(index: number, value: string) {
    const next = [...adContent.googleDescriptions];
    next[index] = value;
    update({ googleDescriptions: next });
  }

  function addGoogleHeadline() {
    if (adContent.googleHeadlines.length < 15) {
      update({ googleHeadlines: [...adContent.googleHeadlines, ""] });
    }
  }

  function removeGoogleHeadline(index: number) {
    if (adContent.googleHeadlines.length > 1) {
      update({
        googleHeadlines: adContent.googleHeadlines.filter((_, i) => i !== index),
      });
    }
  }

  function addGoogleDescription() {
    if (adContent.googleDescriptions.length < 4) {
      update({ googleDescriptions: [...adContent.googleDescriptions, ""] });
    }
  }

  function removeGoogleDescription(index: number) {
    if (adContent.googleDescriptions.length > 1) {
      update({
        googleDescriptions: adContent.googleDescriptions.filter(
          (_, i) => i !== index
        ),
      });
    }
  }

  if (!hasAnyPlatform) {
    return (
      <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-12">
        <p className="text-sm text-slate-400">
          Select at least one channel in Step 1 to enter ad copy.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Unified copy (Meta + general) */}
      {showUnifiedFields && (
        <div className="space-y-5">
          {hasMeta && (
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Meta / Social Copy
              </span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>
          )}

          {/* Headline */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="headline">
                Headline{" "}
                {headlineLimit.label && (
                  <span className="text-slate-400 font-normal text-xs">
                    · most restrictive: {headlineLimit.label}
                  </span>
                )}
              </Label>
              <CharCounter
                current={adContent.headline.length}
                limit={headlineLimit.limit}
              />
            </div>
            <Input
              id="headline"
              placeholder="Enter your ad headline..."
              value={adContent.headline}
              onChange={(e) => update({ headline: e.target.value })}
              className={cn(
                adContent.headline.length > headlineLimit.limit &&
                  "border-red-300 focus-visible:ring-red-200"
              )}
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="body">
                Body Text{" "}
                {bodyLimit.label && (
                  <span className="text-slate-400 font-normal text-xs">
                    · most restrictive: {bodyLimit.label}
                  </span>
                )}
              </Label>
              <CharCounter
                current={adContent.body.length}
                limit={bodyLimit.limit}
              />
            </div>
            <Textarea
              id="body"
              placeholder="Enter your ad body text..."
              value={adContent.body}
              onChange={(e) => update({ body: e.target.value })}
              rows={5}
              className={cn(
                "resize-none",
                adContent.body.length > bodyLimit.limit &&
                  "border-red-300 focus-visible:ring-red-200"
              )}
            />
          </div>

          {/* Call to Action */}
          <div className="space-y-1.5">
            <Label htmlFor="cta">Call to Action (optional)</Label>
            <Input
              id="cta"
              placeholder="e.g. Shop Now, Learn More, Sign Up..."
              value={adContent.callToAction}
              onChange={(e) => update({ callToAction: e.target.value })}
            />
          </div>
        </div>
      )}

      {/* Google Ads section */}
      {showGoogleFields && (
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Google Ads Copy
            </span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          {/* Display URL */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="displayUrl">Display URL (optional)</Label>
              <CharCounter current={adContent.displayUrl.length} limit={35} />
            </div>
            <Input
              id="displayUrl"
              placeholder="example.com/products"
              value={adContent.displayUrl}
              onChange={(e) => update({ displayUrl: e.target.value })}
              className={cn(
                adContent.displayUrl.length > 35 &&
                  "border-red-300 focus-visible:ring-red-200"
              )}
            />
          </div>

          {/* Headlines */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                Headlines{" "}
                <span className="text-slate-400 font-normal text-xs">
                  · max 30 chars each · {adContent.googleHeadlines.length}/15
                </span>
              </Label>
            </div>
            <div className="space-y-2">
              {adContent.googleHeadlines.map((h, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-6 text-xs text-slate-400 text-right shrink-0">
                    {i + 1}.
                  </div>
                  <div className="relative flex-1">
                    <Input
                      placeholder={`Headline ${i + 1}`}
                      value={h}
                      onChange={(e) => updateGoogleHeadline(i, e.target.value)}
                      className={cn(
                        "pr-12",
                        h.length > 30 && "border-red-300 focus-visible:ring-red-200"
                      )}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <CharCounter current={h.length} limit={30} />
                    </span>
                  </div>
                  {adContent.googleHeadlines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeGoogleHeadline(i)}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {adContent.googleHeadlines.length < 15 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addGoogleHeadline}
                className="text-slate-500 hover:text-slate-900"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add headline
              </Button>
            )}
          </div>

          {/* Descriptions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                Descriptions{" "}
                <span className="text-slate-400 font-normal text-xs">
                  · max 90 chars each · {adContent.googleDescriptions.length}/4
                </span>
              </Label>
            </div>
            <div className="space-y-2">
              {adContent.googleDescriptions.map((d, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-6 text-xs text-slate-400 text-right shrink-0 pt-2.5">
                    {i + 1}.
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="relative">
                      <Textarea
                        placeholder={`Description ${i + 1}`}
                        value={d}
                        onChange={(e) =>
                          updateGoogleDescription(i, e.target.value)
                        }
                        rows={2}
                        className={cn(
                          "resize-none pr-14",
                          d.length > 90 && "border-red-300 focus-visible:ring-red-200"
                        )}
                      />
                      <span className="absolute right-3 bottom-2 pointer-events-none">
                        <CharCounter current={d.length} limit={90} />
                      </span>
                    </div>
                  </div>
                  {adContent.googleDescriptions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeGoogleDescription(i)}
                      className="text-slate-400 hover:text-red-500 transition-colors pt-2"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {adContent.googleDescriptions.length < 4 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addGoogleDescription}
                className="text-slate-500 hover:text-slate-900"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add description
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
