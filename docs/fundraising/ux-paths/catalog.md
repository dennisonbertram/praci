# UX Path Catalog: Investors and Fundraising (planned), round 6

Generated 2026-10-20, round 6. Round 6 re-checked the stories against the round-5 plan (SAFE counting rule, portal notices for Post to portal, Unknown counts as resolved, Portal access) and found 1 new must-fix and 2 new nice gaps. Round 5 updated the stories for the round-4 plan and mockup (55 views; new `ed-unticked`, `ed-unknown`, `ed-boardnog`, `inv-sending`, `inv-posted`): To list hidden without Gmail and the unticked-investor line, portal notices for Post to portal, board update without Gmail, "every SAFE counts once", the Unknown delivery state, 44 px phone tap targets and stacked typed-in rows. Round 4 header follows.  Source: the plan after its fourth revision (`docs/fundraising/README.md`, 10 slices) and the 50-view mockup (`docs/fundraising/mockup.html`, views selected by URL hash such as `#safe-dialog`), not running code. The feature is planned, so every path was walked on paper against the plan and the mockup. The plan is the discovery document; no separate `discovery.md` exists. Round 4 updated the stories whose steps no longer matched the plan after round 3 (new `PortalSession` table; updates visible to every investor contact with portal access and no per-update shares; board updates never on the portal; sent updates read-only with Duplicate and Delete; "Post to portal" and the Posted status without Gmail; a background send job; Mercury merge needs an email; the "Pending" round-bar segment; per-row saves with "Changed elsewhere"; new views `safe-link`, `inv-updmenu`, `inv-copylink`, `inv-addcontact`, `inv-changed`) and re-checked every open gap. Rounds 1 to 3 text below is kept as history.

Total stories: 80 (31 short, 36 medium, 13 long) in 6 topic files under `docs/fundraising/ux-paths/topics/`. Round 4 changed the steps of 37 stories (listed in `round-4.md`) and added none. Plan gaps after round 10: 0 blocker, 0 must-fix, 0 should-fix, 16 nice (see "Plan gaps (round 10)"); 16 open in all, plus 2 carried gaps skipped with a reason that holds (round 4 read: 4 should-fix, 23 nice). All names and figures in the stories are invented.

Gap tags inside the stories: `PG-nn` is a round-1 gap that is still open; `NG-nn` is a round-2, round-3 or round-4 gap that is still open. Gaps that were resolved carry no tag. The authoritative open list is "Plan gaps (round 6)" below.

The catalog renumbers the stories as STORY-FR-001 to STORY-FR-080 in topic order and does not copy story bodies. To read a story, open the topic file at the heading with the topic-file id.

## Id mapping (topic-file id to catalog id)

| Topic file | Topic-file ids | Catalog ids |
|---|---|---|
| [cap-table-sources.md](topics/cap-table-sources.md) | STORY-101 to 113 | STORY-FR-001 to 013 |
| [updates-and-board.md](topics/updates-and-board.md) | STORY-201 to 213 | STORY-FR-014 to 026 |
| [investor-portal.md](topics/investor-portal.md) | STORY-301 to 311 | STORY-FR-027 to 037 |
| [audit-requests.md](topics/audit-requests.md) | STORY-401 to 412 | STORY-FR-038 to 049 |
| [fundraising-safes.md](topics/fundraising-safes.md) | STORY-501 to 517 | STORY-FR-050 to 066 |
| [first-run-and-cross-page.md](topics/first-run-and-cross-page.md) | STORY-601 to 614 | STORY-FR-067 to 080 |

Per story (R = rewritten in round 2, N = new in round 2):

| Catalog | Topic file | Round 2 | Type | Title |
|---|---|---|---|---|
| FR-001 | 101 | R | short | Cap Table becomes Investors (rename, redirect, hidden page) |
| FR-002 | 102 | R | medium | Empty page, choose a source |
| FR-003 | 103 | R | medium | Sheet read fails, old table stays |
| FR-004 | 104 | R | long | Type it in, build the cap table by hand |
| FR-005 | 105 | R | long | Switching source keeps one version back |
| FR-006 | 106 | R | medium | The SAFEs, if converted at cap group |
| FR-007 | 107 | R | short | Hide amounts across sources and surfaces |
| FR-008 | 108 | R | medium | Investors on a phone, with the sources |
| FR-009 | 109 | R | long | Carta-and-sheet household, one writer per source |
| FR-010 | 110 | N | short | Undo a source switch you did not mean |
| FR-011 | 111 | N | short | Equity raised and the SAFEs group are different numbers |
| FR-012 | 112 | N | medium | Two tabs edit the typed-in table |
| FR-013 | 113 | N | short | Autosave fails while offline |
| FR-014 | 201 | R | long | Monthly reminder lands, founder reviews and sends the October update |
| FR-015 | 202 | R | medium | Draft with agent fills a blank update |
| FR-016 | 203 | R | short | Choosing recipients |
| FR-017 | 204 | R | medium | No Gmail connected, Share instead of Send |
| FR-018 | 205 | R | short | Two Gmail accounts, pick the sender |
| FR-019 | 206 | R | short | Reminder in the Updates menu |
| FR-020 | 207 | R | short | Update history, reopen a sent update |
| FR-021 | 208 | R | long | Message the board |
| FR-022 | 209 | R | medium | Phone notification opens the agent chat |
| FR-023 | 210 | N | medium | A recipient's send fails, Retry |
| FR-024 | 211 | N | short | Duplicate or delete a sent update |
| FR-025 | 212 | N | short | Send with a revoked investor in the list |
| FR-026 | 213 | N | short | The monthly routine with nothing to draft from |
| FR-027 | 301 | R | short | Founder resends a portal link from a contact |
| FR-028 | 302 | R | medium | Share a Data room document with chosen investors |
| FR-029 | 303 | R | medium | Send creates the shares and a personal link per recipient |
| FR-030 | 304 | R | long | Investor receives the link, reads on a phone, downloads a document |
| FR-031 | 305 | R | medium | Link no longer works, request a new one |
| FR-032 | 306 | R | short | Dead link variants |
| FR-033 | 307 | R | medium | Same email at two companies, and a forwarded link |
| FR-034 | 308 | R | medium | Founder revokes access and changes a contact's email |
| FR-035 | 309 | R | short | No email provider, founder copies the link |
| FR-036 | 310 | N | long | Portal security walk with a careless and a hostile investor |
| FR-037 | 311 | N | short | Nothing shared yet, and Sign out |
| FR-038 | 401 | R | long | Plain email with a PDF confirmation letter, happy path |
| FR-039 | 402 | R | medium | DocuSign envelope request |
| FR-040 | 403 | R | medium | Portal-link request |
| FR-041 | 404 | R | short | Dismiss a false positive |
| FR-042 | 405 | R | medium | A request that arrived outside Gmail |
| FR-043 | 406 | R | medium | A request arrives off-season |
| FR-044 | 407 | R | medium | The same fund sends a reminder |
| FR-045 | 408 | R | long | SAFE holder versus equity holder, and as-of mismatch |
| FR-046 | 409 | R | short | A request the matcher missed, ask the agent |
| FR-047 | 410 | N | medium | A reply closes the row, and Mark done is the fallback |
| FR-048 | 411 | N | short | Show done, the history |
| FR-049 | 412 | N | short | Sender not in Auditors |
| FR-050 | 501 | R | medium | Start a round and add the first prospects |
| FR-051 | 502 | R | medium | Move a prospect through the stages and log contact |
| FR-052 | 503 | R | long | Send SAFE without Mercury (native dialog, cover summary) |
| FR-053 | 504 | R | medium | Mark a native SAFE Sent, Signed, Funded |
| FR-054 | 505 | R | medium | Mercury connected, SAFEs appear with a derived status |
| FR-055 | 506 | R | long | Send SAFE with Mercury, the prospect waits and the SAFE attaches |
| FR-056 | 507 | R | medium | Awaiting deposit, matched or not |
| FR-057 | 508 | R | short | Close the round |
| FR-058 | 509 | R | long | A signing prospect becomes an investor |
| FR-059 | 510 | R | short | Mercury not connected |
| FR-060 | 511 | R | short | Mercury sign-in expired, or the sync failed |
| FR-061 | 512 | N | medium | Send SAFE with Mercury, the hand-off is abandoned (Not sent) |
| FR-062 | 513 | N | medium | Close a round, then start the next |
| FR-063 | 514 | N | medium | Expired and canceled SAFEs |
| FR-064 | 515 | N | short | Edit the round |
| FR-065 | 516 | N | short | Assign to contact, change it, unassign it |
| FR-066 | 517 | N | medium | Fundraising on a phone |
| FR-067 | 601 | R | medium | Brand-new founder opens Investors, then Fundraising, with nothing connected |
| FR-068 | 602 | R | medium | Existing Carta user after the rename |
| FR-069 | 603 | R | short | Ask on Investors and on Fundraising open the same agent |
| FR-070 | 604 | R | long | A six-week $750k SAFE round, end to end |
| FR-071 | 605 | R | short | Hiding Fundraising after the round closes |
| FR-072 | 606 | R | short | Command palette and sidebar search reach both pages |
| FR-073 | 607 | R | medium | What the Investors badge means |
| FR-074 | 608 | R | medium | Which agent to ask about a SAFE deposit |
| FR-075 | 609 | N | medium | Contacts on Investors, add, tabs, change kind |
| FR-076 | 610 | N | short | A person with two contact kinds |
| FR-077 | 611 | N | medium | Carta contacts merge with hand-added ones |
| FR-078 | 612 | N | short | Questions to the agent about the round and pipeline |
| FR-079 | 613 | N | medium | Two members in one space |
| FR-080 | 614 | N | short | Narrow web, switching pages |

## Summary by type

| Topic | Short | Medium | Long | Total |
|---|---|---|---|---|
| Cap table sources | 5 | 5 | 3 | 13 |
| Updates and board | 7 | 4 | 2 | 13 |
| Investor portal | 4 | 5 | 2 | 11 |
| Audit requests | 4 | 6 | 2 | 12 |
| Fundraising and SAFEs | 5 | 9 | 3 | 17 |
| First run and cross-page | 6 | 7 | 1 | 14 |
| **Total** | **31** | **36** | **13** | **80** |

## Coverage matrix

Plan slices (README "Slices", 10 slices):

| Slice | Stories | Gaps in coverage |
|---|---|---|
| 1. Rename Cap Table to Investors | FR-001, 068, 071, 072, 080 | None. The redirect tail path is an edge case in FR-001. |
| 2. Investors agent | FR-067, 068, 069, 073, 074, 078, 079; FR-015, 019, 026 | Concurrent routine seeding from two API processes has no user-visible path (advisory lock; tests only). |
| 3. Cap table sources: typed-in table, source line, undo, math | FR-002, 004, 005, 006, 007, 008, 010, 011, 012, 013 | Delete holder is a variation of FR-004; blank and duplicate rows are the PG-15 remainder. |
| 4. Google Sheet as source | FR-002, 003, 009, 010 | Drive revoked mid-read is an edge case only. |
| 5. Updates and board | FR-014 to 026 | Accessibility of the contenteditable body (see "Not yet written"). |
| 6. Investor portal | FR-027 to 037 | Portal on a screen reader (see "Not yet written"). |
| 7. Audit requests on arrival | FR-038 to 049 | Overdue styling has no story because the plan has none. |
| 8. Fundraising page: round and pipeline | FR-050, 051, 057, 062, 064, 066, 067, 070, 078 | Edit prospect is inside FR-051 only. |
| 9. SAFEs: native rows, Send SAFE, cover summary, Attention | FR-052, 053, 058, 061, 063, 006, 011 | The Mark funded date dialog is drawn; the Undo control is named in the plan only. |
| 10. Mercury sync, Waiting for Mercury, deposit matching | FR-054, 055, 056, 059, 060, 061, 065 | Brex-only founders and the "N SAFEs could not be read" line are variations only; NG-44 on the round bar (no longer applies: no hand-off Draft). |

