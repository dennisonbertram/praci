import type { DataRoomApiFolder, DataRoomApiItem } from "@rakazo/contracts";
import { UI_ARTIFACT_MIME_TYPE } from "@rakazo/contracts";
import { rpc } from "./api";
import { t } from "./i18n";
import { attachmentKind, PREVIEW_MAX_BYTES } from "./mail-attachment";

export type DataRoomPage = { items: DataRoomApiItem[]; nextCursor: string | null };

export function listDataRoomFolders(): Promise<DataRoomApiFolder[]> {
  return rpc<DataRoomApiFolder[]>("dataRoom/folders");
}

export async function listDataRoomItems(input: {
  folderId?: string;
  query?: string;
  cursor?: string;
}): Promise<DataRoomPage> {
  const query = input.query?.trim();
  if (query) {
    const page = await rpc<{
      results: { item: DataRoomApiItem }[];
      nextCursor: string | null;
    }>("dataRoom/search", {
      query,
      filters: input.folderId ? { folderId: input.folderId } : {},
      cursor: input.cursor,
      limit: 30,
    });
    return { items: page.results.map(({ item }) => item), nextCursor: page.nextCursor };
  }
  return rpc<DataRoomPage>("dataRoom/items/list", {
    folderId: input.folderId,
    cursor: input.cursor,
    limit: 30,
    sort: { field: "createdAt", direction: "desc" },
  });
}

export function getDataRoomItem(id: string): Promise<DataRoomApiItem> {
  return rpc<DataRoomApiItem>("dataRoom/item", { id });
}

export function dataRoomPreviewKind(item: Pick<DataRoomApiItem, "name" | "mimeType" | "size">) {
  const mimeType = item.mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (mimeType === UI_ARTIFACT_MIME_TYPE && item.size <= PREVIEW_MAX_BYTES) return "ui";
  return attachmentKind({ id: "", filename: item.name, mimeType, size: item.size });
}

export function dataRoomStatus(item: Pick<DataRoomApiItem, "status" | "notIndexed">): string {
  if (item.notIndexed) return t("Not searchable");
  if (item.status === "ready") return t("Ready");
  if (item.status === "failed") return t("Failed");
  return t("Processing…");
}
