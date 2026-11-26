import { RPCHandler } from "@orpc/server/fetch";
import type { Actor } from "@rakazo/contracts";
import { createEquityConvertible, createEquityStakeholder } from "@rakazo/db";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  describeEquityPostgres,
  equityFixture,
} from "../../../../packages/db/src/equity/test-fixture.js";
import type { RouterDeps } from "../router.js";
import { createRouter } from "../router.js";

describeEquityPostgres("convertible closure through HTTP RPC", () => {
  let fixture: Awaited<ReturnType<typeof equityFixture>>;
  let handler: RPCHandler<never>;
  let actor: Actor;
  let convertibleId: string;

  beforeAll(async () => {
    fixture = await equityFixture("closure-http");
    const now = new Date();
    const space = await fixture.owner.space.findUniqueOrThrow({
      where: { id: fixture.mine.spaceId },
      select: { organizationId: true },
    });
    await fixture.owner.member.create({
      data: {
        id: `${fixture.mine.userId}-member`,
        organizationId: space.organizationId,
        userId: fixture.mine.userId,
        role: "owner",
        createdAt: now,
      },
    });
    await fixture.owner.spaceMember.create({
      data: {
        id: `${fixture.mine.userId}-space-member`,
        organizationId: space.organizationId,
        spaceId: fixture.mine.spaceId,
        userId: fixture.mine.userId,
        role: "owner",
        createdAt: now,
      },
    });
    actor = {
      ...fixture.mine,
      email: `${fixture.mine.userId}@example.test`,
      isDeploymentOwner: true,
    };
    const deps = {
      prisma: fixture.prisma,
      env: {
        agentRuntime: "scripted",
        defaultProvider: "fake",
        defaultModel: "fake-model",
        webOrigin: "http://127.0.0.1:5173",
        screenProxySecret: "fake-test-secret",
        sandboxProvider: "fake",
      },
      dataDir: ".",
    } as unknown as RouterDeps;
    handler = new RPCHandler(createRouter(deps));
    const stakeholder = await fixture.as(fixture.mine, () =>
      createEquityStakeholder(fixture.prisma, fixture.mine, {
        type: "individual",
        name: "Closure HTTP Test",
      }),
    );
    const note = await fixture.as(fixture.mine, () =>
      createEquityConvertible(fixture.prisma, fixture.mine, {
        stakeholderId: stakeholder.id,
        kind: "note",
        principalCents: "100000",
        issueDate: "2024-01-01",
        interestRate: "10",
        interestStartDate: "2024-01-01",
        interestType: "simple",
        dayCountConvention: "actual_365",
      }),
    );
    convertibleId = note.id;
  });

  afterAll(async () => fixture?.close());

  it("repays, edits clerical metadata, and reads stable interest over HTTP", async () => {
    const call = async (path: string, input: unknown) => {
      const { matched, response } = await handler.handle(
        new Request(`http://127.0.0.1/rpc/${path}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ json: input }),
        }),
        { prefix: "/rpc", context: { actor } },
      );
      expect(matched).toBe(true);
      expect(response.status).toBe(200);
      return (await response.json()).json;
    };
    const repaid = await call("equity/convertibles/update", {
      id: convertibleId,
      status: "repaid",
      closedOn: "2024-12-31",
    });
    const interest = repaid.interestAccruedCents;
    expect(repaid.closedOn).toBe("2024-12-31");
    const edited = await call("equity/convertibles/update", {
      id: convertibleId,
      label: "CN-99",
      adminNotes: "Reconciled",
    });
    const fetched = await call("equity/convertibles/get", { id: convertibleId });
    expect(edited.interestAccruedCents).toBe(interest);
    expect(fetched).toMatchObject({
      label: "CN-99",
      closedOn: "2024-12-31",
      interestAccruedCents: interest,
    });
  });
});
