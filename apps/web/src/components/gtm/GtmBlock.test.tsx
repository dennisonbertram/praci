// @vitest-environment jsdom
import type { GtmOverview, GtmPageBlock } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../../lib/rpc", () => ({ rpc: {} }));

import { item, overview } from "../../pages/gtm/fixtures";
import { GtmBlock } from "./GtmBlock";

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
const render = (block: GtmPageBlock, data: GtmOverview = overview) =>
  act(async () =>
    root.render(
      <MemoryRouter>
        <GtmBlock block={block} overview={data} onChange={() => {}} />
      </MemoryRouter>,
    ),
  );

it("counts from the live overview and applies a channel filter before showing a goal", async () => {
  await render({ type: "gtm-metric", query: { label: "Completed", count: "done", goal: 50 } });
  expect(host.textContent).toBe("Completed1 of 50");
  await render(
    { type: "gtm-metric", query: { label: "Completed", count: "done", channel: "linkedin" } },
    {
      ...overview,
      groups: {
        ...overview.groups,
        done: [...overview.groups.done, { ...item, id: "li", channel: "linkedin", status: "done" }],
      },
    },
  );
  expect(host.textContent).toBe("Completed1");
  await render({ type: "gtm-metric", query: { label: "Needs you", count: "needs_you" } });
  expect(host.textContent).toBe("Needs you2");
});

it("filters plan items by channel and category before limiting, without duplicating uncertainty", async () => {
  await render(
    {
      type: "gtm-plan",
      query: { group: "in_progress", channel: ["x"], category: ["public_post"], limit: 1 },
    },
    {
      ...overview,
      groups: {
        ...overview.groups,
        in_progress: [
          { ...item, id: "uncertain", status: "open", proof: `post:demo:${"a".repeat(64)}` },
          { ...item, id: "other-channel", status: "open", channel: "linkedin" },
          { ...item, id: "other-category", status: "open", category: "research" },
          { ...item, id: "match", status: "open" },
          { ...item, id: "over-limit", status: "open" },
        ],
      },
    },
  );
  expect(
    [...host.querySelectorAll("[data-item-id]")].map((node) => node.getAttribute("data-item-id")),
  ).toEqual(["match"]);
});

it("renders the existing channels table from the overview", async () => {
  await render({ type: "gtm-channels", query: {} });
  expect(host.querySelector("table")).not.toBeNull();
  expect(host.textContent).toContain("@example");
});
