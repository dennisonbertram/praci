import type { MailSignals } from "@rakazo/contracts";

/** The only authserv-id whose Authentication-Results Gmail adds itself; others can be forged by the sender. */
const TRUSTED_AUTHSERV_ID = "mx.google.com";
const MAX_UNSUBSCRIBE = 3;
const MAX_TARGET = 2000;
const MAX_LIST_ID = 200;

type AuthResult = "pass" | "fail" | null;

/**
 * Turns a message's headers (lowercase names, every copy of a repeated header) and Gmail label
 * ids into provider-neutral signals. Pure: no I/O, never throws.
 */
export function parseMailSignals(headers: Map<string, string[]>, labelIds: string[]): MailSignals {
  const first = (name: string) => headers.get(name)?.[0]?.trim() ?? "";
  const unsubscribe = parseUnsubscribe(first("list-unsubscribe"));
  const { auth, dkimPassDomains } = parseAuthentication(headers.get("authentication-results"));
  const has = (label: string) => labelIds.includes(label);
  return {
    listUnsubscribe: unsubscribe,
    oneClick:
      unsubscribe.length > 0 &&
      /list-unsubscribe\s*=\s*one-click/i.test(first("list-unsubscribe-post")),
    listId: first("list-id").slice(0, MAX_LIST_ID) || null,
    bulk: ["bulk", "list", "junk"].includes(first("precedence").toLowerCase()),
    autoSubmitted: first("auto-submitted") !== "" && first("auto-submitted").toLowerCase() !== "no",
    auth,
    dkimCoversUnsubscribe: dkimCoversUnsubscribe(
      headers.get("dkim-signature") ?? [],
      dkimPassDomains,
    ),
    categories: {
      spam: has("SPAM"),
      promotions: has("CATEGORY_PROMOTIONS"),
      social: has("CATEGORY_SOCIAL"),
      updates: has("CATEGORY_UPDATES"),
      forums: has("CATEGORY_FORUMS"),
      important: has("IMPORTANT"),
    },
  };
}

/** https targets first, then mailto; plain http is dropped because it can be read and rewritten in transit. */
function parseUnsubscribe(value: string): string[] {
  const targets = [...value.matchAll(/<([^>]*)>/g)]
    .map((match) => (match[1] ?? "").replace(/\s+/g, ""))
    .filter((target) => target.length > 0 && target.length <= MAX_TARGET);
  const https = targets.filter((target) => /^https:\/\//i.test(target));
  const mailto = targets.filter((target) => /^mailto:/i.test(target));
  return [...https, ...mailto].slice(0, MAX_UNSUBSCRIBE);
}

function parseAuthentication(values: string[] | undefined): {
  auth: MailSignals["auth"];
  dkimPassDomains: string[];
} {
  const auth: MailSignals["auth"] = { dkim: null, spf: null, dmarc: null };
  const dkimPassDomains: string[] = [];
  const trusted = (values ?? [])
    .map((value) => value.replace(/\s+/g, " ").trim())
    .find(
      (value) =>
        (value.split(";")[0] ?? "").trim().split(" ")[0]?.toLowerCase() === TRUSTED_AUTHSERV_ID,
    );
  if (!trusted) return { auth, dkimPassDomains };
  for (const clause of trusted.split(";").slice(1)) {
    const match = /^\s*(dkim|spf|dmarc)\s*=\s*([a-z]+)/i.exec(clause);
    if (!match) continue;
    const method = (match[1] as string).toLowerCase() as "dkim" | "spf" | "dmarc";
    const result = authResult((match[2] as string).toLowerCase());
    if (method === "dkim") {
      // One passing signature is enough; a failure only counts when none passed.
      if (result === "pass") {
        auth.dkim = "pass";
        const domain =
          /header\.d\s*=\s*([^\s;]+)/i.exec(clause)?.[1] ??
          /header\.i\s*=\s*[^\s;@]*@([^\s;]+)/i.exec(clause)?.[1];
        if (domain) dkimPassDomains.push(domain.toLowerCase());
      } else if (auth.dkim === null) auth.dkim = result;
    } else if (auth[method] === null) auth[method] = result;
  }
  return { auth, dkimPassDomains };
}

function authResult(result: string): AuthResult {
  if (result === "pass") return "pass";
  if (result === "fail" || result === "softfail" || result === "permerror") return "fail";
  return null;
}

function dkimCoversUnsubscribe(signatures: string[], passDomains: string[]): boolean {
  if (passDomains.length === 0) return false;
  return signatures.some((signature) => {
    const tags = new Map<string, string>();
    for (const part of signature.split(";")) {
      const at = part.indexOf("=");
      if (at > 0)
        tags.set(part.slice(0, at).trim().toLowerCase(), part.slice(at + 1).replace(/\s+/g, ""));
    }
    const domain = tags.get("d")?.toLowerCase();
    const signed = (tags.get("h") ?? "").toLowerCase().split(":");
    // ponytail: matching on d= is the ceiling; also matching the selector (s=) is a later hardening.
    return (
      domain !== undefined &&
      passDomains.some((passed) => passed === domain || passed.endsWith(`.${domain}`)) &&
      signed.includes("list-unsubscribe") &&
      signed.includes("list-unsubscribe-post")
    );
  });
}
