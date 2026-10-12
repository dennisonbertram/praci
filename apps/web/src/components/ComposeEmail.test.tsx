// @vitest-environment jsdom

import type { ComponentProps, ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const prefill = vi.hoisted(() => vi.fn());

vi.mock("../lib/rpc", () => ({
  rpc: { inbox: { compose: { prefill, draftSave: vi.fn(), send: vi.fn(), discard: vi.fn() } } },
}));
vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray) => parts.join(""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@rakazo/ui-web", () => {
  const Container = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Button: ({
      variant: _variant,
      size: _size,
      ...props
    }: ComponentProps<"button"> & { variant?: string; size?: string }) => <button {...props} />,
    Dialog: Container,
    DialogContent: Container,
    DialogTitle: Container,
    Input: (props: ComponentProps<"input">) => <input {...props} />,
    NativeSelect: Container,
    NativeSelectOption: Container,
    Spinner: () => null,
    Textarea: (props: ComponentProps<"textarea">) => <textarea {...props} />,
  };
});

import { type ComposeSeed, ComposeEmail } from "./ComposeEmail";

const body = `\n\nOn Mon, Sam wrote:\n${Array.from({ length: 40 }, (_, i) => `> line ${i}`).join("\n")}`;
const reply = (kind: "reply" | "forward"): ComposeSeed => ({ kind, messageId: "m1" });

async function open(seed: ComposeSeed) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  prefill.mockResolvedValue({
    connectionId: "c1",
    replyToMessageId: "m1",
    to: "sam@example.test",
    cc: "",
    subject: "Re: Offsite",
    body,
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(<ComposeEmail seed={seed} accounts={[]} connectionId="c1" onClose={() => {}} />),
  );
  return { container, root };
}

const message = () => document.querySelector<HTMLTextAreaElement>("textarea") as HTMLTextAreaElement;

// jsdom has no layout. Like a browser, focusing a long, freshly filled textarea puts the caret at
// the end and scrolls it into view; the fix has to undo that.
const focus = HTMLTextAreaElement.prototype.focus;
afterEach(() => {
  HTMLTextAreaElement.prototype.focus = focus;
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});
function focusScrollsToCaretAtEnd() {
  HTMLTextAreaElement.prototype.focus = function (this: HTMLTextAreaElement) {
    focus.call(this);
    this.setSelectionRange(this.value.length, this.value.length);
    this.scrollTop = 900;
  };
}

it("opens a reply with the caret at the top of the message and scrolled to the top", async () => {
  focusScrollsToCaretAtEnd();
  await open(reply("reply"));
  const textarea = message();
  expect(textarea.value.startsWith("\n\nOn Mon")).toBe(true);
  expect(document.activeElement).toBe(textarea);
  expect(textarea.selectionStart).toBe(0);
  expect(textarea.selectionEnd).toBe(0);
  expect(textarea.scrollTop).toBe(0);
});

it("does not move the caret again when the composer re-renders", async () => {
  const seed = reply("reply");
  const { root } = await open(seed);
  const textarea = message();
  textarea.setSelectionRange(5, 5);
  textarea.scrollTop = 120;
  await act(async () =>
    root.render(<ComposeEmail seed={seed} accounts={[]} connectionId="c1" onClose={() => {}} />),
  );
  expect(textarea.selectionStart).toBe(5);
  expect(textarea.scrollTop).toBe(120);
});

it("starts a forward in the empty To field, not the body", async () => {
  await open(reply("forward"));
  expect(document.activeElement).toBe(document.querySelector('input[aria-label="To"]'));
});
