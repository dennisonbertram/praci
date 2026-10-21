import type {
  AdapterContext,
  CompanyConnectionReader,
  CompanyImportSourceDescriptor,
  ConnectorTool,
} from "@rakazo/adapter-kit";
import { describe, expect, it } from "vitest";
import { createCompanyDocumentReader } from "./company-document-source.js";

const context: AdapterContext = {
  operationId: "test",
  traceId: "test",
  spaceId: "space",
  userId: "owner",
  signal: new AbortController().signal,
};

const notionTools: ConnectorTool[] = [
  {
    name: "NOTION_SEARCH_NOTION_PAGE",
    description: "search",
    inputSchema: {
      type: "object",
      properties: { filter_value: {}, page_size: {}, start_cursor: {} },
    },
    route: { connectorId: "composio", toolName: "NOTION_SEARCH_NOTION_PAGE" },
  },
  {
    name: "NOTION_RETRIEVE_PAGE",
    description: "retrieve",
    inputSchema: { type: "object", properties: { page_id: {} }, required: ["page_id"] },
    route: { connectorId: "composio", toolName: "NOTION_RETRIEVE_PAGE" },
  },
  {
    name: "NOTION_FETCH_BLOCK_CONTENTS",
    description: "blocks",
    inputSchema: {
      type: "object",
      properties: { block_id: {}, page_size: {}, start_cursor: {} },
      required: ["block_id"],
    },
    route: { connectorId: "composio", toolName: "NOTION_FETCH_BLOCK_CONTENTS" },
  },
];

