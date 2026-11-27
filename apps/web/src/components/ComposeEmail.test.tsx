// @vitest-environment jsdom

import type { ComponentProps, ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const prefill = vi.hoisted(() => vi.fn());
const send = vi.hoisted(() => vi.fn());
const draftSave = vi.hoisted(() => vi.fn());
const discardDraft = vi.hoisted(() => vi.fn());
const selectedSpaceId = vi.hoisted(() => vi.fn<() => string | null>(() => null));
const requestClose = vi.hoisted(() => ({ current: () => {} }));

vi.mock("../lib/rpc", () => ({
  rpc: { inbox: { compose: { prefill, draftSave, send, discard: discardDraft } } },
  selectedSpaceId,
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
    NativeSelect: (props: ComponentProps<"select">) => <select {...props} />,
    NativeSelectOption: (props: ComponentProps<"option">) => <option {...props} />,
    Popover: Container,
    PopoverContent: Container,
    PopoverTrigger: Trigger,
    Spinner: () => null,
    Tooltip: Container,
    TooltipContent: () => null,
    TooltipTrigger: Trigger,
  };
});

vi.mock("./inbox/EmailSidePanel", () => ({
  EmailSidePanel: ({ people }: { people: Array<{ email: string }> }) => (
    <aside data-testid="context-panel">{people.map((p) => p.email).join(",")}</aside>
  ),
}));

import { closeRestored, getOutbox, UNDO_SEND_MS, undoSend } from "../lib/outbox";
import type { ComposeRestore, ComposeSeed } from "./ComposeEmail";
import { ComposeEmail } from "./ComposeEmail";
import { forgetClosed, recallClosed, rememberClosed } from "./compose/draft-memory";

const body = "\n\nOn Mon, Sam wrote:\n> quoted line\n> second line";
const reply = (kind: "reply" | "replyAll" | "forward"): ComposeSeed => ({
  kind,
  messageId: "m1",
});

// Roots still mounted when a test ends would fire their autosave timers during a later test.
const mounted: Array<ReturnType<typeof createRoot>> = [];

async function open(
  seed: ComposeSeed,
  onClose = () => {},
  draft?: string,
  spaceId?: string,
  onSent?: () => void,
  restore?: ComposeRestore,
) {
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
    root.render(
      <ComposeEmail
        seed={seed}
        accounts={[]}
        connectionId="c1"
        draft={draft}
        spaceId={spaceId}
        restore={restore}
        onClose={onClose}
        onSent={onSent}
      />,
    ),
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
  selectedSpaceId.mockReturnValue(null);
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

it("starts a reply with the agent's draft above the quoted original", async () => {
  await open(reply("reply"), () => {}, "Hi Sam,\n\nThe split makes it 4,600.");
  const text = document.querySelector(".ProseMirror")?.textContent ?? "";
  expect(text).toContain("The split makes it 4,600.");
  expect(text.indexOf("4,600")).toBeLessThan(text.indexOf("quoted line"));
  expect(document.querySelector("blockquote")?.textContent).toContain("quoted line");
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
    const onSent = vi.fn();
    await open(reply("reply"), onClose, undefined, undefined, onSent);
    await act(async () => button("Send").click());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSent).toHaveBeenCalledTimes(1);
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

it("saves the final text as a draft before sending, even within the autosave delay", async () => {
  send.mockResolvedValue({ status: "sent" });
  draftSave.mockResolvedValue({ status: "saved" });
  vi.useFakeTimers();
  try {
    await open(reply("reply"));
    await type(field("Subject") as HTMLInputElement, "Re: Offsite!");
    // Press Send before the 1.5 s autosave would run.
    await act(async () => button("Send").click());
    expect(send).not.toHaveBeenCalled();
    expect(draftSave).toHaveBeenCalledTimes(1);
    expect(draftSave.mock.calls[0]?.[0]).toMatchObject({ subject: "Re: Offsite!" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNDO_SEND_MS);
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(draftSave.mock.invocationCallOrder[0]).toBeLessThan(
      send.mock.invocationCallOrder[0] as number,
    );
    expect(send.mock.calls[0]?.[0]).toMatchObject({ subject: "Re: Offsite!" });
  } finally {
    vi.useRealTimers();
  }
});

it("discards the saved draft after an Undo of the send", async () => {
  send.mockResolvedValue({ status: "sent" });
  draftSave.mockResolvedValue({ status: "saved" });
  discardDraft.mockResolvedValue({});
  vi.useFakeTimers();
  try {
    await open(reply("reply"));
    await type(field("Subject") as HTMLInputElement, "Re: Offsite!");
    await act(async () => button("Send").click());
    undoSend();
    const restoring = getOutbox().restoring;
    expect(restoring?.saved).toBe(true);
    // Open it again as MailOutbox does, from the snapshot Undo handed back.
    await act(async () => {
      for (const mountedRoot of mounted.splice(0)) mountedRoot.unmount();
    });
    document.body.innerHTML = "";
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    mounted.push(root);
    await act(async () => {
      root.render(
        <ComposeEmail
          seed={reply("reply")}
          accounts={[]}
          restore={restoring ?? undefined}
          onClose={() => {}}
        />,
      );
    });
    await act(async () =>
      (document.querySelector("button[aria-label='Discard']") as HTMLButtonElement).click(),
    );
    expect(discardDraft).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNDO_SEND_MS);
    });
    expect(discardDraft).toHaveBeenCalledTimes(1);
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

it("masks amounts in a left-out file name while amounts are hidden", async () => {
  const { setHideAmounts } = await import("../lib/hide-amounts-preference");
  setHideAmounts(true);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  prefill.mockResolvedValue({
    connectionId: "c1",
    to: "",
    cc: "",
    subject: "Fwd: Invoice",
    body,
    attachments: [],
    attachmentsTooLarge: true,
    attachmentsLeftOut: [{ filename: "Invoice-$4,812.pdf", size: 12_000_000 }],
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  mounted.push(root);
  try {
    await act(async () =>
      root.render(
        <ComposeEmail seed={reply("forward")} accounts={[]} connectionId="c1" onClose={() => {}} />,
      ),
    );
    const text = document.querySelector('[data-testid="compose-left-out"]')?.textContent ?? "";
    expect(text).toContain("Not attached");
    expect(text).not.toContain("4,812");
  } finally {
    setHideAmounts(false);
  }
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

it("shows Preparing draft until the reply prefill arrives", async () => {
  let arrive: (value: unknown) => void = () => {};
  prefill.mockImplementation(() => new Promise((resolve) => (arrive = resolve)));
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  mounted.push(root);
  await act(async () =>
    root.render(
      <ComposeEmail seed={reply("reply")} accounts={[]} connectionId="c1" onClose={() => {}} />,
    ),
  );
  expect(document.body.textContent).toContain("Preparing draft…");
  await act(async () =>
    arrive({
      connectionId: "c1",
      replyToMessageId: "m1",
      to: "Sam Lee <sam@example.test>",
      cc: "",
      subject: "Re: Offsite",
      body,
      attachments: [],
    }),
  );
  expect(document.body.textContent).not.toContain("Preparing draft…");
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

it("says only that attachments are dropped when nothing was written", async () => {
  await open({ kind: "new" });
  await attach(new File(["hi"], "a.txt"));
  await act(async () => requestClose.current());
  const text = document.querySelector("[role=alertdialog]")?.textContent ?? "";
  expect(text).toContain("Discard draft?");
  expect(text).toContain("Attachments are not kept.");
  expect(text).not.toContain("saved as a draft");
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

it("treats a lost send response as uncertain, not definitely unsent", async () => {
  send.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  draftSave.mockResolvedValue({ status: "saved" });
  vi.useFakeTimers();
  try {
    const opened = await open(reply("reply"));
    await act(async () => button("Send").click());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNDO_SEND_MS);
    });
    expect(getOutbox().restoring?.notice).toBe(
      "Not confirmed as sent. Check Sent before trying again.",
    );
    expect(getOutbox().restoring?.deliveryStatus).toBe("uncertain");
    expect(getOutbox().restoring?.fields).toMatchObject({
      to: ["Sam Lee <sam@example.test>"],
      subject: "Re: Offsite",
    });
    const restore = getOutbox().restoring;
    expect(restore).not.toBeNull();

    // The restored composer can only reconcile the same request. Its fields stay locked and the
    // action reuses the original client id, so an acknowledged send is returned instead of resent.
    await act(async () => opened.root.unmount());
    mounted.splice(mounted.indexOf(opened.root), 1);
    document.body.innerHTML = "";
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    mounted.push(root);
    await act(async () =>
      root.render(
        <ComposeEmail
          seed={restore?.seed ?? reply("reply")}
          accounts={restore?.accounts ?? []}
          restore={restore ?? undefined}
          onClose={() => {}}
        />,
      ),
    );
    expect((field("Subject") as HTMLInputElement).disabled).toBe(true);
    expect(button("Retry send").disabled).toBe(false);
    send.mockResolvedValueOnce({ status: "sent" });
    await act(async () => button("Retry send").click());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNDO_SEND_MS);
    });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1]?.[0]).toEqual(send.mock.calls[0]?.[0]);
    expect(getOutbox().view).toEqual({ kind: "sent" });
  } finally {
    vi.useRealTimers();
  }
});

it("keeps a definite rejection as not sent", async () => {
  send.mockRejectedValueOnce(
    Object.assign(new Error("Invalid request"), {
      code: "BAD_REQUEST",
      status: 400,
    }),
  );
  vi.useFakeTimers();
  try {
    await open(reply("reply"));
    await act(async () => button("Send").click());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNDO_SEND_MS);
    });
    expect(getOutbox().restoring?.notice).toBe("Not sent. Invalid request");
  } finally {
    vi.useRealTimers();
  }
});

it("keeps the original uncertain reply payload and Space when reopened through Reply all", async () => {
  send.mockReset();
  draftSave.mockReset();
  send.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  send.mockResolvedValueOnce({ status: "sent" });
  draftSave.mockResolvedValue({ status: "saved" });
  selectedSpaceId.mockReturnValue("space-a");
  vi.useFakeTimers();
  try {
    const first = await open(reply("reply"));
    await act(async () => button("Send").click());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNDO_SEND_MS);
    });
    const restore = getOutbox().restoring;
    expect(restore?.deliveryStatus).toBe("uncertain");
    expect((restore as (ComposeRestore & { spaceId?: string | null }) | null)?.spaceId).toBe(
      "space-a",
    );
    const originalRequest = send.mock.calls[0]?.[0];

    // A closed uncertain reply may be reopened from the other reply button, but it must keep
    // its original immutable request and client id until the server resolves that request.
    rememberClosed(reply("reply"), restore as NonNullable<typeof restore>);
    await act(async () => first.root.unmount());
    mounted.splice(mounted.indexOf(first.root), 1);
    document.body.innerHTML = "";
    selectedSpaceId.mockReturnValue("space-b");
    const reopened = await open(reply("replyAll"));
    expect(prefill).toHaveBeenCalledTimes(1);
    expect((field("Subject") as HTMLInputElement).disabled).toBe(true);
    expect(button("Retry send").disabled).toBe(false);
    await act(async () => button("Retry send").click());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNDO_SEND_MS);
    });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1]?.[0]).toEqual(originalRequest);
    expect(send.mock.calls[0]?.[1]).toEqual({ context: { spaceId: "space-a" } });
    expect(send.mock.calls[1]?.[1]).toEqual({ context: { spaceId: "space-a" } });
    await act(async () => reopened.root.unmount());
    mounted.splice(mounted.indexOf(reopened.root), 1);
  } finally {
    vi.useRealTimers();
  }
});

