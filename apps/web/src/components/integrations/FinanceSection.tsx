import { Trans, useLingui } from "@lingui/react/macro";
import type {
  ExchangeProvider,
  FinanceExchange,
  FinanceProvider,
  FinanceSource,
} from "@rakazo/contracts";
import { Button, DropdownMenuItem } from "@rakazo/ui-web";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { connectFinanceProvider } from "../../lib/finance-connect";
import { financePath } from "../../lib/finance-route";
import { EXCHANGES, FINANCE_PROVIDERS } from "../../lib/integrations";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { ErrorNotice } from "../finance/ui";
import { AlchemyConnectDialog } from "./AlchemyConnectDialog";
import { ConfirmDialog } from "./AppDetail";
import { AppLogo } from "./AppLogo";
import { BlockscoutConnectDialog } from "./BlockscoutConnectDialog";
import { ExchangeConnectDialog } from "./ExchangeConnectDialog";
import { IntegrationTile, OPEN_LINK, StatusBadge, TileMenu } from "./parts";

/** False once the tile has unmounted, so a slow request does not set state afterwards. */
function useMounted() {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}

/** Same hover as the other integration tiles; `relative` anchors the stretched name link. */
const TILE = "relative transition-colors hover:bg-muted/40";

/** A tile's name; when the connection has an MCP server it links to that page, covering the tile. */
function TileName({ name, to }: { name: string; to?: string }) {
  return to ? (
    <Link
      to={to}
      className="block truncate font-semibold outline-none pointer-coarse:-my-2.5 pointer-coarse:py-2.5 after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
    >
      {name}
    </Link>
  ) : (
    <div className="truncate font-semibold">{name}</div>
  );
}

/**
 * Balances come from public RPC, so Blockscout works without a key (the first wallet creates its
 * keyless server); a server without a key offers to add one instead of claiming it is not connected.
 */
function CryptoTile({
  hasKey,
  hasServer,
  manageTo,
  reload,
  loadError,
  children,
}: {
  hasKey: boolean | null;
  hasServer?: boolean;
  /** The Blockscout MCP server's page, where its agents are chosen. */
  manageTo?: string;
  reload: () => void;
  loadError: boolean;
  children?: ReactNode;
}) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState(false);

  return (
    <IntegrationTile data-testid="finance-tile-crypto" className={TILE}>
      <div className="flex min-w-0 items-center gap-3 pe-6">
        <AppLogo name="Blockscout" logo="/logos/blockscout.svg" />
        <div className="min-w-0">
          <TileName name="Blockscout" to={manageTo} />
          <div className="line-clamp-2 text-xs text-muted-foreground">
            <Trans>Wallet balances and history</Trans>
          </div>
        </div>
      </div>
      {children}
      <div className="mt-auto flex items-center gap-2">
        {hasKey === null ? null : (
          <>
            {/* Nothing to connect without a key: the first wallet added starts it. Not "Not connected". */}
            {hasKey || hasServer ? <StatusBadge status="connected" quiet /> : null}
            {/* One main action like the other tiles; the optional key and agents sit in the menu. */}
            <Link to={financePath.crypto()} className={OPEN_LINK}>
              {hasKey || hasServer ? <Trans>Open Finance</Trans> : <Trans>Add wallet</Trans>}
            </Link>
            <TileMenu label={t`More Blockscout actions`}>
              {/* The key is optional: without one, balances still come from public RPC. */}
              <DropdownMenuItem onClick={() => setDialog(true)}>
                {hasKey ? <Trans>Replace API key</Trans> : <Trans>Add API key</Trans>}
              </DropdownMenuItem>
              {manageTo ? (
                <DropdownMenuItem onClick={() => navigate(manageTo)}>
                  <Trans>Manage agents</Trans>
                </DropdownMenuItem>
              ) : null}
            </TileMenu>
          </>
        )}
      </div>
      {loadError ? <ErrorNotice message={t`Could not load`} onRetry={reload} /> : null}
      {dialog ? (
        <BlockscoutConnectDialog onConnected={reload} onClose={() => setDialog(false)} />
      ) : null}
    </IntegrationTile>
  );
}

