// @vitest-environment jsdom

import type { BrexTrip, BrexTrips as BrexTripsData } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const trips = vi.hoisted(() => vi.fn());
vi.mock("../../lib/rpc", () => ({ rpc: { brexCards: { trips } } }));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@lingui/core/macro", () => ({
  t: String.raw,
  plural: (count: number, forms: { one: string; other: string }) =>
    (count === 1 ? forms.one : forms.other).replaceAll("#", String(count)),
}));

import { BrexTravel } from "./BrexTravel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Dates are relative to now so the ordering stays deterministic whenever the test runs.
const day = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000).toISOString();
const trip = (over: Partial<BrexTrip> & { tripId: string }): BrexTrip => ({
  name: over.tripId,
  status: "APPROVED",
  bookerUserId: "user_1",
  bookerName: "Ada Example",
  startsAt: day(30),
  endsAt: day(33),
  ...over,
});
const data = (tripRows: BrexTrip[]): BrexTripsData => ({
  serverId: "server_brex",
  agentBotId: "bot_brex",
  writesEnabled: true,
  trips: tripRows,
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
async function mount(value: BrexTripsData) {
  trips.mockResolvedValue(value);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/app/brex/travel"]}>
        <BrexTravel />
      </MemoryRouter>,
    ),
  );
  await vi.waitFor(() => expect(container.textContent).toMatch(/Trips|No trips yet/));
}
const bodyRows = () => [...container.querySelectorAll("tbody tr")];

beforeEach(() => trips.mockReset());
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
});

it("lists a cancelled trip with future dates after the upcoming ones", async () => {
  await mount(
    data([
      // The cancelled trip starts sooner, so a date-only sort would put it first.
      trip({
        tripId: "trip_cancelled",
        name: "Cancelled offsite",
        status: "CANCELLED",
        startsAt: day(10),
        endsAt: day(12),
      }),
      trip({
        tripId: "trip_active",
        name: "Active offsite",
        status: "UPCOMING",
        startsAt: day(40),
        endsAt: day(43),
      }),
      trip({
        tripId: "trip_past",
        name: "Past conference",
        status: "COMPLETED",
        startsAt: day(-60),
        endsAt: day(-57),
      }),
    ]),
  );
  await vi.waitFor(() => expect(bodyRows()).toHaveLength(3));
  const names = bodyRows().map((row) => row.textContent ?? "");
  expect(names[0]).toContain("Active offsite");
  expect(names[0]).toContain("Upcoming");
  // Cancelled and past travel follow, most recent first: the cancelled trip starts later than the past one.
  expect(names[1]).toContain("Cancelled offsite");
  expect(names[2]).toContain("Past conference");
});

it("shows nothing when the RPC returns no trips", async () => {
  await mount(data([]));
  await vi.waitFor(() => expect(container.textContent).toContain("No trips yet."));
  expect(bodyRows()).toHaveLength(0);
});
