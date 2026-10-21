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
  idPrefix = "server",
}: {
  service: string;
  checked: boolean;
  disabled: boolean;
  hint: ReactNode;
  onChange: (on: boolean) => void;
  idPrefix?: string;
}) {
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-0.5">
      <Switch
        id={`${idPrefix}-writes`}
        aria-describedby={`${idPrefix}-writes-hint`}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
      <Label htmlFor={`${idPrefix}-writes`}>
        <Trans>Allow changes in {service}</Trans>
      </Label>
      <p id={`${idPrefix}-writes-hint`} className="col-start-2 text-sm text-muted-foreground">
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
  shared,
  disabled,
  onWrites,
  onShared,
  usedBy,
  idPrefix = "server",
}: {
  service: string;
  agentName: string;
  /** Omitted while the agent does not exist yet; the name is shown unlinked so the layout holds. */
  agentHref?: string;
  writesEnabled: boolean;
  shared: boolean;
  disabled: boolean;
  /** Omitted when the agent can never make changes (Devin): the switch is not shown. */
  onWrites?: (on: boolean) => void;
  /** Omitted for read-only agents with no sharing choice (Granola): the toggle and list are not shown. */
  onShared?: (on: boolean) => void;
  /** The per-agent list, shown while the connection is shared. */
  usedBy?: ReactNode;
  idPrefix?: string;
}) {
  const { t } = useLingui();
  return (
    <section aria-label={t`Agent`}>
      <Heading>
        <Trans>Agent</Trans>
      </Heading>
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-3.5 py-3">
        {agentHref ? (
          <Link to={agentHref} className="w-fit text-sm font-medium hover:underline">
            {agentName}
          </Link>
        ) : (
          <span className="w-fit text-sm font-medium">{agentName}</span>
        )}
        {onWrites ? (
          <WritesSwitch
            service={service}
            checked={writesEnabled}
            disabled={disabled}
            onChange={onWrites}
            idPrefix={idPrefix}
            hint={
              <Trans>
                Off: the agent only reads. On: it can also make changes, and asks you before each
                one.
              </Trans>
            }
          />
        ) : null}
        {onShared ? (
          <div className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-0.5">
            <Switch
              id={`${idPrefix}-shared`}
              aria-describedby={`${idPrefix}-shared-hint`}
              checked={shared}
              disabled={disabled}
              onCheckedChange={onShared}
            />
            <Label htmlFor={`${idPrefix}-shared`}>
              <Trans>Let other agents use {service} directly</Trans>
            </Label>
            <p id={`${idPrefix}-shared-hint`} className="col-start-2 text-sm text-muted-foreground">
              <Trans>Off: other agents reach {service} only through this agent.</Trans>
            </p>
          </div>
        ) : null}
      </div>
      {shared && onShared && usedBy ? (
        <>
          <Heading>
            <Trans>Used by</Trans>
          </Heading>
          {usedBy}
        </>
      ) : null}
    </section>
  );
}
