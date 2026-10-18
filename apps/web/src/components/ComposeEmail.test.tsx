// @vitest-environment jsdom

import type { ComponentProps, ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const prefill = vi.hoisted(() => vi.fn());
const send = vi.hoisted(() => vi.fn());
const draftSave = vi.hoisted(() => vi.fn());
const discardDraft = vi.hoisted(() => vi.fn());
const requestClose = vi.hoisted(() => ({ current: () => {} }));

vi.mock("../lib/rpc", () => ({
  rpc: { inbox: { compose: { prefill, draftSave, send, discard: discardDraft } } },
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
    AlertDialogDescription: Container,
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
import { forgetClosed, recallClosed } from "./compose/draft-memory";

const body = "\n\nOn Mon, Sam wrote:\n> quoted line\n> second line";
const reply = (kind: "reply" | "replyAll" | "forward"): ComposeSeed => ({
  kind,
  messageId: "m1",
});

// Roots still mounted when a test ends would fire their autosave timers during a later test.
const mounted: Array<ReturnType<typeof createRoot>> = [];

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
  mounted.push(root);
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

afterEach(async () => {
  await act(async () => {
    for (const root of mounted.splice(0)) root.unmount();
  });
  closeRestored();
  for (const kind of ["reply", "replyAll", "forward"] as const) forgetClosed(reply(kind));
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
  expect(document.querySelector("[role=alert]")?.textContent).toBe(
    "nope isn't a valid email address",
  );
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

it("names the file it left out and the limit the server applies", async () => {
  await open({ kind: "new" });
  await attach(new File([new Uint8Array(11 * 1024 * 1024)], "big.bin"));
  const alert = document.querySelector("[role=alert]");
  expect(alert?.textContent).toBe(
    "big.bin (11.0 MB) was not added. Attachments can be up to 10 MB in total.",
  );
  // Beside the attachments, not squeezed into the footer next to Send.
  const sendButton = [...document.querySelectorAll("button")].find((b) => b.textContent === "Send");
  expect(alert?.parentElement).not.toBe(sendButton?.parentElement);
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
    const toggle = button("Show original message");
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
  await act(async () => button("Show original message")?.click());
  expect(document.querySelector("[data-collapsed=true]")).toBeNull();
  expect(button("Show original message")).toBeUndefined();
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

it("names a forward's file that was too large, and keeps it named after autosave", async () => {
  draftSave.mockResolvedValue({ status: "saved" });
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  prefill.mockResolvedValue({
    connectionId: "c1",
    to: "",
    cc: "",
    subject: "Fwd: Demo",
    body,
    attachments: [{ id: "2", filename: "notes.pdf", mimeType: "application/pdf", size: 10 }],
    attachmentsTooLarge: true,
    attachmentsLeftOut: [{ filename: "demo.mp4", size: 12_000_000 }],
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  mounted.push(root);
  await act(async () =>
    root.render(
      <ComposeEmail seed={reply("forward")} accounts={[]} connectionId="c1" onClose={() => {}} />,
    ),
  );
  const leftOut = () => document.querySelector('[data-testid="compose-left-out"]')?.textContent;
  expect(leftOut()).toContain("demo.mp4");
  expect(document.body.textContent).toContain("notes.pdf");
  vi.useFakeTimers();
  await type(field("To") as HTMLInputElement, "x@example.test,");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2_000);
  });
  vi.useRealTimers();
  expect(document.body.textContent).toContain("Draft saved");
  expect(leftOut()).toContain("demo.mp4");
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

it("opens a reply with the cached recipient and no retry when the quote did not load", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  prefill.mockResolvedValue({
    connectionId: "c1",
    replyToMessageId: "m1",
    to: "sam@example.test",
    cc: "",
    subject: "Re: Offsite",
    body: "",
    attachments: [],
    quoteUnavailable: true,
  });
  vi.useFakeTimers();
  draftSave.mockResolvedValue({ status: "saved" });
  const container = document.createElement("div");
  document.body.append(container);
  await act(async () =>
    createRoot(container).render(
      <ComposeEmail seed={reply("reply")} accounts={[]} connectionId="c1" onClose={() => {}} />,
    ),
  );
  expect(chips()).toEqual(["Remove sam@example.test"]);
  expect(container.textContent).toContain("The original message didn't load.");
  expect([...container.querySelectorAll("button")].some((b) => b.textContent === "Try again")).toBe(
    false,
  );
  try {
    await type(field("Subject") as HTMLInputElement, "Re: Offsite!");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(draftSave).toHaveBeenCalled();
    expect(container.textContent).toContain("The original message didn't load.");
  } finally {
    vi.useRealTimers();
  }
});

it("asks before closing with attachments", async () => {
  const onClose = vi.fn();
  await open(reply("reply"), onClose);
  await attach(new File(["hi"], "a.txt"));
  await act(async () => requestClose.current());
  expect(document.querySelector("[role=alertdialog]")?.textContent).toContain(
    "Your text is saved as a draft. Attachments are not kept.",
  );
  expect(onClose).not.toHaveBeenCalled();
  await act(async () => button("Close and remove").click());
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

const many = "a@example.test, b@example.test, c@example.test, d@example.test, e@example.test";

it("folds more than three recipients into a summary until the rows are focused", async () => {
  await open({ kind: "new" });
  const to = field("To") as HTMLInputElement;
  await act(async () => to.focus());
  await type(to, `${many},`);
  expect(chips()).toHaveLength(5);
  await act(async () => {
    (field("Subject") as HTMLInputElement).focus();
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
  expect(chips()).toEqual([]);
  const summary = [...document.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("+3 more"),
  ) as HTMLButtonElement;
  expect(summary.textContent).toBe("a@example.test, b@example.test, +3 more");
  await act(async () => summary.focus());
  expect(chips()).toHaveLength(5);
  expect(document.activeElement).toBe(field("To"));
});

it("keeps Cc and Bcc ahead of the To input in tab order, so Tab from To reaches Subject", async () => {
  await open({ kind: "new" });
  const to = field("To") as HTMLInputElement;
  for (const name of ["Cc", "Bcc"])
    expect(
      button(name).compareDocumentPosition(to) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  const subject = field("Subject") as HTMLInputElement;
  expect(to.compareDocumentPosition(subject) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it("names the one address that blocks a send", async () => {
  await open({ kind: "new" });
  await type(field("To") as HTMLInputElement, "josé@example.test,");
  await act(async () => button("Send").click());
  expect(document.querySelector("[role=alert]")?.textContent).toBe(
    "josé@example.test isn't a valid email address",
  );
});

it("says why Gmail refused a send, once", async () => {
  send.mockResolvedValue({ status: "failed", reason: "rejected" });
  vi.useFakeTimers();
  try {
    await open(reply("reply"));
    await act(async () => button("Send").click());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNDO_SEND_MS);
    });
    expect(getOutbox().restoring?.notice).toBe(
      "Not sent. Gmail didn't accept it. Check the addresses.",
    );
  } finally {
    vi.useRealTimers();
  }
});

it("says the message was not sent when a send fails, and keeps Send available", async () => {
  send.mockRejectedValue(new Error("Could not reach the server"));
  vi.useFakeTimers();
  try {
    await open(reply("reply"));
    await act(async () => button("Send").click());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNDO_SEND_MS);
    });
    expect(getOutbox().restoring?.notice).toMatch(/^Not sent\. /);
  } finally {
    vi.useRealTimers();
  }
});

it("discards after an undo window, and Undo brings the composer back", async () => {
  vi.useFakeTimers();
  draftSave.mockResolvedValue({ status: "saved" });
  discardDraft.mockResolvedValue({});
  try {
    const onClose = vi.fn();
    await open(reply("reply"), onClose);
    await type(field("Subject") as HTMLInputElement, "Re: Offsite!");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    await act(async () =>
      (document.querySelector("button[aria-label='Discard']") as HTMLButtonElement).click(),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(getOutbox().view).toEqual({ kind: "discarded" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNDO_SEND_MS - 100);
    });
    expect(discardDraft).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(discardDraft).toHaveBeenCalledTimes(1);
  } finally {
    vi.useRealTimers();
  }
});

it("opens the same reply again as it was closed, so the same draft is updated", async () => {
  vi.useFakeTimers();
  draftSave.mockResolvedValue({ status: "saved" });
  try {
    const first = await open(reply("reply"));
    await type(field("Subject") as HTMLInputElement, "Re: Offsite!");
    await act(async () => requestClose.current());
    await act(async () => first.root.unmount());
    document.body.innerHTML = "";
    await open(reply("reply"));
    expect(prefill).toHaveBeenCalledTimes(1);
    expect((field("Subject") as HTMLInputElement).value).toBe("Re: Offsite!");
    await type(field("Subject") as HTMLInputElement, "Re: Offsite!!");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    const ids = draftSave.mock.calls.map(([call]) => call.clientId);
    expect(new Set(ids).size).toBe(1);
  } finally {
    vi.useRealTimers();
  }
});

it("carries a Reply all draft into Reply with only the sender as recipient", async () => {
  vi.useFakeTimers();
  draftSave.mockResolvedValue({ status: "saved" });
  try {
    const first = await open(reply("replyAll"));
    await type(field("Subject") as HTMLInputElement, "Re: Offsite!");
    await act(async () => requestClose.current());
    await act(async () => first.root.unmount());
    document.body.innerHTML = "";
    prefill.mockResolvedValueOnce({
      connectionId: "c1",
      replyToMessageId: "m1",
      to: "Sam Lee <sam@example.test>",
      cc: "",
      subject: "Re: Offsite",
      body,
      attachments: [],
    });
    await open(reply("reply"));
    expect(prefill).toHaveBeenLastCalledWith(expect.objectContaining({ mode: "reply" }));
    expect(chips()).toEqual(["Remove sam@example.test"]);
    expect(field("Cc")).toBeNull();
    expect((field("Subject") as HTMLInputElement).value).toBe("Re: Offsite!");
    await type(field("Subject") as HTMLInputElement, "Re: Offsite!!");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    // Still the same Gmail draft.
    expect(new Set(draftSave.mock.calls.map(([call]) => call.clientId)).size).toBe(1);
  } finally {
    vi.useRealTimers();
  }
});

it("leaves a Reply all draft as written when Reply opens it and closes without an edit", async () => {
  draftSave.mockResolvedValue({ status: "saved" });
  const first = await open(reply("replyAll"));
  await type(field("Subject") as HTMLInputElement, "Re: Offsite!");
  await act(async () => requestClose.current());
  await act(async () => first.root.unmount());
  document.body.innerHTML = "";
  const second = await open(reply("reply"));
  await act(async () => requestClose.current());
  await act(async () => second.root.unmount());
  const kept = recallClosed(reply("reply"));
  expect(kept?.seed.kind).toBe("replyAll");
  expect(kept?.fields.cc).toEqual(["kim@example.test", "lee@example.test"]);
  expect(discardDraft).not.toHaveBeenCalled();
});

it("shows the address a reply is sent from", async () => {
  prefill.mockResolvedValueOnce({
    connectionId: "c2",
    account: { connectionId: "c2", label: "Sales mail", address: "sales@example.test" },
    replyToMessageId: "m1",
    to: "Sam Lee <sam@example.test>",
    cc: "",
    subject: "Re: Offsite",
    body,
    attachments: [],
  });
  await open(reply("reply"));
  const from = [...document.querySelectorAll("span")].find((el) => el.textContent === "From");
  expect(from?.nextElementSibling?.textContent).toBe("Sales mail <sales@example.test>");
});

it("shows the one account a new message is sent from", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  mounted.push(root);
  await act(async () =>
    root.render(
      <ComposeEmail
        seed={{ kind: "new" }}
        accounts={[{ connectionId: "c1", label: "me@example.test" }]}
        onClose={() => {}}
      />,
    ),
  );
  const from = [...document.querySelectorAll("span")].find((el) => el.textContent === "From");
  expect(from?.nextElementSibling?.textContent).toBe("me@example.test");
});
