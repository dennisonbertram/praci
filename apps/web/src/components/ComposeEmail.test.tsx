// @vitest-environment jsdom

import type { ComponentProps, ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const prefill = vi.hoisted(() => vi.fn());
const send = vi.hoisted(() => vi.fn());

vi.mock("../lib/rpc", () => ({
  rpc: { inbox: { compose: { prefill, draftSave: vi.fn(), send, discard: vi.fn() } } },
}));
vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, i) => text + part + (values[i] ?? ""), ""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@rakazo/ui-web", () => {
  const Container = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Trigger = ({ render, children }: { render?: ReactNode; children?: ReactNode }) => (
    <span>
      {render}
      {children}
    </span>
  );
  return {
    Button: ({
      variant: _variant,
      size: _size,
      ...props
    }: ComponentProps<"button"> & { variant?: string; size?: string }) => (
      <button type="button" {...props} />
    ),
    cn: (...classes: unknown[]) => classes.filter(Boolean).join(" "),
    Dialog: Container,
    DialogClose: Container,
    DialogContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    DialogTitle: Container,
    NativeSelect: Container,
    NativeSelectOption: Container,
    Popover: Container,
    PopoverContent: Container,
    PopoverTrigger: Trigger,
    Spinner: () => null,
    Tooltip: Container,
    TooltipContent: () => null,
    TooltipTrigger: Trigger,
  };
});

import { ComposeEmail, type ComposeSeed } from "./ComposeEmail";

const body = "\n\nOn Mon, Sam wrote:\n> quoted line\n> second line";
const reply = (kind: "reply" | "replyAll" | "forward"): ComposeSeed => ({
  kind,
  messageId: "m1",
});

async function open(seed: ComposeSeed) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  prefill.mockResolvedValue({
    connectionId: "c1",
    replyToMessageId: "m1",
    to: "Sam Lee <sam@example.test>",
    cc: "kim@example.test, lee@example.test",
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

const field = (label: string) =>
  document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
const chips = () =>
  [...document.querySelectorAll("button[aria-label^='Remove ']")].map((b) =>
    b.getAttribute("aria-label"),
  );

async function type(input: HTMLInputElement, text: string) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    set?.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("seeds a reply-all with chips, shows Cc only because it has addresses, and keeps Bcc hidden", async () => {
  await open(reply("replyAll"));
  expect(chips()).toEqual([
    "Remove sam@example.test",
    "Remove kim@example.test",
    "Remove lee@example.test",
  ]);
  expect(field("Cc")).not.toBeNull();
  expect(field("Bcc")).toBeNull();
  const quote = document.querySelector("blockquote");
  expect(quote?.textContent).toContain("quoted line");
});

it("starts a forward in the To field", async () => {
  await open(reply("forward"));
  expect(document.activeElement).toBe(field("To"));
});

it("turns text before a comma into a chip, keeps invalid ones red, and refuses to send them", async () => {
  await open({ kind: "new" });
  const to = field("To") as HTMLInputElement;
  await type(to, "good@example.test, nope,");
  expect(chips()).toEqual(["Remove good@example.test", "Remove nope"]);
  expect(to.value).toBe("");
  const sendButton = [...document.querySelectorAll("button")].find(
    (b) => b.textContent === "Send",
  ) as HTMLButtonElement;
  await act(async () => sendButton.click());
  expect(send).not.toHaveBeenCalled();
  expect(document.querySelector("[role=alert]")?.textContent).toMatch(/highlighted addresses/);
});

it("removes the last chip on Backspace in the empty input", async () => {
  await open({ kind: "new" });
  const to = field("To") as HTMLInputElement;
  await type(to, "a@example.test; b@example.test;");
  expect(chips()).toHaveLength(2);
  await act(async () => {
    to.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true }));
  });
  expect(chips()).toEqual(["Remove a@example.test"]);
});

it("sends joined recipients, the HTML body and attachments", async () => {
  send.mockResolvedValue({ status: "sent" });
  await open(reply("reply"));
  const file = new File(["hello"], "note.txt", { type: "text/plain" });
  const input = document.querySelector<HTMLInputElement>("input[type=file]") as HTMLInputElement;
  await act(async () => {
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(document.body.textContent).toContain("note.txt");
  const sendButton = [...document.querySelectorAll("button")].find(
    (b) => b.textContent === "Send",
  ) as HTMLButtonElement;
  await act(async () => sendButton.click());
  expect(send).toHaveBeenCalledTimes(1);
  const sent = send.mock.calls[0]?.[0];
  expect(sent).toMatchObject({
    connectionId: "c1",
    replyToMessageId: "m1",
    to: "Sam Lee <sam@example.test>",
    cc: "kim@example.test, lee@example.test",
    subject: "Re: Offsite",
    attachments: [{ filename: "note.txt", mimeType: "text/plain", data: btoa("hello") }],
  });
  expect(sent.html).toContain("<blockquote>");
  expect(sent.body).toContain("quoted line");
});
