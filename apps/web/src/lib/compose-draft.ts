export interface DraftSaver<T> {
  /** Remember the latest value and save it once typing has paused. */
  change(value: T): void;
  /** Save any unsaved change now and wait until nothing is in flight. */
  flush(): Promise<void>;
  /** Drop an unsaved change. A save already in flight still finishes. */
  cancel(): void;
}

/**
 * Debounced, one-at-a-time saving: a change made while a save is running is saved after it, so two
 * saves never overlap and the last value always wins. A failed save is the callback's to report.
 */
export function createDraftSaver<T>(
  save: (value: T) => Promise<void>,
  delayMs: number,
): DraftSaver<T> {
  let pending: { value: T } | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<void> | undefined;

  const run = (): Promise<void> => {
    running ??= (async () => {
      while (pending) {
        const { value } = pending;
        pending = undefined;
        await save(value).catch(() => undefined);
      }
    })().finally(() => {
      running = undefined;
    });
    return running;
  };
  const stopTimer = () => {
    clearTimeout(timer);
    timer = undefined;
  };

  return {
    change(value) {
      pending = { value };
      stopTimer();
      timer = setTimeout(() => {
        timer = undefined;
        void run();
      }, delayMs);
    },
    flush() {
      stopTimer();
      return run();
    },
    cancel() {
      stopTimer();
      pending = undefined;
    },
  };
}
