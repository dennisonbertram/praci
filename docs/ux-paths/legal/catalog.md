# UX Path Catalog: Rakazo Legal (first-time founder pass)

Generated: 2026-10-16
Total Stories: 20 (Short 8, Medium 8, Long 4)
Persona for every story: a first-time startup founder ("Alex", MOCK DEMO DATA — Northwind Robotics). Alex has never seen Rakazo, does not know words like "agent", "scan", "consent", "Data room", "node" or "Muse Spark", and wants one thing: run the company without missing a contract date.

## Read this first: where the Legal code is

- **The Legal feature is not on `docs/ux-pass` / `origin/main` (458a69e4).** `git ls-files | grep -i legal` on this branch returns nothing; there is no `/app/legal` route and no Legal sidebar item. The code exists only on `origin/feat/legal` (488048d5, not merged into main) and on the local branch `local/legal-integration` (d0dcfbf1, feat/legal merged into a local main for testing).
- Every file:line below is from `feat/legal` at 488048d5, read with `git show` / the clean files in `/Users/dennison/develop/rakazo-legal` (that worktree has an unrelated half-finished merge in other files; the Legal files match HEAD).
- **The walk can only run these stories against a build that contains feat/legal** (for example `local/legal-integration`). A demo account built from `origin/main` has no Legal page at all; in that case every story below fails at step 1, and that is the finding.
- I re-checked the prior catalog (`/Users/dennison/develop/rakazo-legal/docs/ux-paths/legal/catalog.md`, 39 stories, problems P-01 to P-30). Every line number I spot-checked still matches (Legal.tsx, LegalDeadlines.tsx, LegalContracts.tsx, LegalGraph.tsx, legal-tools.ts:340-385, db/legal.ts:1-20,85-100,155-165, api/legal.ts, legal-agent.ts). This catalog reuses those findings by ID and does not repeat their full evidence. "Prior STORY-nnn" points to the old story a new one replaces or extends.
- Nothing here was run in a browser. All expected results are read from code.

## What the mock demo account contains (from the seed), and what it lacks

Seed source: `/Users/dennison/develop/rakazo-demo/packages/testkit/src/cli/demo/data.ts` and `demo/seed.ts` (untracked files on `feat/mock-demo-env`; they moved from `packages/testkit/src/demo/` while I was reading).

Seeded and relevant to Legal:
- Data room folder **Legal** with four PDFs: `MOCK Master Services Agreement - Halcyon Logistics.pdf` (term 24 months, liability cap 1x fees, termination for convenience on 60 days notice), `MOCK Mutual NDA - Acme Ventures.pdf` (term 3 years), `MOCK Office Lease - 100 Placeholder Street.pdf` (rent 7500 dollars a month, "Renewal date 31 January. Notice of renewal due 30 November."), `MOCK SAFE - Quill Capital.pdf` (250000 dollars, cap 8000000, discount 20 percent). Folders **Finance**, **Fundraising**, **Product** hold five non-legal files (board deck, budget CSV, investor update, cap table CSV, roadmap). Data: `data.ts:499-546`.
- Gmail emulator mail that is legal in nature: "Redlines on the Master Services Agreement" (two messages), "Legal notice: trademark office action response due in 30 days", "Office lease renewal option" ("renews on Jan 31 … tell us by Nov 30"). `data.ts:53-129`.
- An ordinary bot **Legal Desk (mock)**, title "Contracts", description "tracks the demo contracts and their renewal dates" (`data.ts:549-554`), placed in the group chat "Leadership sync (mock)".
- A model key only if the person who starts the demo has `OPENROUTER_API_KEY` or `ANTHROPIC_API_KEY` in their environment (`demo.ts:37,77-87`). Without one, the runtime is "scripted (no model key found)" (`demo.ts:269`).

Not seeded (must be produced by a real scan or added for the walk):
- No `legal_contracts`, `legal_deadlines`, `legal_nodes` or `legal_edges` rows. The Legal page starts empty.
- No Legal agent bot. It is created the first time `/app/legal` loads (`apps/api/src/legal.ts:34`).
- No Legal consent row.

