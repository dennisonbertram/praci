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
import { PanelRightOpen, PieChart, Plus, RefreshCw } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { hasConnectedCarta } from "../lib/carta-agent";
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

const num = (value: number | null) =>
  value == null ? DASH : value.toLocaleString(i18n.locale || "en");
const usd = (value: number | null, digits = 0) =>
  value == null
    ? DASH
    : value.toLocaleString(i18n.locale || "en", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
const pct = (value: number | null) => (value == null ? DASH : `${value.toFixed(2)}%`);

/** One investors-table row: a Carta holder, the contact it matches, or a contact with no holding. */
type Row = { key: string; contact: Contact | null; holder: Holder | null };

function joinRows(snapshot: Snapshot | null, contacts: Contact[]): Row[] {
  const byEmail = new Map(contacts.filter((c) => c.email).map((c) => [c.email?.toLowerCase(), c]));
  const used = new Set<string>();
  const rows: Row[] = (snapshot?.holders ?? []).map((holder, i) => {
    const contact = (holder.email && byEmail.get(holder.email.toLowerCase())) || null;
    if (contact) used.add(contact.id);
    return { key: `h${i}`, contact, holder };
  });
  for (const contact of contacts)
    if (!used.has(contact.id)) rows.push({ key: contact.id, contact, holder: null });
  return rows;
}

function Figure({ title, value }: { title: string; value: string }) {
  return (
    <Card size="sm" className="px-3.5">
      <h2 className="text-xs font-semibold text-muted-foreground">{title}</h2>
      <div className="mt-1 text-[22px] font-semibold leading-tight tabular-nums">{value}</div>
    </Card>
  );
}

function Summary({ snapshot }: { snapshot: Snapshot | null }) {
  const a = snapshot?.latest409a;
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 @2xl:grid-cols-4">
      {snapshot ? (
        <>
          <Figure title={t`Fully diluted shares`} value={num(snapshot.fullyDilutedShares)} />
          <Figure title={t`Option pool available`} value={num(snapshot.optionPoolAvailable)} />
          <Figure title={t`Latest 409A`} value={a ? usd(a.pricePerShareUsd, 2) : DASH} />
          <Figure title={t`Amount raised`} value={usd(snapshot.amountRaisedUsd)} />
        </>
      ) : (
        [0, 1, 2, 3].map((n) => <Skeleton key={n} className="h-[76px] w-full rounded-xl" />)
      )}
    </div>
  );
}

