import { t } from "@lingui/core/macro";
import type { DataRoomApiItem, EquityDocumentLink, EquityDocumentTarget } from "@rakazo/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  enqueueNotificationToast,
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
import { listAllCursor, listAllPages } from "../../../lib/list-all";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import { CapTableEmptyState } from "../shell/CapTableEmptyState";
import { mediumDate } from "./dates";

type TargetKind = EquityDocumentTarget["kind"];

const KIND_LABEL: Record<TargetKind, string> = {
  stakeholder: t`Stakeholder`,
  certificate: t`Certificate`,
  round: t`Round`,
};

/** One record a document can be attached to, in the attach dialog's last select. */
type TargetOption = { id: string; label: string };

/**
 * The Documents sub-view: Data room documents attached to a stakeholder, a certificate or a
 * funding round, with one dialog to attach a document and one button per row to detach it.
 */
export function DocumentLinks() {
  const [rows, setRows] = useState<EquityDocumentLink[] | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [detaching, setDetaching] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    rpc.equity.documentLinks
      .list({})
      .then((links) => {
        if (live) setRows(links);
      })
      .catch((cause: unknown) => {
        if (!live) return;
        setRows([]);
        enqueueNotificationToast({
          id: "cap-table-document-links-load-failed",
          title: t`Could not load documents`,
          body: errorText(cause),
        });
      });
    return () => {
      live = false;
    };
  }, []);

  const detach = async (id: string) => {
    setDetaching(id);
    try {
      await rpc.equity.documentLinks.delete({ id });
      setRows((current) => current?.filter((row) => row.id !== id) ?? null);
    } catch (cause) {
      enqueueNotificationToast({
        id: "cap-table-document-detach-failed",
        title: t`Could not detach the document`,
        body: errorText(cause),
      });
    } finally {
      setDetaching(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAttachOpen(true)}>
          {t`Attach document`}
        </Button>
      </div>
      {rows == null ? (
        <Skeleton className="h-32 w-full" />
      ) : rows.length === 0 ? (
        <CapTableEmptyState message={t`No documents attached`} />
      ) : (
        <Table>
          <TableHeader>
            <TableHeadRow>
              <TableHead>{t`Document`}</TableHead>
              <TableHead>{t`Attached to`}</TableHead>
              <TableHead>{t`Added`}</TableHead>
              <TableHead />
            </TableHeadRow>
          </TableHeader>
          <TableBody aria-label={t`Attached documents`}>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell>
                  <span className="text-muted-foreground text-xs">
                    {KIND_LABEL[row.target.kind]}
                  </span>{" "}
                  {row.targetLabel}
                </TableCell>
                <TableCell className="tabular-nums">{mediumDate(row.createdAt)}</TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={detaching === row.id}
                      onClick={() => void detach(row.id)}
                    >
                      {t`Detach`}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <AttachDialog
        open={attachOpen}
        onOpenChange={setAttachOpen}
        onCreated={(link) =>
          setRows((current) => [link, ...(current?.filter((row) => row.id !== link.id) ?? [])])
        }
      />
    </div>
  );
}

/** Picks a Data room document and the stakeholder, certificate or round to attach it to. */
function AttachDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (link: EquityDocumentLink) => void;
}) {
  const [items, setItems] = useState<DataRoomApiItem[] | null>(null);
  const [itemId, setItemId] = useState("");
  const [kind, setKind] = useState<TargetKind>("stakeholder");
  const [targets, setTargets] = useState<Partial<Record<TargetKind, TargetOption[]>>>({});
  const [targetId, setTargetId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let live = true;
    listAllCursor((cursor) => rpc.dataRoom.items.list({ limit: 100, cursor }))
      .then((all) => {
        if (live) setItems(all.filter((item) => item.source !== "meeting"));
      })
      .catch((cause: unknown) => {
        if (live) setItems([]);
        enqueueNotificationToast({
          id: "cap-table-document-attach-load-failed",
          title: t`Could not load documents`,
          body: errorText(cause),
        });
      });
    return () => {
      live = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open || targets[kind]) return;
    let live = true;
    const options: Record<TargetKind, Promise<TargetOption[]>> = {
      stakeholder: listAllPages((page) =>
        rpc.equity.stakeholders.list({ page, pageSize: 500 }),
      ).then((rows) => rows.map((item) => ({ id: item.id, label: item.name }))),
      certificate: listAllPages((page) =>
        rpc.equity.certificates.list({ page, pageSize: 500 }),
      ).then((rows) => rows.map((item) => ({ id: item.id, label: item.label }))),
      round: listAllPages((page) => rpc.equity.fundingRounds.list({ page, pageSize: 100 })).then(
        (rows) => rows.map((item) => ({ id: item.id, label: item.name })),
      ),
    };
    options[kind]
      .then((list) => {
        if (live) setTargets((current) => ({ ...current, [kind]: list }));
      })
      .catch((cause: unknown) => {
        if (!live) return;
        setTargets((current) => ({ ...current, [kind]: [] }));
        enqueueNotificationToast({
          id: "cap-table-document-targets-load-failed",
          title: t`Could not load the list`,
          body: errorText(cause),
        });
      });
    return () => {
      live = false;
    };
  }, [open, kind, targets]);

  const attach = async () => {
    setSaving(true);
    try {
      const link = await rpc.equity.documentLinks.create({
        dataRoomItemId: itemId,
        target: { kind, id: targetId },
      });
      onCreated(link);
      onOpenChange(false);
    } catch (cause) {
      enqueueNotificationToast({
        id: "cap-table-document-attach-failed",
        title: t`Could not attach the document`,
        body: errorText(cause),
      });
    } finally {
      setSaving(false);
    }
  };

  const list = targets[kind] ?? null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t`Attach document`}</DialogTitle>
        </DialogHeader>
        {items == null ? (
          <Skeleton className="h-9 w-full" />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t`No documents in the Data room`}</p>
        ) : (
          <NativeSelect
            aria-label={t`Document`}
            value={itemId}
            onChange={(event) => setItemId(event.target.value)}
          >
            <NativeSelectOption value="">{t`Choose a document`}</NativeSelectOption>
            {items.map((item) => (
              <NativeSelectOption key={item.id} value={item.id}>
                {item.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
        <NativeSelect
          aria-label={t`Attach to`}
          value={kind}
          onChange={(event) => {
            setKind(event.target.value as TargetKind);
            setTargetId("");
          }}
        >
          <NativeSelectOption value="stakeholder">{t`Stakeholder`}</NativeSelectOption>
          <NativeSelectOption value="certificate">{t`Certificate`}</NativeSelectOption>
          <NativeSelectOption value="round">{t`Round`}</NativeSelectOption>
        </NativeSelect>
        {list == null ? (
          <Skeleton className="h-9 w-full" />
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t`No records to attach to`}</p>
        ) : (
          <NativeSelect
            aria-label={KIND_LABEL[kind]}
            value={targetId}
            onChange={(event) => setTargetId(event.target.value)}
          >
            <NativeSelectOption value="">{t`Choose a record`}</NativeSelectOption>
            {list.map((option) => (
              <NativeSelectOption key={option.id} value={option.id}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t`Cancel`}
          </Button>
          <Button disabled={!itemId || !targetId || saving} onClick={() => void attach()}>
            {t`Save`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
