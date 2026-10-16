import type { AdapterContext, ManagedConnectorProvider } from "@rakazo/adapter-kit";
import { describe, expect, it } from "vitest";
import { DriveApiEmulator, type EmulatedDriveFile } from "./drive-api-emulator.js";
import {
  DriveFileError,
  type DriveFilesDeps,
  downloadDriveFile,
  listDriveFiles,
} from "./drive-files.js";
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

function setup(files: EmulatedDriveFile[], ignoreMaxBytes = false) {
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
    proxy: async (r: { accountRef: string; url: string; method: string; maxBytes?: number }) => {
      const response = emulator.handle(r.accountRef, r.url, r.method);
      return response.data instanceof Uint8Array &&
        r.maxBytes &&
        !ignoreMaxBytes &&
        response.data.byteLength > r.maxBytes
        ? { status: 413, data: {} }
        : response;
    },
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

describe("downloadDriveFile", () => {
  const files: EmulatedDriveFile[] = [
    { id: "doc1", name: "Roadmap", mimeType: DOC, pdf: PDF },
    { id: "pdf1", name: "scan.pdf", mimeType: "application/pdf", bytes: PDF },
    { id: "form1", name: "Survey", mimeType: "application/vnd.google-apps.form" },
    { id: "dir1", name: "Folder", mimeType: "application/vnd.google-apps.folder" },
  ];

  it("exports a Google Doc as PDF bytes with a .pdf name", async () => {
    const { deps } = setup(files);
    const result = await downloadDriveFile(deps, context, "doc1", { maxBytes: 10_000 });
    expect(result).toMatchObject({ name: "Roadmap.pdf", mimeType: "application/pdf" });
    expect(Array.from(result.bytes)).toEqual(Array.from(PDF));
    expect(result.webViewLink).toContain("doc1");
  });

  it("downloads a regular file byte for byte and keeps its name", async () => {
    const { deps } = setup(files);
    const result = await downloadDriveFile(deps, context, "pdf1", { maxBytes: 10_000 });
    expect(result.name).toBe("scan.pdf");
    expect(Array.from(result.bytes)).toEqual(Array.from(PDF));
  });

  it("rejects a file over the cap, whether the size is known, the connector enforces it, or neither", async () => {
    expect(
      await code(downloadDriveFile(setup(files).deps, context, "pdf1", { maxBytes: 100 })),
    ).toBe("too_large");
    // Google-native: size is unknown, so the connector's 413 is what stops it.
    expect(
      await code(downloadDriveFile(setup(files).deps, context, "doc1", { maxBytes: 100 })),
    ).toBe("too_large");
    expect(
      await code(downloadDriveFile(setup(files, true).deps, context, "doc1", { maxBytes: 100 })),
    ).toBe("too_large");
  });

  it("refuses Google files that have no content", async () => {
    const { deps } = setup(files);
    expect(await code(downloadDriveFile(deps, context, "form1", { maxBytes: 10_000 }))).toBe(
      "unsupported",
    );
    expect(await code(downloadDriveFile(deps, context, "dir1", { maxBytes: 10_000 }))).toBe(
      "unsupported",
    );
    expect(await code(downloadDriveFile(deps, context, "missing", { maxBytes: 10_000 }))).toBe(
      "not_found",
    );
  });

  it("imports a Doc whose source size is large but whose PDF is small", async () => {
    const { deps } = setup([{ id: "big", name: "Big", mimeType: DOC, size: "5000000", pdf: PDF }]);
    const result = await downloadDriveFile(deps, context, "big", { maxBytes: 10_000 });
    expect(result.bytes.byteLength).toBe(PDF.byteLength);
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
        downloadDriveFile({ ...deps, connectors: { managed: () => limited } }, context, "pdf1", {
          maxBytes: 10_000,
        }),
      ),
    ).toBe("rate_limited");
  });

  it("only uses the caller's own connection", async () => {
    const { deps } = setup(files);
    expect(
      await code(
        downloadDriveFile(deps, context, "secret", { maxBytes: 10_000, connectionId: "conn-b" }),
      ),
    ).toBe("not_connected");
    expect(
      await code(
        downloadDriveFile(deps, { ...context, spaceId: "space-2" }, "pdf1", { maxBytes: 10_000 }),
      ),
    ).toBe("not_connected");
    expect(await code(downloadDriveFile(deps, context, "secret", { maxBytes: 10_000 }))).toBe(
      "not_found",
    );
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
