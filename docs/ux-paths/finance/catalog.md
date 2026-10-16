# UX Path Catalog: Rakazo — Finance

Generated: 2026-10-16
Source: `/Users/dennison/develop/rakazo-ux` (branch `docs/ux-pass`), read-only.
Scope: `/app/finance/*` (dashboard and detail pages), the Add account dialog, statement upload,
crypto wallets and exchanges, finance tiles on `/app/integrations?category=finance`, the Finance
agent side panel, finance cards in chat, and agent pins and checklists.
Total stories: 23 (short 10, medium 9, long 4)

## Persona (applies to every story)

A first-time user. They are a startup founder who has never seen Rakazo or its code. They do not
know its terms ("burn", "runway scope", "MCP", "Blockscout", "pins"). They want to run their
company clearly and consistently: know how much money they have, what they spend it on, and when it
runs out. Steps are written in their words. **Hesitation** marks a place where a first-timer is
likely to stop, misread a label, or pick the wrong control.

## Demo account (shared preconditions)

The walk runs against a seeded mock demo account. Every visible company, vendor, and person name
must be clearly fake. The baseline seed is called **NW-BASE**:

- Space or company name: `MOCK DEMO DATA — Northwind Robotics`. The signed-in user is the founder
  (for example `Mock Founder`).
- Mercury source with status `ok`, synced within the last 15 minutes. It has:
  - `MOCK Checking ••4821` with about $412,000.
  - `MOCK Treasury ••7730` with about $1,150,000, and Treasury yield rows for the last 6 months
    (dividends, fee, net), so the "Treasury yield" card and the account's Yield table appear.
  - `MOCK Savings ••1190` with about $60,000.
- Brex source with status `ok`. It has the card `MOCK Brex Card ••0001` with about $38,500 owed.
- At least 7 months of transactions, so the 3-month average burn, the Burn chart and the By month
  table have data. Include:
  - Monthly payroll (`MOCK Gusto Payroll`, about $140k/mo, category "Payroll").
  - Rent (`MOCK WeWork`, monthly).
  - SaaS subscriptions with clear monthly cadence: `MOCK AWS`, `MOCK GitHub`, `MOCK Figma`,
    `MOCK Slack`, `MOCK Notion`. Make two of them fall in the same overlap group (for example two
    chat or two docs tools) so the "overlaps" pill shows.
  - At least one vendor with 6+ months of charges and a receipt on the Brex charge (`hasReceipt`).
  - At least one Mercury spend transaction without a known receipt, so "Check for receipt" shows.
  - At least one pending transaction dated in the next 30 days, so Upcoming shows a `pending` row.
  - At least one `bill` item in Upcoming (Brex bill).
  - Revenue deposits (`MOCK Customer — Acme Mock Co`) in some months, and one financing deposit
    (`MOCK Seed Extension`) in one month, so Revenue and Financing bars show.
  - A transfer between the founder's own accounts (Checking to Treasury) and a Brex card payment
    from Checking. These must not count as spend.
  - At least 8 categories, so the Breakdown card shows "Show all N".
- At least one transaction in a non-USD currency, so "1 non-USD not counted" shows in the header.
- Finance agent: **not created yet** in NW-BASE, so the first "Ask agent" creates it.

Extra seeds named in story preconditions:

- **NW-CRYPTO**: NW-BASE plus a Blockscout PRO API key saved; one wallet
  `MOCK Treasury Safe` (type Safe, 2 of 3 owners) on Ethereum holding USDC and ETH; one wallet
  `mock-ops.eth` (type Personal) holding one unpriced token; a Coinbase exchange connection with
  USD, BTC and USDC balances; 90 days of crypto history. The runway scope is `bank`.
- **NW-STATEMENT**: NW-BASE plus one account created from an uploaded statement
  (`MOCK First Mock Bank ••5502`) whose next statement is due, so the reminder banner shows.
  Test files are needed: `mock-firstbank-2026-09.csv` (balances match),
  `mock-firstbank-2026-08.pdf` (balances off by $12.40), `notes.docx` (wrong type), and one file
  over the size limit.
- **NW-EMPTY**: a fresh `MOCK DEMO DATA — Northwind Robotics` space with no finance sources, no
  statement accounts, no wallets and no exchanges.
- **NW-RECONNECT**: NW-BASE with the Mercury source set to `needs_reconnect`.
- **NW-AGENT**: NW-BASE plus an existing Finance agent whose thread holds one earlier turn with 3
  finance tool reads (overview, breakdown by vendor, subscriptions), so a collapsed
  "3 finance lookups" group shows. The agent also has pins: two stat pins
  ("Cash", "Runway") and one checklist ("Month-end close") with 3 items, one of them done.

## Summary

| Type | Count |
|------|-------|
| Short | 10 |
| Medium | 9 |
| Long | 4 |

