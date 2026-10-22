// @vitest-environment jsdom

import type { CleanupSender, MailAccountSummary } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({
  t: text,
  plural: (count: number, forms: { one: string; other: string }) =>
    (count === 1 ? forms.one : forms.other).replace("#", String(count)),
}));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: text, i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

const rpcMock = vi.hoisted(() => ({
  list: vi.fn(),
  archive: vi.fn(),
  unsubscribe: vi.fn(),
  forget: vi.fn(),
  actions: vi.fn(),
  undo: vi.fn(),
  inboxList: vi.fn(),
}));
vi.mock("../../lib/rpc", () => ({
  rpc: {
    inbox: {
      list: rpcMock.inboxList,
      cleanup: { list: rpcMock.list, archive: rpcMock.archive, forget: rpcMock.forget },
      unsubscribe: rpcMock.unsubscribe,
      actions: { list: rpcMock.actions, undo: rpcMock.undo },
    },
  },
}));

import { InboxCleanup } from "./InboxCleanup";

const sender = (address: string, patch: Partial<CleanupSender> = {}): CleanupSender => ({
  connectionId: "c1",
  address,
  name: address.split("@")[0] ?? address,
  messageCount: 10,
  readCount: 0,
  lastReceivedAt: "2026-10-18T10:00:00.000Z",
  inboxThreads: 4,
  preselected: true,
  spamLike: false,
  unsubscribe: "link",
  skipInbox: false,
  unsubscribeStatus: null,
  ...patch,
});
const accounts: MailAccountSummary[] = [{ connectionId: "c1", label: "Me" }];
const output = (senders: CleanupSender[], more: MailAccountSummary[] = accounts) => ({
  accounts: more,
  senders,
  syncedAt: null,
});

const cleanups: Array<() => Promise<void>> = [];
const onBack = vi.fn();
const onRefreshed = vi.fn();
const onAllowMailRules = vi.fn();
const onOpenNewsletters = vi.fn();
async function render() {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <InboxCleanup
        connectionId="c1"
        onBack={onBack}
        onRefreshed={onRefreshed}
        onAllowMailRules={onAllowMailRules}
        onOpenNewsletters={onOpenNewsletters}
      />,
    ),
  );
  cleanups.push(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  return container;
}
const button = (label: string | RegExp) =>
  [...document.querySelectorAll<HTMLElement>("button, [role='menuitem']")].find((b) =>
    typeof label === "string" ? b.textContent === label : label.test(b.textContent ?? ""),
  );
