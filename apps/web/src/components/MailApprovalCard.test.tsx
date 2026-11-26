// @vitest-environment jsdom

import type { MailApproval } from "@rakazo/contracts";
import { MAIL_ALREADY_SENT_REASON } from "@rakazo/contracts";
import type { ComponentProps, ReactElement, ReactNode } from "react";
import { act, cloneElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { closeRestored, UNDO_SEND_MS, undoSend } from "../lib/outbox";
import { MailApprovalCard } from "./MailApprovalCard";

vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, i) => text + part + (values[i] ?? ""), ""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@rakazo/ui-web", () => {
  const Plain = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Button: ({
      variant,
      size: _size,
      ...props
    }: ComponentProps<"button"> & { variant?: string; size?: string }) => (
      <button type="button" data-variant={variant} {...props} />
    ),
    cn: (...classes: unknown[]) => classes.filter(Boolean).join(" "),
    DropdownMenu: Plain,
    DropdownMenuCheckboxItem: ({
      checked,
      children,
    }: {
      checked?: boolean;
      children?: ReactNode;
    }) => (
      <div role="menuitemcheckbox" aria-checked={checked} tabIndex={0}>
        {children}
      </div>
    ),
    DropdownMenuContent: Plain,
    DropdownMenuItem: ({ onClick, children }: { onClick?: () => void; children?: ReactNode }) => (
      <button type="button" role="menuitem" onClick={onClick}>
        {children}
      </button>
    ),
    DropdownMenuTrigger: ({ children, render }: { children?: ReactNode; render?: ReactElement }) =>
      render ? (
        cloneElement(render, undefined, children)
      ) : (
        <button type="button" aria-label="menu trigger">
          {children}
        </button>
      ),
    NativeSelect: (props: ComponentProps<"select">) => <select {...props} />,
    NativeSelectOption: (props: ComponentProps<"option">) => <option {...props} />,
    Input: (props: ComponentProps<"input">) => <input {...props} />,
    Textarea: (props: ComponentProps<"textarea">) => <textarea {...props} />,
  };
});

const mail: MailApproval = {
  tool: "mail_send",
  account: "me@example.test",
  to: ["Jana <jana@example.test>"],
  cc: [],
  bcc: [],
  subject: "Friday",
  body: "See you then.",
};

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  closeRestored();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// A send waits out the outbox's undo window before the server is called.
const sent = () => act(async () => void (await vi.advanceTimersByTimeAsync(UNDO_SEND_MS)));

type Props = Partial<ComponentProps<typeof MailApprovalCard>>;
const render = async (props: Props = {}) => {
  const onAnswer = vi.fn(async () => undefined);
  const onDisableTool = vi.fn(async () => undefined);
  await act(async () =>
    root.render(
      <MailApprovalCard
        mail={mail}
        status="pending"
        canAnswer
        botName="Ada"
        onAnswer={onAnswer}
        onDisableTool={onDisableTool}
        {...props}
      />,
    ),
  );
  return { onAnswer, onDisableTool };
};
const button = (name: string) =>
  [...host.querySelectorAll("button")].find((el) => el.textContent?.trim() === name) as
    | HTMLButtonElement
    | undefined;
const click = (el: Element | undefined) =>
  act(async () => {
    el?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
const type = (el: HTMLInputElement | HTMLTextAreaElement, value: string) =>
  act(async () => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
    Object.getOwnPropertyDescriptor(proto.prototype, "value")?.set?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });

const header = () =>
  (host.querySelector("[data-testid=mail-approval-card] > div") as HTMLElement).textContent ?? "";
const toggle = () => host.querySelector("button[aria-expanded]") as HTMLButtonElement | null;

it("starts expanded while pending, with the status and first recipient in the header", async () => {
  await render();
  const text = host.textContent ?? "";
  for (const part of ["From", "me@example.test", "To", "Jana <jana@example.test>"]) {
    expect(text).toContain(part);
  }
  expect(header()).toBe("Mail Needs approvalEdit");
  expect(host.querySelector("h3")?.textContent).toBe("Friday");
  expect(text).toContain("See you then.");
  expect(text).not.toContain("Cc");
  expect(text).not.toContain("Bcc");
  expect(toggle()).toBeNull();
});

it("shows why a background run asked, above Send and Discard", async () => {
  await render({ reason: "Asked because this ran in the background." });
  expect(host.textContent).toContain("Asked because this ran in the background.");
  await render();
  expect(host.textContent).not.toContain("Asked because");
});

const accounts = [
  { connectionId: "c1", label: "Work", address: "work@example.test" },
  { connectionId: "c2", label: "Home", address: "home@example.test" },
];
const select = () => host.querySelector('select[aria-label="From"]') as HTMLSelectElement | null;
const choose = (el: HTMLSelectElement, value: string) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(el, value);
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });

