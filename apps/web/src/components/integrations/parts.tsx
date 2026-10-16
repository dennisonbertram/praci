import { useLingui } from "@lingui/react/macro";
import type { Bot } from "@rakazo/contracts";
import { BotAvatar, cn, Switch } from "@rakazo/ui-web";
import type { ComponentProps } from "react";
import type { StatusKind } from "../../lib/integrations";

export function IntegrationTile({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2.5 rounded-xl border border-border bg-card p-3.5",
        className,
      )}
      {...props}
    />
  );
}

const STATUS_STYLE: Record<StatusKind, string> = {
  connected: "text-success",
  reconnect: "text-warning",
  failed: "text-destructive",
  connecting: "text-muted-foreground",
};

export function StatusBadge({ status }: { status: StatusKind }) {
  const { t } = useLingui();
  const label = {
    connected: t`Connected`,
    reconnect: t`Needs reconnect`,
    failed: t`Failed`,
    connecting: t`Connecting…`,
  }[status];
  return (
    <span
      data-status={status}
      className={`inline-flex items-center gap-1.5 rounded-full border border-current px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[status]}`}
    >
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full bg-current ${status === "connecting" ? "animate-pulse" : ""}`}
      />
      {label}
    </span>
  );
}

export function AgentStack({ bots, max = 5 }: { bots: Bot[]; max?: number }) {
  return (
    <span className="flex -space-x-1.5">
      {bots.slice(0, max).map((bot) => (
        <span key={bot.id} title={bot.name} className="rounded-full ring-2 ring-card">
          <BotAvatar color={bot.color} identity={bot.id} size={20} />
        </span>
      ))}
    </span>
  );
}

/** One row per agent with a switch, as used on detail pages. */
export function AgentToggleList({
  bots,
  isOn,
  appName,
  disabled,
  onToggle,
}: {
  bots: Bot[];
  isOn: (botId: string) => boolean;
  appName: string;
  disabled?: boolean;
  onToggle: (botId: string, next: boolean) => void;
}) {
  const { t } = useLingui();
  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-card">
      {bots.map((bot) => (
        <div key={bot.id} className="flex items-center gap-3 px-3.5 py-2.5">
          <BotAvatar color={bot.color} identity={bot.id} size={22} />
          <span className="min-w-0 flex-1 truncate text-sm">{bot.name}</span>
          <Switch
            aria-label={t`${bot.name} can use ${appName}`}
            checked={isOn(bot.id)}
            disabled={disabled}
            onCheckedChange={(next) => onToggle(bot.id, next)}
          />
        </div>
      ))}
    </div>
  );
}
