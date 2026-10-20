---
title: Connect apps
description: Give your bots access to Gmail, your bank, Carta and other tools, one app at a time.
group: Agents and apps
order: 21
---

Bots can only see and use the apps you connect. Open **Connect apps** in the sidebar to see what is connected and to add more.

![The Praci Integrations page with connected apps and popular apps to add](/docs/integrations.webp)

*Demo data.*

## Connecting an app

1. Find the app, or search for it, and press **Connect**.
2. Sign in to the app in a new window, or paste a key if the app uses one.
3. Choose which bots may use it. You can change this later on the app's page.

Each connected app lists the bots that use it. **Disconnect** removes the account and the bots' access. Mail that Praci cached from a disconnected Gmail account is removed. Your data inside the app is not deleted.

## How apps connect

- **App catalog.** Gmail, Google Calendar, Google Drive, Slack, Notion, GitHub, Linear and many more connect through Composio or Pipedream Connect. The server owner sets up the catalog with the provider's key. If a server has not set one up, the page says so.
- **Your own Google client.** On a self-hosted server you can connect Gmail with your own Google OAuth client instead.
- **Finance and cap table.** Mercury, Brex and Carta connect over their own sign-in. Coinbase, Blockscout and Alchemy add crypto balances. These are read-only.
- **Custom tools.** Remote MCP servers and OpenAPI tools can be added as custom connections, and Treg tool sources can be installed.

## What bots may do with an app

Reading is allowed once an app is connected to a bot. Writing, such as sending a message, creating an event or changing a record, asks you first unless you chose **Always allow**. See [Bots and agents](/docs/bots-and-agents#approvals).