const click = (el: Element | null | undefined) =>
  act(async () => {
    el?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
const boxes = () => [...document.querySelectorAll<HTMLElement>("[data-sender] [role='checkbox']")];
const selectAll = () =>
  [...document.querySelectorAll<HTMLElement>("label")]
    .find((l) => l.textContent === "Select all")
    ?.querySelector<HTMLElement>("[role='checkbox']");
const checked = () => boxes().map((b) => b.getAttribute("aria-checked"));

const news = sender("news@lists.example.test");
const deals = sender("deals@shop.example.test", { inboxThreads: 6 });
const friend = sender("friend@example.test", { preselected: false, inboxThreads: 2 });

beforeEach(() => {
  rpcMock.inboxList.mockResolvedValue({ pileCounts: { newsletters: 0 } });
  rpcMock.list.mockResolvedValue(output([news, deals, friend]));
  rpcMock.actions.mockResolvedValue({ actions: [] });
  rpcMock.archive.mockResolvedValue({ batchId: "batch-1", done: 4, failed: 0, remaining: 0 });
  rpcMock.unsubscribe.mockResolvedValue({ status: "done", method: "one_click" });
  rpcMock.undo.mockResolvedValue({ restored: 4, failed: 0 });
  rpcMock.forget.mockResolvedValue({ ok: true });
});
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

describe("InboxCleanup", () => {
  it("shows a loading state, then the senders with the preselected ones ticked", async () => {
    let finish: (value: unknown) => void = () => {};
    rpcMock.list.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    await render();
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    await act(async () => finish(output([news, deals, friend])));

    expect(document.body.textContent).toContain("news");
    expect(checked()).toEqual(["true", "true", "false"]);
    expect(rpcMock.list).toHaveBeenCalledWith({ connectionId: "c1" });
    expect(button("Archive 10")).toBeDefined();
  });

  it("says there is nothing to clean up when the list is empty", async () => {
    rpcMock.list.mockResolvedValue(output([]));
    await render();
    expect(document.body.textContent).toContain("Nothing to clean up");
    // The empty state names the rule, so it does not contradict a Newsletters list.
    expect(document.body.textContent).toContain("Senders need 3 or more messages");
    expect(button(/^Archive/)).toBeUndefined();
  });

  it("links the empty state to Newsletters only when that pile holds mail", async () => {
    rpcMock.list.mockResolvedValue(output([]));
    rpcMock.inboxList.mockResolvedValue({ pileCounts: { newsletters: 0 } });
    await render();
    expect(button("Open Newsletters")).toBeUndefined();
    rpcMock.inboxList.mockResolvedValue({ pileCounts: { newsletters: 8 } });
    await render();
    await act(async () => button("Open Newsletters")?.click());
    expect(onOpenNewsletters).toHaveBeenCalledTimes(1);
  });

  it("offers Try again after a failed load", async () => {
    rpcMock.list.mockRejectedValueOnce(new Error("boom")).mockResolvedValue(output([news]));
    await render();
    expect(document.body.textContent).toContain("Couldn't load senders");
    await click(button("Try again"));
    expect(checked()).toEqual(["true"]);
  });

  it("changes the counts when a sender is unticked", async () => {
    await render();
    expect(button("Archive 10")).toBeDefined();
    await click(boxes()[1]);
    expect(button("Archive 4")).toBeDefined();
    expect(button("Archive future mail 4")).toBeDefined();
    await click(boxes()[0]);
    expect(button("Archive")?.hasAttribute("disabled")).toBe(true);
  });

  it("keeps the action bar in place, disabled while nothing is ticked, and Select all ticks and clears every row", async () => {
    rpcMock.list.mockResolvedValue(
      output([sender("a@lists.example.test", { preselected: false }), friend]),
    );
    await render();
    expect(button("Archive")?.hasAttribute("disabled")).toBe(true);
    await click(selectAll());
    expect(checked()).toEqual(["true", "true"]);
    expect(button("Archive 6")).toBeDefined();
    await click(selectAll());
    expect(checked()).toEqual(["false", "false"]);
    expect(button("Archive")?.hasAttribute("disabled")).toBe(true);
  });

  it("archives the ticked senders, then offers Undo that reverses the batch", async () => {
    await render();
    await click(button("Archive 10"));

    expect(rpcMock.archive).toHaveBeenCalledTimes(2);
    expect(rpcMock.archive).toHaveBeenCalledWith({
      kind: "archive",
      connectionId: "c1",
      address: "news@lists.example.test",
    });
    expect(document.body.textContent).toContain("Archived 8");
    expect(onRefreshed).toHaveBeenCalled();
    await click(button("Undo"));
    expect(rpcMock.undo).toHaveBeenCalledWith({ batchId: "batch-1" });
  });

  it("pages an archive until nothing remains", async () => {
    rpcMock.list.mockResolvedValue(output([news]));
    rpcMock.archive
      .mockResolvedValueOnce({ batchId: "b", done: 50, failed: 0, remaining: 30 })
      .mockResolvedValueOnce({ batchId: "b", done: 30, failed: 0, remaining: 0 });
    await render();
    await click(button("Archive 4"));
    expect(rpcMock.archive).toHaveBeenCalledTimes(2);
    expect(rpcMock.archive).toHaveBeenLastCalledWith(expect.objectContaining({ batchId: "b" }));
    expect(document.body.textContent).toContain("Archived 80");
  });

  it("unsubscribes first and archives after it worked", async () => {
    await render();
    await click(button("Unsubscribe 10"));
    expect(rpcMock.unsubscribe).toHaveBeenCalledTimes(2);
    expect(rpcMock.archive).toHaveBeenCalledWith(expect.objectContaining({ kind: "unsubscribe" }));
    expect(document.body.textContent).toContain("Unsubscribed from 2");
  });

  it("keeps a failed one-click sender's mail, and offers its link as a link to click", async () => {
    rpcMock.list.mockResolvedValue(output([news]));
    rpcMock.unsubscribe.mockResolvedValue({
      status: "failed",
      method: "one_click",
      openUrl: "https://lists.example.test/u/1",
    });
    const open = vi.spyOn(window, "open");
    await render();
    await click(button("Unsubscribe 4"));

    expect(rpcMock.archive).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Couldn't unsubscribe from news");
    const link = document.querySelector<HTMLAnchorElement>(
      'a[href="https://lists.example.test/u/1"]',
    );
    expect(link?.textContent).toBe("Open link");
    expect(link?.target).toBe("_blank");
    expect(link?.rel).toContain("noopener");
    expect(open).not.toHaveBeenCalled();
  });

  it("shows the link of an opened unsubscribe for the user to click", async () => {
    rpcMock.list.mockResolvedValue(output([news]));
    rpcMock.unsubscribe.mockResolvedValue({
      status: "opened",
      method: "link",
      openUrl: "https://lists.example.test/u/2",
    });
    await render();
    await click(button("Unsubscribe 4"));
    expect(document.querySelector('a[href="https://lists.example.test/u/2"]')).not.toBeNull();
    expect(rpcMock.archive).toHaveBeenCalled();
  });

  it("asks before sending an unsubscribe email and sends only after Send", async () => {
    rpcMock.list.mockResolvedValue(output([news]));
    rpcMock.unsubscribe
      .mockResolvedValueOnce({
        status: "needs_confirmation",
        method: "mailto",
        mailTo: "unsub@lists.example.test",
      })
      .mockResolvedValueOnce({ status: "sent", method: "mailto" });
    await render();
    await click(button("Unsubscribe 4"));

    expect(document.body.textContent).toContain(
      "Send an unsubscribe email to unsub@lists.example.test?",
    );
    expect(rpcMock.unsubscribe).toHaveBeenCalledTimes(1);
    expect(rpcMock.archive).not.toHaveBeenCalled();
    await click(button("Send"));
    expect(rpcMock.unsubscribe).toHaveBeenLastCalledWith({
      connectionId: "c1",
      address: "news@lists.example.test",
      confirmMailto: true,
    });
    expect(rpcMock.archive).toHaveBeenCalled();
  });

  it("sends nothing when the email is cancelled", async () => {
    rpcMock.list.mockResolvedValue(output([news]));
    rpcMock.unsubscribe.mockResolvedValue({
      status: "needs_confirmation",
      method: "mailto",
      mailTo: "unsub@lists.example.test",
    });
    await render();
    await click(button("Unsubscribe 4"));
    await click(button("Cancel"));
    expect(rpcMock.unsubscribe).toHaveBeenCalledTimes(1);
    expect(rpcMock.archive).not.toHaveBeenCalled();
  });

  it("leaves spam-like senders unticked, out of Archive future mail and Unsubscribe, and flagged", async () => {
    const spam = sender("win@promo.example.test", {
      spamLike: true,
      preselected: false,
      unsubscribe: "refused",
    });
    rpcMock.list.mockResolvedValue(output([spam, news]));
    await render();
    expect(checked()).toEqual(["false", "true"]);
    expect(document.body.textContent).toContain("Looks like spam");
    await click(boxes()[0]);
    expect(button("Archive future mail 4")).toBeDefined();
    expect(button("Unsubscribe 4")).toBeDefined();
  });

  it("marks a sender Skipping after skip inbox and forgets the decision on Stop", async () => {
    const skipping = sender("news@lists.example.test", { skipInbox: true, preselected: false });
    rpcMock.list.mockResolvedValueOnce(output([news])).mockResolvedValue(output([skipping]));
    await render();
    await click(button("Archive future mail 4"));
    expect(rpcMock.archive).toHaveBeenCalledWith(expect.objectContaining({ kind: "skip_inbox" }));
    expect(document.body.textContent).toContain("Skipping inbox for 1 sender");
    expect(document.body.textContent).toContain("Skipping");
    await click(button("Stop"));
    expect(rpcMock.forget).toHaveBeenCalledWith({
      connectionId: "c1",
      address: "news@lists.example.test",
    });
  });

  it("forgets only the learned pile on Forget and reloads the list", async () => {
    const learned = sender("news@lists.example.test", { learnedPile: "newsletters" });
    rpcMock.list.mockResolvedValueOnce(output([learned])).mockResolvedValue(output([news]));
    await render();
    expect(document.body.textContent).toContain("Learned");
    await click(button("Forget"));
    expect(rpcMock.forget).toHaveBeenCalledWith({
      connectionId: "c1",
      address: "news@lists.example.test",
      learned: true,
    });
    expect(document.body.textContent).not.toContain("Learned");
  });

  it("marks the ticked senders as spam from the More menu", async () => {
    rpcMock.list.mockResolvedValue(output([news]));
    await render();
    await click(document.querySelector('button[aria-label="More"]'));
    await click(button("Spam 4"));
    expect(rpcMock.archive).toHaveBeenCalledWith(expect.objectContaining({ kind: "spam" }));
    expect(document.body.textContent).toContain("Marked 4 as spam");
  });

  it("names the account on each row when there are several", async () => {
    rpcMock.list.mockResolvedValue(
      output(
        [news, sender("b@x.example.test", { connectionId: "c2" })],
        [...accounts, { connectionId: "c2", label: "Work" }],
      ),
    );
    await render();
    expect(document.body.textContent).toContain("Me");
    expect(document.body.textContent).toContain("Work");
  });

  it("lists the history and undoes an action from it", async () => {
    rpcMock.actions.mockResolvedValue({
      actions: [
        {
          batchId: "old-1",
          kind: "archive",
          source: "user",
          reason: "cleanup",
          createdAt: "2026-10-18T10:00:00.000Z",
          undone: false,
          threadCount: 7,
          senders: ["news@lists.example.test"],
          senderCount: 1,
        },
      ],
    });
    await render();
    expect(document.body.textContent).toContain("Archived 7");
    const undo = [...document.querySelectorAll("li button")].find((b) => b.textContent === "Undo");
    await click(undo);
    expect(rpcMock.undo).toHaveBeenCalledWith({ batchId: "old-1" });
  });

  it("goes back from the header", async () => {
    await render();
    await click(document.querySelector('button[aria-label="Back"]'));
    expect(onBack).toHaveBeenCalled();
  });

  describe("Also in Gmail", () => {
    const pending = (connectionId = "c1") =>
      sender(`p-${connectionId}@lists.example.test`, {
        connectionId,
        skipInbox: true,
        rule: "pending",
      });
    const needs = (connectionId = "c1", label = "Me") => ({
      connectionId,
      label,
      senderRules: "needs_permission" as const,
    });
    const links = () =>
      [...document.querySelectorAll("button")].filter((b) => b.textContent === "Also in Gmail");

    it("starts the sign-in for the account that is waiting for permission", async () => {
      rpcMock.list.mockResolvedValue(output([news, pending()], [needs()]));
      await render();
      expect(links()).toHaveLength(1);
      await click(links()[0]);
      expect(onAllowMailRules).toHaveBeenCalledWith("c1");
    });

    it("shows one per waiting account, named, and none for the others", async () => {
      rpcMock.list.mockResolvedValue(
        output(
          [pending("c1"), pending("c2"), pending("c3")],
          [
            needs("c1", "Me"),
            needs("c2", "Work"),
            { connectionId: "c3", label: "Ready", senderRules: "ready" },
          ],
        ),
      );
      await render();
      expect(links()).toHaveLength(2);
      expect(document.body.textContent).toContain("Work");
      await click(links()[1]);
      expect(onAllowMailRules).toHaveBeenCalledWith("c2");
    });

    it.each([
      ["no sender waiting", [news], [needs()]],
      [
        "an account that can already make filters",
        [pending()],
        [{ connectionId: "c1", label: "Me", senderRules: "ready" as const }],
      ],
      [
        "a route that cannot",
        [pending()],
        [{ connectionId: "c1", label: "Me", senderRules: "unsupported" as const }],
      ],
      ["an older server", [pending()], [{ connectionId: "c1", label: "Me" }]],
    ])("is hidden with %s", async (_name, senders, more) => {
      rpcMock.list.mockResolvedValue(output(senders, more));
      await render();
      expect(links()).toHaveLength(0);
    });

    it("is not shown while the list loads or when it fails", async () => {
      rpcMock.list.mockReturnValueOnce(new Promise(() => {}));
      await render();
      expect(links()).toHaveLength(0);
    });
  });
});
