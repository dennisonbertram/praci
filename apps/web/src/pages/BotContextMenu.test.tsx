// @vitest-environment jsdom

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: (parts: TemplateStringsArray) => parts.join("") }),
}));

import { BotContextMenu } from "./BotContextMenu";

i18n.loadAndActivate({ locale: "en", messages: {} });
const noop = () => undefined;

async function menuText(props: { isGroup?: boolean; onRoutines?: () => void }) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <BotContextMenu
          bot={{ name: "Chief", pinned: false, sectionId: null, unread: false }}
          position={{ x: 0, y: 0 }}
          sections={[]}
          onClose={noop}
          onTogglePinned={noop}
          onMoveToSection={noop}
          onCreateSection={noop}
          onToggleUnread={noop}
          onEdit={noop}
          onDuplicate={noop}
          onClear={noop}
          onArchive={noop}
          onDelete={noop}
          {...props}
        />
      </I18nProvider>,
    ),
  );
  const items = [...document.querySelectorAll("[role='menuitem']")].map((n) => n.textContent);
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  return items;
}

it("offers Routines for a bot and names the group panel Group settings", async () => {
  const bot = await menuText({ onRoutines: noop });
  expect(bot).toContain("Routines");
  expect(bot).toContain("Edit profile");

  const group = await menuText({ isGroup: true, onRoutines: noop });
  expect(group).not.toContain("Routines");
  expect(group).not.toContain("Edit profile");
  expect(group).toContain("Group settings");
});
