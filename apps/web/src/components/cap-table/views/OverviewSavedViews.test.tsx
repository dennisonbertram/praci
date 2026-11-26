// @vitest-environment jsdom

import type { ComponentProps, ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useSearchParams } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));
vi.mock("@rakazo/ui-web", () => ({
  Button: ({
    variant: _v,
    size: _s,
    ...props
  }: ComponentProps<"button"> & { variant?: string; size?: string }) => <button {...props} />,
  Input: (props: ComponentProps<"input">) => <input {...props} />,
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
    disabled,
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

const rpcMock = vi.hoisted(() => ({ savedViews: { list: vi.fn(), create: vi.fn() } }));
vi.mock("../../../lib/rpc", () => ({ rpc: { equity: rpcMock } }));

import { OverviewSavedViews } from "./OverviewSavedViews";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const at = "2026-01-01T00:00:00.000Z";
const page = (items: unknown[]) => ({ items, total: items.length, page: 1, pageSize: 500 });

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.clearAllMocks();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  rpcMock.savedViews.list.mockResolvedValue(page([]));
});
afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  host.remove();
});

const Query = () => {
  const [params] = useSearchParams();
  return <output data-testid="query">{params.toString()}</output>;
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const click = async (element: Element | undefined) => {
  await act(async () => {
    element?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
  });
};
const byText = (selector: string, label: string) =>
  [...host.querySelectorAll(selector)].find((element) => element.textContent === label);

it("lists only overview views and applies the saved params", async () => {
  rpcMock.savedViews.list.mockResolvedValue(
    page([
      {
        id: "v1",
        page: "overview",
        name: "By stakeholder, outstanding",
        params: "view=stakeholder&fd=0",
        createdAt: at,
        updatedAt: at,
      },
      {
        id: "v2",
        page: "stakeholders",
        name: "Investors",
        params: "rel=investor",
        createdAt: at,
        updatedAt: at,
      },
    ]),
  );
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={["/app/cap-table"]}>
        <OverviewSavedViews />
        <Query />
      </MemoryRouter>,
    );
    await settle();
  });
  expect(rpcMock.savedViews.list).toHaveBeenCalledWith({
    pageSize: 500,
    sort: { field: "name", dir: "asc" },
  });
  expect(byText("button", "Investors")).toBeUndefined();
  await click(byText("button", "By stakeholder, outstanding"));
  expect(host.querySelector('[data-testid="query"]')?.textContent).toBe("view=stakeholder&fd=0");
});

it("saves the current params under the typed name", async () => {
  rpcMock.savedViews.create.mockResolvedValue({
    id: "v3",
    page: "overview",
    name: "Board",
    params: "view=stakeholder&fd=0",
    createdAt: at,
    updatedAt: at,
  });
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={["/app/cap-table?view=stakeholder&fd=0"]}>
        <OverviewSavedViews />
      </MemoryRouter>,
    );
    await settle();
  });
  await click(byText("button", "Save view"));
  const input = host.querySelector<HTMLInputElement>('input[aria-label="View name"]')!;
  expect(input).not.toBeNull();
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, "Board");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
  });
  await click(byText("button", "Save"));
  expect(rpcMock.savedViews.create).toHaveBeenCalledWith({
    page: "overview",
    name: "Board",
    params: "view=stakeholder&fd=0",
  });
  expect(rpcMock.savedViews.list).toHaveBeenCalledTimes(2);
});

it("shows a failed save inline", async () => {
  rpcMock.savedViews.create.mockRejectedValue(new Error("The name is already taken."));
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={["/app/cap-table"]}>
        <OverviewSavedViews />
      </MemoryRouter>,
    );
    await settle();
  });
  await click(byText("button", "Save view"));
  const input = host.querySelector<HTMLInputElement>('input[aria-label="View name"]')!;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, "Board");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
  });
  await click(byText("button", "Save"));
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
});
