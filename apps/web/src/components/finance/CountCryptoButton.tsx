import { t } from "@lingui/core/macro";
import type { RunwayCryptoScope } from "@rakazo/contracts";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@rakazo/ui-web";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";

/**
 * Follow-style toggle for whether crypto counts as cash. Saves the scope, then calls `onSaved` so the page can reload.
 * Turning on counts all crypto; the menu next to it picks stablecoins only.
 */
export function CountCryptoButton({
  scope,
  onSaved,
}: {
  scope: RunwayCryptoScope;
  onSaved: () => void;
}) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  const on = scope !== "bank";
  async function save(runwayCrypto: RunwayCryptoScope) {
    try {
      await rpc.finance.setPreferences({ runwayCrypto });
      setError("");
      onSaved();
    } catch (cause) {
      setError(errorText(cause));
    }
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-0.5">
        <Button
          size="sm"
          variant="outline"
          aria-pressed={on}
          aria-label={on ? t`Counting crypto` : t`Count crypto`}
          onMouseEnter={() => setActive(true)}
          onMouseLeave={() => setActive(false)}
          onFocus={() => setActive(true)}
          onBlur={() => setActive(false)}
          onClick={() => void save(on ? "bank" : "all")}
        >
          {on ? (active ? t`Not counting crypto` : t`Counting crypto`) : t`Count crypto`}
        </Button>
        {on ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  size="icon-sm"
                  variant="outline"
                  aria-label={t`Choose which crypto counts`}
                />
              }
            >
              <ChevronDown aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup
                value={scope}
                onValueChange={(next) => void save(next as RunwayCryptoScope)}
              >
                <DropdownMenuRadioItem value="all">{t`All crypto`}</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="stablecoins">
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
