import { createSecretStore, syncFinanceForUser } from "@rakazo/adapters";
import { CARTA_MCP_ENDPOINT, FINANCE_MCP_ENDPOINTS } from "@rakazo/contracts";
import { createDb, createThreadMessageInTransaction, saveCapTableSnapshot } from "@rakazo/db";
import { makePdf } from "../../../../adapters/src/data-room-test-fakes.js";
import {
  DEMO_ARCHIVED_BOT,
  DEMO_ARTIFACTS,
  DEMO_BOTS,
  DEMO_CAP_TABLE,
  DEMO_CHIEF_DRAFT,
  DEMO_CHIEF_DRAFT_V1,
  DEMO_CHIEF_HISTORY,
  DEMO_COMPANY,
  DEMO_CONTACTS,
  DEMO_DOCUMENT_FACETS,
  DEMO_DOCUMENTS,
  DEMO_EMPTY_SPACE,
  DEMO_GROUP,
  DEMO_RUNNING_RUN,
  DEMO_USER_NAME,
  DEMO_WAITING_RUN,
  DEMO_WALLET,
  demoFinance,
  demoFolderPaths,
  demoStatementCsv,
  linkDemoArtifacts,
  MOCK_NOTE,
} from "./data.js";

export interface DemoSeedOptions {
  apiUrl: string;
  /** The web origin the API trusts; sent as the Origin of sign-up. */
  webOrigin: string;
  databaseUrl: string;
  encryptionKey: string;
  email: string;
  password: string;
}

/** A signed-in browser stand-in: the session cookie plus the API's RPC and upload routes. */
class DemoSession {
  private cookie = "";
  constructor(
    private readonly apiUrl: string,
    private readonly origin: string,
  ) {}

  async signUp(name: string, email: string, password: string) {
    const response = await fetch(`${this.apiUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: this.origin },
      body: JSON.stringify({ name, email, password }),
    });
    if (!response.ok) throw new Error(`Sign-up failed: ${response.status}`);
    this.cookie = response.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
  }

  async rpc<T>(procedure: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.apiUrl}/rpc/${procedure}`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: this.cookie, origin: this.origin },
      body: JSON.stringify({ json: body ?? null }),
    });
    const parsed = (await response.json()) as { json?: T; error?: { message?: string } };
    if (!response.ok || parsed.error)
      throw new Error(`${procedure} ${response.status}: ${parsed.error?.message ?? "failed"}`);
    return parsed.json as T;
  }

  async upload(name: string, folderId: string, mimeType: string, bytes: Uint8Array) {
    const response = await fetch(
      `${this.apiUrl}/api/data-room/upload?name=${encodeURIComponent(name)}&folderId=${folderId}`,
      {
        method: "POST",
        headers: { "content-type": mimeType, cookie: this.cookie, origin: this.origin },
        body: Buffer.from(bytes),
      },
    );
    if (!response.ok) throw new Error(`Upload of ${name} failed: ${response.status}`);
  }
}

