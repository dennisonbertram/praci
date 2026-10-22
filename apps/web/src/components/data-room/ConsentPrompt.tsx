import { Trans } from "@lingui/react/macro";
import type { DataRoomConsentStatus } from "@rakazo/contracts";
import { Button, Card } from "@rakazo/ui-web";
import { useEffect, useState } from "react";
import { rpc } from "../../lib/rpc";
import { ConsentCard } from "../AiDataSharing";

const DISMISSED_KEY = "rakazo.dataRoomConsentDismissed";

/** The consent version this browser said "Not now" to; asked again only when it changes. */
function readDismissed(): string | null {
  try {
    return localStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}
function saveDismissed(value: string | null) {
  try {
    if (value === null) localStorage.removeItem(DISMISSED_KEY);
    else localStorage.setItem(DISMISSED_KEY, value);
  } catch {
    // Storage blocked: "Not now" lasts until the page closes.
  }
}

/**
 * Asks for permission to send documents to the space's model, which reads, tags and files them.
 * Without a model it says why nothing is read. Hidden once allowed or when the status cannot load.
 * After "Not now" (remembered in this browser until the request changes) one line stays, with a way
 * to be asked again.
 */
export function DataRoomConsentPrompt({ onAllowed }: { onAllowed: () => void }) {
  const [status, setStatus] = useState<DataRoomConsentStatus | null>(null);
  const [dismissed, setDismissed] = useState(readDismissed);
  // Allow removes the card, so a short line says what changed.
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    if (!confirmed) return;
    const timer = setTimeout(() => setConfirmed(false), 5000);
    return () => clearTimeout(timer);
  }, [confirmed]);
  useEffect(() => {
    let live = true;
    rpc.dataRoom
      .consent()
      .then((next) => live && setStatus(next))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const version = status ? `${status.key}:${status.version}` : "";
  if (confirmed)
    return (
      <p role="status" className="text-xs text-muted-foreground">
        <Trans>Praci can now read your documents.</Trans>
      </p>
    );
  if (!status || status.allowed) return null;
  if (status.recipients.length > 0 && dismissed === version) {
    return (
      <Card
        size="sm"
        className="flex-row flex-wrap items-center gap-x-2 gap-y-0 px-3.5 py-2 text-xs text-muted-foreground"
      >
        <Trans>Praci doesn't tag new files.</Trans>
        <Button
          variant="link"
          size="xs"
          className="h-auto p-0"
          onClick={() => {
            saveDismissed(null);
            setDismissed(null);
          }}
        >
          <Trans>Let Praci read documents</Trans>
        </Button>
      </Card>
    );
  }
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
    <ConsentCard
      id="data-room-consent"
      heading={<Trans>Let Praci read your documents</Trans>}
      onAllow={async () => {
        setStatus(await rpc.dataRoom.consentGrant({ key: status.key, version: status.version }));
        setConfirmed(true);
        onAllowed();
      }}
      onDismiss={() => {
        saveDismissed(version);
        setDismissed(version);
      }}
    />
  );
}
