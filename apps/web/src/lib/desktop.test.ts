import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  desktopOAuthCode,
  nativeGoogleAvailable,
  oauthStateOf,
  onDesktopOAuthCallback,
  type RakazoDesktop,
  type RakazoDesktopOAuthCallback,
  signInWithSystemBrowser,
  windowChromeKind,
} from "./desktop.js";

function desktop(platform: string): RakazoDesktop {
  const updateState = {
    phase: "unsupported" as const,
    currentVersion: "0.1.0",
    availableVersion: null,
    percent: null,
    message: "Automatic updates only run in an installed build.",
    checkedAt: null,
  };
  return {
    platform,
    window: {
      close: async () => undefined,
      minimize: async () => undefined,
      toggleMaximize: async () => undefined,
      state: async () => ({ minimized: false, maximized: false, fullScreen: false }),
    },
    update: {
      state: async () => updateState,
      check: async () => updateState,
      download: async () => updateState,
      install: async () => updateState,
    },
    oauth: { onCallback: () => () => undefined },
  };
}

describe("window chrome", () => {
  it("does not paint fake traffic lights in the browser", () => {
    expect(windowChromeKind(undefined)).toBe("spacer");
  });

  it("leaves macOS traffic lights to Electron", () => {
    expect(windowChromeKind(desktop("darwin"))).toBe("darwin");
  });

  it("uses real window-control buttons on Windows and Linux", () => {
    expect(windowChromeKind(desktop("win32"))).toBe("controls");
    expect(windowChromeKind(desktop("linux"))).toBe("controls");
  });

  it("does not paint fake traffic lights into the browser shell or welcome page", () => {
    const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../pages");
    const shell = readFileSync(path.join(root, "Shell.tsx"), "utf8");
    const welcome = readFileSync(path.join(root, "Welcome.tsx"), "utf8");
    expect(shell).not.toContain("FF5F57");
    expect(welcome).not.toContain("FF5F57");
  });

  it("keeps conversation header controls clickable", () => {
    const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../pages");
    const shell = readFileSync(path.join(root, "Shell.tsx"), "utf8");
    expect(shell).toContain("app-drag flex items-center justify-between px-3 md:px-[22px]");
    expect(shell).toContain('className="app-no-drag grid h-8 w-8');
    expect(shell).toContain('className="app-no-drag flex min-w-0 items-center gap-3"');
    expect(shell.match(/className="app-no-drag grid h-\[30px\] w-\[34px\]/g)).toHaveLength(2);
  });

  it("moves window chrome into the conversation header when the bots sidebar is collapsed", () => {
    const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../pages");
    const shell = readFileSync(path.join(root, "Shell.tsx"), "utf8");
    expect(shell).toContain("{botsSidebarCollapsed && desktopBridge() ? <WindowChrome /> : null}");
  });

  it("leaves window chrome to the shell on the artifacts page, which now sits inside it", () => {
    const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../pages");
    const artifacts = readFileSync(path.join(root, "Artifacts.tsx"), "utf8");
    expect(artifacts).not.toContain("AppRail");
    expect(artifacts).not.toContain("<WindowChrome");
  });
});

describe("captured OAuth callbacks", () => {
  it("sends the code and state as the compact form the paste flow accepts", () => {
    expect(desktopOAuthCode({ code: "ac_123", state: "verifier_456" })).toBe("ac_123#verifier_456");
  });

  it("sends a bare code when the provider redirects without state", () => {
    expect(desktopOAuthCode({ code: "ac_123" })).toBe("ac_123");
  });
});

describe("attempt correlation", () => {
  afterEach(() => vi.unstubAllGlobals());

  function bridgeEmitting() {
    let emit: (callback: RakazoDesktopOAuthCallback) => void = () => undefined;
    const unsubscribe = vi.fn();
    vi.stubGlobal("window", {
      rakazoDesktop: {
        ...desktop("linux"),
        oauth: {
          onCallback: (listener: (callback: RakazoDesktopOAuthCallback) => void) => {
            emit = listener;
            return unsubscribe;
          },
        },
      },
    });
    return { emit: (c: RakazoDesktopOAuthCallback) => emit(c), unsubscribe };
  }

  it("reads the attempt state out of the authorize URL", () => {
    expect(oauthStateOf("https://claude.ai/oauth/authorize?code=true&state=verifier_456")).toBe(
      "verifier_456",
    );
    expect(oauthStateOf("https://claude.ai/oauth/authorize?code=true")).toBeUndefined();
    expect(oauthStateOf("not a url")).toBeUndefined();
  });

  it("ignores a code captured for a different attempt", () => {
    const { emit } = bridgeEmitting();
    const received: string[] = [];
    onDesktopOAuthCallback((code) => received.push(code), "verifier_456");

    emit({ code: "stale", state: "verifier_000" });
    expect(received).toEqual([]);

    emit({ code: "ac_123", state: "verifier_456" });
    expect(received).toEqual(["ac_123#verifier_456"]);
  });

  it("accepts any code when the provider carries no state to correlate on", () => {
    const { emit } = bridgeEmitting();
    const received: string[] = [];
    onDesktopOAuthCallback((code) => received.push(code));

    emit({ code: "ac_123" });
    expect(received).toEqual(["ac_123"]);
  });

  it("no-ops in a browser without the desktop bridge", () => {
    vi.stubGlobal("window", {});
    const received: string[] = [];
    expect(() => onDesktopOAuthCallback((code) => received.push(code))()).not.toThrow();
    expect(received).toEqual([]);
  });
});

describe("nativeGoogleAvailable", () => {
  it("is on in a browser, off in a desktop without system-browser sign-in, on with it", () => {
    expect(nativeGoogleAvailable(undefined)).toBe(true);
    expect(
      nativeGoogleAvailable({ ...desktop("darwin"), oauth: { onCallback: () => () => {} } }),
    ).toBe(false);
    expect(
      nativeGoogleAvailable({
        ...desktop("darwin"),
        oauth: { open: async () => undefined, onCallback: () => () => {} },
      }),
    ).toBe(true);
  });

  it("is off in a desktop app built before the sign-in bridge existed", () => {
    const { oauth: _missing, ...older } = desktop("darwin");
    expect(nativeGoogleAvailable(older as RakazoDesktop)).toBe(false);
  });
});

describe("signInWithSystemBrowser", () => {
  afterEach(() => vi.unstubAllGlobals());
  const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth?state=state-1";

  function bridge(open: (url: string) => Promise<void> = async () => undefined) {
    let emit: (callback: RakazoDesktopOAuthCallback) => void = () => undefined;
    const unsubscribe = vi.fn();
    const cancel = vi.fn(async () => undefined);
    vi.stubGlobal("window", {
      rakazoDesktop: {
        ...desktop("linux"),
        oauth: {
          open: vi.fn(open),
          cancel,
          onCallback: (listener: (callback: RakazoDesktopOAuthCallback) => void) => {
            emit = listener;
            return unsubscribe;
          },
        },
      },
    });
    return { emit: (c: RakazoDesktopOAuthCallback) => emit(c), unsubscribe, cancel };
  }

  it("resolves with the callback for this attempt's state and ignores any other", async () => {
    const b = bridge();
    const result = signInWithSystemBrowser(AUTH_URL, new AbortController().signal);
    await Promise.resolve();
    b.emit({ code: "stale", state: "other" });
    b.emit({ code: "ac_1", state: "state-1" });
    await expect(result).resolves.toEqual({ code: "ac_1", state: "state-1" });
    expect(b.unsubscribe).toHaveBeenCalled();
  });

  it("rejects and cancels the listener when aborted", async () => {
    const b = bridge();
    const controller = new AbortController();
    const result = signInWithSystemBrowser(AUTH_URL, controller.signal);
    await Promise.resolve();
    controller.abort();
    await expect(result).rejects.toThrow(/cancelled/i);
    expect(b.cancel).toHaveBeenCalledWith(AUTH_URL);
    expect(b.unsubscribe).toHaveBeenCalled();
  });

  it("gives up after the timeout", async () => {
    vi.useFakeTimers();
    try {
      const b = bridge();
      const result = signInWithSystemBrowser(AUTH_URL, new AbortController().signal);
      const settled = expect(result).rejects.toThrow(/timed out/i);
      await vi.advanceTimersByTimeAsync(5 * 60_000);
      await settled;
      expect(b.cancel).toHaveBeenCalledWith(AUTH_URL);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects when the browser cannot be opened", async () => {
    const b = bridge(async () => {
      throw new Error("Could not open browser sign-in.");
    });
    await expect(signInWithSystemBrowser(AUTH_URL, new AbortController().signal)).rejects.toThrow(
      /Could not open/,
    );
    expect(b.unsubscribe).toHaveBeenCalled();
  });

  it("refuses an authorization URL it cannot correlate", async () => {
    bridge();
    await expect(
      signInWithSystemBrowser("https://accounts.google.com/o", new AbortController().signal),
    ).rejects.toThrow(/unavailable/i);
  });
});
