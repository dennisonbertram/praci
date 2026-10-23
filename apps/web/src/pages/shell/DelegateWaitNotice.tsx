import { Trans } from "@lingui/react/macro";
import type { MessageBlock } from "@rakazo/contracts";
import { useEffect, useState } from "react";
import { delegateWaitState } from "../../lib/delegate-wait";

/**
 * An agent hands a request to another agent and finishes its own turn, so nothing in the chat
 * says the answer is still missing. After a minute this names the wait; after five it says the
 * request went unanswered.
 */
export function DelegateWaitNotice({
  messages,
}: {
  messages: readonly { blocks: readonly MessageBlock[]; createdAt?: string }[];
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(timer);
  }, []);
  const wait = delegateWaitState(messages, now);
  if (!wait) return null;
  return (
    <div
      role="status"
      data-toast-avoid=""
      className="flex items-center justify-center gap-2 px-6 pb-2 text-[13px] text-muted-foreground"
    >
      {wait.state === "waiting" ? (
        <span>
          <Trans>Waiting on {wait.name}</Trans>
        </span>
      ) : (
        <span className="text-destructive">
          <Trans>{wait.name} has not answered</Trans>
        </span>
      )}
    </div>
  );
}
