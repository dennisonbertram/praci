import type {
  AdapterContext,
  CompanyConnectionReader,
  CompanyImportSourceDescriptor,
  ConnectorTool,
} from "@rakazo/adapter-kit";
import { CompanyTrackerScopeSchema } from "@rakazo/contracts";
import { z } from "zod";
import { CompanyImportWorkerError } from "./company-import-engine.js";

const COOLDOWN_MS = 60_000;
const PAGE_LIMIT = 100;
const responseLimit = 2_000_000;
const segment = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9_.-]+$/);
const opaqueId = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9._:-]+$/);
const githubId = z.union([z.number().int().positive(), z.string().regex(/^\d{1,32}$/)]);
const cursorToken = z.string().min(1).max(4096);
const githubDiscoveryCursor = z.strictObject({
  phase: z.enum(["organizations", "repositories"]).default("organizations"),
  page: z.number().int().positive().max(1_000_000).default(1),
});
const githubUnitCursor = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("organization"),
    id: githubId,
    org: segment,
    phase: z.enum(["members", "projects"]).default("members"),
    page: z.number().int().positive().max(1_000_000).default(1),
    after: cursorToken.nullable().optional(),
  }),
  z.strictObject({
    kind: z.literal("repository"),
    id: githubId,
    owner: segment,
    repo: segment,
    phase: z.enum(["metadata", "milestones", "issues"]).default("metadata"),
    page: z.number().int().positive().max(1_000_000).default(1),
  }),
]);
const linearDiscoveryCursor = z.strictObject({
  phase: z.enum(["users", "teams", "projects", "issues", "done"]).default("users"),
  token: cursorToken.nullable().optional(),
});
const linearUnitCursor = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.enum(["user", "team"]),
    id: opaqueId,
    token: cursorToken.nullable().optional(),
  }),
  z.strictObject({
    kind: z.literal("project"),
    id: opaqueId,
    phase: z.enum(["project", "milestones"]).default("project"),
    token: cursorToken.nullable().optional(),
    offset: z.number().int().nonnegative().max(100_000).optional(),
    milestoneIds: z.array(opaqueId).max(PAGE_LIMIT).optional(),
  }),
  z.strictObject({
    kind: z.literal("issue"),
    id: opaqueId,
  }),
]);

