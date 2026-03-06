import type {
  IntegrationProviderAdapter,
  ProviderConfig,
  OAuthTokens,
  ExternalAccount,
  NormalisedAd,
} from "../types";

const GRAPH_API = "https://graph.facebook.com/v21.0";

export class MetaAdapter implements IntegrationProviderAdapter {
  readonly config: ProviderConfig = {
    provider: "META",
    displayName: "Meta Ads",
    icon: "/logos/facebook.svg",
    scopes: ["ads_read"],
    supportsAutoSync: true,
    authUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: `${GRAPH_API}/oauth/access_token`,
    clientIdEnv: "META_APP_ID",
    clientSecretEnv: "META_APP_SECRET",
  };

  getAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: process.env.META_APP_ID!,
      redirect_uri: redirectUri,
      state,
      scope: this.config.scopes.join(","),
      response_type: "code",
    });
    return `${this.config.authUrl}?${params}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const params = new URLSearchParams({
      client_id: process.env.META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      redirect_uri: redirectUri,
      code,
    });

    const res = await fetch(`${this.config.tokenUrl}?${params}`);
    const data = await res.json();

    if (data.error) {
      throw new Error(`Meta OAuth error: ${data.error.message}`);
    }

    // Exchange short-lived token for long-lived token
    const longLivedParams = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: process.env.META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      fb_exchange_token: data.access_token,
    });

    const longRes = await fetch(`${this.config.tokenUrl}?${longLivedParams}`);
    const longData = await longRes.json();

    return {
      accessToken: longData.access_token ?? data.access_token,
      expiresAt: longData.expires_in
        ? new Date(Date.now() + longData.expires_in * 1000)
        : undefined,
      scopes: this.config.scopes,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    // Meta long-lived tokens don't use refresh tokens; they need to be re-exchanged
    // For now, return error to trigger reconnection
    throw new Error("Meta tokens must be re-authenticated. Please reconnect your account.");
  }

  async listAccounts(accessToken: string): Promise<ExternalAccount[]> {
    const res = await fetch(
      `${GRAPH_API}/me/adaccounts?fields=id,name,account_status&access_token=${accessToken}`
    );
    const data = await res.json();

    if (data.error) {
      throw new Error(`Meta API error: ${data.error.message}`);
    }

    return (data.data ?? []).map((acct: Record<string, unknown>) => ({
      id: acct.id as string,
      name: acct.name as string,
      metadata: { accountStatus: acct.account_status },
    }));
  }

  async fetchAds(accessToken: string, accountId: string): Promise<NormalisedAd[]> {
    // Fetch ads with PAUSED status from the ad account
    const fields = "id,name,status,creative{title,body,call_to_action_type,image_url,thumbnail_url,object_story_spec}";
    const res = await fetch(
      `${GRAPH_API}/${accountId}/ads?fields=${fields}&filtering=[{"field":"effective_status","operator":"IN","value":["PAUSED"]}]&limit=50&access_token=${accessToken}`
    );
    const data = await res.json();

    if (data.error) {
      throw new Error(`Meta API error: ${data.error.message}`);
    }

    return (data.data ?? []).map((ad: Record<string, unknown>): NormalisedAd => {
      const creative = (ad.creative ?? {}) as Record<string, unknown>;
      const storySpec = (creative.object_story_spec ?? {}) as Record<string, unknown>;
      const linkData = (storySpec.link_data ?? {}) as Record<string, string>;

      return {
        externalAdId: ad.id as string,
        externalStatus: ad.status as string,
        headline: (creative.title as string) ?? linkData.name ?? undefined,
        body: (creative.body as string) ?? linkData.message ?? undefined,
        cta: creative.call_to_action_type as string | undefined,
        assetUrls: [creative.image_url, creative.thumbnail_url]
          .filter(Boolean) as string[],
        rawPayload: ad,
      };
    });
  }

  async revokeAccess(accessToken: string): Promise<void> {
    await fetch(`${GRAPH_API}/me/permissions?access_token=${accessToken}`, {
      method: "DELETE",
    });
  }
}
