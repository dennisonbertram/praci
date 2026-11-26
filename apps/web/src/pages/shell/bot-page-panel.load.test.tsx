// @vitest-environment jsdom

import { ORPCError } from "@orpc/client";
import type { BotPage } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  save: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  rename: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("../../lib/rpc", () => ({ rpc: { pages: mocks } }));
vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray) => parts.join(""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import type { PageRemoteUpdate } from "./bot-page-panel";
import { BotPagePanel } from "./bot-page-panel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom lays nothing out: ProseMirror asks for a caret's rect when it scrolls to it after a change.
const noRect = { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0 } as DOMRect;
for (const { prototype } of [Node, Element, Range])
  for (const name of ["getClientRects", "getBoundingClientRect"] as const)
    Object.defineProperty(prototype, name, {
      value: () => (name === "getClientRects" ? [noRect] : noRect),
      configurable: true,
    });
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
  vi.useRealTimers();
  vi.resetAllMocks();
});

it("reports a never-written page and renders its first remote save without a reload", async () => {
  const onPageChange = vi.fn();
  mocks.list.mockResolvedValue([]);
  mocks.get.mockResolvedValue(null);
  await act(async () => {
    root.render(<BotPagePanel botId="bot_demo" remote={null} onPageChange={onPageChange} />);
  });
  expect(onPageChange).toHaveBeenCalledWith(null);
  expect(container.querySelector('[role="textbox"]')).toBeNull();

  const page: BotPage = {
    id: "page_1",
    kind: "blocks",
    botId: "bot_demo",
    title: "Demo",
    content: "# Created by agent",
    revision: 1,
    updatedBy: "bot",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  mocks.list.mockResolvedValue([
    { id: "page_1", title: "Demo", revision: 1, updatedAt: page.updatedAt },
  ]);
  mocks.get.mockResolvedValue(page);
  await act(async () => {
    root.render(
      <BotPagePanel
        botId="bot_demo"
        remote={{ revision: 1, updatedBy: "bot", seq: 1 }}
        onPageChange={onPageChange}
      />,
    );
  });
  expect(onPageChange).toHaveBeenLastCalledWith(page);
  expect(container.querySelector('[role="textbox"]')?.textContent).toContain("Created by agent");
  expect(mocks.save).not.toHaveBeenCalled();
});

it("keeps a failed initial load visible instead of reporting a missing page", async () => {
  const onPageChange = vi.fn();
  mocks.list.mockResolvedValue([]);
  mocks.get.mockRejectedValue(new Error("Could not load the page."));
  await act(async () => {
    root.render(<BotPagePanel botId="bot_demo" remote={null} onPageChange={onPageChange} />);
  });
  expect(onPageChange).not.toHaveBeenCalled();
  expect(container.querySelector('[role="alert"]')?.textContent).toBe("Could not load the page.");
});

it("retries a failed first load", async () => {
  mocks.list.mockResolvedValue([]);
  mocks.get.mockRejectedValueOnce(new Error("Could not load the page."));
  mocks.get.mockResolvedValue(pageOf("p1", "Cash", "Loaded text"));
  await act(async () => {
    root.render(<BotPagePanel botId="bot_demo" remote={null} fixedPageId="p1" />);
  });
  expect(button("Retry")).toBeDefined();
  await act(async () => button("Retry")!.click());
  expect(container.querySelector('[role="textbox"]')?.textContent).toContain("Loaded text");
});

it("reports a missing page when Retry of a failed first load returns null", async () => {
  const onPageChange = vi.fn();
  let finishRetry: (page: BotPage | null) => void = () => undefined;
  mocks.list.mockResolvedValue([]);
  mocks.get.mockRejectedValueOnce(new Error("Could not load the page."));
  mocks.get.mockReturnValueOnce(new Promise((resolve) => (finishRetry = resolve)));
  await act(async () => {
    root.render(
      <BotPagePanel botId="bot_demo" remote={null} fixedPageId="p1" onPageChange={onPageChange} />,
    );
  });
  const retry = button("Retry")!;
  await act(async () => retry.click());
  expect(retry.disabled).toBe(true);
  await act(async () => finishRetry(null));
  expect(onPageChange).toHaveBeenCalledWith(null);
  expect(container.querySelector('[role="textbox"]')).toBeNull();
});

const summary = (id: string, title: string, revision = 1) => ({
  id,
  title,
  kind: "blocks" as const,
  revision,
  updatedAt: "2026-01-01T00:00:00.000Z",
});
const pageOf = (id: string, title: string, content: string, revision = 1): BotPage => ({
  ...summary(id, title, revision),
  botId: "bot_demo",
  content,
  updatedBy: "bot",
});

it("shows page titles as tabs, switches pages, and reloads only the page an event names", async () => {
  mocks.list.mockResolvedValue([summary("p1", "Cash"), summary("p2", "Burn")]);
  mocks.get.mockImplementation(async ({ pageId }: { pageId?: string }) =>
    pageId === "p2" ? pageOf("p2", "Burn", "Burn text") : pageOf("p1", "Cash", "Cash text"),
  );
  const render = (remote: PageRemoteUpdate | null) =>
    act(async () => {
      root.render(<BotPagePanel botId="bot_demo" remote={remote} />);
    });
  await render(null);
  const tabs = [...container.querySelectorAll('[role="tab"]')];
  expect(tabs.map((tab) => tab.textContent)).toEqual(["Cash", "Burn"]);
  expect(container.querySelector('[role="textbox"]')?.textContent).toContain("Cash text");
  expect(mocks.get).toHaveBeenLastCalledWith({ botId: "bot_demo", pageId: "p1" });

  await act(async () => {
    (tabs[1] as HTMLElement).click();
  });
  expect(mocks.get).toHaveBeenLastCalledWith({ botId: "bot_demo", pageId: "p2" });
  expect(container.querySelector('[role="textbox"]')?.textContent).toContain("Burn text");

  // An event for the page that is not open does not refetch; one for the open page does.
  mocks.get.mockClear();
  mocks.get.mockResolvedValue(pageOf("p2", "Burn", "Burn text v2", 2));
  await render({ pageId: "p1", revision: 2, updatedBy: "bot", seq: 1 });
  expect(mocks.get).not.toHaveBeenCalled();
  await render({ pageId: "p2", revision: 2, updatedBy: "bot", seq: 2 });
  expect(mocks.get).toHaveBeenCalledTimes(1);
  expect(mocks.get).toHaveBeenLastCalledWith({ botId: "bot_demo", pageId: "p2" });
  expect(container.querySelector('[role="textbox"]')?.textContent).toContain("Burn text v2");
});

it("clears the editor when a remote refresh says the page was deleted", async () => {
  mocks.list.mockResolvedValue([summary("p1", "Cash")]);
  mocks.get.mockResolvedValueOnce(pageOf("p1", "Cash", "Cash text"));
  await act(async () =>
    root.render(<BotPagePanel botId="bot_demo" remote={null} fixedPageId="p1" />),
  );
  expect(container.querySelector('[role="textbox"]')).not.toBeNull();
  mocks.get.mockRejectedValueOnce(new ORPCError("NOT_FOUND", { message: "Page not found" }));
  await act(async () =>
    root.render(
      <BotPagePanel
        botId="bot_demo"
        fixedPageId="p1"
        remote={{ pageId: "p1", revision: 2, updatedBy: "bot", seq: 1 }}
      />,
    ),
  );
  expect(container.querySelector('[role="alert"]')?.textContent).toBe("Page not found");
  expect(button("Retry")).toBeDefined();
  expect(container.querySelector('[role="textbox"]')).toBeNull();
});

it("keeps the editor after a transient remote refresh failure", async () => {
  mocks.list.mockResolvedValue([summary("p1", "Cash")]);
  mocks.get.mockResolvedValueOnce(pageOf("p1", "Cash", "Cash text"));
  await act(async () =>
    root.render(<BotPagePanel botId="bot_demo" remote={null} fixedPageId="p1" />),
  );
  mocks.get.mockRejectedValueOnce(new Error("offline"));
  await act(async () =>
    root.render(
      <BotPagePanel
        botId="bot_demo"
        fixedPageId="p1"
        remote={{ pageId: "p1", revision: 2, updatedBy: "bot", seq: 1 }}
      />,
    ),
  );
  expect(container.querySelector('[role="textbox"]')?.textContent).toContain("Cash text");
});

it("has no tab row for one page and creates a new page from the New page button", async () => {
  mocks.list.mockResolvedValue([summary("p1", "Cash")]);
  mocks.get.mockResolvedValue(pageOf("p1", "Cash", "Cash text"));
  await act(async () => {
    root.render(<BotPagePanel botId="bot_demo" remote={null} />);
  });
  expect(container.querySelector('[role="tab"]')).toBeNull();
  mocks.create.mockResolvedValue(pageOf("p2", "New page", ""));
  mocks.list.mockResolvedValue([summary("p1", "Cash"), summary("p2", "New page")]);
  const changed = vi.fn();
  window.addEventListener("praci:sidebar-pages-changed", changed);
  await act(async () => {
    (container.querySelector('[aria-label="New page"]') as HTMLElement).click();
  });
  window.removeEventListener("praci:sidebar-pages-changed", changed);
  expect(changed).toHaveBeenCalledTimes(1);
  expect(mocks.create).toHaveBeenCalledWith({ botId: "bot_demo", title: "New page" });
  expect(container.querySelectorAll('[role="tab"]')).toHaveLength(0);
  const title = container.querySelector('input[aria-label="Page title"]') as HTMLInputElement;
  expect(title).not.toBeNull();
  // The default title is selected, so typing a name replaces it.
  expect(document.activeElement).toBe(title);
  expect([title.selectionStart, title.selectionEnd]).toEqual([0, "New page".length]);
});

it("pins one page: no tabs or new button, reports its title, and reports a missing page", async () => {
  mocks.list.mockResolvedValue([summary("p1", "Cash"), summary("p2", "Burn")]);
  mocks.get.mockResolvedValue(pageOf("p2", "Burn", "Burn text"));
  const onTitle = vi.fn();
  const onMissing = vi.fn();
  await act(async () => {
    root.render(
      <BotPagePanel
        botId="bot_demo"
        remote={null}
        fixedPageId="p2"
        onTitle={onTitle}
        onMissing={onMissing}
      />,
    );
  });
  expect(container.querySelector('[role="tab"]')).toBeNull();
  expect(container.querySelector('[aria-label="New page"]')).toBeNull();
  expect(mocks.get).toHaveBeenLastCalledWith({ botId: "bot_demo", pageId: "p2" });
  expect(onTitle).toHaveBeenCalledWith("Burn");
  expect(onMissing).not.toHaveBeenCalled();

  await act(async () => {
    root.render(
      <BotPagePanel botId="bot_demo" remote={null} fixedPageId="gone" onMissing={onMissing} />,
    );
  });
  expect(onMissing).toHaveBeenCalled();
});

it("lets the page tab strip scroll sideways without hiding the options and New page buttons", async () => {
  const summaries = ["Cash", "Burn", "Pipeline"].map((title, i) => ({
    id: `page_${i}`,
    title,
    revision: 1,
    updatedAt: "2026-01-01T00:00:00.000Z",
  }));
  mocks.list.mockResolvedValue(summaries);
  mocks.get.mockResolvedValue(null);
  await act(async () => {
    root.render(<BotPagePanel botId="bot_demo" remote={null} />);
  });
  const list = container.querySelector('[role="tablist"]');
  expect(list?.className).toMatch(/(^|\s)overflow-x-auto(\s|$)/);
  for (const tab of container.querySelectorAll('[role="tab"]')) {
    expect(tab.className).toContain("flex-none");
  }
  expect(container.querySelector('[aria-label="New page"]')?.className).toContain("shrink-0");
});

/**
 * jsdom cannot type into a contenteditable, so this replaces the paragraph's text and lets
 * ProseMirror read the DOM change, as it does after real input, then waits out the save delay.
 */
const typeIntoEditor = async (text: string, wait: number | null = 900) => {
  const box = container.querySelector('[role="textbox"]') as HTMLElement;
  const paragraph = box.querySelector("p") as HTMLElement;
  const range = document.createRange();
  range.selectNodeContents(paragraph);
  range.collapse(false);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  paragraph.textContent = text;
  paragraph.dispatchEvent(
    new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }),
  );
  if (wait !== null) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, wait));
    });
  }
};
const button = (label: string) =>
  [...container.querySelectorAll("button")].find((entry) => entry.textContent === label);

