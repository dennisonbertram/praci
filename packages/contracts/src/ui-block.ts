import * as z from "zod";

/**
 * Typed blocks a bot reply can carry instead of Markdown layout. Every field is bounded, and text
 * fields are plain text or Markdown only: the model never writes HTML or scripts.
 */
export const UI_BLOCK_MAX_TABLE_ROWS = 50;
export const UI_BLOCK_MAX_TABLE_COLUMNS = 8;
export const UI_BLOCK_MAX_ITEMS = 20;
export const UI_BLOCK_MAX_STATS = 6;

const Title = z.string().min(1).max(120);
const Short = z.string().min(1).max(200);
const Body = z.string().min(1).max(4_000);
const Cell = z.union([z.string().max(500), z.number()]);

/** A link a card may carry: https, or a path inside the app. */
const CardHref = z
  .string()
  .max(2_000)
  .refine((value) => /^https:\/\/\S+$/.test(value) || /^\/(?!\/)\S*$/.test(value), {
    message: "href must be an https URL or an app path starting with /",
  });

export const UiBlockSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("table"),
      title: Title.optional(),
      columns: z
        .array(
          z.object({
            label: z.string().max(80),
            align: z.enum(["left", "right"]).optional(),
          }),
        )
        .min(1)
        .max(UI_BLOCK_MAX_TABLE_COLUMNS),
      rows: z.array(z.array(Cell)).max(UI_BLOCK_MAX_TABLE_ROWS),
    })
    .superRefine((table, ctx) => {
      table.rows.forEach((row, index) => {
        if (row.length !== table.columns.length)
          ctx.addIssue({
            code: "custom",
            path: ["rows", index],
            message: `row has ${row.length} cells but there are ${table.columns.length} columns`,
          });
      });
    }),
  z.object({
    type: z.literal("sections"),
    sections: z
      .array(z.object({ heading: Title, body: Body }))
      .min(1)
      .max(UI_BLOCK_MAX_ITEMS),
  }),
  z.object({
    type: z.literal("summary"),
    title: Title.optional(),
    items: z
      .array(z.object({ label: Short, value: z.string().max(500) }))
      .min(1)
      .max(UI_BLOCK_MAX_ITEMS),
  }),
  z.object({
    type: z.literal("stats"),
    stats: z
      .array(
        z.object({
          label: Short,
          value: z.string().min(1).max(80),
          hint: z.string().max(120).optional(),
        }),
      )
      .min(1)
      .max(UI_BLOCK_MAX_STATS),
  }),
  z.object({
    type: z.literal("cards"),
    cards: z
      .array(
        z.object({
          title: Title,
          subtitle: z.string().max(200).optional(),
          body: Body.optional(),
          badge: z.string().max(40).optional(),
          href: CardHref.optional(),
        }),
      )
      .min(1)
      .max(UI_BLOCK_MAX_ITEMS),
  }),
  z.object({
    type: z.literal("callout"),
    tone: z.enum(["info", "warning", "success", "danger"]),
    title: Title.optional(),
    body: Body,
  }),
]);
export type UiBlock = z.infer<typeof UiBlockSchema>;
