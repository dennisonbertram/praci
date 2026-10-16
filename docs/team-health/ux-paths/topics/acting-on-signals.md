# Topic 4: Acting on signals

Basis files: `docs/team-health/mockup.html` (card actions at the `.acts` rows, Revenue line table, "Ask agent" button), `README.md` decisions 4, 6, 9, 10, `research.md` section 5 item 4. The mockup's buttons are static; no popover, snooze list, toast or agent panel is drawn. Anything about what happens after a click is therefore Undefined unless a README decision covers it.

## STORY-401: Schedule 1:1 with Maya
**Type**: medium
**Topic**: Acting on signals
**Persona**: Ines Hargrove, founder and space owner, opens Team health on Monday and sees Maya Okonkwo (Account lead) under "Take care of first".
**Goal**: Book a 1:1 with Maya this week without leaving the page.
**Preconditions**: Owner of the space; Google Calendar connected (green chip); Team health agent exists (phase 5).
**Basis**: Mockup Maya card, button "Schedule 1:1"; README decision 10.
**Ideal path**: 4 steps. Click "Schedule 1:1", review the drafted event, approve, see the confirmation.
**Alternate paths**: Ask agent in the header and type the request by hand (more steps, same result).
### Steps
1. Click "Schedule 1:1" on Maya's card → per decision 10 the Team health agent opens with a drafted request. The mockup does not show the panel; the Finance pattern (README of Finance, "Ask agent" opens a side panel) suggests a side panel. Panel placement for card actions is Undefined.
2. Agent proposes a calendar event (title, time, attendees, Meet link or not) → the owner sees an approval prompt. What the prompt contains is Undefined for Team health; the Carta pattern shows every recipient and the full content before a send.
3. Owner approves → agent creates the event and Maya receives a normal calendar invitation.
4. Owner returns to the card → nothing in the plan says the card changes. Undefined.
### Variations
- Owner edits the proposed time in chat before approving.
- Owner rejects the draft; no event is created.
- Calendar not connected: the chip is dashed; the button's behaviour is Undefined (hide, disable, or agent explains).
### Edge Cases
- Maya's calendar is full this week (she has 26 h/wk of meetings). Whether the agent can read her free/busy as an internal teammate is Undefined.
- The invitation title is visible to Maya. If the title mentions "workload" or "burnout" it discloses the signal to her; the draft wording is Undefined.
- Owner clicks the button twice: two drafts or one? Undefined.
### Does it make sense?
Verdict: Confusing at step 4. The request-and-approve path (steps 1 to 3) is defined by decision 10, but the owner gets no result on the card. Maya's card looks identical after the 1:1 is booked, so the owner may book twice or forget it was done. Smallest fix: after an approved action, the card shows a one-line "1:1 booked Thu 2 PM" in place of the button (the button returns when the event passes). Also define the invitation title as neutral ("1:1 Ines / Maya") so the invite never names the signal.

## STORY-402: Move 4 reviews from Jonah to Sam
**Type**: medium
**Topic**: Acting on signals
**Persona**: Ines Hargrove looks at Jonah Petrakis (Backend engineer, billing) whose share of team PR reviews rose from 15% to 38%.
**Goal**: Rebalance reviews without overloading someone else.
**Preconditions**: GitHub connected; agent can read open PRs and has a GitHub write tool (assumed; README says only "reassignment").
**Basis**: Mockup Jonah card, "Move 4 reviews to Sam"; README decision 10; Revenue line row "Sam Ferreira, checkout-api, Sole author of 24 of 24 changes".
**Ideal path**: 4 steps. Click, review the list of 4 PRs and Sam's current load, approve, see result.
**Alternate paths**: Ask agent "Who else could take reviews from Jonah?".
### Steps
1. Click "Move 4 reviews to Sam" → agent drafts a reassignment of 4 open review requests. The mockup does not say which 4 or how they are chosen. Undefined.
2. Owner reads the proposal → must see the PR titles and repos. Whether Sam's own open review count and his signals are shown is Undefined.
3. Owner approves → GitHub review requests move from Jonah to Sam; Sam gets GitHub notifications and Jonah's queue shrinks.
4. Card after action → Undefined; Jonah's signal (38% over 5 weeks) will not drop for weeks, so the card keeps showing the problem.
### Variations
- Owner changes "Sam" to "Lena" in chat.
- Some of the 4 PRs are ones Sam authored: GitHub does not allow an author to review their own PR. The agent must pick others or say so.
### Edge Cases
- Sam is the sole author of 24 of 24 checkout-api changes and a Revenue-line dependency. Giving him 4 more reviews loads the person the page already flags as a single point of failure. The button label names Sam but nothing says why Sam was chosen. The README does not say the agent considers the target's load. Undefined.
- Jonah reviewed 14 of 17 checkout-api PRs, and only people who know that repo can review it. Sam may be the only candidate, which makes this suggestion circular.
- Sam is not a Rakazo user; his consent or awareness is not part of the flow. He is simply notified by GitHub.
### Does it make sense?
Verdict: Confusing at step 2. The suggested target is chosen without a visible reason, and the same page lists Sam as a key-person risk. Smallest fix: the approval prompt must show the 4 PRs and Sam's current open reviews, and the agent should choose a target with no current workload signal and say why; if only Sam qualifies, the prompt says "Sam is the only reviewer who knows checkout-api" so the owner decides knowingly.

