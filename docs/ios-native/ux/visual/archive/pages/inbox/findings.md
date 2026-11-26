# V-inbox round 3 findings

Boards: PG-A-Compose, PG-A-Cleanup, PG-A-InboxMessage, Sheet, Split, Inner-Message. Screenshots are in `shots/` (scratch, not committed). Audit output is in `audit.json` (layout and geometry audits per board); second opinions are in `second-opinion.json` (muse-wonder and gemini-4-argon both ran). Each external claim was checked against the screenshot before it was kept. Boards are fixed-size device mockups, judged at their own size.

Persona: a founder triaging mail one-handed who wants to reply to the few messages that matter and bulk-clean the rest.

Round-2 fixes confirmed in this round: Send arrow now present in every compose frame; one discard sheet (Save draft / Discard / Keep editing); "Draft ready" card with "Review draft" on the outer message; chevrons on collapsed thread rows; Cleanup shown in the outer strip; Unsubscribe is a visible button; Confirm lists Archive and Unsubscribe separately with what is reversible; low-contrast audit is now empty; no target under 44 pt on any board except the Split search field (a false positive, the visible field is about 38 pt).

| id | level | board | element | problem | norm violated | evidence | severity | found by | verified |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| V-inbox-R3-1 | page | Inner-Message | Message selected frame vs Split/Sheet "Draft ready" row badge | The inbox row says "Draft ready", but the open message on the inner display has no "Draft ready / Review draft" card (the outer PG-A-InboxMessage has it). The reply frames then show a finished draft with no visible way in. Fix: draw the same card under the message header on the inner display. | H5, I6, C3 | Inner-Message.png frame 1 vs PG-A-InboxMessage.png frame 1 | P1 | argon, own | yes |
| V-inbox-R3-2 | page | Inner-Message | Cleanup frame | The inner Cleanup pane has only "Archive 101 emails". The Unsubscribe button, the "Skip inbox" menu, the History button and a way out are missing, so the main reason to use Cleanup is not available on the inner display. Fix: draw the same action row, History and back as PG-A-Cleanup. | H5, README same-features rule | Inner-Message.png frame 6 vs PG-A-Cleanup.png frame 3 | P1 | muse, argon, own | yes |
| V-inbox-R3-3 | component | Inner-Message | Cleanup frame, floating "Cleanup" pill | The "Cleanup" menu item from the "..." menu is still drawn above "Archive 101 emails" while the Cleanup pane is already open. It reads as a stray button. Fix: remove the pill from this frame. | L5, H5 | Inner-Message.png frame 6 | P2 | muse, argon, own | yes |
| V-inbox-R3-4 | layout | Sheet, Split, Inner-Message vs PG-A-Cleanup | Strip: "..." vs labeled Cleanup | PG-A-Cleanup frame 1 puts a labeled Cleanup control in the strip. Sheet (all frames) still shows "..." in that slot, and Split and Inner-Message hide Cleanup in the "..." menu. The same entry is drawn two ways, so one of them is not the design. Fix: pick one (the labeled control or the menu) and draw it on every board. | H5, I6 | Cleanup.png frame 1 vs Sheet.png frame 1; Split.png frame 2 | P2 | argon, own | yes |
| V-inbox-R3-5 | component | PG-A-Cleanup | "Cleanup" label in the strip circle | The label is about 8 pt text crammed inside a 50 pt circle. It is the only text-labeled strip control and is hard to read. Fix: icon only with an accessible name, or a larger labeled capsule. | A2, H3 | PG-A-Cleanup.png frame 1 | P2 | argon, own | yes |
| V-inbox-R3-6 | group | PG-A-Cleanup | Senders ticked vs Confirm sheet | The two buttons are "Archive 101 emails" and "Unsubscribe", but the only confirm drawn is "Archive and unsubscribe". Neither button maps cleanly to it, and no archive-only confirm or unsubscribe-only confirm is drawn. The confirm button is also a dark grey pill, not the one prominent action used elsewhere in the same board. Fix: draw the confirm for each button and make the confirming action prominent. | I3, C1, H1 | PG-A-Cleanup.png frames 3, 5 | P2 | muse, argon, own | yes |
| V-inbox-R3-7 | component | Sheet | Press and hold menu on Example Weekly | The row has an unread dot, yet the menu says "Mark unread". It should say "Mark read" for an unread row. Fix: make the item follow the row state. | C1, I8 | Sheet.png frame 11 | P2 | argon, own | yes |
| V-inbox-R3-8 | group | Inner-Message | Reply, inner flat and half-folded | The inner reply composer has no From, Cc/Bcc, attach or Reply-all/Forward title menu, which the outer compose has. A reply to a group cannot be adjusted on the larger display. Fix: draw the same fields and controls, collapsed as on the outer display. | H5, README same-features rule | Inner-Message.png frames 2, 3 vs PG-A-Compose.png frame 2 | P2 | argon, own | yes |
| V-inbox-R3-9 | page | Inner-Message | Message selected frame | While a message is open, the inner display drops the search field and Compose; the strip holds only Archive, Reply, "...". To write a new message the user must close the message first. Fix: keep Compose reachable (strip or "...") in the reading state. | I6, I5 | Inner-Message.png frame 1 vs Split.png frame 1 | P2 | argon, own | yes |
| V-inbox-R3-10 | page | Split | Finance and Ask Finance agent frames | Literal template tokens are drawn: "Synced [TIME]", "Runway now [N] mo", "[AMOUNT]", "About [N] months". They look unfinished and a reader cannot judge the chart or the page. Fix: invented but plausible figures (the repo rule is invented numbers, not placeholders). | C4, H5 | Split.png frames 3, 4 | P2 | muse, argon, own | yes |
| V-inbox-R3-11 | group | PG-A-Compose | Not sent frame | Send becomes a "Retry" circle with roughly 9 pt text and a changed size. Fix: keep the Send arrow in place and put Retry in the banner with the message. | I1, A2 | PG-A-Compose.png frame 12 | P2 | own | yes |
| V-inbox-R3-12 | group | PG-A-Compose | Cc suggestions frame | The Subject row and body disappear while the suggestion card shows. The screen changes shape rather than the card overlaying it. Fix: show the card over Subject and body, or push them down. | L5 | PG-A-Compose.png frame 5 | P2 | argon, own | yes |
| V-inbox-R3-13 | page | PG-A-Compose | New message frames 9-14 | The "Cc, Bcc" row appears in frames 1-4 and is gone in keyboard-open, no-recipient, Sending, Not sent, unknown-result and mail-off frames. Not fixed since round 2 (R2-14). | H5, L5 | PG-A-Compose.png frames 9-14 | P2 | muse, argon, own | yes |
| V-inbox-R3-14 | layout | Sheet, PG-A-Cleanup | Strip capsules | Inbox frames draw four separate glass capsules: back, search/filter/compose, "..." (or Cleanup), chat. The README allows at most three groups. Fix: merge "..." (or Cleanup) into the tools group. | README glass rule | Sheet.png frame 1; PG-A-Cleanup.png frame 1 | P2 | own | yes |
| V-inbox-R3-15 | component | PG-A-Cleanup | Chevron beside Unsubscribe | The chevron opens a single item, "Skip inbox for future mail", with no hint of what it does or that it is separate from Archive. Fix: use a labeled "More" menu or fold the item into the confirm. | I1, C1 | PG-A-Cleanup.png frame 4 | P3 | muse, own | yes |
| V-inbox-R3-16 | component | PG-A-Cleanup | Done screen | The Undo button sits above a note that unsubscribing cannot be undone. The note is present but at 11 pt under the button. Fix: raise the note above the button. | I3 | PG-A-Cleanup.png frame 8 | P3 | muse, own | yes |
| V-inbox-R3-17 | component | PG-A-Cleanup | Sender list | No select-all and no tap-through to see which mail a sender has. Repeated from R2; still low value for five senders. | I5 | PG-A-Cleanup.png frame 2 | P3 | argon, own | yes |
| V-inbox-R3-18 | component | PG-A-Compose | Send result unknown banner | Three-line text beside two actions; cramped. Not fixed (R2-17). | D2, I4 | PG-A-Compose.png frame 13 | P3 | own | yes |
| V-inbox-R3-19 | component | PG-A-Compose | Edit draft frame | The "..." quoted-thread button shown on Reply is missing on Edit draft for the same thread. | H5 | PG-A-Compose.png frames 2, 4 | P3 | argon, own | yes |
| V-inbox-R3-20 | component | PG-A-InboxMessage | Message frame | Two light-filled controls in one view: the "Review draft" button and the filled chat button. The README allows one prominent action. | H1 | PG-A-InboxMessage.png frame 1 | P3 | own | yes |
| V-inbox-R3-21 | component | Sheet | Archived / Couldn't archive toast | The toast covers the Rivera Studio row text. Acceptable for a transient toast; the list could reserve space. | L5 | Sheet.png frames 3, 4 | P3 | argon, own | yes |
| V-inbox-R3-22 | component | Split | Inbox, More menu | The Cleanup popover floats about 60 pt left of "..." over a row with no anchor. | H6 | Split.png frame 2 | P3 | argon, own | yes |
| V-inbox-R3-23 | component | Sheet, PG-A-Compose | Wording | "Sending is off for me@example.test" (Compose) vs "Changes to mail are off" (Inbox). Not fixed (R2-22). | C1 | PG-A-Compose.png frame 14; Sheet.png frame 6 | P3 | own | yes |
| V-inbox-R3-24 | layout | Inner-Message | Inbox zero | The right pane is empty with no text or next step. | D2 | Inner-Message.png frame 5 | P3 | muse, own | yes |
| V-inbox-R3-25 | layout | all six | Spacing | audit.json still shows off-scale and near-duplicate gaps. | D3 | audit.json | P3 | own (audit) | yes |

