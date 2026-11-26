// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: (parts: TemplateStringsArray) => parts[0] }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../lib/rpc", () => ({ rpc: { connections: { complete: vi.fn() } } }));

import { GoogleOAuthCallbackPage } from "./GoogleOAuthCallback";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.resetAllMocks();
});

describe("GoogleOAuthCallbackPage", () => {
  it("shows the generic cancellation message instead of callback query text", async () => {
    await act(async () =>
      root.render(
        <MemoryRouter
          initialEntries={["/oauth/google?error=access_denied&error_description=Call%20us"]}
        >
          <GoogleOAuthCallbackPage />
        </MemoryRouter>,
      ),
    );

    expect(container.textContent).not.toContain("Call us");
    expect(container.textContent).toContain("OAuth authorization was cancelled.");
  });
});
