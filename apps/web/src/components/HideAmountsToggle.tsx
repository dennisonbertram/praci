import { t } from "@lingui/core/macro";
import { Button } from "@rakazo/ui-web";
import { Eye, EyeOff } from "lucide-react";
import { setHideAmounts, useHideAmounts } from "../lib/hide-amounts-preference";

/** The only Hide amounts switch: a row in the account menu, reachable from any page. */
export function HideAmountsMenuItem({ onDone }: { onDone?: () => void }) {
  const hidden = useHideAmounts();
  return (
    <Button
      variant="ghost"
      className="h-auto w-full justify-start py-1.5 font-normal whitespace-normal"
      role="menuitemcheckbox"
      aria-checked={hidden}
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
        <span className="text-xs text-muted-foreground">
          {hidden
            ? t`Money amounts are hidden in finance, chat and email.`
            : t`Hides money amounts in finance, chat and email.`}
        </span>
      </span>
    </Button>
  );
}