## Coverage Matrix

| Feature area | Stories | Gaps |
|---|---|---|
| Dashboard: Cash, Monthly burn, Runway, Spend KPIs, refresh | 001, 002, 003, 019 | — |
| Burn page, month page | 004, 005, 019 | — |
| Runway page, crypto scope | 006, 015, 020 | No "what if" scenario in the UI; only the agent can model one |
| Spend page, period tabs, category chips, chart-bar ranges | 007, 008 | No search, no export |
| Breakdown by category or vendor, category and vendor pages | 008, 009 | — |
| Subscriptions, Upcoming, recurring page | 010, 011 | No cancel, rename or "not a subscription" control |
| Transactions and receipts | 012, 013 | No way to recategorize or add notes |
| Accounts list, source filter, account detail, cards owed | 014, 019 | Account detail shows only the newest 20 transactions |
| Crypto: wallets, exchanges, Blockscout, Alchemy | 015, 016, 020 | — |
| Statement upload, reminders, removal | 017, 018, 021 | No list of past statements after the dialog closes |
| Connecting Mercury and Brex, reconnecting | 001, 019, 022 | No disconnect in Finance |
| Finance agent panel, finance cards, Ask about this | 020, 022, 021 | — |
| Pins and checklists | 022 | Hidden in the Finance side panel |
| Errors, empty states, not found | 001, 013, 018, 023 | — |

## Story Dependency Graph

```text
NW-EMPTY
└── STORY-001 (first visit, connect Mercury)
    └── STORY-019 (long: first morning with Finance)

NW-BASE
├── STORY-002 (how much cash)
├── STORY-003 (refresh)
├── STORY-004 → STORY-005 (burn → month)
├── STORY-006 (runway)
├── STORY-007 → STORY-008 → STORY-009 (spend → category → vendor)
├── STORY-010 → STORY-011 (subscriptions → upcoming)
├── STORY-012 → STORY-013 (transaction → receipt)
├── STORY-014 (accounts, card owed)
└── STORY-023 (wrong links, not found)

NW-CRYPTO
├── STORY-015 (count crypto in runway)
├── STORY-016 (add, edit, remove wallet and exchange)
└── STORY-020 (long: investor update with crypto)

NW-STATEMENT
├── STORY-017 (reminder → upload)
├── STORY-018 (bad files)
└── STORY-021 (long: bank without an integration)

NW-RECONNECT + NW-AGENT
└── STORY-022 (long: monthly review with the agent, pins, reconnect)
```

## All Stories

### First visit and connecting

## STORY-001: Open Finance for the first time and connect the bank

**Type**: medium
**Topic**: Connecting
**Persona**: Naive first-time founder
**Goal**: "I bank with Mercury. I want this app to show my cash."
**Preconditions**: NW-EMPTY. A Mercury OAuth sandbox or stub that completes sign-in for a mock
Mercury org with NW-BASE accounts.
**Ideal path**: 3 — click Finance, click Mercury, approve the sign-in popup.
**Alternate paths**: (a) Integrations page `/app/integrations?category=finance` → Mercury tile
"Connect" (`FinanceSection.tsx:395-404`); (b) Accounts page "Add account" (only reachable later).

### Steps
1. Click **Finance** in the left sidebar → `/app/finance` shows the Mercury and Brex logos, the
   heading "Finance", the line "Add an account to see cash, burn, runway and spend." and one
   button, **Add account**.
   - Hesitation: only bank logos are shown. A founder who also holds crypto or uses another bank
     does not know those are supported until the dialog opens.
