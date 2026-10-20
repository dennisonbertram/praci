# STORY-047: Fix the recipient list, then edit and send

Target: planned native SwiftUI iPhone app (epic #427; phases #417, #418, #419). Device: Duo outer display, 466x678 pt.
Evidence viewed: `PG-A-Thread.png` (outer display thread), `Inner.png` (inner display), `DS-06-Chat.png` (tall, downscaled; the Mail approval card and Composer sections were read at reduced size). No live board was opened.

## 1. Friction scorecard

| Measure | Result |
|---|---|
| Ideal path (catalog) | 7 steps |
| Steps as designed | 7 steps written, but only step 1 has a board. Steps 2-5 (edit control, editor form, Cc field, body field) and the confirm in step 6 have NO BOARD. Step 7 (check the Inbox) is outside the card and has no board for this story. |
| Steps that can be walked against a board | 1 of 7 (step 1), plus the final "Sent" state, which DS-06 draws |
| Needless decisions | Two routes exist for the same edit: edit form (NO BOARD) or tell the agent (drawn). Users must choose. "Save" vs "Send", and "Deny" vs "Allow" (see below), are two label sets for one card. |
| Re-entry of known data | Jordan Lee is already a known contact (shown as a mention in the DS-06 composer suggestions and in `Inner.png` Inbox list), but the editor path has him typed as comma-separated text with contact suggestions "not designed". The user retypes a known person. |
| Dead ends | Abandoned edit (swipe down) has no defined outcome. Invalid email has no error state. Removing the only recipient hides "Send" per DS-06, but nothing shows what replaces it. |
| Screens with no board | Edit-and-send screen, its entry point, keyboard layout on the 466x678 display, Duo inner editor layout, post-send verification screen. |
| Board conflict | `PG-A-Thread.png` card shows "Send reply", To, body, "Deny" and "Allow". `Inner.png` and DS-06 show "Re: Pilot timeline", To, body, "Save" and "Send". Same card, two label sets. |

Also: the card in `PG-A-Thread.png` shows only a To row. The draft needs a Cc row to show the edit. DS-06 does draw a Cc row ("Jordan Lee") in the "Needs approval, with Cc" state, so the result of the edit is drawn; the way to get there is not.

## 2. Take-away pass

- Outer thread (`PG-A-Thread.png`): The "Searched mail, 12 results" line and the "Inbox agent is working" line sit beside a card that is already waiting for approval. The working line is stale while the approval is pending (the agent has finished the draft); remove it when a card needs approval. Everything else (header pill, back, two side buttons, composer) is needed. One prominent action: "Allow" is the light filled button and "Deny" is quieter, which is correct. The card title "Send reply" and the agent text "Here is a draft. I have not sent it." both say this is an unsent draft, and the "Needs approval" tag says it a third time. Remove the agent sentence or the tag. The sentence is chat, the tag is the card state, so the sentence is the one to drop.
- Inner (`Inner.png`): The Inbox list on the left is useful context and is the only place the user can see Jordan Lee is a contact. The body here includes "I'll send an invite shortly", which differs from the outer board's draft text; fixture drift only. "Save" is secondary, "Send" is the single prominent action. Good.
- DS-06 Mail approval card: Four states are drawn (Needs approval with Cc, Sent, Not sent, light mode). Good coverage of the static card. Nothing to remove.
- Edit screen: does not exist, so there is nothing to take away. Its existence would add a screen, a keyboard presentation and a discard decision.

## 3. Simpler version

Use the route DS-06 already draws and delete the edit screen from this story.

1. Open the Inbox agent thread at the pending card (a push notification or the Inbox row deep-links here). Card shows "Send" prominent.
2. In the composer type "Add Jordan on Cc and make it 10:30" (DS-06 shows "Add Jordan on Cc" in the typing state) and tap send. The agent replaces the draft with a new card that shows the Cc row "Jordan Lee" and the changed time. The old card goes to a "Replaced" state (not drawn; one-word state to add).
3. Read the new card and tap "Send". The card shows "Sent".

That is 3 actions against the ideal of 7, uses only drawn components, needs no keyboard-over-form layout, no Cc text parsing and no discard rule. It also removes the "unsaved edits when backgrounded" and "invalid email" edge cases, because the agent resolves "Jordan" to a contact.

If direct editing is still wanted (offline, exact wording), add one control only: tapping the card body opens a native sheet with To, Cc and body fields and a single prominent "Done" that returns to the card; "Send" stays on the card. That is 5 actions. Ship it after the composer route (the plan already says edit-and-send comes after approve and deny).

Also needed whichever route is chosen:
- Pick one label pair for the card. Recommendation: "Save" and "Send" (it tells the user what happens; "Allow" does not), with "Deny" removed because "Save" keeps the draft and not sending is the default of doing nothing.
- Move the Inbox check (step 7) out of the journey; the "Sent" state on the card is the confirmation.

## 4. Beauty check

- `PG-A-Thread.png`: Card and bubbles are solid content. Glass is on the floating header pill, the side buttons and the composer only, which matches the rule. Prominent action is the single light filled "Allow". Corner radii on the card (about 14 pt) and its inner buttons (capsule) look concentric. Spacing between the bubble, tool line and card is even. One issue: the "Inbox agent is working" blue line under the card competes with "Needs approval" yellow; two status colors in the same area.
- `Inner.png`: Same pattern; two glass groups on the right (side buttons, more button) plus the composer, within the limit of three. Card and list are solid. Consistent.
- DS-06 (downscaled): card states are consistent in dark and light. I could not read the exact radii and padding values at this size, so I make no claim about them.
- No screen exists for the edit form, so it cannot be checked.

## 5. Verdict

**convoluted** as written: 5 of 7 steps have no board, the card has two conflicting label sets, and the route needs a screen that the design system does not draw. The journey becomes **minimal** (3 steps) if the composer route in section 3 replaces the edit screen.
