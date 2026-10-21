# Fix list, round 4 (final): Granola and Wispr Flow

Round 4 found no P0, no P1 and no high walker finding. Every walkable story passes in all three reviews. The rows below are the remaining polish, and every row is open.

**Product name.** The shipped interface calls the product "Praci": 15 shipped English strings use it and none use "Rakazo". Every user-visible string the plans quote, and every visible word in the mockups, uses "Praci". Prose about the repository can keep "Rakazo".

## Plans and catalog

| id | source | change |
|---|---|---|
| UX-1 | ux-visual r4-granola R4-1, walker F4-IF-5-01 | Replace "Rakazo" with "Praci" in user-visible copy quoted in `docs/plans/granola.md` and `docs/plans/wispr-flow.md`. For example, "Praci keeps your meetings and to-dos." and "Removes this meeting and its to-dos from Praci." Update the same strings in the catalog and in issues #441, #442, #447 and #444 or #452 wherever they quote them. |
| UX-2 | flow N4-1, walker F4-GS-3-01 | The "Both connected" route labels are "Sign-in" and "API key", as in the mockup. Update the plan S6 "Page order" and GS-3, and list both as copy for the S6 PR to quote. |
| UX-3 | flow N4-2 | While no key route is connected, the compact sign-in row keeps the existing agent link that `McpDetail` already shows. Once the key connects, the link moves under the key status and is drawn only once. Change plan S6 and #442. |
| UX-4 | walker F4-GS-7-01, F4-IF-7-01, F4-MX-5-01 | The citation popover shows the title and date, because as a bottom sheet at phone width it is detached from its chip. Update plan S4 and S6, and the Flow S5 note, to say so. Remove the line saying the title and date are not shown again. |
| UX-5 | walker round 4 | Mark GS-6, IF-4 and IF-7 as mocked in the catalog, with their mockup screen lines. Note in the catalog that `topics/*.md` are the original drafts and that the stories in `catalog.md` are current. |

## Mockups

| id | source | change |
|---|---|---|
| UX-6 | UX-1 | Use "Praci" in all visible text in both mockups. |
| UX-7 | ux-visual r4-wispr R4-1, r4-granola R4-2 | At 375 px the account tabs scroll horizontally, with a fade at the edge, so the third tab is reachable. |
| UX-8 | r4-granola R4-3 | At 375 px in "Both connected", the status text truncates on one line next to Disconnect. |
| UX-9 | UX-3 | Draw the agent link on the "Sign-in only" state. |
| UX-10 | flow N4-3, walker F4-MB-5-1, visual M-16 | Add a Typing state to the Flow phone frame. Keep the key field, Connect and the consent footer visible above the keyboard, and stop the consent footer being cut off in the key state. |
| UX-11 | walker F4-MB-2-1 | Show the "API key" placeholder in the phone state "Reconnect, key rejected". |
| UX-12 | walker F4-MB-1-1 | "Praci keeps your meetings and to-dos." must not break inside "to-dos" (use a non-breaking hyphen). |
| UX-13 | walker F4-WF-6-1 | At 375 px the provider list and the Flow pane have the same width. |
| UX-14 | visual SV-5 | Remove the permanently disabled "Replace key" button. The decided path is Disconnect, then paste (FX-37). |
| UX-15 | visual M-15 | The phone back control can be reached with the keyboard: a button with `aria-label="Back"`. |
| UX-16 | visual r4-granola R3-4, R3-5, R3-7 | Give the retention sentence 8 px of space from the label. Start both phone frames at the same top. Size the citation chip so line spacing stays even. |

## Decided and left as they are

- F2-WF-8-1 and F-MB-2-1: a single error line per D3 and FX-24.
- F-WF-7-2: no copy for a long recording.
- F3-WF-6-1 and F3-WF-6-2: vocabulary is not visible, and the "Speak + transcribe" subtitle stays.
- F-MB-3-6: the due-date rule is the existing `TodoCard`.
- F3-MB-6-1: the phone call frame is the existing call UI.
- R3-6: the delete scrim covers the pane, as the mockup draws it.
- R3-9: the sidebar at 375 is mockup chrome.
- IB-8: existing copy.
