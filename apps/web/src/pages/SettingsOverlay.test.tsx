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

it("shows the Updates tab only when there is something to update", async () => {
  expect(await navIds({})).not.toContain("settings-nav-updates");
  expect(await navIds({ isDeploymentOwner: true })).toContain("settings-nav-updates");
  updates.desktop = true;
  expect(await navIds({})).toContain("settings-nav-updates");
});

it("lists Privacy and approvals as its own tab", async () => {
  expect(await navIds({})).toContain("settings-nav-privacy");
});
