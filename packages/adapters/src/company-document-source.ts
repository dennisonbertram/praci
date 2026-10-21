import { createHash } from "node:crypto";
import type {
  AdapterContext,
  CompanyConnectionReader,
  CompanyImportSourceDescriptor,
  ConnectorTool,
} from "@rakazo/adapter-kit";
import { CompanyGenericScopeSchema, CompanyNotionScopeSchema } from "@rakazo/contracts";
import { CompanyImportWorkerError } from "./company-import-engine.js";
import { COMPANY_NOTION_READ_TOOLS, isCompanyGenericReadTool } from "./company-read-policy.js";
import { assertConnectorToolArgs } from "./lazy-tool-catalog.js";

const PAGE_SIZE = 100;
const MAX_DOCUMENT_BYTES = 500_000;
const MAX_VALUE_BYTES = 100_000;
const MAX_QUEUE = 500;
const MAX_VISITED = 2_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CURSORS = ["start_cursor", "cursor", "page_token", "after"] as const;
const SIZES = ["page_size", "limit", "per_page"] as const;
const SENSITIVE =
  /(?:salary|compensation|health|performance|immigration|personal.?contact|e.?mail|phone|mobile|address|secret|token|password|api.?key)/i;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  const object = asRecord(value);
  if (!object) return value;
  return Object.fromEntries(
    Object.keys(object)
      .sort()
      .map((key) => [key, canonical(object[key])]),
  );
};
const stableHash = (value: unknown) => hash(JSON.stringify(canonical(value)) ?? "null");
function boundedUtf8(value: string, limit: number) {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.byteLength <= limit) return value;
  const marker = "\n[truncated]";
  const prefix = bytes
    .subarray(0, Math.max(0, limit - Buffer.byteLength(marker)))
    .toString("utf8")
    .replace(/\uFFFD$/, "");
  return `${prefix}${marker}`;
}
const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
const asArray = (value: unknown) => (Array.isArray(value) ? value : undefined);

export type CompanyDocumentPage = {
  document?: {
    id: string;
    title: string;
    text: string;
    snippet: string;
    sourceUrl?: string | null;
  };
  nextCursor: unknown | null;
  done: boolean;
  cooldownMs?: number;
};

export type CompanyDocumentReader = {
  supports(source: CompanyImportSourceDescriptor, context: AdapterContext): Promise<boolean>;
  listTools(
    source: CompanyImportSourceDescriptor,
    context: AdapterContext,
  ): Promise<ConnectorTool[]>;
  validate(
    source: CompanyImportSourceDescriptor,
    context: AdapterContext,
  ): Promise<{ tools: ConnectorTool[] }>;
  discover(
    source: CompanyImportSourceDescriptor,
    cursor: unknown,
    maxUnits: number,
    context: AdapterContext,
  ): Promise<{
    units: Array<{ unitKey: string; cursor: unknown }>;
    nextCursor: unknown;
    done: boolean;
  }>;
  read(
    source: CompanyImportSourceDescriptor,
    cursor: unknown,
    context: AdapterContext,
  ): Promise<CompanyDocumentPage>;
};

export function isCompanyDocumentSource(source: CompanyImportSourceDescriptor) {
  return source.sourceKind === "notion" || source.sourceKind === "composio";
}

function fail(code: string): never {
  throw new CompanyImportWorkerError(code);
}

function toolArgsSchema(tool: ConnectorTool) {
  const root = asRecord(tool.inputSchema);
  return asRecord(root?.properties) ?? {};
}

function declared(root: Record<string, unknown>, names: readonly string[]) {
  return names.find((name) => Object.hasOwn(root, name));
}

function boundedPageSize(value: unknown) {
  const property = asRecord(value);
  const minimum = typeof property?.minimum === "number" ? property.minimum : 1;
  const maximum = typeof property?.maximum === "number" ? property.maximum : PAGE_SIZE;
  const choices = asArray(property?.enum)?.filter(
    (item): item is number => typeof item === "number" && item >= minimum && item <= maximum,
  );
  if (property?.enum !== undefined && !choices?.length) fail("source_pagination_unavailable");
  const size = choices?.length
    ? Math.min(PAGE_SIZE, Math.max(...choices))
    : Math.min(PAGE_SIZE, maximum);
  if (size < minimum || size < 1) fail("source_pagination_unavailable");
  return size;
}

