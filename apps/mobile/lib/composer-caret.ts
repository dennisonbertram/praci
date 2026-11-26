/**
 * Where the caret most likely sits after a text change: onChangeText fires before onSelectionChange;
 * best guess until the real selection arrives.
 *
 * Edits are found as the changed middle between the common prefix and suffix, the same scan
 * shiftSpans uses, and the caret lands at the end of that middle.
 */
export function caretAfterChange(previous: string, next: string, previousCaret: number): number {
  if (previous === next) return previousCaret;
  const max = Math.min(previous.length, next.length);
  let prefix = 0;
  while (prefix < max && previous[prefix] === next[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < max - prefix &&
    previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]
  ) {
    suffix++;
  }
  return Math.min(next.length - suffix, next.length);
}
