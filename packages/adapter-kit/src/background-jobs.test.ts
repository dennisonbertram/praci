import { describe, expect, it, vi } from "vitest";
import {
  dataRoomStepJob,
  dispatchBackgroundJob,
  financeSyncJob,
  HISTORY_COMPACT_MAX_ATTEMPTS,
  historyCompactJob,
  historyCompactJobKey,
  inboxTriageJob,
  mailSearchExpireJob,
  messagingDeliverJob,
  parseBackgroundJob,
} from "./background-jobs.js";
import type { BackgroundJobHandlers } from "./types.js";

function handlers(): BackgroundJobHandlers {
  return {
    "run.continue": vi.fn(async () => undefined),
    "routine.wakeup": vi.fn(async () => undefined),
    "computer.update": vi.fn(async () => undefined),
    "computer.sleep": vi.fn(async () => undefined),
    "computer.control-expire": vi.fn(async () => undefined),
    "skill.teaching-expire": vi.fn(async () => undefined),
    "history.compact": vi.fn(async () => undefined),
    "messaging.deliver": vi.fn(async () => undefined),
    "cloud_agent.poll": vi.fn(async () => undefined),
    "mail.search.expire": vi.fn(async () => undefined),
    "inbox.triage": vi.fn(async () => undefined),
    "finance.sync": vi.fn(async () => undefined),
    "dataroom.blob.delete": vi.fn(async () => undefined),
    "dataroom.ingest": vi.fn(async () => undefined),
    "dataroom.classify": vi.fn(async () => undefined),
    "dataroom.index": vi.fn(async () => undefined),
  };
}

