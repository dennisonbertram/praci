import { i18n } from "@lingui/core";
import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type {
  AuditRequest,
  CapTableSource,
  CapTableState,
  Contact,
  ContactKind,
  InvestorReminderCadence,
  InvestorUpdate,
  MailAccountSummary,
  PortalLink,
  Safe,
} from "@rakazo/contracts";
import { isCartaEndpoint } from "@rakazo/contracts";
import { capTableMath, countedSafes, equityRaisedUsd, isSafeSecurity } from "@rakazo/core";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
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
  notificationToastManager,
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
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AskBotButton } from "../components/AskBotButton";
import { useContactDelete } from "../components/ContactDeleteConfirm";
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
import { ErrorNotice } from "../components/ErrorNotice";
import { CustomConnectionDialog } from "../components/integrations/CustomConnectionDialog";
import { useIntegrations } from "../components/integrations/useIntegrations";
import { ActionItems } from "../components/investors/ActionItems";
import { PickFilter, SearchField, SortControl } from "../components/ListControls";
import { PAGE_GUTTER_X, PageHeader } from "../components/PageHeader";
import { RowsSkeleton } from "../components/RowsSkeleton";
import { SectionCard } from "../components/SectionCard";
import { hasConnectedCarta } from "../lib/carta-agent";
import { emailBreaks } from "../lib/email-breaks";
import { shareCount, shortDay, usdFigure } from "../lib/finance-format";
import { useHideAmounts } from "../lib/hide-amounts-preference";
import { FIRST_PARTY_MCP } from "../lib/integrations";
import {
  DEFAULT_UPDATE_SORT,
  filterUpdates,
  sortUpdates,
  UPDATE_SORTS,
  updateStatusNames,
} from "../lib/investor-updates-list";
import { sortBy, useListParams } from "../lib/list-params";
import { UNDO_SEND_MS } from "../lib/outbox";
import { usePageQuery, usePollWhile, useReloadWhenAgentIdle } from "../lib/page-data";
import { rpc } from "../lib/rpc";
import { SAVED_ROW_CLASS, useContactNotices, useWithoutDeleted } from "../lib/use-contact-notices";
import { useRefetchWhileOpen } from "../lib/use-refetch-while-open";
import { errorText } from "../lib/user-error";

/** The Data room folder the cap table's documents are filed into. */
const CAP_TABLE_FOLDER = ["Finance", "Cap Table"];

type Snapshot = NonNullable<CapTableState["snapshot"]>;

/** The contact tabs: the people this page's relationships involve. */
const CONTACT_TABS = ["investor", "board"] as const satisfies readonly ContactKind[];
type ContactTab = (typeof CONTACT_TABS)[number];
const parseTab = (value: string | null): ContactTab =>
  CONTACT_TABS.find((tab) => tab === value) ?? "investor";

/** The Contacts section's sorts; name ascending is the default. */
const CONTACT_SORTS = ["name", "organization", "check"] as const;

/** The page sections, one tab each; the first is the default. */
const SECTIONS = ["cap-table", "updates", "contacts"] as const;
type Section = (typeof SECTIONS)[number];
const parseSection = (value: string | null): Section =>
  SECTIONS.find((section) => section === value) ?? "cap-table";

/** How often the page asks again while the Carta agent is still reading. */
const POLL_MS = 3000;
/** How often an idle page checks for a change made elsewhere, such as in another tab. */
const IDLE_POLL_MS = 30_000;
/** How often the page asks again while an investor update is being sent. */
const SENDING_POLL_MS = 2000;
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

