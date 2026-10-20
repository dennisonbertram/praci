# New feature stories: Gmail rate limit notice and "Try again"

Source: PRs #115 and #134. Code read: `apps/api/src/inbox.ts` (`searchMail`, `inboxList`, `waitOutBackoff`, `inboxRefresh`, `mailUnavailable`), `apps/api/src/inbox-compose.ts` (`inboxComposePrefill`), `packages/adapters/src/mail-sync.ts` (`RATE_LIMIT_BACKOFF` = 30 seconds), `apps/web/src/pages/Inbox.tsx`, `apps/web/src/lib/inbox-sync-error.ts`, `apps/web/src/components/ComposeEmail.tsx`. No story was walked. "UNVERIFIED" marks behavior read from code only.

## How a walker reaches this state on the mock demo stack

- **Sync rate limit: reachable.** `pnpm demo:up` seeds a space named "Mail rate-limited" (`DEMO_RATE_LIMIT_SPACE`, `packages/testkit/src/cli/demo/data.ts`) with a Gmail account labeled "Busy mail". In `packages/testkit/src/cli/demo.ts` the `accountState` hook makes `createE2eComposio` (`packages/testkit/src/cli/e2e-mail.ts`) answer every Gmail call for that account with HTTP 429 `RESOURCE_EXHAUSTED`. The seed calls `inbox/refresh` once, so the account already has a rate-limit error recorded. The walker switches to that space and opens Inbox.
- **The 429 never stops in that space.** The account answers 429 for every call, for as long as the stack runs. The cache is empty (the seed only runs one refresh that fails), so the Inbox shows the full-page state, not a line above rows. The notice therefore cannot be seen to clear by waiting, and there is no message in that space to open or reply to.
- **`GmailApiEmulator.failNext(429, { retryAfter, urlIncludes, times, skip })`** (`packages/adapters/src/gmail-api-emulator.ts`) can force a one-time or limited 429, but it is only called from Vitest tests (for example `apps/api/src/inbox.postgres.test.ts`, `inbox-compose.postgres.test.ts`) and is not wired to the demo CLI, an env var, or an HTTP route. A walker on the demo stack cannot call it.
- **Conclusion.** GR-1 and GR-2 are walkable in the rate-limited space. GR-3 (notice clears) and GR-4 (Reply fallback with a failing Gmail) cannot be reached on the unmodified demo stack: GR-3 needs a 429 that stops, GR-4 needs a cached message plus a failing single-message fetch. To walk them, add a demo hook for `failNext` (or a second seeded space with a populated cache) first. Until then, record them as "not reachable" and read the Vitest cases listed in each story.

---

## STORY-GR-1: Gmail rate-limits the sync and Maya sees a notice

**Type**: short
**Topic**: Gmail rate-limit notice
**Persona**: Maya, first-time founder at Northwind Robotics, opening her Inbox while Gmail is throttling her account
**Goal**: Understand why her mail is not showing and what to do.
**Preconditions**: Demo stack running; signed in; the space "Mail rate-limited" selected (account "Busy mail", always 429, empty cache).
**Ideal path**: 1 — read the notice and press **Try again** once (GR-2); nothing else is needed.
**Alternate paths**: A populated inbox with a throttled account shows the same text as a red line above the rows with a small **Try again** button (not walkable on the demo stack; see the top of this file). Searching while throttled (`searchMail`) also reports the account as rate limited.

### Steps
1. Switches to the space "Mail rate-limited" in the space switcher, then clicks **Inbox** → `/app/inbox`. While the first sync runs, the page shows its loading state (UNVERIFIED: how long; the API call `inbox.refresh` runs first, then the list reloads).
2. The sync fails with a 429; `inboxList` returns the account under `failedAccounts` and `rateLimitedAccounts` → because there are no rows, the page shows a full-page empty state with a mail-warning icon, the title "**Your mail didn't load**", the line "**Gmail is limiting requests right now. Try again in a minute.**" (`syncErrorText`), and a **Try again** button. She does not see **Reconnect Gmail**, because the error is not a sign-in problem. **Hesitation**: "in a minute" is not exact (the server pauses the account for 30 seconds), and the title says "didn't load" without saying the cause; the cause is only in the line below.
3. Looks for what is broken in her account → nothing else on the page changes; the filter, search and pen icon (Compose) stay as they were for an account without mail (UNVERIFIED: whether Compose is enabled with a throttled account).

