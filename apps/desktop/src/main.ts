import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DesktopReachability, DesktopSetup } from "@rakazo/contracts";
import { isScannerFolderPath } from "@rakazo/contracts";
import { LOCAL_SETTINGS_PAGE } from "@rakazo/contracts/local-settings";
import type { Session } from "electron";
import {
  app,
  BrowserWindow,
  desktopCapturer,
  dialog,
  ipcMain,
  Menu,
  net,
  session,
  shell,
} from "electron";
import { startAppControlBridge } from "./app-control-bridge.js";
import type { AppDocumentState } from "./app-document-state.js";
import { APP_DOCUMENT_STATE_SCRIPT } from "./app-document-state.js";
import { createAppOpener } from "./app-opener.js";
import { buildApplicationMenuTemplate } from "./application-menu.js";
import type { ElectronAutoUpdater } from "./auto-update.js";
import { DesktopUpdateController, LAUNCH_CHECK_DELAY_MS } from "./auto-update.js";
import {
  createBluetoothPicker,
  createPairingHandler,
  originKeyedStore,
} from "./bluetooth-picker.js";
import { openBrowserAuth } from "./browser-auth.js";
import { createDeviceSpeech } from "./device-speech.js";
import { DOCKER_INSTALL_LINKS, isDesktopSetupLink, runDocker } from "./docker-cli.js";
import { createHexRunner, findHex } from "./hex-bridge.js";
import { requestLocalSettings } from "./local-settings.js";
import {
  LocalStackController,
  readStackImages,
  readStackToken,
  readStackWebUrl,
  resolveImageTag,
  stackDir,
  stackResourceDir,
} from "./local-stack.js";
import { oauthCallbackFrom } from "./oauth-callback.js";
import {
  bundledRendererCandidates,
  bundledRendererHeaders,
  forwardedRendererRequestInit,
  isRendererAssetMiss,
} from "./renderer-assets.js";
import type { ScannerScope, ScannerService } from "./scanner.js";
import { createScanner } from "./scanner.js";
import { scannerIpcAuthorized } from "./scanner-security.js";
import {
  createScannerScopeCoordinator,
  isScannerSessionCookie,
  verifyScannerSessionScope,
} from "./scanner-session.js";
import { installSessionPermissions, isAppWebContents } from "./session-permissions.js";
import {
  DEFAULT_LOCAL_WEB_URL,
  desktopStackImageTag,
  isRakazoHealth,
  managedLocalOpenUrl,
  maySendDesktopStackToken,
  normalizeServerUrl,
  parseSetupInput,
  probeFailureMessage,
  readProbeJson,
  resolveStartupTarget,
  safeExternalUrl,
  servesBundledRenderer,
  sessionPartitionForServerUrl,
} from "./setup-config.js";
import { clearSetup, readSetup, writeSetup } from "./setup-store.js";
import { userDataPath } from "./user-data.js";
import {
  mainWindowNavigation,
  oauthPopupSessionPreferences,
  shouldOpenInAppPopup,
} from "./window-open.js";
import {
  browserWindowOptions,
  developmentIconFile,
  restrictWebRtc,
  setupWindowOptions,
  warmWindowTtlMs,
} from "./window-options.js";

const PERFORMANCE_USER_DATA = process.env.RAKAZO_PERFORMANCE_USER_DATA;
/** Test hook: where the app-managed stack answers. Mode `new` still requires loopback. */
const LOCAL_WEB_URL = process.env.RAKAZO_LOCAL_WEB_URL?.trim() || DEFAULT_LOCAL_WEB_URL;
const PROBE_TIMEOUT_MS = 8_000;
const DESKTOP_STACK_PROBE_PATH = "/.well-known/rakazo-desktop-stack";
const DESKTOP_STACK_TOKEN_HEADER = "x-rakazo-desktop-stack-token";
let mainWindow: BrowserWindow | null = null;
let scannerService: ScannerService | null = null;
const appWindowTargets = new WeakMap<BrowserWindow, string>();
let setupWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let openingSettings = false;
let settingsCleanup: Promise<void> = Promise.resolve();
let settingsTarget: { origin: string; token: string } | null = null;
const bundledRendererInstallations = new Set<string>();
let currentSetup: DesktopSetup | null = null;
let applicationMenuInstalled = false;

/** The only writer of `currentSetup`, so the menu always reflects the connected server. */
function setCurrentSetup(next: DesktopSetup | null) {
  currentSetup = next;
  if (applicationMenuInstalled) installApplicationMenu();
}
let currentTargetUrl: string | null = null;
let setupError: string | null = null;
let setupSaveInProgress = false;
const scannerScopeCoordinator = createScannerScopeCoordinator<BrowserWindow>({
  currentWindow: () => mainWindow,
  originForWindow: (win) => {
    if (win !== mainWindow || win.isDestroyed()) return null;
    const origin = trustedScannerOrigin();
    return origin !== null && safeOrigin(win.webContents.mainFrame.url) === origin ? origin : null;
  },
  clearScope: () => scannerService?.setScope(null) ?? Promise.resolve(),
  verifyScope: (win, origin, claim, isCurrent) => {
    const targetSession = win.webContents.session;
    return verifyScannerSessionScope({
      origin,
      userId: claim.userId,
      spaceId: claim.spaceId,
      fetch: (input, init) => targetSession.fetch(input, init),
      isCurrent: () =>
        isCurrent() && !win.isDestroyed() && win.webContents.session === targetSession,
    });
  },
  setScope: (claim, origin) => scannerService?.setScope(claim, origin) ?? Promise.resolve(),
});
const appOpener = createAppOpener(openAppOnce);
/** Prior app window kept until setup is persisted (or the switch is abandoned). */
let pendingPreviousWindow: BrowserWindow | null = null;
let quitting = false;
let warmWindowTimer: NodeJS.Timeout | undefined;
// Number of short-lived hidden probe windows currently alive. On Windows/Linux,
// destroying the last window fires "window-all-closed" -> app.quit(); a probe
// that runs before the first real window exists must not count as "all closed".
let liveProbeWindows = 0;
const WARM_WINDOW_TTL_MS = warmWindowTtlMs(process.env.RAKAZO_WARM_WINDOW_TTL_MS);

const updaterEnvironment = {
  packaged: app.isPackaged,
  version: app.getVersion(),
  disabled: process.env.RAKAZO_DISABLE_AUTO_UPDATE === "1",
};
const desktopUpdater = new DesktopUpdateController(
  updaterEnvironment,
  async () => {
    const module = await import("electron-updater");
    return (module.default ?? module).autoUpdater as unknown as ElectronAutoUpdater;
  },
  undefined,
  () => {
    quitting = false;
  },
);
let launchUpdateCheckScheduled = false;
let localStack: LocalStackController;

markOnce("rk:main:module-evaluated");
if (PERFORMANCE_USER_DATA) {
  app.setPath("userData", PERFORMANCE_USER_DATA);
  app.setPath("sessionData", path.join(PERFORMANCE_USER_DATA, "session"));
} else {
  // The display name is Praci, but existing installs keep data under the old directory.
  app.setPath("userData", userDataPath(app.getPath("appData")));
}
app.once("will-finish-launching", () => markOnce("rk:main:will-finish-launching"));
app.once("ready", () => markOnce("rk:main:ready"));
// Includes fresh partitions and popup-created sessions, before they load remote content.
const displayCapture = {
  platform: process.platform,
  getSources: desktopCapturer.getSources.bind(desktopCapturer),
};
app.on("session-created", (value) =>
  installSessionPermissions(value, permissionTarget, displayCapture),
);

