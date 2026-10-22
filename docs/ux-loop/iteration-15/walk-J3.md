# Walk J3: phone width (375x812) sweep

Target: mock-data demo stack (web port 5381). Signed in as the seeded mock founder. Screenshots: /tmp/uxloop15/J3/.
Method note: agent-browser cannot emulate touch, so for touch-target checks I attached a CDP session that turned on touch emulation (`pointer: coarse` true) and measured every visible control (under 44 px = flagged), one page at a time. Real clicks hang with touch-event emulation on, so navigation ran without it. Measurements WITHOUT coarse pointer are not used.

## Story verdicts (phone sweep, core journeys; steps actual/ideal)

- Sign-in: PASS (3/3: email, password, Enter). No overflow, all targets at least 44 px with coarse pointer.
- Sidebar drawer: PASS (2/2: hamburger, row). First visit opens the drawer by itself with tour card "Search: Type here..." (1/9) over its bottom; later visits start closed. Page rows, chat rows, Integrations and the account menu (Settings, Integrations, Hide amounts, Take the tour, Log out) all reachable.
- Inbox triage: PASS (4/4: open drawer, Inbox, open mail, Archive). Archive shows an "Undo" toast above the bottom edge and Undo restores it. Replied mail leaves "Needs reply" and moves to "Other mail today". Needs reply shows five rows and "Show 15 more".
- Finance overview: PASS (3/3). No overflow, cards in two columns, chart and Breakdown readable. All targets 44 px or more with coarse pointer.
- Data room browse and preview: PASS with findings J3-01, J3-02 (4/3: extra step to clear the pre-applied Failed filter).
- Agent chat with approval (per-email agent, own fresh thread): PASS (6/5: open mail, Ask agent, Draft a reply, read card, Send). Full-width Mail card with Send/Discard, "Sent your reply to Priya." afterwards. Finding J3-05.
- Settings: PASS (3/3). Dialog with section dropdown (General, Privacy and approvals, Models, Memory), no overflow. Switch rows have 44 px label rows.

BLOCKED: none. SKIPPED: tour steps 2-9 at phone width, Updates/Newsletters tabs, Cleanup screen, Legal/Contacts pages (out of this group's list).

## Findings

| id | page/story | sev | category | observed vs expected | evidence | suspected code | proposed fix |
|----|-----------|-----|----------|----------------------|----------|----------------|--------------|
| J3-01 | Data room, sidebar | P2 | flow | Observed: tapping the sidebar "Data room" row while any file has failed opens the page filtered to "Status: Failed" and shows only the 4 failed files; a first-time founder wanting to browse sees no good files until she finds the small chip X. Expected: Data room opens to all files; the failed badge alone goes to the failed view. | 17-dataroom.png (Filters 1, only failed rows), 19-dr-all.png (after X: all files), 20-dr-reload.png (direct URL: all files) | apps/web/src/pages/Shell.tsx:4658 | Send the plain row to /app/data-room and give the failed-count badge its own link to ?status=failed. |
| J3-02 | Data room list | P2 | a11y | Observed with coarse pointer: row "Select ..." checkboxes measure 18x18 (all rows). The code comment says the slot is a 44 px target, but the 44 px span is an aria-hidden spacer, so the tap area is 18 px and a near miss opens the preview. Whether a near-miss opens the preview was not tapped, so that part is suspected. | coarse measurement on 17-dataroom.png and 21-preview.png (Select r1-upload-note.txt 18x18, etc.); Inbox checkboxes pass the same test | apps/web/src/components/data-room/ItemRows.tsx:336-350 | Make the 44 px wrapper the clickable label/hit area for the checkbox (as the Inbox row does). |
| J3-03 | Sidebar drawer | P3 | a11y | Observed: Pages rows (Inbox, Finance, ...) are `<button>`s with no href (DOM check), so they cannot be opened in a new tab or announced as links. | DOM query on 10-drawer.png state | apps/web/src/pages/Shell.tsx (sidebar page rows, near 4640-4700) | Render page rows as router links. |
| J3-04 | Inbox list | P3 | visual | Observed: after a tap or Undo the last-touched row stays highlighted (left bar) with its "..." button drawn on top of the time ("3:58 AM" partly covered). Expected: no sticky hover look on touch, and the time stays readable. | 14-finance.png (first capture shows Inbox), 29-acct.png, 30-settings.png | Inbox row component hover/focus styles (apps/web/src/components/inbox/) | Use hover styles only under (hover: hover); hide the time when the actions button shows. |
| J3-05 | Agent chat | P3 | copy | Observed: while working after Send, the status said "Working... 3 tools: Mail search, Mail send x2" and later collapsed to "Done . 1 tool . 33s". Expected: one consistent tool tally. Only one reply was sent (the Mail card shows Sent once). | 26-sent2.png vs 27.png | chat tool-summary component (not located) | Count the finished tool calls only once the run is done, or show the same count in both. |
| J3-06 | Open email, phone | P3 | visual | Observed: sender line wraps the address at a hyphen ("robin@beacon-" / "retail.example.test>") with the date squeezed on the same row. Expected: name and address on one line, date below or at the right of the subject. | 12-mail.png | apps/web/src/components/InboxMessageDialog.tsx (header) | Put the date on its own line below 640 px. |
| J3-07 | Data room preview | P3 | flow | Observed: a text file's preview shows a large file icon and the AI summary, not the text. Expected (suspected): a visible text preview, or Download/Open as the clear next step. May be intended for mock text files. | 21-preview.png | apps/web/src/components/data-room/ (preview dialog) | Render the text content for text/plain files. |

Other notes (not findings): first Settings open took several seconds on the vite dev server (lazy chunk compile); second open was about 0.35 s, so I treat it as a dev-only cost. One real click on the tour's "Skip tour" button did not register while the browser tool was hanging; a script click worked, not reproduced, so not reported. Overflow audit: pageOverflowX is 0 on every page. Console: only vite debug lines, no errors.

## Excellent
- Touch targets: with a coarse pointer, sign-in, drawer, Chief chat, Inbox, Finance, email agent chat and Settings have no control under 44 px (the sole exception is Data room checkboxes, J3-02).
- Approval card in the narrow email agent chat is full width, readable, and the next step (Send or Discard) is obvious.
- Archive Undo toast, "Needs reply" newest-first with "Show N more", message actions collapsed to "...", and the toast sitting above the composer all match the owner decisions.
