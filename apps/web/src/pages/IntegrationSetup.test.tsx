// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: text }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../lib/rpc", () => ({
  rpc: {
    bots: { list: async () => [{ id: "b1", name: "Chief" }] },
    integrationSetup: {
      get: async () => ({ canConfigure: true, providers: [], webUrl: "http://web.test" }),
    },
  },
}));

import { IntegrationSetupPage } from "./IntegrationSetup";

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

it("goes back to the page that opened it, not to Chief", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  await act(async () => {
    createRoot(container).render(
      <MemoryRouter initialEntries={["/integrations/setup?next=%2Fapp%2Fintegrations"]}>
        <Routes>
          <Route path="/integrations/setup" element={<IntegrationSetupPage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
  });
  await act(async () => {});
  for (const label of ["Back", "Skip"]) {
    expect([...container.querySelectorAll("button")].some((b) => b.textContent === label)).toBe(
      true,
    );
  }
  await act(async () => {
    [...container.querySelectorAll("button")].find((b) => b.textContent === "Skip")?.click();
  });
  expect(container.querySelector("[data-testid=where]")?.textContent).toBe("/app/integrations");
});
