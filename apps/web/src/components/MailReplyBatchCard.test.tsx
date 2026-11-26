// @vitest-environment jsdom

import type { MailBatch, MessageBlock } from "@rakazo/contracts";
import type { ComponentProps, ReactNode } from "react";
import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UNDO_SEND_MS, undoSend } from "../lib/outbox";
import { MailReplyBatchCard } from "./MailReplyBatchCard";

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
    Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
    Button: ({
      variant: _variant,
      size: _size,
      ...props
    }: ComponentProps<"button"> & { variant?: string; size?: string }) => (
      <button type="button" {...props} />
    ),
    Checkbox: ({
      checked,
      indeterminate,
      onCheckedChange,
      ...props
    }: {
      checked?: boolean;
      indeterminate?: boolean;
      onCheckedChange?: (value: boolean) => void;
    } & ComponentProps<"input">) => (
      <input
        type="checkbox"
        {...props}
        data-indeterminate={indeterminate ? "" : undefined}
        checked={checked}
        onChange={(event) => onCheckedChange?.(event.target.checked)}
      />
    ),
    cn: (...classes: unknown[]) => classes.filter(Boolean).join(" "),
    DropdownMenu: Plain,
    DropdownMenuContent: Plain,
    DropdownMenuItem: Plain,
    DropdownMenuTrigger: Plain,
    NativeSelect: (props: ComponentProps<"select">) => <select {...props} />,
    NativeSelectOption: (props: ComponentProps<"option">) => <option {...props} />,
    Input: (props: ComponentProps<"input">) => <input {...props} />,
    Textarea: (props: ComponentProps<"textarea">) => <textarea {...props} />,
  };
});
const rpc = vi.hoisted(() => ({
  threads: {
    mailBatch: vi.fn(),
    sendMailBatch: vi.fn(),
    retryMailBatch: vi.fn(),
    previewMailBatch: vi.fn(),
    mailBatchToComposer: vi.fn(),
  },
}));
vi.mock("../lib/rpc", () => ({ rpc }));

type Row = MailBatch["rows"][number];
const row = (id: string, extra: Partial<Row> = {}): Row => ({
  itemId: id,
  replyToId: `m-${id}`,
  to: [`${id}@customer.example.test`],
  cc: [],
  bcc: [],
  subject: `Re: ${id}`,
  body: `Hello ${id}\nSecond line`,
  hash: id.padEnd(64, "0"),
  seenMessageId: `m-${id}`,
  flags: [],
  startsUnticked: false,
  state: "reviewing",
  error: null,
  retryable: false,
  ...extra,
});
const batch = (rows: Row[], effectStatus = "intended"): MailBatch => ({
  account: "support@example.test",
  effectStatus,
  rows,
});
const block = (extra: object = {}) =>
  ({
    kind: "ask",
    text: "3 replies",
    approvalEffectId: "effect-1",
    status: "pending",
    mailBatch: { count: 3, sent: 0, failed: 0, unknown: 0 },
    actions: [{ id: "deny", label: "Discard" }],
    ...extra,
  }) as Extract<MessageBlock, { kind: "ask" }>;

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const onAnswer = vi.fn(async () => undefined);
const onOpenComposer = vi.fn();

const render = async (data: MailBatch, askBlock = block(), canAnswer = true) => {
  rpc.threads.mailBatch.mockResolvedValue(data);
  await act(async () => {
    // The app runs in StrictMode, which calls state updaters twice.
    root.render(
      <StrictMode>
        <MailReplyBatchCard
          block={askBlock}
          botId="bot-1"
          message={{ id: "message-1", runId: "run-1" }}
          canAnswer={canAnswer}
          onAnswer={onAnswer}
          onOpenComposer={onOpenComposer}
          fallback={<div>fallback card</div>}
        />
      </StrictMode>,
    );
    await vi.advanceTimersByTimeAsync(0);
  });
};
const button = (name: string) =>
  [...host.querySelectorAll("button")].find((el) => el.textContent?.trim() === name);
const buttonMatching = (pattern: RegExp) =>
  [...host.querySelectorAll("button")].find((el) => pattern.test(el.textContent ?? ""));
const click = (el: Element | undefined) =>
  act(async () => {
    el?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(0);
  });
const tick = (id: string) =>
  host.querySelector(
    `input[aria-label="Include reply to ${id}@customer.example.test"]`,
  ) as HTMLInputElement | null;