it("retries a failed save with the same base revision", async () => {
  mocks.list.mockResolvedValue([summary("p1", "Cash")]);
  mocks.get.mockResolvedValue(pageOf("p1", "Cash", "Cash text"));
  mocks.save.mockRejectedValueOnce(new Error("Could not save the page."));
  mocks.save.mockResolvedValueOnce({ ok: true, page: pageOf("p1", "Cash", "Cash text edited", 2) });
  await act(async () => {
    root.render(<BotPagePanel botId="bot_demo" remote={null} />);
  });
  vi.useFakeTimers();
  await typeIntoEditor("Cash text edited", null);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(800);
  });
  expect(container.querySelector('[role="alert"]')?.textContent).toBe("Could not save the page.");
  await act(async () => button("Retry")!.click());
  expect(mocks.save).toHaveBeenCalledTimes(2);
  expect(mocks.save.mock.calls[0]?.[0]).toMatchObject({ baseRevision: 1 });
  expect(mocks.save.mock.calls[1]?.[0]).toMatchObject({ baseRevision: 1 });
  expect(container.querySelector('[role="alert"]')).toBeNull();
  vi.useRealTimers();
});

it("clears a failed save when Retry finds no draft to save", async () => {
  mocks.list.mockResolvedValue([summary("p1", "Cash")]);
  mocks.get.mockResolvedValue(pageOf("p1", "Cash", "Cash text"));
  mocks.save.mockRejectedValueOnce(new Error("Could not save the page."));
  await act(async () => root.render(<BotPagePanel botId="bot_demo" remote={null} />));
  await typeIntoEditor("Cash text edited");
  await typeIntoEditor("Cash text");
  expect(container.querySelector('[role="alert"]')?.textContent).toBe("Could not save the page.");
  await act(async () => button("Retry")!.click());
  expect(mocks.save).toHaveBeenCalledTimes(1);
  expect(container.querySelector('[role="alert"]')).toBeNull();
});