const githubOrganization = z.object({ id: githubId, login: segment });
const githubRepository = z.object({
  id: githubId,
  name: segment,
  full_name: z.string().min(3).max(202).optional(),
  owner: z.object({ login: segment }),
});
const githubMember = z.object({ id: githubId, login: segment });
const githubUser = z.object({
  id: githubId,
  login: segment,
  name: z.string().max(200).nullable().optional(),
  html_url: z.string().url().max(2048).optional(),
});
const githubRepositoryDetails = githubRepository.extend({
  html_url: z.string().url().max(2048).optional(),
});
const githubMilestone = z.object({
  id: githubId,
  number: z.number().int().positive().optional(),
  title: z.string().min(1).max(500),
  description: z.string().max(200_000).nullable().optional(),
  due_on: z.string().max(100).nullable().optional(),
  created_at: z.string().max(100).optional(),
  updated_at: z.string().max(100).optional(),
  html_url: z.string().url().max(2048).optional(),
  creator: z.object({ id: githubId.optional(), login: segment.optional() }).nullable().optional(),
});
const githubIssue = z.object({
  id: githubId,
  number: z.number().int().positive().optional(),
  title: z.string().min(1).max(20_000),
  body: z.string().max(200_000).nullable().optional(),
  created_at: z.string().max(100).optional(),
  updated_at: z.string().max(100).optional(),
  closed_at: z.string().max(100).nullable().optional(),
  html_url: z.string().url().max(2048).optional(),
  pull_request: z.unknown().optional(),
  user: z.object({ id: githubId.optional(), login: segment.optional() }).nullable().optional(),
  assignees: z
    .array(z.object({ id: githubId.optional(), login: segment.optional() }))
    .max(100)
    .optional(),
});
const githubProject = z.object({
  id: z.string().min(1).max(200),
  title: z.string().min(1).max(500),
  url: z.string().url().max(2048).optional(),
  html_url: z.string().url().max(2048).optional(),
  startDate: z.string().max(100).nullable().optional(),
  targetDate: z.string().max(100).nullable().optional(),
});
const linearUser = z.object({
  id: opaqueId,
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().max(254).optional(),
  displayName: z.string().min(1).max(200).optional(),
});
const linearTeam = z.object({
  id: opaqueId,
  name: z.string().min(1).max(200),
});
const linearProject = z.object({
  id: opaqueId,
  name: z.string().min(1).max(500),
  url: z.string().url().max(2048).optional(),
  startDate: z.string().max(100).nullable().optional(),
  targetDate: z.string().max(100).nullable().optional(),
});
const linearIssue = z.object({
  id: opaqueId,
  title: z.string().min(1).max(500),
  description: z.string().max(200_000).nullable().optional(),
  url: z.string().url().max(2048).optional(),
  createdAt: z.string().max(100).optional(),
  updatedAt: z.string().max(100).optional(),
  dueDate: z.string().max(100).nullable().optional(),
  creator: z
    .object({ id: opaqueId.optional(), name: z.string().max(200).optional() })
    .nullable()
    .optional(),
  assignee: z
    .object({ id: opaqueId.optional(), name: z.string().max(200).optional() })
    .nullable()
    .optional(),
});
const linearMilestone = z.object({
  id: opaqueId,
  name: z.string().min(1).max(500).optional(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(200_000).nullable().optional(),
  dueDate: z.string().max(100).nullable().optional(),
  targetDate: z.string().max(100).nullable().optional(),
  url: z.string().url().max(2048).optional(),
});

type Document = {
  id: string;
  title: string;
  text: string;
  snippet: string;
  sourceUrl: string | null;
  truncated?: boolean;
};

const githubOperations = {
  organizations: {
    name: "GITHUB_LIST_ORGANIZATIONS_FOR_THE_AUTHENTICATED_USER",
    args: ["page", "per_page"],
  },
  repositories: {
    name: "GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER",
    args: ["page", "per_page", "sort", "direction", "type"],
  },
  members: {
    name: "GITHUB_LIST_ORGANIZATION_MEMBERS",
    args: ["org", "page", "per_page"],
  },
  user: { name: "GITHUB_GET_A_USER", args: ["username"] },
  repository: { name: "GITHUB_GET_A_REPOSITORY", args: ["owner", "repo"] },
  milestones: {
    name: "GITHUB_LIST_MILESTONES",
    args: ["owner", "repo", "page", "per_page", "state"],
  },
  issues: {
    name: "GITHUB_LIST_REPOSITORY_ISSUES",
    args: ["owner", "repo", "page", "per_page", "state", "sort", "direction"],
  },
  projects: {
    name: "GITHUB_LIST_ORGANIZATION_PROJECTS",
    args: ["org", "after", "per_page"],
  },
} as const;
export const COMPANY_GITHUB_READ_TOOLS = Object.values(githubOperations).map((tool) => tool.name);

const linearToolNames = [
  "list_users",
  "list_teams",
  "list_projects",
  "get_project",
  "list_issues",
  "get_issue",
  "list_milestones",
] as const;
type LinearToolName = (typeof linearToolNames)[number];
type LinearPageArgs = { size: string; cursor?: string; offset?: string };
type LinearToolSet = {
  tools: Record<LinearToolName, ConnectorTool>;
  pageArgs: Record<"list_users" | "list_teams" | "list_projects" | "list_issues", LinearPageArgs>;
  milestoneArgs: {
    size?: string;
    cursor?: string;
    project: string;
    fullList: boolean;
  };
  projectArg: string;
  issueArg: string;
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new CompanyImportWorkerError("invalid_source_response");
  return value as Record<string, unknown>;
}

function rateLimitDelay(value: Record<string, unknown>): number {
  const retry =
    value.retry_after ??
    value.retryAfter ??
    value["Retry-After"] ??
    recordMaybe(value.headers)?.["retry-after"];
  if (typeof retry === "string" && Number.isNaN(Number(retry))) {
    const date = Date.parse(retry);
    if (Number.isFinite(date))
      return Math.max(COOLDOWN_MS, Math.min(date - Date.now(), 86_400_000));
  }
  const seconds = Number(retry ?? COOLDOWN_MS / 1000);
  return Number.isFinite(seconds)
    ? Math.max(COOLDOWN_MS, Math.min(seconds * 1000, 86_400_000))
    : COOLDOWN_MS;
}

function recordMaybe(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function decode(value: unknown, depth = 0): unknown {
  if (depth > 8) throw new CompanyImportWorkerError("invalid_source_response");
  if (typeof value === "string") {
    if (Buffer.byteLength(value) > responseLimit)
      throw new CompanyImportWorkerError("source_response_too_large");
    try {
      return decode(JSON.parse(value), depth + 1);
    } catch (error) {
      if (error instanceof CompanyImportWorkerError) throw error;
      throw new CompanyImportWorkerError("invalid_source_response");
    }
  }
  if (Array.isArray(value)) return value;
  const current = record(value);
  const errorValue = current.error ?? current.message ?? current.content;
  const hasError =
    (typeof current.error === "string" && current.error.trim() !== "") ||
    (typeof current.error === "object" && current.error !== null);
  const failed =
    current.successful === false ||
    current.ok === false ||
    current.isError === true ||
    Number(current.status ?? current.statusCode ?? current.status_code) === 429 ||
    hasError;
  if (failed) {
    const errorText = JSON.stringify(errorValue ?? "").toLowerCase();
    if (
      Number(current.status ?? current.statusCode ?? current.status_code) === 429 ||
      /rate.?limit|too_many_requests|\b429\b/.test(errorText)
    )
      throw new CompanyImportWorkerError("source_rate_limited", rateLimitDelay(current));
    throw new CompanyImportWorkerError("source_read_failed");
  }
  if (current.structuredContent !== undefined) return decode(current.structuredContent, depth + 1);
  if (Array.isArray(current.content)) {
    const text = current.content
      .filter((part) => recordMaybe(part)?.type === "text")
      .map((part) => recordMaybe(part)?.text)
      .filter((part): part is string => typeof part === "string")
      .join("\n");
    return decode(text, depth + 1);
  }
  const keys = Object.keys(current);
  if (
    current.data !== undefined &&
    current.successful === true &&
    keys.every((key) =>
      [
        "data",
        "successful",
        "error",
        "status",
        "statusCode",
        "status_code",
        "hasNextPage",
        "has_next_page",
        "hasNext",
        "has_next",
        "hasMore",
        "has_more",
        "endCursor",
        "end_cursor",
        "nextCursor",
        "next_cursor",
        "next",
        "pageInfo",
        "page_info",
        "pagination",
        "response_metadata",
        "meta",
      ].includes(key),
    )
  ) {
    const decoded = decode(current.data, depth + 1);
    const metadata = Object.fromEntries(
      keys
        .filter(
          (key) =>
            !["data", "successful", "error", "status", "statusCode", "status_code"].includes(key),
        )
        .map((key) => [key, current[key]]),
    );
    if (Object.keys(metadata).length === 0) return decoded;
    if (Array.isArray(decoded)) return { data: decoded, ...metadata };
    const decodedRecord = recordMaybe(decoded);
    return decodedRecord ? { ...decodedRecord, ...metadata } : { data: decoded, ...metadata };
  }
  return current;
}

function rows(value: unknown, keys: string[], max = PAGE_LIMIT): unknown[] {
  if (Array.isArray(value)) {
    if (value.length > max) throw new CompanyImportWorkerError("invalid_source_response");
    return value;
  }
  const current = record(value);
  for (const key of keys) {
    const candidate = current[key];
    if (Array.isArray(candidate)) {
      if (candidate.length > max) throw new CompanyImportWorkerError("invalid_source_response");
      return candidate;
    }
    const nested = recordMaybe(candidate);
    if (nested) {
      for (const nestedKey of ["nodes", "items"]) {
        if (Array.isArray(nested[nestedKey])) {
          if ((nested[nestedKey] as unknown[]).length > max)
            throw new CompanyImportWorkerError("invalid_source_response");
          return nested[nestedKey] as unknown[];
        }
      }
      if (nested.data !== undefined) return rows(nested.data, ["nodes", "items", ...keys], max);
    }
  }
  if (current.data !== undefined) return rows(current.data, keys, max);
  if (current.result !== undefined) return rows(current.result, keys, max);
  throw new CompanyImportWorkerError("invalid_source_response");
}

function githubProjectRows(value: unknown, max: number) {
  const root = record(value);
  const data = recordMaybe(root.data);
  const organization = recordMaybe(data?.organization ?? root.organization);
  const projectsV2 = recordMaybe(organization?.projectsV2 ?? data?.projectsV2 ?? root.projectsV2);
  if (Array.isArray(projectsV2?.nodes)) {
    if (projectsV2.nodes.length > max)
      throw new CompanyImportWorkerError("invalid_source_response");
    return projectsV2.nodes;
  }
  return rows(value, ["projects", "nodes", "items"], max);
}

function listMetadata(value: unknown): {
  hasNext: boolean | undefined;
  next: string | null;
} {
  if (Array.isArray(value)) return { hasNext: undefined, next: null };
  const root = record(value);
  const data = recordMaybe(root.data);
  const result = recordMaybe(root.result);
  const response = recordMaybe(root.response);
  const payloads = [root, data, result, response].filter((item): item is Record<string, unknown> =>
    Boolean(item),
  );
  const organization = recordMaybe(data?.organization ?? root.organization);
  const projectsV2 = recordMaybe(organization?.projectsV2 ?? data?.projectsV2 ?? root.projectsV2);
  const nested = payloads.flatMap((item) =>
    ["users", "teams", "projects", "issues", "milestones", "organization", "projectsV2"].map(
      (key) => recordMaybe(item[key]),
    ),
  );
  const nestedPages = nested.flatMap((item) =>
    item
      ? [recordMaybe(item.pageInfo), recordMaybe(item.page_info), recordMaybe(item.pagination)]
      : [],
  );
  const containers = [
    ...payloads,
    organization,
    projectsV2,
    ...nested,
    ...nestedPages,
    recordMaybe(root.pageInfo),
    recordMaybe(root.page_info),
    recordMaybe(root.pagination),
    recordMaybe(root.response_metadata),
    recordMaybe(root.meta),
    recordMaybe(projectsV2?.pageInfo),
    recordMaybe(projectsV2?.page_info),
  ].filter((item): item is Record<string, unknown> => Boolean(item));
  let hasNext: boolean | undefined;
  let next: string | null = null;
  for (const current of containers) {
    const flag =
      current.hasNextPage ??
      current.has_next_page ??
      current.hasNext ??
      current.has_next ??
      current.hasMore ??
      current.has_more;
    if (typeof flag === "boolean") hasNext = flag;
    const token =
      current.endCursor ??
      current.end_cursor ??
      current.nextCursor ??
      current.next_cursor ??
      current.next;
    if (token === null || token === "") next = null;
    else if (token !== undefined) next = cursorToken.parse(token);
  }
  return { hasNext, next: hasNext === false ? null : next };
}

function linearNext(value: unknown, currentToken: string | null, count: number, limit: number) {
  const page = listMetadata(value);
  if (page.hasNext === true && !page.next)
    throw new CompanyImportWorkerError("source_pagination_unavailable");
  if (page.next && page.next === currentToken)
    throw new CompanyImportWorkerError("source_cursor_stalled");
  if (page.next && count === 0) throw new CompanyImportWorkerError("source_cursor_stalled");
  if (page.hasNext === false) return null;
  if (page.next) return page.next;
  if (count < limit) return null;
  throw new CompanyImportWorkerError("source_pagination_unavailable");
}

function githubHasNext(value: unknown, count: number, limit: number, page: number) {
  const metadata = listMetadata(value);
  if (metadata.hasNext === true && count === 0)
    throw new CompanyImportWorkerError("source_cursor_stalled");
  if (metadata.hasNext === false) return false;
  if (metadata.hasNext === true || metadata.next) return true;
  if (count < limit) return false;
  if (page >= 1_000_000) throw new CompanyImportWorkerError("source_pagination_unavailable");
  return true;
}

function jsonSchema(tool: ConnectorTool) {
  const schema = record(tool.inputSchema);
  const properties = record(schema.properties);
  const required = Array.isArray(schema.required)
    ? schema.required.filter((item): item is string => typeof item === "string")
    : [];
  return { properties, required };
}

function assertGitHubTool(tool: ConnectorTool | undefined, expected: string, args: string[]) {
  if (
    !tool ||
    (tool.route?.toolName ?? tool.name) !== expected ||
    tool.route?.connectorId !== "composio"
  )
    throw new CompanyImportWorkerError("unsupported_reader");
  const { properties, required } = jsonSchema(tool);
  if (!args.every((arg) => arg in properties) || required.some((arg) => !args.includes(arg)))
    throw new CompanyImportWorkerError("unsupported_reader");
  if (args.includes("per_page")) {
    const pageSize = record(properties.per_page);
    const pageMaximum = Number(pageSize.maximum ?? PAGE_LIMIT);
    const pageMinimum = Number(pageSize.minimum ?? 1);
    const page = recordMaybe(properties.page);
    const pageMinimumValue = Number(page?.minimum ?? 1);
    if (
      !Number.isFinite(pageMaximum) ||
      !Number.isFinite(pageMinimum) ||
      pageMaximum < pageMinimum ||
      pageMaximum < 1 ||
      pageMinimum > 1 ||
      !["integer", "number"].includes(String(pageSize.type))
    )
      throw new CompanyImportWorkerError("unsupported_reader");
    if (
      page &&
      (!["integer", "number"].includes(String(page.type)) ||
        !Number.isFinite(pageMinimumValue) ||
        pageMinimumValue > 1 ||
        (page.maximum !== undefined &&
          (!Number.isFinite(Number(page.maximum)) || Number(page.maximum) < 1)))
    )
      throw new CompanyImportWorkerError("unsupported_reader");
  }
  if (expected === "GITHUB_LIST_ORGANIZATION_PROJECTS" && required.includes("after")) {
    const type = record(properties.after).type;
    if (!(Array.isArray(type) && type.includes("null")) && type !== "null")
      throw new CompanyImportWorkerError("unsupported_reader");
  }
  const requiredValues: Record<string, unknown> = {
    ...(expected === "GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER"
      ? { sort: "full_name", direction: "asc", type: "all" }
      : {}),
    ...(expected === "GITHUB_LIST_REPOSITORY_ISSUES"
      ? { state: "all", sort: "created", direction: "asc" }
      : {}),
    ...(expected === "GITHUB_LIST_MILESTONES" ? { state: "all" } : {}),
  };
  for (const [key, value] of Object.entries(requiredValues)) {
    if (!(key in properties)) continue;
    const choices = record(properties[key]).enum;
    if (Array.isArray(choices) && !choices.includes(value))
      throw new CompanyImportWorkerError("unsupported_reader");
  }
  return tool;
}

function inputArg(
  tool: ConnectorTool,
  choices: string[],
  required: boolean,
  nullable = false,
): string {
  const { properties, required: requiredArgs } = jsonSchema(tool);
  const arg = choices.find((candidate) => candidate in properties);
  if (!arg || (required && !requiredArgs.includes(arg)))
    throw new CompanyImportWorkerError("unsupported_reader");
  if (requiredArgs.includes(arg) && nullable) {
    const type = record(properties[arg]).type;
    if (!(Array.isArray(type) && type.includes("null")) && type !== "null")
      throw new CompanyImportWorkerError("unsupported_reader");
  }
  return arg;
}

function linearPageArgs(tool: ConnectorTool): LinearPageArgs {
  const size = inputArg(tool, ["limit", "first"], false);
  const cursor = (() => {
    try {
      return inputArg(tool, ["cursor", "after"], false, true);
    } catch {
      return undefined;
    }
  })();
  if (!cursor) throw new CompanyImportWorkerError("unsupported_reader");
  const { required } = jsonSchema(tool);
  if (required.some((name) => name !== size && name !== cursor))
    throw new CompanyImportWorkerError("unsupported_reader");
  return { size, cursor };
}

function linearMilestoneArgs(tool: ConnectorTool): LinearToolSet["milestoneArgs"] {
  const project = inputArg(tool, ["projectId", "project_id", "project"], true);
  const { properties, required } = jsonSchema(tool);
  const size = ["limit", "first"].find((candidate) => candidate in properties);
  const cursor = ["cursor", "after"].find((candidate) => candidate in properties);
  if ("offset" in properties) throw new CompanyImportWorkerError("unsupported_reader");
  const description = (tool.description ?? "").toLowerCase();
  const fullList =
    /\b(?:all|complete|full)\s+(?:project\s+)?milestones\b|\breturns?\s+(?:the\s+)?(?:full|complete)\s+list\b/.test(
      description,
    );
  if (!cursor && !fullList) throw new CompanyImportWorkerError("unsupported_reader");
  if (!size && !fullList) throw new CompanyImportWorkerError("unsupported_reader");
  if (
    cursor &&
    required.includes(cursor) &&
    !(() => {
      const type = record(properties[cursor]).type;
      return (Array.isArray(type) && type.includes("null")) || type === "null";
    })()
  )
    throw new CompanyImportWorkerError("unsupported_reader");
  if (required.some((name) => ![project, size, cursor].includes(name)))
    throw new CompanyImportWorkerError("unsupported_reader");
  return {
    project,
    ...(size ? { size } : {}),
    ...(cursor ? { cursor } : {}),
    fullList,
  };
}

function sourceKind(source: CompanyImportSourceDescriptor) {
  if (source.sourceKind === "github") return "github";
  if (source.sourceKind === "mcp" && source.scope.reader === "linear") return "linear";
  return null;
}

export function isCompanyTrackerSource(
  source: Pick<CompanyImportSourceDescriptor, "sourceKind" | "scope">,
) {
  if (source.sourceKind === "github") {
    const scope = CompanyTrackerScopeSchema.safeParse(source.scope);
    return scope.success && (scope.data.reader === undefined || scope.data.reader === "github");
  }
  if (source.sourceKind === "mcp" && source.scope.reader === "linear")
    return CompanyTrackerScopeSchema.safeParse(source.scope).success;
  return false;
}

function sourceRouteIsValid(source: CompanyImportSourceDescriptor) {
  if (source.sourceKind === "github")
    return Boolean(source.connectionId) && !source.mcpServerId && source.scope.reader !== "linear";
  return (
    source.sourceKind === "mcp" &&
    !source.connectionId &&
    Boolean(source.mcpServerId) &&
    source.scope.reader === "linear"
  );
}

function safeUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2000) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? value : null;
  } catch {
    return null;
  }
}