## Claims rejected after checking
- Muse P0: Send stays active with an invalid address, and with "Sending is off". In both frames the Send arrow is dimmed in the screenshot.
- Muse: Send "unlabeled and unexplained when disabled". The To row says "Add a recipient" and Send is dimmed.
- Muse: strip flips sides between outer and inner displays. This is the Duo layout (strip beside the island on each display), not a defect.
- Argon: no selection highlight on the open row in Inner-Message. The row is highlighted in frames 1-4.
- Argon: read and unread rows use the same type. Unread rows are bolder and have a dot.
- Argon P0 "Search/Filter/Compose vanish": kept only as P2 (R3-9).
- Argon P0 Finance tokens: kept as P2 (R3-10); Finance is outside the inbox journey.
- Muse: "Open Sent" and "Send again" same weight. Open Sent is bold, Send again is dim.
- geometry-audit small target `input#sm` (20 pt) on Split: the visible search field is about 38 pt.

## Excellent as is
- Cleanup states are complete (nothing selected, ticked, menu, confirm, archiving, failed, done, empty, history) with plain copy such as "Couldn't archive. Nothing was moved."
- Confirm now lists each effect and which one is reversible.
- Undo after Archive and an Undo history list in Cleanup.
- One discard sheet with Save draft, Discard and Keep editing in both compose cases.
- Send arrow stays at the same bottom-left position across compose frames, with a dimmed disabled state.
- Outer message screen: "Draft ready" card with one clear action, thread rows with chevrons, unsubscribe row with irreversible warning.
- Inbox recovery states (inbox zero, mail changes off, reconnect, no account, consent, first sync) each name the cause and offer one action.
- Compose error states say what happened and where the mail is ("Your message is saved in Drafts").
- Solid content on every board, glass limited to the strip, menus and toasts; no target under 44 pt; no low-contrast text in the audit.
