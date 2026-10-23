import { createHash } from "node:crypto";
import type {
  AdapterContext,
  CompanyConnectionReader,
  CompanyImportSourceDescriptor,
  ConnectorCall,
  ConnectorProvider,
  ConnectorTool,
} from "@rakazo/adapter-kit";
import { COMPANY_IMPORT_CURSOR_MAX_BYTES } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import { createCompanyConnectionReader } from "./company-connection-reader.js";
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

function dispatchedReader(
  provider: string,
  tools: ConnectorTool[],
  response: (name: string, args: Record<string, unknown>) => unknown,
) {
  const calls: Array<[string, Record<string, unknown>]> = [];
  const prisma = {
    spaceMember: { findUnique: async () => ({ userId: context.userId }) },
    companySourceBlock: { findMany: async () => [] },
    connection: {
      findFirst: async () => ({
        id: "connection",
        connectorId: "composio",
        provider,
        providerRef: "synthetic-account",
        displayName: "Synthetic",
        allAgents: true,
        privateByDefault: false,
        status: "connected",
      }),
    },
  };
  const connectors = {
    discoverTools: async () => tools,
    async *execute(call: ConnectorCall) {
      const denial = await call.beforeDispatch?.();
      if (denial) {
        yield { type: "error" as const, message: denial };
        return;
      }
      calls.push([call.tool, call.args]);
      yield {
        type: "result" as const,
        data: {
          data: { successful: true, data: response(call.tool, call.args) },
          logId: "synthetic-log",
        },
      };
    },
  } as unknown as ConnectorProvider;
  const mcp = {
    listServerTools: async () => [],
    callServerTool: async () => ({ content: [] }),
  };
  return {
    reader: createCompanyConnectionReader({
      prisma: prisma as never,
      connectors,
      mcp: mcp as never,
    }),
    calls,
  };
}

