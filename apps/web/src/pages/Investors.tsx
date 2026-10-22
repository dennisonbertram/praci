import { i18n } from "@lingui/core";
import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type {
  AuditRequest,
  CapTableSource,
  CapTableState,
  Contact,
  ContactKind,
  ContactLinked,
  InvestorReminderCadence,
  InvestorUpdate,
  PortalLink,
  Safe,
} from "@rakazo/contracts";
import { isCartaEndpoint } from "@rakazo/contracts";
import { capTableMath, countedSafes, isSafeSecurity } from "@rakazo/core";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  enqueueNotificationToast,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@rakazo/ui-web";
import {
  ChevronDown,
  CirclePlus,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Sheet,
  Type,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AskBotButton } from "../components/AskBotButton";
import { ContactDeleteConfirm, hasLinks } from "../components/ContactDeleteConfirm";
import type { ContactPrefill as Prefill } from "../components/ContactDialog";
import { ContactDialog } from "../components/ContactDialog";
import { CopyLinkDialog } from "../components/CopyLinkDialog";
import type { SaveResult } from "../components/cap-table/CapTableEditor";
import { CapTableEditor } from "../components/cap-table/CapTableEditor";
import type { HoldingRow } from "../components/cap-table/HoldingsTable";
import { HoldingsTable } from "../components/cap-table/HoldingsTable";
import { OwnershipBar } from "../components/cap-table/OwnershipBar";
import { SafeRows } from "../components/cap-table/SafeRows";
import { FolderDocuments } from "../components/data-room/FolderDocuments";
import { DrivePicker } from "../components/data-room/ImportFromDrive";
import { DRIVE_PAGE } from "../components/data-room/ImportFromEmail";
import { CustomConnectionDialog } from "../components/integrations/CustomConnectionDialog";
import { useIntegrations } from "../components/integrations/useIntegrations";
import { ActionItems } from "../components/investors/ActionItems";
import {
  ContactRowPlaceholder,
  FiguresPlaceholder,
  OwnershipPlaceholder,
} from "../components/investors/Placeholders";
import { SearchField } from "../components/ListControls";
import { PAGE_GUTTER_X, PageHeader } from "../components/PageHeader";
import { SectionCard } from "../components/SectionCard";
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
const CONTACT_TABS = ["investor", "board"] as const satisfies readonly ContactKind[];
type ContactTab = (typeof CONTACT_TABS)[number];
const parseTab = (value: string | null): ContactTab =>
  CONTACT_TABS.find((tab) => tab === value) ?? "investor";

/** How often the page asks again while the Carta agent is still reading. */
const POLL_MS = 3000;
/** How often an idle page checks for a change made elsewhere, such as in another tab. */
const IDLE_POLL_MS = 30_000;
const DASH = "—";
/** The three equal source choices in the Cap table card. */
const SOURCE_BUTTON = "h-11 justify-start gap-2.5 rounded-xl px-3.5 font-semibold";

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

/**
 * Fully diluted shares (with the 409A when known) and Equity raised: the table's invested money plus
 * the SAFEs, which come only from the shared SAFE list (the one Fundraising shows).
 */
