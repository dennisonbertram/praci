import { t } from "@lingui/core/macro";
import type { EquityWarrant } from "@rakazo/contracts";
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
  TableHeadRow,
  TableRow,
} from "@rakazo/ui-web";
import { MoreHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { useHideAmounts } from "../../../lib/hide-amounts-preference";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import { SearchField } from "../../ListControls";
import { CapTableEmptyState } from "../shell/CapTableEmptyState";
import { formatDay, formatPrice, formatShares } from "./format";
import { WarrantDialog } from "./WarrantDialog";

const DASH = "—";
const shares = formatShares;
const price = formatPrice;
const day = (value: string | null) => (value ? formatDay(value) : DASH);

/** The Warrants tab: every warrant, searchable, with issue and cancel. */
export function WarrantsTable() {
  const hidden = useHideAmounts();
  const [search, setSearch] = useState("");
  const [warrants, setWarrants] = useState<EquityWarrant[] | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState<"new" | EquityWarrant | null>(null);

  useEffect(() => {
    let live = true;
    setError("");
    rpc.equity.warrants
      .list({ page: 1, pageSize: 100, search: search || undefined })
      .then((loaded) => {
        if (live) setWarrants(loaded.items);
      })
      .catch((cause: unknown) => {
        if (live) setError(errorText(cause));
      });
    return () => {
      live = false;
    };
  }, [search, reload]);

  const toolbar = (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <SearchField
        name="warrant-search"
        className="w-56"
        value={search}
        onChange={setSearch}
        placeholder={t`Search warrants`}
        label={t`Search warrants`}
      />
      <Button size="sm" className="ms-auto rounded-full" onClick={() => setEditing("new")}>
        {t`Issue warrant`}
      </Button>
    </div>
  );

  return (
    <div>
      {toolbar}
      {error ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-destructive">{error}</span>
          <Button variant="outline" size="sm" onClick={() => setReload((value) => value + 1)}>
            {t`Try again`}
          </Button>
        </div>
      ) : warrants == null ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : warrants.length === 0 ? (
        <CapTableEmptyState
          message={search ? t`No matches` : t`No warrants yet`}
          action={
            search ? (
              <Button variant="outline" size="sm" onClick={() => setSearch("")}>
                {t`Clear search`}
              </Button>
            ) : (
              <Button size="sm" onClick={() => setEditing("new")}>
                {t`Issue warrant`}
              </Button>
            )
          }
        />
      ) : (
        <Table compact>
          <TableHeader>
            <TableHeadRow>
              <TableHead>{t`Security`}</TableHead>
              <TableHead>{t`Holder`}</TableHead>
              <TableHead>{t`Class`}</TableHead>
              <TableHead>{t`Status`}</TableHead>
              <TableHead className="text-right">{t`Quantity`}</TableHead>
              <TableHead className="text-right">{t`Exercise price`}</TableHead>
              <TableHead>{t`Issue date`}</TableHead>
              <TableHead>{t`Expiration`}</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">{t`Actions`}</span>
              </TableHead>
            </TableHeadRow>
          </TableHeader>
          <TableBody aria-label={t`Warrants`}>
            {warrants.map((warrant) => (
              <TableRow key={warrant.id} data-warrant-id={warrant.id}>
                <TableCell className="font-medium">{warrant.label}</TableCell>
                <TableCell className="truncate">{warrant.stakeholderName}</TableCell>
                <TableCell>{warrant.shareClassName}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-2">
                    <span
                      aria-hidden
                      className={`size-2 rounded-full ${warrant.status === "outstanding" ? "bg-success" : "bg-muted-foreground"}`}
                    />
                    {warrant.status === "outstanding" ? t`Outstanding` : t`Canceled`}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {shares(warrant.quantity)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {price(warrant.exercisePrice, hidden)}
                </TableCell>
                <TableCell className="tabular-nums">{day(warrant.issueDate)}</TableCell>
                <TableCell className="tabular-nums">{day(warrant.expirationDate)}</TableCell>
                <TableCell className="w-10 pe-0 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t`Actions for ${warrant.label}`}
                        />
                      }
                    >
                      <MoreHorizontal aria-hidden="true" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        disabled={warrant.status !== "outstanding"}
                        onClick={() => setEditing(warrant)}
                      >
                        {t`Cancel warrant`}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {editing && (
        <WarrantDialog
          mode={editing === "new" ? "issue" : "cancel"}
          warrant={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setReload((value) => value + 1);
          }}
        />
      )}
    </div>
  );
}
