import type {
  IntegrationProviderAdapter,
  ProviderConfig,
  OAuthTokens,
  ExternalAccount,
  NormalisedAd,
} from "../types";

export class GoogleAdsAdapter implements IntegrationProviderAdapter {
  readonly config: ProviderConfig = {
    provider: "GOOGLE_ADS",
    displayName: "Google Ads",
    icon: "/logos/google-ads.svg",
    scopes: ["https://www.googleapis.com/auth/adwords.readonly"],
    supportsAutoSync: true,
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    clientIdEnv: "GOOGLE_ADS_CLIENT_ID",
    clientSecretEnv: "GOOGLE_ADS_CLIENT_SECRET",
  };

  getAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
      redirect_uri: redirectUri,
      state,
      scope: this.config.scopes.join(" "),
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
    });
    return `${this.config.authUrl}?${params}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const res = await fetch(this.config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
        client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        code,
        grant_type: "authorization_code",
      }),
    });
    const data = await res.json();

    if (data.error) {
      throw new Error(`Google OAuth error: ${data.error_description ?? data.error}`);
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
      scopes: (data.scope ?? "").split(" ").filter(Boolean),
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const res = await fetch(this.config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
        client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const data = await res.json();

    if (data.error) {
      throw new Error(`Google token refresh error: ${data.error_description ?? data.error}`);
    }

    return {
      accessToken: data.access_token,
      refreshToken, // Google doesn't return a new refresh token
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
      scopes: (data.scope ?? "").split(" ").filter(Boolean),
    };
  }

  async listAccounts(accessToken: string): Promise<ExternalAccount[]> {
    // Use Google Ads API to list accessible customer accounts
    const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    const res = await fetch(
      "https://googleads.googleapis.com/v17/customers:listAccessibleCustomers",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": devToken ?? "",
        },
      }
    );
    const data = await res.json();

    if (data.error) {
      throw new Error(`Google Ads API error: ${data.error.message}`);
    }

    // Resource names like "customers/1234567890"
    const customerIds: string[] = (data.resourceNames ?? []).map(
      (rn: string) => rn.replace("customers/", "")
    );

    // Fetch display names for each customer
    const accounts: ExternalAccount[] = [];
    for (const customerId of customerIds.slice(0, 10)) {
      try {
        const custRes = await fetch(
          `https://googleads.googleapis.com/v17/customers/${customerId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "developer-token": devToken ?? "",
              "login-customer-id": customerId,
            },
          }
        );
        const custData = await custRes.json();
        accounts.push({
          id: customerId,
          name: custData.descriptiveName ?? `Account ${customerId}`,
          metadata: { manager: custData.manager },
        });
      } catch {
        accounts.push({ id: customerId, name: `Account ${customerId}` });
      }
    }

    return accounts;
  }

  async fetchAds(accessToken: string, accountId: string): Promise<NormalisedAd[]> {
    const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    const query = `
      SELECT
        ad_group_ad.ad.id,
        ad_group_ad.ad.name,
        ad_group_ad.status,
        ad_group_ad.ad.responsive_search_ad.headlines,
        ad_group_ad.ad.responsive_search_ad.descriptions,
        ad_group_ad.ad.final_urls,
        ad_group_ad.ad.type
      FROM ad_group_ad
      WHERE ad_group_ad.status = 'PAUSED'
      LIMIT 50
    `;

    const res = await fetch(
      `https://googleads.googleapis.com/v17/customers/${accountId}/googleAds:searchStream`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": devToken ?? "",
          "login-customer-id": accountId,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      }
    );
    const data = await res.json();

    if (data.error) {
      throw new Error(`Google Ads API error: ${data.error.message}`);
    }

    // Parse the streaming response
    const results = Array.isArray(data) ? data.flatMap((batch: Record<string, unknown>) =>
      ((batch as Record<string, unknown[]>).results ?? [])
    ) : [];

    return results.map((row: unknown): NormalisedAd => {
      const rowObj = row as Record<string, unknown>;
      const adGroupAd = (rowObj.adGroupAd ?? {}) as Record<string, unknown>;
      const ad = (adGroupAd.ad ?? {}) as Record<string, unknown>;
      const rsa = (ad.responsiveSearchAd ?? {}) as Record<string, unknown[]>;

      const headlines = (rsa.headlines ?? []) as Array<{ text: string }>;
      const descriptions = (rsa.descriptions ?? []) as Array<{ text: string }>;

      return {
        externalAdId: String(ad.id ?? ""),
        externalStatus: String(adGroupAd.status ?? ""),
        headline: headlines.map((h) => h.text).join(" | "),
        body: descriptions.map((d) => d.text).join(" "),
        assetUrls: [],
        rawPayload: rowObj,
      };
    });
  }

  async revokeAccess(accessToken: string): Promise<void> {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  }
}
