import type {
  AppControlPolicy,
  AppControlScope,
  AppControlSnapshotRecord,
  AppControlStore,
} from "@rakazo/adapter-kit";
import { AppControlRefusedError } from "@rakazo/adapter-kit";
import type { AppControlApp, AppControlKey } from "@rakazo/contracts";
import { APP_CONTROL_KEYS, isDeniedApp } from "@rakazo/contracts";

/** The owner's allowlist entry for this id. Denied apps are refused even when listed. */
export function allowedEntry(policy: AppControlPolicy, appId: string): AppControlApp {
  const entry = policy.allowed.find((app) => app.id.toLowerCase() === appId.trim().toLowerCase());
  if (!entry) throw new AppControlRefusedError("app_not_allowed", "That app is not allowed.");
  if (isDeniedApp(entry))
    throw new AppControlRefusedError("app_denied", "That app cannot be used.");
  return entry;
}

export function requireKey(key: string): AppControlKey {
  if (!(APP_CONTROL_KEYS as readonly string[]).includes(key)) {
    throw new AppControlRefusedError("key_not_allowed", "That key cannot be pressed.");
  }
  return key as AppControlKey;
}

/**
 * A ref must come from the latest snapshot of the same app in the same scope, and that
 * snapshot must be unspent and not sensitive. Anything else never reaches the app.
 */
export async function requireActionableRef(
  store: AppControlStore,
  scope: AppControlScope,
  appId: string,
  ref: string,
): Promise<AppControlSnapshotRecord> {
  const snapshotId = /^@([A-Za-z0-9_-]+):e\d+$/.exec(ref)?.[1];
  if (!snapshotId) throw new AppControlRefusedError("invalid_ref", "That is not a snapshot ref.");
  const latest = await store.latest(scope, appId);
  if (!latest || latest.snapshotId !== snapshotId) {
    throw new AppControlRefusedError("stale_ref", "Take a new snapshot of this app first.");
  }
  if (latest.spent) {
    throw new AppControlRefusedError(
      "ref_spent",
      "An earlier action was uncertain. Take a new snapshot.",
    );
  }
  if (latest.sensitive) {
    throw new AppControlRefusedError("sensitive", "This screen has sign-in or secret content.");
  }
  return latest;
}