function linesDocument(id: string, title: string, lines: string[], sourceUrl: unknown): Document {
  const text = lines.filter(Boolean).join("\n");
  const textBytes = Buffer.from(text);
  let end = Math.min(textBytes.length, 20_000);
  while (end > 0 && end < textBytes.length && (textBytes[end]! & 0xc0) === 0x80) end--;
  const limitedText = textBytes.subarray(0, end).toString();
  const titleBytes = Buffer.from(title);
  let titleEnd = Math.min(titleBytes.length, 1024);
  while (titleEnd > 0 && titleEnd < titleBytes.length && (titleBytes[titleEnd]! & 0xc0) === 0x80)
    titleEnd--;
  const limitedTitle = titleBytes.subarray(0, titleEnd).toString();
  const snippetBytes = Buffer.from(limitedText);
  let snippetEnd = Math.min(snippetBytes.length, 1200);
  while (
    snippetEnd > 0 &&
    snippetEnd < snippetBytes.length &&
    (snippetBytes[snippetEnd]! & 0xc0) === 0x80
  )
    snippetEnd--;
  return {
    id,
    title: limitedTitle,
    text: limitedText,
    snippet: snippetBytes.subarray(0, snippetEnd).toString(),
    sourceUrl: safeUrl(sourceUrl),
    ...(limitedText !== text || limitedTitle !== title ? { truncated: true } : {}),
  };
}

