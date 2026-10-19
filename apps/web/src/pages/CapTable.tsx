import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { CapTableState, Contact, ContactKind } from "@rakazo/contracts";
import { isCartaEndpoint } from "@rakazo/contracts";
import {
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  NativeSelect,
  NativeSelectOption,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@rakazo/ui-web";
import { PieChart, Plus, RefreshCw } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AskBotButton } from "../components/AskBotButton";
import { DataRoomImportMenu } from "../components/data-room/DataRoomImportMenu";
import { FolderDocuments } from "../components/data-room/FolderDocuments";
import { HideAmountsButton } from "../components/HideAmountsToggle";
import { CustomConnectionDialog } from "../components/integrations/CustomConnectionDialog";
import { useIntegrations } from "../components/integrations/useIntegrations";
import { PageHeader } from "../components/PageHeader";
import { hasConnectedCarta } from "../lib/carta-agent";
import { percentFigure, shareCount, usdFigure } from "../lib/finance-format";
import { useHideAmounts } from "../lib/hide-amounts-preference";
import { FIRST_PARTY_MCP } from "../lib/integrations";
import { formatRelativeTime } from "../lib/relative-time";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";

type Filter = "all" | RowKind;
/** The Data room folder the cap table's documents are filed into. */
const CAP_TABLE_FOLDER = ["Finance", "Cap Table"];

type Snapshot = NonNullable<CapTableState["snapshot"]>;
type Holder = Snapshot["holders"][number];
type Prefill = {
  name: string;
  email: string | null;
  organization: string | null;
  kind?: ContactKind;
};
/** Shareholders and Options come from Carta; Investors mixes both; Auditors and Other are contacts. */
const FILTERS = [
  "all",
  "shareholder",
  "investor",
  "options",
  "auditor",
  "other",
] as const satisfies readonly Filter[];
const CARTA_FILTERS: readonly Filter[] = ["shareholder", "options"];
const isContactKind = (filter: Filter): filter is ContactKind =>
  filter === "investor" || filter === "auditor" || filter === "other";
const parseFilter = (value: string | null): Filter =>
  FILTERS.find((filter) => filter === value) ?? "all";
/** How long a "Saved" or "Deleted, Undo" notice stays on screen. */
const TOAST_MS = 8000;

/** How often the page asks again while the Carta agent is still reading. */
const POLL_MS = 3000;
/** How often an idle page checks for a run started elsewhere, such as in another tab. */
const IDLE_POLL_MS = 30_000;
const DASH = "—";

const num = (value: number | null) => shareCount(value, i18n.locale || "en");
const usd = (value: number | null, digits = 0) => usdFigure(value, digits, i18n.locale || "en");
const pct = (value: number | null) => percentFigure(value);

/** One investors-table row: a Carta holder, the contact it matches, or a contact with no holding. */
type Row = { key: string; contact: Contact | null; holder: Holder | null };
/** A contact's kind; a holder with no contact is an investor, a shareholder or an option grant. */
type RowKind = ContactKind | "shareholder" | "options";

/** What a Carta holding is, from its security alone. */
const holdingKind = (holder: Holder | null): RowKind => {
  const security = holder?.security.toLowerCase() ?? "";
  if (security.includes("option")) return "options";
  if (/safe|preferred|series|note|convertible|warrant/.test(security)) return "investor";
  return "shareholder";
};

export function rowKind({ contact, holder }: Pick<Row, "contact" | "holder">): RowKind {
  return contact ? contact.kind : holdingKind(holder);
}

/** Shareholders and Options sort Carta holdings by security, even when a contact matches the holder. */
const matchesFilter = (row: Row, filter: Filter): boolean =>
  filter === "all" ||
  (CARTA_FILTERS.includes(filter)
    ? !!row.holder && holdingKind(row.holder) === filter
    : rowKind(row) === filter);

