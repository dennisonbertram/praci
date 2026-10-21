# STORY-IF-1 ux-flow critique: a meeting-only founder finds her follow-ups in the Inbox

Variation also checked: STORY-MB-4 (mobile account tabs hide meeting to-dos).

Evidence: the story in `docs/ux-paths/meetings-voice/catalog.md`, `docs/plans/granola.md` (section "Digest and Inbox follow-ups", slice S5), the mockup screen `docs/granola/mockup.html#screen-inbox` (opened and screenshotted), and today's code in `apps/web/src/pages/Inbox.tsx`, `apps/mobile/app/inbox.tsx` and `apps/api/src/inbox.ts`. Nothing here is built, so "actual" means what the plan plus today's code would produce.

Screenshots (all opened and read): `STORY-IF-1-screens/inbox-empty.png`, `inbox-todos.png`, `inbox-gone.png`, `mobile.png`.

Verdict: acceptable. Steps: actual 3, ideal 2.

## 1. Friction scorecard

| Measure | Finding | Evidence |
|---|---|---|
| Steps, as the mockup draws it | 2: open Inbox, tick. | Mockup screen 4 shows only the "To do" card under the "Inbox" heading. Measured on the mockup. |
| Steps, as the plan plus today's code produces | 3: open Inbox, scroll past or around the "No mail connected" page, tick. Possibly a 4th if the card is below the fold. | Today `Inbox.tsx:1266` renders the "No mail connected" empty state, with a "Connect mail" button, whenever `accounts.length === 0`. The plan (granola.md S5, last bullet of "Retrieval and completion") says the list shows "even with no mail account" but does not say where. Measured in code; the placement is not decided in the plan. |
| Ideal | 2: open Inbox, tick. | Catalog IF-1 gives 3 and counts "see the card". Counting actions only, it is 2. |
| Decisions a default could carry | None in the happy path. The only decision is "should I connect mail?", and the current empty state pushes it on her. | `Inbox.tsx:1269-1273`. |
| Re-entry | None. The to-dos come from the digest; nothing is typed. | Plan S5. |
| Confirmations | None on tick. Correct for an undoable action. | Story step 5. |
| Dead ends | Three. (a) The "From: Pricing review, 12 Oct" line is plain text; nothing opens (mockup screen 5 states this on purpose). (b) After the 1.5 s fade, a mistaken tick cannot be undone because there is no done view (story edge case, `TodoCard.tsx`). (c) The sidebar Inbox badge counts unread mail only, so a meeting-only user gets no signal that to-dos exist (story edge case, `inboxUnreadCount`). | (a) mockup `inbox-todos.png`; (b) and (c) from the catalog; not re-verified in code for this critique, so suspected. |
| Hesitation | Real. A meeting-only user lands on a page headed by "No mail connected", which says her Inbox is broken or unfinished. | Catalog step 3; the empty state's wording is "Connect Gmail to read, sort and answer your mail here". |
| Re-entry after reload | Works by design (ticked items stay gone). | Plan S5. Not observable in the mockup. |

The flow itself is short. The only real cost is one structural question: what the page looks like when the user has no mail.

## 2. Take-away pass per screen

### Inbox, empty (`inbox-empty.png`)
- The card heading "To do" plus the line "No follow-ups from meetings yet". Both are needed once; the line is a one-time empty state and is progressive (it only shows when nothing is there). Keep, but see below on whether the card should render at all when empty.
- Nothing else is on the page. Good.
- One primary action: none, and none is needed.

### Inbox, with to-dos (`inbox-todos.png`)
- Heading "Inbox", card "To do", rows with checkbox, text, "From: {title}, {date}", due label. The "From:" line is the only place the meeting appears, so it earns its space. The prefix "From:" is removable: "Pricing review, 12 Oct" reads the same without it. Saves a word on every row. Suspected, not user-tested.
- The note under the card, "Tick a to-do to complete it. It strikes through, then fades out of the list.", is mockup annotation, not product copy. It must not ship. AGENTS.md says every visible word is UI. The plan does not list it as shipped copy, so this is only a risk to watch in the S5 PR.
- Due label "Fri" and "Today" in warning colour: kept, it carries priority.

### Inbox, source disconnected (`inbox-gone.png`)
- The note "Granola was disconnected from Integrations. The to-dos stay and can still be completed." is again annotation. The mockup's own comment says "Simplest option: no marker". The screen is identical to the connected state, which is right. Keep it that way.

### Mobile Inbox (`mobile.png`)
- "To do" section header over three rows with circle checkboxes. Matches web. Nothing removable.

### Information stated twice
- None on this screen. (The sync status lives on the Granola card, not here.)

## 3. The simpler version

Ideal steps:
1. Maya opens Inbox. The page shows her "To do" card with the meeting items first, with no mail prompt above it.
2. She ticks an item.

Concrete plan changes:

