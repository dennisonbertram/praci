// @vitest-environment jsdom
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";

const capability = vi.hoisted(() => ({ enabled: false, boardLoaded: vi.fn() }));
const session = vi.hoisted(() => ({ user: { id: "user-1" } as { id: string } | null }));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
  useLingui: () => ({ t: (parts: TemplateStringsArray) => parts.join("") }),
}));
vi.mock("./lib/bootstrap", () => ({
  getTicketBoardEnabled: () => capability.enabled,
  subscribeTicketBoardEnabled: () => () => {},
}));
vi.mock("./lib/auth", () => ({
  authClient: {
    useSession: () => ({ isPending: false, data: { user: session.user }, refetch: vi.fn() }),
  },
}));
vi.mock("./lib/remote-images-preference", () => ({
  getRemoteImagesEnabled: () => false,
  subscribeRemoteImages: () => () => {},
}));
vi.mock("./lib/performance", () => ({ markOnce: () => {}, markAfterPaint: () => {} }));
vi.mock("./lib/rpc", () => ({ rpc: {}, selectedSpaceId: () => "space-1" }));
vi.mock("./components/SubscriptionGate", () => ({
  SubscriptionGate: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("./pages/Shell", () => ({ ShellPage: () => <div>Shell</div> }));
vi.mock("./pages/Board", () => {
  capability.boardLoaded();
  return { BoardPage: () => <div>Board page</div> };
});
vi.mock("./pages/Auth", async () => {
  const { useLocation } = await import("react-router-dom");
  return {
    AuthPage: () => {
      const location = useLocation();
      return <div>{`sign-in at ${location.pathname}${location.search}`}</div>;
    },
  };
});
vi.mock("./pages/IntegrationSetup", () => ({ IntegrationSetupPage: () => null }));
vi.mock("./pages/LocalSettings", () => ({ LocalSettingsPage: () => null }));
vi.mock("./pages/McpOAuthCallback", () => ({ McpOAuthCallbackPage: () => null }));

import { App } from "./App";

i18n.loadAndActivate({ locale: "en", messages: {} });

it("opens the board inside the shell, so the sidebar stays, without App loading the board chunk", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  const root = createRoot(container);
  const render = () => (
    <MemoryRouter initialEntries={["/app/board"]}>
      <App />
    </MemoryRouter>
  );
  try {
    capability.enabled = true;
    await act(async () => {
      root.render(render());
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.textContent).toBe("Shell");
    expect(capability.boardLoaded).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount());
    capability.enabled = false;
    vi.unstubAllGlobals();
  }
});

async function renderAt(path: string): Promise<string> {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => {
      root.render(
        <I18nProvider i18n={i18n}>
          <MemoryRouter initialEntries={[path]}>
            <App />
          </MemoryRouter>
        </I18nProvider>,
      );
    });
    // Lazy pages resolve over a few ticks.
    for (let i = 0; i < 100 && !container.textContent; i++) {
      await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
    }
    return container.textContent ?? "";
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
}

it.each(["/pricing", "/app/inbox/x"])("shows Page not found at %s", async (path) => {
  const text = await renderAt(path);
  expect(text).toContain("Page not found");
  expect(text).toContain("Go to Praci");
});

it("returns a signed-out visitor to the page they asked for", async () => {
  session.user = null;
  try {
    expect(await renderAt("/app/cap-table")).toBe("sign-in at /sign-in?next=%2Fapp%2Fcap-table");
  } finally {
    session.user = { id: "user-1" };
  }
});
