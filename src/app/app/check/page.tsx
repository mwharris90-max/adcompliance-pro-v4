"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Monitor,
  FileText,
  ImageIcon,
  Tag,
  Globe,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Loader2,
  RotateCcw,
  Coins,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ChannelSelector, type Platform } from "@/components/checker/ChannelSelector";
import { AdContentForm, defaultAdContent, type AdContent } from "@/components/checker/AdContentForm";
import { AssetUploader, type UploadedAsset } from "@/components/checker/AssetUploader";
import { CategorySelector, type Category } from "@/components/checker/CategorySelector";
import { GeoSelector, type Country } from "@/components/checker/GeoSelector";
import {
  StreamingProgress,
  initialStreamingState,
  type StreamingState,
  type LayerPhase,
} from "@/components/checker/StreamingProgress";
import { BulkUploadZone } from "@/components/checker/BulkUploadZone";
import { BulkPreviewDialog, type BulkPreviewData } from "@/components/checker/BulkPreviewDialog";
import { BulkComplianceTable, type BulkRowResult } from "@/components/checker/BulkComplianceTable";
import { CertificationPrompt, type RequiredCertification } from "@/components/checker/CertificationPrompt";
import { RegulatoryConfirmation, type RegulatoryWarning } from "@/components/checker/RegulatoryConfirmation";
import type { ComplianceChecklistItem } from "@/lib/ai/runComplianceCheck";

// ─── Steps ────────────────────────────────────────────────────────────────────

interface Step {
  id: number;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
}

const STEPS: Step[] = [
  { id: 1, label: "Channels", shortLabel: "Channels", icon: Monitor },
  { id: 2, label: "Ad Copy", shortLabel: "Ad Copy", icon: FileText },
  { id: 3, label: "Assets", shortLabel: "Assets", icon: ImageIcon },
  { id: 4, label: "Category", shortLabel: "Category", icon: Tag },
  { id: 5, label: "Geography", shortLabel: "Geo", icon: Globe },
  { id: 6, label: "Review & Check", shortLabel: "Review", icon: ClipboardCheck },
];

// ─── Validation ───────────────────────────────────────────────────────────────

function hasContent(adContent: AdContent): boolean {
  const hasHeadline = adContent.headline.trim().length > 0;
  const hasBody = adContent.body.trim().length > 0;
  const hasGoogleHeadlines = adContent.googleHeadlines.some((h) => h.trim().length > 0);
  const hasGoogleDescriptions = adContent.googleDescriptions.some((d) => d.trim().length > 0);
  return hasHeadline || hasBody || hasGoogleHeadlines || hasGoogleDescriptions;
}

function canRunCheck(
  selectedPlatforms: string[],
  selectedCategories: string[],
  selectedCountries: string[],
  adContent: AdContent,
  assets: UploadedAsset[]
): boolean {
  return (
    selectedPlatforms.length >= 1 &&
    selectedCategories.length >= 1 &&
    selectedCountries.length >= 1 &&
    (hasContent(adContent) || assets.length >= 1)
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({
  steps,
  currentStep,
  onNavigate,
}: {
  steps: Step[];
  currentStep: number;
  onNavigate: (id: number) => void;
}) {
  return (
    <nav aria-label="Steps" className="flex items-center gap-1 flex-wrap">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isActive = currentStep === step.id;
        const isCompleted = currentStep > step.id;

        return (
          <div key={step.id} className="flex items-center">
            <button
              type="button"
              onClick={() => onNavigate(step.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                isActive
                  ? "bg-[#1A56DB] text-white shadow-sm"
                  : isCompleted
                  ? "text-slate-600 hover:bg-slate-100"
                  : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
              )}
            >
              <div
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  isActive
                    ? "bg-white text-[#1A56DB]"
                    : isCompleted
                    ? "bg-slate-200 text-slate-600"
                    : "bg-slate-100 text-slate-400"
                )}
              >
                {isCompleted ? (
                  <Icon className="h-3 w-3" />
                ) : (
                  step.id
                )}
              </div>
              <span className="hidden sm:inline">{step.shortLabel}</span>
            </button>

            {index < steps.length - 1 && (
              <div className="h-px w-4 bg-slate-200 mx-1" />
            )}
          </div>
        );
      })}
    </nav>
  );
}

// ─── Review step content ──────────────────────────────────────────────────────

