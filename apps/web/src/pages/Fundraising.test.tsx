// @vitest-environment jsdom

import type { Contact, FundraiseRound, FundraisingOverview } from "@rakazo/contracts";
import { NotificationToaster, notificationToastManager } from "@rakazo/ui-web";
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
  useLingui: () => ({ t: text, i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

const rpcMock = vi.hoisted(() => ({
  overview: vi.fn(),
  contacts: vi.fn(),
  contactSave: vi.fn(),
  contactDelete: vi.fn(),
  roundSave: vi.fn(),
  roundClose: vi.fn(),
  roundReopen: vi.fn(),
  prospectSave: vi.fn(),
}));
vi.mock("../lib/rpc", () => ({
  rpc: {
    contacts: { list: rpcMock.contacts, save: rpcMock.contactSave, delete: rpcMock.contactDelete },
    fundraising: {
      overview: rpcMock.overview,
      round: { save: rpcMock.roundSave, close: rpcMock.roundClose, reopen: rpcMock.roundReopen },
      prospects: { save: rpcMock.prospectSave },
    },
  },
}));

import { FundraisingPage } from "./Fundraising";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const prospect = (id: string, name: string, extra: Partial<Contact> = {}): Contact => ({
  id,
  name,
  email: `${name.toLowerCase().replace(" ", ".")}@example.test`,
  organization: null,
  kind: "prospect",
  notes: null,
  stage: "target",
  checkSizeCents: null,
  nextStep: null,
  roundId: null,
  addedBy: null,
  createdAt: "2026-10-15T00:00:00.000Z",
  updatedAt: "2026-10-15T00:00:00.000Z",
  ...extra,
});
const openRound: FundraiseRound = {
  id: "r1",
  name: "Seed",
  targetCents: 200_000_000,
  capCents: 1_000_000_000,
  closedAt: null,
};
const closedRound: FundraiseRound = { ...openRound, closedAt: "2026-10-20T00:00:00.000Z" };
const overview = (
  round: FundraiseRound | null,
  prospects: Contact[],
  pendingCents = 0,
): FundraisingOverview => ({ round, pendingCents, prospects });

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const flush = () => act(async () => {});
const button = (label: string) =>
  [...document.querySelectorAll<HTMLElement>("button")].find(
    (b) => b.textContent?.trim() === label,
  );
const click = (el: Element | null | undefined) => act(async () => (el as HTMLElement)?.click());
const menuItem = (label: string) =>
  [...document.querySelectorAll<HTMLElement>("[role=menuitem]")].find(
    (item) => item.textContent === label,
  );
async function typeInto(id: string, value: string) {
  const input = document.getElementById(id) as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function show() {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <FundraisingPage />
        <NotificationToaster onOpen={() => {}} />
      </MemoryRouter>,
    ),
  );
  await flush();
}
const stageHeadings = () =>
  [...container.querySelectorAll("h3")].map((heading) => heading.textContent);

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  rpcMock.contacts.mockResolvedValue([]);
});
afterEach(() => {
  act(() => notificationToastManager.close());
  act(() => root.unmount());
  container.remove();
  vi.resetAllMocks();
});

it("groups prospects under their stage with a check size column and no row chips", async () => {
  rpcMock.overview.mockResolvedValue(
    overview(openRound, [
      prospect("p1", "Ada Fund", { stage: "intro", checkSizeCents: 2_500_000, nextStep: "Call" }),
      prospect("p2", "Bo Capital", { stage: "committed" }),
      prospect("p3", "Cy Partners", { stage: "intro" }),
    ]),
  );
  await show();
  // Empty stages are not drawn.
  expect(stageHeadings()).toEqual(["Intro", "Committed"]);
  const rows = [...container.querySelectorAll("[data-contact-id]")];
  expect(rows.map((row) => row.querySelector("[data-row-open]")?.textContent)).toEqual([
    "Ada FundCall",
    "Cy Partners",
    "Bo Capital",
  ]);
  const amounts = [...container.querySelectorAll("[data-testid=check-size]")].map(
    (el) => el.textContent,
  );
  expect(amounts).toEqual(["$25,000", "—", "—"]);
  expect(container.textContent).not.toMatch(/Stage:/);
});

it("collapses Passed behind a button that expands in place", async () => {
  rpcMock.overview.mockResolvedValue(
    overview(openRound, [prospect("p1", "Old Fund", { stage: "passed" })]),
  );
  await show();
  expect(container.textContent).not.toContain("Old Fund");
  await click(button("Passed 1"));
  expect(container.textContent).toContain("Old Fund");
});

it("shows Pipeline and SAFEs with no round, where the card only offers Start a round", async () => {
  rpcMock.overview.mockResolvedValue(overview(null, []));
  await show();
  expect(button("Start a round")).toBeDefined();
  expect(container.textContent).toContain("No prospects yet");
  expect(container.textContent).toContain("Pipeline");
  expect(container.textContent).toContain("SAFEs");
  expect(button("Round actions")).toBeUndefined();
  expect(container.querySelector('[aria-label="Round actions"]')).toBeNull();
});

