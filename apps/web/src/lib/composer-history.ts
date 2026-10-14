/** Step through sent messages. `null` is the live draft, 0 the newest sent message;
 * `undefined` means there is nowhere further to go. */
export function stepComposerHistory(
  length: number,
  index: number | null,
  direction: "older" | "newer",
): number | null | undefined {
  if (direction === "older") {
    const next = index === null ? 0 : index + 1;
    return next < length ? next : undefined;
  }
  if (index === null) return undefined;
  return index === 0 ? null : index - 1;
}
