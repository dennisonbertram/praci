# Topic: empty-error-sync-states

Refs: `apps/web/src/pages/Inbox.tsx` (I), `apps/web/src/lib/inbox-sync-error.ts`, `apps/web/src/components/AiDataSharing.tsx` (A), `apps/api/src/inbox.ts` (API), `apps/web/src/pages/Shell.tsx:3821-3831`.

## STORY-001: First visit with no Gmail connected, Connect mail round trip
**Type**: medium
**Topic**: empty-error-sync-states
**Persona**: Priya Raman, new hire at a 12-person design studio, just joined her team's Rakazo space and clicked "Inbox" in the sidebar for the first time
**Goal**: Get her Gmail showing in the Inbox
**Preconditions**: Signed in, no mail account connected, Gmail plugin not yet set up.
**Ideal path**: 3 — Inbox button, "Connect mail", finish Gmail OAuth in the overlay, then close it.
**Alternate paths**: Open Integrations/plugins from elsewhere in the app and connect Gmail, then go to Inbox (not pre-filtered to "gmail").
### Steps
1. Click "Inbox" in the sidebar → `/app/inbox`; page shows 5 grey skeleton rows (`aria-busy`, I:588-593) until the first `inbox.list` returns.
2. Think "Is this broken? Where's my mail?" Skeletons clear → body is only a centered "Connect mail" button, no explanation text (I:582-587; API returns `accounts: []`, API:~318).
3. Click "Connect mail" → Integrations overlay opens with query pre-filled to "gmail" (Shell:3826-3829); Inbox goes `paused` so it makes no calls while the overlay is open (I:150).
4. Complete the Gmail connection in the overlay, then close it → `paused` flips false, list reloads (I:170) and `inbox.refresh` runs (I:219-237).
5. Skeletons show again while the first sync runs (`!filtered && rows.length===0 && !synced`, I:274-277) → rows appear under Needs reply / Today / Earlier, sidebar unread badge refreshes via `onRefreshed`.
### Variations
- User closes the overlay without finishing OAuth: page reloads back to the lone "Connect mail" button with no message that nothing changed.
- A big mailbox: step 5 skeleton lasts longer; there is no "Syncing your mail..." text, so she may think it is stuck.
### Edge Cases
- Observed gap: the empty state has no heading or sentence about what Connect mail does or that only Gmail is supported.
- Observed gap: the page doesn't say which step is current (connect vs sync); both look identical to the skeleton.
- Keyboard `c` (compose) is inert with no account (see discovery), so pressing it does nothing visible.

## STORY-002: Mailbox truly empty vs still syncing ("No mail")
**Type**: short
**Topic**: empty-error-sync-states
**Persona**: Marcus Oyelaran, freelance photographer who just connected a brand-new Gmail address he uses for bookings
**Goal**: Tell whether the Inbox is empty or broken
**Preconditions**: One Gmail account connected, zero messages in the last 14 days, sync succeeds.
**Ideal path**: 1 — open Inbox and read the empty state.
**Alternate paths**: none found.
### Steps
1. Open Inbox → skeletons (I:588) until list plus first `refresh` complete.
2. After sync completes → plain centered "No mail" (I:615-619); no illustration, no "all caught up" copy, no last-synced time (`syncedAt` is returned but not shown).
3. Marcus thinks "Is that real, or did the sync fail?" → no banner is shown, which he must infer means success.
### Variations
- Mail older than 14 days exists in Gmail: the cache window is 14 days (discovery), so "No mail" can be shown while Gmail has older messages; only search reaches them.
### Edge Cases
- Observed gap: "No mail" is the same string whether the inbox is empty by choice or the window excluded older mail.
- If sync fails and there are zero rows, `failed ? null` (I:595) hides "No mail" entirely, so only the red banner shows over a blank body (see STORY-003).

## STORY-003: "Couldn't reach Gmail." with a blank list
**Type**: medium
**Topic**: empty-error-sync-states
**Persona**: Dana Whitfield, ops manager on hotel Wi-Fi that drops intermittently
**Goal**: Get her mail to load
**Preconditions**: Account connected, first-ever sync fails with a network or Gmail error, so `lastErrorAt` is set and `needsReconnect` is false; no cached rows.
**Ideal path**: 2 — read the banner, click "Try again".
**Alternate paths**: Reload the page (re-runs sync on mount, I:219); leaving and re-entering Inbox does the same.
### Steps
1. Open Inbox → skeletons, then `refresh` fails or reports the account failed; `setSynced(true)` still runs (I:228-232), so skeletons end.
2. Red `role="alert"` row: "Couldn't reach Gmail." with an outline "Try again" button (I:573-579, `syncErrorText`); below it nothing, since `failed` suppresses "No mail" (I:595). Dana thinks "Is my mail gone?"
3. Click "Try again" → `retry` clears error, bumps `attempt` (re-sync) and `reload` (I:262-266); skeletons or old state while retrying.
4. Network returns → sync succeeds, banner disappears (failedAccounts empty), rows render.
### Variations
- Failure only on one of several accounts: banner still reads the same generic text and doesn't name the account; other accounts' cached rows render below it (see discovery).
- Retry fails again: banner reappears with the same text and no count or timestamp, so she can't tell whether the click did anything.
### Edge Cases
- Observed gap: no indication of which account failed or when it last synced.
- Observed gap: while retrying there's no pressed/busy state on "Try again".
- The banner uses `text-destructive` only; no icon.

