import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { BrexTrip, BrexTrips } from "@rakazo/contracts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
} from "@rakazo/ui-web";
import { dayRange, shortDay } from "../../lib/finance-format";
import type { SortDir } from "../../lib/list-params";
import { sortBy, useListParams } from "../../lib/list-params";
import { rpc } from "../../lib/rpc";
import { Section, useFinanceQuery } from "../finance/ui";
import { BrexSection } from "./BrexSection";

const dash = "—";

function tripStatus(status: string | null): string {
  if (!status) return dash;
  if (status === "UPCOMING") return t`Upcoming`;
  if (status === "APPROVED") return t`Approved`;
  if (status === "CANCELLED") return t`Cancelled`;
  if (status === "COMPLETED") return t`Completed`;
  return status;
}

function dayOf(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

function tripDates(trip: BrexTrip): string {
  const start = dayOf(trip.startsAt);
  const end = dayOf(trip.endsAt);
  if (start && end && start !== end) return dayRange(start, end) || dash;
  const day = start || end;
  return day ? shortDay(day) || dash : dash;
}

function tripSortKey(trip: BrexTrip): string {
  return trip.startsAt ?? trip.endsAt ?? "";
}

/** Upcoming trips first (nearest first), then everything else (most recent first); `dir` reverses that. A cancelled trip is never upcoming. */
function sortTripsByDate(trips: readonly BrexTrip[], dir: SortDir): BrexTrip[] {
  const now = new Date().toISOString();
  const isUpcoming = (trip: BrexTrip) =>
    trip.status !== "CANCELLED" && (trip.endsAt ?? trip.startsAt ?? "") >= now;
  const upcoming = trips
    .filter(isUpcoming)
    .sort((a, b) => tripSortKey(a).localeCompare(tripSortKey(b)));
  const rest = trips
    .filter((trip) => !isUpcoming(trip))
    .sort((a, b) => tripSortKey(b).localeCompare(tripSortKey(a)));
  const ordered = [...upcoming, ...rest];
  return dir === "desc" ? ordered.reverse() : ordered;
}

type TripSort = "date" | "name" | "traveler" | "status";

function TravelView({ data }: { data: BrexTrips }) {
  const list = useListParams(["date", "name", "traveler", "status"] as const, {
    field: "date",
    dir: "asc",
  });
  const picks: Record<Exclude<TripSort, "date">, (trip: BrexTrip) => string | null> = {
    name: (trip) => trip.name ?? trip.tripId,
    traveler: (trip) => trip.bookerName ?? trip.bookerUserId,
    status: (trip) => trip.status,
  };
  const field = list.sort.field as TripSort;
  const rows =
    field === "date"
      ? sortTripsByDate(data.trips, list.sort.dir)
      : sortBy(data.trips, picks[field], list.sort.dir);
  const sortHead = (sortField: TripSort) => ({
    sortDirection: list.sort.field === sortField ? list.sort.dir : null,
    onSort: () => list.toggleSort(sortField),
  });

  return (
    <Section title={<Trans>Trips</Trans>}>
      {rows.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">
          <Trans>No trips yet.</Trans>
        </p>
      ) : (
        <Table compact>
          <caption className="sr-only">
            <Trans>Brex trips</Trans>
          </caption>
          <TableHeader>
            <TableHeadRow>
              <TableHead {...sortHead("name")}>
                <Trans>Trip</Trans>
              </TableHead>
              <TableHead {...sortHead("traveler")}>
                <Trans>Traveler</Trans>
              </TableHead>
              <TableHead {...sortHead("date")}>
                <Trans>Dates</Trans>
              </TableHead>
              <TableHead {...sortHead("status")}>
                <Trans>Status</Trans>
              </TableHead>
            </TableHeadRow>
          </TableHeader>
          <TableBody>
            {rows.map((trip) => (
              <TableRow key={trip.tripId}>
                <TableCell className="max-w-64 truncate" title={trip.name ?? trip.tripId}>
                  {trip.name ?? trip.tripId}
                </TableCell>
                <TableCell className="max-w-40 truncate">
                  {trip.bookerName ?? trip.bookerUserId ?? dash}
                </TableCell>
                <TableCell className="whitespace-nowrap">{tripDates(trip)}</TableCell>
                <TableCell className="whitespace-nowrap">{tripStatus(trip.status)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Section>
  );
}

/** The owner's Brex trips, read only: the trips RPC has no cost, so there is no cost column. */
export function BrexTravel() {
  const query = useFinanceQuery(() => rpc.brexCards.trips(), []);
  return <BrexSection query={query}>{(data) => <TravelView data={data} />}</BrexSection>;
}
