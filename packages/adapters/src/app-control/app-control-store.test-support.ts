import type { AppControlScope, AppControlStore } from "@rakazo/adapter-kit";
import { describe, expect, it } from "vitest";

export interface AppControlStoreContractIds {
  space: string;
  otherSpace: string;
  user: string;
  bot: string;
}
const row = { snapshotId: "s1", appId: "app", surface: "window" as const, sensitive: false };

/** The behavior every AppControlStore must have; the Postgres store runs this too. */
export function appControlStoreContract(
  name: string,
  makeStore: () => AppControlStore | Promise<AppControlStore>,
  /** Ids the scopes use; a store with foreign keys passes ids of rows that exist. */
  ids: AppControlStoreContractIds = {
    space: "space",
    otherSpace: "space2",
    user: "user",
    bot: "bot",
  },
) {
  const scope = (runId = "run1", spaceId = ids.space): AppControlScope => ({
    spaceId,
    userId: ids.user,
    botId: ids.bot,
    runId,
  });
  describe(`${name} contract`, () => {
    it("records, reads and finds the latest snapshot of an app", async () => {
      const store = await makeStore();
      await store.record(scope(), row);
      await store.record(scope(), { ...row, snapshotId: "s2" });
      await store.record(scope(), { ...row, snapshotId: "s3", appId: "other" });
      expect(await store.get(scope(), "s1")).toMatchObject({ snapshotId: "s1", spent: false });
      expect((await store.latest(scope(), "app"))?.snapshotId).toBe("s2");
      expect(await store.latest(scope(), "none")).toBeUndefined();
    });

    it("upserts by scope and snapshot id without un-spending or un-flagging", async () => {
      const store = await makeStore();
      await store.record(scope(), { ...row, sensitive: true });
      await store.markSpent(scope(), "s1");
      await store.record(scope(), { ...row, sensitive: false, windowId: "w1" });
      expect(await store.get(scope(), "s1")).toMatchObject({
        spent: true,
        sensitive: true,
        windowId: "w1",
      });
    });

    it("isolates scopes", async () => {
      const store = await makeStore();
      await store.record(scope("run1"), row);
      expect(await store.get(scope("run2"), "s1")).toBeUndefined();
      expect(await store.get(scope("run1", ids.otherSpace), "s1")).toBeUndefined();
      await store.record(scope("run2"), row);
      await store.markSpent(scope("run2"), "s1");
      expect(await store.get(scope("run1"), "s1")).toMatchObject({ spent: false });
    });

    it("clears only the given run", async () => {
      const store = await makeStore();
      await store.record(scope("run1"), row);
      await store.record(scope("run2"), row);
      await store.clearRun(scope("run1"));
      expect(await store.get(scope("run1"), "s1")).toBeUndefined();
      expect(await store.get(scope("run2"), "s1")).toBeDefined();
    });
  });
}
