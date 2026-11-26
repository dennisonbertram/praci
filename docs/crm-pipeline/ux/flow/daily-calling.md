# UX flow critique: daily calling in the CRM pipeline

Scope: journeys 3 to 6 for a founder working down a long investor list between meetings. Nothing is built.
Evidence is the plan (`docs/crm-pipeline/PLAN.md`, cited as "plan L<n>"), the images in `docs/crm-pipeline/`
(cited by file name) and the stories in `apps/web/src/pages/CrmPipeline.stories.tsx` (cited by story or
component name). "Measured" means counted from an image or story; "suspected" means inferred because no
image or story shows it. All data is invented.

## What the mockup does not show

These gaps limit every journey below.

- The Log action has no form. `Log` appears in `crm-row-hover.png` and "Log call" in `crm-row-sheet-phone.png`,
  and the `RowSheet` button has no handler or dialog. How a call is recorded (outcome, note, length) is
  undecided, and it is the most frequent action in the product.
- The plan says logging a call clears the next call date (plan L207) and sets Last call (plan L149). It says
  nothing about status or interest changing.
- No story shows how a recording opens its meeting. The timeline row "Call with Alex Sample, Granola, 28 min"
  (`crm-investor-timeline.png`, story `InvestorTimeline`) has no visible link.

## Journey 3: start of day, who do I call next

Friction scorecard (measured from `crm-pipeline-desktop.png`, `crm-pipeline-phone.png`)

| Step | Actual | Ideal |
| --- | --- | --- |
| Open Fundraising | 1 (sidebar) | 1 |
| See what is due | 0 clicks: sorted by Next call ascending, "2 overdue" and "2 today" at the top right of Pipeline (plan L133, L206) | 0 |
| Isolate today's list | 1 click on "2 overdue" or "2 today" (they set the `next` filter, plan L206) | 1 |
| Start the first call | Read the row, then find a phone number | 1 |

- Defaults: carried well. Default sort puts overdue first, and the overdue dates are red.
- Hesitation (suspected): "2 overdue" and "2 today" are two separate buttons. A founder wants one list, "due
  now", which is overdue plus today. They would click one, then the other.
- Dead end (measured): the row has no phone number or way to reach the person. The call itself happens
  elsewhere, and the plan leaves out "email from the row" on purpose (plan L213). The list says who to call but
  not how.
- Dead end (measured): the Fundraising summary card (Funded, Signed, Pending, Target; `crm-pipeline-desktop.png`)
  sits above the list and pushes row 1 to about y=545 of 1640 px. On the phone the card pushes the first
  row below y=800 of 2000 (`crm-pipeline-phone.png`). The first thing a founder needs each morning starts
  below the fold on a phone.

Take-away pass, desktop screen (`crm-pipeline-desktop.png`)

| Element | Used by this journey? | Verdict |
| --- | --- | --- |
| Search | Sometimes | Keep |
| 9 filter pills | 1 or 2 of them (Next call, Status) | Collapse behind one "Filter" control; keep Next call visible via the due buttons |
| Referred by column | Only when preparing a call | Move to the investor page and the sheet; keep as a filter |
| Possible amount column | Not at start of day | Hide by default |
| Fund details column ("Seed lead · $250K-$500K", "Researched") | No | Hide by default; it also wraps to two lines and doubles row height |
| Last call + Next step + Next call | Yes | Keep |
| "Researched" / "From your list" under Fund details | No | Remove from the row; show on the investor page only |

Verdict: **acceptable**. The answer is already on screen with no clicks. The extra weight is from columns and the
summary card, not from the flow.

Simpler version

1. Open Fundraising. The list opens on "Due now" (overdue plus today), sorted oldest first, with the rest
   of the list below it.
2. Each row shows: investor, status, next step, next call date. Amount, referrer and fund details open on
   the investor page.
3. On a phone the summary card collapses to one line (Pending / Target) so the first row is visible without
   scrolling.

## Journey 4: during a call (called, left a message, try again Thursday)

Friction scorecard

Desktop, as the mockup could be built (clicks counted from `crm-row-hover.png`; the Log form is suspected):

| # | Action | Evidence |
| --- | --- | --- |
| 1 | Hover the row, click `Log` | `crm-row-hover.png` |
| 2-3 | Fill a log form (outcome, note) and save | Suspected: no form exists |
| 4 | Click the Status pill | `crm-pipeline-desktop.png` |
| 5 | Choose "Left message" | Status list, `STATUS_NAMES` |
| 6 | Click Next call | `crm-row-hover.png` popover |
| 7 | Type the date (6 digits into `<input type="date">`) | popover in `crm-row-hover.png` |
| 8 | Click outside to close | popover has Clear and Send invite, no Done |
| 9 | Optionally edit Next step | free text |

