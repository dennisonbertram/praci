// @vitest-environment jsdom

import type { MailRow } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, i) => text + part + String(values[i] ?? ""), "");
  return { useLingui: () => ({ t }), Trans: ({ children }: { children: ReactNode }) => children };
});
vi.mock("../components/SandboxedHtmlViewer", () => ({ SandboxedHtmlViewer: () => null }));

import { InboxGroup, InboxRow } from "../components/inbox/InboxRow";

const mail = (extra: Partial<MailRow> = {}): MailRow => ({
  id: "m1",
  connectionId: "c1",
  threadId: "t1",
  from: "Dana Reyes",
  subject: "Offsite dates",
  snippet: "Can you do the 14th?",
  receivedAt: "2026-10-12T13:42:00.000Z",
  unread: true,
  inInbox: true,
  needsReply: null,
  priority: null,
  reason: null,
  category: null,
  feedback: null,
  ...extra,
});

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

async function render(
  row: MailRow,
  props: {
    onOpen?: () => void;
    onMark?: (id: string, mark: "important" | "noise" | null) => void;
    onArchive?: (id: string) => void;
    onRead?: (id: string, read: boolean) => void;
    selected?: boolean;
    hideAttention?: boolean;
  } = {},
) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <InboxRow
        row={row}
        onOpen={props.onOpen ?? (() => {})}
        onMark={props.onMark}
        onArchive={props.onArchive}
        onRead={props.onRead}
        selected={props.selected}
        hideAttention={props.hideAttention}
      />,
    ),
  );
  cleanups.push(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  return container;
}

const badge = (container: HTMLElement) => container.querySelector('[data-slot="badge"]');

it("shows one label naming why the row needs attention", async () => {
  const container = await render(
    mail({ needsReply: true, priority: "important", category: "reply" }),
  );
  expect(container.querySelectorAll('[data-slot="badge"]')).toHaveLength(1);
  expect(badge(container)?.textContent).toBe("Needs reply");
});

it("keeps the attention label on important mail that needs no reply", async () => {
  const container = await render(
    mail({ needsReply: false, priority: "normal", category: "action" }),
  );
  expect(badge(container)?.textContent).toBe("Action");
});

it("says why other urgent mail is urgent instead of a second 'you must act' phrase", async () => {
  expect(
    badge(await render(mail({ needsReply: false, priority: "critical", category: "billing" })))
      ?.textContent,
  ).toBe("Urgent");
  expect(
    badge(await render(mail({ needsReply: false, priority: "important", category: "personal" })))
      ?.textContent,
  ).toBe("Important");
});

it("drops the attention label once the newest message is the user's own reply", async () => {
  const container = await render(
    mail({ needsReply: false, priority: "important", category: "action", fromSelf: true }),
  );
  expect(badge(container)).toBeNull();
});

it.each([
  ["newsletter", "Newsletter"],
  ["spam", "Spam"],
  ["bulk", "Junk"],
  ["scam", "Junk"],
] as const)("labels a %s row %s", async (category, text) => {
  expect(badge(await render(mail({ category })))?.textContent).toBe(text);
});

it("shows no label on an untriaged row", async () => {
  expect(badge(await render(mail()))).toBeNull();
});

it("keeps the warning icon beside the Junk label on a scam row", async () => {
  const container = await render(mail({ category: "scam" }));
  expect(container.querySelector('[role="img"][aria-label="Suspicious"]')).not.toBeNull();
  expect(badge(container)?.textContent).toBe("Junk");
});

it("keeps the time on one line and the subject in the row", async () => {
  const container = await render(mail({ category: "newsletter" }));
  const time = container.querySelector("time");
  expect(time?.className).toContain("whitespace-nowrap");
  expect(time?.className).toContain("tabular-nums");
  expect(container.textContent).toContain("Offsite dates");
  expect(container.textContent).toContain("Can you do the 14th?");
});

it("marks unread with a dot and a semibold sender; both senders stay foreground", async () => {
  const unread = await render(mail({ unread: true }));
  const read = await render(mail({ unread: false }));
  expect(unread.querySelector("[data-unread-dot]")).not.toBeNull();
  expect(read.querySelector("[data-unread-dot]")).toBeNull();
  const sender = (c: HTMLElement) => c.querySelectorAll('span[dir="auto"]')[0]?.className ?? "";
  expect(sender(unread)).toContain("text-foreground");
  expect(sender(read)).toContain("text-foreground");
  expect(sender(unread)).toContain("font-semibold");
  expect(sender(read)).not.toContain("font-semibold");
  expect(unread.textContent).toContain("(unread)");
  expect(read.textContent).not.toContain("(unread)");
  expect(unread.querySelectorAll("img")).toHaveLength(0);
});

it("hides only the attention label when hideAttention is set", async () => {
  const attention = mail({ needsReply: true, priority: "important", category: "reply" });
  expect(badge(await render(attention, { hideAttention: true }))).toBeNull();
  expect(
    badge(await render(mail({ category: "newsletter" }), { hideAttention: true }))?.textContent,
  ).toBe("Newsletter");
});

it("keeps the date rendered when triage is on", async () => {
  const container = await render(mail(), { onMark: () => {} });
  expect(container.querySelector("time")?.textContent).not.toBe("");
});

