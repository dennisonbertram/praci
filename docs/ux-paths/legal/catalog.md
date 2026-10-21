## Area: Legal (STORY-LEG-nnn)

Generated: 2026-10-17, refreshed 2026-10-20
Code read at: `origin/feat/legal` commit **f2b8fc1e** (PR #109, "Legal: regenerate translation catalogs after the e2e fixes"). The checkout this catalog lives in is `559a76ad` (`docs/ux-pass`), which does not contain Legal. The previous catalog read `488048d5`.
Total Stories: 29 (short 12, medium 13, long 4) as of 2026-10-20
Persona for every story: Maya, a first-time founder (MOCK DEMO DATA, Northwind Robotics). Maya has never seen Praci. She does not know words like "agent", "scan", "consent", "Data room", "node" or "Muse Spark". She wants one thing: run the company without missing a contract date.

### Refresh 2026-10-20 (features merged since 2026-10-17)
- Legal merged to main with PR #109. Remarks below that Legal "is not on main", "needs a build with feat/legal" or cites `f2b8fc1e` are out of date, and the walk blocker that said STORY-LEG-020 gates everything is removed; STORY-LEG-020 now runs on a normal build. No Legal story was rewritten in this refresh. Legal is still missing from the sidebar search results (see Gaps).

### Read this first: where the Legal code is

- **(Out of date since 2026-10-20: Legal is in main.) Legal is not on `docs/ux-pass` or `origin/main`.** It merges from PR #109 (branch `origin/feat/legal`). Everything below was read from that branch with `git show origin/feat/legal:<path>` and nothing else. Nothing was run in a browser; every expected result is read from code, and anything that depends on the model's behaviour is marked as a hypothesis.
- File:line references are to `origin/feat/legal` at f2b8fc1e. `Legal.tsx` = `apps/web/src/pages/Legal.tsx`; `LegalDeadlines.tsx` and `LegalContracts.tsx` are in `apps/web/src/pages/legal/`; `LegalGraph.tsx` and `ConsentPrompt.tsx` are in `apps/web/src/components/legal/`; `legal-tools.ts` is `packages/adapters/src/legal-tools.ts`; `api-legal.ts` is `apps/api/src/legal.ts`; `legal-agent.ts` (API) is `apps/api/src/legal-agent.ts`; `db/legal.ts` is `packages/db/src/legal.ts`.
- **(Out of date since 2026-10-20: Legal is in main.) The walk only works against a build that contains feat/legal.** On a build from `origin/main` there is no `/app/legal` route and no Legal sidebar item, so STORY-LEG-020 fails at step 1 and everything else cannot run.
- The same PR changes the Data room (a consent prompt, "import from email", "import from Drive"). Those are covered by the Data room catalog. Here they are only referenced (STORY-LEG-018, STORY-LEG-028).
- The earlier problem list (P-nn, S-nn, C-nn) came from the previous catalog and a prior review. Where this PR fixed one, it is named in "Changes". The open ones are re-stated, with fresh line numbers, in "Suspected problems (this area)" at the end.

### Changes since the 2026-10-16 catalog

The Legal commits since 488048d5 that change what a user sees: `422ee8bd` (scan feedback and failure, undo, urgency, notes, hide amounts, readable graph relations), `de0b73fa` (overview exposes the newest scan run), `e0f9fe25` (routine skips while a scan runs), `7ae3f204` and `0b6332fb` (derived and recurring deadlines), `460eeaa3` (consent gating, denied-connection filter), `d8642a65` (deleting a Data room item cascades), `499c9642` (merge fixes).

**Kept (steps unchanged or only lightly touched):** STORY-LEG-008, 009, 014, 015, 016, 018, 019.

**Changed (same id, rewritten to match the new code):**
- STORY-LEG-001: no centre "Scan now" any more (one button only, `Legal.tsx:208-213`); the page now polls and shows the result by itself; warning line has an "Open Models settings" button; the tabs do not show at all until there is a contract or a deadline.
- STORY-LEG-002: the warning now has a button "Open Models settings" and reads "Legal runs only on Muse Spark 1.2, which needs an OpenRouter key." (`Legal.tsx:181-192`). Scan now is disabled whenever the model is not Muse Spark 1.2, so the Anthropic-only case is a blocked button, not a failing scan (old P-12, P-13).
- STORY-LEG-003: the page re-reads itself when Settings closes and when the window regains focus (`Legal.tsx:83-104`). The old "it didn't save" confusion (P-11) is gone in principle.
- STORY-LEG-004: card is shown only when a model is ready and there is at least one recipient (`Legal.tsx:198`); the disabled Scan now now says why ("Allow access below first." / "Connect a model in Settings first.", `Legal.tsx:136-141`). Still no Not now, still no revoke.
- STORY-LEG-005: "Scanning…" now lasts until the run really ends (polls every 4 s, gives up after 5 min, `Legal.tsx:23-25,105-117`); the page updates itself (old P-09 fixed). Still no progress count.
- STORY-LEG-006: the caption can now say "Last scan failed: <reason>" with a Retry button (`Legal.tsx:153-170`); manual Scan now counts as a scan (it is created with trigger `routine`, `api-legal.ts:176`). Nothing yet says the scan runs daily at 06:00 UTC, and a paused routine still shows nothing.
- STORY-LEG-007: Deadlines rows now say "Overdue by N days" or "Due in N days / today / tomorrow" within 30 days; Undo exists; Overdue tile uses the viewer's date; notes under derived rows. Tile is still not a link.
- STORY-LEG-010: unchanged behaviour (skipped files invisible) but the Unreviewed tile now excludes files from a denied connection in the agent's own list while the page tile does not (see S-LEG-05).
- STORY-LEG-011: "Due in N days" text now helps (old P-16 fixed); the page still opens on Contracts.
- STORY-LEG-012: Done and Dismiss now show a status line with Undo for 8 seconds (`LegalDeadlines.tsx:15,71-82`). Old P-10 partly fixed (no history, and a second close replaces the first Undo).
- STORY-LEG-013: after a renewal the notice deadline for the new term is created (a changed date opens a new row, `legal-tools.ts:393-410`); old P-01 fixed.
- STORY-LEG-017: recurring deadlines are now picked up by the scan (`LEGAL_SCAN_PROMPT` step 3, `legal-agent.ts:16`), old P-02 is now model-dependent rather than certain.
- STORY-LEG-020: still gates everything; now names PR #109 and f2b8fc1e.

**Dropped:** none. (No behaviour covered by a previous story was removed.)

**Added:** STORY-LEG-021 (empty page before the first scan), 022 (a scan fails, Retry), 023 (come back while a scan is running), 024 (phone width), 025 (page fails to load, or a refresh fails mid-scan), 026 (Hide amounts), 027 (keyboard only), 028 (deleting a document removes its contract and dates), 029 (a contract ends, its reminders disappear).

### What the mock demo account contains (from the seed), and what it lacks

Seed source is the demo seed in the `rakazo-demo` worktree (`packages/testkit/src/cli/demo/data.ts`, `demo/seed.ts`); not re-read for this pass, copied from the previous catalog.

Seeded and relevant to Legal:
- Data room folder **Legal** with four PDFs: `MOCK Master Services Agreement - Halcyon Logistics.pdf` (24 months, liability cap 1x fees, termination for convenience on 60 days notice), `MOCK Mutual NDA - Acme Ventures.pdf` (3 years), `MOCK Office Lease - 100 Placeholder Street.pdf` (7,500 dollars a month, "Renewal date 31 January. Notice of renewal due 30 November."), `MOCK SAFE - Quill Capital.pdf` (250,000 dollars, cap 8,000,000, discount 20 percent). Folders Finance, Fundraising, Product hold five non-legal files (board deck, budget CSV, investor update, cap table CSV, roadmap).
- Mail that is legal in nature: "Redlines on the Master Services Agreement" (two messages), "Legal notice: trademark office action response due in 30 days", "Office lease renewal option" ("renews on Jan 31 ... tell us by Nov 30").
- An ordinary bot **Legal Desk (mock)**, title "Contracts", in the group chat "Leadership sync (mock)". It has no legal tools.
- A model key only if the person who starts the demo has `OPENROUTER_API_KEY` in the environment. Without one the runtime is scripted.

Not seeded: any `legal_contracts`, `legal_deadlines`, `legal_nodes`, `legal_edges` rows; the Legal agent bot (created the first time the Legal page loads, `api-legal.ts:34`); the Legal consent row.

Named demo-data states used in Preconditions:
- **D0 (fresh)**: the seed on a build that includes feat/legal, started with `OPENROUTER_API_KEY` set so the Legal agent's model (`openrouter / meta/muse-spark-1.2`, `contracts/legal.ts`) resolves.
- **D0-nokey**: D0 with no model key, or only an Anthropic key.
- **D1 (scanned)**: D0 after one successful Scan now. Expected if the model follows its instructions: 4 contracts, 5 Data room files recorded as not legal. Hypothesis, not observed: few or no deadlines, because the seed PDFs state no effective dates or years (S-LEG-02).
- **D2 (seeded legal rows)**: D1 plus rows inserted for the walk so date behaviour does not depend on the model. Proposed rows (MOCK DEMO DATA): Lease active, expires 2027-01-31, `autoRenews` true, `renewalNoticeDays` 62 -> derived "Renews 2027-01-31" and "Renewal notice deadline 2026-11-30"; MSA active, effective 2026-03-01, expires 2028-02-29, value 12000000 cents USD; NDA active, expires 2029-06-30, `autoRenews` false; SAFE status unknown, no dates; one manual deadline "Trademark office action response" due 2026-11-14; one overdue deadline "Q3 board consent signature" due 2026-10-10. Graph: nodes for Northwind Robotics Mock (company), Halcyon Logistics Mock, Acme Ventures Mock, Landlord Placeholder LLC Mock, Quill Capital Mock, the four contracts, "Delaware" (jurisdiction); edges `party_to`, `governed_by`, `owes` with short source quotes. Today in the walk = 2026-10-16.

### Summary

| Type | Count | Stories |
|---|---|---|
| Short | 12 | 004, 006, 009, 011, 012, 014, 016, 019, 021, 023, 026, 029 |
| Medium | 13 | 002, 003, 005, 008, 010, 013, 015, 018, 022, 024, 025, 027, 028 |
| Long | 4 | 001, 007, 017, 020 |

### Coverage Matrix

| Feature area | Stories | Gaps |
|---|---|---|
| Find Legal in the sidebar, page chrome | 001, 020 | none |
| Model requirement (OpenRouter key, Muse Spark 1.2) and Settings link | 002, 003, 020 | exact Settings > Models wording not read |
| Consent card (Allow) | 001, 004 | no review or revoke exists (S-LEG-08) |
| Empty page before first scan | 021, 001 | none |
| Scan now, Scanning state, polling | 001, 005, 023 | concurrent routine + manual scan only read in code |
| Scan failure, Retry, Last scan caption | 006, 022 | paused routine not shown (S-LEG-07) |
| KPI tiles | 001, 007, 009 | tiles are not links |
| Contracts tab | 007, 008, 010, 024 | no sorting, filtering or search |
| Deadlines tab: read, urgency text, Done, Dismiss, Undo | 007, 011, 012, 013, 017, 027 | no closed/history view (S-LEG-06) |
| Derived and recurring deadlines | 013, 017, 029 | recurring depends on the model |
| Documents marked not legal | 010 | no user control (S-LEG-03) |
| Graph tab | 014, 015, 027 | no search, no legend |
| Legal agent panel | 016, 018, 019 | panel at phone width not read |
| Mail and Drive findings | 018 | Drive not seeded |
| Data room link-through | 008, 028 | missing/deleted item shows nothing (S-LEG-09) |
| Legal agent vs other bots | 019 | none |
| Hide amounts | 026 | toggle is not on the Legal page |
| Phone width | 024 | panel overlay not read |
| Load failure | 025 | none |
| Feature missing from the build | 020 | none |

### Story Dependency Graph

```text
STORY-LEG-020 (Legal tab missing from the build)  [run first; if it fails, stop]
STORY-LEG-001 (First week: find Legal, set up, first scan, check dates)  [D0]
├── STORY-LEG-021 (Empty page before the first scan)
├── STORY-LEG-002 (Warning about a key, no key)  [D0-nokey]
│   └── STORY-LEG-003 (Add the key, come back)
├── STORY-LEG-004 (Allow card)
├── STORY-LEG-005 (First Scan now, watching for a result)
│   ├── STORY-LEG-022 (A scan fails, Retry)
│   ├── STORY-LEG-023 (Leave during a scan, come back)
│   ├── STORY-LEG-006 (Last scan caption)
│   ├── STORY-LEG-009 (What "Unreviewed documents" means)
│   ├── STORY-LEG-010 (Where did the board deck go? not-legal files)
│   └── STORY-LEG-018 (Contracts found only in email)
├── STORY-LEG-007 (Monday morning legal check)  [D2]
│   ├── STORY-LEG-008 (Open the lease from the table and come back)
│   │   └── STORY-LEG-028 (Delete the lease file in the Data room)
│   ├── STORY-LEG-011 (What is due soon?)
│   ├── STORY-LEG-012 (Done vs Dismiss, Undo)
│   ├── STORY-LEG-013 (Lease renewed, dates move)
│   │   └── STORY-LEG-029 (A contract ends, reminders disappear)
│   ├── STORY-LEG-014 (Who are we signed with? Graph)
│   │   └── STORY-LEG-015 (Big graph, cannot find a party)
│   ├── STORY-LEG-016 (Ask the agent "what do we owe this month")
│   ├── STORY-LEG-024 (Same check on a phone)
│   ├── STORY-LEG-025 (Page fails to load / refresh fails)
│   ├── STORY-LEG-026 (Hide amounts is on)
│   └── STORY-LEG-027 (Keyboard only)
├── STORY-LEG-017 (A quarter of running the company on Legal)  [D2, long]
└── STORY-LEG-019 (Two legal bots: Legal Desk (mock) vs Legal agent)
```

---

### Stories: Setup and first run

#### STORY-LEG-001: First week as a founder: find the legal stuff, set it up, see my dates

**Type**: long
**Topic**: First-time setup, end to end
**Persona**: Maya, founder of Northwind Robotics, first login, has heard "Praci keeps track of contracts"
**Goal**: See every contract the company has signed and the next date Maya must act on, without reading legal PDFs
**Preconditions**: D0. Build includes feat/legal. Signed in as the seeded demo user. Four legal PDFs in Data room > Legal are indexed (status `ready`). No Legal agent, no consent row, no legal rows.
**Ideal path**: 3 (open Legal, click Allow, read the list). Real path is 4 or more: scanning does not start by itself, so Maya must also find and click Scan now
**Alternate paths**: open the "Legal Desk (mock)" bot in the roster and ask it (an ordinary bot with no legal tools, STORY-LEG-019); ask Chief in chat; open Data room > Legal and read each PDF.
**Source**: extends prior STORY-LEG-001

##### Steps
1. Maya scans the sidebar for "contracts". She sees Inbox, Finance, **Legal** (scale icon), Cap Table, Data room (`Shell.tsx:3373-3410`). She clicks Legal. URL becomes `/app/legal`; a skeleton (title bar, five tiles, a block) shows, then the page. Visiting silently creates the Legal agent and its daily routine (`api-legal.ts:30-36`, `legal-agent.ts:63-98`).
2. She reads the header: "Legal", a small grey "Not scanned yet", and two buttons, **Scan now** and **Ask agent** (`Legal.tsx:149-180`). **Hesitation:** "Ask which agent? Is that a person?" The button does not say "Legal".
3. A warning-bordered card appears: "Let the Legal agent read your documents", a sentence ("The full text of your documents and, for images, the page images are sent to the providers below to read, file and search them."), a recipient line such as "OpenRouter · Meta Muse Spark 1.2", and **Allow** (`ConsentPrompt.tsx:39-70`, `data-room-api.ts:118`). Next to the greyed Scan now, small grey text says "Allow access below first." (`Legal.tsx:136-141,172-174`). **Hesitation:** "Who is OpenRouter? Is my cap table going there?" There is no Cancel, no "Learn more", no folder list.
4. She clicks Allow. The card disappears; no confirmation text. The grey reason beside Scan now disappears and the button is enabled.
5. She sees five tiles: Contracts 0, Active 0, Open deadlines 0, Overdue 0, Unreviewed documents 9 (`Legal.tsx:201-207`). **Hesitation:** "9? I uploaded 4 contracts." (The count is every ready Data room file, S-LEG-01.)
6. Below the tiles there is one sentence, "The Legal agent scans your Data room for contracts and deadlines." and nothing to click (`Legal.tsx:208-213`). No tabs yet. She looks up and clicks the header **Scan now**.
7. The button changes to "Scanning…" and is disabled; a side panel opens with the Legal agent's chat (`Legal.tsx:119-129`, `Shell.tsx:2568-2571`). If the agent bot was not yet in the bot list, the panel first shows a **Create Legal agent** button (`Shell.tsx:4261-4264`).
8. She watches the panel. In the page behind, every 4 seconds the overview is re-read (`Legal.tsx:105-117`). When the run ends: "Scanning…" turns back to "Scan now", "Last scan just now" appears, tiles fill in (Contracts 4, Unreviewed 0, if the model followed its instructions) and the tabs appear.
9. She opens the **Contracts** tab (default) and sees a table: Contract, Parties, Status, Term, Renewal, Value, Next deadline (`LegalContracts.tsx:35-63`). Expected four rows; many dashes if the PDFs lack dates (S-LEG-02).
10. She looks for the lease notice date she half-remembers from an email (Nov 30) and clicks **Deadlines**. With the seed she may see "No open deadlines." **Hesitation:** "So nothing is due? That can't be right."
11. She types in the panel: "When do I have to tell the landlord about the lease?" The agent answers from `legal_query` or by reading the PDF; whether it records a deadline depends on the model.
12. She closes the panel with the collapse control (label "Collapse Legal agent", `Shell.tsx:4251`); **Ask agent** returns in the header.

##### Variations
- D0-nokey: no card; both buttons blocked; see STORY-LEG-002.
- Data room files still processing: Unreviewed counts only `ready` files (`db/legal.ts:97`), so it reads lower than what Maya uploaded.
- Panel already open when Scan now is clicked: the header has no Ask agent (it is hidden while the panel is open, `Legal.tsx` via `AskAgentButton`), and the panel just stays.

##### Edge Cases
- Maya double-clicks Scan now: the button disables after the first click only once the overview says running; two quick clicks make one run (per-bot lock, `api-legal.ts:149-159`).
- She leaves the page while scanning: the panel closes (`Shell.tsx:881`); the run keeps going (STORY-LEG-023).

#### STORY-LEG-002: "It says I need an OpenRouter key. What is that?"

**Type**: medium
**Topic**: Model requirement
**Persona**: Maya, no AI accounts of her own
**Goal**: Make the Legal page work
**Preconditions**: D0-nokey (no model key, or only an Anthropic key). No legal rows.
**Ideal path**: 2 (click "Open Models settings", paste a key)
**Alternate paths**: open Settings from the sidebar menu and find Models; ask the agent (it replies with `LEGAL_MODEL_REQUIRED_MESSAGE`, "The Legal agent runs only on Muse Spark 1.2. Add an OpenRouter key in Settings.", `contracts/legal.ts`, `executor.ts:3877-3886`).
**Source**: prior STORY-LEG-002

##### Steps
1. Maya opens `/app/legal`. Under the header: "Legal runs only on Muse Spark 1.2, which needs an OpenRouter key." and a button **Open Models settings** (`Legal.tsx:181-192`). **Hesitation:** three unknown terms (Muse Spark, OpenRouter, key), but at least there is a button.
2. She looks at Scan now: greyed (`scanDisabled`, `Legal.tsx:135`). There is no reason text beside it in this state (the reason is only for the consent case); the warning above is the explanation.
3. She clicks Open Models settings. Settings opens on Models (`Shell.tsx:4183`, `openSettings("models")`). She must still know which provider to choose and where to get a key; the page does not say.
4. She pastes a key and closes Settings; the page re-reads itself (STORY-LEG-003).
5. If she instead clicks Ask agent and types "how do I set you up?", the run ends before any model call with the same Muse Spark message.

##### Variations
- Only an Anthropic key: Scan now is still disabled with the same warning (the resolved model is not Muse Spark 1.2, `api-legal.ts:88-96`), so the old "scan starts then fails" path is gone.
- User changed the Legal agent's model by hand: warning stays; `ensureLegalAgent` fills the model only when it is empty (`legal-agent.ts:84-97`).

##### Edge Cases
- The warning also shows while the model is merely unresolved (`!data.model?.isPreferred`, `Legal.tsx:133`).
- If the overview shows `model: null` because the AI resolver threw, the same warning appears (`api-legal.ts:52`).

#### STORY-LEG-003: Add the key in Settings and come back

**Type**: medium
**Topic**: Settings dependency
**Persona**: Maya, followed a teammate's advice to "just add an OpenRouter key"
**Goal**: See the warning go away and run the first scan
**Preconditions**: D0-nokey; a valid OpenRouter key to paste (the walk may use a test key; never print it).
**Ideal path**: 3 (open Models settings from the warning, paste the key, close; the page updates by itself)
**Alternate paths**: none found that sets the model from the Legal page.
**Source**: prior STORY-LEG-003

##### Steps
1. From `/app/legal`, Maya clicks **Open Models settings** and pastes a key.
2. She closes Settings. The page notices Settings closed and re-reads the overview and consent (`Legal.tsx:97-104`). The warning disappears.
3. The consent card appears (STORY-LEG-004) because a recipient now exists. **Hesitation:** "I already agreed to something in Settings; why again?" (Different consent: Settings key vs Data room documents.)
4. If she switched to another browser tab to copy the key from OpenRouter and came back, the page also re-reads on focus (`Legal.tsx:83-96`).
5. She clicks Allow, then Scan now.

##### Variations
- Settings was open in a different browser tab: the page only updates when this tab regains focus.

##### Edge Cases
- Bad key: not traced in this pass. The overview would still report a model but runs would fail; the failure shows as "Last scan failed: <reason>" (STORY-LEG-022).

#### STORY-LEG-004: The "Let the Legal agent read your documents" card

**Type**: short
**Topic**: Consent
**Persona**: Maya, careful about investor data in the Data room
**Goal**: Understand what is shared before clicking Allow
**Preconditions**: D0 with the model resolved; no Legal consent row.
**Ideal path**: 1 (read and click Allow)
**Alternate paths**: the Data room's own AI sharing control (a separate consent for the space's default model; Data room catalog).
**Source**: prior STORY-LEG-004