That is 8 to 9 actions, and Thursday has to be worked out and typed. Ideal: 3 (Log, pick "Left message", pick a
suggested date, save).

Phone (measured from `crm-row-sheet-phone.png`): tap the row's "...", change Status (a select, 2 taps),
edit Next step, set the date and time (native pickers), tap Log call. About 8 to 10 actions. The sheet's Send
invite is the dark primary button, but "called, left message" is the common case and does not need an invite.

- Decisions a default could carry:
  - Status after a call. "Called" and "Left message" are the outcome of the call. The founder already said
    which one by clicking Log. A second click to set status repeats it.
  - Next call date. Most follow-ups are "in 2 days" or "next week". Typing a date is the slowest option.
  - Time. The popover always shows a time field (`crm-row-hover.png`), though most follow-ups are only a day.
    The plan stores `nextCallHasTime` (plan L66), so a time can be optional, but the UI shows it always.
  - Interest. Most calls change nothing.
- Re-entry (measured): "Next step" and "Next call" are two separate fields on the sheet and in the table
  (`crm-row-sheet-phone.png`). "Try again Thursday" is typed once as text ("Try again after the partner
  meeting") and once as a date. They overlap.
- Two routes that disagree (measured from plan L149 and `crm-row-hover.png`): changing Status to "Left
  message" does not create a call, so Last call does not move. Only `Log` does. A founder who sets the status
  and skips Log gets a status that says "Left message" next to a Last call of weeks ago.
- Confirmation: none on log or status, which is right. The invite dialog (`crm-invite-confirm.png`) is a real
  outward action and its confirm is justified.
- Dead end: after Log, nothing shows what happens to the row (plan L207 says Next call clears). A cleared
  Next call drops the row out of the due list with no follow-up date, so a "left message" investor can
  vanish from view unless a new date is set. That is a risk for a founder at the end of a call.

Is Status plus Interest two overlapping ideas? Partly, yes (measured):

- The plan keeps them separate on purpose: Status is what happened, Interest is the investor's stance (plan
  L154-L158). That distinction is real for Maybe after a meeting.
- But the overlap is wired in. Out sets Passed, Passed sets Out, Committed sets In (plan L161-L162). Two of
  the three interest values and two of the ten statuses are the same fact stored twice. `crm-pipeline-desktop.png`
  shows it: "Committed" with "In" selected for Mock Valley Seed.
- The three toggles are always on screen in every row (`crm-pipeline-desktop.png`), so Interest costs 9 buttons
  across 3 rows and is "Not set" on most rows, where the row has no highlighted button. Its resting state is
  mostly empty chrome.
- Suggested change: keep the Interest field, but reduce what the founder has to set by hand. Passed/Out and
  Committed/In already sync, so remove the Interest buttons from the row for those statuses.

Are 10 statuses too many? Yes for a first version (measured from `STATUS_NAMES`):

- Not contacted, Called, Left message, Intro requested, Intro made, Meeting booked, Met, Diligence, Committed,
  Passed.
- "Called" and "Left message" are call outcomes, not stages. They mix with stages (Intro made, Met, Diligence)
  in one ordered list, so the sort order of Status (plan L137) is not meaningful. Is "Left message" before or
  after "Called"?
- Fewer stages: Not contacted, Contacting (covers called and left message, since the timeline holds the
  detail), Intro, Meeting, Diligence, Committed, Passed. That is 7, and the call outcome lives on the logged
  call where it belongs.

Should Called set status automatically? Yes, with a rule that never moves a row backward:

- Log with outcome "Spoke" or "Left message" moves Not contacted to Contacting. It never changes a later status
  (Meeting, Diligence) and never touches Interest.
- Undo toast, as the plan already uses for Out (plan L160).

Take-away pass, hover popover (`crm-row-hover.png`)

