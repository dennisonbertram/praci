import type { ConnectorProxyRequest, ManagedConnectorProvider } from "@rakazo/adapter-kit";
import type { EmulatedMessage } from "@rakazo/adapters";
import { createMailProvider, GmailApiEmulator } from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { mountInboxAttachment } from "./inbox-attachment.js";

const actor = (userId: string): Actor => ({
  userId,
  spaceId: "space-1",
  email: `${userId}@rakazo.test`,
  isDeploymentOwner: false,
});

const connection = (id: string, userId: string, ref: string, spaceId = "space-1") => ({
  id,
  spaceId,
  userId,
  connectorId: "emulator",
  provider: "gmail",
  providerRef: ref,
  displayName: ref,
  status: "connected",
  metadata: { mailAddress: `${ref}@example.test` },
  createdAt: new Date(0),
});
const connections = [
  connection("conn-a", "user-1", "box-a"),
  connection("conn-b", "user-2", "box-b"),
  connection("conn-c", "user-1", "box-c", "space-2"),
];
const cached = [
  { id: "row-a", spaceId: "space-1", userId: "user-1", connectionId: "conn-a", providerMessageId: "m1" },
  { id: "row-b", spaceId: "space-1", userId: "user-2", connectionId: "conn-b", providerMessageId: "m1" },
  { id: "row-c", spaceId: "space-2", userId: "user-1", connectionId: "conn-c", providerMessageId: "m1" },
];
type Where = Record<string, unknown>;
const matches = (row: Where, where: Where) => Object.entries(where).every(([k, v]) => row[k] === v);
const prisma = {
  connection: { findMany: async ({ where }: { where: Where }) => connections.filter((c) => matches(c, where)) },
  cachedMailMessage: { findFirst: async ({ where }: { where: Where }) => cached.find((c) => matches(c, where)) ?? null },
};

const message = (attachments: EmulatedMessage["attachments"]): EmulatedMessage => ({
  id: "m1",
  date: new Date().toISOString(),
  labels: ["INBOX"],
  from: "Ann <ann@example.test>",
  to: "me@example.test",
  subject: "Files",
  text: "See files",
  attachments,
});

const EVIL = '..\\/"evil"\r\nX-Injected: 1.svg';
const files = [
  { filename: "report.txt", mimeType: "text/plain", size: 0, data: Buffer.from("hello").toString("base64") },
  { filename: EVIL, mimeType: "image/svg+xml", size: 0, data: Buffer.from("<svg onload=alert(1)/>").toString("base64") },
  { filename: "page.html", mimeType: "text/html", size: 0, data: Buffer.from("<script>1</script>").toString("base64") },
  { filename: "résumé.pdf", mimeType: "application/pdf", size: 0, data: Buffer.from("%PDF").toString("base64") },
  { filename: "huge.bin", mimeType: "application/octet-stream", size: 30_000_000 },
];

describe("GET /api/inbox/messages/:messageId/attachments/:attachmentId", () => {
  let gmail: GmailApiEmulator;
  let app: Hono;
  let signedIn: Actor | null;
  let ids: Record<string, string>;

  const get = (messageId: string, attachmentId: string) =>
    app.request(`/api/inbox/messages/${messageId}/attachments/${encodeURIComponent(attachmentId)}`);

  beforeEach(async () => {
    signedIn = actor("user-1");
    gmail = new GmailApiEmulator({
      mailboxes: {
        "box-a": { address: "box-a@example.test", messages: [message(files)] },
        "box-b": { address: "box-b@example.test", messages: [message(files)] },
        "box-c": { address: "box-c@example.test", messages: [message(files)] },
      },
    });
    const connector = {
      proxy: async (request: ConnectorProxyRequest) => gmail.handle(request.accountRef, request.url),
    } as unknown as ManagedConnectorProvider;
    const mail = createMailProvider({
      prisma: prisma as never,
      connectors: { managed: () => connector },
    });
    app = new Hono();
    mountInboxAttachment(app, { prisma: prisma as never, mail }, async () => signedIn);
    const opened = await mail.getMessage(
      (await mail.listAccounts({ spaceId: "space-1", userId: "user-1" }, {
        operationId: "t", traceId: "t", spaceId: "space-1", userId: "user-1", signal: new AbortController().signal,
      }))[0]!,
      "m1",
      { operationId: "t", traceId: "t", spaceId: "space-1", userId: "user-1", signal: new AbortController().signal },
    );
    ids = Object.fromEntries(opened.attachments.map((a) => [a.filename, a.id]));
    gmail.requests.length = 0;
  });

  it("streams the bytes of the caller's own attachment as a forced download", async () => {
    const response = await get("row-a", ids["report.txt"]!);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("hello");
    expect(response.headers.get("content-type")).toBe("text/plain");
    expect(response.headers.get("content-length")).toBe("5");
    expect(response.headers.get("content-disposition")).toBe(
      `attachment; filename="report.txt"; filename*=UTF-8''report.txt`,
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-security-policy")).toBe("sandbox; default-src 'none'");
  });

  it("never serves HTML or SVG as a renderable type and keeps the filename header safe", async () => {
    for (const name of ["page.html", EVIL]) {
      const response = await get("row-a", ids[name]!);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("application/octet-stream");
      const disposition = response.headers.get("content-disposition") ?? "";
      expect(disposition.startsWith("attachment; ")).toBe(true);
      expect(disposition).not.toMatch(/[\r\n\\/]/);
      expect(disposition).not.toContain("X-Injected");
      expect(disposition.match(/"/g)).toHaveLength(2);
    }
  });

  it("gives non-ASCII names an ASCII fallback and an encoded filename*", async () => {
    const response = await get("row-a", ids["résumé.pdf"]!);
    expect(response.headers.get("content-disposition")).toBe(
      `attachment; filename="r_sum_.pdf"; filename*=UTF-8''r%C3%A9sum%C3%A9.pdf`,
    );
  });

  it("answers 401 without a session and fetches nothing", async () => {
    signedIn = null;
    expect((await get("row-a", ids["report.txt"]!)).status).toBe(401);
    expect(gmail.requests).toEqual([]);
  });

  it("answers 404 for another user's message, another space's message and unknown ids", async () => {
    for (const [messageId, attachmentId] of [
      ["row-b", ids["report.txt"]!],
      ["row-c", ids["report.txt"]!],
      ["no-such-row", ids["report.txt"]!],
      ["row-a", "99"],
    ] as const) {
      const response = await get(messageId, attachmentId);
      expect(response.status, `${messageId}/${attachmentId}`).toBe(404);
      expect(response.headers.get("content-disposition")).toBeNull();
    }
    expect(gmail.requests.some((r) => r.url.includes("/attachments/"))).toBe(false);
  });

  it("answers 413 for an attachment over 25 MB without downloading it", async () => {
    const response = await get("row-a", ids["huge.bin"]!);
    expect(response.status).toBe(413);
    expect(response.headers.get("content-disposition")).toBeNull();
    expect(gmail.requests.some((r) => r.url.includes("/attachments/"))).toBe(false);
  });
});
