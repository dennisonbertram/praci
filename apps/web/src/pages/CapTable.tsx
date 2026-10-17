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
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@rakazo/ui-web";
import { PieChart, Plus, RefreshCw } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AskBotButton } from "../components/AskBotButton";
import { HideAmountsButton } from "../components/HideAmountsToggle";
import { CustomConnectionDialog } from "../components/integrations/CustomConnectionDialog";
import { useIntegrations } from "../components/integrations/useIntegrations";
import { hasConnectedCarta } from "../lib/carta-agent";
import { percentFigure, shareCount, usdFigure } from "../lib/finance-format";
import { useHideAmounts } from "../lib/hide-amounts-preference";
import { FIRST_PARTY_MCP } from "../lib/integrations";
import { formatRelativeTime } from "../lib/relative-time";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";

type Filter = "all" | ContactKind;
type Snapshot = NonNullable<CapTableState["snapshot"]>;
type Holder = Snapshot["holders"][number];
type Prefill = {
  name: string;
  email: string | null;
  organization: string | null;
  kind?: ContactKind;
};
const FILTERS = ["all", "investor", "auditor", "other"] as const satisfies readonly Filter[];
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

export function rowKind({ contact, holder }: Pick<Row, "contact" | "holder">): RowKind {
  if (contact) return contact.kind;
  const security = holder?.security.toLowerCase() ?? "";
  if (security.includes("option")) return "options";
  if (/safe|preferred|series|note|convertible|warrant/.test(security)) return "investor";
  return "shareholder";
}

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

