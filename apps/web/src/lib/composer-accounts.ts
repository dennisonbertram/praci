import type { ComposerDraft } from "../components/BotToolControls";

type Account = { connectionId: string; label: string; address?: string };

/**
 * The From choice for a failed send that named none, looked up in the thread's own Space. Resolves
 * to null when the session user or Space changed while the lookup ran, so a stale answer is dropped.
 */
export async function recoverComposerDraft<A extends Account>(
  draft: ComposerDraft,
  spaceId: string | null,
  list: (spaceId: string | null) => Promise<{ accounts: A[] }>,
  unchanged: () => boolean,
): Promise<{ accounts: A[] | null; draft: ComposerDraft } | null> {
  const wanted = draft.account.trim().toLowerCase();
  let result: { accounts: A[] | null; draft: ComposerDraft };
  try {
    const { accounts } = await list(spaceId);
    const from =
      accounts.find(
        (a) => a.address?.toLowerCase() === wanted || a.label.toLowerCase() === wanted,
      ) ?? accounts[0];
    result = {
      accounts,
      draft: { ...draft, connectionId: from?.connectionId ?? "", account: from?.label ?? "" },
    };
  } catch {
    result = { accounts: null, draft };
  }
  return unchanged() ? result : null;
}
