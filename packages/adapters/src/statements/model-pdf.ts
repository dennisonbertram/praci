import { randomUUID } from "node:crypto";
import type { AdapterContext, AgentRunModel, AgentRuntime } from "@rakazo/adapter-kit";
import { ParsedStatementSchema } from "@rakazo/contracts";
import { z } from "zod";
import type { StatementDeps, StatementParser } from "./types.js";

/** What the model fills in; the parser adds `parser`, `currency` and `warnings`. */
const ModelStatementSchema = ParsedStatementSchema.omit({
  parser: true,
  currency: true,
  warnings: true,
}).extend({
  /** ISO 4217 code of the statement's currency, or null when it does not say. */
  currency: z.string().max(8).nullish(),
});

export const MODEL_STATEMENT_JSON_SCHEMA = z.toJSONSchema(ModelStatementSchema);

/** Fallback for any bank's PDF: the configured model reads the extracted text. */
export const modelPdfParser: StatementParser = {
  id: "model-pdf",
  format: "pdf",
  detect: ({ text }) => (text?.trim() ? 0.1 : 0),
  async parse({ text }, { extract }: StatementDeps) {
    if (!text) throw new Error("No PDF text");
    if (!extract) throw new Error("No model is configured to read this PDF");
    const raw = await extract(text, MODEL_STATEMENT_JSON_SCHEMA);
    const read = ModelStatementSchema.safeParse(raw);
    if (!read.success)
      throw new Error(
        `The model's reading of the PDF was invalid: ${read.error.issues[0]?.message}`,
      );
    const { currency, ...data } = read.data;
    const code = currency?.trim().toUpperCase();
    // The product is USD-only. Without a stated currency, a $ sign or "USD" in the text must vouch.
    if (code ? code !== "USD" : !/\$|\bUSD\b/i.test(text)) {
      throw new Error(
        code
          ? `This statement is in ${code.slice(0, 3)}. Only USD statements can be imported.`
          : "This statement does not say it is in USD. Only USD statements can be imported.",
      );
    }
    return {
      ...data,
      parser: "model-pdf",
      currency: "USD",
      warnings: ["Read by an AI model, not a bank format; review every line before importing."],
    };
  },
};

const INSTRUCTIONS = [
  "You extract a bank statement into JSON. Reply with one JSON object only, no prose, matching the given JSON Schema.",
  "Amounts are integer cents: money out is negative, money in is positive. Dates are YYYY-MM-DD.",
  "currency is the ISO 4217 code printed on the statement, e.g. USD, or null. accountLast4 is only the last four digits. Use null for anything the statement does not print. Do not invent lines.",
].join("\n");

/** Builds `deps.extract` on the app's provider-neutral agent runtime, with no tools. */
export function createRuntimeExtract(
  runtime: AgentRuntime,
  model: AgentRunModel,
  ctx: AdapterContext,
): NonNullable<StatementDeps["extract"]> {
  return async (text, schema) => {
    const runId = `statement:${randomUUID()}`;
    let answer = "";
    for await (const event of runtime.run(
      {
        botId: "finance-statements",
        threadId: runId,
        runId,
        prompt: `JSON Schema:\n${JSON.stringify(schema)}\n\nStatement text:\n${text}`,
        instructions: INSTRUCTIONS,
        history: [],
        tools: [],
        model,
      },
      ctx,
    )) {
      if (event.type === "done" && event.text) answer = event.text;
    }
    const json = /\{[\s\S]*\}/.exec(answer)?.[0];
    if (!json) throw new Error("The model did not return JSON");
    try {
      return JSON.parse(json);
    } catch {
      throw new Error("The model returned invalid JSON");
    }
  };
}