Named demo-data states used in the Preconditions below:
- **D0 (fresh)**: the seed as it is, on a build that includes feat/legal, started with `OPENROUTER_API_KEY` in the environment (so the Legal agent's model, `openrouter / meta/muse-spark-1.2`, resolves).
- **D0-nokey**: D0 but started with no model key, or only `ANTHROPIC_API_KEY`.
- **D1 (scanned)**: D0 after one successful Scan now. Expected from the seed, if the model follows its instructions: 4 contracts (MSA, NDA, Lease, SAFE) and 5 Data room files recorded as not legal. Hypothesis, not observed: few or no deadlines, because the seed documents state no effective dates or years (see Suspected problem S-02).
- **D2 (seeded legal rows)**: D1 plus rows inserted directly for the walk, so date behaviour can be tested without depending on the model. Proposed rows (all MOCK DEMO DATA): Lease contract active, expires 2027-01-31, `autoRenews` true, `renewalNoticeDays` 62 → derived "Renews 2027-01-31" and "Renewal notice deadline 2026-11-30"; MSA active, effective 2026-03-01, expires 2028-02-29, value 12000000 cents USD; NDA active, expires 2029-06-30, `autoRenews` false; SAFE status unknown, no dates; one manual deadline "Trademark office action response" due 2026-11-14 (from the mail); one overdue deadline "Q3 board consent signature" due 2026-10-10. Graph: nodes for Northwind Robotics Mock (company), Halcyon Logistics Mock, Acme Ventures Mock, Landlord Placeholder LLC Mock, Quill Capital Mock (company), the four contracts, and "Delaware" (jurisdiction); edges `party_to`, `governed_by`, `owes` with short source quotes.

## Summary

| Type | Count | Stories |
|---|---|---|
| Short | 8 | 004, 006, 009, 011, 012, 014, 016, 019 |
| Medium | 8 | 002, 003, 005, 008, 010, 013, 015, 018 |
| Long | 4 | 001, 007, 017, 020 |

## Coverage Matrix

| Feature area | Stories | Gaps |
|---|---|---|
| Find Legal in the sidebar, page chrome | 001, 002 | none |
| Model requirement (OpenRouter key, Muse Spark 1.2), Settings it depends on | 002, 003, 020 | exact Settings > Models wording not read (prior gap, still open) |
| Consent card (Allow) | 001, 004 | no review or revoke exists (C-8) |
| Scan now, daily scan, Last scan | 001, 005, 006, 017 | concurrent routine + manual scan unverified |
| KPI tiles | 001, 007, 009 | none |
| Contracts tab | 007, 008, 010 | narrow-screen layout |
| Deadlines tab: read, Done, Dismiss | 011, 012, 013, 017 | no reopen (P-10) |
| Derived and recurring deadlines | 013, 017 | none |
| Documents marked not legal | 010 | no user control exists (S-06) |
| Graph tab | 014, 015 | none |
| Legal agent chat panel | 016, 018, 019 | mobile width |
| Mail and Drive findings | 018 | Drive not seeded |
| Data room link-through | 008, 011 | none |
| Legal agent vs other bots ("Legal Desk (mock)") | 019 | none |
| Feature missing from the build | 020 | none |

## Story Dependency Graph

```text
STORY-020 (Legal tab missing from the build)  [run first; if it fails, stop]
STORY-001 (First week: find Legal, set up, first scan, check dates)  [D0]
├── STORY-002 (Warning about a key, no key)  [D0-nokey]
│   └── STORY-003 (Add the key, come back)
├── STORY-004 (Allow card)
├── STORY-005 (First Scan now, watching for a result)
│   ├── STORY-006 (Last scan stays old)
│   ├── STORY-009 (What "Unreviewed documents" means)
│   ├── STORY-010 (Where did the board deck go? not-legal files)
│   └── STORY-018 (Contracts found only in email)
├── STORY-007 (Monday morning legal check)  [D2]
│   ├── STORY-008 (Open the lease from the table and come back)
│   ├── STORY-011 (What is due soon?)
│   ├── STORY-012 (Done vs Dismiss, clicked the wrong one)
│   ├── STORY-013 (Lease renewed, dates move)
│   ├── STORY-014 (Who are we signed with? Graph)
│   │   └── STORY-015 (Big graph, cannot find a party)
│   └── STORY-016 (Ask the agent "what do we owe this month")
├── STORY-017 (A quarter of running the company on Legal)  [D2, long]
└── STORY-019 (Two legal bots: Legal Desk (mock) vs Legal agent)
```

---

## All Stories

### Setup and first run

## STORY-001: First week as a founder: find the legal stuff, set it up, see my dates

**Type**: long
**Topic**: First-time setup, end to end
**Persona**: Alex, founder of Northwind Robotics, first login, has heard "Rakazo keeps track of contracts"
**Goal**: See every contract the company has signed and the next date Alex must act on, without reading legal PDFs
**Preconditions**: D0. Build includes feat/legal. Signed in as the seeded demo user. Four legal PDFs in Data room > Legal are indexed (status `ready`). No Legal agent, no consent row, no legal rows.
**Ideal path**: 3 (open Legal, allow reading documents, read the list once results appear; scanning should start by itself)
**Alternate paths**: open the "Legal Desk (mock)" bot in the sidebar roster and ask it (a different, ordinary bot with no legal tools; see STORY-019); ask Chief in chat; open Data room > Legal and read each PDF.
**Source**: extends prior STORY-001, 003, 009, 010, 016

### Steps
1. Alex scans the sidebar for "contracts" → sees Inbox, Finance, **Legal** (scale icon), Data room, Cap Table (`Shell.tsx:3376-3384`). Clicks Legal → URL `/app/legal`; skeleton, then the page. Visiting creates the Legal agent and its daily routine silently (`api/legal.ts:34`, `legal-agent.ts:65-100`).
2. Alex reads the header: "Legal", small grey "Not scanned yet", buttons **Scan now** and **Ask agent** (`Legal.tsx:64-80`). Thinks: "Ask which agent? Is that a person?" (Hesitation: the button does not say "Legal".)
3. Alex sees a warning-bordered card "Let the Legal agent read your documents", a disclosure paragraph, a list of recipients (for example "OpenRouter · …"), and **Allow** (`ConsentPrompt.tsx:39-70`). Hesitation: "Who is OpenRouter? Is my data leaving the company?" There is no Cancel or "Learn more".
4. Alex clicks Allow → card disappears, no confirmation text (P-14).
5. Alex sees five tiles: Contracts 0, Active 0, Open deadlines 0, Overdue 0, Unreviewed documents 9 (`Legal.tsx:98-104`). Thinks: "9? I uploaded 4 contracts." (The count is all ready Data room files, not only legal ones; S-07.)
6. Alex reads the centre text "The Legal agent scans your Data room for contracts and deadlines." and clicks the centre **Scan now** (`Legal.tsx:105-113`) → the header button changes to "Scanning…" for about a second, the centre button does not (P-24). A side panel opens with the Legal agent's chat (`Legal.tsx:48`).
7. Alex watches the panel; the agent's reply arrives after some time. The page behind still shows zeros and "Not scanned yet" (no polling, P-09).
8. Alex, unsure, clicks the sidebar Legal again or refreshes → tiles update: Contracts 4 (expected), Unreviewed 0, "Last scan just now".
9. Alex opens the **Contracts** tab (default) → table with Contract, Parties, Status, Term, Renewal, Value, Next deadline (`LegalContracts.tsx:38-60`). Expected: four rows. Many dashes (S-02, P-22).
10. Alex looks for the lease notice date (Nov 30, which Alex half-remembers from an email) → clicks **Deadlines** tab. Expected with the seed: possibly "No open deadlines." (S-02). Thinks: "So I have nothing due? That can't be right."
11. Alex goes back to the panel and types "When do I have to tell the landlord about the lease?" → the agent answers from `legal_query` or by reading the PDF. Whether it records a deadline now depends on the model.
12. Alex closes the panel with its collapse control ("Collapse Legal agent", `Shell.tsx:2649`) → **Ask agent** returns in the header.

### Variations
- D0-nokey: step 3 shows no card, both Scan now buttons are disabled with no reason given (P-08); see STORY-002.
- Only `ANTHROPIC_API_KEY`: the card asks to allow Anthropic; the scan then fails with "runs only on Muse Spark 1.2" (P-13).
- Data room files still processing: Unreviewed counts only `ready` files (`db/legal.ts:94`), so the tile reads lower than the number Alex uploaded.

### Edge Cases
- Alex clicks Scan now twice quickly → one run (per-bot lock, `api/legal.ts:129-139`); the second click shows nothing different.
- Alex leaves the page while scanning → the panel closes (`Shell.tsx:905-907`); the run keeps going.

## STORY-002: "It says I need an OpenRouter key. What is that?"

**Type**: medium
**Topic**: Model requirement
**Persona**: Alex, no AI accounts of their own
**Goal**: Make the Legal page work
**Preconditions**: D0-nokey (no model key in the demo environment, or only `ANTHROPIC_API_KEY`). No legal rows.
**Ideal path**: 2 (click a link in the warning that opens the right Settings screen, paste a key)
**Alternate paths**: open Settings from the sidebar menu and find Models; ask the agent (it replies with `LEGAL_MODEL_REQUIRED_MESSAGE`, `contracts/legal.ts:21-22`).
**Source**: prior STORY-001, 005, 038

### Steps
1. Open `/app/legal` → small grey line: "The Legal agent cannot run until you add an OpenRouter key in Settings. It runs only on Muse Spark 1.2." (`Legal.tsx:82-88`). Hesitation: three unknown terms (OpenRouter, key, Muse Spark 1.2), no link.
2. Alex looks for a button in the line → none. Looks at Scan now → greyed out with no tooltip when no model resolves (P-08), or still clickable when the model resolves to something else (P-12).
3. Alex clicks Ask agent → panel opens; Alex types "how do I set you up?" → the run fails before any model call and the bot posts "The Legal agent runs only on Muse Spark 1.2. Add an OpenRouter key in Settings." (`executor.ts:3850-3858` per prior catalog).
4. Alex searches the app for "Settings" → finds it in the account menu (exact path not read in this pass).
5. Alex gives up or proceeds to STORY-003.

### Variations
- Only Anthropic key: Scan now enabled, consent card asks to allow Anthropic, the scan fails (P-13).

### Edge Cases
- The warning also shows when the model is merely unresolved (`!data.model?.isPreferred` is true for `null`, `Legal.tsx:82`).

## STORY-003: Add the key in Settings and come back

**Type**: medium
**Topic**: Settings dependency
**Persona**: Alex, followed a teammate's advice to "just add an OpenRouter key"
**Goal**: See the warning go away and run the first scan
**Preconditions**: D0-nokey; a valid OpenRouter key available to paste (the walk may use a test key; never print it).
**Ideal path**: 3 (open Settings from the warning, paste the key, return; the page updates by itself)
**Alternate paths**: none found that sets the model from the Legal page.
**Source**: prior STORY-002

### Steps
1. From `/app/legal`, open Settings > Models (overlay on the same page), choose OpenRouter, paste the key, save.
2. Close Settings → the Legal page still shows the old warning and greyed Scan now (queries load once, `Legal.tsx:34,36`; P-11). Thinks: "It didn't save."
3. Alex re-pastes the key, closes again → same.
4. Alex clicks the sidebar Legal or reloads the browser → warning gone; the Allow card appears (STORY-004).

### Variations
- Key added while the Legal agent bot already has a different model chosen by the user: warning stays (`legal-agent.ts:84-99` fills the model only when empty; P-21).

### Edge Cases
- Bad key: not traced in this pass.

## STORY-004: The "Let the Legal agent read your documents" card

**Type**: short
**Topic**: Consent
**Persona**: Alex, careful about investor data in the Data room
**Goal**: Understand what is being shared before clicking Allow
**Preconditions**: D0 with the model resolved; no Legal consent row.
**Ideal path**: 1 (read and click Allow)
**Alternate paths**: the Data room's own AI data sharing control (`AiDataSharing.tsx`, "Allow OpenRouter" switch) covers the space default model, a separate consent (S-05).
**Source**: prior STORY-003, 004

### Steps
1. Read the card heading, disclosure paragraph, and the recipients list (`ConsentPrompt.tsx:46-59`). Hesitation: "Does this include my cap table and board deck?" The card does not say which folders.
2. Look for "Not now" → none. Only **Allow**.
3. Click Allow → card vanishes; no message. Scan now is enabled.

### Variations
- Providers changed since the page loaded → Allow re-renders the card with no explanation (`ConsentPrompt.tsx:25-31`; P-14).

### Edge Cases
- Alex later wants to take the permission back → no control on Legal (C-8).

## STORY-005: First Scan now: "is it doing anything?"

**Type**: medium
**Topic**: Scanning
**Persona**: Alex, impatient, expects a progress bar
**Goal**: Know when the scan is finished and whether it worked
**Preconditions**: D0, consent granted, no previous scan.
**Ideal path**: 2 (click Scan now, see a "Scanning… 3 of 9" state that ends in a summary on the page)
**Alternate paths**: wait for the daily scan at 06:00 UTC (never mentioned on the page); ask the agent "scan my documents" in the panel.
**Source**: prior STORY-009, 036

### Steps
1. Click header **Scan now** → "Scanning…" for about a second (only while the queueing request runs, `Legal.tsx:43-55`), panel opens.
2. Watch the page → no change. "Not scanned yet" stays.
3. Read the panel → the agent's reply lists deadlines due in 60 days first, then what it recorded (`LEGAL_SCAN_PROMPT`, `legal-agent.ts:12-13`).
4. Close the panel and click Scan now again "to make sure" → a second run starts if the first has finished; nothing tells Alex that this re-reads nothing (unreviewed list is empty).
5. Reload → numbers appear.

### Variations
- Panel already open when clicking Scan now: `onAskAgent` is undefined, nothing visible happens except the one-second label (`Shell.tsx:4172`; P-09).
- Scan fails (model or consent): only the panel shows the failure; the page keeps "Not scanned yet".

### Edge Cases
- Scan run while another is queued returns the existing run id, no message (`api/legal.ts:139,163`).

## STORY-006: "Last scan 3 days ago": why not every day?

**Type**: short
**Topic**: Daily scan
**Persona**: Alex, returning after a long weekend
**Goal**: Trust that new documents are picked up without pressing anything
**Preconditions**: D1; the Daily legal scan routine paused, or its last three runs failed (set in the routine table for the walk).
**Ideal path**: 1 (the caption says "Daily scan paused" or "Last scan failed: reason")
**Alternate paths**: the routine is visible wherever the app lists routines for a bot (not traced in this pass).
**Source**: prior STORY-015, 035

### Steps
1. Open Legal → "Last scan 3 days ago" (only completed routine-trigger runs count, `api/legal.ts:41-45`).
2. Look for "why" → nothing on the page mentions the daily schedule, 06:00 UTC, pause state or failures (P-21, C-9). No notification was sent (`notify: false`, `legal-agent.ts:50`).
3. Click Scan now → works, caption updates only after reload.

### Edge Cases
- A routine run that completes with zero documents still updates Last scan; a chat-triggered analysis does not.

## STORY-007: Monday morning legal check

**Type**: long
**Topic**: Routine use, all three tabs
**Persona**: Alex, now in week three, wants a five-minute "am I about to miss anything" check
**Goal**: Find anything due in the next month, handle what is already done, and confirm who the company is bound to
**Preconditions**: D2 (seeded legal rows incl. overdue "Q3 board consent signature" 2026-10-10, "Trademark office action response" 2026-11-14, "Renewal notice deadline" 2026-11-30, "Renews" 2027-01-31). Today = 2026-10-16 in the walk browser's time zone.
**Ideal path**: 4 (open Legal, see a "due soon" list on the first screen, mark one done, glance at the graph)
**Alternate paths**: ask the agent "what's due this month?" (STORY-016); Inbox shows the lease and trademark emails themselves.
**Source**: prior STORY-016, 017, 023, 024

### Steps
1. Open Legal → tiles: Contracts 4, Active 3, Open deadlines 4, Overdue 1, Unreviewed 0.
2. Thinks "1 overdue, which one?" → clicks the Overdue tile → nothing; tiles are not links (`Legal.tsx:98-104`). Hesitation.
3. Clicks **Deadlines** tab → list soonest first: "Q3 board consent signature" with red pill "Overdue by 6 days", then the trademark response, the lease notice, "Renews" (`LegalDeadlines.tsx:55-117`).
4. Notices the lease notice row looks the same as "Renews" in January: no "in 45 days" text (P-16).
5. Reads the grey quote under the lease rows; the same clause appears under both "Renews" and "Renewal notice deadline" (P-04).
6. Clicks **Done** on the board consent → row disappears, no undo (P-10). Tiles update after the reload: Overdue 0.
7. Clicks **Contracts** tab → "Next deadline" for the lease shows "Nov 30" in short form while the Deadlines tab shows the full date (`LegalContracts.tsx:101-103` vs `LegalDeadlines.tsx:95`). Same fact, two formats.
8. Clicks **Graph** → diagram of companies, contracts and Delaware; clicks "Halcyon Logistics Mock" → "Halcyon Logistics Mock party_to Master Services Agreement" (raw relation key, P-20).
9. Satisfied, Alex closes the tab. Tab state is not remembered; next visit opens on Contracts again (`Legal.tsx:38`).

### Variations
- Walk browser time zone east of UTC early in the morning: tile and pill can disagree (P-03).

### Edge Cases
- Done fails (network): error appears above the list, not on the row (P-28).

### Contracts and documents

## STORY-008: Open the lease from the table and come back

**Type**: medium
**Topic**: Data room link-through
**Persona**: Alex, wants to reread the renewal clause
**Goal**: Read the actual lease text and return to the same view
**Preconditions**: D2; lease contract linked to `MOCK Office Lease - 100 Placeholder Street.pdf`.
**Ideal path**: 2 (click the lease, read the clause highlighted, press Back to the same tab)
**Alternate paths**: the contract-title link on a Deadlines row (`LegalDeadlines.tsx:74-80`); Data room > Legal folder directly; graph node (no link, P-20).
**Source**: prior STORY-011

### Steps
1. Contracts tab → click the lease title → `/app/data-room?item=<id>` opens the file preview (`LegalContracts.tsx:69-74`).
2. Look for the renewal sentence → whole document, no highlight.
3. Press browser Back → Legal opens on the Contracts tab (fine here), but if Alex came from Deadlines, it is Contracts again (P-18).

### Variations
- File deleted from the Data room after the scan: the Data room opens with no message (`DataRoom.tsx:127-136` per prior; P-18).

## STORY-009: What does "Unreviewed documents 9" mean?

**Type**: short
**Topic**: KPI tiles
**Persona**: Alex
**Goal**: Understand a number before trusting it
**Preconditions**: D0 after consent, before any scan.
**Ideal path**: 1 (a tooltip or link explaining it)
**Alternate paths**: none found.
**Source**: prior STORY-008

### Steps
1. See "Unreviewed documents 9" → hover → no tooltip; click → nothing (`Legal.tsx:103`).
2. Compare with Data room > Legal holding 4 files → confusion: the count covers all ready Data room files, including board deck, budget and roadmap (`db/legal.ts:89-95`; S-07).
3. After the scan it reads 0.

## STORY-010: "Where is my board deck? It's not in the list." (documents judged not legal)

**Type**: medium
**Topic**: Marking documents not legal
**Persona**: Alex, expected the SAFE and the cap table to show up together
**Goal**: Check which files Legal ignored and include one it skipped
**Preconditions**: D1; the five non-legal files are recorded as `not_legal`. For the variation, the SAFE is wrongly recorded as `not_legal` (inserted for the walk).
**Ideal path**: 2 (open a "Skipped (5)" list, click "Review again" on one)
**Alternate paths**: ask the agent in the panel to re-read the file (it can re-record with `legal_upsert_contract`; not verified that it does); rename the file in the Data room, which raises its revision and re-queues it (C-6).
**Source**: prior STORY-012

### Steps
1. Contracts tab shows 4 rows. Alex counts 9 files in the Data room and wonders where the rest went.
2. Looks for a "not legal" or "skipped" list → none; `not_legal` rows are filtered out (`db/legal.ts:11-12,160`).
3. Variation: the SAFE is missing. Alex looks for "Add contract" or "Mark as legal" → none exists; contracts are written only by the agent (C-3).
4. Alex asks the agent "You missed the SAFE from Quill Capital" → outcome depends on the model.

### Edge Cases
- Uploading a new version of a skipped file re-queues it (revision grows, `db/legal.ts:95`).

### Deadlines

## STORY-011: "What is due soon?"

**Type**: short
**Topic**: Deadlines read
**Persona**: Alex
**Goal**: See the next 30 days at a glance
**Preconditions**: D2.
**Ideal path**: 1 (a "Due this month" list on load)
**Alternate paths**: ask the agent (the scan reply lists 60-day deadlines first, `legal-agent.ts:13`); Contracts tab "Next deadline" column.
**Source**: prior STORY-016

### Steps
1. Open Legal → lands on Contracts, not Deadlines (`Legal.tsx:38`). Alex scans the Next deadline column.
2. Click Deadlines → full list; only overdue items are marked (P-16). Alex must read each date.

## STORY-012: Done vs Dismiss, and clicking the wrong one

**Type**: short
**Topic**: Deadlines write
**Persona**: Alex, on a laptop trackpad
**Goal**: Mark the trademark response as handled by the lawyer, not as irrelevant
**Preconditions**: D2.
**Ideal path**: 1 (click Done; Undo is offered)
**Alternate paths**: ask the agent to reopen the deadline (server accepts `status: "open"`, nothing in the web sends it; P-10).
**Source**: prior STORY-019, 022

### Steps
1. Alex reads two buttons: **Done** (outline) and **Dismiss** (ghost). Hesitation: "Dismiss like a notification? Or delete?" No hint text (`LegalDeadlines.tsx:98-115`).
2. Clicks Dismiss by mistake → row vanishes; no toast, no undo, no closed list.
3. Looks for it → gone from all tabs; open deadlines only (`api/legal.ts:37`).

## STORY-013: The lease gets renewed: do the dates move?

**Type**: medium
**Topic**: Derived deadlines after a document change
**Persona**: Alex, signed the renewal and uploaded the amended lease
**Goal**: See the next renewal and notice dates for the new term
**Preconditions**: D2, with "Renewal notice deadline 2026-11-30" already marked Done. Then a new revision of the lease file stating expiry 2029-01-31 is uploaded to the Data room.
**Ideal path**: 2 (upload the new lease, see new dates after the automatic scan)
**Alternate paths**: tell the agent the new dates in chat.
**Source**: prior STORY-013

### Steps
1. Upload the amended lease in Data room > Legal (replacing or new version).
2. Return to Legal → Unreviewed documents 1. Click Scan now.
3. After reload: Contracts row shows the new term; Deadlines shows "Renews 2029-01-31" but **no new "Renewal notice deadline"** because the closed row with the same kind and title blocks it (`legal-tools.ts:373-374`; P-01). Alex now has no reminder for the 2028 notice date.

### Variations
- The notice row had been left open: it moves to the new date (same row id).

### Graph

## STORY-014: "Who are we actually signed with?"

**Type**: short
**Topic**: Graph
**Persona**: Alex, prepping for a board meeting
**Goal**: List the companies Northwind has contracts with
**Preconditions**: D2 graph rows.
**Ideal path**: 1 (a list of counterparties)
**Alternate paths**: Contracts tab "Parties" column (same fact, simpler); ask the agent.
**Source**: prior STORY-025, 026

### Steps
1. Click Graph → columns: companies left, contracts middle, terms right (`LegalGraph.tsx:10-12`). Hesitation: no legend sentence explains the columns.
2. Click "Quill Capital Mock" → heading plus "Quill Capital Mock party_to SAFE" with a quote.
3. Try clicking the SAFE to open it → no link (P-20).
4. Click again to deselect (only way, P-30).

### Edge Cases
- Empty graph: "No relationships yet." with no next step (`LegalGraph.tsx:84-89`).

## STORY-015: Big graph, cannot find a party

**Type**: medium
**Topic**: Graph cap
**Persona**: Alex, a year later, 60 contracts
**Goal**: Find one supplier on the graph
**Preconditions**: D2 plus at least 150 extra synthetic MOCK nodes and edges inserted for the walk.
**Ideal path**: 2 (type the name in a filter, select it)
**Alternate paths**: Contracts tab Parties column; ask the agent.
**Source**: prior STORY-028

### Steps
1. Graph shows "Showing the 120 most connected of 160 items." (`LegalGraph.tsx:101-107`).
2. Look for search → none; Ctrl+F finds only drawn labels, cut at 27 characters (P-19, P-30).
3. Fall back to the Contracts table.

### Legal agent

## STORY-016: Ask the agent "what do we owe this month?"

**Type**: short
**Topic**: Agent conversation
**Persona**: Alex
**Goal**: Get a plain answer about payments and obligations
**Preconditions**: D2; model resolved; consent granted.
**Ideal path**: 2 (open the panel, ask)
**Alternate paths**: Deadlines tab; Finance page for payments.
**Source**: prior STORY-033

### Steps
1. Click **Ask agent** → panel with the Legal agent's thread.
2. Type the question → the agent uses `legal_query` and replies briefly; it says it is not a lawyer only if it chooses to (the "not a lawyer" line is only in its prompt, `legal-agent.ts:9`; P-27).
3. Alex asks "So should I sign the Halcyon redlines?" → the agent should decline legal advice; the page itself has no disclaimer.

## STORY-017: A quarter of running the company on Legal

**Type**: long
**Topic**: End-to-end over time
**Persona**: Alex, now relying on Legal instead of a spreadsheet
**Goal**: Never miss the lease notice, the trademark response, or a recurring obligation over three months
**Preconditions**: D2 plus a recurring deadline "Annual Delaware franchise tax report" due 2027-03-01 recorded by the agent. The walk simulates time by moving the browser clock or editing due dates.
**Ideal path**: 6 (weekly visit, Done on each item as handled, new items appear by themselves)
**Alternate paths**: daily scan replies in the Legal agent thread; email reminders do not exist (`notify: false`).
**Source**: prior STORY-020, 023, 035

### Steps
1. Week 1: open Legal, Deadlines tab, read four items (STORY-007).
2. Mark trademark response Done when counsel files it.
3. Week 3: forwarded email from the landlord arrives in Inbox. Alex expects Legal to "know". Legal shows nothing new: mail findings are only reported in the agent's chat reply, never recorded as deadlines or added to the Data room (`legal-agent.ts:9`; S-04).
4. Week 6: notice deadline 2026-11-30 approaches. No "due soon" marker (P-16); no notification.
5. Alex sends notice, clicks Done on "Renewal notice deadline".
6. Alex uploads the signed renewal (STORY-013) → no new notice date (P-01).
7. March: Alex marks the franchise tax report Done → no 2028 occurrence is created (P-02).
8. Alex checks "Last scan" each week; if the routine had been paused by mistake, nothing on the page said so (P-21).
9. End of quarter: Alex wants a list of what was done → there is no closed or history view (P-10).

### Variations
- Alex works from a phone: the Contracts table needs horizontal scroll (`min-w-[820px]`, `LegalContracts.tsx:33`).

## STORY-018: Contracts that are only in email

**Type**: medium
**Topic**: Mail findings
**Persona**: Alex, who keeps signed PDFs as email attachments
**Goal**: Get the MSA redlines and the trademark notice into Legal
**Preconditions**: D1; Gmail emulator mailbox seeded (the four legal emails); the Legal agent's mail tools available (owner's own non-group run, `legal-tools.ts:30-42`).
**Ideal path**: 2 (agent lists the emails, user clicks "Add to Data room")
**Alternate paths**: Data room's email import (feat/dataroom-import-email, merged into feat/legal at 166fc235); Inbox page.
**Source**: prior STORY-034

