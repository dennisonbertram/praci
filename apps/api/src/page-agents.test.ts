import { createHash } from "node:crypto";
import type { Actor, Bot } from "@rakazo/contracts";
import {
  COMPANY_AGENT_INSTRUCTIONS,
  COMPANY_IMPORTER_INSTRUCTIONS,
  cartaAgentSpawnKey,
  companyAgentSpawnKey,
  companyImporterSpawnKey,
  dataRoomAgentSpawnKey,
  financeAgentSpawnKey,
  gtmAgentSpawnKey,
  inboxAgentSpawnKey,
  investorsAgentSpawnKey,
  LEGAL_AGENT_MODEL,
  legalAgentSpawnKey,
  pageAgentColor,
  scannerAgentSpawnKey,
  voiceAgentSpawnKey,
} from "@rakazo/contracts";
import { VOICE_AGENT_INSTRUCTIONS } from "@rakazo/core";
import { describe, expect, it, vi } from "vitest";
import { AGENT_DEFAULT_HASHES } from "./agent-default-history.js";
import { BUILT_IN_AGENTS, upgradeBuiltInAgentInstructions } from "./agent-instruction-upgrades.js";
import { PAST_DEFAULTS } from "./agent-past-defaults.fixture.js";
import { instructionsUpgrade } from "./bot-instructions-upgrade.js";
import { CARTA_AGENT_INSTRUCTIONS, ensureCartaAgent } from "./carta-agent.js";
import { ensureCompanyAgent, ensureCompanyImporter } from "./company-agent.js";
import { DATA_ROOM_AGENT_INSTRUCTIONS, ensureDataRoomAgent } from "./data-room-agent.js";
import { ensureFinanceAgent, FINANCE_AGENT_INSTRUCTIONS } from "./finance-agent.js";
import { ensureGtmBot, GTM_AGENT_INSTRUCTIONS } from "./gtm-agent.js";
import { ensureInboxAgent, INBOX_AGENT_INSTRUCTIONS } from "./inbox-agent.js";
import { ensureInvestorsAgent, INVESTORS_AGENT_INSTRUCTIONS } from "./investors-agent.js";
import { ensureLegalAgent, LEGAL_AGENT_INSTRUCTIONS } from "./legal-agent.js";
import { ensureScannerAgent, SCANNER_AGENT_INSTRUCTIONS } from "./scanner-agent.js";
import { ensureVoiceAgent } from "./voice-agent.js";

const actor: Actor = {
  userId: "user-1",
  spaceId: "space-1",
  email: "user-1@rakazo.test",
  isDeploymentOwner: false,
};

type Row = Record<string, unknown>;

/** One stored bot per spawn key, like the unique (spaceId, spawnKey) index; prisma and repos edit the same rows. */
function fakes() {
  const rows = new Map<string, Row>();
  const created: Row[] = [];
  const matches = (row: Row, where: Row) =>
    Object.entries(where).every(([key, value]) => (row[key] ?? null) === value);
  const apply = async ({ where, data }: { where: Row; data: Row }) => {
    const hit = [...rows.values()].filter((row) => matches(row, where));
    for (const row of hit) Object.assign(row, data);
    return { count: hit.length };
  };
  const createBot = vi.fn(async (who: Actor, input: Row & { spawnKey: string }) => {
    created.push(input);
    if (!rows.has(input.spawnKey))
      rows.set(input.spawnKey, {
        id: `bot-${rows.size + 1}`,
        spaceId: who.spaceId,
        userId: who.userId,
        ...input,
      });
    return { ...rows.get(input.spawnKey) } as unknown as Bot;
  });
  const replaceBotInstructions = vi.fn(
    async (_actor: Actor, id: string, input: { from: string; to: string }) => {
      await apply({ where: { id, instructions: input.from }, data: { instructions: input.to } });
    },
  );
  const tx = {
    $executeRaw: vi.fn(async () => 0),
    bot: {
      findFirst: vi.fn(async () => [...rows.values()][0] ?? null),
      updateMany: vi.fn(apply),
    },
    mcpServer: { findMany: vi.fn(async () => []), updateMany: vi.fn(async () => ({ count: 0 })) },
    botMcpServer: {
      upsert: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    routine: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: "routine-1", prompt: "" })),
      update: vi.fn(async () => ({})),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    user: { findUnique: vi.fn(async () => ({ timezone: "UTC" })) },
  };
  const prisma = {
    ...tx,
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  const jobs = { enqueue: vi.fn(async () => undefined), cancel: vi.fn(async () => undefined) };
  const repos = { createBot, replaceBotInstructions };
  const deps = { prisma, repos, jobs } as never;
  return { rows, created, deps, repos, prisma };
}

type Case = {
  kind: string;
  spawnKey: string;
  name: string;
  title?: string;
  description: string;
  instructions: string;
  color?: string;
  extra?: Row;
  past?: string;
  ensure: (f: ReturnType<typeof fakes>) => Promise<Bot>;
};

