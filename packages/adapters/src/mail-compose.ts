import { randomBytes } from "node:crypto";
import {
  type MailAddress,
  type MailDraftAttachment,
  type MailMessage,
  MailProviderError,
} from "@rakazo/adapter-kit";

export interface ComposedMail {
  to: MailAddress[];
  cc: MailAddress[];
  bcc: MailAddress[];
  subject: string;
  text: string;
  /** Sanitized HTML for the HTML part; without it the part is the text, escaped. */
  html?: string;
  attachments?: MailDraftAttachment[];
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
  /** A forward of an HTML mail: the original's body as sanitized editor HTML, without the header. */
  quotedHtml?: string;
}

/** Where the person is, for dates written into the quote. Both are optional; the default is UTC. */
export interface PrefillLocale {
  timeZone?: string;
  locale?: string;
}

export const MAX_RECIPIENTS = 100;

const invalid = (message: string) => new MailProviderError("invalid", message);

// Practical addr-spec: ASCII only (no SMTPUTF8), dotted domain, no quoted local parts.
const LOCAL = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;
const MESSAGE_IDS = /^<[^<>\s@]+@[^<>\s@]+>(?:\s+<[^<>\s@]+@[^<>\s@]+>)*$/;
// biome-ignore lint/suspicious/noControlCharactersInRegex: this is the check for control characters
const CONTROL = /[\u0000-\u001f\u007f]/;
const ATOM_NAME = /^[A-Za-z0-9 !#$%&'*+/=?^_`{|}~-]+$/;

function isAddress(value: string): boolean {
  if (value.length > 254) return false;
  const at = value.lastIndexOf("@");
  if (at < 1) return false;
  const local = value.slice(0, at);
  const labels = value.slice(at + 1).split(".");
  return (
    local.length <= 64 &&
    LOCAL.test(local) &&
    labels.length >= 2 &&
    labels.every((label) => LABEL.test(label))
  );
}

function checkAddress(entry: MailAddress): void {
  if (!isAddress(entry.address)) throw invalid("One of the addresses is not valid");
  if (entry.name !== undefined && CONTROL.test(entry.name))
    throw invalid("A recipient name has a line break or control character");
}

/** Encodes text that is not plain printable ASCII as RFC 2047 UTF-8 base64 words of at most 75 characters. */
function encodeWords(text: string): string {
  if (/^[\x20-\x7e]*$/.test(text)) return text;
  const words: string[] = [];
  let chunk = "";
  let bytes = 0;
  for (const char of text) {
    const size = Buffer.byteLength(char);
    // 45 bytes encode to 60 base64 characters; with the 12 of framing a word is 72 characters.
    if (bytes + size > 45) {
      words.push(chunk);
      chunk = "";
      bytes = 0;
    }
    chunk += char;
    bytes += size;
  }
  if (chunk) words.push(chunk);
  return words
    .map((word) => `=?UTF-8?B?${Buffer.from(word, "utf8").toString("base64")}?=`)
    .join("\r\n ");
}

function formatName(name: string): string {
  if (ATOM_NAME.test(name)) return name;
  return `"${name.replace(/[\\"]/g, "\\$&")}"`;
}

/** `Name <a@b>` as a person types it; not encoded, so it round-trips through `parseRecipients`. */
export function displayAddress(entry: MailAddress): string {
  return entry.name ? `${formatName(entry.name)} <${entry.address}>` : entry.address;
}

function headerAddress(entry: MailAddress): string {
  checkAddress(entry);
  if (!entry.name) return entry.address;
  const name = /^[\x20-\x7e]*$/.test(entry.name) ? formatName(entry.name) : encodeWords(entry.name);
  return `${name} <${entry.address}>`;
}

/** Joins list items with folds so no line gets long. */
function foldList(items: string[]): string {
  let line = "";
  const lines: string[] = [];
  for (const item of items) {
    if (line && line.length + item.length > 70) {
      lines.push(line);
      line = "";
    }
    line += (line ? ", " : "") + item;
  }
  lines.push(line);
  return lines.join(",\r\n ");
}

function checkSubject(subject: string): string {
  // Tab is allowed in a header; every other control character, including CR and LF, is not.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: this is the check for control characters
  if (/[\u0000-\u0008\u000a-\u001f\u007f]/.test(subject))
    throw invalid("The subject has a line break or control character");
  return subject;
}

function checkFilename(name: string): string {
  if (!name || name.length > 255 || CONTROL.test(name) || /[\\/]/.test(name))
    throw invalid("An attachment name is not valid");
  return name;
}

function checkIds(value: string, label: string): string {
  if (!MESSAGE_IDS.test(value)) throw invalid(`${label} is not a message id list`);
  return value;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** The plain text as HTML: escaped, one <br> per line break, indentation kept. */
function htmlBody(text: string): string {
  const lines = text.split(/\r\n|\r|\n/).map((line) =>
    escapeHtml(line)
      .replace(/^ +/, (lead) => "&nbsp;".repeat(lead.length))
      .replace(/ {2,}/g, (run) => ` ${"&nbsp;".repeat(run.length - 1)}`),
  );
  return `<div dir="auto">${lines.join("<br>\r\n")}</div>`;
}

function base64Lines(text: string): string {
  const encoded = Buffer.from(text, "utf8").toString("base64");
  return encoded.replace(/.{1,76}/g, "$&\r\n").trimEnd();
}

/**
 * Builds the RFC 2822 message Gmail's `raw` field takes: To, Cc, Bcc, Subject and threading headers,
 * and a multipart/alternative body of the text and an HTML copy of it. No From header: Gmail sets it
 * to the authenticated account. Every value is checked, so no input can add a header.
 * A message needs a recipient unless it is only a draft.
 */
export function buildRawMessage(mail: ComposedMail, options: { draft?: boolean } = {}): string {
  const recipients = mail.to.length + mail.cc.length + mail.bcc.length;
  if (recipients === 0 && !options.draft) throw invalid("Add a recipient");
  if (recipients > MAX_RECIPIENTS) throw invalid(`At most ${MAX_RECIPIENTS} recipients`);
  const headers: string[] = [];
  for (const [name, list] of [
    ["To", mail.to],
    ["Cc", mail.cc],
    ["Bcc", mail.bcc],
  ] as const) {
    if (list.length) headers.push(`${name}: ${foldList(list.map(headerAddress))}`);
  }
  headers.push(`Subject: ${encodeWords(checkSubject(mail.subject))}`);
  if (mail.inReplyTo) headers.push(`In-Reply-To: ${checkIds(mail.inReplyTo, "In-Reply-To")}`);
  if (mail.references) headers.push(`References: ${checkIds(mail.references, "References")}`);
  const boundary = `rakazo-${randomBytes(12).toString("hex")}`;
  const text = mail.text.replace(/\r\n|\r|\n/g, "\r\n");
  const part = (type: string, body: string) =>
    `--${boundary}\r\nContent-Type: ${type}; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64Lines(body)}\r\n`;
  const alternative = `${part("text/plain", text)}${part("text/html", mail.html ?? htmlBody(mail.text))}`;
  headers.push("MIME-Version: 1.0");
  const files = mail.attachments ?? [];
  if (files.length === 0) {
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    return `${headers.join("\r\n")}\r\n\r\n${alternative}--${boundary}--\r\n`;
  }
  // multipart/mixed: the text and HTML copies as one nested multipart/alternative, then the files.
  const inner = `rakazo-${randomBytes(12).toString("hex")}`;
  const nested = alternative.split(`--${boundary}`).join(`--${inner}`);
  const attachments = files.map((file) => {
    const name = checkFilename(file.filename);
    const quoted = /^[\x20-\x7e]*$/.test(name)
      ? `filename="${name.replace(/[\\"]/g, "\\$&")}"`
      : `filename*=UTF-8''${encodeURIComponent(name)}`;
    const type = /^[\w.+-]+\/[\w.+-]+$/.test(file.mimeType)
      ? file.mimeType
      : "application/octet-stream";
    const body = Buffer.from(file.data)
      .toString("base64")
      .replace(/.{1,76}/g, "$&\r\n")
      .trimEnd();
    return `--${boundary}\r\nContent-Type: ${type}\r\nContent-Disposition: attachment; ${quoted}\r\nContent-Transfer-Encoding: base64\r\n\r\n${body}\r\n`;
  });
  headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  return `${headers.join("\r\n")}\r\n\r\n--${boundary}\r\nContent-Type: multipart/alternative; boundary="${inner}"\r\n\r\n${nested}--${inner}--\r\n\r\n${attachments.join("")}--${boundary}--\r\n`;
}

/**
 * Reads a recipient field: names and addresses separated by commas or semicolons, with quoted
 * names that may contain either. Throws `invalid` for an entry that is not an address; with
 * `lenient` such entries are dropped, for saving a draft while the person is still typing.
 */
export function parseRecipients(text: string, lenient = false): MailAddress[] {
  const entries: string[] = [];
  let current = "";
  let quoted = false;
  let angle = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i] as string;
    if (char === "\\" && quoted) {
      current += char + (text[++i] ?? "");
      continue;
    }
    if (char === '"') quoted = !quoted;
    else if (!quoted && char === "<") angle = true;
    else if (!quoted && char === ">") angle = false;
    if ((char === "," || char === ";") && !quoted && !angle) {
      entries.push(current);
      current = "";
    } else current += char;
  }
  entries.push(current);

  const result: MailAddress[] = [];
  for (const entry of entries) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const match = /^([\s\S]*?)<([^<>]*)>$/.exec(trimmed);
    const rawName = (match?.[1] ?? "").trim();
    const name =
      rawName.length > 1 && rawName.startsWith('"') && rawName.endsWith('"')
        ? rawName.slice(1, -1).replace(/\\(.)/g, "$1")
        : rawName;
    const address = (match ? (match[2] as string) : trimmed).trim();
    const parsed: MailAddress = name ? { name, address } : { address };
    try {
      checkAddress(parsed);
    } catch (error) {
      if (lenient) continue;
      throw error;
    }
    result.push(parsed);
  }
  return result;
}