function Summary({
  snapshot,
  safes,
  safesFailed,
}: {
  snapshot: Snapshot;
  safes: readonly Safe[];
  safesFailed: boolean;
}) {
  useHideAmounts();
  const math = capTableMath(snapshot);
  const a = snapshot.latest409a;
  // Nothing known to add up shows a dash, not $0. Table rows that are SAFEs are not counted: the
  // SAFE list is the record.
  const counted = countedSafes(safes);
  // Raised money is Funded only; Sent and Signed SAFEs are promises, shown apart as committed.
  const sumUsd = (status: Safe["status"][]) =>
    counted
      .filter((safe) => status.includes(safe.status))
      .reduce((sum, safe) => sum + safe.amountCents / 100, 0);
  const safeUsd = sumUsd(["funded"]);
  const committedUsd = sumUsd(["sent", "signed"]);
  // A failed SAFE request would make the total look complete when it is not.
  const raised =
    !safesFailed &&
    (counted.length > 0 ||
      snapshot.holders.some((h) => h.amountUsd != null && !isSafeSecurity(h.security)))
      ? usd(math.raisedUsd + safeUsd)
      : DASH;
  return (
    <div className="mb-4 grid grid-cols-2 gap-2 @md/bd:gap-3">
      <Figure
        title={t`Fully diluted`}
        value={num(snapshot.fullyDilutedShares)}
        hint={
          a
            ? t`409A ${usd(a.pricePerShareUsd, 2)} · ${shortDay(a.date, new Date(), i18n.locale || "en")}`
            : undefined
        }
      />
      <Figure
        title={t`Equity raised`}
        value={raised}
        hint={
          committedUsd > 0
            ? t`${usd(committedUsd)} committed`
            : counted.length > 0
              ? plural(counted.length, { one: "# SAFE", other: "# SAFEs" })
              : undefined
        }
      />
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

const updateStatusNames = () => ({
  draft: t`Draft`,
  sending: t`Sending`,
  sent: t`Sent`,
  partly_sent: t`Partly sent`,
  posted: t`Posted`,
});

/** Why a Partly sent update is partly sent: failed recipients first, then deliveries nobody confirmed. */
function problemText(update: InvestorUpdate): string {
  const failed = update.deliveries.filter((d) => d.state === "failed");
  const unknown = update.deliveries.filter((d) => d.state === "unknown");
  const parts: string[] = [];
  if (failed.length === 1) parts.push(t`${failed[0]?.name ?? ""} failed`);
  else if (failed.length > 1) parts.push(t`${failed.length} failed`);
  if (unknown.length === 1) parts.push(t`${unknown[0]?.name ?? ""}: delivery unknown`);
  else if (unknown.length > 1) parts.push(t`${unknown.length} deliveries unknown`);
  return parts.join(" · ");
}

function UpdateRow({
  update,
  onOpen,
  onRetry,
  onMarkDelivered,
  onDuplicate,
  onDelete,
}: {
  update: InvestorUpdate;
  onOpen: () => void;
  onRetry: () => void;
  onMarkDelivered: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const locale = i18n.locale || "en";
  const sending = update.status === "sending";
  const partly = update.status === "partly_sent";
  const hasUnknown = update.deliveries.some((d) => d.state === "unknown");
  const day = (iso: string) => shortDay(iso.slice(0, 10), new Date(), locale);
  const subline = partly
    ? problemText(update)
    : update.status === "draft"
      ? t`Drafted ${day(update.createdAt)}`
      : update.status === "posted" && update.sentAt
        ? t`Posted ${day(update.sentAt)}`
        : update.sentAt
          ? t`Sent ${day(update.sentAt)}`
          : update.period;
  return (
    <li className="flex min-h-13 items-center gap-2 border-t border-border">
      <button
        type="button"
        data-row-open
        className="min-w-0 flex-1 rounded-sm py-1.5 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onOpen}
      >
        <span className="block truncate text-sm font-medium" title={update.subject}>
          {update.subject}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{subline}</span>
      </button>
      <Badge variant={partly ? "destructive" : "secondary"}>
        {updateStatusNames()[update.status]}
      </Badge>
      {partly ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <Trans>Retry</Trans>
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={sending}
              aria-label={t`Actions for ${update.subject}`}
            />
          }
        >
          <MoreHorizontal aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {hasUnknown ? (
            <DropdownMenuItem onClick={onMarkDelivered}>
              <Trans>Mark delivered</Trans>
            </DropdownMenuItem>
          ) : null}
          {update.status !== "draft" ? (
            <DropdownMenuItem onClick={onDuplicate}>
              <Trans>Duplicate</Trans>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trans>Delete</Trans>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

/** Every update, drafts included, with New update and the Reminder choice. */
function UpdatesSection({
  updates,
  cadence,
  failed,
  onNew,
  onOpen,
  onRetry,
  onMarkDelivered,
  onDuplicate,
  onDelete,
  onReminder,
  onReload,
  doneToggle,
}: {
  updates: InvestorUpdate[] | null;
  cadence: InvestorReminderCadence;
  failed: boolean;
  onNew: () => void;
  onOpen: (update: InvestorUpdate) => void;
  onRetry: (update: InvestorUpdate) => void;
  onMarkDelivered: (update: InvestorUpdate) => void;
  onDuplicate: (update: InvestorUpdate) => void;
  onDelete: (update: InvestorUpdate) => void;
  onReminder: (cadence: InvestorReminderCadence) => void;
  onReload: () => void;
  /** Present once a request has been closed as done, so the history stays reachable. */
  doneToggle: { shown: boolean; onToggle: () => void } | null;
}) {
  return (
    <SectionCard
      title={t`Updates`}
      actions={
        <>
          {doneToggle ? (
            <Button variant="ghost" size="sm" onClick={doneToggle.onToggle}>
              {doneToggle.shown ? <Trans>Hide done</Trans> : <Trans>Show done</Trans>}
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={onNew}>
            <Plus aria-hidden="true" />
            <Trans>New update</Trans>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" aria-label={t`Update options`} />}
            >
              <MoreHorizontal aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Trans>Reminder</Trans>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup
                    value={cadence}
                    onValueChange={(next) => onReminder(next as InvestorReminderCadence)}
                  >
                    <DropdownMenuRadioItem value="monthly">
                      <Trans>Monthly</Trans>
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="quarterly">
                      <Trans>Quarterly</Trans>
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="off">
                      <Trans>Off</Trans>
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
    >
      {failed ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-destructive">
            <Trans>Could not load updates</Trans>
          </span>
          <Button variant="outline" size="sm" onClick={onReload}>
            <Trans>Try again</Trans>
          </Button>
        </div>
      ) : updates === null ? (
        <Skeleton className="h-9 w-full" aria-busy="true" />
      ) : updates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          <Trans>No updates yet</Trans>
        </p>
      ) : (
        <ul>
          {updates.map((update) => (
            <UpdateRow
              key={update.id}
              update={update}
              onOpen={() => onOpen(update)}
              onRetry={() => onRetry(update)}
              onMarkDelivered={() => onMarkDelivered(update)}
              onDuplicate={() => onDuplicate(update)}
              onDelete={() => onDelete(update)}
            />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

/** The Portal column: when the latest link went out, when it was opened, or that access was revoked. */
function portalLabel(contact: Contact): string {
  const day = (iso: string) => shortDay(iso.slice(0, 10), new Date(), i18n.locale || "en");
  const { portalLinkSentAt: sent, portalLastSeenAt: seen, portalBlockedAt: blocked } = contact;
  if (blocked) return t`Revoked`;
  if (seen && !sent) return t`Unblocked · send a link`;
  if (seen && sent && seen >= sent) return t`Opened ${day(seen)}`;
  if (sent) return t`Invited ${day(sent)}`;
  return DASH;
}

/** One contact in the Contacts section: name, organization and email, with Edit and Delete. */
function ContactRow({
  contact,
  saved,
  portal,
  onEdit,
  onDelete,
  onResend,
  onCopyLink,
  onRevoke,
  onUnblock,
}: {
  contact: Contact;
  saved: boolean;
  /** The Investors tab only: board and auditor contacts have no portal access. */
  portal: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onResend: () => void;
  onCopyLink: () => void;
  onRevoke: () => void;
  onUnblock: () => void;
}) {
  const blocked = Boolean(contact.portalBlockedAt);
  const hasAccess = Boolean(contact.portalLinkSentAt || contact.portalLastSeenAt) && !blocked;
  return (
    <li
      data-contact-id={contact.id}
      className={`flex min-h-13 items-center gap-2 border-t border-border ${saved ? SAVED_ROW_CLASS : ""}`}
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
      {portal ? (
        <span
          data-portal-state
          className={`shrink-0 text-xs ${blocked ? "text-destructive" : "text-muted-foreground"}`}
        >
          {portalLabel(contact)}
        </span>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label={t`Actions for ${contact.name}`} />
          }
        >
          <MoreHorizontal aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {portal && !blocked ? (
            <>
              {contact.email ? (
                <DropdownMenuItem onClick={onResend}>
                  <Trans>Resend link</Trans>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onClick={onCopyLink}>
                <Trans>Copy link</Trans>
              </DropdownMenuItem>
              {hasAccess ? (
                <DropdownMenuItem onClick={onRevoke}>
                  <Trans>Revoke</Trans>
                </DropdownMenuItem>
              ) : null}
            </>
          ) : null}
          {portal && blocked ? (
            <DropdownMenuItem onClick={onUnblock}>
              <Trans>Unblock</Trans>
            </DropdownMenuItem>
          ) : null}
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
  const [confirmDelete, setConfirmDelete] = useState<{
    contact: Contact;
    linked: ContactLinked;
  } | null>(null);
  const [links, setLinks] = useState<PortalLink[] | null>(null);
  const [connecting, setConnecting] = useState(false);
  // Use a Google Sheet: the picker is open, or Google Drive is not connected and must be first.
  const [pickingSheet, setPickingSheet] = useState(false);
  const [driveMissing, setDriveMissing] = useState(false);
  const navigate = useNavigate();
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

  const [updates, setUpdates] = useState<InvestorUpdate[] | null>(null);
  const [updatesFailed, setUpdatesFailed] = useState(false);
  const [cadence, setCadence] = useState<InvestorReminderCadence>("monthly");
  const [deletingUpdate, setDeletingUpdate] = useState<InvestorUpdate | null>(null);
  const [resending, setResending] = useState<InvestorUpdate | null>(null);
  const statuses = useRef(new Map<string, string>());
  const loadUpdates = useCallback(() => {
    rpc.investors.updates
      .list()
      .then((list) => {
        // A send that finished while this page was open says how many it reached.
        for (const update of list) {
          if (statuses.current.get(update.id) === "sending" && update.status === "sent") {
            const count = update.deliveries.filter((d) => d.state === "sent").length;
            enqueueNotificationToast({
              id: `update-sent-${update.id}`,
              title: t`Sent to ${count}`,
            });
          }
          statuses.current.set(update.id, update.status);
        }
        setUpdates(list);
        setUpdatesFailed(false);
      })
      .catch(() => setUpdatesFailed(true));
  }, []);
  useEffect(loadUpdates, [loadUpdates]);
  useEffect(() => {
    rpc.investors
      .reminder({})
      .then((result) => setCadence(result.cadence))
      .catch(() => undefined);
  }, []);
  const [audits, setAudits] = useState<AuditRequest[]>([]);
  const [showDone, setShowDone] = useState(false);
  const loadAudits = useCallback(() => {
    rpc.investors.audits
      .list({ includeDone: true })
      .then((list) => setAudits(list ?? []))
      // The list is an extra on this page: a failed load leaves the last one.
      .catch(() => undefined);
  }, []);
  useEffect(loadAudits, [loadAudits]);
  const anyDrafting = audits.some((a) => a.drafting);
  useEffect(() => {
    if (!anyDrafting) return;
    const timer = setInterval(loadAudits, POLL_MS);
    return () => clearInterval(timer);
  }, [anyDrafting, loadAudits]);
  const auditAction = (call: () => Promise<unknown>, failure: string) =>
    call()
      .then(loadAudits)
      .catch((cause) => {
        notify(errorText(cause, failure));
        loadAudits();
      });
  const anySending = updates?.some((u) => u.status === "sending") ?? false;
  useEffect(() => {
    if (!anySending) return;
    const timer = setInterval(loadUpdates, 2000);
    return () => clearInterval(timer);
  }, [anySending, loadUpdates]);

  const updateAction = (call: () => Promise<unknown>, failure: string) =>
    call()
      .then(loadUpdates)
      .catch((cause) => {
        notify(errorText(cause, failure));
        loadUpdates();
      });
  // Repeated clicks while a draft is being created must not create more drafts.
  const startingUpdate = useRef(false);
  const startUpdate = (audience: "investors" | "board") => {
    if (startingUpdate.current) return Promise.resolve();
    startingUpdate.current = true;
    return rpc.investors.updates
      .save({ audience })
      .then((created) => navigate(`/app/investors/updates/${created.id}`))
      .catch((cause) => notify(errorText(cause, t`Could not start an update`)))
      .finally(() => {
        startingUpdate.current = false;
      });
  };
  const retryUpdate = (update: InvestorUpdate) => {
    if (update.deliveries.some((d) => d.state === "unknown")) return setResending(update);
    void updateAction(() => rpc.investors.updates.retry({ id: update.id }), t`Could not retry`);
  };
  const changeReminder = (next: InvestorReminderCadence) => {
    const before = cadence;
    setCadence(next);
    rpc.investors
      .reminder({ cadence: next })
      .then((result) => setCadence(result.cadence))
      .catch((cause) => {
        setCadence(before);
        notify(errorText(cause, t`Could not change the reminder`));
      });
  };

  // The header slot of the Cap table card, where the typed-in table shows Saved and Not saved.
  const [statusSlot, setStatusSlot] = useState<HTMLElement | null>(null);
  const [capFailed, setCapFailed] = useState(false);
  const [safes, setSafes] = useState<Safe[]>([]);
  const [safesFailed, setSafesFailed] = useState(false);
  const latestCap = useRef(0);
  const loadCap = useCallback(() => {
    const request = ++latestCap.current;
    // The SAFE rows under the table are secondary: if they cannot load, the table still shows.
    // One quiet retry, so a single dropped request does not show a dash.
    void rpc.fundraising.safes
      .list()
      .catch(() => rpc.fundraising.safes.list())
      .then((rows) => {
        if (request !== latestCap.current) return;
        setSafes(rows ?? []);
        setSafesFailed(false);
      })
      .catch(() => {
        if (request === latestCap.current) setSafesFailed(true);
      });
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
  const sheetReading = cap?.reading ?? false;
  // Contacts are filled in by the same run, so reload them when it ends.
  const wasSyncing = useRef(false);
  useEffect(() => {
    if (wasSyncing.current && !syncing) load();
    wasSyncing.current = syncing;
  }, [syncing, load]);
  // A chat turn can add or change contacts (contacts_add, contacts_save) and the cap table, so
  // reload both when the agent finishes answering.
  const busyReading = syncing || sheetReading;
  const wasBusy = useRef(agentBusy);
  useEffect(() => {
    if (wasBusy.current && !agentBusy) {
      load();
      void loadCap();
      loadUpdates();
      loadAudits();
    }
    wasBusy.current = agentBusy;
  }, [agentBusy, load, loadCap, loadUpdates, loadAudits]);
  const typedIn = cap?.snapshot?.source === "native";
  const sheetSource = cap?.snapshot?.source === "sheet";
  const watching = serversChecked && (cartaConnected || typedIn || sheetSource) && !capFailed;
  useEffect(() => {
    if (!watching) return;
    const timer = setInterval(
      () => {
        if (busyReading || document.visibilityState === "visible") void loadCap();
      },
      busyReading ? POLL_MS : IDLE_POLL_MS,
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
  }, [watching, busyReading, loadCap]);

  const [actionError, setActionError] = useState("");
  const refresh = () => {
    setActionError("");
    return rpc.investors
      .refresh()
      .then(() => loadCap())
      .catch((cause) =>
        setActionError(
          errorText(
            cause,
            cap?.snapshot?.source === "sheet"
              ? t`Could not read the sheet`
              : t`Could not refresh from Carta`,
          ),
        ),
      );
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
  const chooseSheet = async () => {
    setActionError("");
    try {
      const rows = await rpc.connections.list();
      const connected = rows.some(
        (row) =>
          row.connectorId === "google" &&
          row.provider === "googledrive" &&
          row.status === "connected",
      );
      setDriveMissing(!connected);
      setPickingSheet(connected);
    } catch (cause) {
      setActionError(errorText(cause, t`Could not check Google Drive`));
    }
  };
  const switchToSheet = (picked: { id: string; name: string }) => {
    setPickingSheet(false);
    return changeTable(
      // biome-ignore lint/correctness/useHookAtTopLevel: an RPC named useSheet, not a hook
      () => rpc.investors.useSheet({ driveFileId: picked.id, name: picked.name }),
      t`Could not use the sheet`,
    );
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
  // A sheet chosen but not yet read is an empty table: it shows as no table, with the sheet's name.
  const sheetPending = raw?.source === "sheet" && raw.holders.length === 0;
  // A Carta table is hidden while Carta is not signed in; a typed-in or sheet table never depends on it.
  const snapshot = raw && !sheetPending && (raw.source !== "carta" || cartaConnected) ? raw : null;
  const reading = cartaConnected && syncing && !snapshot && !sheetPending && !capFailed;
  // Connected, but nothing has been read and no read is running, e.g. no model was set up yet.
  const neverRead =
    cartaConnected && cap !== null && !snapshot && !sheetPending && !syncing && !capFailed;
  const readFailed = sheetSource && (cap?.lastReadFailed ?? false) && !sheetReading;
  const math = snapshot ? capTableMath(snapshot) : null;
  const allContacts = contacts ?? [];
  const holdingRows: HoldingRow[] =
    snapshot && math
      ? [
          ...snapshot.holders.flatMap((holder, i) =>
            // SAFEs come from the SAFE list below the table, never from the snapshot.
            isSafeSecurity(holder.security)
              ? []
              : [
                  {
                    key: `h${i}`,
                    name: holder.name,
                    security: holder.security,
                    shares: holder.shares,
                    amountUsd: holder.amountUsd,
                    percent: math.holders[i]?.percent ?? null,
                    contact: contactFor(allContacts, holder),
                  },
                ],
          ),
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
  const tabNames: Record<ContactTab, string> = {
    investor: t`SAFEs and funds`,
    board: t`Board`,
  };
  const hasBoard = allContacts.some((c) => c.kind === "board");
  const addContact = () => setEditing({ name: "", email: null, organization: null, kind: tab });
  const openContact = (id: string) => {
    const found = allContacts.find((c) => c.id === id);
    if (found) setEditing(found);
  };
  const addHolderAsContact = (name: string, email: string | null = null) =>
    setEditing({ name, email, organization: null, kind: "investor" });
  /** Delete: a contact with linked data asks first (and has no Undo); any other keeps main's Undo. */
  const deleteContact = async (contact: Contact) => {
    try {
      const linked = await rpc.contacts.linked({ id: contact.id });
      if (hasLinks(linked)) return setConfirmDelete({ contact, linked });
      await rpc.contacts.delete({ id: contact.id });
      deleted(contact);
    } catch (cause) {
      notify(errorText(cause, t`Could not delete ${contact.name}`));
    }
  };
  /** Resend link emails a fresh link; with Copy link, or no email provider, the link is shown instead. */
  const sendLink = async (contact: Contact, copy: boolean) => {
    try {
      const { link } = await rpc.investors.portalResend({ contactId: contact.id, copy });
      load();
      setSavedId(contact.id);
      if (link) setLinks([{ contactId: contact.id, name: contact.name, link }]);
      else notify(t`Link sent to ${contact.name}`);
    } catch (cause) {
      notify(errorText(cause, t`Could not send a link to ${contact.name}`));
    }
  };
  const changePortal = async (contact: Contact, change: "revoke" | "unblock") => {
    try {
      await (change === "revoke"
        ? rpc.investors.portalRevoke({ contactId: contact.id })
        : rpc.investors.portalUnblock({ contactId: contact.id }));
      load();
      setSavedId(contact.id);
    } catch (cause) {
      notify(errorText(cause, t`Could not change access for ${contact.name}`));
    }
  };

  const source = snapshot?.source;
  const names = sourceNames();
  const sourceLabel =
    snapshot && source
      ? source === "carta" && syncing
        ? t`Reading Carta…`
        : source === "sheet" && sheetReading
          ? t`Reading sheet…`
          : t`${names[source]} · as of ${shortDay(snapshot.asOf, new Date(), i18n.locale || "en")}`
      : null;
  const canRefresh =
    (source === "carta" && cartaConnected && !(needsModel && neverRead)) || source === "sheet";
  const otherSources = (["carta", "sheet", "native"] as const).filter((name) => name !== source);

  return (
    <div className="@container/bd flex min-h-0 min-w-0 flex-1 flex-col">
      <div className={`${PAGE_GUTTER_X} pt-2 md:pt-5`}>
        <PageHeader
          title={<Trans>Investors</Trans>}
          meta={
            snapshot && sourceLabel ? (
              <>
                {/* The source line never truncates; a long company name gives way first. */}
                {/* The company name is in the sidebar; on a phone only the source stays. */}
                <span className="truncate max-sm:hidden" title={snapshot.companyName}>
                  {snapshot.companyName}
                </span>
                <span className="whitespace-nowrap max-sm:hidden">·</span>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`-mx-1 h-8 whitespace-nowrap px-1 text-xs font-normal pointer-coarse:h-11 ${readFailed ? "text-warning" : "text-muted-foreground"}`}
                      />
                    }
                  >
                    {sourceLabel}
                    <ChevronDown aria-hidden="true" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-max min-w-40">
                    {canRefresh ? (
                      <DropdownMenuItem
                        disabled={syncing || sheetReading}
                        onClick={() => void refresh()}
                      >
                        <RefreshCw aria-hidden="true" />
                        {readFailed ? (
                          <Trans>Last read failed · Try again</Trans>
                        ) : (
                          <Trans>Refresh</Trans>
                        )}
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
                          ) : name === "sheet" ? (
                            <DropdownMenuItem key={name} onClick={() => void chooseSheet()}>
                              <Trans>Use a Google Sheet</Trans>
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

        {driveMissing ? (
          <div className="mb-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`${DRIVE_PAGE}?next=${encodeURIComponent("/app/investors")}`)}
            >
              <Trans>Connect Google Drive</Trans>
            </Button>
          </div>
        ) : null}
        <div className="flex flex-col gap-4">
          <ActionItems
            drafts={(updates ?? []).filter((u) => u.status === "draft")}
            audits={audits.filter((a) => a.status !== "done" || showDone)}
            onOpen={(update) => navigate(`/app/investors/updates/${update.id}`)}
            onDraftAudit={(audit) =>
              void auditAction(
                () => rpc.investors.audits.draft({ id: audit.id }),
                t`Could not start the draft`,
              )
            }
            onCloseAudit={(audit, status) =>
              void auditAction(
                () => rpc.investors.audits.update({ id: audit.id, status }),
                t`Could not update the request`,
              )
            }
          />

          {!serversChecked || (cap === null && !capFailed) ? (
            <div className="flex flex-col gap-2" aria-busy="true">
              {[0, 1, 2].map((n) => (
                <Skeleton key={n} className="h-9 w-full" />
              ))}
            </div>
          ) : (
            <>
              <SectionCard
                title={t`Cap table`}
                actions={<span ref={setStatusSlot} className="flex items-center gap-2 text-xs" />}
              >
                {snapshot && math ? (
                  <>
                    {snapshot.holders.length === 0 &&
                    !snapshot.fullyDilutedShares &&
                    !snapshot.latest409a &&
                    countedSafes(safes).length === 0 ? (
                      <FiguresPlaceholder />
                    ) : (
                      <Summary snapshot={snapshot} safes={safes} safesFailed={safesFailed} />
                    )}
                    {snapshot.source === "native" ? (
                      <CapTableEditor
                        snapshot={snapshot}
                        onSave={saveTable}
                        contactIdFor={(name) =>
                          contactFor(allContacts, { name, email: null })?.id ?? null
                        }
                        onAddContact={(name) => addHolderAsContact(name)}
                        onOpenContact={openContact}
                        statusSlot={statusSlot}
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
                    <SafeRows safes={safes} />
                  </>
                ) : (
                  <>
                    {reading ? (
                      <p className="text-sm text-muted-foreground">
                        <Trans>Reading Carta…</Trans>
                      </p>
                    ) : sheetPending && sheetReading ? (
                      <p className="text-sm text-muted-foreground">
                        {t`Reading ${raw?.sourceRef?.name ?? ""}…`}
                      </p>
                    ) : sheetPending && readFailed ? (
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="w-full text-warning">
                          <Trans>The sheet could not be read.</Trans>
                        </span>
                        <Button variant="outline" onClick={() => void refresh()}>
                          <Trans>Try again</Trans>
                        </Button>
                        <Button variant="outline" onClick={() => void typeItIn()}>
                          <Trans>Type it in</Trans>
                        </Button>
                      </div>
                    ) : (
                      // No table yet: pick where it comes from. None is filled; the page cannot know which fits.
                      <div className="grid grid-cols-1 gap-2 @md/bd:grid-cols-3">
                        {neverRead ? (
                          // Connected but unread: reading starts with a model; Type it in stays available.
                          needsModel && onOpenModelSettings ? (
                            <Button
                              variant="outline"
                              className={SOURCE_BUTTON}
                              onClick={onOpenModelSettings}
                            >
                              <CirclePlus aria-hidden="true" className="text-muted-foreground" />
                              <Trans>Add a model</Trans>
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              className={SOURCE_BUTTON}
                              onClick={() => void refresh()}
                            >
                              <CirclePlus aria-hidden="true" className="text-muted-foreground" />
                              <Trans>Read cap table</Trans>
                            </Button>
                          )
                        ) : serversFailed ? null : (
                          <Button
                            variant="outline"
                            className={SOURCE_BUTTON}
                            onClick={() => setConnecting(true)}
                          >
                            <CirclePlus aria-hidden="true" className="text-muted-foreground" />
                            {cartaExpired ? (
                              <Trans>Reconnect Carta</Trans>
                            ) : (
                              <Trans>Connect Carta</Trans>
                            )}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          className={SOURCE_BUTTON}
                          onClick={() => void chooseSheet()}
                        >
                          <Sheet aria-hidden="true" className="text-muted-foreground" />
                          <Trans>Use a Google Sheet</Trans>
                        </Button>
                        <Button
                          variant="outline"
                          className={SOURCE_BUTTON}
                          onClick={() => void typeItIn()}
                        >
                          <Type aria-hidden="true" className="text-muted-foreground" />
                          <Trans>Type it in</Trans>
                        </Button>
                      </div>
                    )}
                    <hr className="my-4 border-border" />
                    <FiguresPlaceholder />
                    <OwnershipPlaceholder className="mb-3" />
                    <div className="@container">
                      <HoldingsTable
                        rows={[]}
                        placeholderRows={3}
                        onAddContact={() => {}}
                        onOpenContact={() => {}}
                      />
                    </div>
                  </>
                )}
              </SectionCard>

              <UpdatesSection
                updates={updates}
                cadence={cadence}
                failed={updatesFailed}
                onNew={() => void startUpdate("investors")}
                onOpen={(update) => navigate(`/app/investors/updates/${update.id}`)}
                onRetry={retryUpdate}
                onMarkDelivered={(update) =>
                  void updateAction(
                    () => rpc.investors.updates.markDelivered({ id: update.id }),
                    t`Could not mark delivered`,
                  )
                }
                onDuplicate={(update) =>
                  void rpc.investors.updates
                    .duplicate({ id: update.id })
                    .then((copy) => navigate(`/app/investors/updates/${copy.id}`))
                    .catch((cause) => notify(errorText(cause, t`Could not duplicate`)))
                }
                onDelete={setDeletingUpdate}
                onReminder={changeReminder}
                onReload={loadUpdates}
                doneToggle={
                  audits.some((a) => a.status === "done")
                    ? { shown: showDone, onToggle: () => setShowDone((v) => !v) }
                    : null
                }
              />

              <SectionCard title={t`Contacts`}>
                <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <Tabs
                    value={tab}
                    onValueChange={(next) =>
                      setParam("kind", next === "investor" ? undefined : String(next))
                    }
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
                  {tab === "board" && hasBoard ? (
                    <Button variant="outline" size="sm" onClick={() => void startUpdate("board")}>
                      <Trans>Message the board</Trans>
                    </Button>
                  ) : null}
                  {allContacts.length > 0 && !error ? (
                    <SearchField
                      className="w-full @md/bd:ms-auto @md/bd:w-56"
                      value={query}
                      onChange={(next) => setParam("q", next || undefined)}
                      placeholder={t`Search`}
                      label={t`Search`}
                      name="contact-search"
                    />
                  ) : null}
                </div>
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
                  needle ? (
                    <div className="flex flex-col items-center gap-3 py-10 text-center">
                      <p className="text-sm text-muted-foreground">
                        <Trans>No matches</Trans>
                      </p>
                      <Button variant="outline" size="sm" onClick={() => setParam("q", undefined)}>
                        <Trans>Clear filters</Trans>
                      </Button>
                    </div>
                  ) : (
                    <ul>
                      {[0, 1, 2].map((n) => (
                        <ContactRowPlaceholder key={n} />
                      ))}
                    </ul>
                  )
                ) : (
                  <ul>
                    {shown.map((contact) => (
                      <ContactRow
                        key={contact.id}
                        contact={contact}
                        saved={contact.id === savedId}
                        portal={tab === "investor"}
                        onEdit={() => setEditing(contact)}
                        onDelete={() => void deleteContact(contact)}
                        onResend={() => void sendLink(contact, false)}
                        onCopyLink={() => void sendLink(contact, true)}
                        onRevoke={() => void changePortal(contact, "revoke")}
                        onUnblock={() => void changePortal(contact, "unblock")}
                      />
                    ))}
                  </ul>
                )}
              </SectionCard>

              <FolderDocuments folderPath={CAP_TABLE_FOLDER} />
            </>
          )}
        </div>

        <AlertDialog
          open={deletingUpdate !== null}
          onOpenChange={(open) => {
            if (!open) setDeletingUpdate(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                <Trans>Delete this update?</Trans>
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>
                <Trans>Cancel</Trans>
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  const target = deletingUpdate;
                  setDeletingUpdate(null);
                  if (target)
                    void updateAction(
                      () => rpc.investors.updates.delete({ id: target.id }),
                      t`Could not delete the update`,
                    );
                }}
              >
                <Trans>Delete</Trans>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog
          open={resending !== null}
          onOpenChange={(open) => {
            if (!open) setResending(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                <Trans>May already be delivered. Send again?</Trans>
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>
                <Trans>Close</Trans>
              </AlertDialogCancel>
              <Button
                variant="outline"
                onClick={() => {
                  const target = resending;
                  setResending(null);
                  if (target)
                    void updateAction(
                      () => rpc.investors.updates.markDelivered({ id: target.id }),
                      t`Could not mark delivered`,
                    );
                }}
              >
                <Trans>Mark delivered</Trans>
              </Button>
              <AlertDialogAction
                onClick={() => {
                  const target = resending;
                  setResending(null);
                  if (target)
                    void updateAction(
                      () => rpc.investors.updates.retry({ id: target.id, resendUnknown: true }),
                      t`Could not retry`,
                    );
                }}
              >
                <Trans>Send again</Trans>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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
        {pickingSheet ? (
          <DrivePicker
            reconnectPath={`${DRIVE_PAGE}?next=${encodeURIComponent("/app/investors")}`}
            onClose={() => setPickingSheet(false)}
            onPickSheet={(picked) => void switchToSheet(picked)}
          />
        ) : null}
        {confirmDelete ? (
          <ContactDeleteConfirm
            contact={confirmDelete.contact}
            linked={confirmDelete.linked}
            onCancel={() => setConfirmDelete(null)}
            onConfirm={() => {
              const { contact } = confirmDelete;
              setConfirmDelete(null);
              rpc.contacts
                .delete({ id: contact.id })
                .then(() => deleted(contact, false))
                .catch((cause) => notify(errorText(cause, t`Could not delete ${contact.name}`)));
            }}
          />
        ) : null}
        {links ? <CopyLinkDialog links={links} onClose={() => setLinks(null)} /> : null}
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
