import { t } from "@lingui/core/macro";
import type { EquityAccessHolder } from "@rakazo/contracts";
import {
  Button,
  enqueueNotificationToast,
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
import { CapTableEmptyState } from "../shell/CapTableEmptyState";
import { levelLabel } from "./access-levels";
import { mediumDate } from "./dates";

/** Holders asking for more access, each approved or denied. */
export function AccessRequests() {
  const [rows, setRows] = useState<EquityAccessHolder[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    rpc.equity.accessHolders
      .list({ requested: true, page: 1, pageSize: 500 })
      .then((page) => {
        if (live) setRows(page.items);
      })
      .catch((cause: unknown) => {
        if (live) setError(errorText(cause));
      });
    return () => {
      live = false;
    };
  }, []);

  const resolve = async (row: EquityAccessHolder, approve: boolean) => {
    const { stakeholderId, requestedLevel } = row;
    if (!requestedLevel) return;
    setBusy(stakeholderId);
    try {
      await rpc.equity.accessHolders.resolveRequest({ stakeholderId, requestedLevel, approve });
      setRows((current) => current?.filter((row) => row.stakeholderId !== stakeholderId) ?? null);
    } catch (cause) {
      enqueueNotificationToast({
        id: "cap-table-access-request-failed",
        title: t`Could not answer the request`,
        body: errorText(cause),
      });
      // The request may have changed under the reviewer; show what is open now.
      await rpc.equity.accessHolders
        .list({ requested: true, page: 1, pageSize: 500 })
        .then((page) => setRows(page.items))
        .catch(() => undefined);
    } finally {
      setBusy(null);
    }
  };

  if (error)
    return (
      <p role="alert" className="text-sm text-destructive">
        {error}
      </p>
    );
  if (rows == null) return <Skeleton className="h-32 w-full" />;
  if (rows.length === 0) return <CapTableEmptyState message={t`No open requests`} />;
  return (
    <Table>
      <TableHeader>
        <TableHeadRow>
          <TableHead>{t`Stakeholder`}</TableHead>
          <TableHead>{t`Current level`}</TableHead>
          <TableHead>{t`Requested level`}</TableHead>
          <TableHead>{t`Requested`}</TableHead>
          <TableHead />
        </TableHeadRow>
      </TableHeader>
      <TableBody aria-label={t`Open requests`}>
        {rows.map((row) => (
          <TableRow key={row.stakeholderId}>
            <TableCell className="font-medium">{row.name}</TableCell>
            <TableCell>{levelLabel(row.effectiveLevel)}</TableCell>
            <TableCell>{row.requestedLevel ? levelLabel(row.requestedLevel) : "—"}</TableCell>
            <TableCell className="tabular-nums">
              {row.requestedAt ? mediumDate(row.requestedAt) : "—"}
            </TableCell>
            <TableCell>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy === row.stakeholderId}
                  onClick={() => void resolve(row, false)}
                >
                  {t`Deny`}
                </Button>
                <Button
                  size="sm"
                  disabled={busy === row.stakeholderId}
                  onClick={() => void resolve(row, true)}
                >
                  {t`Approve`}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
