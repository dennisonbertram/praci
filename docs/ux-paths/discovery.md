# App Discovery: Rakazo Inbox

Scope: WEB inbox (Electron hosts the same UI). Mobile noted briefly. All refs verified against the repo on 2026-10-14.

## Application Type
Multi-bot AI workspace ("Rakazo") whose Inbox is a Gmail-backed mail triage surface inside the app shell, next to an "Inbox agent" chat panel. Web (React SPA), Electron desktop (same web UI), Expo mobile (separate, smaller inbox).

## Tech Stack
- Web: React + react-router (`apps/web/src/App.tsx:188`), Lingui i18n (`<Trans>`/`t`), `@rakazo/ui-web` components, Tailwind container queries (`@container`, `@md/@xl/@3xl` row layouts).
- API: oRPC contract `packages/contracts/src/rpc.ts:997` (`inbox.*`), handlers `apps/api/src/inbox.ts`, `inbox-compose.ts`, `inbox-modify.ts`, `inbox-attachment.ts`; Postgres/Prisma cache (`CachedMailMessage`, `MailSyncState`, `InboxSenderFeedback`); Gmail provider `packages/adapters/src/gmail-mail-provider.ts`; sync `packages/adapters/src/mail-sync.ts`; triage `packages/adapters/src/inbox-triage.ts` (LLM classifier).
- Pure helpers shared web/mobile: `packages/core/src/inbox-groups.ts`, `inbox-label.ts`, `inbox-triage.ts`.
- E2E specs: `apps/web/e2e/inbox.spec.ts`, `inbox-route.spec.ts`, `inbox-preview.spec.ts`, `inbox-compose.spec.ts`, `inbox-agent-panel.spec.ts`, `email-cards.spec.ts`.

## User Roles
Single role: signed-in user (per space) who has connected one or more Gmail accounts. State variants that change what they see:
- No mail account connected (empty state with Connect mail).
- Mail connected, triage OFF (no model, `triageBlocked.reason="no_model"`).
- Mail connected, triage needs consent (`needs_consent`) - consent prompt shown.
- Triage ON (adds Important toggle, category filters, Needs reply group, labels, to-do card, mark buttons).
- Single account vs multi-account (account tabs only when >1, `Inbox.tsx:550`).

## Feature Map

### 1. Routes / entry points
- Route `/app/inbox` -> `ShellPage` (`apps/web/src/App.tsx:188`); `inboxMode = useMatch("/app/inbox")` (`pages/Shell.tsx:821`).
- Sidebar button "Inbox" with unread-count badge (`Shell.tsx:3065-3092`, `data-testid="sidebar-inbox"`); count from `rpc.inbox.unreadCount` (`Shell.tsx:580-587`, refreshed after sync/mark/archive via `onRefreshed`).
- Page mount `Shell.tsx:3821-3831`; "Connect mail" opens the Integrations overlay pre-filtered to "gmail" (`Shell.tsx:3826-3829`); list is `paused` while that overlay is open and reloads on close.
- Open message is URL state `?mail=<id>` (Back/deep links work; `Inbox.tsx:344-363`). Search/filter are URL params `q`, `filter`, `view`, `category` (`lib/inbox-list-input.ts`). Opening a message with a new filter/search clears `mail` (`setInboxListParam`).
- Other entries to the same message dialog: chat "email cards" from the bot (`components/EmailCards.tsx`, max 20 cards `contracts/events.ts:95`), no filters/archive there.
- Inbox agent panel on the right (`Shell.tsx:3854-3900`): "Create Inbox agent" if none; collapsible ("Collapse Inbox agent" / "Show Inbox agent" button `Inbox.tsx:538-548`); starts collapsed on phones (`Shell.tsx:442-451`).

### 2. Interactive capabilities
**List** (`pages/Inbox.tsx`): grouped sections Needs reply / Today / Earlier (`Inbox.tsx:644-674`, grouping `core/inbox-groups.ts:11-28`). Needs-reply is sorted by priority then date; Today/Earlier by date desc. One row per thread (`oneRowPerThread`, API).