/** Named like a connection so the remove dialog reuses its copy. */
const ALCHEMY = { name: "Alchemy" };

/** Optional: with an Alchemy key, holdings come from Alchemy instead of the public RPC source. */
function AlchemyTile({
  state,
  reload,
  loadError,
}: {
  state: AlchemyState | null;
  reload: () => void;
  loadError: boolean;
}) {
  const { t } = useLingui();
  const [dialog, setDialog] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await rpc.finance.cryptoProviderRemove({ provider: "alchemy" });
      setConfirming(false);
      reload();
    } catch (cause) {
      setConfirming(false);
      setError(errorText(cause, t`Could not remove`));
    } finally {
      setBusy(false);
    }
  }

  return (
    <IntegrationTile data-testid="finance-tile-alchemy" className={TILE}>
      <div className="flex min-w-0 items-center gap-3 pe-6">
        <AppLogo name="Alchemy" logo="/logos/alchemy.svg" />
        <div className="min-w-0">
          <div className="truncate font-semibold">Alchemy</div>
          <div className="line-clamp-2 text-xs text-muted-foreground">
            <Trans>Optional faster balance reads</Trans>
          </div>
        </div>
      </div>
      <div className={`${state?.connected ? "" : "mt-auto "}flex items-center gap-2`}>
        {state?.connected ? (
          <>
            <StatusBadge status="connected" quiet />
            <Link to={financePath.crypto()} className={OPEN_LINK}>
              <Trans>Open</Trans>
            </Link>
            <TileMenu label={t`More Alchemy actions`}>
              <DropdownMenuItem onClick={() => setDialog(true)}>
                <Trans>Replace API key</Trans>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setConfirming(true)}>
                <Trans>Remove</Trans>
              </DropdownMenuItem>
            </TileMenu>
          </>
        ) : state === null || loadError ? null : (
          <>
            <Button
              size="sm"
              variant="outline"
              className="ms-auto"
              aria-label={t`Connect Alchemy`}
              onClick={() => setDialog(true)}
            >
              <Trans>Connect</Trans>
            </Button>
          </>
        )}
      </div>
      {loadError ? <ErrorNotice message={t`Could not load`} onRetry={reload} /> : null}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {state?.lastError ? (
        <p role="alert" className="text-xs text-destructive">
          {state.lastError}
        </p>
      ) : null}
      {dialog ? (
        <AlchemyConnectDialog onConnected={reload} onClose={() => setDialog(false)} />
      ) : null}
      <ConfirmDialog
        open={confirming}
        busy={busy}
        title={t`Remove ${ALCHEMY.name}?`}
        confirm={t`Remove ${ALCHEMY.name}`}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void remove()}
      >
        <li>
          <Trans>Your data in {ALCHEMY.name} is not deleted.</Trans>
        </li>
      </ConfirmDialog>
    </IntegrationTile>
  );
}

