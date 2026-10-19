import type { AdapterContext, ManagedConnectorProvider } from "@rakazo/adapter-kit";
import { describe, expect, it } from "vitest";
import { DriveApiEmulator } from "./drive-api-emulator.js";
import {
  type DriveAccount,
  type DriveToolDeps,
  driveToolFromTool,
  driveToolsAllowed,
  listDriveAccounts,
} from "./drive-tools.js";
import { GoogleApiClient } from "./google-api-request.js";

const scope = { spaceId: "space-1", userId: "user-1" };
const context: AdapterContext = {
  operationId: "op",
  traceId: "trace",
  ...scope,
  botId: "bot-1",
  signal: new AbortController().signal,
} as AdapterContext;

const account = (ref: string, label: string, email: string | null = null): DriveAccount => ({
  id: `conn-${ref}`,
  connectorId: "google",
  app: "googledrive",
  accountRef: ref,
  label,
  email,
});

function setup(
  accounts = [account("acct-a", "Ann", "ann@example.test")],
  drive?: DriveApiEmulator,
) {
  const emulator = drive ?? new DriveApiEmulator();
  const connector = {
    proxy: async (r: {
      accountRef: string;
      url: string;
      method: string;
      body?: unknown;
      contentType?: string;
    }) => emulator.handle(r.accountRef, r.url, r.method, r.body, r.contentType),
  } as unknown as ManagedConnectorProvider;
  const deps: DriveToolDeps = {
    prisma: {} as never,
    connectors: { managed: () => connector },
    scope,
    accounts: async () => accounts,
    google: new GoogleApiClient({ sleep: async () => undefined, random: () => 0 }),
  };
  return {
    deps,
    emulator,
    run: (name: string, args: Record<string, unknown>) =>
      driveToolFromTool(name, deps, context, args),
  };
}

describe("listDriveAccounts", () => {
  it("returns only connected native Drive rows of that space and user", async () => {
    const where: unknown[] = [];
    const rows = [
      {
        id: "1",
        connectorId: "google",
        provider: "googledrive",
        providerRef: "r1",
        displayName: "Ann",
        metadata: { driveEmail: "ann@example.test" },
      },
      {
        id: "2",
        connectorId: "google",
        provider: "googledrive",
        providerRef: null,
        displayName: "No ref",
        metadata: null,
      },
    ];
    const prisma = {
      connection: {
        findMany: async (q: unknown) => {
          where.push(q);
          return rows;
        },
      },
    };
    const found = await listDriveAccounts(prisma as never, scope);
    expect(found).toEqual([
      {
        id: "1",
        connectorId: "google",
        app: "googledrive",
        accountRef: "r1",
        label: "Ann",
        email: "ann@example.test",
      },
    ]);
    expect(where[0]).toMatchObject({
      where: { ...scope, connectorId: "google", provider: "googledrive", status: "connected" },
    });
  });
});

describe("drive_search", () => {
  it("escapes quotes and backslashes and excludes trashed files", async () => {
    const s = setup();
    await s.run("drive_search", { query: "O'Neil \\ plan" });
    const q = new URL(s.emulator.requests[0]?.url ?? "").searchParams.get("q");
    expect(q).toBe(
      "trashed = false and (name contains 'O\\'Neil \\\\ plan' or fullText contains 'O\\'Neil \\\\ plan')",
    );
  });

  it("finds by name or content, filters by type and returns the summary fields", async () => {
    const s = setup();
    const byContent = (await s.run("drive_search", { query: "ship drive" })) as {
      files: Array<Record<string, unknown>>;
    };
    expect(byContent.files).toEqual([
      expect.objectContaining({
        id: "doc1",
        name: "Roadmap",
        owners: ["ann@example.test"],
        webViewLink: "https://drive.example.test/file/doc1",
      }),
    ]);
    const typed = (await s.run("drive_search", { query: "s", mimeType: "application/pdf" })) as {
      files: Array<{ id: string }>;
    };
    expect(typed.files.map((f) => f.id)).toEqual(["pdf1"]);
  });

  it("caps maxResults and requires a query", async () => {
    const s = setup();
    await s.run("drive_search", { query: "a", maxResults: 5000 });
    expect(new URL(s.emulator.requests[0]?.url ?? "").searchParams.get("pageSize")).toBe("100");
    expect(await s.run("drive_search", {})).toEqual({ error: "query is required" });
  });
});

