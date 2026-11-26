// @vitest-environment jsdom

import { ORPCError } from "@orpc/client";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, i) => text + part + String(values[i] ?? ""), "");
  return {
    useLingui: () => ({ t }),
    Trans: ({ children }: { children: ReactNode }) => children,
  };
});
vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, i) => text + part + String(values[i] ?? ""), ""),
  plural: (n: number, forms: { one: string; other: string }) =>
    (n === 1 ? forms.one : forms.other).replace("#", String(n)),
}));
vi.mock("../../components/SandboxedHtmlViewer", () => ({
  SandboxedHtmlViewer: () => <div data-testid="html-frame" />,
}));
vi.mock("../../components/ComposeEmail", () => ({
  ComposeEmail: ({
    seed,
    draft,
    restore,
    onSent,
  }: {
    seed: { kind: string };
    draft?: string;
    restore?: { fields: object; replyToId?: string };
    onSent?: () => void;
  }) => (
    <div data-testid="compose">
      <button type="button" aria-label="mock send" onClick={onSent} />
      {seed.kind}
      {draft ? `:${draft}` : ""}
      {restore ? `|${JSON.stringify(restore.fields)}|reply-to:${restore.replyToId}` : ""}
    </div>
  ),
}));
vi.mock("./EmailAgentPanel", () => ({
  EmailAgentPanel: ({
    bot,
    onClose,
    onReplyWithDraft,
  }: {
    bot: { name: string };
    onClose: () => void;
    onReplyWithDraft: (text: string, failed?: object) => void;
  }) => (
    <aside data-testid="agent-panel">
      {bot.name}
      <button type="button" onClick={onClose}>
        panel close
      </button>
      <button type="button" onClick={() => onReplyWithDraft("Hi Sam")}>
        panel draft
      </button>
      <button
        type="button"
        onClick={() =>
          onReplyWithDraft("Body", {
            connectionId: "c9",
            account: "me@example.com",
            to: ["x@example.com"],
            cc: ["cc@example.com"],
            bcc: ["bcc@example.com"],
            subject: "Edited subject",
            body: "Body",
          })
        }
      >
        panel failed
      </button>
    </aside>
  ),
}));
vi.mock("./ContextPanel", () => ({
  ContextPanel: ({ people }: { people: Array<{ email: string }> }) => (
    <div data-testid="context-people">{people.map((p) => p.email).join(",")}</div>
  ),
}));
vi.mock("react-router-dom", () => ({
  Link: ({ to, render: _render, ...props }: { to: string; render?: unknown }) => (
    <a href={to} {...props} />
  ),
}));
vi.mock("../../lib/mail-context-panel", async () => {
  const { useState } = await import("react");
  return { useContextPanelOpen: () => useState(true) };
});
const get = vi.fn();
vi.mock("../../lib/rpc", () => ({
  rpc: { inbox: { get: (input: unknown) => get(input) } },
  withSpaceHeaders: () => new Headers(),
}));

import { setHideAmounts } from "../../lib/hide-amounts-preference";
import { clearInboxMessages } from "../../lib/inbox-message-cache";
import { MAIL_SENT_EVENT } from "../../lib/outbox";
import type { ComposeRestore } from "../ComposeEmail";
import { forgetClosed, rememberClosed } from "../compose/draft-memory";
import { InboxMessageDialog } from "./InboxMessageDialog";

const message = (id: string) => ({
  id,
  subject: `Subject ${id}`,
  from: "a@example.com",
  to: "b@example.com",
  cc: "",
  date: "2026-10-10T09:00:00.000Z",
  text: "body",
  html: null,
  attachments: [],
});

let clock = Date.now();
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  clock += 60_000; // each test starts past the j/k throttle the previous one left
  vi.setSystemTime(clock);
  get.mockReset();
  clearInboxMessages();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  root = createRoot(document.body.appendChild(document.createElement("div")));
});
afterEach(() => {
  setHideAmounts(false);
  vi.useRealTimers();
  act(() => root.unmount());
  document.body.innerHTML = "";
});

const flush = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
const menuItem = async (name: string) => {
  await act(async () => document.querySelector<HTMLElement>('button[aria-label="More"]')?.click());
  return [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
    (el) => el.textContent === name,
  );
};

const clickAsk = () =>
  act(async () =>
    [...document.querySelectorAll("button")].find((b) => b.textContent === "Ask agent")?.click(),
  );

const press = (key: string, target: Element = document.body, init: KeyboardEventInit = {}) =>
  act(() => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...init }));
  });

async function open(onNavigate = vi.fn()) {
  get.mockImplementation(async ({ messageId }) => message(messageId));
  act(() =>
    root.render(
      <InboxMessageDialog
        messageId="m2"
        previousId="m1"
        nextId="m3"
        onNavigate={onNavigate}
        onClose={() => {}}
      />,
    ),
  );
  await flush();
  return onNavigate;
}

it("j and k navigate to next and previous", async () => {
  const onNavigate = await open();
  await press("j");
  expect(onNavigate).toHaveBeenLastCalledWith("m3");
  vi.setSystemTime(Date.now() + 200);
  await press("k");
  expect(onNavigate).toHaveBeenLastCalledWith("m1");
});

it("takes one step from a burst of j presses, and another after 150ms", async () => {
  const onNavigate = await open();
  act(() => {
    for (let i = 0; i < 20; i++)
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "j", bubbles: true }));
  });
  expect(onNavigate).toHaveBeenCalledTimes(1);
  vi.setSystemTime(Date.now() + 200);
  await press("j");
  expect(onNavigate).toHaveBeenCalledTimes(2);
});

