// @vitest-environment jsdom

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@rakazo/ui-web", () => {
  const Box = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    Button: (props: React.ComponentProps<"button">) => <button type="button" {...props} />,
    Dialog: ({ children }: { children?: React.ReactNode }) => <div role="dialog">{children}</div>,
    DialogBody: Box,
    DialogContent: Box,
    DialogFooter: Box,
    DialogHeader: Box,
    DialogTitle: Box,
  };
});
vi.mock("../lib/user-error", () => ({ errorText: (e: Error) => e.message }));
const bots = vi.hoisted(() => ({
  instructionsUpgrade: vi.fn(),
  upgradeInstructions: vi.fn(),
  dismissInstructionsUpgrade: vi.fn(),
}));
vi.mock("../lib/rpc", () => ({ rpc: { bots } }));

import { InstructionsUpgradeNotice } from "./InstructionsUpgradeNotice";

i18n.loadAndActivate({ locale: "en", messages: {} });

const text = (container: HTMLElement) =>
  `${container.textContent ?? ""} ${[...container.querySelectorAll("textarea")].map((t) => t.value).join(" ")}`.trim();
const click = (container: HTMLElement, label: string) =>
  [...container.querySelectorAll("button")].find((b) => b.textContent === label)?.click();

async function mount(onUpgraded = vi.fn()) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <InstructionsUpgradeNotice botId="b1" instructions="mine" onUpgraded={onUpgraded} />
      </I18nProvider>,
    ),
  );
  return { container, onUpgraded };
}

it("shows nothing without an offer", async () => {
  bots.instructionsUpgrade.mockResolvedValue(null);
  const { container } = await mount();
  expect(text(container)).toBe("");
});

it("reviews both texts and upgrades", async () => {
  bots.instructionsUpgrade.mockResolvedValue({ current: "mine", next: "default" });
  bots.upgradeInstructions.mockResolvedValue({ id: "b1", instructions: "default" });
  const { container, onUpgraded } = await mount();
  expect(text(container)).toContain("Upgrade this agent's system prompt?");
  await act(async () => click(container, "Review"));
  expect(text(container)).toContain("mine");
  expect(text(container)).toContain("default");
  await act(async () => click(container, "Upgrade"));
  expect(bots.upgradeInstructions).toHaveBeenCalledWith({ botId: "b1", from: "mine" });
  expect(onUpgraded).toHaveBeenCalledWith({ id: "b1", instructions: "default" });
  expect(text(container)).toBe("");
});

it("keeps the text and hides the notice on Keep mine", async () => {
  bots.instructionsUpgrade.mockResolvedValue({ current: "mine", next: "default" });
  bots.dismissInstructionsUpgrade.mockResolvedValue({ ok: true });
  const { container } = await mount();
  await act(async () => click(container, "Review"));
  await act(async () => click(container, "Keep mine"));
  expect(bots.dismissInstructionsUpgrade).toHaveBeenCalledWith({ botId: "b1" });
  expect(text(container)).toBe("");
});

it("shows the error and refetches on a conflict", async () => {
  bots.instructionsUpgrade.mockResolvedValue({ current: "mine", next: "default" });
  bots.upgradeInstructions.mockRejectedValue(new Error("The instructions changed"));
  const { container } = await mount();
  bots.instructionsUpgrade.mockClear();
  await act(async () => click(container, "Review"));
  await act(async () => click(container, "Upgrade"));
  expect(text(container)).toContain("The instructions changed");
  expect(bots.instructionsUpgrade).toHaveBeenCalled();
});
