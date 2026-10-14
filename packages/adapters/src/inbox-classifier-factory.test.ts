import { describe, expect, it } from "vitest";
import {
  createInboxClassifierProvider,
  inboxClassifierSelected,
} from "./inbox-classifier-factory.js";

const on = { RAKAZO_INBOX_CLASSIFIER_PROVIDER: "typesafe", TYPESAFE_API_KEY: "ts-key" };

describe("inbox classifier selection", () => {
  it("is off with no configuration, so core runs on the LLM alone", () => {
    expect(inboxClassifierSelected({})).toBe(false);
    expect(createInboxClassifierProvider({})).toBeNull();
  });

  it("stays off when only the shared TypeSafe key is set for Auto Review", () => {
    expect(createInboxClassifierProvider({ TYPESAFE_API_KEY: "ts-key" })).toBeNull();
  });

  it("stays off when typesafe is selected without a key", () => {
    const env = { RAKAZO_INBOX_CLASSIFIER_PROVIDER: "typesafe", TYPESAFE_API_KEY: "  " };
    expect(inboxClassifierSelected(env)).toBe(false);
    expect(createInboxClassifierProvider(env)).toBeNull();
  });

  it("ignores any other selector value", () => {
    expect(
      createInboxClassifierProvider({ ...on, RAKAZO_INBOX_CLASSIFIER_PROVIDER: "llm" }),
    ).toBeNull();
  });

  it("builds the TypeSafe adapter from the shared key and the optional model", async () => {
    const bodies: Array<{ model: string }> = [];
    const provider = createInboxClassifierProvider(
      { ...on, RAKAZO_INBOX_CLASSIFIER_MODEL: "jev-special" },
      {
        fetch: async (_url, init) => {
          bodies.push(JSON.parse(String(init?.body)));
          return new Response("{}", { status: 500 });
        },
      },
    );
    expect(provider?.describe().id).toBe("typesafe");
    await provider?.classify(
      [
        {
          id: "a",
          from: "a@b.test",
          to: [],
          cc: [],
          subject: "s",
          snippet: "",
          receivedAt: "2026-10-12T00:00:00Z",
          addressedToMe: true,
          threadLength: 1,
        },
      ],
      {
        operationId: "o",
        traceId: "t",
        spaceId: "s",
        userId: "u",
        signal: new AbortController().signal,
      },
    );
    expect(bodies[0]?.model).toBe("jev-special");
  });
});
