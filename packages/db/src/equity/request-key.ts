import { createHash } from "node:crypto";
import { EquityConflictError } from "./ledger.js";

type Keyed = { requestKey?: string | undefined };

/** Stable fingerprint of a create request, without its key. */
export function requestHash(input: object): string {
  const { requestKey: _key, ...rest } = input as Record<string, unknown>;
  const canonical = JSON.stringify(rest, (_name, value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : 1)))
      : value,
  );
  return createHash("sha256").update(canonical).digest("hex");
}

/** Columns that record the key on a new row; nothing when the caller sent no key. */
export function keyColumns(input: Keyed) {
  return input.requestKey ? { requestKey: input.requestKey, requestHash: requestHash(input) } : {};
}

/**
 * The id the first request with this key created, or null for a new key. Run it after the ledger
 * lock so concurrent retries serialize. The same key with different terms is a conflict.
 */
export async function replayedId(
  input: Keyed,
  find: (requestKey: string) => Promise<{ id: string; requestHash: string | null } | null>,
): Promise<string | null> {
  if (!input.requestKey) return null;
  const row = await find(input.requestKey);
  if (!row) return null;
  if (row.requestHash !== requestHash(input))
    throw new EquityConflictError("The request key was reused with different terms");
  return row.id;
}
