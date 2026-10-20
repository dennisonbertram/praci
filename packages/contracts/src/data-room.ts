import * as z from "zod";

/** The one place the Data room agent's spawn key is built. */
export const dataRoomAgentSpawnKey = (userId: string) => `data-room-agent:${userId}`;

export const isDataRoomAgentSpawnKey = (spawnKey: string | null | undefined) =>
  Boolean(spawnKey?.startsWith(dataRoomAgentSpawnKey("")));

/** The only built-in tools the Data room agent is offered. None of them deletes. */
export const DATA_ROOM_AGENT_BUILTIN_TOOLS = [
  "search_data_room",
  "read_data_room_item",
  "add_to_data_room",
  "read_spreadsheet",
  "contacts_list",
  "contacts_add",
  "remember",
  "save_memory",
  "recall_memory",
  "forget_memory",
  "save_shared_memory",
  "ask_user",
  "notify_user",
] as const;

export const DataRoomDocTypeSchema = z.enum([
  "contract",
  "invoice",
  "receipt",
  "statement",
  "tax",
  "legal",
  "hr",
  "investor",
  "report",
  "presentation",
  "spreadsheet",
  "note",
  "correspondence",
  "other",
]);
export type DataRoomDocType = z.infer<typeof DataRoomDocTypeSchema>;

const IsoDate = z.iso.date();

/** What the classifier says about one document; the job (#52) stores these as facets. */
export const DataRoomClassificationSchema = z.object({
  docType: DataRoomDocTypeSchema,
  title: z.string().min(1).max(200),
  docDate: IsoDate.nullable(),
  parties: z.array(z.string().min(1).max(120)).max(20),
  amountCents: z.number().int().nullable(),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable(),
  summary: z.string().max(600),
  tags: z
    .array(
      z
        .string()
        .min(1)
        .max(40)
        .regex(/^[^A-Z]*$/),
    )
    .max(12),
  folderPath: z
    .array(
      z
        .string()
        .min(1)
        .max(80)
        .regex(/^[^/]*$/),
    )
    .min(1)
    .max(4),
  confidence: z.number().min(0).max(1),
});
export type DataRoomClassification = z.infer<typeof DataRoomClassificationSchema>;

/** A natural-language question turned into a text query plus structured filters. */
export const DataRoomQueryPlanSchema = z.object({
  query: z.string(),
  filters: z
    .strictObject({
      docType: DataRoomDocTypeSchema.optional(),
      parties: z.array(z.string().max(120)).max(20).optional(),
      dateFrom: IsoDate.optional(),
      dateTo: IsoDate.optional(),
      source: z.string().max(80).optional(),
    })
    .refine((f) => !f.dateFrom || !f.dateTo || f.dateFrom <= f.dateTo, {
      message: "dateFrom must not be after dateTo",
    }),
});
export type DataRoomQueryPlan = z.infer<typeof DataRoomQueryPlanSchema>;
