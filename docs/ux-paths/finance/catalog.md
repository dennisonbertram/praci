## Area: Finance (STORY-FIN-nnn)

Source: `docs/ux-paths/finance/catalog.md`.


Generated: 2026-10-17
Code read at: `559a76ad` (`the repository root`, branch `docs/ux-pass`), read-only.
Scope: `/app/finance/*` (dashboard and detail pages), the Add account dialog, statement upload,
crypto wallets and exchanges, finance tiles on `/app/integrations?category=finance`, the Finance
agent side panel, finance cards in chat, agent pins and checklists, and the **Hide amounts**
switch (Finance, Cap table, chat, search, notifications).
Total stories: 36 (short 19, medium 12, long 5)

### Changes since the 2026-10-16 catalog

Code changed a lot in the Finance pages since the earlier catalog (Hide amounts, an empty-state
rewrite, a shared "Ask" button, vendor grouping, statement review, a Blockscout key that is now
optional). All 23 earlier ids still apply; most had labels or steps fixed.

- **Kept unchanged in intent, steps fixed**: FIN-002, 003, 005, 008, 009, 010, 012, 013, 014, 015, 016, 020.
- **Changed (behaviour moved in code)**:
  - FIN-001: the empty state is now "No accounts yet" with logos, one **Add account** button; after
    the first source connects, only a small "Add Brex" link remains.
  - FIN-004: Monthly burn is now "3-mo avg, after revenue"; the Burn page has one KPI, not three.
  - FIN-006: Runway page now says "Revenue — Subtracted from burn" (it used to say Excluded).
  - FIN-007: the "Spend this month" KPI is gone; the period strip holds the total, and Breakdown now follows the tabs.
  - FIN-011: a `bill` row now opens a small details popover (it used to do nothing).
  - FIN-017, 018, 021: a statement whose balances do not add up now waits for **Import anyway** or **Discard**; past statements are listed in the dialog with **Remove**; a statement account can be renamed.
  - FIN-019, 022: the agent button is now "Ask" (aria-label "Ask Finance agent"); the empty panel offers two questions.
  - FIN-023: an unknown transaction id now shows "Not found"; an unknown `?source=` is flagged "Unknown source: chase ×".
- **Dropped**: none.
- **Added** (new behaviour):
  - FIN-024 to FIN-031: Hide amounts (header button, account-menu row, persistence, what is masked on Finance, Cap table, chat and charts, receipts, phone, keyboard, leaks).
  - FIN-032: group transactions by vendor ("By vendor").
  - FIN-033: Brex spend from the Burn page, and the source-filtered Accounts page.
  - FIN-034: rename a statement account.
  - FIN-035: wallets without a Blockscout key (optional key note).
  - FIN-036: long story that mixes Hide amounts with a board-call screen share.

### Persona (applies to every story)

A first-time user. Maya, a startup founder at "Northwind Robotics", has never seen
Praci or its code. She does not know its terms ("burn", "runway scope", "MCP", "Blockscout",
"pins", "Hide amounts"). She wants to run her company clearly and consistently: know how much money
she has, what she spends it on, and when it runs out. Steps are written in her words.
**Hesitation** marks a place where a first-timer is likely to stop, misread a label, or pick the
wrong control.

### Demo account (shared preconditions)

The walk runs against a seeded mock demo account. Every visible company, vendor, and person name
must be clearly fake. The baseline seed is called **NW-BASE**:

- Space or company name: `Northwind Robotics`. The signed-in user is the founder
  (for example `Mock Founder`). With more than one space, the space name shows beside the page title.
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
  - One transaction memo that contains a dollar amount, for example `Invoice 4417 — $4,200 deposit`.
- At least one transaction in a non-USD currency, so "1 non-USD not counted" shows in the header.
- Finance agent: **not created yet** in NW-BASE, so the first "Ask" creates it.
- Hide amounts: **off** (the default on a browser that never switched it).

Extra seeds named in story preconditions:

- **NW-CRYPTO**: NW-BASE plus one wallet `MOCK Treasury Safe` (type Safe, 2 of 3 owners) on
  Ethereum holding USDC and ETH; one wallet `mock-ops.eth` (type Personal) holding one unpriced
  token; a Coinbase exchange connection with USD, BTC and USDC balances; 90 days of crypto history.
  No Blockscout API key is saved unless a story says so. The runway scope is `bank`.
- **NW-STATEMENT**: NW-BASE plus one account created from an uploaded statement
  (`MOCK First Mock Bank ••5502`) whose next statement is due, so the reminder banner shows.
  Test files: `mock-firstbank-2026-09.csv` (balances match), `mock-firstbank-2026-08.pdf`
  (balances off by $12.40), `notes.docx` (wrong type), and one file over the size limit.
- **NW-EMPTY**: a fresh `Northwind Robotics` space with no finance sources, no
  statement accounts, no wallets and no exchanges.
- **NW-RECONNECT**: NW-BASE with the Mercury source set to `needs_reconnect`.
- **NW-AGENT**: NW-BASE plus an existing Finance agent whose thread holds one earlier turn with 3
  finance tool reads (overview, breakdown by vendor, subscriptions), so a collapsed
  "3 finance lookups" group shows. The agent also has pins: two stat pins
  ("Cash", "Runway") and one checklist ("Month-end close") with 3 items, one of them done.
- **NW-CAP**: NW-BASE plus a connected Carta account with a cap table snapshot (`MOCK Mock
  Founder`, 8,000,000 shares; `MOCK Seed Fund I`, 1,200,000 shares; an option pool), valued at
  a share price so dollar values and percentages show.
- **NW-HIDDEN**: NW-AGENT plus NW-CAP, with a chat thread where the agent has replied with text
  containing "$1.62M in cash" and "7.9 months of runway", and one chart message.

### Summary

| Type | Count |
|------|-------|
| Short | 19 |
| Medium | 12 |
| Long | 5 |

### Coverage Matrix

| Feature area | Stories | Gaps |
|---|---|---|
| Dashboard: Cash, Monthly burn, Runway, Crypto KPIs, refresh | 001, 002, 003, 019 | No "Spend this month" KPI any more; spend is in the period strip |
| Burn page, month page | 004, 005, 019 | — |
| Runway page, crypto scope | 006, 015, 020 | No "what if" scenario in the UI; only the agent can model one |
| Spend page, period tabs, category chips, chart-bar ranges | 007 | No search, no export |
| Breakdown by category or vendor, category and vendor pages | 008, 009 | — |
| Subscriptions, Upcoming, recurring page, bill popover | 010, 011 | No cancel, rename or "not a subscription" control |
| Transactions, receipts, group by vendor | 012, 013, 032 | No way to recategorize or add notes |
| Accounts list, source filter, account detail, cards owed | 014, 019, 033 | Account detail shows only the newest transactions; no "See more" |
| Crypto: wallets, exchanges, optional Blockscout key, Alchemy | 015, 016, 020, 035 | — |
| Statement upload, review, reminders, removal, rename | 017, 018, 021, 034 | — |
| Connecting Mercury and Brex, reconnecting | 001, 019, 022 | No disconnect in Finance |
| Finance agent panel, finance cards, Ask about this | 019, 020, 022 | — |
| Pins and checklists | 022 | Hidden in the Finance side panel |
| Hide amounts: switch, persistence, scope | 024, 025, 026, 027, 028, 029, 030, 031, 036 | No keyboard shortcut; no cross-tab sync; charts keep their shape |
| Errors, empty states, not found | 001, 013, 018, 023 | — |

