# Import company

Status: proposal for owner review; nothing here is built. Facts about the code were checked against `main` at `f783497e5`. Approved design: not yet; first draft in [mockup.html](../import-company/mockup.html) (invented data only). Owner answers are TBD in the table below; each has a recommended default so work on phase 1 can start without waiting.

## Goal

A user brings their company to Praci in one flow. They pick the tools the company runs on (Linear, GitHub, Notion, Slack, Google Drive, Box, email, and any other app connected through Composio), agree to what may be read, and start. A coordinating agent then runs a fleet of read-only extractor workers over those sources and builds a **company map**: the people and their roles over time, the organisations around the company (investors, customers, vendors, law firms), legal matters, projects, and a dated history of what happened and why we believe it. Every fact points back to the message, document or ticket it came from.

Two things come out of the map:

- A **Company page** that says what the company is and does, with people, organisations, a history waterfall, a calendar of dates, and a review queue for facts the agents are unsure about.
- A **read tool for every other agent** (Chief, Legal, Finance, Inbox), so they answer with the company's context instead of asking the user again.

Web and desktop (Electron hosts the web UI) ship first. Mobile gets native read, calendar, review and progress screens in the last phase; until then mobile shows nothing new, which is safe because no existing workflow changes.

### Non-goals

- Writing to any source tool. Import is read-only; nothing in this plan creates, edits or deletes a message, ticket, page or file in a source.
- A second document store. Documents stay in the Data room; the map links to them.
- A second legal system. Contracts, deadlines and the legal graph stay in Legal; the map links to them.
- A second roster or a second contacts table (see "Reuse").
- Employee monitoring or performance data. Compensation, health, performance reviews, immigration status and personal (non-work) contact details are never extracted.
- Finance numbers. Key numbers shown on the Company page are read from Finance and the Cap table, never extracted from text.
- Real-time sync. Refresh is a nightly incremental job and a manual "Refresh".
- A vendor requirement. Every model, source and store sits behind an interface; the product runs with one model connection and no hosted vendor.
- Legal advice, or any claim that the reconstructed history is authoritative. The map is a labelled reconstruction.

## Owner answers (TBD)

| Question | Recommended default | Answer |
| --- | --- | --- |
| Who sees the Company page in a space with several members? | Owner only in v1, like the Data room; the owner can promote single facts to the team. | TBD |
| Which sources ship first? | Data room (covers Drive, Box, uploads, mail attachments) and Gmail, because both exist. Then Slack, GitHub, Linear, Notion. | TBD |
| Default token budget for one import run, and who pays? | The owner sets a cap before start; the run hard-stops at the cap. Hosted deployments count it against the pooled AI allowance; own-key (BYOK) runs do not. | TBD |
| How far back does email and chat go? | Last 3 years, owner can widen to all time. | TBD |
| Slack scope | Public channels only. Private channels and DMs need a separate, explicit choice per channel. | TBD |
| Include hire and departure dates and work anniversaries? | Hire and departure dates yes (they define roles over time); anniversaries on the calendar off by default; birthdays never. | TBD |
| Never-extract categories | Compensation, health, performance reviews, immigration status, home addresses, personal phone numbers. | TBD |
| Which model runs extraction? | A separate "Import model" setting, defaulting to the cheapest connected model that supports structured output; falls back to the default chat model. | TBD |
| Auto-show threshold | A suggested fact shows on the page at confidence 0.8 or higher or when two independent sources agree; below that it appears only in Review. | TBD |
| Which identity table is canonical for people? | The map's Person entity. The Team health roster (planned, not built) should reference it instead of creating `TeamMember`. | TBD |
| Page name | "Company". | TBD |
| Start an import from mobile? | No in v1; mobile shows progress and can pause or cancel. | TBD |
| Employee-monitoring law (works councils, EU) | Needs review before enabling for teams in those regions; same caveat as Team health. | TBD |

## What exists vs. what is new

