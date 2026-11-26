import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { DevinSessionView } from "@rakazo/contracts";
import { devinSessionUrl } from "@rakazo/contracts";
import {
  Button,
  cn,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
} from "@rakazo/ui-web";
import { ExternalLink } from "lucide-react";
import { PickFilter, SearchField, SortControl } from "../../components/ListControls";
import type { DevinSection } from "../../lib/devin-format";
import {
  kindSection,
  prLabel,
  sourceLabel,
  statusLabel,
  waitingLabel,
} from "../../lib/devin-format";
import { useListParams } from "../../lib/list-params";
import { formatRelativeTime } from "../../lib/relative-time";
import type { SessionSort } from "./session-list";
import { DEFAULT_SESSION_SORT, filterSessions, SESSION_SORTS, sortSessions } from "./session-list";

const SECTIONS: DevinSection[] = ["needs_you", "working", "earlier"];
const dash = "—";

const sectionName = (section: DevinSection) =>
  ({ needs_you: t`Needs you`, working: t`Working`, earlier: t`Earlier` })[section];

/** Needs you and error rows say how long Devin has been waiting; the others how long ago they changed. */
function updatedLabel(session: DevinSessionView): string {
  return kindSection(session.kind) === "needs_you"
    ? waitingLabel(session.updatedAt)
    : formatRelativeTime(session.updatedAt);
}

function Badge({ session, muted }: { session: DevinSessionView; muted: boolean }) {
  return (
    <span
      title={session.statusDetail ?? undefined}
      className={cn(
        "whitespace-nowrap rounded-full border border-border px-2 py-0.5 text-xs",
        !muted && session.kind === "needs_you" && "border-warning text-warning",
        !muted && session.kind === "error" && "border-destructive text-destructive",
        !muted && session.kind === "working" && "border-foreground",
        muted && "text-muted-foreground",
      )}
    >
      {statusLabel(session.kind, session.status)}
    </span>
  );
}

/**
 * The row's one interactive element. Its ::after covers the whole row (the row is `relative`), so
 * the row opens the session in Devin while the title stays the only link to tab to or announce.
 */
function Title({ session }: { session: DevinSessionView }) {
  const title = session.title || t`Untitled session`;
  const cut = title.lastIndexOf(" ") + 1;
  return (
    <a
      href={devinSessionUrl(session.id)}
      target="_blank"
      rel="noreferrer"
      className="font-medium outline-none after:absolute after:inset-0 hover:underline focus-visible:underline"
    >
      {title.slice(0, cut)}
      {/* The glyph stays with the last word so it never sits alone on a line. */}
      <span className="whitespace-nowrap">
        {title.slice(cut)}
        <ExternalLink
          aria-hidden
          className="ms-1 inline size-3 align-[-1px] text-muted-foreground"
        />
        <span className="sr-only">
          {" "}
          <Trans>(opens in Devin)</Trans>
        </span>
      </span>
    </a>
  );
}

function Question({ session }: { session: DevinSessionView }) {
  if (session.kind !== "needs_you" || !session.question) return null;
  // Shown as stored (the server cuts it to 500 characters); no display clamp.
  return (
    <p className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">
      {session.question}
    </p>
  );
}

function PullRequests({ session }: { session: DevinSessionView }) {
  if (session.prs.length === 0) return <>{dash}</>;
  return (
    <>
      {session.prs.map((pr) => {
        const { ref, state } = prLabel(pr);
        return (
          <div key={pr.url}>
            <div className="break-words">{ref}</div>
            <div className="text-xs text-muted-foreground">{state}</div>
          </div>
        );
      })}
    </>
  );
}

/** "acme/api#212 open · 1h ago", with several pull requests comma-separated. */
function summary(session: DevinSessionView): string {
  const prs = session.prs
    .map((pr) => {
      const { ref, state } = prLabel(pr);
      return state ? `${ref} ${state}` : ref;
    })
    .join(", ");
  return [prs, updatedLabel(session)].filter(Boolean).join(" · ");
}

/**
 * Devin's sessions in three sections. Wide, a table with fixed column widths; below the container's
 * `@2xl` (672 px), a compact list. The title is each row's one link. `muted` greys rows and badges
 * while the connection is paused.
 */
