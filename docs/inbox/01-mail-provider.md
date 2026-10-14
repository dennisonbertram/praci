# Inbox item 1: provider-neutral mail access (Composio, Pipedream, Google)

Line anchors refer to `main` at `c9375d42`.

## Goal

Give the Inbox (items 2 to 7) one way to read a user's Gmail, whichever way the
account was connected:

- through Composio (managed OAuth),
- through Pipedream Connect (managed OAuth),
- through Rakazo's own Google OAuth client (no third-party broker).

All Gmail-specific code is written once. The three connection methods differ only in
how one authenticated HTTP call (`GET`, and now `POST`, `PUT` and `DELETE` with a JSON
body) reaches `gmail.googleapis.com`, and that is the only code each method adds.
Version 1 read mail (`gmail.readonly`); drafts and sending were added afterwards (see
decision 10 in the README). Labels, marking read and archiving come later and are
listed under "Later".

## Design in one paragraph

Composio (`tools.proxyExecute`), Pipedream (Connect API proxy) and a native OAuth token
can all send an authenticated request to the Gmail REST API for one connected account.
So the three adapters implement one small optional method, `proxy()`, on the existing
`ManagedConnectorProvider`. One class, `GmailMailProvider`, implements the
provider-neutral `MailProvider` interface on top of `proxy()`: it builds Gmail URLs,
pages, hydrates metadata with a per-account concurrency limit, decodes MIME bodies, and
maps HTTP status codes to typed errors. Accounts are ordinary `Connection` rows whose
app slug is `gmail`, so multi-account support, connect, rename and revoke reuse the
existing `connections.*` flow. Native Google is a third `ManagedConnectorProvider`
(`connectorId: "google"`), configured by the deployment owner in Integration setup the
same way Composio and Pipedream are configured, with no new environment variables.

```
items 2/4/5 ──> MailProvider (adapter-kit)
                   │
                   └─ GmailMailProvider (adapters)      Gmail REST mapping, written once
                        │  registry.managed(connectorId).proxy({ app, accountRef, url })
                        ├─ ComposioConnector.proxy   -> composio.tools.proxyExecute
                        ├─ PipedreamConnector.proxy  -> /v1/connect/{project}/proxy/{b64url}
                        └─ GoogleConnector.proxy     -> fetch with refreshed bearer token
```

## Interface

### `packages/adapter-kit/src/types.ts` (new types)

```ts
/** One connected mailbox. Built from a `Connection` row whose app slug is "gmail". */
export interface MailAccount {
  /** Connection.id. Stable key for tabs, caches and tool arguments. */
  id: string;
  /** Connection.connectorId: "composio" | "pipedream" | "google". */
  connectorId: string;
  /** Connection.provider (app slug as stored, e.g. "GMAIL" or "gmail"). */
  app: string;
  /** Connection.providerRef: the remote account id the connector authenticates as. */
  accountRef: string;
  /** Connection.displayName. */
  label: string;
  /** Owner of the Connection row. Every call checks these against the AdapterContext. */
  spaceId: string;
  userId: string;
  /** Mailbox address from the provider profile; null when the lookup failed. */
  address: string | null;
}

export interface MailAddress {
  name?: string;
  address: string;
}

export interface MailListRequest {
  /** Provider search syntax, passed through. Every adapter today speaks Gmail syntax. */
  query: string;
  /** Inclusive lower bound, YYYY-MM-DD. Translated by the provider. */
  after?: string;
  /** Exclusive upper bound, YYYY-MM-DD. Translated by the provider. */
  before?: string;
  /** 1..500 (Gmail's `maxResults` limit; the emulator enforces the same bound). Each listed message is hydrated, so this bounds quota per call. */
  pageSize: number;
  /** Opaque cursor from the previous page. */
  pageToken?: string;
  /** Resume an interrupted page: hydrate exactly these ids (a previous page's `unhydratedIds`) and skip `messages.list`. `query`, dates and `pageToken` are ignored. */
  ids?: string[];
  /** Default true: reuse metadata already in item 4's Postgres cache. Item 4's sync passes false to get fresh unread state. */
  useCache?: boolean;
}

export interface MailMessageSummary {
  id: string;
  threadId: string;
  /** ISO 8601, from Gmail internalDate (more reliable than the Date header). */
  date: string;
  from: MailAddress | null;
  to: MailAddress[];
  cc: MailAddress[];
  subject: string;
  /** Plain text; HTML entities decoded. */
  snippet: string;
  unread: boolean;
  labelIds: string[];
}

export interface MailMessagePage {
  messages: MailMessageSummary[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
  /**
   * Listed ids that were not hydrated because the caller's signal aborted or rate-limit
   * retries ran out. Empty or absent means the page is complete. Pass them back as `ids`
   * to finish the page; `nextPageToken` still points past the whole page.
   */
  unhydratedIds?: string[];
}

export interface MailMessage extends MailMessageSummary {
  /** text/plain part, or the HTML part reduced to text. At most 40,000 characters. */
  text: string;
  /** Raw text/html part when present, at most 200,000 characters. Untrusted. */
  html?: string;
  truncated: boolean;
  attachments: Array<{ filename: string; mimeType: string; size: number }>;
}

export type MailErrorKind = "auth" | "rate_limited" | "not_found" | "unavailable";

export class MailProviderError extends Error {
  constructor(
    readonly kind: MailErrorKind,
    message: string,
    readonly retryAfterMs?: number,
  ) {
    super(message);
  }
}

/** Authenticated passthrough to an app's own API for one connected account. */
export interface ConnectorProxyRequest {
  /** Connection.provider (app slug). */
  app: string;
  /** Connection.providerRef. */
  accountRef: string;
  method: "GET";
  /** Absolute https URL including the query string. */
  url: string;
}

export interface ConnectorProxyResponse {
  status: number;
  data: unknown;
  retryAfterMs?: number;
}
```

