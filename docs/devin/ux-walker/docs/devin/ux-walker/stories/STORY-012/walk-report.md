# Walk report STORY-012: Ask the agent what Devin is stuck on

Target: planned steps on the mockup (static, links stubbed), existing steps in Storybook. Session ux-walker-devin, 1440x900 unless noted. No fixes, no issues filed.

| Step | Source | Screenshot (what it shows) | Geometry |
|---|---|---|---|
| 1 | Mockup | `docs/devin/ux-walker/stories/STORY-012/screenshots/step-1.png`: Page with tiles and table, dot on Devin. | mockup main frame: 0 horizontal overflow; 2 PR cells spill 7-12px into the From column; header-bar row uneven (mock chrome, ignore); date/ACU cells flagged as wrapped controls (false positive, table cells) |
| 2 | Mockup | `docs/devin/ux-walker/stories/STORY-012/screenshots/step-2.png`: Needs-you subtitles clipped with ellipsis, no way to expand. | mockup main frame: 0 horizontal overflow; 2 PR cells spill 7-12px into the From column; header-bar row uneven (mock chrome, ignore); date/ACU cells flagged as wrapped controls (false positive, table cells) |
| 3 | Mockup (static) | `docs/devin/ux-walker/stories/STORY-012/screenshots/step-3.png`: Ask is focused while the panel is already open; Ask stays visible. Opening the panel cannot be exercised. | n/a |
| 4 | Mockup + Storybook | `docs/devin/ux-walker/stories/STORY-012/screenshots/step-4.png`: Real composer 'Message Ada' pill with plus and send; mockup 'Message Devin agent' pill matches shape and adds a mic icon. Real intro panel offers suggestion chips (sb-pages-agent-panel-intro--default.png); mockup has none. | 0 issues. |
| 5 | Mockup (interactive) + Storybook | `docs/devin/ux-walker/stories/STORY-012/screenshots/step-5.png`: Clicked the collapsed 'Done · 1 tool · 2s' summary: it opens and shows 'Searched Devin sessions'. Real labels look like 'Checked active integration' and 'Mail search' (sb-chat-tool-activity--done-open.png). | 0 issues. |
| 6 | Mockup | `docs/devin/ux-walker/stories/STORY-012/screenshots/step-6.png`: Reply bullets name both sessions with an 'Open in Devin' underlined link each; the link wraps and leaves 'Devin' alone on a line. User bubbles are purple. | n/a |
| 7 | Not walkable | `none`: Collapse control is drawn (28x28 icon) but not interactive. | n/a |

Extra evidence:
- `docs/devin/ux-walker/stories/STORY-012/screenshots/extra-1-sb-chat-usertextbubble--text.png`: comparison: real user bubble (neutral)
- `docs/devin/ux-walker/stories/STORY-012/screenshots/extra-2-sb-shell-composer--composer-default.png`: comparison: composer

## Findings

- F-STORY-012-01 (medium, hierarchy): The Ask button stays in the header while the panel is already open. The existing pattern (Legal) shows Ask only when the panel is closed....
- F-STORY-012-02 (low, consistency): User bubbles are purple (bot colour) in the mockup. The real user bubble is a neutral grey (sb-chat-usertextbubble--text); the mockup even d...
- F-STORY-012-03 (low, consistency): Tool step labels 'Searched Devin sessions' and 'Read Devin messages x2' are invented; real labels come from humanizeToolName and look like '...
- F-STORY-012-04 (low, visual): 'Open in Devin' wraps in both bullets and leaves 'Devin' alone on a line at 384px; the same link is repeated twice....
- F-STORY-012-05 (low, a11y): Panel collapse icon is 28x28 and the sidebar icon buttons are 34x30, under 32/44px targets. Sidebar ones come from the real app; the 28px on...
- F-STORY-012-06 (suggestion, disclosure): The composer has no suggestion chip; 'What is Devin stuck on?' is the obvious one and the real intro panel pattern supports chips....
- F-STORY-012-07 (medium, error-handling): Not observed: wording and UI when the agent cannot read question text (write-gated get_messages) is not drawn; the mockup only shows the ide...

## Flow Log

Specified 7 vs Ideal 3 (and 0 if the table question is readable). Needed: click Ask, type, read. Hesitation at clipped subtitle. Duplicated info: question in table and reply; Ask button and open panel.
