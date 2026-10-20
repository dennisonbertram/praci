import * as z from "zod";

const shortText = z.string().trim().min(1).max(200);
const identifier = z.string().trim().min(1).max(300);
const url = z
  .url()
  .max(2000)
  .refine((value) => /^https?:\/\//i.test(value));
export const CompanyDateSchema = z.iso.date();
export const CompanyPrecisionSchema = z.enum(["day", "month", "quarter", "year"]);
export const CompanyPartialDateSchema = z
  .strictObject({
    date: CompanyDateSchema,
    precision: CompanyPrecisionSchema,
  })
  .refine(({ date, precision }) => {
    if (precision === "day") return true;
    if (!date.endsWith("-01")) return false;
    if (precision === "month") return true;
    const month = Number(date.slice(5, 7));
    return precision === "year" ? month === 1 : [1, 4, 7, 10].includes(month);
  }, "Use the first calendar date of the stated precision");

export const CompanyEntityKindSchema = z.enum([
  "company",
  "person",
  "organisation",
  "matter",
  "project",
  "product",
]);
export const CompanyStatusSchema = z.enum(["suggested", "confirmed", "rejected"]);
export const CompanyVisibilitySchema = z.enum(["private", "team"]);
export const CompanyFactKindSchema = z.enum(["entity", "edge", "event"]);
export const CompanyRelationSchema = z.enum([
  "works_at",
  "reports_to",
  "founded",
  "invested_in",
  "customer_of",
  "vendor_of",
  "counsel_for",
  "party_to",
  "works_on",
  "part_of",
]);
export const CompanyEventKindSchema = z.enum([
  "founded",
  "hire",
  "departure",
  "role_change",
  "funding_round",
  "contract_signed",
  "renewal",
  "matter_opened",
  "matter_closed",
  "launch",
  "customer_won",
  "customer_lost",
  "milestone",
  "other",
]);
export const CompanyStreamSchema = z.enum([
  "company",
  "people",
  "funding",
  "legal",
  "product",
  "customers",
]);
export const CompanySourceKindSchema = z.enum([
  "gmail",
  "data_room",
  "slack",
  "github",
  "linear",
  "notion",
  "mcp",
  "composio",
  "manual",
]);
export const CompanyConfidenceSchema = z.number().min(0).max(1);

export const CompanyProfileAttrsSchema = z.strictObject({
  legalName: shortText.optional(),
  description: z.string().trim().max(500).optional(),
  whatWeDo: z.string().trim().max(2000).optional(),
  website: url.optional(),
  founded: CompanyPartialDateSchema.optional(),
  headquarters: shortText.optional(),
});
export const CompanyPersonAttrsSchema = z.strictObject({
  aliases: z.array(shortText).max(30).optional(),
  workEmails: z.array(z.email().max(254).toLowerCase()).max(30).optional(),
  slackId: identifier.optional(),
  githubLogin: identifier.toLowerCase().optional(),
  linearId: identifier.optional(),
  timezone: z.string().max(100).optional(),
});
export const CompanyOrganisationAttrsSchema = z.strictObject({
  type: z
    .enum(["investor", "customer", "vendor", "law_firm", "bank", "partner", "other"])
    .optional(),
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .max(253)
    .regex(/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/)
    .optional(),
});
export const CompanyMatterAttrsSchema = z.strictObject({
  description: z.string().max(500).optional(),
});
export const CompanyProjectAttrsSchema = z.strictObject({
  trackerUrl: url.optional(),
  startsOn: CompanyPartialDateSchema.optional(),
  endsOn: CompanyPartialDateSchema.optional(),
});
export const CompanyProductAttrsSchema = z.strictObject({
  description: z.string().max(500).optional(),
  website: url.optional(),
});

const entityFields = {
  displayName: shortText,
  contactId: identifier.nullish(),
  legalContractId: identifier.nullish(),
  dataRoomItemId: identifier.nullish(),
  confidence: CompanyConfidenceSchema,
};
export const CompanyEntityInputSchema = z.discriminatedUnion("kind", [
  z.strictObject({ ...entityFields, kind: z.literal("company"), attrs: CompanyProfileAttrsSchema }),
  z.strictObject({ ...entityFields, kind: z.literal("person"), attrs: CompanyPersonAttrsSchema }),
  z.strictObject({
    ...entityFields,
    kind: z.literal("organisation"),
    attrs: CompanyOrganisationAttrsSchema,
  }),
  z.strictObject({ ...entityFields, kind: z.literal("matter"), attrs: CompanyMatterAttrsSchema }),
  z.strictObject({ ...entityFields, kind: z.literal("project"), attrs: CompanyProjectAttrsSchema }),
  z.strictObject({ ...entityFields, kind: z.literal("product"), attrs: CompanyProductAttrsSchema }),
]);
export const CompanyEdgeInputSchema = z
  .strictObject({
    fromId: identifier,
    toId: identifier,
    relation: CompanyRelationSchema,
    startsOn: CompanyPartialDateSchema.nullish(),
    endsOn: CompanyPartialDateSchema.nullish(),
    role: shortText.nullish(),
    confidence: CompanyConfidenceSchema,
  })
  .refine(
    (value) => !value.startsOn || !value.endsOn || value.startsOn.date <= value.endsOn.date,
    "End precedes start",
  );
export const CompanyEventInputSchema = z
  .strictObject({
    stream: CompanyStreamSchema,
    kind: CompanyEventKindSchema,
    title: shortText,
    occursOn: CompanyPartialDateSchema,
    endsOn: CompanyPartialDateSchema.nullish(),
    entityIds: z.array(identifier).max(100),
    amountCents: z.number().int().safe().nonnegative().nullish(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullish(),
    confidence: CompanyConfidenceSchema,
  })
  .refine(
    (value) => !value.endsOn || value.occursOn.date <= value.endsOn.date,
    "End precedes start",
  )
  .refine(
    (value) => (value.amountCents == null) === (value.currency == null),
    "Amount and currency must be provided together",
  );

export const CompanyEvidenceInputSchema = z.strictObject({
  stance: z.enum(["supports", "contradicts"]).default("supports"),
  sourceKind: CompanySourceKindSchema,
  connectionId: identifier.nullish(),
  mcpServerId: identifier.nullish(),
  sourceItemId: identifier,
  sourceUrl: url.nullish(),
  quote: z.string().trim().min(1).max(240),
  contentHash: z.string().min(1).max(128),
  extractedAt: z.iso.datetime(),
  extractorRunId: identifier.nullish(),
  extractorModel: z.strictObject({ provider: identifier, model: identifier }).nullable(),
  confidence: CompanyConfidenceSchema,
});

export const CompanyEntityImportInputSchema = z
  .strictObject({
    entity: CompanyEntityInputSchema,
    evidence: CompanyEvidenceInputSchema,
  })
  .refine(({ evidence }) => evidence.sourceKind !== "manual", "Manual evidence is owner-authored");
export const CompanyEdgeImportInputSchema = z
  .strictObject({
    edge: CompanyEdgeInputSchema,
    evidence: CompanyEvidenceInputSchema,
  })
  .refine(({ evidence }) => evidence.sourceKind !== "manual", "Manual evidence is owner-authored");
export const CompanyEventImportInputSchema = z
  .strictObject({
    event: CompanyEventInputSchema,
    evidence: CompanyEvidenceInputSchema,
  })
  .refine(({ evidence }) => evidence.sourceKind !== "manual", "Manual evidence is owner-authored");

export const CompanyEntityEditInputSchema = z
  .discriminatedUnion("kind", [
    z.strictObject({
      entityId: identifier,
      kind: z.literal("company"),
      displayName: shortText.optional(),
      attrs: CompanyProfileAttrsSchema.partial().optional(),
    }),
    z.strictObject({
      entityId: identifier,
      kind: z.literal("person"),
      displayName: shortText.optional(),
      attrs: CompanyPersonAttrsSchema.partial().optional(),
    }),
    z.strictObject({
      entityId: identifier,
      kind: z.literal("organisation"),
      displayName: shortText.optional(),
      attrs: CompanyOrganisationAttrsSchema.partial().optional(),
    }),
    z.strictObject({
      entityId: identifier,
      kind: z.literal("matter"),
      displayName: shortText.optional(),
      attrs: CompanyMatterAttrsSchema.partial().optional(),
    }),
    z.strictObject({
      entityId: identifier,
      kind: z.literal("project"),
      displayName: shortText.optional(),
      attrs: CompanyProjectAttrsSchema.partial().optional(),
    }),
    z.strictObject({
      entityId: identifier,
      kind: z.literal("product"),
      displayName: shortText.optional(),
      attrs: CompanyProductAttrsSchema.partial().optional(),
    }),
  ])
  .refine(
    ({ displayName, attrs }) =>
      displayName !== undefined || (attrs !== undefined && Object.keys(attrs).length > 0),
    "Provide a name or at least one attribute to edit",
  );
export const CompanyConfirmInputSchema = z.strictObject({ entityId: identifier });
export const CompanyRejectInputSchema = z.strictObject({
  entityId: identifier,
  reason: shortText.nullish(),
});
export const CompanyMergeInputSchema = z.strictObject({
  sourceEntityId: identifier,
  survivorEntityId: identifier,
});

export type CompanyEntityKind = z.infer<typeof CompanyEntityKindSchema>;
export type CompanyFactKind = z.infer<typeof CompanyFactKindSchema>;
export type CompanyEntityInput = z.infer<typeof CompanyEntityInputSchema>;
export type CompanyEdgeInput = z.infer<typeof CompanyEdgeInputSchema>;
export type CompanyEventInput = z.infer<typeof CompanyEventInputSchema>;
export type CompanyEvidenceInput = z.infer<typeof CompanyEvidenceInputSchema>;
export type CompanyPartialDate = z.infer<typeof CompanyPartialDateSchema>;
export type CompanyEntityImportInput = z.infer<typeof CompanyEntityImportInputSchema>;
export type CompanyEdgeImportInput = z.infer<typeof CompanyEdgeImportInputSchema>;
export type CompanyEventImportInput = z.infer<typeof CompanyEventImportInputSchema>;
export type CompanyEntityEditInput = z.infer<typeof CompanyEntityEditInputSchema>;

/** Identity normalization is deterministic; a name alone is never a person identifier. */
export function normalizeCompanyName(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

export function companyEntityIdentifiers(input: CompanyEntityInput): string[] {
  if (input.kind === "person") {
    return [
      ...(input.attrs.workEmails ?? []).map((email) => `email:${email.toLowerCase()}`),
      ...(input.attrs.slackId ? [`slack:${input.attrs.slackId}`] : []),
      ...(input.attrs.githubLogin ? [`github:${input.attrs.githubLogin.toLowerCase()}`] : []),
      ...(input.attrs.linearId ? [`linear:${input.attrs.linearId}`] : []),
    ].sort();
  }
  if (input.kind === "organisation" && input.attrs.domain)
    return [`domain:${input.attrs.domain.toLowerCase()}`];
  return [`name:${normalizeCompanyName(input.displayName)}`];
}
