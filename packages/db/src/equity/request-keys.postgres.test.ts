import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "../client.js";
import {
  claimShareRequest,
  completeShareRequest,
  releaseShareRequest,
  SHARE_CLAIM_STALE_MS,
  ShareRequestConflictError,
} from "../investor-portal.js";
import { EquityConflictError } from "./ledger.js";
import { createEquityOptionGrant } from "./options.js";
import { createEquityWarrant } from "./options-warrants.js";
import {
  createEquityCertificate,
  createEquityConvertible,
  createEquityConvertibleBlock,
} from "./securities.js";
import { transferEquityCertificate } from "./securities-transactions.js";
import { createEquityStakeholder } from "./stakeholders.js";
import type { EquityFixture } from "./test-fixture.js";
import {
  barrierAtEquityLedgerLock,
  describeEquityPostgres,
  equityFixture,
} from "./test-fixture.js";

describeEquityPostgres("equity create idempotency keys (PostgreSQL)", () => {
  let f: EquityFixture;
  let stakeholderId: string;
  let otherId: string;
  let shareClassId: string;
  let planId: string;
  let sourceId: string;

  beforeEach(async () => {
    f = await equityFixture("request-keys");
    const scope = { spaceId: f.mine.spaceId, userId: f.mine.userId };
    await f.owner.equityLedger.create({ data: scope });
    stakeholderId = (
      await f.owner.equityStakeholder.create({
        data: { ...scope, type: "individual", name: "Ada Example" },
      })
    ).id;
    otherId = (
      await f.owner.equityStakeholder.create({
        data: { ...scope, type: "individual", name: "Ben Example" },
      })
    ).id;
    shareClassId = (
      await f.owner.equityShareClass.create({
        data: { ...scope, name: "Common", classType: "common", prefix: "CS" },
      })
    ).id;
    await f.owner.equityShareClassVersion.create({
      data: {
        ...scope,
        shareClassId,
        documentDate: new Date("2024-01-01T00:00:00.000Z"),
        authorizedShares: 1_000_000n,
      },
    });
    planId = (
      await f.owner.equityPlan.create({
        data: { ...scope, name: "2024 Plan", shareClassId, reservedShares: 100_000n },
      })
    ).id;
    sourceId = (
      await f.owner.equityCertificate.create({
        data: {
          ...scope,
          label: "CS-SRC",
          stakeholderId,
          shareClassId,
          quantity: 100n,
          issueDate: new Date("2024-01-01T00:00:00.000Z"),
        },
      })
    ).id;
  });

  afterEach(async () => {
    await f?.close();
  });

  type Case = {
    run: (requestKey: string, changed?: boolean, db?: PrismaClient) => Promise<{ id?: string }>;
    count: (requestKey: string) => Promise<number>;
  };
  const where = (requestKey: string) => ({
    spaceId: f.mine.spaceId,
    userId: f.mine.userId,
    requestKey,
  });

  const cases = (): Record<string, Case> => ({
    certificate: {
      run: (requestKey, changed, db = f.prisma) =>
        f.as(f.mine, () =>
          createEquityCertificate(db, f.mine, {
            requestKey,
            stakeholderId,
            shareClassId,
            quantity: changed ? "11" : "10",
            issueDate: "2024-02-01",
          }),
        ),
      count: (requestKey) => f.owner.equityCertificate.count({ where: where(requestKey) }),
    },
    "option grant": {
      run: (requestKey, changed, db = f.prisma) =>
        f.as(f.mine, () =>
          createEquityOptionGrant(db, f.mine, {
            requestKey,
            stakeholderId,
            planId,
            optionType: "iso",
            quantity: changed ? "11" : "10",
            exercisePrice: "0.1",
            grantDate: "2024-02-01",
          }),
        ),
      count: (requestKey) => f.owner.equityOptionGrant.count({ where: where(requestKey) }),
    },
    "convertible block": {
      run: (requestKey, changed, db = f.prisma) =>
        f.as(f.mine, () =>
          createEquityConvertibleBlock(db, f.mine, {
            requestKey,
            name: changed ? "Seed terms B" : "Seed terms",
            kind: "safe",
          }),
        ),
      count: (requestKey) => f.owner.equityConvertibleBlock.count({ where: where(requestKey) }),
    },
    convertible: {
      run: (requestKey, changed, db = f.prisma) =>
        f.as(f.mine, () =>
          createEquityConvertible(db, f.mine, {
            requestKey,
            stakeholderId,
            kind: "safe",
            principalCents: changed ? "20000" : "10000",
            issueDate: "2024-02-01",
          }),
        ),
      count: (requestKey) => f.owner.equityConvertible.count({ where: where(requestKey) }),
    },
    warrant: {
      run: (requestKey, changed, db = f.prisma) =>
        f.as(f.mine, () =>
          createEquityWarrant(db, f.mine, {
            requestKey,
            stakeholderId,
            shareClassId,
            quantity: changed ? "11" : "10",
            exercisePrice: "0.1",
            issueDate: "2024-02-01",
          }),
        ),
      count: (requestKey) => f.owner.equityWarrant.count({ where: where(requestKey) }),
    },
    stakeholder: {
      run: (requestKey, changed, db = f.prisma) =>
        f.as(f.mine, () =>
          createEquityStakeholder(db, f.mine, {
            requestKey,
            type: "individual",
            name: changed ? "Cy Example" : "Cy Retry",
          }),
        ),
      count: (requestKey) => f.owner.equityStakeholder.count({ where: where(requestKey) }),
    },
    transfer: {
      // The first transfer closes the source, so a replay must not need it to be outstanding.
      run: async (requestKey, changed, db = f.prisma) => {
        const result = await f.as(f.mine, () =>
          transferEquityCertificate(db, f.mine, {
            requestKey,
            certificateId: sourceId,
            toStakeholderId: otherId,
            quantity: changed ? "50" : "100",
            effectiveDate: "2024-03-01",
            reason: "gift",
          }),
        );
        return { id: result.transactionId };
      },
      count: (requestKey) => f.owner.equityTransaction.count({ where: where(requestKey) }),
    },
  });

  for (const name of Object.keys(cases())) {
    it(`${name}: a sequential retry with the same key replays the first create`, async () => {
      const c = cases()[name]!;
      const key = randomUUID();
      const first = await c.run(key);
      const again = await c.run(key);
      expect(again.id).toBe(first.id);
      expect(await c.count(key)).toBe(1);
    });

    it(`${name}: concurrent calls with the same key create one record`, async () => {
      const c = cases()[name]!;
      const key = randomUUID();
      // Both callers wait at the ledger lock, so the race is real rather than timing luck.
      const db = barrierAtEquityLedgerLock(f.prisma, 2);
      const [a, b] = await Promise.all([c.run(key, false, db), c.run(key, false, db)]);
      expect(a.id).toBe(b.id);
      expect(await c.count(key)).toBe(1);
    });

    it(`${name}: the same key with different terms is rejected`, async () => {
      const c = cases()[name]!;
      const key = randomUUID();
      await c.run(key);
      await expect(c.run(key, true)).rejects.toBeInstanceOf(EquityConflictError);
      expect(await c.count(key)).toBe(1);
    });
  }
  describe("document delivery", () => {
    const delivery = (requestKey: string, emailLink = true, contactIds = ["c1", "c2"]) => ({
      itemIds: ["item-1"],
      contactIds,
      emailLink,
      requestKey,
    });

    const claim = (key: string, d = delivery(key), at?: Date) =>
      f.as(f.mine, () => claimShareRequest(f.prisma, f.mine, d, at));
    const complete = (key: string) =>
      f.as(f.mine, () => completeShareRequest(f.prisma, f.mine, key));

    it("replays a completed delivery as delivered, whatever the contact order", async () => {
      const key = randomUUID();
      expect(await claim(key)).toBe("claimed");
      await complete(key);
      expect(await claim(key, delivery(key, true, ["c2", "c1"]))).toBe("delivered");
    });

    it("answers in progress, not delivered, while the first call has not completed", async () => {
      const key = randomUUID();
      expect(await claim(key)).toBe("claimed");
      await expect(claim(key)).rejects.toThrow("already in progress");
    });

    it("claims once when two requests race", async () => {
      const key = randomUUID();
      const results = await Promise.allSettled([claim(key), claim(key)]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    });

    it("rejects the same key with different terms", async () => {
      const key = randomUUID();
      await claim(key);
      await expect(claim(key, delivery(key, false))).rejects.toBeInstanceOf(
        ShareRequestConflictError,
      );
    });

    it("lets a retry deliver after a failed delivery released the key", async () => {
      const key = randomUUID();
      await claim(key);
      await f.as(f.mine, () => releaseShareRequest(f.prisma, f.mine, key));
      expect(await claim(key)).toBe("claimed");
    });

    it("lets a retry retake a claim whose process died before completing", async () => {
      const key = randomUUID();
      await claim(key);
      const later = new Date(Date.now() + SHARE_CLAIM_STALE_MS + 1000);
      expect(await claim(key, delivery(key), later)).toBe("claimed");
      // The retaken claim is fresh again, so a third call waits.
      await expect(claim(key, delivery(key), later)).rejects.toThrow("already in progress");
    });

    it("scopes keys to the user: another user may reuse the same key", async () => {
      const key = randomUUID();
      await f.as(f.mine, () => claimShareRequest(f.prisma, f.mine, delivery(key)));
      expect(
        await f.as(f.sameSpace, () => claimShareRequest(f.prisma, f.sameSpace, delivery(key))),
      ).toBe("claimed");
    });
  });
});
