import { createDb, runAsSystem } from "@rakazo/db";
import { afterAll, expect, it } from "vitest";
import { createAuth } from "./index.js";

// Needs DATABASE_URL as the runtime login and DATABASE_MIGRATION_URL as the owner, after
// `pnpm db:migrate`: VERIFY_DATABASE=1 pnpm vitest run packages/auth/src/delete-account.postgres.test.ts
const appUrl = process.env.DATABASE_URL;
const ownerUrl = process.env.DATABASE_MIGRATION_URL;
const wanted = Boolean(process.env.VERIFY_DATABASE);
const run = wanted && appUrl && ownerUrl;

const app = run ? createDb(appUrl as string) : undefined;
const ownerDb = run ? createDb(ownerUrl as string) : undefined;

afterAll(async () => {
  await app?.prisma.$disconnect();
  await ownerDb?.prisma.$disconnect();
});

// When a database run is asked for (VERIFY_DATABASE) both URLs are required: a missing owner
// URL would otherwise make the runtime login create the fixtures and skip this test unnoticed.
it.runIf(wanted)("has both database URLs", () => {
  expect(appUrl, "DATABASE_URL (runtime login)").toBeTruthy();
  expect(ownerUrl, "DATABASE_MIGRATION_URL (owner login)").toBeTruthy();
});

it.runIf(run)("runs as a login that row-level security applies to", async () => {
  const [role] = await app!.prisma.$queryRaw<{ ok: boolean }[]>`
    SELECT NOT (rolsuper OR rolbypassrls) AS ok FROM pg_roles WHERE rolname = current_user`;
  expect(role?.ok).toBe(true);
});

it.runIf(run)(
  "deleting an account removes its personal space and the cap table in it",
  async () => {
    const prisma = app!.prisma;
    const owner = ownerDb!.prisma;
    const origin = "http://127.0.0.1:5173";
    const auth = createAuth(prisma, {
      secret: "test-secret-that-is-long-enough-for-better-auth",
      baseURL: "http://127.0.0.1:3100",
      webOrigin: origin,
      signupsEnabled: "true",
      signupAllowlist: undefined,
    });
    const email = `cap-delete-${process.pid}-${Date.now()}@example.test`;
    const password = "correct-horse-battery-staple";
    const headers = { "content-type": "application/json", origin };

    const signup = await runAsSystem("account deletion test", () =>
      auth.handler(
        new Request("http://127.0.0.1:3100/api/auth/sign-up/email", {
          method: "POST",
          headers,
          body: JSON.stringify({ email, password, name: "Cap Delete" }),
        }),
      ),
    );
    expect(signup.status).toBe(200);
    const cookie = signup.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    const user = await owner.user.findUniqueOrThrow({ where: { email } });
    const member = await owner.spaceMember.findFirstOrThrow({ where: { userId: user.id } });
    const scope = { spaceId: member.spaceId, userId: user.id };

    await owner.equityLedger.create({ data: scope });
    const contact = await owner.contact.create({ data: { ...scope, name: "Linked contact" } });
    const holder = await owner.equityStakeholder.create({
      data: { ...scope, type: "individual", name: "Holder", contactId: contact.id },
    });
    const shareClass = await owner.equityShareClass.create({
      data: { ...scope, name: "Common", classType: "common", prefix: "C" },
    });
    const certificate = await owner.equityCertificate.create({
      data: {
        ...scope,
        label: "C-1",
        stakeholderId: holder.id,
        shareClassId: shareClass.id,
        quantity: 1n,
        issueDate: new Date("2024-01-01T00:00:00.000Z"),
      },
    });
    await owner.equityTransaction.create({
      data: {
        ...scope,
        kind: "issue",
        effectiveDate: new Date("2024-01-01T00:00:00.000Z"),
        certificateId: certificate.id,
      },
    });

    const response = await runAsSystem("account deletion test", () =>
      auth.handler(
        new Request("http://127.0.0.1:3100/api/auth/delete-user", {
          method: "POST",
          headers: { ...headers, cookie },
          body: JSON.stringify({ password }),
        }),
      ),
    );
    expect(response.status).toBe(200);

    expect(await owner.user.count({ where: { id: user.id } })).toBe(0);
    expect(await owner.space.count({ where: { id: scope.spaceId } })).toBe(0);
    expect(await owner.equityLedger.count({ where: scope })).toBe(0);
    expect(await owner.equityCertificate.count({ where: scope })).toBe(0);
    expect(await owner.equityTransaction.count({ where: scope })).toBe(0);
  },
);