it("disables save Retry while its save request is running", async () => {
  mocks.list.mockResolvedValue([summary("p1", "Cash")]);
  mocks.get.mockResolvedValue(pageOf("p1", "Cash", "Cash text"));
  mocks.save.mockRejectedValueOnce(new Error("Could not save the page."));
  let finish: (value: { ok: true; page: BotPage }) => void = () => undefined;
  mocks.save.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
  await act(async () => root.render(<BotPagePanel botId="bot_demo" remote={null} />));
  await typeIntoEditor("Cash text edited");
  const retry = button("Retry")!;
  await act(async () => retry.click());
  expect(retry.disabled).toBe(true);
  await act(async () => finish({ ok: true, page: pageOf("p1", "Cash", "Cash text edited", 2) }));
});

it("hides save Retry while Page changed is shown", async () => {
  mocks.list.mockResolvedValue([summary("p1", "Cash")]);
  mocks.get.mockResolvedValue(pageOf("p1", "Cash", "Cash text"));
  mocks.save.mockRejectedValueOnce(new Error("Could not save the page."));
  await act(async () => root.render(<BotPagePanel botId="bot_demo" remote={null} />));
  await typeIntoEditor("Cash text edited");
  expect(button("Retry")).toBeDefined();
  await act(async () => {
    root.render(
      <BotPagePanel botId="bot_demo" remote={{ revision: 2, updatedBy: "user", seq: 1 }} />,
    );
  });
  expect(container.textContent).toContain("Page changed.");
  expect(button("Retry")).toBeUndefined();
});

