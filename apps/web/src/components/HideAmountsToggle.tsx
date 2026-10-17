import { t } from "@lingui/core/macro";
import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@rakazo/ui-web";
import { Eye, EyeOff } from "lucide-react";
import { setHideAmounts, useHideAmounts } from "../lib/hide-amounts-preference";

/** What the switch does next, so the text always matches the label beside it. */
const helper = (hidden: boolean) =>
  hidden
    ? t`Amounts are hidden on every page. Plain numbers in bot replies may still show.`
    : t`Hides money on every page and in chat, for screen sharing.`;

/** Icon button for page headers. Pressed while amounts are hidden. */
export function HideAmountsButton() {
  const hidden = useHideAmounts();
  const label = hidden ? t`Show amounts` : t`Hide amounts`;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="pointer-coarse:size-10"
            aria-label={label}
            aria-pressed={hidden}
            data-testid="hide-amounts-toggle"
            onClick={() => setHideAmounts(!hidden)}
          />
        }
      >
        {hidden ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </TooltipTrigger>
      <TooltipContent>
        {label}. {helper(hidden)}
      </TooltipContent>
    </Tooltip>
  );
}

/** Account-menu row, so the switch is reachable from anywhere. */
export function HideAmountsMenuItem({ onDone }: { onDone?: () => void }) {
  const hidden = useHideAmounts();
  return (
    <Button
      variant="ghost"
      className="h-auto w-full justify-start py-1.5 font-normal whitespace-normal"
      aria-pressed={hidden}
      data-testid="hide-amounts-menu-item"
      onClick={() => {
        setHideAmounts(!hidden);
        onDone?.();
      }}
    >
      {hidden ? (
        <EyeOff className="text-muted-foreground" strokeWidth={1.75} />
      ) : (
        <Eye className="text-muted-foreground" strokeWidth={1.75} />
      )}
      <span className="flex min-w-0 flex-col items-start text-start">
        <span>{hidden ? t`Show amounts` : t`Hide amounts`}</span>
        <span className="text-xs text-muted-foreground">{helper(hidden)}</span>
      </span>
    </Button>
  );
}
