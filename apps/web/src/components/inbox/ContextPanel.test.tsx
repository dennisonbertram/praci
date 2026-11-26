// @vitest-environment jsdom

import type { InboxPersonContext } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, i) => text + part + String(values[i] ?? ""), ""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const personContext = vi.fn();
const personSummary = vi.fn();
vi.mock("../../lib/rpc", () => ({
  rpc: {
    inbox: {
      personContext: (input: unknown) => personContext(input),
      personSummary: (input: unknown) => personSummary(input),
    },
  },
}));

import { ContextPanel } from "./ContextPanel";

const facts = (extra: Partial<InboxPersonContext> = {}): InboxPersonContext => ({
  email: "kevin@acme.example.test",
  name: "Kevin Zhao",
  organization: "Acme Capital",
  kind: "investor",
  contactId: "c1",
  lastEmailedAt: "2026-01-05T10:00:00.000Z",
  threadCount: 1,
  threads: [{ id: "m1", subject: "Term sheet", receivedAt: "2026-01-05T10:00:00.000Z" }],
  lastMeeting: null,
  nextMeeting: { title: "Board call", start: "2999-01-01T10:00:00.000Z", href: null },
  documents: [{ id: "d1", name: "Term sheet.pdf" }],
  todos: [{ id: "t1", text: "Send cap table", dueOn: null }],
  ...extra,
});

let root: ReturnType<typeof createRoot>;
const show = (people: Array<{ email: string; name?: string }>) =>
  act(async () =>
    root.render(
      <MemoryRouter>
        <ContextPanel people={people} />
      </MemoryRouter>,
    ),
  );
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  personContext.mockReset();
  personSummary.mockReset();
  root = createRoot(document.body.appendChild(document.createElement("div")));
});
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
});

it("shows the facts as rows that link to their sources, then the summary", async () => {
  personContext.mockResolvedValue(facts());
  personSummary.mockResolvedValue({ status: "ok", summary: "Kevin leads Acme's round." });
  await show([{ email: "kevin@acme.example.test", name: "Kevin Zhao" }]);
  const text = document.body.textContent ?? "";
  expect(text).toContain("Acme Capital · Investor");
  expect(text).toContain("Board call");
  expect(text).toContain("Send cap table");
  expect(text).toContain("Kevin leads Acme's round.");
  const hrefs = [...document.querySelectorAll("a")].map((a) => a.getAttribute("href"));
  expect(hrefs).toEqual(["/app/contacts/c1", "/app/inbox?mail=m1", "/app/data-room?item=d1"]);
});

it("shows the facts while the summary is still on its way", async () => {
  personContext.mockResolvedValue(facts());
  personSummary.mockReturnValue(new Promise(() => {}));
  await show([{ email: "kevin@acme.example.test" }]);
  expect(document.body.textContent).toContain("Summarizing");
  expect(document.body.textContent).toContain("Term sheet.pdf");
});

it("shows only the facts when there is no summary or the model call fails", async () => {
  personContext.mockResolvedValue(facts());
  personSummary.mockResolvedValue({ status: "needs_consent", recipient: { key: "k", name: "n" } });
  await show([{ email: "kevin@acme.example.test" }]);
  expect(document.body.textContent).not.toContain("Summarizing");
  expect(document.body.textContent).toContain("Term sheet.pdf");
  personSummary.mockRejectedValue(new Error("down"));
  await show([{ email: "other@acme.example.test" }]);
  expect(document.body.textContent).toContain("Term sheet.pdf");
});

it("asks for no summary and says so in one line when nothing is known", async () => {
  personContext.mockResolvedValue(
    facts({
      name: null,
      kind: null,
      organization: null,
      threadCount: 0,
      threads: [],
      nextMeeting: null,
      documents: [],
      todos: [],
    }),
  );
  await show([{ email: "new@example.test" }]);
  expect(document.body.textContent).toContain("No context yet");
  expect(personSummary).not.toHaveBeenCalled();
});

it("says so in one line when the facts cannot load", async () => {
  personContext.mockRejectedValue(new Error("down"));
  await show([{ email: "kevin@acme.example.test" }]);
  expect(document.body.textContent).toContain("No context yet");
});

it("gives each person a section, with only the first loaded until another is opened", async () => {
  personContext.mockImplementation(async ({ email }: { email: string }) => facts({ email }));
  personSummary.mockResolvedValue({ status: "unavailable" });
  await show([{ email: "a@example.test", name: "Ann" }, { email: "b@example.test" }]);
  expect(personContext).toHaveBeenCalledTimes(1);
  expect(personContext).toHaveBeenCalledWith({ email: "a@example.test" });
  const headers = [...document.querySelectorAll<HTMLElement>("section > button")];
  expect(headers.map((h) => h.textContent)).toEqual(["AAnna@example.test", "Bb@example.test"]);
  expect(headers.map((h) => h.getAttribute("aria-expanded"))).toEqual(["true", "false"]);
  await act(async () => headers[1]?.click());
  expect(personContext).toHaveBeenCalledWith({ email: "b@example.test" });
});

it("says so in one line when there is nobody to show", async () => {
  await show([]);
  expect(document.body.textContent).toBe("No context yet");
});
