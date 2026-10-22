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
