# Praci design system

This is the master reference for Praci's UI on web, Electron and mobile. It describes what exists in the repository today. The full list of components and their stories is in [components.md](components.md), which `pnpm design-system` regenerates.

## Principles

These come from the UI rules in [AGENTS.md](../../AGENTS.md).

- The app is monochrome. Primary is ink: near-black in light mode, near-white in dark mode.
- Status colors are only `destructive`, `success` and `warning` (plus `statusWorking` and `link` for in-progress and links).
- Bots carry the only identity color. Each bot gets one of the seven `botColors` in `packages/ui-tokens`.
- Every visible word is UI. Start by asking what can be removed. Reveal advanced capability only when it becomes relevant, and do not add text that repeats the interface.
- Frontends express intent and render state. The backend owns orchestration, validation, retries and provider translation.
- Colors are semantic tokens. Never hardcode a product hex and never use `[var(--...)]` arbitrary values.

## Tokens

The single source is `packages/ui-tokens/src/index.ts` (`lightTokens`, `darkTokens`, `RADIUS`, `botColors`). `pnpm --filter @rakazo/ui-tokens generate` writes `packages/ui-tokens/src/tokens.css`, which web and Electron load through `@rakazo/ui-web/styles.css`. Mobile reads the same TypeScript objects through `apps/mobile/lib/appearance`. Dark is the default; `data-theme="light"` or `"dark"` on `<html>` switches themes.

To add a token:

1. Add the name to the `ColorTokens` type and a value to both `lightTokens` and `darkTokens` in `packages/ui-tokens/src/index.ts`.
2. Run `pnpm --filter @rakazo/ui-tokens generate`.
3. Map it in `packages/ui-web/src/styles.css` (`@theme inline`) so Tailwind exposes `bg-<name>` and `text-<name>`.
4. Add it to a group in `scripts/design-system.mjs`, then run `pnpm design-system`. The script fails if a token has no group.

The tables below are generated from `tokens.css`.

<!-- tokens:start -->
### Surfaces

Page and container backgrounds with their text.

| Token | CSS variable | Light | Dark |
| --- | --- | --- | --- |
| `background` | `--background` | `#fafaf8` | `#1c1c1a` |
| `foreground` | `--foreground` | `#1a1a1a` | `#ecebe6` |
| `card` | `--card` | `#ffffff` | `#252523` |
| `cardForeground` | `--card-foreground` | `#1a1a1a` | `#ecebe6` |
| `popover` | `--popover` | `#ffffff` | `#252523` |
| `popoverForeground` | `--popover-foreground` | `#1a1a1a` | `#ecebe6` |

### Action

Ink primary for the main action; secondary for quieter fills.

| Token | CSS variable | Light | Dark |
| --- | --- | --- | --- |
| `primary` | `--primary` | `#1a1a1a` | `#f1f0eb` |
| `primaryForeground` | `--primary-foreground` | `#f1f1ef` | `#1c1c1a` |
| `secondary` | `--secondary` | `#f0f0ed` | `#282826` |
| `secondaryForeground` | `--secondary-foreground` | `#1a1a1a` | `#ecebe6` |

### Quiet and hover

De-emphasized text, fills and hover states.

| Token | CSS variable | Light | Dark |
| --- | --- | --- | --- |
| `muted` | `--muted` | `#f0f0ed` | `#252523` |
| `mutedForeground` | `--muted-foreground` | `#6c6c70` | `#9c9a93` |
| `accent` | `--accent` | `#eaeae6` | `#2a2927` |
| `accentForeground` | `--accent-foreground` | `#1a1a1a` | `#ecebe6` |

### Lines and focus

Borders, input fills and the focus ring.

| Token | CSS variable | Light | Dark |
| --- | --- | --- | --- |
| `border` | `--border` | `#f0f0ed` | `#2e2d2a` |
| `input` | `--input` | `#c8c8c4` | `#4a4944` |
| `ring` | `--ring` | `#6c6c70` | `#3b82f6` |