it("ignores auto-repeated j", async () => {
  const onNavigate = await open();
  await press("j", document.body, { repeat: true });
  expect(onNavigate).not.toHaveBeenCalled();
});

it("ignores keys typed in inputs", async () => {
  const onNavigate = await open();
  const input = document.createElement("input");
  document.body.appendChild(input);
  await press("j", input);
  expect(onNavigate).not.toHaveBeenCalled();
});

it("u marks the message unread and closes it", async () => {
  get.mockImplementation(async ({ messageId }) => message(messageId));
  const onRead = vi.fn();
  const onClose = vi.fn();
  act(() =>
    root.render(
      <InboxMessageDialog
        messageId="m2"
        unread={false}
        onRead={onRead}
        onNavigate={vi.fn()}
        onClose={onClose}
      />,
    ),
  );
  await flush();
  await press("u");
  expect(onRead).toHaveBeenCalledWith(false);
  expect(onClose).toHaveBeenCalledTimes(1);
  // A held key must not close again, which would step back through the history.
  await press("u", document.body, { repeat: true });
  expect(onClose).toHaveBeenCalledTimes(1);
});

it("is wide on large screens", async () => {
  await open();
  const popup = document.querySelector('[data-slot="dialog-content"]')?.className ?? "";
  expect(popup).toContain("md:w-[min(1200px,94vw)]");
});

it("r opens a reply", async () => {
  await open();
  await press("r");
  expect(document.querySelector('[data-testid="compose"]')?.textContent).toBe("reply");
});

it("Try again refetches after a failure", async () => {
  get.mockRejectedValueOnce(new Error("offline"));
  act(() => root.render(<InboxMessageDialog messageId="m9" onClose={() => {}} />));
  await flush();
  get.mockResolvedValueOnce(message("m9"));
  const retry = [...document.querySelectorAll("button")].find((b) => b.textContent === "Try again");
  expect(retry).toBeDefined();
  await act(async () => retry?.click());
  await flush();
  expect(document.body.textContent).toContain("Subject m9");
});

it("opens with focus on the dialog, not on the previous-message button", async () => {
  await open();
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  const popup = document.querySelector('[data-slot="dialog-content"]');
  expect(document.activeElement).toBe(popup);
  expect(document.activeElement?.getAttribute("aria-label")).not.toBe("Previous message");
});

async function show(id: string, extra: Record<string, unknown>) {
  get.mockImplementation(async () => ({ ...message(id), ...extra }));
  act(() => root.render(<InboxMessageDialog messageId={id} onClose={() => {}} />));
  await flush();
}

it("shows the Cc line with the full list as its title, and none without a Cc", async () => {
  await show("cc1", { cc: "Team <team@example.com>, Dev" });
  const cc = document.querySelector('[title="Team <team@example.com>, Dev"]');
  expect(cc?.textContent).toBe("cc Team <team@example.com>, Dev");
  expect(document.querySelector('[title="b@example.com"]')?.textContent).toBe("to b@example.com");
  await show("cc2", {});
  expect(document.body.textContent).not.toContain("cc ");
});

it("breaks a long unbroken URL in a plain-text body", async () => {
  await show("long1", { text: `see https://example.com/${"a".repeat(300)}` });
  expect(document.querySelector("p.wrap-anywhere")?.textContent).toContain("aaaa");
});

it("shows the text, not a blank frame, when the HTML has nothing visible", async () => {
  await show("empty1", {
    html: "<html><head><style>p{}</style></head><body><div> </div></body></html>",
    text: "Plain copy",
  });
  expect(document.body.textContent).toContain("Plain copy");
});

it("shows a plainly written HTML message as text in the app's style, and a designed one in its frame", async () => {
  await show("plain1", {
    html: '<div dir="ltr"><p>Hi Morgan, <b>Section 9</b> works.</p><blockquote style="margin:0">Earlier</blockquote></div>',
    text: "Hi Morgan, Section 9 works.",
  });
  expect(document.querySelector('[data-testid="html-frame"]')).toBeNull();
  expect(document.querySelector("p.whitespace-pre-wrap")?.textContent).toBe(
    "Hi Morgan, Section 9 works.",
  );
  await show("designed1", {
    html: "<table><tr><td><img src='https://example.com/logo.png'> Sale</td></tr></table>",
    text: "Sale",
  });
  expect(document.querySelector('[data-testid="html-frame"]')).not.toBeNull();
});

it("names the sender You on the user's own message", async () => {
  await show("self1", { from: "me@example.com", fromSelf: true });
  expect(document.querySelector(".font-semibold.text-foreground")?.textContent).toBe("You");
  expect(document.body.textContent).toContain("<me@example.com>");
});

it("archives with the button or e, and marks read or unread, when the page allows it", async () => {
  get.mockImplementation(async ({ messageId }) => message(messageId));
  const onArchive = vi.fn();
  const onRead = vi.fn();
  const render = (unread: boolean) =>
    act(() =>
      root.render(
        <InboxMessageDialog
          messageId="m2"
          nextId="m3"
          onNavigate={() => {}}
          unread={unread}
          onArchive={onArchive}
          onRead={onRead}
          onClose={() => {}}
        />,
      ),
    );
  const button = (name: string) =>
    [...document.querySelectorAll("button")].find((b) => b.textContent === name);
  await render(true);
  await flush();
  await act(async () => button("Archive")?.click());
  await press("e");
  expect(onArchive).toHaveBeenCalledTimes(2);
  await act(async () => (await menuItem("Mark read"))?.click());
  expect(onRead).toHaveBeenLastCalledWith(true);
  await render(false);
  await act(async () => (await menuItem("Mark unread"))?.click());
  expect(onRead).toHaveBeenLastCalledWith(false);
});

