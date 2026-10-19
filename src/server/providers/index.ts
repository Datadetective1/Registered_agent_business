import "server-only";
import { getSettings } from "@/server/settings";
import { manualProvider } from "./manual";
import type { FulfillmentProvider, ProviderId } from "./types";

/** Registered providers. Add RegisteredAgentsIncProvider here once its API is integrated. */
const PROVIDERS: Record<ProviderId, FulfillmentProvider> = {
  manual: manualProvider,
};

export async function getProvider(): Promise<FulfillmentProvider> {
  const s = await getSettings();
  return PROVIDERS[s.operations.fulfillmentProvider as ProviderId] ?? manualProvider;
}

export function listProviders(): FulfillmentProvider[] {
  return Object.values(PROVIDERS);
}

export type * from "./types";
