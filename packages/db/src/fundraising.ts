import type {
  Contact,
  FundraiseRound,
  FundraiseRoundSaveInput,
  FundraisingOverview,
  ProspectSaveInput,
} from "@rakazo/contracts";
import { isActiveSafe } from "@rakazo/core";
import type { Prisma, PrismaClient } from "./client.js";
import { roundIdForStage, toContact } from "./contacts.js";
import { isUniqueViolation } from "./prisma-errors.js";
import { toSafe } from "./safes.js";
import { IsolationError } from "./scope.js";

type Scope = { spaceId: string; userId: string };
type Db = Pick<PrismaClient, "contact" | "fundraiseRound" | "safe">;
/** Only space and user: callers may pass a whole actor, which must not reach a Prisma query. */
const ownerOf = ({ spaceId, userId }: Scope): Scope => ({ spaceId, userId });

export class FundraiseRoundOpenError extends Error {
  constructor() {
    super("Another round is already open.");
    this.name = "FundraiseRoundOpenError";
  }
}

const toRound = (row: Prisma.FundraiseRoundGetPayload<object>): FundraiseRound => ({
  id: row.id,
  name: row.name,
  targetCents: Number(row.targetCents),
  capCents: Number(row.capCents),
  closedAt: row.closedAt?.toISOString() ?? null,
});

/** The open round, else the latest closed one, and the prospect pipeline. */
export async function getFundraisingOverview(
  prisma: Db,
  actor: Scope,
): Promise<FundraisingOverview> {
  const scope = ownerOf(actor);
  const row =
    (await prisma.fundraiseRound.findFirst({ where: { ...scope, closedAt: null } })) ??
    (await prisma.fundraiseRound.findFirst({
      where: scope,
      orderBy: [{ closedAt: "desc" }, { id: "desc" }],
    }));
  const [contacts, safeRows] = await Promise.all([
    prisma.contact.findMany({
      where: { ...scope, kind: "prospect" },
      include: { bot: { select: { id: true, name: true } } },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    prisma.safe.findMany({ where: scope, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }),
  ]);
  const safes = safeRows.map((safe) => toSafe(safe));
  // A prospect with an active SAFE has left the pipeline; it returns once every SAFE is canceled or deleted.
  const withSafe = new Set(
    safes.filter((s) => s.contactId && isActiveSafe(s.status)).map((s) => s.contactId),
  );
  const prospects = contacts.filter((p) => !withSafe.has(p.id));
  // A prospect made without a stage (for example by an agent) starts at Target.
  const withStage = prospects.map((p) => ({ ...p, stage: p.stage ?? "target" }));
  const open = row && !row.closedAt ? row : null;
  const inRound = safes.filter((s) => row && s.roundId === row.id);
  const sumOf = (...statuses: string[]) =>
    inRound.filter((s) => statuses.includes(s.status)).reduce((sum, s) => sum + s.amountCents, 0);
  // A Committed prospect counts only in the round that was open when its stage was saved;
  // a Sent or Draft SAFE of the open round counts at its amount instead of the check size.
  const pendingCents = open
    ? prospects
        .filter((p) => p.stage === "committed" && p.roundId === open.id)
        .reduce((sum, p) => sum + Number(p.checkSizeCents ?? 0), 0) + sumOf("sent", "draft")
    : 0;
  return {
    round: row ? toRound(row) : null,
    pendingCents,
    signedCents: sumOf("signed"),
    fundedCents: sumOf("funded"),
    prospects: withStage.map(toContact),
    safes,
  };
}

/** Starts a round, or edits the open round when `id` is given. */
export async function saveRound(
  prisma: Db,
  actor: Scope,
  input: FundraiseRoundSaveInput,
): Promise<FundraiseRound> {
  const scope = ownerOf(actor);
  const { id, ...fields } = input;
  if (id) {
    const { count } = await prisma.fundraiseRound.updateMany({
      where: { id, ...scope, closedAt: null },
      data: fields,
    });
    if (count === 0) throw new IsolationError("Round not found");
    return toRound(await prisma.fundraiseRound.findUniqueOrThrow({ where: { id } }));
  }
  try {
    return toRound(await prisma.fundraiseRound.create({ data: { ...scope, ...fields } }));
  } catch (error) {
    // The partial unique index allows one open round per space and user.
    throw isUniqueViolation(error) ? new FundraiseRoundOpenError() : error;
  }
}

async function setClosedAt(
  prisma: Db,
  actor: Scope,
  id: string,
  from: { closedAt: null } | { closedAt: { not: null } },
  closedAt: Date | null,
): Promise<FundraiseRound> {
  const { count } = await prisma.fundraiseRound.updateMany({
    where: { id, ...ownerOf(actor), ...from },
    data: { closedAt },
  });
  if (count === 0) throw new IsolationError("Round not found");
  return toRound(await prisma.fundraiseRound.findUniqueOrThrow({ where: { id } }));
}

export const closeRound = (prisma: Db, actor: Scope, id: string) =>
  setClosedAt(prisma, actor, id, { closedAt: null }, new Date());

/** Throws FundraiseRoundOpenError while another round is open. */
export const reopenRound = (prisma: Db, actor: Scope, id: string) =>
  setClosedAt(prisma, actor, id, { closedAt: { not: null } }, null).catch((error: unknown) => {
    throw isUniqueViolation(error) ? new FundraiseRoundOpenError() : error;
  });

/** Changes the pipeline fields of one of the user's prospects. Throws IsolationError for any other contact. */
export async function saveProspect(
  prisma: Db,
  actor: Scope,
  { id, ...fields }: ProspectSaveInput,
): Promise<Contact> {
  const scope = ownerOf(actor);
  const roundId = await roundIdForStage(prisma, scope, fields.stage);
  const { count } = await prisma.contact.updateMany({
    where: { id, ...scope, kind: "prospect" },
    data: { ...fields, roundId },
  });
  if (count === 0) throw new IsolationError("Contact not found");
  const row = await prisma.contact.findUniqueOrThrow({
    where: { id },
    include: { bot: { select: { id: true, name: true } } },
  });
  return toContact(row);
}
