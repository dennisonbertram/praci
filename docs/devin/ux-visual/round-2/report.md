# ux-visual round 2: verification of mockup v4

Counts: P0 0, P1 0, P2 4, P3 1. Decisions V1–V9 from `../problems.md`: 6 pass, 3 partial (V1, V4, V7). Screenshots in `shots/` (not committed); measurements in `audit-layout-1440.json`, `audit-geo-1440.json`; external critiques in `second-opinion.json`.

## Verification

| V | Criterion | Result | Evidence |
|---|---|---|---|
| V1 | Dialog 384px, 32px input, weight 500, 40px logo, tinted footer, blurred scrim, fits at 375 | partial | All measured equal; corner radii differ (R2-01) |
| V1 | Toast 32px circle, X on hover/focus | pass | f14-1440-light.png |
| V1 | Panel header avatar, name button, labeled close | partial | Avatar is a flat tile, not BotAvatar (R2-02) |
| V1 | Composer muted send, mic ring | pass | f2-1440-light.png |
| V1 | Sidebar dot aria-hidden plus screen-reader text | pass | DOM |
| V1 | Below 1024 top bar, 316px drawer, Close, Devin link | pass | f6-375-light.png |
| V1 | Tool rows use app phrasing | pass | toolPhrase output; real Devin tool ids unconfirmed |
| V1 | Every control tabbable with visible ring | pass | focus-row-1440-light.png |
| V2 | Key-rejected notice in ErrorNotice framing | pass | f10-1440-light.png |
| V2 | Muted rows, dot hidden, consistent times | pass | DOM; header 4m, freshest row 9m |
| V2 | Load error, no layout shift | pass | f9-1440-light.png |
| V3 | One vocabulary; tile equals group rows | pass | tile 3 = 2 Needs input + 1 Error |
| V4 | Whole row one target, full question | partial | 7 of 8 rows hit-test to the link; title link 18px tall |
| V5 | Panel states | pass | f2–f5 |
| V6 | Dialog copy and states; member frame | pass | f12, f13 |
| V7 | Toast over Inbox, hint, keyboard, real stack | partial | Stack frame wrong (R2-03) |
| V8 | Ask hidden where nothing to ask; skeleton | pass | DOM; skeleton tiles 528x88 match |
| V9 | Narrow rows, full-width tiles, overlay close, top bar | pass | f1-375-light.png |

## Findings

| id | level | element | problem | sev | by |
|---|---|---|---|---|---|
| R2-01 | component | Corner radii | Buttons, input, close use 8px; real 12px buttons/input, 10px close, 16px tiles and dialog, 10px logo tile | P2 | own |
| R2-02 | component | Panel header avatar | Flat purple "D" tile instead of BotAvatar | P2 | own |
| R2-03 | group | Stacked toast frame | Card behind is hidden; real stack shows two card edges above the front card | P2 | own, muse, argon |
| R2-04 | group | Error row in Needs you | No cause shown (GAP-26) | P2 | muse, argon |
| R2-05 | component | Focus ring | Square 2px outline; real uses rounded ring-3 ring-ring/50; row ring wraps only the title | P3 | own, argon |

## Excellent as is

Group order with full questions; 375 list; stretched row link; key-rejected state; skeleton alignment; dialog at 375; missing-agent and intro states; overlay closing and drawer; dark theme.