**Search** (`Inbox.tsx:410-454`): single text box "Search mail", submit on Enter (no search-as-you-type), Esc clears, X "Clear" button, max 500 chars. SERVER-SIDE, LIVE GMAIL: query is Gmail search syntax passed through, wrapped `(query)` and AND-ed with any filter term (`apps/api/src/inbox.ts:~268-275`, `searchMail` `:198-262`). Not limited to the 14-day cache. There is NO hint in the UI that Gmail syntax (from:, subject:, after:) works. Search and filter are mutually exclusive with Important/category views (`setInboxListParam` replaces; API throws BAD_REQUEST if combined, `inbox.ts:~282`).

**Filters** (`Inbox.tsx:466-527`, single-select radio dropdown, trigger icon "Filter", shows chosen label when active):
- Gmail live filters (`FILTER_QUERY` `inbox.ts:44-53`): Unread, Starred, Important (only when triage OFF), Has attachment, Primary, Promotions, Social, Updates.
- Triage-only (when `triage` enabled): category radios Bills, Receipts, Scheduling, Newsletters, Security, Notifications, Personal (cached list, 14-day window); plus a separate "Important" toggle button beside the filter (`Inbox.tsx:455-465`) = priority critical/important OR needs-reply OR sender marked important, minus noise senders (`inbox.ts:340-362`).
- Only ONE of filter/category/important at a time; picking one replaces the others. "Clear" menu item appears when active. Empty result -> "No mail matches this filter" + "Clear filter".
- Account tabs (All + one per account, labels truncate at max-w-40) `Inbox.tsx:550-571`.

**Sorting**: none user-facing. Newest first (cached: `receivedAt desc`; search: merged newest first per page, with a known cross-account paging caveat `inbox.ts:~196-200`).

**Pagination**: Unfiltered/default list = single page, cache window 14 days, `MAX_ROWS=200` (`inbox.ts:36-37,375`), no Load more. Filtered/searched list = 50 messages per account per page (`SEARCH_PAGE_SIZE`), manual "Load more" button (`Inbox.tsx:675-681`); duplicates by thread de-duped client-side. No infinite scroll anywhere.

**Read/unread**: row hover button "Mark read"/"Mark unread" and dialog button; optimistic with rollback+reload on error (`Inbox.tsx:295-300`). API: mark read applies to whole thread; mark unread to that one message (`contracts/inbox.ts` InboxMarkReadInputSchema). Opening a message does NOT appear to auto-mark it read in the UI code (no call in dialog or `openMessage`); verify in a story.

**Archive**: row hover button + dialog button + `e`. Optimistic remove, selection/open message moves to neighbour (`Inbox.tsx:301-309`). DISABLED whenever a search or Gmail filter is active (`archive: filtered ? undefined`, `Inbox.tsx:380, 650`), including from the dialog (`:692-700`). No bulk select, no multi-select, no undo for archive, no delete/trash/spam/labels in the web UI (agent tool `mail_modify` can label/archive with approval, "Cannot delete, trash, report spam", `adapters/builtin-tools.ts:699-700`).

**Mark important / Mark noise** (triage only): row buttons "Mark important" (Star) / "Mark noise" (BellOff), per SENDER across all accounts, nothing written to Gmail (`inbox.ts:406-436`); toast "Marked important"/"Marked noise" + Undo for 6s (`Inbox.tsx:704-722`, `STATUS_MS`). Noise rows render muted and are excluded from Needs reply and to-dos.

**To-do card** (triage on, no filter/search/view/category, consent OK) `components/inbox/TodoCard.tsx`: heading "To do"; checkbox per to-do; text, "from · reason" line, due label (Today / weekday within 6 days / "Mon D") coloured red (critical or due<=0) / amber (<=2 days); finished items stay for 24h (`DONE_VISIBLE_MS`); shows first 2 open items on narrow containers with "N more"/"Show less" toggle (`COLLAPSED_OPEN=2`; always all at >=@3xl). To-dos are not clickable to open their source message (no handler on the item; `messageId` exists in data but unused in TodoCard). To-dos come from triage only; user cannot add one.