it("offers Mark reply done only when the page passes it", async () => {
  get.mockImplementation(async ({ messageId }) => message(messageId));
  const onReplyDone = vi.fn();
  act(() =>
    root.render(
      <InboxMessageDialog
        messageId="m2"
        unread={false}
        onRead={() => {}}
        onReplyDone={onReplyDone}
        replyDoneText="Reply to Morgan"
        onClose={() => {}}
      />,
    ),
  );
  await flush();
  const item = await menuItem("Mark done: Reply to Morgan");
  expect(item).toBeDefined();
  await act(async () => item?.click());
  expect(onReplyDone).toHaveBeenCalledTimes(1);
});

it("Ask agent runs the page's action, and shows why it failed", async () => {
  get.mockImplementation(async ({ messageId }) => message(messageId));
  const onAskAgent = vi.fn().mockResolvedValue(undefined);
  act(() =>
    root.render(<InboxMessageDialog messageId="m2" onAskAgent={onAskAgent} onClose={() => {}} />),
  );
  await flush();
  await clickAsk();
  expect(onAskAgent).toHaveBeenCalledTimes(1);
  expect(document.querySelector('[role="alert"]')).toBeNull();
  onAskAgent.mockRejectedValueOnce(new Error("Mail is unavailable"));
  await clickAsk();
  expect(document.querySelector('[role="alert"]')?.textContent).toContain("Mail is unavailable");
});

it("Ask agent opens the email's agent in a panel, which closes again and can start a reply", async () => {
  get.mockImplementation(async ({ messageId }) => message(messageId));
  const onAskAgentPanel = vi.fn().mockResolvedValue({ id: "bot-1", name: "Thread agent" });
  act(() =>
    root.render(
      <InboxMessageDialog messageId="m3" onAskAgentPanel={onAskAgentPanel} onClose={() => {}} />,
    ),
  );
  await flush();
  const click = (name: string) =>
    act(async () =>
      [...document.querySelectorAll("button")].find((b) => b.textContent === name)?.click(),
    );
  expect(document.querySelector('[data-testid="agent-panel"]')).toBeNull();
  // Beside Reply in the toolbar; behind More only on a phone, where the toolbar has no room.
  expect((await menuItem("Ask agent"))?.className).toContain("md:hidden");
  await clickAsk();
  expect(onAskAgentPanel).toHaveBeenCalledTimes(1);
  expect(document.querySelector('[data-testid="agent-panel"]')?.textContent).toContain(
    "Thread agent",
  );
  // From 1280px the dialog grows right (left edge fixed) and the panel sits beside the email; below
  // that the panel overlays and the email column reserves its width.
  const popup = document.querySelector('[data-slot="dialog-content"]')?.className ?? "";
  expect(popup).toContain("min-[1280px]:w-[min(1440px,calc(50vw+376px))]!");
  // Stays centred (equal side gutters): no left override.
  expect(popup).not.toContain("min-[1280px]:left-");
  expect(document.querySelector("[data-slot=dialog-content] > div")?.className).toContain(
    "md:pe-96",
  );
  expect(
    document.querySelector('[data-testid="email-side-panel"]')?.parentElement?.className,
  ).toContain("absolute");
  await click("panel draft");
  expect(document.querySelector('[data-testid="compose"]')?.textContent).toBe("reply:Hi Sam");
  await click("panel close");
  expect(document.querySelector('[data-testid="agent-panel"]')).toBeNull();
});

const tab = (name: string) =>
  [...document.querySelectorAll<HTMLElement>('[role="tab"]')].find((el) =>
    el.textContent?.includes(name),
  );

it("opens on Context with the sender, and the Context button hides and shows the panel", async () => {
  get.mockImplementation(async ({ messageId }) => ({
    ...message(messageId),
    from: "Ann Lee <ann@example.com>",
  }));
  act(() => root.render(<InboxMessageDialog messageId="m4" onClose={() => {}} />));
  await flush();
  const people = () => document.querySelector('[data-testid="context-people"]')?.textContent;
  expect(people()).toBe("ann@example.com");
  // Without an agent to switch to, there are no tabs.
  expect(tab("Agent")).toBeUndefined();
  const toggle = () =>
    document.querySelector<HTMLElement>('button[aria-label="Context"][aria-pressed]');
  await act(async () => toggle()?.click());
  expect(people()).toBeUndefined();
  await act(async () => toggle()?.click());
  expect(people()).toBe("ann@example.com");
});

it("names the recipients of a message the user wrote", async () => {
  get.mockImplementation(async ({ messageId }) => ({
    ...message(messageId),
    fromSelf: true,
    to: "Kevin Zhao <kevin@acme.example.test>, kevin@acme.example.test",
    cc: "kim@example.com",
  }));
  act(() => root.render(<InboxMessageDialog messageId="m5" onClose={() => {}} />));
  await flush();
  expect(document.querySelector('[data-testid="context-people"]')?.textContent).toBe(
    "kevin@acme.example.test,kim@example.com",
  );
});

it("creates the email's agent when its tab is first opened, and keeps its chat between tabs", async () => {
  get.mockImplementation(async ({ messageId }) => message(messageId));
  const onAskAgentPanel = vi.fn().mockResolvedValue({ id: "bot-1", name: "Thread agent" });
  act(() =>
    root.render(
      <InboxMessageDialog messageId="m6" onAskAgentPanel={onAskAgentPanel} onClose={() => {}} />,
    ),
  );
  await flush();
  expect(document.querySelector('[data-testid="agent-panel"]')).toBeNull();
  await act(async () => tab("Agent")?.click());
  await flush();
  expect(onAskAgentPanel).toHaveBeenCalledTimes(1);
  expect(tab("Agent")?.getAttribute("aria-selected")).toBe("true");
  const agent = document.querySelector('[data-testid="agent-panel"]');
  expect(agent?.textContent).toContain("Thread agent");
  await act(async () => tab("Context")?.click());
  expect(tab("Context")?.getAttribute("aria-selected")).toBe("true");
  // Still mounted, only hidden.
  expect(document.querySelector('[data-testid="agent-panel"]')).toBe(agent);
  expect(agent?.parentElement?.className).toContain("hidden");
  await act(async () => tab("Agent")?.click());
  expect(onAskAgentPanel).toHaveBeenCalledTimes(1);
});

