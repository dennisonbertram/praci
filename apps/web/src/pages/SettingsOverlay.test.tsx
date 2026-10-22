// @vitest-environment jsdom

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: (parts: TemplateStringsArray) => parts.join("") }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const updates = vi.hoisted(() => ({ desktop: false }));
vi.mock("../components/DesktopUpdates", () => ({ useHasDesktopUpdates: () => updates.desktop }));
vi.mock("./AccountSettingsOverlay", () => ({
  ComputerSettingsPanel: () => null,
  GeneralSettingsPanels: () => null,
  UpdatesSettingsPanel: () => null,
  UsageSettingsPanel: () => null,
}));
vi.mock("./BillingSettingsPanel", () => ({ BillingSettingsPanel: () => null }));
vi.mock("./MemorySettingsOverlay", () => ({ MemorySettingsOverlay: () => null }));
vi.mock("./ModelSettingsOverlay", () => ({ ModelSettingsOverlay: () => null }));
vi.mock("./VoiceSettingsOverlay", () => ({ VoiceSettingsOverlay: () => null }));

import { SettingsOverlay } from "./SettingsOverlay";

i18n.loadAndActivate({ locale: "en", messages: {} });

async function navIds(props: { isDeploymentOwner?: boolean }) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <SettingsOverlay
          name="Demo"
          onUsageOpen={() => undefined}
          avatarStyle="robot"
          onAvatarStyleChange={async () => undefined}
          memoryConfig={null}
          onMemoryConfigChange={() => undefined}
          onClose={() => undefined}
          {...props}
        />
      </I18nProvider>,
    ),
  );
  const ids = [...document.querySelectorAll("[data-testid^='settings-nav-']")].map((node) =>
    node.getAttribute("data-testid"),
  );
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  return ids;
}

it("has no Usage or Updates tab: both live in General", async () => {
  updates.desktop = true;
  const ids = await navIds({ isDeploymentOwner: true });
  expect(ids).not.toContain("settings-nav-usage");
  expect(ids).not.toContain("settings-nav-updates");
  updates.desktop = false;
});

it("marks the dialog modal and gives phones a select instead of a clipped strip", async () => {
  await navIds({});
  // navIds unmounts, so render again and inspect while open.
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <SettingsOverlay
          name="Demo"
          onUsageOpen={() => undefined}
          avatarStyle="robot"
          onAvatarStyleChange={async () => undefined}
          memoryConfig={null}
          onMemoryConfigChange={() => undefined}
          onClose={() => undefined}
        />
      </I18nProvider>,
    ),
  );
  expect(document.querySelector("[data-testid=user-settings]")?.getAttribute("aria-modal")).toBe(
    "true",
  );
  expect(document.querySelector("select[data-testid=settings-nav-select]")).not.toBeNull();
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it("lists Privacy and approvals as its own tab", async () => {
  expect(await navIds({})).toContain("settings-nav-privacy");
});

it("folds Voice into Models: no Voice entry in the settings nav", async () => {
  const ids = await navIds({});
  expect(ids).toContain("settings-nav-models");
  expect(ids).not.toContain("settings-nav-voice");
});

it("keeps one dialog height for every section and locks the app behind it while open", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const app = document.createElement("div");
  app.id = "root";
  const trigger = document.createElement("button");
  trigger.setAttribute("data-testid", "user-menu-trigger");
  app.append(trigger);
  document.body.append(app);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const show = (open: boolean) =>
    act(async () =>
      root.render(
        <I18nProvider i18n={i18n}>
          {open ? (
            <SettingsOverlay
              name="Demo"
              onUsageOpen={() => undefined}
              avatarStyle="robot"
              onAvatarStyleChange={async () => undefined}
              memoryConfig={null}
              onMemoryConfigChange={() => undefined}
              onClose={() => undefined}
            />
          ) : null}
        </I18nProvider>,
      ),
    );
  await show(true);
  const panel = () => document.querySelector("[data-testid=user-settings]");
  const general = panel()?.className;
  expect(general).toContain("h-[min(760px");
  expect(app.hasAttribute("inert")).toBe(true);
  const advanced = document.querySelector<HTMLElement>("nav button[aria-expanded=false]");
  expect(document.querySelector("[data-testid=settings-nav-memory]")).toBeNull();
  await act(async () => advanced?.click());
  expect(advanced?.getAttribute("aria-expanded")).toBe("true");
  await act(async () =>
    (document.querySelector("[data-testid=settings-nav-memory]") as HTMLElement).click(),
  );
  expect(panel()?.className).toBe(general);
  await show(false);
  expect(app.hasAttribute("inert")).toBe(false);
  await act(async () => root.unmount());
  container.remove();
  app.remove();
  vi.unstubAllGlobals();
});

it("closes on Escape at once even when the voice status refresh is slow", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const onClose = vi.fn();
  await act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <SettingsOverlay
          name="Demo"
          onUsageOpen={() => undefined}
          avatarStyle="robot"
          onAvatarStyleChange={async () => undefined}
          memoryConfig={null}
          onMemoryConfigChange={() => undefined}
          onVoiceStatusMaybeChanged={() => new Promise<void>(() => undefined)}
          onClose={onClose}
        />
      </I18nProvider>,
    ),
  );
  await act(async () => {
    document
      .querySelector("[data-testid=user-settings]")
      ?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
  expect(onClose).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