function permissionTarget() {
  if (mainWindow === null || mainWindow.isDestroyed()) return null;
  const url = appWindowTargets.get(mainWindow);
  return url === undefined ? null : { webContents: mainWindow.webContents, url };
}

const bluetoothPickers = new WeakMap<BrowserWindow, ReturnType<typeof createBluetoothPicker>>();

function installBluetooth(win: BrowserWindow) {
  const origin = safeOrigin(appWindowTargets.get(win) ?? "");
  const file = path.join(app.getPath("userData"), "bluetooth-device.json");
  const store = originKeyedStore(
    () => {
      try {
        const all = JSON.parse(readFileSync(file, "utf8"));
        return all !== null && typeof all === "object" ? all : {};
      } catch {
        return {};
      }
    },
    (all) => {
      try {
        writeFileSync(file, JSON.stringify(all));
      } catch {
        // Not remembering the device only means the chooser shows again.
      }
    },
    // Fixed when the window is created: a later server switch must not change which origin a
    // pending choice is saved under.
    () => origin,
  );
  const picker = createBluetoothPicker({
    ...store,
    choose: async (names, signal) => {
      const { response } = await dialog.showMessageBox(win, {
        message: "Choose a device",
        buttons: [...names, "Cancel"],
        cancelId: names.length,
        signal,
      });
      return response < names.length ? response : -1;
    },
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (timer) => clearTimeout(timer as NodeJS.Timeout),
  });
  // select-bluetooth-device carries no frame. Cross-origin frames are blocked by the bluetooth
  // permissions-policy default ('self'), the web app grants allow="bluetooth" to no iframe, and
  // agent HTML is sandboxed with an opaque origin.
  win.webContents.on("select-bluetooth-device", (event, devices, callback) => {
    event.preventDefault();
    if (!isAppWebContents(win.webContents, permissionTarget)) callback("");
    else picker.select(devices, callback);
  });
  win.once("closed", () => picker.cancel());
  bluetoothPickers.set(win, picker);
  win.webContents.session.setBluetoothPairingHandler(
    createPairingHandler<Electron.BluetoothPairingHandlerHandlerDetails>(() => {
      const active = mainWindow;
      const activePicker = active === null ? undefined : bluetoothPickers.get(active);
      if (active === null || active.isDestroyed() || activePicker === undefined) return null;
      return {
        picker: activePicker,
        allows: (details) => {
          const activeOrigin = safeOrigin(permissionTarget()?.url ?? "");
          const frame = details.frame;
          return (
            details.pairingKind === "confirm" &&
            isAppWebContents(active.webContents, permissionTarget) &&
            !(frame && (frame.parent !== null || safeOrigin(frame.url) !== activeOrigin))
          );
        },
      };
    }),
  );
}

function markOnce(name: string) {
  if (performance.getEntriesByName(name).length === 0) performance.mark(name);
}

function windowFrom(event: Electron.IpcMainInvokeEvent) {
  return BrowserWindow.fromWebContents(event.sender);
}

function fromMainWindow(event: Electron.IpcMainInvokeEvent) {
  return mainWindow !== null && windowFrom(event) === mainWindow;
}

function trustedScannerOrigin() {
  if (currentTargetUrl === null || mainWindow === null || mainWindow.isDestroyed()) return null;
  const origin = safeOrigin(currentTargetUrl);
  const windowTarget = appWindowTargets.get(mainWindow);
  if (origin === null || windowTarget === undefined || safeOrigin(windowTarget) !== origin)
    return null;
  try {
    const url = new URL(currentTargetUrl);
    return url.protocol === "http:" || url.protocol === "https:" ? origin : null;
  } catch {
    return null;
  }
}

function scannerRequestAuthorized(event: Electron.IpcMainInvokeEvent) {
  return scannerIpcAuthorized(
    scannerService !== null && fromMainWindow(event),
    event.senderFrame,
    event.sender.mainFrame,
    trustedScannerOrigin(),
  );
}

function scannerAuthorizationIsCurrent(
  generation: number,
  win: BrowserWindow,
  targetSession: Session,
  origin: string,
  scope: ScannerScope,
) {
  return (
    scannerScopeCoordinator.isCurrent(generation, win, origin) &&
    !win.isDestroyed() &&
    win.webContents.session === targetSession &&
    scannerScopeCoordinator.matches(scope)
  );
}

async function authorizeScannerScope(scope: ScannerScope) {
  if (!scannerScopeCoordinator.matches(scope)) return false;
  const win = mainWindow;
  const origin = trustedScannerOrigin();
  if (win === null || origin === null || origin !== scope.serverOrigin || win.isDestroyed()) {
    clearScannerScope();
    return false;
  }
  const targetSession = win.webContents.session;
  const generation = scannerScopeCoordinator.generation();
  const isCurrent = () =>
    scannerAuthorizationIsCurrent(generation, win, targetSession, origin, scope);
  const authorized = await verifyScannerSessionScope({
    origin,
    userId: scope.userId,
    spaceId: scope.spaceId,
    fetch: (input, init) => targetSession.fetch(input, init),
    isCurrent,
  });
  if (!authorized && isCurrent()) clearScannerScope();
  return authorized && isCurrent();
}

function clearScannerScope() {
  void scannerScopeCoordinator.invalidate().catch(() => undefined);
}

function sendScannerEvent(channel: string, payload: unknown) {
  const win = mainWindow;
  const origin = trustedScannerOrigin();
  if (
    win !== null &&
    !win.isDestroyed() &&
    origin !== null &&
    safeOrigin(win.webContents.mainFrame.url) === origin
  ) {
    win.webContents.send(channel, payload);
  }
}

function scannerUserScope(value: unknown) {
  if (value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) return undefined;
  const scope = value as Record<string, unknown>;
  if (
    Object.keys(scope).sort().join(",") !== "spaceId,userId" ||
    typeof scope.userId !== "string" ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(scope.userId) ||
    typeof scope.spaceId !== "string" ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(scope.spaceId)
  ) {
    return undefined;
  }
  return { userId: scope.userId, spaceId: scope.spaceId };
}

/** Dock/taskbar icon for unpackaged launches; packaged builds get theirs from electron-builder. */
function developmentIcon() {
  if (app.isPackaged) return undefined;
  const icon = path.join(app.getAppPath(), "assets", developmentIconFile(process.platform));
  return existsSync(icon) ? icon : undefined;
}

function sessionPartitionKey(targetUrl: string) {
  return sessionPartitionForServerUrl(targetUrl);
}

function legacyDefaultSessionFlag(partition: string) {
  return path.join(
    app.getPath("userData"),
    `legacy-default-${partition.replace(/[^a-zA-Z0-9_-]/g, "_")}.flag`,
  );
}

/**
 * Prefer the default session when that origin already has cookies or site
 * storage there, so upgrades keep localStorage/IndexedDB. Fresh origins get
 * an isolated partition.
 */
