import {
  FundraiseRoundSaveInputSchema,
  isInvestorsAgentSpawnKey,
  PIPELINE_IMPORT_REVIEW_TOOL,
  PIPELINE_IMPORT_STAGE_TOOL,
} from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import {
  FundraiseRoundOpenError,
  getFundraisingOverview,
  IsolationError,
  saveRound,
} from "@rakazo/db";
import { mailToolsAllowed } from "./mail-tools.js";

/** The Investors agent's read of the Fundraising page, and its writes: the round, and list imports. */
export const FUNDRAISING_TOOL_NAMES = new Set([
  "fundraising_read",
  "fundraising_round_save",
  PIPELINE_IMPORT_STAGE_TOOL,
  PIPELINE_IMPORT_REVIEW_TOOL,
]);

/** Only the Investors agent, on a run its owner started. */
export function fundraisingToolsAllowed(
  options: Parameters<typeof mailToolsAllowed>[0] & { botSpawnKey: string | null | undefined },
): boolean {
  return isInvestorsAgentSpawnKey(options.botSpawnKey) && mailToolsAllowed(options);
}

const dollars = (cents: number | null | undefined) => (cents == null ? null : cents / 100);

type FundraisingToolDeps = {
  prisma: Pick<
    PrismaClient,
    | "$transaction"
    | "contact"
    | "fundraiseRound"
    | "safe"
    | "pipelineRecord"
    | "pipelineRecordPerson"
    | "pipelineEvent"
  >;
  /** From the run (the bot owner), never from model input. */
  scope: { spaceId: string; userId: string };
};

/** Whole US dollars from the model become the cents the Fundraising page stores. */
const toCents = (usd: unknown) =>
  typeof usd === "number" && Number.isFinite(usd) && usd > 0 ? Math.round(usd * 100) : null;

/**
 * Starts the round or edits the open one through the same `saveRound` the Fundraising page uses.
 * The card has already been approved by the time this runs. Mercury stays the only SAFE record.
 */
async function saveRoundFromTool(
  deps: FundraisingToolDeps,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const parsed = FundraiseRoundSaveInputSchema.safeParse({
    id: typeof args.id === "string" && args.id ? args.id : undefined,
    name: args.name,
    targetCents: toCents(args.targetUsd),
    capCents: toCents(args.postMoneyCapUsd),
  });
  if (!parsed.success) {
    return { error: "Pass name, targetUsd and postMoneyCapUsd as whole US dollars above zero." };
  }
  try {
    const round = await saveRound(deps.prisma, deps.scope, parsed.data);
    return {
      ok: true,
      round: {
        id: round.id,
        name: round.name,
        status: "open",
        targetUsd: dollars(round.targetCents),
        postMoneyCapUsd: dollars(round.capCents),
      },
    };
  } catch (error) {
    if (error instanceof FundraiseRoundOpenError) {
      return {
        error:
          "A round is already open. Call fundraising_read for its id and pass it as id to change it, or ask the user to close it on the Fundraising page first.",
      };
    }
    if (error instanceof IsolationError) {
      return { error: "That round was not found, or it is closed and cannot be edited." };
    }
    return { error: "Fundraising tool failed" };
  }
}

export async function fundraisingToolFromTool(
  name: string,
  deps: FundraisingToolDeps,
  args: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  if (name === "fundraising_round_save") return saveRoundFromTool(deps, args);
  if (name !== "fundraising_read") return { error: `Unknown fundraising tool ${name}` };
  const prospect = typeof args.prospect === "string" ? args.prospect.trim().toLowerCase() : "";
  try {
    const { round, pendingCents, signedCents, fundedCents, prospects, safes } =
      await getFundraisingOverview(deps.prisma, deps.scope);
    const open = round && !round.closedAt ? round : null;
    return {
      round: round && {
        id: round.id,
        name: round.name,
        status: open ? "open" : "closed",
        targetUsd: dollars(round.targetCents),
        postMoneyCapUsd: dollars(round.capCents),
        closedAt: round.closedAt,
      },
      // Check size of the open round's Committed prospects; zero with no open round.
      pendingUsd: dollars(pendingCents),
      // SAFE money of the shown round: signed (not yet paid) and funded (paid).
      signedUsd: dollars(signedCents),
      fundedUsd: dollars(fundedCents),
      safes: safes.map((s) => ({
        investor: s.investorName,
        source: s.source,
        status: s.status,
        amountUsd: dollars(s.amountCents),
        postMoneyCapUsd: dollars(s.capCents),
        sentAt: s.sentAt,
        paidAt: s.paidAt,
        inShownRound: Boolean(round) && s.roundId === round?.id,
      })),
      prospects: prospects
        .filter((p) => {
          if (!prospect) return true;
          const names = [
            p.name,
            p.organization,
            p.pipelineRecord?.name,
            ...(p.pipelineRecord?.people?.map((person) => person.name) ?? []),
          ];
          return names.some((named) => named?.toLowerCase().includes(prospect));
        })
        .map((p) => ({
          name: p.name,
          email: p.email,
          organization: p.organization,
          stage: p.stage,
          status: p.pipelineRecord?.status ?? null,
          interest: p.pipelineRecord?.interest ?? null,
          nextCallAt: p.pipelineRecord?.nextCallAt ?? null,
          nextCallHasTime: p.pipelineRecord?.nextCallHasTime ?? false,
          lastContactAt: p.pipelineRecord?.lastContactAt ?? null,
          lastCall: p.pipelineRecord?.lastCall
            ? {
                outcome: p.pipelineRecord.lastCall.outcome,
                at: p.pipelineRecord.lastCall.at,
                ...(prospect ? { note: p.pipelineRecord.lastCall.note } : {}),
              }
            : null,
          checkSizeUsd: dollars(p.checkSizeCents),
          nextStep: p.nextStep,
          countsInPending: Boolean(open) && p.stage === "committed" && p.roundId === open?.id,
          // With `prospect` set, the full record for outreach prep; without it the small row.
          ...(prospect
            ? {
                group: p.pipelineRecord?.group ?? null,
                people: (p.pipelineRecord?.people ?? []).map((person) => ({ name: person.name })),
                referredBy: p.pipelineRecord?.referredBy?.name ?? null,
                details: (p.pipelineRecord?.details ?? []).map((detail) => ({
                  label: detail.label,
                  value: detail.value,
                })),
              }
            : {}),
        })),
    };
  } catch {
    return { error: "Fundraising tool failed" };
  }
}
