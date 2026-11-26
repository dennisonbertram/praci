---
title: Routines
description: Run a prompt on a schedule or when a web page changes. Routines can stay quiet until something needs you, and they only read in the background.
group: Agents and apps
order: 19
---

A routine is a prompt that a [bot](/docs/bots-and-agents) runs without you. You write the instruction once and choose when it runs: on a schedule, when a web page changes, or when another app sends an event.

Open a bot's chat and choose **Computer and routines** at the top. The **Routines** list shows every routine for that bot. Choose **Create a routine** to add one, or choose a routine to edit it.

A routine has a **Name**, an **Instruction**, and a **When to run** setting. Choose **Test run** to run it once now, and open **Run history** to see what each run did.

![The routine editor with a Watch a page card and the Only message me switch turned on](/docs/routine-watch-editor.webp)

*Demo data.*

## Schedules

Under **Choose when it runs**, pick a preset such as **Every hour**, **Every day**, **Weekdays** or **Every week**, or pick **Interval** or **Advanced...** for your own schedule. The editor shows the time zone the schedule uses.

## Watch a page

A watch checks a web page and runs the bot only when the page changes. Choose **Choose when it runs**, then **Watch a page**. The card has two fields:

- **Page address.** The address of the page, starting with `http://` or `https://`.
- **Check every.** **Every 15 minutes**, **Every hour** or **Every day**. A new watch starts at **Every hour**.

Write what the bot should do about a change in the **Instruction**, for example "Tell me what changed and whether it affects our plans."

How a watch works:

- The first check only records the page as it is now. Nothing runs and nothing is sent.
- Each later check compares the page text with the last version. If it is the same, nothing happens and no run is created.
- If the text changed, the bot runs once. It gets the old and new text, and the instruction tells it what to do.
- A change in the middle of a run waits for the next run, so a watch never starts two runs at once.

Praci keeps limits so that a watch cannot send you an endless stream of messages:

- A watch checks at most every 15 minutes.
- A watch wakes the bot at most 6 times a day. Changes after that wait for the next day.
- A bot can have 5 watches, and a space can have 20. All the watches in a space together wake a bot at most 50 times a day.
- A watch pauses if the page cannot be checked 5 times in a row. After each failed check it waits longer before trying again.
- A watch pauses if the page changed on 8 of its last 10 checks, because a page like that is probably a counter or a clock.
- When a watch pauses, you get one notification.

To start a paused watch again, turn **Active** off and on, or change its address. Turning **Active** back on checks the page again right away and keeps the saved version. Changing the page address starts over with a new first check.

A watch runs as a background run. It reads the page text, and anything else that sends or changes something asks first. See [Privacy and safety](/docs/privacy-and-safety).

Routines can also start from a Git event, a webhook or a Slack message. These are under **From another app (advanced)**.

## Set up a watch from chat

You do not have to open the editor. Tell a bot "Tell me if https://example.com changes." and it proposes a watch. A card shows what it will set up, for example **Checks example.com every hour and tells you only when it changes**. Choose **Allow once** to create the watch, or **Deny**. **Details** shows the instruction the watch will use.

![Chief proposes a watch on example.com and asks before creating it](/docs/watch-create-card.webp)

*Demo data.*

The bot can also list, change and delete the watches and schedules it created. Only a run you started can create watches and schedules. A routine, a watch or another background run cannot.

## Only message me if something needs me

The editor has one switch, **Only message me if something needs me**. When it is on, a run that finds nothing worth your attention ends without a message. When it is off, the routine posts what it did every time it runs.

The switch is on by default for a watch. It is off for older routines, so they work as before.

A silent run is still recorded. In **Run history** it reads **Nothing to report**. In **Activity** it appears dimmed, and it is not counted as a finished run.

![The Activity list with a dimmed Nothing to report row, and Run history in the routine editor](/docs/activity-nothing-to-report.webp)

*Demo data.*

## The status line

Each routine in the list has a second line of small grey text that shows how it is doing:

- **A watch** shows when it last checked and when the page last changed, for example **Checked 4 min ago · Changed yesterday**. Until the page changes, only the check time shows.
- **A schedule** shows when it last ran and when it runs next, for example **Last ran 8:00 AM · Next Mon 8:00 AM**.
- **A paused watch** shows why it paused: **Paused: the page could not be checked** or **Paused: the page changes too often**.

![The Routines list with a schedule, an active watch and a paused watch, each with a status line](/docs/routines-list.webp)

*Demo data.*

## Messages from a routine

When a routine posts a message in the bot's chat, a small line above it says **From routine:** and the routine's name, so you can tell it apart from a reply to you.

![A message in Chief's chat with the line From routine: Pricing page watch above it](/docs/routine-message.webp)

*Demo data.*

## Routines only read

A routine runs in the background, so it is read-only. It can read and search, save notes inside Praci and run [tools](/docs/bots-and-agents#tools) you approved. Sending mail, editing files, running commands and other changes show an approval card that waits for you. The card says **Asked because this ran in the background.** A run that a watch or a webhook starts is stricter: it also asks before it reads the web or your documents, because the page or message that started it came from outside. Details are in [Privacy and safety](/docs/privacy-and-safety#bots-ask-before-they-send-change-or-run-anything). A routine can also run a skill you [taught by demonstration](/docs/teach-a-task#run-it-on-a-schedule).

On a phone, a routine shows the same status line and the **Active** switch. Watches are set up in the web or desktop app, or by asking a bot in chat.

For a bot that checks in on its own every day, see [Check-ins and open work](/docs/check-ins).
