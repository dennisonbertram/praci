import { afterAll, beforeAll, expect, it } from "vitest";
import { setEquityAccessGrant, setEquityAccessGroup } from "./access.js";
import { createEquityDocumentLink, deleteEquityDocumentLink } from "./access-documents.js";
import {
  linkEquityHolderContact,
  requestEquityAccess,
  resolveEquityAccessRequest,
  setEquityAccessLevels,
} from "./access-holders.js";
import { ensureLedger } from "./ledger.js";
import { createEquityStakeholder, updateEquityStakeholder } from "./stakeholders.js";
import type { EquityFixture } from "./test-fixture.js";
import { describeEquityPostgres, equityFixture } from "./test-fixture.js";
import { setEquityEstimatedValue } from "./views-value.js";

describeEquityPostgres("equity audit events (PostgreSQL)", () => {
  let f: EquityFixture;
  const ids = { holder: "", contact: "", doc: "" };
  beforeAll(async () => {
    f = await equityFixture("audit");
    const { prisma, mine, owner } = f;
    await f.as(mine, () => ensureLedger(prisma, mine));
    ids.holder = (
      await f.as(mine, () =>
        createEquityStakeholder(prisma, mine, { type: "individual", name: "Ann Holder" }),
      )
    ).id;
    ids.contact = (
      await owner.contact.create({ data: { ...f.mine, name: "Ann", kind: "investor" } })
    ).id;
    ids.doc = (
      await owner.dataRoomItem.create({
        data: {
          ...f.mine,
          name: "SPA.pdf",
          source: "upload",
          mimeType: "application/pdf",
          size: 10n,
          storageKey: "k/spa",
          sha256: "0".repeat(64),
        },
      })
    ).id;
  });
  afterAll(async () => {
    await f?.close();
  });

  const events = (kind: string) =>
    f.owner.equityAuditEvent.findMany({ where: { ...f.mine, kind }, orderBy: { at: "asc" } });

  it("writes one row for each audited action, with the actor and before and after", async () => {
    const { prisma, mine } = f;
    const run = <T>(fn: () => Promise<T>) => f.as(mine, fn);

    await run(() => setEquityAccessGroup(prisma, mine, { key: "investors", level: "basic" }));
    await run(() =>
      setEquityAccessGrant(prisma, mine, { stakeholderId: ids.holder, level: "advanced" }),
    );
    await run(() =>
      setEquityAccessLevels(prisma, mine, { stakeholderIds: [ids.holder], level: "restricted" }),
    );
    await run(() =>
      requestEquityAccess(prisma, mine, { stakeholderId: ids.holder, level: "full_detail" }),
    );
    await run(() =>
      resolveEquityAccessRequest(prisma, mine, {
        stakeholderId: ids.holder,
        requestedLevel: "full_detail",
        approve: true,
      }),
    );
    await run(() =>
      linkEquityHolderContact(prisma, mine, { stakeholderId: ids.holder, contactId: ids.contact }),
    );
    await run(() =>
      linkEquityHolderContact(prisma, mine, { stakeholderId: ids.holder, contactId: null }),
    );
    const link = await run(() =>
      createEquityDocumentLink(prisma, mine, {
        dataRoomItemId: ids.doc,
        target: { kind: "stakeholder", id: ids.holder },
      }),
    );
    await run(() => deleteEquityDocumentLink(prisma, mine, link.id));
    await run(() =>
      setEquityEstimatedValue(prisma, mine, {
        visibility: "holders",
        pricePerShare: "1.5",
        effectiveDate: "2026-01-01",
      }),
    );
    await run(() =>
      updateEquityStakeholder(prisma, mine, { id: ids.holder, name: "Ann Renamed", taxId: "123" }),
    );

    const count = async (kind: string) => (await events(kind)).length;
    expect(await count("access.group_level")).toBe(1);
    expect(await count("access.grant_level")).toBe(2); // the single set and the bulk set
    expect(await count("access.request")).toBe(1);
    expect(await count("access.resolve")).toBe(1);
    expect(await count("contact.link")).toBe(1);
    expect(await count("contact.unlink")).toBe(1);
    expect(await count("document.link")).toBe(1);
    expect(await count("document.unlink")).toBe(1);
    expect(await count("estimated_value.set")).toBe(1);
    expect(await count("stakeholder.update")).toBe(1);

    const [group] = await events("access.group_level");
    expect(group).toMatchObject({
      actorUserId: mine.userId,
      subjectType: "group",
      subjectId: "investors",
      after: { level: "basic" },
    });
    const [resolved] = await events("access.resolve");
    expect(resolved).toMatchObject({
      subjectId: ids.holder,
      before: { level: "restricted", requestedLevel: "full_detail" },
      after: { level: "full_detail", requestedLevel: null, approved: true },
    });
    const [edit] = await events("stakeholder.update");
    expect(edit?.before).toMatchObject({ name: "Ann Holder" });
    expect(edit?.after).toMatchObject({ name: "Ann Renamed" });
    // A tax id is never copied into the history, only the fact that it changed.
    expect(edit?.before).toMatchObject({ taxId: "[changed]" });
    expect(edit?.after).toMatchObject({ taxId: "[changed]" });
    expect(JSON.stringify([edit?.before, edit?.after])).not.toContain("123");
  });

  it("records personal fields by name only, and dated property edits by kind", async () => {
    const { prisma, mine } = f;
    await f.as(mine, () =>
      updateEquityStakeholder(prisma, mine, {
        id: ids.holder,
        dateOfBirth: "1990-02-03",
        contactEmail: "ann.private@example.test",
        otherEmails: ["ann.other@example.test"],
        addresses: [{ country: "US", street: "9 Secret Lane", city: "X", state: "CA" }],
        employeeId: "EMP-4471",
        payrollId: "PAY-8890",
      }),
    );
    await f.as(mine, () =>
      updateEquityStakeholder(prisma, mine, {
        id: ids.holder,
        addProperties: [{ kind: "relationship", effectiveDate: "2026-02-01", value: "Employee" }],
      }),
    );
    const rows = await events("stakeholder.update");
    const personal = rows.at(-2);
    expect(personal?.after).toMatchObject({
      dateOfBirth: "[changed]",
      contactEmail: "[changed]",
      otherEmails: "[changed]",
      addresses: "[changed]",
      employeeId: "[changed]",
      payrollId: "[changed]",
    });
    const text = JSON.stringify(personal);
    for (const secret of ["1990", "ann.private", "ann.other", "Secret Lane", "4471", "8890"])
      expect(text).not.toContain(secret);
    // A property-only edit changes the derived column, and is recorded with its kind.
    expect(rows.at(-1)?.after).toMatchObject({
      relationship: "Employee",
      propertyKinds: ["relationship"],
    });
  });

  it("writes no row when a level or the estimated value is set to what it already is", async () => {
    const { prisma, mine } = f;
    const total = () => f.owner.equityAuditEvent.count({ where: mine });
    const before = await total();
    await f.as(mine, () =>
      setEquityAccessGroup(prisma, mine, { key: "investors", level: "basic" }),
    );
    await f.as(mine, () =>
      setEquityAccessGrant(prisma, mine, { stakeholderId: ids.holder, level: "full_detail" }),
    );
    await f.as(mine, () =>
      setEquityAccessLevels(prisma, mine, { stakeholderIds: [ids.holder], level: "full_detail" }),
    );
    await f.as(mine, () =>
      setEquityEstimatedValue(prisma, mine, {
        visibility: "holders",
        pricePerShare: "1.5",
        effectiveDate: "2026-01-01",
      }),
    );
    expect(await total()).toBe(before);
  });

  it("rolls the change back when its audit row cannot be written", async () => {
    const { prisma, mine, owner } = f;
    const total = () => owner.equityAuditEvent.count({ where: mine });
    const linked = () =>
      owner.equityStakeholder.findUniqueOrThrow({
        where: { id: ids.holder },
        select: { contactId: true },
      });
    const before = await total();
    // The change succeeds first and the audit insert then fails, so only a shared
    // transaction can leave the contact unlinked.
    await owner.$executeRawUnsafe(
      `CREATE FUNCTION capfix_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit insert refused'; END $$`,
    );
    await owner.$executeRawUnsafe(
      `CREATE TRIGGER capfix_fail_audit BEFORE INSERT ON equity_audit_events FOR EACH ROW EXECUTE FUNCTION capfix_fail_audit()`,
    );
    try {
      await expect(
        f.as(mine, () =>
          linkEquityHolderContact(prisma, mine, {
            stakeholderId: ids.holder,
            contactId: ids.contact,
          }),
        ),
      ).rejects.toThrow(/audit insert refused/);
    } finally {
      await owner.$executeRawUnsafe("DROP TRIGGER capfix_fail_audit ON equity_audit_events");
      await owner.$executeRawUnsafe("DROP FUNCTION capfix_fail_audit()");
    }
    expect((await linked()).contactId).toBeNull();
    expect(await total()).toBe(before);
    // Without the failure the same call links the contact and writes its row.
    await f.as(mine, () =>
      linkEquityHolderContact(prisma, mine, { stakeholderId: ids.holder, contactId: ids.contact }),
    );
    expect((await linked()).contactId).toBe(ids.contact);
    expect(await total()).toBe(before + 1);
    await f.as(mine, () =>
      linkEquityHolderContact(prisma, mine, { stakeholderId: ids.holder, contactId: null }),
    );
  });

  it("refuses UPDATE and DELETE to the runtime role, and to the owner", async () => {
    const { prisma, mine, owner } = f;
    const row = await f.owner.equityAuditEvent.findFirstOrThrow({ where: mine });
    // The runtime role has no update or delete policy: the statement changes no row.
    expect(
      (
        await f.as(mine, () =>
          prisma.equityAuditEvent.updateMany({ where: { id: row.id }, data: { kind: "x" } }),
        )
      ).count,
    ).toBe(0);
    expect(
      (await f.as(mine, () => prisma.equityAuditEvent.deleteMany({ where: { id: row.id } }))).count,
    ).toBe(0);
    // The owner bypasses row-level security, so the trigger is what stops it.
    await expect(
      owner.equityAuditEvent.update({ where: { id: row.id }, data: { kind: "x" } }),
    ).rejects.toThrow(/append-only/);
    await expect(owner.equityAuditEvent.delete({ where: { id: row.id } })).rejects.toThrow(
      /append-only/,
    );
    expect(await owner.equityAuditEvent.count({ where: { id: row.id } })).toBe(1);
  });

  it("is invisible to another tenant", async () => {
    const { prisma, otherSpace } = f;
    const seen = await f.as(otherSpace, () => prisma.equityAuditEvent.count());
    expect(seen).toBe(0);
  });

  it("lets the rows go when their whole ledger is deleted", async () => {
    const { owner, sameSpace } = f;
    await f.as(sameSpace, () => ensureLedger(f.prisma, sameSpace));
    await f.as(sameSpace, () =>
      setEquityAccessGroup(f.prisma, sameSpace, { key: "founders", level: "basic" }),
    );
    expect(await owner.equityAuditEvent.count({ where: sameSpace })).toBe(1);
    // As the runtime role, the way an account deletion reaches the ledger.
    await f.as(sameSpace, () =>
      f.prisma.equityLedger.delete({ where: { spaceId_userId: sameSpace } }),
    );
    expect(await owner.equityAuditEvent.count({ where: sameSpace })).toBe(0);
  });
});
