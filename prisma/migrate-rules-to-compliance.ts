/**
 * Migration script: Creates ComplianceRule records from existing PlatformRule
 * and GeoRule data, linking them via syncedPlatformRuleId / syncedGeoRuleId.
 *
 * Run: npx tsx prisma/migrate-rules-to-compliance.ts
 */

import { PrismaClient, Prisma } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  // Check for existing ComplianceRules to avoid duplicates
  const existingCount = await db.complianceRule.count();
  if (existingCount > 0) {
    console.log(`[skip] ${existingCount} ComplianceRules already exist. Delete them first if you want to re-run.`);
    return;
  }

  // ─── Platform Rules → ComplianceRules ───
  const platformRules = await db.platformRule.findMany({
    include: {
      platform: { select: { id: true, name: true } },
      category: { select: { id: true, name: true, slug: true } },
    },
  });

  console.log(`[platform] Found ${platformRules.length} platform rules`);

  let platformCreated = 0;
  for (const pr of platformRules) {
    const title = `${pr.category.name} — ${pr.platform.name}`;
    await db.complianceRule.create({
      data: {
        categoryId: pr.categoryId,
        platformId: pr.platformId,
        countryId: null,
        sourceType: "PLATFORM_POLICY",
        status: pr.status,
        title,
        description: pr.notes,
        conditions: pr.conditions === null
          ? Prisma.JsonNull
          : (pr.conditions as Prisma.InputJsonValue),
        maturity: "ALPHA",
        lastVerifiedAt: pr.lastVerifiedAt,
        syncedPlatformRuleId: pr.id,
      },
    });
    platformCreated++;
  }
  console.log(`[platform] Created ${platformCreated} ComplianceRules`);

  // ─── Geo Rules → ComplianceRules ───
  const geoRules = await db.geoRule.findMany({
    include: {
      country: { select: { id: true, name: true, code: true } },
      category: { select: { id: true, name: true, slug: true } },
      platform: { select: { id: true, name: true } },
    },
  });

  console.log(`[geo] Found ${geoRules.length} geo rules`);

  let geoCreated = 0;
  for (const gr of geoRules) {
    const platformSuffix = gr.platform ? ` (${gr.platform.name})` : "";
    const title = `${gr.category.name} — ${gr.country.name}${platformSuffix}`;
    await db.complianceRule.create({
      data: {
        categoryId: gr.categoryId,
        platformId: gr.platformId,
        countryId: gr.countryId,
        sourceType: "LEGISLATION",
        status: gr.status,
        title,
        description: gr.notes,
        conditions: gr.restrictions === null
          ? Prisma.JsonNull
          : (gr.restrictions as Prisma.InputJsonValue),
        maturity: "ALPHA",
        lastVerifiedAt: gr.lastVerifiedAt,
        syncedGeoRuleId: gr.id,
      },
    });
    geoCreated++;
  }
  console.log(`[geo] Created ${geoCreated} ComplianceRules`);

  console.log(`\n[done] Total: ${platformCreated + geoCreated} ComplianceRules created`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
