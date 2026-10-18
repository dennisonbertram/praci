import { Trans } from "@lingui/react/macro";
import type { DataRoomConsentStatus } from "@rakazo/contracts";
import { Button, Card } from "@rakazo/ui-web";
import { useState } from "react";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";

/** Asks once before the Legal agent may read Data Room documents; grants exactly the shown key and version. */
export function LegalConsentPrompt({
  consent,
  onChange,
}: {
  consent: DataRoomConsentStatus;
  /** Called with the new status after a grant, or with the fresh one when the shown key was stale. */
  onChange: (status: DataRoomConsentStatus) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const allow = async () => {
    setPending(true);
    setError("");
    try {
      onChange(await rpc.legal.consentGrant({ key: consent.key, version: consent.version }));
    } catch (cause) {
      if ((cause as { code?: string } | null)?.code === "CONFLICT") {
        // The providers changed since this prompt loaded: show the current disclosure to re-confirm.
        try {
          onChange(await rpc.legal.consent());
        } catch (reload) {
          setError(errorText(reload));
        }
      } else {
        setError(errorText(cause));
      }
    } finally {
      setPending(false);
    }
  };
  return (
    <Card
      size="sm"
      role="region"
      className="mb-4 gap-1.5 border border-warning px-3.5"
      aria-labelledby="legal-consent-heading"
    >
      <h2 id="legal-consent-heading" className="text-sm font-medium">
        <Trans>Let the Legal agent read your documents</Trans>
      </h2>
      <p className="text-xs text-muted-foreground">{consent.disclosure}</p>
      {/* Settings > Models shows the space's model; say plainly that Legal does not use it. */}
      <p className="text-xs text-muted-foreground">
        <Trans>
          The Legal agent reads with its own model, Muse Spark 1.2, through your OpenRouter key.
          Your other agents keep the model chosen in Settings.
        </Trans>
      </p>
      {consent.recipients.length > 0 ? (
        <ul className="flex flex-col gap-0.5 text-xs">
          {consent.recipients.map((recipient) => (
            <li key={recipient.name}>
              <span className="font-medium">{recipient.name}</span>
              <span className="text-muted-foreground"> · {recipient.detail}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div>
        <Button size="sm" disabled={pending} onClick={() => void allow()}>
          <Trans>Allow</Trans>
        </Button>
      </div>
    </Card>
  );
}
