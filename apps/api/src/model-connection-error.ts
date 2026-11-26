import { parseModelSecret } from "@rakazo/adapters";
import { sanitizeModelConnectionError } from "@rakazo/core";

/**
 * What a client is told when a model connection attempt fails. Every credential the attempt could
 * have sent is hidden here, so a client that does not hide them itself never receives them.
 */
export function modelConnectionErrorMessage(
  error: unknown,
  fallback: string,
  attempted: ReadonlyArray<string | null | undefined>,
): string {
  if (!(error instanceof Error)) return fallback;
  return sanitizeModelConnectionError(error.message, attempted) || fallback;
}

/** The key a saved connection holds, which a request that leaves it out reuses. */
export function savedModelKey(plaintext: string): string | undefined {
  try {
    const saved = parseModelSecret(plaintext);
    if (saved.kind === "api_key") return saved.key;
    if (saved.kind === "openai_compatible") return saved.apiKey;
  } catch {
    // A corrupt saved secret is never sent.
  }
  return undefined;
}
