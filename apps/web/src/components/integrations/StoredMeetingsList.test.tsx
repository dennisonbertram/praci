// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
}));

const meetings = vi.hoisted(() => ({ list: vi.fn(), delete: vi.fn() }));
vi.mock("../../lib/rpc", () => ({ rpc: { meetings } }));

import { StoredMeetingsList } from "./StoredMeetingsList";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const rows = [
  { id: "m1", title: "Weekly sync", startedAt: "2026-10-19T10:00:00Z" },
  { id: "m2", title: "Board prep", startedAt: "2026-10-18T10:00:00Z" },
];

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

async function mount() {
  const container = document.createElement("div");
  document.body.append(container);
  await act(async () =>
    createRoot(container).render(
      <MemoryRouter>
        <StoredMeetingsList />
      </MemoryRouter>,
    ),
  );
  return container;
}
const dialog = () => document.querySelector('[role="alertdialog"]');
const click = (el: Element | null | undefined) => act(async () => (el as HTMLElement).click());

it("lists stored meetings from the plain query and deletes only after the confirmation", async () => {
  meetings.list.mockResolvedValueOnce({ items: rows, nextCursor: null });
  meetings.delete.mockResolvedValue({ ok: true });
  const container = await mount();
  expect(container.textContent).toContain("Weekly sync");
  expect(container.textContent).toContain("Board prep");

  await click([...container.querySelectorAll("button")].find((b) => b.textContent === "Delete"));
  expect(meetings.delete).not.toHaveBeenCalled();
  expect(dialog()?.textContent).toContain('Delete "Weekly sync"?');
  expect(dialog()?.textContent).toContain(
    "Removes this meeting and its to-dos from Praci. Your note in Granola is not changed.",
  );
  const buttons = [...(dialog()?.querySelectorAll("button") ?? [])].map((b) => b.textContent);
  expect(buttons).toEqual(["Cancel", "Delete"]);

  await click(
    [...(dialog()?.querySelectorAll("button") ?? [])].find((b) => b.textContent === "Delete"),
  );
  expect(meetings.delete).toHaveBeenCalledWith({ meetingId: "m1" });
  expect(meetings.list).toHaveBeenCalledTimes(1);
  expect(container.textContent).not.toContain("Weekly sync");
});

it("does not delete when the confirmation is cancelled", async () => {
  meetings.list.mockResolvedValue({ items: rows, nextCursor: null });
  const container = await mount();
  await click([...container.querySelectorAll("button")].find((b) => b.textContent === "Delete"));
  await click(
    [...(dialog()?.querySelectorAll("button") ?? [])].find((b) => b.textContent === "Cancel"),
  );
  expect(meetings.delete).not.toHaveBeenCalled();
});

it("loads the next page with Show more and hides it on the last page", async () => {
  meetings.list
    .mockResolvedValueOnce({ items: [rows[0]], nextCursor: "cursor-1" })
    .mockResolvedValueOnce({ items: [rows[1]], nextCursor: null });
  const container = await mount();
  expect(container.textContent).not.toContain("Board prep");
  const more = () =>
    [...container.querySelectorAll("button")].find((b) => b.textContent === "Show more");
  await click(more());
  expect(meetings.list).toHaveBeenLastCalledWith({ cursor: "cursor-1" });
  expect(container.textContent).toContain("Weekly sync");
  expect(container.textContent).toContain("Board prep");
  expect(more()).toBeUndefined();
});
