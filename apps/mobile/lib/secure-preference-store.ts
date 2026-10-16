import * as SecureStore from "expo-secure-store";

/** An in-memory preference mirrored to SecureStore, with change notification. */
export function createSecureStorePreference<T extends string>(options: {
  key: string;
  normalize: (stored: string | null) => T;
  fallback: T;
}) {
  let memory: T | null = null;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };

  return {
    getCached: (): T => memory ?? options.fallback,
    async load(): Promise<T> {
      try {
        memory = options.normalize(await SecureStore.getItemAsync(options.key));
      } catch {
        memory = memory ?? options.fallback;
      }
      notify();
      return memory;
    },
    async set(preference: T): Promise<T> {
      memory = preference;
      // Paint the switch before SecureStore resolves.
      notify();
      try {
        await SecureStore.setItemAsync(options.key, preference);
      } catch {
        // Keep the in-memory preference when SecureStore is unavailable.
      }
      return preference;
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
