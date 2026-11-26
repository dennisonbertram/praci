import { t } from "@lingui/core/macro";
import type { EquityCashRaised, EquityFundingRound } from "@rakazo/contracts";
import {
  Button,
  Checkbox,
  enqueueNotificationToast,
  Input,
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
} from "@rakazo/ui-web";
import { useEffect, useState } from "react";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import { FinancingChart } from "./FinancingChart";
import { formatDollars, formatShares } from "./format";

type SortField = "issueDate" | "stakeholderName" | "cashPaidCents" | "shares";
type Security = EquityCashRaised["securities"][number];

/** Matches on security, stakeholder or round, then sorts; amounts sort by size, not text. */
function visible(
  rows: Security[],
  search: string,
  sort: { field: SortField; dir: "asc" | "desc" },
  roundName: Map<string, string>,
) {
  const needle = search.trim().toLowerCase();
  const matched = needle
    ? rows.filter((row) =>
        [row.label, row.stakeholderName, row.roundId ? roundName.get(row.roundId) : null].some(
          (value) => value?.toLowerCase().includes(needle),
        ),
      )
    : rows;
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...matched].sort((a, b) => {
    const x = a[sort.field];
    const y = b[sort.field];
    const order =
      sort.field === "cashPaidCents" || sort.field === "shares"
        ? Number(BigInt(x) - BigInt(y))
        : x.localeCompare(y);
    return sign * (Math.sign(order) || a.id.localeCompare(b.id));
  });
}

const money = (cents: string) => (cents === "0" ? "—" : formatDollars(cents));

/** Cash raised by class and per security; selected securities can be put in a round. */
export function CashRaisedView({
  rounds,
  onChanged,
}: {
  rounds: EquityFundingRound[];
  onChanged: () => void;
}) {
  const [cash, setCash] = useState<EquityCashRaised | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [roundId, setRoundId] = useState("");
  const [reloadCount, setReloadCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ field: SortField; dir: "asc" | "desc" }>({
    field: "issueDate",
    dir: "desc",
  });

  useEffect(() => {
    let live = true;
    rpc.equity.views
      .cashRaised({})
      .then((loaded: EquityCashRaised) => {
        if (live) setCash(loaded);
      })
      .catch((cause: unknown) => {
        if (live) setError(errorText(cause));
      });
    return () => {
      live = false;
    };
  }, [reloadCount]);

  if (error)
    return (
      <p role="alert" className="text-sm text-destructive">
        {error}
      </p>
    );
  if (cash == null) return <Skeleton className="h-40 w-full" />;
  const roundName = new Map(rounds.map((round) => [round.id, round.name]));
  const head = (field: SortField) => ({
    sortDirection: sort.field === field ? sort.dir : null,
    onSort: () =>
      setSort((current) =>
        current.field === field
          ? { field, dir: current.dir === "asc" ? "desc" : "asc" }
          : { field, dir: field === "stakeholderName" ? "asc" : "desc" },
      ),
  });

  const toggle = (id: string, on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const apply = async () => {
    setSaving(true);
    try {
      const picked = cash.securities.filter((row) => selected.has(row.id));
      await rpc.equity.views.attachToRound({
        roundId: roundId === "none" ? null : roundId,
        certificateIds: picked.filter((row) => row.kind === "certificate").map((row) => row.id),
        convertibleIds: picked.filter((row) => row.kind === "convertible").map((row) => row.id),
      });
      const count = picked.length;
      enqueueNotificationToast({
        id: "attach-to-round",
        title:
          roundId === "none"
            ? t`Took ${count} out of their round`
            : t`Added ${count} to ${roundName.get(roundId) ?? ""}`,
      });
      setSelected(new Set());
      setReloadCount((count) => count + 1);
      onChanged();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <FinancingChart
        bars={cash.byClass.map((row) => ({
          id: row.shareClassId ?? "convertibles",
          label: row.shareClassId ? row.name : t`Convertibles`,
          cents: row.cashRaisedCents,
        }))}
      />
      <Input
        aria-label={t`Search`}
        placeholder={t`Search`}
        className="w-64"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>{t`${selected.size} selected`}</span>
          <NativeSelect
            aria-label={t`Round`}
            value={roundId}
            onChange={(event) => setRoundId(event.target.value)}
          >
            <NativeSelectOption value="">{t`Choose a round`}</NativeSelectOption>
            {rounds.map((round) => (
              <NativeSelectOption key={round.id} value={round.id}>
                {round.name}
              </NativeSelectOption>
            ))}
            <NativeSelectOption value="none">{t`No round`}</NativeSelectOption>
          </NativeSelect>
          <Button size="sm" disabled={!roundId || saving} onClick={() => void apply()}>
            {t`Apply`}
          </Button>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <Table compact className="whitespace-nowrap">
          <TableHeader>
            <TableHeadRow>
              <TableHead>
                <span className="sr-only">{t`Select`}</span>
              </TableHead>
              <TableHead>{t`Security`}</TableHead>
              <TableHead {...head("stakeholderName")}>{t`Stakeholder`}</TableHead>
              <TableHead {...head("issueDate")}>{t`Issue date`}</TableHead>
              <TableHead>{t`Round`}</TableHead>
              <TableHead className="text-end" {...head("cashPaidCents")}>
                {t`Cash paid`}
              </TableHead>
              <TableHead className="text-end">{t`Debt canceled`}</TableHead>
              <TableHead className="text-end">{t`IP transferred`}</TableHead>
              <TableHead className="text-end">{t`Other consideration`}</TableHead>
              <TableHead className="text-end" {...head("shares")}>
                {t`Shares`}
              </TableHead>
            </TableHeadRow>
          </TableHeader>
          <TableBody aria-label={t`Cash raised`}>
            {visible(cash.securities, search, sort, roundName).map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Checkbox
                    aria-label={t`Select ${row.label ?? row.id}`}
                    checked={selected.has(row.id)}
                    onCheckedChange={(on) => toggle(row.id, on === true)}
                  />
                </TableCell>
                <TableCell className="font-medium">{row.label ?? "—"}</TableCell>
                <TableCell>{row.stakeholderName}</TableCell>
                <TableCell>{row.issueDate}</TableCell>
                <TableCell>{row.roundId ? (roundName.get(row.roundId) ?? "—") : "—"}</TableCell>
                <TableCell className="text-end tabular-nums">{money(row.cashPaidCents)}</TableCell>
                <TableCell className="text-end tabular-nums">
                  {money(row.debtCanceledCents)}
                </TableCell>
                <TableCell className="text-end tabular-nums">
                  {money(row.ipTransferredCents)}
                </TableCell>
                <TableCell className="text-end tabular-nums">
                  {money(row.otherConsiderationCents)}
                </TableCell>
                <TableCell className="text-end tabular-nums">
                  {row.shares === "0" ? "—" : formatShares(row.shares)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
