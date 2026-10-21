# Visual inspection V2 (iteration 7)

Scope: Inbox, Finance (overview and sub-pages), Legal, agent chat, on the mock-data demo stack (web port 5381), dark theme.
Viewports: 1440x900 (all pages), 375x812 with touch emulation (pointer: coarse confirmed true) for Inbox, mail dialog, Finance, Legal, chat, 1920x1080 measured only (the screenshot tool clips to the original window, so no 1920 images were judged).
Screenshots: /tmp/uxloop7/V2/. The demo user is shared with other inspectors, so chat contents and badge counts changed while I worked.

Measurement caveat: layout-audit.js reports contrast ratios of about 1.3 for most dark-theme text. Those are false positives (the text is clearly legible in the screenshots), so no contrast finding is raised from them.

## Verdicts

| Page | 1440x900 | 375x812 (touch) |
|---|---|---|
| Inbox list, piles, filter | Good, fits one screen, inner scroll; two defects (V2-01, V2-02) | Usable; toolbar and checkbox defects (V2-03, V2-04) |
| Inbox cleanup | Good, compact empty state | not captured |
| Inbox digest | Misleading empty state (V2-01) | not captured |
| Mail dialog, attachment preview, email agent panel | Good; minor (V2-10) | Good, all targets 44px |
| Finance overview | Good, inner scroll; chart label clipped (V2-05) | Good, all targets >= 44px |
| Finance sub-pages (accounts, burn, runway, crypto, vendor) | Good; V2-06, V2-12 | accounts and burn: targets pass, not visually reviewed |
| Legal (contracts, deadlines, graph) | Works; dense-table issue (V2-07) | Good card layout, tabs crowded (V2-14) |
| Agent chat (Investor Relations, Mercury, Legal, Finance agents) | Good | Good |
| 1920x1080 shell | Content capped at 1440 and centered (82px gutters) on Inbox and Finance; Legal not measured | n/a |

## Findings

