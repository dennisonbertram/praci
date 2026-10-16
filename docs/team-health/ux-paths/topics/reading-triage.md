# Topic 3: Reading and triage

Verified by rendering `mockup.html` with playwright-core: the Source filter "Gmail" hides Maya; filtering Group "No change" leaves only the collapsed "8 others" row; the range chips do nothing when clicked; only Maya's table row is expandable.

## STORY-301: Monday-morning read of the summary and the first cards
**Type**: medium
**Topic**: Reading and triage
**Persona**: Hana Lindgren, founder of a 15-person company, opens Team health at 9:45 AM Monday with ten minutes before standup and wants to know whom to talk to today.
**Goal**: Name the one or two people to speak to before standup.
**Preconditions**: Owner of the space; page added; Slack, Gmail, Calendar, GitHub, Linear connected; 15 weeks of history; default Cards view, Sort: Recent change, range 12w.
**Basis**: Mockup state 2 (`p.sum`, "Take care of first" section); README decisions 5, 6a.
**Ideal path**: 3 steps. Read summary, scan the two cards in "Take care of first", press "Schedule 1:1" on one.
**Alternate paths**: Skip the summary and read cards directly; open the "Revenue line" table to see single points of failure.
### Steps
1. Open Team health from the sidebar → page shows "Updated 9:40 AM", range chips, coverage chips, and the summary "Take care of Maya and Jonah first. 2 others show rising after-hours work."
2. Read the summary → she learns two names to prioritise and that two more people have a signal.
3. Scroll to "Take care of first" → two cards (Maya Okonkwo, Jonah Petrakis), each with a Revenue line block and a Workload block.
4. Skim Maya's card → three signals each with a sparkline and a tag.
5. Press "Schedule 1:1" → handoff to the agent (covered in the acting topic).
### Variations
- Summary names only 1 person when one card is in the group; zero people in the group is Undefined (no summary text is shown for that case).
- Four people in "Take care of first": Undefined whether the summary lists four names.
### Edge Cases
- "2 others show rising after-hours work" is wrong for Priya Raman (her signals are weekend and meetings) and half-wrong for Theo Lindqvist (after-hours plus tickets). The summary is hard-coded and uses one signal type for all.
- The three "Revenue line" people (Sam Ferreira, Ada Wójcik, Marcus Bell) are single points of failure, but the summary never mentions them.
- Summary does not react to range, filter or sort.
### Does it make sense?
Confusing at step 2. The summary answers "whom" but not "why", and it miscounts the others. Smallest fix: build the summary from data, name the reason in three words ("Maya (revenue, meetings), Jonah (revenue, reviews)"), and add a clause for revenue-only people ("3 more are single points of failure"). Say "workload" instead of "after-hours" unless every signal is after-hours.

## STORY-302: Why is Maya "Take care of first"?
**Type**: short
**Topic**: Reading and triage
**Persona**: Tomasz Weiss, an owner who has never read the plan, sees Maya Okonkwo at the top and wonders what put her there.
**Goal**: Understand that the group means revenue line AND sustained workload signal.
**Preconditions**: Same as STORY-301.
**Basis**: Mockup Maya card; README goal ("the overlap"), decision 6a group names.
**Ideal path**: 2 steps. Read the Revenue line block, read the Workload block.
**Alternate paths**: Open the "What this reads" popover (does not explain grouping); switch to Table and read the Group column.
### Steps
1. Read section heading "Take care of first" → no subtitle or rule is shown; he sees two cards.
2. Read the "Revenue line" block: "Sole owner of 9 of 12 threads with Northwind Labs, last 90 days" → he sees the revenue reason.
3. Read the "Workload" block: "Meetings 26 h/wk, up from 14, over 6 weeks" and two more signals → he sees the workload reason.
4. Compare with Priya (Workload signals) and Sam Ferreira (Revenue line table) → the pattern "has both blocks" appears.
### Variations
- In Table view the Group cell reads "Take care of first" with the Revenue line column "Northwind Labs, Harbor & Pine" and the Signals column "3 Meetings 26 h/wk, from 14". The overlap is visible only if he reads two columns together.
### Edge Cases
- A person with a revenue line and a signal that the owner marked "Not an issue" would move to "Revenue line". Whether the move is explained anywhere is Undefined.
- The rule (revenue line + sustained workload signal) appears in the plan only, not on the page, and the "What this reads" popover does not state it.
### Does it make sense?
Makes sense after one read, because both blocks sit in the card. Step 1 is the weak point: the heading is jargon-free but the rule is implicit. Smallest fix: none needed in cards; in Table, color or label the Group tag "Revenue + workload" so the rule reads in the cell. Do not add explainer text to the card.

