import { afterAll, beforeAll, expect, it } from "vitest";
import { IsolationError } from "../scope.js";
import { EquityConflictError, EquityInputError } from "./ledger.js";
import { createEquityWarrant } from "./options-warrants.js";
import { createEquityCertificate } from "./securities.js";
import {
  createEquityCustomProperty,
  createEquityStakeholder,
  getEquityStakeholder,
  listEquityStakeholders,
} from "./stakeholders.js";
import {
  bulkCreateEquityStakeholders,
  bulkUpdateEquityStakeholders,
  deleteEquityCustomProperty,
  mergeEquityStakeholders,
  terminateEquityStakeholders,
} from "./stakeholders-actions.js";
import type { EquityFixture } from "./test-fixture.js";
import {
  barrierAtFirstRead,
  describeEquityPostgres,
  equityFixture,
  hookFirstRead,
  waitForLockWaiter,
} from "./test-fixture.js";

describeEquityPostgres("equity stakeholder actions (PostgreSQL)", () => {
  let f: EquityFixture;
  beforeAll(async () => {
    f = await equityFixture("stakeholder-actions");
  });
  afterAll(async () => {
    await f?.close();
  });

  const person = (name: string, relationship?: string) =>
    f.as(f.mine, () =>
      createEquityStakeholder(f.prisma, f.mine, {
        type: "individual",
        name,
        properties: relationship
          ? [
              {
                kind: "relationship",
                effectiveDate: "2024-01-01",
                value: relationship as "employee",
              },
            ]
          : [],
      }),
    );

  it("adds a batch, and refuses the whole batch on one bad row", async () => {
    const { prisma, mine } = f;
    const added = await f.as(mine, () =>
      bulkCreateEquityStakeholders(prisma, mine, {
        rows: [
          { type: "individual", name: "Batch One" },
          { type: "organization", name: "Batch Fund" },
        ],
      }),
    );
    expect(added.items.map((row) => row.name)).toEqual(["Batch One", "Batch Fund"]);
    await expect(
      f.as(mine, () =>
        bulkCreateEquityStakeholders(prisma, mine, {
          rows: [
            { type: "individual", name: "Never Saved" },
            { type: "individual", name: "Bad Parent", parentId: "missing-parent-id" },
          ],
        }),
      ),
    ).rejects.toThrow(/Row 2/);
    const count = await f.owner.equityStakeholder.count({ where: { name: "Never Saved" } });
    expect(count).toBe(0);

    const updated = await f.as(mine, () =>
      bulkUpdateEquityStakeholders(prisma, mine, {
        rows: [{ id: added.items[0]!.id, contactEmail: "one@example.test" }],
      }),
    );
    expect(updated.items[0]!.contactEmail).toBe("one@example.test");
  });

  it("terminates people with a working relationship and refuses the rest", async () => {
    const { prisma, mine } = f;
    const worker = await person("Wren Worker", "employee");
    const investor = await person("Ivy Investor", "investor");
    const done = await f.as(mine, () =>
      terminateEquityStakeholders(prisma, mine, {
        ids: [worker.id],
        terminationDate: "2025-06-30",
      }),
    );
    expect(done.items[0]!.terminatedOn).toBe("2025-06-30");
    expect(done.items[0]!.relationship).toBe("ex_employee");
    await expect(
      f.as(mine, () =>
        terminateEquityStakeholders(prisma, mine, {
          ids: [worker.id],
          terminationDate: "2025-07-01",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    await expect(
      f.as(mine, () =>
        terminateEquityStakeholders(prisma, mine, {
          ids: [investor.id],
          terminationDate: "2025-07-01",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
  });

  it("merges, moving securities and recording each move", async () => {
    const { prisma, mine } = f;
    const into = await person("Kept Holder", "founder");
    const from = await person("Duplicate Holder", "founder");
    const common = await f.owner.equityShareClass.create({
      data: { ...mine, name: "Merge Common", prefix: "MC", classType: "common" },
    });
    await f.owner.equityShareClassVersion.create({
      data: {
        ...mine,
        shareClassId: common.id,
        documentDate: new Date("2024-01-01T00:00:00Z"),
        authorizedShares: 1_000_000n,
      },
    });
    const certificate = await f.as(mine, () =>
      createEquityCertificate(prisma, mine, {
        stakeholderId: from.id,
        shareClassId: common.id,
        quantity: "500",
        issueDate: "2024-02-01",
      }),
    );
    const merged = await f.as(mine, () =>
      mergeEquityStakeholders(prisma, mine, { intoId: into.id, fromId: from.id }),
    );
    expect(merged.id).toBe(into.id);
    const moved = await f.owner.equityCertificate.findUnique({ where: { id: certificate.id } });
    expect(moved!.stakeholderId).toBe(into.id);
    const history = await f.owner.equityTransaction.findMany({
      where: { certificateId: certificate.id, kind: "modify" },
    });
    expect(history).toHaveLength(1);
    const old = await f.as(mine, () => getEquityStakeholder(prisma, mine, from.id));
    expect(old.mergedIntoId).toBe(into.id);
    await expect(
      f.as(mine, () => mergeEquityStakeholders(prisma, mine, { intoId: into.id, fromId: from.id })),
    ).rejects.toBeInstanceOf(EquityInputError);
  });

  it("lets only one of two opposite merges win, and keeps the survivor visible", async () => {
    const { prisma, mine } = f;
    const a = await person("Race A");
    const b = await person("Race B");
    // Both merges read the two holders at the same moment unless a lock makes one wait.
    const racing = barrierAtFirstRead(prisma, f.owner, "equityStakeholder");
    const results = await Promise.allSettled([
      f.as(mine, () => mergeEquityStakeholders(racing, mine, { intoId: a.id, fromId: b.id })),
      f.as(mine, () => mergeEquityStakeholders(racing, mine, { intoId: b.id, fromId: a.id })),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
    // The loser is refused cleanly (not aborted as a deadlock) because it queued behind the winner.
    const refused = results.find((r) => r.status === "rejected");
    expect(refused?.status === "rejected" && refused.reason).toBeInstanceOf(EquityInputError);
    const rows = await f.owner.equityStakeholder.findMany({ where: { id: { in: [a.id, b.id] } } });
    expect(rows.filter((row) => row.mergedIntoId === null)).toHaveLength(1);
  });

  it("moves warrants and the portal contact, and refuses issuing to a merged holder", async () => {
    const { prisma, mine, owner } = f;
    const into = await person("Survivor");
    const from = await person("Absorbed");
    const scope = { spaceId: mine.spaceId, userId: mine.userId };
    const contact = await owner.contact.create({
      data: { ...scope, name: "Absorbed Contact", email: "absorbed@example.test" },
    });
    await owner.equityStakeholder.update({
      where: { id: from.id },
      data: { contactId: contact.id },
    });
    const shareClass = await owner.equityShareClass.create({
      data: { ...scope, name: "Common W", classType: "common", prefix: "CW" },
    });
    const warrant = await f.as(mine, () =>
      createEquityWarrant(prisma, mine, {
        stakeholderId: from.id,
        shareClassId: shareClass.id,
        quantity: "100",
        exercisePrice: "1",
        issueDate: "2024-01-01",
      }),
    );
    await f.as(mine, () =>
      mergeEquityStakeholders(prisma, mine, { intoId: into.id, fromId: from.id }),
    );
    expect(
      (await owner.equityWarrant.findUniqueOrThrow({ where: { id: warrant.id } })).stakeholderId,
    ).toBe(into.id);
    expect(
      (await owner.equityStakeholder.findUniqueOrThrow({ where: { id: into.id } })).contactId,
    ).toBe(contact.id);
    await expect(
      f.as(mine, () =>
        createEquityWarrant(prisma, mine, {
          stakeholderId: from.id,
          shareClassId: shareClass.id,
          quantity: "1",
          exercisePrice: "1",
          issueDate: "2024-01-01",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
  });

  it("records an audit row for each warrant a merge moves", async () => {
    const { prisma, mine, owner } = f;
    const into = await person("Audit Survivor");
    const from = await person("Audit Absorbed");
    const scope = { spaceId: mine.spaceId, userId: mine.userId };
    const shareClass = await owner.equityShareClass.create({
      data: { ...scope, name: "Common A", classType: "common", prefix: "CA" },
    });
    const warrant = await f.as(mine, () =>
      createEquityWarrant(prisma, mine, {
        stakeholderId: from.id,
        shareClassId: shareClass.id,
        quantity: "5",
        exercisePrice: "1",
        issueDate: "2024-01-01",
      }),
    );
    await f.as(mine, () =>
      mergeEquityStakeholders(prisma, mine, { intoId: into.id, fromId: from.id }),
    );
    const rows = await owner.equityTransaction.findMany({
      where: { warrantId: warrant.id },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "modify", after: { stakeholderId: into.id } });
  });

  it("moves documents, the access grant and properties to the survivor", async () => {
    const { prisma, mine, owner } = f;
    const scope = { spaceId: mine.spaceId, userId: mine.userId };
    const into = await person("Docs Survivor", "employee");
    const from = await person("Docs Absorbed", "advisor");
    const solo = await person("Docs Solo");
    const item = await owner.dataRoomItem.create({
      data: {
        ...scope,
        name: "Letter.pdf",
        source: "upload",
        mimeType: "application/pdf",
        size: 10n,
        storageKey: "k/merge-letter",
        sha256: "0".repeat(64),
      },
    });
    await owner.equityDocumentLink.create({
      data: { ...scope, dataRoomItemId: item.id, stakeholderId: from.id },
    });
    await owner.equityAccessGrant.createMany({
      data: [
        { ...scope, stakeholderId: into.id, level: "basic" },
        { ...scope, stakeholderId: from.id, level: "full_detail" },
      ],
    });
    await owner.equityStakeholderProperty.create({
      data: {
        ...scope,
        stakeholderId: from.id,
        kind: "job_title",
        effectiveDate: new Date("2024-02-01T00:00:00.000Z"),
        value: "Advisor to the board",
      },
    });
    await f.as(mine, () =>
      mergeEquityStakeholders(prisma, mine, { intoId: into.id, fromId: from.id }),
    );
    expect(await owner.equityDocumentLink.count({ where: { stakeholderId: into.id } })).toBe(1);
    expect(await owner.equityDocumentLink.count({ where: { stakeholderId: from.id } })).toBe(0);
    // Both holders had a grant: the survivor's stays, the merged holder's is dropped.
    const grants = await owner.equityAccessGrant.findMany({
      where: { stakeholderId: { in: [into.id, from.id] } },
    });
    expect(grants.map((g) => [g.stakeholderId, g.level])).toEqual([[into.id, "basic"]]);
    // The survivor keeps its own relationship; the kind it lacked moves over.
    const kinds = await owner.equityStakeholderProperty.findMany({
      where: { stakeholderId: into.id },
      select: { kind: true, value: true },
    });
    expect(kinds.map((k) => k.kind).sort()).toEqual(["job_title", "relationship"]);
    expect(kinds.find((k) => k.kind === "relationship")?.value).toBe("employee");
    // A grant on the merged holder alone moves to the survivor.
    await owner.equityAccessGrant.create({
      data: { ...scope, stakeholderId: solo.id, level: "basic" },
    });
    const next = await person("Docs Next");
    await f.as(mine, () =>
      mergeEquityStakeholders(prisma, mine, { intoId: next.id, fromId: solo.id }),
    );
    expect(await owner.equityAccessGrant.count({ where: { stakeholderId: next.id } })).toBe(1);
  });

  it("re-parents a survivor that sits under the merged holder", async () => {
    const { prisma, mine, owner } = f;
    const top = await person("Tree Top");
    const from = await person("Tree From");
    const middle = await person("Tree Middle");
    const into = await person("Tree Into");
    const sibling = await person("Tree Sibling");
    const parent = (id: string, parentId: string | null) =>
      owner.equityStakeholder.update({ where: { id }, data: { parentId } });
    // top > from > middle > into, and from > sibling: merging into absorbs from.
    await parent(from.id, top.id);
    await parent(middle.id, from.id);
    await parent(into.id, middle.id);
    await parent(sibling.id, from.id);
    await f.as(mine, () =>
      mergeEquityStakeholders(prisma, mine, { intoId: into.id, fromId: from.id }),
    );
    const rows = await owner.equityStakeholder.findMany({
      where: { id: { in: [top.id, middle.id, into.id, sibling.id] } },
      select: { id: true, parentId: true },
    });
    const parentOf = Object.fromEntries(rows.map((row) => [row.id, row.parentId]));
    expect(parentOf[middle.id]).toBe(top.id);
    expect(parentOf[sibling.id]).toBe(into.id);
    expect(parentOf[into.id]).toBe(middle.id);
    // No holder is its own ancestor.
    for (const row of rows) {
      const seen = new Set<string>();
      for (let id: string | null = row.id; id; id = parentOf[id] ?? null) {
        expect(seen.has(id)).toBe(false);
        seen.add(id);
      }
    }
  });

  it("re-parents a survivor that is a direct child of the merged holder", async () => {
    const { prisma, mine, owner } = f;
    const from = await person("Direct From");
    const into = await person("Direct Into");
    await owner.equityStakeholder.update({ where: { id: into.id }, data: { parentId: from.id } });
    await f.as(mine, () =>
      mergeEquityStakeholders(prisma, mine, { intoId: into.id, fromId: from.id }),
    );
    expect(
      (await owner.equityStakeholder.findUniqueOrThrow({ where: { id: into.id } })).parentId,
    ).toBeNull();
  });

  it("waits for a merge in progress, then refuses to issue to the merged holder", async () => {
    const { prisma, mine, owner } = f;
    const into = await person("Gap Survivor");
    const from = await person("Gap Absorbed");
    const scope = { spaceId: mine.spaceId, userId: mine.userId };
    const shareClass = await owner.equityShareClass.create({
      data: { ...scope, name: "Common G", classType: "common", prefix: "CG" },
    });
    let reached!: () => void;
    let resume!: () => void;
    const atWarrants = new Promise<void>((resolve) => (reached = resolve));
    const gate = new Promise<void>((resolve) => (resume = resolve));
    // The merge stops after it has locked the holders and before it commits.
    const paused = hookFirstRead(prisma, "equityWarrant", async () => {
      reached();
      await gate;
    });
    const merging = f.as(mine, () =>
      mergeEquityStakeholders(paused, mine, { intoId: into.id, fromId: from.id }),
    );
    await atWarrants;
    const issuing = f
      .as(mine, () =>
        createEquityWarrant(prisma, mine, {
          stakeholderId: from.id,
          shareClassId: shareClass.id,
          quantity: "1",
          exercisePrice: "1",
          issueDate: "2024-01-01",
        }),
      )
      .then(
        () => "issued",
        (error: unknown) => error,
      );
    await waitForLockWaiter(f.owner);
    resume();
    await merging;
    expect(await issuing).toBeInstanceOf(EquityInputError);
    expect(await owner.equityWarrant.count({ where: { stakeholderId: from.id } })).toBe(0);
  });

  it("lets an issuer that is mid-way and a merge queue up without a deadlock", async () => {
    const { prisma, mine, owner } = f;
    const into = await person("Order Survivor");
    const from = await person("Order Absorbed");
    const scope = { spaceId: mine.spaceId, userId: mine.userId };
    const shareClass = await owner.equityShareClass.create({
      data: { ...scope, name: "Common O", classType: "common", prefix: "CO" },
    });
    let reached!: () => void;
    let resume!: () => void;
    const atLabel = new Promise<void>((resolve) => (reached = resolve));
    const gate = new Promise<void>((resolve) => (resume = resolve));
    // The issuer stops after checking the holder and before it inserts the warrant.
    const paused = hookFirstRead(prisma, "equityWarrant", async () => {
      reached();
      await gate;
    });
    const issuing = f
      .as(mine, () =>
        createEquityWarrant(paused, mine, {
          stakeholderId: from.id,
          shareClassId: shareClass.id,
          quantity: "1",
          exercisePrice: "1",
          issueDate: "2024-01-01",
        }),
      )
      .then(
        () => "issued",
        (error: unknown) => error,
      );
    await atLabel;
    const merging = f
      .as(mine, () => mergeEquityStakeholders(prisma, mine, { intoId: into.id, fromId: from.id }))
      .then(
        () => "merged",
        (error: unknown) => error,
      );
    // The merge is now waiting for a lock the issuer holds. Let the issuer go on.
    await waitForLockWaiter(owner);
    resume();
    expect([await issuing, await merging]).toEqual(["issued", "merged"]);
    const warrants = await owner.equityWarrant.findMany({ where: { shareClassId: shareClass.id } });
    expect(warrants.map((row) => row.stakeholderId)).toEqual([into.id]);
  });

  it("refuses to merge holders whose accepted portfolio emails differ", async () => {
    const { prisma, mine } = f;
    const a = await person("Locked A");
    const b = await person("Locked B");
    for (const [row, email] of [
      [a, "a@example.test"],
      [b, "b@example.test"],
    ] as const)
      await f.owner.equityStakeholder.update({
        where: { id: row.id },
        data: { portfolioEmail: email, portfolioEmailLockedAt: new Date() },
      });
    await expect(
      f.as(mine, () => mergeEquityStakeholders(prisma, mine, { intoId: a.id, fromId: b.id })),
    ).rejects.toBeInstanceOf(EquityConflictError);
  });

  it("keeps other users and spaces out", async () => {
    const { prisma, mine, sameSpace, otherSpace } = f;
    const target = await person("Private Person", "employee");
    const other = await person("Private Other", "employee");
    for (const scope of [sameSpace, otherSpace]) {
      await expect(
        f.as(scope, () =>
          terminateEquityStakeholders(prisma, scope, {
            ids: [target.id],
            terminationDate: "2025-01-01",
          }),
        ),
      ).rejects.toBeInstanceOf(IsolationError);
      await expect(
        f.as(scope, () =>
          mergeEquityStakeholders(prisma, scope, { intoId: target.id, fromId: other.id }),
        ),
      ).rejects.toBeInstanceOf(IsolationError);
      await expect(
        f.as(scope, () =>
          bulkUpdateEquityStakeholders(prisma, scope, { rows: [{ id: target.id, name: "Taken" }] }),
        ),
      ).rejects.toBeInstanceOf(IsolationError);
    }
    const still = await f.as(mine, () => getEquityStakeholder(prisma, mine, target.id));
    expect(still.name).toBe("Private Person");
    expect(still.terminatedOn).toBeNull();
  });

  it("deletes a custom property and its values, only in the caller's ledger", async () => {
    const { prisma, mine, sameSpace } = f;
    const property = await f.as(mine, () =>
      createEquityCustomProperty(prisma, mine, { name: "Office" }),
    );
    const holder = await f.as(mine, () =>
      createEquityStakeholder(prisma, mine, {
        type: "individual",
        name: "Valued Holder",
        customValues: { [property.id]: "North" },
      }),
    );
    await expect(
      f.as(sameSpace, () => deleteEquityCustomProperty(prisma, sameSpace, { id: property.id })),
    ).rejects.toBeInstanceOf(IsolationError);
    await f.as(mine, () => deleteEquityCustomProperty(prisma, mine, { id: property.id }));
    const after = await f.as(mine, () => getEquityStakeholder(prisma, mine, holder.id));
    expect(after.customValues).toEqual({});
    expect(await f.owner.equityCustomProperty.count({ where: { id: property.id } })).toBe(0);
  });

  it("lists only stakeholders that share an employee ID", async () => {
    const { prisma, mine, sameSpace } = f;
    for (const name of ["Dup One", "Dup Two"])
      await f.as(mine, () =>
        createEquityStakeholder(prisma, mine, { type: "individual", name, employeeId: "DUP-7" }),
      );
    await f.as(mine, () =>
      createEquityStakeholder(prisma, mine, {
        type: "individual",
        name: "Solo",
        employeeId: "SOLO-1",
      }),
    );
    await f.as(sameSpace, () =>
      createEquityStakeholder(prisma, sameSpace, {
        type: "individual",
        name: "Other Dup",
        employeeId: "SOLO-1",
      }),
    );
    const page = await f.as(mine, () =>
      listEquityStakeholders(prisma, mine, { duplicateEmployeeId: true, pageSize: 50 }),
    );
    expect(page.items.map((row) => row.name).sort()).toEqual(["Dup One", "Dup Two"]);
  });

  it("adds dated values in a bulk update without losing the history", async () => {
    const { prisma, mine } = f;
    const holder = await f.as(mine, () =>
      createEquityStakeholder(prisma, mine, {
        type: "individual",
        name: "History Keeper",
        properties: [{ kind: "job_title", effectiveDate: "2024-01-01", value: "Analyst" }],
      }),
    );
    const update = {
      rows: [
        {
          id: holder.id,
          addProperties: [
            { kind: "job_title" as const, effectiveDate: "2025-01-01", value: "Lead" },
          ],
        },
      ],
    };
    await f.as(mine, () => bulkUpdateEquityStakeholders(prisma, mine, update));
    await f.as(mine, () => bulkUpdateEquityStakeholders(prisma, mine, update));
    const after = await f.as(mine, () => getEquityStakeholder(prisma, mine, holder.id));
    expect(after.jobTitle).toBe("Lead");
    expect(after.properties.map((p) => [p.effectiveDate, p.value])).toEqual([
      ["2025-01-01", "Lead"],
      ["2024-01-01", "Analyst"],
    ]);
  });
});
