# Notifications and sidebar glance values

Status: plan, approved direction; no code yet. Built after agent per connection (`docs/plans/agent-per-connection.md`). Line numbers refer to `main` when written.

## Goal

Agents, especially when running routines, can tell the user that something is genuinely new. It shows as a dot on the sidebar item, a toast from the top while the user is in the app, and a browser, desktop or phone notification when they're away. Delivery goes through one channel interface so Slack, iMessage and email can be added later. The sidebar collapses to an icon rail that keeps the dots, and each page item shows a small glance value on the right.

Owner answers:

| Question | Answer |
|---|---|
| Importance | `info` puts a dot on the sidebar item. `attention` also shows the toast in the app, or an OS/phone notification when the user is away. |
| History list (bell) | Not in v1. Dots clear when the page is opened; the API keeps the list for later. |
| Collapsed sidebar | Icon rail with dots; replaces today's hide-completely button on desktop widths. |
| Glance values | Inbox: unread count (exists). Finance: runway by default (could also be revenue), hidden when Hide money is on. Legal: deadlines due in the next 7 days. Data room: items waiting on the user. Cap table and Artifacts: nothing unless notified. |

## What exists

| Area | Fact |
|---|---|
| Browser notifications | `apps/web/src/pages/Shell.tsx:1086-1149` and `apps/web/src/lib/browser-notifications.ts`: client-side `new Notification(...)` for finish, help and takeover, only while a tab is open. |
| Preferences | `NotificationPreference` (`packages/db/prisma/schema.prisma:1255`): per space and user, booleans `finish`, `help`, `takeover`. |
| Unread | `Thread.unread` drives agent-row dots; the Inbox count is the mail cache's unread count (`rpc.inbox.unreadCount`). |
| Mobile push | Exists: `apps/mobile/lib/push.ts`, `notifications/registerPush` (`router.ts:7063`), `packages/adapters/src/expo-push.ts`, `NotificationProvider` in `packages/adapter-kit/src/interfaces.ts:439`. Push tokens are saved to files on local disk, which breaks with several API processes and must move to Postgres. |
| Electron | Hosts the web UI and already grants the notifications permission (`apps/desktop/src/session-permissions.ts`). |
| Toast | None in `packages/ui-web`. |
| Realtime | Postgres LISTEN/NOTIFY (`packages/adapters/src/realtime.ts`), consumed through oRPC event streams per thread or board. No per-user stream yet. |
| Agent tools | `packages/adapters/src/builtin-tools.ts`, dispatched in `executor.ts`. |
| Routines | `Routine` (`schema.prisma:797`) has `notify`, run by the worker (graphile-worker). |
| Sidebar collapse | Full hide and show (`Shell.tsx:3677`, `:4605`), stored per device in `apps/web/src/lib/bots-sidebar-pref.ts`. Docking from 1024 px is on the unmerged branch `ux-visual/shell` (VIS-01, #168); the rail builds on it. |

## Data

- `Notification`: `spaceId`, `userId`, `botId?`, `routineId?`, `runId?`, `surface` (page key such as `inbox`, `finance`, `legal`, `data-room`, or `thread` with `threadId`), `title` (≤80), `body?` (≤200), `link?` (in-app path only), `importance` (`info` | `attention`), `dedupeKey`, `createdAt`, `seenAt?`. Unique on `(spaceId, userId, botId, dedupeKey)`; indexed for unseen counts and recency.
- `NotificationDelivery`: outbox row per notification and external channel (`pending`, `sent`, `failed`, `skipped`; attempts, next attempt, last error).
- `NotificationEndpoint`: per-device or per-account addresses (Expo token now; Slack and others later). Replaces the on-disk push tokens.
- No second unread system: thread notifications reuse `Thread.unread`; page dots count unseen notifications per surface; opening a page marks that surface seen.
- Retention: notifications 30 days, deliveries 7 days, by a worker job.

## Agent tool: `notify_user`

- Arguments: `title`, `body?`, `surface?` (defaults to the agent's own page, else its thread), `importance?` (default `info`), `dedupeKey?` (default: hash of surface and title).
- Model-facing description: "Notify the user that something genuinely new needs their attention. Do not notify for routine runs, unchanged results, or things already reported. Use attention only when the user should act soon."
- Server-side guardrails: the recipient is the run's own space and user; dedupe within 24 hours; rate limits counted in Postgres (per agent and user: 5 per hour, 20 per day, 2 `attention` per hour; tune from data); `link` must be an in-app path; title and body rendered as plain text. `Routine.notify = false` and category preferences suppress external delivery.
- No approval card: it only informs the owner, and limits bound abuse.

## Delivery

1. `createNotification()` inserts the notification and one pending delivery per enabled external channel in one transaction.
2. After commit, publish `{id, surface, importance}` on a per-user realtime topic; clients fetch by id. A reconnecting client calls `notifications.list({since})`; the table is the source of truth.
3. A worker job claims pending deliveries with `FOR UPDATE SKIP LOCKED`, sends through the channel adapter with the notification id as an idempotency key, and retries with backoff (max 5).
4. Channel interface: evolve `NotificationProvider` into `NotificationChannel { describe(); send(envelope, endpoint, ctx) }`. Expo push becomes the first channel. Slack, iMessage and email are later adapters with a shared offline conformance suite in `packages/testkit`. Today's finish, help and takeover notifications move onto the same pipeline.
5. Preferences: extend `NotificationPreference` with per-channel settings instead of a new table.

## UI

- **Toast**: one `NotificationToaster` in `packages/ui-web`, story first. Use Base UI Toast if the installed version has it, otherwise shadcn `sonner` from the official registry. Slides down from the top, at most 3 stacked (the rest collapse to "+N"), `attention` only (per the importance answer), stays until dismissed, click opens the link and marks it seen. Monochrome, with the warning colour for `attention`.
- **Away vs present**: one `shouldToast()` rule. If the app is visible and focused, show a toast. Otherwise send an OS notification (web Notification API, which also covers Electron), tagged with the notification id so several tabs don't duplicate it. Permission is requested the first time an `attention` notification arrives.
- **Sidebar right side**: one slot per page item. It shows a dot for unseen notifications on that surface, otherwise the page's glance value: Inbox unread count; Finance runway (for example "24 mo"), hidden when Hide money is on, with revenue as an alternative setting later; Legal deadlines due within 7 days; Data room items waiting on the user; nothing for Cap table and Artifacts. Glance values come from one server query per space, not from each page's full load.
- **Rail**: on widths from 1024 px (after VIS-01), collapsing gives an icon rail with avatars and dots; labels become tooltips. The drawer stays below 1024 px. The stored preference migrates from hidden to rail. A keyboard shortcut is left open (no shortcut convention exists yet).
- **New copy**: none beyond tooltips that reuse existing sidebar strings, the "+N" count, the runway format (for example "24 mo"), and channel names in settings ("Browser", "Phone"). Notification text is written by agents.
- **Mobile**: push exists. Add a foreground handler so notifications show as the native banner while the app is open, plus row badges. No rail or toast on mobile.

## Risks and open items

- Rate-limit numbers are guesses; tune from data.
- Moving push tokens to Postgres: devices re-register on next launch; no data migration.
- The rail depends on VIS-01 landing first.
- Realtime payloads stay small (ids only) to stay under the LISTEN/NOTIFY size cap.
- Quiet hours, per-agent mute and the history list are deferred.
- Which revenue figure Finance would show (MRR, last month) is TBD if revenue is picked.

## Tests (offline)

- Postgres: create, dedupe, rate limits, cross-user and cross-space isolation, concurrent double calls, outbox claim by two workers (exactly one sends), retry and retention.
- Channel conformance suite with a fake transport.
- RPC authorization for list and mark-seen.
- Web: `shouldToast()` matrix, toast stacking, dot clearing on page open, glance values (including Hide money), rail preference migration, tag dedupe; stories and the Storybook smoke check.
- Mobile: foreground handler and routing.
- Manual: a real routine on the demo stack calls `notify_user`, watched end to end in the browser.

## PRs, in order

1. Schema and domain: `Notification`, `NotificationDelivery`, `NotificationEndpoint`, preference channels, create with dedupe and rate limits.
2. Push tokens to Postgres.
3. `notify_user`, `notifications.list/markSeen/subscribe`, realtime topic, outbox worker, push channel.
4. Toast and the away/present rule.
5. Sidebar right-side slot: dots and glance values.
6. Move finish, help and takeover onto the pipeline.
7. Icon rail (after VIS-01).
8. Mobile foreground banners and badges.
9. Settings: per-channel switches.
10. Later, one PR per external channel (Slack, iMessage, email).
