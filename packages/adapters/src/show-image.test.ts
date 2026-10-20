import type { ArtifactStore } from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import type { ShowImageDeps } from "./show-image.js";
import { showImages, sniffImageType } from "./show-image.js";

const attach = vi.hoisted(() => vi.fn());
const getItem = vi.hoisted(() => vi.fn());
vi.mock("./thread-artifacts.js", () => ({ attachWorkspaceFileToThread: attach }));
vi.mock("@rakazo/db", async (original) => ({
  ...(await original<typeof import("@rakazo/db")>()),
  createDataRoomRepos: () => ({ getItem }),
}));

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
const scope = { spaceId: "s1", userId: "u1", botId: "b1", runId: "r1", operationId: "op" };

const rows = [
  {
    id: "mine",
    spaceId: "s1",
    userId: "u1",
    botId: "b1",
    groupId: null,
    name: "a.png",
    mimeType: "image/png",
    storageKey: "k1",
  },
  {
    id: "other-bot",
    spaceId: "s1",
    userId: "u1",
    botId: "b2",
    groupId: null,
    name: "b.png",
    mimeType: "image/png",
    storageKey: "k2",
  },
  {
    id: "other-user",
    spaceId: "s1",
    userId: "u2",
    botId: "b1",
    groupId: null,
    name: "c.png",
    mimeType: "image/png",
    storageKey: "k3",
  },
  {
    id: "pdf",
    spaceId: "s1",
    userId: "u1",
    botId: "b1",
    groupId: null,
    name: "d.pdf",
    mimeType: "application/pdf",
    storageKey: "k4",
  },
];

function setup(over: Partial<ShowImageDeps> = {}) {
  attach.mockReset().mockImplementation(async (_deps, input) => ({
    artifactId: "new-1",
    block: { kind: "image", artifactId: "new-1", mimeType: "image/png", name: input.filePath },
  }));
  const artifacts = { get: vi.fn().mockResolvedValue(PNG) } as unknown as ArtifactStore;
  const prisma = {
    artifact: {
      findFirst: async ({ where }: { where: { id: string; spaceId: string; userId: string } }) =>
        rows.find(
          (r) => r.id === where.id && r.spaceId === where.spaceId && r.userId === where.userId,
        ) ?? null,
    },
  } as unknown as PrismaClient;
  return { deps: { prisma, artifacts, scope, ...over } satisfies ShowImageDeps, artifacts };
}

const publicFetch = (body: Uint8Array, type = "image/png") =>
  ({
    fetch: (async () =>
      new Response(body as unknown as BodyInit, {
        headers: { "content-type": type },
      })) as typeof fetch,
    resolveHostname: async () => [{ address: "93.184.216.34", family: 4 as const }],
  }) satisfies ShowImageDeps["fetchOptions"];

describe("show_image", () => {
  it("sniffs raster types and rejects SVG", () => {
    expect(sniffImageType(PNG)).toBe("image/png");
    expect(sniffImageType(SVG)).toBeNull();
  });

  it("reuses an artifact of this bot and keeps alt and caption", async () => {
    const { deps } = setup();
    const out = await showImages(deps, {
      images: [{ artifact_id: "mine", alt: "Chart", caption: "Q3" }],
    });
    expect(out.blocks).toEqual([
      {
        kind: "image",
        artifactId: "mine",
        mimeType: "image/png",
        name: "a.png",
        alt: "Chart",
        caption: "Q3",
      },
    ]);
    expect(attach).not.toHaveBeenCalled();
  });

  it("copies another bot's artifact into this thread", async () => {
    const { deps } = setup();
    const out = await showImages(deps, { images: [{ artifact_id: "other-bot" }] });
    expect(out.blocks[0]?.artifactId).toBe("new-1");
    expect(attach).toHaveBeenCalledOnce();
  });

  it("refuses another user's artifact and a non-image artifact", async () => {
    const { deps } = setup();
    const out = await showImages(deps, {
      images: [{ artifact_id: "other-user" }, { artifact_id: "pdf" }],
    });
    expect(out.blocks).toEqual([]);
    expect(out.result.errors).toHaveLength(2);
  });

  it("stores a workspace file, and refuses non-images", async () => {
    const readWorkspaceFile = vi.fn().mockResolvedValueOnce(PNG).mockResolvedValueOnce(SVG);
    const { deps } = setup({ readWorkspaceFile });
    const out = await showImages(deps, { images: [{ path: "shots/a.png" }, { path: "x.svg" }] });
    expect(out.blocks).toHaveLength(1);
    expect(attach.mock.calls[0]?.[1].filePath).toBe("a.png");
    expect(out.result.errors).toEqual([{ index: 1, error: "not a PNG, JPEG, GIF or WebP image" }]);
  });

  it("fetches an https url through the safe fetch and stores it", async () => {
    const { deps } = setup({ fetchOptions: publicFetch(PNG) });
    const out = await showImages(deps, {
      images: [{ url: "https://img.example.test/p/cat.png?x=1" }],
    });
    expect(out.blocks).toHaveLength(1);
    expect(attach.mock.calls[0]?.[1].filePath).toBe("cat.png");
  });

  it("rejects private hosts, http, SVG bodies and oversized files", async () => {
    const privateHost = {
      ...publicFetch(PNG),
      resolveHostname: async () => [{ address: "10.0.0.5", family: 4 as const }],
    };
    const cases: [ShowImageDeps["fetchOptions"], string][] = [
      [privateHost, "https://internal.example.test/a.png"],
      [publicFetch(PNG), "http://img.example.test/a.png"],
      [publicFetch(SVG, "image/svg+xml"), "https://img.example.test/a.svg"],
      [publicFetch(new Uint8Array(10 * 1024 * 1024 + 1)), "https://img.example.test/big.png"],
    ];
    for (const [fetchOptions, url] of cases) {
      const { deps } = setup({ fetchOptions });
      const out = await showImages(deps, { images: [{ url }] });
      expect(out.blocks, url).toEqual([]);
      expect(attach).not.toHaveBeenCalled();
    }
  });

  it("limits the data room source to where it is allowed and to the owner's items", async () => {
    const off = setup();
    expect((await showImages(off.deps, { images: [{ item_id: "i1" }] })).blocks).toEqual([]);
    expect(getItem).not.toHaveBeenCalled();

    const { deps } = setup({ dataRoom: { deniedConnectionIds: ["c1"] } });
    getItem.mockResolvedValueOnce({ name: "scan.png", mimeType: "image/png", storageKey: "dr1" });
    expect((await showImages(deps, { images: [{ item_id: "i1" }] })).blocks).toHaveLength(1);
    expect(getItem).toHaveBeenCalledWith(
      expect.objectContaining({ spaceId: "s1", userId: "u1" }),
      "i1",
      { excludeConnectionIds: ["c1"] },
    );
    getItem.mockResolvedValueOnce(null);
    expect((await showImages(deps, { images: [{ item_id: "theirs" }] })).blocks).toEqual([]);
  });

  it("requires exactly one source and 1 to 6 images", async () => {
    const { deps } = setup();
    expect((await showImages(deps, { images: [] })).result.error).toBeDefined();
    expect(
      (await showImages(deps, { images: Array(7).fill({ url: "https://a.test" }) })).result.error,
    ).toBeDefined();
    const both = await showImages(deps, {
      images: [{ artifact_id: "mine", url: "https://a.test/a.png" }],
    });
    expect(both.blocks).toEqual([]);
  });
});