it("reopens a failed send with its own recipients and subject", async () => {
  get.mockImplementation(async ({ messageId }) => message(messageId));
  const onAskAgentPanel = vi.fn().mockResolvedValue({ id: "bot-1", name: "Thread agent" });
  act(() =>
    root.render(
      <InboxMessageDialog messageId="m3" onAskAgentPanel={onAskAgentPanel} onClose={() => {}} />,
    ),
  );
  await flush();
  await clickAsk();
  await act(async () =>
    [...document.querySelectorAll("button")].find((b) => b.textContent === "panel failed")?.click(),
  );
  const text = document.querySelector('[data-testid="compose"]')?.textContent ?? "";
  expect(text).toContain('"to":["x@example.com"]');
  expect(text).toContain('"cc":["cc@example.com"]');
  expect(text).toContain('"bcc":["bcc@example.com"]');
  expect(text).toContain('"subject":"Edited subject"');
  expect(text).toContain('"connectionId":"c9"');
  expect(text).toContain("reply-to:m3");
});

it("drops a late Ask agent answer when the user has moved to another email", async () => {
  get.mockImplementation(async ({ messageId }) => message(messageId));
  let resolve: (bot: { id: string; name: string }) => void = () => {};
  const onAskAgentPanel = vi.fn(
    () => new Promise<{ id: string; name: string }>((r) => (resolve = r)),
  );
  const render = (messageId: string) =>
    act(() =>
      root.render(
        <InboxMessageDialog
          messageId={messageId}
          onAskAgentPanel={onAskAgentPanel as never}
          onClose={() => {}}
        />,
      ),
    );
  render("early");
  await flush();
  await clickAsk();
  render("later");
  await flush();
  await act(async () => resolve({ id: "bot-a", name: "Agent for early" }));
  expect(document.querySelector('[data-testid="agent-panel"]')).toBeNull();
});

it("shows no Ask agent button when the page gives no action", async () => {
  await open();
  expect([...document.querySelectorAll("button")].some((b) => b.textContent === "Ask agent")).toBe(
    false,
  );
});

it("keeps Reply as the one filled button, with Reply all and Forward in More", async () => {
  get.mockImplementation(async ({ messageId }) => ({
    ...message(messageId),
    cc: "c@example.com",
  }));
  act(() =>
    root.render(<InboxMessageDialog messageId="m2" onArchive={() => {}} onClose={() => {}} />),
  );
  await flush();
  const visible = [...document.querySelectorAll("button")]
    .map((b) => b.textContent || b.getAttribute("aria-label"))
    .filter((name) => ["Reply", "Reply all", "Forward", "Archive", "More"].includes(name ?? ""));
  expect(visible).toEqual(["Reply", "Archive", "More"]);
  expect(await menuItem("Reply all")).toBeDefined();
  expect(document.querySelector('[role="menuitem"]:nth-child(2)')?.textContent).toBe("Forward");
});

it("offers no Reply all when the server says it would address the same people", async () => {
  get.mockImplementation(async ({ messageId }) => ({
    ...message(messageId),
    replyAllDiffers: false,
  }));
  act(() =>
    root.render(<InboxMessageDialog messageId="m2" onArchive={() => {}} onClose={() => {}} />),
  );
  await flush();
  const more = document.querySelector<HTMLElement>('button[aria-label="More"]');
  await act(async () => more?.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true })));
  await act(async () => more?.click());
  const items = [...document.querySelectorAll('[role="menuitem"]')].map((i) => i.textContent);
  expect(items).toContain("Forward");
  expect(items).not.toContain("Reply all");
});

it("shows no archive or read buttons and ignores e without them", async () => {
  await open();
  await press("e");
  const names = [...document.querySelectorAll("button")].map((b) => b.textContent);
  expect(names).not.toContain("Archive");
  expect(names).not.toContain("Mark read");
});

it("lists the conversation's earlier messages and shows one's text when clicked", async () => {
  get.mockImplementation(async ({ messageId }) =>
    messageId === "first"
      ? { ...message("first"), text: "Our counsel returned redlines on sections 4 and 9." }
      : {
          ...message(messageId),
          thread: [
            {
              id: "first",
              from: "Morgan",
              receivedAt: "2026-10-09T09:00:00.000Z",
              snippet: "Our counsel returned",
            },
          ],
        },
  );
  act(() => root.render(<InboxMessageDialog messageId="latest" onClose={() => {}} />));
  await flush();
  expect(document.body.textContent).toContain("1 earlier message");
  const row = [...document.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("Morgan"),
  );
  expect(row?.getAttribute("aria-expanded")).toBe("false");
  await act(async () => row?.click());
  await flush();
  expect(get).toHaveBeenCalledWith({ messageId: "first" });
  expect(row?.getAttribute("aria-expanded")).toBe("true");
  expect(document.body.textContent).toContain("Our counsel returned redlines on sections 4 and 9.");
});

