// @vitest-environment jsdom
import type { BotPage } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({
  t: text,
  plural: (n: number, forms: { one: string; other: string }) =>
    (n === 1 ? forms.one : forms.other).replace("#", String(n)),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
  useLingui: () => ({ t: text, i18n: { locale: "en" } }),
}));
const mocks = vi.hoisted(() => ({
  overview: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  queue: vi.fn(),
  send: vi.fn(),
  pageContent: undefined as string | undefined,
  panel: vi.fn<(props: unknown) => null>(() => null),
}));
vi.mock("../lib/rpc", () => ({
  rpc: {
    gtm: { overview: mocks.overview, queue: mocks.queue },
    scratchpad: { update: mocks.update, remove: mocks.remove },
    inbox: { compose: { send: mocks.send } },
  },
}));
vi.mock("./shell/bot-page-panel", () => ({
  BotPagePanel: ({ onPageChange }: { onPageChange: (page: BotPage | null) => void }) => {
    mocks.panel({ onPageChange });
    useEffect(() => {
      if (mocks.pageContent === undefined) return;
      onPageChange({
        botId: "bot_gtm",
        content: mocks.pageContent,
        revision: 1,
        updatedBy: "bot",
        updatedAt: "2026-10-20T12:00:00.000Z",
      });
    }, [onPageChange]);
    return <div data-testid="agent-page">Agent page</div>;
  },
}));

import { GtmPage } from "./Gtm";
import { item, overview } from "./gtm/fixtures";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  mocks.overview.mockResolvedValue(overview);
  mocks.update.mockResolvedValue(item);
  mocks.pageContent = undefined;
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.resetAllMocks();
});
const render = () =>
  act(async () =>
    root.render(
      <MemoryRouter>
        <GtmPage botId="bot_gtm" remote={null} />
      </MemoryRouter>,
    ),
  );
const click = (name: string) =>
  act(async () => {
    const button = [...container.querySelectorAll("button")].find((b) => b.textContent === name);
    expect(button).toBeTruthy();
    button?.click();
  });

