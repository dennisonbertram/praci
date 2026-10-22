import type { MailAccountSummary } from "@rakazo/contracts";
import { useEffect, useState } from "react";
import { rpc } from "./rpc";

/** The caller's connected mail accounts, read once when `enabled`; empty until then or on failure. */
export function useMailAccounts(enabled: boolean): MailAccountSummary[] {
  const [accounts, setAccounts] = useState<MailAccountSummary[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    rpc.investors.updates.accounts().then(
      (list) => live && setAccounts(list),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [enabled]);
  return accounts;
}
