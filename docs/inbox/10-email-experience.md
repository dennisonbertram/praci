# Email experience plan

Status: proposal. Nothing here is built yet unless it says so.

## Goal

Make Rakazo's Inbox the fastest, cleanest way to get through Gmail: the list opens
instantly, noise (spam, newsletters, promotions, notifications) is grouped and cleared
in a few keystrokes, each row says what the mail is about, and Gmail stays in sync with
what Rakazo decided.

## What we have today

Checked against the code on main (October 2026):

- Mail reaches Rakazo through `MailProvider` (`packages/adapter-kit/src/interfaces.ts`)
  and one Gmail adapter (`packages/adapters/src/gmail-mail-provider.ts`) shared by the
  Composio, Pipedream and native Google connections.
- `inbox.list` reads the Postgres cache. Sync (`packages/adapters/src/mail-sync.ts`)
  runs inside the request from three callers: `inbox.refresh` (`apps/api/src/inbox.ts`,
  called by the web page on mount and every 60 seconds while visible), the agent's
  inbox overview (`packages/adapters/src/inbox-overview.ts`), and sync after send. It
  uses the Gmail history cursor, covers 14 days and at most 200 inbox plus 200 sent
  messages, drops messages labelled `SPAM` or `TRASH`, and prunes older rows. There is
  no Gmail push.
- `mail_messages` stores From, To, Cc, Subject, date, snippet and a few flags (in
  inbox, from self, unread). It stores no Gmail labels, no other headers and no body.
- Background triage (`packages/adapters/src/inbox-triage.ts`) gives each message one
  of 14 categories, a priority, needs-reply, a one-line reason and an optional to-do,
  from metadata and a 500-character snippet. An optional first-pass classifier
  (TypeSafe) can label messages before the user's model. Triage needs a usable model
  and AI-data consent; without them it skips, and the category and Important views
  are disabled. Nothing is written back to Gmail.
- The web Inbox has seven category views, an Important view, archive with undo, mark
  read, per-sender important/noise marks, keyboard shortcuts and message prefetch. The
  Filter menu and search read Gmail live, 50 per account per page.
- Missing: multi-select and bulk actions, sender grouping, unsubscribe, trash, spam,
  star, snooze, label creation, Gmail filters, push sync. The agent's `mail_modify`
  deliberately refuses `TRASH` and `SPAM`. Mobile can read mail and complete to-dos but
  has no mail actions.

## What the best clients do

Sources: Inbox Zero source code (github.com/elie222/inbox-zero), an earlier private
Gmail assistant prototype, official pages for Gmail, HEY, Superhuman, Shortwave,
Notion Mail, Spark and Apple Mail, Google's Gmail API documentation, and RFC 8058.

| Pattern | Who does it | Take for Rakazo |
| --- | --- | --- |
| Sender-level decisions cached before any model call | Inbox Zero (learned patterns), HEY (Screener) | Yes: decide per sender once, reuse, model last |
| Ranked sender list with one-click unsubscribe | Gmail Manage Subscriptions (July 2025), Inbox Zero bulk unsubscriber | Yes: the core of fast cleanup |
| Inbox split into a few fixed piles | HEY (Imbox / Feed / Paper Trail), Apple Mail (4 categories), Spark | Yes, three piles |
| One-line summary in the list row | Superhuman Auto Summarize, Apple Intelligence | Yes, cached at triage time |
| Bulk review: preselected rows, untick, apply, undo | Inbox Zero, the private prototype | Yes |
| Learn from the user's own corrections | Inbox Zero (label edits become sender rules) | Yes |
| Never treat someone the user wrote to as cold or junk | Inbox Zero | Yes |
| Keyboard-first, every action instant with undo | Superhuman | Yes, extend what we have |
| Rules fire with no review queue | Inbox Zero (its approval queue is deprecated) | No: log every automatic action with reason and undo |
| A Gmail filter for every rule | Inbox Zero (only for sender auto-archive) | No: filters only when the user says "always" |

Complaints users repeat about these clients, which this plan must avoid: wrong sorting
that hides real mail, screeners that need upkeep, bundles too big to review, sync
failures, and opaque automation.

## Target experience

1. **Three piles.** The Inbox shows *Important* (people, needs reply, security,
   billing), *Updates* (receipts, notifications, scheduling) and *Newsletters &
   promotions*. Spam and scam stay visible behind a count and are never hidden or
   archived without the user. Category filters stay available.
2. **Grouped by sender in the noisy piles.** Updates and Newsletters show one row per
   sender with a count and the newest mail's one-line summary. One key archives the
   group, unsubscribes, or keeps the sender. Read rate and dates appear only on the
   cleanup screen.
3. **Cleanup screen.** Senders ranked by volume and read rate across the synced
   window, preselected when they are bulk and rarely read. The user unticks what to
   keep and applies archive, unsubscribe, or "always skip the inbox", with undo.