| Area | Exists (path) | New in this plan |
| --- | --- | --- |
| People and contacts | `Contact` (`packages/db/prisma/schema.prisma`, `packages/db/src/contacts.ts`, `packages/contracts/src/contacts.ts`): name, email, organization, `kind` investor/auditor/other, per space and user. Roster: planned in `docs/team-health/README.md` (`TeamMember`), not in the schema. | Person entity with roles, employment periods and source identities; links to a `Contact` when one exists. |
| Legal | `LegalContract`, `LegalDeadline`, `LegalNode`, `LegalEdge` (`packages/db/prisma/schema.prisma`), Legal agent and tools (`apps/api/src/legal-agent.ts`, `packages/adapters/src/legal-tools.ts`), dated sourceQuote on every deadline. | Matter entity that links to Legal rows instead of copying them; deadlines appear on the Company calendar by read-through. |
| Documents | Data room items with facets (docType, docDate, parties, amount), extracted text and chunks (`DataRoomItem`, `DataRoomItemText`, `DataRoomChunk`), importers for Drive and Box (`packages/adapters/src/data-room-drive-import.ts`, `data-room-box-import.ts`), zip, and mail attachments; `search_data_room` and `read_data_room_item` (`packages/adapters/src/data-room-tools.ts`). Plan: `docs/data-room/README.md`. | Document links from facts to Data room items. The extractor reads existing facets and text first, so documents already read are not paid for twice. |
| Mail | `MailProvider` (`packages/adapter-kit/src/interfaces.ts`), Gmail adapter, mail cache and sync with claim tokens (`packages/adapters/src/mail-sync.ts`, `mail-sync-job.ts`, model `MailSyncState`), triage categories (`inbox-triage.ts`). Plan: `docs/inbox/10-email-experience.md`. The cache keeps no bodies and only about 14 days. | A mail reader that pages Gmail history directly for the import window, reusing triage categories and sender marks to skip noise. |
| Connections | Composio and Pipedream connectors (`packages/adapters/src/composio-connector.ts`, `pipedream-connector.ts`), first-party MCP servers (`mcp-connector.ts`, `remote-mcp.ts`; Box, Devin, Granola, Carta and others), native Google OAuth, `Connection` rows and per-bot access (`BotConnectionAccess`). Plans: `docs/plans/agent-per-connection.md`, `docs/integration-agents/README.md`, `docs/composio-instant/README.md`. | A read-only source reader built on these. It uses only tools classified as reads (`isReadTool` rules in the integration-agents plan) and never a write tool. |
| Background jobs | graphile-worker queue; job union and zod payloads in `packages/adapter-kit/src/background-jobs.ts`; handlers in `packages/adapters/src/background-job-handlers.ts`; worker `apps/worker/src/index.ts`; sync state with cursor, claim token and throttle (`DataRoomSyncState`, `MailSyncState`). | `company.import.*` jobs, run/source/unit tables for a resumable crawl. |
| Agents | Page agents with reserved spawn keys (Inbox, Finance, Legal, Carta, Data room; `apps/api/src/*-agent.ts`), integration agents (`apps/api/src/integration-agent.ts`), daily server-owned routine (`LEGAL_SCAN_ROUTINE_NAME` in `apps/api/src/legal-agent.ts`). Tools `run_subagent`, `spawn_bot`, `message_bot` (hop cap 6, `packages/core/src/bot-messages.ts`), `notify_user` (`packages/adapters/src/builtin-tools.ts`). Approval gate and unattended-safe list (`packages/core/src/action-approval.ts`, `packages/adapters/src/approval-ask.ts`, `READ_ONLY_AGENT_TOOLS` in `packages/adapters/src/executor.ts`). | Company importer and Company (Historian) agents, `company_*` and `timeline_query` tools. |
| AI consent | `AiDataConsent` keyed by user, space and recipient key, with a versioned disclosure (`packages/contracts/src/ai-consent.ts`, `apps/api/src/ai-consent.ts`); inline request `AI_CONSENT_EFFECT_KIND`; Data room checks consent before every model call. | A per-source acknowledgement stored with the run, plus the same recipient-key check before every extraction call. |
| Memory | Per-bot memory (`packages/memory`, `MemoryDocument`), `AgentSkill` (`packages/db/prisma/schema.prisma`). | The map is not bot memory. Agents get a skill (`company-map`) that tells them when to call `company_search`. |
| Time | Routines carry a `timezone` and cron list; schedules use the user's time zone (#357; `apps/web/src/lib/local-timezone.ts`, `apps/mobile/lib/timezone.ts`). | Dates in the map are all-day dates with a precision, not instants (see "Data model"). |
| Rendering | `create_ui_artifact` and the OpenUI vocabulary (`packages/ui-artifact`, `packages/contracts/src/builtin-tools.ts`); `UiArtifactView` in `apps/web/src/components`. | The Historian may answer with a small timeline artifact. The Company page itself is built from `packages/ui-web` components and inline SVG, not an artifact. |
| Pages | Sidebar page templates (`packages/contracts/src/sidebar-pages.ts`), pages in `apps/web/src/pages` (Data room, Legal, Cap table, Finance). Plans: `docs/plans/notifications.md` (glance values, Hide money). | A `company` template, `/app/company` and `/app/company/import`. |
| Projects | Plan only (`docs/project-management/README.md`); no Project table on `main`. The `Task` model in the schema is an agent run task, not a work item. | Project entity in the map stays a thin link (name, dates, tracker URL) and adopts the native Project id when that ships. |
| Cost control | Hosted allowance and usage rows (`docs/hosted-service/README.md`, `packages/db/src/usage.ts`, `packages/db/src/billing.ts`). | Per-run token budget, counted into usage. |

## Reuse

- **People**: Contacts stay the table for external people the owner already tracks. The map's Person entity is the identity record (all emails, Slack id, GitHub login, roles over time) and holds a nullable link to a `Contact`. The Team health plan reserves `TeamMember`; see the owner question about making the Person entity canonical so there is one roster.
- **Documents**: Data room items, linked by id. Nothing is copied except a short quote (at most 240 characters) as evidence.
- **Legal**: contracts, deadlines and the legal graph are read through, never copied. A Matter entity may link to a `LegalContract`. If the Legal agent later records matters natively, the Matter entity becomes a view over them.
- **Money**: Finance and Cap table numbers are read for the "key numbers" strip and hidden while Hide money is on.
- **Memory and skills**: the `company-map` skill (an `AgentSkill`) teaches agents the tools; agent memory is untouched.

