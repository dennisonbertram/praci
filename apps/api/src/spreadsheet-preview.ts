import type { ArtifactStore } from "@rakazo/adapter-kit";
import { dataRoomBlobContext, readSpreadsheet, spreadsheetKind } from "@rakazo/adapters";
import type { Actor, SpreadsheetPreview, SpreadsheetPreviewInput } from "@rakazo/contracts";
import { SpreadsheetPreviewInputSchema } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDataRoomRepos, IsolationError } from "@rakazo/db";
import { adapterContext } from "./artifacts.js";
import type { InboxDeps } from "./inbox.js";
import { inboxAttachment } from "./inbox.js";

type Deps = { prisma: PrismaClient; artifacts: ArtifactStore; mail: InboxDeps["mail"] };

/** The file's bytes, found with the same space, user and isolation checks as its download route. */
async function load(deps: Deps, actor: Actor, source: SpreadsheetPreviewInput["source"]) {
  if ("mailAttachment" in source) {
    // Fetched through the mail account of the signed-in user; another user's message is not found.
    const file = await inboxAttachment(
      deps as Pick<InboxDeps, "prisma" | "mail"> as InboxDeps,
      actor,
      source.mailAttachment,
    );
    return { file: { name: file.filename, mimeType: file.mimeType }, read: async () => file.bytes };
  }
  if ("artifactId" in source) {
    const row = await deps.prisma.artifact.findFirst({
      where: { id: source.artifactId, spaceId: actor.spaceId, userId: actor.userId },
    });
    if (!row) throw new IsolationError();
    return {
      file: row,
      read: () =>
        deps.artifacts.get(
          row.storageKey,
          adapterContext(actor, row.botId ?? row.groupId ?? row.id, `artifact-get:${row.id}`),
        ),
    };
  }
  const item = await createDataRoomRepos(deps.prisma)
    .getItem(actor, source.dataRoomItemId)
    .catch((error: unknown) => {
      if (error instanceof IsolationError) return null;
      throw error;
    });
  if (!item?.storageKey) throw new IsolationError();
  const key = item.storageKey;
  return {
    file: item,
    read: () => deps.artifacts.get(key, dataRoomBlobContext(actor, "data-room.preview")),
  };
}

/** One page of a spreadsheet. The whole file is parsed on every page; ponytail: cache if files get big. */
export async function spreadsheetPreview(
  deps: Deps,
  actor: Actor,
  rawInput: SpreadsheetPreviewInput,
): Promise<SpreadsheetPreview> {
  const input = SpreadsheetPreviewInputSchema.parse(rawInput);
  const { file, read } = await load(deps, actor, input.source);
  const kind = spreadsheetKind(file.name, file.mimeType);
  if (!kind) return { status: "unsupported", message: "This is not an Excel or CSV file." };
  if (kind === "xls") {
    return {
      status: "unsupported",
      message: "Legacy .xls files can't be previewed. Save the file as .xlsx or .csv.",
    };
  }
  const result = readSpreadsheet(await read(), kind, file.name, {
    sheet: input.sheet,
    maxRows: input.limit + 1,
    skipRows: input.offset,
  });
  if ("error" in result) return { status: "unsupported", message: result.error };
  return {
    status: "ready",
    sheets: result.sheets,
    sheet: result.sheet,
    columns: result.columns,
    headerRow: result.headerRow,
    header: result.header,
    rows: result.rows.map(([row, ...cells]) => ({ row: row as number, cells })),
    truncated: result.truncated,
    ...(result.note ? { note: result.note } : {}),
  };
}
