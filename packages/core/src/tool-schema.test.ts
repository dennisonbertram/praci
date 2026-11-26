import { describe, expect, it } from "vitest";
import { validateToolInput, validateToolInputSchema } from "./tool-schema.js";

const schema = {
  type: "object",
  required: ["transactions"],
  properties: {
    transactions: {
      type: "array",
      items: {
        type: "object",
        required: ["amount"],
        properties: { amount: { type: "number" }, date: { type: "string" } },
      },
    },
  },
};

describe("tool input schema", () => {
  it("accepts the supported subset and rejects other keywords", () => {
    expect(validateToolInputSchema(schema)).toBeUndefined();
    expect(validateToolInputSchema({ type: "array" })).toBeDefined();
    expect(validateToolInputSchema({ type: "object", $ref: "#/x" })).toMatch(/not supported/);
    expect(
      validateToolInputSchema({ type: "object", properties: { a: { type: "date" } } }),
    ).toBeDefined();
  });

  it("validates input against it", () => {
    expect(
      validateToolInput(schema, { transactions: [{ amount: 3, date: "2026-01-01" }] }),
    ).toBeUndefined();
    expect(validateToolInput(schema, {})).toMatch(/transactions is required/);
    expect(validateToolInput(schema, { transactions: [{ amount: "3" }] })).toMatch(
      /amount must be a number/,
    );
    expect(validateToolInput(schema, { transactions: "x" })).toMatch(/must be a list/);
    expect(
      validateToolInput({ type: "object", properties: { n: { type: "integer" } } }, { n: 1.5 }),
    ).toMatch(/integer/);
  });
});
