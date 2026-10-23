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
const MAX_ARRAY_ITEMS = 100;
const MAX_OBJECT_FIELDS = 200;
const MAX_CURSOR_BYTES = 2_000;
const SHA256_HEX = /^[a-f0-9]{64}$/;
const PAGINATION_KEYS = [
  "next_cursor",
  "next_page_token",
  "nextCursor",
  "has_more",
  "hasNext",
  "pageInfo",
] as const;
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

function normalizedSeenHashes(value: Record<string, unknown>) {
  const rawHashes = value.seenHashes;
  const rawTokens = value.seen;
  if (
    (rawHashes !== undefined &&
      (!Array.isArray(rawHashes) ||
        rawHashes.some((item) => typeof item !== "string" || !SHA256_HEX.test(item)))) ||
    (rawTokens !== undefined &&
      (!Array.isArray(rawTokens) ||
        rawTokens.some(
          (item) => typeof item !== "string" || !item || item.length > MAX_CURSOR_BYTES,
        )))
  )
    fail("invalid_source_cursor");
  const hashes = [...((rawHashes ?? []) as string[]), ...((rawTokens ?? []) as string[]).map(hash)];
  if (hashes.length > MAX_VISITED || new Set(hashes).size !== hashes.length)
    fail("invalid_source_cursor");
  return hashes;
}

function hasSeenToken(seenHashes: string[], token: string) {
  return seenHashes.includes(hash(token));
}

function appendSeenToken(seenHashes: string[], token: string) {
  if (seenHashes.length >= MAX_VISITED) fail("source_queue_overflow");
  return [...seenHashes, hash(token)];
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
    return url.username || url.password ? undefined : `${url.origin}${url.pathname}`;
  } catch {
    return undefined;
  }
}

/** A bare URL keeps its path only: query strings and fragments can carry tokens. */
function withoutUrlCredentials(value: string) {
  return /^https?:\/\/\S+$/i.test(value) ? (safeUrl(value) ?? "") : value;
}

function providerFailure(value: Record<string, unknown>): never {
  const error = asRecord(value.error);
  const status =
    value.status ??
    value.statusCode ??
    value.status_code ??
    error?.status ??
    error?.statusCode ??
    error?.status_code;
  const message = [value.message, value.error, error?.message, error?.code, value.code]
    .filter((part) => typeof part === "string" || typeof part === "number")
    .join(" ");
  if (Number(status) === 429 || /\b429\b|rate.?limit|too many requests|quota/i.test(message))
    throw new CompanyImportWorkerError("rate_limited", 60_000);
  throw new CompanyImportWorkerError("source_request_failed");
}

function decodeToolResult(value: unknown) {
  let current = value;
  const seen = new Set<object>();
  const metadata: Record<string, unknown> = {};
  const decoded = () => {
    if (Object.keys(metadata).length === 0) return current;
    if (Array.isArray(current)) return { ...metadata, results: current };
    const root = asRecord(current);
    if (!root) fail("invalid_source_response");
    return { ...metadata, ...root };
  };
  for (let depth = 0; depth < 8; depth++) {
    const root = asRecord(current);
    if (!root) return decoded();
    if (seen.has(root)) fail("invalid_source_response");
    seen.add(root);
    const error = root.error;
    const hasFailure =
      root.success === false ||
      root.successful === false ||
      root.ok === false ||
      root.isError === true ||
      (typeof root.status === "number" && root.status >= 400) ||
      (typeof root.statusCode === "number" && root.statusCode >= 400) ||
      (typeof root.status_code === "number" && root.status_code >= 400) ||
      (error !== undefined && error !== null && error !== false && error !== "");
    if (hasFailure) providerFailure(root);
    const wrapped =
      Object.hasOwn(root, "data") &&
      (root.success === true ||
        root.successful === true ||
        Object.hasOwn(root, "logId") ||
        Object.hasOwn(root, "log_id"));
    if (!wrapped) return decoded();
    for (const key of PAGINATION_KEYS) {
      if (Object.hasOwn(root, key)) metadata[key] = root[key];
    }
    current = root.data;
  }
  fail("invalid_source_response");
}

