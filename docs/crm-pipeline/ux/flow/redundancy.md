# CRM pipeline: redundancy and information architecture critique

Nothing here is built. I judged `docs/crm-pipeline/PLAN.md`, the ten images in `docs/crm-pipeline/`,
`apps/web/src/pages/CrmPipeline.stories.tsx`, its fixtures, and the app code at this worktree's HEAD. I
read `origin/feat/investors-agent-rounds` where the plan depends on it. I did not run the app or
Storybook. Every failure described below is read from code or images, and anything about future
behaviour is marked as a risk or a proposal. All data named here is the mockup's invented data.

Severity: **High** means the plan would lose existing behaviour or corrupt a number or field. **Medium**
means a person sees two answers or does a job twice. **Low** is small but clear. Heuristic numbers refer
to `simplification-heuristics.md`.

The main result: the plan's data model and its choice of Fundraising as the owner hold up. Its largest
problem is an omission. Send SAFE, Waiting for Mercury, the SAFE rules and the page's SAFE sections
appear nowhere in the plan or the mockup, and the plan's main new ability, an existing investor on the
pipeline, conflicts with those rules.

## Duplicate Paths

### DP1. High: four ways to create a prospect, and the plan connects only one

Today every route ends in the same place because the pipeline is "contacts of kind `prospect`"
(`packages/db/src/fundraising.ts:49`). The routes are:

- Add prospect on Fundraising (`Fundraising.tsx:58,267`).
- The Kind picker on the Contacts page (`ContactDialog.tsx:278-284`).
- `contacts_add` from an agent, which accepts a kind (`packages/adapters/src/contact-tools.ts:78-82`). The
  overview has a comment for exactly this case: "A prospect made without a stage (for example by an
  agent) starts at Target" (`fundraising.ts:61`).
- The list import.

The plan moves membership to `pipeline_records` and defines creation only for reconcile. It does not say
what Add prospect creates, even though the mockup shows the button (`CrmPipeline.stories.tsx:1074-1077`).
Under the plan as written, a contact saved as Prospect from the Contacts page or by `contacts_add` would
be labelled Prospect and would not appear on the pipeline.

**Fix.** State one rule in S1: any write that leaves a contact with kind `prospect` and no fundraising
record also creates a one-person record. Add prospect uses the same write.

### DP2. High: two editors for the same fields, and one overwrites the status

After S1, `ContactDialog` and the new table both edit status, amount and next step. The dialog sends
`stage`, `checkSizeCents` and `nextStep` on every save of a prospect, including one that only fixes an
email (`ContactDialog.tsx:115,185`). A stage is coarser than a status: `not_contacted`, `called` and
`left_message` all roll up to `target` (`fundraising-call-fixtures.ts`, `STATUS_STAGE`). The plan says
"writes to those fields go to the record" but gives no mapping from a stage back to a status. Risk: editing
a contact's email could turn Left message into Not contacted. For a firm with several people, editing one
person's dialog also rewrites the firm's amount.

**Fix.** Remove Stage, Check size and Next step from `ContactDialog` in S1. See IA2 for what the contact
page shows instead.

### DP3. Medium: one call can be recorded three separate ways

A single call can be recorded as:

1. A logged call (`pipeline_events` kind `call`).
2. A status of Called or Left message.
3. A recording from Granola or another meeting source.

The plan never says that logging a call changes the status, and never says how a logged call and a
recorded meeting of the same call are matched. The timeline can therefore show the call twice, while the
status still says Not contacted. The mockup hides this: `t3` shows a Granola recording as kind `call`
(`CrmPipeline.stories.tsx:1129-1135`), and the fixtures stay consistent only because they were written by
hand. On the same screen, "Voicemail" (`t7`) restates the status Left message.

**Fix.** Make Log the one write. Its outcome advances the status forward only (Spoke to Called, Voicemail
to Left message) and never moves it backward. Show a recorded meeting as its own entry, and offer "Log a
call" only when no meeting by a record person exists that day. The owner should confirm this behaviour.

### DP4. Medium: the date is entered twice, and a sent invite can go stale