function OwnershipBar({ classes }: { classes: Snapshot["shareClasses"] }) {
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
            {contact ? <Trans>Edit contact</Trans> : <Trans>Add contact</Trans>}
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
  onConnectCarta,
}: {
  onShowAgent?: () => void;
  onConnectCarta: () => void;
}) {
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
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);
  const names = kindNames();

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
  useEffect(() => {
    rpc.mcp.servers
      .list()
      .then((servers) => {
        const connected = hasConnectedCarta(servers);
        setCartaConnected(connected);
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
  }, [loadCap]);

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
  const kindOf = (row: Row) => row.contact?.kind ?? "investor";
  const shown = rows.filter((row) => filter === "all" || kindOf(row) === filter);
  const showHoldings = snapshot !== null || reading;
  const filterNames: Record<Filter, string> = {
    all: t`All`,
    investor: t`Investors`,
    auditor: t`Auditors`,
    other: t`Other`,
  };
  const emptyText: Record<Filter, string> = {
    all: t`Add your investors, auditors and counsel here. Contacts are your address book; ownership comes from Carta.`,
    investor: t`No investors yet`,
    auditor: t`No auditors yet`,
    other: t`No other contacts yet`,
  };
  const addKindLabel: Record<ContactKind, string> = {
    investor: t`Add investor`,
    auditor: t`Add auditor`,
    other: t`Add contact`,
  };
  const deleted = (gone: Contact) => {
    load();
    setToast({
      text: t`Deleted ${gone.name}`,
      undo: () => {
        setToast(null);
        const { name, email, organization, kind, notes } = gone;
        rpc.contacts
          .save({ name, email, organization, kind, notes })
          .then(load)
          .catch((cause) => setError(errorText(cause, t`Could not restore the contact`)));
      },
    });
  };

  return (
    <div className="@container rk-scroll flex-1 overflow-y-auto px-4 pb-6 pt-2 md:px-7 md:pt-5">
      <div className="mb-4 flex items-center gap-2">
        <div className="me-auto min-w-0">
          <h1 className="truncate text-lg font-medium">
            <Trans>Cap Table</Trans>
          </h1>
          {snapshot ? (
            <p className="truncate text-xs text-muted-foreground">
              {snapshot.companyName} ·{" "}
              <Trans>Updated {formatRelativeTime(snapshot.updatedAt)}</Trans>
            </p>
          ) : null}
        </div>
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
        <Button variant={cartaConnected ? "default" : "outline"} onClick={() => setEditing("new")}>
          <Plus aria-hidden="true" />
          <Trans>Add contact</Trans>
        </Button>
        {onShowAgent ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className="pointer-coarse:size-10"
            aria-label={t`Show Carta agent`}
            onClick={onShowAgent}
          >
            <PanelRightOpen aria-hidden="true" />
          </Button>
        ) : null}
      </div>

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
                here, and to ask the Carta agent about them.
              </Trans>
            </p>
          </div>
          <Button onClick={onConnectCarta}>
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
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setEditing({ name: "", email: null, organization: null, kind: filter })
              }
            >
              <Plus aria-hidden="true" />
              {addKindLabel[filter]}
            </Button>
          )}
        </div>
      ) : (
        <table className="w-full table-fixed text-sm">
          <thead className="text-start text-xs text-muted-foreground">
            <tr>
              <th
                className={`${snapshot ? "w-[48%] @md:w-[30%]" : "w-[40%]"} py-2 pe-3 text-start font-medium`}
              >
                <Trans>Name</Trans>
              </th>
              <th className="py-2 pe-3 text-start font-medium">
                <Trans>Email</Trans>
              </th>
              {snapshot ? (
                <>
                  <th className="hidden w-40 py-2 pe-3 text-start font-medium @3xl:table-cell">
                    <Trans>Holding</Trans>
                  </th>
                  <th className="hidden w-28 py-2 pe-3 text-end font-medium @md:table-cell">
                    <Trans>Shares</Trans>
                  </th>
                  <th className="w-24 py-2 text-end font-medium">
                    <Trans>Ownership</Trans>
                  </th>
                </>
              ) : (
                <th className="w-24 py-2 text-start font-medium">
                  <Trans>Kind</Trans>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {shown.map(({ key, contact, holder }) => {
              const name = contact?.name ?? holder?.name ?? "";
              const organization = contact?.organization ?? holder?.organization ?? null;
              const holding = holder
                ? holder.shares == null && holder.amountUsd != null
                  ? `${holder.security}, ${usd(holder.amountUsd)}`
                  : holder.security
                : null;
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
                    {organization ? (
                      <div className="truncate text-xs text-muted-foreground" title={organization}>
                        {organization}
                      </div>
                    ) : null}
                    {/* Without room for the Holding column, a SAFE or other holding shows here. */}
                    {snapshot && holding && holder?.shares == null ? (
                      <div className="truncate text-xs text-muted-foreground @3xl:hidden">
                        {holding}
                      </div>
                    ) : null}
                  </td>
                  <td
                    className="truncate py-2 pe-3 text-muted-foreground"
                    title={contact?.email ?? undefined}
                  >
                    {contact ? (
                      contact.email
                    ) : holder ? (
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() =>
                          setEditing({
                            name,
                            email: holder.email,
                            organization: holder.organization,
                          })
                        }
                      >
                        <Trans>Add email</Trans>
                      </Button>
                    ) : null}
                  </td>
                  {snapshot ? (
                    <>
                      <td className="hidden truncate py-2 pe-3 text-muted-foreground @3xl:table-cell">
                        {holding}
                      </td>
                      <td className="hidden py-2 pe-3 text-end font-mono tabular-nums @md:table-cell">
                        {holder ? num(holder.shares) : null}
                      </td>
                      <td className="py-2 text-end font-mono tabular-nums">
                        {holder ? pct(holder.percent) : null}
                      </td>
                    </>
                  ) : (
                    <td className="py-2 text-muted-foreground">
                      {names[kindOf({ key, contact, holder })]}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

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
                <Trans>Undo</Trans>
              </Button>
            ) : (
              <span className="pe-2" />
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
