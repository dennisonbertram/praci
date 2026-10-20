# Document filesystem

Status: approved plan. Nothing here is built.

## Goal

The owner asked for all documents to live in one place: folders for people, and in
the cloud one object store, so what users see is a virtual filesystem. Today files
are spread across three stores and three listings. This plan names every place
files live, proposes one tree backed by one blob store, and orders the work so the
smallest, most necessary change (getting local disk out of the multi-tenant path)
ships first.

## Owner answers

| Question | Answer |
| --- | --- |
| Chat attachments in the tree | Visible files under `/Artifacts/Chats/<chat name>`. |
| Agent workspace files | A snapshot in object storage first. Individual browsable files come in a later phase. |
| Artifacts sidebar entry | Stays, as a shortcut to the filtered Data room view. |
| Install without S3 settings | The compose stack bundles MinIO and creates the bucket on first start, so every install uses the S3 path. Local disk is an explicit opt-out for development only. |

Defaults chosen by the coordinator (not asked of the owner):

- Content-hash dedupe is deferred until after phase 7. Until then there is one blob per node.
- The tree is owner-only in shared spaces until the Data room sharing design lands.

## Inventory (as of main at 965302f48)

All blob bytes go through `ArtifactStore` (`packages/adapter-kit/src/interfaces.ts:412`).
`createArtifactStore` (`packages/adapters/src/s3-artifacts.ts:91`) returns the S3
adapter when any `RAKAZO_S3_*` variable is set and `LocalArtifactStore`
(`packages/adapters/src/artifacts.ts:9`, writes `<DATA_DIR>/artifacts/<spaceId>/<uuid>`)
otherwise. The API (`apps/api/src/app.ts:327-328`) and the worker
(`apps/worker/src/index.ts:176-177`) each build their own store from the same
environment. S3 keys are `[prefix/]artifacts/<spaceId>/<random uuid>`
(`s3-artifacts.ts:141`), never a path and never the content hash.

| Kind | Backend | Metadata | Scope | Listed in the UI | In Data room? |
| --- | --- | --- | --- | --- | --- |
| Data room items | `ArtifactStore` blob (S3 or local), key in `DataRoomItem.storageKey`, null when the source (Drive) keeps the bytes (`schema.prisma:2273-2290`) | `data_room_items`, `data_room_folders` (tree, `DataRoomFolder.parentId`), text in `DataRoomItemText`, chunks in `DataRoomChunk` | `spaceId` + `userId`; owner-only in v1 (`docs/data-room/README.md`, Tenancy) | Data room page: folders, search | Yes |
| Artifacts (files bots produce, and files users attach in chat) | `ArtifactStore` blob; same bucket and key shape as Data room; written by `createOwnedArtifact` (`apps/api/src/artifacts.ts:34`) and `thread-artifacts.ts:69` | `artifacts` table (`schema.prisma:1188`): `botId`, `groupId`, `runId`, `hash` (sha256), `storageKey`, versions through `rootArtifactId`, `clientNonce` | `spaceId` + `userId`; listing filters both (`apps/api/src/artifacts.ts:320`) | Artifacts page (`apps/web/src/pages/Artifacts.tsx`, `artifacts.listSpace`), and inline cards in chat | No. Separate table, separate page |
| Chat attachments | Same as Artifacts: an `Artifact` row with `groupId` set (the 10 MiB, MIME-allowlisted path, `ATTACHMENT_MAX_BYTES`) | `artifacts` | As above | Chat message blocks; also appear in the Artifacts page | No |
| Agent home files (the persistent workspace of a Computer) | `LocalAgentHomeStore(dataDir)` writes `<DATA_DIR>/homes/<homeKey>` on local disk (`packages/adapters/src/home.ts:18-48`; built at `apps/api/src/app.ts:327` and `apps/worker/src/index.ts:176`) | `computers.homeKey` (unique) and `homeRevision` (`schema.prisma:1136`); the files themselves have no rows | `Computer` has `spaceId`, `userId`; the path is `homes/<homeKey>` and is scoped only by that key | Computer app, Files tab (`apps/web/src/components/computer/FilesApp.tsx`), reads through `SandboxProvider.listFiles` | No |
| Sandbox (Computer) files while running | Docker supervisor volume, or a remote sandbox (E2B, Daytona, and so on); checkpointed into the home store by `checkpointComputerWorkspace` (`computer-workspace.ts:277`). For the Docker provider with a local home store, the home directory is used directly (`computer-workspace.ts:59, 283`) | None | Per Computer | Files tab | No |
| Agent session recordings (Pi sessions) | Local disk `<DATA_DIR>/pi-sessions/<userId>/<botId>` (`packages/adapters/src/pi-session.ts:27`), 30-day retention, optional | None | Directory names encode user and bot | Not listed | No (runtime data, not documents) |
| Inbox attachments | Not stored. Fetched on demand from the mail provider and streamed (`apps/api/src/inbox.ts:620`, `apps/api/src/inbox-attachment.ts`) | Provider ids only | Own account only (`ownMessage`) | Download link in the message dialog | Only if the user imports from email (`ImportFromEmail`), which creates `DataRoomItem` rows with `source = "gmail"` |
| Finance statements (uploaded CSV, OFX, PDF) | Postgres `bytea`: `FinanceStatement.fileBytes` (`schema.prisma:1919-1930`) | `finance_statements`, with `fileSha256`, `fileSize` | `spaceId` + `userId` | Finance page | No |
| Cap table | Postgres JSON only (`CapTableSnapshot.data`, `schema.prisma:2221`); no files | `cap_table_snapshots` | `spaceId` + `userId` | Cap Table page | Not applicable. Source Carta documents, if any, go through Data room |
| Legal contracts | No bytes. `LegalContract.dataRoomItemId` points at a Data room item (`schema.prisma:2417`) | `legal_contracts`, deadlines, graph | `spaceId` + `userId` | Legal page | Yes (derived from Data room items) |
| Finance receipts | A boolean only (`hasReceipt`, `schema.prisma:1985`); no file stored | | | | No |
| Mobile outbox | Device disk, until sent (`apps/mobile/lib/outbox-disk.ts`) | | | | Not shared state; leave as is |

