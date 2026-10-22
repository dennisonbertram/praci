// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { overview } from "./fixtures";
import { GtmChannels } from "./GtmChannels";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("shows channels that share one unconnected or draft-only state as one row", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<GtmChannels overview={overview} />));
  const rows = [...container.querySelectorAll("tbody tr")].map((row) => row.textContent ?? "");
  expect(rows.filter((row) => row.includes("Not connected"))).toHaveLength(2);
  expect(rows.some((row) => row.startsWith("LinkedIn, Threads, Bluesky"))).toBe(true);
  expect(rows.some((row) => row.startsWith("Reddit, Hacker News, Product Hunt"))).toBe(true);
  await act(async () => root.unmount());
  container.remove();
});