`MailProviderError` is a class, so it goes in `types.ts` next to the other exported
values. If `adapter-kit` keeps `types.ts` type-only, put it in a new
`packages/adapter-kit/src/mail-error.ts` and export it from the package index.

### `packages/adapter-kit/src/interfaces.ts`

```ts
export interface MailProvider {
  listAccounts(scope: { spaceId: string; userId: string }, context: AdapterContext): Promise<MailAccount[]>;
  listMessages(account: MailAccount, request: MailListRequest, context: AdapterContext): Promise<MailMessagePage>;
  getMessage(account: MailAccount, id: string, context: AdapterContext): Promise<MailMessage>;
}
```

Add one optional method to `ManagedConnectorProvider` (`interfaces.ts:201`):

```ts
  /** Authenticated GET against the app's API as one connected account. Status codes are returned, not thrown. */
  proxy?(request: ConnectorProxyRequest, context: AdapterContext): Promise<ConnectorProxyResponse>;
```

These are the names items 2, 4 and 5 use; their docs are aligned to them:

- `MailAccount` uses `id` (the Connection id) and `address`, as item 2 asked. It also
  carries `label` for item 4's tabs.
- `from` and `to` are parsed addresses, as item 4 asked. Item 2 formats them as
  `Name <address>` for its rows.
