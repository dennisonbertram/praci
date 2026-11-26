import { redactedRanges } from "./events.js";

const MARKER = "•••";

/** A known value shorter than this is left alone: a one-character key would blank every such character. */
const MIN_KNOWN_SECRET_LENGTH = 8;

// A value runs to the next quote, space or separator. Quoted values are bounded, so an unclosed
// quote costs a short scan per name instead of one to the end of the text.
const VALUE = String.raw`(?:"[^"\r\n]{0,500}"|'[^'\r\n]{0,500}'|\\{0,3}["'${"`"}]?[^\s"'${"`"}\\,;}&]+)`;
const CREDENTIAL_NAME = String.raw`(?:api[_-]?key|access[_-]?key|auth[_-]?key|private[_-]?key|secret|token(?!s\b)|password|passwd|authorization|credential)`;

const SECRET_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  // https://user:password@host
  [/:\/\/[^\s/?#@"'`]{1,500}@/g, `://${MARKER}@`],
  [/\b(Bearer|Basic)([ \t]+)[\w.~+/=-]+/gi, `$1$2${MARKER}`],
  [/\bsk-[\w-]{8,}/g, MARKER],
  // `api_key: "…"`, `"access_token":"…"`, `x-api-key: …`, `client_secret=…`, escaped JSON included.
  [
    new RegExp(
      String.raw`(${CREDENTIAL_NAME}[\w-]{0,40}\\{0,3}["'${"`"}]?[ \t]{0,10}[:=][ \t]{0,10})(?:(?:Bearer|Basic)[ \t]+)?${VALUE}`,
      "gi",
    ),
    `$1${MARKER}`,
  ],
  [/([?&]key=)[^\s&#"'`]+/gi, `$1${MARKER}`],
];

/**
 * A model connection error as it may be shown or returned: every credential in `secrets` (what the
 * connection was tried with) and every credential shape the provider may echo is hidden.
 */
export function sanitizeModelConnectionError(
  raw: string,
  secrets: ReadonlyArray<string | null | undefined> = [],
): string {
  const known = secrets.filter(
    (secret): secret is string =>
      typeof secret === "string" && secret.length >= MIN_KNOWN_SECRET_LENGTH,
  );
  let text = "";
  let offset = 0;
  for (const [start, end] of redactedRanges(raw, known)) {
    text += `${raw.slice(offset, start)}${MARKER}`;
    offset = end;
  }
  text = (text + raw.slice(offset)).trim();
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    text = text.replace(pattern, replacement);
  }
  return text;
}
