import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { organisationId: true },
  });

  if (!user?.organisationId) {
    return NextResponse.json({ ads: [] });
  }

  // Get all synced ads for the org's integrations
  const ads = await db.syncedAd.findMany({
    where: {
      integration: { organisationId: user.organisationId, status: "CONNECTED" },
    },
    orderBy: { lastSyncedAt: "desc" },
    take: 100,
    select: {
      id: true,
      externalAdId: true,
      externalStatus: true,
      adContent: true,
      assetUrls: true,
      lastSyncedAt: true,
      createdAt: true,
      complianceCheckId: true,
      complianceCheck: {
        select: {
          id: true,
          overallStatus: true,
          completedAt: true,
        },
      },
      integration: {
        select: {
          id: true,
          provider: true,
          label: true,
          externalAccountName: true,
        },
      },
    },
  });

  return NextResponse.json({ ads });
}
