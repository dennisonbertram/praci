import { t } from "@lingui/core/macro";
import { Button, enqueueNotificationToast } from "@rakazo/ui-web";
import { Check, Eye, EyeOff } from "lucide-react";
import { setHideAmounts, useHideAmounts } from "../lib/hide-amounts-preference";
import { rpc } from "../lib/rpc";

/** Applies the choice here and saves it on the user. If saving fails the choice stays on this browser (cached per user) and the person is told. */
function changeHideAmounts(next: boolean) {
  setHideAmounts(next);
  // Saved on the user, so it follows them to other browsers and never to the next person.
  void rpc.preferences.update({ hideAmounts: next }).catch(() =>
    enqueueNotificationToast({
      id: "hide-amounts-save-failed",
      title: t`Could not save Hide amounts`,
    }),
  );
}

/** The Hide amounts switch: a row in the account menu, reachable from any page. The label stays the same; the checked state says whether amounts are hidden. */
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
        changeHideAmounts(!hidden);
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

/** Shown only while amounts are hidden, so a page of "$•••" says why and turns them back on. */
export function ShowAmountsButton() {
  const hidden = useHideAmounts();
  if (!hidden) return null;
  return (
    <Button
      variant="link"
      size="xs"
      className="shrink-0 text-muted-foreground"
      aria-label={t`Amounts hidden · Show`}
      onClick={() => changeHideAmounts(false)}
    >
      <EyeOff aria-hidden="true" />
      <span className="max-sm:sr-only">{t`Amounts hidden · Show`}</span>
    </Button>
  );
}