### Object storage configuration

Variable names only (`.env.example:294-305`, `docs/self-host.md:416-431`):
`RAKAZO_S3_ENDPOINT`, `RAKAZO_S3_BUCKET`, `RAKAZO_S3_REGION`,
`RAKAZO_S3_ACCESS_KEY_ID`, `RAKAZO_S3_SECRET_ACCESS_KEY`,
`RAKAZO_S3_FORCE_PATH_STYLE`, `RAKAZO_S3_PREFIX`. All commented out by default; any
one set turns S3 on and a partial set stops startup. The dev stack uses a MinIO
container with a bucket named `rakazo` (values live in the local `.env` only).
`docs/self-host.md:431` states "Existing local files are not copied to the bucket".

## Findings

1. **Agent home files are on local disk, and they are the only durable copy.**
   `LocalAgentHomeStore` writes under `DATA_DIR/homes`. With several API or worker
   processes this works only if they share one volume (`docs/self-host.md:892`
   requires "a persistent `DATA_DIR` volume shared by API and worker"). That
   breaks the rule in AGENTS.md. `docs/hosted-service/README.md:426` already lists
   "`DATA_DIR` fully on object storage" as deferred scale work. The docker
   provider also takes a shortcut that depends on the local store
   (`computer-workspace.ts:59, 283`), so moving homes to S3 needs that path
   changed too. The E2B note at `docs/self-host.md:393` ("checkpoints to `DATA_DIR`")
   becomes false once homes move.
2. **Without `RAKAZO_S3_*` set, Data room and Artifact blobs are also local disk.**
   This is a supported single-process mode, not a bug, but it is the default.
3. **`LocalArtifactStore.put` returns the byte count as its `hash`**
   (`artifacts.ts:36`) while S3 returns a SHA-256. Callers that trust `.hash` get
   different things on the two backends. Rows compute their own SHA-256, so it
   works today, but the contract is inconsistent.
4. **Artifacts and Data room duplicate the same bytes and metadata.** Both hold a
   name, MIME type, size, SHA-256 and storage key, both are space and user scoped,
   and both use the same store. They differ in version history, bot/chat/run
   links, and the Data room's extraction, tagging and search pipeline.
5. **No cross-row dedupe.** Keys are random UUIDs, so identical bytes are stored
   again for every row. The Data room only dedupes by `(owner, sha256)` at the row
   level.
