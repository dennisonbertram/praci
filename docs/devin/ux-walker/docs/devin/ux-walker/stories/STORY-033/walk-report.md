# Walk report STORY-033: Narrow windows, Electron links and the phone

Target: planned steps on the mockup (static, links stubbed), existing steps in Storybook. Session ux-walker-devin, 1440x900 unless noted. No fixes, no issues filed.

| Step | Source | Screenshot (what it shows) | Geometry |
|---|---|---|---|
| 1 | Mockup + Storybook | `docs/devin/ux-walker/stories/STORY-033/screenshots/step-1.png`: Mockup at 1100px: fixed 1440px shell inside an overflow-x:auto wrapper; sidebar and page visible, the docked panel is almost entirely cut off at the right edge. Real shell at 1100: panel overlays 384px with a shadow (sb-shell-resizable-side-panel--open-1100.png). | mockup: shell 1440 vs viewport 1100, main 740 never reflows; real panel story 0 overflow. |
| 2 | Storybook | `docs/devin/ux-walker/stories/STORY-033/screenshots/step-2.png`: Overlay panel covers the right 384px of the page; with the Devin table the ACUs and Updated columns would sit under it (derived, not rendered with Devin content). | 0 overflow. |
| 3 | Mockup + Storybook | `docs/devin/ux-walker/stories/STORY-033/screenshots/step-3.png`: Mockup at 900px shows sidebar and the first columns of the table only; no drawer. Real Legal page at 900 (sb-legal-page--default-900.png) has no sidebar and turns the table into stacked label/value blocks with the badge at the top right. | mockup scrolls inside wrapper; real: 0 overflow. |
| 4 | Not walkable | `none`: Electron external link handling needs the desktop app; not run (and not allowed on this machine as routine). | n/a |
| 5 | Not walkable | `none`: Devin sign-in in the system browser is outside Rakazo. | n/a |
| 6 | Not walkable | `none`: Mobile push routing has no web surface; no Storybook story. | n/a |
| 7 | Not walkable | `none`: No Devin screen exists on mobile; not represented. | n/a |

Extra evidence:
- `docs/devin/ux-walker/stories/STORY-033/screenshots/extra-1-mockup-1280.png`: mockup 1280
- `docs/devin/ux-walker/stories/STORY-033/screenshots/extra-2-mockup-900.png`: mockup 900
- `docs/devin/ux-walker/stories/STORY-033/screenshots/extra-3-mockup-390.png`: mockup 390
- `docs/devin/ux-walker/stories/STORY-033/screenshots/extra-4-sb-legal-page--default-390.png`: real Legal at 390
- `docs/devin/ux-walker/stories/STORY-033/screenshots/extra-5-sb-legal-page--default-1280.png`: real Legal at 1280
- `docs/devin/ux-walker/stories/STORY-033/screenshots/extra-6-sb-shell-resizable-side-panel--open-390.png`: real panel at 390

## Findings

- F-STORY-033-01 (high, layout): The mockup is a fixed 1440x900 shell. At 1280 the panel is cut by 160px, at 1100 the panel is nearly off-screen, at 900 the table is cut aft...
- F-STORY-033-02 (high, layout): No narrow layout for the six-column table. The real Legal page shows what is needed: at 900 and 390 the table becomes stacked label/value bl...
- F-STORY-033-03 (medium, layout): At 1100 the real overlay panel (observed in the resizable side panel story) covers the right 384px, so ACUs and Updated would sit under it w...
- F-STORY-033-04 (low, layout): Mockup connect-dialog section is fixed 440px and pushes the page 66px wider than a 390px viewport (scrollWidth 456). Mockup artifact only....
- F-STORY-033-05 (medium, flow): Not observed: mobile has no Devin screen and push taps carrying only /app/devin do nothing (catalog + code claim). No web surface to walk....

## Flow Log

Specified 7 vs Ideal 7. Needed: unknown; only layout evidence was walkable. Mockup has no narrow design; mobile push path undecided.