## STORY-303: Reading a sparkline and its baseline band
**Type**: short
**Topic**: Reading and triage
**Persona**: Ines Carvalho, an operations lead who is the space owner, has never seen the chart type and tries to read Maya's "Weekend activity" signal.
**Goal**: Tell whether the latest week is above normal for that person.
**Preconditions**: Maya's card visible; mouse available (no hover content is defined).
**Basis**: Mockup `.sp` SVG (`rect.band`, `polyline.ln`, `circle.dot`), aria-label "Last 12 weeks against own baseline"; README decision 5.
**Ideal path**: 2 steps. Find the shaded band, see the dot above it.
**Alternate paths**: Read the text next to the chart ("4 of last 6 weekends (baseline 1 in 6)") instead of the chart.
### Steps
1. Look at Maya's "Meetings 26 h/wk, up from 14, over 6 weeks" row → a small line with a pale band across the bottom and a dot at the top right.
2. Try to read the band → no legend, no axis, no tooltip; the only explanation is the aria-label (screen readers) and the popover line "Each person is compared with their own 12-week baseline".
3. Look at "Weekend activity" → the band fills the whole chart height, so the dot at the top sits inside the band.
### Variations
- Hover or focus on the chart: Undefined, no tooltip is specified.
- Table "Trend" column shows only the top signal's sparkline.
### Edge Cases
- Every sparkline ends with its dot at the top of the chart, so scales are normalised per signal. Two charts cannot be compared, and "how far above" is not readable.
- Weekend and similar count signals are binary per week; the polyline jumps between top and bottom, which looks noisy.
### Does it make sense?
Confusing at step 2 and Broken at step 3. The weekend band spanning the full height makes the chart say "within normal range" while the text says "4 of 6, baseline 1 in 6". Smallest fix: compute the weekend band from the baseline rate (low band, here near the bottom), and give the sparkline a title/tooltip "Band is this person's usual range, last 12 weeks". No permanent legend text, per the copy rule.

## STORY-304: Confidence tags for a non-expert
**Type**: short
**Topic**: Reading and triage
**Persona**: Grace Odum, a founder who is not technical, wonders whether she can trust Jonah's and Priya's flags.
**Goal**: Decide how much weight to give each signal.
**Preconditions**: Cards visible with tags "Medium · no PTO data", "Low · Slack only", "Medium · role may explain part", "Medium · time zone set", "Medium · Gmail and Slack", "Low · Linear only".
**Basis**: Mockup `.tag` on every `.sig`; README decision 7 (Low or Medium plus reason, High only with PTO calendar).
**Ideal path**: 2 steps. Read tag, interpret as "how sure the page is, and what is missing".
**Alternate paths**: Look at coverage chips for a Calendar dot; open "What this reads".
### Steps
1. Read "Low · Slack only" next to Priya's weekend signal → she understands that one source backs it.
2. Read "Medium · no PTO data" next to Maya's meetings → she understands that vacation is unknown. But the coverage strip shows Calendar connected.
3. Read "Medium · role may explain part" on Jonah's reviews → this is not a data-coverage reason; it is a caveat about interpretation.
4. Read "Medium · time zone set" on Maya's weekend → she cannot tell whether this is good or a problem.
### Variations
- Table shows one Confidence per person (Maya "Medium") while her card has Medium, Medium and Low. Which signal the table value represents is Undefined.
### Edge Cases
- Calendar connected but "no PTO data" contradicts README decision 7, where a connected calendar with PTO gives High. Whether Google Calendar out-of-office entries count as PTO is not stated.
- No tag is ever "High" in the mockup, so the user cannot see what better looks like.
### Does it make sense?
Confusing at steps 2 to 4. Tags mix three kinds of reason (missing data, single source, interpretation caveat). Smallest fix: restrict the reason to what is missing or single-sourced; move "role may explain part" into the signal sentence; drop "time zone set" or fold it into Medium without a reason; show the table's confidence as the lowest of the person's signals and say so in the header tooltip.

