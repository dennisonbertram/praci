// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) => String.raw({ raw: parts }, ...values),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { ItemMenu } from "./ItemMenu";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const labels = async (item: { name: string; status: string }, canRetry: boolean) => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <ItemMenu
        item={item}
        canRetry={canRetry}
        onAction={() => undefined}
        agents={[{ id: "a", name: "Ada", color: "#000" }]}
        onSendToAgent={() => undefined}
        open
      />,
    ),
  );
  const found = Array.from(document.querySelectorAll('[role="menuitem"]')).map(
    (el) => el.textContent,
  );
  await act(async () => root.unmount());
  return found;
};
afterEach(() => {
  document.body.replaceChildren();
});

it("offers Replace file, not Send to agent or Try again, for an unreadable file", async () => {
  const found = await labels({ name: "scan.pdf", status: "failed" }, false);
  expect(found).toContain("Replace file");
  expect(found).not.toContain("Try again");
  expect(found.join()).not.toMatch(/Send to/);
});

it("leads with Try again for a failed file that can be retried", async () => {
  const found = await labels({ name: "scan.pdf", status: "failed" }, true);
  expect(found.slice(0, 2)).toEqual(["Try again", "Replace file"]);
});

it("keeps Send to agent for a ready file", async () => {
  const found = await labels({ name: "ok.pdf", status: "ready" }, false);
  expect(found).not.toContain("Replace file");
  expect(found.join()).toMatch(/Send to/);
});
