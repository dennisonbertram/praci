# Redundancy and information architecture: Investors and Fundraising (planned)

Critic: redundancy and IA. Scope: the plan (`docs/fundraising/README.md`), the mockup screenshots in `docs/fundraising/ux-flow/screens/` (investors, fundraising, editor, empty, phone), and the path catalog (`docs/fundraising/ux-paths/catalog.md`, R1 to R20, PG ids). Nothing here was run; the feature is unbuilt. "Plan" means the README, "mock" means a screenshot.

Verdict: acceptable at the structure level (the Investors/Fundraising split is sound, and Ask opening one agent from both pages is clean), but convoluted in four places: the SAFE money figures, the three-to-five ways to give a portal link, the header control count on Investors, and the editor's three overlapping send buttons plus duplicated title fields.

Heuristics used: 12 once and only once, 13 one way to do one thing, 14 one concept one name, 15 feature overlap, 8 take-away, 10 hierarchy, 11 progressive disclosure.

## Duplicate Paths

### DP1. Four ways to give an investor portal access
- Evidence: plan lists the contact menu "Send link" (line 236), "Share with investors" on a document (239), editor "Send" which also shares and editor "Share to portal" (245, slice 6 line 541), and the public `/portal` request form (263). Catalog R6, R7. The standalone Send link creates a portal with nothing in it when the contact has no shares (PG-52).
- Judgement: the shares are the real thing (`InvestorShare`); a link without a share is an empty page. Sending a link on its own is drift from "Portal access" being modeled as a contact property.
- Recommend (plan change): access is created only by sharing an update or a document. Remove the standalone "Send link" from the contact row and menu. Keep on the contact menu only "Resend link" and "Revoke", shown only when the contact has at least one share. The Contacts "Portal" column (mock: Active, Link sent) stays as read-only state. The request form stays for returning investors only (R7).

### DP2. Send, Share to portal, and Draft with agent as three equal buttons in the editor
- Evidence: mock-editor shows three buttons side by side; Send "also shares" (plan line 245); Share to portal is "the no-Gmail fallback" (R7, FR-013). With Gmail connected, "Share to portal" alone is the rare case; without Gmail, "Send" is already replaced by "Connect Gmail to send".
- Recommend: one primary button. With Gmail: "Send" (emails and shares). Move "Share to portal only" into a secondary menu on Send. Without Gmail: primary becomes "Share to portal", with "Connect Gmail" as the secondary. The editor never shows both Send and Share to portal as equal choices.

### DP3. The same SAFE can be entered three ways
- Evidence: plan data model offers a `SAFE` value in the native cap-table `security` enum (line 138), `New SAFE` on Fundraising (slice 10), and a SAFE created in Mercury (slice 11). Catalog R2, PG-76 (double counting, de-dupe only against snapshot holders by email).
- Recommend: remove `SAFE` from the native `security` enum in slice 3. SAFEs exist only as `Safe` rows created on Fundraising or synced from Mercury, and appear on Investors as unconverted rows. State this rule once in the plan.

### DP4. Add contact (Investors) and Add prospect (Fundraising)
- Evidence: mock-investors header has "Add contact"; mock-fundraising header has "Add prospect". A prospect is a `Contact` with `stage` (plan line 140); both write the same table. R18, PG-66.
- Recommend: keep both entry points (different contexts) but build one dialog. On Fundraising it opens with kind prospect and a Stage field; on Investors it opens with kind investor and no stage. State that prospects do not appear in the Contacts tabs (the tabs are Investors, Board, Auditors, Other, plan line 235) until their kind changes, so the same person is not listed twice.

### DP5. Two toggles for Hide amounts
- Evidence: both screenshots show an eye icon in the header. Catalog notes the Fundraising toggle only as an alternate path (FR-007).
- Recommend: one preference, shared across Investors, Fundraising, and the update editor; say in the plan that it is one setting. Do not store per page.

### DP6. Message the board and New update then Audience: Board
- Evidence: plan line 370 ("Message the board opens a new update with audience board"), editor Audience toggle in mock-editor, button in mock-investors Contacts header. R4.
- Recommend: keep the Audience toggle (canonical, one editor). Drop the "Message the board" button from slice 8 unless the build shows board updates are common; the Board tab then shows contacts only. If kept, the plan must say it is a shortcut to New update with Audience preset, not a separate flow.