## STORY-305: Opening evidence on a card and in the table
**Type**: medium
**Topic**: Reading and triage
**Persona**: Kwame Boateng, a CEO who wants proof before he raises weekend work with Jonah.
**Goal**: See the dates behind Jonah's late commits.
**Preconditions**: Cards view; Jonah's card is in "Take care of first".
**Basis**: Mockup `details.ev` on Maya and Jonah cards; table `tr.xr` / `.evr`; `P[].ev` set only for Maya.
**Ideal path**: 1 step in Cards ("Evidence" summary), 2 steps in Table (chevron, read).
**Alternate paths**: Click anywhere on the row in Table to expand.
### Steps
1. In Cards, press "Evidence" on Jonah's card → text appears: "Reviews: 46 of 121 team reviews in the last 5 weeks. Late commits on Sep 22, 24, 25, 29 and 5 more days through Oct 14. Counts and dates only."
2. Switch to Table → Jonah's row has an empty space where Maya's has a chevron.
3. Click Jonah's row → nothing happens.
4. Click Maya's row → an evidence row opens beneath it.
### Variations
- Open Evidence on both cards at once: allowed, each `details` is independent.
- Priya and Theo (Workload signals): their cards have no "Evidence" control at all.
### Edge Cases
- Evidence is a single sentence for all signals of a person, not per signal; a user cannot tell which date belongs to which signal on the card.
- Expanded evidence state after switching Cards to Table and back: Undefined (cards `details` keep their own state; table rows rebuild collapsed on each render).
- Table rows rebuild on every filter or sort change, so an open evidence row closes.
### Does it make sense?
Broken at steps 2 and 3. Jonah has evidence in Cards but not in Table (the data array omits it), and Priya and Theo have none anywhere, although the plan says each signal has a "Show evidence" link. Smallest fix: give every person with a signal an evidence string, show the chevron for each of them, and keep open rows across filter and sort.

## STORY-306: Switch Cards to Table and keep filter and sort
**Type**: medium
**Topic**: Reading and triage
**Persona**: Mei-Ling Shaw, an owner who prefers scanning rows and wants to compare reviewers.
**Goal**: See only GitHub-based signals sorted by signal count, in a table.
**Preconditions**: Cards view, default sort, no filters.
**Basis**: Mockup toolbar (`Filter`, `Sort`, `Cards | Table`, `st` state); README decision 6a (view, filter and sort kept in the URL).
**Ideal path**: 4 steps. Filter Source GitHub, sort Signals (count), toggle Table, read rows.
**Alternate paths**: Click the "Signals" column header instead of using the Sort menu.
### Steps
1. Press "Filter", tick Source "GitHub" → button reads "Filter · 1", chip "GitHub ×" appears, "Clear" appears, cards for Jonah, Sam Ferreira and others with GitHub remain.
2. Press "Sort: Recent change", choose "Signals (count)" → label becomes "Sort: Signals (count)".
3. Press "Table" → same people in the same order as flat rows; the filter chip and sort label stay.
4. Click header "Person" → sort becomes Name; toolbar label updates to "Sort: Name".
### Variations
- Reload the page: README says state is in the URL; the mockup has no URL state, so reload behaviour cannot be checked (Undefined in the mockup, defined in the plan).
- Click the same header twice: no reverse order; Undefined.
### Edge Cases
- Sort "Last activity after hours" has no table column header, so after choosing it the table has no sorted column highlighted. Its label and unit are unclear (a count of days, shown nowhere in the table).
- Sort "Group" in Cards changes nothing visible, because Cards are already sectioned by group. Sort "Name" in Cards only orders within each section.
- Sort "Signals (count)" in the table has `aria-sort` descending, the others ascending; the direction is not shown visually.
### Does it make sense?
Makes sense in Table. Confusing in Cards: sort options "Group" and "Name" do not behave as the labels suggest. Smallest fix: in Cards, disable or hide "Group" (it is the layout) and label Name as "Name (within group)", or keep sections only when sort is Recent change. Add a Table column for "Last after-hours" or drop that sort option.

