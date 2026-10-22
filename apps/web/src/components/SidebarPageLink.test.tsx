// @vitest-environment jsdom

import { Mail } from "lucide-react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SidebarPageLink } from "./SidebarPageLink";

vi.mock("@lingui/react/macro", () => ({ useLingui: () => ({ t: (s: string) => s }) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
});
afterEach(() => {
  container.remove();
});

const render = (rail: boolean, badge?: string) => {
  act(() => {
    createRoot(container).render(
      <>
        <SidebarPageLink
          rail={rail}
          testId="a"
          current={false}
          icon={<Mail aria-hidden="true" />}
          label="Inbox"
          badge={badge ? <span>{badge}</span> : undefined}
          badgeLabel={badge}
          onOpen={() => {}}
        />
        <SidebarPageLink
          rail={rail}
          testId="b"
          current={false}
          icon={<Mail aria-hidden="true" />}
          label="Finance"
          onOpen={() => {}}
        />
      </>,
    );
  });
};

it("shows the label and the badge text beside the icon when open", () => {
  render(false, "3 unread");
  expect(container.textContent).toContain("Inbox");
  expect(container.textContent).toContain("3 unread");
  expect(container.querySelector("button")?.getAttribute("aria-label")).toBe("Inbox, 3 unread");
  expect(container.querySelector('[data-testid="rail-badge"]')).toBeNull();
});

it("keeps an accessible name and a badge dot on the icon in the rail", () => {
  render(true, "3 unread");
  const [inbox, finance] = [...container.querySelectorAll("button")];
  expect(inbox?.getAttribute("aria-label")).toBe("Inbox, 3 unread");
  expect(finance?.getAttribute("aria-label")).toBe("Finance");
  expect(inbox?.querySelector('[data-testid="rail-badge"]')).not.toBeNull();
  expect(finance?.querySelector('[data-testid="rail-badge"]')).toBeNull();
  expect(container.textContent).not.toContain("Finance");
});

it("keeps rail items in tab order and shows the label as a tooltip on keyboard focus", async () => {
  render(true);
  const first = container.querySelector("button") as HTMLButtonElement;
  expect(first.tabIndex).toBe(0);
  await act(async () => {
    first.focus();
    first.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
    first.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 50));
  });
  expect(document.body.textContent).toContain("Inbox");
  expect(document.querySelector('[role="tooltip"], [data-slot="tooltip-content"]')).not.toBeNull();
});

it("renders a real link that opens in the app on a plain click and is left to the browser on Cmd-click", () => {
  const onOpen = vi.fn();
  act(() => {
    createRoot(container).render(
      <SidebarPageLink
        testId="a"
        href="/app/inbox"
        current={false}
        icon={<Mail aria-hidden="true" />}
        label="Inbox"
        onOpen={onOpen}
      />,
    );
  });
  const link = container.querySelector("a") as HTMLAnchorElement;
  expect(link.getAttribute("href")).toBe("/app/inbox");
  act(() => link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })));
  expect(onOpen).toHaveBeenCalledTimes(1);
  act(() =>
    link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, metaKey: true })),
  );
  expect(onOpen).toHaveBeenCalledTimes(1);
});
