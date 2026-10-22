import { t } from "@lingui/core/macro";
import { Button } from "@rakazo/ui-web";
import { Check, Eye, EyeOff } from "lucide-react";
import { setHideAmounts, useHideAmounts } from "../lib/hide-amounts-preference";

/** The only Hide amounts switch: a row in the account menu, reachable from any page. The label stays the same; the checked state says whether amounts are hidden. */
export function HideAmountsMenuItem({ onDone }: { onDone?: () => void }) {
  const hidden = useHideAmounts();
  return (
    <Button
      variant="ghost"
      className="h-auto w-full justify-start py-1.5 font-normal"
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
      <span>{t`Hide amounts`}</span>
      {hidden ? <Check className="ms-auto" strokeWidth={1.75} aria-hidden="true" /> : null}
    </Button>
  );
}