### Story Dependency Graph

```text
NW-EMPTY
└── STORY-FIN-001 (first visit, connect Mercury)
    └── STORY-FIN-019 (long: first morning with Finance)

NW-BASE
├── STORY-FIN-002 (how much cash)
├── STORY-FIN-003 (refresh)
├── STORY-FIN-004 → STORY-FIN-005 (burn → month)
├── STORY-FIN-006 (runway)
├── STORY-FIN-007 → STORY-FIN-008 → STORY-FIN-009 (spend → category → vendor)
├── STORY-FIN-010 → STORY-FIN-011 (subscriptions → upcoming)
├── STORY-FIN-012 → STORY-FIN-013 (transaction → receipt)
├── STORY-FIN-032 (group by vendor)
├── STORY-FIN-014 → STORY-FIN-033 (accounts, card owed → Brex spend)
├── STORY-FIN-023 (wrong links, not found)
├── STORY-FIN-024 → STORY-FIN-025 → STORY-FIN-026 (Hide amounts: header, menu, persistence)
└── STORY-FIN-027 → STORY-FIN-028 (hidden dashboard → hidden detail pages)

NW-CRYPTO
├── STORY-FIN-015 (count crypto in runway)
├── STORY-FIN-016 (add, edit, remove wallet and exchange)
├── STORY-FIN-035 (wallets without a key)
└── STORY-FIN-020 (long: investor update with crypto)

NW-STATEMENT
├── STORY-FIN-017 (reminder → upload)
├── STORY-FIN-018 (bad files, review)
├── STORY-FIN-034 (rename a statement account)
└── STORY-FIN-021 (long: bank without an integration)

NW-RECONNECT + NW-AGENT
└── STORY-FIN-022 (long: monthly review with the agent, pins, reconnect)

NW-HIDDEN
├── STORY-FIN-029 (Cap table and chat while hidden)
├── STORY-FIN-030 (phone width)
├── STORY-FIN-031 (keyboard only)
└── STORY-FIN-036 (long: board-call screen share)
```


### Stories: First visit and connecting

#### STORY-FIN-001: Open Finance for the first time and connect the bank

**Type**: medium
**Topic**: Connecting
**Persona**: Maya, naive first-time founder
**Goal**: "I bank with Mercury. I want this app to show my cash."
**Preconditions**: NW-EMPTY. A Mercury OAuth sandbox or stub that completes sign-in for a mock
Mercury org with NW-BASE accounts.
**Ideal path**: 3 — click Finance, click Add account, click Mercury and approve the popup (the
approval is the third step).
**Alternate paths**: (a) Integrations page `/app/integrations?category=finance` → Mercury tile
"Connect" (`FinanceSection.tsx:446-463`); (b) Accounts page **Add account** (`FinanceAccounts.tsx:~228`), only
reachable later.

##### Steps
1. Click **Finance** in the left sidebar → `/app/finance` shows the title "Finance" and, under it, the
   Mercury and Brex logos, "No accounts yet", "Add an account to see cash, burn, runway and spend." and
   one button, **Add account** (`Finance.tsx:216-245`).
   - Hesitation: only bank logos are shown. A founder who also holds crypto or uses another bank does
     not know those are supported until the dialog opens.
