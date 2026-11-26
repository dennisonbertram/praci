import { t } from "@lingui/core/macro";
import type { EquityPlan, EquityPlanPool } from "@rakazo/contracts";
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
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import { CapTableEmptyState } from "../shell/CapTableEmptyState";
import { formatShares as figure } from "./format";
import { PlanFormDialog } from "./PlanFormDialog";
import { PlanHistoryDialog } from "./PlanHistoryDialog";
import { plansCsv } from "./plans-csv";

/** Equity plans with their pools; the page owns the pool dialogs. */
export function PlansTable({
  refreshKey = 0,
  onIncrease,
  onPourOver,
}: {
  refreshKey?: number;
  onIncrease: (pool: EquityPlanPool, pools: EquityPlanPool[]) => void;
  onPourOver: (pools: EquityPlanPool[]) => void;
}) {
  const [pools, setPools] = useState<EquityPlanPool[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState<EquityPlan | "new" | null>(null);
  const [history, setHistory] = useState<EquityPlanPool | null>(null);

  useEffect(() => {
    let live = true;
    rpc.equity.planPools
      .list()
      .then((next) => {
        if (!live) return;
        setPools(next);
        setError(null);
      })
      .catch((caught: unknown) => live && setError(errorText(caught)));
    return () => {
      live = false;
    };
  }, [refreshKey, reload]);

  async function edit(planId: string) {
    try {
      setEditing(await rpc.equity.plans.get({ id: planId }));
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  const download = () => {
    if (!pools) return;
    const blob = new Blob([plansCsv(pools)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "equity-plans.csv";
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const header = (
    <div className="flex items-center justify-end gap-2">
      <Button variant="outline" size="sm" disabled={(pools?.length ?? 0) === 0} onClick={download}>
        {t`Export report`}
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={(pools?.length ?? 0) < 2}
        onClick={() => pools && onPourOver(pools)}
      >
        {t`Pour over`}
      </Button>
      <Button size="sm" onClick={() => setEditing("new")}>
        {t`Add plan`}
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      {header}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {pools == null && !error ? (
        <Skeleton className="h-32 w-full" />
      ) : pools?.length === 0 ? (
        <CapTableEmptyState message={t`No plans yet`} />
      ) : pools ? (
        <Table>
          <TableHeader>
            <TableHeadRow>
              <TableHead className="w-1/4">{t`Plan name`}</TableHead>
              <TableHead>{t`Status`}</TableHead>
              <TableHead className="text-right">{t`Reserved`}</TableHead>
              <TableHead className="text-right">{t`Granted`}</TableHead>
              <TableHead className="text-right">{t`Exercised`}</TableHead>
              <TableHead className="text-right">{t`Returned`}</TableHead>
              <TableHead className="text-right">{t`Available`}</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">{t`Actions`}</span>
              </TableHead>
            </TableHeadRow>
          </TableHeader>
          <TableBody>
            {pools.map((pool) => (
              <TableRow key={pool.planId}>
                <TableCell className="truncate font-medium" title={pool.name}>
                  {pool.name}
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-2">
                    <span
                      aria-hidden
                      className={`size-2 rounded-full ${pool.status === "active" ? "bg-success" : "bg-muted-foreground"}`}
                    />
                    {pool.status === "active" ? t`Active` : t`Inactive`}
                  </span>
                </TableCell>
                {[
                  pool.reservedShares,
                  pool.grantedShares,
                  pool.exercisedShares,
                  pool.returnedShares,
                  pool.availableShares,
                ].map((value, index) => (
                  <TableCell key={index} className="text-right tabular-nums">
                    {figure(value)}
                  </TableCell>
                ))}
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t`Actions for ${pool.name}`}
                        />
                      }
                    >
                      <MoreHorizontal />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => void edit(pool.planId)}>
                        {t`Edit plan`}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onIncrease(pool, pools)}>
                        {t`Increase pool`}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setHistory(pool)}>
                        {t`Pool history`}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
      {editing && (
        <PlanFormDialog
          plan={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setReload((value) => value + 1);
          }}
        />
      )}
      {history && <PlanHistoryDialog pool={history} onClose={() => setHistory(null)} />}
    </div>
  );
}
