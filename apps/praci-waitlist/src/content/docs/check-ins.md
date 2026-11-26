---
title: Check-ins and open work
description: Let a bot check in once a day, keep a list of what it is waiting on, and get told when something is past due.
group: Agents and apps
order: 20
---

A bot can keep track of work that is still open and tell you when something needs you. This page covers three parts: the **Check in** setting, the **Open work** list, and the past-due notification.

![Chief's settings with Check in set to Daily and an Open work list with a waiting item, a late due date and a Done list](/docs/check-in-open-work.webp)

*Demo data.*

## Check in

On a phone, the **Check in** setting is in the bot's settings too.

Open a bot's settings and find **Check in**, next to **Notifications**. Choose one of:

- **Off.** The bot does not check in. This is the default.
- **Daily.** The bot checks in at 9:00 AM in your time zone.
- **Every 4 hours.** The bot checks in every 4 hours.

A check-in is a [routine](/docs/routines) that Praci manages for you. It appears in the bot's **Routines** list as **Daily check-in** or **Check-in every 4 hours**. You can turn it on or off there with the **Active** switch, but you cannot edit it.

Each check-in does the following:

- It reviews the bot's open work and what happened since the last check-in.
- If nothing needs you, it ends without a message.
- If something does, it posts one message that starts with the thing that needs you most, followed by anything else.
- A bot posts at most one check-in message a day, even on **Every 4 hours**.
- It only reads. If something needs doing, it tells you in the message instead of doing it, and it never raises an approval card.

## Open work

**Open work** is the bot's list of things it is working on or waiting for. It sits in the bot's settings, below **Check in**.

Each item can have:

- A **waiting on** line, for example **Waiting on Bolt Freight legal**.
- A due date, for example **due Thu**. When the date has passed, it shows in red.

The bot fills these in as it works. To change one, tell the bot in chat. You can also type a title under **Add item**, tick an item to finish it, choose **Park** to set it aside, or choose the **x** to remove it.

Finished items move to **Done**. Open it to see them with the reason the bot gave. Choose **Reopen** to put an item back in the list. When you tick an item, a message appears with **Undo**.

## Past-due notification

When an open item is past its due date, you get one notification for that bot, for example **Chief: 1 item is past due**. A bot sends at most one of these a day, counted in your time zone, and it lists all of that bot's late items in one notification. It is sent even when **Check in** is **Off**.
