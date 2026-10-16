import { Trans } from "@lingui/react/macro";
import type { DataRoomConsentStatus } from "@rakazo/contracts";
import { Card } from "@rakazo/ui-web";
import { useEffect, useState } from "react";
import { rpc } from "../../lib/rpc";
import { ConsentCard } from "../AiDataSharing";

/**
 * Asks for permission to send documents to the space's model, which reads, tags and files them.
 * Without a model it says why nothing is read. Hidden once allowed, or when the status cannot load.
 */
export function DataRoomConsentPrompt({ onAllowed }: { onAllowed: () => void }) {
  const [status, setStatus] = useState<DataRoomConsentStatus | null>(null);
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

  if (!status || status.allowed) return null;
  if (status.recipients.length === 0) {
    return (
      <Card size="sm" className="px-3.5 text-xs text-muted-foreground">
        <Trans>
          Documents are stored but not read. Set up a model in Settings to tag and file them.
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
    >
      <Trans>
        To tag, file and search them, their text (and images) is sent to {names}. Until then they
        are stored but not read.
      </Trans>
    </ConsentCard>
  );
}
