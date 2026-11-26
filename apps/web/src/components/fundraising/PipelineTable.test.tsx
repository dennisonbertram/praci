// @vitest-environment jsdom
import type { Contact } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { todayDay } from "../../lib/day-input";
import { resetHideAmountsMemory, setHideAmounts } from "../../lib/hide-amounts-preference";
import type { RowEdits } from "../../lib/pipeline-rows";
import { dayLabel } from "./PipelineControls";
import { PipelineTable } from "./PipelineTable";
import { manyProspects, prospect, SAMPLE_PROSPECTS } from "./pipeline-fixtures";

vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let el: HTMLDivElement;
let phone = false;
beforeEach(() => {
  phone = false;
  vi.stubGlobal("matchMedia", () => ({
    matches: phone,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  el = document.createElement("div");
  document.body.append(el);
});
afterEach(() => {
  el.remove();
  vi.unstubAllGlobals();
});

const noop = () => {};
const edits: RowEdits = {
  status: noop,
  interest: noop,
  nextStep: noop,
  nextCall: noop,
  amount: noop,
  referrer: noop,
  createReferrer: noop,
  log: noop,
  undoAuto: noop,
};
let search = "";
function Where() {
  search = useLocation().search;
  return null;
}
const render = (prospects: Contact[], url = "/", openMercury = noop, rowEdits = edits) =>
  act(async () =>
    createRoot(el).render(
      <MemoryRouter initialEntries={[url]}>
        <Where />
        <PipelineTable
          prospects={prospects}
          contacts={[]}
          edits={rowEdits}
          onSendSafe={noop}
          onOpenMercury={openMercury}
          onNotSent={noop}
          onEdit={noop}
        />
      </MemoryRouter>,
    ),
  );
const names = () =>
  [...el.querySelectorAll("[data-testid=pipeline-table] [data-row-open]")].map(
    (n) => n.textContent,
  );
const click = (node: Element | null | undefined) => act(async () => (node as HTMLElement)?.click());
const button = (label: string) =>
  [...el.querySelectorAll("button")].find((b) => b.textContent?.trim() === label);

it("reads its filters from the link, and Clear filters on No matches empties them", async () => {
  await render(SAMPLE_PROSPECTS, "/?interest=in");
  expect(names()).toEqual(["Placeholder Partners", "Mock Valley Seed", "Oak Example Angels"]);
  await render(SAMPLE_PROSPECTS, "/?status=diligence");
  expect(el.textContent).toContain("No matches");
  await click(button("Clear filters"));
  expect(search).toBe("");
  expect(names().length).toBeGreaterThan(0);
});

it("Due now lists overdue and today together, oldest first, and shows its count", async () => {
  await render(SAMPLE_PROSPECTS);
  expect(button("Due now · 3")).toBeDefined();
  await click(button("Due now · 3"));
  expect(search).toBe("?due=1");
  expect(names()).toEqual([
    "Sample Street Capital",
    "Example Peak Ventures",
    "Placeholder Partners",
  ]);
});

it("Filter counts the active filters and keeps Due now outside them", async () => {
  await render(SAMPLE_PROSPECTS, "/?interest=in&due=1");
  expect(button("Filter · 1")).toBeDefined();
});

it("shows a word beside an overdue date and a dash for blanks", async () => {
  await render(SAMPLE_PROSPECTS);
  const first = el.querySelector("[data-testid=pipeline-table] tbody tr");
  expect(first?.textContent).toContain("Overdue");
  expect(el.querySelector("[data-testid=pipeline-table]")?.textContent).toContain("—");
});

it("caps a long list at ten rows on desktop with See all", async () => {
  await render(manyProspects(30));
  expect(names().length).toBe(10);
  await click(button("See all (30)"));
  expect(names().length).toBe(30);
});

it("caps the phone list at six rows", async () => {
  phone = true;
  await render(manyProspects(30));
  expect(el.querySelectorAll("[data-testid=pipeline-list] li").length).toBe(6);
});

it("opens a waiting row's menu and chooses an item without opening the row sheet", async () => {
  const openMercury = vi.fn();
  await render(SAMPLE_PROSPECTS, "/", openMercury);
  await click(el.querySelector('button[aria-label="Actions for Oak Example Angels"]'));
  expect(document.querySelector("[role=dialog]")).toBeNull();
  // The menu's items render in a portal as divs, so an unguarded click would reach the row's onOpen.
  const item = [...document.querySelectorAll<HTMLElement>("[role=menuitem]")].find(
    (n) => n.textContent === "Open Mercury",
  );
  await click(item);
  expect(openMercury).toHaveBeenCalled();
  expect(document.querySelector("[role=dialog]")).toBeNull();
});

it("opens the row sheet with Log call as its primary action, and Send SAFE on a Committed row", async () => {
  await render(SAMPLE_PROSPECTS);
  await click(el.querySelector("[data-testid=row-p5] [data-row-open]"));
  const labels = [...document.querySelectorAll("[role=dialog] button")].map((b) =>
    b.textContent?.trim(),
  );
  expect(labels.at(-1)).toBe("Log call");
  expect(labels).toContain("Send SAFE");
});

it("opens the sheet named by ?record= even past the cap", async () => {
  await render(manyProspects(12), "/?record=m10");
  expect(el.querySelector("[data-testid=row-m10]")).not.toBeNull();
  const dialogs = [...document.querySelectorAll("[role=dialog]")].map((d) => d.textContent);
  expect(dialogs.some((text) => text?.includes("Lantern Ventures 11"))).toBe(true);
});

it("closing a deep-linked sheet removes record from the URL", async () => {
  await render(SAMPLE_PROSPECTS, "/?record=p1&q=sample");
  expect(document.querySelector("[role=dialog]")).not.toBeNull();
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await new Promise((done) => setTimeout(done, 20));
  });
  expect(document.querySelector("[role=dialog]")).toBeNull();
  expect(search).toBe("?q=sample");
});

it("opens a record from a link naming its second person", async () => {
  const firm = prospect("lead", "Harbor Fund", {
    people: [
      { id: "lead", name: "Lead Partner" },
      { id: "second", name: "Second Partner" },
    ],
  });
  await render([firm], "/?record=second");
  const dialogs = [...document.querySelectorAll("[role=dialog]")].map((d) => d.textContent);
  expect(dialogs.some((text) => text?.includes("Harbor Fund"))).toBe(true);
  expect(search).toBe("?record=second");
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await new Promise((done) => setTimeout(done, 20));
  });
});

