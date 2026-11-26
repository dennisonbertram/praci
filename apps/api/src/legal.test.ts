import type { Actor } from "@rakazo/contracts";
import { describe, expect, test, vi } from "vitest";
import type { LegalDeps } from "./legal.js";
import { legalDoneDeadlines } from "./legal.js";

const actor = { spaceId: "space_1", userId: "user_1" } as Actor;

const contract = {
  id: "contract_1",
  title: "Acme Master Services Agreement",
  contractType: "not_legal",
  spaceId: "space_1",
  userId: "user_1",
};

const deadline = {
  id: "deadline_1",
  contractId: "contract_1",
  dataRoomItemId: null,
  title: "Expires",
  dueDate: new Date("2026-03-01T00:00:00Z"),
  kind: "expiration",
  status: "dismissed",
  sourceQuote: null,
  notes: null,
  removalProposedAt: null,
};

function setup() {
  const deadlineFindMany = vi.fn(async ({ where }: { where: { status?: string } }) =>
    where.status === "dismissed" ? [deadline] : [],
  );
  const contractFindMany = vi.fn(
    async ({ where }: { where: { contractType?: { not: string }; id?: { in: string[] } } }) =>
      [contract].filter(
        (c) =>
          (!where.contractType || c.contractType !== where.contractType.not) &&
          (!where.id || where.id.in.includes(c.id)),
      ),
  );
  const prisma = {
    legalDeadline: { findMany: deadlineFindMany },
    legalContract: { findMany: contractFindMany },
  };
  return { deps: { prisma } as unknown as LegalDeps, contractFindMany };
}

describe("legalDoneDeadlines", () => {
  test("names the contract of a done deadline even when it was reclassified as not legal", async () => {
    const { deps } = setup();
    const [row] = await legalDoneDeadlines(deps, actor);
    expect(row?.contractTitle).toBe(contract.title);
  });

  test("looks the titles up scoped to the space and the user", async () => {
    const { deps, contractFindMany } = setup();
    await legalDoneDeadlines(deps, actor);
    const lookup = contractFindMany.mock.calls
      .map(([args]) => args.where)
      .find((where) => where.id);
    expect(lookup).toMatchObject({
      id: { in: ["contract_1"] },
      spaceId: "space_1",
      userId: "user_1",
    });
  });
});