### Status

The only color outside ink: destructive, success, warning, working, links.

| Token | CSS variable | Light | Dark |
| --- | --- | --- | --- |
| `destructive` | `--destructive` | `#dc2626` | `#f46262` |
| `destructiveForeground` | `--destructive-foreground` | `#ffffff` | `#1c1c1a` |
| `success` | `--success` | `#228b3b` | `#4ecb71` |
| `warning` | `--warning` | `#b7791f` | `#e9c46a` |
| `statusWorking` | `--status-working` | `#2563eb` | `#4f8ff7` |
| `link` | `--link` | `#2563eb` | `#4f8ff7` |

### Chat

The user's message bubble and link favicon backing.

| Token | CSS variable | Light | Dark |
| --- | --- | --- | --- |
| `chatUser` | `--chat-user` | `#e2e2dc` | `#33322f` |
| `chatUserForeground` | `--chat-user-foreground` | `#1a1a1a` | `#ecebe6` |
| `faviconPlate` | `--favicon-plate` | `#ffffff` | `#ffffff` |

### Sidebar

Navigation rail.

| Token | CSS variable | Light | Dark |
| --- | --- | --- | --- |
| `sidebar` | `--sidebar` | `#ecece9` | `#222220` |
| `sidebarForeground` | `--sidebar-foreground` | `#1a1a1a` | `#ecebe6` |
| `sidebarBorder` | `--sidebar-border` | `#e8e8e4` | `#2a2926` |
| `sidebarAccent` | `--sidebar-accent` | `#ffffff` | `#2a2927` |
| `sidebarAccentForeground` | `--sidebar-accent-foreground` | `#1a1a1a` | `#ecebe6` |

### Overlay and scrollbar

Modal scrim and scrollbar thumb.

| Token | CSS variable | Light | Dark |
| --- | --- | --- | --- |
| `overlay` | `--overlay` | `rgba(20, 20, 22, 0.45)` | `rgba(8, 8, 7, 0.72)` |
| `scrollbar` | `--scrollbar` | `#c8c8c4` | `#2e2d2a` |
| `scrollbarHover` | `--scrollbar-hover` | `#a8a8a4` | `#45443f` |
<!-- tokens:end -->

Radius: `--radius` is `0.75rem`. Tailwind's `rounded-sm`, `-md`, `-lg`, `-xl` and `-2xl` are derived from it in `packages/ui-web/src/styles.css` (radius minus 4px, minus 2px, equal, plus 4px, plus 8px).

## Typography, spacing and radius in use

These are counts of Tailwind classes across `apps/web/src` and `packages/ui-web/src`. They describe current practice, not a separate rule set.

- Font: Geist Variable, set in `apps/web/src/styles.css`, with system sans fallbacks.
- Size: `text-sm` (255 uses) is the body size and `text-xs` (114) the secondary size. Larger sizes are rare: `text-lg` (13), `text-base` (12), `text-xl` (10), `text-2xl` (7).
- Weight: `font-medium` (139) and `font-semibold` (72) for emphasis, `font-mono` (18) for code and identifiers.
- Spacing: gaps are mostly `gap-2` (178) and `gap-3` (130); padding is mostly `px-3`, `px-2.5`, `px-4`, `py-1` and `py-2`.
- Radius: `rounded-full` (141) for avatars and pills, `rounded-xl` (85) for cards, `rounded-lg` (83) for controls, `rounded-md` (28) and `rounded-2xl` (19) for smaller and larger surfaces.

## Primitives

`packages/ui-web/src/components/ui` holds the shadcn components on Base UI, added with `pnpm exec shadcn add` from the official registry only. Each has a story next to it except `native-select`. Reuse these before writing chrome by hand.

