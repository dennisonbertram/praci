# Walk report STORY-001: Connect Devin from the Integrations tile

Target: planned steps on the mockup (static, links stubbed), existing steps in Storybook. Session ux-walker-devin, 1440x900 unless noted. No fixes, no issues filed.

| Step | Source | Screenshot (what it shows) | Geometry |
|---|---|---|---|
| 1 | Storybook | `docs/devin/ux-walker/stories/STORY-001/screenshots/step-1.png`: Integrations catalog at 1440px with Popular, Finance tiles and search plus category chips; no Devin tile exists in any story, so the Demo CRM and Brex letter tiles stand in for it. | 0 overflow; chip row widths differ by design (text-width chips); no wrapped controls. |
| 2 | Storybook (stand-in tile) | `docs/devin/ux-walker/stories/STORY-001/screenshots/step-2.png`: Catalog with Connected section (Slack, Notion, GitHub, Demo files, Demo calendar, Demo tools) above Find an app; Connect buttons are named 'Connect <App>' in the a11y tree. The Devin tile itself is not rendered by any story. | 0 overflow. |
| 3 | Storybook | `docs/devin/ux-walker/stories/STORY-001/screenshots/step-3.png`: 'Connect Devin' dialog: title, hint 'An org-scoped Devin service-user key (starts with cog_).', label 'API key', empty field, Cancel and a disabled Connect. This matches the mockup dialog. No link to where the key is created. | 0 overflow; footer buttons differ in width by design (68 vs 77). |
| 4 | Not walkable | `none`: Connecting state and bot creation need the real API; not walked. | n/a |
| 5 | Not walkable | `none`: 'Devin connected' done view is not rendered by any story and not drawn in the mockup; the Carta sentence and 'Open Devin' link cannot be compared. | n/a |

Extra evidence:
- `docs/devin/ux-walker/stories/STORY-001/screenshots/extra-1-sb-integrations-connectiondialog--one-field.png`: comparison: generic ConnectionDialog used by other API-key apps

## Findings

- F-STORY-001-01 (medium, consistency): The Devin dialog (CustomConnectionDialog first-party mode) looks different from the generic ConnectionDialog used by other API-key apps: Dev...
- F-STORY-001-02 (medium, happy-path): Hint says what the key is, not where to create it. The generic ConnectionDialog already has a 'Where to find your key' help link pattern (st...
- F-STORY-001-03 (low, visual): No Devin tile story exists, so the tile could not be walked. Letter-only tiles (Brex, Demo CRM) sit next to logo tiles (Mercury, Alchemy, Co...
- F-STORY-001-04 (medium, flow): Not observed (no story or mockup frame for the done view). Per catalog the done view says 'Devin connected' with 'Done' and no link to the n...

## Flow Log

Specified 5 vs Ideal 5 (Integrations, tile, key, Connect, Done). Needed 5. Hesitations: letter tile (unverified), where to get the key (no link). Re-entry: after Done the user is back in the catalog with no route to the page. Duplicated info: key description on tile hint and dialog hint (catalog); Connected badge vs section. Steps 4-5 not walked.