2. Click **Add account** → dialog "Add account" with a **Bank** section (Mercury "Read balances and
   transactions", Brex "Read cards, expenses and bills", "Upload statements" "PDF, CSV, OFX or QFX") and
   a **Crypto** section (Wallet "Address or ENS", Coinbase and Kraken "Read-only API key")
   (`AddAccountDialog.tsx:121-205`).
3. Click **Mercury** → a sign-in popup opens. The Bank cards are disabled while it waits.
4. Approve access in the popup → the popup closes, the dialog closes, and the dashboard reloads.
5. Watch the header → "Syncing…" with a spinning refresh icon, and skeleton cards until the first
   sync finishes.
6. After the sync → KPI cards "Cash", "Monthly burn" and "Runway" show values, a period strip with
   the spend total, and a green-dot "Mercury" chip sits next to the title. Because Brex is the only
   source still missing, a small link **Add Brex** shows.

##### Variations
- Close the popup without approving → the dialog stays open with "Sign-in was cancelled or did not
  finish. Try again."
- Connect from Integrations instead → the tile changes to "Connected" with **Open Finance**.
- With two spaces, the space name shows in small grey text beside "Finance".

##### Edge Cases
- The first sync fails → a red notice with **Try again** shows above the cards.
- **Add Brex** goes to Integrations (`Finance.tsx:91`, `:410-416`), not to the Add account dialog where
  Mercury was connected. The founder connects two banks in two different places.

---

#### STORY-FIN-002: "How much cash do we have right now?"

**Type**: short
**Topic**: Dashboard
**Persona**: Maya, naive first-time founder
**Goal**: Read one trustworthy cash number and see what makes it up.
**Preconditions**: NW-BASE.
**Ideal path**: 1 — open Finance and read the Cash card.
**Alternate paths**: Accounts page "Total cash" KPI (`FinanceAccounts.tsx:~270`); Runway page "Cash"
KPI (`FinanceBurn.tsx:~249`); Finance agent overview card "Cash" (`FinanceCards.tsx:~121`).

##### Steps
1. Open **Finance** → the **Cash** card shows about $1,622,000 with the subtitle "3 bank accounts"
   (`cashSubtitle`, `ui.tsx:788`).
   - Hesitation: "3 bank accounts" does not name them. The founder has to open the card to see
     Checking, Treasury and Savings.
2. Notice the Brex card balance is not part of the number → no hint on the dashboard says card debt
   is excluded.
3. Click the **Cash** card → `/app/finance/accounts` shows "Total cash", "Card balance owed $38,500 —
   Not counted in cash", a "Total balance" chart with Week/Month/Quarter/Year tabs, and the list of
   cash accounts.

##### Variations
- Mobile width → the KPIs wrap into a 2-column grid; an odd last card takes the full row.

##### Edge Cases
- "1 non-USD not counted" shows in the header with no link or explanation of which transaction.
- Brex-only company → Cash and Runway cards are hidden (`Finance.tsx:~395`), with no message why.

---

#### STORY-FIN-003: Make sure the numbers are current

**Type**: short
**Topic**: Dashboard
**Persona**: Maya, naive first-time founder
**Goal**: "I just paid a contractor. Is that in here yet?"
**Preconditions**: NW-BASE, last sync about 2 hours ago (shows "Updated 2 hours ago").
**Ideal path**: 1 — click refresh.
**Alternate paths**: none found (opening Finance also triggers one sync per visit,
`Finance.tsx:140-152`).

##### Steps
1. Read the header → "Updated 2 hours ago" next to a small refresh icon with no text label.
   - Hesitation: the icon is tiny and only has an aria-label "Refresh" (and a tooltip on hover).
2. Click the refresh icon → it spins and the text changes to "Syncing…". The chips beside it do not
   move, because both labels share one grid cell.
3. Wait → the text changes to "Updated just now" (or similar) and the numbers reload. A fast,
   throttled refresh still holds "Syncing…" for about 0.8 seconds so the click shows something
   (`Finance.tsx:123`).

##### Edge Cases
- Sync service unavailable → a red notice with the error text and **Try again**.
- Keyboard: Tab to the refresh icon, press Enter; focus stays on it while it syncs
  (`focusableWhenDisabled`).

---

### Stories: Burn and runway

#### STORY-FIN-004: "What is our burn?"

**Type**: medium
**Topic**: Burn
**Persona**: Maya, naive first-time founder
**Goal**: Understand monthly burn and where it goes.
**Preconditions**: NW-BASE.
**Ideal path**: 2 — click Monthly burn, read the Burn page.
**Alternate paths**: dashboard "Burn ›" section title (`Finance.tsx:~496`); Runway page "Monthly
burn" KPI (`FinanceBurn.tsx:~250`).

##### Steps
1. On the dashboard, read **Monthly burn** → about $205,000 with the subtitle "3-mo avg, after
   revenue".
   - Hesitation: a founder may expect gross spend this month; the subtitle is the only hint that
     revenue is already taken off.
2. Look at the **Burn** chart → dark "Out", grey "Revenue", and striped "Financing" bars (Month tab
   is selected). The last bar has an asterisk and "* So far".
3. Click **Monthly burn** → `/app/finance/burn` shows one KPI "Monthly burn", a monthly bar chart
   starting at the first month with data, "Where it went" (a stacked bar and category rows with
   swatches), "By account" with percent shares, and "By month" (Month, Out, In, Net).
4. Read the **By month** table → Net is red when negative, green when positive. The financing month
   shows a large positive Net.
   - Hesitation: "Net" counts revenue and financing as "In", while the KPI above subtracts only
     revenue. The founder may not see why the numbers differ.

##### Variations
- Choose **Year** on the dashboard period tabs → the Burn chart changes to monthly bars; clicking one
  opens the month page.
- An account that took in more than it spent does not appear in "By account".

---

#### STORY-FIN-005: Drill into one month

**Type**: short
**Topic**: Burn
**Persona**: Maya, naive first-time founder
**Goal**: "Why was August so expensive?"
**Preconditions**: NW-BASE with a large one-off August charge (`MOCK Hardware Supplier`, $48,000).
**Ideal path**: 2 — open Burn, click August.
**Alternate paths**: dashboard Year tab → click the August bar (`Finance.tsx:~560`); Burn page chart
bar (`FinanceBurn.tsx:~104`).

##### Steps
1. On `/app/finance/burn`, click **August 2026** in By month → `/app/finance/month/2026-08` shows
   "Out", "In", "Net" KPIs, a Categories list, and Transactions (with **List** and **By vendor**
   buttons).
2. Find `MOCK Hardware Supplier` → it is at or near the top of Transactions.
3. Click the **← Burn** back button → returns to the Burn page.

##### Edge Cases
- `/app/finance/month/2026-8` (no leading zero) → "Not found" with "This page doesn't exist or was
  removed." and a **← Finance** back button.

---

#### STORY-FIN-006: "When do we run out of money?"

**Type**: short
**Topic**: Runway
**Persona**: Maya, naive first-time founder
**Goal**: Know the runway in months and the date.
**Preconditions**: NW-BASE.
**Ideal path**: 1 — read the Runway card.
**Alternate paths**: Runway page (`FinanceBurn.tsx:~228`); Finance agent overview card
(`FinanceCards.tsx:~122`).

##### Steps
1. Read **Runway** on the dashboard → for example "7.9 mo" and "Until May 2027".
2. Click it → `/app/finance/runway` shows Cash, Monthly burn, Runway, Run-out (a full date), a
   "Projected cash" line (solid for history, dashed for projection), and a list: "Burn — Spending minus
   revenue, 3-mo avg", "Revenue — Subtracted from burn", "Financing — Excluded", "Treasury yield —
   Excluded", "Card balance owed — Not counted" (`FinanceBurn.tsx:~319`).
   - Hesitation: "Financing — Excluded" may alarm a founder who just raised; the page does not say
     why a raise is not counted.

##### Edge Cases
- Brex-only company → Cash and Runway cards are hidden on the dashboard.

---

### Stories: Spend, categories, vendors

#### STORY-FIN-007: See everything we spent this quarter

**Type**: medium
**Topic**: Spend
**Persona**: Maya, naive first-time founder
**Goal**: "Show me every expense this quarter."
**Preconditions**: NW-BASE.
**Ideal path**: 2 — open Spend, choose Quarter.
**Alternate paths**: the large total next to the period tabs (`Finance.tsx:~452`); the "N transactions"
header of a chat transactions card (`FinanceCards.tsx:~180`).

##### Steps
1. On the dashboard choose **Quarter** in the period tabs → the total and "Spent <range> · ↑x% vs
   <range>" update (the comparison is left out when both figures are equal). The Burn chart switches to
   weekly bars and the Breakdown card follows the tab and shows the same date range.
   - Hesitation: Upcoming and Subscriptions do not change with the tabs. There is no "Spend this
     month" card to look for any more; the total is the bold figure beside the tabs.
2. Click the bold quarter total → `/app/finance/spend?period=quarter` shows the period tabs, the
   total, chips "All", then one chip per category, and the transaction table (Date, Counterparty,
   Category, Amount, Status) with **List** and **By vendor** buttons.
3. Click the **Software** chip → the URL gets `&cat=software` and the list narrows.
4. Look for a search box or an export button → none exists.

##### Variations
- From the dashboard Burn chart, click one day bar → `/app/finance/spend?period=month&from=…&to=…`
  shows that day only, no tab is selected, and a "Oct 3 ×" badge clears it.
- On that day view, click **Week** → the day range is dropped.

##### Edge Cases
- A category with no transactions in the period → "No transactions in this period".

---

#### STORY-FIN-008: "What are we spending the most on?"

**Type**: medium
**Topic**: Breakdown
**Persona**: Maya, naive first-time founder
**Goal**: Find the biggest category and the vendors inside it.
**Preconditions**: NW-BASE.
**Ideal path**: 2 — read Breakdown, click the top category.
**Alternate paths**: Burn page "Where it went" (`FinanceBurn.tsx:~115`); month page Categories; chat
breakdown card (`FinanceCards.tsx:~139`).

##### Steps
1. On the dashboard read **Breakdown** with **Category** selected → rows with bars, Payroll at the top.
2. Click **Show all 9** → all categories show. Click **Show less** → it collapses.
3. Click **Software** → `/app/finance/category/software` shows "Last 90 days" total, a small trend line
   with no axis, a Vendors list, and Recent transactions.
4. Check the breadcrumb → "Finance / Breakdown / Software". Click **← Breakdown** → the dashboard
   scrolls back to the Breakdown card (the URL has `#breakdown`) and keeps the Category or Vendor
   choice (`?by=vendor`).

---

#### STORY-FIN-009: Look at one vendor's history

**Type**: short
**Topic**: Vendor
**Persona**: Maya, naive first-time founder
**Goal**: "Has AWS been going up?"
**Preconditions**: NW-BASE with 6+ months of `MOCK AWS` charges rising.
**Ideal path**: 2 — Breakdown → Vendor → MOCK AWS.
**Alternate paths**: Subscriptions table row; category page Vendors list; transaction page "Merchant ›"
link; recurring page "Vendor ›" link; chat vendor breakdown card.

##### Steps
1. In Breakdown, click **Vendor**, then **MOCK AWS** → `/app/finance/vendor/<key>` shows "Monthly avg"
   (with "Last 6 full months"), "Change" (red when up, with "vs Apr"), "First seen", "Paid with", a
   Monthly spend bar chart (only from the first charge) and a Charges table with a Receipt column.
2. Read the breadcrumb → "Finance / Subscriptions / MOCK AWS" (because AWS is a subscription), or
   "Finance / Breakdown / …" for a non-subscription vendor.

---

### Stories: Subscriptions and upcoming

#### STORY-FIN-010: Find subscriptions to cancel

**Type**: medium
**Topic**: Subscriptions
**Persona**: Maya, naive first-time founder
**Goal**: "What SaaS are we paying for, and is anything redundant?"
**Preconditions**: NW-BASE including two subscriptions in the same overlap group.
**Ideal path**: 1 — read the Subscriptions table.
**Alternate paths**: chat subscriptions card (`FinanceCards.tsx:~205`), whose rows open the recurring
page instead of the vendor page.

##### Steps
1. Scroll to **Subscriptions** → a table with Vendor, Monthly, "3 mo" sparkline, Last charge, and a
   footer "5 subscriptions · $X/mo".
2. Notice the **overlaps** pill on two rows.
   - Hesitation: the pill does not say what the row overlaps with.
3. Hover or Tab to a row → a dark pill shows "Brex ••0001" (paid with); screen readers get it in the
   link's name ("MOCK Figma, paid with Brex ••0001").
4. Click a row → the vendor page opens.
5. Look for a Cancel or "mark as not a subscription" control → none exists. The founder must ask the
   agent or go to the vendor.

##### Variations
- Phone width → the "3 mo" and "Last charge" columns and the paid-with pill are hidden.

---

#### STORY-FIN-011: What bills are coming in the next 30 days?

**Type**: short
**Topic**: Upcoming
**Persona**: Maya, naive first-time founder
**Goal**: Plan cash for the next month.
**Preconditions**: NW-BASE with recurring, pending and bill items in the next 30 days.
**Ideal path**: 1 — read Upcoming.
**Alternate paths**: none found.

##### Steps
1. Read **Upcoming · 30 days** → a total "~$X", then rows of date(s), name, a tag (`recurring`,
   `pending` or `bill`), amount, and a chevron. Weekly items show "×4".
2. Click a `recurring` row → `/app/finance/recurring/<key>` shows Cadence, Next, Expected, Vendor ›,
   and Past charges.
3. Click a `pending` row → the transaction page opens.
4. Click a `bill` row → a small popover opens in place: the bill name, "Brex bill, not paid yet",
   Amount, Due (with "(overdue)" when past due) and Status (`Finance.tsx:~711-734`).
   - Hesitation: a bill has no page of its own and no link to pay it from here.

---

### Stories: Transactions and receipts

#### STORY-FIN-012: Check one charge and find its receipt

**Type**: medium
**Topic**: Transactions
**Persona**: Maya, naive first-time founder
**Goal**: "My accountant asks for the receipt for the Figma charge."
**Preconditions**: NW-BASE: a Brex `MOCK Figma` charge with `hasReceipt` and an image receipt.
**Ideal path**: 3 — find the charge, open it, open the receipt.
**Alternate paths**: vendor page Charges table (receipt icon column); Spend page; month page; category
Recent; account detail; chat transactions card rows.

##### Steps
1. Open **Breakdown → Vendor → MOCK Figma** → the Charges table shows a receipt icon on the row.
2. Click the row → the transaction page title is the counterparty ("MOCK Figma"); the amount is large;
   below are Merchant ›, Date, Status, Source "MOCK Brex Card ••0001", Cardholder, Category ›, Memo,
   and **Open in Brex** (`FinanceTransaction.tsx:~154-222`).
3. Click the receipt thumbnail → `/app/finance/receipt/<id>` shows the image and **Open receipt**.

##### Variations
- Wanting to change the category → no control exists.
- The row you clicked shows at once from the list while the rest loads.

---

#### STORY-FIN-013: A Mercury charge with no known receipt

**Type**: short
**Topic**: Receipts
**Persona**: Maya, naive first-time founder
**Goal**: Find out if a receipt exists.
**Preconditions**: NW-BASE: a Mercury spend transaction, one with an attachment upstream and one
without.
**Ideal path**: 2 — open the transaction, click Check for receipt.
**Alternate paths**: none found.

##### Steps
1. Open the Mercury transaction → the Receipt section shows **Check for receipt**.
2. Click it → the button is disabled while checking, then a thumbnail shows (found) or "No receipt"
   (not found).

##### Edge Cases
- The check fails for a reason other than "not found" → the button comes back with no error text.

---

#### STORY-FIN-032: See transactions grouped by vendor

**Type**: short
**Topic**: Transactions
**Persona**: Maya, naive first-time founder
**Goal**: "Twelve rows of Gusto is noise. Show me one line per company."
**Preconditions**: NW-BASE; the browser has never chosen "By vendor".
**Ideal path**: 1 — click By vendor.
**Alternate paths**: the same choice on the month, category, recurring, account and spend pages.

##### Steps
1. Open `/app/finance/spend?period=quarter` → the table has two small buttons, **List** (selected) and
   **By vendor**, in the card header.
2. Click **By vendor** → one row per vendor with "12 transactions", the category (or "Mixed"), and
   the total; a chevron points right. The Date and Status headings go blank.
   - Hesitation: the total is signed (money out has no sign, money in has "+"), and a vendor paid in
     two currencies shows as two rows.
3. Click the `MOCK Gusto Payroll` row → it opens in place and lists its transactions in the normal row
   style; click one → the transaction page.
4. Reload the page → **By vendor** is still selected (the choice is saved on this device).

##### Edge Cases
- Another browser or device starts on **List**; the choice is not part of the account.
- A page with no rows says "No transactions in this period" (account page: "No transactions on this
  account yet").

---

### Stories: Accounts

#### STORY-FIN-014: Look at one account and the card balance

**Type**: medium
**Topic**: Accounts
**Persona**: Maya, naive first-time founder
**Goal**: "How much do we owe on the Brex card, and how much does Treasury earn?"
**Preconditions**: NW-BASE.
**Ideal path**: 2 — open Accounts, click the account.
**Alternate paths**: dashboard "Treasury yield" card links to Accounts; source chip "Mercury" opens
`/app/finance/accounts?source=mercury`; Burn page "By account" rows.

##### Steps
1. Click **Accounts** (top right on the dashboard) → Total cash, Card balance owed, Total balance chart
   with period tabs, Cash accounts with "••last four" and "4.1% yield" pill, and "Card balance owed"
   list. An **Add account** button sits in the page title row.
2. Click **MOCK Treasury ••7730** → Balance, Yield, a Balance chart, a Yield table (Month, Dividends,
   Fee, Net), and Transactions.
   - Hesitation: Transactions shows only the newest rows with no "See more".
3. Click **← Accounts**, then the **Mercury** chip on the dashboard → the Accounts page with a
   "Mercury ×" badge. Click the badge → the filter clears.

##### Edge Cases
- Brex connected but sharing no card balance → "Card balance owed — … Brex does not share it".

---

#### STORY-FIN-033: Open Brex spend from a source filter

**Type**: short
**Topic**: Accounts
**Persona**: Maya, naive first-time founder
**Goal**: "I only want to see what we put on the Brex card."
**Preconditions**: NW-BASE.
**Ideal path**: 2 — click the Brex chip, click Brex spend.
**Alternate paths**: Burn page "By account" → Brex row (`FinanceBurn.tsx:~160`).

##### Steps
1. On the dashboard click the green-dot **Brex** chip → `/app/finance/accounts?source=brex` titled
   "Accounts" with a "Brex ×" badge. The chart is hidden and the cash KPI reads "Brex cash".
2. Read the KPIs → "Brex spend — This month". Click it → `/app/finance/spend?period=month&source=brex`
   with a "Brex ×" badge on the title.
3. Click the badge → the filter clears and the Spend page shows all spend.
4. Try `/app/finance/accounts?source=chase` → the full list with a badge "Unknown source: chase ×";
   clicking it clears the filter.

##### Edge Cases
- Wallets and exchanges are left out of any source-filtered view.

---

### Stories: Crypto

#### STORY-FIN-015: Should crypto count as cash?

**Type**: short
**Topic**: Crypto and runway
**Persona**: Maya, naive first-time founder with a treasury Safe
**Goal**: "Count our USDC in runway, but not ETH."
**Preconditions**: NW-CRYPTO.
**Ideal path**: 2 — open the runway control, choose Stablecoins only.
**Alternate paths**: same control on Accounts (`FinanceAccounts.tsx:~296`) and Runway
(`FinanceBurn.tsx:~262`).

##### Steps
1. On **Runway**, click **Count crypto** → it saves "all crypto" at once. The label changes to
   "Counting all crypto ▾".
   - Hesitation: one click immediately counts volatile tokens; there is no choice first.
2. Open the menu and choose **Stablecoins only** → runway and Cash reload; a Cash list shows Bank,
   Stablecoins ("· not in runway" when off), Other crypto, In runway.
3. Return to the dashboard → the Cash subtitle shows "3 bank accounts + stablecoins" and a "Crypto"
   KPI shows "Stablecoins in runway". Hovering Runway shows "Bank only: 7.9 mo".

##### Edge Cases
- The Count crypto button only shows when there is crypto to count (`hasCrypto`).
- Saving fails → a red line under the button and the choice does not change.

---

#### STORY-FIN-016: Add, rename and remove a wallet and an exchange

**Type**: medium
**Topic**: Crypto
**Persona**: Maya, naive first-time founder
**Goal**: Track the company Safe and the Kraken account, and remove an old wallet.
**Preconditions**: NW-CRYPTO. A Kraken stub that accepts a mock key.
**Ideal path**: 4 — Add wallet, paste address, Add; Remove via menu.
**Alternate paths**: Add account dialog → Wallet or Coinbase/Kraken; Integrations tiles for
Kraken/Coinbase "Connect".

##### Steps
1. Open **Crypto** (the Crypto KPI) → "Updated …", Wallets total, rows with type and "2 of 3", a
   Coinbase section, "Balance over time", Chains, Holdings.
2. Click **Add wallet** → enter `mock-ops2.eth`, label "MOCK Ops 2", type Personal → **Add**.
3. Use the "…" menu (aria-label "Actions for MOCK Ops 2") → **Edit** → change the label → **Save**.
4. "…" → **Remove** → "Remove MOCK Ops 2?" → **Remove**.
5. Go to **Accounts → Add account → Kraken** → enter API key and Private key → **Connect** → Kraken
   shows under Crypto.

##### Edge Cases
- Add the same address twice → "That wallet is already added".
- Unknown ENS → "That ENS name was not found".
- A wallet read that failed shows its error in red at the top of the Crypto page.

---

#### STORY-FIN-035: Wallets without any API key

**Type**: short
**Topic**: Crypto
**Persona**: Maya, naive first-time founder
**Goal**: "I don't have a Blockscout account. Can I still see my wallet?"
**Preconditions**: NW-CRYPTO, no Blockscout key saved.
**Ideal path**: 1 — read the Crypto page.
**Alternate paths**: Integrations → Blockscout tile → menu → Add API key.

##### Steps
1. Open **Crypto** → balances load. A note says "Wallet balances are read from public networks and
   need no key. The Finance agent uses a Blockscout API key, if you add one, for wallet lookups." and
   a button **Add Blockscout API key** (`FinanceCrypto.tsx:~182`).
   - Hesitation: "Blockscout" and "API key" mean nothing to Maya; she cannot tell if the button is
     required.
2. Ignore the button → nothing is blocked.
3. Open Integrations → the Blockscout tile reads "Connected" with **Open Finance** and a "…" menu with
   **Add API key**; the Alchemy tile says "Optional faster balance reads".

---

### Stories: Statements

#### STORY-FIN-017: Upload this month's statement when reminded

**Type**: short
**Topic**: Statements
**Persona**: Maya, whose second bank has no integration
**Goal**: Keep a non-integrated bank current.
**Preconditions**: NW-STATEMENT; file `mock-firstbank-2026-09.csv`.
**Ideal path**: 2 — click Upload, drop the file.
**Alternate paths**: Accounts → Add account → Upload statements.

##### Steps
1. See the banner "Upload the September statement for MOCK First Mock Bank ••5502" (with "+1 more" when
   several are due) → click **Upload**. The dialog opens straight on "Upload statements".
2. Drop the CSV → "Reading…" then a group with period, "opening → closing", "N transactions", "The
   transactions read add up to the closing balance", and "Imported". Earlier statements of the same
   account are listed too.
3. Click **Done** → the banner goes away and totals change.

---

#### STORY-FIN-018: Upload the wrong files

**Type**: medium
**Topic**: Statements
**Persona**: Maya, naive first-time founder
**Goal**: Upload whatever is in the downloads folder.
**Preconditions**: NW-STATEMENT; files `notes.docx`, an oversized PDF, and
`mock-firstbank-2026-08.pdf` with a $12.40 mismatch.
**Ideal path**: 2 — open upload, drop files.
**Alternate paths**: none found.

##### Steps
1. Drop all three → `notes.docx` shows "Upload a PDF, CSV, OFX or QFX file" with **Dismiss**; the large
   file shows "The file is too large".
2. The mismatched PDF is not imported. It waits in a group with a red "Transactions are $12.40 off the
   closing balance", a bold "Read by an AI model…" warning, and two buttons: **Import anyway** and
   **Discard**.
   - Hesitation: "off the closing balance" does not tell Maya which side is wrong. She cannot open the
     file from here to check.
3. Click **Discard** → the row disappears and totals stay as they were. (Or **Import anyway** → it
   shows "Imported" with a **Remove** button.)
4. Close the dialog and reopen Upload statements → earlier imports and any statement still waiting for
   review are listed again, grouped by account.

##### Edge Cases
- A file the server cannot read ("Could not read this file") is discarded server-side and shows a
  red line with **Dismiss**.

---

#### STORY-FIN-034: Rename a statement account

**Type**: short
**Topic**: Statements
**Persona**: Maya, naive first-time founder
**Goal**: "The account is called 'First Mock Bank' from the PDF. I call it 'Backup bank'."
**Preconditions**: NW-STATEMENT.
**Ideal path**: 2 — open the account, click Rename.
**Alternate paths**: none found.

##### Steps
1. Open **Accounts → MOCK First Mock Bank ••5502** → a **Rename** button sits at the end of the title.
   A Mercury account has none.
2. Click **Rename** → a dialog with the current name; type "Backup bank" → save.
3. The title, the Accounts list and Cash all show "Backup bank ••5502".

##### Edge Cases
- Open a Mercury account and look for Rename → no such button (a synced account keeps the bank's name).

---

### Stories: Errors and wrong links

#### STORY-FIN-023: Follow a broken or old link

**Type**: short
**Topic**: Errors
**Persona**: Maya, naive first-time founder
**Goal**: Open a link a teammate pasted.
**Preconditions**: NW-BASE.
**Ideal path**: 1.
**Alternate paths**: none found.

##### Steps
1. Open `/app/finance/transaction/does-not-exist` → "Not found / This page doesn't exist or was
   removed." under a Back button (no retry control).
2. Open `/app/finance/budget` → the same "Not found" page with a "← Finance" button.
3. Open `/app/finance/accounts?source=chase` → the full Accounts list with a badge "Unknown source:
   chase ×".

##### Edge Cases
- The server is down (not a missing item) → a red error with **Try again**.

---

### Stories: Hide amounts

#### STORY-FIN-024: Hide the numbers before someone looks at my screen

**Type**: short
**Topic**: Hide amounts
**Persona**: Maya, naive first-time founder
**Goal**: "My co-founder's friend is sitting next to me. I don't want him seeing our bank balance."
**Preconditions**: NW-BASE, Hide amounts off.
**Ideal path**: 1 — click the eye icon next to the page title.
**Alternate paths**: the account-menu row "Hide amounts" (FIN-025).

##### Steps
1. Open **Finance** → in the title row, left of "Updated 2 hours ago", is a small eye icon (aria-label
   "Hide amounts", `HideAmountsToggle.tsx:11-35`, placed at `Finance.tsx:378`).
   - Hesitation: it is an icon with no text. Maya does not know what it does until she hovers.
2. Hover (or focus) the icon → a tooltip: "Hide amounts. Hides amounts on finance screens and masks
   currency amounts in chat text. Plain numbers in agent replies may still show."
3. Click it → the icon turns into a crossed-out eye (aria-label now "Show amounts", pressed). Cash reads
   "$•••", Monthly burn "$•••", Runway "••• mo" with the date line "Until •••", the spend total
   "$•••", the change "↓ •••%", the Breakdown rows and Upcoming amounts "$•••", and the Subscriptions
   footer "5 subscriptions · $•••/mo".
   - Hesitation: the page changes instantly with no message saying amounts are hidden; only the icon
     shows it.
4. Click the icon again → every number comes back at once, with no reload.

##### Variations
- Cash hover (with crypto): the Bank / Stablecoins / Other crypto / Total rows show "$•••".

##### Edge Cases
- Dollar signs stay and digits never show: the mask is a fixed "•••", so a $9 line and a $1.6M line
  look the same (`finance-format.ts:5`).

---

#### STORY-FIN-025: Turn it on from anywhere in the app

**Type**: short
**Topic**: Hide amounts
**Persona**: Maya, naive first-time founder
**Goal**: "I'm in a chat, not on Finance. I want the numbers hidden before I open the agent."
**Preconditions**: NW-BASE; she is on the Home or chat screen.
**Ideal path**: 2 — open the account menu, click Hide amounts.
**Alternate paths**: the eye icon on Finance, Cap table and every Finance detail page.

##### Steps
1. Click her name and initials at the bottom of the left sidebar (the account menu).
2. Find the row **Hide amounts** with a small grey line "Hides amounts on finance screens and masks
   currency amounts in chat text. Plain numbers in agent replies may still show." and click it
   (`Shell.tsx:4118`).
   - Hesitation: the row sits between Settings and Usage, in a menu she opened for something else; she
     only finds it by reading.
3. The menu closes. The row now reads **Show amounts**. Open Finance → the eye icon is already
   crossed out and every amount is masked.

##### Variations
- The eye button on a detail page (for example `/app/finance/burn`) is in the back/breadcrumb row,
  between the trail and the Ask button (`ui.tsx:232`). Toggling there is the same switch.
- Cap table has its own eye icon in its title row (`CapTable.tsx:589`).

---

#### STORY-FIN-026: Does it remember? Reload, sign out, another device

**Type**: medium
**Topic**: Hide amounts
**Persona**: Maya, naive first-time founder
**Goal**: "I turned it on yesterday. Will it still be hidden when I open my laptop?"
**Preconditions**: NW-BASE, Hide amounts on in this browser.
**Ideal path**: 2 — reload the page and check.
**Alternate paths**: none found.

##### Steps
1. With amounts hidden on `/app/finance`, press reload → the page loads and the amounts are masked from
   the first paint; the icon is the crossed-out eye. The choice is saved in this browser's local
   storage as `rakazo.hideAmounts = on` (`hide-amounts-preference.ts:3-34`).
2. Close the browser, open it tomorrow → still hidden.
3. Open Praci on her phone or another computer → amounts are **shown**. The choice is per browser,
   not per account, and not synced.
   - Hesitation: she assumed "my account" remembers it. On a new device the numbers are visible until
     she clicks the icon.
4. Open Finance in a second tab of the same browser while the first is open, then toggle in tab 2 →
   tab 1 still shows the old state until she reloads it (there is no cross-tab listener).
5. Sign in as a different person in the same browser → the choice stays (the key is not per user).

##### Edge Cases
- The browser blocks storage (private window, blocked site data) → the switch works for this session
  only (kept in memory) and is lost on reload; no message says so.
- A first visit has no saved value → amounts are shown.
- Turning it off writes `off`, so it does not come back by itself.

---

#### STORY-FIN-027: Look at the detail pages while hidden

**Type**: medium
**Topic**: Hide amounts
**Persona**: Maya, naive first-time founder
**Goal**: "I'm walking my accountant through the burn and the AWS charges, but I don't want the
amounts to show up on the shared screen yet."
**Preconditions**: NW-BASE, Hide amounts on.
**Ideal path**: 4 — Burn, a month, a vendor, a charge.
**Alternate paths**: none found.

##### Steps
1. Open **Burn** → the KPI is "$•••"; the chart axis labels read "$•••"; hovering a bar shows an
   aria-label like "Oct: $•••"; the By month table shows "$•••" for Out and In and "+$•••" / "−$•••" for
   Net (the sign still shows); "By account" shares read "•••%".
   - Hesitation: the bars still have their heights. Anyone can see that August was far taller than
     July even though no dollar figure shows.
2. Click **August 2026** → Out, In, Net are masked; the Categories list shows names with "$•••"; the
   Transactions table shows dates, merchant names and "$•••" amounts. Merchant names, categories,
   memo text and dates are not masked.
3. Open the **MOCK AWS** vendor → Monthly avg "$•••", Change "↑ •••%", First seen and Paid with are
   still visible, the monthly chart bars keep their shape with masked value labels.
4. Open a charge with a receipt → the receipt thumbnail is replaced by a plain document icon; click it
   and `/app/finance/receipt/<id>` says "Receipt hidden while amounts are hidden" (an invoice image
   would show the amount). The **Open receipt** button is not shown.
5. Open **Runway** → Cash and Monthly burn are masked, Runway reads "•••", Run-out reads "•••" and the
   projected-month labels on the chart are masked; the history labels stay.

##### Edge Cases
- Transaction memo: `Invoice 4417 — $4,200 deposit` is shown in full, because Finance pages mask the
  numeric fields, not free text from the bank (see Suspected problems).
- Token quantities on the Crypto page ("1,240.5 USDC") read "•••"; token symbols and chain names stay.
- Statement dialog: opening and closing balances and the "$12.40 off" line are masked; the file period
  and "12 transactions" stay.

---

#### STORY-FIN-028: Crypto and accounts while hidden

**Type**: short
**Topic**: Hide amounts
**Persona**: Maya, naive first-time founder with a treasury Safe
**Goal**: Show the team the wallets without the balances.
**Preconditions**: NW-CRYPTO, Hide amounts on.
**Ideal path**: 2 — open Accounts, open Crypto.
**Alternate paths**: none found.

##### Steps
1. Open **Accounts** → Total cash and Card balance owed read "$•••"; each account row shows "$•••"; the
   yield pill reads "••• % yield"-style masked text (`percentFigure`); the Crypto group lists wallet
   and exchange names with "$•••".
2. Open **Crypto** → the Wallets total is "$•••"; the Holdings table shows symbols and chains but
   balances read "•••" and values read "$•••"; "1 unpriced" still shows.
3. Click the Coinbase section → asset balances and values are masked.

##### Edge Cases
- Wallet addresses, ENS names and labels are not masked.

---

#### STORY-FIN-029: Cap table and chat while hidden

**Type**: medium
**Topic**: Hide amounts
**Persona**: Maya, naive first-time founder
**Goal**: "Hide means hide everywhere, right? Even in the agent chat and the Cap table?"
**Preconditions**: NW-HIDDEN, Hide amounts off to start.
**Ideal path**: 3 — toggle, open Cap table, open the Finance agent.
**Alternate paths**: none found.

##### Steps
1. On Finance, click the eye icon (hide on).
2. Open **Cap table** → the eye icon in its title row is also crossed out. Share counts read "•••",
   dollar values "$•••", and percentages "•••%" (`usdFigure`, `shareCount`, `percentFigure`).
3. Go back to Finance and click **Ask** → the Finance agent panel opens. The earlier turn's finance
   cards show "$•••" for Cash and Monthly burn, "••• mo" for Runway, and tables show "$•••".
4. Read an agent text reply that said "We have $1.62M in cash and 7.9 months of runway" → it reads
   "We have $••• in cash and 7.9 months of runway". The month count is **not** masked, because only
   currency amounts in text are masked.
   - Hesitation: the tooltip warns "Plain numbers in agent replies may still show", but Maya does not
     expect runway to be shown when cash is hidden.
5. Scroll to the chart message → it shows "Chart hidden while amounts are hidden" instead of a plot.
6. Look at the chat list preview, a reply quote and the browser notification text for the last
   message → currency amounts are masked there as well. Copying a message copies the masked text.
7. Click the eye icon again → text, cards and the chart come back without reloading.

##### Variations
- Search the space for "invoice" → result labels with dollar amounts are masked.
- Data room previews of images hide while amounts are hidden.

##### Edge Cases
- Stored messages are never changed; only the display is masked.

---

#### STORY-FIN-030: Hide amounts on a phone

**Type**: short
**Topic**: Hide amounts
**Persona**: Maya, naive first-time founder (iPhone, 390 px wide)
**Goal**: "I'm on the train, I want to check cash without the whole carriage reading it."
**Preconditions**: NW-BASE, Hide amounts off, phone width.
**Ideal path**: 2 — open Finance, tap the eye icon.
**Alternate paths**: the account menu in the mobile sidebar.

##### Steps
1. Open **Finance** on the phone → the eye icon in the title row has a larger touch target
   (40 px, `pointer-coarse:size-10`).
2. Tap it → amounts mask. There is no hover, so the explanation tooltip does not appear.
   - Hesitation: without the tooltip, Maya never reads the warning that plain numbers in agent
     replies can still show.
3. Open the sidebar menu, tap her name at the bottom, and see **Hide amounts** / **Show amounts** with its
   helper line, which does show on touch.
4. Open Burn on the phone → the eye icon wraps with the back button and Ask on the first line, with
   the breadcrumb on its own line.

##### Edge Cases
- Charts keep their shape on the phone too.

---

#### STORY-FIN-031: Hide amounts with the keyboard only

**Type**: short
**Topic**: Hide amounts
**Persona**: Maya, naive first-time founder (keyboard and screen reader)
**Goal**: Turn the switch on without a mouse.
**Preconditions**: NW-BASE.
**Ideal path**: 2 — Tab to the icon, press Enter.
**Alternate paths**: none found.

##### Steps
1. Press Tab from the page start on `/app/finance` until focus reaches the eye button → a visible focus
   ring; a screen reader says "Hide amounts, toggle button, not pressed".
2. Press Enter or Space → "Show amounts, toggle button, pressed"; amounts are masked.
3. Press Tab again → focus moves on to the refresh button (the eye keeps focus after being pressed).
4. Look for a shortcut such as a key combination to flip the switch from anywhere → none exists.
5. In the account menu, Tab to **Hide amounts** and press Enter → the same switch flips and the menu
   closes.

##### Edge Cases
- Screen readers read masked amounts as "dollar sign, bullet bullet bullet", with no spoken hint that
  an amount is hidden.

---

### Stories: Long end-to-end stories

#### STORY-FIN-019: First morning with Finance

**Type**: long
**Topic**: End to end
**Persona**: Maya, naive first-time founder
**Goal**: Connect both banks and understand cash, burn, runway and the biggest costs before a board
call.
**Preconditions**: NW-EMPTY, Mercury and Brex OAuth stubs that load NW-BASE data.
**Ideal path**: 8 — Finance, Add account, Mercury, approve, Add Brex, approve, read KPIs, open
Breakdown top row.
**Alternate paths**: connect both from Integrations.

##### Steps
1. Click **Finance** → "No accounts yet" empty state.
2. **Add account → Mercury** → approve → dashboard syncs.
3. Click **Add Brex** in the header → lands on Integrations, not a dialog.
   - Hesitation: the founder thinks they left Finance.
4. Click **Connect** on Brex → approve → tile shows **Open Finance**.
5. Click **Open Finance** → Brex chip shows; "Add Brex" is gone.
6. Read Cash, Monthly burn, Runway, and the bold spend total.
7. Click **Runway** → read Run-out and the list of what counts.
8. Click **← Finance** → Breakdown → **Payroll** → category page.
9. Click a vendor → vendor page → click one charge → transaction page.
10. Use breadcrumbs to go back to Finance.
11. Open **Burn → By month** and compare the last three months.
12. Click **Accounts** → confirm "Card balance owed — Not counted in cash".
13. Return and click **Refresh** to see "Updated just now".
14. Click **Ask** (top right) → the panel opens and says it is creating the Finance agent (a
    disabled **Create Finance agent** button while creating); once ready it offers two questions: "What
    is our runway?" and "Where did spend go up this month?".
15. Type "Summarize cash, burn and runway for my board call" → finance cards show in the chat.
16. Compare the chat card's Runway with the dashboard's.
    - Hesitation: the card now shows one decimal like the dashboard ("7.9 mo"), so they match; the
      first-timer may still look for a way to share the page.

---

#### STORY-FIN-020: Write an investor update that includes crypto

**Type**: long
**Topic**: End to end with crypto
**Persona**: Maya, naive first-time founder
**Goal**: Report cash with and without stablecoins and the biggest cost changes.
**Preconditions**: NW-CRYPTO with Finance agent created.
**Ideal path**: 6.
**Alternate paths**: answer only from the agent.

##### Steps
1. Open Finance → Crypto KPI shows; hover Cash for Bank / Stablecoins / Other crypto / Total incl.
   crypto.
2. Open **Crypto** → check Holdings; an unpriced token shows "—" and "1 unpriced".
3. Open **Runway → Count crypto → Stablecoins only**.
4. Back on the dashboard, hover Runway → "Bank only: X mo".
5. Open **Breakdown → Vendor**; note vendors with red Change.
6. Open the vendor pages for the top 2 risers.
7. Click **Ask** → "Draft an investor update: cash bank-only and with stablecoins, runway, top 3 cost
   increases."
8. Hover a finance card → click **Ask about this** → the composer quotes that message; ask a
   follow-up.
9. Click a card row → the matching Finance page opens.
10. Ask the agent to "Move $50k from checking to treasury" → it replies it cannot move money.
11. Turn counting back off with **Don't count crypto**.

---

#### STORY-FIN-021: Track a bank that has no integration

**Type**: long
**Topic**: End to end with statements
**Persona**: Maya, naive first-time founder
**Goal**: Get a second bank into totals and keep it current.
**Preconditions**: NW-EMPTY plus statement files for 3 months of `MOCK First Mock Bank`.
**Ideal path**: 4.
**Alternate paths**: none found.

##### Steps
1. Finance → **Add account → Upload statements**.
2. Drop 3 monthly files → one group "MOCK First Mock Bank ••5502" with a "New account" badge and
   three rows.
3. Click **Done** → the dashboard now shows KPIs (statement accounts count as data).
4. Open **Accounts** → the statement account is listed.
5. Open it → balance chart and transactions show. There is no Yield table. A **Rename** button is in
   the title row.
6. Next month, see the reminder banner → **Upload**.
7. Open the Upload dialog again → the three earlier statements are listed with **Remove**; this is
   where a bad month is removed.
8. Look to delete the account itself → no control exists; removing every statement is the only way.
9. Ask the agent "Which statements have I uploaded?".

---

#### STORY-FIN-022: Monthly review with the agent, pins and a reconnect

**Type**: long
**Topic**: Agent, pins, reconnect
**Persona**: Maya, naive first-time founder
**Goal**: Run the month-end close checklist and fix a broken bank link.
**Preconditions**: NW-RECONNECT + NW-AGENT.
**Ideal path**: 6.
**Alternate paths**: open "Finance agent" from the sidebar bot list (see Suspected problems).

##### Steps
1. Open Finance → the Mercury chip has a yellow dot. Click it → Integrations.
   - Hesitation: the chip has no "Reconnect" text, only an aria-label.
2. On the Mercury tile ("Reconnect" badge) click **Reconnect** → approve.
3. Click **Open Finance** → green dot.
4. Click **Ask** → the panel shows the thread with "3 finance lookups" collapsed. Expand it.
5. Look for the "Month-end close" checklist and the Cash/Runway pins → they are not shown in the
   Finance side panel.
6. Find **Finance agent** in the sidebar bot list → open it → the pins strip and List button show.
7. Tick "Reconcile Brex" on the checklist.
8. Ask the agent to "update the Runway pin" → click the pin refresh.
9. Return to Finance → the panel is closed again (it starts closed every visit).
10. Turn Hide amounts on, then open the Finance agent from the sidebar → the pin strip still shows the
    real Cash and Runway values (see Suspected problems).

---

#### STORY-FIN-036: Share my screen on the board call

**Type**: long
**Topic**: Hide amounts end to end
**Persona**: Maya, naive first-time founder
**Goal**: Walk the board through the product demo on a shared screen, hide money first, then show
cash on purpose.
**Preconditions**: NW-HIDDEN, Hide amounts off.
**Ideal path**: 8.
**Alternate paths**: use only the account-menu row.

##### Steps
1. Before the call, open Finance and click the eye icon → everything masks.
2. Reload to be sure → still masked.
3. Open **Cap table** → shares, values and percentages masked.
4. Open **Burn**, **Runway**, **Spend**, **Accounts** and **Crypto** in turn → all figures show "$•••".
   - Hesitation: charts still show the rise and fall, so the board can see burn is growing.
5. Click **Ask** and ask "What is our runway?" → the reply text masks "$1.62M" but writes "7.9
   months".
6. Open the Finance agent from the sidebar → the Cash pin shows the real number (see Suspected
   problems); she collapses the pins before sharing.
7. Open the Data room, an invoice image preview → "Image hidden while amounts are hidden"; the invoice amount shown in the list is "$•••".
8. At the board's request for the cash number, she opens the account menu → **Show amounts** → all
   numbers return at once, no reload.
9. After the call she turns it on again before closing the laptop.

### Redundancy Candidates (this area)

- Two places connect a bank: the Add account dialog (Mercury, Brex) and the Integrations page; "Add
  Brex" on the dashboard goes to Integrations instead of reusing the dialog (`Finance.tsx:410-416`).
- Three controls open the same Accounts page from the dashboard: the Cash card, the Accounts button,
  and the Treasury yield card; the source chips open it filtered.
- The runway-crypto control (`CountCryptoButton`) appears on both Accounts and Runway.
- Hide amounts has three entry points (Finance-page icon, detail-page icon, account-menu row) and a
  fourth on Cap table; they flip one switch, which is fine, but the icon has no text label.
- Blockscout and Alchemy tiles both read as "wallet balances"; the key is optional for both.

### Suspected problems (this area)

1. **Pins show real amounts while Hide amounts is on.** `pages/shell/bot-pins.tsx:73` renders
   `stat.value` with no masking and imports no hide helper. The pin strip lives on the bot route
   (Cash "$1.62M", Runway "7.9 mo"), and text pins and checklist items are not masked either.
2. **Memo and counterparty text on Finance pages are not masked.** `TransactionRow` and
   `FinanceTransaction.tsx:~203` render `row.memo` and `txn.memo` as plain text; a memo like
   "Invoice 4417 — $4,200 deposit" shows in full. Chat text goes through `maskCurrencyWhenHidden`,
   Finance free text does not.
3. **Charts keep their shape.** `BurnBars`, `LineChart` and `MonthBars` draw proportional bars
   and lines (`charts.tsx`), masking only the labels and aria-labels, so relative size and trend stay
   visible. The chat chart is the only one replaced entirely ("Chart hidden while amounts are hidden").
4. **No keyboard shortcut and no cross-tab update.** The preference store has only in-process
   listeners (`hide-amounts-preference.ts:36-46`); another open tab keeps showing amounts until it is
   reloaded. A user who flips it in a hurry in one tab may think it is on everywhere.
5. **Per browser, not per account.** The key `rakazo.hideAmounts` is global to the browser; a second
   device starts with amounts shown and signing in as someone else keeps the previous choice.
6. **Tooltip is the only explanation, and the warning never reaches phones.** "Plain numbers in agent
   replies may still show" is in a hover tooltip (`HideAmountsToggle.tsx:34`); on touch it is only in
   the account-menu row. Months of runway in an agent reply still show with cash masked.
7. **Storage failure is silent.** If `localStorage` throws, the choice lasts only for the session and
   nothing tells the user (`hide-amounts-preference.ts:25-31`).
8. **Run-out and "Until <month>" are masked, but the Runway chart's solid history labels are not**
   (`FinanceBurn.tsx:~278` masks only projected months). That is intended but means past month
   labels still reveal how long the history is.
9. **Cash subtitle does not name the accounts** ("3 bank accounts"), and "1 non-USD not counted" has
   no link to the transaction (`Finance.tsx:~395`).
10. **Pins are not shown in the Finance side panel**, and the Finance agent still appears in the
    sidebar bot list, so the same agent has two homes with different features (`Shell.tsx:3090`,
    `:4286`: pins render only when `!pageMode`).
11. **Dashboard "Add Brex" leaves Finance** for Integrations; there is no way back except the sidebar.
12. **No disconnect, no cancel, no recategorize**: the Finance area is read-only apart from
    statements, wallets, the runway scope and renaming a statement account.