async function resolveSessionForTarget(targetUrl: string) {
  const partition = sessionPartitionKey(targetUrl);
  if (partition === null) {
    return { partition: null, value: session.defaultSession };
  }
  if (existsSync(legacyDefaultSessionFlag(partition))) {
    return { partition: null, value: session.defaultSession };
  }
  const origin = safeOrigin(targetUrl);
  if (origin !== null) {
    try {
      const defaultCookies = await session.defaultSession.cookies.get({
        url: origin,
      });
      if (defaultCookies.length > 0) {
        await writeFile(legacyDefaultSessionFlag(partition), new Date().toISOString(), "utf8");
        return { partition: null, value: session.defaultSession };
      }
    } catch {
      // Continue with a storage probe when the profile looks pre-partition.
    }
    if (defaultSessionProfileExists() && (await defaultSessionHasOriginData(origin))) {
      try {
        await writeFile(legacyDefaultSessionFlag(partition), new Date().toISOString(), "utf8");
      } catch {
        // Flag is best-effort; still stay on the default session this launch.
      }
      return { partition: null, value: session.defaultSession };
    }
  }
  return { partition, value: session.fromPartition(partition) };
}

function defaultSessionProfileExists() {
  const root = app.getPath("userData");
  return (
    existsSync(path.join(root, "Local Storage")) ||
    existsSync(path.join(root, "IndexedDB")) ||
    existsSync(path.join(root, "Cookies")) ||
    existsSync(path.join(root, "Network", "Cookies")) ||
    existsSync(path.join(root, "Cache Storage"))
  );
}

/** Page storage in the default session means a pre-partition install for this origin. */
async function defaultSessionHasOriginData(origin: string): Promise<boolean> {
  const probe = new BrowserWindow({
    show: false,
    width: 1,
    height: 1,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  // Increment only after construction succeeds so a throw cannot leave the
  // counter stuck > 0 and permanently block quit on Windows/Linux.
  liveProbeWindows++;
  try {
    await probe.loadURL(origin);
    return (await probe.webContents.executeJavaScript(`(async () => {
      if (localStorage.length > 0 || sessionStorage.length > 0) return true;
      if (typeof indexedDB !== "undefined" && indexedDB.databases) {
        try {
          const databases = await indexedDB.databases();
          if (databases.length > 0) return true;
        } catch {}
      }
      if (typeof caches !== "undefined") {
        try {
          const keys = await caches.keys();
          if (keys.length > 0) return true;
        } catch {}
      }
      return false;
    })()`)) as boolean;
  } catch {
    return false;
  } finally {
    if (!probe.isDestroyed()) probe.destroy();
    liveProbeWindows--;
  }
}

function createWindow(url: string, partition: string | null) {
  markOnce("rk:main:window-create-start");
  const icon = developmentIcon();
  const win = new BrowserWindow({
    ...browserWindowOptions(process.platform),
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: path.join(import.meta.dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      ...(partition === null ? {} : { partition }),
    },
  });
  restrictWebRtc(win.webContents);
  if (mainWindow !== null) {
    if (mainWindow !== win) clearScannerScope();
    // A chooser still open in the window being replaced must not outlive it.
    bluetoothPickers.get(mainWindow)?.cancel();
  }
  mainWindow = win;
  appWindowTargets.set(win, url);
  installBluetooth(win);
  const targetOrigin = safeOrigin(url);
  const targetSession = win.webContents.session;
  const onCookiesChanged = (_event: Electron.Event, cookie: Electron.Cookie) => {
    if (
      mainWindow === win &&
      targetOrigin !== null &&
      isScannerSessionCookie(cookie, targetOrigin)
    ) {
      void scannerScopeCoordinator.reauthenticate(win).catch(() => undefined);
    }
  };
  targetSession.cookies.on("changed", onCookiesChanged);
  // Intentional OAuth flows open the provider's authorize page via a named
  // window; give those and same-origin popups a normal frame. Everything else
  // opens in the system browser so a connected server cannot navigate us away.
  // Hoisted for loopback OAuth capture so MCP/in-app localhost callbacks are skipped.
  const appOrigin = targetOrigin ?? safeOrigin(url);
  win.webContents.setWindowOpenHandler(({ url: childUrl, frameName }) => {
    if (shouldOpenInAppPopup(appOrigin, childUrl, frameName)) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: oauthPopupWindowOptions(partition),
      };
    }
    const external = safeExternalUrl(childUrl);
    if (external !== null) void shell.openExternal(external);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, navigationUrl) => {
    const navigation = mainWindowNavigation(targetOrigin, navigationUrl);
    if (navigation.allow) {
      void scannerScopeCoordinator.forgetWindow(win).catch(() => undefined);
      return;
    }
    event.preventDefault();
    if (navigation.external !== null) void shell.openExternal(navigation.external);
  });
  win.webContents.on("will-redirect", (details) => {
    if (details.isMainFrame === false) return;
    const navigation = mainWindowNavigation(targetOrigin, details.url);
    if (navigation.allow) return;
    details.preventDefault();
    if (navigation.external !== null) void shell.openExternal(navigation.external);
  });
  win.webContents.on("did-navigate", () => {
    void scannerScopeCoordinator.forgetWindow(win).catch(() => undefined);
  });
  // The popup has no address bar, so a loopback redirect would otherwise strand
  // the user on a blank window holding the authorization code in a URL they
  // cannot read. Capture it here and hand it to the app instead.
  win.webContents.on("did-create-window", (popup, { frameName }) => {
    const capture = (details: {
      preventDefault: () => void;
      url: string;
      isMainFrame?: boolean;
    }) => {
      // will-redirect can fire for iframes; only the top-level callback counts.
      if (details.isMainFrame === false) return;
      const callback = oauthCallbackFrom(details.url, {
        frameName,
        excludeOrigins: appOrigin !== null ? [appOrigin] : [],
      });
      if (!callback) return;
      details.preventDefault();
      if (!win.isDestroyed()) win.webContents.send("desktop.oauth.callback", callback);
      if (!popup.isDestroyed()) popup.close();
    };
    popup.webContents.on("will-redirect", (details) => capture(details));
    popup.webContents.on("will-navigate", (details) => capture(details));
  });
  win.on("close", (event) => {
    if (
      process.platform === "darwin" &&
      !quitting &&
      process.env.RAKAZO_DISABLE_WARM_WINDOW !== "1"
    ) {
      event.preventDefault();
      win.hide();
      clearTimeout(warmWindowTimer);
      warmWindowTimer = setTimeout(() => {
        if (mainWindow === win && !win.isDestroyed() && !win.isVisible()) win.destroy();
      }, WARM_WINDOW_TTL_MS);
    }
  });
  win.once("closed", () => {
    clearTimeout(warmWindowTimer);
    targetSession.cookies.removeListener("changed", onCookiesChanged);
    void scannerScopeCoordinator.forgetWindow(win).catch(() => undefined);
    if (mainWindow === win) {
      mainWindow = null;
    }
  });
  markOnce("rk:main:window-created");
  if (win.isVisible()) markOnce("rk:main:window-shown");
  win.once("show", () => markOnce("rk:main:window-shown"));
  win.once("ready-to-show", () => markOnce("rk:main:ready-to-show"));
  win.webContents.once("dom-ready", () => markOnce("rk:main:dom-ready"));
  win.webContents.once("did-finish-load", () => markOnce("rk:main:did-finish-load"));
  win.webContents.once("did-stop-loading", () => markOnce("rk:main:did-stop-loading"));
  markOnce("rk:main:load-url-start");
  const loaded = loadAppUrl(win, url).then(
    (state) => {
      markOnce("rk:main:load-url-resolved");
      return state;
    },
    (error: unknown) => {
      markOnce("rk:main:load-url-rejected");
      throw error;
    },
  );
  if (!launchUpdateCheckScheduled) {
    launchUpdateCheckScheduled = true;
    setTimeout(() => void desktopUpdater.check(false), LAUNCH_CHECK_DELAY_MS).unref();
    setInterval(() => void desktopUpdater.check(false), 60 * 60 * 1_000).unref();
  }
  return { loaded, win };
}

