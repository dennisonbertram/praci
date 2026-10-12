import type { AdapterContext, RealtimeFanout } from "@rakazo/adapter-kit";
import { createLogger, createTestSink, getLogger, installLogger } from "@rakazo/logging";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryRealtimeFanout } from "./realtime.js";
import { secretRefDigest, secretRefMatches } from "./secret-changes.js";
import { ComposedSecretStore } from "./secret-store-factory.js";
import { EncryptedSecretStore } from "./secrets.js";

const context: AdapterContext = {
  operationId: "test",
  traceId: "test",
  spaceId: "w1",
  userId: "u1",
  signal: new AbortController().signal,
};

// PostgreSQL rejects a NOTIFY payload of 8000 bytes or more; PostgresRealtimeFanout enforces 7,900.
const NOTIFY_LIMIT_BYTES = 7_900;

/** Behaves like the PostgreSQL fanout for oversized payloads and records what it was asked to send. */
class LimitedFanout extends InMemoryRealtimeFanout implements RealtimeFanout {
  readonly sent: string[] = [];
  override async publish(topic: string, payload: string): Promise<void> {
    if (Buffer.byteLength(JSON.stringify({ topic, payload }), "utf8") > NOTIFY_LIMIT_BYTES)
      throw new Error("Realtime signal exceeds the PostgreSQL NOTIFY payload limit");
    this.sent.push(payload);
    return super.publish(topic, payload);
  }
}

const previousLogger = getLogger();
afterEach(() => installLogger(previousLogger));

describe("secret change notifications", () => {
  it("logs the error class and message when a notification cannot be published, never the secret", async () => {
    const sink = createTestSink();
    installLogger(createLogger({ service: "test", sinks: [sink] }));
    const fanout = new InMemoryRealtimeFanout();
    vi.spyOn(fanout, "publish").mockRejectedValue(new TypeError("fake publish failure"));
    const store = new ComposedSecretStore(new EncryptedSecretStore("key"), undefined, fanout);
    await store.start();
    await store.put("fake-plaintext-credential", context);
    const warning = sink.events.find(
      (event) => event.message === "Secret change notification failed",
    );
    expect(warning).toMatchObject({
      level: "warn",
      "error.name": "TypeError",
      "error.message": "fake publish failure",
    });
    expect(JSON.stringify(sink.events)).not.toContain("fake-plaintext-credential");
    await store.close();
    await fanout.close();
  });

  it("notifies another store instance when the credential is too large to fit in a NOTIFY payload", async () => {
    const fanout = new LimitedFanout();
    const writer = new ComposedSecretStore(new EncryptedSecretStore("key"), undefined, fanout);
    const reader = new ComposedSecretStore(new EncryptedSecretStore("key"), undefined, fanout);
    await writer.start();
    await reader.start();
    const listener = vi.fn();
    reader.onChange(listener);
    const record = await writer.put(JSON.stringify({ tokens: "t".repeat(9_000) }), context);
    expect(listener).toHaveBeenCalledTimes(1);
    // The encrypted ref is the ciphertext itself, so it must not be broadcast.
    expect(fanout.sent.join("")).not.toContain(record.ref);
    await writer.close();
    await reader.close();
    await fanout.close();
  });

  it("notifies another store instance when a large credential is deleted", async () => {
    const fanout = new LimitedFanout();
    const writer = new ComposedSecretStore(new EncryptedSecretStore("key"), undefined, fanout);
    const reader = new ComposedSecretStore(new EncryptedSecretStore("key"), undefined, fanout);
    await writer.start();
    await reader.start();
    const record = await writer.put("t".repeat(9_000), context);
    const listener = vi.fn();
    reader.onChange(listener);
    await writer.delete(record.ref, record.id);
    expect(listener).toHaveBeenCalledTimes(1);
    await writer.close();
    await reader.close();
    await fanout.close();
  });
});

describe("secret change notice format", () => {
  it("hands listeners in other processes the digest of the changed ref", async () => {
    const fanout = new InMemoryRealtimeFanout();
    const writer = new ComposedSecretStore(new EncryptedSecretStore("key"), undefined, fanout);
    const reader = new ComposedSecretStore(new EncryptedSecretStore("key"), undefined, fanout);
    await writer.start();
    await reader.start();
    const listener = vi.fn();
    reader.onChange(listener);
    const record = await writer.put("fake-credential", context);
    expect(listener).toHaveBeenCalledExactlyOnceWith(secretRefDigest(record.ref));
    expect(secretRefMatches(record.ref, listener.mock.calls[0]![0])).toBe(true);
    expect(secretRefMatches("some-other-ref", listener.mock.calls[0]![0])).toBe(false);
    await writer.close();
    await reader.close();
    await fanout.close();
  });

  it("still accepts a notice from an older process that carries the ref itself", async () => {
    const fanout = new InMemoryRealtimeFanout();
    const store = new ComposedSecretStore(new EncryptedSecretStore("key"), undefined, fanout);
    await store.start();
    const listener = vi.fn();
    store.onChange(listener);
    await fanout.publish(
      "secret-store-change",
      JSON.stringify({ origin: "older-process", ref: "v2:fake-ref" }),
    );
    expect(listener).toHaveBeenCalledExactlyOnceWith("v2:fake-ref");
    expect(secretRefMatches("v2:fake-ref", "v2:fake-ref")).toBe(true);
    await store.close();
    await fanout.close();
  });

  it("ignores its own notices", async () => {
    const fanout = new InMemoryRealtimeFanout();
    const store = new ComposedSecretStore(new EncryptedSecretStore("key"), undefined, fanout);
    await store.start();
    const listener = vi.fn();
    store.onChange(listener);
    await store.put("fake-credential", context);
    expect(listener).toHaveBeenCalledTimes(1);
    await store.close();
    await fanout.close();
  });
});
