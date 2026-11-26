import type { EquityRoundScenario } from "@rakazo/contracts";
import {
  EquityRoundScenarioCreateInputSchema,
  EquityRoundScenarioListInputSchema,
  EquityRoundScenarioSchema,
  EquityRoundScenarioUpdateInputSchema,
} from "@rakazo/contracts";
import { Prisma } from "../client.js";
import type { EquityDb, EquityScope } from "./ledger.js";
import {
  contains,
  ensureLedger,
  fromBig,
  fromDecimalOrNull,
  inTransaction,
  iso,
  notFound,
  pageArgs,
  pageOf,
  scopeOf,
  toBig,
  toDecimalOrNull,
  withConflict,
} from "./ledger.js";

/** Saved round modeling scenarios. They are inputs only: nothing here reads or writes the ledger. */

type Row = Prisma.EquityRoundScenarioGetPayload<object>;

function toScenario(row: Row): EquityRoundScenario {
  return EquityRoundScenarioSchema.parse({
    id: row.id,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    name: row.name,
    preMoneyValuationCents: fromBig(row.preMoneyValuationCents),
    targetPoolPercent: fromDecimalOrNull(row.targetPoolPercent),
    investments: row.investments,
    convertibleIds: row.convertibleIds ?? null,
  });
}

export async function listEquityRoundScenarios(prisma: EquityDb, actor: EquityScope, raw: unknown) {
  const input = EquityRoundScenarioListInputSchema.parse(raw);
  const where = { ...scopeOf(actor), ...(input.search ? { name: contains(input.search) } : {}) };
  const sort = input.sort ?? { field: "updatedAt" as const, dir: "desc" as const };
  const [rows, total] = await Promise.all([
    prisma.equityRoundScenario.findMany({
      where,
      orderBy: [{ [sort.field]: sort.dir }, { id: "asc" }],
      ...pageArgs(input),
    }),
    prisma.equityRoundScenario.count({ where }),
  ]);
  return pageOf(rows.map(toScenario), total, input);
}

export async function getEquityRoundScenario(prisma: EquityDb, actor: EquityScope, id: string) {
  const row = await prisma.equityRoundScenario.findFirst({ where: { id, ...scopeOf(actor) } });
  if (!row) throw notFound("Scenario");
  return toScenario(row);
}

export async function createEquityRoundScenario(
  prisma: EquityDb,
  actor: EquityScope,
  raw: unknown,
) {
  const input = EquityRoundScenarioCreateInputSchema.parse(raw);
  const scope = scopeOf(actor);
  const row = await inTransaction(prisma, async (tx) => {
    await ensureLedger(tx, scope);
    return withConflict("A scenario with this name exists", () =>
      tx.equityRoundScenario.create({
        data: {
          ...scope,
          name: input.name,
          preMoneyValuationCents: toBig(input.preMoneyValuationCents),
          targetPoolPercent: toDecimalOrNull(input.targetPoolPercent),
          investments: input.investments,
          convertibleIds: input.convertibleIds ?? undefined,
        },
      }),
    );
  });
  return toScenario(row);
}

export async function updateEquityRoundScenario(
  prisma: EquityDb,
  actor: EquityScope,
  raw: unknown,
) {
  const input = EquityRoundScenarioUpdateInputSchema.parse(raw);
  const scope = scopeOf(actor);
  await getEquityRoundScenario(prisma, scope, input.id);
  const row = await withConflict("A scenario with this name exists", () =>
    prisma.equityRoundScenario.update({
      where: { id: input.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.preMoneyValuationCents !== undefined
          ? { preMoneyValuationCents: toBig(input.preMoneyValuationCents) }
          : {}),
        ...(input.targetPoolPercent !== undefined
          ? { targetPoolPercent: toDecimalOrNull(input.targetPoolPercent) }
          : {}),
        ...(input.investments !== undefined ? { investments: input.investments } : {}),
        ...(input.convertibleIds !== undefined
          ? { convertibleIds: input.convertibleIds ?? Prisma.DbNull }
          : {}),
      },
    }),
  );
  return toScenario(row);
}