it("holds Send until a sender is chosen when no account was named and several are connected", async () => {
  const { account: _account, ...unnamed } = mail;
  const { onAnswer } = await render({ mail: { ...unnamed, choices: accounts } });
  expect(button("Send")?.disabled).toBe(true);
  await choose(select()!, "c2");
  expect(button("Send")?.disabled).toBe(false);
  await click(button("Send"));
  await sent();
  expect(onAnswer).toHaveBeenCalledWith("allow", undefined, { account: "c2" });
});

it("lists only the accounts the server offered for this agent", async () => {
  const { account: _account, ...unnamed } = mail;
  await render({ mail: { ...unnamed, choices: accounts } });
  expect([...select()!.options].map((option) => option.textContent)).toEqual([
    "Choose an account",
    "work@example.test",
    "home@example.test",
  ]);
});

it("shows a plain From line with a single account and sends the agent's call unchanged", async () => {
  const { onAnswer } = await render();
  expect(select()).toBeNull();
  await click(button("Send"));
  await sent();
  expect(onAnswer).toHaveBeenCalledWith("allow", undefined, undefined);
});

it("offers Save draft for a draft", async () => {
  await render({ mail: { ...mail, tool: "mail_draft", reply: true } });
  expect(button("Save draft")).toBeDefined();
  expect(button("Send")).toBeUndefined();
});

it("supports a gated founder editor without copy recipients", async () => {
  const onFieldsChange = vi.fn();
  const { onAnswer } = await render({
    initialEditing: true,
    allowLabel: "Approve",
    allowDisabled: true,
    toOnly: true,
    onFieldsChange,
  });
  expect(host.querySelector('[aria-label="Cc"]')).toBeNull();
  expect(host.querySelector('[aria-label="Bcc"]')).toBeNull();
  expect(button("Approve")?.disabled).toBe(true);
  await click(button("Approve"));
  expect(onAnswer).not.toHaveBeenCalled();
  await type(host.querySelector('[aria-label="Message"]')!, "Changed body");
  expect(onFieldsChange).toHaveBeenLastCalledWith({
    to: "Jana <jana@example.test>",
    cc: "",
    bcc: "",
    subject: "Friday",
    body: "Changed body",
  });
});

it("collapses a long body and toggles it with aria-expanded", async () => {
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(144);
  await render({ mail: { ...mail, body: "line\n".repeat(30) } });
  const toggle = button("Show more");
  expect(toggle?.getAttribute("aria-expanded")).toBe("false");
  await click(toggle);
  expect(button("Show less")?.getAttribute("aria-expanded")).toBe("true");
  expect(host.querySelector("[data-testid=mail-approval-body]")?.className).not.toContain(
    "max-h-36",
  );
});

it("has no toggle when the body fits", async () => {
  await render();
  expect(button("Show more")).toBeUndefined();
});

