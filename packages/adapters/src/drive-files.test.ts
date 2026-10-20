import type { AdapterContext, ManagedConnectorProvider } from "@rakazo/adapter-kit";
import { describe, expect, it } from "vitest";
import type { EmulatedDriveFile } from "./drive-api-emulator.js";
import { DriveApiEmulator, emulatedDriveStream } from "./drive-api-emulator.js";
import type { DriveFilesDeps } from "./drive-files.js";
import { DriveFileError, listDriveFiles, streamDriveFile } from "./drive-files.js";
import { GoogleApiClient } from "./google-api-request.js";

const context: AdapterContext = {
  operationId: "op",
  traceId: "trace",
  spaceId: "space-1",
  userId: "user-1",
  signal: new AbortController().signal,
} as AdapterContext;

const DOC = "application/vnd.google-apps.document";
// %PDF-1.7 then bytes that are not valid UTF-8, plus every byte value.
const PDF = new Uint8Array([
  0x25,
  0x50,
  0x44,
  0x46,
  0x2d,
  0x31,
  0x2e,
  0x37,
  0xff,
  0xfe,
  0x80,
  ...Array.from({ length: 256 }, (_, i) => i),
]);

const rows = [
  { id: "conn-a", spaceId: "space-1", userId: "user-1", providerRef: "acct-a", displayName: "Ann" },
  { id: "conn-b", spaceId: "space-1", userId: "user-2", providerRef: "acct-b", displayName: "Bob" },
].map((row) => ({
  ...row,
  connectorId: "google",
  provider: "googledrive",
  status: "connected",
  createdAt: 0,
  metadata: null,
}));

const readAll = async (stream: ReadableStream<Uint8Array>) =>
  new Uint8Array(await new Response(stream).arrayBuffer());

function setup(files: EmulatedDriveFile[]) {
  const emulator = new DriveApiEmulator({
    accounts: {
      "acct-a": { email: "ann@example.test", files },
      "acct-b": {
        email: "bob@example.test",
        files: [{ id: "secret", name: "bob.txt", mimeType: "text/plain" }],
      },
    },
  });
  const connector = {
    proxy: async (r: { accountRef: string; url: string; method: string; responseType?: string }) =>
      emulatedDriveStream(emulator.handle(r.accountRef, r.url, r.method), r.responseType),
  } as unknown as ManagedConnectorProvider;
  const deps: DriveFilesDeps = {
    prisma: {
      connection: {
        findMany: async ({ where }: { where: Record<string, unknown> }) =>
          rows.filter((row) =>
            Object.entries(where).every(([k, v]) => (row as Record<string, unknown>)[k] === v),
          ),
      },
    } as never,
    connectors: { managed: () => connector },
    google: new GoogleApiClient({ sleep: async () => undefined, random: () => 0 }),
  };
  return { deps, emulator };
}

const code = (promise: Promise<unknown>) =>
  promise.then(
    () => "no error",
    (error) => (error instanceof DriveFileError ? error.code : String(error)),
  );

