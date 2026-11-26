// @vitest-environment jsdom

import type { ComposerMention } from "@rakazo/core";
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

it("lists a routine on a bare @ even behind a long bot list", async () => {
  const bots: ComposerMention[] = Array.from({ length: 12 }, (_, i) => ({
    kind: "bot",
    id: `bot${i + 1}`,
    name: `Agent ${String(i + 1).padStart(2, "0")}`,
  }));
  await act(async () =>
    root.render(
      <Composer
        activeName="Agent"
        running={false}
        pendingAttachments={[]}
        attachmentNotice={null}
        sendError={null}
        runError={null}
        runErrorId={null}
        onRunErrorPresented={() => {}}
        onDismissError={() => {}}
        onRetrySend={() => {}}
        sending={false}
        fileInputRef={createRef()}
        onAttachmentPick={() => false}
        onRemoveAttachment={() => {}}
        onSend={vi.fn().mockResolvedValue(true)}
        onStop={async () => {}}
        artifactTarget={{ botId: "b6" }}
        mentionTargets={[
          ...bots,
          { kind: "routine", id: "r1", name: "Monday receipt chase", botId: "bot1" },
        ]}
      />,
    ),
  );
  const box = document.querySelector("textarea") as HTMLTextAreaElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(box, "@");
    box.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const labels = [...document.querySelectorAll('[role="option"]')].map((option) =>
    option.getAttribute("aria-label"),
  );
  expect(labels).toHaveLength(10);
  expect(labels.at(-1)).toBe("@Monday receipt chase");
});
