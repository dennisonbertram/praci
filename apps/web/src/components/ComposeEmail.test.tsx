// @vitest-environment jsdom

import type { ComponentProps, ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const prefill = vi.hoisted(() => vi.fn());
const send = vi.hoisted(() => vi.fn());
const draftSave = vi.hoisted(() => vi.fn());
const requestClose = vi.hoisted(() => ({ current: () => {} }));

vi.mock("../lib/rpc", () => ({
  rpc: { inbox: { compose: { prefill, draftSave, send, discard: vi.fn() } } },
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

import { closeRestored, getOutbox, UNDO_SEND_MS, undoSend } from "../lib/outbox";
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
    attachments: [],
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
  closeRestored();
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
  vi.useFakeTimers();
  await act(async () => sendButton.click());
  await act(async () => {
    await vi.advanceTimersByTimeAsync(UNDO_SEND_MS);
  });
  vi.useRealTimers();
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

it("holds a send for the undo window, and Undo reopens the message untouched", async () => {
  send.mockResolvedValue({ status: "sent" });
  vi.useFakeTimers();
  try {
    const onClose = vi.fn();
    await open(reply("reply"), onClose);
    await act(async () => button("Send").click());
    expect(onClose).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNDO_SEND_MS - 100);
    });
    expect(send).not.toHaveBeenCalled();
    undoSend();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNDO_SEND_MS);
    });
    expect(send).not.toHaveBeenCalled();
    const restoring = getOutbox().restoring;
    expect(restoring?.fields.to).toEqual(["Sam Lee <sam@example.test>"]);
    expect(restoring?.fields.html).toContain("<blockquote>");
  } finally {
    vi.useRealTimers();
  }
});

it("reopens with the reason after a send that did not go through", async () => {
  send.mockResolvedValue({ status: "unknown" });
  vi.useFakeTimers();
  try {
    await open(reply("reply"));
    await act(async () => button("Send").click());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNDO_SEND_MS);
    });
    expect(getOutbox().restoring?.notice).toMatch(/Check Sent/);
  } finally {
    vi.useRealTimers();
  }
});

it("hides the quoted original behind a button and still sends it", async () => {
  send.mockResolvedValue({ status: "sent" });
  vi.useFakeTimers();
  try {
    await open(reply("reply"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    const toggle = document.querySelector<HTMLButtonElement>(
      "button[aria-label='Show quoted text']",
    );
    expect(toggle).not.toBeNull();
    expect(document.querySelector("[data-collapsed=true]")).not.toBeNull();
    await act(async () => button("Send").click());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNDO_SEND_MS);
    });
    expect(send.mock.calls[0]?.[0].html).toContain("<blockquote>");
  } finally {
    vi.useRealTimers();
  }
});

it("shows the quote after the button is pressed", async () => {
  await open(reply("reply"));
  await act(async () =>
    document.querySelector<HTMLButtonElement>("button[aria-label='Show quoted text']")?.click(),
  );
  expect(document.querySelector("[data-collapsed=true]")).toBeNull();
  expect(document.querySelector("button[aria-label='Show quoted text']")).toBeNull();
});

it("shows a forward's attachments as removable chips and sends the ones left", async () => {
  send.mockResolvedValue({ status: "sent" });
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  prefill.mockResolvedValue({
    connectionId: "c1",
    to: "",
    cc: "",
    subject: "Fwd: Report",
    body,
    attachments: [
      { id: "2", filename: "a.pdf", mimeType: "application/pdf", size: 10 },
      { id: "3", filename: "b.png", mimeType: "image/png", size: 10 },
    ],
  });
  const container = document.createElement("div");
  document.body.append(container);
  await act(async () =>
    createRoot(container).render(
      <ComposeEmail seed={reply("forward")} accounts={[]} connectionId="c1" onClose={() => {}} />,
    ),
  );
  expect(document.body.textContent).toContain("a.pdf");
  await act(async () =>
    document.querySelector<HTMLButtonElement>("button[aria-label='Remove b.png']")?.click(),
  );
  await type(field("To") as HTMLInputElement, "x@example.test,");
  vi.useFakeTimers();
  await act(async () => button("Send").click());
  await act(async () => {
    await vi.advanceTimersByTimeAsync(UNDO_SEND_MS);
  });
  vi.useRealTimers();
  expect(send.mock.calls[0]?.[0].forwardOf).toEqual({ messageId: "m1", attachmentIds: ["2"] });
});

it("commits a single pasted address as a chip", async () => {
  await open({ kind: "new" });
  const to = field("To") as HTMLInputElement;
  const paste = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(paste, "clipboardData", { value: { getData: () => "solo@example.test" } });
  await act(async () => {
    to.dispatchEvent(paste);
  });
  expect(chips()).toEqual(["Remove solo@example.test"]);
});

it("explains an invalid address and moves focus into a revealed Cc", async () => {
  await open({ kind: "new" });
  await type(field("To") as HTMLInputElement, "nope,");
  const remove = document.querySelector("button[aria-label='Remove nope']") as HTMLButtonElement;
  const note = document.getElementById(remove.getAttribute("aria-describedby") ?? "");
  expect(note?.textContent).toBe("Not a valid email address");
  await act(async () => button("Cc").click());
  expect(document.activeElement).toBe(field("Cc"));
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
    attachments: [],
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
  await act(async () => button("Discard").click());
  expect(onClose).toHaveBeenCalledTimes(1);
});

it("does not save a draft for a reply that was opened and left alone", async () => {
  vi.useFakeTimers();
  try {
    await open(reply("reply"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(draftSave).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});

it("saves a draft once the person types", async () => {
  vi.useFakeTimers();
  draftSave.mockResolvedValue({ status: "saved" });
  try {
    await open(reply("reply"));
    const subject = field("Subject") as HTMLInputElement;
    await type(subject, "Re: Offsite!");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(draftSave).toHaveBeenCalledTimes(1);
  } finally {
    vi.useRealTimers();
  }
});
