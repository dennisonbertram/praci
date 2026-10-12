import type { AdapterContext } from "@rakazo/adapter-kit";
import { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import { PostgresRealtimeFanout } from "./realtime.js";
import { ComposedSecretStore } from "./secret-store-factory.js";
import { EncryptedSecretStore } from "./secrets.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres = process.env.VERIFY_DATABASE && databaseUrl ? describe : describe.skip;

const context: AdapterContext = {
  operationId: "test",
  traceId: "test",
  spaceId: "w1",
  userId: "u1",
  signal: new AbortController().signal,
};

describePostgres("secret change notifications (PostgreSQL)", () => {
  it.each([
    ["small", 20],
    ["OAuth-sized", 9_000],
  ])(
    "a %s put in one store instance reaches a second instance through NOTIFY",
    async (_name, size) => {
      // Two pools and two fanouts stand in for the API and worker processes.
      const pools = [
        new Pool({ connectionString: databaseUrl! }),
        new Pool({ connectionString: databaseUrl! }),
      ];
      const fanouts = pools.map(
        (pool) => new PostgresRealtimeFanout({ connectionString: databaseUrl!, publisher: pool }),
      );
      const [writer, reader] = fanouts.map(
        (fanout) => new ComposedSecretStore(new EncryptedSecretStore("key"), undefined, fanout),
      ) as [ComposedSecretStore, ComposedSecretStore];
      try {
        await writer.start();
        await reader.start();
        const listener = vi.fn();
        reader.onChange(listener);
        // The listener connects asynchronously and signals catch-up when ready; wait for a real signal path.
        await new Promise((resolve) => setTimeout(resolve, 500));
        await writer.put("x".repeat(size), context);
        await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(1), { timeout: 5_000 });
      } finally {
        await writer.close();
        await reader.close();
        await Promise.all(fanouts.map((fanout) => fanout.close()));
        await Promise.all(pools.map((pool) => pool.end()));
      }
    },
  );
});
