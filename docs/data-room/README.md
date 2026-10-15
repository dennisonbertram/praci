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

## Tenancy

- **The space is the boundary.** A company is a space; a family is a space. Every
  Data room row carries `spaceId` and the `userId` that added it, every query
  filters by `spaceId`, and every request goes through `requireMembership`. Nothing
  is ever visible across spaces, organizations or owners, including through search
  ranking, counts, dedupe or embeddings.
- **V1 assumes one owner per space.** Everything in a space's Data room is visible
  to its owner and to every agent in that space.
- **Keep later roles possible without building them.** Later a space gains members
  (a spouse, children, employees) and agents gain limits. To keep that a small
  change, all reads go through one query helper that takes an `Actor` and returns
  the eligible items. V2 adds a visibility rule inside that helper (per-member and
  per-agent, in the style of `BotConnectionAccess`) instead of touching every
  caller.
- Dedupe is per space: the same file in two spaces is two items with two blobs.

## Decisions

1. **Name.** "Data room" in the UI and `dataRoom` in code. It avoids "memory",
   which already means per-bot notes (`MemoryStore`, `SemanticMemoryProvider`).
2. **Blobs go to S3-compatible object storage behind `ArtifactStore`.** The existing
   `LocalArtifactStore` writes to the process's disk, which breaks with several API
   and worker processes. Add an S3-protocol adapter (works with AWS S3, R2, MinIO,
   or any compatible store), configured by generic endpoint, bucket and credential
   settings with no vendor-specific variables. The local adapter stays for
   single-process development. Keys are `dataroom/<spaceId>/<sha256>`. Encryption
   at rest beyond the store's own is V2.
3. **Postgres holds metadata, text, tags and the index.** Keyword search uses a
   `tsvector` column with a GIN index. Vector search uses pgvector with an HNSW
   index. This changes the Postgres image to `pgvector/pgvector:pg16` in compose,
   CI and the self-host docs.
4. **Embeddings sit behind a new `Embedder` interface** in adapter-kit, with one
   adapter for the OpenAI-compatible `/embeddings` endpoint reached through the
   shared model connection settings. Without an embedder configured, search is
   keyword-only and still works. Each chunk stores the model that embedded it, and
   changing models re-embeds in the background.
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
   instead of a second classifier.
7. **Deletion is real.** Removing an item deletes its chunks, vectors and blob.
   Disconnecting a source deletes everything that source contributed. No soft
   delete that leaves data on disk.
8. **AI consent applies.** Sending document text to an embedding or classifier
   provider is gated by the existing `AiDataConsent` rules
   (`docs/ai-data-sharing-review.md`).

## Data model

All tables carry `spaceId` (cascade on space delete) and `userId`.

- `DataRoomFolder`: `id`, `parentId`, `name`, `createdBy` (`user` or `agent`).
  Unique on (`spaceId`, `parentId`, `name`).
- `DataRoomItem`: `id`, `folderId`, `source` (`upload`, `drive`, `gmail`, `chat`,
  `finance`), `sourceConnectionId`, `externalId`, `sha256`, `storageKey` (null when
  the source keeps the bytes), `name`, `mimeType`, `size`, `sourceUrl`,
  `sourceUpdatedAt`, `status` (`pending`, `extracting`, `classifying`, `indexing`,
  `ready`, `failed`), `error`, plus the facets below. Unique on (`spaceId`,
  `sha256`) for uploads and (`spaceId`, `sourceConnectionId`, `externalId`) for
  synced items.
- **Facets** are columns, not free JSON, so filters use indexes: `docType`,
  `docDate`, `parties text[]`, `amountCents bigint`, `currency`, `tags text[]`,
  `summary`. GIN indexes on the arrays. The fixed set keeps search fast and
  predictable; anything else goes in `tags`.
- `DataRoomChunk`: `id`, `itemId`, `ordinal`, `text`, `contentHash`, `tsv`
  (generated), `embedding vector`, `embeddingModel`. Chunks are about 800 tokens
  with overlap and a hard cap, so long pages split. Re-indexing skips chunks whose
  `contentHash` did not change.
- `DataRoomSyncState`: one row per source connection with a cursor, throttle and
  claim token, following `MailSyncState` and `FinanceSyncState`.

## Pipeline

Background jobs on the existing Graphile queue (extend the job union, the zod
payload map and `background-job-handlers.ts`):

1. `dataroom.ingest`: read the blob and extract text (PDF text layer; images and
   scanned PDFs through a vision-capable model when one is configured; plain text,
   Markdown, CSV, HTML, JSON, Office documents).
2. `dataroom.classify`: fill the facets and propose a folder. New items are filed
   automatically; the user can move them, and moves are kept as examples for the
   classifier.
3. `dataroom.index`: chunk, embed, write `tsv` and vectors.
4. `dataroom.sync`: one job per source connection, incremental by cursor (Drive
   changes page token, Gmail `historyId`).

Each step records its outcome on the item, so a retried job does not repeat a
model call. A job that exhausts its retries leaves the item `failed` with the
error shown on the item.

## Search

One SQL query: a keyword leg (`websearch_to_tsquery`, ranked by `ts_rank_cd`) and a
vector leg (HNSW nearest neighbours), each over-fetching about 100 chunks from the
eligible set, merged with reciprocal rank fusion (k = 60) and grouped by item.
Facet filters from the classifier narrow the eligible set before either leg runs.
Results carry citations: item, chunk ordinal, snippet, source link.

Latency target: TBD, set and measured once real-sized synthetic data exists.

## Surfaces

- **Drop anywhere.** A drop zone over the whole web and Electron app shell. Dropped
  files upload to the current space's Data room and show progress in a toast that
  links to the filed item. Size cap TBD (the chat attachment cap of 10 MB is too
  small for contracts and statements).
- **Data room page.** Folder tree, list and grid views, search with facet filters,
  a preview pane, move, rename and delete. Built from the existing shadcn
  components.
- **Data room agent.** A per-space agent (spawn-key pattern of the Inbox agent) that
  reviews newly filed items, fixes misfiled ones, flags duplicates and answers
  questions in a side panel on the Data room page.
- **Agent tools.** `search_data_room` and `read_data_room_item`, both read-only,
  added to `BUILTIN_TOOL_NAMES` and `READ_ONLY_AGENT_TOOLS` and offered to every
  agent in the space. Scope comes from the executor, never from tool arguments.
  Moving or deleting items through the agent needs approval.

## Phases

1. S3-compatible `ArtifactStore` adapter, Postgres image change, schema, upload API,
   drop-anywhere, Data room page with folders and keyword search.
2. Extraction, classification and auto-filing; `Embedder`; hybrid search; agent
   tools.
3. Data room agent.
4. Google Drive sync.
5. Gmail bodies for important mail (decision 6).
6. Chat history and finance records. Both already live in Postgres; decide then
   whether to copy them into chunks or search them in place and merge the results.
7. Mobile upload and browse.

V2: encryption at rest, per-agent and per-member access, members and roles inside
a space.

## Open questions

- Upload size cap and whether uploads go through the API or straight to the store
  with presigned URLs.
- Embedding model and dimension for the default deployment. pgvector indexes need
  a fixed dimension, so a model change needs either a fixed dimension for all
  models or one index per model.
- Which Drive files to index: everything the account can read, or only chosen
  folders.
- Retention for Gmail bodies once indexed.
