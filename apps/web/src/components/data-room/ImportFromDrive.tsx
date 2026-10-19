import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { DataRoomApiDriveFile } from "@rakazo/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@rakazo/ui-web";
import { ArrowLeft, Box, HardDrive } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { dataRoomImportStarted } from "../../lib/data-room";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { DriveRow } from "./DriveRow";
import { TOOLBAR_BUTTON, TOOLBAR_LABEL, ToolbarTip } from "./FilterBar";
import { failedText, importedText, importingText } from "./format";

const SEARCH_DEBOUNCE_MS = 300;
/** The most files, and the most folders, the server takes in one import. */
const MAX_PICKS = 20;
const GOOGLE_APPS = "application/vnd.google-apps.";
// Drive exports these to PDF; other Google files (forms, shortcuts, ...) have nothing to download.
const EXPORTABLE = ["document", "spreadsheet", "presentation", "drawing"].map(
  (kind) => GOOGLE_APPS + kind,
);
const importable = (file: DataRoomApiDriveFile) =>
  !file.mimeType.startsWith(GOOGLE_APPS) || EXPORTABLE.includes(file.mimeType);

function DrivePicker({
  box = false,
  folderId,
  onClose,
  onDone,
}: {
  /** Browse and import the user's Box instead of Google Drive; the picker is the same. */
  box?: boolean;
  folderId: string | null;
  onClose: () => void;
  onDone: (message: string, changed: boolean) => void;
}) {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  // The Drive folders opened so far; empty is My Drive.
  const [path, setPath] = useState<{ id: string; name: string }[]>([]);
  const [files, setFiles] = useState<DataRoomApiDriveFile[]>([]);
  const [next, setNext] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Ticked files and folders by Drive id (true for a folder); kept across folders and searches.
  const [picks, setPicks] = useState<Map<string, boolean>>(new Map());
  const [busy, setBusy] = useState(false);
  const here = path.at(-1)?.id;
  const list = box ? rpc.dataRoom.boxList : rpc.dataRoom.driveList;
  // Which listing is on screen; an answer for an earlier folder or search is dropped.
  const listing = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  // Only the answer for the folder or search still on screen is kept.
  useEffect(() => {
    let current = true;
    const id = ++listing.current;
    setLoading(true);
    setError("");
    list(query ? { query } : here ? { folderId: here } : {})
      .then((page) => {
        if (!current) return;
        setFiles(page.files);
        setNext(page.nextPageToken);
      })
      .catch((cause) => current && setError(errorText(cause)))
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [query, here]);

  async function loadMore() {
    const id = listing.current;
    setLoading(true);
    try {
      const page = await list({
        ...(query ? { query } : here ? { folderId: here } : {}),
        pageToken: next,
      });
      if (id !== listing.current) return;
      setFiles((prev) => [...prev, ...page.files]);
      setNext(page.nextPageToken);
    } catch (cause) {
      if (id === listing.current) setError(errorText(cause));
    } finally {
      if (id === listing.current) setLoading(false);
    }
  }

  function open(folder: DataRoomApiDriveFile) {
    setInput("");
    setQuery("");
    setPath((prev) => [...prev, { id: folder.id, name: folder.name }]);
  }

  function toggle(file: DataRoomApiDriveFile) {
    setPicks((prev) => {
      const copy = new Map(prev);
      if (!copy.delete(file.id)) copy.set(file.id, file.isFolder);
      return copy;
    });
  }

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const ids = [...picks];
      const fileIds = ids.filter(([, isFolder]) => !isFolder).map(([id]) => id);
      const folderIds = ids.filter(([, isFolder]) => isFolder).map(([id]) => id);
      const { imported, duplicates, failed, queued, folders } = box
        ? await rpc.dataRoom.importBox({ fileIds, boxFolderIds: folderIds, folderId })
        : await rpc.dataRoom.importDrive({ fileIds, driveFolderIds: folderIds, folderId });
      // The folders and files of a folder import are written by background jobs.
      const waiting = queued ?? 0;
      onDone(
        waiting > 0
          ? importingText(waiting)
          : imported > 0 || (duplicates > 0 && failed === 0)
            ? importedText(imported, duplicates)
            : "",
        imported > 0 || duplicates > 0 || waiting > 0 || (folders ?? 0) > 0,
      );
      dataRoomImportStarted();
      if (failed === 0) onClose();
      else setError(failedText(failed));
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {box ? <Trans>Import from Box</Trans> : <Trans>Import from Google Drive</Trans>}
          </DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2">
          {path.length > 0 && !query ? (
            <Button
              variant="outline"
              size="icon"
              aria-label={t`Back`}
              onClick={() => setPath((prev) => prev.slice(0, -1))}
            >
              <ArrowLeft aria-hidden="true" />
            </Button>
          ) : null}
          <Input
            type="search"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={box ? t`Search Box` : t`Search Drive`}
            aria-label={box ? t`Search Box` : t`Search Drive`}
          />
        </div>
        <div className="rk-scroll max-h-80 overflow-y-auto rounded-md border border-border">
          {error ? <p className="p-3 text-sm text-destructive">{error}</p> : null}
          {!loading && !error && files.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              <Trans>No files found</Trans>
            </p>
          ) : (
            <ul>
              {files.map((file) => (
                <li key={file.id} className="border-b border-border">
                  <DriveRow
                    file={file}
                    checked={picks.has(file.id)}
                    disabled={
                      (!box && !file.isFolder && !importable(file)) ||
                      (!picks.has(file.id) && picks.size >= MAX_PICKS)
                    }
                    onToggle={() => toggle(file)}
                    onOpen={() => open(file)}
                  />
                </li>
              ))}
            </ul>
          )}
          {next ? (
            <div className="grid place-items-center p-2">
              <Button
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => void loadMore()}
              >
                <Trans>Load more</Trans>
              </Button>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button disabled={busy || picks.size === 0} onClick={() => void submit()}>
            {picks.size > 0 ? t`Import ${picks.size}` : t`Import`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The Drive import button. With no Drive account connected it leads to the connection page instead.
 * The server uses the first connected Drive account.
 */
export function DriveImportButton({
  connected,
  compact,
  folderId,
  onDone,
}: {
  connected: boolean;
  compact: boolean;
  folderId: string | null;
  onDone: (message: string, changed: boolean) => void;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const label = connected ? t`Import from Google Drive` : t`Connect Google Drive`;
  return (
    <>
      <ToolbarTip label={label} compact={compact}>
        <Button
          variant="outline"
          className={compact ? TOOLBAR_BUTTON : undefined}
          onClick={() =>
            connected ? setOpen(true) : navigate("/app/integrations/app/google/googledrive")
          }
        >
          <HardDrive aria-hidden="true" />
          <span className={compact ? TOOLBAR_LABEL : undefined}>{label}</span>
        </Button>
      </ToolbarTip>
      {open ? (
        <DrivePicker folderId={folderId} onClose={() => setOpen(false)} onDone={onDone} />
      ) : null}
    </>
  );
}

/** The Box import button. Shown only once a Box account is connected; the server uses that account. */
export function BoxImportButton({
  compact,
  folderId,
  onDone,
}: {
  compact: boolean;
  folderId: string | null;
  onDone: (message: string, changed: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = t`Import from Box`;
  return (
    <>
      <ToolbarTip label={label} compact={compact}>
        <Button
          variant="outline"
          className={compact ? TOOLBAR_BUTTON : undefined}
          onClick={() => setOpen(true)}
        >
          <Box aria-hidden="true" />
          <span className={compact ? TOOLBAR_LABEL : undefined}>{label}</span>
        </Button>
      </ToolbarTip>
      {open ? (
        <DrivePicker box folderId={folderId} onClose={() => setOpen(false)} onDone={onDone} />
      ) : null}
    </>
  );
}
