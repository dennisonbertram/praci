# Data room plan

## Goal

A searchable store of everything a company (or a family) knows, in its own space.
Drop a file anywhere in the app and it is uploaded, read, tagged and filed. A Data
room page lets people browse it like Google Drive. A Data room agent watches new
items and keeps them organized. Every agent in the space can search and read it
through one tool. Connected sources (Google Drive first, then important Gmail,
chat history and finance records) feed the same index.

Web and desktop (Electron hosts the web UI) ship first. Mobile follows with a
native document picker and share-sheet upload, plus a read-only browse view; until
then mobile shows nothing new, which is safe because no existing workflow changes.

## Prior art: Shoebox

Shoebox, a separate single-user, local-first document archive by the same author,
already runs this pipeline end to end and is the working reference for the design.
Its source is private, so this section records what carries over:

- Files are deduplicated by SHA-256 and stored once under their hash, and the
  database row points at the blob.
- Each item moves through persisted states (discovered, ingested, read,
  understood, organized, indexed), and each step's outcome is saved so a retried
  job never repeats a model call.
- One structured model call per document extracts type, title, date, parties,
  amounts, due date, summary, keywords and a proposed folder.
- Chunks are keyed by (document, ordinal) with a content hash, so re-indexing only
  touches changed text, and an index version forces a full rebuild.
- Search runs a BM25 keyword leg and a vector leg, over-fetches 100 candidates
  each, merges them with reciprocal rank fusion (k = 60), groups by document and
  returns citations (document, page, snippet).
- Facet filters resolve to an eligible set first, and both legs search only
  inside it.
- The chat tools are read-only; a change the model proposes needs the user's
  confirmation.

What the Data room does differently, because Shoebox does not need it or got it
wrong: every row is scoped to a space and checked on every read; Postgres and
pgvector replace SQLite so several API and worker processes share one store;
chunks have a size cap (Shoebox chunks by page with no cap); facets are typed
columns instead of JSON strings; deletion removes data instead of hiding it; and
providers sit behind interfaces instead of one hard-coded vendor.

## Tenancy

- **The space is the boundary.** A company is a space; a family is a space. Every
  Data room row carries `spaceId` and the `userId` that added it, every query
  filters by `spaceId`, and every request goes through `requireMembership`. Nothing
  is ever visible across spaces, organizations or owners, including through search
  ranking, counts, dedupe or embeddings.
- **V1 shows each item only to the person who added or connected it,** and to
  that person's agents. Spaces can already have several members and Inbox data is
  private to its owner, so space-wide visibility would weaken today's rules. For a
  founder alone in a space this is everything. Synced items also keep their
  connection's agent limits (`allAgents`, `BotConnectionAccess`).
- **Keep later roles possible without building them.** Later a space gains members
  (a spouse, children, employees) and agents gain limits. To keep that a small
  change, all reads go through one query helper that takes an `Actor` and returns
  the eligible items. The helper filters by `spaceId` and `userId` and applies connection agent
  limits; V2 adds explicit sharing with other members inside it instead of
  touching every caller. Counts, snippets, previews and downloads all use it.
- Dedupe is per owner within a space: the same file added by two people, or in two
  spaces, is two items with two blobs.

## Decisions

1. **Name.** "Data room" in the UI and `dataRoom` in code. It avoids "memory",
   which already means per-bot notes (`MemoryStore`, `SemanticMemoryProvider`).
2. **Blobs go to S3-compatible object storage behind `ArtifactStore`.** The existing
   `LocalArtifactStore` writes to the process's disk, which breaks with several API
   and worker processes. Add an S3-protocol adapter (works with AWS S3, R2, MinIO,
   or any compatible store), configured by generic endpoint, bucket and credential
   settings with no vendor-specific variables. The local adapter stays for
   single-process development. Each stored blob gets its own random key under
   `artifacts/<spaceId>/`, so deleting one item can never remove another item's
   bytes. Buckets must not retain object versions, or deletion must purge them.
   Encryption at rest beyond the store's own is V2.
3. **Postgres holds metadata, text, tags and the index.** Keyword search uses a
   `tsvector` column with a GIN index. Vector search uses pgvector as an exact scan over the
   owner's eligible chunks. A shared approximate (HNSW) index filters after the
   index scan, so other spaces' rows would change recall; per-space partitioned
   indexes can be added if exact scans get too slow. This changes the Postgres image to `pgvector/pgvector:pg16` in compose,
   CI and the self-host docs.
4. **Embeddings sit behind a new `Embedder` interface** in adapter-kit, with one
   adapter for the OpenAI-compatible `/embeddings` endpoint reached through the
   shared model connection settings. Without an embedder configured, search is
   keyword-only and still works. Each chunk stores the embedding model that produced it. Search only
   compares vectors from the space's current model; chunks from another model fall
   back to keyword-only until a background job re-embeds them.
