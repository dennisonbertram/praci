# Storybook

Run: `pnpm --filter @rakazo/web storybook` (http://localhost:6106). Build: `pnpm --filter @rakazo/web build-storybook` (output `storybook-static`, gitignored).

Stories live next to the component as `*.stories.tsx`, under `apps/web/src` or `packages/ui-web/src`. Config reuses `apps/web/vite.config.ts` (Tailwind, Lingui). The toolbar Theme switch sets `data-theme` on `<html>`, like the app.

Mocking rpc: `preview.tsx` calls `sb.mock(import("../src/lib/rpc.ts"))`, so every story gets `src/lib/__mocks__/rpc.ts`. Any `rpc.a.b(input)` call resolves to null unless the story registers a response, and responses reset before every story:

```tsx
import { mockRpc } from "../../lib/__mocks__/rpc";
export const Loaded: StoryObj = { beforeEach: () => mockRpc({ "pins.get": mockPins }) };
```

A function value receives the call's input. Always import `mockRpc` from `src/lib/__mocks__/rpc`; do not wrap it.

Shared helpers:
- `src/stories/fixtures/` has invented data by domain (`bots`, `users`, `models`, `integrations`, `images`), re-exported from `index.ts`. `makeBot(overrides)` builds every bot; add a variant only when a story needs different data.
- `src/stories/decorators.tsx` has `withPageBehind(label?)` for dialogs (they render in a portal, so the story root would be empty) and `withVisibleRoot(message)` for components that render null.
- `.storybook/stubs.ts` is imported first by `preview.tsx`. It answers the auth session request and replaces remote image URLs with an empty data URI, so stories need no network and logos show their letter fallback. Stories do not stub either themselves.

Every story is wrapped in Lingui's provider and a `MemoryRouter`. Set `parameters: { initialEntries: ["/path?x=1"] }` to start it at another URL (the OAuth callback pages read query params).

Smoke test: after `build-storybook`, run `node .storybook/smoke.mjs storybook-static [path-filter]` from `apps/web`. It opens every story in headless Chromium and fails on a page error, a console error or an empty render.
