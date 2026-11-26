# Routines, page watches, check-ins and open items

This describes how unattended bot work behaves after phase 2 of `docs/unattended-bots/PRD.md` (section 4.2). The user-facing pages are `apps/praci-waitlist/src/content/docs/routines.md` and `apps/praci-waitlist/src/content/docs/check-ins.md`.

All routine runs are background runs, so they are read-only: anything that sends, changes or runs something raises an approval card (phase 1, PRD section 4.1).

## Quiet routines

`Routine.quiet` is the "Only message me if something needs me" switch. It defaults to on for watches and check-ins and to off for routines that existed before. When it is on, the server adds the guidance from `quietRoutineGuidance()` (`packages/core/src/quiet-routine.ts`) to the run, which makes the model use the executor's existing silent-reply rule. Users never type the silent word. A run that ends silently is shown as "Nothing to report" in Run history and Activity and is not counted under Finished.

## Page watches

A watch is a routine with `Routine.watch = { kind: "page", url, intervalMinutes }`, validated by `WatchSpecSchema` in `packages/contracts/src/routines.ts`. Valid intervals are 15 minutes, hourly and daily. Per-watch state is in `RoutineWatchState` (one row per routine, scoped by space): fingerprint, snapshot, `lastCheckedAt`, `lastChangedAt`, `consecutiveErrors`, `nextCheckAt`, `pausedReason`, the wake counters and the recent-change ring.

### Probe

The probe never calls a model. `runWatchProbeTick` (`packages/adapters/src/watch-probe.ts`) does this for each due watch:

1. `claimDueWatchChecks` (`packages/db/src/routine-watch.ts`) claims up to 25 due, unpaused watches on active routines with `FOR UPDATE SKIP LOCKED`, and pushes `nextCheckAt` out by a 10 minute lease so a dead worker does not strand a row or double-claim it. Five watches are fetched at a time.
2. `probePage` fetches the URL through `fetchSafeWebText` (`packages/adapters/src/web-ssrf.ts`, the shared SSRF policy) with a 15 second timeout and a 2 MB read cap, then `normalizePageText` (`packages/core/src/watch-diff.ts`) strips scripts, styles and tags and normalizes whitespace.
3. `recordWatchCheck` takes a row lock and applies the result in one transaction.

The fingerprint is the SHA-256 of the whole normalized text. The stored snapshot, which is the diff baseline, is cut to 16 KB. A change that only happens past the first 16 KB is detected by the fingerprint but cannot be shown in a diff.

### Outcomes

| Outcome | What happens |
| --- | --- |
| First check | Stores the baseline. No run, no notification. |
| Unchanged | Updates `lastCheckedAt`. No run is created. |
| Changed, budget available | Creates one unattended run in the same transaction that spends the wake. The prompt is the routine instruction followed by a before/after line diff (at most about 4,000 characters) fenced as untrusted data. |
| Changed, budget spent or a wake already queued or running | Sets `pendingChange` and leaves the snapshot alone, so later changes fold into one diff at the next wake. |
| Fetch error | Increments `consecutiveErrors` and backs off: the interval doubled per consecutive error, capped at 24 hours. After 5 consecutive errors the watch pauses as `errors`. An access failure pauses at once as `access`. |
| Noisy | The page changed on 8 of the last 10 checks (needs 10 checks). The watch pauses as `noisy`. |

Each pause sends one notification of importance `attention`, titled "<routine name> paused: <reason>".

### Limits

All are constants in `packages/core/src/watch-schedule.ts`.

- Minimum interval: 15 minutes.
- Wakes per watch per day: 6, counted in the routine's time zone.
- Watches per bot: 5. Watches per space: 20.
- Watch wakes per space per day: 50. The count is serialized with an advisory lock on the space so that concurrent probes cannot all read the same total.
- Pause after 5 consecutive errors, or 8 changes in the last 10 checks.

The `budget` value exists in `WatchPausedReason`, and the list shows "Paused: too many checks today" for it, but nothing sets it today. A watch that runs out of budget keeps its change pending instead of pausing.

### Resuming and editing

Turning an inactive watch back on calls `resumeWatch`, which clears the pause and the error and change counters, keeps the baseline and checks again now. Creating a watch, or changing its URL or interval, goes through `syncWatchState`, which resets the state to a fresh baseline that is due now. Removing the watch deletes the state row.

### Scheduling: single process and worker

The `watch.probe` job runs the tick. There is one scheduler per mode:

- Worker mode (Graphile): the recurring job `watch.probe` (`packages/adapters/src/wakeup.ts`, `* * * * *`) runs in `apps/worker`.
- Single-process mode (`WAKEUP_DRIVER=memory`, used by `pnpm demo:up`): the job reconciler in `packages/adapters/src/job-reconciler.ts` runs the tick through `runWatchProbes` on its 30 second interval (`apps/api/src/app.ts`).

