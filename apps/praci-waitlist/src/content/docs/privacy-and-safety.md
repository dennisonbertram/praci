---
title: Privacy and safety
description: Agents ask before they send, pay or change anything. You choose the models and keep the keys.
group: Run it
order: 33
---

## Bots ask before acting outside their computer

A bot can do a lot on its own computer: browse, run commands, write files. When it wants to do something that reaches beyond that, Praci stops and asks you first.

- Sending mail, saving drafts or changing mail. You see the whole message and choose **Send it** or **Edit first**.
- Creating, changing or deleting calendar events, and creating or changing Drive files.
- Writing in a connected app, unless the action is clearly a read.
- Starting an outside cloud agent, deleting or archiving a bot, and forgetting a memory.

You can answer **Allow once**, **Always allow this tool** or **Deny**. You can also turn on rules in Settings that ask before external email or purchases, and a check that flags unexpected actions. Details are in [Bots and agents](/docs/bots-and-agents#approvals).

Money pages are read-only. [Finance](/docs/finance) and the [Cap table](/docs/cap-table) read from Mercury, Brex and Carta. Their agents are not given tools to pay, transfer, change cards or edit your cap table.

## Your models and keys

You choose the AI service, and you can change it. Praci takes a ChatGPT or OpenRouter sign-in, a provider API key, or the address of a model server you run. Keys are encrypted at rest with a key that only your server holds. Nothing in Praci requires one hosted vendor.

## What leaves your machine

Whatever you chat about, and the content bots read to do their work, goes to the AI service you chose, so that service can answer. Two background features read more, so each asks for your consent first and names the service that receives the data:

- **Inbox sorting** reads sender, recipients, subject and a short preview of each message.
- **Data room and Legal** read the text, and for images and scans the page images, of your documents.

Each switch is under **Settings, General, AI data sharing**, and a change of model asks you again.

To keep everything on your own hardware, run a local model server such as Ollama, use local disk or MinIO for files, and self-host. Google services (Gmail, Drive) and any app you connect still talk to their own providers.

## Your data

Your data lives in your own Postgres database when you self-host. You can [export it or back it up](/docs/backups-and-export), and you can disconnect any app at any time. Disconnecting removes Praci's access and the mail it cached from that account. It does not delete your data inside the app.

## Reporting a problem

Praci is in beta. Report security problems through [GitHub private vulnerability reporting](https://github.com/dennisonbertram/praci/security/advisories/new), not in a public issue.
