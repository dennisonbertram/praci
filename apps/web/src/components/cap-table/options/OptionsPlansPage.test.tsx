// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { demoOptionGrant } from "./option-grant-fixture";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));
const get = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/rpc", () => ({ rpc: { equity: { optionGrants: { get } } } }));
vi.mock("./OptionGrantsTable", () => ({ OptionGrantsTable: () => <p>grants</p> }));
vi.mock("./OptionGrantRecord", () => ({
  OptionGrantRecord: ({ grant }: { grant: { label: string } }) => <p data-record={grant.label} />,
}));

import { OptionsPlansPage } from "./OptionsPlansPage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: ReturnType<typeof createRoot> | null = null;
afterEach(async () => {
  if (root)
    await act(async () => {
      root?.unmount();
    });
  root = null;
});

it("opens the grant a link from another tab names", async () => {
  get.mockResolvedValue(demoOptionGrant({ label: "ES-23" }));
  const container = document.createElement("div");
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={["/app/cap-table/plans/grants?grant=g-23"]}>
        <OptionsPlansPage />
      </MemoryRouter>,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(get).toHaveBeenCalledWith({ id: "g-23" });
  expect(container.querySelector("[data-record]")?.getAttribute("data-record")).toBe("ES-23");
});