it("lists the user's later reply after the open message, as You", async () => {
  get.mockImplementation(async () => ({
    ...message("open"),
    text: "The open message.",
    later: [
      {
        id: "mine",
        from: "me@example.test",
        receivedAt: "2026-10-10T10:27:00.000Z",
        snippet: "Thanks, signed.",
        fromSelf: true,
      },
    ],
  }));
  act(() => root.render(<InboxMessageDialog messageId="open" onClose={() => {}} />));
  await flush();
  const text = document.body.textContent ?? "";
  expect(text).not.toContain("earlier message");
  expect(text.indexOf("The open message.")).toBeLessThan(
    text.indexOf("Later in this conversation"),
  );
  const row = [...document.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("Thanks, signed."),
  );
  expect(row?.textContent).toContain("You");
  expect(row?.textContent).not.toContain("me@example.test");
});

it("says the email has an unsent reply and continues it in the mode it was written in", async () => {
  get.mockImplementation(async () => message("drafted"));
  const seed = { kind: "replyAll", messageId: "drafted" } as const;
  rememberClosed(seed, { seed } as ComposeRestore);
  try {
    act(() => root.render(<InboxMessageDialog messageId="drafted" onClose={() => {}} />));
    await flush();
    expect(document.body.textContent).toContain("You have an unsent reply to this email.");
    const button = [...document.querySelectorAll("button")].find(
      (b) => b.textContent === "Continue draft",
    );
    await act(async () => button?.click());
    expect(document.querySelector("[data-testid=compose]")?.textContent).toBe("replyAll");
  } finally {
    forgetClosed(seed);
  }
});

it("closes the preview when the reply composer sends, leaving Undo to the outbox", async () => {
  get.mockImplementation(async () => message("m1"));
  const onClose = vi.fn();
  act(() => root.render(<InboxMessageDialog messageId="m1" onClose={onClose} />));
  await flush();
  const reply = [...document.querySelectorAll("button")].find((b) => b.textContent === "Reply");
  await act(async () => reply?.click());
  expect(onClose).not.toHaveBeenCalled();
  await act(async () =>
    (document.querySelector('[aria-label="mock send"]') as HTMLElement).click(),
  );
  expect(onClose).toHaveBeenCalledTimes(1);
});

it("takes the read state from the message and hides Archive once it left the Inbox", async () => {
  const onRead = vi.fn();
  get.mockImplementation(async () => ({ ...message("card"), unread: true, inInbox: false }));
  act(() =>
    root.render(
      <InboxMessageDialog
        messageId="card"
        onArchive={() => {}}
        onRead={onRead}
        onClose={() => {}}
      />,
    ),
  );
  await flush();
  const names = [...document.querySelectorAll("button")].map((b) => b.textContent);
  expect(names).not.toContain("Archive");
  await act(async () => (await menuItem("Mark read"))?.click());
  expect(onRead).toHaveBeenCalledWith(true);
});

it("masks amounts in the body and thread while Hide amounts is on", async () => {
  setHideAmounts(true);
  get.mockImplementation(async ({ messageId }) =>
    messageId === "t1"
      ? { ...message("t1"), text: "Paid $1,234.56 total" }
      : {
          ...message(messageId),
          text: "Invoice due: $9,876.54",
          thread: [
            {
              id: "t1",
              from: "x@example.com",
              fromSelf: false,
              receivedAt: "2026-10-09T09:00:00.000Z",
              snippet: "Paid $1,234.56 total",
            },
          ],
        },
  );
  act(() => root.render(<InboxMessageDialog messageId="m1" onClose={() => {}} />));
  await flush();
  const text = () => document.body.textContent ?? "";
  expect(text()).not.toContain("9,876.54");
  expect(text()).not.toContain("1,234.56");
  const row = [...document.querySelectorAll("button[aria-expanded]")][0] as HTMLElement;
  await act(async () => row.click());
  await flush();
  expect(text()).not.toContain("1,234.56");
  setHideAmounts(false);
  await flush();
  expect(text()).toContain("9,876.54");
});

it("keeps link destinations by showing HTML with links in the sandboxed viewer", async () => {
  get.mockResolvedValue({
    ...message("m1"),
    text: "Pay here",
    html: '<p><a href="https://pay.example.com/x">Pay here</a></p>',
  });
  act(() => root.render(<InboxMessageDialog messageId="m1" onClose={() => {}} />));
  await flush();
  expect(document.querySelector('[data-testid="html-frame"]')).not.toBeNull();
});

it("shows a reply sent from the dialog without reopening it", async () => {
  const thread = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `r${i}`,
      from: "x@example.com",
      fromSelf: false,
      receivedAt: "2026-10-09T09:00:00.000Z",
      snippet: `Earlier ${i}`,
    }));
  get.mockResolvedValueOnce({ ...message("m1"), thread: thread(1) });
  act(() => root.render(<InboxMessageDialog messageId="m1" onClose={() => {}} />));
  await flush();
  expect(document.body.textContent).toContain("1 earlier message");
  get.mockResolvedValue({ ...message("m1"), thread: thread(2) });
  await act(async () => {
    window.dispatchEvent(new Event(MAIL_SENT_EVENT));
  });
  await flush();
  expect(document.body.textContent).toContain("2 earlier messages");
});

it("removes message actions when a refresh finds that the message was deleted", async () => {
  get.mockResolvedValueOnce(message("m1"));
  act(() =>
    root.render(<InboxMessageDialog messageId="m1" onArchive={() => {}} onClose={() => {}} />),
  );
  await flush();
  get.mockRejectedValueOnce(new ORPCError("NOT_FOUND", { message: "Message not found" }));
  await act(async () => window.dispatchEvent(new Event(MAIL_SENT_EVENT)));
  await flush();
  expect(document.body.textContent).toContain("Email not found");
  expect([...document.querySelectorAll("button")].map((entry) => entry.textContent)).not.toContain(
    "Reply",
  );
  expect([...document.querySelectorAll("button")].map((entry) => entry.textContent)).not.toContain(
    "Archive",
  );
});