## STORY-004: "Gmail needs to be reconnected." and the missing Reconnect action
**Type**: long
**Topic**: empty-error-sync-states
**Persona**: Tomasz Kowalski, founder whose Google password change revoked Rakazo's token last week
**Goal**: Restore mail access
**Preconditions**: Gmail account connected earlier; Google refuses the refresh token, so `MailSyncState.needsReconnect` is true and `lastErrorAt` set; cached rows (14-day window) still present.
**Ideal path**: 4 — read banner, open Integrations (no direct link), reconnect Gmail, return and reload.
**Alternate paths**: "Try again" first (re-syncs, fails again); Inbox "Connect mail" button exists only when zero accounts, so it isn't offered here.
### Steps
1. Open Inbox → cached rows appear under groups, plus red banner "Gmail needs to be reconnected." and a "Try again" button (`reconnectAccounts` nonempty, `syncErrorText`; API:395-399).
2. Tomasz thinks "Reconnect where? " and clicks "Try again" → sync re-runs; same banner returns because the token is still revoked.
3. He browses the cached rows (hover Archive etc.); actions may now fail since Gmail rejects them (see STORY-007).
4. He has to find Integrations on his own (sidebar or settings, no link from the banner) and reconnect Gmail; the "Connect mail" shortcut isn't available because accounts.length > 0 (I:582).
5. Back in Inbox, the page reloads on overlay close only if he opened the overlay via the Inbox's own paused flow; otherwise a navigation re-runs sync on mount → banner clears and fresh mail appears.
### Variations
- Two accounts, only one needs reconnect: banner is identical to a single-account failure and doesn't say which one.
- Reconnect error text is "reconnected" while the plugin UI may say connect/reauthorize: wording mismatch not verified here.
### Edge Cases
- Observed gap: the banner is text plus Try again only; no Reconnect button despite the app already having a gmail-filtered Integrations overlay (Shell:3826).
- If `failedAccounts` is non-empty but `reconnectAccounts` is empty the copy flips to "Couldn't reach Gmail." (`inbox-sync-error.ts:9-11`), so a mixed failure shows the reconnect message if any account needs it.
- Search/filter views re-use the same banner (`failed` is computed for any `shown`).

## STORY-005: "Let Rakazo sort your mail" consent card
**Type**: medium
**Topic**: empty-error-sync-states
**Persona**: Elena Vasquez, privacy-conscious lawyer who just got a model configured for her workspace
**Goal**: Decide whether to let the AI see her mail metadata, and understand what happens next
**Preconditions**: Gmail connected, usable model, no AI consent for that recipient (`triageBlocked.reason="needs_consent"`).
**Ideal path**: 1 — click Allow on the card.
**Alternate paths**: Revoke or grant per-model via the "AI data sharing" switches in settings (`AiDataSharingSection`, A:57); ignore the card and use the Inbox untriaged.
### Steps
1. Open Inbox → above the list a region card: "Let Rakazo sort your mail" / "Senders, recipients, subjects and short previews are sent to {model name}." with an "Allow" button (A:36-52). It replaces the To-do card position (I:624-632) and shows only on the unfiltered, unsearched view.
2. Elena thinks "Sent to whom, and does the body go?" The copy lists senders, recipients, subjects and previews but has no link to the settings or privacy page → she decides on that text alone.
3. Click "Allow" → button disables (`pending`), `allowRecipient(key)` runs, then `onAllowed` bumps `attempt` (re-sync, which queues triage) and `reload` (I:626-631).
4. List reloads; after sync the card is gone and the To-do card, labels and "Important"/category controls appear once triage finishes (STORY-006).
### Variations
- Allow fails (network): inline `role="alert"` red error in the card, button re-enabled (A:42-46).
- Elena applies a search or filter first: the card is hidden (`filtered || narrowed`), so she may think it vanished.
### Edge Cases
- Observed gap: no "Not now" or Dismiss; the card persists on every visit until allowed.
- Observed gap: no mention in the card that she can revoke later, nor where (settings "AI data sharing").
- No model configured at all: `no_model` reason shows no card and no explanation of why sorting is absent.