function OwnershipBar({ classes }: { classes: Snapshot["shareClasses"] }) {
  useHideAmounts();
  if (classes.length === 0) return null;
  return (
    <div className="mb-5">
      <div className="flex h-3 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        {classes.map((c, i) => (
          <div
            key={c.name}
            className="bg-foreground"
            style={{ width: `${c.percent}%`, opacity: Math.max(0.15, 1 - i * 0.22) }}
          />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {classes.map((c, i) => (
          <li key={c.name} className="flex items-center gap-1.5">
            <span
              className="size-2 rounded-full bg-foreground"
              style={{ opacity: Math.max(0.15, 1 - i * 0.22) }}
              aria-hidden="true"
            />
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
  onSaved: () => void;
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

  async function run(action: () => Promise<unknown>, done: () => void) {
    setBusy(true);
    setError("");
    try {
      await action();
      done();
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
            <div
              role="alert"
              className="flex flex-wrap items-center gap-2 text-sm text-destructive"
            >
              <span>{error}</span>
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
}: {
  onShowAgent?: () => void;
  /** Told whether Carta is signed in, each time the page checks. */
  onCartaStatus?: (connected: boolean) => void;
}) {
  useHideAmounts();
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [error, setError] = useState("");
  const [cartaConnected, setCartaConnected] = useState(true);
  // A Carta server exists but its sign-in needs attention.
  const [cartaExpired, setCartaExpired] = useState(false);
  const [cap, setCap] = useState<CapTableState | null>(null);
  const [params, setParams] = useSearchParams();
  const filter = parseFilter(params.get("kind"));
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
    /** A failed restore stays until it works or is dismissed, so the contact is not lost. */
    sticky?: boolean;
  } | null>(null);
  useEffect(() => {
    if (!toast || toast.sticky) return;
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
      .catch(() => undefined);
  }, [loadCap, serversSeq]);

  const syncing = cap?.syncing ?? false;
  // Contacts are filled in by the same run, so reload them when it ends.
  const wasSyncing = useRef(false);
  useEffect(() => {
    if (wasSyncing.current && !syncing) load();
    wasSyncing.current = syncing;
  }, [syncing, load]);
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
      .then(loadCap)
      .catch((cause) => setRefreshError(errorText(cause, t`Could not refresh from Carta`)));
  };

  const snapshot = cartaConnected ? (cap?.snapshot ?? null) : null;
  const reading = cartaConnected && syncing && !snapshot && !capFailed;
  const rows = joinRows(snapshot, contacts ?? []);
  const shown = rows.filter((row) => filter === "all" || rowKind(row) === filter);
  const showHoldings = snapshot !== null || reading;
  const filterNames: Record<Filter, string> = {
    all: t`All`,
    investor: t`Investors`,
    auditor: t`Auditors`,
    other: t`Other`,
  };
  const emptyText: Record<Filter, string> = {
    all: t`Add your investors, auditors and counsel here. Contacts are your address book.`,
    investor: t`No investors yet`,
    auditor: t`No auditors yet`,
    other: t`No other contacts yet`,
  };
  const addKindLabel = addKindLabels();
  const addContact = () =>
    setEditing(
      filter === "all" ? "new" : { name: "", email: null, organization: null, kind: filter },
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
          setToast(null);
          load();
        })
        .catch((cause) =>
          setToast({
            text: errorText(cause, t`Could not restore ${name}`),
            undo: restore,
            sticky: true,
          }),
        )
        .finally(() => {
          restoring = false;
        });
    };
    setToast({ text: t`Deleted ${name}`, undo: restore });
  };

  return (
    <div className="@container rk-scroll flex-1 overflow-y-auto px-4 pb-6 pt-2 md:px-7 md:pt-5">
      <div className={`flex items-center gap-2 ${snapshot ? "mb-0.5" : "mb-4"}`}>
        <div className="me-auto min-w-0">
          <h1 className="truncate text-lg font-semibold">
            <Trans>Cap table</Trans>
          </h1>
        </div>
        <HideAmountsButton />
        {cartaConnected ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className="pointer-coarse:size-10"
            aria-label={t`Refresh from Carta`}
            disabled={syncing && !capFailed}
            onClick={() => void refresh()}
          >
            <RefreshCw aria-hidden="true" className={syncing ? "animate-spin" : undefined} />
          </Button>
        ) : null}
        {/* On a phone the button is icon-only, so the page title is not cut to "Cap ta…". */}
        <Button
          variant={cartaConnected ? "default" : "outline"}
          onClick={addContact}
          aria-label={filter === "all" ? t`Add contact` : addKindLabel[filter]}
        >
          <Plus aria-hidden="true" />
          <span className="hidden @sm:inline">
            {filter === "all" ? <Trans>Add contact</Trans> : addKindLabel[filter]}
          </span>
        </Button>
        {onShowAgent ? <AskBotButton botName="Carta agent" onClick={onShowAgent} /> : null}
      </div>
      {snapshot ? (
        // Under the header row, not beside its buttons, so a phone shows the company and the time.
        // The update time never truncates; a long company name gives way first.
        <p className="mb-4 flex min-w-0 gap-1 text-xs text-muted-foreground">
          <span className="truncate" title={snapshot.companyName}>
            {snapshot.companyName}
          </span>
          <span className="shrink-0">
            · <Trans>Updated {formatRelativeTime(snapshot.updatedAt)}</Trans>
          </span>
        </p>
      ) : null}

      {cartaConnected ? null : (
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
            <p className="text-sm text-muted-foreground">
              <Trans>
                Ownership comes from Carta. Connect it to see holders, the option pool and SAFEs
                here. The Carta agent can answer questions about them only while Carta is connected.
              </Trans>
            </p>
          </div>
          <Button onClick={() => setConnecting(true)}>
            {cartaExpired ? <Trans>Reconnect Carta</Trans> : <Trans>Connect Carta</Trans>}
          </Button>
        </Card>
      )}

      {showHoldings ? <Summary snapshot={snapshot} /> : null}
      {snapshot ? <OwnershipBar classes={snapshot.shareClasses} /> : null}
      {reading ? (
        <p className="mb-3 text-sm text-muted-foreground">
          <Trans>Reading Carta…</Trans>
        </p>
      ) : null}

      <Tabs value={filter} onValueChange={(next) => setFilter(next as Filter)} className="mb-4">
        <TabsList className="rounded-full" aria-label={t`Kind`}>
          {(Object.keys(filterNames) as Filter[]).map((value) => (
            <TabsTrigger key={value} value={value} className="rounded-full px-3">
              {filterNames[value]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {capFailed && cartaConnected ? (
        <div role="alert" className="mb-3 flex items-center gap-3 text-sm text-destructive">
          <span>
            <Trans>Could not load the cap table</Trans>
          </span>
          <Button variant="outline" size="sm" onClick={() => void loadCap()}>
            <Trans>Try again</Trans>
          </Button>
        </div>
      ) : null}

      {refreshError ? (
        <div role="alert" className="mb-3 flex items-center gap-3 text-sm text-destructive">
          <span>{refreshError}</span>
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            <Trans>Try again</Trans>
          </Button>
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="flex items-center gap-3 text-sm text-destructive">
          <span>{error}</span>
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
          {filter === "all" ? null : (
            <Button variant="outline" size="sm" onClick={addContact}>
              <Plus aria-hidden="true" />
              {addKindLabel[filter]}
            </Button>
          )}
        </div>
      ) : (
        // Fixed widths: the same columns, in the same places, with or without Carta and the panel.
        <table className="w-full table-fixed text-sm">
          <thead className="text-start text-xs text-muted-foreground">
            <tr>
              {/* On a phone the email moves under the name instead of being cut off. */}
              <th className="py-2 pe-3 text-start font-medium @md:w-[48%] @lg:w-[25%]">
                <Trans>Name</Trans>
              </th>
              <th className="hidden py-2 pe-3 text-start font-medium @md:table-cell">
                <Trans>Email</Trans>
              </th>
              <th className="hidden w-28 py-2 pe-3 text-start font-medium @lg:table-cell">
                <Trans>Kind</Trans>
              </th>
              {snapshot ? (
                <>
                  <th className="hidden w-20 py-2 pe-3 text-end font-medium @2xl:table-cell">
                    <Trans>Shares</Trans>
                  </th>
                  <th className="w-20 py-2 text-end font-medium">
                    <Trans>Ownership</Trans>
                  </th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
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
                <Button
                  variant="link"
                  size="xs"
                  className="px-0"
                  onClick={() =>
                    setEditing({
                      name,
                      email: holder?.email ?? null,
                      organization,
                      kind: "investor",
                    })
                  }
                >
                  <Trans>Add email</Trans>
                </Button>
              ) : null;
              return (
                <tr key={key} className="h-14 border-t border-border hover:bg-muted/50">
                  <td className="py-2 pe-3">
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
                    {email ? (
                      <div
                        data-testid="cap-table-row-email"
                        className="break-all text-xs text-muted-foreground @md:hidden"
                      >
                        {email}
                      </div>
                    ) : null}
                  </td>
                  <td
                    data-testid="cap-table-email-cell"
                    className="hidden truncate py-2 pe-3 text-muted-foreground @md:table-cell"
                    title={contact?.email ?? undefined}
                  >
                    {email ?? empty}
                  </td>
                  <td className="hidden py-2 pe-3 @lg:table-cell">
                    <div className="truncate">{names[kind]}</div>
                    {holding ? (
                      <div className="truncate text-xs text-muted-foreground" title={holding}>
                        {holding}
                      </div>
                    ) : null}
                  </td>
                  {snapshot ? (
                    <>
                      <td className="hidden py-2 pe-3 text-end tabular-nums @2xl:table-cell">
                        {holder?.shares != null ? num(holder.shares) : empty}
                      </td>
                      <td className="py-2 text-end tabular-nums">
                        {holder?.percent != null ? pct(holder.percent) : empty}
                      </td>
                    </>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

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
          onSaved={() => {
            load();
            setToast({ text: t`Contact saved` });
          }}
          onDeleted={deleted}
          onOpenContact={setEditing}
        />
      ) : null}
      <div
        role="status"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-100 flex justify-center px-4"
      >
        {toast ? (
          <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-border bg-card py-1 ps-3 pe-1 text-sm text-card-foreground shadow-md">
            <span className="py-1">{toast.text}</span>
            {toast.undo ? (
              <Button variant="ghost" size="sm" onClick={toast.undo}>
                {toast.sticky ? <Trans>Try again</Trans> : <Trans>Undo</Trans>}
              </Button>
            ) : (
              <span className="pe-2" />
            )}
            {toast.sticky ? (
              <Button variant="ghost" size="sm" onClick={() => setToast(null)}>
                <Trans>Dismiss</Trans>
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
