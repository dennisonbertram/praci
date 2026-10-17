import { Trans, useLingui } from "@lingui/react/macro";
import type { Connection } from "@rakazo/contracts";
import { matchFeaturedConnectorId } from "@rakazo/core";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Input,
} from "@rakazo/ui-web";
import { ArrowLeft } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  appStatus,
  groupTools,
  providerLabel,
  toggleAccess,
  toolLabel,
} from "../../lib/integrations";
import { appReturnPath } from "../../lib/return-to";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { AppLogo } from "./AppLogo";
import { ConnectAppDialog } from "./ConnectAppDialog";
import { AgentToggleList, StatusBadge } from "./parts";
import type { ConnectionAccess, IntegrationsData } from "./useIntegrations";

type Tool = { name: string; description: string };

export function Heading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-2.5 mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  );
}

function AccountRow({
  row,
  onChanged,
  onRemove,
}: {
  row: Connection;
  onChanged: () => void;
  onRemove: (row: Connection) => void;
}) {
  const { t } = useLingui();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const name = (draft ?? "").trim();
    setDraft(null);
    if (!name || name === row.displayName) return;
    try {
      await rpc.connections.rename({ connectionId: row.id, displayName: name });
      onChanged();
    } catch (err) {
      setError(errorText(err, t`Could not rename`));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-border px-3.5 py-2.5 first:border-t-0">
      <div className="min-w-40 flex-1">
        {draft === null ? (
          <b className="break-all">{row.displayName}</b>
        ) : (
          <Input
            autoFocus
            aria-label={t`Account name`}
            className="h-8"
            maxLength={80}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => void save()}
            onKeyDown={(event) => {
              if (event.key === "Enter") void save();
              if (event.key === "Escape") {
                // Cancels only the rename; nothing else listening for Escape should react.
                event.preventDefault();
                event.stopPropagation();
                setDraft(null);
              }
            }}
          />
        )}
        <small className="block text-xs text-muted-foreground">
          {row.status === "connected" ? (
            <Trans>Connected {new Date(row.createdAt).toLocaleDateString()}</Trans>
          ) : row.status === "error" ? (
            (row.error ?? t`Sign-in failed`)
          ) : (
            <Trans>Waiting for sign-in</Trans>
          )}
        </small>
        {error ? <small className="block text-xs text-destructive">{error}</small> : null}
      </div>
      <Button size="sm" variant="outline" onClick={() => setDraft(row.displayName)}>
        <Trans>Rename</Trans>
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="text-destructive"
        aria-label={t`Remove ${row.displayName}`}
        onClick={() => onRemove(row)}
      >
        <Trans>Remove</Trans>
      </Button>
    </div>
  );
}