## STORY-006: After Allow, the list reshuffles while triage runs
**Type**: long
**Topic**: empty-error-sync-states
**Persona**: Hiro Tanaka, product manager with ~60 emails in the last two weeks who just clicked Allow
**Goal**: Work through his mail while triage is applied, without losing his place
**Preconditions**: Consent just granted, triage enabled, messages untriaged (`triagePending: true`, API:401).
**Ideal path**: 2 — wait for polling to settle, then act on the grouped list.
**Alternate paths**: Reload the page after triage completes; start archiving immediately from the plain list.
### Steps
1. Allow clicked → list reloads and shows Today/Earlier only, no labels, no Needs reply group, and the unfiltered To-do card absent or empty.
2. Triage runs server-side after sync; the page re-fetches every 5 s up to 6 times while `triagePending` (`TRIAGE_POLL_MS`, `TRIAGE_MAX_POLLS`, I:208-216). Hiro thinks "Why did that row just move?"
3. Rows silently jump into Needs reply; badges ("Needs attention", "Newsletter") appear on rows. No "Sorting your mail..." message, no spinner.
4. He had selected row 4 with `j`; the list reorders under his selection (selection is by id, so the highlight follows the row to a new position and may scroll away).
5. After the final poll the To-do card loads (refetch when pending clears, I:198-206). If triage takes longer than ~30 s, polling stops and rows stay partly unsorted until the next visit/sync.
### Variations
- He opens a message with `Enter` mid-reshuffle: the dialog's prev/next order (`ids`) changes as groups change.
- Triage never completes (model error): no error is surfaced here; the list just stays unlabeled.
### Edge Cases
- Observed gap: no visible indication that triage is in progress or has stopped polling.
- Observed gap: `polls.current` resets on each sync, so a manual "Try again" can restart the 30 s polling.
- A new group "Needs reply" appearing above Today pushes the rest of the list down mid-scan.

## STORY-007: Archive or mark read fails after the row has already moved
**Type**: medium
**Topic**: empty-error-sync-states
**Persona**: Sam Okafor, support lead clearing 40 messages quickly with hover buttons and `e`
**Goal**: Know whether each archive or read toggle actually stuck
**Preconditions**: Gmail account connected; the token has been revoked or the network drops mid-session.
**Ideal path**: 1 — each action is one click or keypress (optimistic).
**Alternate paths**: Dialog buttons, `e` in dialog, or the touch "More" menu for the same actions.
### Steps
1. Press `e` on a row → row disappears at once and selection moves to the neighbour (I:301-309); the API call is in flight.
2. The call fails → red banner with the error text from `errorText(cause)` appears and the list reloads (I:288-294), so the row reappears. Sam thinks "Didn't I archive that?"
3. Banner shows a generic message plus a "Try again" button (I:573-579), which re-runs the sync, not the failed archive; he must archive the row again by hand.
4. He toggles "Mark read" on another row: the dot disappears at once; failure reverts through the same reload path.
5. "Mark important"/"Mark noise" differ: failure restores the previous mark specifically and clears the toast (I:311-324); the 6 s "Marked important" + Undo toast is cleared.
### Variations
- Rapid-fire archives: one failure triggers a reload that can bring back several optimistic rows if the others also failed.
- Dialog open on the archived message: dialog moves to the neighbour first; on failure the list reloads but the dialog stays on the neighbour.
### Edge Cases
- Observed gap: the banner doesn't say which message or action failed, and the row reappears silently where it was.
- Observed gap: archive success has no confirmation or undo, so Sam can't tell success from pending.
- Error banner clears on the next action (`setError("")`), possibly before he read it.

## STORY-008: Search and filter come up empty, then recovery
**Type**: short
**Topic**: empty-error-sync-states
**Persona**: Leila Haddad, bookkeeper looking for an invoice she thinks arrived last month
**Goal**: Get out of a zero-result state and find the invoice
**Preconditions**: Account connected, triage on or off, mail present.
**Ideal path**: 2 — read the empty message, click its Clear button.
**Alternate paths**: Press Esc in the search box, or the X "Clear" button next to it; pick another filter (replaces the current one).
### Steps
1. Type `invoce march` in "Search mail", press Enter → `q` goes into the URL; skeleton rows while Gmail is queried, then `No results for "invoce march"` with an outline "Clear search" button (I:597-604).
2. Leila thinks "Was that a typo or is mail missing?" There are no suggestions or hint about Gmail operators.
3. Click "Clear search" → `q` cleared, list returns to the default Today/Earlier view.
4. Choose Filter → Bills (triage on) → if no cached bills, "No mail matches this filter" + "Clear filter" (I:606-614); clicking it calls `clearFilters`.
### Variations
- Network failure while searching: banner appears and the empty message is suppressed (`failed ? null`), so she sees no "No results" text at all.
- Search with a filter selected: picking either clears the other, so the previous filter chip vanishes.
### Edge Cases
- Observed gap: "No mail matches this filter" is also shown for the Important toggle (`view === "important"`), though no filter is shown as chosen in the menu.
- Observed gap: category filters only cover the cached 14 days, but the empty message doesn't say so.
