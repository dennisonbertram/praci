# Walk report STORY-004: First load after connecting

Target: planned steps on the mockup (static, links stubbed), existing steps in Storybook. Session ux-walker-devin, 1440x900 unless noted. No fixes, no issues filed.

| Step | Source | Screenshot (what it shows) | Geometry |
|---|---|---|---|
| 1 | Not walkable | `none`: Loading skeleton is not drawn in the mockup. The real Legal page has stories for loading and load error (sb-legal-page--load-error.png). | n/a |
| 2 | Mockup | `docs/devin/ux-walker/stories/STORY-004/screenshots/step-2.png`: Header Devin, 'Updated 1m ago', icon button 'Open Devin' and 'Ask'; four tiles Needs you 2, Working 2, PRs open 3, ACUs this week 41.6. | mockup main frame: 0 horizontal overflow; 2 PR cells spill 7-12px into the From column; header-bar row uneven (mock chrome, ignore); date/ACU cells flagged as wrapped controls (false positive, table cells) |
| 3 | Mockup | `docs/devin/ux-walker/stories/STORY-004/screenshots/step-3.png`: Six-column table; three titles and both Needs-you question subtitles are ellipsized (JS check: 4 clipped nodes plus one more title); PR cell nearly touches From. | mockup main frame: 0 horizontal overflow; 2 PR cells spill 7-12px into the From column; header-bar row uneven (mock chrome, ignore); date/ACU cells flagged as wrapped controls (false positive, table cells) |
| 4 | Mockup | `docs/devin/ux-walker/stories/STORY-004/screenshots/step-4.png`: Docked panel open at 384px with a finished two-question conversation (dark theme from system preference); no first-visit intro or suggestions. | 0 overflow. |
| 5 | Mockup (static) | `docs/devin/ux-walker/stories/STORY-004/screenshots/step-5.png`: Ask button shows a visible focus ring; clicking is a stub (no panel change). The panel is already open in the frame. | n/a |

Extra evidence:
- `docs/devin/ux-walker/stories/STORY-004/screenshots/extra-1-sb-pages-agent-panel-intro--default.png`: comparison: real agent panel intro with suggestion chips

## Findings

- F-STORY-004-01 (medium, error-handling): The mockup has no loading, error, zero-session, or stale ('Updated' old) frames. Real Legal has stories for loading, load error ('Could not ...
- F-STORY-004-02 (medium, happy-path): 'ACUs this week' is Devin jargon with no definition and no window ('this week' rolling or calendar); value 41.6 has no unit or comparison....
- F-STORY-004-03 (medium, layout): With the panel docked at 1440px, 3 titles ('Add pagination to the audit l...', 'Migrate billing webhooks to t...') and both Needs-you questi...
- F-STORY-004-04 (low, layout): Geometry audit: PR cell 'acme/web#418 merged' spills 12px and 'acme/mobile#97 open' 7px past its cell, leaving 9px to 'Slack'....
- F-STORY-004-05 (medium, disclosure): First visit shows the panel already open mid-conversation (two prior questions). The real pattern is an intro with suggestion chips (sb-page...

## Flow Log

Specified 5 vs Ideal 2. Steps 4-5 (panel state, Ask) are decoration for this goal. Hesitation: ACUs meaning; clipped question. Duplicated info: needs-you in tile, badges, dot; agent reply repeats table text.
