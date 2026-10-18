/** A page outside Shell created a bot; Shell reloads its bot list so the bot opens and shows in the sidebar. */
export const BOTS_CHANGED_EVENT = "rakazo:bots-changed";

export type BotsChangedDetail = { done: () => void };

/** Asks Shell to reload its bots and resolves when it has, or after a timeout if nothing is listening. */
export function botsChanged(timeoutMs = 3000): Promise<void> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, timeoutMs);
    const done = () => {
      window.clearTimeout(timer);
      resolve();
    };
    window.dispatchEvent(
      new CustomEvent<BotsChangedDetail>(BOTS_CHANGED_EVENT, { detail: { done } }),
    );
  });
}
