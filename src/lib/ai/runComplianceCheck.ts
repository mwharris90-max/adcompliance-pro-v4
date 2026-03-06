import { db } from "@/lib/db";
import { anthropic } from "./client";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";

const HAIKU = "claude-haiku-4-5-20251001";
const SONNET = "claude-sonnet-4-6";

const SYSTEM_INSTRUCTION =
  "You are a senior digital advertising compliance analyst. You evaluate ad content against platform policies and advertising law. Be precise and specific — always identify the exact issue and what the advertiser needs to do to fix it. Never say \"review the policy\" without specifying what policy element is relevant and what action is required.";

// Static Part 1 instructions — placed in system prompt for prompt caching.
// Anthropic caches system prompt prefixes, so this saves ~500 input tokens on repeat calls.
const PART1_SYSTEM_ADDENDUM = `
TASK: Evaluate ads against restricted advertising rules. For each rule, break it into individual compliance requirements (minimum 3 per rule).

Status: PASS = clearly satisfies | WARNING = ambiguous/gap | FAIL = clearly breaches

Rules:
- Return at least 3 requirement entries per rule
- ABSENT required elements (e.g. no disclaimer) = FAIL
- Quote EXACT triggering text for WARNING/FAIL (blank for missing elements)
- Provide specific, actionable suggestion for every WARNING/FAIL`;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdContentPayload {
  headline?: string;
  body?: string;
  callToAction?: string;
  displayUrl?: string;
  googleHeadlines?: string[];
  googleDescriptions?: string[];
}

export type ChecklistStatus = "PASS" | "WARNING" | "FAIL";
export type ChecklistLayer =
  | "technical"
  | "platform_rule"
  | "geo_rule"
  | "ai_text"
  | "image";

export interface AssetMetadata {
  url: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
}

export interface ComplianceChecklistItem {
  id: string;
  layer: ChecklistLayer;
  ruleId?: string;
  ruleTitle: string;
  status: ChecklistStatus;
  reason: string;
  explanation: string;
  suggestion?: string;
  quotedContent?: string;
  ruleReference?: {
    source: string;
    url?: string;
    ruleText: string;
  };
  applicablePlatforms: string[];
  applicableCountries: string[];
  isOverrideable: boolean;
  aiGenerated: boolean;
}

export interface ChecklistOverride {
  itemId: string;
  reason: string;
  overriddenBy: string;
  overriddenAt: string;
}

export interface TrainingExample {
  id: string;
  title: string;
  contentSample: string;
  verdict: "COMPLIANT" | "NON_COMPLIANT";
  explanation: string;
  rubric: { key: string; value: string }[] | null;
}

export type RewriteableField =
  | "headline"
  | "body"
  | "callToAction"
  | "displayUrl"
  | `googleHeadlines[${number}]`
  | `googleDescriptions[${number}]`;

export interface AcceptedRewrite {
  itemId: string;
  field: RewriteableField;
  originalText: string;
  newText: string;
  acceptedAt: string;
}

// Legacy type kept for PDF + backwards compat
export interface ComplianceIssue {
  severity: "warning" | "violation";
  field: string;
  title: string;
  explanation: string;
  applicablePlatforms: string[];
  applicableCountries: string[];
  ruleReference?: { source: string; url?: string; ruleText: string };
  suggestion: string;
}

export interface ComplianceResult {
  overallStatus: "CLEAN" | "WARNINGS" | "VIOLATIONS";
  checklist: ComplianceChecklistItem[];
  overrides: ChecklistOverride[];
  summary: string;
  checkedAt: string;
  // Derived from checklist for PDF and legacy consumers
  issues: ComplianceIssue[];
  imageAnalyses?: import("./runImageAnalysis").ImageAnalysisOutput[];
  acceptedRewrites?: AcceptedRewrite[];
}

// ─── DB row types ─────────────────────────────────────────────────────────────

export type ChannelReqRow = {
  specKey: string;
  specType: string;
  value: string;
  platformId: string;
  notes?: string | null;
  platform: { name: string; slug: string };
};

export type PlatformRuleRow = {
  id: string;
  platformId: string;
  categoryId: string;
  status: string;
  notes: string | null;
  conditions: unknown;
  referenceUrl: string | null;
  platform: { name: string };
  category: { name: string };
};

export type GeoRuleRow = {
  id: string;
  countryId: string;
  categoryId: string;
  platformId: string | null;
  status: string;
  notes: string | null;
  restrictions: unknown;
  legislationUrl: string | null;
  country: { name: string };
  category: { name: string };
  platform: { name: string } | null;
};

// ─── Layer 1: Technical spec checks ──────────────────────────────────────────

// Converts a FILE_SIZE DB value to bytes.
// specKey naming convention: contains "_kb" → value is in KB; "_mb" → value is in MB.
function fileSizeToBytes(specKey: string, value: string): number {
  const n = parseInt(value);
  if (isNaN(n) || n <= 0) return Infinity;
  const key = specKey.toLowerCase();
  if (key.includes("_mb")) return n * 1024 * 1024;
  if (key.includes("_kb")) return n * 1024;
  return n; // fallback: assume bytes
}

