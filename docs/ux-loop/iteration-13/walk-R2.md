# Walk R2 (iteration 13): verify pass-12 clusters C11-C20

Target: mock demo stack, http://127.0.0.1:5381, 1440x900, desktop pointer only. Session uxl13-R2. Screenshots: /tmp/uxloop13/R2/.
Not covered: phone (375 px) and touch-emulation criteria (C10, C12 target sizes, C14 phone order), the Data room import notice (needs an upload), the sidebar Legal preview date. C15 was checked with a freshly signed-up invented user (walker-r2-NNNNN@northwind.example.test) because the shared mock founder already had consent on.

## Verdicts

- C11 Data room selection and status: PASS with one P3 (steps 4 / ideal 3). After Select all the bar reads "50 of 67 selected" with "Select all 67"; clicking it gives "67 selected". The bar overlays the table (header y stayed 241). Finished untyped files show "Not tagged"; the failed file shows its reason. Entering a folder keeps the header y but drops the Status column (R2-13-04).
- C12 Names and focus: PARTIAL PASS (desktop checks only). Integrations buttons are named "Connect Google Calendar" etc.; Inbox row menu is coded as "More actions for {sender}" (InboxRow.tsx:447, button hidden until hover, not observed live). Touch targets, focus ring on resize handles, drawer focus: not tested.
- C13 Draft reply indicator: PASS (steps 2 / ideal 2). Button changes to a spinner with "Drafting…" (disabled) within 0.4 s and stays until the draft returns (more than 6 s on the demo).
- C14 Models "In use": FAIL (steps 4 / ideal 3). OpenRouter still shows "In use" while the text says "Your bots use OpenAI: GPT-6 Luna." (R2-13-02).
- C15 Privacy vs chat: PASS (fresh user, steps 6 / ideal 5). All switches off; sending "What is my runway?" in Chief shows the consent card ("Share your chats and mail with the AI model that runs your bots?" Allow / Not now) and the composer says "Waiting for approval". Behavior and switches agree.
- C16 Inbox Important: PASS (steps 2 / ideal 2). Needs reply shows 5 rows, newest first (Priya 6:10 AM on top), then "Show 14 more". Updates uses the same day headings ("Earlier"). Attachment rows carry a "Has attachment" icon (DOM-confirmed, rows past the first five).
- C17 Routines panel: FAIL (steps 3 / ideal 3). Chief's Routines panel still shows the heading "Chief's computer" over a blank area, and the header button is still a monitor icon (R2-13-01).
- C18 Data room text: PASS with one P3 (steps 3 / ideal 3). Meta line no longer has a dash or dot; the Failed stat is a button and opens the list filtered to "Status: Failed". Failed row still shows bare "—" in Type and Parties (R2-13-05). Import notice not tested.
- C19 Legal dates: PASS with one P3 (steps 4 / ideal 3). No ISO dates, "Derived from..." note absent on Contracts and Deadlines, Scan now ends with "Scan finished: 1 contract and 0 deadlines added or updated." after about 17 s ("Scanning…" meanwhile). The result line pushes the tabs down 32 px (R2-13-06). C7 side effects also good: Renewal wraps without ellipsis, own company not in Parties.
- C20 Tour popover: PASS with one P3 (steps 9 / ideal 9). Popover is now docked bottom-left; Next stays at x 536, y 776 on stops 1-8 and Skip keeps its slot; stop 9 shows "Ask Chief" in the body with Back and Done. It no longer covers the page title (R2-13-03 covers the remaining overlap).

Also seen working: C9 toast sits left of the open Routines panel; C3 Investors shows Equity raised $300,000 with "2 SAFEs".

## Findings

| id | page/story | sev | cat | what happened vs expected | evidence | suspected code | fix |
|---|---|---|---|---|---|---|---|
| R2-13-01 | Routines panel, C17 | P2 | visual | Observed. With no computer session the panel still shows "Chief's computer" (a heading with nothing under it) and the header button is a monitor icon. Expected: no computer heading, clock or repeat icon. | /tmp/uxloop13/R2/c17-a.png | apps/web/src/pages/Shell.tsx:3872 (noComputerScreen does not match the demo's computer state), :6180 (heading), :5788 (Monitor icon) | Hide the computer section for any state without a screen, and swap the Monitor icon for a clock. |
| R2-13-02 | Settings > Models, C14 | P2 | copy | Observed. OpenRouter row says "In use" but the line above says "Your bots use OpenAI: GPT-6 Luna." Two providers are named for one model. Suspected: the label comes from the model's own provider and "In use" from defaultProvider (openrouter). | /tmp/uxloop13/R2/c14-b.png | apps/web/src/pages/ModelSettingsOverlay.tsx:305-316 and :1281 | Derive both from one value, or say "OpenAI: GPT-6 Luna via OpenRouter". |
| R2-13-03 | First-run tour, C20 | P3 | visual | Observed. The popover (x 323-612, y 713-817) still hides the left part of Chief's last reply at stops 3-9 and the first Data room row names at stop 1. Expected: no chat text covered. | /tmp/uxloop13/R2/tour-3.png, tour-9.png, c11-b.png | apps/web/src/components/tour/TourPopover.tsx | Anchor the popover inside the sidebar column (x under 316) or above the composer on the right. |
| R2-13-04 | Data room folder view, C11 | P3 | visual | Observed. Entering Legal removes the Status column, so Type moves from x 892 to 972 and Added from 1036 to 1116 (header y unchanged). | /tmp/uxloop13/R2/c11-c.png | apps/web/src/components/data-room/ItemRows.tsx (showStatus) | Keep the Status column in every view. |
| R2-13-05 | Data room Failed row, C18 | P3 | copy | Observed. Failed file shows a bare "—" under Type and Parties. Acceptable next to the reason text, but C18 asked for no dash when type is empty. | /tmp/uxloop13/R2/c18-c.png | apps/web/src/components/data-room/ItemRows.tsx | Show "Unknown" or leave the cell empty for failed files. |
| R2-13-06 | Legal Scan now, C19 | P3 | visual | Observed. The result line "Scan finished: ..." appears above the tabs and moves them down 32 px; "Scanning…" gives no line, tabs sat at y 92 then 124. | /tmp/uxloop13/R2/c19-c.png, c19-d.png | apps/web/src/pages/Legal.tsx | Reserve the line's height or place the result beside "Last scan just now". |

## Summary

Clusters: 10. PASS 7 (C11, C13, C15, C16, C18, C19, C20; four with P3 notes), FAIL 2 (C14, C17), PARTIAL 1 (C12), not covered: phone and touch parts of C10/C12/C14. Findings: 0 P0, 0 P1, 2 P2, 4 P3.
