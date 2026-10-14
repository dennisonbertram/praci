# 06 — Inbox agent panel

## Goal

On `/app/inbox`, the right side of the screen shows the Inbox agent's thread.
The Inbox agent is an ordinary bot: it appears in the roster, and opening it
from the roster shows the same thread in the main pane.

- The panel uses the existing `Transcript` and `Composer` with no visual
  changes. Chat will be redesigned globally later, so this item adds no chat
  styling of its own.
- The panel has a collapse button in its header. The collapsed state persists
  per user. When collapsed, a button in the Inbox header reopens it.
- The panel is resizable through the existing `ResizableSidePanel`.
- If no Inbox agent exists, the panel shows one action that creates it.

Out of scope: the Inbox page body (To do card, mail list, account tabs), the
mail tools the agent calls, and the agent's instructions. Other items own
those. This item's PR 1 adds the `/app/inbox` route through `ShellPage` (see
"Recommendation" below for why) with an empty main pane; item 4 PR 2 fills that pane
with the Inbox page, and this item's PR 2 adds the panel after it. Item 3 owns the Inbox agent's identity, fields and its only creation path,
`inbox.agent`.

## Recommendation: Inbox is a `ShellPage` mode, not a separate page with an extracted `<BotThread>`

I recommend against extracting a reusable `<BotThread botId>` for this item.
Instead, `/app/inbox` renders `ShellPage`, which treats the Inbox agent as its
active bot and places the existing transcript and composer in the right-hand
panel instead of the main pane. The main pane shows the Inbox page.

### Why not extract `<BotThread>`

`Transcript` itself is easy to move: it is a memo component with 28 props and
no access to `ShellPage` state. The difficulty is everything that feeds it.
The thread state in `ShellPage` (`apps/web/src/pages/Shell.tsx`) is shared
with unrelated features:

| Thread concern | What else it touches inside `ShellPage` |
| --- | --- |
| `snapshot` / `snapshotRef` / `commitSnapshot` / `updateSnapshot` | Group threads use the same snapshot; `withLiveStreamingProgress` reads the streaming preference |
| `refreshThread(id)` | Commits `computer` state and `computerCacheRef`, loads routines, taught skills and the computer screen, guards on `activeBotId`, `historyEpoch`, `threadRefreshEpoch`, `expandedHistoryThread` |
| Subscription effect (`runThreadSubscription` for `active.id`) | `bootstrappedThread` priming, `?m=` search jumps (`pinnedAroundRef`), `terminalRunReceipts`, browser notifications, `refreshBots`, `markBotReadIfVisible`, computer status events |
| `sendMessage` | Pending attachments keyed by thread, reply target and quote, rerouting a send to a group via mentions, `sending`/`sendError` |
| `loadOlderMessages`, `answerMessage`, `reactToMessage`, `jumpToReplyMessage`, `stopRun` | Scroll pinning refs, history epochs, run receipts |
| Derived values (`activeSnapshot`, `transcriptMessages`, `workingBots`, `answerableAskMessageId`, `composerMentionTargets`, run error display) | Bots and groups lists, mention routines and connectors, dismissed run errors |
| `onOpenComputer`, `onAddRoutine`, `onBotChanged`, `onOpenPeerMessages`, `onSpeak` | Computer overlay, routine editor panel, roster refresh, peer messages overlay, voice |

Moving this into a `useBotThread` hook means either duplicating the computer,
routine, skill and roster side effects, or threading about 20 callbacks back
into `ShellPage`. Both carry a high regression risk in the app's most-used
screen, and the hook would have exactly two callers that never run at the
same time.

### Why a mode works

The sidebar already lives inside `ShellPage`, and the product decision is that
clicking "Inbox" opens the Inbox page in the main pane next to that sidebar.
So `/app/inbox` has to render `ShellPage` (or duplicate the sidebar) whatever
we decide here. Once it does, the Inbox agent is just the active bot: every
hook, subscription, approval card, attachment and streaming path above runs
unchanged. The only new work is choosing the active bot differently and
rendering the same JSX in a different container.

