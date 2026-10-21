import { Trans } from "@lingui/react/macro";
import type { DataRoomConsentStatus } from "@rakazo/contracts";
import { rpc } from "../../lib/rpc";
import { ConsentCard } from "../AiDataSharing";

/** Asks once before the Legal agent may read Data Room documents; grants exactly the shown key and version. */
export function LegalConsentPrompt({
  consent,
  onChange,
}: {
  consent: DataRoomConsentStatus;
  /** Called with the new status after a grant, or with the fresh one when the shown key was stale. */
  onChange: (status: DataRoomConsentStatus) => void;
}) {
  return (
    <ConsentCard
      id="legal-consent"
      className="mb-4"
      heading={<Trans>Let Praci read your contracts</Trans>}
      sends={
        <Trans>
          The text of your Data room documents is sent to the AI model that runs your bots.
        </Trans>
      }
      onAllow={async () => {
        try {
          onChange(await rpc.legal.consentGrant({ key: consent.key, version: consent.version }));
        } catch (cause) {
          // The providers changed since this prompt loaded: show the current status to re-confirm.
          if ((cause as { code?: string } | null)?.code !== "CONFLICT") throw cause;
          onChange(await rpc.legal.consent());
        }
      }}
    />
  );
}
