import { Trans, useLingui } from "@lingui/react/macro";
import { Label, Switch } from "@rakazo/ui-web";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Heading } from "./AppDetail";

/** The "Allow changes in {service}" switch, shared by Carta and integration agents. */
export function WritesSwitch({
  service,
  checked,
  disabled,
  hint,
  onChange,
}: {
  service: string;
  checked: boolean;
  disabled: boolean;
  hint: ReactNode;
  onChange: (on: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-0.5">
      <Switch
        id="server-writes"
        aria-describedby="server-writes-hint"
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
      <Label htmlFor="server-writes">
        <Trans>Allow changes in {service}</Trans>
      </Label>
      <p id="server-writes-hint" className="col-start-2 text-sm text-muted-foreground">
        {hint}
      </p>
    </div>
  );
}

export function IntegrationAgentSection({
  service,
  agentName,
  agentHref,
  writesEnabled,
  exclusive,
  disabled,
  onWrites,
  onExclusive,
}: {
  service: string;
  agentName: string;
  agentHref: string;
  writesEnabled: boolean;
  exclusive: boolean;
  disabled: boolean;
  onWrites: (on: boolean) => void;
  onExclusive: (on: boolean) => void;
}) {
  const { t } = useLingui();
  return (
    <section aria-label={t`Agent`}>
      <Heading>
        <Trans>Agent</Trans>
      </Heading>
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-3.5 py-3">
        <Link to={agentHref} className="w-fit text-sm font-medium hover:underline">
          {agentName}
        </Link>
        <WritesSwitch
          service={service}
          checked={writesEnabled}
          disabled={disabled}
          onChange={onWrites}
          hint={
            <Trans>
              Off: the agent only reads. On: it can also make changes, and asks you before each one.
            </Trans>
          }
        />
        <div className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-0.5">
          <Switch
            id="server-exclusive"
            aria-describedby="server-exclusive-hint"
            checked={exclusive}
            disabled={disabled}
            onCheckedChange={onExclusive}
          />
          <Label htmlFor="server-exclusive">
            <Trans>Only this agent</Trans>
          </Label>
          <p id="server-exclusive-hint" className="col-start-2 text-sm text-muted-foreground">
            <Trans>
              Other agents ask the {service} agent instead of using {service} themselves.
            </Trans>
          </p>
        </div>
      </div>
    </section>
  );
}
