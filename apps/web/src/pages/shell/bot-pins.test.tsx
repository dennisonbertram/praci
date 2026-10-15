// @vitest-environment jsdom

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import type { BotPins } from "@rakazo/contracts";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.hoisted(() => ({
  pins: { get: vi.fn(), save: vi.fn(), refresh: vi.fn() },
}));
vi.mock("../../lib/rpc", () => ({ rpc: rpcMock }));

import { PinsList, PinsStrip } from "./bot-pins";

i18n.loadAndActivate({ locale: "en", messages: {} });
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const base = (over: Partial<BotPins>): BotPins => ({
  botId: "bot-1",
  stats: [],
  list: null,
  revision: 1,
  updatedBy: "bot",
  updatedAt: "2026-01-01T00:00:00.000Z",
  refreshedAt: null,
  ...over,
});

const listPins = base({
  list: {
    title: "Launch",
    items: [
      { id: "a", text: "Write copy", done: false },
      { id: "b", text: "Book venue", done: true },
    ],
  },
});

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  vi.clearAllMocks();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (node: React.ReactNode) =>
  act(async () => root.render(<I18nProvider i18n={i18n}>{node}</I18nProvider>));
const flush = () => act(async () => {});
const $ = (selector: string) => container.querySelector(selector) as HTMLElement;
function type(input: HTMLInputElement, value: string) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
const key = (el: HTMLElement, k: string) =>
  act(async () => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
  });
const savedList = () => rpcMock.pins.save.mock.calls.at(-1)?.[0];

describe("PinsStrip", () => {
  it("renders nothing without stats", async () => {
    await render(<PinsStrip pins={base({})} onPins={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("shows label, value and detail, and refreshes", async () => {
    const refreshed = base({
      stats: [{ id: "s", label: "Revenue", value: "$9", detail: "of goal" }],
    });
    rpcMock.pins.refresh.mockResolvedValue({ pins: refreshed, botRun: false });
    const onPins = vi.fn();
    await render(
      <PinsStrip
        pins={base({
          stats: [
            { id: "s", label: "Revenue", value: "$1", detail: "of goal", error: "Source failed" },
          ],
        })}
        onPins={onPins}
      />,
    );
    expect(container.textContent).toContain("Revenue");
    expect(container.textContent).toContain("$1");
    expect(container.textContent).toContain("of goal");
    expect(container.querySelector('[aria-label="Source failed"]')).not.toBeNull();
    await act(async () => $('button[aria-label="Refresh"]').click());
    expect(rpcMock.pins.refresh).toHaveBeenCalledWith({ botId: "bot-1" });
    expect(onPins).toHaveBeenCalledWith(refreshed);
  });
});

describe("PinsList", () => {
  it("renders nothing without a list", async () => {
    await render(<PinsList pins={base({})} onPins={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("saves a ticked item with the base revision", async () => {
    const next = base({ revision: 2 });
    rpcMock.pins.save.mockResolvedValue({ ok: true, pins: next });
    const onPins = vi.fn();
    await render(<PinsList pins={listPins} onPins={onPins} />);
    await act(async () => $('[role="checkbox"][aria-label="Write copy"]').click());
    await flush();
    expect(savedList().baseRevision).toBe(1);
    expect(savedList().list.items[0]).toEqual({ id: "a", text: "Write copy", done: true });
    expect(onPins).toHaveBeenCalledWith(next);
  });

  it("edits text on Enter, cancels on Escape, and deletes when emptied", async () => {
    rpcMock.pins.save.mockResolvedValue({ ok: true, pins: listPins });
    await render(<PinsList pins={listPins} onPins={vi.fn()} />);
    const open = async () => {
      const button = [...container.querySelectorAll("button")].find(
        (b) => b.textContent === "Write copy",
      ) as HTMLElement;
      await act(async () => button.click());
      return $("input[aria-label='Write copy']") as HTMLInputElement;
    };

    let input = await open();
    await act(async () => type(input, "Never saved"));
    await key(input, "Escape");
    expect(rpcMock.pins.save).not.toHaveBeenCalled();

    input = await open();
    await act(async () => type(input, "Write better copy"));
    await key(input, "Enter");
    await flush();
    expect(savedList().list.items[0].text).toBe("Write better copy");

    input = await open();
    await act(async () => type(input, "  "));
    await key(input, "Enter");
    await flush();
    expect(savedList().list.items.map((i: { id: string }) => i.id)).toEqual(["b"]);
  });

  it("adds an item with a generated id", async () => {
    rpcMock.pins.save.mockResolvedValue({ ok: true, pins: listPins });
    await render(<PinsList pins={listPins} onPins={vi.fn()} />);
    const input = $('input[placeholder="Add item"]') as HTMLInputElement;
    await act(async () => type(input, "Send invites"));
    await key(input, "Enter");
    await flush();
    const added = savedList().list.items.at(-1);
    expect(added).toMatchObject({ text: "Send invites", done: false });
    expect(added.id).toHaveLength(12);
  });

  it("shows the returned pins and a notice on conflict", async () => {
    const theirs = base({
      revision: 5,
      list: { title: "Launch", items: [{ id: "z", text: "Bot item", done: false }] },
    });
    rpcMock.pins.save.mockResolvedValue({ ok: false, reason: "conflict", pins: theirs });
    const onPins = vi.fn();
    await render(<PinsList pins={listPins} onPins={onPins} />);
    await act(async () => $('[role="checkbox"][aria-label="Write copy"]').click());
    await flush();
    expect(onPins).toHaveBeenCalledWith(theirs);
    expect(container.textContent).toContain("Your last edit wasn't saved.");
  });
});
