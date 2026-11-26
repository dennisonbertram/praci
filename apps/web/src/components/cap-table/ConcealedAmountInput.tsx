import { t } from "@lingui/core/macro";
import { Button, Input } from "@rakazo/ui-web";
import { Eye, EyeOff } from "lucide-react";
import type { ComponentProps } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { useHideAmounts } from "../../lib/hide-amounts-preference";

/** Keeps a saved amount concealed until it is explicitly revealed in this field. */
export function ConcealedAmountInput({
  scopeKey,
  stored,
  fieldLabel,
  value,
  onChange,
  ...inputProps
}: {
  scopeKey: string;
  stored: boolean;
  fieldLabel: string;
  value: string;
  onChange: (value: string) => void;
} & Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type">) {
  const hideAmounts = useHideAmounts();
  const inputRef = useRef<HTMLInputElement>(null);
  const [revealed, setRevealed] = useState(false);
  const [previous, setPrevious] = useState({ hideAmounts, scopeKey });
  if (previous.scopeKey !== scopeKey || previous.hideAmounts !== hideAmounts) {
    setPrevious({ hideAmounts, scopeKey });
    setRevealed(false);
  }
  useLayoutEffect(() => {
    if (revealed) inputRef.current?.focus();
  }, [revealed]);
  const concealed = hideAmounts && stored && value !== "" && !revealed;

  return (
    <div className="flex gap-1">
      <Input
        {...inputProps}
        ref={inputRef}
        type={concealed ? "password" : "text"}
        value={concealed ? "••••••" : value}
        readOnly={concealed}
        onChange={(event) => onChange(event.target.value)}
      />
      {hideAmounts && stored && value !== "" ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={`${revealed ? t`Hide amount` : t`Show amount`}: ${fieldLabel}`}
          onClick={() => setRevealed((current) => !current)}
        >
          {revealed ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </Button>
      ) : null}
    </div>
  );
}
