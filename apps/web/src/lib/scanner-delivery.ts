import { t } from "@lingui/core/macro";
import type { RakazoDesktopScanner, ScannerDocument } from "@rakazo/contracts";
import {
  showNoticeToast,
  uploadFilesToDataRoom,
  uploadScopeToken,
} from "../components/data-room/upload-toasts";
import { ensureDataRoomFolder } from "./data-room";
import { selectedSpaceId } from "./rpc";

export const SCANNER_RETRY = "rakazo:scanner-retry";

/** The desktop owns durable retries; this session owns only in-flight uploads. */
export function startScannerDelivery(
  scanner: RakazoDesktopScanner,
  scope: { userId: string; spaceId: string },
) {
  const controller = new AbortController();
  const inFlight = new Set<string>();
  const blocked = new Set<string>();
  const notified = new Set<string>();
  const noticeScope = uploadScopeToken();
  let ready = false;
  let recovering = false;
  const current = () =>
    !controller.signal.aborted &&
    uploadScopeToken() === noticeScope &&
    (!selectedSpaceId() || selectedSpaceId() === scope.spaceId);
  const deliver = async (document: ScannerDocument) => {
    if (
      !current() ||
      !ready ||
      document.userId !== scope.userId ||
      document.spaceId !== scope.spaceId ||
      inFlight.has(document.id) ||
      blocked.has(document.id)
    )
      return;
    inFlight.add(document.id);
    try {
      const folderId = document.folder.length
        ? await ensureDataRoomFolder(document.folder, scope.spaceId)
        : undefined;
      if (!current()) return;
      const file = new File([new Uint8Array(document.bytes).buffer], document.name, {
        type: "application/pdf",
      });
      await uploadFilesToDataRoom([file], folderId, undefined, {
        key: `scanner:${document.id}`,
        scope: { source: "scan", ...scope },
        signal: controller.signal,
        onStored: async (item) => {
          if (!current()) throw new Error("Scope changed");
          if (!item.sha256 || item.sha256.toLowerCase() !== document.sha256.toLowerCase()) {
            blocked.add(document.id);
            showNoticeToast(
              t`Scan kept on this device: the server did not confirm its checksum.`,
              noticeScope,
            );
            throw new Error("Scan checksum not confirmed");
          }
          const result = await scanner.confirm(document.id, item.sha256);
          if (!result.ok) throw new Error("Scan confirmation failed");
        },
      });
    } catch {
      if (current() && !blocked.has(document.id) && !notified.has(document.id)) {
        notified.add(document.id);
        showNoticeToast(
          t`Scan kept on this device. Retry when the server is available.`,
          noticeScope,
        );
      }
    } finally {
      inFlight.delete(document.id);
    }
  };
  const unsubscribe = scanner.onDocument((document) => void deliver(document));
  const recover = async (notify = false) => {
    if (!current() || recovering) return;
    recovering = true;
    try {
      // The desktop clears its scope when a later session check fails, and reads an empty
      // outbox until the scope is verified again. Restore it on every pass so a retry resumes
      // without a remount; the desktop ignores the same scope.
      await scanner.setScope(scope);
      if (!current()) return;
      ready = true;
      for (const document of await scanner.pending()) void deliver(document);
    } catch {
      // A disconnected server keeps its files in the desktop outbox.
      if (notify && current()) {
        showNoticeToast(
          t`Scan kept on this device. Retry when the server is available.`,
          noticeScope,
        );
      }
    } finally {
      recovering = false;
    }
  };
  const online = () => {
    blocked.clear();
    notified.clear();
    void recover();
  };
  const requested = () => {
    blocked.clear();
    notified.clear();
    // ponytail: a retry requested during recovery is dropped; the running pass handles the documents.
    void recover(true);
  };
  const timer = setInterval(() => void recover(), 30_000);
  window.addEventListener("online", online);
  window.addEventListener(SCANNER_RETRY, requested);
  void recover();
  const stop = () => {
    if (controller.signal.aborted) return;
    controller.abort();
    unsubscribe();
    clearInterval(timer);
    window.removeEventListener("online", online);
    window.removeEventListener(SCANNER_RETRY, requested);
    window.removeEventListener("pagehide", stop);
    void scanner.setScope(null).catch(() => undefined);
  };
  window.addEventListener("pagehide", stop);
  return stop;
}