##### Steps
1. Maya reads the heading, the disclosure sentence and the recipient list (`ConsentPrompt.tsx:46-59`). **Hesitation:** "Does this include my board deck and cap table?" The card does not say which folders.
2. She looks for "Not now" or a link to details. Only **Allow** exists.
3. She clicks Allow. Pending state disables the button; on success the card vanishes with no message. Scan now becomes enabled.

##### Variations
- The providers changed since the page loaded: Allow gets a CONFLICT, the card is replaced by the current disclosure and Maya must click again, with no explanation (`ConsentPrompt.tsx:25-31`).
- Grant fails (network): a red line under the text with the error; Allow stays.
- No recipient yet (no model): no card at all, and Scan now says "Connect a model in Settings first." (`Legal.tsx:198`, `136-141`).

##### Edge Cases
- Later Maya wants to take the permission back: no control on Legal (S-LEG-08).
- Granting here also lets Data room items that were waiting for consent proceed (the grant goes through the Data room service, `api-legal.ts:188-217`). Nothing on the card says so.

#### STORY-LEG-005: First Scan now: "is it doing anything?"

**Type**: medium
**Topic**: Scanning
**Persona**: Maya, impatient, expects a progress bar
**Goal**: Know when the scan is finished and whether it worked
**Preconditions**: D0, consent granted, no previous scan.
**Ideal path**: 2 (click Scan now; the button says Scanning… and ends with a visible summary)
**Alternate paths**: wait for the daily scan (06:00 UTC, never mentioned on the page); ask the agent "scan my documents" in the panel (that is a chat run, not a scan, and does not change "Last scan").
**Source**: prior STORY-LEG-005

