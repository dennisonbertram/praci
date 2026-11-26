// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const rpcMock = vi.hoisted(() => ({
  stakeholders: { list: vi.fn() },
  shareClasses: { list: vi.fn() },
  draftSets: { create: vi.fn(), update: vi.fn() },
  draftSetActions: { review: vi.fn(), issue: vi.fn() },
}));
vi.mock("@lingui/core/macro", () => ({ t: (parts: TemplateStringsArray) => parts.join("") }));
vi.mock("../../../lib/rpc", () => ({ rpc: { equity: rpcMock } }));
vi.mock("../../../lib/user-error", () => ({
  errorText: (cause: unknown) => (cause instanceof Error ? cause.message : "Error"),
}));

import { DraftSetEditor } from "./DraftSetEditor";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: ReturnType<typeof createRoot> | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const button = (label: string) =>
  [...document.querySelectorAll("button")].find((node) => node.textContent === label);
function change(selector: string, value: string) {
  const node = document.querySelector(selector) as HTMLInputElement | HTMLSelectElement;
  const proto = node instanceof HTMLSelectElement ? HTMLSelectElement : HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, "value")?.set?.call(node, value);
  node.dispatchEvent(
    new Event(node instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }),
  );
}

async function renderEditor(onChanged: () => void | Promise<void>) {
  const page = (items: unknown[]) => ({ items, total: items.length, page: 1, pageSize: 500 });
  rpcMock.stakeholders.list.mockResolvedValue(page([{ id: "sh-1", name: "Ada Example" }]));
  rpcMock.shareClasses.list.mockResolvedValue(page([{ id: "sc-1", name: "Common" }]));
  const set = {
    id: "draft-1",
    name: "Test draft",
    securityKind: "certificate",
    status: "draft",
    revision: 1,
    issuedIds: [],
    items: [],
    issuedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  rpcMock.draftSets.create.mockResolvedValue(set);
  rpcMock.draftSetActions.review.mockResolvedValue({
    setId: set.id,
    revision: 1,
    items: [{ index: 0, problems: [] }],
    totalShares: "1000",
    totalPrincipalCents: "0",
    ready: true,
  });
  rpcMock.draftSetActions.issue.mockResolvedValue({
    set: { ...set, status: "issued", issuedIds: ["cert-1"] },
    issuedIds: ["cert-1"],
  });
  const onOpenChange = vi.fn();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <DraftSetEditor
        kind="certificate"
        set={null}
        onChanged={onChanged}
        onOpenChange={onOpenChange}
      />,
    );
    await flush();
  });
  change("#draft-name", "Test draft");
  change('select[aria-label="Stakeholder"]', "sh-1");
  change('select[aria-label="Share class"]', "sc-1");
  change('input[aria-label="Shares"]', "1000");
  return { onOpenChange };
}

async function reviewAndIssue() {
  await act(async () => {
    button("Review")?.click();
    await flush();
  });
}