function joinRows(snapshot: Snapshot | null, contacts: Contact[]): Row[] {
  const byEmail = new Map(contacts.filter((c) => c.email).map((c) => [c.email?.toLowerCase(), c]));
  const used = new Set<string>();
  const rows: Row[] = (snapshot?.holders ?? []).map((holder, i) => {
    const contact = (holder.email && byEmail.get(holder.email.toLowerCase())) || null;
    if (contact) used.add(contact.id);
    return { key: `h${i}`, contact, holder };
  });
  // The unallocated pool is part of the fully diluted count but no one holds it, so without this
  // row the Ownership column stops short of 100%. The percent is display-only.
  // It goes right after the granted options, not after the SAFEs.
  const pool = snapshot?.optionPoolAvailable;
  if (snapshot && pool) {
    const lastOptions = rows.findLastIndex((row) => rowKind(row) === "options");
    rows.splice(lastOptions < 0 ? rows.length : lastOptions + 1, 0, {
      key: "pool",
      contact: null,
      holder: {
        name: t`Unallocated pool`,
        email: null,
        organization: null,
        security: "Options",
        shares: pool,
        amountUsd: null,
        percent: snapshot.fullyDilutedShares ? (pool * 100) / snapshot.fullyDilutedShares : null,
      },
    });
  }
  for (const contact of contacts)
    if (!used.has(contact.id)) rows.push({ key: contact.id, contact, holder: null });
  return rows;
}

function Figure({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <Card size="sm" className="px-3.5">
      <h2 className="text-xs font-semibold text-muted-foreground">{title}</h2>
      <div className="mt-1 text-[22px] font-semibold leading-tight tabular-nums">{value}</div>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}

function Summary({ snapshot }: { snapshot: Snapshot | null }) {
  useHideAmounts();
  const a = snapshot?.latest409a;
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 @2xl:grid-cols-4">
      {snapshot ? (
        <>
          <Figure title={t`Fully diluted shares`} value={num(snapshot.fullyDilutedShares)} />
          <Figure title={t`Option pool available`} value={num(snapshot.optionPoolAvailable)} />
          <Figure
            title={t`Common share price`}
            value={a ? usd(a.pricePerShareUsd, 2) : DASH}
            hint={t`From the latest 409A valuation`}
          />
          <Figure title={t`Amount raised`} value={usd(snapshot.amountRaisedUsd)} />
        </>
      ) : (
        [0, 1, 2, 3].map((n) => <Skeleton key={n} className="h-[76px] w-full rounded-xl" />)
      )}
    </div>
  );
}

/** One ink lightness per share class (the app is monochrome), distinct in light and dark. */
// ponytail: five lightness steps, then they repeat; the legend names every class, so colour never carries meaning alone.
const SEGMENT_COLORS = [
  "bg-foreground",
  "bg-foreground/70",
  "bg-foreground/50",
  "bg-foreground/35",
  "bg-foreground/20",
];
const segmentColor = (i: number) => SEGMENT_COLORS[i % SEGMENT_COLORS.length];

