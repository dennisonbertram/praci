// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { accountsFixture } from "./fixtures";

const accounts = vi.hoisted(() => vi.fn());
vi.mock("../../lib/rpc", () => ({ rpc: { brexCards: { accounts } } }));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@lingui/core/macro", () => ({
  t: String.raw,
  plural: (count: number, forms: { one: string; other: string }) =>
    (count === 1 ? forms.one : forms.other).replaceAll("#", String(count)),
}));

import { BrexAccounts } from "./BrexAccounts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
});

it("statements have one Download in Brex link and no link on each row", async () => {
  accounts.mockResolvedValue(accountsFixture);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <BrexAccounts />
      </MemoryRouter>,
    ),
  );
  await vi.waitFor(() => expect(container.textContent).toContain("Statements"));
  expect(accountsFixture.statements.length).toBeGreaterThanOrEqual(2);
  const links = [...container.querySelectorAll("a")];
  expect(links.filter((a) => a.textContent?.includes("Open in Brex"))).toHaveLength(0);
  const download = links.filter((a) => a.textContent?.includes("Download in Brex"));
  expect(download).toHaveLength(1);
  expect(download[0]?.href).toBe("https://dashboard.brex.com/statements-and-documents");
});
