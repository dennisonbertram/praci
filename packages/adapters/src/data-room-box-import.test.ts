import { describe, expect, it } from "vitest";
import { BoxApiEmulator, type EmulatedBoxItem } from "./box-api-emulator.js";
import { BoxFileError, type BoxFilesDeps, downloadBoxFile, listBoxFiles } from "./box-files.js";
import { planBoxFolders } from "./data-room-box-import.js";
import { DRIVE_IMPORT_MAX_DEPTH } from "./data-room-drive-import.js";

const scope = { spaceId: "space-1", userId: "user-1", signal: new AbortController().signal };
const server = {
  id: "box-1",
  name: "Box",
  endpoint: "https://mcp.box.com",
  secretId: "s",
  spaceId: "space-1",
  userId: "user-1",
  enabled: true,
};

const folder = (id: string, name: string, parent?: string): EmulatedBoxItem => ({
  id,
  type: "folder",
  name,
  ...(parent ? { parent } : {}),
});
const file = (id: string, name: string, parent: string, extra = {}): EmulatedBoxItem => ({
  id,
  type: "file",
  name,
  parent,
  bytes: new TextEncoder().encode(`bytes of ${name}`),
  ...extra,
});

function setup(
  items: EmulatedBoxItem[],
  opts: { token?: string | null; servers?: unknown[] } = {},
) {
  const box = new BoxApiEmulator(items);
  const deps: BoxFilesDeps = {
    prisma: {
      mcpServer: {
        findMany: async ({ where }: { where: Record<string, unknown> }) =>
          (opts.servers ?? [server]).filter(
            (row) =>
              (row as typeof server).spaceId === where.spaceId &&
              (row as typeof server).userId === where.userId,
          ),
      },
    } as never,
    accessToken: async () => (opts.token === undefined ? "tok-1" : opts.token),
    fetch: box.fetch,
    sleep: async () => undefined,
  };
  return { box, deps };
}
const plan = (deps: BoxFilesDeps, folderIds: string[], extra = {}) =>
  planBoxFolders(deps, scope, { connectionId: "box-1", folderIds, maxBytes: 1000, ...extra });

describe("planBoxFolders", () => {
  it("keeps the folder structure, empty folders included, and skips folders' web links and big files", async () => {
    const { deps } = setup([
      folder("10", "Deals"),
      folder("11", "2026", "10"),
      folder("12", "Empty", "11"),
      file("20", "a.pdf", "10"),
      file("21", "b.pdf", "11"),
      file("22", "huge.pdf", "11", { size: 5000 }),
      { id: "30", type: "web_link", name: "Elsewhere", parent: "10" },
    ]);
    const result = await plan(deps, ["10"]);
    expect(result.folders).toEqual([
      { name: "Deals", parent: null },
      { name: "2026", parent: 0 },
      { name: "Empty", parent: 1 },
    ]);
    expect(result.files.map((f) => [f.id, f.folder]).sort()).toEqual([
      ["20", 0],
      ["21", 1],
    ]);
    // Only the oversized file is counted: the web link is never listed as an item at all.
    expect(result.skipped).toBe(1);
  });

  it("follows every page of a folder and handles several picked folders", async () => {
    const { deps, box } = setup([
      folder("10", "One"),
      folder("40", "Two"),
      ...Array.from({ length: 7 }, (_, i) => file(`${100 + i}`, `f${i}.txt`, "10")),
      file("200", "x.txt", "40"),
    ]);
    box.pageSize = 3;
    const result = await plan(deps, ["10", "40"]);
    expect(result.files).toHaveLength(8);
    expect(result.folders.map((f) => f.name)).toEqual(["One", "Two"]);
  });

  it("flattens folders nested deeper than the limit", async () => {
    const chain: EmulatedBoxItem[] = [folder("1", "L1")];
    for (let i = 2; i <= 10; i++) chain.push(folder(`${i}`, `L${i}`, `${i - 1}`));
    const { deps } = setup([...chain, file("99", "f.pdf", "10")]);
    const result = await plan(deps, ["1"]);
    const depth = (index: number): number => {
      const node = result.folders[index];
      return !node || node.parent === null ? 1 : 1 + depth(node.parent);
    };
    expect(Math.max(...result.folders.map((_, i) => depth(i)))).toBe(DRIVE_IMPORT_MAX_DEPTH);
    expect(result.folders.at(-1)?.name).toContain(" > ");
  });

  it("refuses an over-limit selection before anything is written", async () => {
    const { deps } = setup([folder("10", "Big"), file("20", "a", "10"), file("21", "b", "10")]);
    await expect(plan(deps, ["10"], { maxScanned: 2 })).rejects.toMatchObject({
      code: "too_many",
    });
  });

  it("counts picks that are not folders, and sends direct picks to the target", async () => {
    const { deps } = setup([
      folder("10", "Deals"),
      file("20", "a.pdf", "10"),
      file("21", "c.pdf", "0"),
    ]);
    const result = await plan(deps, ["10", "20", "404"], { directFileIds: ["21"] });
    expect(result.skipped).toBe(2);
    expect(result.files.find((f) => f.id === "21")?.folder).toBeNull();
  });

  it("asks to reconnect on a 401", async () => {
    const { deps, box } = setup([folder("10", "Deals")]);
    box.failWith = 401;
    await expect(plan(deps, ["10"])).rejects.toMatchObject({ code: "reconnect" });
  });
});

