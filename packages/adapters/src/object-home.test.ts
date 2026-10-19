import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AdapterContext, AgentHomeStore, ArtifactStore } from "@rakazo/adapter-kit";
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkpointComputerWorkspace, restoreComputerWorkspace } from "./computer-workspace.js";
import { LocalAgentHomeStore } from "./home.js";
import {
  AgentHomeConflictError,
  createAgentHomeStore,
  ObjectAgentHomeStore,
} from "./object-home.js";

const ctx = (spaceId: string): AdapterContext => ({
  operationId: "op",
  traceId: "trace",
  spaceId,
  userId: "user-1",
  signal: new AbortController().signal,
});

type Row = {
  id: string;
  spaceId: string;
  homeKey: string;
  homeRevision: string;
  homeSnapshotId: string | null;
};

/** In-memory stand-ins for Postgres and the object store; no network or containers. */
function fakes() {
  const rows: Row[] = [
    {
      id: "c1",
      spaceId: "space-a",
      homeKey: "team-a",
      homeRevision: "empty",
      homeSnapshotId: null,
    },
    {
      id: "c2",
      spaceId: "space-b",
      homeKey: "team-b",
      homeRevision: "empty",
      homeSnapshotId: null,
    },
  ];
  const matches = (row: Row, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, value]) => row[key as keyof Row] === value);
  const prisma = {
    computer: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        const hit = rows.find((row) => matches(row, where));
        return hit ? { ...hit } : null; // a copy, like a database read
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Partial<Row>;
      }) => {
        const hit = rows.filter((row) => matches(row, where));
        for (const row of hit) Object.assign(row, data);
        return { count: hit.length };
      },
    },
  };
  const objects = new Map<string, Uint8Array>();
  const hooks = { beforePut: undefined as (() => void) | undefined };
  let counter = 0;
  const calls = { put: 0 };
  const artifacts: ArtifactStore = {
    describe: () => ({
      id: "mem",
      contractVersion: "1",
      adapterVersion: "0",
      capabilities: { stream: false },
    }),
    put: async (artifact, context) => {
      calls.put++;
      hooks.beforePut?.();
      const id = `${context.spaceId}/obj-${++counter}`;
      objects.set(id, artifact.bytes);
      return { id, hash: createHash("sha256").update(artifact.bytes).digest("hex") };
    },
    get: async (id, context) => {
      const bytes = id.startsWith(`${context.spaceId}/`) ? objects.get(id) : undefined;
      if (!bytes) throw new Error("not found");
      return bytes;
    },
    remove: async (id) => void objects.delete(id),
  };
  return { rows, prisma: prisma as never, objects, artifacts, hooks, calls };
}

const dirs: string[] = [];
async function tmp() {
  const dir = await mkdtemp(path.join(tmpdir(), "rakazo-object-home-"));
  dirs.push(dir);
  return dir;
}
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function source(files: Record<string, string>) {
  const dir = await tmp();
  for (const [name, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(dir, name)), { recursive: true });
    await writeFile(path.join(dir, name), content);
  }
  return dir;
}

