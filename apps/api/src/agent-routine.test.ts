import type { Actor } from "@rakazo/contracts";
import { gtmAgentSpawnKey, investorsAgentSpawnKey, legalAgentSpawnKey } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import { ensureGtmRoutine, GTM_WORK_PROMPT } from "./gtm-agent.js";
import { ensureInvestorsRoutine, INVESTOR_UPDATE_PROMPT } from "./investors-agent.js";
import { ensureLegalRoutine, LEGAL_SCAN_PROMPT } from "./legal-agent.js";

const actor: Actor = {
  userId: "user-1",
  spaceId: "space-1",
  email: "user-1@rakazo.test",
  isDeploymentOwner: false,
};

type Row = Record<string, unknown> & { id: string; botId: string; name: string; prompt: string };

/**
 * One bot row and one routines table. Transactions run one at a time, which is what the per-bot
 * advisory lock guarantees, so racing calls see each other's rows.
 */
function fakes(spawnKey: string, archived = false) {
  const rows: Row[] = [];
  const locks: string[] = [];
  const bot = { id: "bot-1", spawnKey, archivedAt: archived ? new Date() : null };
  const tx = {
    $executeRaw: vi.fn(async (_s: TemplateStringsArray, ...v: unknown[]) => {
      locks.push(String(v[0]));
      return 1;
    }),
    bot: {
      findFirst: vi.fn(async () => (bot.archivedAt ? null : bot)),
      updateMany: vi.fn(async () => ({ count: bot.archivedAt ? 0 : 1 })),
    },
    routine: {
      findFirst: vi.fn(
        async ({ where }: { where: { botId: string; name: string } }) =>
          rows.find((r) => r.botId === where.botId && r.name === where.name) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: Omit<Row, "id"> }) => {
        const row = { id: `routine-${rows.length + 1}`, ...data } as Row;
        rows.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Row> }) =>
        Object.assign(rows.find((r) => r.id === where.id) as Row, data),
      ),
    },
  };
  let queue: Promise<unknown> = Promise.resolve();
  const prisma = {
    $transaction: <T>(run: (t: typeof tx) => Promise<T>) => {
      const result = queue.then(() => run(tx));
      queue = result.catch(() => undefined);
      return result;
    },
    user: { findUnique: vi.fn(async () => ({ timezone: "America/New_York" })) },
  };
  const jobs = { enqueue: vi.fn(async () => undefined), cancel: vi.fn(async () => undefined) };
  return { rows, locks, prisma, jobs, bot, tx };
}

const sites = [
  {
    name: "GTM",
    spawnKey: gtmAgentSpawnKey(actor.userId),
    lockKey: "gtm-bot:bot-1",
    prompt: GTM_WORK_PROMPT,
    notify: false,
    ensure: (f: ReturnType<typeof fakes>) => ensureGtmRoutine(f as never, actor, "bot-1"),
  },
  {
    name: "Legal",
    spawnKey: legalAgentSpawnKey(actor.userId),
    lockKey: "legal-bot:bot-1",
    prompt: LEGAL_SCAN_PROMPT,
    notify: false,
    ensure: (f: ReturnType<typeof fakes>) => ensureLegalRoutine(f as never, actor, "bot-1"),
  },
  {
    name: "Investors",
    spawnKey: investorsAgentSpawnKey(actor.userId),
    lockKey: "investors-bot:bot-1",
    prompt: INVESTOR_UPDATE_PROMPT,
    notify: true,
    ensure: (f: ReturnType<typeof fakes>) => ensureInvestorsRoutine(f as never, actor, "bot-1"),
  },
];

describe.each(sites)("ensure $name routine", (site) => {
  it("creates one active routine under the per-bot lock, however many calls race", async () => {
    const f = fakes(site.spawnKey);
    const results = await Promise.all([site.ensure(f), site.ensure(f), site.ensure(f)]);
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    expect(f.rows).toHaveLength(1);
    expect(f.rows[0]).toMatchObject({ botId: "bot-1", prompt: site.prompt, active: true });
    expect(f.rows[0]?.notify).toBe(site.notify);
    expect(f.locks).toEqual([site.lockKey, site.lockKey, site.lockKey]);
    expect(f.jobs.enqueue).toHaveBeenCalledTimes(1);
  });

  it("returns the existing routine and queues nothing on a later call", async () => {
    const f = fakes(site.spawnKey);
    const first = await site.ensure(f);
    f.jobs.enqueue.mockClear();
    expect((await site.ensure(f)).id).toBe(first.id);
    expect(f.rows).toHaveLength(1);
    expect(f.jobs.enqueue).not.toHaveBeenCalled();
  });

  it("keeps an edited prompt", async () => {
    const f = fakes(site.spawnKey);
    const first = await site.ensure(f);
    (f.rows[0] as Row).prompt = "my own prompt";
    expect((await site.ensure(f)).prompt).toBe("my own prompt");
    expect(first.id).toBe(f.rows[0]?.id);
  });
});

describe("ensure routine for an archived bot", () => {
  const gtm = sites[0] as (typeof sites)[number];
  const others = sites.slice(1);

  it("GTM refuses and creates nothing", async () => {
    const f = fakes(gtm.spawnKey, true);
    await expect(gtm.ensure(f)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(f.rows).toHaveLength(0);
  });

  // B18: these two used to create a routine for a bot archived a moment earlier.
  it.each(others)("$name refuses and creates nothing (B18)", async (site) => {
    const f = fakes(site.spawnKey, true);
    await expect(site.ensure(f)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(f.rows).toHaveLength(0);
    expect(f.jobs.enqueue).not.toHaveBeenCalled();
  });
});

describe("Legal prompt upgrade", () => {
  it("moves a routine on an older default to the current prompt", async () => {
    const f = fakes(legalAgentSpawnKey(actor.userId));
    await ensureLegalRoutine(f as never, actor, "bot-1");
    (f.rows[0] as Row).prompt = LEGAL_SCAN_PROMPT.replace(
      / Keep the reply to the headline.*$/,
      " Keep the reply short.",
    );
    expect((await ensureLegalRoutine(f as never, actor, "bot-1")).prompt).toBe(LEGAL_SCAN_PROMPT);
    expect(f.rows).toHaveLength(1);
  });
});
