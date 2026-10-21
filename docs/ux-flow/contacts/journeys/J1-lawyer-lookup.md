# J1: "Who's our lawyer?" after a week of agent reading

Stories: STORY-009 (main), STORY-003 (search), STORY-004 (Kind filter).
Screenshots: `J1-lawyer-lookup-screens/` (numbers below refer to file prefixes).
Tags: **[M]** measured in the live demo stack, **[S]** suspected or taken from the catalog and not re-walked.

Verdict: **acceptable**. The shortest path works in 3 steps, but the first obvious moves (Kind = Legal, searching "lawyer") return "No matches", and the page gives no hint why.

## Friction Scorecard

| Measure | Ideal | Actual (founder's natural path) |
|---|---|---|
| Steps to the lawyer's email | 3 (open Contacts, type "law", read row) | 7: Contacts, Kind pill, Legal (empty), remove filter, search "lawyer" (empty), search "law", read row [M, screens 02, 03, 04, 05, 06] |
| Dead ends | 0 | 2: Kind = Legal "No matches" (04), "lawyer" "No matches" (05) [M] |
| Decisions | 1 (what to type) | 3: which filter or search first, which Kind, which word [M] |
| Re-entry | 0 | 0 on this path; but search and filter are cleared after leaving the page and returning (02 vs 10) [M] |
| Confirmations | 0 | 0 [M] |
| Hesitation points | 0 | "No matches" with no recovery action (04, 05); Kind "Other" on the law firm (06); the row is a firm inbox with no person (06) [M] |

Search by substring works on name, email and organization: "law" and "counsel" both find the row (06, 07) [M]. "lawyer" does not, because the word is only in Notes (05, 08) [M].

Not re-walked: sidebar search (my attempt typed into the box but showed no result overlay in the screenshot, 11, so I cannot claim anything either way) [S]; Cap table All-tab search [S].

## Take-away Pass

- **Contacts page (02)**: header, Search, Kind pill, table, Add contact. Nothing is removable. One primary action (Add contact) is correct for a list page. Four columns are all used. Minimal. [M]
- **Kind menu (03)**: eight options, including Customer, Vendor, Partner and Advisor, which the demo data does not use. Removable: options with zero contacts. Deferrable: the whole pill is only useful once there are many contacts. [M]
- **"No matches" (04, 05)**: bare text. It is the only place the page could help and it does nothing. Add the lookup that would have worked (see changes). [M]
- **Edit dialog (08)**: opens in edit mode for what was a read task. Name is auto-focused, and Delete is a red button at equal weight to Save. One line of helper copy, "Contacts are your address book. They do not change Carta.", is useful once but repeats on every open. Notes (the only evidence that this is outside counsel) appear only here. [M]
- **Return to Contacts (10)**: the list now has seven rows (Lena Sample and Noor Testperson are extra; they were added by other activity on the shared demo stack, not by this walk). Nothing marks them as new or as agent-added, so "what did the agents save this week" cannot be answered from the page. [M]

## The Simpler Version

1. Open Contacts.
2. Type "law" or "lawyer" or "counsel" (any of them works, because notes and role are searched).
3. Read the row: person or firm, email, and a short role.

Needed changes to get there:
- Search also reads Notes (and Kind label), so "lawyer" finds the firm.
- A role shown in the row (first line of Notes, or Kind text) so "Other" is not the only label.
- Agents file counsel as Legal (kind chosen by the saving tool), so the Kind pill works when it is used.
- Opening a row shows the contact read-first; edit and delete sit behind it.

## Clarity Issues

- "Other" as the Kind for outside counsel (06): vague, and the founder cannot tell it from a miscategorized contact. [M]
- "No matches" (04, 05) does not say what was searched (name, email, organization). A founder reasonably assumes role words are covered. [M]
- "Edit contact" (08) is the title of a dialog the founder opened only to read. [M]
- Name "Fictional Law Group" is a firm, while the question was "who is our lawyer"; no person, no title (06). [M, data issue more than UI]

## Ranked Changes

| Rank | Effort | Change | Files it would touch |
|---|---|---|---|
| P1 | S | Search also matches Notes (and Kind label). Fixes the "lawyer" dead end (05) on the core "who do we work with" path; the backend list filter and the Cap table search should use the same match. | contacts list query and `contacts_list` filter in the API contacts module; `apps/web` Contacts page filter; Cap table search helper |
| P1 | S | Agent contact tools (Legal agent, Data room agent) save counsel as kind Legal, not Other, so the existing Kind pill finds them. | Legal agent prompt/tool defaults, `contacts_add` mapping |
| P2 | S | "No matches" offers one recovery: "Clear filters" when a Kind or search is active (catalog already notes there is none). Reuse Cap table's "Clear filters". | Contacts page component, shared empty-state |
| P2 | M | Show a lightweight source cue for agent-added contacts (small "Added by Legal agent" under the name, or a "Recent" sort). Builds trust in what agents saved (10 shows no cue). | contacts schema (source, createdAt), Contacts page row |
| P2 | S | Open a row read-first: no auto-focus on Name, Delete moved behind a menu or demoted. | Contact dialog in `packages/ui-web`/Contacts page |
| P3 | S | Kind menu lists only kinds in use, plus "Other". | Contacts page Kind pill |
| P3 | S | Keep the search text and Kind filter when the user returns to Contacts (10). | Contacts page state (URL search params) |
