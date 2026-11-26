# Stories: Business pages (Finance, Legal, Cap table, Hide amounts)

Status: written from the built SwiftUI code in `apps/ios/Sources/Praci` (Finance, Legal, CapTable, Home, Settings). Nothing was run on a device for this pass, so each step says what the code does, not what was observed. All names and figures below are invented. This file replaces the plan-era stories in `finance-legal.md` for these three pages and Hide amounts; Data room is not covered here.

Facts that apply to every story:

- Entry is a row under "Pages" on Home (`pageFinance`, `pageLegal`, Cap table). `boot.me.hiddenPages` removes a row. All three push onto the single `NavigationStack`.
- Every "Connect" or "Add your OpenRouter key" button only sets `app.showingSettings = true`. It opens the Settings sheet at its top level; it never deep-links to Integrations or Models.
- Hide amounts is one server preference (`preferences/update`). Each page reads it once when it loads, in its own model (`FinanceModel`, `LegalModel`, `CapTableModel`).
- The mask is the fixed string "•••". Runway hidden shows "•• mo".

---

## STORY-001: Check runway, cash and burn on Finance
**Type**: short
**Topic**: Business pages
**Persona**: Priya Anand, founder of a 4-person seed company, glancing at money before a board call
**Goal**: Read runway, cash and monthly burn.
**Preconditions**: Mercury connected, last sync succeeded, Hide amounts off.
**Ideal path**: 2 — Home "Finance" row, read the top card.
**Alternate paths**: Ask the Finance agent in a thread (answer arrives as a message, not on this page). Push notification routing to this page is not confirmed in the code read for this pass.

### Steps
1. On Home, tap "Finance" under Pages → Finance pushes with an inline title; a spinner shows while four calls run (`finance/overview`, `accounts`, `burn`, `me`).
2. Read the first section → "Runway now 14 mo", "Cash today $412,000", "Monthly burn $29,000". Footer reads "Synced 5 minutes ago".
3. Scroll → "Monthly burn, 12 months" bar chart (the latest partial month is drawn at 40% opacity), "Accounts" (each with provider as subtitle), "Upcoming" (name plus first date), then the Spend section.

### Variations
- Runway unknown: shows "—".
- A non-USD account: its subtitle reads "Mercury, Not counted in cash" and the Spend footer reads "2 non-USD transactions not counted".
- No burn history: the chart section is omitted.

### Edge Cases
- First load fails: error state with Retry (`LoadableView`).
- Reload fails after data was shown: figures stay and the footer turns red, "Sync failed. <message>".

---

## STORY-002: Browse spend by period and open a transaction
**Type**: medium
**Topic**: Business pages
**Persona**: Marcus Webb, operations lead reconciling a card charge
**Goal**: Find a specific charge and see its detail.
**Preconditions**: Finance has accounts and transactions.
**Ideal path**: 4 — open Finance, pick period, tap the row, read detail.
**Alternate paths**: none found (no search, filter or sort on the transaction list).

### Steps
1. Open Finance and scroll to the Spend section → segmented "Period" control: Week, Month, Quarter, Year (Month is selected).
2. Tap "Quarter" → `finance/spend` reloads; "Where it went" lists categories with totals; "Transactions" lists rows with counterparty, "Oct 16 · Software · Pending", and a signed amount (money in has a "+").
3. Tap the "Northwind Cloud" row → detail pushes, titled with the vendor name. Rows: Amount (exact cents), Date, Status, Category, Account, Card "•• 4821", Cardholder, Subscription "Yes", Receipt "Attached" or "None". A Memo section appears when present.
4. Tap Back → list and period selection are kept.

### Variations
- Detail load fails: error with Retry; the list is unaffected.
- Hide amounts on: the detail Amount shows "•••".

### Edge Cases
- The spend call fails: `errorMessage` is set and shows in the top footer, far from the Period control the user just touched.
- Receipt says "Attached" but there is no way to open it on iOS.
- Rows have no swipe or context actions.

