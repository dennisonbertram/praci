# Visual inspection V2 (iteration 17)

Scope: Inbox, Finance, Legal, agent chat, Artifacts on the mock-data demo stack (web 5381). Viewports 1440x900, 375x812, 1920x1080 (shell), plus one light-theme check. Session uxl17-V2. Screenshots in /tmp/uxloop17/V2/.

Limits: `agent-browser set device "iPhone 15"` did not turn on `pointer: coarse` (matchMedia returned false), so no touch-target finding is filed. No model key on the demo, so approval cards (payment, share, secret) could not be produced and were not inspected; the Finance helper chat shows a stuck "Thinking" state instead. The host had load average ~49 during the walk, so two cold-load stalls ("Opening Praci…" then "Still opening… Try again", 8-9 s) were environmental: three reloads afterwards took about 1 s. Not filed.

## Verdicts

| Page / state | 1440x900 | 375x812 | 1920x1080 |
|---|---|---|---|
| Inbox, sorted (To do, Needs reply, Other mail, Earlier) | Pass. Header and tabs stay put, list scrolls in its panel, no page scroll. | Pass. Rows reduce to sender + one subject line. | Pass. Content capped at 1440 and centered in the work area. |
| Inbox, unsorted and "Sorting your mail…" | Pass (dimmed rows, spinner, placeholder rows). | not captured | n/a |
| Message dialog + attachment preview | Pass, with V2-02. | Pass, with V2-01. | n/a |
| Cleanup (empty) | Pass. Compact one-line empty state with one button. | not captured | n/a |
| Finance overview | Pass. Fits above the fold; Subscriptions scrolls in the panel. | Pass. Cards reflow to one wide plus a 2-column grid. | Pass. |
| Finance, Accounts | Pass. | not captured | n/a |
| Legal, Contracts | Pass, with V2-03. | Pass. Table becomes a card list. | n/a |
| Legal, Deadlines | Pass, with V2-04. | not captured | n/a |
| Chat (Chief, Investor Relations, Finance helper) | Pass. | Pass. | n/a |
| Artifacts (grid, detail) | Pass, with V2-05. | Pass. Opens as a list with ages. | n/a |
| Light theme (Legal) | Pass. | n/a | n/a |

## Findings

