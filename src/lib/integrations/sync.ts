import { db } from "@/lib/db";
import { getAdapter } from "./registry";
import { Prisma } from "@prisma/client";
import { runComplianceCheck, type AdContentPayload } from "@/lib/ai/runComplianceCheck";

/**
 * Process all integrations that are due for auto-sync.
 * Called by the cron job or manually.
 */
export async function processAutoSync(): Promise<{
  processed: number;
  synced: number;
  errors: number;
  checksTriggered: number;
}> {
  const now = new Date();
  let processed = 0;
  let synced = 0;
  let errors = 0;
  let checksTriggered = 0;

  // Find integrations that are connected, auto-sync enabled, and due
  const integrations = await db.integration.findMany({
    where: {
      status: "CONNECTED",
      autoSyncEnabled: true,
      accessToken: { not: null },
      externalAccountId: { not: null },
    },
    include: {
      organisation: { select: { creditBalance: true } },
    },
  });

  for (const integration of integrations) {
    // Check if due for sync
    if (integration.lastSyncAt) {
      const nextSyncAt = new Date(
        integration.lastSyncAt.getTime() + integration.syncIntervalMins * 60 * 1000
      );
      if (nextSyncAt > now) continue;
    }

    processed++;

    try {
      const adapter = getAdapter(integration.provider);

      // Refresh token if needed
      let accessToken = integration.accessToken!;
      if (integration.tokenExpiresAt && integration.tokenExpiresAt < now) {
        if (!integration.refreshToken) {
          await db.integration.update({
            where: { id: integration.id },
            data: {
              status: "ERROR",
              lastErrorMessage: "Token expired. Please reconnect.",
              lastSyncAt: now,
              lastSyncStatus: "error: token expired",
            },
          });
          errors++;
          continue;
        }

        const newTokens = await adapter.refreshAccessToken(integration.refreshToken);
        accessToken = newTokens.accessToken;
        await db.integration.update({
          where: { id: integration.id },
          data: {
            accessToken: newTokens.accessToken,
            refreshToken: newTokens.refreshToken ?? integration.refreshToken,
            tokenExpiresAt: newTokens.expiresAt,
          },
        });
      }

      // Fetch ads
      const ads = await adapter.fetchAds(accessToken, integration.externalAccountId!);

      // Upsert synced ads and trigger checks for new ones
      for (const ad of ads) {
        const existing = await db.syncedAd.findUnique({
          where: {
            integrationId_externalAdId: {
              integrationId: integration.id,
              externalAdId: ad.externalAdId,
            },
          },
        });

        if (existing) {
          await db.syncedAd.update({
            where: { id: existing.id },
            data: {
              externalStatus: ad.externalStatus,
              adContent: ad as unknown as Prisma.InputJsonValue,
              assetUrls: ad.assetUrls,
              rawPayload: ad.rawPayload as Prisma.InputJsonValue,
              lastSyncedAt: now,
            },
          });
        } else {
          // New ad — create record and trigger compliance check
          const syncedAd = await db.syncedAd.create({
            data: {
              integrationId: integration.id,
              externalAdId: ad.externalAdId,
              externalStatus: ad.externalStatus,
              adContent: ad as unknown as Prisma.InputJsonValue,
              assetUrls: ad.assetUrls,
              rawPayload: ad.rawPayload as Prisma.InputJsonValue,
            },
          });

          // Only trigger check if org has credits
          if (integration.organisation.creditBalance > 0) {
            try {
              const checkResult = await triggerComplianceCheck(
                integration.connectedById,
                syncedAd.id,
                ad
              );
              if (checkResult) checksTriggered++;
            } catch (err) {
              console.error(`[auto-sync] Check failed for ad ${ad.externalAdId}:`, err);
            }
          }
        }
      }

      synced += ads.length;

      await db.integration.update({
        where: { id: integration.id },
        data: {
          lastSyncAt: now,
          lastSyncStatus: "success",
          lastSyncAdCount: ads.length,
          errorCount: 0,
          lastErrorMessage: null,
        },
      });

      console.log(
        `[auto-sync] ${integration.provider}: ${ads.length} ads synced for integration ${integration.id}`
      );
    } catch (err) {
      errors++;
      const message = err instanceof Error ? err.message : "Sync failed";
      console.error(`[auto-sync] Error for ${integration.provider} (${integration.id}):`, err);

      await db.integration.update({
        where: { id: integration.id },
        data: {
          lastSyncAt: now,
          lastSyncStatus: `error: ${message}`,
          errorCount: { increment: 1 },
          lastErrorAt: now,
          lastErrorMessage: message,
          ...(message.includes("expired") || message.includes("revoked")
            ? { status: "ERROR" as const }
            : {}),
        },
      });
    }
  }

  return { processed, synced, errors, checksTriggered };
}

/**
 * Run a compliance check on a synced ad.
 */
async function triggerComplianceCheck(
  userId: string,
  syncedAdId: string,
  ad: { headline?: string; body?: string; cta?: string; assetUrls: string[] }
): Promise<boolean> {
  // Get default platform/category/country from the user's org or use sensible defaults
  const platforms = await db.platform.findMany({
    where: { active: true },
    select: { id: true },
  });
  const countries = await db.country.findMany({
    where: { approved: true },
    take: 1,
    select: { id: true },
  });

  if (platforms.length === 0 || countries.length === 0) return false;

  const adContent: AdContentPayload = {};
  if (ad.headline) adContent.headline = ad.headline;
  if (ad.body) adContent.body = ad.body;
  if (ad.cta) adContent.callToAction = ad.cta;

  // Skip if no actual content
  if (Object.keys(adContent).length === 0) return false;

  const check = await db.complianceCheck.create({
    data: {
      userId,
      platformIds: platforms.map((p) => p.id),
      categoryIds: [],
      countryIds: countries.map((c) => c.id),
      adContent: adContent as Prisma.InputJsonValue,
      assetUrls: ad.assetUrls,
      status: "RUNNING",
      source: "INTEGRATION",
    },
  });

  // Link synced ad to compliance check
  await db.syncedAd.update({
    where: { id: syncedAdId },
    data: { complianceCheckId: check.id },
  });

  try {
    const result = await runComplianceCheck({
      platformIds: platforms.map((p) => p.id),
      categoryIds: [],
      countryIds: countries.map((c) => c.id),
      adContent,
      assetUrls: ad.assetUrls,
    });

    await db.complianceCheck.update({
      where: { id: check.id },
      data: {
        status: result.overallStatus,
        overallStatus: result.overallStatus,
        results: result as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });

    return true;
  } catch (err) {
    console.error(`[auto-sync] Compliance check failed:`, err);
    await db.complianceCheck.update({
      where: { id: check.id },
      data: { status: "ERROR" },
    });
    return false;
  }
}