### Variations
- Reconnect error and rate limit at once, on two accounts: only "Gmail needs to be reconnected." shows (`inbox-sync-error.ts`).
- Any other failure: "Couldn't reach Gmail." and the same **Try again** button.
- With a cache but no live data (not walkable on the demo stack): "Your mail didn't load" is replaced by the red alert line above the old rows, with the same text and a small outline **Try again**.

### Edge Cases
- She leaves and comes back: the notice shows again on open, because the list API still reports the account while its 30-second pause is active or the last sync ended in a rate-limit error.
- The notice has no countdown, so she cannot tell when pressing **Try again** will do anything; GR-2 covers what happens if she presses it early.

---

## STORY-GR-2: Maya presses "Try again" during the pause

**Type**: short
**Topic**: Try again during a rate-limit pause
**Persona**: Maya, impatient, presses the button right after she sees the notice
**Goal**: Get her mail to load now.
**Preconditions**: As GR-1, immediately after the notice appeared (less than 30 seconds since the last failed sync).
**Ideal path**: 1 — one click, then wait.
**Alternate paths**: Switch to another tab and back to the Inbox tab: a visibility change re-runs the sync without a click (`Inbox.tsx`, around line 203). The page also looks for new mail about once a minute (`NEW_MAIL_POLL_MS`).

### Steps
1. Clicks **Try again** within a few seconds of the notice → the button text becomes "**Trying again…**" and is disabled (`retrying` is true until the sync call answers). The notice stays on screen.
2. Waits → the API (`inboxRefresh` → `waitOutBackoff`) reads the remaining pause from the database clock. If 30 seconds or less remain, it waits until the pause ends (plus 50 ms), then runs the sync. Maya sees only "Trying again…" for up to about 30 seconds. **Hesitation**: nothing says it is waiting for Gmail's pause; she may think the page is frozen.
3. The sync runs. On the demo stack Gmail still answers 429 → "Trying again…" returns to **Try again**, and the same "Gmail is limiting requests right now. Try again in a minute." text shows. A new 30-second pause starts. She cannot tell that the retry ran, except that the button was busy.
4. On a Gmail that has recovered (not walkable on the demo stack) → the notice goes, rows load, and the sidebar unread count refreshes (`onRefreshed`).

### Variations
- She clicks **Try again** several times in a row: the button is disabled while the sync runs, so extra clicks do nothing (UNVERIFIED).
- She clicks after the pause has already ended: no wait; the sync runs at once.
- She leaves the page while "Trying again…" shows: the wait stops (the request is aborted) and no sync runs.

### Edge Cases
- If more than 30 seconds remain (only possible if the pause was set longer than 30 seconds), `waitOutBackoff` does not wait, the sync is skipped as inside the pause, and the notice returns at once with no retry.
- A retry with two accounts: each account waits out its own pause, at most four at a time. A slow second account keeps "Trying again…" on screen after the first has recovered (UNVERIFIED).

---

## STORY-GR-3: The notice clears once the pause is over

**Type**: short
**Topic**: Rate-limit notice clearing
**Persona**: Maya, back from making coffee
**Goal**: See her mail again without doing anything special.
**Preconditions**: An account whose Gmail was throttled and has since recovered; at least 30 seconds since the last 429. **Not reachable on the unmodified demo stack** (its throttled account never recovers). Needs a `failNext(429, ...)` hook, or read `apps/api/src/inbox.postgres.test.ts`.
**Ideal path**: 1 — open or return to the Inbox tab and the notice is gone.
**Alternate paths**: Press **Try again** (GR-2).

