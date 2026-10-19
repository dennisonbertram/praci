import * as z from "zod";
import { DataRoomApiName } from "./data-room-api.js";
import { Id } from "./ids.js";

/** One folder name: no path separators, so a path is always an array of names. */
const FolderName = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[^/\\]+$/);
/** A target folder path, at most three levels deep. */
export const AutoSortPathSchema = z.array(FolderName).min(1).max(3);

/**
 * What the model may return: a target folder per item and, for names that mean nothing, a better
 * name. Strict, so any other key (a delete, for one) rejects the whole answer.
 */
export const AutoSortProposalSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        id: z.string().min(1).max(100),
        folderPath: AutoSortPathSchema,
        name: DataRoomApiName.optional(),
      }),
    )
    .max(500),
});
export type AutoSortProposal = z.infer<typeof AutoSortProposalSchema>;

const Key = z.string().min(1).max(200);

export const AutoSortOperationSchema = z.discriminatedUnion("type", [
  /** Moves everything in `folderId` into `intoFolderId`, then removes the emptied folder. */
  z.strictObject({
    type: z.literal("merge_folder"),
    key: Key,
    folderId: Id,
    intoFolderId: Id,
    from: z.string().max(400),
    into: z.string().max(400),
  }),
  z.strictObject({
    type: z.literal("move_item"),
    key: Key,
    itemId: Id,
    name: z.string().max(255),
    fromFolderId: Id.nullable(),
    toPath: AutoSortPathSchema,
    from: z.string().max(400),
    to: z.string().max(400),
  }),
  z.strictObject({
    type: z.literal("rename_item"),
    key: Key,
    itemId: Id,
    fromName: z.string().max(255),
    toName: DataRoomApiName,
  }),
]);
export type AutoSortOperation = z.infer<typeof AutoSortOperationSchema>;

export const AutoSortPlanSchema = z.object({
  /** "ai": the model proposed the layout. "basic": only duplicate folders are merged. */
  mode: z.enum(["ai", "basic"]),
  operations: z.array(AutoSortOperationSchema),
});
export type AutoSortPlan = z.infer<typeof AutoSortPlanSchema>;

export const AutoSortApplyInputSchema = z.object({
  operations: z.array(AutoSortOperationSchema).max(1000),
});
export const AutoSortApplyOutputSchema = z.object({
  batchId: Id,
  /** Distinct items moved or renamed. */
  items: z.number().int().nonnegative(),
  /** Operations that no longer matched the Data room and were left alone. */
  skipped: z.number().int().nonnegative(),
});
export type AutoSortApplyOutput = z.infer<typeof AutoSortApplyOutputSchema>;

export const AutoSortUndoOutputSchema = z.object({
  restored: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
});