| Element | Verdict |
| --- | --- |
| Next call date + time | Keep, but show quick choices (Tomorrow, In 2 days, Next week) above the date field |
| Clear | Keep |
| Send invite | Keep, but only after a date exists (it is the plan's one outward action, plan L178) |
| Time field when the follow-up is only a day | Show after the date is set |

Verdict: **convoluted** for the most common action. It takes 8 or more actions where 3 would do, status repeats what
Log already says, and the two routes (status vs Log) give different Last call results.

Simpler version

1. Hover the row (or tap it on a phone) and click `Log call`. A small panel opens on the row.
2. Outcome buttons: Spoke, Left message, No answer. One click sets the status as above and records the call.
3. A note field, optional.
4. Next call: quick choices (Tomorrow, In 2 days, Next week, Pick date). The default is "In 2 days" after
   Left message or No answer, and none after Spoke, so the founder has to choose.
5. Save. The row updates, with an Undo toast. "Send invite" is a secondary button in the panel and shows only
   when a date is set.

Count for "called, left message, try again Thursday": Log, Left message, Pick date (or the Thursday shortcut),
Save = 4 actions, or 3 if the default date is accepted. Down from 8 or 9.

## Journey 5: open an investor, prepare, see past calls and notes

Friction scorecard (measured from `crm-investor-timeline.png`)

| Step | Actual | Ideal |
| --- | --- | --- |
| Open the investor | 1 click on the name (plan L198) | 1 |
| See facts, people, next call | 0 (left column) | 0 |
| See last call and notes | 0 (timeline, newest first) | 0 |
| Follow the call recording | Unknown: no link shown | 1 |
| Add a note or log a call | 1 (buttons above the timeline) | 1 |

- This screen is close to minimal. One timeline holds calls, notes, mail and changes, newest first, and "Log
  a call" and "Add note" sit above it.
- Don't ask for what you know: fine. People, emails and "Researched" are pre-filled.
- Once and only once (measured): Status, Interest and Next call are on the left column (facts) and appear again
  as timeline entries ("Interest: Maybe", "Status: Intro requested to Intro made"). The entries are history, so
  that is acceptable, but they dilute the timeline with 3 of 8 rows that are field changes. The "Type" filter
  exists for this reason.
- Hierarchy: for preparing a call the most useful row is the last call note ("Likes the market; wants the
  deck and the cap table before a partner meeting", `crm-investor-timeline.png`). It has the same weight as
  "Added from your list". There is no "last time" summary at the top.
- Take-away: "Follow-up: You" (plan L206) has one possible value, since records are per user. Remove it until
  assignment exists. "Edit" is unclear: edit what? Status and interest are editable in place already.
  "Possible amount" and "Referred by" are useful here. "Fund details" is useful here and nowhere else.
- Recording link: the entry says "Granola, 28 min" with no visible way to open the meeting. Plan L202 says mail and
  meetings are read live from `contactDetail`, which implies a link, but the mockup does not draw it. Draw
  it (a "Open meeting" link on the call row). Until then this part of the journey is unverified.
- Dead end (measured): there is no "Call now" or phone number in the People list. It lists email, not phone.

Verdict: **minimal** for the layout; **acceptable** overall because of the missing recording link and the
unlabelled "Edit".

Simpler version

1. Click the investor. The page opens with "Last call: Oct 28, Likes the market..." and "Next: Send the deck
   before the call" at the top of the left column.
2. Timeline below it, with field changes hidden by default (the Type filter set to Calls, Notes, Mail).
3. Each call entry links to its meeting.
4. Remove "Follow-up: You" and "Edit" until they have a purpose.

## Journey 6: follow up (overdue items, finishing a round's Wave 1)

Friction scorecard

| Step | Actual | Ideal |
| --- | --- | --- |
| See overdue | 1 click ("2 overdue", plan L206) | 1 |
| Work an overdue row | Same as journey 4 (8 or more actions) | 3 |
| Find Wave 1 rows still not called | Open the Wave filter, pick Wave 1, then Status filter, choose Not contacted: 4 or more clicks (suspected; plan L137, `crm-pipeline-desktop.png` shows both pills) | 1 |
| Know when Wave 1 is done | No indicator | A count ("Wave 1: 12 of 40 contacted") |
| Do the same thing to many rows | Not possible | At least "set next call" on a selection |

- Wave is a filter and not a column (plan L327). That is fine for filtering, but the founder can't see a row's
  wave. With several waves and filters stacked, the active filter state is only a pill label.
- Dead end: nothing marks a round's Wave 1 as finished. The founder has to compute it from two filters.
- Overdue and "left message" collide with journey 4: Log clears Next call (plan L207), so a "left message"
  without a new date leaves the list.
- The Fundraising summary (Funded, Signed, Pending, Target) tracks money, not calls, so it does not help here.
- Overdue rows after a gap (suspected, a week away): dozens of rows share "overdue", and the default sort
  puts the oldest first. The oldest are the least likely to still matter. A bulk "move to next week" would
  clear them. Not in the plan; the plan lists no bulk edit.

Verdict: **acceptable**. The overdue view is one click. The Wave 1 completion path is indirect, and clearing a
backlog is slow because every row takes the full journey 4 effort.

Simpler version

1. Click "Due now". The list shows overdue and today, oldest first.
2. Work each row with the 3-action Log flow from journey 4.
3. The Wave pill has a count next to its name, e.g. "Wave 1 · 12 left", where "left" means status Not
   contacted. That reads as progress.
4. Optional later: select several rows and set one next-call date.

## Questions asked, with answers

| Question | Answer | Evidence |
| --- | --- | --- |
| Status and Interest overlap? | Partly. Real distinction, but 2 of 3 Interest values mirror 2 of 10 statuses and the plan syncs them. | plan L154-L162, `crm-pipeline-desktop.png` row "Mock Valley Seed" |
| 10 statuses too many? | Yes. "Called" and "Left message" are call outcomes, not stages. 7 stages is enough. | `STATUS_NAMES` in `fundraising-call-fixtures`, plan L137 |
| Should Called set status? | Yes, forward only, with Undo. | journey 4 |
| Too many columns and filters? | Yes. 9 filter pills and 9 columns. Only Next call, Status and Interest are used daily. | `crm-pipeline-desktop.png` |
| Does it fit the screen? | At the 2000 px width of the image, yes but Fund details and Next step wrap and rows are about 90 px, so about 10 rows show. Narrower laptop widths (about 1280 px) are suspected to scroll horizontally; the stories do not show that width. | `crm-pipeline-desktop.png`; suspected for 1280 |
| Primary action on a phone? | The mockup has none. The row's visible control is the Interest menu (a pill), not the call. The sheet's dark primary is Send invite, but the common action is Log call. | `crm-pipeline-phone.png`, `crm-row-sheet-phone.png` |

## Clarity issues

- "Interest" is the investor's stance ("In" means "in the round"). Plain "In" and "Out" on a row can read as
  "in my list" or "in the office". The header is the only context (`crm-pipeline-desktop.png`). Consider
  "Likely / Maybe / Pass" or put "Interest" in the toggle's label.
- "Invited" under the Next call date (`crm-pipeline-desktop.png`) does not say who was invited or whether the
  invite was accepted. It is a status the founder can't act on.
- "Last call" is computed from logged calls and past meetings (plan L149). A founder might expect
  "last contact" (mail too). The label should match the rule or the rule should match the label.
- Next step (text) and Next call (date) are two columns for one idea: what happens next and when.

## Story versus plan mismatches

| Item | Plan | Story or image |
| --- | --- | --- |
| Row actions | "Log" and "Set date" on hover (plan L170) | `crm-row-hover.png` shows `Log` under Last call and the date popover opened from Next call. "Set date" is not drawn on an empty row. |
| Phone primary action | Plan L168 says phone web uses a row menu and the "..." sheet | Matches, but the sheet orders Interest, Status, Next step, Next call and puts Send invite as the primary (`crm-row-sheet-phone.png`). |
| Log call | "Log a call" is a core CRM action (plan L296, L311) | No form, dialog or story. `RowSheet` Log call button has no handler. |
| Popover next call | Plan L175 describes a date and time popover with Send invite | `crm-row-hover.png` matches, but its Send invite appears even with an unset date. |
| Last call | Latest logged call or past meeting (plan L149) | Rows show a bare date ("Oct 28") with no source. |
| 9 filters | Plan lists 9 (plan L135-L145), plus phone Filters sheet (plan L147) | Desktop shows all 9 in one row (`crm-pipeline-desktop.png`). |
| Recording to meeting | Mail and meetings live from `contactDetail` (plan L202) | Timeline row "Granola, 28 min" has no link (`crm-investor-timeline.png`). |
| Statuses | 10 statuses are in the fixtures only; the plan says "statuses: […]" (plan L228) | The list is not specified in the plan. |

## Top 5 proposed changes

1. Design the Log call panel and make it the one entry point after a call: outcome buttons (Spoke, Left message, No
   answer), optional note, quick next-call choices, Save. It sets status forward and Last call together.
   That takes the common case from 8 or 9 actions to 3 or 4.
2. Cut Status to about 7 stages and move "Called" and "Left message" to the logged call's outcome.
3. Show 4 to 5 columns by default (Investor, Status, Interest, Next step, Next call) and fold the rest
   (Referred by, Possible amount, Fund details, Last call) into the investor page, the sheet or a Columns
   menu. Collapse the 9 pills into one Filter control with Due now outside it.
4. Merge "2 overdue" and "2 today" into one "Due now" list, and on a phone shrink the summary card so the
   first row is visible and make Log call the sheet's primary button.
5. Draw the recording link on the timeline's call rows, put "Last call" and "Next" at the top of the investor
   page, and remove "Follow-up: You" and the unlabelled "Edit".

## Not verified

- No image shows a narrow laptop width (about 1280 px), so the fit claim is a suspicion.
- The Log form, a recording link and the invite after-state are not drawn, so journeys 4 and 5 are partly
  inferred from the plan.
- Nothing was run; this is a read of the plan, images and story source.