### Steps
1. Click Scan now → agent reply includes "found in mail: Office lease renewal option, Legal notice: trademark office action…" (expected from `LEGAL_SCAN_PROMPT` step 2).
2. Alex looks for an "Add" button in the reply → none; the agent "cannot add them to the Data Room" (`legal-agent.ts:9`).
3. Alex goes to Data room and imports from email (separate feature), returns, scans again.
4. The trademark notice is an email, not a contract; it may be recorded as not legal or as a contract with no dates. The 30-day response date lives only in the email body.

## STORY-019: Two legal bots: "Legal Desk (mock)" vs "Legal agent"

**Type**: short
**Topic**: Agent identity
**Persona**: Alex, sees bots in the sidebar roster
**Goal**: Talk to "the legal one"
**Preconditions**: D0 after visiting Legal once (Legal agent created). Seeded bot "Legal Desk (mock)", title "Contracts", is also in the roster and in the group "Leadership sync (mock)".
**Ideal path**: 1 (one obvious legal assistant)
**Alternate paths**: Legal page **Ask agent** panel (the real Legal agent with legal tools); sidebar roster "Legal agent"; sidebar roster "Legal Desk (mock)" (ordinary bot, no legal tools); group chat "Leadership sync (mock)" (the Legal agent loses its tools in groups, `legal-tools.ts:30-42`).
**Source**: new

