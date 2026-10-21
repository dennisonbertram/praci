# ux-visual round 1: Devin page main frame and states (mockup v3)

Inspector: main page frame and states at 1440x900, 1920x1080, 768x1024 and 375x812, light and dark (56 runs). Second opinions: meta/muse-wonder and google/gemini-4-argon (`second-opinion.json`). Screenshots in `shots/` (not committed), measurements in `audit.json`.

Counts: 23 findings. P0 0, P1 4, P2 12, P3 7. By level: component 9, group 3, page 8, layout 3.

Rejected external claims: Argon "missing Earlier section" and "mobile clips" (caused by the mockup's fixed frame height); Muse P0 "second Needs-you row clipped at 375" (mock toolbar and frame height); Muse "purple bubbles break monochrome" (bots carry the only identity colour); Muse "add header time and refresh" (already decided in `docs/devin/ux-flow/report.md`). Dark-mode contrast values of 1.2–1.4 from `layout-audit.js` are false positives (it cannot resolve `color-mix()`).

## Findings

| id | level | element | problem | norm | evidence | sev | found by | verified |
|---|---|---|---|---|---|---|---|---|
| F01 | component | Panel close icon, sidebar icon buttons | Close control is a span with no role or label and tabindex -1; tab order stops at the row links | A2, I7 | shots/focus-1440-light.png | P1 | own, muse | yes |
| F02 | group | Key-rejected header "Updated 4m ago" vs rows "1m ago", "3m ago" | Stale state contradicts itself | C3, C2 | shots/1440x900-key-rejected-light.png | P1 | argon, own | yes |
| F03 | page | Key-rejected error line | One unframed red line; tiles, badges, links and sidebar dot stay at full strength; 44px layout shift | C3, I3, L5, H2 | shots/1440x900-key-rejected-light.png | P1 | muse, argon, own | yes |
| F04 | group | Error session under "Earlier" | Failed session not in or counted under "Needs you"; faint pill | C3, H2, H4 | shots/1440x900-populated-open-light.png | P1 | muse, own | yes |
| F05 | component | "Answer in Devin" link | 12px, 18px tall; title links 21px; under 24px minimum | I4, H1, H2 | audit.json smallTargets | P2 | muse, own | yes |
| F06 | component | Blocker question (2-line clamp) | Cut mid-sentence with no way to read the rest | C4 | shots/1440x900-populated-open-light.png | P2 | argon, own | yes |
| F07 | component | Warning and success text, light theme | 3.48:1 "Needs input", 3.64:1 tile numeral, 4.17:1 "Finished" (shared tokens) | A1 | audit.json lowContrast | P2 | own, muse | yes |
| F08 | group | KPI tiles | Two tiles capped at 520px, left-aligned; Legal and Finance span full width | H5, D2, P1 | shots/1440x900-first-visit-light.png | P2 | all | yes |
| F09 | layout | 375 row list | Three label/value lines per row incl. "Pull request: —"; needs-you row ~225px | D5, D1 | shots/375x812-first-visit-light.png | P2 | argon, own | partial |
| F10 | page | Loading skeleton | Bar where no element exists; tile height mismatch; header meta missing; near invisible in dark | L5, I2, I8 | shots/1440x900-loading-light.png | P2 | muse, own | yes |
| F11 | page | Empty state | One muted line; no link to Devin | I3, C1, I8 | shots/1440x900-empty-light.png | P2 | all | yes |
| F12 | page | "Ask" in loading, empty, error, not-connected | Agent has nothing to read there | I5, C1 | four 1440 state shots | P2 | argon, own | yes |
| F13 | page | Error line and buttons | No cause named; buttons render as red text, not the app's buttons | H5, I3 | shots/1440x900-load-error-light.png | P2 | own | yes |
| F14 | component | Status pills | "Suspended" border near invisible, "Working" heavier; no dot like StatusBadge; PR state plain text | H5, C3 | refs badge_variants.png | P2 | own, muse | yes |
| F15 | page | Mobile top bar "Devin agent" above title "Devin" | Two names in first 130px (matches app pattern) | C1 | shots/375x812-first-visit-light.png | P3 | argon, own | yes |
| F16 | layout | Panel overlay at 768 and 1100 | Covers PR, Source, Updated with no scrim (matches app) | L6, P1 | shots/768x1024-populated-open-light.png | P3 | all | yes |
| F17 | component | Row affordance | Pointer cursor and hover fill, but only the title navigates; link styling inverted | I1, H5 | shots/hover-row-1440-light.png | P2 | muse, own | yes |
| F18 | component | Header meta "acme" | Unlabeled org name | C1 | shots/1440x900-first-visit-light.png | P3 | own | yes |
| F19 | page | Panel empty-thread state not drawn | Real app shows AgentPanelIntro with suggestions | I8, P1 | refs panel_intro.png | P2 | own | yes |
| F20 | component | Focus ring | No :focus-visible style; --ring unused | I7, H5 | shots/focus-1440-light.png | P3 | own | yes |
| F21 | layout | Mock presentation | Short state frames crop the sidebar; composer clipped at 1440x900; toolbar wraps at 375 (mock artifact) | L1, L2, I4 | shots/1440x900-load-error-light.png | P3 | own, argon, muse | yes |
| F22 | component | "Working" pill | Static, no activity cue | C3, H5 | shots/1440x900-populated-open-light.png | P3 | muse, own | yes |
| F23 | page | Not-connected state | Does not say the connection is read-only | I3, C1 | shots/1440x900-not-connected-light.png | P3 | muse, own | partial |

## Excellent as is

- Group order Needs you, Working, Earlier; amber confined to the needs-you tile and badges.
- Table to list at 640px page width with no overflow at any viewport.
- Page header, padding, 18px title and Ask placement match Legal; Ask hides when the panel is open.
- Docked panel matches the real shell (384px, tool disclosure, composer, overlay below 1280).
- Dark theme tokens carry over cleanly.
- Not-connected state has a single primary action.
