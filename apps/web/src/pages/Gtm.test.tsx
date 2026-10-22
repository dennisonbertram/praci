// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act } from "react";
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
}));
vi.mock("../lib/rpc", () => ({
  rpc: {
    gtm: { overview: mocks.overview, queue: mocks.queue },
    scratchpad: { update: mocks.update, remove: mocks.remove },
    inbox: { compose: { send: mocks.send } },
  },
}));
vi.mock("./shell/bot-page-panel", () => ({ BotPagePanel: () => null }));

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