Plan features and mockup views:

| Plan feature | Stories | Note |
|---|---|---|
| Investors header: source line and menu (Refresh, Change source, Undo) | FR-002, 003, 005, 009, 010 | |
| Investors header: Hide amounts, Add contact, Ask | FR-007, 075, 069 | Empty view has Ask only (FR-002, 067). |
| Source Undo | FR-005, 010 | Typed-in menu drawn (`#inv-native-menu`). |
| Sheet: Reading sheet… and Last read failed | FR-002, 003 | `#inv-nosnap` drawn; a failed switch keeps the old label (round 3); PG-23 remainder: body during the first read. |
| Typed-in table: autosave, "Saved", "Not saved" with Retry | FR-004, 012, 013 | Per-row saves and `#inv-changed` drawn; NG-50: partly filled row, row deleted elsewhere, stale percentages. |
| Action items: audit rows, update draft | FR-014, 038 to 049 | |
| Audit row menu: Mark done, Dismiss, Show done | FR-041, 047, 048 | |
| Cap table: two figures, bar, holdings, pool | FR-004, 006, 011 | |
| "SAFEs, if converted at cap" group and Equity raised | FR-006, 011, 058 | |
| Updates card and the "…" menu with Reminder | FR-019, 020, 024 | Reminder menu drawn (`#inv-reminder`); `#inv-partly` shows the Partly sent row. |
| Update editor: To list, TBD prompt, Send, Post to portal, From, Sending, Failed, Retry | FR-014, 015, 016, 017, 018, 023 | NG-41 to NG-43, NG-45, NG-46. |
| Contacts: tabs, Portal column, Resend link, Revoke, Unblock, Edit, Delete | FR-027, 034, 075 | Row menus and Add contact drawn (`#inv-contactmenu`, `#inv-unblock`, `#inv-addcontact`); NG-47, NG-48 and NG-51. |
| Board tab and Message the board | FR-021, 076 | |
| Documents and Share | FR-028, 037 | Share dialog with Unshare drawn (`#inv-share`); the copy-link dialog is drawn (`#inv-copylink`). |
| Portal: email, landing, home, empty, dead link, link sent, `/portal` form | FR-029 to 037 | |
| Portal security | FR-036 | NG-16, NG-27 and NG-32 closed; NG-49: a fixed 30-day session. |
| Fundraising header: Mercury line states | FR-054, 059, 060 | |
| Round: Start, Edit, Close, closed line | FR-050, 057, 062, 064 | `#fund-editround` and `#fund-closed` (with pipeline and SAFEs) drawn. |
| Pipeline: Move to, Passed, Add prospect, Edit prospect | FR-050, 051, 066 | |
| Send SAFE: native dialog, different terms, cover summary | FR-052 | |
| Send SAFE: waiting for Mercury, Assign to contact, Unassign, Not from pipeline | FR-055, 061, 065 | |
| SAFE row menu and statuses (Draft to Funded, Expired, Canceled) | FR-053, 063 | Cancel SAFE in the menu; `#fund-mark` drawn. |
| Attention strip and awaiting deposit | FR-053, 056, 058 | |
| Mercury SAFE sync, deposit match | FR-054, 056 | |
| Investors agent questions through `fundraising_read` | FR-069, 078 | |
| Notifications and the sidebar dot | FR-014, 038, 073 | |
| Hidden pages, command palette | FR-001, 071, 072 | |
| First run, existing Carta user | FR-067, 068 | |
| Two members in one space | FR-079 | |
| End-to-end round | FR-070 | |

## Story dependency graph

Arrows read "must exist before". Stories not listed are standalone starts.

```
FR-001 rename (slice 1)
|- FR-068 existing Carta user, FR-071 hide Fundraising, FR-072 palette, FR-080 narrow web
|- FR-002 empty page, choose source
|  |- FR-003 sheet read fails -> FR-009 one writer per source
|  |- FR-004 type it in -> FR-005 switch source -> FR-010 undo
|  |                    -> FR-008 phone, FR-012 two tabs, FR-013 failed autosave
|  |- FR-007 hide amounts, FR-011 equity raised vs SAFEs
|- FR-067 first run -> FR-069 same agent on both pages -> FR-078 round questions
|                    -> FR-050 start a round
|                       |- FR-051 stages -> FR-052 native SAFE -> FR-053 marks
|                       |                -> FR-061 Mercury hand-off abandoned (Not sent)
|                       |                -> FR-055 Mercury SAFE attaches -> FR-065 assign to contact
|                       |- FR-054 Mercury SAFEs -> FR-056 deposit -> FR-058 prospect becomes investor
|                       |                       -> FR-059 not connected, FR-060 expired
|                       |- FR-057 close round -> FR-062 next round, FR-063 expired and canceled, FR-064 edit round
|- FR-070 end-to-end round (needs FR-050..058, 014, 029, 038)
FR-014 monthly update -> FR-015 draft with agent, FR-016 recipients -> FR-021 board
|- FR-017 no Gmail, FR-018 two Gmail, FR-019 reminder, FR-020 history, FR-022 phone
|- FR-023 send failure, FR-024 duplicate/delete, FR-025 revoked recipient, FR-026 empty routine
FR-027 resend link (needs a share: FR-028 or FR-029)
|- FR-030 investor reads -> FR-031 link expired -> FR-032 dead link variants
|                        -> FR-033 two companies and forwarding, FR-037 nothing shared
|- FR-034 revoke, FR-035 no email provider, FR-036 security walk
FR-038 audit happy path (needs agent, cap table)
|- FR-039 DocuSign, FR-040 portal request, FR-041 dismiss, FR-042 outside Gmail, FR-043 off-season
|- FR-044 reminder -> FR-045 SAFE holder and as-of mismatch (needs FR-052 or FR-054)
|- FR-046 matcher missed, FR-047 auto-close, FR-048 show done, FR-049 sender flag
FR-075 contacts -> FR-076 two kinds, FR-077 Carta contacts
FR-073 badge (needs FR-014, FR-038, FR-056)
FR-074 which agent (needs FR-054, FR-056, FR-068)
```

## Redundancy candidates

Re-checked against the revised plan. Round 1 listed 20; 14 are resolved by the revision and dropped (R1 one Refresh in the source menu, R2 no SAFE security in the editor, R4 audience fixed by entry point, R6 Resend link only in the menu, R8 the draft is an Action item only until opened, R9 Attention is the one place, R10 stated rule, R12 glossary, R15 one definition per total, R16 one intake with sha256 dedupe, R17 no Add form by decision, R18 one dialog with kind, R19 automatic close, R20 channels decided). Eight remain or are new. "Keep" is a suggestion, not a decision.

