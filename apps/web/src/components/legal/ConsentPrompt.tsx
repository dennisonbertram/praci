import { Trans } from "@lingui/react/macro";
import type { DataRoomConsentStatus } from "@rakazo/contracts";
import { useEffect, useState } from "react";
import { rpc } from "../../lib/rpc";
import { ConsentCard } from "../AiDataSharing";

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
 * permission, starts the first scan like the page's card, and nudges the page to re-read its status.
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
        void rpc.legal.scanNow().catch(() => undefined);
        // The page re-reads its consent and overview when the window regains focus.
        window.dispatchEvent(new Event("focus"));
      }}
    />
  );
}
