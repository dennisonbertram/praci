// @vitest-environment jsdom

import type { CompanyEdgeRecord } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const text = vi.hoisted(() => (parts: TemplateStringsArray, ...values: unknown[]) => {
  const message = parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), "");
  return message === "works on" ? `T:${message}` : message;
});
vi.mock("@lingui/core/macro", () => ({ t: text, plural: () => "" }));
vi.mock("@lingui/react", () => ({
  useLingui: () => ({
    _: (message: { id: string; message?: string }) => message.message ?? message.id,
  }),
}));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: text, i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const rpcMock = vi.hoisted(() => ({
  company: { page: vi.fn(), review: vi.fn() },
  finance: { overview: vi.fn() },
  investors: { capTable: vi.fn() },
}));
vi.mock("../lib/rpc", () => ({ rpc: rpcMock }));

import { CompanyPage } from "./Company";
import { companyFixture, companyOrganisationsPage } from "./company-fixtures";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const showAt = async (
  search: string,
  entities = companyFixture.entities,
  extra: Partial<typeof companyFixture> = {},
  reviewItems: unknown[] = [],
) => {
  rpcMock.company.page.mockResolvedValue({ ...companyFixture, entities, ...extra });
  rpcMock.company.review.mockResolvedValue({ items: reviewItems });
  rpcMock.finance.overview.mockResolvedValue(null);
  rpcMock.investors.capTable.mockResolvedValue({ snapshot: null, syncing: false });
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[`/app/company?${search}`]}>
        <CompanyPage />
      </MemoryRouter>,
    ),
  );
  await act(async () => {});
};
const remount = async (
  search: string,
  entities?: typeof companyFixture.entities,
  extra?: Partial<typeof companyFixture>,
) => {
  act(() => root.unmount());
  container.remove();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await showAt(search, entities, extra);
};
const show = (
  view: string,
  entities?: typeof companyFixture.entities,
  extra?: Partial<typeof companyFixture>,
  reviewItems?: unknown[],
) => showAt(`view=${view}`, entities, extra, reviewItems);

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.resetAllMocks();
});

it("says there are no people instead of showing bare column headers", async () => {
  await show("people", []);
  expect(container.textContent).toContain("No people yet");
  expect(container.querySelector("table")).toBeNull();
});

it("says there are no organisations", async () => {
  await show("organisations", []);
  expect(container.textContent).toContain("No organisations yet");
});

it("still lists people when there are some", async () => {
  await show("people");
  expect(container.textContent).not.toContain("No people yet");
  expect(container.querySelector("table")).not.toBeNull();
});

it("shows a past member's ended role under Past members", async () => {
  const person = companyFixture.entities.find((row) => row.id === "person")!;
  const edge = {
    ...companyFixture.edges[0]!,
    role: "CFO",
    endsOn: { date: "2025-01-01", precision: "year" as const },
  };
  await showAt("view=people", [person], { edges: [edge] });

  expect(container.querySelector("details")?.textContent).toContain("CFO");
});

it("finds a past member by the role they held", async () => {
  const person = companyFixture.entities.find((row) => row.id === "person")!;
  const edge = {
    ...companyFixture.edges[0]!,
    role: "CFO",
    endsOn: { date: "2025-01-01", precision: "year" as const },
  };
  await showAt("view=people&q=cfo", [person], { edges: [edge] });

  expect(container.querySelector("details")?.textContent).toContain("Past members");
  expect(container.querySelector("details")?.textContent).toContain("Alex Reed");
  expect(container.textContent).not.toContain("No matches");
});

it("keeps the title in the shared page header", async () => {
  await show("overview");
  expect(container.querySelector("[data-page-header] h1")?.textContent).toBe("Company");
});

it("offers Import from the empty overview", async () => {
  await show("overview", [], { events: [], latestRun: null });
  expect(container.textContent).toContain("No company facts yet");
  const links = [...container.querySelectorAll("a")].filter(
    (a) => a.getAttribute("href") === "/app/company/import" && a.textContent === "Import",
  );
  // One in the page header, one in the empty state.
  expect(links).toHaveLength(2);
});

it("shows no Import action in the empty state while an import runs", async () => {
  await show("overview", [], { events: [], latestRun: { id: "run", status: "running" } as never });
  expect(container.textContent).toContain("Import in progress");
  expect(
    [...container.querySelectorAll("a")].filter(
      (a) => a.getAttribute("href") === "/app/company/import" && a.textContent === "Import",
    ),
  ).toHaveLength(1);
});

