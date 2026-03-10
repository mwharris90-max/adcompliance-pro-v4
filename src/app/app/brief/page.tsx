"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Monitor,
  Tag,
  Globe,
  FileText,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  AlertTriangle,
  Scale,
  ClipboardCheck,
  Ruler,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Download,
  BookOpen,
  Sparkles,
  Ban,
  CheckCircle2,
  Info,
  XCircle,
  Search,
  X,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── Types ────────────────────────────────────────────────────────────────────

interface Platform {
  id: string;
  name: string;
}
interface Category {
  id: string;
  name: string;
  description?: string;
  parentId?: string | null;
}
interface Country {
  id: string;
  name: string;
  code: string;
}

interface GuidanceItem {
  text: string;
  source: string;
}

interface LegislationItem {
  name: string;
  summary: string;
  jurisdiction: string;
}

interface PracticalRequirement {
  requirement: string;
  source: string;
}

interface GuidanceSection {
  prohibited: GuidanceItem[];
  must: GuidanceItem[];
  should: GuidanceItem[];
  shouldNot: GuidanceItem[];
  legislationSummary?: LegislationItem[];
  practicalRequirements?: PracticalRequirement[];
}

interface CategoryGuidance {
  category: string;
  prohibited?: GuidanceItem[];
  must?: GuidanceItem[];
  should?: GuidanceItem[];
  shouldNot?: GuidanceItem[];
  legislationSummary?: LegislationItem[];
  practicalRequirements?: PracticalRequirement[];
}

interface Guidance {
  universal: GuidanceSection;
  categorySpecific: CategoryGuidance[];
}

interface BriefData {
  generatedAt: string;
  platforms: { id: string; name: string }[];
  categories: { id: string; name: string; description?: string }[];
  countries: { id: string; name: string; code: string }[];
  prohibitions: {
    platform: string;
    category: string;
    notes: string | null;
    referenceUrl: string | null;
  }[];
  restrictions: {
    platform: string;
    category: string;
    notes: string | null;
    conditions: unknown;
    referenceUrl: string | null;
  }[];
  allowedRules: {
    platform: string;
    category: string;
    notes: string | null;
  }[];
  geoRegulations: {
    country: string;
    rules: {
      category: string;
      platform: string;
      status: string;
      restrictions: unknown;
      notes: string | null;
      legislationUrl: string | null;
    }[];
  }[];
  regulatoryWarnings: {
    category: string;
    country: string;
    platform: string;
    warningTitle: string;
    warningMessage: string;
  }[];
  technicalSpecs: {
    platform: string;
    specs: {
      type: string;
      key: string;
      value: string;
      notes: string | null;
    }[];
  }[];
}

// ── Multi-Select ─────────────────────────────────────────────────────────────