### Steps
1. Alex sees "Legal Desk (mock) — Contracts" in the roster and opens it → asks "when does my lease renew?" → an ordinary bot answers without `legal_query` and without the Legal page's data.
2. Alex also sees "Legal agent" (created by visiting `/app/legal`; Shell does not filter bots by spawn key) → unsure which is "real".
3. Answers can differ; nothing on either says which one feeds the Legal page.

### Advanced and failure

## STORY-020: The Legal tab is not there

**Type**: long (it gates every other story)
**Topic**: Build contents
**Persona**: Alex, told "click Legal in the sidebar"
**Goal**: Reach the Legal page
**Preconditions**: Demo account built from `origin/main` / `docs/ux-pass` (458a69e4), the branch this pass was assigned.
**Ideal path**: 1 (click Legal)
**Alternate paths**: type `/app/legal` in the address bar.
**Source**: new

### Steps
1. Sidebar shows Inbox, Finance, Data room, Cap Table, Integrations; no Legal.
2. Alex types `/app/legal` → the route does not exist on this branch (no Legal files tracked: `git ls-files | grep -i legal` is empty).
3. Alex opens Data room > Legal folder → four PDFs, no contract view, no dates.
4. Alex asks Chief "track my contract deadlines" → an ordinary chat answer; nothing is recorded anywhere.
5. Walker: stop here and report that the build lacks feat/legal; run STORY-001 onwards only on a build such as `local/legal-integration`.