async function probeDocument(url: string): Promise<string | null> {
  // Test/dev harnesses may load data: or file: documents; only probe real servers.
  if (!url.startsWith("http://") && !url.startsWith("https://")) return null;
  try {
    const response = await net.fetch(url, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      credentials: "omit",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    // Allow 3xx (e.g. / → /login); reject hard HTTP errors before opening a window.
    if (response.status >= 400) {
      return `The server answered with HTTP ${response.status}.`;
    }
    return null;
  } catch (error) {
    return probeFailureMessage(error);
  }
}

/**
 * loadURL alone treats many HTTP error documents as success. Reject main-frame
 * failures, renderer crashes during load, HTTP 4xx/5xx main-frame responses, and
 * shells that never mount application content.
 */
function loadAppUrl(win: BrowserWindow, url: string): Promise<AppDocumentState> {
  const contents = win.webContents;
  const targetSession = contents.session;
  let mainStatus: number | undefined;

  targetSession.webRequest.onCompleted({ urls: ["*://*/*"] }, (details) => {
    if (details.webContentsId === contents.id && details.resourceType === "mainFrame") {
      mainStatus = details.statusCode;
    }
  });

  return new Promise<AppDocumentState>((resolve, reject) => {
    let settled = false;
    const settle = (error?: Error) => {
      if (settled) return;
      settled = true;
      contents.removeListener("did-fail-load", onFail);
      // Keep render-process-gone until document readiness finishes so a crash
      // during mount still fails the switch.
      targetSession.webRequest.onCompleted(null);
      if (error) {
        contents.removeListener("render-process-gone", onGone);
        reject(error);
        return;
      }
      if (mainStatus !== undefined && mainStatus >= 400) {
        contents.removeListener("render-process-gone", onGone);
        reject(new Error(`The server answered with HTTP ${mainStatus}.`));
        return;
      }
      void waitForMountedAppDocument(contents)
        .then((state) => {
          contents.removeListener("render-process-gone", onGone);
          if (contents.isCrashed()) {
            reject(new Error("Renderer stopped after load."));
            return;
          }
          resolve(state);
        })
        .catch((inspectError: unknown) => {
          contents.removeListener("render-process-gone", onGone);
          reject(inspectError instanceof Error ? inspectError : new Error(String(inspectError)));
        });
    };

    const onFail = (
      _event: Electron.Event,
      _errorCode: number,
      errorDescription: string,
      _validatedURL: string,
      isMainFrame: boolean,
    ) => {
      if (isMainFrame) settle(new Error(errorDescription || "Page failed to load."));
    };
    const onGone = (_event: Electron.Event, details: Electron.RenderProcessGoneDetails) => {
      settle(new Error(`Renderer stopped (${details.reason}).`));
    };

    contents.on("did-fail-load", onFail);
    contents.on("render-process-gone", onGone);
    void contents.loadURL(url).then(
      async () => {
        // onCompleted can lag loadURL; wait briefly for the main-frame status.
        const deadline = Date.now() + 500;
        while (mainStatus === undefined && Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 10));
        }
        settle();
      },
      (error: unknown) => {
        settle(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

async function waitForMountedAppDocument(
  contents: Electron.WebContents,
): Promise<AppDocumentState> {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    if (contents.isCrashed()) throw new Error("Renderer stopped after load.");
    const state = (await contents.executeJavaScript(APP_DOCUMENT_STATE_SCRIPT)) as
      | AppDocumentState
      | "pending";
    if (state !== "pending") return state;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("The server page did not become ready.");
}

async function installBundledRenderer(
  targetUrl: string,
  targetSession: Session,
  partition: string | null,
  managedLocalStack: boolean,
) {
  if (!app.isPackaged || process.env.RAKAZO_DISABLE_BUNDLED_RENDERER === "1") return;
  if (!servesBundledRenderer(targetUrl, managedLocalStack)) return;
  const webUrl = new URL(targetUrl);
  const installationKey = `${partition ?? "default"}:${webUrl.protocol}`;
  if (bundledRendererInstallations.has(installationKey)) return;
  const root = path.join(process.resourcesPath, "web");

  await targetSession.protocol.handle(webUrl.protocol.slice(0, -1), async (request) => {
    const forward = () => {
      return targetSession.fetch(request, forwardedRendererRequestInit(request, webUrl.origin));
    };
    // Mode can change on the same origin/session; only managed "new" keeps the overlay.
    if (partition !== "local-server-settings" && currentSetup?.mode !== "new") {
      return forward();
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return forward();
    }
    const acceptsHtml = request.headers.get("accept")?.includes("text/html") ?? false;
    const candidates = bundledRendererCandidates(root, request.url, webUrl.origin, acceptsHtml);
    if (!candidates) return forward();
    for (const file of candidates) {
      let body: Buffer | null = null;
      try {
        if (request.method === "HEAD") {
          if (!(await stat(file)).isFile()) continue;
        } else {
          body = await readFile(file);
        }
      } catch (error) {
        if (isRendererAssetMiss(error)) continue;
        throw error;
      }
      return new Response(body, { headers: bundledRendererHeaders(file, request.url) });
    }
    return forward();
  });
  bundledRendererInstallations.add(installationKey);
  markOnce("rk:main:bundled-renderer-ready");
}

function oauthPopupWindowOptions(partition: string | null) {
  return {
    width: 560,
    height: 720,
    frame: true,
    titleBarStyle: "default" as const,
    autoHideMenuBar: true,
    backgroundColor: "#1C1C1A",
    webPreferences: oauthPopupSessionPreferences(partition),
  };
}

function createSetupWindow() {
  const icon = developmentIcon();
  const win = new BrowserWindow({
    ...setupWindowOptions(process.platform),
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: path.join(import.meta.dirname, "setup-preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      // A long pull runs while this window sits behind others; throttled timers would freeze it.
      backgroundThrottling: false,
    },
  });
  setupWindow = win;
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.once("closed", () => {
    if (setupWindow === win) setupWindow = null;
    // Closing setup without saving restores a connected session (Change Server cancel).
    restoreAppWindowAfterSetup();
  });
  void win.loadFile(path.join(import.meta.dirname, "setup.html"));
  markOnce("rk:main:setup-window-created");
  return win;
}

/** Hide the app while setup is open; do not clear the saved target until a new one opens. */
function showSetupWindow(error: string | null = null) {
  setupError = error;

  let win: BrowserWindow;
  if (setupWindow !== null && !setupWindow.isDestroyed()) {
    if (error !== null) setupWindow.reload();
    win = setupWindow;
  } else {
    win = createSetupWindow();
  }
  if (mainWindow !== null && !mainWindow.isDestroyed()) mainWindow.hide();
  win.show();
  win.focus();
  return win;
}

function restoreAppWindowAfterSetup() {
  if (quitting) return;
  if (setupWindow !== null && !setupWindow.isDestroyed()) return;
  if (mainWindow === null || mainWindow.isDestroyed() || currentTargetUrl === null) return;
  clearTimeout(warmWindowTimer);
  mainWindow.show();
  mainWindow.focus();
}

async function showLocalSettings() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }
  if (openingSettings) return;
  openingSettings = true;
  try {
    const url = localStack.webUrl();
    const token = await readStackToken(stackDir(app.getPath("userData")));
    if (!token || !(await localStack.matchesDesiredStack(url))) {
      await dialog.showMessageBox({
        message: "Start the local server before opening its settings.",
        type: "info",
      });
      return;
    }
    await settingsCleanup;
    const partition = "local-server-settings";
    const targetSession = session.fromPartition(partition);
    installSessionPermissions(targetSession, () => null);
    await installBundledRenderer(url, targetSession, partition, true);
    const win = new BrowserWindow({
      ...browserWindowOptions(process.platform),
      title: "Local Server Settings",
      frame: true,
      titleBarStyle: "default",
      trafficLightPosition: undefined,
      webPreferences: {
        preload: path.join(import.meta.dirname, "preload.cjs"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        partition,
      },
    });
    settingsWindow = win;
    const origin = new URL(url).origin;
    settingsTarget = { origin, token };
    win.webContents.setWindowOpenHandler(({ url: externalUrl }) => {
      const external = safeExternalUrl(externalUrl);
      if (external) void shell.openExternal(external);
      return { action: "deny" };
    });
    const preventNavigation = (event: Electron.Event, target: string) => {
      if (target === `${origin}${LOCAL_SETTINGS_PAGE}`) return;
      event.preventDefault();
    };
    win.webContents.on("will-navigate", preventNavigation);
    win.webContents.on("will-redirect", preventNavigation);
    win.once("closed", () => {
      if (settingsWindow === win) {
        settingsWindow = null;
        settingsTarget = null;
      }
      const protocol = new URL(url).protocol;
      if (bundledRendererInstallations.delete(`${partition}:${protocol}`)) {
        targetSession.protocol.unhandle(protocol.slice(0, -1));
      }
      settingsCleanup = targetSession.clearStorageData().catch(() => undefined);
    });
    await win.loadURL(`${origin}${LOCAL_SETTINGS_PAGE}`);
  } catch {
    settingsWindow?.close();
    await dialog.showMessageBox({
      message: "Could not open local server settings. Try again.",
      type: "error",
    });
  } finally {
    openingSettings = false;
  }
}

function installApplicationMenu() {
  const template = buildApplicationMenuTemplate(
    process.platform,
    app.name,
    {
      openLocalSettings: () => void showLocalSettings(),
      changeServer: () => showSetupWindow(),
      stopLocalStack: () => {
        if (currentSetup?.mode === "new") void localStack.stop();
      },
    },
    currentSetup?.mode === "new",
  );
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  applicationMenuInstalled = true;
}

/** Setup IPC must only answer the setup window, never a connected Praci server. */
function fromSetupWindow(event: Electron.IpcMainInvokeEvent) {
  return (
    setupWindow !== null && !setupWindow.isDestroyed() && event.sender === setupWindow.webContents
  );
}

async function probeServer(rawUrl: string, signal?: AbortSignal): Promise<DesktopReachability> {
  const url = normalizeServerUrl(rawUrl);
  if (url === null) return { ok: false, error: "Enter a valid http:// or https:// address." };
  const timeout = AbortSignal.timeout(PROBE_TIMEOUT_MS);

  try {
    const response = await net.fetch(`${url}/rpc/health`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: {} }),
      cache: "no-store",
      credentials: "omit",
      redirect: "manual",
      signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
    });
    if (response.status >= 300 && response.status < 400) {
      return {
        ok: false,
        status: response.status,
        url,
        error: "That address redirects elsewhere. Enter the final Praci server address.",
      };
    }
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        url,
        error: `The server answered with HTTP ${response.status}.`,
      };
    }
    const health = await readProbeJson(response);
    if (!isRakazoHealth(health)) {
      return {
        ok: false,
        status: response.status,
        url,
        error: "That address did not respond like a Praci server.",
      };
    }
    return {
      ok: true,
      status: response.status,
      url,
    };
  } catch (error) {
    return { ok: false, url, error: probeFailureMessage(error) };
  }
}

