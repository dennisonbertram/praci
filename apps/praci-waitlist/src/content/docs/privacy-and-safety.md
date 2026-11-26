---
title: Privacy and safety
description: Background runs are read-only, and agents ask before they send, pay or change anything. You choose the models and keep the keys.
group: Run it
order: 33
---

## Bots ask before they send, change or run anything

A bot can do a lot on its own computer: browse, run commands, write files. When it wants to do something that reaches beyond that, or when nobody is watching, Praci stops and asks you first.

**Background runs are read-only.** A background run is any run you did not start in a chat: a routine, a watch, a webhook, an incoming message, or work handed on from one of those. In a background run a bot can read, search and save notes, pages and files inside Praci, and it can run a [tool](/docs/bots-and-agents#tools) you approved. Anything that sends, changes or runs something shows an approval card and waits for you. That includes sending mail, changing calendar events, writing in a connected app, editing files, running commands, using the browser or the desktop, and using a saved credential for anything other than a read. If a background run needs you to sign in or enter a secret, it stops and sends you a notification.

**Outside content makes a run stricter.** If a run starts from something that came from outside Praci, such as a webhook, an incoming message or a change on a page a watch checks, it asks before almost everything, including reading the web or searching it, and reading your Data room or company data. Otherwise, a page or message could tell the bot to carry your private data out. Only actions that stay inside Praci or only tell you something run without a card, such as saving a note, sending you a notification, or running an approved tool. Runs that this run starts, such as a handoff to another bot, stay this strict, and answering a card does not lift it.

**In a chat you are in, you set the rule for each kind of action.** Sending mail and spending money start at **Ask**.

The card names what the bot wants to do. You can answer **Allow once** or **Deny**. When the card is there because the run was in the background, it says **Asked because this ran in the background.**, and it has no **Always allow this tool** button. Some cards in a chat you are in offer that button, which stops the questions for that tool. For email, you see the whole message and choose **Send it** or **Edit first**.

![An approval card from a background run, with the line Asked because this ran in the background.](/docs/background-approval.webp)

*Demo data.*

A run that is waiting for your answer shows as **Needs approval** in **Activity**.

![Activity with a Chief run marked Needs approval](/docs/activity-needs-approval.webp)

*Demo data.*

![The Approvals table in Settings](/docs/approvals-table.webp)

*Demo data.*

Set the rule for each kind of action in **Settings, Privacy and approvals**. The **Approvals** table has one row for each kind of action, and each row is **Allow**, **Ask** or **Block**:

- **Allow** runs the action without asking, in a chat you are in.
- **Ask** shows a card every time.
- **Block** refuses the action. The bot is told your settings block it, and it does not try again or look for another way.

![Chief reports that an email was blocked by the approval settings and not sent](/docs/approval-blocked.webp)

*Demo data.*

A background run asks even when a row says **Allow**, and a row set to **Block** blocks background runs too. Some actions, such as sending an iMessage, always ask and cannot be set to **Allow**.

To change one bot, open its settings and use **Approvals**. Each row starts at **Same as all bots**. Choose another value to override the table for that bot only.

Details are in [Bots and agents](/docs/bots-and-agents#approvals) and [Settings](/docs/settings#privacy-and-approvals).

A task you taught by demonstration follows the same rules. A routine that runs it asks before it uses the computer, and a password you typed while teaching is never stored. See [Teach a task](/docs/teach-a-task).

Money pages are read-only. [Finance](/docs/finance) and the [Cap table](/docs/cap-table) read from Mercury, Brex and Carta. Their agents are not given tools to pay, transfer, change cards or edit your cap table.

## Your models and keys

You choose the AI service, and you can change it. Praci takes a ChatGPT or OpenRouter sign-in, a provider API key, or the address of a model server you run. Keys are encrypted at rest with a key that only your server holds. Nothing in Praci requires one hosted vendor.

## What leaves your machine

Whatever you chat about, and the content bots read to do their work, goes to the AI service you chose, so that service can answer. Two background features read more, so each asks for your consent first and names the service that receives the data:

- **Inbox sorting** reads sender, recipients, subject and a short preview of each message.
- **Data room and Legal** read the text, and for images and scans the page images, of your documents.

Each switch is under **Settings, Privacy and approvals, AI data sharing**, and a change of model asks you again.

To keep everything on your own hardware, run a local model server such as Ollama, use local disk or MinIO for files, and self-host. Google services (Gmail, Drive) and any app you connect still talk to their own providers.

## Your data

Your data lives in your own Postgres database when you self-host. You can [export it or back it up](/docs/backups-and-export), and you can disconnect any app at any time. Disconnecting removes Praci's access and the mail it cached from that account. It does not delete your data inside the app.

## Reporting a problem

Praci is in beta. Report security problems through [GitHub private vulnerability reporting](https://github.com/dennisonbertram/praci/security/advisories/new), not in a public issue.
