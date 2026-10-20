---
title: Self-hosting
description: Run Praci on your own machine or server with Docker, and keep your data in your own database.
group: Run it
order: 32
---

Praci is a long-running service, not a static site. A deployment is four parts: an API, a background worker, a Postgres database, and a computer provider that runs each bot's browser and terminal. Docker Compose runs all of them for you.

## Quick start

You need Docker, Node.js 22.22.2 or newer in the 22.x line (or 24.x, or 26 and up), and pnpm 9.

```bash
git clone https://github.com/dennisonbertram/praci.git
cd praci
cp .env.example .env
```

In `.env`, set a database password, and set `BETTER_AUTH_SECRET`, `ENCRYPTION_KEY` and `SCREEN_PROXY_SECRET` to long random values (`openssl rand -hex 32` works). Set `SANDBOX_SUPERVISOR_TOKEN` too, which Docker bot computers need. You can set `OPENROUTER_API_KEY` now, or connect a model in the app. Then start the stack as described in the [README quick start](https://github.com/dennisonbertram/praci#quick-start-for-developers), and open `http://127.0.0.1:5173`.

The first account you create becomes the owner of the deployment.

## Published images

You can also run published Docker images without cloning the repository. This needs Docker Engine 26 or newer with the Compose plugin. The installer creates a `.env` with random secrets and starts the stack. See [Published images](https://github.com/dennisonbertram/praci/blob/main/docs/self-host.md#published-images-no-checkout) in the self-hosting guide.

## Putting it on a server

- Put TLS in front of the web port and set `BETTER_AUTH_URL`, `WEB_ORIGIN` and `API_URL` to your public HTTPS address.
- Before the first start of a public server, configure SMTP for email and a signup allowlist. A server with open signup and no email should stay on a trusted network.
- Optional single sign-on through OpenID Connect is supported.
- Keep your `ENCRYPTION_KEY` safe and unchanged. Stored credentials are encrypted with it.

## Where bots run

Each bot's computer runs on a provider you choose. Docker is the default and needs no outside account. E2B, Daytona, CreateOS and Box run bot computers away from your server, which suits a public or multi-user deployment. The desktop provider runs commands directly on the server host, so do not use it on a shared server. See the [provider guide](https://github.com/dennisonbertram/praci/blob/main/docs/self-host-sandbox-providers.md).

## Files and backups

Uploads, artifacts and bot files go to local disk by default, or to S3-compatible storage (S3, R2, MinIO) when you set it. See [Backups and export](/docs/backups-and-export) for backup and restore.

## Models and keys

Praci works with your own model credentials. Use a hosted provider, or a model server you run yourself such as Ollama, if you want nothing to leave your network. See [Privacy and safety](/docs/privacy-and-safety).

For everything else, including upgrades and the updater sidecar, read the full [self-hosting guide](https://github.com/dennisonbertram/praci/blob/main/docs/self-host.md).
