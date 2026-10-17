import { Trans, useLingui } from "@lingui/react/macro";
import { LEGAL_AGENT_MODEL, LEGAL_MODEL_REQUIRED_MESSAGE } from "@rakazo/contracts";
import { Button } from "@rakazo/ui-web";
import { X } from "lucide-react";
import type { Ref } from "react";

/** The provider whose settings fix a run error, when one does. */
function settingsProviderFor(message: string): string | null {
  return message === LEGAL_MODEL_REQUIRED_MESSAGE ? LEGAL_AGENT_MODEL.provider : null;
}

/** A send or run error above the composer; a model-setup error also offers the settings that fix it. */
export function ComposerError({
  ref,
  message,
  onDismiss,
  onOpenModelSettings,
}: {
  ref?: Ref<HTMLDivElement>;
  message: string;
  onDismiss: () => void;
  onOpenModelSettings?: (provider: string) => void;
}) {
  const { t } = useLingui();
  const provider = settingsProviderFor(message);
  return (
    <div
      ref={ref}
      role="alert"
      data-testid="composer-error"
      className="mb-3 flex flex-wrap items-center gap-2 rounded-[14px] border border-destructive/40 bg-destructive/10 px-4 py-2 text-[13px] text-destructive"
    >
      <span className="min-w-0 flex-1 basis-48">{message}</span>
      <div className="ms-auto flex shrink-0 items-center gap-2">
        {provider && onOpenModelSettings ? (
          <Button size="sm" variant="outline" onClick={() => onOpenModelSettings(provider)}>
            <Trans>Open Models settings</Trans>
          </Button>
        ) : null}
        <button
          type="button"
          aria-label={t`Dismiss error`}
          data-testid="composer-error-dismiss"
          onClick={onDismiss}
          className="shrink-0 text-destructive hover:text-foreground"
        >
          <X size={13} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