## STORY-307: Filter by Signal and Source (OR within, AND across)
**Type**: medium
**Topic**: Reading and triage
**Persona**: Arjun Rao, an owner who wants to see everyone whose reviews or tickets signal comes from GitHub or Linear.
**Goal**: Combine Signal and Source filters and trust the result.
**Preconditions**: Cards view, 15 people, no filters.
**Basis**: Mockup `match()` and `#fpop` with groups Group, Signal, Source; README decision 6a.
**Ideal path**: 3 steps. Tick Signal Reviews and Tickets, tick Source GitHub and Linear, read the result.
**Alternate paths**: Remove one chip with "×" instead of reopening the popover.
### Steps
1. Open "Filter" → popover with three headings: Group (Take care of first, Workload signals, Revenue line, No change), Signal (After hours, Weekend, Meetings, Reviews, Tickets), Source (Slack, Gmail, Calendar, GitHub, Linear).
2. Tick Signal "Reviews" and "Tickets" → people with either signal remain (Jonah, Theo); chips "Reviews ×", "Tickets ×".
3. Tick Source "GitHub" and "Linear" → remaining must have (Reviews OR Tickets) AND (GitHub OR Linear): Jonah (GitHub) and Theo (Linear).
4. Press "Clear" → all people return.
### Variations
- Ticking only Source "Gmail": Maya disappears even though her revenue line threads are email threads (her source list is Slack and Calendar). Confirmed by rendering.
- Signal filter also removes every revenue-only person, since they have no signals; the Revenue line table can vanish on a Signal filter. The reason is not shown.
### Edge Cases
- "Filter · 4" counts ticked values, not groups, so two Signal values plus two Source values read as 4.
- The filter group is called "Workload signals" in the popover and "Workload" in the table tag. Same group, two names.
- A filter that matches a person by a source unrelated to the displayed signal (person has Slack, signal came from Calendar) shows a card whose visible signals do not mention that source.
### Does it make sense?
Makes sense for the AND/OR logic. Confusing for Source: the filter means "person has this source" while the card reads as "signal from this source". Smallest fix: derive each person's source list from the sources behind their displayed signals and revenue evidence (add Gmail for Maya), and use one name for the group ("Workload"). Show the group names as plain labels, not "Group" next to "Signal".

## STORY-308: Empty filter result and Clear, and filtering to "No change"
**Type**: short
**Topic**: Reading and triage
**Persona**: Lucia Ferrante, a space owner who tries odd filter combinations.
**Goal**: Recover from a result with no people, and understand a result with only "others".
**Preconditions**: Cards view, 15 people.
**Basis**: Mockup `#none` ("No one matches these filters." with Clear), `#oth`, `#fclear`.
**Ideal path**: 2 steps. Combine filters with no match, press "Clear".
**Alternate paths**: Remove chips one by one.
### Steps
1. Tick Group "No change" and Signal "Meetings" → no person matches both.
2. Read the page → "No one matches these filters. Clear" replaces the cards; the toolbar keeps the chips and a second "Clear".
3. Press either "Clear" → all cards return.
4. Tick only Group "No change" → the three sections disappear and the page shows only a collapsed row "8 others · no sustained change"; the user must open it to see anyone.
### Variations
- Same filter in Table: eight rows with "—" in Revenue line, Signals, Trend, Confidence, Changed.
- Keeping the others list open, then clearing: the open state is kept if the list stays visible.
### Edge Cases
- Two "Clear" buttons are visible in the empty state; both do the same thing.
- The empty message does not say which filter caused it.
### Does it make sense?
Makes sense for the empty state. Confusing at step 4: the user filtered to "No change" and sees a closed row. Smallest fix: when the filter leaves only people in "No change", render the others list expanded. Drop one of the two Clear buttons in the empty state.

## STORY-309: Range 4w, 12w, 6m
**Type**: short
**Topic**: Reading and triage
**Persona**: Obinna Eze, an owner who wants to know whether Theo's tickets rise is recent or long-running.
**Goal**: Change the range and see what changes.
**Preconditions**: Default 12w selected.
**Basis**: Mockup `.chips[aria-label=Range]` (chips "4w", "12w" on, "6m"); README decisions 3, 5 (26-week backfill, 12-week baseline, 3+ week sustained).
**Ideal path**: 2 steps. Press "6m", read sparkline and signal text.
**Alternate paths**: Press "4w".
### Steps
1. Press "6m" → in the mockup nothing changes (chips have no handler; "12w" stays on). In the plan: Undefined.
2. Read Maya's sparkline aria-label → fixed text "Last 12 weeks against own baseline" regardless of range.
### Variations
- 4w: shorter than the 3-week sustained rule plus baseline. Whether signals appear or vanish is Undefined.
- 6m with 26 weeks: the baseline window (12 weeks) may no longer fit; Undefined.
### Edge Cases
- Evidence text uses fixed windows ("last 90 days", "last 12 weeks", "last 5 weeks"), which would not follow the range.
- Summary and "8 others" counts: Undefined whether they follow the range.
- Range in the URL: README lists view, filter and sort only; range is not mentioned.
### Does it make sense?
Undefined at step 1. The control exists, the rule for what it changes does not. Smallest fix: decide that the range changes only the sparkline window and the evidence window, keeps the signal rule and baseline fixed, and add range to the URL state. If that is too much for v1, remove the chips.

