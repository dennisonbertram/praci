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

const MONTHS =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

/**
 * Used for file-name derived institution names: "chase_march.csv" to "chase march". Dates, month
 * names and copy markers are dropped, so "checking-2026-07.csv", "checking-2026-08.csv" and
 * "checking (1).csv" all name the same account "checking".
 */
export function fileStem(fileName: string): string {
  const plain = fileName
    .replace(/^.*[\\/]/, "")
    .replace(/\.[^.]*$/, "")
    .replace(/[_-]+/g, " ")
    .trim();
  return normalizeStem(plain) || plain || "Unknown institution";
}

/** A file-name stem without dates, month names, "(1)" and "copy"; "" when nothing is left. */
export function normalizeStem(stem: string): string {
  return stem
    .toLowerCase()
    .replace(/[_.-]+/g, " ")
    .replace(/\(\s*\d+\s*\)/g, " ")
    .replace(/\bcopy\b/g, " ")
    .replace(/\b(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:[0-3]\d)?\b/g, " ")
    .replace(/\b(?:19|20)\d{2}\s+\d{1,2}(?:\s+\d{1,2})?\b/g, " ")
    .replace(/\b\d{1,2}\s+(?:19|20)\d{2}\b/g, " ")
    .replace(new RegExp(`\\b(?:${MONTHS})\\b`, "g"), " ")
    .replace(/\b(?:19|20)\d{2}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const decodeText = (bytes: Uint8Array) =>
  new TextDecoder("utf-8").decode(bytes).replace(/^﻿/, "");
