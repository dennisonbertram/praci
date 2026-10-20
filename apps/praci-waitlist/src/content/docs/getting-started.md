---
title: Getting started
description: What Praci is, the three ways to run it, and how to connect a model.
group: Start
order: 1
---

Praci is an open source AI team for the work that runs a company: your inbox, cash, contracts, cap table and investor documents. You talk to bots. Each bot has its own conversation, memory, scheduled routines and a computer it can use (a browser, a terminal and files). Several bots come ready-made for the main pages of the app, and you can add your own.

Praci is in beta. It runs as a web app, an Electron desktop app and an Expo mobile app.

![The Praci Finance page with cash, burn, runway, a burn chart, a category breakdown and upcoming payments](/docs/finance.webp)

*Demo data for a made-up company, Northwind Robotics.*

## Ways to run Praci

**Desktop app.** Choose **This computer** and the app starts the whole stack for you with Docker Compose. You need Docker Desktop, OrbStack or Docker Engine installed. If you already run a Praci server, choose **Existing instance** and enter its address instead.

<!-- TBD: public desktop installer download link. No release is published yet (gh release list was empty on 2026-10-20), so the text points to building from source. -->
To build the desktop app from source, see [Self-contained local build](https://github.com/dennisonbertram/praci/blob/main/docs/desktop-release.md#self-contained-local-build).

**Self-host.** Run the published Docker images or a source checkout on your own machine or a server. Your data stays in your own Postgres database. See [Self-hosting](/docs/self-hosting).

**Praci Cloud.** A hosted version is planned and not open yet. You can join the waitlist on the [home page](/).

## Create an account

Open the app and sign up. On a self-hosted server, the first person to register becomes the owner of that deployment.

After sign-up, Praci asks you to connect a model and then creates your first bot, called **Chief**.

## Connect a model

Bots need a language model. Praci does not require a particular vendor. In onboarding, and later in **Settings, Models**, you can:

- **Sign in with ChatGPT.** Use your ChatGPT account.
- **Sign in with OpenRouter.** One account that reaches many models.
- **Use an API key instead.** Pick a provider and paste its key. For a model server you run yourself, such as Ollama, choose an OpenAI-compatible provider and enter the server URL; Praci can look up the models it offers.

You can connect more than one model, pick a default, and set backup models that take over if the default fails. See [Settings](/docs/settings).

## What to open first

1. Talk to **Chief** about anything: "What should I hire for first?" Chief can write documents, which appear in [Artifacts](/docs/artifacts).
2. Connect Gmail so the [Inbox](/docs/inbox) has mail to work with. See [Connect apps](/docs/integrations).
3. Connect Mercury or Brex to see runway on [Finance](/docs/finance).
4. Drop contracts and board decks into the [Data room](/docs/data-room).

Bots ask before they send, pay or change anything outside their own computer. See [Privacy and safety](/docs/privacy-and-safety).
