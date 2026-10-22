import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { eventIterator, isContractProcedure, oc } from "@orpc/contract";
import { describe, expect, it } from "vitest";
import * as z from "zod";
import { createOpenAPIDocument, renderOpenAPIDocument } from "./openapi.js";
import { startLocalHealthServer } from "./openapi-test-server.js";
import { appContract } from "./rpc.js";

type Operation = {
  description?: string;
  operationId: string;
  parameters: Array<{
    name: string;
    in: string;
    required: boolean;
    schema: Record<string, unknown>;
  }>;
  requestBody: {
    required: boolean;
    content: Record<string, { schema: Record<string, unknown> }>;
  };
  responses: Record<
    string,
    {
      content?: Record<string, { schema?: Record<string, unknown> }>;
    }
  >;
  security?: Array<Record<string, string[]>>;
};

function collectContractPaths(contract: unknown, prefix = ""): string[] {
  if (isContractProcedure(contract)) return [`/rpc/${prefix}`];
  if (!contract || typeof contract !== "object") return [];
  return Object.entries(contract)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .flatMap(([key, value]) => collectContractPaths(value, prefix ? `${prefix}/${key}` : key));
}

function operationAt(document: ReturnType<typeof createOpenAPIDocument>, path: string): Operation {
  return document.paths[path]!.post as Operation;
}