Only one bot thread is shown at a time in this design, which matches how
`ShellPage` already works (one `snapshot`). If a later feature needs two live
threads on screen at once, that is the point to extract a hook.

## Implementation plan

### PR 1 — Inbox route and Shell preparation (no linked UI)

`/app/inbox` already renders `ShellPage` today, through `/app/:botId`
(`App.tsx:181`) with `"inbox"` taken as a bot id. So any guard keyed on
`useMatch("/app/inbox")` is live the moment it merges. This PR therefore owns the
route and tests it, instead of claiming the guards are inert.

Changes are in `apps/web/src/App.tsx` (one route) and `apps/web/src/pages/Shell.tsx`.

1. Move the thread JSX into one local element. Today the main pane renders,
   in order: `Transcript` (around the `<Transcript key={activeSnapshot?.threadId} …>`
   block), the "Teaching in progress" notice, and `Composer`. Assign these
   three to `const threadView = (<>…</>)` defined right before `return`, and
   render `{threadView}` in the same place. No props change. The "Create new
   Bot" empty-state branch stays where it is.
2. Add `<Route path="/app/inbox" element={<ShellPage />} />` before `/app/:botId`
   in `App.tsx`, and a mode flag next to `inGroup`:
   `const inboxMode = useMatch("/app/inbox") != null;` (`useMatch` from
   `react-router-dom`, already imported in `Shell.tsx`). In inbox mode the main pane
   renders an empty `<main>` (no bot header, `threadView` or "Create new Bot" state);
   item 4 PR 2 puts the Inbox page there. Nothing links to `/app/inbox` until item 4
   PR 2 adds the sidebar row, so users see no change.
3. Guard the three places that would otherwise fight the Inbox route:
   - Bootstrap redirect: the `selectedBotId !== botId` branch calls
     `navigate(\`/app/${selectedBotId}\`)` when the URL has no bot id. Skip it
     when `inboxMode`.
   - Active bot fallback: `active` falls back to `bots[0]`. In inbox mode it
     must resolve to the Inbox agent or `undefined`, never `bots[0]`.
   - `shellReady`: in inbox mode, treat "no Inbox agent" as ready
     (`bots.length === 0 || !active || Boolean(active && activeSnapshot)`),
     so `data-ready` and the renderer marks still fire.

Step 1 is a pure JSX move. Steps 2 and 3 only change behaviour on `/app/inbox`,
which no UI links to yet. PR 1 adds a regression test for that path (see
"Preventing regressions").

### PR 2 — Inbox agent resolution and the panel

1. **Resolve the Inbox agent** in a new `apps/web/src/lib/inbox-agent.ts`:

   ```ts
   import { inboxAgentSpawnKey } from "@rakazo/contracts";
   export function findInboxAgent(bots: readonly Bot[], userId: string): Bot | undefined {
     const key = inboxAgentSpawnKey(userId); // "inbox-agent:<userId>"
     return bots.find((bot) => bot.spawnKey === key);
   }
   ```

   `spawnKey` already exists on `Bot` and is unique per space. The key includes
   the user id because a space has several members, each with their own Inbox
   agent; matching another member's bot would show their thread. The helper comes
   from item 4 PR 1, so the string is written in one place. Archived bots are not
   in `bots`, so archiving the agent shows the create action again; item 3's
   `inbox.agent` then creates a fresh bot (`repos.createBot` frees the key from
   the archived one).

   In `ShellPage`: when `inboxMode`, `active = findInboxAgent(bots, userId)`.
   Bootstrap is called with `botId: undefined` in inbox mode, so its primed
   thread may belong to another bot; the existing subscription effect already
   handles that (`primed?.botId === active.id` fails, so it calls
   `refreshThread`). That costs one extra `threads.get` on first load, which
   is acceptable.

2. **Create action when none exists.** The panel body shows one `Button`
   ("Create Inbox agent") that calls `rpc.inbox.agent()` (item 3's
   `ensureInboxAgent`, the only creation path) and then `refreshBots()`. The
   server takes the user and space from the session and sets the name,
   description and instructions; the client sends nothing. A double click, a
   second tab, or two requests on different API processes are safe because the
   unique `(spaceId, spawnKey)` index decides and `createBot` returns the
   existing bot on conflict.