The popover asks for the date and time, then its Send invite opens a dialog that asks again (heuristic 3).
The images show the two disagreeing for the same row: the popover in `crm-row-hover.png` has 11/02/2026,
and the dialog in `crm-invite-confirm.png` has 11/06/2026 (hard-coded at `CrmPipeline.stories.tsx:499`).
The plan also does not say what happens when the date changes after an invite was sent. "Invited" has no
column in the model, the row would keep saying Invited, and the calendar event would keep the old time.

**Fix.** Carry the popover's values into the dialog. Define "Invited" as "an invite event exists for this
exact next call date", so changing the date removes the word and offers Send invite again. Updating the
existing event can wait, but the plan should say so.

### DP5. Medium: a contact made for a firm with no person

Plan section 1 and its Decisions save the firm itself as a contact "so every row is a contact". The plan
also says most rows on a real list have no usable address, and that `contactDetail` finds mail and meetings
by address. These firm contacts therefore have no mail, no meetings and nobody to invite. They would add
firm names to the Contacts page, which lists people's names and emails, and they remain linked after a
real person is added. They also create questions on the review card, such as "Example Peak Ventures" in
`crm-reconcile-card.png`. Nothing needs them: the record already holds the firm's name, and the story
already renders a row with no person (`CrmPipeline.stories.tsx:906-913`). The review branch made firm-only
contacts because a contact was then the only possible row. A record removes that reason.

**Fix.** Allow a record with zero people. Backfilled firm-only contacts can stay as they are. The owner
listed this as a default, so it can still change.

### DP6. Medium: Add prospect and import would use different duplicate rules

`ContactDialog` warns on the same email only (`ContactDialog.tsx:117-125`). Reconcile has a five-rule table.
A record is unique on normalized name, and the plan does not say what Add prospect shows when that firm
already has a record. **Fix.** Send Add prospect through the same match function and open the existing
record on a conflict.

### DP7. Low: Create is the first option in the Referred by picker

In `crm-referred-by-picker.png`, typing "Riley" highlights Create "Riley" above the existing contact
Riley Placeholder. Pressing Enter would create a duplicate, and the plan leaves contact merging out. **Fix.**
Put Create last and never highlight it first while a match exists.

### Passes

- **Send invite in three places (popover, phone sheet, investor page).** All three open one
  `InviteDialog` and one RPC. The popover and the sheet serve different input types, and the investor page
  is the place a person reads the record. These are shortcuts to one route, which heuristic 13 allows.
- **Investors contacts, Fundraising Pipeline and Contacts page.** They answer different questions: people
  with a stake and their portal access, firms being raised from, and the whole address book. No merge is
  needed. See IA1.
- **Phone interest menu and sheet toggles.** The menu is a one-tap shortcut for the same field, and the
  plan states this on purpose.
- **"2 overdue" and "2 today".** These set the `next` filter rather than running a second query.

## Duplicate Information

### DI1. High: Stage and Status are two vocabularies for one fact

`stageOf: STATUS_STAGE` keeps Stage alive while Status becomes the visible word. The same firm would read
"Called" on the table and "Stage: Target" on each person's contact page (`ContactDetail.tsx:93`). The
Investors contact tab also keeps its Stage filter and sort (`Investors.tsx:1093-1097,1105-1108`). Once an
investor is matched to a record, `toContact` starts returning a stage for them, so that filter would appear
on Investors for contacts that previously had none. **Fix.** After S1, show only Status. Stage can remain an
internal roll-up if something still needs it, and is never displayed or written.

### DI2. Medium: Status repeats what the columns and timeline already show

Status says what has happened, and so do other parts of the same row:

| Status | Same fact elsewhere |
| --- | --- |
| Not contacted | Last call is empty |
| Called | Last call has a date |
| Left message | A logged Voicemail |
| Meeting booked | Next call plus Invited |
| Met | A past meeting with a record person |

`crm-pipeline-desktop.png` row 3 shows Meeting booked, Nov 4 15:30 and Invited together. Nothing in the plan
keeps these in step, so they can contradict each other. **Fix.** Keep the list, because the owner's wording
uses these statuses, but have events advance it forward only (DP3). Sending an invite would move an earlier
status to Meeting booked. Manual choice stays available.

