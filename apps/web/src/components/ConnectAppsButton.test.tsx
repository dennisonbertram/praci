// @vitest-environment jsdom

import type { ConnectionCatalogItem } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const connections = vi.hoisted(() => ({ catalog: vi.fn(), list: vi.fn() }));
vi.mock("../lib/rpc", () => ({ rpc: { connections } }));

import { ConnectAppsButton } from "./ConnectAppsButton";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const app = (slug: string, connectorId = "composio"): ConnectionCatalogItem => ({
  connectorId,
  slug,
  name: slug,
  logo: `https://logos.example.test/${slug}.svg`,
  connected: false,
  noAuth: false,
  description: null,
  category: "other",
});
const catalog = ["gmail", "slack", "notion", "googledrive", "figma"].map((slug) => app(slug));

async function render() {
  const container = document.createElement("div");
  document.body.append(container);
  const onClick = vi.fn();
  const root = createRoot(container);
  const show = (active: boolean) =>
    act(async () => root.render(<ConnectAppsButton active={active} onClick={onClick} />));
  await show(false);
  return { container, onClick, show };
}
const row = (c: HTMLElement) =>
  c.querySelector<HTMLButtonElement>("[data-testid=sidebar-integrations]");

beforeEach(() => {
  document.body.innerHTML = "";
  connections.catalog.mockResolvedValue(catalog);
  connections.list.mockResolvedValue([]);
});

it("shows the pill with three featured logos and navigates on click", async () => {
  const { container, onClick } = await render();
  expect(row(container)?.textContent).toBe("Connect apps");
  expect(container.querySelectorAll("[data-testid=app-logo]")).toHaveLength(3);
  row(container)?.click();
  expect(onClick).toHaveBeenCalledOnce();
});

it("shows the plain row when every featured app is connected", async () => {
  connections.list.mockResolvedValue(
    ["gmail", "slack", "notion", "googledrive"].map((slug) => ({
      connectorId: "composio",
      provider: slug,
      status: "connected",
    })),
  );
  const { container } = await render();
  expect(row(container)?.textContent).toBe("Integrations");
});

it("shows the plain row on RPC failure", async () => {
  connections.catalog.mockRejectedValue(new Error("down"));
  const { container } = await render();
  expect(row(container)?.textContent).toBe("Integrations");
});

it("shows the plain row while loading", async () => {
  connections.catalog.mockReturnValue(new Promise(() => {}));
  const { container } = await render();
  expect(row(container)?.textContent).toBe("Integrations");
});

it("leaves out Gmail when native Google Gmail is connected", async () => {
  connections.catalog.mockResolvedValue([app("gmail", "google"), ...catalog]);
  connections.list.mockResolvedValue([
    { connectorId: "google", provider: "gmail", status: "connected" },
  ]);
  const { container } = await render();
  const names = [...container.querySelectorAll("[data-testid=app-logo]")].map((el) => el.outerHTML);
  expect(names.join("")).not.toContain("gmail");
  expect(container.querySelectorAll("[data-testid=app-logo]")).toHaveLength(3);
});

it("shows the plain Integrations row, not the pill, while active", async () => {
  const { container, show } = await render();
  expect(row(container)?.textContent).toBe("Connect apps");
  await show(true);
  expect(row(container)?.textContent).toBe("Integrations");
  expect(row(container)?.getAttribute("aria-current")).toBe("page");
});

it("keeps apps with pending or failed connections in the pill", async () => {
  connections.list.mockResolvedValue(
    ["gmail", "slack", "notion", "googledrive"].map((slug, i) => ({
      connectorId: "composio",
      provider: slug,
      status: ["error", "pending", "connected", "connected"][i],
    })),
  );
  const { container } = await render();
  const html = [...container.querySelectorAll("[data-testid=app-logo]")]
    .map((el) => el.outerHTML)
    .join("");
  expect(html).toContain("gmail");
  expect(html).toContain("slack");
  expect(html).not.toContain("notion");
});
