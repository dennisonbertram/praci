import { Trans, useLingui } from "@lingui/react/macro";
import { financeProviderForEndpoint, isCartaEndpoint, isDevinEndpoint } from "@rakazo/contracts";
import { Button, Input } from "@rakazo/ui-web";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { mcpStatus } from "../../lib/integrations";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { ConfirmDialog, Heading } from "./AppDetail";
import { AppLogo } from "./AppLogo";
import { CustomConnectionDialog } from "./CustomConnectionDialog";
import { IntegrationAgentSection } from "./IntegrationAgentSection";
import { AgentToggleList, StatusBadge } from "./parts";
import type { IntegrationsData } from "./useIntegrations";
import { useMcpReconnect } from "./useMcpReconnect";

export function McpDetail({ data }: { data: IntegrationsData }) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { serverId = "" } = useParams();
  const server = data.servers.find((entry) => entry.id === serverId);
  const reconnect = useMcpReconnect(serverId, () => void data.refresh());
  const [draft, setDraft] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [confirmingWrites, setConfirmingWrites] = useState(false);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const back = (
    <Link
      to="/app/integrations"
      className="mb-3.5 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      <Trans>Apps</Trans>
    </Link>
  );
  if (!server) {
    return (
      <div className="px-4 py-6 md:px-9 md:py-7">
        {back}
        {data.loaded ? (
          <p className="text-muted-foreground">
            <Trans>This connection no longer exists.</Trans>
          </p>
        ) : null}
      </div>
    );
  }

  const status = reconnect.busy ? "connecting" : mcpStatus(server);
  const assigned = (botId: string) =>
    data.mcpAssignments.some((entry) => entry.botId === botId && entry.serverId === server.id);

  async function run(action: () => Promise<void>, fallback: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await data.refresh();
    } catch (err) {
      setError(errorText(err, fallback));
    } finally {
      setBusy(false);
    }
  }

  const rename = () =>
    run(async () => {
      const name = (draft ?? "").trim();
      setDraft(null);
      if (name && name !== server.name) await rpc.mcp.servers.rename({ id: server.id, name });
    }, t`Could not rename`);

  const assign = async (botId: string, on: boolean) => {
    // replace() overwrites the bot's whole list, so start from what it already has.
    const current = await rpc.mcp.assignments.list({ botId });
    const others = current
      .filter((entry) => entry.serverId !== server.id)
      .map(({ serverId: id, allowAllTools, allowedTools }) => ({
        serverId: id,
        allowAllTools,
        allowedTools,
      }));
    const kept = current.find((entry) => entry.serverId === server.id);
    await rpc.mcp.assignments.replace({
      botId,
      assignments: on
        ? [
            ...others,
            kept
              ? {
                  serverId: server.id,
                  allowAllTools: kept.allowAllTools,
                  allowedTools: kept.allowedTools,
                }
              : { serverId: server.id, allowAllTools: true, allowedTools: [] },
          ]
        : others,
    });
  };
  const toggle = (botId: string, on: boolean) =>
    run(() => assign(botId, on), t`Could not update bot access`);

  /** On: every agent in the space gets the server. Off: back to the owning agent alone. */
  const setShared = (shared: boolean) =>
    run(async () => {
      const exclusive = (value: boolean) =>
        rpc.integrationAgents.setExclusive({ serverId: server.id, exclusive: value });
      if (shared) {
        // Exclusivity must be off first: the server refuses to grant an exclusive server to other agents.
        await exclusive(false);
        for (const bot of data.bots) if (!assigned(bot.id)) await assign(bot.id, true);
        return;
      }
      await exclusive(true);
      if (server.agentBotId && !assigned(server.agentBotId)) await assign(server.agentBotId, true);
      for (const bot of data.bots)
        if (bot.id !== server.agentBotId && assigned(bot.id)) await assign(bot.id, false);
    }, t`Could not update access`);

  const host = server.endpoint ? new URL(server.endpoint).host : (server.command ?? "");
  const carta = isCartaEndpoint(server.endpoint);
  const bank = Boolean(financeProviderForEndpoint(server.endpoint));
  const service = carta ? "Carta" : server.name;
  const agent = data.bots.find((bot) => bot.id === server.agentBotId);
  const hasAgent = server.agentBotId !== null;
  const setWrites = (on: boolean) =>
    on
      ? setConfirmingWrites(true)
      : void run(
          () => rpc.mcp.servers.setWrites({ id: server.id, enabled: false }).then(() => undefined),
          t`Could not update changes`,
        );
  const usedBy = (
    <AgentToggleList
      bots={[...data.bots].sort(
        (a, b) => Number(b.id === server.agentBotId) - Number(a.id === server.agentBotId),
      )}
      appName={server.name}
      disabled={busy}
      isOn={assigned}
      onToggle={(botId, on) => void toggle(botId, on)}
    />
  );
  return (
    <div className="rk-scroll h-full overflow-y-auto px-4 py-6 md:px-9 md:py-7">
      <div className="mx-auto max-w-[1040px]">
        {back}
        <div className="flex flex-wrap items-center gap-4">
          <AppLogo name={server.name} size="xl" />
          <div className="min-w-0">
            {draft === null ? (
              <h1 className="break-all text-xl font-semibold">{server.name}</h1>
            ) : (
              <Input
                autoFocus
                aria-label={t`Name`}
                className="h-8"
                maxLength={120}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={() => void rename()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void rename();
                  if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    setDraft(null);
                  }
                }}
              />
            )}
            <div className="flex flex-wrap items-center gap-2.5 text-muted-foreground">
              <StatusBadge status={status} />
              {/* Carta is a known service; its MCP host means nothing to a founder. */}
              {carta ? null : (
                <span>
                  <Trans>via MCP · {host}</Trans>
                </span>
              )}
            </div>
          </div>
        </div>
        {error || reconnect.error ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error ?? reconnect.error}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {carta ? (
            <Button variant="outline" render={<Link to="/app/cap-table" />}>
              <Trans>Open Cap table</Trans>
            </Button>
          ) : null}
          {server.transport !== "stdio" ? (
            <Button
              variant={status === "reconnect" ? "default" : "outline"}
              disabled={reconnect.busy || busy}
              onClick={() => void reconnect.run()}
            >
              <Trans>Reconnect</Trans>
            </Button>
          ) : null}
          {/* Only a live sign-in can be disconnected; afterwards the badge reads "needs sign-in". */}
          {server.oauthStatus === "connected" ? (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(
                  () => rpc.mcp.oauth.disconnect({ serverId: server.id }).then(() => undefined),
                  t`Could not disconnect`,
                )
              }
            >
              <Trans>Disconnect sign-in</Trans>
            </Button>
          ) : null}
          {!hasAgent ? (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  setCreating(true);
                  try {
                    const { botId } = await rpc.integrationAgents.create({ serverId: server.id });
                    navigate(`/app/${botId}`);
                  } finally {
                    setCreating(false);
                  }
                }, t`Could not create agent`)
              }
            >
              {creating ? <Trans>Creating agent</Trans> : <Trans>Create agent</Trans>}
            </Button>
          ) : null}
          <Button variant="outline" disabled={busy} onClick={() => setDraft(server.name)}>
            <Trans>Rename</Trans>
          </Button>
        </div>

        {hasAgent && server.agentBotId ? (
          <IntegrationAgentSection
            service={service}
            agentName={agent?.name ?? t`${service} agent`}
            agentHref={`/app/${server.agentBotId}`}
            writesEnabled={server.writesEnabled}
            shared={!server.agentExclusive}
            disabled={busy}
            onWrites={isDevinEndpoint(server.endpoint) ? undefined : setWrites}
            usedBy={usedBy}
            onShared={(shared) => void setShared(shared)}
          />
        ) : null}

        {hasAgent ? null : (
          <>
            <Heading>
              <Trans>Used by</Trans>
            </Heading>
            {usedBy}
          </>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            className="border-destructive text-destructive"
            onClick={() => setRemoving(true)}
          >
            <Trans>Remove {server.name}</Trans>
          </Button>
          <span className="text-sm text-muted-foreground">
            <Trans>Removes the connection and bot access.</Trans>
          </span>
        </div>
      </div>
      <ConfirmDialog
        open={removing}
        busy={busy}
        title={t`Remove ${server.name}?`}
        confirm={t`Remove ${server.name}`}
        onCancel={() => setRemoving(false)}
        onConfirm={() =>
          void run(async () => {
            await rpc.mcp.servers.remove({ id: server.id });
            setRemoving(false);
            navigate("/app/integrations");
          }, t`Could not remove`)
        }
      >
        <li>
          {carta ? (
            <Trans>The Carta agent loses access to Carta.</Trans>
          ) : (
            <Trans>Bots lose access to the tools of {server.name}.</Trans>
          )}
        </li>
        <li>
          <Trans>Your data in {server.name} is not deleted.</Trans>
        </li>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirmingWrites}
        busy={busy}
        title={t`Allow changes in ${service}?`}
        confirm={t`Allow changes`}
        grant
        onCancel={() => setConfirmingWrites(false)}
        onConfirm={() =>
          void run(async () => {
            await rpc.mcp.servers.setWrites({ id: server.id, enabled: true });
            setConfirmingWrites(false);
          }, t`Could not update changes`)
        }
      >
        <li>
          {carta ? (
            <Trans>
              The Carta agent will be able to change your Carta data. It asks before each change.
            </Trans>
          ) : bank ? (
            <Trans>
              The agent will be able to move money and change your {service} accounts. It asks
              before each change.
            </Trans>
          ) : (
            <Trans>
              The agent will be able to change your {service} data. It asks before each change.
            </Trans>
          )}
        </li>
      </ConfirmDialog>
      {reconnect.needsClient ? (
        <CustomConnectionDialog data={data} existingServer={server} onClose={reconnect.dismiss} />
      ) : null}
    </div>
  );
}