/** Connected only after the first successful balance read, so a key the exchange refused never shows as connected. */
function ExchangeTile({
  provider,
  found,
  reload,
  loadError,
}: {
  provider: ExchangeProvider;
  found: FinanceExchange | null | undefined;
  reload: () => void;
  loadError: boolean;
}) {
  const { t } = useLingui();
  const exchange = EXCHANGES.find((e) => e.provider === provider) ?? EXCHANGES[0];
  const [dialog, setDialog] = useState(false);

  const connected = found?.connected === true;
  return (
    <IntegrationTile data-testid={`finance-tile-${provider}`} className={TILE}>
      <div className="flex min-w-0 items-center gap-3 pe-6">
        <AppLogo name={exchange.name} logo={exchange.logo} />
        <div className="min-w-0">
          <div className="truncate font-semibold">{exchange.name}</div>
          <div className="line-clamp-2 text-xs text-muted-foreground">
            <Trans>Read exchange balances</Trans>
          </div>
        </div>
      </div>
      <div className={`${connected ? "" : "mt-auto "}flex items-center gap-2`}>
        {connected ? (
          <>
            <StatusBadge status="connected" quiet />
            <Link to={financePath.crypto()} className={OPEN_LINK}>
              <Trans>Open Finance</Trans>
            </Link>
            <TileMenu label={t`More ${exchange.name} actions`}>
              <DropdownMenuItem onClick={() => setDialog(true)}>
                <Trans>Replace key</Trans>
              </DropdownMenuItem>
            </TileMenu>
          </>
        ) : found === undefined || loadError ? null : (
          <>
            <Button
              size="sm"
              variant="outline"
              className="ms-auto"
              aria-label={t`Connect ${exchange.name}`}
              onClick={() => setDialog(true)}
            >
              <Trans>Connect</Trans>
            </Button>
          </>
        )}
      </div>
      {loadError ? <ErrorNotice message={t`Could not load`} onRetry={reload} /> : null}
      {dialog ? (
        <ExchangeConnectDialog
          provider={provider}
          onConnected={reload}
          onClose={() => setDialog(false)}
        />
      ) : null}
    </IntegrationTile>
  );
}

type AlchemyState = { connected: boolean; lastError: string | null };

/** What the crypto and exchange endpoints say is connected. `null` means not loaded yet. */
export type FinanceStatus = {
  blockscout: boolean | null;
  /** A Blockscout server exists, with or without its key. */
  blockscoutServer?: boolean;
  alchemy: AlchemyState | null;
  exchanges: FinanceExchange[] | null;
  cryptoError: boolean;
  exchangesError: boolean;
  reload: () => void;
};

/** Fetch the crypto and exchange state once, so every finance tile on the page shares it. */
export function useFinanceStatus(): FinanceStatus {
  const [crypto, setCrypto] = useState<{
    blockscout: boolean;
    blockscoutServer: boolean;
    alchemy: AlchemyState;
  } | null>(null);
  const [exchanges, setExchanges] = useState<FinanceExchange[] | null>(null);
  const [cryptoError, setCryptoError] = useState(false);
  const [exchangesError, setExchangesError] = useState(false);
  const mounted = useMounted();
  const reload = useCallback(() => {
    rpc.finance
      .crypto()
      .then((c) => {
        if (!mounted.current) return;
        setCrypto({
          blockscout: c.connected && c.hasApiKey,
          blockscoutServer: c.connected,
          alchemy: c.alchemy ?? { connected: false, lastError: null },
        });
        setCryptoError(false);
      })
      .catch(() => mounted.current && setCryptoError(true));
    rpc.finance
      .exchanges()
      .then((all) => {
        if (!mounted.current) return;
        setExchanges(Array.isArray(all) ? all : []);
        setExchangesError(false);
      })
      .catch(() => mounted.current && setExchangesError(true));
  }, [mounted]);
  useEffect(reload, [reload]);
  return {
    blockscout: crypto ? crypto.blockscout : null,
    blockscoutServer: crypto?.blockscoutServer ?? false,
    alchemy: crypto ? crypto.alchemy : null,
    exchanges,
    // The latest request failed: say so, even while the last known status stays on screen.
    cryptoError,
    exchangesError,
    reload,
  };
}

/** Keys of every finance connection placed under Connected. Mercury/Brex are `ok`; Blockscout once
 * its MCP server exists (its one tile then says whether the PRO key is still needed); exchanges need a
 * good read. Anything else (including needs-reconnect) is still "available". */
