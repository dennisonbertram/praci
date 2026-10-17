import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { DataRoomApiFolder, DataRoomApiItem } from "@rakazo/contracts";
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
  Label,
  NativeSelect,
  NativeSelectOption,
} from "@rakazo/ui-web";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import type { FolderNode } from "./folders";
import type { ItemAction } from "./ItemMenu";

/** The Move select's value for "put it in a new folder", which no folder id can equal. */
const NEW_FOLDER = "__new__";

export type DataRoomEntry = DataRoomApiItem | DataRoomApiFolder;
export const isFolder = (entry: DataRoomEntry): entry is DataRoomApiFolder => "parentId" in entry;

/** The name with the part before its extension selected, so typing replaces only the name. */
function NameInput({ name, invalid }: { name: string; invalid: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const dot = name.lastIndexOf(".");
    input.current?.setSelectionRange(0, dot > 0 ? dot : name.length);
  }, [name]);
  return (
    <Input
      ref={input}
      name="name"
      aria-label={t`Name`}
      aria-invalid={invalid || undefined}
      defaultValue={name}
      autoFocus
    />
  );
}

/** "Top level" and every folder by path, for choosing where something goes. */
function FolderOptions({
  folders,
  blocked = new Set<string>(),
  topLabel,
}: {
  folders: FolderNode[];
  blocked?: Set<string>;
  topLabel: string;
}) {
  return (
    <>
      <NativeSelectOption value="">{topLabel}</NativeSelectOption>
      {folders
        .filter((node) => !blocked.has(node.folder.id))
        .map((node) => (
          <NativeSelectOption key={node.folder.id} value={node.folder.id}>
            {node.path}
          </NativeSelectOption>
        ))}
    </>
  );
}

/** Creates a folder inside the one chosen (the open folder to start with). */
export function NewFolderDialog({
  folders,
  parentId,
  onClose,
  onDone,
}: {
  folders: FolderNode[];
  parentId: string | undefined;
  onClose: () => void;
  onDone: (folder: DataRoomApiFolder) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = DataRoomApiName.safeParse(String(data.get("folderName") ?? "").trim());
    if (!name.success) return setError(t`Enter a folder name without slashes`);
    setBusy(true);
    setError("");
    rpc.dataRoom
      .folderCreate({ name: name.data, parentId: String(data.get("parent") ?? "") || null })
      .then((folder) => {
        onDone(folder);
        onClose();
      })
      .catch((cause) => setError(errorText(cause)))
      .finally(() => setBusy(false));
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>
              <Trans>New folder</Trans>
            </DialogTitle>
          </DialogHeader>
          <Input
            name="folderName"
            aria-label={t`New folder name`}
            placeholder={t`New folder name`}
            aria-invalid={error ? true : undefined}
            autoFocus
          />
          <NativeSelect
            name="parent"
            aria-label={t`Inside`}
            defaultValue={parentId ?? ""}
            className="w-full"
          >
            <FolderOptions folders={folders} topLabel={t`Top level`} />
          </NativeSelect>
          {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              <Trans>Cancel</Trans>
            </Button>
            <Button type="submit" disabled={busy}>
              <Trans>Create</Trans>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
  const parentField = useId();
  const current = (folder ? item.parentId : item.folderId) ?? "";
  const [target, setTarget] = useState(current);
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
      <AlertDialog open onOpenChange={(open) => !open && onClose()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {folder ? t`Delete the folder ${item.name}?` : t`Delete ${item.name}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {folder ? (
                <Trans>Only an empty folder can be deleted. This can't be undone.</Trans>
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
                void run(async () => {
                  await (folder
                    ? rpc.dataRoom.folderDelete({ id: item.id })
                    : rpc.dataRoom.itemDelete({ id: item.id }));
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
      const parentId = String(data.get("parent") ?? "") || null;
      void run(async () =>
        moveTo((await rpc.dataRoom.folderCreate({ name: name.data, parentId })).id),
      );
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
            <NameInput name={item.name} invalid={Boolean(error)} />
          ) : (
            <>
              <NativeSelect
                name="folder"
                aria-label={t`Folder`}
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                className="w-full"
              >
                <FolderOptions
                  folders={folders}
                  blocked={blocked}
                  topLabel={folder ? t`Top level` : t`No folder`}
                />
                <NativeSelectOption value={NEW_FOLDER}>{t`New folder…`}</NativeSelectOption>
              </NativeSelect>
              {target === NEW_FOLDER ? (
                <>
                  <Input
                    name="folderName"
                    aria-label={t`New folder name`}
                    placeholder={t`New folder name`}
                    aria-invalid={error ? true : undefined}
                    autoFocus
                  />
                  {/* Where the new folder goes: where the item is now, unless chosen otherwise. */}
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={parentField}>
                      <Trans>Inside</Trans>
                    </Label>
                    <NativeSelect
                      id={parentField}
                      name="parent"
                      defaultValue={blocked.has(current) ? "" : current}
                      className="w-full"
                    >
                      <FolderOptions folders={folders} blocked={blocked} topLabel={t`Top level`} />
                    </NativeSelect>
                  </div>
                </>
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
