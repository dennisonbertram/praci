import { generateKeyPairSync, randomUUID } from "node:crypto";
import { createSecretStore, syncFinanceForUser } from "@rakazo/adapters";
import { CARTA_MCP_ENDPOINT, FINANCE_MCP_ENDPOINTS } from "@rakazo/contracts";
import { createDb, createThreadMessage, saveCapTableSnapshot } from "@rakazo/db";
import { makePdf } from "../../../../adapters/src/data-room-test-fakes.js";
import {
  DEMO_BOTS,
  DEMO_CAP_TABLE,
  DEMO_CHIEF_DRAFT,
  DEMO_COFOUNDER,
  DEMO_COMPANY,
  DEMO_CONTACTS,
  DEMO_DOCUMENT_FACETS,
  DEMO_DOCUMENTS,
  DEMO_EMPTY_SPACE,
  DEMO_ENS_WALLET,
  DEMO_GROUP,
  DEMO_READING_DOCUMENT,
  DEMO_RATE_LIMIT_SPACE,
  DEMO_FINANCE_RECONNECT_SPACE,
  DEMO_RECONNECT_SPACE,
  DEMO_USER_NAME,
  DEMO_WALLET,
  demoCryptoHistory,
  demoFinance,
  demoFolderPaths,
  demoStatementCsv,
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
        name: "Carta (MOCK DEMO)",
        transport: "streamable_http",
        endpoint: CARTA_MCP_ENDPOINT,
        secretId: await fakeLogin(),
      },
    });
    // Without a model the Carta agent could never have read Carta, so there is no snapshot.
    if (!options.noModel) await saveCapTableSnapshot(prisma, scope, DEMO_CAP_TABLE);
    await session.rpc("carta/agent");
    done.push(
      `Carta (mock login; its tools reach only the emulator), ${options.noModel ? "no cap table read yet" : "mock cap table"}, Carta agent`,
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
    // run-out date in a reply without a live (paid) model call.
    if (overview.runway.months !== null && overview.runway.runOutDate) {
      const runOut = new Date(`${overview.runway.runOutDate}T00:00:00Z`).toLocaleDateString(
        "en-US",
        { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" },
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

  // Artifacts: last month's investor update, filed under Chief.
  await session.rpc("artifacts/create", {
    botId: chief.id,
    name: DEMO_CHIEF_DRAFT.name,
    mimeType: DEMO_CHIEF_DRAFT.mimeType,
    contentBase64: Buffer.from(DEMO_CHIEF_DRAFT.text).toString("base64"),
  });
  done.push("Chief's investor update draft");

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
  done.push(`${DEMO_BOTS.length} extra bots, 1 group chat (${MOCK_NOTE})`);

  // A second, empty space: what a founder sees before connecting anything (switch to it to test).
  await session.rpc("spaces/create", { name: DEMO_EMPTY_SPACE });
  done.push(`empty space "${DEMO_EMPTY_SPACE}"`);

  // Spaces whose Gmail is broken: the demo's emulator answers 401 (sign-in lapsed, so the Inbox
  // shows Reconnect) or 429 (rate limited) for each one's first account.
  for (const [name, label, what] of [
    [DEMO_RECONNECT_SPACE, "Old mail (Mock)", "needs reconnecting"],
    [DEMO_RATE_LIMIT_SPACE, "Busy mail (Mock)", "is rate-limited"],
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
  return done;
}
