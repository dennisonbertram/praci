# Self-hosting Praci

The signed-in product is a long-running API, a Graphile Worker, Postgres, and a computer provider (Docker supervisor, E2B, Daytona, CreateOS, or Box). It is not a static site. The marketing site in `apps/www` can be hosted separately.

## Local (source checkout)

Same as the README quick start: `.env` from `.env.example`, Postgres via Compose, `pnpm sandbox:build`, `pnpm dev`, then [http://127.0.0.1:5173](http://127.0.0.1:5173) (or `http://localhost:5173` — both loopback hosts are trusted). Electron: `pnpm --filter @rakazo/desktop dev` while that stack is up, choosing **Existing instance** with that address. The desktop app's **This computer** option instead installs and runs the published images itself with Docker Compose (see [Published images](#published-images-no-checkout)), using port 45173 by default so it can run alongside `pnpm dev`. If that port is occupied, the app selects and remembers another loopback port. The managed API gets a Docker-assigned loopback port; all desktop traffic uses the web origin.

For source development in WSL, keep the checkout and `data` directory in the Linux filesystem (for example, `~/rakazo`), and run `pnpm dev` as your normal user. The host-run supervisor matches bot container UID/GID to that user. If Docker Desktop container IPs are unreachable, set `SANDBOX_CONTROL_VIA_LOOPBACK=true` in `.env`; this publishes the token-protected control service on a random loopback port. Leave this unset for the Compose-hosted supervisor.

Compose bot homes mount only their own subdirectory of the application volume using Docker volume semantics. Docker's internal volume paths are never used as host bind mounts.

## Published images (no checkout)

Pull Postgres and `ghcr.io/elie222/rakazo/app` into any empty folder. No clone or image build.
Requires Docker Engine 26+ (API 1.45+ for bot home volume subpaths), the Compose plugin, curl, and OpenSSL.

```bash
mkdir -p rakazo && cd rakazo &&
curl -fsSLO https://raw.githubusercontent.com/elie222/rakazo/main/infra/compose/install-images.sh &&
bash install-images.sh
```

The installer downloads `docker-compose.images.yml` and `.env.images.example`, creates `.env` with
random secrets, then pulls and starts the images. It preserves an existing `.env` when rerun. For
the installer secret list, non-reuse rules, and recovery, see
[Self-host secrets checklist](./self-host-secrets.md). To customize the public URL, image tag, or
optional providers before startup, run `bash install-images.sh --prepare-only`, edit `.env`, then
run `bash install-images.sh`. Flags may be combined in either order: `--prepare-only`, `--local`.

`SANDBOX_PROVIDER` defaults to `docker`. The images Compose file runs a sandbox supervisor
(from the app image, on the internal network only) and pulls `ghcr.io/elie222/rakazo/computer`.
Signup and local Docker computers work without an E2B account. Optional remote providers: set
`SANDBOX_PROVIDER` to `e2b`, `daytona`, `createos`, or `box` and add the matching API key. The published-images
Compose stack requires `SANDBOX_SUPERVISOR_TOKEN` for every provider; leave it empty and `compose up` fails closed.

Optional: set `OPENROUTER_API_KEY` or connect a model in the UI after signup.
A provider that authenticates from the host needs no key: for Amazon Bedrock with an ECS task,
IRSA or EC2 instance role, opt in with `PI_DEFAULT_CREDENTIALS=host` and set
`PI_DEFAULT_PROVIDER=amazon-bedrock`, `PI_DEFAULT_MODEL` and `AWS_REGION`. With an instance
role, keep [restricted computer egress](#restricted-computer-egress) on so bot computers
cannot read the role's credentials from the metadata endpoint.
Auto Review uses that LLM checker by default. To use TypeSafe Jev instead, set
`RAKAZO_AUTO_REVIEW_PROVIDER=jev` and `TYPESAFE_API_KEY`. Core still runs with neither.
`RAKAZO_PERMISSIONS_DEFAULT` (`open`, `ask_changes` or `ask_everything`; default `open`) sets the
permission level for spaces whose owner has not chosen one: how much of each run's actions a person
must approve. A value that is not one of the three fails closed and is treated as `ask_changes`.

The example defaults to `edge` (main builds). Every publish is multi-arch (`amd64` + `arm64`), so
arm64 hosts need no special tag. Do not assume `latest` is present until a stable release exists.

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). The first registered user becomes the
deployment owner. Put TLS in front of `:5173` for a public host and set the three public origins to
that HTTPS URL.

Images Compose binds web to loopback (`127.0.0.1:5173`). Terminate TLS on the host and proxy
there. Vite preview same-origin-proxies `/api` and `/rpc`, so do not expose `:3100`. Set
`BETTER_AUTH_URL`, `WEB_ORIGIN`, and `API_URL` to that same HTTPS origin, and set
`RAKAZO_HOST` to its hostname (for example, `app.example.com`).

```Caddyfile
app.example.com {
	reverse_proxy 127.0.0.1:5173
}
```

Open **Agent computer** on a bot, or send a message that uses the desktop, to see
the local Docker computer. For in-stack Caddy plus remote E2B computers, use the
[production Compose](#public-single-vm-deployment) path and `infra/compose/Caddyfile.prod`
instead of this host proxy.

### Restricted networks / mirror downloads

If the installer, Compose downloads, or image pulls are blocked, use the
[restricted-network guide](./self-host-restricted-network.md) for mirror settings and local files.

### Bot computer resource ceilings

Each Docker computer runs Xvfb, a window manager and a full Chromium driven by an agent that
decides for itself what to open, so it is capped. These defaults provide a starting point for the
Docker computer topology:

| Variable | Default | Accepts |
| --- | --- | --- |
| `RAKAZO_COMPUTER_MEMORY` | `2g` | `2g`, `1536m`, a byte count. Minimum `6m`, Docker's own floor. Also caps swap, so the ceiling holds. |
| `RAKAZO_COMPUTER_CPUS` | `2` | Whole or fractional cores, e.g. `1.5` |
| `RAKAZO_COMPUTER_PIDS_LIMIT` | `2048` | A positive integer |

Set any of them to `0`, `none` or `unlimited` to remove that ceiling. A malformed value fails the
supervisor at startup naming the variable, rather than surfacing later as a failed bot.

### Restricted computer egress

Docker computers default to restricted egress: the public internet (browsing, DNS, apt, git
over SSH) but not the Docker host, the LAN, or link-local cloud metadata such as
`169.254.169.254`, which on a cloud VM would hand instance credentials to anything a bot runs.

It takes two parts:

1. `SANDBOX_COMPUTER_EGRESS=restricted`, the Compose default, gives each computer network a
   deterministic host bridge name (`rakazo-c…`) instead of a generic `br-*`.
2. The host ruleset, applied once per Docker host:

   ```bash
   sudo bash infra/compose/restrict-computer-egress.sh
   ```

   `install-images.sh` downloads and runs it (asking for sudo) and records the result in
   `.env`. Where the rules cannot be installed (macOS, Windows, Docker Desktop, rootless
   Docker, no iptables, or a failed run) it writes `SANDBOX_COMPUTER_EGRESS=open` and says
   why. The script drops forwarded traffic from `rakazo-c*` bridges to all non-public IPv4/IPv6
   destinations via the `DOCKER-USER` chain, adds an `INPUT` drop so computers cannot open
   connections to the host (established replies to host-initiated control and screen
   connections still flow), and installs a systemd oneshot so the rules return after a
   reboot. `--print` shows the exact rules without changing anything; `--remove` uninstalls.

Before the first restricted computer starts, the supervisor checks that the host drops
connections from a `rakazo-c*` bridge. Without the ruleset, computers fail to start with an
error naming the script instead of running unrestricted; run the script (no restart needed)
or set `SANDBOX_COMPUTER_EGRESS=open` and recreate the supervisor. A host-run supervisor
(`pnpm dev`) and the desktop app's **This computer** stack default to open: Docker Desktop
keeps its bridges in a VM the host rules cannot reach.

Screen streaming is unaffected: the supervisor and web proxy join each computer's bridge,
and the ruleset exempts traffic whose in- and out-interface are both `rakazo-c*` before
any drop (that exemption is load-bearing on hosts where `br_netfilter` feeds bridged
frames through `FORWARD`). Rules match interface names rather than subnets, so computer
create/delete cycles need no firewall maintenance; deleting a computer removes its
traffic from the match and nothing else. A computer provisioned while egress was open
is replaced on its next provision — resuming it on an unnamed bridge would bypass the
restriction.

If computers must reach LAN services, an internal proxy, or endpoints bound to the host,
set `SANDBOX_COMPUTER_EGRESS=open`, recreate the supervisor, and run
`sudo bash infra/compose/restrict-computer-egress.sh --remove`. The flag alone does not
uninstall the host rules, which keep matching the still-named `rakazo-c*` bridges until
removed.

The ruleset requires Linux Docker Engine with the iptables backend; Docker Desktop, rootless
Docker, and `firewall-backend: nftables` are unsupported. The
`SANDBOX_SCREEN_NETWORK=internal` topology shares one network instead of per-bot bridges,
so the mode does not apply there.

## Docker Compose (single machine)

1. Copy `.env.example` to `.env` and set `POSTGRES_PASSWORD` and `POSTGRES_APP_PASSWORD` (`openssl rand -hex 16` each), plus `BETTER_AUTH_SECRET`, `ENCRYPTION_KEY`, and `SCREEN_PROXY_SECRET` to independent long random strings (32+ characters; 64 hex for `ENCRYPTION_KEY`). Docker sandboxes also need a dedicated `SANDBOX_SUPERVISOR_TOKEN`. Keep existing `ENCRYPTION_KEY` values so stored credentials stay decryptable.
2. Set `OPENROUTER_API_KEY` (and `COMPOSIO_API_KEY` if you want Plugins).
3. Build the computer image: `pnpm sandbox:build` (Compose also builds it via the `computer` service).
4. `docker compose --env-file .env -f infra/compose/docker-compose.yml up --build`
5. Open the web origin (`http://127.0.0.1:5173` by default). The first registered user becomes the deployment owner.

On Windows, if an older clone with `core.autocrlf=true` leaves the computer pane hung on boot (`bash\r` in sandbox logs): from a clean worktree, set `git config core.autocrlf false`, run `git add --renormalize . && git checkout -- .`, then rebuild with `pnpm sandbox:build`.

Compose runs Postgres, the sandbox supervisor (Docker socket), API, worker, and a Vite preview of the web app. Bot computers are sibling containers (`rakazo/computer:local`) on separate per-bot networks; only the supervisor and screen proxy join each one. The API process does not get an unrestricted Docker socket; the supervisor owns the lifecycle.

Postgres stays on the Compose network only (not published on the host), matching the images
compose. Credentials come from `.env` (`POSTGRES_PASSWORD` is required). Prefer a URI-safe value
(`openssl rand -hex 16`); characters such as `@ : / ? # %` break the interpolated `DATABASE_URL`
inside Compose. Official Postgres images set user, password, and database only on first volume
init, so an existing `pgdata` volume keeps its original identity: keep those values in `.env`, or
change them in place with `ALTER ROLE` / rename. Recreate the volume only after a backup (or when
the data is disposable); `docker compose down -v` deletes all Postgres state. For host-side clients
(`pnpm db:migrate`, GUI tools),
add `infra/compose/docker-compose.postgres-host.yml` so Postgres is published on loopback
`127.0.0.1:5433`, or use
`docker compose --env-file .env -f infra/compose/docker-compose.yml exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'`.
Do not publish Postgres on a public interface. The Postgres image now includes the pgvector extension: it is Postgres 16.15 on the same Debian trixie base as the previous image, so existing data volumes keep their collation. Moving an existing deployment to it needs one extra step; see [Upgrade](#upgrade).

### Database roles

Rakazo uses two Postgres logins:

- The owner (`POSTGRES_USER`, or `DATABASE_MIGRATION_URL` outside Compose) runs migrations and
  owns the tables.
- The app login (`rakazo_app` with `POSTGRES_APP_PASSWORD`, or `DATABASE_URL`) is not a
  superuser, cannot bypass row-level security, cannot create objects, and can only read and write
  the app tables.

`pnpm db:migrate` (in Compose, the one-shot `migrate` service runs it before the API starts) applies
the migrations and the job queue schema as the owner. Only that service gets the owner login, so code
running in the API or worker cannot find one that bypasses row-level security. It then creates the app login named in `DATABASE_URL`, or updates its
password, and grants it the `rakazo_app` role. When migrations run as a role without
`CREATEROLE`, as on some managed Postgres, create the login yourself and
`GRANT rakazo_app TO <login>`.

Row-level security covers the tables that hold a Space's or a user's content: threads, messages,
events, memory, artifacts and share links, secrets and credentials, skills, bots, runs, tasks,
routines, connections, MCP servers, computers, boards and tickets, messaging identities and
conversations, usage, open items and approvals, notifications, mail, finance, contacts, investors
and fundraising, the cap table, the Data room, legal, meetings, Devin and the company graph. Each
signed-in request sees only its Space's rows, plus the user's own account-level credentials. A
query that leaves out its Space filter returns nothing from other Spaces. A background job that
acts for one run, routine, computer, thread or user runs as that row's Space. Reconcilers,
retention sweeps, webhooks and public links (artifact shares, the investor portal) run in a named
system scope (`runAsSystem` in `packages/db`; `grep -rn "runAsSystem("` lists each one). The
account, session and membership tables stay outside the policies.

With only `DATABASE_URL` set, migrations and the app share one login. Everything keeps working,
but `pnpm db:migrate`, the API and the worker warn that row-level security is not enforced. To fix
this, set `DATABASE_MIGRATION_URL` to the owner and `DATABASE_URL` to a new login.

Host-run stack (`pnpm dev`, or a service that runs the API and worker from a checkout) on a
database that already exists: nothing is needed to keep it working. To turn row-level security on,
copy the current `DATABASE_URL` value into `DATABASE_MIGRATION_URL`, change `DATABASE_URL` to the
same host, port and database with user `rakazo_app` and a new URI-safe password
(`openssl rand -hex 16`), run `pnpm db:migrate`, then restart the API and worker.

Run `pg_dump` as the owner. The app login would only dump rows it is allowed to see.

The Docker supervisor is not published as its own image and is not exposed on the host. It runs from
the app image, stays on the internal Compose network, and holds the Docker socket because access to
it is equivalent to control of the Docker host. Docker sandboxes require `SANDBOX_SUPERVISOR_TOKEN`
(API, worker, supervisor). `SCREEN_PROXY_SECRET` signs browser-screen capabilities (API and web
proxy). Keep both distinct from `BETTER_AUTH_SECRET`.

New credentials use versioned AES-GCM with per-record salt and row-bound AAD. Legacy ciphertext stays readable.

On a VPS, put TLS in front of `:5173` (or serve the web build behind your proxy) and set:

```env
BETTER_AUTH_URL=https://app.example.com
WEB_ORIGIN=https://app.example.com
API_URL=https://app.example.com
```

Cookies and CORS follow those origins. To also serve the app from another browser origin (for example a Tailscale name), list it in `RAKAZO_TRUSTED_ORIGINS` (comma-separated http(s) origins; invalid entries stop the API at startup). Passkeys stay bound to `WEB_ORIGIN`. `SIGNUPS_ENABLED` seeds whether registration is open
when the API starts for the first time and is not reapplied on restart. A non-empty
`SIGNUP_ALLOWLIST` is applied on every API start, replacing the allowlist stored for the deployment.
Leave it empty to keep that stored list.

With a nonempty signup allowlist and SMTP configured, users—including existing accounts—must
verify their email to sign in. On a fresh instance with no SMTP, the first allowlisted account
can register without verification. That signup does not prove mailbox ownership, so create the
account before exposing the service. Further accounts still need SMTP.

For a public deployment, configure SMTP and an allowlist before the API's first start.
Keep an installation without email on a trusted local network.

### Optional OpenID Connect SSO

SSO works with a self-hosted or hosted OpenID Connect provider. Leave its settings unset to
keep password authentication alone. Configure all three credentials together on the API:

```env
OIDC_ISSUER=https://identity.example.com
OIDC_CLIENT_ID=replace-with-client-id
OIDC_CLIENT_SECRET=replace-with-client-secret
OIDC_NAME=SSO
OIDC_SCOPES=openid email profile
AUTH_PASSWORD_ENABLED=true
OIDC_ALLOW_SIGNUP_BYPASS=false
```

The issuer must be HTTPS and exactly match the discovery document's issuer. Praci loads
`<issuer>/.well-known/openid-configuration`, verifies ID tokens against discovery JWKS with
issuer, audience and nonce checks, and uses authorization codes with PKCE. Additional scopes
may be space- or comma-separated; `openid email profile` are always requested. `OIDC_NAME`
is the button label, defaulting to “SSO”. Secrets remain on the API; Compose clears the worker's
OIDC credentials. The capabilities endpoint exposes only the label, discovery availability,
and enabled authentication methods.

Register this redirect URI at the provider (using your public `BETTER_AUTH_URL` origin):

```text
https://app.example.com/api/auth/callback/oidc
```

Web, Electron and mobile use the same provider redirect URI. Electron completes SSO in a
sandboxed in-app popup sharing the app's session, then returns to the main window. Mobile completes the callback
on the API, then returns to `rakazo://sign-in` (or `rakazo://account` for linking and reauthentication) through Better Auth's Expo authorization proxy
and a native auth browser session. The `rakazo` app scheme is trusted by the auth server;
never register a client secret in the mobile app. Mobile stores the resulting session with
SecureStore, like password sign-in. Native builds need the Expo WebBrowser module.

Provider emails are verified only when `email_verified` is the boolean `true`. False or missing
claims stay unverified, including on subsequent sign-ins, and an unverified claim never changes
the account's email. Sign-in never links accounts by email.
If an email belongs to another account, sign in to that existing account and choose **Link SSO**
in account settings. Linking requires an authenticated session, a verified provider email and
matching email addresses. With email delivery, an account links SSO only after its email is
verified. Without it, an unverified account links only from a browser signed in to it, so not
from the mobile app. The issuer and provider subject identify the linked account thereafter. Changing issuers does
not reuse an old identity. Old-issuer links remain stored but do not count as linked to the
current provider, so **Link SSO** becomes available again. Link the new identity from the
existing signed-in account; authenticated-session, verified-email and matching-email checks
still apply. Restoring the old issuer makes its existing links usable again.

SSO signup follows closed registration and the deployment allowlist before creating an account.
Allowlisted provider emails must be verified; the password signup's first-account exemption
never upgrades an OIDC email. `OIDC_ALLOW_SIGNUP_BYPASS=true` explicitly admits IdP identities
without applying the allowlist or its email-verification admission requirement. Enable it only
when the IdP controls who may join this deployment. It does **not** reopen closed registration,
and does not change email verification claims or linking rules. Existing admitted accounts can
sign in while registration is closed.

Set `AUTH_PASSWORD_ENABLED=false` for SSO-only operation. Password sign-in, signup, password
reset and password mutation endpoints are disabled server-side, and sign-in forms are hidden.
The API refuses to start in this mode unless all OIDC credentials are configured. It can still
start while discovery is temporarily unavailable: the provider remains registered, sign-in
returns a temporary error, and background retries recover without restarting. Discovery is lazy
on first use, refreshed in the background, and failures back off up to one minute. Availability
reflects discovery, not a guarantee that the provider's token endpoint is currently reachable.

Account deletion keeps the existing password confirmation for password users. Users without a
password may delete after a provider sign-in within five minutes; **Sign in again** starts a fresh
provider round-trip bound to the signed-in account. Choosing a different identity cannot confirm
deletion or create another account in that flow. A stale or borrowed session alone cannot authorize deletion. With transactional
email configured, **Send deletion code** sends a single-use code to the account email, valid for ten
minutes. Enter it in account settings to confirm deletion. Email-code requests are rate-limited;
invalid, expired or wrong-account codes fail. No password needs to be created for deletion.

### Verification and password recovery email

Password changes for signed-in users require no email configuration. Forgotten-password recovery
appears on sign-in only when a transactional email provider is available. Praci uses a
provider-neutral contract and ships an SMTP adapter, so Amazon SES, Resend, and self-hosted SMTP
servers use the same configuration:

```env
SMTP_URL=smtps://smtp-user:replace-with-password@smtp.example.com:465
EMAIL_FROM=Praci <no-reply@example.com>
```

For Resend, use `smtp.resend.com`, username `resend`, and an API key as the password. For Amazon
SES, use the regional SMTP endpoint and SES SMTP credentials; these are different from ordinary AWS
access keys. Verify the sender/domain with the provider before testing delivery. Keep credentials in
`.env`, never in tracked files. `smtps://` uses implicit TLS; `smtp://` is also supported but requires
STARTTLS. Praci rejects configuration that disables TLS or certificate verification.

Local source development can use the offline email emulator instead. It captures email without
contacting a provider:

```env
EMAIL_EMULATOR=true
```

The emulator is forcibly disabled when `NODE_ENV=production` and requires the API to bind to a
loopback host. In `NODE_ENV=development`, captured messages are available from
`http://127.0.0.1:3100/api/dev/emails` with cache disabled; the API logs only delivery
metadata, never reset tokens. The inbox route is not registered in test, staging, or production.

### Billing

Billing stays off, with no paywall, unless `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and
`STRIPE_PRICE_ID` are all set (see `.env.example`). Setting only some of them stops the API at
startup.

### Optional: Gmail push

Mail syncs by polling. A deployment that has Google Cloud can also get a push when Gmail
changes, which starts the sync at once. It works for Google accounts connected directly, not
through Composio or Pipedream, and polling continues either way.

1. Create a Pub/Sub topic and grant `gmail-api-push@system.gserviceaccount.com` the Pub/Sub
   Publisher role on it.
2. Create a push subscription on the topic that delivers to `https://<host>/api/v1/mail/push`
   with authentication on, using a service account of your own and the audience below.
3. Set `GMAIL_PUSH_TOPIC` (`projects/<project>/topics/<topic>`) and
   `GMAIL_PUSH_SERVICE_ACCOUNT` (that service account's email) on the API and the worker. The
   audience defaults to `<WEB_ORIGIN>/api/v1/mail/push`; set `GMAIL_PUSH_AUDIENCE` if the
   subscription uses another one.

Push stays off unless both settings are present. Watches last seven days and are renewed daily.

### Logging

Backend services write structured logs to stdout. `LOG_LEVEL` is `debug`, `info`, `warn`, `error`,
or `off` (default `info`). Production defaults to `LOG_FORMAT=json`; development defaults to pretty
unless you set `json` or `pretty`.

Axiom is optional. Set both `AXIOM_TOKEN` and `AXIOM_DATASET` for ingest to one shared dataset.
Services set `service.name` (`rakazo-api`, `rakazo-worker`, `rakazo-sandbox-supervisor`,
`rakazo-updater`). A partial Axiom config logs a one-time warning and stays off. `AXIOM_EDGE` is a
regional hostname; `AXIOM_EDGE_URL` must be https and wins when both are set.

Compose passes these into the API, worker, supervisor, and updater. Computer containers and updater
child commands do not receive them.

Optional:

```env
SIGNUPS_ENABLED=true
SIGNUP_ALLOWLIST=you@example.com,@company.com
SANDBOX_PROVIDER=docker   # or none, e2b, daytona, createos, box. Keep fake only for pnpm test.
AGENT_RUNTIME=pi          # Keep scripted only for pnpm test.
WAKEUP_DRIVER=graphile
SANDBOX_IDLE_MS=600000    # pause or stop after 10 minutes idle; 0 disables idle sleep
# Set 0 when self-hosting with Docker, where an idle computer costs nothing, to keep long-running apps and sessions up.
# E2B, CreateOS and Box still apply their own timeouts.
SANDBOX_COMMAND_TIMEOUT_MS=300000 # stop a shell command after 5 minutes
MAX_TOOL_CALLS_PER_TURN=  # optional Pi turn tool-call fuse; unset/0 = unlimited
E2B_API_KEY=              # when SANDBOX_PROVIDER=e2b
DAYTONA_API_KEY=          # when SANDBOX_PROVIDER=daytona
CREATEOS_SANDBOX_API_KEY= # when SANDBOX_PROVIDER=createos
BOX_API_KEY=              # when SANDBOX_PROVIDER=box
```

To use an operator-controlled OpenAI-compatible server such as Ollama, LM Studio, llama.cpp, or
MLX, list its model IDs and an endpoint that both the API and worker processes can reach:

```env
RAKAZO_LOCAL_MODELS=qwen3:4b,llama3.1:8b,qwen3-vl
RAKAZO_LOCAL_MODELS_URL=http://127.0.0.1:11434/v1
RAKAZO_LOCAL_CONTEXT_WINDOW=32768
RAKAZO_LOCAL_MAX_TOKENS=4096
# Optional: model ids on this endpoint that accept images (screenshot computer tools).
RAKAZO_LOCAL_VISION_MODELS=qwen3-vl
```

The loopback default is suitable when running Praci from a source checkout. From containers,
prefer a stable LAN RFC1918 address (not Compose service DNS alone). On Docker Desktop,
`host.docker.internal` also works.
On Docker Desktop, a bot computer shell can often reach services bound to host `127.0.0.1`
through that same hostname. Do not run sensitive unauthenticated services on loopback while
bots run, or firewall / block that path. Linux does not get `host.docker.internal` the same
way by default.
Only configure an endpoint you control: prompts, attachments, and tool results sent to that model
leave Praci through this URL. Leave `RAKAZO_LOCAL_MODELS` blank to disable the provider.

Each user can also connect their own OpenAI-compatible endpoint from **Connect a model** /
**Settings → Models** on web and mobile. Choose **OpenAI-compatible**, enter the server base URL
(for example `http://127.0.0.1:8000/v1`), the exact model id, and an optional API key.
Public hosts and ordinary hostnames need `RAKAZO_OPENAI_COMPAT_ALLOW_PUBLIC=1` and HTTPS.
Literal private IP, loopback, and `host.docker.internal` targets do not.
For a self-hosted endpoint whose hostname resolves to private IPs, set
`RAKAZO_OPENAI_COMPAT_PRIVATE_HOSTS=models.example.test,other.example.test` in the deployment
environment for both API and worker, then recreate those containers. Entries are exact hostnames
(case-insensitive, optional trailing dot), not URLs, suffixes, or wildcards. These hosts do not
need `RAKAZO_OPENAI_COMPAT_ALLOW_PUBLIC`; every DNS answer must be private, and metadata and
link-local destinations remain blocked. This applies to discovery and model requests.
HTTPS still validates the hostname's certificate. Like private IP endpoints, trusted hostnames
also permit HTTP with API keys; use HTTPS unless the network is trusted. Only allow hosts you
control.
If that endpoint's model
accepts images, enable **Supports images** under **Advanced** when connecting so attachments and
screenshot computer tools stay available. Existing connections default to disabled. For centrally
managed endpoints, the deployment-wide fallback remains
`RAKAZO_OPENAI_COMPATIBLE_VISION_MODELS=gpt4o-vision,llava`.

Remote MCP servers and installed API / GraphQL connectors default to public HTTPS. The deployment
owner can attach one on localhost, the same LAN, or a Docker network. Set
`MCP_ALLOW_PRIVATE_ENDPOINT=true` on the API and worker to allow these for every user. Cloud
metadata addresses stay blocked. Leave the flag unset on public installs.

For servers that accept standard `reasoning_effort`, enable **Supports thinking** under
**Advanced** when connecting. The setting is saved on the connection (no env var or restart).
Existing connections default to disabled. Reconnect former Qwen-list or deployment-local models
via **Settings → Models** and turn it on; the old environment list is no longer read.

Enabled connections default to medium thinking. Web and desktop expose **Thinking** in a bot's
advanced settings; mobile inherits the same backend policy. Praci sends standard
`reasoning_effort` (`minimal`, `low`, `medium`, `high`, or `none` when off); the server owns
model-specific translation. Leave **Supports thinking** off when the server lacks standard effort
support. Existing token limits still apply; effort is not a separate reasoning-token budget.

Do not commit `.env`. Never put `COMPOSIO_API_KEY`, OpenRouter keys, or provider tokens in git, logs, or chat.

Optional messaging platforms (iMessage, Slack, WhatsApp, Telegram, Feishu/Lark) mount when their env credentials are set — see `.env.example`. Point a Feishu/Lark bot event subscription at `/api/v1/messaging/webhook/lark` (webhook/HTTP inbound only; do not enable long connection). Groups stay iMessage-only.

The Compose files pass the API and worker only the settings each one reads, listed by name, rather than the whole `.env`. A setting whose name you choose, such as `TELEGRAM_BOT_TOKEN_<NAME>`, therefore needs its own line: add it under `api` and `worker` `environment` in an override file layered after the base file (and in `RAKAZO_COMPOSE_FILE` when the updater is enabled), with no value so Compose fills it from `.env`.

### iMessage through Photon

Photon (photon.codes) runs a hosted iMessage line, so no Mac is needed. Its free plan (a shared number, up to 10 users) is the default for a self-hosted install.

1. Create a Photon project and copy its project ID and project secret.
2. Register a webhook for your public API URL, `<public API url>/api/v1/messaging/webhook/photon`, and copy the signing secret Photon shows once.
3. Set `PHOTON_PROJECT_ID`, `PHOTON_PROJECT_SECRET` and `PHOTON_WEBHOOK_SECRET`, then restart. Photon turns on only when all three are set. A bad value turns off Photon and leaves the other platforms running.
4. In Praci, link an agent to Photon from the messaging settings and text the link code to the Photon number.

What to know before turning it on:

- Messages pass through Photon, which keeps a licence to message content (terms 5.1 and 5.2). Tell your users.
- Only direct iMessages wake an agent. Groups and SMS or RCS fallback messages are ignored.
- The first reply in a new conversation starts with "You're messaging an AI assistant.", because Photon's terms (3.6) require it. You must also keep your users' consent records and honor opt-outs.
- The Finance and Legal agents cannot be linked to Photon, because its terms (3.8(b)) forbid automated financial or legal advice without professional supervision.
- Photon retries a webhook six times and then drops it, so messages sent while the API is down for longer than that are lost.
- Limits: 5 requests per second per project, 5,000 outbound messages per server per day, and 50 new conversations per line per day. Praci only replies; it never starts a conversation.
- `PHOTON_IMESSAGE_ADDRESS` is optional and overrides the iMessage endpoint (a host, or an http(s) URL).

## Choosing a computer provider

The Electron desktop app is a client of the same API. Docker and E2B still apply. On first launch, Electron asks the deployment owner whether bots should keep using Docker or run on this Mac as you. `SANDBOX_PROVIDER=desktop` is a separate, explicit provider that always runs commands on the service host.

- **Published images** (`docker-compose.images.yml`) default to `SANDBOX_PROVIDER=docker` with a
  local supervisor and published `ghcr.io/elie222/rakazo/computer` image. No E2B account required.
  Optional: set `e2b`, `daytona`, `createos`, or `box` plus the matching API key for remote computers.
- **Docker** is the quick-start default for published images and for a source checkout / full local
  Compose stack. Workspace bots share a persistent Team Computer by default; Private computers are
  optional. Keep the supervisor private, as the included Compose files do.
- **E2B** runs bot computers away from the Praci host and is a good choice for public or multi-user
  production deployments. Praci checkpoints the portable workspace and browser-profile directory to
  object storage (see [Object storage](#object-storage-for-artifacts-and-agent-homes)); the E2B disk is
  a runtime cache, not the durable source of truth.
- **Daytona** provides the same remote-computer contract through Daytona sandboxes. Configure
  `DAYTONA_API_KEY` and optionally `DAYTONA_API_URL` / `DAYTONA_TARGET` / `DAYTONA_SNAPSHOT`.
- **CreateOS** provides the same remote-computer contract through CreateOS desktop sandboxes.
  Configure `CREATEOS_SANDBOX_API_KEY` and optionally `CREATEOS_SANDBOX_BASE_URL`,
  `CREATEOS_SANDBOX_SHAPE`, or `CREATEOS_SANDBOX_ROOTFS`. Praci defaults to
  `https://api.sb.createos.sh`, `s-2vcpu-2gb`, and `desktop:1`.
- **Box by ASCII** provides a managed Linux desktop through `BOX_API_KEY` and optionally
  `BOX_API_URL`. Praci always creates or resumes boxes with `noEnv: true`, keeps the portable
  workspace under `/home/user/rakazo-home`, and refreshes a two-hour TTL. Box uses the shared Linux
  desktop runtime and protected port routes for concurrent bot desktops. Each bot has its own
  persistent Chrome profile; logins are not shared between bots.
- **Desktop provider** / **This Mac** runs commands on the API/worker host. Docker stays the default.
  The Electron app asks once; if you choose This Mac, bots can use working directories under your home
  folder. Do not enable it on a public or shared service. macOS does not show its own permission
  dialog for this. Commands get only a minimal shell environment (no server secrets), and
  `SANDBOX_PROVIDER=desktop` is refused unless `NODE_ENV` is `development` or `test` or the process
  runs inside the Electron app, so a production server never runs bot commands on itself.
- **Fake** is only an emulator for verification.
- **None** boots the product without a computer host (fallback when Docker/supervisor is not
  configured, or when a remote provider is selected without its API key).

For provider configuration and health checks, see the [provider setup guide](./self-host-sandbox-providers.md).

## Object storage for artifacts and agent homes

The Compose stacks (`docker-compose.yml`, `docker-compose.images.yml` and `docker-compose.prod.yml`)
can run a bundled S3-compatible store, [SeaweedFS](https://github.com/seaweedfs/seaweedfs) (Apache-2.0),
with a one-shot `seaweedfs-init` service that creates the bucket. Both belong to the Compose profile
`bundled-s3` and are not published on the host.

- **New installs** of the published-image stack: `install-images.sh` writes `COMPOSE_PROFILES=bundled-s3`,
  the matching `RAKAZO_S3_*` values and generated credentials into `.env`, so files and agent homes
  are stored in object storage from the first start.
- **Upgrades** keep their current behaviour: an existing `.env` has no `COMPOSE_PROFILES` and no
  `RAKAZO_S3_*`, so nothing changes and files stay on local disk. To opt in, run
  `bash install-images.sh --enable-bundled-storage`. It appends the profile and generated credentials to
  `.env` (it refuses if `.env` already sets `RAKAZO_S3_*`). Files that were already stored under
  `DATA_DIR/artifacts`, including Data room files, stay readable: when an object is not in the bucket,
  Praci reads the old local file. They are not copied, so keep `DATA_DIR` in your backups.
- **`docker-compose.prod.yml` and the source-checkout stack** do not edit `.env`. To use the bundled
  store, add `COMPOSE_PROFILES=bundled-s3`, `RAKAZO_S3_ENDPOINT=http://seaweedfs:8333`,
  `RAKAZO_S3_BUCKET=rakazo`, `RAKAZO_S3_FORCE_PATH_STYLE=true` and your own
  `RAKAZO_S3_ACCESS_KEY_ID` and `RAKAZO_S3_SECRET_ACCESS_KEY` to `.env`.

The credentials must be letters and digits, at least 8 characters each. The bundled store refuses to
start with shorter or missing credentials (the production and published-image stacks have no
default; the source-checkout stack falls back to placeholder credentials for development only). Do
not change the credentials after the store has started. Back up the `seaweedfsdata` volume with the
database.

To use another S3-compatible store (AWS S3, Cloudflare R2, a store you run yourself), set the
variables below in `.env` and leave the `bundled-s3` profile off. Files are stored under
`<prefix>/artifacts/<space id>/<id>`, so one bucket can serve many spaces. Set the first four
variables together; any `RAKAZO_S3_*` variable that is set turns object storage on, and a partial set stops startup and names the missing variable.

- `RAKAZO_S3_ENDPOINT`: the store's URL, for example `https://s3.us-east-1.amazonaws.com`.
- `RAKAZO_S3_BUCKET`: an existing bucket.
- `RAKAZO_S3_ACCESS_KEY_ID` and `RAKAZO_S3_SECRET_ACCESS_KEY`: credentials with read, write and delete access to the bucket.
- `RAKAZO_S3_REGION`: defaults to `us-east-1`, which AWS, R2 and SeaweedFS all accept.
- `RAKAZO_S3_FORCE_PATH_STYLE`: set to `true` for SeaweedFS, MinIO and other stores without bucket subdomains.
- Give the access key `s3:ListBucket` on the bucket as well as object read, write and delete. Without
  it, AWS S3 answers 403 instead of 404 for a missing object, and Praci treats a 403 as an error
  rather than looking for an older copy under `DATA_DIR/artifacts`.
- `RAKAZO_S3_PREFIX`: optional key prefix.

Plain `http` endpoints are accepted only for localhost, private network addresses and single-word hostnames such as `seaweedfs`; use `https` for anything else.

Without any `RAKAZO_S3_*` variable (for example `pnpm dev` outside Compose), artifacts and home snapshots
fall back to local disk under `DATA_DIR`, which is only safe for a single process.

Data room uploads have no size limit; large files are written to the store in 8 MiB multipart parts.
Two settings outside Rakazo matter for them:

- Add an `AbortIncompleteMultipartUpload` lifecycle rule (for example after one day) to the bucket.
  Rakazo cancels an upload it abandons, but a crash can leave parts behind, and S3 bills for them.
- A reverse proxy that limits request bodies also limits uploads. Cloudflare's proxy refuses bodies over
  about 100 MB on the Free and Pro plans, so serve the API from a DNS-only record or through a tunnel
  that allows large bodies. The bundled Caddy configuration sets no body limit.

### Agent homes

Each Computer's persistent workspace (its home) is saved as one gzip tar snapshot in the object store.
The snapshot keeps file contents, symlinks (targets exactly as written), hard links inside the home,
empty folders, permission bits, and file and folder times. It leaves out owners, extended attributes,
sockets, devices, browser and package caches, and files that keep changing while they are read (they
are logged and picked up by the next save). The archive is written to a temporary file and uploaded
from it (multipart for large homes), so memory does not grow with the size of the home. The Computer
row in Postgres holds the current revision and snapshot id, and a save succeeds only if that revision
has not changed since it was read, so two workers cannot overwrite each other. No database connection
or lock is held while a home is archived, uploaded or downloaded. Every lookup is scoped to the
Computer's space. The snapshot before the current one is kept until the next save, then deleted.

`DATA_DIR/homes/<key>` is the live workspace of a Docker computer, which the supervisor mounts. The
host that provisions the computer installs the current snapshot there when the folder is missing, or
while the computer is being started and the supervisor confirms its container is not running (for
example after the computer ran on another provider); if the supervisor cannot answer, the folder is
left alone and the workspace is restored through the container instead. A replacement is extracted
into a new folder beside it and renamed into place; Praci never writes a snapshot into a folder a
container can change. From then on that host saves from the folder. Any other host, and any host
whose folder is older than the current revision, reads the home from a per-revision copy under
`DATA_DIR/home-cache` and saves edits from a private copy, never from its own folder, so API and
worker processes do not need to share `DATA_DIR`. The cache drops revisions unused for a day and
keeps itself under 2 GiB; scratch folders a crashed process left behind are removed after six hours.
Remote providers (E2B, Daytona and so on) restore from the snapshot.

An existing deployment migrates on its own. The first time a Computer's home is used and it has no
snapshot, Praci uploads the existing `DATA_DIR/homes/<key>` directory and uses the snapshot from then
on. The local directory is not deleted. Set `RAKAZO_AGENT_HOME_STORE=local` to keep homes only on local
disk; this is a development opt-out and is not safe with more than one API or worker host.

### Pi session recordings

With `PI_SESSION_RECORDING=true` (off by default), Pi writes JSONL transcripts to
`DATA_DIR/pi-sessions/<user>/<bot>` with 30-day retention. They are diagnostic recordings that nothing
reads back to run an agent, so they are runtime data and stay on local disk. Moving them to object
storage is follow-up work; the transcripts are unencrypted, so leave recording off on shared hosts.

## Backup

```bash
./scripts/backup.sh
```

This dumps Postgres (`pg_dump`), archives `data/`, and exports every object in the configured
`RAKAZO_S3_*` bucket (under `RAKAZO_S3_PREFIX` if set) into `backups/<stamp>/objects/`, with an
`objects.manifest.json` listing each key, size, and etag. Object export uses Node and needs no extra
tools. The bundled store is not published on the host, so set `RAKAZO_BACKUP_S3_ENDPOINT` to an
address the host can reach. With no object storage configured, the export is skipped. Any database,
archive, or object error fails the backup; discard the output directory of a failed run.

`./scripts/restore.sh backups/<stamp>` restores the database, `data/`, and objects (it overwrites
matching keys and deletes nothing). The production backup (`infra/compose/backup-prod.sh`) exports
objects the same way into the snapshot; restore them with
`node scripts/s3-objects.mjs restore <snapshot> --dotenv .env`.

## Public single-VM deployment

`infra/compose/docker-compose.prod.yml` runs the hosted product with Postgres, the API, worker, web app,
and automatic HTTPS through Caddy. It uses E2B for bot computers, so the VM never exposes a Docker
supervisor or browser containers — `infra/compose/docker-compose.prod.docker.yml` is the opt-in
overlay that runs local Docker computers on the same stack (see below). The root-equivalent updater
sidecar is an explicit opt-in profile.

Before deploying to a new Ubuntu host, create and verify a key-only `deploy` account, then apply the
idempotent host-hardening baseline. It disables SSH passwords and root login, rate-limits SSH, allows
only SSH/HTTP/HTTPS through UFW, enables fail2ban, unattended security updates, AppArmor, audit rules,
and conservative kernel/network protections. Keep the provider console open until a fresh SSH login
succeeds after the script reloads SSH.

```bash
sudo DEPLOY_USER=deploy bash infra/compose/harden-host.sh
```

The production host also uses `infra/compose/docker-daemon.json` to enable live restore, bounded local
container logs, default no-new-privileges, and the kernel NAT path instead of Docker's userland proxy.

1. Point an `A`/`AAAA` record such as `app.example.com` at the VM and allow inbound TCP 80/443 and
   UDP 443. If you use Cloudflare, enable the proxy with **Full (strict)** TLS and copy
   `Caddyfile.cloudflare.example` to an operator-controlled path outside the public checkout. Set
   `CADDYFILE_PATH` to that absolute path. The example drops application requests that do not come
   from Cloudflare's [published IP ranges](https://www.cloudflare.com/ips/); reconcile those ranges
   whenever Cloudflare publishes a change. A Cloudflare Tunnel can replace the public web listeners.
2. Clone the repository on the VM and create a root `.env` with production-only values. At minimum set
   `POSTGRES_PASSWORD`, `POSTGRES_APP_PASSWORD` (the password of the `rakazo_app` runtime login; the
   stack refuses to start without it), `BETTER_AUTH_SECRET`, `ENCRYPTION_KEY`, `SCREEN_PROXY_SECRET`,
   `OPENROUTER_API_KEY`, the API key for your selected sandbox provider,
   `RAKAZO_HOST`, and the three public origins. Set `RAKAZO_DEPLOY_DIR` when the checkout is not at
   the supported Linux default, `/srv/rakazo`. Use URL-safe random values for database credentials.
   If you enable the `updater` profile, also set a dedicated `RAKAZO_UPDATER_TOKEN` (at least 32
   characters) that differs from `BETTER_AUTH_SECRET`, `SANDBOX_SUPERVISOR_TOKEN`, and
   `SCREEN_PROXY_SECRET`.
3. Keep registration allowlisted while the service is private:

```env
NODE_ENV=production
RAKAZO_HOST=app.example.com
# Optional operator-owned override, for example the Cloudflare allowlist file:
# CADDYFILE_PATH=/etc/rakazo/Caddyfile.prod
BETTER_AUTH_URL=https://app.example.com
WEB_ORIGIN=https://app.example.com
API_URL=https://app.example.com
SIGNUPS_ENABLED=true
SIGNUP_ALLOWLIST=owner@example.com,reviewer@example.com
# e2b, daytona, or box
SANDBOX_PROVIDER=e2b
AGENT_RUNTIME=pi
WAKEUP_DRIVER=graphile
DATA_DIR=/data
# Absolute path of this checkout as the Docker daemon sees it. /srv/rakazo is the Linux default;
# set this explicitly for every other layout. See "The deploy directory must be one path" below.
RAKAZO_DEPLOY_DIR=/srv/rakazo
RAKAZO_IMAGE_TAG=local
# Optional: required only with `--profile updater`.
# RAKAZO_UPDATER_TOKEN=replace-with-32-plus-character-updater-token
```

4. Build the images from your checkout and start the stack, then verify its public health endpoint:

```bash
docker compose --env-file .env -f infra/compose/docker-compose.prod.yml \
  build --build-arg GIT_SHA=$(git rev-parse HEAD)
docker compose --env-file .env -f infra/compose/docker-compose.prod.yml \
  up -d --wait --pull never
curl --fail https://app.example.com/health
```

**Build, do not pull, for a first deployment.** `RAKAZO_IMAGE_TAG` ships as `local`, a tag no
registry serves, so the commands above build `api`, `worker`, and `web` from the checkout you just
cloned. The opt-in command under [Updater sidecar](#updater-sidecar) builds `updater` when needed.

The public `/health` only reports liveness. Runtime, sandbox, and revision details stay on the API
port at `/internal/health`, which the edge does not route:

```bash
docker compose --env-file .env -f infra/compose/docker-compose.prod.yml exec api \
  node -e "fetch('http://127.0.0.1:3100/internal/health').then(r=>r.text()).then(console.log)"
```

Passing `GIT_SHA` is what makes `/internal/health` report a `"revision"`; a locally built image has no
other way to know its commit. Prebuilt images from the registry bake it in at publish time, so
switching to a release tag needs nothing more: the containers report the revision the image was built
from, not a `GIT_SHA` in `.env`.

Once a release has been published you can switch this host to prebuilt images by setting
`RAKAZO_IMAGE_TAG` to that release tag and running `pull` followed by `up -d --wait --pull never`.
See [Published images and tags](#published-images-and-tags) for the tag contract.

The root `.env` is excluded from both Git and the Docker build context. The database, application data,
and Caddy certificates live in named Docker volumes.

The production Compose file pins Postgres and Caddy to multi-architecture manifest digests, and the
published application/updater builds pin their base-image digests. Refresh those pins deliberately
when taking upstream security updates; changing only the visible major tag does not change the
content while a digest is present.

For the single-VM production layout, install `infra/compose/backup-prod.sh` as
`/usr/local/sbin/rakazo-backup` and enable the supplied `rakazo-backup.timer`. It creates a verified
Postgres custom-format dump plus an application-data archive under `/var/backups/rakazo`, with mode
`0600` and seven-day rotation. These local snapshots help with operator mistakes but are not a
substitute for an encrypted off-host backup or provider snapshot.

The scheduled backup uses `/srv/rakazo` by default. For another deployment directory, set
`RAKAZO_DEPLOY_DIR=/absolute/path/to/checkout` in a root-owned `/etc/rakazo/backup.env`
(mode `0600`). The service reads this optional file on each run; the script uses the selected
checkout's `.env` and production Compose file. If the stack was started with a custom `-p`,
set the same `COMPOSE_PROJECT_NAME` in that file. For a manual run, export these variables instead.
When updating an existing backup installation, reinstall both the script and service unit,
then run `systemctl daemon-reload`.

To deploy from CI, install `infra/compose/deploy-main.sh` as `/usr/local/sbin/rakazo-deploy-main`
and give CI a key restricted to it in the deploy user's `authorized_keys`
(`restrict,command="/usr/local/sbin/rakazo-deploy-main" ssh-ed25519 …`). It builds `origin/main`,
restarts the stack, waits for `https://$RAKAZO_HOST/health`, and rolls back on failure. Build and
start are time-limited so a stuck build fails the deploy instead of holding its lock; a deploy that
finds the lock held exits non-zero. For a checkout outside `/srv/rakazo`, put
`RAKAZO_DEPLOY_DIR=/absolute/path` in a root-owned `/etc/rakazo/deploy.env` readable by the
deploy user.

### Docker computers on the production stack

Layer `infra/compose/docker-compose.prod.docker.yml` after the base file in every Compose
invocation to run bot computers as local Docker containers instead of a remote provider:

```bash
# Pull only the pull-only dependency images (postgres, caddy, busybox);
# --pull never fails when they are absent locally.
docker compose --env-file .env \
  -f infra/compose/docker-compose.prod.yml \
  -f infra/compose/docker-compose.prod.docker.yml \
  pull --ignore-buildable
docker compose --env-file .env \
  -f infra/compose/docker-compose.prod.yml \
  -f infra/compose/docker-compose.prod.docker.yml \
  up -d --build --wait --wait-timeout 300 --pull never
```

In this topology `api`, `worker`, `web`, `supervisor`, and `computer` always build
from the checkout — `pull --ignore-buildable` only covers dependencies that have no
`build` section. To deploy published app images instead of building, use the base
file without the overlay. If `docker compose up --help` lacks `--wait-timeout`
(older Compose), drop `--wait` and verify with `docker compose ... ps` instead;
`--wait` alone can hang on one-shot services.

The overlay adds the supervisor (app image, `user: root`, Docker socket), the one-shot `computer`
image build and `data-init` ownership fix, points the API and worker at `http://supervisor:7091`,
and makes `SANDBOX_PROVIDER=docker` the default. It needs a dedicated `SANDBOX_SUPERVISOR_TOKEN`
in `.env`; `RAKAZO_COMPUTER_*` and the `SANDBOX_*` limits apply as documented in `.env.example`.
Like the updater, the supervisor is root-equivalent on the host: it publishes no port, joins only
the internal `app` network, and Caddy has no route to it. Bot computers are sibling containers on
per-bot networks that only the supervisor and the `web` screen proxy join.

When the `updater` profile is enabled too, give the sidecar the same file list and recreate set so
updates do not leave the supervisor on the previous app image:

```env
RAKAZO_COMPOSE_FILE=infra/compose/docker-compose.prod.yml:infra/compose/docker-compose.prod.docker.yml
RAKAZO_UPDATE_SERVICES=supervisor
```

The updater pulls and recreates services but cannot rebuild the `computer` stub image
(`pull_policy: build` is not pullable). Rebuild it on the host when the computer image
should change — for example after updating the checkout:

```bash
docker compose --env-file .env \
  -f infra/compose/docker-compose.prod.yml \
  -f infra/compose/docker-compose.prod.docker.yml \
  build computer
```

## Restore

### Development stack

For backups created by `scripts/backup.sh`, use an empty `rakazo` database in the development
Compose stack, with application services stopped. The SQL import runs in one transaction and
stops on the first error, including conflicts with existing tables. Files are restored and
application services started only after the import succeeds. This script does not consume the
production snapshot's custom-format `rakazo.dump` or `appdata.tgz`.

```bash
./scripts/restore.sh backups/<stamp>
```

### Production stack

For a snapshot written by `infra/compose/backup-prod.sh` (`rakazo.dump`, `appdata.tgz`, and
`objects/` with `objects.manifest.json` when object storage is on). Keep the same `.env` as the
backup: without its `ENCRYPTION_KEY` and `BETTER_AUTH_SECRET` the data cannot be read. Run these
commands from the deployment checkout on the host that owns the Compose project. Set
`dc='docker compose --env-file .env -f infra/compose/docker-compose.prod.yml'`.

1. Stop the services that write, and start Postgres alone:

   ```bash
   $dc stop caddy web worker api
   $dc up -d --wait postgres
   ```

2. Replace the database with the dump. This deletes the current contents:

   ```bash
   $dc exec -T postgres sh -c 'dropdb -U "$POSTGRES_USER" --force "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
   $dc exec -T postgres sh -c 'pg_restore --exit-on-error --no-owner --no-privileges -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
     < <snapshot>/rakazo.dump
   ```

3. Start everything. `migrate` applies migrations the dump lacks and recreates the `rakazo_app` login:

   ```bash
   $dc up -d --wait --pull never
   ```

4. If the snapshot has `objects.manifest.json`, restore the objects with the API container's
   settings (`restore` never deletes). Run it from the API container's network, as `backup-prod.sh` does:

   ```bash
   api=$($dc ps -q api)
   docker run --rm --network "container:$api" --user "$(id -u):$(id -g)" \
     --cap-drop ALL --security-opt no-new-privileges --entrypoint node \
     -v "$PWD/scripts/s3-objects.mjs:/s3-objects.mjs:ro" -v <snapshot>:/in:ro \
     --env-file <(docker inspect "$api" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep '^RAKAZO_S3_') \
     "$(docker inspect "$api" --format '{{.Image}}')" /s3-objects.mjs restore /in
   ```

5. Restore `appdata.tgz` if the snapshot contains it. This archive holds the API's `/data` volume
   (bot state under `DATA_DIR`). Keep `api` and `worker` stopped while restoring it. Use a temporary
   Compose `api` container so extraction targets the named volume on both Linux and macOS, where
   Docker Desktop keeps volumes inside its VM:

   ```bash
   snapshot=/absolute/path/to/snapshot
   $dc stop api worker
   $dc run --rm --no-deps --user 0:0 \
     -v "$snapshot:/restore:ro" --entrypoint sh api \
     -c 'tar -xzf /restore/appdata.tgz --numeric-owner -C /data && chown -R 1000:1000 /data'
   $dc up -d --wait --pull never
   ```

   With object storage on, most state is in the bucket instead. Check the health endpoint, sign in,
   and open a file or an agent home:

   ```bash
   curl --fail "https://$RAKAZO_HOST/health"
   ```

## Upgrade

**Required once, before the release that adds the Data room:** that release's migration runs
`CREATE EXTENSION vector`, which needs the Postgres image to include pgvector. The updater and the
commands below recreate only `api`, `worker`, and `web`, so switch Postgres first. Update the checkout
(or `docker-compose.prod.yml`) so `POSTGRES_IMAGE` resolves to the new pgvector image, then:

```bash
docker compose --env-file .env -f infra/compose/docker-compose.prod.yml pull postgres
docker compose --env-file .env -f infra/compose/docker-compose.prod.yml \
  up -d --wait --pull never postgres
```

This restarts Postgres briefly; the data volume is reused. If you skip it, the migration fails with
"the database image must include pgvector" and the API stays unhealthy until you do this.
If the API already failed with that error, Prisma has recorded the migration as failed and refuses
later migrations. After switching the image, mark it rolled back (nothing was applied) and restart
the API:

```bash
docker compose --env-file .env -f infra/compose/docker-compose.prod.yml \
  run --rm api pnpm --filter @rakazo/db exec prisma migrate resolve --rolled-back 20261020000000_data_room
docker compose --env-file .env -f infra/compose/docker-compose.prod.yml up -d --wait --pull never api
```
Updater-managed hosts do this step by hand once; the sidecar never touches Postgres.

A Compose deployment on a published release tag upgrades by moving that tag:

```bash
docker compose --env-file .env -f infra/compose/docker-compose.prod.yml pull api worker web
docker compose --env-file .env -f infra/compose/docker-compose.prod.yml \
  up -d --wait --pull never api worker web
```

A deployment on the default `local` tag has no registry to pull from, so it upgrades by rebuilding
the checkout instead. Tag each build with its commit so the previous image survives for rollback:
a build on plain `local` overwrites the `local` image. `api`, `worker`, `web`, and `migrate` share
one image, and `RAKAZO_IMAGE_TAG` names it (from the shell or `.env`):

```bash
git pull
OLD_TAG=$(sed -n 's/^RAKAZO_IMAGE_TAG=//p' .env)   # note it for rollback
export RAKAZO_IMAGE_TAG=local-$(git rev-parse HEAD) GIT_SHA=$(git rev-parse HEAD)
docker compose --env-file .env -f infra/compose/docker-compose.prod.yml \
  up -d --wait --pull never --build api worker web
```

Also set `RAKAZO_IMAGE_TAG=local-<commit>` in `.env` afterwards, so a later `up` or restart does not
look for a different tag. The shell value overrides `.env` only for that session.

`up --wait` does not report success until the new API is healthy and the worker and web containers
are running. The API starts only after the `migrate` service finishes, so a migration
failure keeps health red. A failed CLI recreate does not auto-roll back; recover with the previous
`RAKAZO_IMAGE_TAG` (`$OLD_TAG`; check `docker images | grep rakazo/app`) and
`up -d --wait --pull never api worker web`, with no `--build`. Migrations are not reversed. Keep the
old image until the new version has run for a while, and do not run `docker image prune -a` meanwhile.

The updater sidecar has its own image and tag so an update never recreates the process performing
it. Move it deliberately by setting `RAKAZO_UPDATER_IMAGE_TAG` to the full `sha-<commit>` tag, then
running `docker compose … pull updater && docker compose … up -d --wait --pull never updater`.
Sidecar `/apply` and `/rollback` recover a failed recreate by redeploying the previously cached
image when possible; if that also fails, they report a possible mixed-version runtime.

Source checkouts (not Compose) still upgrade the old way: pull, rebuild with
`GIT_SHA=$(git rev-parse HEAD)`, run `pnpm db:migrate`, then restart API and worker.
Product contracts stay compatible across cloud and self-hosted.

### Upgrading to the separate app database login

Releases with [database roles](#database-roles) need `POSTGRES_APP_PASSWORD` in `.env`. The
desktop app, `install-images.sh` and `infra/compose/deploy-main.sh` add it when it is missing.
Elsewhere, add it yourself (`openssl rand -hex 16`) before you pull, or Compose stops at config
validation with `Set POSTGRES_APP_PASSWORD in .env`. On first start, the API creates the
`rakazo_app` login, and the API and worker then connect as it. Nothing else changes, and the
upgrade does not rewrite any data.

If a feature misbehaves under row-level security, run `ALTER ROLE <login> BYPASSRLS;` on the login
in `DATABASE_URL` (`rakazo_app` in Compose) as a superuser (the Compose owner is one), then
restart the API and worker. Role attributes are not inherited, so granting it to `rakazo_app` does
nothing for a separate login. The app then runs as before, with a startup warning, and later
migrations leave that login alone. Undo it with
`NOBYPASSRLS` and another restart. Rolling back to an older release works without changes: it
ignores the extra variable and connects as the owner.

### Space privacy-boundary migration

Before upgrading across migration `20260830200000_space_scope_names_and_user_credentials`, check
that every existing model and voice credential still belongs to a member of its Space. This query
uses the pre-migration `workspaceId` column name and must return no rows:

```sql
SELECT 'model' AS credential_type, credential."id", credential."userId",
       credential."workspaceId" AS "spaceId"
FROM "user_model_credentials" AS credential
LEFT JOIN "space_members" AS membership
  ON membership."spaceId" = credential."workspaceId"
 AND membership."userId" = credential."userId"
WHERE membership."id" IS NULL
UNION ALL
SELECT 'voice', credential."id", credential."userId", credential."workspaceId"
FROM "user_voice_credentials" AS credential
LEFT JOIN "space_members" AS membership
  ON membership."spaceId" = credential."workspaceId"
 AND membership."userId" = credential."userId"
WHERE membership."id" IS NULL;
```

The migration renames columns used by the API and worker and is therefore a coordinated cutover,
not an online rolling migration. Stop the old API and worker, apply the migration, and start the new
versions together. Its lock waits are bounded so contention fails the migration instead of leaving
application traffic queued indefinitely.

### Published images and tags

`.github/workflows/publish-server-image.yml` publishes to `ghcr.io/<owner>/<repo>/…`, derived from
`${{ github.repository }}` rather than hardcoded, so a fork's CI fills the fork's own namespace. For
this repository that is:

| Image | Contents |
| --- | --- |
| `ghcr.io/elie222/rakazo/app` | api, worker, web, and sandbox supervisor — one image, multiple commands |
| `ghcr.io/elie222/rakazo/computer` | Linux desktop used as each bot computer |
| `ghcr.io/elie222/rakazo/updater` | the updater sidecar, plus the Docker CLI |

`infra/compose/docker-compose.images.yml` is the no-checkout path for those app and computer tags
plus Postgres. The supervisor runs from the app image on the internal network only (not a separate
published supervisor image, and no host port). Production Compose (`docker-compose.prod.yml`) can
also pull the same app tags once `RAKAZO_IMAGE_TAG` is set to a published value.

If you deploy from your own fork, set `RAKAZO_IMAGE` and `RAKAZO_UPDATER_IMAGE` to your namespace —
your CI cannot publish into someone else's.

| Tag | Published on | Moves? |
| --- | --- | --- |
| `local` | nothing — built locally by `up --build` | rebuilt in place |
| `local-<full-commit>` | nothing — built on the server by a fork update | never |
| `vX.Y.Z`, `vX.Y` | release tags | conventionally no / on patch releases |
| `latest` | stable `vX.Y.Z` tags only (not prereleases) | yes, to the newest stable release |
| `sha-<full-commit>` | every push and manual run | source-addressed; used by the updater sidecar |
| `edge` | pushes to main | yes, to the newest main build |

Every publish, including `edge` from main merges, is multi-arch (`amd64` + `arm64`): each
architecture builds natively on its own runner and one manifest is assembled per image. Until a
stable `vX.Y.Z` has been published, GHCR may only have `edge` and `sha-*` tags; do not pin
`latest` unless that tag exists in the registry.

Building the images yourself does not need QEMU. `docker compose up --build` builds for the host's
own architecture, and a fork publishing multi-arch images should do what `publish-server-image.yml`
does: build each architecture on a native runner (GitHub Actions provides `ubuntu-24.04-arm` for
public repositories) and merge the digests into one manifest. QEMU emulation
(`docker/setup-qemu-action`, `binfmt`) still works if you have no native arm64 machine, but it is
many times slower, hours rather than minutes for the `computer` image.

The updater resolves the newest stable `vX.Y.Z` source tag but deploys its `sha-<full-commit>` image,
not `latest` or a moving minor tag. A registry tag is not an OCI digest and GHCR package writers can
replace it, so the trust boundary remains this repository's publishing credentials. The workflow
reduces that boundary by using SHA-pinned actions, read-only pull-request jobs, digest-pinned base
images, SBOM/provenance output, and a GitHub build attestation. Operators who require registry-level
content addressing can pin `RAKAZO_IMAGE` outside the automatic updater to a verified digest.

Rollback never contacts the registry: it redeploys the previous tag from the local Docker cache,
so a later tag move cannot change rollback content. Do not prune the previous application image
until the next update has been accepted. If it is missing, rollback fails closed instead of pulling
new content under an old tag.

To populate the registry the first time, run the workflow manually (`workflow_dispatch`) or push a
`v*` tag. A manual run produces `sha-<full-commit>`; only a stable `vX.Y.Z` tag (no prerelease
suffix) produces `latest`, and any `v*` tag produces semver tags. The updater ignores prereleases
and refuses the official path until a stable `vX.Y.Z` exists.

### Updater sidecar

Compose production deployments offer an opt-in `updater` profile on a private `control` network.
Normal deployments do not start it or require its credential. To enable it, set a dedicated
`RAKAZO_UPDATER_TOKEN` and explicitly start the profile:

```bash
docker compose --env-file .env -f infra/compose/docker-compose.prod.yml \
  --profile updater up -d --build updater
```

It exposes `/health`, `/state`, `/plan`, `/apply`, and `/rollback` at `http://updater:7092` with
`RAKAZO_UPDATER_TOKEN`. Operator CLI upgrades above do not need it; the sidecar is for automated
apply/rollback over that private HTTP API.

The API cannot update itself — its image has no `.git`, and nothing inside the container would
restart it — so the work happens in a separate `updater` container that outlives the recreate:

- *Official repository:* resolves the newest stable release and its source commit with
  `git ls-remote --tags`, pins the corresponding full `sha-<commit>` image tag in `.env`, keeps the
  outgoing tag in `RAKAZO_IMAGE_TAG_PREVIOUS`, explicitly pulls the new image, then runs
  `up -d --wait --pull never`. No build runs on the server.
- *Fork (Advanced):* a fork has no published images, so the sidecar fast-forwards the checkout in
  `RAKAZO_DEPLOY_DIR` and runs `up -d --build`. This builds on the server and takes minutes rather
  than seconds. Point it only at a fork you control and have reviewed — the sidecar runs that
  Compose file through a root-equivalent Docker socket.

Updates and rollbacks run one at a time. A failed pull leaves running services alone; a failed recreate restores the previous environment
pin and attempts to redeploy the cached previous image. A failed fork build also restores the
pre-update branch and commit (including when checkout succeeded but merge did not) so a later
manual `--build` cannot deploy the rejected or unintended revision. Database migrations are not
reversed. The sidecar never recreates itself, never touches Postgres or Caddy, and never runs
migrations — that ordering belongs to the API start command.

Only `https://` and `ssh://` git remotes are accepted. Merges are fast-forward only. A dirty or
untracked source tree fails closed before anything runs (the application Dockerfile uses `COPY . .`).

### The deploy directory must be one path

`RAKAZO_DEPLOY_DIR` is bind-mounted into the updater at the same path it is read from
(`${RAKAZO_DEPLOY_DIR}:${RAKAZO_DEPLOY_DIR}`), and that is load-bearing rather than tidy. Production
Compose defaults both sides to `/srv/rakazo`; set the variable for any other layout. When the
updater runs `docker compose -p <project> --file $RAKAZO_DEPLOY_DIR/infra/compose/docker-compose.prod.yml up -d`,
the Compose CLI *inside* the container expands this file's relative bind mounts — `../../.env`,
`./Caddyfile.prod` — against that path and hands the results to the daemon. The daemon has to be
able to resolve the same strings, or it silently creates empty directories where your `.env` and
Caddyfile should be. Compose makes the effective `-p` value available for interpolation but does
not automatically put it in a container's environment, so the production file explicitly assigns
`COMPOSE_PROJECT_NAME` to the updater. A standalone sidecar can instead set
`RAKAZO_COMPOSE_PROJECT_NAME`; the final fallback is `rakazo-prod`. Without that propagation, a
stack started with `-p something-else` would be left alone while a second project with a new empty
Postgres volume came up beside it.

### Deployments that layer a Compose overlay

`RAKAZO_COMPOSE_FILE` takes a list, separated the way Compose's own `COMPOSE_FILE` is
(`:` by default, or whatever `COMPOSE_PATH_SEPARATOR` says). Each entry becomes its own `--file`,
in the order given, so the updater reconciles the same stack the operator runs by hand:

```
RAKAZO_COMPOSE_FILE=infra/compose/docker-compose.prod.yml:ops/compose/overlay.yml
```

Every entry is validated separately and must stay inside `RAKAZO_DEPLOY_DIR`.

If the overlay adds a service built from the application image, name it in
`RAKAZO_UPDATE_SERVICES` (comma separated) so it is pulled, recreated and rolled back with the
rest. Otherwise an update leaves that service running the previous code:

```
RAKAZO_UPDATE_SERVICES=supervisor
```

These names are appended to the built-in `api`, `worker`, `web`, never substituted for them, so no
value here can drop a core service from an update.

The value therefore has to be the path **the daemon** sees, which is not always the path your shell
sees:

- **Linux.** The daemon shares the host filesystem, so the checkout path is the answer:
  `/srv/rakazo` is the default and supported production layout. Set `RAKAZO_DEPLOY_DIR` explicitly
  when the checkout is elsewhere.
- **Docker Desktop (Windows/macOS).** The daemon runs in a VM that mounts your drive somewhere else.
  On Windows, `C:` appears at `/run/desktop/mnt/host/c`, so a checkout at `C:\Users\you\rakazo` is
  `RAKAZO_DEPLOY_DIR=/run/desktop/mnt/host/c/Users/<user>/rakazo`. Host Git may use `core.autocrlf=true`; the updater ignores CR-only diffs so that does not block `/apply`. Verify the mount before deploying:

```bash
docker compose --env-file .env -f infra/compose/docker-compose.prod.yml \
  --profile updater run --rm updater git -C "$RAKAZO_DEPLOY_DIR" log --oneline -1
```

  That must print your checkout's HEAD. The two tempting wrong answers both fail: a native Windows
  path is rejected by the daemon (`mount denied: … too many colons`, because the drive letter's
  colon collides with the bind-mount separator), and `/mnt/c/...` fails *silently* — the container
  starts, the mount is an empty directory, and the updater simply reports no checkout.

### The updater's privileges

The updater holds the Docker socket, which is root-equivalent on the host. It is scoped as narrowly
as that allows:

- No `ports`, so nothing is published on the host.
- Only on the dedicated `control` network shared with the API. Caddy is not attached, so the
  reverse proxy has no route to the updater.
- Every route except `/health` requires the shared bearer token, compared in constant time.
- The process environment carries only updater settings (`RAKAZO_UPDATER_TOKEN`, deploy path,
  image name, project name). Application secrets stay in the bind-mounted `.env` that Compose
  reads for interpolation; they are not loaded into this container.
- The Docker CLI lives only in the updater image. The api, worker, and web containers keep
  `cap_drop: ALL` and no socket.

Enabling the `updater` profile requires `RAKAZO_UPDATER_TOKEN` to be a dedicated random value (at
least 32 characters in production). It must differ from `BETTER_AUTH_SECRET`,
`SANDBOX_SUPERVISOR_TOKEN`, and `SCREEN_PROXY_SECRET`. Leave the profile disabled if you would
rather not grant the capability.

## Other deployment layouts

API and worker need always-on processes; serverless request handlers are not sufficient. Use a
Node.js version supported by the root `package.json`, Postgres 16 and an S3-compatible object store, with encrypted off-host backups. Agent homes live in
the object store, so API and worker processes on separate hosts need no shared filesystem. A Docker
computer still mounts its working copy under `DATA_DIR/homes`, so Docker computers need the
supervisor and its `DATA_DIR` on one host.

Use the same HTTPS origin for the web app, `/api`, and `/rpc`. Preserve the authenticated screen
proxy routes. Choose a [computer provider](#choosing-a-computer-provider) appropriate to the
service's trust boundary. `SIGNUPS_ENABLED` applies on the API's first start. A non-empty
`SIGNUP_ALLOWLIST` applies on every API start.
The optional marketing site in `apps/www` can be hosted separately.

The production Compose stack also runs on macOS with Docker Desktop. For recovery, use the
[production restore procedure](#production-stack); its temporary Compose container accesses named
volumes inside Docker Desktop's VM, so do not extract `appdata.tgz` into a host directory.

## Connect mobile clients

The iOS and Android app can point at a self-hosted origin at runtime. For the native iOS app, with a development stack running (`pnpm dev`), run this on the server machine:

```bash
pnpm connect
```

It prints a QR code and the server URL. On the phone, tap **Use a custom server**, then **Scan QR code** (shown on a real device only), or open the link `rakazo://connect?server=<origin>` on the phone. The app shows the server name and asks you to confirm before it switches. Changing the server signs the device out of any previous session. The QR holds only the server URL, no secret.

What the command does, in order:

1. Picks an access method. Without `--method` it uses Tailscale when the `tailscale` CLI is installed, and otherwise lists the other methods and stops.
2. Checks that something listens on the web port, then works out the URL. For Tailscale it reads the machine's status, reuses an existing Tailscale Serve entry for the web port, or runs `tailscale serve --bg --https=443 http://127.0.0.1:<web port>`. This serves the app to devices on your tailnet only. The command never uses Funnel, and Funnel is not needed for a phone.
3. Compares the URL with `RAKAZO_TRUSTED_ORIGINS` and `RAKAZO_ALLOWED_HOSTS`. If a line is missing it shows the lines to add to `.env` and asks `[y/N]` before writing. It writes nothing with `--no-env-write`, or in a terminal that is not interactive unless you pass `--yes`. When lines are needed and not written, the command stops without a QR code. Restart `pnpm dev` after `.env` changes, because the server reads them only at start.
4. Calls `POST /rpc/health` on the URL and requires `json.ok: true`, then prints the QR code and the URL.

Flags:

| Flag | Meaning |
| --- | --- |
| `--method tailscale\|lan\|url` | Access method. `url` needs `--url`. |
| `--url <origin>` | With `--method url`: use this server URL (for example a reverse proxy). `https`, or `http` only for a private, loopback or `.local` host. |
| `--web-port <port>` | Port the web app listens on. Defaults to `WEB_PORT` from the shell or `.env`, then `5173`. |
| `--timeout <seconds>` | Limit for each Tailscale command and the health check. Default `10`, maximum `300`. |
| `--yes` | Write the `.env` lines without asking. |
| `--no-env-write` | Print the `.env` lines but never write them. |

`--method lan` uses the machine's single private IPv4 address as `http://<ip>:<web port>`, so traffic is not encrypted. If the health check fails, set `RAKAZO_DEV_HOST=0.0.0.0` and restart `pnpm dev`.

If Tailscale Serve is not enabled for your tailnet, the command stops with "Tailscale Serve is not enabled; enable Serve in the Tailscale admin console." and includes the admin-console approval link when Tailscale printed one. Approve it there, then run `pnpm connect` again. The command also stops with a one-line message when Tailscale needs sign-in, is stopped, has MagicDNS or HTTPS certificates off, or when another Serve entry already uses HTTPS port 443 or has public access on.

SSO: sign-in with an identity provider returns to `BETTER_AUTH_URL`, which the phone must be able to open. When SSO is configured, the command prints a warning. Either sign in with a password on the phone, or register `<origin>/api/auth/callback/oidc` with the provider and set `BETTER_AUTH_URL` to the same origin.

Manual fallback (also the route for Android): on the sign-in screen tap **Use a custom server** and enter the HTTPS origin (for example `https://app.example.com`, or your Tailscale name after `tailscale serve --bg --https=443 http://127.0.0.1:<web port>`), then add that origin to `RAKAZO_TRUSTED_ORIGINS`. Plain `http://` is accepted only for a private IP, `localhost`, or a `.local` name. A hostname reached over a VPN such as WireGuard or Tailscale needs HTTPS with a certificate the phone trusts. Store builds of the Expo app still default to `EXPO_PUBLIC_API_URL`; the in-app setting is an override for people running their own API.

## Connect outside AI clients (MCP)

The API serves a Model Context Protocol endpoint at `/mcp`. AI clients such as Claude Code,
claude.ai, ChatGPT and MCP Inspector can connect to it, read the data of one Space, make changes
that follow your approval rules, and send messages to your agents. Each connection is bound to
one Space and one member. It is checked again on every call, so a member who leaves the Space, or
a connection that is revoked, stops working on the next call.

There are two ways to connect:

- **A personal access token**, for clients that can send a header (Claude Code). It works on
  localhost and needs no public address.
- **OAuth**, for clients that sign in through a browser (claude.ai, ChatGPT). It needs a public
  address, so see the Funnel section below. On localhost, MCP Inspector and Claude Code can also
  use OAuth.

### Claude Code with a token

1. Open **Settings > Connections** and choose **Create token**. Name it, pick one Space, and leave
   **Read-only** on unless the client needs to make changes. The token is shown once.
2. Run this in a terminal. Use the API address, `http://127.0.0.1:<API port>/mcp` on a local
   stack (`3200` on a dev stack), or your public address followed by `/mcp`:

   ```bash
   claude mcp add --transport http praci http://127.0.0.1:<API port>/mcp --header "Authorization: Bearer <token>"
   ```

3. In Claude Code, run `/mcp` to check that `praci` is connected, then ask a question such as
   "list my agents".

The token is stored hashed, so a lost token cannot be shown again. Create a new one and revoke
the old one.

### On localhost

Nothing to set. Point a client at the API address, for example
`claude mcp add --transport http praci http://127.0.0.1:<API port>/mcp`, then sign in from the
client (`/mcp` in Claude Code). The approval page opens on `WEB_ORIGIN`.

### From the internet with Tailscale Funnel

Unverified: these commands have not been run. Check the flags against your Tailscale version
(`tailscale funnel --help`), and whether Funnel keeps the path prefix when it proxies.

Only the endpoints a client calls are public. The web app, `/rpc` and the rest of `/api` stay
private. The approval page is not public either: the member opens it from a browser that can
reach `WEB_ORIGIN`, and the client's own browser redirect brings them there.

1. Pick the public address, `https://<machine>.<tailnet>.ts.net`, and set it in `.env`:

   ```
   PUBLIC_MCP_URL=https://<machine>.<tailnet>.ts.net
   ```

   It becomes the OAuth issuer and the base of the token and registration endpoints. Leave
   `BETTER_AUTH_URL` and `WEB_ORIGIN` unchanged: the session cookie belongs to the web origin.
2. Restart the API so it reads the setting.
3. Expose three path prefixes. `<port>` is where the endpoint listens: the API port on a dev stack
   (`3200`, or the port of `API_URL`). On the production Compose stack the API is not published, so use
   the Caddy listener (for example `127.0.0.1:8080` when Caddy is published on loopback behind
   `tailscale serve`). `Caddyfile.prod` already sends `/mcp`, `/.well-known/oauth-*`, and `/api/*` to the API:

   ```bash
   tailscale funnel --bg --set-path /mcp http://127.0.0.1:<port>/mcp
   tailscale funnel --bg --set-path /.well-known http://127.0.0.1:<port>/.well-known
   tailscale funnel --bg --set-path /api/auth/oauth2 http://127.0.0.1:<port>/api/auth/oauth2
   ```

4. Check the public address from another network. Both must return JSON:

   ```bash
   curl https://<machine>.<tailnet>.ts.net/.well-known/oauth-protected-resource/mcp
   curl https://<machine>.<tailnet>.ts.net/.well-known/oauth-authorization-server
   ```

   In the second, `authorization_endpoint` should point at `WEB_ORIGIN`, and `token_endpoint` and
   `registration_endpoint` at the public address.
5. Add the connector in the client with `https://<machine>.<tailnet>.ts.net/mcp`.
6. To stop exposing it: `tailscale funnel reset`, and unset `PUBLIC_MCP_URL`.

### What the client can do

Read tools never change anything:

| Tool | What it returns |
| --- | --- |
| `agents_list` | The agents in the Space: id, name and description. |
| `contacts_list` | Contacts. |
| `finance_overview`, `finance_breakdown`, `finance_transactions`, `finance_recurring`, `finance_crypto` | Finance summaries, spending by category, transactions, recurring payments and crypto balances. |
| `cap_table_read` | The cap table. |
| `fundraising_read` | Investors and the fundraising round. |
| `meetings_list` | Meeting notes. |
| `search_data_room` | Titles and snippets from the data room, not whole files. |
| `scratchpad_list` | An agent's scratchpad items. |
| `thread_read` | The latest messages of one agent's thread. |
| `agent_run_status` | The state of an agent's run, and its reply once it has finished. |
| `action_status` | The state of a change that is waiting for your approval. |

Write tools change data in the Space:

| Tool | What it does |
| --- | --- |
| `contacts_add`, `contacts_save` | Add a contact, or change one. |
| `scratchpad_add`, `scratchpad_update`, `scratchpad_complete` | Add, change or finish a scratchpad item of one agent. |
| `agent_send` | Send a message to one of your agents. The agent runs without you watching, so its risky actions ask for your approval in Praci, even if your rules would allow them in a live chat. The message appears in the agent's thread with "via <connection name>". |

Mail, calendar, Drive and anything that moves money are not available. Text written by people or
third parties, such as notes and contact names, comes back in fields named `untrusted_text`, and
the client is told to treat it as data.

### Read-only and write

A **Read-only** connection sees only the read tools and is refused if it calls a write tool. You can
switch a connection between read-only and read-write in **Settings > Connections** at any time.
Use read-only unless the client has to make changes.

### Approvals and Always allow

A write from an outside client follows your approval rules for the Space (**Allow**, **Ask**,
**Block**). Unlike your own agents, an outside client has no default Allow:

- **Block**: the call is refused.
- **Allow**: the change is made at once.
- **Ask**, or no rule: the change waits. The client gets `pending_approval` and an action id, and
  can check it with `action_status`. Praci sends you a notification and shows a card in
  **Settings > Connections** with what the client sent. **Approve** makes the change once.
  **Deny** drops it. A card nobody answers expires after 24 hours.
- **Always allow this** on a card approves it and saves an Allow rule for that tool in the Space,
  so the next call from any connection runs without asking. Remove the rule in the approval
  rules if you change your mind. A few tools can never be allowed permanently.

A connection can have at most 20 changes waiting at once.

### Notifications

When a connection is created, by you from **Create token** or by approving a client through
OAuth, you get a notification, "New connection: <name> in <Space>". It opens **Settings >
Connections**, so a connection you did not make is easy to notice. You also get one when a change
needs your approval.

### Rate limits

- Each connection can make 120 calls per minute. Calls over the limit return "Rate limit reached"
  and a number of seconds to wait.
- Each internet address can register up to 10 new OAuth clients per hour (the `register`
  endpoint is open so that clients can set themselves up). The 11th request gets HTTP 429. The
  count is kept in Postgres, so it is shared by all API processes. The address is the socket
  address; behind a proxy on the same machine, such as Tailscale Funnel, it is the last
  `X-Forwarded-For` entry, which the proxy adds. A proxy on another machine is not trusted: its
  address is used instead.
- Call history (tool name, outcome and time, never arguments or results) is shown per
  connection and deleted after 30 days.

### Revoking a connection

In **Settings > Connections**, choose **Revoke** on the connection. It stops on its next call. For
an OAuth client the refresh tokens and your approval are deleted too, so the client has to ask
you again. Revoke a token you no longer use, and any connection you do not recognise.
