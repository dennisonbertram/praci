import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { DataRoomConsentStatus } from "@rakazo/contracts";
import { Card } from "@rakazo/ui-web";
import { useEffect, useState } from "react";
import { rpc } from "../../lib/rpc";
import { DocumentsConsentCard } from "../AiDataSharing";
import { showNoticeToast } from "./upload-toasts";

/**
 * Asks for permission to send documents to the space's model, which reads, tags and files them.
 * Without a model it says why nothing is read. Hidden once allowed or when the status cannot load.
 * Allowing shows a toast, so the page does not shift when the card goes.
 */
export function DataRoomConsentPrompt({
  onAllowed,
  onStatus,
}: {
  onAllowed: () => void;
  /** Told whenever the status is read, so the page can say that files wait for permission. */
  onStatus?: (status: DataRoomConsentStatus) => void;
}) {
  const [status, setStatus] = useState<DataRoomConsentStatus | null>(null);
  useEffect(() => {
    if (status) onStatus?.(status);
  }, [status, onStatus]);
  // Read on open and whenever the user comes back, so a grant made in another tab or in Settings
  // removes the card without a reload.
  useEffect(() => {
    let live = true;
    const load = () => {
      if (document.visibilityState === "hidden") return;
      rpc.dataRoom
        .consent()
        .then((next) => live && setStatus(next))
        .catch(() => undefined);
    };
    load();
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", load);
    return () => {
      live = false;
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", load);
    };
  }, []);

  if (!status || status.allowed) return null;
  if (status.recipients.length === 0) {
    return (
      <Card size="sm" className="px-3.5 text-xs text-muted-foreground">
        <Trans>
          You can search documents by name and text and move them into folders yourself. Set up a
          model in Settings to have files you add tagged and sorted into folders for you.
        </Trans>
      </Card>
    );
  }
  return (
    <DocumentsConsentCard
      id="data-room-consent"
      consent={status}
      declinedText={<Trans>Praci doesn't tag new files.</Trans>}
      onAllow={async () => {
        setStatus(await rpc.dataRoom.consentGrant({ key: status.key, version: status.version }));
        showNoticeToast(t`Praci can now read your documents.`);
        onAllowed();
      }}
    />
  );
}
