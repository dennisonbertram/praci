# Walk R3 (iteration 9): verify pass-8 clusters C21-C26 + Storybook smoke

Target: mock demo stack (web :5381), 1440x900, mock-founder login plus one throwaway sign-up (walker-r3@northwind.example.test) for the solo-account checks. Screenshots: /tmp/uxloop9/R3/.
Scope note: clusters.json holds C1-C26 only; C27-C31 do not exist, so nothing to verify for them.
Other walkers share the demo user, so some chat/agent rows changed during the walk.

## Verdicts

| Cluster | Verdict | Steps (actual/ideal) | Notes |
|---|---|---|---|
| C21 Data room small items | PASS (import strip unobserved) | 4/4 | Unreadable PDF row and preview offer only Delete, no Try again (03). Ready rows leave Status empty; only Reading/Failed show a status (02). "Imported N files" strip not observed: the seeded "Board Minutes" file stays on Reading forever on the demo, so the strip stays at "Processing 1 file" (05, 06). It followed me into the Bank statements folder as "Processing", not "Imported". |
| C22 Focus rings and a11y/copy | PASS (one nit) | 5/5 | Sidebar buttons show a 2px ink ring (rgb 236,235,230) on Tab, no blue. Hide amounts shows a check when on (08). Artifacts lock is a focusable button with a name (10). Sign-up shows "At least 8 characters." inline, no native bubble (12). Skill menu reads "Upload a skill file". Nit: chat message action buttons still use the browser default outline (R3-9-02). |
| C23 Layout shifts while loading | PASS | 3/3 | Inbox load: one layout shift of 0.046, on the sidebar scroller, none in the Inbox banner slot. Bot settings panel opens with no shift in its own sections (22; 0.10 shift is the chat column narrowing). Palette shows a spinner for the first query and dims previous results on a refined query (24-26). |
| C24 Artifacts card age | PASS | 1/1 | Age and type label share right edge x=672 (first card), 1034, 1395 on the other columns. |
| C25 Solo founder chrome | PASS with one miss | 4/4 | New space is gone from the Create menu for a one-space account (15). An untouched New Bot stays after its panel closes (17), as the owner decided. The sidebar still shows a "PERSONAL" section heading for the solo account (R3-9-01). |
| C26 Inbox details | PASS | 4/4 | One Clear control (the x) in search, no second "Clear" link (19). Due dates use amber, red only for days < 0 (TodoCard.tsx:128). Cleanup text starts at x=344, same as the Inbox grid (21). Search reason: still none (R3-9-04). |
| Storybook smoke | FAIL (2 stories) | n/a | Built from the main checkout into /tmp; 1692/1694 stories render cleanly. Failing: `fundraising-mercurydialogs--assign-to-contact` and `fundraising-mercurydialogs--investor-email` (apps/web/src/components/fundraising/MercuryDialogs.stories.tsx): empty render, no console error. Fundraising is owned by another session. |

## Findings

| id | page/story | sev | cat | what happened vs expected | evidence | suspected location | fix |
|---|---|---|---|---|---|---|---|
| R3-9-01 | C25 sidebar | P3 | visual | Observed: a new single-space account still sees a "PERSONAL" heading above its bots. Owner decision says Personal stays hidden until a second space or member exists. The New space item and picker tag are already gone. | /tmp/uxloop9/R3/14-fresh.png | apps/web/src/pages/Shell.tsx:1923 (sidebarGroupsForSpaces ... t`Personal`) | Pass no heading label when the account has one space and one member. |
| R3-9-02 | C22 chat | P3 | a11y | Observed: chat message actions (React, Reply, Remember, More) and in-message links focus with the browser default `outline: auto 1px`, while sidebar controls now use the 2px ink ring. Two focus styles in one view. | focus probe on 16 Tab stops (not screenshotted) | chat message action buttons, not located | Give them the same focus-visible ring class as the sidebar. |
| R3-9-03 | Inbox | P3 | flow | Observed: an approval toast persists (2+ min) over the top-right of Inbox, covering the first To do row's due date and the Needs attention badges in search results. Persistence is by decision; the placement hides content. | 18, 19, 20 | toast stack position in Shell | Place persistent toasts at the bottom edge, or collapse to a sidebar badge after a few seconds. |
| R3-9-04 | Inbox search | P3 | flow | Observed (still open from V3-17): results show "Needs attention"/"Archived" badges but no reason a mail matched (for "pilot", "You: Re: Q3 numbers" has no visible hit). | 19 | apps/web/src/pages/Inbox.tsx search results row | Show a one-line snippet with the matched term highlighted. |
| R3-9-05 | C21 demo | P3 | flow | Suspected demo artifact, not a product defect: the seeded Board Minutes file never leaves Reading, so the import-done strip cannot be verified on this stack. | 05, 06 | demo seed data | Make the seeded file Ready, or leave a Reading file out of the seed. |

Praise: the palette keeps old results dimmed while a refined query loads; the Data room list is much calmer without the Status dashes; the sign-up inline rule is clear.

Unverified: "Imported N files" wording and clearing on navigation (blocked by R3-9-05); C23 Skills/Memory growth (sections appeared already populated); keyboard ring on page rows (Tab order started after them).
