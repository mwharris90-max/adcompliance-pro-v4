import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdapter } from "@/lib/integrations/registry";
import type { IntegrationProvider } from "@prisma/client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerParam } = await params;
  const provider = providerParam.toUpperCase() as IntegrationProvider;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const code = req.nextUrl.searchParams.get("code");
  const stateParam = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  // Handle OAuth denial
  if (error) {
    console.error(`[integration-callback] OAuth denied for ${provider}:`, error);
    return NextResponse.redirect(
      `${appUrl}/app/settings?tab=connections&error=${encodeURIComponent("Connection was denied.")}`
    );
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(
      `${appUrl}/app/settings?tab=connections&error=${encodeURIComponent("Missing OAuth parameters.")}`
    );
  }

  // Decode state
  let state: { userId: string; nonce: string; provider: string };
  try {
    state = JSON.parse(Buffer.from(stateParam, "base64url").toString());
  } catch {
    return NextResponse.redirect(
      `${appUrl}/app/settings?tab=connections&error=${encodeURIComponent("Invalid state parameter.")}`
    );
  }

  if (state.provider !== provider) {
    return NextResponse.redirect(
      `${appUrl}/app/settings?tab=connections&error=${encodeURIComponent("Provider mismatch.")}`
    );
  }

  // Get user's org
  const user = await db.user.findUnique({
    where: { id: state.userId },
    select: { organisationId: true },
  });

  if (!user?.organisationId) {
    return NextResponse.redirect(
      `${appUrl}/app/settings?tab=connections&error=${encodeURIComponent("No organisation found. Join an organisation to connect integrations.")}`
    );
  }

  // Exchange code for tokens
  const adapter = getAdapter(provider);
  const redirectUri = `${appUrl}/api/integrations/${providerParam.toLowerCase()}/callback`;

  try {
    const tokens = await adapter.exchangeCode(code, redirectUri);

    // List available accounts
    const accounts = await adapter.listAccounts(tokens.accessToken);

    if (accounts.length === 0) {
      return NextResponse.redirect(
        `${appUrl}/app/settings?tab=connections&error=${encodeURIComponent("No ad accounts found. Ensure you have access to at least one ad account.")}`
      );
    }

    // For now, connect the first account (UI will allow selecting later)
    const account = accounts[0];

    // Upsert integration
    await db.integration.upsert({
      where: {
        organisationId_provider_externalAccountId: {
          organisationId: user.organisationId,
          provider,
          externalAccountId: account.id,
        },
      },
      update: {
        status: "CONNECTED",
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken ?? null,
        tokenExpiresAt: tokens.expiresAt ?? null,
        scopes: tokens.scopes,
        externalAccountName: account.name,
        accountMetadata: (account.metadata as Record<string, string>) ?? undefined,
        errorCount: 0,
        lastErrorMessage: null,
        disconnectedAt: null,
        connectedById: state.userId,
      },
      create: {
        organisationId: user.organisationId,
        connectedById: state.userId,
        provider,
        status: "CONNECTED",
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken ?? null,
        tokenExpiresAt: tokens.expiresAt ?? null,
        scopes: tokens.scopes,
        externalAccountId: account.id,
        externalAccountName: account.name,
        accountMetadata: (account.metadata as Record<string, string>) ?? undefined,
        label: `${adapter.config.displayName} — ${account.name}`,
      },
    });

    console.log(`[integration] Connected ${provider} account ${account.name} for org ${user.organisationId}`);

    return NextResponse.redirect(
      `${appUrl}/app/settings?tab=connections&success=${encodeURIComponent(`Connected ${adapter.config.displayName}: ${account.name}`)}`
    );
  } catch (err) {
    console.error(`[integration-callback] Error connecting ${provider}:`, err);
    const message = err instanceof Error ? err.message : "Connection failed";
    return NextResponse.redirect(
      `${appUrl}/app/settings?tab=connections&error=${encodeURIComponent(message)}`
    );
  }
}
