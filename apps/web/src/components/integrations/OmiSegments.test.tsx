// @vitest-environment jsdom

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import type { OmiSegmentDto } from "@rakazo/contracts";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => ({
  omi: { segments: { list: vi.fn(), move: vi.fn() } },
}));
vi.mock("../../lib/rpc", () => ({ rpc }));

import { OmiSegments } from "./OmiSegments";

i18n.loadAndActivate({ locale: "en", messages: {} });

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("keeps a stretch from this evening under Today west of UTC", async () => {
  const zone = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    // 20:00 on Nov 12 in Los Angeles is already Nov 13 in UTC.
    vi.setSystemTime(new Date(2026, 10, 12, 20, 0));
    const segment = (id: string, title: string, hour: number): OmiSegmentDto => ({
      id,
      audioItemId: "item_1",
      kind: "meeting",
      title,
      startedAt: new Date(2026, 10, 12, hour, 0).toISOString(),
      endedAt: new Date(2026, 10, 12, hour, 30).toISOString(),
      sortedBy: "agent",
      meetingId: null,
      noteItemId: null,
    });
    // 15:00 local is still Nov 12 in UTC, so it is the one a UTC comparison drops.
    rpc.omi.segments.list.mockResolvedValue([
      segment("seg_1", "Afternoon sync", 15),
      segment("seg_2", "Evening sync", 18),
    ]);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <I18nProvider i18n={i18n}>
          <MemoryRouter>
            <OmiSegments />
          </MemoryRouter>
        </I18nProvider>,
      );
    });
    const today = host.querySelector('section[aria-label="Today"]')?.textContent;
    expect(today).toContain("Afternoon sync");
    expect(today).toContain("Evening sync");
    await act(async () => root.unmount());
    host.remove();
  } finally {
    vi.useRealTimers();
    if (zone === undefined) delete process.env.TZ;
    else process.env.TZ = zone;
  }
});

it("lists the last 7 local days under their headings and drops older ones", async () => {
  const zone = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    vi.setSystemTime(new Date(2026, 10, 12, 20, 0));
    const at = (day: number, hour: number): OmiSegmentDto => ({
      id: `seg_${day}_${hour}`,
      audioItemId: "item_1",
      kind: "note",
      title: `Stretch ${day} at ${hour}`,
      startedAt: new Date(2026, 10, day, hour, 0).toISOString(),
      endedAt: new Date(2026, 10, day, hour, 30).toISOString(),
      sortedBy: "agent",
      meetingId: null,
      noteItemId: null,
    });
    // Nov 6 00:30 local is the first minute of the 7-day window; Nov 5 23:30 is the last one outside.
    rpc.omi.segments.list.mockResolvedValue([
      at(12, 9),
      at(6, 0),
      { ...at(5, 23), startedAt: new Date(2026, 10, 5, 23, 30).toISOString() },
    ]);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <I18nProvider i18n={i18n}>
          <MemoryRouter>
            <OmiSegments />
          </MemoryRouter>
        </I18nProvider>,
      );
    });
    expect(rpc.omi.segments.list).toHaveBeenCalledWith({ days: 8 });
    const headings = [...host.querySelectorAll("h2")].map((h) => h.textContent);
    expect(headings).toEqual(["Today", "Friday, Nov 6"]);
    expect(host.textContent).toContain("Stretch 6 at 0");
    expect(host.textContent).not.toContain("Stretch 5 at 23");
    await act(async () => root.unmount());
    host.remove();
  } finally {
    vi.useRealTimers();
    if (zone === undefined) delete process.env.TZ;
    else process.env.TZ = zone;
  }
});
