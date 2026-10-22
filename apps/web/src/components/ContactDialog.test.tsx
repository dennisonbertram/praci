// @vitest-environment jsdom

import type { Contact } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({
  t: text,
  plural: (n: number, forms: { one: string; other: string }) =>
    (n === 1 ? forms.one : forms.other).replace("#", String(n)),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const rpcMock = vi.hoisted(() => ({ linked: vi.fn(), remove: vi.fn(), save: vi.fn() }));
vi.mock("../lib/rpc", () => ({
  rpc: { contacts: { linked: rpcMock.linked, delete: rpcMock.remove, save: rpcMock.save } },
}));

import { ContactDialog } from "./ContactDialog";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ada: Contact = {
  id: "c1",
  name: "Ada Example",
  email: "ada@example.test",
  organization: null,
  kind: "investor",
  notes: null,
  addedBy: null,
  createdAt: "2026-10-15T00:00:00.000Z",
  updatedAt: "2026-10-15T00:00:00.000Z",
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

const flush = () => act(async () => {});
const button = (label: string) =>
  [...document.querySelectorAll("button")].find((b) => b.textContent === label);
const click = (el: Element | undefined) =>
  act(async () => (el as HTMLElement | undefined)?.click());

function show() {
  const onDeleted = vi.fn();
  const onClose = vi.fn();
  act(() =>
    root.render(
      <ContactDialog contact={ada} onClose={onClose} onSaved={() => {}} onDeleted={onDeleted} />,
    ),
  );
  return { onDeleted, onClose };
}

it("deletes a plain contact at once, keeping the Undo path", async () => {
  rpcMock.linked.mockResolvedValue({ portal: false, documents: [] });
  rpcMock.remove.mockResolvedValue({ ok: true });
  const { onDeleted, onClose } = show();
  await click(button("Delete"));
  await flush();
  expect(rpcMock.remove).toHaveBeenCalledWith({ id: "c1" });
  expect(onDeleted).toHaveBeenCalledWith(ada);
  expect(onClose).toHaveBeenCalled();
});

it("asks first when the contact has linked data, names what goes, and offers no Undo", async () => {
  rpcMock.linked.mockResolvedValue({ portal: true, documents: ["Deck.pdf", "Terms.pdf"] });
  rpcMock.remove.mockResolvedValue({ ok: true });
  const { onDeleted, onClose } = show();
  await click(button("Delete"));
  await flush();
  expect(rpcMock.remove).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
  const dialog = document.querySelector('[role="alertdialog"]');
  expect(dialog?.textContent).toContain("Delete Ada Example?");
  expect(dialog?.textContent).toContain(
    "This also removes their portal access and access to 2 shared documents.",
  );
  const confirm = [...(dialog?.querySelectorAll("button") ?? [])].find(
    (b) => b.textContent === "Delete",
  );
  await click(confirm);
  await flush();
  expect(rpcMock.remove).toHaveBeenCalledWith({ id: "c1" });
  expect(onDeleted).toHaveBeenCalledWith(ada, false);
  expect(onClose).toHaveBeenCalled();
});

it("Cancel on the question deletes nothing", async () => {
  rpcMock.linked.mockResolvedValue({ portal: false, documents: ["Deck.pdf"] });
  const { onDeleted } = show();
  await click(button("Delete"));
  await flush();
  const dialog = document.querySelector('[role="alertdialog"]');
  expect(dialog?.textContent).toContain("access to 1 shared document.");
  await click(
    [...(dialog?.querySelectorAll("button") ?? [])].find((b) => b.textContent === "Cancel"),
  );
  await flush();
  expect(rpcMock.remove).not.toHaveBeenCalled();
  expect(onDeleted).not.toHaveBeenCalled();
  expect(document.querySelector('[role="alertdialog"]')).toBeNull();
});
