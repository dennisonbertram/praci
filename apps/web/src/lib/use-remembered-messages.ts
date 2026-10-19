import { useCallback, useEffect, useRef, useState } from "react";
import { rpc } from "./rpc";

export type RememberControls = {
  ids: ReadonlySet<string>;
  onRemember: (messageId: string) => void;
};

/** Which agent messages were saved to memory, and the action that saves one. */
export function useRememberedMessages(
  target: { botId?: string; groupId?: string },
  onError: (error: unknown) => void,
): RememberControls {
  const [ids, setIds] = useState<ReadonlySet<string>>(new Set());
  const targetRef = useRef(target);
  targetRef.current = target;
  const { botId, groupId } = target;

  useEffect(() => {
    setIds(new Set());
    if (!botId && !groupId) return;
    let stale = false;
    rpc.threads
      .remembered(groupId ? { groupId } : { botId: botId! })
      .then(({ messageIds }) => {
        if (!stale) setIds(new Set(messageIds));
      })
      .catch(() => undefined);
    return () => {
      stale = true;
    };
  }, [botId, groupId]);

  const onRemember = useCallback(
    (messageId: string) => {
      const { botId, groupId } = targetRef.current;
      if (!botId && !groupId) return;
      setIds((current) => new Set(current).add(messageId));
      rpc.threads
        .remember({ ...(groupId ? { groupId } : { botId: botId! }), messageId })
        .catch((error) => {
          setIds((current) => {
            const next = new Set(current);
            next.delete(messageId);
            return next;
          });
          onError(error);
        });
    },
    [onError],
  );

  return { ids, onRemember };
}
