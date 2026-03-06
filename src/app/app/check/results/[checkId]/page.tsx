"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  AlertTriangle,
  XCircle,
  ArrowLeft,
  ClipboardCheck,
  Loader2,
  Globe,
  Monitor,
  Tag,
  FileDown,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdContentForm } from "@/components/checker/AdContentForm";
import { ChannelSelector } from "@/components/checker/ChannelSelector";
import { GeoSelector } from "@/components/checker/GeoSelector";
import { IssueFlag } from "@/components/checker/IssueFlag";
import { SafeZoneOverlay } from "@/components/checker/SafeZoneOverlay";
import { ImageCompliancePanel } from "@/components/checker/ImageCompliancePanel";
import { ComplianceChecklist } from "@/components/checker/ComplianceChecklist";
import type {
  ComplianceResult,
  ComplianceIssue,
  ComplianceChecklistItem,
  ChecklistOverride,
  AcceptedRewrite,
  AdContentPayload,
} from "@/lib/ai/runComplianceCheck";
import { getOriginalText } from "@/lib/rewrite-utils";
import type { RewriteableField } from "@/lib/rewrite-utils";
import type { ImageAnalysisOutput } from "@/lib/ai/runImageAnalysis";
import type { AdContent } from "@/components/checker/AdContentForm";
import type { Platform } from "@/components/checker/ChannelSelector";
import type { Country } from "@/components/checker/GeoSelector";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CheckData {
  id: string;
  status: string;
  overallStatus: string | null;
  platformIds: string[];
  categoryIds: string[];
  countryIds: string[];
  adContent: AdContent | null;
  assetUrls: string[];
  results: (ComplianceResult & { imageAnalyses?: ImageAnalysisOutput[] }) | null;
  createdAt: string;
  completedAt: string | null;
}

// ─── Version chain (localStorage, no backend required) ───────────────────────

const LS_TS   = (id: string) => `acp:ts:${id}`;
const LS_UP   = (id: string) => `acp:up:${id}`; // child → parent
const LS_DOWN = (id: string) => `acp:dn:${id}`; // parent → child

interface VersionEntry { id: string; version: number; createdAt: string }