it("keeps message actions after a transient refresh failure", async () => {
  get.mockResolvedValueOnce(message("m1"));
  act(() =>
    root.render(<InboxMessageDialog messageId="m1" onArchive={() => {}} onClose={() => {}} />),
  );
  await flush();
  get.mockRejectedValueOnce(new Error("offline"));
  await act(async () => window.dispatchEvent(new Event(MAIL_SENT_EVENT)));
  await flush();
  expect(document.body.textContent).toContain("Subject m1");
  expect([...document.querySelectorAll("button")].map((entry) => entry.textContent)).toContain(
    "Reply",
  );
  expect([...document.querySelectorAll("button")].map((entry) => entry.textContent)).toContain(
    "Archive",
  );
});

it("explains a stale link and offers a way back instead of Try again", async () => {
  get.mockRejectedValue(Object.assign(new Error("Not found"), { code: "NOT_FOUND" }));
  act(() =>
    root.render(
      <InboxMessageDialog messageId="gone" nextId="m3" onNavigate={vi.fn()} onClose={() => {}} />,
    ),
  );
  await flush();
  expect(document.body.textContent).toContain("Email not found");
  expect(document.body.textContent).toContain("This email isn't in your mail any more.");
  expect(document.body.textContent).toContain("Back to Inbox");
  expect(document.body.textContent).not.toContain("Try again");
  expect(document.querySelector('[aria-label="Next message"]')).toBeNull();
});

it("drops the quoted 'On … wrote:' header from a reply's preview", async () => {
  const { withoutQuoteHeader } = await import("./InboxMessageDialog");
  expect(
    withoutQuoteHeader("Thanks, signed. On Sat, Oct 17, 2026 at 3:10 PM Morgan wrote: > Alex"),
  ).toBe("Thanks, signed.");
  expect(withoutQuoteHeader("Plain note")).toBe("Plain note");
  // A snippet cut inside the header has no "wrote:".
  expect(
    withoutQuoteHeader(
      "Hi Morgan, Thursday works. Maya On Tue, Oct 20, 2026, 7:49 PM, Morgan Prete…",
    ),
  ).toBe("Hi Morgan, Thursday works. Maya");
});

it("follows the caller's archived state over an older loaded copy", async () => {
  // Loaded before it was archived in this session, so the copy still says Inbox.
  get.mockResolvedValue({ ...message("m1"), inInbox: true });
  const onMoveToInbox = vi.fn();
  const show = (inInbox: boolean) =>
    root.render(
      <InboxMessageDialog
        messageId="m1"
        inInbox={inInbox}
        onArchive={vi.fn()}
        onMoveToInbox={onMoveToInbox}
        onClose={() => {}}
      />,
    );
  act(() => show(false));
  await flush();
  const labels = () => [...document.querySelectorAll("button")].map((b) => b.textContent);
  expect(labels()).not.toContain("Archive");
  const move = [...document.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("Move to Inbox"),
  );
  await act(async () => move?.click());
  expect(onMoveToInbox).toHaveBeenCalledTimes(1);
  act(() => show(true));
  expect(labels()).toContain("Archive");
  expect(labels()).not.toContain("Move to Inbox");
});

const sentMarks = () =>
  [...document.querySelectorAll("span")].filter((e) => e.textContent === "Sent");

it("marks the opened message and thread rows the user sent with a green Sent flag", async () => {
  get.mockImplementation(async () => ({
    ...message("open"),
    from: "me@example.test",
    fromSelf: true,
    thread: [
      {
        id: "mine",
        from: "me@example.test",
        receivedAt: "2026-10-09T09:00:00.000Z",
        snippet: "Mine",
        fromSelf: true,
      },
      { id: "theirs", from: "Morgan", receivedAt: "2026-10-09T10:00:00.000Z", snippet: "Theirs" },
    ],
  }));
  act(() => root.render(<InboxMessageDialog messageId="open" onClose={() => {}} />));
  await flush();
  expect(sentMarks()).toHaveLength(2);
  for (const mark of sentMarks()) {
    expect(mark.className).toContain("text-muted-foreground");
    expect(mark.className).not.toContain("text-success");
    expect(mark.querySelector("svg")?.getAttribute("class")).toContain("text-success");
  }
  const rows = [...document.querySelectorAll("ol > li")];
  expect(rows[0]?.className).toContain("border-s-success");
  expect(rows[1]?.className).not.toContain("success");
  expect(rows[1]?.textContent).not.toContain("Sent");
});

it("does not mark a message someone else sent", async () => {
  get.mockImplementation(async () => message("plain"));
  act(() => root.render(<InboxMessageDialog messageId="plain" onClose={() => {}} />));
  await flush();
  expect(sentMarks()).toHaveLength(0);
});

const preview = {
  from: "Sample Sender <sender@example.test>",
  receivedAt: "2026-10-10T09:00:00.000Z",
  snippet: "Invented preview line",
};

it("shows the row's subject and preview with a body skeleton while loading, then the content", async () => {
  let resolve: (value: ReturnType<typeof message>) => void = () => {};
  get.mockReturnValueOnce(new Promise((r) => (resolve = r)));
  act(() =>
    root.render(
      <InboxMessageDialog
        messageId="l1"
        subject="Row subject"
        preview={preview}
        onClose={() => {}}
      />,
    ),
  );
  await flush();
  expect(document.body.textContent).toContain("Row subject");
  expect(document.body.textContent).toContain("Sample Sender");
  expect(document.body.textContent).toContain("Invented preview line");
  expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
  await act(async () => resolve(message("l1")));
  await flush();
  expect(document.querySelector('[aria-busy="true"]')).toBeNull();
  expect(document.body.textContent).toContain("body");
});

