import type { DataRoomApiProcessing } from "@rakazo/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { DATA_ROOM_CHANGED, DATA_ROOM_IMPORT_STARTED } from "../../lib/data-room";
import { rpc } from "../../lib/rpc";
import { processingRemaining } from "./ProcessingStrip";

const POLL_MS = 10_000;
const DONE_MS = 3_000;

/**
 * What the Data room pipeline still has to do. It reads on mount, when an import starts or the
 * list changes, and every 10 seconds only while files remain. A tick reads only this endpoint;
 * the list and folders reload (DATA_ROOM_CHANGED) only when the counts moved, so a file that
 * stays stuck costs one small request per tick. `total` is the largest backlog seen in this batch;
 * `finished` is true for a few seconds after the backlog empties.
 */
export function useDataRoomProcessing() {
  const [processing, setProcessing] = useState<DataRoomApiProcessing | null>(null);
  const [total, setTotal] = useState(0);
  const [finished, setFinished] = useState(false);
  const wasActive = useRef(false);
  const lastCounts = useRef("");
  const read = useCallback(
    () =>
      rpc.dataRoom
        .processing()
        .then((next) => {
          setProcessing(next);
          setTotal((prev) => Math.max(prev, processingRemaining(next)));
          lastCounts.current = JSON.stringify([
            next.reading,
            next.tagging,
            next.indexing,
            next.failed,
          ]);
        })
        .catch(() => undefined),
    [],
  );
  useEffect(() => {
    void read();
    window.addEventListener(DATA_ROOM_IMPORT_STARTED, read);
    window.addEventListener(DATA_ROOM_CHANGED, read);
    return () => {
      window.removeEventListener(DATA_ROOM_IMPORT_STARTED, read);
      window.removeEventListener(DATA_ROOM_CHANGED, read);
    };
  }, [read]);

  const active = processing !== null && processingRemaining(processing) > 0;
  useEffect(() => {
    if (active) {
      wasActive.current = true;
      setFinished(false);
      const timer = setInterval(() => {
        void rpc.dataRoom
          .processing()
          .then((next) => {
            setProcessing(next);
            setTotal((prev) => Math.max(prev, processingRemaining(next)));
            const counts = JSON.stringify([next.reading, next.tagging, next.indexing, next.failed]);
            if (counts === lastCounts.current) return;
            lastCounts.current = counts;
            window.dispatchEvent(new Event(DATA_ROOM_CHANGED));
          })
          .catch(() => undefined);
      }, POLL_MS);
      return () => clearInterval(timer);
    }
    if (!wasActive.current) return;
    wasActive.current = false;
    setFinished(true);
    const timer = setTimeout(() => {
      setFinished(false);
      setTotal(0);
    }, DONE_MS);
    return () => clearTimeout(timer);
  }, [active]);

  return { processing, total, active, finished };
}
