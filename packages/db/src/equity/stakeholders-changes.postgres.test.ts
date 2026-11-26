import { EquityHrisPreferencesSchema, EquityStakeholderChangePageSchema } from "@rakazo/contracts";
import { afterAll, beforeAll, expect, it } from "vitest";
import { IsolationError } from "../scope.js";
import { EquityInputError } from "./ledger.js";
import { createEquityStakeholder, getEquityStakeholder } from "./stakeholders.js";
import {
  countEquityStakeholderChanges,
  getEquityHrisPreferences,
  importEquityStakeholderChanges,
  listEquityStakeholderChanges,
  proposeEquityStakeholderChange,
  resolveEquityStakeholderChange,
  setEquityHrisPreferences,
} from "./stakeholders-changes.js";
import type { EquityFixture } from "./test-fixture.js";
import {
  barrierAtEquityLedgerLock,
  describeEquityPostgres,
  equityFixture,
} from "./test-fixture.js";

const address = (city: string) => ({
  country: "US",
  street: "1 Main St",
  city,
  state: "CA",
  postalCode: "90000",
});

describeEquityPostgres("equity stakeholder changes (PostgreSQL)", () => {
  let f: EquityFixture;
  let adaId = "";
  let benId = "";
  let cyId = "";
  let profileChangeId = "";
  let terminationChangeId = "";
  let matchChangeId = "";

  beforeAll(async () => {
    f = await equityFixture("stakeholder-changes");
    const { prisma, mine } = f;
    const ada = await f.as(mine, () =>
      createEquityStakeholder(prisma, mine, {
        type: "individual",
        name: "Ada Example",
        firstName: "Ada",
        lastName: "Example",
        contactEmail: "ada@example.test",
        employeeId: "E-1",
        addresses: [address("Springfield")],
        properties: [{ kind: "job_title", effectiveDate: "2020-01-01", value: "Engineer" }],
      }),
    );
    adaId = ada.id;
    benId = (
      await f.as(mine, () =>
        createEquityStakeholder(prisma, mine, {
          type: "individual",
          name: "Ben Sample",
          firstName: "Ben",
          lastName: "Sample",
          contactEmail: "ben@example.test",
          employeeId: "E-2",
        }),
      )
    ).id;
    cyId = (
      await f.as(mine, () =>
        createEquityStakeholder(prisma, mine, {
          type: "individual",
          name: "Cy Placeholder",
          contactEmail: "cy@example.test",
        }),
      )
    ).id;
  });
  afterAll(async () => {
    await f?.close();
  });

  const file = () => ({
    rows: [
      {
        employeeId: "E-1",
        name: "Ada Example",
        email: "ada@example.test",
        proposed: {
          firstName: "Ada",
          lastName: "Example",
          contactEmail: "ada.new@example.test",
          jobTitle: "Staff Engineer",
          department: "R&D",
          address: address("Oakland"),
        },
      },
      {
        employeeId: "E-2",
        name: "Ben Sample",
        email: "BEN@example.test",
        terminationDate: "2026-03-01",
        proposed: {},
      },
      { employeeId: "E-9", name: "Dee External", email: "dee@example.test", proposed: {} },
      {
        employeeId: "E-1",
        name: "Ada Example",
        email: "ada@example.test",
        proposed: { firstName: "Ada", jobTitle: "Engineer", contactEmail: "ada@example.test" },
      },
      { employeeId: "E-2", name: "Ben Sample", email: "ben@example.test", proposed: {} },
    ],
  });

  it("imports a file into profile, termination and match changes", async () => {
    const { prisma, mine } = f;
    const result = await f.as(mine, () => importEquityStakeholderChanges(prisma, mine, file()));
    expect(result).toEqual({ match: 1, termination: 1, profile: 1, unchanged: 2 });

    const page = await f.as(mine, () =>
      listEquityStakeholderChanges(prisma, mine, { pageSize: 50 }),
    );
    expect(page.total).toBe(3);
    EquityStakeholderChangePageSchema.parse(page);
    const profile = page.items.find((item) => item.kind === "profile");
    const termination = page.items.find((item) => item.kind === "termination");
    const match = page.items.find((item) => item.kind === "match");
    expect(profile).toBeDefined();
    expect(termination).toBeDefined();
    expect(match).toBeDefined();
    profileChangeId = profile!.id;
    terminationChangeId = termination!.id;
    matchChangeId = match!.id;

    // Only the values that differ from the stored profile are proposed.
    expect(profile!.proposed).toEqual({
      contactEmail: "ada.new@example.test",
      jobTitle: "Staff Engineer",
      department: "R&D",
      address: address("Oakland"),
    });
    expect(profile!.stakeholderId).toBe(adaId);
    expect(profile!.stakeholderName).toBe("Ada Example");
    expect(profile!.source).toBe("file");
    expect(profile!.status).toBe("pending");

    // The email matched with different case; the change carries the row's employee id.
    expect(termination!.stakeholderId).toBe(benId);
    expect(termination!.terminationDate).toBe("2026-03-01");
    expect(termination!.employeeId).toBe("E-2");

    // No match: an external row to review, with no stakeholder yet.
    expect(match!.stakeholderId).toBeNull();
    expect(match!.stakeholderName).toBeNull();
    expect(match!.externalName).toBe("Dee External");
    expect(match!.externalEmail).toBe("dee@example.test");
    expect(match!.employeeId).toBe("E-9");
  });

  it("refreshes an existing pending change instead of duplicating it", async () => {
    const { prisma, mine } = f;
    const again = await f.as(mine, () => importEquityStakeholderChanges(prisma, mine, file()));
    expect(again).toEqual({ match: 1, termination: 1, profile: 1, unchanged: 2 });
    const page = await f.as(mine, () =>
      listEquityStakeholderChanges(prisma, mine, { pageSize: 50 }),
    );
    expect(page.total).toBe(3);

    // A later file with another job title rewrites what the queued change proposes.
    const rows = file().rows;
    rows[0] = {
      ...rows[0]!,
      proposed: {
        firstName: "Ada",
        contactEmail: "ada.new@example.test",
        jobTitle: "Principal Engineer",
        department: "R&D",
        address: address("Oakland"),
      },
    } as (typeof rows)[number];
    await f.as(mine, () => importEquityStakeholderChanges(prisma, mine, { rows: [rows[0]!] }));
    const after = await f.as(mine, () =>
      listEquityStakeholderChanges(prisma, mine, { kind: "profile" }),
    );
    expect(after.total).toBe(1);
    expect(after.items[0]!.proposed).toEqual({
      contactEmail: "ada.new@example.test",
      jobTitle: "Principal Engineer",
      department: "R&D",
      address: address("Oakland"),
    });
  });

  it("lists with kind, status, search, sort and paging", async () => {
    const { prisma, mine } = f;
    const profiles = await f.as(mine, () =>
      listEquityStakeholderChanges(prisma, mine, { kind: "profile" }),
    );
    expect(profiles.total).toBe(1);
    expect(profiles.items[0]!.id).toBe(profileChangeId);

    const accepted = await f.as(mine, () =>
      listEquityStakeholderChanges(prisma, mine, { status: "accepted" }),
    );
    expect(accepted.total).toBe(0);

    const byName = await f.as(mine, () =>
      listEquityStakeholderChanges(prisma, mine, { search: "dee" }),
    );
    expect(byName.items.map((item) => item.id)).toEqual([matchChangeId]);

    const byEmail = await f.as(mine, () =>
      listEquityStakeholderChanges(prisma, mine, { search: "ada@example.test" }),
    );
    expect(byEmail.items.map((item) => item.id)).toEqual([profileChangeId]);
    const byBenEmail = await f.as(mine, () =>
      listEquityStakeholderChanges(prisma, mine, { search: "ben@example.test" }),
    );
    expect(byBenEmail.items.map((item) => item.id)).toEqual([terminationChangeId]);

    const byEmployee = await f.as(mine, () =>
      listEquityStakeholderChanges(prisma, mine, { search: "E-9" }),
    );
    expect(byEmployee.items.map((item) => item.id)).toEqual([matchChangeId]);

    const ascending = await f.as(mine, () =>
      listEquityStakeholderChanges(prisma, mine, { sort: { field: "createdAt", dir: "asc" } }),
    );
    expect(ascending.items).toHaveLength(3);
    const descending = await f.as(mine, () =>
      listEquityStakeholderChanges(prisma, mine, { sort: { field: "createdAt", dir: "desc" } }),
    );
    expect(descending.items[0]!.createdAt >= descending.items[1]!.createdAt).toBe(true);

    const paged = await f.as(mine, () =>
      listEquityStakeholderChanges(prisma, mine, { page: 2, pageSize: 2 }),
    );
    expect(paged.total).toBe(3);
    expect(paged.items).toHaveLength(1);
    EquityStakeholderChangePageSchema.parse(paged);
  });

  it("counts pending changes by kind and reports the latest profile change", async () => {
    const { prisma, mine } = f;
    const counts = await f.as(mine, () => countEquityStakeholderChanges(prisma, mine));
    expect(counts).toMatchObject({ match: 1, termination: 1, profile: 1 });
    expect(typeof counts.lastProposedAt).toBe("string");
    expect(Number.isNaN(Date.parse(counts.lastProposedAt!))).toBe(false);
  });

  it("resolves the profile change field by field", async () => {
    const { prisma, mine } = f;
    await expect(
      f.as(mine, () =>
        resolveEquityStakeholderChange(prisma, mine, { id: profileChangeId, decision: "accept" }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    await expect(
      f.as(mine, () =>
        resolveEquityStakeholderChange(prisma, mine, {
          id: profileChangeId,
          decision: "accept",
          fields: ["taxId"],
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);

    const resolved = await f.as(mine, () =>
      resolveEquityStakeholderChange(prisma, mine, {
        id: profileChangeId,
        decision: "accept",
        fields: ["contactEmail", "jobTitle", "department", "address"],
      }),
    );
    expect(resolved.status).toBe("accepted");
    expect(resolved.stakeholderName).toBe("Ada Example");
    expect(resolved.acceptedFields.sort()).toEqual(
      ["address", "contactEmail", "department", "jobTitle"].sort(),
    );
    expect(resolved.resolvedAt).not.toBeNull();

    const ada = await f.as(mine, () => getEquityStakeholder(prisma, mine, adaId));
    expect(ada.contactEmail).toBe("ada.new@example.test");
    expect(ada.jobTitle).toBe("Principal Engineer");
    expect(ada.department).toBe("R&D");
    expect(ada.addresses[0]?.city).toBe("Oakland");
    expect(ada.firstName).toBe("Ada");
    const titles = ada.properties.filter((property) => property.kind === "job_title");
    expect(titles.some((property) => property.value === "Principal Engineer")).toBe(true);
    expect(titles.some((property) => property.value === "Engineer")).toBe(true);

    await expect(
      f.as(mine, () =>
        resolveEquityStakeholderChange(prisma, mine, {
          id: profileChangeId,
          decision: "reject",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
  });

  it("accepts a termination by setting the date on the stakeholder", async () => {
    const { prisma, mine } = f;
    const resolved = await f.as(mine, () =>
      resolveEquityStakeholderChange(prisma, mine, {
        id: terminationChangeId,
        decision: "accept",
      }),
    );
    expect(resolved.status).toBe("accepted");
    const ben = await f.as(mine, () => getEquityStakeholder(prisma, mine, benId));
    expect(ben.terminatedOn).toBe("2026-03-01");
  });

  it("links a match to a stakeholder or creates one", async () => {
    const { prisma, mine } = f;
    await expect(
      f.as(mine, () =>
        resolveEquityStakeholderChange(prisma, mine, { id: matchChangeId, decision: "accept" }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);

    const linked = await f.as(mine, () =>
      resolveEquityStakeholderChange(prisma, mine, {
        id: matchChangeId,
        decision: "accept",
        stakeholderId: cyId,
      }),
    );
    expect(linked.stakeholderId).toBe(cyId);
    expect(linked.stakeholderName).toBe("Cy Placeholder");
    const cy = await f.as(mine, () => getEquityStakeholder(prisma, mine, cyId));
    expect(cy.employeeId).toBe("E-9");

    const created = await f.as(mine, () =>
      importEquityStakeholderChanges(prisma, mine, {
        rows: [
          {
            employeeId: "E-10",
            name: "New Hire",
            email: "new.hire@example.test",
            proposed: { firstName: "New", lastName: "Hire", jobTitle: "Designer" },
          },
        ],
      }),
    );
    expect(created.match).toBe(1);
    const pending = await f.as(mine, () =>
      listEquityStakeholderChanges(prisma, mine, { kind: "match" }),
    );
    const external = pending.items.find((item) => item.employeeId === "E-10");
    expect(external).toBeDefined();
    const resolved = await f.as(mine, () =>
      resolveEquityStakeholderChange(prisma, mine, {
        id: external!.id,
        decision: "accept",
        create: true,
      }),
    );
    expect(resolved.stakeholderId).not.toBeNull();
    const newHire = await f.as(mine, () =>
      getEquityStakeholder(prisma, mine, resolved.stakeholderId!),
    );
    expect(newHire.name).toBe("New Hire");
    expect(newHire.contactEmail).toBe("new.hire@example.test");
    expect(newHire.employeeId).toBe("E-10");
    expect(newHire.firstName).toBe("New");
    expect(newHire.jobTitle).toBeNull();
  });

  it("resolves a change once when two reviewers resolve it at the same time", async () => {
    const { prisma, mine, owner } = f;
    await f.as(mine, () =>
      importEquityStakeholderChanges(prisma, mine, {
        rows: [{ employeeId: "E-20", name: "Race Hire", email: "race.hire@example.test" }],
      }),
    );
    const pending = await f.as(mine, () =>
      listEquityStakeholderChanges(prisma, mine, { kind: "match" }),
    );
    const change = pending.items.find((item) => item.employeeId === "E-20")!;
    // Both reviewers are in flight before either takes the ledger lock.
    const together = barrierAtEquityLedgerLock(prisma);
    const resolve = () =>
      f.as(mine, () =>
        resolveEquityStakeholderChange(together, mine, {
          id: change.id,
          decision: "accept",
          create: true,
        }),
      );
    const results = await Promise.allSettled([resolve(), resolve()]);
    expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(await owner.equityStakeholder.count({ where: { employeeId: "E-20" } })).toBe(1);
  });

  it("rejects a change without touching the stakeholder", async () => {
    const { prisma, mine } = f;
    const imported = await f.as(mine, () =>
      importEquityStakeholderChanges(prisma, mine, {
        rows: [{ employeeId: "E-11", name: "Dismiss Me", email: "dismiss@example.test" }],
      }),
    );
    expect(imported.match).toBe(1);
    const pending = await f.as(mine, () =>
      listEquityStakeholderChanges(prisma, mine, { kind: "match" }),
    );
    const row = pending.items.find((item) => item.employeeId === "E-11")!;
    const rejected = await f.as(mine, () =>
      resolveEquityStakeholderChange(prisma, mine, { id: row.id, decision: "reject" }),
    );
    expect(rejected.status).toBe("rejected");
    expect(rejected.resolvedAt).not.toBeNull();
    expect(rejected.stakeholderId).toBeNull();
    const rejectedList = await f.as(mine, () =>
      listEquityStakeholderChanges(prisma, mine, { status: "rejected" }),
    );
    expect(rejectedList.items.map((item) => item.id)).toEqual([row.id]);
  });

  it("round-trips HRIS preferences", async () => {
    const { prisma, mine } = f;
    const defaults = await f.as(mine, () => getEquityHrisPreferences(prisma, mine));
    expect(defaults).toEqual({ autoUpdates: false, autoFields: [], autoCreate: false });
    EquityHrisPreferencesSchema.parse(defaults);

    const set = await f.as(mine, () =>
      setEquityHrisPreferences(prisma, mine, {
        autoUpdates: true,
        autoFields: ["job_title", "tax_id"],
        autoCreate: true,
      }),
    );
    expect(set).toEqual({
      autoUpdates: true,
      autoFields: ["job_title", "tax_id"],
      autoCreate: true,
    });
    expect(await f.as(mine, () => getEquityHrisPreferences(prisma, mine))).toEqual(set);
    EquityHrisPreferencesSchema.parse(set);

    const cleared = await f.as(mine, () =>
      setEquityHrisPreferences(prisma, mine, {
        autoUpdates: false,
        autoFields: [],
        autoCreate: false,
      }),
    );
    expect(cleared).toEqual({ autoUpdates: false, autoFields: [], autoCreate: false });
  });

  it("scopes listing, resolving and linking to the caller's ledger", async () => {
    const { prisma, mine, sameSpace, otherSpace } = f;
    for (const other of [sameSpace, otherSpace]) {
      expect((await f.as(other, () => listEquityStakeholderChanges(prisma, other, {}))).total).toBe(
        0,
      );
      expect(await f.as(other, () => countEquityStakeholderChanges(prisma, other))).toEqual({
        match: 0,
        termination: 0,
        profile: 0,
        lastProposedAt: null,
      });
      expect(await f.as(other, () => getEquityHrisPreferences(prisma, other))).toEqual({
        autoUpdates: false,
        autoFields: [],
        autoCreate: false,
      });
      await expect(
        f.as(other, () =>
          resolveEquityStakeholderChange(prisma, other, {
            id: profileChangeId,
            decision: "accept",
            fields: ["jobTitle"],
          }),
        ),
      ).rejects.toBeInstanceOf(IsolationError);
    }

    // Another user in the same space cannot link their match to this user's stakeholder.
    await f.as(sameSpace, () =>
      importEquityStakeholderChanges(prisma, sameSpace, {
        rows: [{ employeeId: "X-1", name: "Other Person", email: "other@example.test" }],
      }),
    );
    const theirs = await f.as(sameSpace, () =>
      listEquityStakeholderChanges(prisma, sameSpace, { kind: "match" }),
    );
    expect(theirs.total).toBe(1);
    await expect(
      f.as(sameSpace, () =>
        resolveEquityStakeholderChange(prisma, sameSpace, {
          id: theirs.items[0]!.id,
          decision: "accept",
          stakeholderId: adaId,
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);

    // Preferences are per ledger, not shared through the space.
    await f.as(sameSpace, () =>
      setEquityHrisPreferences(prisma, sameSpace, {
        autoUpdates: true,
        autoFields: ["address"],
        autoCreate: true,
      }),
    );
    expect(await f.as(mine, () => getEquityHrisPreferences(prisma, mine))).toEqual({
      autoUpdates: false,
      autoFields: [],
      autoCreate: false,
    });
  });

  it("applies the automation preferences on import", async () => {
    const { prisma, mine } = f;
    const pat = await f.as(mine, () =>
      createEquityStakeholder(prisma, mine, {
        type: "individual",
        name: "Pat Auto",
        employeeId: "AUTO-1",
        properties: [{ kind: "job_title", effectiveDate: "2024-01-01", value: "Analyst" }],
      }),
    );
    await f.as(mine, () =>
      setEquityHrisPreferences(prisma, mine, {
        autoUpdates: true,
        autoFields: ["job_title"],
        autoCreate: true,
      }),
    );
    const result = await f.as(mine, () =>
      importEquityStakeholderChanges(prisma, mine, {
        rows: [
          {
            employeeId: "AUTO-1",
            name: "Pat Auto",
            proposed: { jobTitle: "Lead Analyst", taxId: "000-11-2222" },
          },
          {
            employeeId: "AUTO-2",
            name: "Robin Newhire",
            email: "robin@example.test",
            proposed: {},
          },
        ],
      }),
    );
    expect(result).toMatchObject({ profile: 1, match: 0, applied: 1, created: 1 });
    const updated = await f.as(mine, () => getEquityStakeholder(prisma, mine, pat.id));
    expect(updated.jobTitle).toBe("Lead Analyst");
    expect(updated.taxId).toBeNull();
    const queued = await f.as(mine, () =>
      listEquityStakeholderChanges(prisma, mine, { kind: "profile", search: "AUTO-1" }),
    );
    expect(queued.items[0]!.proposed).toEqual({ taxId: "000-11-2222" });
    const robin = await f.owner.equityStakeholder.findFirst({
      where: { ...mine, name: "Robin Newhire" },
    });
    expect(robin?.employeeId).toBe("AUTO-2");
    await f.as(mine, () =>
      setEquityHrisPreferences(prisma, mine, {
        autoUpdates: false,
        autoFields: [],
        autoCreate: false,
      }),
    );
  });

  it("queues a holder's own proposed values as a portfolio change", async () => {
    const { prisma, mine, sameSpace } = f;
    const holder = await f.as(mine, () =>
      createEquityStakeholder(prisma, mine, {
        type: "individual",
        name: "Portal Holder",
        contactEmail: "portal@example.test",
      }),
    );
    const change = await f.as(mine, () =>
      proposeEquityStakeholderChange(prisma, mine, {
        stakeholderId: holder.id,
        proposed: { contactEmail: "portal@example.test", jobTitle: "Designer" },
      }),
    );
    expect(change).toMatchObject({
      kind: "profile",
      source: "portfolio",
      proposed: { jobTitle: "Designer" },
    });
    const same = await f.as(mine, () =>
      proposeEquityStakeholderChange(prisma, mine, {
        stakeholderId: holder.id,
        proposed: { contactEmail: "portal@example.test" },
      }),
    );
    expect(same).toBeNull();
    await expect(
      f.as(sameSpace, () =>
        proposeEquityStakeholderChange(prisma, sameSpace, {
          stakeholderId: holder.id,
          proposed: {},
        }),
      ),
    ).rejects.toBeInstanceOf(IsolationError);
  });

  it("terminating from the queue also moves the relationship to its ex- value", async () => {
    const { prisma, mine } = f;
    const worker = await f.as(mine, () =>
      createEquityStakeholder(prisma, mine, {
        type: "individual",
        name: "Queue Leaver",
        contactEmail: "queue.leaver@example.test",
        properties: [{ kind: "relationship", effectiveDate: "2024-01-01", value: "employee" }],
      }),
    );
    await f.as(mine, () =>
      importEquityStakeholderChanges(prisma, mine, {
        rows: [
          {
            name: "Queue Leaver",
            email: "queue.leaver@example.test",
            terminationDate: "2025-12-31",
          },
        ],
      }),
    );
    const page = await f.as(mine, () =>
      listEquityStakeholderChanges(prisma, mine, { kind: "termination", search: "queue.leaver" }),
    );
    await f.as(mine, () =>
      resolveEquityStakeholderChange(prisma, mine, { id: page.items[0]!.id, decision: "accept" }),
    );
    const after = await f.as(mine, () => getEquityStakeholder(prisma, mine, worker.id));
    expect(after.terminatedOn).toBe("2025-12-31");
    expect(after.relationship).toBe("ex_employee");
  });
});