it("keeps earlier uncertainty after retry auth errors and lets Close dismiss only local recovery", async () => {
  send.mockReset();
  draftSave.mockReset();
  send.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  send.mockRejectedValueOnce(
    Object.assign(new Error("Reconnect required"), { code: "UNAUTHORIZED", status: 401 }),
  );
  draftSave.mockResolvedValue({ status: "saved" });
  vi.useFakeTimers();
  try {
    const first = await open(reply("reply"), () => closeRestored(), undefined, "space-a");
    await act(async () => button("Send").click());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNDO_SEND_MS);
    });
    const restore = getOutbox().restoring;
    expect(restore?.deliveryStatus).toBe("uncertain");
    await act(async () => first.root.unmount());
    mounted.splice(mounted.indexOf(first.root), 1);
    document.body.innerHTML = "";

    const recovery = await open(
      restore!.seed,
      () => closeRestored(),
      undefined,
      "space-b",
      undefined,
      restore!,
    );
    expect(recovery.container.textContent).toContain("Not confirmed as sent.");
    await act(async () => button("Retry send").click());
    await act(async () => recovery.root.unmount());
    mounted.splice(mounted.indexOf(recovery.root), 1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNDO_SEND_MS);
    });
    expect(getOutbox().restoring?.deliveryStatus).toBe("uncertain");
    expect(getOutbox().restoring?.notice).toBe(
      "Not confirmed as sent. Check Sent before trying again.",
    );
    expect(send.mock.calls[1]?.[1]).toEqual({ context: { spaceId: "space-a" } });

    const recoveryAfterRetry = await open(
      getOutbox().restoring!.seed,
      () => closeRestored(),
      undefined,
      "space-b",
      undefined,
      getOutbox().restoring!,
    );

    // Closing clears only the local frozen recovery. It does not discard the provider draft.
    await act(async () => requestClose.current());
    expect(getOutbox().restoring).toBeNull();
    expect(discardDraft).not.toHaveBeenCalled();
    expect(recallClosed(reply("reply"))).toBeUndefined();
    await act(async () => recoveryAfterRetry.root.unmount());
    mounted.splice(mounted.indexOf(recoveryAfterRetry.root), 1);

    selectedSpaceId.mockReturnValue("space-b");
    send.mockResolvedValueOnce({ status: "sent" });
    const newReplyAll = await open(reply("replyAll"));
    expect(prefill).toHaveBeenLastCalledWith(expect.objectContaining({ mode: "replyAll" }), {
      context: { spaceId: "space-b" },
    });
    expect((field("Subject") as HTMLInputElement).disabled).toBe(false);
    await act(async () => button("Send").click());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNDO_SEND_MS);
    });
    expect(send.mock.calls[2]?.[0].clientId).not.toBe(send.mock.calls[0]?.[0].clientId);
    expect(send.mock.calls[2]?.[1]).toEqual({ context: { spaceId: "space-b" } });
    await act(async () => newReplyAll.root.unmount());
    mounted.splice(mounted.indexOf(newReplyAll.root), 1);
  } finally {
    vi.useRealTimers();
  }
});

