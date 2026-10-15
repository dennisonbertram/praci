import * as z from "zod";

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

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

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
  filters: z.object({
    docType: DataRoomDocTypeSchema.optional(),
    parties: z.array(z.string().max(120)).max(20).optional(),
    dateFrom: IsoDate.optional(),
    dateTo: IsoDate.optional(),
    source: z.string().max(80).optional(),
  }),
});
export type DataRoomQueryPlan = z.infer<typeof DataRoomQueryPlanSchema>;
