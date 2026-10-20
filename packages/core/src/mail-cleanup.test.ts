import type { CleanupSender } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import {
  type CleanupCandidate,
  cleanupChoiceCounts,
  cleanupTargets,
  isCleanupPreselected,
  rankCleanupSenders,
  senderKey,
} from "./mail-cleanup.js";

const base: CleanupCandidate = {
  messageCount: 5,
  readCount: 0,
  bulk: true,
  newestPile: "newsletters",
  priorContact: false,
  mark: null,
  spamLike: false,
  skipInbox: false,
};
const pick = (patch: Partial<CleanupCandidate> = {}) => isCleanupPreselected({ ...base, ...patch });

describe("isCleanupPreselected", () => {
  it("preselects a bulk, rarely read, never-contacted sender", () => {
    expect(pick()).toBe(true);
  });

  it.each([
    ["fewer than 3 messages", { messageCount: 2 }],
    ["exactly 20% read", { readCount: 1 }],
    ["a prior contact", { priorContact: true }],
    ["an unchecked prior contact", { priorContact: null }],
    ["an important mark", { mark: "important" as const }],
    ["spam-like mail", { spamLike: true }],
    ["a sender already skipping the inbox", { skipInbox: true }],
    ["a sender that is not bulk", { bulk: false, newestPile: "important" as const }],
  ])("does not preselect %s", (_name, patch) => {
    expect(pick(patch)).toBe(false);
  });

  it("is bulk through the newest pile when the stat is not", () => {
    expect(pick({ bulk: false, newestPile: "updates" })).toBe(true);
    expect(pick({ bulk: false, newestPile: "newsletters" })).toBe(true);
    expect(pick({ bulk: false, newestPile: null })).toBe(false);
  });

  it("keeps a noise mark preselected", () => {
    expect(pick({ mark: "noise" })).toBe(true);
  });
});

const sender = (patch: Partial<CleanupSender>): CleanupSender => ({
  connectionId: "c1",
  address: "a@example.test",
  name: "A",
  messageCount: 10,
  readCount: 0,
  lastReceivedAt: null,
  inboxThreads: 4,
  preselected: false,
  spamLike: false,
  unsubscribe: "link",
  skipInbox: false,
  unsubscribeStatus: null,
  ...patch,
});

describe("rankCleanupSenders", () => {
  it("orders by unopened mail, then volume, then address", () => {
    const list = [
      sender({ address: "z@example.test", messageCount: 10, readCount: 5 }),
      sender({ address: "b@example.test", messageCount: 8, readCount: 0 }),
      sender({ address: "a@example.test", messageCount: 8, readCount: 0 }),
      sender({ address: "big@example.test", messageCount: 20, readCount: 12 }),
      sender({ address: "all@example.test", messageCount: 12, readCount: 0 }),
    ];
    expect(rankCleanupSenders(list).map((s) => s.address)).toEqual([
      "all@example.test",
      "big@example.test",
      "a@example.test",
      "b@example.test",
      "z@example.test",
    ]);
  });
});

describe("cleanupChoiceCounts", () => {
  const list = [
    sender({ address: "a@example.test", inboxThreads: 3, unsubscribe: "one_click" }),
    sender({ address: "b@example.test", inboxThreads: 5, unsubscribe: "none" }),
    sender({ address: "c@example.test", inboxThreads: 7, unsubscribe: "refused", spamLike: true }),
    sender({ address: "d@example.test", inboxThreads: 2, unsubscribe: "mailto" }),
  ];
  const all = new Set(list.map((s) => senderKey(s.connectionId, s.address)));

  it("counts conversations per choice and leaves spam-like senders out of skip and unsubscribe", () => {
    expect(cleanupChoiceCounts(list, all)).toEqual({
      archive: 17,
      skip_inbox: 10,
      unsubscribe: 5,
      spam: 17,
    });
  });

  it("counts only the selected senders", () => {
    expect(cleanupChoiceCounts(list, new Set([senderKey("c1", "a@example.test")]))).toEqual({
      archive: 3,
      skip_inbox: 3,
      unsubscribe: 3,
      spam: 3,
    });
    expect(cleanupChoiceCounts(list, new Set())).toEqual({
      archive: 0,
      skip_inbox: 0,
      unsubscribe: 0,
      spam: 0,
    });
  });
});

describe("cleanupTargets", () => {
  const list = [
    sender({ address: "a@example.test", unsubscribe: "link" }),
    sender({ address: "b@example.test", unsubscribe: "none" }),
    sender({ address: "c@example.test", unsubscribe: "refused", spamLike: true }),
  ];
  const all = new Set(list.map((s) => senderKey(s.connectionId, s.address)));
  const names = (kind: Parameters<typeof cleanupTargets>[0]) =>
    cleanupTargets(kind, list, all).map((s) => s.address);

  it("leaves out the senders a choice cannot apply to", () => {
    expect(names("archive")).toEqual(["a@example.test", "b@example.test", "c@example.test"]);
    expect(names("spam")).toHaveLength(3);
    expect(names("skip_inbox")).toEqual(["a@example.test", "b@example.test"]);
    expect(names("unsubscribe")).toEqual(["a@example.test"]);
  });
});