**Open message** (`components/inbox/InboxMessageDialog.tsx`): modal (full-screen on phones, 768px dialog on desktop). Prev/next chevrons walk the current list; messages are prefetched (first 3 rows, selected row, neighbours; cache of 40, `lib/inbox-message-cache.ts`).

**Compose / reply / forward** (`components/ComposeEmail.tsx`, 852 lines): header "New message"/"Reply"/"Reply all"/"Forward"; From picker (multi-account), To/Cc/Bcc, Subject, rich text with "Formatting options", "Attach files" (max 20 files, 10 MB total `contracts/inbox.ts` MAX_COMPOSE_*), drag-drop ("Drop files to attach"), quoted-text toggle ("Show quoted text"), Discard (confirms "Discard attachments?" when files), autosave draft every 1.5 s (`AUTOSAVE_MS`, "Draft saved"), recipient validation ("Add a recipient.", "Fix or remove the highlighted addresses."). Reply stays in thread; forward re-attaches original files server-side.
**Outbox** (`components/MailOutbox.tsx`, `lib/outbox.ts`): after Send, 5 s "Sending... Undo" window (`UNDO_SEND_MS`), then "Sent" (3 s), "Draft discarded" + Undo. Undo/failed send restores the composer. `MAIL_SENT_EVENT` reloads the Inbox. Send results: sent/saved/unknown ("Not confirmed as sent. Check Sent before trying again.")/reconnect/disabled ("Sending is turned off.")/failed ("Couldn't send. Try again.").

**AI / agent**: (a) Inbox agent chat panel beside the list; created on demand (`rpc.inbox.agent`); tools `mail_search`, `mail_grep`, `mail_get`, `mail_draft`, `mail_modify` (approval required), `show_emails` (renders email cards in chat), overview "what's on my email" tool (`adapters/builtin-tools.ts:565-700`). (b) Triage: LLM classification into category/priority/needsReply/reason + to-dos; requires a usable model AND user consent ("Let Rakazo sort your mail" / "Senders, recipients, subjects and short previews are sent to {name}." / Allow, `components/AiDataSharing.tsx`). Approval settings "Ask before email actions" / "Allow email actions without asking" exist in settings (`ApprovalRulesSettings.tsx`).

**Multi-account**: tabs filter list and to-dos by `connectionId`; composer defaults to the current tab's account (`connectionId={tab}`, `Inbox.tsx:727`); in "All" the account of each row is not shown on the row.

### 3. Row anatomy (`components/inbox/InboxRow.tsx:84-247`)
One 44 px (`h-11`) single-line grid: [unread dot 8px] [sender 96/110/140/180px by container width, truncated] [subject + " - " + snippet, one truncated line] [optional badge] [time].
- Sender: `row.from` (display text from API), red TriangleAlert (aria "Suspicious") for suspicious categories; bold/foreground colour when unread; muted when sender marked noise.
- Subject then snippet on the same line, snippet is plain muted continuation.
- Badge (max one, `inboxLabel`): "Needs attention" (hidden inside Needs reply group), "Newsletter" (outline), "Spam"/"Junk" (warning tint). Only when triage has classified the row.
- Time: today -> "h:mm AM"; else "Mon D" (no year; mail older than a year ambiguous but cache is 14 days; search results can be older).
- No avatar, no attachment icon, no star/important indicator, no thread count, no account indicator, no category chip (only the 4 labels), no priority shown, no "reason" shown in list.
- Hover actions (desktop): Archive, Mark read/unread, Mark important, Mark noise as four icon-only buttons positioned absolute `end-22` over the row, hidden until hover/focus/selected (opacity-0), tabIndex -1 unless selected. Touch/coarse pointer: single "More" (...) menu instead.
- Row is a button (`aria-haspopup="dialog"`); selected row has left border + bg.

