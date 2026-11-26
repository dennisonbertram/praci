// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { demoRequest } from "./fixtures";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));
const rpcMock = vi.hoisted(() => ({
  dataRoom: { items: { list: vi.fn() } },
  investors: { share: vi.fn() },
}));
vi.mock("../../../lib/rpc", () => ({ rpc: rpcMock }));

import { DeliverDocument } from "./DeliverDocument";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
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
  rpcMock.investors.share.mockReset().mockResolvedValue({ links: [] });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

it("shares the document with each reachable holder's contact", async () => {
  const onOpenChange = vi.fn();
  const holders = [demoRequest, { ...demoRequest, stakeholderId: "s9", contactId: null }];
  await act(async () =>
    root.render(<DeliverDocument holders={holders} open onOpenChange={onOpenChange} />),
  );
  const select = document.querySelector('[role="dialog"] select') as HTMLSelectElement;
  expect([...select.options].map((o) => o.value)).toEqual(["", "d1"]);
  expect(document.body.textContent).toContain("1 without an investor contact");
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(select, "d1");
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const button = [...document.querySelectorAll("button")].find(
    (b) => b.textContent === "Deliver to 1",
  )!;
  await act(async () => button.click());
  expect(rpcMock.investors.share).toHaveBeenCalledWith({
    itemId: "d1",
    contactIds: ["c2"],
    emailLink: true,
    requestKey: expect.any(String),
  });
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

it("retries a failed delivery with the same key, and a reopened dialog gets a new one", async () => {
  rpcMock.investors.share
    .mockRejectedValueOnce(new Error("timeout"))
    .mockResolvedValue({ links: [] });
  const render = (open: boolean) =>
    act(async () =>
      root.render(<DeliverDocument holders={[demoRequest]} open={open} onOpenChange={vi.fn()} />),
    );
  await render(true);
  const select = document.querySelector('[role="dialog"] select') as HTMLSelectElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(select, "d1");
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const deliver = () =>
    act(async () =>
      [...document.querySelectorAll("button")]
        .find((b) => b.textContent === "Deliver to 1")!
        .click(),
    );
  await deliver();
  await deliver();
  const keys = rpcMock.investors.share.mock.calls.map(([arg]) => arg.requestKey);
  expect(keys[0]).toEqual(expect.any(String));
  expect(keys[1]).toBe(keys[0]);
  await render(false);
  await render(true);
  await deliver();
  const reopened = rpcMock.investors.share.mock.calls[2]![0].requestKey;
  expect(reopened).toEqual(expect.any(String));
  expect(reopened).not.toBe(keys[0]);
});