## Data model

Everything is Postgres, scoped by `spaceId` and `ownerUserId` (the user whose connections were read), and read through one actor-scoped helper in `packages/db`, like the Data room query helper. No fact is ever visible across spaces or owners, including through counts, search ranking or dedupe. Table and column names below are proposals.

### Tables

- `CompanyEntity`: `id`, `spaceId`, `ownerUserId`, `kind` (`company`, `person`, `organisation`, `matter`, `project`, `product`), `displayName`, `key` (normalized name; unique with space, owner and kind), `attrs` (JSON validated by a zod schema per kind), nullable links `contactId`, `legalContractId`, `dataRoomItemId`, `status` (`suggested`, `confirmed`, `rejected`), `confidence` (0 to 1), `lockedFields` (text array of fields the owner set by hand), `visibility` (`private`, `team`), timestamps. The single `company` entity per space and owner holds the profile: legal name, one-line description, "what we do" text, website, founded date, headquarters.
  - Person `attrs`: aliases, work emails, Slack id, GitHub login, Linear id, time zone. No compensation, health, performance or personal contact fields exist in the schema, so no extractor can fill them.
  - Organisation `attrs`: `type` (`investor`, `customer`, `vendor`, `law_firm`, `bank`, `partner`, `other`), domain.
- `CompanyEdge`: `fromId`, `toId`, `relation` (`works_at`, `reports_to`, `founded`, `invested_in`, `customer_of`, `vendor_of`, `counsel_for`, `party_to`, `works_on`, `part_of`), `startsOn`, `endsOn`, `role` (title, for `works_at`), plus the same status, confidence, lock and visibility columns. **Employment periods are edges**, so a person who left and came back has two `works_at` edges.
- `CompanyEvent`: `id`, space, owner, `stream` (`company`, `people`, `funding`, `legal`, `product`, `customers`), `kind` (`founded`, `hire`, `departure`, `role_change`, `funding_round`, `contract_signed`, `renewal`, `matter_opened`, `matter_closed`, `launch`, `customer_won`, `customer_lost`, `milestone`, `other`), `title`, `occursOn` (date), `endsOn` (date, optional), `precision` (`day`, `month`, `quarter`, `year`), `entityIds` (the entities involved), optional `amountCents` and `currency`, and the same status, confidence, lock and visibility columns.
- `CompanyEvidence` (provenance): `id`, `factKind` (`entity`, `edge`, `event`), `factId`, `stance` (`supports`, `contradicts`), `sourceKind` (`gmail`, `data_room`, `slack`, `github`, `linear`, `notion`, `mcp`, `composio`, `manual`), `connectionId` or `mcpServerId`, `sourceItemId` (message id, Data room item id, Slack message timestamp and channel, issue key, page id), `sourceUrl`, `quote` (at most 240 characters), `extractedAt`, `extractorRunId`, `extractorModel` (provider and model id), `confidence` (0 to 1), `confirmedByUserId` and `confirmedAt` (null until a human confirms). A fact can have many evidence rows; that is how "two independent sources agree" is computed.
- `CompanyImportRun`, `CompanyImportSource`, `CompanyImportUnit`: see "Pipeline". `CompanyImportUnit` is the resumable work item (a page of messages, a folder, a channel window, a ticket range) with `status`, `attempts`, `cursor` and `resultHash`.

There is no separate review table. The review queue is a query: facts whose status is `suggested` and confidence is below the auto-show threshold, plus facts with a `contradicts` evidence row.

### Dates and time zones

Company dates are calendar dates. A hire date, a contract renewal and a funding close are all-day facts with a `precision`, stored as `@db.Date` like `LegalDeadline.dueDate`. They are shown as written, never shifted by the viewer's time zone. Only timed items (a meeting read from a calendar) keep an instant plus the source's IANA zone, and render in the viewer's zone using the same rules as #357. The nightly refresh is a server-owned routine and uses the owner's time zone for "when". Anniversaries are computed in the viewer's current year without shifting the date. A year-only date (`precision: year`) never appears as a day on the calendar.

### Provenance rules

- No fact exists without at least one evidence row; a fact whose last evidence row is deleted is deleted too (disconnect cleanup).
- Evidence records where the fact came from and when it was extracted. Re-extraction adds a row rather than overwriting.
- Confidence is set by the extractor and raised by independent corroboration: two evidence rows from different `sourceItemId` and different `sourceKind` count as independent. A human confirmation sets `confirmedByUserId` and status `confirmed`.
- The page distinguishes three states: confirmed (human), suggested (shown, marked "Not confirmed"), and not shown (below threshold, review only).

### Dedupe and merge

The resolver runs after extraction, in code first and a model second.