/** A public health response is not enough: another checkout may own the same fixed port. */
async function probeManagedStack(
  rawUrl: string,
  token: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const url = normalizeServerUrl(rawUrl);
  // Never put the private stack token on a cleartext LAN or .local hop.
  if (url === null || !maySendDesktopStackToken(url)) return null;
  const timeout = AbortSignal.timeout(PROBE_TIMEOUT_MS);
  try {
    const response = await net.fetch(`${url}${DESKTOP_STACK_PROBE_PATH}`, {
      method: "GET",
      headers: { [DESKTOP_STACK_TOKEN_HEADER]: token },
      cache: "no-store",
      credentials: "omit",
      redirect: "manual",
      signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
    });
    if (!response.ok) return null;
    return desktopStackImageTag(await readProbeJson(response));
  } catch {
    return null;
  }
}

function openFailureDetail(error: unknown): string {
  if (error instanceof Error) {
    const { message } = error;
    if (
      message.startsWith("The server answered with HTTP") ||
      message.startsWith("The server page loaded empty") ||
      message.startsWith("The server page did not become ready") ||
      message.startsWith("Renderer stopped") ||
      message.startsWith("Page failed to load")
    ) {
      return message;
    }
  }
  return probeFailureMessage(error);
}

async function openAppOnce(targetUrl: string, switching: boolean) {
  const previousTargetUrl = currentTargetUrl;
  if (currentTargetUrl !== null && currentTargetUrl !== targetUrl) clearScannerScope();
  const target = await resolveSessionForTarget(targetUrl);
  const previous = mainWindow;
  let win: BrowserWindow | null = null;
  try {
    const documentError = await probeDocument(targetUrl);
    if (documentError !== null) {
      throw new Error(documentError);
    }
    await installBundledRenderer(
      targetUrl,
      target.value,
      target.partition,
      currentSetup?.mode === "new",
    );
    const created = createWindow(targetUrl, target.partition);
    win = created.win;
    // On launch the web app's error screen stays up so its Refresh can recover;
    // switching to a server that cannot render keeps the previous one instead.
    if ((await created.loaded) === "failed" && switching) {
      throw new Error("The server page did not become ready.");
    }
    currentTargetUrl = targetUrl;
    setupError = null;
    // Keep the previous window until the caller commits (after setup.json is written).
    pendingPreviousWindow =
      previous !== null && !previous.isDestroyed() && previous !== win ? previous : null;
    if (pendingPreviousWindow !== null) pendingPreviousWindow.hide();
    return true;
  } catch (error) {
    pendingPreviousWindow = null;
    // Keep the previous app window so Cancel / close can restore it.
    if (previous !== null && !previous.isDestroyed()) {
      mainWindow = previous;
      currentTargetUrl = previousTargetUrl;
      void scannerScopeCoordinator.reauthenticate(previous).catch(() => undefined);
    }
    // Show the setup window BEFORE destroying the failed one: on Windows/Linux,
    // destroying the last window fires "window-all-closed" -> app.quit() before
    // showSetupWindow() runs, so the app silently exits instead of showing this error.
    showSetupWindow(`Could not open that server. ${openFailureDetail(error)}`);
    if (win !== null && !win.isDestroyed()) win.destroy();
    return false;
  }
}

/** Drop the previous app window after the new server is opened and persisted. */
function commitPendingAppSwitch() {
  const previous = pendingPreviousWindow;
  pendingPreviousWindow = null;
  if (previous !== null && !previous.isDestroyed() && previous !== mainWindow) previous.destroy();
}

/**
 * Undo an open that could not be persisted. When a prior session exists, restore
 * it. On first run keep the connected window so the user can retry save.
 */