function responseItem(value: unknown, keys: string[]): Record<string, unknown> {
  if (Array.isArray(value)) {
    if (value.length !== 1) throw new CompanyImportWorkerError("invalid_source_response");
    return record(value[0]);
  }
  const root = record(value);
  for (const key of keys) {
    if (root[key] !== undefined) return record(root[key]);
  }
  if (root.data !== undefined) return responseItem(root.data, keys);
  return root;
}

function idString(value: string | number) {
  return String(value);
}

function githubPageArgs(
  tool: ConnectorTool,
  page: number,
  desiredPerPage: number,
): { page?: number; per_page: number } {
  const { properties } = jsonSchema(tool);
  if (!properties.per_page) throw new CompanyImportWorkerError("unsupported_reader");
  const sizeSchema = record(properties.per_page);
  const maximum = Math.min(PAGE_LIMIT, Number(sizeSchema.maximum ?? PAGE_LIMIT));
  const minimum = Number(sizeSchema.minimum ?? 1);
  if (!Number.isFinite(maximum) || !Number.isFinite(minimum) || maximum < minimum || maximum < 1)
    throw new CompanyImportWorkerError("unsupported_reader");
  const args: { page?: number; per_page: number } = {
    per_page: Math.max(minimum, Math.min(desiredPerPage, maximum)),
  };
  if (properties.page) {
    const schema = record(properties.page);
    const minimum = Number(schema.minimum ?? 1);
    const maximum = Number(schema.maximum ?? 1_000_000);
    if (
      !Number.isFinite(minimum) ||
      !Number.isFinite(maximum) ||
      maximum < minimum ||
      page < minimum
    )
      throw new CompanyImportWorkerError("source_pagination_unavailable");
    if (page > maximum) throw new CompanyImportWorkerError("source_pagination_unavailable");
    args.page = page;
  }
  return args;
}

