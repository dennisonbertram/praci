import { t } from "@lingui/core/macro";
import type { EquityCertificate } from "@rakazo/contracts";
import { EQUITY_CERTIFICATE_STATUS_LABELS } from "@rakazo/contracts";
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
import { formatShares as figure, formatDay, formatPrice } from "./format";
import { RsaDialog } from "./RsaDialog";

type PlanOption = { id: string; name: string };
type Row = EquityCertificate & { planName: string };
type DialogState = { mode: "issue" } | { mode: "cancel"; certificate: EquityCertificate } | null;

/** Restricted stock awards: certificates issued under a plan, excluding option exercise certificates. */
export function RsaTable({ refreshKey = 0 }: { refreshKey?: number }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [dialog, setDialog] = useState<DialogState>(null);

  useEffect(() => {
    let live = true;
    rpc.equity.planPools
      .list()
      .then(async (pools) => {
        const options = pools.map((pool) => ({ id: pool.planId, name: pool.name }));
        const planIds = options.map((option) => option.id);
        const [certificates, exercises] = await Promise.all([
          planIds.length
            ? rpc.equity.certificates.list({ planId: planIds, pageSize: 500 })
            : Promise.resolve({ items: [] as EquityCertificate[] }),
          rpc.equity.exercises.list({ pageSize: 500 }),
        ]);
        if (!live) return;
        const exercised = new Set(
          exercises.items
            .map((exercise) => exercise.certificateId)
            .filter((id): id is string => id != null),
        );
        setPlans(options);
        setRows(
          certificates.items
            .filter((certificate) => certificate.planId != null && !exercised.has(certificate.id))
            .map((certificate) => ({
              ...certificate,
              planName: options.find((option) => option.id === certificate.planId)?.name ?? "",
            })),
        );
        setError(null);
      })
      .catch((caught: unknown) => live && setError(errorText(caught)));
    return () => {
      live = false;
    };
  }, [refreshKey, reload]);

  const header = (
    <div className="flex items-center justify-end gap-2">
      <Button size="sm" onClick={() => setDialog({ mode: "issue" })}>
        {t`Issue RSA`}
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      {header}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {rows == null && !error ? (
        <Skeleton className="h-32 w-full" />
      ) : rows?.length === 0 ? (
        <CapTableEmptyState message={t`No restricted stock awards yet`} />
      ) : rows ? (
        <Table>
          <TableHeader>
            <TableHeadRow>
              <TableHead>{t`Security`}</TableHead>
              <TableHead>{t`Holder`}</TableHead>
              <TableHead>{t`Plan`}</TableHead>
              <TableHead>{t`Status`}</TableHead>
              <TableHead className="text-right">{t`Quantity`}</TableHead>
              <TableHead className="text-right">{t`Price per share`}</TableHead>
              <TableHead>{t`Issue date`}</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">{t`Actions`}</span>
              </TableHead>
            </TableHeadRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.label}</TableCell>
                <TableCell>{row.stakeholderName}</TableCell>
                <TableCell>{row.planName}</TableCell>
                <TableCell>{EQUITY_CERTIFICATE_STATUS_LABELS[row.status]}</TableCell>
                <TableCell className="text-right tabular-nums">{figure(row.quantity)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.pricePerShare ? formatPrice(row.pricePerShare) : "—"}
                </TableCell>
                <TableCell className="tabular-nums">{formatDay(row.issueDate)}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t`Actions for ${row.label}`}
                        />
                      }
                    >
                      <MoreHorizontal />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        disabled={row.status !== "outstanding"}
                        onClick={() => setDialog({ mode: "cancel", certificate: row })}
                      >
                        {t`Cancel RSA`}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
      {dialog && (
        <RsaDialog
          mode={dialog.mode}
          certificate={dialog.mode === "cancel" ? dialog.certificate : undefined}
          plans={plans}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            setReload((value) => value + 1);
          }}
        />
      )}
    </div>
  );
}