it("marks without opening, and a second click clears the mark", async () => {
  const onOpen = vi.fn();
  const onMark = vi.fn();
  const container = await render(mail(), { onOpen, onMark });
  const star = container.querySelector<HTMLButtonElement>('button[aria-label="Mark important"]');
  expect(star?.getAttribute("aria-pressed")).toBe("false");
  await act(async () => star?.click());
  expect(onMark).toHaveBeenCalledWith("m1", "important");
  expect(onOpen).not.toHaveBeenCalled();
  const pressed = await render(mail({ feedback: "important" }), { onOpen, onMark });
  const again = pressed.querySelector<HTMLButtonElement>('button[aria-label="Mark important"]');
  expect(again?.getAttribute("aria-pressed")).toBe("true");
  await act(async () => again?.click());
  expect(onMark).toHaveBeenLastCalledWith("m1", null);
});

it("flags the selected row and exposes its id", async () => {
  const container = await render(mail(), { selected: true });
  const main = container.querySelector("button[data-row-id]");
  expect(main?.getAttribute("data-row-id")).toBe("m1");
  expect(main?.getAttribute("aria-current")).toBe("true");
  expect((await render(mail())).querySelector("button")?.hasAttribute("aria-current")).toBe(false);
});

it("joins the subject and preview with an em dash, the preview one step dimmer", async () => {
  const container = await render(mail());
  const subject = container.querySelectorAll('span[dir="auto"]')[1];
  expect(subject?.textContent).toBe("Offsite dates — Can you do the 14th?");
  expect(subject?.className).toContain("text-foreground/70");
  expect(subject?.querySelector("span")?.className).toContain("text-muted-foreground");
});

it("archives and toggles read from the row without opening it", async () => {
  const onOpen = vi.fn();
  const onArchive = vi.fn();
  const onRead = vi.fn();
  const unread = await render(mail({ unread: true }), { onOpen, onArchive, onRead });
  const click = (c: HTMLElement, label: string) =>
    act(async () => c.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)?.click());
  await click(unread, "Archive");
  expect(onArchive).toHaveBeenCalledWith("m1");
  await click(unread, "Mark read");
  expect(onRead).toHaveBeenLastCalledWith("m1", true);
  const read = await render(mail({ unread: false }), { onOpen, onArchive, onRead });
  await click(read, "Mark unread");
  expect(onRead).toHaveBeenLastCalledWith("m1", false);
  expect(onOpen).not.toHaveBeenCalled();
});

it("shows no row actions when the page offers none", async () => {
  const container = await render(mail());
  expect(container.querySelector('button[aria-label="Archive"]')).toBeNull();
});

it("shows the summary after the subject, with no tooltip, also on a Needs reply row", async () => {
  const reason = "Asks for dates by Friday";
  const there = await render(mail({ reason }), { hideAttention: true });
  expect(there.querySelector("button")?.hasAttribute("title")).toBe(false);
  expect(there.querySelector("button")?.textContent).toContain(reason);
});

it("shows the year only for mail from another year", async () => {
  const old = await render(mail({ receivedAt: "2019-03-05T12:00:00.000Z" }));
  expect(old.querySelector("time")?.textContent).toContain("2019");
  const recent = await render(mail({ receivedAt: new Date().toISOString() }));
  expect(recent.querySelector("time")?.textContent).not.toMatch(/\d{4}/);
});

it("shows the row count beside a group heading, and no heading without a title", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  cleanups.push(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  // The heading counts unread mail, as the sidebar badge does; a read row adds nothing.
  const rows = [mail({ id: "a" }), mail({ id: "b" }), mail({ id: "c", unread: false })];
  const show = (title?: string) =>
    act(async () =>
      root.render(<InboxGroup title={title} rows={rows} onOpen={() => {}} onMark={undefined} />),
    );
  await show("Earlier");
  expect(container.querySelector("h2")?.textContent).toBe("Earlier2 unread");
  await show(undefined);
  expect(container.querySelector("h2")).toBeNull();
});

it("offers Archive only for mail that is in the inbox", async () => {
  const gone = await render(mail({ inInbox: false }), { onArchive: () => {} });
  expect(gone.querySelector('[aria-label="Archive"]')).toBeNull();
  const here = await render(mail(), { onArchive: () => {} });
  expect(here.querySelector('[aria-label="Archive"]')).not.toBeNull();
});

it("marks a row whose mail has an open to-do", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  cleanups.push(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  await act(async () =>
    root.render(
      <InboxGroup
        rows={[mail({ id: "m1" }), mail({ id: "m2" })]}
        onOpen={() => {}}
        onMark={undefined}
        todoDue={new Map([["m2", null]])}
      />,
    ),
  );
  const badges = [...container.querySelectorAll('[data-slot="badge"]')].map((b) => b.textContent);
  expect(badges).toEqual(["To do"]);
  // Phones hide the badge, so a labelled icon says it.
  expect(container.querySelectorAll('svg[role="img"][aria-label="To do"]')).toHaveLength(1);
});

it("shows a to-do's due date on the Needs reply row", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <InboxGroup
        rows={[mail({ id: "m1" })]}
        onOpen={() => {}}
        onMark={undefined}
        todoDue={new Map([["m1", "2099-01-01"]])}
      />,
    ),
  );
  expect(container.querySelector('[data-slot="badge"]')?.textContent).toBe("To do · Jan 1");
  expect(container.querySelector('svg[role="img"]')?.getAttribute("aria-label")).toBe(
    "To do · Jan 1",
  );
  await act(async () => root.unmount());
  container.remove();
});
