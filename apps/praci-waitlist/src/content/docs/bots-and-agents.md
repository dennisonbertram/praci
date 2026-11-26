---
title: Bots and agents
description: Chief, the agents for each page, skills, tools, routines and how approvals work.
group: Agents and apps
order: 20
---

Praci is built around **bots**. A bot is a long-lived assistant with its own conversation, memory and history. It can also run [routines](/docs/routines) on a schedule or when a web page changes, keep a list of [open work](/docs/check-ins), and use its own **computer**: a browser, a terminal and files that belong to that bot. Your bots are listed in the sidebar.

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

A bot can also learn a skill from you. Do the job once on its computer and Praci records it as steps. See [Teach a task](/docs/teach-a-task).

## Tools

A tool is a small program a bot wrote to do the same calculation the same way every time, such as weekly burn from a list of transactions. The bot reads the data with its normal tools, then passes it to the tool and gets a result back.

When a bot wants to add a tool, it appears under **Drafts** in the bot's **Skills** section. The draft shows:

- **Reads:** what data the tool works on.
- **Writes:** what the tool changes. A tool cannot change anything, so this says **nothing**.
- A sample input and the result the bot got when it tried the tool.
- **Code**, which opens the program itself.

![A tool draft in a bot's Skills section, with Reads, Writes, a sample and Approve](/docs/tool-draft.webp)

*Demo data.*

Choose **Approve** to let the bot use the tool, or **Discard**. A tool runs the same way every time: it only gets the data the bot gives it, and it cannot reach files, the network or your accounts. It has 2 seconds and 32 MB to finish. If the bot changes an approved tool later, the change appears as an **Update** draft, and the approved version keeps running until you approve the change. Because an approved tool cannot send or change anything, background runs can use it without asking.

## Routines

A routine runs a prompt on a schedule, such as every Monday morning, or when a web page changes. Set one up from the **Computer and routines** button at the top of a bot's chat, or ask the bot in chat. A routine can stay silent when there is nothing to tell you. A routine is a background run, so it is read-only: it asks before it sends, edits files or runs commands. See [Routines](/docs/routines) and [Approvals](#approvals).

## Check-ins and open work

A bot can check in once a day and tell you only when something needs you, and it keeps a list of open work with what it is waiting on and when each item is due. See [Check-ins and open work](/docs/check-ins).

## Approvals

Bots ask before they send, change or run anything that reaches beyond their own computer, and background runs ask for all of it. The card shows what the bot wants to do, and you choose:

- **Allow once.** Run it this time.
- **Always allow this tool.** Stop asking for this tool. Some cards do not offer it, including email cards and cards from background runs.
- **Deny.** Do not run it.

For email, the card shows the message itself, with **Send it** and **Edit first**. When a card was raised because the run was in the background, it says **Asked because this ran in the background.** When it was raised by a rule you set, it says **Asked because of your rule for Send email.**, with the name of that action.

**Settings, Privacy and approvals** has an **Approvals** table with one row for each kind of action. Set each row to **Allow**, **Ask** or **Block**. **Block** refuses the action and tells the bot not to try again or work around it. A background run asks even for rows set to **Allow**.

![A bot's Approvals section with Send email set to Block and Edit files and run commands set to Ask](/docs/bot-approvals.webp)

*Demo data.*

To give one bot different rules, open its settings and use **Approvals**. Each row starts at **Same as all bots**. Choose **Allow**, **Ask** or **Block** to override the table for that bot. Choose **Same as all bots** again to remove the override.

Some actions, like sending an iMessage, always ask and cannot be set to **Allow**.

See [Privacy and safety](/docs/privacy-and-safety).

<!-- TBD: Team health is listed in the codebase as a sidebar page template that is not available yet, so it is left out. Projects and GTM exist only as plans and mockups (docs/project-management, docs/gtm), so they are left out. The Task board is behind a feature flag and is left out. -->