describe("Company document reader", () => {
  it("reads Notion metadata and nested blocks while restarting search cursors", async () => {
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
    const imported = [];
    let cursor: unknown = first.units[0]!.cursor;
    while (true) {
      const page = await documents.read(source, cursor, context);
      if (page.document) imported.push(page.document);
      if (page.done) break;
      cursor = page.nextCursor;
    }
    expect(imported.map((document) => document.id)).toEqual([
      "notion:11111111-1111-4111-8111-111111111111:metadata",
      "notion:11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222",
    ]);
    expect(imported.map((document) => document.text).join("\n")).toContain("Nested text");
    expect(imported.map((document) => document.text).join("\n")).not.toContain("secret");
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

  it("decodes production connector envelopes through managed Notion and generic dispatch", async () => {
    const pageId = "11111111-1111-4111-8111-111111111111";
    const blockId = "22222222-2222-4222-8222-222222222222";
    const nestedId = "33333333-3333-4333-8333-333333333333";
    const genericTool: ConnectorTool = {
      name: "ACME_LIST_RECORDS",
      description: "Read records",
      readOnly: true,
      inputSchema: {
        type: "object",
        properties: {
          status: { type: "string" },
          cursor: { type: "string" },
          limit: { type: "integer", maximum: 100 },
        },
      },
      route: { connectorId: "composio", toolName: "ACME_LIST_RECORDS" },
    };
    const rowOne = {
      id: "item-one",
      title: "First record",
      url: "https://crm.example.test/records/one",
      salary: "private",
    };
    const rowTwo = {
      id: "item-two",
      title: "Second record",
      url: "https://crm.example.test/records/two",
      salary: "private",
    };
    let acrossPages = false;
    const genericDispatch = dispatchedReader("acme_crm", [genericTool], (_name, args) => {
      if (acrossPages && args.cursor) return { records: [rowTwo], has_more: false };
      if (acrossPages) return { records: [rowOne], next_cursor: "next" };
      return { records: [rowOne, rowTwo], has_more: false };
    });
    const genericSource: CompanyImportSourceDescriptor = {
      id: "generic-source",
      sourceKind: "composio",
      connectionId: "generic-connection",
      scope: {
        reader: "generic",
        tools: [{ name: genericTool.name, args: { status: "active" } }],
      },
    };
    const generic = createCompanyDocumentReader(genericDispatch.reader);
    const genericStart = {
      kind: "generic",
      toolName: genericTool.name,
      pageToken: null,
      rowIndex: 0,
      seen: [],
    };
    const first = await generic.read(genericSource, genericStart, context);
    const secondInSamePage = await generic.read(genericSource, first.nextCursor, context);
    acrossPages = true;
    const firstAcrossPages = await generic.read(genericSource, genericStart, context);
    const secondAcrossPages = await generic.read(
      genericSource,
      firstAcrossPages.nextCursor,
      context,
    );
    expect(first.document?.sourceUrl).toBe("https://crm.example.test/records/one");
    expect(first.document?.text).not.toContain("private");
    expect(secondInSamePage.document?.sourceUrl).toBe("https://crm.example.test/records/two");
    expect(secondAcrossPages.document?.id).toBe(secondInSamePage.document?.id);
    expect(secondAcrossPages.document?.sourceUrl).toBe(secondInSamePage.document?.sourceUrl);
    expect(genericDispatch.calls).toHaveLength(4);

    const failedDispatch = dispatchedReader("acme_crm", [genericTool], () => ({
      successful: false,
      status: 429,
      error: "provider rate limit",
    }));
    await expect(
      createCompanyDocumentReader(failedDispatch.reader).read(genericSource, genericStart, context),
    ).rejects.toMatchObject({ code: "rate_limited", retryAfterMs: 60_000 });

    const notionDispatch = dispatchedReader("notion", notionTools, (name, args) => {
      if (name === "NOTION_SEARCH_NOTION_PAGE")
        return { results: [{ id: pageId }], has_more: false };
      if (name === "NOTION_RETRIEVE_PAGE")
        return {
          id: args.page_id,
          properties: { Name: { type: "title", title: [{ plain_text: "Wrapped page" }] } },
        };
      if (args.block_id === pageId)
        return {
          results: [
            {
              id: blockId,
              type: "paragraph",
              paragraph: { rich_text: [{ plain_text: "Parent block" }] },
              has_children: true,
            },
          ],
          has_more: false,
        };
      return {
        results: [
          {
            id: nestedId,
            type: "paragraph",
            paragraph: { rich_text: [{ plain_text: "Nested block" }] },
            has_children: false,
          },
        ],
        has_more: false,
      };
    });
    const notion = createCompanyDocumentReader(notionDispatch.reader);
    const notionSource: CompanyImportSourceDescriptor = {
      id: "notion-source",
      sourceKind: "notion",
      connectionId: "notion-connection",
      scope: { reader: "notion", allTime: true },
    };
    const discovery = await notion.discover(notionSource, null, 10, context);
    const imported = [];
    let cursor: unknown = discovery.units[0]!.cursor;
    while (true) {
      const page = await notion.read(notionSource, cursor, context);
      if (page.document) imported.push(page.document);
      if (page.done) break;
      cursor = page.nextCursor;
    }
    expect(imported.map((item) => item.id)).toEqual([
      `notion:${pageId}:metadata`,
      `notion:${pageId}:${blockId}`,
      `notion:${pageId}:${nestedId}`,
    ]);
    expect(imported.map((item) => item.text).join("\n")).toContain("Nested block");
    expect(notionDispatch.calls.map(([name]) => name)).toEqual([
      "NOTION_SEARCH_NOTION_PAGE",
      "NOTION_RETRIEVE_PAGE",
      "NOTION_FETCH_BLOCK_CONTENTS",
      "NOTION_FETCH_BLOCK_CONTENTS",
    ]);
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
    expect((await documents.read(source, { ...cursor, rowIndex: 99 }, context)).done).toBe(true);
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

  it("treats terminal pageInfo cursors as complete and rejects oversized item projections", async () => {
    const tool: ConnectorTool = {
      name: "ACME_LIST_RECORDS",
      description: "list",
      readOnly: true,
      inputSchema: { type: "object", properties: { cursor: {} } },
      route: { connectorId: "composio", toolName: "ACME_LIST_RECORDS" },
    };
    const source: CompanyImportSourceDescriptor = {
      id: "source",
      sourceKind: "composio",
      connectionId: "connection",
      scope: { reader: "generic", tools: [{ name: tool.name, args: {} }] },
    };
    let response: unknown = {
      records: [{ id: "record-1", title: "Terminal" }],
      pageInfo: { hasNextPage: false, endCursor: "terminal" },
    };
    const documents = createCompanyDocumentReader({
      listTools: async () => [tool],
      callTool: async () => response,
    } as unknown as CompanyConnectionReader);
    const terminal = await documents.read(
      source,
      {
        kind: "generic",
        toolName: tool.name,
        pageToken: "terminal",
        rowIndex: 0,
        seen: ["terminal"],
      },
      context,
    );
    expect(terminal.done).toBe(true);
    expect(terminal.document?.text).toContain("Terminal");

    response = {
      data: {
        successful: true,
        data: [{ id: "record-3", title: "Wrapped" }],
        has_more: true,
        next_cursor: "next-page",
      },
      logId: "synthetic-log",
    };
    const wrapped = await documents.read(source, { toolName: tool.name }, context);
    expect(wrapped.document?.text).toContain("Wrapped");
    expect(wrapped.done).toBe(false);
    expect(wrapped.nextCursor).toMatchObject({ pageToken: "next-page" });

    response = { id: "record-4", title: "Single result", has_more: false };
    const single = await documents.read(source, { toolName: tool.name }, context);
    expect(single.document?.text).toContain("Single result");
    expect(single.done).toBe(true);

    response = {
      records: [{ id: "record-2", nested: Array.from({ length: 101 }, (_, index) => index) }],
      has_more: false,
    };
    await expect(
      documents.read(
        source,
        { kind: "generic", toolName: tool.name, pageToken: null, rowIndex: 0, seen: [] },
        context,
      ),
    ).rejects.toThrow("source_projection_overflow");
  });

  it("hashes legacy pagination histories and still detects repeated long tokens", async () => {
    const longTokens = Array.from(
      { length: 40 },
      (_, index) => `${index.toString().padStart(4, "0")}-${"x".repeat(1_995)}`,
    );
    let nextToken = "notion-next";
    const notion = createCompanyDocumentReader({
      listTools: async () => notionTools,
      callTool: async () => ({
        results: [{ id: "11111111-1111-4111-8111-111111111111" }],
        has_more: true,
        next_cursor: nextToken,
      }),
    } as unknown as CompanyConnectionReader);
    const notionSource: CompanyImportSourceDescriptor = {
      id: "notion-source",
      sourceKind: "notion",
      connectionId: "notion-connection",
      scope: { reader: "notion", allTime: true },
    };
    const notionPage = await notion.discover(
      notionSource,
      { startCursor: "current", seen: longTokens },
      10,
      context,
    );
    expect(notionPage.nextCursor).toMatchObject({
      startCursor: "notion-next",
      seenHashes: [
        ...longTokens.map((token) => createHash("sha256").update(token).digest("hex")),
        createHash("sha256").update("notion-next").digest("hex"),
      ],
    });
    expect(JSON.stringify(notionPage.nextCursor)).not.toContain(longTokens[0]);
    nextToken = longTokens[10]!;
    await expect(notion.discover(notionSource, notionPage.nextCursor, 10, context)).rejects.toThrow(
      "source_cursor_stalled",
    );

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
    let genericToken = "generic-next";
    const generic = createCompanyDocumentReader({
      listTools: async () => [tool],
      callTool: async () => ({
        records: [{ id: "record" }],
        has_more: true,
        next_cursor: genericToken,
      }),
    } as unknown as CompanyConnectionReader);
    const genericSource: CompanyImportSourceDescriptor = {
      id: "generic-source",
      sourceKind: "composio",
      connectionId: "generic-connection",
      scope: { reader: "generic", tools: [{ name: tool.name, args: {} }] },
    };
    const genericPage = await generic.read(
      genericSource,
      {
        kind: "generic",
        toolName: tool.name,
        pageToken: "current",
        rowIndex: 0,
        seen: longTokens,
      },
      context,
    );
    expect(genericPage.nextCursor).toMatchObject({
      pageToken: "generic-next",
      seenHashes: expect.arrayContaining([
        createHash("sha256").update(longTokens[0]!).digest("hex"),
      ]),
    });
    expect(Buffer.byteLength(JSON.stringify(genericPage.nextCursor))).toBeLessThan(16_384);
    genericToken = longTokens[20]!;
    await expect(generic.read(genericSource, genericPage.nextCursor, context)).rejects.toThrow(
      "source_cursor_stalled",
    );
  });

  it("serializes more than 400 Notion blocks within the shared cursor bound", async () => {
    const pageId = "11111111-1111-4111-8111-111111111111";
    const blockIds = Array.from(
      { length: 450 },
      (_, index) => `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`,
    );
    const reader: CompanyConnectionReader = {
      listTools: async () => notionTools,
      callTool: async (_source, name, args) => {
        if (name === "NOTION_RETRIEVE_PAGE")
          return { id: pageId, properties: { Name: { type: "title", title: [] } } };
        const pageIndex = args.start_cursor ? Number(String(args.start_cursor).slice(5)) : 0;
        const start = pageIndex * 100;
        const rows = blockIds.slice(start, start + 100).map((id) => ({
          id,
          type: "paragraph",
          paragraph: { rich_text: [{ plain_text: id }] },
          has_children: false,
        }));
        const more = start + rows.length < blockIds.length;
        return {
          results: rows,
          has_more: more,
          ...(more ? { next_cursor: `page-${pageIndex + 1}` } : {}),
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
    let cursor: unknown = { kind: "notion", pageId };
    let documentsRead = 0;
    let largestCursor = 0;
    while (true) {
      const page = await documents.read(source, cursor, context);
      if (page.document) documentsRead++;
      if (page.done) break;
      cursor = page.nextCursor;
      const serialized = JSON.stringify(cursor);
      largestCursor = Math.max(largestCursor, Buffer.byteLength(serialized));
      expect(serialized).not.toContain('"seen":');
      expect(Buffer.byteLength(serialized)).toBeLessThanOrEqual(COMPANY_IMPORT_CURSOR_MAX_BYTES);
    }
    expect(documentsRead).toBe(451);
    expect(largestCursor).toBeGreaterThan(16_384);
  });
});