function Figure({ title, value, hint }: { title: string; value: ReactNode; hint?: ReactNode }) {
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
  safesLoaded,
  safesFailed,
  syncing,
  onRetry,
  ledger = false,
}: {
  snapshot: Snapshot;
  /** The ledger is the record: its raised total already counts its SAFEs and notes. */
  ledger?: boolean;
  safes: readonly Safe[];
  safesLoaded: boolean;
  safesFailed: boolean;
  syncing: boolean;
  onRetry: () => void;
}) {
  useHideAmounts();
  const a = snapshot.latest409a;
  // Nothing known to add up shows a dash, not $0. Table rows that are SAFEs are not counted: the
  // SAFE list is the record.
  const counted = countedSafes(safes);
  // Raised money is Funded only; Sent and Signed SAFEs are promises, shown apart as committed.
  const sumUsd = (status: Safe["status"][]) =>
    counted
      .filter((safe) => status.includes(safe.status))
      .reduce((sum, safe) => sum + safe.amountCents / 100, 0);
  const committedUsd = sumUsd(["sent", "signed"]);
  // A failed SAFE request would make the total look complete when it is not.
  const raisedUsd = ledger ? snapshot.amountRaisedUsd : equityRaisedUsd(snapshot.holders, safes);
  const raised = (ledger || !safesFailed) && raisedUsd != null ? usd(raisedUsd) : DASH;
  // Until the first SAFE list answers, a dash would read as "nothing raised".
  // A running sync is still filling in the figures, so an unknown total is not final either.
  const loading = !ledger && ((!safesLoaded && !safesFailed) || (syncing && raisedUsd == null));
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
        value={loading ? <Skeleton className="h-6 w-24" aria-busy="true" /> : raised}
        hint={
          safesFailed ? (
            <Button variant="link" size="xs" className="h-auto p-0" onClick={onRetry}>
              <Trans>Try again</Trans>
            </Button>
          ) : committedUsd > 0 ? (
            t`${usd(committedUsd)} committed`
          ) : counted.length > 0 ? (
            plural(counted.length, { one: "# SAFE", other: "# SAFEs" })
          ) : undefined
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
  // Board rows are labelled because investor and board updates share the default subject; investor
  // updates get no audience word: this page is Investors, so it would repeat the title.
  const parts: string[] = [];
  if (update.audience === "board") parts.push(t`Board`);
  if (partly) {
    // The problem first, so a narrow row truncates the date, not the problem.
    const problem = problemText(update);
    if (problem) parts.push(problem);
    if (update.sentAt) parts.push(t`Sent ${day(update.sentAt)}`);
  } else if (update.status === "draft") {
    parts.push(t`Drafted ${day(update.createdAt)}`);
  } else if (!sending) {
    parts.push(
      update.status === "posted" && update.sentAt
        ? t`Posted ${day(update.sentAt)}`
        : update.sentAt
          ? t`Sent ${day(update.sentAt)}`
          : update.period,
    );
  }
  const subline = parts.join(" · ");
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
        {subline ? (
          <span className="block truncate text-xs text-muted-foreground">{subline}</span>
        ) : null}
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
  // The contacts list shares this page's URL, so this one names its params apart.
  const list = useListParams(UPDATE_SORTS, DEFAULT_UPDATE_SORT, "updates-");
  const status = list.param("updates-status");
  const shown = sortUpdates(filterUpdates(updates ?? [], status), list.sort);
  const sortNames = { date: t`Date`, subject: t`Subject` };
  const statusNames = updateStatusNames();
  const statuses = [...new Set((updates ?? []).map((update) => update.status))];
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
      {failed && updates === null ? (
        <ErrorNotice message={t`Could not load updates`} onRetry={onReload} />
      ) : updates === null ? (
        <Skeleton className="h-9 w-full" aria-busy="true" />
      ) : updates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          <Trans>No updates yet</Trans>
        </p>
      ) : (
        <>
          {updates.length > 1 ? (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <PickFilter
                label={t`Status`}
                value={status}
                options={statuses.map((value) => [value, statusNames[value]])}
                onChange={(value) => list.setParam("updates-status", value)}
              />
              <SortControl
                fields={UPDATE_SORTS.map((field) => [field, sortNames[field]])}
                field={list.sort.field}
                fieldLabel={sortNames[list.sort.field]}
                direction={list.sort.dir}
                onField={(field) => list.setSort({ field, dir: "asc" })}
                onDirection={(dir) => list.setSort({ field: list.sort.field, dir })}
              />
            </div>
          ) : null}
          <ul>
            {shown.map((update) => (
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
          {shown.length === 0 ? (
            <p className="flex items-center gap-3 text-sm text-muted-foreground">
              <Trans>No matches</Trans>
              <Button variant="outline" size="sm" onClick={() => list.clear("updates-status")}>
                <Trans>Clear filters</Trans>
              </Button>
            </p>
          ) : null}
        </>
      )}
    </SectionCard>
  );
}

/** The Portal column: when the latest link went out, when it was opened, or that access was revoked. */
function portalLabel(contact: Contact): string | null {
  const day = (iso: string) => shortDay(iso.slice(0, 10), new Date(), i18n.locale || "en");
  const { portalLinkSentAt: sent, portalLastSeenAt: seen, portalBlockedAt: blocked } = contact;
  if (blocked) return t`Revoked`;
  if (seen && !sent) return t`Unblocked · send a link`;
  if (seen && sent && seen >= sent) return t`Opened ${day(seen)}`;
  if (sent) return t`Invited ${day(sent)}`;
  return null;
}

/** One contact in the Contacts section: name, organization and email, with Edit and Delete. */
function ContactRow({
  contact,
  saved,
  portal,
  onOpen,
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
  /** A row tap opens the contact's page; Edit stays in the row menu. */
  onOpen: () => void;
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
        className="min-w-0 flex-1 rounded-sm px-2 py-1.5 text-start outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        onClick={onOpen}
      >
        <span className="block truncate text-sm font-medium" title={contact.name}>
          {contact.name}
        </span>
        {/* The email is the identifier, so the organization gives way first. */}
        <span className="flex flex-wrap gap-x-1 text-xs text-muted-foreground">
          {contact.organization ? (
            <span className="max-w-full truncate" title={contact.organization}>
              {contact.organization}
            </span>
          ) : null}
          {contact.organization && contact.email ? <span aria-hidden="true">·</span> : null}
          {contact.email ? (
            <span className="min-w-0 break-words" title={contact.email}>
              {emailBreaks(contact.email)}
            </span>
          ) : null}
        </span>
      </button>
      {portal && portalLabel(contact) ? (
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
            <Button
              variant="ghost"
              size="icon-sm"
              className="pointer-coarse:size-11"
              aria-label={t`Actions for ${contact.name}`}
            />
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
  const contactsQuery = usePageQuery(() => rpc.contacts.list({}), [], {
    fallback: t`Could not load contacts`,
  });
  const fetched = contactsQuery.data;
  const contacts = useWithoutDeleted(fetched);
  // A failed background refresh keeps the list on screen; the next focus or tick tries again.
  const error = fetched ? "" : contactsQuery.error;
  const load = contactsQuery.reload;
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
  const section = parseSection(params.get("tab"));
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
  const list = useListParams(CONTACT_SORTS, { field: "name", dir: "asc" });
  const [editing, setEditing] = useState<Contact | Prefill | "new" | null>(null);
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

  const container = useRef<HTMLDivElement>(null);
  const { notify, savedId, setSavedId, deleted } = useContactNotices(
    () => load(),
    container,
    contacts,
  );
  const { remove: deleteContact, confirm: deleteConfirm } = useContactDelete(deleted, notify);

  const [updates, setUpdates] = useState<InvestorUpdate[] | null>(null);
  const [updatesFailed, setUpdatesFailed] = useState(false);
  const latestUpdates = useRef(0);
  const [cadence, setCadence] = useState<InvestorReminderCadence>("monthly");
  const latestReminder = useRef(0);
  const confirmedCadence = useRef<InvestorReminderCadence>("monthly");
  const [deletingUpdate, setDeletingUpdate] = useState<InvestorUpdate | null>(null);
  const [resending, setResending] = useState<InvestorUpdate | null>(null);
  const statuses = useRef(new Map<string, string>());
  const loadUpdates = useCallback(() => {
    const request = ++latestUpdates.current;
    rpc.investors.updates
      .list()
      .then((list) => {
        if (request !== latestUpdates.current) return;
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
      .catch(() => {
        if (request === latestUpdates.current) setUpdatesFailed(true);
      });
  }, []);
  useEffect(loadUpdates, [loadUpdates]);
  useEffect(() => {
    const request = latestReminder.current;
    rpc.investors
      .reminder({})
      .then((result) => {
        if (request !== latestReminder.current) return;
        confirmedCadence.current = result.cadence;
        setCadence(result.cadence);
      })
      .catch(() => undefined);
  }, []);
  const [audits, setAudits] = useState<AuditRequest[]>([]);
  const [auditsFailed, setAuditsFailed] = useState(false);
  const [auditsHaveData, setAuditsHaveData] = useState(false);
  const latestAudits = useRef(0);
  const [showDone, setShowDone] = useState(false);
  const loadAudits = useCallback(() => {
    const request = ++latestAudits.current;
    rpc.investors.audits
      .list({ includeDone: true })
      .then((list) => {
        if (request !== latestAudits.current) return;
        setAudits(list ?? []);
        setAuditsHaveData(true);
        setAuditsFailed(false);
      })
      // The list is an extra on this page: a failed load leaves the last one.
      .catch(() => {
        if (request === latestAudits.current) setAuditsFailed(true);
      });
  }, []);
  useEffect(loadAudits, [loadAudits]);
  // A Draft ready row links to the Gmail thread its draft is in; the account's address picks /u/.
  const anyDrafted = audits.some((a) => a.status === "drafted");
  const [mailAccounts, setMailAccounts] = useState<readonly MailAccountSummary[]>([]);
  useEffect(() => {
    if (!anyDrafted) return;
    let current = true;
    rpc.investors.updates
      .accounts()
      .then((list) => {
        if (current) setMailAccounts(list ?? []);
      })
      // The Gmail link falls back to /u/0/; a failed read needs no error or retry.
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [anyDrafted]);
  const anyDrafting = audits.some((a) => a.drafting);
  usePollWhile(anyDrafting, POLL_MS, loadAudits);
  // Rows whose draft this page started: "starting" shows Drafting at once, before the server says
  // so; "running" has been seen drafting. A run that ends with the request still open made no
  // draft, and the row says so ("ended"); its reason is in the Ask panel.
  const [draftPhase, setDraftPhase] = useState<Record<string, "starting" | "running" | "ended">>(
    {},
  );
  useEffect(() => {
    setDraftPhase((phase) => {
      let next = phase;
      for (const [id, state] of Object.entries(phase)) {
        const audit = audits.find((a) => a.id === id);
        if (audit?.status !== "open") {
          next = { ...next };
          delete next[id];
        } else if (audit.drafting && state !== "running") next = { ...next, [id]: "running" };
        else if (!audit.drafting && state === "running") next = { ...next, [id]: "ended" };
      }
      return next;
    });
  }, [audits]);
  const draftAudit = (audit: AuditRequest) => {
    // A repeat click while the draft runs opens the panel instead of starting another.
    const phase = draftPhase[audit.id];
    if (audit.drafting || phase === "starting" || phase === "running") return onShowAgent?.();
    setDraftPhase((p) => ({ ...p, [audit.id]: "starting" }));
    rpc.investors.audits
      .draft({ id: audit.id })
      .then((started) => {
        // Keep the started row so polling runs even if the list reads that follow fail.
        setAudits((list) => list.map((a) => (a.id === started.id ? started : a)));
        setDraftPhase((p) => {
          const { [audit.id]: _, ...rest } = p;
          return started.drafting ? { ...rest, [audit.id]: "running" } : rest;
        });
        loadAudits();
        onShowAgent?.();
      })
      .catch((cause) => {
        setDraftPhase((p) => {
          const { [audit.id]: _, ...rest } = p;
          return rest;
        });
        notify(errorText(cause, t`Could not start the draft`));
        loadAudits();
      });
  };
  const auditAction = (call: () => Promise<unknown>, failure: string, then?: () => void) =>
    call()
      .then(() => {
        loadAudits();
        then?.();
      })
      .catch((cause) => {
        notify(errorText(cause, failure));
        loadAudits();
      });
  // A Dismiss hides the row at once and waits out an Undo window before the request is closed.
  const [dismissHeld, setDismissHeld] = useState<ReadonlySet<string>>(new Set());
  const dismissTimers = useRef(
    new Map<string, { timer: ReturnType<typeof setTimeout>; toastId: string }>(),
  );
  const dropDismissHeld = (id: string) =>
    setDismissHeld((ids) => {
      const next = new Set(ids);
      next.delete(id);
      return next;
    });
  const dismissAudit = (audit: AuditRequest) => {
    const toastId = notify(t`Dismissed ${audit.fund}.`, {
      label: t`Undo`,
      onClick: () => {
        const held = dismissTimers.current.get(audit.id);
        if (!held) return;
        clearTimeout(held.timer);
        dismissTimers.current.delete(audit.id);
        dropDismissHeld(audit.id);
      },
    });
    dismissTimers.current.set(audit.id, {
      toastId,
      timer: setTimeout(() => {
        dismissTimers.current.delete(audit.id);
        dropDismissHeld(audit.id);
        void auditAction(
          () => rpc.investors.audits.update({ id: audit.id, status: "dismissed" }),
          t`Could not update the request`,
        );
      }, UNDO_SEND_MS),
    });
    setDismissHeld((ids) => new Set(ids).add(audit.id));
  };
  // Leaving inside the window dismisses at once; the toast goes with the page.
  useEffect(
    () => () => {
      for (const [id, held] of dismissTimers.current) {
        clearTimeout(held.timer);
        notificationToastManager.close(held.toastId);
        void rpc.investors.audits.update({ id, status: "dismissed" }).catch(() => undefined);
      }
      dismissTimers.current.clear();
    },
    [],
  );
  const anySending = updates?.some((u) => u.status === "sending") ?? false;
  usePollWhile(anySending, SENDING_POLL_MS, loadUpdates);

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
    const request = ++latestReminder.current;
    setCadence(next);
    rpc.investors
      .reminder({ cadence: next })
      .then((result) => {
        if (request !== latestReminder.current) return;
        confirmedCadence.current = result.cadence;
        setCadence(result.cadence);
      })
      .catch((cause) => {
        if (request !== latestReminder.current) return;
        setCadence(confirmedCadence.current);
        notify(errorText(cause, t`Could not change the reminder`));
      });
  };

  // The header slot of the Cap table card, where the typed-in table shows Saved and Not saved.
  const [statusSlot, setStatusSlot] = useState<HTMLElement | null>(null);
  const [capFailed, setCapFailed] = useState(false);
  const [safes, setSafes] = useState<Safe[]>([]);
  const [safesFailed, setSafesFailed] = useState(false);
  const [safesLoaded, setSafesLoaded] = useState(false);
  const latestCap = useRef(0);
  const capHasData = useRef(false);
  // Every update of the table (load, save, source change) decides whether a failed refresh can
  // keep showing it.
  capHasData.current = cap?.snapshot != null;
  // Once the ledger has data it is the record: this tab shows it read-only.
  // null until the ledger check answers: the typed-in editor must not show over a ledger snapshot.
  const [ledgerRecord, setLedgerRecord] = useState<boolean | null>(null);
  const loadCap = useCallback(() => {
    const request = ++latestCap.current;
    void rpc.equity
      .overview({})
      .then((overview) => {
        if (request === latestCap.current) setLedgerRecord(overview.hasLedger);
      })
      .catch(() => {
        if (request === latestCap.current) setLedgerRecord(null);
      });
    // The SAFE rows under the table are secondary: if they cannot load, the table still shows.
    // One quiet retry, so a single dropped request does not show a dash.
    void rpc.fundraising.safes
      .list()
      .catch(() => rpc.fundraising.safes.list())
      .then((rows) => {
        if (request !== latestCap.current) return;
        setSafes(rows ?? []);
        setSafesLoaded(true);
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
        if (request === latestCap.current && !capHasData.current) setCapFailed(true);
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
  const refreshWhileOpen = useCallback(() => {
    load();
    loadUpdates();
    loadAudits();
    void loadCap();
  }, [load, loadAudits, loadCap, loadUpdates]);
  useReloadWhenAgentIdle(agentBusy, refreshWhileOpen);
  useRefetchWhileOpen(true, refreshWhileOpen);
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
    return () => {
      clearInterval(timer);
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
  const ofTab = allContacts.filter((c) => c.kind === tab);
  const hasCheck = ofTab.some((c) => c.checkSizeCents != null);
  const { field: sortField, dir: sortDir } = list.sort;
  const sortKey = (c: Contact) =>
    sortField === "name"
      ? c.name
      : sortField === "organization"
        ? c.organization || null
        : (c.checkSizeCents ?? null);
  const shown = sortBy(
    ofTab.filter(
      (c) =>
        !needle ||
        [c.name, c.organization, c.email].some((text) => text?.toLowerCase().includes(needle)),
    ),
    sortKey,
    sortDir,
  );
  const sortNames: Record<(typeof CONTACT_SORTS)[number], string> = {
    name: t`Name`,
    organization: t`Organization`,
    check: t`Check size`,
  };
  const sortFields = CONTACT_SORTS.filter((f) => f === "name" || f === "organization" || hasCheck);
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
          : t`${ledgerRecord ? t`Cap table` : names[source]} · as of ${shortDay(snapshot.asOf, new Date(), i18n.locale || "en")}`
      : null;
  const canRefresh =
    (source === "carta" && cartaConnected && !(needsModel && neverRead)) || source === "sheet";
  const otherSources = (["carta", "sheet", "native"] as const).filter((name) => name !== source);

  return (
    <div className="@container/bd flex min-h-0 min-w-0 flex-1 flex-col">
      <div className={`${PAGE_GUTTER_X} pt-2`}>
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
                {ledgerRecord ? (
                  // The ledger is the record: there is no other source to refresh or switch to.
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {sourceLabel}
                  </span>
                ) : (
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
                )}
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
          <ErrorNotice
            message={t`Could not check whether Carta is connected.`}
            onRetry={() => setServersSeq((n) => n + 1)}
            className="mb-5"
          />
        ) : null}

        {capFailed ? (
          <ErrorNotice
            message={t`Could not load the cap table, so holdings are missing.`}
            onRetry={() => void loadCap()}
            className="mb-4"
          />
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
          <Tabs
            value={section}
            onValueChange={(next) =>
              setParam("tab", next === SECTIONS[0] ? undefined : String(next))
            }
          >
            <TabsList className="max-w-full rounded-full" aria-label={t`Sections`}>
              <TabsTrigger value="cap-table" className="rounded-full px-3">
                <Trans>Cap table</Trans>
              </TabsTrigger>
              <TabsTrigger value="updates" className="rounded-full px-3">
                <Trans>Updates</Trans>
              </TabsTrigger>
              <TabsTrigger value="contacts" className="rounded-full px-3">
                <Trans>Contacts</Trans>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <ActionItems
            drafts={(updates ?? []).filter((u) => u.status === "draft")}
            audits={audits
              .filter((a) => !dismissHeld.has(a.id))
              .filter((a) => a.status !== "done" || (showDone && section === "updates"))
              .map((a) => ({ ...a, drafting: a.drafting || draftPhase[a.id] === "starting" }))}
            draftEnded={new Set(Object.keys(draftPhase).filter((id) => draftPhase[id] === "ended"))}
            mailAccounts={mailAccounts}
            onOpen={(update) => navigate(`/app/investors/updates/${update.id}`)}
            onDraftAudit={draftAudit}
            onCloseAudit={(audit, status) =>
              status === "dismissed"
                ? dismissAudit(audit)
                : void auditAction(
                    () => rpc.investors.audits.update({ id: audit.id, status }),
                    t`Could not update the request`,
                  )
            }
          />
          {auditsFailed && !auditsHaveData ? (
            <ErrorNotice message={t`Could not load investor requests`} onRetry={loadAudits} />
          ) : null}

          {section === "cap-table" ? (
            !serversChecked || (cap === null && !capFailed) ? (
              <RowsSkeleton variant="bars" rows={3} />
            ) : (
              <>
                {/* cap table area: the ledger page has its own address. */}
                <div className="mb-2 flex justify-end">
                  <Link
                    to="/app/cap-table"
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Trans>Open cap table</Trans>
                  </Link>
                </div>
                <SectionCard
                  title={t`Cap table`}
                  actions={<span ref={setStatusSlot} className="flex items-center gap-2 text-xs" />}
                >
                  {snapshot && math ? (
                    <>
                      {snapshot.holders.length === 0 &&
                      !snapshot.fullyDilutedShares &&
                      !snapshot.latest409a &&
                      countedSafes(safes).length === 0 ? null : (
                        <Summary
                          snapshot={snapshot}
                          safes={safes}
                          safesLoaded={safesLoaded}
                          safesFailed={safesFailed}
                          syncing={syncing}
                          onRetry={() => void loadCap()}
                          ledger={ledgerRecord === true}
                        />
                      )}
                      {snapshot.source === "native" && ledgerRecord === null ? (
                        <div className="flex items-center gap-3 py-2">
                          <Skeleton className="h-24 flex-1" />
                          <Button size="sm" variant="outline" onClick={() => void loadCap()}>
                            <Trans>Retry</Trans>
                          </Button>
                        </div>
                      ) : snapshot.source === "native" && !ledgerRecord ? (
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
                                snapshot.holders.find((holder) => holder.name === row.name)
                                  ?.email ?? null,
                              )
                            }
                            onOpenContact={openContact}
                          />
                        </div>
                      )}
                      <SafeRows safes={safes} />
                    </>
                  ) : reading ? (
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
                </SectionCard>
                <FolderDocuments folderPath={CAP_TABLE_FOLDER} />
              </>
            )
          ) : null}

          {section === "updates" ? (
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
          ) : null}

          {section === "contacts" ? (
            <SectionCard title={t`Contacts`}>
              <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                <Tabs
                  className="max-sm:basis-full"
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
                  <>
                    <SearchField
                      className="w-full @md/bd:ms-auto @md/bd:w-56"
                      value={query}
                      onChange={(next) => setParam("q", next || undefined)}
                      placeholder={t`Search`}
                      label={t`Search`}
                      name="contact-search"
                    />
                    <SortControl
                      fields={sortFields.map((f) => [f, sortNames[f]])}
                      field={sortField}
                      fieldLabel={sortNames[sortField]}
                      direction={sortDir}
                      onField={(next) => list.setSort({ field: next, dir: "asc" })}
                      onDirection={(next) => list.setSort({ field: sortField, dir: next })}
                    />
                  </>
                ) : null}
              </div>
              {error ? (
                <ErrorNotice message={error} onRetry={load} className="" />
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
                    <Button variant="outline" size="sm" onClick={() => list.clear("q")}>
                      <Trans>Clear filters</Trans>
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    <Trans>No contacts yet</Trans>
                  </p>
                )
              ) : (
                <ul>
                  {shown.map((contact) => (
                    <ContactRow
                      key={contact.id}
                      contact={contact}
                      saved={contact.id === savedId}
                      portal={tab === "investor"}
                      onOpen={() => navigate(`/app/contacts/${contact.id}`)}
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
          ) : null}
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
              {deletingUpdate?.audience === "investors" && deletingUpdate.status !== "draft" ? (
                <AlertDialogDescription>
                  <Trans>Investors will no longer see it on the portal.</Trans>
                </AlertDialogDescription>
              ) : null}
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
        {deleteConfirm}
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
