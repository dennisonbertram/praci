import { oc } from "@orpc/contract";
import * as z from "zod";
import {
  EquityAccessGrantListInputSchema,
  EquityAccessGrantPageSchema,
  EquityAccessGrantSchema,
  EquityAccessGrantSetInputSchema,
  EquityAccessGroupSchema,
  EquityAccessGroupSetInputSchema,
  EquityHealthFindingCreateInputSchema,
  EquityHealthFindingListInputSchema,
  EquityHealthFindingPageSchema,
  EquityHealthFindingSchema,
  EquityHealthFindingUpdateInputSchema,
  EquitySavedViewCreateInputSchema,
  EquitySavedViewListInputSchema,
  EquitySavedViewPageSchema,
  EquitySavedViewSchema,
  EquitySavedViewUpdateInputSchema,
} from "./access.js";
import {
  EquityDocumentLinkCreateInputSchema,
  EquityDocumentLinkListInputSchema,
  EquityDocumentLinkSchema,
} from "./access-documents.js";
import {
  EquityAccessContactLinkInputSchema,
  EquityAccessHolderListInputSchema,
  EquityAccessHolderPageSchema,
  EquityAccessHolderSchema,
  EquityAccessLevelBulkSetInputSchema,
  EquityAccessRequestResolveInputSchema,
} from "./access-holders.js";
import { EquityAccessViewInputSchema, EquityAccessViewSchema } from "./access-view.js";
import { EquityGetInputSchema } from "./common.js";
import {
  EquityExerciseCreateInputSchema,
  EquityExerciseListInputSchema,
  EquityExercisePageSchema,
  EquityExerciseSchema,
  EquityExerciseUpdateInputSchema,
  EquityOptionGrantCreateInputSchema,
  EquityOptionGrantListInputSchema,
  EquityOptionGrantPageSchema,
  EquityOptionGrantSchema,
  EquityOptionGrantUpdateInputSchema,
  EquityVestingTemplateCreateInputSchema,
  EquityVestingTemplateListInputSchema,
  EquityVestingTemplatePageSchema,
  EquityVestingTemplateSchema,
  EquityVestingTemplateUpdateInputSchema,
} from "./options.js";
import { optionsAreaContract } from "./options-rpc.js";
import {
  EquityImportResultSchema,
  EquityOverviewInputSchema,
  EquityOverviewSchema,
} from "./overview.js";
import {
  EquityDraftSetCreateInputSchema,
  EquityDraftSetListInputSchema,
  EquityDraftSetPageSchema,
  EquityDraftSetSchema,
  EquityDraftSetUpdateInputSchema,
  EquityFundingRoundCreateInputSchema,
  EquityFundingRoundListInputSchema,
  EquityFundingRoundPageSchema,
  EquityFundingRoundSchema,
  EquityFundingRoundUpdateInputSchema,
} from "./rounds.js";
import {
  EquityCertificateCreateInputSchema,
  EquityCertificateListInputSchema,
  EquityCertificatePageSchema,
  EquityCertificateSchema,
  EquityCertificateUpdateInputSchema,
  EquityConvertibleBlockCreateInputSchema,
  EquityConvertibleBlockSchema,
  EquityConvertibleBlockUpdateInputSchema,
  EquityConvertibleCreateInputSchema,
  EquityConvertibleListInputSchema,
  EquityConvertiblePageSchema,
  EquityConvertibleSchema,
  EquityConvertibleUpdateInputSchema,
  EquityTransactionListInputSchema,
  EquityTransactionPageSchema,
  EquityTransactionSchema,
} from "./securities.js";
// ---- securities area: imports ----
import {
  EquityAppSafeAddInputSchema,
  EquityAppSafeListInputSchema,
  EquityAppSafeListSchema,
} from "./securities-app-safes.js";
import {
  EquityConvertibleCancelInputSchema,
  EquityConvertibleCancelResultSchema,
  EquityConvertibleTotalsSchema,
  EquityPricedRoundInputSchema,
  EquityPricedRoundPreviewSchema,
  EquityPricedRoundResultSchema,
  EquitySafeFundingSchema,
  EquitySafeFundingSetInputSchema,
} from "./securities-convertibles.js";
import {
  EquityDraftSetIssueInputSchema,
  EquityDraftSetIssueResultSchema,
  EquityDraftSetReviewSchema,
} from "./securities-drafts.js";
import {
  EquityCancelInputSchema,
  EquityCertificateTotalsSchema,
  EquityConvertCertificateInputSchema,
  EquityRepurchaseInputSchema,
  EquityShareTransactionResultSchema,
  EquityTransferInputSchema,
} from "./securities-transactions.js";
import {
  EquityPlanCreateInputSchema,
  EquityPlanListInputSchema,
  EquityPlanPageSchema,
  EquityPlanSchema,
  EquityPlanUpdateInputSchema,
  EquityShareClassCreateInputSchema,
  EquityShareClassListInputSchema,
  EquityShareClassPageSchema,
  EquityShareClassSchema,
  EquityShareClassUpdateInputSchema,
} from "./share-classes.js";
import {
  EquityCustomPropertyCreateInputSchema,
  EquityCustomPropertySchema,
  EquityCustomPropertyUpdateInputSchema,
  EquityStakeholderCreateInputSchema,
  EquityStakeholderDetailSchema,
  EquityStakeholderListInputSchema,
  EquityStakeholderPageSchema,
  EquityStakeholderUpdateInputSchema,
} from "./stakeholders.js";
import { equityStakeholderAreaContract } from "./stakeholders-actions.js";
import * as views from "./views.js";