it("edits in place with a distinct style and sends only the changed fields", async () => {
  const { onAnswer } = await render();
  const card = host.querySelector("[data-testid=mail-approval-card]") as HTMLElement;
  expect(card.className).not.toContain("ring-primary");
  await click(button("Edit"));
  expect(card.className).toContain("ring-2 ring-primary");
  expect(button("Done")).toBeDefined();
  // Cc and Bcc are offered while editing.
  const cc = host.querySelector("input[aria-label=Cc]") as HTMLInputElement;
  await type(cc, "lee@example.test");
  await type(host.querySelector("input[aria-label=Subject]") as HTMLInputElement, "Monday");
  await type(host.querySelector("textarea") as HTMLTextAreaElement, "New text");
  await click(button("Send"));
  await sent();
  expect(onAnswer).toHaveBeenCalledWith("allow", undefined, {
    cc: "lee@example.test",
    subject: "Monday",
    body: "New text",
  });
});

it("approves unchanged mail without edits and discards with a deny", async () => {
  const first = await render();
  await click(button("Send"));
  await sent();
  expect(first.onAnswer).toHaveBeenCalledWith("allow", undefined, undefined);
  const second = await render();
  await click(button("Discard"));
  expect(second.onAnswer).toHaveBeenCalledWith("deny", undefined, undefined);
});

it("blocks an invalid address or a send with no recipient before calling the server", async () => {
  const { onAnswer } = await render();
  await click(button("Edit"));
  await type(host.querySelector("input[aria-label=To]") as HTMLInputElement, "nope");
  await click(button("Send"));
  await sent();
  expect(host.textContent).toContain("nope isn't a valid email address");
  await type(host.querySelector("input[aria-label=To]") as HTMLInputElement, "");
  await click(button("Send"));
  await sent();
  expect(host.textContent).toContain("Add a recipient.");
  expect(onAnswer).not.toHaveBeenCalled();
});

it("disables the bot's tool and denies the call from the menu", async () => {
  const { onAnswer, onDisableTool } = await render();
  expect(host.querySelector("[role=menuitemcheckbox]")).toBeNull();
  await click(button("Disable sending for Ada"));
  // It asks first; nothing happens until confirmed, and Cancel backs out.
  expect(host.textContent).toContain("Turn off sending for Ada?");
  expect(onDisableTool).not.toHaveBeenCalled();
  await click(button("Cancel"));
  expect(button("Send")).toBeDefined();
  await click(button("Disable sending for Ada"));
  await click(button("Turn off"));
  expect(onDisableTool).toHaveBeenCalledWith("mail_send");
  expect(onAnswer).toHaveBeenCalledWith("deny", undefined, undefined);
  expect(host.querySelector("[role=status]")?.textContent).toContain("Sending is off for Ada");
  await render({ mail: { ...mail, tool: "mail_draft" } });
  expect(button("Disable drafts for Ada")).toBeDefined();
});

it("keeps the call pending when disabling the tool fails", async () => {
  const onDisableTool = vi.fn(async () => {
    throw new Error("nope");
  });
  const { onAnswer } = await render({ onDisableTool });
  await click(button("Disable sending for Ada"));
  await click(button("Turn off"));
  expect(onAnswer).not.toHaveBeenCalled();
  expect(host.querySelector("[role=alert]")?.textContent).toContain("nope");
  expect(button("Send")).toBeDefined();
});

it("hides the menu when the person cannot change the bot's tools", async () => {
  await render({ botName: undefined });
  expect(host.querySelector("[aria-label='menu trigger']")).toBeNull();
});

it("holds Send for the undo window, then disables the actions while the answer is in flight", async () => {
  let finish!: () => void;
  const onAnswer = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
  await render({ onAnswer });
  await click(button("Send"));
  // No in-card "Sending…": the bottom toast says it, and nothing reached the server yet.
  expect(host.textContent).not.toContain("Sending…");
  expect(onAnswer).not.toHaveBeenCalled();
  expect(button("Send")?.disabled).toBe(true);
  await sent();
  await click(button("Send"));
  expect(onAnswer).toHaveBeenCalledTimes(1);
  expect(button("Discard")?.disabled).toBe(true);
  expect(button("Edit")?.disabled).toBe(true);
  await act(async () => finish());
  expect(button("Discard")?.disabled).toBe(false);
});