export function AppDetail({ data, activeBotId }: { data: IntegrationsData; activeBotId?: string }) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const [search] = useSearchParams();
  // `?connect=1` opens the connect dialog on arrival; `?next=` is where to go once connected.
  const next = appReturnPath(search.get("next"));
  const handledKey = useRef<string | null>(null);
  const [confirmFirst, setConfirmFirst] = useState(false);
  const connectorId = decodeURIComponent(params.connectorId ?? "");
  const slug = decodeURIComponent(params.slug ?? "");
  const rows = data.connections.filter(
    (row) => row.connectorId === connectorId && row.provider === slug,
  );
  const item = data.catalog.find(
    (entry) => entry.connectorId === connectorId && entry.slug === slug,
  );
  const name = item?.name ?? rows[0]?.displayName ?? slug;
  const status = appStatus(rows);
  const connected = rows.filter((row) => row.status === "connected");
  const [tools, setTools] = useState<Tool[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [removingRow, setRemovingRow] = useState<Connection | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [override, setOverride] = useState<ConnectionAccess | null>(null);
  const connectedCount = connected.length;
  const isGmail =
    matchFeaturedConnectorId(slug) === "gmail" || (connectorId === "google" && /mail/i.test(slug));

  useEffect(() => {
    // Once per navigation, so moving between app pages re-arms it.
    if (search.get("connect") !== "1" || !data.loaded || handledKey.current === location.key)
      return;
    handledKey.current = location.key;
    if (connectedCount > 0) {
      if (next) navigate(next, { replace: true });
    } else if (item) {
      // A link may open the dialog, but nothing is created until the person clicks Connect in it.
      setConfirmFirst(true);
      setAdding(true);
    }
  }, [data.loaded, connectedCount, item, next, navigate, search, location.key]);

  useEffect(() => {
    if (connectedCount === 0) {
      setTools(null);
      return;
    }
    let cancelled = false;
    void rpc.connections
      .tools({ connectorId, provider: slug })
      .then((list) => !cancelled && setTools(list))
      .catch(() => !cancelled && setTools([]));
    return () => {
      cancelled = true;
    };
  }, [connectorId, slug, connectedCount]);

  const access: ConnectionAccess = override ??
    (rows[0] ? data.access[rows[0].id] : undefined) ?? { allAgents: true, botIds: [] };
  const allBotIds = data.bots.map((bot) => bot.id);

  async function setAgent(botId: string, on: boolean) {
    const next = toggleAccess(access, allBotIds, botId, on);
    setOverride(next);
    setError(null);
    try {
      // Access is per app: the server applies it to every account of this app.
      if (rows[0]) await rpc.connections.setAccess({ connectionId: rows[0].id, ...next });
      await data.refresh();
    } catch (err) {
      setError(errorText(err, t`Could not update agent access`));
    } finally {
      setOverride(null);
    }
  }

  async function revoke(targets: Connection[], afterRemovingAll: boolean) {
    setBusy(true);
    setError(null);
    try {
      for (const row of targets) await rpc.connections.revoke({ connectionId: row.id });
      await data.refresh();
      setRemovingRow(null);
      setDisconnecting(false);
      if (afterRemovingAll) navigate("/app/integrations");
    } catch (err) {
      setError(errorText(err, t`Could not disconnect`));
    } finally {
      setBusy(false);
    }
  }

  const dialog =
    adding && item ? (
      <ConnectAppDialog
        item={item}
        data={data}
        activeBotId={activeBotId}
        confirmFirst={confirmFirst}
        onClose={() => {
          setAdding(false);
          setConfirmFirst(false);
        }}
        onConnected={next ? () => navigate(next) : undefined}
      />
    ) : null;

  const back = (
    <Link
      to="/app/integrations"
      className="mb-3.5 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      <Trans>Integrations</Trans>
    </Link>
  );

  if (!data.loaded) return <div className="px-9 py-7">{back}</div>;
  if (rows.length === 0) {
    // The dialog is the second child in every return so it survives the page switching to the
    // connected view when the first account lands.
    return (
      <>
        <div className="px-4 py-6 md:px-9 md:py-7">
          {back}
          <h1 className="text-xl font-semibold">{name}</h1>
          {item ? (
            <>
              <p className="mb-4 mt-1 text-muted-foreground">
                <Trans>{name} is not connected.</Trans>
              </p>
              <Button onClick={() => setAdding(true)}>
                <Trans>Connect</Trans>
              </Button>
            </>
          ) : (
            <>
              <p className="mb-4 mt-1 text-muted-foreground">
                <Trans>{name} isn't available on this server.</Trans>
              </p>
              {data.setup?.canConfigure ? (
                <Link
                  to={`/integrations/setup?next=${encodeURIComponent(
                    appReturnPath(`${location.pathname}${location.search}`) ?? location.pathname,
                  )}`}
                  className="inline-flex h-8 items-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground"
                >
                  <Trans>Set up app catalog</Trans>
                </Link>
              ) : (
                <p className="text-muted-foreground">
                  <Trans>Ask the server owner to set up the app catalog.</Trans>
                </p>
              )}
            </>
          )}
        </div>
        {dialog}
      </>
    );
  }

  const grouped = groupTools(tools ?? []);
  const accountCount = rows.length;
  return (
    <>
      <div className="rk-scroll h-full overflow-y-auto px-4 py-6 md:px-9 md:py-7">
        <div className="mx-auto max-w-[1040px]">
          {back}
          <div className="flex flex-wrap items-center gap-4">
            <AppLogo name={name} logo={item?.logo} size="xl" />
            <div>
              <h1 className="text-xl font-semibold">{name}</h1>
              <div className="flex flex-wrap items-center gap-2.5 text-muted-foreground">
                {status ? <StatusBadge status={status} /> : null}
                <span>
                  <Trans>via {providerLabel(connectorId)}</Trans>
                </span>
              </div>
            </div>
          </div>
          {item?.description ? (
            <p className="mt-3 max-w-[640px] text-muted-foreground">{item.description}</p>
          ) : null}
          {error ? (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Heading>
            <Trans>Accounts</Trans>
          </Heading>
          <div className="rounded-xl border border-border bg-card">
            {rows.map((row) => (
              <AccountRow
                key={row.id}
                row={row}
                onChanged={() => void data.refresh()}
                onRemove={setRemovingRow}
              />
            ))}
          </div>
          {item ? (
            <p className="mt-2.5">
              <Button variant="outline" onClick={() => setAdding(true)}>
                <Trans>Add another account</Trans>
              </Button>
            </p>
          ) : null}

          {connected.length > 0 ? (
            <>
              <Heading>
                <Trans>Used by</Trans>
              </Heading>
              <AgentToggleList
                bots={data.bots}
                appName={name}
                isOn={(botId) => access.allAgents || access.botIds.includes(botId)}
                onToggle={(botId, on) => void setAgent(botId, on)}
              />

              <Heading>
                {tools ? <Trans>Tools · {tools.length}</Trans> : <Trans>Tools</Trans>}
              </Heading>
              {tools && tools.length === 0 ? (
                <p className="text-muted-foreground">
                  <Trans>No tools available.</Trans>
                </p>
              ) : tools ? (
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                  {(
                    [
                      ["read", t`Read`, t`Never changes your account`, grouped.read],
                      ["write", t`Write`, t`Changes your account`, grouped.write],
                    ] as const
                  ).map(([key, label, hint, list]) =>
                    list.length === 0 ? null : (
                      <div key={key} data-testid={`tools-${key}`}>
                        <div className="flex justify-between border-t border-border bg-muted px-3.5 py-2 text-xs font-semibold first:border-t-0">
                          <span>{label}</span>
                          <span className="font-normal text-muted-foreground">{hint}</span>
                        </div>
                        {list.map((tool) => (
                          <div
                            key={tool.name}
                            className="flex flex-wrap items-baseline gap-x-3 border-t border-border px-3.5 py-2"
                          >
                            <span className="min-w-36 text-xs font-medium" title={tool.name}>
                              {toolLabel(tool.name, slug)}
                            </span>
                            <span className="min-w-48 flex-1 text-muted-foreground">
                              {tool.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    ),
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">
                  <Trans>Loading tools…</Trans>
                </p>
              )}
            </>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              className="border-destructive text-destructive"
              onClick={() => setDisconnecting(true)}
            >
              <Trans>Disconnect {name}</Trans>
            </Button>
            <span className="text-muted-foreground">
              {accountCount > 1 ? (
                <Trans>Removes all {accountCount} accounts and agent access.</Trans>
              ) : (
                <Trans>Removes the account and agent access.</Trans>
              )}
            </span>
          </div>
        </div>

        <ConfirmDialog
          open={removingRow !== null}
          busy={busy}
          title={t`Remove ${removingRow?.displayName ?? ""}?`}
          confirm={t`Remove`}
          onCancel={() => setRemovingRow(null)}
          onConfirm={() => removingRow && void revoke([removingRow], rows.length === 1)}
        >
          <li>
            <Trans>Agents lose access to this account.</Trans>
          </li>
          {isGmail ? (
            <li>
              <Trans>Mail data from this account that Rakazo cached is removed.</Trans>
            </li>
          ) : null}
          <li>
            <Trans>Your data in {name} is not deleted.</Trans>
          </li>
        </ConfirmDialog>
        <ConfirmDialog
          open={disconnecting}
          busy={busy}
          title={t`Disconnect ${name}?`}
          confirm={t`Disconnect ${name}`}
          onCancel={() => setDisconnecting(false)}
          onConfirm={() => void revoke(rows, true)}
        >
          <li>
            <Trans>Every agent loses access to {name}.</Trans>
          </li>
          {isGmail ? (
            <>
              <li>
                <Trans>Mail data Rakazo cached from these accounts is removed.</Trans>
              </li>
              <li>
                <Trans>The Inbox page stops showing new mail until you reconnect.</Trans>
              </li>
            </>
          ) : null}
          <li>
            <Trans>Your data in {name} is not deleted.</Trans>
          </li>
        </ConfirmDialog>
      </div>
      {dialog}
    </>
  );
}

export function ConfirmDialog({
  open,
  busy,
  title,
  confirm,
  children,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  title: string;
  confirm: string;
  children: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription render={<div />}>
            <ul className="list-disc space-y-1.5 ps-5 text-foreground">{children}</ul>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            <Trans>Cancel</Trans>
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