export function checkTechnicalSpecs(
  adContent: AdContentPayload,
  requirements: ChannelReqRow[],
  assets: AssetMetadata[] = []
): ComplianceChecklistItem[] {
  const items: ComplianceChecklistItem[] = [];
  let allCharLimitsPass = true;

  for (const req of requirements) {
    if (req.specType !== "CHARACTER_LIMIT") continue;
    const limit = parseInt(req.value);
    if (isNaN(limit) || limit <= 0) continue;

    const pName = req.platform.name;
    const isGoogle = req.platform.slug.toLowerCase().includes("google");

    switch (req.specKey) {
      case "headline_char_limit": {
        if (isGoogle) {
          (adContent.googleHeadlines ?? []).forEach((h, i) => {
            if (!h.trim()) return;
            if (h.length > limit) {
              allCharLimitsPass = false;
              items.push({
                id: `technical:headline_char_limit:${req.platformId}:${i}`,
                layer: "technical",
                ruleTitle: `${pName} — Headline ${i + 1} character limit (${limit})`,
                status: "FAIL",
                reason: `Headline ${i + 1} is ${h.length} characters, exceeding the ${limit}-character limit.`,
                explanation: `Google Ads caps each headline at ${limit} characters and will not serve the ad until this is resolved. Headline ${i + 1}: "${h.slice(0, 60)}${h.length > 60 ? "…" : ""}" (${h.length} chars).`,
                quotedContent: h,
                suggestion: `Shorten headline ${i + 1} to ${limit} characters or fewer.`,
                applicablePlatforms: [pName],
                applicableCountries: [],
                isOverrideable: false,
                aiGenerated: false,
              });
            }
          });
        } else {
          if (adContent.headline && adContent.headline.length > limit) {
            allCharLimitsPass = false;
            items.push({
              id: `technical:headline_char_limit:${req.platformId}`,
              layer: "technical",
              ruleTitle: `${pName} — Headline character limit (${limit})`,
              status: "FAIL",
              reason: `Headline is ${adContent.headline.length} characters, exceeding the ${limit}-character limit.`,
              explanation: `${pName} limits headlines to ${limit} characters. Your headline is ${adContent.headline.length} characters.`,
              quotedContent: adContent.headline,
              suggestion: `Shorten your headline to ${limit} characters or fewer.`,
              applicablePlatforms: [pName],
              applicableCountries: [],
              isOverrideable: false,
              aiGenerated: false,
            });
          }
        }
        break;
      }

      case "description_char_limit": {
        if (isGoogle) {
          (adContent.googleDescriptions ?? []).forEach((d, i) => {
            if (!d.trim()) return;
            if (d.length > limit) {
              allCharLimitsPass = false;
              items.push({
                id: `technical:description_char_limit:${req.platformId}:${i}`,
                layer: "technical",
                ruleTitle: `${pName} — Description ${i + 1} character limit (${limit})`,
                status: "FAIL",
                reason: `Description ${i + 1} is ${d.length} characters, exceeding the ${limit}-character limit.`,
                explanation: `Google Ads limits each description to ${limit} characters. Description ${i + 1} is ${d.length} characters.`,
                quotedContent: d,
                suggestion: `Shorten description ${i + 1} to ${limit} characters or fewer.`,
                applicablePlatforms: [pName],
                applicableCountries: [],
                isOverrideable: false,
                aiGenerated: false,
              });
            }
          });
        } else {
          if (adContent.body && adContent.body.length > limit) {
            allCharLimitsPass = false;
            items.push({
              id: `technical:description_char_limit:${req.platformId}`,
              layer: "technical",
              ruleTitle: `${pName} — Caption character limit (${limit})`,
              status: "FAIL",
              reason: `Body text is ${adContent.body.length} characters, exceeding the ${limit}-character limit.`,
              explanation: `${pName} limits captions to ${limit} characters. Your body text is ${adContent.body.length} characters.`,
              quotedContent: adContent.body.slice(0, 100) + (adContent.body.length > 100 ? "…" : ""),
              suggestion: `Shorten your body text to ${limit} characters or fewer.`,
              applicablePlatforms: [pName],
              applicableCountries: [],
              isOverrideable: false,
              aiGenerated: false,
            });
          }
        }
        break;
      }

      case "primary_text_char_limit": {
        if (adContent.body && adContent.body.length > limit) {
          allCharLimitsPass = false;
          items.push({
            id: `technical:primary_text_char_limit:${req.platformId}`,
            layer: "technical",
            ruleTitle: `${pName} — Primary text recommended limit (${limit})`,
            status: "WARNING",
            reason: `Body text is ${adContent.body.length} characters; ${pName} recommends under ${limit} for best delivery.`,
            explanation: `${pName} recommends keeping primary text under ${limit} characters for optimal ad delivery. Your body text is ${adContent.body.length} characters. Longer text may be truncated in some placements.`,
            suggestion: `Consider shortening your body text to ${limit} characters or fewer for optimal delivery.`,
            applicablePlatforms: [pName],
            applicableCountries: [],
            isOverrideable: true,
            aiGenerated: false,
          });
        }
        break;
      }

      case "display_url_char_limit": {
        if (adContent.displayUrl && adContent.displayUrl.length > limit) {
          allCharLimitsPass = false;
          items.push({
            id: `technical:display_url_char_limit:${req.platformId}`,
            layer: "technical",
            ruleTitle: `${pName} — Display URL character limit (${limit})`,
            status: "FAIL",
            reason: `Display URL is ${adContent.displayUrl.length} characters, exceeding the ${limit}-character limit.`,
            explanation: `${pName} limits display URLs to ${limit} characters per path field. Your display URL is ${adContent.displayUrl.length} characters.`,
            quotedContent: adContent.displayUrl,
            suggestion: `Shorten your display URL to ${limit} characters or fewer.`,
            applicablePlatforms: [pName],
            applicableCountries: [],
            isOverrideable: false,
            aiGenerated: false,
          });
        }
        break;
      }

      case "headline_count_max": {
        const count = (adContent.googleHeadlines ?? []).filter((h) => h.trim()).length;
        if (count > limit) {
          allCharLimitsPass = false;
          items.push({
            id: `technical:headline_count_max:${req.platformId}`,
            layer: "technical",
            ruleTitle: `${pName} — Maximum headline count (${limit})`,
            status: "FAIL",
            reason: `${count} headlines provided; maximum is ${limit}.`,
            explanation: `Google Ads RSA allows a maximum of ${limit} headlines per ad. You have provided ${count}.`,
            suggestion: `Remove ${count - limit} headline${count - limit !== 1 ? "s" : ""} to meet the ${limit}-headline maximum.`,
            applicablePlatforms: [pName],
            applicableCountries: [],
            isOverrideable: false,
            aiGenerated: false,
          });
        }
        break;
      }

      case "description_count_max": {
        const count = (adContent.googleDescriptions ?? []).filter((d) => d.trim()).length;
        if (count > limit) {
          allCharLimitsPass = false;
          items.push({
            id: `technical:description_count_max:${req.platformId}`,
            layer: "technical",
            ruleTitle: `${pName} — Maximum description count (${limit})`,
            status: "FAIL",
            reason: `${count} descriptions provided; maximum is ${limit}.`,
            explanation: `Google Ads RSA allows a maximum of ${limit} descriptions per ad. You have provided ${count}.`,
            suggestion: `Remove ${count - limit} description${count - limit !== 1 ? "s" : ""} to meet the ${limit}-description maximum.`,
            applicablePlatforms: [pName],
            applicableCountries: [],
            isOverrideable: false,
            aiGenerated: false,
          });
        }
        break;
      }
    }
  }

  // ── Image spec checks ──────────────────────────────────────────────────────
  // Group requirements by platform so each spec type is evaluated once per
  // platform per asset — avoids one failure per DB row.
  if (assets.length > 0) {
    // Build a map: platformId → all its requirements
    const byPlatform = new Map<string, ChannelReqRow[]>();
    for (const req of requirements) {
      if (!["DIMENSIONS", "FILE_SIZE", "FILE_FORMAT"].includes(req.specType)) continue;
      const bucket = byPlatform.get(req.platformId) ?? [];
      bucket.push(req);
      byPlatform.set(req.platformId, bucket);
    }

    for (const [platformId, platformReqs] of byPlatform) {
      const pName = platformReqs[0].platform.name;
      const dimReqs    = platformReqs.filter((r) => r.specType === "DIMENSIONS");
      const sizeReqs   = platformReqs.filter((r) => r.specType === "FILE_SIZE");
      const formatReqs = platformReqs.filter((r) => r.specType === "FILE_FORMAT");

      // Build union of all accepted formats for this platform
      const allAcceptedFormats = new Set(
        formatReqs.flatMap((r) => r.value.split(",").map((f) => f.trim().toLowerCase()))
      );

      for (const asset of assets) {
        const assetName = asset.url.split("/").pop() ?? "asset";
        const isVideo = ["mp4", "mov", "avi", "webm", "wmv", "flv", "mpeg"].includes(
          asset.format.toLowerCase()
        );

        // ── FILE_FORMAT: one check per asset per platform ─────────────────
        if (formatReqs.length > 0 && asset.format) {
          const fmt = asset.format.toLowerCase();
          // Cloudinary returns "jpeg" but accepted lists usually say "jpg"
          const fmtAlias = fmt === "jpeg" ? "jpg" : fmt === "jpg" ? "jpeg" : null;
          const accepted = allAcceptedFormats.has(fmt) || (fmtAlias ? allAcceptedFormats.has(fmtAlias) : false);
          if (!accepted) {
            const fmtDisplay = fmt.toUpperCase();
            const allowedDisplay = [...allAcceptedFormats].map((f) => f.toUpperCase()).join(", ");
            items.push({
              id: `technical:file_format:${platformId}:${assetName}`,
              layer: "technical",
              ruleTitle: `${pName} — Unsupported file format (${fmtDisplay})`,
              status: "FAIL",
              reason: `"${fmtDisplay}" is not accepted by ${pName}. Allowed: ${allowedDisplay}.`,
              explanation: `${pName} only accepts: ${allowedDisplay}. This file is ${fmtDisplay} format.`,
              suggestion: `Convert the file to an accepted format: ${allowedDisplay.toLowerCase()}.`,
              applicablePlatforms: [pName],
              applicableCountries: [],
              isOverrideable: false,
              aiGenerated: false,
            });
          }
        }

        // ── FILE_SIZE: one check per asset per platform ───────────────────
        // Match image size reqs for images, video size reqs for videos
        if (sizeReqs.length > 0 && asset.bytes > 0) {
          const relevantReq = sizeReqs.find((r) =>
            isVideo
              ? r.specKey.toLowerCase().includes("video")
              : r.specKey.toLowerCase().includes("image")
          );
          if (relevantReq) {
            const maxBytes = fileSizeToBytes(relevantReq.specKey, relevantReq.value);
            if (asset.bytes > maxBytes) {
              const limitMb = (maxBytes / (1024 * 1024)).toFixed(0);
              const actualMb = (asset.bytes / (1024 * 1024)).toFixed(1);
              items.push({
                id: `technical:file_size:${platformId}:${assetName}`,
                layer: "technical",
                ruleTitle: `${pName} — File size exceeds ${limitMb} MB limit`,
                status: "FAIL",
                reason: `File is ${actualMb} MB, exceeding the ${limitMb} MB limit for ${pName}.`,
                explanation: `${pName} limits ${isVideo ? "video" : "image"} uploads to ${limitMb} MB. This file is ${actualMb} MB.`,
                suggestion: `Compress or resize the file to under ${limitMb} MB.`,
                applicablePlatforms: [pName],
                applicableCountries: [],
                isOverrideable: false,
                aiGenerated: false,
              });
            }
          }
        }

        // ── DIMENSIONS: one check per image asset per platform ────────────
        // Image must match at least one of the platform's supported dimensions.
        if (!isVideo && dimReqs.length > 0 && asset.width > 0 && asset.height > 0) {
          const validDims = dimReqs
            .map((r) => {
              const [w, h] = r.value.trim().split("x").map(Number);
              return w && h ? { w, h, label: r.notes ?? `${w}×${h}` } : null;
            })
            .filter((d): d is { w: number; h: number; label: string } => d !== null);

          const matchesAny = validDims.some(
            (d) => d.w === asset.width && d.h === asset.height
          );

          if (!matchesAny) {
            const supported = validDims.map((d) => `${d.w}×${d.h}`).join(", ");
            items.push({
              id: `technical:dimensions:${platformId}:${assetName}`,
              layer: "technical",
              ruleTitle: `${pName} — Image dimensions not supported (${asset.width}×${asset.height}px)`,
              status: "FAIL",
              reason: `${asset.width}×${asset.height}px is not a supported dimension for ${pName}.`,
              explanation: `${pName} supports the following image dimensions: ${supported}. Your image is ${asset.width}×${asset.height}px and does not match any of them.`,
              suggestion: `Resize your image to one of the supported dimensions: ${supported}.`,
              applicablePlatforms: [pName],
              applicableCountries: [],
              isOverrideable: false,
              aiGenerated: false,
            });
          }
        }
      }
    }
  }

  // Aggregate PASS if no technical violations found
  if (allCharLimitsPass && requirements.some((r) => r.specType === "CHARACTER_LIMIT")) {
    const platformNames = [...new Set(requirements.map((r) => r.platform.name))];
    items.push({
      id: "technical:character_limits:all_pass",
      layer: "technical",
      ruleTitle: "Character limits — all within bounds",
      status: "PASS",
      reason: "All text fields are within the character limits for the selected platforms.",
      explanation: `All headlines, body text, and other text fields are within the required character limits for ${platformNames.join(", ")}.`,
      applicablePlatforms: platformNames,
      applicableCountries: [],
      isOverrideable: false,
      aiGenerated: false,
    });
  }

  return items;
}