## STORY-403: Add backup for Sam on checkout-api
**Type**: medium
**Topic**: Acting on signals
**Persona**: Ines Hargrove reads the "Revenue line" table: Sam Ferreira, Depends on them: checkout-api, "Sole author of 24 of 24 changes, last 90 days".
**Goal**: Reduce the risk that only Sam can maintain checkout-api.
**Preconditions**: GitHub connected.
**Basis**: Mockup Revenue line rows, "Add backup" button; README decision 10 ("Add backup" opens the agent); research.md item 5 (add a second owner or schedule a handover).
**Ideal path**: 4 steps. Click, agent proposes who and how, approve, see result.
**Alternate paths**: "Add second owner for Northwind" on Maya's card is the same kind of action for an account.
### Steps
1. Click "Add backup" on Sam's row → agent opens with a drafted request. What "backup" means is not defined anywhere. Undefined.
2. Agent proposes candidates → there is no data model for owners (no CODEOWNERS read is mentioned). Possible actions: edit CODEOWNERS (a repo write), message a candidate, or create a Linear ticket. None is named in the README. Undefined.
3. Owner approves → who is notified is Undefined (Sam? the backup? both?).
4. Row after action → Undefined. Sole-author counts only fall as the backup commits, so the row stays for months.
### Variations
- Marcus Bell, Bluefin Health: backup for a customer relationship means introducing a second internal contact to the customer, which is an outward email. Per the Carta pattern, that send needs full per-message approval showing recipients.
### Edge Cases
- The Revenue line row has no "Not an issue" or "Done", so an owner who has already handled it by other means cannot clear it.
- Naming a backup tells Sam "someone will learn your code"; Sam may read it as replacement. Wording is Undefined.
### Does it make sense?
Verdict: Undefined at step 1. The button label is clear, but the result is not. Smallest fix: state in the README that "Add backup" only drafts a message to the owner (Ines herself) proposing a candidate and a handover step, makes no repo or CRM change, and notifies nobody until the owner approves a specific message. Add "Not an issue" to Revenue line rows.

## STORY-404: Block focus time Thursday for Priya
**Type**: short
**Topic**: Acting on signals
**Persona**: Ines Hargrove sees Priya Raman (Designer) with meetings up from 13 to 21 h/wk.
**Goal**: Protect a day for Priya.
**Preconditions**: Calendar connected; Ines is the owner, Priya is a teammate.
**Basis**: Mockup Priya card, "Block focus time Thursday"; README decision 10 (calendar event, no direct writes).
**Ideal path**: 3 steps. Click, review event, approve.
**Alternate paths**: none found.
### Steps
1. Click "Block focus time Thursday" → agent drafts a calendar event.
2. Owner sees the draft → whose calendar? The owner's token can write only the owner's calendar. A block on Priya's calendar needs either her sharing edit rights (unlikely) or an invitation she must accept. Undefined which one is used.
3. Owner approves → if it is an invitation, Priya sees an event on Thursday that she can decline; the block does not exist until she accepts.
### Variations
- Owner moves the day to Friday.
### Edge Cases
- Priya already has meetings on Thursday. A focus block that overlaps them does nothing; the agent should say so. Undefined.
- Priya may not know the owner is watching her calendar load. The invite is the first she hears of it. This conflicts with the stated rule that each person can see their own view only after a link; a person who has never seen the page gets a surprising invite.
### Does it make sense?
Verdict: Confusing at step 2. The button reads as if the owner can edit Priya's time, but Calendar access is the owner's. Smallest fix: relabel to "Invite Priya to a focus block Thursday" and have the draft show the invitee and a neutral title ("Focus time"). Say in the approval prompt that Priya can decline.

