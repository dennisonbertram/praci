import type { Actor } from "@rakazo/contracts";
import {
  isCartaAgentSpawnKey,
  isCompanyAgentSpawnKey,
  isCompanyImporterSpawnKey,
  isCustomPageSpawnKey,
  isDataRoomAgentSpawnKey,
  isFinanceAgentSpawnKey,
  isGtmAgentSpawnKey,
  isInboxAgentSpawnKey,
  isInvestorsAgentSpawnKey,
  isLegalAgentSpawnKey,
  isScannerAgentSpawnKey,
  SCANNER_AGENT_BUILTIN_TOOLS,
} from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { z } from "zod";

const ScannerHandoffInputSchema = z.strictObject({
  bot_id: z.string().min(1),
  item_id: z.string().min(1),
});
const scannerToolNames: ReadonlySet<string> = new Set(SCANNER_AGENT_BUILTIN_TOOLS);

export function scannerToolAllowed(name: string, trigger: string): boolean {
  return (
    scannerToolNames.has(name) &&
    (name !== "message_bot" || ["user", "follow_up", "goal"].includes(trigger))
  );
}

const isPageAgentSpawnKey = (spawnKey: string | null) =>
  [
    isCartaAgentSpawnKey,
    isCompanyAgentSpawnKey,
    isCompanyImporterSpawnKey,
    isCustomPageSpawnKey,
    isDataRoomAgentSpawnKey,
    isFinanceAgentSpawnKey,
    isGtmAgentSpawnKey,
    isInboxAgentSpawnKey,
    isInvestorsAgentSpawnKey,
    isLegalAgentSpawnKey,
    isScannerAgentSpawnKey,
  ].some((isAgent) => isAgent(spawnKey));

export async function prepareScannerHandoff(
  prisma: Pick<PrismaClient, "bot" | "dataRoomItem">,
  scope: Pick<Actor, "spaceId" | "userId">,
  rawArgs: Record<string, unknown>,
): Promise<
  | { ok: true; args: { bot_id: string; message: string; intent: "request" } }
  | { ok: false; error: string }
> {
  const parsed = ScannerHandoffInputSchema.safeParse(rawArgs);
  if (!parsed.success) {
    return { ok: false, error: "A page-agent handoff needs only bot_id and item_id." };
  }

  const item = await prisma.dataRoomItem.findFirst({
    where: {
      id: parsed.data.item_id,
      spaceId: scope.spaceId,
      userId: scope.userId,
      source: "scan",
    },
    select: { id: true },
  });
  if (!item) return { ok: false, error: "Scanned item or page agent not found." };

  const target = await prisma.bot.findFirst({
    where: {
      id: parsed.data.bot_id,
      spaceId: scope.spaceId,
      userId: scope.userId,
      archivedAt: null,
    },
    select: { id: true, spawnKey: true },
  });
  if (!target || !isPageAgentSpawnKey(target.spawnKey)) {
    return { ok: false, error: "Scanned item or page agent not found." };
  }

  return {
    ok: true,
    args: {
      bot_id: target.id,
      message: `Review scanned Data room item ${item.id}.`,
      intent: "request",
    },
  };
}