/** Lower case; for Gmail also without dots and +tags in the name, with googlemail.com as gmail.com. */
function mailbox(address: string): string {
  const [name = "", domain = ""] = address.toLowerCase().split(/@(?=[^@]*$)/);
  if (domain !== "gmail.com" && domain !== "googlemail.com") return `${name}@${domain}`;
  return `${name.replace(/\+.*/, "").replace(/\./g, "")}@gmail.com`;
}

const sameAddress = (a: MailAddress, b: MailAddress) => mailbox(a.address) === mailbox(b.address);

function unique(list: MailAddress[], skip: MailAddress[]): MailAddress[] {
  const kept: MailAddress[] = [];
  for (const entry of list) {
    if (![...skip, ...kept].some((other) => sameAddress(other, entry))) kept.push(entry);
  }
  return kept;
}

const quote = (text: string) =>
  text
    .replace(/\r\n|\r/g, "\n")
    .split("\n")
    .map((line) => (line ? `> ${line}` : ">"))
    .join("\n");

/** "Wed, Oct 14, 2026, 2:17 AM" in the person's zone; an unknown zone or locale falls back to UTC and en-US. */
function formatWhen(date: string, { timeZone, locale }: PrefillLocale): string {
  if (Number.isNaN(Date.parse(date))) return date;
  const options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  };
  const make = (l: string, tz: string) => {
    try {
      return new Intl.DateTimeFormat(l, { ...options, timeZone: tz });
    } catch {
      return null;
    }
  };
  const format =
    make(locale || "en-US", timeZone || "UTC") ??
    make("en-US", timeZone || "UTC") ??
    make(locale || "en-US", "UTC") ??
    make("en-US", "UTC");
  // Newer ICU puts a narrow no-break space before AM/PM.
  return (format?.format(new Date(date)) ?? date).replace(/\u202f/g, " ");
}

