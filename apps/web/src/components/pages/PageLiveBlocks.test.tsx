// @vitest-environment jsdom

import type { PageLiveBlock } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { PageLiveContext } from "../../pages/shell/page-live";
import { PageMetricBlock } from "./PageLiveBlocks";

const metric = { label: "Burn", source: "cash", path: "/burn", format: "usd" as const };

async function render(data: PageLiveBlock, extra: { onReview?: () => void } = {}) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <PageLiveContext.Provider
        value={{ loaded: true, refreshing: false, blocks: new Map(), refresh: () => {}, ...extra }}
      >
        <PageMetricBlock block={metric} data={data} />
      </PageLiveContext.Provider>,
    );
  });
  return container;
}

it("shows Paused when a paused block has no value", async () => {
  const c = await render({ status: "paused", fetchedAt: null });
  expect(c.textContent).toContain("Paused");
});

it("flags a paused block that still has a value, without Retry", async () => {
  const c = await render({
    status: "paused",
    fetchedAt: "2020-01-01T09:00:00.000Z",
    text: "$86K",
    error: "Too many failures",
  });
  const button = c.querySelector<HTMLButtonElement>('button[aria-label="Source paused"]');
  expect(button).not.toBeNull();
  await act(async () => button?.click());
  expect(document.body.textContent).toContain("Too many failures");
  expect(document.body.textContent).not.toContain("Retry");
});

it("shows the date of an old failed value without hover", async () => {
  const c = await render({
    status: "failed",
    fetchedAt: "2020-03-05T09:00:00.000Z",
    text: "$86K",
    error: "x",
  });
  expect(c.textContent).toMatch(/Mar 5/);
  expect(c.innerHTML).not.toContain("opacity-0");
});

it("lets a pending block open the review", async () => {
  const onReview = vi.fn();
  const c = await render({ status: "pending", fetchedAt: null }, { onReview });
  const link = [...c.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("Waiting for approval"),
  );
  await act(async () => link?.click());
  expect(onReview).toHaveBeenCalled();
});
