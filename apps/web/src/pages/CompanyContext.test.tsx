// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text, plural: () => "" }));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: text, i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const rpcMock = vi.hoisted(() => ({
  companyContext: {
    list: vi.fn(),
    save: vi.fn(),
    history: vi.fn(),
    restore: vi.fn(),
    remove: vi.fn(),
  },
}));
vi.mock("../lib/rpc", () => ({ rpc: rpcMock }));

import { CompanyContext } from "./CompanyContext";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const acme = {
  id: "doc_acme",
  slug: "acme-widget",
  title: "Acme Widget",
  summary: "Makes widgets.",
  text: "Makes widgets. More text.",
  revision: 2,
  updatedAt: "2026-11-02T10:00:00.000Z",
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const show = async (sections: unknown[], entry = "/app/company?view=context") => {
  rpcMock.companyContext.list.mockResolvedValue(sections);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <CompanyContext />
      </MemoryRouter>,
    ),
  );
  await act(async () => {});
};
const button = (name: string) =>
  [...container.querySelectorAll("button")].find((b) => b.textContent === name);
const type = async (selector: string, value: string) => {
  const field = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
  const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto.prototype, "value")!.set!.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.resetAllMocks();
});

it("asks the owner to write the first section when there are none", async () => {
  await show([]);
  expect(container.textContent).toContain("What should every agent know?");
  expect(button("Add the first section")).toBeDefined();
  rpcMock.companyContext.save.mockResolvedValue(acme);
  await act(async () => button("Add the first section")!.click());
  await type('input[aria-label="Name"]', "Acme Widget");
  await type('textarea[aria-label="What is it?"]', "Makes widgets.");
  rpcMock.companyContext.list.mockResolvedValue([acme]);
  await act(async () => button("Save")!.click());
  expect(rpcMock.companyContext.save).toHaveBeenCalledWith({
    id: undefined,
    title: "Acme Widget",
    text: "Makes widgets.",
    expectedRevision: undefined,
  });
  expect(container.textContent).toContain("Acme Widget");
});

it("saves an edit against the revision it opened, and shows a conflict", async () => {
  await show([acme], "/app/company?view=context&section=acme-widget");
  expect(container.textContent).toContain("Makes widgets. More text.");
  await act(async () => button("Edit")!.click());
  rpcMock.companyContext.save.mockRejectedValue(
    new Error("This section changed since it was opened"),
  );
  await type('textarea[aria-label="What is it?"]', "Changed.");
  await act(async () => button("Save")!.click());
  expect(rpcMock.companyContext.save).toHaveBeenCalledWith({
    id: "doc_acme",
    title: "Acme Widget",
    text: "Changed.",
    expectedRevision: 2,
  });
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("changed");
  // The draft stays open so nothing typed is lost.
  expect(container.querySelector('textarea[aria-label="What is it?"]')).not.toBeNull();
});

it("retries a conflicted save against the latest revision, keeping the typed text", async () => {
  await show([acme], "/app/company?view=context&section=acme-widget");
  await act(async () => button("Edit")!.click());
  rpcMock.companyContext.save.mockRejectedValueOnce(
    new Error("This section changed since it was opened"),
  );
  rpcMock.companyContext.save.mockResolvedValue({ ...acme, revision: 4 });
  await type('textarea[aria-label="What is it?"]', "Changed.");
  rpcMock.companyContext.list.mockResolvedValue([{ ...acme, revision: 3 }]);
  await act(async () => button("Save")!.click());
  await act(async () => button("Save")!.click());
  expect(rpcMock.companyContext.save).toHaveBeenLastCalledWith({
    id: "doc_acme",
    title: "Acme Widget",
    text: "Changed.",
    expectedRevision: 3,
  });
});
