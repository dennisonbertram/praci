// @vitest-environment jsdom

import type { EquityDocumentLink } from "@rakazo/contracts";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));
const rpcMock = vi.hoisted(() => ({
  equity: {
    documentLinks: { list: vi.fn(), create: vi.fn(), delete: vi.fn() },
    stakeholders: { list: vi.fn() },
    certificates: { list: vi.fn() },
    fundingRounds: { list: vi.fn() },
  },
  dataRoom: { items: { list: vi.fn() } },
}));
vi.mock("../../../lib/rpc", () => ({ rpc: rpcMock }));

import { DocumentLinks } from "./DocumentLinks";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const link = (
  id: string,
  name: string,
  target: EquityDocumentLink["target"],
  targetLabel: string,
): EquityDocumentLink => ({
  id,
  dataRoomItemId: `doc-${id}`,
  name,
  target,
  targetLabel,
  createdAt: "2026-10-05T14:30:00.000Z",
});

const demoLinks: EquityDocumentLink[] = [
  link(
    "l1",
    "Stock purchase agreement.pdf",
    { kind: "stakeholder", id: "s2" },
    "Blue Example Fund",
  ),
  link("l2", "Certificate ledger.pdf", { kind: "certificate", id: "c1" }, "CS-12"),
  link("l3", "Subscription agreement.pdf", { kind: "round", id: "r1" }, "Series A"),
];

const page = <T,>(items: T[]) => ({ items, total: items.length, page: 1, pageSize: 500 });

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  rpcMock.equity.documentLinks.list.mockReset().mockResolvedValue(demoLinks);
  rpcMock.equity.documentLinks.create.mockReset().mockResolvedValue(demoLinks[0]);
  rpcMock.equity.documentLinks.delete.mockReset().mockResolvedValue({ ok: true });
  rpcMock.equity.stakeholders.list
    .mockReset()
    .mockResolvedValue(page([{ id: "s2", name: "Blue Example Fund" }]));
  rpcMock.equity.certificates.list
    .mockReset()
    .mockResolvedValue(page([{ id: "c1", label: "CS-12" }]));
  rpcMock.equity.fundingRounds.list
    .mockReset()
    .mockResolvedValue(page([{ id: "r1", name: "Series A" }]));
  rpcMock.dataRoom.items.list.mockReset().mockResolvedValue({
    items: [
      {
        id: "d1",
        name: "Letter.pdf",
        mimeType: "application/pdf",
        size: 1,
        folderId: null,
        source: "upload",
      },
      {
        id: "d2",
        name: "Notes",
        mimeType: "text/plain",
        size: 1,
        folderId: null,
        source: "meeting",
      },
    ],
    nextCursor: null,
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.textContent = "";
});

const selectByLabel = (label: string) =>
  document.querySelector(`select[aria-label="${label}"]`) as HTMLSelectElement;

const choose = async (select: HTMLSelectElement, value: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
};

it("renders one row per link", async () => {
  await act(async () => root.render(<DocumentLinks />));
  expect(host.textContent).toContain("Stock purchase agreement.pdf");
  expect(host.textContent).toContain("Stakeholder Blue Example Fund");
  expect(host.textContent).toContain("Certificate CS-12");
  expect(host.textContent).toContain("Round Series A");
  expect(host.textContent).toContain("Oct 5, 2026");
  expect(
    [...host.querySelectorAll("button")].filter((b) => b.textContent === "Detach"),
  ).toHaveLength(3);
});

it("detaches a link with its id and removes the row", async () => {
  await act(async () => root.render(<DocumentLinks />));
  const detach = [...host.querySelectorAll("button")].filter((b) => b.textContent === "Detach")[1]!;
  await act(async () => detach.click());
  expect(rpcMock.equity.documentLinks.delete).toHaveBeenCalledWith({ id: "l2" });
  expect(host.textContent).not.toContain("Certificate ledger.pdf");
});

it("attaches a document to a round", async () => {
  await act(async () => root.render(<DocumentLinks />));
  const attach = [...host.querySelectorAll("button")].find(
    (b) => b.textContent === "Attach document",
  )!;
  await act(async () => attach.click());
  await choose(selectByLabel("Document"), "d1");
  await choose(selectByLabel("Attach to"), "round");
  await choose(selectByLabel("Round"), "r1");
  const save = [...document.querySelectorAll("button")].find((b) => b.textContent === "Save")!;
  await act(async () => save.click());
  expect(rpcMock.equity.documentLinks.create).toHaveBeenCalledWith({
    dataRoomItemId: "d1",
    target: { kind: "round", id: "r1" },
  });
  expect(host.textContent).toContain("Stock purchase agreement.pdf");
});
