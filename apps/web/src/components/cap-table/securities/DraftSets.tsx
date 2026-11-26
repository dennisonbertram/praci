import { t } from "@lingui/core/macro";
import type { EquityDraftSet } from "@rakazo/contracts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
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
import { listAllPages } from "../../../lib/list-all";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import type { DraftKind } from "./DraftSetEditor";
import { DraftSetEditor } from "./DraftSetEditor";
import { formatDay } from "./format";

const statusLabel = (status: EquityDraftSet["status"]) =>
  ({ draft: t`Draft`, issued: t`Issued`, discarded: t`Discarded` })[status];

/** Draft sets of one kind: start one, open a draft to edit, review and issue it. */
export function DraftSets({ kind, onIssued }: { kind: DraftKind; onIssued: () => void }) {
  const [sets, setSets] = useState<EquityDraftSet[] | null>(null);
  // A failed list replaces the table; a failed Discard is shown beside it and keeps the table.
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [confirming, setConfirming] = useState<EquityDraftSet | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [editing, setEditing] = useState<{ set: EquityDraftSet | null } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let live = true;
    listAllPages((page) =>
      rpc.equity.draftSets.list({
        securityKind: kind,
        status: ["draft", "issued"],
        page,
        pageSize: 100,
      }),
    )
      .then((all) => {
        if (live) setSets(all);
      })
      .catch((cause: unknown) => {
        if (live) setError(errorText(cause));
      });
    return () => {
      live = false;
    };
  }, [kind, reloadKey]);

  const discard = async (set: EquityDraftSet) => {
    setDiscarding(true);
    setActionError("");
    try {
      await rpc.equity.draftSets.update({
        id: set.id,
        expectedRevision: set.revision,
        status: "discarded",
      });
      setReloadKey((key) => key + 1);
    } catch (cause) {
      setActionError(errorText(cause));
    } finally {
      setDiscarding(false);
      setConfirming(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => setEditing({ set: null })}>
          {kind === "certificate" ? t`New shares draft set` : t`New SAFEs draft set`}
        </Button>
      </div>
      {actionError ? (
        <p role="alert" className="text-sm text-destructive">
          {actionError}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : sets == null ? (
        <Skeleton className="h-24 w-full" />
      ) : sets.length === 0 ? null : (
        <Table>
          <TableHeader>
            <TableHeadRow>
              <TableHead>{t`Draft name`}</TableHead>
              <TableHead>{t`Status`}</TableHead>
              <TableHead className="text-end">{t`Securities`}</TableHead>
              <TableHead>{t`Last updated`}</TableHead>
              <TableHead className="w-24">
                <span className="sr-only">{t`Actions`}</span>
              </TableHead>
            </TableHeadRow>
          </TableHeader>
          <TableBody aria-label={t`Draft sets`}>
            {sets.map((set) => (
              <TableRow key={set.id}>
                <TableCell className="font-medium">
                  {set.status === "draft" ? (
                    <button
                      type="button"
                      className="underline-offset-4 hover:underline"
                      onClick={() => setEditing({ set })}
                    >
                      {set.name}
                    </button>
                  ) : (
                    set.name
                  )}
                </TableCell>
                <TableCell>{statusLabel(set.status)}</TableCell>
                <TableCell className="text-end tabular-nums">{set.items.length}</TableCell>
                <TableCell>{formatDay(set.updatedAt.slice(0, 10))}</TableCell>
                <TableCell className="text-end">
                  {set.status === "draft" ? (
                    <Button variant="ghost" size="sm" onClick={() => setConfirming(set)}>
                      {t`Discard`}
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <AlertDialog
        open={confirming != null}
        onOpenChange={(open) => !open && !discarding && setConfirming(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t`Discard ${confirming?.name ?? ""}?`}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={discarding}>{t`Cancel`}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={discarding}
              onClick={(event) => {
                event.preventDefault();
                if (confirming) void discard(confirming);
              }}
            >
              {t`Discard`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {editing ? (
        <DraftSetEditor
          kind={kind}
          set={editing.set}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          onChanged={() => {
            setReloadKey((key) => key + 1);
            onIssued();
          }}
        />
      ) : null}
    </div>
  );
}
