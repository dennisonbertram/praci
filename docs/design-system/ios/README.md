# iOS design system (Liquid Glass)

Design source for the Rakazo iOS app in Apple's Liquid Glass style, including the iPhone Duo outer and inner displays. These are design boards, not shipped code. The tokens in `@rakazo/ui-tokens` stay the single source of truth for color; the boards only apply them.

The boards are `.dc.html` design-canvas files. They load the canvas runtime (`support.js`), so open them in the design canvas rather than directly in a browser. `canvas.json` holds the board layout.

## Contents

| Folder | What it holds |
| --- | --- |
| `boards/DS-01-Foundations.dc.html` | Color tokens (dark and light), glass materials and their SwiftUI equivalents, layers, type scale, spacing, radii, icons with SF Symbol names, device canvases, motion |
| `boards/DS-02-Controls.dc.html` | Buttons, icon buttons, switch, segmented control, menu picker, slider, stepper, label chips, text and search fields |
| `boards/DS-03-Navigation.dc.html` | Side toolbar (outer display), horizontal toolbar, glass title, large title with search, inner-display sidebar, split views and the fold, tab bar (not adopted), sheet header |
| `boards/DS-04-Overlays.dc.html` | Sheets, alerts, action sheets, context and pull-down menus, popovers, toasts, search overlay, pickers, placement around the fold |
| `boards/DS-05-Lists.dc.html` | Mail, bot, group, activity and settings rows, swipe actions, section headers, empty and loading states |
| `boards/DS-06-Chat.dc.html` | Bubbles, markdown, tool-call labels, working indicator, composer, mail/tool/ask approval cards, voice player, pins |
| `boards/DS-07-Domain.dc.html` | Bot avatars (the eight shipped shapes), Finance, Legal, Cap table, Data room, Artifacts, integrations, Team Computer, calls |
| `boards/PG-A-*.dc.html` | Core pages on the outer display: Home, inbox message, thread, group thread, agent page, agent list, Team Computer, routine, artifacts, artifact, image |
| `boards/PG-B-*.dc.html` | Secondary pages: settings, models, voice, integrations, creation sheets, sign-in, server, Finance, Legal, Cap table, Data room |
| `boards/PG-A-Rules.dc.html`, `boards/PG-B-Rules.dc.html` | How to generate any page, then one rule card per page: outer, inner ⅓ + ⅔, half-folded ½ + ½ and laptop recipes, states, glass decisions, the one prominent action |
| `boards/Main`, `Sheet`, `Split`, `Inner`, `Desk` | iPhone Duo mockups: outer Home and Inbox, inner sidebar + Inbox, half-folded Inbox + Inbox agent, laptop pose Finance |

## Rules in short

- Glass is only the floating layer for navigation and controls. Lists, cards, bubbles and buttons inside cards are content and use solid fills.
- Group toolbar items in separate glass capsules, at most three groups, with one tinted prominent action per view.
- Corners are concentric: inner radius equals outer radius minus the inset.
- Every bot uses its own shipped avatar shape (`packages/core/src/bot-avatar-shapes.ts`) and bot color. Integration agents use a letter tile.
- iPhone Duo outer display (466×678 pt): bars run down the side strip next to the Dynamic Island. Inner display held as a book (890×626 pt): vertical fold, ⅓ + ⅔ when flat, ½ + ½ when half-folded, nothing interactive in the fold. Laptop pose (626×890 pt): view on the top half, controls on the bottom half.
- Every page keeps the same features and state on every display. The inner display adds one level of hierarchy, usually the sidebar.

## Estimates

Apple publishes pixel sizes for iPhone Duo but not point sizes, corner radius, fold width or the Dynamic Island position. The point sizes here are the panel resolution divided by 3, and the other values are marked "est." on the boards. Board heights were set by hand and may need trimming after review.
