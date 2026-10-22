// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";

const update = vi.hoisted(() => vi.fn());
vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...v: unknown[]) =>
    parts.reduce((acc, part, i) => acc + part + (v[i] ?? ""), ""),
  plural: (n: number) => String(n),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../../lib/rpc", () => ({ rpc: { legal: { updateDeadline: update } } }));

import type { LegalDeadline } from "@rakazo/contracts";
import { LegalDeadlines } from "./LegalDeadlines";

it("shows the Undo line at once, before the request settles", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  update.mockReturnValue(new Promise(() => undefined));
  const deadline = {
    id: "d1",
    title: "Renewal notice",
    dueDate: "2030-01-01",
    contractTitle: null,
    dataRoomItemId: null,
    sourceQuote: null,
  } as unknown as LegalDeadline;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <LegalDeadlines deadlines={[deadline]} onChanged={() => undefined} today="2029-12-01" />
      </MemoryRouter>,
    ),
  );
  const done = [...container.querySelectorAll("button")].find((b) => b.textContent === "Done");
  await act(async () => done?.click());
  expect(container.textContent).toContain("Undo");
});

const mk = (id: string) =>
  ({
    id,
    title: `Notice ${id}`,
    dueDate: "2030-01-01",
    contractTitle: null,
    dataRoomItemId: null,
    sourceQuote: null,
  }) as unknown as LegalDeadline;

async function mount(deadlines: LegalDeadline[]) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  await act(async () =>
    createRoot(container).render(
      <MemoryRouter>
        <LegalDeadlines deadlines={deadlines} onChanged={() => undefined} today="2029-12-01" />
      </MemoryRouter>,
    ),
  );
  return container;
}
const click = (c: HTMLElement, label: string, nth = 0) =>
  act(async () =>
    [...c.querySelectorAll("button")].filter((b) => b.textContent === label)[nth]?.click(),
  );

it("sends Undo only after the close request has finished", async () => {
  let finishClose: () => void = () => undefined;
  update.mockReset();
  update.mockReturnValueOnce(new Promise<void>((r) => (finishClose = r)));
  update.mockResolvedValue(undefined);
  const container = await mount([mk("a")]);
  await click(container, "Done");
  await click(container, "Undo");
  expect(update).toHaveBeenCalledTimes(1);
  await act(async () => finishClose());
  expect(update).toHaveBeenLastCalledWith({ id: "a", status: "open" });
});

it("keeps another row's Undo when an earlier close fails", async () => {
  let failA: (e: Error) => void = () => undefined;
  update.mockReset();
  update.mockReturnValueOnce(new Promise((_, rej) => (failA = rej)));
  update.mockResolvedValueOnce(undefined);
  const container = await mount([mk("a"), mk("b")]);
  await click(container, "Done", 0);
  await click(container, "Done", 0);
  await act(async () => failA(new Error("nope")));
  expect(container.textContent).toContain("Notice b");
  expect(container.textContent).toContain("Undo");
});

it("offers Keep on a deadline a scan proposed removing, and Keep clears the proposal", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  update.mockResolvedValue(null);
  const deadline = {
    id: "d9",
    title: "Send non-renewal notice",
    dueDate: "2030-01-01",
    contractTitle: null,
    dataRoomItemId: null,
    sourceQuote: null,
    removalProposed: true,
  } as unknown as LegalDeadline;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <LegalDeadlines deadlines={[deadline]} onChanged={() => undefined} today="2029-12-01" />
      </MemoryRouter>,
    ),
  );
  expect(container.textContent).toContain("The last scan thinks this no longer applies.");
  const keep = [...container.querySelectorAll("button")].find((b) => b.textContent === "Keep");
  await act(async () => keep?.click());
  expect(update).toHaveBeenCalledWith({ id: "d9", keep: true });
});
