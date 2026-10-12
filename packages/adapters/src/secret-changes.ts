import { createHash } from "node:crypto";
import type { SecretChangeListener } from "@rakazo/adapter-kit";

/** Store-owned invalidation; listeners never need provider revisions. */
export class SecretChanges {
  private readonly listeners = new Set<SecretChangeListener>();
  onChange(listener: SecretChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  protected changed(ref: string): void {
    for (const listener of this.listeners) {
      try {
        listener(ref);
      } catch {
        /* A consumer cannot fail a persisted write. */
      }
    }
  }
  protected clearListeners(): void {
    this.listeners.clear();
  }
}

/**
 * Cross-process notices identify an encrypted secret by this digest. The encrypted ref is
 * the ciphertext itself, which can exceed the Postgres NOTIFY payload limit.
 */
export function secretRefDigest(ref: string): string {
  return createHash("sha256").update(ref).digest("hex");
}

/** True when a change notice names `held`, either by the ref itself or by its digest. */
export function secretRefMatches(held: string, changed: string): boolean {
  return held === changed || secretRefDigest(held) === changed;
}
