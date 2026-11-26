import {
  EQUITY_ACCESS_LEVELS,
  EQUITY_CHANGE_KINDS,
  EQUITY_CHANGE_STATUSES,
  EQUITY_CLASS_TYPES,
  EQUITY_CONVERTIBLE_KINDS,
  EQUITY_DATED_PROPERTY_KINDS,
  EQUITY_INTEREST_TYPES,
  EQUITY_OPTION_TYPES,
  EQUITY_PAPER_STATUSES,
  EQUITY_STAKEHOLDER_TYPES,
  EQUITY_VALUATION_CAP_TYPES,
} from "@rakazo/contracts";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { EquityFixture } from "./test-fixture.js";
import { describeEquityPostgres, equityFixture } from "./test-fixture.js";

describeEquityPostgres("equity value-set CHECK constraints (PostgreSQL)", () => {
  let f: EquityFixture;

  beforeAll(async () => {
    f = await equityFixture("value-checks");
    await f.owner.equityLedger.create({ data: f.mine });
  });

  afterAll(async () => {
    await f?.close();
  });

  it("rejects a stakeholder type outside the contract set and accepts one inside it", async () => {
    const data = { ...f.mine, name: "Holder" };
    await expect(
      f.owner.equityStakeholder.create({ data: { ...data, type: "trust" } }),
    ).rejects.toThrow(/equity_stakeholders_type_values/);
    await expect(
      f.owner.equityStakeholder.create({ data: { ...data, type: "organization" } }),
    ).resolves.toMatchObject({ type: "organization" });
  });

  it("rejects an access level outside the contract set but allows a null grant level", async () => {
    await expect(
      f.owner.equityAccessGroup.create({ data: { ...f.mine, key: "founders", level: "admin" } }),
    ).rejects.toThrow(/equity_access_groups_level_values/);
    const holder = await f.owner.equityStakeholder.create({
      data: { ...f.mine, name: "Requester", type: "individual" },
    });
    await expect(
      f.owner.equityAccessGrant.create({
        data: { ...f.mine, stakeholderId: holder.id, level: null, requestedLevel: "basic" },
      }),
    ).resolves.toMatchObject({ level: null, requestedLevel: "basic" });
  });

  it("keeps every value-set constraint equal to its contract list", async () => {
    const expected: Record<string, readonly string[]> = {
      equity_stakeholders_type_values: EQUITY_STAKEHOLDER_TYPES,
      equity_stakeholder_properties_kind_values: EQUITY_DATED_PROPERTY_KINDS,
      equity_share_classes_classType_values: EQUITY_CLASS_TYPES,
      equity_certificates_paperStatus_values: EQUITY_PAPER_STATUSES,
      equity_convertible_blocks_kind_values: EQUITY_CONVERTIBLE_KINDS,
      equity_convertibles_kind_values: EQUITY_CONVERTIBLE_KINDS,
      equity_convertibles_interestType_values: EQUITY_INTEREST_TYPES,
      equity_convertibles_valuationCapType_values: EQUITY_VALUATION_CAP_TYPES,
      equity_option_grants_optionType_values: EQUITY_OPTION_TYPES,
      equity_access_groups_level_values: EQUITY_ACCESS_LEVELS,
      equity_access_grants_level_values: EQUITY_ACCESS_LEVELS,
      equity_access_grants_requestedLevel_values: EQUITY_ACCESS_LEVELS,
      equity_stakeholder_changes_kind_values: EQUITY_CHANGE_KINDS,
      equity_stakeholder_changes_status_values: EQUITY_CHANGE_STATUSES,
    };
    const rows = await f.owner.$queryRaw<{ conname: string; def: string }[]>`
      SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conname LIKE 'equity\_%\_values'`;
    expect(rows.map((r) => r.conname).sort()).toEqual(Object.keys(expected).sort());
    for (const { conname, def } of rows) {
      const literals = (/'\{([^}]*)\}'::text\[\]/.exec(def)?.[1] ?? "").split(",");
      expect(literals.sort(), conname).toEqual([...(expected[conname] as string[])].sort());
    }
  });

  it("cascades the ledger from its space and user, and unlinks (not deletes) holders and documents", async () => {
    const rows = await f.owner.$queryRaw<{ conname: string; del: string }[]>`
      SELECT conname, confdeltype::text AS del FROM pg_constraint WHERE conname IN (
        'equity_ledgers_spaceId_fkey', 'equity_ledgers_userId_fkey',
        'equity_stakeholders_contactId_spaceId_userId_fkey',
        'equity_document_links_dataRoomItemId_spaceId_userId_fkey')`;
    expect(Object.fromEntries(rows.map((r) => [r.conname, r.del]))).toEqual({
      equity_ledgers_spaceId_fkey: "c",
      equity_ledgers_userId_fkey: "c",
      equity_stakeholders_contactId_spaceId_userId_fkey: "n",
      equity_document_links_dataRoomItemId_spaceId_userId_fkey: "c",
    });
  });
});