| ID | Page | Sev | Cat | What happened vs expected | Evidence | Suspected location | Proposed fix |
|---|---|---|---|---|---|---|---|
| V2-01 | Inbox, Newsletters, Digest | P1 | bug/copy | Observed. The Newsletters pile lists 3 messages. Clicking Digest shows "No mail", as if the pile were empty. The digest only includes the last 7 days and the newsletters are 8 to 9 days old. Expected an explanation or the messages. Norm C3, I3. | digest-1440.png, news-1440.png | apps/web/src/components/inbox/InboxDigest.tsx:40-43, packages/core/src/inbox-sender-groups.ts:132 (days = 7) | When the pile has mail but the digest window is empty, say "No newsletters in the last 7 days" and offer to show the pile (or fall back to the full pile). |
| V2-02 | Inbox rows | P2 | flow | Observed. No row shows that a message has an attachment, not even in the "Has attachment" filtered list, so Maya cannot tell which mail carries a file without opening it. Norm C3, I6. | att-1440.png | apps/web/src/components/inbox/InboxRow.tsx (suspected) | Show a small paperclip with an accessible name on rows that have attachments. |
| V2-03 | Inbox rows and To do card, mobile | P2 | a11y | Observed with touch emulation. The row select checkbox is 16x16 and the To do checkboxes are 20x20. Every other control measured 44px or more. Norm I4. | m-inbox2.png (tt.js output) | InboxRow.tsx select checkbox, TodoCard.tsx | Give the checkbox a 44px hit area (padding or a wrapping label) on coarse pointers. |
| V2-04 | Inbox header, mobile | P2 | visual | Observed. With a filter chip active the toolbar wraps to a second line right-aligned, leaving the left blank, and its 44px buttons sit 2px above the search box. While loading, the header has a different arrangement (Ask touches the search box, no toolbar), so it shifts when data arrives. Norm L5, D4. | inbox-375t.png, m-menu.png | apps/web/src/pages/Inbox.tsx header toolbar | Collapse the filter chip to an icon with a count on narrow widths, and reserve the toolbar space while loading. |
| V2-05 | Finance overview chart | P2 | visual | Observed at 1440. The annotation "Financing, Oct ↑ $250,000" is clipped at the right edge ("$250,("). The same label fits on the Burn page and at 375. Norm L6. | fin-1440.png vs fin-burn.png | Finance burn chart annotation (file not located) | Anchor the label to the right edge and flip it left of the point, or measure it against the plot width. |
| V2-06 | Finance, Burn, "Where it went" | P2 | a11y | Observed. Ten or more categories are told apart only by grey shades in the stacked bar and 8px swatches, so neighbouring segments are not distinguishable and the bar cannot be matched to the list. Norm H4 (color with purpose; here no differentiator at all), A1. | fin-burn.png | Burn category bar component | Cap the bar at the top 4 to 5 categories plus "Other" and add the category name on hover or focus. |
| V2-07 | Legal, Contracts table | P2 | visual | Observed. Rows are 73px tall because the Contract and Parties cells wrap to 2 to 3 lines, and the Parties text ends about 12px from the Term column. It is a dense tool surface with ten rows that does not fit one screen without scrolling. Norm D1, D4. | legal-1440.png | Legal contracts table column widths (col w-[22%]) | Widen Contract and Parties, drop the type line into a chip, and aim for rows of 36 to 44px. |
| V2-08 | Legal header | P3 | visual | Observed. "37 Data room documents not yet checked by Legal" is an always-underlined 18px-high link squeezed between the header and the tabs. Links elsewhere underline on hover only. Norm H5, I4. | legal-1440.png | Legal page header | Style it like other inline status links and give it a 24px target. |
| V2-09 | Inbox Filter menu | P3 | flow | Observed. One menu mixes three groupings (state filters, Gmail tabs, categories) and an account list, 17 items in all. "Newsletters" is both a category here and a pile tab. Norm I5, C1. | filter-1440.png | Inbox filter menu | Show categories only for the active account, or move Gmail tabs behind an "Advanced" item. |
| V2-10 | Mail dialog with email agent panel | P3 | visual | Observed. Opening the agent panel widens the dialog to the right only (335 to 1411 px), so it is no longer centered (335px left margin, 29px right). The empty agent panel shows just a composer. The working state reads "Bots are working" for one agent. | askagent-1440.png, askagent2-1440.png | apps/web/src/components/inbox/InboxMessageDialog.tsx, EmailAgentPanel.tsx | Grow the dialog from the center, add one or two suggested prompts (Summarize, Draft a reply), and use the agent's name in the status. |
| V2-11 | Inbox toolbar | P3 | visual | Observed. When a filter is applied the Filter button widens and the Cleanup button moves left by about 100px. Norm L5. | att-1440.png vs inbox-1440b.png | Inbox.tsx toolbar | Keep the buttons in fixed positions and put the active filter chip beside the results count. |
| V2-12 | Finance, Accounts, Legal (desktop) | P3 | a11y | Observed with a fine pointer. Many links are shorter than 24px: Burn link 39x16, sync status 182x19, vendor and account links about 18px high, Show all links 16px. Norm I4. | a.sh output on fin-1440, fin-accounts, legal-1440 | rk-tap and hover:underline link classes | Add vertical padding so the hit area is at least 24px. |
| V2-13 | Finance overview | P3 | visual | Observed. Row heights differ across neighbouring cards (Breakdown 32px, Upcoming 37px, Subscriptions 38px) and the card titles sit 4px apart ("Breakdown" 538 vs "Upcoming" 534). The header and Ask button scroll away with content. Norm H5, H6. | fin-1440.png, fin-1440-end.png | Finance page cards | Use one row height token and one card header height. |
| V2-14 | Legal, mobile | P3 | visual | Observed. The three tabs are tight inside their pill ("Contracts 10" touches the edge) and there is a 50px gap between the header and the "37 documents" link. | m-legal.png | Legal tabs | Add tab padding and remove the spacer. |
| V2-15 | Runway page | P3 | copy | Observed. The dashed projection line is not labelled, and the "Cash" table below repeats the Cash tile. Norm C2, C4. | fin-runway.png | Runway page | Label the dashed part "Projected" and drop the duplicate Cash row. |
| V2-16 | Chat, sidebar vs header avatar | P3 | visual | Observed. The Mercury agent shows a white fingerprint tile in the sidebar row and a teal bot avatar in the chat header. Norm H5. | chat-merc-1440.png | Sidebar agent row icon vs chat header | Use the same avatar in both places. |
| V2-17 | Attachment preview | P3 | visual | Observed. Previous and next arrows are shown for a mail with one attachment. I did not check whether they are disabled. | attprev-1440.png | MailAttachments preview dialog | Hide the arrows when there is a single attachment. |
| V2-18 | Finance agent chat | P3 | copy | Observed. Three near-identical "Current cash is ..." replies appear in a row, each followed by "Messaged Chief". This may come from other inspectors prompting the shared user, so treat as unconfirmed. Norm C2. | chat-Fina.png | Agent relay messages | Collapse repeated relay replies. |

## Excellent as is

- Mail dialog and attachment preview: clear actions, Escape returns focus to the attachment, Add to Data room and Download in the preview header, PDF rendered inline.
- Email agent panel: it answered a real question in about 10 seconds with visible progress ("Bots are working 7.7s") and a stop button.
- Filter state: the active filter becomes a labelled chip with a result count and a Clear action, and it survives a reload.
- Touch targets: with pointer: coarse confirmed, every control on Finance, Legal, mail dialog and chat measured 44px or more (exceptions are V2-03).
- No horizontal scroll at 375 or 1440 on any page checked; app pages use inner scroll containers and the window itself never scrolls (pageScrollY 0).
- Chat: one 900px column with grouped bubbles and a composer aligned to it, "Jump to latest" pill, compact question card with two clear options, decided approval cards collapse to a single line with Details.
- Mercury refusal message: says what was not done, why, and links to Integrations.
- Finance KPI tiles and the Accounts page: concise labels, one honest "Brex does not share it" note instead of a made-up number.
- Legal Deadlines tab: due dates, explanation and three actions per row are readable and aligned.
- 1920 shell: content capped at 1440 with equal 82px gutters (Inbox and Finance, measured).

## Not verified

- The Devin-style secret request card and Provide secret dialog, held "Share with {name}?" cards, and the Audience setting: no chat in the demo showed them and triggering them needs a model call I did not make.
- Pending (undecided) approval cards: only decided ones were on screen.
- Inbox cleanup with senders (the demo had none), 375 captures of cleanup and digest, and 1920 screenshots.
- Legal at 1920 width.
