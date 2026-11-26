import * as z from "zod";

/**
 * Local app control: bots operating apps on the owner's own computer
 * (docs/local-desktop-control). Shared by the adapter and the desktop bridge so
 * both refuse the same apps.
 */

/** An app as stored in a bot's allowlist. `id` is the bundle id on macOS. */
export const AppControlAppSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
});
export type AppControlApp = z.infer<typeof AppControlAppSchema>;

export const APP_CONTROL_MAX_APPS = 20;

/** The effect a person approves to let one run use one app; only the run's owner may answer it. */
export const DESKTOP_APP_USE_EFFECT_KIND = "desktop_app_use";

/** A bot's app control settings, as the owner sees them. */
export const BotAppControlSchema = z.object({
  enabled: z.boolean(),
  apps: z.array(AppControlAppSchema).max(APP_CONTROL_MAX_APPS),
  /** Real pointer and keyboard instead of accessibility actions. */
  headed: z.boolean(),
});
export type BotAppControl = z.infer<typeof BotAppControlSchema>;

export const UpdateBotAppControlSchema = z.object({
  enabled: z.boolean().optional(),
  apps: z.array(AppControlAppSchema).max(APP_CONTROL_MAX_APPS).optional(),
  headed: z.boolean().optional(),
});

export type UpdateBotAppControl = z.infer<typeof UpdateBotAppControlSchema>;

export const AppControlStatusOutputSchema = z.object({
  available: z.boolean(),
  accessibility: z.enum(["granted", "denied", "unknown"]),
  platform: z.enum(["macos", "windows", "linux"]).nullable(),
  /** True only for the deployment owner when the agent-desktop binary is known to be missing. */
  needsInstall: z.boolean().optional(),
});

/** The only keys a bot may press: unmodified navigation keys, so no paste or shortcut. */
export const APP_CONTROL_KEYS = [
  "return",
  "escape",
  "tab",
  "space",
  "up",
  "down",
  "left",
  "right",
  "pageup",
  "pagedown",
  "home",
  "end",
] as const;
export type AppControlKey = (typeof APP_CONTROL_KEYS)[number];

/**
 * Apps that can never be added, listed, read or acted on: OS security and settings,
 * password managers, anything that runs code (terminals, script tools, editors, Finder),
 * general-purpose browsers (the owner's signed-in Praci UI can be open there), and Praci.
 * Matched case-insensitively; an entry ending in "*" is a prefix.
 */
const DENIED_APP_IDS = [
  // OS security, settings, and system agents
  "com.apple.systempreferences",
  "com.apple.settings*",
  "com.apple.keychainaccess",
  "com.apple.passwords*",
  "com.apple.securityagent",
  "com.apple.loginwindow",
  "com.apple.localauthentication*",
  "com.apple.coreservices.uiagent",
  "com.apple.usernotificationcenter",
  "com.apple.installer",
  "com.apple.diskutility",
  "com.apple.softwareupdate*",
  "com.apple.appstore",
  "com.apple.migrateassistant",
  "com.apple.bootcampassistant",
  "com.apple.directoryutility",
  "com.apple.screensharing",
  "com.apple.remotedesktop*",
  // Terminals and script runners
  "com.apple.terminal",
  "com.googlecode.iterm2",
  "dev.warp.*",
  "com.mitchellh.ghostty",
  "org.alacritty",
  "net.kovidgoyal.kitty",
  "com.apple.scripteditor*",
  "com.apple.automator*",
  "com.apple.shortcuts*",
  "com.apple.finder",
  // Browsers
  "com.apple.safari*",
  "com.google.chrome*",
  "org.chromium.*",
  "org.mozilla.*",
  "com.microsoft.edgemac*",
  "company.thebrowser.*",
  "com.brave.browser*",
  "com.operasoftware.*",
  "com.vivaldi.*",
  "com.kagi.kagimacos",
  // Editors and IDEs
  "com.microsoft.vscode*",
  "com.todesktop.*",
  "com.exafunction.windsurf",
  "dev.zed.*",
  "com.apple.dt.*",
  "com.jetbrains.*",
  "com.sublimetext.*",
  "com.panic.nova",
  // Password managers
  "com.1password.*",
  "com.agilebits.*",
  "com.bitwarden.*",
  "com.lastpass.*",
  "com.dashlane.*",
  "com.keepersecurity.*",
  // Praci itself, and Electron while developing it
  "dev.rakazo.*",
  "ai.praci.*",
  "com.github.electron*",
];

const DENIED_APP_NAMES = [
  "system settings",
  "system preferences",
  "keychain access",
  "passwords",
  "securityagent",
  "loginwindow",
  "installer",
  "disk utility",
  "software update",
  "app store",
  "migration assistant",
  "screen sharing",
  "terminal",
  "iterm*",
  "warp",
  "ghostty",
  "alacritty",
  "kitty",
  "script editor",
  "automator",
  "shortcuts",
  "finder",
  "safari*",
  "google chrome*",
  "chromium",
  "firefox*",
  "microsoft edge*",
  "arc",
  "dia",
  "brave browser*",
  "opera*",
  "vivaldi",
  "orion",
  "visual studio code*",
  "code",
  "cursor",
  "windsurf",
  "zed*",
  "xcode*",
  "sublime text*",
  "nova",
  "electron",
];

/** Names containing these words are refused whatever their bundle id. */
const DENIED_NAME_WORDS = [
  "password",
  "keychain",
  "1password",
  "bitwarden",
  "lastpass",
  "dashlane",
  "keeper",
  "terminal",
  "praci",
  "rakazo",
];

function matches(pattern: string, value: string) {
  return pattern.endsWith("*") ? value.startsWith(pattern.slice(0, -1)) : value === pattern;
}

/** True when the app must never be used by app control. Unknown identity is refused. */
export function isDeniedApp(app: { id?: string | null; name?: string | null }): boolean {
  const id = app.id?.trim().toLowerCase() ?? "";
  const name = app.name?.trim().toLowerCase() ?? "";
  if (!id || !name) return true;
  if (DENIED_APP_IDS.some((pattern) => matches(pattern, id))) return true;
  if (DENIED_APP_NAMES.some((pattern) => matches(pattern, name))) return true;
  return DENIED_NAME_WORDS.some((word) => name.includes(word) || id.includes(word));
}
