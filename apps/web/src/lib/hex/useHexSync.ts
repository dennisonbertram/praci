import type { RakazoDesktopHex } from "@rakazo/contracts";
import { useEffect, useSyncExternalStore } from "react";
import { desktopBridge } from "../desktop";
import { rpc } from "../rpc";
import type { HexOutcome } from "./sync";
import { syncHex } from "./sync";

const EVERY_MS = 5 * 60_000;

/** The Hex bridge, only in the macOS desktop app. */
export function hexBridge(): RakazoDesktopHex | undefined {
  const desktop = desktopBridge();
  return desktop?.platform === "darwin" ? desktop.hex : undefined;
}

let outcome: HexOutcome = "idle";
const listeners = new Set<() => void>();
function setOutcome(next: HexOutcome) {
  if (next === outcome) return;
  outcome = next;
  for (const listener of listeners) listener();
}

/** What the last pass found, for the Hex tile. */
export function useHexOutcome(): HexOutcome {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => outcome,
  );
}

let running: Promise<HexOutcome> | null = null;

/** Runs a pass now unless one is already running. */
export function hexSyncNow(): Promise<HexOutcome> {
  const hex = hexBridge();
  if (!hex) return Promise.resolve("off");
  running ??= syncHex({
    hex,
    status: () => rpc.meetings.localStatus(),
    importLocal: (input) => rpc.meetings.importLocal(input),
  })
    .catch((): HexOutcome => "failed")
    .then((next) => {
      setOutcome(next);
      return next;
    })
    .finally(() => {
      running = null;
    });
  return running;
}

/** In the macOS desktop app: sync Hex on start, when the window gains focus and every 5 minutes. */
export function useHexSync() {
  useEffect(() => {
    if (!hexBridge()) return;
    const run = () => void hexSyncNow();
    run();
    window.addEventListener("focus", run);
    const timer = window.setInterval(run, EVERY_MS);
    return () => {
      window.removeEventListener("focus", run);
      window.clearInterval(timer);
    };
  }, []);
}