/**
 * Recipients, subject and quoted original for answering `message`. `self` is the user's own
 * address, left out of reply-all. Dates are written in the given time zone (default UTC).
 */
export function replyPrefill(
  message: MailMessage,
  mode: ComposeMode,
  self: string | string[] | null,
  where: PrefillLocale = {},
): ComposePrefill {
  const me = [self ?? []].flat().map((address) => ({ address }));
  const when = formatWhen(message.date, where);
  const sender = message.from ? displayAddress(message.from) : "";
  if (mode === "forward") {
    const lines = [
      "---------- Forwarded message ---------",
      `From: ${sender}`,
      `Date: ${when}`,
      `Subject: ${message.subject}`,
      `To: ${message.to.map(displayAddress).join(", ")}`,
      ...(message.cc.length ? [`Cc: ${message.cc.map(displayAddress).join(", ")}`] : []),
    ];
    return {
      to: "",
      cc: "",
      subject: /^\s*fwd?:/i.test(message.subject) ? message.subject : `Fwd: ${message.subject}`,
      body: `\n\n${lines.join("\n")}\n\n${message.text}`,
    };
  }
  const from = message.from;
  const fromMe = Boolean(from && me.some((m) => sameAddress(m, from)));
  // Answering one's own message goes to whoever it was sent to.
  const back = fromMe ? message.to : message.replyTo.length ? message.replyTo : from ? [from] : [];
  const kept = unique(mode === "replyAll" ? [...back, ...message.to] : back, fromMe ? [] : me);
  // Never leave To empty: fall back to the sender.
  const to = kept.length || !from ? kept : [from];
  const cc = mode === "replyAll" ? unique(message.cc, [...to, ...me]) : [];
  return {
    to: to.map(displayAddress).join(", "),
    cc: cc.map(displayAddress).join(", "),
    subject: /^\s*re:/i.test(message.subject) ? message.subject : `Re: ${message.subject}`,
    body: `\n\nOn ${when}, ${sender} wrote:\n${quote(message.text)}`,
  };
}
