// @vitest-environment jsdom

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
  plural: (count: number, forms: { one: string; other: string }) =>
    (count === 1 ? forms.one : forms.other).replace("#", String(count)),
}));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: text, i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const page = (items: unknown[]) => ({ items, total: items.length, page: 1, pageSize: 100 });
const rpcMock = vi.hoisted(() => ({
  stakeholders: { list: vi.fn() },
  plans: { list: vi.fn() },
  vestingTemplates: { list: vi.fn() },
  draftSets: { create: vi.fn() },
  optionActions: { issueDraftSet: vi.fn() },
}));
vi.mock("../../../lib/rpc", () => ({ rpc: { equity: rpcMock } }));
vi.mock("../../../lib/user-error", () => ({
  errorText: (caught: unknown) =>
    caught instanceof Error ? caught.message : "Something went wrong",
}));

import { OptionDraftSetDialog } from "./OptionDraftSetDialog";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: ReturnType<typeof createRoot> | null = null;
beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const button = (label: string) =>
  [...document.querySelectorAll("button")].find((node) => node.textContent === label) as
    | HTMLButtonElement
    | undefined;
function change(id: string, value: string) {
  const node = document.getElementById(id) as HTMLInputElement | HTMLSelectElement;
  const proto = node instanceof HTMLSelectElement ? HTMLSelectElement : HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, "value")?.set?.call(node, value);
  node.dispatchEvent(
    new Event(node instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }),
  );
}

async function render(templates = true) {
  rpcMock.stakeholders.list.mockResolvedValue(page([{ id: "sh-1", name: "Ada Example" }]));
  rpcMock.plans.list.mockResolvedValue(page([{ id: "plan-1", name: "2026 Stock Plan" }]));
  rpcMock.vestingTemplates.list.mockResolvedValue(
    page(
      templates
        ? [
            {
              id: "tpl-1",
              name: "Standard",
              totalMonths: 48,
              cliffMonths: 12,
              frequencyMonths: 1,
              tranches: null,
            },
          ]
        : [],
    ),
  );
  const onSaved = vi.fn();
  const onClose = vi.fn();
  root = createRoot(document.createElement("div"));
  await act(async () => {
    root?.render(<OptionDraftSetDialog onClose={onClose} onSaved={onSaved} />);
    await flush();
  });
  return { onSaved, onClose };
}

it("creates a draft set with every row, then issues it", async () => {
  rpcMock.draftSets.create.mockResolvedValue({ id: "draft-7", revision: 1 });
  rpcMock.optionActions.issueDraftSet.mockResolvedValue({ draftSetId: "draft-7", grants: [] });
  const { onSaved } = await render();
  await act(async () => change("draft-0-quantity", "48000"));
  await act(async () => change("draft-0-price", "0.25"));
  await act(async () => change("draft-0-date", "2026-02-01"));
  await act(async () => change("draft-0-vesting", "tpl-1"));
  await act(async () => button("Add grant")?.click());
  await act(async () => change("draft-1-quantity", "12000"));
  await act(async () => change("draft-1-price", "0.5"));
  await act(async () => change("draft-1-date", "2026-03-01"));
  await act(async () => button("Review")?.click());
  expect(document.body.textContent).toContain("60,000");
  await act(async () => {
    button("Issue 2 grants")?.click();
    await flush();
  });
  expect(rpcMock.draftSets.create).toHaveBeenCalledWith(
    expect.objectContaining({
      securityKind: "option_grant",
      items: [
        expect.objectContaining({
          stakeholderId: "sh-1",
          planId: "plan-1",
          quantity: "48000",
          exercisePrice: "0.25",
          grantDate: "2026-02-01",
          vesting: expect.objectContaining({ templateId: "tpl-1", startDate: "2026-02-01" }),
        }),
        expect.objectContaining({
          quantity: "12000",
          exercisePrice: "0.5",
          grantDate: "2026-03-01",
          vesting: expect.objectContaining({ templateId: "tpl-1", startDate: "2026-03-01" }),
        }),
      ],
    }),
  );
  expect(rpcMock.optionActions.issueDraftSet).toHaveBeenCalledWith({
    id: "draft-7",
    expectedRevision: 1,
  });
  expect(onSaved).toHaveBeenCalled();
});

