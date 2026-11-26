// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { overviewFixture } from "./fixtures";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@lingui/core/macro", () => ({
  t: String.raw,
  plural: (count: number, forms: { one: string; other: string }) =>
    (count === 1 ? forms.one : forms.other).replaceAll("#", String(count)),
}));

import { BrexOverview } from "./BrexOverview";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function linkOf(title: string) {
  const heading = [...container.querySelectorAll("h2")].find((h) => h.textContent === title);
  return heading?.closest("a") ?? null;
}

it("names the Sankey period and links the Cash and Active cards figures", async () => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <BrexOverview data={overviewFixture} />
      </MemoryRouter>,
    ),
  );
  const titles = [...container.querySelectorAll("h2")].map((h) => h.textContent);
  expect(titles).toContain("Where spend goes, last 90 days");
  expect(linkOf("Cash")?.getAttribute("href")).toMatch(/\/app\/brex\/accounts$/);
  expect(linkOf("Active cards")?.getAttribute("href")).toMatch(/\/app\/brex\/cards$/);
  expect(linkOf("Card spend")?.getAttribute("href")).toMatch(/\/app\/brex\/spending$/);
  expect(linkOf("Near limit")?.getAttribute("href")).toMatch(/\/app\/brex\/limits$/);
});

it("opens a near-limit row on its limit, or on Cards for a card", async () => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const data = {
    ...overviewFixture,
    nearLimit: {
      ...overviewFixture.nearLimit,
      items: [
        {
          kind: "spend_limit" as const,
          id: "l1",
          name: "Cloud year",
          usedCents: 1,
          limitCents: 1,
          percent: 212,
        },
        {
          kind: "card" as const,
          id: "c1",
          name: "Ops card",
          usedCents: 1,
          limitCents: 1,
          percent: 90,
        },
      ],
    },
  };
  await act(async () =>
    root.render(
      <MemoryRouter>
        <BrexOverview data={data} />
      </MemoryRouter>,
    ),
  );
  const hrefOf = (text: string) =>
    [...container.querySelectorAll("a")]
      .find((a) => a.textContent?.includes(text))
      ?.getAttribute("href");
  expect(hrefOf("Cloud year")).toBe("/app/brex/limits?q=Cloud%20year");
  expect(hrefOf("Ops card")).toBe("/app/brex/cards");
  const bars = container.querySelectorAll("a span.h-full");
  expect(bars[0]?.className).toContain("bg-destructive");
  expect(bars[1]?.className).toContain("bg-warning");
});
