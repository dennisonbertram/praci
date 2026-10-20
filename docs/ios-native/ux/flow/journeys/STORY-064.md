# STORY-064 flow critique: a full triage session on the inner display

Target: planned native SwiftUI iPhone app (epic #427, phases #418 and #419). Judged against `Inner.dc.html`, `Split.dc.html` and the "Inbox" and "Inbox message" rule cards in `PG-A-Rules.dc.html` (screenshots `Inner.png`, `Split.png`, `PG-A-Rules.png`). The boards are static; no step was clicked.

## 1. Friction scorecard

| Measure | Result |
|---|---|
| Steps as designed | 24 |
| Story's Ideal path | 24 (the story says the steps are the full session, so the ideal equals the design) |
| Steps that need no screen decision from the user | 3 (step 4 "read", step 23 "pull to refresh", step 24 "list is empty") |
| Steps not needed to reach Inbox zero | 14-16 (Filter and Important only), 18 (open the agent, then abandon it for manual Compose) |
| Needless decisions | Step 15 hides "Read mail" and step 16 turns on "Important only"; both are view settings that do not move the list toward empty. Step 18 asks the agent, then step 19 writes the mail by hand: two routes for one goal. |
| Re-entry of known data | Steps 19-20: the payroll provider recipient, subject and body are typed by hand although the open message (Acme Payroll) already carries the sender and context. Step 5 reply is prefilled, so the app already does this once. |
| Dead ends / undefined outcomes | Last row archived leaves the detail pane with no drawn state; selection after Archive is not defined (step 7); "Inbox zero" in the two-pane layout is not drawn (step 24); a message and the agent thread both claim the detail pane (steps 9, 18). |
| Steps with no board | 5-6 (reply composer), 19-21 (compose), 7 and 13 (Archive control in the strip: `Split.png` shows only Hide amounts, Star, Filter, Compose, and `Inner.png` shows only a document and a checklist icon), 2 (folders list), 4 (message body in the detail pane), 24 (Inbox zero), 16 (what "Important only" does; it is not in the `Split.png` strip at all, which shows an eye, star, filter and compose icon). |

Honest note: the session is long because it has 6 messages and 4 kinds of action. The count of 24 is mostly one tap per selection plus one per action, which is the minimum for a list-and-detail layout.

## 2. Take-away pass per screen

**Inbox list (`Split.png`, `Inner.png` left third).**
- Two counts for one set: the "Needs reply 3" header and the list's "Inbox 42" row in the sidebar. These count different things (42 total, 3 needing a reply), so keep both, but the section count "Other mail today 24" adds nothing a user acts on; it could go.
- The per-row chips "Needs attention", "Newsletter", "Junk" on `Split.png` repeat what the section and sender already tell the user for Example Weekly and Deals Daily. Keep "Needs attention" (it is the only signal on Acme Payroll), drop "Newsletter" and "Junk" chips on rows the user will swipe away.
- The search field "Search mail" sits beside the title while the sidebar also has "Search". Two search fields on one screen; the story never uses either.
- The unread dot plus bold sender both mark unread (the rule card says "filled dot plus semibold"). One signal is enough.
- Prominent action: the single filled circle at the bottom right ("Ask Inbox agent" chat bubble) is the only light-filled button, so there is exactly one. It is the right choice for this story only if the agent is the main route; for triage the main action is Archive, which is not drawn.

**Inbox beside agent thread (`Inner.png`).**
- Exactly one prominent action: "Send" on the approval card (light fill), with "Save" as secondary. That is correct.
- The "Inbox agent" pill top left repeats the composer placeholder "Message Inbox agent". Remove the placeholder text or the pill, not both roles; the pill names the pane, the placeholder is the input hint, so this is a minor repeat only.
- "Needs approval" and "I have not sent it" both say the draft is unsent. State it once; the badge is enough.
- The strip (document, checklist icons) has no label tying it to Archive, Reply or Compose. Not a removal issue but a missing control.

**Message pane, reply composer, compose.** No board; nothing to take away. Treated as findings above.

## 3. Simpler version

Goal and control stay the same: nothing is sent or archived without a tap.

1. Home: tap the Inbox row (step 2 folds into step 1; no change in count, but it should open the list with the first Needs reply row already selected, which removes step 3).
2. Message opens automatically; read it (step 4 stays as a view, not a step).
3. Reply: tap "Reply", type, tap Send. Send returns to the next message in the list (define selection after Archive or Send as "next row down").
4. Archive: tap "Archive" in the strip; the next row opens.
5. Delegate: on Jordan Lee, tap "Ask Inbox agent"; the thread already has the message as context, so the user sends one line and taps Send on the card.
6. Payroll message: tap "Ask Inbox agent" and say "email the payroll provider about this"; the card holds the prefilled draft. This replaces steps 18-21 (abandon, Compose, three typed fields, Send) with one prompt, one Send. Manual Compose stays one tap in the strip for new mail.
7. Newsletters: swipe or multi-select Archive (step 22 stays).
8. Remove the Filter and Important only detour (steps 14-16) from this story; they are view settings, not triage.
9. Drop step 23 (pull to refresh); the empty list is reached by archiving.
10. "Inbox zero" appears in the detail pane as the same empty state as the list.

Result: about 19 steps instead of 24 (removed: 3, 14, 15, 16, 19-21 replaced by 2 agent steps, 23). Needed new boards: Archive/Reply control, reply composer, Inbox zero in two panes.

## 4. Beauty check against the iOS rules

- Glass only on floating navigation: `Inner.png` and `Split.png` show the strip, the "Inbox agent" pill, the composer and the "Ask Inbox agent" circle as floating glass, with list rows and the approval card as solid content. This follows the rule. Pass.
- At most three glass groups: `Inner.png` has the agent pill, the strip, the composer plus its "more" circle: three. At the limit. `Split.png` has the sidebar panel, the strip and the bottom-right circle: three. Note that the sidebar panel in `Split.png` is large; if it counts as glass it is a content-sized glass surface, which stretches the "floating navigation" rule.
- One tinted prominent action: `Inner.png` has one (Send); `Split.png` has one (the light chat circle). Pass.
- Concentric corners: the approval card and its buttons in `Inner.png` use nested radii that look concentric; the selected row fill in the left pane has a smaller radius than the card, which is acceptable because they are not nested. I could not measure radii from the screenshot, so this is a visual judgment only.
- Consistency: the unread treatment differs between `Inner.png` (dot, bold sender) and the rule card text, which is consistent; the row chips only appear in `Split.png`. Type and spacing look consistent between the two boards. The fold zone (x 435 to 455) is empty in `Inner.png`: pass.

## 5. Verdict: acceptable

Actual equals ideal on step count (24 and 24), so the journey is not convoluted. It is acceptable rather than minimal because of one needless detour (Filter and Important only, steps 14-16), a manual compose that re-types data the agent could draft (steps 18-21), and a large amount of unboarded surface (reply composer, compose, Archive control, Inbox zero) that the journey depends on. These are missing designs more than redundant ones.

Top proposal: replace steps 18-21 (open agent, abandon, Compose, three typed fields) with one agent prompt that returns a prefilled approval card, and draw the Archive and Reply controls and the two-pane Inbox zero state.
