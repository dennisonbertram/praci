// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, i) => text + part + String(values[i] ?? ""), "");
  return { useLingui: () => ({ t, i18n: { locale: "en" } }) };
});

import { InboxPileTabs } from "./InboxPileTabs";

let root: ReturnType<typeof createRoot>;
type Props = Parameters<typeof InboxPileTabs>[0];
const show = (extra: Partial<Props> = {}) =>
  act(async () =>
    root.render(
      <InboxPileTabs
        value="important"
        counts={{ important: 4, updates: 2, newsletters: 7, spam: 0 }}
        onChange={() => {}}
        {...extra}
      />,
    ),
  );
const tabs = () => [...document.querySelectorAll('[role="tab"]')];

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  root = createRoot(document.body.appendChild(document.createElement("div")));
});
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
});

it("offers the three piles, with Important selected", async () => {
  await show();
  expect(tabs().map((el) => el.textContent)).toEqual(["Important", "Updates", "Newsletters"]);
  expect(tabs()[0]?.getAttribute("aria-selected")).toBe("true");
});

it("adds a Spam tab with its count only when there is spam", async () => {
  await show({ counts: { important: 4, updates: 2, newsletters: 7, spam: 12 } });
  expect(tabs().map((el) => el.textContent)).toEqual([
    "Important",
    "Updates",
    "Newsletters",
    "Spam12",
  ]);
});

it("keeps the Spam tab while it is the open pile, even with no spam left", async () => {
  await show({ value: "spam", counts: { important: 0, updates: 0, newsletters: 0, spam: 0 } });
  expect(tabs().at(-1)?.textContent).toBe("Spam0");
  expect(tabs().at(-1)?.getAttribute("aria-selected")).toBe("true");
});

it("selects no tab while a filter is open, and shows no Spam without counts", async () => {
  await show({ value: undefined, counts: undefined });
  expect(tabs().map((el) => el.getAttribute("aria-selected"))).toEqual(["false", "false", "false"]);
});

it("reports the chosen pile", async () => {
  const onChange = vi.fn();
  await show({ onChange });
  await act(async () => {
    tabs()[2]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  expect(onChange).toHaveBeenCalledWith("newsletters");
});