function safeUrl(value: unknown) {
  if (typeof value !== "string" || !/^https?:\/\//i.test(value) || value.length > 2_000)
    return undefined;
  try {
    const url = new URL(value);
    return url.username || url.password ? undefined : value;
  } catch {
    return undefined;
  }
}

function redact(value: unknown, key = "", depth = 0): unknown {
  if (depth > 12 || SENSITIVE.test(key)) return undefined;
  if (typeof value === "string") return boundedUtf8(value, MAX_VALUE_BYTES);
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => redact(item, key, depth + 1));
  if (!value || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const [childKey, child] of Object.entries(value).slice(0, 200)) {
    const next = redact(child, childKey, depth + 1);
    if (next !== undefined) output[childKey] = next;
  }
  return output;
}

function textValue(value: unknown, key = ""): string {
  if (SENSITIVE.test(key)) return "";
  if (typeof value === "string") return boundedUtf8(value, MAX_VALUE_BYTES);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value))
    return value
      .map((item) => textValue(item, key))
      .filter(Boolean)
      .join(" ");
  const object = asRecord(value);
  if (!object) return "";
  if (typeof object.plain_text === "string") return boundedUtf8(object.plain_text, MAX_VALUE_BYTES);
  if (typeof object.text === "string") return boundedUtf8(object.text, MAX_VALUE_BYTES);
  return Object.entries(object)
    .filter(([childKey]) => !SENSITIVE.test(childKey))
    .map(([childKey, item]) => textValue(item, childKey))
    .filter(Boolean)
    .join(" ");
}

function notionTitle(page: Record<string, unknown>) {
  const properties = asRecord(page.properties);
  const title = properties
    ? Object.entries(properties)
        .filter(([key]) => !SENSITIVE.test(key))
        .map(([, property]) => asRecord(property))
        .find((property) => property?.type === "title" || property?.title)
    : undefined;
  return textValue(title?.title ?? page.title ?? properties?.title) || "Notion page";
}

function notionText(value: unknown, output: string[]) {
  const object = asRecord(value);
  if (!object) return;
  const type = typeof object.type === "string" ? object.type : "";
  const payload = type ? object[type] : object;
  const text = textValue(payload);
  if (text) output.push(text);
}

function notionBlocks(
  value: unknown,
  output: string[],
  queue: Array<{ id: string; cursor: string | null; seen: string[] }>,
  visited: Set<string>,
) {
  const rows = asArray(value);
  if (!rows) fail("invalid_source_response");
  for (const row of rows) {
    const block = asRecord(row);
    if (!block || typeof block.id !== "string" || !UUID.test(block.id))
      fail("invalid_source_response");
    notionText(block, output);
    if (block.has_children === true) {
      if (visited.has(block.id)) fail("source_cycle");
      if (queue.length >= MAX_QUEUE) fail("source_queue_overflow");
      visited.add(block.id);
      queue.push({ id: block.id, cursor: null, seen: [] });
    }
  }
}

function pageUrl(id: string, value: Record<string, unknown>) {
  return safeUrl(value.url) ?? `https://www.notion.so/${id.replaceAll("-", "")}`;
}

function continuation(value: unknown): { token?: string; more?: boolean } {
  const roots = [
    asRecord(value),
    asRecord(asRecord(value)?.data),
    asRecord(asRecord(value)?.result),
  ].filter((item): item is Record<string, unknown> => Boolean(item));
  for (const root of roots) {
    for (const key of ["next_cursor", "next_page_token", "nextCursor"]) {
      if (root[key] !== undefined && root[key] !== null) {
        if (typeof root[key] !== "string" || !root[key] || root[key].length > 2_000)
          fail("invalid_source_pagination");
        if (root.has_more === false || root.hasNext === false) fail("invalid_source_pagination");
        return { token: root[key], more: true };
      }
    }
    const pageInfo = asRecord(root.pageInfo);
    if (pageInfo) {
      const more = pageInfo.hasNext ?? pageInfo.hasNextPage;
      const token = pageInfo.endCursor ?? pageInfo.nextCursor;
      if (more !== undefined && typeof more !== "boolean") fail("invalid_source_pagination");
      if (
        token !== undefined &&
        token !== null &&
        (typeof token !== "string" || !token || token.length > 2_000)
      )
        fail("invalid_source_pagination");
      if (more === true && (typeof token !== "string" || !token)) fail("invalid_source_pagination");
      return { more: more === true, ...(typeof token === "string" ? { token } : {}) };
    }
    if (root.has_more !== undefined || root.hasNext !== undefined) {
      if (
        (root.has_more !== undefined && typeof root.has_more !== "boolean") ||
        (root.hasNext !== undefined && typeof root.hasNext !== "boolean") ||
        (root.has_more !== undefined &&
          root.hasNext !== undefined &&
          root.has_more !== root.hasNext)
      )
        fail("invalid_source_pagination");
      return { more: root.has_more === true || root.hasNext === true };
    }
  }
  return {};
}