## STORY-405: Not an issue, then change of mind
**Type**: medium
**Topic**: Acting on signals
**Persona**: Ines Hargrove knows Theo Lindqvist (Support) is covering a product launch and clicks "Not an issue" on his card.
**Goal**: Hide the card for now, and later find it again.
**Preconditions**: Theo's card is under "Workload signals".
**Basis**: Mockup Theo card, "Not an issue"; README decision 9 (8-week snooze, hidden until the snooze ends or the signal changes).
**Ideal path**: 2 steps. Click, card disappears.
**Alternate paths**: "Wrong, I know why" (see STORY-407).
### Steps
1. Click "Not an issue" → a `TeamHealthFeedback` row is stored with `not_an_issue` and an 8-week snooze. Whether the card disappears at once, whether there is a confirmation, and whether the click asks for a reason are Undefined. The mockup shows no toast.
2. Page re-renders → Theo moves to "N others · no sustained change"? Or disappears? Undefined. The count "8 others" would be wrong if he is added, because his signal is not gone.
### Variations
- The snooze is per signal, not per person: Theo has two signals (after 8 PM replies, tickets owned). The button sits on the card, not on a signal. Does it snooze both? Undefined.
- Seven weeks later his after-hours replies double. README says the signal "changes", but the margin that counts as a change is not defined. Undefined.
### Edge Cases
- Accidental click: no undo is drawn. The README gives no place where snoozed items go, so the owner cannot find Theo's card to restore it. The Filter has no "Snoozed" option (Group, Signal, Source only).
- Table view: the actions column has a hidden "Actions" header; whether it holds "Not an issue" is not shown.
- Revenue line rows and Maya/Jonah cards: Revenue line rows have no "Not an issue" at all.
### Does it make sense?
Verdict: Broken at step 1 (no undo, no snoozed list). An irreversible-looking 8-week hide of a wellbeing signal, with no way back, is the biggest gap in this topic. Smallest fix: show a toast "Snoozed 8 weeks. Undo" for several seconds, and add a "Snoozed (N)" row at the end of the card list (beside "N others") listing snoozed people with the end date and a "Restore" button.

## STORY-406: Done on a sustained signal
**Type**: medium
**Topic**: Acting on signals
**Persona**: Ines Hargrove booked a 1:1 with Jonah Petrakis, talked to him, and clicks "Done" on his card.
**Goal**: Mark the matter as handled so the page stops asking.
**Preconditions**: Jonah's signals are still in the data (reviews 38%, late commits 9 of 20 workdays).
**Basis**: Mockup Jonah card, "Done" (present on Maya and Jonah only); README decision 9 (`done`).
**Ideal path**: 2 steps. Click, card changes.
**Alternate paths**: none found.
### Steps
1. Click "Done" → `TeamHealthFeedback` of type `done` is stored.
2. Card result → Undefined. The README says dismissed signals stay hidden "until the snooze ends or the signal changes", and gives `done` no duration. If `done` hides forever, a still-worsening signal disappears. If it hides until the signal changes, it behaves like "Not an issue" and the two buttons mean the same.
### Variations
- Two weeks later Jonah's late commits rise again. Should the card return, and with what note ("Marked done Oct 20")? Undefined.
### Edge Cases
- Priya and Theo cards and all Revenue line rows have no "Done" button, so the same action is available on some cards and not others with no stated reason.
- Done after Schedule 1:1: the owner has to click both; the action does not mark itself done.
### Does it make sense?
Verdict: Confusing at step 2. "Done" and "Not an issue" are two buttons for what the owner sees as one outcome (stop showing this), and the data model gives them no distinct behavior. Smallest fix: define `done` as "handled; hide until the signal worsens beyond its value on that date, and show a small 'Marked done Oct 20' line when it returns", and show "Done" on every card with an action.

