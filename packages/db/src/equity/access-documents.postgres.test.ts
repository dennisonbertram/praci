import { EquityDocumentLinkSchema } from "@rakazo/contracts";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  createEquityDocumentLink,
  deleteEquityDocumentLink,
  listEquityDocumentLinks,
} from "./access-documents.js";
import { createEquityStakeholder } from "./stakeholders.js";
import type { EquityFixture } from "./test-fixture.js";
import { describeEquityPostgres, equityFixture } from "./test-fixture.js";

describeEquityPostgres("equity document links (PostgreSQL)", () => {
  let f: EquityFixture;
  const ids = { holder: "", round: "", doc: "", notes: "", foreignDoc: "", foreignHolder: "" };
  beforeAll(async () => {
    f = await equityFixture("access-documents");
    const { prisma, mine, otherSpace, owner } = f;
    ids.holder = (
      await f.as(mine, () =>
        createEquityStakeholder(prisma, mine, { type: "individual", name: "Ann Holder" }),
      )
    ).id;
    ids.foreignHolder = (
      await f.as(otherSpace, () =>
        createEquityStakeholder(prisma, otherSpace, { type: "individual", name: "Eve Elsewhere" }),
      )
    ).id;
    ids.round = (
      await owner.equityFundingRound.create({
        data: { ...mine, name: "Seed", startDate: new Date("2024-01-01T00:00:00.000Z") },
      })
    ).id;
    const doc = (scope: typeof mine, name: string, source = "upload") =>
      owner.dataRoomItem.create({
        data: {
          ...scope,
          name,
          source,
          mimeType: "application/pdf",
          size: 10n,
          storageKey: `k/${name}`,
          sha256: "0".repeat(64),
        },
      });
    ids.doc = (await doc(mine, "Stock purchase agreement.pdf")).id;
    ids.notes = (await doc(mine, "Board call notes", "meeting")).id;
    ids.foreignDoc = (await doc(otherSpace, "Their letter.pdf")).id;
  });
  afterAll(async () => {
    await f?.close();
  });

  it("attaches a document to a stakeholder and a round, once each, and detaches it", async () => {
    const { prisma, mine } = f;
    const link = await f.as(mine, () =>
      createEquityDocumentLink(prisma, mine, {
        dataRoomItemId: ids.doc,
        target: { kind: "stakeholder", id: ids.holder },
      }),
    );
    expect(EquityDocumentLinkSchema.parse(link)).toMatchObject({
      name: "Stock purchase agreement.pdf",
      targetLabel: "Ann Holder",
    });
    const again = await f.as(mine, () =>
      createEquityDocumentLink(prisma, mine, {
        dataRoomItemId: ids.doc,
        target: { kind: "stakeholder", id: ids.holder },
      }),
    );
    expect(again.id).toBe(link.id);
    await f.as(mine, () =>
      createEquityDocumentLink(prisma, mine, {
        dataRoomItemId: ids.doc,
        target: { kind: "round", id: ids.round },
      }),
    );
    const all = await f.as(mine, () => listEquityDocumentLinks(prisma, mine, {}));
    expect(all.map((row) => row.targetLabel).sort()).toEqual(["Ann Holder", "Seed"]);
    const forHolder = await f.as(mine, () =>
      listEquityDocumentLinks(prisma, mine, { target: { kind: "stakeholder", id: ids.holder } }),
    );
    expect(forHolder).toHaveLength(1);
    await f.as(mine, () => deleteEquityDocumentLink(prisma, mine, link.id));
    expect(await f.as(mine, () => listEquityDocumentLinks(prisma, mine, {}))).toHaveLength(1);
  });

  it("keeps one link under concurrent attaches, and survives deleting the document", async () => {
    const { prisma, mine, owner } = f;
    const item = await owner.dataRoomItem.create({
      data: {
        ...mine,
        name: "Side letter.pdf",
        source: "upload",
        mimeType: "application/pdf",
        size: 10n,
        storageKey: "k/side-letter",
        sha256: "1".repeat(64),
      },
    });
    // The ledger lock queues the two attaches; the second finds the first link and adds nothing.
    const attach = () =>
      f.as(mine, () =>
        createEquityDocumentLink(prisma, mine, {
          dataRoomItemId: item.id,
          target: { kind: "stakeholder", id: ids.holder },
        }),
      );
    const [a, b] = await Promise.all([attach(), attach()]);
    expect(a.id).toBe(b.id);
    expect(await owner.equityDocumentLink.count({ where: { dataRoomItemId: item.id } })).toBe(1);
    await owner.dataRoomItem.delete({ where: { id: item.id } });
    expect(await owner.equityDocumentLink.count({ where: { dataRoomItemId: item.id } })).toBe(0);
  });

  it("unlinks the holder when the investor contact is deleted", async () => {
    const { mine, owner } = f;
    const contact = await owner.contact.create({
      data: { ...mine, name: "Ann Contact", kind: "investor" },
    });
    await owner.equityStakeholder.update({
      where: { id: ids.holder },
      data: { contactId: contact.id },
    });
    await owner.contact.delete({ where: { id: contact.id } });
    expect(
      await owner.equityStakeholder.findUniqueOrThrow({ where: { id: ids.holder } }),
    ).toMatchObject({ contactId: null, spaceId: mine.spaceId, userId: mine.userId });
  });

  it("refuses meeting notes, unknown targets and another space's documents or holders", async () => {
    const { prisma, mine } = f;
    const attach = (
      dataRoomItemId: string,
      id: string,
      kind: "stakeholder" | "certificate" = "stakeholder",
    ) =>
      f.as(mine, () =>
        createEquityDocumentLink(prisma, mine, { dataRoomItemId, target: { kind, id } }),
      );
    await expect(attach(ids.notes, ids.holder)).rejects.toThrow(/Unknown document/);
    await expect(attach(ids.foreignDoc, ids.holder)).rejects.toThrow(/Unknown document/);
    await expect(attach(ids.doc, ids.foreignHolder)).rejects.toThrow(/Unknown stakeholder/);
    await expect(attach(ids.doc, ids.holder, "certificate")).rejects.toThrow(/Unknown certificate/);
  });

  it("another user or space cannot list, attach to or delete the links", async () => {
    const { prisma, mine, sameSpace, otherSpace } = f;
    const [link] = await f.as(mine, () => listEquityDocumentLinks(prisma, mine, {}));
    for (const scope of [sameSpace, otherSpace]) {
      expect(await f.as(scope, () => listEquityDocumentLinks(prisma, scope, {}))).toEqual([]);
      await expect(
        f.as(scope, () =>
          createEquityDocumentLink(prisma, scope, {
            dataRoomItemId: ids.doc,
            target: { kind: "round", id: ids.round },
          }),
        ),
      ).rejects.toThrow(/Unknown/);
      await expect(
        f.as(scope, () => deleteEquityDocumentLink(prisma, scope, link!.id)),
      ).rejects.toThrow(/not found/i);
    }
    expect(await f.as(mine, () => listEquityDocumentLinks(prisma, mine, {}))).toHaveLength(1);
  });
});
