import type { ThreadGoal } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import { slashActionRoute } from "./slash-actions";
import { applyGoalEvent, goalLineState, isGoalReply } from "./thread-goal";

const goal: ThreadGoal = {
  id: "goal-1",
  text: "Find three suppliers",
  status: "active",
  stopReason: null,
  lastReason: null,
  continuations: 0,
  startedAt: "2026-01-01T00:00:00.000Z",
};

describe("goalLineState", () => {
  it("is empty without an open goal", () => {
    expect(goalLineState(null, [])).toBeNull();
    expect(goalLineState(undefined, [])).toBeNull();
    expect(goalLineState({ ...goal, status: "met" }, [])).toBeNull();
  });
  it("shows no status while the goal works", () => {
    expect(goalLineState(goal, [{ status: "running" }])).toEqual({
      text: goal.text,
      status: null,
    });
  });
  it("says Paused for a paused goal", () => {
    expect(goalLineState({ ...goal, status: "paused" }, [])?.status).toBe("Paused");
  });
  it("says Waiting on you while a run waits on the owner", () => {
    expect(goalLineState(goal, [{ status: "waiting_input" }])?.status).toBe("Waiting on you");
    expect(goalLineState(goal, [{ status: "waiting_takeover" }])?.status).toBe("Waiting on you");
  });
});

describe("applyGoalEvent", () => {
  const snap = { cursor: 3, goal: null } as never;
  it("stores the goal and advances the cursor", () => {
    const next = applyGoalEvent(snap, { seq: 5, payload: { goal } });
    expect(next).toMatchObject({ cursor: 5, goal });
  });
  it("clears the goal on null and ignores a malformed payload", () => {
    const withGoal = { cursor: 3, goal } as never;
    expect(applyGoalEvent(withGoal, { seq: 6, payload: { goal: null } })).toMatchObject({
      cursor: 6,
      goal: null,
    });
    expect(applyGoalEvent(withGoal, { seq: 7, payload: { goal: 1 } })).toBe(withGoal);
    expect(applyGoalEvent(null, { seq: 7, payload: {} })).toBeNull();
  });
});

describe("isGoalReply", () => {
  it("is true only for an error that carries data.goalReply", () => {
    expect(
      isGoalReply(Object.assign(new Error("No goal set."), { data: { goalReply: true } })),
    ).toBe(true);
    expect(isGoalReply(new Error("No goal set."))).toBe(false);
    expect(isGoalReply(Object.assign(new Error("x"), { data: { goalReply: false } }))).toBe(false);
    expect(isGoalReply(null)).toBe(false);
  });
});

describe("slashActionRoute", () => {
  const bot = { inGroup: false, botId: "bot-1" };
  it("opens chat settings for the bot or the group", () => {
    expect(slashActionRoute("chat-settings", bot)).toEqual({
      pathname: "/bot-settings",
      params: { botId: "bot-1" },
    });
    expect(slashActionRoute("chat-settings", { inGroup: true, groupId: "g-1" })).toEqual({
      pathname: "/group-settings",
      params: { groupId: "g-1" },
    });
  });
  it("opens Account only for the general settings action", () => {
    expect(slashActionRoute("settings-general", bot)).toEqual({ pathname: "/account" });
  });
  it("does not open Account for an action it does not know", () => {
    expect(slashActionRoute("goal", bot)).toBeNull();
    expect(slashActionRoute("something-new" as never, bot)).toBeNull();
  });
});
