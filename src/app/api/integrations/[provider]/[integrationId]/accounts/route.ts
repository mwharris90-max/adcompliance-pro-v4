import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAdapter } from "@/lib/integrations/registry";

// GET — list available ad accounts for a connected integration
export async function GET(
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

  if (!integration || !integration.accessToken) {
    return NextResponse.json({ error: "Integration not found or not connected" }, { status: 404 });
  }

  try {
    const adapter = getAdapter(integration.provider);
    const accounts = await adapter.listAccounts(integration.accessToken);
    return NextResponse.json({ accounts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list accounts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH — select a different ad account for the integration
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string; integrationId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { integrationId } = await params;
  const { accountId, accountName } = await req.json();

  if (!accountId) {
    return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  }

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

  await db.integration.update({
    where: { id: integrationId },
    data: {
      externalAccountId: accountId,
      externalAccountName: accountName ?? accountId,
    },
  });

  return NextResponse.json({ success: true });
}
