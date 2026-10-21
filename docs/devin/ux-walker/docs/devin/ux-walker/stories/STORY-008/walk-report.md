# Walk report STORY-008: Glance at the page and see what needs me

Target: planned steps on the mockup (static, links stubbed), existing steps in Storybook. Session ux-walker-devin, 1440x900 unless noted. No fixes, no issues filed.

| Step | Source | Screenshot (what it shows) | Geometry |
|---|---|---|---|
| 1 | Mockup + Storybook | `docs/devin/ux-walker/stories/STORY-008/screenshots/step-1.png`: Real sidebar glance: Inbox '3', Finance '24 mo' as text, Legal as an 8px dot. The mockup Devin dot (mockup-light.png) uses the same 8px dot, so it is consistent. | 0 issues. |
| 2 | Mockup | `docs/devin/ux-walker/stories/STORY-008/screenshots/step-2.png`: Page after click: header, tiles, table. Skeleton step is not drawn. | mockup main frame: 0 horizontal overflow; 2 PR cells spill 7-12px into the From column; header-bar row uneven (mock chrome, ignore); date/ACU cells flagged as wrapped controls (false positive, table cells) |
| 3 | Mockup | `docs/devin/ux-walker/stories/STORY-008/screenshots/step-3.png`: Tiles read 2/2/3/41.6 with equal visual weight; Needs you tile is not distinguished. | tiles equal 88px height. |
| 4 | Mockup | `docs/devin/ux-walker/stories/STORY-008/screenshots/step-4.png`: Two Needs-you rows are first, amber outline badges, one-line question under title (clipped). | mockup main frame: 0 horizontal overflow; 2 PR cells spill 7-12px into the From column; header-bar row uneven (mock chrome, ignore); date/ACU cells flagged as wrapped controls (false positive, table cells) |
| 5 | Not walkable | `none`: Continues in STORY-010. | n/a |

Extra evidence:
- `docs/devin/ux-walker/stories/STORY-008/screenshots/extra-1-mockup-dark.png`: dark theme check

## Findings

- F-STORY-008-01 (medium, hierarchy): Needs you is the only thing the user came for, yet its tile has the same style as Working, PRs open and ACUs; badge weights are all thin out...
- F-STORY-008-02 (medium, hierarchy): The Needs-you fact is stated four times in the 1440px frame: dot, tile (2), two badges, and again in the agent reply. Catalog says notificat...
- F-STORY-008-03 (medium, a11y): Measured contrast on the light page: warning text 3.48:1, success text 4.17:1 (12px badge text) against #fafaf8; both below 4.5. Destructive...
- F-STORY-008-04 (low, a11y): The sidebar dot is a span with aria-label and no role, so many screen readers will not announce '2 need you'. Real sidebar dot behaviour not...
- F-STORY-008-05 (low, error-handling): Zero state (Needs you 0, no badges, dot gone) is not drawn. Real Legal draws zero tiles (sb-legal-page--needs-consent.png)....

## Flow Log

Specified 5 vs Ideal 2. Needed 2 plus a scan of the status column. Hesitation: which of four equal tiles matters. Duplicated info: dot, tile, badges, panel. Zero state not drawn.
