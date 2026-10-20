import { Trans, useLingui } from "@lingui/react/macro";
import type { ComputerHost } from "@rakazo/contracts";
import { Toggle } from "@rakazo/ui-web";
import { useEffect, useId, useState } from "react";
import { desktopBridge } from "../lib/desktop";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";

/**
 * Host commands are only offered in the desktop app, to the deployment owner on a Docker
 * sandbox; the server enforces the same rule.
 */
export function canOfferHostComputer(me: { canChooseHostComputer: boolean } | null | undefined) {
  return Boolean(me?.canChooseHostComputer && desktopBridge());
}

export function RunsOnPicker({
  value,
  onChange,
  disabled,
}: {
  value: ComputerHost;
  onChange: (value: ComputerHost) => void;
  disabled?: boolean;
}) {
  const { t } = useLingui();
  const warningId = useId();
  const host = desktopBridge()?.platform === "darwin" ? t`This Mac` : t`This computer`;
  return (
    <div className="mt-2">
      <div className="grid grid-cols-2 gap-2">
        {(["docker", "this-mac"] as const).map((option) => (
          <Toggle
            key={option}
            variant="outline"
            pressed={value === option}
            disabled={disabled}
            aria-describedby={option === "this-mac" ? warningId : undefined}
            onPressedChange={(pressed) => {
              if (pressed) onChange(option);
            }}
            className="aria-pressed:border-foreground/40 aria-pressed:text-foreground"
          >
            {option === "docker" ? <Trans>Sandbox</Trans> : host}
          </Toggle>
        ))}
      </div>
      <p
        id={warningId}
        hidden={value !== "this-mac"}
        className="mt-2 text-[12.5px] text-muted-foreground"
      >
        <Trans>Runs commands without asking. Avoid on shared or public servers.</Trans>
      </p>
    </div>
  );
}

/** The default for bots that have no setting of their own. Owner only. */
export function DefaultRunsOnSection() {
  const [value, setValue] = useState<ComputerHost | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLingui();
  useEffect(() => {
    void rpc.deployment
      .get()
      .then((settings) => {
        if (canOfferHostComputer(settings)) setValue(settings.computerHost ?? "docker");
      })
      .catch(() => undefined);
  }, []);
  if (!value) return null;
  return (
    <section className="rounded-xl border border-border px-4 py-4">
      <h3 className="text-[15px] font-medium text-foreground">
        <Trans>Bots run on</Trans>
      </h3>
      <RunsOnPicker
        value={value}
        onChange={(computerHost) => {
          const previous = value;
          setValue(computerHost);
          setError(null);
          void rpc.deployment.update({ computerHost }).catch((err) => {
            setValue(previous);
            setError(errorText(err, t`Could not save`));
          });
        }}
      />
      {error ? (
        <p role="alert" className="mt-2 text-[12.5px] text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