/** Creates the demo account and fills every area the app can hold offline. Returns what it did. */
export async function seedDemo(options: DemoSeedOptions): Promise<string[]> {
  const done: string[] = [];
  const session = new DemoSession(options.apiUrl, options.webOrigin);
  await session.signUp(DEMO_USER_NAME, options.email, options.password);

  // The company: the default space carries the mock label everywhere it is shown.
  const nav = await session.rpc<{ current: { id: string } }>("spaces/list");
  const spaceId = nav.current.id;
  await session.rpc("spaces/rename", { spaceId, name: DEMO_COMPANY });

  // What first-run onboarding does in the browser: Chief, the first bot.
  const chief = await session.rpc<{ id: string }>("bots/create", {
    name: "Chief",
    title: "",
    description: "",
    instructions: "",
    notifyOnFinish: true,
    spawnKey: "onboarding:first",
  });
  done.push("Chief bot");

  // Inbox: the same connect path the Integrations page uses, against the Gmail emulator.
  const gmail = await session.rpc<{ connectionId: string }>("connections/begin", {
    provider: "GMAIL",
    displayName: "Founder mail (Mock)",
  });
  await session.rpc("connections/complete", { connectionId: gmail.connectionId });
  // A second account, so the account tabs and the From picker show.
  const sales = await session.rpc<{ connectionId: string }>("connections/begin", {
    provider: "GMAIL",
    displayName: "Sales mail (Mock)",
  });
  await session.rpc("connections/complete", { connectionId: sales.connectionId });
  await session.rpc("inbox/agent");
  await session.rpc("inbox/refresh", {});
  done.push("Two Gmail emulator mailboxes, Inbox agent");

  // Finance: servers with a stored (fake) login, one sync from the canned tools, the Finance agent.
  const { prisma, pool } = createDb(options.databaseUrl);
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: options.email } });
    const scope = { spaceId, userId: user.id };
    const secrets = createSecretStore(options.encryptionKey, {});
    // A fake stored login, so a server counts as signed in. Calls to it reach only the emulators.
    const fakeLogin = async () => {
      const stored = await secrets.put(
        JSON.stringify({
          oauth: { tokens: { access_token: "mock-demo-token", token_type: "bearer" } },
        }),
        {
          operationId: "demo.seed",
          traceId: "demo.seed",
          ...scope,
          botId: "mcp",
          signal: new AbortController().signal,
        },
      );
      await prisma.secret.create({
        data: { id: stored.id, ...scope, kind: "mcp", ciphertext: stored.ciphertext },
      });
      return stored.id;
    };
    for (const provider of ["mercury", "brex"] as const) {
      await prisma.mcpServer.create({
        data: {
          ...scope,
          slug: `finance-${provider}`,
          name: provider === "mercury" ? "Mercury" : "Brex",
          transport: "streamable_http",
          endpoint: FINANCE_MCP_ENDPOINTS[provider],
          secretId: await fakeLogin(),
        },
      });
    }
    const result = await syncFinanceForUser(
      { prisma, callToolFor: demoFinance().callToolFor },
      scope,
      { force: true },
    );
    if (Object.values(result).some((outcome) => outcome !== "synced"))
      throw new Error(`Finance seed did not sync: ${JSON.stringify(result)}`);
    await session.rpc("finance/agent");
    done.push("Mercury and Brex (canned tools), Finance agent");

    // Cap Table: a signed-in Carta server and the Carta agent's last read of the mock cap table.
    await prisma.mcpServer.create({
      data: {
        ...scope,
        slug: "carta",
        name: "Carta (MOCK DEMO)",
        transport: "streamable_http",
        endpoint: CARTA_MCP_ENDPOINT,
        secretId: await fakeLogin(),
      },
    });
    await saveCapTableSnapshot(prisma, scope, DEMO_CAP_TABLE);
    await session.rpc("carta/agent");
    done.push("Carta (mock login; its tools reach only the emulator), mock cap table, Carta agent");
    // A bank with no integration: last month's statement, uploaded and imported as a user would.
    const statement = demoStatementCsv();
    const reviewed = await session.rpc<{ id: string }>("finance/statementUpload", {
      fileName: statement.fileName,
      contentBase64: Buffer.from(statement.body).toString("base64"),
    });
    await session.rpc("finance/statementConfirm", { id: reviewed.id });
    done.push("1 imported bank statement");
    // A treasury wallet, read through the API's offline crypto fake (no real chain is called).
    await session.rpc("finance/walletAdd", {
      addressOrEns: DEMO_WALLET.address,
      label: DEMO_WALLET.label,
      type: "personal",
    });
    done.push("1 crypto wallet (offline fake balances)");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }

  // Cap table page: investor contacts.
  for (const contact of DEMO_CONTACTS) await session.rpc("contacts/save", contact);
  done.push(`${DEMO_CONTACTS.length} contacts`);

  // Data room: folders and documents (uploaded through the real route, then ingested).
  const folders = new Map<string, string>();
  for (const path of demoFolderPaths(DEMO_DOCUMENTS)) {
    const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : null;
    const folder = await session.rpc<{ id: string }>("dataRoom/folderCreate", {
      name: path.slice(path.lastIndexOf("/") + 1),
      parentId: parent ? folders.get(parent) : null,
    });
    folders.set(path, folder.id);
  }
  for (const document of DEMO_DOCUMENTS) {
    const bytes =
      document.kind === "pdf" ? makePdf(document.text) : new TextEncoder().encode(document.text);
    await session.upload(
      document.name,
      folders.get(document.folder) as string,
      document.kind === "csv" ? "text/csv" : "application/pdf",
      bytes,
    );
  }
  {
    const db = createDb(options.databaseUrl);
    try {
      for (const [name, facets] of Object.entries(DEMO_DOCUMENT_FACETS)) {
        await db.prisma.dataRoomItem.updateMany({
          where: { spaceId, name },
          data: {
            docType: facets.docType,
            docDate: new Date(Date.now() - facets.daysAgo * 24 * 60 * 60 * 1000),
            parties: facets.parties,
          },
        });
      }
    } finally {
      await db.prisma.$disconnect();
      await db.pool.end();
    }
  }
  done.push(`${DEMO_DOCUMENTS.length} data room documents`);

  // Artifacts: last month's investor update in two versions, and the other files Chief made.
  const artifactIds = new Map<string, string>();
  for (const artifact of [DEMO_CHIEF_DRAFT_V1, DEMO_CHIEF_DRAFT, ...DEMO_ARTIFACTS]) {
    const created = await session.rpc<{ id: string }>("artifacts/create", {
      botId: chief.id,
      name: artifact.name,
      mimeType: artifact.mimeType,
      ...("description" in artifact ? { description: artifact.description } : {}),
      contentBase64: Buffer.from(artifact.text).toString("base64"),
    });
    artifactIds.set(artifact.name, created.id);
  }
  done.push(`${DEMO_ARTIFACTS.length + 1} artifacts (the investor update has 2 versions)`);

  // Chief's earlier conversation, written straight to the thread (no model call).
  {
    const db = createDb(options.databaseUrl);
    try {
      const thread = await db.prisma.thread.findFirstOrThrow({ where: { botId: chief.id } });
      for (const entry of DEMO_CHIEF_HISTORY) {
        await db.prisma.$transaction((tx) =>
          createThreadMessageInTransaction(tx, {
            threadId: thread.id,
            role: entry.role,
            blocks: [{ kind: "text", text: linkDemoArtifacts(entry.text, artifactIds) }],
            markUnread: false,
          }),
        );
      }
    } finally {
      await db.prisma.$disconnect();
      await db.pool.end();
    }
  }
  done.push(`${DEMO_CHIEF_HISTORY.length} earlier messages with Chief`);

  // Team: extra bots and a group chat.
  const botIds = [chief.id];
  for (const bot of DEMO_BOTS) {
    const created = await session.rpc<{ id: string }>("bots/create", {
      ...bot,
      instructions: bot.description,
      notifyOnFinish: true,
    });
    botIds.push(created.id);
  }
  await session.rpc("groups/create", { name: DEMO_GROUP.name, botIds });

  // A run waiting on the founder's answer, written straight to the database (no model call).
  {
    const db = createDb(options.databaseUrl);
    try {
      const { spaceId, userId } = await db.prisma.bot.findUniqueOrThrow({
        where: { id: chief.id },
      });
      const bot = await db.prisma.bot.findFirstOrThrow({
        where: { spaceId, name: DEMO_WAITING_RUN.botName },
      });
      const thread = await db.prisma.thread.findUniqueOrThrow({ where: { botId: bot.id } });
      const owner = { spaceId, userId, botId: bot.id, threadId: thread.id };
      // Let the bot's own introduction finish first, so the question is the newest message.
      await waitForIdleBot(db.prisma, bot.id);
      const task = await db.prisma.task.create({
        data: { ...owner, prompt: DEMO_WAITING_RUN.prompt, status: "waiting_input" },
      });
      const run = await db.prisma.run.create({
        data: {
          ...owner,
          taskId: task.id,
          status: "waiting_input",
          trigger: "user",
          startedAt: new Date(),
        },
      });
      await db.prisma.$transaction(async (tx) => {
        await createThreadMessageInTransaction(tx, {
          threadId: thread.id,
          role: "user",
          blocks: [{ kind: "text", text: DEMO_WAITING_RUN.prompt }],
          markUnread: false,
        });
        await createThreadMessageInTransaction(tx, {
          threadId: thread.id,
          role: "bot",
          botId: bot.id,
          runId: run.id,
          blocks: [
            { kind: "text", text: DEMO_WAITING_RUN.intro },
            {
              kind: "ask",
              text: DEMO_WAITING_RUN.question,
              status: "pending",
              actions: DEMO_WAITING_RUN.choices,
            },
          ],
        });
      });
    } finally {
      await db.prisma.$disconnect();
      await db.pool.end();
    }
  }
  // A run still working, for Activity's "Working" list, on a bot outside the group chat.
  {
    const helper = await session.rpc<{ id: string }>("bots/create", {
      ...DEMO_RUNNING_RUN.bot,
      instructions: DEMO_RUNNING_RUN.bot.description,
      notifyOnFinish: true,
    });
    const db = createDb(options.databaseUrl);
    try {
      await waitForIdleBot(db.prisma, helper.id);
      const bot = await db.prisma.bot.findUniqueOrThrow({ where: { id: helper.id } });
      const thread = await db.prisma.thread.findUniqueOrThrow({ where: { botId: bot.id } });
      const owner = {
        spaceId: bot.spaceId,
        userId: bot.userId,
        botId: bot.id,
        threadId: thread.id,
      };
      const task = await db.prisma.task.create({
        data: { ...owner, prompt: DEMO_RUNNING_RUN.prompt, status: "running" },
      });
      // A lease far ahead and an owner no worker uses: nothing picks the run up while the demo runs.
      await db.prisma.run.create({
        data: {
          ...owner,
          taskId: task.id,
          status: "running",
          trigger: "user",
          startedAt: new Date(),
          leaseOwner: "mock-demo-seed",
          leaseExpiresAt: new Date(Date.now() + DEMO_RUNNING_RUN.leaseMs),
        },
      });
      await db.prisma.$transaction((tx) =>
        createThreadMessageInTransaction(tx, {
          threadId: thread.id,
          role: "user",
          blocks: [{ kind: "text", text: DEMO_RUNNING_RUN.prompt }],
          markUnread: false,
        }),
      );
    } finally {
      await db.prisma.$disconnect();
      await db.pool.end();
    }
  }
  const archived = await session.rpc<{ id: string }>("bots/create", {
    ...DEMO_ARCHIVED_BOT,
    instructions: DEMO_ARCHIVED_BOT.description,
    notifyOnFinish: true,
  });
  await session.rpc("bots/archive", { botId: archived.id });
  done.push(
    `${DEMO_BOTS.length + 1} extra bots, 1 archived bot, 1 group chat, 1 run waiting on an answer, 1 run working (${MOCK_NOTE})`,
  );

  // A second, empty space: what a founder sees before connecting anything (switch to it to test).
  await session.rpc("spaces/create", { name: DEMO_EMPTY_SPACE });
  done.push(`empty space "${DEMO_EMPTY_SPACE}"`);
  return done;
}

/** Waits up to 90 seconds for a bot's own runs (its introduction) to finish. */
async function waitForIdleBot(prisma: ReturnType<typeof createDb>["prisma"], botId: string) {
  for (let waited = 0; waited < 90_000; waited += 1_000) {
    const busy = await prisma.run.count({
      where: { botId, status: { notIn: ["completed", "failed", "cancelled"] } },
    });
    if (!busy) return;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
}
