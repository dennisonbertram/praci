import type { SecretStore } from "@rakazo/adapter-kit";
import type { TeachLoginPrompt } from "@rakazo/contracts";
import { scrubValues } from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";

/**
 * A password typed while teaching is never put in the recording. It waits here, encrypted with
 * the same store as bot credentials (always the local encrypted store: `ephemeral`), until the
 * user saves it as a login or skips it. Rows are scoped to the skill's space and user, and are
 * deleted on save, skip, cancel, delete, or 30 minutes after the last keystroke.
 */
type Db = Pick<PrismaClient, "teachHeldValue">;

export const TEACH_HELD_VALUE_TTL_MS = 30 * 60 * 1000;
const MAX_HELD_LENGTH = 4096;

type Scope = { spaceId: string; userId: string };

export type HeldInput = { kind: "key"; key: string } | { kind: "clipboard"; text: string };

function context(id: string, scope: Scope) {
  return {
    operationId: id,
    traceId: id,
    spaceId: scope.spaceId,
    userId: scope.userId,
    signal: new AbortController().signal,
  };
}

/** Adds one keystroke or pasted text to the value held for `segment`. */
export async function appendHeldValue(
  db: Db,
  secrets: SecretStore,
  input: { skillId: string; segment: number; field?: string } & Scope & { input: HeldInput },
): Promise<void> {
  const where = { skillId_segment: { skillId: input.skillId, segment: input.segment } };
  const existing = await db.teachHeldValue.findUnique({ where });
  const previous = existing ? await secrets.load(existing.ciphertext, existing.id) : "";
  let next = previous;
  if (input.input.kind === "clipboard") next += input.input.text;
  else if (input.input.key.length === 1) next += input.input.key;
  else if (input.input.key === "Backspace") next = Array.from(previous).slice(0, -1).join("");
  else return;
  if (next === previous || next.length > MAX_HELD_LENGTH) return;
  const id = existing?.id ?? `held-${input.skillId}-${input.segment}`;
  const stored = await secrets.put(next, context(id, input), { recordId: id, ephemeral: true });
  const expiresAt = new Date(Date.now() + TEACH_HELD_VALUE_TTL_MS);
  await db.teachHeldValue.upsert({
    where,
    create: {
      id,
      skillId: input.skillId,
      spaceId: input.spaceId,
      userId: input.userId,
      segment: input.segment,
      field: input.field ?? "",
      ciphertext: stored.ciphertext,
      expiresAt,
    },
    update: { ciphertext: stored.ciphertext, expiresAt },
  });
}

/** Decrypts every live held value of a skill. */
export async function readHeldValues(db: Db, secrets: SecretStore, skillId: string) {
  const rows = await db.teachHeldValue.findMany({
    where: { skillId, expiresAt: { gt: new Date() } },
  });
  return Promise.all(
    rows.map(async (row) => ({
      segment: row.segment,
      stepIndex: row.stepIndex,
      field: row.field,
      value: await secrets.load(row.ciphertext, row.id),
    })),
  );
}

/** The steps still waiting for "Save as login" or "Skip". */
export async function listLoginPrompts(db: Db, skillId: string): Promise<TeachLoginPrompt[]> {
  const rows = await db.teachHeldValue.findMany({
    where: { skillId, stepIndex: { not: null }, expiresAt: { gt: new Date() } },
    orderBy: { stepIndex: "asc" },
  });
  return rows.map((row) => ({ stepIndex: row.stepIndex!, field: row.field }));
}

export async function deleteHeldValues(
  db: Db,
  where: { skillId: string; stepIndex?: number },
): Promise<void> {
  await db.teachHeldValue.deleteMany({ where });
}

export async function deleteExpiredHeldValues(db: Db, now = new Date()): Promise<number> {
  const result = await db.teachHeldValue.deleteMany({ where: { expiresAt: { lte: now } } });
  return result.count;
}

export const TEACH_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

/** Deletes drafts nobody saved within a day; their held values go with them (cascade). */
export async function deleteStaleDraftSkills(
  db: Pick<PrismaClient, "taughtSkill">,
  now = new Date(),
): Promise<number> {
  const result = await db.taughtSkill.deleteMany({
    where: { status: "draft", updatedAt: { lte: new Date(now.getTime() - TEACH_DRAFT_TTL_MS) } },
  });
  return result.count;
}

/** The reconciler's clean-up: expired held values, then drafts left unsaved. */
export async function deleteExpiredTeachData(
  db: Db & Pick<PrismaClient, "taughtSkill">,
  now = new Date(),
): Promise<number> {
  return (await deleteExpiredHeldValues(db, now)) + (await deleteStaleDraftSkills(db, now));
}

/** Scrubs held values out of text that may echo them (window titles, summaries, paths). */
export function scrubHeld(text: string, held: readonly { value: string }[]): string {
  return scrubValues(
    text,
    held.map((entry) => entry.value),
  );
}
