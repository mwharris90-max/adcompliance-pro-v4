"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Globe,
  Monitor,
  Tag,
  Loader2,
  ChevronDown,
  ChevronRight,
  Search,
  X,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Lock,
  ArrowRightLeft,
  Smartphone,
  Cookie,
  FileText,
  Eye,
  Image as ImageIcon,
  Scan,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

interface ScanFinding {
  severity: "pass" | "warning" | "fail";
  category: string;
  title: string;
  detail: string;
  recommendation?: string;
}

interface ScanResult {
  scan: {
    url: string;
    finalUrl: string;
    title: string;
    statusCode: number;
    ssl: boolean;
    redirectCount: number;
    loadTimeMs: number;
    cookieConsentDetected: boolean;
    ageGateDetected: boolean;
    imageCount: number;
    imagesWithoutAlt: number;
  };
  report: {
    summary: string;
    overallScore: "compliant" | "needs_attention" | "non_compliant";
    findings: ScanFinding[];
  };
}

// ── MultiSelect (simple version) ────────────────────────────────────────────

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
            <span className="truncate text-slate-900">{selectedNames.join(", ")}</span>
          ) : (
            <span className="text-slate-900">
              {selectedNames.slice(0, 2).join(", ")}{" "}
              <span className="text-slate-400">+{selectedNames.length - 2}</span>
            </span>
          )}
        </div>
        <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform shrink-0", open && "rotate-180")} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
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
                      isSelected ? "bg-[#1A56DB]/10 text-[#1A56DB]" : "text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <div className={cn(
                      "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                      isSelected ? "bg-[#1A56DB] border-[#1A56DB]" : "border-slate-300"
                    )}>
                      {isSelected && (
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
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

// ── Category Picker (grouped + searchable) ──────────────────────────────────

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
      if (midLevel.length === 0) { standalone.push(top); continue; }
      const subGroups: SubGroup[] = [];
      const directChildren: Category[] = [];
      for (const mid of midLevel) {
        const leaves = childrenOf.get(mid.id) ?? [];
        if (leaves.length > 0) subGroups.push({ parent: mid, leaves });
        else directChildren.push(mid);
      }
      grouped.push({ parent: top, subGroups, directChildren });
    }
    return { groups: grouped, ungrouped: standalone };
  }, [categories]);

  const lowerSearch = search.toLowerCase();

  const filteredGroups = useMemo(() => {
    if (!search) return groups;
    return groups
      .map((g) => {
        if (g.parent.name.toLowerCase().includes(lowerSearch)) return g;
        const filteredSubs = g.subGroups
          .map((sg) => {
            if (sg.parent.name.toLowerCase().includes(lowerSearch)) return sg;
            const ml = sg.leaves.filter((l) => l.name.toLowerCase().includes(lowerSearch));
            return ml.length > 0 ? { ...sg, leaves: ml } : null;
          })
          .filter(Boolean) as SubGroup[];
        const filteredDirect = g.directChildren.filter((c) => c.name.toLowerCase().includes(lowerSearch));
        if (filteredSubs.length > 0 || filteredDirect.length > 0) return { ...g, subGroups: filteredSubs, directChildren: filteredDirect };
        return null;
      })
      .filter(Boolean) as TopGroup[];
  }, [groups, search, lowerSearch]);

  const filteredUngrouped = useMemo(() => {
    if (!search) return ungrouped;
    return ungrouped.filter((c) => c.name.toLowerCase().includes(lowerSearch));
  }, [ungrouped, search, lowerSearch]);

  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  const toggleIds = (ids: string[]) => {
    const allSel = ids.every((id) => selected.includes(id));
    onChange(allSel ? selected.filter((s) => !ids.includes(s)) : [...new Set([...selected, ...ids])]);
  };

  const selectedNames = categories.filter((i) => selected.includes(i.id)).map((i) => i.name);
  const totalResults = filteredGroups.reduce((s, g) => s + 1 + g.directChildren.length + g.subGroups.reduce((s2, sg) => s2 + 1 + sg.leaves.length, 0), 0) + filteredUngrouped.length;

  const Checkbox = ({ checked, partial }: { checked: boolean; partial?: boolean }) => (
    <div className={cn("h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0",
      checked ? "bg-[#1A56DB] border-[#1A56DB]" : partial ? "bg-[#1A56DB]/30 border-[#1A56DB]" : "border-slate-300"
    )}>
      {(checked || partial) && (
        <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          {checked ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /> : <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />}
        </svg>
      )}
    </div>
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => { setOpen(!open); if (!open) setTimeout(() => searchRef.current?.focus(), 50); }}
        className={cn(
          "w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm text-left transition-colors",
          open ? "border-[#1A56DB] ring-1 ring-[#1A56DB]/20" : "border-slate-200 hover:border-slate-300",
          selected.length === 0 && "text-slate-400"
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Tag className="h-4 w-4 text-slate-400 shrink-0" />
          {selectedNames.length === 0 ? <span>Select categories...</span>
            : selectedNames.length <= 2 ? <span className="truncate text-slate-900">{selectedNames.join(", ")}</span>
            : <span className="text-slate-900">{selectedNames.slice(0, 2).join(", ")} <span className="text-slate-400">+{selectedNames.length - 2}</span></span>}
        </div>
        <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform shrink-0", open && "rotate-180")} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => { setOpen(false); setSearch(""); }} />
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg" style={{ minWidth: 320 }}>
            <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
              <input ref={searchRef} type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search categories..." className="flex-1 text-sm outline-none bg-transparent text-slate-900 placeholder:text-slate-400" />
              {search && <button type="button" onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600"><X className="h-3.5 w-3.5" /></button>}
            </div>
            {selected.length > 0 && (
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100 bg-slate-50">
                <span className="text-xs text-slate-500">{selected.length} selected</span>
                <button type="button" onClick={() => onChange([])} className="text-xs text-[#1A56DB] hover:underline">Clear all</button>
              </div>
            )}
            <div className="max-h-72 overflow-y-auto p-1">
              {totalResults === 0 && <p className="px-3 py-4 text-sm text-slate-400 text-center">No categories match &ldquo;{search}&rdquo;</p>}
              {filteredGroups.map((group) => {
                const allIds = [group.parent.id, ...group.subGroups.flatMap((sg) => [sg.parent.id, ...sg.leaves.map((l) => l.id)]), ...group.directChildren.map((c) => c.id)];
                const allSel = allIds.every((id) => selected.includes(id));
                const someSel = !allSel && allIds.some((id) => selected.includes(id));
                return (
                  <div key={group.parent.id} className="mb-1">
                    <button type="button" onClick={() => toggleIds(allIds)} className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-colors font-semibold", allSel ? "bg-[#1A56DB]/10 text-[#1A56DB]" : "text-slate-900 hover:bg-slate-50")}>
                      <Checkbox checked={allSel} partial={someSel} />
                      {group.parent.name}
                      <span className="text-xs text-slate-400 ml-auto">{allIds.length - 1}</span>
                    </button>
                    <div className="ml-5 border-l border-slate-100 pl-2">
                      {group.subGroups.map((sg) => {
                        const sgIds = [sg.parent.id, ...sg.leaves.map((l) => l.id)];
                        const sgAll = sgIds.every((id) => selected.includes(id));
                        const sgSome = !sgAll && sgIds.some((id) => selected.includes(id));
                        return (
                          <div key={sg.parent.id} className="mb-0.5">
                            <button type="button" onClick={() => toggleIds(sgIds)} className={cn("w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-left transition-colors font-medium", sgAll ? "bg-[#1A56DB]/10 text-[#1A56DB]" : "text-slate-800 hover:bg-slate-50")}>
                              <Checkbox checked={sgAll} partial={sgSome} />
                              {sg.parent.name}
                              <span className="text-xs text-slate-400 ml-auto">{sg.leaves.length}</span>
                            </button>
                            <div className="ml-5 border-l border-slate-100 pl-2">
                              {sg.leaves.map((leaf) => (
                                <button key={leaf.id} type="button" onClick={() => toggle(leaf.id)} className={cn("w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-left transition-colors", selected.includes(leaf.id) ? "bg-[#1A56DB]/10 text-[#1A56DB]" : "text-slate-700 hover:bg-slate-50")}>
                                  <Checkbox checked={selected.includes(leaf.id)} />
                                  {leaf.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      {group.directChildren.map((child) => (
                        <button key={child.id} type="button" onClick={() => toggle(child.id)} className={cn("w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-left transition-colors", selected.includes(child.id) ? "bg-[#1A56DB]/10 text-[#1A56DB]" : "text-slate-700 hover:bg-slate-50")}>
                          <Checkbox checked={selected.includes(child.id)} />
                          {child.name}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              {filteredUngrouped.length > 0 && filteredGroups.length > 0 && <div className="h-px bg-slate-100 my-1" />}
              {filteredUngrouped.map((item) => (
                <button key={item.id} type="button" onClick={() => toggle(item.id)} className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-colors", selected.includes(item.id) ? "bg-[#1A56DB]/10 text-[#1A56DB]" : "text-slate-700 hover:bg-slate-50")}>
                  <Checkbox checked={selected.includes(item.id)} />
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Finding severity config ─────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  pass: {
    icon: CheckCircle2,
    bg: "bg-green-50",
    border: "border-green-100",
    iconColor: "text-green-500",
    label: "Pass",
    labelBg: "bg-green-100 text-green-700",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-amber-50",
    border: "border-amber-100",
    iconColor: "text-amber-500",
    label: "Warning",
    labelBg: "bg-amber-100 text-amber-700",
  },
  fail: {
    icon: XCircle,
    bg: "bg-red-50",
    border: "border-red-100",
    iconColor: "text-red-500",
    label: "Fail",
    labelBg: "bg-red-100 text-red-700",
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  platform_readiness: "Platform Readiness",
  legal_regulatory: "Legal & Regulatory",
  content_compliance: "Content Compliance",
  industry_specific: "Industry-Specific",
  accessibility: "Accessibility",
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  platform_readiness: Monitor,
  legal_regulatory: FileText,
  content_compliance: Eye,
  industry_specific: ShieldAlert,
  accessibility: ImageIcon,
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SiteScannerPage() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);

  const [url, setUrl] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);

  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);

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

  const runScan = async () => {
    if (!url.trim()) { toast.error("Enter a URL to scan"); return; }
    if (!selectedPlatforms.length || !selectedCountries.length) {
      toast.error("Select at least one platform and one country");
      return;
    }

    setScanning(true);
    setResult(null);

    try {
      const res = await fetch("/api/compliance/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          platformIds: selectedPlatforms,
          categoryIds: selectedCategories,
          countryIds: selectedCountries,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Scan failed");
        return;
      }

      const data = await res.json();
      setResult(data);
      toast.success("Scan complete");
    } catch {
      toast.error("Scan failed");
    } finally {
      setScanning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  // Group findings by category
  const findingsByCategory = result
    ? Object.entries(
        result.report.findings.reduce(
          (acc, f) => {
            (acc[f.category] ??= []).push(f);
            return acc;
          },
          {} as Record<string, ScanFinding[]>
        )
      )
    : [];

  const passCount = result?.report.findings.filter((f) => f.severity === "pass").length ?? 0;
  const warnCount = result?.report.findings.filter((f) => f.severity === "warning").length ?? 0;
  const failCount = result?.report.findings.filter((f) => f.severity === "fail").length ?? 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-l-[3px] border-[#1A56DB] pl-3">
        <h1 className="text-xl font-semibold text-slate-900">Site Scanner</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Scan a landing page or website for ad platform compliance issues.
          Checks platform destination requirements, legal pages, and
          industry-specific regulations.
        </p>
      </div>

      {/* Input card */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="pt-5 pb-5 space-y-4">
          {/* URL input */}
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">
              Page URL *
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/landing-page"
                  className="w-full rounded-lg border border-slate-200 pl-10 pr-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1A56DB] focus:ring-1 focus:ring-[#1A56DB]/20 outline-none transition-colors"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !scanning) runScan();
                  }}
                />
              </div>
            </div>
          </div>

          {/* Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">
                Platforms *
              </label>
              <MultiSelect label="Platforms" icon={Monitor} items={platforms} selected={selectedPlatforms} onChange={setSelectedPlatforms} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">
                Categories
              </label>
              <CategoryPicker categories={categories} selected={selectedCategories} onChange={setSelectedCategories} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">
                Countries *
              </label>
              <MultiSelect label="Countries" icon={Globe} items={countries} selected={selectedCountries} onChange={setSelectedCountries} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-slate-400">
              1 Checkdit per page scanned
            </p>
            <Button
              onClick={runScan}
              disabled={scanning || !url.trim() || !selectedPlatforms.length || !selectedCountries.length}
              className="bg-[#1A56DB] hover:bg-[#1A56DB]/90"
            >
              {scanning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Scan className="mr-2 h-4 w-4" />
                  Scan Page
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Scanning indicator */}
      {scanning && (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="py-12 text-center">
            <Scan className="h-8 w-8 text-[#1A56DB] mx-auto mb-3 animate-pulse" />
            <h3 className="font-semibold text-slate-900 mb-1">Scanning page...</h3>
            <p className="text-sm text-slate-500">
              Fetching page content and running compliance analysis. This may take up to 30 seconds.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Overall verdict */}
          <Card className={cn(
            "border shadow-sm",
            result.report.overallScore === "compliant" && "border-green-200 bg-green-50/50",
            result.report.overallScore === "needs_attention" && "border-amber-200 bg-amber-50/50",
            result.report.overallScore === "non_compliant" && "border-red-200 bg-red-50/50"
          )}>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-start gap-4">
                <div className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-xl shrink-0",
                  result.report.overallScore === "compliant" && "bg-green-100",
                  result.report.overallScore === "needs_attention" && "bg-amber-100",
                  result.report.overallScore === "non_compliant" && "bg-red-100"
                )}>
                  {result.report.overallScore === "compliant" && <ShieldCheck className="h-6 w-6 text-green-600" />}
                  {result.report.overallScore === "needs_attention" && <ShieldAlert className="h-6 w-6 text-amber-600" />}
                  {result.report.overallScore === "non_compliant" && <ShieldX className="h-6 w-6 text-red-600" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-semibold text-slate-900">
                      {result.report.overallScore === "compliant" && "Compliant"}
                      {result.report.overallScore === "needs_attention" && "Needs Attention"}
                      {result.report.overallScore === "non_compliant" && "Non-Compliant"}
                    </h2>
                  </div>
                  <p className="text-sm text-slate-600">{result.report.summary}</p>
                  {/* Score pills */}
                  <div className="flex items-center gap-3 mt-3">
                    <span className="inline-flex items-center gap-1 text-xs font-medium bg-green-100 text-green-700 px-2 py-1 rounded-full">
                      <CheckCircle2 className="h-3 w-3" /> {passCount} passed
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                      <AlertTriangle className="h-3 w-3" /> {warnCount} warnings
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-medium bg-red-100 text-red-700 px-2 py-1 rounded-full">
                      <XCircle className="h-3 w-3" /> {failCount} failures
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Page info strip */}
          <div className="flex flex-wrap gap-3">
            <Badge variant="secondary" className="gap-1.5 text-xs">
              <Lock className="h-3 w-3" />
              {result.scan.ssl ? "HTTPS" : "HTTP (No SSL)"}
            </Badge>
            <Badge variant="secondary" className="gap-1.5 text-xs">
              <Clock className="h-3 w-3" />
              {result.scan.loadTimeMs}ms
            </Badge>
            <Badge variant="secondary" className="gap-1.5 text-xs">
              <ArrowRightLeft className="h-3 w-3" />
              {result.scan.redirectCount} redirect{result.scan.redirectCount !== 1 ? "s" : ""}
            </Badge>
            <Badge variant="secondary" className="gap-1.5 text-xs">
              <Smartphone className="h-3 w-3" />
              Status {result.scan.statusCode}
            </Badge>
            <Badge variant="secondary" className="gap-1.5 text-xs">
              <Cookie className="h-3 w-3" />
              Cookie consent: {result.scan.cookieConsentDetected ? "Yes" : "Not detected"}
            </Badge>
            <Badge variant="secondary" className="gap-1.5 text-xs">
              <ImageIcon className="h-3 w-3" />
              {result.scan.imageCount} images ({result.scan.imagesWithoutAlt} missing alt)
            </Badge>
            {result.scan.finalUrl !== result.scan.url && (
              <Badge variant="secondary" className="gap-1.5 text-xs">
                <ExternalLink className="h-3 w-3" />
                Redirected to {new URL(result.scan.finalUrl).hostname}
              </Badge>
            )}
          </div>

          {/* Findings by category */}
          {findingsByCategory.map(([cat, findings]) => {
            const CatIcon = CATEGORY_ICONS[cat] ?? ShieldAlert;
            const failsFirst = [...findings].sort((a, b) => {
              const order = { fail: 0, warning: 1, pass: 2 };
              return order[a.severity] - order[b.severity];
            });

            return (
              <Card key={cat} className="border-slate-200 shadow-sm">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1A56DB]/10 shrink-0">
                      <CatIcon className="h-4 w-4 text-[#1A56DB]" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {CATEGORY_LABELS[cat] ?? cat}
                    </h3>
                    <div className="flex items-center gap-1.5 ml-auto">
                      {findings.some((f) => f.severity === "fail") && (
                        <span className="text-xs font-medium bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                          {findings.filter((f) => f.severity === "fail").length} fail
                        </span>
                      )}
                      {findings.some((f) => f.severity === "warning") && (
                        <span className="text-xs font-medium bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                          {findings.filter((f) => f.severity === "warning").length} warn
                        </span>
                      )}
                      {findings.some((f) => f.severity === "pass") && (
                        <span className="text-xs font-medium bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                          {findings.filter((f) => f.severity === "pass").length} pass
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {failsFirst.map((finding, fi) => {
                      const config = SEVERITY_CONFIG[finding.severity];
                      const SevIcon = config.icon;
                      return (
                        <div
                          key={fi}
                          className={cn("flex items-start gap-3 p-3 rounded-lg border", config.bg, config.border)}
                        >
                          <SevIcon className={cn("h-4 w-4 mt-0.5 shrink-0", config.iconColor)} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-slate-900">{finding.title}</p>
                              <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase", config.labelBg)}>
                                {config.label}
                              </span>
                            </div>
                            <p className="text-sm text-slate-600 mt-0.5">{finding.detail}</p>
                            {finding.recommendation && (
                              <p className="text-xs text-[#1A56DB] mt-1 font-medium">
                                Recommendation: {finding.recommendation}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