describe("OpenAPI export", () => {
  it("covers every appContract procedure with a stable sorted RPC path", () => {
    const document = createOpenAPIDocument();
    const expectedPaths = collectContractPaths(appContract);

    expect(Object.keys(document.paths)).toEqual(expectedPaths);
    expect(Object.keys(document.paths)).toHaveLength(expectedPaths.length);
    expect(document.openapi).toBe("3.1.0");
    expect(renderOpenAPIDocument()).toBe(renderOpenAPIDocument());
    const references: string[] = [];
    const collectReferences = (value: unknown): void => {
      if (Array.isArray(value)) {
        value.forEach(collectReferences);
      } else if (value && typeof value === "object") {
        const reference = (value as Record<string, unknown>).$ref;
        if (typeof reference === "string" && reference.startsWith("#/components/schemas/")) {
          references.push(reference.slice("#/components/schemas/".length).split("/")[0]!);
        }
        Object.values(value).forEach(collectReferences);
      }
    };
    collectReferences(document);
    expect(references.length).toBeGreaterThan(0);
    expect(references.every((name) => document.components.schemas[name] !== undefined)).toBe(true);
    expect(renderOpenAPIDocument()).toBe(
      readFileSync(
        fileURLToPath(
          new URL(
            "../../../apps/ios/Packages/RakazoAPI/Sources/RakazoAPI/openapi.json",
            import.meta.url,
          ),
        ),
        "utf8",
      ),
    );
  });

  it("documents the no-input health envelope, optional origin, bearer auth, and error envelope", () => {
    const document = createOpenAPIDocument();
    const health = operationAt(document, "/rpc/health");
    const healthRequest = health.requestBody.content["application/json"]!.schema;
    const healthResponse = health.responses["200"]!.content!["application/json"]!.schema;
    const healthOutput = document.components.schemas.HealthResponse!.properties as Record<
      string,
      Record<string, unknown>
    >;
    const healthResult = healthOutput.json!.properties as Record<string, Record<string, unknown>>;

    expect(healthRequest.required).toBeUndefined();
    expect(healthResponse).toEqual({ $ref: "#/components/schemas/HealthResponse" });
    expect((healthRequest.properties as Record<string, Record<string, unknown>>).json).toEqual({
      description: "This procedure has no input.",
    });
    expect(healthResult.ok!.const).toBe(true);
    expect(health.security).toBeUndefined();
    expect(health.parameters.find(({ name }) => name === "Origin")).toMatchObject({
      required: false,
      schema: { example: "rakazo://" },
    });

    const protectedOperation = operationAt(document, "/rpc/me");
    expect(protectedOperation.security).toEqual([{ BearerAuth: [] }]);
    expect(
      protectedOperation.parameters.find(({ name }) => name === "x-rakazo-space-id")?.required,
    ).toBe(false);
    expect(protectedOperation.responses["401"]).toEqual({
      $ref: "#/components/responses/Http401",
    });
    expect(protectedOperation.responses.default).toEqual({
      $ref: "#/components/responses/OtherORPCError",
    });
    expect(document.components.responses.Http401).toEqual({
      description: "Unauthenticated",
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["json"],
            properties: { json: { $ref: "#/components/schemas/RPCError" } },
          },
        },
      },
    });
    expect(Object.keys(protectedOperation.responses)).toEqual([
      "200",
      "400",
      "401",
      "402",
      "403",
      "404",
      "405",
      "406",
      "408",
      "409",
      "410",
      "412",
      "413",
      "415",
      "422",
      "428",
      "429",
      "499",
      "500",
      "501",
      "502",
      "503",
      "504",
      "default",
    ]);
    expect(document.components.schemas.RPCError!.properties).toMatchObject({
      code: { type: "string" },
      status: { type: "integer" },
      message: { type: "string" },
    });
  });

  it("preserves optional and defaulted input/output semantics, nullability, records, and unions", () => {
    const procedure = oc
      .input(
        z.object({
          optional: z.string().optional(),
          fallback: z.string().default("request default"),
          nullable: z.string().nullable(),
          lookup: z.record(z.string(), z.union([z.string(), z.number()])),
        }),
      )
      .output(
        z.object({
          optional: z.string().optional(),
          fallback: z.string().default("response default"),
        }),
      );
    const document = createOpenAPIDocument({ test: { schema: procedure } });
    const operation = operationAt(document, "/rpc/test/schema");
    const request = operation.requestBody.content["application/json"]!.schema;
    const input = (request.properties as Record<string, Record<string, unknown>>).json!;
    const result = operation.responses["200"]!.content!["application/json"]!.schema!;
    const output = (result.properties as Record<string, Record<string, unknown>>).json!;

    expect(input.required).toEqual(["nullable", "lookup"]);
    expect(output.required).toEqual(["fallback"]);
    expect((input.properties as Record<string, Record<string, unknown>>).nullable).toMatchObject({
      type: ["string", "null"],
    });
    expect((input.properties as Record<string, Record<string, unknown>>).lookup).toMatchObject({
      type: "object",
      additionalProperties: { type: ["string", "number"] },
    });
    expect((input.properties as Record<string, Record<string, unknown>>).fallback!.default).toBe(
      "request default",
    );
    expect((output.properties as Record<string, Record<string, unknown>>).fallback!.default).toBe(
      "response default",
    );
  });

  it("allows only the declared event-iterator procedures as text/event-stream", () => {
    const document = createOpenAPIDocument();
    const streamPaths = Object.entries(document.paths)
      .filter(
        ([, value]) =>
          (value.post as Operation).responses["200"]!.content?.["text/event-stream"] !== undefined,
      )
      .map(([path]) => path);

    expect(streamPaths).toEqual([
      "/rpc/boards/subscribe",
      "/rpc/companyImport/subscribe",
      "/rpc/notifications/subscribe",
      "/rpc/threads/subscribe",
    ]);
    expect(() =>
      createOpenAPIDocument({
        future: { stream: oc.output(eventIterator(z.string())) },
      }),
    ).toThrow("Unhandled event iterator procedure: future/stream");
    expect(() => createOpenAPIDocument({ threads: { subscribe: oc.output(z.string()) } })).toThrow(
      "Expected threads/subscribe to use an event iterator",
    );
  });

  it("fails closed when a Zod schema cannot be converted", () => {
    expect(() =>
      createOpenAPIDocument({ unsupported: { value: oc.output(z.bigint()) } }),
    ).toThrow();
  });

  it("documents custom Zod refinements as server-only validation", () => {
    const document = createOpenAPIDocument({
      refined: {
        value: oc.input(z.string().refine((value) => value.length > 0)).output(z.string()),
      },
    });
    const request = operationAt(document, "/rpc/refined/value").requestBody.content[
      "application/json"
    ]!.schema;
    const input = (request.properties as Record<string, Record<string, unknown>>).json!;

    expect(input["x-rakazo-zod-refinements"]).toBe(
      "Enforced by the server; not expressible in JSON Schema.",
    );
    expect(input.description).toContain("remain enforced by the server");
  });

  it("matches a response recorded from the local oRPC handler using appContract.health", async () => {
    const fixturePath = fileURLToPath(
      new URL(
        "../../../apps/ios/Packages/RakazoAPI/Tests/RakazoAPITests/Fixtures/health-response.json",
        import.meta.url,
      ),
    );
    const recordedFixture = JSON.parse(readFileSync(fixturePath, "utf8"));
    const server = await startLocalHealthServer();

    try {
      const response = await fetch(`${server.baseUrl}/rpc/health`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: "rakazo://" },
        body: JSON.stringify({ json: undefined }),
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(recordedFixture);
    } finally {
      await server.close();
    }
  });
});
