import type { MailAccountSummary } from "@rakazo/contracts";
import { useCallback, useEffect, useState } from "react";
import { rpc } from "./rpc";

/** The caller's connected mail accounts, read when `enabled`; `status` tells loading and failure from an empty list. */
export function useMailAccounts(enabled: boolean) {
  const [accounts, setAccounts] = useState<MailAccountSummary[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    setStatus("loading");
    rpc.investors.updates.accounts().then(
      (list) => {
        if (!live) return;
        setAccounts(list);
        setStatus("ready");
      },
      () => live && setStatus("error"),
    );
    return () => {
      live = false;
    };
  }, [enabled, attempt]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { accounts, status: enabled ? status : ("ready" as const), retry };
}
