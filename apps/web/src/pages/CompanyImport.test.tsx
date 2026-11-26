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
vi.mock("@lingui/core/macro", () => ({ t: text, plural: () => "" }));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: text, i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const rpcMock = vi.hoisted(() => ({
  companyImport: {
    catalog: vi.fn(),
    session: vi.fn(),
    subscribe: vi.fn(),
    consentStatus: vi.fn(),
    sample: vi.fn(),
    create: vi.fn(),
  },
}));
vi.mock("../lib/rpc", () => ({ rpc: rpcMock }));

import type { CompanyImportCatalog, CompanyImportSession } from "@rakazo/contracts";

import { CompanyImportPage } from "./CompanyImport";
import { importCatalog, importConsent, importSession } from "./company-import-fixtures";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

async function show(session: unknown = null, catalog: CompanyImportCatalog = importCatalog) {
  rpcMock.companyImport.catalog.mockResolvedValue(catalog);
  rpcMock.companyImport.session.mockResolvedValue(session);
  rpcMock.companyImport.consentStatus.mockResolvedValue(importConsent);
  rpcMock.companyImport.sample.mockResolvedValue([]);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/app/company/import"]}>
        <CompanyImportPage onOpenSettings={() => {}} />
      </MemoryRouter>,
    ),
  );
  await act(async () => {});
}

const namesOutsideDetails = () =>
  [...container.querySelectorAll("span.font-medium")]
    .filter((element) => !element.closest("details"))
    .map((element) => element.textContent);

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.resetAllMocks();
  vi.useRealTimers();
});

it("keeps usable and connectable sources first and folds the rest into one closed disclosure", async () => {
  await show();

  // Data room can be imported and Gmail only needs a connection, so both stay in the open list.
  expect(namesOutsideDetails()).toEqual(["Data room", "Gmail"]);

  const details = container.querySelector("details")!;
  expect(details).not.toBeNull();
  expect(details.open).toBe(false);
  expect(details.querySelector("summary")!.textContent).toBe("Not available (1)");
  expect(details.textContent).toContain("Slack");

  // The Connect link is the fix for Gmail, so it stays visible rather than behind the disclosure.
  const connect = container.querySelector<HTMLAnchorElement>(
    'a[href*="returnTo=%2Fapp%2Fcompany%2Fimport"]',
  );
  expect(connect).not.toBeNull();
  expect(connect!.closest("details")).toBeNull();
});

const sessionWith = (
  status: string,
  plan?: Partial<NonNullable<CompanyImportSession["sources"][number]["plan"]>>,
) => {
  const session = structuredClone(importSession);
  session.progress.status = status;
  if (plan) session.sources[0]!.plan = { ...session.sources[0]!.plan, ...plan };
  return session;
};
const textWith = (needle: string) => container.textContent!.includes(needle);

it("says nothing about a cost it cannot know and shows no status badge before the sample", async () => {
  await show(sessionWith("draft"));

  // The budget-cap basis carries no information: 0 to the cap is not an estimate.
  expect(container.textContent).not.toMatch(/Token estimate/);
  expect(container.textContent).not.toMatch(/Cap-limited/);
  expect(textWith("Token cap: 1,000,000")).toBe(true);
  const badge = [...container.querySelectorAll("span,div")].find(
    (element) => element.children.length === 0 && element.textContent?.trim() === "Review",
  );
  expect(badge).toBeUndefined();
});

it("reads token counts with thousands separators once a run starts", async () => {
  await show(sessionWith("running"));

  expect(container.textContent).toMatch(/Tokens\s*0\/1,000,000/);
});

it("shows when import progress polling fails and clears the alert after a successful poll", async () => {
  vi.useFakeTimers();
  const session = sessionWith("running");
  rpcMock.companyImport.subscribe.mockRejectedValue(new TypeError("Failed to fetch"));
  await show(session);
  rpcMock.companyImport.session
    .mockRejectedValueOnce(new TypeError("Failed to fetch"))
    .mockResolvedValueOnce(session);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(4000);
  });

  expect(container.querySelector('[role="alert"]')?.textContent).toBe("Could not reach the server");

  await act(async () => {
    await vi.advanceTimersByTimeAsync(4000);
  });

  expect(container.querySelector('[role="alert"]')).toBeNull();
});

it("keeps unfinished source progress below full and marks a completed source full", async () => {
  const session = sessionWith("running");
  session.progress.sources[0]!.status = "reading";
  session.progress.sources[0]!.itemsDiscovered = 10;
  session.progress.sources[0]!.itemsRead = 10;
  await show(session);

  let bar = container.querySelector<HTMLElement>('[role="progressbar"]')!;
  expect(Number(bar.getAttribute("aria-valuenow"))).toBeLessThan(
    Number(bar.getAttribute("aria-valuemax")),
  );
  expect(
    parseFloat(bar.firstElementChild!.getAttribute("style")!.match(/[0-9.]+/)![0]!),
  ).toBeLessThan(100);
  expect(container.textContent).toContain("Read 10/10");

  session.progress.sources[0]!.status = "completed";
  await show(session);
  bar = container.querySelector<HTMLElement>('[role="progressbar"]')!;
  expect(bar.getAttribute("aria-valuenow")).toBe(bar.getAttribute("aria-valuemax"));
  expect(bar.firstElementChild!.getAttribute("style")).toContain("100%");
});

