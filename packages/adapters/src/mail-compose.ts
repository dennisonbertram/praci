import type { MailAddress, MailMessage } from "@rakazo/adapter-kit";

export interface ComposedMail {
  to: MailAddress[];
  cc: MailAddress[];
  bcc: MailAddress[];
  subject: string;
  text: string;
  /** Message-ID header value of the message answered, with angle brackets. */
  inReplyTo?: string;
  /** References header of that message, if it had one. */
  references?: string;
}

export type ComposeMode = "reply" | "replyAll" | "forward";

export interface ComposePrefill {
  to: string;
  cc: string;
  subject: string;
  body: string;
}

export function buildRawMessage(_mail: ComposedMail): string {
  throw new Error("not implemented");
}

export function parseRecipients(_text: string): MailAddress[] {
  throw new Error("not implemented");
}

export function replyPrefill(
  _message: MailMessage,
  _mode: ComposeMode,
  _self: string | null,
): ComposePrefill {
  throw new Error("not implemented");
}
