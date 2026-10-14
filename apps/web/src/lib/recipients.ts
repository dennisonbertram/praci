/** One recipient as typed or loaded: `a@b.test` or `Name <a@b.test>`. */
export interface Recipient {
  /** What is sent to the server, trimmed. */
  entry: string;
  name: string;
  address: string;
  valid: boolean;
}

// Same shape the server accepts (ASCII addr-spec with a dotted domain); the server stays the authority.
const ADDRESS =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;

export const isEmailAddress = (value: string) => value.length <= 254 && ADDRESS.test(value);

/** Splits on commas, semicolons and line breaks outside quotes and angle brackets. */
export function splitEntries(text: string): string[] {
  const parts: string[] = [];
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
    if ((char === "," || char === ";" || char === "\n" || char === "\r") && !quoted && !angle) {
      parts.push(current);
      current = "";
    } else current += char;
  }
  parts.push(current);
  return parts;
}

export function parseRecipient(raw: string): Recipient {
  const entry = raw.trim();
  const match = /^([\s\S]*?)<([^<>]*)>$/.exec(entry);
  const rawName = (match?.[1] ?? "").trim();
  const name =
    rawName.length > 1 && rawName.startsWith('"') && rawName.endsWith('"')
      ? rawName.slice(1, -1).replace(/\\(.)/g, "$1")
      : rawName;
  const address = (match ? (match[2] as string) : entry).trim();
  return { entry, name, address, valid: isEmailAddress(address) };
}

/**
 * Splits `text` into finished entries and the unfinished tail. Pass `final` to finish the tail too
 * (Enter, Tab, blur, paste). Entries already in `existing` (same address) are dropped.
 */
export function takeEntries(
  text: string,
  existing: string[],
  final = false,
): { added: string[]; rest: string } {
  const parts = splitEntries(text);
  const rest = final ? "" : (parts.pop() ?? "");
  const seen = new Set(existing.map((entry) => parseRecipient(entry).address.toLowerCase()));
  const added: string[] = [];
  for (const part of parts) {
    const recipient = parseRecipient(part);
    if (!recipient.entry) continue;
    const key = recipient.address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    added.push(recipient.entry);
  }
  return { added, rest };
}