/** list, get, create and update for one entity. */
function crud<
  L extends z.ZodTypeAny,
  P extends z.ZodTypeAny,
  R extends z.ZodTypeAny,
  C extends z.ZodTypeAny,
  U extends z.ZodTypeAny,
>(schemas: { list: L; page: P; record: R; create: C; update: U }) {
  return {
    list: oc.input(schemas.list).output(schemas.page),
    get: oc.input(EquityGetInputSchema).output(schemas.record),
    create: oc.input(schemas.create).output(schemas.record),
    update: oc.input(schemas.update).output(schemas.record),
  };
}

/**
 * The cap table ledger, mounted as `equity` in the app contract. Web and desktop only (left out of
 * the iOS OpenAPI document). Every procedure is scoped to the caller's space and user; a record of
 * anyone else is NOT_FOUND. Areas add procedures in their marked section, never in another's.
 */
export const equityContract = {
  // ---- foundation ----
  /** The cap table by share class from the ledger, with the empty-state flags. */
  overview: oc.input(EquityOverviewInputSchema).output(EquityOverviewSchema),
  /** Copies the current snapshot into the empty ledger once; CONFLICT when the ledger has data. */
  importSnapshot: oc.output(EquityImportResultSchema),
  stakeholders: crud({
    list: EquityStakeholderListInputSchema,
    page: EquityStakeholderPageSchema,
    record: EquityStakeholderDetailSchema,
    create: EquityStakeholderCreateInputSchema,
    update: EquityStakeholderUpdateInputSchema,
  }),
  customProperties: {
    list: oc.output(z.array(EquityCustomPropertySchema)),
    create: oc.input(EquityCustomPropertyCreateInputSchema).output(EquityCustomPropertySchema),
    update: oc.input(EquityCustomPropertyUpdateInputSchema).output(EquityCustomPropertySchema),
  },
  shareClasses: crud({
    list: EquityShareClassListInputSchema,
    page: EquityShareClassPageSchema,
    record: EquityShareClassSchema,
    create: EquityShareClassCreateInputSchema,
    update: EquityShareClassUpdateInputSchema,
  }),
  plans: crud({
    list: EquityPlanListInputSchema,
    page: EquityPlanPageSchema,
    record: EquityPlanSchema,
    create: EquityPlanCreateInputSchema,
    update: EquityPlanUpdateInputSchema,
  }),
  vestingTemplates: crud({
    list: EquityVestingTemplateListInputSchema,
    page: EquityVestingTemplatePageSchema,
    record: EquityVestingTemplateSchema,
    create: EquityVestingTemplateCreateInputSchema,
    update: EquityVestingTemplateUpdateInputSchema,
  }),
  certificates: crud({
    list: EquityCertificateListInputSchema,
    page: EquityCertificatePageSchema,
    record: EquityCertificateSchema,
    create: EquityCertificateCreateInputSchema,
    update: EquityCertificateUpdateInputSchema,
  }),
  convertibleBlocks: {
    list: oc.output(z.array(EquityConvertibleBlockSchema)),
    create: oc.input(EquityConvertibleBlockCreateInputSchema).output(EquityConvertibleBlockSchema),
    update: oc.input(EquityConvertibleBlockUpdateInputSchema).output(EquityConvertibleBlockSchema),
  },
  convertibles: crud({
    list: EquityConvertibleListInputSchema,
    page: EquityConvertiblePageSchema,
    record: EquityConvertibleSchema,
    create: EquityConvertibleCreateInputSchema,
    update: EquityConvertibleUpdateInputSchema,
  }),
  optionGrants: crud({
    list: EquityOptionGrantListInputSchema,
    page: EquityOptionGrantPageSchema,
    record: EquityOptionGrantSchema,
    create: EquityOptionGrantCreateInputSchema,
    update: EquityOptionGrantUpdateInputSchema,
  }),
  exercises: crud({
    list: EquityExerciseListInputSchema,
    page: EquityExercisePageSchema,
    record: EquityExerciseSchema,
    create: EquityExerciseCreateInputSchema,
    update: EquityExerciseUpdateInputSchema,
  }),
  /** Append-only: read here; written by the stores as a side effect of every change. */
  transactions: {
    list: oc.input(EquityTransactionListInputSchema).output(EquityTransactionPageSchema),
    get: oc.input(EquityGetInputSchema).output(EquityTransactionSchema),
  },
  draftSets: crud({
    list: EquityDraftSetListInputSchema,
    page: EquityDraftSetPageSchema,
    record: EquityDraftSetSchema,
    create: EquityDraftSetCreateInputSchema,
    update: EquityDraftSetUpdateInputSchema,
  }),
  fundingRounds: crud({
    list: EquityFundingRoundListInputSchema,
    page: EquityFundingRoundPageSchema,
    record: EquityFundingRoundSchema,
    create: EquityFundingRoundCreateInputSchema,
    update: EquityFundingRoundUpdateInputSchema,
  }),
  savedViews: crud({
    list: EquitySavedViewListInputSchema,
    page: EquitySavedViewPageSchema,
    record: EquitySavedViewSchema,
    create: EquitySavedViewCreateInputSchema,
    update: EquitySavedViewUpdateInputSchema,
  }),
  /** Every group with its level (the default when never saved) and member count. */
  accessGroups: {
    list: oc.output(z.array(EquityAccessGroupSchema)),
    set: oc.input(EquityAccessGroupSetInputSchema).output(EquityAccessGroupSchema),
  },
  accessGrants: {
    list: oc.input(EquityAccessGrantListInputSchema).output(EquityAccessGrantPageSchema),
    set: oc.input(EquityAccessGrantSetInputSchema).output(EquityAccessGrantSchema),
  },
  healthFindings: crud({
    list: EquityHealthFindingListInputSchema,
    page: EquityHealthFindingPageSchema,
    record: EquityHealthFindingSchema,
    create: EquityHealthFindingCreateInputSchema,
    update: EquityHealthFindingUpdateInputSchema,
  }),
  // ---- stakeholders area ----
  ...equityStakeholderAreaContract,
  // ---- securities area ----
  /** Share transactions on one certificate; each writes one transaction row. */
  /** The board-approved SAFE amount against what SAFEs raised. */
  safeFunding: {
    get: oc.output(EquitySafeFundingSchema),
    set: oc.input(EquitySafeFundingSetInputSchema).output(EquitySafeFundingSchema),
  },
  convertibleTotals: oc
    .input(EquityConvertibleListInputSchema)
    .output(EquityConvertibleTotalsSchema),
  certificateTotals: oc
    .input(EquityCertificateListInputSchema)
    .output(EquityCertificateTotalsSchema),
  shareTransactions: {
    transfer: oc.input(EquityTransferInputSchema).output(EquityShareTransactionResultSchema),
    repurchase: oc.input(EquityRepurchaseInputSchema).output(EquityShareTransactionResultSchema),
    cancel: oc.input(EquityCancelInputSchema).output(EquityShareTransactionResultSchema),
    convert: oc
      .input(EquityConvertCertificateInputSchema)
      .output(EquityShareTransactionResultSchema),
  },
  /** Fundraising's SAFEs, read through so the cap table shows them without a copy. */
  appSafes: {
    list: oc.input(EquityAppSafeListInputSchema).output(EquityAppSafeListSchema),
    addToLedger: oc.input(EquityAppSafeAddInputSchema).output(EquityConvertibleSchema),
  },
  /** Review a draft set against the ledger, then issue every security in it at once. */
  draftSetActions: {
    review: oc.input(EquityDraftSetIssueInputSchema).output(EquityDraftSetReviewSchema),
    issue: oc.input(EquityDraftSetIssueInputSchema).output(EquityDraftSetIssueResultSchema),
  },
  /** Cancel a SAFE or note, and convert SAFEs and notes in a priced round (preview, then commit). */
  convertibleTransactions: {
    cancel: oc
      .input(EquityConvertibleCancelInputSchema)
      .output(EquityConvertibleCancelResultSchema),
    previewPricedRound: oc
      .input(EquityPricedRoundInputSchema)
      .output(EquityPricedRoundPreviewSchema),
    convertPricedRound: oc
      .input(EquityPricedRoundInputSchema)
      .output(EquityPricedRoundResultSchema),
  },
  // ---- options area ----
  ...optionsAreaContract,
  // ---- views area ----
  views: {
    capTableByStakeholder: oc
      .input(views.EquityCapTableByStakeholderInputSchema)
      .output(views.EquityCapTableByStakeholderSchema),
    cashRaised: oc.input(views.EquityCashRaisedInputSchema).output(views.EquityCashRaisedSchema),
    attachToRound: oc
      .input(views.EquityRoundAttachInputSchema)
      .output(views.EquityRoundAttachResultSchema),
    scenarios: crud({
      list: views.EquityRoundScenarioListInputSchema,
      page: views.EquityRoundScenarioPageSchema,
      record: views.EquityRoundScenarioSchema,
      create: views.EquityRoundScenarioCreateInputSchema,
      update: views.EquityRoundScenarioUpdateInputSchema,
    }),
    /** A pro forma cap table for a priced round; reads the ledger, never writes it. */
    modelRound: oc.input(views.EquityRoundModelInputSchema).output(views.EquityRoundModelSchema),
    report: oc.input(views.EquityReportInputSchema).output(views.EquityReportSchema),
    /** The latest generated reports, newest first. */
    reportHistory: oc.output(z.array(views.EquityReportRunSchema)),
    runHealthChecks: oc
      .input(views.EquityHealthRunInputSchema)
      .output(views.EquityHealthRunResultSchema),
    estimatedValue: {
      get: oc.output(views.EquityEstimatedValueSettingsSchema),
      set: oc
        .input(views.EquityEstimatedValueSettingsInputSchema)
        .output(views.EquityEstimatedValueSettingsSchema),
    },
  },
  // ---- access area ----
  accessView: {
    get: oc.input(EquityAccessViewInputSchema).output(EquityAccessViewSchema),
  },
  documentLinks: {
    list: oc.input(EquityDocumentLinkListInputSchema).output(z.array(EquityDocumentLinkSchema)),
    create: oc.input(EquityDocumentLinkCreateInputSchema).output(EquityDocumentLinkSchema),
    delete: oc.input(EquityGetInputSchema).output(z.object({ ok: z.literal(true) })),
  },
  accessHolders: {
    list: oc.input(EquityAccessHolderListInputSchema).output(EquityAccessHolderPageSchema),
    setLevels: oc
      .input(EquityAccessLevelBulkSetInputSchema)
      .output(z.array(EquityAccessHolderSchema)),
    resolveRequest: oc
      .input(EquityAccessRequestResolveInputSchema)
      .output(EquityAccessHolderSchema),
    linkContact: oc.input(EquityAccessContactLinkInputSchema).output(EquityAccessHolderSchema),
  },
};