### DI3. Medium: Interest Out and status Passed can disagree

The owner confirmed the coupling, so I am not reopening it. The plan defines only part of it. Three
contradictory states are reachable in the story's logic (`CrmPipeline.stories.tsx:676-685`):

- Move a Passed row back to Met: interest stays Out.
- Untoggle Out on a Passed row: interest is empty, status stays Passed.
- Press In or Maybe on a Passed row: interest says In, status says Passed.

**Fix.** Add one line to the plan for each case. Suggested: leaving Passed clears Out; untoggling Out restores
the previous status, the same as Undo; pressing In or Maybe on a Passed row leaves Passed the same way.

### DI4. Medium: notes would live in two stores

Contacts have a `notes` field today, shown on the contact page (`ContactDetail.tsx:102`) and included in
Contacts search (`Contacts.tsx:40`). The investor page adds note events and does not show `contact.notes`, and
the S1 backfill does not mention them. A founder's existing notes on a prospect would be missing from the
investor page. **Fix.** Backfill each prospect's notes as a note event for display, and leave the contact's
field as it is.

### DI5. Medium: wave data arrives in the wrong field

The plan needs the review branch merged first. That branch tells the agent to put "a label such as \"Wave
2\" in nextStep" (`apps/api/src/investors-agent.ts:25` on the branch). The plan's S1 backfill does not move
it. After migration, the Next step column could read "Wave 2" while the Wave filter is empty. **Fix.** Either
parse that label into `group` during the backfill or drop the instruction before the branch merges.

### DI6. Low: three names for one amount, and an open door in the import

The same field is Check size (`ContactDialog`, `ContactDetail`, the Investors sort), Possible amount (new) and
Deal value (GTM). If Stage and Check size leave the contact surfaces (DP2, DI1), the first name disappears on
its own. Separately, the import schema includes `amount` (plan section 1, Reconcile step 1), while the Decisions say a list
never fills Possible amount. An agent could parse "$250K" into a number that later feeds the pending total.
**Fix.** Remove `amount` from the stage schema unless the owner wants exact amounts from lists.

### DI7. Low: Follow-up always reads "You"

The plan itself says nobody else can be assigned. The fact has no information today (heuristic 8; see
`crm-investor-timeline.png` and `CrmPipeline.stories.tsx:1253`). **Fix.** Remove it and its strings, and add it
with shared pipelines.

### Passes

- **Next step and Next call.** One says what and the other says when. "Send the deck before the call" needs
  both.
- **Possible amount beside the range in Fund details.** The plan keeps a number the owner set apart from
  free text on purpose, because the number feeds the pending total.
- **Amount on the round card.** Pending ($750,000) equals the one Committed row (Mock Valley Seed) in
  `crm-pipeline-desktop.png`. This is a total of the row values, not a second copy.

## Overlapping Features

### OF1. High: one row has too many names, and "Investor" misleads

| Word | Where it appears | What it refers to |
| --- | --- | --- |
| Investor | Column, "Search investors", "investor page", "Add 96 investors" | A row on the pipeline |
| Investor | Investors page, contact Kind | Someone with a signed or paid stake |
| Prospect | "Add prospect", contact Kind on the review card | The same pipeline row, or a person in it |
| Contact | Contacts page, "71 new contacts" | A person |
| Firm, record | Plan only | The pipeline row |
| Company, Lead | GTM | The GTM row, under two names on one screen |

The result is a contradiction. The card says "Add 96 investors", and the plan says those new contacts are
Prospects "so they stay off the Investors page". A founder who looks for them on the page called Investors
will not find them.