1. **Deterministic keys.** People match on a work email, Slack id, GitHub login or Linear id. Organisations match on domain, then an unambiguous normalized legal name. Events match on kind, normalized title, date and precision, plus sorted canonical subject IDs; exact raw subject/source keys take precedence over canonical keys after an explicit merge. Explicit merges canonicalize subjects while preserving original links and per-source replay keys. Subject corrections retain source-bound replay keys without making the old subject a global alias. If a new source matches multiple events after an explicit merge, it becomes an event candidate in Review instead of collapsing the records. Events without known subjects match only within the same stable source locator, independent of content hash.
2. **Candidate pairs.** Same normalized name with no shared identifier, or the same email local part at different domains, become candidates. One cheap model call per small batch of candidates sees names, roles and snippet counts only (no message text) and answers merge, keep apart, or unsure.
3. **Unsure and low-confidence merges** are never applied. They land in Review as "Same person?" with both records side by side.
4. **Merge is reversible.** A merge writes a `mergedFrom` list on the survivor. "Split" in fact detail restores both rows and re-attaches evidence by `sourceItemId`.
5. **Two people never merge across owners or spaces**, even with the same email.

### Owner corrections survive re-import

- Any field the owner edits goes into `lockedFields`. Re-import never overwrites a locked field. New conflicting evidence is stored as a `contradicts` row and shown on the fact (and in Review only when its confidence is high).
- **Reject** sets status `rejected` and stores the fingerprint (kind, key, date). The resolver drops matching candidates on later runs, so a rejected fact does not return. Disconnecting a source does not clear rejections; "Erase company map" does.
- **Confirm** locks status to `confirmed`. A later `contradicts` row adds a "Conflicting evidence" note, never an automatic change.
- A manual fact (typed by the owner) has `sourceKind: manual` evidence and is always locked.
- Re-import is idempotent: the same source item with the same content hash produces no new evidence row.

## Import pipeline

```
discover -> plan -> consent -> crawl (units) -> extract -> resolve -> review -> publish
```

### 1. Connector discovery

The flow page lists what the user can import, from existing state only: native Google connections (Gmail, Drive), `Connection` rows (Composio, Pipedream), MCP servers (Box, Slack, Linear, GitHub, Notion and others), and the Data room. Each row shows connected or not. "Connect" opens Integrations and returns. Nothing is read at discovery except a count where the provider offers one cheaply. Sources whose connection the owner has denied to the importer agent are shown disabled with no further explanation.

### 2. Plan

The Company importer drafts a plan per source: scope (channels, folders, labels, date window), a rough item count where known, and a token estimate with a lower and upper bound. The owner can untick any scope. The plan is data (`CompanyImportSource.plan`), not a prompt, so it is the same on every surface.

### 3. Consent

- Importing sends source content to the extraction model, so it needs AI data sharing consent. The flow page lists the sources and the model recipients that will receive text, using the existing recipient list (`AiConsentStatus`) for the import model. The user accepts per source and per model. The accepted source list and `AI_DISCLOSURE_VERSION` are stored on the run.
- The backend checks consent before every extraction call, including background retries and the nightly refresh. If consent is withdrawn or the import model changes to an unconsented recipient, the run moves to `awaiting_consent` and no call is made. It resumes when consent is granted again.
- The coordinator can propose a start with the existing inline consent request, but only the user's own tap starts a run.

### 4. Crawl plan

- **Postgres only.** No local disk. Run, source and unit state live in tables; a worker crash leaves a unit `claimed` with an expired claim, and the next worker re-claims it, like the `MailSyncState` claim token (stale after 2 minutes).
- **Units.** Each source reader turns its scope into units of bounded size (for example 25 messages, one Slack channel-day window, 50 issues, one Drive folder level). A unit has a stable key, so planning twice does not duplicate work.
- **Incremental.** Each source keeps a cursor (Gmail history id, Slack oldest timestamp, an `updatedAt` high-water mark). A refresh reads only past the cursor and then re-reads items whose provider version changed.
- **Rate limited.** Each source has its own concurrency (default 1 in flight per source) and backoff, honoring provider limits; a rate-limited unit is re-queued with `runAfter`, never retried in a tight loop. Total concurrency across the deployment is capped by the existing graphile worker settings.
- **Resumable.** Every job is idempotent by unit key and `resultHash`. Extraction writes evidence and facts in the same transaction that marks the unit `done`.
- **Reading is bounded.** A unit reads at most a set number of characters per item (a long thread or document is truncated and marked so), like the Data room's read bounds.

### 5. Extraction by workers

The coordinator is a bot (Company importer, below). The workers are not bots; they are durable job handlers with narrow tool allowlists. In-turn `run_subagent` helpers disappear when the turn ends, so they cannot be resumed after a crash. Using durable jobs gives the same fan-out the owner asked for, with a progress row per worker. The coordinator may still use `run_subagent` for a quick look (for example sampling a Slack channel while planning), but never for the crawl.

| Worker (per source type) | Reads | Tools it may call (all read-only) | Notes |
| --- | --- | --- | --- |
| `data_room` extractor | Existing Data room facets and text | `search_data_room`, `read_data_room_item` equivalents, called by code | Cheapest: documents are already read. Covers Drive, Box, uploads, mail attachments. |
| `mail` extractor | Gmail threads in the window | `MailProvider` list and get, called by code | Skips triage categories newsletter, bulk, notification, spam and senders marked noise. |
| `chat` extractor | Slack channels the owner chose | Read tools of the Slack connection (channel history, thread, user profile) | Public channels by default. |
| `tracker` extractor | Linear, GitHub, Notion items | Read tools of the connection | Uses the project-management plan's per-vendor mappers when they exist. |
| `generic` extractor | Any other connected app | Tools the owner ticks, restricted to those classified as reads | For "anything else through Composio". |

