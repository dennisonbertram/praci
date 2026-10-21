# ux-visual round 1: Devin agent panel, connect dialog, toast, sidebar (mockup v3)

Inspector compared each mockup part with the real component in Storybook (`real-*.png` in `shots/`, not committed) at 1440x900, 1920x1080, 768x1024 and 375x812, light and dark. Second opinions: meta/muse-wonder and google/gemini-4-argon (`second-opinion.json`). Measurements in `audit.json`.

Counts: 25 findings. P0 0, P1 4, P2 13, P3 8. By level: component 15, group 6, layout 3, page 1.

Rejected external claims: mockup captions "leak into the product" (they are outside the frames); "Key name field deleted" (Devin needs one field); user bubble contrast 3.9:1 (#111 on #9B5CF6 is ~4.7:1); "3 tools but 2 rows" (×2 collapses repeats like the real ×3); table clipped at 375 (fixed-width frame artifact); dark bubbles "collapse into grey" (real tokens). Dark low-contrast hits in `audit.json` are false positives.

## Findings

| id | level | element | problem | sev | by |
|---|---|---|---|---|---|
| F01 | layout | Connect dialog at 375 | 440px wide; right edge 456px; Connect button cut off. Real dialog stacks buttons and fits | P1 | own, argon, muse |
| F02 | component | Dialog states | No rejected-key, submitting or disabled-Connect state; real shows "The key was refused" under the field | P1 | own, muse |
| F03 | component | Dialog description | Still says "org-scoped Devin service-user key (starts with cog_)", contrary to ux-flow proposal 5 | P2 | own, muse |
| F04 | component | Dialog sizing and tokens | Real: 384px, 32px input with 12px radius and 14px text, 12px button radius, title weight 500, 40px logo tile, tinted full-bleed footer, blurred scrim; mockup differs on each | P2 | own, argon |
| F05 | component | "Where to find your key" | External link rendered as muted static text (same in real) | P3 | all |
| F06 | layout | Dialog frame | Drawn as a banner above the page, not an overlay on the shell | P3 | own, argon |
| F07 | component | Masked key field | No reveal control (same in real) | P3 | all |
| F08 | group | Drawer below 1024 | No drawer drawn; hamburger inert; Devin link and dot unreachable at 768/375. Real: 316px drawer with scrim and Close | P1 | own |
| F09 | group | Needs-you dot at narrow widths | No home below 1024; hamburger has no dot (real app has the same gap) | P2 | own |
| F10 | component | Narrow top bar label | Invented "[D] Devin agent" label; real page-mode top bar has only the hamburger | P2 | own, argon |
| F11 | group | Panel states | Only a populated thread is drawn; first Ask (intro with suggestions), running turn, failed tool, send error, agent missing are not | P1 | all |
| F12 | component | Tool row labels | "Session search", "Session get messages ×2" read like tool names; real rows read "Checked active integration", "Mail search" | P2 | all |
| F13 | component | Panel header | Letter tile and plain-text name; close is an unlabeled, unfocusable span. Real: generated avatar, name is a button, labeled close | P2 | own, muse |
| F14 | component | "Open in Devin" links in bubbles | No external glyph; same text for two sessions | P2 | all |
| F15 | group | Touch targets at 768/375 | Close 28px, composer buttons 32px, links 21px (same sizes in real) | P2 | own, muse |
| F16 | component | Composer vs transcript edges | 4px offset each side (same in real) | P3 | own |
| F17 | component | Composer send and mic | Empty send arrow ~1.6:1 in dark; looks enabled in light; mic lacks the real ring | P3 | all |
| F18 | component | Toast anatomy | Purple 22px tile and always-visible X; real uses a 32px dark circle and hover/focus X | P2 | all |
| F19 | component | Toast click target | Nothing on the toast says it opens Devin outside the app | P2 | all |
| F20 | group | Toast keyboard and stacking | Not focusable; X unlabeled; no "+N" stack | P2 | own |
| F21 | component | Toast time vs row | Toast "now" vs row "12m ago" in the same frame | P3 | argon |
| F22 | component | Sidebar dot accessible name | aria-label on a role-less span; real uses aria-hidden plus screen-reader text | P2 | own |
| F23 | group | Sidebar glance context | Real sidebar shows other rows' glance values; mockup only Devin's dot | P3 | own |
| F24 | layout | Overlay panel at 1100/768/375 | Only exit is a 28px glyph; no scrim, outside-click or Escape spec | P2 | all |
| F25 | page | Frames at narrow widths | Toast and dialog frames ignore the width switcher | P3 | own |

## Excellent as is

- Docked panel geometry (384px, 44px header, ~52px composer pill).
- Bubble anatomy (20px radius, 18/12px padding, 15.5px text, 24px gap).
- Tool disclosure typography and chevron.
- Sidebar link row (50px pitch, 30px tile, 8px dot).
- The labeled "API key" field.
- Toast width (448px) and 88px bottom offset.
