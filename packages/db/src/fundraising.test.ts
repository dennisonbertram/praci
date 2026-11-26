import { describe, expect, it } from "vitest";
import { logCall, saveProspect } from "./fundraising.js";

type Row = { id: string; status: string; nextCallAt: Date | null; nextCallHasTime: boolean };
type Event = { id: string; kind: string; recordId?: string; payload: unknown };

const scope = { spaceId: "space-1", userId: "user-1" };
const initialNextCall = new Date("2030-01-01T00:00:00.000Z");

/** In-memory stand-in whose $transaction discards its writes when the callback throws. */
function fakeDb({ failCallEvent }: { failCallEvent: boolean }) {
  const state = {
    row: {
      id: "rec-1",
      status: "not_reached",
      nextCallAt: initialNextCall,
      nextCallHasTime: false,
    } as Row,
    events: [] as Event[],
  };
  const writer = (draft: typeof state) => ({
    pipelineRecord: {
      findFirst: async () => ({ ...draft.row }),
      updateMany: async ({
        where,
        data,
      }: {
        where: { status?: { in: string[] } };
        data: Partial<Row>;
      }) => {
        if (where.status && !where.status.in.includes(draft.row.status)) return { count: 0 };
        Object.assign(draft.row, data);
        return { count: 1 };
      },
    },
    pipelineEvent: {
      create: async ({ data }: { data: { kind: string; payload: unknown } }) => {
        if (failCallEvent && data.kind === "call") throw new Error("write failed");
        const event = { id: `evt-${draft.events.length + 1}`, ...data };
        draft.events.push(event);
        return event;
      },
    },
  });
  const db = {
    ...writer(state),
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const draft = { row: { ...state.row }, events: [...state.events] };
      const result = await fn(writer(draft));
      Object.assign(state, draft);
      return result;
    },
  };
  return { state, db: db as unknown as Parameters<typeof logCall>[0] };
}

const spoke = {
  id: "rec-1",
  outcome: "spoke" as const,
  nextCall: { at: "2030-02-01T00:00:00.000Z", hasTime: false },
};

describe("logCall", () => {
  it("leaves the record untouched when the call event fails to write", async () => {
    const { state, db } = fakeDb({ failCallEvent: true });

    await expect(logCall(db, scope, spoke)).rejects.toThrow("write failed");

    expect(state.row.status).toBe("not_reached");
    expect(state.row.nextCallAt).toEqual(initialNextCall);
    expect(state.events).toEqual([]);
  });

  it("moves a Spoke record to Met and writes the call and status events", async () => {
    const { state, db } = fakeDb({ failCallEvent: false });

    const result = await logCall(db, scope, spoke);

    expect(result).toEqual({ eventId: "evt-1", movedToMet: true });
    expect(state.row.status).toBe("met");
    expect(state.row.nextCallAt).toEqual(new Date("2030-02-01T00:00:00.000Z"));
    expect(state.events.map((e) => e.kind)).toEqual(["call", "status"]);
    expect(state.events[1]?.payload).toEqual({ from: "not_reached", to: "met" });
  });
});

type ContactRow = {
  id: string;
  name: string;
  email: string | null;
  organization: string | null;
  kind: string;
  notes: string | null;
  portalLinkSentAt: Date | null;
  portalLastSeenAt: Date | null;
  portalBlockedAt: Date | null;
  bot: null;
  createdAt: Date;
  updatedAt: Date;
};