How a worker runs:

1. **Triage without a model**: skip by rule (sender domain, category, channel type, file type, age outside the window).
2. **Relevance pass** with a cheap model call on titles, snippets and metadata only, batched, to pick items worth reading in full.
3. **Extraction call** per item or small batch: untrusted text goes in, validated JSON comes out (people, organisations, events, edges, each with a short quote and a confidence). The extraction model gets **no tools**; it cannot fetch, send or write. This is the main defense against injection (see "Safety").
4. The worker hands the JSON to server code, which validates it with zod, drops anything outside the schema, and writes suggested facts and evidence. Models never write to the map directly during an import.

The extractor sits behind a `CompanyExtractor` interface in `packages/adapter-kit`, like `DataRoomClassifier`. The first adapter uses the space's chat model through the shared connection settings with structured output. No vendor model name or environment variable appears outside adapters. A TypeSafe adapter or a local model (Ollama through the generic OpenAI-compatible connection) can follow without changing the pipeline.

### 6. Resolve

Dedupe and merge as above, then a synthesis step: the coordinator drafts the company description and "what we do" from the highest-confidence facts and a handful of cited snippets, never from raw bulk text. The draft is a suggested profile field with evidence rows, editable by the owner.

### 7. Review queue

Items below the threshold, merge candidates ("Same person?"), contradictions, ambiguous event candidates, rejected name-only person claims, and anything involving a never-auto category land in Review. Ambiguous event and rejected name-only candidates retain their proposed fact and evidence metadata without creating a new fact; `importEvent` and `importEntity` return `{ deferred: true, record: null, candidateId }` for these paths, with resolution left to the next-phase Review action. Actions are Confirm, Edit and Reject, with a keyboard shortcut for each. The page badge shows the count.

### 8. Progress UI

One row per source, each with the worker's state (waiting, reading, extracting, done, failed), items read of discovered, facts found, tokens used of the cap, and the last error in a few words. A run shows an overall bar, elapsed time and an estimate. Progress is pushed over the existing realtime path (Postgres LISTEN/NOTIFY, `packages/adapters/src/realtime.ts`) and read from Postgres on load.

### 9. Cancel and resume

- **Pause**: stops claiming new units; running units finish.
- **Cancel**: marks the run `cancelling`; running units stop at their next write; facts already written stay (suggested) unless the owner chooses "Cancel and discard this run", which deletes facts whose only evidence came from this run.
- **Resume**: continues from the unit table; no completed unit is repeated.
- **Hard stop at budget**: at 80% of the token cap the run shows a warning; at 100% it pauses with `budget_reached`. Raising the cap resumes it.
- A failed unit is retried a small number of times, then marked `failed` with a reason; the run completes with failures listed and a "Retry failed" button.

### Cost and token budget

All numbers below are estimates for planning, not measurements. They are replaced by measured values from the eval (phase 4) before any default budget is set. Token prices are operator and provider settings, so no dollar figures are given.

Assumed small company (invented sizing): 8,000 mail threads in the window, 400 documents, 3,000 Slack messages in 30 channels, 1,500 tracker items.

| Stage | Items | Tokens per item (in / out, estimate) | Total (estimate) |
| --- | --- | --- | --- |
| Rule triage | all | 0 | 0 |
| Relevance pass (snippets, batched) | about 10,000 | 150 / 10 | about 1.5M in, 0.1M out |
| Extraction | about 1,500 kept | 2,500 / 400 | about 3.8M in, 0.6M out |
| Merge candidates | about 200 pairs | 100 / 10 | about 0.02M in |
| Synthesis | 1 | 30,000 / 2,000 | about 0.03M in |
| **Total** | | | **about 5.4M in, 0.7M out** |

Cost = input tokens x input price + output tokens x output price, with prices TBD. Controls:

- The owner sets a token cap per run before start, with the plan's estimate shown beside it.
- Cheapest first: rules, then snippets, then full text. Documents reuse Data room text.
- Batching and a content hash skip unchanged items on refresh, so nightly refresh cost is proportional to new items.
- Per-source and per-worker token counters live on the unit and source rows and are written to usage records, so hosted allowance and BYOK rules apply as they do for chat.
- A "Preview a sample" step runs the pipeline on up to 25 items per source first, so the owner sees real facts and a better estimate before committing the full run.

## Safety and privacy

### Read-only

- Importing never writes to a source. Enforcement is in code: the source reader is built from tools classified as reads (annotation `readOnlyHint` plus the explicit preset lists from the integration-agents plan). A write tool is not in the worker's tool list, so no prompt can call it.
- The Company importer and Historian bots get no mail send, Drive write, web fetch, `spawn_bot` or `message_bot` to non-company agents. They cannot send data out of the system.
- An offline emulator test per source asserts zero write calls during a full run.

### Untrusted content

- Everything read from a source is data. Extraction prompts wrap it in delimiters and state that it contains no instructions. The extraction model has no tools and its only output is JSON validated against a schema.
- Output is bounded: fields have length caps, quotes are at most 240 characters, enums are closed, and a unit that returns more than a set number of facts is flagged.
- A fact that cites an item containing instruction-like text (for example "ignore previous instructions") is marked low confidence and routed to Review.
- Agents that later read the map see facts and short quotes, not source documents, and the tool results are marked as untrusted data in the same way search results are.
- The eval includes planted-instruction fixtures; the pass condition is zero tool calls outside the allowlist and zero facts that exist only because of an instruction.

