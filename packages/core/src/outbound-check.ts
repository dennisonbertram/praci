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
const CAPITALIZED_SPAN = /\p{Lu}[\p{L}'\u2019-]+(?:\s+\p{Lu}[\p{L}'\u2019-]+)+/gu;
const MAX_SPAN_WORDS = 12;
const SHINGLE_WORDS = 8;
/** Private text beyond this is not read: the check stays cheap and bounded. */
const MAX_TEXT_CHARS = 200_000;
const MAX_FRAGMENTS = 50_000;
/**
 * A name is matched as a run of 1..32 outbound words so it can be looked up by hash.
 * ponytail: a longer name is kept as its first 32 words, so text repeating those 32 words is held
 * even if the rest differs. Raise the cap if such names appear.
 */
const MAX_NAME_WORDS = 32;

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
  const joined = words(name).slice(0, MAX_NAME_WORDS).join(" ");
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

/** JSON inside a string field (an MCP envelope's `text`) is read too, within these bounds. */
const MAX_NESTED_JSON_CHARS = 100_000;

function collectNames(into: Set<string>, value: unknown, depth = 0): void {
  if (depth > 8) return;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (
      trimmed.length <= MAX_NESTED_JSON_CHARS &&
      (trimmed.startsWith("{") || trimmed.startsWith("["))
    ) {
      try {
        collectNames(into, JSON.parse(trimmed) as unknown, depth + 1);
      } catch {
        // Not JSON after all.
      }
    }
    return;
  }
  if (!value || typeof value !== "object") return;
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

const KEYS = ["emails", "numbers", "names", "passages"] as const;

/** One stored fragment: `tag` is (public ? 4 : 0) | index of the kind in KEYS; `hash` is the keyed hash. */
export type FragmentEntry = { tag: number; hash: string };
/** What was added since the last `takeDelta()`: entries, and the public words appended in order. */
export type FragmentDelta = {
  entries: FragmentEntry[];
  publicWords: string | null;
};

/**
 * `hash` maps a tagged value to a stable string. The default keeps text as is; a run that must
 * survive a restart passes a keyed hash, so the stored record holds no readable private text.
 */
export class PrivateFragments {
  private readonly privateSet = empty();
  private readonly publicSet = empty();
  private publicSpaced = " ";
  private pending: FragmentEntry[] = [];
  private pendingWords = "";

  constructor(private readonly hash: (taggedValue: string) => string = (value) => value) {}

  get size(): number {
    return Object.values(this.privateSet).reduce((total, set) => total + set.size, 0);
  }

  private hashed(key: keyof Fragments, value: string): string {
    return this.hash(`${KEYS.indexOf(key)}\0${value}`);
  }

  private put(isPublic: boolean, key: keyof Fragments, value: string): void {
    const set = (isPublic ? this.publicSet : this.privateSet)[key];
    if (set.size >= MAX_FRAGMENTS) return;
    const hash = this.hashed(key, value);
    if (set.has(hash)) return;
    set.add(hash);
    this.pending.push({ tag: (isPublic ? 4 : 0) | KEYS.indexOf(key), hash });
  }

  /** Text a private source returned (mail, finance, a connector, another internal bot's answer). */
  addPrivate(text: string): void {
    this.merge(false, extract(text));
  }

  /**
   * Another internal bot's plain-text answer. Structure is lost in a relay ("Priya Shah" no longer
   * sits under a name field), so every run of two or more capitalized words is also kept as a name.
   */
  addPrivateRelay(text: string): void {
    this.addPrivate(text);
    for (const match of text.slice(0, MAX_TEXT_CHARS).matchAll(CAPITALIZED_SPAN)) {
      // "Contact Priya Shah" also keeps "Priya Shah": every contiguous run of two or more words.
      const spanWords = match[0].split(/\s+/).slice(0, MAX_SPAN_WORDS);
      for (let from = 0; from < spanWords.length - 1; from += 1) {
        for (let to = from + 2; to <= spanWords.length; to += 1) {
          const name = normalizeName(spanWords.slice(from, to).join(" "));
          if (name) this.put(false, "names", name);
        }
      }
    }
  }

  /** Text that is already public to the recipient: what they wrote, a web page. */
  addPublic(text: string): void {
    this.merge(true, extract(text));
    if (this.publicSpaced.length < MAX_TEXT_CHARS) {
      const added = `${words(text.slice(0, MAX_TEXT_CHARS)).join(" ")} `;
      this.publicSpaced += added;
      this.pendingWords += added;
    }
  }

  private merge(isPublic: boolean, from: Fragments): void {
    for (const key of KEYS) for (const value of from[key]) this.put(isPublic, key, value);
  }

  /** Everything added since the last call, for storing. */
  takeDelta(): FragmentDelta | undefined {
    if (this.pending.length === 0 && this.pendingWords === "") return undefined;
    const delta = {
      entries: this.pending,
      publicWords: this.pendingWords || null,
    };
    this.pending = [];
    this.pendingWords = "";
    return delta;
  }

  /** Refill from stored deltas, in the order they were taken. Nothing restored is returned again. */
  restore(deltas: readonly FragmentDelta[]): void {
    for (const delta of deltas) {
      for (const { tag, hash } of delta.entries) {
        const key = KEYS[tag & 3];
        if (key) (tag & 4 ? this.publicSet : this.privateSet)[key].add(hash);
      }
      if (delta.publicWords) this.publicSpaced += delta.publicWords;
    }
  }

  /** Kinds of private fragment the text repeats, ignoring anything that is also public. */
  matches(text: string): OutboundKind[] {
    const found = extract(text);
    const hit = (key: keyof Fragments) =>
      [...found[key]].some((value) => {
        const hash = this.hashed(key, value);
        return this.privateSet[key].has(hash) && !this.publicSet[key].has(hash);
      });
    const kinds: OutboundKind[] = [];
    if (hit("emails")) kinds.push("email");
    if (hit("numbers")) kinds.push("number");
    // A name is read from the spaced-out outbound words, so case and spacing do not matter: it
    // matches when it equals a run of 1..32 of them.
    if (this.privateSet.names.size > 0 && this.hasName(words(text))) kinds.push("name");
    if (hit("passages")) kinds.push("passage");
    return kinds;
  }

  private hasName(list: string[]): boolean {
    for (let from = 0; from < list.length; from += 1) {
      for (let to = from + 1; to <= Math.min(list.length, from + MAX_NAME_WORDS); to += 1) {
        const name = list.slice(from, to).join(" ");
        // A name is two words or eight characters (see normalizeName).
        if (to === from + 1 && name.length < 8) continue;
        if (
          this.privateSet.names.has(this.hashed("names", name)) &&
          !this.publicSpaced.includes(` ${name} `)
        ) {
          return true;
        }
      }
    }
    return false;
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