3. **Render the panel.** In inbox mode:
   - The main pane renders the Inbox page component (owned by item 4)
     instead of the bot header and `threadView`.
   - The existing `ResizableSidePanel` renders with
     `open={!inboxAgentCollapsed}` and `panel="inbox-agent"`, and its child is
     a small header plus `threadView` (or the create action). The bot
     settings/computer panel content is not rendered in inbox mode; the
     agent's settings and computer are reached by opening the agent from the
     roster, like any other bot.
   - Header: `BotAvatar` and bot name (matching the mockup), and an icon
     button with `aria-label` "Collapse Inbox agent" (`PanelRightClose` from
     `lucide-react`). The name and avatar link to `/app/<agentId>`.
   - The panel container must be a flex column with `min-h-0`, so
     `Transcript` scrolls and `Composer` stays at the bottom. The existing side
     panel wrapper uses `overflow-y-auto` with padding for settings; inbox mode
     uses its own wrapper without padding so the chat looks the same as in the
     main pane.
   - Slash action "chat-settings" in inbox mode navigates to
     `/app/<agentId>` and opens settings there, instead of opening a settings
     panel that inbox mode does not render.

4. **Collapse and reopen.**
   - State: `inboxAgentCollapsed` in `ShellPage`, read on `userId` change
     like `botsSidebarCollapsed`.
   - Persistence key: `rakazo:inbox-agent-collapsed:<userId>`, value `"1"`
     when collapsed, removed when open. Add `readInboxAgentCollapsed` and
     `writeInboxAgentCollapsed` to `apps/web/src/lib/bots-sidebar-pref.ts`
     by giving its two helpers a key-prefix parameter, rather than copying
     the file.
   - Default when nothing is stored: open on desktop, collapsed below the
     `md` breakpoint, because on phones `ResizableSidePanel` covers the main
     pane.
   - Reopen: when collapsed, the Inbox page header shows an icon button
     (`PanelRightOpen`, `aria-label` "Show Inbox agent"), the same pattern as
     `restore-bots-sidebar`. Item 4 owns that header, so it takes an
     `agentControl` slot or `onShowAgent` prop from `ShellPage`.
   - Collapsing does not stop the thread subscription, so unread state and
     notifications behave like any open bot.

5. **Resize.** No change to `ResizableSidePanel`. It already persists width
   under `rakazo:right-panel-width` and clamps against the bots sidebar width.
   Sharing that width with the bot settings and computer panels is
   intentional: one right-panel width preference for the whole app.

6. **Roster highlight.** In inbox mode, the roster must not mark the Inbox
   agent row as selected (`aria-current="page"`), because the Inbox item is
   the current page. Change the `selected` expression to require
   `!inboxMode`. The sidebar Inbox row itself is owned by item 4.

7. **Copy added** (for the PR description, per the repository rule):
   "Create Inbox agent" (needed: the only action when no agent exists),
   "Collapse Inbox agent" and "Show Inbox agent" (accessible names for icon
   buttons; not visible text). The default bot name "Inbox agent" is user data,
   not UI copy. Run `pnpm --filter @rakazo/web intl:extract` so all locale
   catalogs get the new strings.

### Optional, not in these PRs: give the agent the selected email

Selecting an email does nothing to the agent in this plan. The agent finds
mail through its own tools, and the user can name the email in plain words.
If testing shows that is not enough, the smallest follow-up is an "Ask about
this email" action on the reading view that prefills the composer with a
reference such as `Re: <subject> (message <id>)`. That needs a new
`Composer` prop for an external draft insert, which is why it is deferred.

## Preventing regressions in `ShellPage`

Existing tests to run for PR 1 and PR 2:

- `pnpm --filter @rakazo/web test` (vitest), especially
  `apps/web/src/pages/Shell.test.tsx` (`Composer` send/restore behaviour) and
  `apps/web/src/lib/bots-sidebar-pref.test.ts`.