| id | page | sev | cat | what happened vs expected | evidence | suspected location | proposed fix |
|---|---|---|---|---|---|---|---|
| V2-01 | Inbox message dialog, any viewport | P2 | visual | Observed: while a message loads, the dialog shows a bright white card with grey skeleton bars on the dark theme. For a plain-text message (most mail) the card then disappears, so it is a white flash with no purpose. Expected: placeholder in the theme surface; white only when the loaded body is HTML mail. Norm H5/I2. | /tmp/uxloop17/V2/m-thread.png (loading) vs m-thread2.png (loaded) | apps/web/src/components/inbox/InboxMessageDialog.tsx:603 (`bg-white`, `bg-neutral-200`) | Use the card/muted tokens for the loading placeholder; keep white only for the HTML-body frame. |
| V2-02 | Attachment preview (PDF) | P3 | a11y | Observed once: with the PDF preview open, the first Escape left it open and moved focus to "Download"; the second Escape closed it and focus returned to the attachment chip. Likely focus sat inside the PDF iframe and swallowed the key (suspected, not confirmed). Expected: one Escape closes. Norm I7. Not re-run to rule out timing. | after-esc1.png, after-esc2.png | preview dialog under apps/web/src/components/inbox | Move initial focus to the dialog's close button on open, so Escape reaches the dialog. |
| V2-03 | Legal, Contracts table 1440 | P2 | visual | Observed: fixed column widths (26/19/...%) truncate the two cells that carry the meaning: contract name ("MOCK Consulting Agreement - Fictiona…") and renewal ("Auto-renews, 30 days …" hides "notice"; "62 days n…" hides the rest) while Value and Next deadline have spare room. Full text is only in the hover title. Expected: renewal terms readable in the table. Norm C4. | legal-1440.png; col widths 278/182/203/171/96/139 px | apps/web/src/pages/legal/LegalContracts.tsx:163 | Give Contract and Renewal more width (shrink Term and Next deadline) or shorten the renewal text to "Auto-renews, 30 d notice". |
| V2-04 | Legal, Deadlines | P3 | visual | Observed: each of 9 rows repeats three equal-weight buttons (Ask agent, Done, Dismiss), 27 controls in one screen; nothing marks Done as the usual action. Expected one emphasized or hover-revealed action per row. Norm H1/D5. | legal-deadlines.png | apps/web/src/pages/legal/LegalDeadlines.tsx:289 (Undo exists, so only the visual weight is the issue) | Keep Done visible, move Ask agent and Dismiss into a row "..." menu. |
| V2-05 | Artifacts, grid 1440 | P3 | visual | Observed: grid cards are ~150 px tall for a title and one line; no age shown, while the list view and the mobile default show "4m ago". The grid hides information the list shows. Norm D1/H5. Also the opened document sits in a bordered card with blank space below short content (artifact-open.png). | artifacts.png vs artifact-open.png | apps/web/src/pages/Artifacts* | Add the age to the card footer; let the preview card shrink to content. |
| V2-06 | Inbox rows 375 | P3 | a11y | Observed: some rows (e.g. "Legal notice", "Receipts for the Austin trip") show a small grey dot before the subject. On desktop the same rows carry a word chip ("Urgent", "Action"). The dot is a colour/shape-only status with no text (suspected to be the collapsed reason chip). Norm C3. | m-inbox-scrolled.png | apps/web/src/components/inbox (row reason chip) | Give the dot an accessible name and show the reason word on tap/long-press, or keep the chip. |
| V2-07 | Finance, burn chart | P3 | visual | Observed: the "Financing, Oct ↑ $250,000" annotation sits directly on top of its triangle marker (text touches the marker); on 375 the label ends 38 px from the edge. Value is off the $150k axis so it is pinned to the top, which is correct but crowded. | finance-1440.png, w-finance.png, m-finance.png | Finance burn chart component | Offset the annotation 6-8 px above the marker. |
| V2-08 | Finance, Accounts | P3 | visual | Observed: cash accounts are ordered by name, so the $1,150,000 Mercury Treasury is last and $300 Brex Cash is first. Expected largest first. The Total cash tile is a 170 px orphan next to empty space. Norm H2/D2. | fin-accounts.png | Finance Accounts page | Sort by balance, descending. |
| V2-09 | Mail attachment preview, large file | P3 | flow | Observed: a 12 MB file shows "Too large to preview (12.0 MB)" in a large empty panel; the only recovery is two icon buttons in the header. Expected a Download button in the message. Norm I3. | m-att.png | preview dialog | Put a labelled Download button under the message. |
| V2-10 | Sidebar, first load | P3 | a11y | Observed: on first load the sidebar Search box shows the strong focus ring from autofocus, and in the Inbox search state two controls look focused at once (sidebar Search and Search mail). Norm I7/H1. | home-1440.png, search.png | sidebar search autofocus | Do not autofocus the sidebar Search; focus the page heading or leave focus on body. |

Not filed: contrast flags from layout-audit.js on sidebar text (ratios 1.2-1.4) are false positives from transparent backgrounds; the real chat bubbles measure 5.9:1 (orange) and 4.9:1 (pink) with dark text. Sidebar content shifts seen during the walk come from other walkers using the same demo account.

## Excellent as is

- Inbox sorted view: the To do card, "Needs reply" with five rows and "Show N more", reason chips, and the sticky header with inner-panel scroll. It fits one screen with no page scroll at 1440 and 1920.
- Message dialog: compact, actions (Reply primary, Archive, Ask agent, More) in one row, attachment chip with size.
- Attachment preview for the PDF: filename, Add to Data room, Download, large readable page.
- Cleanup empty state: one sentence and one next step.
- Finance overview: five metrics, period switch, chart, breakdown, upcoming and subscriptions; dense, aligned, numbers right-aligned, "Show all N" links; works in light and dark; mobile reflow is clean.
- Legal on mobile: the table becomes a card list that keeps name, party, term, value, due date.
- Chat: "Thinking 4m 10s, Taking longer than usual, Stop, Try again" gives a recovery path; the "NEW" divider; artifact links in replies; bubbles keep AA contrast; composer is always visible.
- Cold-load fallback ("Still opening…, Try again") exists and is clear.
- Artifacts on mobile open as a list with ages.
