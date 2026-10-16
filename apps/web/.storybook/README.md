# Storybook

Run: `pnpm --filter @rakazo/web storybook` (http://localhost:6106). Build: `pnpm --filter @rakazo/web build-storybook` (output `storybook-static`, gitignored).

Stories live next to the component as `*.stories.tsx`, under `apps/web/src` or `packages/ui-web/src`. Config reuses `apps/web/vite.config.ts` (Tailwind, Lingui). The toolbar Theme switch sets `data-theme` on `<html>`, like the app.

Mocking rpc: `preview.tsx` calls `sb.mock(import("../src/lib/rpc.ts"))`, so every story gets `src/lib/__mocks__/rpc.ts`. Any `rpc.a.b(input)` call resolves to null unless the story registers a response, and responses reset before every story:

```tsx
import { mockRpc } from "../../lib/__mocks__/rpc";
export const Loaded: StoryObj = { beforeEach: () => mockRpc({ "pins.get": mockPins }) };
```

A function value receives the call's input. Shared invented data lives in `src/stories/fixtures.ts`; add to it rather than editing the mock. Every story is wrapped in Lingui's provider and a `MemoryRouter`.

Smoke test: after `build-storybook`, run `node .storybook/smoke.mjs storybook-static [path-filter]` from `apps/web`. It opens every story in headless Chromium and fails on a page error, a console error or an empty render.
