import { isInvestorsAgentSpawnKey } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { getFundraisingOverview } from "@rakazo/db";
import { mailToolsAllowed } from "./mail-tools.js";

/** The Investors agent's read of the Fundraising page. */
export const FUNDRAISING_TOOL_NAMES = new Set(["fundraising_read"]);

/** Only the Investors agent, on a run its owner started. */
export function fundraisingToolsAllowed(
  options: Parameters<typeof mailToolsAllowed>[0] & { botSpawnKey: string | null | undefined },
): boolean {
  return isInvestorsAgentSpawnKey(options.botSpawnKey) && mailToolsAllowed(options);
}

const dollars = (cents: number | null | undefined) => (cents == null ? null : cents / 100);

type FundraisingToolDeps = {
  prisma: Pick<PrismaClient, "contact" | "fundraiseRound" | "safe">;
  /** From the run (the bot owner), never from model input. */
  scope: { spaceId: string; userId: string };
};

export async function fundraisingToolFromTool(
  name: string,
  deps: FundraisingToolDeps,
): Promise<Record<string, unknown>> {
  if (name !== "fundraising_read") return { error: `Unknown fundraising tool ${name}` };
  try {
    const { round, pendingCents, signedCents, fundedCents, prospects, safes } = await getFundraisingOverview(
      deps.prisma,
      deps.scope,
    );
    const open = round && !round.closedAt ? round : null;
    return {
      round: round && {
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
      prospects: prospects.map((p) => ({
        name: p.name,
        email: p.email,
        organization: p.organization,
        stage: p.stage,
        checkSizeUsd: dollars(p.checkSizeCents),
        nextStep: p.nextStep,
        countsInPending: Boolean(open) && p.stage === "committed" && p.roundId === open?.id,
      })),
    };
  } catch {
    return { error: "Fundraising tool failed" };
  }
}