// ─── Layer 2: Deterministic + restricted rule checks ─────────────────────────
//
// RESTRICTED rules are NOT added here — they are expanded by AI into per-requirement
// items. Fallbacks are built separately and only used if AI is unavailable.

export function checkDeterministicRules(
  platformRules: PlatformRuleRow[],
  geoRules: GeoRuleRow[],
  platformNames: string[]
): ComplianceChecklistItem[] {
  const items: ComplianceChecklistItem[] = [];

  for (const rule of platformRules) {
    if (rule.status === "PROHIBITED") {
      items.push({
        id: `platform_rule:${rule.id}`,
        layer: "platform_rule",
        ruleId: rule.id,
        ruleTitle: `${rule.category.name} — prohibited on ${rule.platform.name}`,
        status: "FAIL",
        reason: `${rule.platform.name} does not permit advertising for "${rule.category.name}".`,
        explanation: `${rule.platform.name} explicitly prohibits advertising for the "${rule.category.name}" category. ${rule.notes ?? ""}`.trim(),
        suggestion: `Remove ${rule.platform.name} from your campaign or change the product category.`,
        ruleReference: rule.referenceUrl
          ? {
              source: `${rule.platform.name} Advertising Policies`,
              url: rule.referenceUrl,
              ruleText: rule.notes ?? `${rule.category.name} is prohibited on ${rule.platform.name}`,
            }
          : undefined,
        applicablePlatforms: [rule.platform.name],
        applicableCountries: [],
        isOverrideable: false,
        aiGenerated: false,
      });
    } else if (rule.status === "ALLOWED") {
      items.push({
        id: `platform_rule:${rule.id}`,
        layer: "platform_rule",
        ruleId: rule.id,
        ruleTitle: `${rule.category.name} — allowed on ${rule.platform.name}`,
        status: "PASS",
        reason: `"${rule.category.name}" advertising is permitted on ${rule.platform.name}.`,
        explanation: `${rule.platform.name} permits advertising for the "${rule.category.name}" category without restrictions.`,
        applicablePlatforms: [rule.platform.name],
        applicableCountries: [],
        isOverrideable: false,
        aiGenerated: false,
      });
    }
    // RESTRICTED: handled by AI — skipped here
  }

  for (const rule of geoRules) {
    const platformSuffix = rule.platform ? ` on ${rule.platform.name}` : "";
    const appliedPlatforms = rule.platform ? [rule.platform.name] : platformNames;

    if (rule.status === "PROHIBITED") {
      items.push({
        id: `geo_rule:${rule.id}`,
        layer: "geo_rule",
        ruleId: rule.id,
        ruleTitle: `${rule.category.name} — prohibited in ${rule.country.name}${platformSuffix}`,
        status: "FAIL",
        reason: `This category of advertising is not permitted in ${rule.country.name}${platformSuffix}.`,
        explanation: `${rule.category.name} advertising is prohibited in ${rule.country.name}${platformSuffix}. ${rule.notes ?? ""}`.trim(),
        suggestion: `Remove ${rule.country.name} from your target countries or change the product category.`,
        ruleReference: rule.legislationUrl
          ? {
              source: `${rule.country.name} Legislation`,
              url: rule.legislationUrl,
              ruleText: rule.notes ?? `${rule.category.name} advertising is prohibited in ${rule.country.name}`,
            }
          : undefined,
        applicablePlatforms: appliedPlatforms,
        applicableCountries: [rule.country.name],
        isOverrideable: false,
        aiGenerated: false,
      });
    } else if (rule.status === "ALLOWED") {
      items.push({
        id: `geo_rule:${rule.id}`,
        layer: "geo_rule",
        ruleId: rule.id,
        ruleTitle: `${rule.category.name} — allowed in ${rule.country.name}${platformSuffix}`,
        status: "PASS",
        reason: `"${rule.category.name}" advertising is permitted in ${rule.country.name}${platformSuffix}.`,
        explanation: `${rule.country.name} permits advertising for the "${rule.category.name}" category without restrictions.`,
        applicablePlatforms: appliedPlatforms,
        applicableCountries: [rule.country.name],
        isOverrideable: false,
        aiGenerated: false,
      });
    }
    // RESTRICTED: handled by AI — skipped here
  }

  return items;
}