##### Steps
1. Maya clicks header **Scan now**. The request queues a run (`api-legal.ts:144-186`); the button reads "Scanning…" and is disabled; the Legal agent panel opens (`Legal.tsx:119-129`).
2. She watches the page: counts stay at zero for a while; no "3 of 9" progress. **Hesitation:** "Is it stuck?"
3. She reads the panel: the agent's tool activity lines ("Checking for unreviewed legal documents", "Recording a contract: ...", `legal-tools.ts:226-233`) and finally a short reply that lists deadlines due in 60 days first, then what was recorded, then any contracts found in mail or Drive (`LEGAL_SCAN_PROMPT`, `legal-agent.ts:16`).
4. When the run ends the page updates itself within 4 seconds: button back to "Scan now", "Last scan just now", tiles and tabs filled.
5. She clicks Scan now again "to be sure". A second run starts; it has nothing to read (Unreviewed is 0) and finishes quickly; nothing tells her it found nothing new except the panel reply.

##### Variations
- Panel already open when clicking Scan now: no visible change except the button (Ask agent is hidden while the panel is open).
- The scan takes longer than 5 minutes: the page stops polling and sets itself back to "Scan now" even if the run is still going (`Legal.tsx:109-112`); the next overview read (focus, reload) shows "Scanning…" again because the newest run is still running (`Legal.tsx:73`).