it("shows a sample-based estimate without saying where it came from", async () => {
  await show(sessionWith("draft", { tokensLower: 100, tokensUpper: 400, estimateBasis: "sample" }));

  expect(textWith("Token estimate: 100–400")).toBe(true);
  expect(container.textContent).not.toMatch(/From sample/);
});

// Gmail's catalog default differs from the stored scope on purpose: going back must keep the
// scope the draft already has, never reset it to the catalog default.
const backCatalog: CompanyImportCatalog = {
  sources: [
    {
      key: "gmail-connection",
      sourceKind: "gmail",
      connectionId: "gmail-connection",
      label: "Gmail",
      available: true,
      reason: null,
      itemCount: 120,
      defaultScope: { after: "2023-10-21" },
      connectPath: null,
    },
    {
      key: "slack-connection",
      sourceKind: "slack",
      connectionId: "slack-connection",
      label: "Slack",
      available: true,
      reason: null,
      itemCount: 300,
      defaultScope: {},
      connectPath: null,
    },
    {
      key: "notion-gone",
      sourceKind: "notion",
      connectionId: "notion-gone",
      label: "Notion",
      available: false,
      reason: "unsupported",
      itemCount: null,
      defaultScope: {},
      connectPath: null,
    },
  ],
  folders: [],
};

const draftWithSources = (sourceKinds: ("gmail" | "slack" | "notion")[]) => {
  const session = structuredClone(importSession);
  session.progress.tokenCap = 250_000;
  const scopes: Record<string, Record<string, unknown>> = {
    gmail: { after: "2021-01-01", labelIds: ["IMPORTANT"] },
    slack: { channelIds: ["C1"] },
    notion: { reader: "notion" },
  };
  const connections: Record<string, string> = {
    gmail: "gmail-connection",
    slack: "slack-connection",
    notion: "notion-gone",
  };
  session.sources = sourceKinds.map((sourceKind) => ({
    connectionId: connections[sourceKind]!,
    id: `source-${sourceKind}`,
    label: sourceKind === "gmail" ? "Gmail" : sourceKind === "slack" ? "Slack" : "Notion",
    plan: { estimateBasis: "budget_cap", itemCount: 10, tokensLower: 0, tokensUpper: 250_000 },
    scope: scopes[sourceKind]!,
    sourceKind,
  }));
  session.progress.sources = session.sources.map((source) => ({
    factsFound: 0,
    id: source.id,
    inputTokensUsed: 0,
    itemsDiscovered: 0,
    itemsRead: 0,
    lastError: null,
    outputTokensUsed: 0,
    reservedTokens: 0,
    sourceKind: source.sourceKind,
    status: "waiting",
    units: 1,
  }));
  return session;
};

const buttonNamed = (name: string) =>
  [...container.querySelectorAll("button")].find((button) => button.textContent?.trim() === name) ??
  null;

const click = async (element: Element | null) => {
  expect(element).not.toBeNull();
  await act(async () => {
    element!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
};

const checked = (label: string) => {
  const input = container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
  if (input) return input.checked;
  return (
    container.querySelector(`[aria-label="${label}"]`)?.getAttribute("aria-checked") === "true"
  );
};

it("goes back to the source form with the draft's scopes and cap, and reviews them again", async () => {
  await show(draftWithSources(["gmail", "slack"]), backCatalog);

  await click(buttonNamed("Back to sources"));

  expect(container.querySelector("form")).not.toBeNull();
  const cap = container.querySelector<HTMLInputElement>("#company-import-token-cap");
  expect(cap?.value).toBe("250000");
  expect(checked("Gmail")).toBe(true);
  expect(checked("Slack")).toBe(true);

  await click(buttonNamed("Review"));

  expect(rpcMock.companyImport.create).toHaveBeenCalledWith({
    mode: "sample",
    sources: [
      {
        connectionId: "gmail-connection",
        mcpServerId: undefined,
        scope: { after: "2021-01-01", labelIds: ["IMPORTANT"] },
        sourceKind: "gmail",
      },
      {
        connectionId: "slack-connection",
        mcpServerId: undefined,
        scope: { channelIds: ["C1"] },
        sourceKind: "slack",
      },
    ],
    tokenCap: 250_000,
  });
});

it("leaves a source the user unticks off the new draft", async () => {
  await show(draftWithSources(["gmail", "slack"]), backCatalog);

  await click(buttonNamed("Back to sources"));
  await click(container.querySelector('[aria-label="Slack"]'));
  await click(buttonNamed("Review"));

  const payload = rpcMock.companyImport.create.mock.calls[0]![0] as {
    sources: { sourceKind: string }[];
  };
  expect(payload.sources.map((source) => source.sourceKind)).toEqual(["gmail"]);
});

it("drops a stored source that has no available catalog entry", async () => {
  await show(draftWithSources(["gmail", "slack", "notion"]), backCatalog);

  await click(buttonNamed("Back to sources"));
  await click(buttonNamed("Review"));

  const payload = rpcMock.companyImport.create.mock.calls[0]![0] as {
    sources: { sourceKind: string }[];
  };
  expect(payload.sources.map((source) => source.sourceKind)).toEqual(["gmail", "slack"]);
});

it("offers no way back once the import has started", async () => {
  for (const status of ["running", "preview_ready", "paused", "completed"]) {
    await show(sessionWith(status));
    expect(buttonNamed("Back to sources")).toBeNull();
    act(() => root.unmount());
    root = createRoot(container);
  }
});
