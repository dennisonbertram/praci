// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act, createRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, i) => text + part + String(values[i] ?? ""), "");
  return { useLingui: () => ({ t }), Trans: ({ children }: { children: ReactNode }) => children };
});
vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, i) => text + part + String(values[i] ?? ""), ""),
}));

import { Composer } from "./composer";

let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.matchMedia = (() => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as never;
  root = createRoot(document.body.appendChild(document.createElement("div")));
});
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
});

it("Retry resends the restored draft with its nonce and clears it once the send succeeds", async () => {
  const onSend = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
  const onRetrySend = vi.fn();
  const ui = (sendError: string | null) => (
    <Composer
      activeName="Agent"
      running={false}
      pendingAttachments={[]}
      attachmentNotice={null}
      sendError={sendError}
      runError={null}
      runErrorId={null}
      onRunErrorPresented={() => {}}
      onDismissError={() => {}}
      onRetrySend={onRetrySend}
      sending={false}
      fileInputRef={createRef()}
      onAttachmentPick={() => false}
      onRemoveAttachment={() => {}}
      onSend={onSend}
      onStop={async () => {}}
      artifactTarget={{ botId: "b" }}
    />
  );
  await act(async () => root.render(ui(null)));
  const box = document.querySelector("textarea") as HTMLTextAreaElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(
      box,
      "hello",
    );
    box.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    box.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  expect(onSend).toHaveBeenCalledTimes(1);
  await act(async () => root.render(ui("Could not reach")));
  expect((document.querySelector("textarea") as HTMLTextAreaElement).value).toBe("hello");
  const retry = [...document.querySelectorAll("button")].find((b) => b.textContent === "Retry");
  await act(async () => retry?.click());
  expect(onRetrySend).not.toHaveBeenCalled();
  expect(onSend).toHaveBeenCalledTimes(2);
  expect(onSend.mock.calls[1]?.[0]).toBe("hello");
  expect(onSend.mock.calls[1]?.[2]).toBe(onSend.mock.calls[0]?.[2]);
  expect((document.querySelector("textarea") as HTMLTextAreaElement).value).toBe("");
});

it("Retry sends the edited text when the restored draft was changed", async () => {
  const onSend = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
  const ui = (sendError: string | null) => (
    <Composer
      activeName="Agent"
      running={false}
      pendingAttachments={[]}
      attachmentNotice={null}
      sendError={sendError}
      runError={null}
      runErrorId={null}
      onRunErrorPresented={() => {}}
      onDismissError={() => {}}
      onRetrySend={() => {}}
      sending={false}
      fileInputRef={createRef()}
      onAttachmentPick={() => false}
      onRemoveAttachment={() => {}}
      onSend={onSend}
      onStop={async () => {}}
      artifactTarget={{ botId: "b2" }}
    />
  );
  const type = async (text: string) => {
    const box = document.querySelector("textarea") as HTMLTextAreaElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(box, text);
      box.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  await act(async () => root.render(ui(null)));
  await type("hello");
  await act(async () => {
    document
      .querySelector("textarea")
      ?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  await act(async () => root.render(ui("Could not reach")));
  await type("hello world");
  const retry = [...document.querySelectorAll("button")].find((b) => b.textContent === "Retry");
  await act(async () => retry?.click());
  expect(onSend.mock.calls[1]?.[0]).toBe("hello world");
});