// ─── Build fallback items for RESTRICTED rules ────────────────────────────────
//
// These are only shown if the AI is unavailable or fails to evaluate a rule.

export function buildRestrictedFallbacks(
  platformRules: PlatformRuleRow[],
  geoRules: GeoRuleRow[],
  platformNames: string[]
): Map<string, ComplianceChecklistItem> {
  const fallbacks = new Map<string, ComplianceChecklistItem>();

  for (const rule of platformRules) {
    if (rule.status !== "RESTRICTED") continue;
    const id = `platform_rule:${rule.id}`;
    fallbacks.set(id, {
      id,
      layer: "platform_rule",
      ruleId: rule.id,
      ruleTitle: `${rule.category.name} — restricted on ${rule.platform.name}`,
      status: "WARNING",
      reason: `Advertising for "${rule.category.name}" on ${rule.platform.name} is permitted with conditions.`,
      explanation: `${rule.platform.name} allows "${rule.category.name}" advertising subject to restrictions. ${rule.notes ?? "Review the platform policy for specific requirements."}`.trim(),
      suggestion: `Review ${rule.platform.name}'s advertising policy for "${rule.category.name}" to ensure all conditions are met.`,
      ruleReference: rule.referenceUrl
        ? {
            source: `${rule.platform.name} Advertising Policies`,
            url: rule.referenceUrl,
            ruleText: rule.notes ?? "Restricted category — additional requirements apply",
          }
        : undefined,
      applicablePlatforms: [rule.platform.name],
      applicableCountries: [],
      isOverrideable: true,
      aiGenerated: false,
    });
  }

  for (const rule of geoRules) {
    if (rule.status !== "RESTRICTED") continue;
    const id = `geo_rule:${rule.id}`;
    const platformSuffix = rule.platform ? ` on ${rule.platform.name}` : "";
    const appliedPlatforms = rule.platform ? [rule.platform.name] : platformNames;
    fallbacks.set(id, {
      id,
      layer: "geo_rule",
      ruleId: rule.id,
      ruleTitle: `${rule.category.name} — restricted in ${rule.country.name}${platformSuffix}`,
      status: "WARNING",
      reason: `Advertising for "${rule.category.name}" in ${rule.country.name} is permitted but with local restrictions.`,
      explanation: `${rule.country.name} permits "${rule.category.name}" advertising subject to local regulations. ${rule.notes ?? "Review local legislation for specific requirements."}`.trim(),
      suggestion: `Review local legislation for ${rule.country.name} and apply all required disclosures, targeting restrictions, and mandatory warnings.`,
      ruleReference: rule.legislationUrl
        ? {
            source: `${rule.country.name} Legislation`,
            url: rule.legislationUrl,
            ruleText: rule.notes ?? `${rule.category.name} advertising requires compliance with local restrictions`,
          }
        : undefined,
      applicablePlatforms: appliedPlatforms,
      applicableCountries: [rule.country.name],
      isOverrideable: true,
      aiGenerated: false,
    });
  }

  return fallbacks;
}

// ─── Prompt helpers ───────────────────────────────────────────────────────────

function buildAdContentSummary(adContent: AdContentPayload): string {
  const parts: string[] = [];
  if (adContent.headline) parts.push(`Headline: "${adContent.headline}"`);
  if (adContent.body) parts.push(`Body Text: "${adContent.body}"`);
  if (adContent.callToAction) parts.push(`Call to Action: "${adContent.callToAction}"`);
  if (adContent.displayUrl) parts.push(`Display URL: "${adContent.displayUrl}"`);
  const gHeadlines = (adContent.googleHeadlines ?? []).filter((h) => h.trim());
  if (gHeadlines.length) {
    parts.push(`Google Ads Headlines:\n${gHeadlines.map((h, i) => `  ${i + 1}. "${h}"`).join("\n")}`);
  }
  const gDescriptions = (adContent.googleDescriptions ?? []).filter((d) => d.trim());
  if (gDescriptions.length) {
    parts.push(`Google Ads Descriptions:\n${gDescriptions.map((d, i) => `  ${i + 1}. "${d}"`).join("\n")}`);
  }
  return parts.join("\n") || "(No ad copy provided)";
}

export interface RuleForEvaluation {
  id: string;
  layer: "platform_rule" | "geo_rule";
  platformName: string;
  categoryName: string;
  countryName?: string;
  dbNotes?: string;
  referenceUrl?: string;
  detectionGuidance?: string;
}

export function buildRulesForEvaluation(
  platformRules: PlatformRuleRow[],
  geoRules: GeoRuleRow[],
  platformNames: string[],
  prohibitionConfigs: ProhibitionConfigRow[] = []
): RuleForEvaluation[] {
  const rules: RuleForEvaluation[] = [];

  // Build guidance lookup: categoryId:countryId:platformId -> guidance
  const guidanceMap = new Map<string, string>();
  for (const pc of prohibitionConfigs) {
    if (pc.detectionGuidance) {
      guidanceMap.set(`${pc.categoryId}:${pc.countryId ?? ""}:${pc.platformId ?? ""}`, pc.detectionGuidance);
    }
  }

  function findGuidance(categoryId: string, countryId?: string, platformId?: string): string | undefined {
    return (
      guidanceMap.get(`${categoryId}:${countryId ?? ""}:${platformId ?? ""}`) ??
      guidanceMap.get(`${categoryId}:${countryId ?? ""}:`) ??
      guidanceMap.get(`${categoryId}::`) ??
      undefined
    );
  }

  for (const rule of platformRules) {
    if (rule.status !== "RESTRICTED") continue;
    rules.push({
      id: `platform_rule:${rule.id}`,
      layer: "platform_rule",
      platformName: rule.platform.name,
      categoryName: rule.category.name,
      dbNotes: rule.notes ?? undefined,
      referenceUrl: rule.referenceUrl ?? undefined,
      detectionGuidance: findGuidance(rule.categoryId, undefined, rule.platformId),
    });
  }

  for (const rule of geoRules) {
    if (rule.status !== "RESTRICTED") continue;
    rules.push({
      id: `geo_rule:${rule.id}`,
      layer: "geo_rule",
      platformName: rule.platform?.name ?? platformNames.join(", "),
      categoryName: rule.category.name,
      countryName: rule.country.name,
      dbNotes: rule.notes ?? undefined,
      referenceUrl: rule.legislationUrl ?? undefined,
      detectionGuidance: findGuidance(rule.categoryId, rule.countryId, rule.platformId ?? undefined),
    });
  }

  return rules;
}

// ─── Layer 3: AI content analysis ────────────────────────────────────────────

export interface AiRequirementEvaluation {
  requirementTitle: string;
  status: ChecklistStatus;
  reason: string;
  explanation: string;
  quotedContent?: string;
  suggestion?: string;
}

export interface AiRuleEvaluation {
  ruleId: string;
  requirements: AiRequirementEvaluation[];
}

export interface AiAdditionalItem {
  ruleTitle: string;
  status: "WARNING" | "FAIL";
  reason: string;
  explanation: string;
  quotedContent?: string;
  suggestion?: string;
  applicablePlatforms: string[];
  applicableCountries: string[];
  ruleReference?: { source: string; url?: string; ruleText: string };
}

export interface AiAnalysisOutput {
  ruleEvaluations: AiRuleEvaluation[];
  additionalItems: AiAdditionalItem[];
  summary: string;
}