##### Edge Cases
- A scan already running (for example from the 06:00 routine): Scan now returns that run and does not start another (`api-legal.ts:149-159`); the daily wakeup also skips when a scan is running (`executor.ts:3254-3262`).

#### STORY-LEG-006: "Last scan 3 days ago": why not every day?

**Type**: short
**Topic**: Daily scan caption
**Persona**: Maya, returning after a long weekend
**Goal**: Trust that new documents are picked up without pressing anything
**Preconditions**: D1; the Daily legal scan routine paused, or its recent runs failed (set in the routine table for the walk).
**Ideal path**: 1 (the caption says "Daily scan paused" or "Last scan failed: reason")
**Alternate paths**: the routine is visible wherever the app lists routines for a bot (not traced).
**Source**: prior STORY-LEG-006

##### Steps
1. Maya opens Legal: "Last scan 3 days ago" (newest completed run of the agent's routine; Scan now runs count too, `api-legal.ts:41-45`).
2. She looks for "why". If the newest run failed, the caption instead reads "Last scan failed: <reason>" with a **Retry** button (`Legal.tsx:153-170`). If the routine is paused, nothing says so (S-LEG-07). No notification was sent (`notify: false`, `legal-agent.ts:49`).
3. She clicks Scan now; the caption updates by itself when the run ends.

##### Edge Cases
- A routine run that completes with zero documents still updates Last scan.
- A chat-triggered question does not change Last scan (trigger is `user`, not `routine`).

#### STORY-LEG-007: Monday morning legal check

**Type**: long
**Topic**: Routine use, all three tabs
**Persona**: Maya, now in week three, wants a five-minute "am I about to miss anything" check
**Goal**: Find anything due in the next month, handle what is already done, and confirm who the company is bound to
**Preconditions**: D2 (overdue "Q3 board consent signature" 2026-10-10, "Trademark office action response" 2026-11-14, "Renewal notice deadline" 2026-11-30, "Renews" 2027-01-31). Today = 2026-10-16.
**Ideal path**: 3 (open Legal, see a "due soon" list, mark one done); real path is 5 because the page opens on Contracts and Deadlines is a second click
**Alternate paths**: ask the agent "what's due this month?" (STORY-LEG-016); Inbox shows the emails themselves.
**Source**: prior STORY-LEG-007

##### Steps
1. Maya opens Legal. Tiles: Contracts 4, Active 3, Open deadlines 4, Overdue 1, Unreviewed documents 0. The default tab is **Contracts** (`Legal.tsx:65`).
2. She wonders "1 overdue, which one?" and clicks the Overdue tile. Nothing happens; tiles are not links (`Legal.tsx:202-206`, `Kpi` has an optional `to` that Legal does not pass). **Hesitation.**
3. She clicks **Deadlines**. List soonest first: "Q3 board consent signature" with a red pill "Overdue by 6 days" and the date in red; "Trademark office action response" with "Due in 29 days"; "Renewal notice deadline" with "Due in 45 days"; "Renews" in January with no urgency text (more than 30 days, `LegalDeadlines.tsx:16-17,118-127`). Dates read like "Nov 30, 2026" (`fullDay`).
4. She reads the grey line under the lease rows (contract title, a link) and the quote and note: "Derived from the expiration date and the notice period." appears as a note on derived rows (`legal-tools.ts:211`, `LegalDeadlines.tsx:147-151`). The same clause is shown under both "Renews" and "Renewal notice deadline".
5. She clicks **Done** on the board consent. The row disappears, a line appears at the top: "Marked Q3 board consent signature done." with **Undo** (`LegalDeadlines.tsx:71-82`). The Overdue tile drops to 0 after the page re-reads.
6. She opens the **Contracts** tab. "Next deadline" for the lease shows "Nov 30" (short form, year only when it is not the current year) while the Deadlines tab said "Nov 30, 2026" (`LegalContracts.tsx:104`, `finance-format.ts shortDay/fullDay`). Same fact, two formats.
7. She opens **Graph**: three columns of boxes, companies on the left, contracts in the middle, jurisdictions; clicks "Halcyon Logistics Mock" and reads "Halcyon Logistics Mock party to Master Services Agreement" plus the quote and an "Open document" link if the edge has one (`LegalGraph.tsx:199-232`).
8. She closes the tab. Next visit opens on Contracts again; the chosen tab is not remembered (`Legal.tsx:65`).

##### Variations
- Browser time zone east of UTC early in the morning: the tile and the row pills both use the viewer's date, so they agree (`Legal.tsx:143-145`, `LegalDeadlines.tsx:23`). The server's own overdue count is not shown.
- Maya switches to Contracts right after Done: the Undo line is gone (it lives in the Deadlines tab component).

##### Edge Cases
- Done fails (network): a red line "<error>" above the list; the row stays (`LegalDeadlines.tsx:96-100`).

### Stories: Contracts and documents

#### STORY-LEG-008: Open the lease from the table and come back

**Type**: medium
**Topic**: Data room link-through
**Persona**: Maya, wants to reread the renewal clause
**Goal**: Read the actual lease text and return to the same view
**Preconditions**: D2; lease contract linked to `MOCK Office Lease - 100 Placeholder Street.pdf`.
**Ideal path**: 2 (click the lease, read it, press Back to the same tab)
**Alternate paths**: the contract title link on a Deadlines row (`LegalDeadlines.tsx:131-140`); Data room > Legal folder directly; the "Open document" link in the graph's relation list.
**Source**: prior STORY-LEG-008

##### Steps
1. On the Contracts tab Maya clicks the lease title. URL `/app/data-room?item=<id>`; the Data room opens in the lease's folder with the preview open (`LegalContracts.tsx:70-75`, `DataRoom.tsx:192-213`).
2. She looks for the renewal sentence: whole document, no highlight.
3. She presses browser Back. Legal opens again on the **Contracts** tab regardless of the tab she came from (S-LEG-11).

##### Variations
- File deleted from the Data room after the scan: see STORY-LEG-028. If only the link is stale, the Data room opens with nothing selected and no message (`DataRoom.tsx:199-211`, `.catch(() => undefined)`, S-LEG-09).

#### STORY-LEG-009: What does "Unreviewed documents 9" mean?

**Type**: short
**Topic**: KPI tiles
**Persona**: Maya
**Goal**: Understand a number before trusting it
**Preconditions**: D0 after consent, before any scan.
**Ideal path**: 1 (a tooltip or link explaining it)
**Alternate paths**: none found.
**Source**: prior STORY-LEG-009

##### Steps
1. Maya sees "Unreviewed documents 9". She hovers: no tooltip. She clicks: nothing (`Legal.tsx:206`).
2. She compares with Data room > Legal holding 4 files and is confused: the count covers every ready Data room file in every folder (board deck, budget, roadmap), not only legal ones (`db/legal.ts:89-103`, S-LEG-01).
3. After the scan it reads 0, because the agent records even non-legal files as reviewed.

#### STORY-LEG-010: "Where is my board deck? It's not in the list." (documents judged not legal)

**Type**: medium
**Topic**: Documents marked not legal
**Persona**: Maya, expected the SAFE and the cap table to show up together
**Goal**: Check which files Legal ignored and include one it skipped
**Preconditions**: D1; five non-legal files recorded as `not_legal`. For the variation, the SAFE is wrongly recorded as `not_legal` (inserted for the walk).
**Ideal path**: 2 (open a "Skipped (5)" list, click "Review again" on one)
**Alternate paths**: ask the agent to re-read the file (it can re-record with `legal_upsert_contract`; not verified); upload a new version of the file in the Data room, which raises its revision so it counts as unreviewed again (`db/legal.ts:98`).
**Source**: prior STORY-LEG-010

##### Steps
1. The Contracts tab shows 4 rows. Maya counts 9 files in the Data room and wonders where the rest went.
2. She looks for a "not legal" or "skipped" list. None: `not_legal` rows are filtered out of the contract list (`db/legal.ts:12,169`).
3. Variation: the SAFE is missing. She looks for "Add contract" or "Mark as legal". None exists; contracts are written only by the agent (S-LEG-03).
4. She asks the agent "You missed the SAFE from Quill Capital" in the panel; the outcome depends on the model.

##### Edge Cases
- Uploading a new version of a skipped file re-queues it for the next scan.

### Stories: Deadlines

#### STORY-LEG-011: "What is due soon?"

**Type**: short
**Topic**: Deadlines read
**Persona**: Maya
**Goal**: See the next 30 days at a glance
**Preconditions**: D2.
**Ideal path**: 2 (open Legal, click Deadlines; rows within 30 days say "Due in N days")
**Alternate paths**: ask the agent (the scan reply lists 60-day deadlines first); Contracts tab "Next deadline" column.
**Source**: prior STORY-LEG-011

##### Steps
1. Maya opens Legal. It lands on Contracts, not Deadlines (`Legal.tsx:65`). She scans the Next deadline column.
2. She clicks Deadlines. Rows due in 30 days or less say "Due today", "Due tomorrow" or "Due in N days"; further ones show only the date (`LegalDeadlines.tsx:118-127`). Old complaint P-16 is fixed for the 30-day window; a deadline 45 days away has no marker.

#### STORY-LEG-012: Done vs Dismiss, and clicking the wrong one

**Type**: short
**Topic**: Deadlines write
**Persona**: Maya, on a laptop trackpad
**Goal**: Mark the trademark response as handled by the lawyer, not as irrelevant
**Preconditions**: D2.
**Ideal path**: 1 (click Done; Undo is offered)
**Alternate paths**: none other.
**Source**: prior STORY-LEG-012

##### Steps
1. Maya reads two buttons on each row: **Done** (outlined) and **Dismiss** (plain). **Hesitation:** "Dismiss like a notification, or delete?" No hint text (`LegalDeadlines.tsx:159-178`).
2. She clicks Dismiss by mistake. The row disappears; a line reads "Dismissed Trademark office action response." with **Undo** (`LegalDeadlines.tsx:71-82`).
3. She clicks Undo within 8 seconds (`UNDO_MS`). The row returns (status set back to open).
4. If she waits longer, the Undo disappears and the item is gone from every tab: only open deadlines are listed (`api-legal.ts:37`). There is no closed list (S-LEG-06).

##### Edge Cases
- Closing a second row replaces the Undo for the first; the first can no longer be undone.
- Switching tabs before undoing loses the Undo line.
- Undo fails (network): red line above the list.

#### STORY-LEG-013: The lease gets renewed: do the dates move?

**Type**: medium
**Topic**: Derived deadlines after a document change
**Persona**: Maya, signed the renewal and uploaded the amended lease
**Goal**: See the next renewal and notice dates for the new term
**Preconditions**: D2, with "Renewal notice deadline 2026-11-30" already marked Done. A new revision of the lease stating expiry 2029-01-31 is uploaded to the Data room.
**Ideal path**: 2 (upload the new lease, see new dates after a Scan now)
**Alternate paths**: tell the agent the new dates in chat.
**Source**: prior STORY-LEG-013

##### Steps
1. Maya uploads the amended lease in Data room > Legal.
2. She returns to Legal. Unreviewed documents shows 1 (revision is higher than the analyzed one, `db/legal.ts:98`). She clicks Scan now and waits for "Scanning…" to end.
3. Contracts row shows the new term. Deadlines now shows "Renews Jan 31, 2029" and a new "Renewal notice deadline" for the new date: the old closed row stays closed for its own date, and the changed date opens a new row (`legal-tools.ts:393-410`). The old gap (no new reminder after a Done) is fixed.

##### Variations
- The notice row had been left open: it moves to the new date (same row id).
- The agent forgets `renewalQuote`: derived rows show no quote.

##### Edge Cases
- If `autoRenews` flips, the open "Renews" row is dismissed with a note and "Expires" opens (`legal-tools.ts:387-392`); the note is not visible anywhere.

### Stories: Graph

#### STORY-LEG-014: "Who are we actually signed with?"

**Type**: short
**Topic**: Graph
**Persona**: Maya, prepping for a board meeting
**Goal**: List the companies Northwind has contracts with
**Preconditions**: D2 graph rows.
**Ideal path**: 1 (a list of counterparties)
**Alternate paths**: Contracts tab "Parties" column (simpler, same fact); ask the agent.
**Source**: prior STORY-LEG-014

##### Steps
1. Maya clicks Graph. Columns of boxes: Company, Person, Jurisdiction, Contract, ... in a fixed order, headed by their kind (`LegalGraph.tsx:14-23,123-133`). Below: "Select an item to see its relations." No legend.
2. She clicks "Quill Capital Mock". The box outlines; the heading and "Quill Capital Mock party to SAFE" appear under the diagram, with the source quote and, when the edge knows its document, an **Open document** link (`LegalGraph.tsx:199-232`). Relations are shown as words ("party to"), not the stored "party_to".
3. She tries to click the SAFE box to open it: that selects the box; no link from the box itself.
4. She clicks the same box again to deselect (the only way).

##### Edge Cases
- Empty graph: "No relationships yet." with no next step (`LegalGraph.tsx:91-97`).
- Labels longer than 27 characters are cut with an ellipsis (`LegalGraph.tsx:45`); the full label shows after selecting.

#### STORY-LEG-015: Big graph, cannot find a party

**Type**: medium
**Topic**: Graph cap
**Persona**: Maya, a year later, 60 contracts
**Goal**: Find one supplier on the graph
**Preconditions**: D2 plus at least 150 extra synthetic MOCK nodes and edges.
**Ideal path**: 2 (type the name in a filter, select it)
**Alternate paths**: Contracts tab Parties column; ask the agent.
**Source**: prior STORY-LEG-015

##### Steps
1. Graph shows "Showing the 120 most connected of 160 items." (`LegalGraph.tsx:108-114`, cap 120). The server itself returns at most 2000 nodes (`db/legal.ts:15`).
2. She looks for search: none. Ctrl+F finds only drawn labels, cut at 27 characters.
3. She falls back to the Contracts table, which also has no search.

### Stories: Legal agent

#### STORY-LEG-016: Ask the agent "what do we owe this month?"

**Type**: short
**Topic**: Agent conversation
**Persona**: Maya
**Goal**: Get a plain answer about payments and obligations
**Preconditions**: D2; model resolved; consent granted.
**Ideal path**: 2 (open the panel, ask)
**Alternate paths**: Deadlines tab; Finance page for payments.
**Source**: prior STORY-LEG-016

##### Steps
1. Maya clicks **Ask agent**. A panel opens with the Legal agent's thread (and, if the agent bot does not exist yet, a **Create Legal agent** button, `Shell.tsx:4261`).
2. She types the question. The agent uses `legal_query` and replies briefly. The "not a lawyer" rule is only in its instructions (`legal-agent.ts:12`), not on the page (S-LEG-15).
3. She asks "So should I sign the Halcyon redlines?" The agent should decline legal advice; the page itself shows no disclaimer.

##### Edge Cases
- Consent withdrawn or missing: the run ends before any model call with "Data Room consent is required for OpenRouter before the Legal agent can run. Allow it on the Legal page." (`executor.ts:3892-3896`).

#### STORY-LEG-017: A quarter of running the company on Legal

**Type**: long
**Topic**: End-to-end over time
**Persona**: Maya, now relying on Legal instead of a spreadsheet
**Goal**: Never miss the lease notice, the trademark response, or a recurring obligation over three months
**Preconditions**: D2 plus a recurring deadline "Annual Delaware franchise tax report" due 2027-03-01 recorded by the agent. The walk simulates time by moving the browser clock or editing due dates.
**Ideal path**: 6 (weekly visit, Done on each item as handled, new items appear by themselves)
**Alternate paths**: daily scan replies in the Legal agent thread; email reminders do not exist (`notify: false`).
**Source**: prior STORY-LEG-017

##### Steps
1. Week 1: open Legal, Deadlines tab, read four items (STORY-LEG-007).
2. Maya marks the trademark response Done when counsel files it.
3. Week 3: a forwarded email from the landlord arrives in Inbox. Maya expects Legal to know. Mail findings are only reported in the agent's chat reply, not recorded as deadlines or added to the Data room (`legal-agent.ts:12`, S-LEG-04).
4. Week 6: the notice deadline 2026-11-30 approaches. The row shows "Due in N days" within 30 days (good); no notification is sent.
5. Maya sends the notice and clicks Done on "Renewal notice deadline".
6. She uploads the signed renewal (STORY-LEG-013): a new notice row appears for the new term.
7. March: she marks the franchise tax report Done. At the next scan (daily 06:00 UTC), step 3 of the scan prompt records the next occurrence if the model follows it (`LEGAL_SCAN_PROMPT`). Hypothesis, not observed: a 2028 row appears.
8. She checks "Last scan" each week; if the routine had been paused nothing on the page said so (S-LEG-07).
9. End of quarter: she wants a list of what was done. No closed or history view exists (S-LEG-06).

##### Variations
- Maya works from a phone: STORY-LEG-024.

#### STORY-LEG-018: Contracts that are only in email

**Type**: medium
**Topic**: Mail findings
**Persona**: Maya, who keeps signed PDFs as email attachments
**Goal**: Get the MSA redlines and the trademark notice into Legal
**Preconditions**: D1; Gmail emulator seeded (the four legal emails); the Legal agent's mail tools available (owner's own non-group run, `legal-tools.ts:29-42`).
**Ideal path**: 2 (agent lists the emails, Maya clicks "Add to Data room")
**Alternate paths**: Data room "import from email" and "import from Drive" (new in the same PR; Data room catalog); Inbox page.
**Source**: prior STORY-LEG-018