2. Click **Add account** → dialog "Add account" with a **Bank** section (Mercury "Read balances
   and transactions", Brex "Read cards, expenses and bills", "Upload statements" "PDF, CSV, OFX or
   QFX") and a **Crypto** section (Wallet "Address or ENS", Coinbase, Kraken "Read-only API key").
3. Click **Mercury** → a sign-in popup opens. The Mercury card is disabled while it waits.
4. Approve access in the popup → the popup closes, the dialog closes, and the dashboard reloads.
5. Watch the header → "Syncing…" with a spinning refresh icon, and skeleton cards until the first
   sync finishes.
6. After the sync → KPI cards "Cash", "Monthly burn", "Runway", "Spend this month" show values,
   and a green-dot "Mercury" chip shows next to the title. Because Brex is the only source still
   missing, a small link **Add Brex** shows.

### Variations
- Close the popup without approving → the dialog stays open with "Sign-in was cancelled or did
  not finish. Try again."
- Connect from Integrations instead → the tile changes to "Connected" with **Open Finance**.

### Edge Cases
- The first sync fails → a red notice with a retry control shows above the cards.
- **Add Brex** goes to Integrations, not to the Add account dialog where Mercury was connected.
  The founder connects two banks in two different places.

---

## STORY-002: "How much cash do we have right now?"

**Type**: short
**Topic**: Dashboard
**Persona**: Naive first-time founder
**Goal**: Read one trustworthy cash number and see what makes it up.
**Preconditions**: NW-BASE.
**Ideal path**: 1 — open Finance and read the Cash card.
**Alternate paths**: Accounts page "Total cash" KPI (`FinanceAccounts.tsx:239`); Runway page
"Cash" KPI (`FinanceBurn.tsx:249`); Finance agent overview card "Cash" (`FinanceCards.tsx:120`).

### Steps
1. Open **Finance** → the **Cash** card shows about $1,622,000 with the subtitle
   "Checking + Treasury".
   - Hesitation: the subtitle leaves out Savings, but Savings is counted. The Accounts page says
     "Checking + Savings + Treasury" for the same number.
2. Notice the Brex card balance is not part of the number → no hint on the dashboard says card
   debt is excluded.
3. Click the **Cash** card → `/app/finance/accounts` shows "Total cash", "Card balance owed
   $38,500 — Not counted in cash", a "Total balance" chart, and the list of cash accounts.

### Variations
- Mobile width → the KPIs wrap into a 2-column grid.

### Edge Cases
- "1 non-USD not counted" shows in the header with no link or explanation of which transaction.

---

## STORY-003: Make sure the numbers are current

**Type**: short
**Topic**: Dashboard
**Persona**: Naive first-time founder
**Goal**: "I just paid a contractor. Is that in here yet?"
**Preconditions**: NW-BASE, last sync about 2 hours ago (shows "Updated 2 hours ago").
**Ideal path**: 1 — click refresh.
**Alternate paths**: none found (opening Finance also triggers one sync per visit,
`Finance.tsx:140-144`).

### Steps
1. Read the header → "Updated 2 hours ago" next to a small refresh icon with no text label.
   - Hesitation: the icon is tiny and only has an aria-label "Refresh".
2. Click the refresh icon → it spins and the text changes to "Syncing…".
3. Wait → the text changes to "Updated just now" (or similar) and the numbers reload.

### Edge Cases
- Sync service unavailable → red "Finance sync is not available" notice with retry.

---

### Burn and runway

## STORY-004: "What is our burn?"

**Type**: medium
**Topic**: Burn
**Persona**: Naive first-time founder
**Goal**: Understand monthly burn and where it goes.
**Preconditions**: NW-BASE.
**Ideal path**: 2 — click Monthly burn, read the Burn page.
**Alternate paths**: dashboard "Burn ›" section title (`Finance.tsx:487`); Runway page "Monthly
burn" KPI (`FinanceBurn.tsx:250-254`).

### Steps
1. On the dashboard, read **Monthly burn** → about $205,000 with "3-mo avg".
   - Hesitation: a founder may expect gross spend this month; "3-mo avg" is the only hint.
2. Look at the **Burn** chart → dark "Out", grey "Revenue", and striped "Financing" bars by day
   (Month tab is selected). The last bar has an asterisk and "* So far".
3. Click **Monthly burn** → `/app/finance/burn` shows the KPI, a monthly bar chart, "Where it
   went" (a stacked bar and category rows with swatches), "By account" with percent shares, and
   "By month" (Month, Out, In, Net).
4. Read the **By month** table → Net is red when negative, green when positive. The financing
   month shows a large positive Net.
   - Hesitation: "Net" mixes revenue and financing, while the KPI above excludes them. The
     founder may not understand why the burn KPI and the Net column disagree.

### Variations
- Choose **Year** on the dashboard period tabs → the dashboard Burn chart changes to monthly bars;
  clicking one opens the month page.

---

## STORY-005: Drill into one month

**Type**: short
**Topic**: Burn
**Persona**: Naive first-time founder
**Goal**: "Why was August so expensive?"
**Preconditions**: NW-BASE with a large one-off August charge (`MOCK Hardware Supplier`, $48,000).
**Ideal path**: 2 — open Burn, click August.
**Alternate paths**: dashboard Year tab → click the August bar (`Finance.tsx:510-516`);
Burn page chart bar (`FinanceBurn.tsx:71`).

### Steps
1. On `/app/finance/burn`, click **August 2026** in By month → `/app/finance/month/2026-08` shows
   "Out", "In", "Net" KPIs, a Categories list, and Transactions.
2. Find `MOCK Hardware Supplier` → it is at or near the top of Transactions.
3. Click **← Burn** (back button) → returns to the Burn page.

### Edge Cases
- `/app/finance/month/2026-8` (no leading zero) → "Not found" page.

---

## STORY-006: "When do we run out of money?"

**Type**: short
**Topic**: Runway
**Persona**: Naive first-time founder
**Goal**: Know the runway in months and the date.
**Preconditions**: NW-BASE.
**Ideal path**: 1 — read the Runway card.
**Alternate paths**: Runway page (`FinanceBurn.tsx:228`); Finance agent overview card
(`FinanceCards.tsx:122`).

### Steps
1. Read **Runway** on the dashboard → for example "7.9 mo" and "Until May 2027".
2. Click it → `/app/finance/runway` shows Cash, Monthly burn, Runway, Run-out (a full date), a
   "Projected cash" line (solid for history, then projected), and a list: "Burn — 3-mo avg",
   "Revenue — Excluded", "Financing — Excluded", "Treasury yield — Excluded", "Card balance owed —
   Not counted".
   - Hesitation: "Revenue — Excluded" alarms a founder with revenue. The page does not explain
     that runway assumes zero revenue.

### Edge Cases
- Brex-only company → Cash and Runway cards are hidden on the dashboard, with no message why.

---

### Spend, categories, vendors

## STORY-007: See everything we spent this quarter

**Type**: medium
**Topic**: Spend
**Persona**: Naive first-time founder
**Goal**: "Show me every expense this quarter."
**Preconditions**: NW-BASE.
**Ideal path**: 2 — open Spend, choose Quarter.
**Alternate paths**: dashboard "Spend this month" KPI; the large total next to the period tabs
(`Finance.tsx:466-471`); the "N transactions" header of a chat transactions card
(`FinanceCards.tsx:179-183`).

### Steps
1. On the dashboard choose **Quarter** in the period tabs → the total and "Spent <range> · +x%
   vs <range>" update. The Burn chart switches to weekly bars.
   - Hesitation: the Breakdown card below still says "Last 90 days" and does not change with the
     tabs; Upcoming and Subscriptions also do not change.
2. Click the bold quarter total → `/app/finance/spend?period=quarter` shows the period tabs, the
   total, chips "All", then one chip per category, and the transaction table (Date,
   Counterparty, Category, Amount, Status).
3. Click the **Software** chip → the URL gets `&cat=software` and the list narrows.
4. Look for a search box or an export button → none exists.

### Variations
- From the dashboard Burn chart, click one day bar → `/app/finance/spend?period=month&from=…&to=…`
  shows that day only.
- On that day view, click **Week** → the day range is dropped without notice.

### Edge Cases
- A category with no transactions in the period → the table shows only headers, with no "No
  transactions" message.

---

## STORY-008: "What are we spending the most on?"

**Type**: medium
**Topic**: Breakdown
**Persona**: Naive first-time founder
**Goal**: Find the biggest category and the vendors inside it.
**Preconditions**: NW-BASE.
**Ideal path**: 2 — read Breakdown, click the top category.
**Alternate paths**: Burn page "Where it went" (`FinanceBurn.tsx:80-100`); month page Categories;
chat breakdown card (`FinanceCards.tsx:139-175`).

### Steps
1. On the dashboard read **Breakdown** with **Category** selected → rows with bars, Payroll at
   the top.
2. Click **Show all 9** → all categories show. Click **Show less** → it collapses.
3. Click **Software** → `/app/finance/category/software` shows "Last 90 days" total, a small
   trend line with no axis, a Vendors list, and Recent transactions.
4. Check the breadcrumb → "Finance / Breakdown / Software". Click **← Breakdown** → it goes to the
   dashboard top, not to the Breakdown card.

---

## STORY-009: Look at one vendor's history

**Type**: short
**Topic**: Vendor
**Persona**: Naive first-time founder
**Goal**: "Has AWS been going up?"
**Preconditions**: NW-BASE with 6+ months of `MOCK AWS` charges rising.
**Ideal path**: 2 — Breakdown → Vendor → MOCK AWS.
**Alternate paths**: Subscriptions table row (`Finance.tsx:724`); category page Vendors list;
transaction page "Merchant ›" link; recurring page "Vendor ›" link; chat vendor breakdown card.

### Steps
1. In Breakdown, click **Vendor**, then **MOCK AWS** → `/app/finance/vendor/<key>` shows "Monthly
   avg (6 mo)", "Change (vs 3 mo ago)" in red when up, "First seen", "Paid with", a Monthly
   spend bar chart and a Charges table with a Receipt column.
2. Read the breadcrumb → "Finance / Subscriptions / MOCK AWS" (because AWS is a subscription).

---

### Subscriptions and upcoming

## STORY-010: Find subscriptions to cancel

**Type**: medium
**Topic**: Subscriptions
**Persona**: Naive first-time founder
**Goal**: "What SaaS are we paying for, and is anything redundant?"
**Preconditions**: NW-BASE including two subscriptions in the same overlap group.
**Ideal path**: 1 — read the Subscriptions table.
**Alternate paths**: chat subscriptions card (`FinanceCards.tsx:205-232`), whose rows open the
recurring page instead of the vendor page.

### Steps
1. Scroll to **Subscriptions** → a table with Vendor, Monthly, "3 mo" sparkline, Last charge, and
   a footer "5 subscriptions · $X/mo".
2. Notice the **overlaps** pill on two rows.
   - Hesitation: the pill does not say what the row overlaps with.
3. Hover a row → a tooltip pill shows "Brex ••0001" (paid with).
4. Click a row → the vendor page opens.
5. Look for a Cancel or "mark as not a subscription" control → none exists. The founder must ask
   the agent or go to the vendor.

---

## STORY-011: What bills are coming in the next 30 days?

**Type**: short
**Topic**: Upcoming
**Persona**: Naive first-time founder
**Goal**: Plan cash for the next month.
**Preconditions**: NW-BASE with recurring, pending and bill items in the next 30 days.
**Ideal path**: 1 — read Upcoming.
**Alternate paths**: none found.

### Steps
1. Read **Upcoming · 30 days** → a total "~$X", then rows of date(s), name, a tag
   (`recurring`, `pending` or `bill`), and amount. Weekly items show "×4".
2. Click a `recurring` row → `/app/finance/recurring/<key>` shows Cadence, Next, Expected, Vendor
   ›, and Past charges.
3. Click a `pending` row → the transaction page opens.
4. Try to click a `bill` row → nothing happens and no chevron shows.
   - Hesitation: bills are not clickable, with no hint why.

---

### Transactions and receipts

## STORY-012: Check one charge and find its receipt

**Type**: medium
**Topic**: Transactions
**Persona**: Naive first-time founder
**Goal**: "My accountant asks for the receipt for the Figma charge."
**Preconditions**: NW-BASE: a Brex `MOCK Figma` charge with `hasReceipt` and an image receipt.
**Ideal path**: 3 — find the charge, open it, open the receipt.
**Alternate paths**: vendor page Charges table (receipt icon column); Spend page; month page;
category Recent; account detail; chat transactions card rows.

### Steps
1. Open **Breakdown → Vendor → MOCK Figma** → the Charges table shows a receipt icon on the row.
2. Click the row → the transaction page title is the date (for example "September 12, 2026"); the
   amount is large; the merchant shows in small text.
   - Hesitation: the page title is a date, not "MOCK Figma".
3. Read the details → Merchant ›, Date posted, Status, Source "MOCK Brex Card ••0001",
   Cardholder, Category ›, Memo, and **Open in Brex**.
4. Click the receipt thumbnail → `/app/finance/receipt/<id>` shows the image and **Open receipt**.

### Variations
- Wanting to change the category → no control exists.

---

## STORY-013: A Mercury charge with no known receipt

**Type**: short
**Topic**: Receipts
**Persona**: Naive first-time founder
**Goal**: Find out if a receipt exists.
**Preconditions**: NW-BASE: a Mercury spend transaction, one with an attachment upstream and one
without.
**Ideal path**: 2 — open the transaction, click Check for receipt.
**Alternate paths**: none found.

### Steps
1. Open the Mercury transaction → the Receipt section shows **Check for receipt**.
2. Click it → the button is disabled while checking, then a thumbnail shows (found) or "No
   receipt" (not found).

### Edge Cases
- The check fails for a reason other than "not found" → the button comes back with no error text.

---

### Accounts

## STORY-014: Look at one account and the card balance

**Type**: medium
**Topic**: Accounts
**Persona**: Naive first-time founder
**Goal**: "How much do we owe on the Brex card, and how much does Treasury earn?"
**Preconditions**: NW-BASE.
**Ideal path**: 2 — open Accounts, click the account.
**Alternate paths**: dashboard "Treasury yield" card links to Accounts; source chip "Mercury"
opens `/app/finance/accounts?source=mercury`; Burn page "By account" rows.

### Steps
1. Click **Accounts** (top right on the dashboard) → Total cash, Card balance owed, Total balance
   chart with period tabs, Cash accounts with "••last four" and "4.1% yield" pill, and "Card
   balance owed" list.
2. Click **MOCK Treasury ••7730** → Balance, Yield, a Balance chart, a Yield table (Month,
   Dividends, Fee, Net), and Transactions.
   - Hesitation: Transactions shows only the newest 20 with no "See more".
3. Click **← Accounts**, then the **Mercury** chip on the dashboard → the Accounts page with a
   "Mercury ×" badge. Click the badge → the filter clears.

---

### Crypto

## STORY-015: Should crypto count as cash?

**Type**: short
**Topic**: Crypto and runway
**Persona**: Naive first-time founder with a treasury Safe
**Goal**: "Count our USDC in runway, but not ETH."
**Preconditions**: NW-CRYPTO.
**Ideal path**: 2 — open the runway control, choose Stablecoins only.
**Alternate paths**: same control on Accounts (`FinanceAccounts.tsx:249-259`) and Runway
(`FinanceBurn.tsx:261-265`).

### Steps
1. On **Runway**, click **Count crypto** → it saves "all crypto" at once. The label changes to
   "Counting all crypto ▾".
   - Hesitation: one click immediately counts volatile tokens; there is no choice first.
2. Open the menu and choose **Stablecoins only** → runway and Cash reload; a Cash list shows Bank,
   Stablecoins, Other crypto.
3. Return to the dashboard → the Cash subtitle shows "Checking + Treasury + Stablecoins" and a
   new "Crypto" KPI shows. Hovering Runway shows "Bank only: 7.9 mo".

---

## STORY-016: Add, rename and remove a wallet and an exchange

**Type**: medium
**Topic**: Crypto
**Persona**: Naive first-time founder
**Goal**: Track the company Safe and the Kraken account, and remove an old wallet.
**Preconditions**: NW-CRYPTO. A Kraken stub that accepts a mock key.
**Ideal path**: 4 — Add wallet, paste address, Add; Remove via menu.
**Alternate paths**: Add account dialog → Wallet or Coinbase/Kraken; Integrations tiles for
Kraken/Coinbase "Connect" and Blockscout/Alchemy.

### Steps
1. Open **Crypto** (the Crypto KPI) → "Updated …", Wallets total, rows with type and "2 of 3",
   a Coinbase section, "Balance over time", Chains, Holdings.
2. Click **Add wallet** → enter `mock-ops2.eth`, label "MOCK Ops 2", type Personal → **Add**.
3. Use the "…" menu → **Edit** → change the label → **Save**.
4. "…" → **Remove** → "Remove MOCK Ops 2?" → **Remove**.
5. Go to **Accounts → Add account → Kraken** → enter API key and Private key → **Connect** →
   Kraken shows under Crypto.

### Edge Cases
- Add the same address twice → "That wallet is already added".
- Unknown ENS → "That ENS name was not found".
- Blockscout key missing → a lone **Connect** button shows at the top of Crypto with no object.
- Integrations shows Blockscout and Alchemy with the same description "Read wallet balances".

---

### Statements

## STORY-017: Upload this month's statement when reminded

**Type**: short
**Topic**: Statements
**Persona**: Naive first-time founder whose second bank has no integration
**Goal**: Keep a non-integrated bank current.
**Preconditions**: NW-STATEMENT; file `mock-firstbank-2026-09.csv`.
**Ideal path**: 2 — click Upload, drop the file.
**Alternate paths**: Add account → Upload statements.

### Steps
1. See the banner "Upload the September statement for MOCK First Mock Bank ••5502" → click
   **Upload**.
2. Drop the CSV → "Reading…" then a group with period, "opening → closing", "N transactions",
   "Transactions add up to the closing balance", and "Imported".
3. Click **Done** → the banner goes away and totals change.

---

## STORY-018: Upload the wrong files

**Type**: medium
**Topic**: Statements
**Persona**: Naive first-time founder
**Goal**: Upload whatever is in the downloads folder.
**Preconditions**: NW-STATEMENT; files `notes.docx`, an oversized PDF, and
`mock-firstbank-2026-08.pdf` with a $12.40 mismatch.
**Ideal path**: 2 — open upload, drop files.
**Alternate paths**: none found.

### Steps
1. Drop all three → `notes.docx` shows "Upload a PDF, CSV, OFX or QFX file" with **Dismiss**; the
   large file shows "The file is too large".
2. The mismatched PDF is imported straight away and then shows "Transactions are $12.40 off the
   closing balance" in red, plus a bold "Read by an AI model…" warning.
   - Hesitation: it is already imported. The founder expected a review step before accepting
     numbers that do not add up.
3. Click **Remove** on it → it disappears and totals revert.
4. Close the dialog and reopen it → the earlier imports are not listed; there is nowhere to see
   or remove past statements.

---

### Errors and wrong links

## STORY-023: Follow a broken or old link

**Type**: short
**Topic**: Errors
**Persona**: Naive first-time founder
**Goal**: Open a link a teammate pasted.
**Preconditions**: NW-BASE.
**Ideal path**: 1.
**Alternate paths**: none found.

### Steps
1. Open `/app/finance/transaction/does-not-exist` → a red error with a retry control (not "Not
   found").
2. Open `/app/finance/budget` → "Not found" page with a "← Finance" button.
3. Open `/app/finance/accounts?source=chase` → the full Accounts list with no hint the filter was
   ignored.

---

### Long end-to-end stories

## STORY-019: First morning with Finance

**Type**: long
**Topic**: End to end
**Persona**: Naive first-time founder
**Goal**: Connect both banks and understand cash, burn, runway and the biggest costs before a board
call.
**Preconditions**: NW-EMPTY, Mercury and Brex OAuth stubs that load NW-BASE data.
**Ideal path**: 8 — Finance, Add account, Mercury, approve, Add Brex, approve, read KPIs, open
Breakdown top row.
**Alternate paths**: connect both from Integrations.

### Steps
1. Click **Finance** → empty state.
2. **Add account → Mercury** → approve → dashboard syncs.
3. Click **Add Brex** in the header → lands on Integrations, not a dialog.
   - Hesitation: the founder thinks they left Finance.
4. Click **Connect** on Brex → approve → tile shows **Open Finance**.
5. Click **Open Finance** → Brex chip shows; "Add Brex" is gone.
6. Read Cash, Monthly burn, Runway, Spend this month.
7. Click **Runway** → read Run-out and the excluded list.
8. Click **← Finance** → Breakdown → **Payroll** → category page.
9. Click a vendor → vendor page → click one charge → transaction page.
10. Use breadcrumbs to go back to Finance.
11. Open **Burn → By month** and compare the last three months.
12. Click **Accounts** → confirm "Card balance owed — Not counted in cash".
13. Return and click **Refresh** to see "Updated just now".
14. Click **Ask agent** → the panel opens and says it is creating the Finance agent ("Create
    Finance agent" label while creating).
15. Type "Summarize cash, burn and runway for my board call" → finance cards show in the chat.
16. Compare the chat card's Runway ("8 mo", rounded) with the dashboard ("7.9 mo").
    - Hesitation: the two numbers look different.

---

## STORY-020: Write an investor update that includes crypto

**Type**: long
**Topic**: End to end with crypto
**Persona**: Naive first-time founder
**Goal**: Report cash with and without stablecoins and the biggest cost changes.
**Preconditions**: NW-CRYPTO with Finance agent created.
**Ideal path**: 6.
**Alternate paths**: answer only from the agent.

### Steps
1. Open Finance → Crypto KPI shows; hover Cash for Bank / Stablecoins / Other crypto / Total.
2. Open **Crypto** → check Holdings; an unpriced token shows "—" and "1 unpriced".
3. Open **Runway → Count crypto → Stablecoins only**.
4. Back on the dashboard, hover Runway → "Bank only: X mo".
5. Open **Breakdown → Vendor**; note vendors with red Change.
6. Open the vendor pages for the top 2 risers.
7. Click **Ask agent** → "Draft an investor update: cash bank-only and with stablecoins, runway,
   top 3 cost increases."
8. Hover a finance card → click **Ask about this** → the composer quotes that message; ask a
   follow-up.
9. Click a card row → the matching Finance page opens.
10. Ask the agent to "Move $50k from checking to treasury" → it replies it cannot move money.
11. Turn counting back off with **Don't count crypto**.

---

## STORY-021: Track a bank that has no integration

**Type**: long
**Topic**: End to end with statements
**Persona**: Naive first-time founder
**Goal**: Get a second bank into totals and keep it current.
**Preconditions**: NW-EMPTY plus statement files for 3 months of `MOCK First Mock Bank`.
**Ideal path**: 4.
**Alternate paths**: none found.

### Steps
1. Finance → **Add account → Upload statements**.
2. Drop 3 monthly files → one group "MOCK First Mock Bank ••5502" with a "New account" badge and
   three rows.
3. Click **Done** → the dashboard now shows KPIs (statement accounts count as data).
4. Open **Accounts** → the statement account is listed.
5. Open it → balance chart and transactions show. There is no Yield table.
6. Next month, see the reminder banner → **Upload**.
7. Try to delete the account → no control exists.
8. Ask the agent "Which statements have I uploaded?".

---

## STORY-022: Monthly review with the agent, pins and a reconnect

**Type**: long
**Topic**: Agent, pins, reconnect
**Persona**: Naive first-time founder
**Goal**: Run the month-end close checklist and fix a broken bank link.
**Preconditions**: NW-RECONNECT + NW-AGENT.
**Ideal path**: 6.
**Alternate paths**: open "Finance agent" from the sidebar bot list (not filtered out, see
Suspected problems).

### Steps
1. Open Finance → the Mercury chip has a yellow dot. Click it → Integrations.
   - Hesitation: the chip has no "Reconnect" text, only an aria-label.
2. On the Mercury tile ("Reconnect" badge) click **Reconnect** → approve.
3. Click **Open Finance** → green dot.
4. Click **Ask agent** → the panel shows the thread with "3 finance lookups" collapsed. Expand it.
5. Look for the "Month-end close" checklist and the Cash/Runway pins → they are not shown in the
   Finance side panel.
6. Find **Finance agent** in the sidebar bot list → open it → the pins strip and List button show.
7. Tick "Reconcile Brex" on the checklist.
8. Ask the agent to "update the Runway pin" → click the pin refresh.
9. Return to Finance → the panel is closed again (it starts closed every visit).

## Redundancy Candidates

### Duplicate paths (same goal, multiple routes)
- Connect Mercury/Brex: Add account dialog (`AddAccountDialog.tsx:145-155`) and Integrations
  tiles (`FinanceSection.tsx:356-415`). "Add Brex" and reconnect go to Integrations
  (`Finance.tsx:63, 237, 342`), so a founder uses both.
- Connect Coinbase/Kraken: Add account dialog and Integrations tiles. Remove only on Crypto page.
- Subscription detail: vendor page (dashboard table `Finance.tsx:724`) vs recurring page (Upcoming
  `Finance.tsx:658` and chat card `FinanceCards.tsx:216`). Two detail pages for one subscription.
- Crypto scope control on both Accounts and Runway.
- Finance agent: side panel via "Ask agent" and the sidebar bot list.

### Duplicate information (same fact, multiple surfaces)
- Cash: dashboard Cash, Accounts Total cash, Runway Cash, agent card — with differing subtitles.
- Monthly burn: dashboard, Burn page, Runway page, agent card.
- Runway: dashboard (1 decimal), Runway page, agent card (rounded to whole months).
- Category breakdown: dashboard Breakdown, Burn "Where it went", month Categories, Spend chips,
  agent card.
- Transactions table repeated on Spend, month, category Recent, account, recurring Past charges,
  vendor Charges (a different table with a Receipt column).

### Overlapping features/tools
- Blockscout and Alchemy tiles both say "Read wallet balances".
- Dashboard period tabs vs Spend page period tabs vs Accounts balance range tabs.

## Suspected problems

1. Mismatched statements are imported without review: `apps/web/src/components/finance/StatementImport.tsx:69-74` sends `acceptMismatch: true` automatically, and the error appears only after the import.
2. Past statements can't be seen or removed after the dialog closes. Upload state lives only in local component state (`StatementImport.tsx:36`). The `finance.statements` list RPC exists (`apps/api/src/finance-statements.ts:487`), but the web app never calls it. There is also no way to delete a statement-created account.
3. Pins and checklists are hidden in the Finance side panel: `apps/web/src/pages/Shell.tsx:2971, 2974, 4076` gate them on `!pageMode`. The Finance agent is not filtered from the sidebar bot list (`apps/web/src/pages/shell/space-sidebar.ts` has no spawnKey filter), so the pins only show there.
4. Breadcrumbs name pages that do not exist. "Breakdown", "Upcoming", "Subscriptions" and "Vendors" all go to the dashboard (`FinanceSpend.tsx:114, 193, 235`; `FinanceTransaction.tsx:55`). The back button takes these labels (`components/finance/ui.tsx:93-101`).
5. Runway is shown differently: the agent card rounds it (`FinanceCards.tsx:122` `Math.round`), but the dashboard shows one decimal (`Finance.tsx:288`).
6. Cash subtitles disagree: "Checking + Treasury" on the dashboard (`Finance.tsx:394-397`) and "Checking + Savings + Treasury" on Accounts (`FinanceAccounts.tsx:175-177`).
7. The dashboard period tabs do not change Breakdown, Upcoming or Subscriptions. Breakdown is fixed to "Last 90 days" (`Finance.tsx:552`).
8. Empty tables have no empty state: `TransactionTable` (`ui.tsx:346`) shows only headers, and the Wallets section is blank when there are no wallets (`FinanceCrypto.tsx:193-207`).
9. Alchemy "Remove" has no confirmation (`FinanceSection.tsx:121-129`), but wallet and exchange removals do. Finance also has no disconnect for Mercury, Brex or Blockscout.
10. Labels are vague: the Crypto page shows a bare "Connect" (`FinanceCrypto.tsx:170-176`), and Blockscout and Alchemy share the same description (`FinanceSection.tsx:54, 110`).
11. The "overlaps" pill does not say what the row overlaps with (`Finance.tsx:733-737`).
12. Upcoming `bill` rows can't be clicked (`Finance.tsx:656-661`).
13. Account detail shows only the newest 20 transactions, with no "See more" (`apps/api/src/finance.ts:589`).
14. The transaction page's title is a date instead of the merchant (`FinanceTransaction.tsx:136`).
15. The empty state shows only bank logos (`Finance.tsx:169-171`). The agent description mentions only Mercury and Brex (`apps/api/src/finance-agent.ts:82`), and there is a dead string at `finance-agent.ts:13`.
16. A bad id shows an error with retry instead of "Not found" (`FinanceTransaction.tsx:137-139`). An unknown `?source=` is ignored silently (`finance-route.ts:65-67`).
17. The chat breakdown card header always links to the monthly Spend view, whatever range the card shows (`FinanceCards.tsx:143-146`).