---

## Redundancy Candidates

### Duplicate paths (same goal, multiple routes)
- **Ask about contracts**: Legal page "Ask agent" panel; sidebar roster "Legal agent"; sidebar roster "Legal Desk (mock)" (seeded, ordinary bot, no legal tools); group chat "Leadership sync (mock)" (Legal agent without tools); Chief. Results diverge: only the first two use the Legal data.
- **Start a scan**: header Scan now, empty-state Scan now (two buttons on the same screen with different label behaviour, P-24), daily 06:00 UTC routine, asking the agent in chat.
- **Open the source document**: Contracts title link, Deadlines contract link, Data room folder browse. The graph node has none.
- **Give the AI permission to read documents**: Legal's Allow card (Legal agent's model) and the Data room's AI data sharing switches (space default model). Two consent places with different scopes; the founder cannot tell they differ.
- **Get legal documents from email**: the agent's chat report of mail findings, and the Data room's email import. Only the second actually adds files.

### Duplicate information (same fact, multiple surfaces)
- Next date per contract: Contracts "Next deadline" (short date) and Deadlines row (full date).
- Counterparties: Contracts "Parties" column and Graph company nodes plus `party_to` edges.
- Renewal clause quote: under both "Renews" and "Renewal notice deadline" rows (P-04).
- Deadline counts: Open deadlines and Overdue tiles, the Deadlines list, and the agent's scan reply (which lists 60-day and overdue deadlines first).
- The lease renewal and Nov 30 date: Inbox email "Office lease renewal option", the lease PDF in the Data room, and (if the model extracts it) the Legal Deadlines tab.