##### Steps
1. Maya clicks Scan now. The agent's reply includes "found in mail: Office lease renewal option, Legal notice: trademark office action..." (expected from scan step 2).
2. She looks for an "Add" button in the reply. None; the agent "cannot add them to the Data Room" (`legal-agent.ts:12`).
3. She goes to Data room and uses its import-from-email control (separate feature), returns, scans again.
4. The trademark notice is an email, not a contract; it may be recorded as not legal or as a contract with no dates. The 30-day response date lives only in the email body.

#### STORY-LEG-019: Two legal bots: "Legal Desk (mock)" vs "Legal agent"

**Type**: short
**Topic**: Agent identity
**Persona**: Maya, sees bots in the sidebar roster
**Goal**: Talk to "the legal one"
**Preconditions**: D0 after visiting Legal once. Seeded bot "Legal Desk (mock)", title "Contracts", is also in the roster and in the group "Leadership sync (mock)".
**Ideal path**: 1 (one obvious legal assistant)
**Alternate paths**: Legal page **Ask agent** panel (the real Legal agent); roster "Legal agent"; roster "Legal Desk (mock)" (ordinary bot, no legal tools); group chat (the Legal agent loses its legal tools in groups, `legal-tools.ts:29-42`).
**Source**: prior STORY-LEG-019

