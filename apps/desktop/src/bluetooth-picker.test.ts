import type { BluetoothDevice, WebContents } from "electron";
import { describe, expect, it, vi } from "vitest";
import { createBluetoothPicker, createPairingHandler, originKeyedStore } from "./bluetooth-picker.js";
import { isAppWebContents } from "./session-permissions.js";

const omi = { deviceId: "a", deviceName: "Omi" } as BluetoothDevice;
const other = { deviceId: "b", deviceName: "" } as BluetoothDevice;

function fixture(saved: string | null = null) {
  const timers: { fn: () => void; ms: number; live: boolean }[] = [];
  const choose = vi.fn<(names: string[]) => Promise<number>>();
  const writeSaved = vi.fn();
  const picker = createBluetoothPicker({
    readSaved: () => saved,
    writeSaved,
    choose,
    setTimer: (fn, ms) => {
      const timer = { fn, ms, live: true };
      timers.push(timer);
      return timer;
    },
    clearTimer: (t) => {
      (t as { live: boolean }).live = false;
    },
  });
  return {
    picker,
    choose,
    writeSaved,
    fire: (ms: number) => timers.filter((t) => t.ms === ms && t.live).forEach((t) => t.fn()),
  };
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("bluetooth picker", () => {
  it("selects a saved device immediately without a dialog", () => {
    const f = fixture("a");
    const cb = vi.fn();
    f.picker.select([other, omi], cb);
    expect(cb).toHaveBeenCalledWith("a");
    expect(f.choose).not.toHaveBeenCalled();
  });

  it("collects devices, then prompts with names and saves the choice", async () => {
    const f = fixture();
    f.choose.mockResolvedValue(1);
    const cb = vi.fn();
    f.picker.select([omi], cb);
    f.picker.select([omi, other], cb);
    expect(f.choose).not.toHaveBeenCalled();
    f.fire(3000);
    await flush();
    expect(f.choose).toHaveBeenCalledWith(["Omi", "Unknown device"], expect.anything());
    expect(cb).toHaveBeenCalledWith("b");
    expect(f.writeSaved).toHaveBeenCalledWith("b");
  });

  it("answers an empty id and saves nothing when cancelled", async () => {
    const f = fixture();
    f.choose.mockResolvedValue(-1);
    const cb = vi.fn();
    f.picker.select([omi], cb);
    f.fire(3000);
    await flush();
    expect(cb).toHaveBeenCalledWith("");
    expect(f.writeSaved).not.toHaveBeenCalled();
  });

  it("uses the newest callback for the same scan and a fresh request after finishing", async () => {
    const f = fixture();
    f.choose.mockResolvedValue(0);
    const first = vi.fn();
    const second = vi.fn();
    f.picker.select([omi], first);
    f.picker.select([omi], second);
    f.fire(3000);
    await flush();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith("a");
    const third = vi.fn();
    f.picker.select([omi], third);
    f.fire(3000);
    await flush();
    expect(third).toHaveBeenCalledWith("a");
  });

  it("prompts as soon as a device appears after the collect window", async () => {
    const f = fixture();
    f.choose.mockResolvedValue(0);
    const cb = vi.fn();
    f.picker.select([], cb);
    f.fire(3000);
    expect(f.choose).not.toHaveBeenCalled();
    f.picker.select([omi], cb);
    await flush();
    expect(cb).toHaveBeenCalledWith("a");
  });

  it("gives up with an empty id when no device appears in 30 seconds", () => {
    const f = fixture();
    const cb = vi.fn();
    f.picker.select([], cb);
    f.fire(3000);
    f.fire(30000);
    expect(cb).toHaveBeenCalledWith("");
    expect(f.choose).not.toHaveBeenCalled();
  });

  it("cancel() answers an empty id", () => {
    const f = fixture();
    const cb = vi.fn();
    f.picker.select([omi], cb);
    f.picker.cancel();
    expect(cb).toHaveBeenCalledWith("");
  });

  it("aborts the chooser when the request times out", () => {
    const f = fixture();
    let signal: AbortSignal | undefined;
    f.choose.mockImplementation((_n, s) => {
      signal = s;
      return new Promise(() => {});
    });
    f.picker.select([omi], vi.fn());
    f.fire(3000);
    expect(signal?.aborted).toBe(false);
    f.fire(30000);
    expect(signal?.aborted).toBe(true);
  });

  it("labels pairing with the given name or Unknown device", async () => {
    const f = fixture();
    f.choose.mockResolvedValue(0);
    await f.picker.confirmPairing("Omi");
    await f.picker.confirmPairing("");
    expect(f.choose.mock.calls.map((c) => c[0])).toEqual([["Omi"], ["Unknown device"]]);
  });

  it("does not reuse a saved device on another origin", () => {
    let data: Record<string, string> = {};
    let origin: string | null = "https://a.example.test";
    const store = originKeyedStore(
      () => data,
      (d) => {
        data = d;
      },
      () => origin,
    );
    store.writeSaved("a");
    expect(store.readSaved()).toBe("a");
    origin = "https://b.example.test";
    expect(store.readSaved()).toBeNull();
    origin = null;
    expect(store.readSaved()).toBeNull();
  });

  it("confirms pairing only when the user picks the device", async () => {
    const f = fixture();
    f.choose.mockResolvedValueOnce(0).mockResolvedValueOnce(-1);
    expect(await f.picker.confirmPairing("Omi")).toBe(true);
    expect(await f.picker.confirmPairing("Omi")).toBe(false);
  });
});

describe("Bluetooth app-origin rule", () => {
  const contents = (url: string) =>
    ({ isDestroyed: () => false, getURL: () => url }) as unknown as WebContents;
  it("allows only the app window on the app origin", () => {
    const app = contents("https://app.example.test/chat");
    const target = () => ({ webContents: app, url: "https://app.example.test/" });
    expect(isAppWebContents(app, target)).toBe(true);
    expect(isAppWebContents(contents("https://app.example.test/"), target)).toBe(false);
    const away = contents("https://evil.example.test/");
    expect(
      isAppWebContents(away, () => ({ webContents: away, url: "https://app.example.test/" })),
    ).toBe(false);
    expect(isAppWebContents(app, () => null)).toBe(false);
  });
});

describe("window replacement", () => {
  it("saves a late choice under the origin the request started with", async () => {
    let saved: Record<string, string> = {};
    const store = originKeyedStore(
      () => saved,
      (all) => {
        saved = all;
      },
      () => "https://a.example",
    );
    let collect = () => {};
    const choose = vi.fn<(names: string[]) => Promise<number>>().mockResolvedValue(0);
    const picker = createBluetoothPicker({
      ...store,
      choose,
      setTimer: (fn, ms) => {
        if (ms === 3000) collect = fn;
        return 1;
      },
      clearTimer: () => {},
    });
    picker.select([omi], vi.fn());
    collect();
    await flush();
    expect(saved).toEqual({ "https://a.example": "a" });
  });

  it("cancels a pending request once, without saving", () => {
    const f = fixture();
    const cb = vi.fn();
    f.picker.select([omi], cb);
    f.picker.cancel();
    f.picker.cancel();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith("");
    expect(f.writeSaved).not.toHaveBeenCalled();
  });

  it("pairing handler follows the active window after a rollback", async () => {
    let active: "replacement" | "restored" | null = "replacement";
    const confirm = vi.fn().mockResolvedValue(true);
    const handler = createPairingHandler<{ deviceId: string }>(() =>
      active === null ? null : { allows: () => true, picker: { confirmPairing: confirm } },
    );
    active = "restored";
    const cb = vi.fn();
    handler({ deviceId: "Omi" }, cb);
    await flush();
    expect(confirm).toHaveBeenCalledWith("Omi");
    expect(cb).toHaveBeenCalledWith({ confirmed: true });
    active = null;
    const denied = vi.fn();
    handler({ deviceId: "Omi" }, denied);
    expect(denied).toHaveBeenCalledWith({ confirmed: false });
  });
});
