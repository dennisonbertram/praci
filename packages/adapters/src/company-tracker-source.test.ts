import type {
  AdapterContext,
  CompanyConnectionReader,
  CompanyImportSourceDescriptor,
  ConnectorCall,
  ConnectorProvider,
  ConnectorTool,
} from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import { createCompanyConnectionReader } from "./company-connection-reader.js";
import { createCompanyTrackerReader } from "./company-tracker-source.js";

const githubSource: CompanyImportSourceDescriptor = {
  id: "github-source",
  sourceKind: "github",
  connectionId: "github-connection",
  scope: { reader: "github", allTime: true },
};
const linearSource: CompanyImportSourceDescriptor = {
  id: "linear-source",
  sourceKind: "mcp",
  connectionId: null,
  mcpServerId: "linear-server",
  scope: { reader: "linear", allTime: true },
};
const context: AdapterContext = {
  spaceId: "space",
  userId: "owner",
  operationId: "operation",
  traceId: "trace",
  signal: new AbortController().signal,
};

const githubDefinitions: Record<string, string[]> = {
  GITHUB_LIST_ORGANIZATIONS_FOR_THE_AUTHENTICATED_USER: ["page", "per_page"],
  GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER: [
    "page",
    "per_page",
    "sort",
    "direction",
    "type",
  ],
  GITHUB_LIST_ORGANIZATION_MEMBERS: ["org", "page", "per_page"],
  GITHUB_GET_A_USER: ["username"],
  GITHUB_GET_A_REPOSITORY: ["owner", "repo"],
  GITHUB_LIST_MILESTONES: ["owner", "repo", "page", "per_page", "state"],
  GITHUB_LIST_REPOSITORY_ISSUES: [
    "owner",
    "repo",
    "page",
    "per_page",
    "state",
    "sort",
    "direction",
  ],
  GITHUB_LIST_ORGANIZATION_PROJECTS: ["org", "after", "per_page"],
};
const githubRequiredArguments: Record<string, string[]> = {
  GITHUB_LIST_ORGANIZATION_MEMBERS: ["org"],
  GITHUB_GET_A_USER: ["username"],
  GITHUB_GET_A_REPOSITORY: ["owner", "repo"],
  GITHUB_LIST_MILESTONES: ["owner", "repo"],
  GITHUB_LIST_REPOSITORY_ISSUES: ["owner", "repo"],
  GITHUB_LIST_ORGANIZATION_PROJECTS: ["org"],
};

function githubTools(): ConnectorTool[] {
  return Object.entries(githubDefinitions).map(([name, args]) => {
    const properties = Object.fromEntries(
      args.map((key) => [
        key,
        key === "per_page"
          ? { type: "integer", minimum: 1 }
          : key === "page"
            ? { type: "integer", minimum: 1 }
            : key === "after"
              ? { type: "string" }
              : key === "state"
                ? { type: "string", enum: ["all"] }
                : key === "sort"
                  ? {
                      type: "string",
                      enum: [name.includes("REPOSITORIES") ? "full_name" : "created"],
                    }
                  : key === "direction"
                    ? { type: "string", enum: ["asc"] }
                    : key === "type"
                      ? { type: "string", enum: ["all"] }
                      : { type: "string" },
      ]),
    );
    return {
      name,
      description: name,
      readOnly: true,
      inputSchema: {
        type: "object",
        properties,
        required: githubRequiredArguments[name] ?? [],
        additionalProperties: false,
      },
      route: { connectorId: "composio", toolName: name },
    };
  });
}

function updateToolSchema(
  tool: ConnectorTool,
  changes: { properties?: Record<string, unknown>; required?: string[] },
): ConnectorTool {
  const schema = tool.inputSchema as {
    properties: Record<string, unknown>;
    [key: string]: unknown;
  };
  return {
    ...tool,
    inputSchema: {
      ...schema,
      ...changes,
      ...(changes.properties
        ? { properties: { ...schema.properties, ...changes.properties } }
        : {}),
    },
  };
}

