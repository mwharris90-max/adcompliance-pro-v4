"use client";

import { useEffect, useState } from "react";
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
  Ruler,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Platform {
  id: string;
  name: string;
}
interface Category {
  id: string;
  name: string;
  description?: string;
}
interface Country {
  id: string;
  name: string;
  code: string;
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

// ─── Multi-Select Component ──────────────────────────────────────────────────

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
          open ? "border-[#1A56DB] ring-1 ring-[#1A56DB]/20" : "border-slate-200 hover:border-slate-300",
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
              <span className="text-slate-400">+{selectedNames.length - 2}</span>
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

// ─── Collapsible Section ─────────────────────────────────────────────────────

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
      {open && <div className="px-5 pb-5 border-t border-slate-100">{children}</div>}
    </div>
  );
}

// ─── Status Badge ────────────────────────────────────────────────────────────

function RuleStatusBadge({ status }: { status: string }) {
  if (status === "PROHIBITED")
    return (
      <Badge className="bg-red-100 text-red-700 border-red-200 gap-1">
        <ShieldX className="h-3 w-3" /> Prohibited
      </Badge>
    );
  if (status === "RESTRICTED")
    return (
      <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1">
        <ShieldAlert className="h-3 w-3" /> Restricted
      </Badge>
    );
  if (status === "ALLOWED")
    return (
      <Badge className="bg-green-100 text-green-700 border-green-200 gap-1">
        <ShieldCheck className="h-3 w-3" /> Allowed
      </Badge>
    );
  return <Badge variant="secondary">Unknown</Badge>;
}

// ─── Spec Type Labels ────────────────────────────────────────────────────────