function redact(value: unknown, key = "", depth = 0): unknown {
  if (SENSITIVE.test(key)) return undefined;
  if (depth > 12) fail("source_projection_overflow");
  if (typeof value === "string") return boundedUtf8(withoutUrlCredentials(value), MAX_VALUE_BYTES);
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_ITEMS) fail("source_projection_overflow");
    return value.map((item) => redact(item, key, depth + 1));
  }
  if (!value || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  const entries = Object.entries(value).filter(([childKey]) => !SENSITIVE.test(childKey));
  if (entries.length > MAX_OBJECT_FIELDS) fail("source_projection_overflow");
  for (const [childKey, child] of entries) {
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

function notionBlock(value: unknown) {
  const object = asRecord(value);
  if (
    !object ||
    typeof object.id !== "string" ||
    !UUID.test(object.id) ||
    (object.has_children !== undefined && typeof object.has_children !== "boolean")
  )
    fail("invalid_source_response");
  const type = typeof object.type === "string" ? object.type : "";
  const payload = type ? object[type] : object;
  return {
    id: object.id,
    type: type || "block",
    text: boundedUtf8(textValue(redact(payload)), MAX_DOCUMENT_BYTES),
    hasChildren: object.has_children === true,
  };
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
        if (typeof root[key] !== "string" || !root[key] || root[key].length > MAX_CURSOR_BYTES)
          fail("invalid_source_pagination");
        if (root.has_more === false || root.hasNext === false)
          return { token: root[key], more: false };
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
        (typeof token !== "string" || !token || token.length > MAX_CURSOR_BYTES)
      )
        fail("invalid_source_pagination");
      if (more === true && (typeof token !== "string" || !token)) fail("invalid_source_pagination");
      if (more === false) return { more: false, ...(typeof token === "string" ? { token } : {}) };
      if (more === true) return { more: true, token: token as string };
      if (typeof token === "string") return { more: true, token };
      return {};
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

function providerItemId(value: unknown) {
  const root = asRecord(value);
  if (!root) return undefined;
  for (const key of ["id", "uuid", "record_id", "item_id", "page_id"]) {
    const candidate = root[key];
    if (
      (typeof candidate === "string" &&
        candidate.length > 0 &&
        candidate.length <= MAX_CURSOR_BYTES) ||
      (typeof candidate === "number" && Number.isFinite(candidate))
    )
      return String(candidate);
  }
  return undefined;
}

export function genericDocument(
  tool: ConnectorTool,
  ownerArgs: Record<string, unknown>,
  item: unknown,
  pageToken: string | null,
  itemIndex: number,
) {
  const projected = redact(item);
  const root = asRecord(projected);
  const title = (root && (textValue(root.title) || textValue(root.name))) || tool.name;
  const content = JSON.stringify(projected) ?? "null";
  const text = boundedUtf8(content, MAX_DOCUMENT_BYTES);
  const url = root
    ? (safeUrl(root.url) ?? safeUrl(root.html_url) ?? safeUrl(root.web_url) ?? safeUrl(root.link))
    : undefined;
  const itemId = providerItemId(root);
  const identity = itemId ? ["provider-id", itemId] : ["page-item", pageToken, itemIndex];
  return {
    id: `generic:${stableHash([tool.name, ownerArgs, identity])}`,
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
        const seenHashes = normalizedSeenHashes(current);
        const args: Record<string, unknown> = { filter_value: "page", page_size: bounded };
        if (token) args.start_cursor = token;
        const result = asRecord(
          decodeToolResult(
            await reader.callTool(
              source,
              "NOTION_SEARCH_NOTION_PAGE",
              args,
              contextWithCompanyFlag(context),
            ),
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
        if (page.token && hasSeenToken(seenHashes, page.token)) fail("source_cursor_stalled");
        const nextSeenHashes = page.token ? appendSeenToken(seenHashes, page.token) : seenHashes;
        return {
          units,
          nextCursor: page.more ? { startCursor: page.token, seenHashes: nextSeenHashes } : null,
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
            seenHashes: [],
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
        if (!state?.phase) {
          const metadata = asRecord(
            decodeToolResult(
              await reader.callTool(
                source,
                "NOTION_RETRIEVE_PAGE",
                { page_id: pageId },
                contextWithCompanyFlag(context),
              ),
            ),
          );
          if (
            !metadata ||
            typeof metadata.id !== "string" ||
            !UUID.test(metadata.id) ||
            metadata.id !== pageId
          )
            fail("invalid_source_response");
          const properties = asRecord(metadata.properties) ?? {};
          const entries = Object.entries(properties).filter(([key]) => !SENSITIVE.test(key));
          if (entries.length > MAX_OBJECT_FIELDS) fail("source_projection_overflow");
          const lines = [notionTitle(metadata)];
          for (const [key, value] of entries) {
            const property = asRecord(value);
            const text = textValue(property?.[String(property?.type ?? "")] ?? value, key);
            if (text) lines.push(`${key}: ${text}`);
          }
          const text = boundedUtf8(lines.join("\n"), MAX_DOCUMENT_BYTES);
          return {
            document: {
              id: `notion:${pageId}:metadata`,
              title: notionTitle(metadata),
              text,
              snippet: text.slice(0, 2_000),
              sourceUrl: pageUrl(pageId, metadata),
            },
            nextCursor: {
              kind: "notion",
              phase: "blocks",
              pageId,
              queue: [{ id: pageId, pageToken: null, rowIndex: 0, seenHashes: [] }],
              visited: [pageId],
            },
            done: false,
          };
        }
        if (state.phase !== "blocks") fail("invalid_source_cursor");
        const rawVisited = state.visited;
        const rawQueue = state.queue;
        if (
          !Array.isArray(rawVisited) ||
          rawVisited.length === 0 ||
          rawVisited.length > MAX_VISITED ||
          rawVisited.some((id) => typeof id !== "string" || !UUID.test(id)) ||
          !Array.isArray(rawQueue) ||
          rawQueue.length === 0 ||
          rawQueue.length > MAX_QUEUE
        )
          fail("invalid_source_cursor");
        const visited = new Set(rawVisited as string[]);
        if (visited.size !== rawVisited.length || !visited.has(pageId))
          fail("invalid_source_cursor");
        const queue = rawQueue.map((item) => {
          const entry = asRecord(item);
          const pageToken = entry?.pageToken;
          const rowIndex = entry?.rowIndex;
          if (
            typeof entry?.id !== "string" ||
            !UUID.test(entry.id) ||
            (pageToken !== null &&
              (typeof pageToken !== "string" || pageToken.length > MAX_CURSOR_BYTES)) ||
            !Number.isInteger(rowIndex) ||
            (rowIndex as number) < 0 ||
            (rowIndex as number) > PAGE_SIZE
          )
            fail("invalid_source_cursor");
          return {
            id: entry.id,
            pageToken: pageToken as string | null,
            rowIndex: rowIndex as number,
            seenHashes: normalizedSeenHashes(entry),
          };
        });
        const entry = queue[0]!;
        const args: Record<string, unknown> = { block_id: entry.id, page_size: PAGE_SIZE };
        if (entry.pageToken) args.start_cursor = entry.pageToken;
        const blocks = decodeToolResult(
          await reader.callTool(
            source,
            "NOTION_FETCH_BLOCK_CONTENTS",
            args,
            contextWithCompanyFlag(context),
          ),
        );
        const rows = responseRows(blocks);
        if (!rows) fail("invalid_source_response");
        if (rows.length > PAGE_SIZE) fail("source_queue_overflow");
        const page = continuation(blocks);
        if (page.more && !page.token) fail("invalid_source_pagination");
        if (page.more && rows.length === 0) fail("source_cursor_stalled");
        if (rows.length === PAGE_SIZE && page.more === undefined)
          fail("source_pagination_unavailable");
        if (entry.rowIndex > rows.length) fail("source_cursor_stalled");
        if (page.more && hasSeenToken(entry.seenHashes, page.token!)) fail("source_cursor_stalled");

        let document: CompanyDocumentPage["document"];
        if (entry.rowIndex < rows.length) {
          const block = notionBlock(rows[entry.rowIndex]);
          if (visited.has(block.id)) fail("source_cycle");
          if (visited.size >= MAX_VISITED) fail("source_queue_overflow");
          visited.add(block.id);
          if (block.hasChildren) {
            if (queue.length >= MAX_QUEUE) fail("source_queue_overflow");
            queue.push({ id: block.id, pageToken: null, rowIndex: 0, seenHashes: [] });
          }
          const text = boundedUtf8(`${block.type}\n${block.text}`, MAX_DOCUMENT_BYTES);
          document = {
            id: `notion:${pageId}:${block.id}`,
            title: block.text ? `${block.type}: ${block.text.slice(0, 120)}` : block.type,
            text,
            snippet: text.slice(0, 2_000),
            sourceUrl: `https://www.notion.so/${pageId.replaceAll("-", "")}`,
          };
          if (entry.rowIndex + 1 < rows.length) {
            queue[0] = { ...entry, rowIndex: entry.rowIndex + 1 };
          } else if (page.more) {
            queue[0] = {
              id: entry.id,
              pageToken: page.token!,
              rowIndex: 0,
              seenHashes: appendSeenToken(entry.seenHashes, page.token!),
            };
          } else {
            queue.shift();
          }
        } else if (page.more) {
          queue[0] = {
            id: entry.id,
            pageToken: page.token!,
            rowIndex: 0,
            seenHashes: appendSeenToken(entry.seenHashes, page.token!),
          };
        } else {
          queue.shift();
        }
        if (queue.length > MAX_QUEUE) fail("source_queue_overflow");
        const nextCursor = queue.length
          ? {
              kind: "notion",
              phase: "blocks",
              pageId,
              queue,
              visited: [...visited],
            }
          : null;
        return { document, nextCursor, done: nextCursor === null };
      }
      const state = asRecord(cursor) ?? {};
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
      const rowIndex = state?.rowIndex === undefined ? 0 : state.rowIndex;
      if (
        !Number.isInteger(rowIndex) ||
        (rowIndex as number) < 0 ||
        (rowIndex as number) > PAGE_SIZE
      )
        fail("invalid_source_cursor");
      if (
        state?.pageToken !== undefined &&
        state.pageToken !== null &&
        (typeof state.pageToken !== "string" || state.pageToken.length > MAX_CURSOR_BYTES)
      )
        fail("invalid_source_cursor");
      const pageToken = typeof state?.pageToken === "string" ? state.pageToken : undefined;
      const seenHashes = normalizedSeenHashes(state);
      const args = { ...selected.args };
      if (cursorField && pageToken) args[cursorField] = pageToken;
      if (sizeField && args[sizeField] === undefined)
        args[sizeField] = boundedPageSize(schema[sizeField]);
      const result = decodeToolResult(
        await reader.callTool(source, toolName, args, contextWithCompanyFlag(context)),
      );
      const rows = responseRows(result);
      const page = continuation(result);
      const pageSize = sizeField
        ? Number(args[sizeField] ?? boundedPageSize(schema[sizeField]))
        : PAGE_SIZE;
      if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > PAGE_SIZE)
        fail("source_pagination_unavailable");
      if (rows && rows.length > pageSize) fail("source_queue_overflow");
      if (page.more && !cursorField) fail("source_pagination_unavailable");
      if (page.more && !page.token) fail("invalid_source_pagination");
      if (page.more && rows?.length === 0) fail("source_cursor_stalled");
      if (rows && rows.length === pageSize && page.more === undefined)
        fail("source_pagination_unavailable");
      if (!rows) {
        if (page.more) fail("source_cursor_stalled");
        const root = asRecord(result);
        const keys = Object.keys(root ?? {});
        if (keys.length && keys.every((key) => PAGINATION_KEYS.includes(key as never)))
          return { nextCursor: null, done: true };
        return {
          document: genericDocument(tool, selected.args, result, pageToken ?? null, 0),
          nextCursor: null,
          done: true,
        };
      }
      if ((rowIndex as number) > rows.length) fail("source_cursor_stalled");
      if ((rowIndex as number) === rows.length) {
        if (!page.more) return { nextCursor: null, done: true };
        if (hasSeenToken(seenHashes, page.token!)) fail("source_cursor_stalled");
        return {
          nextCursor: {
            kind: "generic",
            toolName,
            pageToken: page.token,
            rowIndex: 0,
            seenHashes: appendSeenToken(seenHashes, page.token!),
          },
          done: false,
        };
      }
      const document = genericDocument(
        tool,
        selected.args,
        rows[rowIndex as number],
        pageToken ?? null,
        rowIndex as number,
      );
      let nextCursor: Record<string, unknown> | null = null;
      if ((rowIndex as number) + 1 < rows.length) {
        nextCursor = {
          kind: "generic",
          toolName,
          pageToken: pageToken ?? null,
          rowIndex: (rowIndex as number) + 1,
          seenHashes,
        };
      } else if (page.more) {
        if (hasSeenToken(seenHashes, page.token!)) fail("source_cursor_stalled");
        nextCursor = {
          kind: "generic",
          toolName,
          pageToken: page.token,
          rowIndex: 0,
          seenHashes: appendSeenToken(seenHashes, page.token!),
        };
      }
      return { document, nextCursor, done: nextCursor === null };
    },
  };
}
