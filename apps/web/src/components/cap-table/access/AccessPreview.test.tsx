// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));
const get = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/rpc", () => ({ rpc: { equity: { accessView: { get } } } }));
vi.mock("../../../lib/portal", () => ({ requestPortalAccess: vi.fn() }));

import { AccessPreview } from "./AccessPreview";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  get.mockReset().mockImplementation(async (input: { level?: string }) =>
    input.level === "none"
      ? { level: "none" }
      : {
          level: input.level ?? "restricted",
          fairMarketValue: null,
          personal: {
            stakeholderId: "s3",
            name: "Casey Placeholder",
            holdings: [
              {
                kind: "option",
                label: "ES-3",
                shareClassName: "Common",
                quantity: "40000",
                principalCents: null,
                issueDate: "2024-02-01",
              },
            ],
          },
        },
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

it("shows the holder's own level, then the level picked, without the request control", async () => {
  await act(async () =>
    root.render(
      <AccessPreview stakeholderId="s3" name="Casey" open onOpenChange={() => undefined} />,
    ),
  );
  expect(get).toHaveBeenCalledWith({ stakeholderId: "s3" });
  expect(document.body.textContent).toContain("ES-3");
  expect(document.querySelector('[aria-label="Request access"]')).toBeNull();
  const select = document.querySelector('[aria-label="Level"]') as HTMLSelectElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(
      select,
      "none",
    );
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(get).toHaveBeenLastCalledWith({ stakeholderId: "s3", level: "none" });
  expect(document.body.textContent).toContain("No access");
});
