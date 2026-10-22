# Visual inspection V2 (iteration 16)

Group V2: Inbox, Finance (overview and sub-pages), Legal, agent chat with approval cards and artifacts.
Target: mock-data demo stack (web 5381). Signed in as the seeded mock founder. Screenshots are in `/tmp/uxloop16/V2/` (outside the repo).
Method: screenshot at 1440x900, 375x812 and 1920x1080 (shell), `layout-audit.js` and `geometry-audit.js` on each state, hover, keyboard focus, dialogs.
The demo account was shared with other walkers, so some state (Hide amounts, new mail, a sorted Inbox, a running Legal scan) changed while I walked.

Not measured: touch targets. `set device` gave the right viewport but `matchMedia('(pointer: coarse)')` stayed false, so no touch-target finding is reported.
Low-contrast hits from the audit script on the dark theme were not confirmed by eye and are not reported.

## Verdict per page and viewport

| Page / state | 1440x900 | 375x812 | 1920x1080 |
|---|---|---|---|
| Inbox list (Needs reply, To do, groups) | Good. One-screen shell, list scrolls inside its panel. | Good. Reflows to two-line rows. | Good, content centred. |
| Inbox Cleanup (empty) | Good, compact. | not captured | not captured |
| Inbox Filter menu | Good. | not captured | not captured |
| Email dialog + attachment | Good. | Good (full screen). | not captured |
| Attachment preview | Excellent. | not captured | not captured |
| Email agent panel | Works; V2-07, V2-08. | Works; V2-14. | not captured |
| Finance overview | Good; V2-11. Scrolls inside its panel (1274px of content), Subscriptions is below the fold. | Good. | Good. |
| Finance Accounts | Excellent, fits one screen. | not captured | not captured |
| Finance category (Rent) | V2-01, V2-10. | not captured | not captured |
| Legal Contracts | V2-04, V2-05. | Excellent reflow. | not captured |
| Legal Deadlines | V2-12. | not captured | not captured |
| Legal Graph | V2-01, V2-06. | Works after a long skeleton (V2-01). | not captured |
| Chat (Chief, page agent, fresh bot) | Good. | Good; V2-15. | not captured |
| Mail approval card, Send, Sent | Good; V2-13. | not captured | not captured |
| Artifacts grid and split view | Good. | not captured | not captured |

## Findings

