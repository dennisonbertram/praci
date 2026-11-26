import type { RingStatus } from "./protocol";
import { codecFrameMs, parseStatus, UUID } from "./protocol";
import type { RingTransport } from "./sync";

/** The parts of Web Bluetooth this page uses; the DOM library does not ship them. */
type Characteristic = EventTarget & {
  value: DataView | null;
  readValue: () => Promise<DataView>;
  writeValueWithResponse: (value: BufferSource) => Promise<void>;
  startNotifications: () => Promise<unknown>;
};
type Service = {
  getCharacteristic: (id: string | number) => Promise<Characteristic>;
};
export type BluetoothDevice = EventTarget & {
  id: string;
  gatt?: {
    connected: boolean;
    connect: () => Promise<{
      getPrimaryService: (id: string | number) => Promise<Service>;
    }>;
    disconnect: () => void;
  };
};
type BluetoothApi = {
  requestDevice: (options: unknown) => Promise<BluetoothDevice>;
  getDevices?: () => Promise<BluetoothDevice[]>;
};

const api = () => (navigator as Navigator & { bluetooth?: BluetoothApi }).bluetooth;

export const bluetoothSupported = () => typeof navigator !== "undefined" && Boolean(api());

const BT_ID_KEY = "praci-omi-bluetooth-id";
const DEVICE_ID_KEY = "praci-omi-device-id";

function remember(key: string, value?: string): string | null {
  try {
    if (value !== undefined) localStorage.setItem(key, value);
    return localStorage.getItem(key);
  } catch {
    return value ?? null;
  }
}

/** A random id for this browser; sent as the connection's device id, never a hardware address. */
export function browserDeviceId(): string {
  const existing = remember(DEVICE_ID_KEY);
  if (existing) return existing;
  const fresh = crypto.randomUUID();
  remember(DEVICE_ID_KEY, fresh);
  return fresh;
}

/** The browser's Bluetooth chooser, limited to Omi pendants. Must run from a click. */
export async function pickPendant(): Promise<BluetoothDevice> {
  const device = await api()?.requestDevice({
    filters: [{ services: [UUID.omi] }],
    optionalServices: [UUID.storage, UUID.battery, UUID.deviceInfo],
  });
  if (!device) throw new Error("Bluetooth is not available");
  remember(BT_ID_KEY, device.id);
  return device;
}

/** The pendant this browser was allowed to use before, when the browser can say. */
export async function savedPendant(): Promise<BluetoothDevice | null> {
  const id = remember(BT_ID_KEY);
  if (!id || !api()?.getDevices) return null;
  try {
    return (await api()?.getDevices?.())?.find((device) => device.id === id) ?? null;
  } catch {
    return null;
  }
}

export type PendantLink = {
  model: string;
  firmware: string;
  hardware: string;
  codec: number;
  frameMs: number | null;
  transport: RingTransport;
};

const text = (view: DataView) =>
  new TextDecoder()
    .decode(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength))
    .replaceAll("\0", "")
    .trim();

/** Connects and reads what the page needs to decide whether it can sync. */
export async function openPendant(device: BluetoothDevice): Promise<PendantLink> {
  const server = await device.gatt?.connect();
  if (!server) throw new Error("Bluetooth is not available");
  const info = await server.getPrimaryService(UUID.deviceInfo);
  const read = async (id: number) => text(await (await info.getCharacteristic(id)).readValue());
  const [model, firmware, hardware] = await Promise.all([
    read(UUID.model),
    read(UUID.firmware),
    read(UUID.hardware),
  ]);
  const omi = await server.getPrimaryService(UUID.omi);
  const codec = (await (await omi.getCharacteristic(UUID.codec)).readValue()).getUint8(0);
  const storage = await server.getPrimaryService(UUID.storage);
  const command = await storage.getCharacteristic(UUID.storageCommand);
  const status = await storage.getCharacteristic(UUID.storageStatus);
  await command.startNotifications();
  const transport: RingTransport = {
    readStatus: async (): Promise<RingStatus> => {
      const parsed = parseStatus(await status.readValue());
      if (!parsed) throw new Error("Unexpected pendant status");
      return parsed;
    },
    write: (bytes) => command.writeValueWithResponse(bytes as BufferSource),
    subscribe: (listener) => {
      const handler = () => {
        const value = command.value;
        if (value) {
          // Copy: the browser reuses the buffer behind `value`.
          listener(
            new Uint8Array(
              value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength),
            ),
          );
        }
      };
      command.addEventListener("characteristicvaluechanged", handler);
      return () => command.removeEventListener("characteristicvaluechanged", handler);
    },
  };
  return {
    model,
    firmware,
    hardware,
    codec,
    frameMs: codecFrameMs(codec),
    transport,
  };
}
