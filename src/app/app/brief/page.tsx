"use client";

import { useEffect, useState } from "react";
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

interface Guidance {
  prohibited: GuidanceItem[];
  must: GuidanceItem[];
  should: GuidanceItem[];
  shouldNot: GuidanceItem[];
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

          {/* AI Guidance — Must / Should / Should Not */}
          {guidance && (
            <>
              {/* Prohibited */}
              {guidance.prohibited.length > 0 && (
                <Section
                  title="Prohibited — Do Not Advertise"
                  icon={Ban}
                  iconColor="bg-red-600"
                  count={guidance.prohibited.length}
                >
                  <div className="mt-4 space-y-3">
                    {guidance.prohibited.map((item, i) => (
                      <GuidanceCard
                        key={i}
                        item={item}
                        variant="prohibited"
                      />
                    ))}
                  </div>
                </Section>
              )}

              {/* Must */}
              {guidance.must.length > 0 && (
                <Section
                  title="Must — Mandatory Requirements"
                  icon={ShieldX}
                  iconColor="bg-red-500"
                  count={guidance.must.length}
                >
                  <div className="mt-4 space-y-3">
                    {guidance.must.map((item, i) => (
                      <GuidanceCard key={i} item={item} variant="must" />
                    ))}
                  </div>
                </Section>
              )}

              {/* Should */}
              {guidance.should.length > 0 && (
                <Section
                  title="Should — Recommended Best Practice"
                  icon={CheckCircle2}
                  iconColor="bg-blue-500"
                  count={guidance.should.length}
                >
                  <div className="mt-4 space-y-3">
                    {guidance.should.map((item, i) => (
                      <GuidanceCard key={i} item={item} variant="should" />
                    ))}
                  </div>
                </Section>
              )}

              {/* Should Not */}
              {guidance.shouldNot.length > 0 && (
                <Section
                  title="Should Not — Avoid"
                  icon={ShieldAlert}
                  iconColor="bg-amber-500"
                  count={guidance.shouldNot.length}
                >
                  <div className="mt-4 space-y-3">
                    {guidance.shouldNot.map((item, i) => (
                      <GuidanceCard key={i} item={item} variant="shouldNot" />
                    ))}
                  </div>
                </Section>
              )}

              {/* No guidance at all */}
              {guidance.prohibited.length === 0 &&
                guidance.must.length === 0 &&
                guidance.should.length === 0 &&
                guidance.shouldNot.length === 0 && (
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
