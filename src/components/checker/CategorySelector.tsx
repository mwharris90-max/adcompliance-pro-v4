"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X, Sparkles, Loader2, ShieldAlert, Ban, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { AdContent } from "./AdContentForm";
import { MaturityBadge } from "./MaturityBadge";

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  restrictionLevel?: "allowed" | "restricted" | "prohibited";
  maturity?: "ALPHA" | "BETA" | "LIVE";
}

interface AiSuggestion {
  categoryId: string;
  categoryName: string;
  confidence: number;
}

interface CategorySelectorProps {
  categories: Category[];
  loading: boolean;
  selectedCategories: string[];
  adContent: AdContent;
  onChange: (ids: string[]) => void;
  hint?: string;
}

export function CategorySelector({
  categories,
  loading,
  selectedCategories,
  adContent,
  onChange,
  hint,
}: CategorySelectorProps) {
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  // AI auto-detect with 1500ms debounce
  useEffect(() => {
    const text = [adContent.headline, adContent.body]
      .filter(Boolean)
      .join(" ")
      .trim();

    if (text.length < 10) {
      setSuggestions([]);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setDetecting(true);
      try {
        const res = await fetch("/api/detect-category", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            headline: adContent.headline,
            body: adContent.body,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setSuggestions(data.data.suggestions ?? []);
        }
      } catch {
        // ignore
      } finally {
        setDetecting(false);
      }
    }, 1500);

    return () => clearTimeout(debounceRef.current);
  }, [adContent.headline, adContent.body]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = categories.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) &&
      !selectedCategories.includes(c.id)
  );

  function select(id: string) {
    onChange([...selectedCategories, id]);
    setSearch("");
    setOpen(false);
  }

  function remove(id: string) {
    onChange(selectedCategories.filter((c) => c !== id));
  }

  function acceptSuggestion(id: string) {
    if (!selectedCategories.includes(id)) {
      onChange([...selectedCategories, id]);
    }
  }

  const selectedData = categories.filter((c) => selectedCategories.includes(c.id));

  if (loading) {
    return <div className="h-32 rounded-xl bg-slate-100 animate-pulse" />;
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">
        {hint ?? "Select the category or industry that best describes your ad. The AI can suggest categories based on your ad copy."}
      </p>

      {/* AI Suggestions */}
      {(detecting || suggestions.length > 0) && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            {detecting ? (
              <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 text-amber-500" />
            )}
            <span className="text-sm font-medium text-slate-700">
              {detecting ? "Detecting categories from your ad copy…" : "AI suggestions"}
            </span>
          </div>

          {!detecting && suggestions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => {
                const alreadySelected = selectedCategories.includes(s.categoryId);
                return (
                  <button
                    key={s.categoryId}
                    type="button"
                    disabled={alreadySelected}
                    onClick={() => acceptSuggestion(s.categoryId)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-all",
                      alreadySelected
                        ? "border-slate-900 bg-slate-900 text-white cursor-default"
                        : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 cursor-pointer"
                    )}
                  >
                    <span>{s.categoryName}</span>
                    <span
                      className={cn(
                        "text-xs rounded-full px-1.5 py-0.5 font-medium",
                        alreadySelected
                          ? "bg-white/20 text-white"
                          : "bg-amber-200 text-amber-700"
                      )}
                    >
                      {Math.round(s.confidence * 100)}%
                    </span>
                    {alreadySelected && (
                      <span className="text-xs text-white/70">Added</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Search + dropdown */}
      <div ref={containerRef} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            placeholder="Search categories…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            className="pl-9"
          />
        </div>

        {open && filtered.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-md max-h-56 overflow-y-auto">
            {filtered.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(cat.id);
                }}
                className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-900">{cat.name}</p>
                    <RestrictionBadge level={cat.restrictionLevel} />
                    <MaturityBadge maturity={cat.maturity} />
                  </div>
                  {cat.description && (
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                      {cat.description}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {open && search && filtered.length === 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-md">
            <p className="px-3 py-2.5 text-sm text-slate-500">
              No categories found for &ldquo;{search}&rdquo;
            </p>
          </div>
        )}
      </div>

      {/* Selected categories */}
      {selectedData.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedData.map((cat) => (
            <Badge
              key={cat.id}
              variant="secondary"
              className={cn(
                "flex items-center gap-1.5 pl-3 pr-2 py-1.5 text-sm",
                cat.restrictionLevel === "prohibited" && "bg-red-100 text-red-800 border-red-200",
                cat.restrictionLevel === "restricted" && "bg-amber-100 text-amber-800 border-amber-200"
              )}
            >
              <RestrictionIcon level={cat.restrictionLevel} />
              {cat.name}
              <MaturityBadge maturity={cat.maturity} />
              <button
                type="button"
                onClick={() => remove(cat.id)}
                className="rounded-full hover:bg-slate-300 transition-colors p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {selectedData.length === 0 && !open && (
        <p className="text-sm text-slate-400 text-center py-4">
          No categories selected yet. Search above or wait for AI suggestions.
        </p>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1">
        <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-emerald-500" /> Allowed</span>
        <span className="flex items-center gap-1"><ShieldAlert className="h-3 w-3 text-amber-500" /> Restricted</span>
        <span className="flex items-center gap-1"><Ban className="h-3 w-3 text-red-500" /> Prohibited</span>
      </div>
    </div>
  );
}

function RestrictionBadge({ level }: { level?: string }) {
  if (!level || level === "allowed") return null;
  if (level === "prohibited") {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0 rounded bg-red-100 text-red-700 border border-red-200">
        <Ban className="h-2.5 w-2.5" />
        Prohibited
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0 rounded bg-amber-100 text-amber-700 border border-amber-200">
      <ShieldAlert className="h-2.5 w-2.5" />
      Restricted
    </span>
  );
}

function RestrictionIcon({ level }: { level?: string }) {
  if (level === "prohibited") return <Ban className="h-3 w-3 text-red-600 shrink-0" />;
  if (level === "restricted") return <ShieldAlert className="h-3 w-3 text-amber-600 shrink-0" />;
  return null;
}