const linearDefinitions: Record<string, string[]> = {
  list_users: ["limit", "cursor"],
  list_teams: ["limit", "cursor"],
  list_projects: ["limit", "cursor"],
  get_project: ["query"],
  list_issues: ["limit", "cursor"],
  get_issue: ["id"],
  list_milestones: ["project", "limit", "cursor"],
};
const linearRequiredArguments: Record<string, string[]> = {
  get_project: ["query"],
  get_issue: ["id"],
  list_milestones: ["project"],
};

function linearTools(): ConnectorTool[] {
  return Object.entries(linearDefinitions).map(([name, args]) => ({
    name,
    description: name === "list_milestones" ? "List all milestones in a Linear project." : name,
    readOnly: true,
    inputSchema: {
      type: "object",
      properties: Object.fromEntries(
        args.map((key) => [
          key,
          key === "limit"
            ? { type: "integer", minimum: 1, maximum: 100 }
            : key === "cursor"
              ? { type: ["string", "null"] }
              : { type: "string" },
        ]),
      ),
      required: linearRequiredArguments[name] ?? args,
      additionalProperties: false,
    },
    route: { connectorId: "mcp", toolName: name },
  }));
}

function harness(
  respond: (name: string, args: Record<string, unknown>) => unknown,
  options: { linear?: boolean; tools?: ConnectorTool[] } = {},
) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const listTools = vi.fn(
    async () => options.tools ?? (options.linear ? linearTools() : githubTools()),
  );
  const callTool = vi.fn(
    async (_source: CompanyImportSourceDescriptor, name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return respond(name, args);
    },
  );
  const reader: CompanyConnectionReader = { listTools, callTool };
  return { tracker: createCompanyTrackerReader(reader), calls, listTools, callTool };
}