### Steps
1. Returns to the Inbox tab after more than 30 seconds → the tab becoming visible re-runs the sync (`setAttempt`). The sync is no longer inside the pause and goes to Gmail.
2. Gmail answers normally → the sync clears the error and the pause (`lastErrorAt = NULL`, `backoffUntil = NULL`, `mail-sync.ts`); the list reloads with her mail and no notice.
3. If she only reloaded the list without a sync: `inboxList` keeps a rate-limited account in `failedAccounts` only while its `backoffUntil` is in the future, so once the 30 seconds have passed the notice also stops showing on the next list read, even before a successful sync (`inbox.ts`, the `current` filter). A reconnect error is different: it stays until fixed.

### Variations
- Within the 30 seconds: the notice still shows after returning to the tab; the sync is skipped.
- Gmail throttles again on the first sync after the pause: the notice returns and a new 30-second pause starts.

### Edge Cases
- The notice disappears with no confirmation. She may not notice that mail refreshed.
- After a long outage with a stale cache, the rows she sees may be old until the sync completes (UNVERIFIED).

---

## STORY-GR-4: Maya taps Reply while Gmail is failing

**Type**: short
**Topic**: Reply fallback composer
**Persona**: Maya, replying to an email from Luis Romero while Gmail is throttling or down
**Goal**: Start a reply even though Gmail will not return the full message.
**Preconditions**: A message M3 (Luis Romero, received, not sent by Maya) is in the cache; the inbox row is visible; Gmail now answers 429 (or fails) for the single-message fetch. **Not reachable on the unmodified demo stack** (the throttled space has no cached mail; the other spaces never fail). Covered by Vitest cases in `apps/api/src/inbox-compose.postgres.test.ts`.
**Ideal path**: 3 — open the message, click Reply, then fill To herself.
**Alternate paths**: Forward (the same fallback; the body is empty and no attachments are carried); Reply all; reply from a row's quick action (UNVERIFIED if one exists).

### Steps
1. Opens M3 from the list → the preview comes from the cache. If the full message was not cached, the page shows the error "Gmail is busy. Try again in a moment." (`mailUnavailable`, status TOO_MANY_REQUESTS) instead of the body (UNVERIFIED which of these shows).
2. Clicks **Reply** → the composer opens anyway. The server could not fetch the original (`inboxComposePrefill` caught a rate-limit or outage error), so it built the reply from the cached copy and returned `quoteUnavailable: true`.
3. The composer shows the subject from the cache ("Re: Can we move Thursday's demo to Friday?"), an empty body with nothing quoted, and the red note "**The original message didn't load.**" (`ComposeEmail.tsx`). The note stays through autosave unless a different error takes its place.
4. Looks at **To** → it is empty (and Cc is empty), because the cache has no Reply-To header and the app will not guess the address. **Hesitation**: she expects Luis's address to be filled in and may not see why it is blank; the note does not mention To.
5. Types Luis's address, writes the reply and sends → the send path behaves as in a normal reply. If Gmail is still throttled, the send fails with "Gmail is limiting requests. Try again in a minute." (`problemText`) and the composer stays open with her text.

### Variations
- Reply to her own sent message (the sent-mail variant): To is filled from the cached To list, because her own message answers to its recipients; the note still shows.
- Auth error instead of a rate limit: no fallback; the composer gives a reconnect error (the API throws PRECONDITION_FAILED).
- Message deleted in Gmail (not found): no fallback; the error is a not-found message.
- Reply all or Forward: same note; Forward also has no attachments.

### Edge Cases
- She closes and reopens Reply after Gmail recovers: the prefill runs again and quotes the original normally (UNVERIFIED that the earlier draft is kept).
- Replies sent in this state carry no quote, so the recipient sees no earlier text.
- Gmail's own threading still applies, because `replyToMessageId` is sent (UNVERIFIED in the Gmail emulator).
