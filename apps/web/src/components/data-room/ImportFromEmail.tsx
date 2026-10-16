import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { InboxListOutput, InboxMessage, MailRow } from "@rakazo/contracts";
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
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { syncErrorText } from "../../lib/inbox-sync-error";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { failedText, importedText, sizeText } from "./format";
import { DriveImportButton } from "./ImportFromDrive";

const SEARCH_DEBOUNCE_MS = 300;
/** The most attachments one import call accepts. */
const MAX_PICKS = 20;
const GMAIL_PAGE = "/app/integrations/app/google/gmail";

type Attachment = InboxMessage["attachments"][number];
type Picks = Map<string, { messageId: string; attachmentId: string }>;
const pickKey = (messageId: string, attachmentId: string) => `${messageId}\u0000${attachmentId}`;

function MessageRow({
  row,
  picks,
  full,
  onToggle,
}: {
  row: MailRow;
  picks: Picks;
  /** No more files can be ticked. */
  full: boolean;
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
                disabled={full && !picks.has(pickKey(row.id, file.id))}
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
  onDone: (message: string, changed: boolean) => void;
}) {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<MailRow[]>([]);
  const [next, setNext] = useState<string | undefined>();
  const [mailProblem, setMailProblem] = useState<Pick<
    InboxListOutput,
    "failedAccounts" | "reconnectAccounts"
  > | null>(null);
  const [loading, setLoading] = useState(true);
  // Counts searches; an answer for an older one is dropped.
  const search = useRef(0);
  const [error, setError] = useState("");
  const [picks, setPicks] = useState<Picks>(new Map());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  const listInput = (pageToken?: string) => ({
    filter: "attachment" as const,
    ...(query ? { query } : {}),
    ...(pageToken ? { pageToken } : {}),
  });
  /** Failed accounts are an error only when they leave nothing to show. */
  const problemOf = (page: InboxListOutput) =>
    page.failedAccounts.length > 0 &&
    (page.rows.length === 0 || page.failedAccounts.length >= page.accounts.length)
      ? { failedAccounts: page.failedAccounts, reconnectAccounts: page.reconnectAccounts }
      : null;

  useEffect(() => {
    const mine = ++search.current;
    setLoading(true);
    setError("");
    setMailProblem(null);
    rpc.inbox
      .list(listInput())
      .then((page) => {
        if (mine !== search.current) return;
        setRows(page.rows);
        setNext(page.nextPageToken);
        setMailProblem(problemOf(page));
      })
      .catch((cause) => mine === search.current && setError(errorText(cause)))
      .finally(() => mine === search.current && setLoading(false));
  }, [query]);

  async function loadMore() {
    const mine = search.current;
    setLoading(true);
    try {
      const page = await rpc.inbox.list(listInput(next));
      if (mine !== search.current) return;
      setRows((prev) => [...prev, ...page.rows]);
      setNext(page.nextPageToken);
    } catch (cause) {
      if (mine === search.current) setError(errorText(cause));
    } finally {
      if (mine === search.current) setLoading(false);
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
      const { imported, duplicates, failed } = await rpc.dataRoom.importEmail({
        picks: [...picks.values()],
        folderId,
      });
      onDone(
        imported > 0 || (duplicates > 0 && failed === 0) ? importedText(imported, duplicates) : "",
        imported > 0 || duplicates > 0,
      );
      if (failed === 0) onClose();
      else setError(failedText(failed));
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
          {mailProblem ? (
            <p className="p-3 text-sm text-destructive">
              {syncErrorText(mailProblem) || t`Couldn't load mail`}{" "}
              {mailProblem.reconnectAccounts.length > 0 ? (
                <Link to={GMAIL_PAGE} className="underline underline-offset-2">
                  <Trans>Reconnect</Trans>
                </Link>
              ) : null}
            </p>
          ) : null}
          {!loading && !error && !mailProblem && rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              <Trans>No files found</Trans>
            </p>
          ) : (
            <ul>
              {rows.map((row) => (
                <MessageRow
                  key={row.id}
                  row={row}
                  picks={picks}
                  full={picks.size >= MAX_PICKS}
                  onToggle={toggle}
                />
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

const isConnected = (
  rows: { connectorId: string; provider: string; status: string }[],
  app: string,
) =>
  rows.some(
    (row) => row.connectorId === "google" && row.provider === app && row.status === "connected",
  );

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
  onDone: (message: string, changed: boolean) => void;
  compact?: boolean;
}) {
  const navigate = useNavigate();
  const [connected, setConnected] = useState<{ gmail: boolean; drive: boolean } | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let current = true;
    rpc.connections
      .list()
      .then(
        (rows) =>
          current &&
          setConnected({
            gmail: rows.some(
              (row) => row.status === "connected" && row.provider.trim().toLowerCase() === "gmail",
            ),
            drive: isConnected(rows, "googledrive"),
          }),
      )
      .catch(() => current && setConnected({ gmail: false, drive: false }));
    return () => {
      current = false;
    };
  }, []);
  if (connected === null) return null;
  const label = connected.gmail ? t`Import from email` : t`Connect Gmail`;
  return (
    <>
      <Button
        variant="outline"
        size={compact ? "icon" : "default"}
        aria-label={compact ? label : undefined}
        onClick={() => (connected.gmail ? setOpen(true) : navigate(GMAIL_PAGE))}
      >
        <Mail aria-hidden="true" />
        {compact ? null : label}
      </Button>
      {open ? (
        <EmailPicker folderId={folderId} onClose={() => setOpen(false)} onDone={onDone} />
      ) : null}
      <DriveImportButton
        connected={connected.drive}
        compact={compact}
        folderId={folderId}
        onDone={onDone}
      />
    </>
  );
}
