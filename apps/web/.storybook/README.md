# Storybook

Run: `pnpm --filter @rakazo/web storybook` (http://localhost:6106). Build: `pnpm --filter @rakazo/web build-storybook` (output `storybook-static`, gitignored).

Stories live next to the component as `*.stories.tsx`, under `apps/web/src` or `packages/ui-web/src`. Config reuses `apps/web/vite.config.ts` (Tailwind, Lingui). The toolbar Theme switch sets `data-theme` on `<html>`, like the app.

Mocking rpc: `preview.tsx` calls `sb.mock(import("../src/lib/rpc.ts"))`, so every story gets `src/lib/__mocks__/rpc.ts` instead of the real client. Add the calls your component makes there and keep the data invented. Import fixtures such as `mockPins` from that file in stories.
