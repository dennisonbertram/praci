// @vitest-environment jsdom

import { Mail } from "lucide-react";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SidebarPageLink } from "./SidebarPageLink";
import { SidebarPagesGroup } from "./SidebarPagesGroup";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
  }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
});
afterEach(() => container.remove());

const link = (
  id: string,
  extra: { notified?: boolean; current?: boolean; rail?: boolean } = {},
) => (
  <SidebarPageLink
    testId={id}
    current={extra.current ?? false}
    notified={extra.notified}
    rail={extra.rail}
    icon={<Mail aria-hidden="true" />}
    label={id}
    onOpen={() => {}}
  />
);

function Harness({ rail = false, start = false }: { rail?: boolean; start?: boolean }) {
  const [collapsed, setCollapsed] = useState(start);
  return (
    <SidebarPagesGroup
      title="Pages"
      collapsed={collapsed}
      rail={rail}
      onToggle={() => setCollapsed(!collapsed)}
    >
      {link("inbox", { notified: true, rail })}
      {link("finance", { rail })}
    </SidebarPagesGroup>
  );
}

const mount = (props: { rail?: boolean; start?: boolean } = {}) =>
  act(() => createRoot(container).render(<Harness {...props} />));
const ids = () =>
  [...container.querySelectorAll("[data-testid]")].map((n) => n.getAttribute("data-testid"));
const toggle = () =>
  container.querySelector<HTMLButtonElement>('[data-testid="sidebar-pages-toggle"]');

it("toggling hides the quiet rows and shows them again, with matching accessible names", () => {
  mount();
  expect(toggle()?.getAttribute("aria-label")).toBe("Collapse Pages");
  expect(ids()).toContain("finance");
  act(() => toggle()?.click());
  expect(toggle()?.getAttribute("aria-label")).toBe("Expand Pages");
  expect(toggle()?.getAttribute("aria-expanded")).toBe("false");
  expect(ids()).not.toContain("finance");
  act(() => toggle()?.click());
  expect(ids()).toContain("finance");
});

it("keeps a row with an unseen notification visible while collapsed", () => {
  mount({ start: true });
  expect(ids()).toContain("inbox");
  expect(ids()).not.toContain("finance");
});

it("ignores the collapsed state in the rail and shows no header", () => {
  mount({ rail: true, start: true });
  expect(toggle()).toBeNull();
  expect(ids()).toEqual(expect.arrayContaining(["inbox", "finance"]));
});