1. **granola.md, "Digest and Inbox follow-ups", last bullet of "Retrieval and completion" (slice S5, `apps/web/src/pages/Inbox.tsx`, `apps/mobile/app/inbox.tsx`).** Add one sentence fixing the layout. Proposed: when the user has no mail account but has meeting to-dos or a connected meeting source, the Inbox page shows only the "To do" card, and `PageEmptyState` "No mail connected" is not shown. Today's branch order at `Inbox.tsx:1266` puts "No mail connected" first, so S5 has to change that branch, not just add a card. Without the sentence the implementer can legitimately put the card below the empty state (a scroll, the 3-step version).
2. **Same bullet.** Say what happens for a user with no mail and no meeting source: keep "No mail connected" as today. And for a user with a meeting source but no to-dos: show the card with "No follow-ups from meetings yet" (this is already in the mockup), with no "Connect mail" button. A single small "Connect mail" link under the card is optional and can wait until someone asks for it (progressive disclosure).
3. **S5, mobile.** Same rule. Today `apps/mobile/app/inbox.tsx:102` clears the to-dos when `list.accounts.length === 0` or `!list.enabled`, and `:458` shows only the "Connect mail" button when `accounts.length === 0`. The plan lists the file as touched but gives no zero-accounts layout. Add it: mobile shows the "To do" section instead of the button.
4. **S5 acceptance list (the PR's component tests).** Add a test that the "No mail connected" page is not rendered when meeting to-dos exist. The plan currently lists "list with only meeting to-dos" and "the empty state", which is close, but does not assert the absence of the mail prompt.
5. **Optional, small.** Drop the "From:" prefix in the to-do detail for meeting rows ("Pricing review, 12 Oct"). Mail rows keep their present detail line. Not required.
6. **Not recommended now.** A done view and an undo, and a sidebar badge for meeting to-dos. Both are real gaps (dead ends b and c above), but each adds surface. The existing undo-during-fade behaviour covers the common slip. Raise them if the first users mis-tick. This is a judgement, not measured.

## STORY-MB-4 variation: mobile account tabs

Today's behaviour (measured in code): the mobile screen calls `listMailTodos(connectionId)` for the selected tab (`apps/mobile/app/inbox.tsx:107`), and the server filters `connectionId: input.connectionId ?? { in: ... }` (`apps/api/src/inbox.ts:780`). A meeting to-do has `connectionId` null (plan, `InboxTodo.connectionId` made nullable). So the server returns the meeting items only for the "All" tab, and they disappear when Jonas taps "Work". Web has the same shape: `todosByTab` keyed by tab (`Inbox.tsx:532` and the `TodoCard` update at `:1348`). I did not run the web case; it is suspected to behave the same.

Ideal: opening Inbox shows all open to-dos, and choosing a tab changes the mail list only. The "To do" card is the user's own list of what they owe, not a property of an account.

Plan changes:

1. **granola.md S5, `inboxTodosList` bullet.** Change it to: for a `connectionId`, return that account's mail to-dos plus all meeting to-dos. (One line in the `where` clause: an `OR` with `meetingId: { not: null }`, still scoped by space and user.) This keeps the card the same on every tab and needs no change to the screens. It also removes the catalog's "he assumes the meeting items were completed" failure.
2. **If that is judged too clever:** make the To do card ignore the tab and always fetch with no `connectionId`. That changes mail behaviour on tabs, which today shows only that account's to-dos, so it is the larger change. The server-side `OR` is the smaller one.
3. **Mixed list marker.** The catalog notes the card does not say which rows are meeting items. The detail line already tells her ("From: Pricing review, 12 Oct" against "Dana Cho · Revised pricing"). I would not add an icon or label. Suspected to be enough; check with a user.
4. **Piles.** The card shows only on the Important pile (`pile === "important"`, `Inbox.tsx:549`; `inbox.tsx:504`). A meeting-only user has no piles, so this does not touch IF-1. For a user with mail it hides meeting to-dos on Updates, Newsletters and Spam. Leave it; those piles are mail triage views.

## 4. Clarity issues

1. A meeting-only user is shown "No mail connected" as the page's title (today, `Inbox.tsx:1269`). It reads as a fault. Fixed by plan change 1.
2. The page is called "Inbox" and a meeting-only user's page has no mail in it. The sidebar name is existing, not part of this plan. Renaming is out of scope; the "To do" card is clear enough once it is the first thing on the page. Suspected, not tested with a user.
3. Rows do not link anywhere. The mockup says so deliberately (no meetings page). Acceptable, but the "From:" text looks like a link target on mobile where it sits under a pressable row. Suspected only; check in the native build.
4. Annotation notes in the mockup (the "Tick a to-do..." and "Granola was disconnected..." lines) must not reach the product. Listed so the S5 PR copy section does not quote them.

## Honesty notes

- Measured: the mockup screens and states (screenshots); the code lines cited (read, not run).
- Suspected: web tab behaviour for meeting to-dos; the badge and undo dead ends (taken from the catalog's own claims); whether the "From:" prefix matters.
- Not tried: the real product flow, since the feature is not built; any user test.
- A reasonable alternative reading of verdict: "minimal" for the flow as mockup-drawn. I rate it "acceptable" because the plan text as written leaves an extra step and a misleading page title open, which is one structural gap, not a deep one.