### DP7. Five ways to draft an update
- Evidence: editor Draft with agent, agent chat, `@investor-update`, monthly routine, and the old Gmail-draft behavior of `carta-investor-update` (R3, PG-39).
- Recommend: keep the routine and the editor button (both write the same `InvestorUpdate` row via `investor_update_draft`). Chat is the same skill and needs no UI. Slice 5 must remove the Gmail-draft behavior from the skill, which the plan already implies; say it explicitly.

### DP8. Audit requests entering from three places and one that does not exist
- Evidence: auto filing of attachments (`mail-attachment-filing.ts`), the agent's `add_to_data_room`, and on-demand Ask (R16, PG-57). The plan assumes "requests that arrive elsewhere are added by hand" (Assumptions, line 705) but no control exists (R17, PG-53). Mark done is manual although the draft is a Gmail draft the founder sends (R19).
- Recommend: delete the "added by hand" assumption; the hand path is "Ask the agent" (FR-036), which already works. Make `audit-response` check the Data room for the attachment before filing. Detect a sent reply to the thread and set Done, keeping Mark done as a fallback.

### DP9. Document sharing from two screens
- Evidence: Investors Documents card (mock-phone shows "Shared with" column) and Data room documents (R11). They use the shared `FolderDocuments` component.
- Status: acceptable; deliberate. Keep both, because they are one component with one menu item. No change except to confirm in the plan that the menu item is not built twice.

### DP10. Two source pickers for the same choice
- Evidence: the empty state (mock-empty) offers Connect Carta, Use a Google Sheet, Edit here. Once data exists, mock-investors header always shows the same three as pills (Carta, Google Sheet, Edit here) next to a refresh icon, Add contact, Ask, and the eye icon. That is seven header controls on a phone-width wrap (mock-phone wraps them to two rows).
- Recommend: after the first choice, replace the three pills with the existing meta text ("Carta · as of Sep 30") as a menu that offers "Switch source". Switching is rare and destructive (PG-19), so it should be less prominent, not a persistent tab group.

Count: 10 (8 recommend change, 1 keep both, 1 shared-component keep).

## Duplicate Information

### DI1. SAFE totals disagree across the two pages
- Evidence (invented numbers, screenshots): mock-investors Raised card "$1.45M incl. $450k in SAFEs"; mock-fundraising bar legend "Funded $450k, Signed $50k, Committed $150k, Target $1M"; SAFEs header "4 · $700k". Four SAFEs: 250 + 200 funded, 50 signed, 100 draft. The "Committed $150k" is the two pipeline prospects in the Committed stage (Harbor Angels $50k, Dana Whitfield $100k). Harbor already has a Signed SAFE and Dana already has a Draft SAFE, yet both rows still show "Create SAFE" in the pipeline. So Harbor's $50k is counted in Signed and in Committed. The plan text says "committed (signed SAFEs)" (line 251), which does not match the mock. Catalog R10, R15, PG-65, PG-71.
- Also: Investors legend says "SAFEs at cap 6.7%" but the two rows show 3.1% and 2.5%, which sum to 5.6% (PG-74).
- Recommend: one rule per label. Round bar shows only SAFE-derived amounts: Funded and Signed (plus Target). Remove the pipeline stage amount from the bar. Drop the "incl. $450k in SAFEs" hint from the Raised card, or define Raised as equity only and show SAFEs on their own line. The Investors cap table owns unconverted SAFE percent; Fundraising owns dollar totals. Hide "Create SAFE" once a SAFE exists for that prospect (`Safe.contactId`).

### DI2. The same fact stated twice in one row or screen
- Evidence (screenshots):
  - Pipeline: each row sits under a stage header ("Diligence 1") and also carries a stage chip "Diligence"; same for Meeting, Intro, Target.
  - Updates and Action items: "October update, Investors · draft" with a "Draft" chip; the Action item row says "Drafted Nov 1 by Investors agent" with a "Draft" chip.
  - Update rows: status chip (Sent) and a button "Open"; draft chip and "Review".
  - SAFE rows: "$8M cap" on every row, while the round card already says "Post-money cap $8M · MFN"; "Mercury" in the header meta, on each row subtitle, and (plan line 258) as a "From Mercury" chip.
  - Editor (mock-editor): title "October update", Period "October 2026", and Subject "Example Robotics · October update" are one fact in three places.