| Component | Use it for |
| --- | --- |
| `button` | Every clickable action. Variants and sizes are in `button.stories.tsx`. |
| `input`, `textarea`, `input-group` | Text entry. `input-group` adds leading or trailing add-ons. |
| `field`, `label` | Label, control and error text for a form row. |
| `select`, `native-select` | A styled listbox, or the browser's own `<select>` where a native control is better (no story yet). |
| `checkbox`, `switch`, `toggle` | Boolean choices. Use `switch` for settings that apply immediately. |
| `dialog` | Modal content the user fills in or reads. |
| `alert-dialog` | Confirming a destructive or irreversible action. |
| `popover`, `dropdown-menu`, `command`, `tooltip` | Floating content, action menus, searchable pickers and short hints. |
| `tabs`, `separator`, `scroll-area` | Switching sections, dividing content and custom scrolling. |
| `card` | A bordered surface with header, content and footer. |
| `badge`, `kbd` | Small status labels and keyboard hints. |
| `skeleton`, `spinner` | Loading placeholders and progress. |

## Patterns

- AI moments: `apps/web/src/components/ai/primitives.tsx` provides `Shimmer`, `LoadingState`, `SuccessPop` and `BuiCard`; `CollaborationMarker.tsx` provides the active-bot marker. Use these for loading, working and success states instead of new animations. Stories: [primitives.stories.tsx](../../apps/web/src/components/ai/primitives.stories.tsx), [CollaborationMarker.stories.tsx](../../apps/web/src/components/ai/CollaborationMarker.stories.tsx).
- Cards and KPI tiles: `card` for the generic surface; `Kpi`, `Section` and `BreakdownRows` in `apps/web/src/components/finance/ui.tsx` for figures with a label and a sub-line. Chat cards live in [AskCard.stories.tsx](../../apps/web/src/components/AskCard.stories.tsx) and [FinanceCards.stories.tsx](../../apps/web/src/components/FinanceCards.stories.tsx). Stories: [finance/ui.stories.tsx](../../apps/web/src/components/finance/ui.stories.tsx).
- Dialogs: build on `dialog` and `alert-dialog`. Examples: [AddAccountDialog.stories.tsx](../../apps/web/src/components/finance/AddAccountDialog.stories.tsx), [InboxMessageDialog.stories.tsx](../../apps/web/src/components/inbox/InboxMessageDialog.stories.tsx).
- Empty and error states: keep them to one short line with a single action. Examples: [ComputersUnavailableHint.stories.tsx](../../apps/web/src/components/ComputersUnavailableHint.stories.tsx), [ErrorBoundary.stories.tsx](../../apps/web/src/components/ErrorBoundary.stories.tsx), and `ErrorNotice` in `finance/ui.tsx`.
- Lists: rows with one primary line and muted secondary text. Example: [InboxRow.stories.tsx](../../apps/web/src/components/inbox/InboxRow.stories.tsx).

## Mobile

Mobile is native-first: Expo Router, Expo UI, and native sheets, menus, alerts, pickers and switches wherever one exists. On iOS, prefer built-in controls (`@expo/ui` SwiftUI, Liquid Glass, native header items) over custom React Native buttons or pills.

- Custom surfaces (thread, composer, avatars, cards) use plain `StyleSheet` with the shared tokens through `apps/mobile/lib/appearance.ts`.
- System chrome uses `PlatformColor` through `apps/mobile/lib/native.ts` (the `native` color object and `useThemedStyles`).
- Mobile may differ from web when the native pattern is better.
- The iOS Liquid Glass design boards, page designs and page rules, including iPhone Duo layouts, are in [ios/README.md](ios/README.md).
- Native stories are pending. Storybook runs only web components, so mobile components appear in [components.md](components.md) as "mobile — native story pending".

## Workflow

1. Find the component in Storybook (`pnpm --filter @rakazo/web storybook`, see [the Storybook README](../../apps/web/.storybook/README.md)).
2. Reuse it.
3. If it is missing, build it as a story first.
4. Then use it in the app.
5. Run `pnpm design-system` to update the catalog.

CI runs `pnpm design-system:check`. It fails when a web or shared component file has no stories, or when `components.md` or the token tables above are out of date.

Catalog: [components.md](components.md).