/** In-memory saveProspect stand-in whose $transaction discards its writes when the callback throws. */
function prospectDb({ failEventUpdate }: { failEventUpdate: boolean }) {
  const state = {
    row: {
      id: "rec-1",
      status: "not_reached",
      nextCallAt: null,
      nextCallHasTime: false,
    } as Row,
    events: [
      {
        id: "evt-auto",
        kind: "auto",
        recordId: "rec-1",
        payload: { set: { status: "reached_out" } },
      },
    ] as Event[],
    contact: {
      id: "contact-1",
      name: "Prospect Person",
      email: "prospect@example.test",
      organization: null,
      kind: "prospect",
      notes: null,
      portalLinkSentAt: null,
      portalLastSeenAt: null,
      portalBlockedAt: null,
      bot: null,
      createdAt: new Date("2030-01-01T00:00:00.000Z"),
      updatedAt: new Date("2030-01-01T00:00:00.000Z"),
    } as ContactRow,
  };
  const writer = (draft: typeof state) => ({
    contact: {
      findFirst: async ({ where }: { where: { id: string } }) =>
        where.id === draft.contact.id ? draft.contact : null,
      findFirstOrThrow: async ({ where }: { where: { id: string } }) => {
        if (where.id !== draft.contact.id) throw new Error("Contact not found");
        return { ...draft.contact, pipelinePeople: [{ record: { ...draft.row } }] };
      },
    },
    pipelineRecordPerson: {
      findFirst: async ({ where }: { where: { contactId: string } }) =>
        where.contactId === draft.contact.id ? { record: { ...draft.row } } : null,
    },
    pipelineRecord: {
      findFirst: async ({ where }: { where: { id: string; people?: unknown } }) =>
        where.id === draft.row.id && !where.people ? { ...draft.row } : null,
      findFirstOrThrow: async ({ where }: { where: { id: string } }) => {
        if (where.id !== draft.row.id) throw new Error("Record not found");
        return { ...draft.row };
      },
      updateMany: async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
        if (where.id !== draft.row.id) return { count: 0 };
        Object.assign(draft.row, data);
        return { count: 1 };
      },
    },
    pipelineEvent: {
      findMany: async ({ where }: { where: { recordId: string; kind?: string } }) =>
        draft.events.filter(
          (event) =>
            event.recordId === where.recordId && (!where.kind || event.kind === where.kind),
        ),
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { payload: unknown };
      }) => {
        if (failEventUpdate) throw new Error("undo write failed");
        let count = 0;
        for (const event of draft.events) {
          if (event.id !== where.id) continue;
          Object.assign(event, data);
          count += 1;
        }
        return { count };
      },
      create: async ({ data }: { data: { kind: string; recordId: string; payload: unknown } }) => {
        const event = { id: `evt-${draft.events.length + 1}`, ...data };
        draft.events.push(event);
        return event;
      },
    },
  });
  const db = {
    ...writer(state),
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const draft = {
        ...state,
        row: { ...state.row },
        events: state.events.map((event) => ({
          ...event,
          payload:
            event.payload && typeof event.payload === "object"
              ? { ...event.payload }
              : event.payload,
        })),
      };
      const result = await fn(writer(draft));
      Object.assign(state, draft);
      return result;
    },
  };
  return { state, db: db as unknown as Parameters<typeof saveProspect>[0] };
}

describe("saveProspect", () => {
  it("writes the record and marks the job's auto changes undone in one save", async () => {
    const { state, db } = prospectDb({ failEventUpdate: false });
    const contact = await saveProspect(db, scope, { id: "contact-1", status: "met" });

    expect(contact.pipelineRecord?.status).toBe("met");
    expect(state.events.map((e) => e.kind)).toEqual(["auto", "status"]);
    expect(state.events[0]?.payload).toMatchObject({ undoneAt: expect.any(String) });
  });

  it("leaves the record untouched when marking the auto change undone fails", async () => {
    const { state, db } = prospectDb({ failEventUpdate: true });

    await expect(saveProspect(db, scope, { id: "contact-1", status: "met" })).rejects.toThrow(
      "undo write failed",
    );

    // A moved record with the job's changes still un-marked is exactly what the job would
    // re-move next run, so the write must have rolled back with the marking.
    expect(state.row.status).toBe("not_reached");
    expect(state.events).toEqual([
      {
        id: "evt-auto",
        kind: "auto",
        recordId: "rec-1",
        payload: { set: { status: "reached_out" } },
      },
    ]);
  });
});