**Proposal, for the owner to confirm.** Use Prospect for every fundraising row: column, search, card and page
("Add 96 prospects"). Use Investor only for the Investors page and kind `investor`. For GTM, use Lead for both
the button and the column's noun. Keep Firm out of the interface. This keeps words the app already uses (`Add
prospect`, `No prospects yet`).

### OF2. Medium: contact kind `prospect` loses its meaning, and GTM's `customer` gains a wrong one

After S1 a record decides who is on the pipeline. Kind `prospect` would keep only two jobs: staying off the
Investors page, and the Mercury gates in M1. The plan also says new GTM contacts are `customer`. A cold lead,
even one whose status is Lost, would read "Kind: Customer" on the contact page. **Fix.** Use `prospect` for
GTM contacts too, since it describes them accurately and the pipeline no longer filters on it. Decide this in S8,
not now.

### OF3. Medium: the plan reverses a stated rule without saying so

Today the code says "The pipeline stage is the founder's to change from the Fundraising page, never an
agent's" (`contact-tools.ts:79`), and the branch prompt says the agent cannot change a stage any other way
(`investors-agent.ts:25`). The plan's `pipeline_record_save` lets an agent propose a status, with approval.
Moving a row to Committed changes the pending total. The change may be right, but the plan presents it as a
copy of `contacts_save`. **Fix.** Name it as a decision for the owner. A smaller option is to let agents
save every field except Committed.

### Passes

- **`pipeline_read` and `fundraising_read`.** The plan removes the prospect part of the older tool, so they do
  not overlap once done.
- **Stage and review tools with a `pipeline_imports` table.** This looks heavy next to the branch's existing
  card, but one card for a list above 60 rows needs rows held between calls, and repository rules put that
  state in Postgres. The structure is justified. See PS3 for the limit itself.
- **The timeline and `contactDetail`.** The timeline reads mail and meetings through the existing queries
  rather than copying them.

## Hierarchy and IA

### IA1. Pass: Fundraising should own this

Fundraising already holds the round, pipeline and SAFEs, and the agent is reached from its header
(`Fundraising.tsx:60,271-273`). Investors holds the cap table, updates and contacts with a stake
(`Investors.tsx:101,110`). A call list of people who have not invested does not belong on Investors. The
one cost is the name clash in OF1.

### IA2. Medium: keep the investor page separate from the contact page, and connect them

They should not be merged, because one row can have several people, and a contact page describes one person
who may have a history outside this firm. Three gaps remain:

- A contact's page would repeat Stage, Check size and Next step on each person
  (`ContactDetail.tsx:93-100`). Replace them with one line linking to the record, such as "Fundraising:
  Sample Street Capital · Intro made".
- The contact page's Back always goes to `/app/contacts` (`ContactDetail.tsx:56`), so a person opened from the
  investor page returns to the wrong list. Pass the origin along, as the list's query already is.
- The contact page lists Documents and SAFEs (`ContactDetail.tsx:188-208`). The investor page and timeline
  have neither, so the record's most important money fact is one level down, per person.

For a one-person angel the two pages will look alike. I accept that, because the cost of special-casing it
is higher.

### IA3. High: what happens to the current Pipeline and the rest of the page

The plan keeps the round card, which is the right call: its figures come from different rules than the rows,
and it fits above the table. The plan does not state what happens to anything else. The mockup's Fundraising
screen has only a header, the round card and the table (`CrmPipeline.stories.tsx:1068-1092`). These parts of
the real page are absent from both documents:

| Today | Where | Status in plan and mockup |
| --- | --- | --- |
| Send SAFE on Committed rows | `Pipeline.tsx:82-91` | Absent. The mockup's row reads "Send the SAFE" as plain text, with no button |
| Waiting for Mercury, Open Mercury, Not sent | `Pipeline.tsx:46,103-110` | Absent |
| Attention strip | `Fundraising.tsx:300` | Absent |
| SAFEs section | `Fundraising.tsx:340` | Absent |
| Mercury connection line | `Fundraising.tsx:257` | Absent |
| Ask Investors agent in the header | `Fundraising.tsx:271` | Absent, though S3 starts with that agent |
| Stage groups with counts | `Pipeline.tsx:191-202` | Replaced by a Status filter; counts are lost |
| Passed collapsed by default | `Pipeline.tsx:203-219` | Lost; see IA4 |

**Fix.** Add a "what stays" list to the plan, and show Send SAFE and Waiting for Mercury in a story. Replacing
the stage groups with a flat table is reasonable for 140 rows, so I would not restore them.

### IA4. Medium: Passed firms keep nagging

Choosing Out moves a firm to Passed, and nothing clears its next call. The story counts overdue across every
row (`CrmPipeline.stories.tsx:750`), and overdue rows sort first, so a firm that said no can sit at the top in
red. **Fix.** Clear Next call on Passed, with Undo restoring it, and exclude Passed from the default view and
counts through the same `status` filter. This keeps today's behaviour of hiding them until asked.

### Migration and existing behaviour

**M1. High: every SAFE path assumes one contact of kind `prospect`.** Each gate below refuses or misses a
matched investor, and none has a rule for a firm with several people:

- `markWaiting` and `notSent` throw for any other kind (`fundraising.ts:133,147,158`).
- Mercury's sync attaches a SAFE only to `kind = 'prospect'` with the same email, in raw SQL that also reads
  `contacts."roundId"` (`packages/db/src/safes.ts:266-271`). S9 drops that column, and because this is raw SQL,
  a compiler will not catch it. `assignSafe` also reads the contact's round (`safes.ts:361`), so the plan
  must cover more than `toContact`.
- `mercurySentAt` is on the contact, while the row is now a firm.
- `SafeDialog` fills the investor from `prospect.name` and `prospect.email`
  (`SafeDialog.tsx:43,68-70`), so the plan must say whether that is the firm or the primary person.

**Fix.** Send SAFE acts on the primary person, and the sync matches any record person. Move the waiting state
to the record or state why it stays on the contact.

**M2. High: an existing investor can join the list but cannot finish.** The plan's main reason for records is
that an investor can be on the pipeline. But a funded SAFE counts as active (`packages/core/src/safes.ts:35`),
which has three effects if today's rules carry over:

- `saveSafe` refuses a new SAFE for that contact (`safes.ts:100-101`).
- `markWaiting` refuses them on kind alone.
- The overview hides any prospect with an active SAFE (`fundraising.ts:57-60`), which would remove the row.

The list exists to raise a new round, so **the rule needs a round**: "has an active SAFE in this round."

**M3. High: pending can be counted twice.** Today a contact with an active SAFE is dropped before pending is
summed, so a SAFE counts once (`fundraising.ts:60,69-72`). The exclusion is keyed by `contactId`. If a firm is
Committed and its SAFE attaches to a person other than the one the join looks at, the amount counts in Pending
and again in Sent, Signed or Funded. The S1 test ("totals match before and after") uses backfilled one-person
records and would not catch this. **Fix.** Exclude a record when any of its people has an active SAFE in the
round, and add a two-person test.

**M4. Medium: Undo after Out from a Committed row.** Saving a stage other than Committed clears `roundId`
(`contacts.ts:81-87`), and today's page withholds Undo when restoring would attach the row to a different round
(`Fundraising.tsx:158-161`). The plan's Out, with its unconditional Undo, must keep that condition.

**M5. Medium: a contact can be in two records.** `pipeline_record_people` has no uniqueness across records in
a pipeline, and a person can appear at two firms. `toContact` reads "the fundraising record", which is then
ambiguous. **Fix.** Make it unique per pipeline, or have the review card ask.

**Passes.**

- Portal access: the plan never changes `kind`, which is what ends portal access
  (`packages/db/src/contacts.ts:154`), so access and shares are safe. The existing flip from prospect to
  investor on signing is untouched.
- Committed logic: only status Committed counts, and Interest never touches money. This matches today's rule,
  apart from M3.
- Hide amounts: `usdFigure` masks values on its own (`finance-format.ts:229`), so the story's figures stay
  safe. `PipelineTable` should keep calling `useHideAmounts` (`Pipeline.tsx:165`) to re-render when it changes.

## Reuse

### R1. Medium: the GTM story shows the table can be relabelled, not that the format fits

**What fits.** A company with people, an ordered status, an amount, next step, date filters and a timeline are all
reasonable for leads. **What does not fit**, all visible in `crm-gtm-example.png`:

- Last call and Next call are inherited with `...FUNDRAISING.columns`, though the statuses are Contacted,
  Replied and Demo booked, and most outbound starts with email. The invite title is "Call: {firm}"
  (`CrmPipeline.stories.tsx:494`).
- The Referral source and Referred by overlap and can disagree. Row `g1` is `inbound` with Sam Example as its
  referrer.
- Every Company details row reads Researched, so the source label says nothing here.
- The placeholder says "Search companys" (`CrmPipeline.stories.tsx:781`). A shared `${label}s` will not survive
  real labels or translation.
- The real GTM page has a goal section, "needs you" and wakeup text, Ask GTM agent, a connection section, and
  tabs below the goal (`Gtm.tsx:104-124,201-215`). The story has only a title, tabs and Add lead.
- The plan says the story "tests the shape". It tests labels with invented rows, and GTM has no lead source or
  contacts tools yet (plan section 4).

### R2. Medium: Fit and Interest are different concepts sharing a slot

The plan defines Interest as the investor's stance, meaning their view of the founder. Fit is the founder's
view of the lead. Interest is learned from talking, and Fit can be set before any contact. They occupy one
column only because both happen to have three options. The coupled rule, marked "assumed, unconfirmed" in the
plan, fails on its own fixture: Example Freight Labs reads Lost, No fit, "Chose another tool". A lead that chose
a competitor may have been a perfect fit, and a founder would want to know that. **Fix.** Drop `outStatus` and
`fromStatus` for GTM: Fit does not move status and status does not move Fit.

### R3. Medium: parts of the reusable format are built one step early

**Keep:** the neutral table names and the `pipeline` column. This is one column, it costs almost nothing, and it
also carries the agent's scope rule. The plan's claim that it avoids a migration is real, though small.

**Defer to S8:** the `PIPELINES` object with per-pipeline `columns`, `interest` and `group` settings. Until S8 it
has one entry, which is the case the repository rule on speculative abstraction describes. R1 and R2 show its
current shape is already wrong in several places, so a second real case should decide it. The plan's own
defence says "used by real code on day one", but one caller with one configuration is a constant.

**Put labels in the right package when it comes.** The plan puts labels in `packages/contracts`, which does not
use Lingui, while the app's equivalents are `t` functions (`contactStageNames` in `ContactDialog.tsx:46`). Labels
there would skip translation.

### R4. Medium: the `toContact` compatibility layer has few readers and no end date

The plan keeps `stage`, `checkSizeCents`, `nextStep` and `roundId` on the contact, read through a join, "so the
contract, the page and the iOS OpenAPI file do not change". I found no Swift code that reads these fields;
they appear only in `openapi.json` (a search of `apps/ios` Sources and Packages), and the plan itself says
Fundraising is web only. The contract fields are `nullish` (`packages/contracts/src/contacts.ts:38-41`), so
removing them should not break a client, though I did not test that. If DP2 and IA2 happen, the remaining readers
are few. S9 could then remove the fields instead of keeping a permanent join on every contacts list.

### R5. Pass: no plugin system

The plan avoids status editors, per-tenant configuration, a field registry and custom fields. It reuses `Table`,
`useListParams`, `PickFilter`, `Sheet` and `calendar_create_event`, and it rejects a `firms` table and
`company_entities` with sound reasons. Legal is correctly left out. Its finding that Fundraising is web only also
holds: a search of Swift and TypeScript in `apps/ios` and `apps/mobile` found no Fundraising screen.

## Plan vs Stories

### In the stories, missing from or contradicting the plan

| # | Severity | Story or image | Plan | Mismatch |
| --- | --- | --- | --- | --- |
| PS1 | Medium | "Add prospect" and "Add lead" (`:1074`, `:1482`) | No creation flow | Nothing says what fields it asks for or how it makes a firm and a person. Possible amount and Referred by also have no edit path on the investor page |
| PS2 | Medium | "Edit" on the investor page (`:1201`) | Not described | `ContactDialog` edits one person, so it cannot be this dialog. Possible amount can be set only here, and the table and the phone sheet cannot change it |
| PS3 | Medium | Card reads "Add 96" (`:1401`), with a 140-firm list | "Up to `PROSPECT_IMPORT_MAX` (60) rows" | Works only if 60 is per call and rows accumulate. Say so, and state the limit per import |
| PS4 | Medium | "A. Sample" offered for "Alex Sample" (`:1366`) | Rules need the same normalized name | "asample" is not "alexsample" under the branch's `normalized`. The story shows fuzzy matching the plan does not define |
| PS5 | Medium | Status change on the investor page does nothing to Interest (`:1216`); phone sheet's Out does not set Passed (`:610`) | "Passed sets interest to Out"; "Out moves to Passed" | Only the table follows the plan. One shared function should cover all three |
| PS6 | Medium | `FundraisingCallList.stories.tsx` is in the same commit, with the title "Call list mockup" | "Replaces the earlier investor pipeline stories" | A competing proposal is still published, and `CrmPipeline.stories.tsx:80` imports from its fixtures. Delete it and move the fixtures |
| PS7 | Low | Single source line for all fund details (`:1289`, one `detailsSource`) | `details` is per field, each with a source | The plan does not say which field the column shows, or how a row with mixed sources reads and filters |
| PS8 | Low | Popover's date differs from the dialog's (DP4) | Silent | Covered in DP4 |
| PS9 | Low | "Search companys" (`:781`) | Not listed in New strings | Fix with R1 |

### In the plan, missing from the stories

| # | Severity | Plan | Mismatch |
| --- | --- | --- | --- |
| PS10 | Medium | Log a call, Add note, Add person | No story opens any of them, and the buttons have no handlers (`:954`, `:1275`, `:1312`). Log is the most frequent action on a call list, and its fields are not defined anywhere |
| PS11 | Medium | "Moved to Passed" with Undo | No toast or Undo in the story, and this is a confirmed owner decision |
| PS12 | Low | Failure states: clean invite failure, "Invite may have gone out" | No story |
| PS13 | Low | Meetings in the timeline, read live | The Type filter offers Meetings, but no entry has kind `meeting`; `t3` is a meeting labelled as a call |
| PS14 | Low | Empty, no-match and no-round states | Absent. The plan says little here, but `RoundCard` and `Pipeline` have empty states today |
| PS15 | Low | Route `/app/fundraising/:id` | The routes are exact today (`App.tsx:259`, `Shell.tsx:1199`), and the story's Back is a no-op. The plan should list this in S5 |

### Lined up

The nine columns, filter options and URL parameters match section 2. Hover and touch behaviour match
`RowSlot` and the images. The phone sheet, the Filters sheet with `SortControl` in it (`ListControls.tsx:537`),
and the invite rules for researched and missing emails, the count in the button and the no-calendar state all
match. The Review card's counts add up (71 + 23 + 2 = 96).

## Counts

| Section | High | Medium | Low | Passes |
| --- | --- | --- | --- | --- |
| Duplicate Paths | 2 | 4 | 1 | 4 |
| Duplicate Information | 1 | 4 | 2 | 3 |
| Overlapping Features | 1 | 2 | 0 | 3 |
| Hierarchy and IA (with migration) | 4 | 4 | 0 | 4 |
| Reuse | 0 | 4 | 0 | 1 |
| Plan vs Stories | 0 | 8 | 7 | 1 |

## Top recommendations

1. **Add the missing SAFE section to the plan before S1 (IA3, M1, M2, M3).** Cover Send SAFE and Waiting for
   Mercury on a firm row, make "active SAFE" a per-round and per-record rule, include matched investors in the Mercury
   gates, and test pending with a two-person firm. Show it in a story.
2. **Give pipeline fields one writer (DP1, DP2, DI1, IA2).** Remove Stage, Check size and Next step from
   `ContactDialog` and the contact page, and replace them with a link to the record. Create a record whenever a
   contact is saved as a prospect.
3. **Record each event once (DP3, DP4, DI2, DI3, IA4).** Logging a call or sending an invite advances the status
   forward only, and the date carries into the invite. Define what leaving Passed does, and clear Next call on Passed.
4. **Use one name and stop making contacts for firms (OF1, DP5, OF2).** Use Prospect for every fundraising row and
   Investor only for people with a stake. Allow a record with no people.
5. **Move GTM decisions to S8 (R1, R2, R3, OF2).** Keep the neutral tables and the `pipeline` column, but leave out
   `PIPELINES` until a second real case exists. Do not couple Fit to status, and do not label leads as customers.
