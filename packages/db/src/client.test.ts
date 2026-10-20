import pg from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDb,
  createPool,
  isDatabaseInterruption,
  isTooManyDatabaseConnections,
  Prisma,
  parsePositiveInteger,
  retryOnTooManyConnections,
} from "./client.js";

const pools: Array<{ end: () => Promise<void> }> = [];

afterEach(async () => {
  await Promise.all(pools.splice(0).map((pool) => pool.end()));
});

describe("createDb", () => {
  it("caps the pg pool and swallows idle-client errors so they cannot crash the process", () => {
    const { pool } = createDb("postgres://rakazo:rakazo@127.0.0.1:9/rakazo", {
      poolMax: 3,
      applicationName: "rakazo-test",
    });
    pools.push(pool);

    expect(pool.options.max).toBe(3);
    expect(pool.options.connectionTimeoutMillis).toBe(10_000);
    expect(pool.options.idleTimeoutMillis).toBe(0);
    expect(pool.options.application_name).toBe("rakazo-test");
    expect(pool.listenerCount("error")).toBeGreaterThan(0);
    expect(pool.listenerCount("connect")).toBeGreaterThan(0);

    expect(() => pool.emit("error", new Error("idle client lost"))).not.toThrow();
  });

  it("defaults to a four-connection pool", () => {
    const { pool } = createDb("postgres://rakazo:rakazo@127.0.0.1:9/rakazo");
    pools.push(pool);
    expect(pool.options.max).toBe(4);
  });
});

describe("parsePositiveInteger", () => {
  it("falls back when the value is missing, zero, or not an integer", () => {
    expect(parsePositiveInteger(undefined, 8)).toBe(8);
    expect(parsePositiveInteger("0", 8)).toBe(8);
    expect(parsePositiveInteger("nope", 8)).toBe(8);
    expect(parsePositiveInteger("6", 8)).toBe(6);
  });
});

describe("isTooManyDatabaseConnections", () => {
  it("recognises Prisma P2037 and Postgres 53300", () => {
    expect(isTooManyDatabaseConnections({ code: "P2037" })).toBe(true);
    expect(isTooManyDatabaseConnections({ code: "53300" })).toBe(true);
    expect(
      isTooManyDatabaseConnections(
        new Error("Too many database connections opened: sorry, too many clients already"),
      ),
    ).toBe(true);
    expect(isTooManyDatabaseConnections(new Error("relation does not exist"))).toBe(false);
    expect(isTooManyDatabaseConnections(undefined)).toBe(false);
  });

  it("walks a nested cause, matching the pg-pool unhandledRejection shape", () => {
    const root = Object.assign(new Error("sorry, too many clients already"), { code: "53300" });
    expect(isTooManyDatabaseConnections(new Error("pool.connect failed", { cause: root }))).toBe(
      true,
    );
  });
});

describe("retryOnTooManyConnections", () => {
  it("retries 53300 and returns the first success", async () => {
    const sleep = vi.fn(async () => undefined);
    let attempts = 0;
    const result = await retryOnTooManyConnections(
      async () => {
        attempts += 1;
        if (attempts < 3) {
          throw Object.assign(new Error("sorry, too many clients already"), { code: "53300" });
        }
        return "ok";
      },
      { sleep },
    );
    expect(result).toBe("ok");
    expect(attempts).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("does not retry unrelated failures", async () => {
    const error = new Error("relation does not exist");
    await expect(
      retryOnTooManyConnections(async () => {
        throw error;
      }),
    ).rejects.toBe(error);
  });
});

describe("createPool", () => {
  it("builds a bounded pool with connect-retry and idle-error listeners", () => {
    const pool = createPool("postgres://rakazo:rakazo@127.0.0.1:9/rakazo", {
      poolMax: 2,
      applicationName: "rakazo-pool-test",
    });
    pools.push(pool);
    expect(pool.options.max).toBe(2);
    expect(pool.options.connectionTimeoutMillis).toBe(10_000);
    expect(pool.options.idleTimeoutMillis).toBe(0);
    expect(pool.options.application_name).toBe("rakazo-pool-test");
    expect(pool.listenerCount("error")).toBeGreaterThan(0);
    expect(pool.listenerCount("connect")).toBeGreaterThan(0);
    expect(() => pool.emit("error", new Error("idle client lost"))).not.toThrow();
  });
});

describe("isDatabaseInterruption", () => {
  const known = (code: string, message: string) =>
    new Prisma.PrismaClientKnownRequestError(message, { code, clientVersion: "7.10.0" });

  it("counts the errors Prisma 7 raised while Postgres restarted", () => {
    for (const error of [
      known("P2039", "the database system is shutting down"),
      known(
        "P2010",
        "Raw query failed. Code: `57P03`. Message: `the database system is starting up`",
      ),
      known("P2010", "Raw query failed. Message: `Server has closed the connection.`"),
      known("P2010", "Can't reach database server at `127.0.0.1:5432`"),
    ]) {
      expect(isDatabaseInterruption(error)).toBe(true);
    }
  });

  it("counts a pg server error and a Prisma error that wraps one", () => {
    const shutdown = new pg.DatabaseError(
      "terminating connection due to administrator command",
      0,
      "error",
    );
    shutdown.code = "57P01";
    shutdown.severity = "FATAL";
    expect(isDatabaseInterruption(shutdown)).toBe(true);
    const startup = new pg.DatabaseError("the database system is starting up", 0, "error");
    startup.code = "57P03";
    startup.severity = "FATAL";
    expect(isDatabaseInterruption(new Error("query failed", { cause: startup }))).toBe(true);
  });

  it("ignores the same words from outside the database stack", () => {
    for (const error of [
      new Error("MCP server: Server has closed the connection"),
      new Error("Can't reach database server"),
      new TypeError("fetch failed", {
        cause: Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }),
      }),
      known("P2002", "Unique constraint failed on the fields: (`id`)"),
    ]) {
      expect(isDatabaseInterruption(error)).toBe(false);
    }
  });
});
