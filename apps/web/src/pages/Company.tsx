import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type {
  CompanyEdgeRecord,
  CompanyEntityRecord,
  CompanyEventRecord,
  CompanyFact,
} from "@rakazo/contracts";
import { companyRelationKind } from "@rakazo/core";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@rakazo/ui-web";
import { Building2, Ellipsis } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AskBotButton } from "../components/AskBotButton";
import { SeeAll, useCappedRows } from "../components/CappedList";
import { ErrorNotice } from "../components/ErrorNotice";
import { useFinanceQuery } from "../components/finance/ui";
import { PickFilter, SearchField, usePhone } from "../components/ListControls";
import { PageEmptyState } from "../components/PageEmptyState";
import { PageHeader } from "../components/PageHeader";
import { downloadArtifactBytes } from "../lib/artifact-open";
import { companyDate, companyDateEnd } from "../lib/company-format";
import { companyRelationLabel } from "../lib/company-relation-label";
import { money } from "../lib/finance-format";
import { maskCurrencyWhenHidden, useHideAmounts } from "../lib/hide-amounts-preference";
import { todayIso } from "../lib/legal-format";
import { useListParams } from "../lib/list-params";
import { usePollWhile } from "../lib/page-data";
import { rpc } from "../lib/rpc";
import { useOnReturn } from "../lib/use-refetch-while-open";
import { errorText } from "../lib/user-error";
import { CompanyCalendar } from "./CompanyCalendar";
import { CompanyContext } from "./CompanyContext";
import { CompanyFactDetail } from "./CompanyFactDetail";
import { CompanyHistory } from "./CompanyHistory";
import { CompanyPrivacy } from "./CompanyPrivacy";
import { CompanyRefresh } from "./CompanyRefresh";
import { CompanyReview } from "./CompanyReview";
import type { CompanyRow, CompanySort } from "./company-list";
import {
  COMPANY_SORTS,
  companyOrgTypes,
  companyRelations,
  companyRows,
  companySince,
  companySources,
  DEFAULT_COMPANY_SORT,
} from "./company-list";

// The organisation types the Type filter offers, each named the way the product names it. A
// function, so the labels follow the language in use when the page renders.
const typeLabels = (): Record<string, string> => ({
  investor: t`Investor`,
  customer: t`Customer`,
  vendor: t`Vendor`,
  law_firm: t`Law firm`,
  bank: t`Bank`,
  partner: t`Partner`,
  other: t`Other`,
});