it("Add prospect works with no round and opens the dialog with Stage", async () => {
  rpcMock.overview.mockResolvedValue(overview(null, []));
  await show();
  await click(button("Add prospect"));
  expect(document.body.textContent).toContain("Add prospect");
  expect(document.getElementById("contact-stage")).not.toBeNull();
  await typeInto("contact-name", "New Fund");
  await typeInto("contact-check-size", "50,000");
  rpcMock.contactSave.mockResolvedValue(prospect("p9", "New Fund"));
  await click(button("Save"));
  expect(rpcMock.contactSave).toHaveBeenCalledWith(
    expect.objectContaining({
      name: "New Fund",
      kind: "prospect",
      stage: "target",
      checkSizeCents: 5_000_000,
    }),
  );
});

it("offers Close round only in the round menu, then Reopen on the closed card", async () => {
  rpcMock.overview.mockResolvedValue(overview(openRound, [], 0));
  await show();
  expect(button("Close round")).toBeUndefined();
  expect(container.textContent).toContain("Seed");
  expect(container.textContent).toContain("Pending");
  await click(container.querySelector('[aria-label="Round actions"]'));
  rpcMock.overview.mockResolvedValue(overview(closedRound, []));
  rpcMock.roundClose.mockResolvedValue(closedRound);
  await click(menuItem("Close round"));
  expect(rpcMock.roundClose).toHaveBeenCalledWith({ id: "r1" });
  await flush();
  // Closed: one line, Start a round, and the Pipeline and SAFEs stay.
  expect(container.textContent).toContain("Closed");
  expect(button("Start a round")).toBeDefined();
  expect(container.textContent).toContain("SAFEs");
  await click(container.querySelector('[aria-label="Round actions"]'));
  rpcMock.roundReopen.mockResolvedValue(openRound);
  await click(menuItem("Reopen"));
  expect(rpcMock.roundReopen).toHaveBeenCalledWith({ id: "r1" });
});

it("shows a refused Reopen as a toast", async () => {
  rpcMock.overview.mockResolvedValue(overview(closedRound, []));
  await show();
  await click(container.querySelector('[aria-label="Round actions"]'));
  rpcMock.roundReopen.mockRejectedValue(new Error("Another round is already open."));
  await click(menuItem("Reopen"));
  await flush();
  expect(document.body.textContent).toContain("Another round is already open.");
});

it("starts a round from the dialog", async () => {
  rpcMock.overview.mockResolvedValue(overview(null, []));
  await show();
  await click(button("Start a round"));
  await typeInto("round-name", "Seed");
  await typeInto("round-target", "2,000,000");
  await typeInto("round-cap", "10000000");
  rpcMock.roundSave.mockResolvedValue(openRound);
  await click(
    [...document.querySelectorAll<HTMLElement>("[role=dialog] button")].find(
      (b) => b.textContent === "Start a round",
    ),
  );
  expect(rpcMock.roundSave).toHaveBeenCalledWith({
    name: "Seed",
    targetCents: 200_000_000,
    capCents: 1_000_000_000,
  });
});

it("edits the open round in the same dialog", async () => {
  rpcMock.overview.mockResolvedValue(overview(openRound, []));
  await show();
  await click(container.querySelector('[aria-label="Round actions"]'));
  await click(menuItem("Edit round"));
  expect((document.getElementById("round-name") as HTMLInputElement).value).toBe("Seed");
  await typeInto("round-name", "Seed 2");
  rpcMock.roundSave.mockClear();
  await click(button("Save"));
  expect(rpcMock.roundSave).toHaveBeenCalledWith({
    id: "r1",
    name: "Seed 2",
    targetCents: 200_000_000,
    capCents: 1_000_000_000,
  });
});

it("counts Pending from the overview", async () => {
  rpcMock.overview.mockResolvedValue(
    overview(
      openRound,
      [prospect("p1", "Ada Fund", { stage: "committed", checkSizeCents: 5_000_000 })],
      5_000_000,
    ),
  );
  await show();
  expect(container.textContent).toContain("Pending$50,000");
});

it("moves a prospect to another stage from its row menu", async () => {
  rpcMock.overview.mockResolvedValue(overview(openRound, [prospect("p1", "Ada Fund")]));
  await show();
  await click(container.querySelector('button[aria-label="Actions for Ada Fund"]'));
  await click(menuItem("Move to"));
  rpcMock.prospectSave.mockResolvedValue(prospect("p1", "Ada Fund", { stage: "committed" }));
  await click(menuItem("Committed"));
  expect(rpcMock.prospectSave).toHaveBeenCalledWith({ id: "p1", stage: "committed" });
});

it("opens the contact that already has the typed email instead of failing", async () => {
  const existing = { ...prospect("c7", "Dee Existing"), kind: "investor" as const, stage: null };
  rpcMock.overview.mockResolvedValue(overview(null, []));
  rpcMock.contacts.mockResolvedValue([existing]);
  await show();
  await click(button("Add prospect"));
  await typeInto("contact-name", "Someone");
  await typeInto("contact-email", existing.email!);
  rpcMock.contactSave.mockRejectedValue(new Error("Another contact already has this email."));
  await click(button("Save"));
  await flush();
  await click(button("Open Dee Existing"));
  expect((document.getElementById("contact-name") as HTMLInputElement).value).toBe("Dee Existing");
  // An investor has no Stage.
  expect(document.getElementById("contact-stage")).toBeNull();
});

it("shows an error with Try again when the page cannot load", async () => {
  rpcMock.overview.mockRejectedValue(new Error("boom"));
  await show();
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  rpcMock.overview.mockResolvedValue(overview(null, []));
  await click(button("Try again"));
  expect(container.textContent).toContain("No prospects yet");
});
