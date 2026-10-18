import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { DataRoomApiFolder, DataRoomApiItem, LegalItemLinks } from "@rakazo/contracts";
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
import { type FormEvent, useEffect, useState } from "react";
import { maskCurrencyWhenHidden, useHideAmounts } from "../../lib/hide-amounts-preference";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import type { FolderNode } from "./folders";
import type { ItemAction } from "./ItemMenu";

/** The Move select's value for "put it in a new folder", which no folder id can equal. */
const NEW_FOLDER = "__new__";

export type DataRoomEntry = DataRoomApiItem | DataRoomApiFolder;
export const isFolder = (entry: DataRoomEntry): entry is DataRoomApiFolder => "parentId" in entry;

/** The folder and every folder under it: where a folder cannot move. */
function selfAndBelow(id: string, folders: FolderNode[]) {
  const ids = new Set([id]);
  for (const { folder } of folders) {
    if (folder.parentId && ids.has(folder.parentId)) ids.add(folder.id);
  }
  return ids;
}

/**
 * Rename, Move (optionally into a new folder) or Delete (after a confirmation) for one item or
 * folder. `onDone` runs after the server accepts it.
 */
export function ItemDialog({
  action,
  item,
  folders,
  onClose,
  onDone,
}: {
  action: ItemAction;
  item: DataRoomEntry;
  folders: FolderNode[];
  onClose: () => void;
  onDone: (action: ItemAction, item: DataRoomEntry | null) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const folder = isFolder(item);
  const [target, setTarget] = useState((folder ? item.parentId : item.folderId) ?? "");
  // folderNodes lists parents before children, so one pass finds every folder below.
  const blocked = folder ? selfAndBelow(item.id, folders) : new Set<string>();

  async function run(work: () => Promise<DataRoomEntry | null>) {
    setBusy(true);
    setError("");
    try {
      onDone(action, await work());
      onClose();
    } catch (cause) {
      const conflict = cause instanceof Error && /not empty/i.test(cause.message);
      setError(conflict ? t`Move or delete what is in this folder first.` : errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  if (action === "delete") {
    return (
      <DeleteDialog
        item={item}
        folder={folder}
        busy={busy}
        error={error}
        onClose={onClose}
        onDelete={() =>
          void run(async () => {
            await (folder
              ? rpc.dataRoom.folderDelete({ id: item.id })
              : rpc.dataRoom.itemDelete({ id: item.id }));
            return null;
          })
        }
      />
    );
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (action === "rename") {
      const name = DataRoomApiName.safeParse(String(data.get("name") ?? "").trim());
      if (!name.success) return setError(t`Enter a name without slashes`);
      void run(() =>
        folder
          ? rpc.dataRoom.folderRename({ id: item.id, name: name.data })
          : rpc.dataRoom.itemRename({ id: item.id, name: name.data }),
      );
      return;
    }
    const moveTo = (folderId: string | null) =>
      folder
        ? rpc.dataRoom.folderMove({ id: item.id, parentId: folderId })
        : rpc.dataRoom.itemMove({ id: item.id, folderId });
    if (target === NEW_FOLDER) {
      const name = DataRoomApiName.safeParse(String(data.get("folderName") ?? "").trim());
      if (!name.success) return setError(t`Enter a folder name without slashes`);
      void run(async () => moveTo((await rpc.dataRoom.folderCreate({ name: name.data })).id));
    } else {
      void run(() => moveTo(target || null));
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      {/* Like the Delete confirmation, Cancel closes it; no second close control. */}
      <DialogContent showCloseButton={false}>
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
                <NativeSelectOption value="">
                  {folder ? t`Top level` : t`No folder`}
                </NativeSelectOption>
                {folders
                  .filter((node) => !blocked.has(node.folder.id))
                  .map((node) => (
                    <NativeSelectOption key={node.folder.id} value={node.folder.id}>
                      {node.path}
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

/** Confirms a delete; for a file Legal has read, it also says what Legal loses with it. */
function DeleteDialog({
  item,
  folder,
  busy,
  error,
  onClose,
  onDelete,
}: {
  item: DataRoomEntry;
  folder: boolean;
  busy: boolean;
  error: string;
  onClose: () => void;
  onDelete: () => void;
}) {
  const [links, setLinks] = useState<LegalItemLinks | null>(null);
  useEffect(() => {
    if (folder) return;
    let live = true;
    // Without the answer the dialog still works; it just cannot list what Legal loses.
    rpc.legal
      .itemLinks({ itemId: item.id })
      .then((found) => live && setLinks(found))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [folder, item.id]);
  const deadlines = links?.deadlines ?? 0;
  const deadlineCount = plural(deadlines, { one: "# deadline", other: "# deadlines" });
  useHideAmounts(); // re-render when Hide amounts flips
  const rawTitle = links?.contractTitle;
  const contractTitle = rawTitle ? maskCurrencyWhenHidden(rawTitle) : rawTitle;
  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {folder ? t`Delete the folder ${item.name}?` : t`Delete ${item.name}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {folder ? (
              <Trans>Only an empty folder can be deleted. This can't be undone.</Trans>
            ) : contractTitle ? (
              deadlines > 0 ? (
                <Trans>
                  This also removes the Legal contract {contractTitle}, its {deadlineCount}{" "}
                  (including ones added by hand) and its links in the Legal graph. This can't be
                  undone.
                </Trans>
              ) : (
                <Trans>
                  This also removes the Legal contract {contractTitle} and its links in the Legal
                  graph. This can't be undone.
                </Trans>
              )
            ) : (
              <Trans>This can't be undone.</Trans>
            )}
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
              onDelete();
            }}
          >
            <Trans>Delete</Trans>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
