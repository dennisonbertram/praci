import { getEventIteratorSchemaDetails, isContractProcedure } from "@orpc/contract";
import * as z from "zod";
import { appContract } from "./rpc.js";

type JSONSchema = Record<string, unknown>;
type ContractEntry = {
  path: string;
  procedure: {
    "~orpc": {
      inputSchema?: unknown;
      outputSchema?: unknown;
    };
  };
};
type OpenAPIDocument = {
  openapi: "3.1.0";
  info: { title: string; version: string; description: string };
  paths: Record<string, Record<string, unknown>>;
  components: {
    schemas: Record<string, JSONSchema>;
    responses: Record<string, unknown>;
    securitySchemes: Record<string, unknown>;
  };
};

const streamingPaths = new Set([
  "threads/subscribe",
  "boards/subscribe",
  "notifications/subscribe",
]);

const errorStatuses: Record<string, string> = {
  "400": "Bad request",
  "401": "Unauthenticated",
  "402": "Payment required",
  "403": "Forbidden",
  "404": "Not found",
  "405": "Method not allowed",
  "406": "Not acceptable",
  "408": "Request timeout",
  "409": "Conflict",
  "410": "Gone",
  "412": "Precondition failed",
  "413": "Payload too large",
  "415": "Unsupported media type",
  "422": "Unprocessable content",
  "428": "Precondition required",
  "429": "Rate limited",
  "499": "Client closed request",
  "500": "Internal server error",
  "501": "Not implemented",
  "502": "Bad gateway",
  "503": "Service unavailable",
  "504": "Gateway timeout",
};