export function CompanyPage({ onAskAgent }: { onAskAgent?: () => void } = {}) {
  useHideAmounts();
  const page = useFinanceQuery(() => rpc.company.page(), [], {
    fallback: t`Could not load company information.`,
  });
  const review = useFinanceQuery(() => rpc.company.review(), [], {
    fallback: t`Could not load company review.`,
  });
  const finance = useFinanceQuery(() => rpc.finance.overview(), []);
  const carta = useFinanceQuery(() => rpc.investors.capTable(), []);
  const [params, setParams] = useSearchParams();
  const view = params.get("view") ?? "overview";
  const [fact, setFact] = useState<CompanyFact | null>(null);
  const [factEditing, setFactEditing] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [refreshOpen, setRefreshOpen] = useState(false);
  const [calendarRevision, setCalendarRevision] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  async function exportMap() {
    setExporting(true);
    setExportError("");
    try {
      const data = await rpc.company.export();
      downloadArtifactBytes(
        "company-map.json",
        "application/json",
        new TextEncoder().encode(JSON.stringify(data, null, 2)),
      );
    } catch (cause) {
      setExportError(errorText(cause));
    } finally {
      setExporting(false);
    }
  }
  const data = page.data;
  const status = data?.latestRun?.status;
  const running =
    status && ["running", "planned", "awaiting_consent", "cancelling"].includes(status);
  const reload = page.reload;
  const reloadReview = review.reload;
  // Poll while the import moves on its own. Awaiting consent waits for the person, so poll
  // nothing and refresh when they come back to the window instead.
  const polling = Boolean(status && ["running", "planned", "cancelling"].includes(status));
  const consenting = status === "awaiting_consent";
  const reloadAll = () => {
    reload();
    reloadReview();
  };
  usePollWhile(polling, 4000, reloadAll);
  useOnReturn(consenting, reloadAll);
  const refreshCompany = () => {
    setCalendarRevision((revision) => revision + 1);
    reload();
    review.reload();
  };
  const people = data?.entities.filter((row) => row.kind === "person") ?? [];
  const organisations = data?.entities.filter((row) => row.kind === "organisation") ?? [];
  const profile = data?.entities.find((row) => row.kind === "company");
  // Unconfirmed low-confidence people are not in the page data, but they are in Review.
  const reviewed = (review.data?.items ?? []).flatMap((item) =>
    item.kind === "fact" && item.fact.kind === "entity" ? [item.fact.record] : [],
  );
  const names = new Map(
    [...(data?.entities ?? []), ...reviewed]
      .filter((row) => row.id !== profile?.id)
      .map((row) => [row.id, row.displayName]),
  );
  const nameOf = (id: string) => names.get(id);
  const roles = (id: string) =>
    data?.edges.filter((row) => row.fromId === id && row.relation === "works_at") ?? [];
  // An organisation's relationships are the edges between it and the company, in either direction.
  const orgRoles = (id: string) => companyRelations(data?.edges ?? [], id, profile?.id);
  const ended = (edge: CompanyEdgeRecord) =>
    Boolean(edge.endsOn && companyDateEnd(edge.endsOn) < todayIso());
  const current = (edges: CompanyEdgeRecord[]) => edges.filter((edge) => !ended(edge));
  const past = (row: CompanyEntityRecord) => roles(row.id).length > 0 && roles(row.id).every(ended);
  const pastOrg = (row: CompanyEntityRecord) =>
    orgRoles(row.id).length > 0 && orgRoles(row.id).every(ended);
  const showEntity = (record: CompanyEntityRecord) => setFact({ kind: "entity", record });
  // Search, source filter and sort live in the URL: ?q=, source, sort, dir.
  const list = useListParams(COMPANY_SORTS, DEFAULT_COMPANY_SORT);
  const filters = {
    q: list.param("q"),
    source: list.param("source"),
    // The type filter only means something on the Organisations tab.
    type: view === "organisations" ? list.param("type") : undefined,
  };
  const visible = (
    entities: CompanyEntityRecord[],
    edgesOf = roles,
    label: (edge: CompanyEdgeRecord) => string | null | undefined = (edge) => edge.role,
    // Rows under a Past disclosure search and sort by the ended relationships they show.
    endedOnly = false,
  ) =>
    companyRows(
      entities.map(
        (entity): CompanyRow => ({
          entity,
          role:
            (endedOnly ? edgesOf(entity.id).filter(ended) : current(edgesOf(entity.id)))
              .map(label)
              .filter(Boolean)
              .join(", ") || null,
          since: companySince(edgesOf(entity.id), todayIso()),
        }),
      ),
      filters,
      list.sort,
    ).map((row) => row.entity);
  // The Since column shows when the current role began, the same date the sort uses.
  const sinceOf = (id: string, edgesOf = roles) => companySince(edgesOf(id), todayIso());
  const sinceStartOf = (id: string, edgesOf = roles) =>
    edgesOf(id).find((edge) => edge.startsOn?.date === sinceOf(id, edgesOf))?.startsOn ?? null;
  const sortHead = (field: CompanySort) => ({
    sortDirection: list.sort.field === field ? list.sort.dir : null,
    onSort: () => list.toggleSort(field),
  });
  const toolbar = (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <SearchField
        name="company-search"
        value={filters.q ?? ""}
        onChange={(value) => list.setParam("q", value)}
        placeholder={t`Search`}
        label={t`Search`}
        className="w-56"
      />
      <PickFilter
        label={t`Source`}
        value={filters.source}
        options={companySources(data?.entities ?? []).map((kind) => [
          kind,
          kind.replaceAll("_", " "),
        ])}
        onChange={(value) => list.setParam("source", value)}
      />
      {view === "organisations" && (
        <PickFilter
          label={t`Type`}
          value={filters.type}
          options={companyOrgTypes(organisations).map((type) => [
            type,
            typeLabels()[type] ?? type.replaceAll("_", " "),
          ])}
          onChange={(value) => list.setParam("type", value)}
        />
      )}
    </div>
  );
  const filtered = Boolean(filters.q || filters.source || filters.type);
  // `shown` is the number of rows the tab actually renders, when it builds them differently.
  const noMatches = (entities: CompanyEntityRecord[], edgesOf = roles, shown?: number) =>
    filtered &&
    (shown ?? visible(entities, edgesOf).length) === 0 && (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          <Trans>No matches</Trans>
        </p>
        <Button variant="outline" size="sm" onClick={() => list.clear("q", "source", "type")}>
          <Trans>Clear filters</Trans>
        </Button>
      </div>
    );
  const empty = (entities: CompanyEntityRecord[], message: ReactNode) =>
    !filtered && entities.length === 0 ? (
      <p className="py-8 text-center text-sm text-muted-foreground">{message}</p>
    ) : null;
  const rows = (
    entities: CompanyEntityRecord[],
    {
      edgesOf = roles,
      roleHeader = <Trans>Role</Trans>,
      label = (edge: CompanyEdgeRecord) => edge.role ?? "—",
      past: endedOnly = false,
    }: {
      edgesOf?: (id: string) => CompanyEdgeRecord[];
      roleHeader?: ReactNode;
      label?: (edge: CompanyEdgeRecord) => string;
      past?: boolean;
    } = {},
  ) =>
    visible(entities, edgesOf, label, endedOnly).length === 0 ? null : (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead {...sortHead("name")}>
              <Trans>Name</Trans>
            </TableHead>
            <TableHead {...sortHead("role")}>{roleHeader}</TableHead>
            <TableHead {...sortHead("since")}>
              <Trans>Since</Trans>
            </TableHead>
            <TableHead>
              <Trans>Sources</Trans>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible(entities, edgesOf, label, endedOnly).map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <Button variant="link" className="h-auto p-0" onClick={() => showEntity(row)}>
                  {maskCurrencyWhenHidden(row.displayName)}
                </Button>
                {row.status !== "confirmed" && (
                  <span className="block text-xs text-muted-foreground">
                    <Trans>Not confirmed</Trans>
                  </span>
                )}
              </TableCell>
              <TableCell>
                {(endedOnly ? edgesOf(row.id).filter(ended) : current(edgesOf(row.id))).map(
                  (edge) => (
                    <Button
                      key={edge.id}
                      variant="link"
                      onClick={() => setFact({ kind: "edge", record: edge })}
                    >
                      {maskCurrencyWhenHidden(label(edge))}
                    </Button>
                  ),
                )}
              </TableCell>
              <TableCell>{companyDate(sinceStartOf(row.id, edgesOf))}</TableCell>
              <TableCell>{row.readOnly ? "—" : row.evidence.length}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  // Organisations list their relationships with the company by relation, not by role text.
  const relationLabels = {
    supplier: t`Supplier`,
    customer: t`Customer`,
    investor: t`Investor`,
    lawFirm: t`Law firm`,
  };
  const orgLabel = (edge: CompanyEdgeRecord) => {
    const kind = profile?.id ? companyRelationKind(edge, profile.id) : null;
    return kind ? relationLabels[kind] : companyRelationLabel(edge.relation);
  };
  const orgRows = {
    edgesOf: orgRoles,
    roleHeader: <Trans>Relationship</Trans>,
    label: orgLabel,
  };
  return (
    <div className="rk-scroll flex-1 overflow-y-auto px-4 py-5 md:px-7">
      <PageHeader
        className="mb-6"
        title={<Trans>Company</Trans>}
        meta={<Trans>Reconstructed</Trans>}
        actions={
          <>
            {onAskAgent && <AskBotButton botName={t`Company agent`} onClick={onAskAgent} />}
            <Link
              to="/app/company/import"
              className="inline-flex items-center text-sm underline underline-offset-4 pointer-coarse:min-h-11 pointer-coarse:px-2"
            >
              <Trans>Import</Trans>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon" aria-label={t`Company actions`} />}
              >
                <Ellipsis className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled={exporting} onClick={() => void exportMap()}>
                  <Trans>Export JSON</Trans>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPrivacy(true)}>
                  <Trans>Privacy</Trans>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRefreshOpen((open) => !open)}>
                  <Trans>Refresh sources</Trans>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
      {exportError && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {exportError}
        </p>
      )}
      {privacy && <CompanyPrivacy onClose={() => setPrivacy(false)} onChanged={refreshCompany} />}
      {refreshOpen && (
        <div className="mb-6">
          <CompanyRefresh onChanged={refreshCompany} />
        </div>
      )}
      <Tabs
        value={view}
        onValueChange={(next) =>
          // Switch tabs without dropping the search, source filter or sort.
          setParams(
            (current) => {
              const updated = new URLSearchParams(current);
              if (next === "overview") updated.delete("view");
              else updated.set("view", String(next));
              if (next !== "context") updated.delete("section");
              // The type filter belongs to Organisations alone.
              if (next !== "organisations") updated.delete("type");
              return updated;
            },
            // Each tab is its own history entry, so Back returns to the previous tab.
          )
        }
      >
        <TabsList>
          <TabsTrigger value="overview">
            <Trans>Overview</Trans>
          </TabsTrigger>
          <TabsTrigger value="context">
            <Trans>Context</Trans>
          </TabsTrigger>
          <TabsTrigger value="people">
            <Trans>People</Trans>
          </TabsTrigger>
          <TabsTrigger value="organisations">
            <Trans>Organisations</Trans>
          </TabsTrigger>
          <TabsTrigger value="history">
            <Trans>History</Trans>
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <Trans>Calendar</Trans>
          </TabsTrigger>
          <TabsTrigger value="review">
            <Trans>Review</Trans>
            {review.data ? ` (${review.data.items.length})` : ""}
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {view === "context" && (
        <div className="mt-6">
          <CompanyContext />
        </div>
      )}
      {view !== "context" && page.error && (
        <ErrorNotice message={page.error} onRetry={reload} className="mt-6" />
      )}
      {view !== "context" && !data && !page.error && <Skeleton className="mt-6 h-64 w-full" />}
      {view !== "context" && data && (
        <div className="mt-6 space-y-8">
          {view === "history" && <CompanyHistory data={data} onOpen={setFact} />}
          {view === "review" && (
            <>
              {review.error && (
                <ErrorNotice message={review.error} onRetry={review.reload} className="" />
              )}
              {!review.data && !review.error && <Skeleton className="h-32 w-full" />}
              {review.data && (
                <CompanyReview
                  nameOf={nameOf}
                  items={review.data.items}
                  onOpen={(next, editing = false) => {
                    setFactEditing(editing);
                    setFact(next);
                  }}
                  onChanged={refreshCompany}
                />
              )}
            </>
          )}
          {view === "calendar" && (
            <CompanyCalendar onOpen={setFact} refreshRevision={calendarRevision} />
          )}
          {data.latestRun &&
            (running ||
              ["paused", "budget_reached", "partial", "failed"].includes(
                data.latestRun.status,
              )) && (
              <p role="status" className="text-sm text-muted-foreground">
                <Link
                  to={`/app/company/import?runId=${data.latestRun.id}`}
                  className="hover:underline"
                >
                  {running ? (
                    <Trans>Import in progress</Trans>
                  ) : ["paused", "budget_reached"].includes(data.latestRun.status) ? (
                    <Trans>Import paused</Trans>
                  ) : data.latestRun.status === "failed" ? (
                    <Trans>Import failed</Trans>
                  ) : (
                    <Trans>Partial import</Trans>
                  )}
                </Link>
              </p>
            )}
          {view === "overview" && data.entities.length === 0 && data.events.length === 0 && (
            <PageEmptyState
              icon={<Building2 className="size-8" strokeWidth={1.6} aria-hidden="true" />}
              title={<Trans>No company facts yet</Trans>}
              description={<Trans>Import from your mail and files to fill this page.</Trans>}
            >
              {!running && (
                <Button render={<Link to="/app/company/import" />}>
                  <Trans>Import</Trans>
                </Button>
              )}
            </PageEmptyState>
          )}
          {view === "overview" && (data.entities.length > 0 || data.events.length > 0) && (
            <>
              {profile && (
                <section className="space-y-3">
                  <Button
                    variant="link"
                    className="h-auto p-0 text-2xl font-semibold"
                    onClick={() => showEntity(profile)}
                  >
                    {maskCurrencyWhenHidden(profile.displayName)}
                  </Button>
                  <p className="text-muted-foreground">
                    {maskCurrencyWhenHidden(String(profile.attrs.description ?? ""))}
                  </p>
                  {Boolean(profile.attrs.whatWeDo) && (
                    <div className="pt-3">
                      <h2 className="mb-2 font-medium">
                        <Trans>What we do</Trans>
                      </h2>
                      <button
                        type="button"
                        className="text-start"
                        onClick={() => showEntity(profile)}
                      >
                        {maskCurrencyWhenHidden(String(profile.attrs.whatWeDo))}
                      </button>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {profile.evidence.length} <Trans>Sources</Trans>
                      </p>
                    </div>
                  )}
                </section>
              )}
              <div className="grid grid-cols-2 gap-6 border-y py-5 md:grid-cols-4">
                <div>
                  <span className="text-xs text-muted-foreground">
                    <Trans>People</Trans>
                  </span>
                  <p className="text-2xl">{people.length}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">
                    <Trans>Organisations</Trans>
                  </span>
                  <p className="text-2xl">{organisations.length}</p>
                </div>
                {finance.data?.hasCashAccounts && (
                  <Link to="/app/finance">
                    <span className="text-xs text-muted-foreground">
                      <Trans>Cash</Trans>
                    </span>
                    <p className="text-2xl">{money(finance.data.cash.cashCents)}</p>
                  </Link>
                )}
                {carta.data?.snapshot?.amountRaisedUsd != null && (
                  <Link to="/app/cap-table">
                    <span className="text-xs text-muted-foreground">
                      <Trans>Raised</Trans>
                    </span>
                    <p className="text-2xl">{money(carta.data.snapshot.amountRaisedUsd * 100)}</p>
                  </Link>
                )}
              </div>
              <EventList
                title={<Trans>Next dates</Trans>}
                events={data.events.filter(
                  (event) => event.occursOn && companyDateEnd(event.occursOn) >= todayIso(),
                )}
                onOpen={(event) => setFact({ kind: "event", record: event })}
              />
              <EventList
                title={<Trans>Latest events</Trans>}
                events={data.events
                  .filter((event) => event.occursOn && companyDateEnd(event.occursOn) <= todayIso())
                  .reverse()}
                onOpen={(event) => setFact({ kind: "event", record: event })}
              />
            </>
          )}
          {view === "people" && (
            <>
              {toolbar}
              {noMatches(
                people,
                roles,
                visible(people.filter((row) => !past(row))).length +
                  visible(people.filter(past), roles, undefined, true).length,
              )}
              {empty(people, <Trans>No people yet</Trans>)}
              {rows(people.filter((row) => !past(row)))}
              {visible(people.filter(past), roles, undefined, true).length > 0 && (
                <details>
                  <summary className="cursor-pointer font-medium">
                    <Trans>Past members</Trans>
                  </summary>
                  {rows(people.filter(past), { past: true })}
                </details>
              )}
            </>
          )}
          {view === "organisations" && (
            <>
              {toolbar}
              {noMatches(
                organisations,
                orgRoles,
                visible(
                  organisations.filter((row) => !pastOrg(row)),
                  orgRoles,
                  orgLabel,
                ).length + visible(organisations.filter(pastOrg), orgRoles, orgLabel, true).length,
              )}
              {empty(organisations, <Trans>No organisations yet</Trans>)}
              {rows(
                organisations.filter((row) => !pastOrg(row)),
                orgRows,
              )}
              {visible(organisations.filter(pastOrg), orgRoles, orgLabel, true).length > 0 && (
                <details>
                  <summary className="cursor-pointer font-medium">
                    <Trans>Past relationships</Trans>
                  </summary>
                  {rows(organisations.filter(pastOrg), { ...orgRows, past: true })}
                </details>
              )}
            </>
          )}
        </div>
      )}
      {fact && (
        <CompanyFactDetail
          key={`${fact.kind}:${fact.record.id}`}
          initialEditing={factEditing}
          fact={
            fact.kind === "entity"
              ? {
                  ...fact,
                  record: {
                    ...fact.record,
                    edges:
                      data?.edges.filter(
                        (edge) => edge.fromId === fact.record.id || edge.toId === fact.record.id,
                      ) ?? [],
                  },
                }
              : fact
          }
          onClose={() => {
            setFact(null);
            setFactEditing(false);
          }}
          onChanged={() => {
            setFact(null);
            setFactEditing(false);
            refreshCompany();
          }}
        />
      )}
    </div>
  );
}

/** Dates on the overview: the first 5, or 3 on a phone, then See all opens the Calendar tab. */
function EventList({
  title,
  events,
  onOpen,
}: {
  title: ReactNode;
  events: CompanyEventRecord[];
  onOpen: (event: CompanyEventRecord) => void;
}) {
  // Wide screens show the first 5, as before; a phone shows 3 and opens the rest in place.
  const phone = usePhone();
  const list = useCappedRows(phone ? events : events.slice(0, 5));
  return (
    <section>
      <h2 className="mb-3 font-medium">{title}</h2>
      {list.rows.map((event) => (
        <button
          type="button"
          key={event.id}
          className="flex w-full justify-between border-b py-3 text-start"
          onClick={() => onOpen(event)}
        >
          <span>{maskCurrencyWhenHidden(event.title)}</span>
          <span className="text-muted-foreground">{companyDate(event.occursOn)}</span>
        </button>
      ))}
      <div className="mt-2 flex justify-end">
        <SeeAll list={list} />
      </div>
    </section>
  );
}
