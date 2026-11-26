---
title: Teach a task
description: Show a bot a job once on its computer, save it as a skill, and run it again on a schedule.
group: Agents and apps
order: 23
---

Some jobs are easier to show than to describe. You can do the job once on a bot's computer while Praci records it. Praci turns the recording into a skill with plain steps, and the bot can repeat it later, including from a [routine](/docs/routines).

## Start teaching

Open the bot's chat, choose **Computer and routines** at the top, and choose **Open** on the computer. In the computer view, choose **Teach a task**. Describe the result you will show, for example "Sign in to the test site", and choose **Start recording**.

## While it records

A bar at the top of the computer view shows what you are recording, how much time is left, and three controls:

- **Stop teaching** ends the recording and makes a draft skill.
- **Cancel** ends the recording and keeps nothing. If you have been recording for more than a minute, it asks first.
- **Protected input** is a field for passwords. Type there and press the arrow button, **Type without recording**. The text goes to the screen as if you had typed it, and it is never saved.

A recording lasts 10 minutes. The bot only watches while you teach. It does not act. If you close the computer view, the chat shows **Teaching in progress** with **Stop teaching** and **Cancel**.

![The recording bar above a login page, with 9:56 left, Protected input, Stop teaching and Cancel](/docs/teach-recording-bar.webp)

*Demo data.*

### What is recorded

- Clicks, key presses and pasted text.
- Switches between apps and windows.
- Commands you type in the Terminal.
- Files you upload in the Files window. Praci keeps the file name, not the content.

Anything you type into a password field is never stored. It is not kept in the recording, in the steps, or in what the AI model sees. Praci checks which field has focus in the browser to tell.

### Known limits

- Click steps can show screen positions, such as **Click at (390, 437).**, instead of a description. Edit the step in the review card if you want to make it clearer.
- Praci can only tell that a field is a password field inside the browser. A password typed in another desktop app, outside a window that looks like a sign-in, can be recorded as ordinary typing. Use **Protected input** for passwords there.
- Praci does not see files an app writes on its own, apps started from the dock, or anything inside a page.

## Review the draft

When you choose **Stop teaching**, a **Draft skill** card appears in the chat. It shows:

- **Name.** Change it if you like.
- **Steps.** One per line. You can edit them.
- **More.** Opens **When to use**, **Inputs**, **How to check**, **What to return**, **Approval boundaries** and **Failure handling**.

At the bottom are **Save**, **Test**, **Add to routine** and **Discard**. **Add to routine** is off until you save.

![A Draft skill card with steps and a Step 5 row offering Save as login and Skip](/docs/teach-review-card.webp)

*Demo data.*

### Save as login

If you typed a password, the card has a row for that step, such as **Step 5: Type "[redacted input]".** with two choices:

- **Save as login.** Enter the **Site**, a **Name** and the **Username**, then choose **Save login**. Praci saves a website login under the bot's [Credentials](/docs/credentials). The password you typed is held only until you save or skip, for at most 30 minutes, and then it is gone from the recording.
- **Skip.** The step stays as "Ask the user to sign in".

The form suggests a name from the site and fills in the text you typed just before the password as the username. Check both. **Save login** stays off until the site, name and username are filled in.

![The Save as login form with Site, Name and Username, and Save login](/docs/teach-save-login.webp)

*Demo data.*

After you save the login, the sign-in steps read **Fill saved login** followed by the credential name and the field, for example **Fill saved login the-internet_herokuapp_com into Password.** When the skill runs, Praci types the saved value into the page only while the page is on the saved site. The bot never sees it.

If you skip, or if you later remove the saved login, a run that reaches that step stops and sends you a notification.

![The steps after saving the login, with Fill saved login steps for Username and Password](/docs/teach-steps-saved.webp)

*Demo data.*

## Test it

Choose **Test** to have the bot follow the steps now on its computer. The card shows **Testing…** while it runs, and then the result next to the buttons: **Worked** in green, or **Stopped:** with the reason in red, such as **Stopped at step 6: login was rejected.** Fix the step or the login and test again.

![A skill card that shows Stopped at step 6: login was rejected.](/docs/teach-test-result.webp)

*Demo data.*

Choose **Save** to keep the skill. The button then reads **Saved**.

## Find taught skills again

Open the bot's settings and look in **Skills**. Skills you taught are in a **Taught** group with the last run, such as **Last run just now**, or **Not run yet**. Choose a row to open its card. Use the **…** menu on the row and choose **Delete** to remove it. Routines that use a deleted skill stop using it.

![The Taught group in a bot's Skills, with a saved login under Credentials](/docs/teach-taught-group.webp)

*Demo data.*

## Run it on a schedule

Choose **Add to routine** on a saved skill. The routine editor opens with the skill selected and shows **Runs taught skill:** and its name. The routine keeps a reference to the skill, so if you edit the skill later, the routine uses the new steps. The **Instruction** is optional. You can add details for this run.

To add a taught skill to an existing routine, use **Add a skill** in the editor. Taught skills are listed under **Taught**. Choose the **x** on the chip to remove it.

![The routine editor with the chip Runs taught skill: Sign in to the test site](/docs/teach-routine-taught-skill.webp)

*Demo data.*

### Background runs ask first

A routine is a background run, so the bot asks before it uses the computer, even for a skill you taught. The card says **Asked because this ran in the background.** Choose **Allow once** or **Deny**. There is no **Always allow this tool** button on these cards. If you choose **Deny**, the run stops and the bot says which step it stopped at, for example **Result: stopped at step 1: you declined the action**.

![An approval card for a taught skill run by a routine, with the line Asked because this ran in the background.](/docs/teach-background-run.webp)

*Demo data.*

A run that waits for your answer shows as **Needs approval** in **Activity**. See [Privacy and safety](/docs/privacy-and-safety) and [Routines](/docs/routines).

You teach a task in the web or desktop app. The phone app has no way to record one.
