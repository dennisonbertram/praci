import type { AdapterContext, ManagedConnectorProvider } from "@rakazo/adapter-kit";
import { describe, expect, it } from "vitest";
import {
  DRIVE_IMPORT_MAX_DEPTH,
  DRIVE_IMPORT_MAX_FILES,
  planDriveFolders,
} from "./data-room-drive-import.js";
import type { EmulatedDriveFile } from "./drive-api-emulator.js";
import { DriveApiEmulator } from "./drive-api-emulator.js";
import type { DriveFilesDeps } from "./drive-files.js";
import { DriveFileError } from "./drive-files.js";
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
  planDriveFolders(deps, context, { connectionId: "conn-a", folderIds });

describe("planDriveFolders", () => {
  it("lists every subfolder, keeps empty folders, plans large files and skips what cannot be imported", async () => {
    const deps = setup([
      folder("top", "Deals"),
      folder("sub", "2026", "top"),
      folder("empty", "Empty", "sub"),
      pdf("a", "a.pdf", "top"),
      pdf("b", "b.pdf", "sub"),
      pdf("huge", "huge.pdf", "sub", { size: "50000000000" }),
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
      ["huge", 1],
    ]);
    // The Form and the shortcut; size never skips a file.
    expect(result.skipped).toBe(2);
  });

  it("never nests deeper than the limit: a 10-level chain keeps the rest in the name", async () => {
    const chain: EmulatedDriveFile[] = [folder("d1", "L1")];
    for (let i = 2; i <= 10; i++) chain.push(folder(`d${i}`, `L${i}`, `d${i - 1}`));
    const result = await plan(setup([...chain, pdf("f", "f.pdf", "d10")]), ["d1"]);
    const depth = (index: number): number => {
      const parent = result.folders[index]?.parent;
      return parent === null || parent === undefined ? 1 : depth(parent) + 1;
    };
    expect(result.folders).toHaveLength(10);
    expect(Math.max(...result.folders.map((_, i) => depth(i)))).toBe(DRIVE_IMPORT_MAX_DEPTH);
    expect(result.folders.slice(0, DRIVE_IMPORT_MAX_DEPTH).map((f) => f.name)).toEqual(
      Array.from({ length: DRIVE_IMPORT_MAX_DEPTH }, (_, i) => `L${i + 1}`),
    );
    expect(result.folders[8]).toEqual({ name: "L8 > L9", parent: 6 });
    expect(result.folders[9]).toEqual({ name: "L8 > L9 > L10", parent: 6 });
    expect(result.files).toEqual([{ id: "f", folder: 9 }]);
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

  it("keeps a selected subfolder nested under its selected parent, imported once", async () => {
    const deps = setup([
      folder("top", "Top"),
      folder("kid", "Kid", "top"),
      pdf("a", "a.pdf", "kid"),
    ]);
    for (const order of [
      ["top", "kid"],
      ["kid", "top"],
    ]) {
      const result = await plan(deps, order);
      expect(result.folders).toEqual([
        { name: "Top", parent: null },
        { name: "Kid", parent: 0 },
      ]);
      expect(result.files).toEqual([{ id: "a", folder: 1 }]);
    }
  });

  it("never gives distinct sibling Drive folders one name", async () => {
    const deps = setup([
      folder("top", "Top"),
      folder("x", "a/b", "top"),
      folder("y", "a_b", "top"),
      folder("z", "a_b (2)", "top"),
      pdf("f", "f.pdf", "y"),
    ]);
    const result = await plan(deps, ["top"]);
    const names = result.folders.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.slice(1).sort()).toEqual(["a_b", "a_b (2)", "a_b (2) (2)"].sort());
    // Planning twice gives the same names, so a re-import reuses the same folders.
    expect((await plan(deps, ["top"])).folders).toEqual(result.folders);
    // Two selected roots with the same name stay separate too.
    const roots = await plan(setup([folder("r1", "Same"), folder("r2", "Same")]), ["r1", "r2"]);
    expect(roots.folders.map((f) => f.name)).toEqual(["Same", "Same (2)"]);
  });

  it("accepts exactly the limit and refuses one more", async () => {
    const files = (n: number) =>
      Array.from({ length: n }, (_, i) => pdf(`f${i}`, `f${i}.pdf`, "top"));
    const ok = await plan(setup([folder("top", "Big"), ...files(DRIVE_IMPORT_MAX_FILES)]), ["top"]);
    expect(ok.files).toHaveLength(DRIVE_IMPORT_MAX_FILES);
    await expect(
      plan(setup([folder("top", "Big"), ...files(DRIVE_IMPORT_MAX_FILES + 1)]), ["top"]),
    ).rejects.toMatchObject({ code: "too_many" });
  });

  it("counts a direct pick with the folder files against the limit, once per file", async () => {
    const files = Array.from({ length: DRIVE_IMPORT_MAX_FILES }, (_, i) =>
      pdf(`f${i}`, `f${i}.pdf`, "top"),
    );
    const deps = setup([folder("top", "Big"), ...files, { ...pdf("extra", "e.pdf", "other") }]);
    const run = (directFileIds: string[]) =>
      planDriveFolders(deps, context, {
        connectionId: "conn-a",
        folderIds: ["top"],
        directFileIds,
      });
    await expect(run(["extra"])).rejects.toMatchObject({ code: "too_many" });
    // A direct pick that is also in the folder is one file.
    const result = await run(["f0"]);
    expect(result.files).toHaveLength(DRIVE_IMPORT_MAX_FILES);
  });

  it("files a direct pick inside a selected folder in that folder, and others in the target", async () => {
    const deps = setup([
      folder("top", "Top"),
      folder("kid", "Kid", "top"),
      pdf("in", "in.pdf", "kid"),
      pdf("out", "out.pdf", "elsewhere"),
    ]);
    const result = await planDriveFolders(deps, context, {
      connectionId: "conn-a",
      folderIds: ["top"],
      directFileIds: ["in", "out"],
    });
    expect(result.files).toEqual([
      { id: "in", folder: 1 },
      { id: "out", folder: null },
    ]);
  });

  it("bounds how many entries it scans, even when none can be imported", async () => {
    const forms = Array.from({ length: 120 }, (_, i) => ({
      id: `frm${i}`,
      name: `Form ${i}`,
      mimeType: "application/vnd.google-apps.form",
      parents: ["top"],
    }));
    const deps = setup([folder("top", "Forms"), ...forms]);
    const error = await planDriveFolders(deps, context, {
      connectionId: "conn-a",
      folderIds: ["top"],
      maxScanned: 60,
    }).catch((e) => e);
    expect(error).toMatchObject({
      code: "too_many",
      message: "Folder imports are limited to 60 items.",
    });
  });
});
