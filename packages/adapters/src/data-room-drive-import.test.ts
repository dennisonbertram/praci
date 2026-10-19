import type { AdapterContext, ManagedConnectorProvider } from "@rakazo/adapter-kit";
import { describe, expect, it } from "vitest";
import {
  DRIVE_IMPORT_MAX_DEPTH,
  DRIVE_IMPORT_MAX_FILES,
  planDriveFolders,
} from "./data-room-drive-import.js";
import { DriveApiEmulator, type EmulatedDriveFile } from "./drive-api-emulator.js";
import { DriveFileError, type DriveFilesDeps } from "./drive-files.js";
import { GoogleApiClient } from "./google-api-request.js";

const context = {
  operationId: "op",
  traceId: "trace",
  spaceId: "space-1",
  userId: "user-1",
  signal: new AbortController().signal,
} as AdapterContext;

const FOLDER = "application/vnd.google-apps.folder";
const folder = (id: string, name: string, parent?: string): EmulatedDriveFile => ({
  id,
  name,
  mimeType: FOLDER,
  ...(parent ? { parents: [parent] } : {}),
});
const pdf = (id: string, name: string, parent: string, extra = {}): EmulatedDriveFile => ({
  id,
  name,
  mimeType: "application/pdf",
  size: "10",
  parents: [parent],
  ...extra,
});

function setup(files: EmulatedDriveFile[]) {
  const emulator = new DriveApiEmulator({
    accounts: { "acct-a": { email: "a@example.test", files } },
  });
  const connector = {
    proxy: async (r: { accountRef: string; url: string; method: string }) =>
      emulator.handle(r.accountRef, r.url, r.method),
  } as unknown as ManagedConnectorProvider;
  const row = {
    id: "conn-a",
    spaceId: "space-1",
    userId: "user-1",
    providerRef: "acct-a",
    displayName: "Ann",
    connectorId: "google",
    provider: "googledrive",
    status: "connected",
    createdAt: 0,
    metadata: null,
  };
  const deps: DriveFilesDeps = {
    prisma: {
      connection: {
        findMany: async ({ where }: { where: Record<string, unknown> }) =>
          [row].filter((r) =>
            Object.entries(where).every(([k, v]) => (r as Record<string, unknown>)[k] === v),
          ),
      },
    } as never,
    connectors: { managed: () => connector },
    google: new GoogleApiClient({ sleep: async () => undefined, random: () => 0 }),
  };
  return deps;
}
const plan = (deps: DriveFilesDeps, folderIds: string[]) =>
  planDriveFolders(deps, context, { connectionId: "conn-a", folderIds, maxBytes: 1000 });

describe("planDriveFolders", () => {
  it("lists every subfolder, keeps empty folders and skips what cannot be imported", async () => {
    const deps = setup([
      folder("top", "Deals"),
      folder("sub", "2026", "top"),
      folder("empty", "Empty", "sub"),
      pdf("a", "a.pdf", "top"),
      pdf("b", "b.pdf", "sub"),
      pdf("huge", "huge.pdf", "sub", { size: "5000" }),
      {
        id: "form",
        name: "Survey",
        mimeType: "application/vnd.google-apps.form",
        parents: ["sub"],
      },
      {
        id: "link",
        name: "Shortcut",
        mimeType: "application/vnd.google-apps.shortcut",
        parents: ["top"],
      },
      {
        id: "doc",
        name: "Memo",
        mimeType: "application/vnd.google-apps.document",
        parents: ["top"],
      },
    ]);
    const result = await plan(deps, ["top"]);
    expect(result.folders).toEqual([
      { name: "Deals", parent: null },
      { name: "2026", parent: 0 },
      { name: "Empty", parent: 1 },
    ]);
    expect(result.files.map((f) => [f.id, f.folder]).sort()).toEqual([
      ["a", 0],
      ["b", 1],
      ["doc", 0],
    ]);
    // The oversized file, the Form and the shortcut.
    expect(result.skipped).toBe(3);
  });

  it("puts folders deeper than the limit in the deepest allowed ancestor, with the rest of the path in the name", async () => {
    const chain: EmulatedDriveFile[] = [folder("d1", "L1")];
    for (let i = 2; i <= DRIVE_IMPORT_MAX_DEPTH + 2; i++)
      chain.push(folder(`d${i}`, `L${i}`, `d${i - 1}`));
    const deepest = `d${DRIVE_IMPORT_MAX_DEPTH + 2}`;
    const result = await plan(setup([...chain, pdf("f", "f.pdf", deepest)]), ["d1"]);
    const last = result.folders.length - 1;
    expect(result.folders).toHaveLength(DRIVE_IMPORT_MAX_DEPTH + 2);
    expect(result.folders[DRIVE_IMPORT_MAX_DEPTH - 1]).toEqual({
      name: `L${DRIVE_IMPORT_MAX_DEPTH}`,
      parent: DRIVE_IMPORT_MAX_DEPTH - 2,
    });
    expect(result.folders[DRIVE_IMPORT_MAX_DEPTH]).toEqual({
      name: `L${DRIVE_IMPORT_MAX_DEPTH + 1}`,
      parent: DRIVE_IMPORT_MAX_DEPTH - 1,
    });
    expect(result.folders[last]).toEqual({
      name: `L${DRIVE_IMPORT_MAX_DEPTH + 1} > L${DRIVE_IMPORT_MAX_DEPTH + 2}`,
      parent: DRIVE_IMPORT_MAX_DEPTH - 1,
    });
    expect(result.files).toEqual([{ id: "f", folder: last }]);
  });

  it("replaces path separators in folder names", async () => {
    const result = await plan(setup([folder("top", "Q1/Q2")]), ["top"]);
    expect(result.folders).toEqual([{ name: "Q1_Q2", parent: null }]);
  });

  it("refuses over the file limit with a one-sentence error", async () => {
    const files = Array.from({ length: DRIVE_IMPORT_MAX_FILES + 1 }, (_, i) =>
      pdf(`f${i}`, `f${i}.pdf`, "top"),
    );
    const error = await plan(setup([folder("top", "Big"), ...files]), ["top"]).catch((e) => e);
    expect(error).toBeInstanceOf(DriveFileError);
    expect(error).toMatchObject({
      code: "too_many",
      message: `Folder imports are limited to ${DRIVE_IMPORT_MAX_FILES} files.`,
    });
  });

  it("counts a non-folder id as skipped and lists a file once when it is reachable twice", async () => {
    const deps = setup([folder("top", "A"), pdf("x", "x.pdf", "top"), pdf("solo", "s.pdf", "top")]);
    const result = await plan(deps, ["top", "x", "top"]);
    expect(result.files.map((f) => f.id).sort()).toEqual(["solo", "x"]);
    expect(result.skipped).toBe(1);
  });
});