### Overlapping features/tools
- Graph tab vs Contracts table: for a four-contract startup the graph adds only the relation verbs and jurisdiction; the table already shows parties. Distinct enough only once there are many contracts, and that is where the graph caps at 120 nodes with no search (P-19).
- Legal Desk (mock) seeded bot vs the built-in Legal agent: the seed predates the Legal feature. Consider removing it from `DEMO_BOTS` or renaming it, so the walk does not test a decoy.

## Suspected problems

New in this pass (S-nn). Each cites a file and line; "hypothesis" marks the ones that depend on model output and were not observed.

- **S-01 (blocker for the walk). Legal is not in the assigned build.** `docs/ux-pass` = `origin/main` 458a69e4 has no Legal files; the code is on `origin/feat/legal` 488048d5 (not merged) and `local/legal-integration` d0dcfbf1. The demo seed (`rakazo-demo`, `feat/mock-demo-env`, also based on main) therefore has no Legal page. Evidence: `git -C /Users/dennison/develop/rakazo-ux ls-files | grep -i legal` empty; `git merge-base --is-ancestor origin/feat/legal origin/main` false.
- **S-02 (blocker, hypothesis). The demo documents give the agent almost no dates, so the Deadlines tab will likely be empty.** The lease says "Renewal date 31 January. Notice of renewal due 30 November." with no year; the MSA says "Term 24 months" with no start date; the NDA "Term 3 years" with no start date; the SAFE has no dates (`rakazo-demo/packages/testkit/src/cli/demo/data.ts:499-519`). The agent is told "Never invent a date … leave the field out" (`apps/api/src/legal-agent.ts:9`), and derived deadlines need `expirationDate` (`packages/adapters/src/legal-tools.ts:345`). A founder who knows the lease notice is due Nov 30 would see "No open deadlines." Fix for the walk: add years and effective dates to the seed text, or seed legal rows directly (state D2).
- **S-03 (confusing). "Ask agent" does not say which agent.** `apps/web/src/components/finance/ui.tsx:34-47` renders the shared Finance button label "Ask agent" on the Legal page (`Legal.tsx:79`). With "Legal Desk (mock)", Chief and the Legal agent all present, a first-timer cannot tell who answers.
- **S-04 (confusing). Legal dates found in email never reach the Deadlines tab.** The agent only reports mail and Drive findings in its reply and "cannot add them to the Data Room" (`legal-agent.ts:9`); deadlines are recorded per Data room document. The seeded trademark notice ("response due in 30 days", `data.ts:81-82`) is the kind of item a founder most expects Legal to track.
- **S-05 (confusing). Two separate AI consents with similar wording.** Legal's card grants consent for the Legal agent's model (`apps/api/src/legal.ts:170-197`, `ConsentPrompt.tsx:47`); the Data room's sharing switches cover the space default model (`AiDataSharing.tsx`, label "Allow OpenRouter"). Re-queued Data room jobs still check their own consent (`legal.ts:172-174`). A founder who allowed one will be asked again by the other.
- **S-06 (confusing). Nobody but the agent can mark a document legal or not legal.** `not_legal` rows are hidden from every list (`packages/db/src/legal.ts:11-12,160`) and the only user write is deadline status/notes (`packages/contracts/src/legal.ts:178-182`). The area brief lists "marking documents not legal" as a feature; for the user it does not exist except through chat.
- **S-07 (minor). "Unreviewed documents" counts every ready Data room file, legal or not.** `packages/db/src/legal.ts:89-95` has no folder or type filter, so the seeded account shows 9 before the first scan although only 4 are contracts.
- **S-08 (minor). The seeded "Legal Desk (mock)" bot competes with the real Legal agent.** `data.ts:549-554`; Shell does not hide bots by spawn key (no `spawnKey` filter in `apps/web/src/pages/Shell.tsx`), so both appear in the roster.

