import * as z from "zod";
import { Id } from "./ids.js";

/** A file or folder name: 1 to 255 characters, no path separators or control characters. */
export const DataRoomApiName = z
  .string()
  .min(1)
  .max(255)
  // biome-ignore lint/suspicious/noControlCharactersInRegex: names must not hold control characters.
  .refine((name) => !/[/\\\u0000-\u001f\u007f]/.test(name) && name.trim() !== "", {
    message: "Name cannot be blank or contain path separators",
  });

const NullableId = Id.nullable();

export const DataRoomApiFolderSchema = z.object({
  id: Id,
  name: z.string(),
  parentId: NullableId,
  createdAt: z.string().datetime(),
  /** Items directly in the folder; only the folder list carries it. */
  itemCount: z.number().int().nonnegative().optional(),
});
export type DataRoomApiFolder = z.infer<typeof DataRoomApiFolderSchema>;

export const DataRoomApiFacetsSchema = z.object({
  docType: z.string().nullable(),
  docDate: z.string().datetime().nullable(),
  parties: z.array(z.string()),
  amountCents: z.number().nullable(),
  currency: z.string().nullable(),
  tags: z.array(z.string()),
  summary: z.string().nullable(),
});

/** An item as clients see it. The storage key never leaves the server. */
export const DataRoomApiItemSchema = z.object({
  id: Id,
  name: z.string(),
  mimeType: z.string(),
  size: z.number().int(),
  folderId: NullableId,
  source: z.string(),
  /** An app path back to where an imported file came from; null for uploads. */
  sourceUrl: z.string().nullable(),
  status: z.string(),
  /** Why the last step failed. A `ready` item can carry one (for example, filing was skipped). */
  error: z.string().nullable(),
  /** True when the file is stored and listed but too large to search inside. */
  notIndexed: z.boolean(),
  facets: DataRoomApiFacetsSchema,
  createdAt: z.string().datetime(),
  /** A thumbnail can be fetched from `/api/data-room/items/:id/thumbnail`. */
  hasThumbnail: z.boolean(),
  /** The first ~400 characters of the extracted text, for the grid; null when there is none. */
  previewText: z.string().nullable(),
});
export type DataRoomApiItem = z.infer<typeof DataRoomApiItemSchema>;

export const DataRoomApiFiltersSchema = z.object({
  /** Omit for every folder; null for items outside any folder. */
  folderId: NullableId.optional(),
  docType: z.string().min(1).optional(),
  party: z.string().min(1).optional(),
  tag: z.string().min(1).optional(),
  docDateFrom: z.string().datetime().optional(),
  docDateTo: z.string().datetime().optional(),
  status: z.string().min(1).optional(),
  source: z.string().min(1).optional(),
});

/** The values the list filters offer: those of every item in the folder, not just a loaded page. */
export const DataRoomApiFacetValuesSchema = z.object({
  types: z.array(z.string()),
  parties: z.array(z.string()),
  sources: z.array(z.string()),
  hasDates: z.boolean(),
});
export type DataRoomApiFacetValues = z.infer<typeof DataRoomApiFacetValuesSchema>;

const StatCount = z.object({ value: z.string(), count: z.number().int() });
/** Totals and groups over the documents the filters match (see `dataRoom.stats`). */
export const DataRoomApiStatsSchema = z.object({
  documents: z.number().int(),
  bytes: z.number(),
  /** Extra copies: documents beyond one per distinct file content. */
  duplicates: z.number().int(),
  status: z.object({
    ready: z.number().int(),
    processing: z.number().int(),
    failed: z.number().int(),
    /** Stored and listed, but too large to read for search. */
    notSearchable: z.number().int(),
  }),
  types: z.array(StatCount),
  sources: z.array(StatCount),
  /** Oldest first, empty periods included; `key` is "YYYY-MM", or "YYYY" for the year unit. */
  dates: z.object({
    unit: z.enum(["month", "year"]),
    buckets: z.array(z.object({ key: z.string(), count: z.number().int() })),
  }),
  parties: z.array(StatCount),
  largest: z.array(z.object({ id: Id, name: z.string(), size: z.number() })),
  /** Sums per type and currency, largest first. */
  amounts: z.array(
    z.object({
      docType: z.string().nullable(),
      currency: z.string(),
      cents: z.number(),
      count: z.number().int(),
    }),
  ),
});
export type DataRoomApiStats = z.infer<typeof DataRoomApiStatsSchema>;