export function connectedFinanceKeys(sources: FinanceSource[], status: FinanceStatus) {
  const keys = new Set<string>();
  for (const { provider } of FINANCE_PROVIDERS)
    if (sources.find((s) => s.provider === provider)?.status === "ok") keys.add(provider);
  if (status.blockscout || status.blockscoutServer) keys.add("crypto");
  if (status.alchemy?.connected && !status.alchemy.lastError) keys.add("alchemy");
  for (const { provider } of EXCHANGES)
    if (status.exchanges?.find((x) => x.provider === provider && x.connected && !x.lastError))
      keys.add(provider);
  return keys;
}

/** Alchemy or an exchange that is connected but whose last check failed: it needs attention too. */
export function erroredFinanceKeys(status: FinanceStatus) {
  const keys = new Set<string>();
  if (status.alchemy?.connected && status.alchemy.lastError) keys.add("alchemy");
  for (const { provider } of EXCHANGES)
    if (status.exchanges?.find((x) => x.provider === provider && x.connected && x.lastError))
      keys.add(provider);
  return keys;
}

/** Mercury or Brex whose sign-in lapsed or whose sync failed: the one thing to fix, shown first. */
export function lapsedFinanceKeys(sources: FinanceSource[]) {
  const keys = new Set<string>();
  for (const { provider } of FINANCE_PROVIDERS) {
    const state = sources.find((s) => s.provider === provider)?.status;
    if (state === "needs_reconnect" || state === "error") keys.add(provider);
  }
  return keys;
}

export const FINANCE_TILE_COUNT = FINANCE_PROVIDERS.length + 2 + EXCHANGES.length;

/** Finance tiles. Mercury and Brex connect through the Finance API so the server treats them as
 * finance sources and the Finance agent gets its read-only assignment. `mode` picks the tiles:
 * "connected" renders only working connections (as bare tiles, to sit in the Connected grid),
 * "lapsed" the ones to reconnect, "available" the rest, "all" every tile. Renders nothing when no tile is left. `extras` adds a line to a
 * connected tile (the agents that use its MCP server), keyed by provider or "crypto" for Blockscout. */