---

## STORY-003: Pull to refresh Finance and recover from a failed sync
**Type**: medium
**Topic**: Business pages
**Persona**: Priya Anand, who just paid a vendor and wants it reflected
**Goal**: Pull fresh numbers from Mercury or Brex.
**Preconditions**: Finance loaded earlier.
**Ideal path**: 1 — pull down.
**Alternate paths**: leaving and re-entering the page reloads without syncing providers (only `load`, not `finance/refresh`).

### Steps
1. Pull down on the Finance list → `finance/refresh` runs (up to 60 seconds), then the page reloads.
2. Sync succeeds → footer "Synced just now", figures update.
3. Repeat with the provider down → the old figures stay; the footer turns red "Sync failed. <message>" even though the reload itself succeeded.
4. Pull again later → the error clears if both calls succeed.

### Variations
- Offline: both calls fail; same red footer, figures kept.

### Edge Cases
- During a long sync the only feedback is the system pull spinner; no per-provider status.
- Legal and Cap table pull to refresh only re-read the server; they do not ask Carta or the scanner to sync.

---

## STORY-004: Finance empty state, then Connect
**Type**: medium
**Topic**: Business pages
**Persona**: New founder, Dana Okafor, exploring before connecting banks
**Goal**: Connect Mercury so Finance shows data.
**Preconditions**: No Mercury or Brex connection and no cash accounts.
**Ideal path**: 3 — tap Connect, land on the Mercury connection, finish authorization.
**Alternate paths**: Home gear > Integrations > Mercury; asking the Finance agent in a thread may surface a connect card (`ConnectCardView` opens Integrations in a sheet).

### Steps
1. Open Finance → "No accounts yet", "Connect Mercury or Brex", button "Connect".
2. Tap "Connect" → the Settings sheet opens at its top level (Account, Models, Voice, Integrations, ...). The user is not taken to Integrations.
3. Tap "Integrations" → connected list and available catalog.
4. Connect Mercury → provider flow runs.
5. Tap Done (xmark) to close Settings → Finance still shows "No accounts yet". The page does not reload on sheet dismiss (its load runs from `.task` once).
6. Pull to refresh is unavailable on the empty state (no list). Leave and re-enter Finance → data loads.

### Variations
- Only a card provider connected: `isConnected` or `hasCashAccounts` is true, so the full page shows.

### Edge Cases
- User cannot tell which button gets them to Integrations: "Connect" lands on a generic Settings list.
- Step 5 is the main friction: the user finishes connecting and sees the same empty state.

---

## STORY-005: Hide amounts from the Finance toolbar
**Type**: short
**Topic**: Business pages
**Persona**: Marcus Webb, reviewing numbers on a train
**Goal**: Mask money on screen quickly.
**Preconditions**: Finance loaded, Hide amounts off.
**Ideal path**: 1 — tap the eye in the toolbar.
**Alternate paths**: Settings sheet > "Hide amounts" toggle (same server preference). Legal and Cap table have no toggle of their own.

### Steps
1. Tap the eye button (label "Hide amounts") → the icon switches to eye.slash (label "Show amounts") at once; the call goes to `preferences/update`.
2. Look at the page → cash, burn, accounts, upcoming, categories, transactions show "•••"; runway shows "•• mo"; the chart's y-axis is removed but the bars keep their heights.
3. Tap a transaction → detail Amount shows "•••".
4. Tap the eye.slash button → amounts return.

### Variations
- Server refuses: the toggle flips back and the error appears in the footer.

### Edge Cases
- Bar heights and the runway month count still reveal rough size; the mask is partial.
- Dollar figures elsewhere (Legal values, Cap table invested amounts) are not changed until those pages reload, and they never reload on a toggle made here.

---

