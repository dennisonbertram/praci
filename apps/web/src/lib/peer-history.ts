import type { ThreadMessage } from "@rakazo/contracts";

const PEER_HISTORY_PAGE_TIMEOUT_MS = 15_000;
const PEER_HISTORY_TOTAL_TIMEOUT_MS = 60_000;

type PeerHistoryPage = {
  messages: ThreadMessage[];
  olderCursor: number | null;
};

/** Load every peer-history page without allowing one request or the full scan to hang forever. */
export async function loadPeerHistory({
  signal,
  loadPage,
  before: initialBefore,
  onPage,
  pageTimeoutMs = PEER_HISTORY_PAGE_TIMEOUT_MS,
  totalTimeoutMs = PEER_HISTORY_TOTAL_TIMEOUT_MS,
}: {
  signal: AbortSignal;
  loadPage: (before: number | undefined, signal: AbortSignal) => Promise<PeerHistoryPage>;
  before?: number;
  onPage?: (page: PeerHistoryPage, before: number | undefined) => void;
  pageTimeoutMs?: number;
  totalTimeoutMs?: number;
}): Promise<ThreadMessage[]> {
  const deadline = AbortSignal.timeout(totalTimeoutMs);
  let before: number | undefined = initialBefore;
  let collected: ThreadMessage[] = [];
  do {
    const requestedBefore = before;
    const page = await loadPage(
      before,
      AbortSignal.any([signal, deadline, AbortSignal.timeout(pageTimeoutMs)]),
    );
    onPage?.(page, requestedBefore);
    const existing = new Set(collected.map(({ id }) => id));
    collected = [...page.messages.filter(({ id }) => !existing.has(id)), ...collected];
    before = page.olderCursor ?? undefined;
  } while (before !== undefined);
  return collected;
}
