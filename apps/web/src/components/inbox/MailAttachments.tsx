import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { isAttachmentImageMimeType } from "@rakazo/contracts";
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@rakazo/ui-web";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  FolderPlus,
  MoreHorizontal,
} from "lucide-react";
import type { KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { dataRoomImportStarted } from "../../lib/data-room";
import { formatBytes } from "../../lib/format-bytes";
import { useHideAmounts } from "../../lib/hide-amounts-preference";
import { rpc, withSpaceHeaders } from "../../lib/rpc";
import { canPreviewSpreadsheet } from "../../lib/spreadsheet";
import { useObjectUrl } from "../../lib/use-object-url";
import { errorText } from "../../lib/user-error";
import { ArtifactPreview } from "../ArtifactPreview";
import { PdfViewer } from "../PdfViewer";
import { SandboxedHtmlViewer } from "../SandboxedHtmlViewer";
import { SheetPreview } from "../SheetPreview";

export type MailAttachmentItem = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
};

/** Larger files are not fetched for a preview; they can still be downloaded. */
export const PREVIEW_MAX_BYTES = 10 * 1024 * 1024;
/** Only small pictures are fetched to draw a chip thumbnail. */
export const THUMBNAIL_MAX_BYTES = 512 * 1024;

type Kind = "image" | "pdf" | "sheet" | "html" | "markdown" | "text" | "zip" | "other";

export function attachmentKind({ filename, mimeType }: MailAttachmentItem): Kind {
  if (isAttachmentImageMimeType(mimeType)) return "image";
  if (mimeType === "application/pdf") return "pdf";
  if (canPreviewSpreadsheet(filename, mimeType)) return "sheet";
  if (mimeType === "text/html") return "html";
  if (mimeType === "text/markdown") return "markdown";
  if (mimeType === "text/plain") return "text";
  if (/zip|compressed|tar/.test(mimeType)) return "zip";
  return "other";
}

const PREVIEWABLE: Kind[] = ["image", "pdf", "sheet", "html", "markdown", "text"];

function KindIcon({ kind }: { kind: Kind }) {
  if (kind === "image") return <FileImage aria-hidden="true" />;
  if (kind === "sheet") return <FileSpreadsheet aria-hidden="true" />;
  if (kind === "zip") return <FileArchive aria-hidden="true" />;
  return <FileText aria-hidden="true" />;
}

/** The signed-in user's own attachment, through the session-scoped route; nothing is marked read. */
export async function fetchAttachment(messageId: string, attachment: { id: string }) {
  const response = await fetch(
    `/api/inbox/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachment.id)}`,
    { headers: withSpaceHeaders(), credentials: "include" },
  );
  if (!response.ok) throw new Error(`Attachment download failed (${response.status})`);
  return response;
}