5. **Classification sits behind a `DataRoomClassifier` interface.** It runs once on
   ingest (document type, parties, dates, amounts, summary, proposed folder, tags)
   and once on search (turning a question into filters plus a query). The first
   adapter uses the space's chat model with structured output. A TypeSafe adapter
   can follow as an optional provider; neither is required to run the product.
6. **Gmail bodies are indexed only for mail worth keeping.** A message is indexed
   when triage marks it `critical` or `important`, or the sender is marked
   `important`, or its category is `reply`, `action`, `billing`, `receipt`,
   `scheduling`, `security` or `personal`. `newsletter`, `bulk`, `notification`,
   `suspicious`, `spam`, `scam` and senders marked `noise` are never indexed. This
   reuses the existing Inbox triage (`InboxCategorySchema`, `InboxMarkSchema`)
   instead of a second classifier. Triage and sender marks change locally after a
   message is synced, so a change to either re-checks the affected messages and
   adds or purges them. Exclusions win when rules disagree.
7. **Deletion is real.** Removing an item deletes its row, chunks and vectors in
   one transaction and queues a job that deletes the blob, so a crash between the
   two leaves a retried cleanup job rather than an orphaned file. Running jobs for a
   deleted item stop at their next write. Deleting a synced item keeps a small
   record (source and external id only, no content) so the next sync does not
   bring it back. Disconnecting a source deletes everything that source
   contributed.
8. **AI consent needs its own disclosure.** The current Inbox consent covers short
   previews, not full documents. The Data room adds a disclosure that names what is
   sent (full document text, page images for vision) and to which providers, and
   the backend checks it before every vision, classification and embedding call,
   including background re-embedding.
9. **Agents add documents on their own; a separate agent files them.** Any agent
   may call `add_to_data_room`, but items arrive unfiled with no folder, name or
   tags. Organizing is the Data room agent's job, and it has no delete tool. The
   20 KB image cutoff keeps logos and signatures out. A repeat import of the same
   external id returns the existing item, with or without a connection, so
   concurrent adds of one artifact file it once. Search and read hide items
   imported through a connection the user denied that agent.

## Data model

All tables carry `spaceId` (cascade on space delete) and `userId`.

- `DataRoomFolder`: `id`, `parentId`, `name`, `createdBy` (`user` or `agent`).
  Folders belong to their owner like items do. Unique on (`spaceId`, `userId`,
  `parentId`, `name`), so one member's folder names never collide with, or
  reveal, another member's.
- `DataRoomItem`: `id`, `folderId`, `source` (`upload`, `drive`, `gmail`, `chat`,
  `finance`), `sourceConnectionId`, `externalId`, `sha256`, `storageKey` (null when
  the source keeps the bytes), `name`, `mimeType`, `size`, `sourceUrl`,
  `sourceUpdatedAt`, `status` (`pending`, `extracting`, `classifying`, `indexing`,
  `ready`, `failed`), `error`, plus the facets below. Unique on (`spaceId`,
  `userId`, `sha256`) for uploads and (`spaceId`, `sourceConnectionId`, `externalId`) for
  synced items.
- **Facets** are columns, not free JSON, so filters use indexes: `docType`,
  `docDate`, `parties text[]`, `amountCents bigint`, `currency`, `tags text[]`,
  `summary`. GIN indexes on the arrays. The fixed set keeps search fast and
  predictable; anything else goes in `tags`.
- `DataRoomChunk`: `id`, `itemId`, `ordinal`, `text`, `contentHash`, `tsv`
  (generated), `embedding vector`, `embeddingModel`. Chunks are about 800 tokens
  with overlap and a hard cap, so long pages split. Re-indexing skips a chunk only
  when both its `contentHash` and `embeddingModel` are unchanged.
- `DataRoomSyncState`: one row per source connection with a cursor, throttle and
  claim token, following `MailSyncState` and `FinanceSyncState`.

## Pipeline

Background jobs on the existing Graphile queue (extend the job union, the zod
payload map and `background-job-handlers.ts`):

1. `dataroom.ingest`: read the blob and extract text (PDF text layer; images and
   scanned PDFs (first 20 pages, rendered by the optional `renderPdfPages` dependency) through a
   vision-capable model when one is configured; plain text, Markdown, CSV, HTML, JSON;
   .docx, .xlsx and .pptx read locally from their XML with a 50 MB unzip cap; legacy
   binary .doc, .xls and .ppt give no text). Items that were stored without text are
   re-ingested when the user grants AI consent (`requeueReady("ingest")`).
2. `dataroom.classify`: fill the facets and propose a folder. New items are filed
   automatically; the user can move them, and moves are kept as examples for the
   classifier.
3. `dataroom.index`: chunk, embed, write `tsv` and vectors.
4. `dataroom.sync`: one job per source connection, incremental by cursor (Drive
   changes page token, Gmail `historyId`).

Each step saves its outcome on the item, so a job retried after the save does not
repeat the model call. A worker that crashes after the provider answers but
before saving repeats that one call, so model calls are at least once and
bounded by the retry limit. Each step writes only if the item has not changed
since the step started, so a stale job cannot overwrite newer results. A job
that exhausts its retries leaves the item `failed` with the error shown on the
item.

