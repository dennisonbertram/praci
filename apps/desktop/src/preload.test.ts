import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import type { RakazoDesktop, RakazoSetup } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";

function runPreload(
  file: string,
  ipc: { invoke?: unknown; on?: unknown; off?: unknown } = {},
  platform = "linux",
) {
  const invoke =
    (ipc.invoke as ReturnType<typeof vi.fn>) ?? vi.fn(async (channel: string) => ({ channel }));
  const on = (ipc.on as ReturnType<typeof vi.fn>) ?? vi.fn();
  const off = (ipc.off as ReturnType<typeof vi.fn>) ?? vi.fn();
  const exposeInMainWorld = vi.fn();
  const source = readFileSync(path.join(import.meta.dirname, file), "utf8");

  vm.runInNewContext(source, {
    process: { platform },
    require(moduleName: string) {
      if (moduleName !== "electron") throw new Error(`Unexpected preload import: ${moduleName}`);
      return { contextBridge: { exposeInMainWorld }, ipcRenderer: { invoke, on, off } };
    },
  });

  return { invoke, on, off, exposeInMainWorld };
}

describe("desktop preload bridge", () => {
  it("exposes the scoped desktop bridges", async () => {
    const { invoke, exposeInMainWorld } = runPreload("preload.cjs");

    expect(exposeInMainWorld).toHaveBeenCalledTimes(1);
    const [globalName, bridge] = exposeInMainWorld.mock.calls[0] as [string, RakazoDesktop];
    expect(globalName).toBe("rakazoDesktop");
    expect(bridge.platform).toBe("linux");
    expect(Object.keys(bridge).sort()).toEqual([
      "hex",
      "localSettings",
      "oauth",
      "platform",
      "scanner",
      "speech",
      "update",
      "window",
    ]);
    expect(Object.keys(bridge.window).sort()).toEqual([
      "close",
      "focus",
      "minimize",
      "state",
      "toggleMaximize",
    ]);
    expect(Object.keys(bridge.update).sort()).toEqual(["check", "download", "install", "state"]);
    expect(Object.keys(bridge.hex ?? {}).sort()).toEqual(["available", "list", "show"]);
    expect(Object.keys(bridge.speech ?? {}).sort()).toEqual([
      "forget",
      "onStatus",
      "prepare",
      "status",
      "transcribe",
    ]);
    expect(Object.keys(bridge.scanner ?? {}).sort()).toEqual([
      "cancel",
      "confirm",
      "onDocument",
      "onState",
      "pending",
      "scan",
      "setAutoScan",
      "setFolder",
      "setScope",
      "state",
    ]);

    await bridge.oauth.open?.("https://provider.example.com/authorize");
    await bridge.oauth.cancel?.("https://provider.example.com/authorize");
    await bridge.window.close();
    await bridge.window.minimize();
    await bridge.window.focus?.();
    await bridge.window.toggleMaximize();
    await bridge.window.state();
    await bridge.update.state();
    await bridge.update.check();
    await bridge.update.download();
    await bridge.update.install();
    await bridge.hex?.available();
    await bridge.hex?.list(1);
    await bridge.hex?.show("1-2");
    await bridge.speech?.status();
    await bridge.speech?.prepare();
    await bridge.speech?.forget();
    await bridge.speech?.transcribe(new Uint8Array(44));
    await bridge.scanner?.state();
    await bridge.scanner?.scan();
    await bridge.scanner?.cancel();
    await bridge.scanner?.setAutoScan(false);
    await bridge.scanner?.setFolder(["folder-id"]);
    await bridge.scanner?.setScope({ userId: "user-id", spaceId: "space-id" });
    await bridge.scanner?.pending();
    await bridge.scanner?.confirm("scan-id", "a".repeat(64));
    expect(invoke.mock.calls.map(([channel]) => channel)).toEqual([
      "desktop.oauth.open",
      "desktop.oauth.cancel",
      "desktop.window.close",
      "desktop.window.minimize",
      "desktop.window.focus",
      "desktop.window.toggleMaximize",
      "desktop.window.state",
      "desktop.update.state",
      "desktop.update.check",
      "desktop.update.download",
      "desktop.update.install",
      "desktop.hex.available",
      "desktop.hex.list",
      "desktop.hex.show",
      "desktop.speech.status",
      "desktop.speech.prepare",
      "desktop.speech.forget",
      "desktop.speech.transcribe",
      "desktop.scanner.state",
      "desktop.scanner.scan",
      "desktop.scanner.cancel",
      "desktop.scanner.setAutoScan",
      "desktop.scanner.setFolder",
      "desktop.scanner.setScope",
      "desktop.scanner.pending",
      "desktop.scanner.confirm",
    ]);
  });

  it("forwards scanner state and document events without the IPC event and can unsubscribe", () => {
    const listeners: Array<(event: unknown, payload: unknown) => void> = [];
    const on = vi.fn((_channel: string, handler: (event: unknown, payload: unknown) => void) => {
      listeners.push(handler);
    });
    const off = vi.fn();
    const { exposeInMainWorld } = runPreload("preload.cjs", { on, off });
    const [, bridge] = exposeInMainWorld.mock.calls[0] as [string, RakazoDesktop];
    const states: unknown[] = [];
    const documents: unknown[] = [];
    const removeState = bridge.scanner?.onState((state) => states.push(state));
    const removeDocument = bridge.scanner?.onDocument((document) => documents.push(document));
    const state = { kind: "ready", autoScan: true, folder: [] };
    const document = { id: "synthetic", bytes: new Uint8Array([1]) };

    expect(on.mock.calls.map(([channel]) => channel)).toEqual([
      "desktop.scanner.state.changed",
      "desktop.scanner.document",
    ]);
    listeners[0]?.({ sender: "hidden" }, state);
    listeners[1]?.({ sender: "hidden" }, document);
    expect(states).toEqual([state]);
    expect(documents).toEqual([document]);
    removeState?.();
    removeDocument?.();
    expect(off).toHaveBeenCalledWith("desktop.scanner.state.changed", listeners[0]);
    expect(off).toHaveBeenCalledWith("desktop.scanner.document", listeners[1]);
  });

  it("does not expose the scanner bridge on Windows", () => {
    const { exposeInMainWorld: exposeMac } = runPreload("preload.cjs", {}, "darwin");
    const [, macBridge] = exposeMac.mock.calls[0] as [string, RakazoDesktop];
    expect(macBridge.scanner).toBeDefined();

    const { exposeInMainWorld } = runPreload("preload.cjs", {}, "win32");
    const [, bridge] = exposeInMainWorld.mock.calls[0] as [string, RakazoDesktop];
    expect(bridge.scanner).toBeUndefined();
    expect(Object.keys(bridge)).not.toContain("scanner");
  });

  it("forwards speech status pushes without the IPC event and can unsubscribe", () => {
    const listeners: Array<(event: unknown, status: unknown) => void> = [];
    const on = vi.fn((_channel: string, handler: (event: unknown, status: unknown) => void) => {
      listeners.push(handler);
    });
    const off = vi.fn();
    const { exposeInMainWorld } = runPreload("preload.cjs", { on, off });
    const [, bridge] = exposeInMainWorld.mock.calls[0] as [string, RakazoDesktop];
    const received: unknown[] = [];
    const unsubscribe = bridge.speech?.onStatus((status) => received.push(status));
    expect(on.mock.calls[0]?.[0]).toBe("desktop.speech.status");
    listeners[0]?.({ sender: "secret" }, { state: "ready" });
    expect(received).toEqual([{ state: "ready" }]);
    unsubscribe?.();
    expect(off).toHaveBeenCalledWith("desktop.speech.status", listeners[0]);
  });

  it("keeps setup off the app bridge so a connected server cannot re-point the app", () => {
    const { exposeInMainWorld } = runPreload("preload.cjs");
    const [, bridge] = exposeInMainWorld.mock.calls[0] as [string, Record<string, unknown>];
    expect(Object.keys(bridge).sort()).toEqual([
      "hex",
      "localSettings",
      "oauth",
      "platform",
      "scanner",
      "speech",
      "update",
      "window",
    ]);
  });

  it("forwards captured codes without leaking the IPC event to the renderer", () => {
    const listeners: Array<(event: unknown, callback: unknown) => void> = [];
    const on = vi.fn((_channel: string, handler: (event: unknown, callback: unknown) => void) => {
      listeners.push(handler);
    });
    const off = vi.fn();
    const { exposeInMainWorld } = runPreload("preload.cjs", { on, off });

    const [, bridge] = exposeInMainWorld.mock.calls[0] as [string, RakazoDesktop];
    const received: unknown[] = [];
    const unsubscribe = bridge.oauth.onCallback((callback) => received.push(callback));

    expect(on).toHaveBeenCalledWith("desktop.oauth.callback", expect.any(Function));
    listeners[0]?.({ sender: "ipc-event" }, { code: "ac_123", state: "verifier_456" });
    expect(received).toEqual([{ code: "ac_123", state: "verifier_456" }]);

    unsubscribe();
    expect(off).toHaveBeenCalledWith("desktop.oauth.callback", expect.any(Function));
  });
});

