# Walk W3: Inbox (STORY-INB-101..121 plus every INB story marked "Updated 2026-10-20")

Walker session: uxl1-W3. Target: mock-data demo stack (web :5381), signed in as the demo founder, 1440x900 unless noted.
Screenshots: /tmp/uxloop1/W3/ (numbered 00-54). Console was clean (no errors or warnings) on every screen walked.

## Demo state caveat
The demo database had already been used by earlier walkers: the Newsletters pile and Spam tab were empty, Cleanup History held 8 older entries, and no sender had 3+ messages. Stories that need bulk mail (INB-101, 102, 104, 105, 107) could only be walked in part. Every story had one attachment per mail, never three.

## Story verdicts (steps actual / ideal)

| Story | Verdict | Steps | Note |
|---|---|---|---|
| INB-101 Digest of newsletters | BLOCKED (state) | 3 / 3 | Newsletters pile empty; Digest toggle works and shows "No mail". Archive-all not reachable. |
| INB-102 Archive a noisy sender group | BLOCKED (state) | - | No sender has 2+ mails in a pile, so no group rows exist. |
| INB-103 Select rows, Spam, Undo | PASS | 4 / 5 | Tick, shift-click, shield: toast "Marked 3 as spam" + Undo, Spam 3 tab appears, Undo removes the tab. Not-spam half not walked. |
| INB-104 First Cleanup pass | FAIL | 3 / 4 | Nothing preselected, all three bar buttons show 0 and are disabled, and the list is every sender (incl. a colleague and the lawyer). See W3-03. |
| INB-105 Unsubscribe mailto / link | BLOCKED (state) | - | No sender offers an unsubscribe method; "Unsubscribe 0" stays disabled. |
| INB-106 Skip inbox and Stop | PASS | 4 / 6 | "Skip inbox 1" -> toast, row shows "Skipping" + "Stop"; persists on reload; Stop clears it. No Gmail-permission link shown. |
| INB-107 Undo from History, forget learned pile | PARTIAL | 2 / 4 | History lists actions with Undo; toast Undo on Archive works. Learned pile "Forget" not reachable. |
| INB-108 Cleanup on phone | SKIPPED (native) | - | Expo app; only web at 390px walked (see W3-10). |
| INB-109 Monday reset (long) | PARTIAL | ~12 / 24 | Pile tabs, Filter > Unread + Clear, Cleanup, Spam, Undo walked; Digest/archive-all/unsubscribe parts blocked by state. |
| INB-110 Cleanup when writes off | SKIPPED | - | Needs mailWritesDisabled operator setting. |
| INB-111 Step through attachments | BLOCKED (state) | - | Every mail has one attachment. Single-file preview works (PDF, "Too large to preview" for a 12 MB video). |
| INB-112 Ask agent about a thread | PASS (UI) / FAIL (answer) | 3 / 4 | Button creates a chat named from the subject with a collapsed "Email thread" card. The demo model then replies it cannot see the email. See W3-06. |
| INB-113 Ask agent, sharing not allowed | BLOCKED | - | AI data sharing is already allowed for the active model; no consent card appeared. |
| INB-114 Auto-filing setting | PASS | 3 / 3 | Models settings checkbox saves on change, persists after reopening. Placement noted in W3-11. |
| INB-115 Invoice auto-filed | BLOCKED | - | Needs a new mail arriving during sync. Chip menu showed "Added" for the Q3 deck (already filed). |
| INB-116 Mail not auto-filed | PARTIAL | 3 / 4 | 12 MB video chip showed "Add to Data room" (not filed); click -> "Added" in under 1 s and the file appears in the Data room. |
| INB-117 Reopen thread agent | SKIPPED | - | Depends on a saved draft; not set up. |
| INB-118 Vendor email to filed doc and agent answer (long) | PARTIAL | 6 / 12 | Open mail, preview, Add to Data room, Ask agent walked; agent answer not usable on demo model. |
| INB-119 Try again during pause | PASS | 1 / 1 | Button disabled with a spinner overlay for under a second, then the same notice returns. |
| INB-120 Notice clears | BLOCKED | - | Catalog: throttled account never recovers on the demo. |
| INB-121 Reply while Gmail fails | BLOCKED | - | Catalog: not reachable on the demo. |
| INB-001 Connect mail from empty Inbox | PARTIAL | 2 / 2 | "No mail connected / Connect Gmail ... / Connect mail" is clear. Connect step is OAuth, not clicked. Compose does nothing (W3-04). |
| INB-025 Sorting wait | BLOCKED | - | Needs a fresh account with Gmail connected. |
| INB-007 Why the Inbox opens on Important | PASS | 2 / 2 | Opens on Important with Updates, Newsletters (Spam appears only when it has mail). Filter menu has no Important item. Filter lists Updates and Newsletters again (W3-05). |
| INB-016 File one attachment by hand | PASS | 2 / 2 | Chip menu or preview toolbar "Add to Data room" -> "Added". |
| INB-005 Mark noise | PASS | 1 / 1 | Hover icon -> toast "Mail from X is now marked as noise" + Undo (works). |
| INB-014 To do list | FAIL | 2 / 2 | Ticked item leaves the card at once (no strike-through in place, no undo); card shows 2 items + "N more" (W3-08). |
| INB-015 Download attachments | PARTIAL | - | Download item present in chip menu and preview; 12 MB file shows "Too large to preview" (W3-09). Download itself not saved. |
| INB-017 Reconnect notice | PASS | 1 / 1 | "Gmail needs to be reconnected / Gmail signed this account out. Sign in again to see your mail here. / Reconnect Gmail". Click not tried (OAuth). |
| INB-018 Rate-limit notice | PASS (copy drift) | 1 / 1 | Notice reads "Gmail is limiting requests right now." (no "Try again in a minute" as in catalog). |
| INB-019 Ask the Inbox agent | FAIL | 2 / 4 | After ~35 s the agent said it cannot verify the Needs reply list, while the page shows "Needs reply 13" (W3-07). |
| INB-030 Keyboard only | PARTIAL | - | j moves a focus ring, Enter opens, "?" shows a clean shortcut list. Exact j-j landing row unverified. |
| INB-031 Phone width | PASS | 1 / 1 | 390px: no horizontal overflow, header and tabs wrap cleanly, To do card compact. |
| INB-021 Two inboxes | PASS | 2 / 2 | All / Founder mail / Sales mail tabs under the pile tabs; Sales + Important shows "Needs reply 1". |

