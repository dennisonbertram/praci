// @vitest-environment jsdom

import type { ComponentProps, ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const prefill = vi.hoisted(() => vi.fn());
const send = vi.hoisted(() => vi.fn());
const requestClose = vi.hoisted(() => ({ current: () => {} }));

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
    AlertDialog: ({ open, children }: { open?: boolean; children?: ReactNode }) =>
      open ? <div role="alertdialog">{children}</div> : null,
    AlertDialogAction: (props: ComponentProps<"button">) => <button type="button" {...props} />,
    AlertDialogCancel: (props: ComponentProps<"button">) => <button type="button" {...props} />,
    AlertDialogContent: Container,
    AlertDialogFooter: Container,
    AlertDialogTitle: Container,
    Button: ({
      variant: _variant,
      size: _size,
      ...props
    }: ComponentProps<"button"> & { variant?: string; size?: string }) => (
      <button type="button" {...props} />
    ),
    cn: (...classes: unknown[]) => classes.filter(Boolean).join(" "),
    Dialog: ({
      onOpenChange,
      children,
    }: {
      onOpenChange?: (open: boolean) => void;
      children?: ReactNode;
    }) => {
      requestClose.current = () => onOpenChange?.(false);
      return <div>{children}</div>;
    },
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

async function open(seed: ComposeSeed, onClose = () => {}) {
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
    root.render(<ComposeEmail seed={seed} accounts={[]} connectionId="c1" onClose={onClose} />),
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

const button = (name: string) =>
  [...document.querySelectorAll("button")].find((b) => b.textContent === name) as HTMLButtonElement;

async function attach(file: File) {
  const input = document.querySelector<HTMLInputElement>("input[type=file]") as HTMLInputElement;
  await act(async () => {
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

it("names the attachment limit the way the server does", async () => {
  await open({ kind: "new" });
  await attach(new File([new Uint8Array(11 * 1024 * 1024)], "big.bin"));
  expect(document.querySelector("[role=alert]")?.textContent).toBe(
    "Attachments can't be over 10 MB.",
  );
});

it("lets Send be tried again after an unknown result", async () => {
  send.mockResolvedValue({ status: "unknown" });
  await open(reply("reply"));
  await act(async () => button("Send").click());
  expect(button("Send").disabled).toBe(false);
  await act(async () => button("Send").click());
  expect(send).toHaveBeenCalledTimes(2);
});

it("retries a failed reply prefill", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  prefill.mockRejectedValueOnce(new Error("down"));
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
  await act(async () =>
    createRoot(container).render(
      <ComposeEmail seed={reply("reply")} accounts={[]} connectionId="c1" onClose={() => {}} />,
    ),
  );
  expect(chips()).toEqual([]);
  await act(async () => button("Try again").click());
  expect(prefill).toHaveBeenCalledTimes(2);
  expect(chips()).toEqual(["Remove sam@example.test"]);
});

it("asks before closing with attachments", async () => {
  const onClose = vi.fn();
  await open(reply("reply"), onClose);
  await attach(new File(["hi"], "a.txt"));
  await act(async () => requestClose.current());
  expect(document.querySelector("[role=alertdialog]")).not.toBeNull();
  expect(onClose).not.toHaveBeenCalled();
  await act(async () => button("Close").click());
  expect(onClose).toHaveBeenCalledTimes(1);
});