it("keeps Review disabled while a row is invalid", async () => {
  await render();
  await act(async () => change("draft-0-quantity", "48000"));
  await act(async () => change("draft-0-price", "0.25"));
  await act(async () => button("Add grant")?.click());
  await act(async () => change("draft-1-price", "0.5"));
  expect(button("Review")?.disabled).toBe(true);
  await act(async () => change("draft-1-quantity", "0"));
  expect(button("Review")?.disabled).toBe(true);
  await act(async () => change("draft-1-quantity", "12000"));
  expect(button("Review")?.disabled).toBe(false);
});

it("stays on review when the server rejects the draft set", async () => {
  rpcMock.draftSets.create.mockRejectedValue(new Error("The plan pool is exhausted"));
  const { onSaved } = await render();
  await act(async () => change("draft-0-quantity", "48000"));
  await act(async () => change("draft-0-price", "0.25"));
  await act(async () => button("Review")?.click());
  await act(async () => {
    button("Issue 1 grant")?.click();
    await flush();
  });
  expect(document.body.textContent).toContain("The plan pool is exhausted");
  expect(button("Issue 1 grant")).toBeTruthy();
  expect(rpcMock.optionActions.issueDraftSet).not.toHaveBeenCalled();
  expect(onSaved).not.toHaveBeenCalled();
});

it("reuses the created set and revision when issuance is retried", async () => {
  rpcMock.draftSets.create.mockResolvedValue({ id: "draft-7", revision: 3 });
  rpcMock.optionActions.issueDraftSet
    .mockRejectedValueOnce(new Error("Temporary issue failure"))
    .mockResolvedValueOnce({ draftSetId: "draft-7", grants: [] });
  const { onSaved } = await render();
  await act(async () => change("draft-0-quantity", "48000"));
  await act(async () => change("draft-0-price", "0.25"));
  await act(async () => button("Review")?.click());
  await act(async () => {
    button("Issue 1 grant")?.click();
    await flush();
  });
  await act(async () => {
    button("Issue 1 grant")?.click();
    await flush();
  });
  expect(rpcMock.draftSets.create).toHaveBeenCalledTimes(1);
  expect(rpcMock.optionActions.issueDraftSet).toHaveBeenNthCalledWith(1, {
    id: "draft-7",
    expectedRevision: 3,
  });
  expect(rpcMock.optionActions.issueDraftSet).toHaveBeenNthCalledWith(2, {
    id: "draft-7",
    expectedRevision: 3,
  });
  expect(onSaved).toHaveBeenCalledTimes(1);
});

it("does not retry issuance when the parent refresh fails after success", async () => {
  rpcMock.draftSets.create.mockResolvedValue({ id: "draft-7", revision: 1 });
  rpcMock.optionActions.issueDraftSet.mockResolvedValue({ draftSetId: "draft-7", grants: [] });
  const { onSaved } = await render();
  onSaved.mockRejectedValueOnce(new Error("Refresh failed"));
  await act(async () => change("draft-0-quantity", "48000"));
  await act(async () => change("draft-0-price", "0.25"));
  await act(async () => button("Review")?.click());
  await act(async () => {
    button("Issue 1 grant")?.click();
    await flush();
  });
  expect(document.body.textContent).toContain("Refresh failed");
  expect(button("Refresh")?.disabled).toBe(false);
  expect(rpcMock.optionActions.issueDraftSet).toHaveBeenCalledTimes(1);
  onSaved.mockResolvedValue(undefined);
  await act(async () => {
    button("Refresh")?.click();
    await flush();
  });
  expect(rpcMock.optionActions.issueDraftSet).toHaveBeenCalledTimes(1);
  expect(onSaved).toHaveBeenCalledTimes(2);
});

it("guards double clicks while option issuance is in flight", async () => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => (release = resolve));
  rpcMock.draftSets.create.mockResolvedValue({ id: "draft-double", revision: 1 });
  rpcMock.optionActions.issueDraftSet.mockReturnValue(pending);
  await render();
  await act(async () => change("draft-0-quantity", "48000"));
  await act(async () => change("draft-0-price", "0.25"));
  await act(async () => button("Review")?.click());
  await act(async () => {
    button("Issue 1 grant")?.click();
    button("Issue 1 grant")?.click();
    await flush();
  });
  expect(rpcMock.draftSets.create).toHaveBeenCalledTimes(1);
  expect(rpcMock.optionActions.issueDraftSet).toHaveBeenCalledTimes(1);
  await act(async () => {
    release();
    await flush();
  });
});