function MultiSelect({
  label,
  icon: Icon,
  items,
  selected,
  onChange,
}: {
  label: string;
  icon: React.ElementType;
  items: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const toggle = (id: string) => {
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id]
    );
  };

  const selectedNames = items
    .filter((i) => selected.includes(i.id))
    .map((i) => i.name);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm text-left transition-colors",
          open
            ? "border-[#1A56DB] ring-1 ring-[#1A56DB]/20"
            : "border-slate-200 hover:border-slate-300",
          selected.length === 0 && "text-slate-400"
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-4 w-4 text-slate-400 shrink-0" />
          {selectedNames.length === 0 ? (
            <span>Select {label.toLowerCase()}...</span>
          ) : selectedNames.length <= 2 ? (
            <span className="truncate text-slate-900">
              {selectedNames.join(", ")}
            </span>
          ) : (
            <span className="text-slate-900">
              {selectedNames.slice(0, 2).join(", ")}{" "}
              <span className="text-slate-400">
                +{selectedNames.length - 2}
              </span>
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-slate-400 transition-transform shrink-0",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
            <div className="p-1">
              {items.map((item) => {
                const isSelected = selected.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggle(item.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-colors",
                      isSelected
                        ? "bg-[#1A56DB]/10 text-[#1A56DB]"
                        : "text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <div
                      className={cn(
                        "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                        isSelected
                          ? "bg-[#1A56DB] border-[#1A56DB]"
                          : "border-slate-300"
                      )}
                    >
                      {isSelected && (
                        <svg
                          className="h-3 w-3 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                    {item.name}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Category Picker (grouped + searchable) ──────────────────────────────

function CategoryPicker({
  categories,
  selected,
  onChange,
}: {
  categories: Category[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Build hierarchy: top-level sections with nested sub-groups and leaves
  type SubGroup = { parent: Category; leaves: Category[] };
  type TopGroup = { parent: Category; subGroups: SubGroup[]; directChildren: Category[] };

  const { groups, ungrouped } = useMemo(() => {
    const childrenOf = new Map<string, Category[]>();
    for (const c of categories) {
      if (c.parentId) {
        const list = childrenOf.get(c.parentId) ?? [];
        list.push(c);
        childrenOf.set(c.parentId, list);
      }
    }
    const topLevel = categories.filter((c) => !c.parentId);
    const grouped: TopGroup[] = [];
    const standalone: Category[] = [];

    for (const top of topLevel) {
      const midLevel = childrenOf.get(top.id) ?? [];
      if (midLevel.length === 0) {
        standalone.push(top);
        continue;
      }
      const subGroups: SubGroup[] = [];
      const directChildren: Category[] = [];
      for (const mid of midLevel) {
        const leaves = childrenOf.get(mid.id) ?? [];
        if (leaves.length > 0) {
          subGroups.push({ parent: mid, leaves });
        } else {
          directChildren.push(mid);
        }
      }
      grouped.push({ parent: top, subGroups, directChildren });
    }
    return { groups: grouped, ungrouped: standalone };
  }, [categories]);

  // Filter by search
  const lowerSearch = search.toLowerCase();

  const filteredGroups = useMemo(() => {
    if (!search) return groups;
    return groups
      .map((g) => {
        const topMatch = g.parent.name.toLowerCase().includes(lowerSearch);
        if (topMatch) return g;
        const filteredSubs = g.subGroups
          .map((sg) => {
            const subMatch = sg.parent.name.toLowerCase().includes(lowerSearch);
            if (subMatch) return sg;
            const matchLeaves = sg.leaves.filter((l) =>
              l.name.toLowerCase().includes(lowerSearch)
            );
            if (matchLeaves.length > 0) return { ...sg, leaves: matchLeaves };
            return null;
          })
          .filter(Boolean) as SubGroup[];
        const filteredDirect = g.directChildren.filter((c) =>
          c.name.toLowerCase().includes(lowerSearch)
        );
        if (filteredSubs.length > 0 || filteredDirect.length > 0)
          return { ...g, subGroups: filteredSubs, directChildren: filteredDirect };
        return null;
      })
      .filter(Boolean) as TopGroup[];
  }, [groups, search, lowerSearch]);

  const filteredUngrouped = useMemo(() => {
    if (!search) return ungrouped;
    return ungrouped.filter((c) =>
      c.name.toLowerCase().includes(lowerSearch)
    );
  }, [ungrouped, search, lowerSearch]);

  const toggle = (id: string) => {
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id]
    );
  };

  // Collect all descendant IDs for a group
  const getAllIds = (g: TopGroup): string[] => {
    const ids = [g.parent.id];
    for (const sg of g.subGroups) {
      ids.push(sg.parent.id, ...sg.leaves.map((l) => l.id));
    }
    ids.push(...g.directChildren.map((c) => c.id));
    return ids;
  };

  const getSubGroupIds = (sg: SubGroup): string[] => [
    sg.parent.id,
    ...sg.leaves.map((l) => l.id),
  ];

  const toggleIds = (ids: string[]) => {
    const allSelected = ids.every((id) => selected.includes(id));
    if (allSelected) {
      onChange(selected.filter((s) => !ids.includes(s)));
    } else {
      onChange([...new Set([...selected, ...ids])]);
    }
  };

  const selectedNames = categories
    .filter((i) => selected.includes(i.id))
    .map((i) => i.name);

  const totalResults =
    filteredGroups.reduce(
      (sum, g) =>
        sum +
        1 +
        g.directChildren.length +
        g.subGroups.reduce((s2, sg) => s2 + 1 + sg.leaves.length, 0),
      0
    ) + filteredUngrouped.length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          if (!open) setTimeout(() => searchRef.current?.focus(), 50);
        }}
        className={cn(
          "w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm text-left transition-colors",
          open
            ? "border-[#1A56DB] ring-1 ring-[#1A56DB]/20"
            : "border-slate-200 hover:border-slate-300",
          selected.length === 0 && "text-slate-400"
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Tag className="h-4 w-4 text-slate-400 shrink-0" />
          {selectedNames.length === 0 ? (
            <span>Select categories...</span>
          ) : selectedNames.length <= 2 ? (
            <span className="truncate text-slate-900">
              {selectedNames.join(", ")}
            </span>
          ) : (
            <span className="text-slate-900">
              {selectedNames.slice(0, 2).join(", ")}{" "}
              <span className="text-slate-400">
                +{selectedNames.length - 2}
              </span>
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-slate-400 transition-transform shrink-0",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => {
              setOpen(false);
              setSearch("");
            }}
          />
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg"
               style={{ minWidth: 320 }}>
            {/* Search bar */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search categories..."
                className="flex-1 text-sm outline-none bg-transparent text-slate-900 placeholder:text-slate-400"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Selected count + clear */}
            {selected.length > 0 && (
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100 bg-slate-50">
                <span className="text-xs text-slate-500">
                  {selected.length} selected
                </span>
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-xs text-[#1A56DB] hover:underline"
                >
                  Clear all
                </button>
              </div>
            )}

            {/* Scrollable list */}
            <div className="max-h-72 overflow-y-auto p-1">
              {totalResults === 0 && (
                <p className="px-3 py-4 text-sm text-slate-400 text-center">
                  No categories match &ldquo;{search}&rdquo;
                </p>
              )}

              {/* Grouped categories */}
              {filteredGroups.map((group) => {
                const allIds = getAllIds(group);
                const allSelected = allIds.every((id) => selected.includes(id));
                const someSelected = !allSelected && allIds.some((id) => selected.includes(id));
                const childCount = allIds.length - 1;

                return (
                  <div key={group.parent.id} className="mb-1">
                    {/* Top-level group header */}
                    <button
                      type="button"
                      onClick={() => toggleIds(allIds)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-colors font-semibold",
                        allSelected
                          ? "bg-[#1A56DB]/10 text-[#1A56DB]"
                          : "text-slate-900 hover:bg-slate-50"
                      )}
                    >
                      <div
                        className={cn(
                          "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                          allSelected
                            ? "bg-[#1A56DB] border-[#1A56DB]"
                            : someSelected
                              ? "bg-[#1A56DB]/30 border-[#1A56DB]"
                              : "border-slate-300"
                        )}
                      >
                        {(allSelected || someSelected) && (
                          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            {allSelected ? (
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
                            )}
                          </svg>
                        )}
                      </div>
                      {group.parent.name}
                      <span className="text-xs text-slate-400 ml-auto">
                        {childCount}
                      </span>
                    </button>

                    <div className="ml-5 border-l border-slate-100 pl-2">
                      {/* Sub-groups (e.g. Insurance Products > Pet Insurance, etc.) */}
                      {group.subGroups.map((sg) => {
                        const sgIds = getSubGroupIds(sg);
                        const sgAllSelected = sgIds.every((id) => selected.includes(id));
                        const sgSomeSelected = !sgAllSelected && sgIds.some((id) => selected.includes(id));

                        return (
                          <div key={sg.parent.id} className="mb-0.5">
                            {/* Sub-group header */}
                            <button
                              type="button"
                              onClick={() => toggleIds(sgIds)}
                              className={cn(
                                "w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-left transition-colors font-medium",
                                sgAllSelected
                                  ? "bg-[#1A56DB]/10 text-[#1A56DB]"
                                  : "text-slate-800 hover:bg-slate-50"
                              )}
                            >
                              <div
                                className={cn(
                                  "h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0",
                                  sgAllSelected
                                    ? "bg-[#1A56DB] border-[#1A56DB]"
                                    : sgSomeSelected
                                      ? "bg-[#1A56DB]/30 border-[#1A56DB]"
                                      : "border-slate-300"
                                )}
                              >
                                {(sgAllSelected || sgSomeSelected) && (
                                  <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    {sgAllSelected ? (
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    ) : (
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
                                    )}
                                  </svg>
                                )}
                              </div>
                              {sg.parent.name}
                              <span className="text-xs text-slate-400 ml-auto">
                                {sg.leaves.length}
                              </span>
                            </button>
                            {/* Leaves */}
                            <div className="ml-5 border-l border-slate-100 pl-2">
                              {sg.leaves.map((leaf) => {
                                const isSelected = selected.includes(leaf.id);
                                return (
                                  <button
                                    key={leaf.id}
                                    type="button"
                                    onClick={() => toggle(leaf.id)}
                                    className={cn(
                                      "w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-left transition-colors",
                                      isSelected
                                        ? "bg-[#1A56DB]/10 text-[#1A56DB]"
                                        : "text-slate-700 hover:bg-slate-50"
                                    )}
                                  >
                                    <div
                                      className={cn(
                                        "h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0",
                                        isSelected
                                          ? "bg-[#1A56DB] border-[#1A56DB]"
                                          : "border-slate-300"
                                      )}
                                    >
                                      {isSelected && (
                                        <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </div>
                                    {leaf.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}

                      {/* Direct children (no further nesting) */}
                      {group.directChildren.map((child) => {
                        const isSelected = selected.includes(child.id);
                        return (
                          <button
                            key={child.id}
                            type="button"
                            onClick={() => toggle(child.id)}
                            className={cn(
                              "w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-left transition-colors",
                              isSelected
                                ? "bg-[#1A56DB]/10 text-[#1A56DB]"
                                : "text-slate-700 hover:bg-slate-50"
                            )}
                          >
                            <div
                              className={cn(
                                "h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0",
                                isSelected
                                  ? "bg-[#1A56DB] border-[#1A56DB]"
                                  : "border-slate-300"
                              )}
                            >
                              {isSelected && (
                                <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            {child.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Ungrouped / standalone categories */}
              {filteredUngrouped.length > 0 && filteredGroups.length > 0 && (
                <div className="h-px bg-slate-100 my-1" />
              )}
              {filteredUngrouped.map((item) => {
                const isSelected = selected.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggle(item.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-colors",
                      isSelected
                        ? "bg-[#1A56DB]/10 text-[#1A56DB]"
                        : "text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <div
                      className={cn(
                        "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                        isSelected
                          ? "bg-[#1A56DB] border-[#1A56DB]"
                          : "border-slate-300"
                      )}
                    >
                      {isSelected && (
                        <svg
                          className="h-3 w-3 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                    {item.name}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Collapsible Section ──────────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  iconColor,
  count,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50 transition-colors"
      >
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
            iconColor
          )}
        >
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        </div>
        {count !== undefined && (
          <Badge variant="secondary" className="text-xs">
            {count}
          </Badge>
        )}
        {open ? (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-slate-400" />
        )}
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-slate-100">{children}</div>
      )}
    </div>
  );
}

// ── Guidance Item Card ───────────────────────────────────────────────────────

function GuidanceCard({
  item,
  variant,
}: {
  item: GuidanceItem;
  variant: "prohibited" | "must" | "should" | "shouldNot";
}) {
  const styles = {
    prohibited: {
      bg: "bg-red-50 border-red-100",
      icon: <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />,
      sourceColor: "text-red-600",
    },
    must: {
      bg: "bg-red-50/70 border-red-100",
      icon: <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />,
      sourceColor: "text-red-600",
    },
    should: {
      bg: "bg-blue-50 border-blue-100",
      icon: <CheckCircle2 className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />,
      sourceColor: "text-blue-600",
    },
    shouldNot: {
      bg: "bg-amber-50 border-amber-100",
      icon: <ShieldAlert className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />,
      sourceColor: "text-amber-600",
    },
  };

  const s = styles[variant];

  return (
    <div className={cn("flex items-start gap-3 p-3 rounded-lg border", s.bg)}>
      {s.icon}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-900">{item.text}</p>
        {item.source && (
          <p className={cn("text-xs mt-1", s.sourceColor)}>{item.source}</p>
        )}
      </div>
    </div>
  );
}

// ── Guidance Section UI (renders all tiers for a section) ─────────────────

function GuidanceSectionUI({ section }: { section: GuidanceSection }) {
  return (
    <>
      {/* Key Legislation */}
      {section.legislationSummary && section.legislationSummary.length > 0 && (
        <Section
          title="Key Legislation"
          icon={Scale}
          iconColor="bg-purple-500"
          count={section.legislationSummary.length}
        >
          <div className="mt-4 space-y-3">
            {section.legislationSummary.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-lg border bg-purple-50 border-purple-100"
              >
                <Scale className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {item.name}
                  </p>
                  <p className="text-xs text-purple-600 mt-0.5">
                    {item.jurisdiction}
                  </p>
                  <p className="text-sm text-slate-700 mt-1">
                    {item.summary}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Prohibited */}
      {section.prohibited.length > 0 && (
        <Section
          title="Prohibited — Do Not Advertise"
          icon={Ban}
          iconColor="bg-red-600"
          count={section.prohibited.length}
        >
          <div className="mt-4 space-y-3">
            {section.prohibited.map((item, i) => (
              <GuidanceCard key={i} item={item} variant="prohibited" />
            ))}
          </div>
        </Section>
      )}

      {/* Must */}
      {section.must.length > 0 && (
        <Section
          title="Must — Mandatory Requirements"
          icon={ShieldX}
          iconColor="bg-red-500"
          count={section.must.length}
        >
          <div className="mt-4 space-y-3">
            {section.must.map((item, i) => (
              <GuidanceCard key={i} item={item} variant="must" />
            ))}
          </div>
        </Section>
      )}

      {/* Should */}
      {section.should.length > 0 && (
        <Section
          title="Should — Recommended Best Practice"
          icon={CheckCircle2}
          iconColor="bg-blue-500"
          count={section.should.length}
        >
          <div className="mt-4 space-y-3">
            {section.should.map((item, i) => (
              <GuidanceCard key={i} item={item} variant="should" />
            ))}
          </div>
        </Section>
      )}

      {/* Should Not */}
      {section.shouldNot.length > 0 && (
        <Section
          title="Should Not — Avoid"
          icon={ShieldAlert}
          iconColor="bg-amber-500"
          count={section.shouldNot.length}
        >
          <div className="mt-4 space-y-3">
            {section.shouldNot.map((item, i) => (
              <GuidanceCard key={i} item={item} variant="shouldNot" />
            ))}
          </div>
        </Section>
      )}

      {/* Practical Requirements */}
      {section.practicalRequirements && section.practicalRequirements.length > 0 && (
        <Section
          title="Practical Requirements — Action Items"
          icon={ClipboardCheck}
          iconColor="bg-green-500"
          count={section.practicalRequirements.length}
        >
          <div className="mt-4 space-y-3">
            {section.practicalRequirements.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-lg border bg-green-50 border-green-100"
              >
                <ClipboardCheck className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-900">
                    {item.requirement}
                  </p>
                  {item.source && (
                    <p className="text-xs text-green-600 mt-1">
                      {item.source}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

// ── Spec Type Labels ─────────────────────────────────────────────────────────

const specTypeLabels: Record<string, string> = {
  CHARACTER_LIMIT: "Character Limit",
  FILE_SIZE: "File Size",
  FILE_FORMAT: "File Format",
  DIMENSIONS: "Dimensions",
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function BriefPage() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);

  const [brief, setBrief] = useState<BriefData | null>(null);
  const [guidance, setGuidance] = useState<Guidance | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatingGuidance, setGeneratingGuidance] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/platforms").then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
      fetch("/api/countries/approved").then((r) => r.json()),
    ])
      .then(([p, c, co]) => {
        setPlatforms(p.data ?? p ?? []);
        setCategories(c.data ?? c ?? []);
        setCountries(co.data ?? co ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const generateBrief = async () => {
    if (!selectedPlatforms.length || !selectedCountries.length) {
      toast.error("Select at least one platform and one country");
      return;
    }

    setGenerating(true);
    setBrief(null);
    setGuidance(null);

    try {
      // Fetch raw brief data
      const res = await fetch("/api/compliance/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platformIds: selectedPlatforms,
          categoryIds: selectedCategories,
          countryIds: selectedCountries,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to generate brief");
        return;
      }

      const data = await res.json();
      setBrief(data.brief);

      // Now generate AI guidance
      setGeneratingGuidance(true);
      const guidanceRes = await fetch("/api/compliance/brief/guidance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platformIds: selectedPlatforms,
          categoryIds: selectedCategories,
          countryIds: selectedCountries,
        }),
      });

      if (guidanceRes.ok) {
        const guidanceData = await guidanceRes.json();
        setGuidance(guidanceData.guidance);
      } else {
        toast.error("AI guidance unavailable — showing raw rules below");
      }

      toast.success("Compliance brief generated");
    } catch {
      toast.error("Failed to generate brief");
    } finally {
      setGenerating(false);
      setGeneratingGuidance(false);
    }
  };

  const downloadPdf = async () => {
    if (!guidance) {
      toast.error("Generate guidance first before downloading PDF");
      return;
    }

    setDownloadingPdf(true);
    try {
      const res = await fetch("/api/compliance/brief/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platformIds: selectedPlatforms,
          categoryIds: selectedCategories,
          countryIds: selectedCountries,
          guidance,
        }),
      });

      if (!res.ok) {
        toast.error("Failed to generate PDF");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `compliance-brief-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded");
    } catch {
      toast.error("Failed to download PDF");
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const hasTechSpecs = (brief?.technicalSpecs.length ?? 0) > 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-l-[3px] border-[#1A56DB] pl-3">
        <h1 className="text-xl font-semibold text-slate-900">
          Compliance Brief
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          Generate a plain-language compliance brief showing what you must,
          should, and should not do for your ad campaign.
        </p>
      </div>

      {/* Selectors */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="pt-5 pb-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">
                Platforms *
              </label>
              <MultiSelect
                label="Platforms"
                icon={Monitor}
                items={platforms}
                selected={selectedPlatforms}
                onChange={setSelectedPlatforms}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">
                Categories
              </label>
              <CategoryPicker
                categories={categories}
                selected={selectedCategories}
                onChange={setSelectedCategories}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">
                Countries *
              </label>
              <MultiSelect
                label="Countries"
                icon={Globe}
                items={countries}
                selected={selectedCountries}
                onChange={setSelectedCountries}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-slate-400">
              {selectedPlatforms.length} platform
              {selectedPlatforms.length !== 1 ? "s" : ""},{" "}
              {selectedCategories.length} categor
              {selectedCategories.length !== 1 ? "ies" : "y"},{" "}
              {selectedCountries.length} countr
              {selectedCountries.length !== 1 ? "ies" : "y"} selected
            </p>
            <Button
              onClick={generateBrief}
              disabled={
                generating ||
                !selectedPlatforms.length ||
                !selectedCountries.length
              }
              className="bg-[#1A56DB] hover:bg-[#1A56DB]/90"
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Brief
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Brief output */}
      {brief && (
        <div className="space-y-4" id="brief-output">
          {/* Brief header with actions */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Compliance Brief
              </h2>
              <p className="text-xs text-slate-400">
                Generated{" "}
                {new Date(brief.generatedAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={downloadPdf}
                disabled={!guidance || downloadingPdf}
                className="gap-1.5"
              >
                {downloadingPdf ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Download PDF
              </Button>
            </div>
          </div>

          {/* Scope summary */}
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-wrap gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Platforms</p>
                  <div className="flex flex-wrap gap-1">
                    {brief.platforms.map((p) => (
                      <Badge key={p.id} variant="secondary" className="text-xs">
                        {p.name}
                      </Badge>
                    ))}
                  </div>
                </div>
                {brief.categories.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Categories</p>
                    <div className="flex flex-wrap gap-1">
                      {brief.categories.map((c) => (
                        <Badge
                          key={c.id}
                          variant="secondary"
                          className="text-xs"
                        >
                          {c.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-xs text-slate-500 mb-1">Countries</p>
                  <div className="flex flex-wrap gap-1">
                    {brief.countries.map((c) => (
                      <Badge key={c.id} variant="secondary" className="text-xs">
                        {c.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Guidance loading state */}
          {generatingGuidance && !guidance && (
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="py-12 text-center">
                <Sparkles className="h-8 w-8 text-[#1A56DB] mx-auto mb-3 animate-pulse" />
                <h3 className="font-semibold text-slate-900 mb-1">
                  Generating plain-language guidance...
                </h3>
                <p className="text-sm text-slate-500">
                  AI is translating compliance rules into clear, actionable
                  guidance for your team.
                </p>
              </CardContent>
            </Card>
          )}

          {/* AI Guidance — Universal + Category-Specific */}
          {guidance && (
            <>
              {/* ── Universal Requirements ── */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-l-4 border-slate-400 pl-3 py-1">
                  <Layers className="h-5 w-5 text-slate-500" />
                  <h3 className="text-base font-semibold text-slate-900">
                    Universal Requirements — All Categories
                  </h3>
                </div>

                <GuidanceSectionUI section={guidance.universal} />
              </div>

              {/* ── Category-Specific Sections ── */}
              {guidance.categorySpecific.map((catSection, ci) => (
                <div key={ci} className="space-y-4">
                  <div className="flex items-center gap-2 border-l-4 border-[#1A56DB] pl-3 py-1">
                    <Tag className="h-5 w-5 text-[#1A56DB]" />
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">
                        {catSection.category}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Category-specific requirements
                      </p>
                    </div>
                  </div>

                  <GuidanceSectionUI
                    section={{
                      prohibited: catSection.prohibited ?? [],
                      must: catSection.must ?? [],
                      should: catSection.should ?? [],
                      shouldNot: catSection.shouldNot ?? [],
                      legislationSummary: catSection.legislationSummary,
                      practicalRequirements: catSection.practicalRequirements,
                    }}
                  />
                </div>
              ))}

              {/* No guidance at all */}
              {guidance.universal.prohibited.length === 0 &&
                guidance.universal.must.length === 0 &&
                guidance.universal.should.length === 0 &&
                guidance.universal.shouldNot.length === 0 &&
                guidance.categorySpecific.length === 0 && (
                  <Card className="border-slate-200 shadow-sm">
                    <CardContent className="py-12 text-center">
                      <ShieldCheck className="h-10 w-10 text-green-400 mx-auto mb-3" />
                      <h3 className="font-semibold text-slate-900 mb-1">
                        No specific compliance requirements found
                      </h3>
                      <p className="text-sm text-slate-500 max-w-md mx-auto">
                        No restrictions, prohibitions, or special requirements
                        were found for this combination. Standard advertising
                        guidelines apply.
                      </p>
                    </CardContent>
                  </Card>
                )}
            </>
          )}

          {/* Technical specifications */}
          {hasTechSpecs && (
            <Section
              title="Technical Specifications"
              icon={Ruler}
              iconColor="bg-blue-500"
              count={brief.technicalSpecs.reduce(
                (sum, g) => sum + g.specs.length,
                0
              )}
              defaultOpen={false}
            >
              <div className="mt-4 space-y-4">
                {brief.technicalSpecs.map((group, gi) => (
                  <div key={gi}>
                    <h4 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
                      <Monitor className="h-3.5 w-3.5 text-slate-400" />
                      {group.platform}
                    </h4>
                    <div className="rounded-lg border border-slate-200 overflow-hidden ml-5">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">
                              Type
                            </th>
                            <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">
                              Specification
                            </th>
                            <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">
                              Value
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {group.specs.map((spec, si) => (
                            <tr key={si} className="hover:bg-slate-50">
                              <td className="px-3 py-2 text-xs text-slate-500">
                                {specTypeLabels[spec.type] ?? spec.type}
                              </td>
                              <td className="px-3 py-2 text-xs font-medium text-slate-900">
                                {spec.key}
                              </td>
                              <td className="px-3 py-2 text-xs text-slate-700 font-mono">
                                {spec.value}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Policy Library link */}
          <Card className="border-slate-200 shadow-sm bg-slate-50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1A56DB]/10 shrink-0">
                  <BookOpen className="h-4.5 w-4.5 text-[#1A56DB]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Learn More in the Policy Library
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Read detailed articles, watch training videos, and take
                    quizzes on the regulations and platform policies referenced
                    in this brief.
                  </p>
                  <Link href="/app/learn">
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 gap-1.5"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      Browse Policy Library
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
