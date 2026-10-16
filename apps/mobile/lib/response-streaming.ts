import type { ResponseStreamingPreference } from "@rakazo/core";
import {
  normalizeResponseStreamingPreference,
  RESPONSE_STREAMING_STORAGE_KEY,
  responseStreamingEnabled,
} from "@rakazo/core";
import { createSecureStorePreference } from "./secure-preference-store";

export type { ResponseStreamingPreference };

const store = createSecureStorePreference<ResponseStreamingPreference>({
  key: RESPONSE_STREAMING_STORAGE_KEY,
  normalize: normalizeResponseStreamingPreference,
  fallback: "off",
});

export const getCachedResponseStreamingPreference = store.getCached;
export const getCachedResponseStreamingEnabled = (): boolean =>
  responseStreamingEnabled(store.getCached());
export const loadResponseStreamingPreference = store.load;
export const setResponseStreamingPreference = store.set;
export const subscribeResponseStreaming = store.subscribe;
