// @vitest-environment jsdom
import type { GtmQueueOutput } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const queue = vi.hoisted(() => vi.fn());
vi.mock("../../lib/rpc", () => ({ rpc: { gtm: { queue } } }));

import { emptyOverview, item, overview } from "../../pages/gtm/fixtures";
import { GtmCalendar } from "./GtmCalendar";

const scheduledFor = new Date("2026-11-02T12:00:00").toISOString();
const planned = { ...item, title: "Local scheduled post", scheduledFor };
const data = {
  ...overview,
  groups: {
    ...emptyOverview.groups,
    needs_you: [
      planned,
      {
        ...planned,
        id: "email_demo",
        title: "Email must stay out",
        category: "outbound_email" as const,
        channel: "email" as const,
      },
    ],
  },
};
const provider = {
  id: "provider_demo",
  content: "Provider post",
  status: "published",
  scheduledFor,
  platforms: [
    {
      platform: "twitter",
      accountId: "account_demo",
      status: "published",
      platformPostUrl: "https://x.com/example/status/123",
    },
  ],
};
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  queue.mockResolvedValue({ status: "ready", complete: true, posts: [provider] });
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.resetAllMocks();
});
const render = () =>
  act(async () =>
    root.render(
      <MemoryRouter>
        <GtmCalendar overview={data} initialDate={new Date("2026-11-02T12:00:00")} />
      </MemoryRouter>,
    ),
  );

it("shows local and provider entries, hides email, and uses a seven-day half-open window", async () => {
  await render();
  expect(queue).toHaveBeenCalledWith({
    from: new Date("2026-11-02T00:00:00").toISOString(),
    to: new Date("2026-11-09T00:00:00").toISOString(),
  });
  expect(host.textContent).toContain("Local scheduled post");
  expect(host.textContent).toContain("Needs you");
  expect(host.textContent).toContain("Provider post");
  expect(host.textContent).not.toContain("Email must stay out");
  expect(
    host.querySelector('a[href="https://x.com/example/status/123"]')?.getAttribute("rel"),
  ).toBe("noreferrer");
});

it.each([
  ["api_key_required", true, "API key required"],
  ["unavailable", false, "queue unavailable"],
  ["ready", false, "queue incomplete"],
  ["not_connected", true, "not connected"],
] as const)("keeps local items visible for %s/%s", async (status, complete, message) => {
  queue.mockResolvedValue({ status, complete, posts: [] } satisfies GtmQueueOutput);
  await render();
  expect(host.textContent).toContain(message);
  expect(host.textContent).toContain("Local scheduled post");
});

it("does not link unsafe, unpublished, or unrecognised-account provider targets", async () => {
  queue.mockResolvedValue({
    status: "ready",
    complete: true,
    posts: [
      {
        ...provider,
        platforms: [
          { ...provider.platforms[0], platformPostUrl: "javascript:alert(1)" },
          {
            ...provider.platforms[0],
            accountId: "another_account",
            platformPostUrl: "https://x.com/other/status/1",
          },
          {
            ...provider.platforms[0],
            status: "scheduled",
            platformPostUrl: "https://x.com/example/status/2",
          },
        ],
      },
    ],
  });
  await render();
  expect(host.querySelector('a[href^="javascript:"]')).toBeNull();
  expect(host.querySelector('a[href^="https://x.com"]')).toBeNull();
});

it("shows a queued post once instead of as both a local item and a queue entry", async () => {
  const queued = {
    ...planned,
    id: "queued_local",
    title: "Local copy of the queued post",
    status: "open" as const,
    proof: "zernio:p1",
  };
  const data = {
    ...overview,
    groups: { ...emptyOverview.groups, in_progress: [queued] },
  };
  queue.mockResolvedValue({
    status: "ready",
    complete: true,
    posts: [{ ...provider, id: "p1", content: "Provider copy of the queued post" }],
  });
  await act(async () =>
    root.render(
      <MemoryRouter>
        <GtmCalendar overview={data} initialDate={new Date("2026-11-02T12:00:00")} />
      </MemoryRouter>,
    ),
  );
  expect(host.textContent).toContain("Provider copy of the queued post");
  expect(host.textContent).not.toContain("Local copy of the queued post");
  // The grid and the narrow layout each render the one entry.
  expect(host.textContent?.split("Provider copy of the queued post")).toHaveLength(3);
});

it("keeps the local queued post when the queue entry renders no platform", async () => {
  const queued = {
    ...planned,
    id: "queued_local",
    title: "Local copy of the queued post",
    status: "open" as const,
    proof: "zernio:p1",
  };
  const data = {
    ...overview,
    groups: { ...emptyOverview.groups, in_progress: [queued] },
  };
  queue.mockResolvedValue({
    status: "ready",
    complete: true,
    posts: [{ ...provider, id: "p1", content: "Hidden provider copy", platforms: [] }],
  });
  await act(async () =>
    root.render(
      <MemoryRouter>
        <GtmCalendar overview={data} initialDate={new Date("2026-11-02T12:00:00")} />
      </MemoryRouter>,
    ),
  );
  expect(host.textContent).toContain("Local copy of the queued post");
  expect(host.textContent).not.toContain("Hidden provider copy");
});

it("keeps the local queued post when the queue call fails", async () => {
  const queued = {
    ...planned,
    id: "queued_local",
    title: "Local copy of the queued post",
    status: "open" as const,
    proof: "zernio:p1",
  };
  const data = {
    ...overview,
    groups: { ...emptyOverview.groups, in_progress: [queued] },
  };
  queue.mockRejectedValue(new Error("offline"));
  await act(async () =>
    root.render(
      <MemoryRouter>
        <GtmCalendar overview={data} initialDate={new Date("2026-11-02T12:00:00")} />
      </MemoryRouter>,
    ),
  );
  expect(host.textContent).toContain("Local copy of the queued post");
});

it("loads the next week rather than retaining the previous queue window", async () => {
  await render();
  await act(async () =>
    [...host.querySelectorAll("button")]
      .find((button) => button.textContent === "Next week")!
      .click(),
  );
  expect(queue).toHaveBeenLastCalledWith({
    from: new Date("2026-11-09T00:00:00").toISOString(),
    to: new Date("2026-11-16T00:00:00").toISOString(),
  });
  expect(host.textContent).not.toContain("Local scheduled post");
});
