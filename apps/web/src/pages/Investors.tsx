import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { CapTableSource, CapTableState, Contact, ContactKind } from "@rakazo/contracts";
import { isCartaEndpoint } from "@rakazo/contracts";
import { capTableMath, isSafeSecurity } from "@rakazo/core";
import {
  Button,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@rakazo/ui-web";
import { ChevronDown, MoreHorizontal, Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AskBotButton } from "../components/AskBotButton";
import type { ContactPrefill as Prefill } from "../components/ContactDialog";
import { ContactDialog, contactAddLabels } from "../components/ContactDialog";
import type { SaveResult } from "../components/cap-table/CapTableEditor";
import { CapTableEditor } from "../components/cap-table/CapTableEditor";
import type { HoldingRow } from "../components/cap-table/HoldingsTable";
import { HoldingsTable } from "../components/cap-table/HoldingsTable";
import { OwnershipBar } from "../components/cap-table/OwnershipBar";
import { FolderDocuments } from "../components/data-room/FolderDocuments";
import { CustomConnectionDialog } from "../components/integrations/CustomConnectionDialog";
import { useIntegrations } from "../components/integrations/useIntegrations";
import { SearchField } from "../components/ListControls";
import { PAGE_GUTTER_X, PageHeader } from "../components/PageHeader";
import { hasConnectedCarta } from "../lib/carta-agent";
import { shareCount, shortDay, usdFigure } from "../lib/finance-format";
import { useHideAmounts } from "../lib/hide-amounts-preference";
import { FIRST_PARTY_MCP } from "../lib/integrations";
import { rpc } from "../lib/rpc";
import { SAVED_ROW_CLASS, useContactNotices } from "../lib/use-contact-notices";
import { errorText } from "../lib/user-error";

/** The Data room folder the cap table's documents are filed into. */
const CAP_TABLE_FOLDER = ["Finance", "Cap Table"];

type Snapshot = NonNullable<CapTableState["snapshot"]>;

/** The contact tabs: the people this page's relationships involve. */
const CONTACT_TABS = ["investor", "auditor"] as const satisfies readonly ContactKind[];
type ContactTab = (typeof CONTACT_TABS)[number];
const parseTab = (value: string | null): ContactTab =>
  CONTACT_TABS.find((tab) => tab === value) ?? "investor";

/** How often the page asks again while the Carta agent is still reading. */
const POLL_MS = 3000;
/** How often an idle page checks for a change made elsewhere, such as in another tab. */
const IDLE_POLL_MS = 30_000;
const DASH = "—";

const num = (value: number | null) => shareCount(value, i18n.locale || "en");
const usd = (value: number | null, digits = 0) => usdFigure(value, digits, i18n.locale || "en");

const sourceNames = (): Record<CapTableSource, string> => ({
  carta: t`Carta`,
  sheet: t`Sheet`,
  native: t`Typed in`,
});

/** The address-book entry for a holder: the same email, else the same name. */
function contactFor(
  contacts: Contact[],
  holder: { name: string; email: string | null },
): Contact | null {
  const email = holder.email?.toLowerCase();
  const name = holder.name.trim().toLowerCase();
  return (
    (email && contacts.find((c) => c.email?.toLowerCase() === email)) ||
    contacts.find((c) => c.name.trim().toLowerCase() === name) ||
    null
  );
}

function Figure({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <Card size="sm" className="px-3.5 py-2 @md/bd:py-3">
      <h2 className="text-xs font-semibold text-muted-foreground">{title}</h2>
      <div className="mt-1 text-[22px] font-semibold leading-tight tabular-nums">{value}</div>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}

/** Fully diluted shares (with the 409A when known) and Equity raised, which never counts SAFE money. */
function Summary({ snapshot }: { snapshot: Snapshot }) {
  useHideAmounts();
  const math = capTableMath(snapshot);
  const a = snapshot.latest409a;
  // Nothing known to add up shows a dash, not $0; SAFE money is never counted.
  const raised = snapshot.holders.some((h) => h.amountUsd != null && !isSafeSecurity(h.security))
    ? usd(math.raisedUsd)
    : DASH;
  return (
    <div className="grid grid-cols-2 gap-2 @md/bd:gap-3">
      <Figure
        title={t`Fully diluted`}
        value={num(snapshot.fullyDilutedShares)}
        hint={
          a
            ? t`409A ${usd(a.pricePerShareUsd, 2)} · ${shortDay(a.date, new Date(), i18n.locale || "en")}`
            : undefined
        }
      />
      <Figure title={t`Equity raised`} value={raised} />
    </div>
  );
}

/** The Carta sign-in, opened from Cap Table so the founder stays on this page. */
function ConnectCartaDialog({
  onClose,
  onFailed,
}: {
  onClose: () => void;
  onFailed: (message: string) => void;
}) {
  const data = useIntegrations();
  const carta = FIRST_PARTY_MCP.find((entry) => entry.id === "carta");
  const failedRef = useRef(onFailed);
  failedRef.current = onFailed;
  useEffect(() => {
    if (data.loaded && data.error) failedRef.current(data.error);
  }, [data.loaded, data.error]);
  // Wait for the server list, so a Carta server that needs a new sign-in is reused, not duplicated.
  if (!carta || !data.loaded || data.error) return null;
  return (
    <CustomConnectionDialog
      data={data}
      initialUrl={carta.endpoint}
      service={carta.name}
      onClose={onClose}
    />
  );
}

/** One contact in the Contacts section: name, organization and email, with Edit and Delete. */
function ContactRow({
  contact,
  saved,
  onEdit,
  onDelete,
}: {
  contact: Contact;
  saved: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li
      data-contact-id={contact.id}
      className={`flex min-h-11 items-center gap-2 border-t border-border px-2 first:border-t-0 ${saved ? SAVED_ROW_CLASS : ""}`}
    >
      <button
        type="button"
        data-row-open
        className="min-w-0 flex-1 rounded-sm py-1.5 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onEdit}
      >
        <span className="block truncate text-sm font-medium" title={contact.name}>
          {contact.name}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {[contact.organization, contact.email].filter(Boolean).join(" · ")}
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label={t`Actions for ${contact.name}`} />
          }
        >
          <MoreHorizontal aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>
            <Trans>Edit</Trans>
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trans>Delete</Trans>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

/** The Investors page: the cap table from its one source, the investor and auditor contacts, and the cap table documents. */
export function InvestorsPage({
  onShowAgent,
  onCartaStatus,
  onOpenModelSettings,
  needsModel = false,
  agentBusy = false,
}: {
  onShowAgent?: () => void;
  /** Opens Settings, Models: the Carta agent cannot read Carta until a model is set up. */
  onOpenModelSettings?: () => void;
  /** No model is set up, so the Carta agent cannot read Carta; the page offers Add a model instead. */
  needsModel?: boolean;
  /** Told whether Carta is signed in, each time the page checks. */
  onCartaStatus?: (connected: boolean) => void;
  /** Whether the Carta agent is answering in the panel; its contacts and cap table changes load when it ends. */
  agentBusy?: boolean;
}) {
  useHideAmounts();
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [error, setError] = useState("");
  const [cartaConnected, setCartaConnected] = useState(true);
  // The connection check failed, so whether Carta is connected is unknown.
  const [serversFailed, setServersFailed] = useState(false);
  // Until the first check ends, whether Carta is connected is unknown: show a skeleton, not a layout.
  const [serversChecked, setServersChecked] = useState(false);
  // A Carta server exists but its sign-in needs attention.
  const [cartaExpired, setCartaExpired] = useState(false);
  const [cap, setCap] = useState<CapTableState | null>(null);
  const [params, setParams] = useSearchParams();
  const tab = parseTab(params.get("kind"));
  const setParam = (key: string, value: string | undefined) =>
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);
        if (value) updated.set(key, value);
        else updated.delete(key);
        return updated;
      },
      { replace: true },
    );
  const query = params.get("q") ?? "";
  const [editing, setEditing] = useState<Contact | Prefill | "new" | null>(null);
  const [connecting, setConnecting] = useState(false);
  // Carta was chosen from Change source before it was signed in: switch once the sign-in ends.
  const switchAfterConnect = useRef(false);
  const statusRef = useRef(onCartaStatus);
  statusRef.current = onCartaStatus;

  const latestLoad = useRef(0);
  const load = useCallback(() => {
    const request = ++latestLoad.current;
    setError("");
    rpc.contacts
      .list({})
      .then((list) => request === latestLoad.current && setContacts(list))
      .catch(
        (cause) =>
          request === latestLoad.current && setError(errorText(cause, t`Could not load contacts`)),
      );
  }, []);
  useEffect(load, [load]);
  const container = useRef<HTMLDivElement>(null);
  const { notify, savedId, setSavedId, deleted } = useContactNotices(load, container, contacts);

  const [capFailed, setCapFailed] = useState(false);
  const latestCap = useRef(0);
  const loadCap = useCallback(() => {
    const request = ++latestCap.current;
    return rpc.investors
      .capTable()
      .then((state) => {
        if (request !== latestCap.current) return;
        setCap(state);
        setCapFailed(false);
      })
      .catch(() => {
        if (request === latestCap.current) setCapFailed(true);
      });
  }, []);
  const [serversSeq, setServersSeq] = useState(0);
  useEffect(() => {
    void serversSeq;
    rpc.mcp.servers
      .list()
      .then((servers) => {
        const connected = hasConnectedCarta(servers);
        setServersFailed(false);
        setServersChecked(true);
        setCartaConnected(connected);
        statusRef.current?.(connected);
        setCartaExpired(
          !connected &&
            servers.some(
              (server) =>
                server.enabled && "endpoint" in server && isCartaEndpoint(server.endpoint),
            ),
        );
        void loadCap();
      })
      .catch(() => {
        // Never assume Carta is connected: show the error instead of the table or Connect Carta.
        setServersFailed(true);
        setServersChecked(true);
        setCartaConnected(false);
        void loadCap();
      });
  }, [loadCap, serversSeq]);

  const syncing = cap?.syncing ?? false;
  // Contacts are filled in by the same run, so reload them when it ends.
  const wasSyncing = useRef(false);
  useEffect(() => {
    if (wasSyncing.current && !syncing) load();
    wasSyncing.current = syncing;
  }, [syncing, load]);
  // A chat turn can add or change contacts (contacts_add, contacts_save) and the cap table, so
  // reload both when the agent finishes answering.
  const wasBusy = useRef(agentBusy);
  useEffect(() => {
    if (wasBusy.current && !agentBusy) {
      load();
      void loadCap();
    }
    wasBusy.current = agentBusy;
  }, [agentBusy, load, loadCap]);
  const typedIn = cap?.snapshot?.source === "native";
  const watching = serversChecked && (cartaConnected || typedIn) && !capFailed;
  useEffect(() => {
    if (!watching) return;
    const timer = setInterval(
      () => {
        if (syncing || document.visibilityState === "visible") void loadCap();
      },
      syncing ? POLL_MS : IDLE_POLL_MS,
    );
    const onFocus = () => void loadCap();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      latestCap.current++;
    };
  }, [watching, syncing, loadCap]);

  const [actionError, setActionError] = useState("");
  const refresh = () => {
    setActionError("");
    return rpc.investors
      .refresh()
      .then(() => loadCap())
      .catch((cause) => setActionError(errorText(cause, t`Could not refresh from Carta`)));
  };
  /** Runs a source change and shows the table it returns. */
  const changeTable = (call: () => Promise<CapTableState>, failure: string) => {
    setActionError("");
    latestCap.current++;
    return call()
      .then((state) => {
        setCap(state);
        return true;
      })
      .catch((cause) => {
        setActionError(errorText(cause, failure));
        return false;
      });
  };
  const typeItIn = () =>
    changeTable(
      () => rpc.investors.changeSource({ source: "native", sourceRef: null }),
      t`Could not change the source`,
    );
  const switchToCarta = async () => {
    const changed = await changeTable(
      () => rpc.investors.changeSource({ source: "carta", sourceRef: null }),
      t`Could not change the source`,
    );
    if (changed) await refresh();
  };
  const chooseCarta = () => {
    if (cartaConnected) return void switchToCarta();
    switchAfterConnect.current = true;
    setConnecting(true);
  };
  const undo = () => changeTable(() => rpc.investors.undoSource(), t`Could not undo`);
  const saveTable = async (
    table: Parameters<typeof rpc.investors.capTableSave>[0]["table"],
    loadedAt: string,
  ): Promise<SaveResult> => {
    // A slower read that started before this save must not put the older table back.
    latestCap.current++;
    try {
      const state = await rpc.investors.capTableSave({ table, updatedAt: loadedAt });
      setCap(state);
      return { updatedAt: state.snapshot?.updatedAt ?? loadedAt };
    } catch (cause) {
      if ((cause as { code?: string } | null)?.code !== "CONFLICT") throw cause;
      const state = await rpc.investors.capTable();
      setCap(state);
      if (!state.snapshot) throw cause;
      return { conflict: state.snapshot };
    }
  };

  const raw = cap?.snapshot ?? null;
  // A Carta table is hidden while Carta is not signed in; a typed-in or sheet table never depends on it.
  const snapshot = raw && (raw.source !== "carta" || cartaConnected) ? raw : null;
  const reading = cartaConnected && syncing && !snapshot && !capFailed;
  // Connected, but nothing has been read and no read is running, e.g. no model was set up yet.
  const neverRead = cartaConnected && cap !== null && !snapshot && !syncing && !capFailed;
  const math = snapshot ? capTableMath(snapshot) : null;
  const allContacts = contacts ?? [];
  const holdingRows: HoldingRow[] =
    snapshot && math
      ? [
          ...snapshot.holders.map((holder, i) => ({
            key: `h${i}`,
            name: holder.name,
            security: holder.security,
            shares: holder.shares,
            amountUsd: holder.amountUsd,
            percent: math.holders[i]?.percent ?? null,
            contact: contactFor(allContacts, holder),
          })),
          ...(math.pool
            ? [
                {
                  key: "pool",
                  name: t`Unallocated pool`,
                  security: t`Pool`,
                  shares: math.pool.shares,
                  amountUsd: null,
                  percent: math.pool.percent,
                  pool: true,
                  contact: null,
                },
              ]
            : []),
        ]
      : [];

  const needle = query.trim().toLowerCase();
  const shown = allContacts
    .filter(
      (c) =>
        c.kind === tab &&
        (!needle ||
          [c.name, c.organization, c.email].some((text) => text?.toLowerCase().includes(needle))),
    )
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const tabNames: Record<ContactTab, string> = { investor: t`Investors`, auditor: t`Auditors` };
  const emptyText: Record<ContactTab, string> = {
    investor: t`No investors yet`,
    auditor: t`No auditors yet`,
  };
  const addKindLabel = contactAddLabels();
  const addContact = () => setEditing({ name: "", email: null, organization: null, kind: tab });
  const openContact = (id: string) => {
    const found = allContacts.find((c) => c.id === id);
    if (found) setEditing(found);
  };
  const addHolderAsContact = (name: string, email: string | null = null) =>
    setEditing({ name, email, organization: null, kind: "investor" });
  const deleteContact = (contact: Contact) =>
    rpc.contacts
      .delete({ id: contact.id })
      .then(() => deleted(contact))
      .catch((cause) => notify(errorText(cause, t`Could not delete ${contact.name}`)));

  const source = snapshot?.source;
  const names = sourceNames();
  const sourceLabel =
    snapshot && source
      ? source === "carta" && syncing
        ? t`Reading Carta…`
        : t`${names[source]} · as of ${shortDay(snapshot.asOf, new Date(), i18n.locale || "en")}`
      : null;
  const canRefresh = source === "carta" && cartaConnected && !(needsModel && neverRead);
  const otherSources = (["carta", "native"] as const).filter((name) => name !== source);

  return (
    <div className="@container/bd flex min-h-0 min-w-0 flex-1 flex-col">
      <div className={`${PAGE_GUTTER_X} pt-2 md:pt-5`}>
        <PageHeader
          title={<Trans>Investors</Trans>}
          meta={
            snapshot && sourceLabel ? (
              <>
                {/* The source line never truncates; a long company name gives way first. */}
                <span className="truncate" title={snapshot.companyName}>
                  {snapshot.companyName}
                </span>
                <span className="whitespace-nowrap">·</span>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-mx-1 h-8 whitespace-nowrap px-1 text-xs font-normal text-muted-foreground pointer-coarse:h-11"
                      />
                    }
                  >
                    {sourceLabel}
                    <ChevronDown aria-hidden="true" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {canRefresh ? (
                      <DropdownMenuItem disabled={syncing} onClick={() => void refresh()}>
                        <RefreshCw aria-hidden="true" />
                        <Trans>Refresh</Trans>
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Trans>Change source</Trans>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {otherSources.map((name) =>
                          name === "carta" ? (
                            <DropdownMenuItem key={name} onClick={chooseCarta}>
                              <Trans>Carta</Trans>
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem key={name} onClick={() => void typeItIn()}>
                              <Trans>Type it in</Trans>
                            </DropdownMenuItem>
                          ),
                        )}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    {snapshot.canUndo ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => void undo()}>
                          <Trans>Undo</Trans>
                        </DropdownMenuItem>
                      </>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : null
          }
          actions={
            <>
              <Button variant="outline" size="sm" onClick={addContact}>
                <Plus aria-hidden="true" />
                <Trans>Add contact</Trans>
              </Button>
              {onShowAgent ? (
                <AskBotButton botName="Investors agent" onClick={onShowAgent} />
              ) : null}
            </>
          }
        />
      </div>

      <div ref={container} className={`rk-scroll flex-1 overflow-y-auto ${PAGE_GUTTER_X} pb-6`}>
        {serversFailed ? (
          <div role="alert" className="mb-5 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-destructive">
              <Trans>Could not check whether Carta is connected.</Trans>
            </span>
            <Button variant="outline" size="sm" onClick={() => setServersSeq((n) => n + 1)}>
              <Trans>Try again</Trans>
            </Button>
          </div>
        ) : null}

        {capFailed ? (
          <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-destructive">
              <Trans>Could not load the cap table, so holdings are missing.</Trans>
            </span>
            <Button variant="outline" size="sm" onClick={() => void loadCap()}>
              <Trans>Try again</Trans>
            </Button>
          </div>
        ) : null}

        {actionError ? (
          <div role="alert" className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-destructive">{actionError}</span>
            {/* Trying again cannot work until a model is set up. */}
            {needsModel && onOpenModelSettings ? (
              <Button variant="outline" size="sm" onClick={onOpenModelSettings}>
                <Trans>Add a model</Trans>
              </Button>
            ) : null}
          </div>
        ) : null}

        {!serversChecked || (cap === null && !capFailed) ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            {[0, 1, 2].map((n) => (
              <Skeleton key={n} className="h-9 w-full" />
            ))}
          </div>
        ) : (
          <>
            {snapshot && math ? (
              <div className="mb-5 flex flex-col gap-3">
                <div className="max-w-3xl">
                  <Summary snapshot={snapshot} />
                </div>
                <Card className="max-w-5xl gap-3 px-3.5 py-3">
                  <h2 className="text-sm font-semibold">
                    <Trans>Cap table</Trans>
                  </h2>
                  {snapshot.source === "native" ? (
                    <CapTableEditor
                      snapshot={snapshot}
                      onSave={saveTable}
                      contactIdFor={(name) =>
                        contactFor(allContacts, { name, email: null })?.id ?? null
                      }
                      onAddContact={(name) => addHolderAsContact(name)}
                      onOpenContact={openContact}
                    />
                  ) : (
                    <div className="@container">
                      <OwnershipBar
                        className="mb-3"
                        classes={math.classes}
                        pool={math.pool?.percent ?? null}
                      />
                      <HoldingsTable
                        rows={holdingRows}
                        onAddContact={(row) =>
                          addHolderAsContact(
                            row.name,
                            snapshot.holders.find((holder) => holder.name === row.name)?.email ??
                              null,
                          )
                        }
                        onOpenContact={openContact}
                      />
                    </div>
                  )}
                </Card>
              </div>
            ) : reading ? (
              <p className="mb-5 text-sm text-muted-foreground">
                <Trans>Reading Carta…</Trans>
              </p>
            ) : (
              // No table yet: pick where it comes from. Neither choice is filled; the page cannot know which fits.
              <div className="mb-5 flex flex-wrap items-center gap-2">
                {neverRead ? (
                  // Connected but unread: reading starts with a model; Type it in stays available.
                  needsModel && onOpenModelSettings ? (
                    <Button variant="outline" onClick={onOpenModelSettings}>
                      <Trans>Add a model</Trans>
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => void refresh()}>
                      <Trans>Read cap table</Trans>
                    </Button>
                  )
                ) : serversFailed ? null : (
                  <Button variant="outline" onClick={() => setConnecting(true)}>
                    {cartaExpired ? <Trans>Reconnect Carta</Trans> : <Trans>Connect Carta</Trans>}
                  </Button>
                )}
                <Button variant="outline" onClick={() => void typeItIn()}>
                  <Trans>Type it in</Trans>
                </Button>
              </div>
            )}

            <section className="mb-5 max-w-5xl" aria-label={t`Contacts`}>
              <Tabs
                value={tab}
                onValueChange={(next) =>
                  setParam("kind", next === "investor" ? undefined : String(next))
                }
                className="mb-3"
              >
                <TabsList className="rounded-2xl" aria-label={t`Kind`}>
                  {CONTACT_TABS.map((value) => (
                    <TabsTrigger
                      key={value}
                      value={value}
                      className="h-7 flex-none rounded-full px-3"
                    >
                      {tabNames[value]}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              {allContacts.length > 0 && !error ? (
                <SearchField
                  className="mb-2 w-full @md/bd:w-72"
                  value={query}
                  onChange={(next) => setParam("q", next || undefined)}
                  placeholder={t`Search`}
                  label={t`Search`}
                  name="contact-search"
                />
              ) : null}
              {error ? (
                <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-destructive">{error}</span>
                  <Button variant="outline" size="sm" onClick={load}>
                    <Trans>Try again</Trans>
                  </Button>
                </div>
              ) : contacts === null ? (
                <div className="flex flex-col gap-2" aria-busy="true">
                  {[0, 1].map((n) => (
                    <Skeleton key={n} className="h-9 w-full" />
                  ))}
                </div>
              ) : shown.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    {needle ? t`No matches` : emptyText[tab]}
                  </p>
                  {needle ? (
                    <Button variant="outline" size="sm" onClick={() => setParam("q", undefined)}>
                      <Trans>Clear filters</Trans>
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={addContact}>
                      <Plus aria-hidden="true" />
                      {addKindLabel[tab]}
                    </Button>
                  )}
                </div>
              ) : (
                <ul>
                  {shown.map((contact) => (
                    <ContactRow
                      key={contact.id}
                      contact={contact}
                      saved={contact.id === savedId}
                      onEdit={() => setEditing(contact)}
                      onDelete={() => void deleteContact(contact)}
                    />
                  ))}
                </ul>
              )}
            </section>

            <FolderDocuments folderPath={CAP_TABLE_FOLDER} />
          </>
        )}

        {connecting ? (
          <ConnectCartaDialog
            onClose={() => {
              setConnecting(false);
              setServersSeq((n) => n + 1);
              if (!switchAfterConnect.current) return;
              switchAfterConnect.current = false;
              void rpc.mcp.servers.list().then((servers) => {
                if (hasConnectedCarta(servers)) void switchToCarta();
              });
            }}
            onFailed={(message) => {
              setConnecting(false);
              switchAfterConnect.current = false;
              notify(message);
            }}
          />
        ) : null}
        {editing ? (
          <ContactDialog
            key={editing === "new" ? "new" : "id" in editing ? editing.id : "prefill"}
            contact={editing === "new" || !("id" in editing) ? null : editing}
            prefill={editing !== "new" && !("id" in editing) ? editing : undefined}
            contacts={contacts ?? []}
            onClose={() => setEditing(null)}
            onSaved={(saved) => {
              load();
              setSavedId(saved.id);
              notify(t`Saved ${saved.name}`);
            }}
            onDeleted={deleted}
            onOpenContact={setEditing}
            fromCapTable={
              source === "carta" &&
              editing !== "new" &&
              "id" in editing &&
              holdingRows.some((row) => row.contact?.id === editing.id)
            }
          />
        ) : null}
      </div>
    </div>
  );
}