describe("background job contracts", () => {
  it("validates and dispatches messaging.deliver", async () => {
    const target = handlers();
    await dispatchBackgroundJob(target, "messaging.deliver", { runId: "run-1" });
    expect(target["messaging.deliver"]).toHaveBeenCalledWith({ runId: "run-1" });
    expect(messagingDeliverJob("run-1")).toEqual({
      name: "messaging.deliver",
      payload: { runId: "run-1" },
      replaceKey: "messaging.deliver:run-1",
    });
    expect(messagingDeliverJob()).toEqual({
      name: "messaging.deliver",
      payload: {},
      replaceKey: "messaging.deliver:drain",
    });
  });

  it("validates and dispatches mail.search.expire for one search at its expiry time", async () => {
    const target = handlers();
    await dispatchBackgroundJob(target, "mail.search.expire", { searchId: "search-1" });
    expect(target["mail.search.expire"]).toHaveBeenCalledWith({ searchId: "search-1" });
    expect(() => parseBackgroundJob("mail.search.expire", { searchId: "" })).toThrow();
    const expiresAt = new Date("2026-10-13T12:00:00.000Z");
    expect(mailSearchExpireJob("search-1", expiresAt)).toEqual({
      name: "mail.search.expire",
      payload: { searchId: "search-1" },
      availableAt: expiresAt,
      replaceKey: "mail.search.expire:search-1",
    });
  });

  it("validates inbox.triage and merges repeats for one user in one space under one key", async () => {
    const target = handlers();
    await dispatchBackgroundJob(target, "inbox.triage", { userId: "user-1", spaceId: "space-1" });
    expect(target["inbox.triage"]).toHaveBeenCalledWith({ userId: "user-1", spaceId: "space-1" });
    expect(() => parseBackgroundJob("inbox.triage", { userId: "user-1" })).toThrow();
    expect(() => parseBackgroundJob("inbox.triage", { userId: "", spaceId: "space-1" })).toThrow();
    expect(inboxTriageJob("user-1", "space-1")).toEqual({
      name: "inbox.triage",
      payload: { userId: "user-1", spaceId: "space-1" },
      replaceKey: "inbox.triage:space-1:user-1",
      maxAttempts: 3,
    });
    const later = new Date("2030-01-01T00:00:00Z");
    expect(inboxTriageJob("user-1", "space-1", later).availableAt).toBe(later);
    expect(inboxTriageJob("user-2", "space-1").replaceKey).not.toBe(
      inboxTriageJob("user-1", "space-1").replaceKey,
    );
  });

  it("validates finance.sync and keys one queued job per user and space", async () => {
    const target = handlers();
    await dispatchBackgroundJob(target, "finance.sync", { userId: "user-1", spaceId: "space-1" });
    expect(target["finance.sync"]).toHaveBeenCalledWith({ userId: "user-1", spaceId: "space-1" });
    expect(() => parseBackgroundJob("finance.sync", { userId: "user-1" })).toThrow();
    await dispatchBackgroundJob(target, "dataroom.blob.delete", { spaceId: "s", storageKey: "k" });
    expect(target["dataroom.blob.delete"]).toHaveBeenCalledWith({ spaceId: "s", storageKey: "k" });
    expect(() => parseBackgroundJob("dataroom.blob.delete", { spaceId: "s" })).toThrow();
    expect(financeSyncJob("user-1", "space-1")).toEqual({
      name: "finance.sync",
      payload: { userId: "user-1", spaceId: "space-1" },
      replaceKey: "finance.sync:space-1:user-1",
      maxAttempts: 3,
    });
    expect(financeSyncJob("user-2", "space-1").replaceKey).not.toBe(
      financeSyncJob("user-1", "space-1").replaceKey,
    );
  });

  it("validates and dispatches a typed job", async () => {
    const target = handlers();
    await dispatchBackgroundJob(target, "routine.wakeup", {
      routineId: "routine-1",
      scheduledFor: "2026-08-15T12:00:00.000Z",
    });
    expect(target["routine.wakeup"]).toHaveBeenCalledWith({
      routineId: "routine-1",
      scheduledFor: "2026-08-15T12:00:00.000Z",
    });
  });

  it("rejects unknown names and malformed deliveries", () => {
    expect(() => parseBackgroundJob("unknown", {})).toThrow("Unknown background job");
    expect(() =>
      parseBackgroundJob("routine.wakeup", {
        routineId: "routine-1",
        scheduledFor: "not-a-date",
      }),
    ).toThrow();
    expect(() => parseBackgroundJob("run.continue", { runId: "" })).toThrow();
    expect(() =>
      parseBackgroundJob("computer.control-expire", {
        computerId: "computer-1",
        leaseId: "",
      }),
    ).toThrow();
  });

  it("validates and dispatches a control-expiry job", async () => {
    const target = handlers();
    await dispatchBackgroundJob(target, "computer.control-expire", {
      computerId: "computer-1",
      leaseId: "lease-1",
    });
    expect(target["computer.control-expire"]).toHaveBeenCalledWith({
      computerId: "computer-1",
      leaseId: "lease-1",
    });
  });
});

describe("historyCompactJob", () => {
  it("builds a job with a replace key scoped to the thread", () => {
    expect(historyCompactJob("thread-1")).toEqual({
      name: "history.compact",
      payload: { threadId: "thread-1" },
      replaceKey: historyCompactJobKey("thread-1"),
      maxAttempts: HISTORY_COMPACT_MAX_ATTEMPTS,
    });
  });

  it("caps attempts below the queue default so a stuck thread cannot storm", () => {
    expect(HISTORY_COMPACT_MAX_ATTEMPTS).toBeLessThan(25);
  });

  it("keys different threads differently", () => {
    expect(historyCompactJobKey("thread-1")).not.toBe(historyCompactJobKey("thread-2"));
  });

  it("validates and dispatches the data room pipeline steps, one keyed job per item and step", async () => {
    const target = handlers();
    const scope = { spaceId: "s1", userId: "u1" };
    for (const name of ["dataroom.ingest", "dataroom.classify", "dataroom.index"] as const) {
      const job = dataRoomStepJob(name, scope, "i1");
      expect(job).toEqual({
        name,
        payload: { ...scope, itemId: "i1" },
        replaceKey: `${name}:i1`,
        maxAttempts: 3,
      });
      await dispatchBackgroundJob(target, name, job.payload);
      expect(target[name]).toHaveBeenCalledWith(job.payload);
    }
    expect(() => parseBackgroundJob("dataroom.index", { spaceId: "s1" })).toThrow();
  });
});
