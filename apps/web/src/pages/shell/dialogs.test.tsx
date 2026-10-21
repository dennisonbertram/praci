// @vitest-environment jsdom

import type { ComponentProps, ReactNode } from "react";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, index) => `${text}${index > 0 ? values[index - 1] : ""}${part}`, "");
  return { useLingui: () => ({ t }), Trans: ({ children }: { children: ReactNode }) => children };
});
vi.mock("@rakazo/ui-web", () => ({
  Button: (props: ComponentProps<"button">) => <button {...props} />,
  Input: (props: ComponentProps<"input">) => <input {...props} />,
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  AlertDialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogAction: (props: ComponentProps<"button">) => <button {...props} />,
  AlertDialogCancel: (props: ComponentProps<"button">) => <button {...props} />,
  AlertDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

const memoryList = vi.hoisted(() => vi.fn());
vi.mock("../../lib/rpc", () => ({ rpc: { memory: { list: memoryList } } }));

import type { Bot } from "@rakazo/contracts";
import { DeleteBotDialog, RenameBotSectionDialog, RenameSpaceDialog } from "./dialogs";

let container: HTMLDivElement;
let root: Root;

async function render(onConfirm: (name: string) => Promise<void>) {
  await act(async () => {
    root.render(
      <RenameSpaceDialog
        space={{ name: "Personal" }}
        onCancel={() => undefined}
        onConfirm={onConfirm}
      />,
    );
  });
}

function nameField(): HTMLInputElement {
  const input = container.querySelector("input");
  if (!input) throw new Error("Missing name field");
  return input;
}

async function submit(name: string) {
  const input = nameField();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, name);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const save = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Save",
  );
  if (!(save instanceof HTMLButtonElement)) throw new Error("Missing Save button");
  await act(async () => {
    save.click();
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("RenameSpaceDialog", () => {
  it("falls back to the generic error when the failure message is blank", async () => {
    await render(async () => {
      throw new Error("   ");
    });
    await submit("Support");
    expect(container.textContent).toContain("Could not rename space");
  });

  it("shows a non-blank failure message", async () => {
    await render(async () => {
      throw new Error("Space deletion is already in progress");
    });
    await submit("Support");
    expect(container.textContent).toContain("Space deletion is already in progress");
  });
});

describe("RenameBotSectionDialog", () => {
  it("refuses a name another folder already has without sending it", async () => {
    const onConfirm = vi.fn(async () => undefined);
    await act(async () => {
      root.render(
        <RenameBotSectionDialog
          section={{ name: "Ops" }}
          takenNames={["Ops", "Sales"]}
          onCancel={() => undefined}
          onConfirm={onConfirm}
        />,
      );
    });
    await submit("Sales");
    expect(container.textContent).toContain("A folder with that name already exists");
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe("DeleteBotDialog", () => {
  const bot = { id: "bot_1", name: "Helper" } as Bot;
  async function renderDelete() {
    await act(async () => {
      root.render(
        <DeleteBotDialog bot={bot} onCancel={() => undefined} onConfirm={async () => undefined} />,
      );
    });
  }

  it("skips the memory question for a bot with no memories", async () => {
    memoryList.mockResolvedValue([]);
    await renderDelete();
    expect(memoryList).toHaveBeenCalledWith({ botId: "bot_1", scope: "bot" });
    expect(container.textContent).toContain("Delete Helper?");
    expect(container.textContent).not.toContain("What about its memories?");
  });

  it("skips the memory question when the only document is the new-bot heading", async () => {
    memoryList.mockResolvedValue([{ id: "m1", content: "# Helper\n\n" }]);
    await renderDelete();
    expect(container.textContent).not.toContain("What about its memories?");
  });

  it("asks when the bot has memories, and when they cannot be checked", async () => {
    memoryList.mockResolvedValue([{ id: "m1", content: "# Helper\n\nPrefers short replies." }]);
    await renderDelete();
    expect(container.textContent).toContain("What about its memories?");
    memoryList.mockRejectedValue(new Error("offline"));
    await renderDelete();
    expect(container.textContent).toContain("What about its memories?");
  });
});