| id | page / story | sev | cat | what happened vs expected | evidence | suspected location | proposed fix |
|---|---|---|---|---|---|---|---|
| V2-01 | Legal Graph tab, Finance category page | P1 | perf | Observed: after clicking Graph a grey skeleton stayed up for about 24 s (desktop: still skeleton at 8 s, drawn by about 16 s later; mobile: skeleton at 8 s, drawn 16 s after that). The Rent category page showed "Loading..." for over 5 s. Expected: under 2 s or a progress cue. The demo had other walkers running, so the absolute numbers are inflated. | leggraph-1440.png, leggraph2-1440.png, leggraph-375.png, leggraph3-375.png, finrent2-1440.png | suspected: graph data request or layout work on the Legal page; not traced | Profile the graph request, and show "Building graph..." text after 2 s. |
| V2-02 | Chat artifact reply | P1 | bug | Observed: the bot's reply ends with "Open the document", rendered as plain text (`<p><span>Open the document</span></p>`, no `<a>`). The artifact exists in Artifacts. The person has no way to open it from the chat. Expected: a link like "MOCK Q3 Board Deck" in Chief's reply. | newbot2-1440.png, art-1440.png, DOM dump | `packages/chat-ui/src/markdown.web.tsx` around line 465: links whose href `urlTransform` blanks as unsafe are kept as text. Suspected: the agent emitted an href the transform rejects. | Make the artifact tool return the in-app `/app/artifacts/<id>` href, or render a button from the tool result rather than model-written markdown. |
| V2-03 | Approval, send an email (another walker's thread, read-only) | P1 | flow/copy | Observed: after approval the reply says "The email to Alex wasn't sent because the connected account wasn't specified. The approved draft is kept and can be opened in the composer." No retry button, no link to the composer, and "connected account" is internal wording. My own thread (card showed From mock-founder@..., Send, "Sending...", "Sent") worked, so it is intermittent. Expected: failure that says what to do, with a Retry or Open in composer action. | j3-1440.png vs send-1.png, send2-1440.png | suspected: account not passed on some delegated sends; not traced | Resolve the default account server-side when only one is connected; on failure show an "Open draft" button. |
| V2-04 | Legal, Contracts table | P2 | visual | Observed: Contract name column is 160 px and truncates every name ("MOCK Insurance Poli...", "MOCK Office Lease - ..."), while Term and Renewal are 234 px each for about 170 px of text. The identifying column is the narrowest relative to its content. Hover title exists. Norm D2/C4. | legal-1440.png; cell widths 160/117/74/234/234/85/160 | `col.w-[22%]` on the contracts table (Legal contracts view) | Give Contract about 30 %, Parties 20 %, shrink Term and Renewal to content. |
| V2-05 | Legal header, banner | P2 | visual | Observed: while a scan runs, the page shows a disabled "Scanning..." button plus a banner "1 Data room document not yet checked by Legal [Check now]". When the scan finished the banner vanished and tabs and table jumped up about 60 px. "Last scan 2m ago" also stayed unchanged for several minutes. Norm L5, C3. | legdl-1440.png (banner) vs leggraph3-1440.png (no banner) | Legal page header and banner | Reserve the banner row, or fold the unchecked-document note into the header status line. |
| V2-06 | Legal Graph, desktop | P3 | a11y/visual | Observed: node labels are 12 px in SVG units scaled by 0.77 (viewBox 1388 wide in 1066 px), so they render at about 9 px. The mobile version scrolls sideways at full size and is readable. Norm D1, A1. | leggraph3-1440.png, measurement | Legal graph component | Set a minimum rendered font size, or use the scroll layout on desktop too. |
| V2-07 | Email dialog with agent panel open | P3 | visual | Observed: opening the panel grows the dialog to x 336 to 1432 at 1440 wide, leaving an 8 px right gutter against 336 px on the left. Same 8 px at 1280. Norm L4. | askagent-1440.png; dialog rect [336, 67, 1096, 765] | `apps/web/src/components/inbox/InboxMessageDialog.tsx:148` (`left-[calc(50%-384px)]`, `w-[min(1152px,calc(50vw+376px))]`) | Cap width at `100vw - left - 24px`. |
| V2-08 | Email agent panel | P3 | flow | Observed: the first thing in the panel is an "Email thread - 1 message" card that repeats the open email, and the "Ask agent" button stays in the email header while the panel is open. Norm C2. | askagent-1440.png | `EmailAgentPanel.tsx` | Hide the thread card when its message is already visible beside it; make "Ask agent" a toggle. |
| V2-09 | Sidebar agent rows | P3 | visual | Observed: when a bot is Working, a tiny 18x11 pixel indicator sits next to the time and unread dot. The title "Finance helper (mock)" wraps to two lines and the row grows from 56 to 74 px, which pushes the rows below it down. At that size the indicator reads as a stray green flag. The seeded "Working..." state also stayed for 10+ minutes. Norm L5. | newbot3-1440.png, drawer-375.png, element dump (`svg.pixel-icon`) | sidebar chat row component | Put the indicator in the status line, not the title row. |
| V2-10 | Finance category page (Rent) | P3 | visual | Observed: with one vendor, $7,500 appears three times (summary, vendor row, transaction row). The counterparty is underlined in the table but not in the vendor row. Page took over 5 s to load (V2-01). Norm C2, H5. | finrent3-1440.png | Finance category page | Skip the Vendors card when there is one vendor; use one link style. |
| V2-11 | Finance Burn chart | P3 | visual | Observed: the partial month "Oct*" is two stacked unlabeled dots that read as an "8"; the Financing marker (triangle) sits apart from its label, above the top gridline and off the axis. Same at 375. | crop2.png, fin-1440.png, fin-375.png | Finance burn chart component | Draw the partial month as a dashed segment with a tooltip; anchor the Financing label to its marker. |
| V2-12 | Legal Deadlines | P3 | visual | Observed: each of the 8 rows has three equal outlined/plain buttons (Ask agent, Done, Dismiss), and the due time appears twice ("Due in 11 days" and "Nov 2, 2026"). Norm D5, H1. | legdl-1440.png | Legal deadlines list | Keep Done visible; move Ask agent and Dismiss into a row menu. |
| V2-13 | Inbox agent, after Send | P3 | copy | Observed: after Send, the same fact appears three times: the "Mail Sent - casey@..." card, the text "Sent 'V2 walk notes are ready' to casey@...", and a "Messaged New Bot" chip. Norm C2. | send2-1440.png | agent reply template for mail_send | Drop the repeated sentence when the card already says Sent. |
| V2-14 | Email agent panel, phone | P3 | visual | Observed: the "Draft a reply" chip starts at x=28 while the thread card and composer start at x=16. Norm H6. | agent-375.png | `EmailAgentPanel.tsx` | Remove the extra 12 px indent. |
| V2-15 | Chat, phone | P3 | visual | Observed: the oldest visible message is cut off by a hard edge under the header, with no fade. | chat-375.png | chat scroll container | Add a short top fade like the sidebar list has. |
| V2-16 | Inbox, phone | P3 | visual | Observed: "Northwind Robotics" floats on its own line under the search box, and the "To do" chip becomes an unlabeled checklist icon on rows. | inbox-375.png | Inbox header and row chip | Move the space name into the header; show "To do" text if width allows. |
| V2-17 | App load, first run | P3 | visual | Observed: sidebar Search shows a focus ring right after sign-in and stays until the first click. The tour card text starts "Search: Type here to find..." (prefix repeats the control name). | home-1440.png, inbox2-1440.png | sidebar search autofocus; tour copy | Do not autofocus on load; drop the "Search:" prefix. |
| V2-18 | App load, hard navigation | P3 | perf | Observed once: at 1920x1080 the "Opening Praci..." splash was still showing 4 s after a full page load. | inbox-1920 layout audit (dead area on `div "Opening Praci..."`) | app boot | Check boot time on the demo stack with no other walkers running. |
| V2-19 | Sidebar at 1440x900 | P3 | visual | Observed: the chat list scroller is 384 px high (content 804 to 1046 px), so about five rows show and the "Page agents" and "Email chats" groups sit under the bottom fade. Norm D1. | fin-1440.png, scroller measurement | sidebar layout | Collapse Pages by default once chats pass six, or shrink Pages rows. |

## Excellent as is

- Attachment preview (preview-1440.png): clear title, the two actions it needs (Add to Data room, Download), Escape returns focus to the attachment button.
- Email dialog (thread-1440.png, thread-375.png): single primary action (Reply), everything else secondary, full-screen on phone.
- Inbox list: Needs reply, To do card, "Show N more", reason chips, dimmed read rows. Rows are readable at 1440, 1920 and 375.
- Finance Accounts page (finacc-1440.png): fits one screen, balance chart plus two grouped lists, right-aligned amounts.
- Finance overview and Legal Contracts on a phone: clean reflow, no horizontal scroll (overflowX 0 on every page checked).
- Mail approval card (appr/inboxagent-1440.png): one white primary (Send), Discard, a menu, and an editable From/To/body. It moves to "Sending..." then "Sent" without a page jump.
- Artifacts grid and split view (art-1440.png, artdoc-1440.png): a card grid that becomes a list and preview without leaving the page.
- 1920 shell: content is capped at 1440 and centred, with equal margins.
- Inbox Cleanup empty state: one line and one button, compact.
