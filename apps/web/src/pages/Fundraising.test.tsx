// @vitest-environment jsdom

import type { Contact, FundraiseRound, FundraisingOverview, Safe } from "@rakazo/contracts";
import { NotificationToaster, notificationToastManager } from "@rakazo/ui-web";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  legalSafeCount: vi.fn(),
  contactDelete: vi.fn(),
  roundSave: vi.fn(),
  roundClose: vi.fn(),
  roundReopen: vi.fn(),
  prospectSave: vi.fn(),
  safeSave: vi.fn(),
  safeMark: vi.fn(),
  safeDelete: vi.fn(),
  safeAssign: vi.fn(),
  safeUnassign: vi.fn(),
  markWaiting: vi.fn(),
  notSent: vi.fn(),
  refresh: vi.fn(),
  connect: vi.fn(),
}));
vi.mock("../lib/finance-connect", () => ({ connectFinanceProvider: rpcMock.connect }));
vi.mock("../lib/rpc", () => ({
  rpc: {
    legal: { safeCount: rpcMock.legalSafeCount },
    contacts: { list: rpcMock.contacts, save: rpcMock.contactSave, delete: rpcMock.contactDelete },
    fundraising: {
      overview: rpcMock.overview,
      refresh: rpcMock.refresh,
      round: { save: rpcMock.roundSave, close: rpcMock.roundClose, reopen: rpcMock.roundReopen },
      prospects: {
        save: rpcMock.prospectSave,
        markWaiting: rpcMock.markWaiting,
        notSent: rpcMock.notSent,
      },
      safes: {
        save: rpcMock.safeSave,
        mark: rpcMock.safeMark,
        delete: rpcMock.safeDelete,
        assign: rpcMock.safeAssign,
        unassign: rpcMock.safeUnassign,
      },
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
const safe = (id: string, extra: Partial<Safe> = {}): Safe => ({
  id,
  source: "native",
  contactId: null,
  roundId: "r1",
  investorName: "Harbor Angels",
  investorEmail: null,
  amountCents: 5_000_000,
  valuationType: "post_money_cap",
  capCents: 1_000_000_000,
  discountPercent: null,
  mfn: false,
  proRata: false,
  governingState: null,
  investmentDate: null,
  expiresAt: null,
  canceledAt: null,
  sentAt: null,
  signedByOwnerAt: null,
  signedByInvestorAt: null,
  paidAt: null,
  documentUrl: null,
  status: "draft",
  createdAt: "2026-10-20T00:00:00.000Z",
  ...extra,
});
const signedUnpaid = (id: string) =>
  safe(id, {
    status: "signed",
    sentAt: "2026-10-01T00:00:00.000Z",
    signedByOwnerAt: "2026-10-05T00:00:00.000Z",
    signedByInvestorAt: "2026-10-05T00:00:00.000Z",
  });
const overview = (
  round: FundraiseRound | null,
  prospects: Contact[],
  pendingCents = 0,
  safes: Safe[] = [],
  mercury: FundraisingOverview["mercury"] = {
    status: "not_connected",
    lastSyncedAt: null,
    unreadable: 0,
  },
): FundraisingOverview => ({
  mercury,
  round,
  pendingCents,
  signedCents: safes.filter((s) => s.status === "signed").reduce((n, s) => n + s.amountCents, 0),
  fundedCents: 0,
  prospects,
  safes,
});

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
  rpcMock.legalSafeCount.mockResolvedValue({ count: 0 });
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
  // The furthest stage first, with its count; empty stages are not drawn.
  expect(stageHeadings()).toEqual(["Committed1", "Intro2"]);
  const rows = [...container.querySelectorAll("[data-contact-id]")];
  expect(rows.map((row) => row.querySelector("[data-row-open]")?.textContent)).toEqual([
    "Bo Capital",
    "Ada FundCall",
    "Cy Partners",
  ]);
  const amounts = [...container.querySelectorAll("[data-testid=check-size]")].map(
    (el) => el.textContent,
  );
  expect(amounts).toEqual(["—", "$25,000", "—"]);
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
  expect(container.querySelector('section[aria-label="Pipeline"]')).not.toBeNull();
});

it("hints at a SAFE found in Legal under No SAFEs yet, without counting it", async () => {
  rpcMock.overview.mockResolvedValue(overview(null, []));
  rpcMock.legalSafeCount.mockResolvedValue({ count: 1 });
  await show();
  const link = container.querySelector('a[href="/app/legal"]');
  expect(link?.textContent).toBe("1 SAFE found in Legal");
});

it("shows quiet empty lines, not skeleton bars, once an empty overview arrived", async () => {
  rpcMock.overview.mockResolvedValue(overview(null, []));
  await show();
  expect(container.querySelector("[data-slot=skeleton]")).toBeNull();
  expect(container.textContent).toContain("No prospects yet");
  expect(container.textContent).toContain("No SAFEs yet");
  // Add prospect lives in the header only.
  expect(
    [...container.querySelectorAll("button")].filter((b) => b.textContent === "Add prospect"),
  ).toHaveLength(1);
  expect(button("Start a round")).toBeDefined();
});

it("shows loading bars only while the overview is in flight", async () => {
  rpcMock.overview.mockReturnValue(new Promise(() => undefined));
  await show();
  expect(container.querySelector('[aria-busy="true"] [data-slot=skeleton]')).not.toBeNull();
});

const committed = prospect("p1", "Harbor Angels", {
  stage: "committed",
  checkSizeCents: 5_000_000,
  roundId: "r1",
});
const dialogButton = (label: string) =>
  [
    ...document.querySelectorAll<HTMLElement>("[role=dialog] button, [role=alertdialog] button"),
  ].find((b) => b.textContent?.trim() === label);
const pendingFigure = () =>
  [...container.querySelectorAll("div")].find((d) => d.textContent === "Pending")
    ?.nextElementSibling?.textContent;

it("opens Send SAFE prefilled from the prospect and the round, with the cap as the only term", async () => {
  rpcMock.overview.mockResolvedValue(overview(openRound, [committed], 5_000_000));
  await show();
  expect(button("Send SAFE")).toBeDefined();
  await click(button("Send SAFE"));
  expect((document.getElementById("safe-investor") as HTMLInputElement).value).toBe(
    "Harbor Angels",
  );
  expect((document.getElementById("safe-amount") as HTMLInputElement).value).toBe("50000");
  // The round's cap shows as a line; the terms open on request and have no discount or MFN.
  expect(document.body.textContent).toContain("Post-money cap $10,000,000");
  expect(document.getElementById("safe-cap")).toBeNull();
  await click(dialogButton("Different terms"));
  expect((document.getElementById("safe-cap") as HTMLInputElement).value).toBe("10000000");
  expect(document.body.textContent).toContain("Pro rata side letter");
  expect(document.body.textContent).not.toMatch(/discount|MFN/i);
  expect(dialogButton("Send SAFE")).toBeDefined();
});

it("opens the terms by default with no round", async () => {
  rpcMock.overview.mockResolvedValue(overview(null, [{ ...committed, roundId: null }]));
  await show();
  await click(button("Send SAFE"));
  expect((document.getElementById("safe-cap") as HTMLInputElement).value).toBe("");
});

it("saves a Draft SAFE and shows its cover summary, where Mark sent records it", async () => {
  rpcMock.overview.mockResolvedValue(overview(openRound, [committed], 5_000_000));
  await show();
  await click(button("Send SAFE"));
  const draft = safe("s1", { contactId: "p1" });
  rpcMock.safeSave.mockResolvedValue(draft);
  rpcMock.overview.mockResolvedValue(overview(openRound, [], 5_000_000, [draft]));
  await click(dialogButton("Send SAFE"));
  await flush();
  expect(rpcMock.safeSave).toHaveBeenCalledWith(
    expect.objectContaining({
      contactId: "p1",
      investorName: "Harbor Angels",
      amountCents: 5_000_000,
      capCents: 1_000_000_000,
      proRata: false,
    }),
  );
  // The prospect left the pipeline, and the round bar did not move.
  expect(container.querySelector("[data-contact-id]")).toBeNull();
  expect(pendingFigure()).toBe("$50,000");
  expect(document.body.textContent).toContain("YC documents");
  expect(dialogButton("Print")).toBeDefined();
  rpcMock.safeMark.mockResolvedValue({ ...draft, status: "sent" });
  await click(dialogButton("Mark sent"));
  expect(rpcMock.safeMark).toHaveBeenCalledWith(
    expect.objectContaining({ id: "s1", action: "sent", at: expect.any(String) }),
  );
});

it("hides Send SAFE once a SAFE exists and brings the prospect back when it is deleted", async () => {
  const draft = safe("s1", { contactId: "p1" });
  rpcMock.overview.mockResolvedValue(overview(openRound, [], 5_000_000, [draft]));
  await show();
  expect(button("Send SAFE")).toBeUndefined();
  expect(container.querySelector("[data-safe-id=s1]")).not.toBeNull();
  await click(container.querySelector('[aria-label="Actions for Harbor Angels SAFE"]'));
  rpcMock.overview.mockResolvedValue(overview(openRound, [committed], 5_000_000));
  rpcMock.safeDelete.mockResolvedValue({ ok: true });
  await click(menuItem("Delete"));
  await click(dialogButton("Delete"));
  await flush();
  expect(rpcMock.safeDelete).toHaveBeenCalledWith({ id: "s1" });
  expect(button("Send SAFE")).toBeDefined();
});

it("offers only the next Mark action, asks for the date and offers Undo", async () => {
  const sent = safe("s1", { status: "sent", sentAt: "2026-10-20T00:00:00.000Z" });
  rpcMock.overview.mockResolvedValue(overview(openRound, [], 5_000_000, [sent]));
  await show();
  await click(container.querySelector('[aria-label="Actions for Harbor Angels SAFE"]'));
  const items = [...document.querySelectorAll("[role=menuitem]")].map((i) => i.textContent);
  expect(items).toEqual(["Open", "Mark signed", "Cancel SAFE", "Delete"]);
  rpcMock.safeMark.mockResolvedValue({ ...sent, status: "signed" });
  await click(menuItem("Mark signed"));
  await typeInto("mark-date", "2026-10-21");
  await click(dialogButton("Mark signed"));
  await flush();
  expect(rpcMock.safeMark).toHaveBeenCalledWith({
    id: "s1",
    action: "signed",
    at: "2026-10-21T12:00:00.000Z",
  });
  await click(button("Undo"));
  expect(rpcMock.safeMark).toHaveBeenLastCalledWith({ id: "s1", action: "signed", at: null });
});

it("lists a signed, unpaid SAFE in Attention with Mark funded", async () => {
  rpcMock.overview.mockResolvedValue(overview(openRound, [], 0, [signedUnpaid("s1")]));
  await show();
  const strip = container.querySelector("[aria-label=Attention]");
  expect(strip?.textContent).toContain("Awaiting deposit");
  expect(strip?.textContent).toContain("Find in Finance");
  rpcMock.safeMark.mockResolvedValue(signedUnpaid("s1"));
  await click([...strip!.querySelectorAll("button")].find((b) => b.textContent === "Mark funded"));
  await click(dialogButton("Mark funded"));
  expect(rpcMock.safeMark).toHaveBeenCalledWith(
    expect.objectContaining({ id: "s1", action: "funded" }),
  );
});

it("has no Attention block when nothing needs it", async () => {
  rpcMock.overview.mockResolvedValue(overview(openRound, [], 0, [safe("s1")]));
  await show();
  expect(container.querySelector("[aria-label=Attention]")).toBeNull();
});

it("confirms Close round only while a SAFE is signed and unpaid, and keeps the SAFEs", async () => {
  const unpaid = signedUnpaid("s1");
  rpcMock.overview.mockResolvedValue(overview(openRound, [], 0, [unpaid]));
  await show();
  await click(container.querySelector('[aria-label="Round actions"]'));
  await click(menuItem("Close round"));
  expect(rpcMock.roundClose).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("Harbor Angels' $50,000 SAFE is signed and unpaid.");
  rpcMock.roundClose.mockResolvedValue(closedRound);
  rpcMock.overview.mockResolvedValue(overview(closedRound, [], 0, [unpaid]));
  await click(dialogButton("Close round"));
  await flush();
  expect(rpcMock.roundClose).toHaveBeenCalledWith({ id: "r1" });
  // The SAFE and its Attention row stay on the closed round.
  expect(container.querySelector("[data-safe-id=s1]")).not.toBeNull();
  expect(container.querySelector("[aria-label=Attention]")).not.toBeNull();
});

it("closes at once when every SAFE is paid or unsigned", async () => {
  rpcMock.overview.mockResolvedValue(overview(openRound, [], 0, [safe("s1")]));
  await show();
  await click(container.querySelector('[aria-label="Round actions"]'));
  rpcMock.roundClose.mockResolvedValue(closedRound);
  await click(menuItem("Close round"));
  expect(rpcMock.roundClose).toHaveBeenCalledWith({ id: "r1" });
});

describe("Mercury", () => {
  const connected = {
    status: "ok",
    lastSyncedAt: new Date().toISOString(),
    unreadable: 0,
  } as const;
  const mercurySafe = (id: string, extra: Partial<Safe> = {}) =>
    safe(id, { source: "mercury", status: "sent", investorName: "Quill Fund", ...extra });
  let opened: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    opened = vi.fn();
    vi.stubGlobal("open", opened);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("offers Connect Mercury, and signs in then refreshes", async () => {
    rpcMock.overview.mockResolvedValue(overview(openRound, []));
    await show();
    rpcMock.connect.mockResolvedValue("connected");
    rpcMock.refresh.mockResolvedValue({ ok: true });
    await click(button("Connect Mercury"));
    expect(rpcMock.connect).toHaveBeenCalledWith("mercury", false);
    expect(rpcMock.refresh).toHaveBeenCalled();
  });

  it("shows the sync age with Refresh, and Sync failed with Refresh and Reconnect", async () => {
    rpcMock.overview.mockResolvedValue(overview(openRound, [], 0, [], connected));
    await show();
    expect(button("Mercury · just now")).toBeDefined();
    await click(button("Mercury · just now"));
    expect([...document.querySelectorAll("[role=menuitem]")].map((i) => i.textContent)).toEqual([
      "Refresh",
    ]);
    await click(document.body);
    rpcMock.overview.mockResolvedValue(
      overview(openRound, [], 0, [], { ...connected, status: "error", unreadable: 2 }),
    );
    await act(async () => root.unmount());
    root = createRoot(container);
    await show();
    expect(container.textContent).toContain("2 SAFEs could not be read");
    await click(button("Sync failed"));
    expect([...document.querySelectorAll("[role=menuitem]")].map((i) => i.textContent)).toEqual([
      "Refresh",
      "Reconnect",
    ]);
    rpcMock.connect.mockResolvedValue("connected");
    rpcMock.refresh.mockResolvedValue({ ok: true });
    await click(menuItem("Reconnect"));
    expect(rpcMock.connect).toHaveBeenCalledWith("mercury", true);
  });

  it("Send SAFE opens Mercury and marks the prospect waiting, with no new SAFE row", async () => {
    const ada = prospect("p1", "Ada Fund", { stage: "committed" });
    rpcMock.overview.mockResolvedValue(overview(openRound, [ada], 0, [], connected));
    await show();
    rpcMock.markWaiting.mockResolvedValue(ada);
    rpcMock.overview.mockResolvedValue(
      overview(
        openRound,
        [{ ...ada, mercurySentAt: "2026-10-21T00:00:00.000Z" }],
        0,
        [],
        connected,
      ),
    );
    await click(button("Send SAFE"));
    await flush();
    expect(opened).toHaveBeenCalledWith("https://app.mercury.com", "_blank", "noopener");
    expect(rpcMock.markWaiting).toHaveBeenCalledWith({ id: "p1" });
    expect(rpcMock.safeSave).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Waiting for Mercury");
    expect(button("Send SAFE")).toBeUndefined();
    expect(container.querySelector("[data-safe-id]")).toBeNull();
    await click(container.querySelector('[aria-label="Actions for Ada Fund"]'));
    expect([...document.querySelectorAll("[role=menuitem]")].map((i) => i.textContent)).toEqual([
      "Open Mercury",
      "Not sent",
      "Passed",
      "Edit prospect",
    ]);
    rpcMock.notSent.mockResolvedValue(ada);
    await click(menuItem("Not sent"));
    expect(rpcMock.notSent).toHaveBeenCalledWith({ id: "p1" });
  });

  it("asks for the investor email first when the prospect has none", async () => {
    const bare = prospect("p1", "Ada Fund", { stage: "committed", email: null });
    rpcMock.overview.mockResolvedValue(overview(openRound, [bare], 0, [], connected));
    await show();
    await click(button("Send SAFE"));
    expect(rpcMock.markWaiting).not.toHaveBeenCalled();
    expect(document.getElementById("investor-email")).not.toBeNull();
    await typeInto("investor-email", "ada@example.test");
    rpcMock.contactSave.mockResolvedValue(bare);
    rpcMock.markWaiting.mockResolvedValue(bare);
    await click(dialogButton("Send SAFE"));
    expect(rpcMock.contactSave).toHaveBeenCalledWith({
      id: "p1",
      name: "Ada Fund",
      email: "ada@example.test",
    });
    expect(rpcMock.markWaiting).toHaveBeenCalledWith({ id: "p1" });
  });

  it("offers Assign to contact only on a Mercury row with no contact, listing prospects and investors", async () => {
    const investor = prospect("c1", "Priya Investor", { kind: "investor", stage: null });
    const customer = prospect("c2", "Cy Customer", { kind: "customer", stage: null });
    const ada = prospect("p1", "Ada Fund", { stage: "target" });
    rpcMock.contacts.mockResolvedValue([investor, customer, ada]);
    rpcMock.overview.mockResolvedValue(
      overview(
        openRound,
        [ada],
        0,
        [mercurySafe("m1"), mercurySafe("m2", { contactId: "c1" }), safe("n1")],
        connected,
      ),
    );
    await show();
    const row = (id: string) => container.querySelector(`[data-safe-id=${id}]`);
    expect(row("m1")?.textContent).toContain("Assign to contact");
    expect(row("m2")?.textContent).not.toContain("Assign to contact");
    expect(row("n1")?.textContent).not.toContain("Assign to contact");
    await click(
      [...(row("m1")?.querySelectorAll("button") ?? [])].find(
        (b) => b.textContent === "Assign to contact",
      ),
    );
    const options = [...document.querySelectorAll("#assign-contact option")].map(
      (o) => o.textContent,
    );
    expect(options).toEqual(["", "Priya Investor", "Ada Fund"]);
    const select = document.getElementById("assign-contact") as HTMLSelectElement;
    await act(async () => {
      select.value = "p1";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    rpcMock.safeAssign.mockResolvedValue(mercurySafe("m1", { contactId: "p1" }));
    await click(dialogButton("Assign"));
    expect(rpcMock.safeAssign).toHaveBeenCalledWith({ id: "m1", contactId: "p1" });
  });

  it("offers Unassign only on an attached Mercury row, and no Mark action on a Funded one", async () => {
    rpcMock.overview.mockResolvedValue(
      overview(
        openRound,
        [],
        0,
        [
          mercurySafe("m1", {
            contactId: "c1",
            status: "funded",
            paidAt: "2026-10-10T00:00:00.000Z",
          }),
          mercurySafe("m2"),
        ],
        connected,
      ),
    );
    await show();
    await click(container.querySelector('[aria-label="Actions for Quill Fund SAFE"]'));
    const items = [...document.querySelectorAll("[role=menuitem]")].map((i) => i.textContent);
    expect(items).toContain("Unassign");
    expect(items.some((i) => i?.startsWith("Mark"))).toBe(false);
    rpcMock.safeUnassign.mockResolvedValue(mercurySafe("m1"));
    await click(menuItem("Unassign"));
    expect(rpcMock.safeUnassign).toHaveBeenCalledWith({ id: "m1" });
  });

  it("links a matched deposit to Finance", async () => {
    rpcMock.overview.mockResolvedValue(
      overview(openRound, [], 0, [mercurySafe("m1", { financeTransactionId: "tx1" })], connected),
    );
    await show();
    const link = [...container.querySelectorAll("a")].find(
      (a) => a.textContent === "Deposit in Finance",
    );
    expect(link?.getAttribute("href")).toBe("/app/finance");
  });
});