##### Steps
1. Maya sees "Legal Desk (mock) - Contracts" in the roster and asks "when does my lease renew?" An ordinary bot answers without `legal_query` or the Legal page's data.
2. She also sees "Legal agent" (created by visiting `/app/legal`, description "Reads your contracts and tracks legal deadlines.", `legal-agent.ts:75`) and cannot tell which one feeds the Legal page.
3. Answers can differ; nothing on either says which one is "real".

### Stories: Advanced and failure

#### STORY-LEG-020: The Legal tab is not there

> **Updated 2026-10-20**: Legal is now part of the main build, so the case this story checks (a build without Legal) no longer occurs. Walk it as a sanity check that the Legal row, the /app/legal route and the Contracts, Deadlines and Graph tabs exist; Legal is still missing from sidebar search results (STORY-APP-322).

**Type**: long (it gates every other story)
**Topic**: Build contents
**Persona**: Maya, told "click Legal in the sidebar"
**Goal**: Reach the Legal page
**Preconditions**: Demo account built from `origin/main` or `docs/ux-pass` (559a76ad). True until PR #109 merges.
**Ideal path**: 1 (click Legal)
**Alternate paths**: type `/app/legal` in the address bar.
**Source**: prior STORY-LEG-020

##### Steps
1. The sidebar shows Inbox, Finance, Cap Table, Data room, Integrations; no Legal.
2. Maya types `/app/legal`. The route does not exist on this branch (no Legal files are tracked on `docs/ux-pass`); she lands wherever unknown paths go.
3. She opens Data room > Legal folder: four PDFs, no contract view, no dates.
4. She asks Chief "track my contract deadlines": an ordinary chat answer; nothing is recorded.
5. Walker: stop and report that the build lacks feat/legal; run STORY-LEG-001 onwards only on a build that contains f2b8fc1e or later.

