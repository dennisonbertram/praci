import { Trans } from "@lingui/react/macro";
import type { DataRoomConsentStatus } from "@rakazo/contracts";
import { rpc } from "../../lib/rpc";
import { DocumentsConsentCard } from "../AiDataSharing";

/** Asks once before the Legal agent may read Data Room documents; grants exactly the shown key and version. */
export function LegalConsentPrompt({
  consent,
  onChange,
  className = "mb-4",
}: {
  className?: string;
  consent: DataRoomConsentStatus;
  /** Called with the new status after a grant, or with the fresh one when the shown key was stale. */
  onChange: (status: DataRoomConsentStatus) => void;
}) {
  return (
    <DocumentsConsentCard
      id="legal-consent"
      className={className}
      consent={consent}
      declinedText={<Trans>Praci doesn't read your documents.</Trans>}
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