## STORY-310: Expanding "8 others · no sustained change"
**Type**: short
**Topic**: Reading and triage
**Persona**: Deepa Nair, an owner who wants to confirm that her quiet engineers really are fine.
**Goal**: See who is in the "no change" group and what they do.
**Preconditions**: Cards view, no filters.
**Basis**: Mockup `#oth`, `#olist`, `aria-expanded`; `P` entries with `g:3`.
**Ideal path**: 1 step. Press "8 others · no sustained change".
**Alternate paths**: Switch to Table, read the eight rows with Group "No change".
### Steps
1. Press "8 others · no sustained change" → a list of eight names and roles (Kofi Mensah, Sales; Lena Ivanova, Engineer; ...).
2. Press again → list closes.
3. Apply Source "Slack" → count and list shrink to matching people.
### Variations
- No one is in "No change": the row is hidden.
- Click a name: Undefined (names are plain text, no evidence, no card).
### Edge Cases
- The list has no sources, last activity, or baseline, so it cannot confirm "no change"; it only lists names.
- Hidden people (roster "hide") are not counted; whether the user is told is Undefined.
- With a Group filter that excludes "No change", the row disappears with no note.
### Does it make sense?
Makes sense as a quiet list. The only gap is that names are dead ends: smallest fix is to leave it as-is for v1 and rely on the Table view for per-person detail.

## STORY-311: A 40-person team
**Type**: long
**Topic**: Reading and triage
**Persona**: Bianca Moretti, owner of a 40-person agency, opens Team health on Monday after connecting every source.
**Goal**: Find the few people who need attention without scrolling forever.
**Preconditions**: 40 people; suppose 6 in "Take care of first", 7 in "Workload signals", 5 revenue-only, 22 no change. The mockup has only 15 people, so this is extrapolated.
**Basis**: Mockup layout (`grid2` cards, Table with 8 columns and sticky first column, `#oth` list); README decision 6a.
**Ideal path**: 4 steps. Read summary, scan "Take care of first", filter to the signal she cares about, switch to Table to compare.
**Alternate paths**: Table first, sort by Signals.
### Steps
1. Read the summary → one sentence that must hold six names; Undefined how it shortens.
2. Scroll the cards → 13 cards in two grid columns; each card is tall (up to three signals with sparklines, buttons).
3. Reach "Revenue line" table → five rows, then "22 others · no sustained change".
4. Switch to Table → 40 rows in one scroll, no pagination, no grouping headers; eight columns require horizontal scroll on a laptop width, and the Person column is sticky.
5. Sort by Signals → top rows have the most signals; the revenue-only and quiet people sort to the bottom together.
### Variations
- Open the 22 others → a 22-line list below cards.
- Table, filter Group "No change": 22 rows of dashes.
### Edge Cases
- Cards at 40 people hide the comparison across people that Table gives, but Table loses per-signal sparklines and per-signal confidence.
- The summary has one line; at six names it either truncates or reads as a list.
- No "show only N" or collapse of "Workload signals", so the page length grows with the number of flagged people.
### Does it make sense?
Confusing at steps 1 and 4. Scaling is fine for the others list but poor for the summary and for the Table (no sticky header or group dividers stated, no row limit). Smallest fix: summary names at most three people then "and 3 more"; in Table, group dividers or default filter that hides "No change" rows. Do not add pagination for 40 rows.

