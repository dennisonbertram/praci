/** "1,234.56", "-12.3", "(12.30)", "$5" to integer cents, with no floating point. */
export function parseCents(raw: string): number | null {
  let s = raw.trim().replace(/[$,\s]/g, "");
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.startsWith("+")) s = s.slice(1);
  const m = /^(\d*)(?:\.(\d{0,2}))?$/.exec(s);
  if (!m || (!m[1] && !m[2])) return null;
  const cents = Number(m[1] || "0") * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}

/** Used for file-name derived institution names: "chase_march.csv" to "chase march". */
export function fileStem(fileName: string): string {
  return (
    fileName
      .replace(/^.*[\\/]/, "")
      .replace(/\.[^.]*$/, "")
      .replace(/[_-]+/g, " ")
      .trim() || "Unknown institution"
  );
}

export const decodeText = (bytes: Uint8Array) =>
  new TextDecoder("utf-8").decode(bytes).replace(/^﻿/, "");