4. **Summaries.** The existing one-line `reason` becomes a one-line summary of the
   mail. Newsletters can be read as a digest: one card per issue with the summary and
   a link to the original.
5. **Fast.** No Gmail call in the request path for any pile, group or cleanup view.
   Every action is optimistic and undoable. Shortcuts add multi-select (x), select
   group, unsubscribe, spam, trash, star and snooze.
6. **Gmail stays in step.** Archive, spam, trash and unsubscribe are real Gmail
   changes. "Always skip the inbox for this sender" becomes a Gmail filter where the
   connection allows it, so mail stays clean in Gmail's own apps too.
7. **Works without AI.** Piles, sender groups and the cleanup screen work from
   headers, Gmail's labels and the user's own decisions. A model adds summaries and
   sorts what those cannot.

## Classifier

Order of decisions for each new message. A stage either decides or passes the
message on with its hints.

1. **Safety** (free): Gmail already put it in spam, or the sender fails
   authentication (DKIM/SPF/DMARC from `Authentication-Results`) while claiming a
   known brand. Decides spam or suspicious. Never archived automatically.
2. **The user's own decisions**: existing per-sender marks plus new per-sender pile
   choices. Decides.
3. **Prior contact**: the user has sent mail to this sender. Blocks any bulk, junk or
   cold decision; the message goes to Important or to the model. While prior contact
   is still unknown (backfill not done), treat it as "do not classify as bulk".
4. **Headers and Gmail labels** (free): `List-Unsubscribe`, `List-Id`,
   `Precedence: bulk|list`, `Auto-Submitted`, Gmail's promotions/social/updates
   categories, no-reply senders. Decides Newsletters or Updates for clear cases. Mail
   that looks like a security alert, a bill or a direct ask goes to the model instead.
5. **Learned sender decision**: once the model has put an authenticated sender in the
   same pile a few times with high confidence, store that as the sender's decision.
6. **Model**: the optional first-pass classifier provider, then the user's model, with
   headers, snippet, sender stats and the last few corrections for that sender. Output
   keeps today's fields, turns `reason` into a one-line summary, and adds one to three
   reasons.

Stages 1–5 run in sync and triage with no model and no AI consent. Only stage 6 needs
them. If new fields are sent to the model, check whether the AI-data disclosure needs
a new version.

Rules carried over from the private prototype's evaluation work:

- Spam, scam and suspicious mail is never archived automatically.
- A failed classification is stored as failed, not as low confidence, and retried.
- The classifier version is part of the cache key, so a rubric change re-triages.
- An offline evaluation set of synthetic messages gates changes: personal, work ask,
  transactional, notification, real security alert, newsletter, marketing, cold
  sales, spam, scam, plus a sender the user marked important who sends list mail, a
  prior-contact sender with bulk headers, and a spoofed sender that matches a learned
  decision. Two numbers must stay at zero: spam or scam that would be auto-archived,
  and personal, work or security mail hidden as bulk.

Corrections the classifier learns from: moving a message between piles, un-archiving,
marking spam or not spam, and unticking a row on the cleanup screen. Each becomes a
per-sender decision the user can see and delete.

## Gmail labels, filters and unsubscribe

Signals and actions go through `MailProvider` as provider-neutral fields and
capabilities (bulk, list id, unsubscribe target, category hint, authenticated sender;
batch modify, sender rule, unsubscribe), with offline conformance tests. The Gmail
adapter translates them. `MAIL_WRITES_DISABLED` and per-connection `writesEnabled`
cover every new write.

- **Piles stay in Postgres.** Rakazo creates no Gmail labels for them.
- **Gmail's own labels are inputs.** Sync stores spam, promotions, social, updates and
  important as flags instead of dropping spam, so the Spam count has data.
- **Spam** applies Gmail's `SPAM` label. The API has no "report spam" call, so we do
  not claim it trains Gmail's filter. This reverses the `mail_modify` guard for user
  clicks only; the agent still needs approval.
- **Bulk archive** acts on whole threads, like today's archive.
- **Filters** are created only when the user chooses "always skip the inbox". Gmail
  filters only act on new mail, so the same action archives existing mail with
  `batchModify` (1,000 ids per call). Rakazo records the filter id so the user can undo
  it. Gmail allows at most 1,000 filters; at the cap Rakazo keeps the decision on its
  side and says so. The `gmail.settings.basic` scope is requested only on first use,
  through a reconnect.
- **Unsubscribe** uses RFC 8058 one-click only when `List-Unsubscribe-Post` is
  present, the URL is https, and DKIM covers both headers. It sends a POST with the
  fixed body `List-Unsubscribe=One-Click`, no cookies or credentials, treats redirects
  as failure, and keeps the existing SSRF guard (which today only does GET). Otherwise
  Rakazo opens the link for the user or sends the `mailto:` with approval. Rakazo never
  unsubscribes from spam or scam, since that confirms the address to the sender. Every
  unsubscribe is logged and the sender then skips the inbox.

