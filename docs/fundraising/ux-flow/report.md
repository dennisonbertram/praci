# UX Flow Critique: Investors and Fundraising (planned) — 2026-10-20

The feature is not built. Critics read the plan (`docs/fundraising/README.md`), the
mockup (`docs/fundraising/mockup.html`) and its screenshots (`screens/`), and the story
catalog (`docs/fundraising/ux-paths/catalog.md`). Steps are counted from the plan.

## Run summary

| Metric | Value |
|--------|-------|
| Journeys critiqued | 6 (plus one cross-cutting redundancy critic) |
| Evidence source | Plan and static mockup; no live app |
| Verdicts | 0 minimal · 4 acceptable · 2 convoluted in part (source switching, portal access) |

## Friction scorecard

| Journey | Steps (planned/ideal) | Main friction | Verdict |
|---------|-----------------------|---------------|---------|
| [FR-004](journeys/FR-004.md) Type the cap table in | 9 / 4 | Save click, source chips that replace the table, SAFE in two places | acceptable; source switching convoluted |
| [FR-010](journeys/FR-010.md) Monthly update, review and send | 5 / 4–5 | Editor field count, Share to portal next to Send, draft shown twice | acceptable |
| [FR-022](journeys/FR-022.md) Investor reads the portal | screens near minimal | Access model: one-use link, Bcc footer, revoke leaves shares | convoluted (access model only) |
| [FR-028](journeys/FR-028.md) Audit request, happy path | 5 / 3 | Jan–Mar weekly routine, double filing, manual Done | acceptable |
| [FR-039](journeys/FR-039.md) SAFE from a committed prospect | 7–8 / 3 | "Committed" means three things; SAFE enterable in three places | acceptable on steps, convoluted on definitions |
| [FR-051](journeys/FR-051.md) Six-week round, end to end | — | Pipeline row not linked to its SAFE; agent cannot read the round | acceptable |

## Redundancy map (from [redundancy.md](redundancy.md))

- **Duplicate paths (10, 8 to change).** SAFE entry: cap table editor, Fundraising dialog,
  Mercury. Portal access: Send link, Share document, Send update. Drafting an update: routine,
  editor button, chat, slash command, Message the board. Refresh vs Re-read.
- **Duplicate information (6, 5 to change).** SAFE totals disagree across pages
  ("incl. $450k", "$700k", rows summing to $600k; "6.7% at cap" vs rows 3.1% + 2.5%). An unpaid
  SAFE appears as an Investors action item and a Fundraising row. A pending draft shows in
  Action items and in Updates.
- **Overlapping features (6).** Four agents hold part of a deposit answer (Investors, Finance,
  Mercury, Carta). Cadence control vs routine editor. Message the board vs New update.
- **Hierarchy and IA (6).** The page split and section order are sound. Naming: "Committed",
  "Update" vs "board note", "Edit here", Cap Table folder under the Investors page.

## Simplification proposals (ranked)

### 1. One SAFE vocabulary and one place to enter a SAFE
- **Now:** "Committed" means signed SAFEs (Round), committed prospects (mockup bar) and a
  stage; SAFEs can be typed in the cap table editor, the Fundraising dialog, or come from Mercury;
  Harbor Angels shows as Committed prospect, Signed SAFE and holder at once.
- **Proposed:** "Committed" is only the pipeline stage. Round bar reads Funded · Signed ·
  Committed (no SAFE yet) · Target. SAFEs are entered only on Fundraising (one "Send SAFE" on a
  Committed row: opens Mercury's SAFE page when Mercury is connected, otherwise the native dialog
  that inherits the round's terms). Remove `SAFE` from the native cap table security list. A
  prospect with an active SAFE leaves the pipeline; the row shows the SAFE status. Signing flips
  the contact to investor and keeps its stage. Every SAFE total comes from one function.
- **Saves:** 4–5 steps on FR-039; removes the double count on both pages. **Effort:** M.
- **Evidence:** FR-039, FR-051, redundancy.md Duplicate Information.

### 2. Portal access model (fixes blockers PG-40, PG-41, PG-42)
- **Now:** 15-minute one-use link, then a 30-day cookie; update footer link in one Bcc message;
  Revoke deletes tokens but leaves shares, so `/portal` re-issues access.
- **Proposed:** one reusable link per contact, opened through a landing page with an Open
  button (scanners and unfurlers do not start a session). Updates go as one message per
  recipient carrying that contact's link. Revoke sets `Contact.portalBlockedAt`; the request form
  and the link refuse blocked contacts. A dead link says "This link no longer works" with the
  email field inline. Access is created only by sharing (an update send or a document share);
  the standalone Send link becomes Resend on contacts that have shares.
- **Saves:** removes three blockers and one founder step. **Effort:** M. **Evidence:** FR-022.
- **Decision needed:** link lifetime (see the plan's Decisions).

### 3. Cap table source as a line, not chips
- **Now:** Carta · Google Sheet · Edit here chips in the header replace the table on click;
  no precedence rule; native edits need Save.
- **Proposed:** "<Source> · as of <date>" with "Change source" in the menu; the last chosen
  source wins and Carta stops auto-syncing until chosen again; the previous snapshot is kept one
  version back with Undo (fixes blocker PG-19). The native table is always editable with autosave
  and defaults. One refresh icon for Carta and sheet. Rename "Edit here" to "Type it in".
- **Saves:** 5 steps on FR-004; removes a data-loss path. **Effort:** S–M. **Evidence:** FR-004.

### 4. Audit intake on arrival, not a seasonal routine
- **Now:** weekly Jan–Mar routine with a 120-day grep; misses October; double files attachments.
- **Proposed:** start `audit-response` from the existing mail-attachment filing job
  (`enqueueMailAttachmentFiling` in `packages/adapters/src/mail-attachment-filing.ts`) when an
  incoming message matches, passing the filed Data room item id. The row closes itself when the
  draft's thread shows a sent reply; Mark done and Dismiss go in the row menu; one notification
  at Draft ready naming the fund.
- **Saves:** removes stories 406 and 409 as workarounds. **Effort:** M. **Evidence:** FR-028.

### 5. A smaller update editor and one way in
- **Proposed:** Subject (merges Title), To, Body; audience fixed by how the update was started.
  Send also shares to the portal; "Share to portal" shows only without Gmail. Highlight leftover
  TBD and ask once before send. Autosave. A pending draft appears only as an Action item.
  "Message the board" on the Board tab is the only board entry; New update means investors. One
  Reminder menu (investor update cadence); the board routine is dropped. Call everything "update".
- **Saves:** 1–2 steps and several controls. **Effort:** S. **Evidence:** FR-010.

### 6. The Investors agent reads Fundraising
- **Proposed:** add a read-only `fundraising_read` tool (round, prospects, SAFEs with status
  and deposit match) to the Investors agent. Carta and Mercury agents stay connectors. The SAFE
  row's deposit line answers deposit questions on the page.
- **Effort:** S. **Evidence:** FR-051, redundancy.md Overlapping Features.

### 7. Mockup fixes
- Make every total add up; drop the header New SAFE button, the stage chip on pipeline rows,
  "Create SAFE" on rows that have a SAFE, the editor footnote and "SAFEs shown unconverted";
  use "Open" for row actions.

## Already minimal

- The Investors/Fundraising split and the Investors section order.
- One Investors agent behind Ask on both pages.
- The portal's own screens (updates and documents, nothing else).
- The founder's audit path once a draft exists (open draft, compare, send).
