/** Whole dollars typed in a field, in cents: null when empty, undefined when it is not an amount. */
export function centsFromText(text: string): number | null | undefined {
  const cleaned = text.replace(/[,$\s]/g, "");
  if (!cleaned) return null;
  const dollars = Number(cleaned);
  return Number.isFinite(dollars) && dollars >= 0 ? Math.round(dollars * 100) : undefined;
}
