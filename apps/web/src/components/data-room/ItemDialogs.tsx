import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { DataRoomApiItem } from "@rakazo/contracts";
import { DataRoomApiName } from "@rakazo/contracts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
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

/** The Move select's value for "put it in a new folder", which no folder id can equal. */
const NEW_FOLDER = "__new__";

/** Rename, Move (optionally into a new folder) or Delete (after a confirmation) for one item. `onDone` runs after the server accepts it. */
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
  const [target, setTarget] = useState(item.folderId ?? "");

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
            <AlertDialogDescription>
              <Trans>This can't be undone.</Trans>
            </AlertDialogDescription>
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
    } else if (target === NEW_FOLDER) {
      const name = DataRoomApiName.safeParse(String(data.get("folderName") ?? "").trim());
      if (!name.success) return setError(t`Enter a folder name without slashes`);
      void run(async () => {
        const folder = await rpc.dataRoom.folderCreate({ name: name.data });
        return rpc.dataRoom.itemMove({ id: item.id, folderId: folder.id });
      });
    } else {
      void run(() => rpc.dataRoom.itemMove({ id: item.id, folderId: target || null }));
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="break-words leading-snug">
              {action === "rename" ? t`Rename ${item.name}` : t`Move ${item.name} to`}
            </DialogTitle>
          </DialogHeader>
          {action === "rename" ? (
            <Input
              name="name"
              aria-label={t`Name`}
              aria-invalid={error ? true : undefined}
              defaultValue={item.name}
              autoFocus
            />
          ) : (
            <>
              <NativeSelect
                name="folder"
                aria-label={t`Folder`}
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                className="w-full"
              >
                <NativeSelectOption value="">{t`No folder`}</NativeSelectOption>
                {folders.map(({ folder, path }) => (
                  <NativeSelectOption key={folder.id} value={folder.id}>
                    {path}
                  </NativeSelectOption>
                ))}
                <NativeSelectOption value={NEW_FOLDER}>{t`New folder…`}</NativeSelectOption>
              </NativeSelect>
              {target === NEW_FOLDER ? (
                <Input
                  name="folderName"
                  aria-label={t`New folder name`}
                  placeholder={t`New folder name`}
                  aria-invalid={error ? true : undefined}
                  autoFocus
                />
              ) : null}
            </>
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
