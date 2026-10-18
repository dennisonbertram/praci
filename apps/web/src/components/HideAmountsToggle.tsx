import { t } from "@lingui/core/macro";
import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@rakazo/ui-web";
import { Eye, EyeOff } from "lucide-react";
import { setHideAmounts, useHideAmounts } from "../lib/hide-amounts-preference";

const helper = () =>
  t`Hides money amounts, share counts and percentages on screen and in chat text. Small plain numbers may still show.`;

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
        {label}. {helper()}
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
      className="h-auto w-full justify-start py-1.5 font-normal"
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
      <span className="flex flex-col items-start text-start">
        <span>{hidden ? t`Show amounts` : t`Hide amounts`}</span>
        <span className="text-xs text-muted-foreground">{helper()}</span>
      </span>
    </Button>
  );
}