export function FinanceSection({
  sources,
  status,
  onChanged,
  mode = "all",
  extras,
  cryptoManageTo,
  only,
}: {
  sources: FinanceSource[];
  status: FinanceStatus;
  onChanged: () => void;
  mode?: "all" | "connected" | "lapsed" | "available";
  extras?: Partial<Record<FinanceProvider | "crypto", ReactNode>>;
  /** Where Blockscout's agents are chosen, once its MCP server exists. */
  cryptoManageTo?: string;
  /** Renders just this tile (a provider, "crypto", "alchemy" or an exchange), so the page can order tiles itself. */
  only?: string;
}) {
  const { t } = useLingui();
  const [busy, setBusy] = useState<FinanceProvider | null>(null);
  const [errors, setErrors] = useState<Partial<Record<FinanceProvider, string>>>({});
  const description = {
    mercury: t`Read balances and transactions`,
    brex: t`Read cards, expenses and bills`,
  };

  const connectedKeys = connectedFinanceKeys(sources, status);
  // A crypto connect can create an MCP server, so refresh the page data too, not just this status.
  const reload = () => {
    status.reload();
    onChanged();
  };
  const lapsedKeys = lapsedFinanceKeys(sources);
  const shown = (key: string) =>
    (!only || key === only) &&
    (mode === "all" ||
      (mode === "lapsed"
        ? lapsedKeys.has(key)
        : (mode === "connected") === connectedKeys.has(key) &&
          (mode === "connected" || !lapsedKeys.has(key))));

  async function connect(provider: FinanceProvider, reconnect: boolean) {
    setBusy(provider);
    setErrors((prev) => ({ ...prev, [provider]: undefined }));
    try {
      const result = await connectFinanceProvider(provider, reconnect);
      if (result === "cancelled") {
        setErrors((prev) => ({
          ...prev,
          [provider]: t`Sign-in was cancelled or did not finish. Try again.`,
        }));
      }
    } catch (err) {
      setErrors((prev) => ({ ...prev, [provider]: errorText(err, t`Could not connect`) }));
    } finally {
      setBusy(null);
      onChanged();
    }
  }

  const tiles = (
    <>
      {FINANCE_PROVIDERS.filter(({ provider }) => shown(provider)).map(
        ({ provider, name, logo }) => {
          const status = sources.find((source) => source.provider === provider)?.status;
          const connected = status === "ok";
          const reconnect = status === "needs_reconnect" || status === "error";
          const error = errors[provider];
          const serverId = sources.find((source) => source.provider === provider)?.serverId;
          return (
            <IntegrationTile
              key={provider}
              data-testid={`finance-tile-${provider}`}
              className={TILE}
            >
              <div className="flex min-w-0 items-center gap-3 pe-6">
                <AppLogo name={name} logo={logo} />
                <div className="min-w-0">
                  <TileName
                    name={name}
                    to={serverId ? `/app/integrations/mcp/${serverId}` : undefined}
                  />
                  <div className="line-clamp-2 text-xs text-muted-foreground">
                    {description[provider]}
                  </div>
                </div>
              </div>
              {/* Used by first, then the action row at the bottom, level with Gmail and Carta's. */}
              {connected ? (
                <div className="max-sm:hidden empty:hidden">{extras?.[provider]}</div>
              ) : null}
              <div className="mt-auto flex items-center gap-2">
                {busy === provider ? (
                  <StatusBadge status="connecting" />
                ) : connected ? (
                  <StatusBadge status="connected" quiet />
                ) : status === "needs_reconnect" ? (
                  <StatusBadge status="reconnect" />
                ) : status === "error" ? (
                  <StatusBadge status="failed" />
                ) : null}
                {connected ? (
                  <>
                    <Link to="/app/finance" className={OPEN_LINK}>
                      <Trans>Open Finance</Trans>
                    </Link>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="relative z-10 ms-auto"
                    disabled={busy !== null}
                    aria-label={
                      status === "error"
                        ? t`Try ${name} again`
                        : reconnect
                          ? t`Reconnect ${name}`
                          : t`Connect ${name}`
                    }
                    onClick={() => void connect(provider, reconnect)}
                  >
                    {status === "error" ? (
                      <Trans>Try again</Trans>
                    ) : reconnect ? (
                      <Trans>Reconnect</Trans>
                    ) : (
                      <Trans>Connect</Trans>
                    )}
                  </Button>
                )}
              </div>
              {error ? (
                <p role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              ) : null}
            </IntegrationTile>
          );
        },
      )}
      {shown("crypto") ? (
        <CryptoTile
          hasKey={status.blockscout}
          hasServer={status.blockscoutServer}
          manageTo={cryptoManageTo}
          reload={reload}
          loadError={status.cryptoError}
        >
          {mode === "available" ? null : (
            <div className="max-sm:hidden empty:hidden">{extras?.crypto}</div>
          )}
        </CryptoTile>
      ) : null}
      {shown("alchemy") ? (
        <AlchemyTile state={status.alchemy} reload={reload} loadError={status.cryptoError} />
      ) : null}
      {EXCHANGES.filter(({ provider }) => shown(provider)).map(({ provider }) => (
        <ExchangeTile
          key={provider}
          provider={provider}
          found={
            status.exchanges
              ? (status.exchanges.find((e) => e.provider === provider) ?? null)
              : undefined
          }
          reload={reload}
          loadError={status.exchangesError}
        />
      ))}
    </>
  );
  if (mode === "connected") return tiles;
  if (
    mode === "lapsed"
      ? lapsedKeys.size === 0
      : FINANCE_TILE_COUNT === (mode === "all" ? 0 : connectedKeys.size + lapsedKeys.size)
  )
    return null;
  return (
    <div
      data-testid="finance-section"
      className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]"
    >
      {tiles}
    </div>
  );
}
