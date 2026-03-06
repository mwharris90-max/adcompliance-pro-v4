import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAdapter, isProviderConfigured } from "@/lib/integrations/registry";
import type { IntegrationProvider } from "@prisma/client";
import crypto from "crypto";

const VALID_PROVIDERS = ["META", "GOOGLE_ADS", "HUBSPOT", "HOOTSUITE"];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { provider: providerParam } = await params;
  const provider = providerParam.toUpperCase() as IntegrationProvider;

  if (!VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  if (!isProviderConfigured(provider)) {
    return NextResponse.json(
      { error: "This integration is not yet configured. Contact your administrator." },
      { status: 400 }
    );
  }

  const adapter = getAdapter(provider);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectUri = `${appUrl}/api/integrations/${providerParam.toLowerCase()}/callback`;

  // State contains user ID + random nonce for CSRF protection
  const nonce = crypto.randomBytes(16).toString("hex");
  const state = Buffer.from(
    JSON.stringify({ userId: session.user.id, nonce, provider })
  ).toString("base64url");

  const authUrl = adapter.getAuthUrl(state, redirectUri);

  return NextResponse.json({ url: authUrl });
}
