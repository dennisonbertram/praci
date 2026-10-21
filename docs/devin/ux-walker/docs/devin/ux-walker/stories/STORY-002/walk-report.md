# Walk report STORY-002: First visit through the sidebar link, not connected

Target: planned steps on the mockup (static, links stubbed), existing steps in Storybook. Session ux-walker-devin, 1440x900 unless noted. No fixes, no issues filed.

| Step | Source | Screenshot (what it shows) | Geometry |
|---|---|---|---|
| 1 | Mockup | `docs/devin/ux-walker/stories/STORY-002/screenshots/step-1.png`: Sidebar Pages group with Devin between Data room and Artifacts, current-row highlight and an 8px dot at the right; page header Devin. The link is a stub, so the click was not exercised. | mockup main frame: 0 horizontal overflow; 2 PR cells spill 7-12px into the From column; header-bar row uneven (mock chrome, ignore); date/ACU cells flagged as wrapped controls (false positive, table cells) |
| 2 | Mockup | `docs/devin/ux-walker/stories/STORY-002/screenshots/step-2.png`: 'Not connected' frame: the word Devin and a black 'Connect Devin' button on a bordered card, drawn without sidebar or panel; nothing else on the page. | 0 overflow; one primary button. |
| 3 | Mockup | `docs/devin/ux-walker/stories/STORY-002/screenshots/step-3.png`: Dialog frame (existing copy) with a prefilled masked key, enabled Connect and Cancel; shown as a static frame, not opened from the button. | Footer buttons 68 vs 77 wide (by design). |
| 4 | Not walkable | `none`: Connect then page load is not interactive in the mockup and the page is not built. | n/a |

Extra evidence:
- `docs/devin/ux-walker/stories/STORY-002/screenshots/extra-1-sb-legal-page--needs-consent.png`: comparison: real page empty state
- `docs/devin/ux-walker/stories/STORY-002/screenshots/extra-2-sb-legal-page--load-error.png`: comparison: real load error

## Findings

- F-STORY-002-01 (medium, disclosure): The Not connected frame is a title and one black button on an empty card. The real Legal not-ready page explains what is needed and shows ze...
- F-STORY-002-02 (low, flow): The dialog frame is shown with a prefilled key and enabled Connect; the empty-field state (Connect disabled) and the after-connect result on...
- F-STORY-002-03 (low, a11y): Not observed: whether the sidebar link shows a dot or label when not connected is not drawn; the dot is a span with aria-label but no role....

## Flow Log

Specified 4 vs Ideal 3 (sidebar, Connect Devin, key+Connect); the extra step is reading a nearly empty page. Hesitation: what does this page do. Re-entry: none walked. Duplicated info: none on this surface.
