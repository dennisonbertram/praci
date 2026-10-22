import { Trans } from "@lingui/react/macro";
import { cn } from "@rakazo/ui-web";

export function LinkedInPostPreview({
  text,
  accountLabel,
}: {
  text: string;
  accountLabel?: string;
}) {
  const count = text.length;
  return (
    <div className="min-w-0 space-y-3">
      {accountLabel ? <p className="text-xs text-muted-foreground">{accountLabel}</p> : null}
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{text}</p>
      <span className={cn("text-xs text-muted-foreground", count > 3000 && "text-destructive")}>
        <Trans>{count} / 3,000</Trans>
      </span>
    </div>
  );
}
