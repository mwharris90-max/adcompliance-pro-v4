import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAdapter } from "@/lib/integrations/registry";
import { Prisma } from "@prisma/client";

// POST — manually trigger a sync for an integration
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string; integrationId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { integrationId } = await params;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { organisationId: true },
  });

  const integration = await db.integration.findFirst({
    where: { id: integrationId, organisationId: user?.organisationId ?? "" },
  });

  if (!integration) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  if (integration.status !== "CONNECTED" || !integration.accessToken) {
    return NextResponse.json({ error: "Integration is not connected" }, { status: 400 });
  }

  if (!integration.externalAccountId) {
    return NextResponse.json({ error: "No account selected" }, { status: 400 });
  }

  const adapter = getAdapter(integration.provider);

  try {
    // Check if token needs refresh
    let accessToken = integration.accessToken;
    if (integration.tokenExpiresAt && integration.tokenExpiresAt < new Date()) {
      if (!integration.refreshToken) {
        await db.integration.update({
          where: { id: integrationId },
          data: { status: "ERROR", lastErrorMessage: "Token expired. Please reconnect." },
        });
        return NextResponse.json({ error: "Token expired. Please reconnect your account." }, { status: 401 });
      }

      const newTokens = await adapter.refreshAccessToken(integration.refreshToken);
      accessToken = newTokens.accessToken;
      await db.integration.update({
        where: { id: integrationId },
        data: {
          accessToken: newTokens.accessToken,
          refreshToken: newTokens.refreshToken ?? integration.refreshToken,
          tokenExpiresAt: newTokens.expiresAt,
        },
      });
    }

    // Fetch ads from the provider
    const ads = await adapter.fetchAds(accessToken, integration.externalAccountId);

    // Upsert synced ads
    let newCount = 0;
    for (const ad of ads) {
      const existing = await db.syncedAd.findUnique({
        where: {
          integrationId_externalAdId: {
            integrationId,
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
            lastSyncedAt: new Date(),
          },
        });
      } else {
        await db.syncedAd.create({
          data: {
            integrationId,
            externalAdId: ad.externalAdId,
            externalStatus: ad.externalStatus,
            adContent: ad as unknown as Prisma.InputJsonValue,
            assetUrls: ad.assetUrls,
            rawPayload: ad.rawPayload as Prisma.InputJsonValue,
          },
        });
        newCount++;
      }
    }

    // Update sync status
    await db.integration.update({
      where: { id: integrationId },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: "success",
        lastSyncAdCount: ads.length,
        errorCount: 0,
        lastErrorMessage: null,
      },
    });

    console.log(`[sync] ${integration.provider}: synced ${ads.length} ads (${newCount} new) for integration ${integrationId}`);

    return NextResponse.json({
      success: true,
      synced: ads.length,
      new: newCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    console.error(`[sync] Error syncing ${integration.provider}:`, err);

    await db.integration.update({
      where: { id: integrationId },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: `error: ${message}`,
        errorCount: { increment: 1 },
        lastErrorAt: new Date(),
        lastErrorMessage: message,
        ...(message.includes("expired") || message.includes("revoked")
          ? { status: "ERROR" }
          : {}),
      },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
