// @vitest-environment jsdom

import type { MailRow } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, i) => text + part + String(values[i] ?? ""), "");
  return {
    useLingui: () => ({ t, i18n: { locale: "en" } }),
    Trans: ({ children }: { children: ReactNode }) => children,
  };
});

import { setHideAmounts } from "../../lib/hide-amounts-preference";
import { InboxGroup, InboxRow } from "./InboxRow";

const row: MailRow = {
  id: "m1",
  connectionId: "c1",
  threadId: "t1",
  from: "Sam Rivera",
  subject: "Offsite dates",
  snippet: "Can you do the 14th?",
  receivedAt: new Date().toISOString(),
  unread: true,
  inInbox: true,
  needsReply: false,
  priority: null,
  reason: null,
  category: "newsletter",
  feedback: null,
};

let root: ReturnType<typeof createRoot>;
const show = (extra: Partial<Parameters<typeof InboxRow>[0]> = {}) =>
  act(async () =>
    root.render(
      <InboxRow
        row={row}
        onOpen={() => {}}
        onMark={() => {}}
        onArchive={() => {}}
        onRead={() => {}}
        {...extra}
      />,
    ),
  );

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  root = createRoot(document.body.appendChild(document.createElement("div")));
});
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
});

it("keeps the triage label in the accessibility tree when the badge is hidden in a narrow pane", async () => {
  await show();
  const badge = [...document.querySelectorAll('[data-slot="badge"]')][0];
  expect(badge?.className).toContain("hidden @md:inline-flex");
  const spoken = document.querySelector("button[data-row-id] .sr-only.\\@md\\:hidden");
  expect(spoken?.textContent).toBe("Newsletter");
});

it("shows a compact label dot in the narrow pane that names the label", async () => {
  await show();
  const dot = document.querySelector("[data-label-dot]");
  expect(dot?.getAttribute("title")).toBe("Newsletter");
  expect(dot?.className).toContain("@md:hidden");
});

it("keeps the row actions out of the Tab order and reaches them with the arrow keys", async () => {
  await show();
  const rowButton = document.querySelector<HTMLElement>("button[data-row-id]");
  const archive = document.querySelector<HTMLElement>('button[aria-label="Archive"]');
  expect(archive?.tabIndex).toBe(-1);
  await act(async () => rowButton?.focus());
  await act(async () => {
    rowButton?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }),
    );
  });
  expect(document.activeElement).toBe(archive);
  await act(async () => {
    archive?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }),
    );
  });
  expect(document.activeElement).toBe(rowButton);
});

it("marks the searched words and shows the snippet around the match", async () => {
  await show({
    query: "halcyon",
    row: { ...row, subject: "Release notes", snippet: `${"x ".repeat(40)}the Halcyon board ships` },
  });
  const marks = [...document.querySelectorAll("mark")].map((m) => m.textContent);
  expect(marks).toEqual(["Halcyon"]);
  expect(document.querySelector("button[data-row-id]")?.textContent).toContain("…");
});

it("gives the More trigger a larger touch target on coarse pointers", async () => {
  await show();
  expect(document.querySelector('button[aria-label^="More actions for"]')?.className).toContain(
    "pointer-coarse:size-10",
  );
});

it("shows the More menu trigger below md as well as on touch, since the inline actions hide there", async () => {
  await show();
  const inline = document.querySelector('button[aria-label="Archive"]')?.parentElement;
  expect(inline?.className).toContain("@max-md:hidden");
  const more = document.querySelector('button[aria-label^="More actions for"]');
  expect(more?.className).toContain("@max-md:inline-flex");
  expect(more?.className).toContain("pointer-coarse:inline-flex");
});

it("is a 56px row", async () => {
  await show();
  expect(document.querySelector("button[data-row-id]")?.className).toContain("h-14");
});

it("names the user's own sent mail You, not their address", async () => {
  await show({ row: { ...row, from: "me@example.test", fromSelf: true } });
  const sender = document.querySelector("button[data-row-id] > span:nth-child(2)");
  expect(sender?.textContent).toBe("You (unread)");
});

it("masks currency in the subject and preview while amounts are hidden", async () => {
  const { setHideAmounts } = await import("../../lib/hide-amounts-preference");
  setHideAmounts(true);
  await show({ row: { ...row, subject: "Invoice $4,812.00", snippet: "Due: $250,000 total" } });
  expect(document.body.textContent).not.toContain("4,812");
  expect(document.body.textContent).not.toContain("250,000");
  await act(async () => setHideAmounts(false));
  expect(document.body.textContent).toContain("$4,812.00");
});

it("says in the More menu that a mark covers all mail from the sender", async () => {
  await show();
  await act(async () =>
    document.querySelector<HTMLElement>('button[aria-label^="More actions for"]')?.click(),
  );
  const items = [...document.querySelectorAll('[role="menuitemcheckbox"]')].map(
    (el) => el.textContent,
  );
  expect(items).toEqual([
    "Mark importantAll mail from Sam Rivera",
    "Mark noiseAll mail from Sam Rivera",
  ]);
});

it("labels an archived search result Archived", async () => {
  await show({ row: { ...row, inInbox: false } });
  const badges = [...document.querySelectorAll('[data-slot="badge"]')].map((b) => b.textContent);
  expect(badges).toEqual(["Archived"]);
});

it("masks amounts in the subject and preview while amounts are hidden", async () => {
  setHideAmounts(true);
  try {
    await show({
      row: { ...row, subject: "Invoice for $4,812.00", snippet: "Pay USD 1,200 by Friday" },
    });
    const text = document.body.textContent ?? "";
    expect(text).not.toContain("4,812");
    expect(text).not.toContain("1,200");
    expect(text).toContain("Invoice for $•••");
  } finally {
    setHideAmounts(false);
  }
});

