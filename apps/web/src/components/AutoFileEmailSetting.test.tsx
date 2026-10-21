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
const models = vi.hoisted(() => ({ autoFileEmail: vi.fn(), setAutoFileEmail: vi.fn() }));
vi.mock("../lib/rpc", () => ({ rpc: { models } }));

import { AutoFileEmailSetting } from "./AutoFileEmailSetting";

it("saves the setting that adds email attachments to the Data room", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  models.autoFileEmail.mockResolvedValue({ enabled: true });
  models.setAutoFileEmail.mockImplementation(async ({ enabled }) => ({ enabled }));
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<AutoFileEmailSetting />));
  await act(async () => {});
  const box = container.querySelector<HTMLElement>("[role=switch]");
  expect(box?.getAttribute("aria-checked")).toBe("true");
  await act(async () => box?.click());
  expect(models.setAutoFileEmail).toHaveBeenCalledWith({ enabled: false });
  expect(box?.getAttribute("aria-checked")).toBe("false");
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
