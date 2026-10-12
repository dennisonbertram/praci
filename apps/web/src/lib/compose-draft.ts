export interface DraftSaver<T> {
  /** Remember the latest value and save it once typing has paused. */
  change(value: T): void;
  /** Save any unsaved change now and wait until nothing is in flight. */
  flush(): Promise<void>;
  /** Drop an unsaved change. A save already in flight still finishes. */
  cancel(): void;
}

export function createDraftSaver<T>(
  _save: (value: T) => Promise<void>,
  _delayMs: number,
): DraftSaver<T> {
  throw new Error("not implemented");
}