### Consent and what leaves the machine

- No source content goes to a model before the user has accepted the per-source, per-model consent in "Pipeline". The check runs in the backend before each call.
- With a local model (Ollama through the generic OpenAI-compatible connection), nothing leaves the machine except the calls the source tools themselves make to their providers.
- Source credentials stay in the existing encrypted stores; the map stores ids and URLs, never tokens.

### PII, retention, deletion, export

- Stored: names, work emails, roles, dates, organisation names, short quotes. Not stored: full message bodies or document text (documents stay in the Data room; mail and chat bodies are not kept), compensation, health, performance, personal contacts.
- **Disconnect** a source: deletes its evidence rows and any fact left with none, in one transaction. Rejections and locked owner edits stay.
- **Exclude a person**: stops collection about them and deletes their person entity, edges and events that name only them (the Team health opt-out pattern).
- **Erase company map**: deletes every map row for the owner in the space, including rejections.
- **Space delete** cascades through `spaceId` (same as other tables).
- **Export**: one JSON file of entities, edges, events and evidence for the owner, from the page menu.
- Retention: no automatic expiry in v1; the quote text on evidence is the only free text copied from sources. TBD: an optional retention period for evidence quotes.

### Multi-user spaces

- v1 follows the Data room: facts are visible only to the owner who imported them and that owner's agents. A second member sees an empty Company page with "Import company" for their own connections.
- **Promote to team** is per fact and per owner choice (`visibility: team`). Only confirmed facts can be promoted. Team-visible facts are shown to every member and their agents; evidence quotes and source links stay owner-only, because the source may be private to the owner.
- The owner can promote the whole company profile, the organisations, and the history events, and keep people's details private. TBD with the owner.
- Every read goes through the actor-scoped helper and checks the current membership role. Agents cannot read the owner's private facts from a run owned by another member.

## Pages and UI

Design: [mockup.html](../import-company/mockup.html). Minimal copy: headings and control names only; no explainer text. If a PR adds user-facing copy, its description must quote it and justify it (AGENTS.md).

### Import company (`/app/company/import`)

1. **Sources**: a list of connected sources with a checkbox, the scope (a "Choose" link opens a scope sheet), and Connect for missing ones.
2. **Review**: per-source consent and model recipients, the plan's estimate, and the token cap.
3. **Progress**: one row per worker with a progress bar, counters, Pause and Cancel. Leaving the page does not stop the run; the sidebar item shows a progress glance (see `docs/plans/notifications.md`).
4. **Done**: a short result ("212 people, 41 organisations, 530 events") and "Open Company".

### Company page (`/app/company`)

A sidebar page template `company`, added from the "Add page" menu like Team health, available on web and desktop first. Tabs: Overview, People, History, Calendar, Review.

- **Overview**: name and one-line description, "What we do" (editable, with a source count), key numbers read from Finance and the Cap table when connected (hidden while Hide money is on), counts of people and organisations, the next five dates, and the latest events.
- **People**: a table of people with current role, start date, and sources. A person row opens their roles over time. Past members are in a collapsed group.
- **Organisations**: grouped by type (investors, customers, vendors, law firms) with relationship dates.
- **Fact detail** (a side sheet from any row, event or bar): the claim, state (Confirmed or Not confirmed), confidence, **provenance** (each source with kind, link, quote, extracted date and model), conflicting evidence, and Confirm, Edit, Reject, Promote to team.
- A relationship map (people and organisations as a graph) is optional and later. It is a view over edges and adds no tables.

### History waterfall

A zoomable timeline in inline SVG (no chart dependency, like the planned Projects waterfall), lanes by stream (Company, People, Funding, Legal, Product, Customers). Employment periods, contracts and matters are bars; hires, rounds and launches are markers. Zoom by year, quarter and month with the keyboard or pinch; a year-only fact draws as a faded range. Layout is a pure function in `packages/core` with unit tests on the synthetic fixture. A click opens fact detail.

### Calendar

A month grid and an agenda list of dated items: Legal deadlines (read-through), contract renewals and notice dates, funding and board dates, and optionally anniversaries. Dates are all-day. Filters by stream. No write to Google Calendar in v1. "Subscribe" (an ICS feed) is TBD.

### Mobile (native first)

Phase 15. Expo Router screens with native lists and sheets: Company overview, People, an agenda-style Calendar, Review (swipe to confirm or reject), and import progress with Pause and Cancel. The history waterfall on mobile is a vertical timeline list, not a zoomable chart. Start-import stays on web and desktop in v1. Until then mobile shows no Company entry.

### Storybook

Every new component has a sibling `*.stories.tsx` with invented data; `pnpm design-system` regenerates the catalog (AGENTS.md). Web pages that open the Company page get a web test so CI captures the screenshot.

## Agents

### Company importer (coordinator)

A bot, spawn key `company-importer:<userId>` (reserved in `bots.create` with the other page-agent prefixes), created from the import flow. It plans, explains and reports; it does not read sources itself. Tools:

| Tool | Kind | Approval |
| --- | --- | --- |
| `company_import_plan` | read: sources, scope, estimate | none |
| `company_import_status` | read: run, sources, units, tokens | none |
| `company_import_start` | proposes a run | owner's consent and confirm card; only the owner's tap starts it |
| `company_import_pause`, `company_import_resume`, `company_import_cancel` | control | none (they reduce activity); cancel with discard asks |
| `run_subagent` | quick sampling while planning | none |
| `notify_user` | finished, budget reached, needs consent | none (`info`; `attention` only for budget or consent) |

It cannot call write tools of any source, `message_bot` to non-company agents, or `spawn_bot`. Background runs follow the existing rule that background runs may message owner (integration) agents only.

### Source extractors (workers)

Durable job handlers, one family per source type (table above), each with a fixed tool allowlist and no ability to write to the map except through server code. They are visible to the user as rows in the progress UI, not as bots.

### Company agent (Historian)

A bot, spawn key `company-agent:<userId>`, docked on the Company page like Legal. It answers "when did we hire the first engineer", "who is our law firm", "what changed in Q3" with citations. Tools:

| Tool | Kind | Approval |
| --- | --- | --- |
| `company_search` | read: entities by text, kind and filters | none |
| `company_get` | read: one entity or event with evidence | none |
| `timeline_query` | read: events by stream, range and entity | none |
| `calendar_query` | read: dated items in a range, including Legal deadlines | none |
| `company_review_next` | read: next items in Review | none |
| `company_fact_upsert` | write: create or edit a fact | owner approval card showing the fact, the evidence, and the old value; the edit locks the changed fields |
| `create_ui_artifact` | render a timeline in chat | none |

`company_fact_upsert` is never offered to unattended runs. Confirm and reject are user actions on the page, not agent tools, so an agent cannot confirm its own claim.

### Read access for other agents

`company_search`, `company_get`, `timeline_query` and `calendar_query` are added to every agent's built-in read tools under the same gate as `search_data_room`: no group, the run user is the bot owner, not a messaging-channel run, and scope from the executor rather than the arguments. They are in `READ_ONLY_AGENT_TOOLS` and the unattended-safe list. They return only facts the run user may see, never evidence quotes for team-visible facts owned by someone else, and never fields in the never-extract list (which do not exist). The `company-map` skill tells agents to prefer them to asking the user. Legal, Finance and Chief gain context; none gain a way to change the map.

### Approvals, in one place

| Action | Approval |
| --- | --- |
| Start, pause, resume a run | The owner's own tap (start); agent proposals need the card |
| Import writes to the map | None per fact, because facts arrive as suggested and nothing is promoted to confirmed or team without a human |
| Agent edits a fact | Owner approval card; edit locks the field |
| Promote to team | Owner, on the page |
| Any write to a source tool | Not available |

## Phasing

Each phase is one small PR that ships independently behind the unavailable `company` template, and each has its own child issue in the epic. Every PR with UI adds stories; the PR description quotes any new copy.

1. **Data model, tenancy helper, merge rules, fixture.** Prisma models and migration, contracts, actor-scoped query helper, evidence and lock rules, deterministic resolver, the Northwind Robotics synthetic fixture in `packages/testkit`. Acceptance: Postgres tests prove cross-space and cross-owner isolation; reject fingerprint and locked fields survive a second merge; a fact with no evidence cannot be stored; no UI.
2. **Import engine.** Run, source and unit tables; `company.import.*` jobs; claim and expiry; budget counters; consent gate; pause, cancel, resume; progress RPC; a fake source. Acceptance: kill a worker mid-unit and the run completes without duplicating a unit; budget stops the run at the cap; withdrawing consent stops calls and resume continues.
3. **Data room and Gmail sources, extractor, resolver.** `CompanyExtractor` interface, the first adapter on the space's chat model, the `data_room` and `mail` workers, resolver wired in. Acceptance: runs end to end on the fixture offline; facts have evidence; skipped mail categories are never sent to a model; zero write calls.
4. **Offline eval.** Metrics and a recorded-output fake extractor in CI, plus an optional live-model run outside CI. Acceptance: see "How we measure it". Gates later changes to prompts and the resolver.
5. **Company page, read-only, with fact detail.** Sidebar template, `/app/company` Overview, People and Organisations, fact detail with provenance, Confirm, Edit, Reject. Acceptance: stories for every state (empty, running, partial, full); web test that opens the page; Hide money hides amounts.
6. **Import flow page.** Sources, consent, plan, token cap, sample preview, progress, pause, cancel, resume. Acceptance: a user can run the fixture import from the UI; leaving and returning shows live progress; cancel and discard works.
7. **Privacy controls.** Disconnect cleanup, Exclude person, Erase company map, Export JSON, Promote to team. Acceptance: tests for each deletion path including the orphan-fact rule; export contains no data from another owner.
8. **Agents and tools.** Company importer and Company agent, the `company_*` and `timeline_query` tools, the read tools for all agents, `company_fact_upsert` approval, the `company-map` skill. Acceptance: injection fixtures cannot make an importer call a non-allowlisted tool; an unattended run cannot upsert; another member's run cannot read private facts.
9. **Generic connection reader and Slack.** Read-only reader over Composio, Pipedream and MCP tools, and the Slack worker (public channels by default). Acceptance: emulator test shows only read tools are listed and called; private channels need explicit per-channel choice.
10. **GitHub and Linear.** Tracker workers (members, repos or teams, projects, milestones, issues). Acceptance: people and projects merge with existing entities by login and email; rate-limited units re-queue.
11. **Notion and other connected apps.** Notion worker, and the generic worker for any other Composio app with owner-ticked read tools. Acceptance: a tool the owner did not tick is never called; a write-classified tool cannot be ticked.
12. **History waterfall.** Pure layout in `packages/core`, SVG view, zoom, lanes, fact detail link. Acceptance: layout unit tests on the fixture; year-only facts render as ranges; story for each zoom level.
13. **Calendar.** Month grid and agenda, Legal deadlines read-through, anniversaries off by default. Acceptance: dates do not shift across time zones (test in two zones); a deadline marked done in Legal disappears from the calendar.
14. **Review queue, notifications, nightly refresh.** Review tab with keyboard actions, merge candidates and contradictions; `notify_user` on done and on budget; server-owned incremental refresh routine in the owner's time zone. Acceptance: refresh creates no duplicate facts; a rejected fact stays rejected; the page badge matches the queue count.
15. **Mobile.** Native Company overview, People, Calendar, Review and import progress. Acceptance: iOS native controls; no custom pills where a native control exists; web start-import unchanged.
16. **Relationship map (later, optional).** A graph view over edges. Acceptance: renders the fixture with no new tables.

