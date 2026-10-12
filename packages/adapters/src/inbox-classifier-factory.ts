import type { InboxClassifierProvider } from "@rakazo/adapter-kit";
import { typesafeApiKey } from "./auto-review.js";
import { TYPESAFE_CLASSIFIER_ID, TypesafeInboxClassifier } from "./typesafe-inbox-classifier.js";

export { TYPESAFE_CLASSIFIER_ID };

/**
 * `RAKAZO_INBOX_CLASSIFIER_PROVIDER=typesafe` plus the shared TYPESAFE_API_KEY turns on the
 * optional TypeSafe classifier. The key alone does not: it also serves Auto Review, and sending
 * mail to TypeSafe is a separate choice. Without both, triage uses the LLM alone.
 */
export function inboxClassifierSelected(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    env.RAKAZO_INBOX_CLASSIFIER_PROVIDER?.trim().toLowerCase() === "typesafe" &&
    Boolean(typesafeApiKey(env))
  );
}

export function createInboxClassifierProvider(
  env: NodeJS.ProcessEnv = process.env,
  options: { fetch?: typeof fetch } = {},
): InboxClassifierProvider | null {
  const apiKey = typesafeApiKey(env);
  if (!apiKey || !inboxClassifierSelected(env)) return null;
  return new TypesafeInboxClassifier({
    apiKey,
    fetch: options.fetch,
    model: env.RAKAZO_INBOX_CLASSIFIER_MODEL?.trim() || undefined,
  });
}