async function runPart1Analysis(
  adContent: AdContentPayload,
  rulesForEvaluation: RuleForEvaluation[],
  trainingExamples: TrainingExample[],
  platformNames: string[],
  categoryNames: string[],
  countryNames: string[],
  heldCertNames: string[] = [],
  modelOverride?: string
): Promise<{ ruleEvaluations: AiRuleEvaluation[]; summary: string }> {
  // Truncate long notes to save tokens
  const truncate = (s: string | undefined, max: number) =>
    s && s.length > max ? s.slice(0, max) + "..." : s;

  const rulesSection = rulesForEvaluation
    .map((r, i) => {
      const loc = r.countryName ? `${r.platformName}/${r.countryName}` : r.platformName;
      const notes = r.dbNotes ? ` | ${truncate(r.dbNotes, 150)}` : "";
      const guidance = r.detectionGuidance ? ` | Detect: ${truncate(r.detectionGuidance, 100)}` : "";
      return `[${i + 1}] ${r.id} | ${loc} | ${r.categoryName}${notes}${guidance}`;
    })
    .join("\n");

  // Build compact user prompt — static instructions are in the system prompt
  const parts: string[] = [];

  if (trainingExamples.length > 0) {
    parts.push("EXAMPLES:\n" + trainingExamples.map((ex, i) => {
      const rubric = ex.rubric?.length ? ` [${ex.rubric.map((r) => `${r.key}=${r.value}`).join(", ")}]` : "";
      return `${i + 1}. ${ex.verdict}: "${truncate(ex.contentSample, 200)}" — ${truncate(ex.explanation, 150)}${rubric}`;
    }).join("\n"));
  }

  if (heldCertNames.length > 0) {
    parts.push(`CERTS HELD: ${heldCertNames.join(", ")}\n(Mark certification-holding requirements as PASS; still evaluate content requirements normally.)`);
  }

  parts.push(`PLATFORMS: ${platformNames.join(", ")} | CATEGORIES: ${categoryNames.join(", ")} | COUNTRIES: ${countryNames.join(", ")}`);
  parts.push(`AD:\n${buildAdContentSummary(adContent)}`);
  parts.push(`RULES:\n${rulesSection}`);

  const prompt = parts.join("\n\n");

  const selectedModel = modelOverride ?? SONNET;
  console.log(`[compliance] part1 model: ${selectedModel}`);

  const response = await anthropic.messages.create({
    model: selectedModel,
    max_tokens: selectedModel === HAIKU ? 2000 : 4000,
    system: [
      {
        type: "text" as const,
        text: SYSTEM_INSTRUCTION + "\n\n" + PART1_SYSTEM_ADDENDUM,
        cache_control: { type: "ephemeral" } as const,
      },
    ],
    tools: [
      {
        name: "submit_rule_evaluations",
        description: "Submit the structured rule evaluation results",
        input_schema: {
          type: "object" as const,
          properties: {
            ruleEvaluations: {
              type: "array",
              description:
                "One entry per restricted rule. Each rule expands into its individual requirement checks.",
              items: {
                type: "object",
                properties: {
                  ruleId: {
                    type: "string",
                    description: "The RULE ID exactly as shown in the list above (e.g. 'platform_rule:clxxx')",
                  },
                  requirements: {
                    type: "array",
                    description:
                      "Individual requirement checks for this rule. Minimum 3 entries per rule. Each entry is one specific compliance requirement.",
                    items: {
                      type: "object",
                      properties: {
                        requirementTitle: {
                          type: "string",
                          description:
                            "Short, specific requirement name (e.g. 'Must not appeal to minors', 'Must include responsible drinking message', 'Must target users aged 18+ only')",
                        },
                        status: {
                          type: "string",
                          enum: ["PASS", "WARNING", "FAIL"],
                        },
                        reason: {
                          type: "string",
                          description: "1–2 sentence verdict explaining the status",
                        },
                        explanation: {
                          type: "string",
                          description:
                            "Detailed explanation of why the content passes, warns, or fails this specific requirement",
                        },
                        quotedContent: {
                          type: "string",
                          description:
                            "The exact text from the ad that triggered WARNING or FAIL. Omit for PASS or for missing required elements.",
                        },
                        suggestion: {
                          type: "string",
                          description:
                            "Specific, actionable step the advertiser must take. Required for WARNING and FAIL.",
                        },
                      },
                      required: ["requirementTitle", "status", "reason", "explanation"],
                    },
                  },
                },
                required: ["ruleId", "requirements"],
              },
            },
            summary: {
              type: "string",
              description:
                "1–2 sentence overall compliance summary for the restricted rules. Mention the most critical issues specifically.",
            },
          },
          required: ["ruleEvaluations", "summary"],
        },
        cache_control: { type: "ephemeral" } as const,
      } as unknown as Tool,
    ],
    tool_choice: { type: "tool", name: "submit_rule_evaluations" },
    messages: [{ role: "user", content: prompt }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return { ruleEvaluations: [], summary: "" };
  }

  const output = toolUse.input as {
    ruleEvaluations?: AiRuleEvaluation[];
    summary?: string;
  };

  return {
    ruleEvaluations: output.ruleEvaluations ?? [],
    summary: output.summary ?? "",
  };
}

const PART2_SCREENING_INSTRUCTIONS = `Screen ad(s) for compliance issues. Be specific — identify exact problems and required changes.

Check for:
A) PROHIBITED (always FAIL): illegal drugs/substances, violence/weapons threats, hate speech/discrimination, illegal activity promotion, sexual exploitation
B) CATEGORY VIOLATIONS: missing mandatory disclosures, unsubstantiated efficacy claims ("guaranteed results"), misleading urgency/scarcity/pricing, body shaming/harmful stereotypes
C) COHERENCE: flag if ad subject matter is incompatible with declared category

Return empty array only if genuinely no issues.`;

const PART2_TOOL_SCHEMA = {
  name: "submit_content_screening",
  description: "Submit the mandatory content screening results",
  input_schema: {
    type: "object" as const,
    properties: {
      additionalIssues: {
        type: "array",
        description:
          "Content issues found — beyond any restricted rules. Empty array if none.",
        items: {
          type: "object",
          properties: {
            ruleTitle: {
              type: "string",
              description: "Short, specific issue title (max 80 chars)",
            },
            status: {
              type: "string",
              enum: ["WARNING", "FAIL"],
            },
            reason: {
              type: "string",
              description: "1–2 sentence summary of the issue",
            },
            explanation: {
              type: "string",
              description: "Detailed explanation of the violation and its significance",
            },
            quotedContent: {
              type: "string",
              description: "The exact text from the ad that is problematic",
            },
            suggestion: {
              type: "string",
              description: "Specific, actionable step to resolve the issue",
            },
            applicablePlatforms: {
              type: "array",
              items: { type: "string" },
              description: "Platform names this applies to",
            },
            applicableCountries: {
              type: "array",
              items: { type: "string" },
              description: "Country names this applies to (empty = all selected countries)",
            },
            ruleReference: {
              type: "object",
              properties: {
                source: { type: "string" },
                url: { type: "string" },
                ruleText: { type: "string" },
              },
              required: ["source", "ruleText"],
            },
          },
          required: [
            "ruleTitle",
            "status",
            "reason",
            "explanation",
            "applicablePlatforms",
            "applicableCountries",
          ],
        },
      },
    },
    required: ["additionalIssues"],
  },
};

async function runPart2Analysis(
  adContent: AdContentPayload,
  platformNames: string[],
  categoryNames: string[],
  countryNames: string[]
): Promise<{ additionalItems: AiAdditionalItem[] }> {
  const prompt = `${PART2_SCREENING_INSTRUCTIONS}

PLATFORMS: ${platformNames.join(", ")} | CATEGORIES: ${categoryNames.join(", ")} | COUNTRIES: ${countryNames.join(", ")}

AD:
${buildAdContentSummary(adContent)}`;

  console.log("[compliance] part2 model: haiku");

  const response = await anthropic.messages.create({
    model: HAIKU,
    max_tokens: 2000,
    system: [
      {
        type: "text" as const,
        text: SYSTEM_INSTRUCTION,
        cache_control: { type: "ephemeral" } as const,
      },
    ],
    tools: [
      {
        ...PART2_TOOL_SCHEMA,
        cache_control: { type: "ephemeral" } as const,
      } as unknown as Tool,
    ],
    tool_choice: { type: "tool", name: "submit_content_screening" },
    messages: [{ role: "user", content: prompt }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return { additionalItems: [] };
  }

  const output = toolUse.input as { additionalIssues?: AiAdditionalItem[] };

  return { additionalItems: output.additionalIssues ?? [] };
}

// ─── Batched Part 2 for bulk processing ──────────────────────────────────────
//
// Evaluates multiple ads in a single Haiku call. Returns a map from ad key
// to its additional items. This reduces API calls from N to ceil(N/batchSize).

export async function runBatchedPart2Analysis(
  ads: { key: string; adContent: AdContentPayload }[],
  platformNames: string[],
  categoryNames: string[],
  countryNames: string[]
): Promise<Map<string, AiAdditionalItem[]>> {
  if (ads.length === 0) return new Map();
  if (ads.length === 1) {
    const result = await runPart2Analysis(ads[0].adContent, platformNames, categoryNames, countryNames);
    return new Map([[ads[0].key, result.additionalItems]]);
  }

  const adsSection = ads
    .map((ad, i) => `=== AD ${i + 1} (KEY: ${ad.key}) ===\n${buildAdContentSummary(ad.adContent)}`)
    .join("\n\n");

  const prompt = `${PART2_SCREENING_INSTRUCTIONS}

PLATFORMS: ${platformNames.join(", ")} | CATEGORIES: ${categoryNames.join(", ")} | COUNTRIES: ${countryNames.join(", ")}

Screening ${ads.length} ads. Evaluate EACH independently, keyed by ad KEY.

${adsSection}`;

  console.log(`[compliance] batched part2: ${ads.length} ads, model: haiku`);

  const response = await anthropic.messages.create({
    model: HAIKU,
    max_tokens: Math.min(4000, 1000 + ads.length * 600),
    system: [
      {
        type: "text" as const,
        text: SYSTEM_INSTRUCTION,
        cache_control: { type: "ephemeral" } as const,
      },
    ],
    tools: [
      {
        name: "submit_batch_screening",
        description: "Submit content screening results for multiple ads",
        input_schema: {
          type: "object" as const,
          properties: {
            results: {
              type: "array",
              description: "One entry per ad, keyed by the ad KEY.",
              items: {
                type: "object",
                properties: {
                  adKey: { type: "string", description: "The KEY of the ad being evaluated" },
                  additionalIssues: PART2_TOOL_SCHEMA.input_schema.properties.additionalIssues,
                },
                required: ["adKey", "additionalIssues"],
              },
            },
          },
          required: ["results"],
        },
        cache_control: { type: "ephemeral" } as const,
      } as unknown as Tool,
    ],
    tool_choice: { type: "tool", name: "submit_batch_screening" },
    messages: [{ role: "user", content: prompt }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  const resultMap = new Map<string, AiAdditionalItem[]>();

  if (toolUse && toolUse.type === "tool_use") {
    const output = toolUse.input as {
      results?: { adKey: string; additionalIssues?: AiAdditionalItem[] }[];
    };
    for (const entry of output.results ?? []) {
      resultMap.set(entry.adKey, entry.additionalIssues ?? []);
    }
  }

  // Ensure every ad has an entry (empty if AI missed it)
  for (const ad of ads) {
    if (!resultMap.has(ad.key)) resultMap.set(ad.key, []);
  }

  return resultMap;
}

// ─── Model tiering: split rules for Haiku vs Sonnet ─────────────────────────
//
// Simple rules (≤ HAIKU_RULE_THRESHOLD total, or rules with short/no notes)
// go to Haiku for speed + cost savings. Complex rules stay on Sonnet.

const HAIKU_RULE_THRESHOLD = 4;

function isSimpleRule(rule: RuleForEvaluation): boolean {
  // Rules with short notes and no detection guidance are "simple"
  const notesLen = (rule.dbNotes ?? "").length;
  return notesLen < 200 && !rule.detectionGuidance;
}

export async function runAiAnalysis(
  adContent: AdContentPayload,
  assetUrls: string[],
  platformNames: string[],
  categoryNames: string[],
  countryNames: string[],
  rulesForEvaluation: RuleForEvaluation[],
  trainingExamples: TrainingExample[] = [],
  heldCertNames: string[] = [],
  options?: { skipPart2?: boolean; modelOverride?: string }
): Promise<AiAnalysisOutput> {
  const skipPart2 = options?.skipPart2 ?? false;

  // assetUrls kept in signature for backward compat but not forwarded to text analysis
  void assetUrls;

  // ── Model tiering: split rules into Haiku (simple) and Sonnet (complex) ──
  const forceModel = options?.modelOverride;
  let haikuRules: RuleForEvaluation[] = [];
  let sonnetRules: RuleForEvaluation[] = [];

  if (forceModel) {
    // Explicit override — send all to that model
    sonnetRules = rulesForEvaluation;
  } else if (rulesForEvaluation.length <= HAIKU_RULE_THRESHOLD) {
    // Few rules — all go to Haiku (fast + cheap)
    haikuRules = rulesForEvaluation;
  } else {
    // Split: simple rules → Haiku, complex → Sonnet
    for (const rule of rulesForEvaluation) {
      if (isSimpleRule(rule)) {
        haikuRules.push(rule);
      } else {
        sonnetRules.push(rule);
      }
    }
    // If all rules ended up simple, keep them on Haiku
    // If all ended up complex, keep them on Sonnet
    // Otherwise both batches run in parallel
  }

  console.log(`[compliance] tiering: ${haikuRules.length} haiku rules, ${sonnetRules.length} sonnet rules, forceModel=${forceModel ?? "none"}`);

  // Build parallel promise array
  const promises: Promise<{ ruleEvaluations: AiRuleEvaluation[]; summary: string } | { additionalItems: AiAdditionalItem[] }>[] = [];

  // Part 1a: Haiku rules
  const part1HaikuIdx = haikuRules.length > 0 ? promises.length : -1;
  if (haikuRules.length > 0) {
    promises.push(runPart1Analysis(adContent, haikuRules, trainingExamples, platformNames, categoryNames, countryNames, heldCertNames, HAIKU));
  }

  // Part 1b: Sonnet rules
  const part1SonnetIdx = sonnetRules.length > 0 ? promises.length : -1;
  if (sonnetRules.length > 0) {
    promises.push(runPart1Analysis(adContent, sonnetRules, trainingExamples, platformNames, categoryNames, countryNames, heldCertNames, forceModel ?? SONNET));
  }

  // Part 2: Content screening (always Haiku)
  const part2Idx = !skipPart2 ? promises.length : -1;
  if (!skipPart2) {
    promises.push(runPart2Analysis(adContent, platformNames, categoryNames, countryNames));
  }

  const results = await Promise.allSettled(promises);

  // Merge Part 1 results from both model tiers
  const allRuleEvaluations: AiRuleEvaluation[] = [];
  let summary = "";

  for (const idx of [part1HaikuIdx, part1SonnetIdx]) {
    if (idx >= 0 && results[idx].status === "fulfilled") {
      const val = results[idx].value as { ruleEvaluations: AiRuleEvaluation[]; summary: string };
      allRuleEvaluations.push(...val.ruleEvaluations);
      if (val.summary && !summary) summary = val.summary;
    }
  }

  // Part 2 results
  let additionalItems: AiAdditionalItem[] = [];
  if (part2Idx >= 0 && results[part2Idx].status === "fulfilled") {
    additionalItems = (results[part2Idx].value as { additionalItems: AiAdditionalItem[] }).additionalItems;
  }

  return {
    ruleEvaluations: allRuleEvaluations,
    additionalItems,
    summary: summary || "Compliance check complete.",
  };
}

// ─── Merge checklist layers ────────────────────────────────────────────────────

export function mergeChecklist(
  technicalItems: ComplianceChecklistItem[],
  deterministicItems: ComplianceChecklistItem[],
  restrictedFallbacks: Map<string, ComplianceChecklistItem>,
  aiOutput: AiAnalysisOutput | null,
  platformNames: string[]
): ComplianceChecklistItem[] {
  const items: ComplianceChecklistItem[] = [
    ...technicalItems,
    ...deterministicItems,
  ];

  // Track which restricted rules were successfully expanded by AI
  const expandedRuleIds = new Set<string>();

  if (aiOutput) {
    // Part 1: Expand each restricted rule into per-requirement items
    for (const ruleEval of aiOutput.ruleEvaluations) {
      if (!ruleEval.requirements || ruleEval.requirements.length === 0) continue;

      // Use the fallback item for context (applicablePlatforms, applicableCountries, ruleReference)
      const fallback = restrictedFallbacks.get(ruleEval.ruleId);
      expandedRuleIds.add(ruleEval.ruleId);

      ruleEval.requirements.forEach((req, i) => {
        const id = `${ruleEval.ruleId}:req:${i}`;
        items.push({
          id,
          layer: (fallback?.layer ?? "platform_rule") as ChecklistLayer,
          ruleId: ruleEval.ruleId,
          ruleTitle: req.requirementTitle,
          status: req.status,
          reason: req.reason,
          explanation: req.explanation,
          quotedContent: req.quotedContent,
          suggestion: req.suggestion,
          ruleReference: fallback?.ruleReference,
          applicablePlatforms: fallback?.applicablePlatforms ?? platformNames,
          applicableCountries: fallback?.applicableCountries ?? [],
          isOverrideable: true,
          aiGenerated: true,
        });
      });
    }

    // Part 2: Additional AI-detected issues
    for (const item of aiOutput.additionalItems) {
      const id = `ai_text:${item.ruleTitle.replace(/\s+/g, "_").toLowerCase().slice(0, 40)}:${Math.random().toString(36).slice(2, 6)}`;
      items.push({
        id,
        layer: "ai_text",
        ruleTitle: item.ruleTitle,
        status: item.status,
        reason: item.reason,
        explanation: item.explanation,
        quotedContent: item.quotedContent,
        suggestion: item.suggestion,
        ruleReference: item.ruleReference,
        applicablePlatforms: item.applicablePlatforms.length > 0 ? item.applicablePlatforms : platformNames,
        applicableCountries: item.applicableCountries,
        isOverrideable: true,
        aiGenerated: true,
      });
    }
  }

  // For any restricted rules the AI did not evaluate, use the generic fallback
  for (const [ruleId, fallback] of restrictedFallbacks) {
    if (!expandedRuleIds.has(ruleId)) {
      items.push(fallback);
    }
  }

  // Sort: FAIL → WARNING → PASS; within each status by layer order
  const statusOrder: Record<ChecklistStatus, number> = { FAIL: 0, WARNING: 1, PASS: 2 };
  const layerOrder: Record<ChecklistLayer, number> = {
    technical: 0,
    platform_rule: 1,
    geo_rule: 2,
    ai_text: 3,
    image: 4,
  };

  return items.sort((a, b) => {
    const statusDiff = statusOrder[a.status] - statusOrder[b.status];
    if (statusDiff !== 0) return statusDiff;
    return layerOrder[a.layer] - layerOrder[b.layer];
  });
}

// ─── Certification helpers ────────────────────────────────────────────────────

export interface HeldCertification {
  certificationName: string;
  platformName: string;
  categoryIds: string[];
}

/**
 * Fetch held certifications for a user/org that overlap with the selected
 * platform + category combination.
 */
export async function fetchHeldCertifications(
  userId: string,
  platformIds: string[],
  categoryIds: string[]
): Promise<HeldCertification[]> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { organisationId: true },
  });

  const orgId = user?.organisationId ?? null;

  const heldCerts = await db.orgCertification.findMany({
    where: {
      active: true,
      OR: [
        { userId },
        ...(orgId ? [{ organisationId: orgId }] : []),
      ],
    },
    include: {
      certification: {
        include: {
          platform: { select: { id: true, name: true } },
        },
      },
    },
  });

  // Filter to certs whose platform is in the selected platforms and whose
  // categories overlap with the selected categories
  return heldCerts
    .filter(
      (h) =>
        platformIds.includes(h.certification.platformId) &&
        h.certification.categoryIds.some((cid) => categoryIds.includes(cid))
    )
    .map((h) => ({
      certificationName: h.certification.name,
      platformName: h.certification.platform.name,
      categoryIds: h.certification.categoryIds,
    }));
}

/**
 * Post-process checklist items: for certification-requirement items (items
 * whose ruleTitle mentions certification), if the user holds the relevant
 * certification, downgrade FAIL/WARNING to PASS with a note.
 */
export function applyCertificationOverrides(
  checklist: ComplianceChecklistItem[],
  heldCerts: HeldCertification[],
  categoryIds: string[]
): ComplianceChecklistItem[] {
  if (!heldCerts.length) return checklist;

  // Build a set of category IDs covered by held certifications
  const coveredCategoryIds = new Set<string>();
  for (const cert of heldCerts) {
    for (const cid of cert.categoryIds) {
      if (categoryIds.includes(cid)) {
        coveredCategoryIds.add(cid);
      }
    }
  }

  // Certification-related keywords in rule titles
  const certKeywords = [
    "certification",
    "certified",
    "certificate",
    "google healthcare",
    "google gambling",
    "google financial",
    "google cryptocurrency",
    "google election",
    "google alcohol",
    "meta gambling",
    "prior written permission",
    "must be licensed",
    "requires.*certification",
    "advertiser verification",
  ];
  const certPattern = new RegExp(certKeywords.join("|"), "i");

  return checklist.map((item) => {
    // Only adjust items that mention certification and are FAIL or WARNING
    if (item.status === "PASS") return item;

    const mentionsCert =
      certPattern.test(item.ruleTitle) ||
      certPattern.test(item.reason) ||
      certPattern.test(item.explanation);

    if (!mentionsCert) return item;

    // Check if there's a held cert covering this item's platform
    const certForItem = heldCerts.find((cert) =>
      item.applicablePlatforms.some(
        (p) => p.toLowerCase() === cert.platformName.toLowerCase()
      )
    );

    if (!certForItem) return item;

    return {
      ...item,
      status: "PASS" as const,
      reason: `${certForItem.certificationName} certification confirmed — requirement satisfied.`,
      explanation: `Your organisation has declared that it holds the ${certForItem.certificationName} certification. This requirement is therefore met. Original note: ${item.explanation}`,
      suggestion: undefined,
    };
  });
}

// ─── Derive legacy issues from checklist ─────────────────────────────────────

export function deriveIssues(checklist: ComplianceChecklistItem[]): ComplianceIssue[] {
  return checklist
    .filter((item) => item.status !== "PASS")
    .map((item) => ({
      severity: item.status === "FAIL" ? "violation" : "warning",
      field: item.layer === "technical" ? "headline" : "category",
      title: item.ruleTitle,
      explanation: item.explanation,
      applicablePlatforms: item.applicablePlatforms,
      applicableCountries: item.applicableCountries,
      ruleReference: item.ruleReference,
      suggestion: item.suggestion ?? "Review the applicable rule and amend your content accordingly.",
    }));
}

// ─── Fetch all DB context needed by the compliance engine ────────────────────

export interface ProhibitionConfigRow {
  categoryId: string;
  countryId: string | null;
  platformId: string | null;
  detectionGuidance: string | null;
}

export interface ComplianceContext {
  platforms: { id: string; name: string; slug: string }[];
  categories: { id: string; name: string }[];
  countries: { id: string; name: string; code: string }[];
  platformRules: PlatformRuleRow[];
  geoRules: GeoRuleRow[];
  channelRequirements: ChannelReqRow[];
  prohibitionConfigs: ProhibitionConfigRow[];
  platformNames: string[];
  categoryNames: string[];
  countryNames: string[];
  adContent: AdContentPayload;
  assetUrls: string[];
  assets: AssetMetadata[];
}

export async function fetchComplianceContext(
  input: RunComplianceCheckInput
): Promise<ComplianceContext> {
  const { platformIds, categoryIds, countryIds, adContent, assetUrls, assets } = input;

  const [platforms, categories, countries, platformRules, geoRules, channelRequirements, prohibitionConfigs] =
    await Promise.all([
      db.platform.findMany({ where: { id: { in: platformIds } }, select: { id: true, name: true, slug: true } }),
      db.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } }),
      db.country.findMany({ where: { id: { in: countryIds } }, select: { id: true, name: true, code: true } }),
      db.platformRule.findMany({
        where: { platformId: { in: platformIds }, categoryId: { in: categoryIds } },
        include: { platform: { select: { name: true, slug: true } }, category: { select: { name: true } } },
      }),
      db.geoRule.findMany({
        where: {
          countryId: { in: countryIds },
          categoryId: { in: categoryIds },
          OR: [{ platformId: null }, { platformId: { in: platformIds } }],
        },
        include: {
          country: { select: { name: true } },
          category: { select: { name: true } },
          platform: { select: { name: true } },
        },
      }),
      db.channelRequirement.findMany({
        where: { platformId: { in: platformIds } },
        include: { platform: { select: { name: true, slug: true } } },
      }),
      db.prohibitionConfig.findMany({
        where: {
          categoryId: { in: categoryIds },
          active: true,
          detectionGuidance: { not: null },
        },
        select: {
          categoryId: true,
          countryId: true,
          platformId: true,
          detectionGuidance: true,
        },
      }),
    ]);

  return {
    platforms,
    categories,
    countries,
    platformRules,
    geoRules,
    channelRequirements,
    prohibitionConfigs,
    platformNames: platforms.map((p) => p.name),
    categoryNames: categories.map((c) => c.name),
    countryNames: countries.map((c) => c.name),
    adContent,
    assetUrls,
    assets: assets ?? assetUrls.map((url) => ({ url, format: "", width: 0, height: 0, bytes: 0 })),
  };
}

// ─── Compute overall status from checklist ────────────────────────────────────

export function computeOverallStatus(
  checklist: ComplianceChecklistItem[]
): "CLEAN" | "WARNINGS" | "VIOLATIONS" {
  if (checklist.some((i) => i.status === "FAIL")) return "VIOLATIONS";
  if (checklist.some((i) => i.status === "WARNING")) return "WARNINGS";
  return "CLEAN";
}

// ─── Generate summary text ────────────────────────────────────────────────────

export function generateSummary(
  checklist: ComplianceChecklistItem[],
  platformNames: string[],
  countryNames: string[]
): string {
  const fails = checklist.filter((i) => i.status === "FAIL").length;
  const warns = checklist.filter((i) => i.status === "WARNING").length;
  if (fails === 0 && warns === 0) {
    return `No compliance issues found. Your advertisement appears compliant with the applicable platform policies and geographic regulations for ${platformNames.join(", ")} in ${countryNames.join(", ")}.`;
  }
  return `${fails + warns} issue${fails + warns !== 1 ? "s" : ""} found: ${fails} violation${fails !== 1 ? "s" : ""} and ${warns} warning${warns !== 1 ? "s" : ""}.`;
}

// ─── Main exported function ───────────────────────────────────────────────────

export interface RunComplianceCheckInput {
  platformIds: string[];
  categoryIds: string[];
  countryIds: string[];
  adContent: AdContentPayload;
  assetUrls: string[];
  assets?: AssetMetadata[];
}

export async function runComplianceCheck(
  input: RunComplianceCheckInput
): Promise<ComplianceResult> {
  const ctx = await fetchComplianceContext(input);

  // Layer 1: technical
  const technicalItems = checkTechnicalSpecs(ctx.adContent, ctx.channelRequirements, ctx.assets);

  // Layer 2: deterministic + fallbacks
  const deterministicItems = checkDeterministicRules(ctx.platformRules, ctx.geoRules, ctx.platformNames);
  const restrictedFallbacks = buildRestrictedFallbacks(ctx.platformRules, ctx.geoRules, ctx.platformNames);

  // Layer 3: AI
  let aiOutput: AiAnalysisOutput | null = null;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey && !apiKey.includes("REPLACE")) {
    try {
      const rulesForEval = buildRulesForEvaluation(ctx.platformRules, ctx.geoRules, ctx.platformNames, ctx.prohibitionConfigs);

      const categoryIds = input.categoryIds ?? [];
      const platformIds = input.platformIds ?? [];
      const countryIds = input.countryIds ?? [];

      const rawExamples = await db.complianceExample.findMany({
        where: {
          active: true,
          supersededAt: null,
          OR: [
            { categoryId: { in: categoryIds }, platformId: { in: platformIds }, countryId: { in: countryIds } },
            { categoryId: { in: categoryIds }, platformId: { in: platformIds }, countryId: null },
            { categoryId: { in: categoryIds }, platformId: null, countryId: null },
          ],
        },
        select: { id: true, title: true, contentSample: true, verdict: true, explanation: true, rubric: true },
        orderBy: [{ platformId: "desc" }, { countryId: "desc" }, { createdAt: "desc" }],
        take: 8,
      });

      const trainingExamples: TrainingExample[] = rawExamples.map((e) => ({
        ...e,
        rubric: (e.rubric as { key: string; value: string }[] | null) ?? null,
      }));

      console.log(`[compliance] training examples injected: ${trainingExamples.length}`);

      aiOutput = await runAiAnalysis(
        ctx.adContent, ctx.assetUrls, ctx.platformNames,
        ctx.categoryNames, ctx.countryNames, rulesForEval, trainingExamples,
        [], { modelOverride: HAIKU }
      );
    } catch (err) {
      console.error("[compliance] AI analysis failed:", err);
    }
  }

  const checklist = mergeChecklist(technicalItems, deterministicItems, restrictedFallbacks, aiOutput, ctx.platformNames);
  const overallStatus = computeOverallStatus(checklist);
  const summary = aiOutput?.summary || generateSummary(checklist, ctx.platformNames, ctx.countryNames);

  return {
    overallStatus,
    checklist,
    overrides: [],
    summary,
    checkedAt: new Date().toISOString(),
    issues: deriveIssues(checklist),
  };
}