it("treats HTTP 499 as ambiguous because the server may still finish sending", async () => {
  send.mockReset();
  draftSave.mockReset();
  send.mockRejectedValueOnce(
    Object.assign(new Error("Client closed request"), {
      code: "CLIENT_CLOSED_REQUEST",
      status: 499,
    }),
  );
  vi.useFakeTimers();
  try {
    await open(reply("reply"));
    await act(async () => button("Send").click());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNDO_SEND_MS);
    });
    expect(getOutbox().restoring?.deliveryStatus).toBe("uncertain");
    expect(getOutbox().restoring?.notice).toBe(
      "Not confirmed as sent. Check Sent before trying again.",
    );
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
    expect(prefill).toHaveBeenLastCalledWith(expect.objectContaining({ mode: "reply" }), {
      context: { spaceId: null },
    });
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

it("sends in the Space it was opened in", async () => {
  send.mockResolvedValue({ status: "sent" });
  await open(reply("reply"), () => {}, undefined, "space-a");
  vi.useFakeTimers();
  await act(async () => button("Send").click());
  await act(async () => {
    await vi.advanceTimersByTimeAsync(UNDO_SEND_MS);
  });
  vi.useRealTimers();
  expect(send.mock.calls[0]?.[1]).toEqual({ context: { spaceId: "space-a" } });
});

