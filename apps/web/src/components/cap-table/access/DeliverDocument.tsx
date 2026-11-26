import { t } from "@lingui/core/macro";
import type { DataRoomApiItem, EquityAccessHolder } from "@rakazo/contracts";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  enqueueNotificationToast,
  Label,
  NativeSelect,
  NativeSelectOption,
  Skeleton,
} from "@rakazo/ui-web";
import { useEffect, useRef, useState } from "react";
import { listAllCursor } from "../../../lib/list-all";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";

/**
 * Delivers one Data room document to the chosen holders through the investor portal, by sharing
 * it with each holder's linked investor contact. Holders with no contact cannot receive it.
 */
export function DeliverDocument({
  holders,
  open,
  onOpenChange,
}: {
  holders: EquityAccessHolder[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [items, setItems] = useState<DataRoomApiItem[] | null>(null);
  const [itemId, setItemId] = useState("");
  const [emailLink, setEmailLink] = useState(true);
  const [sending, setSending] = useState(false);
  // One key per dialog open, so a retry after a lost response does not deliver twice.
  const requestKey = useRef(crypto.randomUUID());
  const reachable = holders.filter((row) => row.contactId);
  const unreachable = holders.length - reachable.length;

  useEffect(() => {
    if (!open) return;
    requestKey.current = crypto.randomUUID();
    let live = true;
    listAllCursor((cursor) => rpc.dataRoom.items.list({ limit: 100, cursor }))
      .then((all) => {
        if (live) setItems(all.filter((item) => item.source !== "meeting"));
      })
      .catch((cause: unknown) => {
        if (live) setItems([]);
        enqueueNotificationToast({
          id: "cap-table-deliver-load-failed",
          title: t`Could not load documents`,
          body: errorText(cause),
        });
      });
    return () => {
      live = false;
    };
  }, [open]);

  const deliver = async () => {
    setSending(true);
    try {
      await rpc.investors.share({
        itemId,
        contactIds: reachable.map((row) => row.contactId!),
        emailLink,
        requestKey: requestKey.current,
      });
      enqueueNotificationToast({ id: "cap-table-delivered", title: t`Document delivered` });
      onOpenChange(false);
    } catch (cause) {
      enqueueNotificationToast({
        id: "cap-table-deliver-failed",
        title: t`Could not deliver the document`,
        body: errorText(cause),
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t`Deliver a document to ${holders.length} holders`}</DialogTitle>
        </DialogHeader>
        {items == null ? (
          <Skeleton className="h-9 w-full" />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t`No documents in the Data room`}</p>
        ) : (
          <Label className="flex flex-col items-start gap-1.5 text-sm">
            {t`Document`}
            <NativeSelect value={itemId} onChange={(event) => setItemId(event.target.value)}>
              <NativeSelectOption value="">{t`Choose a document`}</NativeSelectOption>
              {items.map((item) => (
                <NativeSelectOption key={item.id} value={item.id}>
                  {item.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Label>
        )}
        <Label className="flex items-center gap-2 text-sm font-normal">
          <Checkbox
            checked={emailLink}
            onCheckedChange={(checked) => setEmailLink(checked === true)}
          />
          {t`Email them a link`}
        </Label>
        {unreachable > 0 ? (
          <p className="text-sm text-muted-foreground">
            {t`${unreachable} without an investor contact will not receive it`}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t`Cancel`}
          </Button>
          <Button
            disabled={!itemId || reachable.length === 0 || sending}
            onClick={() => void deliver()}
          >
            {t`Deliver to ${reachable.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
