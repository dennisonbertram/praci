/** A remote change replaces the page only when the user has nothing unsaved. */
export function resolveRemotePage({ dirty }: { dirty: boolean }): "reload" | "offer" {
  return dirty ? "offer" : "reload";
}

/** A remote revision matters only after the first load, and only if it is newer than what the editor shows. */
export function isNewerRemote({
  loadedRevision,
  remoteRevision,
}: {
  loadedRevision: number;
  remoteRevision: number;
}): boolean {
  return loadedRevision > 0 && remoteRevision > loadedRevision;
}