it("will not send a new message with no From account chosen", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.body.appendChild(document.createElement("div"));
  const root = createRoot(container);
  mounted.push(root);
  await act(async () =>
    root.render(
      <ComposeEmail
        seed={{ kind: "new" }}
        accounts={[{ connectionId: "c1", label: "Personal" }]}
        connectionId=""
        restore={{
          seed: { kind: "new" },
          clientId: "abcdefgh12",
          fields: {
            connectionId: "",
            to: ["a@example.test"],
            cc: [],
            bcc: [],
            subject: "",
            html: "",
            text: "x",
          },
          forwarded: [],
          files: [],
          saved: false,
          accounts: [{ connectionId: "c1", label: "Personal" }],
        }}
        onClose={() => {}}
      />,
    ),
  );
  await act(async () => button("Send").click());
  expect(document.body.textContent).toContain("Choose which account to send from.");
  expect(send).not.toHaveBeenCalled();
});

it("shows context for the To recipients only, and the Context button hides it", async () => {
  await open(reply("replyAll"));
  const panel = () => document.querySelector('[data-testid="context-panel"]');
  // Cc people are not who the message is for.
  expect(panel()?.textContent).toBe("sam@example.test");
  const toggle = document.querySelector<HTMLElement>('button[aria-label="Context"]');
  await act(async () => toggle?.click());
  expect(panel()).toBeNull();
  await act(async () => toggle?.click());
  expect(panel()).not.toBeNull();
});

