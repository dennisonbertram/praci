import { createHash } from "node:crypto";
import type { RealtimeFanout } from "@rakazo/adapter-kit";
import type {
  PipelineImportCard,
  PipelineImportResult,
  PipelineImportRow,
} from "@rakazo/contracts";
import {
  MessageBlock as MessageBlockSchema,
  PIPELINE_IMPORT_MAX,
  PIPELINE_IMPORT_NEW,
  PIPELINE_IMPORT_REVIEW_TOOL,
  PIPELINE_IMPORT_SKIP,
} from "@rakazo/contracts";
import { getLogger } from "@rakazo/logging";
import type { Prisma, PrismaClient } from "./client.js";
import { appendEventInTransaction, notifyRealtime } from "./events.js";
import {
  FUNDRAISING_PIPELINE,
  joinRecord,
  normalized,
  savePipelineRecord,
} from "./pipeline-records.js";

type Scope = { spaceId: string; userId: string };
type Tx = Prisma.TransactionClient;
const pipeline = FUNDRAISING_PIPELINE;
const LONG = { timeout: 60_000 };
const OPEN = ["staging", "reviewing"];

/**
 * A retry of one row, a second worker, a staging call, a review and a press take turns, per user, so
 * none of them acts on an import another has just moved. Taken before the thread row, always.
 */
