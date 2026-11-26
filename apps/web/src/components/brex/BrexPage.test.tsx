// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const overview = vi.hoisted(() => vi.fn());
const limits = vi.hoisted(() => vi.fn());
vi.mock("../../lib/rpc", () => ({
  rpc: { brexCards: { overview, limits } },
}));
vi.mock("../integrations/BrexCardsConnectDialog", () => ({
  BrexCardsConnectDialog: ({ mode, onConnected }: { mode?: string; onConnected?: () => void }) => (
    <button type="button" data-mode={mode} onClick={() => onConnected?.()}>
      Dialog saved
    </button>
  ),
}));
vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
  plural: (n: number, forms: { one: string; other: string }) =>
    forms[n === 1 ? "one" : "other"].replace("#", String(n)),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
  }),
}));

import { BrexPage } from "./BrexPage";
import { limitsFixture, overviewFixture } from "./fixtures";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const flush = () => act(async () => {});
const hasTab = (name: string) =>
  [...container.querySelectorAll('[role="tab"]')].some((tab) => tab.textContent === name);

async function mount(path: string) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <BrexPage />
      </MemoryRouter>,
    ),
  );
  await flush();
}

beforeEach(() => {
  overview.mockReset();
  limits.mockReset();
  limits.mockResolvedValue(limitsFixture);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
});

it("keeps the tabs and the Limits tab working when the overview fails", async () => {
  overview.mockRejectedValue(Object.assign(new Error("Bad gateway"), { code: "BAD_GATEWAY" }));
  await mount("/app/brex/limits");
  expect(hasTab("Limits")).toBe(true);
  expect(container.textContent).toContain(limitsFixture.limits[0]?.name);
});

it("shows the overview error and Try again inside the Overview tab, with the tabs still there", async () => {
  overview.mockRejectedValue(Object.assign(new Error("Bad gateway"), { code: "BAD_GATEWAY" }));
  await mount("/app/brex");
  expect(hasTab("Overview")).toBe(true);
  expect(container.textContent).toContain("Try again");
});

it("keeps the tabs while Try again reloads the overview", async () => {
  overview.mockRejectedValueOnce(new Error("Bad gateway"));
  await mount("/app/brex");
  overview.mockReturnValue(new Promise(() => {}));
  const retry = [...container.querySelectorAll("button")].find(
    (b) => b.textContent === "Try again",
  );
  await act(async () => retry?.click());
  expect(hasTab("Overview")).toBe(true);
});

it("shows the not-connected state without tabs when Brex answers NOT_FOUND", async () => {
  overview.mockRejectedValue(Object.assign(new Error("Not connected"), { code: "NOT_FOUND" }));
  await mount("/app/brex");
  expect(container.textContent).toContain("Brex isn't connected.");
  expect(container.querySelector('[role="tablist"]')).toBeNull();
});

const rejected = () =>
  Object.assign(new Error("Brex rejected this token"), { code: "BREX_TOKEN_REJECTED" });
const button = (name: string) =>
  [...container.querySelectorAll("button")].find((b) => b.textContent === name);

it("offers Replace token instead of Try again when Brex rejected the token, on the Overview", async () => {
  overview.mockRejectedValueOnce(rejected());
  await mount("/app/brex");
  expect(container.textContent).toContain("Brex rejected this token");
  expect(button("Try again")).toBeUndefined();
  await act(async () => button("Replace token")?.click());
  expect(button("Dialog saved")?.dataset.mode).toBe("replace");
  overview.mockResolvedValue(overviewFixture);
  await act(async () => button("Dialog saved")?.click());
  expect(overview).toHaveBeenCalledTimes(2);
  expect(button("Replace token")).toBeUndefined();
});

it("offers Replace token in a section tab and reloads that tab once the token is replaced", async () => {
  overview.mockResolvedValue(overviewFixture);
  limits.mockRejectedValueOnce(rejected());
  await mount("/app/brex/limits");
  expect(button("Try again")).toBeUndefined();
  await act(async () => button("Replace token")?.click());
  await act(async () => button("Dialog saved")?.click());
  expect(limits).toHaveBeenCalledTimes(2);
  expect(container.textContent).toContain(limitsFixture.limits[0]?.name);
});

it("keeps Try again for a tab error that is not a rejected token", async () => {
  overview.mockResolvedValue(overviewFixture);
  limits.mockRejectedValueOnce(Object.assign(new Error("Bad gateway"), { code: "BAD_GATEWAY" }));
  await mount("/app/brex/limits");
  expect(button("Try again")).toBeDefined();
  expect(button("Replace token")).toBeUndefined();
});

it("reloads the Overview too when the token is replaced from a tab", async () => {
  overview.mockRejectedValueOnce(rejected());
  limits.mockRejectedValueOnce(rejected());
  await mount("/app/brex/limits");
  await act(async () => button("Replace token")?.click());
  overview.mockResolvedValue(overviewFixture);
  await act(async () => button("Dialog saved")?.click());
  expect(overview).toHaveBeenCalledTimes(2);
});
