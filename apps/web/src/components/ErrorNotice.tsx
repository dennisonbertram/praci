import { Trans } from "@lingui/react/macro";
import { Button } from "@rakazo/ui-web";

/** `action` replaces "Try again" when the fix is something else, such as Reconnect; with neither, there is no button. */
export function ErrorNotice({
  message,
  onRetry,
  action,
  className = "my-4",
}: {
  message: string;
  onRetry?: () => void;
  action?: { label: string; onClick: () => void };
  /** Spacing around the notice. */
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`${className} flex flex-wrap items-center gap-3 text-sm text-destructive`}
    >
      <span>{message}</span>
      {action ? (
        <Button variant="outline" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <Trans>Try again</Trans>
        </Button>
      ) : null}
    </div>
  );
}