- `getMessage` returns `text` (item 2's "body") and an optional `html` (item 4).
- Item 4 syncs with `after` and two queries, `in:inbox` and `in:sent` (item 5 needs the
  user's sent mail to tell whether a thread was already answered), at page size 100.
  Item 2 searches at page size 500. Both are inside the one 1..500 bound.
- A page interrupted during hydration is returned, not thrown: item 2 keeps the
  hydrated messages and stores `unhydratedIds` plus `nextPageToken` as its resume
  cursor.
- `cc` is on the summary because item 5 classifies from metadata only.
- There is no `changesSince`. Item 4 re-lists the 14-day window. Add Gmail
  `history.list` later if re-listing costs too much quota.
- There is no `querySyntax` field. Every account is Gmail. Add a field when a non-Gmail
  provider lands.

## Where each piece lives

| File | Contents | PR |
| --- | --- | --- |
| `packages/adapter-kit/src/types.ts` | Mail types, `ConnectorProxyRequest/Response`, `MailProviderError` | 1 |
| `packages/adapter-kit/src/interfaces.ts` | `MailProvider`; `proxy?` on `ManagedConnectorProvider` | 1 |
| `packages/adapters/src/gmail-mail-provider.ts` (new) | `GmailMailProvider`, `createMailProvider`, `isMailConnection`, Gmail JSON and MIME mapping, per-account limiter | 1 |
| `packages/adapters/src/gmail-api-emulator.ts` (new) | `GmailApiEmulator` (Gmail REST fake), `createMailEmulator` (the `MailEmulator` item 2 asked for) | 1 |
| `packages/adapters/src/testing/mail-conformance.ts` (new) | `assertMailConformance(provider, emulator)` used by every adapter test | 1 |
| `packages/adapters/src/integration-provider-settings.ts` | `ConfiguredIntegrationProvider` forwards `proxy` and `resolveConnectedAccountId` | 1 |
| `packages/adapters/src/composio-connector.ts`, `composio-emulator.ts` | `proxy()` | 2a |
| `packages/adapters/src/pipedream-connector.ts` | `proxy()` | 2b |
| `packages/adapters/src/google-connector.ts` (new) | `GoogleConnector` (OAuth + `proxy()`) | 2c |
| contracts, router, web, mobile edits for Google | see PR 2c and 2d | 2c, 2d |

## Shared core: `GmailMailProvider` (PR 1)

```ts
export function createMailProvider(deps: {
  prisma: PrismaClient;
  connectors: Pick<ConnectorRegistry, "managed">;
}): MailProvider;
```

- **`isMailConnection(row)`**: true when `row.status === "connected"`, `row.providerRef`
  is set, and `row.provider.trim().toLowerCase() === "gmail"`. The connector can be
  any of the three. Item 4 uses this to decide which connections get a tab.
- **`listAccounts`**: reads `Connection` rows with `{ spaceId, userId }` from the
  scope argument (which must equal the context's), keeps `isMailConnection` rows, and
  takes `address` from `Connection.metadata.mailAddress`. When that key is missing it
  calls `GET /gmail/v1/users/me/profile` (1 quota unit) and writes the address back to
  `Connection.metadata`, so every API and worker process reads the same value from
  Postgres. If the lookup fails, `address` is `null` and the next call tries again.
- **Scope check**: `listMessages` and `getMessage` throw `auth` unless
  `account.spaceId === context.spaceId && account.userId === context.userId`. Callers
  get `MailAccount` values only from `listAccounts`, so this guards against wiring
  mistakes; it is not a second lookup.
- **`listMessages`**: the reference implementation's approach, ported as is. One
  `GET /gmail/v1/users/me/messages?maxResults=<pageSize>&q=...` (ids only, 5 units),
  then `GET .../messages/{id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=Date`
  for each id, at most 4 in flight per account (see Concurrency). Results keep list
  order.
- **Metadata cache (added by item 4 PR 1, which owns the table).** When `useCache` is
  not `false` and `deps.prisma` is set, `listMessages` first selects the page's ids
  from item 4's `CachedMailMessage` table (`WHERE connectionId = account.id AND
  providerMessageId IN (...)`), hydrates only the misses through the API, and upserts
  the newly hydrated summaries back into that table. Repeated and overlapping
  searches therefore cost one `messages.list` per page plus `get`s for new ids only.
  The lookup is keyed by Connection id, which `listAccounts` already scoped to the
  caller. `createMailEmulator` passes no `prisma`, so emulator tests run uncached. Dates become ` after:YYYY/MM/DD` and
  ` before:YYYY/MM/DD`. A non-empty query is wrapped in parentheses first, so
  `a OR b` combined with a date filter keeps its meaning.
- **`getMessage`**: `format=full`. The parser walks MIME parts, prefers `text/plain`,
  and falls back to the `text/html` part reduced to text with `JSDOM.fragment(html).textContent`
  (`jsdom` is already a dependency of `packages/adapters`). It decodes base64url with
  the part's charset through `TextDecoder`, using UTF-8 when the label is unknown. It
  collects attachment name, type and size without fetching attachment bodies.
- **Concurrency**: all requests for one account (`MailAccount.id`, the Connection id,
  so ids from different connectors cannot collide) go through a 4-slot limiter (about
  15 lines, a `Map<string, queue>`). The limit is per process, which is acceptable for
  v1: with N API and worker processes, one account can see up to 4×N concurrent
  requests. Correctness does not depend on it, because Gmail enforces the real
  per-user quota and the retry below handles its 429/403 answers. `ponytail:`
  per-process limiter; move to a Postgres-backed limit per connection if 429s become
  common. A map entry is removed when its queue drains, so the map does not grow with
  the number of tenants.
- **Status mapping (one place)**: 401, and 403 with reason `authError` or
  `insufficientPermissions`, map to `auth`. 429, and 403 with reason `rateLimitExceeded`
  or `userRateLimitExceeded`, map to `rate_limited` with `retryAfterMs`. 404 maps to
  `not_found`; a 404 from a `messages.get` during `listMessages` drops that message
  instead (it was deleted between list and get). Other non-2xx statuses and thrown
  transport errors map to `unavailable`.
- **Retry (ported from the reference)**: a `rate_limited` call is retried with
  exponential backoff, base 500 ms doubling per attempt plus random jitter, and
  `Retry-After` is honored when present. Retries stop at 3 attempts or when the
  caller's abort signal fires (item 2 aborts at its 60-second deadline).
- **Partial pages**: if retries run out or the signal fires during hydration, the
  `messages.list` call has already succeeded, so `listMessages` returns the messages
  hydrated so far (in list order) with the rest of the listed ids in `unhydratedIds`
  and the list's `nextPageToken`. Only a failure of the `messages.list` call itself,
  or an `auth` error, is thrown. With `ids` set, the same rule applies to the ids
  passed in. Item 2 uses this to report partial results with a resume cursor that
  loses nothing.
- **Response checks**: every field is read through `asRecord`/type guards
  (`connector-http.ts:106`). A malformed message is skipped, never thrown, during list.

### Emulator (PR 1): `gmail-api-emulator.ts`

`GmailApiEmulator.handle(accountRef, url): ConnectorProxyResponse` is a deterministic,
in-memory fake of the Gmail REST endpoints used above:

- `users/me/profile`, `users/me/messages` (list), `users/me/messages/{id}` (`metadata`
  and `full`).
- Query subset: `after:`, `before:`, `from:`, `in:inbox`, `in:sent`, `is:unread`, bare words
  (case-insensitive match on subject, snippet or from), and `OR` between groups in
  parentheses. Any other operator returns 400, so a test cannot pass by having its
  filter ignored.
- Paging with `maxResults` 1..500; a larger value returns 400, as the provider's own
  bound does. `pageToken` is an offset string.
- Seed data: two accounts (`acct-a`, `acct-b`) with fake `example.test` addresses and
  about 30 messages spanning several years, including one multipart/alternative
  message, one HTML-only message, one ISO-8859-1 body, and one attachment. `INBOX` and
  `SENT` label ids drive `in:inbox` and `in:sent`. The seed includes sent messages:
  at least one reply in the same thread as a recent inbound message (so item 4's sync
  and item 5's `alreadyHandled` can be tested) and one recent unanswered inbound
  message.
- Error mode: `failNext(status, { times, reason, retryAfter })`.

`createMailEmulator(seed?)` returns `{ provider: MailProvider, gmail: GmailApiEmulator }`.
The provider is a real `GmailMailProvider` whose `connectors.managed()` returns a stub
with `proxy` set to `gmail.handle`, and whose `listAccounts` returns the seeded
accounts. The emulator therefore exercises the production mapping code. Items 2, 4 and
5 use this in their tests.

The existing `composio-emulator.ts` mailbox works at the Composio-action level
(`GMAIL_FETCH_EMAILS`). It stays as it is. PR 2a only adds `proxy()` to it, delegating
to a `GmailApiEmulator`.

## Adapter A: Composio (PR 2a)

- `ComposioConnector.proxy({ accountRef, url })` calls
  `this.sdk().tools.proxyExecute({ endpoint: url, method: "GET", connectedAccountId: accountRef })`
  and returns `{ status, data, retryAfterMs }` from `ToolProxyResponse` (the
  `retry-after` header is in `headers`). The SDK is `@composio/core` 0.18.1;
  `proxyExecute` and `ToolProxyResponse { status, data, headers }` are in its typings.
- Composio documents that `endpoint` may be absolute when it uses the same registrable
  domain as the toolkit base URL. `gmail.googleapis.com` and `googleapis.com` match.
- `accountRef` is the Composio connected-account id. `begin` stores the
  connection-request id, which this codebase already treats as the connected-account
  id (`composio-connector.ts:650-655`), so existing Gmail rows work without migration.
- Errors are passed through `sanitizeComposioError` (`composio-connector.ts:913`).
- `ComposioEmulator.proxy` delegates to a `GmailApiEmulator`, so the testkit harness
  (`packages/testkit/src/cli/harness.ts:186`) and web E2E get a mailbox.

## Adapter B: Pipedream (PR 2b)

- `PipedreamConnector.proxy({ app, accountRef, url })` sends
  `GET /v1/connect/{projectId}/proxy/{base64url(url)}?external_user_id=<hashed>&account_id=<accountRef>`
  through the existing token, timeout and 2 MB cap handling (`pipedream-connector.ts:462-487`).
  This is the Connect API proxy documented by Pipedream. The proxy timeout is 30
  seconds.
- `request()` currently throws a generic `Error` on non-2xx. Add a variant that returns
  the status and parsed body, so 401 and 429 reach the status mapping in
  `GmailMailProvider`. The access-token reset on 401 stays.
- **Account ref.** Multi-account proxying needs an `apn_…` id. Pipedream's `begin`
  returns the app slug as state (`pipedream-connector.ts:289`). Only
  `resolveConnectedAccountId` turns it into an account id, and the
  `ConfiguredIntegrationProvider` wrapper does not forward that method today (the
  router reads it through a cast at `router.ts:5013-5021`). Reading the code, rows
  connected through Integration setup therefore keep `providerRef = "gmail"`. PR 1
  forwards the method; confirm this with the wrapper test listed below. For rows that
  still hold the slug, `proxy` lists the user's healthy accounts for the app. With
  exactly one, it uses that account. With more than one, it returns 401, which maps to
  `auth` ("reconnect").

## Adapter C: native Google OAuth (PR 2c, PR 2d)

### Configuration (no environment variables)

- Add to `IntegrationProviderConfigSchema` (`packages/contracts/src/integration-settings.ts`):
  `{ provider: "google", clientId, clientSecret }`, and add `"google"` to
  `IntegrationProviderIdSchema`. The deployment owner enters the values in Integration
  setup. They are encrypted and stored in `integration_provider_configs`, the same path
  as Composio and Pipedream (`integration-provider-settings.ts:93-112`).
- `IntegrationProviderSettings.create()` (`:40-45`) gains a `google` branch.
  `GoogleConnector` needs `prisma`, `secrets` and `identitySecret`, which the settings
  object already holds. It also needs `redirectUri`, which is
  `${webOrigin}/integrations/google/callback`. Pass it as a new optional settings
  option from `apps/api/src/app.ts:365`. The worker does not pass it, because the
  worker never calls `begin`.
- Save-time verification calls `listConnectedExternalIds`. For Google this is a
  database read, so wrong client credentials show up as Google's `invalid_client` page
  on the first connect. `ponytail:` add a token-endpoint probe if this confuses owners.

### Scopes

- Version 1: `openid email https://www.googleapis.com/auth/gmail.readonly`.
- Now also `https://www.googleapis.com/auth/gmail.compose` (drafts and sending). Accounts
  connected before it was requested only read; Google answers their writes with 403
  `insufficientPermissions`, which the provider reports as `auth` (reconnect).
- Now also `https://www.googleapis.com/auth/gmail.modify` (mark read or unread, archive,
  labels), through `MailProvider.listLabels` and `modifyMessage`. It is optional at connect
  like compose: an account without it keeps reading, and only a label change gets the
  `auth` (reconnect) error. Request scopes with `include_granted_scopes=true`, and mark
  accounts that lack a needed scope as needing reconnect only when that feature is used. Do
  not invalidate working accounts when the required set changes.

### Flow

1. `connections.begin({ connectorId: "google", provider: "gmail" })` goes through the
   existing handler (`router.ts:4628`). `GoogleConnector.begin` creates
   `state = base64url(32 random bytes)` and the PKCE verifier
   `base64url(HMAC-SHA256(identitySecret, "google-pkce:" + state))`. `state` is stored
   in Postgres (the pending `Connection` row's `providerRef`, below), and the verifier
   is recomputed from it with the deployment-wide `identitySecret`. Nothing is kept in
   process memory, so the callback can land on any API process. It returns the `accounts.google.com/o/oauth2/v2/auth` URL with
   `response_type=code`, `access_type=offline`, `prompt=consent` (so a refresh token is
   always returned), `include_granted_scopes=true` and `code_challenge_method=S256`.
   The router stores `state` in `providerRef`, as it does for the other connectors.
2. The web client opens the URL in the existing `rakazo-plugin-connect` popup and polls
   `connections.complete({ connectionId })`, unchanged. For Google, `connectionReady`
   returns `false`, so those polls do nothing until step 3 finishes. Desktop does not use
   this popup, because Google does not allow authorization inside an embedded browser.
   It uses the system browser instead (see Surfaces).
3. Google redirects to the new web route `/integrations/google/callback` (next to
   `/mcp/oauth/callback`, `App.tsx:151`). The page calls
   `connections.complete({ state, code })` with the user's session. Because the call
   requires the signed-in owner of the pending row, someone else cannot attach their
   Google account to this user's Rakazo account by sending a link (OAuth CSRF).
4. Router changes in `connections.complete` (`router.ts:4824`):
   - The input is extended, not replaced:
     `{ connectionId?: Id, state?: string, code?: string }`, refined so that exactly
     one of `connectionId` and `state` is present. Existing callers that poll with
     `connectionId` (`PluginsOverlay.tsx:240`, mobile integrations) keep working
     unchanged. With `state`, the router finds the row with
     `{ spaceId, userId, status: "pending", providerRef: state }`.
   - It keeps the result of `connector.complete()`. When the result has a `secretId`,
     the router treats the connection as ready, uses `connectionRef` as the account
     id, and writes `secretId` to the row.
   - If the same Google account is already connected (the existing `taken` check), the
     router deletes the new secret and returns `CONFLICT` with the message
     "This Google account is already connected."
5. `GoogleConnector.complete({ state, code })` exchanges the code at
   `oauth2.googleapis.com/token` with the derived verifier. It reads `sub` and `email`
   from `openidconnect.googleapis.com/v1/userinfo`, then stores
   `{ refreshToken, scope, sub, email }` through `SecretStore.put`. The ciphertext goes
   in a `Secret` row (`kind: "google-oauth"`, the user's `userId` and `spaceId`). It
   returns `{ connectionRef: sub, secretId }`. This needs
   `ConnectionAuthProvider.complete` to return `secretId?: string` (adapter-kit,
   `interfaces.ts:193-196`).
6. `GoogleConnector.proxy({ accountRef: sub, url })`:
   - It refuses any URL that does not start with `https://gmail.googleapis.com/`.
     Without this check, an access token could be sent to another host.
   - It finds the row by `{ connectorId: "google", providerRef: sub, spaceId, userId }`
     from the context, then loads the secret by the row's `secretId` with the same
     `spaceId`/`userId` filter.
   - It refreshes the access token when the cached token has under 60 seconds left.
     The cache is per process, keyed by Connection id, and is only a cache: a process
     that has never seen the account refreshes once and continues. The refresh token
     in the `Secret` row is the durable credential. `ponytail:` per-process
     access-token cache; each process refreshes on its own, which Google allows.
   - It retries once on 401 after a refresh. `invalid_grant` returns 401 (`auth`).
   - Token strings and the client secret are scrubbed from errors with
     `sanitizeConnectorError` (`connector-safety.ts:7`).
7. `revoke(sub)` posts the refresh token to `oauth2.googleapis.com/revoke`, ignoring
   400 (already revoked), and deletes the `Secret` row. The shared revoke handler
   (`router.ts:5163`) only sets the row's `status` to `"revoked"`; it does not delete
   the `Connection`, so nothing cascades. Mail data is therefore deleted explicitly in
   that handler: item 4's `deleteMailConnectionData` (cached messages, sync state, and
   from item 5 the to-dos for that connection) and item 2's `deleteMailSearches(prisma,
   { spaceId, userId })`. Every inbox, triage and search read also requires the
   connection's `status = "connected"`, so a revoked account's rows are invisible even
   before cleanup finishes.

Other `ManagedConnectorProvider` members:

- `catalog` returns one item, `{ slug: "gmail", name: "Gmail" }`.
- `listConnectedExternalIds` returns `["gmail"]` when the user has a connected Google row.
- `discoverTools` returns `[]`. Agent mail tools are item 2's built-ins.
- `execute` yields an error.

### Surfaces

- **Web (PR 2d)**:
  - `pages/GoogleOAuthCallback.tsx` is about 40 lines and follows `McpOAuthCallback.tsx`.
  - `IntegrationSetup.tsx` gets a "Google" choice with Client ID and Client secret
    fields, plus a read-only redirect URI line. The redirect URI must be visible
    because the owner has to paste it into the Google Cloud console. That is the only
    new explanatory copy.
  - **One Gmail entry.** When the native Google connector is configured, the catalog
    shows one Gmail entry, the Google one, and drops the managed (Composio or
    Pipedream) `gmail` entries. Otherwise the managed entry shows as today. This is
    the default, not a setting. It is one pure helper, `preferNativeGmail(items,
    { nativeGoogle })`, in `packages/contracts` next to the catalog item schema, so
    web, desktop and mobile apply the same rule. Web passes
    `nativeGoogle: nativeGoogleAvailable(desktopBridge())` (true in a browser, and in
    Electron only when the shell can open the system browser). Mobile passes `false`.
    `false` hides the Google entry and keeps the managed one.
- **Desktop**: signs in with the system browser. The system browser has no Rakazo
  session, so the web callback in step 3 cannot finish the sign-in there. Instead:
  1. The connect screen calls `connections.begin({ redirect: "desktop" })`. The router
     passes `GOOGLE_DESKTOP_REDIRECT_URI` (`http://127.0.0.1:53925/integrations/google/callback`,
     a fixed port in `packages/contracts`) to `GoogleConnector.begin` and records it in the
     pending row's `metadata.redirectUrl`. The connector only accepts that exact value;
     any other value falls back to the web callback.
  2. The connect screen hands the authorization URL to `desktop.oauth.open`
     (`apps/desktop/src/browser-auth.ts`, also used for model sign-in). The main process
     binds a one-shot listener on `127.0.0.1`, opens the system browser, accepts one
     request with the matching `state`, and sends `{ code, state }` back over IPC.
  3. The Electron window, which has the user's session, calls
     `connections.complete({ state, code })`. The router reads `metadata.redirectUrl` from
     the pending row, so the token request repeats the redirect URI used for authorization.
     PKCE stays server-side as before.
  4. Native Google shows on desktop only when the shell offers `oauth.open`
     (`nativeGoogleAvailable`); older shells keep the managed Gmail entry.
  The owner registers both redirect URIs in the Google client; Integration setup shows
  both. Accounts connected in a web browser keep working on desktop.
- **Mobile (PR 2d)**:
  - Mobile opens authorization URLs with `Linking.openURL`
    (`apps/mobile/app/(settings)/integrations.tsx:387`). That browser has no Rakazo
    session, so the session-checked callback in step 3 cannot complete.
  - Mobile therefore hides `connectorId: "google"` catalog items in v1 (accepted).
    Mobile can still connect Gmail through Composio or Pipedream when one of them is
    configured.
  - Google accounts connected on web or desktop work on mobile, because accounts belong
    to the user on the server.
  - This is an explicit, safe degradation. Revisit it if mobile moves OAuth to
    `WebBrowser.openAuthSessionAsync` with a session handoff.

## Migrations

None. `Connection.secretId` (`schema.prisma:871`) already exists and is unused today.
`Secret` (`:1134`) already stores per-user ciphertext with cascade deletion on user and
space.

## Tests

All tests are offline and deterministic. HTTP is injected or the SDK is mocked, with
the existing `vi.mock("@composio/core")` pattern (`composio-connector.test.ts:65`) and
the injected `fetch` for Pipedream.

| File | Asserts |
| --- | --- |
| `packages/adapters/src/gmail-mail-provider.test.ts` (PR 1) | Scope check: an account whose `spaceId`/`userId` differ from the context gives `auth` before any request. Retry: 429 and rate-limit 403 back off and honor `Retry-After`, and stop when the signal aborts. Partial page: an abort or exhausted retries mid-hydration returns the hydrated messages, the rest in `unhydratedIds`, and `nextPageToken`; a follow-up call with `ids` hydrates exactly those. `pageSize` above 500 is rejected. Query building: `after`/`before` translation, OR groups wrapped in parentheses. Paging passes `nextPageToken` through and ends with no token. List order is preserved after hydration. At most 4 requests are in flight per account and 4 for a second account at the same time. Address parsing covers quoted names, commas inside quotes, and a bare address. Snippet entities are decoded. MIME: plain preferred, HTML-only reduced to text, ISO-8859-1 decoded, 40k truncation sets `truncated`, attachments listed. Status mapping for 401, 403 by reason, 404 during list (dropped), 404 on get (`not_found`), 429 with retry, 500. `listAccounts` keeps only connected `gmail` rows across all three connector ids, and an address lookup failure gives `address: null`. |
| `packages/adapters/src/gmail-api-emulator.test.ts` (PR 1) | Seeded paging is deterministic. `in:inbox` and `in:sent` return the seeded inbound and sent messages. `maxResults` above 500 and an unknown operator return 400. `failNext` works. |
| `packages/adapters/src/integration-provider-settings.test.ts` (PR 1, extend) | The wrapper forwards `proxy` and `resolveConnectedAccountId` to the configured adapter, and leaves them absent when the adapter lacks them. |
| `packages/adapters/src/testing/mail-conformance.ts` (PR 1) | `assertMailConformance`: list, page 2, get a full message, account isolation (account A never sees B's mail), and the `auth` mapping. PR 1 runs it against `createMailEmulator()` in `gmail-mail-provider.test.ts`. |
| `packages/adapters/src/composio-mail.test.ts` (PR 2a) | A mocked `tools.proxyExecute` routed to `GmailApiEmulator` passes conformance. `connectedAccountId` equals the row's `providerRef`. The absolute endpoint keeps repeated `metadataHeaders`. Secrets are absent from error text. |
| `packages/adapters/src/pipedream-mail.test.ts` (PR 2b) | An injected `fetch` decodes the base64url target and routes it to the emulator, and conformance passes. The `account_id` and `external_user_id` query parameters are set. A legacy slug ref works with one account and gives `auth` with two. 401 and 429 statuses reach the mapping. |
| `packages/adapters/src/google-connector.test.ts` (PR 2c) | `begin`: the URL has every required parameter, and the challenge matches S256 of the derived verifier. `complete` exchanges the code, stores the secret, and returns `sub`. Refresh happens on expiry, with one retry on 401. `invalid_grant` gives `auth`. A URL to another host is refused before any request is sent. `revoke` deletes the secret and tolerates 400. Conformance passes with the fetch routed to the emulator. |
| `apps/api/src/router.test.ts` (PR 2c, extend) | `connections.complete({ connectionId })` polling still works for an existing connector. `connections.complete({ state, code })` by another user's session is isolated. Success marks the row connected with `providerRef = sub` and `secretId` set. A duplicate Google account returns `CONFLICT` and deletes the new secret. |
| `preferNativeGmail` test (PR 2d) | With `nativeGoogle: false` (mobile, desktop) the Google entry is hidden and the managed one kept; with `true` only the Google Gmail entry shows. |
| Web E2E (PR 2d) | The Integration setup screen shows the Google choice. The screenshot is linked in the PR as AGENTS.md requires. The OAuth round trip itself is not run in CI. |

There are no live tests in CI. Before each adapter PR merges, one manual smoke test
against a real test Gmail account lists 200 messages and opens one. The PR description
states the result in words.

## Dependencies

- Item 1 depends on nothing.
- Items 2, 4 and 5 depend on PR 1 only: the interface, `createMailProvider` and
  `createMailEmulator`. They can be built and tested against the emulator while PRs
  2a to 2d are in progress.
- Item 4 PR 1 creates the provider in `apps/api/src/app.ts` and adds it to
  `RouterDeps` as `mail`, because it merges first and its `inbox.*` handlers need it.
  Item 2 PR 2 passes that same instance to the API's executor, wires
  `createMailProvider` into `apps/worker/src/index.ts`, and adds the
  `deleteMailSearches` call in revoke.
- Item 4 PR 1 adds the metadata-cache step to `gmail-mail-provider.ts`, because it
  owns the `CachedMailMessage` table. Item 1
  does not touch those call sites, which avoids merge conflicts.
- Item 7 (mobile) needs to know about the Google catalog hiding in PR 2d.

## Risks and unknowns

- **Gmail quota versus observed speed is unmeasured.** Google's quota page lists
  6,000 units per minute per user and 20 units per `messages.get`, which implies about
  300 hydrated messages per minute per account. The reference implementation uses the
  identical approach (list ids, metadata `get` at 4 concurrent per account, backoff on
  429/403) and is fast in practice, probably because short bursts are tolerated; that
  is a hypothesis. Measure it in each adapter's manual smoke test. If a pull does not
  finish, item 2's 60-second deadline returns partial results with `coverage:
  "capped"` and a resume cursor as the fallback, and the Postgres metadata
  cache means a repeated search does not re-fetch ids it has already hydrated. With managed
  OAuth, the Composio or Pipedream Google project also has a per-project limit that is
  shared with their other customers. Rakazo cannot see that limit.
- **Proxy overhead and limits are unknown.** Neither Composio nor Pipedream documents a
  per-user rate limit for proxy calls, and each call adds a network hop. Measure this
  in the manual smoke test: time 200 hydrated messages per adapter and record it in
  the PR.
- **Composio query strings are unconfirmed.** It is not confirmed that Composio keeps
  repeated query parameters in an absolute `endpoint`. If it does not, send them
  through `parameters: [{ in: "query", ... }]`. PR 2a's test covers the request shape;
  only the smoke test can confirm Composio's behavior.
- **Google verification affects self-hosters.** `gmail.readonly` is a restricted scope.
  Google requires restricted-scope verification, and a security assessment when the
  data is stored on servers. Self-hosters use their own OAuth client in "Testing"
  status. Google's OAuth documentation says refresh tokens in that status expire after
  7 days, so those users will reconnect weekly. This is a deployment cost, not a code
  change. PR 2d's setup screen does not explain it; the self-host docs should.
- **The connected-account fix is based on reading the code.** The Pipedream account-ref
  gap described under Adapter B was found by reading the code and has not been
  reproduced yet. PR 1's wrapper test confirms the fix.
- **Google-only deployments cannot connect Gmail on mobile or desktop.** Both hide the
  Google entry, so when Google is the only configured mail connector, those users
  connect in a web browser. Accepted for v1.
- **Managed connectors inside the desktop popup are unverified.** Composio and
  Pipedream Gmail connects on desktop also reach Google's consent page inside the
  Electron popup. That is today's behavior, not something this plan changes, and it
  has not been tested against Google's embedded-browser block. Check it in the 2a and
  2b smoke tests on desktop.

## Later (not in v1)

- Write scopes and methods: `markRead`, `archive`, `send`/`reply`. These would add
  `POST` to `ConnectorProxyRequest.method`.
- `changesSince` through Gmail `history.list`, and push through `users.watch`.
- A non-Gmail provider (Outlook, IMAP). It would add a new `MailProvider` and a
  `querySyntax` field on `MailAccount`.

## PR breakdown and file ownership

PR 1 lands first. PRs 2a, 2b and 2c then run in parallel, one subagent each. PR 2d
follows 2c and has the same owner.

| PR | Title | Owns (only this PR edits these files) |
| --- | --- | --- |
| 1 | `feat(adapters): provider-neutral MailProvider over a Gmail REST core` | `adapter-kit/src/types.ts`, `adapter-kit/src/interfaces.ts`, `adapters/src/gmail-mail-provider.ts` (+test), `adapters/src/gmail-api-emulator.ts` (+test), `adapters/src/testing/mail-conformance.ts`, `adapters/src/integration-provider-settings.ts` (+test), `adapters/src/index.ts` exports |
| 2a | `feat(adapters): Gmail via Composio proxy` | `adapters/src/composio-connector.ts`, `adapters/src/composio-emulator.ts`, `adapters/src/composio-mail.test.ts` |
| 2b | `feat(adapters): Gmail via Pipedream Connect proxy` | `adapters/src/pipedream-connector.ts`, `adapters/src/pipedream-mail.test.ts` |
| 2c | `feat(adapters): native Google OAuth connector for Gmail` | `adapters/src/google-connector.ts` (+test), `adapters/src/integration-provider-settings.ts` (the `create()` branch and the new option only), `adapters/src/index.ts` (one export line), `contracts/src/integration-settings.ts`, `contracts/src/rpc.ts` (`connections.complete` input), `adapter-kit/src/interfaces.ts` (`complete` return type only), `apps/api/src/router.ts` (`connections.complete` only), `apps/api/src/router.test.ts`, `apps/api/src/app.ts` (pass `redirectUri`) |
| 2d | `feat(web): Google OAuth setup and callback` | `apps/web/src/App.tsx` (one route), `apps/web/src/pages/GoogleOAuthCallback.tsx`, `apps/web/src/components/integrations/IntegrationSetup.tsx`, `preferNativeGmail` in `packages/contracts` (+test) and its web call site (`nativeGoogle: !desktopBridge()`), `apps/mobile/app/(settings)/integrations.tsx` (same helper, hides `google`), web locale catalogs |

Conflict notes:

- 2a and 2b touch disjoint files.
- 2c re-edits two files from PR 1 (`integration-provider-settings.ts` and
  `interfaces.ts`). This is safe because PR 1 has merged before 2c starts.
- 2c also edits `router.ts`, `rpc.ts` and `app.ts`, which item 4 PR 1 and item 2
  PR 2 edit too. The "only this PR edits" column above holds within item 1 only.
  The README's merge order decides who rebases: 2c merges after item 4 PR 1 and
  item 2 PR 2 and rebases onto them.
- Locale `.po` files are also edited by items 4 and 6. Regenerate them with lingui
  extract after rebasing instead of hand-merging.
