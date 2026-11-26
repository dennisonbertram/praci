import type { OmiStatus } from "@rakazo/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { desktopBridge } from "../desktop";
import { rpc, withSpaceHeaders } from "../rpc";
import type { BluetoothDevice } from "./bluetooth";
import {
  bluetoothSupported,
  browserDeviceId,
  openPendant,
  pickPendant,
  savedPendant,
} from "./bluetooth";
import type { RecordStore } from "./buffer";
import { createRecordStore, flushRecords } from "./buffer";
import { isRingBufferFirmware } from "./protocol";
import { downloadSession } from "./session";

export type OmiSyncState =
  | { kind: "unsupported" }
  | { kind: "idle" }
  | { kind: "reconnect" }
  | { kind: "connecting" }
  | { kind: "downloading"; done: number | null; total: number | null }
  | { kind: "paused"; done: number; total: number | null }
  | { kind: "synced"; at: number }
  | { kind: "old_firmware" }
  | { kind: "upload_failed" }
  | { kind: "failed" };

function recordStore(ref: { current: RecordStore | null }): RecordStore {
  if (!ref.current) ref.current = createRecordStore();
  return ref.current;
}

const AUTO_SYNC_MS = 15 * 60 * 1000;

/** A failed upload; the records are still in the buffer. */
class UploadError extends Error {}

async function post(
  path: string,
  connectionId: string,
  params: Record<string, string>,
  body?: Uint8Array,
) {
  const query = new URLSearchParams({ connectionId, ...params });
  const response = await fetch(`${path}?${query}`, {
    method: "POST",
    credentials: "include",
    headers: withSpaceHeaders({ "content-type": "application/octet-stream" }),
    ...(body ? { body: body as BodyInit } : {}),
  }).catch(() => null);
  if (!response?.ok) throw new UploadError(`Upload failed (${response?.status})`);
}

/** Pulls the pendant's recordings into the browser's buffer and on to the server. */
export function useOmiSync(status: OmiStatus | undefined, reload: () => Promise<void>) {
  const [state, setState] = useState<OmiSyncState>(
    bluetoothSupported() ? { kind: "idle" } : { kind: "unsupported" },
  );
  const store = useRef<RecordStore | null>(null);
  const running = useRef(false);
  const connectionId = status?.connectionId;
  // Uploads on the server that no assembly has handled; read through a ref so the open effect runs once.
  const pending = useRef(false);
  pending.current = (status?.pendingUploads ?? 0) > 0;

  const upload = useCallback(
    (id: string) =>
      flushRecords(recordStore(store), (batch) =>
        post(
          "/api/omi/records",
          id,
          {
            firstSeq: String(batch.firstSeq),
            codec: String(batch.codec),
            rtcValid: String(batch.rtcValid),
          },
          batch.bytes,
        ),
      ),
    [],
  );

  const sync = useCallback(
    async (chosen?: BluetoothDevice) => {
      if (running.current || !bluetoothSupported()) return;
      running.current = true;
      setState({ kind: "connecting" });
      let device: BluetoothDevice | null = null;
      let lastProgress = { done: 0, total: null as number | null };
      try {
        device = chosen ?? (await savedPendant()) ?? (await pickPendant());
        const link = await openPendant(device);
        if (!isRingBufferFirmware(link.firmware)) {
          setState({ kind: "old_firmware" });
          return;
        }
        if (link.frameMs === null) {
          setState({ kind: "failed" });
          return;
        }
        const id =
          connectionId ??
          (
            await rpc.omi.connect({
              model: link.model || "Omi",
              firmware: link.firmware,
              hardware: link.hardware || "Unknown",
              deviceId: browserDeviceId(),
            })
          ).connectionId;
        if (!connectionId) void reload();
        // Records left by a closed tab go first, in seq order.
        const left = await upload(id);
        const { rtcValid } = await link.transport.readStatus();
        const abort = new AbortController();
        device.addEventListener("gattserverdisconnected", () => abort.abort(), {
          once: true,
        });
        setState({ kind: "downloading", done: null, total: null });
        const result = await downloadSession({
          transport: link.transport,
          store: recordStore(store),
          codec: link.codec,
          rtcValid,
          frameMs: link.frameMs,
          signal: abort.signal,
          upload: () => upload(id),
          assemble: () => post("/api/omi/sync-complete", id, {}),
          hadPending: left > 0 || pending.current,
          onProgress: (progress) => {
            lastProgress = progress;
            setState({ kind: "downloading", ...progress });
          },
        });
        if (result.outcome === "complete") {
          setState({ kind: "synced", at: Date.now() });
        } else {
          setState({ kind: "paused", ...lastProgress });
        }
        void reload();
      } catch (error) {
        // Closing the chooser is not a failure.
        if (error instanceof UploadError) {
          setState({ kind: "upload_failed" });
        } else if (error instanceof DOMException && error.name === "NotFoundError") {
          // No pendant to read, but uploads waiting on the server can still be turned into recordings.
          if (connectionId && pending.current) {
            await post("/api/omi/sync-complete", connectionId, {}).catch(() => undefined);
            void reload();
          }
          setState(connectionId ? { kind: "reconnect" } : { kind: "idle" });
        } else {
          setState(
            lastProgress.done > 0 ? { kind: "paused", ...lastProgress } : { kind: "failed" },
          );
        }
      } finally {
        device?.gatt?.disconnect();
        running.current = false;
      }
    },
    [connectionId, reload, upload],
  );

  // On open: send what an earlier tab left behind, then reuse the allowed pendant or ask to reconnect.
  const opened = useRef<string | null>(null);
  useEffect(() => {
    if (!connectionId || opened.current === connectionId || !bluetoothSupported()) return;
    opened.current = connectionId;
    void (async () => {
      const left = await upload(connectionId).catch(() => 0);
      if (left > 0 || pending.current) {
        await post("/api/omi/sync-complete", connectionId, {}).catch(() => undefined);
      }
      const device = await savedPendant();
      if (device) void sync(device);
      else setState({ kind: "reconnect" });
    })();
  }, [connectionId, sync, upload]);

  // The desktop app stays open: sync again every 15 minutes after a first success.
  const synced = state.kind === "synced";
  useEffect(() => {
    if (!synced || !desktopBridge()) return;
    const timer = setInterval(
      () => void savedPendant().then((device) => device && sync(device)),
      AUTO_SYNC_MS,
    );
    return () => clearInterval(timer);
  }, [synced, sync]);

  return { state, sync: () => sync() };
}