it("Undo before the hold ends sends nothing and leaves the card pending", async () => {
  const { onAnswer } = await render();
  await click(button("Send now") ?? button("Send"));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1_000);
    undoSend();
  });
  await sent();
  expect(onAnswer).not.toHaveBeenCalled();
  expect(button("Send")?.disabled).toBe(false);
  expect(button("Discard")?.disabled).toBe(false);
});

it("Send now holds, then answers with send: true; Undo leaves the draft pending", async () => {
  const { onAnswer } = await render({ mail: draftMail, canSend: true });
  await click(button("Send now"));
  await act(async () => undoSend());
  await sent();
  expect(onAnswer).not.toHaveBeenCalled();
  expect(button("Send now")?.disabled).toBe(false);
  await click(button("Send now"));
  expect(onAnswer).not.toHaveBeenCalled();
  await sent();
  expect(onAnswer).toHaveBeenCalledWith("allow", undefined, { send: true });
});

it("Send on a saved draft calls the server only after the hold, and Undo keeps Draft saved", async () => {
  const onSendDraft = vi.fn(async () => undefined);
  await render({
    mail: { ...draftMail, outcome: "saved" },
    status: "answered",
    answer: "allow",
    canSend: true,
    onSendDraft,
  });
  await click(button("Send"));
  expect(onSendDraft).not.toHaveBeenCalled();
  await act(async () => undoSend());
  await sent();
  expect(onSendDraft).not.toHaveBeenCalled();
  expect(button("Send")?.disabled).toBe(false);
  expect(header()).toContain("Draft saved");
});

it("keeps the send after the card leaves the page during the hold", async () => {
  const { onAnswer } = await render();
  await click(button("Send"));
  await act(async () => root.unmount());
  await sent();
  expect(onAnswer).toHaveBeenCalledTimes(1);
  root = createRoot(host);
});

it("Save draft and Discard stay immediate", async () => {
  const { onAnswer } = await render({ mail: draftMail, canSend: true });
  await click(button("Save draft"));
  expect(onAnswer).toHaveBeenCalledWith("allow", undefined, undefined);
});

const openLink = () =>
  host.querySelector('a[aria-label="Open in Gmail"]') as HTMLAnchorElement | null;

it("links a sent mail to the account's Gmail Sent folder in a new tab", async () => {
  await render({ mail: { ...mail, outcome: "sent" }, status: "answered", answer: "allow" });
  const link = openLink();
  expect(link?.href).toBe("https://mail.google.com/mail/u/me%40example.test/#sent");
  expect(link?.target).toBe("_blank");
  expect(link?.rel).toBe("noopener noreferrer");
});

it("links a saved draft to Gmail Drafts", async () => {
  await render({ mail: { ...draftMail, outcome: "saved" }, status: "answered", answer: "allow" });
  expect(openLink()?.href).toBe("https://mail.google.com/mail/u/me%40example.test/#drafts");
});

it("links a sent mail to its conversation, or its message when there is no thread id", async () => {
  const done = { status: "answered", answer: "allow" } as const;
  await render({ mail: { ...mail, outcome: "sent", threadId: "18abc", messageId: "m1" }, ...done });
  expect(openLink()?.href).toBe("https://mail.google.com/mail/u/me%40example.test/#all/18abc");
  await render({ mail: { ...mail, outcome: "sent", messageId: "m1" }, ...done });
  expect(openLink()?.href).toBe("https://mail.google.com/mail/u/me%40example.test/#all/m1");
});

it("has no Gmail link on a pending or unsent card", async () => {
  await render();
  expect(openLink()).toBeNull();
  await render({ mail: { ...mail, outcome: "failed" }, status: "answered", answer: "allow" });
  expect(openLink()).toBeNull();
});

it("folds a finished card to its header and opens it with the chevron", async () => {
  await render({ status: "answered", answer: "allow", mail: { ...mail, subject: "Monday" } });
  expect(header()).toBe("Mail Sending… · jana@example.testMonday");
  expect(toggle()?.getAttribute("aria-expanded")).toBe("false");
  expect(host.querySelector("h3")).toBeNull();
  await click(toggle() ?? undefined);
  expect(toggle()?.getAttribute("aria-expanded")).toBe("true");
  expect(host.querySelector("h3")?.textContent).toBe("Monday");
  expect(host.textContent).toContain("See you then.");
  expect(button("Send")).toBeUndefined();
  expect(button("Edit")).toBeUndefined();
  await render({ status: "answered", answer: "deny" });
  expect(header()).toContain("Discarded");
});