**Message dialog fields** (`InboxMessageDialog.tsx:175-304`): title (subject, 20px), prev/next, close; sender name bold + `<address>`; full date-time ("medium" date + short time); "to {to}" and "cc {cc}" truncated single-line with title tooltip (Bcc never shown); action buttons Reply, Reply all, Forward, Archive, Mark read/unread (Archive/Read omitted for chat cards and while filtered); body: sandboxed HTML iframe (remote images preference `lib/remote-images-preference.ts`) or plain text fallback; attachment chips (icon, filename, size) that download via authenticated fetch, "Download failed" alert. No thread/conversation view: shows ONE message even though list rows are threads (row = latest message of thread); no labels shown; no "reason"/category shown; no to-do linking.

### 4. Keyboard shortcuts (complete)
List (`lib/inbox-keyboard.ts`, disabled when typing, any dialog open, composing, help open; ignores Ctrl/Cmd/Alt):
- `j` / ArrowDown: next row; `k` / ArrowUp: previous (if none selected, `k` selects first)
- `Enter` (when not on a button/link) or `o`: open selected
- `/`: focus search
- `c`: compose (only if an account is connected)
- `e`: archive selected (not available while filtered/searching)
- `?`: show shortcuts help
Message dialog (`InboxMessageDialog.tsx:157-173`, only when list-opened with navigate): `j` next message, `k` previous, `e` archive, `r` reply, `a` reply all, `f` forward, Esc closes.
Help dialog "Keyboard shortcuts" (`InboxShortcuts.tsx`) lists: j, k, Enter, /, c, e, r, a, f, Esc. DISCREPANCIES: help omits `o`, arrow keys, `?` itself, and does not say r/a/f/j/k/e are message-view keys; there is no visible hint/button in the UI that `?` exists (no help icon in toolbar). No shortcuts for mark read/unread, mark important/noise, select-all, undo, go-to-account. Shortcuts `r/a/f` do nothing from the list.

### 5. Navigation structure
Sidebar: space search box ("Search" - bots/chats, not mail) -> Inbox button (unread badge) -> bot list. Inbox page header row: `Inbox` title, Search mail input, [Important toggle*], Filter dropdown, Compose icon button, [Show Inbox agent icon if panel collapsed]; second row: account tabs (if >1 account); then error banner; then (consent prompt | To do card); then Needs reply / Today / Earlier; then Load more (filtered only). (*triage only.) Message dialog over the page; composer is a second dialog hiding the preview (`composing && "invisible"`). Right panel = Inbox agent chat.

## Navigation Structure
(see feature map 5) Entry: sidebar Inbox -> `/app/inbox`; `?mail=` deep link; chat email card -> same dialog; Connect mail -> Integrations overlay -> back reloads list.

## Data Entities
- `MailRow` (`contracts/inbox.ts:55-72`): id, connectionId, threadId, from, subject, snippet, receivedAt, unread, needsReply (bool|null), priority (critical|important|normal|low|null), reason (string|null), category (14 values|null), feedback (important|noise|null). Only some fields are rendered (priority, reason not shown on row).
- `InboxListOutput`: accounts[{connectionId,label}], agent, rows, syncedAt, failedAccounts, reconnectAccounts, enabled, triageBlocked, triagePending, nextPageToken.
- `InboxMessage`: from,to,cc,date,subject,html,text,attachments[{id,filename,mimeType,size}].
- `InboxTodo`: id,connectionId,messageId|null (null once out of 14-day cache),text,detail,from,priority,dueOn,doneAt.
- Compose: ComposeFields (clientId idempotency, connectionId, replyToMessageId, forwardOf, to/cc/bcc, subject<=998, body<=150k, html<=300k, attachments<=20, 10 MB), ComposeResult.
- DB: `CachedMailMessage` (14-day window, `inInbox`), `MailSyncState` (lastSyncedAt, lastErrorAt, needsReconnect), `InboxSenderFeedback` (per sender address, migration `20261012160000_inbox_sender_feedback`).