##### Variations
- Build contains Legal but with an older commit (for example 488048d5): the one-line warning has no button, there is no polling, no Undo, no Retry. Use the commit to decide which stories apply.

### Stories: New since the previous catalog

#### STORY-LEG-021: Empty page before the first scan

**Type**: short
**Topic**: Empty state
**Persona**: Maya, just allowed access, nothing scanned
**Goal**: Know what to do next
**Preconditions**: D0, consent granted, model ready, no legal rows.
**Ideal path**: 1 (click Scan now)
**Alternate paths**: ask the agent.
**Source**: new

##### Steps
1. Maya sees the title, "Not scanned yet", the five tiles at zero (Unreviewed 9) and the sentence "The Legal agent scans your Data room for contracts and deadlines." (`Legal.tsx:208-213`). There are no Contracts / Deadlines / Graph tabs.
2. She looks for a button in the middle of the page. There is none (the old centre button was removed; a test asserts a single Scan now on an empty page, `Legal.test.tsx` "has one Scan now button on an empty page").
3. She notices Scan now in the header and clicks it (STORY-LEG-005).

##### Variations
- Consent not granted yet: the same page shows the card above the tiles and Scan now is greyed with "Allow access below first."

##### Edge Cases
- After a scan that finds nothing legal (all files not_legal): contracts and deadlines are both empty, so the page looks exactly like "never scanned" except "Last scan just now" (S-LEG-10 variant: no "nothing found" message).

#### STORY-LEG-022: A scan fails, and Retry

**Type**: medium
**Topic**: Scan failure
**Persona**: Maya, key pasted wrong, or consent withdrawn
**Goal**: Understand what failed and recover
**Preconditions**: D0, model resolves but the newest scan run is `failed` (insert a failed routine run with error "Data Room consent is required.", or use a key that errors).
**Ideal path**: 2 (read the reason, click Retry)
**Alternate paths**: open the panel and read the failure message; fix in Settings.
**Source**: new

##### Steps
1. Maya opens Legal. The caption reads "Last scan failed: Data Room consent is required." and a **Retry** button sits next to it (`Legal.tsx:153-170`). Scan now is also available.
2. She does not know what "Data Room consent" is; the reason text is the run's raw error. **Hesitation.**
3. If consent is the cause, the card is also visible and she clicks Allow; Retry becomes enabled (it is disabled while `needsConsent`, `Legal.tsx:167`).
4. She clicks Retry: button reads "Scanning…", panel opens, caption returns to "Last scan ..." on success.

##### Variations
- Scan now itself errors at queue time (for example space deleted): a red line under the header with the error (`Legal.tsx:193-197`).
- Panel shows the same text as a bot message ("The Legal agent runs only on Muse Spark 1.2...").

##### Edge Cases
- Cancelled run: treated as not running; caption falls back to "Last scan ..." from the last completed one.

#### STORY-LEG-023: Leave during a scan, come back

**Type**: short
**Topic**: Running state across navigation
**Persona**: Maya, impatient, opens Inbox while it scans
**Goal**: Find out whether the scan finished
**Preconditions**: D0, consent granted, a scan running.
**Ideal path**: 1 (return to Legal and see the result)
**Alternate paths**: the roster's Legal agent bot shows its status.
**Source**: new

##### Steps
1. Maya clicks Scan now, then Inbox in the sidebar. The panel closes (`Shell.tsx:881`); the run continues.
2. She returns to Legal 2 minutes later. The overview shows the newest run's status; if still running the button reads "Scanning…" and the page polls again (`Legal.tsx:71-73,105-117`); if finished, the numbers are already there.
3. She sees no message saying what the scan found; the panel (closed) has the summary. She must click Ask agent to read it.

##### Edge Cases
- The panel does not reopen by itself.

#### STORY-LEG-024: The Monday check on a phone

**Type**: medium
**Topic**: Phone width
**Persona**: Maya, on a 390 px phone in a taxi
**Goal**: See what is due this week
**Preconditions**: D2; viewport 390 x 844.
**Ideal path**: 3 (open menu, Legal, Deadlines)
**Alternate paths**: ask the agent.
**Source**: new

##### Steps
1. Maya opens the sidebar (mobile drawer), taps Legal; the drawer closes (`Shell.tsx:3385-3389`).
2. Tiles are two per row (`grid-cols-2`, `Legal.tsx:201`), so five tiles stack in three rows. The header wraps: title, caption, then Scan now and Ask agent.
3. She taps Deadlines. Rows wrap: title and urgency, then date and the two buttons (`LegalDeadlines.tsx:107-111`). Readable.
4. She taps Contracts: the table needs a 820 px width and scrolls sideways (`LegalContracts.tsx:34-35`). **Hesitation:** she may miss the Term, Renewal, Value and Next deadline columns because they are off screen.
5. She taps Graph: the diagram is at least 640 px wide and scrolls sideways (`LegalGraph.tsx:115,121`).
6. She taps Ask agent: the side panel has a minimum width of 320 px (`ResizableSidePanel.tsx`); how it sits over a 390 px page was not read, so this is unverified.

##### Variations
- Landscape phone: same as desktop below the `@3xl` breakpoint; five tiles may still be two columns.

#### STORY-LEG-025: The page fails to load, or a refresh fails mid-scan

**Type**: medium
**Topic**: Load failure
**Persona**: Maya, on a weak connection
**Goal**: Get her dates back
**Preconditions**: D2; network blocked for the overview request.
**Ideal path**: 1 (click Try again)
**Alternate paths**: reload the browser.
**Source**: new

##### Steps
1. Maya opens Legal with the network down. After the skeleton: a red line with the error text and **Try again** (`Legal.tsx:131`, `ErrorNotice`). Nothing else shows (not the header, not Scan now).
2. She reconnects and clicks Try again; the page loads.
3. Variation (mid-scan): during the 4-second polling the connection drops for one request. `useFinanceQuery` keeps the old data but sets the error, and `if (overview.error) return <ErrorNotice>` replaces the whole page with the error (S-LEG-10). The Scanning state is lost until she clicks Try again.
4. The same can happen on window focus or after closing Settings, because those also re-read the overview (`Legal.tsx:83-104`).

##### Edge Cases
- A failed consent read does not hide the page (`Legal.tsx:62-63`); the card just does not show and Scan now stays enabled until the agent reports the problem.
- A failed graph read shows its own error and Try again inside the Graph tab (`Legal.tsx:240-245`).

#### STORY-LEG-026: Hide amounts is switched on

**Type**: short
**Topic**: Privacy preference
**Persona**: Maya, screen-sharing with an investor
**Goal**: Show deadlines without showing contract values
**Preconditions**: D2; Hide amounts is on (set elsewhere in the app; the Legal page has no toggle).
**Ideal path**: 1 (values are masked everywhere on the page)
**Alternate paths**: none.
**Source**: new

##### Steps
1. Maya opens Contracts. The Value column is masked (`LegalContracts.tsx:101`, `hiddenOr`).
2. She opens Deadlines. Quotes and notes are run through the currency masker, so "$7,500 a month" is hidden (`LegalDeadlines.tsx:144,149`).
3. She opens Graph and selects an edge: its quote is masked too (`LegalGraph.tsx:217`). Node labels and attrs are not masked, so an amount in a node label would show.
4. She wants to turn it off: there is no toggle on the Legal page (S-LEG-12 variant).

##### Edge Cases
- The agent's chat replies in the panel are not masked by the Legal page.

#### STORY-LEG-027: Keyboard only