const CASES: Case[] = [
  {
    kind: "finance",
    spawnKey: financeAgentSpawnKey(actor.userId),
    name: "Finance agent",
    description: "Answers questions about your bank, card, statement and crypto accounts.",
    instructions: FINANCE_AGENT_INSTRUCTIONS,
    color: pageAgentColor("finance"),
    past: PAST_DEFAULTS.finance?.[0],
    ensure: (f) => ensureFinanceAgent(f.deps, actor),
  },
  {
    kind: "data-room",
    spawnKey: dataRoomAgentSpawnKey(actor.userId),
    name: "Data room agent",
    description: "Finds and reads the documents in your Data room.",
    instructions: DATA_ROOM_AGENT_INSTRUCTIONS,
    color: pageAgentColor("data-room"),
    past: PAST_DEFAULTS["data-room"]?.[0],
    ensure: (f) => ensureDataRoomAgent(f.deps, actor),
  },
  {
    kind: "gtm",
    spawnKey: gtmAgentSpawnKey(actor.userId),
    name: "GTM agent",
    description: "Plans and works your go-to-market goal, with proof for every step.",
    instructions: GTM_AGENT_INSTRUCTIONS,
    color: pageAgentColor("gtm"),
    extra: { computerMode: "team" },
    past: PAST_DEFAULTS.gtm?.[0],
    ensure: (f) => ensureGtmBot(f.deps, actor),
  },
  {
    kind: "legal",
    spawnKey: legalAgentSpawnKey(actor.userId),
    name: "Legal agent",
    description: "Reads your contracts and tracks legal deadlines.",
    instructions: LEGAL_AGENT_INSTRUCTIONS,
    color: pageAgentColor("legal"),
    extra: {
      modelProvider: LEGAL_AGENT_MODEL.provider,
      modelId: LEGAL_AGENT_MODEL.id,
      thinkingLevel: LEGAL_AGENT_MODEL.thinkingLevel,
    },
    past: PAST_DEFAULTS.legal?.[0],
    ensure: (f) => ensureLegalAgent(f.deps, actor),
  },
  {
    kind: "investors",
    spawnKey: investorsAgentSpawnKey(actor.userId),
    name: "Investors agent",
    description: "Answers questions about your investors, SAFEs and finances.",
    instructions: INVESTORS_AGENT_INSTRUCTIONS,
    color: pageAgentColor("investors"),
    past: PAST_DEFAULTS.investors?.[0],
    ensure: (f) => ensureInvestorsAgent(f.deps, actor),
  },
  {
    kind: "carta",
    spawnKey: cartaAgentSpawnKey(actor.userId),
    name: "Carta agent",
    description: "Reads Carta to keep your cap table and contacts current.",
    instructions: CARTA_AGENT_INSTRUCTIONS,
    color: pageAgentColor("carta"),
    past: PAST_DEFAULTS.carta?.[0],
    ensure: (f) => ensureCartaAgent(f.deps, actor),
  },
  {
    kind: "company",
    spawnKey: companyAgentSpawnKey(actor.userId),
    name: "Company agent",
    description: "Reconstructs your company history with provenance.",
    instructions: COMPANY_AGENT_INSTRUCTIONS,
    color: pageAgentColor("company"),
    past: PAST_DEFAULTS.company?.[0],
    ensure: (f) => ensureCompanyAgent(f.deps, actor),
  },
  {
    kind: "company-importer",
    spawnKey: companyImporterSpawnKey(actor.userId),
    name: "Company importer",
    description: "Coordinates your read-only Company import.",
    instructions: COMPANY_IMPORTER_INSTRUCTIONS,
    color: pageAgentColor("company"),
    ensure: (f) => ensureCompanyImporter(f.deps, actor),
  },
  {
    kind: "inbox",
    spawnKey: inboxAgentSpawnKey(actor.userId),
    name: "Inbox agent",
    description: "Reads your mail, finds what needs a reply and writes replies.",
    instructions: INBOX_AGENT_INSTRUCTIONS,
    color: pageAgentColor("inbox"),
    past: PAST_DEFAULTS.inbox?.[0],
    ensure: (f) => ensureInboxAgent(f.repos as never, actor),
  },
  {
    kind: "scanner",
    spawnKey: scannerAgentSpawnKey(actor.userId),
    name: "Scanner agent",
    description: "Names and organizes scans in your Data room.",
    instructions: SCANNER_AGENT_INSTRUCTIONS,
    color: pageAgentColor("scanner"),
    ensure: (f) => ensureScannerAgent(f.deps, actor),
  },
  {
    kind: "voice",
    spawnKey: voiceAgentSpawnKey(actor.userId),
    name: "Elio",
    title: "Voice agent",
    description: "Answers questions about your workspace and coordinates your agents.",
    instructions: VOICE_AGENT_INSTRUCTIONS,
    ensure: (f) => ensureVoiceAgent(f.repos as never, actor),
  },
];

