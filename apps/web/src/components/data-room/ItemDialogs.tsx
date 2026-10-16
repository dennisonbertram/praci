import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { DataRoomApiItem } from "@rakazo/contracts";
import { DataRoomApiName } from "@rakazo/contracts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  NativeSelect,
  NativeSelectOption,
} from "@rakazo/ui-web";
import { type FormEvent, useState } from "react";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import type { FolderNode } from "./folders";
import type { ItemAction } from "./ItemMenu";

/** Rename, Move or Delete (after a confirmation) for one item. `onDone` runs after the server accepts it. */
export function ItemDialog({
  action,
  item,
  folders,
  onClose,
  onDone,
}: {
  action: ItemAction;
  item: DataRoomApiItem;
  folders: FolderNode[];
  onClose: () => void;
  onDone: (action: ItemAction, item: DataRoomApiItem | null) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(work: () => Promise<DataRoomApiItem | null>) {
    setBusy(true);
    setError("");
    try {
      onDone(action, await work());
      onClose();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  if (action === "delete") {
    return (
      <AlertDialog open onOpenChange={(open) => !open && onClose()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t`Delete ${item.name}?`}</AlertDialogTitle>
          </AlertDialogHeader>
          {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Trans>Cancel</Trans>
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={(event) => {
                // Stay open to show an error.
                event.preventDefault();
                void run(async () => {
                  await rpc.dataRoom.itemDelete({ id: item.id });
                  return null;
                });
              }}
            >
              <Trans>Delete</Trans>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (action === "rename") {
      const name = DataRoomApiName.safeParse(String(data.get("name") ?? "").trim());
      if (!name.success) return setError(t`Enter a name without slashes`);
      void run(() => rpc.dataRoom.itemRename({ id: item.id, name: name.data }));
    } else {
      void run(() =>
        rpc.dataRoom.itemMove({ id: item.id, folderId: String(data.get("folder") ?? "") || null }),
      );
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{action === "rename" ? t`Rename` : t`Move`}</DialogTitle>
          </DialogHeader>
          {action === "rename" ? (
            <Input name="name" aria-label={t`Name`} defaultValue={item.name} autoFocus />
          ) : (
            <NativeSelect
              name="folder"
              aria-label={t`Folder`}
              defaultValue={item.folderId ?? ""}
              className="w-full"
            >
              <NativeSelectOption value="">{t`No folder`}</NativeSelectOption>
              {folders.map(({ folder, path }) => (
                <NativeSelectOption key={folder.id} value={folder.id}>
                  {path}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
          {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              <Trans>Cancel</Trans>
            </Button>
            <Button type="submit" disabled={busy}>
              <Trans>Save</Trans>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