it("folds up once the pending card is answered", async () => {
  await render();
  expect(host.querySelector("h3")).not.toBeNull();
  await render({ status: "answered", answer: "allow" });
  expect(host.querySelector("h3")).toBeNull();
});

it("shows what became of the person's own edited send", async () => {
  const edited = { ...mail, connectionId: "conn-1" };
  const status = () => header().replace("Mail ", "").split(" · ")[0];
  await render({ status: "answered", answer: "deny", mail: edited });
  expect(status()).toBe("Sending…");
  await render({ status: "answered", answer: "deny", mail: { ...edited, outcome: "sent" } });
  expect(status()).toBe("Sent");
  await render({
    status: "answered",
    answer: "deny",
    mail: { ...edited, tool: "mail_draft", outcome: "saved" },
  });
  expect(status()).toBe("Draft saved");
  await render({ status: "answered", answer: "deny", mail: { ...edited, outcome: "unknown" } });
  expect(status()).toBe("Unknown");
  expect(host.textContent).toContain("Check Sent in your mail before trying again");
  await render({
    status: "answered",
    answer: "deny",
    mail: { ...edited, tool: "mail_draft", outcome: "unknown" },
  });
  expect(host.textContent).toContain("Check Drafts in your mail before trying again");
  expect(button("Open in composer")).toBeUndefined();
});

it("keeps a failed send open and offers the composer", async () => {
  const onOpenComposer = vi.fn();
  const failed = { ...mail, connectionId: "conn-1", outcome: "failed" as const };
  await render({ status: "answered", answer: "deny", mail: failed, onOpenComposer });
  expect(header()).toContain("Not sent");
  await click(button("Open in composer"));
  expect(onOpenComposer).toHaveBeenCalledWith(failed);
});

it("says Sent, or Not sent with the reason, once an approved send ends", async () => {
  const status = () => header().replace("Mail ", "").split(" · ")[0];
  await render({ status: "answered", answer: "allow", mail: { ...mail, outcome: "sent" } });
  expect(status()).toBe("Sent");
  await render({
    status: "answered",
    answer: "allow",
    mail: { ...mail, outcome: "failed", error: "No connected mail account" },
  });
  expect(status()).toBe("Not sent");
  expect(host.textContent).toContain("No connected mail account");
  // The caller supplies the account when the card has none, so a failed send always has a way on.
  expect(button("Open in composer")).toBeUndefined();
  await render({
    status: "answered",
    answer: "allow",
    mail: { ...mail, outcome: "failed", error: "No connected mail account" },
    onOpenComposer: vi.fn(),
  });
  expect(button("Open in composer")).toBeDefined();
});

it("offers the composer after the agent's own send fails, once the account is known", async () => {
  const onOpenComposer = vi.fn();
  const failed = {
    ...mail,
    outcome: "failed" as const,
    error: "Message not found",
    connectionId: "conn-1",
    account: "maya@example.test",
  };
  await render({ status: "answered", answer: "allow", mail: failed, onOpenComposer });
  expect(host.textContent).toContain("Message not found");
  await click(button("Open in composer"));
  expect(onOpenComposer).toHaveBeenCalledWith(failed);
});

it("shows Cc and Bcc rows only when the message has them", async () => {
  await render({ mail: { ...mail, cc: ["lee@example.test"], bcc: ["pat@example.test"] } });
  expect(host.textContent).toContain("Cc");
  expect(host.textContent).toContain("lee@example.test");
  expect(host.textContent).toContain("Bcc");
});

it("offers no Edit on a card that replaces a saved draft, but still answers it", async () => {
  const { onAnswer } = await render({ mail: { ...mail, tool: "mail_draft", locked: true } });
  expect(button("Edit")).toBeUndefined();
  await click(button("Save draft"));
  expect(onAnswer).toHaveBeenCalledWith("allow", undefined, undefined);
});

