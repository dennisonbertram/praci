import * as z from "zod";
import {
  CompanyConfidenceSchema,
  CompanyEntityInputSchema,
  CompanyEventKindSchema,
  CompanyPartialDateSchema,
  CompanyRelationSchema,
  CompanyStreamSchema,
} from "./company.js";

const ref = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const quote = z.string().trim().min(1).max(240);
const links = { contactId: true, legalContractId: true, dataRoomItemId: true } as const;
// Models name local subjects; only server code can link stored records or sources.
const extractedEntity = z.discriminatedUnion("kind", [
  CompanyEntityInputSchema.options[0].omit(links),
  CompanyEntityInputSchema.options[1].omit(links),
  CompanyEntityInputSchema.options[2].omit(links),
  CompanyEntityInputSchema.options[3].omit(links),
  CompanyEntityInputSchema.options[4].omit(links),
  CompanyEntityInputSchema.options[5].omit(links),
]);

export const CompanyRelevanceSchema = z.strictObject({ relevant: z.boolean() });
export const CompanyExtractionSchema = z
  .strictObject({
    entities: z.array(z.strictObject({ ref, entity: extractedEntity, quote })).max(100),
    edges: z
      .array(
        z.strictObject({
          fromRef: ref,
          toRef: ref,
          relation: CompanyRelationSchema,
          startsOn: CompanyPartialDateSchema.nullable(),
          endsOn: CompanyPartialDateSchema.nullable(),
          role: z.string().trim().min(1).max(200).nullable(),
          confidence: CompanyConfidenceSchema,
          quote,
        }),
      )
      .max(100),
    events: z
      .array(
        z.strictObject({
          stream: CompanyStreamSchema,
          kind: CompanyEventKindSchema,
          title: z.string().trim().min(1).max(200),
          occursOn: CompanyPartialDateSchema.nullable(),
          endsOn: CompanyPartialDateSchema.nullable(),
          entityRefs: z.array(ref).max(100),
          confidence: CompanyConfidenceSchema,
          quote,
        }),
      )
      .max(100),
  })
  .superRefine((value, context) => {
    const refs = new Set(value.entities.map((entity) => entity.ref));
    if (refs.size !== value.entities.length)
      context.addIssue({ code: "custom", message: "Duplicate local entity ref" });
    for (const edge of value.edges) {
      if (!refs.has(edge.fromRef) || !refs.has(edge.toRef))
        context.addIssue({ code: "custom", message: "Unknown edge subject" });
      if (edge.startsOn && edge.endsOn && edge.startsOn.date > edge.endsOn.date)
        context.addIssue({ code: "custom", message: "End precedes start" });
    }
    for (const event of value.events) {
      if (event.entityRefs.some((id) => !refs.has(id)))
        context.addIssue({ code: "custom", message: "Unknown event subject" });
      if (event.occursOn && event.endsOn && event.occursOn.date > event.endsOn.date)
        context.addIssue({ code: "custom", message: "End precedes start" });
    }
    if (value.entities.length + value.edges.length + value.events.length > 100)
      context.addIssue({ code: "custom", message: "Too many facts" });
  });

export type CompanyExtraction = z.infer<typeof CompanyExtractionSchema>;

export const CompanyDataRoomScopeSchema = z.strictObject({
  itemIds: z.array(z.string().min(1).max(300)).max(10_000).optional(),
  folderIds: z.array(z.string().min(1).max(300)).max(100).optional(),
});
export const CompanyMailScopeSchema = z
  .strictObject({
    after: z.iso.date().optional(),
    before: z.iso.date().optional(),
    allTime: z.boolean().optional(),
    labelIds: z
      .array(z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/))
      .max(50)
      .optional(),
  })
  .refine((scope) => !scope.allTime || !scope.after, "Choose all time or a lower bound")
  .refine(
    (scope) => !scope.after || !scope.before || scope.after < scope.before,
    "Empty date window",
  );

export const CompanySlackChannelIdSchema = z.string().regex(/^[CDG][A-Z0-9]{1,100}$/);
export const CompanySlackScopeSchema = z
  .strictObject({
    reader: z.literal("slack").optional(),
    channelIds: z.array(CompanySlackChannelIdSchema).max(500).optional(),
    privateChannelIds: z.array(CompanySlackChannelIdSchema).max(100).default([]),
    after: z.iso.date().optional(),
    before: z.iso.date().optional(),
    allTime: z.boolean().optional(),
  })
  .refine((scope) => !scope.allTime || !scope.after, "Choose all time or a lower bound")
  .refine(
    (scope) => !scope.after || !scope.before || scope.after < scope.before,
    "Empty date window",
  )
  .refine(
    (scope) =>
      scope.channelIds === undefined ||
      scope.channelIds.length > 0 ||
      scope.privateChannelIds.length > 0,
    "Choose a channel",
  );

export const CompanyTrackerScopeSchema = z.strictObject({
  reader: z.enum(["github", "linear"]).optional(),
  allTime: z.literal(true).default(true),
});

export const CompanyNotionScopeSchema = z.strictObject({
  reader: z.literal("notion").default("notion"),
  allTime: z.literal(true).default(true),
});

export const CompanyGenericScopeSchema = z.strictObject({
  reader: z.literal("generic"),
  tools: z
    .array(
      z.strictObject({
        name: z.string().min(1).max(200),
        args: z.record(z.string(), z.unknown()).default({}),
      }),
    )
    .min(1)
    .max(20)
    .refine(
      (tools) => new Set(tools.map((tool) => tool.name)).size === tools.length,
      "Choose each tool once",
    ),
});

const compactName = (value: string) =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/**
 * The company profile is the space's own company. A model may label a customer or
 * vendor named in the same document as the company; those become plain organisations.
 */
export function keepOwnCompany(
  extraction: CompanyExtraction,
  spaceName: string,
): CompanyExtraction {
  const own = compactName(spaceName);
  return {
    ...extraction,
    entities: extraction.entities.map((fact) => {
      if (fact.entity.kind !== "company") return fact;
      const name = compactName(fact.entity.displayName);
      if (own && name && (name.startsWith(own) || own.startsWith(name))) return fact;
      const { displayName, confidence } = fact.entity;
      return { ...fact, entity: { kind: "organisation", displayName, confidence, attrs: {} } };
    }),
  };
}
