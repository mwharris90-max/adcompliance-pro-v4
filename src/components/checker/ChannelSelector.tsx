"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Platform {
  id: string;
  name: string;
  slug: string;
  logoUrl: string;
  parentName: string | null;
}

interface ChannelSelectorProps {
  platforms: Platform[];
  loading: boolean;
  selectedPlatforms: string[];
  onChange: (ids: string[]) => void;
}

export function ChannelSelector({
  platforms,
  loading,
  selectedPlatforms,
  onChange,
}: ChannelSelectorProps) {
  function toggle(id: string) {
    if (selectedPlatforms.includes(id)) {
      onChange(selectedPlatforms.filter((p) => p !== id));
    } else {
      onChange([...selectedPlatforms, id]);
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!platforms.length) {
    return (
      <p className="text-sm text-slate-500 text-center py-8">
        No active platforms configured. Contact your administrator.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Select all platforms you plan to run this ad on. Character limits and
        compliance rules will be checked for each selected channel.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {platforms.map((platform) => {
          const isSelected = selectedPlatforms.includes(platform.id);
          return (
            <button
              key={platform.id}
              type="button"
              onClick={() => toggle(platform.id)}
              className={cn(
                "relative flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all",
                isSelected
                  ? "border-slate-900 bg-slate-50 shadow-sm"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              )}
            >
              {/* Logo */}
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm border border-slate-100 overflow-hidden">
                {platform.logoUrl && !platform.logoUrl.includes("placeholder") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={platform.logoUrl}
                    alt={platform.name}
                    className="h-8 w-8 object-contain"
                  />
                ) : (
                  <span className="text-xl font-bold text-slate-400">
                    {platform.name[0]}
                  </span>
                )}
              </div>

              {/* Labels */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 text-sm">
                  {platform.name}
                </p>
                {platform.parentName && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {platform.parentName}
                  </p>
                )}
              </div>

              {/* Check indicator */}
              {isSelected && (
                <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedPlatforms.length > 0 && (
        <p className="text-xs text-slate-400">
          {selectedPlatforms.length} platform
          {selectedPlatforms.length !== 1 ? "s" : ""} selected. Character limits
          will use the most restrictive across all selected channels.
        </p>
      )}
    </div>
  );
}