describe("Box account scoping", () => {
  it("never reaches another user's Box connection", async () => {
    const { deps, box } = setup([folder("10", "Deals")], {
      servers: [{ ...server, userId: "someone-else" }],
    });
    await expect(listBoxFiles(deps, scope)).rejects.toMatchObject({ code: "not_connected" });
    expect(box.requests).toHaveLength(0);
  });

  it("needs a sign-in when the token is gone", async () => {
    const { deps } = setup([], { token: null });
    await expect(listBoxFiles(deps, scope)).rejects.toMatchObject({ code: "reconnect" });
  });

  it("refuses anything but a numeric id, so a shared link never gets fetched", async () => {
    const { deps, box } = setup([]);
    await expect(
      listBoxFiles(deps, scope, { folderId: "https://app.box.com/s/abc123" }),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(
      downloadBoxFile(deps, scope, "../users/me", { maxBytes: 100 }),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(box.requests).toHaveLength(0);
  });
});

describe("listBoxFiles", () => {
  it("lists the root with Box's marker and marks folders", async () => {
    const { deps, box } = setup([
      folder("10", "Deals"),
      file("20", "a.pdf", "0"),
      file("21", "b.pdf", "0"),
    ]);
    box.pageSize = 2;
    const first = await listBoxFiles(deps, scope);
    expect(first.files.map((f) => [f.name, f.isFolder])).toEqual([
      ["Deals", true],
      ["a.pdf", false],
    ]);
    const second = await listBoxFiles(deps, scope, { pageToken: first.nextPageToken });
    expect(second.files.map((f) => f.name)).toEqual(["b.pdf"]);
    expect(second.nextPageToken).toBeUndefined();
    expect(box.requests[0]?.authorization).toBe("Bearer tok-1");
  });

  it("pages a search by offset", async () => {
    const { deps, box } = setup([
      file("20", "plan-a.pdf", "0"),
      file("21", "plan-b.pdf", "0"),
      file("22", "other", "0"),
    ]);
    box.pageSize = 1;
    const first = await listBoxFiles(deps, scope, { query: "plan" });
    expect(first.files.map((f) => f.name)).toEqual(["plan-a.pdf"]);
    const second = await listBoxFiles(deps, scope, {
      query: "plan",
      pageToken: first.nextPageToken,
    });
    expect(second.files.map((f) => f.name)).toEqual(["plan-b.pdf"]);
    expect(second.nextPageToken).toBeUndefined();
  });
});

describe("downloadBoxFile", () => {
  it("downloads through Box's download host without sending the token there", async () => {
    const { deps, box } = setup([file("20", "a.pdf", "0")]);
    const result = await downloadBoxFile(deps, scope, "20", { maxBytes: 1000 });
    expect(new TextDecoder().decode(result.bytes)).toBe("bytes of a.pdf");
    expect(result.webViewLink).toBe("https://app.box.com/file/20");
    const download = box.requests.find((r) => r.url.includes("dl.boxcloud.com"));
    expect(download?.authorization).toBeNull();
  });

  it("refuses a file over the limit, by its size and by its bytes", async () => {
    const { deps } = setup([
      file("20", "big.bin", "0", { size: 5000 }),
      file("21", "liar.bin", "0", { size: 1, bytes: new Uint8Array(5000) }),
    ]);
    await expect(downloadBoxFile(deps, scope, "20", { maxBytes: 1000 })).rejects.toMatchObject({
      code: "too_large",
    });
    await expect(downloadBoxFile(deps, scope, "21", { maxBytes: 1000 })).rejects.toMatchObject({
      code: "too_large",
    });
  });

  it("does not follow a download link outside Box", async () => {
    const { deps, box } = setup([
      file("20", "a.pdf", "0", { downloadUrl: "https://evil.example/steal" }),
    ]);
    await expect(downloadBoxFile(deps, scope, "20", { maxBytes: 1000 })).rejects.toBeInstanceOf(
      BoxFileError,
    );
    expect(box.requests.some((r) => r.url.includes("evil.example"))).toBe(false);
  });

  it("refuses a folder and reports a 401 as reconnect", async () => {
    const { deps, box } = setup([folder("10", "Deals")]);
    await expect(downloadBoxFile(deps, scope, "10", { maxBytes: 1000 })).rejects.toMatchObject({
      code: "not_found",
    });
    box.failWith = 401;
    await expect(downloadBoxFile(deps, scope, "10", { maxBytes: 1000 })).rejects.toMatchObject({
      code: "reconnect",
    });
  });
});