## Search

One SQL query: a keyword leg (`websearch_to_tsquery`, ranked by `ts_rank_cd`) and a
vector leg (exact cosine distance over eligible chunks from the current model), each over-fetching about 100 chunks from the
eligible set, merged with reciprocal rank fusion (k = 60) and grouped by item.
Facet filters from the classifier narrow the eligible set before either leg runs.
Results carry citations: item, chunk ordinal, snippet, source link.

Latency target: TBD, set and measured once real-sized synthetic data exists.

## Surfaces

Design: [mockup.html](mockup.html) (sample data only).

- **Drop anywhere.** A drop zone over the whole web and Electron app shell. Dropped
  files upload to the current space's Data room and show progress in a toast that
  links to the filed item. Size cap TBD (the chat attachment cap of 10 MB is too
  small for contracts and statements).
- **Data room page.** Folder tree, list and grid views, and one bar holding search,
  facet filters and sort. Search, filtering, sorting and pagination all run on the
  server; the client never sorts or filters a fetched page. Hovering or moving the
  keyboard focus over a row updates the preview pane, and a click pins it. The
  preview has its own Ask agent, which opens the agent panel with that document
  attached. Move, rename and delete. Built from the existing shadcn components.
- **Data room agent.** One agent per owner in a space, created by a "Create Data
  room agent" button like the Inbox agent (spawn key `data-room-agent:<userId>`).
  It reads only that owner's items. It reviews newly filed items, fixes misfiled
  ones, flags duplicates and answers questions in a side panel on the Data room
  page.
- **Agent tools (every agent, owner-only runs).**
  - `search_data_room` (read-only): same filters as the `dataRoom.search` API,
    `limit` up to 20. Returns item ids, names, document types, dates and short
    snippets.
  - `read_data_room_item` (read-only): name, folder path, summary, facets and the
    extracted text, cut at 100,000 characters like `drive_read`.
  - `add_to_data_room`: exactly one of `message_id` with `attachment_id`,
    `drive_file_id`, or `artifact_id`. It files through the same helper as the
    Inbox and Drive imports (`createFileDataRoomItem`, in `packages/adapters`),
    so a repeat is a no-op. The item lands at the root, unfiled. It takes no
    folder, name or tags. If the Data room consent was not accepted it adds
    nothing and answers that the Data room is off. It skips inline mail parts,
    images under 20 KB, `.ics` and `.vcf` files ("Not a document.").
  - Gate: offered only when no group, the run user is the bot owner, and the run
    is not a messaging-channel run (the mail and Drive rule). Scope comes from the
    executor, never from tool arguments; mail and Drive sources respect the
    connections the user denied that agent. The Inbox and Finance agents get the
    tools too.
  - No approval, and webhook and routine runs may call all three. The names are in
    `BUILTIN_TOOL_NAMES` (per-bot disable) and `UNATTENDED_SAFE_BUILTIN_TOOLS`;
    search and read are also in `READ_ONLY_AGENT_TOOLS`.
  - Every agent's shared guidance tells it to add documents it finds, receives or
    creates without being asked, and to leave filing to the Data room agent. The
    guidance is included only in runs that are offered `add_to_data_room`.

## Phases

1. S3-compatible `ArtifactStore` adapter, Postgres image change, schema, upload API,
   drop-anywhere, Data room page with folders and keyword search.
2. Extraction, classification and auto-filing; `Embedder`; hybrid search; agent
   tools.
3. Data room agent, with the three agent tools above first. The agent's organizer
   tools are `data_room_list_new`, `data_room_move`, `data_room_rename`,
   `data_room_tag`, `data_room_create_folder` and `data_room_flag_duplicate`. No
   agent has a delete tool. Changes are recorded in a `data_room_changes` log;
   `reviewedAt` null marks an item as new (there is no Inbox folder); duplicates
   point to the original with `duplicateOfId`. A debounced per-owner
   `dataroom.organize` job runs about 2 minutes after ingest. Undo from the change
   log is an optional follow-up.
4. Google Drive sync.
5. Gmail bodies for important mail (decision 6).
6. Chat history and finance records. Both already live in Postgres; decide then
   whether to copy them into chunks or search them in place and merge the results.
7. Mobile upload and browse.

V2: encryption at rest, per-agent and per-member access, members and roles inside
a space.

## Defaults chosen for the first build

- Uploads go through the API, streamed to the store, with a 50 MB cap per file.
  Presigned direct uploads can follow if large files become common.
- Vectors have a fixed 1024 dimensions for the deployment. The embedder asks for
  1024 dimensions where the endpoint supports it, and an embedder that returns
  another size is reported as misconfigured and search stays keyword-only.

## Open questions

- Which Drive files to index: everything the account can read, or only chosen
  folders.
- Retention for Gmail bodies once indexed.
