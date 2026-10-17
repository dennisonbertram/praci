import { Trans, useLingui } from "@lingui/react/macro";
import type {
  ExchangeProvider,
  FinanceExchange,
  FinanceProvider,
  FinanceSource,
} from "@rakazo/contracts";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@rakazo/ui-web";
import { MoreHorizontal } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { connectFinanceProvider } from "../../lib/finance-connect";
import { financePath } from "../../lib/finance-route";
import { EXCHANGES, FINANCE_PROVIDERS } from "../../lib/integrations";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { AlchemyConnectDialog } from "./AlchemyConnectDialog";
import { AppLogo } from "./AppLogo";
import { BlockscoutConnectDialog } from "./BlockscoutConnectDialog";
import { ExchangeConnectDialog } from "./ExchangeConnectDialog";
import { IntegrationTile, StatusBadge } from "./parts";

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

/**
 * Balances come from public RPC, so Blockscout works without a key (the first wallet creates its
 * keyless server); a server without a key offers to add one instead of claiming it is not connected.
 */
function CryptoTile({
  hasKey,
  hasServer,
  manageTo,
  reload,
  children,
}: {
  hasKey: boolean | null;
  hasServer?: boolean;
  /** The Blockscout MCP server's page, where its agents are chosen. */
  manageTo?: string;
  reload: () => void;
  children?: ReactNode;
}) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState(false);

  return (
    <IntegrationTile data-testid="finance-tile-crypto">
      <div className="flex min-w-0 items-center gap-3">
        <AppLogo name="Blockscout" logo="/logos/blockscout.svg" />
        <div className="min-w-0">
          <div className="truncate font-semibold">Blockscout</div>
          <div className="truncate text-xs text-muted-foreground">
            {hasKey ? (
              <Trans>Wallet balances and history</Trans>
            ) : (
              // Without a key it is complete: balances come from public networks.
              <Trans>Wallet balances and history · no key needed</Trans>
            )}
          </div>
        </div>
      </div>
      <div className="mt-auto flex items-center gap-2">
        {hasKey === null ? null : (
          <>
            {hasKey || hasServer ? (
              <StatusBadge status="connected" />
            ) : (
              // Nothing to connect: the first wallet added starts it. Not "Not connected".
              <span className="text-xs text-muted-foreground">
                <Trans>Ready, no key needed</Trans>
              </span>
            )}
            {/* One main action like the other tiles; the optional key and agents sit in the menu. */}
            <Link
              to={financePath.crypto()}
              className="ms-auto inline-flex h-7 items-center rounded-lg border border-border px-2.5 text-[0.8rem] font-medium hover:bg-muted"
            >
              {hasKey || hasServer ? <Trans>Open Finance</Trans> : <Trans>Add wallet</Trans>}
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon-xs" aria-label={t`More Blockscout actions`} />
                }
              >
                <MoreHorizontal aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {/* The key is optional: without one, balances still come from public RPC. */}
                <DropdownMenuItem onClick={() => setDialog(true)}>
                  {hasKey ? <Trans>Replace API key</Trans> : <Trans>Add API key</Trans>}
                </DropdownMenuItem>
                {manageTo ? (
                  <DropdownMenuItem onClick={() => navigate(manageTo)}>
                    <Trans>Manage agents</Trans>
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
      {dialog ? (
        <BlockscoutConnectDialog onConnected={reload} onClose={() => setDialog(false)} />
      ) : null}
      {children}
    </IntegrationTile>
  );
}

/** Optional: with an Alchemy key, holdings come from Alchemy instead of the public RPC source. */
function AlchemyTile({ state, reload }: { state: AlchemyState | null; reload: () => void }) {
  const { t } = useLingui();
  const [dialog, setDialog] = useState(false);

  return (
    <IntegrationTile data-testid="finance-tile-alchemy">
      <div className="flex min-w-0 items-center gap-3">
        <AppLogo name="Alchemy" logo="/logos/alchemy.svg" />
        <div className="min-w-0">
          <div className="truncate font-semibold">Alchemy</div>
          <div className="truncate text-xs text-muted-foreground">
            <Trans>Optional faster balance reads</Trans>
          </div>
        </div>
      </div>
      <div className="mt-auto flex items-center gap-2">
        {state?.connected ? (
          <>
            <StatusBadge status="connected" />
            <Button size="sm" variant="ghost" className="ms-auto" onClick={() => setDialog(true)}>
              <Trans>Replace API key</Trans>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                void rpc.finance.cryptoProviderRemove({ provider: "alchemy" }).then(reload, reload)
              }
            >
              <Trans>Remove</Trans>
            </Button>
            <Link
              to={financePath.crypto()}
              className="inline-flex h-7 items-center rounded-lg border border-border px-2.5 text-[0.8rem] font-medium hover:bg-muted"
            >
              <Trans>Open</Trans>
            </Link>
          </>
        ) : (
          <>
            <span className="text-xs text-muted-foreground">
              <Trans>Not connected</Trans>
            </span>
            <Button
              size="sm"
              variant="outline"
              className="ms-auto"
              disabled={state === null}
              aria-label={t`Connect Alchemy`}
              onClick={() => setDialog(true)}
            >
              <Trans>Connect</Trans>
            </Button>
          </>
        )}
      </div>
      {state?.lastError ? (
        <p role="alert" className="text-xs text-destructive">
          {state.lastError}
        </p>
      ) : null}
      {dialog ? (
        <AlchemyConnectDialog onConnected={reload} onClose={() => setDialog(false)} />
      ) : null}
    </IntegrationTile>
  );
}

/** Connected only after the first successful balance read, so a key the exchange refused never shows as connected. */
function ExchangeTile({
  provider,
  found,
  reload,
}: {
  provider: ExchangeProvider;
  found: FinanceExchange | null | undefined;
  reload: () => void;
}) {
  const { t } = useLingui();
  const exchange = EXCHANGES.find((e) => e.provider === provider) ?? EXCHANGES[0];
  const [dialog, setDialog] = useState(false);

  const connected = found?.connected === true;
  return (
    <IntegrationTile data-testid={`finance-tile-${provider}`}>
      <div className="flex min-w-0 items-center gap-3">
        <AppLogo name={exchange.name} logo={exchange.logo} />
        <div className="min-w-0">
          <div className="truncate font-semibold">{exchange.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            <Trans>Read exchange balances</Trans>
          </div>
        </div>
      </div>
      <div className="mt-auto flex items-center gap-2">
        {connected ? (
          <>
            <StatusBadge status="connected" />
            <Button size="sm" variant="ghost" className="ms-auto" onClick={() => setDialog(true)}>
              <Trans>Replace key</Trans>
            </Button>
            <Link
              to={financePath.crypto()}
              className="inline-flex h-7 items-center rounded-lg border border-border px-2.5 text-[0.8rem] font-medium hover:bg-muted"
            >
              <Trans>Open</Trans>
            </Link>
          </>
        ) : (
          <>
            <span className="text-xs text-muted-foreground">
              <Trans>Not connected</Trans>
            </span>
            <Button
              size="sm"
              variant="outline"
              className="ms-auto"
              disabled={found === undefined}
              aria-label={t`Connect ${exchange.name}`}
              onClick={() => setDialog(true)}
            >
              <Trans>Connect</Trans>
            </Button>
          </>
        )}
      </div>
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
  const mounted = useMounted();
  const reload = useCallback(() => {
    rpc.finance
      .crypto()
      .then(
        (c) =>
          mounted.current &&
          setCrypto({
            blockscout: c.connected && c.hasApiKey,
            blockscoutServer: c.connected,
            alchemy: c.alchemy ?? { connected: false, lastError: null },
          }),
      )
      .catch(
        () =>
          mounted.current &&
          setCrypto({
            blockscout: false,
            blockscoutServer: false,
            alchemy: { connected: false, lastError: null },
          }),
      );
    rpc.finance
      .exchanges()
      .then((all) => mounted.current && setExchanges(Array.isArray(all) ? all : []))
      .catch(() => mounted.current && setExchanges([]));
  }, [mounted]);
  useEffect(reload, [reload]);
  return {
    blockscout: crypto ? crypto.blockscout : null,
    blockscoutServer: crypto?.blockscoutServer ?? false,
    alchemy: crypto ? crypto.alchemy : null,
    exchanges,
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

export const FINANCE_TILE_COUNT = FINANCE_PROVIDERS.length + 2 + EXCHANGES.length;

/** Finance tiles. Mercury and Brex connect through the Finance API so the server treats them as
 * finance sources and the Finance agent gets its read-only assignment. `mode` picks the tiles:
 * "connected" renders only working connections (as bare tiles, to sit in the Connected grid),
 * "available" the rest, "all" both. Renders nothing when no tile is left. `extras` adds a line to a
 * connected tile (the agents that use its MCP server), keyed by provider or "crypto" for Blockscout. */
export function FinanceSection({
  sources,
  status,
  onChanged,
  mode = "all",
  extras,
  cryptoManageTo,
}: {
  sources: FinanceSource[];
  status: FinanceStatus;
  onChanged: () => void;
  mode?: "all" | "connected" | "available";
  extras?: Partial<Record<FinanceProvider | "crypto", ReactNode>>;
  /** Where Blockscout's agents are chosen, once its MCP server exists. */
  cryptoManageTo?: string;
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
  const shown = (key: string) =>
    mode === "all" || (mode === "connected") === connectedKeys.has(key);

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
          return (
            <IntegrationTile key={provider} data-testid={`finance-tile-${provider}`}>
              <div className="flex min-w-0 items-center gap-3">
                <AppLogo name={name} logo={logo} />
                <div className="min-w-0">
                  <div className="truncate font-semibold">{name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {description[provider]}
                  </div>
                </div>
              </div>
              {/* Connected: the status row sits under the name, level with Gmail and Carta's. */}
              <div className={`${connected ? "" : "mt-auto "}flex items-center gap-2`}>
                {busy === provider ? (
                  <StatusBadge status="connecting" />
                ) : connected ? (
                  <StatusBadge status="connected" />
                ) : status === "needs_reconnect" ? (
                  <StatusBadge status="reconnect" />
                ) : status === "error" ? (
                  <StatusBadge status="failed" />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    <Trans>Not connected</Trans>
                  </span>
                )}
                {connected ? (
                  <Link
                    to="/app/finance"
                    className="ms-auto inline-flex h-7 items-center rounded-lg border border-border px-2.5 text-[0.8rem] font-medium hover:bg-muted"
                  >
                    <Trans>Open Finance</Trans>
                  </Link>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="ms-auto"
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
              {connected ? extras?.[provider] : null}
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
        >
          {mode === "available" ? null : extras?.crypto}
        </CryptoTile>
      ) : null}
      {shown("alchemy") ? <AlchemyTile state={status.alchemy} reload={reload} /> : null}
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
        />
      ))}
    </>
  );
  if (mode === "connected") return tiles;
  if (FINANCE_TILE_COUNT === (mode === "all" ? 0 : connectedKeys.size)) return null;
  return (
    <div
      data-testid="finance-section"
      className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]"
    >
      {tiles}
    </div>
  );
}
