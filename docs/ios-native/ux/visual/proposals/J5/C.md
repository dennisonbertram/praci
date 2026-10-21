# J5 proposal C: pose templates, as in Apple Mail, Settings, Messages and Things

Pattern: native SwiftUI split-view adaptation (Apple Mail and Settings on iPad: `NavigationSplitView`, sidebar + detail, content pushed on compact width). Messages and Things use the same idea. A page does not get a custom inner layout; it picks one of three templates, and each template is drawn once on the page that stresses it most.

## Templates
| Template | Inner (book) | Half-folded | Laptop | Drawn on |
| --- | --- | --- | --- | --- |
| List + detail | list third, detail two thirds | list half, detail half | list below, detail above | Inbox message (new board) |
| Live view + controls | thread third, view two thirds | thread half, view half | view above, key bar, Release and keyboard or composer below | Computer (new board) |
| Form | form card centered on the right | card in the left half | not applicable | rule text only |

Page assignment: Finance, Legal, Cap table, Data room, Artifacts, Routine = List + detail (their outer board is the detail). Agent page, Agent list, Thread = List + detail with the thread as detail or as the bottom half. Computer, Image = Live view. Sign in, Server, Settings, create sheets = Form.

## Changes
1. New board Inner-Message (890x626, half-folded): list half left, open message right, strip with Back-less layout (Archive, Reply group, More, prominent Ask Inbox agent).
2. New board Desk-Computer (626x890): screen top half, Release and Keyboard bar, key bar, system keyboard on the bottom half.
3. Desk: rule text fixed to match the board; chart content left to K2.
4. Inner: context chip "Re: Pilot timeline".
5. PG-A-Rules and PG-B-Rules: add the template table and a per-page coverage line; change Data room, Legal, Cap table laptop text to the List + detail stacked pattern and say no board exists on purpose.
6. PG-B-Rules Sign in: add keyboard placement for half-folded.

## Cost
Two new boards, one chip, six rule-card edits.

## Weakness
Finance inner, Legal inner and Data room laptop stay text. A reader who wants to see them must trust the template.