6. **Finance statement bytes sit in Postgres rows** (`fileBytes`). Fine for small
   CSVs, but PDFs make that table large; it is also invisible to the Data room.
7. **Deletes are by blob, not by reference.** Artifact deletion removes
   `storageKey` directly (`apps/api/src/artifacts.ts:485`) and the Data room
   enqueues a blob delete job. Content-hash sharing (below) needs reference
   counting first.

## Design

### One tree, one blob table

Add two Postgres tables and keep everything else.

`Blob`: `id`, `spaceId`, `sha256`, `size`, `storageKey` (the `ArtifactStore` id),
`createdAt`. Unique on `(spaceId, sha256)`. Bytes live in the existing
`ArtifactStore`; the store key stays an opaque id and is never a path. Dedupe is
per space only, never across spaces, to keep the existing rule that dedupe,
counts and ranking never leak across owners.

`DocumentNode`: `id`, `spaceId`, `userId`, `parentId`, `kind` (`folder` or `file`),
`name`, `blobId` (files only), `mimeType`, `source` (`upload`, `artifact`, `agent`,
`drive`, `box`, `gmail`, `chat`, `finance`), `system` (true for folders Praci
creates), `botId`, `groupId`, `runId`, `versionOf` (replaces `rootArtifactId`),
`version`, `createdAt`, `deletedAt`. Unique on `(spaceId, userId, parentId, name)`
for live nodes, so a path resolves to at most one node.

`DataRoomItem` keeps its enrichment (status, facets, text, chunks, legal links) and
gains `nodeId`. It stops owning name, folder and storage key. This keeps the search
pipeline untouched and makes the tree the single owner of "where is this file".

Deleting a file removes its node; the blob row is deleted, with its object, only
when no node references it. That is the one new rule, and it needs a job, not a
foreign-key cascade, because the object store must be told.

### Pages as views

The tree has system root folders, created on demand per owner:

- `/Data room` is today's Data room, with its user folders below it.
- `/Artifacts` holds files bots produce, grouped as `/Artifacts/<bot name>`; chat
  attachments appear under `/Artifacts/Chats/<chat title>` (or stay as nodes with
  `groupId` set and no visible folder, if the owner prefers; see open questions).
- `/Agents/<bot or computer name>` holds an agent's workspace files.
- Email-imported files already land in the Data room through `source = "gmail"`
  and can stay filed by the Data room agent.

The Artifacts page becomes a filtered Data room view (`source = artifact`, newest
first). Its sidebar entry stays as a shortcut to that view. The
Data room page gains the system folders. No new page is needed.

### Agents

Agents read and write through one tool and API pair over the tree (read, list,
write, move into folder, search). Writes by an agent that today need approval keep
it. Agents never delete: the tool has no delete, and an agent move or rename keeps
the old name in history. Writes by an agent go to its own `/Agents/<name>` or
`/Artifacts/<name>` folder by default and to the Data room only through the
existing Data room agent. Reads go through the same `Actor`-based query helper the
Data room already uses, so connection agent limits (`allAgents`,
`BotConnectionAccess`) still apply.

### Sandbox view of the tree

A sandbox (Computer) does not mount the tree. Keep the explicit-sync model that
exists today: the workspace is a directory inside the sandbox, checkpointed to the
store and restored on start. The change is where the checkpoint goes. Replace
`LocalAgentHomeStore` with a store that writes a workspace snapshot to object
storage (one archive object per Computer, or per-file blobs under
`/Agents/<name>` nodes), with a Postgres row holding the current revision. Phase 1
is the archive (owner decision), because it needs no tree changes and fixes the
multi-tenant bug. Per-file nodes (so a user sees agent files as documents) come later and
sync only an allowlist of folders, because a workspace also holds browser
profiles and caches. A FUSE-style live mount is not recommended: it adds latency,
a privileged container, and a second consistency problem.

## Migration without downtime

Every step is additive; each deploy runs with the old and new paths live.

1. Create `Blob` and `DocumentNode`. Nothing reads them yet.
2. Dual-write: new Data room items and artifacts create a node and blob row as
   well as their current rows.
3. Backfill with a worker job: for each `Artifact` and `DataRoomItem`, compute or
   reuse the SHA-256, create the `Blob` (reusing one that matches in the same
   space), and create the node. Rows already hold `hash`/`sha256`, so no object
   is re-read for the normal case. Duplicate bytes keep their object until the
   first reference-counted cleanup; moving them to one object is an optional
   second pass that copies, repoints, and deletes.
