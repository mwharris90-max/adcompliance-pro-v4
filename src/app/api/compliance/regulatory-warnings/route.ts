import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const categoryIds = body.categoryIds as string[] | undefined;
  const countryIds = body.countryIds as string[] | undefined;
  const platformIds = body.platformIds as string[] | undefined;

  if (!categoryIds?.length || !countryIds?.length) {
    return NextResponse.json({ success: true, warnings: [] });
  }

  // Fetch PROHIBITED geo rules for the selected categories + countries
  const prohibitedGeoRules = await db.geoRule.findMany({
    where: {
      categoryId: { in: categoryIds },
      countryId: { in: countryIds },
      status: "PROHIBITED",
      ...(platformIds?.length
        ? { OR: [{ platformId: null }, { platformId: { in: platformIds } }] }
        : {}),
    },
    include: {
      country: { select: { id: true, name: true, code: true } },
      category: { select: { id: true, name: true, slug: true } },
      platform: { select: { id: true, name: true } },
    },
  });

  // Also fetch PROHIBITED platform rules
  const prohibitedPlatformRules = platformIds?.length
    ? await db.platformRule.findMany({
        where: {
          platformId: { in: platformIds },
          categoryId: { in: categoryIds },
          status: "PROHIBITED",
        },
        include: {
          platform: { select: { id: true, name: true } },
          category: { select: { id: true, name: true, slug: true } },
        },
      })
    : [];

  // Fetch any custom ProhibitionConfigs for these categories
  const configs = await db.prohibitionConfig.findMany({
    where: {
      categoryId: { in: categoryIds },
      active: true,
      OR: [
        { countryId: null, platformId: null },
        { countryId: { in: countryIds } },
        ...(platformIds?.length ? [{ platformId: { in: platformIds } }] : []),
      ],
    },
  });

  // Build lookup: categoryId:countryId:platformId -> config
  const configMap = new Map<string, typeof configs[number]>();
  for (const c of configs) {
    configMap.set(`${c.categoryId}:${c.countryId ?? ""}:${c.platformId ?? ""}`, c);
  }

  function findConfig(categoryId: string, countryId: string | null, platformId: string | null) {
    // Try exact match first, then category+country, then category-only
    return (
      configMap.get(`${categoryId}:${countryId ?? ""}:${platformId ?? ""}`) ??
      configMap.get(`${categoryId}:${countryId ?? ""}:`) ??
      configMap.get(`${categoryId}::`) ??
      null
    );
  }

  // Build unified warnings list
  const warnings = [
    ...prohibitedGeoRules.map((rule) => {
      const cfg = findConfig(rule.categoryId, rule.countryId, rule.platformId);
      const ruleNotes = rule.notes ?? "";
      // Build a specific confirmation from the rule notes if no custom config exists
      const defaultConfirmation = buildSpecificConfirmation(ruleNotes, rule.category.name, rule.country.name);
      return {
        id: `geo:${rule.id}`,
        type: "geo" as const,
        categoryName: rule.category.name,
        categorySlug: rule.category.slug,
        countryName: rule.country.name,
        countryCode: rule.country.code,
        platformName: rule.platform?.name ?? null,
        notes: cfg?.warningMessage ?? ruleNotes,
        legislationUrl: rule.legislationUrl,
        legalReference: buildLegalReference(rule.legislationUrl, rule.country.name),
        warningTitle: cfg?.warningTitle ?? null,
        confirmationMessage: cfg?.confirmationMessage ?? defaultConfirmation,
      };
    }),
    ...prohibitedPlatformRules.map((rule) => {
      const cfg = findConfig(rule.categoryId, null, rule.platformId);
      const ruleNotes = rule.notes ?? "";
      const defaultConfirmation = buildSpecificConfirmation(ruleNotes, rule.category.name, null, rule.platform.name);
      return {
        id: `platform:${rule.id}`,
        type: "platform" as const,
        categoryName: rule.category.name,
        categorySlug: rule.category.slug,
        countryName: null,
        countryCode: null,
        platformName: rule.platform.name,
        notes: cfg?.warningMessage ?? ruleNotes,
        legislationUrl: rule.referenceUrl,
        legalReference: buildLegalReference(rule.referenceUrl, null, rule.platform.name),
        warningTitle: cfg?.warningTitle ?? null,
        confirmationMessage: cfg?.confirmationMessage ?? defaultConfirmation,
      };
    }),
  ];

  return NextResponse.json({ success: true, warnings });
}

/**
 * Build a rule-specific confirmation message from the rule notes.
 * Instead of "I confirm my adverts do not contravene this regulation",
 * produce something like "I confirm my adverts are not promoting prescription medication direct to consumers".
 */
function buildSpecificConfirmation(
  notes: string,
  categoryName: string,
  countryName: string | null,
  platformName?: string
): string {
  // Extract the core prohibition from the notes text
  const lower = notes.toLowerCase();

  // Try to extract the specific prohibition action from the notes
  // Pattern: "X is/are prohibited" → "I confirm my adverts are not X"
  const prohibitedMatch = notes.match(/^(.+?)\s+(?:is|are)\s+prohibited/i);
  if (prohibitedMatch) {
    const activity = prohibitedMatch[1]
      .replace(/^all\s+/i, "")
      .replace(/\s+on\s+\w+$/i, "")
      .trim();
    const location = countryName ? ` in ${countryName}` : platformName ? ` on ${platformName}` : "";
    return `I confirm my adverts are not ${activity.toLowerCase()}${location}`;
  }

  // Pattern: "No direct-to-consumer" or "No D2C"
  if (lower.includes("direct-to-consumer") || lower.includes("d2c") || lower.includes("direct to consumer")) {
    return `I confirm my adverts are not promoting ${categoryName.toLowerCase()} direct to consumers${countryName ? ` in ${countryName}` : ""}`;
  }

  // Pattern: notes describe what is banned — use category name as fallback
  const location = countryName ? ` in ${countryName}` : platformName ? ` on ${platformName}` : "";
  return `I confirm my adverts are not promoting prohibited ${categoryName.toLowerCase()} advertising${location}`;
}

/**
 * Build a human-readable legal reference label from a URL and context.
 */
function buildLegalReference(
  url: string | null,
  countryName: string | null,
  platformName?: string
): string | null {
  if (!url) return null;

  const lower = url.toLowerCase();

  // Known policy domains
  if (lower.includes("facebook.com/policies") || lower.includes("meta.com/policies")) {
    return "Meta Advertising Standards";
  }
  if (lower.includes("support.google.com/adspolicy") || lower.includes("ads.google.com")) {
    return "Google Ads Policy";
  }
  if (lower.includes("business.twitter.com") || lower.includes("ads.x.com")) {
    return "X (Twitter) Ads Policy";
  }
  if (lower.includes("tiktok.com")) {
    return "TikTok Advertising Policy";
  }
  if (lower.includes("legislation.gov.uk")) {
    return `UK Legislation (${countryName ?? "United Kingdom"})`;
  }
  if (lower.includes("eur-lex.europa.eu")) {
    return "EU Legislation";
  }

  // Generic: use country or platform name
  if (countryName) return `${countryName} Regulatory Policy`;
  if (platformName) return `${platformName} Advertising Policy`;
  return "Source Policy";
}
