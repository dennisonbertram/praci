/** Calls `onClosed` once when the sign-in window closes. Returns a stop function.
 * Providers whose login pages send COOP sever the handle, so a closed window is a hint, not proof
 * the sign-in failed: callers keep waiting for the real result after reporting it. */
export function watchWindowClosed(
  popup: Pick<Window, "closed">,
  onClosed: () => void,
  intervalMs = 1000,
): () => void {
  const timer = window.setInterval(() => {
    if (!popup.closed) return;
    window.clearInterval(timer);
    onClosed();
  }, intervalMs);
  return () => window.clearInterval(timer);
}