- Recommend: remove the stage chip from pipeline rows; remove the word "draft" from subtitles when a chip shows it; show cap and source on a SAFE row only when they differ from the round or the page source; collapse Title and Subject to one field (Subject, default "<Company> · <Period> update") and keep Period as the only structured field. PG-27 already asks whether Subject is stored.

### DI3. Drafted update appears as an Action item and as an Updates row
- Evidence: both visible in mock-investors and mock-phone, both with Draft and Review. R8.
- Recommend: the unreviewed routine draft appears once, in Action items (it is the notification landing). When opened or edited, it becomes a normal Updates row. The Updates list shows Sent history plus manually created drafts. If this needs a flag the plan must add one (for example `reviewedAt`); if that cost is not worth it, keep the Action item row and drop the Review button from the Updates draft row so the two do not both read as the primary action.

### DI4. "Waiting" signals for an unpaid SAFE
- Evidence: Investors Action item "SAFE signed, not funded" with chip "Awaiting deposit"; Fundraising SAFE row "no deposit found" and chip Signed; sidebar dot on Investors (all screenshots). R9, R20, PG-11, PG-12.
- Recommend: one predicate `needsAttention` in `packages/core/src/safes.ts` feeds the Action item and the badge. The Fundraising row shows state (chip), not a second call to action. State in the plan which events notify (routine draft ready, new audit request) and that Mercury sync changes do not.

### DI5. The same investor in four records
- Evidence: prospect contact, investor contact, `Safe.investorName`, cap table holder (R14, PG-68). The data model already has `Safe.contactId`; the mock shows check size on the prospect row and SAFE amount on the SAFE row with no link.
- Recommend: link by contact id; the pipeline row shows check size until a SAFE exists, then the SAFE amount. Holder rows display "investor" chip from the contact (mock-investors) with no second source of truth.

### DI6. Cap Table folder name against Documents section against Data room
- Evidence: Documents card lists files from `["Finance", "Cap Table"]` (plan line 238); sidebar still has Data room. PG-05.
- Status: acceptable, deliberate (existing files stay). No change; one line in the plan is enough.

Clean checks: no duplicate "as of" date on Investors (the header meta carries it once); the Contacts Portal column and the Documents "Shared with" column show different facts.

Count: 6 (5 recommend change, 1 keep).

## Overlapping Features

### OF1. Four agents each hold part of "was the deposit paid"
- Evidence: Investors, Finance, Mercury integration agent, Carta (R13, PG-08, FR-055). The mock sidebar Bots list shows Investors agent, Carta agent, and Finance agent as three chat targets. The plan gives the Investors agent no Mercury tools (line 341) and no tool to read the round, stage or SAFEs (PG-07), so it must hop with `message_bot`.
- Recommend: add a read-only `safes_read` tool (round, SAFE rows with derived status and the matched-deposit flag from the DB) to the Investors agent. It then answers deposit, pipeline and SAFE questions from synced rows plus `finance_overview`, with no hop to the Mercury agent. The Mercury integration agent stays the connector and is not a place to ask about SAFEs. Update the Ask suggestions on Fundraising accordingly.

### OF2. Carta agent beside the Investors agent on the same page
- Evidence: after slice 2 the Carta agent keeps `cap_table_update` and `contacts_add` and its sync prompt; the Investors agent also reads the cap table, and may call `cap_table_update` for a sheet read (plan lines 195 to 203). Both sit in the mock Bots list. PG-03, PG-20 (which source wins).
- Recommend: Ask on both pages always opens the Investors agent (already planned; clean). Treat the Carta agent as a connector, not a chat destination: say in the plan that it is listed with integration agents and the Investors page never links to it. State one writer per source (Carta sync writes Carta snapshots, sheet read writes sheet snapshots, the editor writes native) and that choosing a source stops the others from writing.