it("keeps the typed page when a save conflicts and saves it over the newer revision", async () => {
  mocks.list.mockResolvedValue([summary("p1", "Cash")]);
  mocks.get.mockResolvedValue(pageOf("p1", "Cash", "Cash text"));
  mocks.save.mockResolvedValue({
    ok: false,
    reason: "conflict",
    page: pageOf("p1", "Cash", "Agent text", 2),
  });
  await act(async () => {
    root.render(<BotPagePanel botId="bot_demo" remote={null} />);
  });
  await typeIntoEditor("Cash text edited");
  expect(button("Reload")).toBeDefined();
  expect(button("Keep mine")).toBeDefined();
  // The draft stays in the editor and stays editable.
  const box = container.querySelector('[role="textbox"]') as HTMLElement;
  expect(box.textContent).toContain("Cash text edited");
  expect(box.getAttribute("contenteditable")).not.toBe("false");

  mocks.get.mockResolvedValue(pageOf("p1", "Cash", "Agent text", 2));
  mocks.save.mockResolvedValue({ ok: true, page: pageOf("p1", "Cash", "Cash text edited", 3) });
  mocks.save.mockClear();
  await act(async () => button("Keep mine")!.click());
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  expect(mocks.get).toHaveBeenLastCalledWith({ botId: "bot_demo", pageId: "p1" });
  expect(mocks.save).toHaveBeenCalledTimes(1);
  expect(mocks.save).toHaveBeenCalledWith({
    botId: "bot_demo",
    pageId: "p1",
    content: "Cash text edited",
    baseRevision: 2,
  });
  expect(container.textContent).not.toContain("Page changed.");
});