- `pnpm --filter @rakazo/web check` (TypeScript).
- Web E2E in CI (not locally on a maintainer's machine for the desktop
  suite). The specs most likely to catch a broken thread or panel:
  `bot-crud`, `response-streaming`, `chat-progress-messages`, `approval-resume`,
  `consequential-approval`, `message-jump`, `message-quote`,
  `composer-send-failure`, `composer-paste`, `resizable-side-panel`,
  `right-panel-state`, `group-chats`, `golden`.

PR 1 adds one E2E spec, `apps/web/e2e/inbox-route.spec.ts`, because its guards
are live on `/app/inbox` as soon as it merges: sign up with one bot, open
`/app/inbox`; the URL stays `/app/inbox` (bootstrap redirect guard), no bot's
transcript or composer renders (`bots[0]` fallback guard), and the shell reaches
`data-ready` (`shellReady` guard). Then open `/app/<botId>` and check that the bot's
thread renders as before. The existing suites above cover the moved JSX.

New tests in PR 2:

- Unit: `findInboxAgent` returns the bot with this user's spawn key, ignores a
  bot merely named "Inbox agent", and ignores another member's Inbox agent in
  the same space. Extend `bots-sidebar-pref.test.ts` for the new
  key (read/write/remove, and a different user id does not share state).
- E2E `apps/web/e2e/inbox-agent-panel.spec.ts`:
  1. Sign up and complete onboarding (existing helpers), go to `/app/inbox`;
     the URL stays `/app/inbox` (catches the bootstrap redirect).
  2. The panel shows "Create Inbox agent"; click it; the agent appears in the
     roster and the panel shows its empty thread with a composer.
  3. Send a message (emulated model, as in `response-streaming`); the reply
     renders in the panel.
  4. Collapse; the panel width is 0 and "Show Inbox agent" is visible;
     reload; still collapsed; reopen.
  5. Drag the resize separator; width persists across reload (same assertion
     shape as `resizable-side-panel.spec.ts`).
  6. Open the agent from the roster; the same message is in the main-pane
     thread (proves it is an ordinary bot thread).
  7. `captureScreenshot` of `/app/inbox` with the panel open, linked from the
     PR as the CI screenshot.

## Risks

- **Bootstrap redirect and `bots[0]` fallback.** If either guard is missed,
  `/app/inbox` redirects to a bot or shows the wrong bot's thread in the
  panel. Covered by PR 1's `inbox-route.spec.ts` and by PR 2's E2E steps 1 and 2.
- **Panel state persistence.** `ShellPage` restores and writes the right-panel
  state per bot (`rightPanelStorageKey`). In inbox mode `panel` is not used
  for the agent panel; the restore effect must not open the agent's saved
  "computer" or "settings" panel into the Inbox. Skip the restore and write
  effects when `inboxMode`.
- **Search jump `?m=`.** A search hit on the Inbox agent's thread navigates to
  `/app/<agentId>?m=…` (the bot page), which is correct. Item 4 keeps its open
  mail message in `?mail=`, not `?m=`, because in inbox mode `ShellPage` would
  read `?m=` as a jump inside the agent's thread.
- **Mobile.** The panel covers the Inbox list when open on phones; defaulting
  to collapsed below `md` avoids that on first visit. The mobile Expo app has
  its own Inbox surface; this item is web and desktop only (desktop hosts the
  web UI).
- **Shell.tsx size.** This adds a mode to a 7,000-line component. The added
  surface is small (one flag, a few guards, one panel branch), but it is a
  reason to extract a thread hook later if a second simultaneous thread is
  ever needed.

## PR breakdown

1. **Shell: Inbox route and mode.** The `/app/inbox` route (before
   `/app/:botId`) with an empty inbox-mode main pane; JSX moved into
   `threadView`; `inboxMode` flag; bootstrap redirect, `bots[0]` fallback,
   `shellReady` and right-panel-restore guards; `inbox-route.spec.ts`. No new
   copy and no link to the route.
2. **Inbox agent panel.** `inbox-agent.ts`, collapse preference, panel render,
   create action, roster-highlight guard, locale extraction, unit tests, the
   new E2E spec and screenshot. Depends on PR 1, item 3 PR 2 (`inbox.agent`),
   and item 4 PR 2 (the Inbox page in the main pane and its header slot).
