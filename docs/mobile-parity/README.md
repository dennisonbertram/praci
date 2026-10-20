# Mobile parity plan

The Expo mobile app covers most of the chat experience but falls behind the desktop app (the web UI, also hosted by Electron) everywhere else. This plan lists the gaps and orders the work to close them. The full evidence is in [inventory.md](inventory.md), which has one table per area with file paths on both sides.

The inventory was built by reading the code at `origin/main` on 2026-10-15. No feature was exercised in a running app, so every row needs a hand check when its work starts.

## Where mobile stands

| Area | Rows | Full | Partial | Missing | N/A | Unsure |
|---|---|---|---|---|---|---|
| Chat and threads | 55 | 37 | 5 | 8 | 5 | 0 |
| Bots, routines, computers, artifacts | 64 | 32 | 6 | 23 | 2 | 1 |
| Inbox, email, finance, integrations | 48 | 11 | 6 | 27 | 4 | 0 |
| Settings, account, onboarding | 66 | 31 | 6 | 15 | 8 | 6 |

Counts are table rows by status. Some rows bundle several actions, so treat them as a rough measure. The areas overlap in places: knowledge, the board and messaging settings each appear twice.

These areas are at parity:

- Chat: composer, attachments, voice calls and playback, reactions, retry and stop, search, and the ask, approval, choice and cloud agent cards.
- Auth, model connections, voice, AI data sharing, archived bots, appearance and avatars.
- Notifications, where mobile is ahead of web.

Most of the gaps fall in five places:

1. **Finance** has no mobile screen at all. A finance card in chat shows only as plain text (`financeCardText` in `apps/mobile/lib/api.ts`).
2. **Email is read-only.** Mobile Inbox reads mail (`inbox/list`, `inbox/get`, `inbox/refresh`, `inbox/agent`) and can complete to-dos, but has no message actions. You cannot archive, mark read or unread, search, filter, open attachments, compose, reply or forward. You also cannot review an email an agent drafted.
3. **Routines** can be viewed but not listed, created, edited, scheduled, test-run or reviewed in run history.
4. **Safety settings are desktop-only.** These cover approval rules and Auto Review, and approving or revoking agent and channel connections in messaging. A user can answer an approval on the phone but cannot see or revoke an "always allow" rule there.
5. **Bot configuration** is missing these on mobile:
   - credentials and secrets
   - memory scope
   - disabled tools
   - knowledge documents and skill management
   - scratchpad
   - the skill draft card (text fallback only)

## Desktop-only by design (no work planned)

These stay off mobile, and mobile should not show them:

- Electron window chrome
- desktop auto-updates
- local server settings
- the host-computer prompt
- sidebar density
- keyboard-only affordances such as ArrowUp history, the command palette and hover rails

## Work plan

Each phase can ship on its own. Within a phase, items touch separate screens and can run in parallel. Sizes follow the inventory:

- **S** is UI over an existing API.
- **M** adds some shared logic.
- **L** needs a new API, contract or native module.

### Phase 1: degrade safely (S)

This is the cheapest phase and matters most for trust, because it stops mobile from hiding content.

- Finance and skill draft blocks now have a text fallback in `blockText`, as email and chart blocks do. Native cards are planned in Phases 5 and 7.
- Add the six missing mobile locales: es, fr, hi, ko, pt-BR and tr. Mobile has de, ru and zh; web has all ten.

### Phase 2: safety controls (S)

- Add approval rules and Auto Review to mobile space settings, so a user can view and revoke "always allow" rules.
- In messaging settings, approve, decline and revoke agent connections, and approve, decline and leave group channels.
- Reconnect an expired integration sign-in Web uses `mcp.oauth.begin` with `reauthorize: true`; mobile needs the same call.
- Add a subscription gate. When hosted billing blocks runs, show why instead of failing silently. The checkout question is under Decisions.

### Phase 3: Inbox actions (S, then M)

1. Add row and message-view actions: archive, mark read or unread, and mark important or noise. Use native swipe actions or a context menu over the existing inbox APIs.
2. Add search, filters and paging, using the same list parameters web sends.
3. Add an attachment list with authenticated download and the share sheet (M).
4. Add a plain-text native composer for reply, reply all, forward and new mail over the existing `inbox/compose*` routes. Also add the outbox's "Sending… Undo" and review-and-send for agent-drafted email (M). How agent drafts are approved on the server is not yet traced; trace it first.

