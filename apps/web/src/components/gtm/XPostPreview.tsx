import { Trans } from "@lingui/react/macro";
import { cn } from "@rakazo/ui-web";
import { xCount } from "../../lib/x-count";

export function XPostPreview({ text, accountLabel }: { text: string; accountLabel?: string }) {
  const count = xCount(text);
  return (
    <div className="min-w-0 space-y-3">
      {accountLabel ? <p className="text-xs text-muted-foreground">{accountLabel}</p> : null}
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{text}</p>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className={cn(count > 280 && "text-destructive")}>
          <Trans>{count} / 280</Trans>
        </span>
        <span>
          <Trans>Link counts as 23</Trans>
        </span>
      </div>
    </div>
  );
}
