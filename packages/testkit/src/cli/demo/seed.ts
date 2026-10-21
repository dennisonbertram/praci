import { generateKeyPairSync, randomUUID } from "node:crypto";
import { createSecretStore, syncFinanceForUser } from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import {
  CARTA_MCP_ENDPOINT,
  FINANCE_MCP_ENDPOINTS,
  LEGAL_AGENT_MODEL,
  LEGAL_SCAN_ROUTINE_NAME,
  legalAgentSpawnKey,
} from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import {
  createDb,
  createLegalRepos,
  createThreadMessage,
  createThreadMessageInTransaction,
  LEGAL_NOT_LEGAL_TYPE,
  saveCapTableSnapshot,
} from "@rakazo/db";
import { makePdf } from "../../../../adapters/src/data-room-test-fakes.js";
import type { Turn } from "./conversations.js";
import { DEMO_CONVERSATIONS, DEMO_EMAIL_AGENT_CONVERSATION } from "./conversations.js";
import {
  DEMO_ARCHIVED_BOT,
  DEMO_ARTIFACTS,
  DEMO_BOTS,
  DEMO_CAP_TABLE,
  DEMO_CHIEF_DRAFT,
  DEMO_CHIEF_DRAFT_V1,
  DEMO_CHIEF_HISTORY,
  DEMO_COFOUNDER,
  DEMO_COMPANY,
  DEMO_CONTACTS,
  DEMO_DOCUMENT_FACETS,
  DEMO_DOCUMENTS,
  DEMO_EMPTY_SPACE,
  DEMO_ENS_WALLET,
  DEMO_FINANCE_RECONNECT_SPACE,
  DEMO_GROUP,
  DEMO_LEGAL,
  DEMO_RATE_LIMIT_SPACE,
  DEMO_READING_DOCUMENT,
  DEMO_RECONNECT_SPACE,
  DEMO_ROUTINES,
  DEMO_RUNNING_RUN,
  DEMO_SKILLS,
  DEMO_USER_NAME,
  DEMO_WAITING_RUN,
  DEMO_WALLET,
  demoCryptoHistory,
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
  /** No model set up (DEMO_NO_MODEL=1): Carta is connected but has never been read. */
  noModel?: boolean;
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

  /** `spaceId` acts in that space, as the browser does once it is selected. */
  async rpc<T>(procedure: string, body?: unknown, spaceId?: string): Promise<T> {
    const response = await fetch(`${this.apiUrl}/rpc/${procedure}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: this.cookie,
        origin: this.origin,
        ...(spaceId ? { "x-rakazo-space-id": spaceId } : {}),
      },
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

/**
 * Sign-up gave the user a Personal space that is also marked default and is older, so it would win
 * the default-space tie and the user could never reach the company. Only `spaceId` stays default.
 */
export async function makeSpaceTheOnlyDefault(
  prisma: Pick<ReturnType<typeof createDb>["prisma"], "space">,
  spaceId: string,
  userId: string,
) {
  await prisma.space.updateMany({
    where: { id: { not: spaceId }, memberships: { some: { userId } } },
    data: { isDefault: false },
  });
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
    displayName: "Founder mail",
  });
  await session.rpc("connections/complete", { connectionId: gmail.connectionId });
  // A second account, so the account tabs and the From picker show.
  const sales = await session.rpc<{ connectionId: string }>("connections/begin", {
    provider: "GMAIL",
    displayName: "Sales mail",
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
    // `expired` keeps the OAuth record but drops its tokens, which is how a lapsed sign-in looks.
    const fakeLogin = async (
      where: { spaceId: string; userId: string } = scope,
      expired = false,
    ) => {
      const stored = await secrets.put(
        JSON.stringify({
          oauth: expired
            ? { clientInformation: { client_id: "mock-demo-client" } }
            : { tokens: { access_token: "mock-demo-token", token_type: "bearer" } },
        }),
        {
          operationId: "demo.seed",
          traceId: "demo.seed",
          ...where,
          botId: "mcp",
          signal: new AbortController().signal,
        },
      );
      await prisma.secret.create({
        data: { id: stored.id, ...where, kind: "mcp", ciphertext: stored.ciphertext },
      });
      return stored.id;
    };
    // Mercury and Brex with a stored (fake) login, synced once from the canned tools.
    const connectFinance = async (where: { spaceId: string; userId: string }) => {
      for (const provider of ["mercury", "brex"] as const) {
        await prisma.mcpServer.create({
          data: {
            ...where,
            slug: `finance-${provider}`,
            name: provider === "mercury" ? "Mercury" : "Brex",
            transport: "streamable_http",
            endpoint: FINANCE_MCP_ENDPOINTS[provider],
            // The login belongs to the space it is stored for, as a real sign-in would.
            secretId: await fakeLogin(where),
          },
        });
      }
      const result = await syncFinanceForUser(
        { prisma, callToolFor: demoFinance().callToolFor },
        where,
        { force: true },
      );
      if (Object.values(result).some((outcome) => outcome !== "synced"))
        throw new Error(`Finance seed did not sync: ${JSON.stringify(result)}`);
    };
    await connectFinance(scope);
    const agent = await session.rpc<{ id: string }>("finance/agent");
    done.push("Mercury and Brex (canned tools), Finance agent");

    // Cap Table: a signed-in Carta server and the Carta agent's last read of the mock cap table.
    await prisma.mcpServer.create({
      data: {
        ...scope,
        slug: "carta",
        name: "Carta",
        transport: "streamable_http",
        endpoint: CARTA_MCP_ENDPOINT,
        secretId: await fakeLogin(),
      },
    });
    // Without a model the Carta agent could never have read Carta, so there is no snapshot.
    // DEMO_SEED_CAP_TABLE=1 (used to record the homepage demo) seeds the read even with no model.
    const readCapTable = !options.noModel || process.env.DEMO_SEED_CAP_TABLE === "1";
    if (readCapTable) await saveCapTableSnapshot(prisma, scope, DEMO_CAP_TABLE);
    await session.rpc("carta/agent");
    done.push(
      `Carta (mock login; its tools reach only the emulator), ${readCapTable ? "mock cap table" : "no cap table read yet"}, Carta agent`,
    );
    // A bank with no integration: last month's statement, uploaded and imported as a user would.
    const statement = demoStatementCsv();
    const reviewed = await session.rpc<{ id: string }>("finance/statementUpload", {
      fileName: statement.fileName,
      contentBase64: Buffer.from(statement.body).toString("base64"),
    });
    await session.rpc("finance/statementConfirm", { id: reviewed.id });
    done.push("1 imported bank statement");
    // A treasury Safe and an ENS ops wallet, read through the API's offline crypto fake (no real
    // chain is called), with 90 days of history for the Safe, and a Coinbase connection whose
    // invented key reaches only the fake.
    const safe = await session.rpc<{ id: string }>("finance/walletAdd", {
      addressOrEns: DEMO_WALLET.address,
      label: DEMO_WALLET.label,
      type: DEMO_WALLET.type,
    });
    const ops = await session.rpc<{ id: string }>("finance/walletAdd", {
      addressOrEns: DEMO_ENS_WALLET.name,
      label: DEMO_ENS_WALLET.label,
      type: DEMO_ENS_WALLET.type,
    });
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const coinbase = await session.rpc<{ id: string }>("finance/exchangeConnect", {
      provider: "coinbase",
      key: "organizations/mock-demo/apiKeys/mock-demo-key",
      secret: privateKey.export({ type: "sec1", format: "pem" }).toString(),
    });
    // History for each holder at about today's size, so the chart does not jump on the last day.
    const history = (today: { stablecoinCents: number; otherCryptoCents: number }) =>
      demoCryptoHistory(new Date(), today).map((point) => ({
        ...scope,
        day: point.day,
        stablecoinCents: BigInt(point.stablecoinCents),
        otherCryptoCents: BigInt(point.otherCryptoCents),
      }));
    await prisma.financeCryptoSnapshot.createMany({
      data: [
        ...history({ stablecoinCents: 4_000_000, otherCryptoCents: 625_000 }).map((row) => ({
          ...row,
          walletId: safe.id,
        })),
        ...history({ stablecoinCents: 0, otherCryptoCents: 100_000 }).map((row) => ({
          ...row,
          walletId: ops.id,
        })),
      ],
      skipDuplicates: true,
    });
    await prisma.financeExchangeSnapshot.createMany({
      data: history({ stablecoinCents: 3_700_000, otherCryptoCents: 2_100_000 }).map((row) => ({
        ...row,
        connectionId: coinbase.id,
      })),
      skipDuplicates: true,
    });
    done.push("2 crypto wallets (a 2-of-3 Safe and an ENS wallet) and Coinbase (offline fakes)");

    // The Finance agent's pins: Cash and Runway as on the dashboard, and a month-end checklist.
    const overview = await session.rpc<{
      cash: { cashCents: number };
      runway: { months: number | null; runOutDate: string | null };
    }>("finance/overview");
    const usd = (cents: number) => `$${Math.round(cents / 100).toLocaleString("en-US")}`;
    await prisma.botPins.create({
      data: {
        ...scope,
        botId: agent.id,
        updatedBy: "bot",
        refreshedAt: new Date(),
        stats: [
          {
            id: "cash",
            label: "Cash",
            value: usd(overview.cash.cashCents),
            detail: "All bank accounts",
          },
          {
            id: "runway",
            label: "Runway",
            value: overview.runway.months === null ? "—" : `${overview.runway.months} mo`,
            detail: "At the average monthly burn",
          },
        ],
        list: {
          title: "Month-end close",
          items: [
            { id: "recon", text: "Reconcile Mercury and Brex", done: true },
            { id: "receipts", text: "Chase missing receipts", done: false },
            { id: "update", text: "Send the investor update", done: false },
          ],
        },
      },
    });
    done.push("Finance agent pins (Cash, Runway) and a Month-end close checklist");
    // One earlier question and answer, so Hide amounts can be checked on runway months and a
    // run-out month in a reply (the exact day moves with the calendar, so a stored answer names the month) without a live (paid) model call.
    if (overview.runway.months !== null && overview.runway.runOutDate) {
      const runOut = new Date(`${overview.runway.runOutDate}T00:00:00Z`).toLocaleDateString(
        "en-US",
        { month: "long", year: "numeric", timeZone: "UTC" },
      );
      const thread = await prisma.thread.upsert({
        where: { botId: agent.id },
        create: { ...scope, botId: agent.id },
        update: {},
      });
      await createThreadMessage(prisma, {
        threadId: thread.id,
        role: "user",
        blocks: [{ kind: "text", text: "What is our runway?" }],
      });
      await createThreadMessage(prisma, {
        threadId: thread.id,
        role: "bot",
        botId: agent.id,
        markUnread: false,
        blocks: [
          {
            kind: "text",
            text: `You have ${overview.runway.months} months of runway at the last 3 months' burn, with ${usd(overview.cash.cashCents)} in cash. At that pace cash would run out around ${runOut}. (${MOCK_NOTE})`,
          },
        ],
      });
      done.push("1 earlier Finance agent answer about runway");
    }

    // A second company whose Mercury login has expired, for the Reconnect path.
    const reconnect = await session.rpc<{ id: string }>("spaces/create", {
      name: DEMO_FINANCE_RECONNECT_SPACE,
    });
    const reconnectScope = { spaceId: reconnect.id, userId: user.id };
    await connectFinance(reconnectScope);
    const mercury = await prisma.mcpServer.findFirstOrThrow({
      where: { ...reconnectScope, slug: "finance-mercury" },
    });
    // Synced once while signed in; now the sign-in has lapsed, so Finance asks to reconnect.
    await prisma.mcpServer.update({
      where: { id: mercury.id },
      data: { secretId: await fakeLogin(reconnectScope, true) },
    });
    done.push(`space "${DEMO_FINANCE_RECONNECT_SPACE}" (Mercury needs reconnecting)`);
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
          // Marked classified, so a later consent grant (Legal's, say) does not re-queue them for
          // the classifier, which would replace these facets and mark every file unread by Legal.
          data: {
            docType: facets.docType,
            docDate: new Date(Date.now() - facets.daysAgo * 24 * 60 * 60 * 1000),
            parties: facets.parties,
            // As if the classifier filed it: allowing AI sharing later leaves these facets alone.
            classifiedAt: new Date(),
          },
        });
      }
      // Left mid-read with no job behind it, so it shows as "Reading" for as long as the demo runs.
      await db.prisma.dataRoomItem.updateMany({
        where: { spaceId, name: DEMO_READING_DOCUMENT.name },
        data: { status: "extracting" },
      });
    } finally {
      await db.prisma.$disconnect();
      await db.pool.end();
    }
  }
  done.push(`${DEMO_DOCUMENTS.length} data room documents (1 still reading)`);

  // A cofounder in the same company, with a login of their own.
  {
    await new DemoSession(options.apiUrl, options.webOrigin).signUp(
      DEMO_COFOUNDER.name,
      DEMO_COFOUNDER.email,
      options.password,
    );
    const db = createDb(options.databaseUrl);
    try {
      const space = await db.prisma.space.findUniqueOrThrow({ where: { id: spaceId } });
      const user = await db.prisma.user.findUniqueOrThrow({
        where: { email: DEMO_COFOUNDER.email },
      });
      const createdAt = new Date();
      await db.prisma.member.create({
        data: {
          id: randomUUID(),
          organizationId: space.organizationId,
          userId: user.id,
          role: "member",
          createdAt,
        },
      });
      // Joining the organization may already add the space membership (a database trigger).
      await db.prisma.spaceMember.upsert({
        where: { spaceId_userId: { spaceId, userId: user.id } },
        update: {},
        create: {
          id: randomUUID(),
          spaceId,
          organizationId: space.organizationId,
          userId: user.id,
          role: "member",
          createdAt,
        },
      });
      await makeSpaceTheOnlyDefault(db.prisma, spaceId, user.id);
    } finally {
      await db.prisma.$disconnect();
      await db.pool.end();
    }
  }
  done.push(`second member ${DEMO_COFOUNDER.name} (${DEMO_COFOUNDER.email}, same password)`);

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

  // Legal: what the Legal agent's last daily scan recorded from the Legal folder.
  await session.rpc("legal/agent");
  {
    const db = createDb(options.databaseUrl);
    try {
      const user = await db.prisma.user.findUniqueOrThrow({ where: { email: options.email } });
      const recorded = await seedLegal(db.prisma, {
        spaceId,
        userId: user.id,
        email: options.email,
        isDeploymentOwner: false,
      });
      done.push(recorded);
    } finally {
      await db.prisma.$disconnect();
      await db.pool.end();
    }
  }

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
      // Earlier work with this bot comes first, so the question is the newest message.
      const history = DEMO_CONVERSATIONS[DEMO_WAITING_RUN.botName];
      if (history) {
        await writeConversation(db.prisma, thread.id, bot.id, history, artifactIds, new Map());
      }
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

  // The Data room agent is created on first use; create it now so it has a conversation.
  await session.rpc("dataRoom/agent");

  // The agents' earlier conversations, routines and saved skills, written straight to the database
  // (no model call). Each bot's own introduction run is waited for first, then replaced.
  {
    const db = createDb(options.databaseUrl);
    try {
      const bots = await db.prisma.bot.findMany({ where: { spaceId } });
      for (const bot of bots) await waitForIdleBot(db.prisma, bot.id);
      for (const [name, conversation] of Object.entries(DEMO_CONVERSATIONS)) {
        if (name === DEMO_WAITING_RUN.botName) continue;
        const group = await db.prisma.chatGroup.findFirst({ where: { spaceId, name } });
        const owner = bots[0];
        if (!owner) continue;
        const botFor = bots.find((bot) => bot.name === name);
        if (!group && !botFor) continue;
        // A group's thread is created with its first message, so it may not exist yet.
        const key = group ? { groupId: group.id } : { botId: botFor?.id ?? "" };
        const target =
          (await db.prisma.thread.findUnique({ where: key })) ??
          (await db.prisma.thread.create({
            data: { spaceId: owner.spaceId, userId: owner.userId, ...key },
          }));
        await db.prisma.message.deleteMany({ where: { threadId: target.id } });
        await db.prisma.thread.update({
          where: { id: target.id },
          data: { nextMessageSeq: 0, lastReadSeq: -1, unread: false },
        });
        await writeConversation(
          db.prisma,
          target.id,
          group ? null : (bots.find((bot) => bot.name === name)?.id ?? null),
          conversation,
          artifactIds,
          new Map(bots.map((bot) => [bot.name, bot.id])),
        );
      }
      // The email agent for the Sam Ortiz thread: made the way Ask agent makes it, then its chat is written.
      const sam = await db.prisma.cachedMailMessage.findFirst({
        where: { spaceId, subject: { contains: "Notice of Stockholder Action" }, fromSelf: false },
        orderBy: { receivedAt: "desc" },
      });
      if (sam) {
        const agent = await session.rpc<{ id: string }>("inbox/askAgent", { messageId: sam.id });
        await waitForIdleBot(db.prisma, agent.id);
        const agentThread = await db.prisma.thread.findUniqueOrThrow({
          where: { botId: agent.id },
        });
        await writeConversation(
          db.prisma,
          agentThread.id,
          agent.id,
          DEMO_EMAIL_AGENT_CONVERSATION,
          artifactIds,
          new Map(),
        );
      }
      const botId = (name: string) => bots.find((bot) => bot.name === name)?.id;
      for (const routine of DEMO_ROUTINES) {
        const id = botId(routine.bot);
        if (!id) continue;
        const { bot: _bot, ...input } = routine;
        await session.rpc("routines/create", { botId: id, active: true, notify: true, ...input });
      }
      for (const skill of DEMO_SKILLS) {
        const id = botId(skill.bot);
        if (!id) continue;
        await db.prisma.taughtSkill.create({
          data: {
            spaceId,
            userId: bots[0]?.userId ?? "",
            botId: id,
            name: skill.name,
            goal: skill.goal,
            status: "saved",
            playbook: skill.playbook,
            stoppedAt: new Date(),
          },
        });
      }
    } finally {
      await db.prisma.$disconnect();
      await db.pool.end();
    }
    done.push(
      `${Object.keys(DEMO_CONVERSATIONS).length} agent conversations, ${DEMO_ROUTINES.length} routines, ${DEMO_SKILLS.length} saved skills`,
    );
  }

  // A second, empty space: what a founder sees before connecting anything (switch to it to test).
  await session.rpc("spaces/create", { name: DEMO_EMPTY_SPACE });
  done.push(`empty space "${DEMO_EMPTY_SPACE}"`);

  // Spaces whose Gmail is broken: the demo's emulator answers 401 (sign-in lapsed, so the Inbox
  // shows Reconnect) or 429 (rate limited) for each one's first account.
  for (const [name, label, what] of [
    [DEMO_RECONNECT_SPACE, "Old mail", "needs reconnecting"],
    [DEMO_RATE_LIMIT_SPACE, "Busy mail", "is rate-limited"],
  ] as const) {
    const space = await session.rpc<{ id: string }>("spaces/create", { name });
    const begun = await session.rpc<{ connectionId: string }>(
      "connections/begin",
      { provider: "GMAIL", displayName: label },
      space.id,
    );
    await session.rpc("connections/complete", { connectionId: begun.connectionId }, space.id);
    await session.rpc("inbox/refresh", {}, space.id).catch(() => undefined);
    done.push(`space "${name}" with a Gmail account that ${what}`);
  }
  // The Data room documents already carry a type, date and parties, as if Praci had read them, so the
  // founder allowed that earlier; otherwise the Data room asks for consent it seems to have used.
  // The row is written directly, and last, so no document is sent to the model again: granting
  // through the API re-queues every document, and a reply would replace the seeded facets.
  const dataRoomConsent = await session.rpc<{
    key: string;
    version: string;
    allowed: boolean;
    recipients: unknown[];
  }>("dataRoom/consent");
  if (!dataRoomConsent.allowed && dataRoomConsent.recipients.length > 0) {
    const db = createDb(options.databaseUrl);
    try {
      const user = await db.prisma.user.findUniqueOrThrow({ where: { email: options.email } });
      await db.prisma.aiDataConsent.create({
        data: {
          userId: user.id,
          spaceId,
          recipientKey: dataRoomConsent.key,
          version: dataRoomConsent.version,
        },
      });
    } finally {
      await db.prisma.$disconnect();
      await db.pool.end();
    }
    done.push("Data room consent");
  }
  return done;
}