it("keeps a send error through the autosave that follows it", async () => {
  draftSave.mockResolvedValue({ status: "saved" });
  vi.useFakeTimers();
  try {
    await open({ kind: "new" });
    await type(field("Subject") as HTMLInputElement, "Hello");
    await act(async () => button("Send").click());
    expect(document.querySelector("[role=alert]")?.textContent).toBe("Add a recipient.");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });
    expect(draftSave).toHaveBeenCalled();
    expect(document.querySelector("[role=alert]")?.textContent).toBe("Add a recipient.");
    expect(document.querySelector("[role=status]")?.textContent).not.toBe("Draft saved");
  } finally {
    vi.useRealTimers();
  }
});

it("clears the send error once the person adds a recipient, then shows the draft as saved", async () => {
  draftSave.mockResolvedValue({ status: "saved" });
  vi.useFakeTimers();
  try {
    await open({ kind: "new" });
    await type(field("Subject") as HTMLInputElement, "Hello");
    await act(async () => button("Send").click());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });
    expect(document.querySelector("[role=alert]")?.textContent).toBe("Add a recipient.");
    await type(field("To") as HTMLInputElement, "sam@example.test,");
    expect(document.querySelector("[role=alert]")).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });
    expect(document.querySelector("[role=alert]")).toBeNull();
    expect(document.querySelector("[role=status]")?.textContent).toBe("Draft saved");
    expect(document.body.textContent).not.toContain("Add a recipient.");
  } finally {
    vi.useRealTimers();
  }
});

it("keeps a restored send error until the next edit, not overwriting it with a save", async () => {
  draftSave.mockResolvedValue({ status: "saved" });
  vi.useFakeTimers();
  try {
    const notice = "Gmail didn't respond. Try again.";
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    mounted.push(root);
    await act(async () =>
      root.render(
        <ComposeEmail
          seed={{ kind: "new" }}
          accounts={[]}
          restore={{
            seed: { kind: "new" },
            clientId: "abcdefgh34",
            fields: {
              connectionId: "c1",
              to: ["sam@example.test"],
              cc: [],
              bcc: [],
              subject: "Hello",
              html: "",
              text: "x",
            },
            forwarded: [],
            files: [],
            saved: true,
            accounts: [],
            notice,
          }}
          onClose={() => {}}
        />,
      ),
    );
    expect(document.querySelector("[role=alert]")?.textContent).toBe(notice);
    // Nothing has been edited, so no autosave replaces the reason the send failed.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(document.querySelector("[role=alert]")?.textContent).toBe(notice);
    expect(document.querySelector("[role=status]")?.textContent).not.toBe("Draft saved");
    await type(field("Subject") as HTMLInputElement, "Hello again");
    expect(document.querySelector("[role=alert]")).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });
    expect(document.querySelector("[role=status]")?.textContent).toBe("Draft saved");
  } finally {
    vi.useRealTimers();
  }
});