### Connections

Filters and push need the native Google connection, where Rakazo owns the OAuth
client and scopes. For Composio and Pipedream connections, Rakazo applies "always skip
the inbox" itself during sync and keeps polling. Whether those proxies allow the
filters endpoint is checked before phase 4.

## Sync and speed

- Move sync into a background worker job per connection. `inbox.refresh`, the agent
  overview and sync after send enqueue it instead of running it in the request.
- Widen the cache beyond 14 days (proposal: 90 days, paged), store the classifier
  headers and Gmail label flags, and backfill rows cached before those columns existed.
- Backfill prior contact per sender from sent mail with a provider search, since the
  cache does not reach far enough back.
- Key sender stats, decisions, filters and unsubscribes by connection as well as space
  and user, since one user can connect several Gmail accounts. Existing sender marks
  that span accounts keep applying to all of them.
- Optional Gmail push for native Google connections: `users.watch` to a Pub/Sub topic
  wakes the sync job. Watches expire after 7 days, so renew daily, and keep polling as
  the fallback because Google says notifications can be lost. One notification wakes
  every connection for that address, each in its own space and user scope.
  Self-hosters without Google Cloud keep polling.

## Phases

Each phase is one or a few PRs. New screens start as a mockup update and Storybook
stories.

1. **Signals.** Store classifier headers, Gmail label flags and authentication results;
   keep spam in the cache as a flag; backfill. Add per-sender stats (count, read rate,
   last date, unsubscribe target, prior contact) per connection. Run classifier stages
   1–5 without a model. Add the offline evaluation set. No new UI. Mobile: none.
2. **Three piles and sender groups.** Pile views, grouped rows, summaries,
   multi-select and bulk archive with undo. Mobile: piles and archive.
   Mockup: [piles-mockup.html](piles-mockup.html).
3. **Cleanup screen and unsubscribe.** Ranked senders, preselection, one-click
   unsubscribe with the POST-capable safe fetch, spam and trash, action log with undo.
   Mobile: the same screen as a native list. Mockup: [cleanup-mockup.html](cleanup-mockup.html).
   Landed: the Cleanup screen on web (Inbox header button) and mobile (Inbox header menu);
   `inbox.cleanup.*`, `inbox.unsubscribe`, `inbox.moveMany` and `inbox.actions.*`; a per-sender
   decision (skip inbox, unsubscribe result) and an action log, both per mail account. Skip
   inbox is applied by the `mail.sync` job after each sync, not by a Gmail filter (phase 4), and
   is the one automatic action so far: it archives only mail received after the decision, never
   spam, spam-like or failed-authentication mail or a sender marked important, and every run is a
   logged, undoable entry. Spam, not spam and trash are `SPAM` and `TRASH` label changes through
   `modifyThread`; the agent's `mail_modify` still refuses both.
4. **Gmail filters.** "Always skip the inbox" creates a filter on native Google
   connections, archives existing mail, records the filter for undo. Mobile: the same
   action, no new screen.
5. **Background sync and push.** Worker-owned sync for all three callers, wider cache,
   optional Pub/Sub. Mobile: none. Landed: the `mail.sync` job, a 90-day cache filled
   100 messages per query per run, and Gmail push when `GMAIL_PUSH_TOPIC` and
   `GMAIL_PUSH_SERVICE_ACCOUNT` are set.
6. **Newsletter digest and learned sender decisions.** Digest reading view; promote
   repeated model decisions to sender decisions. Mobile: digest view.

## Decisions

- Piles and categories stay Rakazo-only. A `Rakazo/…` label mirror may come later as
  a setting.
- `gmail.settings.basic` is requested only when a user first chooses "always skip the
  inbox". It is a restricted scope, so it affects Google's verification and security
  assessment for the hosted app.

This plan supersedes [README](README.md) decision 3 (sync on demand) once phase 5
lands, and extends decision 10 (writes limited to archive, read state and sending)
with spam, trash, unsubscribe and filters from user clicks.

## Open decisions

- Automatic actions: apart from skip inbox for senders the user chose (phase 3), phases 1–4
  only act on a user's click. Whether to add scheduled automatic cleanup (archive and label
  only, capped, logged) is decided after phase 3.
- Cache window and storage cost for 90 days of headers per connection.

## Unverified

- Whether applying the `SPAM` label through the API trains Gmail's spam filter.
- Whether the Composio and Pipedream proxies allow `users.settings.filters`.
- Several Superhuman details (speed targets, reminders) came from reviews, not
  official pages; none of this plan depends on them.
