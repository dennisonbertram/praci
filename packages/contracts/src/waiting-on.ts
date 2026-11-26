/** Words a `waitingOn` value starts with when the open item waits on the owner. */
export const WAITING_ON_SELF = ["you", "me", "user"];

/**
 * `waitingOn` is free text the bot writes. It waits on the owner when its first word is one of
 * WAITING_ON_SELF, so "You approve budget" counts and "Youssef" or "Acme legal" do not.
 */
export function isWaitingOnSelf(text: string | null | undefined): boolean {
  const normalized = text?.trim().toLowerCase() ?? "";
  return WAITING_ON_SELF.some((word) => normalized === word || normalized.startsWith(`${word} `));
}