### API endpoints (oRPC `inbox.*`, `rpc.ts:997-1018`)
- `inbox.list` {connectionId?, filter?, query<=500, view?, category?, pageToken<=4096}
- `inbox.refresh` {connectionId?} (sync Gmail; 4 accounts in parallel; queues triage if needed)
- `inbox.get` {messageId}; `inbox.unreadCount`; `inbox.feedback` {messageId, mark|null}; `inbox.markRead` {messageId, read}; `inbox.archive` {messageId}
- `inbox.compose.prefill|draftSave|send|discard`; `inbox.todos.list` {connectionId?}; `inbox.todos.setDone` {id, done}; `inbox.agent`
- HTTP: `GET /api/inbox/messages/:id/attachments/:attId` (25 MB cap `MAX_ATTACHMENT_BYTES`).

## Integrations
Gmail only (OAuth via Integrations overlay, `gmail` plugin; reconnect needed on auth refusal). LLM model + AI-consent for triage. Inbox agent bot with mail tools. Electron/desktop reuses the web UI. No IMAP/Outlook.

## States (empty/loading/error)
- Loading: 5 Skeleton rows `h-9` (`Inbox.tsx:588-593`), shown until first list AND (unfiltered, empty cache) first sync done, and until to-dos load when to-do card applies. Previously fetched list keys render from cache immediately while refetching. No text/spinner copy.
- Triage pending: list refetches every 5 s up to 6 times (`TRIAGE_POLL_MS/MAX_POLLS`); no visible "sorting your mail" indicator; labels/Needs reply appear silently later (rows can jump groups).
- Empty: no account -> only a "Connect mail" button (no explanation text) `Inbox.tsx:582-587`; empty search -> `No results for "{query}"` + "Clear search"; empty filter/category/important -> "No mail matches this filter" + "Clear filter"; empty inbox -> "No mail" (no "inbox zero" message; mobile also "No mail").
- Error: sync/list failure banner `role=alert` + "Try again": "Gmail needs to be reconnected." or "Couldn't reach Gmail." (`lib/inbox-sync-error.ts`); generic `errorText(cause)` for other failures. Banner does not name which account failed and offers no direct Reconnect action (Try again re-syncs). A partial sync failure still shows cached rows below the banner. Message load error: alert + "Try again" in dialog. Attachment: "Download failed". Failed optimistic changes (read/archive/mark) show the error banner and reload list (row reappears).
- Consent: "Let Rakazo sort your mail" card with Allow, replaces To-do card when `needs_consent`.
- Transient: "Marked important/noise" + Undo toast (6 s); outbox "Sending... Undo / Sent / Draft discarded".