describe("ObjectAgentHomeStore", () => {
  it("round-trips a workspace snapshot to a host with no local copy", async () => {
    const f = fakes();
    const src = await source({ "notes/a.txt": "alpha", "run.sh": "#!/bin/sh\n" });
    await chmod(path.join(src, "run.sh"), 0o755);
    const first = new ObjectAgentHomeStore(f.prisma, f.artifacts, await tmp());
    const revision = await first.commit("team-a", src, ctx("space-a"));

    expect(f.rows[0]).toMatchObject({ homeRevision: revision });
    expect(f.rows[0]?.homeSnapshotId).toBeTruthy();
    expect(f.objects.size).toBe(1);

    const second = new ObjectAgentHomeStore(f.prisma, f.artifacts, await tmp());
    const dest = await tmp();
    await second.checkout("team-a", dest, ctx("space-a"));
    expect(await readFile(path.join(dest, "notes/a.txt"), "utf8")).toBe("alpha");
    expect((await stat(path.join(dest, "run.sh"))).mode & 0o111).not.toBe(0);
    expect(await second.readFile("team-a", "notes/a.txt", ctx("space-a"))).toBe("alpha");
  });

  it("replaces the previous snapshot and refreshes a stale working copy", async () => {
    const f = fakes();
    const dataB = await tmp();
    const a = new ObjectAgentHomeStore(f.prisma, f.artifacts, await tmp());
    const b = new ObjectAgentHomeStore(f.prisma, f.artifacts, dataB);
    await a.commit("team-a", await source({ "f.txt": "one" }), ctx("space-a"));
    expect(await b.readFile("team-a", "f.txt", ctx("space-a"))).toBe("one");
    await a.commit("team-a", await source({ "f.txt": "two" }), ctx("space-a"));
    expect(f.objects.size).toBe(1);
    expect(await b.readFile("team-a", "f.txt", ctx("space-a"))).toBe("two");
  });

  it("rejects a commit based on a stale revision", async () => {
    const f = fakes();
    const store = new ObjectAgentHomeStore(f.prisma, f.artifacts, await tmp());
    const base = await store.commit("team-a", await source({ "f.txt": "one" }), ctx("space-a"));
    await store.commit("team-a", await source({ "f.txt": "two" }), ctx("space-a"));
    await expect(
      store.commit("team-a", await source({ "f.txt": "three" }), ctx("space-a"), base),
    ).rejects.toBeInstanceOf(AgentHomeConflictError);
    expect(f.objects.size).toBe(1);
  });

  it("rejects a save when another writer publishes while it uploads, and keeps no orphan", async () => {
    const f = fakes();
    const store = new ObjectAgentHomeStore(f.prisma, f.artifacts, await tmp());
    await store.commit("team-a", await source({ "f.txt": "one" }), ctx("space-a"));
    f.hooks.beforePut = () => {
      f.rows[0]!.homeRevision = "rev-from-another-worker";
    };
    await expect(
      store.commit("team-a", await source({ "f.txt": "two" }), ctx("space-a")),
    ).rejects.toBeInstanceOf(AgentHomeConflictError);
    expect(f.rows[0]?.homeRevision).toBe("rev-from-another-worker");
    expect(f.objects.size).toBe(1);
  });

  it("uploads a legacy local home exactly once and leaves the local copy in place", async () => {
    const f = fakes();
    const dataDir = await tmp();
    const legacy = path.join(dataDir, "homes", "team-a");
    await mkdir(legacy, { recursive: true });
    await writeFile(path.join(legacy, "old.txt"), "legacy");

    const store = new ObjectAgentHomeStore(f.prisma, f.artifacts, dataDir);
    await store.checkout("team-a", await tmp(), ctx("space-a"));
    await store.checkout("team-a", await tmp(), ctx("space-a"));
    const other = new ObjectAgentHomeStore(f.prisma, f.artifacts, await tmp());
    expect(await other.readFile("team-a", "old.txt", ctx("space-a"))).toBe("legacy");

    expect(f.calls.put).toBe(1);
    expect(f.rows[0]?.homeSnapshotId).toBeTruthy();
    expect(await readFile(path.join(legacy, "old.txt"), "utf8")).toBe("legacy");
  });

  it("keeps one snapshot when two workers migrate the same shared volume at once", async () => {
    const f = fakes();
    const dataDir = await tmp();
    await mkdir(path.join(dataDir, "homes", "team-a"), { recursive: true });
    await writeFile(path.join(dataDir, "homes", "team-a", "old.txt"), "legacy");
    const a = new ObjectAgentHomeStore(f.prisma, f.artifacts, dataDir);
    const b = new ObjectAgentHomeStore(f.prisma, f.artifacts, dataDir);
    await Promise.all([
      a.checkout("team-a", await tmp(), ctx("space-a")),
      b.checkout("team-a", await tmp(), ctx("space-a")),
    ]);
    expect(f.objects.size).toBe(1);
    expect(f.rows[0]?.homeSnapshotId).toBe([...f.objects.keys()][0]);
  });

  it("does not expose another space's home", async () => {
    const f = fakes();
    const store = new ObjectAgentHomeStore(f.prisma, f.artifacts, await tmp());
    await store.commit("team-b", await source({ "secret.txt": "b-only" }), ctx("space-b"));
    for (const attempt of [
      store.readFile("team-b", "secret.txt", ctx("space-a")),
      store.checkout("team-b", "/tmp/unused", ctx("space-a")),
      store.list("team-b", "", ctx("space-a")),
      store.commit("team-b", "/tmp/unused", ctx("space-a")),
      store.readFile("../team-b", "secret.txt", ctx("space-a")),
    ]) {
      await expect(attempt).rejects.toThrow();
    }
    await store.remove("team-b", ctx("space-a"));
    expect(f.objects.size).toBe(1);
    expect(f.rows[1]?.homeSnapshotId).toBeTruthy();
  });

  it("removes the stored snapshot and a team entry through the interface", async () => {
    const f = fakes();
    const store = new ObjectAgentHomeStore(f.prisma, f.artifacts, await tmp());
    await store.commit(
      "team-a",
      await source({ "bots/b1/x.txt": "x", "keep.txt": "k" }),
      ctx("space-a"),
    );
    await store.removeEntry("team-a", "bots", "b1", ctx("space-a"));
    const other = new ObjectAgentHomeStore(f.prisma, f.artifacts, await tmp());
    expect(await other.list("team-a", "bots", ctx("space-a"))).toEqual([]);
    await store.remove("team-a", ctx("space-a"));
    expect(f.objects.size).toBe(0);
    expect(f.rows[0]).toMatchObject({ homeRevision: "empty", homeSnapshotId: null });
  });

  it("uses object storage unless the development opt-out is set", async () => {
    const f = fakes();
    const dir = await tmp();
    expect(createAgentHomeStore({}, f.prisma, f.artifacts, dir)).toBeInstanceOf(
      ObjectAgentHomeStore,
    );
    expect(
      createAgentHomeStore({ RAKAZO_AGENT_HOME_STORE: "local" }, f.prisma, f.artifacts, dir),
    ).toBeInstanceOf(LocalAgentHomeStore);
  });
});

describe("workspace checkpoints use the store interface", () => {
  const computer = { id: "c", botId: "b", kind: "docker", providerRef: "p" } as never;
  const sandbox = { exportWorkspace: vi.fn(), importWorkspace: vi.fn() } as never;

  it("revises the live directory for Docker when the store offers one", async () => {
    const home = {
      liveDirectory: vi.fn(),
      revise: vi.fn().mockResolvedValue("rev-1"),
      exportHome: vi.fn(),
    } as unknown as AgentHomeStore;
    expect(await checkpointComputerWorkspace(home, sandbox, "k", computer, ctx("space-a"))).toBe(
      "rev-1",
    );
    await restoreComputerWorkspace(home, sandbox, "k", computer, ctx("space-a"));
    expect(home.exportHome).not.toHaveBeenCalled();
  });

  it("restores through exportHome when the store has no live directory", async () => {
    const importWorkspace = vi.fn().mockResolvedValue(undefined);
    const home = { exportHome: vi.fn().mockReturnValue("files") } as unknown as AgentHomeStore;
    await restoreComputerWorkspace(
      home,
      { importWorkspace } as never,
      "k",
      computer,
      ctx("space-a"),
    );
    expect(importWorkspace).toHaveBeenCalledWith(computer, "files", expect.anything());
  });
});
