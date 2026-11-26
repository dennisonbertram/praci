// @vitest-environment jsdom

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const text = vi.hoisted(() => (parts: TemplateStringsArray, ...values: unknown[]) => {
  const message = parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), "");
  return message === "works at" ? `T:${message}` : message;
});
vi.mock("@lingui/core/macro", () => ({ t: text, plural: () => "" }));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: text, i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const rpcMock = vi.hoisted(() => ({
  company: { editEvent: vi.fn(), editEdge: vi.fn() },
}));
vi.mock("../lib/rpc", () => ({ rpc: rpcMock }));

import { CompanyFactDetail } from "./CompanyFactDetail";
import { companyFixture } from "./company-fixtures";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const event = {
  ...companyFixture.events[0]!,
  id: "11111111-1111-4111-8111-111111111111",
  title: "Seed round",
  occursOn: { date: "2026-03-01", precision: "month" as const },
  endsOn: null,
  amountCents: null,
  currency: null,
};
const edge = {
  ...companyFixture.edges[0]!,
  startsOn: { date: "2024-01-01", precision: "year" as const },
  endsOn: null,
};

const open = async (fact: Parameters<typeof CompanyFactDetail>[0]["fact"]) => {
  rpcMock.company.editEvent.mockResolvedValue({});
  rpcMock.company.editEdge.mockResolvedValue({});
  await act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <CompanyFactDetail fact={fact} onClose={() => {}} onChanged={() => {}} initialEditing />
      </I18nProvider>,
    ),
  );
};
const field = (label: string) => {
  const span = [...document.body.querySelectorAll("label span")].find(
    (s) => s.textContent === label,
  );
  return span?.parentElement?.querySelector("input") as HTMLInputElement;
};
const type = async (input: HTMLInputElement, value: string) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
const save = async () =>
  act(async () => {
    document.body.querySelector("form")!.requestSubmit();
  });

beforeEach(() => {
  i18n.load("en", {});
  i18n.activate("en");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.resetAllMocks();
});

it("sends only the date the user changed", async () => {
  await open({ kind: "event", record: event });
  expect(field("Date").value).toBe("2026-03-01");
  await type(field("Date"), "2026-04-02");
  await save();
  expect(rpcMock.company.editEvent).toHaveBeenCalledWith({
    eventId: event.id,
    occursOn: { date: "2026-04-02", precision: "day" },
  });
});

it("formats displayed event amounts as currency", async () => {
  await open({ kind: "event", record: { ...event, amountCents: 123450, currency: "USD" } });
  expect(document.body.textContent).toContain("$1,234.50");
});

it("sends only the title when only the title changed", async () => {
  await open({ kind: "event", record: event });
  await type(field("Name"), "Series A");
  await save();
  expect(rpcMock.company.editEvent).toHaveBeenCalledWith({
    eventId: event.id,
    title: "Series A",
  });
});

it("rejects an end date before the start date without calling the server", async () => {
  await open({ kind: "event", record: event });
  await type(field("End date"), "2026-02-01");
  await save();
  expect(rpcMock.company.editEvent).not.toHaveBeenCalled();
  expect(document.body.querySelector("[role=alert]")?.textContent).toBe(
    "End date is before the start date.",
  );
});

it("sends only a changed amount in cents, without currency", async () => {
  await open({
    kind: "event",
    record: { ...event, amountCents: 250000, currency: "USD" },
  });
  await type(field("Amount"), "1234.5");
  await save();
  expect(rpcMock.company.editEvent).toHaveBeenCalledWith({
    eventId: event.id,
    amountCents: 123450,
  });
});

it("edits an edge start date", async () => {
  await open({ kind: "edge", record: edge });
  await type(field("Start date"), "2024-02-10");
  await save();
  expect(rpcMock.company.editEdge).toHaveBeenCalledWith({
    edgeId: edge.id,
    startsOn: { date: "2024-02-10", precision: "day" },
  });
});

it("translates an edge heading and role over time label", async () => {
  const person = companyFixture.entities.find((entity) => entity.id === "person")!;
  const relation = { ...companyFixture.edges[0]!, role: null };
  await open({
    kind: "entity",
    record: { ...person, edges: [relation] },
  });
  expect(document.body.querySelector("[role=dialog] h2")?.textContent).toBe("Alex Reed");
  expect(document.body.querySelector("h3")?.textContent).toBe("Roles over time");
  expect(document.body.textContent).toContain("works at · 2024");

  await open({ kind: "edge", record: relation });
  expect(document.body.querySelector("[role=dialog] h2")?.textContent).toBe("T:works at");
});
