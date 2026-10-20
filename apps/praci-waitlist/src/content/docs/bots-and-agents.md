---
title: Bots and agents
description: Chief, the agents for each page, skills, routines and how approvals work.
group: Agents and apps
order: 20
---

Praci is built around **bots**. A bot is a long-lived assistant with its own conversation, memory and history. It can also run scheduled **routines** and use its own **computer**: a browser, a terminal and files that belong to that bot. Your bots are listed in the sidebar.

![A conversation with Chief](/docs/chief.webp)

*Demo data.*

## Chief

Chief is the first bot Praci creates for you. Use it for anything that does not belong to a particular page: questions across your company, drafting a hiring plan, preparing for a meeting. Chief can use the apps you give it access to and the Data room, and saves the documents it writes to [Artifacts](/docs/artifacts).

## Agents for each page

Some pages come with an agent that knows that area. Each page has an **Ask** button that opens it beside the page.

| Page | Agent |
| --- | --- |
| [Inbox](/docs/inbox) | Inbox agent: searches your whole mail history |
| [Finance](/docs/finance) | Finance agent: reads your synced numbers, reasons about burn and runway |
| [Legal](/docs/legal) | Legal agent: reads the Data room for contracts and deadlines |
| [Cap table](/docs/cap-table) | Carta agent: reads Carta, drafts investor updates and audit replies |

These agents are also bots, so they appear in the sidebar and you can chat with them there.

## Your own bots

Create more bots for jobs of your own, give each instructions, and choose which [connected apps](/docs/integrations) each one can use. A bot can hand work to other bots or to short-lived helpers.

## Skills

A skill is a set of instructions a bot loads when a task calls for it. Praci ships built-in skills, for example for cost cutting, runway scenarios, monthly money reviews, drafting investor updates and answering auditor requests. You can add your own on a bot's **Skills** section: write one, upload a `SKILL.md` file, or add one from a URL. When a bot proposes a skill itself, it appears under **Drafts** and does nothing until you **Approve** or discard it.

## Routines

A routine runs a prompt on a schedule, such as every Monday morning. Set one up from the **Computer and routines** button at the top of a bot's chat.

## Approvals

Bots ask before they do things that reach outside their own computer. The prompt shows what the bot wants to do, and you choose:

- **Allow once.** Run it this time.
- **Always allow this tool.** Stop asking for this tool.
- **Deny.** Do not run it.

For email, the prompt shows the message itself, with **Send it** and **Edit first**.

What asks by default includes sending or saving mail drafts, changing mail, creating, changing or deleting calendar events, creating or changing Drive files, saving contacts, deleting or archiving bots, forgetting memories, and any action in a connected app that is not clearly a read. Inside its own computer, a bot can browse, run commands and edit its own files without asking.

In **Settings** you can add rules: **Ask before sending external email**, **Ask before purchases**, and **Flag unexpected actions**, which has a model review consequential actions before they run. The last one needs a model connected. Some actions, like sending an iMessage, always ask and cannot be turned off.

See [Privacy and safety](/docs/privacy-and-safety).

<!-- TBD: Team health is listed in the codebase as a sidebar page template that is not available yet, so it is left out. Projects and GTM exist only as plans and mockups (docs/project-management, docs/gtm), so they are left out. The Task board is behind a feature flag and is left out. -->
