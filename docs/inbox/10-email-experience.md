# Email experience plan

Status: proposal. Nothing here is built yet unless it says so.

## Goal

Make Rakazo's Inbox the fastest, cleanest way to get through Gmail: the list opens
instantly, noise (spam, newsletters, promotions, notifications) is grouped and cleared
in a few keystrokes, each row says what the mail is about, and Gmail stays in sync with
what Rakazo decided.

## What we have today

Verified against the code on main (October 2026):

- Mail reaches Rakazo through `MailProvider` (`packages/adapter-kit/src/interfaces.ts`)
  and one Gmail adapter (`packages/adapters/src/gmail-mail-provider.ts`). Sync is
  on demand from `inbox.list`/`inbox.refresh`, uses the Gmail history cursor, covers
  14 days and at most 200 messages (`packages/adapters/src/mail-sync.ts`), and runs
  inside the API request. There is no Gmail push.
- `mail_messages` stores metadata and the snippet, not the body or headers.
- Background triage (`packages/adapters/src/inbox-triage.ts`) gives each message one
  of 14 categories, a priority, needs-reply and an optional to-do, from metadata and a
  500-character snippet. It never reads `List-Unsubscribe`, `List-Id` or `Precedence`.
  Results stay in Postgres; nothing is written back to Gmail.
- The web Inbox has category views, an Important view, archive with undo, mark read,
  per-sender important/noise feedback, keyboard shortcuts (j/k, Enter, /, c, e, ?) and
  prefetch. Filtered views and search read Gmail live, 50 per account per page.
- Missing: multi-select and bulk actions, sender grouping, unsubscribe, trash, spam,
  star, snooze, label creation, Gmail filters, summaries in the list, push sync. Mobile
  is read-only.

## What the best clients do

Sources: Inbox Zero source code (github.com/elie222/inbox-zero), an earlier private
Gmail assistant prototype, official pages for Gmail, HEY, Superhuman, Shortwave,
Notion Mail, Spark and Apple Mail, and Google's Gmail API documentation.

| Pattern | Who does it | Take for Rakazo |
| --- | --- | --- |
| Sender-level decisions cached before any model call | Inbox Zero (learned patterns), HEY (Screener) | Yes: decide per sender once, reuse forever, model last |
| Ranked sender list with one-click unsubscribe | Gmail Manage Subscriptions (July 2025), Inbox Zero bulk unsubscriber | Yes: the core of fast cleanup |
| Inbox split into a few fixed piles | HEY (Imbox / Feed / Paper Trail), Apple Mail (4 categories), Spark | Yes, three piles, not fourteen |
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
   archived without the user. The existing 14 categories stay underneath as filters.
2. **Grouped by sender in the noisy piles.** Updates and Newsletters show one row per
   sender with a count, last date, read rate and a one-line summary of the newest mail.
   One key clears the whole group (archive), unsubscribes, or keeps the sender.
3. **Cleanup screen.** "Clean up" lists senders ranked by volume and read rate across
   the synced window, preselected when they are bulk and rarely read. The user unticks
   what to keep and applies archive, unsubscribe, or "always skip the inbox". It shows
   how many messages each choice touches and offers undo.
4. **Summaries.** Each row carries a cached one-line summary. Newsletters can be read
   as a digest: one card per issue with the summary and a link to the original.
5. **Fast.** The list renders from Postgres with no Gmail call in the request path.
   Every action is optimistic and undoable. Shortcuts cover multi-select (x), select
   group, archive, unsubscribe, spam, trash, star, snooze.
6. **Gmail stays in step.** Archive, spam, trash and unsubscribe are real Gmail
   changes. "Always skip the inbox for this sender" becomes a Gmail filter, so mail
   stays clean on the phone's Gmail app too.

## Classifier

Order of decisions for each new message. Stop at the first stage that decides.

1. **Headers and Gmail labels** (free): `SPAM` label, `List-Unsubscribe`, `List-Id`,
   `Precedence: bulk|list`, `Auto-Submitted`, Gmail `CATEGORY_*` labels, no-reply
   senders. These mark bulk mail and transactional mail without a model call.
2. **User's own rules and feedback**: existing `inbox_sender_feedback`, plus new
   per-sender decisions ("newsletter, skip inbox", "important").
3. **Prior contact**: if the user has ever sent mail to the sender, never classify as
   cold, junk or newsletter.
4. **Learned sender decision**: once the model has classified the same sender the
   same way a few times with high confidence, store that as the sender's decision and
   skip the model for that sender's later mail.
