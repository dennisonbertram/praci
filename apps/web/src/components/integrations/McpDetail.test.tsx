// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { mockIntegrations, mockServer } from "../../stories/fixtures";

const setWrites = vi.hoisted(() => vi.fn());
vi.mock("../../lib/rpc", () => ({ rpc: { mcp: { servers: { setWrites } } } }));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { McpDetail } from "./McpDetail";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

window.matchMedia ??= () =>
  ({ matches: true, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList;

const container = document.createElement("div");
document.body.append(container);
const root = createRoot(container);
const refresh = vi.fn();

async function show(writesEnabled: boolean, endpoint = "https://mcp.app.carta.com/mcp") {
  const data = {
    ...mockIntegrations({ servers: [mockServer("s1", "Carta", { endpoint, writesEnabled })] }),
    refresh,
  };
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/app/integrations/mcp/s1"]}>
        <Routes>
          <Route path="/app/integrations/mcp/:serverId" element={<McpDetail data={data} />} />
        </Routes>
      </MemoryRouter>,
    ),
  );
}
const writesSwitch = () => container.querySelector<HTMLElement>("#carta-writes");
const press = (label: string) =>
  act(async () =>
    [...document.querySelectorAll<HTMLElement>("button")]
      .find((b) => b.textContent === label)
      ?.click(),
  );

afterEach(() => {
  setWrites.mockReset();
  act(() => root.render(null));
});

it("asks before turning Carta changes on, then saves", async () => {
  setWrites.mockResolvedValue({});
  await show(false);
  await act(async () => writesSwitch()?.click());
  expect(setWrites).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain(
    "The Carta agent will be able to change your Carta data. It asks before each change.",
  );
  await press("Allow changes");
  expect(setWrites).toHaveBeenCalledWith({ id: "s1", enabled: true });
  expect(refresh).toHaveBeenCalled();
});

it("cancelling the confirmation changes nothing", async () => {
  await show(false);
  await act(async () => writesSwitch()?.click());
  await press("Cancel");
  expect(setWrites).not.toHaveBeenCalled();
});

it("turns Carta changes off without a confirmation", async () => {
  setWrites.mockResolvedValue({});
  await show(true);
  await act(async () => writesSwitch()?.click());
  expect(setWrites).toHaveBeenCalledWith({ id: "s1", enabled: false });
  expect(document.body.textContent).not.toContain("It asks before each change");
});

it("has no switch on other servers", async () => {
  await show(false, "https://mcp.example.com/sse");
  expect(writesSwitch()).toBeNull();
});
