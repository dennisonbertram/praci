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
const rpcMock = vi.hoisted(() => ({
  linked: vi.fn(),
  remove: vi.fn(),
  save: vi.fn(),
  prospectSave: vi.fn(),
}));
vi.mock("../lib/rpc", () => ({
  rpc: {
    contacts: { linked: rpcMock.linked, delete: rpcMock.remove, save: rpcMock.save },
    fundraising: { prospects: { save: rpcMock.prospectSave } },
  },
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

it("hands a plain contact to the page to delete after the Undo window", async () => {
  rpcMock.linked.mockResolvedValue({ portal: false, documents: [], safes: 0 });
  rpcMock.remove.mockResolvedValue({ ok: true });
  const { onDeleted, onClose } = show();
  await click(button("Delete"));
  await flush();
  expect(rpcMock.remove).not.toHaveBeenCalled();
  expect(onDeleted).toHaveBeenCalledWith(ada);
  expect(onClose).toHaveBeenCalled();
});

it("asks first when the contact has linked data, names what goes, and offers no Undo", async () => {
  rpcMock.linked.mockResolvedValue({
    portal: true,
    documents: ["Deck.pdf", "Terms.pdf"],
    safes: 0,
  });
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
  rpcMock.linked.mockResolvedValue({ portal: false, documents: ["Deck.pdf"], safes: 0 });
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

const dana: Contact = { ...ada, id: "c2", name: "Dana Example", email: "dana@example.test" };

function typeEmail(value: string) {
  const input = document.getElementById("contact-email") as HTMLInputElement;
  return act(async () => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

it("shows the duplicate email while typing and blocks Save", async () => {
  const onOpenContact = vi.fn();
  act(() =>
    root.render(
      <ContactDialog
        contact={null}
        contacts={[ada, dana]}
        onClose={() => {}}
        onSaved={() => {}}
        onOpenContact={onOpenContact}
      />,
    ),
  );
  await typeEmail("Dana@Example.test");
  const email = document.getElementById("contact-email");
  expect(document.querySelector('[role="alert"]')?.textContent).toContain(
    "Another contact already has this email.",
  );
  expect(email?.getAttribute("aria-invalid")).toBe("true");
  expect(document.getElementById(email?.getAttribute("aria-describedby") ?? "")).not.toBeNull();
  await click(button("Open Dana Example"));
  expect(onOpenContact).toHaveBeenCalledWith(dana);
  expect(button("Save")?.hasAttribute("disabled")).toBe(true);
  expect(rpcMock.save).not.toHaveBeenCalled();
});

it("shows no duplicate error when editing the contact that owns the email", async () => {
  act(() =>
    root.render(
      <ContactDialog contact={dana} contacts={[ada, dana]} onClose={() => {}} onSaved={() => {}} />,
    ),
  );
  await typeEmail("DANA@example.test");
  expect(document.querySelector('[role="alert"]')).toBeNull();
  expect(button("Save")?.hasAttribute("disabled")).toBe(false);
});

const prospect: Contact = {
  ...ada,
  kind: "prospect",
  stage: "meeting",
  checkSizeCents: 2_500_000,
  nextStep: "Send the deck",
};
async function typeInto(id: string, value: string) {
  const input = document.getElementById(id) as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

it("shows no pipeline fields for a prospect and never writes the record from an email edit", async () => {
  act(() =>
    root.render(<ContactDialog contact={prospect} onClose={() => {}} onSaved={() => {}} />),
  );
  await flush();
  for (const id of ["contact-stage", "contact-check-size", "contact-next-step"])
    expect(document.getElementById(id)).toBeNull();
  await typeInto("contact-email", "new@example.test");
  rpcMock.save.mockResolvedValue(prospect);
  await click(button("Save"));
  expect(rpcMock.save).toHaveBeenCalledTimes(1);
  const sent = rpcMock.save.mock.calls[0]?.[0];
  expect(sent).toMatchObject({ id: "c1", email: "new@example.test" });
  for (const key of ["stage", "checkSizeCents", "nextStep"]) expect(sent).not.toHaveProperty(key);
  expect(rpcMock.prospectSave).not.toHaveBeenCalled();
});
