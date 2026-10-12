import type { InboxClassifierProvider } from "@rakazo/adapter-kit";

export function inboxClassifierSelected(_env: NodeJS.ProcessEnv = process.env): boolean {
  return false;
}

export function createInboxClassifierProvider(
  _env: NodeJS.ProcessEnv = process.env,
  _options: { fetch?: typeof fetch } = {},
): InboxClassifierProvider | null {
  return null;
}