## STORY-006: Turn on Hide amounts in Settings and check the other pages
**Type**: medium
**Topic**: Business pages
**Persona**: Dana Okafor, about to share her screen in a meeting
**Goal**: Make sure no dollar figure is visible on any business page.
**Preconditions**: Hide amounts off; Finance, Legal (with a contract that has a value) and Cap table (with an investor) loaded earlier in the session.
**Ideal path**: 2 — toggle in Settings, reopen each page.
**Alternate paths**: Finance toolbar eye (Finance only).

### Steps
1. Home > gear > toggle "Hide amounts" → switch flips; saved to the server.
2. Tap Done → the sheet closes; pages still on the stack beneath are not reloaded.
3. Go back to Home and open Legal (a fresh screen, so a fresh model) > a contract → Value shows "•••".
4. Open Cap table → holder rows show "Invested •••"; the 409A price shows "•••".
5. Read Cap table summary → "Fully diluted", "Option pool available", share counts and ownership percentages are still visible.

### Variations
- If the user toggled while a business page was already open beneath the sheet, that page keeps showing amounts until it is popped and reopened or (Finance, Legal) pulled to refresh. On Cap table a pull to refresh also re-reads the preference.

### Edge Cases
- Hide amounts hides money only; share counts and percentages are shown, which may surprise someone expecting a full privacy mode.
- The mask is the same "•••" for every value, so lists cannot be compared by width.

---

## STORY-007: Legal first scan needs a model and consent
**Type**: long
**Topic**: Business pages
**Persona**: Priya Anand, who wants contracts and deadlines pulled from the Data room
**Goal**: Run the first Legal scan.
**Preconditions**: Data room has documents; no model connected; Legal consent not granted.
**Ideal path**: 5 — open Legal, add a model key, allow reading, tap Scan now, wait.
**Alternate paths**: ask the Legal agent through "Ask Legal agent" in the toolbar (the agent then raises its own approval or connect card); Models can also be reached from Home "Connect a model" banner when `needsModel` is true.

### Steps
1. Open Legal → tabs "Contracts" and "Deadlines"; the status section shows "Add your OpenRouter key" with the footer "Scanning needs a model." Below, the Contracts tab shows "No contracts yet — Scan the Data room to find contracts."
2. Tap "Add your OpenRouter key" → the Settings sheet opens at its top level (not at Models).
3. Tap "Models", add the key, then Done → Legal still shows the blocker (the page does not reload on dismiss).
4. Leave and reopen Legal (or pull to refresh) → the blocker is gone. The section now reads "Allow Legal to read documents" with the disclosure text, recipients, and "Allow".
5. Tap "Allow" → consent granted; the status section becomes "Last scan: Not scanned yet" and a "Scan now" button.
6. Tap "Scan now" → "Scanning…" with a spinner; the page polls the overview until the run finishes.
7. Scan ends → contracts appear grouped by type; the footer may say "6 Data room documents not yet checked" if some were not reached.

### Variations
- Scan fails: a red line shows the run error, or "Last scan failed".
- Start fails: red message in its own section, e.g. the settings error text.
- Leaving the screen stops polling (`onDisappear`); returning with a scan running restarts it.

### Edge Cases
- The OpenRouter name is shown even though Models also supports other providers (OAuth, local server); the blocker text names only one.
- Two separate trips to Settings are common (model, then reload) before consent is even shown.

---

## STORY-008: Triage deadlines: Done, Undo, Dismiss, Reopen, Keep
**Type**: long
**Topic**: Business pages
**Persona**: Marcus Webb, clearing legal deadlines on Monday
**Goal**: Close the deadlines that are handled and keep the ones the scanner wants removed.
**Preconditions**: Legal scanned; open deadlines exist, some due within the due-soon window, one marked "May no longer apply".
**Ideal path**: 2 per deadline — swipe Done on the row.
**Alternate paths**: open the deadline > "Mark done"; open the contract > Deadlines section > deadline > "Mark done". "Dismiss" and "Keep this deadline" exist only on the deadline detail.