| # | Redundancy | Stories | Suggested direction |
|---|---|---|---|
| R3 | Draft with agent in the editor, agent chat, and `@investor-update` all run one skill and write one row (the Gmail-draft path is gone) | FR-014, 015, 022 | Keep; state that all three edit the same row. |
| R5 | The Reminder menu, the routine editor on the agent, and asking the agent all change one routine | FR-019 | Keep the menu as the only documented way. |
| R7 | Links are issued four ways: update Send, document Share, Resend link, and the investor's request form; the update comes from the founder's Gmail, the other three from the instance provider with the subject "<Company>: your link" (decided in round 2) | FR-027, 028, 029, 031 | Keep; one template for the three provider emails. |
| R11 | Share lives on the Investors Documents card and on Data room documents | FR-028 | One menu item in the shared `FolderDocuments` component. |
| R13 | The Investors agent now owns the deposit answer from `fundraising_read`, but the Finance agent still answers from transactions and can disagree | FR-056, 074 | Have the Investors agent cite the match state it used. |
| R14 | A holder in the snapshot and the same person's SAFE row both show (by design, no double count) | FR-006, 058 | Keep; the group heading explains it. |
| R21 | (obsolete after the 2026-10-21 decision: "Assign to contact" appears once, in the unmatched Mercury row's sub-line) | FR-061, 065 | None. |
| R22 | Show done moved to the Action items header in round 2 (`#inv-auditdone`); Reminder stays in the Updates menu | FR-019, 048 | Resolved; keep Reminder in the menu. |

## Plan gaps (round 10)

Confirmation round on the small round-9 fix. Evidence is the plan (`docs/fundraising/README.md`, Send SAFE paragraph lines 100-131, "SAFEs" row menu) and the mockup views `fund-mercmenu`, `fund-unmenu`, `fund-waitmenu`. The walk is on paper.

### Round-9 items re-checked

All confirmed in the plan: Change contact is gone (no match in README, mockup or topic files); Unassign then Assign to contact fixes a wrong match; converted rows keep Assign to contact, Unassign and Not from pipeline; Delete on a converted row warns "Comes back if Mercury is reconnected" and Mercury's status wins for rows still in Mercury; a Not from pipeline SAFE shows Assign to contact again when a new prospect matches its email. Counts stay one per record in each case. Two stale story lines fixed this round: the Harbor story in `topics/first-run-and-cross-page.md` still said "Change contact", and the Mercury-removed edge case in `topics/fundraising-safes.md` said "only the native actions" while citing the opposite.

### New gaps (round 10)

None. The mockup draws no view of the Delete warning or of a converted row's menu; the plan text states both, so this is not raised (same class as the carried mockup-coverage nice items).

### Severity counts

| | Carried | New in round 10 | Open total |
|---|---|---|---|
| blocker | 0 | 0 | 0 |
| must-fix | 0 | 0 | 0 |
| should-fix | 0 | 0 | 0 |
| nice | 16 (PG-03, 04, 08, 10, 18, 25, 29, 31, 49, 83; NG-12, 13, 24, 39, 49, 50) | 0 | 16 |
| **Total** | **16** | **0** | **16** |

NG-73 to NG-76 are closed. The stop rule is met for this role.

## Plan gaps (round 9, history)

Evidence is the plan (`docs/fundraising/README.md`: Glossary "SAFE counting rule", Send SAFE, "Mercury SAFEs", Investors Contacts "Delete", data model) and the mockup views `fund-unmenu`, `fund-mercmenu`, `fund-waitmenu`, `safe-email`, `safe-assign`. The walk is on paper.

### Round-8 items re-checked

NG-69 to NG-72 are fixed as claimed in the plan text and the mockup views: Change contact and Unassign (`fund-mercmenu`), Not from pipeline and reversal (`fund-unmenu`), `mercurySentAt` cleared on attach, Send SAFE allowed when every SAFE is Canceled, `externalId` kept on Mercury removal, the Waiting menu (`fund-waitmenu`) and the email prompt (`safe-email`). Stale stories fixed in this round: STORY-516 (rewritten, steps 4 and 5 were under Variations), STORY-506 and the `first-run-and-cross-page.md` Harbor story (still said "Assign to prospect" or that `externalId` is cleared), the catalog titles. The README data-model line "or Assign to prospect" is stale (NG-76).

### Sequences walked

| Sequence | Single count? |
|---|---|
| Unassign a SAFE whose contact was since deleted | Yes. Deleting a contact leaves the SAFE with no contact link, so the row is already unassigned: it counts once by status, offers Assign to contact, and Unassign is not offered. No prospect check size exists to double it. |
| Assign to contact for someone who already has a SAFE (after Unassign) | Yes. Each SAFE row counts once by its own status; the old contact is restored as for Unassign (back in Pipeline only when it has no non-canceled SAFE, which the Pipeline rule derives). A Passed target stays Passed; the plan does not say whether it flips to investor on Signed, left as is. |
| Not from pipeline, then the investor is added as a prospect | Counted once per record, but not paired: the SAFE keeps counting by status and the new prospect's check size counts too. An existing row never re-attaches ("an existing row keeps its contact"), so only Assign to contact pairs them, and nothing prompts it (NG-75, nice). |
| Reconnect Mercury after the founder edited a converted row | Counts once in every case (the upsert is by `externalId`): dates and the contact link stay; a Deleted row returns as a new unassigned row; a Canceled row stays Canceled (the plan never clears a founder-set field). The Delete and Cancel outcomes are not stated (NG-74, nice). |
| Unassign a correct email match | Yes. The SAFE has no contact and counts by status; the prospect (normal row, `mercurySentAt` stays cleared) counts at its check size. Two counts, as the founder chose. |
| Unassign then Assign to contact away from a Waiting prospect's real SAFE | Yes. The target's `mercurySentAt` clears, the old contact returns as a normal row, not Waiting. |

### New gaps (round 9)

| Id | Gap | Evidence | Stories | Severity |
|----|-----|----------|---------|----------|
| NG-73 | Assign to contact, Change contact, Unassign and Not from pipeline are listed "only on a Mercury row", and removing Mercury turns the rows native, so a founder who leaves Mercury cannot fix a wrong or missing attachment (a permanent double count with a prospect's check size) except by Deleting the SAFE. | README "SAFEs" item 4 row menu; "Mercury SAFEs" removal | STORY-516 | nice |
| NG-74 | Edits to a converted ("from Mercury") row are not defined against reconnect. A Deleted row comes back as a new unassigned row with its contact and manual dates lost (the Delete confirm does not say so); a Canceled row stays Canceled while Mercury reports it Sent or Funded, with no marker that Rakazo disagrees. | README "Mercury SAFEs" (upsert by `externalId`, "never clears one the founder set") | STORY-516, STORY-506 | nice |
| NG-75 | A Not from pipeline row never pairs with a prospect added later with the same email (only a new row attaches by email), and neither row says so. Counts stay single per record; the pairing needs a manual Assign to contact. | README Glossary attach rule; "A changed prospect email affects only SAFEs that sync afterwards" | STORY-516 | nice |
| NG-76 | Data-model text for `Safe.contactId` still reads "or Assign to prospect" and the mockup has no view of a row already marked Not from pipeline (its reversal menu). | README `Safe` entry; `fund-unmenu` | none | nice |

### Severity counts

| | Carried | New in round 9 | Open total |
|---|---|---|---|
| blocker | 0 | 0 | 0 |
| must-fix | 0 | 0 | 0 |
| should-fix | 0 | 0 | 0 |
| nice | 16 (PG-03, 04, 08, 10, 18, 25, 29, 31, 49, 83; NG-12, 13, 24, 39, 49, 50) | 4 (NG-73 to NG-76) | 20 |
| **Total** | **16** | **4** | **20** |

NG-69 to NG-72 are closed. Zero blocker, zero must-fix and zero new should-fix: the stop rule is met for this role. Suggested direction (a proposal): NG-73 offer the four actions on any row with an `externalId`; NG-74 say in the Delete confirm that a Mercury-origin row returns on reconnect, and let a sync overwrite a founder Cancel only when Mercury says otherwise; NG-75 none needed beyond a note in the docs; NG-76 fix the README line and draw the marked row.

## Plan gaps (round 8, history)

Superseded by "Plan gaps (round 9)" above. NG-69 to NG-72 were fixed in the plan in round 8 and are confirmed in round 9.

Evidence is the plan (`docs/fundraising/README.md`: Decisions 8, Glossary "SAFE counting rule", "Send SAFE", "Mercury SAFEs", slice 10) and the mockup views `safe-mercury`, `safe-assign`, `fund-waitmenu`. The walk is on paper.

### Round-7 items re-checked

NG-62 to NG-68 are resolved or obsolete as marked in round 7; confirmed in the plan text. `safe-link` is gone from the mockup views. Stories still describing the hand-off Draft were stale and are fixed: STORY-604 steps 4 and 5 (`topics/first-run-and-cross-page.md`) and the Draft wording in `topics/cap-table-sources.md` (Draft now means native). The "delivery unknown" row and the Send again / Mark delivered prompt match between plan (Updates, editor footer) and mockup (`inv-partly`, `ed-unknown`); no change.

### Sequences walked

| Sequence | Single answer? |
|---|---|
| Send SAFE, then the SAFE is created in Mercury for a different email | Yes. The SAFE counts by status with "Assign to contact"; the prospect keeps Waiting and its check size; both count until assigned (stated double count). |
| Two prospects share an email | Yes. The waiting one wins, then the most recently sent; none sent means no attach and Assign. |
| SAFE canceled after attach | Count yes (zero, prospect returns to Pipeline). What the row then shows and whether Send SAFE works is not defined: NG-70. |
| Assign, then realise it was wrong | No. NG-69. |
| Mercury removed while a prospect waits | Yes. Rows go native, waiting cleared, totals unchanged. Adding Mercury again is not defined: NG-71. Sign-in expired or sync failed: prospect keeps waiting, no deadline. |
| SAFE created in Mercury with no prospect | Counts by status; the row offers Assign forever, even when no prospect exists: NG-72 (nice). |
| Send SAFE twice | Yes. Second press refreshes the date; a second tab opens, and two SAFEs created in Mercury both attach to the one contact and both count. |

### New gaps (round 8)

| Id | Gap | Evidence | Stories | Severity |
|----|-----|----------|---------|----------|
| NG-69 | [wrong numbers, no recovery] Assign cannot be undone or changed. The row menu offers Assign only on a row with no contact; a Mercury row cannot be Deleted or Canceled in Rakazo. Assigning to the wrong prospect removes that prospect from Pipeline and its check size from Pending, leaves the real prospect counting (double count again), and when the SAFE is Signed flips the wrong contact to investor, who then receives investor updates and portal notices. The founder has no action to fix it. | README "SAFEs" row menu ("Assign to prospect (only on a Mercury row with no contact)"; renamed Assign to contact in round 8); Glossary; `safe-assign` | STORY-516 | must-fix |
| NG-70 | [plan silent] Life cycle of `mercurySentAt` and a canceled SAFE. Nothing says `mercurySentAt` is cleared on attach, so after the SAFE is canceled in Mercury the prospect returns to Pipeline and may read "Waiting for Mercury" again, or the normal row. Send SAFE "is refused for a prospect that already has a SAFE" while the Pipeline rule counts only non-canceled SAFEs, so a prospect returned by a cancel may get a refused button. The common correction (cancel a wrong-cap SAFE, create a new one) hits this. | README Send SAFE; "Pipeline" item 3; slice 10 test (cancel after attach) | STORY-506 | should-fix |
| NG-71 | [wrong numbers] Removing the Mercury server sets rows to native and clears `externalId`; adding Mercury again, the sync upserts by (source, externalId), finds none and inserts every SAFE a second time as an unassigned Mercury row, so the round bar and the Investors group count each SAFE twice until the founder deletes the native copies (which loses their contact and manual dates). | README "Mercury SAFEs" ("Removing the Mercury server keeps every SAFE row"); NG-68 fix | STORY-506, STORY-511 | should-fix |
| NG-72 | Unassigned Mercury rows (an existing investor's SAFE, or a SAFE for nobody in Pipeline) show "Assign to prospect" (now Assign to contact) permanently, and the picker lists prospects only. The mockup default view draws Mercury rows (Lakeside Capital) with no Assign link, so plan and mockup differ. | README "SAFEs" item 4; `mock-fundraising.png`, `safe-assign` | STORY-505, STORY-516 | nice |

### Severity counts

| | Carried | New in round 8 | Open total |
|---|---|---|---|
| blocker | 0 | 0 | 0 |
| must-fix | 0 | 1 (NG-69) | 1 |
| should-fix | 0 | 2 (NG-70, NG-71) | 2 |
| nice | 16 (PG-03, 04, 08, 10, 18, 25, 29, 31, 49, 83; NG-12, 13, 24, 39, 49, 50) | 1 (NG-72) | 17 |
| **Total** | **16** | **4** | **20** |

Round 7's NG-65 to NG-68 are closed (obsolete or resolved in the plan) and no longer counted. The stop rule is not met.

Suggested direction (a proposal): NG-69 add Unassign to an assigned Mercury row's menu, or an Undo toast after Assign; NG-70 clear `mercurySentAt` on attach and say a Canceled SAFE does not block Send SAFE; NG-71 on re-adding Mercury, match returning rows to native rows by investor email and amount instead of inserting; NG-72 show Assign only when at least one prospect lacks a SAFE.

## Plan gaps (round 7, history)

Evidence is the plan (`docs/fundraising/README.md`), chiefly the Glossary "SAFE counting rule", "Send SAFE", "Round" item 4 and "Mercury SAFEs". The walk is on paper: each sequence below was run against the rule. Every sequence gives a single count per SAFE row; the gaps are where the totals or the pipeline are still wrong.

### Round-6 items re-checked

NG-59, NG-60 and NG-61 are resolved in the plan text (the rule is written once in the Glossary; Mark delivered is in the Updates row menu and the editor footer; the footer is absent at 0 and "Notifies 1 investor" is singular). They are marked resolved above.

### Resolution (founder decision of 2026-10-21, applied in the plan)

"Mercury is the only record of a Mercury SAFE." The hand-off Draft, awaiting window, candidates, hold-out and manual Link are removed (README Decisions item 8 and the Glossary rule). NG-62, NG-63 and NG-64 are **resolved by the decision**; NG-65 and NG-66 are **obsolete** (no Draft, no linked pair); NG-67 (email normalization: trimmed, case-insensitive; a changed prospect email affects only later syncs) and NG-68 (Mercury removal converts rows to native and clears Waiting for Mercury) are **resolved with one line each** in the plan. The tables below are the round-7 history as found.

### Sequences walked

| Sequence | Result under the rule |
|---|---|
| Hand-off, then investor signs in Mercury, email matches | Links, counts once by Mercury status. Defined. |
| Hand-off, then Cancel SAFE on the Draft before any sync | Draft stops awaiting, prospect returns to the pipeline. Defined; see NG-63 if the SAFE was sent anyway. |
| Hand-off, Draft deleted while a candidate exists | Candidate released and counts; prospect returns to the pipeline. Count per row is single; see NG-63. |
| Hand-off, 14 days pass, no link | Draft becomes an ordinary Draft (still counts), candidates released and count. See NG-63. |
| Two tabs, both press Send SAFE for one prospect | Two awaiting Drafts; the tie links to the oldest; the second waits. See NG-65. |
| Mercury SAFE canceled after linking | Pair counts by the Mercury row, so zero; prospect returns to the pipeline. Defined. |
| Cancel or Delete the Draft half of a linked pair | Not defined. See NG-66. |
| Investor email changed on the contact after the Draft | Draft keeps its own email, no match. See NG-67. |
| Mercury connection removed during the window | Not defined. See NG-68. |

### New gaps (round 7)

| Id | Gap | Evidence | Stories | Severity |
|----|-----|----------|---------|----------|
| NG-62 | [resolved by the 2026-10-21 decision] [wrong numbers] The hold-out depends on timing only: any unlinked Mercury row first synced after an awaiting Draft is a candidate and is held out of the round bar and the Investors group, whatever its investor email. A SAFE the founder sent from Mercury to a different investor during the window (or any Funded/Signed row that first syncs, for example after a long gap) disappears from the totals for up to 14 days and can only be released by linking it to an unrelated Draft or cancelling the Draft. | README Glossary "SAFE counting rule" (candidate definition, "held out of every total"); Round item 4 ("Not counted until linked") | FR-055, 061, 065 | must-fix |
| NG-63 | [resolved by the 2026-10-21 decision] [wrong numbers] When an awaiting Draft stops awaiting without linking (14 days pass, Cancel SAFE, Delete) while a real Mercury SAFE for that investor exists, the released Mercury row counts and so does the other side: after expiry the Draft counts in Pending as an ordinary Draft; after Cancel or Delete the prospect returns to the pipeline at its check size. The same money counts twice. A Mercury row attaches to a contact only through an awaiting Draft, and Link to Mercury SAFE appears only on an awaiting Draft, so after day 14 the founder cannot link; the only fix is Delete. A founder who sends the Mercury SAFE after the 14th day lands here with no abandoned step. | Glossary (awaiting ends at 14 days; "Link ... appears only on an awaiting Draft"); Send SAFE ("returns the row to the pipeline"); slice 10 behavior | FR-055, 061, 065 | must-fix |
| NG-64 | [resolved by the 2026-10-21 decision] [plan silent] "Candidate" uses the date Rakazo first synced the row, not the date Mercury created it. With the 15-minute sync throttle, an older SAFE for the same investor that first syncs after the new Draft is a candidate, so it can link to the new Draft by email (or be held out), the case the rule says never happens ("never to an older Mercury-backed SAFE"). | Glossary ("first synced after that Draft was created"); Data model `firstSyncedAt`; Mercury SAFEs (sync throttle) | FR-061, 065 | should-fix |
| NG-65 | [obsolete after the 2026-10-21 decision] [plan silent] Nothing stops a second hand-off Draft for the same prospect from a stale tab (the button hiding is UI only). The tie rule links the Mercury row to the oldest Draft, so the second Draft stays awaiting for 14 days, counts in Pending, and keeps unrelated rows held out (NG-62). It is visible as a second Draft row, so the founder can Delete it. | Glossary tie rule; Send SAFE; slice 10 tests ("Send SAFE hides after a SAFE exists" is a UI test) | FR-061 | nice |
| NG-66 | [obsolete after the 2026-10-21 decision] [plan silent] Cancel SAFE and Delete on the Draft half of a linked pair: Cancel "sets Canceled" locally and nothing is written to Mercury, while the pair counts "by the Mercury row's status"; it is not stated which wins, whether the pair shows as one row, or whether Delete removes both halves. | README "SAFEs" row menu; Glossary (linked pair); Mercury SAFEs ("never clears one the founder set by hand") | FR-055, 065 | nice |
| NG-67 | [resolved in the plan, round 7 fix] [plan silent] The email match is not defined for case, spaces or plus-addresses, and the Draft's `investorEmail` is its own copy: correcting the contact's email later does not change the Draft, and the SAFE row has no Edit. A mismatch means the row waits out the window (NG-62) or needs the manual link. | Glossary ("email equals"); Data model `investorEmail`; SAFEs row menu | FR-061 | nice |
| NG-68 | [resolved in the plan, round 7 fix] [plan silent] Removing the Mercury server turns rows to native and keeps totals ("totals do not change"), but a held-out candidate is counted by the removal only if it stops being a "Mercury row"; the rule does not say, so the bar can change on removal, and the awaiting Draft then waits for a sync that cannot happen. | Mercury SAFEs ("Removing the Mercury server keeps every SAFE row"); Glossary | FR-065 | nice |

### Severity counts

| | Carried from earlier rounds | New in round 7 | Open total |
|---|---|---|---|
| blocker | 0 | 0 | 0 |
| must-fix | 0 | 2 (NG-62, NG-63) | 2 |
| should-fix | 0 | 1 (NG-64) | 1 |
| nice | 16 (PG-03, 04, 08, 10, 18, 25, 29, 31, 49, 83; NG-12, 13, 24, 39, 49, 50) | 4 (NG-65, 66, 67, 68) | 20 |
| **Total** | **16** | **7** | **23** |

Suggested direction for NG-62 and NG-63 (superseded by the decision; kept as history): hold a candidate out only when its email equals an awaiting Draft's email (or it has none), and let an expired or deleted Draft's matching Mercury row be linkable (Link on any unlinked native Draft) or have the prospect check the contact's email against Mercury rows before returning to the pipeline.

## Plan gaps (round 6, history)

Severity as before. This section replaces the open list of round 5. Evidence is the plan (`docs/fundraising/README.md`, revised six times), the mockup view id and the screenshot under `docs/fundraising/ux-flow/screens/`.

### Round-5 list re-checked (22 were open)

Result: 2 should-fix and 4 nice resolved; 16 carried nice unchanged; 3 new (1 must-fix, 2 nice). All round-5 fixes confirmed in the plan text.

| Id | Status now | Evidence or remainder |
|----|------------|-----------------------|
| NG-53 | resolved | Post to portal notifies investor contacts with an email, not revoked or blocked; footer "Notifies n investors" equals the toast n (README "Update editor", Glossary; `#ed-nogmail` shows "Notifies 4 investors", `#inv-posted` toast "Posted · 4 notified"). |
| NG-54 | resolved as to the count, but see NG-59 | Drafts count at their amount, email auto-merge, unlinked Mercury rows held out while any Draft awaits (README Glossary, Round, Send SAFE, slice 10 tests). |
| NG-55 | resolved in plan | Copy-link dialog lists one link per contact; not drawn (`#inv-copylink` shows one). |
| NG-56 | resolved in plan | Posted row "n not notified" with Retry; not drawn. |
| NG-57 | resolved | Unknown counts as resolved and makes Partly sent; Updates-row Retry asks once for Unknown. New nice NG-60. |
| NG-58 | resolved | "Portal access" defined in the Glossary. |
| Phone checks | confirmed | `.lnk` has `min-height:44px` under 900 px and `#link-sent` is left aligned in `mockup.html`. |
| Carried nice | still open | PG-03, 04, 08, 10, 18, 25, 29, 31, 49, 83; NG-12, 13, 24, 39, 49, 50, unchanged. PG-29 still holds: the TBD prompt is described for Send only. NG-39, PG-20, PG-24 stay skipped. |

### New gaps (round 6)

| Id | Gap | Evidence | Stories | Severity |
|----|-----|----------|---------|----------|
| NG-59 | [resolved in round 7 by the Glossary counting rule; see round-7 gaps NG-62 to NG-64 for what it leaves] [plan silent: "unlinked Mercury row" is undefined] A Mercury row can be linked only to a Draft, so every synced Mercury SAFE is "unlinked". Read literally, one Send SAFE (any awaiting Draft) holds every Mercury row out of "every total": Funded $450k and Signed $50k leave the round bar, and the Investors "SAFEs, if converted at cap" group loses them. The same word decides when "Link to Mercury SAFE" shows (the Draft would offer Link at once, listing Lakeside Capital and the other old rows), and email auto-merge matches any unlinked row, so a second SAFE for an investor who already has a Funded Mercury SAFE can merge into the old row and the new Draft disappears. An abandoned hand-off keeps the Draft awaiting with no expiry, so the hold-out never ends. The mockup contradicts the text (Funded $450k stays; Ravi's Draft shows no link). Slice 10 tests cover only the new row case. | README "Glossary" (Committed), "Data model" (`awaitingMercury`), "Round", "Send SAFE", slice 10; `mock-safe-mercury.png`, `mock-safe-link.png` | FR-055, 061, 065 | must-fix |
| NG-60 | [resolved in round 7: Mark delivered in the Updates row menu and the editor footer] [plan silent: Unknown after the founder checked] Unknown means "check Sent mail". If the mail was delivered, nothing marks the recipient Sent; the update stays Partly sent until a resend, which would duplicate it. | README "Update editor" | FR-023 | nice |
| NG-61 | [resolved in round 7: footer absent at 0, Post to portal posts without the copy-link dialog, "Notifies 1 investor"] [plan silent: nobody to notify] Post to portal with no email provider and no investor contact with an email opens a copy-link dialog with no rows, and the footer reads "Notifies 0 investors". | README "Update editor" | FR-017 | nice |

### Severity counts

| | Carried from earlier rounds | New in round 6 | Open total |
|---|---|---|---|
| blocker | 0 | 0 | 0 |
| must-fix | 0 | 1 (NG-59) | 1 |
| should-fix | 0 | 0 | 0 |
| nice | 16 (PG-03, 04, 08, 10, 18, 25, 29, 31, 49, 83; NG-12, 13, 24, 39, 49, 50) | 2 (NG-60, NG-61) | 18 |
| **Total** | **16** | **3** | **19** |

New must-fix in one line: NG-59, "unlinked Mercury row" is undefined, so the hold-out can hide every synced SAFE and the auto-merge can absorb an older one.


## Plan gaps (round 5, history)

Severity as before. This section replaces the open lists of round 4. Evidence is the plan (`docs/fundraising/README.md`), the mockup view id and the screenshot under `docs/fundraising/ux-flow/screens/`.

### Round-4 list re-checked against the plan after round 4 (27 were open)

Result: 16 resolved, 11 still open (all nice), 2 new should-fix and 4 new nice found. Fixes confirmed in the plan text and, where drawn, in the screenshot.

| Id | Status now | Evidence or remainder |
|----|------------|-----------------------|
| NG-41 | resolved | "Update editor": To hidden without Gmail; with Gmail the line "Unticked investors still see this on the portal." (`mock-ed-unticked.png`). New nice NG-58. |
| NG-42 | resolved | Post to portal sends one portal notice per investor contact with an email, toast "Posted · <n> notified"; copy-link dialog with no provider (`mock-inv-posted.png`). New should-fix NG-53, nice NG-55, NG-56. |
| NG-43 | resolved | Board update without Gmail: one button "Connect Gmail to send", no Post to portal (`mock-ed-boardnog.png`). |
| NG-44 | resolved for equal amounts | "Every SAFE counts exactly once": hand-off Draft counts, unlinked Mercury row of the same amount held out (`mock-safe-mercury.png`, `mock-safe-link.png`, Pending $150k, both rows drawn). The invariant fails for a different amount: new should-fix NG-54. |
| NG-45 | resolved | "Unknown — check Sent mail", Retry asks once "May already be delivered. Send again?" (`mock-ed-unknown.png`). New nice NG-57. |
| NG-46 | resolved | Sending row with disabled menu (`mock-inv-sending.png`); the toast when the editor is closed is not stated (nice, not counted). |
| NG-47 | resolved | Portal cell "Unblocked · send a link". |
| NG-48 | resolved | Resend link for any kind with shared documents. |
| NG-51 | resolved | Add contact opens the existing contact (a prospect opens on Fundraising). |
| NG-52 | resolved (documented) | Duplicate, Send, then Delete the Posted original; accepted as the stated route. |
| PG-23 | resolved | "Reading <sheet name>…" in the page body (`mock-inv-reading.png`). |
| NG-49 | still open | Fixed 30-day session, unchanged in "Portal security". |
| NG-50 | still open | Per-row save edge cases, unchanged in "Typed-in table". |
| PG-03, 04, 08, 10, 18, 25, 29, 31, 49, 83; NG-12, 13, 24, 39 | still open | Nice, unchanged. PG-29 now reads "TBD prompt on Post to portal". NG-39 stays skipped as an open question; PG-20 and PG-24 stay skipped with a reason that holds. |

Round-4 fixes that did not fully hold: NG-44 (different amounts). Phone checks: stacked typed-in rows and 44 px targets are in the plan "Tap targets" paragraph and visible in `mock-inv-native-phone.png` and `mock-ed-unknown-phone.png`; no new gap.

### New gaps (round 5)

| Id | Gap | Evidence | Stories | Severity |
|----|-----|----------|---------|----------|
| NG-53 | **Resolved in the round-5 plan (verify in round 6):** Post to portal notifies every investor contact with an email who is not revoked or blocked; the footer "Notifies n investors" matches the toast. Original gap: [plan silent: revoked contacts and portal notices] The To list never emails a revoked contact, but Post to portal (no To list) notifies "each investor contact with an email", and the glossary says the same. A revoked investor with an email gets a notice with a freshly minted link that the portal refuses, or the founder is told "n notified" with a count that includes someone she revoked. | README "Update editor" (Post to portal), "Glossary" (Posted), "Portal security" (Revoke); `mock-inv-posted.png` | FR-017, 025 | should-fix |
| NG-54 | **Resolved in the round-5 plan (verify in round 6):** Drafts count at their amount, email auto-merges, unlinked Mercury rows are held out while any Draft awaits. Original gap: [plan contradicts itself: count once] "Every SAFE counts exactly once", but only an unlinked Mercury row with the same amount as an awaiting hand-off Draft is held out. A different amount (Mercury SAFE sent for $75,000 against a $100,000 Draft), or two Drafts of one amount with one Mercury row, counts both rows in Pending, Signed or Funded until the founder links them, the same overstatement NG-44 described. Send SAFE's own text says "both rows show and count once until then". | README "Round", "Send SAFE", "Glossary"; slice 10 test list covers equal amounts only | FR-055, 061, 065 | should-fix |
| NG-55 | [plan silent: copy-link dialog for several contacts] With no email provider, Post to portal "opens the copy-link dialog"; the dialog in `mock-inv-copylink.png` holds one link for one contact. | README "Update editor"; `#inv-copylink` | FR-017 | nice |
| NG-56 | [plan silent: failed portal notice] A notice to one contact can fail. "Deliveries hold only the portal notices", but the row stays Posted with no Partly state and no Retry; only the toast count differs. | README "Data model" (InvestorUpdate), "Update editor" | FR-017 | nice |
| NG-57 | [plan silent: Unknown and the status] Whether an Unknown recipient counts as resolved for the Partly sent chip and "n of m sent", and whether the Retry on the Updates row asks the same once-only question. In `mock-ed-unknown.png` the chip reads Partly sent and the footer shows the question. | README "Update editor", "Updates" | FR-023 | nice |
| NG-58 | [plan silent: "has portal access"] The unticked-investors line appears when an unticked investor contact "has portal access"; a contact with an email who was never sent a link may or may not count, although the portal shows them every update once a link goes out. | README "Update editor"; `mock-ed-unticked.png` | FR-016, 025 | nice |

### Severity counts

| | Carried from earlier rounds | New in round 5 | Open total |
|---|---|---|---|
| blocker | 0 | 0 | 0 |
| must-fix | 0 | 0 | 0 |
| should-fix | 0 | 2 (NG-53, NG-54) | 2 |
| nice | 16 (PG-03, 04, 08, 10, 18, 25, 29, 31, 49, 83; NG-12, 13, 24, 39, 49, 50) | 4 (NG-55 to NG-58) | 20 |
| **Total** | **16** | **6** | **22** |

New should-fix in one line each:

- NG-53: Post to portal notifies every investor contact with an email, including a revoked one, and no To list shows who.
- NG-54: resolved in the plan (Drafts count, unlinked Mercury rows held out while any Draft awaits, email auto-merge); verify in round 6.


## Plan gaps (round 4, history)

Severity as before: blocker = security or data loss; must-fix = the founder or investor gets stuck or sees wrong numbers; should-fix = real friction or inconsistency on a core journey; nice = polish. This section replaces the open lists of round 3. Evidence is the plan section in `docs/fundraising/README.md`, the mockup view id and the screenshot under `docs/fundraising/ux-flow/screens/`. `[plan silent: ...]` marks what the stories could not answer.

### Round-3 list re-checked against the plan after round 3 (32 were open)

Result: 14 resolved, 2 skipped with a reason that holds (PG-20, PG-24), 1 accepted (NG-40), 15 nice still open (14 unchanged, plus PG-23's remainder, which round 3 called fixed). No should-fix remains from earlier rounds.

| Id | Status now | Evidence or remainder |
|----|------------|-----------------------|
| NG-28 | resolved | "Updates" item 3 and "Update editor" now agree: a sent, partly sent or posted update is read-only; Duplicate and Delete in the row menu (`#inv-updmenu`); glossary status words include Posted. New nice NG-52 (emailing a Posted update). |
| NG-29 | resolved | "Update editor": background job, per-recipient key, resume rules, Failed for an attempt with no result. New nice NG-45 (what Failed means then) and NG-46 (Sending row). |
| NG-30 | resolved | Decision 2 and "Tenancy": board updates never on the portal; no per-update share. New should-fix NG-43 (board without Gmail) and NG-41 (To list). |
| NG-31 | resolved | "Contacts" and "Issuing": Resend link for any investor contact with an email; a later contact sees earlier updates. New nice NG-48 (board and auditor contacts). |
| NG-32 | resolved | `PortalSession` in "Data model" and "Portal security"; Revoke, block and email change delete tokens and sessions; Unblock restores nothing. New nice NG-47 and NG-49. |
| NG-33 | resolved | "Send SAFE" and "Mercury SAFEs": merge only with an email and equal amount; `#safe-link` drawn. New should-fix NG-44 (round bar while unlinked). |
| NG-34 | resolved | "Cap table sources": a failed read keeps the previous label in the warning color; the menu starts with "Last read failed · Try again". |
| NG-35 | resolved | Per-row saves with `rev`; "Changed elsewhere" (`#inv-changed`, `mock-inv-changed.png`); Retry re-sends only unsaved rows. New nice NG-50. |
| NG-36 | resolved | "Documents": "Email them a link" is ticked for every newly ticked contact. |
| NG-37 | resolved | Typed-in securities keep names copied from the source table. |
| NG-38 | resolved | Leaving with "Not saved" asks the browser's leave confirmation. |
| NG-39 | skipped, reason holds | Open question: telling a thank-you from a new request needs a product decision. Carried as nice. |
| NG-40 | accepted | "Rate limits": the "on its way" answer is true after a send. |
| PG-20 | skipped, reason holds | Open question: sharing one company record across members changes the ownership of every table. No longer counted as open. |
| PG-24 | skipped, reason holds | Open question: a "partly read" cue is copy for a rare case; `drive_read` caps at 100k characters, far above a cap table. No longer counted as open. |
| PG-37 | resolved | Data model and slice 9: the kind flips only for a prospect; board, auditor and other keep their kind. |
| PG-15 | resolved | "Typed-in table": blank row ignored, negative or non-numeric outlined, duplicate names allowed. |
| PG-30 | resolved | "Update editor": with no recipient ticked the button is disabled. |
| PG-23 | still open (nice) | Round 3 says the first read shows "Reading sheet…"; that covers the source line only. What the page body shows with no snapshot during that read is still not stated (the Empty view's three buttons may stay clickable). |
| PG-03, 04, 08, 10, 18, 25, 29, 31, 49, 83; NG-12, 13, 24 | still open | Nice, skipped in round 2 and unchanged. PG-29 now reads "TBD prompt on Post to portal". |

Round-3 fixes that did not fully hold: only PG-23's remainder. Fixes that hold but expose a new gap: NG-28 (NG-52), NG-29 (NG-45, NG-46), NG-30 (NG-41, NG-43), NG-31 (NG-48), NG-32 (NG-47, NG-49), NG-33 (NG-44), NG-35 (NG-50).

### New gaps (round 4)

| Id | Gap | Evidence | Stories | Severity |
|----|-----|----------|---------|----------|
| NG-41 | [plan silent: To list versus the portal] "To" has a checkbox per contact, but the portal lists every sent or posted investors update to every investor contact with portal access. Unticking Priya withholds the email only; she still reads the update on her next portal visit. Nothing in the editor says so. | README "Update editor" (To), "Tenancy"; `mock-ed-nogmail.png` shows the same ticked list | FR-016, 025 | should-fix |
| NG-42 | [plan silent: Post to portal] Post to portal mints no link and sends no notice ("Issuing" lists only Send, document share and Resend). A contact who never received a link, or whose link expired, cannot see a Posted update until the founder uses Resend link on each row; contacts who hold a link are not told that anything new exists. The To list is shown ticked although it has no effect here. For a founder without Gmail this is the whole monthly update path. | README "Update editor" (Post to portal), "Issuing"; `mock-ed-nogmail.png` | FR-017 | should-fix |
| NG-43 | [plan silent: board audience without Gmail] The no-Gmail button is "Post to portal", but board updates never appear on the portal. A founder can end a board update as Posted that nobody sees, and the row then reads as delivered. | README "Update editor" (audience board; Post to portal) | FR-021 | should-fix |
| NG-44 | [plan silent: round bar while rows are unlinked] "Both rows show until the founder links them by hand" and Pending counts Draft and Sent SAFEs at their amount, so an unlinked Draft plus its Mercury Sent row count twice (a $50,000 SAFE reads $100,000 Pending). The default case is common because Add prospect leaves the email optional. The mockup draws only the Draft and keeps the unmerged Mercury rows in the picker (`mock-safe-link.png`), so the duplicate state is never shown. Not must-fix because the Link control sits on the row and one action corrects it. | README "Round" (Pending), "Send SAFE", "Mercury SAFEs"; `#safe-link` | FR-055, 061, 065 | should-fix |
| NG-45 | [plan silent: Failed after a restart] An attempt with no recorded result is marked Failed. The row reads Failed with Retry like a real failure, but the message may have gone out; Retry then sends a second copy. | README "Update editor" (resume rules) | FR-023 | nice |
| NG-46 | [plan silent: Sending off the editor] The founder can leave while the job runs. Whether the Updates row refreshes, whether "Sent to <n>" still shows, and which menu items a Sending row has (Delete during a send) are not stated. | README "Updates" (item 3), "Update editor" | FR-023, 024 | nice |
| NG-47 | [plan silent: Portal cell after Unblock] An email change sets the cell to "—", but Unblock does not say; a leftover "Invited <date>" suggests a live link while every old link and cookie is dead. | README "Contacts", "Revoke and expiry"; `#inv-unblock` | FR-034 | nice |
| NG-48 | [plan silent: Resend for other kinds] The Share dialog lists contacts of any kind and emails them a link, but Resend link is offered only for investor contacts, so a board or auditor contact whose document link expired has no Resend. | README "Contacts" versus "Documents" | FR-027, 028 | nice |
| NG-49 | [plan silent: fixed session] A session lasts 30 days from creation and does not slide. A regular reader with a bookmark gets "This link no longer works." on day 31 although his emailed link is valid for 90 days. | README "Portal security" (Landing page) | FR-031 | nice |
| NG-50 | [plan silent: per-row edge cases] Per-row saves leave open: a new row with a name and no shares (does blur on one cell save a partial row), a row deleted in another tab while this tab edits it (the refusal would reload a row that no longer exists), when "Changed elsewhere" clears, and whether percentages and Fully diluted recompute from the newest table or from this tab's stale rows ("nothing else moves"). | README "Typed-in table"; `#inv-changed` | FR-004, 012 | nice |
| NG-51 | [plan silent: duplicate email in Add contact] Only Add prospect is described as opening the existing contact on a duplicate email. Add contact, and an email that belongs to a prospect (who has no tab on Investors), are not described. | README "Contacts", "Pipeline"; `#inv-addcontact` | FR-075 | nice |
| NG-52 | [plan silent: emailing a Posted update] After Connect Gmail the Posted update is read-only; the only way to email it is Duplicate then Send, which lists the update twice on the portal until the founder deletes the original. | README "Update editor", "Updates" | FR-017, 024 | nice |

### Severity counts

| | Carried from earlier rounds | New in round 4 | Open total |
|---|---|---|---|
| blocker | 0 | 0 | 0 |
| must-fix | 0 | 0 | 0 |
| should-fix | 0 (PG-20 and PG-24 skipped with a reason that holds) | 4 (NG-41 to NG-44) | 4 |
| nice | 15 (PG-03, 04, 08, 10, 18, 23 remainder, 25, 29, 31, 49, 83; NG-12, 13, 24, 39) | 8 (NG-45 to NG-52) | 23 |
| **Total** | **15** | **12** | **27** |

New should-fix in one line each:

- NG-41: unticking a recipient withholds the email only; the contact still reads the update on the portal, and the editor does not say so.
- NG-42: Post to portal mints no link and sends no notice, so the no-Gmail update reaches only contacts who already hold a live link.
- NG-43: a board update without Gmail offers "Post to portal", which can never show it to the board.
- NG-44: an unlinked Mercury Draft and its Mercury row both count in the Pending segment, so the round bar overstates until the founder links them.


## Plan gaps (round 3, history)

Superseded by "Plan gaps (round 5)" above; the ids below that round 3 fixed are marked resolved in the round 4 table. Severity as before: blocker = security or data loss; must-fix = the founder or investor gets stuck or sees wrong numbers; should-fix = real friction or inconsistency on a core journey; nice = polish. This section replaces the open lists of round 2. Evidence is the plan section in `docs/fundraising/README.md` and the mockup view id. `[plan silent: ...]` marks what the stories could not answer.

### Open gaps from rounds 1 and 2, re-checked against the plan after round 2 (59 were open)

Result: 42 resolved or accepted, 17 still open (3 should-fix, 14 nice). Two resolved items leave a small nice remainder (PG-15, PG-23), so 19 gaps carry into the counts below. "Accepted" means the round-2 skip reason holds.

| Id | Status now | Evidence or remainder |
|---|---|---|
| PG-23 | resolved | `#inv-nosnap`: "Last read failed · Sheet" with Try again and Type it in. Remainder (nice): what shows below the line during the very first read. |
| PG-46 | resolved | `#inv-share` shows Share with Unshare and the link tick box. |
| PG-66 | resolved | Add prospect works with no round; a duplicate email opens that contact (plan "Pipeline"). |
| PG-70 | resolved | `#fund-closed` keeps Pipeline and SAFEs; Reopen is in the card menu. |
| PG-15 | resolved | Delete holder; non-numeric value outlined. Remainder (nice): blank, negative and duplicate-name rows. |
| PG-19 | resolved | "Switching to Typed in starts from a copy of the table shown." New nice gap NG-37. |
| PG-20 | still open | Plan open question, kept per space and user (should-fix). |
| PG-21 | resolved | Labeled phone inputs (plan "Cap table", `mock-inv-native-phone.png`). |
| PG-24 | still open | Truncation and partial parse are reported only in the agent chat (should-fix). |
| PG-26 | accepted | As-of is the shown date; Refresh is the action. |
| PG-28 | resolved | Failed draft leaves the body empty and a toast reports it. |
| PG-32 | resolved, replaced | A shared or sent update can be edited, but another section says sent is read-only: new NG-28. |
| PG-37 | still open (remainder) | One kind per contact, several drafts, Board tab button only when a board contact exists: resolved. Remainder: a Signed SAFE flips a board or auditor contact to investor (data model: "kind flips to investor"). should-fix. |
| PG-42 | resolved, replaced | Board contacts get a link only when the update is shared to the portal, but no control shares a board update: new NG-30. |
| PG-44 | resolved | `/portal` names no company; no form without a provider. |
| PG-45 | accepted | Portal column and Documents "Shared with" column. |
| PG-47 | resolved, replaced | No confirm (Unblock reverses); email change clears tokens; the cookie is not cleared: new NG-32. |
| PG-51 | resolved | The copy-link dialog is described (not drawn). |
| PG-58 | resolved | Open opens the mail thread when nothing was filed. |
| PG-59 | resolved | `mail_draft` is text only; no thread gives a new message; no Gmail leaves the row New. |
| PG-54 | resolved | `#inv-auditdone`: Show done in the block header lists done and dismissed rows. |
| PG-03, 04, 08, 10, 18, 25, 29, 30, 31, 49, 83 | still open | Nice, skipped in round 2 and unchanged in the plan. |
| NG-01 | resolved | Plan "Pipeline": the row returns when no non-canceled SAFE remains. |
| NG-02, 03 | resolved | Bar scales to the larger of target and total; Equity raised is the Invested sum. |
| NG-04 | resolved, successor | `source` changes only after the first successful read. The wording of the line when that first read fails is new NG-34. |
| NG-05, 06 | resolved | `#inv-notsaved`: "Not saved" with Retry. What Retry sends is new NG-35. |
| NG-07 | resolved | Status values Draft, Sending, Sent, Partly sent; `#inv-partly`. A stuck Sending is new NG-29. |
| NG-08 | resolved | Revoked contacts are greyed, unticked, not emailed. |
| NG-09 | resolved | Carta states use the same line. |
| NG-10, 11 | resolved | Intake needs an attachment, an Auditor sender or DocuSign, at most 10 runs a day; any sent reply closes, a newer received message reopens. |
| NG-14, 15 | resolved | Edit and Delete in the contact menu (`#inv-contactmenu`); link emails come from the instance provider, subject "<Company>: your link". |
| NG-16, 27 | resolved | Token in the URL fragment, a new token per send, hashes in `InvestorPortalToken`. |
| NG-17 | resolved | Documented; the dead-link form sends a new link. |
| NG-18, 19, 21 | resolved | Edit round affects new SAFEs only; Cancel SAFE in `#fund-safemenu`; a manual date wins. |
| NG-20, 22, 23 | resolved | No draft without an emailable investor; late reads discarded; an opened draft stays in Updates. |
| NG-25, 26 | resolved | Holders link by contact name and Add as contact asks for an email; `contacts_add` never changes the kind. |
| NG-12, 13, 24 | still open | Nice, skipped in round 2. |

### New gaps (round 3)

| Id | Gap | Evidence | Stories | Severity |
|---|---|---|---|---|
| NG-28 | [plan silent: which is true] The Updates section says a sent update is read-only; the Update editor section says a shared or sent update can be edited and Send emails it; Send is also idempotent. A Share without Gmail ends as Sent, so the Updates row reads Sent although nobody was emailed, and the "Connect Gmail then Send" path has no defined result. | README "Updates" (item 3) versus "Update editor"; glossary "Update status" | FR-017, 020, 024 | should-fix |
| NG-29 | [plan silent: an interrupted send] The status flips to Sending before any message goes out and the button is disabled; if the API restarts mid-send, no recipient is marked Failed, the row stays Sending and a second click does nothing. | README "Update editor" (Send is idempotent) | FR-014, 023 | should-fix |
| NG-30 | [plan silent: board and the portal] The editor says Send creates the share rows; the Portal section says board emails are plain text unless the founder shares the update. With Gmail the only button is Send, so no control shares a board update to the portal or keeps it off. | README "Update editor" and "Issuing" | FR-021 | should-fix |
| NG-31 | [plan silent: a contact added after the last update] Resend link exists only for contacts with a share, shares are made by sending or sharing an update or document, and a sent update is read-only. A new investor can see nothing and cannot be sent a link until the next update. | README "Contacts" (Resend only with a share), "Issuing" | FR-027, 034 | should-fix |
| NG-32 | [plan silent: sessions versus tokens] The cookie holds a signed contact id and expiry, not a token. Changing an email deletes tokens "because a different person may own the address", but the previous holder's cookie stays valid for up to 30 days; after Revoke then Unblock, a cookie issued before the Revoke works again. | README "Portal security" (Landing page; Revoke and expiry) | FR-034, 036 | should-fix |
| NG-33 | [plan silent: the merge key] The Mercury hand-off creates a Draft with the investor and check size and later merges by investor email and amount, but Add prospect makes the email optional and the check size may be "—". No step asks for either before Send SAFE. | README "Send SAFE", "Mercury SAFEs", "Pipeline" | FR-055, 061, 065 | should-fix |
| NG-34 | [plan silent: line wording after a failed switch] "The line always names the data shown" conflicts with the failure line "Last read failed · Sheet as of <date>": after a failed switch from Typed in, source is still Typed in, so the line shows either a mislabel or no failure. | README "Cap table sources"; `#inv-failed` | FR-003, 005 | should-fix |
| NG-35 | [plan silent: Retry semantics] After a refused stale save, "Retry saves them against the newest version". It is not said whether that merges only the pending row edits or sends the whole table, which would silently revert the other tab's change. | README "Typed-in table" | FR-012 | should-fix |
| NG-36 | [plan silent: a new document for a contact who already has a link] The Share dialog's link option is for "people who do not have one", so nobody tells a contact with a live link that a new document exists. | README "Documents"; `#inv-share` | FR-028 | nice |
| NG-37 | [plan silent: security names] Typed-in securities are Common, Preferred, Option, Other; a copy of a Carta or sheet table can hold other share classes. | README "Typed-in table" | FR-005 | nice |
| NG-38 | [plan silent: leaving with "Not saved"] Typed rows stay in the form, but leaving the page loses them with no warning. | `#inv-notsaved` | FR-013 | nice |
| NG-39 | [plan silent: courtesy mail] A done audit row reopens as New on any later received message in its thread, including a thank-you. | README "Action items" and "Audits" step 4 | FR-049 | nice |
| NG-40 | [plan silent: link rate limit window] The form sends at most one link per contact per 10 minutes, counted from `portalLinkSentAt`, which every send also sets; a request right after an update gets the "on its way" message and no email. | README "Rate limits", "Token" | FR-029, 031 | nice |

### Severity counts

| | Carried from rounds 1 and 2 | New in round 3 | Open total |
|---|---|---|---|
| blocker | 0 | 0 | 0 |
| must-fix | 0 | 0 | 0 |
| should-fix | 3 (PG-20, PG-24, PG-37 remainder) | 8 (NG-28 to NG-35) | 11 |
| nice | 16 (PG-03, 04, 08, 10, 15 remainder, 18, 23 remainder, 25, 29, 30, 31, 49, 83; NG-12, 13, 24) | 5 (NG-36 to NG-40) | 21 |
| **Total** | **19** | **13** | **32** |

New should-fix in one line each:

- NG-28: the plan says both that a sent update is read-only and that it can be edited and re-sent, and a Share without Gmail is labelled Sent.
- NG-29: a send interrupted by a restart leaves the update at Sending with no recovery.
- NG-30: nothing lets a founder with Gmail share a board update to the portal, and the plan disagrees on whether Send does.
- NG-31: a new investor added after the last update has no way to see earlier updates or be sent a link.
- NG-32: portal cookies stay valid after an email change and revive after Unblock, so the token rules do not cut access.
- NG-33: the Mercury hand-off depends on an email and amount that Add prospect leaves optional.
- NG-34: when the first read of a new source fails, the source line either names the wrong source or hides the failure.
- NG-35: Retry after a stale refusal may overwrite the other tab's change.

## Plan gaps (round 2, history)

Superseded by "Plan gaps (round 3)" above. The tables below show the state after round 2 and are kept for the record.

Severity: blocker = security or data loss; must-fix = the founder gets stuck or sees wrong numbers; should-fix; nice. Status for round-1 items: resolved, changed (partly resolved; the remainder is carried at the stated severity), or still open (no change in the plan). New gaps are marked NG and carry `[plan silent: …]` text.

### Round-1 items re-checked (PG-01 to PG-83)

| Id | Gap (short) | Status | Note or remainder (severity) |
|---|---|---|---|
| PG-01 | Redirect query, `kind`, tail | resolved | Slice 1: query kept, `kind=shareholder\|options` maps to no filter. |
| PG-02 | No notice of the rename | resolved | Decided: nothing extra is shown. |
| PG-03 | Carta agent after skills move | changed | Hand-off line and Bots history decided. Remainder: its full-screen intro and "Back to" target (nice). |
| PG-04 | Hidden pages, old bookmark | changed | Hidden key migrated, still reachable by URL and cross-links. Remainder: Fundraising default for users who hid Cap Table; hidden pages in the palette (nice). |
| PG-05 | Documents vs folder name | resolved | Folder name kept on purpose. |
| PG-06 | Palette keywords | resolved | Slice 1 and slice 8 keywords. |
| PG-07 | Agent cannot read round, pipeline | resolved | `fundraising_read`; the agent says it cannot change a stage. |
| PG-08 | Four agents hold the deposit answer | changed | Investors agent owns it through `fundraising_read`. Remainder: Finance answer can differ; `message_bot` hops not shown (nice). |
| PG-09 | Collapsed preference | resolved | One preference for both pages. |
| PG-10 | No-model state, latency, Ask in empty view | changed | Ask in the empty view and needs-model state decided. Remainder: suggestion chips, creation latency (nice). |
| PG-11 | Badge meaning | resolved | Counts unseen Investors agent notifications. |
| PG-12 | Mercury changes never notify | resolved | Decided. |
| PG-13 | Which event notifies | resolved | Two notifications with copy. |
| PG-14 | Empty page copy, Fundraising empty view | resolved | Three equal buttons by decision; `#fund-noround`. |
| PG-15 | Editor details | changed | Autosave, defaults, pool row decided. Remainder: validation messages, deleting a holder row (should-fix). |
| PG-16 | Editor holders and contacts | resolved | Email links or creates a contact. (How the email is typed is NG-25.) |
| PG-17 | Whole-snapshot overwrite | resolved | `updatedAt` check and reload. (What the reload does to the refused edit is NG-06.) |
| PG-18 | Zero-money table | still open | No presentation stated (nice). |
| PG-19 | Source switch overwrites (blocker) | changed | Undo and one version back decided; blocker gone. Remainder: what the typed-in table starts from after another source (should-fix). |
| PG-20 | Which source wins; two members | changed | One writer per source decided. Remainder: two members see different tables (plan open question) (should-fix). |
| PG-21 | Phone layout | changed | Header and row layout decided. Remainder: the typed-in editor on a phone (should-fix). |
| PG-22 | Hide amounts coverage | resolved | Covers editor inputs, action items, draft text. (Prose figures are NG-24.) |
| PG-23 | Failed read not on the page | changed | "Reading sheet…" and "Last read failed" decided. Remainder: states when no snapshot exists yet (must-fix). |
| PG-24 | First-tab rule, truncation, partial parse | still open | Only the first-tab fact is stated, not shown (should-fix). |
| PG-25 | Drive sign-in, picker reopen | changed | "Connect Google Drive" decided; reading wording decided. Remainder: in place or Integrations (nice). |
| PG-26 | "As of" vs last read | still open | Only "as of" is shown (should-fix). |
| PG-27 | Editor save, subject, period | resolved | Autosave, default Subject. |
| PG-28 | Draft with agent edge cases | changed | Shows only while the body is empty; question only in chat. Remainder: failure or no-Finance state (should-fix). |
| PG-29 | TBD guard | changed | Send prompt decided. Remainder: Share path and the portal copy (nice). |
| PG-30 | Recipient selection | changed | Ticked list, greyed "no email", no ad-hoc, audience fixed. Remainder: all unticked (nice). |
| PG-31 | Connect Gmail | changed | Share primary, Connect Gmail secondary. Remainder: destination and return (nice). |
| PG-32 | Share semantics | changed | Share is portal-only, status shared. Remainder: edit after share; Send on a shared update (should-fix). |
| PG-33 | From picker | resolved | Only with more than one Gmail account. |
| PG-34 | Double send, partial state | resolved | Idempotent, deliveries, Retry. (Row status after a failure is NG-07.) |
| PG-35 | Cadence | resolved | Quarterly dates, Off keeps a draft, no catch-up. |
| PG-36 | Sent updates | resolved | Read-only, Duplicate, Delete with confirm. |
| PG-37 | Board draft, one kind, empty tab | changed | Audience fixed by entry point; board never on the portal unless shared. Remainder: one kind per contact, two drafts open, empty Board tab, which past updates a board draft uses (should-fix). |
| PG-38 | Mobile chat | resolved | Degrade stated; sending is web and desktop. |
| PG-39 | Skill reads rows, no Gmail draft | resolved | Decided. |
| PG-40 | Revoke leaves access (blocker) | resolved | `portalBlockedAt` blocks link and form. |
| PG-41 | Scanner burns link (blocker) | resolved | Landing page, POST starts the session. |
| PG-42 | Bcc footer link (blocker) | changed | One message per recipient; blocker gone. Remainder: board emails and portal links (should-fix). |
| PG-43 | Failure screens | resolved | "This link no longer works." with the form. |
| PG-44 | `/portal` always says link is on its way | changed | Exact copy decided. Remainder: `/portal` cannot name a company; the form promise when no email provider exists (should-fix). |
| PG-45 | Founder status model | changed | Portal column states and Resend decided. Remainder: no per-contact view of what a contact can see (should-fix). |
| PG-46 | Share dialog, unshare, sensitive files | changed | Share creates rows; pre-ticked link option. Remainder: dialog layout (not in mockup), Unshare control, sensitive-file confirm (must-fix). |
| PG-47 | Revoke confirm, email change | still open | No confirm or notice stated (should-fix). |
| PG-48 | Forwarded link | resolved | Accepted by decision 5; "Opened" date and Revoke. |
| PG-49 | Same email at several companies | changed | One link per contact in the email; second link replaces the cookie. Remainder: no switcher (nice). |
| PG-50 | Portal mobile | resolved | 44 px controls; marker out of scope. |
| PG-51 | No-provider mode | changed | Link shown once decided. Remainder: dialog layout and copy (should-fix). |
| PG-52 | Link to contact with no share | resolved | Resend only with a share. |
| PG-53 | Add audit request | resolved | Decided: no Add form; ask the agent. |
| PG-54 | Dismiss, undo, show dismissed | changed | Dismiss, Show done, dedupe key kept. Remainder: whether Show done lists dismissed rows; restoring; Show done is off screen when no open rows exist (nice). |
| PG-55 | Dedupe | resolved | Unique (fund, as-of); thread reminders touch `lastMailAt`. |
| PG-56 | Done rows, sent detection, order | resolved | Show done; auto-close; due date then newest. |
| PG-57 | Double filing | resolved | sha256 dedupe. |
| PG-58 | No-attachment rows | changed | Row wording moved to as-of and due text. Remainder: what Open opens for DocuSign and portal requests with nothing filed (should-fix). |
| PG-59 | Draft recipient, attachments, Gmail | still open | `mail_draft` still text only; no-thread and no-Gmail cases unstated (should-fix). |
| PG-60 | As-of mismatch | resolved | "Holdings as of today, not <date>" on the row. |
| PG-61 | SAFE statement wording | resolved | `cap_table_read` returns SAFEs. |
| PG-62 | Off-season intake | resolved | Intake on arrival, no routine. |
| PG-63 | Sender check | resolved | "Sender not in Auditors" flag. |
| PG-64 | Start a round fields | resolved | Name, target, cap, MFN; a SAFE needs no round. |
| PG-65 | "Committed" meanings | resolved | Glossary: Committed is a stage; SAFE money is Signed or Funded. |
| PG-66 | Add prospect | changed | Dialog fields decided. Remainder: Add prospect with no round (the pipeline is not drawn); duplicate or missing email (must-fix). |
| PG-67 | Pipeline editing | resolved | Move to any direction, Edit prospect, typed last contact. |
| PG-68 | Prospect to investor | resolved | Kind flips on Signed; row leaves the pipeline when a SAFE exists. |
| PG-69 | Fundraising empty state | resolved | `#fund-noround`. |
| PG-70 | Close round | changed | Confirm only when a signed SAFE is unpaid; closed line. Remainder: after close the page shows only that line, so prospects and SAFEs are not visible; no reopen (must-fix). |
| PG-71 | Three totals | resolved | One round bar; no sum in the SAFEs header. |
| PG-72 | Native SAFE prefill | resolved | Prefilled from the round; Send SAFE hides after a SAFE exists. |
| PG-73 | Manual marks | resolved | Date and Undo. |
| PG-74 | Bar vs row percents | resolved | Holdings are 100; SAFEs are a separate group. |
| PG-75 | Draft SAFEs, MFN percent | resolved | Drafts in no total; "—" for MFN and discount. |
| PG-76 | SAFE typed as a security | resolved | No SAFE security. |
| PG-77 | Cover summary for merged rows | resolved | Open shows the summary for every row. |
| PG-78 | Mercury removal deletes rows (blocker) | resolved | Rows revert to native. |
| PG-79 | Merge guidance | resolved | Send SAFE hand-off; Link to Mercury SAFE. |
| PG-80 | No Mercury prompts | resolved | Connect, Reconnect, Sync failed states; Refresh forces. |
| PG-81 | Mercury rows read-only | resolved | Mark on Mercury rows when Mercury has not set the field; Find in Finance. |
| PG-82 | Unattached Mercury SAFEs, malformed rows | resolved | Round id on sync; "N SAFEs could not be read". |
| PG-83 | Carta/Mercury duplicate with different emails | still open | Documented assumption: two rows (nice). |

Counts: 51 resolved, 26 changed, 6 still open (PG-18, 24, 26, 47, 59, 83). Of the five round-1 blockers, four are resolved outright (PG-40, 41, 78) or reduced to a should-fix remainder (PG-19, 42); none remains a blocker.

### New gaps (round 2)

Only gaps that are not part of a round-1 item.

| Id | Gap | Stories | Severity |
|---|---|---|---|
| NG-01 | [plan silent: an abandoned Mercury hand-off] The Draft row is created before Mercury is used and the prospect leaves the pipeline; the plan does not say how abandoning is handled or whether Delete returns the prospect. | FR-061, 055 | should-fix |
| NG-02 | [plan silent: round bar limits] Funded + Signed + Committed above Target, a zero target, or Committed prospects with no check size. | FR-050, 051 | nice |
| NG-03 | [plan silent: Equity raised source] "Equal to the sum of the Invested column" but the Carta snapshot has its own `amountRaisedUsd`; which shows when they differ. | FR-011 | should-fix |
| NG-04 | [plan silent: source label before the first read] The line reads "Sheet" or "Carta" while the table shown is still the old source's, for example "Last read failed · Sheet as of <old date>". | FR-003, 005 | should-fix |
| NG-05 | [plan silent: failed autosave] No error or retry state; "Saved" simply does not appear, so typed rows can be lost unnoticed. | FR-013 | must-fix |
| NG-06 | [plan silent: refused stale save] The edit that was refused is dropped on reload with no way to reapply it. | FR-012 | should-fix |
| NG-07 | [plan silent: update status during and after a partial send] The data model lists draft, shared, sent but the text uses a "sending" status; a Failed recipient is not visible after leaving the editor, so the founder may think everyone received it. | FR-023, 014 | must-fix |
| NG-08 | [plan silent: sending to a revoked contact] Whether the contact is skipped, flagged, or emailed a link the portal refuses. | FR-025 | should-fix |
| NG-09 | [plan silent: Carta states in the source line] The line lists Carta, Sheet, Typed in, Reading sheet… and Last read failed only; today's Reading Carta…, Reconnect Carta and needs-model states have no place. | FR-005 | should-fix |
| NG-10 | [plan silent: intake cost] Every message matching "audit", "confirmation", "409A" or "DocuSign" starts a model run; vendor receipts and newsletters match; no cap. | FR-041 | should-fix |
| NG-11 | [plan silent: what counts as a reply] Any sent message in the thread after the row's creation closes it, including a holding reply. | FR-047 | should-fix |
| NG-12 | [plan silent: sender flag lifecycle] "Sender not in Auditors" is stored at intake and stays after the auditor is added. | FR-049 | nice |
| NG-13 | [plan silent: deleted Gmail draft] Open draft on a draft deleted in Gmail. | FR-038 | nice |
| NG-14 | [plan silent: contact Edit and Delete] The new row menu lists Resend link, Revoke, Unblock only; the cascades to sent updates, audit rows and SAFEs on delete are unstated. | FR-075 | should-fix |
| NG-15 | [plan silent: link emails other than updates] Sender, subject and text of Resend, document Share and request-form emails, which come from the instance's email provider, not the founder's Gmail. | FR-027, 017, 028 | should-fix |
| NG-16 | [plan silent: token in the URL path] `/portal/open/:token` is a 90-day reusable credential that lands in proxy logs and browser history; no log redaction is stated. | FR-036 | must-fix |
| NG-17 | [plan silent: 90 days vs quarterly] A quarterly Reminder can outlast the 90-day expiry, so quarterly investors reach the dead-link page by default. | FR-031 | nice |
| NG-18 | [plan silent: Edit round] Whether existing SAFEs follow a changed cap or keep a copy; rows then show differing caps. | FR-064 | should-fix |
| NG-19 | [plan silent: cancel or expire a native SAFE] The menu has no Cancel, the dialog no expiry; Expired and Canceled rows stay in the list. | FR-063 | should-fix |
| NG-20 | [plan silent: routine with nothing to draft from] A new space with no investors, no Finance or no Gmail still gets a monthly draft and notification. | FR-026 | should-fix |
| NG-21 | [plan silent: manual vs Mercury date] Which wins when both set a signed or paid date. | FR-056 | nice |
| NG-22 | [plan silent: Undo during a read] Whether a late read result overwrites the restored table. | FR-005, 010 | should-fix |
| NG-23 | [plan silent: opened but unsent draft] The Action item leaves when the draft is opened; nothing reminds the founder. | FR-014 | nice |
| NG-24 | [plan silent: prose figures] How Hide amounts recognizes dollar figures typed in an update body. | FR-007 | nice |
| NG-25 | [plan silent: holder email in the editor] Holders typed with an email link to contacts, but the editor columns are Holder, Security, Shares, Invested. | FR-004 | should-fix |
| NG-26 | [plan silent: `contacts_add` on an existing email] Whether the Carta agent updates, fails, or changes the kind of a hand-added contact. | FR-077 | should-fix |
| NG-27 | [plan silent: hashed token vs resending] Only the sha256 hash is stored and the token is "not rotated on send", yet every update email, Resend and the copy-link dialog need the plain link. | FR-029, 027, 035 | must-fix |

### Severity counts

| | Round-1 items still open | New | Open total |
|---|---|---|---|
| blocker | 0 | 0 | 0 |
| must-fix | 4 (PG-23, 46, 66, 70) | 4 (NG-05, 07, 16, 27) | 8 |
| should-fix | 16 | 16 | 32 |
| nice | 12 | 7 | 19 |
| **Total** | **32** | **27** | **59** |

Open round-1 should-fix: PG-15, 19, 20, 21, 24, 26, 28, 32, 37, 42, 44, 45, 47, 51, 58, 59. Open round-1 nice: PG-03, 04, 08, 10, 18, 25, 29, 30, 31, 49, 54, 83. New should-fix: NG-01, 03, 04, 06, 08, 09, 10, 11, 14, 15, 18, 19, 20, 22, 25, 26. New nice: NG-02, 12, 13, 17, 21, 23, 24.

New must-fix items in one line each:

- NG-05: a failed autosave in the typed-in table shows nothing, so rows typed offline look saved and are lost.
- NG-07: update status has no "sending" or partial state in the data model, and a Failed recipient is invisible once the founder leaves the editor.
- NG-16: the 90-day reusable portal token sits in the URL path, so proxy logs and browser history hold a working credential.
- NG-27: the portal token is stored only as a hash and "not rotated on send", but every update email and Resend must contain the plain link.

## Not yet written and mockup views that do not exist

Stories still worth writing: an accessibility pass (keyboard order in the editor, the dot's accessible name, status chips that rely on color, the portal on a screen reader); replacing a Data room file that is already shared (only the delete cascade is covered, in FR-028); a Brex-only founder (a variation in FR-054).

Views the stories need but the mockup still does not draw: the Undo control after a Mark, the Mark sent date prompt (only the Mark funded dialog is drawn), the Posted row on Updates, and the state of Fundraising's SAFEs list while a Draft and an unmerged Mercury row both show (NG-44). Round 3 drew the Add contact dialog (`#inv-addcontact`), the Link to Mercury SAFE picker (`#safe-link`), the Updates row menu (`#inv-updmenu`) and the copy-link dialog (`#inv-copylink`). The Fundraising page at phone width is drawn (`mock-fundraising-phone.png`).

## Round 2 resolution

Round-1 items still open and the new gaps NG-01 to NG-27 were resolved in `README.md` (and `mockup.html` where a view was needed). Nice items were skipped unless trivial. Result: 47 fixed, 1 partly fixed, 11 skipped.

| Id | Result | How or why |
|----|--------|-----------|
| PG-15 | fixed | Delete holder in the row menu; a non-numeric value is outlined and not saved. |
| PG-19 | fixed | Typed in starts from a copy of the shown table; Undo restores. |
| PG-20 | skipped | Two members in one space stays an open question (separate decision). |
| PG-21 | fixed | Typed-in editor on a phone has labeled inputs (drawn). |
| PG-23 | fixed | New view `inv-nosnap`: "Last read failed · Sheet" with Try again and Type it in. |
| PG-24 | partly fixed | The agent reports a truncated or partly parsed sheet in chat; the page shows only reading, read or failed. |
| PG-26 | skipped | As-of is the shown date; a separate "last read" time adds a word with no action. |
| PG-28 | fixed | A failed draft leaves the body empty and a toast reports it. |
| PG-32 | fixed | A shared or sent update can be edited; Send emails it. |
| PG-37 | fixed | One kind per contact; several drafts allowed; the Board tab button shows once a board contact exists; board drafts use past board and investor updates. |
| PG-42 | fixed | Board contacts get a link only when the update is shared to the portal. |
| PG-44 | fixed | `/portal` names no company; with no email provider the form is not shown. |
| PG-45 | skipped | The Portal column and the Documents "Shared with" column already show access per contact. |
| PG-46 | fixed | Share dialog with Unshare drawn (`inv-share`); the dialog is the confirm. |
| PG-47 | fixed | Revoke has no confirm (Unblock reverses it); an email change clears tokens. |
| PG-51 | fixed | With no provider the new link is shown once in a dialog (described, not drawn). |
| PG-58 | fixed | Open opens the mail thread when nothing was filed. |
| PG-59 | fixed | `mail_draft` is text only; no thread gives a new message; no Gmail leaves the row New. |
| PG-66 | fixed | Add prospect works with no round; a duplicate email opens that contact. |
| PG-70 | fixed | Closed round keeps pipeline, SAFEs and Attention; Reopen in its menu (`fund-closed`). |
| PG-03, 04, 08, 10, 18, 25, 29, 30, 31, 49, 83 | skipped | Nice items; no plan decision needed now. |
| PG-54 | fixed | Show done lists done and dismissed rows; it is a header button. |
| NG-01 | fixed | The row returns when no non-canceled SAFE remains. |
| NG-02 | fixed | The bar scales to the larger of target and total; zero target shows no Target. |
| NG-03 | fixed | Equity raised is the Invested sum for every source. |
| NG-04 | fixed | `source` changes only after the first successful read, so the line names the data shown. |
| NG-05 | fixed | Inline "Not saved" with Retry (`inv-notsaved`); rows kept. |
| NG-06 | fixed | Same state; Retry saves against the newest version; the reload message is gone. |
| NG-07 | fixed | Status values draft, sending, sent plus derived Partly sent; failures and Retry on the Updates row (`inv-partly`). |
| NG-08 | fixed | Revoked contacts are greyed, unticked and not emailed. |
| NG-09 | fixed | Carta states use the same source line. |
| NG-10 | fixed | Intake needs an attachment, an Auditor sender or DocuSign, at most 10 runs a day. |
| NG-11 | fixed | Any sent reply closes; a newer received message reopens the row as New. |
| NG-12, 13, 24 | skipped | Nice. |
| NG-14 | fixed | Contact menu has Edit and Delete; cascades stated. |
| NG-15 | fixed | Link emails come from the instance provider, subject "<Company>: your link". |
| NG-16, NG-27 | fixed | Token in the URL fragment; a new token per send; hashes in `InvestorPortalToken`; plan, tests and slice 6 updated. |
| NG-17 | fixed | Documented; the dead-link form sends a new link. |
| NG-18 | fixed | Edit round affects new SAFEs only. |
| NG-19 | fixed | Cancel SAFE in the menu; Expired only from Mercury. |
| NG-20 | fixed | No draft and no notification without an investor contact with an email. |
| NG-21 | fixed | Stated: a manual date wins over Mercury's. |
| NG-22 | fixed | A read carries its start version; late results are discarded. |
| NG-23 | fixed | An opened unsent draft stays in Updates as Draft. |
| NG-25 | fixed | Holders link by contact name; Add as contact asks for an email. |
| NG-26 | fixed | `contacts_add` on an existing email fills empty fields and never changes the kind. |

Mockup views now drawn: Reminder menu, Share dialog with Unshare, contact row menus (Resend, Revoke, Unblock), Edit round, Mark funded date dialog, Show done, typed-in source menu, closed round with SAFEs, first sheet read failing, partly sent update, toasts. Still not drawn: Add contact dialog, Link to Mercury SAFE picker, Updates row menu (Duplicate, Delete).

### Round 4 resolution

NG-41 to NG-48, NG-51, NG-52 and PG-23 are fixed in the plan and mockup (see `docs/fundraising/ux-paths/round-4.md`, Round 4 resolution). NG-49 and NG-50 stay open as nice.

### Round 8 resolution

NG-69 to NG-72 are resolved in the plan, mockup (`fund-mercmenu`, `fund-unmenu`, `safe-email`) and STORY-505, 506, 516. Open after round 8: the carried nice items only.


Round 9: Change contact is removed (N9-1); a wrong match is fixed by Unassign then Assign to contact. NG-73 to NG-76 are fixed in the plan text.