### OF3. Refresh and Re-read, and a third refresh on Fundraising
- Evidence: plan names Refresh (Carta), Re-read (sheet), and the Fundraising refresh (slice 11); the mock shows one refresh icon on each page header and no Re-read control. RPCs `carta.refresh`, `investors.rereadSheet`, `fundraising.refresh`. R1.
- Recommend: one refresh icon per page with a tooltip that follows the source ("Re-read sheet"). Internally `investors.refresh` dispatches by source. Native source hides it (plan already says Carta Refresh is hidden for native). Fundraising's icon is the same pattern for Mercury.

### OF4. Cadence pills against the routine editor and the agent
- Evidence: Updates header shows Monthly, Quarterly, Off as three pills next to New update (mock-investors); plan says the control rewrites `crons` and `active`. The board routine ("off by default") and Audit season routine have no control at all (R5, PG-35). Routines are also editable elsewhere (`RoutineEditor`) and by asking the agent.
- Recommend: replace the three pills with one "Reminder: Monthly" menu (progressive disclosure; set once). Do not add controls for the board or audit-season routines; they are edited in the existing routine editor on the agent. Slice 8's board routine is speculative (off by default, no UI): remove it from slice 8 and add it when someone asks.

### OF5. Message the board against New update
- See DP6. Same recommendation, listed here because the overlap is a feature overlap (two buttons, one editor).

### OF6. Finance deposit classification and Fundraising "Deposit matched"
- Evidence: Mercury SAFE rows link a `FinanceTransaction` best effort (plan line 342); Finance already classifies those transactions. PG-81 (no manual Funded for a Mercury row; no link to Finance).
- Recommend: the Fundraising row's "No deposit found" links to the Finance page filtered to financing transactions near that date. Do not build a second reconciliation UI on Fundraising.

### OF7. Share update, share document, send link: one "portal" concept with four verbs
- Evidence: "Send link", "Send portal link", "Portal access", "Share to portal", "Share with investors" (plan lines 236, 239, 245, 541). See DP1 for the path fix; this is the naming side and is in Hierarchy & IA.

Clean checks: Ask on Investors and Ask on Fundraising open the same agent (FR-050) and need no merge; the Investors agent has no `mail_send` while the Inbox composer sends, so the "agent sends" path does not overlap the "user sends" path.

Count: 6 (OF5 is a repeat of DP6; OF7 is cross-referenced to Hierarchy & IA).

## Hierarchy & IA

### HI1. Section order on Investors
- Evidence: plan order Action items, Cap table, Updates, Contacts, Documents (line 224 onward); mock-investors places Updates and Contacts side by side below the cap table; mock-phone puts Updates about 60 percent down.
- Assessment: Action items first is right (only when present). Cap table second is right for orientation. Documents last is right (lowest frequency). The order matches priorities; keep it.
- Problem: four KPI cards (Fully diluted, Raised, Option pool, Latest 409A) occupy a full row above the table, pushing Updates below the fold on web and further on a phone. Option pool and 409A are reference values, not decisions.
- Recommend: keep the section order. Collapse the KPI row to two cards (Fully diluted, Raised) and show pool and 409A in the holdings table, where the Pool available row already exists, or as one meta line. Update the mockup accordingly.

### HI2. Investors header carries seven controls
- See DP10. Recommend: Title and meta, refresh, eye, "Add contact", "Ask", and nothing else; source switching moves into the meta menu. Primary action: Ask (black) is the only filled button, which is correct on Investors. On Fundraising two filled buttons compete (New SAFE and Ask in mock-fundraising); demote Ask to outline or keep New SAFE as the only filled one.

### HI3. The Investors/Fundraising split
- Assessment: the split is right. Investors is about who owns the company and communicating with them; Fundraising is a time-limited process with a pipeline and money in flight. They also have different lifetimes (Fundraising can be hidden after the round, FR-052).
- Leaks: (a) SAFE Action items live on Investors though their "View" opens Fundraising, so a Fundraising task needs a cross-page hop; Fundraising has no badge or attention row of its own (PG-12). (b) The Raised card on Investors mixes in SAFE dollars (DI1). (c) Prospects added on Fundraising are contacts but invisible in the Contacts tabs (DP4).
- Recommend: SAFE-needs-attention rows go to the top of Fundraising (new Action strip, only when present); Investors Action items keep audit requests and update review. The sidebar dot shows on whichever page holds the item. If the user has hidden Fundraising, do not surface its items on Investors (hiding is an explicit choice). Trade-off: this adds a badge surface; the alternative is to leave SAFE rows on Investors and accept the hop. Lean: move.

