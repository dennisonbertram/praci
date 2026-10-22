import { Trans } from "@lingui/react/macro";
import type { DataRoomConsentStatus } from "@rakazo/contracts";
import { useEffect, useState } from "react";
import { rpc } from "../../lib/rpc";
import { ConsentCard } from "../AiDataSharing";

/** Fired on window when the panel's Allow succeeds; the Legal page scans and re-reads its status. */
export const LEGAL_CONSENT_GRANTED = "legal-consent-granted";

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
    <ConsentCard
      id="legal-consent"
      className={className}
      heading={<Trans>Let Praci read your documents</Trans>}
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

/**
 * The same Allow inside the Legal agent panel, above its disabled composer. It grants the one shared
 * permission and tells the Legal page, which starts the first scan like its own card does.
 */
export function LegalPanelConsent() {
  const [status, setStatus] = useState<DataRoomConsentStatus | null>(null);
  useEffect(() => {
    rpc.legal
      .consent()
      .then(setStatus)
      .catch(() => undefined);
  }, []);
  if (!status || status.allowed || status.recipients.length === 0) return null;
  return (
    <LegalConsentPrompt
      className="mx-6 mb-2"
      consent={status}
      onChange={(next) => {
        setStatus(next);
        if (!next.allowed) return;
        // The Legal page starts the first scan, so it can show progress and errors.
        window.dispatchEvent(new Event(LEGAL_CONSENT_GRANTED));
      }}
    />
  );
}
