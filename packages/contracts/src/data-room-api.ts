import * as z from "zod";
import { Id } from "./ids.js";

/** Uploads are streamed through the API and refused above this size. */
export const DATA_ROOM_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;

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
  status: z.string(),
  error: z.string().nullable(),
  facets: DataRoomApiFacetsSchema,
  createdAt: z.string().datetime(),
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

export const DataRoomApiItemListInputSchema = DataRoomApiFiltersSchema.extend({
  limit: z.number().int().min(1).max(100).default(50),
  /** The `nextCursor` of the previous page. */
  cursor: Id.optional(),
});
export const DataRoomApiItemListOutputSchema = z.object({
  items: z.array(DataRoomApiItemSchema),
  nextCursor: Id.nullable(),
});

export const DataRoomApiSearchInputSchema = z.object({
  query: z.string().trim().min(1).max(500),
  filters: DataRoomApiFiltersSchema.optional(),
  limit: z.number().int().min(1).max(50).default(10),
});
export const DataRoomApiSearchResultSchema = z.object({
  item: DataRoomApiItemSchema,
  ordinal: z.number().int(),
  /** Plain text. U+0001 and U+0002 mark highlight start and end. Render as text, never HTML. */
  snippet: z.string(),
  score: z.number(),
});

export const DataRoomApiUploadResponseSchema = z.object({
  item: DataRoomApiItemSchema,
  duplicate: z.boolean(),
});
export type DataRoomApiUploadResponse = z.infer<typeof DataRoomApiUploadResponseSchema>;
