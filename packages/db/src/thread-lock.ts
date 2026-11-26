// Transactions that lock the thread row before writing run state share this budget: snapshot
// reads hold the lock for up to 15s, Prisma's 5s default counts that wait, and expiring fails a
// user stop, clear, send, reaction or card answer, or a run whose work already finished. Only
// the timeout is shared; an explicit maxWait would override the client's longer connection
// wait, so a saturated pool that frees a connection late would fail the checkout instead of
// waiting it out.
export const THREAD_LOCK_TRANSACTION_OPTIONS = { timeout: 20_000 };
