import { Trans, useLingui } from "@lingui/react/macro";
import {
  LEGAL_AGENT_MODEL,
  LEGAL_CONSENT_REQUIRED_MESSAGE,
  LEGAL_MODEL_REQUIRED_MESSAGE,
  MISSING_TOOL_FINAL_RESPONSE_ERROR,
} from "@rakazo/contracts";
import { Button } from "@rakazo/ui-web";
import { X } from "lucide-react";
import type { Ref } from "react";
import { runErrorText } from "../../lib/user-error";

/**
 * The Models settings that fix a run error, when they do. `provider` opens that provider's key
 * field; `""` opens the space's default provider's key field (a rejected key).
 */
function modelSettingsFor(message: string): { provider: string } | null {
  if (message === LEGAL_MODEL_REQUIRED_MESSAGE) return { provider: LEGAL_AGENT_MODEL.provider };
  return message === runErrorText("401") ? { provider: "" } : null;
}

/** A send or run error above the composer; a model-setup error also offers the settings that fix it. */
export function ComposerError({
  ref,
  message,
  onDismiss,
  onRetry,
  onOpenModelSettings,
  onNavigate,
}: {
  ref?: Ref<HTMLDivElement>;
  message: string;
  onDismiss: () => void;
  /** Sends the last message again; offered only for a run that ended without a reply. */
  onRetry?: () => void;
  onOpenModelSettings?: (provider?: string) => void;
  onNavigate?: (path: string) => void;
}) {
  const { t } = useLingui();
  const settings = modelSettingsFor(message);
  const needsConsent = message === LEGAL_CONSENT_REQUIRED_MESSAGE;
  return (
    <div
      ref={ref}
      role="alert"
      data-testid="composer-error"
      className="mb-3 flex flex-wrap items-center gap-2 rounded-[14px] border border-destructive/40 bg-destructive/10 px-4 py-2 text-[13px] text-destructive"
    >
      <span className="min-w-0 flex-1 basis-48">{message}</span>
      <div className="ms-auto flex shrink-0 items-center gap-2">
        {settings && onOpenModelSettings ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenModelSettings(settings.provider)}
          >
            <Trans>Open Models settings</Trans>
          </Button>
        ) : null}
        {message === MISSING_TOOL_FINAL_RESPONSE_ERROR && onRetry ? (
          <Button size="sm" variant="outline" onClick={onRetry}>
            <Trans>Retry</Trans>
          </Button>
        ) : null}
        {needsConsent && onNavigate ? (
          <Button size="sm" variant="outline" onClick={() => onNavigate("/app/legal")}>
            <Trans>Allow</Trans>
          </Button>
        ) : null}
        <button
          type="button"
          aria-label={t`Dismiss error`}
          data-testid="composer-error-dismiss"
          onClick={onDismiss}
          className="grid size-6 shrink-0 place-items-center text-destructive hover:text-foreground"
        >
          <X size={13} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
