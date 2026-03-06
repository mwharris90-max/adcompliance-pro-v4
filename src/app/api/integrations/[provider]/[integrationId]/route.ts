import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAdapter } from "@/lib/integrations/registry";
import { z } from "zod";

const patchSchema = z.object({
  autoSyncEnabled: z.boolean().optional(),
  syncIntervalMins: z.number().int().min(15).max(1440).optional(),
  label: z.string().min(1).max(100).optional(),
});

// PATCH — update integration settings (auto-sync toggle, interval, label)
export async function PATCH(
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

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  await db.integration.update({
    where: { id: integrationId },
    data: parsed.data,
  });

  return NextResponse.json({ success: true });
}

// DELETE — disconnect integration
export async function DELETE(
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

  // Try to revoke access on the provider side
  if (integration.accessToken) {
    try {
      const adapter = getAdapter(integration.provider);
      await adapter.revokeAccess?.(integration.accessToken);
    } catch (err) {
      console.warn(`[integration] Failed to revoke ${integration.provider} token:`, err);
    }
  }

  // Mark as disconnected (soft delete — keep the record for audit)
  await db.integration.update({
    where: { id: integrationId },
    data: {
      status: "DISCONNECTED",
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      disconnectedAt: new Date(),
      autoSyncEnabled: false,
    },
  });

  console.log(`[integration] Disconnected ${integration.provider} (${integration.externalAccountName}) by user ${session.user.id}`);

  return NextResponse.json({ success: true });
}