describe("drive_read", () => {
  it("exports Docs and Sheets and downloads text files", async () => {
    const s = setup();
    expect(await s.run("drive_read", { fileId: "doc1" })).toMatchObject({
      content: "Q4 roadmap\nShip Drive tools",
      truncated: false,
    });
    expect(await s.run("drive_read", { fileId: "sheet1" })).toMatchObject({
      content: "item,cost\nlaptop,1200",
    });
    expect(await s.run("drive_read", { fileId: "txt1" })).toMatchObject({ content: "plain notes" });
  });

  it("returns only metadata and a note for binary files", async () => {
    const r = (await setup().run("drive_read", { fileId: "pdf1" })) as Record<string, unknown>;
    expect(r.name).toBe("scan.pdf");
    expect(r.note).toMatch(/can't be read as text/);
    expect(r).not.toHaveProperty("content");
  });

  it("truncates to 100,000 characters", async () => {
    const drive = new DriveApiEmulator({
      accounts: {
        "acct-a": {
          email: "a@example.test",
          files: [
            { id: "big", name: "big.txt", mimeType: "text/plain", text: "x".repeat(100_050) },
          ],
        },
      },
    });
    const r = (await setup(undefined, drive).run("drive_read", { fileId: "big" })) as {
      content: string;
      truncated: boolean;
    };
    expect(r.truncated).toBe(true);
    expect(r.content).toHaveLength(100_000);
  });

  it("reports a missing file", async () => {
    expect(await setup().run("drive_read", { fileId: "nope" })).toEqual({
      error: "File not found",
    });
  });
});

describe("drive_create_file", () => {
  it("refuses a write when the check right before it denies, and still reads", async () => {
    const s = setup();
    s.deps.beforeWrite = async () => "No longer available.";
    expect(await s.run("drive_create_file", { name: "Plan", content: "x", kind: "doc" })).toEqual({
      error: "No longer available.",
    });
    expect(s.emulator.requests).toEqual([]);
    await s.run("drive_search", { query: "plan" });
    expect(s.emulator.requests).toHaveLength(1);
  });

  it("creates a Google Doc and uploads the text for conversion", async () => {
    const s = setup();
    const r = (await s.run("drive_create_file", {
      name: "Plan",
      content: "hello",
      kind: "doc",
      parentFolderId: "folder1",
    })) as { id: string };
    expect(r).toMatchObject({ name: "Plan", webViewLink: expect.stringContaining(r.id) });
    expect(s.emulator.requests[0]?.body).toEqual({
      name: "Plan",
      mimeType: "application/vnd.google-apps.document",
      parents: ["folder1"],
    });
    expect(s.emulator.requests[1]).toMatchObject({
      method: "PATCH",
      body: "hello",
      contentType: "text/plain",
    });
    expect(s.emulator.file("acct-a", r.id)).toMatchObject({ text: "hello" });
  });

  it("creates a text file with its own type", async () => {
    const s = setup();
    const r = (await s.run("drive_create_file", {
      name: "a.md",
      content: "# hi",
      kind: "text",
      mimeType: "text/markdown",
    })) as { id: string };
    expect(s.emulator.file("acct-a", r.id)).toMatchObject({
      mimeType: "text/markdown",
      text: "# hi",
    });
    expect(s.emulator.requests[1]?.contentType).toBe("text/markdown");
  });

  it("validates input", async () => {
    const s = setup();
    expect(
      await s.run("drive_create_file", { name: "x", content: "y", kind: "pdf" }),
    ).toHaveProperty("error");
    expect(
      await s.run("drive_create_file", {
        name: "x",
        content: "y",
        kind: "text",
        mimeType: "application/pdf",
      }),
    ).toHaveProperty("error");
  });

  it("does not retry an ambiguous create failure and says to check Drive", async () => {
    const s = setup();
    let posts = 0;
    s.deps.connectors = {
      managed: () =>
        ({
          proxy: async () => {
            posts++;
            return { status: 503, data: {} };
          },
        }) as unknown as ManagedConnectorProvider,
    };
    const r = (await driveToolFromTool("drive_create_file", s.deps, context, {
      name: "x",
      content: "y",
      kind: "doc",
    })) as { error: string };
    expect(posts).toBe(1);
    expect(r.error).toMatch(/Check Drive/);
  });
});

describe("drive reads and ambiguous creates", () => {
  it("treats a create that timed out (408) as unclear too", async () => {
    const s = setup();
    s.deps.connectors = {
      managed: () =>
        ({ proxy: async () => ({ status: 408, data: {} }) }) as unknown as ManagedConnectorProvider,
    };
    const r = (await driveToolFromTool("drive_create_file", s.deps, context, {
      name: "x",
      content: "y",
      kind: "doc",
    })) as { error: string };
    expect(r.error).toMatch(/Check Drive/);
  });

  it("asks the connector for the raw text of a file and returns it unchanged", async () => {
    const s = setup();
    const seen: Array<{ url: string; responseType?: string }> = [];
    const inner = s.deps.connectors.managed("google") as unknown as {
      proxy: (r: never) => Promise<{ status: number; data: unknown }>;
    };
    s.deps.connectors = {
      managed: () =>
        ({
          proxy: async (r: { url: string; responseType?: string }) => {
            seen.push(r);
            if (r.responseType === "text") return { status: 200, data: "" };
            return inner.proxy(r as never);
          },
        }) as unknown as ManagedConnectorProvider,
    };
    const r = (await s.run("drive_read", { fileId: "txt1" })) as { content?: string };
    expect(seen.find((x) => /alt=media|export/.test(x.url))?.responseType).toBe("text");
    expect(r.content).toBe("");
  });
});

describe("drive_update_file", () => {
  it("replaces a Doc's content and renames it", async () => {
    const s = setup();
    const r = await s.run("drive_update_file", {
      fileId: "doc1",
      content: "new text",
      name: "Roadmap v2",
    });
    expect(r).toMatchObject({ id: "doc1", name: "Roadmap v2" });
    expect(s.emulator.file("acct-a", "doc1")).toMatchObject({
      text: "new text",
      name: "Roadmap v2",
    });
  });

  it("keeps a text file's own type on upload", async () => {
    const s = setup();
    await s.run("drive_update_file", { fileId: "txt1", content: "changed" });
    expect(s.emulator.requests.at(-1)?.contentType).toBe("text/plain");
    expect(s.emulator.file("acct-a", "txt1")?.text).toBe("changed");
  });

  it("refuses to overwrite a binary file and needs something to change", async () => {
    const s = setup();
    expect(await s.run("drive_update_file", { fileId: "pdf1", content: "x" })).toHaveProperty(
      "error",
    );
    expect(s.emulator.file("acct-a", "pdf1")?.name).toBe("scan.pdf");
    expect(await s.run("drive_update_file", { fileId: "doc1" })).toEqual({
      error: "Pass content or name",
    });
  });
});

describe("accounts and errors", () => {
  const two = () => {
    const drive = new DriveApiEmulator({
      accounts: {
        a: {
          email: "ann@example.test",
          files: [{ id: "fa", name: "A file", mimeType: "text/plain", text: "a" }],
        },
        b: {
          email: "bob@example.test",
          files: [{ id: "fb", name: "B file", mimeType: "text/plain", text: "b" }],
        },
      },
    });
    return setup([account("a", "Ann"), account("b", "Bob's work")], drive);
  };

  it("requires account with two connected, and resolves by email or name", async () => {
    const s = two();
    expect(await s.run("drive_search", { query: "file" })).toMatchObject({
      error: expect.stringMatching(/Pass account.*Ann, Bob/),
    });
    const byEmail = (await s.run("drive_search", {
      query: "file",
      account: "BOB@example.test",
    })) as { files: Array<{ id: string }> };
    expect(byEmail.files.map((f) => f.id)).toEqual(["fb"]);
    const byName = (await s.run("drive_search", { query: "file", account: "ann" })) as {
      files: Array<{ id: string }>;
    };
    expect(byName.files.map((f) => f.id)).toEqual(["fa"]);
    expect(await s.run("drive_search", { query: "file", account: "eve@example.test" })).toEqual({
      error: "No connected Drive account eve@example.test. Available: Ann, Bob's work",
    });
  });

  it("reports no account", async () => {
    expect(await setup([]).run("drive_search", { query: "a" })).toEqual({
      error: "No connected Drive account",
    });
  });

  it("maps a 401 to a reconnect message", async () => {
    const s = setup([account("unknown", "Gone")]);
    expect(await s.run("drive_search", { query: "a" })).toEqual({
      error: "The Drive account needs to be reconnected",
    });
  });

  it("hides transport failure details", async () => {
    const s = setup();
    s.deps.connectors = {
      managed: () =>
        ({
          proxy: async () => {
            throw new Error("secret token abc");
          },
        }) as unknown as ManagedConnectorProvider,
    };
    expect(await driveToolFromTool("drive_read", s.deps, context, { fileId: "x" })).toEqual({
      error: "Drive request failed",
    });
  });
});

describe("driveToolsAllowed", () => {
  const owner = {
    hasProvider: true,
    groupId: null,
    runUserId: "user-1",
    botUserId: "user-1",
    messagingChannelRun: false,
    trigger: "user",
  };

  it.each(["user", "follow_up", "routine"])("allows an owner-started %s run", (trigger) => {
    expect(driveToolsAllowed({ ...owner, trigger })).toBe(true);
  });

  it("refuses a bot_message run, which another agent (even from another account) started", () => {
    expect(driveToolsAllowed({ ...owner, trigger: "bot_message" })).toBe(false);
  });
});
