import type { ProductEvent, ThreadSnapshot } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import { reduceThreadSnapshot } from "./thread-snapshot-reducer.js";

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