function buildVersionChain(currentId: string): VersionEntry[] {
  try {
    // Walk up to root
    const chain: string[] = [];
    let cursor: string | null = currentId;
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor)) {
      chain.unshift(cursor);
      seen.add(cursor);
      cursor = localStorage.getItem(LS_UP(cursor));
    }
    // Walk down from current node
    cursor = currentId;
    while (true) {
      const child = localStorage.getItem(LS_DOWN(cursor!));
      if (!child || seen.has(child)) break;
      chain.push(child);
      seen.add(child);
      cursor = child;
    }
    return chain.map((id, i) => ({
      id,
      version: i + 1,
      createdAt: localStorage.getItem(LS_TS(id)) ?? "",
    }));
  } catch {
    return [];
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function issuesForField(issues: ComplianceIssue[], field: string) {
  return issues.filter((i) => i.field === field);
}
function issuesForIndexedField(issues: ComplianceIssue[], base: string, index: number) {
  return issues.filter((i) => i.field === `${base}[${index}]`);
}

// Normalise results that may be stored in the old or new format
function normaliseChecklist(results: ComplianceResult | null): ComplianceChecklistItem[] {
  if (!results) return [];
  if (results.checklist?.length) return results.checklist;
  // Legacy: derive checklist from issues array so old checks still render
  if (results.issues?.length) {
    return results.issues.map((issue, i) => ({
      id: `legacy:${i}`,
      layer: "ai_text" as const,
      ruleTitle: issue.title,
      status: issue.severity === "violation" ? "FAIL" : "WARNING",
      reason: issue.explanation,
      explanation: issue.explanation,
      suggestion: issue.suggestion,
      ruleReference: issue.ruleReference,
      applicablePlatforms: issue.applicablePlatforms,
      applicableCountries: issue.applicableCountries,
      isOverrideable: issue.severity === "warning",
      aiGenerated: true,
    }));
  }
  return [];
}

// ─── Status banner ────────────────────────────────────────────────────────────

function StatusBanner({
  status,
  summary,
  failCount,
  warnCount,
  overrideCount,
}: {
  status: string;
  summary: string;
  failCount: number;
  warnCount: number;
  overrideCount: number;
}) {
  const effectiveFails = failCount;
  const effectiveWarns = warnCount - overrideCount;

  if (status === "CLEAN" || (effectiveFails === 0 && effectiveWarns <= 0)) {
    return (
      <div className="flex items-start gap-4 rounded-2xl border border-green-200 bg-gradient-to-r from-green-50 to-white p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100">
          <ShieldCheck className="h-6 w-6 text-green-600" />
        </div>
        <div>
          <h2 className="font-semibold text-green-800">
            {overrideCount > 0 ? "Compliant — with overrides" : "No compliance issues found"}
          </h2>
          <p className="text-sm text-green-700 mt-1">{summary}</p>
        </div>
      </div>
    );
  }

  if (status === "WARNINGS" || (effectiveFails === 0 && effectiveWarns > 0)) {
    return (
      <div className="flex items-start gap-4 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
          <AlertTriangle className="h-6 w-6 text-amber-600" />
        </div>
        <div>
          <h2 className="font-semibold text-amber-800">
            {effectiveWarns} warning{effectiveWarns !== 1 ? "s" : ""} — review before submitting
          </h2>
          <p className="text-sm text-amber-700 mt-1">{summary}</p>
        </div>
      </div>
    );
  }

  if (status === "VIOLATIONS" || effectiveFails > 0) {
    const total = effectiveFails + Math.max(0, effectiveWarns);
    return (
      <div className="flex items-start gap-4 rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 to-white p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
          <XCircle className="h-6 w-6 text-red-600" />
        </div>
        <div>
          <h2 className="font-semibold text-red-800">
            {total} issue{total !== 1 ? "s" : ""} found — resolve failures before submitting
          </h2>
          <p className="text-sm text-red-700 mt-1">{summary}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <XCircle className="h-6 w-6 text-slate-400 shrink-0 mt-0.5" />
      <div>
        <h2 className="font-semibold text-slate-700">Check failed</h2>
        <p className="text-sm text-slate-500 mt-1">An error occurred. Please run a new check.</p>
      </div>
    </div>
  );
}

// ─── Ad preview ───────────────────────────────────────────────────────────────

function AdPreview({
  adContent,
  assetUrls,
  allIssues,
  platformSlugs,
  imageAnalyses,
}: {
  adContent: AdContent;
  assetUrls: string[];
  allIssues: ComplianceIssue[];
  platformSlugs: string[];
  imageAnalyses: ImageAnalysisOutput[];
}) {
  const hasAnyContent =
    adContent.headline ||
    adContent.body ||
    adContent.callToAction ||
    adContent.displayUrl ||
    adContent.googleHeadlines?.some((h) => h?.trim()) ||
    adContent.googleDescriptions?.some((d) => d?.trim());

  if (!hasAnyContent && !assetUrls.length) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
        Ad Preview
      </h3>
      <div className="space-y-3">
        {adContent.headline && (
          <IssueFlag issues={issuesForField(allIssues, "headline")} side="right">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-400 mb-0.5">Headline</p>
              <p className="text-sm font-medium text-slate-800">{adContent.headline}</p>
            </div>
          </IssueFlag>
        )}
        {adContent.body && (
          <IssueFlag issues={issuesForField(allIssues, "body")} side="right">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-400 mb-0.5">Body Text</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap line-clamp-6">{adContent.body}</p>
            </div>
          </IssueFlag>
        )}
        {adContent.callToAction && (
          <IssueFlag issues={issuesForField(allIssues, "callToAction")} side="right">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-400 mb-0.5">Call to Action</p>
              <p className="text-sm text-slate-700">{adContent.callToAction}</p>
            </div>
          </IssueFlag>
        )}
        {adContent.displayUrl && (
          <IssueFlag issues={issuesForField(allIssues, "displayUrl")} side="right">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-400 mb-0.5">Display URL</p>
              <p className="text-sm font-mono text-green-700">{adContent.displayUrl}</p>
            </div>
          </IssueFlag>
        )}
        {adContent.googleHeadlines?.some((h) => h?.trim()) && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-400 mb-1.5">Google Ads Headlines</p>
            <div className="space-y-1.5">
              {adContent.googleHeadlines
                .map((h, i) => ({ h, i }))
                .filter(({ h }) => h?.trim())
                .map(({ h, i }) => (
                  <IssueFlag
                    key={i}
                    issues={issuesForIndexedField(allIssues, "googleHeadlines", i)}
                    side="right"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-4 shrink-0 text-right">{i + 1}.</span>
                      <p className="text-sm text-slate-800">{h}</p>
                    </div>
                  </IssueFlag>
                ))}
            </div>
          </div>
        )}
        {adContent.googleDescriptions?.some((d) => d?.trim()) && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-400 mb-1.5">Google Ads Descriptions</p>
            <div className="space-y-1.5">
              {adContent.googleDescriptions
                .map((d, i) => ({ d, i }))
                .filter(({ d }) => d?.trim())
                .map(({ d, i }) => (
                  <IssueFlag
                    key={i}
                    issues={issuesForIndexedField(allIssues, "googleDescriptions", i)}
                    side="right"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-4 shrink-0 text-right">{i + 1}.</span>
                      <p className="text-sm text-slate-700">{d}</p>
                    </div>
                  </IssueFlag>
                ))}
            </div>
          </div>
        )}
      </div>
      {assetUrls.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">Assets ({assetUrls.length})</p>
          <div className="grid grid-cols-2 gap-3">
            {assetUrls.map((url, i) => {
              const analysis = imageAnalyses.find((a) => a.imageUrl === url);
              return (
                <IssueFlag key={i} issues={issuesForField(allIssues, "asset")} side="right">
                  {analysis ? (
                    <ImageCompliancePanel
                      imageUrl={url}
                      alt={`Asset ${i + 1}`}
                      platformSlugs={platformSlugs}
                      zones={analysis.zones}
                      detectedText={analysis.detectedText}
                      imageDescription={analysis.imageDescription}
                      confidence={analysis.confidence}
                    />
                  ) : (
                    <SafeZoneOverlay imageUrl={url} alt={`Asset ${i + 1}`} platformSlugs={platformSlugs} />
                  )}
                </IssueFlag>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ResultsPage() {
  const params = useParams<{ checkId: string }>();
  const router = useRouter();

  const [check, setCheck] = useState<CheckData | null>(null);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<ChecklistOverride[]>([]);
  const [acceptedRewrites, setAcceptedRewrites] = useState<AcceptedRewrite[]>([]);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [editContent, setEditContent] = useState<AdContent>({
    headline: "", body: "", callToAction: "", displayUrl: "",
    googleHeadlines: [], googleDescriptions: [],
  });
  // Editable selections for the re-run (user can change channels + geo)
  const [editPlatformIds, setEditPlatformIds] = useState<string[]>([]);
  const [editCountryIds, setEditCountryIds] = useState<string[]>([]);
  // Stored atomically from API load so the Sheet always has the right platforms
  const [checkPlatforms, setCheckPlatforms] = useState<Platform[]>([]);
  const [versionChain, setVersionChain] = useState<VersionEntry[]>([]);
  const [rerunning, setRerunning] = useState(false);
  const [rerunError, setRerunError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.checkId) return;
    Promise.all([
      fetch(`/api/compliance/${params.checkId}`).then((r) => r.json()),
      fetch("/api/platforms").then((r) => r.json()),
      fetch("/api/countries/approved").then((r) => r.json()),
    ])
      .then(([checkData, platformData, countryData]) => {
        if (checkData.success) {
          setCheck(checkData.data);
          // Restore any overrides / accepted rewrites stored in results
          const savedOverrides: ChecklistOverride[] = checkData.data?.results?.overrides ?? [];
          const savedRewrites: AcceptedRewrite[] = checkData.data?.results?.acceptedRewrites ?? [];
          setOverrides(savedOverrides);
          setAcceptedRewrites(savedRewrites);
          // Pre-fill the edit sheet with accepted rewrites already applied
          if (checkData.data?.adContent) {
            const baseContent: AdContent = {
              headline: "", body: "", callToAction: "", displayUrl: "",
              googleHeadlines: [], googleDescriptions: [],
              ...checkData.data.adContent,
            };
            const mutableContent = baseContent as unknown as Record<string, unknown>;
            for (const rewrite of savedRewrites) {
              const field = rewrite.field as string;
              const indexedMatch = field.match(/^(googleHeadlines|googleDescriptions)\[(\d+)\]$/);
              if (indexedMatch) {
                const [, key, idxStr] = indexedMatch;
                const arr = [...((mutableContent[key] as string[]) ?? [])];
                arr[parseInt(idxStr)] = rewrite.newText;
                mutableContent[key] = arr;
              } else {
                mutableContent[field] = rewrite.newText;
              }
            }
            setEditContent(baseContent);
          }
          // Initialise editable platform/country selections from the original check
          setEditPlatformIds(checkData.data.platformIds ?? []);
          setEditCountryIds(checkData.data.countryIds ?? []);
          // Persist timestamp for version chain and build the chain
          try {
            localStorage.setItem(LS_TS(params.checkId), checkData.data.createdAt);
            setVersionChain(buildVersionChain(params.checkId));
          } catch { /* localStorage unavailable */ }
        } else {
          setError(checkData.error?.message ?? "Failed to load results");
        }
        if (platformData.success) {
          setPlatforms(platformData.data);
          // Store platforms keyed by this check so the Sheet always has them
          if (checkData.success) {
            const filtered = (platformData.data as Platform[]).filter(
              (p) => checkData.data.platformIds.includes(p.id)
            );
            setCheckPlatforms(filtered);
          }
        }
        if (countryData.success) {
          setCountries(countryData.data);
        }
      })
      .catch(() => setError("Network error. Please try again."))
      .finally(() => setLoading(false));
  }, [params.checkId]);

  const handleOverride = useCallback(
    (itemId: string, reason: string) => {
      const newOverride: ChecklistOverride = {
        itemId,
        reason,
        overriddenBy: "current-user",
        overriddenAt: new Date().toISOString(),
      };
      setOverrides((prev) => {
        const next = [...prev.filter((o) => o.itemId !== itemId), newOverride];
        // Persist overrides to the check record via a PATCH
        fetch(`/api/compliance/${params.checkId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ overrides: next }),
        }).catch(() => {}); // fire-and-forget
        return next;
      });
    },
    [params.checkId]
  );

  const handleUndoOverride = useCallback(
    (itemId: string) => {
      setOverrides((prev) => {
        const next = prev.filter((o) => o.itemId !== itemId);
        fetch(`/api/compliance/${params.checkId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ overrides: next }),
        }).catch(() => {});
        return next;
      });
    },
    [params.checkId]
  );

  const handleAcceptRewrite = useCallback(
    (rewrite: AcceptedRewrite) => {
      setAcceptedRewrites((prev) => {
        const next = [...prev.filter((r) => r.itemId !== rewrite.itemId), rewrite];
        fetch(`/api/compliance/${params.checkId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ acceptedRewrites: next }),
        }).catch(() => {});
        return next;
      });
    },
    [params.checkId]
  );

  const handleUndoRewrite = useCallback(
    (itemId: string) => {
      setAcceptedRewrites((prev) => {
        const next = prev.filter((r) => r.itemId !== itemId);
        fetch(`/api/compliance/${params.checkId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ acceptedRewrites: next }),
        }).catch(() => {});
        return next;
      });
    },
    [params.checkId]
  );

  // Must be before early returns to satisfy Rules of Hooks
  const effectiveAdContent = useMemo<AdContentPayload>(() => {
    const base: AdContentPayload = {
      headline: "",
      body: "",
      callToAction: "",
      displayUrl: "",
      googleHeadlines: [],
      googleDescriptions: [],
      ...(check?.adContent ?? {}),
    };
    for (const rewrite of acceptedRewrites) {
      const field = rewrite.field as RewriteableField;
      const indexedMatch = (field as string).match(/^(googleHeadlines|googleDescriptions)\[(\d+)\]$/);
      if (indexedMatch) {
        const [, key, idxStr] = indexedMatch;
        const arr = [...((base[key as "googleHeadlines" | "googleDescriptions"]) ?? [])];
        arr[parseInt(idxStr)] = rewrite.newText;
        (base as Record<string, unknown>)[key] = arr;
      } else {
        (base as Record<string, unknown>)[field as string] = rewrite.newText;
      }
    }
    return base;
  }, [check?.adContent, acceptedRewrites]);

  function buildContentPayload(content: AdContent): AdContentPayload {
    const p: AdContentPayload = {};
    if (content.headline?.trim()) p.headline = content.headline.trim();
    if (content.body?.trim()) p.body = content.body.trim();
    if (content.callToAction?.trim()) p.callToAction = content.callToAction.trim();
    if (content.displayUrl?.trim()) p.displayUrl = content.displayUrl.trim();
    const heads = content.googleHeadlines?.filter((h) => h?.trim());
    if (heads?.length) p.googleHeadlines = heads;
    const descs = content.googleDescriptions?.filter((d) => d?.trim());
    if (descs?.length) p.googleDescriptions = descs;
    return p;
  }

  async function handleRerun() {
    if (!check) return;
    setRerunError(null);
    setRerunning(true);

    try {
      const res = await fetch("/api/compliance/check/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platformIds: editPlatformIds,
          categoryIds: check.categoryIds,
          countryIds: editCountryIds,
          adContent: buildContentPayload(editContent),
          assets: [],
        }),
      });

      if (!res.ok || !res.body) {
        setRerunError("Failed to start compliance check. Please try again.");
        setRerunning(false);
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

          if (eventName === "complete") {
            const newCheckId = payload.checkId as string;
            try {
              localStorage.setItem(LS_UP(newCheckId), params.checkId);
              localStorage.setItem(LS_DOWN(params.checkId), newCheckId);
            } catch { /* localStorage unavailable */ }
            router.push(`/app/check/results/${newCheckId}`);
            return;
          }

          if (eventName === "error") {
            setRerunError((payload.message as string) ?? "Analysis failed. Please try again.");
            setRerunning(false);
            return;
          }
        }
      }
    } catch {
      setRerunError("Network error. Please try again.");
      setRerunning(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto flex items-center gap-3 py-12">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        <p className="text-slate-500">Loading results…</p>
      </div>
    );
  }

  if (error || !check) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">{error ?? "Results not found"}</p>
            <button
              onClick={() => router.push("/app/check")}
              className="text-sm text-red-600 hover:underline mt-1"
            >
              Run a new check →
            </button>
          </div>
        </div>
      </div>
    );
  }

  const results = check.results;
  const status = check.overallStatus ?? check.status;
  const checklist = normaliseChecklist(results);
  const allIssues = results?.issues ?? [];
  const imageAnalyses: ImageAnalysisOutput[] = results?.imageAnalyses ?? [];

  const overrideMap = new Map(overrides.map((o) => [o.itemId, o]));
  const failItems = checklist.filter(
    (i) => i.status === "FAIL" && !overrideMap.has(i.id)
  );
  const warnItems = checklist.filter(
    (i) => i.status === "WARNING" && !overrideMap.has(i.id)
  );
  const passItems = checklist.filter(
    (i) => i.status === "PASS" || overrideMap.has(i.id)
  );

  const selectedPlatforms = platforms.filter((p) => check.platformIds.includes(p.id));
  const platformSlugs = selectedPlatforms.map((p) => p.slug);
  const platformNames = selectedPlatforms.map((p) => p.name);
  // Platforms currently selected for the edit/re-run (may differ from original check)
  const editPlatformData = platforms.filter((p) => editPlatformIds.includes(p.id));

  const adContent: AdContent = {
    headline: "",
    body: "",
    callToAction: "",
    displayUrl: "",
    googleHeadlines: [],
    googleDescriptions: [],
    ...(check.adContent ?? {}),
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div>
        <Link
          href="/app/check"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          New check
        </Link>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">Compliance Results</h1>
              {versionChain.length > 0 && (
                <span className="inline-flex items-center rounded-full bg-[#1A56DB]/10 px-2.5 py-0.5 text-xs font-semibold text-[#1A56DB]">
                  v{versionChain.find((v) => v.id === params.checkId)?.version ?? 1}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400 mt-0.5">
              Checked{" "}
              {new Date(check.completedAt ?? check.createdAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {status !== "ERROR" && status !== "RUNNING" && (
              <a
                href={`/api/compliance/${params.checkId}/report`}
                download
                className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
              >
                <FileDown className="h-4 w-4" />
                Download PDF
              </a>
            )}
            <Button
              onClick={() => setEditSheetOpen(true)}
              variant="outline"
              className="shrink-0 border-[#1A56DB]/40 text-[#1A56DB] hover:bg-[#1A56DB]/5"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit &amp; Re-run
            </Button>
            <Button
              onClick={() => router.push("/app/check")}
              variant="outline"
              className="shrink-0"
            >
              <ClipboardCheck className="mr-2 h-4 w-4" />
              Re-run Check
            </Button>
          </div>
        </div>
      </div>

      {/* ── Status banner ── */}
      <StatusBanner
        status={status}
        summary={results?.summary ?? ""}
        failCount={failItems.length}
        warnCount={checklist.filter((i) => i.status === "WARNING").length}
        overrideCount={overrides.length}
      />

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — Ad preview */}
        <div className="lg:col-span-2 space-y-6">
          {(adContent.headline ||
            adContent.body ||
            adContent.callToAction ||
            adContent.googleHeadlines?.some((h) => h?.trim()) ||
            check.assetUrls.length > 0) && (
            <Card className="border-slate-200">
              <CardContent className="pt-5 pb-5">
                <AdPreview
                  adContent={effectiveAdContent as AdContent}
                  assetUrls={check.assetUrls}
                  allIssues={allIssues}
                  platformSlugs={platformSlugs}
                  imageAnalyses={imageAnalyses}
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right — Summary */}
        <div className="space-y-4">
          <Card className="border-slate-200">
            <CardContent className="pt-5 pb-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700">Check Summary</h3>

              {/* Platforms */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Monitor className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">
                    Channels
                  </span>
                </div>
                {selectedPlatforms.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {selectedPlatforms.map((p) => (
                      <Badge key={p.id} variant="secondary" className="text-xs">
                        {p.name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">
                    {check.platformIds.length} platform{check.platformIds.length !== 1 ? "s" : ""}
                  </p>
                )}
              </div>

              {/* Countries */}
              {check.countryIds.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">
                        Countries
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {check.countryIds.length} countr{check.countryIds.length !== 1 ? "ies" : "y"} checked
                    </p>
                  </div>
                </>
              )}

              <Separator />

              {/* Verdict counts */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-red-600">
                    <XCircle className="h-3.5 w-3.5" />
                    Failures
                  </span>
                  <span className="font-semibold text-red-700">{failItems.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-amber-600">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Warnings
                  </span>
                  <span className="font-semibold text-amber-700">{warnItems.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-green-600">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Passed
                  </span>
                  <span className="font-semibold text-green-700">{passItems.length}</span>
                </div>
                {overrides.length > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-purple-600 text-xs">Overridden</span>
                    <span className="font-semibold text-purple-700 text-xs">{overrides.length}</span>
                  </div>
                )}
              </div>

              {status === "CLEAN" && checklist.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-1 text-xs text-slate-500">
                    <p className={cn(failItems.length === 0 ? "text-green-600" : "text-red-600")}>
                      {failItems.length === 0 ? "✓" : "✗"} Character limits checked
                    </p>
                    <p className="text-green-600">✓ Platform policies checked</p>
                    <p className="text-green-600">✓ Geographic regulations checked</p>
                    <p className="text-green-600">✓ AI content analysis complete</p>
                  </div>
                </>
              )}

              {/* Version history */}
              {versionChain.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Version History
                    </span>
                    <div className="space-y-1.5">
                      {versionChain.map(({ id, version, createdAt }) => {
                        const isCurrent = id === params.checkId;
                        return (
                          <div key={id} className="flex items-center gap-2">
                            <span
                              className={cn(
                                "shrink-0 w-6 text-xs font-semibold",
                                isCurrent ? "text-slate-900" : "text-slate-400"
                              )}
                            >
                              v{version}
                            </span>
                            <span
                              className={cn(
                                "flex-1 text-xs",
                                isCurrent ? "text-slate-700" : "text-slate-400"
                              )}
                            >
                              {createdAt
                                ? new Date(createdAt).toLocaleString(undefined, {
                                    dateStyle: "short",
                                    timeStyle: "short",
                                  })
                                : "—"}
                            </span>
                            {isCurrent ? (
                              <span className="text-xs font-medium text-slate-500">current</span>
                            ) : (
                              <Link
                                href={`/app/check/results/${id}`}
                                className="text-xs text-[#1A56DB] hover:underline shrink-0"
                              >
                                view
                              </Link>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Compliance checklist ── */}
      {checklist.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Compliance Checklist
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {checklist.length} rule{checklist.length !== 1 ? "s" : ""} checked across{" "}
                {platformNames.join(", ")}
              </p>
            </div>
          </div>

          <Card className="border-slate-200">
            <CardContent className="pt-5 pb-5">
              <ComplianceChecklist
                items={checklist}
                overrides={overrides}
                onOverride={handleOverride}
                onUndoOverride={handleUndoOverride}
                adContent={adContent as AdContentPayload}
                checkId={params.checkId}
                acceptedRewrites={acceptedRewrites}
                onAcceptRewrite={handleAcceptRewrite}
                onUndoRewrite={handleUndoRewrite}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Clean state ── */}
      {status === "CLEAN" && checklist.length === 0 && (
        <Card className="border-slate-200">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start gap-3">
              <Tag className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
              <div className="space-y-1 text-sm text-slate-500">
                <p className="font-medium text-slate-700">What was analysed</p>
                <p>Character limits against {platformNames.join(", ")} technical specifications</p>
                <p>Platform advertising policies for the selected product categories</p>
                <p>Geographic regulations for the selected countries</p>
                <p>AI content analysis against current platform policies</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Actions ── */}
      <Separator />
      <div className="flex items-center gap-3 flex-wrap pb-4">
        <Button
          onClick={() => router.push("/app/check")}
        >
          <ClipboardCheck className="mr-2 h-4 w-4" />
          Run Another Check
        </Button>
        {status !== "ERROR" && status !== "RUNNING" && (
          <a
            href={`/api/compliance/${params.checkId}/report`}
            download
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <FileDown className="h-4 w-4" />
            Download PDF
          </a>
        )}
        <Link href="/app/dashboard">
          <Button variant="ghost" className="text-slate-500">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Dashboard
          </Button>
        </Link>
      </div>

      {/* ── Edit & Re-run Sheet ── */}
      <Sheet open={editSheetOpen} onOpenChange={setEditSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto flex flex-col">
          <SheetHeader>
            <SheetTitle>Edit &amp; Re-run</SheetTitle>
            <p className="text-sm text-slate-500">
              Adjust your ad copy, channels, or geography — then run a new check.
            </p>
          </SheetHeader>

          <div className="flex-1 py-4">
            <Tabs defaultValue="copy">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="copy">Ad Copy</TabsTrigger>
                <TabsTrigger value="channels">Channels</TabsTrigger>
                <TabsTrigger value="geo">Geography</TabsTrigger>
              </TabsList>

              <TabsContent value="copy" className="mt-4">
                <AdContentForm
                  selectedPlatformData={editPlatformData}
                  adContent={editContent}
                  onChange={setEditContent}
                />
              </TabsContent>

              <TabsContent value="channels" className="mt-4">
                <ChannelSelector
                  platforms={platforms}
                  loading={platforms.length === 0}
                  selectedPlatforms={editPlatformIds}
                  onChange={setEditPlatformIds}
                />
              </TabsContent>

              <TabsContent value="geo" className="mt-4">
                <GeoSelector
                  countries={countries}
                  loading={countries.length === 0}
                  selectedCountries={editCountryIds}
                  onChange={setEditCountryIds}
                />
              </TabsContent>
            </Tabs>
          </div>

          <SheetFooter className="flex-col gap-2 sm:flex-col border-t pt-4">
            {rerunError && (
              <Alert variant="destructive">
                <AlertDescription>{rerunError}</AlertDescription>
              </Alert>
            )}
            {editPlatformIds.length === 0 && (
              <p className="text-xs text-amber-600">Select at least one channel before running.</p>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setEditSheetOpen(false)}
                disabled={rerunning}
              >
                Cancel
              </Button>
              <Button
                onClick={handleRerun}
                disabled={rerunning || editPlatformIds.length === 0}
              >
                {rerunning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running…
                  </>
                ) : (
                  <>
                    <ClipboardCheck className="mr-2 h-4 w-4" />
                    Run Check
                  </>
                )}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Full-page loading overlay ── */}
      {rerunning && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
          <Loader2 className="h-10 w-10 animate-spin text-[#1A56DB] mb-4" />
          <p className="text-sm font-medium text-slate-600">Running compliance check…</p>
        </div>
      )}
    </div>
  );
}