4. Switch reads to the tree behind a flag, one page at a time (Artifacts first).
5. Stop writing the old columns, then drop them in a later release.

Agent home migration is separate (Phase 1): on first checkout of a Computer, if no
snapshot exists in the object store, read the legacy directory from `DATA_DIR`,
write the snapshot, and mark the Computer as migrated. A deployment with a shared
volume keeps working until the flag flips.

## Risks

- **Permissions.** Data room items are owner-only today; so are Artifacts. The tree
  must keep `spaceId` and `userId` in every query and use the one `Actor` helper.
  System folders are per owner (a folder row per `(space, user)`), not per space,
  so a shared space never shows one member another's `/Artifacts`. Space-wide
  sharing, if wanted, is the Data room's V2 sharing design, not part of this plan.
- **Dedupe leaks.** Dedupe stays within `(spaceId, sha256)`. In a shared space two
  members uploading the same file share one blob row but have two nodes; the blob
  is never addressable except through a node the caller can read, and the upload
  response must not reveal that the bytes already existed for someone else (reply
  as if newly stored).
- **Reference counting.** Dedupe is deferred until after phase 7; until then each
  node owns one blob. Moving from "one blob per row" to shared blobs risks
  deleting bytes another node needs. Do not turn on blob sharing until the
  delete job checks references inside a transaction. Until then, keep the current
  one-blob-per-node behavior and just record `sha256`.
- **Quotas.** There are none today. Add a per-space byte count on `Blob` sums
  before enabling agent writes at scale, and fail with a clear error at the limit.
- **Large files.** `ArtifactStore.put/get` move whole files in memory
  (`stream: false` for S3). Fine for the 10 MiB attachment limit; not for large
  Drive or workspace archives. Add streaming and multipart upload to the adapter
  before workspace snapshots exceed tens of MiB, and keep the Data room's own size
  limit.
- **Versioning.** Artifact versions and Data room items differ. Map versions to
  `versionOf`/`version` on nodes and keep the "latest per name" listing query.
- **S3 consistency and cost.** Workspace archives checkpoint often; write only on
  change (compare the revision) and expire old archives.
- **Public repo.** No real paths, keys or document names in fixtures or docs.

## Phased PRs, smallest first

1. **Homes to object storage.** Add an `AgentHomeStore` adapter that keeps the
   workspace snapshot in the `ArtifactStore` (key per Computer, space-scoped),
   with a Postgres revision column; migrate lazily from the legacy directory;
   make the docker `LocalAgentHomeStore` special cases in
   `computer-workspace.ts` conditional on a capability, not an `instanceof`.
   Deterministic offline conformance test against a fake `ArtifactStore`. Update
   `docs/self-host.md` (volume note, E2B note). Also in this phase: the compose
   stacks (source checkout and published images) include MinIO with the bucket
   created on first start and `RAKAZO_S3_*` preset for the bundled service, so
   every install uses the S3 path. Local disk becomes an explicit
   development-only opt-out; update `.env.example` and the self-host docs to match.
2. **Contract fix.** Make `LocalArtifactStore.put` return a SHA-256 like the S3
   store; add a shared conformance test for both. Small, independent.
3. **Tree tables, dual-write.** `Blob` and `DocumentNode`, migrations, repository
   helper, writes from `createOwnedArtifact`, `thread-artifacts.ts` and
   `createFileDataRoomItem`. No UI change.
4. **Backfill job** and an invariants check (every row has a node, every node's
   blob exists).
5. **Artifacts page reads the tree** (filtered Data room view, sidebar shortcut kept, chat attachments under `/Artifacts/Chats/<chat name>`); web
   Storybook and an e2e screenshot for the changed page.
6. **Data room folders move onto nodes**; system folders (`/Data room`,
   `/Artifacts`, `/Agents`); the Data room page shows them.
7. **Agent file tool** over the tree (read, list, write, search), with the existing
   write approval and no delete.
8. **Workspace files as nodes** for an allowlisted folder (individually browsable agent files).
9. **Content-hash dedupe** with reference-counted blob deletion (after phase 7).
10. **Finance statement bytes** move to `Blob` (leave a nullable `fileBytes` until
   backfilled).
11. **Quotas and streaming/multipart** for large files.
