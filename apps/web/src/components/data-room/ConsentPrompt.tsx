import { Trans } from "@lingui/react/macro";
import type { DataRoomConsentStatus } from "@rakazo/contracts";
import { Card } from "@rakazo/ui-web";
import { useEffect, useState } from "react";
import { rpc } from "../../lib/rpc";
import { ConsentCard } from "../AiDataSharing";

/**
 * Asks for permission to send documents to the space's model, which reads, tags and files them.
 * Without a model it says why nothing is read. Hidden once allowed, after "Not now" (for this
 * visit, as on the Inbox), or when the status cannot load.
 */
export function DataRoomConsentPrompt({ onAllowed }: { onAllowed: () => void }) {
  const [status, setStatus] = useState<DataRoomConsentStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
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

  if (!status || status.allowed || dismissed) return null;
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
  const names = status.recipients.map(({ name }) => name).join(", ");
  return (
    <ConsentCard
      id="data-room-consent"
      heading={<Trans>Let Rakazo read your documents</Trans>}
      onAllow={async () => {
        setStatus(await rpc.dataRoom.consentGrant({ key: status.key, version: status.version }));
        onAllowed();
      }}
      onDismiss={() => setDismissed(true)}
    >
      <Trans>
        Rakazo can tag files you add and sort them into folders. To do that, their text (and images)
        is sent to {names}. Files that already have tags keep them.
      </Trans>
    </ConsentCard>
  );
}