**Type**: medium
**Topic**: Keyboard and screen reader
**Persona**: Maya, uses the keyboard, sometimes a screen reader
**Goal**: Complete the Monday check without a mouse
**Preconditions**: D2.
**Ideal path**: 6
**Alternate paths**: none found.
**Source**: new

##### Steps
1. Tab through the sidebar to Legal and press Enter. The page opens.
2. Tab to the tab list; the three tabs are a tab group labelled "View" (`Legal.tsx:217`). Arrow keys move between them (standard tabs behaviour, not tested in this pass).
3. On Deadlines, each row's buttons are named "Mark <title> done" and "Dismiss <title>" (`LegalDeadlines.tsx:164,173`). She presses Enter on one; the status line "Marked ... done." with Undo appears as a polite status (`role="status"`). Focus is not moved to the Undo button.
4. On Graph, each box is a button with the label "Company: Quill Capital Mock" (`LegalGraph.tsx:160-161`); Enter or Space selects, same again deselects. The relations list appears under the diagram.
5. A screen reader reads the diagram as a group "Legal relationships"; edges carry hover titles but are not focusable.
6. Contracts table has an invisible caption "Contracts" (`LegalContracts.tsx:36-38`).

##### Edge Cases
- After Done the focused button is removed from the page, so focus falls back to the page body.

#### STORY-LEG-028: Deleting the lease file in the Data room

**Type**: medium
**Topic**: Cross-feature consequence
**Persona**: Maya, tidying the Data room
**Goal**: Remove a duplicate lease PDF
**Preconditions**: D2; lease contract with two deadlines and graph nodes linked to its Data room item.
**Ideal path**: 2 (delete the file; Legal warns what will disappear)
**Alternate paths**: none.
**Source**: new

##### Steps
1. Maya opens Data room > Legal, finds the lease and deletes it (Data room flow; its confirm text was not read for this pass).
2. She returns to Legal. The lease row is gone from Contracts, "Renews" and "Renewal notice deadline" are gone from Deadlines, the lease and its edges are gone from the Graph (foreign keys cascade from the Data room item to the contract, to deadlines linked to that contract, and to nodes of that contract, `migration.sql:113-128`; `d8642a65`). A manual deadline attached to the lease's contract also goes.
3. Nothing on Legal says why. **Hesitation:** "Did the app lose my renewal date?"

##### Edge Cases
- Undoing the delete in the Data room, if offered, is not known to restore Legal data.
- Deadlines linked only to a Data room item but not a contract do not cascade; their title link then goes to an item that no longer exists (S-LEG-09).

#### STORY-LEG-029: A contract ends, and its reminders disappear

**Type**: short
**Topic**: Derived deadlines on status change
**Persona**: Maya, terminated the NDA with Acme Ventures
**Goal**: Stop being reminded about it
**Preconditions**: D2 plus an NDA with an open derived "Expires" row.
**Ideal path**: 2 (tell the agent, reminder disappears)
**Alternate paths**: click Dismiss on the row.
**Source**: new

##### Steps
1. Maya opens the panel and tells the agent "We terminated the Acme NDA on October 1."
2. The agent may call `legal_upsert_contract` with status `terminated`. Hypothesis: it does; this is model-dependent.
3. If it does, the open derived rows for that contract are dismissed with the note "Dismissed: the contract no longer has this date." (`legal-tools.ts:365-392`). The row leaves the Deadlines tab; the Contracts row shows Status "Terminated".
4. If it does not, the reminder stays. Maya can click Dismiss herself (STORY-LEG-012).

##### Edge Cases
- Manual deadlines on the contract are never touched.

### Redundancy Candidates (this area)

- Scan now exists in the header and Ask agent can also run a scan by asking in chat; they differ (a chat run does not change "Last scan"), which Maya cannot know.
- "Parties" in Contracts and companies in Graph show the same fact in two places; Graph adds quotes and document links.
- "Next deadline" on Contracts duplicates the Deadlines tab, in a shorter date format.
- "Legal agent" (created by visiting Legal) and the seeded "Legal Desk (mock)" overlap in purpose (STORY-LEG-019).
- The Data room consent and the Legal consent are the same underlying consent for different recipients, shown in two places with different wording.

### Suspected problems (this area)

IDs below are stable for this catalog; all are read from code, none observed in a browser.

- **S-LEG-01** Unreviewed documents tile counts every ready Data room file in all folders (`db/legal.ts:89-103`, `api-legal.ts:39`); first-time reading "9" with four contracts is confusing and the tile has no explanation or link.
- **S-LEG-02** (hypothesis) The seed PDFs state "31 January" and "30 November" without a year; the agent is told never to invent a date, so the first scan may produce no deadlines and a dashed table.
- **S-LEG-03** `not_legal` rows are filtered out (`db/legal.ts:12,169`); there is no skipped list, no "Mark as legal", no "Add contract". A wrong judgement can only be fixed by chatting or re-uploading.
- **S-LEG-04** Contracts and deadlines found only in mail or Drive are reported in the chat reply and never recorded (`legal-agent.ts:12`); the Legal page cannot show them.
- **S-LEG-05** The page's Unreviewed count is not filtered by denied connections (`api-legal.ts:39`) while the agent's own list is (`legal-tools.ts:252-253`). A file imported through a denied connection could keep the tile above zero forever. Hypothesis from code; needs a denied connection to confirm.
- **S-LEG-06** No history: once Done or Dismissed (after the 8-second Undo, `LegalDeadlines.tsx:15`) a deadline cannot be seen or reopened from the UI; a second close replaces the first Undo; switching tabs drops the Undo.
- **S-LEG-07** Nothing on the page says the scan runs daily at 06:00 UTC (`legal-agent.ts:19`); a paused or disabled routine is invisible; no notification is sent (`notify: false`, `legal-agent.ts:49`).
- **S-LEG-08** Consent card has no Not now, no list of folders, no way to review or revoke it on Legal (`ConsentPrompt.tsx`); granting also releases waiting Data room items (`api-legal.ts:188-217`) without saying so.
- **S-LEG-09** `DataRoom.tsx:199-211` swallows a failed lookup of the linked item (`.catch(() => undefined)`), so a stale link opens the Data room with nothing selected and no message.
- **S-LEG-10** A failed re-read replaces the whole Legal page with the error (`Legal.tsx:131` with `useFinanceQuery` keeping data but setting `error`); this includes the 4-second scan poll, window focus and closing Settings. Also: a scan that finds nothing leaves the page looking exactly like "never scanned" (`Legal.tsx:208`).
- **S-LEG-11** The selected tab is local state (`Legal.tsx:65`), so Back from the Data room, a reload or a revisit always lands on Contracts.
- **S-LEG-12** Deleting a Data room document silently deletes its contract, linked deadlines (including manual ones) and graph nodes through cascading foreign keys (`migration.sql:113-128`, commit `d8642a65`); Legal gives no warning or trace. The Legal page has no Hide amounts toggle even though it masks values.
- **S-LEG-13** Graph: no legend, no search, labels cut at 27 characters, boxes do not link to their document (only relation rows do), deselect only by clicking the same box again.
- **S-LEG-14** Date formats differ between tabs: "Nov 30" (Contracts, `shortDay`) vs "Nov 30, 2026" (Deadlines, `fullDay`).
- **S-LEG-15** The "Ask agent" button does not name the Legal agent; it disappears while the panel is open; and the page shows no "not legal advice" notice (only the agent's instructions say it).
- **S-LEG-16** (hypothesis) The Legal agent's tool list includes `web_search`, `web_fetch` and the memory tools (`contracts/legal.ts` `LEGAL_AGENT_BUILTIN_TOOLS`), but the consent card describes only document text going to the model provider. Whether contract facts can reach a web query or saved memory was not traced.


---
