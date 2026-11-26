import { useLingui } from "@lingui/react/macro";
import { useRef, useState } from "react";
import { rpc } from "./rpc";

/**
 * Marks a bot's to-do done. `onDone` runs once the server accepted it, so the caller can drop the row
 * and discard any read that started before the completion. One call per item runs at a time.
 */
export function useCompleteTodo(onDone: (itemId: string) => void) {
  const { t } = useLingui();
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState("");
  const pendingRef = useRef(new Set<string>());
  const latest = useRef(onDone);
  latest.current = onDone;
  const complete = (itemId: string) => {
    if (pendingRef.current.has(itemId)) return;
    pendingRef.current.add(itemId);
    setPendingIds(new Set(pendingRef.current));
    setError("");
    rpc.scratchpad
      .update({ itemId, status: "done" })
      .then(() => latest.current(itemId))
      .catch(() => setError(t`Could not update`))
      .finally(() => {
        pendingRef.current.delete(itemId);
        setPendingIds(new Set(pendingRef.current));
      });
  };
  return { complete, pendingIds, error };
}