### Phase 4: chat list management (S, with one M)

- Rename a space.
- Duplicate a bot or a group.
- Mark a chat unread.
- Archive and restore groups, and add archived groups to the Archived screen.
- Drag to reorder bots (M). The contract and `reorderBotTo` in `packages/core` already exist, but mobile needs a native reorderable list.

### Phase 5: bot configuration and content (M)

- Add these to bot settings:
  - credentials and secrets, with a form for each auth type
  - memory scope
  - disabled tools
- Add knowledge: view memory documents and manage skills (create, edit, delete).
- Add the scratchpad: add, complete, park and remove open work.
- Add a skill draft card that can review, save and add to a routine. The teach recording itself stays desktop-only.
- Open PDF artifacts in the system viewer or a WebView instead of showing "No preview for this file type".
- Add Avatar Studio shapes and image upload.
- Add a peer message (bot-to-bot) view. Move `peerConversations` and `loadPeerHistory` from `apps/web/src/lib` into `packages/core` first.
- Add the tool activity toggle and a native steps disclosure. Web defaults this off, so it can come last.

### Phase 6: routines (M to L)

1. Add a routine list per bot with enable, pause and delete.
2. Add an editor for name, instruction and the model or thinking override.
3. Add test run and stop, and paged run history with "View chat".
4. Add triggers: schedule presets and cron, webhook key and rotate, Git events, and chat-app messages. This is the largest item. `formatCron` in `packages/core` covers display; the schedule picker UI is new.

### Phase 7: finance (L)

1. Add a native finance card in chat, rendered from `FinanceCardSchema` in `packages/contracts`.
2. Add read-only screens for overview, accounts, burn and runway, spend, transaction detail and crypto. Charts reuse the SVG chart path that agent pages already use on mobile (`lib/agent-page.ts`).
3. Add provider connect, add account and statement import last. These need file upload and provider flows.

### Phase 8: onboarding and remaining settings (M)

- Add a first-run flow: connect a model, then set up integrations, then create the first bot. It reuses the existing Models screen and bot creation.
- Move the model connection preflight ("Test API key", "Test sign-in" and their failure messages) from `apps/web/src/lib` to a shared package, then show it on mobile.
- Add memory provider settings (Supermemory, Serenity) and the default scope. These need native forms for each provider.
- Add per-agent "Used by" access for a connection, MCP rename and sign-in disconnect, and the integrations category filter.
- Add external (team) conversation settings.

### Not yet built anywhere

The Legal page, Cap table page and Data room (epic #61) are merged on web with no mobile screen. Mobile Data room work is tracked as #59. Hide amounts, spreadsheet sheet paging, PDF preview, chart blocks in chat, mail approval editing and remembering a message are also web-only. All of them are rows at the end of [inventory.md](inventory.md) and follow the same rule: ship on both surfaces, or say why not.

## Decisions needed

These change what gets built, so they need an answer before the related phase starts:

1. **Billing on iOS.** App Store rules may forbid in-app web checkout for a hosted subscription. The choices are native in-app purchase, or a "Manage on the web" link with no purchase in the app. This is needed before Phase 2's gate can say what to do next.
2. **Bot page editing.** Rich-text editing on native is heavy. Should mobile stay read-only for agent pages as an explicit divergence?
3. **Computer Terminal and Files apps.** Files on mobile is plausible (M). A terminal on a phone is low value; should it be marked desktop-only?
4. **Ticket board.** It sits behind a feature flag on web. Build it for mobile only once the flag ships.
5. **Server software update.** This is a deployment-owner task. Should it stay web-only?

## Not checked

The inventory left a few things untraced. Settle each when its phase starts:

- whether opening a message on mobile marks it read on the server
- whether mobile's `connections/*` calls and web's `mcp.*` calls reach the same backend
- whether mobile handles the email verification notice after sign-up
- whether mobile hides tool steps on purpose
- the error and session-unavailable screens