describe.each(CASES)("page agent: $kind", (c) => {
  it("creates one agent with its name, spawn key, instructions and colour, however often it is ensured", async () => {
    const f = fakes();
    const first = await c.ensure(f);
    const second = await c.ensure(f);
    expect(f.rows.size).toBe(1);
    expect(second.id).toBe(first.id);
    expect(f.created).toHaveLength(2);
    const expected: Row = {
      spawnKey: c.spawnKey,
      name: c.name,
      title: c.title ?? "",
      description: c.description,
      instructions: c.instructions,
      notifyOnFinish: true,
      ...(c.color ? { color: c.color } : {}),
      ...c.extra,
    };
    for (const input of f.created) expect(input).toEqual(expected);
    expect(first.instructions).toBe(c.instructions);
  });

  it("leaves current and owner-edited instructions alone", async () => {
    const f = fakes();
    await c.ensure(f);
    const row = [...f.rows.values()][0] as Row;
    row.instructions = `${c.instructions} Mine.`;
    expect((await c.ensure(f)).instructions).toBe(`${c.instructions} Mine.`);
    expect(row.instructions).toBe(`${c.instructions} Mine.`);
    if (c.past) {
      row.instructions = `${c.past} Mine.`;
      await c.ensure(f);
      expect(row.instructions).toBe(`${c.past} Mine.`);
    }
    expect(f.repos.replaceBotInstructions).not.toHaveBeenCalled();
  });

  if (c.past)
    it("moves an agent still on an earlier default to the current text", async () => {
      const f = fakes();
      await c.ensure(f);
      const row = [...f.rows.values()][0] as Row;
      row.instructions = c.past;
      const returned = await c.ensure(f);
      expect(returned.instructions).toBe(c.instructions);
      expect(row.instructions).toBe(c.instructions);
    });

  if (c.past)
    it("offers the upgrade notice for an agent on an earlier default, and none once current", async () => {
      const bot = { id: "b1", spaceId: "space-1", userId: "user-1", spawnKey: c.spawnKey };
      const notice = async (instructions: string) =>
        instructionsUpgrade(
          {
            bot: {
              findFirst: async () => ({
                ...bot,
                instructions,
                instructionsUpgradeDismissedHash: null,
              }),
            },
          } as never,
          { spaceId: "space-1", userId: "user-1" },
          "b1",
        );
      expect(await notice(c.past as string)).toEqual({
        current: c.past,
        next: c.instructions,
      });
      expect(await notice(c.instructions)).toBeNull();
    });
});

describe("description refresh", () => {
  it.each([
    ["investors", "Answers questions about your cap table, investors and finances."],
    ["carta", "Keeps your cap table and investor contacts."],
  ])("%s: an old stored description is replaced, a custom one is kept", async (kind, old) => {
    const c = CASES.find((x) => x.kind === kind) as Case;
    const f = fakes();
    await c.ensure(f);
    const row = [...f.rows.values()][0] as Row;
    row.description = old;
    expect((await c.ensure(f)).description).toBe(c.description);
    expect(row.description).toBe(c.description);
    row.description = "Mine";
    await c.ensure(f);
    expect(row.description).toBe("Mine");
  });
});

describe("Scanner and Company importer join the built-in table", () => {
  it("lists every page agent that has default text", () => {
    expect(BUILT_IN_AGENTS.map((agent) => agent.kind).sort()).toEqual(
      [
        "carta",
        "company",
        "company-importer",
        "data-room",
        "finance",
        "gtm",
        "inbox",
        "investors",
        "legal",
        "scanner",
      ].sort(),
    );
  });

  it.each(["scanner", "company-importer"])(
    "%s: an agent on an earlier default is upgraded, an edited one is not, and the notice is offered",
    async (kind) => {
      const c = CASES.find((x) => x.kind === kind) as Case;
      const earlier = `Earlier ${kind} default.`;
      const hashes = AGENT_DEFAULT_HASHES[kind] as { past: string[] };
      const hash = createHash("sha256").update(earlier).digest("hex");
      hashes.past.push(hash);
      try {
        const f = fakes();
        await c.ensure(f);
        const row = [...f.rows.values()][0] as Row;
        row.instructions = earlier;
        expect((await c.ensure(f)).instructions).toBe(c.instructions);
        expect(row.instructions).toBe(c.instructions);
        row.instructions = `${earlier} Mine.`;
        await c.ensure(f);
        expect(row.instructions).toBe(`${earlier} Mine.`);
        const bot = { id: "b1", spaceId: "space-1", userId: "user-1", spawnKey: c.spawnKey };
        const prisma = {
          bot: {
            findFirst: async () => ({
              ...bot,
              instructions: `${earlier} Mine.`,
              instructionsUpgradeDismissedHash: null,
            }),
          },
        } as never;
        expect(
          await instructionsUpgrade(prisma, { spaceId: "space-1", userId: "user-1" }, "b1"),
        ).toEqual({ current: `${earlier} Mine.`, next: c.instructions });
        // The startup job upgrades live agents only.
        const findMany = vi.fn(async () => []);
        await upgradeBuiltInAgentInstructions({ bot: { findMany, updateMany: vi.fn() } } as never);
        expect(findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              archivedAt: null,
              spawnKey: { startsWith: c.spawnKey.replace(actor.userId, "") },
            }),
          }),
        );
      } finally {
        hashes.past.splice(hashes.past.indexOf(hash), 1);
      }
    },
  );
});
