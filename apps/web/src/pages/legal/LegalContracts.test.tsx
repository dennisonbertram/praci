// @vitest-environment jsdom
import type { LegalContract } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text, plural: (n: number) => String(n) }));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: text, i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { contracts } from "./fixtures";
import { LegalContracts } from "./LegalContracts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const lapsed = {
  ...(contracts[0] as LegalContract),
  id: "lapsed",
  title: "Lapsed Agreement",
  status: "active",
  autoRenews: false,
  expirationDate: "2020-01-01",
} as LegalContract;

const render = (list: LegalContract[], url = "/legal") => {
  const el = document.createElement("div");
  document.body.append(el);
  act(() =>
    createRoot(el).render(
      <MemoryRouter initialEntries={[url]}>
        <LegalContracts contracts={list} />
      </MemoryRouter>,
    ),
  );
  return el;
};

it("shows the Expired chip on a lapsed non-renewing contract", () => {
  expect(render([lapsed]).textContent).toContain("Expired");
});

it("offers Draft only when a draft contract exists or Draft is selected", () => {
  const draft = { ...lapsed, id: "d", status: "draft" } as LegalContract;
  const options = (el: HTMLElement) => {
    act(() => {
      for (const b of el.querySelectorAll("button")) {
        if (b.textContent?.startsWith("Status")) b.click();
      }
    });
    return document.body.textContent ?? "";
  };
  expect(options(render([lapsed]))).not.toContain("Draft");
  expect(options(render([draft]))).toContain("Draft");
});