describe("Company document reader", () => {
  it("reads Notion page metadata and nested blocks while restarting search cursors", async () => {
    const calls: Array<[string, Record<string, unknown>]> = [];
    const reader: CompanyConnectionReader = {
      listTools: async () => notionTools,
      callTool: async (_source, name, args) => {
        calls.push([name, args]);
        if (name === "NOTION_SEARCH_NOTION_PAGE") {
          return args.start_cursor
            ? { results: [{ id: "11111111-1111-4111-8111-111111111111" }], has_more: false }
            : {
                results: [{ id: "11111111-1111-4111-8111-111111111111" }],
                has_more: true,
                next_cursor: "next",
              };
        }
        if (name === "NOTION_RETRIEVE_PAGE")
          return {
            id: args.page_id,
            url: "https://www.notion.so/page",
            properties: {
              Name: { type: "title", title: [{ plain_text: "Launch" }] },
              Salary: { type: "rich_text", rich_text: [{ plain_text: "secret" }] },
            },
          };
        if (args.block_id === "22222222-2222-4222-8222-222222222222")
          return { results: [], has_more: false };
        return {
          results: [
            {
              id: "22222222-2222-4222-8222-222222222222",
              type: "paragraph",
              paragraph: { rich_text: [{ plain_text: "Nested text" }] },
              has_children: true,
            },
          ],
          has_more: false,
        };
      },
    };
    const documents = createCompanyDocumentReader(reader);
    const source: CompanyImportSourceDescriptor = {
      id: "source",
      sourceKind: "notion",
      connectionId: "connection",
      scope: { reader: "notion", allTime: true },
    };
    expect(await documents.supports(source, context)).toBe(true);
    const incompleteDocuments = createCompanyDocumentReader({
      ...reader,
      listTools: async () => notionTools.slice(0, 2),
    });
    expect(await incompleteDocuments.supports(source, context)).toBe(false);
    await expect(incompleteDocuments.validate(source, context)).rejects.toThrow(
      "source_capability_unavailable",
    );
    const first = await documents.discover(source, {}, 10, context);
    expect(first.done).toBe(false);
    const restart = await documents.discover(source, first.nextCursor, 10, context);
    expect(restart.done).toBe(true);
    const page = await documents.read(source, first.units[0]!.cursor, context);
    expect(page.document?.text).toContain("Nested text");
    expect(page.document?.text).not.toContain("secret");
    expect(
      calls.some(
        ([name, args]) => name === "NOTION_SEARCH_NOTION_PAGE" && args.start_cursor === "next",
      ),
    ).toBe(true);
  });

  it("rejects an ambiguous full Notion search page", async () => {
    const documents = createCompanyDocumentReader({
      listTools: async () => notionTools,
      callTool: async () => ({
        results: Array.from({ length: 100 }, () => ({
          id: "11111111-1111-4111-8111-111111111111",
        })),
      }),
    } as unknown as CompanyConnectionReader);
    const source: CompanyImportSourceDescriptor = {
      id: "source",
      sourceKind: "notion",
      connectionId: "connection",
      scope: { reader: "notion", allTime: true },
    };
    await expect(documents.discover(source, {}, 100, context)).rejects.toThrow(
      "source_pagination_unavailable",
    );
  });

  it("executes only selected generic read tools and rejects writes or unsafe continuation", async () => {
    const calls: string[] = [];
    const tools: ConnectorTool[] = [
      {
        name: "ACME_LIST_RECORDS",
        description: "list",
        readOnly: true,
        inputSchema: { type: "object", properties: { limit: {}, cursor: {} } },
        route: { connectorId: "composio", toolName: "ACME_LIST_RECORDS" },
      },
      {
        name: "ACME_CREATE_RECORD",
        description: "create",
        readOnly: false,
        inputSchema: { type: "object", properties: {} },
        route: { connectorId: "composio", toolName: "ACME_CREATE_RECORD" },
      },
      {
        name: "COMPOSIO_MULTI_EXECUTE_TOOL",
        description: "wrapper",
        readOnly: true,
        inputSchema: { type: "object", properties: {} },
        route: { connectorId: "composio", toolName: "COMPOSIO_MULTI_EXECUTE_TOOL" },
      },
      {
        name: "ACME_LIST_USERS",
        description: "list users",
        readOnly: true,
        inputSchema: { type: "object", properties: {} },
        route: { connectorId: "composio", toolName: "ACME_LIST_USERS" },
      },
    ];
    const reader: CompanyConnectionReader = {
      listTools: async () => tools,
      callTool: async (_source, name) => {
        calls.push(name);
        return {
          records: [{ title: "safe", salary: "private", personal_email: "private@example.test" }],
          has_more: false,
        };
      },
    };
    const documents = createCompanyDocumentReader(reader);
    const source: CompanyImportSourceDescriptor = {
      id: "source",
      sourceKind: "composio",
      connectionId: "connection",
      scope: { reader: "generic", tools: [{ name: "ACME_LIST_RECORDS", args: {} }] },
    };
    const page = await documents.read(
      source,
      { kind: "generic", toolName: "ACME_LIST_RECORDS", args: {}, pageToken: null, seen: [] },
      context,
    );
    expect(page.document?.text).not.toContain("salary");
    expect(page.document?.text).not.toContain("personal_email");
    await expect(
      documents.read(
        source,
        { kind: "generic", toolName: "ACME_CREATE_RECORD", args: {}, pageToken: null, seen: [] },
        context,
      ),
    ).rejects.toThrow("source_tool_unavailable");
    await expect(
      documents.read(
        source,
        { kind: "generic", toolName: "ACME_LIST_USERS", args: {}, pageToken: null, seen: [] },
        context,
      ),
    ).rejects.toThrow("source_tool_unavailable");
    await expect(
      documents.validate(
        {
          ...source,
          scope: {
            reader: "generic",
            tools: [{ name: "COMPOSIO_MULTI_EXECUTE_TOOL", args: {} }],
          },
        },
        context,
      ),
    ).rejects.toThrow("source_tool_unavailable");
    await expect(
      documents.validate(
        {
          ...source,
          scope: {
            reader: "generic",
            tools: [{ name: "ACME_LIST_RECORDS", args: { limit: 100 } }],
          },
        },
        context,
      ),
    ).rejects.toThrow("source_tool_arguments_invalid");
    expect(calls).toEqual(["ACME_LIST_RECORDS"]);
  });

  it("fails explicitly on empty generic continuation pages", async () => {
    const tool: ConnectorTool = {
      name: "ACME_LIST_RECORDS",
      description: "list",
      readOnly: true,
      inputSchema: {
        type: "object",
        properties: { cursor: {}, limit: { type: "integer", maximum: 100 } },
        required: ["limit"],
      },
      route: { connectorId: "composio", toolName: "ACME_LIST_RECORDS" },
    };
    const source: CompanyImportSourceDescriptor = {
      id: "source",
      sourceKind: "composio",
      connectionId: "connection",
      scope: { reader: "generic", tools: [{ name: tool.name, args: {} }] },
    };
    const calls: Record<string, unknown>[] = [];
    const documents = createCompanyDocumentReader({
      listTools: async () => [tool],
      callTool: async (
        _source: Parameters<CompanyConnectionReader["callTool"]>[0],
        _name: Parameters<CompanyConnectionReader["callTool"]>[1],
        args: Parameters<CompanyConnectionReader["callTool"]>[2],
      ) => {
        calls.push(args);
        return { records: [], next_cursor: "next" };
      },
    } as unknown as CompanyConnectionReader);

    await expect(
      documents.read(
        source,
        { kind: "generic", toolName: tool.name, args: {}, pageToken: null, seen: [] },
        context,
      ),
    ).rejects.toThrow("source_cursor_stalled");
    expect(calls).toEqual([{ limit: 100 }]);
  });

  it("rejects ambiguous full generic pages but accepts explicit terminal metadata", async () => {
    const tool: ConnectorTool = {
      name: "ACME_LIST_RECORDS",
      description: "list",
      readOnly: true,
      inputSchema: { type: "object", properties: {} },
      route: { connectorId: "composio", toolName: "ACME_LIST_RECORDS" },
    };
    const source: CompanyImportSourceDescriptor = {
      id: "source",
      sourceKind: "composio",
      connectionId: "connection",
      scope: { reader: "generic", tools: [{ name: tool.name, args: {} }] },
    };
    let response: unknown = { records: Array.from({ length: 100 }, (_, index) => ({ index })) };
    const documents = createCompanyDocumentReader({
      listTools: async () => [tool],
      callTool: async () => response,
    } as unknown as CompanyConnectionReader);
    const cursor = {
      kind: "generic",
      toolName: tool.name,
      args: {},
      pageToken: null,
      seen: [],
    };

    await expect(documents.read(source, cursor, context)).rejects.toThrow(
      "source_pagination_unavailable",
    );
    response = {
      records: Array.from({ length: 100 }, (_, index) => ({ index })),
      has_more: false,
    };
    expect((await documents.read(source, cursor, context)).done).toBe(true);
  });

  it("rejects repeated generic cursor tokens", async () => {
    const tool: ConnectorTool = {
      name: "ACME_LIST_RECORDS",
      description: "list",
      readOnly: true,
      inputSchema: {
        type: "object",
        properties: { cursor: {}, limit: { type: "integer", maximum: 100 } },
      },
      route: { connectorId: "composio", toolName: "ACME_LIST_RECORDS" },
    };
    const source: CompanyImportSourceDescriptor = {
      id: "source",
      sourceKind: "composio",
      connectionId: "connection",
      scope: { reader: "generic", tools: [{ name: tool.name, args: {} }] },
    };
    const documents = createCompanyDocumentReader({
      listTools: async () => [tool],
      callTool: async () => ({ records: [{ id: "record" }], next_cursor: "first" }),
    } as unknown as CompanyConnectionReader);
    await expect(
      documents.read(
        source,
        {
          kind: "generic",
          toolName: tool.name,
          args: {},
          pageToken: "first",
          seen: ["first"],
        },
        context,
      ),
    ).rejects.toThrow("source_cursor_stalled");
  });
});
