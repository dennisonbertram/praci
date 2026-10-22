import type { DataRoomApiImport } from "@rakazo/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { DATA_ROOM_CHANGED, DATA_ROOM_IMPORT_STARTED } from "../../lib/data-room";
import { rpc } from "../../lib/rpc";

const POLL_MS = 3_000;

/**
 * The imports running or just finished. It reads them on mount and when one starts, and again
 * every few seconds only while one is running; each read also asks the page to reload what the
 * import has filed so far, and once more when the last one finishes.
 */
export function useDataRoomImports() {
  const [imports, setImports] = useState<DataRoomApiImport[]>([]);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const wasActive = useRef(false);
  const firstRead = useRef(true);
  const read = useCallback(
    () =>
      rpc.dataRoom
        .imports()
        .then((next) => {
          setImports(next);
          // An import that finished before this visit was reported on earlier; it must not
          // greet every reload for hours.
          if (firstRead.current) {
            const old = next.filter((entry) => entry.finished).map((entry) => entry.id);
            setDismissed((prev) => new Set([...prev, ...old]));
          }
          firstRead.current = false;
        })
        .catch(() => undefined),
    [],
  );

  useEffect(() => {
    void read();
    window.addEventListener(DATA_ROOM_IMPORT_STARTED, read);
    return () => window.removeEventListener(DATA_ROOM_IMPORT_STARTED, read);
  }, [read]);

  const active = imports.some((entry) => !entry.finished);
  useEffect(() => {
    if (active) {
      const timer = setInterval(() => {
        window.dispatchEvent(new Event(DATA_ROOM_CHANGED));
        void read();
      }, POLL_MS);
      wasActive.current = true;
      return () => clearInterval(timer);
    }
    if (wasActive.current) {
      wasActive.current = false;
      window.dispatchEvent(new Event(DATA_ROOM_CHANGED));
    }
  }, [active, read]);

  const dismiss = useCallback(
    (ids: string[]) => setDismissed((prev) => new Set([...prev, ...ids])),
    [],
  );
  return { imports: imports.filter((entry) => !dismissed.has(entry.id)), dismiss };
}
