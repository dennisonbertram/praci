import { readFileSync } from "node:fs";
import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import { collectors, latestAccountExport, requestAccountExport } from "./account-export.js";

const HOUR = 60 * 60 * 1000;
const now = new Date("2026-01-10T12:00:00Z");
const row = (status: string, ageMs: number) => ({
  id: "exp-1",
  userId: "user-1",
  spaceId: "space-1",
  status,
  progress: 40,
  missingFiles: 0,
  expiresAt: new Date(now.getTime() + 7 * 24 * HOUR),
  createdAt: new Date(now.getTime() - ageMs),
  updatedAt: new Date(now.getTime() - ageMs),
});

describe("account export stale handling", () => {
  it("shows a build nobody has touched for hours as failed, so Request export comes back", async () => {
    const prisma = { accountExport: { findFirst: vi.fn(async () => row("running", 3 * HOUR)) } };
    const result = await latestAccountExport(prisma as never, "user-1", now);
    expect(result?.status).toBe("failed");
  });

  it("keeps a build touched 90 minutes ago running", async () => {
    const prisma = { accountExport: { findFirst: vi.fn(async () => row("running", 1.5 * HOUR)) } };
    const result = await latestAccountExport(prisma as never, "user-1", now);
    expect(result?.status).toBe("running");
  });

  it("does not mark a live build failed when a request arrives 90 minutes in", async () => {
    const updateMany = vi.fn(async () => ({ count: 0 }));
    const prisma = {
      accountExport: { updateMany, findFirst: vi.fn(async () => row("running", 1.5 * HOUR)) },
    } as unknown as PrismaClient;
    await requestAccountExport(
      { prisma, jobs: { enqueue: vi.fn() } as never },
      { userId: "user-1", spaceId: "space-1" },
      now,
    );
    const cutoff = (
      updateMany.mock.calls[0] as unknown as [{ where: { updatedAt: { lt: Date } } }]
    )[0].where.updatedAt.lt;
    expect(cutoff.getTime()).toBeLessThanOrEqual(now.getTime() - 2 * HOUR);
  });
});

const spaceIds = ["space-1", "space-2"];
const requester = "user-1";

/** Runs every collector against a Prisma stand-in that records the delegate and `where` each one reads. */
async function recordCollectors() {
  const calls: { path: string; model: string; where: Record<string, unknown> }[] = [];
  let current = "";
  const prisma = new Proxy(
    {},
    {
      get: (_target, model: string) => ({
        findMany: async (args: { where: Record<string, unknown> }) => {
          calls.push({ path: current, model, where: args.where });
          return [];
        },
      }),
    },
  ) as unknown as PrismaClient;
  for (const [path, pager] of collectors(prisma, requester, spaceIds)) {
    current = path;
    await pager(undefined);
  }
  return calls;
}

const inSpaces = (value: unknown) => JSON.stringify(value) === JSON.stringify({ in: spaceIds });
/** Own rows in the requester's spaces, or an existing special case: messages via thread, watch state via routine, shares via creator. */
const isScoped = (where: Record<string, unknown>): boolean => {
  const thread = where.thread as Record<string, unknown> | undefined;
  if (thread) return isScoped(thread);
  const routine = where.routine as { userId?: string } | undefined;
  return (
    inSpaces(where.spaceId) &&
    (where.userId === requester ||
      where.createdByUserId === requester ||
      routine?.userId === requester)
  );
};

const NEW_FILES: Record<string, string> = {
  "finance-accounts.json": "financeAccount",
  "finance-transactions.json": "financeTransaction",
  "finance-bills.json": "financeBill",
  "safes.json": "safe",
  "fundraise-rounds.json": "fundraiseRound",
  "investor-updates.json": "investorUpdate",
  "pipeline-records.json": "pipelineRecord",
  "inbox-todos.json": "inboxTodo",
};

describe("account export collectors", () => {
  it("exports finance, SAFEs, fundraising, investor updates, pipeline and inbox to-dos", async () => {
    const calls = await recordCollectors();
    for (const [path, model] of Object.entries(NEW_FILES)) {
      const call = calls.find((c) => c.path === path);
      expect(call, path).toBeDefined();
      expect(call?.model).toBe(model);
    }
  });

  it("scopes every collector to the requester and their spaces", async () => {
    for (const call of await recordCollectors()) {
      expect(isScoped(call.where), `${call.path} reads ${JSON.stringify(call.where)}`).toBe(true);
    }
  });
});

