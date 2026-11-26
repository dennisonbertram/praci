// @vitest-environment jsdom

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import type { CompanyReviewItem } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({
  msg: (parts: TemplateStringsArray, ...values: unknown[]) => {
    const message = parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), "");
    return { id: message, message };
  },
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { msg } from "@lingui/core/macro";
import { companyRelationLabel } from "../lib/company-relation-label";
import { CompanyReview } from "./CompanyReview";

const noop = () => undefined;
const candidate: CompanyReviewItem = {
  kind: "candidate",
  id: "candidate:review-details",
  candidate: {
    id: "review-details",
    version: "v1",
    reason: "name_only_person_candidate",
    title: "Alex Reed",
    quote: "Alex works at Northwind.",
    sourceKind: "gmail",
    details: [
      { label: "Type", value: "employment" },
      { label: "Relation", value: "works_at" },
      { label: "Future field", value: "unchanged" },
    ],
    choices: [],
    allowSeparate: false,
    editableTitle: false,
    subjects: [],
    subjectChoices: [],
  },
};

afterEach(() => {
  document.body.replaceChildren();
});

it("translates known detail labels and relation values, preserving unknown labels and other values", async () => {
  i18n.loadAndActivate({
    locale: "test",
    messages: {
      [msg`Type`.id]: "Translated type",
      [msg`Relation`.id]: "Translated relation label",
    },
  });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <CompanyReview items={[candidate]} onOpen={noop} onChanged={noop} />
      </I18nProvider>,
    ),
  );

  const text = container.textContent ?? "";
  expect(text).toContain("Translated type");
  expect(text).toContain("Translated relation label");
  expect(text).toContain("Future field");
  expect(text).toContain(companyRelationLabel("works_at"));
  expect(text).toContain("employment");
  expect(text).not.toContain("works_at");

  await act(async () => root.unmount());
  container.remove();
});