it("opens nothing for an unknown ?record= and removes it", async () => {
  await render(SAMPLE_PROSPECTS, "/?record=nobody");
  expect(document.querySelector("[role=dialog]")).toBeNull();
  expect(search).toBe("");
});

it("shows an imported row's Wave, Fund details and Referred by", async () => {
  localStorage.setItem("rakazo:crm-pipeline-columns", JSON.stringify(["referredBy", "details"]));
  // As `getFundraisingOverview` returns a row from a list import, a firm with no person included.
  const imported = (id: string, name: string, wave: string) =>
    prospect(id, name, {
      group: wave,
      referredBy: { id: "c-sam", name: "Sam Example" },
      details: [
        {
          label: "Stage and check",
          value: "Seed lead, $250K-$500K",
          source: "list",
          at: "2026-11-05T00:00:00.000Z",
        },
      ],
    });
  await render(
    [imported("i1", "Peak Fund", "Wave 2"), imported("i2", "Riverside Fund", "Wave 3")],
    "/?wave=Wave%202",
  );
  expect(names()).toEqual(["Peak Fund"]);
  const row = el.querySelector("[data-testid=pipeline-table] tbody tr");
  expect(row?.textContent).toContain("Sam Example");
  expect(row?.textContent).toContain("Stage and check: Seed lead, $250K-$500K");
  localStorage.removeItem("rakazo:crm-pipeline-columns");
});

