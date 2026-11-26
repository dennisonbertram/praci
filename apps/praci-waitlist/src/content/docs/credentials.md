---
title: Credentials
description: Save a key, password or login for a bot to use without seeing it, and see when it was last used.
group: Agents and apps
order: 22
---

A credential lets one bot use a key, password or login. You save the value once. The bot uses it by name, and the value is encrypted and never shown to the AI model or in the chat.

## Add a credential

Open a bot's settings and find **Credentials**. Choose **Add credential**, then fill in:

- **Name.** Lowercase letters, numbers, hyphens and underscores, starting with a letter.
- **Site.** The address the credential is for, starting with `https://`. The bot can only use the credential on this site.
- **Type.** **Bearer token**, **Custom header**, **Basic auth**, **Website login** or **Command variable**.
- **Value.** The key or password.

**Save credential** stays off until the form is complete, and the line under the form says what is missing. You can also ask a bot to save one. It shows a card where you enter the value, and the card names the site first.

![A bot's Credentials section with three saved credentials](/docs/credentials.webp)

*Demo data.*

You can also save a login while you [teach a task](/docs/teach-a-task#save-as-login). The password you typed is not kept, and the steps use the saved login instead.

## How a bot uses it

For a key or token, the bot asks Praci to make the request. Praci adds the value to the request and returns only the response. For a website login, the bot fills the sign-in form in its browser, and Praci types the username and password only while the page is still on the saved site.

In a background run, a bot can make a read request to the saved site without asking. Any other request asks you first. See [Privacy and safety](/docs/privacy-and-safety).

## Last used and Needs attention

Each saved credential shows when a bot last used it, such as **Used 2d ago**, or **Not used yet**.

If the saved site rejects a credential, the row shows **Needs attention** and you get a notification. Choose **Replace value** to enter a new one. The mark clears when you replace the value or the credential works again.

## Command variables

A command variable is a value the bot's own terminal can use, such as a setup key for a command-line tool. Pick the type **Command variable**. It has no site. The bot gets it as an environment variable named after the credential: `setup-key` becomes `$SETUP_KEY`.

**The bot can read this value.** Praci hides it from command output, but the commands the bot runs can print or send it. Save only values you would let that bot use on its own.

![Adding a command variable, with the note that the bot can read this value](/docs/command-variable.webp)

*Demo data.*

## Replace or remove

**Replace value** swaps in a new value for the same site. **Remove** deletes the value immediately and the bot can no longer use it. To change a credential's site or type, remove it and add it again.

Credentials are managed in the web app and the desktop app. On a phone, a bot can still ask you for a value in the chat.

Technical details are in the repository's `docs/bot-secrets.md`.
