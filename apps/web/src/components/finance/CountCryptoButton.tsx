import { t } from "@lingui/core/macro";
import type { RunwayCryptoScope } from "@rakazo/contracts";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@rakazo/ui-web";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";

/**
 * A tag for whether crypto counts as cash. Off: one click counts all crypto. On: it names what counts,
 * and its menu switches between all crypto and stablecoins only, or turns counting off.
 * Saves the scope, then calls `onSaved` so the page can reload.
 */
export function CountCryptoButton({
  scope,
  onSaved,
}: {
  scope: RunwayCryptoScope;
  onSaved: () => void;
}) {
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
  return (
    <div className="flex flex-col items-start gap-1">
      {scope === "bank" ? (
        <Button
          size="xs"
          variant="outline"
          className="rounded-full"
          aria-pressed={false}
          disabled={saving}
          onClick={() => void save("all")}
        >
          {t`Count crypto`}
        </Button>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button size="xs" variant="secondary" className="rounded-full" disabled={saving} />
            }
          >
            {scope === "all" ? t`Counting all crypto` : t`Counting stablecoins`}
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
            <DropdownMenuSeparator />
            <DropdownMenuItem className={nowrap} onClick={() => void save("bank")}>
              {t`Don't count crypto`}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {error ? (
        <p role="alert" className="text-[13px] text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
