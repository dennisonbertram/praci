# Walk J3: phone width (375x812) sweep

Target: demo stack web :5381, user mock-founder. Touch emulation was enabled over CDP (pointer: coarse = true, maxTouchPoints 5) before measuring touch targets; the first measurement without it was discarded. Screenshots are in /tmp/uxloop13/J3/. Console showed no errors or warnings.

## Story verdicts

| Journey | Verdict | Steps actual / ideal |
|---|---|---|
| Sign-in (landing, Sign in, email + password) | PASS | 4 / 4 |
| Sidebar drawer (open, pages, chats, account menu) | PASS (targets all >= 44 px under touch) | 2 / 2 |
| Inbox triage (open, read, Archive, Undo; Show more, tabs) | PASS | 4 / 4 |
| Finance overview (scroll cards, burn, breakdown, bills, subscriptions) | PASS (see J3-01 for the toast) | 3 / 3 |
| Data room browse and preview | PASS | 3 / 3 |
| Agent chat with an approval (New bot, ask to email, delegate to Inbox agent, Send) | PASS, delivered and confirmed "Sent" | 7 / 6 |
| Settings (General, Privacy and approvals, Models) | PASS | 4 / 4 |

Not covered: Fundraising/Investors/Legal/Contacts/Artifacts on a phone, Inbox Cleanup and Filter, Hide amounts on, email agent panel, secret request card, Share-with held cards, real notifications.

Praise: pageOverflowX was 0 on every screen; the drawer, Inbox rows, Finance cards, the mail dialog, the approval card and the settings sheet all fit with no horizontal scroll; Undo toast after Archive is clear; approval card (From/To/body, Send, Discard) is clean and the composer reads "Waiting for approval"; Data room and settings switches have a hit area larger than their 32x18 / 18x18 visible box (probed with elementFromPoint), so they are not findings.

## Findings

| id | page | sev | cat | what happened vs expected | evidence | suspected code | fix |
|---|---|---|---|---|---|---|---|
| J3-01 | Finance (any page with an approval toast), phone | P2 | visual | OBSERVED: the "Vendor security questionnaire needs approval" toast box is 118 px tall while its button content is 156 px, so the last body line ("security@halcyon-logistics.example.test") is cut through the middle at the card's bottom edge. Expected the whole card visible. | /tmp/uxloop13/J3/12-fin-a.png, 12-fin-b.png; DOM: wrapper 343x118, inner button 341x156 | packages/ui-web/src/components/ui/notification-toaster.tsx (front height `--height` / measured `t.height`, ~line 220-316); SUSPECTED stale measurement, not confirmed | Re-measure toast height on resize/content change (ResizeObserver on the toast button) so the card height matches its content. |
| J3-02 | First sign-in, drawer + tour, phone | P2 | flow | OBSERVED: after the first sign-in the drawer opens with the tour, the Search box shows a focus ring, and the tour callout for stops 1 and 2 covers the Inbox and Finance rows. SUSPECTED: on a real phone, the focused Search field raises the keyboard over half the screen at the first tour step. Expected the drawer without focus in a text field. | /tmp/uxloop13/J3/03-after-signin.png, 04-tour-2.png | apps/web/src/components/tour/FirstRunTour.tsx (step 1 targets Search); focus on drawer open not located | Do not focus the search input when the tour starts on a touch device (tour highlights it without focusing), and place the callout below the highlighted control only. |
| J3-03 | Inbox message dialog, phone | P3 | copy | OBSERVED: the subject is cut at two lines with an ellipsis ("[MOCK] Q3 investor update: draft for your...") with no way to read the rest; sender/address also wrap awkwardly. | /tmp/uxloop13/J3/09-mail-open.png | apps/web/src/components/inbox/InboxMessageDialog.tsx (title clamp) | Allow the subject up to three lines or expand on tap. |
| J3-04 | Settings, General, Account, phone | P3 | visual | OBSERVED: the account email breaks at the hyphen ("mock-" / "founder@demo.rakazo.test") next to the name. | /tmp/uxloop13/J3/26-set-a.png | Settings account block (not located) | Put the email on its own line with `break-all`/no hyphen break. |

## Notes on tooling (not product findings)
- geometry-audit.js reported wrappedControls for the Inbox tabs, "Show 13 more", and the approval card buttons, and unevenRows in the sidebar; every one looked single-line and consistent in the screenshot, so none were logged.
- Without touch emulation the same drawer measured 28-32 px targets; the app only enlarges them under `pointer: coarse`, so walkers must emulate touch.
- Two `Open navigation` buttons exist in the DOM (one hidden); selector clicks hit the hidden one, use the snapshot ref.
