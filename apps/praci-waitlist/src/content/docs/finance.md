---
title: Finance
description: Cash, burn and runway from your bank and card accounts, read-only.
group: Your company
order: 11
---

The Finance page answers three questions: how much cash you have, how fast you spend it, and how long it lasts.

![The Praci Finance page](/docs/finance.webp)

*Demo data.*

## Connect your accounts

Connect **Mercury** or **Brex** from the Finance page or from [Connect apps](/docs/integrations). You sign in to the bank's own page, and Praci keeps the access it is given. For crypto, you can add wallet balances through **Blockscout** (no key needed), **Coinbase** (a read key) or **Alchemy**.

Finance is read-only. Praci reads balances and transactions. It does not move money, pay bills, change cards or edit transactions, and the Finance agent is not given those tools.

## What you see

- **Cash.** Your bank accounts added together. A Brex card balance you owe is shown separately and is not counted as cash.
- **Monthly burn.** The average of the last three full months of money out minus revenue. Moves between your own accounts and money raised are left out.
- **Runway.** Cash divided by monthly burn, with the month it runs out.
- **Spend over time.** A chart and a breakdown by category or vendor, for a week, month, quarter or year. Each line opens a detail page down to single transactions.
- **Upcoming 30 days.** Recurring charges (the same vendor, at least three charges, a regular interval) plus pending transactions and bills that are due.

Praci stores a copy of your transactions in your own database. It refreshes the copy when you open the page, no more than once every 15 minutes, and the refresh button next to "Updated" forces a refresh. If an account is in another currency, the page tells you it was not counted.

The eye icon hides money amounts on the page, which helps on a shared screen.

## Ask the Finance agent

**Ask** opens the Finance agent. It reads your synced numbers and can answer things like "How long is our runway if we hire two engineers?" or "Which subscriptions overlap?" It comes with built-in skills for cost cutting, runway scenarios, a monthly review, and suggesting categories for uncategorized transactions. It only suggests; it does not change categories.
