// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

const limits = vi.hoisted(() => vi.fn());
vi.mock("../../lib/rpc", () => ({ rpc: { brexCards: { limits } } }));
vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { BrexLimits } from "./BrexLimits";
import { limitsFixture } from "./fixtures";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function mount(path = "/app/brex/limits") {
  limits.mockResolvedValue({
    ...limitsFixture,
    limits: [{ ...limitsFixture.limits[0], name: "Cloud year", percent: 212 }],
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <BrexLimits />
      </MemoryRouter>,
    ),
  );
  await act(async () => {});
}

it("hides Members on phones and marks an overspent limit red", async () => {
  await mount();
  const members = [...container.querySelectorAll("th")].find((th) => th.textContent === "Members");
  expect(members?.className).toContain("hidden");
  expect(members?.className).toContain("@lg:table-cell");
  expect(container.querySelector("tbody td span.h-full")?.className).toContain("bg-destructive");
});

it("filters on ?q= from the URL", async () => {
  await mount("/app/brex/limits?q=nomatch");
  expect(container.textContent).toContain("No matches");
});

it("finds an unnamed limit by the id the Overview links with", async () => {
  const id = limitsFixture.limits[0]?.spendLimitId ?? "missing-fixture";
  await mount(`/app/brex/limits?q=${encodeURIComponent(id)}`);
  expect(container.textContent).not.toContain("No matches");
});