function compareKeys(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function collectProcedures(contract: unknown, prefix = ""): ContractEntry[] {
  if (isContractProcedure(contract)) {
    return [{ path: prefix, procedure: contract }];
  }
  if (!contract || typeof contract !== "object") return [];

  return Object.entries(contract)
    .sort(([left], [right]) => compareKeys(left, right))
    .flatMap(([key, value]) => collectProcedures(value, prefix ? `${prefix}/${key}` : key));
}

function componentPart(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join("");
}

function schemaHasCustomRefinement(schema: unknown): boolean {
  const visited = new WeakSet<object>();

  function visit(value: unknown): boolean {
    if (!value || typeof value !== "object" || visited.has(value)) return false;
    visited.add(value);

    if ("_zod" in value && "def" in value) {
      const definition = (value as { def: Record<string, unknown> }).def;
      const checks = definition.checks;
      if (
        Array.isArray(checks) &&
        checks.some((check) => {
          if (!check || typeof check !== "object") return false;
          const typedCheck = check as {
            def?: { check?: unknown };
            _zod?: { def?: { check?: unknown } };
          };
          return typedCheck.def?.check === "custom" || typedCheck._zod?.def?.check === "custom";
        })
      ) {
        return true;
      }
      return visit(definition);
    }

    if (Array.isArray(value)) return value.some(visit);
    return Object.values(value).some(visit);
  }

  return visit(schema);
}

function jsonSchema(
  input: unknown,
  operationPrefix: string,
  direction: "input" | "output",
  components: Record<string, JSONSchema>,
): JSONSchema {
  const schema = z.toJSONSchema(input as z.ZodType, {
    io: direction,
    target: "draft-2020-12",
    unrepresentable: "throw",
    reused: "ref",
  }) as JSONSchema;
  const definitions = new Map<string, string>();
  const pendingDefinitions: Array<[string, JSONSchema]> = [];

  function extractDefinitions(value: unknown): void {
    if (Array.isArray(value)) {
      value.forEach(extractDefinitions);
      return;
    }
    if (!value || typeof value !== "object") return;

    const object = value as JSONSchema;
    const nestedDefinitions = object.$defs;
    if (nestedDefinitions && typeof nestedDefinitions === "object") {
      for (const [name, definition] of Object.entries(nestedDefinitions)) {
        const componentName = `${operationPrefix}${direction === "input" ? "Input" : "Output"}${componentPart(name)}`;
        definitions.set(name, componentName);
        pendingDefinitions.push([componentName, definition as JSONSchema]);
      }
      delete object.$defs;
    }
    Object.values(object).forEach(extractDefinitions);
  }

  extractDefinitions(schema);
  for (let index = 0; index < pendingDefinitions.length; index += 1) {
    const [name, definition] = pendingDefinitions[index]!;
    extractDefinitions(definition);
    components[name] = definition;
  }

  function rewriteReferences(value: unknown): void {
    if (Array.isArray(value)) {
      value.forEach(rewriteReferences);
      return;
    }
    if (!value || typeof value !== "object") return;

    const object = value as JSONSchema;
    if (typeof object.$ref === "string" && object.$ref.startsWith("#/$defs/")) {
      const [name, ...suffix] = object.$ref.slice("#/$defs/".length).split("/");
      const componentName = definitions.get(name!);
      if (!componentName) throw new Error(`Unresolved Zod JSON Schema reference: ${object.$ref}`);
      object.$ref = `#/components/schemas/${componentName}${suffix.length ? `/${suffix.join("/")}` : ""}`;
    }
    Object.values(object).forEach(rewriteReferences);
  }

  rewriteReferences(schema);
  for (const [name] of pendingDefinitions) rewriteReferences(components[name]);

  if (schemaHasCustomRefinement(input)) {
    const note =
      "Some server-side Zod refinements cannot be represented in JSON Schema and remain enforced by the server.";
    schema.description = [schema.description, note]
      .filter((value) => typeof value === "string")
      .join(" ");
    schema["x-rakazo-zod-refinements"] = "Enforced by the server; not expressible in JSON Schema.";
  }
  return schema;
}

function acceptsUndefined(schema: unknown): boolean {
  if (!schema || typeof schema !== "object" || !("safeParse" in schema)) return false;
  const safeParse = (schema as { safeParse?: (value: unknown) => { success: boolean } }).safeParse;
  return typeof safeParse === "function" && safeParse(undefined).success;
}

function errorEnvelope(): JSONSchema {
  return {
    type: "object",
    required: ["json"],
    properties: {
      json: { $ref: "#/components/schemas/RPCError" },
    },
  };
}

function errorResponses(): Record<string, unknown> {
  const responses = Object.fromEntries(
    Object.entries(errorStatuses).map(([status, description]) => [
      `Http${status}`,
      {
        description,
        content: {
          "application/json": {
            schema: errorEnvelope(),
          },
        },
      },
    ]),
  );
  responses.OtherORPCError = {
    description: "Other oRPC error",
    content: {
      "application/json": {
        schema: errorEnvelope(),
      },
    },
  };
  return responses;
}

function operationFor(
  entry: ContractEntry,
  components: Record<string, JSONSchema>,
): Record<string, unknown> {
  const { path, procedure } = entry;
  const input = procedure["~orpc"].inputSchema;
  const output = procedure["~orpc"].outputSchema;
  const iteratorDetails = output ? getEventIteratorSchemaDetails(output as never) : undefined;
  const streaming = streamingPaths.has(path);

  if (Boolean(iteratorDetails) !== streaming) {
    throw new Error(
      streaming
        ? `Expected ${path} to use an event iterator`
        : `Unhandled event iterator procedure: ${path}`,
    );
  }

  const operationPrefix = `Rpc${componentPart(path)}`;
  const successSchema: JSONSchema | { $ref: string } = streaming
    ? { type: "string" }
    : {
        type: "object",
        required: ["json"],
        properties: {
          json: output ? jsonSchema(output, operationPrefix, "output", components) : {},
        },
      };
  if (!streaming && path === "health") {
    components.HealthResponse = successSchema as JSONSchema;
  }
  const parameters = [
    {
      name: "Origin",
      in: "header",
      required: false,
      description:
        "Native clients send rakazo://; include the application origin for origin checks.",
      schema: { type: "string", example: "rakazo://" },
    },
    {
      name: "x-rakazo-space-id",
      in: "header",
      required: false,
      description: "Optional selected space identifier.",
      schema: { type: "string" },
    },
  ];
  const responses: Record<string, unknown> = {
    "200": {
      description: "Successful RPC response",
      content: streaming
        ? {
            "text/event-stream": {
              schema: successSchema,
            },
          }
        : {
            "application/json": {
              schema:
                path === "health" ? { $ref: "#/components/schemas/HealthResponse" } : successSchema,
            },
          },
    },
  };
  for (const status of Object.keys(errorStatuses)) {
    responses[status] = { $ref: `#/components/responses/Http${status}` };
  }
  responses.default = { $ref: "#/components/responses/OtherORPCError" };

  const bodySchema: JSONSchema = {
    type: "object",
    properties: {
      json: input
        ? jsonSchema(input, operationPrefix, "input", components)
        : { description: "This procedure has no input." },
    },
  };
  if (input && !acceptsUndefined(input)) bodySchema.required = ["json"];

  const operation: Record<string, unknown> = {
    operationId: `rpc_${path.replaceAll("/", "_")}`,
    parameters,
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: bodySchema,
        },
      },
    },
    responses,
  };
  if (path !== "health") operation.security = [{ BearerAuth: [] }];
  if (streaming) {
    operation.description = "Returns an oRPC event stream using text/event-stream.";
  }
  return operation;
}

export function createOpenAPIDocument(contract: unknown = appContract): OpenAPIDocument {
  const entries = collectProcedures(contract);
  const components: Record<string, JSONSchema> = {
    RPCError: {
      type: "object",
      required: ["defined", "code", "status", "message"],
      properties: {
        defined: { type: "boolean" },
        code: { type: "string" },
        status: { type: "integer" },
        message: { type: "string" },
        data: {},
      },
    },
  };
  const paths: OpenAPIDocument["paths"] = {};

  for (const entry of entries) {
    paths[`/rpc/${entry.path}`] = {
      post: operationFor(entry, components),
    };
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Rakazo application RPC",
      version: "0.1.0",
      description:
        "OpenAPI description of appContract. JSON RPC requests and successful responses use the {json: ...} envelope; no-input procedures omit json.",
    },
    paths,
    components: {
      schemas: components,
      responses: errorResponses(),
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
        },
      },
    },
  };
}

export function renderOpenAPIDocument(contract: unknown = appContract): string {
  return `${JSON.stringify(createOpenAPIDocument(contract), null, 2)}\n`;
}
