// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));
vi.mock("./SharesLedger", () => ({ SharesLedger: () => <p>shares ledger</p> }));
vi.mock("./SecurityRecord", () => ({
  SecurityRecord: ({ kind, id }: { kind: string; id: string }) => (
    <p data-record={`${kind}:${id}`} />
  ),
}));

import { SecuritiesTab } from "./SecuritiesTab";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: ReturnType<typeof createRoot> | null = null;
afterEach(async () => {
  if (root)
    await act(async () => {
      root?.unmount();
    });
  root = null;
});

async function renderAt(path: string) {
  const container = document.createElement("div");
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={[path]}>
        <SecuritiesTab />
      </MemoryRouter>,
    );
  });
  return container;
}

it("opens the certificate a holder's holdings link to", async () => {
  const container = await renderAt("/app/cap-table/securities?certificate=cert-1");
  expect(container.querySelector("[data-record]")?.getAttribute("data-record")).toBe(
    "certificate:cert-1",
  );
});

it("opens no record without a link", async () => {
  const container = await renderAt("/app/cap-table/securities");
  expect(container.querySelector("[data-record]")).toBeNull();
});