describe("streamDriveFile", () => {
  const files: EmulatedDriveFile[] = [
    { id: "doc1", name: "Roadmap", mimeType: DOC, pdf: PDF },
    { id: "pdf1", name: "scan.pdf", mimeType: "application/pdf", bytes: PDF },
    { id: "form1", name: "Survey", mimeType: "application/vnd.google-apps.form" },
    { id: "dir1", name: "Folder", mimeType: "application/vnd.google-apps.folder" },
  ];

  it("exports a Google Doc as a PDF stream with a .pdf name", async () => {
    const { deps } = setup(files);
    const result = await streamDriveFile(deps, context, "doc1");
    expect(result).toMatchObject({ name: "Roadmap.pdf", mimeType: "application/pdf" });
    expect(Array.from(await readAll(result.stream))).toEqual(Array.from(PDF));
    expect(result.webViewLink).toContain("doc1");
  });

  it("streams a regular file byte for byte and keeps its name and size", async () => {
    const { deps } = setup(files);
    const result = await streamDriveFile(deps, context, "pdf1");
    expect(result.name).toBe("scan.pdf");
    expect(result.size).toBe(PDF.byteLength);
    expect(Array.from(await readAll(result.stream))).toEqual(Array.from(PDF));
  });

  it("has no size limit: a file larger than 50 MB is handed back as a stream", async () => {
    const big = new Uint8Array(60 * 1024 * 1024);
    const { deps } = setup([
      { id: "big", name: "big.bin", mimeType: "application/octet-stream", bytes: big },
    ]);
    const result = await streamDriveFile(deps, context, "big");
    expect(result.size).toBe(big.byteLength);
    let total = 0;
    let largest = 0;
    for await (const chunk of result.stream as unknown as AsyncIterable<Uint8Array>) {
      total += chunk.byteLength;
      largest = Math.max(largest, chunk.byteLength);
    }
    expect(total).toBe(big.byteLength);
    expect(largest).toBeLessThanOrEqual(64 * 1024);
  });

  it("asks the connector for a stream and maps Drive's export limit to too_large", async () => {
    const { deps } = setup(files);
    const seen: Array<string | undefined> = [];
    const refusing = {
      proxy: async (r: { url: string; responseType?: string }) => {
        seen.push(r.responseType);
        return r.url.includes("/export")
          ? { status: 413, data: {} }
          : { status: 200, data: { id: "doc1", name: "Big", mimeType: DOC } };
      },
    } as unknown as ManagedConnectorProvider;
    expect(
      await code(
        streamDriveFile({ ...deps, connectors: { managed: () => refusing } }, context, "doc1"),
      ),
    ).toBe("too_large");
    expect(seen).toEqual([undefined, "stream"]);
  });

  it("fails clearly when the connector cannot stream", async () => {
    const { deps } = setup(files);
    const buffering = {
      proxy: async () => ({ status: 200, data: { id: "pdf1", name: "scan.pdf", mimeType: "x/y" } }),
    } as unknown as ManagedConnectorProvider;
    expect(
      await code(
        streamDriveFile({ ...deps, connectors: { managed: () => buffering } }, context, "pdf1"),
      ),
    ).toBe("failed");
  });

  it("refuses Google files that have no content", async () => {
    const { deps } = setup(files);
    expect(await code(streamDriveFile(deps, context, "form1"))).toBe("unsupported");
    expect(await code(streamDriveFile(deps, context, "dir1"))).toBe("unsupported");
    expect(await code(streamDriveFile(deps, context, "missing"))).toBe("not_found");
  });

  it("maps a 403 userRateLimitExceeded to rate_limited", async () => {
    const { deps } = setup(files);
    const limited = {
      proxy: async () => ({
        status: 403,
        data: { error: { errors: [{ reason: "userRateLimitExceeded" }] } },
      }),
    } as unknown as ManagedConnectorProvider;
    expect(
      await code(
        streamDriveFile({ ...deps, connectors: { managed: () => limited } }, context, "pdf1"),
      ),
    ).toBe("rate_limited");
  });

  it("only uses the caller's own connection", async () => {
    const { deps } = setup(files);
    expect(await code(streamDriveFile(deps, context, "secret", { connectionId: "conn-b" }))).toBe(
      "not_connected",
    );
    expect(await code(streamDriveFile(deps, { ...context, spaceId: "space-2" }, "pdf1"))).toBe(
      "not_connected",
    );
    expect(await code(streamDriveFile(deps, context, "secret"))).toBe("not_found");
  });
});

describe("listDriveFiles", () => {
  const files: EmulatedDriveFile[] = [
    { id: "dir1", name: "Contracts", mimeType: "application/vnd.google-apps.folder" },
    {
      id: "a",
      name: "Bob's \\ plan.pdf",
      mimeType: "application/pdf",
      bytes: PDF,
      parents: ["dir1"],
    },
    { id: "b", name: "root.txt", mimeType: "text/plain", text: "x" },
    { id: "gone", name: "trashed", mimeType: "text/plain", trashed: true },
  ];

  it("lists the root with folders and maps fields", async () => {
    const { deps } = setup(files);
    const { files: found } = await listDriveFiles(deps, context);
    expect(found.map((f) => f.id)).toEqual(["dir1", "b"]);
    expect(found[0]).toMatchObject({
      isFolder: true,
      webViewLink: expect.stringContaining("dir1"),
    });
    expect(found[1]).toMatchObject({ isFolder: false, modifiedTime: "2026-10-01T12:00:00.000Z" });
  });

  it("browses a folder and pages", async () => {
    const { deps } = setup(files);
    expect(
      (await listDriveFiles(deps, context, { folderId: "dir1" })).files.map((f) => f.id),
    ).toEqual(["a"]);
  });

  it("escapes quotes and backslashes in the search", async () => {
    const { deps, emulator } = setup(files);
    const { files: found } = await listDriveFiles(deps, context, { query: "Bob's \\ plan" });
    expect(found.map((f) => f.id)).toEqual(["a"]);
    expect(found[0]?.size).toBe(PDF.byteLength);
    const q = new URL(emulator.requests.at(-1)?.url ?? "").searchParams.get("q");
    expect(q).toBe(String.raw`trashed = false and name contains 'Bob\'s \\ plan'`);
  });
});
