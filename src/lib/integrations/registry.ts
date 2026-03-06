import type { IntegrationProvider } from "@prisma/client";
import type { IntegrationProviderAdapter, ProviderConfig } from "./types";
import { MetaAdapter } from "./providers/meta";
import { GoogleAdsAdapter } from "./providers/google-ads";

const adapters: Partial<Record<IntegrationProvider, IntegrationProviderAdapter>> = {
  META: new MetaAdapter(),
  GOOGLE_ADS: new GoogleAdsAdapter(),
};

export function getAdapter(provider: IntegrationProvider): IntegrationProviderAdapter {
  const adapter = adapters[provider];
  if (!adapter) {
    throw new Error(`No adapter registered for provider: ${provider}`);
  }
  return adapter;
}

export function getProviderConfig(provider: IntegrationProvider): ProviderConfig {
  return getAdapter(provider).config;
}

export function listProviders(): ProviderConfig[] {
  return Object.values(adapters).map((a) => a.config);
}

/** Check if a provider's OAuth credentials are configured */
export function isProviderConfigured(provider: IntegrationProvider): boolean {
  const config = getProviderConfig(provider);
  const clientId = process.env[config.clientIdEnv];
  const clientSecret = process.env[config.clientSecretEnv];
  return !!(clientId && clientSecret && !clientId.includes("REPLACE"));
}
