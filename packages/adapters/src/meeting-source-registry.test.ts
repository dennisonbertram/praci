import { describe, expect, it } from "vitest";
import { createMeetingSourceRegistry } from "./meeting-source-registry.js";

describe("meeting source registry", () => {
  it("ends every provider request when the run's signal aborts", async () => {
    let seen: AbortSignal | null | undefined;
    const hanging = ((_url: unknown, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        seen = init?.signal;
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      })) as typeof fetch;
    const controller = new AbortController();
    const source = createMeetingSourceRegistry({ fetch: hanging }).granola?.create(
      { spaceId: "s", userId: "u", connectionId: "c", apiKey: "k" },
      controller.signal,
    );
    const call = source?.list({});
    controller.abort();
    await expect(call).rejects.toMatchObject({ kind: "unavailable" });
    expect(seen?.aborted).toBe(true);
  });
});
