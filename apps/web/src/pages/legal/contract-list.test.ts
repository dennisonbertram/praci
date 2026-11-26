import type { LegalContract } from "@rakazo/contracts";
import { expect, it } from "vitest";
import { contractRows, contractStatus, filterContracts } from "./contract-list";
import { contracts as fixtures } from "./fixtures";

const make = (n: number, over: Partial<LegalContract> = {}): LegalContract => ({
  ...(fixtures[0] as LegalContract),
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  title: `Warrant (Holder ${n})`,
  contractType: "Warrant",
  counterparties: ["Example Corp", `Holder ${n}`],
  expirationDate: "2031-07-09",
  nextDeadline: null,
  valueCents: null,
  ...over,
});
const today = "2026-10-26";
const asc = { field: "deadline", dir: "asc" } as const;
const titles = (rows: ReturnType<typeof contractRows>) =>
  rows.map((r) => (r.kind === "single" ? r.contract.title : `${r.name}[${r.contracts.length}]`));

it("searches title and parties, filters type, party and status", () => {
  const [msa, lease] = fixtures as [LegalContract, LegalContract];
  expect(filterContracts(fixtures, { q: "sample prop" }, today)).toEqual([lease]);
  expect(filterContracts(fixtures, { type: "Services" }, today)).toEqual([msa]);
  expect(filterContracts(fixtures, { party: "Acme Hosting Inc." }, today)).toEqual([msa]);
  expect(filterContracts(fixtures, { status: "expired" }, today)).toEqual([lease]);
  expect(filterContracts(fixtures, { status: "expiring" }, "2026-06-01")).toEqual([]);
  expect(filterContracts([msa], { status: "expiring" }, today)).toHaveLength(0);
});

const warrants = [
  make(1, { nextDeadline: "2027-03-01", valueCents: "100" }),
  make(2, { nextDeadline: "2027-01-01", valueCents: "300" }),
  make(3, { nextDeadline: null }),
];

it("sorts groups by their earliest date and members inside the group", () => {
  const single = make(9, {
    title: "Lease",
    contractType: "Lease",
    counterparties: ["Other"],
    expirationDate: "2030-01-01",
    nextDeadline: "2026-12-01",
  });
  const rows = contractRows([...warrants, single], {}, asc, true, today);
  expect(titles(rows)).toEqual(["Lease", "Warrant[3]"]);
  const group = rows[1];
  expect(group?.kind === "group" && group.contracts.map((c) => c.title)).toEqual([
    "Warrant (Holder 2)",
    "Warrant (Holder 1)",
    "Warrant (Holder 3)",
  ]);
});

it("filters members: a partly matching group stays, a fully filtered one goes", () => {
  expect(titles(contractRows(warrants, { q: "holder 1" }, asc, true, today))).toEqual([
    "Warrant[1]",
  ]);
  expect(contractRows(warrants, { q: "nothing" }, asc, true, today)).toEqual([]);
});

it("lists every contract on its own when grouping is off, value sorting with empties last", () => {
  const rows = contractRows(warrants, {}, { field: "value", dir: "desc" }, false, today);
  expect(titles(rows)).toEqual(["Warrant (Holder 2)", "Warrant (Holder 1)", "Warrant (Holder 3)"]);
});

const ids = (list: LegalContract[], status: string) =>
  filterContracts(list, { status }, today).length;
const active = (over: Partial<LegalContract>) =>
  make(1, { status: "active", autoRenews: false, ...over });

it("derives the status from the dates", () => {
  const soon = active({ expirationDate: "2026-11-25" });
  const lapsed = active({ expirationDate: "2026-10-25" });
  expect([ids([soon], "expiring"), ids([soon], "active")]).toEqual([1, 1]);
  expect([ids([lapsed], "expired"), ids([lapsed], "active"), ids([lapsed], "expiring")]).toEqual([
    1, 0, 0,
  ]);
  expect(contractStatus(lapsed, today)).toBe("expired");
  const renewed = active({ autoRenews: true, expirationDate: "2026-10-25" });
  expect([ids([renewed], "active"), ids([renewed], "expired")]).toEqual([1, 0]);
  const unknown = active({ autoRenews: null, expirationDate: "2026-10-25" });
  expect(ids([unknown], "expired")).toBe(1);
  const open = active({ expirationDate: null });
  expect([ids([open], "active"), ids([open], "expired"), ids([open], "expiring")]).toEqual([
    1, 0, 0,
  ]);
  const ends = active({ expirationDate: today });
  expect([ids([ends], "expiring"), ids([ends], "expired")]).toEqual([1, 0]);
  expect(contractStatus(active({ status: "draft", expirationDate: "2020-01-01" }), today)).toBe(
    "draft",
  );
});