it("keeps the row labels readable, and hides them only while an input names the row", async () => {
  await render();
  const label = (text: string) =>
    [...host.querySelectorAll("span")].find((el) => el.textContent === text) as HTMLElement;
  expect(label("To").getAttribute("aria-hidden")).toBeNull();
  expect(label("From").getAttribute("aria-hidden")).toBeNull();
  await click(button("Edit"));
  expect(label("To").getAttribute("aria-hidden")).toBe("true");
  expect(label("From").getAttribute("aria-hidden")).toBeNull();
  expect(host.querySelector("input[aria-label=To]")).not.toBeNull();
});

it("moves focus to the header toggle when answering removes the focused button", async () => {
  await render();
  const send = button("Send");
  send?.focus();
  await click(send);
  await render({ status: "answered", answer: "allow" });
  expect(document.activeElement).toBe(toggle());
});

it("leaves focus alone when the answer came from somewhere else", async () => {
  await render();
  const outside = document.createElement("button");
  document.body.append(outside);
  outside.focus();
  await render({ status: "answered", answer: "allow" });
  expect(document.activeElement).toBe(outside);
  outside.remove();
});

it("says a failed draft save is a draft that was not saved", async () => {
  await render({
    status: "answered",
    answer: "deny",
    mail: { ...mail, tool: "mail_draft", connectionId: "conn-1", outcome: "failed" },
    onOpenComposer: vi.fn(),
  });
  expect(header()).toContain("Draft not saved");
});

it("shows a locked card for sending a saved draft, with no recipient required", async () => {
  const { onAnswer } = await render({
    mail: { ...mail, locked: true, to: [], subject: "", body: "" },
  });
  expect(button("Edit")).toBeUndefined();
  expect(host.textContent).not.toContain("To");
  await click(button("Send saved draft"));
  await sent();
  expect(onAnswer).toHaveBeenCalledWith("allow", undefined, undefined);
});

it("does not repeat the recipient in the header while the To row is showing", async () => {
  await render();
  expect(header()).not.toContain("jana@example.test");
});

it("gives a failed send with no error text a reason and the next step", async () => {
  const failed = { ...mail, connectionId: "conn-1", outcome: "failed" as const };
  await render({ status: "answered", answer: "allow", mail: failed, onOpenComposer: vi.fn() });
  expect(host.querySelector("p[role=status]")?.textContent).toBe(
    "This email was not sent. Check the account in Integrations, then open it in the composer.",
  );
});

it("says why Send is disabled until a sender is chosen", async () => {
  const { account: _account, ...unnamed } = mail;
  await render({ mail: { ...unnamed, choices: accounts } });
  expect(host.querySelector("[id$=-hint]")?.textContent).toBe("Choose an account to send from.");
  await choose(select()!, "c2");
  expect(host.querySelector("[id$=-hint]")).toBeNull();
});

it("moves focus into the disable confirmation, and back to More on cancel or failure", async () => {
  const onDisableTool = vi.fn(async () => {
    throw new Error("nope");
  });
  await render({ onDisableTool });
  await click(button("Disable sending for Ada"));
  const group = host.querySelector("fieldset") as HTMLElement;
  expect(group.getAttribute("aria-labelledby")).toBe(group.querySelector("span")?.id);
  expect(document.activeElement).toBe(button("Cancel"));
  await click(button("Cancel"));
  expect(host.querySelector("fieldset")).toBeNull();
  expect(document.activeElement).toBe(host.querySelector("[aria-label=More]"));
  await click(button("Disable sending for Ada"));
  await click(button("Turn off"));
  expect(host.querySelector("[role=alert]")?.textContent).toContain("nope");
  expect(document.activeElement).toBe(host.querySelector("[aria-label=More]"));
});

