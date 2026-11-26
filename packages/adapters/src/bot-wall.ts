/** Recognises bot walls (challenge, rate limit, login) in a fetched response. Provider-neutral. */
export type BotWallKind = "transient" | "needs_person";
export type BotWall = { kind: BotWallKind; reason: string };

/** Pages with more visible text than this are real content, whatever scripts they embed. */
const MAX_WALL_TEXT = 1_500;

const CHALLENGE = [
  "just a moment",
  "checking your browser",
  "cf-turnstile",
  "cf-chl",
  "/cdn-cgi/challenge-platform",
  "g-recaptcha",
  "h-captcha",
  "verify you are human",
  "are you a robot",
  "unusual traffic",
  "attention required",
  "access denied",
];
const RATE_LIMIT = ["too many requests", "rate limit"];
const LOGIN = ["sign in to continue", "log in to continue", "login required"];

const includesAny = (text: string, markers: string[]) => markers.some((m) => text.includes(m));

export function classifyBotWall(input: {
  status: number;
  headers: Headers;
  body: string;
}): BotWall | null {
  const { status, headers } = input;
  if (headers.get("cf-mitigated")) return { kind: "needs_person", reason: "challenge page" };
  if (status === 401) return { kind: "needs_person", reason: "login required" };
  if (status === 429) return { kind: "transient", reason: "rate limited" };
  if (status === 503 && headers.has("retry-after")) {
    return { kind: "transient", reason: "temporarily unavailable" };
  }
  const visible = input.body
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (visible.length > MAX_WALL_TEXT) return null;
  const text = input.body.toLowerCase();
  if (includesAny(text, CHALLENGE)) return { kind: "needs_person", reason: "challenge page" };
  if (includesAny(text, RATE_LIMIT)) return { kind: "transient", reason: "rate limited" };
  if (includesAny(text, LOGIN)) return { kind: "needs_person", reason: "login required" };
  return null;
}

export function botWallInstruction(kind: BotWallKind): string {
  return kind === "transient"
    ? "The site is rate limiting this request. Retry once later; if it is still blocked, stop and tell the user."
    : "The site asks for a person (CAPTCHA, challenge or login). Do not retry. Offer request_takeover so the user can pass it, or use another source.";
}
