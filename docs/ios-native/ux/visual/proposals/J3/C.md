# J3 Option C: adaptive split view (Apple Mail, Messages, Settings, Linear)

Round 2. Scope of missing inner, laptop and standard-iPhone boards.

## Pattern
The system pattern is the adaptive split view (SwiftUI NavigationSplitView and size classes). Apple Mail, Messages, Settings and Linear do not have a separate design per size: a few layout families define how a page collapses (sidebar + list + detail becomes a stack on a phone), and each family is shown once. Things shows the same logic: one list and detail template reused for every list. Here: one derivation recipe per family, plus one drawn exemplar wherever behaviour is not derivable from the recipe.

## Families
1. List + detail (Inbox, Legal, Cap table, Data room, Artifacts, Settings).
2. Live view + controls (Finance, Computer).
3. Thread (agent thread, group thread).
4. Form / sheet (New bot, New space, Account, Reply composer).

## Drawn exemplars (everything else follows the recipe)
- Inner-Message (becomes a grid of labelled frames): Message selected (existing); Reply, inner flat (detail pane becomes the form, Close top left, one prominent send arrow, list stays); Reply, half-folded (composer under the message); After Archive (next row selected, Archived snackbar with Undo in the detail pane); Inbox zero (centered check and text); Cleanup (More popover with Cleanup in the strip, Cleanup list in the detail pane, prominent Archive 101 emails).
- Split: add Finance 1/3 + 2/3 (sidebar with Finance selected; period tabs, tiles, chart, Accounts; Ask Finance agent prominent) and the same pose after tapping Ask Finance agent (detail pane replaced by the thread with Back to Finance). This also shows an agent thread beside the Personnel sidebar.
- Inner: add Finance half-folded: page left, thread right with a draft, two chips and one queued bubble "Waiting to send" (STORY-043-R2-3).
- Desk: add a pose caption ("Laptop: Live view + controls"). No new drawing; Desk and Desk-Computer already cover the family.
- New board PH-Pages (393x852): frame 1 Finance, frame 2 Settings pushed list; sheets and Artifacts follow the Form and List recipes.

## Recipe text
PG-A-Rules gets step 13 (standard iPhone derivation), the Ask-agent destination rule, removal of "folders", and the laptop-capable list (Artifact, Agent page and Agent list stay full height). PG-B-Rules gets the template table row for 393 pt and the same Ask-agent rule.

## Fit
About 9 new frames and one new board. Each new frame answers a question the recipe cannot answer (what the hinge does, where the Reply form goes, where Undo sits, what a queued message looks like). The rest of the pages are derived, as the rules boards already say.