function githubCursorArgs(tool: ConnectorTool, cursor: string | null) {
  const { required } = jsonSchema(tool);
  if (cursor !== null) return { after: cursor };
  if (required.includes("after")) return { after: null };
  return {};
}

export function createCompanyTrackerReader(reader: CompanyConnectionReader) {
  async function githubTools(source: CompanyImportSourceDescriptor, context: AdapterContext) {
    if (!sourceRouteIsValid(source) || sourceKind(source) !== "github")
      throw new CompanyImportWorkerError("unsupported_reader");
    const listed = await reader.listTools(source, context);
    const found = {} as Record<keyof typeof githubOperations, ConnectorTool>;
    for (const [key, spec] of Object.entries(githubOperations) as Array<
      [keyof typeof githubOperations, (typeof githubOperations)[keyof typeof githubOperations]]
    >) {
      const tool = listed.find(
        (candidate) => (candidate.route?.toolName ?? candidate.name) === spec.name,
      );
      found[key] = assertGitHubTool(tool, spec.name, [...spec.args]);
    }
    return found;
  }

  async function linearTools(
    source: CompanyImportSourceDescriptor,
    context: AdapterContext,
  ): Promise<LinearToolSet> {
    if (!sourceRouteIsValid(source) || sourceKind(source) !== "linear")
      throw new CompanyImportWorkerError("unsupported_reader");
    const listed = await reader.listTools(source, context);
    const tools = {} as Record<LinearToolName, ConnectorTool>;
    for (const name of linearToolNames) {
      const tool = listed.find((candidate) => candidate.name === name);
      if (tool?.route?.connectorId !== "mcp")
        throw new CompanyImportWorkerError("unsupported_reader");
      tools[name] = tool;
    }
    const pageArgs = {
      list_users: linearPageArgs(tools.list_users),
      list_teams: linearPageArgs(tools.list_teams),
      list_projects: linearPageArgs(tools.list_projects),
      list_issues: linearPageArgs(tools.list_issues),
    };
    const projectArg = inputArg(
      tools.get_project,
      ["projectId", "project_id", "id", "query"],
      true,
    );
    const issueArg = inputArg(tools.get_issue, ["issueId", "issue_id", "id"], true);
    const milestoneArgs = linearMilestoneArgs(tools.list_milestones);
    if (
      jsonSchema(tools.get_project).required.some((name) => name !== projectArg) ||
      jsonSchema(tools.get_issue).required.some((name) => name !== issueArg)
    )
      throw new CompanyImportWorkerError("unsupported_reader");
    return { tools, pageArgs, milestoneArgs, projectArg, issueArg };
  }

  async function call(
    source: CompanyImportSourceDescriptor,
    tool: ConnectorTool,
    args: Record<string, unknown>,
    context: AdapterContext,
  ) {
    try {
      return decode(await reader.callTool(source, tool.name, args, context));
    } catch (error) {
      if (error instanceof CompanyImportWorkerError) throw error;
      const details = recordMaybe(error);
      const errorText = String(details?.message ?? error).toLowerCase();
      const status = Number(details?.status ?? details?.statusCode ?? details?.status_code);
      if (status === 429 || /rate.?limit|too_many_requests|\b429\b/.test(errorText))
        throw new CompanyImportWorkerError(
          "source_rate_limited",
          details ? rateLimitDelay(details) : COOLDOWN_MS,
        );
      throw error;
    }
  }

  async function supports(source: CompanyImportSourceDescriptor, context: AdapterContext) {
    if (!isCompanyTrackerSource(source) || !sourceRouteIsValid(source)) return false;
    if (sourceKind(source) === "github") await githubTools(source, context);
    else await linearTools(source, context);
    return true;
  }

  async function discover(
    source: CompanyImportSourceDescriptor,
    rawCursor: unknown,
    maxUnits: number,
    context: AdapterContext,
  ) {
    const scope = CompanyTrackerScopeSchema.parse(source.scope);
    const kind = sourceKind(source);
    if (
      !isCompanyTrackerSource(source) ||
      !kind ||
      !sourceRouteIsValid(source) ||
      (kind === "github" && scope.reader === "linear") ||
      (kind === "linear" && scope.reader !== "linear")
    )
      throw new CompanyImportWorkerError("unsupported_reader");
    const limit = Math.max(1, Math.min(PAGE_LIMIT, Math.floor(maxUnits)));
    if (kind === "github") {
      const state = githubDiscoveryCursor.parse(rawCursor ?? {});
      const tools = await githubTools(source, context);
      if (state.phase === "organizations") {
        const args = githubPageArgs(tools.organizations, state.page, limit);
        const result = await call(source, tools.organizations, args, context);
        const list = rows(result, ["organizations", "orgs", "items"], args.per_page).map((item) =>
          githubOrganization.parse(item),
        );
        const hasNext = githubHasNext(result, list.length, args.per_page, state.page);
        return {
          units: list.map((org) => ({
            unitKey: `github:organization:${idString(org.id)}`,
            cursor: { kind: "organization", id: org.id, org: org.login, phase: "members", page: 1 },
          })),
          nextCursor: hasNext
            ? { phase: "organizations", page: state.page + 1 }
            : { phase: "repositories", page: 1 },
          done: false,
          cooldownMs: COOLDOWN_MS,
        };
      }
      const result = await call(
        source,
        tools.repositories,
        {
          ...githubPageArgs(tools.repositories, state.page, limit),
          sort: "full_name",
          direction: "asc",
          type: "all",
        },
        context,
      );
      const perPage = githubPageArgs(tools.repositories, state.page, limit).per_page;
      const list = rows(result, ["repositories", "repos", "items"], perPage).map((item) =>
        githubRepository.parse(item),
      );
      const hasNext = githubHasNext(result, list.length, perPage, state.page);
      return {
        units: list.map((repo) => ({
          unitKey: `github:repository:${idString(repo.id)}`,
          cursor: {
            kind: "repository",
            id: repo.id,
            owner: repo.owner.login,
            repo: repo.name,
            phase: "metadata",
            page: 1,
          },
        })),
        nextCursor: hasNext ? { phase: "repositories", page: state.page + 1 } : null,
        done: !hasNext,
        cooldownMs: COOLDOWN_MS,
      };
    }
    const state = linearDiscoveryCursor.parse(rawCursor ?? {});
    if (state.phase === "done") return { units: [], nextCursor: null, done: true };
    const tools = await linearTools(source, context);
    const phaseTools = {
      users: tools.tools.list_users,
      teams: tools.tools.list_teams,
      projects: tools.tools.list_projects,
      issues: tools.tools.list_issues,
    } as const;
    const phase = state.phase;
    const tool = phaseTools[phase];
    const argsSpec = tools.pageArgs[`list_${phase}` as keyof typeof tools.pageArgs];
    const args: Record<string, unknown> = { [argsSpec.size]: 1 };
    if (argsSpec.cursor) {
      const { required } = jsonSchema(tool);
      if (state.token !== undefined && state.token !== null) args[argsSpec.cursor] = state.token;
      else if (required.includes(argsSpec.cursor)) args[argsSpec.cursor] = null;
    }
    const result = await call(source, tool, args, context);
    const list = rows(result, [phase, "items", "nodes", "results"], 1);
    const nextToken = linearNext(result, state.token ?? null, list.length, 1);
    const ids = list.map((item) => {
      const row = record(item);
      const id = opaqueId.parse(row.id);
      return { id, token: state.token ?? null };
    });
    const nextPhase = nextToken
      ? phase
      : ({ users: "teams", teams: "projects", projects: "issues", issues: "done" } as const)[phase];
    return {
      units: ids.map(({ id, token }) => ({
        unitKey: `linear:${phase.slice(0, -1)}:${id}`,
        cursor: {
          kind: phase === "users" ? "user" : phase === "teams" ? "team" : phase.slice(0, -1),
          id,
          ...(phase === "users" || phase === "teams" ? { token } : {}),
        },
      })),
      nextCursor: nextPhase === "done" ? null : { phase: nextPhase, token: nextToken },
      done: nextPhase === "done",
      cooldownMs: COOLDOWN_MS,
    };
  }

  async function readGitHub(
    source: CompanyImportSourceDescriptor,
    rawCursor: unknown,
    context: AdapterContext,
  ) {
    const state = githubUnitCursor.parse(rawCursor);
    const tools = await githubTools(source, context);
    if (state.kind === "organization") {
      if (state.phase === "members") {
        const result = await call(
          source,
          tools.members,
          { org: state.org, ...githubPageArgs(tools.members, state.page, 1) },
          context,
        );
        const list = rows(result, ["members", "users", "items"], 1);
        const hasNext = githubHasNext(result, list.length, 1, state.page);
        if (!list.length)
          return {
            document: null,
            nextCursor: hasNext
              ? { ...state, page: state.page + 1 }
              : { ...state, phase: "projects", after: null },
            done: false,
            cooldownMs: COOLDOWN_MS,
          };
        const member = githubMember.parse(list[0]);
        const profile = githubUser.parse(
          responseItem(await call(source, tools.user, { username: member.login }, context), [
            "user",
          ]),
        );
        if (
          profile.login.toLowerCase() !== member.login.toLowerCase() ||
          String(profile.id) !== String(member.id)
        )
          throw new CompanyImportWorkerError("invalid_source_response");
        const nextCursor = hasNext
          ? { ...state, page: state.page + 1 }
          : { ...state, phase: "projects" as const, after: null };
        const document = linesDocument(
          `github:organization-member:${idString(state.id)}:${idString(member.id)}`,
          `GitHub organization member ${member.login}`,
          [
            `Organization: ${state.org} (${state.id})`,
            `Member ID: ${member.id}`,
            `Login: ${profile.login}`,
            profile.name ? `Name: ${profile.name}` : "",
          ],
          profile.html_url,
        );
        return { document, nextCursor, done: false, cooldownMs: COOLDOWN_MS };
      }
      const result = await call(
        source,
        tools.projects,
        {
          org: state.org,
          ...githubCursorArgs(tools.projects, state.after ?? null),
          ...githubPageArgs(tools.projects, 1, 1),
        },
        context,
      );
      const list = githubProjectRows(result, 1);
      const page = listMetadata(result);
      if (page.hasNext === true && !page.next)
        throw new CompanyImportWorkerError("source_pagination_unavailable");
      if (page.next && page.next === state.after)
        throw new CompanyImportWorkerError("source_cursor_stalled");
      if (page.hasNext === true && !list.length)
        throw new CompanyImportWorkerError("source_cursor_stalled");
      if (list.length && page.hasNext === undefined && !page.next)
        throw new CompanyImportWorkerError("source_pagination_unavailable");
      const project = list.length ? githubProject.parse(list[0]) : null;
      const projectUrl = project ? safeUrl(project.url ?? project.html_url) : null;
      return {
        document: project
          ? linesDocument(
              `github:project:${project.id}`,
              `GitHub project ${project.title}`,
              [
                `Organization: ${state.org} (${state.id})`,
                `Project ID: ${project.id}`,
                `Name: ${project.title}`,
                project.startDate ? `Start date: ${project.startDate}` : "",
                project.targetDate ? `Target date: ${project.targetDate}` : "",
                projectUrl ? `Tracker URL: ${projectUrl}` : "",
              ],
              projectUrl,
            )
          : null,
        nextCursor: page.next
          ? { ...state, after: page.next }
          : page.hasNext === false || !list.length
            ? null
            : { ...state, after: null },
        done: !page.next && (page.hasNext === false || !list.length),
        cooldownMs: COOLDOWN_MS,
      };
    }
    if (state.phase === "metadata") {
      const result = await call(
        source,
        tools.repository,
        { owner: state.owner, repo: state.repo },
        context,
      );
      const repository = githubRepositoryDetails.parse(responseItem(result, ["repository"]));
      if (
        String(repository.id) !== String(state.id) ||
        repository.owner.login.toLowerCase() !== state.owner.toLowerCase() ||
        repository.name.toLowerCase() !== state.repo.toLowerCase()
      )
        throw new CompanyImportWorkerError("invalid_source_response");
      return {
        document: linesDocument(
          `github:repository:${idString(repository.id)}`,
          `GitHub repository ${repository.full_name ?? `${state.owner}/${state.repo}`}`,
          [
            `Repository ID: ${repository.id}`,
            `Owner: ${repository.owner.login}`,
            `Name: ${repository.name}`,
          ],
          repository.html_url,
        ),
        nextCursor: { ...state, phase: "milestones", page: 1 },
        done: false,
        cooldownMs: COOLDOWN_MS,
      };
    }
    if (state.phase === "milestones") {
      const result = await call(
        source,
        tools.milestones,
        {
          owner: state.owner,
          repo: state.repo,
          ...githubPageArgs(tools.milestones, state.page, 1),
          state: "all",
        },
        context,
      );
      const list = rows(result, ["milestones", "items"], 1);
      const hasNext = githubHasNext(result, list.length, 1, state.page);
      if (!list.length)
        return hasNext
          ? {
              document: null,
              nextCursor: { ...state, page: state.page + 1 },
              done: false,
              cooldownMs: COOLDOWN_MS,
            }
          : {
              document: null,
              nextCursor: { ...state, phase: "issues", page: 1 },
              done: false,
              cooldownMs: COOLDOWN_MS,
            };
      const milestone = githubMilestone.parse(list[0]);
      return {
        document: linesDocument(
          `github:milestone:${idString(milestone.id)}`,
          `GitHub milestone ${milestone.title}`,
          [
            `Repository: ${state.owner}/${state.repo}`,
            `Milestone ID: ${milestone.id}`,
            `Title: ${milestone.title}`,
            milestone.description ? `Description: ${milestone.description}` : "",
            milestone.due_on ? `Due date: ${milestone.due_on}` : "",
            milestone.creator?.login ? `Creator login: ${milestone.creator.login}` : "",
            milestone.creator?.id ? `Creator ID: ${milestone.creator.id}` : "",
          ],
          milestone.html_url,
        ),
        nextCursor: hasNext
          ? { ...state, page: state.page + 1 }
          : { ...state, phase: "issues", page: 1 },
        done: false,
        cooldownMs: COOLDOWN_MS,
      };
    }
    const result = await call(
      source,
      tools.issues,
      {
        owner: state.owner,
        repo: state.repo,
        ...githubPageArgs(tools.issues, state.page, 1),
        state: "all",
        sort: "created",
        direction: "asc",
      },
      context,
    );
    const list = rows(result, ["issues", "items"], 1);
    const hasNext = githubHasNext(result, list.length, 1, state.page);
    if (!list.length)
      return { document: null, nextCursor: null, done: true, cooldownMs: COOLDOWN_MS };
    const issue = githubIssue.parse(list[0]);
    return {
      document:
        issue.pull_request === undefined
          ? linesDocument(
              `github:issue:${idString(issue.id)}`,
              `GitHub issue ${issue.title}`,
              [
                `Repository: ${state.owner}/${state.repo}`,
                `Issue ID: ${issue.id}`,
                issue.number ? `Issue number: ${issue.number}` : "",
                `Title: ${issue.title}`,
                issue.body ? `Body: ${issue.body}` : "",
                issue.user?.login ? `Creator login: ${issue.user.login}` : "",
                issue.user?.id ? `Creator ID: ${issue.user.id}` : "",
                ...(issue.assignees ?? []).flatMap((assignee) => [
                  assignee.login ? `Assignee login: ${assignee.login}` : "",
                  assignee.id ? `Assignee ID: ${assignee.id}` : "",
                ]),
                issue.created_at ? `Created at: ${issue.created_at}` : "",
                issue.updated_at ? `Updated at: ${issue.updated_at}` : "",
                issue.closed_at ? `Closed at: ${issue.closed_at}` : "",
              ],
              issue.html_url,
            )
          : null,
      nextCursor: hasNext ? { ...state, page: state.page + 1 } : null,
      done: !hasNext,
      cooldownMs: COOLDOWN_MS,
    };
  }

  async function readLinear(
    source: CompanyImportSourceDescriptor,
    rawCursor: unknown,
    context: AdapterContext,
  ) {
    const state = linearUnitCursor.parse(rawCursor);
    const set = await linearTools(source, context);
    const listTool = (name: "list_users" | "list_teams" | "list_milestones") => set.tools[name];
    if (state.kind === "user" || state.kind === "team") {
      const phase = state.kind === "user" ? "list_users" : "list_teams";
      const tool = set.tools[phase];
      const pageArgs = set.pageArgs[phase];
      const args: Record<string, unknown> = { [pageArgs.size]: 1 };
      if (pageArgs.cursor) {
        const required = jsonSchema(tool).required;
        if (state.token !== undefined && state.token !== null) args[pageArgs.cursor] = state.token;
        else if (required.includes(pageArgs.cursor)) args[pageArgs.cursor] = null;
      }
      const result = await call(source, tool, args, context);
      const list = rows(result, [state.kind === "user" ? "users" : "teams", "items", "nodes"], 1);
      const row = list.length ? record(list[0]) : null;
      if (!row || opaqueId.parse(row.id) !== state.id)
        throw new CompanyImportWorkerError("source_cursor_stalled");
      if (state.kind === "user") {
        const user = linearUser.parse(row);
        return {
          document: linesDocument(
            `linear:user:${user.id}`,
            `Linear user ${user.name ?? user.displayName ?? user.id}`,
            [
              `User ID: ${user.id}`,
              `Name: ${user.name ?? user.displayName ?? ""}`,
              user.email ? `Work email: ${user.email}` : "",
            ],
            null,
          ),
          nextCursor: null,
          done: true,
          cooldownMs: COOLDOWN_MS,
        };
      }
      const team = linearTeam.parse(row);
      return {
        document: linesDocument(
          `linear:team:${team.id}`,
          `Linear team ${team.name}`,
          [`Team ID: ${team.id}`, `Name: ${team.name}`],
          null,
        ),
        nextCursor: null,
        done: true,
        cooldownMs: COOLDOWN_MS,
      };
    }
    if (state.kind === "issue") {
      const result = await call(source, set.tools.get_issue, { [set.issueArg]: state.id }, context);
      const issue = linearIssue.parse(responseItem(result, ["issue"]));
      if (issue.id !== state.id) throw new CompanyImportWorkerError("invalid_source_response");
      return {
        document: linesDocument(
          `linear:issue:${issue.id}`,
          `Linear issue ${issue.title}`,
          [
            `Issue ID: ${issue.id}`,
            `Title: ${issue.title}`,
            issue.description ? `Description: ${issue.description}` : "",
            issue.creator?.id ? `Creator ID: ${issue.creator.id}` : "",
            issue.creator?.name ? `Creator name: ${issue.creator.name}` : "",
            issue.assignee?.id ? `Assignee ID: ${issue.assignee.id}` : "",
            issue.assignee?.name ? `Assignee name: ${issue.assignee.name}` : "",
            issue.createdAt ? `Created at: ${issue.createdAt}` : "",
            issue.updatedAt ? `Updated at: ${issue.updatedAt}` : "",
            issue.dueDate ? `Due date: ${issue.dueDate}` : "",
          ],
          issue.url,
        ),
        nextCursor: null,
        done: true,
        cooldownMs: COOLDOWN_MS,
      };
    }

    if (state.kind !== "project") throw new CompanyImportWorkerError("invalid_source_response");
    if (state.phase === "project") {
      const result = await call(
        source,
        set.tools.get_project,
        { [set.projectArg]: state.id },
        context,
      );
      const project = linearProject.parse(responseItem(result, ["project"]));
      if (project.id !== state.id) throw new CompanyImportWorkerError("invalid_source_response");
      return {
        document: linesDocument(
          `linear:project:${project.id}`,
          `Linear project ${project.name}`,
          [
            `Project ID: ${project.id}`,
            `Name: ${project.name}`,
            project.startDate ? `Start date: ${project.startDate}` : "",
            project.targetDate ? `Target date: ${project.targetDate}` : "",
            safeUrl(project.url) ? `Tracker URL: ${safeUrl(project.url)}` : "",
          ],
          safeUrl(project.url),
        ),
        nextCursor: { ...state, phase: "milestones", token: null, offset: 0 },
        done: false,
        cooldownMs: COOLDOWN_MS,
      };
    }
    const milestonePlan = set.milestoneArgs;
    const tool = listTool("list_milestones");
    const args: Record<string, unknown> = { [milestonePlan.project]: state.id };
    const maxSize = milestonePlan.size
      ? Number(record(jsonSchema(tool).properties[milestonePlan.size]).maximum ?? PAGE_LIMIT)
      : PAGE_LIMIT;
    if (!Number.isFinite(maxSize) || maxSize < 1)
      throw new CompanyImportWorkerError("unsupported_reader");
    const limit = milestonePlan.cursor ? 1 : Math.min(PAGE_LIMIT, maxSize);
    if (milestonePlan.size) args[milestonePlan.size] = limit;
    if (milestonePlan.cursor) {
      const required = jsonSchema(tool).required;
      if (state.token !== undefined && state.token !== null)
        args[milestonePlan.cursor] = state.token;
      else if (required.includes(milestonePlan.cursor)) args[milestonePlan.cursor] = null;
    }
    const result = await call(source, tool, args, context);
    const list = rows(result, ["milestones", "items", "nodes"], limit);
    if (milestonePlan.cursor) {
      const next = linearNext(result, state.token ?? null, list.length, limit);
      if (!list.length)
        return { document: null, nextCursor: null, done: true, cooldownMs: COOLDOWN_MS };
      const milestone = linearMilestone.parse(list[0]);
      const title = milestone.title ?? milestone.name;
      if (!title) throw new CompanyImportWorkerError("invalid_source_response");
      return {
        document: linesDocument(
          `linear:milestone:${milestone.id}`,
          `Linear milestone ${title}`,
          [
            `Project ID: ${state.id}`,
            `Milestone ID: ${milestone.id}`,
            `Title: ${title}`,
            milestone.description ? `Description: ${milestone.description}` : "",
            milestone.dueDate ? `Due date: ${milestone.dueDate}` : "",
            milestone.targetDate ? `Target date: ${milestone.targetDate}` : "",
          ],
          milestone.url,
        ),
        nextCursor: next ? { ...state, token: next } : null,
        done: !next,
        cooldownMs: COOLDOWN_MS,
      };
    }
    const milestoneIds = list.map((row) => opaqueId.parse(record(row).id));
    if (milestoneIds.length === limit && listMetadata(result).hasNext !== false)
      throw new CompanyImportWorkerError("source_pagination_unavailable");
    const expected = state.milestoneIds?.[0];
    if (expected && milestoneIds[state.offset ?? 0] !== expected)
      throw new CompanyImportWorkerError("source_cursor_stalled");
    const offset = state.offset ?? 0;
    if (offset >= milestoneIds.length)
      return { document: null, nextCursor: null, done: true, cooldownMs: COOLDOWN_MS };
    const milestone = linearMilestone.parse(list[offset]);
    const title = milestone.title ?? milestone.name;
    if (!title) throw new CompanyImportWorkerError("invalid_source_response");
    const hasNext = listMetadata(result).hasNext;
    if (hasNext === true && !milestonePlan.cursor)
      throw new CompanyImportWorkerError("source_pagination_unavailable");
    const nextCursor =
      offset + 1 < milestoneIds.length
        ? { ...state, offset: offset + 1, milestoneIds: [milestoneIds[offset + 1]!] }
        : null;
    return {
      document: linesDocument(
        `linear:milestone:${milestone.id}`,
        `Linear milestone ${title}`,
        [
          `Project ID: ${state.id}`,
          `Milestone ID: ${milestone.id}`,
          `Title: ${title}`,
          milestone.description ? `Description: ${milestone.description}` : "",
          milestone.dueDate ? `Due date: ${milestone.dueDate}` : "",
          milestone.targetDate ? `Target date: ${milestone.targetDate}` : "",
        ],
        milestone.url,
      ),
      nextCursor,
      done: nextCursor === null,
      cooldownMs: COOLDOWN_MS,
    };
  }

  return {
    supports,
    async discover(
      source: CompanyImportSourceDescriptor,
      cursor: unknown,
      maxUnits: number,
      context: AdapterContext,
    ) {
      return discover(source, cursor, maxUnits, context);
    },
    async read(source: CompanyImportSourceDescriptor, cursor: unknown, context: AdapterContext) {
      const kind = sourceKind(source);
      if (!isCompanyTrackerSource(source) || !kind || !sourceRouteIsValid(source))
        throw new CompanyImportWorkerError("unsupported_reader");
      const result =
        kind === "github"
          ? await readGitHub(source, cursor, context)
          : await readLinear(source, cursor, context);
      return { ...result, cooldownMs: result.cooldownMs ?? COOLDOWN_MS };
    },
  };
}

export type CompanyTrackerReader = ReturnType<typeof createCompanyTrackerReader>;
