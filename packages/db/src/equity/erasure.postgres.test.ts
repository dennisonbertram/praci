import { afterAll, beforeAll, expect, it } from "vitest";
import {
  claimEmptySpaceDeletionForMember,
  deleteEmptySpaceForMember,
  SpaceHasCapTableError,
} from "../spaces.js";
import type { EquityFixture } from "./test-fixture.js";
import { describeEquityPostgres, equityFixture } from "./test-fixture.js";

describeEquityPostgres("cap table erasure with its space or user (PostgreSQL)", () => {
  let f: EquityFixture;
  let organizationId: string;

  /** A ledger with a holder, a certificate, an option grant, a history row and a linked contact. */
  async function seed(scope: { spaceId: string; userId: string }, tag: string) {
    await f.owner.equityLedger.create({ data: scope });
    const contact = await f.owner.contact.create({ data: { ...scope, name: `Contact ${tag}` } });
    const holder = await f.owner.equityStakeholder.create({
      data: { ...scope, type: "individual", name: `Holder ${tag}`, contactId: contact.id },
    });
    const shareClass = await f.owner.equityShareClass.create({
      data: { ...scope, name: `Common ${tag}`, classType: "common", prefix: "C" },
    });
    const plan = await f.owner.equityPlan.create({
      data: { ...scope, name: `Plan ${tag}`, shareClassId: shareClass.id, reservedShares: 100n },
    });
    await f.owner.equityOptionGrant.create({
      data: {
        ...scope,
        label: `G-${tag}`,
        stakeholderId: holder.id,
        planId: plan.id,
        shareClassId: shareClass.id,
        optionType: "nso",
        quantity: 10n,
        exercisePrice: 0,
        grantDate: new Date("2024-01-01T00:00:00.000Z"),
      },
    });
    const certificate = await f.owner.equityCertificate.create({
      data: {
        ...scope,
        label: `C-${tag}`,
        stakeholderId: holder.id,
        shareClassId: shareClass.id,
        quantity: 1n,
        issueDate: new Date("2024-01-01T00:00:00.000Z"),
      },
    });
    await f.owner.equityTransaction.create({
      data: {
        ...scope,
        kind: "issue",
        effectiveDate: new Date("2024-01-01T00:00:00.000Z"),
        certificateId: certificate.id,
      },
    });
  }

  const rows = (scope: { spaceId: string; userId: string }) =>
    Promise.all([
      f.owner.equityLedger.count({ where: scope }),
      f.owner.equityCertificate.count({ where: scope }),
      f.owner.equityOptionGrant.count({ where: scope }),
      f.owner.equityTransaction.count({ where: scope }),
      f.owner.equityStakeholder.count({ where: scope }),
    ]);

  beforeAll(async () => {
    f = await equityFixture("erasure");
    const space = await f.owner.space.findUniqueOrThrow({
      where: { id: f.mine.spaceId },
      select: { organizationId: true },
    });
    organizationId = space.organizationId;
    const createdAt = new Date();
    await f.owner.member.create({
      data: {
        id: `erasure-member-${process.pid}-${Date.now()}`,
        organizationId,
        userId: f.mine.userId,
        role: "owner",
        createdAt,
      },
    });
    await f.owner.spaceMember.createMany({
      data: [f.mine.spaceId, f.otherSpace.spaceId].map((spaceId, index) => ({
        id: `erasure-space-member-${process.pid}-${index}`,
        spaceId,
        organizationId,
        userId: f.mine.userId,
        role: "owner",
        createdAt,
      })),
    });
  });

  afterAll(async () => {
    await f?.close();
  });

  it("deleting a space is refused while another member's ledger is in it, then removes the deleter's own", async () => {
    await seed(f.mine, "a");
    await seed(f.sameSpace, "b");
    await seed(f.otherSpace, "c");
    const input = {
      currentSpaceId: f.otherSpace.spaceId,
      userId: f.mine.userId,
      spaceId: f.mine.spaceId,
    };
    // Row-level security hides the co-member's ledger from the deleter; the guard must still see it.
    await expect(
      f.as(f.mine, () => f.prisma.equityLedger.count({ where: { spaceId: f.mine.spaceId } })),
    ).resolves.toBe(1);
    await expect(
      f.as(f.mine, () => claimEmptySpaceDeletionForMember(f.prisma, input)),
    ).rejects.toBeInstanceOf(SpaceHasCapTableError);
    expect(await rows(f.sameSpace)).toEqual([1, 1, 1, 1, 1]);

    await f.owner.equityLedger.delete({ where: { spaceId_userId: f.sameSpace } });
    const claim = await f.as(f.mine, () => claimEmptySpaceDeletionForMember(f.prisma, input));
    await f.as(f.mine, () =>
      deleteEmptySpaceForMember(f.prisma, { ...input, claimId: claim.claimId }),
    );

    expect(await rows(f.mine)).toEqual([0, 0, 0, 0, 0]);
    expect(await rows(f.otherSpace)).toEqual([1, 1, 1, 1, 1]);
  });

  it("deleting a contact unlinks its holder instead of being blocked", async () => {
    const scope = f.otherSpace;
    const holder = await f.owner.equityStakeholder.findFirstOrThrow({ where: scope });
    expect(holder.contactId).not.toBeNull();
    await f.owner.contact.delete({ where: { id: holder.contactId as string } });
    const after = await f.owner.equityStakeholder.findUniqueOrThrow({ where: { id: holder.id } });
    expect(after).toMatchObject({ contactId: null, spaceId: scope.spaceId, userId: scope.userId });
  });

  it("deleting the organization and then the user removes the remaining ledger", async () => {
    // The account deletion path: personal organizations first, then the user row.
    await f.owner.organization.deleteMany({ where: { id: organizationId } });
    await f.owner.user.delete({ where: { id: f.mine.userId } });

    expect(await rows(f.otherSpace)).toEqual([0, 0, 0, 0, 0]);
  });
});