### Steps
1. Open Legal > "Deadlines" tab → "Due soon" (with a count badge), "Later", and "Done" sections. Rows show title, date, "Overdue", "Today" or "In 5 days", and the contract title.
2. Swipe a row from the right > "Done" → the row leaves at once; a banner appears at the bottom: "Marked “Renew Northwind MSA” done" with "Undo".
3. Tap "Undo" → the deadline returns. Ignore the banner → it expires after a short delay.
4. Tap a row > detail shows Due, Kind, Contract, "From the contract" quote and Notes. Buttons: "Mark done", "Dismiss", and, when removal is proposed, "Keep this deadline".
5. Tap "Keep this deadline" → detail closes; the deadline stays and the warning clears.
6. Tap "Dismiss" on another → detail closes; the row leaves (undo banner offered).
7. Scroll to "Done" and tap "Reopen" on a finished item → it returns to the open lists.

### Variations
- Server refuses a change: the row comes back and a red message shows at the top of the page.
- No open deadlines: "No open deadlines" empty state.
- "Overdue", "Today" and "In N days" text is hidden (zero opacity) for dates beyond the due-soon window; it still takes space.

### Edge Cases
- The swipe offers only Done; Dismiss needs two taps deeper.
- Done rows have no detail view, only Reopen.
- Banner text ellipsizes long titles to one line.

---

## STORY-009: Read a contract and its deadlines
**Type**: short
**Topic**: Business pages
**Persona**: Dana Okafor, checking when a vendor agreement renews
**Goal**: See renewal terms for one contract.
**Preconditions**: Legal has contracts.
**Ideal path**: 3 — Legal, tap contract, read.
**Alternate paths**: ask the Legal agent through "Ask Legal agent" (opens a bot thread).

### Steps
1. Open Legal > Contracts → rows grouped by type; each shows title, counterparties, "Ends Mar 31, 2027", and value.
2. Tap a contract → detail rows: Type, Status, Parties, Starts, Ends, "Renews Automatically", "Notice 60 days", Governing law, Value. Summary section when present.
3. Under "Deadlines" tap a deadline → the deadline detail from STORY-008.

### Variations
- Value is hidden when Hide amounts is on.
- A contract without value, dates or parties shows only the fields it has.

### Edge Cases
- The contract detail has no link to the source document in the Data room.
- The "Ask Legal agent" button is absent until the overview loads and has a bot id.

---

## STORY-010: Cap table with Carta not connected, then connected
**Type**: medium
**Topic**: Business pages
**Persona**: Priya Anand, preparing for a financing
**Goal**: See ownership by holder.
**Preconditions**: First, no Carta data; later, Carta connected and synced.
**Ideal path**: 3 — Cap table row, tap Connect Carta, finish connection (then the table shows).
**Alternate paths**: Settings > Integrations > Carta; ask the Carta agent via the toolbar button.

### Steps
1. Open Cap table → "See who owns your company" with "Connect Carta".
2. Tap "Connect Carta" → Settings sheet opens at its top level; go to Integrations.
3. Connect, tap Done → the page shows the same empty state until reopened.
4. Reopen Cap table → summary titled with the company name: Fully diluted, Option pool available, 409A, As of, and "Syncing with Carta" with a spinner while a sync runs.
5. Read "Share classes" (shares and percent) and "Holders" sorted by ownership; each row shows security, shares, "Invested $250,000" and ownership percent.
6. Tap a holder → Security, Shares, Ownership, Invested, and Contact (Organization, Email) when present.

### Variations
- Last read failed: footer "Couldn’t refresh from Carta. Showing the last sync."
- Hide amounts on: 409A and Invested show "•••".
- Pull to refresh re-reads the table; it does not start a Carta sync.

### Edge Cases
- The same empty state also appears when Carta is connected but nothing has synced yet, and still offers "Connect Carta".
- Toolbar "Ask Carta agent" appears only after the agent id loads; a failed `carta/agent` call leaves it missing without a message.
- No way to export or search holders.