describe("Company tracker reader", () => {
  it("checks fresh read capabilities without fetching source content and fails closed on mismatch", async () => {
    const state = harness(() => {
      throw new Error("source reads must not run during supports");
    });
    await expect(state.tracker.supports(githubSource, context)).resolves.toBe(true);
    expect(state.calls).toHaveLength(0);

    const missing = harness(
      () => {
        throw new Error("missing tools must not run");
      },
      { tools: githubTools().filter((tool) => tool.name !== "GITHUB_LIST_ORGANIZATION_PROJECTS") },
    );
    await expect(missing.tracker.supports(githubSource, context)).rejects.toMatchObject({
      code: "unsupported_reader",
    });
    await expect(
      state.tracker.supports(
        { ...githubSource, scope: { reader: "linear", allTime: true } },
        context,
      ),
    ).resolves.toBe(false);
    expect(state.calls).toHaveLength(0);
  });

  it("rejects Linear milestone offset pagination without a supported cursor contract", async () => {
    const tools = linearTools().map((tool) =>
      tool.name === "list_milestones"
        ? {
            ...tool,
            inputSchema: {
              type: "object",
              properties: {
                project: { type: "string" },
                offset: { type: "integer", minimum: 0 },
              },
              required: ["project"],
              additionalProperties: false,
            },
          }
        : tool,
    );
    const state = harness(() => null, { linear: true, tools });
    await expect(state.tracker.supports(linearSource, context)).rejects.toMatchObject({
      code: "unsupported_reader",
    });
  });

  it("accepts optional documented GitHub inputs and rejects undeclared required inputs", async () => {
    const state = harness(() => null);
    await expect(state.tracker.supports(githubSource, context)).resolves.toBe(true);

    const fallback = harness(() => ({ organizations: [], has_next: false }));
    await fallback.tracker.discover(githubSource, null, 100, context);
    expect(fallback.calls[0]?.args.per_page).toBe(100);

    const stricterTools = githubTools().map((tool) =>
      tool.name === "GITHUB_LIST_ORGANIZATIONS_FOR_THE_AUTHENTICATED_USER"
        ? updateToolSchema(tool, {
            properties: {
              per_page: { type: "integer", minimum: 1, maximum: 40 },
            },
          })
        : tool,
    );
    const stricter = harness(() => ({ organizations: [], has_next: false }), {
      tools: stricterTools,
    });
    await stricter.tracker.discover(githubSource, null, 100, context);
    expect(stricter.calls[0]?.args.per_page).toBe(40);

    const unsafeTools = githubTools().map((tool) =>
      tool.name === "GITHUB_LIST_ORGANIZATIONS_FOR_THE_AUTHENTICATED_USER"
        ? updateToolSchema(tool, { required: ["unrecognized"] })
        : tool,
    );
    const unsafe = harness(() => null, { tools: unsafeTools });
    await expect(unsafe.tracker.supports(githubSource, context)).rejects.toMatchObject({
      code: "unsupported_reader",
    });

    const requiredNonNullableAfter = githubTools().map((tool) =>
      tool.name === "GITHUB_LIST_ORGANIZATION_PROJECTS"
        ? updateToolSchema(tool, { required: ["org", "after"] })
        : tool,
    );
    const invalidCursor = harness(() => null, { tools: requiredNonNullableAfter });
    await expect(invalidCursor.tracker.supports(githubSource, context)).rejects.toMatchObject({
      code: "unsupported_reader",
    });
  });

  it("passes a null ProjectsV2 cursor only when the schema requires a nullable cursor", async () => {
    const tools = githubTools().map((tool) =>
      tool.name === "GITHUB_LIST_ORGANIZATION_PROJECTS"
        ? updateToolSchema(tool, {
            properties: { after: { type: ["string", "null"] } },
            required: ["org", "after"],
          })
        : tool,
    );
    const state = harness(
      () => ({
        organization: { projectsV2: { nodes: [], pageInfo: { hasNextPage: false } } },
      }),
      { tools },
    );
    const result = await state.tracker.read(
      githubSource,
      { kind: "organization", id: 11, org: "northwind", phase: "projects", after: null },
      context,
    );
    expect(result.done).toBe(true);
    expect(state.calls[0]?.args).toEqual({ org: "northwind", after: null, per_page: 1 });
    expect(state.calls[0]?.args).not.toHaveProperty("page");
  });

  it("decodes Composio envelopes and native arrays through the authorized connection reader", async () => {
    const calls: ConnectorCall[] = [];
    const connection = {
      id: githubSource.connectionId,
      connectorId: "composio",
      provider: "github",
      providerRef: "synthetic-account",
      displayName: "Synthetic GitHub",
      allAgents: true,
      privateByDefault: false,
      status: "connected",
    };
    const prisma = {
      spaceMember: { findUnique: vi.fn(async () => ({ userId: context.userId })) },
      companySourceBlock: { findMany: vi.fn(async () => []) },
      connection: { findFirst: vi.fn(async () => connection) },
    } as unknown as PrismaClient;
    const connectors = {
      discoverTools: vi.fn(async () => githubTools()),
      execute: vi.fn(async function* (call: ConnectorCall) {
        calls.push(call);
        const denied = await call.beforeDispatch?.();
        if (denied) {
          yield { type: "error" as const, message: denied };
          return;
        }
        const organizationPage = Number(call.args.page);
        const data =
          call.tool === "GITHUB_LIST_ORGANIZATIONS_FOR_THE_AUTHENTICATED_USER" &&
          organizationPage === 1
            ? JSON.stringify([{ id: 11, login: "northwind" }])
            : JSON.stringify(
                call.tool === "GITHUB_LIST_ORGANIZATIONS_FOR_THE_AUTHENTICATED_USER" &&
                  organizationPage === 2
                  ? [{ id: 12, login: "fabrikam" }]
                  : [],
              );
        yield {
          type: "result" as const,
          data: {
            successful: true,
            data,
            error: organizationPage === 2 ? "" : null,
            ...(organizationPage === 2 ? { has_next: false } : {}),
          },
        };
      }),
    } as unknown as ConnectorProvider;
    const reader = createCompanyConnectionReader({
      prisma,
      connectors,
      mcp: {} as never,
    });
    const tracker = createCompanyTrackerReader(reader);

    const first = await tracker.discover(githubSource, null, 1, context);
    expect(first.units.map((unit) => unit.unitKey)).toEqual(["github:organization:11"]);
    expect(first.nextCursor).toEqual({ phase: "organizations", page: 2 });
    const second = await tracker.discover(githubSource, first.nextCursor, 1, context);
    expect(second.units.map((unit) => unit.unitKey)).toEqual(["github:organization:12"]);
    expect(second.nextCursor).toEqual({ phase: "repositories", page: 1 });
    const third = await tracker.discover(githubSource, second.nextCursor, 1, context);
    expect(third.done).toBe(true);

    const organizationCalls = calls.filter(
      (call) => call.tool === "GITHUB_LIST_ORGANIZATIONS_FOR_THE_AUTHENTICATED_USER",
    );
    expect(organizationCalls.map((call) => call.args)).toEqual([
      { page: 1, per_page: 1 },
      { page: 2, per_page: 1 },
    ]);
    expect(calls.every((call) => call.route?.connectionId === githubSource.connectionId)).toBe(
      true,
    );
  });

  it("paginates GitHub discovery and ProjectsV2 while keeping cursors body-free", async () => {
    const state = harness((name, args) => {
      if (name === "GITHUB_LIST_ORGANIZATIONS_FOR_THE_AUTHENTICATED_USER") {
        return {
          successful: true,
          data: JSON.stringify({
            organizations:
              args.page === 1 ? [{ id: 11, login: "northwind" }] : [{ id: 12, login: "fabrikam" }],
            has_next: args.page === 1,
          }),
        };
      }
      if (name === "GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER") {
        return {
          data: {
            repositories:
              args.page === 1 ? [{ id: 21, name: "launch", owner: { login: "northwind" } }] : [],
            has_more: args.page === 1,
          },
        };
      }
      if (name === "GITHUB_LIST_ORGANIZATION_PROJECTS") {
        return {
          data: {
            organization: {
              projectsV2: {
                nodes: [
                  {
                    id: "PVT_kw_PROJECT_123",
                    title: "Orion",
                    url: "https://github.example.test/orgs/northwind/projects/3",
                    startDate: "2026-01-02",
                    targetDate: "2026-02-03",
                    description: "private source body",
                    createdAt: "must not become a start date",
                  },
                ],
                pageInfo:
                  args.after == null
                    ? { hasNextPage: true, endCursor: "opaque-page-token" }
                    : { hasNextPage: false, endCursor: null },
              },
            },
          },
        };
      }
      return null;
    });

    const first = await state.tracker.discover(githubSource, null, 1, context);
    expect(first.units.map((unit) => unit.unitKey)).toEqual(["github:organization:11"]);
    expect(first.nextCursor).toEqual({ phase: "organizations", page: 2 });
    expect(state.calls[0]).toMatchObject({
      name: "GITHUB_LIST_ORGANIZATIONS_FOR_THE_AUTHENTICATED_USER",
      args: { page: 1, per_page: 1 },
    });
    const second = await state.tracker.discover(githubSource, first.nextCursor, 1, context);
    expect(second.units.map((unit) => unit.unitKey)).toEqual(["github:organization:12"]);
    expect(second.nextCursor).toEqual({ phase: "repositories", page: 1 });
    const third = await state.tracker.discover(githubSource, second.nextCursor, 1, context);
    expect(third.units.map((unit) => unit.unitKey)).toEqual(["github:repository:21"]);
    expect(state.calls[2]).toMatchObject({
      name: "GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER",
      args: {
        page: 1,
        per_page: 1,
        sort: "full_name",
        direction: "asc",
        type: "all",
      },
    });
    const fourth = await state.tracker.discover(githubSource, third.nextCursor, 1, context);
    expect(fourth.units).toEqual([]);
    expect(fourth.done).toBe(true);

    const initialProject = await state.tracker.read(
      githubSource,
      { kind: "organization", id: 11, org: "northwind", phase: "projects", after: null },
      context,
    );
    expect(initialProject.document?.text).toContain("Start date: 2026-01-02");
    expect(initialProject.document?.text).toContain("Target date: 2026-02-03");
    expect(initialProject.document?.text).not.toContain("private source body");
    expect(initialProject.document?.text).not.toContain("must not become");
    expect(initialProject.nextCursor).toEqual({
      kind: "organization",
      id: 11,
      org: "northwind",
      phase: "projects",
      page: 1,
      after: "opaque-page-token",
    });
    expect(JSON.stringify(initialProject.nextCursor)).not.toContain("private source body");
    const nextProject = await state.tracker.read(githubSource, initialProject.nextCursor, context);
    expect(nextProject.done).toBe(true);
    expect(nextProject.document?.sourceUrl).toBe(
      "https://github.example.test/orgs/northwind/projects/3",
    );
    expect(state.calls.slice(-2).map((call) => call.args.after)).toEqual([
      undefined,
      "opaque-page-token",
    ]);
    expect(state.calls.slice(-2)[0]?.args).toEqual({ org: "northwind", per_page: 1 });
    expect(state.calls.slice(-2).every((call) => !("page" in call.args))).toBe(true);
  });

  it("hydrates GitHub members without personal profile fields and excludes pull requests", async () => {
    const state = harness((name, args) => {
      if (name === "GITHUB_LIST_ORGANIZATION_MEMBERS")
        return { members: [{ id: 31, login: "morgan" }], has_next: false };
      if (name === "GITHUB_GET_A_USER")
        return {
          user: {
            id: 31,
            login: args.username,
            name: "Morgan Vale",
            email: "personal@example.test",
            phone: "private phone",
            location: "private location",
            bio: "private bio",
            status: "private status",
            html_url: "https://github.example.test/morgan",
          },
        };
      if (name === "GITHUB_GET_A_REPOSITORY")
        return {
          repository: {
            id: 21,
            name: "launch",
            full_name: "northwind/launch",
            owner: { login: "northwind" },
            html_url: "https://github.example.test/northwind/launch",
          },
        };
      if (name === "GITHUB_LIST_MILESTONES")
        return {
          milestones: [
            {
              id: 41,
              title: "Milestone one",
              description: "milestone body",
              due_on: "2026-03-04",
              creator: { id: 31, login: "morgan" },
              html_url: "https://github.example.test/milestone/41",
            },
          ],
          has_next: false,
        };
      if (name === "GITHUB_LIST_REPOSITORY_ISSUES")
        return args.page === 1
          ? {
              issues: [{ id: 50, title: "PR-shaped record", pull_request: {} }],
              has_next: true,
            }
          : {
              issues: [
                {
                  id: 51,
                  number: 12,
                  title: "Issue title",
                  body: "Issue body",
                  user: { id: 31, login: "morgan" },
                  assignees: [{ id: 32, login: "casey" }],
                  created_at: "2026-01-01",
                  closed_at: "2026-01-03",
                  html_url: "https://github.example.test/issues/12",
                },
              ],
              has_next: false,
            };
      return null;
    });
    const member = await state.tracker.read(
      githubSource,
      { kind: "organization", id: 11, org: "northwind", phase: "members", page: 1 },
      context,
    );
    expect(member.document?.text).toContain("Name: Morgan Vale");
    for (const privateField of [
      "personal@example.test",
      "private phone",
      "private location",
      "private bio",
      "private status",
    ]) {
      expect(member.document?.text).not.toContain(privateField);
    }
    expect(state.calls[1]?.args).toEqual({ username: "morgan" });

    const metadata = await state.tracker.read(
      githubSource,
      { kind: "repository", id: 21, owner: "northwind", repo: "launch", phase: "metadata" },
      context,
    );
    expect(metadata.document?.sourceUrl).toBe("https://github.example.test/northwind/launch");
    const milestone = await state.tracker.read(githubSource, metadata.nextCursor, context);
    expect(milestone.document?.text).toContain("Due date: 2026-03-04");
    expect(milestone.document?.text).toContain("Creator login: morgan");
    const pr = await state.tracker.read(githubSource, milestone.nextCursor, context);
    expect(pr.document).toBeNull();
    expect(pr.done).toBe(false);
    expect(pr.nextCursor).toMatchObject({ phase: "issues", page: 2 });
    const issue = await state.tracker.read(githubSource, pr.nextCursor, context);
    expect(issue.document?.text).toContain("Issue body");
    expect(issue.document?.text).toContain("Assignee login: casey");
    expect(issue.document?.sourceUrl).toBe("https://github.example.test/issues/12");
    expect(state.calls.at(-2)).toMatchObject({
      name: "GITHUB_LIST_REPOSITORY_ISSUES",
      args: {
        owner: "northwind",
        repo: "launch",
        state: "all",
        sort: "created",
        direction: "asc",
      },
    });
    expect(
      state.calls.some((call) => /write|create|update|delete|query_or_mutation/i.test(call.name)),
    ).toBe(false);
  });

  it("discovers every Linear category, hydrates milestones, and resumes body-free cursors", async () => {
    const state = harness(
      (name, args) => {
        if (name === "list_users")
          return {
            structuredContent: {
              users: {
                nodes:
                  args.cursor === undefined || args.cursor === null
                    ? [{ id: "user-1", name: "Morgan Vale", email: "morgan@example.test" }]
                    : [],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          };
        if (name === "list_teams")
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  teams: [{ id: "team-1", name: "Platform" }],
                  pageInfo: { hasNextPage: false },
                }),
              },
            ],
          };
        if (name === "list_projects")
          return {
            projects: [{ id: "project-1" }],
            pageInfo: { hasNextPage: false },
          };
        if (name === "list_issues")
          return {
            issues: [{ id: "issue-1" }],
            pageInfo: { hasNextPage: false },
          };
        if (name === "list_milestones")
          return args.cursor === undefined || args.cursor === null
            ? {
                milestones: [
                  {
                    id: "milestone-1",
                    title: "Launch",
                    description: "milestone details",
                    dueDate: "2026-05-06",
                    targetDate: "2026-06",
                    url: "https://linear.example.test/milestone/1",
                    privateNested: "must not pass through",
                  },
                ],
                pageInfo: { hasNextPage: true, endCursor: "milestone-cursor" },
              }
            : {
                milestones: [],
                pageInfo: { hasNextPage: false, endCursor: null },
              };
        if (name === "get_project")
          return {
            project: {
              id: args.query,
              name: "Orion",
              url: "https://linear.example.test/project/orion",
              startDate: "2026-04-01",
              targetDate: "2026-06-01",
              createdAt: "must not be used as start date",
            },
          };
        if (name === "get_issue")
          return {
            issue: {
              id: args.id,
              title: "Issue title",
              description: "Issue body",
              creator: { id: "user-1", name: "Morgan Vale", phone: "private phone" },
              assignee: { id: "user-2", name: "Casey Example" },
              dueDate: "2026-07-08",
              phone: "must not pass through",
            },
          };
        return null;
      },
      { linear: true },
    );
    await expect(state.tracker.supports(linearSource, context)).resolves.toBe(true);
    const user = await state.tracker.discover(linearSource, null, 1, context);
    expect(user.units).toEqual([
      { unitKey: "linear:user:user-1", cursor: { kind: "user", id: "user-1", token: null } },
    ]);
    expect(user.nextCursor).toEqual({ phase: "teams", token: null });
    const team = await state.tracker.discover(linearSource, user.nextCursor, 1, context);
    expect(team.units[0]?.unitKey).toBe("linear:team:team-1");
    expect(team.nextCursor).toEqual({ phase: "projects", token: null });
    const project = await state.tracker.discover(linearSource, team.nextCursor, 1, context);
    expect(project.units[0]?.unitKey).toBe("linear:project:project-1");
    expect(project.nextCursor).toEqual({ phase: "issues", token: null });
    const issue = await state.tracker.discover(linearSource, project.nextCursor, 1, context);
    expect(issue.units[0]?.unitKey).toBe("linear:issue:issue-1");
    expect(issue.done).toBe(true);

    const userDocument = await state.tracker.read(
      linearSource,
      { kind: "user", id: "user-1", token: null },
      context,
    );
    expect(userDocument.document?.text).toContain("Work email: morgan@example.test");
    const projectDocument = await state.tracker.read(
      linearSource,
      { kind: "project", id: "project-1", phase: "project" },
      context,
    );
    expect(projectDocument.document?.text).toContain("Start date: 2026-04-01");
    expect(projectDocument.document?.text).toContain(
      "Tracker URL: https://linear.example.test/project/orion",
    );
    expect(projectDocument.document?.text).not.toContain("must not be used");
    expect(projectDocument.nextCursor).toMatchObject({ phase: "milestones", id: "project-1" });
    const milestone = await state.tracker.read(linearSource, projectDocument.nextCursor, context);
    expect(milestone.document?.text).toContain("Due date: 2026-05-06");
    expect(milestone.document?.text).toContain("Target date: 2026-06");
    expect(milestone.document?.text).not.toContain("privateNested");
    expect(milestone.nextCursor).toMatchObject({ token: "milestone-cursor" });
    expect(JSON.stringify(milestone.nextCursor)).not.toContain("milestone details");
    expect(state.calls.find((call) => call.name === "get_project")?.args).toEqual({
      query: "project-1",
    });
    const exhausted = await state.tracker.read(linearSource, milestone.nextCursor, context);
    expect(exhausted.done).toBe(true);
    const issueDocument = await state.tracker.read(
      linearSource,
      { kind: "issue", id: "issue-1" },
      context,
    );
    expect(issueDocument.document?.text).toContain("Issue body");
    expect(issueDocument.document?.text).not.toContain("private phone");
    expect(state.calls.some((call) => call.name === "LINEAR_RUN_QUERY_OR_MUTATION")).toBe(false);
    expect(state.calls.every((call) => linearDefinitions[call.name])).toBe(true);
  });

  it("rejects unsafe Linear capability gaps and maps bounded 429 delays", async () => {
    const unsafeTools = linearTools().filter((tool) => tool.name !== "list_milestones");
    unsafeTools.push({
      name: "LINEAR_RUN_QUERY_OR_MUTATION",
      description: "query or mutation",
      readOnly: false,
      inputSchema: { type: "object", properties: {}, required: [] },
      route: { connectorId: "mcp", toolName: "LINEAR_RUN_QUERY_OR_MUTATION" },
    });
    const unsupported = harness(() => null, { tools: unsafeTools });
    await expect(unsupported.tracker.supports(linearSource, context)).rejects.toMatchObject({
      code: "unsupported_reader",
    });
    expect(unsupported.calls).toHaveLength(0);

    const limited = harness(
      () => {
        throw Object.assign(new Error("provider rate limit"), {
          status: 429,
          headers: { "retry-after": "120" },
        });
      },
      { linear: true },
    );
    await expect(
      limited.tracker.read(linearSource, { kind: "user", id: "user-1" }, context),
    ).rejects.toMatchObject({ code: "source_rate_limited", retryAfterMs: 120_000 });
    expect(limited.calls).toHaveLength(1);
  });

  it("bounds source text and rejects malformed or stalled provider pages", async () => {
    const state = harness((name, _args) => {
      if (name === "GITHUB_GET_A_REPOSITORY")
        return {
          repository: {
            id: 21,
            name: "launch",
            owner: { login: "northwind" },
            html_url: "https://github.example.test/northwind/launch",
            body: "ignored",
          },
        };
      if (name === "GITHUB_LIST_REPOSITORY_ISSUES")
        return {
          issues: [{ id: 99, title: "x".repeat(1000), body: "y".repeat(200_000) }],
          has_next: false,
        };
      if (name === "GITHUB_LIST_ORGANIZATIONS_FOR_THE_AUTHENTICATED_USER")
        return {
          organizations: [{ id: 11, login: "northwind" }],
          has_next: true,
        };
      return null;
    });
    const issue = await state.tracker.read(
      githubSource,
      { kind: "repository", id: 21, owner: "northwind", repo: "launch", phase: "issues", page: 1 },
      context,
    );
    expect(issue.document?.truncated).toBe(true);
    expect(Buffer.byteLength(issue.document?.text ?? "")).toBeLessThanOrEqual(20_000);
    await expect(
      state.tracker.discover(githubSource, { phase: "organizations", page: 1 }, 1, context),
    ).resolves.toMatchObject({ nextCursor: { phase: "organizations", page: 2 } });
  });

  it("truncates multibyte project text, titles, and snippets on UTF-8 boundaries", async () => {
    const state = harness((name) =>
      name === "GITHUB_LIST_REPOSITORY_ISSUES"
        ? {
            issues: [
              {
                id: 99,
                title: "界".repeat(400),
                body: "界".repeat(7000),
                html_url: "https://github.example.test/issues/99",
              },
            ],
            has_next: false,
          }
        : null,
    );
    const issue = await state.tracker.read(
      githubSource,
      { kind: "repository", id: 21, owner: "northwind", repo: "launch", phase: "issues" },
      context,
    );
    const document = issue.document!;
    expect(Buffer.byteLength(document.text)).toBeLessThanOrEqual(20_000);
    expect(Buffer.byteLength(document.title)).toBeLessThanOrEqual(1024);
    expect(Buffer.byteLength(document.snippet)).toBeLessThanOrEqual(1200);
    expect(`${document.text}${document.title}${document.snippet}`).not.toContain("\uFFFD");
  });
});