it("offers Log on every desktop row, beside Send SAFE and the waiting menu", async () => {
  await render(SAMPLE_PROSPECTS);
  const logOf = (name: string) => `button[aria-label="Log a call with ${name}"]`;
  const committed = el.querySelector("[data-testid=row-p5]");
  expect(committed?.querySelector(logOf("Mock Valley Seed"))).not.toBeNull();
  expect(committed?.textContent).toContain("Send SAFE");
  const waiting = el.querySelector("[data-testid=row-p6]");
  expect(waiting?.querySelector(logOf("Oak Example Angels"))).not.toBeNull();
  expect(
    waiting?.querySelector('button[aria-label="Actions for Oak Example Angels"]'),
  ).not.toBeNull();
});

it("gives the action column room for Log beside Send SAFE or the waiting menu", async () => {
  await render(SAMPLE_PROSPECTS);
  const table = el.querySelector("[data-testid=pipeline-table]");
  const head = [...(table?.querySelectorAll("thead th") ?? [])].at(-1);
  expect(head?.className).toContain("w-40");
  // Every row's last cell carries the same width, so a fixed layout cannot squeeze it.
  for (const row of table?.querySelectorAll("tbody tr") ?? []) {
    expect(row.querySelector("td:last-child")?.className).toContain("w-40");
  }
});

it("keeps the search in the link, and Clear filters empties it", async () => {
  await render(SAMPLE_PROSPECTS);
  const input = el.querySelector('input[name="pipeline-search"]') as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(input, "oak");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(search).toBe("?q=oak");
  await render(SAMPLE_PROSPECTS, "/?q=oak");
  expect(names()).toEqual(["Oak Example Angels"]);
  await render(SAMPLE_PROSPECTS, "/?q=nobody");
  await click(button("Clear filters"));
  expect(search).toBe("");
});

it("Due now from another sort puts the oldest first, and stays pressed when nothing is due", async () => {
  await render(SAMPLE_PROSPECTS, "/?sort=name&dir=asc");
  await click(button("Due now · 3"));
  expect(search).toBe("?due=1");
  expect(names()).toEqual([
    "Sample Street Capital",
    "Example Peak Ventures",
    "Placeholder Partners",
  ]);
  await render(SAMPLE_PROSPECTS, "/?due=1&status=passed");
  const pressed = [...el.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === "Due now · 0",
  );
  expect(pressed?.getAttribute("aria-pressed")).toBe("true");
});

const unpriced = () => prospect("u1", "Unpriced Ventures", { status: "committed" });
const addAmount = () =>
  [...el.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Add amount");
const sheetOpen = () => document.querySelector('[data-slot="sheet-content"]');
const amountEditor = () => document.querySelector('[data-slot="popover-content"]');

it("shows a muted Add amount under the badge of a Committed row with no amount, and nowhere else", async () => {
  await render([...SAMPLE_PROSPECTS, unpriced()]);
  const prompt = addAmount();
  expect(prompt).toBeDefined();
  const row = el.querySelector("[data-testid=row-u1]");
  expect(row?.contains(prompt ?? null)).toBe(true);
  // Under the status badge: the prompt shares the badge's cell.
  const badge = row?.querySelector('button[aria-label^="Status of Unpriced Ventures"]');
  expect(badge?.closest("td")).toBe(prompt?.closest("td"));
  // Muted, like the waiting or people line under a row's name.
  expect(prompt?.firstElementChild?.className).toContain("text-muted-foreground");
  // No other row has it: other statuses lack the prompt, and Committed rows with an amount too.
  const withPrompt = [...el.querySelectorAll("[data-testid=pipeline-table] tbody tr")].filter((r) =>
    r.textContent?.includes("Add amount"),
  );
  expect(withPrompt.length).toBe(1);
});

it("opens the row's amount editor from Add amount without opening the row, and a saved amount removes the prompt", async () => {
  const amount = vi.fn();
  await render([unpriced()], "/", noop, { ...edits, amount });
  await click(addAmount());
  // The same small editor the Possible amount column uses, not the row's sheet.
  expect(sheetOpen()).toBeNull();
  const editor = amountEditor();
  expect(editor).not.toBeNull();
  expect(
    editor?.querySelector('input[aria-label="Possible amount of Unpriced Ventures"]'),
  ).not.toBeNull();
  // Even a click on the editor itself, rendered outside the row, must not open the row.
  await click(editor?.querySelector("form")?.parentElement);
  expect(sheetOpen()).toBeNull();
  const input = editor?.querySelector("input");
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
      input,
      "750000",
    );
    input?.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click(
    [...(editor?.querySelectorAll("button") ?? [])].find((b) => b.textContent === "Save"),
  );
  expect(amount).toHaveBeenCalledWith(expect.objectContaining({ id: "u1" }), "750000");
  // Once the row has an amount, the prompt is gone.
  await render([
    prospect("u1", "Unpriced Ventures", { status: "committed" }, { checkSizeCents: 75_000_000 }),
  ]);
  expect(addAmount()).toBeUndefined();
});