The claim uses `SKIP LOCKED` and the lease, so an extra tick is harmless.

### Chat tools

`watch_create` (url, intervalMinutes, name, instruction) uses the same approval card as repeating schedules. `schedule_list`, `schedule_update` and `schedule_cancel` cover list, edit and delete. Only a run the owner started may create a watch or schedule (`packages/adapters/src/schedule-tools.ts`); routine and other background runs cannot.

Watch creation on mobile is not built (chat covers it).

### Connected-app watches

`watch_create` also takes `tool` (the exact name of a read-only tool the bot was offered) and `arguments` instead of `url`. The routine's `watch` is `{ kind: "connector", connectorId, connectionId?, resourceId?, toolName, arguments, appName, intervalMinutes }` (`ConnectorWatchSpecSchema`). Only the bot creates one, from chat: the routine create API rejects the kind, the update API accepts it only unchanged, and `schedule_update` refuses to edit it. The editor shows it read-only.

Creation and every check go through `resolveWatchTool` (`packages/adapters/src/watch-connector.ts`): load the bot (not archived, same space and user), load its connections, drop the ones it may not use (`deniedConnectionIds`, agent-linked, not connected), discover the connector's tools with only those connections in the context, and require the named tool with the stored route. The tool must pass `toolRequiresApproval(name, true, readOnly) === false`. Before the provider call the connector runs `connectionDenial` (`connection-denial.ts`, the same function the executor uses) again through `beforeDispatch`.

If the connection is revoked or limited, the tool is gone, or it is no longer a plain read, the watch pauses as "access" with one notification that names the cause, and the tool is not called. The result is fingerprinted as JSON with sorted keys (`stableJsonText`); the snapshot, diff, wake prompt, taint, limits and backoff are the page-watch ones. Tools behind a lazy catalog (more than the direct-tool limit) cannot be watched.

## Check-ins

A bot's check-in setting is its managed routine, `Routine.managedKind = "check_in"`, so `Bot` has no check-in column. At most one exists per bot, enforced by the partial unique index `routines_botId_managedKind_key`. The setting is read and written with `rpc.checkIn.get` and `rpc.checkIn.set` (`apps/api/src/router.ts`).

- Cadences (`packages/core/src/quiet-routine.ts`): Off (no cron, or inactive), Daily (`0 9 * * *`, in the routine's time zone) and Every 4 hours (`0 */4 * * *`).
- The instruction is built in. The executor uses `checkInInstruction()` whatever text is stored: review open items and recent events, finish silently when nothing needs the user, otherwise lead with the one thing that does and send one message.
- A check-in is read-only. A call that would need approval returns "Check-ins only read and report." to the model instead of raising a card (`packages/adapters/src/executor.ts`).
- At most one check-in message per bot per calendar day (the routine's time zone). `checkInPostedToday` and `checkInReplyIsOver` (`packages/adapters/src/check-in.ts`) skip a wake when one was already posted today, and end a reply that would be a second post. A silent run posts nothing and does not use up the day.
- In the Routines list the check-in shows as "Daily check-in" or "Check-in every 4 hours" with only an Active switch. It cannot be opened.

## Open items

`ScratchpadItem` has three fields for this: `dueAt`, `waitingOn` and `resolvedReason`. `dueAt` is separate from `scheduledFor`, which is a GTM post time. The index `(spaceId, botId, status, dueAt)` serves the past-due query.

- `scratchpad_add` and `scratchpad_update` accept the new fields and `scratchpad_complete` accepts a reason. The bot sets them; users change them by chat. The GTM approval gates are unchanged.
- The bot settings panel shows the list under "Open work", with a muted line such as "Waiting on Acme legal · due Fri" (red when `dueAt` has passed). Done items are under a "Done (n)" disclosure with Reopen. Completing an item shows a toast with Undo.
- Past due: the job reconciler calls `notifyPastDueItems` (`packages/adapters/src/past-due.ts`) on every pass. It groups open and parked items with a past `dueAt` by space, user and bot, and creates one notification per bot per day. The dedupe key is `past-due:<botId>:<day>`, where the day is in the owner's time zone. It runs whether or not the bot checks in.

## Source line

A bot message posted by a routine shows "From routine: <name>" above it (`apps/web/src/pages/shell/transcript.tsx`).

## Tests

All offline: `packages/core/src/watch-schedule.test.ts` and `watch-diff.test.ts`, `packages/db/src/routine-watch.postgres.test.ts`, `packages/adapters/src/unattended-p2.test.ts`, `schedule-tools.test.ts` and `executor-readonly-approval.test.ts`.