function ReviewStep({
  platforms,
  selectedPlatforms,
  categories,
  selectedCategories,
  countries,
  selectedCountries,
  adContent,
  assets,
  onRunCheck,
  running,
  onCertificationsResolved,
  onRegulatoryResolved,
  regulatoryAllConfirmed,
}: {
  platforms: Platform[];
  selectedPlatforms: string[];
  categories: Category[];
  selectedCategories: string[];
  countries: Country[];
  selectedCountries: string[];
  adContent: AdContent;
  assets: UploadedAsset[];
  onRunCheck: () => void;
  running: boolean;
  onCertificationsResolved: (required: RequiredCertification[], allConfirmed: boolean) => void;
  onRegulatoryResolved: (warnings: RegulatoryWarning[], allConfirmed: boolean) => void;
  regulatoryAllConfirmed: boolean;
}) {
  const ready = canRunCheck(
    selectedPlatforms,
    selectedCategories,
    selectedCountries,
    adContent,
    assets
  );

  const selectedPlatformData = platforms.filter((p) =>
    selectedPlatforms.includes(p.id)
  );
  const selectedCategoryData = categories.filter((c) =>
    selectedCategories.includes(c.id)
  );
  const selectedCountryData = countries.filter((c) =>
    selectedCountries.includes(c.id)
  );

  const missing: string[] = [];
  if (!selectedPlatforms.length) missing.push("at least one channel");
  if (!selectedCategories.length) missing.push("at least one category");
  if (!selectedCountries.length) missing.push("at least one country");
  if (!hasContent(adContent) && !assets.length) missing.push("ad copy or an asset");

  return (
    <div className="space-y-6">
      {!ready && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              Complete your check before running
            </p>
            <p className="text-sm text-amber-700 mt-0.5">
              Still needed: {missing.join(", ")}.
            </p>
          </div>
        </div>
      )}

      {/* Summary grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Channels */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Channels
            </span>
          </div>
          {selectedPlatformData.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {selectedPlatformData.map((p) => (
                <Badge key={p.id} variant="secondary" className="text-xs">
                  {p.name}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-red-500">None selected</p>
          )}
        </div>

        {/* Categories */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Categories
            </span>
          </div>
          {selectedCategoryData.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {selectedCategoryData.map((c) => (
                <Badge key={c.id} variant="secondary" className="text-xs">
                  {c.name}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-red-500">None selected</p>
          )}
        </div>

        {/* Countries */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Countries ({selectedCountryData.length})
            </span>
          </div>
          {selectedCountryData.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {selectedCountryData.map((c) => (
                <Badge
                  key={c.id}
                  variant="secondary"
                  className={cn(
                    "text-xs",
                    c.complexRules &&
                      "border border-amber-200 bg-amber-50 text-amber-700"
                  )}
                >
                  {c.complexRules && (
                    <AlertTriangle className="mr-1 h-3 w-3 text-amber-500 inline" />
                  )}
                  {c.code}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-red-500">None selected</p>
          )}
        </div>

        {/* Assets */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Assets
            </span>
          </div>
          <p className="text-sm text-slate-600">
            {assets.length > 0
              ? `${assets.length} file${assets.length !== 1 ? "s" : ""} uploaded`
              : "No assets uploaded (optional)"}
          </p>
        </div>
      </div>

      {/* Ad copy preview */}
      {hasContent(adContent) && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Ad Copy
            </span>
          </div>
          <div className="space-y-2 text-sm">
            {adContent.headline && (
              <div>
                <span className="text-slate-400 text-xs">Headline: </span>
                <span className="text-slate-800 font-medium">{adContent.headline}</span>
              </div>
            )}
            {adContent.body && (
              <div>
                <span className="text-slate-400 text-xs">Body: </span>
                <span className="text-slate-700 whitespace-pre-wrap line-clamp-4">
                  {adContent.body}
                </span>
              </div>
            )}
            {adContent.callToAction && (
              <div>
                <span className="text-slate-400 text-xs">CTA: </span>
                <span className="text-slate-700">{adContent.callToAction}</span>
              </div>
            )}
            {adContent.googleHeadlines.some((h) => h.trim()) && (
              <div>
                <span className="text-slate-400 text-xs">
                  Google Headlines:{" "}
                </span>
                <span className="text-slate-700">
                  {adContent.googleHeadlines.filter((h) => h.trim()).join(" | ")}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Certification prompt */}
      {ready && (
        <CertificationPrompt
          platformIds={selectedPlatforms}
          categoryIds={selectedCategories}
          onCertificationsResolved={onCertificationsResolved}
        />
      )}

      {/* Regulatory warnings */}
      {ready && (
        <RegulatoryConfirmation
          platformIds={selectedPlatforms}
          categoryIds={selectedCategories}
          countryIds={selectedCountries}
          onResolved={onRegulatoryResolved}
        />
      )}

      <Separator />

      {/* Run check button */}
      <div className="flex flex-col items-center gap-3">
        <Button
          size="lg"
          disabled={!ready || running || !regulatoryAllConfirmed}
          onClick={onRunCheck}
          className="w-full sm:w-auto min-w-56 bg-gradient-to-r from-[#1A56DB] to-[#E4168A] text-white hover:opacity-90 border-0"
        >
          {running ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analysing…
            </>
          ) : (
            <>
              <ClipboardCheck className="mr-2 h-4 w-4" />
              Run Compliance Check
            </>
          )}
        </Button>
        {ready && (
          <p className="text-xs text-slate-400 text-center max-w-sm">
            Your ad content will be analysed against platform policies and
            geographic regulations. Results are ready in seconds.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CheckPage() {
  const router = useRouter();

  // Data
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Form state
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [adContent, setAdContent] = useState<AdContent>(defaultAdContent);
  const [assets, setAssets] = useState<UploadedAsset[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Checkdit balance
  const [checkdits, setCheckdits] = useState<{ remaining: number; limit: number } | null>(null);

  // Bulk upload state
  const [bulkMode, setBulkMode] = useState<"idle" | "preview" | "running" | "complete">("idle");
  const [bulkCsvText, setBulkCsvText] = useState<string | null>(null);
  const [bulkFilename, setBulkFilename] = useState("");
  const [bulkPreview, setBulkPreview] = useState<BulkPreviewData | null>(null);
  const [bulkRows, setBulkRows] = useState<BulkRowResult[]>([]);
  const [bulkProcessedCount, setBulkProcessedCount] = useState(0);
  const [bulkTotalUnique, setBulkTotalUnique] = useState(0);
  const [bulkSummary, setBulkSummary] = useState<{ passCount: number; warningCount: number; failCount: number; errorCount: number } | null>(null);
  const [bulkJobId, setBulkJobId] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkColumnMapping, setBulkColumnMapping] = useState<{ mapped: Record<string, string>; unmapped: string[]; originalHeaders: string[] } | null>(null);
  const [bulkRecheckAll, setBulkRecheckAll] = useState(false);
  const [bulkRecheckLoading, setBulkRecheckLoading] = useState(false);

  // Certification state
  const [requiredCerts, setRequiredCerts] = useState<RequiredCertification[]>([]);
  const [certsAllConfirmed, setCertsAllConfirmed] = useState(true);

  // Regulatory warnings state
  const [regulatoryWarnings, setRegulatoryWarnings] = useState<RegulatoryWarning[]>([]);
  const [regulatoryAllConfirmed, setRegulatoryAllConfirmed] = useState(true);

  const handleCertificationsResolved = useCallback(
    (required: RequiredCertification[], allConfirmed: boolean) => {
      setRequiredCerts(required);
      setCertsAllConfirmed(allConfirmed);
    },
    []
  );

  const handleRegulatoryResolved = useCallback(
    (warnings: RegulatoryWarning[], allConfirmed: boolean) => {
      setRegulatoryWarnings(warnings);
      setRegulatoryAllConfirmed(allConfirmed);
    },
    []
  );

  // Streaming state
  const [streaming, setStreaming] = useState(false);
  const [streamState, setStreamState] = useState<StreamingState>(initialStreamingState());
  const layerStartRef = useRef<Record<string, number>>({});

  // Fetch reference data
  useEffect(() => {
    Promise.all([
      fetch("/api/platforms").then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
      fetch("/api/countries/approved").then((r) => r.json()),
    ])
      .then(([p, c, co]) => {
        if (p.success) setPlatforms(p.data);
        if (c.success) setCategories(c.data);
        if (co.success) setCountries(co.data);
      })
      .finally(() => setDataLoading(false));

    fetch("/api/user/checkdits")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.limit !== null) setCheckdits(data); })
      .catch(() => {});
  }, []);

  const selectedPlatformData = platforms.filter((p) =>
    selectedPlatforms.includes(p.id)
  );

  function buildContentPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    if (adContent.headline) payload.headline = adContent.headline;
    if (adContent.body) payload.body = adContent.body;
    if (adContent.callToAction) payload.callToAction = adContent.callToAction;
    if (adContent.displayUrl) payload.displayUrl = adContent.displayUrl;
    const heads = adContent.googleHeadlines.filter((h) => h.trim());
    if (heads.length) payload.googleHeadlines = heads;
    const descs = adContent.googleDescriptions.filter((d) => d.trim());
    if (descs.length) payload.googleDescriptions = descs;
    return payload;
  }

  // ── Bulk upload handlers ──────────────────────────────────────────────────

  const handleBulkFileParsed = useCallback(async (csvText: string, filename: string) => {
    setBulkCsvText(csvText);
    setBulkFilename(filename);
    setBulkLoading(true);
    setBulkRecheckAll(false);
    setError(null);

    try {
      const res = await fetch("/api/compliance/check/bulk/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText, filename }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to parse CSV file.");
        setBulkMode("idle");
        return;
      }

      const data = await res.json();
      setBulkPreview(data.preview);
      setBulkColumnMapping(data.columnMapping ?? null);
      setBulkMode("preview");

      // Auto-select Google Ads platform (CSV is Google Ads format)
      const googleAds = platforms.find((p) => p.slug === "google-ads");
      if (googleAds && !selectedPlatforms.includes(googleAds.id)) {
        setSelectedPlatforms((prev) => prev.includes(googleAds.id) ? prev : [...prev, googleAds.id]);
      }

      // Extract headline + body from first CSV row for category auto-detection
      if (data.firstRowContent) {
        const fc = data.firstRowContent as { headline?: string; body?: string };
        if (fc.headline || fc.body) {
          setAdContent((prev) => ({
            ...prev,
            headline: fc.headline ?? prev.headline,
            body: fc.body ?? prev.body,
          }));
        }
      }
    } catch {
      setError("Network error while parsing CSV.");
    } finally {
      setBulkLoading(false);
    }
  }, [platforms, selectedPlatforms]);

  async function handleBulkRecheckAllChange(checked: boolean) {
    setBulkRecheckAll(checked);
    if (!bulkCsvText) return;

    setBulkRecheckLoading(true);
    try {
      const res = await fetch("/api/compliance/check/bulk/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText: bulkCsvText, filename: bulkFilename, recheckAll: checked }),
      });
      if (res.ok) {
        const data = await res.json();
        // Preserve original delta info so the recheck toggle stays visible
        setBulkPreview((prev) => ({
          ...data.preview,
          delta: prev?.delta ?? data.preview.delta,
        }));
      }
    } catch { /* non-fatal — keep existing preview */ }
    finally { setBulkRecheckLoading(false); }
  }

  async function handleBulkRunInstant() {
    if (!bulkCsvText || !bulkPreview) return;

    // Require platform, category, country selection first
    if (selectedPlatforms.length === 0 || selectedCategories.length === 0 || selectedCountries.length === 0) {
      setError("Please select at least one channel, category, and country before running the bulk check.");
      return;
    }

    if (!regulatoryAllConfirmed) {
      setError("Please confirm all regulatory restrictions before running the check.");
      return;
    }

    setBulkLoading(true);
    setBulkMode("running");
    setBulkProcessedCount(0);
    setBulkSummary(null);

    // Parse CSV client-side to populate initial row state for the table
    const Papa = await import("papaparse");
    const parsed = Papa.default.parse<Record<string, string>>(bulkCsvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim(),
    });
    const initialRows: BulkRowResult[] = (parsed.data ?? []).map((rawRow, i) => {
      const adContent: Record<string, string> = {};
      if (bulkColumnMapping) {
        for (const [csvHeader, fieldName] of Object.entries(bulkColumnMapping.mapped)) {
          const val = rawRow[csvHeader]?.trim() ?? "";
          if (val) adContent[fieldName] = val;
        }
      }
      return {
        rowIndex: i,
        adContent,
        rawCsvRow: rawRow,
        overallStatus: "PENDING" as const,
        results: null,
        isDuplicate: false,
        editedContent: null,
      };
    });
    setBulkRows(initialRows);

    try {
      const res = await fetch("/api/compliance/check/bulk/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvText: bulkCsvText,
          filename: bulkFilename,
          platformIds: selectedPlatforms,
          categoryIds: selectedCategories,
          countryIds: selectedCountries,
          recheckAll: bulkRecheckAll,
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({ error: "Failed to start bulk check." }));
        setError(data.error || "Failed to start bulk check.");
        setBulkMode("preview");
        setBulkLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          const eventMatch = block.match(/^event: (.+)$/m);
          const dataMatch = block.match(/^data: (.+)$/m);
          if (!eventMatch || !dataMatch) continue;

          const eventName = eventMatch[1].trim();
          let payload: Record<string, unknown>;
          try {
            payload = JSON.parse(dataMatch[1]);
          } catch {
            continue;
          }

          if (eventName === "start") {
            setBulkJobId(payload.jobId as string);
            setBulkTotalUnique(payload.uniqueRows as number);
          }

          if (eventName === "categories_detected") {
            // payload is Record<rowIndex, { categoryId, categoryName }>
            const catEntries = payload as unknown as Record<string, { categoryId: string; categoryName: string }>;
            setBulkRows((prev) => prev.map((r) => {
              const det = catEntries[r.rowIndex];
              if (det) return { ...r, detectedCategoryId: det.categoryId, detectedCategoryName: det.categoryName };
              return r;
            }));
          }

          if (eventName === "row_complete") {
            const rowIndex = payload.rowIndex as number;
            const overallStatus = payload.overallStatus as string;
            setBulkRows((prev) => prev.map((r) =>
              r.rowIndex === rowIndex ? { ...r, overallStatus: overallStatus as BulkRowResult["overallStatus"] } : r
            ));
            setBulkProcessedCount(payload.processed as number);
          }

          if (eventName === "progress") {
            setBulkProcessedCount(payload.processed as number);
          }

          if (eventName === "complete") {
            setBulkSummary(payload.summary as typeof bulkSummary);
            setBulkMode("complete");
            window.dispatchEvent(new Event("checkdit-used"));

            // Fetch full row results from DB
            const jid = payload.jobId as string;
            if (jid) {
              try {
                const rowsRes = await fetch(`/api/compliance/check/bulk/${jid}/rows`);
                if (rowsRes.ok) {
                  const rowsData = await rowsRes.json();
                  setBulkRows(rowsData.rows);
                  if (rowsData.columnMapping) {
                    setBulkColumnMapping(rowsData.columnMapping);
                  }
                }
              } catch { /* non-fatal */ }
            }
          }
        }
      }
    } catch {
      setError("Network error during bulk check.");
      setBulkMode("preview");
    } finally {
      setBulkLoading(false);
    }
  }

  function handleBulkRowUpdated(
    rowIndex: number,
    result: BulkRowResult["results"],
    overallStatus: BulkRowResult["overallStatus"]
  ) {
    setBulkRows((prev) =>
      prev.map((r) =>
        r.rowIndex === rowIndex
          ? { ...r, results: result, overallStatus }
          : r
      )
    );
  }

  function handleBulkEditCell(rowIndex: number, field: string, value: string) {
    setBulkRows((prev) =>
      prev.map((r) => {
        if (r.rowIndex !== rowIndex) return r;
        return {
          ...r,
          editedContent: { ...(r.editedContent ?? {}), [field]: value },
        };
      })
    );
  }

  function handleBulkCategoryChange(rowIndex: number, categoryId: string, categoryName: string) {
    setBulkRows((prev) =>
      prev.map((r) => {
        if (r.rowIndex !== rowIndex) return r;
        return {
          ...r,
          overrideCategoryIds: [categoryId],
          detectedCategoryName: categoryName,
          detectedCategoryId: categoryId,
        };
      })
    );
  }

  async function handleBulkCategoryOverrideAcknowledged(
    rowIndex: number,
    originalCatId: string,
    originalCatName: string,
    newCatId: string,
    newCatName: string,
    restrictionLevel: string,
    acknowledgement: string
  ) {
    const row = bulkRows.find((r) => r.rowIndex === rowIndex);
    if (!row?.bulkRowId || !row?.bulkJobId) return;

    try {
      await fetch("/api/compliance/check/bulk/category-override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bulkRowId: row.bulkRowId,
          bulkJobId: row.bulkJobId,
          originalCategoryId: originalCatId,
          originalCategoryName: originalCatName,
          overrideCategoryId: newCatId,
          overrideCategoryName: newCatName,
          restrictionLevel,
          acknowledgement,
        }),
      });
    } catch {
      // Non-fatal — the UI override still applies even if audit save fails
    }
  }

  function handleBulkDownloadCsv() {
    if (!bulkColumnMapping || !bulkRows.length) return;

    // Dynamic import to keep papaparse client-side only
    import("papaparse").then((Papa) => {
      const fieldToHeader: Record<string, string> = {};
      for (const [csvHeader, fieldName] of Object.entries(bulkColumnMapping.mapped)) {
        fieldToHeader[fieldName] = csvHeader;
      }

      const outputRows = bulkRows.map((row) => {
        const outputRow = { ...row.rawCsvRow };
        if (row.editedContent) {
          for (const [fieldName, val] of Object.entries(row.editedContent)) {
            const csvHeader = fieldToHeader[fieldName];
            if (csvHeader) outputRow[csvHeader] = val;
          }
        }
        return outputRow;
      });

      const csv = Papa.default.unparse(outputRows, {
        columns: bulkColumnMapping.originalHeaders,
        newline: "\r\n",
      });

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = bulkFilename.replace(/\.csv$/i, "") + "_checked.csv";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  function handleBulkCancel() {
    setBulkMode("idle");
    setBulkCsvText(null);
    setBulkFilename("");
    setBulkPreview(null);
    setBulkRows([]);
    setBulkSummary(null);
    setBulkJobId(null);
  }

  async function handleRunCheck() {
    setError(null);
    setStreaming(true);
    setStreamState(initialStreamingState());
    layerStartRef.current = {};

    const contentPayload = buildContentPayload();

    try {
      const res = await fetch("/api/compliance/check/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platformIds: selectedPlatforms,
          categoryIds: selectedCategories,
          countryIds: selectedCountries,
          adContent: contentPayload,
          assets: assets.map((a) => ({
            url: a.url,
            format: a.format,
            width: a.width,
            height: a.height,
            bytes: a.bytes,
          })),
        }),
      });

      if (!res.ok || !res.body) {
        setError("Failed to start compliance check. Please try again.");
        setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Mark technical as first layer to run; others pending
      layerStartRef.current["technical"] = Date.now();
      setStreamState((prev) => ({
        ...prev,
        technical:     { ...prev.technical,     phase: "running" },
        platform_rule: { ...prev.platform_rule, phase: "pending" },
        geo_rule:      { ...prev.geo_rule,       phase: "pending" },
        ai_text:       { ...prev.ai_text,        phase: "pending" },
        image:         { ...prev.image,          phase: "pending" },
      }));

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          const eventMatch = block.match(/^event: (.+)$/m);
          const dataMatch  = block.match(/^data: (.+)$/m);
          if (!eventMatch || !dataMatch) continue;

          const eventName = eventMatch[1].trim();
          let payload: Record<string, unknown>;
          try {
            payload = JSON.parse(dataMatch[1]);
          } catch {
            continue;
          }

          if (eventName === "start") {
            setStreamState((prev) => ({ ...prev, checkId: payload.checkId as string }));
          }

          if (eventName === "layer_start") {
            const layer = payload.layer as string;
            layerStartRef.current[layer] = Date.now();
            setStreamState((prev) => ({
              ...prev,
              [layer]: { ...(prev[layer as keyof StreamingState] as object), phase: "running" as LayerPhase },
            }));
          }

          if (eventName === "layer") {
            const layer = payload.layer as keyof StreamingState;
            const items = (payload.items ?? []) as ComplianceChecklistItem[];
            const elapsed = layerStartRef.current[layer as string]
              ? Date.now() - layerStartRef.current[layer as string]
              : undefined;

            // Mark this layer done, advance next layer to "running"
            const NEXT: Partial<Record<string, keyof StreamingState>> = {
              technical:     "platform_rule",
              platform_rule: "geo_rule",
              geo_rule:      "ai_text",
              ai_text:       "image",
            };
            const nextLayer = NEXT[layer as string];

            setStreamState((prev) => {
              const updated: StreamingState = {
                ...prev,
                [layer]: { phase: "done" as LayerPhase, items, elapsedMs: elapsed },
              };
              if (nextLayer) {
                layerStartRef.current[nextLayer as string] = Date.now();
                (updated as unknown as Record<string, unknown>)[nextLayer as string] = {
                  ...(prev[nextLayer as keyof StreamingState] as object),
                  phase: "running" as LayerPhase,
                };
              }
              return updated;
            });
          }

          if (eventName === "complete") {
            setStreamState((prev) => ({
              ...prev,
              complete:      true,
              overallStatus: payload.overallStatus as StreamingState["overallStatus"],
              summary:       payload.summary as string,
              checkId:       payload.checkId as string,
              // Ensure all layers are marked done or skipped
              technical:     { ...prev.technical,     phase: prev.technical.phase     === "running" ? "done" : prev.technical.phase },
              platform_rule: { ...prev.platform_rule, phase: prev.platform_rule.phase === "running" ? "done" : prev.platform_rule.phase },
              geo_rule:      { ...prev.geo_rule,       phase: prev.geo_rule.phase      === "running" ? "done" : prev.geo_rule.phase },
              ai_text:       { ...prev.ai_text,        phase: prev.ai_text.phase       === "running" ? "done" : prev.ai_text.phase },
              image:         { ...prev.image,          phase: prev.image.phase         === "running" ? "done" : prev.image.phase === "pending" ? "skipped" : prev.image.phase },
            }));
            // Refresh Checkdit balance after check completes
            window.dispatchEvent(new Event("checkdit-used"));
            fetch("/api/user/checkdits")
              .then(r => r.ok ? r.json() : null)
              .then(data => { if (data?.limit !== null) setCheckdits(data); })
              .catch(() => {});
          }

          if (eventName === "error") {
            setStreamState((prev) => ({
              ...prev,
              error: (payload.message as string) ?? "Analysis failed. Please try again.",
            }));
            setStreaming(false);
          }
        }
      }
    } catch {
      setError("Network error. Please try again.");
      setStreaming(false);
    }
  }

  function handleStartOver() {
    setStreaming(false);
    setStreamState(initialStreamingState());
    setError(null);
  }

  function renderStep() {
    switch (currentStep) {
      case 1:
        return (
          <ChannelSelector
            platforms={platforms}
            loading={dataLoading}
            selectedPlatforms={selectedPlatforms}
            onChange={setSelectedPlatforms}
          />
        );
      case 2:
        return (
          <AdContentForm
            selectedPlatformData={selectedPlatformData}
            adContent={adContent}
            onChange={setAdContent}
          />
        );
      case 3:
        return <AssetUploader assets={assets} onChange={setAssets} />;
      case 4:
        return (
          <CategorySelector
            categories={categories}
            loading={dataLoading}
            selectedCategories={selectedCategories}
            adContent={adContent}
            onChange={setSelectedCategories}
          />
        );
      case 5:
        return (
          <GeoSelector
            countries={countries}
            loading={dataLoading}
            selectedCountries={selectedCountries}
            onChange={setSelectedCountries}
          />
        );
      case 6:
        return (
          <ReviewStep
            platforms={platforms}
            selectedPlatforms={selectedPlatforms}
            categories={categories}
            selectedCategories={selectedCategories}
            countries={countries}
            selectedCountries={selectedCountries}
            adContent={adContent}
            assets={assets}
            onRunCheck={handleRunCheck}
            running={streaming}
            onCertificationsResolved={handleCertificationsResolved}
            onRegulatoryResolved={handleRegulatoryResolved}
            regulatoryAllConfirmed={regulatoryAllConfirmed}
          />
        );
      default:
        return null;
    }
  }

  const currentStepData = STEPS.find((s) => s.id === currentStep)!;

  // ── Streaming mode ──────────────────────────────────────────────────────────
  if (streaming) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Compliance Checker</h1>
            <p className="text-slate-500 mt-1 text-sm">
              AI-powered analysis running across all compliance layers.
            </p>
          </div>
          {(streamState.complete || streamState.error) && (
            <Button variant="ghost" size="sm" onClick={handleStartOver} className="text-slate-500">
              <RotateCcw className="mr-1.5 h-4 w-4" />
              New check
            </Button>
          )}
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="pt-6 pb-6">
            <StreamingProgress state={streamState} />
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Bulk preview mode ─────────────────────────────────────────────────────
  if (bulkMode === "preview" && bulkPreview) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="pt-6 pb-6">
            <BulkPreviewDialog
              filename={bulkFilename}
              preview={bulkPreview}
              onRunInstant={handleBulkRunInstant}
              onRunBatch={() => { /* TODO: batch mode */ }}
              recheckAll={bulkRecheckAll}
              onRecheckAllChange={handleBulkRecheckAllChange}
              recheckLoading={bulkRecheckLoading}
              onCancel={handleBulkCancel}
              loading={bulkLoading}
            />
          </CardContent>
        </Card>

        {/* Context selectors for bulk check */}
        {(() => {
          const allSet = selectedPlatforms.length > 0 && selectedCategories.length > 0 && selectedCountries.length > 0;
          return (
            <Card className={allSet ? "border-slate-200 shadow-sm" : "border-amber-200 bg-amber-50 shadow-sm"}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-2 mb-4">
                  {!allSet ? (
                    <>
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-700">
                        Select a channel, category, and country below before running the bulk check.
                        These apply to all rows in the CSV.
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-600">
                      Check settings — these apply to all rows in the CSV. Modify if needed.
                    </p>
                  )}
                </div>
                <div className="space-y-4">
                  <ChannelSelector
                    platforms={platforms}
                    loading={dataLoading}
                    selectedPlatforms={selectedPlatforms}
                    onChange={setSelectedPlatforms}
                  />
                  <CategorySelector
                    categories={categories}
                    loading={dataLoading}
                    selectedCategories={selectedCategories}
                    adContent={adContent}
                    onChange={setSelectedCategories}
                    hint="Choose the category that best describes your overall campaign. Each individual ad will be scanned and assigned its most appropriate category automatically — you can change these per-row in the results."
                  />
                  <GeoSelector
                    countries={countries}
                    loading={dataLoading}
                    selectedCountries={selectedCountries}
                    onChange={setSelectedCountries}
                  />
                  {/* Certification prompt for bulk */}
                  {allSet && (
                    <CertificationPrompt
                      platformIds={selectedPlatforms}
                      categoryIds={selectedCategories}
                      onCertificationsResolved={handleCertificationsResolved}
                    />
                  )}
                  {/* Regulatory warnings for bulk */}
                  {allSet && (
                    <RegulatoryConfirmation
                      platformIds={selectedPlatforms}
                      categoryIds={selectedCategories}
                      countryIds={selectedCountries}
                      onResolved={handleRegulatoryResolved}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>
    );
  }

  // ── Bulk running / complete mode ──────────────────────────────────────────
  if (bulkMode === "running" || bulkMode === "complete") {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Bulk Compliance Check</h1>
            <p className="text-slate-500 mt-1 text-sm">{bulkFilename}</p>
          </div>
          {bulkMode === "complete" && (
            <Button variant="ghost" size="sm" onClick={handleBulkCancel} className="text-slate-500">
              <RotateCcw className="mr-1.5 h-4 w-4" />
              New check
            </Button>
          )}
        </div>

        <BulkComplianceTable
          rows={bulkRows}
          processing={bulkMode === "running"}
          processedCount={bulkProcessedCount}
          totalUniqueRows={bulkTotalUnique}
          summary={bulkSummary}
          onEditCell={handleBulkEditCell}
          onRowUpdated={handleBulkRowUpdated}
          onCategoryChange={handleBulkCategoryChange}
          onCategoryOverrideAcknowledged={handleBulkCategoryOverrideAcknowledged}
          onDownloadCsv={handleBulkDownloadCsv}
          platformIds={selectedPlatforms}
          categoryIds={selectedCategories}
          countryIds={selectedCountries}
          availableCategories={categories.map((c) => ({ id: c.id, name: c.name, restrictionLevel: c.restrictionLevel }))}
        />
      </div>
    );
  }

  // ── Normal step form ────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Compliance Checker</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Build your ad check step by step, then run AI-powered compliance
          analysis.
        </p>
      </div>

      {/* Bulk upload zone */}
      <BulkUploadZone onFileParsed={handleBulkFileParsed} disabled={bulkLoading} />

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs text-slate-400 font-medium">or check a single ad below</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      {/* Step indicator */}
      <StepIndicator
        steps={STEPS}
        currentStep={currentStep}
        onNavigate={setCurrentStep}
      />

      {/* Step card */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="pt-6 pb-6">
          {/* Step header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#1A56DB] to-[#1A56DB]/70">
              <currentStepData.icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {currentStepData.label}
              </h2>
              <p className="text-xs text-slate-400">
                Step {currentStep} of {STEPS.length}
              </p>
            </div>
          </div>

          {/* Step content */}
          {renderStep()}

          {/* Error */}
          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      {currentStep < STEPS.length && (
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
            disabled={currentStep === 1}
            className="text-slate-600"
          >
            <ChevronLeft className="mr-1.5 h-4 w-4" />
            Back
          </Button>

          <div className="flex items-center gap-2">
            {selectedPlatforms.length > 0 && (
              <span className="text-xs text-slate-400 hidden sm:inline">
                {selectedPlatforms.length} channel{selectedPlatforms.length !== 1 ? "s" : ""}
              </span>
            )}
            {selectedCountries.length > 0 && (
              <span className="text-xs text-slate-400 hidden sm:inline">
                · {selectedCountries.length} countr{selectedCountries.length !== 1 ? "ies" : "y"}
              </span>
            )}
            <Button
              onClick={() => setCurrentStep((s) => Math.min(STEPS.length, s + 1))}
            >
              {currentStep === STEPS.length - 1 ? "Review" : "Next"}
              <ChevronRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {currentStep === STEPS.length && checkdits && (
        <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
          <Coins className="h-4 w-4 shrink-0" />
          <span>
            This check will use <strong>1 Checkdit</strong>.
            You have <strong>{checkdits.remaining.toLocaleString()}</strong> of{" "}
            {checkdits.limit.toLocaleString()} remaining this month.
          </span>
        </div>
      )}

      {currentStep === STEPS.length && (
        <div className="flex justify-start">
          <Button
            variant="ghost"
            onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
            className="text-slate-600"
          >
            <ChevronLeft className="mr-1.5 h-4 w-4" />
            Back to Geography
          </Button>
        </div>
      )}
    </div>
  );
}