export const DataRoomApiSortSchema = z.object({
  /** "date" is the document date; items without one sort last in both directions. */
  field: z.enum(["date", "name", "type", "createdAt"]),
  direction: z.enum(["asc", "desc"]),
});

export const DataRoomApiItemListInputSchema = DataRoomApiFiltersSchema.extend({
  sort: DataRoomApiSortSchema.default({ field: "createdAt", direction: "desc" }),
  limit: z.number().int().min(1).max(100).default(50),
  /** The `nextCursor` (valid only with the same sort and filters) of the previous page. */
  cursor: Id.optional(),
});
export const DataRoomApiItemListOutputSchema = z.object({
  items: z.array(DataRoomApiItemSchema),
  nextCursor: Id.nullable(),
});

export const DataRoomApiSearchInputSchema = z.object({
  query: z.string().trim().min(1).max(500),
  filters: DataRoomApiFiltersSchema.optional(),
  /** Omit to order by relevance. */
  sort: DataRoomApiSortSchema.optional(),
  limit: z.number().int().min(1).max(50).default(10),
  /** The `nextCursor` of the previous page (valid only with the same query, filters and sort). */
  cursor: Id.optional(),
});
/** The ordinal of the chunk that holds an item's name, folder and facets; text chunks start at 0. */
export const DATA_ROOM_METADATA_ORDINAL = -1;

export const DataRoomApiSearchResultSchema = z.object({
  item: DataRoomApiItemSchema,
  /** `DATA_ROOM_METADATA_ORDINAL` when the match is in the name, folder or facets. */
  ordinal: z.number().int(),
  /** Plain text. U+0001 and U+0002 mark highlight start and end. Render as text, never HTML. */
  snippet: z.string(),
  score: z.number(),
});

export const DataRoomApiSearchOutputSchema = z.object({
  results: z.array(DataRoomApiSearchResultSchema),
  nextCursor: Id.nullable(),
});

/** A file answers with its item (201, or 200 for a repeat); a zip answers 202 with its import. */
export const DataRoomApiUploadResponseSchema = z.union([
  z.object({ item: DataRoomApiItemSchema, duplicate: z.boolean() }),
  z.object({ importId: Id }),
]);
export type DataRoomApiUploadResponse = z.infer<typeof DataRoomApiUploadResponseSchema>;

/** Bump when the disclosure below changes; it invalidates earlier consent. */
export const DATA_ROOM_DISCLOSURE_VERSION = "2026-10-22";
export const DATA_ROOM_DISCLOSURE =
  "The full text of your documents and, for images, the page images are sent to the providers below to read, file and search them.";

export const DataRoomConsentStatusSchema = z.object({
  /** Binds the consent to the exact providers below; it changes when they do. */
  key: z.string(),
  version: z.string(),
  allowed: z.boolean(),
  disclosure: z.string(),
  /** Empty when no model is set up, in which case nothing is sent anywhere. */
  recipients: z.array(z.object({ name: z.string(), detail: z.string() })),
});
export type DataRoomConsentStatus = z.infer<typeof DataRoomConsentStatusSchema>;

export const DataRoomConsentGrantInputSchema = z.object({ key: z.string(), version: z.string() });

/** Attachments of the caller's own cached messages, copied into the Data room. */
export const DataRoomApiImportEmailInputSchema = z.object({
  picks: z
    .array(z.object({ messageId: Id, attachmentId: z.string().min(1).max(500) }))
    .min(1)
    .max(20),
  folderId: NullableId.optional(),
});
export const DataRoomApiImportEmailOutputSchema = z.object({
  imported: z.number().int(),
  duplicates: z.number().int(),
  /** Files that could not be fetched or stored; the rest of the picks are still filed. */
  failed: z.number().int(),
  /** The import to follow with `dataRoom.imports`. */
  importId: z.string(),
});

/** Which attachments of the caller's mail are already in the Data room, for the email picker. */
export const DataRoomApiEmailImportedInputSchema = z.object({
  messageIds: z.array(Id).min(1).max(100),
});
export const DataRoomApiEmailImportedOutputSchema = z.object({
  files: z.array(z.object({ messageId: Id, attachmentId: z.string() })),
});