it("links a failed import to its run", async () => {
  await show("overview", companyFixture.entities, {
    latestRun: { id: "r1", status: "failed" } as never,
  });
  const link = container.querySelector('[role="status"] a');
  expect(link?.textContent).toBe("Import failed");
  expect(link?.getAttribute("href")).toBe("/app/company/import?runId=r1");
  expect(container.textContent).not.toContain("Partial import");
});

it("shows no status line for a cancelled import", async () => {
  await show("overview", companyFixture.entities, {
    latestRun: { id: "r1", status: "cancelled" } as never,
  });
  expect(container.querySelector('[role="status"]')).toBeNull();
});

it("names the person on a Review edge card", async () => {
  const edge = companyFixture.edges[0]!;
  await show("review", companyFixture.entities, {}, [
    {
      kind: "fact",
      id: "edge:employment",
      reason: "contradiction",
      fact: { kind: "edge", record: edge },
    },
  ]);
  expect(container.textContent).toContain("Alex Reed · Engineer");
});

it("names a person who is only in Review", async () => {
  const [person] = companyFixture.entities.filter((row) => row.kind === "person");
  const edge = companyFixture.edges[0]!;
  await show("review", [], {}, [
    {
      kind: "fact",
      id: "entity:person",
      reason: "contradiction",
      fact: { kind: "entity", record: person },
    },
    {
      kind: "fact",
      id: "edge:employment",
      reason: "contradiction",
      fact: { kind: "edge", record: edge },
    },
  ]);
  expect(container.textContent).toContain("Alex Reed · Engineer");
});

it("keeps the search and sort when switching tabs", async () => {
  const [person] = companyFixture.entities.filter((row) => row.kind === "person");
  await showAt("view=people&q=ada&sort=since&dir=desc", [
    ...companyFixture.entities,
    { ...person!, id: "ada", displayName: "Ada Lovelace" } as (typeof companyFixture.entities)[0],
  ]);
  const tab = (name: string) =>
    [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
      (node) => node.textContent === name,
    );
  await act(async () => tab("Overview")?.click());
  await act(async () => tab("People")?.click());
  const search = container.querySelector<HTMLInputElement>('input[name="company-search"]');
  expect(search?.value).toBe("ada");
  const since = [...container.querySelectorAll("th")].find((th) =>
    th.textContent?.includes("Since"),
  );
  expect(since?.getAttribute("aria-sort")).toBe("descending");
});

it("lists only an organisation's relationships with the company and puts ended ones under Past relationships", async () => {
  await showAt("view=organisations", companyOrganisationsPage.entities, {
    edges: companyOrganisationsPage.edges,
  });
  const table = container.querySelector("table");
  expect(table?.textContent).toContain("Harbor Parts");
  expect(table?.textContent).toContain("Supplier");
  // A person's works_at at the vendor is not the organisation's relationship with the company.
  expect(table?.textContent).not.toContain("works at");
  expect(table?.textContent).not.toContain("Kestrel Capital");
  const past = container.querySelector("details");
  expect(past?.querySelector("summary")?.textContent).toBe("Past relationships");
  expect(past?.textContent).toContain("Kestrel Capital");
  expect(past?.textContent).toContain("Investor");
});

it("finds an organisation by the relationship it shows", async () => {
  await showAt("view=organisations&q=supplier", companyOrganisationsPage.entities, {
    edges: companyOrganisationsPage.edges,
  });
  expect(container.querySelector("table")?.textContent).toContain("Harbor Parts");
  expect(container.textContent).not.toContain("No matches");
});

it("translates an unrecognized organisation relationship label", async () => {
  const baseEdge = companyOrganisationsPage.edges.find((edge) => edge.relation === "vendor_of")!;
  const edge = { ...baseEdge, id: "works-on", relation: "works_on" as const };
  await showAt("view=organisations", companyOrganisationsPage.entities, {
    edges: [...companyOrganisationsPage.edges, edge],
  });
  expect(container.querySelector("table")?.textContent).toContain("T:works on");
});

it("finds a past organisation by the relationship it shows", async () => {
  await showAt("view=organisations&q=investor", companyOrganisationsPage.entities, {
    edges: companyOrganisationsPage.edges,
  });
  expect(container.querySelector("details")?.textContent).toContain("Kestrel Capital");
  expect(container.textContent).not.toContain("No matches");
});

