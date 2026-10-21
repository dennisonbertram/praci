# STORY-012: Ask the agent what Devin is stuck on

Verdict: acceptable. The click path is minimal, but for the exact question in the title the agent repeats the table. Ask earns its place only for questions the table cannot answer.

Evidence: `docs/devin/mockup.html` as rendered in `mockup-v2-full.png` (page with docked panel, "Connect Devin" empty state, existing connect dialog); existing-app screenshots `refs/transcript.png`, `refs/custom_conn.png`, `refs/integ_with_connections.png`. Catalog: STORY-012 and GAP-01, 07, 10, 16, 19, 20, 23, 25, 29, 30, 31, 45. No dev server was run; nothing was exercised live because the page is planned.

## Friction Scorecard

| Measure | Result | Basis |
|---|---|---|
| Steps, agent path | 3 (click Ask, type, read) | Catalog Ideal path; mockup shows the Ask button and the composer. Measured from the plan, not from a built page. |
| Steps, table path | 0 clicks after arrival | In the mockup the two Needs you rows carry a subtitle under the title and an amber badge. |
| Steps actual (catalog walk) | 7 | Catalog steps 1 to 7: open page, glance, hesitate, Ask, type, wait, read and click link, close panel. Steps 1, 2 and 7 are not part of asking. |
| Decisions | 3, of which 1 is needless | Table or agent (needless: the table already answers it); what to type (no suggestion, free text); whether to close the panel afterwards. |
| Re-entry | None. The question is typed fresh, but nothing the app already knows is requested. Typing "What is Devin stuck on?" is information the page already implies, see Take-away Pass. |
| Confirmations | 0 in the intended path. One conditional: while the question-text read is a forced write (GAP-01), an approval card appears for a read-only question. |
| Dead ends | 2. (a) Subtitle is one line with ellipsis ("Should the export keep the legacy ..." in the mockup), so the table is not enough to read the question. (b) Agent cannot read the question text when GAP-01 is unresolved and has no designed wording for that. |
| Hesitations | Maya cannot tell whether the subtitle is truncated (catalog step 2); she compares the agent answer to the table to check they match (merged variant step 4). Both are caused by the same duplication. |

## Take-away Pass

Screen: Devin page with the docked panel open (mockup top section).

- Needs you tile (2): the table shows the same two rows, and the sidebar dot already says 2. Three places state one number (catalog section 7 lists this too). Keep the tile only if it also acts as a filter; if not, it is the weakest of the three. Suspected, not measured.
- Panel open by default in the mockup: the mockup draws the thread already populated, which hides that on first visit the panel is closed (GAP-29). Not a removable element, a drawing choice. Draw it closed with Ask visible.
- Header "Updated 1m ago" next to the title: GAP-34 already recommends dropping it unless data is old. Agree.
- "Open in Devin" links inside the agent answer: the row title already links to Devin, and the recommended row label is "Answer in Devin" (GAP-20). The in-answer link is the only link when the user is in the full-screen bot thread (alternate path D), so keep it there, but it is a duplicate on the page.
- Tool disclosure "Done . 2 tools . 4s" with step names: this is the existing component (compare `refs/transcript.png`, which has no tool line because that thread used none). Collapsed by default, so it costs one line. Keep.
- ACUs tile, "From" column, PR column: not used by this story. Out of scope here; the other journeys judge them.

## Does asking add anything when the table already shows needs-you rows?

It is both duplication and a different job, depending on the question.

- Duplication: "What is Devin stuck on?" returns the same two sessions and the same question text as the rows (mockup: the answer lists "Add CSV export for invoices" and "Upgrade Prisma to 6.x" with the same questions as the subtitles). The catalog says the same: "She thinks 'good, that matches the table'". A user who gets the answer by looking has no reason to ask. This is the exact question the page is built to make unnecessary.
- Different job: the mockup's second question, "Anything merged today?", answers from rows the user would otherwise have to scan and match by hand (one PR in a Finished row). Likewise questions about history, one repo, or one person's sessions, which the table has no filter for (GAP-17 says add no filters because "the agent is the search"). That is the real reason to keep Ask.
- One gap the agent fills for the stuck question: the full text of a long question, which the single-line subtitle cuts off (GAP-45). Fixing the subtitle (clamp to two lines) removes that reason, so asking the agent to read a question out is a workaround for a layout problem.

Conclusion: do not design a path whose purpose is "ask the agent what is stuck". Design the table so that question needs no answer, and let Ask serve the open-ended questions.

## The Simpler Version

1. Maya opens Devin from the sidebar dot. The Needs you rows are first and show the full question in two lines (GAP-45). She reads it. Done for this goal; 0 clicks.
2. Row link reads "Answer in Devin" (GAP-20). One click leaves for Devin.
3. For anything else ("merged today?", "what is Priya running?"), she clicks Ask, the panel opens, and she types. 3 steps, same as today, for a question the table cannot answer.

Concrete changes:
- Do not add a suggestion chip "What is Devin stuck on?" to the Devin panel (the catalog notes Carta and Data room pass suggestions, Legal does not; follow Legal). A chip would advertise the duplicate path. This is a removal of something that is not yet built.
- Clamp the Needs you subtitle to two lines instead of one with ellipsis (GAP-45).
- Draw the panel closed in the mockup's default state, with Ask in the header (GAP-29). Show the populated thread as a separate state.
- Drop the Needs you tile or make it the one control that filters the table; do not leave it as a third statement of the count.
- Keep the agent, the tool disclosure, and the in-answer links unchanged.
- Resolve GAP-01 first. If the question text cannot be read without an approval card, the subtitle and the agent both lose it; then the table shows only title and badge, and the agent is the only place a question could appear, which turns the duplication argument around. State that dependency in the plan.

What could go wrong with this simplification: if GAP-01 stays unresolved, the table cannot show the question, and Ask becomes the primary way to read it, with approval cards in the way. That case is not simpler; it is broken.

## Clarity Issues

- The agent's fallback wording when it cannot read a question is undefined (GAP-01, GAP-31). Recommended single line: "I can see it needs you, but not what it asks. Open it in Devin." No UI.
- The agent can be asked to reply or stop a session and the mockup does not show what it says (catalog variation "Reply yes to Devin", GAP-10). One sentence pointing to Devin is enough; the write option for Devin should be removed (catalog open question 4).
- The answer says "asks whether the export should keep the legacy CSV column order" while the row says "Should the export keep the legacy ..." The two phrasings differ (catalog edge case). Same fact in two wordings invites doubt; acceptable, since the agent paraphrases.
- "Open in Devin" in the answer versus "Answer in Devin" on the row (recommended): two verbs for one destination. Use "Open in Devin" in the agent answer only when the answer is not about a question to answer; otherwise reuse "Answer in Devin". Minor.
- Panel intro and example-prompt copy for Devin is not drawn (GAP-29). Keep it empty; the composer placeholder "Message Devin agent" (mockup) is enough.
- Phone: no Devin screen (GAP-07). The push opens the agent thread, so there the agent is the only surface and the duplication argument does not apply. Say so in the PR.
