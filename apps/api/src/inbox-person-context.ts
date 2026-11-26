import type { PersonMeeting, PersonSummaryResult } from "@rakazo/adapters";
import { OPEN_SCRATCHPAD_STATUSES, personSummaryContext } from "@rakazo/adapters";
import type {
  Actor,
  InboxPersonContext,
  InboxPersonInput,
  InboxPersonSummaryOutput,
} from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";

export interface PersonContextDeps {
  prisma: PrismaClient;
  /** The actor's Data room, searched by keyword with the Data room's own visibility rules. */
  searchDataRoom?: (actor: Actor, query: string) => Promise<Array<{ id: string; name: string }>>;
  /** Google Calendar events with the address, across the actor's connected accounts. */
  calendarMeetings?: (
    actor: Actor,
    email: string,
    signal?: AbortSignal,
  ) => Promise<PersonMeeting[]>;
  /** One model turn over the facts; without it the summary is unavailable. */
  summarize?: (
    input: { scope: { userId: string; spaceId: string }; context: string },
    signal?: AbortSignal,
  ) => Promise<PersonSummaryResult>;
}

const MESSAGE_WINDOW = 200;
const THREADS_SHOWN = 5;
const LISTED = 5;
const MEETING_ROWS = 200;

/** A source that fails leaves its part empty; the others still answer. */
async function optional<T>(source: string, fallback: T, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    getLogger().warn("person context source failed", {
      source,
      error: error instanceof Error ? error.name : "unknown",
    });
    return fallback;
  }
}

