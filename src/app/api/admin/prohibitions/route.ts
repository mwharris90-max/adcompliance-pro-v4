import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// GET — list all prohibition configs with their related rules
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all PROHIBITED geo rules and platform rules, joined with any existing config
  const [geoRules, platformRules, configs] = await Promise.all([
    db.geoRule.findMany({
      where: { status: "PROHIBITED" },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        country: { select: { id: true, name: true, code: true } },
        platform: { select: { id: true, name: true } },
      },
      orderBy: [{ category: { name: "asc" } }, { country: { name: "asc" } }],
    }),
    db.platformRule.findMany({
      where: { status: "PROHIBITED" },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        platform: { select: { id: true, name: true } },
      },
      orderBy: [{ category: { name: "asc" } }, { platform: { name: "asc" } }],
    }),
    db.prohibitionConfig.findMany({
      include: {
        category: { select: { id: true, name: true } },
        country: { select: { id: true, name: true, code: true } },
        platform: { select: { id: true, name: true } },
      },
    }),
  ]);

  // Build a lookup map for configs
  const configMap = new Map<string, typeof configs[number]>();
  for (const c of configs) {
    const key = `${c.categoryId}:${c.countryId ?? ""}:${c.platformId ?? ""}`;
    configMap.set(key, c);
  }

  // Build unified prohibitions list
  const prohibitions = [
    ...geoRules.map((rule) => {
      const key = `${rule.categoryId}:${rule.countryId}:${rule.platformId ?? ""}`;
      const config = configMap.get(key);
      return {
        ruleType: "geo" as const,
        ruleId: rule.id,
        categoryId: rule.categoryId,
        categoryName: rule.category.name,
        categorySlug: rule.category.slug,
        countryId: rule.countryId,
        countryName: rule.country.name,
        countryCode: rule.country.code,
        platformId: rule.platformId,
        platformName: rule.platform?.name ?? null,
        notes: rule.notes,
        legislationUrl: rule.legislationUrl,
        config: config ?? null,
      };
    }),
    ...platformRules.map((rule) => {
      const key = `${rule.categoryId}::${rule.platformId}`;
      const config = configMap.get(key);
      return {
        ruleType: "platform" as const,
        ruleId: rule.id,
        categoryId: rule.categoryId,
        categoryName: rule.category.name,
        categorySlug: rule.category.slug,
        countryId: null,
        countryName: null,
        countryCode: null,
        platformId: rule.platformId,
        platformName: rule.platform.name,
        notes: rule.notes,
        legislationUrl: rule.referenceUrl,
        config: config ?? null,
      };
    }),
  ];

  return NextResponse.json({ success: true, prohibitions });
}

// POST — create or update a prohibition config
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    categoryId,
    countryId,
    platformId,
    warningTitle,
    warningMessage,
    confirmationMessage,
    detectionGuidance,
    detectionExamples,
    strictness,
  } = body;

  if (!categoryId) {
    return NextResponse.json({ error: "categoryId required" }, { status: 400 });
  }

  const config = await db.prohibitionConfig.upsert({
    where: {
      categoryId_countryId_platformId: {
        categoryId,
        countryId: countryId ?? null,
        platformId: platformId ?? null,
      },
    },
    create: {
      categoryId,
      countryId: countryId ?? null,
      platformId: platformId ?? null,
      warningTitle: warningTitle ?? undefined,
      warningMessage: warningMessage ?? undefined,
      confirmationMessage: confirmationMessage ?? undefined,
      detectionGuidance: detectionGuidance ?? null,
      detectionExamples: detectionExamples ?? null,
      strictness: strictness ?? 50,
    },
    update: {
      warningTitle: warningTitle ?? undefined,
      warningMessage: warningMessage ?? undefined,
      confirmationMessage: confirmationMessage ?? undefined,
      detectionGuidance: detectionGuidance ?? null,
      detectionExamples: detectionExamples ?? null,
      strictness: strictness ?? undefined,
      updatedAt: new Date(),
    },
    include: {
      category: { select: { id: true, name: true } },
      country: { select: { id: true, name: true, code: true } },
      platform: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ success: true, config });
}