const specTypeLabels: Record<string, string> = {
  CHARACTER_LIMIT: "Character Limit",
  FILE_SIZE: "File Size",
  FILE_FORMAT: "File Format",
  DIMENSIONS: "Dimensions",
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function BriefPage() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);

  const [brief, setBrief] = useState<BriefData | null>(null);
  const [generating, setGenerating] = useState(false);

  // Fetch reference data
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

    try {
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
      toast.success("Compliance brief generated");
    } catch {
      toast.error("Failed to generate brief");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const hasProhibitions = (brief?.prohibitions.length ?? 0) > 0;
  const hasRestrictions = (brief?.restrictions.length ?? 0) > 0;
  const hasGeoRegs = (brief?.geoRegulations.length ?? 0) > 0;
  const hasWarnings = (brief?.regulatoryWarnings.length ?? 0) > 0;
  const hasTechSpecs = (brief?.technicalSpecs.length ?? 0) > 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-l-[3px] border-[#1A56DB] pl-3">
        <h1 className="text-xl font-semibold text-slate-900">
          Compliance Brief
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          Generate a pre-check compliance brief showing all applicable rules,
          restrictions, and technical requirements for your ad campaign.
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
              <MultiSelect
                label="Categories"
                icon={Tag}
                items={categories}
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
                  <FileText className="mr-2 h-4 w-4" />
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
          {/* Brief header */}
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="gap-1.5"
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </Button>
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
                        <Badge key={c.id} variant="secondary" className="text-xs">
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

          {/* Prohibitions */}
          {hasProhibitions && (
            <Section
              title="Prohibited Categories"
              icon={ShieldX}
              iconColor="bg-red-500"
              count={brief.prohibitions.length}
            >
              <div className="mt-4 space-y-3">
                {brief.prohibitions.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-100"
                  >
                    <ShieldX className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-red-900">
                        {p.category} on {p.platform}
                      </p>
                      {p.notes && (
                        <p className="text-xs text-red-700 mt-1">{p.notes}</p>
                      )}
                      {p.referenceUrl && (
                        <a
                          href={p.referenceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline mt-1"
                        >
                          <ExternalLink className="h-3 w-3" /> Policy reference
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Regulatory warnings */}
          {hasWarnings && (
            <Section
              title="Regulatory Warnings"
              icon={AlertTriangle}
              iconColor="bg-amber-500"
              count={brief.regulatoryWarnings.length}
            >
              <div className="mt-4 space-y-3">
                {brief.regulatoryWarnings.map((w, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-amber-50 border border-amber-100"
                  >
                    <p className="text-sm font-medium text-amber-900">
                      {w.warningTitle}
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      {w.warningMessage}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
                        {w.category}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {w.country}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {w.platform}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Restrictions */}
          {hasRestrictions && (
            <Section
              title="Restricted Categories"
              icon={ShieldAlert}
              iconColor="bg-amber-500"
              count={brief.restrictions.length}
            >
              <div className="mt-4 space-y-3">
                {brief.restrictions.map((r, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-amber-50/50 border border-slate-200"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <RuleStatusBadge status="RESTRICTED" />
                      <span className="text-sm font-medium text-slate-900">
                        {r.category} on {r.platform}
                      </span>
                    </div>
                    {r.notes && (
                      <p className="text-xs text-slate-600 mt-1">{r.notes}</p>
                    )}
                    {r.conditions != null && (
                      <div className="mt-2 text-xs text-slate-500 bg-white rounded p-2 border border-slate-100">
                        <p className="font-medium text-slate-700 mb-1">
                          Conditions:
                        </p>
                        <pre className="whitespace-pre-wrap text-[11px]">
                          {typeof r.conditions === "string"
                            ? r.conditions
                            : JSON.stringify(r.conditions as Record<string, unknown>, null, 2)}
                        </pre>
                      </div>
                    )}
                    {r.referenceUrl && (
                      <a
                        href={r.referenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-[#1A56DB] hover:underline mt-2"
                      >
                        <ExternalLink className="h-3 w-3" /> Policy reference
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Geographic regulations */}
          {hasGeoRegs && (
            <Section
              title="Geographic Regulations"
              icon={Scale}
              iconColor="bg-purple-500"
              count={brief.geoRegulations.reduce(
                (sum, g) => sum + g.rules.length,
                0
              )}
            >
              <div className="mt-4 space-y-4">
                {brief.geoRegulations.map((group, gi) => (
                  <div key={gi}>
                    <h4 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5 text-slate-400" />
                      {group.country}
                    </h4>
                    <div className="space-y-2 ml-5">
                      {group.rules.map((rule, ri) => (
                        <div
                          key={ri}
                          className="p-3 rounded-lg border border-slate-200 bg-white"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <RuleStatusBadge status={rule.status} />
                            <span className="text-sm text-slate-900">
                              {rule.category}
                            </span>
                            <span className="text-xs text-slate-400">
                              ({rule.platform})
                            </span>
                          </div>
                          {rule.notes && (
                            <p className="text-xs text-slate-600 mt-1.5">
                              {rule.notes}
                            </p>
                          )}
                          {rule.restrictions != null && (
                            <div className="mt-2 text-xs text-slate-500 bg-slate-50 rounded p-2">
                              <pre className="whitespace-pre-wrap text-[11px]">
                                {typeof rule.restrictions === "string"
                                  ? rule.restrictions
                                  : JSON.stringify(rule.restrictions as Record<string, unknown>, null, 2)}
                              </pre>
                            </div>
                          )}
                          {rule.legislationUrl && (
                            <a
                              href={rule.legislationUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-[#1A56DB] hover:underline mt-1.5"
                            >
                              <ExternalLink className="h-3 w-3" /> Legislation
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
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

          {/* Allowed rules (clean pass) */}
          {brief.allowedRules.length > 0 && (
            <Section
              title="Allowed Categories"
              icon={ShieldCheck}
              iconColor="bg-green-500"
              count={brief.allowedRules.length}
              defaultOpen={false}
            >
              <div className="mt-4 space-y-2">
                {brief.allowedRules.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50/50 border border-green-100"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    <span className="text-sm text-slate-900">
                      {r.category} on {r.platform}
                    </span>
                    {r.notes && (
                      <span className="text-xs text-slate-400 ml-auto">
                        {r.notes}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* No rules found */}
          {!hasProhibitions &&
            !hasRestrictions &&
            !hasGeoRegs &&
            !hasWarnings &&
            brief.allowedRules.length === 0 &&
            !hasTechSpecs && (
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="py-12 text-center">
                  <ShieldCheck className="h-10 w-10 text-green-400 mx-auto mb-3" />
                  <h3 className="font-semibold text-slate-900 mb-1">
                    No specific rules found
                  </h3>
                  <p className="text-sm text-slate-500 max-w-md mx-auto">
                    No platform rules, geographic regulations, or restrictions
                    were found for this combination. Try selecting specific
                    categories for more detailed results.
                  </p>
                </CardContent>
              </Card>
            )}
        </div>
      )}
    </div>
  );
}
