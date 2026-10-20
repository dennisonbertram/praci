# Mobile parity inventory

Code-read inventory at origin/main on 2026-10-15, one table per area. Web means `apps/web/src` (also hosted by Electron); mobile means `apps/mobile`. Status: FULL, PARTIAL, MISSING, N/A (desktop-only by nature), UNSURE (not traced). Size: S is UI over an existing API, M adds small shared logic, L needs a new API, contract or native module. Nothing here was exercised in a running app.

## Parity inventory: Chat and threads

Web = apps/web/src (Shell.tsx is the chat shell; pages/shell/*, components/*). Mobile = apps/mobile.
Status: FULL / PARTIAL / MISSING / N/A. Size: S = UI over existing API, M = UI plus small shared logic, L = new API/contract or native module.

| Feature | Web evidence | Mobile evidence | Status | Size | Notes |
|---|---|---|---|---|---|
| Space switching | Shell.tsx space sidebar, `rpc.spaces.list`; pages/shell/space-sidebar.ts | app/index.tsx `chooseInboxSpace`, lib/inbox-spaces.ts | FULL | - | |
| New space | pages/shell/dialogs.tsx `NewSpaceDialog`, `rpc.spaces.create` | app/new-space.tsx | FULL | - | |
| Rename space | dialogs.tsx `RenameSpaceDialog`, `commitSpaceRename` (space-sidebar.ts), `rpc.spaces.rename` | none (no `spaces/rename` call in apps/mobile) | MISSING | S | Contract `spaces.rename` exists in packages/contracts/src/rpc.ts. |
| Delete empty space | dialogs.tsx / Shell.tsx `rpc.spaces.remove` | lib/inbox-spaces.ts `spaces/remove`, app/index.tsx "Delete space" | FULL | - | |
| Bot/group list, sections, pin, move to section, new/rename section | Shell.tsx sidebar; pages/BotContextMenu.tsx; `rpc.botSections.create/update` | app/index.tsx, components/bot-organize-modal.tsx (long press) | FULL | - | Mobile also has "silence notifications" per bot. |
| Manual mark read / mark unread | BotContextMenu "Mark as Unread/Read"; `rpc.threads.markUnread/markRead` | `threads/markRead` only; no markUnread anywhere in apps/mobile | PARTIAL | S | `threads.markUnread` exists (contracts rpc.ts:489). Add item to bot-organize-modal. |
| Duplicate bot / group | BotContextMenu "Duplicate"; `rpc.bots.duplicate`, `rpc.groups.duplicate` | none | MISSING | S | Both procedures exist (rpc.ts:371, 393). |
| Drag to reorder bots in roster | Shell.tsx `reorderRosterBot`, `rpc.bots.reorder`; `reorderBotTo` in packages/core/src/bot-sections.ts | none | MISSING | M | Needs a native reorderable list; helper and RPC exist. |
| Archive bot and restore | BotContextMenu "Archive", `rpc.bots.archive/restore/listArchived` | thread.tsx "Archive"; app/(settings)/archived-bots.tsx; lib/bot-lifecycle.ts | FULL | - | |
| Archive / restore group | Shell.tsx `rpc.groups.archive`, `listArchived`; archived groups list in sidebar | none (archived-bots.tsx and bot-lifecycle.ts handle bots only) | MISSING | S | Groups cannot be archived or restored from mobile. |
| Delete bot, clear conversation, edit profile | BotContextMenu; dialogs.tsx `DeleteBotDialog`, `ClearConversationDialog` | thread.tsx "Delete…", "Clear conversation"; app/bot-settings.tsx | FULL | - | |
| Collapsible sidebar sections, sidebar density preference | Shell.tsx `toggleSidebarSection`, `getBotsSidebarDensity` | only per-parent "Collapse {name}" in app/index.tsx | PARTIAL | S | Low impact. |
| New bot | Shell.tsx `rpc.bots.create` | app/new.tsx | FULL | - | |
| Bot DM thread | Shell.tsx `Transcript` + `Composer` | app/thread.tsx | FULL | - | |
| Create group | pages/GroupPanel.tsx `NewGroupPanel` | app/new-group.tsx | FULL | - | Min/max member limits shared via contracts. |
| Group settings (rename, members, delete) | GroupPanel.tsx (settings panel) | app/group-settings.tsx, components/bot-member-picker.tsx | FULL | - | |
| Group thread | Shell.tsx (`inGroup`) | app/group-thread.tsx re-exports thread.tsx | FULL | - | |
| Message send, mentions (bot, routine, connector, group, everyone), slash skills and slash actions | Shell.tsx `Composer` (5703) | components/thread-composer.tsx | FULL | - | Same composer helpers from packages. |
| Attachments (file, photo, camera) | Composer file input, drag and drop, paste | thread.tsx `attachActions` (Photo library, Camera, File); lib/pick-attachments.ts | FULL | - | Drag/drop and paste are web input methods. |
| Voice input / start call from composer | Composer `onVoice`, lib/call-session.ts, lib/dictation.ts | thread-composer.tsx `startVoiceCall`; lib/call-session.ts, lib/dictation.ts | FULL | - | |
| Reply and quote | Composer reply chip; `QuoteSelectionButton` (Shell.tsx 5634) | components/composer-reply-preview.tsx, select-text-sheet.tsx, lib/quote-selection | FULL | - | |
| Edit a sent message | none | none | N/A | - | Neither surface has it. |
| Retry failed send | Composer `retryNonce`, "Failed to send message" | components/failed-send-bubble.tsx ("Not sent · Tap to retry"); lib/unsent-sends.ts, outbox-disk.ts | FULL | - | Mobile has a durable disk outbox. |
| Stop a running reply | Composer stop, `rpc.threads.stop` | thread-composer.tsx `stop`, `threads/stop` | FULL | - | |
| Sent-message history with ArrowUp | Composer `sentHistory` | none | N/A | - | Hardware-keyboard shortcut. |
| Reactions | `MessageHoverActions`, `rpc.threads.react` | message-context-menu (react submenu), thread.tsx `reactToMessage` | FULL | - | |
| Message context menu / actions | MessageHoverActions (React, Reply, More: Copy, Speak) | components/message-context-menu.tsx; lib/message-action-sheet.ts | FULL | - | Mobile adds Quote and Select text. |
| Hover metadata rail | components/MessageHoverMetadata.tsx | components/time-separator.tsx, message-caption.tsx | N/A | - | Hover affordance; touch shows a time separator. UNSURE whether per-message time is shown. |
| Load earlier, jump to latest, jump to search hit | Transcript, `pinnedAroundRef` | thread.tsx "Load earlier messages", "Jump to latest"; lib/thread-jump.ts | FULL | - | |
| Space search | pages/SpaceSearch.tsx, `rpc.search.query` | app/index.tsx search mode, lib/search.ts, search-destination.ts | FULL | - | |
| Command palette ("Switch bot") | pages/shell/command-palette.tsx (hotkey) | app/index.tsx bot search | N/A | - | Keyboard-driven switcher; the mobile list search covers it. |
| Markdown text bubbles | `ChatMarkdown` (packages/chat-ui) | components/message-caption.tsx, chat-ui markdown.native | FULL | - | |
| Tool activity disclosure (`steps`, activity `progress`) | components/ToolActivityDisclosure.tsx; setting in lib/tool-activity-preference.ts (default off) | `isToolActivityBlock` hides these blocks (lib/message-presentation.ts); no setting, no disclosure | MISSING | M | Web default is off, so only users who turned it on lose it. Needs a setting and a native disclosure. |
| Live "working" state | `isLive` progress rows | components/WorkingIndicator.tsx, "{name} is working" | FULL | - | |
| Ask card (free text, secret/login, approval actions, answered state) | components/AskCard.tsx | thread.tsx `AskBlock` (3990+), components/AskActions.tsx | FULL | - | Web plain ask shows "Send it / Edit first"; mobile shows the text field directly. Same capability. |
| MCP approval card | pages/shell/message-cards.tsx `McpApprovalCard` | components/McpApprovalCard.tsx | FULL | - | |
| App-connect card | message-cards.tsx `AppConnectCard` | components/AppConnectCard.tsx | FULL | - | |
| Choice / focus card | message-cards.tsx `ChoiceCard` | components/ChoiceCard.tsx | FULL | - | Mobile handles dismissal locally. |
| Artifact file card and preview | components/ArtifactFileCard.tsx (text, html, pdf inline) | app/artifact.tsx, markdown-artifact-preview.tsx, sandboxed-html-preview.tsx, lib/artifact-open.ts (share) | PARTIAL | M | No inline PDF or other types; "No preview for this file type" with Share. |
| Image artifact | message-cards.tsx `ArtifactImage` | components/inline-image-attachment.tsx, image-artifact-viewer.tsx, app/image.tsx | FULL | - | |
| Chart block | message-cards.tsx `ChartBlockView`/`ChartCanvas` | none in thread (chart only appears in agent-page code) | MISSING | L | Needs a native chart renderer or WebView. Shows only the text "[chart: name]". |
| Email cards (`emails` block) | components/EmailCards.tsx | `blockText` in lib/api.ts shows a plain-text list | PARTIAL | M | Plain text only. Mobile has a separate mail inbox screen (app/inbox.tsx), not these cards. |
| Finance cards (`finance` block) | components/FinanceCards.tsx | `financeCardText` in `lib/api.ts`, shown as plain text | PARTIAL | M | Text fallback only; no native card, no links to finance pages. |
| Skill draft card (`skill_draft`, save/test/add to routine) | components/teach/SkillDraftCard.tsx | text fallback in `blockText` (`lib/api.ts`): name, status, goal and numbered steps | PARTIAL | M | No review, save or add-to-routine actions.  Teaching itself records the bot computer, so the recording side may be N/A on phone; the draft card (review, save, add to routine) is plain UI. |
| Cloud agent card | components/CloudAgentCard.tsx | thread.tsx `special.kind === "cloud_agent"` | FULL | - | |
| Subagent and child-bot cards | Shell.tsx MessageView | thread.tsx | FULL | - | |
| Computer card (Open) | Shell.tsx `computer-card` | components/ComputerCard.tsx | FULL | - | |
| Handoff and channel (external message) rows | MessageView | thread.tsx `AgentEventLabel`, channel row | FULL | - | |
| Peer messages chip | `CollaborationMarker`, opens PeerMessagesOverlay.tsx (full bot-to-bot transcript, `includePeerRuns`) | thread.tsx peer chip with a code comment "Full view-only peer chat is web-first; mobile keeps the chip without expand" | PARTIAL | M | Mobile shows the chip only. Shared helpers lib `peerConversations`/`loadPeerHistory` are in apps/web/src/lib (check whether they should move to packages/core). `threads.messages` already takes `includePeerRuns`. |
| Call card (in-call: mute, hang up, transcript, settings) | components/call/CallCard.tsx | components/CallCard.tsx | FULL | - | |
| Voice chat transcript card | components/call/VoiceChatCard.tsx | components/VoiceChatCard.tsx | FULL | - | |
| Voice playback (speak, auto-speak, player bar) | MessageView "Speak", lib/tts.ts, `active.autoSpeak` | thread.tsx speak, lib/auto-speak.ts, components/voice-player-bar.tsx | FULL | - | |
| Stop teaching / teach capture on the bot computer | Shell.tsx `stopTeaching`, components/teach/* | none | N/A | - | Records a desktop-style computer session. Revisit with the computer area. |
| Browser notifications | lib/browser-notifications | lib/push.ts, live-notifications.ts | FULL | - | Native push replaces them. |
| Pins strip / list | pages/shell/bot-pins.tsx | components/PinsStrip.tsx, app/agent-list.tsx | FULL | - | Covered by another area too. |

### Note: cards without a mobile renderer

Mobile renders these blocks through `blockText` in apps/mobile/lib/api.ts. Email blocks become a plain-text list and charts become "[chart: name]". Finance blocks use `financeCardText` and `skill_draft` blocks list their name, goal and steps, so neither message disappears, but both are plain text.

### Biggest gaps (by user impact)

1. Email, finance and chart blocks have no interactive card on mobile. Email shows as a plain-text list and charts as "[chart: name]", and finance and skill drafts as plain text.
2. Skill draft card is missing, so a taught skill cannot be reviewed, saved, or added to a routine from a phone.
3. Peer messages cannot be opened (chip only), so bot-to-bot work is unreadable on mobile.
4. Group archive and restore, bot and group duplicate, and mark-unread are missing from the mobile chat list (all have existing RPCs, S each); rename space is also missing.
5. Tool activity disclosure and its setting do not exist on mobile (default off on web, so lower urgency), and artifact preview lacks inline PDF.

## Parity: Bots, agents and their work (web/Electron vs Expo mobile)

Sizes: S = UI over existing API, M = UI + small shared logic, L = new API/contract or native module.
Web hosts: apps/web/src/pages/Shell.tsx. Mobile hosts: apps/mobile/app/thread.tsx, index.tsx.

| Feature | Web evidence | Mobile evidence | Status | Size | Notes |
|---|---|---|---|---|---|
| Create bot (name, title, description, computer mode) | pages/shell/dialogs.tsx; Shell `rpc.bots.create` | app/new.tsx, app/index.tsx (`bots/create`, then `onboarding/start`) | FULL | - | |
| Bot picker / switch bot ("To:" search, create bot/group/space) | pages/shell/bot-picker.tsx | app/index.tsx (search field, Create menu: New bot/group/space) | FULL | - | Native list replaces popover. |
| Bot context menu: pin / unpin | pages/BotContextMenu.tsx | components/bot-organize-modal.tsx (long-press row) | FULL | - | |
| Context menu: move to section, new section, rename section | BotContextMenu.tsx | bot-organize-modal.tsx (`botSections/create`, `botSections/update`) | FULL | - | |
| Context menu: silence/resume notifications | bot settings "Notifications" switch (pages/shell/bot-panel.tsx) | bot-organize-modal.tsx (`notifyOnFinish`) | FULL | - | On mobile it lives in the long-press sheet, not settings. |
| Context menu: mark unread/read | BotContextMenu.tsx `onToggleUnread`; Shell `markBotUnread` | none (grep `unread` in app/index.tsx only reads it) | MISSING | S | Existing bot unread API used by Shell. |
| Context menu: duplicate bot | BotContextMenu.tsx; Shell `rpc.bots.duplicate` | none; `bots.duplicate` exists in packages/contracts/src/rpc.ts:371 | MISSING | S | |
| Reorder bots | Shell `rpc.bots.reorder` (drag in sidebar) | none (grep reorder in apps/mobile) | MISSING | M | Contract exists (`ReorderBotsInput`); needs native drag/reorder UI. |
| Clear conversation | BotContextMenu + bot-panel "Clear conversation" | app/thread.tsx botActions (`threads/clear`) | FULL | - | |
| Archive bot | BotContextMenu; Shell `rpc.bots.archive` | app/thread.tsx botActions (`bots/archive`) | FULL | - | |
| Archived list + restore | Shell sidebar "Archived" (listArchived, restore) | app/(settings)/archived-bots.tsx, lib/bot-lifecycle.ts | FULL | - | Also archived groups on web; groups are another area. |
| Delete bot | BotContextMenu; `rpc.bots.remove` | thread.tsx `confirmDeleteBot` (lib/bot-lifecycle.ts) | FULL | - | |
| Bot settings: name, title, description | pages/shell/bot-panel.tsx BotSettings | app/bot-settings.tsx | FULL | - | Mobile syncs instructions with description like web. |
| Bot settings: color | bot-panel.tsx + avatar-studio-popover.tsx | app/bot-settings.tsx color swatches | FULL | - | |
| Avatar Studio: shape picker, image upload/paste, reset | pages/shell/avatar-studio-popover.tsx; packages/contracts/src/bot-avatar.ts (`::shape_N`, data URL) | none; only color (components/bot-avatar.tsx renders shapes/images read-only) | PARTIAL | M | Bot update already accepts shape/image values. Needs shape grid plus image picker/resize to 256 webp. |
| Model and thinking level | bot-panel.tsx (Advanced) | app/bot-settings.tsx (Advanced: Model, Thinking) | FULL | - | |
| Voice and "Read replies aloud" | bot-panel.tsx | app/bot-settings.tsx (server voices, device voice, preview) | FULL | - | |
| Notifications toggle in settings | bot-panel.tsx | in organize sheet instead | FULL | - | Divergence is fine. |
| Memory scope (inherit/isolated/shared) | bot-panel.tsx (only when memory provider configured) | none (grep memoryScope in apps/mobile: no hits) | MISSING | S | `Bot.memoryScope` already in contract; web gates on `memoryProviderConfigured`. |
| Disabled built-in tools | bot-panel.tsx; `isBuiltinToolName` in contracts/src/builtin-tools.ts | none | MISSING | S | Low user impact. |
| Computer mode (team/private) in settings | bot-panel.tsx ComputerModePicker | app/bot-settings.tsx + components/computer-mode-picker.tsx (`bots/setComputer`) | FULL | - | |
| Bot credentials / secrets (add bearer, header, basic, login, command variable; replace; remove) | pages/shell/bot-credentials.tsx; `rpc.botSecrets.list/put/remove` | none (grep secrets/credentials in mobile only finds model credentials) | MISSING | M | Contract in contracts/src/bot-secrets.ts. Secret entry on a phone is plausible; needs form per auth type. |
| Approval rules + Auto Review settings | components/ApprovalRulesSettings.tsx (in AccountSettingsOverlay); `rpc.approvalRules.*`, `rpc.autoReview.*` | none in app/(settings)/*; only runtime approval cards (components/McpApprovalCard.tsx, AskActions.tsx) | MISSING | S | Users can answer approvals but cannot view or revoke "always allow" rules from the phone. Safety relevant. |
| Export bot / conversation | bot-panel.tsx Export | none | MISSING | M | Needs native share of a generated file. |
| Bot panel: Scratchpad (open work, add/complete/park/remove) | pages/ScratchpadSection.tsx; `rpc.scratchpad.*` (contracts rpc.ts:641) | none | MISSING | S | |
| Knowledge: memory documents (view/edit/download) | pages/KnowledgeSection.tsx; `rpc.memory.list/update` | none | MISSING | S | |
| Knowledge: skills (list, create, edit, delete) | KnowledgeSection.tsx; `rpc.agentSkills.*` | none UI; thread.tsx loads `agentSkills/list` only for composer slash suggestions (components/thread-composer.tsx) | PARTIAL | M | Read-only use in composer; no management. |
| Bot page (agent page) view | pages/shell/bot-page-panel.tsx (`rpc.pages.get`) | app/agent-page.tsx, lib/agent-page.ts | PARTIAL | M | Mobile renders markdown and chart SVG read-only. |
| Bot page editing, live remote update, "Page changed. Reload" | bot-page-panel.tsx (tiptap, `rpc.pages.save`) | none | MISSING | L | Rich text editor on native is heavy; a read-only view may be an acceptable explicit divergence. |
| Page charts (render) | shell/page-chart-extension.ts, ChartBlockView | app/agent-page.tsx (`chart` blocks, "Chart could not be drawn.") | FULL | - | Delete-chart action is web only (part of page editing). |
| Inline chart message block in chat | Shell.tsx:7235 `block.kind === "chart"` ChartBlockView | none; only text fallback `[chart: name]` in lib/api.ts:1131 | MISSING | M | Reuse the agent-page SVG chart path (packages/core, lib/agent-page.ts). |
| Pins: stats strip + refresh | shell/bot-pins.tsx PinsStrip | components/PinsStrip.tsx, lib/agent-pins.ts | FULL | - | |
| Pins: checklist list (add, toggle, edit, delete, conflict handling) | bot-pins.tsx PinsList | app/agent-list.tsx, lib/pin-list.ts | FULL | - | Mobile edits item text inline (`onEndEditing` calls `editItem` in app/agent-list.tsx). |
| Board (tickets: list, create, status/priority/owner, comments, live subscribe) | pages/Board.tsx; `rpc.tickets.*`, `rpc.boards.subscribe`; gated by `me.ticketBoardEnabled`; contracts/src/board.ts | none (grep ticket/board in apps/mobile: no hits) | MISSING | M | Feature-flagged on web. |
| Activity list (Now/Recent runs) | pages/ActivityList.tsx; `rpc.runs.list` | app/index.tsx ActivitySection, lib/activity.ts (`runs/list` active + recent) | FULL | - | |
| Activity filters (search, status, from/to bot, date range, reset) | ActivityList.tsx, lib/activity-list-filters.ts | none (only the bell toggle) | PARTIAL | M | |
| Routines list in bot panel, enable/pause, delete | Shell.tsx / pages/RoutineEditor.tsx; `rpc.routines.list/update/remove` | app/routine.tsx read-only detail; list only in composer mentions (thread.tsx:776) | PARTIAL | M | No routine list screen; detail reached from mentions/search. |
| Routine editor: create/edit name and instruction | RoutineEditor.tsx; `routines.create/update` | none (routine.tsx shows prompt read-only) | MISSING | M | |
| Routine triggers: schedule presets/cron, webhook (key, rotate), Git event, Slack/Teams message | RoutineEditor.tsx, RoutineSchedule.tsx; `bots.rotateWebhookSecret` | status line only (lib/routine.ts) | MISSING | L | Schedule picker is shared logic in packages/core `formatCron`; a native schedule UI is new. |
| Routine model/thinking override | RoutineEditor.tsx Advanced | none | MISSING | S | |
| Routine test run / stop | Shell `rpc.routines.testRun`; "Running - Stop" | none | MISSING | S | |
| Routine run history (paged, View chat) | pages/RoutineRunHistory.tsx; `rpc.routines.history` | none | MISSING | S | |
| Cloud computer view (boot, screen, take control, release, "I'm done", full window) | components/computer/ComputerWorkspace.tsx; Shell computer.* | app/computer.tsx, components/ComputerCard.tsx | FULL | - | Native webview of noVNC. |
| Computer keyboard | web: real keyboard input in noVNC | components/computer-keyboard-bar.tsx, lib/computer-keyboard.ts | FULL | - | Mobile adds Ctrl/Tab/Esc/arrow bar. |
| Computer Files app (browse, upload, download, open) | components/computer/FilesApp.tsx; `rpc.computer.files/readFile/uploadFile/downloadFile` | none | MISSING | M | |
| Computer Terminal app (shell, bot activity) | components/computer/TerminalApp.tsx; contracts/src/terminal.ts | none | MISSING | L | Needs terminal emulator in a webview or native; arguably desktop-leaning. |
| Computer maintenance: update, recover, reset | components/ComputerMaintenanceActions.tsx | components/computer-maintenance-actions.tsx (`computer/reset`) | FULL | - | |
| Computer update/recover progress and release | components/ComputerUpdateProgress.tsx | components/computer-update-progress.tsx, lib/computer-updates.ts | FULL | - | |
| Host computer choice ("Where should bots run?", Docker check) | pages/HostComputerPrompt.tsx | none | N/A | - | Local host-machine control exists only with the desktop app. |
| Desktop auto-updates / software update | components/DesktopUpdates.tsx, SoftwareUpdateSection.tsx | lib/app-version.ts (version only) | N/A | - | Electron updater; mobile updates come from the store. |
| Artifacts list: search, bot filter, load more, delete | pages/Artifacts.tsx; `rpc.artifacts.listSpace/remove` | app/artifacts.tsx (search, bot filter, paging, long-press delete) | FULL | - | |
| Artifacts list: date filter, card/list view toggle | Artifacts.tsx ("Filter by date", "Card view", "List view") | none | PARTIAL | S | Cosmetic. |
| Artifact viewer: sandboxed HTML | components/SandboxedHtmlViewer.tsx | components/sandboxed-html-preview.tsx, app/artifact.tsx | FULL | - | |
| Artifact viewer: markdown | Artifacts.tsx | components/markdown-artifact-preview.tsx | FULL | - | |
| Artifact viewer: images | Artifacts.tsx | components/image-artifact-viewer.tsx, app/image.tsx | FULL | - | |
| Artifact viewer: PDF | components/PdfViewer.tsx (iframe) | none; app/artifact.tsx shows "No preview for this file type." (preview kinds: html, markdown, image only) | MISSING | S | Cached local file exists; open with share sheet / system PDF viewer or expo webview. |
| Artifact versions, share/download, delete | Artifacts.tsx "Version", Download, Delete | app/artifact.tsx (Versions, Share, Delete) | FULL | - | |
| Artifact file cards in chat (inline preview, download) | components/ArtifactFileCard.tsx | thread.tsx attachments + components/inline-image-attachment.tsx; opens app/artifact.tsx | FULL | - | |
| Teach flow: record on computer, stop, capture overlay | components/teach/TeachRecordingChrome.tsx, TeachCaptureOverlay.tsx, TeachComputerOverlay.tsx | none | MISSING | L | Needs recording input chain over the mobile computer view (web: teach-computer-input-chain.ts). |
| Skill draft card (review/save taught skill, add routine) | components/teach/SkillDraftCard.tsx; Shell.tsx:7367 | text fallback in `blockText` (`lib/api.ts`) | PARTIAL | M | A taught skill shows as text; review, save and add to routine are missing. |
| Subagent / child bot / cloud agent cards in chat | CloudAgentCard.tsx; Shell.tsx:7145,7183,7352 | thread.tsx:3365,3421,3479 | FULL | - | |
| Tool activity disclosure ("steps") | components/ToolActivityDisclosure.tsx | lib/api.ts text only; no steps UI found in thread.tsx (UNSURE: grep for `steps` in thread.tsx gave only progress hits) | UNSURE | M | Check whether mobile hides tool steps by design. |
| Computer card in chat | Shell.tsx:7374 | components/ComputerCard.tsx | FULL | - | |
| MCP approval card / ask card | shell/message-cards.tsx, AskCard.tsx | components/McpApprovalCard.tsx, AskActions.tsx | FULL | - | Other session may cover; listed for completeness. |

### Biggest gaps

1. Routines are read-only on mobile: no list, create/edit, triggers, test run, or run history, though the API all exists (M to L overall).
2. Approval rules and Auto Review cannot be viewed or revoked on mobile, so "always allow" grants made there cannot be audited (S, safety relevant).
3. Bot credentials/secrets, memory scope, and disabled tools are web-only in bot settings (M).
4. Knowledge, scratchpad, and the ticket Board have no mobile UI; skills are only used for composer suggestions (S each).
5. PDF artifacts show "No preview for this file type" on mobile, and chat chart blocks and skill-draft cards have only a text fallback (S/M).

Also worth planning: Avatar Studio shapes/upload (M), computer Files and Terminal (M/L), Teach (L), bot duplicate/export/mark-unread/reorder (S/M).

## Parity: Inbox, email, finance, integrations, messaging

RPC names below are the web `rpc.<ns>.<method>` calls; mobile only calls `rpc("...")` paths directly (grep of `apps/mobile` found no inbox message mutation (only `inbox/todos/setDone` for to-dos), `finance/*`, `messaging/*`, `externalConversations/*`, `mcp/*` calls).

| Feature | Web evidence | Mobile evidence | Status | Size | Notes |
|---|---|---|---|---|---|
| Inbox list, grouped (Needs reply / Today / Earlier) | `pages/Inbox.tsx` | `app/inbox.tsx`, `lib/mail-inbox.ts` (`inbox/list`), grouping in `@rakazo/core` | FULL | - | Shared `groupInbox`. |
| Inbox sync / refresh | `pages/Inbox.tsx` (`onRefreshed`, polling) | `app/inbox.tsx` pull-to-refresh -> `inbox/refresh` | FULL | - | |
| Account tabs (multi-mailbox) | `pages/Inbox.tsx` `tab` | `app/inbox.tsx` `MenuPicker` "Account" | FULL | - | |
| Search mail | `pages/Inbox.tsx` search form, `/` shortcut | none found in `app/inbox.tsx` | MISSING | S | `inbox/list` already takes query/filter on web (`readInboxListState`); check input schema in `InboxListInput`. |
| Filters (unread, starred, important, attachment, Gmail tabs, triage categories), Important toggle | `pages/Inbox.tsx` L540-625 | none | MISSING | S | Same list API params as search. |
| Load more (Gmail paging for filtered/search lists) | `pages/Inbox.tsx` `loadMore`, `more.token` | none | MISSING | S | Depends on search/filter. |
| Triage badges (Needs attention, Newsletter, Spam, Junk, Suspicious) | `components/inbox/InboxRow.tsx` | `app/inbox.tsx` L364-375 | FULL | - | |
| To-do card (list, complete) | `components/inbox/TodoCard.tsx` (`inbox.todos`) | `app/inbox.tsx` `TodoCard`, `completeMailTodo` (`inbox/todos/setDone`) | PARTIAL | S | Mobile completes only; check web TodoCard for undo/reopen and show-more (`Show less` / `N more`). |
| Row actions: Archive, Mark read/unread, Mark important/noise (feedback) | `components/inbox/InboxRow.tsx` L116-127; `pages/Inbox.tsx` (`inbox.archive`, `inbox.markRead`, `inbox.feedback`, undo status) | none in `app/inbox.tsx` or `lib/mail-inbox.ts` | MISSING | S | Mobile could use native swipe actions or context menu. Opening a message on mobile does not mark it read (UNSURE: server `inbox/get` may do it; not checked). |
| Message view (headers, HTML sandboxed, text) | `components/inbox/InboxMessageDialog.tsx` | `app/inbox-message.tsx` + `components/sandboxed-html-preview.tsx` | FULL | - | Mobile shows from/to/date only; web also shows cc. Minor. |
| Next / previous message | `InboxMessageDialog.tsx` L197-207, `j`/`k` | none | MISSING | S | Low value on touch. |
| Reply, Reply all, Forward | `InboxMessageDialog.tsx` L258-266, `ComposeEmail.tsx` | none; only "Inbox agent" header button opens the agent chat | MISSING | M | Needs a native compose screen. Workaround today: ask the Inbox agent. |
| Archive / mark unread from message view | `InboxMessageDialog.tsx` L271-277 | none | MISSING | S | See row actions. |
| Attachments (list, download) | `InboxMessageDialog.tsx` L304, L352 (`/api/inbox/messages/:id/attachments/:id`) | none in `app/inbox-message.tsx` | MISSING | M | Endpoint exists. Mobile needs authenticated download plus share sheet; `lib/artifact-file.ts` may help. |
| Threads / conversation view | UNSURE: no thread grouping found in `InboxMessageDialog.tsx` (grep "thread" no hits) | n/a | N/A | - | Neither surface shows threads; nothing to match. |
| Labels | UNSURE: no label UI found in web inbox files (grep) | none | N/A | - | Not present on web. |
| Compose new email | `ComposeEmail.tsx` (`inbox.compose`, `.send`, `.draftSave`, `.discard`), `components/compose/RecipientField.tsx`, `RichTextEditor.tsx`, `draft-memory.ts`; Compose button `pages/Inbox.tsx` L626 | none | MISSING | L | Rich editor, recipient field, account picker, draft save are web-only. A plain-text native composer over existing `inbox/compose*` routes would be M. |
| Mail outbox: "Sending... Undo", Sent, draft restore | `components/MailOutbox.tsx`, `lib/outbox.ts` | none for mail. `lib/outbox-disk.ts` / `lib/unsent-sends.ts` are chat unsent-message retry, not mail. | MISSING | M | Follows compose. |
| Send approval for agent-drafted email | `components/EmailCards.tsx` (emails block), `ComposeEmail.tsx` opens seeded draft | `lib/api.ts` L1129 flattens `emails` block to text only (`emailCardsText`); no card component | MISSING | M | Agent email cards render as plain text on mobile; no way to review/edit/send an agent draft. UNSURE how agent drafts are approved server-side (not traced). |
| Emails chat card (list of emails with due buckets, attachments flag) | `components/EmailCards.tsx` | text fallback in `lib/api.ts` only | PARTIAL | S | Block contract `kind: "emails"` in `packages/contracts/src/events.ts` L303. |
| Finance chat card | `components/FinanceCards.tsx` (links to finance pages) | `financeCardText` in `lib/api.ts`, plain text | PARTIAL | M | `kind: "finance"` block, `FinanceCardSchema` in `packages/contracts/src/finance.ts`. Text fallback only. |
| Finance dashboard (cash, burn, runway, spend, crypto KPIs, charts, sync/refresh) | `pages/Finance.tsx` (`finance.overview`) | none | MISSING | L | No finance screen in `apps/mobile/app`. Contracts in `packages/contracts/src/finance.ts` exist; charts need a mobile chart approach. |
| Finance accounts list and account detail (balance series, yield) | `pages/finance/FinanceAccounts.tsx` (`finance.accounts/account/balanceSeries`) | none | MISSING | L | |
| Burn and runway pages | `pages/finance/FinanceBurn.tsx` (`finance.burn/month/runway`) | none | MISSING | L | |
| Spend: categories, vendors, subscriptions/recurring | `pages/finance/FinanceSpend.tsx` | none | MISSING | L | |
| Transaction detail + receipt | `pages/finance/FinanceTransaction.tsx` (`finance.transaction`, `finance.receiptUrl`) | none | MISSING | M | |
| Crypto (wallets, exchanges, history, remove wallet) | `pages/finance/FinanceCrypto.tsx`, `components/finance/WalletDialog.tsx`, `ExchangeGroup.tsx`, `CountCryptoButton.tsx` | none | MISSING | L | |
| Add account, statement import/review | `components/finance/AddAccountDialog.tsx`, `StatementImport.tsx`, `StatementReviewCard.tsx`, `StatementReminderBanner.tsx` (`finance.statementUpload/Confirm/Discard`) | none | MISSING | L | File upload flow. |
| Finance provider connect (Mercury/Brex, Alchemy, Blockscout, exchanges) | `components/integrations/FinanceSection.tsx`, `AlchemyConnectDialog.tsx`, `BlockscoutConnectDialog.tsx`, `ExchangeConnectDialog.tsx`, `lib/finance-connect.ts` | none (no finance section in `app/(settings)/integrations.tsx`) | MISSING | L | |
| Calendar features | no calendar UI in `apps/web/src` (grep) | none | N/A | - | Calendar is only reachable through agents/connectors on both. |
| Integrations list, search, category filter, connected apps | `components/integrations/IntegrationsHome.tsx` (`useIntegrations.ts`) | `app/(settings)/integrations.tsx` (`connections/catalog`, `connections/list`, search "Search apps", Show more) | PARTIAL | S | Mobile has no category filter (web has All/Email & calendar/Chat/Docs/Finance/Developer/Sales). Mobile uses `connections/*` + `capabilities/*` RPCs; web uses `rpc.mcp.*` for custom servers. Same server? UNSURE, not traced. |
| App connect (OAuth via browser, poll complete) | `lib/mcp-connect.ts` (`mcp.oauth.begin`), `pages/GoogleOAuthCallback.tsx`, `McpOAuthCallback.tsx` | `app/(settings)/integrations.tsx` L377-392 (`connections/begin` then `Linking.openURL`, `connections/complete`) | FULL | - | Mobile "Connection pending, finish in browser then refresh" appears only after automatic completion polling (up to 45 tries) gives up; no deep-link callback. |
| Native Google sign-in (Rakazo session) | web Google OAuth callback page | `preferNativeGoogle(catalog, {nativeGoogle:false})` in `integrations.tsx` L236 hides it | N/A | - | Mobile auth browser has no Rakazo session; reason given in code comment. |
| App detail: accounts list, rename, remove, add another | `components/integrations/AppDetail.tsx` | `integrations.tsx` L649-674 | FULL | - | |
| App detail: tools list (read/write grouping) | `AppDetail.tsx` L293-330 | `integrations.tsx` L689-701 (flat list, `connections/tools`) | PARTIAL | S | No read/write grouping on mobile. |
| "Used by": per-agent access to a connection | `AppDetail.tsx` L283, `McpDetail.tsx` L173, `IntegrationsHome.tsx` L88 (`mcp.assignments.*`) | none ("Used by" absent) | MISSING | M | Mobile cannot choose which agents may use a connection. |
| Disconnect/uninstall app | `AppDetail.tsx` L344 | `integrations.tsx` L639 "Uninstall" | FULL | - | |
| Reconnect expired sign-in | `IntegrationsHome.tsx` L116, `useMcpReconnect.ts`, `McpDetail.tsx` L150 | none | MISSING | S | Web reconnects MCP sign-in with `mcp.oauth.begin` and `reauthorize: true`; mobile has no equivalent call yet. |
| Custom connection (remote MCP URL, token) | `CustomConnectionDialog.tsx`, `IntegrationSetup.tsx` (`mcp.servers.create`) | `integrations.tsx` "Advanced" (MCP, GraphQL, OpenAPI, Treg, Executor via `capabilities/install`) | FULL | - | Mobile covers more source types than the web list; different RPC family. |
| MCP server detail: rename, disconnect sign-in, remove | `McpDetail.tsx` | `integrations.tsx` "Tool sources" remove only (L953-967) | PARTIAL | S | No rename or sign-in disconnect. |
| Search integrations.sh directory | `components/integrations/IntegrationSetup.tsx` L299 | none | MISSING | S | |
| Server-level integration setup (Composio / direct MCP credentials) | `pages/IntegrationSetup.tsx`, `components/integrations/IntegrationSetup.tsx` | `app/(settings)/integration-setup.tsx` (client ID, secret, "Get credentials") | PARTIAL | S | Mobile punts "Finish MCP authorization" and Executor setup to the web app via "Open web app". Reasonable degrade, explicit. |
| App connect card in chat | `components/ai` / thread block `app_connect` | `components/AppConnectCard.tsx`, `lib/app-connect.ts`, `app/thread.tsx` L3245 | FULL | - | |
| MCP tool approval card in chat | web thread | `components/McpApprovalCard.tsx` | FULL | - | |
| Messaging channels: link chat apps, unlink | `pages/MessagingSettingsOverlay.tsx` (`messaging.link.start`, `identities.unlink`, `status`) | none (no `messaging/` RPC in mobile) | MISSING | M | Link flow likely opens an external app deep link. |
| Messaging: group channels approve/decline/leave | `MessagingSettingsOverlay.tsx` (`channels.list/respond/leave`) | none | MISSING | S | |
| Messaging: agent connections approve/decline/revoke | `MessagingSettingsOverlay.tsx` (`connections.*`) | none | MISSING | S | Security-relevant approvals only reachable on desktop. |
| External (team) conversation settings per conversation (listen policy, guidance, sender handling, rollup hours) | `pages/ExternalConversationSettings.tsx`, `MessagingSettingsOverlay.tsx` (`externalConversations.updatePolicy`) | none | MISSING | M | |

### Biggest gaps
1. Finance has no mobile surface at all (dashboard, accounts, burn, spend, crypto, transactions, statement import, and the chat finance card is plain text only). L.
2. No way to compose, reply, forward, or send email on mobile; agent email drafts cannot be reviewed or approved, and the mail outbox/undo does not exist. L.
3. Inbox on mobile is read-only: no archive, mark read/unread, important/noise feedback, search, filters, or paging. S each, over existing `inbox/*` APIs.
4. Message view lacks attachments (download/share). M, endpoint exists.
5. Messaging and team-conversation settings (including approve/decline of agent connections and channels) are web-only. M.

Also worth sizing: per-agent "Used by" access for connections (M) and reconnect of expired sign-ins (S).

## Parity: Settings, account and onboarding


Mobile settings live in `app/(settings)/*` plus `app/(settings)/account.tsx` (the Account sheet, reached from the header in `app/index.tsx`). Mobile calls the same RPC namespace as web by string name (for example `rpc("models/list")`), so most gaps below are S.

| Feature | Web evidence | Mobile evidence | Status | Size | Notes |
|---|---|---|---|---|---|
| Sign in (email/password) | pages/Auth.tsx (mode "in"), lib/auth-capabilities.ts | app/sign-in.tsx | FULL | - | Both read /api/auth/capabilities. |
| Sign up | pages/Auth.tsx (mode "up"), App.tsx `/sign-up` | app/sign-in.tsx (mode up) | FULL | - | |
| SSO sign-in | pages/Auth.tsx `signInWithSso`, lib/sso-flow.ts | app/sign-in.tsx `sso()`, lib/sso.ts | FULL | - | |
| Forgot password (request link) | pages/Auth.tsx mode "forgot" | app/sign-in.tsx mode "forgot" | FULL | - | |
| Reset password page (token from emailed link) | pages/Auth.tsx `PasswordResetPage`, route `/reset-password` | none | N/A | - | The emailed link opens in a browser; a native screen is only needed if deep-linking is wanted. UNSURE whether links are meant to open the app (checked app/+native-intent.tsx only by name, not contents). |
| Email verification notice after sign-up | pages/Auth.tsx (`verify=email`, "Check your email") | app/sign-in.tsx `resetSent` shows "Check your email" | UNSURE | - | Mobile shows the message for reset; did not confirm it handles sign-up verification. |
| Server selection (self-host URL) | Desktop: apps/desktop/src/setup-*.{html,js,ts}, pages/LocalSettings.tsx (`LOCAL_SETTINGS_PAGE`); web uses same origin | app/server.tsx, lib/endpoint.ts, "Use a custom server" in sign-in | FULL | - | Different mechanisms, both cover the need. Desktop local stack setup is N/A on mobile. |
| Link SSO to existing account | components/AccountAccess.tsx ("Link SSO") | app/(settings)/account.tsx ("Link SSO") | FULL | - | |
| Change password | pages/AccountSettingsOverlay.tsx `ChangePasswordSection` | app/(settings)/change-password.tsx | FULL | - | |
| Delete account (password or emailed code) | components/AccountAccess.tsx | app/(settings)/account.tsx, lib/delete-account-prompt.ts | FULL | - | |
| Sign out | Shell account menu (UNSURE exact file; not in settings overlay) | account.tsx ("Sign out") | FULL | - | |
| Account name/email display | AccountSettingsOverlay.tsx General | account.tsx | FULL | - | |
| Welcome / landing page | pages/Welcome.tsx (`/`) | app/index.tsx redirects to sign-in when signed out | N/A | - | Marketing-style entry is web only. |
| Onboarding step 1: connect a model (provider, API key, OAuth, OpenAI-compatible URL probe) | pages/Onboarding.tsx (1054 lines), `/onboarding` | none; after sign-in mobile goes to "/" (or `/integration-setup` if `needsSetup`) in sign-in.tsx | MISSING | M | User with no model on a fresh server must use Models settings (exists) but is not guided to it. Existing models.tsx can be reused as the step. |
| Onboarding step 2: server integrations setup | pages/Onboarding.tsx (`nextStepAfterModel`), pages/IntegrationSetup.tsx | app/(settings)/integration-setup.tsx | PARTIAL | S | Mobile has it as a sheet shown after sign-in only when `needsSetup`; OAuth/MCP finish hands off to web ("Open web app"). |
| Onboarding step 3: create first bot + onboarding conversation (`rpc.onboarding.start`, `promptFocus`) | pages/Onboarding.tsx lines ~520-546 | app/new.tsx calls `rpc("onboarding/start")` when creating a bot | PARTIAL | S | Bot creation exists; no first-run flow strings together model, integrations and bot. |
| Subscription gate | components/SubscriptionGate.tsx, lib/billing.ts, App.tsx routes under gate | none (grep for billing/subscription in apps/mobile app/lib/components found nothing) | MISSING | M | If hosted billing is on, mobile users are not blocked and cannot see why runs fail. Needs `rpc billing/status` call and a blocking screen. |
| Paywall (checkout, billing portal) | pages/Paywall.tsx (`rpc.billing.checkout`, `portal`) | none | MISSING | M | App Store policy may require native IAP or a "manage on web" link instead of in-app web checkout; decide before sizing. Could degrade to a message plus open-in-browser. |
| Billing settings (status, renews/ends date, portal) | pages/BillingSettingsPanel.tsx | none | MISSING | S | Shown only if `billingEnabled`. Open portal URL in browser. |
| Usage (runs, tokens) | AccountSettingsOverlay.tsx `UsageSettingsPanel` | account.tsx `usageBlock` | FULL | - | |
| Appearance (system/light/dark) | AccountSettingsOverlay.tsx `AppearancePicker`, lib uses `setUiAppearance` | account.tsx Appearance segmented control, lib/appearance.ts, lib/theme.ts | FULL | - | |
| Sidebar density (comfortable/compact) | AccountSettingsOverlay.tsx, lib/bots-sidebar-density-pref.ts | none | N/A | - | Desktop sidebar preference; mobile uses a list. |
| Language / locale | AccountSettingsOverlay.tsx `UiLocalePicker`, lib/i18n.ts, components/I18nBootstrap.tsx, 10 locales in locales/ | account.tsx Language row, lib/i18n.ts, lib/ui-locale.ts, lib/locales/{de,ru,zh,...} | PARTIAL | S | Web has en, de, es, fr, hi, ko, pt-BR, ru, tr, zh-CN. Mobile `lib/locales` has only de, ru, zh (plus English default); es, fr, hi, ko, pt-BR, tr are missing. Catalogs are separate files from web's .po, so translations are not shared. |
| RTL / UI direction | lib/apply-ui-direction.ts | lib/ui-direction.ts | FULL | - | |
| Avatar style (organic/robot) | AccountSettingsOverlay.tsx | account.tsx, components/avatar-style.tsx | FULL | - | |
| Stream replies toggle | AccountSettingsOverlay.tsx Advanced, lib/response-streaming.ts | account.tsx Advanced, lib/response-streaming.ts | FULL | - | |
| Show tool activity toggle | AccountSettingsOverlay.tsx, lib/tool-activity-preference.ts | none in account.tsx; mobile lib/message-presentation.ts mentions it (UNSURE) | MISSING | S | Pref is local (no API). Web `lib/tool-activity-preference.ts` is the model; ToolActivityDisclosure.tsx is the web renderer. Confirm whether mobile thread renders tool activity at all. |
| Load web images automatically | AccountSettingsOverlay.tsx, lib/remote-images-preference.ts | account.tsx, lib/remote-images-preference.ts | FULL | - | |
| Approval rules / action confirmations (ask before external email, purchases) and Auto Review toggle | components/ApprovalRulesSettings.tsx (`rpc.approvalRules.list/set/remove`, `rpc.autoReview.get/set`) | none in settings (mobile only answers individual approval cards, components/McpApprovalCard.tsx) | MISSING | S | Space-level policy, API exists. Rows plus two switches. |
| AI data sharing / consent management | components/AiDataSharing.tsx, lib/ai-consent.ts | app/(settings)/ai-data-sharing.tsx, lib/ai-data-sharing.ts, lib/ai-consent.ts | FULL | - | Inbox consent prompt on web (AiDataSharing "Let Rakazo sort your mail") not verified on mobile inbox; UNSURE, covered by the inbox area. |
| Models: provider list, search, connect API key | pages/ModelSettingsOverlay.tsx | app/(settings)/models.tsx | FULL | - | |
| Models: OAuth sign-in (browser, code paste) | ModelSettingsOverlay.tsx | models.tsx, lib/model-auth.ts | FULL | - | |
| Models: OpenAI-compatible server URL, probe models, advanced limits (max tokens, context, images, thinking) | ModelSettingsOverlay.tsx, `rpc.models.probeOpenAiCompatible/probeCatalog` | models.tsx ("Find models", limits state) | FULL | - | |
| Models: set default model + thinking level | ModelSettingsOverlay.tsx `rpc.models.setDefault` | models.tsx `models/setDefault` | FULL | - | |
| Models: disconnect provider | ModelSettingsOverlay.tsx | models.tsx `models/disconnect` | FULL | - | |
| Model backups (ordered fallback list, max 10) | pages/ModelBackupsSettings.tsx | models.tsx (`models/backups`, `models/setBackups`), lib/model-backups.ts | FULL | - | |
| Model connection preflight ("Test API key" / "Test sign-in", failure explanations) | components/ModelConnectionPreflightNotice.tsx, lib/model-connection-preflight.ts (client-side outcome mapping) | none (grep "preflight" in apps/mobile finds nothing outside tests) | MISSING | M | Message/outcome mapping lives in web lib, not in packages/; move to a shared package to reuse. |
| Per-bot model override | pages/shell/bot-settings.tsx | app/bot-settings.tsx (`models/list`, `models/credentials`) | FULL | - | Covered by bots area. |
| Memory: provider connect/disconnect (Supermemory, Serenity), default scope isolated/shared | pages/MemorySettingsOverlay.tsx, pages/memory-providers/*, `rpc.memory.connectProvider/disconnectProvider/setDefaultScope` | none (no memory RPC in apps/mobile) | MISSING | M | Provider forms are per-provider React components on web (SupermemorySettingsForm, SerenitySettingsForm); registry in registry.ts. Mobile needs native forms or a generic field-driven form. packages/memory exists for shared logic. |
| Messaging settings: link chat apps, channels approve/decline/leave, agent connections approve/decline/revoke | pages/MessagingSettingsOverlay.tsx (`rpc.messaging.*`) | none (only message rendering of messaging blocks in lib/api.ts `messagingProviderLabel`) | MISSING | M | Shown on web only when `messagingEnabled`. Mostly list rows plus buttons; link flow issues a code (`rpc.messaging.link.start`). |
| Team/external conversation policy | pages/ExternalConversationSettings.tsx, MessagingSettingsOverlay "Team conversations" (`rpc.externalConversations.updatePolicy`) | none | MISSING | S | Part of messaging settings. |
| Voice: provider list, API key connect/disconnect, voice pick, speech model, hear sample | pages/VoiceSettingsOverlay.tsx | app/(settings)/voice.tsx | FULL | - | Mobile adds device voice and call sounds, which web lacks. |
| Voice: dictation | lib/dictation.ts | lib/dictation.ts | FULL | - | |
| Computer settings (sandbox provider setup hint, recheck, copy .env) | AccountSettingsOverlay.tsx `ComputerSettingsPanel`, components/ComputersUnavailableHint.tsx | none in settings; computers shown in app/computer.tsx | PARTIAL | S | Hint is a server-admin diagnostic; mobile could show read-only status. Low priority. |
| Server integrations (deployment owner) | AccountSettingsOverlay.tsx link to `/integrations/setup`, pages/IntegrationSetup.tsx | app/(settings)/integration-setup.tsx, account.tsx row | PARTIAL | S | See onboarding row; MCP/OAuth finish handed to web. Belongs mostly to the integrations area. |
| Software update (server self-update: check, apply, wait for API) | components/SoftwareUpdateSection.tsx (`rpc.updater.check/status/apply`) | none | MISSING | S | Deployment-owner action on the server. Could be N/A on mobile if self-update is considered an admin task done on the web; flag for a product decision. |
| Desktop app update (restart to update) | components/DesktopUpdates.tsx, apps/desktop/src/auto-update.ts | none | N/A | - | Electron auto-update only. Mobile updates through the app stores. |
| Local server settings page (desktop local stack) | pages/LocalSettings.tsx, apps/desktop/src/local-settings.ts | none | N/A | - | Desktop-hosted stack. |
| Window chrome | pages/WindowChrome.tsx | none | N/A | - | Electron title bar. |
| Host computer prompt (control local machine) | pages/HostComputerPrompt.tsx | none | N/A | - | Local machine control, desktop only. |
| Notifications: browser/OS notifications for agent events | lib/browser-notifications.ts (permission request, delivery); Shell.tsx lines ~968-1022 | account.tsx Notifications group (live status, agent messages, scheduled tasks, needs attention), lib/live-notifications.ts, lib/push.ts (`notifications/registerPush`) | PARTIAL | S | Mobile has richer per-category settings (Android promoted/live). Web has no per-category toggles. Direction is mobile ahead; no gap for mobile. Listed for completeness. |
| Archived bots: list, restore, delete | Shell.tsx archived section (`rpc.bots.listArchived`) | app/(settings)/archived-bots.tsx, lib/bot-lifecycle.ts | FULL | - | |
| Archived groups: list, restore | Shell.tsx (`rpc.groups.listArchived`) | none (`groups/listArchived` not found in apps/mobile) | MISSING | S | Archived screen lists bots only. |
| Space create | Shell.tsx `rpc.spaces.create` | app/new-space.tsx | FULL | - | |
| Space rename | Shell.tsx `rpc.spaces.rename` (commitSpaceRename) | none (`spaces/rename` not found) | MISSING | S | |
| Space delete | Shell.tsx `rpc.spaces.remove` | app/index.tsx "Delete space", lib/inbox-spaces.ts `removeInboxSpace` | FULL | - | |

### Web routes and sections not owned by the other three areas

Web route table is `App.tsx`. Items below are not in chat/threads, bots/agents/routines/computers/artifacts, or inbox/finance/integrations, so nothing is dropped.

| Item | Web evidence | Mobile evidence | Status | Size | Notes |
|---|---|---|---|---|---|
| Ticket board (`/app/board`, behind `ticketBoardEnabled` flag) | pages/Board.tsx, lib/bootstrap.ts | none | MISSING | L | Feature-flagged; includes New ticket, ticket status/priority (lib/ticket-status.ts, ticket-priority.ts). Decide if the flag is a shipped product. |
| Space search / command palette | pages/SpaceSearch.tsx, pages/shell/command-palette.tsx | app/index.tsx search, lib/search.ts | FULL | - | Cmd-K hotkey is desktop only. |
| Peer messages overlay (bot-to-bot conversation viewer) | pages/PeerMessagesOverlay.tsx, lib/peer-messages.ts | thread.tsx and lib/api.ts reference "peer" | UNSURE | - | Chat area; checked only by name match. |
| Group panel (group chat members) | pages/GroupPanel.tsx | app/group-settings.tsx, group-thread.tsx, new-group.tsx | FULL | - | Chat area. |
| Activity list | pages/ActivityList.tsx, lib/activity-list-filters.ts | lib/activity.ts, lib/activity-mode.ts | UNSURE | - | Not opened. |
| Error boundary / session unavailable screen | components/ErrorBoundary.tsx, App.tsx `SessionUnavailable` | lib/session.ts, app/_layout.tsx | UNSURE | - | Not compared. |
| Mail outbox (undo send / queued mail) | components/MailOutbox.tsx | lib/outbox-disk.ts (message outbox, not mail) | UNSURE | - | Inbox area. |
| OAuth callbacks (MCP, Google) | pages/McpOAuthCallback.tsx, GoogleOAuthCallback.tsx, `/mcp/oauth/callback`, `/integrations/google/callback` | lib/app-connect.ts, lib/sso.ts | N/A | - | Handled through the system browser on mobile. |
| Knowledge and scratchpad sections | pages/KnowledgeSection.tsx, ScratchpadSection.tsx | UNSURE | UNSURE | - | Bot panel; bots area. |
| Teach / record-a-skill overlays | components/teach/* | none seen | MISSING | L | Computers area; needs a desktop screen recording. Likely N/A. |

### Biggest gaps (by user impact)

1. Subscription gate, paywall and billing settings are absent on mobile. On a billed deployment a mobile user is not told why access fails. Needs a policy choice (in-app checkout vs open web) first.
2. Onboarding has no mobile equivalent. A new user on a fresh server is not guided to connect a model, so the first bot cannot answer.
3. Memory settings (provider connect/disconnect, default scope) are missing; each provider has a React form on web with no native counterpart.
4. Messaging settings (link chat apps, channel and agent-connection approvals, team conversation policy) are missing on mobile.
5. Approval rules and Auto Review (space-level action confirmations) cannot be changed on mobile; API exists, so this is a small UI task. Also missing: model preflight tests, archived groups, space rename, and the "Show tool activity" toggle (all S/M).

## Parity: pages and features added after the first inventory

Added 2026-10-20 from a code read at `origin/main`. Web pages are in `apps/web/src/pages`, components in `apps/web/src/components`. Nothing here was exercised in a running app. Rows are MISSING until a merged change says otherwise.

| Feature | Web evidence | Mobile evidence | Status | Size | Notes |
|---|---|---|---|---|---|
| Legal page | `pages/Legal.tsx`, `pages/legal/` | none in `apps/mobile/app` | MISSING | L | Merged on web only. Ship on mobile or record why not. |
| Cap table page | `pages/CapTable.tsx` | none in `apps/mobile/app` | MISSING | L | Merged on web only. |
| Data room (drive, folders, import, auto-sort, consent) | `pages/DataRoom.tsx`, `components/data-room/` | none in `apps/mobile/app` | MISSING | L | Merged on web only. Mobile work is tracked as #59. |
| Hide amounts toggle | `components/HideAmountsToggle.tsx`, `components/finance/ui.tsx` | none | MISSING | S | Belongs with the finance screens (Phase 7); until then the text fallback of the finance card shows amounts. |
| Spreadsheet preview: sheet tabs and row paging | `components/SheetPreview.tsx` (`spreadsheetPreview` with `sheet`) | none; `app/artifact.tsx` previews html, markdown and image only | MISSING | M | Server reads the file; mobile needs a table view with sheet picker and next-page. |
| PDF preview | `components/PdfViewer.tsx` | none; `app/artifact.tsx` shows "No preview for this file type." | MISSING | S | Same gap as the Artifact viewer: PDF row above. |
| Chart blocks in chat | `ChartBlockView` in `Shell.tsx` | text only: `[chart: name]` in `lib/api.ts` | MISSING | M | Same gap as the Inline chart message block row above. |
| Mail approval: edit before send | `components/MailApprovalCard.tsx` (`MailEdits`, edit then send, Discard denies) | none; mobile answers approvals without editing the draft | MISSING | M | Mobile approval cards cannot change recipients, subject or body. |
| Mark as unread (chat) | `rpc.threads.markUnread` | `threads/markRead` only | MISSING | S | Same gap as the mark-unread rows above. |
| Remember a message to memory | `lib/use-remembered-messages.ts` (`onRemember`) | none in `apps/mobile` | MISSING | S | Mobile has no action that saves an agent message to memory, and shows no remembered state. |