## Observed overload / missing-context risks (observations only)
1. Row is one dense line: sender, subject+snippet, badge, time all truncate; subject and snippet share one ellipsised line so a long subject hides the snippet entirely (`InboxRow.tsx:155-158`). Sender column 96px at narrow widths (`:~137`).
2. Hover actions are four unlabeled icon buttons (Archive, Mark read, Star, BellOff) appearing only on hover/focus, overlaying the time area (`absolute end-22`, `:176-224`); the Star/BellOff semantics ("important"/"noise" per SENDER, not per message) are only in aria-labels/menu text - a user may think it flags just that email. No tooltip text found.
3. Search is discoverable only by the placeholder "Search mail"; Gmail operators work but are never mentioned; submit-on-Enter only; no recent searches; no "searching all mail vs. last 14 days" signal.
4. Unfiltered list is only last 14 days / 200 rows with no Load more and no message saying older mail exists; users must know to search. The no-filter view has no "end of list" or "showing last 14 days" cue. To-dos lose their source message after 14 days (`messageId` null).
5. Filter model is single-select and mixes three concepts in one menu (Gmail filters, Gmail tabs Primary/Promotions/Social/Updates, triage categories) plus a separate "Important" toggle; "Important" appears as both a toggle (triage) and a menu item (no triage) with different semantics. Cannot combine Unread + search, or Unread + category. Picking a filter silently clears the search text (and vice versa).
6. Archive disappears during search/filter (and from the dialog) with no explanation; shortcut `e` silently does nothing.
7. Needs reply group is removed in filtered views (`needsReply: null`, `Inbox.tsx:246-252`), so grouping/labels change between views.
8. Group "Today" vs "Earlier" only: no day/week grouping; "Earlier" is a flat list up to 200 rows; time shows only "Mon D".
9. Thread rows but single-message dialog: no thread/conversation context; Reply from the dialog replies to the opened message; mark-read applies to whole thread, mark-unread to one message. No thread-count on rows.
10. Missing context on rows: no attachment indicator (despite "Has attachment" filter), no starred indicator, no account indicator in "All" tab, no priority/reason (reason exists in data: `MailRow.reason`), no avatar.
11. Dialog shows only to/cc truncated to one line (no full recipient list expand; Bcc not shown), no labels, no "view original/headers", no category/"why flagged" text.
12. Keyboard: help list is incomplete and undiscoverable (no `?` affordance); `j/k` mean different things (row vs message) with different scopes; no shortcuts for read/unread or marks.
13. Loading shows grey skeletons with no text; triage-pending reordering is silent; sync happens on every mount of the page (`rpc.inbox.refresh`) with no "last synced" display despite `syncedAt` being returned.
14. Error banner is global and generic; no per-account detail in All tab; no explicit Reconnect link.
15. Account tab labels truncate at 160px; accounts with similar names are indistinguishable.
16. Mobile (`apps/mobile/app/inbox.tsx`, `inbox-message.tsx`, `lib/inbox.ts`): list with sections Needs reply/Today/Earlier, account menu picker (labelled "Account"), "To do" card, Inbox agent entry, Connect mail, "No mail"; NO search box and NO filter UI found in `inbox.tsx` (grep for search/filter returned nothing); message screen separate.

## Recommended Story Topics
1. `find-specific-email` - Finding a specific email: user remembers sender/subject/rough date and must locate it via scan, search, or the agent; exposes 14-day window, 200-row cap, Gmail-syntax search with no hints, and older-mail dead ends.
2. `search-gmail-syntax` - Searching: typed queries, Enter-to-submit, Esc/Clear, no-results state, Load more paging (50 per account), operators (from:, has:, after:), search-clears-filter behavior, and Archive being disabled during search.
3. `filter-and-narrow` - Filtering and narrowing: Unread/Starred/Attachment, Gmail tabs, triage categories, Important toggle, single-select limits, account tabs, clear-filter paths, the triage-on vs triage-off menu difference.
4. `triage-long-list` - Triage of a long list: working through Needs reply/Today/Earlier with archive, mark read/unread, mark important/noise (per-sender, undo toast), j/k/e flow, optimistic changes, row actions on hover vs touch, to-do card.
5. `read-with-context` - Reading and context: open message dialog, prev/next, sender/to/cc/date, HTML vs text, attachments download, no thread view, deep link `?mail=` and Back behavior, neighbour navigation after archive.
6. `act-on-email` - Acting on email: Reply / Reply all / Forward / New message, From picker with multiple accounts, attachments, autosave drafts, 5 s undo-send outbox, send failure/"unknown" outcomes, to-do check-off, and asking the Inbox agent (search, draft, modify with approval, email cards in chat).
7. `keyboard-power-use` - Keyboard power use: j/k/arrows/Enter/o///c/e/?/r/a/f/Esc across list vs dialog, focus return to the row after closing, help dialog gaps, shortcuts disabled while typing or in filtered view.
8. `empty-error-sync-states` - Empty, loading, error and sync states: no account (Connect mail overlay round trip), skeletons, "No mail", no results, no filter match, "Couldn't reach Gmail."/"Gmail needs to be reconnected." with Try again, triage consent prompt ("Let Rakazo sort your mail"), triage-pending reshuffle, failed optimistic actions.