const items = () => [...host.querySelectorAll("li")].map((el) => el.textContent ?? "");
const type = (el: HTMLInputElement | HTMLTextAreaElement, value: string) =>
  act(async () => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
    Object.getOwnPropertyDescriptor(proto.prototype, "value")?.set?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(0);
  });
const settle = () => act(async () => void (await vi.advanceTimersByTimeAsync(500)));
const pressSend = async (name: RegExp) => {
  await click(buttonMatching(name));
  await act(async () => void (await vi.advanceTimersByTimeAsync(UNDO_SEND_MS)));
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  rpc.threads.sendMailBatch.mockResolvedValue({ ok: true });
  rpc.threads.retryMailBatch.mockResolvedValue({ ok: true, count: 1 });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

const threeRows = () => [
  row("clean"),
  row("flagged", {
    flags: ["not_on_thread"],
    startsUnticked: true,
    cc: ["x@elsewhere.example.test"],
  }),
  row("linked", { flags: ["has_link"] }),
];

it("puts flagged rows first and unticked, and shows every recipient bare and whole", async () => {
  await render(batch(threeRows()));
  expect(items()[0]).toContain("flagged@customer.example.test");
  expect(items()[0]).toContain("x@elsewhere.example.test");
  expect(items()[0]).toContain("Not on this thread");
  expect(tick("flagged")?.checked).toBe(false);
  expect(tick("clean")?.checked).toBe(true);
  // A link informs and stays ticked.
  expect(tick("linked")?.checked).toBe(true);
  expect(buttonMatching(/Send selected/)?.textContent).toContain("(2)");
  expect(host.textContent).toContain("3 replies");
  expect(host.textContent).toContain("Needs approval");
  expect(host.textContent).toContain("support@example.test");
});

it("posts only ticked rows, with hash and seen message, after the undo window", async () => {
  await render(batch(threeRows()));
  await click(tick("linked") as HTMLInputElement);
  await click(buttonMatching(/Send selected/));
  expect(rpc.threads.sendMailBatch).not.toHaveBeenCalled();
  await act(async () => void (await vi.advanceTimersByTimeAsync(UNDO_SEND_MS)));
  expect(rpc.threads.sendMailBatch).toHaveBeenCalledWith({
    botId: "bot-1",
    runId: "run-1",
    messageId: "message-1",
    rows: [{ itemId: "clean", hash: row("clean").hash, seenMessageId: "m-clean", flags: [] }],
  });
});

it("a deliberate tick of a flagged row sends it, with the newest message as acknowledged", async () => {
  await render(
    batch([
      row("flagged", { flags: ["new_message"], startsUnticked: true, seenMessageId: "newer" }),
    ]),
  );
  expect(buttonMatching(/Send selected/)?.disabled).toBe(true);
  await click(tick("flagged") as HTMLInputElement);
  await pressSend(/Send selected/);
  expect(rpc.threads.sendMailBatch.mock.calls[0]?.[0].rows).toEqual([
    {
      itemId: "flagged",
      hash: row("flagged").hash,
      seenMessageId: "newer",
      flags: ["new_message"],
    },
  ]);
});

it("opens a row without a second header or second buttons, and posts the edit", async () => {
  await render(batch([row("clean")]));
  await click(host.querySelector("li button") as Element);
  // The whole reply is on screen, inside the real mail card.
  expect(host.querySelector("[data-testid=mail-approval-card]")).not.toBeNull();
  expect(host.textContent).toContain("Second line");
  expect(button("Send")).toBeUndefined();
  expect(host.textContent).not.toContain("Mail Needs approval");
  expect(host.querySelectorAll("button")).not.toHaveLength(0);
  expect(
    [...host.querySelectorAll("button")].filter((el) => el.textContent === "Discard"),
  ).toHaveLength(1);
  await click(button("Edit"));
  rpc.threads.previewMailBatch.mockResolvedValue({
    rows: [{ itemId: "clean", flags: [], startsUnticked: false }],
  });
  await type(host.querySelector("textarea") as HTMLTextAreaElement, "An edited reply");
  await settle();
  await pressSend(/Send selected/);
  expect(rpc.threads.sendMailBatch.mock.calls[0]?.[0].rows[0].edits).toEqual({
    body: "An edited reply",
  });
});

it("an edit adding a recipient flags and unticks that row at once; Send waits for the check", async () => {
  await render(batch(threeRows()));
  const clean = [...host.querySelectorAll("li")].find((el) =>
    el.textContent?.includes("clean@customer"),
  );
  await click(clean?.querySelector("button") as Element);
  await click(button("Edit"));
  let answer: (value: unknown) => void = () => {};
  rpc.threads.previewMailBatch.mockReturnValue(
    new Promise((resolve) => {
      answer = resolve;
    }),
  );
  const cc = host.querySelector('input[aria-label="Cc"]') as HTMLInputElement;
  await type(cc, "new@elsewhere.example.test");
  expect(buttonMatching(/Send selected/)?.disabled).toBe(true);
  await settle();
  expect(rpc.threads.previewMailBatch).toHaveBeenCalledWith(
    expect.objectContaining({
      rows: [{ itemId: "clean", edits: { cc: "new@elsewhere.example.test" } }],
    }),
  );
  await act(async () => {
    answer({ rows: [{ itemId: "clean", flags: ["not_on_thread"], startsUnticked: true }] });
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(tick("clean")?.checked).toBe(false);
  expect(items().find((text) => text.includes("clean@customer"))).toContain("Not on this thread");
  // Ticking it again is the owner's choice and stays, until the flags change again.
  await click(tick("clean") as HTMLInputElement);
  expect(tick("clean")?.checked).toBe(true);
});

it("a press refused as stale rechecks an edited row: the new message flags and unticks it", async () => {
  await render(batch([row("one")]));
  await click(host.querySelector("li button") as Element);
  await click(button("Edit"));
  rpc.threads.previewMailBatch.mockResolvedValue({
    rows: [{ itemId: "one", flags: [], startsUnticked: false }],
  });
  await type(host.querySelector("textarea") as HTMLTextAreaElement, "An edited reply");
  await settle();
  expect(tick("one")?.checked).toBe(true);
  // A new email arrived: the press is refused, and the reload carries its id.
  rpc.threads.sendMailBatch.mockRejectedValueOnce(new Error("This card changed."));
  rpc.threads.mailBatch.mockResolvedValue(batch([row("one", { seenMessageId: "newer" })]));
  rpc.threads.previewMailBatch.mockResolvedValue({
    rows: [{ itemId: "one", flags: ["new_message"], startsUnticked: true }],
  });
  await pressSend(/Send selected/);
  // Send stays closed until the edited row has been checked again.
  expect(buttonMatching(/Send selected/)?.disabled).toBe(true);
  await settle();
  expect(items()[0]).toContain("New message");
  expect(tick("one")?.checked).toBe(false);
  // The deliberate tick posts the flags the owner was shown.
  await click(tick("one") as HTMLInputElement);
  await pressSend(/Send selected/);
  expect(rpc.threads.sendMailBatch.mock.lastCall?.[0].rows[0]).toMatchObject({
    seenMessageId: "newer",
    flags: ["new_message"],
  });
});

it("locks ticks and edits during the undo window, and Undo opens them again", async () => {
  await render(batch(threeRows()));
  const clean = [...host.querySelectorAll("li")].find((el) =>
    el.textContent?.includes("clean@customer"),
  );
  await click(clean?.querySelector("button") as Element);
  await click(button("Edit"));
  expect(host.querySelector("textarea")).not.toBeNull();
  await click(buttonMatching(/Send selected/));
  expect(tick("clean")?.disabled).toBe(true);
  expect(host.querySelector("textarea")).toBeNull();
  expect(button("Done")).toBeUndefined();
  await act(async () => undoSend());
  expect(tick("clean")?.disabled).toBe(false);
  expect(rpc.threads.sendMailBatch).not.toHaveBeenCalled();
});

it("an open row shows what another tab sent, with its real result, not the local edit", async () => {
  await render(batch([row("one")]));
  await click(host.querySelector("li button") as Element);
  await click(button("Edit"));
  rpc.threads.previewMailBatch.mockResolvedValue({
    rows: [{ itemId: "one", flags: [], startsUnticked: false }],
  });
  await type(host.querySelector("textarea") as HTMLTextAreaElement, "My local edit");
  await settle();
  rpc.threads.mailBatch.mockResolvedValue(
    batch(
      [
        row("one", {
          body: "What the other tab sent",
          hash: "z".repeat(64),
          state: "not_sent",
          retryable: true,
        }),
      ],
      "completed",
    ),
  );
  await act(async () => {
    root.render(
      <StrictMode>
        <MailReplyBatchCard
          block={block({
            status: "answered",
            answer: "send",
            mailBatch: { count: 1, sent: 0, failed: 1, unknown: 0, settled: true },
          })}
          botId="bot-1"
          message={{ id: "message-1", runId: "run-1" }}
          canAnswer
          onAnswer={onAnswer}
          onOpenComposer={onOpenComposer}
          fallback={<div>fallback card</div>}
        />
      </StrictMode>,
    );
    await vi.advanceTimersByTimeAsync(0);
  });
  const opened = host.querySelector("[data-testid=mail-approval-card]") as HTMLElement;
  expect(opened.textContent).toContain("What the other tab sent");
  expect(opened.textContent).toContain("This email was not sent");
  expect(host.textContent).not.toContain("My local edit");
  expect(host.querySelector("textarea")).toBeNull();
});

it("a row already taken to the composer can be opened again", async () => {
  const draft = {
    connectionId: "c1",
    account: "a@example.test",
    to: [],
    cc: [],
    bcc: [],
    subject: "s",
    body: "b",
  };
  rpc.threads.mailBatchToComposer.mockResolvedValue(draft);
  await render(
    batch([row("gone", { state: "composer" })], "completed"),
    block({ status: "answered", answer: "send" }),
  );
  await click(host.querySelector("li button") as Element);
  await click(button("Open in composer"));
  expect(onOpenComposer).toHaveBeenCalledWith(draft);
});

it("reviews hidden ticked rows before sending a large batch", async () => {
  const many = Array.from({ length: 12 }, (_, i) => row(`r${i}`));
  await render(batch(many));
  expect(items()).toHaveLength(8);
  expect(buttonMatching(/Send selected/)).toBeUndefined();
  await click(buttonMatching(/Review all \(12\)/));
  expect(items()).toHaveLength(12);
  expect(buttonMatching(/Send selected/)?.textContent).toContain("(12)");
});

it("shows See all when the hidden rows are unticked", async () => {
  const many = Array.from({ length: 10 }, (_, i) =>
    row(`r${i}`, i >= 8 ? {} : { flags: ["new_message"], startsUnticked: true }),
  );
  // Flagged first: the eight flagged rows fill the list; untick the two hidden ones is not possible,
  // so only unticked hidden rows show See all.
  await render(
    batch(many.map((item) => ({ ...item, flags: ["new_message"], startsUnticked: true }))),
  );
  expect(button("See all (10)")).toBeDefined();
  expect(buttonMatching(/Send selected/)).toBeDefined();
});

it("shows results per row, and Retry failed posts only retryable rows", async () => {
  await render(
    batch(
      [
        row("sent", { state: "sent" }),
        row("failed", { state: "not_sent", retryable: true }),
        row("unknown", { state: "unknown" }),
        row("skipped", { state: "skipped" }),
        row("hash", { state: "not_sent", error: "hash" }),
      ],
      "completed",
    ),
    block({
      status: "answered",
      answer: "send",
      mailBatch: { count: 5, sent: 1, failed: 2, unknown: 1 },
    }),
    false,
  );
  expect(host.textContent).toContain("1 sent · 2 not sent · 1 unknown");
  const text = items();
  expect(text.find((t) => t.includes("sent@"))).toContain("Sent");
  expect(text.find((t) => t.includes("failed@"))).toContain("Not sent");
  expect(text.find((t) => t.includes("unknown@"))).toContain("Unknown");
  expect(text.find((t) => t.includes("skipped@"))).toContain("Skipped");
  expect(host.querySelector("input[type=checkbox]")).toBeNull();
  await pressSend(/Retry failed/);
  expect(rpc.threads.retryMailBatch.mock.calls[0]?.[0].rows).toEqual([
    { itemId: "failed", seenMessageId: "m-failed" },
  ]);
});

it("offers no Retry failed when nothing can retry, and drops empty count parts", async () => {
  await render(
    batch([row("sent", { state: "sent" })], "completed"),
    block({
      status: "answered",
      answer: "send",
      mailBatch: { count: 1, sent: 1, failed: 0, unknown: 0 },
    }),
  );
  expect(buttonMatching(/Retry failed/)).toBeUndefined();
  expect(host.textContent).toContain("1 sent");
  expect(host.textContent).not.toContain("not sent");
});

it("takes a failed row to the composer and shows it as opened there", async () => {
  const draft = {
    connectionId: "c1",
    account: "support@example.test",
    to: ["failed@customer.example.test"],
    cc: [],
    bcc: [],
    subject: "Re: failed",
    body: "Hello",
    replyToId: "cached-1",
  };
  rpc.threads.mailBatchToComposer.mockResolvedValue(draft);
  await render(
    batch([row("failed", { state: "not_sent", retryable: true })], "completed"),
    block({ status: "answered", answer: "send" }),
  );
  await click(host.querySelector("li button") as Element);
  rpc.threads.mailBatch.mockResolvedValue(
    batch([row("failed", { state: "composer" })], "completed"),
  );
  await click(button("Open in composer"));
  expect(onOpenComposer).toHaveBeenCalledWith(draft);
  expect(items()[0]).toContain("Opened in composer");
  expect(buttonMatching(/Retry failed/)).toBeUndefined();
});

it("Discard answers the card with deny", async () => {
  await render(batch(threeRows()));
  await click(button("Discard"));
  expect(onAnswer).toHaveBeenCalledWith("deny");
  expect(rpc.threads.sendMailBatch).not.toHaveBeenCalled();
});

it("reloads and shows the reason when a press is refused", async () => {
  await render(batch(threeRows()));
  rpc.threads.sendMailBatch.mockRejectedValue(
    new Error("This card changed. Reload it and review again."),
  );
  rpc.threads.mailBatch.mockClear();
  await pressSend(/Send selected/);
  expect(host.textContent).toContain("This card changed");
  expect(rpc.threads.mailBatch).toHaveBeenCalled();
});

it("a row newly flagged on a reload is unticked; one the owner re-ticked stays", async () => {
  await render(batch([row("one")]));
  expect(tick("one")?.checked).toBe(true);
  rpc.threads.mailBatch.mockResolvedValue(
    batch([row("one", { flags: ["new_message"], startsUnticked: true, seenMessageId: "newer" })]),
  );
  await act(async () => {
    root.render(
      <MailReplyBatchCard
        block={block({
          mailBatch: { count: 1, sent: 0, failed: 0, unknown: 0 },
          answer: undefined,
          text: "1 replies",
        })}
        botId="bot-1"
        message={{ id: "message-1", runId: "run-1" }}
        canAnswer
        onAnswer={onAnswer}
        onOpenComposer={onOpenComposer}
        fallback={<div>fallback card</div>}
      />,
    );
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(tick("one")?.checked).toBe(false);
});

describe("new emails", () => {
  const fresh = (id: string, extra: Partial<Row> = {}) =>
    row(id, {
      replyToId: null,
      seenMessageId: null,
      subject: `Hello ${id}`,
      flags: ["new_recipient"],
      ...extra,
    });

  it("marks a new email apart from a reply, and titles the card with both", async () => {
    await render(batch([row("old"), fresh("new")]));
    expect(host.textContent).toContain("1 new email · 1 reply");
    const [reply, email] = items();
    expect(reply).not.toContain("New email");
    expect(email).toContain("New email");
    expect(email).toContain("New recipient");
    expect(
      host.querySelector('input[aria-label="Include new email to new@customer.example.test"]'),
    ).not.toBeNull();
    expect(tick("old")).not.toBeNull();
  });

  it("titles a card of new emails only, without repeating the badge on every row", async () => {
    await render(batch([fresh("a"), fresh("b")]));
    expect(host.textContent).toContain("2 new emails");
    expect(host.textContent).not.toContain("replies");
    expect(host.textContent).not.toContain("New email");
  });

  it("leaves a clean run's new email ticked and an outside-content run's unticked", async () => {
    await render(batch([fresh("a"), fresh("b", { startsUnticked: true })]));
    const box = (id: string) =>
      host.querySelector(
        `input[aria-label="Include new email to ${id}@customer.example.test"]`,
      ) as HTMLInputElement;
    expect(box("a").checked).toBe(true);
    expect(box("b").checked).toBe(false);
    expect(buttonMatching(/Send selected \(1\)/)).toBeDefined();
  });

  it("says why a row was held by the daily limit, and offers Retry failed", async () => {
    await render(
      batch(
        [fresh("a", { state: "not_sent", error: "daily_limit", retryable: true })],
        "completed",
      ),
      block({ status: "answered", answer: "send" }),
    );
    expect(host.textContent).toContain("Daily limit for new recipients reached");
    expect(button("Retry failed")).toBeDefined();
  });

  it("shows flags an edit gave a row that was not edited, and posts them", async () => {
    rpc.threads.previewMailBatch.mockResolvedValue({
      rows: [
        { itemId: "a", flags: ["duplicate_email", "new_recipient"], startsUnticked: true },
        { itemId: "b", flags: ["duplicate_email", "new_recipient"], startsUnticked: true },
      ],
    });
    await render(batch([fresh("a"), fresh("b")]));
    await click(buttonMatching(/a@customer/));
    await click(button("Edit"));
    const subject = [...host.querySelectorAll("input")].find(
      (el) => el.value === "Hello a",
    ) as HTMLInputElement;
    await type(subject, "Changed");
    await settle();
    expect(items()[1]).toContain("Possible duplicate");
    const box = (id: string) =>
      host.querySelector(
        `input[aria-label="Include new email to ${id}@customer.example.test"]`,
      ) as HTMLInputElement;
    expect(box("a").checked).toBe(false);
    expect(box("b").checked).toBe(false);
    await click(box("b"));
    expect(box("b").checked).toBe(true);
    await pressSend(/Send selected \(1\)/);
    expect(rpc.threads.sendMailBatch.mock.calls[0]?.[0].rows[0]).toMatchObject({
      itemId: "b",
      flags: ["duplicate_email", "new_recipient"],
    });
  });
});

describe("stale flags", () => {
  const settled = block({ status: "answered", answer: "send" });

  it("shows no flag on a sent row, open or closed", async () => {
    await render(
      batch(
        [row("a", { state: "sent", flags: ["already_sent"], startsUnticked: true })],
        "completed",
      ),
      settled,
    );
    expect(host.textContent).not.toContain("Already sent a few minutes ago");
    await click(buttonMatching(/a@customer/));
    expect(host.textContent).not.toContain("Already sent a few minutes ago");
  });

  it("keeps the flag on a row that was not sent", async () => {
    await render(
      batch(
        [row("a", { state: "not_sent", flags: ["already_sent"], startsUnticked: true })],
        "completed",
      ),
      settled,
    );
    expect(host.textContent).toContain("Already sent a few minutes ago");
  });
});

describe("held rows", () => {
  const settled = block({ status: "answered", answer: "send" });
  const occurrences = (text: string) => host.textContent?.split(text).length - 1;

  it("says why a row was held by the agent switch", async () => {
    await render(
      batch([row("a", { state: "not_sent", error: "switch", retryable: true })], "completed"),
      settled,
    );
    expect(host.textContent).toContain("Sending is off for this agent.");
  });

  it("shows the daily limit once when opened, and never blames Integrations", async () => {
    await render(
      batch([row("a", { state: "not_sent", error: "daily_limit", retryable: true })], "completed"),
      settled,
    );
    await click(buttonMatching(/a@customer/));
    expect(occurrences("Daily limit for new recipients reached")).toBe(1);
    expect(host.textContent).not.toContain("Check the account in Integrations");
  });

  it("keeps the plain Not sent for a hold with nothing to say", async () => {
    await render(
      batch([row("a", { state: "not_sent", error: "hash", retryable: false })], "completed"),
      settled,
    );
    expect(host.textContent).toContain("Not sent");
    expect(host.textContent).not.toContain("this agent");
  });
});

it("falls back to the plain card when the rows cannot be read", async () => {
  rpc.threads.mailBatch.mockRejectedValue(new Error("Not found"));
  await act(async () => {
    root.render(
      <MailReplyBatchCard
        block={block()}
        botId="bot-1"
        message={{ id: "message-1", runId: "run-1" }}
        canAnswer
        onAnswer={onAnswer}
        onOpenComposer={onOpenComposer}
        fallback={<div>fallback card</div>}
      />,
    );
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(host.textContent).toBe("fallback card");
});

describe("select all", () => {
  const selectAll = () => host.querySelector("#message-1-select-all") as HTMLInputElement | null;
  const ticks = () =>
    [...host.querySelectorAll('input[aria-label^="Include"]')] as HTMLInputElement[];
  const twelve = () => [
    ...Array.from({ length: 9 }, (_, i) => row(`r${i}`, { startsUnticked: true })),
    row("sent", { flags: ["already_sent"], startsUnticked: true }),
    row("dupe", { flags: ["duplicate_email"], startsUnticked: true }),
    row("held", { state: "not_sent", startsUnticked: true }),
  ];

  it("ticks every eligible row, hidden ones too, and skips flagged and held rows", async () => {
    await render(batch(twelve()));
    expect(items()).toHaveLength(8);
    await click(selectAll() ?? undefined);
    expect(buttonMatching(/Review all/)).toBeUndefined();
    expect(items()).toHaveLength(12);
    expect(selectAll()?.checked).toBe(true);
    expect(buttonMatching(/Send selected/)?.textContent).toContain("(9)");
    const unticked = ticks()
      .filter((el) => !el.checked)
      .map((el) => el.getAttribute("aria-label"));
    expect(unticked).toEqual([
      "Include reply to sent@customer.example.test",
      "Include reply to dupe@customer.example.test",
      "Include reply to held@customer.example.test",
    ]);
  });

  it("ticks rows that start unticked for outside content, but never one flagged to look at", async () => {
    await render(
      batch([
        row("a", { startsUnticked: true }),
        row("b", { flags: ["not_on_thread"], startsUnticked: true }),
        row("c", { flags: ["important_sender"], startsUnticked: true }),
        row("d", { flags: ["new_recipient"], startsUnticked: true }),
        row("e", { flags: ["has_link"] }),
      ]),
    );
    await click(selectAll() ?? undefined);
    const states = Object.fromEntries(
      ticks().map((el) => [el.getAttribute("aria-label"), el.checked]),
    );
    expect(states).toEqual({
      "Include reply to a@customer.example.test": true,
      "Include reply to b@customer.example.test": false,
      "Include reply to c@customer.example.test": false,
      "Include reply to d@customer.example.test": true,
      "Include reply to e@customer.example.test": true,
    });
    expect(buttonMatching(/Send selected/)?.textContent).toContain("(3)");
  });

  it("is hidden when every row carries a flag the owner must look at", async () => {
    await render(
      batch([
        row("a", { flags: ["not_on_thread"], startsUnticked: true }),
        row("b", { flags: ["important_sender"], startsUnticked: true }),
      ]),
    );
    expect(selectAll()).toBeNull();
  });

  it("is indeterminate when some are ticked, and a click ticks the rest", async () => {
    await render(
      batch([
        row("clean"),
        row("outside", { startsUnticked: true }),
        row("linked", { flags: ["has_link"] }),
      ]),
    );
    expect(ticks().map((el) => el.checked)).toEqual([false, true, true]);
    expect(selectAll()?.checked).toBe(false);
    expect(selectAll()?.hasAttribute("data-indeterminate")).toBe(true);
    await click(selectAll() ?? undefined);
    expect(ticks().map((el) => el.checked)).toEqual([true, true, true]);
    expect(selectAll()?.checked).toBe(true);
  });

  it("clears every row when everything eligible is ticked", async () => {
    await render(batch([row("a"), row("b"), row("c", { flags: ["has_link"] })]));
    expect(selectAll()?.checked).toBe(true);
    await click(selectAll() ?? undefined);
    expect(ticks().map((el) => el.checked)).toEqual([false, false, false]);
    expect(selectAll()?.checked).toBe(false);
    expect(selectAll()?.hasAttribute("data-indeterminate")).toBe(false);
    await click(selectAll() ?? undefined);
    expect(ticks().map((el) => el.checked)).toEqual([true, true, true]);
  });

  it("is hidden with one row, a closed card, or no eligible row", async () => {
    await render(batch([row("a")]));
    expect(selectAll()).toBeNull();
    await render(batch([row("a"), row("b")]), block({ status: "answered", answer: "send" }));
    expect(selectAll()).toBeNull();
    await render(batch([row("a"), row("b")]), block(), false);
    expect(selectAll()).toBeNull();
    await render(
      batch([
        row("a", { flags: ["already_sent"], startsUnticked: true }),
        row("b", { flags: ["duplicate_email"], startsUnticked: true }),
      ]),
    );
    expect(selectAll()).toBeNull();
  });

  it("sends exactly the ticked rows, collapsed ones included", async () => {
    await render(batch(twelve()));
    await click(selectAll() ?? undefined);
    await pressSend(/Send selected/);
    const sentIds = rpc.threads.sendMailBatch.mock.calls[0]?.[0].rows.map(
      (r: { itemId: string }) => r.itemId,
    );
    expect(sentIds).toEqual(Array.from({ length: 9 }, (_, i) => `r${i}`));
  });
});
