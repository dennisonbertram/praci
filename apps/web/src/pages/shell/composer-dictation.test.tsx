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

type Snapshot = {
  status: "idle" | "listening" | "transcribing";
  transcript: string;
  error?: string;
};
const fake = vi.hoisted(() => ({
  watchers: new Set<(s: Snapshot) => void>(),
  listen: vi.fn(),
  submitHold: vi.fn(),
  stop: vi.fn(),
  onFinal: null as null | ((text: string) => void),
}));
vi.mock("../../lib/dictation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/dictation")>()),
  Dictation: class {
    subscribe(fn: (s: Snapshot) => void) {
      fake.watchers.add(fn);
      fn({ status: "idle", transcript: "" });
      return () => fake.watchers.delete(fn);
    }
    async listen(opts: { onFinal: (text: string) => void }) {
      fake.onFinal = opts.onFinal;
      fake.listen(opts);
    }
    submitHold = fake.submitHold;
    stop = fake.stop;
  },
}));

import { Composer } from "./composer";

const emit = (s: Snapshot) =>
  act(async () => {
    for (const w of fake.watchers) w(s);
  });
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
  fake.watchers.clear();
  fake.listen.mockClear();
  fake.submitHold.mockClear();
  sessionStorage.clear();
  root = createRoot(document.body.appendChild(document.createElement("div")));
});
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
});

const ui = (props: { canDictate?: boolean } = {}) => (
  <Composer
    activeName="Agent"
    draftKey="bot:dictation"
    running={false}
    pendingAttachments={[]}
    attachmentNotice={null}
    sendError={null}
    runError={null}
    runErrorId={null}
    onRunErrorPresented={() => {}}
    onDismissError={() => {}}
    sending={false}
    fileInputRef={createRef()}
    onAttachmentPick={() => false}
    onRemoveAttachment={() => {}}
    onSend={async () => true}
    onStop={async () => {}}
    artifactTarget={{ botId: "b" }}
    mentionTargets={[{ kind: "bot", id: "b1", name: "Ada" }]}
    {...props}
  />
);
const box = () => document.querySelector("textarea") as HTMLTextAreaElement;
const mic = () =>
  [...document.querySelectorAll("button")].find((b) =>
    /dictat|transcrib/i.test(b.getAttribute("aria-label") ?? ""),
  );
const type = async (text: string, caret = text.length) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(box(), text);
    box().setSelectionRange(caret, caret);
    box().dispatchEvent(new Event("input", { bubbles: true }));
  });
};

it("hides the mic without an available speech-to-text engine", async () => {
  await act(async () => root.render(ui()));
  expect(mic()).toBeUndefined();
});

it("shows a named mic when an engine is available and starts a server listen on tap", async () => {
  await act(async () => root.render(ui({ canDictate: true })));
  expect(mic()?.getAttribute("aria-label")).toBe("Dictate");
  await act(async () => mic()?.click());
  expect(fake.listen).toHaveBeenCalledWith(
    expect.objectContaining({ mode: "endpoint", transcribe: true, server: true }),
  );
  await emit({ status: "listening", transcript: "" });
  expect(mic()?.getAttribute("aria-label")).toBe("Stop dictation");
  await act(async () => mic()?.click());
  expect(fake.submitHold).toHaveBeenCalled();
  await emit({ status: "transcribing", transcript: "" });
  expect(mic()?.getAttribute("aria-label")).toBe("Transcribing…");
});

it("inserts the transcript at the cursor and keeps the draft on both sides", async () => {
  await act(async () => root.render(ui({ canDictate: true })));
  await act(async () => mic()?.click());
  await emit({ status: "listening", transcript: "" });
  await type("hello world", 5);
  await act(async () => fake.onFinal?.("big"));
  expect(box().value).toBe("hello big world");
  expect(sessionStorage.getItem("rakazo.chatDraft:bot:dictation")).toBe("hello big world");
});

it("keeps the mention picker working after an insert", async () => {
  await act(async () => root.render(ui({ canDictate: true })));
  await act(async () => mic()?.click());
  await act(async () => fake.onFinal?.("ask"));
  await type("ask @");
  expect(box().getAttribute("aria-controls")).toBeTruthy();
});

it("opens the mention picker when the transcript ends in @", async () => {
  await act(async () => root.render(ui({ canDictate: true })));
  await act(async () => mic()?.click());
  await act(async () => fake.onFinal?.("ask @"));
  expect(box().value).toBe("ask @");
  expect(box().getAttribute("aria-controls")).toBeTruthy();
});

it("shows the error and hides it on the next tap", async () => {
  await act(async () => root.render(ui({ canDictate: true })));
  await emit({ status: "idle", transcript: "", error: "Microphone failed" });
  expect(document.body.textContent).toContain("Microphone failed");
  expect(mic()?.getAttribute("aria-label")).toBe("Dictate");
});