it("reloads the saved page and drops the draft on Reload", async () => {
  mocks.list.mockResolvedValue([summary("p1", "Cash")]);
  mocks.get.mockResolvedValue(pageOf("p1", "Cash", "Cash text"));
  mocks.save.mockResolvedValue({
    ok: false,
    reason: "conflict",
    page: pageOf("p1", "Cash", "Agent text", 2),
  });
  await act(async () => {
    root.render(<BotPagePanel botId="bot_demo" remote={null} />);
  });
  await typeIntoEditor("Cash text edited");
  mocks.get.mockResolvedValue(pageOf("p1", "Cash", "Agent text", 2));
  mocks.save.mockClear();
  await act(async () => button("Reload")!.click());
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  expect(container.querySelector('[role="textbox"]')?.textContent).toContain("Agent text");
  expect(mocks.save).not.toHaveBeenCalled();
  expect(container.textContent).not.toContain("Page changed.");
});

it("offers the same choice when a page changes remotely while the editor is dirty", async () => {
  mocks.list.mockResolvedValue([summary("p1", "Cash")]);
  mocks.get.mockResolvedValue(pageOf("p1", "Cash", "Cash text"));
  mocks.save.mockResolvedValue({ ok: true, page: pageOf("p1", "Cash", "Cash text edited", 2) });
  const render = (remote: PageRemoteUpdate | null) =>
    act(async () => {
      root.render(<BotPagePanel botId="bot_demo" remote={remote} />);
    });
  await render(null);
  // Typed, but before the autosave delay has passed.
  await typeIntoEditor("Cash text edited", 60);
  expect(mocks.save).not.toHaveBeenCalled();
  mocks.get.mockResolvedValue(pageOf("p1", "Cash", "Agent text", 7));
  await render({ pageId: "p1", revision: 7, updatedBy: "bot", seq: 1 });
  expect(button("Reload")).toBeDefined();
  expect(container.querySelector('[role="textbox"]')?.textContent).toContain("Cash text edited");
  await act(async () => button("Keep mine")!.click());
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  expect(mocks.save).toHaveBeenCalledWith({
    botId: "bot_demo",
    pageId: "p1",
    content: "Cash text edited",
    baseRevision: 7,
  });
});

