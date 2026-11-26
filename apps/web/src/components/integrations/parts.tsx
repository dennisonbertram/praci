import { Trans, useLingui } from "@lingui/react/macro";
import type { Bot } from "@rakazo/contracts";
import { isInboxAgentSpawnKey, isMailThreadAgentSpawnKey } from "@rakazo/contracts";
import {
  Badge,
  BotAvatar,
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Switch,
} from "@rakazo/ui-web";
import { MoreHorizontal } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { StatusKind } from "../../lib/integrations";
import { providerLabel } from "../../lib/integrations";
import { PickFilter, SearchField } from "../ListControls";
import { AppLogo } from "./AppLogo";

/** Search and the On/Off filter show once a list is longer than this. */
export const AGENT_LIST_CONTROLS_MIN = 8;

/** The tile's one main link, like "Open Inbox" on Gmail. It never wraps; all share one width. */
export const OPEN_LINK =
  "relative z-10 ms-auto inline-flex h-7 pointer-coarse:h-11 min-w-28 max-sm:min-w-30 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-border px-2.5 text-[0.8rem] font-medium hover:bg-muted";

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

/** Under the Connected heading "Connected" says nothing new, so cards pass `quiet` and show only other states. */
export function StatusBadge({ status, quiet }: { status: StatusKind; quiet?: boolean }) {
  const { t } = useLingui();
  if (quiet && status === "connected") return null;
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

/** A connected tile's one overflow menu, in its top corner so every card's bottom row lines up. Needs children; a card whose name already opens its page gets no menu. */
export function TileMenu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            className="absolute end-2 top-2 z-10 pointer-coarse:size-11"
            aria-label={label}
          />
        }
      >
        <MoreHorizontal aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
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
  onSetAll,
  ownerBotId,
  saving = false,
  everyone = false,
  subject = "account",
  ready = true,
  writes,
}: {
  bots: Bot[];
  isOn: (botId: string) => boolean;
  appName: string;
  disabled?: boolean;
  onToggle: (botId: string, next: boolean) => void;
  /** Shows All / None above the list; one call sets every agent. */
  onSetAll?: (on: boolean) => void;
  /** The connection's own agent: None leaves it on. */
  ownerBotId?: string | null;
  /** A save is in flight: All and None wait for it. */
  saving?: boolean;
  /** Access is stored as "all agents" (including future ones): All is already done; None still has work. */
  everyone?: boolean;
  /** What the agents get: an account (default) or a server connection. */
  subject?: "account" | "connection";
  /** False until the access data has arrived, so the first on-first order uses the real state. */
  ready?: boolean;
  /**
   * "Allow changes" under each agent that is on. `enabled` is the connection's own changes switch,
   * which gates every one of them; the owning agent shows that switch's state and is not editable.
   */
  writes?: {
    enabled: boolean;
    isWriting: (botId: string) => boolean;
    onToggle: (botId: string, next: boolean) => void;
  };
}) {
  const { t } = useLingui();
  const [query, setQuery] = useState("");
  const [show, setShow] = useState<string | undefined>();
  const isOnRef = useRef(isOn);
  isOnRef.current = isOn;
  // Each email's own chat is one agent; they share a single row, as in the sidebar.
  const emailChats = bots.filter((bot) => isMailThreadAgentSpawnKey(bot.spawnKey));
  const rows = bots.filter((bot) => !isMailThreadAgentSpawnKey(bot.spawnKey));
  const showControls = bots.length > AGENT_LIST_CONTROLS_MIN;
  // Mixed access reads as on (some chats still have it), so one click revokes all and never grants first.
  const someEmailOn = emailChats.some((bot) => isOn(bot.id));
  const allEmailOn = emailChats.every((bot) => isOn(bot.id));
  const owner = bots.find((bot) => bot.id === ownerBotId);
  // An email's chat has exactly the Inbox agent's access, so it stays on with the Inbox agent.
  const locked = (bot: Bot) =>
    bot.id === ownerBotId ||
    (isMailThreadAgentSpawnKey(bot.spawnKey) && isInboxAgentSpawnKey(owner?.spawnKey));
  const noneOn = bots.every((bot) => locked(bot) || !isOn(bot.id));
  // On a mail connection the Inbox agent and email chats sit together at the top, apart from the rest.
  const mail = isInboxAgentSpawnKey(owner?.spawnKey);
  // The connection's own agent stays pinned; the rest are searched, filtered and sorted on-first.
  // The order is taken from the access shown when the list loads or the search/filter changes, so
  // a row never moves while its switch is flipped.
  const others = rows.filter((bot) => bot.id !== owner?.id);
  const othersKey = others.map((bot) => bot.id).join(",");
  // isOn is read through a ref on purpose, so a toggle does not re-sort.
  const visibleOthers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const on = (bot: Bot) => isOnRef.current(bot.id);
    return others
      .filter((bot) => bot.name.toLowerCase().includes(needle))
      .filter((bot) => (show === "on" ? on(bot) : show === "off" ? !on(bot) : true))
      .sort((a, b) => Number(on(b)) - Number(on(a)) || a.name.localeCompare(b.name));
  }, [othersKey, query, show, ready]);
  const shownOthers = showControls ? visibleOthers : others;
  const agentRow = (bot: Bot) => {
    const isOwner = bot.id === ownerBotId;
    return (
      <div key={bot.id}>
        <div className="flex items-center gap-3 px-3.5 py-2.5">
          <BotAvatar color={bot.color} identity={bot.id} size={22} />
          <span className="min-w-0 flex-1 truncate text-sm">{bot.name}</span>
          <Switch
            aria-label={t`${bot.name} can use ${appName}`}
            checked={isOn(bot.id)}
            disabled={disabled}
            onCheckedChange={(next) => onToggle(bot.id, next)}
          />
        </div>
        {writes && isOn(bot.id) ? (
          <div className="flex items-center gap-3 pe-3.5 ps-[3.25rem] pb-2.5">
            <span className="min-w-0 flex-1">
              <span className="block text-[13px]">
                <Trans>Allow changes</Trans>
              </span>
              <span className="block text-xs text-muted-foreground">
                <Trans>The agent asks you before each change.</Trans>
              </span>
            </span>
            <Switch
              aria-label={t`${bot.name} can make changes in ${appName}`}
              checked={isOwner ? writes.enabled : writes.isWriting(bot.id)}
              disabled={disabled || isOwner || !writes.enabled}
              onCheckedChange={(next) => writes.onToggle(bot.id, next)}
            />
          </div>
        ) : null}
      </div>
    );
  };
  const chatsRow =
    emailChats.length > 0 ? (
      <div className="flex items-center gap-3 px-3.5 py-2.5">
        <span className="min-w-0 flex-1 truncate text-sm">
          <Trans>Email chats</Trans>
          <span className="ms-2 text-xs tabular-nums text-muted-foreground">
            {emailChats.length}
          </span>
          {someEmailOn && !allEmailOn ? (
            <span className="ms-2 text-xs text-muted-foreground">
              <Trans>Some</Trans>
            </span>
          ) : null}
        </span>
        <Switch
          aria-label={t`Email chats can use ${appName}`}
          checked={someEmailOn}
          disabled={disabled}
          onCheckedChange={(next) => {
            for (const bot of emailChats) onToggle(bot.id, next);
          }}
        />
      </div>
    ) : null;
  const noMatches =
    showControls && shownOthers.length === 0 ? (
      <div className="px-3.5 py-2.5 text-sm text-muted-foreground">
        <Trans>No matching agents</Trans>
      </div>
    ) : null;
  return (
    <>
      <p className="mb-2 text-sm text-muted-foreground">
        {subject === "connection" ? (
          <Trans>Which agents can use this connection.</Trans>
        ) : (
          <Trans>Which agents can use this account.</Trans>
        )}
      </p>
      <div className="divide-y divide-border rounded-xl border border-border bg-card">
        {showControls || (onSetAll && bots.length > 1) ? (
          <div className="flex flex-wrap items-center gap-1.5 px-2 py-1">
            {showControls ? (
              <>
                <SearchField
                  name="agent-search"
                  className="basis-full"
                  value={query}
                  placeholder={t`Search agents`}
                  label={t`Search agents`}
                  onChange={setQuery}
                />
                <PickFilter
                  inline
                  label={t`Show`}
                  anyLabel={t`All agents`}
                  value={show}
                  options={[
                    ["on", t`On`],
                    ["off", t`Off`],
                  ]}
                  onChange={setShow}
                />
              </>
            ) : null}
            {onSetAll && bots.length > 1 ? (
              <span className="ms-auto flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={disabled || saving || everyone}
                  onClick={() => onSetAll(true)}
                >
                  <Trans>All</Trans>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={disabled || saving || (noneOn && !everyone)}
                  onClick={() => onSetAll(false)}
                >
                  <Trans>None</Trans>
                </Button>
              </span>
            ) : null}
          </div>
        ) : null}
        {mail && owner ? (
          <>
            {agentRow(owner)}
            {chatsRow}
            {others.length > 0 ? (
              <div className="px-3.5 pb-1 pt-2.5 text-xs font-semibold text-muted-foreground">
                <Trans>Other agents</Trans>
              </div>
            ) : null}
            {shownOthers.map(agentRow)}
            {noMatches}
          </>
        ) : (
          <>
            {owner ? agentRow(owner) : null}
            {shownOthers.map(agentRow)}
            {noMatches}
            {chatsRow}
          </>
        )}
      </div>
    </>
  );
}

