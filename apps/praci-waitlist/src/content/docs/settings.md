---
title: Settings
description: Models, memory, voice, usage, appearance and what each setting controls.
group: Run it
order: 30
---

Open **Settings** from your name at the bottom of the sidebar. The same menu has **Hide amounts**, which hides money amounts in Finance, chat and email, and **Usage**.

## General

- **Account and password.**
- **Appearance and language.** Sidebar density, language, time zone and bot avatar style.
- **Advanced.** Stream replies, show tool activity, and load web images automatically.

## Privacy and approvals

**Approvals** is a table with one row for each kind of action a bot can take. Set each row to **Allow**, **Ask** or **Block**. Five rows show at first: **Send email**, **Spend money**, **Connected apps (write)**, **Calendar changes** and **Edit files and run commands**. Choose **More actions** for **Use the computer**, **Delete data**, **Message people outside Praci** and **Use saved credentials**.

![The Approvals table in Settings, Privacy and approvals](/docs/approvals-table.webp)

*Demo data.*

![The Approvals table with More actions open](/docs/approvals-more-actions.webp)

*Demo data.*

- **Allow** runs the action without asking in a chat you are in.
- **Ask** shows an approval card every time.
- **Block** refuses the action and tells the bot not to try again.

A background run, such as a routine, asks before it does any of these, even if the row says **Allow**. A row set to **Block** still blocks. Under the table, rules you saved from an approval card, such as **Always allow this tool**, are listed with **Allow**, **Ask**, **Block** and **Remove**.

To change the rules for one bot, open its settings and use **Approvals**. Each row starts at **Same as all bots**. See [Bots and agents](/docs/bots-and-agents#approvals).

**AI data sharing** is on the same page. It has a switch for each AI service that lets it read your mail and documents so Praci can sort your Inbox and read the [Data room](/docs/data-room). Without the switch, bots still answer through the service you chose in Models, but that service does not read your mail and documents in the background.

## Models

Connect models and pick the default, as described in [Getting started](/docs/getting-started#connect-a-model). You can also:

- Add **backup models** (up to ten) that take over when the default fails.
- Set a **Data room search model**, an embedding model that lets Data room search match by meaning. It must produce 1024-dimension vectors. OpenRouter and OpenAI embedding models work, and so does a local Ollama model such as `mxbai-embed-large`.

## Memory

Choose whether each bot keeps its own memory or all bots share one. Advanced users can connect an outside memory service.

## Voice

Add your own key for a voice provider (ElevenLabs, OpenAI, Cartesia or Fish Audio) to have bots speak replies and to dictate and call bots by voice.

## Usage

The amount of AI text your bots have used. Model spend is billed by your model provider through your own key.

## Computer, Updates and Billing

**Computer** appears when your server runs bot computers. **Updates** shows when the app needs an update. **Billing** appears only on hosted deployments.