it("waits for the send's draft save before discarding after Undo", async () => {
  let finish: (value: { status: string }) => void = () => {};
  draftSave.mockReturnValue(
    new Promise<{ status: string }>((resolve) => {
      finish = resolve;
    }),
  );
  discardDraft.mockResolvedValue({});
  vi.useFakeTimers();
  try {
    await open(reply("reply"));
    await type(field("Subject") as HTMLInputElement, "Re: Offsite!");
    await act(async () => button("Send").click());
    undoSend();
    const restoring = getOutbox().restoring;
    expect(restoring?.saved).toBe(true);
    await act(async () => {
      for (const mountedRoot of mounted.splice(0)) mountedRoot.unmount();
    });
    document.body.innerHTML = "";
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    mounted.push(root);
    await act(async () => {
      root.render(
        <ComposeEmail
          seed={reply("reply")}
          accounts={[]}
          restore={restoring ?? undefined}
          onClose={() => {}}
        />,
      );
    });
    await act(async () =>
      (document.querySelector("button[aria-label='Discard']") as HTMLButtonElement).click(),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNDO_SEND_MS + 100);
    });
    // The send's save has not landed, so the discard waits for it instead of running first.
    expect(discardDraft).not.toHaveBeenCalled();
    await act(async () => {
      finish({ status: "saved" });
      await Promise.resolve();
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(draftSave.mock.invocationCallOrder[0]).toBeLessThan(
      discardDraft.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
    expect(discardDraft).toHaveBeenCalledTimes(1);
  } finally {
    vi.useRealTimers();
  }
});

it("saves the newer text only after the send's slower save lands", async () => {
  let finish: (value: { status: string }) => void = () => {};
  draftSave.mockReturnValueOnce(
    new Promise<{ status: string }>((resolve) => {
      finish = resolve;
    }),
  );
  vi.useFakeTimers();
  try {
    await open(reply("reply"));
    await type(field("Subject") as HTMLInputElement, "Re: Offsite!");
    await act(async () => button("Send").click());
    undoSend();
    const restoring = getOutbox().restoring;
    await act(async () => {
      for (const mountedRoot of mounted.splice(0)) mountedRoot.unmount();
    });
    document.body.innerHTML = "";
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    mounted.push(root);
    await act(async () => {
      root.render(
        <ComposeEmail
          seed={reply("reply")}
          accounts={[]}
          restore={restoring ?? undefined}
          onClose={() => {}}
        />,
      );
    });
    await type(field("Subject") as HTMLInputElement, "Re: Offsite?");
    await act(async () => button("Send").click());
    expect(draftSave).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish({ status: "saved" });
      await Promise.resolve();
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(1_500);
    });
    expect(draftSave).toHaveBeenCalledTimes(2);
    expect(draftSave.mock.calls[1]?.[0]).toMatchObject({ subject: "Re: Offsite?" });
    expect(draftSave.mock.invocationCallOrder[0]).toBeLessThan(
      draftSave.mock.invocationCallOrder[1] ?? Number.POSITIVE_INFINITY,
    );
    undoSend();
  } finally {
    vi.useRealTimers();
  }
});

const accounts = [
  { connectionId: "c1", label: "Personal" },
  { connectionId: "c2", label: "Work" },
];

it("locks From once a draft exists, keeping the account it was saved with", async () => {
  draftSave.mockResolvedValue({ status: "saved" });
  vi.useFakeTimers();
  try {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    mounted.push(root);
    await act(async () => {
      root.render(
        <ComposeEmail
          seed={{ kind: "new" }}
          accounts={accounts}
          connectionId="c1"
          onClose={() => {}}
        />,
      );
    });
    const from = () => document.querySelector<HTMLSelectElement>('select[aria-label="From"]');
    expect(from()?.disabled).toBe(false);
    await type(field("Subject") as HTMLInputElement, "Hello");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });
    expect(draftSave).toHaveBeenCalledTimes(1);
    expect(from()?.disabled).toBe(true);
    expect(from()?.value).toBe("c1");
  } finally {
    vi.useRealTimers();
  }
});

it("starts locked when reopened after a send saved the draft", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  mounted.push(root);
  await act(async () => {
    root.render(
      <ComposeEmail
        seed={{ kind: "new" }}
        accounts={accounts}
        restore={{
          seed: { kind: "new" },
          clientId: "abcdefgh56",
          fields: {
            connectionId: "c2",
            to: ["sam@example.test"],
            cc: [],
            bcc: [],
            subject: "Hello",
            html: "",
            text: "x",
          },
          forwarded: [],
          files: [],
          saved: true,
          accounts,
        }}
        onClose={() => {}}
      />,
    );
  });
  const from = document.querySelector<HTMLSelectElement>('select[aria-label="From"]');
  expect(from?.disabled).toBe(true);
  expect(from?.value).toBe("c2");
});