## STORY-407: Disagree with the data: Not revenue and "Wrong, I know why"
**Type**: medium
**Topic**: Acting on signals
**Persona**: Ines Hargrove sees Marcus Bell (Sales) in the Revenue line table for Bluefin Health, but Bluefin is a free pilot. Separately she thinks Jonah's late commits come from a time zone move.
**Goal**: Correct a wrong revenue inference and record a reason for a workload signal.
**Preconditions**: None beyond the cards being visible.
**Basis**: README decision 6 (owner can mark a row "Not revenue"), decision 9 (optional note); research.md section 5 item 4 ("Wrong, I know why" adds a note). Mockup: neither "Not revenue" nor "Wrong, I know why" appears anywhere.
**Ideal path**: 3 steps. Find the control, choose it, see the row leave.
**Alternate paths**: Ask agent "Bluefin is a free pilot".
### Steps
1. Look at Marcus's row → only "Add backup" is visible. No "Not revenue" control. Broken in the mockup (decision 6 promises it).
2. Look at Jonah's card → buttons are "Schedule 1:1", "Move 4 reviews to Sam", "Not an issue", "Done". No "Wrong, I know why". The research recommended it; the plan reduced it to an optional `note` in decision 9, with no place to type it. Undefined.
3. Intended result → unclear whether "Not revenue" removes the row, or only that person-account pair. Row key is per person and per line; Maya has two lines, and removing one but not the other is Undefined.
### Variations
- Ines marks the checkout-api row "Not revenue"; the revenue-service rule is name matching (billing, checkout, payments, pricing), so a wrong match can recur on a new repo. Whether the correction applies to the repo name or the single row is Undefined.
### Edge Cases
- Without a note, the page cannot tell "snoozed because Theo has a launch" from "snoozed because accidentally clicked".
- A note about Jonah is private to Ines; the README says a linked teammate can see and add notes on their own card. Whether Jonah sees Ines's note is Undefined and important.
### Does it make sense?
Verdict: Broken at steps 1 and 2. Two promised corrections have no visible control. Smallest fix: add a "…" menu on each Revenue line row with "Not revenue", and on each card a menu entry "Add note" that shares one text field with "Not an issue"; state whether notes are visible to the person.

## STORY-408: Ask agent "Who covers Jonah if he's out next week?"
**Type**: medium
**Topic**: Acting on signals
**Persona**: Ines Hargrove has Jonah's card open and wants coverage options before a trip planned for him.
**Goal**: Get an answer about coverage from the data.
**Preconditions**: Team health agent with read tools over the overview (phase 5); Calendar connected, no PTO data.
**Basis**: Mockup header "Ask agent" button; README phase 5 ("read-only tools over the overview, approval-gated actions"); decision 7 (High confidence only with PTO data).
**Ideal path**: 3 steps. Click "Ask agent", type the question, read the answer.
**Alternate paths**: Click an action button on a card, which opens the agent with a drafted request.
### Steps
1. Click "Ask agent" → panel opens. Following Finance, the header button hides while the panel is open. For Team health this is not stated. Undefined.
2. Type the question → agent reads the overview rows: Jonah wrote 71% of billing-service changes and reviewed 14 of 17 checkout-api PRs. It can name who else touched those repos.
3. Agent answers → it cannot see Jonah's time off ("no PTO data") and should say so. The answer is a suggestion tagged with its basis, never an automatic action.
### Variations
- Follow-up "Move his reviews to Lena" → the same approval path as STORY-402.
- Owner asks about a person's private content ("what did Maya say to Northwind?") → the agent has no message text (decision 2) and should say that.
### Edge Cases
- Linked teammates have no agent (decision 8); a non-owner who opens the page sees no "Ask agent" button. Not an issue here but confirms access.
- The agent sees the same card state as the page, including snoozed signals? Undefined.
- Agent history: whether this conversation persists with the page across reloads is Undefined.
### Does it make sense?
Verdict: Makes sense, with one caveat at step 3: the answer must state "no PTO data" so Ines does not assume Jonah is free. Smallest fix: require the agent's answers to repeat the confidence tag from the card.

## STORY-409: Fix the roster: hide a person or split a wrong merge
**Type**: medium
**Topic**: Acting on signals
**Persona**: Ines Hargrove notices that "Kofi Mensah" in the "8 others" list combines two people: a sales hire and an outside contractor with a similar address.
**Goal**: Remove an advisor from the page and separate a wrongly merged identity.
**Preconditions**: Roster is built from the first sync (decision 4).
**Basis**: README decision 4 (owner can split a wrong merge or hide a person from "others"); mockup "8 others · no sustained change" list.
**Ideal path**: 3 steps. Open the person, choose Hide or Split, confirm.
**Alternate paths**: none found.
### Steps
1. Expand "8 others" → rows show names, role and sources. No menu, "Hide", or "Split" control is in the mockup. Broken in the mockup.
2. Choose Hide (not drawn) → `TeamMember.hidden` is set. Hidden people appear in no section; where to restore them is Undefined (no "Hidden" filter).
3. Choose Split (not drawn) → which identifiers go to which person (email, GitHub login, Slack id, Linear id) needs a picker. Undefined.
### Variations
- Hiding someone who currently has a card in "Take care of first". The owner could hide Maya to make the problem go away; no warning is defined.
### Edge Cases
- Hidden person who is linked to a Rakazo account (self-view link): they lose their own card? Undefined.
- After a split, 15-week history for each new person needs recomputing. Undefined whether history is split by source id or lost.
### Does it make sense?
Verdict: Broken at step 1. The plan promises roster correction, but there is no screen, so a wrong merge produces wrong named-person signals with no remedy. Smallest fix: add a "…" menu to each row in "8 others" and the Table with "Hide" and "Split…", plus a "Hidden (N)" line below the others list to restore people.

