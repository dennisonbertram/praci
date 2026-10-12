import type { ConnectorProxyResponse, MailAccount, MailProvider } from "@rakazo/adapter-kit";
import type { GmailMailProviderDeps } from "./gmail-mail-provider.js";

export interface EmulatedMessage {
  id: string;
  threadId?: string;
  /** ISO 8601. */
  date: string;
  labels: string[];
  /** Raw header values, so tests can supply quoted names and encoded words. */
  from: string;
  to: string;
  cc?: string;
  subject: string;
  /** Raw snippet; may contain HTML entities as Gmail returns them. */
  snippet?: string;
  text?: string;
  html?: string;
  charset?: "utf-8" | "iso-8859-1";
  attachments?: Array<{ filename: string; mimeType: string; size: number }>;
}

export interface GmailSeed {
  now?: Date;
  mailboxes?: Record<string, { address: string; messages: EmulatedMessage[] }>;
}

export class GmailApiEmulator {
  readonly requests: Array<{ accountRef: string; url: string }> = [];
  constructor(_seed: GmailSeed = {}) {}
  handle(_accountRef: string, _url: string): ConnectorProxyResponse {
    throw new Error("not implemented");
  }
  failNext(
    _status: number,
    _options: {
      times?: number;
      reason?: string;
      retryAfter?: number;
      urlIncludes?: string;
      skip?: number;
    } = {},
  ): void {
    throw new Error("not implemented");
  }
  clearFailures(): void {
    throw new Error("not implemented");
  }
}

export interface MailEmulator {
  provider: MailProvider;
  gmail: GmailApiEmulator;
  accounts: MailAccount[];
}

export function createMailEmulator(
  _options: { now?: Date } & Pick<GmailMailProviderDeps, "sleep" | "random"> = {},
): MailEmulator {
  throw new Error("not implemented");
}