it("sends after an autosave that was already in flight", async () => {
  let finishFirst: (value: { status: string }) => void = () => {};
  draftSave.mockReturnValueOnce(
    new Promise<{ status: string }>((resolve) => {
      finishFirst = resolve;
    }),
  );
  draftSave.mockResolvedValue({ status: "saved" });
  send.mockResolvedValue({ status: "sent" });
  vi.useFakeTimers();
  try {
    await open(reply("reply"));
    await type(field("Subject") as HTMLInputElement, "Re: Offsite!");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });
    expect(draftSave).toHaveBeenCalledTimes(1);
    await act(async () => button("Send").click());
    await act(async () => {
      finishFirst({ status: "saved" });
      await Promise.resolve();
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(1_500);
    });
    expect(draftSave).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNDO_SEND_MS);
    });
    expect(send).toHaveBeenCalledTimes(1);
  } finally {
    vi.useRealTimers();
  }
});

it("sends again after Undo while the first save is still running", async () => {
  let finishFirst: (value: { status: string }) => void = () => {};
  draftSave.mockReturnValueOnce(
    new Promise<{ status: string }>((resolve) => {
      finishFirst = resolve;
    }),
  );
  draftSave.mockResolvedValue({ status: "saved" });
  send.mockResolvedValue({ status: "sent" });
  vi.useFakeTimers();
  try {
    await open(reply("reply"));
    await type(field("Subject") as HTMLInputElement, "Re: Offsite!");
    await act(async () => button("Send").click());
    undoSend();
    const restoring = getOutbox().restoring;
    await act(async () => {
      for (const mountedRoot of mounted.splice(0)) mountedRoot.unmount();
    });
    document.body.innerHTML = "";
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    mounted.push(root);
    await act(async () => {
      root.render(
        <ComposeEmail
          seed={reply("reply")}
          accounts={[]}
          restore={restoring ?? undefined}
          onClose={() => {}}
        />,
      );
    });
    await type(field("Subject") as HTMLInputElement, "Re: Offsite?");
    await act(async () => button("Send").click());
    expect(draftSave).toHaveBeenCalledTimes(1);
    await act(async () => {
      finishFirst({ status: "saved" });
      await Promise.resolve();
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(1_500);
    });
    expect(draftSave).toHaveBeenCalledTimes(2);
    expect(draftSave.mock.calls[1]?.[0]).toMatchObject({ subject: "Re: Offsite?" });
    expect(draftSave.mock.invocationCallOrder[0]).toBeLessThan(
      draftSave.mock.invocationCallOrder[1] ?? Number.POSITIVE_INFINITY,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNDO_SEND_MS);
    });
    expect(send).toHaveBeenCalledTimes(1);
  } finally {
    vi.useRealTimers();
  }
});

