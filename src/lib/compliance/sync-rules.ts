import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

/**
 * Syncs a ComplianceRule to the existing runtime tables (PlatformRule / GeoRule)
 * so the compliance engine can consume them without changes.
 *
 * Logic:
 * - If the rule has a countryId → syncs to GeoRule
 * - If the rule has a platformId but no countryId → syncs to PlatformRule
 * - If neither → creates PlatformRule for each active platform (broad legislation)
 */
export async function syncRuleToRuntime(complianceRuleId: string) {
  const rule = await db.complianceRule.findUnique({
    where: { id: complianceRuleId },
  });

  if (!rule || !rule.active) return;

  // Determine if this is a geo rule or platform rule
  if (rule.countryId) {
    // Sync to GeoRule
    const geoData = {
      countryId: rule.countryId,
      categoryId: rule.categoryId,
      platformId: rule.platformId,
      status: rule.status,
      restrictions: rule.conditions === null ? Prisma.JsonNull : (rule.conditions as Prisma.InputJsonValue),
      notes: rule.description ?? rule.title,
      legislationUrl: null as string | null,
      lastVerifiedAt: rule.lastVerifiedAt,
    };

    // Get legislation URL if available
    if (rule.legislationId) {
      const leg = await db.legislation.findUnique({
        where: { id: rule.legislationId },
        select: { sourceUrl: true },
      });
      if (leg?.sourceUrl) geoData.legislationUrl = leg.sourceUrl;
    }

    if (rule.syncedGeoRuleId) {
      // Update existing
      await db.geoRule.update({
        where: { id: rule.syncedGeoRuleId },
        data: geoData,
      }).catch(() => {});
    } else {
      // Check for existing rule with same unique key
      const existing = await db.geoRule.findUnique({
        where: {
          countryId_categoryId_platformId: {
            countryId: rule.countryId,
            categoryId: rule.categoryId,
            platformId: rule.platformId ?? "",
          },
        },
      });

      if (existing) {
        // Update existing and link
        await db.geoRule.update({ where: { id: existing.id }, data: geoData });
        await db.complianceRule.update({
          where: { id: complianceRuleId },
          data: { syncedGeoRuleId: existing.id },
        });
      } else {
        // Create new
        const created = await db.geoRule.create({ data: geoData });
        await db.complianceRule.update({
          where: { id: complianceRuleId },
          data: { syncedGeoRuleId: created.id },
        });
      }
    }
  } else if (rule.platformId) {
    // Sync to PlatformRule
    const platformData = {
      platformId: rule.platformId,
      categoryId: rule.categoryId,
      status: rule.status,
      notes: rule.description ?? rule.title,
      conditions: rule.conditions === null ? Prisma.JsonNull : (rule.conditions as Prisma.InputJsonValue),
      referenceUrl: null as string | null,
      lastVerifiedAt: rule.lastVerifiedAt,
    };

    // Get reference URL from legislation or platform policy
    if (rule.legislationId) {
      const leg = await db.legislation.findUnique({
        where: { id: rule.legislationId },
        select: { sourceUrl: true },
      });
      if (leg?.sourceUrl) platformData.referenceUrl = leg.sourceUrl;
    } else if (rule.platformPolicyId) {
      const pol = await db.platformPolicy.findUnique({
        where: { id: rule.platformPolicyId },
        select: { sourceUrl: true },
      });
      if (pol?.sourceUrl) platformData.referenceUrl = pol.sourceUrl;
    }

    if (rule.syncedPlatformRuleId) {
      await db.platformRule.update({
        where: { id: rule.syncedPlatformRuleId },
        data: platformData,
      }).catch(() => {});
    } else {
      const existing = await db.platformRule.findUnique({
        where: {
          platformId_categoryId: {
            platformId: rule.platformId,
            categoryId: rule.categoryId,
          },
        },
      });

      if (existing) {
        await db.platformRule.update({ where: { id: existing.id }, data: platformData });
        await db.complianceRule.update({
          where: { id: complianceRuleId },
          data: { syncedPlatformRuleId: existing.id },
        });
      } else {
        const created = await db.platformRule.create({ data: platformData });
        await db.complianceRule.update({
          where: { id: complianceRuleId },
          data: { syncedPlatformRuleId: created.id },
        });
      }
    }
  }
  else if (!rule.platformId && !rule.countryId) {
    // General rule (no platform, no country) — sync to PlatformRule for each active platform
    const platforms = await db.platform.findMany({ where: { active: true } });

    for (const platform of platforms) {
      const platformData = {
        platformId: platform.id,
        categoryId: rule.categoryId,
        status: rule.status,
        notes: rule.description ?? rule.title,
        conditions: rule.conditions === null ? Prisma.JsonNull : (rule.conditions as Prisma.InputJsonValue),
        referenceUrl: null as string | null,
        lastVerifiedAt: rule.lastVerifiedAt,
      };

      if (rule.legislationId) {
        const leg = await db.legislation.findUnique({
          where: { id: rule.legislationId },
          select: { sourceUrl: true },
        });
        if (leg?.sourceUrl) platformData.referenceUrl = leg.sourceUrl;
      }

      const existing = await db.platformRule.findUnique({
        where: {
          platformId_categoryId: {
            platformId: platform.id,
            categoryId: rule.categoryId,
          },
        },
      });

      if (existing) {
        // Only update if no platform-specific ComplianceRule overrides this
        const override = await db.complianceRule.findFirst({
          where: {
            categoryId: rule.categoryId,
            platformId: platform.id,
            active: true,
            id: { not: rule.id },
          },
        });
        if (!override) {
          await db.platformRule.update({ where: { id: existing.id }, data: platformData });
        }
      } else {
        await db.platformRule.create({ data: platformData });
      }
    }
  }
}
