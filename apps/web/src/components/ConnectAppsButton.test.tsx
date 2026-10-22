// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: (s: TemplateStringsArray) => s.join("") }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { ConnectAppsButton } from "./ConnectAppsButton";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("is a plain row with no app logos, so nothing reads as connected", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const onClick = vi.fn();
  const root = createRoot(container);
  await act(async () => root.render(<ConnectAppsButton active={false} onClick={onClick} />));
  const row = container.querySelector<HTMLButtonElement>("[data-testid=sidebar-integrations]");
  expect(row?.textContent).toBe("Integrations");
  expect(container.querySelectorAll("[data-testid=app-logo]")).toHaveLength(0);
  row?.click();
  expect(onClick).toHaveBeenCalledOnce();
  await act(async () => root.render(<ConnectAppsButton active onClick={onClick} />));
  expect(row?.getAttribute("aria-current")).toBe("page");
});
