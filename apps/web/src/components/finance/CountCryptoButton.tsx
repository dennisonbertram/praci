import { t } from "@lingui/core/macro";
import type { RunwayCryptoScope } from "@rakazo/contracts";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Label,
  Switch,
} from "@rakazo/ui-web";
import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";

/**
 * A switch for whether crypto counts as cash. On, a menu beside it picks all crypto or stablecoins only.
 * Saves the scope, then calls `onSaved` so the page can reload.
 */
export function CountCryptoButton({
  scope,
  onSaved,
}: {
  scope: RunwayCryptoScope;
  onSaved: () => void;
}) {
  const id = useId();
  const [error, setError] = useState("");
  // One save at a time, so a slow earlier save cannot overwrite a later choice.
  const [saving, setSaving] = useState(false);
  async function save(runwayCrypto: RunwayCryptoScope) {
    setSaving(true);
    try {
      await rpc.finance.setPreferences({ runwayCrypto });
      setError("");
      onSaved();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setSaving(false);
    }
  }
  const nowrap = "whitespace-nowrap";
  const on = scope !== "bank";
  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-2">
        {/* A switch shows the state itself; the sentence beside it says what that state means. */}
        <div className="flex items-center gap-2 text-sm">
          <Switch
            id={id}
            size="sm"
            checked={on}
            disabled={saving}
            onCheckedChange={(next) => void save(next ? "all" : "bank")}
          />
          <Label htmlFor={id} className="cursor-pointer font-normal">
            {t`Count crypto`}
          </Label>
        </div>
        {on ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  size="xs"
                  variant="ghost"
                  className="text-muted-foreground"
                  disabled={saving}
                />
              }
            >
              {scope === "all" ? t`All crypto` : t`Stablecoins only`}
              <ChevronDown aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-auto min-w-max">
              <DropdownMenuRadioGroup
                value={scope}
                onValueChange={(next) => void save(next as RunwayCryptoScope)}
              >
                <DropdownMenuRadioItem value="all" className={nowrap}>
                  {t`All crypto`}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="stablecoins" className={nowrap}>
                  {t`Stablecoins only`}
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-[13px] text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