function abandonPendingAppSwitch(
  previousSetup: DesktopSetup | null,
  previousUrl: string | null,
): "restored" | "kept" {
  const previous = pendingPreviousWindow;
  pendingPreviousWindow = null;
  if (previous !== null && !previous.isDestroyed()) {
    const failed = mainWindow;
    if (failed !== null && !failed.isDestroyed() && failed !== previous) failed.destroy();
    mainWindow = previous;
    setCurrentSetup(previousSetup);
    currentTargetUrl = previousUrl;
    void scannerScopeCoordinator.reauthenticate(previous).catch(() => undefined);
    // If setup was already closed (e.g. during a slow write), make the restored
    // session visible — otherwise macOS can be left with no shown window.
    if (setupWindow === null || setupWindow.isDestroyed()) {
      clearTimeout(warmWindowTimer);
      previous.show();
      previous.focus();
    }
    return "restored";
  }
  return "kept";
}

/** Watch for a renderer crash until setup is persisted (or the switch is abandoned). */
function watchRendererUntilCommitted(win: BrowserWindow) {
  let crashed = false;
  const onGone = () => {
    crashed = true;
  };
  win.webContents.once("render-process-gone", onGone);
  return {
    crashed: () => crashed || (!win.isDestroyed() && win.webContents.isCrashed()),
    dispose: () => {
      if (!win.isDestroyed()) win.webContents.removeListener("render-process-gone", onGone);
    },
  };
}

function destroySetupWindow() {
  const setup = setupWindow;
  setupWindow = null;
  if (setup !== null && !setup.isDestroyed()) setup.destroy();
}

/** Best-effort restore of setup.json after a failed save that already wrote disk. */
async function rollbackSetupFile(userDataDir: string, previousSetup: DesktopSetup | null) {
  try {
    if (previousSetup !== null) await writeSetup(userDataDir, previousSetup);
    else await clearSetup(userDataDir);
  } catch {
    // Disk rollback is best-effort; callers already restored in-memory state when possible.
  }
}

/**
 * After a renderer crash around save: restore prior setup when possible, otherwise
 * drop the crashed first-run window so setup remains the only recovery surface.
 */
async function recoverFromCrashedSave(
  userDataDir: string,
  previousSetup: DesktopSetup | null,
  previousUrl: string | null,
): Promise<string> {
  const outcome = abandonPendingAppSwitch(previousSetup, previousUrl);
  await rollbackSetupFile(userDataDir, previousSetup);
  if (outcome === "kept") {
    if (mainWindow !== null && !mainWindow.isDestroyed()) mainWindow.destroy();
    mainWindow = null;
    setCurrentSetup(previousSetup);
    currentTargetUrl = previousUrl;
  }
  const message =
    previousSetup !== null
      ? "Could not open that server. Renderer stopped. The previous instance was restored for the next launch."
      : "Could not open that server. Renderer stopped.";
  showSetupWindow(message);
  return message;
}

function safeOrigin(targetUrl: string) {
  try {
    return new URL(targetUrl).origin;
  } catch {
    return null;
  }
}