it("disables the name while draft save is in flight", async () => {
  const onChanged = vi.fn().mockResolvedValue(undefined);
  await renderEditor(onChanged);
  let release!: (value: unknown) => void;
  rpcMock.draftSets.create.mockReturnValue(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  await act(async () => {
    button("Review")?.click();
    await flush();
  });
  expect((document.querySelector("#draft-name") as HTMLInputElement).disabled).toBe(true);
  await act(async () => {
    release({
      id: "draft-1",
      name: "Test draft",
      securityKind: "certificate",
      status: "draft",
      revision: 1,
      issuedIds: [],
      items: [],
      issuedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    await flush();
  });
});

it("stores issuance before retrying a failed parent refresh", async () => {
  const onChanged = vi.fn().mockResolvedValue(undefined);
  const { onOpenChange } = await renderEditor(onChanged);
  onChanged
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error("Refresh failed"))
    .mockResolvedValueOnce(undefined);
  await reviewAndIssue();
  await act(async () => {
    button("Issue")?.click();
    await flush();
  });
  expect(document.body.textContent).toContain("Refresh failed");
  expect(rpcMock.draftSetActions.issue).toHaveBeenCalledTimes(1);
  expect(button("Close")?.disabled).toBe(false);
  expect(button("Issue")).toBeUndefined();
  expect(button("Refresh")).toBeTruthy();
  await act(async () => {
    button("Refresh")?.click();
    await flush();
  });
  expect(rpcMock.draftSetActions.issue).toHaveBeenCalledTimes(1);
  expect(onChanged).toHaveBeenCalledTimes(3);
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

it("keeps preview and issued terms aligned after a failed save refresh", async () => {
  const onChanged = vi.fn().mockRejectedValueOnce(new Error("Refresh failed"));
  const { onOpenChange } = await renderEditor(onChanged);
  const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
  const saved = {
    id: "draft-1",
    name: "Test draft",
    securityKind: "certificate",
    status: "draft",
    revision: 1,
    issuedIds: [],
    items: [] as Record<string, unknown>[],
    issuedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  let savedItems: Record<string, unknown>[] = [];
  let issuedItems: Record<string, unknown>[] = [];
  rpcMock.draftSets.create.mockImplementation(
    async (input: { items: Record<string, unknown>[] }) => {
      savedItems = input.items;
      return { ...saved, items: savedItems };
    },
  );
  rpcMock.draftSets.update.mockImplementation(
    async (input: { expectedRevision: number; items: Record<string, unknown>[]; name: string }) => {
      savedItems = input.items;
      return {
        ...saved,
        name: input.name,
        revision: input.expectedRevision + 1,
        items: savedItems,
      };
    },
  );
  rpcMock.draftSetActions.review.mockImplementation(
    async (input: { expectedRevision: number; id: string }) => ({
      setId: input.id,
      revision: input.expectedRevision,
      items: [{ index: 0, problems: [] }],
      totalShares: String(savedItems[0]?.quantity ?? "0"),
      totalPrincipalCents: "0",
      ready: true,
    }),
  );
  rpcMock.draftSetActions.issue.mockImplementation(async (input: { expectedRevision: number }) => {
    issuedItems = savedItems;
    return {
      set: {
        ...saved,
        status: "issued",
        revision: input.expectedRevision,
        issuedIds: ["cert-1"],
        items: issuedItems,
        issuedAt: "2026-01-01T00:00:00.000Z",
      },
      issuedIds: ["cert-1"],
    };
  });

  await act(async () => {
    button("Review")?.click();
    await settle();
  });
  expect(document.body.textContent).toContain("Refresh failed");
  const shares = document.querySelector('input[aria-label="Shares"]') as HTMLInputElement;
  expect(shares.matches(":disabled")).toBe(true);
  expect(button("Refresh")).toBeTruthy();
  expect(button("Review")).toBeUndefined();
  expect(rpcMock.draftSetActions.review).not.toHaveBeenCalled();

  await act(async () => {
    button("Refresh")?.click();
    await settle();
  });
  expect(shares.matches(":disabled")).toBe(false);
  change('input[aria-label="Shares"]', "2000");
  await act(async () => {
    button("Review")?.click();
    await settle();
  });
  expect(rpcMock.draftSets.update).toHaveBeenCalledWith(
    expect.objectContaining({
      expectedRevision: 1,
      items: [expect.objectContaining({ quantity: "2000" })],
    }),
  );
  expect(rpcMock.draftSetActions.review).toHaveBeenCalledWith(
    expect.objectContaining({ expectedRevision: 2 }),
  );
  expect(document.body.textContent).toContain("2,000");
  await act(async () => {
    button("Issue")?.click();
    await settle();
  });
  expect(rpcMock.draftSetActions.issue).toHaveBeenCalledWith(
    expect.objectContaining({ expectedRevision: 2 }),
  );
  expect(savedItems[0]?.quantity).toBe("2000");
  expect(issuedItems[0]?.quantity).toBe("2000");
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

it("allows closing an issued draft after refresh failure without reissuing", async () => {
  const onChanged = vi.fn().mockResolvedValue(undefined);
  const { onOpenChange } = await renderEditor(onChanged);
  onChanged.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("Refresh failed"));
  await reviewAndIssue();
  await act(async () => {
    button("Issue")?.click();
    await flush();
  });
  expect(document.body.textContent).toContain("Refresh failed");
  expect(button("Close")).toBeTruthy();
  await act(async () => {
    button("Close")?.click();
    await flush();
  });
  expect(onOpenChange).toHaveBeenCalledWith(false);
  expect(rpcMock.draftSetActions.issue).toHaveBeenCalledTimes(1);
});

it("guards double-clicks while certificate issuance is in flight", async () => {
  const onChanged = vi.fn().mockResolvedValue(undefined);
  await renderEditor(onChanged);
  await reviewAndIssue();
  let release!: (value: unknown) => void;
  rpcMock.draftSetActions.issue.mockReturnValue(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  await act(async () => {
    button("Issue")?.click();
    button("Issue")?.click();
    await flush();
  });
  expect(rpcMock.draftSetActions.issue).toHaveBeenCalledTimes(1);
  await act(async () => {
    release({
      set: {
        id: "draft-1",
        name: "Test draft",
        securityKind: "certificate",
        status: "issued",
        revision: 1,
        issuedIds: ["cert-1"],
        items: [],
        issuedAt: "2026-01-01T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      issuedIds: ["cert-1"],
    });
    await new Promise((resolve) => setTimeout(resolve, 25));
  });
});
