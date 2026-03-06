import type { IntegrationProvider } from "@prisma/client";

/** Normalised ad content from any provider */
export interface NormalisedAd {
  externalAdId: string;
  externalStatus: string;
  headline?: string;
  body?: string;
  description?: string;
  cta?: string;
  assetUrls: string[];
  rawPayload: Record<string, unknown>;
}

/** OAuth tokens returned from a provider callback */
export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes: string[];
}

/** Account info returned after connecting */
export interface ExternalAccount {
  id: string;
  name: string;
  metadata?: Record<string, unknown>;
}

/** Provider configuration */
export interface ProviderConfig {
  provider: IntegrationProvider;
  displayName: string;
  icon: string;
  scopes: string[];
  supportsAutoSync: boolean;
  authUrl: string;
  tokenUrl: string;
  clientIdEnv: string;
  clientSecretEnv: string;
}

/** Interface every integration provider must implement */
export interface IntegrationProviderAdapter {
  readonly config: ProviderConfig;

  /** Build the OAuth authorization URL */
  getAuthUrl(state: string, redirectUri: string): string;

  /** Exchange authorization code for tokens */
  exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens>;

  /** Refresh an expired access token */
  refreshAccessToken(refreshToken: string): Promise<OAuthTokens>;

  /** List available ad accounts after connecting */
  listAccounts(accessToken: string): Promise<ExternalAccount[]>;

  /** Fetch ads from a connected account */
  fetchAds(accessToken: string, accountId: string): Promise<NormalisedAd[]>;

  /** Revoke access (if the provider supports it) */
  revokeAccess?(accessToken: string): Promise<void>;
}
