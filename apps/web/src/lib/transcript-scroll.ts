export function transcriptIsNearEnd(
  element: Pick<HTMLElement, "scrollHeight" | "scrollTop" | "clientHeight">,
): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight < 80;
}

export function transcriptCanSnapAfterFrame(
  element: Pick<HTMLElement, "scrollTop"> | null,
  queuedElement: Pick<HTMLElement, "scrollTop">,
  queuedScrollTop: number,
): boolean {
  return element === queuedElement && queuedElement.scrollTop === queuedScrollTop;
}

export function transcriptMovedDown(previousScrollTop: number | null, scrollTop: number): boolean {
  return previousScrollTop !== null && scrollTop >= previousScrollTop;
}

/**
 * True when the latest message is one the user just sent: a new last message from the user. The
 * transcript then scrolls to it even if the reader had scrolled up, so the reply shows below it.
 */
export function transcriptUserJustSent(
  previousLastId: string | null,
  last: { id: string; role: string } | undefined,
): boolean {
  return (
    previousLastId !== null &&
    last !== undefined &&
    last.role === "user" &&
    last.id !== previousLastId
  );
}
