// @vitest-environment jsdom

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((text, part, i) => `${text}${part}${i < values.length ? values[i] : ""}`, ""),
  }),
  Trans: ({ children }: { children: string }) => children,
}));
vi.mock("../sidebar-glance", () => ({
  StatusMark: ({ kind }: { kind: string }) => <span data-testid="status" data-kind={kind} />,
}));

import type { DropResult } from "./drop-target";
import { FolderListDemo } from "./SidebarDnd.stories";

i18n.loadAndActivate({ locale: "en", messages: {} });
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLElement;
const moved: DropResult[] = [];

beforeEach(async () => {
  moved.length = 0;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  // jsdom has no layout: stack the rows so the keyboard sensor can tell up from down.
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const all = [...document.querySelectorAll("[data-sidebar-folder], [data-roster-bot-id]")];
    const index = Math.max(0, all.indexOf(this));
    return {
      x: 0,
      y: index * 40,
      top: index * 40,
      bottom: index * 40 + 36,
      left: 0,
      right: 300,
      width: 300,
      height: 36,
      toJSON: () => ({}),
    } as DOMRect;
  });
  await act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <FolderListDemo onMoved={(result) => moved.push(result)} />
      </I18nProvider>,
    ),
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

const rowIds = () =>
  [...container.querySelectorAll("[data-sidebar-folder], [data-roster-bot-id]")].map(
    (node) => node.getAttribute("data-sidebar-folder") ?? node.getAttribute("data-roster-bot-id"),
  );
const click = (node: Element | null) =>
  act(async () => {
    node?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
const key = (node: Element | Document, code: string) =>
  act(async () => {
    node.dispatchEvent(
      new KeyboardEvent("keydown", { code, key: code, bubbles: true, cancelable: true }),
    );
  });

describe("sidebar folders", () => {
  it("shows folders with their rows, and the unfiled rows after them", () => {
    expect(rowIds()).toEqual([
      "workspace",
      "ledger",
      "counsel",
      "apps",
      "chief",
      "scout",
      "operations",
    ]);
    expect(container.querySelector("[data-sidebar-folder=workspace]")?.textContent).toContain("2");
  });

  it("keeps a closed folder's status visible and drops it once open", async () => {
    const apps = container.querySelector("[data-sidebar-folder=apps]")!;
    expect(apps.querySelector("[data-kind=needs_input]")).not.toBeNull();
    await click(apps.querySelector("button"));
    expect(rowIds()).toContain("relay");
    expect(apps.querySelector("[data-kind=needs_input]")).toBeNull();
  });

  it("shows an unread dot on a closed folder with unread chats and no status", async () => {
    const workspace = container.querySelector("[data-sidebar-folder=workspace]")!;
    expect(workspace.querySelector("[data-testid=folder-unread]")).toBeNull();
    await click(workspace.querySelector("button"));
    expect(rowIds()).not.toContain("ledger");
    expect(workspace.querySelector("[data-testid=folder-unread]")).not.toBeNull();
  });

  it("renames in place and deletes a folder without deleting its chats", async () => {
    const menu = async (name: string, item: string) => {
      await click(container.querySelector(`[aria-label="Actions for ${name}"]`));
      const entry = [...document.querySelectorAll("[role=menuitem]")].find(
        (node) => node.textContent === item,
      );
      expect(entry).toBeDefined();
      await click(entry ?? null);
    };
    await menu("Workspace", "Rename");
    const input = container.querySelector<HTMLInputElement>("input")!;
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setValue.call(input, "Money");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await key(input, "Enter");
    expect(container.querySelector("[data-sidebar-folder=workspace]")?.textContent).toContain(
      "Money",
    );

    await menu("Money", "Delete folder");
    expect(container.querySelector("[data-sidebar-folder=workspace]")).toBeNull();
    expect(rowIds()).toContain("ledger");
    expect(rowIds()).toContain("counsel");
  });

  it("moves a row with the keyboard: space picks up, arrows move, space drops", async () => {
    const chief = container.querySelector<HTMLElement>("[data-roster-bot-id=chief]")!;
    chief.focus();
    await key(chief, "Space");
    await key(document, "ArrowUp");
    await key(document, "Space");
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
    // Arrow up from the first unfiled chat reaches a folder above it, and the chat moves in.
    expect(moved).toHaveLength(1);
    expect(moved[0]).toMatchObject({ type: "item", item: { kind: "bot", id: "chief" } });
    expect(moved[0]).toHaveProperty("folderId", expect.any(String));
    const ids = rowIds();
    expect(ids.indexOf("chief")).toBeLessThan(ids.indexOf("apps"));
  });
});
