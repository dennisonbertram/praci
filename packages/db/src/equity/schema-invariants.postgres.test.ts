import { afterAll, beforeAll, expect, it } from "vitest";
import { EquityInputError, inTransaction } from "./ledger.js";
import type { EquityFixture } from "./test-fixture.js";
import { describeEquityPostgres, equityFixture } from "./test-fixture.js";

describeEquityPostgres("equity schema invariants (PostgreSQL)", () => {
  let f: EquityFixture;
  let certificateId: string;
  let stakeholderId: string;
  let documentId: string;
  let contactId: string;
  let planId: string;
  let grantId: string;
  let wrongShareClassId: string;

  beforeAll(async () => {
    f = await equityFixture("schema-invariants");
    const other = f.otherSpace;
    await f.owner.equityLedger.createMany({ data: [f.mine, other] });
    const holder = await f.owner.equityStakeholder.create({
      data: { ...other, type: "individual", name: "Other holder" },
    });
    const shareClass = await f.owner.equityShareClass.create({
      data: { ...other, name: "Other common", classType: "common", prefix: "OC" },
    });
    wrongShareClassId = (
      await f.owner.equityShareClass.create({
        data: { ...other, name: "Other preferred", classType: "preferred", prefix: "OP" },
      })
    ).id;
    planId = (
      await f.owner.equityPlan.create({
        data: { ...other, name: "Other plan", shareClassId: shareClass.id, reservedShares: 100n },
      })
    ).id;
    grantId = (
      await f.owner.equityOptionGrant.create({
        data: {
          ...other,
          label: "ES-1",
          stakeholderId: holder.id,
          planId,
          shareClassId: shareClass.id,
          optionType: "nso",
          quantity: 10n,
          exercisedQuantity: 4n,
          canceledQuantity: 5n,
          exercisePrice: 0,
          grantDate: new Date("2024-01-01T00:00:00.000Z"),
        },
      })
    ).id;
    const certificate = await f.owner.equityCertificate.create({
      data: {
        ...other,
        label: "OC-1",
        stakeholderId: holder.id,
        shareClassId: shareClass.id,
        quantity: 1n,
        issueDate: new Date("2024-01-01T00:00:00.000Z"),
      },
    });
    certificateId = certificate.id;
    contactId = (
      await f.owner.contact.create({
        data: { ...f.mine, name: "Synthetic mapped contact" },
      })
    ).id;
    stakeholderId = (
      await f.owner.equityStakeholder.create({
        data: { ...f.mine, type: "individual", name: "Main holder", contactId },
      })
    ).id;
    const item = await f.owner.dataRoomItem.create({
      data: {
        ...other,
        source: "upload",
        sha256: "synthetic-document-hash",
        name: "Other tenant document",
        mimeType: "text/plain",
        size: 1n,
      },
    });
    documentId = item.id;
  });

  afterAll(async () => {
    await f?.close();
  });

  it("rejects negative ledger financials", async () => {
    const { prisma, mine } = f;
    await expect(
      f.owner.equityLedger.update({
        where: { spaceId_userId: f.mine },
        data: { safeBoardApprovedCents: -1n },
      }),
    ).rejects.toMatchObject({ code: "P2039" });
    await expect(
      f.as(mine, () =>
        inTransaction(prisma, (tx) =>
          tx.equityLedger.update({
            where: { spaceId_userId: mine },
            data: { safeBoardApprovedCents: -1n },
          }),
        ),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
  });

  it("rejects vesting cliffs beyond duration and 100 percent discounts", async () => {
    const startDate = new Date("2024-01-01T00:00:00.000Z");
    await expect(
      f.owner.equityVestingTemplate.create({
        data: {
          ...f.mine,
          name: "Invalid cliff template",
          totalMonths: 1,
          cliffMonths: 2,
          frequencyMonths: 1,
        },
      }),
    ).rejects.toMatchObject({ code: "P2039" });
    await expect(
      f.owner.equityVestingSchedule.create({
        data: {
          ...f.mine,
          startDate,
          totalMonths: 1,
          cliffMonths: 2,
          frequencyMonths: 1,
        },
      }),
    ).rejects.toMatchObject({ code: "P2039" });
    await expect(
      f.owner.equityConvertible.create({
        data: {
          ...f.mine,
          label: "SAFE-INVALID-DISCOUNT-1",
          stakeholderId,
          kind: "safe",
          principalCents: 1n,
          issueDate: startDate,
          discountPercent: 100,
        },
      }),
    ).rejects.toMatchObject({ code: "P2039" });
  });

  it("rejects reusing a contact for another stakeholder", async () => {
    await expect(
      f.owner.equityStakeholder.create({
        data: {
          ...f.mine,
          type: "individual",
          name: "Second holder",
          contactId,
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("rejects option grants with a different plan class and unbalanced counters", async () => {
    await expect(
      f.owner.equityOptionGrant.create({
        data: {
          ...f.otherSpace,
          label: "ES-2",
          stakeholderId: (
            await f.owner.equityStakeholder.findFirstOrThrow({
              where: { ...f.otherSpace, name: "Other holder" },
              select: { id: true },
            })
          ).id,
          planId,
          shareClassId: wrongShareClassId,
          optionType: "nso",
          quantity: 10n,
          exercisePrice: 0,
          grantDate: new Date("2024-01-01T00:00:00.000Z"),
        },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
    await expect(
      f.owner.equityOptionGrant.update({
        where: { id: grantId },
        data: { canceledQuantity: 7n },
      }),
    ).rejects.toMatchObject({ code: "P2039" });
  });

  it("rejects cross-tenant transaction and document targets", async () => {
    await expect(
      f.owner.equityTransaction.create({
        data: {
          ...f.mine,
          kind: "issue",
          effectiveDate: new Date("2024-01-01T00:00:00.000Z"),
          certificateId,
        },
      }),
    ).rejects.toMatchObject({ code: "P2003" });

    await expect(
      f.owner.equityDocumentLink.create({
        data: {
          ...f.mine,
          dataRoomItemId: documentId,
          stakeholderId,
        },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });

  it("accepts a document link to a same-tenant target", async () => {
    const item = await f.owner.dataRoomItem.create({
      data: {
        ...f.mine,
        source: "upload",
        sha256: "synthetic-main-document-hash",
        name: "Main tenant document",
        mimeType: "text/plain",
        size: 1n,
      },
    });
    await expect(
      f.owner.equityDocumentLink.create({
        data: { ...f.mine, dataRoomItemId: item.id, stakeholderId },
      }),
    ).resolves.toMatchObject({ dataRoomItemId: item.id, stakeholderId });
  });

  it("keeps exercise and access-grant indexes tenant-leading", async () => {
    const indexes = await f.owner.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'equity_exercises_spaceId_userId_exerciseDate_id_idx',
          'equity_access_grants_spaceId_userId_idx'
        )
    `;

    const exerciseIndex = indexes.find(
      ({ indexname }) => indexname === "equity_exercises_spaceId_userId_exerciseDate_id_idx",
    );
    const accessGrantIndex = indexes.find(
      ({ indexname }) => indexname === "equity_access_grants_spaceId_userId_idx",
    );
    expect(exerciseIndex?.indexdef).toMatch(
      /\("spaceId",\s*"userId",\s*"exerciseDate",\s*"?id"?\)/,
    );
    expect(accessGrantIndex?.indexdef).toMatch(/\("spaceId",\s*"userId"\)/);
  });
});
