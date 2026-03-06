import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { listProviders, isProviderConfigured } from "@/lib/integrations/registry";

// GET — list available providers and user's connected integrations
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { organisationId: true },
  });

  // Get available providers
  const providers = listProviders().map((p) => ({
    ...p,
    configured: isProviderConfigured(p.provider),
  }));

  // Get user's org integrations
  const integrations = user?.organisationId
    ? await db.integration.findMany({
        where: { organisationId: user.organisationId },
        select: {
          id: true,
          provider: true,
          status: true,
          label: true,
          externalAccountId: true,
          externalAccountName: true,
          autoSyncEnabled: true,
          syncIntervalMins: true,
          lastSyncAt: true,
          lastSyncStatus: true,
          lastSyncAdCount: true,
          errorCount: true,
          lastErrorMessage: true,
          createdAt: true,
          connectedBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return NextResponse.json({ providers, integrations });
}