app.whenReady().then(async () => {
  installSessionPermissions(session.defaultSession, permissionTarget, displayCapture);
  const userDataDir = app.getPath("userData");
  const stackImages = readStackImages(
    JSON.parse(readFileSync(path.join(app.getAppPath(), "package.json"), "utf8")),
  );
  localStack = new LocalStackController({
    platform: process.platform,
    env: process.env,
    exists: existsSync,
    run: runDocker,
    stackDir: stackDir(userDataDir),
    resourceDir: stackResourceDir({
      packaged: app.isPackaged,
      resourcesPath: process.resourcesPath,
      appPath: app.getAppPath(),
    }),
    localWebUrl:
      process.env.RAKAZO_LOCAL_WEB_URL?.trim() ||
      (await readStackWebUrl(stackDir(userDataDir), LOCAL_WEB_URL)),
    imageTag: resolveImageTag({
      version: app.getVersion(),
      packaged: app.isPackaged,
      override: process.env.RAKAZO_IMAGE_TAG || stackImages?.tag,
    }),
    images: stackImages,
    probe: (url, signal, token) => probeManagedStack(url, token, signal),
    randomHex: (bytes) => randomBytes(bytes).toString("hex"),
    startAppControl: (saved) => startAppControlBridge({ userDataDir, ...saved }),
    onState: (state) => {
      if (setupWindow !== null && !setupWindow.isDestroyed()) {
        setupWindow.webContents.send("desktop.setup.stack.changed", state);
      }
    },
  });
  currentSetup = await readSetup(userDataDir); // installApplicationMenu() follows below
  const target = resolveStartupTarget({
    envUrl: process.env.RAKAZO_WEB_URL,
    saved: currentSetup,
    forceSetup: process.env.RAKAZO_FORCE_SETUP === "1",
  });
  if (process.env.RAKAZO_PERFORMANCE_CLEAR_CACHE === "1") {
    const cacheSessions = new Set<Session>([session.defaultSession]);
    if (target.kind === "app") {
      cacheSessions.add((await resolveSessionForTarget(target.url)).value);
    }
    await Promise.all(
      [...cacheSessions].flatMap((value) => [value.clearCache(), value.clearCodeCaches({})]),
    );
    markOnce("rk:main:caches-cleared");
  }

  const icon = developmentIcon();
  if (process.platform === "darwin" && icon) app.dock?.setIcon(icon);
  installApplicationMenu();
  const browserAuthAttempts = new Map<string, AbortController>();
  const cancelBrowserAuth = () => {
    for (const attempt of browserAuthAttempts.values()) attempt.abort();
    browserAuthAttempts.clear();
  };
  app.on("before-quit", cancelBrowserAuth);
  ipcMain.handle("desktop.oauth.open", async (event, url: unknown) => {
    if (
      (!fromMainWindow(event) &&
        !(settingsWindow !== null && windowFrom(event) === settingsWindow)) ||
      event.senderFrame !== event.sender.mainFrame ||
      typeof url !== "string" ||
      url.length > 16_384
    )
      throw new Error("Invalid sign-in request.");
    if (browserAuthAttempts.has(url) || browserAuthAttempts.size >= 8) {
      throw new Error("A sign-in attempt is already active. Cancel it and retry.");
    }
    const controller = new AbortController();
    browserAuthAttempts.set(url, controller);
    const stop = () => controller.abort();
    const expiry = setTimeout(stop, 10 * 60_000);
    expiry.unref();
    event.sender.once("destroyed", stop);
    event.sender.once("did-navigate", stop);
    controller.signal.addEventListener(
      "abort",
      () => {
        clearTimeout(expiry);
        event.sender.removeListener("destroyed", stop);
        event.sender.removeListener("did-navigate", stop);
        if (browserAuthAttempts.get(url) === controller) browserAuthAttempts.delete(url);
      },
      { once: true },
    );
    try {
      await openBrowserAuth(url, {
        signal: controller.signal,
        onClose: stop,
        openExternal: (target) => shell.openExternal(target),
        onCallback: (callback) => {
          if (!event.sender.isDestroyed()) event.sender.send("desktop.oauth.callback", callback);
        },
      });
    } catch {
      controller.abort();
      throw new Error("Could not open browser sign-in. Close other sign-in attempts and retry.");
    }
  });
  ipcMain.handle("desktop.oauth.cancel", (event, url: unknown) => {
    if (
      (!fromMainWindow(event) &&
        !(settingsWindow !== null && windowFrom(event) === settingsWindow)) ||
      event.senderFrame !== event.sender.mainFrame ||
      typeof url !== "string"
    )
      return;
    browserAuthAttempts.get(url)?.abort();
  });
  ipcMain.handle(
    "desktop.localSettings.request",
    async (event, pathname: unknown, body: unknown) => {
      if (
        !settingsWindow ||
        windowFrom(event) !== settingsWindow ||
        event.senderFrame !== event.sender.mainFrame ||
        !settingsTarget ||
        event.senderFrame.url !== `${settingsTarget.origin}${LOCAL_SETTINGS_PAGE}`
      ) {
        throw new Error("Local settings are not active");
      }
      return requestLocalSettings(settingsTarget, pathname, body, (input, init) =>
        net.fetch(input instanceof URL ? input.href : input, {
          ...init,
          bypassCustomProtocolHandlers: true,
        }),
      );
    },
  );
  ipcMain.handle("desktop.platform", () => process.platform);
  ipcMain.handle("desktop.window.close", (event) => {
    windowFrom(event)?.close();
  });
  ipcMain.handle("desktop.window.minimize", (event) => {
    windowFrom(event)?.minimize();
  });
  ipcMain.handle("desktop.window.toggleMaximize", (event) => {
    const win = windowFrom(event);
    if (!win) return;
    if (win.isMaximized() || win.isFullScreen()) {
      win.setFullScreen(false);
      if (win.isMaximized()) win.unmaximize();
    } else {
      win.maximize();
    }
  });
  ipcMain.handle("desktop.window.focus", (event) => {
    const win = windowFrom(event);
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    // macOS keeps another app in front unless the whole app is activated.
    app.focus({ steal: true });
  });
  ipcMain.handle("desktop.window.state", (event) => {
    const win = windowFrom(event);
    return {
      minimized: win?.isMinimized() ?? false,
      maximized: win?.isMaximized() ?? false,
      fullScreen: win?.isFullScreen() ?? false,
    };
  });
  // Hex records meetings on macOS only; elsewhere the answers are "not found" and nothing runs.
  const hex = createHexRunner();
  const hexMac = process.platform === "darwin";
  ipcMain.handle(
    "desktop.hex.available",
    (event) => hexMac && fromMainWindow(event) && hex.available(),
  );
  ipcMain.handle("desktop.hex.list", (event, sinceMs: unknown) =>
    hexMac && fromMainWindow(event) && typeof sinceMs === "number"
      ? hex.list(sinceMs)
      : { state: "not_found" },
  );
  ipcMain.handle("desktop.hex.show", (event, id: unknown) =>
    hexMac && fromMainWindow(event) && typeof id === "string"
      ? hex.show(id)
      : { state: "not_found" },
  );
  // On-device speech needs Hex's helper, so it is macOS on Apple silicon only.
  if (process.platform === "darwin" || process.platform === "linux") {
    const scanner = createScanner({
      userDataDir: app.getPath("userData"),
      authorizeScope: authorizeScannerScope,
    });
    scannerService = scanner;
    scanner.onState((state) => sendScannerEvent("desktop.scanner.state.changed", state));
    scanner.onDocument((document) => {
      const scope = scannerScopeCoordinator.scope();
      if (
        scope !== null &&
        scope.userId === document.userId &&
        scope.spaceId === document.spaceId &&
        scope.serverOrigin === trustedScannerOrigin() &&
        scannerScopeCoordinator.matches(scope)
      ) {
        sendScannerEvent("desktop.scanner.document", document);
      }
    });
    void scanner.start();

    const requireScanner = (event: Electron.IpcMainInvokeEvent) => {
      if (!scannerRequestAuthorized(event)) throw new Error("Scanner request is not authorized.");
      return scanner;
    };
    ipcMain.handle("desktop.scanner.state", (event, ...args: unknown[]) => {
      const service = requireScanner(event);
      if (args.length !== 0) throw new Error("Invalid scanner request.");
      return service.state();
    });
    ipcMain.handle("desktop.scanner.scan", async (event, ...args: unknown[]) => {
      const service = requireScanner(event);
      if (args.length !== 0) throw new Error("Invalid scanner request.");
      await service.scan();
    });
    ipcMain.handle("desktop.scanner.cancel", async (event, ...args: unknown[]) => {
      const service = requireScanner(event);
      if (args.length !== 0) throw new Error("Invalid scanner request.");
      await service.cancel();
    });
    ipcMain.handle(
      "desktop.scanner.setAutoScan",
      async (event, value: unknown, ...args: unknown[]) => {
        const service = requireScanner(event);
        if (args.length !== 0 || typeof value !== "boolean")
          throw new Error("Invalid scanner settings.");
        await service.setAutoScan(value);
      },
    );
    ipcMain.handle(
      "desktop.scanner.setFolder",
      async (event, folder: unknown, ...args: unknown[]) => {
        const service = requireScanner(event);
        if (args.length !== 0 || !isScannerFolderPath(folder))
          throw new Error("Invalid scanner folder.");
        await service.setFolder(folder);
      },
    );
    ipcMain.handle(
      "desktop.scanner.setScope",
      async (event, value: unknown, ...args: unknown[]) => {
        requireScanner(event);
        if (args.length !== 0) throw new Error("Invalid scanner scope.");
        const scope = scannerUserScope(value);
        if (scope === undefined) throw new Error("Invalid scanner scope.");
        const win = windowFrom(event);
        if (win === null) throw new Error("Scanner request is not authorized.");
        const result = await scannerScopeCoordinator.remember(win, scope);
        if (result === "rejected") throw new Error("Scanner scope could not be verified.");
      },
    );
    ipcMain.handle("desktop.scanner.pending", (event, ...args: unknown[]) => {
      const service = requireScanner(event);
      if (args.length !== 0) throw new Error("Invalid scanner request.");
      return service.pending();
    });
    ipcMain.handle(
      "desktop.scanner.confirm",
      (event, id: unknown, storedSha256: unknown, ...args: unknown[]) => {
        const service = requireScanner(event);
        if (
          args.length !== 0 ||
          typeof id !== "string" ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ||
          typeof storedSha256 !== "string" ||
          !/^[0-9a-f]{64}$/i.test(storedSha256)
        ) {
          throw new Error("Invalid scanner confirmation.");
        }
        return service.confirm(id, storedSha256);
      },
    );
    app.on("will-quit", () => void scanner.close());
  }

  const speech = createDeviceSpeech({
    userDataDir: app.getPath("userData"),
    supported: process.platform === "darwin" && process.arch === "arm64",
    command: () => {
      const hexPath = findHex();
      return hexPath === undefined ? undefined : [hexPath, "service", "--embedded"];
    },
    onStatus: (status) => {
      if (mainWindow !== null && !mainWindow.isDestroyed())
        mainWindow.webContents.send("desktop.speech.status", status);
    },
  });
  const unavailable = { state: "unavailable" } as const;
  ipcMain.handle("desktop.speech.status", (event) =>
    fromMainWindow(event) ? speech.status() : unavailable,
  );
  ipcMain.handle("desktop.speech.prepare", (event) =>
    fromMainWindow(event) ? speech.prepare() : unavailable,
  );
  ipcMain.handle("desktop.speech.forget", (event) =>
    fromMainWindow(event) ? speech.forget() : unavailable,
  );
  ipcMain.handle("desktop.speech.transcribe", (event, wav: unknown) =>
    fromMainWindow(event) ? speech.transcribe(wav) : { ok: false, retry: false },
  );
  // will-quit, not before-quit: a capture can still cancel the quit while it is being confirmed.
  app.on("will-quit", () => void speech.close());
  ipcMain.handle("desktop.update.state", () => desktopUpdater.state());
  ipcMain.handle("desktop.update.check", (event) =>
    fromMainWindow(event) ? desktopUpdater.check(true) : desktopUpdater.state(),
  );
  ipcMain.handle("desktop.update.download", (event) =>
    fromMainWindow(event) ? desktopUpdater.download() : desktopUpdater.state(),
  );
  ipcMain.handle("desktop.update.install", async (event) => {
    if (!fromMainWindow(event) || desktopUpdater.state().phase !== "ready") {
      return desktopUpdater.state();
    }
    quitting = true;
    const state = await desktopUpdater.install();
    // A failed install stays ready for retry but reports a message. Restore normal
    // window behavior while the user keeps working after that failure.
    if (state.phase !== "ready" || state.message !== null) quitting = false;
    return state;
  });
  ipcMain.handle("desktop.setup.state", (event) => {
    if (!fromSetupWindow(event)) return null;
    return {
      defaultLocalUrl: localStack.webUrl(),
      saved: currentSetup,
      error: setupError ?? undefined,
    };
  });

  ipcMain.handle("desktop.setup.test", async (event, url: unknown) => {
    if (!fromSetupWindow(event)) return { ok: false, error: "Setup is not active." };
    if (typeof url !== "string") return { ok: false, error: "Enter a server address." };
    return probeServer(url);
  });

  ipcMain.handle("desktop.setup.save", async (event, payload: unknown) => {
    if (!fromSetupWindow(event)) return { ok: false, error: "Setup is not active." };
    // A launch still loading counts too: the switch must open and check its own server.
    if (setupSaveInProgress || appOpener.busy())
      return { ok: false, error: "A connection attempt is already running." };
    setupSaveInProgress = true;
    const previousSetup = currentSetup;
    const previousUrl = currentTargetUrl;
    try {
      const setup = parseSetupInput(payload);
      if (setup === null) {
        return {
          ok: false,
          error:
            "Enter a valid server address. Public servers require HTTPS; a new local instance must use localhost.",
        };
      }

      // Only open the exact origin selected and authenticated by the managed stack.
      let openSetup = setup;
      if (setup.mode === "new") {
        const managedUrl = managedLocalOpenUrl(setup.serverUrl, localStack.webUrl());
        if (managedUrl === null || !(await localStack.matchesDesiredStack())) {
          return {
            ok: false,
            error: "The app-managed Praci services are not ready. Retry setup.",
          };
        }
        openSetup = { mode: "new", serverUrl: managedUrl };
      }

      const reachability = await probeServer(openSetup.serverUrl);
      if (!reachability.ok) return { ok: false, error: reachability.error };

      // Open before persisting so a failed renderer load keeps the last working setup.
      setCurrentSetup(openSetup);
      const opened = await appOpener.open(openSetup.serverUrl, {
        switching: true,
      });
      if (!opened) {
        setCurrentSetup(previousSetup);
        return {
          ok: false,
          error: "Could not open that server. The previous instance was left unchanged.",
        };
      }

      const appWindow = mainWindow;
      const rendererWatch =
        appWindow !== null && !appWindow.isDestroyed()
          ? watchRendererUntilCommitted(appWindow)
          : null;
      try {
        await writeSetup(userDataDir, openSetup);
        if (rendererWatch?.crashed()) {
          const message = await recoverFromCrashedSave(userDataDir, previousSetup, previousUrl);
          return { ok: false, error: message };
        }
        // Commit while the crash listener is still armed.
        commitPendingAppSwitch();
        if (rendererWatch?.crashed()) {
          const message = await recoverFromCrashedSave(userDataDir, previousSetup, previousUrl);
          return { ok: false, error: message };
        }
        destroySetupWindow();
        // Final check after setup closes — a crash in this gap still rolls back.
        if (rendererWatch?.crashed()) {
          const message = await recoverFromCrashedSave(userDataDir, previousSetup, previousUrl);
          return { ok: false, error: message };
        }
        return { ok: true };
      } catch {
        const outcome = abandonPendingAppSwitch(previousSetup, previousUrl);
        return {
          ok: false,
          error:
            outcome === "restored"
              ? "Could not save setup. The previous instance was restored."
              : "Connected, but could not save setup for the next launch. Try Continue again.",
        };
      } finally {
        rendererWatch?.dispose();
      }
    } finally {
      setupSaveInProgress = false;
    }
  });

  ipcMain.handle("desktop.setup.quit", (event) => {
    if (fromSetupWindow(event)) app.quit();
  });
  ipcMain.handle("desktop.setup.openLink", async (event, link: unknown) => {
    if (!fromSetupWindow(event) || !isDesktopSetupLink(link)) return;
    await shell.openExternal(DOCKER_INSTALL_LINKS[link]);
  });
  ipcMain.handle("desktop.setup.stack.state", (event) =>
    fromSetupWindow(event) ? localStack.state() : null,
  );
  ipcMain.handle("desktop.setup.stack.start", (event) => {
    if (!fromSetupWindow(event)) return null;
    // Respond right away; the setup window polls `stack.state` until a terminal phase.
    void localStack.start();
    return localStack.state();
  });

  // Register before startup awaits so macOS dock clicks during probe/open are handled.
  app.on("activate", () => {
    if (setupWindow !== null && !setupWindow.isDestroyed()) {
      setupWindow.show();
      setupWindow.focus();
      return;
    }
    if (mainWindow !== null && !mainWindow.isDestroyed()) {
      clearTimeout(warmWindowTimer);
      mainWindow.show();
      mainWindow.focus();
      return;
    }
    if (appOpener.busy()) return;
    if (currentTargetUrl === null) showSetupWindow(setupError);
    else
      void appOpener.open(currentTargetUrl).then((opened) => {
        if (opened) commitPendingAppSwitch();
      });
  });

  if (target.kind === "setup") {
    showSetupWindow();
  } else if (target.source === "saved") {
    if (currentSetup?.mode === "new") {
      const managedUrl = managedLocalOpenUrl(target.url, localStack.webUrl());
      const managedStackReady =
        managedUrl !== null ? await localStack.matchesDesiredStack() : false;
      if (managedStackReady && managedUrl !== null) {
        if (await appOpener.open(managedUrl)) {
          commitPendingAppSwitch();
          destroySetupWindow();
        }
      } else {
        // Missing, stale, foreign, or owned by another process: reconcile the
        // app-managed stack before any API or computer traffic is allowed.
        void localStack.start();
        showSetupWindow();
      }
    } else {
      const reachability = await probeServer(target.url);
      if (reachability.ok) {
        if (await appOpener.open(target.url)) {
          commitPendingAppSwitch();
          destroySetupWindow();
        }
      } else {
        showSetupWindow(`Could not reconnect to the saved server. ${reachability.error}`);
      }
    }
  } else {
    if (await appOpener.open(target.url)) {
      commitPendingAppSwitch();
      destroySetupWindow();
    }
  }
});

app.on("window-all-closed", () => {
  // A hidden session probe (defaultSessionHasOriginData) can be the only window
  // during startup; its teardown must not quit the app.
  if (liveProbeWindows > 0) return;
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  quitting = true;
  clearTimeout(warmWindowTimer);
  // Containers keep running; only an in-flight pull/up is cut short.
  localStack?.abort();
  void localStack?.closeAppControl();
});
