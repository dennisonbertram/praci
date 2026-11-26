import type { BluetoothDevice } from "electron";

const COLLECT_MS = 3_000;
const GIVE_UP_MS = 30_000;
export const UNKNOWN_DEVICE = "Unknown device";

export type BluetoothPickerDeps = {
  /** Previously chosen device id, if any. */
  readSaved: () => string | null;
  writeSaved: (deviceId: string) => void;
  /** Shows a native chooser with one button per name plus Cancel. Resolves to the index, or -1. */
  choose: (names: string[], signal: AbortSignal) => Promise<number>;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (timer: unknown) => void;
};

type Pending = {
  callback: (deviceId: string) => void;
  devices: BluetoothDevice[];
  collectTimer: unknown;
  giveUpTimer: unknown;
  abort: AbortController;
  collecting: boolean;
  prompting: boolean;
};

/**
 * Answers Electron's repeating `select-bluetooth-device` event. Events from one scan share a
 * single pending request; the newest callback is the one that gets the answer.
 * ponytail: a second requestDevice during a scan looks like another scan event, so it cannot
 * be told apart (likewise across frames, but the app has one Bluetooth-capable frame); the page's own requestDevice rules apply.
 */
export function createBluetoothPicker(deps: BluetoothPickerDeps) {
  let pending: Pending | null = null;

  function finish(request: Pending, deviceId: string) {
    if (pending !== request) return;
    pending = null;
    request.abort.abort();
    deps.clearTimer(request.collectTimer);
    deps.clearTimer(request.giveUpTimer);
    if (deviceId !== "") {
      deps.writeSaved(deviceId);
    }
    request.callback(deviceId);
  }

  async function prompt(request: Pending) {
    if (request.prompting || request.devices.length === 0) return;
    request.prompting = true;
    const devices = request.devices;
    const labels = devices.map((device) => device.deviceName || UNKNOWN_DEVICE);
    let index = -1;
    try {
      index = await deps.choose(labels, request.abort.signal);
    } catch {
      index = -1;
    }
    finish(request, devices[index]?.deviceId ?? "");
  }

  return {
    select(devices: BluetoothDevice[], callback: (deviceId: string) => void) {
      const saved = deps.readSaved();
      const savedDevice = saved === null ? undefined : devices.find((d) => d.deviceId === saved);
      if (pending === null) {
        const request: Pending = {
          callback,
          devices,
          abort: new AbortController(),
          collecting: true,
          prompting: false,
          collectTimer: undefined,
          giveUpTimer: undefined,
        };
        pending = request;
        request.collectTimer = deps.setTimer(() => {
          request.collecting = false;
          void prompt(request);
        }, COLLECT_MS);
        request.giveUpTimer = deps.setTimer(() => {
          // Also closes a chooser nobody answered; the late answer is ignored.
          finish(request, "");
        }, GIVE_UP_MS);
      } else {
        pending.callback = callback;
        pending.devices = devices;
      }
      const request = pending;
      if (savedDevice) {
        finish(request, savedDevice.deviceId);
      } else if (!request.collecting) {
        void prompt(request);
      }
    },
    /** Cancel any scan in progress, for example when the window closes. */
    cancel() {
      if (pending) finish(pending, "");
    },
    /** Pairing confirmation. Electron passes the device's display name as `deviceName`. */
    async confirmPairing(deviceName: string) {
      const label = deviceName || UNKNOWN_DEVICE;
      return (await deps.choose([label], new AbortController().signal).catch(() => -1)) === 0;
    },
  };
}

/** Saved device ids keyed by app origin, so consent given on one server never applies to another. */
export function originKeyedStore(
  read: () => Record<string, string>,
  write: (all: Record<string, string>) => void,
  origin: () => string | null,
) {
  return {
    readSaved: () => {
      const key = origin();
      return key === null ? null : (read()[key] ?? null);
    },
    writeSaved: (deviceId: string) => {
      const key = origin();
      if (key !== null) write({ ...read(), [key]: deviceId });
    },
  };
}

type PairingTarget<D> = {
  allows: (details: D) => boolean;
  picker: { confirmPairing: (deviceName: string) => Promise<boolean> };
};

/**
 * Session-wide pairing handler. It looks up the active window on every request, so a window
 * that was replaced, destroyed or rolled back is never consulted.
 */
export function createPairingHandler<D extends { deviceId: string }>(
  active: () => PairingTarget<D> | null,
) {
  return (details: D, callback: (response: { confirmed: boolean }) => void) => {
    const target = active();
    if (target === null || !target.allows(details)) {
      callback({ confirmed: false });
      return;
    }
    void target.picker.confirmPairing(details.deviceId).then((confirmed) => callback({ confirmed }));
  };
}