Counts: PASS 11, FAIL 4, PARTIAL 7, BLOCKED 11, SKIPPED 3 (some stories carry two marks above because the UI half and the demo-model half differ).

## Praise (observed)
- Toasts with Undo on archive, spam, noise and skip-inbox are quick, worded plainly, and Undo restores state (tested for archive, spam, noise, skip).
- Error and empty states are specific and give one next action: "No mail connected", "Gmail needs to be reconnected", "Your mail didn't load" + Try again.
- Phone width (390 px) Inbox has no horizontal overflow and keeps the main actions.
- "Add to Data room" turned into "Added" in under a second and the file showed up in the Data room.
- Keyboard shortcut sheet (?) is complete and readable.

## Findings

| ID | Story / page | Sev | Cat | What happened vs expected | Evidence | Suspected code | Proposed fix | Status |
|---|---|---|---|---|---|---|---|---|
| W3-01 | INB-007, 101 / Inbox piles | P1 | flow | Rows badged "Newsletter" (Founder Digest, SaaS Metrics Monthly) sit in Updates while the Newsletters tab says "No mail". A user who clicks Newsletters to find them sees nothing. Expected the badge and the pile to agree. | 03-updates.png, 02-newsletters.png | packages/core/src/mail-piles.ts:58-66 (`resolvePile`: header rule pile beats the model category); demo seed gives Gmail Updates category | Make a row whose label is "Newsletter" land in Newsletters, or drop the badge in the Updates pile. | Observed |
| W3-02 | INB-007 / Filter menu | P2 | visual | Filter menu repeats the pile tabs: "Updates" under Gmail tabs and "Newsletters" under Categories, next to tabs with the same names. Two ways to say the same thing with different results. | 12-filter.png | apps/web/src/pages/Inbox.tsx (filter menu items) | Hide Updates/Newsletters filter items while pile tabs are visible. | Observed |
| W3-03 | INB-104 / Cleanup | P1 | flow | Cleanup lists every sender (23 rows) including people Maya writes to (colleague at her own domain, her lawyer, investors) with a checkbox each; nothing is preselected and the action bar reads "Archive 0 / Unsubscribe 0 / Skip inbox 0" with no hint what to do. A first-time user is asked to hand-sort 23 senders. Expected only bulk senders, or a "nothing to clean up" state. | 05-cleanup.png, 06-cleanup-history.png | apps/web/src/components/inbox/InboxCleanup.tsx; sender stats query in apps/api/src/inbox-cleanup.ts | List only senders with 3+ mails and no replies from Maya, else show "Nothing to clean up". | Observed |
| W3-04 | INB-001 / empty Inbox | P1 | bug | With no mail connected the Compose (pen) button is enabled but a click does nothing, no message, no dialog. Dead control on the first screen Maya sees. | 38-compose-nomail.png (identical to before click) | apps/web/src/pages/Inbox.tsx Compose handler | Disable it with a tooltip, or open "Connect mail". | Observed |
| W3-05 | INB-032 / Ask panel | P2 | visual | Opening the Inbox agent panel squeezes the Inbox: the space label "Northwind Robotics" drops under the title and the search box drops under it (two extra rows), and truncation increases. With no Inbox agent the panel is blank except a floating "Create Inbox agent" button. | 39-ask-nomail.png, 41-todo.png | apps/web/src/pages/Inbox.tsx header container | Keep header on one line (search flex-shrinks), and add one line of purpose above "Create Inbox agent". | Observed |
| W3-06 | INB-112, 113, 118 / thread agent | P1 | bug | "Ask agent" seeds an "Email thread" card (visible in chat) but the reply says "I don't see the email content in this chat. Please paste the message." No consent card appeared although AI data sharing for the active model is on. The user sees the email on screen and is told to paste it. Caveat: demo model uses a placeholder key; real-model behaviour unverified. | 22-askagent.png, 24-agent-reply.png | apps/api/src/inbox-thread-agent.ts (initialMessage block) and the executor's mail_thread handling | Confirm the thread block reaches the model; if the demo stub ignores it, label the demo reply accordingly. | Observed (cause suspected) |
| W3-07 | INB-019 / Inbox agent | P1 | bug | Asking "What needs my reply today?" took ~35 s, delegated to two mail agents, and ended with "I can't verify the complete Needs reply list". The Inbox page shows "Needs reply 13" at the same time. Earlier answers say Founder mail has "0 messages" and name "Welcome to Praci" mail that is not in this Inbox. The agent's mail tools read a different mailbox than the page. | 42-agent-q.png, 45-kb-j.png | Inbox agent tools in packages/adapters/src/builtin-tools.ts vs list in apps/api/src/inbox.ts; demo Gmail emulator seed | Give the Inbox agent the same "Needs reply" cached list the page shows. | Observed |
| W3-08 | INB-014 / To do card | P2 | flow | Ticking a to-do removes it from the card at once with no strike-through and no Undo; catalog says it is struck through in place. The card is also tall: 5 items fill ~300 px before the first mail on first load, but a later load showed 2 items + "N more". Inconsistent default (all 5, then 2). | 01-inbox.png, 41-todo.png | apps/web/src/components/inbox/TodoCard.tsx:25-34 | Keep done items struck through until reload, and use one default size. | Observed |
| W3-09 | INB-015, 111 / attachment preview | P2 | flow | "Too large to preview" fills a ~700 px panel with one grey line and no size or limit. A 12 MB mp4 is not huge. The PDF preview embeds the browser PDF viewer with a second toolbar (own download/print/edit) and a raw id as its title ("dcb70268-82ed-449...") under the app's own title and Download. | 19-video.png, 16-preview.png | apps/web/src/components/inbox/MailAttachments.tsx | Show file size and "Download to view" in the too-large state; hide viewer toolbar/title (`#toolbar=0`) or set a title. | Observed |
| W3-10 | INB-108, 031 / phone Cleanup (web 390 px) | P2 | a11y | Cleanup row checkbox is 16x16 px (touch target well under 44 px) and the sender name truncates to "Priya Pl..." / "Cloudn..." while the email address keeps its width. Name is the identity, so it should win. | 44-phone-cleanup.png | apps/web/src/components/inbox/CleanupSenderRow.tsx | Pad the checkbox hit area to 44 px; let the name truncate last. | Observed (hit area padding unverified) |
| W3-11 | INB-114 / Settings | P3 | flow | The "Add email attachments to the Data room" checkbox lives in Models settings, under the "Data room search model" disclosure. Maya who thinks "where do I turn off auto-filing?" will not look under Models; Settings opens on General with a password form first and AI data sharing below the fold. | 26-settings.png, 27-models.png | apps/web/src/components/ModelSettings.tsx | Move to its own "Email" or "Data room" settings group. | Observed |
| W3-12 | Spaces / sidebar | P2 | perf | Clicking an agent in another space (Busy mail agent) loaded a full document and stayed on "Opening your Space..." for 20 s+ (a get-session request never finished). Same URL loaded in 6 s on retry. Not reproduced. | 30-busy.png | apps/web space bootstrap (apps/web/src/pages/shell) | Add a timeout with a retry button to the "Opening your Space" screen. | Observed once, not reproduced |
| W3-13 | Cleanup / More menu | P3 | visual | "More" overflow menu holds one item ("Spam N"), the most destructive bar action, hidden behind a menu while safe actions are inline. Disabled "Archive 0" renders brighter than its disabled siblings. History entries that were undone keep a disabled "Undo" with no "Undone" mark. | 08-cleanup-more.png, 05-cleanup.png, 06-cleanup-history.png | apps/web/src/components/inbox/CleanupActionBar.tsx, CleanupHistory.tsx | Show Spam inline or label undone rows; style disabled states the same. | Observed |
| W3-14 | Filter > Unread | P3 | visual | In the Unread filter 7 of 8 rows carry a "Needs attention" badge, so the badge stops carrying information; sidebar badge says 7 unread but the filter shows 8 results (one is an Archived mail, shown with an "Archived" badge). | 13-unread.png | apps/web/src/components/inbox/InboxRow.tsx | Drop the badge when it applies to most rows; exclude archived mail from the Unread filter or explain. | Observed |
| W3-15 | Connected apps logos | P3 | perf | Page load fetches `https://cdn.simpleicons.org/...` from a third-party host for the Gmail icon. Contradicts "no hosted vendor required" and leaks the user's connected apps to a CDN. | network log from 30-busy session | apps/web/src/components/integrations/AppLogo.tsx:10, apps/web/src/lib/integrations.ts:100 | Bundle the icons. | Observed (request); intent suspected |
| W3-16 | Catalog drift | P3 | copy | INB-018 says the notice reads "Gmail is limiting requests right now. Try again in a minute."; the UI shows "Gmail is limiting requests right now." Update the catalog. Also INB-106 step 3 "Also in Gmail" link was not displayed (Gmail filter permission apparently granted on the demo). | 32-ratelimit.png | docs/ux-paths/catalog.md | Edit catalog. | Observed |
| W3-17 | Error states (reconnect, rate limit, no mail) | P3 | visual | Pile tabs, Cleanup, Filter and Ask stay on screen while the page says mail did not load or is not connected, so five controls can do nothing useful. | 32-ratelimit.png, 34-reconnect.png | apps/web/src/pages/Inbox.tsx | Hide the tabs and Cleanup in these states. | Observed |

Not found: horizontal overflow (0 px at 1440 and 390), wrapped controls, console errors. The geometry audit's "uneven rows" hits were all sidebar title/time rows (intentional) and were not logged.

## Skipped or blocked list
BLOCKED: 101, 102, 105 (demo data), 111 (single attachments), 113, 115, 120, 121, 025, 001 connect step. SKIPPED: 108 (native), 110 (operator setting), 117.