### HI4. One concept, one name
| Concept | Names found | Recommend |
|---|---|---|
| Pipeline stage versus SAFE-derived money | "Committed" stage (pipeline, plan line 253), "Committed $150k" in the round bar, "committed (signed SAFEs)" (plan line 251) | "Committed" only for the pipeline stage. SAFE money is "Signed" and "Funded". Remove "committed" from the Round card. |
| Money received | Funded (chip, bar), paid (`paidAt`), "Awaiting deposit", "No deposit found" | Chip "Funded"; the unpaid wording is one phrase, "Awaiting deposit", used in both places (DI4). |
| Person | Investor, contact, holder, prospect | Contact is the record. "Holder" only as the cap table column; "Prospect" only as a stage-bearing kind; document in the plan glossary. |
| Update | Update, "Q3 board note" (mock row), "board update" (plan), "Message the board" | Always "Update" with an Audience of Investors or Board; the mock row title should read "Q3 board update". |
| Portal access | Send link, Send portal link, Portal access, Share to portal, Share with investors | Two verbs only: "Share" (an update or document, with a portal) and "Revoke" (access). See DP1. |
| "Investors" | page name, Contacts tab ("Investors 4"), update Audience, "Investors agent", `kind: investor` | Acceptable, because each is in its own context, but the agent is on the same screen as the tab and the audience. Low priority; if renaming, rename nothing and keep the capitalization consistent. |
| Row actions | Open draft, View, Review, Open | One verb, "Open", for all four; the chip carries the state (Draft ready, Awaiting deposit, Draft, Sent). |
| Cap Table | folder name, Documents section, "Cap table" section title | Fine; folder name kept on purpose (PG-05). |

### HI5. Explainer copy
- Evidence: mock-editor footnote "TBD stays TBD until you fill it. Send adds the portal link in the footer." (restates behavior; AGENTS.md says no explainer text); mock-investors "SAFEs shown unconverted" label above the cap table bar, while rows already carry a SAFE chip and "at cap".
- Recommend: remove both. The TBD risk is solved by a guard at Send (PG-29), not by a line of text; show a count of TBD items on the Send button only when present. Plan must quote any retained copy in the PR description per AGENTS.md.

### HI6. Navigation depth
- All primary destinations are one click from the sidebar (Investors, Fundraising). The editor is `/app/investors/updates/:id` (two levels) and the SAFE cover summary opens from a Fundraising row. Both are appropriate; the editor has a Back to Investors button (mock-editor). No deeper than two levels. Clean.
- Rarely used but at top level: the source control (see DP10); Add contact on Investors header beside Ask (used less than Review and Open); acceptable.

Count: 6 items (HI1 order and KPI row, HI2 header, HI3 split, HI4 naming table of 8 rows, HI5 copy, HI6 clean).

## Top plan changes (ranked)

1. Fix SAFE money vocabulary: bar shows Signed and Funded only, "Committed" is pipeline stage only, remove "incl. $450k in SAFEs" from Investors, hide Create SAFE once a SAFE exists, reconcile 6.7% versus 5.6%.
2. Make shares the only way to create portal access: drop the standalone Send link, keep Resend and Revoke on contacts that have shares, and merge Send and Share to portal into one primary button with a secondary option.
3. Remove `SAFE` from the native cap-table security enum so SAFEs are entered only on Fundraising or from Mercury.
4. Declutter the Investors header: collapse the Carta, Google Sheet, Edit here pills into a source menu, use one refresh icon, one shared Hide amounts preference, and one Reminder menu instead of three cadence pills.
5. Give the Investors agent a read-only `safes_read` tool and treat the Carta and Mercury agents as connectors, so SAFE and deposit questions have one owner; move SAFE needs-attention rows to Fundraising.

Smaller: one verb "Open" for row actions, collapse Title and Subject in the editor, drop the stage chip on pipeline rows, drop the board routine from slice 8, delete the "added by hand" audit assumption, remove the two explainer lines.
