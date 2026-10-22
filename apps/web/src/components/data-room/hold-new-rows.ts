/**
 * While a preview is open, files that arrive above the open row would push it down the list. They
 * wait instead, so the row being read stays where it is; the page offers them as a count.
 * `known` is the ids on screen when the preview opened.
 */
export function holdNewRows<T extends { item: { id: string } }>(
  rows: T[],
  known: ReadonlySet<string>,
  anchorId: string,
): { rows: T[]; held: number } {
  const anchor = rows.findIndex((row) => row.item.id === anchorId);
  if (anchor < 0) return { rows, held: 0 };
  const visible = rows.filter((row, index) => index > anchor || known.has(row.item.id));
  return { rows: visible, held: rows.length - visible.length };
}