function responseRows(value: unknown) {
  const root = asRecord(value);
  if (Array.isArray(value)) return value;
  if (Array.isArray(root?.data)) return root.data;
  for (const candidate of [
    root?.results,
    root?.items,
    root?.records,
    root?.entries,
    asRecord(root?.data)?.results,
    asRecord(root?.data)?.items,
  ]) {
    if (Array.isArray(candidate)) return candidate;
  }
  return undefined;
}

function genericDocument(
  tool: ConnectorTool,
  args: Record<string, unknown>,
  result: unknown,
  cursor: string | null,
) {
  const projected = redact(result);
  const root = asRecord(projected);
  const title = (root && (textValue(root.title) || textValue(root.name))) || tool.name;
  const content = JSON.stringify(projected) ?? "null";
  const text = boundedUtf8(content, MAX_DOCUMENT_BYTES);
  const url = root
    ? (safeUrl(root.url) ?? safeUrl(root.html_url) ?? safeUrl(root.web_url) ?? safeUrl(root.link))
    : undefined;
  return {
    id: `generic:${stableHash([tool.name, args, cursor])}`,
    title,
    text,
    snippet: text.slice(0, 2_000),
    ...(url ? { sourceUrl: url } : {}),
  };
}

export function createCompanyDocumentReader(
  reader: CompanyConnectionReader,
): CompanyDocumentReader {
  const contextWithCompanyFlag = (context: AdapterContext): AdapterContext => ({
    ...context,
    companyImportReadOnly: true,
  });

  async function listTools(source: CompanyImportSourceDescriptor, context: AdapterContext) {
    if (!isCompanyDocumentSource(source)) fail("unsupported_source");
    const tools = await reader.listTools(source, contextWithCompanyFlag(context));
    if (source.sourceKind === "notion") {
      return tools.filter(
        (tool) =>
          tool.route?.connectorId === "composio" &&
          tool.readOnly !== false &&
          tool.route.discoveredReadOnly !== false &&
          COMPANY_NOTION_READ_TOOLS.includes(tool.name as never),
      );
    }
    return tools.filter(isCompanyGenericReadTool);
  }

  async function validate(source: CompanyImportSourceDescriptor, context: AdapterContext) {
    const tools = await listTools(source, context);
    if (source.sourceKind === "notion") {
      if (!CompanyNotionScopeSchema.safeParse(source.scope).success) fail("invalid_source_scope");
      const available = new Set(tools.map((tool) => tool.name));
      if (COMPANY_NOTION_READ_TOOLS.some((name) => !available.has(name)))
        fail("source_capability_unavailable");
      return {
        tools: tools.filter((tool) => COMPANY_NOTION_READ_TOOLS.includes(tool.name as never)),
      };
    }
    const parsed = CompanyGenericScopeSchema.safeParse(source.scope);
    if (!parsed.success || parsed.data.tools.length === 0) fail("invalid_source_scope");
    const byName = new Map(tools.map((tool) => [tool.name, tool]));
    for (const selected of parsed.data.tools) {
      const tool = byName.get(selected.name);
      if (tool?.readOnly !== true) fail("source_tool_unavailable");
      const inputSchema = asRecord(tool.inputSchema) ?? {};
      const schema = toolArgsSchema(tool);
      const cursorField = declared(schema, CURSORS);
      const sizeField = declared(schema, SIZES);
      const required = asArray(inputSchema.required) ?? [];
      if (cursorField && required.includes(cursorField)) fail("source_pagination_unavailable");
      const validationArgs = { ...selected.args };
      if (sizeField && validationArgs[sizeField] === undefined)
        validationArgs[sizeField] = boundedPageSize(schema[sizeField]);
      try {
        assertConnectorToolArgs(tool.inputSchema, validationArgs);
      } catch {
        fail("source_tool_arguments_invalid");
      }
      for (const [key, value] of Object.entries(selected.args)) {
        if (!Object.hasOwn(schema, key)) fail("source_tool_arguments_invalid");
        if (
          (CURSORS as readonly string[]).includes(key) ||
          (SIZES as readonly string[]).includes(key)
        )
          fail("source_tool_arguments_invalid");
        if (value === undefined) fail("source_tool_arguments_invalid");
      }
    }
    return { tools };
  }

  return {
    supports: async (source, context) => {
      try {
        const tools = await listTools(source, context);
        if (source.sourceKind === "notion")
          return COMPANY_NOTION_READ_TOOLS.every((name) =>
            tools.some((tool) => tool.name === name),
          );
        return tools.some((tool) => tool.readOnly === true);
      } catch {
        return false;
      }
    },
    listTools,
    validate,
    async discover(source, cursor, maxUnits, context) {
      const bounded = Math.min(PAGE_SIZE, Math.max(1, maxUnits));
      if (source.sourceKind === "notion") {
        await validate(source, context);
        const current = asRecord(cursor) ?? {};
        if (
          current.startCursor !== undefined &&
          (typeof current.startCursor !== "string" || current.startCursor.length > 2_000)
        )
          fail("invalid_source_cursor");
        const token = typeof current.startCursor === "string" ? current.startCursor : undefined;
        const rawSeen = Array.isArray(current.seen) ? current.seen : [];
        if (
          rawSeen.length > MAX_VISITED ||
          rawSeen.some((item) => typeof item !== "string" || !item || item.length > 2_000)
        )
          fail("invalid_source_cursor");
        const seen = rawSeen as string[];
        const args: Record<string, unknown> = { filter_value: "page", page_size: bounded };
        if (token) args.start_cursor = token;
        const result = asRecord(
          await reader.callTool(
            source,
            "NOTION_SEARCH_NOTION_PAGE",
            args,
            contextWithCompanyFlag(context),
          ),
        );
        const rows = asArray(result?.results);
        if (!rows) fail("invalid_source_response");
        if (rows.length > bounded) fail("source_queue_overflow");
        const units = rows.map((row) => {
          const item = asRecord(row);
          const id = item?.id;
          if (typeof id !== "string" || !UUID.test(id)) fail("invalid_source_response");
          return { unitKey: `notion:${id}`, cursor: { kind: "notion", pageId: id } };
        });
        const page = continuation(result);
        if (page.more && !page.token) fail("invalid_source_pagination");
        if (page.more && units.length === 0) fail("source_cursor_stalled");
        if (rows.length === bounded && page.more === undefined)
          fail("source_pagination_unavailable");
        if (page.token && seen.includes(page.token)) fail("source_cursor_stalled");
        if (page.token && seen.length >= MAX_VISITED) fail("source_queue_overflow");
        const nextSeen = [...seen, ...(page.token ? [page.token] : [])];
        return {
          units,
          nextCursor: page.more ? { startCursor: page.token, seen: nextSeen } : null,
          done: !page.more,
        };
      }
      await validate({ ...source, scope: source.scope }, context);
      const parsed = CompanyGenericScopeSchema.parse(source.scope);
      const current = asRecord(cursor) ?? {};
      const offset = typeof current.offset === "number" ? current.offset : 0;
      const selected = parsed.tools.slice(offset, offset + bounded);
      return {
        units: selected.map((item) => ({
          unitKey: `generic:${stableHash([item.name, item.args])}`,
          cursor: {
            kind: "generic",
            toolName: item.name,
            args: item.args,
            pageToken: null,
            seen: [],
          },
        })),
        nextCursor:
          offset + selected.length < parsed.tools.length
            ? { offset: offset + selected.length }
            : null,
        done: offset + selected.length >= parsed.tools.length,
      };
    },
    async read(source, cursor, context) {
      if (source.sourceKind === "notion") {
        await validate(source, context);
        const state = asRecord(cursor);
        const pageId = state?.pageId;
        if (typeof pageId !== "string" || !UUID.test(pageId)) fail("invalid_source_cursor");
        const metadata = asRecord(
          await reader.callTool(
            source,
            "NOTION_RETRIEVE_PAGE",
            { page_id: pageId },
            contextWithCompanyFlag(context),
          ),
        );
        if (
          !metadata ||
          typeof metadata.id !== "string" ||
          !UUID.test(metadata.id) ||
          metadata.id !== pageId
        )
          fail("invalid_source_response");
        const output: string[] = [notionTitle(metadata)];
        const properties = asRecord(metadata.properties);
        if (properties) {
          for (const [key, value] of Object.entries(properties)) {
            if (!SENSITIVE.test(key)) {
              const text = textValue(
                asRecord(value)?.[String(asRecord(value)?.type ?? "")] ?? value,
              );
              if (text) output.push(`${key}: ${text}`);
            }
          }
        }
        const queue: Array<{ id: string; cursor: string | null; seen: string[] }> = [];
        const visited = new Set<string>([pageId]);
        queue.push({ id: pageId, cursor: null, seen: [] });
        while (queue.length) {
          const next = queue.shift()!;
          if (next.cursor && next.cursor.length > 2_000) fail("invalid_source_cursor");
          const args: Record<string, unknown> = { block_id: next.id, page_size: PAGE_SIZE };
          if (next.cursor) args.start_cursor = next.cursor;
          const blocks = asRecord(
            await reader.callTool(
              source,
              "NOTION_FETCH_BLOCK_CONTENTS",
              args,
              contextWithCompanyFlag(context),
            ),
          );
          const rows = blocks?.results;
          if (!Array.isArray(rows)) fail("invalid_source_response");
          if (rows.length > PAGE_SIZE) fail("source_queue_overflow");
          notionBlocks(rows, output, queue, visited);
          const page = continuation(blocks);
          if (page.more && !page.token) fail("invalid_source_pagination");
          if (page.more && rows.length === 0) fail("source_cursor_stalled");
          if (rows.length === PAGE_SIZE && page.more === undefined)
            fail("source_pagination_unavailable");
          if (page.token && next.seen.includes(page.token)) fail("source_cursor_stalled");
          if (page.more && page.token) {
            if (next.seen.length >= MAX_VISITED) fail("source_queue_overflow");
            queue.push({
              id: next.id,
              cursor: page.token,
              seen: [...next.seen, page.token],
            });
          }
          if (visited.size > MAX_VISITED) fail("source_queue_overflow");
        }
        const text = boundedUtf8(output.join("\n"), MAX_DOCUMENT_BYTES);
        const document = {
          id: `notion:${pageId}`,
          title: notionTitle(metadata),
          text,
          snippet: text.slice(0, 2_000),
          sourceUrl: pageUrl(pageId, metadata),
        };
        return { document, nextCursor: null, done: true };
      }
      const state = asRecord(cursor);
      const toolName = state?.toolName;
      if (typeof toolName !== "string") fail("invalid_source_cursor");
      const { tools } = await validate(source, context);
      const tool = tools.find((candidate) => candidate.name === toolName);
      const selected = CompanyGenericScopeSchema.parse(source.scope).tools.find(
        (item) => item.name === toolName,
      );
      if (!tool || !selected) fail("source_tool_unavailable");
      const schema = toolArgsSchema(tool);
      const cursorField = declared(schema, CURSORS);
      const sizeField = declared(schema, SIZES);
      if (
        state?.pageToken !== undefined &&
        state.pageToken !== null &&
        (typeof state.pageToken !== "string" || state.pageToken.length > 2_000)
      )
        fail("invalid_source_cursor");
      const pageToken = typeof state?.pageToken === "string" ? state.pageToken : undefined;
      const rawSeen = Array.isArray(state?.seen) ? state.seen : [];
      if (
        rawSeen.length > MAX_VISITED ||
        rawSeen.some((item) => typeof item !== "string" || !item || item.length > 2_000)
      )
        fail("invalid_source_cursor");
      const seen = rawSeen as string[];
      const args = { ...selected.args };
      if (cursorField && pageToken) args[cursorField] = pageToken;
      if (sizeField && args[sizeField] === undefined)
        args[sizeField] = boundedPageSize(schema[sizeField]);
      const result = await reader.callTool(source, toolName, args, contextWithCompanyFlag(context));
      const rows = responseRows(result);
      const page = continuation(result);
      const pageSize = sizeField
        ? Number(args[sizeField] ?? boundedPageSize(schema[sizeField]))
        : PAGE_SIZE;
      if (rows && rows.length > pageSize) fail("source_queue_overflow");
      const full = rows !== undefined && rows.length >= pageSize;
      if (page.more && !cursorField) fail("source_pagination_unavailable");
      if (page.more && !page.token) fail("invalid_source_pagination");
      if (page.more && rows?.length === 0) fail("source_cursor_stalled");
      if (page.token && seen.includes(page.token)) fail("source_cursor_stalled");
      if (page.token && seen.length >= MAX_VISITED) fail("source_queue_overflow");
      if (full && !page.more && page.more !== false && !page.token)
        fail("source_pagination_unavailable");
      const nextCursor = page.more
        ? {
            kind: "generic",
            toolName,
            args: selected.args,
            pageToken: page.token,
            seen: [...seen, page.token!],
          }
        : null;
      return {
        document: genericDocument(tool, args, result, pageToken ?? null),
        nextCursor,
        done: !page.more,
      };
    },
  };
}
