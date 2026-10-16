import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { InboxMessage, MailRow } from "@rakazo/contracts";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@rakazo/ui-web";
import { Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { sizeText } from "./format";

const SEARCH_DEBOUNCE_MS = 300;

type Attachment = InboxMessage["attachments"][number];
type Picks = Map<string, { messageId: string; attachmentId: string }>;
const pickKey = (messageId: string, attachmentId: string) => `${messageId}\u0000${attachmentId}`;

function MessageRow({
  row,
  picks,
  onToggle,
}: {
  row: MailRow;
  picks: Picks;
  onToggle: (messageId: string, attachmentId: string) => void;
}) {
  const [files, setFiles] = useState<Attachment[] | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  function toggle() {
    setOpen(!open);
    if (files || open) return;
    setError("");
    rpc.inbox
      .get({ messageId: row.id })
      .then((message) => setFiles(message.attachments))
      .catch((cause) => setError(errorText(cause)));
  }
  return (
    <li className="border-b border-border">
      <button
        type="button"
        aria-expanded={open}
        onClick={toggle}
        className="flex w-full flex-col items-start px-3 py-2 text-start text-sm hover:bg-muted"
      >
        <span className="max-w-full truncate font-medium">{row.subject}</span>
        <span className="max-w-full truncate text-xs text-muted-foreground">{row.from}</span>
      </button>
      {open ? (
        <div className="flex flex-col gap-1 px-3 pb-2">
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          {files?.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              <Trans>No files found</Trans>
            </p>
          ) : null}
          {files?.map((file) => (
            <div key={file.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                aria-label={file.filename}
                checked={picks.has(pickKey(row.id, file.id))}
                onCheckedChange={() => onToggle(row.id, file.id)}
              />
              <span className="min-w-0 flex-1 truncate">{file.filename}</span>
              <span className="text-xs text-muted-foreground">{sizeText(file.size)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </li>
  );
}

function EmailPicker({
  folderId,
  onClose,
  onDone,
}: {
  folderId: string | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<MailRow[]>([]);
  const [next, setNext] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [picks, setPicks] = useState<Picks>(new Map());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  // Only the answer for the search still on screen is kept.
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    rpc.inbox
      .list({ filter: "attachment", ...(query ? { query } : {}) })
      .then((page) => {
        if (!current) return;
        setRows(page.rows);
        setNext(page.nextPageToken);
      })
      .catch((cause) => current && setError(errorText(cause)))
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [query]);

  async function loadMore() {
    setLoading(true);
    try {
      const page = await rpc.inbox.list({
        filter: "attachment",
        ...(query ? { query } : {}),
        pageToken: next,
      });
      setRows((prev) => [...prev, ...page.rows]);
      setNext(page.nextPageToken);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setLoading(false);
    }
  }

  function toggle(messageId: string, attachmentId: string) {
    setPicks((prev) => {
      const copy = new Map(prev);
      const key = pickKey(messageId, attachmentId);
      if (copy.has(key)) copy.delete(key);
      else copy.set(key, { messageId, attachmentId });
      return copy;
    });
  }

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const { imported, duplicates } = await rpc.dataRoom.importEmail({
        picks: [...picks.values()],
        folderId,
      });
      onDone(
        imported === 0 && duplicates > 0
          ? t`Already in the Data room`
          : plural(imported, { one: "Imported # file", other: "Imported # files" }),
      );
      onClose();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Import from email</Trans>
          </DialogTitle>
        </DialogHeader>
        <Input
          type="search"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={t`Search mail`}
          aria-label={t`Search mail`}
        />
        <div className="rk-scroll max-h-80 overflow-y-auto rounded-md border border-border">
          {error ? <p className="p-3 text-sm text-destructive">{error}</p> : null}
          {!loading && !error && rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              <Trans>No files found</Trans>
            </p>
          ) : (
            <ul>
              {rows.map((row) => (
                <MessageRow key={row.id} row={row} picks={picks} onToggle={toggle} />
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
            <Trans>Import</Trans>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * One button per import source. Add another source by adding a button here. With no Gmail account
 * connected the email button leads to the connection page instead.
 */
export function ImportSources({
  folderId,
  onDone,
  compact = false,
}: {
  folderId: string | null;
  onDone: (message: string) => void;
  compact?: boolean;
}) {
  const navigate = useNavigate();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let current = true;
    rpc.connections
      .list()
      .then(
        (rows) =>
          current &&
          setConnected(
            rows.some(
              (row) =>
                row.connectorId === "google" &&
                row.provider === "gmail" &&
                row.status === "connected",
            ),
          ),
      )
      .catch(() => current && setConnected(false));
    return () => {
      current = false;
    };
  }, []);
  if (connected === null) return null;
  const label = connected ? t`Import from email` : t`Connect Gmail`;
  return (
    <>
      <Button
        variant="outline"
        size={compact ? "icon" : "default"}
        aria-label={compact ? label : undefined}
        onClick={() => (connected ? setOpen(true) : navigate("/app/integrations/app/google/gmail"))}
      >
        <Mail aria-hidden="true" />
        {compact ? null : label}
      </Button>
      {open ? (
        <EmailPicker folderId={folderId} onClose={() => setOpen(false)} onDone={onDone} />
      ) : null}
    </>
  );
}
