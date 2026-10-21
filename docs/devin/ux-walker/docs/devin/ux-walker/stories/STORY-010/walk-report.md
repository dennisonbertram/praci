# Walk report STORY-010: Decide what to do about a needs-you session

Target: planned steps on the mockup (static, links stubbed), existing steps in Storybook. Session ux-walker-devin, 1440x900 unless noted. No fixes, no issues filed.

| Step | Source | Screenshot (what it shows) | Geometry |
|---|---|---|---|
| 1 | Not walkable | `none`: Notification click and row highlight/scroll-to are not represented. | n/a |
| 2 | Mockup | `docs/devin/ux-walker/stories/STORY-010/screenshots/step-2.png`: Top row: title, clipped question 'Should the export keep the legacy ...', Needs you badge, no PR, Slack, 3.4, 12m ago. | mockup main frame: 0 horizontal overflow; 2 PR cells spill 7-12px into the From column; header-bar row uneven (mock chrome, ignore); date/ACU cells flagged as wrapped controls (false positive, table cells) |
| 3 | Mockup | `docs/devin/ux-walker/stories/STORY-010/screenshots/step-3.png`: No reply box and no visible 'Open in Devin' on the row; only the title link and the header Ask exist. Row hover underlines the title and tr has pointer cursor but only the title is a link. | n/a |
| 4 | Mockup (stub) | `docs/devin/ux-walker/stories/STORY-010/screenshots/step-4.png`: Title link is a stub (return false); external open and Electron app-opener not walkable. | n/a |
| 5 | Not walkable | `none`: Happens in Devin. | n/a |
| 6 | Not walkable | `none`: Return state: header 'Updated 1m ago' is static text; no refresh control exists in the frame. | n/a |
| 7 | Not walkable | `none`: Status change after refresh needs live data. | n/a |

## Findings

- F-STORY-010-01 (medium, happy-path): A needs-you row has no visible way to act. Only the title is a link; row hover underlines the title and the cursor is a pointer for the whol...
- F-STORY-010-02 (medium, flow): After answering in Devin the page gives no sign the answer landed: 'Updated 1m ago' is static, there is no refresh control, and the refresh ...
- F-STORY-010-03 (suggestion, flow): No cue for how long a session has waited beyond the Updated column ('12m ago' vs '1h ago'); an old Needs you looks the same as a new one....

## Flow Log

Specified 7 vs Ideal 3. Extra: step 3 (looking for a reply box) and steps 6-7 (waiting, no refresh). Hesitation at no visible action on the row. Duplicated info: question in row and reply. Re-entry: after answering in Devin the page gives no confirmation.
