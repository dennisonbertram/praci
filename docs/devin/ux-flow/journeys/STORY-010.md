# STORY-010: Decide what to do about a needs-you session

Verdict: **acceptable, with one clarity defect that matters**. The step count is already close to ideal. The page never says that the next step is "answer in Devin", and the measured mockup truncates the question that she needs in order to decide.

Evidence read: `docs/devin/ux-paths/catalog.md` (STORY-010, sections 7.1 to 7.3, GAP-01, 06, 10, 13, 19, 20, 45), `docs/devin/mockup.html` lines 176-246, `mockup-v2-full.png`. I looked at the mockup screenshot at 1440 px with the dock open.

## Friction Scorecard

| Measure | Result | Basis |
|---|---|---|
| Steps, actual vs Ideal | Ideal 3 (read the question on the row, click the title, answer in Devin). Actual in the catalog: 7. Of those, 3 are real actions (open page, click title, answer in Devin) and 4 are reading or waiting (read row, look for a reply box, return, wait for refresh). The 4 extra steps are hesitation and verification, not clicks. | Catalog STORY-010 Steps |
| Needless decisions | 1. The row has two clickables that look alike: the title link and, in the chat, "Open in Devin". On the table itself there is only the title link, so the decision is only whether to use the page or the chat. Also whether to forward to Jorge, which Rakazo cannot help with (no copy link, catalog Alternate paths). | Mockup |
| Re-entry | 1 loop. After answering in Devin the user returns and sees "Needs you" still on the row. She has to wait for a refresh (GAP-13). There is no way to confirm that the answer arrived. | Catalog step 6-7 |
| Confirmations | 0. | Mockup |
| Dead ends | 2. (1) No reply box: the page has none and the only cue is its absence (GAP-20). (2) After the answer, nothing on the page shows that Devin received it until the next refresh. Also a long question has no way to be read in full on the page (GAP-45). | Catalog steps 3, 6, 7 |
| Hesitation points | 3. (1) "Where do I answer?" (2) "Is the title a link?" The title is plain text weight, same style as every other row (measured in `mockup-v2-full.png`: Needs you titles look identical to Working titles). (3) "Did it go through?" | Mockup |

Measured defect: in `mockup-v2-full.png` at 1440 px the question under "Add CSV export for invoices" reads "Should the export keep the legacy ..." and is cut off with an ellipsis. The second row reads "Two migrations conflict. Squash th..." and is cut off in the middle of the question. The question is the one fact the user needs to decide whether to act now or ask Jorge, and it is hidden in the mockup the team will build from. The Session column is 31% wide (`mockup.html` colgroup).

## Take-away Pass

| Element | Needed for this story? | Verdict |
|---|---|---|
| Row title (link) | Yes, it is the only way to reach Devin. | Keep, but it is not recognisable as the action |
| Question subtitle | Yes. It removes the need for the agent. | Keep and allow two lines (GAP-45) so it can be read |
| Needs you badge | Yes. | Keep |
| Pull request column on a needs-you row | No (shows a dash on the CSV row, an open PR on the Prisma row). Not needed to decide. | Fine as is; low weight |
| ACUs column | No. | Remove (see STORY-008) |
| "From" column | Helpful: "Slack" tells her where the thread started. | Keep |
| Header "Open Devin" icon | Not used; goes to Devin home with no session deep link, so it is a worse route than the title (catalog 7.1, GAP-19). | Remove, or keep only if the target is defined |
| Ask button and docked chat | No. The chat cannot answer Devin and the user already has the question on the row. | Closed by default (GAP-29). Do not offer it as the next step for a needs-you row |
| Chat link "Open in Devin" | A second path to the same place. Acceptable as a shortcut, since it is the same destination. | Keep, same label as the row link (see Clarity Issues) |

One primary action: for a needs-you row the primary action is "answer in Devin", but nothing on the row is styled as an action. The badge, the title and the subtitle are three separate text elements, and the only control is the title text link. That fails the check "is the visually loudest element the next step"; the loudest element on the row is the amber badge, which is not clickable. (Observed in the screenshot; I did not hover to check an underline or hover state, because the mockup has none: `onclick="return false"` stubs.)

## The Simpler Version

1. Notification or sidebar click opens the page. Needs you rows are on top (already true, mockup rows 1-2).
2. On a needs-you row, read the question (two lines, not clipped).
3. Click one clear control on the row: a "Answer in Devin" link or button on the right of the row, replacing the "Updated" cell for needs-you rows only. The title can still link to the same URL. This is the fix the catalog proposes for GAP-20 (a label, no explainer text), and it also adds the external-link icon, which the Electron opener will make real.
4. Answer in Devin (outside Rakazo).
5. Return to Rakazo. The page refetches on window focus (GAP-13), so the row has already changed to Working. No refresh button.

That is the ideal path of 3 actions with one control per needs-you row, no explainer copy, and no wait. The change that closes the loop is the refetch on focus, not new UI.

What to remove: the header Open Devin icon, the ACUs column, and the sample chat question "What is Devin stuck on?" as a headline demo.

What not to add: copy link, forward to Jorge, row highlight, reminder or escalation. The catalog lists these as gaps, but each adds UI for a rare path. Forwarding by hand is acceptable until someone asks.

## Clarity Issues

| Issue | Evidence | Suggestion |
|---|---|---|
| Nothing says the answer happens in Devin | GAP-20; catalog step 3; mockup row has no action label | Label the row link "Answer in Devin" |
| Same destination, two labels: the catalog says "Open in Devin" in chat and the mockup has an unlabeled title link and an unlabeled header icon with aria-label "Open Devin" | `mockup.html` lines 183, 237, 238 | Use one verb. "Answer in Devin" for needs-you rows; "Open in Devin" for others, if a link is needed |
| Question clipped to a fragment | `mockup-v2-full.png`, both needs-you rows | Two-line clamp; keep the link as the way to read more |
| "Updated 12m ago" on a needs-you row is ambiguous: it could mean the status changed or the question was asked | Mockup column "Updated" | Use "Waiting 12m" for needs-you rows only, or keep "Updated" and accept the ambiguity |
| Status vs action: the amber "Needs you" badge looks like a button but is not one | `mockup-v2-full.png` | Keep it a plain badge; put the action next to it |
| Failure copy for the missing question (GAP-01 fallback) is undefined | Catalog Variations | Show the title and badge only, with "Answer in Devin" still present; the missing subtitle should not block the action |
