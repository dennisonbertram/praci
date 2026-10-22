// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: (strings: TemplateStringsArray) => strings[0] }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@rakazo/ui-web", () => ({
  Button: (props: React.ComponentProps<"button">) => <button type="button" {...props} />,
  Label: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Switch: ({
    checked,
    onCheckedChange,
    ...props
  }: {
    checked: boolean;
    onCheckedChange?: (checked: boolean) => void;
  } & React.ComponentProps<"button">) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    />
  ),
}));
vi.mock("../lib/user-error", () => ({ errorText: () => "Something went wrong" }));
const api = vi.hoisted(() => ({
  list: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("../lib/rpc", () => ({
  rpc: {
    approvalRules: { list: api.list, set: api.set, remove: api.remove },
  },
}));

import { ApprovalRulesSettings } from "./ApprovalRulesSettings";

const emailRule = {
  id: "rule_1",
  effect: "require_approval",
  matchKind: "category",
  matchValue: "email",
  createdAt: "2026-01-01T00:00:00.000Z",
};
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const email = () => container.querySelector<HTMLElement>("[data-testid=approval-preset-email]");

async function mount(rules: unknown[]) {
  api.list.mockResolvedValue(rules);
  await act(async () => root.render(<ApprovalRulesSettings />));
  await act(async () => {});
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.resetAllMocks();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it("shows each preset as a switch that matches the saved rules", async () => {
  await mount([emailRule]);
  expect(email()?.getAttribute("aria-checked")).toBe("true");
  expect(
    container.querySelector("[data-testid=approval-preset-purchase]")?.getAttribute("aria-checked"),
  ).toBe("false");
  expect(container.querySelector("ul")).toBeNull();
});

it("adds the rule when switched on and removes it when switched off", async () => {
  api.set.mockResolvedValue(emailRule);
  api.remove.mockResolvedValue({});
  await mount([]);
  await act(async () => email()?.click());
  expect(api.set).toHaveBeenCalledWith({
    effect: "require_approval",
    matchKind: "category",
    matchValue: "email",
  });
  expect(email()?.getAttribute("aria-checked")).toBe("true");
  await act(async () => email()?.click());
  expect(api.remove).toHaveBeenCalledWith({ id: "rule_1" });
  expect(email()?.getAttribute("aria-checked")).toBe("false");
});