it("shows the one-line summary after the subject in place of the snippet", async () => {
  await show({ row: { ...row, reason: "Offsite poll closes Friday" } });
  const text = document.querySelector("button[data-row-id]")?.textContent ?? "";
  expect(text).toContain("Offsite dates — Offsite poll closes Friday");
  expect(text).not.toContain("Can you do the 14th?");
});

it("falls back to the snippet when there is no summary", async () => {
  await show({ row: { ...row, reason: null } });
  expect(document.querySelector("button[data-row-id]")?.textContent).toContain(
    "Offsite dates — Can you do the 14th?",
  );
});

it("offers no checkbox unless the list can check rows", async () => {
  await show();
  expect(document.querySelector('[role="checkbox"]')).toBeNull();
});

it("keeps the checkbox out of the Tab order and reaches it with the arrow keys", async () => {
  await show({ onPick: vi.fn() });
  const rowButton = document.querySelector<HTMLElement>("button[data-row-id]");
  const box = document.querySelector<HTMLElement>('[role="checkbox"]');
  expect(box?.tabIndex).toBe(-1);
  await act(async () => rowButton?.focus());
  await act(async () => {
    rowButton?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }),
    );
  });
  expect(document.activeElement).toBe(box);
});

it("checks the row from its own checkbox without opening it, and passes the shift key", async () => {
  const onPick = vi.fn();
  const onOpen = vi.fn();
  await show({ onPick, onOpen });
  const box = document.querySelector<HTMLElement>('[role="checkbox"]');
  expect(box?.getAttribute("aria-label")).toBe("Select Sam Rivera");
  // The checkbox is a sibling of the row button, never inside it.
  expect(box?.closest("button[data-row-id]")).toBeNull();
  await act(async () => box?.click());
  expect(onPick).toHaveBeenCalledTimes(1);
  expect(onPick).toHaveBeenLastCalledWith({ shift: false });
  await act(async () => {
    box?.dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }));
  });
  expect(onPick).toHaveBeenCalledTimes(2);
  expect(onPick).toHaveBeenLastCalledWith({ shift: true });
  expect(onOpen).not.toHaveBeenCalled();
});

it("shows a checked row's checkbox checked, and every checkbox once any row is checked", async () => {
  await show({ onPick: () => {}, picked: true, anyPicked: true });
  const box = document.querySelector('[role="checkbox"]');
  expect(box?.getAttribute("aria-checked")).toBe("true");
  expect(box?.className).not.toContain("opacity-0");
  await show({ onPick: () => {}, picked: false, anyPicked: false });
  expect(document.querySelector('[role="checkbox"]')?.className).toContain("opacity-0");
  await show({ onPick: () => {}, picked: false, anyPicked: true });
  expect(document.querySelector('[role="checkbox"]')?.className).not.toContain("opacity-0");
});

it("hides the Archived badge when the list says so, as the Spam pile does", async () => {
  await show({ row: { ...row, inInbox: false }, showArchived: false });
  expect([...document.querySelectorAll('[data-slot="badge"]')]).toEqual([]);
});

it("hides the Newsletter label inside the Newsletters pile only", async () => {
  await show({ hideNewsletter: true });
  expect(document.querySelector("[data-label-dot]")).toBeNull();
  expect([...document.querySelectorAll('[data-slot="badge"]')]).toEqual([]);
  await show({ row: { ...row, category: "spam" }, hideNewsletter: true });
  expect(document.querySelector("[data-label-dot]")?.getAttribute("data-label-dot")).toBe("spam");
});

const menuItems = async () => {
  await act(async () =>
    document.querySelector<HTMLElement>('button[aria-label^="More actions for"]')?.click(),
  );
  return [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')];
};

it("offers Spam and Trash in the More menu of an inbox row when the list can move mail", async () => {
  const onMove = vi.fn();
  await show({ onMove });
  const items = await menuItems();
  expect(items.map((el) => el.textContent)).toEqual(["Archive", "Mark read", "Spam", "Trash"]);
  await act(async () => items[2]?.click());
  expect(onMove).toHaveBeenLastCalledWith("spam");
});

it("keeps Spam and Trash out of the inline hover buttons", async () => {
  await show({ onMove: () => {} });
  const inline = [...document.querySelectorAll("div.absolute button[aria-label]")].map((el) =>
    el.getAttribute("aria-label"),
  );
  expect(inline).not.toContain("Spam");
  expect(inline).not.toContain("Trash");
});

it("offers Not spam, not Spam, for a row in the Spam pile", async () => {
  const onMove = vi.fn();
  await show({ row: { ...row, inInbox: false, pile: "spam" }, onMove });
  const items = await menuItems();
  expect(items.map((el) => el.textContent)).toEqual(["Mark read", "Not spam"]);
  await act(async () => items[1]?.click());
  expect(onMove).toHaveBeenLastCalledWith("notSpam");
});

it("offers no spam or trash items without a move handler", async () => {
  await show();
  const items = await menuItems();
  expect(items.map((el) => el.textContent)).toEqual(["Archive", "Mark read"]);
});

it("labels the group number as unread mail, not a row count", async () => {
  const rows = [row, { ...row, id: "m2", unread: false }, { ...row, id: "m3", unread: false }];
  await act(async () =>
    root.render(<InboxGroup title="Earlier" rows={rows} onOpen={() => {}} onMark={undefined} />),
  );
  expect(document.querySelector("h2")?.textContent).toBe("Earlier1 unread");
});
