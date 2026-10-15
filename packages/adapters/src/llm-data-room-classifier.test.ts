import type { AdapterContext, AgentRunRequest, AgentRuntime } from "@rakazo/adapter-kit";
import { DataRoomClassificationSchema } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import {
  DATA_ROOM_TEXT_LIMIT,
  DataRoomClassifierError,
  LlmDataRoomClassifier,
  truncateDocumentText,
} from "./llm-data-room-classifier.js";

const context: AdapterContext = {
  operationId: "dr",
  traceId: "dr",
  spaceId: "space",
  userId: "user",
  signal: new AbortController().signal,
};

const valid = {
  docType: "contract",
  title: "Northwind Labs services agreement",
  docDate: "2025-03-01",
  parties: ["Northwind Labs"],
  amountCents: 1200000,
  currency: "USD",
  summary: "Annual services agreement.",
  tags: ["services"],
  folderPath: ["Contracts", "Northwind Labs"],
  confidence: 0.9,
};

function make(reply: string) {
  const requests: AgentRunRequest[] = [];
  const runtime = {
    run: async function* (request: AgentRunRequest) {
      requests.push(request);
      yield { type: "done" as const, text: reply };
    },
  } as unknown as AgentRuntime;
  const classifier = new LlmDataRoomClassifier({
    runtime,
    model: { provider: "openrouter", id: "m" },
  });
  return { classifier, requests };
}
const input = (over: Partial<{ text: string; folders: string[][] }> = {}) => ({
  name: "agreement.pdf",
  mimeType: "application/pdf",
  text: "Agreement with Northwind Labs",
  folders: [] as string[][],
  ...over,
});

describe("LlmDataRoomClassifier.classify", () => {
  it("parses a valid answer, including fenced JSON", async () => {
    const { classifier } = make(`\`\`\`json\n${JSON.stringify(valid)}\n\`\`\``);
    expect(await classifier.classify(input(), context)).toEqual(valid);
  });

  it("throws a typed error on invalid JSON", async () => {
    const { classifier } = make("not json");
    await expect(classifier.classify(input(), context)).rejects.toBeInstanceOf(
      DataRoomClassifierError,
    );
  });

  it("throws a typed error on a schema violation", async () => {
    const { classifier } = make(JSON.stringify({ ...valid, docType: "poem" }));
    await expect(classifier.classify(input(), context)).rejects.toBeInstanceOf(
      DataRoomClassifierError,
    );
  });

  it("snaps a path that differs only by case or spacing to the existing folder", async () => {
    const { classifier } = make(
      JSON.stringify({ ...valid, folderPath: ["contracts", " northwind  labs"] }),
    );
    const out = await classifier.classify(
      input({ folders: [["Contracts", "Northwind Labs"]] }),
      context,
    );
    expect(out.folderPath).toEqual(["Contracts", "Northwind Labs"]);
  });

  it("repairs a long summary, uppercase tags, a slash and an out-of-range confidence", async () => {
    const { classifier } = make(
      JSON.stringify({
        ...valid,
        summary: "s".repeat(700),
        tags: ["Services", " services ", ""],
        currency: "usd",
        confidence: 1.4,
        folderPath: ["Contracts/2025"],
      }),
    );
    const out = await classifier.classify(input(), context);
    expect(out.summary).toHaveLength(600);
    expect(out.tags).toEqual(["services"]);
    expect(out.currency).toBe("USD");
    expect(out.confidence).toBe(1);
    expect(out.folderPath).toEqual(["Contracts-2025"]);
  });

  it("still fails on an unknown docType or an empty folder path", async () => {
    for (const bad of [{ docType: "poem" }, { folderPath: [" ", ""] }]) {
      const { classifier } = make(JSON.stringify({ ...valid, ...bad }));
      await expect(classifier.classify(input(), context)).rejects.toBeInstanceOf(
        DataRoomClassifierError,
      );
    }
  });

  it("allows a brand-new folder path", async () => {
    const { classifier } = make(JSON.stringify({ ...valid, folderPath: ["Legal", "NDAs"] }));
    const out = await classifier.classify(input({ folders: [["Contracts"]] }), context);
    expect(out.folderPath).toEqual(["Legal", "NDAs"]);
  });

  it("sends existing folders and truncates long text keeping head and tail", async () => {
    const text = `HEAD${"x".repeat(100_000)}TAIL`;
    const { classifier, requests } = make(JSON.stringify(valid));
    await classifier.classify(input({ text, folders: [["Contracts"]] }), context);
    const prompt = requests[0]?.prompt ?? "";
    expect(prompt).toContain("Contracts");
    expect(prompt).toContain("HEAD");
    expect(prompt).toContain("TAIL");
    expect(prompt.length).toBeLessThan(DATA_ROOM_TEXT_LIMIT + 1000);
  });
});

describe("truncateDocumentText", () => {
  it("leaves short text alone", () => {
    expect(truncateDocumentText("short")).toBe("short");
  });
});

describe("LlmDataRoomClassifier.planQuery", () => {
  it("passes today and returns the scripted plan", async () => {
    const plan = {
      query: "",
      filters: {
        docType: "contract",
        parties: ["Northwind"],
        dateFrom: "2025-01-01",
        dateTo: "2025-12-31",
      },
    };
    const { classifier, requests } = make(JSON.stringify(plan));
    const out = await classifier.planQuery(
      { question: "contracts with Northwind from last year", today: "2026-10-15" },
      context,
    );
    expect(out).toEqual(plan);
    expect(requests[0]?.instructions).toContain("2026-10-15");
  });

  it("throws a typed error on a bad date", async () => {
    const { classifier } = make(JSON.stringify({ query: "x", filters: { dateFrom: "last year" } }));
    await expect(
      classifier.planQuery({ question: "q", today: "2026-10-15" }, context),
    ).rejects.toBeInstanceOf(DataRoomClassifierError);
  });
});

describe("DataRoomClassificationSchema", () => {
  it("rejects over-long and malformed fields", () => {
    for (const bad of [
      { title: "t".repeat(201) },
      { summary: "s".repeat(601) },
      { parties: Array.from({ length: 21 }, () => "p") },
      { tags: Array.from({ length: 13 }, () => "t") },
      { tags: ["Upper"] },
      { folderPath: [] },
      { folderPath: ["a", "b", "c", "d", "e"] },
      { folderPath: ["a/b"] },
      { folderPath: ["f".repeat(81)] },
      { confidence: 1.5 },
      { amountCents: 1.5 },
    ]) {
      expect(DataRoomClassificationSchema.safeParse({ ...valid, ...bad }).success).toBe(false);
    }
  });
});
