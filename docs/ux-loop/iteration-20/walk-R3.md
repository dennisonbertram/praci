# Walk R3 (iteration 20): verify pass-19 clusters C21-C31, Storybook smoke

Target: mock-data demo stack on web :5381, 1440x900, signed in as the mock founder. Screenshots: /tmp/uxloop20/R3/.

Scope note: iteration-19 `clusters.json` has only C1-C22. C23-C31 do not exist, so only C21 and C22 were verified. C1-C20 are not in this walk.

Environment note: the demo stack on :5381/:3308 stopped responding about 20 minutes into the walk (the page showed "Could not reach the server") and later came back with fresh data (sessions invalid, Legal 13 contracts became 11). I signed in again and continued. Storybook smoke ran from the main checkout (`/Users/dennison/develop/rakazo`, HEAD 7e039a1f2) because the worktree has no `node_modules`.

## Story verdicts

| Cluster / story | Verdict | Steps actual/ideal |
|---|---|---|
| C21 / STORY-APP-129 browse Artifacts, grid and list | PASS | 2/2 |
| C21 / STORY-APP-130 open an artifact in split view, versions, Download | PASS | 3/3 |
| C21 / STORY-APP-131 delete dialog (opened, cancelled, not confirmed) | PASS with P3 (R3-20-01) | 2/2 |
| C21 / STORY-APP-132 empty and error states | SKIPPED (needs an empty space or a cut network) | - |
| C21 / STORY-APP-133 chat file card | SKIPPED (time; not in the cluster) | - |
| C22 / Legal draft hand-off to Inbox agent | FAIL (not fixed) | n/a, ideal 1 tap, actual copy and paste |
| C22 / routine results labelled "From routine: <name>" | FAIL by code, not seen live (R3-20-03) | - |
| C22 / blockquote text contrast in chat | UNVERIFIED (no quote in a thread; chat markdown has no blockquote rule I could find) | - |
| Storybook smoke | FAIL, 3 of 1800 stories | - |

## C21 acceptance results (observed)

- Toggle stays visible in split view: PASS. With a file open, the "List view" and "Grid view" buttons stay in the header (screenshots 03, 06). Pressing "Grid view" while a file is open returns to `/app/artifacts` and closes the file, which is reasonable.
- Grid cards at most 100 px tall: PASS. Cards measure about 72 px (88 px apart, 3 columns, one-line description; screenshot 02). Previously 150 px.
- Rules and header share one right gutter: PASS. List rules run from x=344 to x=1412, the same as the Ask button's right edge (1412) and the heading's left edge (344); screenshot 05. The "Added" column text ends at 1364, 48 px inside the rules (room for the hover delete button), which looks slightly off but is not a defect.
- Geometry audit on the Artifacts page: no horizontal overflow, no text spills, no wrapped controls. The only "uneven rows" are sidebar chat rows (name next to time), which are normal.
- Console: no errors (only vite debug lines).

## Findings

| id | page/story | severity | category | what happened vs expected | evidence | suspected code | proposed fix |
|---|---|---|---|---|---|---|---|
| R3-20-01 | Artifacts, STORY-APP-131 | P3 | copy | OBSERVED: the delete dialog title reads `Delete "MOCK Vendor Spend Review.md"?` but the list and grid show the name without `.md`. Maya sees a name she has not seen before. | snapshot heading in the delete dialog; screenshots 03, 07 | apps/web/src/pages/Artifacts.tsx (dialog title uses the file name, rows use a display name) | Use the same display name in the dialog title as in the list. |
| R3-20-02 | Legal agent chat, C22 | P3 | flow | OBSERVED, still open: asked to draft a notice and give it to the Inbox agent, the Legal agent wrote a good draft, then said "I don't send mail, and I can't hand it to the Inbox agent directly from this session." Maya must copy the text into another chat. C22 acceptance ("one-tap hand-off to the Inbox agent") not met. | /tmp/uxloop20/R3/13-legal-handoff.png | apps/api/src/legal-agent.ts (no message_bot to the Inbox agent); transcript.tsx for an action button | Give the Legal agent message_bot to the Inbox agent, or add a "Send to Inbox agent" button on drafted mail text. |
| R3-20-03 | Chat transcript, C22 | P3 | flow | SUSPECTED (code only; I did not trigger a routine run): grep finds no "From routine" label anywhere in apps/web/src, apps/api/src or packages/adapters/src, so routine results still read like replies. | grep of the three source trees | apps/web/src/pages/shell/transcript.tsx | Add a "From routine: <name>" label on routine-run messages. |
| R3-20-04 | Storybook | P2 | bug | OBSERVED: `node .storybook/smoke.mjs storybook-static` reports 1797/1800 clean; three stories fail (list below). CI's smoke check will fail. | /tmp/uxloop20/R3/sb-smoke.log | see list | Fix each story's fixture or stub (details below). |
| R3-20-05 | Legal page, C2 area | P3 | flow | OBSERVED during the outage: while the API was down, the Legal page showed "Could not refresh: Could not reach the server" with a "Try again" button but the header button still read "Scanning…" (disabled) and my queued chat message gave no sign it was waiting behind the scan. Only seen because the stack restarted, so low priority. | /tmp/uxloop20/R3/11-legal-reply2.png | apps/web/src/pages/Legal.tsx scan state | Clear the "Scanning…" state when the refresh fails. |

Praise: the Artifacts page is now clean. Uniform short cards, a toggle that stays in split view, aligned gutters, a clear version menu ("v2 · 2m ago") and a plain Download button. A first-time founder reaches the board deck in 2 steps.

## Storybook smoke failures (3)

1. `dataroom-preview--unreadable-file` (apps/web/src/components/data-room/Preview.stories.tsx): "Failed to load resource: 404". The story requests a file URL that does not exist in the static build; stub it like other stories.
2. `dataroom-previewactions--pdf-on-phone` (apps/web/src/components/data-room/PreviewActions.stories.tsx): "Not allowed to load local resource: blob:sample#toolbar=0". The story uses a fake blob URL in an iframe; use a data URI or skip the embed.
3. `gtm-live-block--empty` (apps/web/src/components/gtm/GtmBlock.stories.tsx): renders empty and not shown. The component renders null for this state; wrap the story in `withVisibleRoot("...")` from `src/stories/decorators.tsx`.

Items 1 and 2 touch the data-room preview, which pass-19 C4 changed; they are likely regressions from that work.

## Not covered

C1-C20 (other walkers), C23-C31 (not in clusters.json), phone width, STORY-APP-132/133, a live routine run, chat blockquote contrast.