it("shows Try again, Reply and Archive, not the skeleton, after a failed load", async () => {
  get.mockRejectedValueOnce(new Error("offline"));
  act(() =>
    root.render(<InboxMessageDialog messageId="l2" onArchive={() => {}} onClose={() => {}} />),
  );
  await flush();
  expect(document.querySelector('[aria-busy="true"]')).toBeNull();
  const labels = [...document.querySelectorAll("button")].map((b) => b.textContent);
  expect(labels).toEqual(expect.arrayContaining(["Try again", "Reply", "Archive"]));
});

it("shows the loading state, not the previous message, after switching", async () => {
  get.mockResolvedValueOnce(message("s1"));
  get.mockReturnValueOnce(new Promise(() => {}));
  act(() => root.render(<InboxMessageDialog messageId="s1" onClose={() => {}} />));
  await flush();
  expect(document.body.textContent).toContain("Subject s1");
  act(() =>
    root.render(<InboxMessageDialog messageId="s2" subject="Next row" onClose={() => {}} />),
  );
  await flush();
  expect(document.body.textContent).not.toContain("Subject s1");
  expect(document.body.textContent).toContain("Next row");
  expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
});

it("shows Reply and Archive while the body loads, and a retry line after 5 seconds", async () => {
  vi.useFakeTimers();
  get.mockReturnValue(new Promise(() => {}));
  act(() =>
    root.render(
      <InboxMessageDialog messageId="slow" subject="Hi" onArchive={() => {}} onClose={() => {}} />,
    ),
  );
  const labels = () => [...document.querySelectorAll("button")].map((b) => b.textContent);
  expect(labels()).toEqual(expect.arrayContaining(["Reply", "Archive"]));
  expect(document.body.textContent).not.toContain("Still loading");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  expect(document.body.textContent).toContain("Still loading…");
  expect(labels()).toContain("Try again");
  await act(async () => {
    [...document.querySelectorAll("button")].find((b) => b.textContent === "Try again")?.click();
  });
  expect(get).toHaveBeenCalledTimes(2);
});

it("offers Track in More and shows a Tracked mark while it is on", async () => {
  get.mockImplementation(async ({ messageId }) => message(messageId));
  const onTrack = vi.fn();
  const render = (tracked: boolean) =>
    act(() =>
      root.render(
        <InboxMessageDialog
          messageId="m2"
          tracked={tracked}
          onTrack={onTrack}
          onClose={() => {}}
        />,
      ),
    );
  await render(false);
  await flush();
  expect(document.body.textContent).not.toContain("Tracked");
  await act(async () => (await menuItem("Track"))?.click());
  expect(onTrack).toHaveBeenLastCalledWith(true);
  await render(true);
  expect(document.body.textContent).toContain("Tracked");
  await act(async () => (await menuItem("Stop tracking"))?.click());
  expect(onTrack).toHaveBeenLastCalledWith(false);
});

it("keeps the notice in a live region that is already there, so a screen reader announces it", async () => {
  get.mockImplementation(async ({ messageId }) => message(messageId));
  const props = { messageId: "m2", onClose: () => {} };
  act(() => root.render(<InboxMessageDialog {...props} />));
  await flush();
  const region = document.querySelector('[role="status"]');
  expect(region).not.toBeNull();
  expect(region?.textContent).toBe("");
  act(() =>
    root.render(
      <InboxMessageDialog {...props} notice={<span>Stopped Needs reply for Sam</span>} />,
    ),
  );
  await flush();
  expect(document.querySelector('[role="status"]')).toBe(region);
  expect(region?.textContent).toBe("Stopped Needs reply for Sam");
});

const ada = { from: "Ada <ada@lists.example.test>" };
const alertContent = () => document.querySelector('[data-slot="alert-dialog-content"]');
const alertButton = (name: string) =>
  [...document.querySelectorAll<HTMLElement>('[data-slot="alert-dialog-content"] button')].find(
    (b) => b.textContent === name,
  );
const menuItems = () =>
  [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].map((el) => el.textContent);

it("lists the page's moves in More and calls onMove, but only when the page passes them", async () => {
  get.mockImplementation(async ({ messageId }) => ({ ...message(messageId), ...ada }));
  const onMove = vi.fn();
  const render = (props: Record<string, unknown>) =>
    act(() => root.render(<InboxMessageDialog messageId="mv1" onClose={() => {}} {...props} />));
  await render({ moves: ["spam", "trash"], onMove });
  await flush();
  const trash = await menuItem("Trash");
  expect(trash).toBeDefined();
  expect(menuItems()).toContain("Spam");
  await act(async () => trash?.click());
  expect(onMove).toHaveBeenCalledTimes(1);
  expect(onMove).toHaveBeenLastCalledWith("trash");
  // A chat card passes neither: the items stay out of More.
  await render({});
  await flush();
  await act(async () => document.querySelector<HTMLElement>('button[aria-label="More"]')?.click());
  expect(menuItems()).not.toContain("Spam");
  expect(menuItems()).not.toContain("Trash");
});

