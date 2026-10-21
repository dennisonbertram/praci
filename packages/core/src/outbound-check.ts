/**
 * Deterministic, offline check of what a bot is about to say to an external bot. A run records
 * the private text its tools returned (mail, finance, cap table, data room, ...) and the text it
 * knows to be public (what the external person wrote, web pages). An outbound message that
 * repeats a private fragment is held for the owner.
 *
 * Caught: an email address (any case, inside links or angle brackets), a number of four or more
 * digits (any thousands separator: 60,000 / 60000 / 60 000 / $60,000.50), a person or company
 * name that a tool returned under a name-like field or in a `Name <email>` header (any case, any
 * spacing), and a copied passage of eight or more words.
 *
 * Not caught: a paraphrase ("three funds led the seed"), a spelled-out or scaled number ("sixty
 * thousand", "$60k", "1.2M"), an obfuscated address ("a at b dot com"), a name typed with a
 * different spelling, and anything the run never read through a tool. A fragment that also
 * appears in the public text is never flagged, so what the person asked about can be repeated.
 */

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const NUMBER = /\d{1,3}(?:[,   ]\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;
const NAME_KEY =
  /^(?:name|full_?name|display_?name|holder|holders|investor|investors|company|organi[sz]ation|contact|from|to|cc|bcc|sender|recipient|customer|vendor|merchant|counterparty|owner)$/i;
const HEADER_NAME = /(?:^|[\n,;:["])\s*"?([^<>\n",;@]{2,60}?)"?\s*<[^<>\s@]+@[^<>\s]+>/g;
const SHINGLE_WORDS = 8;
/** Private text beyond this is not read: the check stays cheap and bounded. */
const MAX_TEXT_CHARS = 200_000;
const MAX_FRAGMENTS = 50_000;

type Fragments = {
  emails: Set<string>;
  numbers: Set<string>;
  names: Set<string>;
  passages: Set<string>;
};

const empty = (): Fragments => ({
  emails: new Set(),
  numbers: new Set(),
  names: new Set(),
  passages: new Set(),
});

function words(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function normalizeName(name: string): string | undefined {
  const joined = words(name).join(" ");
  // One short word ("Sam", "Acme") would match half of English; a name needs two words or length.
  return joined.includes(" ") || joined.length >= 8 ? joined : undefined;
}

function numbersIn(text: string): string[] {
  const out: string[] = [];
  for (const match of text.matchAll(NUMBER)) {
    const digits = match[0].replace(/[,   ]/g, "");
    const integer = digits.split(".")[0] ?? "";
    if (integer.length < 4) continue;
    // A bare year is not a figure.
    if (!digits.includes(".") && /^(19|20|21)\d{2}$/.test(integer) && !/[,   ]/.test(match[0])) {
      continue;
    }
    // Decimals are not kept: 1250000.00 and 1,250,000 are the same figure.
    out.push(integer);
  }
  return out;
}

function addNameStrings(into: Set<string>, value: unknown, depth = 0): void {
  if (depth > 8) return;
  if (typeof value === "string") {
    const name = normalizeName(value.replace(/<[^<>]*>/g, " "));
    if (name) into.add(name);
  } else if (Array.isArray(value)) {
    for (const item of value) addNameStrings(into, item, depth + 1);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      addNameStrings(into, item, depth + 1);
    }
  }
}

function collectNames(into: Set<string>, value: unknown, depth = 0): void {
  if (depth > 8 || !value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) collectNames(into, item, depth + 1);
    return;
  }
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (NAME_KEY.test(key)) addNameStrings(into, item);
    collectNames(into, item, depth + 1);
  }
}

function extract(rawText: string): Fragments {
  const text = rawText.slice(0, MAX_TEXT_CHARS);
  const out = empty();
  for (const email of text.match(EMAIL) ?? []) out.emails.add(email.toLowerCase());
  for (const number of numbersIn(text)) out.numbers.add(number);
  for (const match of text.matchAll(HEADER_NAME)) {
    const name = normalizeName(match[1] ?? "");
    if (name) out.names.add(name);
  }
  try {
    collectNames(out.names, JSON.parse(text) as unknown);
  } catch {
    // Not JSON: the header names above are what a mail body offers.
  }
  const list = words(text);
  for (let index = 0; index + SHINGLE_WORDS <= list.length; index += 1) {
    out.passages.add(list.slice(index, index + SHINGLE_WORDS).join(" "));
  }
  return out;
}

export type OutboundKind = "email" | "number" | "name" | "passage";

export class PrivateFragments {
  private readonly privateSet = empty();
  private readonly publicSet = empty();
  private publicSpaced = " ";

  get size(): number {
    return Object.values(this.privateSet).reduce((total, set) => total + set.size, 0);
  }

  /** Text a private source returned (mail, finance, a connector, another internal bot's answer). */
  addPrivate(text: string): void {
    this.merge(this.privateSet, extract(text));
  }

  /** Text that is already public to the recipient: what they wrote, a web page. */
  addPublic(text: string): void {
    this.merge(this.publicSet, extract(text));
    if (this.publicSpaced.length < MAX_TEXT_CHARS) {
      this.publicSpaced += `${words(text.slice(0, MAX_TEXT_CHARS)).join(" ")} `;
    }
  }

  private merge(into: Fragments, from: Fragments): void {
    for (const key of Object.keys(into) as (keyof Fragments)[]) {
      for (const value of from[key]) {
        if (into[key].size >= MAX_FRAGMENTS) break;
        into[key].add(value);
      }
    }
  }

  /** Kinds of private fragment the text repeats, ignoring anything that is also public. */
  matches(text: string): OutboundKind[] {
    const found = extract(text);
    const hit = (key: keyof Fragments) =>
      [...found[key]].some(
        (value) => this.privateSet[key].has(value) && !this.publicSet[key].has(value),
      );
    const kinds: OutboundKind[] = [];
    if (hit("emails")) kinds.push("email");
    if (hit("numbers")) kinds.push("number");
    // A name is read from the spaced-out outbound words, so case and spacing do not matter.
    const spaced = ` ${words(text).join(" ")} `;
    if (
      [...this.privateSet.names].some(
        (name) => !this.publicSpaced.includes(` ${name} `) && spaced.includes(` ${name} `),
      )
    ) {
      kinds.push("name");
    }
    if (hit("passages")) kinds.push("passage");
    return kinds;
  }
}

export type OutboundVerdict = { allow: true } | { allow: false; kinds: OutboundKind[] };

/** The rules-only check. A classifier can only add holds later; it never overrides one of these. */
export function checkOutbound(input: {
  text: string;
  fragments: PrivateFragments;
}): OutboundVerdict {
  const kinds = input.fragments.matches(input.text);
  return kinds.length === 0 ? { allow: true } : { allow: false, kinds };
}
