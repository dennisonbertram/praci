// @vitest-environment jsdom
import type { FundraiseRound, Safe } from "@rakazo/contracts";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { AttentionStrip, SafeList } from "./SafeList";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: unknown }) => children,
}));

const safe = (id: string, extra: Partial<Safe>): Safe => ({
  id,
  source: "mercury",
  contactId: null,
  roundId: null,
  investorName: `Investor ${id}`,
  investorEmail: null,
  amountCents: 5_000_000,
  valuationType: "post_money_cap",
  capCents: null,
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
  paidAt: "2026-10-12T00:00:00.000Z",
  documentUrl: null,
  status: "funded",
  createdAt: "2026-10-20T00:00:00.000Z",
  ...extra,
});
const round: FundraiseRound = {
  id: "r1",
  name: "Seed",
  targetCents: 200_000_000,
  capCents: 1_000_000_000,
  closedAt: null,
};

it("says Not in the round only on active SAFEs outside it", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const el = document.createElement("div");
  await act(async () => {
    createRoot(el).render(
      <MemoryRouter>
        <SafeList
          round={round}
          safes={[
            safe("out", {}),
            safe("in", { roundId: "r1" }),
            safe("gone", { status: "canceled", canceledAt: "2026-10-13T00:00:00.000Z" }),
          ]}
          onOpen={() => {}}
          onMark={() => {}}
          onCancel={() => {}}
          onDelete={() => {}}
        />
      </MemoryRouter>,
    );
  });
  const sub = (id: string) =>
    el.querySelector(`[data-safe-id="${id}"] button span:last-child`)?.textContent;
  expect(sub("out")).toContain("Not in Seed");
  expect(sub("in")).not.toContain("Not in");
  expect(sub("gone")).not.toContain("Not in");
});

it("offers Change date on a native Sent, Signed or Funded row, and nowhere else", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const items = async (row: Safe) => {
    const el = document.createElement("div");
    document.body.append(el);
    const root = createRoot(el);
    await act(async () => {
      root.render(
        <MemoryRouter>
          <SafeList
            round={round}
            safes={[row]}
            onOpen={() => {}}
            onMark={() => {}}
            onCancel={() => {}}
            onDelete={() => {}}
            onChangeDate={() => {}}
          />
        </MemoryRouter>,
      );
    });
    await act(async () =>
      el.querySelector<HTMLElement>(`[aria-label="Actions for ${row.investorName} SAFE"]`)?.click(),
    );
    const labels = [...document.querySelectorAll("[role=menuitem]")].map((i) => i.textContent);
    await act(async () => root.unmount());
    el.remove();
    return labels;
  };
  // A Mercury row's status is Mercury's, and a Draft or Canceled SAFE has no saved date to fix.
  expect(
    await items(safe("merc", { status: "sent", sentAt: "2026-10-18T00:00:00.000Z" })),
  ).not.toContain("Change date");
  expect(
    await items(safe("draft", { source: "native", status: "draft", paidAt: null })),
  ).not.toContain("Change date");
  expect(
    await items(
      safe("gone", {
        source: "native",
        status: "canceled",
        canceledAt: "2026-10-13T00:00:00.000Z",
        paidAt: null,
      }),
    ),
  ).not.toContain("Change date");
  expect(
    await items(
      safe("sent", {
        source: "native",
        status: "sent",
        sentAt: "2026-10-18T00:00:00.000Z",
        paidAt: null,
      }),
    ),
  ).toContain("Change date");
});

it("Attention name opens the SAFE", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const el = document.createElement("div");
  const onOpen = vi.fn();
  const waiting = safe("sig", {
    status: "signed",
    paidAt: null,
    signedByInvestorAt: "2026-10-05T00:00:00.000Z",
    signedByOwnerAt: "2026-10-05T00:00:00.000Z",
  });
  await act(async () => {
    createRoot(el).render(
      <MemoryRouter>
        <AttentionStrip
          safes={[waiting]}
          now={new Date("2026-10-21T12:00:00.000Z")}
          onMark={() => {}}
          onOpen={onOpen}
        />
      </MemoryRouter>,
    );
  });
  const name = el.querySelector<HTMLButtonElement>('button[title="Investor sig"]');
  expect(name?.textContent).toBe("Investor sig");
  await act(async () => name?.click());
  expect(onOpen).toHaveBeenCalledWith(waiting);
});
