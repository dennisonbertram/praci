import type { RemoteImagesPreference } from "@rakazo/core";
import { normalizeRemoteImagesPreference, REMOTE_IMAGES_STORAGE_KEY } from "@rakazo/core";
import { createSecureStorePreference } from "./secure-preference-store";

export type { RemoteImagesPreference };

const store = createSecureStorePreference<RemoteImagesPreference>({
  key: REMOTE_IMAGES_STORAGE_KEY,
  normalize: normalizeRemoteImagesPreference,
  fallback: "off",
});

export const getCachedRemoteImagesEnabled = (): boolean => store.getCached() === "on";
export const loadRemoteImagesPreference = store.load;
export const setRemoteImagesPreference = store.set;
export const subscribeRemoteImages = store.subscribe;