const takeTurn = (tx: Tx, { spaceId, userId }: Scope) =>
  tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`pipeline-import:${spaceId}:${userId}`}, 0))`;

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const REPLACED_NOTE =
  "A newer review of this import replaced this card, so nothing changed. Do not call it again in this run.";

/** Moves an import only from the state read under this turn. Anything else rolls the call back. */
async function moveImport(
  tx: Tx,
  from: { id: string; status: string; effectId: string | null },
  data: { status: string; effectId?: string | null },
) {
  const moved = await tx.pipelineImport.updateMany({
    where: { id: from.id, status: from.status, effectId: from.effectId },
    data,
  });
  if (moved.count !== 1) throw new Error("The import changed while it was being moved.");
}

/** Closes the import's open card, if it has one, as replaced. A later review posts the new card. */
async function closeOpenCard(tx: Tx, scope: Scope, effectId: string | null) {
  if (!effectId) return undefined;
  const effect = await tx.externalEffect.findFirst({
    where: { id: effectId, spaceId: scope.spaceId, status: "intended" },
    select: { runId: true, run: { select: { threadId: true, botId: true } } },
  });
  if (!effect) return undefined;
  const { threadId, botId } = effect.run;
  await tx.$queryRaw`SELECT id FROM threads WHERE id = ${threadId} FOR UPDATE`;
  const denied = await tx.externalEffect.updateMany({
    where: { id: effectId, status: "intended" },
    data: { status: "denied", result: { note: REPLACED_NOTE } },
  });
  if (denied.count !== 1) return undefined;
  const resumed = await tx.run.updateMany({
    where: { id: effect.runId, status: "waiting_input" },
    data: { status: "queued" },
  });
  const event = await rewriteCard(
    tx,
    { ...effect.run, spaceId: scope.spaceId, runId: effect.runId, effectId, botId },
    (block) => ({
      ...block,
      status: "answered" as const,
      answer: "superseded",
    }),
  );
  return { resumeRunId: resumed.count === 1 ? effect.runId : undefined, threadId, seq: event?.seq };
}

type AskBlock = Extract<MessageBlockSchema, { kind: "ask" }>;

async function rewriteCard(
  tx: Tx,
  input: { spaceId: string; threadId: string; botId: string; runId: string; effectId: string },
  change: (block: AskBlock) => AskBlock,
) {
  const messages = await tx.message.findMany({
    where: { threadId: input.threadId, runId: input.runId, role: "bot" },
    orderBy: { seq: "desc" },
    take: 50,
    select: { id: true, blocks: true },
  });
  for (const message of messages) {
    const parsed = MessageBlockSchema.array().safeParse(message.blocks);
    if (!parsed.success) continue;
    if (
      !parsed.data.some(
        (block) => block.kind === "ask" && block.approvalEffectId === input.effectId,
      )
    )
      continue;
    const blocks = parsed.data.map((block) =>
      block.kind === "ask" && block.approvalEffectId === input.effectId ? change(block) : block,
    );
    await tx.message.update({ where: { id: message.id }, data: { blocks } });
    return appendEventInTransaction(tx, {
      spaceId: input.spaceId,
      threadId: input.threadId,
      botId: input.botId,
      type: "thread.message.updated",
      runId: input.runId,
      allowCancelledRun: true,
      payload: { messageId: message.id, role: "bot", blocks },
    });
  }
  return null;
}

type Person = NonNullable<PipelineImportRow["referrer"]>;
const samePerson = (a: Person, b: Person) =>
  a.email && b.email ? a.email === b.email : normalized(a.name) === normalized(b.name);

/** Two rows of one firm become one. The first value of a field stays; repeating a call changes nothing. */
function mergeRows(a: PipelineImportRow, b: PipelineImportRow): PipelineImportRow {
  const people = [...(a.people ?? [])];
  for (const person of b.people ?? []) {
    if (!people.some((known) => samePerson(known, person))) people.push(person);
  }
  const details = [...(a.details ?? [])];
  for (const detail of b.details ?? []) {
    if (!details.some((known) => known.label.toLowerCase() === detail.label.toLowerCase())) {
      details.push(detail);
    }
  }
  // Keeps the first row's keys in place, so a repeat compares equal to what is stored.
  return {
    ...a,
    ...Object.fromEntries(Object.entries(b).filter(([key]) => !(key in a))),
    ...(people.length > 0 ? { people } : {}),
    ...(details.length > 0 ? { details } : {}),
  } as PipelineImportRow;
}

/** A "Wave 2" next step is a list's priority tier, not a next step. */
function withWave(row: PipelineImportRow): PipelineImportRow {
  if (!row.nextStep || !/^wave\s+\S+$/i.test(row.nextStep)) return row;
  const { nextStep, ...rest } = row;
  return { ...rest, group: row.group ?? nextStep };
}

export type StagedRows = {
  importId: string;
  /** Rows the import holds now. */
  staged: number;
  /** Rows this call added; a row of a firm already staged merges into it. */
  added: number;
  rejected: { firm: string; reason: string }[];
  resumeRunId?: string;
};

/**
 * Adds rows to the user's one open import, starting one when there is none. Changes nothing else.
 * `start` discards an open import another run left. A change after a review closes its card, because
 * the card no longer covers what is staged. Repeating a call changes nothing, so it keeps the card.
 */
export async function stagePipelineImportRows(
  prisma: PrismaClient,
  scope: Scope,
  input: { runId: string; botId: string; start: boolean; rows: PipelineImportRow[] },
  realtime?: RealtimeFanout,
): Promise<StagedRows> {
  const done = await prisma.$transaction(async (tx: Tx) => {
    await takeTurn(tx, scope);
    let open = await tx.pipelineImport.findFirst({
      where: { ...scope, pipeline, status: { in: OPEN } },
    });
    let closed: Awaited<ReturnType<typeof closeOpenCard>>;
    if (open && input.start && open.runId !== input.runId) {
      closed = await closeOpenCard(tx, scope, open.effectId);
      await moveImport(tx, open, { status: "discarded" });
      open = null;
    }
    open ??= await tx.pipelineImport.create({
      data: { ...scope, pipeline, runId: input.runId, botId: input.botId },
    });
    const stored = await tx.pipelineImportRow.findMany({
      where: { ...scope, importId: open.id },
      select: { id: true, position: true, normalizedFirm: true, data: true },
    });
    const byFirm = new Map(stored.map((row) => [row.normalizedFirm, row]));
    let next = stored.reduce((max, row) => Math.max(max, row.position + 1), 0);
    let added = 0;
    let changed = false;
    const rejected: StagedRows["rejected"] = [];
    for (const raw of input.rows) {
      const row = withWave(raw);
      const normalizedFirm = normalized(row.firm);
      if (!normalizedFirm) {
        rejected.push({ firm: row.firm, reason: "A firm name needs letters or digits." });
        continue;
      }
      const known = byFirm.get(normalizedFirm);
      if (known) {
        const merged = mergeRows(known.data as PipelineImportRow, row);
        if (JSON.stringify(merged) === JSON.stringify(known.data)) continue;
        await tx.pipelineImportRow.update({
          where: { id: known.id },
          data: { data: merged as Prisma.InputJsonValue },
        });
        known.data = merged as Prisma.JsonValue;
        changed = true;
        continue;
      }
      if (byFirm.size >= PIPELINE_IMPORT_MAX) {
        rejected.push({
          firm: row.firm,
          reason: `An import holds at most ${PIPELINE_IMPORT_MAX} rows.`,
        });
        continue;
      }
      const order = row.order ?? next;
      const created = await tx.pipelineImportRow.create({
        data: {
          ...scope,
          importId: open.id,
          position: next,
          normalizedFirm,
          data: { ...row, order } as Prisma.InputJsonValue,
        },
      });
      byFirm.set(normalizedFirm, { ...created });
      next += 1;
      added += 1;
      changed = true;
    }
    if (changed && open.status === "reviewing") {
      closed ??= await closeOpenCard(tx, scope, open.effectId);
      await moveImport(tx, open, { status: "staging", effectId: null });
    }
    return { importId: open.id, staged: byFirm.size, added, rejected, closed };
  }, LONG);
  const { closed, ...result } = done;
  if (closed?.seq !== undefined) await notifyRealtime(realtime, closed.threadId, closed.seq);
  return { ...result, ...(closed?.resumeRunId ? { resumeRunId: closed.resumeRunId } : {}) };
}

type NewPerson = { key: string; name: string; email: string | null; organization: string | null };
/** An email the row gives for a saved contact that has none: filled on apply, never replaced. */
type ContactFill = { contactId: string; email: string };
/** A person's decision before the owner's answers. */
type Decision =
  | { kind: "here"; fill?: ContactFill }
  | { kind: "contact"; contactId: string; email: string | null }
  | ({ kind: "new" } & NewPerson)
  | { kind: "ask"; questionId: string; fallback: NewPerson };
type Question = PipelineImportCard["questions"][number];
type Candidate = Question["candidates"][number];
type SavedContact = {
  id: string;
  name: string;
  email: string | null;
  organization: string | null;
};
type RecordState = {
  id: string;
  name: string;
  normalizedName: string;
  group: string | null;
  listOrder: number | null;
  nextStep: string | null;
  nextCallAt: Date | null;
  details: Prisma.JsonValue;
  referredByContactId: string | null;
};
type StagedRow = { id: string; position: number; normalizedFirm: string; data: Prisma.JsonValue };

const personKey = (name: string, email: string | null | undefined, firm: string) =>
  email ? `e:${email}` : `n:${normalized(name)}|${firm}`;

const hasLabel = (details: { label: string }[], label: string) =>
  details.some((detail) => detail.label.toLowerCase() === label.toLowerCase());

/** The list's fund details, as a record stores them. */
function listDetails(data: PipelineImportRow, at: string) {
  return [
    ...(data.details ?? []),
    ...(data.introPath ? [{ label: "Intro path", value: data.introPath }] : []),
  ].map((detail) => ({ ...detail, source: "list", at }));
}

/** A date alone is midnight UTC of that date (`nextCallHasTime` false), as the contract sets out. */
const nextCallOf = (data: PipelineImportRow) =>
  data.nextCallAt ? new Date(`${data.nextCallAt}T00:00:00.000Z`) : null;

/** What a row would fill on a record it finds. A set field is never replaced. */
function fillsOf(data: PipelineImportRow, record: RecordState, at: string) {
  const details = Array.isArray(record.details) ? (record.details as { label: string }[]) : [];
  const fresh = listDetails(data, at).filter((detail) => !hasLabel(details, detail.label));
  return {
    ...(data.group && !record.group ? { group: data.group } : {}),
    ...(data.order !== undefined && record.listOrder === null ? { listOrder: data.order } : {}),
    ...(data.nextStep && !record.nextStep ? { nextStep: data.nextStep } : {}),
    ...(data.nextCallAt && !record.nextCallAt
      ? { nextCallAt: nextCallOf(data), nextCallHasTime: false }
      : {}),
    ...(fresh.length > 0 ? { details: [...details, ...fresh] as Prisma.InputJsonValue } : {}),
  };
}

const tokens = (name: string) =>
  name
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
/** "J. Sample" and "Riley" could mean "Jordan Sample" and "Riley Placeholder": a question, never a match. */
const couldMean = (partial: string, full: string) => {
  const wanted = tokens(partial);
  const have = tokens(full);
  return (
    wanted.length > 0 &&
    wanted.every((token) =>
      have.some(
        (other) =>
          token === other ||
          (token.length === 1 && other.startsWith(token)) ||
          (other.length === 1 && token.startsWith(other)),
      ),
    )
  );
};

/**
 * The review of a list against what is saved, per the plan's match rules. Stops at the first rule
 * that decides; a real doubt becomes a question. Reads only: a press compares this to what it saw.
 */
function buildReview(
  rows: StagedRow[],
  contacts: SavedContact[],
  links: { contactId: string; recordId: string; recordName: string }[],
  records: RecordState[],
) {
  const at = new Date(0).toISOString();
  const recordOf = new Map(records.map((record) => [record.normalizedName, record]));
  const linkOf = new Map(links.map((link) => [link.contactId, link]));
  const byEmail = new Map(
    contacts.flatMap((c) => (c.email ? [[c.email.toLowerCase(), c] as const] : [])),
  );
  const byName = new Map<string, SavedContact[]>();
  for (const contact of contacts) {
    const key = normalized(contact.name);
    byName.set(key, [...(byName.get(key) ?? []), contact]);
  }
  const questions = new Map<string, Question>();
  const seenEmail = new Map<string, { key: string; name: string; firm: string }>();
  const seenName = new Map<
    string,
    { key: string; name: string; email: string | null; firm: string }[]
  >();
  const newContacts = new Map<string, string>();
  const savedContacts = new Map<string, string>();
  const candidateOf = (contact: SavedContact, stays: string | null): Candidate => ({
    id: contact.id,
    name: contact.name,
    email: contact.email,
    organization: contact.organization,
    stays,
  });
  const listCandidate = (
    first: { key: string; name: string; firm: string },
    email: string | null,
  ): Candidate => ({
    id: `list:${first.key}`,
    name: first.name,
    email,
    organization: first.firm,
    stays: first.firm,
  });
  const noteSaved = (contact: SavedContact) =>
    savedContacts.set(
      contact.id,
      `${contact.name} · ${contact.email ?? contact.organization ?? ""}`.replace(/ · $/, ""),
    );

  const decidePerson = (
    row: StagedRow,
    data: PipelineImportRow,
    person: Person,
    index: number,
  ): Decision => {
    const record = recordOf.get(row.normalizedFirm);
    const firm = data.firm;
    const email = person.email ?? null;
    const fallback = {
      key: personKey(person.name, email, row.normalizedFirm),
      name: person.name,
      email,
      organization: firm,
    };
    const staysOn = (contact: SavedContact) => {
      const link = linkOf.get(contact.id);
      return link && link.recordId !== record?.id ? link.recordName : null;
    };
    const here = (contact: SavedContact) =>
      record !== undefined && linkOf.get(contact.id)?.recordId === record.id;
    const ask = (candidates: Candidate[], allowNew: boolean): Decision => {
      const questionId = `p:${row.position}:${index}`;
      questions.set(questionId, {
        id: questionId,
        row: row.position,
        kind: "person",
        name: person.name,
        firm,
        referred: 0,
        newRecord: !record,
        candidates,
        allowNew,
      });
      return { kind: "ask", questionId, fallback };
    };
    const fillOf = (contact: SavedContact) =>
      email && !contact.email ? { fill: { contactId: contact.id, email } } : {};
    const decideSaved = (contact: SavedContact): Decision => {
      if (here(contact)) return { kind: "here", ...fillOf(contact) };
      const stays = staysOn(contact);
      if (stays)
        return ask([candidateOf(contact, stays)], !email || contact.email?.toLowerCase() !== email);
      noteSaved(contact);
      return { kind: "contact", contactId: contact.id, email };
    };
    // Rule 1: same email, any kind.
    const byAddress = email ? byEmail.get(email) : undefined;
    if (byAddress) return decideSaved(byAddress);
    const sameAddressOnList = email ? seenEmail.get(email) : undefined;
    if (sameAddressOnList) return ask([listCandidate(sameAddressOnList, email)], false);
    const named = byName.get(normalized(person.name)) ?? [];
    const linked = named.find(here);
    if (linked) return { kind: "here", ...fillOf(linked) };
    // Rule 2: same name and organization, exactly one. Rule 3: anything else with that name asks.
    const atFirm = named.filter(
      (contact) => normalized(contact.organization) === row.normalizedFirm,
    );
    const [onlyAtFirm] = atFirm;
    if (atFirm.length === 1 && onlyAtFirm) return decideSaved(onlyAtFirm);
    const onList = seenName.get(normalized(person.name)) ?? [];
    if (named.length > 0 || onList.length > 0) {
      return ask(
        [
          ...(atFirm.length > 0 ? atFirm : named).map((contact) =>
            candidateOf(contact, staysOn(contact)),
          ),
          ...onList.map((first) => listCandidate(first, first.email)),
        ],
        true,
      );
    }
    // Nothing matches: a new contact, also beside other saved people of the firm.
    return { kind: "new", ...fallback };
  };

  const noteNew = (person: NewPerson) => {
    newContacts.set(
      person.key,
      person.organization ? `${person.name} · ${person.organization}` : person.name,
    );
  };

  const people = rows.map((row) => {
    const data = row.data as PipelineImportRow;
    return (data.people ?? []).map((person, index) => {
      const decision = decidePerson(row, data, person, index);
      if (decision.kind === "new") {
        noteNew(decision);
        if (decision.email) {
          seenEmail.set(decision.email, {
            key: decision.key,
            name: decision.name,
            firm: data.firm,
          });
        }
        const key = normalized(decision.name);
        seenName.set(key, [
          ...(seenName.get(key) ?? []),
          { key: decision.key, name: decision.name, email: decision.email, firm: data.firm },
        ]);
      }
      return decision;
    });
  });

  // Each distinct referrer, once, for the rows that have no referrer yet.
  const referrerGroups = new Map<string, { person: Person; rows: number }>();
  // An address is compared whole: a.b@ and ab@ are two people. Only a name is normalized.
  const referrerKeyOf = (person: Person) =>
    person.email ? `e:${person.email}` : `n:${normalized(person.name)}`;
  for (const row of rows) {
    const data = row.data as PipelineImportRow;
    const record = recordOf.get(row.normalizedFirm);
    if (!data.referrer || record?.referredByContactId) continue;
    const key = referrerKeyOf(data.referrer);
    const group = referrerGroups.get(key);
    referrerGroups.set(key, {
      person: group?.person ?? data.referrer,
      rows: (group?.rows ?? 0) + 1,
    });
  }
  const referrers = new Map<string, Decision>();
  for (const [key, { person, rows: referred }] of referrerGroups) {
    const email = person.email ?? null;
    const fallback = {
      key: personKey(person.name, email, ""),
      name: person.name,
      email,
      organization: null,
    };
    const ask = (candidates: Candidate[], allowNew: boolean): Decision => {
      const questionId = `r:${key}`;
      questions.set(questionId, {
        id: questionId,
        row: null,
        kind: "referrer",
        name: person.name,
        firm: null,
        referred,
        newRecord: false,
        candidates,
        allowNew,
      });
      return { kind: "ask", questionId, fallback };
    };
    const byAddress = email ? byEmail.get(email) : undefined;
    if (byAddress) {
      noteSaved(byAddress);
      referrers.set(key, { kind: "contact", contactId: byAddress.id, email });
      continue;
    }
    const sameAddressOnList = email ? seenEmail.get(email) : undefined;
    if (sameAddressOnList) {
      referrers.set(key, ask([listCandidate(sameAddressOnList, email)], false));
      continue;
    }
    const named = byName.get(normalized(person.name)) ?? [];
    const onList = seenName.get(normalized(person.name)) ?? [];
    const [only] = named;
    if (named.length === 1 && only && !only.organization && onList.length === 0) {
      noteSaved(only);
      referrers.set(key, { kind: "contact", contactId: only.id, email });
      continue;
    }
    const loose = named.length > 0 ? [] : contacts.filter((c) => couldMean(person.name, c.name));
    const candidates = [
      ...[...named, ...loose].map((contact) => candidateOf(contact, null)),
      ...onList.map((first) => ({ ...listCandidate(first, first.email), stays: null })),
    ];
    if (candidates.length > 0) {
      referrers.set(key, ask(candidates, true));
      continue;
    }
    noteNew(fallback);
    referrers.set(key, { kind: "new", ...fallback });
  }

  let add = 0;
  let update = 0;
  const noPerson: string[] = [];
  const existing: string[] = [];
  const changes = rows.map((row, index) => {
    const data = row.data as PipelineImportRow;
    const record = recordOf.get(row.normalizedFirm);
    if (!record) {
      add += 1;
      if (!data.people?.length) noPerson.push(data.firm);
      return true;
    }
    existing.push(data.firm);
    const changed =
      Object.keys(fillsOf(data, record, at)).length > 0 ||
      (people[index] ?? []).some(
        (decision) => decision.kind !== "here" || decision.fill !== undefined,
      ) ||
      (Boolean(data.referrer) && !record.referredByContactId);
    if (changed) update += 1;
    return changed;
  });

  const card = {
    add,
    update,
    questions: [...questions.values()],
    newContacts: [...newContacts.values()],
    savedContacts: [...savedContacts.values()],
    noPerson,
    existing,
  };
  const hash = createHash("sha256").update(JSON.stringify(card)).digest("hex");
  return { card, hash, people, referrers, referrerKeyOf, changes, seenRows: rows };
}

type Review = ReturnType<typeof buildReview>;

async function loadReview(db: Tx | PrismaClient, scope: Scope, importId: string): Promise<Review> {
  const [rows, contacts, links, records] = await Promise.all([
    db.pipelineImportRow.findMany({
      where: { ...scope, importId },
      orderBy: { position: "asc" },
      select: { id: true, position: true, normalizedFirm: true, data: true },
    }),
    db.contact.findMany({
      where: scope,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, name: true, email: true, organization: true },
    }),
    db.pipelineRecordPerson.findMany({
      where: { ...scope, pipeline },
      select: { contactId: true, recordId: true, record: { select: { name: true } } },
    }),
    db.pipelineRecord.findMany({
      where: { ...scope, pipeline },
      select: {
        id: true,
        name: true,
        normalizedName: true,
        group: true,
        listOrder: true,
        nextStep: true,
        nextCallAt: true,
        details: true,
        referredByContactId: true,
      },
    }),
  ]);
  return buildReview(
    rows,
    contacts,
    links.map((link) => ({ ...link, recordName: link.record.name })),
    records,
  );
}

export const pipelineImportTitle = (add: number, update: number) =>
  add > 0
    ? `Add ${count(add, "prospect", "prospects")} to Fundraising`
    : `Update ${count(update, "prospect", "prospects")} in Fundraising`;

export type PreparedPipelineImport =
  | { error: string }
  /** Everything on the list is already there: no card, nothing changed. */
  | { nothing: true; rows: number }
  | {
      importId: string;
      text: string;
      /** The plain card, for the phone apps that cannot apply it. */
      detail: string;
      resumeRunId?: string;
    };

/**
 * Reviews the open import for a card. Reviewing again replaces the open card, whichever run holds it.
 * A list with nothing to add or fill closes without a card, so re-running it asks nothing.
 */
export async function preparePipelineImportCard(
  prisma: PrismaClient,
  scope: Scope,
  effectId: string,
  realtime?: RealtimeFanout,
): Promise<PreparedPipelineImport> {
  const done = await prisma.$transaction(async (tx: Tx) => {
    await takeTurn(tx, scope);
    const open = await tx.pipelineImport.findFirst({
      where: { ...scope, pipeline, status: { in: OPEN } },
    });
    if (!open) return { error: "Nothing is staged. Call pipeline_import_stage first." };
    const review = await loadReview(tx, scope, open.id);
    const rows = review.changes.length;
    if (rows === 0) return { error: "Nothing is staged. Call pipeline_import_stage first." };
    const { add, update, questions, newContacts, savedContacts, noPerson } = review.card;
    if (add === 0 && update === 0) {
      await moveImport(tx, open, { status: "done" });
      return { nothing: true as const, rows };
    }
    const closed =
      open.effectId === effectId ? undefined : await closeOpenCard(tx, scope, open.effectId);
    await moveImport(tx, open, { status: "reviewing", effectId });
    const lines = [
      "Saved contacts are not overwritten.",
      ...(newContacts.length ? [count(newContacts.length, "new contact", "new contacts")] : []),
      ...(savedContacts.length
        ? [count(savedContacts.length, "contact already saved", "contacts already saved")]
        : []),
      ...(noPerson.length
        ? [count(noPerson.length, "prospect with no person yet", "prospects with no person yet")]
        : []),
      ...(questions.length ? [`${questions.length} left to choose`] : []),
      "Review and add on the web or in the desktop app.",
    ];
    return {
      importId: open.id,
      text: pipelineImportTitle(add, update),
      detail: lines.join("\n"),
      closed,
    };
  }, LONG);
  if (!("importId" in done)) return done;
  const { closed, ...card } = done;
  if (closed?.seq !== undefined) await notifyRealtime(realtime, closed.threadId, closed.seq);
  return { ...card, ...(closed?.resumeRunId ? { resumeRunId: closed.resumeRunId } : {}) };
}

const EMPTY_CARD = {
  hash: "",
  add: 0,
  update: 0,
  questions: [],
  newContacts: [],
  savedContacts: [],
  noPerson: [],
  existing: [],
  result: null,
};

/** What the card shows now, or null for an import that is not the user's. */
export async function readPipelineImportCard(
  prisma: PrismaClient,
  scope: Scope,
  importId: string,
  effectId: string,
): Promise<PipelineImportCard | null> {
  const row = await prisma.pipelineImport.findFirst({
    where: { id: importId, ...scope, pipeline },
    select: { status: true, effectId: true, result: true },
  });
  if (!row) return null;
  if (row.effectId !== effectId) return { ...EMPTY_CARD, status: "closed" };
  if (row.status === "applying") return { ...EMPTY_CARD, status: "applying" };
  if (row.status === "done") {
    return { ...EMPTY_CARD, status: "done", result: row.result as PipelineImportResult | null };
  }
  const effect = await prisma.externalEffect.findFirst({
    where: { id: effectId, spaceId: scope.spaceId },
    select: { status: true },
  });
  if (row.status !== "reviewing" || effect?.status !== "intended") {
    return { ...EMPTY_CARD, status: "closed" };
  }
  const review = await loadReview(prisma, scope, importId);
  return { ...EMPTY_CARD, ...review.card, hash: review.hash, status: "reviewing" };
}

/** What the worker does for one person: link a contact it knows, or make or find a new one. */
type PlannedPerson = { contactId: string } | { create: NewPerson };
type RowPlan = {
  people: PlannedPerson[];
  referrer: PlannedPerson | null;
  fills?: ContactFill[];
};

/** The review with the owner's answers: for each row, its plan, or null to skip it. */
function plansFrom(review: Review, answers: Record<string, string>) {
  const questionOf = new Map(review.card.questions.map((question) => [question.id, question]));
  const candidate = (questionId: string, answer: string) =>
    questionOf.get(questionId)?.candidates.find((option) => option.id === answer);
  const referrerOf = (decision: Decision | undefined): PlannedPerson | null => {
    if (!decision || decision.kind === "here") return null;
    if (decision.kind === "contact") return { contactId: decision.contactId };
    if (decision.kind === "new") {
      const { kind: _kind, ...create } = decision;
      return { create };
    }
    const answer = answers[decision.questionId] as string;
    if (answer === PIPELINE_IMPORT_SKIP) return null;
    if (answer === PIPELINE_IMPORT_NEW) return { create: decision.fallback };
    if (answer.startsWith("list:")) {
      const chosen = candidate(decision.questionId, answer);
      return {
        create: {
          key: answer.slice("list:".length),
          name: chosen?.name ?? decision.fallback.name,
          email: chosen?.email ?? null,
          organization: chosen?.organization ?? null,
        },
      };
    }
    return { contactId: answer };
  };
  return review.seenRows.map((row, index) => {
    const data = row.data as PipelineImportRow;
    const people: PlannedPerson[] = [];
    const fills: ContactFill[] = [];
    const fillFor = (contactId: string, email: string | null | undefined) => {
      if (email && !fills.some((known) => known.contactId === contactId)) {
        fills.push({ contactId, email });
      }
    };
    for (const decision of review.people[index] ?? []) {
      if (decision.kind === "here") {
        if (decision.fill) fillFor(decision.fill.contactId, decision.fill.email);
        continue;
      }
      if (decision.kind === "contact") {
        people.push({ contactId: decision.contactId });
        fillFor(decision.contactId, decision.email);
      }
      if (decision.kind === "new") {
        const { kind: _kind, ...create } = decision;
        people.push({ create });
      }
      if (decision.kind !== "ask") continue;
      const answer = answers[decision.questionId] as string;
      if (answer === PIPELINE_IMPORT_SKIP) return { row, plan: null };
      if (answer === PIPELINE_IMPORT_NEW) {
        // Chosen over a saved contact of that name, so it needs its own key.
        people.push({
          create: { ...decision.fallback, key: `q:${row.id}:${decision.questionId}` },
        });
        continue;
      }
      // Someone who stays on another prospect is not linked here; a contact sits in one per pipeline.
      if (!candidate(decision.questionId, answer)?.stays) people.push({ contactId: answer });
      if (!answer.startsWith("list:")) fillFor(answer, decision.fallback.email);
    }
    const referrerDecision = data.referrer
      ? review.referrers.get(review.referrerKeyOf(data.referrer))
      : undefined;
    const referrer = referrerOf(referrerDecision);
    if (referrer && "contactId" in referrer && referrerDecision) {
      fillFor(
        referrer.contactId,
        referrerDecision.kind === "contact"
          ? referrerDecision.email
          : referrerDecision.kind === "ask"
            ? referrerDecision.fallback.email
            : null,
      );
    }
    return { row, plan: { people, referrer, fills } satisfies RowPlan };
  });
}

/** Every question answered, each with one of its own options. Nothing else may reach a write. */
function answersAreComplete(review: Review, answers: Record<string, string>) {
  return review.card.questions.every((question) => {
    const answer = answers[question.id];
    return (
      answer === PIPELINE_IMPORT_SKIP ||
      (answer === PIPELINE_IMPORT_NEW && question.allowNew) ||
      question.candidates.some((option) => option.id === answer)
    );
  });
}

export type AcceptPipelineImportResult =
  /** Nobody is waiting on this card any more; nothing changed. */
  | { status: "closed" }
  /** The list or a contact changed since the card was read; nothing changed. */
  | { status: "changed" }
  /** A question has no valid answer; nothing changed. */
  | { status: "unanswered" }
  /** The run may no longer write: firewalled, external or marked. Nothing changed. */
  | { status: "refused" }
  | { status: "accepted"; importId: string };

/**
 * The press. In one transaction: checks the owner still reads the list as it stands, stores each
 * row's plan, moves the effect to executing and marks the card answered. The run stays in
 * waiting_input until the import settles. A second press finds no intended effect.
 */
export async function acceptPipelineImport(
  prisma: PrismaClient,
  input: Scope & {
    threadId: string;
    runId: string;
    messageId: string;
    hash: string;
    answers: Record<string, string>;
  },
  realtime?: RealtimeFanout,
): Promise<AcceptPipelineImportResult> {
  const scope = { spaceId: input.spaceId, userId: input.userId };
  const committed = await prisma.$transaction(
    async (tx: Tx): Promise<AcceptPipelineImportResult & { seq?: number }> => {
      await takeTurn(tx, scope);
      await tx.$queryRaw`SELECT id FROM threads WHERE id = ${input.threadId} FOR UPDATE`;
      const run = await tx.run.findFirst({
        where: {
          id: input.runId,
          threadId: input.threadId,
          ...scope,
          status: "waiting_input",
        },
        select: {
          botId: true,
          externalTaint: true,
          bot: { select: { firewall: true, audience: true } },
          thread: { select: { meetingTaintedAt: true } },
        },
      });
      if (!run) return { status: "closed" };
      if (
        run.externalTaint ||
        run.bot.firewall ||
        run.bot.audience === "external" ||
        run.thread.meetingTaintedAt
      ) {
        return { status: "refused" };
      }
      const message = await tx.message.findFirst({
        where: { id: input.messageId, threadId: input.threadId, runId: input.runId, role: "bot" },
      });
      const parsed = MessageBlockSchema.array().safeParse(message?.blocks);
      if (!message || !parsed.success) return { status: "closed" };
      const card = parsed.data.find(
        (block) => block.kind === "ask" && block.pipelineImport && block.status !== "answered",
      );
      if (card?.kind !== "ask" || !card.approvalEffectId || !card.pipelineImport) {
        return { status: "closed" };
      }
      const effectId = card.approvalEffectId;
      const importId = card.pipelineImport.importId;
      const row = await tx.pipelineImport.findFirst({
        where: { id: importId, ...scope, pipeline, status: "reviewing", effectId },
        select: { id: true },
      });
      if (!row) return { status: "closed" };
      const review = await loadReview(tx, scope, importId);
      if (review.hash !== input.hash) return { status: "changed" };
      if (!answersAreComplete(review, input.answers)) return { status: "unanswered" };
      const claimed = await tx.externalEffect.updateMany({
        where: {
          id: effectId,
          spaceId: input.spaceId,
          runId: input.runId,
          kind: PIPELINE_IMPORT_REVIEW_TOOL,
          status: "intended",
        },
        data: { status: "executing" },
      });
      if (claimed.count !== 1) return { status: "closed" };
      const plans = plansFrom(review, input.answers);
      for (const [index, { row: staged, plan }] of plans.entries()) {
        const state = !plan ? "skipped" : review.changes[index] ? "queued" : "unchanged";
        await tx.pipelineImportRow.update({
          where: { id: staged.id },
          data: { state, plan: (plan ?? {}) as Prisma.InputJsonValue },
        });
      }
      await tx.pipelineImport.update({ where: { id: importId }, data: { status: "applying" } });
      const blocks = parsed.data.map((block) =>
        block === card ? { ...block, status: "answered" as const, answer: "allow" } : block,
      );
      await tx.message.update({ where: { id: message.id }, data: { blocks } });
      const event = await appendEventInTransaction(tx, {
        spaceId: input.spaceId,
        threadId: input.threadId,
        botId: run.botId,
        type: "thread.message.updated",
        runId: input.runId,
        payload: { messageId: message.id, role: "bot", blocks },
      });
      return { status: "accepted", importId, seq: event.seq };
    },
    LONG,
  );
  if (committed.status !== "accepted") return committed;
  await notifyRealtime(realtime, input.threadId, committed.seq as number);
  return { status: "accepted", importId: committed.importId };
}

type RowOutcome = { added: boolean; updated: boolean; newContacts: number; savedIds: string[] };

/** One row, whole or not at all. Its state moves in the same transaction, so nothing runs twice. */
async function applyRow(tx: Tx, scope: Scope, importId: string, rowId: string) {
  await takeTurn(tx, scope);
  const row = await tx.pipelineImportRow.findFirst({
    where: { id: rowId, ...scope, importId, state: "queued" },
  });
  if (!row) return;
  const owner = await tx.pipelineImport.findFirstOrThrow({
    where: { id: importId, ...scope },
    select: { botId: true, created: true },
  });
  const created = { ...(owner.created as Record<string, string>) };
  const data = row.data as PipelineImportRow;
  const plan = row.plan as RowPlan;
  const at = new Date().toISOString();
  const outcome: RowOutcome = { added: false, updated: false, newContacts: 0, savedIds: [] };

  /** The contact a plan names. A saved contact is only ever read: its kind and fields stay. */
  const contactOf = async (person: PlannedPerson, kind: "prospect" | "other") => {
    if ("contactId" in person) {
      outcome.savedIds.push(person.contactId);
      return person.contactId;
    }
    const { key, name, email, organization } = person.create;
    const known = created[key];
    if (known) return known;
    const sameEmail = email
      ? await tx.contact.findFirst({
          where: { ...scope, email: { equals: email, mode: "insensitive" } },
          select: { id: true },
        })
      : null;
    if (sameEmail) {
      outcome.savedIds.push(sameEmail.id);
      created[key] = sameEmail.id;
      return sameEmail.id;
    }
    const contact = await tx.contact.create({
      data: { ...scope, name, email, organization, kind, botId: owner.botId },
      select: { id: true },
    });
    outcome.newContacts += 1;
    created[key] = contact.id;
    return contact.id;
  };

  const keys = {
    spaceId: scope.spaceId,
    userId: scope.userId,
    pipeline,
    normalizedName: row.normalizedFirm,
  };
  const found = await tx.pipelineRecord.findUnique({
    where: { spaceId_userId_pipeline_normalizedName: keys },
  });
  const [fresh] = found
    ? []
    : await tx.pipelineRecord.createManyAndReturn({
        data: {
          ...scope,
          pipeline,
          name: data.firm,
          normalizedName: row.normalizedFirm,
          group: data.group ?? null,
          listOrder: data.order ?? null,
          nextStep: data.nextStep ?? null,
          nextCallAt: nextCallOf(data),
          nextCallHasTime: false,
          details: listDetails(data, at) as Prisma.InputJsonValue,
        },
        skipDuplicates: true,
      });
  // Another writer that took the name after the read above: its record, filled like any other.
  const record =
    fresh ??
    found ??
    (await tx.pipelineRecord.findUniqueOrThrow({
      where: { spaceId_userId_pipeline_normalizedName: keys },
    }));
  outcome.added = fresh !== undefined;
  let changed = false;
  if (!fresh) {
    // The owner's edit waits for this row, so a field is filled only while it is still empty.
    await tx.$queryRaw`SELECT id FROM pipeline_records WHERE id = ${record.id} FOR UPDATE`;
    const current = await tx.pipelineRecord.findUniqueOrThrow({ where: { id: record.id } });
    const fills = fillsOf(data, current, at);
    if (Object.keys(fills).length > 0) {
      await savePipelineRecord(tx, scope, record.id, fills);
      changed = true;
    }
  }
  for (const person of plan.people) {
    const contactId = await contactOf(person, "prospect");
    const link = await tx.pipelineRecordPerson.findUnique({
      where: { spaceId_userId_pipeline_contactId: { ...scope, pipeline, contactId } },
      select: { id: true },
    });
    if (link) continue;
    await joinRecord(tx, scope, record.id, contactId);
    changed = true;
  }
  for (const fill of plan.fills ?? []) {
    // An empty field is filled only while no other contact of the owner already holds the address.
    const taken = await tx.contact.findFirst({
      where: { ...scope, email: { equals: fill.email, mode: "insensitive" } },
      select: { id: true },
    });
    if (taken) continue;
    const filled = await tx.contact.updateMany({
      where: { id: fill.contactId, ...scope, email: null },
      data: { email: fill.email },
    });
    changed ||= filled.count === 1;
  }
  if (plan.referrer) {
    const referredByContactId = await contactOf(plan.referrer, "other");
    const saved = await savePipelineRecord(
      tx,
      scope,
      record.id,
      { referredByContactId },
      { referredByContactId: null },
    );
    changed ||= saved;
  }
  outcome.updated = !outcome.added && changed;
  if (outcome.added || changed) {
    await tx.pipelineEvent.create({
      data: {
        ...scope,
        recordId: record.id,
        kind: "import",
        actor: owner.botId ?? "user",
        payload: { importId },
      },
    });
  }
  await tx.pipelineImportRow.update({
    where: { id: row.id },
    data: { state: "applied", outcome: outcome as Prisma.InputJsonValue },
  });
  await tx.pipelineImport.update({
    where: { id: importId },
    data: { created: created as Prisma.InputJsonValue },
  });
}

/**
 * Applies the next queued row. False when none is left. A row that fails is reported on its own and
 * the rest go on. Safe with several workers and after a restart: an interrupted row rolled back and
 * is still queued, and a row a second worker already applied is no longer queued.
 */
export async function applyNextPipelineImportRow(
  prisma: PrismaClient,
  scope: Scope,
  importId: string,
): Promise<boolean> {
  const next = await prisma.pipelineImportRow.findFirst({
    where: { ...scope, importId, state: "queued" },
    orderBy: { position: "asc" },
    select: { id: true },
  });
  if (!next) return false;
  try {
    await prisma.$transaction((tx: Tx) => applyRow(tx, scope, importId, next.id), LONG);
  } catch (error) {
    getLogger().error("pipeline import row", error);
    await prisma.pipelineImportRow.updateMany({
      where: { id: next.id, state: "queued" },
      data: { state: "failed", error: "Could not be saved." },
    });
  }
  return true;
}

const AGENT_NOTE =
  "The user sees the result and any failed rows on the card. Do not list them; answer in a sentence.";

/**
 * Ends the waiting call once no row is queued: the effect completes with the row-by-row result, the
 * card shows it, and a run still waiting is queued to read it. Conditional on the effect executing,
 * so it is safe to repeat. Returns whether this call queued the run.
 */
export async function settlePipelineImport(
  prisma: PrismaClient,
  input: Scope & { importId: string },
  realtime?: RealtimeFanout,
): Promise<{ settled: boolean; resumeRunId?: string }> {
  const scope = { spaceId: input.spaceId, userId: input.userId };
  const owner = await prisma.pipelineImport.findFirst({
    where: { id: input.importId, ...scope, status: "applying" },
    select: { effectId: true },
  });
  if (!owner?.effectId) return { settled: false };
  const effectId = owner.effectId;
  const effect = await prisma.externalEffect.findFirst({
    where: { id: effectId, spaceId: input.spaceId, status: "executing" },
    select: { runId: true, run: { select: { threadId: true, botId: true } } },
  });
  if (!effect) return { settled: false };
  const { threadId, botId } = effect.run;
  const committed = await prisma.$transaction(async (tx: Tx) => {
    await tx.$queryRaw`SELECT id FROM threads WHERE id = ${threadId} FOR UPDATE`;
    const rows = await tx.pipelineImportRow.findMany({
      where: { ...scope, importId: input.importId },
      orderBy: { position: "asc" },
      select: { data: true, state: true, outcome: true, error: true },
    });
    if (rows.some((row) => row.state === "queued")) return null;
    const outcomes = rows.flatMap((row) => (row.outcome ? [row.outcome as RowOutcome] : []));
    const result: PipelineImportResult = {
      added: outcomes.filter((outcome) => outcome.added).length,
      updated: outcomes.filter((outcome) => outcome.updated).length,
      newContacts: outcomes.reduce((total, outcome) => total + outcome.newContacts, 0),
      // One contact counts once, however many rows name it.
      savedContacts: new Set(outcomes.flatMap((outcome) => outcome.savedIds)).size,
      failed: rows
        .filter((row) => row.state === "failed")
        .map((row) => ({
          firm: (row.data as PipelineImportRow).firm,
          reason: row.error ?? "Could not be saved.",
        })),
    };
    const claimed = await tx.externalEffect.updateMany({
      where: { id: effectId, status: "executing" },
      data: { status: "completed", result: { ...result, note: AGENT_NOTE } },
    });
    if (claimed.count !== 1) return null;
    await tx.pipelineImport.update({
      where: { id: input.importId },
      data: { status: "done", result: result as Prisma.InputJsonValue },
    });
    const resumed = await tx.run.updateMany({
      where: { id: effect.runId, threadId, status: "waiting_input" },
      data: { status: "queued" },
    });
    const text =
      result.added > 0 || result.updated === 0
        ? `Added ${count(result.added, "prospect", "prospects")} to Fundraising`
        : `Updated ${count(result.updated, "prospect", "prospects")} in Fundraising`;
    const detail = [
      count(result.newContacts, "new contact", "new contacts"),
      count(result.savedContacts, "contact already saved", "contacts already saved"),
      ...(result.failed.length > 0
        ? [`Could not save: ${result.failed.map((row) => row.firm).join(", ")}`]
        : []),
    ].join("\n");
    const event = await rewriteCard(
      tx,
      { spaceId: input.spaceId, threadId, botId, runId: effect.runId, effectId },
      (block) => ({ ...block, text, detail }),
    );
    return { resumed: resumed.count === 1, seq: event?.seq };
  }, LONG);
  if (!committed) return { settled: false };
  if (committed.seq !== undefined) await notifyRealtime(realtime, threadId, committed.seq);
  return { settled: true, ...(committed.resumed ? { resumeRunId: effect.runId } : {}) };
}