it("does not offer Add amount while amounts are hidden", async () => {
  await render([unpriced()]);
  expect(addAmount()).toBeDefined();
  setHideAmounts(true);
  try {
    await render([unpriced()]);
    expect(addAmount()).toBeUndefined();
  } finally {
    resetHideAmountsMemory();
  }
});

it("shows a hidden Possible amount as plain text, never an editor", async () => {
  localStorage.setItem("rakazo:crm-pipeline-columns", JSON.stringify(["amount"]));
  setHideAmounts(true);
  try {
    await render(SAMPLE_PROSPECTS);
    expect(el.querySelector('button[aria-label="Possible amount of Mock Valley Seed"]')).toBeNull();
    expect(el.querySelector("[data-testid=pipeline-table]")?.textContent).not.toContain("500,000");
    expect(el.querySelector("[data-testid=pipeline-table]")?.textContent).toContain("$•••");
  } finally {
    resetHideAmountsMemory();
    localStorage.removeItem("rakazo:crm-pipeline-columns");
  }
});

it("shows an empty Interest cell for a row nobody has contacted yet", async () => {
  await render([
    prospect("nc1", "Cold Example", { status: "not_reached" }),
    prospect("nc2", "Warm Example", { status: "reached_out" }),
  ]);
  const cold = el.querySelector("[data-testid=row-nc1]");
  expect(cold?.querySelector("[role=group]")).toBeNull();
  expect(cold?.querySelectorAll("td")[2]?.textContent?.trim()).toBe("");
  const warm = el.querySelector("[data-testid=row-nc2]");
  expect(warm?.querySelector("[role=group]")).not.toBeNull();
  expect(warm?.textContent).toContain("Unknown");
});

it("renders Last contact like the Last call day and sorts by it, blanks last", async () => {
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
  const prospects = [
    prospect("lc1", "Alpha Example", { status: "reached_out", lastContactAt: daysAgo(2) }),
    prospect("lc2", "Beta Example", { status: "reached_out" }),
    prospect("lc3", "Gamma Example", { status: "reached_out", lastContactAt: daysAgo(5) }),
  ];
  await render(prospects, "/?sort=lastContact&dir=asc");
  const heads = [...el.querySelectorAll("[data-testid=pipeline-table] thead th")].map(
    (n) => n.textContent,
  );
  expect(heads).toContain("Last contact");
  expect(names()).toEqual(["Gamma Example", "Alpha Example", "Beta Example"]);
  const alpha = el.querySelector("[data-testid=row-lc1]");
  expect(alpha?.textContent).toContain(dayLabel(todayDay(new Date(daysAgo(2)))));
  await render(prospects, "/?sort=lastContact&dir=desc");
  expect(names()).toEqual(["Alpha Example", "Gamma Example", "Beta Example"]);
});