5. **Model** (the user's configured model, or TypeSafe): headers, snippet, sender
   stats and the last few corrections for that sender. Output keeps the current fields
   and adds a one-line summary and one to three reasons.

Rules carried over from the private prototype's evaluation work:

- Ordered precedence for unsafe mail: phishing, then junk, then newsletter, then
  category. Spam, scam and suspicious mail is never archived automatically.
- A failed classification is stored as failed, not as low confidence, and retried.
- The classifier version is part of the cache key, so a rubric change re-triages.
- An offline evaluation set of synthetic messages (personal, work ask,
  transactional, notification, real security alert, newsletter, marketing, cold sales,
  spam, scam) gates changes. Two numbers must stay at zero: spam or scam that would be
  auto-archived, and personal, work or security mail hidden as bulk.

Corrections the classifier learns from: moving a message between piles, un-archiving,
marking spam or not spam, and unticking a row on the cleanup screen. Each becomes a
per-sender decision the user can see and delete.

## Gmail labels and filters

- **Rakazo's piles and categories stay in Postgres.** We do not create Gmail labels
  for them by default; 14 labels per user would clutter Gmail. A later setting can
  mirror the three piles as `Rakazo/…` labels for users who want them in Gmail.
- **Gmail's own signals are inputs.** `CATEGORY_PROMOTIONS`, `CATEGORY_SOCIAL`,
  `CATEGORY_UPDATES`, `IMPORTANT` and `SPAM` feed stage 1 of the classifier.
- **Spam** applies Gmail's `SPAM` label. The API has no "report spam" call, so we do
  not claim it trains Gmail's filter.
- **Filters** are created only from an explicit user choice ("always skip the inbox
  for this sender"). Gmail filters only act on new mail, so the same action also
  archives existing mail with `batchModify` (1,000 ids per call). Rakazo records the
  filter id so the user can undo it from Rakazo. Needs the `gmail.settings.basic`
  scope, which Rakazo does not request today; users who do not grant it get the same
  behavior from Rakazo's own sender decision while Rakazo is syncing.
- **Unsubscribe** uses RFC 8058 one-click (`List-Unsubscribe-Post` with an https URL)
  through the existing SSRF-guarded fetch. Without one-click, Rakazo opens the link
  for the user or sends the `mailto:` with approval. Rakazo never unsubscribes from
  mail classified as spam or scam, since that confirms the address to the sender; it
  offers spam instead. Every unsubscribe is logged and the sender is then skipped.

## Sync and speed

- Move sync out of the API request into a background worker job per connection, so
  the list never waits on Gmail.
- Widen the cache beyond 14 days and 200 messages (proposal: 90 days, paged), and
  store the headers the classifier needs.
- Optional Gmail push: `users.watch` to a Pub/Sub topic wakes the sync job. Watches
  expire after 7 days, so renew daily, and keep polling as the fallback because Google
  says notifications can be lost. Push stays optional: self-hosters without Google
  Cloud keep polling.
- Serve category, pile and sender views from Postgres instead of live Gmail queries.

## Phases

Each phase is one or a few PRs. Web first; each phase lists its mobile part.

1. **Headers and sender stats.** Store classifier headers; add a per-sender aggregate
   (count, read rate, last date, unsubscribe link, prior contact) scoped to space and
   user; feed stage 1 and 3 signals into triage. Add the offline spam/newsletter
   evaluation set. No new UI.
2. **Three piles and sender groups.** Pile views, grouped rows, one-line summaries,
   multi-select and bulk archive with undo. Mobile: piles and archive.
3. **Cleanup screen and unsubscribe.** Ranked sender list, preselection, one-click
   unsubscribe, spam and trash actions, action log with undo. Mobile: same screen,
   native list.
4. **Gmail filters.** "Always skip the inbox" creates a filter, archives existing
   mail, records the filter for undo. Adds the settings scope behind a reconnect.
5. **Background sync and push.** Worker-owned sync, wider cache, optional Pub/Sub.
6. **Newsletter digest and learned sender decisions.** Digest reading view; promote
   repeated model decisions to sender decisions.

## Decisions

- Piles and categories stay Rakazo-only. A `Rakazo/…` label mirror may come later as
  a setting.
- `gmail.settings.basic` is requested only when a user first chooses "always skip the
  inbox", through a reconnect. It is a restricted scope, so it affects Google's
  verification and security assessment for the hosted app.

## Open decisions

- Automatic actions: phase 1–4 only act on a user's click. Whether to add scheduled
  automatic cleanup (archive and label only, capped, logged) is decided after phase 3.
- Cache window and storage cost for 90 days of headers per user.

## Unverified

- Google does not document a maximum number of filters; third parties say 1,000.
- Whether applying the `SPAM` label through the API trains Gmail's spam filter.
- Several Superhuman details (speed targets, reminders) came from reviews, not
  official pages; none of this plan depends on them.
