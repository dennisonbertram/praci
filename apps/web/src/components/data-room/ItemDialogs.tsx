import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type {
  Contact,
  DataRoomApiFolder,
  DataRoomApiItem,
  LegalItemLinks,
  PortalLink,
} from "@rakazo/contracts";
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
  Checkbox,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  NativeSelect,
  NativeSelectOption,
  Skeleton,
} from "@rakazo/ui-web";
import type { FormEvent } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { maskCurrencyWhenHidden, useHideAmounts } from "../../lib/hide-amounts-preference";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { CopyLinkDialog } from "../CopyLinkDialog";
import type { FolderNode } from "./folders";
import { folderContents } from "./folders";
import type { ItemAction } from "./ItemMenu";
import { showNoticeToast } from "./upload-toasts";

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

/** The top level (named as the tree names it) and every folder by path, for choosing a place. */
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
  const parentField = useId();
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={parentField}>
              <Trans>Inside</Trans>
            </Label>
            <NativeSelect
              id={parentField}
              name="parent"
              defaultValue={parentId ?? ""}
              className="w-full"
            >
              <FolderOptions folders={folders} topLabel={t`All items`} />
            </NativeSelect>
          </div>
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
  onOpenFolder,
}: {
  action: ItemAction;
  item: DataRoomEntry;
  folders: FolderNode[];
  onClose: () => void;
  onDone: (action: ItemAction, item: DataRoomEntry | null) => void;
  /** A folder that cannot be deleted yet offers to open it, to move or delete what it holds. */
  onOpenFolder?: (id: string) => void;
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

  if (action === "share" && !folder) return <ShareDialog item={item} onClose={onClose} />;

  if (action === "delete") {
    // A folder with something in it cannot be deleted: say so before, not after, the click.
    const full =
      folder &&
      ((item.itemCount ?? 0) > 0 || folders.some((node) => node.folder.parentId === item.id));
    const holds = full
      ? folderContents(
          item,
          folders.map((node) => node.folder),
        )
      : "";
    return (
      <DeleteDialog
        item={item}
        folder={folder}
        full={full}
        holds={holds}
        onOpenFolder={onOpenFolder}
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
                  topLabel={folder ? t`All items` : t`No folder`}
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
                      <FolderOptions folders={folders} blocked={blocked} topLabel={t`All items`} />
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

/**
 * Share with investors: the investor contacts who already have the file show Unshare, the others a
 * checkbox. Links are emailed by default; ones that cannot be emailed are shown once to paste.
 */
function ShareDialog({ item, onClose }: { item: DataRoomApiItem; onClose: () => void }) {
  const [investors, setInvestors] = useState<Contact[] | null>(null);
  const [shared, setShared] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [emailLink, setEmailLink] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [links, setLinks] = useState<PortalLink[] | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([
      rpc.contacts.list({ kind: "investor" }),
      rpc.investors.shares({ itemId: item.id }),
    ])
      .then(([list, ids]) => {
        if (!live) return;
        setInvestors(list);
        setShared(new Set(ids));
      })
      .catch((cause) => live && setError(errorText(cause, t`Could not load investors`)));
    return () => {
      live = false;
    };
  }, [item.id]);

  if (links) return <CopyLinkDialog links={links} onClose={onClose} />;

  const unshare = async (contactId: string) => {
    setBusy(true);
    setError("");
    try {
      await rpc.investors.unshare({ itemId: item.id, contactId });
      setShared((current) => new Set([...current].filter((id) => id !== contactId)));
    } catch (cause) {
      setError(errorText(cause, t`Could not unshare`));
    } finally {
      setBusy(false);
    }
  };
  const share = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await rpc.investors.share({
        itemId: item.id,
        contactIds: [...picked],
        emailLink,
      });
      if (result.links.length > 0) setLinks(result.links);
      else {
        showNoticeToast(t`Shared ${item.name}`);
        onClose();
      }
    } catch (cause) {
      setError(errorText(cause, t`Could not share`));
      setBusy(false);
    }
  };

  // A revoked investor cannot use a file, so only one who already has it is listed (to unshare).
  const rows = (investors ?? []).filter((c) => shared.has(c.id) || !c.portalBlockedAt);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="break-words leading-snug">{t`Share ${item.name}`}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-1">
          {investors === null && !error ? (
            <Skeleton className="h-9 w-full" aria-busy="true" />
          ) : null}
          {investors && rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              <Trans>No investors yet</Trans>
            </p>
          ) : null}
          {rows.map((contact) =>
            shared.has(contact.id) ? (
              <div key={contact.id} className="flex min-h-9 items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{contact.name}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void unshare(contact.id)}
                >
                  <Trans>Unshare</Trans>
                </Button>
              </div>
            ) : (
              <div
                key={contact.id}
                className="flex min-h-9 items-center gap-2 text-sm pointer-coarse:min-h-11"
              >
                <Checkbox
                  id={`share-${contact.id}`}
                  checked={picked.has(contact.id)}
                  onCheckedChange={(next) =>
                    setPicked((current) => {
                      const updated = new Set(current);
                      if (next) updated.add(contact.id);
                      else updated.delete(contact.id);
                      return updated;
                    })
                  }
                />
                <label htmlFor={`share-${contact.id}`} className="min-w-0 flex-1 truncate py-1">
                  {contact.name}
                </label>
              </div>
            ),
          )}
          {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
        </DialogBody>
        <DialogFooter className="items-center">
          <div className="me-auto flex items-center gap-2 text-sm">
            <Checkbox
              id="share-email-link"
              checked={emailLink}
              onCheckedChange={(next) => setEmailLink(next === true)}
            />
            <label htmlFor="share-email-link">
              <Trans>Email them a link</Trans>
            </label>
          </div>
          <Button type="button" variant="outline" onClick={onClose}>
            <Trans>Cancel</Trans>
          </Button>
          <Button type="button" disabled={busy || picked.size === 0} onClick={() => void share()}>
            <Trans>Share</Trans>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Confirms a delete; for a file Legal has read, it also says what Legal loses with it. */
function DeleteDialog({
  item,
  folder,
  full,
  holds,
  onOpenFolder,
  busy,
  error,
  onClose,
  onDelete,
}: {
  item: DataRoomEntry;
  folder: boolean;
  /** A folder with something in it: it cannot be deleted, so the dialog says what it holds. */
  full: boolean;
  holds: string;
  onOpenFolder?: (id: string) => void;
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
            {full
              ? t`The folder ${item.name} isn't empty`
              : folder
                ? t`Delete the folder ${item.name}?`
                : t`Delete ${item.name}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {full ? (
              <Trans>
                It holds {holds}. Move or delete what is in it first; only an empty folder can be
                deleted.
              </Trans>
            ) : folder ? (
              <Trans>This can't be undone.</Trans>
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
          {full ? (
            onOpenFolder ? (
              <AlertDialogAction
                onClick={() => {
                  onOpenFolder(item.id);
                  onClose();
                }}
              >
                <Trans>Open folder</Trans>
              </AlertDialogAction>
            ) : null
          ) : (
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
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
