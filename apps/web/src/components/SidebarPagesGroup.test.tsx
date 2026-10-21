// @vitest-environment jsdom

import { Mail } from "lucide-react";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SidebarPageLink } from "./SidebarPageLink";
import { SidebarPagesGroup } from "./SidebarPagesGroup";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: unknown }) => children,
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

const PAGES = [
  { key: "inbox", label: "Inbox" },
  { key: "finance", label: "Finance" },
];

function Harness({
  rail = false,
  start = false,
  initialHidden = [],
}: {
  rail?: boolean;
  start?: boolean;
  initialHidden?: string[];
}) {
  const [collapsed, setCollapsed] = useState(start);
  const [hidden, setHidden] = useState(initialHidden);
  return (
    <SidebarPagesGroup
      title="Pages"
      collapsed={collapsed}
      rail={rail}
      onToggle={() => setCollapsed(!collapsed)}
      pages={PAGES}
      hidden={hidden}
      onToggleHidden={(key) =>
        setHidden((now) => (now.includes(key) ? now.filter((k) => k !== key) : [...now, key]))
      }
    >
      {hidden.includes("inbox") ? null : link("inbox", { notified: true, rail })}
      {hidden.includes("finance") ? null : link("finance", { rail })}
    </SidebarPagesGroup>
  );
}

const mount = (props: { rail?: boolean; start?: boolean; initialHidden?: string[] } = {}) =>
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

const options = () => container.querySelector<HTMLElement>("[aria-label='Page options']");
const click = async (el: Element | null | undefined) => {
  await act(async () => {
    el?.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    el?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    el?.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    (el as HTMLElement | null | undefined)?.click();
  });
};
const checkbox = (label: string) =>
  [...document.body.querySelectorAll<HTMLElement>("[role=menuitemcheckbox]")].find((el) =>
    el.textContent?.includes(label),
  );

it("lists every page in the menu and hides one when unchecked", async () => {
  mount();
  await click(options());
  expect(checkbox("Inbox")?.getAttribute("aria-checked")).toBe("true");
  await click(checkbox("Finance"));
  expect(ids()).not.toContain("finance");
  expect(ids()).toContain("inbox");
});

it("keeps the header and menu when every page is hidden, so it can be undone", async () => {
  mount({ initialHidden: ["inbox", "finance"] });
  expect(ids()).toEqual(["sidebar-pages-toggle"]);
  await click(options());
  expect(checkbox("Inbox")?.getAttribute("aria-checked")).toBe("false");
  await click(checkbox("Inbox"));
  expect(ids()).toContain("inbox");
});

it("has no menu in the rail", () => {
  mount({ rail: true });
  expect(options()).toBeNull();
});
