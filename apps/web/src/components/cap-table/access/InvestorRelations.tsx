import { t } from "@lingui/core/macro";
import type { EquityAccessHolder, EquityAccessLevel } from "@rakazo/contracts";
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Link } from "react-router-dom";
import { useListParams } from "../../../lib/list-params";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import { CapTableEmptyState } from "../shell/CapTableEmptyState";
import { ACCESS_LEVELS, levelLabel } from "./access-levels";
import { DeliverDocument } from "./DeliverDocument";
import { mediumDate } from "./dates";
import { LinkContact } from "./LinkContact";
import { Pager } from "./Pager";

const SORTS = ["name", "ownership", "effectiveLevel", "lastSeenAt"] as const;
const PAGE_SIZE = 25;

const percent = (value: string) => `${Number(value).toFixed(2)}%`;
const day = (value: string | null) => (value ? mediumDate(value) : "—");

/** The investor relations table: every holder, what they own and what they can see. */
export function InvestorRelations() {
  const list = useListParams(SORTS, { field: "ownership", dir: "desc" });
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState<EquityAccessLevel | "">("");
  const [requested, setRequested] = useState(false);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<EquityAccessHolder[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState(false);
  const [choice, setChoice] = useState<EquityAccessLevel | "group" | "">("");
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);
  const [delivering, setDelivering] = useState(false);
  const [linking, setLinking] = useState<EquityAccessHolder | null>(null);
  // Rows by id, so a selection kept across pages can still be delivered to.
  const [known, setKnown] = useState<Map<string, EquityAccessHolder>>(new Map());

  const filters = {
    sort: list.sort,
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(level ? { level: [level] } : {}),
    ...(requested ? { requested: true } : {}),
  };
  const key = JSON.stringify(filters);

  useEffect(() => {
    let live = true;
    setError("");
    rpc.equity.accessHolders
      .list({ ...filters, page, pageSize: PAGE_SIZE })
      .then((loaded) => {
        if (!live) return;
        setRows(loaded.items);
        setTotal(loaded.total);
        setKnown((current) => {
          const next = new Map(current);
          for (const row of loaded.items) next.set(row.stakeholderId, row);
          return next;
        });
      })
      .catch((cause: unknown) => {
        if (live) setError(errorText(cause));
      });
    return () => {
      live = false;
    };
  }, [key, page, reload]);

  // A selection belongs to the rows on screen: a new filter or page starts a new one.
  useEffect(() => setSelected(new Set()), [key, page]);

  const save = async () => {
    if (!choice) return;
    setSaving(true);
    try {
      await rpc.equity.accessHolders.setLevels({
        stakeholderIds: [...selected],
        level: choice === "group" ? null : choice,
      });
      setEditing(false);
      setChoice("");
      setSelected(new Set());
      setReload((count) => count + 1);
    } catch (cause) {
      enqueueNotificationToast({
        id: "cap-table-holders-levels-failed",
        title: t`Could not change access`,
        body: errorText(cause),
      });
    } finally {
      setSaving(false);
    }
  };

  const holders = rows ?? [];
  const allSelected = holders.length > 0 && holders.every((row) => selected.has(row.stakeholderId));
  const filtered = Boolean(search.trim() || level || requested);

  const head = (field: (typeof SORTS)[number]) => ({
    sortDirection: list.sort.field === field ? list.sort.dir : null,
    onSort: () => list.toggleSort(field),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label={t`Search holders`}
          placeholder={t`Search`}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="w-48"
        />
        <NativeSelect
          aria-label={t`Access level`}
          value={level}
          onChange={(event) => {
            setLevel(event.target.value as EquityAccessLevel | "");
            setPage(1);
          }}
          className="w-40"
        >
          <NativeSelectOption value="">{t`All levels`}</NativeSelectOption>
          {ACCESS_LEVELS.map((value) => (
            <NativeSelectOption key={value} value={value}>
              {levelLabel(value)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <span className="flex items-center gap-2 text-sm">
          <Checkbox
            aria-label={t`Open requests`}
            checked={requested}
            onCheckedChange={(checked) => {
              setRequested(Boolean(checked));
              setPage(1);
            }}
          />
          {t`Open requests`}
        </span>
        <div className="ms-auto flex items-center gap-2">
          {selected.size > 0 ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setDelivering(true)}>
                {t`Deliver document`}
              </Button>
              <Button size="sm" onClick={() => setEditing(true)}>
                {t`Change access (${selected.size})`}
              </Button>
            </>
          ) : null}
          <Button size="sm" render={<Link to="/app/investors?tab=updates" />}>
            {t`Send investor update`}
          </Button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : rows == null ? (
        <Skeleton className="h-40 w-full" />
      ) : holders.length === 0 ? (
        <CapTableEmptyState message={filtered ? t`No matching holders` : t`No holders yet`} />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableHeadRow>
                <TableHead className="w-8">
                  <Checkbox
                    aria-label={t`Select all`}
                    checked={allSelected}
                    onCheckedChange={(checked) =>
                      setSelected(
                        checked ? new Set(holders.map((row) => row.stakeholderId)) : new Set(),
                      )
                    }
                  />
                </TableHead>
                <TableHead {...head("name")}>{t`Investor`}</TableHead>
                <TableHead {...head("ownership")} className="text-end">
                  {t`Ownership`}
                </TableHead>
                <TableHead>{t`Series`}</TableHead>
                <TableHead>{t`Major investor`}</TableHead>
                <TableHead>{t`Contact`}</TableHead>
                <TableHead {...head("effectiveLevel")}>{t`Access level`}</TableHead>
                <TableHead {...head("lastSeenAt")}>{t`Last seen`}</TableHead>
              </TableHeadRow>
            </TableHeader>
            <TableBody aria-label={t`Investor relations`}>
              {holders.map((row) => (
                <TableRow key={row.stakeholderId} className="group">
                  <TableCell>
                    <Checkbox
                      aria-label={t`Select ${row.name}`}
                      checked={selected.has(row.stakeholderId)}
                      onCheckedChange={(checked) => {
                        const next = new Set(selected);
                        if (checked) next.add(row.stakeholderId);
                        else next.delete(row.stakeholderId);
                        setSelected(next);
                      }}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-end tabular-nums">
                    {percent(row.ownershipPercent)}
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-wrap items-center gap-1">
                      {[...new Set(row.classCodes)].map((code) => (
                        <Badge key={code} variant="outline">
                          {code}
                        </Badge>
                      ))}
                    </span>
                  </TableCell>
                  <TableCell>{row.majorInvestor ? t`Yes` : ""}</TableCell>
                  <TableCell className="relative">
                    <span className="flex items-center gap-1">
                      {row.email ? (
                        <a
                          className="block max-w-56 truncate underline-offset-4 hover:underline"
                          title={row.email}
                          href={`mailto:${row.email}`}
                        >
                          {row.email}
                        </a>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute end-1 bg-background opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                        aria-label={t`Investor contact for ${row.name}`}
                        onClick={() => setLinking(row)}
                      >
                        {row.contactId ? t`Change` : t`Link`}
                      </Button>
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      {levelLabel(row.effectiveLevel)}
                      {row.overrideLevel ? <Badge variant="outline">{t`Override`}</Badge> : null}
                      {row.requestedLevel ? <Badge variant="outline">{t`Requested`}</Badge> : null}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {day(row.lastSeenAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pager page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
        </>
      )}
      {linking ? (
        <LinkContact
          holder={linking}
          linkedContactIds={
            new Set([...known.values()].flatMap((row) => (row.contactId ? [row.contactId] : [])))
          }
          open
          onOpenChange={(next) => (next ? null : setLinking(null))}
          onLinked={() => setReload((count) => count + 1)}
        />
      ) : null}
      <DeliverDocument
        holders={[...selected].flatMap((id) => known.get(id) ?? [])}
        open={delivering}
        onOpenChange={setDelivering}
      />
      <Dialog open={editing} onOpenChange={(next) => (next ? null : setEditing(false))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t`Change access for ${selected.size} holders`}</DialogTitle>
          </DialogHeader>
          <NativeSelect
            aria-label={t`Access level`}
            value={choice}
            onChange={(event) => setChoice(event.target.value as EquityAccessLevel | "group" | "")}
          >
            <NativeSelectOption value="" disabled>
              {t`Choose a level`}
            </NativeSelectOption>
            <NativeSelectOption value="group">{t`Use group level`}</NativeSelectOption>
            {ACCESS_LEVELS.map((value) => (
              <NativeSelectOption key={value} value={value}>
                {levelLabel(value)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(false)}>
              {t`Cancel`}
            </Button>
            <Button disabled={saving || !choice} onClick={() => void save()}>
              {t`Save`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
