---
title: Inbox
description: One list for all your Gmail accounts, with the mail that needs a reply sorted to the top.
group: Your company
order: 10
---

The Inbox shows recent mail from every Gmail account you connect, in one list. Connect an account under [Connect apps](/docs/integrations); until then the page shows **Connect mail**.

![The Praci Inbox with mail grouped by day and a prompt to let Praci sort your mail](/docs/inbox.webp)

*Demo data.*

## What you can do

- **Read and search.** Search runs against Gmail, so Gmail search words work, for example `from:sam has:attachment`. Tabs for each account, and Gmail-style tabs such as Important, Updates and Newsletters, narrow the list.
- **Triage mail.** Archive, mark read or unread, mark as spam or move to trash, one message at a time or several at once. Archive and the other actions show an **Undo**.
- **Compose and reply.** The compose button opens a new message.
- **Clean up senders.** **Cleanup** lists senders. Tick some and archive their mail, unsubscribe, or skip your inbox for them from now on.
- **Ask the Inbox agent.** **Ask** opens the Inbox agent next to the list. It can search your whole mail history, not only recent mail, and summarize or find messages.

## Sorting your mail

When you first open the Inbox, Praci asks whether it may sort your mail. If you click **Allow**, a background job reads the sender, recipients, subject and a short preview of each message, groups it (bills, receipts, newsletters and so on), lists what **Needs reply**, and fills a short **To do** list. This sends those fields to the AI service you chose in Settings, and the prompt names that service. If you click **Not now**, the Inbox still works as a mail list; the sorting views stay off.

Sorting itself does not change anything in Gmail. Only actions you choose, such as archive, spam, trash or Cleanup, do.

## Sending mail

Bots never send mail on their own. When the Inbox agent or another bot drafts a message, you see the message and choose **Send it** or **Edit first**. See [Privacy and safety](/docs/privacy-and-safety).

## How it works

Praci keeps a copy of message details (sender, recipients, subject, date, preview) in your own database so the list opens quickly, and refreshes it in the background. Disconnecting an account removes the cached mail from that account. Your mail in Gmail is not deleted.

<!-- TBD, left out until checked on a live account: Gmail push notifications (needs Google Cloud Pub/Sub on the server), automatic Gmail filters, and the mobile Inbox. -->
