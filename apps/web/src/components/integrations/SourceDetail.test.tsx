// @vitest-environment jsdom

import type { CapabilityInstall } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { mockIntegrations } from "../../stories/fixtures";

const caps = vi.hoisted(() => ({
  setWrites: vi.fn(),
  setExclusive: vi.fn(),
  setAllAgents: vi.fn(),
  setAgentAccess: vi.fn(),
  createAgent: vi.fn(),
  rename: vi.fn(),
  remove: vi.fn(),
}));
const navigate = vi.hoisted(() => vi.fn());
vi.mock("../../lib/rpc", () => ({ rpc: { capabilities: caps } }));
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => navigate,
}));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { SourceDetail, sourceCanWrite } from "./SourceDetail";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
window.matchMedia ??= () =>
  ({ matches: true, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList;

const container = document.createElement("div");
document.body.append(container);
const root = createRoot(container);
const refresh = vi.fn(async () => undefined);

const source = (patch: Partial<CapabilityInstall> = {}): CapabilityInstall => ({
  id: "src_1",
  kind: "api",
  name: "Contacts API",
  source: "https://api.example.test/v1",
  version: "1.0.0",
  digest: null,
  secretConfigured: false,
  config: { operations: [{ id: "add_contact", method: "POST", path: "/contacts" }] },
  createdAt: "2026-01-01T00:00:00.000Z",
  agentBotId: "bot_ada",
  allAgents: false,
  agentShared: false,
  writesEnabled: false,
  usableBotIds: ["bot_ada"],
  writeBotIds: [],
  ...patch,
});

async function show(install: CapabilityInstall) {
  const data = { ...mockIntegrations({ sources: [install] }), refresh };
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/app/integrations/source/src_1"]}>
        <Routes>
          <Route path="/app/integrations/source/:sourceId" element={<SourceDetail data={data} />} />
        </Routes>
      </MemoryRouter>,
    ),
  );
}
const press = (label: string) =>
  act(async () =>
    [...document.querySelectorAll<HTMLElement>("button")]
      .find((b) => b.textContent === label)
      ?.click(),
  );

afterEach(() => {
  for (const fn of Object.values(caps)) fn.mockReset();
  navigate.mockReset();
  act(() => root.render(null));
});

it("shows the agent link and asks before turning changes on", async () => {
  caps.setWrites.mockResolvedValue({});
  await show(source());
  expect(container.querySelector("a[href='/app/bot_ada']")).not.toBeNull();
  await act(async () => container.querySelector<HTMLElement>("#source-writes")?.click());
  expect(caps.setWrites).not.toHaveBeenCalled();
  await press("Allow changes");
  expect(caps.setWrites).toHaveBeenCalledWith({ id: "src_1", enabled: true });
});

it("shares with other agents and lists them, the owner pinned and locked", async () => {
  caps.setExclusive.mockResolvedValue({});
  await show(source());
  expect(container.textContent).not.toContain("Which agents can use this connection");
  await act(async () => container.querySelector<HTMLElement>("#source-shared")?.click());
  expect(caps.setExclusive).toHaveBeenCalledWith({ id: "src_1", exclusive: false });
  await show(source({ agentShared: true }));
  expect(container.textContent).toContain("Which agents can use this connection");
});

it("offers Create agent for a source whose agent could not be made", async () => {
  caps.createAgent.mockResolvedValue({ botId: "bot_new" });
  await show(source({ agentBotId: null }));
  await press("Create agent");
  expect(caps.createAgent).toHaveBeenCalledWith({ id: "src_1" });
  expect(navigate).toHaveBeenCalledWith("/app/bot_new");
});

it("hides Allow changes for a source with only read operations", async () => {
  const readOnly = source({
    config: { operations: [{ id: "list", method: "GET", path: "/c", readOnly: true }] },
  });
  expect(sourceCanWrite(readOnly)).toBe(false);
  expect(sourceCanWrite(source())).toBe(true);
  expect(sourceCanWrite(source({ kind: "mcp", config: {} }))).toBe(true);
  expect(
    sourceCanWrite(
      source({ kind: "graphql", config: { operations: [{ operationType: "query" }] } }),
    ),
  ).toBe(false);
  await show(readOnly);
  expect(container.querySelector("#source-writes")).toBeNull();
});

it("renames and removes", async () => {
  caps.rename.mockResolvedValue({});
  caps.remove.mockResolvedValue({ ok: true });
  await show(source());
  await press("Rename");
  const input = container.querySelector<HTMLInputElement>("input[aria-label='Name']");
  expect(input).not.toBeNull();
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, "Renamed");
    input?.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => input?.blur());
  expect(caps.rename).toHaveBeenCalledWith({ id: "src_1", name: "Renamed" });
  await press("Remove Contacts API");
  await act(async () =>
    [...document.querySelectorAll<HTMLElement>("button")]
      .filter((b) => b.textContent === "Remove Contacts API")
      .at(-1)
      ?.click(),
  );
  expect(caps.remove).toHaveBeenCalledWith({ id: "src_1" });
});