it("Needs you stays first and complete when the agent page has blocks", async () => {
  mocks.pageContent = '```gtm-metric\n{"label":"Completed","count":"done"}\n```';
  mocks.overview.mockResolvedValue({
    ...overview,
    postingCapability: "api_key_required",
    groups: {
      ...overview.groups,
      in_progress: [
        { ...item, id: "uncertain", status: "open", proof: `post:demo:${"a".repeat(64)}` },
      ],
    },
  });
  await render();
  const headings = [...container.querySelectorAll("h2")].map((node) => node.textContent);
  expect(headings).toContain("Needs you3");
  expect(headings).not.toContain("In progress1");
  expect(container.querySelectorAll('[data-item-id="uncertain"]')).toHaveLength(1);
  expect(container.textContent).toContain("Posting may have failed");
  const page = container.querySelector('[data-testid="agent-page"]')!;
  const uncertain = container.querySelector('[data-item-id="uncertain"]')!;
  expect(uncertain.compareDocumentPosition(page) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  const setup = container.querySelector('[data-testid="gtm-connection"]')!;
  expect(setup.querySelector('a[href="/app/integrations?q=Zernio"]')).not.toBeNull();
  expect(setup.compareDocumentPosition(uncertain) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it("keeps layout C without live blocks", async () => {
  await render();
  const headings = [...container.querySelectorAll("h2")].map((node) => node.textContent);
  expect(headings).toContain("In progress1");
  const agentPage = container.querySelector('[data-testid="agent-page"]')!;
  const firstItem = container.querySelector("[data-item-id]")!;
  expect(
    agentPage.compareDocumentPosition(firstItem) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

it("Approve sends the rendered updatedAt and shows Changed, review again when it lost", async () => {
  mocks.update.mockRejectedValue({ code: "CONFLICT" });
  await render();
  await click("Approve");
  expect(mocks.update).toHaveBeenCalledWith({
    itemId: item.id,
    status: "open",
    updatedAt: item.updatedAt,
  });
  expect(container.textContent).toContain("Changed, review again");
  expect(mocks.overview).toHaveBeenCalledTimes(2);
});
it("keeps OAuth-only post approval disabled and offers existing configuration", async () => {
  mocks.overview.mockResolvedValue({ ...overview, postingCapability: "api_key_required" });
  await render();
  const card = container.querySelector(`[data-item-id="${item.id}"]`)!;
  expect(
    [...card.querySelectorAll("button")].find((b) => b.textContent === "Approve")?.disabled,
  ).toBe(true);
  expect(card.querySelector('a[href="/app/integrations?q=Zernio"]')).not.toBeNull();
});
it("renders only safe public proofs as links", async () => {
  mocks.overview.mockResolvedValue({
    ...overview,
    groups: {
      ...overview.groups,
      done: [{ ...item, status: "done", proof: "javascript:alert(1)" }],
    },
  });
  await render();
  expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
  expect(container.textContent).toContain("javascript:alert(1)");
});
it("requires a complete queue check before founder Re-approve", async () => {
  mocks.overview.mockResolvedValue({
    ...overview,
    groups: { ...overview.groups, needs_you: [{ ...item, proof: `post:demo:${"a".repeat(64)}` }] },
  });
  mocks.queue.mockResolvedValue({ status: "unavailable", complete: false, posts: [] });
  await render();
  expect(container.textContent).toContain("Posting may have failed");
  await click("Check queue");
  expect(mocks.update).not.toHaveBeenCalled();
  expect(container.textContent).not.toContain("I checked: this post is not in the queue");
});
it("discards a task through the founder RPC", async () => {
  mocks.remove.mockResolvedValue({ ok: true });
  await render();
  await click("Discard");
  expect(mocks.remove).toHaveBeenCalledWith({ itemId: item.id });
});

it("mounts post previews and the email compliance editor under Needs you", async () => {
  mocks.overview.mockResolvedValue({
    ...overview,
    groups: {
      ...overview.groups,
      needs_you: [
        item,
        { ...item, id: "linkedin_demo", channel: "linkedin" },
        {
          ...item,
          id: "email_demo",
          category: "outbound_email",
          channel: "email",
          target: "prospect@example.test",
          notes: "Join our beta.",
        },
      ],
    },
  });
  await render();
  expect(container.textContent).toContain(" / 280");
  expect(container.textContent).toContain(" / 3,000");
  const email = container.querySelector('[data-item-id="email_demo"]')!;
  expect(email.textContent).toContain("Add unsubscribe instructions");
  expect(email.textContent).toContain("Add a postal address");
  expect(
    [...email.querySelectorAll("button")].find((button) => button.textContent === "Approve")
      ?.disabled,
  ).toBe(true);
  expect(mocks.send).not.toHaveBeenCalled();
});

it("opens the real Calendar and exposes an incomplete provider queue", async () => {
  mocks.queue.mockResolvedValue({ status: "ready", complete: false, posts: [] });
  await render();
  await click("Calendar");
  expect(container.querySelector('[data-testid="gtm-calendar-grid"]')).not.toBeNull();
  expect(container.textContent).toContain("Zernio queue incomplete");
  expect(mocks.queue).toHaveBeenCalledTimes(1);
});

it("keeps the page section visible after an existing page is cleared, hides a never-written one", async () => {
  type P = { onPageChange: (p: { content: string; updatedAt?: string } | null) => void };
  let report!: P["onPageChange"];
  mocks.panel.mockImplementation((props: unknown) => {
    report = (props as P).onPageChange;
    return null;
  });
  await render();
  await act(async () => report(null));
  expect(container.querySelector("section.hidden")).not.toBeNull();
  expect(container.textContent).toContain(overview.goal!.title);
  expect(container.querySelector("section.hidden")?.textContent).not.toContain(
    overview.goal!.title,
  );
  await act(async () => report({ content: "" }));
  expect(container.querySelector("section.hidden")).not.toBeNull();
  await act(async () => report({ content: "Plan" }));
  expect(container.querySelector("section.hidden")).toBeNull();
  await act(async () => report({ content: "" }));
  expect(container.querySelector("section.hidden")).toBeNull();
});

it("shows no empty 'Written by' card before the page has loaded", async () => {
  mocks.panel.mockImplementation(() => null);
  await render();
  expect(container.querySelector("section.hidden")?.textContent).toContain("Written by GTM agent");
});
