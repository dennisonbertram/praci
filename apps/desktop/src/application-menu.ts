import type { MenuItemConstructorOptions } from "electron";

export function buildApplicationMenuTemplate(
  platform: NodeJS.Platform,
  appName: string,
  handlers: {
    openLocalSettings: () => void;
    changeServer: () => void;
    stopLocalStack: () => void;
  },
): MenuItemConstructorOptions[] {
  const localSettings: MenuItemConstructorOptions = {
    id: "local-server-settings",
    label: "Local Server Settings…",
    accelerator: "CmdOrCtrl+,",
    click: () => {
      handlers.openLocalSettings();
    },
  };
  const changeServer: MenuItemConstructorOptions = {
    id: "change-rakazo-server",
    label: "Change Praci Server…",
    accelerator: "CmdOrCtrl+Shift+K",
    click: () => handlers.changeServer(),
  };
  const stopStack: MenuItemConstructorOptions = {
    id: "stop-local-stack",
    label: "Stop Local Stack",
    // The stack keeps running after quit (bots are always on); this is the explicit off switch.
    click: () => {
      handlers.stopLocalStack();
    },
  };
  const template: MenuItemConstructorOptions[] =
    platform === "darwin"
      ? [
          {
            label: appName,
            submenu: [
              { role: "about" },
              { type: "separator" },
              localSettings,
              changeServer,
              stopStack,
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
          { role: "editMenu" },
          { role: "windowMenu" },
        ]
      : [
          {
            label: "File",
            submenu: [
              localSettings,
              changeServer,
              stopStack,
              { type: "separator" },
              { role: "quit" },
            ],
          },
          { role: "editMenu" },
          { role: "windowMenu" },
        ];
  return template;
}