it("keeps the More button on the Send and Discard line when the account hint shows", async () => {
  const accounts = [
    { connectionId: "c1", label: "a", address: "a@example.test" },
    { connectionId: "c2", label: "b", address: "b@example.test" },
  ];
  await render({ mail: { ...mail, account: undefined, choices: accounts } });
  const hint = [...host.querySelectorAll("p")].find((p) =>
    p.textContent?.includes("Choose an account to send from."),
  );
  const row = button("Send")?.parentElement?.parentElement as HTMLElement;
  expect(row.contains(hint as Node)).toBe(false);
  expect(row.contains(host.querySelector("[aria-label=More]"))).toBe(true);
});

const draftMail: MailApproval = { ...mail, tool: "mail_draft" };

it("offers Send now beside Save draft on a pending draft, and sends the edits with send: true", async () => {
  const { onAnswer } = await render({ mail: draftMail, canSend: true });
  expect(button("Send now")).toBeDefined();
  expect(button("Save draft")).toBeDefined();
  await click(button("Edit"));
  await type(host.querySelector('input[aria-label="Subject"]') as HTMLInputElement, "Monday");
  await click(button("Send now"));
  await sent();
  expect(onAnswer).toHaveBeenCalledTimes(1);
  expect(onAnswer).toHaveBeenCalledWith("allow", undefined, { subject: "Monday", send: true });
});

it("Save draft still saves without send", async () => {
  const { onAnswer } = await render({ mail: draftMail, canSend: true });
  await click(button("Save draft"));
  expect(onAnswer).toHaveBeenCalledWith("allow", undefined, undefined);
});

it("hides Send now and Send when sending is off, and on a send card", async () => {
  await render({ mail: draftMail, canSend: false });
  expect(button("Send now")).toBeUndefined();
  await render({ canSend: true });
  expect(button("Send now")).toBeUndefined();
  await render({
    mail: { ...draftMail, outcome: "saved" },
    status: "answered",
    answer: "allow",
    canSend: false,
    onSendDraft: vi.fn(async () => undefined),
  });
  expect(button("Send")).toBeUndefined();
});

it("offers Send on a saved draft and asks the server to send it", async () => {
  const onSendDraft = vi.fn(async () => undefined);
  const { onAnswer } = await render({
    mail: { ...draftMail, outcome: "saved" },
    status: "answered",
    answer: "allow",
    canSend: true,
    onSendDraft,
  });
  await click(button("Send"));
  await sent();
  expect(onSendDraft).toHaveBeenCalledTimes(1);
  expect(onAnswer).not.toHaveBeenCalled();
});

it("shows an error when sending a saved draft fails", async () => {
  await render({
    mail: { ...draftMail, outcome: "saved" },
    status: "answered",
    answer: "allow",
    canSend: true,
    onSendDraft: async () => {
      throw new Error("Could not submit this answer");
    },
  });
  await click(button("Send"));
  await sent();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Could not submit");
});

it("reads Not sent, not Draft not saved, when Send now failed", async () => {
  // The server flips the card to a send when it claims Send now.
  await render({
    mail: { ...mail, outcome: "failed", connectionId: "c1" },
    status: "answered",
    answer: "deny",
  });
  expect(header()).toContain("Not sent");
  expect(host.textContent).not.toContain("Draft not saved");
});

it("embedded in a batch row it shows the fields without its header or buttons", async () => {
  await render({ embedded: { editing: false } });
  expect(button("Send")).toBeUndefined();
  expect(button("Discard")).toBeUndefined();
  expect(button("Edit")).toBeUndefined();
  expect(host.textContent).toContain(mail.body);
  await render({ embedded: { editing: true } });
  expect(host.querySelector("textarea")?.value).toBe(mail.body);
});

it("warns on a repeat of an email that just went out, and Send is still there to press", async () => {
  const { onAnswer } = await render({ reason: MAIL_ALREADY_SENT_REASON });
  expect(host.textContent).toContain("Already sent to this person a few minutes ago");
  const send = [...host.querySelectorAll("button")].find((b) => b.textContent === "Send")!;
  expect(send.getAttribute("data-variant")).toBe("secondary");
  await act(async () => send.click());
  await sent();
  expect(onAnswer).toHaveBeenCalledWith("allow", undefined, undefined);
});
