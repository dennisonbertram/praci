// @vitest-environment jsdom

import type { MailApproval } from "@rakazo/contracts";
import type { ComponentProps, ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
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
    Badge: ({ children }: { children?: ReactNode }) => <span data-testid="pill">{children}</span>,
    Button: ({
      variant: _variant,
      size: _size,
      ...props
    }: ComponentProps<"button"> & { variant?: string; size?: string }) => (
      <button type="button" {...props} />
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
    DropdownMenuTrigger: ({ children, render }: { children?: ReactNode; render?: ReactNode }) => (
      <button type="button" aria-label="menu trigger" data-has-render={Boolean(render)}>
        {children}
      </button>
    ),
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
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

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

it("shows the message fields without a pill while pending", async () => {
  await render();
  const text = host.textContent ?? "";
  for (const part of ["New email", "From", "me@example.test", "To", "Jana <jana@example.test>"]) {
    expect(text).toContain(part);
  }
  expect(text).toContain("Friday");
  expect(text).toContain("See you then.");
  expect(text).not.toContain("Cc");
  expect(text).not.toContain("Bcc");
  expect(host.querySelector("[data-testid=pill]")).toBeNull();
});

it("titles a reply and offers Save draft for a draft", async () => {
  await render({ mail: { ...mail, tool: "mail_draft", reply: true } });
  expect(host.querySelector("h3")?.textContent).toBe("Reply");
  expect(button("Save draft")).toBeDefined();
  expect(button("Send")).toBeUndefined();
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
  expect(onAnswer).toHaveBeenCalledWith("allow", undefined, {
    cc: "lee@example.test",
    subject: "Monday",
    body: "New text",
  });
});

it("approves unchanged mail without edits and discards with a deny", async () => {
  const first = await render();
  await click(button("Send"));
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
  expect(host.textContent).toContain("nope isn't a valid email address");
  await type(host.querySelector("input[aria-label=To]") as HTMLInputElement, "");
  await click(button("Send"));
  expect(host.textContent).toContain("Add a recipient.");
  expect(onAnswer).not.toHaveBeenCalled();
});

it("disables the bot's tool and denies the call from the menu", async () => {
  const { onAnswer, onDisableTool } = await render();
  expect(host.querySelector("[role=menuitemcheckbox]")?.getAttribute("aria-checked")).toBe("true");
  await click(button("Disable sending for Ada"));
  expect(onDisableTool).toHaveBeenCalledWith("mail_send");
  expect(onAnswer).toHaveBeenCalledWith("deny", undefined, undefined);
  await render({ mail: { ...mail, tool: "mail_draft" } });
  expect(button("Disable drafts for Ada")).toBeDefined();
});

it("keeps the call pending when disabling the tool fails", async () => {
  const onDisableTool = vi.fn(async () => {
    throw new Error("nope");
  });
  const { onAnswer } = await render({ onDisableTool });
  await click(button("Disable sending for Ada"));
  expect(onAnswer).not.toHaveBeenCalled();
  expect(host.textContent).toContain("nope");
});

it("hides the menu when the person cannot change the bot's tools", async () => {
  await render({ botName: undefined });
  expect(host.querySelector("[aria-label='menu trigger']")).toBeNull();
});

it("disables the actions while an answer is in flight", async () => {
  let finish!: () => void;
  const onAnswer = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
  await render({ onAnswer });
  await click(button("Send"));
  await click(button("Sending…"));
  expect(onAnswer).toHaveBeenCalledTimes(1);
  expect(button("Sending…")?.disabled).toBe(true);
  expect(button("Discard")?.disabled).toBe(true);
  expect(button("Edit")?.disabled).toBe(true);
  await act(async () => finish());
});

it("shows the outcome and no buttons once answered", async () => {
  await render({ status: "answered", answer: "allow", mail: { ...mail, subject: "Monday" } });
  expect(host.querySelector("[data-testid=pill]")?.textContent).toBe("Approved");
  expect(host.textContent).toContain("Monday");
  expect(button("Send")).toBeUndefined();
  expect(button("Edit")).toBeUndefined();
  await render({ status: "answered", answer: "deny" });
  expect(host.querySelector("[data-testid=pill]")?.textContent).toBe("Discarded");
});

it("shows what became of the person's own edited send", async () => {
  const edited = { ...mail, connectionId: "conn-1" };
  const pill = () => host.querySelector("[data-testid=pill]")?.textContent;
  await render({ status: "answered", answer: "deny", mail: edited });
  expect(pill()).toBe("Sending…");
  await render({ status: "answered", answer: "deny", mail: { ...edited, outcome: "sent" } });
  expect(pill()).toBe("Sent");
  await render({
    status: "answered",
    answer: "deny",
    mail: { ...edited, tool: "mail_draft", outcome: "saved" },
  });
  expect(pill()).toBe("Draft saved");
  await render({ status: "answered", answer: "deny", mail: { ...edited, outcome: "unknown" } });
  expect(pill()).toBe("Unknown");
  expect(host.textContent).toContain("Check Sent before trying again");
  expect(button("Open in composer")).toBeUndefined();
});

it("offers the composer when the edited send did not go out", async () => {
  const onOpenComposer = vi.fn();
  const failed = { ...mail, connectionId: "conn-1", outcome: "failed" as const };
  await render({ status: "answered", answer: "deny", mail: failed, onOpenComposer });
  expect(host.querySelector("[data-testid=pill]")?.textContent).toBe("Not sent");
  await click(button("Open in composer"));
  expect(onOpenComposer).toHaveBeenCalledWith(failed);
});