## STORY-312: Spotting the same fact on four surfaces
**Type**: medium
**Topic**: Reading and triage
**Persona**: Rafael Duarte, an owner reading Maya's situation top to bottom.
**Goal**: Confirm that every surface agrees about Maya.
**Preconditions**: Cards view, then Table view.
**Basis**: Mockup summary, Maya card, Revenue line section, Table row.
**Ideal path**: 3 steps. Read summary, card, then Table row.
**Alternate paths**: none found.
### Steps
1. Summary: "Take care of Maya and Jonah first." → name only.
2. Card: Revenue line block plus three signals, tags, Evidence, actions → full detail.
3. Table row: Group tag "Take care of first", Revenue line "Northwind Labs, Harbor & Pine", Signals "3 Meetings 26 h/wk, from 14", one sparkline, "Medium", "2 wk ago" → compressed version.
4. Compare the "Changed" value "2 wk ago" with the card's "over 6 weeks" → he sees two different time frames for the same signal.
### Variations
- Revenue-only people (Sam Ferreira) appear in the Revenue line table in Cards but with "Add backup" only; in Table the same person appears with Group "Revenue line" and no action visible until the "…" menu.
### Edge Cases
- Maya's Confidence is "Medium" in Table, but one of her signals is Low in the card.
- Jonah's row "Signals" text "Reviews 38% of team, from 15%" omits that he has a second signal; only the count "2" tells him.
### Does it make sense?
Confusing at step 4. "Changed: 2 wk ago" (when the flag was raised) and "over 6 weeks" (how long the rise lasted) are two different facts under one word. Smallest fix: rename the column to "Flagged" with the tooltip "Weeks since this was first flagged", or show "6 wk" (duration) consistently.

## Redundancy notes

1. Revenue line information appears three times for revenue-critical people with a signal: the card's Revenue line block, the Table "Revenue line" column, and (for revenue-only people) the separate "Revenue line" section. The sections keep them separate, which is fine, but "Revenue line" is also a filter value, a card block heading, a section heading, a table column and a Group tag. One word, five roles.
2. The summary, the "Take care of first" section heading and the Group column all say who is first. The summary adds no information the section does not, except the count of others.
3. The "8 others" list and the Table "No change" rows show the same eight people twice, one with no data and one with dashes. Table's version has Actions and the list has none.
4. Two "Clear" buttons in the empty state (toolbar and message).
5. Filter by Group and the card sections do the same job in Cards; Sort "Group" is redundant in Cards.
6. Confidence is shown per signal on cards and again per person in Table, with different values.
7. Coverage chips, the confidence reasons ("Slack only", "no PTO data") and the Source filter all express source coverage in three ways.
8. "What this reads" repeats "12-week baseline" which is also in the aria-label of every sparkline.

## Topic findings

Ranked by severity.

1. **High. Weekend sparkline band covers the full chart height (STORY-303).** The chart says "normal" while the text says "4 of 6, baseline 1 in 6". Fix: compute the band from the baseline rate; add a tooltip "usual range".
2. **High. Evidence is missing for Jonah in Table and for Priya and Theo everywhere (STORY-305).** Plan promises evidence per signal. Fix: add evidence for every person with a signal; show the chevron for all; keep open rows across re-render.
3. **High. Summary is hard-coded and partly wrong (STORY-301, STORY-311).** "2 others show rising after-hours work" does not match Priya. It omits revenue-only people and the reason for Maya and Jonah. Fix: generate from data, name the reason, cap at three names.
4. **Medium. Range chips have no defined effect (STORY-309).** Fix: define that range changes only sparkline and evidence windows, and add to URL state; otherwise remove it.
5. **Medium. Source filter uses a person's source list, which can disagree with their evidence (STORY-307).** Maya's Gmail-based revenue evidence is excluded by the Gmail filter. Fix: derive sources from the evidence shown.
6. **Medium. Confidence tags mix coverage gaps with interpretation caveats, and conflict with a connected Calendar (STORY-304).** Fix: only coverage or single-source reasons; define when High appears; show the lowest confidence in Table.
7. **Medium. Filtering to "No change" leaves a collapsed row only (STORY-308).** Fix: expand the others list when no other section is visible.
8. **Medium. "Changed: 2 wk ago" vs "over 6 weeks" (STORY-312).** Fix: rename to "Flagged" or show duration.
9. **Medium. Sort "Group" and "Name" do not behave as labeled in Cards; "Last activity after hours" has no Table column (STORY-306).** Fix: hide Group sort in Cards; add the column or drop the option.
10. **Low. Group is named "Workload signals" in filter and "Workload" in the Table tag; "Filter · N" counts values (STORY-307).** Fix: one name; count groups or leave values.
11. **Low. Table at 40 people has no grouping, 8 columns of horizontal scroll (STORY-311).** Fix: group dividers or hide "No change" by default in Table.
12. **Low. Two Clear buttons in empty state (STORY-308).** Fix: keep the one in the message.
13. **Low. Names in the others list are dead ends (STORY-310).** Fix: none needed in v1.