export function DevinSessions({
  sessions,
  muted = false,
}: {
  sessions: DevinSessionView[];
  muted?: boolean;
}) {
  // Search, filters and sort live in the URL: ?q=, status, source, sort, dir.
  const list = useListParams(SESSION_SORTS, DEFAULT_SESSION_SORT);
  const filters = {
    q: list.param("q"),
    status: list.param("status"),
    source: list.param("source"),
  };
  const filtered = Object.values(filters).some(Boolean);
  const shown = sortSessions(filterSessions(sessions, filters), list.sort, (s) =>
    statusLabel(s.kind, s.status),
  );
  const groups = SECTIONS.map((section) => ({
    section,
    rows: shown.filter((s) => kindSection(s.kind) === section),
  })).filter((group) => group.rows.length > 0);
  const options = (pick: (s: DevinSessionView) => [string, string]): [string, string][] => [
    ...new Map(sessions.map(pick)),
  ];
  const sortNames: Record<SessionSort, string> = {
    title: t`Session`,
    status: t`Status`,
    updated: t`Updated`,
  };
  const sortHead = (field: SessionSort) => ({
    sortDirection: list.sort.field === field ? list.sort.dir : null,
    onSort: () => list.toggleSort(field),
  });
  const toolbar = (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <SearchField
        name="devin-search"
        value={filters.q ?? ""}
        onChange={(value) => list.setParam("q", value)}
        placeholder={t`Search sessions`}
        label={t`Search sessions`}
        className="w-56"
      />
      <PickFilter
        label={t`Status`}
        value={filters.status}
        options={options((s) => [s.kind, statusLabel(s.kind, s.status)])}
        onChange={(value) => list.setParam("status", value)}
      />
      <PickFilter
        label={t`Source`}
        value={filters.source}
        options={options((s) => [s.origin, sourceLabel(s.origin)])}
        onChange={(value) => list.setParam("source", value)}
      />
      {/* Wide, the column headers sort; narrow, there are none. */}
      <span className="ms-auto flex items-center gap-1 @2xl:hidden">
        <SortControl
          fields={SESSION_SORTS.map((field) => [field, sortNames[field]])}
          field={list.sort.field}
          fieldLabel={sortNames[list.sort.field]}
          direction={list.sort.dir}
          onField={(field) => list.setSort({ field, dir: field === "updated" ? "desc" : "asc" })}
          onDirection={(dir) => list.setSort({ field: list.sort.field, dir })}
        />
      </span>
    </div>
  );
  if (groups.length === 0 && filtered) {
    return (
      <>
        {toolbar}
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            <Trans>No matches</Trans>
          </p>
          <Button variant="outline" size="sm" onClick={() => list.clear("q", "status", "source")}>
            <Trans>Clear filters</Trans>
          </Button>
        </div>
      </>
    );
  }
  return (
    <>
      {toolbar}
      <div data-muted={muted} className={cn("@2xl:hidden", muted && "text-muted-foreground")}>
        {groups.map(({ section, rows }) => (
          <section key={section} aria-label={sectionName(section)}>
            <h3 className="border-t border-border pt-3 text-xs font-semibold text-muted-foreground">
              {sectionName(section)}
            </h3>
            <ul>
              {rows.map((session) => (
                <li key={session.id} className="relative py-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Title session={session} />
                    </div>
                    <Badge session={session} muted={muted} />
                  </div>
                  <Question session={session} />
                  <p className="mt-1 text-xs text-muted-foreground">{summary(session)}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <Table
        data-muted={muted}
        className={cn("hidden @2xl:table", muted && "text-muted-foreground")}
      >
        <caption className="sr-only">
          <Trans>Devin sessions</Trans>
        </caption>
        <colgroup>
          <col className="w-[36%]" />
          <col className="w-[15%]" />
          <col className="w-[21%]" />
          <col className="w-[12%]" />
          <col className="w-[16%]" />
        </colgroup>
        <TableHeader>
          <TableHeadRow>
            <TableHead {...sortHead("title")}>
              <Trans>Session</Trans>
            </TableHead>
            <TableHead {...sortHead("status")}>
              <Trans>Status</Trans>
            </TableHead>
            <TableHead>
              <Trans>Pull request</Trans>
            </TableHead>
            <TableHead>
              <Trans>Source</Trans>
            </TableHead>
            <TableHead {...sortHead("updated")}>
              <Trans>Updated</Trans>
            </TableHead>
          </TableHeadRow>
        </TableHeader>
        {groups.map(({ section, rows }) => (
          <TableBody key={section}>
            <TableRow className="h-auto hover:bg-transparent">
              <th
                colSpan={5}
                scope="colgroup"
                className="pb-1 pt-4 text-start text-xs font-semibold text-muted-foreground"
              >
                {sectionName(section)}
              </th>
            </TableRow>
            {rows.map((session) => (
              <TableRow key={session.id} className="relative h-auto align-top">
                <TableCell className="py-3 pe-4">
                  <Title session={session} />
                  <Question session={session} />
                </TableCell>
                <TableCell className="py-3">
                  <Badge session={session} muted={muted} />
                </TableCell>
                <TableCell className="py-3">
                  <PullRequests session={session} />
                </TableCell>
                <TableCell className="py-3">{sourceLabel(session.origin)}</TableCell>
                <TableCell className="whitespace-nowrap py-3">{updatedLabel(session)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        ))}
      </Table>
    </>
  );
}