Carried over from the prior catalog and still present at the same lines (most relevant to a first-time founder; full evidence in the prior file):
- **P-08** Scan now disabled with no reason when no model resolves (`Legal.tsx:74,95,110`).
- **P-09** No progress or completion feedback after Scan now; page never polls (`Legal.tsx:34,43-55`; `Shell.tsx:4172`).
- **P-10** Done and Dismiss have no undo, hint or history (`LegalDeadlines.tsx:26-38,98-115`).
- **P-01** A closed derived deadline blocks the next term's deadline (`legal-tools.ts:373-374`).
- **P-02** Recurring obligations get no next occurrence (`legal-agent.ts:9,13`; `db/legal.ts:90-95`).
- **P-11/P-12/P-13** Key warning is vague, unlinked, does not refresh after Settings, and the consent card can ask to approve a model Legal then refuses (`Legal.tsx:34-36,82-96`).
- **P-16** No "due soon" marker before a deadline is overdue (`LegalDeadlines.tsx:56-71`).
- **P-20** Graph shows raw keys such as `party_to` and nodes do not link to documents (`LegalGraph.tsx:205`).
- **P-21** The page never mentions the 06:00 UTC daily scan or a paused routine (`legal-agent.ts:16,48-50`).
- Others (P-03 to P-07, P-14, P-15, P-17 to P-19, P-22 to P-30, C-1 to C-9) are unchanged; see `/Users/dennison/develop/rakazo-legal/docs/ux-paths/legal/catalog.md`.