it("sorts organisations by name from the header", async () => {
  const vendor = companyFixture.entities.find((row) => row.id === "vendor")!;
  const investor = { ...vendor, id: "investor", displayName: "Kestrel Capital" };
  const edge = (id: string, fromId: string, relation: CompanyEdgeRecord["relation"]) => ({
    ...companyFixture.edges[0]!,
    id,
    fromId,
    toId: "company",
    relation,
  });
  await showAt(
    "view=organisations",
    [...companyFixture.entities.filter((row) => row.kind !== "organisation"), vendor, investor],
    {
      edges: [
        ...companyFixture.edges,
        edge("vendor-of", "vendor", "vendor_of"),
        edge("invested-in", "investor", "invested_in"),
      ],
    },
  );
  const names = () =>
    [...container.querySelectorAll("tbody tr")].map(
      (row) => row.querySelector("td button")?.textContent ?? "",
    );
  expect(names()).toEqual(["Harbor Parts", "Kestrel Capital"]);
  const name = [...container.querySelectorAll("th")]
    .find((th) => th.textContent === "Name")
    ?.querySelector("button");
  await act(async () => name?.click());
  expect(names()).toEqual(["Kestrel Capital", "Harbor Parts"]);
  await act(async () => name?.click());
  expect(names()).toEqual(["Harbor Parts", "Kestrel Capital"]);
});

it("filters organisations by type and Clear filters resets it", async () => {
  const edge = companyOrganisationsPage.edges;
  await showAt("view=organisations&type=vendor", companyOrganisationsPage.entities, {
    edges: edge,
  });
  expect(container.querySelector("table")?.textContent).toContain("Harbor Parts");
  expect(container.textContent).not.toContain("Kestrel Capital");
  await remount("view=organisations&q=harbor&type=investor", companyOrganisationsPage.entities, {
    edges: edge,
  });
  expect(container.textContent).toContain("No matches");
  const clear = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Clear filters",
  );
  await act(async () => clear?.click());
  expect(container.textContent).not.toContain("No matches");
  expect(container.textContent).toContain("Harbor Parts");
  expect(container.textContent).toContain("Kestrel Capital");
});

it("drops the type filter when leaving Organisations", async () => {
  await showAt("view=organisations&type=vendor", companyOrganisationsPage.entities, {
    edges: companyOrganisationsPage.edges,
  });
  expect(container.textContent).toContain("Type: Vendor");
  const tab = (name: string) =>
    [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
      (node) => node.textContent === name,
    );
  await act(async () => tab("People")?.click());
  expect(container.textContent).toContain("Alex Reed");
  await act(async () => tab("Organisations")?.click());
  expect(container.textContent).not.toContain("Type: Vendor");
  expect(container.textContent).toContain("Harbor Parts");
  expect(container.textContent).toContain("Kestrel Capital");
});

it("does not poll while an import waits for consent, and refreshes on focus", async () => {
  vi.useFakeTimers();
  try {
    await show("overview", companyFixture.entities, {
      latestRun: { id: "run", status: "awaiting_consent" } as never,
    });
    const calls = rpcMock.company.page.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(rpcMock.company.page).toHaveBeenCalledTimes(calls);
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(rpcMock.company.page.mock.calls.length).toBeGreaterThan(calls);
  } finally {
    vi.useRealTimers();
  }
});

it("keeps polling every 4 seconds while the import runs", async () => {
  vi.useFakeTimers();
  try {
    await show("overview", companyFixture.entities, {
      latestRun: { id: "run", status: "running" } as never,
    });
    const calls = rpcMock.company.page.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(rpcMock.company.page.mock.calls.length).toBeGreaterThan(calls);
  } finally {
    vi.useRealTimers();
  }
});

it("does not poll while the tab is hidden, and polls again once it is visible", async () => {
  vi.useFakeTimers();
  const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  try {
    await show("overview", companyFixture.entities, {
      latestRun: { id: "run", status: "running" } as never,
    });
    const calls = rpcMock.company.page.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000);
    });
    expect(rpcMock.company.page).toHaveBeenCalledTimes(calls);
    visibility.mockReturnValue("visible");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(rpcMock.company.page.mock.calls.length).toBeGreaterThan(calls);
  } finally {
    visibility.mockRestore();
    vi.useRealTimers();
  }
});

it("shows 3 next dates on a phone and opens the rest in place", async () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  try {
    const [base] = companyFixture.events;
    const events = [1, 2, 3, 4, 5].map((n) => ({
      ...base!,
      id: `e${n}`,
      title: `Future date ${n}`,
      occursOn: { date: `2099-0${n}-10`, precision: "day" as const },
    }));
    await show("overview", companyFixture.entities, { events });
    expect(container.textContent).toContain("Future date 3");
    expect(container.textContent).not.toContain("Future date 4");
    const button = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "See all (5)",
    );
    await act(async () => button?.click());
    expect(container.textContent).toContain("Future date 5");
  } finally {
    vi.unstubAllGlobals();
  }
});