## STORY-410: Acting from a phone
**Type**: short
**Topic**: Acting on signals
**Persona**: Ines Hargrove is at an airport with the Rakazo mobile app and wants to approve the 1:1 draft for Maya.
**Goal**: Complete or at least not lose an action while away from a desktop.
**Preconditions**: Mobile page is phase 6; until then mobile shows no Team health link (README intro).
**Basis**: README intro and phase 6; mockup `@media (max-width:760px)` (web narrow layout only).
**Ideal path**: 3 steps. Open the approval notification, review, approve.
**Alternate paths**: Open the web page in a mobile browser at narrow width.
### Steps
1. Open the Rakazo mobile app → no Team health entry exists. Correct and safe per the plan.
2. Pending approval from an earlier desktop request → whether per-action approvals created from Team health appear in the mobile inbox is Undefined. The Carta pattern uses the shared approval path, so it likely does, but the approval card would have no card context.
3. Approve on mobile → event is created. Result appears when the owner next opens the web page; see STORY-401, step 4.
### Variations
- Open the web page at under 760 px: the mockup has a narrow layout, but buttons "Block focus time Thursday" and others are long and may wrap. Undefined.
### Edge Cases
- Approving a "Move 4 reviews" request on a small screen where the PR list is truncated is risky; the approval prompt should list all 4 titles.
### Does it make sense?
Verdict: Undefined at step 2. Whether approvals can complete on mobile is not stated. Smallest fix: state that approvals appear in the mobile approval list with the full content, and that creating them is a web action only.

## Topic findings

1. Broken, high: No undo and no place for snoozed items (STORY-405). Fix: toast with "Undo" and a "Snoozed (N)" list with "Restore".
2. Broken, high: "Not revenue" (decision 6) and "Wrong, I know why"/note (decision 9, research) have no control in the mockup (STORY-407). Fix: "…" menu on Revenue line rows and cards with "Not revenue" and "Add note"; say if notes show to the person.
3. Broken, high: No UI for roster hide or split (STORY-409). Fix: "…" menu on rows in "8 others" and Table, with a "Hidden (N)" restore line.
4. Confusing, high: "Move 4 reviews to Sam" targets the page's own single point of failure with no stated reason (STORY-402). Fix: approval prompt shows the PRs and Sam's current load; the agent picks a target without a workload signal or says Sam is the only choice.
5. Undefined, high: "Add backup" and "Add second owner" have no defined effect or notification (STORY-403). Fix: define as a draft message to the owner only; no repo/CRM write; nothing sent until a specific message is approved; add "Not an issue" to Revenue line rows.
6. Confusing, medium: No visible result after an approved action; the card stays unchanged, which invites duplicate bookings (STORY-401). Fix: replace the button with "1:1 booked Thu 2 PM" after approval; use a neutral invite title.
7. Confusing, medium: "Block focus time Thursday" implies write access to Priya's calendar; only an invitation is possible (STORY-404). Fix: relabel "Invite Priya to a focus block Thursday" and show the decline option.
8. Confusing, medium: "Done" and "Not an issue" overlap, `done` has no defined duration, and "Done" appears on only two cards (STORY-406). Fix: define `done` as hide until the signal worsens, show "Marked done <date>" on return, show it on every action card.
9. Undefined, low: Snooze applies to the person or signal? Not stated (STORY-405). Fix: snooze per signal key, button text "Not an issue" applies to the shown signals.
10. Undefined, low: Mobile approvals and narrow-width button wrapping (STORY-410). Fix: approvals appear in the mobile approval list with full content.
11. Makes sense: Ask agent coverage question (STORY-408); only add the confidence tag to answers.
