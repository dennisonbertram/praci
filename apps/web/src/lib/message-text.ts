import type { ThreadMessage } from "@rakazo/contracts";
import { selectableMessageText } from "@rakazo/core";

/** Plain message text for clipboard copy — text/ask/progress only, no chrome. */
export function copyableMessageText(message: ThreadMessage): string {
  return selectableMessageText(message).trim();
}
