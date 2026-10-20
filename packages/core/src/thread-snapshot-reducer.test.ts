import type { ProductEvent, ThreadSnapshot } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import { isThreadSnapshotEvent, reduceThreadSnapshot } from "./thread-snapshot-reducer.js";

const at = "2026-01-01T00:00:00.000Z";

function event(overrides: Partial<ProductEvent> & { type: ProductEvent["type"] }): ProductEvent {
  return {
    id: "event-1",
    spaceId: "space-1",
    threadId: "thread-1",
    botId: "bot-1",
    seq: 5,
    createdAt: at,
    payload: {},
    ...overrides,
  };
}

function snapshot(overrides: Partial<ThreadSnapshot> = {}): ThreadSnapshot {
  return {
    threadId: "thread-1",
    cursor: 3,
    messages: [],
    olderCursor: null,
    run: null,
    ...overrides,
  };
}

describe("reduceThreadSnapshot", () => {
  it("puts a run.phase on the run it names and ignores other runs", () => {
    const started = reduceThreadSnapshot(
      snapshot(),
      event({ type: "run.started", runId: "run-1", payload: { trigger: "user" } }),
    );
    const phase = { kind: "connecting", name: "Devin", at };
    const next = reduceThreadSnapshot(
      started,
      event({ type: "run.phase", runId: "run-1", seq: 6, payload: phase }),
    );
    expect(next?.run?.phase).toEqual(phase);
    expect(next?.activeRuns?.[0]?.phase).toEqual(phase);
    const other = reduceThreadSnapshot(
      next,
      event({ type: "run.phase", runId: "run-2", seq: 7, payload: { kind: "thinking", at } }),
    );
    expect(other).toMatchObject({ cursor: 7, run: { phase } });
  });

  it("ignores a late background-run start but advances the cursor", () => {
    const next = reduceThreadSnapshot(
      snapshot(),
      event({ type: "run.started", runId: "run-1", payload: { trigger: "tickets" } }),
    );
    expect(next).toMatchObject({ cursor: 5, run: null });
  });

  it("clears progress and the busy banner when a takeover is requested", () => {
    const next = reduceThreadSnapshot(
      snapshot({
        messages: [
          {
            id: "progress:run-1",
            threadId: "thread-1",
            seq: 1,
            role: "bot",
            blocks: [],
            createdAt: at,
          },
        ],
        computer: {
          state: "running",
          controlHolder: "bot",
          screenAvailable: true,
          mode: "team",
          busyBotName: "Peer",
        } as unknown as ThreadSnapshot["computer"],
      }),
      event({ type: "computer.takeover.requested", runId: "run-1" }),
    );
    expect(next?.messages).toEqual([]);
    expect(next?.computer?.busyBotName).toBeNull();
    expect(next?.run).toMatchObject({
      id: "run-1",
      status: "waiting_takeover",
      trigger: "bot_message",
    });
  });

  it("advances the cursor on a repeated wait without replacing the run", () => {
    const waiting = reduceThreadSnapshot(
      snapshot(),
      event({ type: "run.waiting_input", runId: "run-1" }),
    );
    const repeated = reduceThreadSnapshot(
      waiting,
      event({ type: "run.waiting_input", runId: "run-1", seq: 6 }),
    );
    expect(repeated?.cursor).toBe(6);
    expect(repeated?.run).toBe(waiting?.run);
  });
});

describe("isThreadSnapshotEvent", () => {
  it("accepts run.started and terminal run events", () => {
    expect(isThreadSnapshotEvent(event({ type: "run.started" }))).toBe(true);
    expect(isThreadSnapshotEvent(event({ type: "run.completed" }))).toBe(true);
    expect(isThreadSnapshotEvent(event({ type: "bot.updated" }))).toBe(false);
  });
});