it("saves the owner's text even after they undo back to the old page", async () => {
  mocks.list.mockResolvedValue([summary("p1", "Cash")]);
  mocks.get.mockResolvedValue(pageOf("p1", "Cash", "A"));
  mocks.save.mockResolvedValue({
    ok: false,
    reason: "conflict",
    page: pageOf("p1", "Cash", "C", 2),
  });
  await act(async () => {
    root.render(<BotPagePanel botId="bot_demo" remote={null} />);
  });
  await typeIntoEditor("AB");
  expect(button("Keep mine")).toBeDefined();
  // Undoing back to the text the page had means the draft matches the old baseline, not the server's.
  await typeIntoEditor("A", 100);
  mocks.get.mockResolvedValue(pageOf("p1", "Cash", "C", 2));
  mocks.save.mockResolvedValue({ ok: true, page: pageOf("p1", "Cash", "A", 3) });
  mocks.save.mockClear();
  await act(async () => button("Keep mine")!.click());
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  expect(mocks.save).toHaveBeenCalledWith({
    botId: "bot_demo",
    pageId: "p1",
    content: "A",
    baseRevision: 2,
  });
});

it("tells the sidebar once when a page is renamed", async () => {
  mocks.list.mockResolvedValue([summary("p1", "Cash")]);
  mocks.get.mockResolvedValue(pageOf("p1", "Cash", "Cash text"));
  mocks.create.mockResolvedValue(pageOf("p2", "New page", ""));
  mocks.rename.mockResolvedValue(summary("p2", "Burn"));
  mocks.list.mockResolvedValue([summary("p1", "Cash"), summary("p2", "New page")]);
  await act(async () => {
    root.render(<BotPagePanel botId="bot_demo" remote={null} />);
  });
  await act(async () => {
    (container.querySelector('[aria-label="New page"]') as HTMLElement).click();
  });
  const changed = vi.fn();
  window.addEventListener("praci:sidebar-pages-changed", changed);
  const title = container.querySelector('input[aria-label="Page title"]') as HTMLInputElement;
  title.value = "Burn";
  await act(async () => {
    title.form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  window.removeEventListener("praci:sidebar-pages-changed", changed);
  expect(mocks.rename).toHaveBeenCalledTimes(1);
  expect(changed).toHaveBeenCalledTimes(1);
});

/** Opens a new page, which starts its title field selected and ready for a name. */
const openNewPage = async () => {
  mocks.list.mockResolvedValue([summary("p1", "Cash"), summary("p2", "New page")]);
  mocks.get.mockResolvedValue(pageOf("p1", "Cash", "Cash text"));
  mocks.create.mockResolvedValue(pageOf("p2", "New page", ""));
  mocks.rename.mockResolvedValue(summary("p2", "Q3 plan"));
  await act(async () => {
    root.render(<BotPagePanel botId="bot_demo" remote={null} />);
  });
  await act(async () => {
    (container.querySelector('[aria-label="New page"]') as HTMLElement).click();
  });
  return container.querySelector('input[aria-label="Page title"]') as HTMLInputElement;
};
const blur = (input: HTMLInputElement) =>
  act(async () => {
    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

it("renames the page with the typed name when the title field loses focus", async () => {
  const title = await openNewPage();
  title.value = "Q3 plan";
  await blur(title);
  expect(mocks.rename).toHaveBeenCalledTimes(1);
  expect(mocks.rename).toHaveBeenCalledWith({ botId: "bot_demo", pageId: "p2", title: "Q3 plan" });
});

it("leaves the page name alone when Escape cancels the title field", async () => {
  const title = await openNewPage();
  title.value = "Q3 plan";
  await act(async () => {
    title.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
  await blur(title);
  expect(mocks.rename).not.toHaveBeenCalled();
  expect(container.querySelector('input[aria-label="Page title"]')).toBeNull();
});

it("renames once when Enter is followed by the title field going away", async () => {
  const title = await openNewPage();
  title.value = "Q3 plan";
  await act(async () => {
    title.form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  await blur(title);
  expect(mocks.rename).toHaveBeenCalledTimes(1);
  expect(mocks.rename).toHaveBeenCalledWith({ botId: "bot_demo", pageId: "p2", title: "Q3 plan" });
});

it("renames a new page by its typed name without pressing Enter", async () => {
  const title = await openNewPage();
  title.value = "Q3 plan";
  // Leaving the field alone commits, so a new page never keeps its placeholder name.
  await blur(title);
  expect(container.querySelector('input[aria-label="Page title"]')).toBeNull();
  expect(mocks.rename).toHaveBeenCalledWith({ botId: "bot_demo", pageId: "p2", title: "Q3 plan" });
});
