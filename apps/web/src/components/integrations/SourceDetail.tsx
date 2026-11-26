import { Trans, useLingui } from "@lingui/react/macro";
import type { CapabilityInstall } from "@rakazo/contracts";
import { Button, Input, Skeleton } from "@rakazo/ui-web";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { ConfirmDialog } from "./AppDetail";
import { AppLogo } from "./AppLogo";
import { IntegrationAgentSection } from "./IntegrationAgentSection";
import { AgentToggleList } from "./parts";
import type { IntegrationsData } from "./useIntegrations";

const hostOf = (value: string) => {
  try {
    return new URL(value).host;
  } catch {
    return value;
  }
};

/**
 * Whether the source has anything that changes data. An API or GraphQL source lists its
 * operations; an MCP source's tools are only known once it is called, so it offers the switch.
 */
export function sourceCanWrite(source: Pick<CapabilityInstall, "kind" | "config">): boolean {
  if (source.kind === "mcp") return true;
  const operations = Array.isArray(source.config.operations)
    ? (source.config.operations as {
        readOnly?: boolean;
        method?: string;
        operationType?: string;
      }[])
    : [];
  return operations.some((operation) =>
    source.kind === "graphql"
      ? operation.operationType !== "query"
      : operation.readOnly !== true || operation.method !== "GET",
  );
}

/** A directly connected MCP, API or GraphQL source: its agent, who else may use it, and changes. */
export function SourceDetail({ data }: { data: IntegrationsData }) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { sourceId = "" } = useParams();
  const source = data.sources.find((entry) => entry.id === sourceId);
  const [draft, setDraft] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [confirmingWrites, setConfirmingWrites] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const back = (
    <Link
      to="/app/integrations"
      className="rk-tap mb-3.5 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      <Trans>Integrations</Trans>
    </Link>
  );
  if (!source) {
    return (
      <div className="px-4 py-6 md:px-9 md:py-7">
        {back}
        {data.loaded ? (
          <p className="text-muted-foreground">
            <Trans>This connection no longer exists.</Trans>
          </p>
        ) : (
          <div role="status" aria-label={t`Loading`}>
            <Skeleton className="h-7 w-56" />
            <Skeleton className="mt-4 h-24 w-full max-w-xl rounded-xl" />
          </div>
        )}
      </div>
    );
  }

  async function run(action: () => Promise<unknown>, fallback: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorText(err, fallback));
    } finally {
      // Show what the server has, also after a failure that may have landed part of a change.
      await data.refresh().catch(() => undefined);
      setBusy(false);
    }
  }

  const id = source.id;
  const agent = data.bots.find((bot) => bot.id === source.agentBotId);
  const usable = new Set(source.usableBotIds ?? []);
  const writing = new Set(source.writeBotIds ?? []);
  const rename = () =>
    run(async () => {
      const name = (draft ?? "").trim();
      setDraft(null);
      if (name && name !== source.name) await rpc.capabilities.rename({ id, name });
    }, t`Could not rename`);

  return (
    <div className="rk-scroll h-full overflow-y-auto px-4 py-6 md:px-9 md:py-7">
      <div className="mx-auto max-w-[1040px]">
        {back}
        <div className="flex flex-wrap items-center gap-4">
          <AppLogo name={source.name} size="xl" />
          <div className="min-w-0">
            {draft === null ? (
              <h1 className="break-all text-xl font-semibold">{source.name}</h1>
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
            <div className="text-muted-foreground">
              {source.kind.toUpperCase()} · {hostOf(source.source)}
            </div>
          </div>
        </div>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {source.agentBotId ? null : (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const { botId } = await rpc.capabilities.createAgent({ id });
                  navigate(`/app/${botId}`);
                }, t`Could not create agent`)
              }
            >
              <Trans>Create agent</Trans>
            </Button>
          )}
          <Button variant="outline" disabled={busy} onClick={() => setDraft(source.name)}>
            <Trans>Rename</Trans>
          </Button>
        </div>

        {source.agentBotId ? (
          <IntegrationAgentSection
            idPrefix="source"
            service={source.name}
            agentName={agent?.name ?? t`${source.name} agent`}
            agentHref={`/app/${source.agentBotId}`}
            writesEnabled={source.writesEnabled ?? false}
            shared={source.agentShared ?? false}
            disabled={busy}
            onWrites={
              sourceCanWrite(source)
                ? (on) =>
                    on
                      ? setConfirmingWrites(true)
                      : void run(
                          () => rpc.capabilities.setWrites({ id, enabled: false }),
                          t`Could not update changes`,
                        )
                : undefined
            }
            onShared={(shared) =>
              void run(
                () => rpc.capabilities.setExclusive({ id, exclusive: !shared }),
                t`Could not update access`,
              )
            }
            usedBy={
              <AgentToggleList
                key={id}
                ready={data.loaded}
                bots={[...data.bots].sort(
                  (a, b) => Number(b.id === source.agentBotId) - Number(a.id === source.agentBotId),
                )}
                appName={source.name}
                disabled={busy}
                isOn={(botId) => usable.has(botId)}
                onToggle={(botId, on) =>
                  void run(
                    () => rpc.capabilities.setAgentAccess({ id, botId, on }),
                    t`Could not update bot access`,
                  )
                }
                onSetAll={(on) =>
                  void run(
                    () => rpc.capabilities.setAllAgents({ id, on }),
                    t`Could not update bot access`,
                  )
                }
                ownerBotId={source.agentBotId}
                everyone={source.allAgents ?? false}
                subject="connection"
                writes={
                  sourceCanWrite(source)
                    ? {
                        enabled: source.writesEnabled ?? false,
                        isWriting: (botId) => writing.has(botId),
                        onToggle: (botId, canWrite) =>
                          void run(
                            () =>
                              rpc.capabilities.setAgentAccess({ id, botId, on: true, canWrite }),
                            t`Could not update changes`,
                          ),
                      }
                    : undefined
                }
              />
            }
          />
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            className="border-destructive text-destructive"
            onClick={() => setRemoving(true)}
          >
            <Trans>Remove {source.name}</Trans>
          </Button>
          <span className="text-sm text-muted-foreground">
            <Trans>Removes the connection and bot access.</Trans>
          </span>
        </div>
      </div>
      <ConfirmDialog
        open={removing}
        busy={busy}
        title={t`Remove ${source.name}?`}
        confirm={t`Remove ${source.name}`}
        onCancel={() => setRemoving(false)}
        onConfirm={() =>
          void run(async () => {
            await rpc.capabilities.remove({ id });
            setRemoving(false);
            navigate("/app/integrations");
          }, t`Could not remove`)
        }
      >
        <li>
          <Trans>Bots lose access to the tools of {source.name}.</Trans>
        </li>
        <li>
          <Trans>Your data in {source.name} is not deleted.</Trans>
        </li>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirmingWrites}
        busy={busy}
        title={t`Allow changes in ${source.name}?`}
        confirm={t`Allow changes`}
        grant
        onCancel={() => setConfirmingWrites(false)}
        onConfirm={() => {
          setConfirmingWrites(false);
          void run(
            () => rpc.capabilities.setWrites({ id, enabled: true }),
            t`Could not update changes`,
          );
        }}
      >
        <li>
          <Trans>
            The agent will be able to change your {source.name} data. It asks before each change.
          </Trans>
        </li>
      </ConfirmDialog>
    </div>
  );
}