/** Models with a userId that the export deliberately leaves out, and why. */
const NOT_EXPORTED: Record<string, string[]> = {
  "secrets and credentials": [
    "Account",
    "BotMcpServer",
    "BotSecret",
    "BrowserProfile",
    "FinanceExchangeConnection",
    "InvestorPortalToken",
    "InvestorShareRequest",
    "Member",
    "McpConnection",
    "McpOAuthSession",
    "McpServer",
    "MessagingIdentity",
    "MessagingLinkCode",
    "ModelOAuthState",
    "NotificationEndpoint",
    "OauthAccessToken",
    "OauthClient",
    "OauthConsent",
    "OauthRefreshToken",
    "Passkey",
    "PortalSession",
    "Secret",
    "Session",
    "TeachHeldValue",
    "UserModelCredential",
    "UserVoiceCredential",
  ],
  "caches, sync state and leases": [
    "AppControlSnapshot",
    "ContactPhoto",
    "DataRoomChange",
    "DataRoomChunk",
    "DataRoomImport",
    "DataRoomItemText",
    "DataRoomSyncState",
    "FinanceCryptoSnapshot",
    "FinanceExchangeBalance",
    "FinanceExchangeSnapshot",
    "FinanceSyncState",
    "FinanceTreasuryYield",
    "MeetingCapture",
    "MeetingCaptureChunk",
    "MeetingSyncState",
    "MeetingTombstone",
    "ModelConnectionPause",
    "OmiSegment",
    "OmiUpload",
    "SafeSyncState",
  ],
  "mail cache (bodies stay in the mail account)": [
    "CachedMailMessage",
    "ComposeSend",
    "InboxSenderFeedback",
    "MailActionLog",
    "MailReplyItem",
    "MailSearch",
    "MailSenderDecision",
    "MailSenderStat",
  ],
  "run logs and transport": [
    "AccountExport",
    "AuditRequest",
    "CloudAgent",
    "Computer",
    "ExternalAction",
    "ExternalConversation",
    "Run",
    "RunFragment",
    "SteeringMessage",
    "TranscriptionSelection",
    "UsageRecord",
  ],
  "not exported yet (backlog)": [
    "ActionAutoReviewPreference",
    "AgentHome",
    "Artifact",
    "BotConnectionAccess",
    "BotPage",
    "BotPins",
    "BotSourceAccess",
    "CapabilityInstall",
    "DataRoomPreference",
    "FinanceChartNote",
    "FinanceCryptoHolding",
    "FinancePreference",
    "FinanceStatement",
    "FinanceWallet",
    "InvestorShare",
    "MeetingHandoff",
    "Notification",
    "PageSource",
    "PipelineEvent",
    "PipelineImport",
    "PipelineImportRow",
    "PipelineRecordPerson",
    "ScratchpadApproval",
    "SpaceBackupModel",
    "SpaceMemoryConfig",
    "SpaceModelPreference",
    "SpaceVoicePreference",
    "Task",
    "TaughtSkill",
    "ThreadGoal",
  ],
};
/** Read outside the collectors list: profile, spaces, AI consent summary and the Data room files. */
const USED_OUTSIDE_COLLECTORS = ["user", "spaceMember", "aiDataConsent", "dataRoomItem"];

describe("account export coverage", () => {
  it("covers every model that has a userId, or lists it as not exported", async () => {
    const schema = readFileSync(new URL("../../db/prisma/schema.prisma", import.meta.url), "utf8");
    const owned: string[] = [];
    let model = "";
    for (const line of schema.split("\n")) {
      const start = /^model (\w+) \{/.exec(line);
      if (start) model = start[1] as string;
      if (model && /^\s+userId\s/.test(line)) owned.push(model);
    }
    const lower = (name: string) => name.charAt(0).toLowerCase() + name.slice(1);
    const exported = new Set([
      ...(await recordCollectors()).map((c) => c.model),
      ...USED_OUTSIDE_COLLECTORS,
    ]);
    const skipped = new Set(Object.values(NOT_EXPORTED).flat());
    const unclassified = owned.filter((m) => !exported.has(lower(m)) && !skipped.has(m));
    expect(unclassified, "export it in account-export.ts or add it to NOT_EXPORTED").toEqual([]);
    const stale = [...skipped].filter((m) => !owned.includes(m) || exported.has(lower(m)));
    expect(stale, "listed as not exported but missing or already exported").toEqual([]);
  });
});

describe("account export of the cap table", () => {
  it("writes one scoped file for every Equity model in the schema", async () => {
    const schema = readFileSync(new URL("../../db/prisma/schema.prisma", import.meta.url), "utf8");
    // The audit trail is exported as equity-audit-events.json, outside cap-table/.
    const models = [...schema.matchAll(/^model (Equity\w+) \{/gm)]
      .map((m) => m[1] as string)
      .filter((name) => name !== "EquityAuditEvent");
    expect(models.length).toBeGreaterThan(20);
    const calls = (await recordCollectors()).filter((c) => c.path.startsWith("cap-table/"));
    const lower = (name: string) => name.charAt(0).toLowerCase() + name.slice(1);
    expect(calls.map((c) => c.model).sort()).toEqual(models.map(lower).sort());
    for (const call of calls) {
      expect(call.where, call.path).toEqual({ userId: requester, spaceId: { in: spaceIds } });
    }
  });
});