/** The caller's Google Drive for the import picker: a text search, or the children of a folder. */
export const DataRoomApiDriveListInputSchema = z.object({
  query: z.string().max(200).optional(),
  folderId: z.string().min(1).max(200).optional(),
  pageToken: z.string().min(1).max(2000).optional(),
});
export const DataRoomApiDriveFileSchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeType: z.string(),
  size: z.number().optional(),
  isFolder: z.boolean(),
});
export type DataRoomApiDriveFile = z.infer<typeof DataRoomApiDriveFileSchema>;
export const DataRoomApiDriveListOutputSchema = z.object({
  files: z.array(DataRoomApiDriveFileSchema),
  nextPageToken: z.string().optional(),
});
export const DataRoomApiImportDriveInputSchema = z
  .object({
    fileIds: z.array(z.string().min(1).max(200)).max(20).default([]),
    /** Drive folders, imported with all their subfolders in the background. */
    driveFolderIds: z.array(z.string().min(1).max(200)).max(20).default([]),
    folderId: NullableId.optional(),
  })
  .refine((input) => input.fileIds.length + input.driveFolderIds.length > 0, {
    message: "Pick at least one file or folder",
  });
export const DataRoomApiImportDriveOutputSchema = z.object({
  imported: z.number().int(),
  duplicates: z.number().int(),
  /** Files that could not be imported, including files in picked folders that were skipped. */
  failed: z.number().int(),
  /** The import to follow with `dataRoom.imports`. */
  importId: z.string(),
  /** Files the import set out to file, including the ones skipped. */
  total: z.number().int(),
  /** Files of picked folders handed to the background import. */
  queued: z.number().int().optional(),
  /** Data room folders the picked Drive folders will become (created in the background). */
  folders: z.number().int().optional(),
});

/** An import that is running, or finished in the last few minutes. */
export const DataRoomApiImportSchema = z.object({
  id: z.string(),
  /** "drive", "box" or "gmail". */
  source: z.string(),
  total: z.number().int(),
  /** Ready, plus files that were already in the Data room. */
  done: z.number().int(),
  /** Failed, plus files that could not be imported. */
  failed: z.number().int(),
  inProgress: z.number().int(),
  finished: z.boolean(),
  /** Zip entries handled so far, including skipped and failed ones. */
  added: z.number().int(),
  /** A zip import's step; null for other imports. "done" means unpacked, not yet read. */
  stage: z.enum(["opening", "adding", "reading", "done"]).nullable(),
  /** The zip entry being added. */
  currentName: z.string().nullable(),
  /** The newest files it filed, up to three. */
  latest: z.array(z.object({ id: z.string(), name: z.string() })),
});
export type DataRoomApiImport = z.infer<typeof DataRoomApiImportSchema>;
/** How many of the caller's items each pipeline step still has, and the one being worked on. */
export const DataRoomApiProcessingSchema = z.object({
  /** Waiting for or in text extraction. */
  reading: z.number().int(),
  /** Waiting for or in classification. */
  tagging: z.number().int(),
  /** Waiting for or in chunking and embedding. */
  indexing: z.number().int(),
  failed: z.number().int(),
  current: z.string().nullable(),
});
export type DataRoomApiProcessing = z.infer<typeof DataRoomApiProcessingSchema>;
/** The caller's Box for the import picker. Lists and files have the same shape as Drive's. */
export const DataRoomApiBoxListInputSchema = DataRoomApiDriveListInputSchema;
export const DataRoomApiBoxListOutputSchema = DataRoomApiDriveListOutputSchema;
export const DataRoomApiImportBoxInputSchema = z
  .object({
    fileIds: z.array(z.string().min(1).max(200)).max(20).default([]),
    /** Box folders, imported with all their subfolders in the background. */
    boxFolderIds: z.array(z.string().min(1).max(200)).max(20).default([]),
    folderId: NullableId.optional(),
  })
  .refine((input) => input.fileIds.length + input.boxFolderIds.length > 0, {
    message: "Pick at least one file or folder",
  });
export const DataRoomApiImportBoxOutputSchema = DataRoomApiImportDriveOutputSchema;