export function OwnershipBar({ classes }: { classes: Snapshot["shareClasses"] }) {
  // While amounts are hidden, equal segments keep the bar from showing who owns how much.
  const hidden = useHideAmounts();
  if (classes.length === 0) return null;
  return (
    <div className="mb-5">
      {/* With amounts hidden the segments are equal, so their widths give away no split. */}
      <div
        className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-muted"
        aria-hidden="true"
        data-testid="ownership-bar"
      >
        {classes.map((c, i) => (
          <div
            key={c.name}
            className={segmentColor(i)}
            style={{ width: hidden ? `${100 / classes.length}%` : `${c.percent}%` }}
          />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {classes.map((c, i) => (
          <li key={c.name} className="flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${segmentColor(i)}`} aria-hidden="true" />
            {c.name} <span className="tabular-nums">{pct(c.percent)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const kindNames = (): Record<ContactKind, string> => ({
  investor: t`Investor`,
  auditor: t`Auditor`,
  other: t`Other`,
});
const rowKindNames = (): Record<RowKind, string> => ({
  ...kindNames(),
  shareholder: t`Shareholder`,
  options: t`Options`,
});
const addKindLabels = (): Record<ContactKind, string> => ({
  investor: t`Add investor`,
  auditor: t`Add auditor`,
  other: t`Add contact`,
});

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

/** Name, email, organization and notes of one contact; `contact` null adds a new one. */
export function ContactDialog({
  contact,
  prefill,
  contacts = [],
  onClose,
  onSaved,
  onDeleted,
  onOpenContact,
}: {
  contact: Contact | null;
  prefill?: Prefill;
  /** The user's other contacts, to offer the one that already has the email typed. */
  contacts?: readonly Contact[];
  onClose: () => void;
  onSaved: (saved: Contact) => void;
  onDeleted?: (contact: Contact) => void;
  onOpenContact?: (contact: Contact) => void;
}) {
  const [name, setName] = useState(contact?.name ?? prefill?.name ?? "");
  const [email, setEmail] = useState(contact?.email ?? prefill?.email ?? "");
  const [organization, setOrganization] = useState(
    contact?.organization ?? prefill?.organization ?? "",
  );
  const [kind, setKind] = useState<ContactKind>(contact?.kind ?? prefill?.kind ?? "investor");
  const [notes, setNotes] = useState(contact?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const names = kindNames();

  const typedEmail = email.trim().toLowerCase();
  const sameEmail = typedEmail
    ? contacts.find(
        (other) => other.id !== contact?.id && other.email?.toLowerCase() === typedEmail,
      )
    : undefined;

  async function run<T>(action: () => Promise<T>, done: (result: T) => void) {
    setBusy(true);
    setError("");
    try {
      done(await action());
      onClose();
    } catch (cause) {
      setError(errorText(cause));
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(
      () =>
        rpc.contacts.save({
          ...(contact ? { id: contact.id } : {}),
          name,
          email: email.trim() || null,
          organization: organization.trim() || null,
          kind,
          notes: notes.trim() || null,
        }),
      onSaved,
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {contact ? (
              <Trans>Edit contact</Trans>
            ) : prefill?.name && prefill.email ? (
              <Trans>Save {prefill.name} as a contact</Trans>
            ) : prefill?.name ? (
              <Trans>Add email for {prefill.name}</Trans>
            ) : prefill?.kind ? (
              addKindLabels()[prefill.kind]
            ) : (
              <Trans>Add contact</Trans>
            )}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-name">
              <Trans>Name</Trans>
            </Label>
            <Input
              id="contact-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-email">
              <Trans>Email</Trans>
            </Label>
            <Input
              id="contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-organization">
              <Trans>Organization</Trans>
            </Label>
            <Input
              id="contact-organization"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-kind">
              <Trans>Kind</Trans>
            </Label>
            <NativeSelect
              id="contact-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as ContactKind)}
            >
              {(Object.keys(names) as ContactKind[]).map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {names[value]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-notes">
              <Trans>Notes</Trans>
            </Label>
            <Textarea
              id="contact-notes"
              aria-describedby="contact-notes-hint"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <p id="contact-notes-hint" className="text-xs text-muted-foreground">
              <Trans>Contacts are your address book. They do not change Carta.</Trans>
            </p>
          </div>
          {error ? (
            <div role="alert" className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-destructive">{error}</span>
              {sameEmail && onOpenContact ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenContact(sameEmail)}
                >
                  <Trans>Open {sameEmail.name}</Trans>
                </Button>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            {contact ? (
              <Button
                type="button"
                variant="destructive"
                className="me-auto"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => rpc.contacts.delete({ id: contact.id }),
                    () => onDeleted?.(contact),
                  )
                }
              >
                <Trans>Delete</Trans>
              </Button>
            ) : null}
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              <Trans>Cancel</Trans>
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              <Trans>Save</Trans>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The Cap Table page: the Carta snapshot joined with the user's contacts. The Carta agent beside it does the Carta work. */
export function CapTablePage({
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
  // A Carta server exists but its sign-in needs attention.
  const [cartaExpired, setCartaExpired] = useState(false);
  const [cap, setCap] = useState<CapTableState | null>(null);
  const [params, setParams] = useSearchParams();
  const requestedFilter = parseFilter(params.get("kind"));
  const setFilter = (next: Filter) =>
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);
        if (next === "all") updated.delete("kind");
        else updated.set("kind", next);
        return updated;
      },
      { replace: true },
    );
  const [editing, setEditing] = useState<Contact | Prefill | "new" | null>(null);
  const [toast, setToast] = useState<{
    text: string;
    undo?: () => void;
    /** A failed restore offers Try again instead of Undo. */
    failed?: boolean;
  } | null>(null);
  // A notice with Undo stays until it is used or dismissed: there is no delete confirmation, so a
  // founder who looks away must not lose the only way to get the contact back.
  useEffect(() => {
    if (!toast || toast.undo) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);
  const names = rowKindNames();
  const [connecting, setConnecting] = useState(false);
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

  const [capFailed, setCapFailed] = useState(false);
  const latestCap = useRef(0);
  const loadCap = useCallback(() => {
    const request = ++latestCap.current;
    return rpc.carta
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
        setCartaConnected(connected);
        statusRef.current?.(connected);
        setCartaExpired(
          !connected &&
            servers.some(
              (server) =>
                server.enabled && "endpoint" in server && isCartaEndpoint(server.endpoint),
            ),
        );
        if (connected) void loadCap();
      })
      .catch(() => {
        // Never assume Carta is connected: show the error instead of the holdings or Connect Carta.
        setServersFailed(true);
        setCartaConnected(false);
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
  useEffect(() => {
    if (!cartaConnected || capFailed) return;
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
  }, [cartaConnected, syncing, capFailed, loadCap]);

  const [refreshError, setRefreshError] = useState("");
  const refresh = () => {
    setRefreshError("");
    return rpc.carta
      .refresh()
      .then(() => loadCap())
      .catch((cause) => setRefreshError(errorText(cause, t`Could not refresh from Carta`)));
  };

  const snapshot = cartaConnected ? (cap?.snapshot ?? null) : null;
  const reading = cartaConnected && syncing && !snapshot && !capFailed;
  // Connected, but nothing has been read and no read is running, e.g. no model was set up yet.
  const neverRead = cartaConnected && cap !== null && !snapshot && !syncing && !capFailed;
  // The contact just saved: its row scrolls into view and stands out, since a new one lands last.
  const container = useRef<HTMLDivElement>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  useEffect(() => {
    if (!savedId) return;
    container.current
      ?.querySelector(`[data-contact-id="${CSS.escape(savedId)}"]`)
      ?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    const timer = setTimeout(() => setSavedId(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [savedId, contacts]);
  const rows = joinRows(snapshot, contacts ?? []);
  const filters = FILTERS.filter((value) => snapshot || !CARTA_FILTERS.includes(value));
  // A link to a tab that is not there (no cap table) shows All, and the URL says so too.
  const filter = filters.includes(requestedFilter) ? requestedFilter : "all";
  const filtersSettled = cap !== null || capFailed || !cartaConnected;
  useEffect(() => {
    if (filtersSettled && filter !== requestedFilter) setFilter("all");
  });
  const shown = rows.filter((row) => matchesFilter(row, filter));
  const showHoldings = snapshot !== null || reading;
  const filterNames: Record<Filter, string> = {
    all: t`All`,
    shareholder: t`Shareholders`,
    investor: t`Investors`,
    options: t`Options`,
    auditor: t`Auditors`,
    other: t`Other`,
  };
  const emptyText: Record<Filter, string> = {
    all: t`Add your investors, auditors and counsel here. Contacts are your address book.`,
    shareholder: t`No shareholders in Carta`,
    investor: t`No investors yet`,
    options: t`No option grants in Carta`,
    auditor: t`No auditors yet`,
    other: t`No other contacts yet`,
  };
  const addKindLabel = addKindLabels();
  const addContact = () =>
    setEditing(
      isContactKind(filter) ? { name: "", email: null, organization: null, kind: filter } : "new",
    );
  const deleted = (gone: Contact) => {
    load();
    const { name, email, organization, kind, notes } = gone;
    let restoring = false;
    const restore = () => {
      if (restoring) return;
      restoring = true;
      rpc.contacts
        .save({ name, email, organization, kind, notes })
        .then(() => {
          setToast({ text: t`Restored ${name}` });
          load();
        })
        .catch((cause) => {
          const reason = errorText(cause).replace(/\.$/, "");
          setToast({
            text: t`Could not restore ${name}: ${reason}. If you dismiss this, ${name} stays deleted.`,
            undo: restore,
            failed: true,
          });
        })
        .finally(() => {
          restoring = false;
        });
    };
    setToast({ text: t`Deleted ${name}`, undo: restore });
  };

  return (
    <div
      ref={container}
      className="@container/bd rk-scroll flex-1 overflow-y-auto px-4 pb-6 pt-2 md:px-7 md:pt-5"
    >
      <PageHeader
        title={<Trans>Cap table</Trans>}
        meta={
          snapshot ? (
            <>
              {/* The update time never truncates; a long company name gives way first. */}
              <span className="truncate" title={snapshot.companyName}>
                {snapshot.companyName}
              </span>
              <span>
                ·{" "}
                {syncing ? (
                  <Trans>Reading Carta…</Trans>
                ) : (
                  <Trans>Updated {formatRelativeTime(snapshot.updatedAt)}</Trans>
                )}
              </span>
            </>
          ) : null
        }
        actions={
          <>
            {/* Only figures from Carta can be hidden. */}
            {snapshot ? <HideAmountsButton /> : null}
            {/* Without a model a refresh cannot start; the card below offers Add a model instead. */}
            {cartaConnected && !(needsModel && neverRead) ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="pointer-coarse:size-10"
                      aria-label={t`Refresh from Carta`}
                      disabled={syncing && !capFailed}
                      onClick={() => void refresh()}
                    />
                  }
                >
                  <RefreshCw aria-hidden="true" className={syncing ? "animate-spin" : undefined} />
                </TooltipTrigger>
                <TooltipContent>
                  <Trans>Refresh from Carta. The Carta agent reads your cap table again.</Trans>
                </TooltipContent>
              </Tooltip>
            ) : null}
            <DataRoomImportMenu
              folderPath={CAP_TABLE_FOLDER}
              onDone={(text) => text && setToast({ text })}
            />
            <Button variant={cartaConnected ? "default" : "outline"} onClick={addContact}>
              <Plus aria-hidden="true" />
              {isContactKind(filter) ? addKindLabel[filter] : <Trans>Add contact</Trans>}
            </Button>
            {onShowAgent ? <AskBotButton botName="Carta agent" onClick={onShowAgent} /> : null}
          </>
        }
      />

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

      {neverRead ? (
        <Card className="mb-5 flex flex-col items-start gap-3 px-4 @md:flex-row @md:items-center">
          <PieChart aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-medium">
              <Trans>Carta is connected</Trans>
            </h2>
            <p className="text-sm text-muted-foreground">
              {needsModel ? (
                <Trans>The Carta agent needs a model before it can read your cap table.</Trans>
              ) : (
                <Trans>The Carta agent has not read your cap table yet.</Trans>
              )}
            </p>
          </div>
          {/* A read cannot start without a model; Refresh in the header reads once one is added. */}
          {needsModel && onOpenModelSettings ? (
            <Button onClick={onOpenModelSettings}>
              <Trans>Add a model</Trans>
            </Button>
          ) : (
            <Button onClick={() => void refresh()}>
              <Trans>Read cap table</Trans>
            </Button>
          )}
        </Card>
      ) : null}

      {cartaConnected || serversFailed ? null : (
        <Card className="mb-5 flex flex-col items-start gap-3 px-4 @md:flex-row @md:items-center">
          <PieChart aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-medium">
              {cartaExpired ? (
                <Trans>Sign in to Carta again to see who owns your company</Trans>
              ) : (
                <Trans>See who owns your company</Trans>
              )}
            </h2>
            {cartaExpired ? (
              <p className="text-sm text-muted-foreground">
                <Trans>Your Carta sign-in ended. Sign in again to see holders here.</Trans>
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  <Trans>
                    Carta is the service many startups use to record who owns shares, options and
                    SAFEs. Connect it to see them here and to ask the Carta agent about them.
                  </Trans>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  <Trans>Not on Carta? You can still keep your investors and advisors below.</Trans>
                </p>
              </>
            )}
          </div>
          <Button onClick={() => setConnecting(true)}>
            {cartaExpired ? <Trans>Reconnect Carta</Trans> : <Trans>Connect Carta</Trans>}
          </Button>
        </Card>
      )}

      {capFailed && cartaConnected ? (
        <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="text-destructive">
            <Trans>Could not load the cap table, so holdings are missing.</Trans>
          </span>
          <Button variant="outline" size="sm" onClick={() => void loadCap()}>
            <Trans>Try again</Trans>
          </Button>
        </div>
      ) : null}

      {showHoldings ? <Summary snapshot={snapshot} /> : null}
      {snapshot ? <OwnershipBar classes={snapshot.shareClasses} /> : null}
      {reading ? (
        <p className="mb-3 text-sm text-muted-foreground">
          <Trans>Reading Carta…</Trans>
        </p>
      ) : null}

      <Tabs value={filter} onValueChange={(next) => setFilter(next as Filter)} className="mb-4">
        {/* Wraps onto a second row on a phone instead of hiding tabs past the edge. */}
        <TabsList
          className="max-w-full flex-wrap justify-start rounded-2xl group-data-horizontal/tabs:h-auto"
          aria-label={t`Kind`}
        >
          {filters.map((value) => (
            <TabsTrigger key={value} value={value} className="h-7 flex-none rounded-full px-3">
              {filterNames[value]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {refreshError ? (
        <div role="alert" className="mb-3 flex flex-wrap items-center gap-3 text-sm">
          <span className="text-destructive">{refreshError}</span>
          {/* Trying again cannot work until a model is set up. */}
          {needsModel && onOpenModelSettings ? (
            <Button variant="outline" size="sm" onClick={onOpenModelSettings}>
              <Trans>Add a model</Trans>
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => void refresh()}>
              <Trans>Try again</Trans>
            </Button>
          )}
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-destructive">{error}</span>
          <Button variant="outline" size="sm" onClick={load}>
            <Trans>Try again</Trans>
          </Button>
        </div>
      ) : contacts === null || (reading && rows.length === 0) ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {[0, 1, 2].map((n) => (
            <Skeleton key={n} className="h-9 w-full" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="max-w-sm text-sm text-muted-foreground">{emptyText[filter]}</p>
          {!isContactKind(filter) ? null : (
            <Button variant="outline" size="sm" onClick={addContact}>
              <Plus aria-hidden="true" />
              {addKindLabel[filter]}
            </Button>
          )}
        </div>
      ) : (
        // Fixed widths: the same columns, in the same places, with or without Carta and the panel.
        // Without Carta's Shares and Ownership columns, Kind takes the space Email would leave empty.
        <Table>
          <TableHeader>
            <TableHeadRow>
              <TableHead className="@md:w-[48%] @lg:w-[25%]">
                <Trans>Name</Trans>
              </TableHead>
              <TableHead className={`hidden @md:table-cell ${snapshot ? "" : "@lg:w-[45%]"}`}>
                <Trans>Email</Trans>
              </TableHead>
              <TableHead className={`hidden @lg:table-cell ${snapshot ? "w-28" : ""}`}>
                <Trans>Kind</Trans>
              </TableHead>
              {snapshot ? (
                <>
                  <TableHead className="hidden w-20 text-end @2xl:table-cell">
                    <Trans>Shares</Trans>
                  </TableHead>
                  <TableHead className="w-20 pe-0 text-end">
                    <Trans>Ownership</Trans>
                  </TableHead>
                </>
              ) : null}
            </TableHeadRow>
          </TableHeader>
          <TableBody>
            {shown.map(({ key, contact, holder }) => {
              const name = contact?.name ?? holder?.name ?? "";
              const organization = contact?.organization ?? holder?.organization ?? null;
              const kind = rowKind({ contact, holder });
              const security = holder
                ? holder.shares == null && holder.amountUsd != null
                  ? `${holder.security}, ${usd(holder.amountUsd)}`
                  : holder.security
                : null;
              // "Options" under the kind "Options" says nothing new.
              const holding = security === names[kind] ? null : security;
              const empty = <span className="text-muted-foreground">{DASH}</span>;
              const email = contact?.email ? (
                contact.email
              ) : !contact && kind === "investor" ? (
                <>
                  {/* Carta's email shows as is; saving it makes the holder a contact. */}
                  {holder?.email ? <div className="truncate">{holder.email}</div> : null}
                  <Button
                    variant="link"
                    size="xs"
                    className="h-auto px-0"
                    onClick={() =>
                      setEditing({
                        name,
                        email: holder?.email ?? null,
                        organization,
                        kind: "investor",
                      })
                    }
                  >
                    {holder?.email ? <Trans>Save as contact</Trans> : <Trans>Add email</Trans>}
                  </Button>
                </>
              ) : holder?.email ? (
                holder.email
              ) : null;
              return (
                <TableRow
                  key={key}
                  data-contact-id={contact?.id}
                  className={contact && contact.id === savedId ? "bg-muted" : ""}
                >
                  <TableCell>
                    {contact ? (
                      <button
                        type="button"
                        title={name}
                        className="block max-w-full truncate text-start font-medium hover:underline focus-visible:underline focus-visible:outline-none"
                        onClick={() => setEditing(contact)}
                      >
                        {name}
                      </button>
                    ) : (
                      <span className="block truncate font-medium" title={name}>
                        {name}
                      </span>
                    )}
                    {/* Without room for the Kind column, the kind and holding show here. */}
                    <div
                      className="truncate text-xs text-muted-foreground @lg:hidden"
                      title={holding ?? undefined}
                    >
                      {[names[kind], holding].filter(Boolean).join(" · ")}
                    </div>
                    {organization ? (
                      <div className="truncate text-xs text-muted-foreground" title={organization}>
                        {organization}
                      </div>
                    ) : null}
                    {/* A phone has no room for the Email column, so the email shows here in full width. */}
                    {email ? (
                      <div
                        data-testid="cap-table-row-email"
                        className="truncate text-xs text-muted-foreground @md:hidden"
                      >
                        {email}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell
                    data-testid="cap-table-email-cell"
                    className="hidden truncate text-muted-foreground @md:table-cell"
                    title={contact?.email ?? holder?.email ?? undefined}
                  >
                    {email ?? empty}
                  </TableCell>
                  <TableCell className="hidden @lg:table-cell">
                    <div className="truncate">{names[kind]}</div>
                    {holding ? (
                      <div className="truncate text-xs text-muted-foreground" title={holding}>
                        {holding}
                      </div>
                    ) : null}
                  </TableCell>
                  {snapshot ? (
                    <>
                      <TableCell className="hidden text-end tabular-nums @2xl:table-cell">
                        {holder?.shares != null ? num(holder.shares) : empty}
                      </TableCell>
                      <TableCell className="pe-0 text-end tabular-nums">
                        {holder?.percent != null ? pct(holder.percent) : empty}
                      </TableCell>
                    </>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <FolderDocuments folderPath={CAP_TABLE_FOLDER} />

      {/* Pinned to the bottom of the page column and after the table in the page flow: showing or
          hiding it never moves the rows, and scrolled to the end it sits below the last row. */}
      <div role="status" className="sticky bottom-0 pt-3 empty:hidden">
        {toast ? (
          <div className="flex flex-wrap items-center gap-x-2 rounded-lg border border-border bg-card py-1 ps-3 pe-1 text-sm text-card-foreground shadow-md">
            <span className="min-w-0 flex-1 py-1">{toast.text}</span>
            {toast.undo ? (
              <Button variant="ghost" size="sm" onClick={toast.undo}>
                {toast.failed ? <Trans>Try again</Trans> : <Trans>Undo</Trans>}
              </Button>
            ) : null}
            {toast.undo ? (
              <Button variant="ghost" size="sm" onClick={() => setToast(null)}>
                <Trans>Dismiss</Trans>
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {connecting ? (
        <ConnectCartaDialog
          onClose={() => {
            setConnecting(false);
            setServersSeq((n) => n + 1);
          }}
          onFailed={(message) => {
            setConnecting(false);
            setToast({ text: message });
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
            setToast({ text: t`Saved ${saved.name}` });
          }}
          onDeleted={deleted}
          onOpenContact={setEditing}
        />
      ) : null}
    </div>
  );
}