describe("setup preload bridge", () => {
  it("exposes only the first-run setup operations", async () => {
    const { invoke, on, exposeInMainWorld } = runPreload("setup-preload.cjs");

    expect(exposeInMainWorld).toHaveBeenCalledTimes(1);
    const [globalName, bridge] = exposeInMainWorld.mock.calls[0] as [string, RakazoSetup];
    expect(globalName).toBe("rakazoSetup");
    expect(bridge.platform).toBe("linux");
    expect(Object.keys(bridge).sort()).toEqual([
      "openLink",
      "platform",
      "quit",
      "save",
      "stack",
      "state",
      "test",
    ]);
    expect(Object.keys(bridge.stack).sort()).toEqual(["onChange", "start", "state"]);

    await bridge.state();
    await bridge.test("http://127.0.0.1:5173");
    await bridge.save({ mode: "new", serverUrl: "http://127.0.0.1:5173" });
    await bridge.quit();
    await bridge.openLink("orbstack");
    await bridge.stack.state();
    await bridge.stack.start();
    expect(invoke.mock.calls.map(([channel]) => channel)).toEqual([
      "desktop.setup.state",
      "desktop.setup.test",
      "desktop.setup.save",
      "desktop.setup.quit",
      "desktop.setup.openLink",
      "desktop.setup.stack.state",
      "desktop.setup.stack.start",
    ]);
    expect(invoke).toHaveBeenCalledWith("desktop.setup.openLink", "orbstack");

    const listener = vi.fn();
    bridge.stack.onChange(listener);
    const [channel, handler] = on.mock.calls.at(-1) as [string, (...args: unknown[]) => void];
    expect(channel).toBe("desktop.setup.stack.changed");
    handler({}, { phase: "pulling" });
    expect(listener).toHaveBeenCalledWith({ phase: "pulling" });
  });
});
