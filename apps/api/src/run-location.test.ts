import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assertRunsOnAllowed } from "./router.js";

const owner = { sandboxProvider: "docker", isDeploymentOwner: true };

describe("assertRunsOnAllowed", () => {
  it("lets the owner pick either place on the Docker sandbox", () => {
    expect(() => assertRunsOnAllowed({ ...owner, runsOn: "this-mac" })).not.toThrow();
    expect(() => assertRunsOnAllowed({ ...owner, runsOn: "docker" })).not.toThrow();
  });

  it("refuses the host for anyone but the deployment owner", () => {
    expect(() =>
      assertRunsOnAllowed({ ...owner, isDeploymentOwner: false, runsOn: "this-mac" }),
    ).toThrow(/forbidden/i);
    expect(() =>
      assertRunsOnAllowed({ ...owner, isDeploymentOwner: false, runsOn: "docker" }),
    ).not.toThrow();
  });

  it("refuses any choice on hosted sandboxes, even from the owner", () => {
    for (const sandboxProvider of ["e2b", "desktop", "fake"]) {
      expect(() => assertRunsOnAllowed({ ...owner, sandboxProvider, runsOn: "this-mac" })).toThrow(
        /Docker sandbox/,
      );
    }
    expect(() =>
      assertRunsOnAllowed({ ...owner, sandboxProvider: "e2b", runsOn: null }),
    ).not.toThrow();
  });
});

describe("bot_runs_on migration", () => {
  it("only adds a nullable bot column, so a saved this-mac default is untouched", () => {
    const sql = readFileSync(
      join(
        __dirname,
        "../../../packages/db/prisma/migrations/20261213000000_bot_runs_on/migration.sql",
      ),
      "utf8",
    );
    expect(sql.replace(/--.*\n/g, "").trim()).toBe('ALTER TABLE "bots" ADD COLUMN "runsOn" TEXT;');
  });
});