export function CardHead({
  name,
  logo,
  sub,
  to,
}: {
  name: string;
  logo?: string | null;
  /** One line, or several (each truncated on its own), such as the accounts of an app. */
  sub?: string | string[];
  to?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 pe-6 max-sm:min-w-36 max-sm:flex-1">
      <AppLogo name={name} logo={logo} />
      <div className="min-w-0">
        {to ? (
          <Link
            to={to}
            className="block truncate font-semibold after:absolute after:inset-0 pointer-coarse:-my-2.5 pointer-coarse:py-2.5"
          >
            {name}
          </Link>
        ) : (
          <div className="truncate font-semibold">{name}</div>
        )}
        {Array.isArray(sub) ? (
          sub.map((line) => (
            <div
              key={line}
              data-testid="account-line"
              className="truncate text-xs text-muted-foreground"
              title={line}
            >
              {line}
            </div>
          ))
        ) : sub ? (
          <div className="line-clamp-2 text-xs text-muted-foreground" title={sub}>
            {sub}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-2.5 mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  );
}

/** Marks apps that run through a third-party broker; direct integrations show nothing. */
export function SourceBadge({ connectorId }: { connectorId: string }) {
  if (connectorId !== "composio" && connectorId !== "pipedream") return null;
  const provider = providerLabel(connectorId);
  return (
    <Badge variant="outline" className="text-muted-foreground" data-source={connectorId}>
      <Trans>via {provider}</Trans>
    </Badge>
  );
}