/**
 * Writes a seeded conversation to a thread, one message a step, spaced `gapHours` apart and ending
 * a few minutes ago, so the chat shows a few days of history. A bot message belongs to the thread's
 * bot, or to the bot named in the turn (a group chat).
 */
async function writeConversation(
  prisma: PrismaClient,
  threadId: string,
  threadBotId: string | null,
  conversation: { gapHours: number; turns: Turn[] },
  artifactIds: ReadonlyMap<string, string>,
  botIdsByName: ReadonlyMap<string, string>,
) {
  const { turns, gapHours } = conversation;
  const end = Date.now() - 5 * 60_000;
  for (const [index, turn] of turns.entries()) {
    const createdAt = new Date(end - (turns.length - 1 - index) * gapHours * 60 * 60_000 * 0.5);
    const botId =
      turn.role === "bot" ? (turn.botName && botIdsByName.get(turn.botName)) || threadBotId : null;
    const blocks =
      turn.role === "user"
        ? [{ kind: "text" as const, text: turn.text }]
        : turn.blocks.map((block) =>
            block.kind === "text"
              ? { ...block, text: linkDemoArtifacts(block.text, artifactIds) }
              : block,
          );
    const message = await prisma.$transaction((tx) =>
      createThreadMessageInTransaction(tx, {
        threadId,
        role: turn.role,
        blocks,
        ...(botId ? { botId } : {}),
        markUnread: false,
      }),
    );
    await prisma.message.update({ where: { id: message.id }, data: { createdAt } });
  }
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

const DAY_MS = 24 * 60 * 60 * 1000;
/** Midnight UTC `days` from today, as the Legal tables store dates. */
const dayFromToday = (days: number) =>
  new Date(Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`) + days * DAY_MS);

/**
 * Waits for the Data room to finish reading every upload (each read bumps an item's revision), then
 * records what a completed Legal scan would: the four contracts, their deadlines and graph, the other
 * documents checked and found not legal, two hand-made deadlines, and the finished scan run.
 */
async function seedLegal(prisma: PrismaClient, actor: Actor): Promise<string> {
  const scope = { spaceId: actor.spaceId, userId: actor.userId };
  const deadline = Date.now() + 90_000;
  // The Reading document is left mid-read on purpose, so it is neither waited for nor scanned.
  const readable = { ...scope, name: { not: DEMO_READING_DOCUMENT.name } };
  let items = await prisma.dataRoomItem.findMany({ where: readable });
  while (items.some((item) => item.status !== "ready" && item.status !== "failed")) {
    if (Date.now() > deadline) throw new Error("Data room documents were not read in time");
    await new Promise((resolve) => setTimeout(resolve, 500));
    items = await prisma.dataRoomItem.findMany({ where: readable });
  }
  const byName = new Map(items.map((item) => [item.name, item]));
  const legal = createLegalRepos(prisma);
  const company = await legal.upsertNode(actor, { kind: "company", label: DEMO_LEGAL.company });
  const recorded = new Set<string>();
  for (const spec of DEMO_LEGAL.contracts) {
    const item = byName.get(spec.document);
    if (!item) throw new Error(`Missing Data room document ${spec.document}`);
    recorded.add(item.id);
    const expiration = spec.expiresInDays === null ? null : dayFromToday(spec.expiresInDays);
    const contract = await legal.upsertContract(actor, {
      dataRoomItemId: item.id,
      revision: item.revision,
      title: spec.title,
      contractType: spec.contractType,
      counterparties: [spec.party],
      status: "active",
      effectiveDate: dayFromToday(spec.effectiveInDays),
      expirationDate: expiration,
      autoRenews: spec.autoRenews,
      renewalNoticeDays: spec.renewalNoticeDays,
      governingLaw: spec.jurisdiction,
      valueCents: spec.valueCents,
      currency: spec.valueCents === null ? null : "USD",
      summary: spec.summary,
    });
    if (expiration && spec.autoRenews && spec.renewalNoticeDays) {
      await legal.upsertDeadline(actor, {
        contractId: contract.id,
        dataRoomItemId: item.id,
        title: "Send non-renewal notice",
        dueDate: new Date(expiration.getTime() - spec.renewalNoticeDays * DAY_MS),
        kind: "notice",
        derived: true,
        sourceQuote: spec.renewalQuote,
        notes: `${MOCK_NOTE}: ${spec.renewalNoticeDays} days before it renews.`,
      });
      await legal.upsertDeadline(actor, {
        contractId: contract.id,
        dataRoomItemId: item.id,
        title: "Renews automatically",
        dueDate: expiration,
        kind: "renewal",
        derived: true,
        sourceQuote: spec.renewalQuote,
      });
    }
    const contractNode = await legal.upsertNode(actor, {
      kind: "contract",
      label: spec.title,
      contractId: contract.id,
    });
    const party = await legal.upsertNode(actor, { kind: "company", label: spec.party });
    const place = await legal.upsertNode(actor, { kind: "jurisdiction", label: spec.jurisdiction });
    for (const side of [company, party]) {
      await legal.link(actor, {
        fromId: side.id,
        toId: contractNode.id,
        relation: "party_to",
        dataRoomItemId: item.id,
        sourceQuote: spec.partyQuote,
      });
    }
    await legal.link(actor, {
      fromId: contractNode.id,
      toId: place.id,
      relation: "governed_by",
      dataRoomItemId: item.id,
    });
  }
  // The scan read every other document too and found it is not a legal one.
  for (const item of items) {
    if (item.status !== "ready" || recorded.has(item.id)) continue;
    await legal.upsertContract(actor, {
      dataRoomItemId: item.id,
      revision: item.revision,
      title: item.name,
      contractType: LEGAL_NOT_LEGAL_TYPE,
      status: "unknown",
    });
  }
  for (const manual of DEMO_LEGAL.manualDeadlines) {
    await legal.upsertDeadline(actor, {
      title: manual.title,
      dueDate: dayFromToday(manual.dueInDays),
      kind: manual.kind,
      notes: `${MOCK_NOTE}: added by hand.`,
    });
  }
  // The finished daily scan, so the page shows when Legal last looked.
  const bot = await prisma.bot.findFirstOrThrow({
    where: { ...scope, spawnKey: legalAgentSpawnKey(actor.userId) },
    include: { thread: true },
  });
  const threadId = bot.thread?.id;
  if (!threadId) throw new Error("The Legal agent has no thread");
  const routine = await prisma.routine.findFirstOrThrow({
    where: { ...scope, botId: bot.id, name: LEGAL_SCAN_ROUTINE_NAME },
  });
  const finished = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const task = await prisma.task.create({
    data: { ...scope, botId: bot.id, threadId, prompt: routine.prompt, status: "completed" },
  });
  await prisma.run.create({
    data: {
      ...scope,
      botId: bot.id,
      threadId,
      taskId: task.id,
      status: "completed",
      trigger: "routine",
      routineId: routine.id,
      startedAt: new Date(finished.getTime() - 2 * 60 * 1000),
      completedAt: finished,
    },
  });
  return `Legal: ${DEMO_LEGAL.contracts.length} contracts, ${DEMO_LEGAL.manualDeadlines.length} hand-made deadlines, graph, 1 finished scan`;
}