async function saveAttachment(messageId: string, attachment: MailAttachmentItem) {
  const url = URL.createObjectURL(await (await fetchAttachment(messageId, attachment)).blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = attachment.filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

type Filed = "idle" | "adding" | "added";

/** Files one attachment through the Data room's own email import, which skips a repeat. */
function useAddToDataRoom(messageId: string, attachments: MailAttachmentItem[]) {
  const [filed, setFiled] = useState<Record<string, Filed>>({});
  const [error, setError] = useState("");
  // Set synchronously, so a second click before the first renders cannot file twice.
  const started = useRef(new Set<string>());
  useEffect(() => {
    let live = true;
    rpc.dataRoom
      .emailImported({ messageIds: [messageId] })
      .then(({ files }) => {
        if (!live) return;
        setFiled((prev) => {
          const next = { ...prev };
          for (const file of files) {
            started.current.add(file.attachmentId);
            next[file.attachmentId] = "added";
          }
          return next;
        });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [messageId]);
  const add = (attachment: MailAttachmentItem) => {
    if (!attachments.includes(attachment) || started.current.has(attachment.id)) return;
    started.current.add(attachment.id);
    setError("");
    setFiled((prev) => ({ ...prev, [attachment.id]: "adding" }));
    rpc.dataRoom
      .importEmail({ picks: [{ messageId, attachmentId: attachment.id }] })
      .then(({ imported, duplicates }) => {
        if (imported + duplicates === 0) throw new Error("not filed");
        setFiled((prev) => ({ ...prev, [attachment.id]: "added" }));
        dataRoomImportStarted();
      })
      .catch((cause) => {
        started.current.delete(attachment.id);
        setFiled((prev) => ({ ...prev, [attachment.id]: "idle" }));
        setError(errorText(cause));
      });
  };
  return { filed, add, error };
}

function Thumbnail({
  messageId,
  attachment,
}: {
  messageId: string;
  attachment: MailAttachmentItem;
}) {
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  useEffect(() => {
    let live = true;
    fetchAttachment(messageId, attachment)
      .then((response) => response.arrayBuffer())
      .then((buffer) => live && setBytes(new Uint8Array(buffer)))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [messageId, attachment]);
  return bytes ? <ThumbnailImage bytes={bytes} mimeType={attachment.mimeType} /> : null;
}

function ThumbnailImage({ bytes, mimeType }: { bytes: Uint8Array; mimeType: string }) {
  const url = useObjectUrl(bytes, mimeType);
  return url ? <img src={url} alt="" className="size-5 shrink-0 rounded-sm object-cover" /> : null;
}

/** The attachment's content, fetched on open. Untrusted: PDF and HTML only render in their sandboxed viewers. */
function AttachmentView({
  messageId,
  attachment,
}: {
  messageId: string;
  attachment: MailAttachmentItem;
}) {
  const kind = attachmentKind(attachment);
  const hidden = useHideAmounts();
  const showable = PREVIEWABLE.includes(kind) && attachment.size <= PREVIEW_MAX_BYTES;
  const server = kind === "sheet";
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [failed, setFailed] = useState("");
  useEffect(() => {
    setBytes(null);
    setFailed("");
    if (!showable || server || (hidden && kind !== "text" && kind !== "markdown")) return;
    let live = true;
    fetchAttachment(messageId, attachment)
      .then((response) => response.arrayBuffer())
      .then((buffer) => live && setBytes(new Uint8Array(buffer)))
      .catch((cause) => live && setFailed(errorText(cause)));
    return () => {
      live = false;
    };
  }, [messageId, attachment, showable, server, hidden, kind]);
  const note = (text: string) => (
    <div className="grid h-full place-items-center px-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
  if (attachment.size > PREVIEW_MAX_BYTES) return note(t`Too large to preview`);
  if (!showable)
    return note(t`Preview isn't available for this file type — download it to view it.`);
  if (kind === "sheet")
    return (
      <SheetPreview
        key={attachment.id}
        source={{ mailAttachment: { messageId, attachmentId: attachment.id } }}
      />
    );
  if (hidden && kind !== "text" && kind !== "markdown")
    return note(t`Hidden while amounts are hidden`);
  if (failed) return note(failed);
  if (!bytes) return <div className="h-full animate-pulse bg-muted" />;
  if (kind === "pdf") return <PdfViewer bytes={bytes} title={attachment.filename} />;
  if (kind === "html")
    return (
      <SandboxedHtmlViewer
        html={new TextDecoder("utf-8").decode(bytes)}
        title={attachment.filename}
        email
      />
    );
  if (kind === "text")
    return (
      <pre className="h-full overflow-auto whitespace-pre-wrap break-words p-4 text-sm">
        {new TextDecoder("utf-8").decode(bytes)}
      </pre>
    );
  return (
    <ArtifactPreview
      artifact={{ id: attachment.id, name: attachment.filename, mimeType: attachment.mimeType }}
      bytes={bytes}
    />
  );
}

function DataRoomAction({
  state,
  onAdd,
  variant = "outline",
}: {
  state: Filed;
  onAdd: () => void;
  variant?: "outline" | "ghost";
}) {
  return (
    <Button
      variant={variant}
      size="sm"
      disabled={state !== "idle"}
      aria-label={state === "added" ? t`Added` : t`Add to Data room`}
      onClick={onAdd}
    >
      <FolderPlus aria-hidden="true" />
      <span className="hidden sm:inline">
        {state === "added" ? <Trans>Added</Trans> : <Trans>Add to Data room</Trans>}
      </span>
    </Button>
  );
}

/** Preview of one attachment over the email; arrow keys step between attachments, Escape returns to the email. */
function AttachmentPreviewDialog({
  messageId,
  attachments,
  index,
  onIndex,
  onClose,
  filed,
  onAdd,
  onDownload,
}: {
  messageId: string;
  attachments: MailAttachmentItem[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
  filed: Record<string, Filed>;
  onAdd: (attachment: MailAttachmentItem) => void;
  onDownload: (attachment: MailAttachmentItem) => void;
}) {
  const attachment = attachments[index];
  if (!attachment) return null;
  const step = (by: number) => {
    const next = index + by;
    if (next >= 0 && next < attachments.length) onIndex(next);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    // The email behind has its own letter shortcuts; none of them apply while previewing.
    event.stopPropagation();
    if (event.key === "ArrowRight") step(1);
    else if (event.key === "ArrowLeft") step(-1);
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        onKeyDown={onKeyDown}
        className="flex h-dvh max-h-none w-full max-w-none flex-col gap-2 rounded-none sm:max-w-none md:h-[85vh] md:w-[min(960px,94vw)] md:rounded-xl"
      >
        <div className="flex items-center gap-1 pe-8">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t`Previous attachment`}
            disabled={index === 0}
            onClick={() => step(-1)}
          >
            <ChevronLeft aria-hidden="true" className="rtl:rotate-180" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t`Next attachment`}
            disabled={index === attachments.length - 1}
            onClick={() => step(1)}
          >
            <ChevronRight aria-hidden="true" className="rtl:rotate-180" />
          </Button>
          <DialogTitle dir="auto" className="min-w-0 flex-1 truncate text-sm font-medium">
            {attachment.filename}
          </DialogTitle>
          <DataRoomAction state={filed[attachment.id] ?? "idle"} onAdd={() => onAdd(attachment)} />
          <Button
            variant="outline"
            size="sm"
            aria-label={t`Download`}
            onClick={() => onDownload(attachment)}
          >
            <Download aria-hidden="true" />
            <span className="hidden sm:inline">
              <Trans>Download</Trans>
            </span>
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-border">
          <AttachmentView key={attachment.id} messageId={messageId} attachment={attachment} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Compact chips under the message: click previews, the menu downloads or files to the Data room. */
export function MailAttachments({
  messageId,
  attachments,
}: {
  messageId: string;
  attachments: MailAttachmentItem[];
}) {
  const [result, setResult] = useState<{ ok: boolean; filename: string } | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const { filed, add, error } = useAddToDataRoom(messageId, attachments);
  const download = (attachment: MailAttachmentItem) => {
    setResult(null);
    saveAttachment(messageId, attachment).then(
      () => setResult({ ok: true, filename: attachment.filename }),
      () => setResult({ ok: false, filename: attachment.filename }),
    );
  };
  return (
    <div className="mt-3">
      <ul aria-label={t`Attachments`} className="flex flex-wrap gap-2">
        {attachments.map((attachment, index) => {
          const kind = attachmentKind(attachment);
          return (
            <li key={attachment.id} className="flex">
              <Button
                variant="outline"
                title={attachment.filename}
                className="h-9 max-w-56 justify-start gap-2 rounded-e-none px-2 text-start [&_svg]:size-4 [&_svg]:text-muted-foreground"
                onClick={() => setOpen(index)}
              >
                {kind === "image" && attachment.size <= THUMBNAIL_MAX_BYTES ? (
                  <Thumbnail messageId={messageId} attachment={attachment} />
                ) : (
                  <KindIcon kind={kind} />
                )}
                <span className="truncate">{attachment.filename}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatBytes(attachment.size)}
                </span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 rounded-s-none border-s-0"
                      aria-label={t`More actions for ${attachment.filename}`}
                    />
                  }
                >
                  <MoreHorizontal aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => download(attachment)}>
                    <Download aria-hidden="true" />
                    <Trans>Download</Trans>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={(filed[attachment.id] ?? "idle") !== "idle"}
                    onClick={() => add(attachment)}
                  >
                    <FolderPlus aria-hidden="true" />
                    {filed[attachment.id] === "added" ? (
                      <Trans>Added</Trans>
                    ) : (
                      <Trans>Add to Data room</Trans>
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          );
        })}
      </ul>
      <p
        role={(result && !result.ok) || error ? "alert" : "status"}
        className={cn(
          "mt-2 text-sm empty:hidden",
          result?.ok && !error ? "text-muted-foreground" : "text-destructive",
        )}
      >
        {error ||
          (result
            ? result.ok
              ? t`Downloaded ${result.filename}`
              : t`Couldn't download ${result.filename}`
            : null)}
      </p>
      {open !== null ? (
        <AttachmentPreviewDialog
          messageId={messageId}
          attachments={attachments}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
          filed={filed}
          onAdd={add}
          onDownload={download}
        />
      ) : null}
    </div>
  );
}
