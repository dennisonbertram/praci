import { Trans, useLingui } from "@lingui/react/macro";
import {
  LEGAL_CONSENT_REQUIRED_MESSAGE,
  MISSING_TOOL_FINAL_RESPONSE_ERROR,
} from "@rakazo/contracts";
import type { runErrorAction } from "@rakazo/core";
import { Button, cn } from "@rakazo/ui-web";
import { X } from "lucide-react";
import type { Ref } from "react";

/** The API's refusal of a send while an agent's question is still open. */
const PENDING_ASK_ERROR = "Answer the pending ask first.";

/**
 * True when the error says a question is open but every loaded question is answered and the run no
 * longer waits for input (a search jump can load a window that omits the open question).
 */
export function isStalePendingAskError(
  message: string | null,
  messages: ReadonlyArray<{ blocks: ReadonlyArray<{ kind: string; status?: string }> }>,
  runStatus?: string,
): boolean {
  return (
    message === PENDING_ASK_ERROR &&
    runStatus !== "waiting_input" &&
    !messages.some((entry) =>
      entry.blocks.some((block) => block.kind === "ask" && block.status !== "answered"),
    )
  );
}

/** A send or run error above the composer; a model-setup error also offers the settings that fix it. */
export function ComposerError({
  ref,
  message,
  fix,
  onDismiss,
  onRetry,
  onRetrySend,
  onOpenModelSettings,
  onOpenBotSettings,
  onNavigate,
}: {
  ref?: Ref<HTMLDivElement>;
  message: string;
  /** The one action that fixes this run's failure, from its stored error. */
  fix?: ReturnType<typeof runErrorAction>;
  onDismiss: () => void;
  /** Sends the last message again; offered only for a run that ended without a reply. */
  onRetry?: () => void;
  /** Sends the message that failed to leave again. */
  onRetrySend?: () => void;
  onOpenModelSettings?: (provider?: string) => void;
  onOpenBotSettings?: () => void;
  onNavigate?: (path: string) => void;
}) {
  const { t } = useLingui();
  const needsConsent = message === LEGAL_CONSENT_REQUIRED_MESSAGE;
  return (
    <div
      ref={ref}
      role="alert"
      data-testid="composer-error"
      className={cn(
        "mb-3 flex flex-wrap items-center gap-2 rounded-[14px] border px-4 py-2 text-[13px]",
        needsConsent
          ? "border-border bg-muted text-foreground"
          : "border-destructive/40 bg-destructive/10 text-destructive",
      )}
    >
      <span className="min-w-0 flex-1 basis-48">{message}</span>
      <div className="ms-auto flex shrink-0 items-center gap-2">
        {fix === "models" && onOpenModelSettings ? (
          <Button size="sm" variant="outline" onClick={() => onOpenModelSettings("")}>
            <Trans>Open Models settings</Trans>
          </Button>
        ) : null}
        {fix === "connection" && onOpenModelSettings ? (
          <Button size="sm" variant="outline" onClick={() => onOpenModelSettings("")}>
            <Trans>Sign in again</Trans>
          </Button>
        ) : null}
        {fix === "connection" && onOpenBotSettings ? (
          <Button size="sm" variant="outline" onClick={onOpenBotSettings}>
            <Trans>Choose another connection</Trans>
          </Button>
        ) : null}
        {((message.startsWith(MISSING_TOOL_FINAL_RESPONSE_ERROR) || fix === "retry") && onRetry) ||
        onRetrySend ? (
          <Button size="sm" variant="outline" onClick={onRetrySend ?? onRetry}>
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
          className={cn(
            "grid size-6 shrink-0 place-items-center hover:text-foreground",
            needsConsent ? "text-muted-foreground" : "text-destructive",
          )}
        >
          <X size={13} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