it("locks From at the first save, not at its reply", async () => {
  let finish: (value: { status: string }) => void = () => {};
  draftSave.mockReturnValue(
    new Promise<{ status: string }>((resolve) => {
      finish = resolve;
    }),
  );
  vi.useFakeTimers();
  try {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    mounted.push(root);
    await act(async () => {
      root.render(
        <ComposeEmail
          seed={{ kind: "new" }}
          accounts={accounts}
          connectionId="c1"
          onClose={() => {}}
        />,
      );
    });
    const from = () => document.querySelector<HTMLSelectElement>('select[aria-label="From"]');
    expect(from()?.disabled).toBe(false);
    await type(field("Subject") as HTMLInputElement, "Hello");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });
    // The save has started but not answered; the account is already bound.
    expect(from()?.disabled).toBe(true);
    expect(from()?.value).toBe("c1");
    const select = from() as HTMLSelectElement;
    await act(async () => {
      select.value = "c2";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(from()?.value).toBe("c1");
    await act(async () => {
      finish({ status: "saved" });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(from()?.value).toBe("c1");
  } finally {
    vi.useRealTimers();
  }
});

it("keeps Send's final save ahead of a later discard", async () => {
  let finishFirst: (value: { status: string }) => void = () => {};
  draftSave.mockReturnValueOnce(
    new Promise<{ status: string }>((resolve) => {
      finishFirst = resolve;
    }),
  );
  draftSave.mockResolvedValue({ status: "saved" });
  discardDraft.mockResolvedValue({});
  vi.useFakeTimers();
  try {
    await open(reply("reply"));
    await type(field("Subject") as HTMLInputElement, "Re: Offsite!");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });
    expect(draftSave).toHaveBeenCalledTimes(1);
    await act(async () => button("Send").click());
    undoSend();
    const restoring = getOutbox().restoring;
    await act(async () => {
      for (const mountedRoot of mounted.splice(0)) mountedRoot.unmount();
    });
    document.body.innerHTML = "";
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    mounted.push(root);
    await act(async () => {
      root.render(
        <ComposeEmail
          seed={reply("reply")}
          accounts={[]}
          restore={restoring ?? undefined}
          onClose={() => {}}
        />,
      );
    });
    await act(async () =>
      (document.querySelector("button[aria-label='Discard']") as HTMLButtonElement).click(),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNDO_SEND_MS + 100);
    });
    expect(discardDraft).not.toHaveBeenCalled();
    await act(async () => {
      finishFirst({ status: "saved" });
      await Promise.resolve();
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(draftSave).toHaveBeenCalledTimes(2);
    expect(draftSave.mock.invocationCallOrder[0]).toBeLessThan(
      draftSave.mock.invocationCallOrder[1] ?? Number.POSITIVE_INFINITY,
    );
    expect(draftSave.mock.invocationCallOrder[1]).toBeLessThan(
      discardDraft.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
  } finally {
    vi.useRealTimers();
  }
});

it("saves the newest text last after Send, Undo and another Send", async () => {
  let finishFirst: (value: { status: string }) => void = () => {};
  draftSave.mockReturnValueOnce(
    new Promise<{ status: string }>((resolve) => {
      finishFirst = resolve;
    }),
  );
  draftSave.mockResolvedValue({ status: "saved" });
  send.mockResolvedValue({ status: "sent" });
  vi.useFakeTimers();
  try {
    await open(reply("reply"));
    await type(field("Subject") as HTMLInputElement, "Re: Offsite!");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });
    await act(async () => button("Send").click());
    undoSend();
    const restoring = getOutbox().restoring;
    await act(async () => {
      for (const mountedRoot of mounted.splice(0)) mountedRoot.unmount();
    });
    document.body.innerHTML = "";
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    mounted.push(root);
    await act(async () => {
      root.render(
        <ComposeEmail
          seed={reply("reply")}
          accounts={[]}
          restore={restoring ?? undefined}
          onClose={() => {}}
        />,
      );
    });
    await type(field("Subject") as HTMLInputElement, "Re: Offsite?");
    await act(async () => button("Send").click());
    await act(async () => {
      finishFirst({ status: "saved" });
      await Promise.resolve();
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(1_500);
    });
    const calls = draftSave.mock.calls.map(([call]) => call.subject);
    expect(calls.at(-1)).toBe("Re: Offsite?");
    expect(draftSave.mock.invocationCallOrder.at(-1)).toBeGreaterThan(
      draftSave.mock.invocationCallOrder[1] ?? 0,
    );
    undoSend();
  } finally {
    vi.useRealTimers();
  }
});

it("does not save or lock From without a chosen account", async () => {
  draftSave.mockResolvedValue({ status: "saved" });
  vi.useFakeTimers();
  try {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    mounted.push(root);
    await act(async () => {
      root.render(
        <ComposeEmail
          seed={{ kind: "new" }}
          accounts={accounts}
          connectionId=""
          onClose={() => {}}
        />,
      );
    });
    const from = () => document.querySelector<HTMLSelectElement>('select[aria-label="From"]');
    await type(field("Subject") as HTMLInputElement, "Hello");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });
    expect(draftSave).not.toHaveBeenCalled();
    expect(from()?.disabled).toBe(false);
    await act(async () => {
      const select = from() as HTMLSelectElement;
      select.value = "c1";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await type(field("Subject") as HTMLInputElement, "Hello there");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });
    expect(draftSave).toHaveBeenCalledTimes(1);
    expect(from()?.disabled).toBe(true);
    expect(from()?.value).toBe("c1");
  } finally {
    vi.useRealTimers();
  }
});