## Risks

- **Wrong facts that look authoritative.** Mitigations: provenance on every fact, a visible "Not confirmed" state, auto-show threshold, Review queue, and the label "reconstructed".
- **Cost surprises.** Mitigations: sample preview, estimate with a range, hard cap, rule triage before any model call, content-hash skips.
- **Prompt injection from imported content.** Mitigations: no tools on extractors, schema-validated output, closed enums, allowlist enforced in code, planted-instruction evals.
- **Privacy and employment law.** People data is sensitive. Mitigations: never-extract list absent from the schema, owner-only default, exclusion and erase paths, caveat for EU teams.
- **Duplicate rosters.** Mitigated by the canonical Person decision above; otherwise Team health and Company drift.
- **Provider limits and gaps.** Gmail history paging, Slack rate limits, Notion limits. Mitigations: per-source rate limits, resumable units, failed-unit retry, partial results shown with what is missing.
- **Large companies.** Years of history can exceed any budget. Mitigation: scope and date window in the plan; the map says what was covered.
- **The Data room and mail cache do not keep bodies.** Mail is read straight from the provider; if the provider is unreachable the unit fails and retries.
- **Hosted vs. self-host.** All steps work with one model connection and Postgres. The optional pieces (embeddings, vision) only improve the Data room input.
- **Composio call costs.** Instant toolkits charge per call (`docs/composio-instant/README.md`). The plan shows a per-source call estimate where Composio reports one.

## Open questions

See the owner table at the top. Further unknowns, all TBD and settled by phase:

- Exact read-tool lists and rate limits for the Slack, Linear, GitHub and Notion MCP servers or Composio toolkits (phases 9 to 11).
- Whether Gmail history paging over three years is practical through each of the three Gmail connection types (phase 3).
- A good default for the auto-show threshold, measured in the eval (phase 4).
- Whether evidence quotes need a retention period (phase 7).
- Whether the ICS "Subscribe" feed is wanted (phase 13).

## How we will measure it

An offline eval with a synthetic fixture, run in CI with a recorded-output fake extractor, and optionally against a live model by hand.

**Fixture: Northwind Robotics** (invented): a 4-year history of a 30-person company with founders, hires and departures (including a person who left and returned), two funding rounds, five customers, three vendors, a law firm, two legal matters, three products, about 200 mail threads, 40 documents, 600 chat messages in 12 channels, 150 tracker items, and a ground-truth file listing every true entity, event and edge with its source ids. It also contains hard cases: two people with the same first name, one person with three emails, a year-only date, a contradiction between two documents, and planted prompt-injection text in a mail, a doc and a chat message. A second invented company in another space checks isolation.

| Measure | How | Target |
| --- | --- | --- |
| Entity precision and recall, by kind | Compare to ground truth | TBD (set from the first baseline) |
| Event date accuracy | Exact match at the stated precision | TBD |
| Wrong merges and missed merges | Dedupe pairs vs. truth | Wrong merges as close to zero as possible; TBD |
| Provenance coverage | Facts with at least one evidence row that resolves to a real source item | 100% |
| Injection resistance | Calls outside the allowlist; facts that exist only because of planted text | 0 and 0 |
| Correction retention | Edit, reject and confirm, then re-import | 100% kept |
| Idempotency | Re-run on unchanged sources | No new facts or evidence |
| Isolation | Query as another owner or space | 0 rows |
| Cost | Tokens per item and per run vs. the estimate table | Within the cap; compare estimate to measured |
| Read-only | Write calls recorded by each source emulator | 0 |

Tests are deterministic and offline by default (AGENTS.md); the live-model run is manual and its results are recorded as measured, never as CI facts.