it("asks before unsubscribing, sends on Unsubscribe and hides the item", async () => {
  get.mockImplementation(async ({ messageId }) => ({ ...message(messageId), ...ada }));
  const onUnsubscribe = vi.fn().mockResolvedValue({ status: "done", method: "one_click" });
  act(() =>
    root.render(
      <InboxMessageDialog messageId="u1" onUnsubscribe={onUnsubscribe} onClose={() => {}} />,
    ),
  );
  await flush();
  await act(async () => (await menuItem("Unsubscribe"))?.click());
  expect(alertContent()?.textContent).toContain("Unsubscribe from Ada?");
  expect(alertContent()?.textContent).toContain("This can't be undone.");
  await act(async () => alertButton("Cancel")?.click());
  expect(onUnsubscribe).not.toHaveBeenCalled();
  expect(alertContent()).toBeNull();
  await act(async () => (await menuItem("Unsubscribe"))?.click());
  await act(async () => alertButton("Unsubscribe")?.click());
  await flush();
  expect(onUnsubscribe).toHaveBeenCalledTimes(1);
  expect(onUnsubscribe).toHaveBeenLastCalledWith(false);
  expect(alertContent()).toBeNull();
  expect(document.body.textContent).toContain("Unsubscribed from Ada");
  expect(await menuItem("Unsubscribe")).toBeUndefined();
});

it("asks again before sending an unsubscribe email, and sends on Send", async () => {
  get.mockImplementation(async ({ messageId }) => ({ ...message(messageId), ...ada }));
  const onUnsubscribe = vi
    .fn()
    .mockResolvedValueOnce({
      status: "needs_confirmation",
      method: "mailto",
      mailTo: "unsub@lists.example.test",
    })
    .mockResolvedValueOnce({ status: "sent", method: "mailto" });
  act(() =>
    root.render(
      <InboxMessageDialog messageId="u2" onUnsubscribe={onUnsubscribe} onClose={() => {}} />,
    ),
  );
  await flush();
  await act(async () => (await menuItem("Unsubscribe"))?.click());
  await act(async () => alertButton("Unsubscribe")?.click());
  await flush();
  expect(alertContent()?.textContent).toContain(
    "Send an unsubscribe email to unsub@lists.example.test?",
  );
  await act(async () => alertButton("Send")?.click());
  await flush();
  expect(onUnsubscribe).toHaveBeenCalledTimes(2);
  expect(onUnsubscribe).toHaveBeenLastCalledWith(true);
});

it("turns the action into an Open link anchor when the answer is a link", async () => {
  get.mockImplementation(async ({ messageId }) => ({ ...message(messageId), ...ada }));
  const onUnsubscribe = vi.fn().mockResolvedValue({
    status: "opened",
    method: "link",
    openUrl: "https://lists.example.test/leave",
  });
  act(() =>
    root.render(
      <InboxMessageDialog messageId="u3" onUnsubscribe={onUnsubscribe} onClose={() => {}} />,
    ),
  );
  await flush();
  await act(async () => (await menuItem("Unsubscribe"))?.click());
  await act(async () => alertButton("Unsubscribe")?.click());
  await flush();
  const link = alertContent()?.querySelector("a");
  expect(link?.getAttribute("href")).toBe("https://lists.example.test/leave");
  expect(link?.getAttribute("target")).toBe("_blank");
  expect(link?.textContent).toBe("Open link");
  expect(document.body.textContent).not.toContain("Unsubscribed from");
  // The user's own click opens the tab and closes the question.
  await act(async () => (link as HTMLElement).click());
  expect(alertContent()).toBeNull();
});

it("reports a sender without an unsubscribe target, and a rejected call", async () => {
  get.mockImplementation(async ({ messageId }) => ({ ...message(messageId), ...ada }));
  const onUnsubscribe = vi
    .fn()
    .mockResolvedValueOnce({ status: "unavailable", method: null })
    .mockRejectedValueOnce(new Error("Mail is unavailable"));
  act(() =>
    root.render(
      <InboxMessageDialog messageId="u4" onUnsubscribe={onUnsubscribe} onClose={() => {}} />,
    ),
  );
  await flush();
  await act(async () => (await menuItem("Unsubscribe"))?.click());
  await act(async () => alertButton("Unsubscribe")?.click());
  await flush();
  expect(alertContent()).toBeNull();
  expect(document.querySelector('[role="alert"]')?.textContent).toContain(
    "Couldn't unsubscribe from Ada",
  );
  // The item stays so the user can try again; a rejection shows the error text.
  await act(async () => (await menuItem("Unsubscribe"))?.click());
  await act(async () => alertButton("Unsubscribe")?.click());
  await flush();
  expect(document.querySelector('[role="alert"]')?.textContent).toContain("Mail is unavailable");
});

it("ignores the message keys while the unsubscribe question is open", async () => {
  get.mockImplementation(async ({ messageId }) => ({ ...message(messageId), ...ada }));
  const onArchive = vi.fn();
  const onNavigate = vi.fn();
  act(() =>
    root.render(
      <InboxMessageDialog
        messageId="u5"
        nextId="n1"
        onNavigate={onNavigate}
        onArchive={onArchive}
        onUnsubscribe={vi.fn().mockResolvedValue({ status: "done", method: "one_click" })}
        onClose={() => {}}
      />,
    ),
  );
  await flush();
  await act(async () => (await menuItem("Unsubscribe"))?.click());
  expect(alertContent()).not.toBeNull();
  await press("e");
  await press("j");
  await press("r");
  expect(onArchive).not.toHaveBeenCalled();
  expect(onNavigate).not.toHaveBeenCalled();
  expect(document.querySelector('[data-testid="compose"]')).toBeNull();
});

it("offers no Unsubscribe on the user's own mail", async () => {
  get.mockImplementation(async ({ messageId }) => ({
    ...message(messageId),
    from: "me@example.com",
    fromSelf: true,
  }));
  act(() =>
    root.render(
      <InboxMessageDialog
        messageId="u6"
        onUnsubscribe={vi.fn().mockResolvedValue({ status: "done", method: "one_click" })}
        onClose={() => {}}
      />,
    ),
  );
  await flush();
  expect(await menuItem("Unsubscribe")).toBeUndefined();
});
