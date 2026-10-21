# Walk report STORY-021: Devin asks a question while the founder is working in Rakazo

Target: planned steps on the mockup (static, links stubbed), existing steps in Storybook. Session ux-walker-devin, 1440x900 unless noted. No fixes, no issues filed.

| Step | Source | Screenshot (what it shows) | Geometry |
|---|---|---|---|
| 1 | Storybook | `docs/devin/ux-walker/stories/STORY-021/screenshots/step-1.png`: Real toast: avatar letter, title 'Ledger agent needs you', one-line body, '2m ago', bottom-right card. Devin copy is not rendered by any story. | 0 overflow. |
| 2 | Mockup + Storybook | `docs/devin/ux-walker/stories/STORY-021/screenshots/step-2.png`: Dot at the same moment as the toast; consistent 8px dot. | n/a |
| 3 | Not walkable | `none`: Toast click and navigation not represented. | n/a |
| 4 | Mockup | `docs/devin/ux-walker/stories/STORY-021/screenshots/step-4.png`: Page with Needs you 2 (two sessions) rather than the story's 1; question under title. | mockup main frame: 0 horizontal overflow; 2 PR cells spill 7-12px into the From column; header-bar row uneven (mock chrome, ignore); date/ACU cells flagged as wrapped controls (false positive, table cells) |
| 5 | Not walkable | `none`: Dot clearing on arrival is behavior, not drawn. | n/a |
| 6 | Not walkable | `none`: External open. | n/a |

## Findings

- F-STORY-021-01 (medium, hierarchy): Toast, dot, tile and row say the same fact. Real toast structure observed (title, one-line body, age) has no action label; the whole card is...
- F-STORY-021-02 (low, error-handling): Not observed: toast body when the question text is unavailable and toast suppression when already on the page are undecided....
- F-STORY-021-03 (low, flow): Dot clears on arrival even though the row still says Needs you (per catalog; not observable in static mockup)....

## Flow Log

Specified 6 vs Ideal 3. Duplicated: toast, dot, tile, row (4x). Re-entry: dot cleared while unanswered. Steps 3,5,6 not walkable.
