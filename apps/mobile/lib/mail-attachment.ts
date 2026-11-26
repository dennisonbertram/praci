import { isAttachmentImageMimeType } from "@rakazo/contracts";
import { canPreviewSpreadsheet } from "@rakazo/core";
import { Directory, File, Paths } from "expo-file-system";
import { authHeaders, currentApiBase } from "./api";
import { artifactCacheFileName } from "./artifact-file";
import { registerSessionDiskCache } from "./session";

registerSessionDiskCache(() => {
  const root = new Directory(Paths.cache, "mail-attachments");
  if (root.exists) root.delete();
});

export type MailAttachmentRef = { id: string; filename: string; mimeType: string; size: number };

/** Larger files go straight to the share sheet instead of an in-app preview. */
export const PREVIEW_MAX_BYTES = 10 * 1024 * 1024;

export type AttachmentKind = "image" | "pdf" | "sheet" | "other";

export function attachmentKind({ filename, mimeType, size }: MailAttachmentRef): AttachmentKind {
  if (size > PREVIEW_MAX_BYTES) return "other";
  if (isAttachmentImageMimeType(mimeType)) return "image";
  if (mimeType === "application/pdf") return "pdf";
  if (canPreviewSpreadsheet(filename, mimeType)) return "sheet";
  return "other";
}

/**
 * Downloads one attachment of the signed-in user's own message through the session-scoped route
 * into the cache. Reading an attachment does not mark the message read.
 */
export async function downloadMailAttachment(
  messageId: string,
  attachment: MailAttachmentRef,
  signal?: AbortSignal,
): Promise<File> {
  const dir = new Directory(Paths.cache, "mail-attachments");
  if (!dir.exists) dir.create({ intermediates: true });
  const file = new File(
    dir,
    artifactCacheFileName(`${messageId}-${attachment.id}`, attachment.mimeType),
  );
  try {
    return await File.downloadFileAsync(
      `${currentApiBase()}/api/inbox/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachment.id)}`,
      file,
      { headers: await authHeaders(), idempotent: true, signal },
    );
  } catch (cause) {
    try {
      if (file.exists) file.delete();
    } catch {
      // Keep the download error as the failure surfaced to the caller.
    }
    throw cause;
  }
}
