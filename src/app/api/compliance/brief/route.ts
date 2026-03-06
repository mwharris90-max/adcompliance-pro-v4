import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * POST /api/compliance/brief
 * Generate a compliance brief for given platform/category/country selections.
 * Returns all applicable rules, technical specs, and restrictions.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { platformIds, categoryIds, countryIds } = body as {
    platformIds: string[];
    categoryIds: string[];
    countryIds: string[];
  };

  if (!platformIds?.length || !countryIds?.length) {
    return NextResponse.json(
      { error: "At least one platform and one country are required" },
      { status: 400 }
    );
  }

  // Fetch all reference data in parallel
  const [platforms, categories, countries, platformRules, geoRules, channelReqs, prohibitions] =
    await Promise.all([
      db.platform.findMany({
        where: { id: { in: platformIds } },
        select: { id: true, name: true, slug: true },
      }),
      categoryIds.length
        ? db.category.findMany({
            where: { id: { in: categoryIds } },
            select: { id: true, name: true, slug: true, description: true },
          })
        : Promise.resolve([]),
      db.country.findMany({
        where: { id: { in: countryIds } },
        select: { id: true, name: true, code: true },
      }),
      // Platform rules for selected platform+category combos
      categoryIds.length
        ? db.platformRule.findMany({
            where: {
              platformId: { in: platformIds },
              categoryId: { in: categoryIds },
            },
            include: {
              platform: { select: { name: true } },
              category: { select: { name: true } },
            },
            orderBy: { status: "asc" },
          })
        : Promise.resolve([]),
      // Geo rules for selected country+category combos
      categoryIds.length
        ? db.geoRule.findMany({
            where: {
              countryId: { in: countryIds },
              categoryId: { in: categoryIds },
              OR: [
                { platformId: null },
                { platformId: { in: platformIds } },
              ],
            },
            include: {
              country: { select: { name: true } },
              category: { select: { name: true } },
              platform: { select: { name: true } },
            },
            orderBy: { status: "asc" },
          })
        : Promise.resolve([]),
      // Channel requirements (technical specs)
      db.channelRequirement.findMany({
        where: { platformId: { in: platformIds } },
        include: { platform: { select: { name: true } } },
        orderBy: [{ platformId: "asc" }, { specType: "asc" }],
      }),
      // Prohibition configs
      categoryIds.length
        ? db.prohibitionConfig.findMany({
            where: {
              categoryId: { in: categoryIds },
              active: true,
              OR: [
                { countryId: null, platformId: null },
                { countryId: { in: countryIds } },
                { platformId: { in: platformIds } },
              ],
            },
            include: {
              category: { select: { name: true } },
              country: { select: { name: true } },
              platform: { select: { name: true } },
            },
          })
        : Promise.resolve([]),
    ]);

  // Group technical specs by platform
  const techSpecsByPlatform: Record<
    string,
    { platformName: string; specs: typeof channelReqs }
  > = {};
  for (const spec of channelReqs) {
    if (!techSpecsByPlatform[spec.platformId]) {
      techSpecsByPlatform[spec.platformId] = {
        platformName: spec.platform.name,
        specs: [],
      };
    }
    techSpecsByPlatform[spec.platformId].specs.push(spec);
  }

  // Group platform rules by status
  const prohibited = platformRules.filter((r) => r.status === "PROHIBITED");
  const restricted = platformRules.filter((r) => r.status === "RESTRICTED");
  const allowed = platformRules.filter((r) => r.status === "ALLOWED");

  // Group geo rules by country
  const geoByCountry: Record<
    string,
    { countryName: string; rules: (typeof geoRules)[number][] }
  > = {};
  for (const rule of geoRules) {
    if (!geoByCountry[rule.countryId]) {
      geoByCountry[rule.countryId] = {
        countryName: rule.country.name,
        rules: [],
      };
    }
    geoByCountry[rule.countryId].rules.push(rule);
  }

  return NextResponse.json({
    brief: {
      generatedAt: new Date().toISOString(),
      platforms: platforms.map((p) => ({ id: p.id, name: p.name })),
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
      })),
      countries: countries.map((c) => ({
        id: c.id,
        name: c.name,
        code: c.code,
      })),
      // Prohibitions / warnings
      prohibitions: prohibited.map((r) => ({
        platform: r.platform.name,
        category: r.category.name,
        notes: r.notes,
        referenceUrl: r.referenceUrl,
      })),
      // Restrictions requiring compliance
      restrictions: restricted.map((r) => ({
        platform: r.platform.name,
        category: r.category.name,
        notes: r.notes,
        conditions: r.conditions,
        referenceUrl: r.referenceUrl,
      })),
      // Allowed (for confirmation)
      allowedRules: allowed.map((r) => ({
        platform: r.platform.name,
        category: r.category.name,
        notes: r.notes,
      })),
      // Geographic regulations
      geoRegulations: Object.values(geoByCountry).map((group) => ({
        country: group.countryName,
        rules: group.rules.map((r) => ({
          category: r.category.name,
          platform: r.platform?.name ?? "All platforms",
          status: r.status,
          restrictions: r.restrictions,
          notes: r.notes,
          legislationUrl: r.legislationUrl,
        })),
      })),
      // Regulatory warnings (prohibition configs)
      regulatoryWarnings: prohibitions.map((p) => ({
        category: (p as unknown as { category: { name: string } }).category.name,
        country: (p as unknown as { country?: { name: string } }).country?.name ?? "All countries",
        platform: (p as unknown as { platform?: { name: string } }).platform?.name ?? "All platforms",
        warningTitle: p.warningTitle,
        warningMessage: p.warningMessage,
      })),
      // Technical specifications
      technicalSpecs: Object.values(techSpecsByPlatform).map((group) => ({
        platform: group.platformName,
        specs: group.specs.map((s) => ({
          type: s.specType,
          key: s.specKey,
          value: s.value,
          notes: s.notes,
        })),
      })),
    },
  });
}
