import { plural, t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { InboxListOutput, InboxMessage, MailRow } from "@rakazo/contracts";
import { isBoxEndpoint } from "@rakazo/contracts";
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
import { dataRoomImportStarted } from "../../lib/data-room";
import { syncErrorText } from "../../lib/inbox-sync-error";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";
import { DriveRow } from "./DriveRow";
import { TOOLBAR_BUTTON, TOOLBAR_LABEL, ToolbarTip } from "./FilterBar";
import { dateText, failedText, importedText, isNoiseImage } from "./format";
import { BoxImportButton, DriveImportButton } from "./ImportFromDrive";

const SEARCH_DEBOUNCE_MS = 300;
/** The most attachments one import call accepts. */
const MAX_PICKS = 20;
const GMAIL_PAGE = "/app/integrations/app/google/gmail";

type Attachment = InboxMessage["attachments"][number];
/** A message with the documents it carries; `filed` names those already in the Data room. */
type Item = { row: MailRow; files: Attachment[]; filed: Set<string> };
type Picks = Map<string, { messageId: string; attachmentId: string }>;
const pickKey = (messageId: string, attachmentId: string) => `${messageId}\u0000${attachmentId}`;

/**
 * The messages that carry real documents. Every page costs one `inbox.get` per message (attachment
 * lists are not in the list rows); messages with only signature pictures are left out.
 * ponytail: one call per row; a list-level attachment field would remove them.
 */
async function loadItems(rows: MailRow[]): Promise<Item[]> {
  if (rows.length === 0) return [];
  const [messages, imported] = await Promise.all([
    Promise.all(rows.map((row) => rpc.inbox.get({ messageId: row.id }))),
    rpc.dataRoom.emailImported({ messageIds: rows.map((row) => row.id) }),
  ]);
  const filed = new Set(imported.files.map((f) => pickKey(f.messageId, f.attachmentId)));
  return rows
    .map((row, i) => ({
      row,
      files: (messages[i]?.attachments ?? []).filter((file) => !isNoiseImage(file)),
      filed,
    }))
    .filter((item) => item.files.length > 0);
}

function MessageRow({
  item,
  picks,
  full,
  onToggle,
}: {
  item: Item;
  picks: Picks;
  /** No more files can be ticked. */
  full: boolean;
  onToggle: (messageId: string, attachmentIds: string[], on: boolean) => void;
}) {
  const { row, files, filed } = item;
  const free = files.filter((file) => !filed.has(pickKey(row.id, file.id)));
  const all = free.length > 0 && free.every((file) => picks.has(pickKey(row.id, file.id)));
  return (
    <li className="border-b border-border">
      <div className="flex items-start gap-2 px-3 py-2 text-sm">
        <Checkbox
          aria-label={t`Select ${row.subject}`}
          className="mt-0.5"
          disabled={free.length === 0 || (full && !all)}
          checked={all || free.length === 0}
          onCheckedChange={(on) =>
            onToggle(
              row.id,
              free.map((file) => file.id),
              on,
            )
          }
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{row.subject}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.from} · {dateText(row.receivedAt)}
          </p>
        </div>
      </div>
      <div className="ps-6">
        {files.map((file) => {
          const done = filed.has(pickKey(row.id, file.id));
          return (
            <DriveRow
              key={file.id}
              file={{
                id: file.id,
                name: file.filename,
                mimeType: file.mimeType,
                size: file.size,
                isFolder: false,
              }}
              showCheckbox
              checked={done || picks.has(pickKey(row.id, file.id))}
              disabled={done || (full && !picks.has(pickKey(row.id, file.id)))}
              note={done ? t`In Data room` : undefined}
              onToggle={() => onToggle(row.id, [file.id], !picks.has(pickKey(row.id, file.id)))}
              onOpen={() => undefined}
            />
          );
        })}
      </div>
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
  const [items, setItems] = useState<Item[]>([]);
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
      .then(async (page) => {
        const loaded = await loadItems(page.rows);
        if (mine !== search.current) return;
        setItems(loaded);
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
      const loaded = await loadItems(page.rows);
      if (mine !== search.current) return;
      setItems((prev) => [...prev, ...loaded]);
      setNext(page.nextPageToken);
    } catch (cause) {
      if (mine === search.current) setError(errorText(cause));
    } finally {
      if (mine === search.current) setLoading(false);
    }
  }

  /** Ticks or unticks files of one message; a tick stops at the import limit. */
  function toggle(messageId: string, attachmentIds: string[], on: boolean) {
    setPicks((prev) => {
      const copy = new Map(prev);
      for (const attachmentId of attachmentIds) {
        const key = pickKey(messageId, attachmentId);
        if (!on) copy.delete(key);
        else if (copy.size < MAX_PICKS) copy.set(key, { messageId, attachmentId });
      }
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
          {loading && items.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground" role="status">
              <Trans>Loading…</Trans>
            </p>
          ) : !loading && !error && !mailProblem && items.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              <Trans>No files found</Trans>
            </p>
          ) : (
            <ul>
              {items.map((item) => (
                <MessageRow
                  key={item.row.id}
                  item={item}
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
            {picks.size > 0
              ? plural(picks.size, { one: "Import # file", other: "Import # files" })
              : t`Import`}
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
  // offered: the server's catalog has the app, so its connection page exists. A button never leads
  // to the page's "isn't available on this server" dead end.
  const [apps, setApps] = useState<{
    gmail: { connected: boolean; offered: boolean };
    drive: { connected: boolean; offered: boolean };
    box: boolean;
  } | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let current = true;
    const none = { connected: false, offered: false };
    Promise.all([
      rpc.connections.list(),
      rpc.connections.catalog({}).catch(() => [] as { connectorId: string; slug: string }[]),
      rpc.mcp.servers.list().catch(() => []),
    ])
      .then(([rows, catalog, servers]) => {
        if (!current) return;
        const offered = (slug: string) =>
          catalog.some((app) => app.connectorId === "google" && app.slug === slug);
        const gmail = rows.some(
          (row) => row.status === "connected" && row.provider.trim().toLowerCase() === "gmail",
        );
        const drive = isConnected(rows, "googledrive");
        setApps({
          gmail: { connected: gmail, offered: gmail || offered("gmail") },
          drive: { connected: drive, offered: drive || offered("googledrive") },
          // A Box MCP server is the Box sign-in the import reads from.
          box: servers.some((server) => "endpoint" in server && isBoxEndpoint(server.endpoint)),
        });
      })
      .catch(() => current && setApps({ gmail: none, drive: none, box: false }));
    return () => {
      current = false;
    };
  }, []);
  if (apps === null) return null;
  const label = apps.gmail.connected ? t`Import from email` : t`Connect Gmail`;
  return (
    <>
      {apps.gmail.offered ? (
        <ToolbarTip label={label} compact={compact}>
          <Button
            variant="outline"
            className={compact ? TOOLBAR_BUTTON : undefined}
            onClick={() => (apps.gmail.connected ? setOpen(true) : navigate(GMAIL_PAGE))}
          >
            <Mail aria-hidden="true" />
            <span className={compact ? TOOLBAR_LABEL : undefined}>{label}</span>
          </Button>
        </ToolbarTip>
      ) : null}
      {open ? (
        <EmailPicker folderId={folderId} onClose={() => setOpen(false)} onDone={onDone} />
      ) : null}
      {apps.drive.offered ? (
        <DriveImportButton
          connected={apps.drive.connected}
          compact={compact}
          folderId={folderId}
          onDone={onDone}
        />
      ) : null}
      {apps.box ? <BoxImportButton compact={compact} folderId={folderId} onDone={onDone} /> : null}
    </>
  );
}