/** The facts the panel shows, plus the thread snippets only the summary prompt uses. */
async function personFacts(
  deps: PersonContextDeps,
  actor: Actor,
  address: string,
  signal?: AbortSignal,
) {
  const email = address.trim().toLowerCase();
  const scope = { spaceId: actor.spaceId, userId: actor.userId };
  const { prisma } = deps;

  const [contact, messages] = await Promise.all([
    optional("contact", null, () =>
      prisma.contact.findFirst({
        where: { ...scope, email: { equals: email, mode: "insensitive" } },
        select: { id: true, name: true, organization: true, kind: true },
      }),
    ),
    optional("mail", [], () =>
      prisma.cachedMailMessage.findMany({
        where: {
          ...scope,
          isSpam: false,
          OR: [
            { fromAddress: { equals: email, mode: "insensitive" } },
            // ponytail: array membership is case-sensitive; Gmail keeps the case the sender wrote.
            { toAddresses: { has: email } },
            { ccAddresses: { has: email } },
          ],
        },
        select: {
          id: true,
          threadId: true,
          subject: true,
          snippet: true,
          receivedAt: true,
          fromSelf: true,
          fromName: true,
          fromAddress: true,
        },
        orderBy: { receivedAt: "desc" },
        take: MESSAGE_WINDOW,
      }),
    ),
  ]);

  const newestByThread = new Map<string, (typeof messages)[number]>();
  for (const message of messages)
    if (!newestByThread.has(message.threadId)) newestByThread.set(message.threadId, message);
  const threads = [...newestByThread.values()];
  const name =
    contact?.name ??
    messages.find((m) => !m.fromSelf && m.fromAddress.toLowerCase() === email && m.fromName)
      ?.fromName ??
    null;
  const lastEmailedAt = messages.find((m) => m.fromSelf)?.receivedAt.toISOString() ?? null;
  const organization = contact?.organization ?? null;
  // The name and address, with the organization as a third way to find a document that names only it.
  const query = [name, email, organization]
    .filter((term): term is string => Boolean(term))
    .map((term) => `"${term.replaceAll('"', "")}"`)
    .join(" or ");

  const [documents, todos, calendar, recorded] = await Promise.all([
    optional("data room", [], async () => (await deps.searchDataRoom?.(actor, query)) ?? []),
    optional("to-dos", [], async () => {
      const [mail, notes] = await Promise.all([
        prisma.inboxTodo.findMany({
          where: { ...scope, doneAt: null, messageId: { in: messages.map((m) => m.id) } },
          select: { id: true, text: true, dueOn: true },
          orderBy: { createdAt: "desc" },
          take: LISTED,
        }),
        prisma.scratchpadItem.findMany({
          where: {
            ...scope,
            status: { in: OPEN_SCRATCHPAD_STATUSES },
            mailThreadId: { in: [...newestByThread.keys()] },
            bot: { archivedAt: null },
          },
          select: { id: true, title: true, dueAt: true },
          orderBy: { updatedAt: "desc" },
          take: LISTED,
        }),
      ]);
      return [
        ...mail.map((row) => ({ id: row.id, text: row.text, dueOn: row.dueOn })),
        ...notes.map((row) => ({ id: row.id, text: row.title, dueOn: row.dueAt })),
      ].slice(0, LISTED);
    }),
    optional(
      "calendar",
      [],
      async () => (await deps.calendarMeetings?.(actor, email, signal)) ?? [],
    ),
    optional("meetings", [], async () => {
      // ponytail: attendees are JSON, so the newest meetings are filtered here; index them if this grows.
      const rows = await prisma.meeting.findMany({
        where: { ...scope, deletedAt: null },
        select: { title: true, startedAt: true, attendees: true, sourceUrl: true },
        orderBy: { startedAt: "desc" },
        take: MEETING_ROWS,
      });
      return rows
        .filter(
          (row) =>
            Array.isArray(row.attendees) &&
            row.attendees.some(
              (a) =>
                typeof a === "object" &&
                a !== null &&
                "email" in a &&
                typeof a.email === "string" &&
                a.email.toLowerCase() === email,
            ),
        )
        .map((row) => ({
          title: row.title,
          start: row.startedAt.toISOString(),
          href: row.sourceUrl,
        }));
    }),
  ]);

  const now = Date.now();
  const meetings = [...calendar, ...recorded].sort((a, b) => a.start.localeCompare(b.start));
  const past = meetings.filter((m) => new Date(m.start).getTime() <= now);
  const upcoming = meetings.filter((m) => new Date(m.start).getTime() > now);

  const facts: InboxPersonContext = {
    email,
    name,
    organization,
    kind: contact?.kind ?? null,
    contactId: contact?.id ?? null,
    lastEmailedAt,
    threadCount: threads.length,
    threads: threads
      .slice(0, THREADS_SHOWN)
      .map((m) => ({ id: m.id, subject: m.subject, receivedAt: m.receivedAt.toISOString() })),
    lastMeeting: past.at(-1) ?? null,
    nextMeeting: upcoming[0] ?? null,
    documents: documents.slice(0, LISTED),
    todos: todos.map((todo) => ({
      id: todo.id,
      text: todo.text,
      dueOn: todo.dueOn?.toISOString() ?? null,
    })),
  };
  return {
    facts,
    snippets: threads.slice(0, THREADS_SHOWN).map((m) => m.snippet),
  };
}

export async function inboxPersonContext(
  deps: PersonContextDeps,
  actor: Actor,
  input: InboxPersonInput,
  signal?: AbortSignal,
): Promise<InboxPersonContext> {
  return (await personFacts(deps, actor, input.email, signal)).facts;
}

/**
 * A short model briefing made from the same facts and the newest thread snippets. The facts are
 * read again here, so the browser can show them first and ask for the summary after.
 */
export async function inboxPersonSummary(
  deps: PersonContextDeps,
  actor: Actor,
  input: InboxPersonInput,
  signal?: AbortSignal,
): Promise<InboxPersonSummaryOutput> {
  if (!deps.summarize) return { status: "unavailable" };
  const { facts, snippets } = await personFacts(deps, actor, input.email, signal);
  const known =
    facts.name ||
    facts.kind ||
    facts.threadCount ||
    facts.documents.length ||
    facts.todos.length ||
    facts.lastMeeting ||
    facts.nextMeeting;
  if (!known) return { status: "unavailable" };
  return deps.summarize(
    {
      scope: { userId: actor.userId, spaceId: actor.spaceId },
      context: personSummaryContext({
        ...facts,
        threads: facts.threads.map((thread, index) => ({
          ...thread,
          snippet: snippets[index] ?? "",
        })),
        documents: facts.documents.map((doc) => doc.name),
        todos: facts.todos.map((todo) => todo.text),
      }),
    },
    signal,
  );
}
