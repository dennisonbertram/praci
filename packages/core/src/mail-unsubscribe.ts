import type { MailSignals } from "@rakazo/contracts";

export type UnsubscribePlan =
  | { method: "one_click"; url: string }
  | { method: "link"; url: string }
  | { method: "mailto"; target: string }
  | { method: "refused"; reason: "spam" | "auth_failed" }
  | { method: "none" };

/**
 * How an unsubscribe would go, in order: refuse spam-like mail (unsubscribing confirms the address
 * to the sender); RFC 8058 one click only with the post header, an https URL, and DKIM covering both
 * headers; else open the https link; else send the mailto. `flagged` is any spam sign outside these signals.
 */
export function planUnsubscribe(signals: MailSignals | null, flagged: boolean): UnsubscribePlan {
  if (flagged || signals?.categories.spam) return { method: "refused", reason: "spam" };
  if (!signals) return { method: "none" };
  if (Object.values(signals.auth).includes("fail"))
    return { method: "refused", reason: "auth_failed" };
  const url = signals.listUnsubscribe.find((entry) => entry.startsWith("https://"));
  if (url && signals.oneClick && signals.dkimCoversUnsubscribe && signals.auth.dkim === "pass")
    return { method: "one_click", url };
  if (url) return { method: "link", url };
  const target = signals.listUnsubscribe.find((entry) => entry.toLowerCase().startsWith("mailto:"));
  return target ? { method: "mailto", target } : { method: "none" };
}

const ADDRESS = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;
const noBreaks = (text: string) => text.replace(/[\r\n]+/g, " ");

/** The one recipient, subject and body of an unsubscribe mailto; cc, bcc and extra recipients are ignored. */
export function parseUnsubscribeMailto(
  target: string,
): { to: string; subject: string; body: string } | null {
  if (!target.toLowerCase().startsWith("mailto:")) return null;
  const [rawTo = "", query = ""] = target.slice("mailto:".length).split("?", 2);
  let to: string;
  try {
    to = decodeURIComponent(rawTo).trim();
  } catch {
    return null;
  }
  if (!ADDRESS.test(to)) return null;
  const params = new URLSearchParams(query);
  const subject = noBreaks(params.get("subject") ?? "")
    .trim()
    .slice(0, 200);
  const body = noBreaks(params.get("body") ?? "")
    .trim()
    .slice(0, 500);
  return { to, subject: subject || "unsubscribe", body: body || "unsubscribe" };
}
