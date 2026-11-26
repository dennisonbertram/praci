import { EquityIssueDraftSetResultSchema } from "@rakazo/contracts";
import { afterAll, beforeAll, expect, it } from "vitest";
import { IsolationError } from "../scope.js";
import { EquityConflictError, EquityInputError } from "./ledger.js";
import { issueEquityOptionDraftSet } from "./options-drafts.js";
import { createEquityDraftSet } from "./rounds.js";
import type { EquityFixture } from "./test-fixture.js";
import {
  barrierAtEquityLedgerLock,
  describeEquityPostgres,
  equityFixture,
} from "./test-fixture.js";

describeEquityPostgres("option draft-set issuing (PostgreSQL)", () => {
  let f: EquityFixture;
  let planId: string;
  let stakeholderId: string;
  let shareClassId: string;
  const grantIds: string[] = [];

  const set = (
    name: string,
    items: Record<string, unknown>[],
    securityKind: "option_grant" | "certificate" = "option_grant",
  ) => f.as(f.mine, () => createEquityDraftSet(f.prisma, f.mine, { name, securityKind, items }));

  const item = (label: string | undefined, quantity = "1000") => ({
    ...(label === undefined ? {} : { label }),
    stakeholderId,
    planId,
    optionType: "iso",
    quantity,
    exercisePrice: "0.25",
    grantDate: "2024-03-01",
  });
  const autoLabelItem = (quantity = "1000") => item(undefined, quantity);

  beforeAll(async () => {
    f = await equityFixture("options-drafts");
    const { owner, mine } = f;
    const scope = { spaceId: mine.spaceId, userId: mine.userId };
    await owner.equityLedger.create({ data: scope });
    const stakeholder = await owner.equityStakeholder.create({
      data: { ...scope, type: "individual", name: "Ada Example" },
    });
    stakeholderId = stakeholder.id;
    const shareClass = await owner.equityShareClass.create({
      data: { ...scope, name: "Common", classType: "common", prefix: "C" },
    });
    const plan = await owner.equityPlan.create({
      data: { ...scope, name: "2024 Plan", shareClassId: shareClass.id, reservedShares: 50_000n },
    });
    planId = plan.id;
    shareClassId = shareClass.id;
  });

  afterAll(async () => {
    await f?.close();
  });

  it("issues every grant once across concurrent calls and retries", async () => {
    const { prisma, mine, owner } = f;
    const draft = await set("First batch", [autoLabelItem("1000"), autoLabelItem("2000")]);
    const interleaved = barrierAtEquityLedgerLock(prisma);
    const [result, retry] = await Promise.all([
      f.as(mine, () =>
        issueEquityOptionDraftSet(interleaved, mine, {
          id: draft.id,
          expectedRevision: draft.revision,
        }),
      ),
      f.as(mine, () =>
        issueEquityOptionDraftSet(interleaved, mine, {
          id: draft.id,
          expectedRevision: draft.revision,
        }),
      ),
    ]);
    EquityIssueDraftSetResultSchema.parse(result);
    expect(result.draftSetId).toBe(draft.id);
    expect(result.grants.map((grant) => grant.quantity)).toEqual(["1000", "2000"]);
    expect(result.grants.every((grant) => grant.label.length > 0)).toBe(true);
    expect(new Set(result.grants.map((grant) => grant.label)).size).toBe(2);
    expect(retry.grants.map((grant) => grant.id)).toEqual(result.grants.map((grant) => grant.id));
    grantIds.push(...result.grants.map((grant) => grant.id));
    const after = await owner.equityDraftSet.findUniqueOrThrow({ where: { id: draft.id } });
    expect(after.status).toBe("issued");
    expect(after.issuedIds).toEqual(result.grants.map((grant) => grant.id));
    expect(after.issuedAt).toBeInstanceOf(Date);
    const kinds = await owner.equityTransaction.findMany({
      where: { optionGrantId: { in: grantIds } },
      select: { kind: true },
    });
    expect(kinds).toHaveLength(2);
    expect(kinds.every((row) => row.kind === "issue")).toBe(true);
    const sequentialRetry = await f.as(mine, () =>
      issueEquityOptionDraftSet(prisma, mine, { id: draft.id, expectedRevision: draft.revision }),
    );
    expect(sequentialRetry.grants.map((grant) => grant.id)).toEqual(after.issuedIds);
  });

  it("rolls the whole set back when one item is invalid", async () => {
    const { prisma, mine, owner } = f;
    const draft = await set("Broken batch", [
      item("RB-1", "1000"),
      { ...item("RB-2", "1000"), stakeholderId: "missing-stakeholder" },
    ]);
    await expect(
      f.as(mine, () =>
        issueEquityOptionDraftSet(prisma, mine, { id: draft.id, expectedRevision: draft.revision }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    const grants = await owner.equityOptionGrant.count({
      where: { spaceId: mine.spaceId, userId: mine.userId, label: { startsWith: "RB-" } },
    });
    expect(grants).toBe(0);
    const after = await owner.equityDraftSet.findUniqueOrThrow({ where: { id: draft.id } });
    expect(after.status).toBe("draft");
    expect(after.issuedAt).toBeNull();
  });

  it("refuses to issue the same set twice, an empty set and a set of another kind", async () => {
    const { prisma, mine, owner } = f;
    await expect(
      f.as(mine, () =>
        issueEquityOptionDraftSet(prisma, mine, { id: grantIds[0]!, expectedRevision: 1 }),
      ),
    ).rejects.toBeInstanceOf(IsolationError);
    const issued = await owner.equityDraftSet.findFirstOrThrow({
      where: { spaceId: mine.spaceId, status: "issued" },
    });
    const replay = await f.as(mine, () =>
      issueEquityOptionDraftSet(prisma, mine, { id: issued.id, expectedRevision: issued.revision }),
    );
    expect(replay.grants.map((grant) => grant.id)).toEqual(issued.issuedIds);
    const empty = await set("Empty", []);
    await expect(
      f.as(mine, () =>
        issueEquityOptionDraftSet(prisma, mine, { id: empty.id, expectedRevision: empty.revision }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    const other = await set(
      "Certificates",
      [{ stakeholderId, shareClassId, quantity: "1000", issueDate: "2024-03-01" }],
      "certificate",
    );
    await expect(
      f.as(mine, () =>
        issueEquityOptionDraftSet(prisma, mine, { id: other.id, expectedRevision: other.revision }),
      ),
    ).rejects.toBeInstanceOf(EquityConflictError);
  });

  it("keeps another user and another space out", async () => {
    const { prisma, mine, owner, sameSpace, otherSpace } = f;
    const draft = await set("Private batch", [item("PV-1")]);
    for (const scope of [sameSpace, otherSpace]) {
      await expect(
        f.as(scope, () =>
          issueEquityOptionDraftSet(prisma, scope, {
            id: draft.id,
            expectedRevision: draft.revision,
          }),
        ),
      ).rejects.toBeInstanceOf(IsolationError);
    }
    const after = await owner.equityDraftSet.findUniqueOrThrow({ where: { id: draft.id } });
    expect(after.status).toBe("draft");
    const issued = await f.as(mine, () =>
      issueEquityOptionDraftSet(prisma, mine, { id: draft.id, expectedRevision: draft.revision }),
    );
    expect(issued.grants).toHaveLength(1);
  });

  it("fails closed when an issued legacy option set has no replay IDs", async () => {
    const { prisma, mine, owner } = f;
    const draft = await set("Legacy issue", [item("LG-1", "1000")]);
    await owner.equityDraftSet.update({
      where: { id: draft.id },
      data: { status: "issued", issuedAt: new Date(), issuedIds: [] },
    });
    await expect(
      f.as(mine, () =>
        issueEquityOptionDraftSet(prisma, mine, {
          id: draft.id,
          expectedRevision: draft.revision,
        }),
      ),
    ).rejects.toBeInstanceOf(EquityConflictError);
    expect(
      await owner.equityOptionGrant.count({
        where: { ...mine, label: { startsWith: "LG-1" } },
      }),
    ).toBe(0);
  });
});
