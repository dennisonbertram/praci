import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  stat,
  symlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AdapterContext, AgentHomeStore, ArtifactStore } from "@rakazo/adapter-kit";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkpointAndRecordComputerWorkspace,
  checkpointComputerWorkspace,
  restoreComputerWorkspace,
} from "./computer-workspace.js";
import { LocalAgentHomeStore } from "./home.js";
import { removeTree } from "./home-archive.js";
import {
  AgentHomeConflictError,
  createAgentHomeStore,
  HOME_CACHE_LIMITS,
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
  kind: string;
  homeRevision: string;
  homeSnapshotId: string | null;
  homePreviousSnapshotId: string | null;
};

/** In-memory stand-ins for Postgres and the object store; no network or containers. */
function fakes(kind = "e2b") {
  const rows: Row[] = [
    {
      id: "c1",
      spaceId: "space-a",
      homeKey: "team-a",
      kind,
      homeRevision: "empty",
      homeSnapshotId: null,
      homePreviousSnapshotId: null,
    },
    {
      id: "c2",
      spaceId: "space-b",
      homeKey: "team-b",
      kind,
      homeRevision: "empty",
      homeSnapshotId: null,
      homePreviousSnapshotId: null,
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
    },
    // The store's only raw statement: setHome's UPDATE, with its values in order.
    $executeRaw: async (_sql: TemplateStringsArray, ...values: (string | null)[]) => {
      const [homeRevision, homeSnapshotId, homePreviousSnapshotId, id, spaceId, expected] = values;
      const hit = rows.filter(
        (row) =>
          row.id === id &&
          row.spaceId === spaceId &&
          (expected == null || row.homeRevision === expected),
      );
      for (const row of hit)
        Object.assign(row, { homeRevision, homeSnapshotId, homePreviousSnapshotId });
      return hit.length;
    },
  };
  const objects = new Map<string, Uint8Array>();
  const hooks = {
    beforePut: undefined as (() => Promise<void> | void) | undefined,
    beforeGet: undefined as (() => Promise<void> | void) | undefined,
  };
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
      const hook = hooks.beforePut;
      hooks.beforePut = undefined;
      await hook?.();
      const id = `${context.spaceId}/obj-${++counter}`;
      objects.set(id, artifact.bytes);
      return { id, hash: createHash("sha256").update(artifact.bytes).digest("hex") };
    },
    putStream: async () => {
      throw new Error("not used");
    },
    getStream: async () => {
      throw new Error("not used");
    },
    get: async (id, context) => {
      const hook = hooks.beforeGet;
      hooks.beforeGet = undefined;
      await hook?.();
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
  await Promise.all(dirs.splice(0).map((dir) => removeTree(dir)));
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
    expect(f.objects.size).toBe(1);

    const second = new ObjectAgentHomeStore(f.prisma, f.artifacts, await tmp());
    const dest = await tmp();
    await second.checkout("team-a", dest, ctx("space-a"));
    expect(await readFile(path.join(dest, "notes/a.txt"), "utf8")).toBe("alpha");
    expect((await stat(path.join(dest, "run.sh"))).mode & 0o111).not.toBe(0);
    expect(await second.readFile("team-a", "notes/a.txt", ctx("space-a"))).toBe("alpha");
  });

  it("replaces the previous snapshot and reads each new revision", async () => {
    const f = fakes();
    const a = new ObjectAgentHomeStore(f.prisma, f.artifacts, await tmp());
    const b = new ObjectAgentHomeStore(f.prisma, f.artifacts, await tmp());
    await a.commit("team-a", await source({ "f.txt": "one" }), ctx("space-a"));
    expect(await b.readFile("team-a", "f.txt", ctx("space-a"))).toBe("one");
    await a.commit("team-a", await source({ "f.txt": "two" }), ctx("space-a"));
    expect(await b.readFile("team-a", "f.txt", ctx("space-a"))).toBe("two");
    // The snapshot just replaced stays for one more save; the one from two saves ago goes.
    expect(f.objects.size).toBe(2);
    await a.commit("team-a", await source({ "f.txt": "three" }), ctx("space-a"));
    expect(f.objects.size).toBe(2);
    expect(f.objects.has(f.rows[0]!.homePreviousSnapshotId!)).toBe(true);
  });

  it("refreshes a cached git object that is read-only", async () => {
    const f = fakes();
    const reader = new ObjectAgentHomeStore(f.prisma, f.artifacts, await tmp());
    const src = await source({ ".git/objects/ab/cdef": "object", "f.txt": "one" });
    await chmod(path.join(src, ".git/objects/ab/cdef"), 0o444);
    await chmod(path.join(src, ".git/objects/ab"), 0o555);
    await reader.commit("team-a", src, ctx("space-a"));
    expect(await reader.readFile("team-a", "f.txt", ctx("space-a"))).toBe("one");
    await chmod(path.join(src, ".git/objects/ab"), 0o755);
    await writeFile(path.join(src, "f.txt"), "two");
    await reader.commit("team-a", src, ctx("space-a"));
    expect(await reader.readFile("team-a", "f.txt", ctx("space-a"))).toBe("two");
    expect(await reader.readFile("team-a", ".git/objects/ab/cdef", ctx("space-a"))).toBe("object");
  });

  it("rejects a commit based on a stale revision", async () => {
    const f = fakes();
    const store = new ObjectAgentHomeStore(f.prisma, f.artifacts, await tmp());
    const base = await store.commit("team-a", await source({ "f.txt": "one" }), ctx("space-a"));
    await store.commit("team-a", await source({ "f.txt": "two" }), ctx("space-a"));
    await expect(
      store.commit("team-a", await source({ "f.txt": "three" }), ctx("space-a"), base),
    ).rejects.toBeInstanceOf(AgentHomeConflictError);
    expect(f.objects.size).toBe(2);
  });

  it("rejects a commit when another writer publishes while it uploads, and keeps no orphan", async () => {
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

  it("retries an edit that loses the revision race instead of dropping either change", async () => {
    const f = fakes();
    const a = new ObjectAgentHomeStore(f.prisma, f.artifacts, await tmp());
    const b = new ObjectAgentHomeStore(f.prisma, f.artifacts, await tmp());
    await a.commit(
      "team-a",
      await source({ "bots/b1/x.txt": "x", "keep.txt": "k" }),
      ctx("space-a"),
    );
    f.hooks.beforePut = () => b.writeFile("team-a", "from-b.txt", "b", ctx("space-a"));
    await a.removeEntry("team-a", "bots", "b1", ctx("space-a"));
    const reader = new ObjectAgentHomeStore(f.prisma, f.artifacts, await tmp());
    expect(await reader.list("team-a", "bots", ctx("space-a"))).toEqual([]);
    expect(await reader.readFile("team-a", "from-b.txt", ctx("space-a"))).toBe("b");
    expect(await reader.readFile("team-a", "keep.txt", ctx("space-a"))).toBe("k");
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

  it("does not expose or delete another space's home", async () => {
    const f = fakes();
    const dataDir = await tmp();
    const store = new ObjectAgentHomeStore(f.prisma, f.artifacts, dataDir);
    await store.commit("team-b", await source({ "secret.txt": "b-only" }), ctx("space-b"));
    expect(await store.readFile("team-b", "secret.txt", ctx("space-b"))).toBe("b-only");
    for (const attempt of [
      store.readFile("team-b", "secret.txt", ctx("space-a")),
      store.checkout("team-b", "/tmp/unused", ctx("space-a")),
      store.list("team-b", "", ctx("space-a")),
      store.commit("team-b", "/tmp/unused", ctx("space-a")),
      store.liveDirectory("team-b", ctx("space-a")),
      store.readFile("../team-b", "secret.txt", ctx("space-a")),
    ]) {
      await expect(attempt).rejects.toThrow();
    }
    await store.remove("team-b", ctx("space-a"));
    expect(f.objects.size).toBe(1);
    expect(f.rows[1]?.homeSnapshotId).toBeTruthy();
    expect(await store.readFile("team-b", "secret.txt", ctx("space-b"))).toBe("b-only");
  });

  it("removes both stored snapshots and the local copies", async () => {
    const f = fakes();
    const dataDir = await tmp();
    const store = new ObjectAgentHomeStore(f.prisma, f.artifacts, dataDir);
    await store.commit("team-a", await source({ "f.txt": "1" }), ctx("space-a"));
    await store.commit("team-a", await source({ "f.txt": "2" }), ctx("space-a"));
    await store.readFile("team-a", "f.txt", ctx("space-a"));
    expect(f.objects.size).toBe(2);
    await store.remove("team-a", ctx("space-a"));
    expect(f.objects.size).toBe(0);
    expect(f.rows[0]).toMatchObject({
      homeRevision: "empty",
      homeSnapshotId: null,
      homePreviousSnapshotId: null,
    });
    expect(await readdir(path.join(dataDir, "home-cache"))).toEqual([]);
  });

  it("removes the snapshots a caller names after it deleted the Computer row", async () => {
    const f = fakes();
    const store = new ObjectAgentHomeStore(f.prisma, f.artifacts, await tmp());
    await store.commit("team-a", await source({ "f.txt": "1" }), ctx("space-a"));
    await store.commit("team-a", await source({ "f.txt": "2" }), ctx("space-a"));
    const [deleted] = f.rows.splice(0, 1);
    await store.remove("team-a", ctx("space-a"), deleted);
    expect(f.objects.size).toBe(0);
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

describe("a Docker live directory", () => {
  it("creates a missing directory from the snapshot", async () => {
    const f = fakes("docker");
    const writer = new ObjectAgentHomeStore(f.prisma, f.artifacts, await tmp());
    await writer.commit("team-a", await source({ "f.txt": "one" }), ctx("space-a"));
    const fresh = new ObjectAgentHomeStore(f.prisma, f.artifacts, await tmp());
    const live = (await fresh.liveDirectory("team-a", ctx("space-a"))).path;
    expect(await readFile(path.join(live, "f.txt"), "utf8")).toBe("one");
  });

  it("lets concurrent team checkpoints both succeed and never rolls back newer files", async () => {
    const f = fakes("docker");
    const dataDir = await tmp();
    // Two processes on the host that owns the Docker computer, for example the API and a worker.
    const a = new ObjectAgentHomeStore(f.prisma, f.artifacts, dataDir);
    const b = new ObjectAgentHomeStore(f.prisma, f.artifacts, dataDir);
    const live = (await a.liveDirectory("team-a", ctx("space-a"))).path;
    await writeFile(path.join(live, "base.txt"), "base");
    await a.revise("team-a", ctx("space-a"));
    await writeFile(path.join(live, "botA.txt"), "A");
    // While bot A's checkpoint uploads, bot B's checkpoint saves first, then B keeps working.
    f.hooks.beforePut = async () => {
      await b.revise("team-a", ctx("space-a"));
      await writeFile(path.join(live, "botB-late.txt"), "after B's snapshot");
    };
    const revision = await a.revise("team-a", ctx("space-a"));
    expect(f.rows[0]?.homeRevision).toBe(revision);

    expect((await readdir(live)).sort()).toEqual(["base.txt", "botA.txt", "botB-late.txt"]);
    await a.list("team-a", "", ctx("space-a"));
    await b.readFile("team-a", "base.txt", ctx("space-a"));
    await a.liveDirectory("team-a", ctx("space-a"), { unmounted: async () => true });
    expect((await readdir(live)).sort()).toEqual(["base.txt", "botA.txt", "botB-late.txt"]);
    // B's save started after A asked, so it already holds A's file and A reuses it.
    const elsewhere = new ObjectAgentHomeStore(f.prisma, f.artifacts, await tmp());
    expect(await elsewhere.readFile("team-a", "botA.txt", ctx("space-a"))).toBe("A");
    await b.revise("team-a", ctx("space-a"));
    const later = new ObjectAgentHomeStore(f.prisma, f.artifacts, await tmp());
    expect(await later.readFile("team-a", "botB-late.txt", ctx("space-a"))).toBe(
      "after B's snapshot",
    );
  });

  it("installs a newer snapshot only into a directory nothing mounts, by renaming a fresh copy in", async () => {
    const f = fakes("docker");
    const dataDir = await tmp();
    const host = new ObjectAgentHomeStore(f.prisma, f.artifacts, dataDir);
    await host.commit("team-a", await source({ "f.txt": "one" }), ctx("space-a"));
    const live = (await host.liveDirectory("team-a", ctx("space-a"))).path;
    const inode = (await stat(live)).ino;
    // Another writer (say, the Computer ran on a remote provider meanwhile) saves a newer revision.
    const other = new ObjectAgentHomeStore(f.prisma, f.artifacts, await tmp());
    await other.commit("team-a", await source({ "f.txt": "two" }), ctx("space-a"));

    await host.liveDirectory("team-a", ctx("space-a"));
    // The supervisor still reports a running container: the directory is left alone, and this
    // host is no longer authoritative, so reads serve the newer snapshot from the cache.
    expect(
      (await host.liveDirectory("team-a", ctx("space-a"), { unmounted: async () => false }))
        .current,
    ).toBe(false);
    expect(await readFile(path.join(live, "f.txt"), "utf8")).toBe("one");
    expect(await host.readFile("team-a", "f.txt", ctx("space-a"))).toBe("two");
    expect((await stat(live)).ino).toBe(inode);

    await host.liveDirectory("team-a", ctx("space-a"), { unmounted: async () => true });
    expect(await readFile(path.join(live, "f.txt"), "utf8")).toBe("two");
    expect((await stat(live)).ino).not.toBe(inode);
    expect((await readdir(path.dirname(live))).filter((name) => name.startsWith("."))).toEqual([]);
  });

  it("keeps an unmounted directory whose newest revision was saved from it", async () => {
    const f = fakes("docker");
    const host = new ObjectAgentHomeStore(f.prisma, f.artifacts, await tmp());
    const live = (await host.liveDirectory("team-a", ctx("space-a"))).path;
    await writeFile(path.join(live, "saved.txt"), "saved");
    await host.revise("team-a", ctx("space-a"));
    await writeFile(path.join(live, "unsaved.txt"), "written before the container stopped");
    const unmounted = vi.fn(async () => true);
    await host.liveDirectory("team-a", ctx("space-a"), { unmounted });
    expect(unmounted).not.toHaveBeenCalled(); // nothing to replace, so the supervisor is not asked
    expect((await readdir(live)).sort()).toEqual(["saved.txt", "unsaved.txt"]);
  });

  it("never writes through a symlink an agent planted, mounted or not", async () => {
    const f = fakes("docker");
    const outside = await tmp();
    for (let i = 0; i < 20; i++) await writeFile(path.join(outside, `host-${i}.txt`), "precious");
    const host = new ObjectAgentHomeStore(f.prisma, f.artifacts, await tmp());
    await host.commit("team-a", await source({ "d/wanted.txt": "w" }), ctx("space-a"));
    const live = (await host.liveDirectory("team-a", ctx("space-a"))).path;
    // The agent keeps swapping d for a symlink to a host directory while saves and installs run.
    const child = spawn(
      process.execPath,
      [
        "-e",
        `const fs=require("fs"),p=require("path");const [h,o]=process.argv.slice(1);
         const d=p.join(h,"d"),r=p.join(h,"d.real");
         (function t(){for(let i=0;i<50;i++){try{fs.renameSync(d,r);fs.symlinkSync(o,d);fs.unlinkSync(d);fs.renameSync(r,d)}catch{}}setImmediate(t)})();`,
        live,
        outside,
      ],
      { stdio: "ignore" },
    );
    await new Promise((resolve) => setTimeout(resolve, 150));
    const other = new ObjectAgentHomeStore(f.prisma, f.artifacts, await tmp());
    try {
      for (let i = 0; i < 10; i++) {
        await other.commit("team-a", await source({ "d/wanted.txt": `w${i}` }), ctx("space-a"));
        await host.liveDirectory("team-a", ctx("space-a"));
        await host.list("team-a", "", ctx("space-a")).catch(() => []); // a listing may race the swap
        await host.revise("team-a", ctx("space-a"));
      }
    } finally {
      await new Promise((resolve) => child.once("exit", resolve).kill());
    }
    await other.commit("team-a", await source({ "d/wanted.txt": "final" }), ctx("space-a"));
    await host.liveDirectory("team-a", ctx("space-a"), { unmounted: async () => true });
    expect(await readFile(path.join(live, "d/wanted.txt"), "utf8")).toBe("final");
    expect((await readdir(outside)).sort()).toEqual(
      Array.from({ length: 20 }, (_, i) => `host-${i}.txt`).sort(),
    );
    expect(await readFile(path.join(outside, "host-0.txt"), "utf8")).toBe("precious");
  }, 60_000);

  it("replaces a directory with read-only git objects when unmounted", async () => {
    const f = fakes("docker");
    const host = new ObjectAgentHomeStore(f.prisma, f.artifacts, await tmp());
    const live = (await host.liveDirectory("team-a", ctx("space-a"))).path;
    await mkdir(path.join(live, ".git/objects/ab"), { recursive: true });
    await writeFile(path.join(live, ".git/objects/ab/cd"), "o");
    await chmod(path.join(live, ".git/objects/ab/cd"), 0o444);
    await chmod(path.join(live, ".git/objects/ab"), 0o555);
    await host.revise("team-a", ctx("space-a"));
    const other = new ObjectAgentHomeStore(f.prisma, f.artifacts, await tmp());
    await other.writeFile("team-a", "new.txt", "n", ctx("space-a"));
    await host.liveDirectory("team-a", ctx("space-a"), { unmounted: async () => true });
    expect(await readFile(path.join(live, "new.txt"), "utf8")).toBe("n");
    expect(await readFile(path.join(live, ".git/objects/ab/cd"), "utf8")).toBe("o");
  });

  it("keeps a symlink with an absolute target as it is", async () => {
    const f = fakes("docker");
    const src = await source({ "a.txt": "A" });
    await symlink("/outside/target", path.join(src, "dangling"));
    await new ObjectAgentHomeStore(f.prisma, f.artifacts, await tmp()).commit(
      "team-a",
      src,
      ctx("space-a"),
    );
    const { readlink } = await import("node:fs/promises");
    const live = (
      await new ObjectAgentHomeStore(f.prisma, f.artifacts, await tmp()).liveDirectory(
        "team-a",
        ctx("space-a"),
      )
    ).path;
    expect(await readlink(path.join(live, "dangling"))).toBe("/outside/target");
  });
});

describe("hosts, caches and leftovers", () => {
  it("keeps a live directory another process installed while a slow install ran", async () => {
    const f = fakes("docker");
    await new ObjectAgentHomeStore(f.prisma, f.artifacts, await tmp()).commit(
      "team-a",
      await source({ "f.txt": "one" }),
      ctx("space-a"),
    );
    const dataDir = await tmp();
    const slow = new ObjectAgentHomeStore(f.prisma, f.artifacts, dataDir);
    const fast = new ObjectAgentHomeStore(f.prisma, f.artifacts, dataDir);
    let mountedInode = 0;
    // While the slow store downloads, the fast one installs and a container starts using it.
    f.hooks.beforeGet = async () => {
      const live = (await fast.liveDirectory("team-a", ctx("space-a"))).path;
      await writeFile(path.join(live, "container.txt"), "written by the container");
      mountedInode = (await stat(live)).ino;
    };
    const live = (await slow.liveDirectory("team-a", ctx("space-a"))).path;
    expect((await stat(live)).ino).toBe(mountedInode);
    expect(await readFile(path.join(live, "container.txt"), "utf8")).toBe(
      "written by the container",
    );
    expect((await readdir(path.join(dataDir, "homes"))).filter((n) => n.startsWith("."))).toEqual(
      [],
    );
  });

  it("serves a Docker home from the cache on a host that is not authoritative, and never publishes its stale copy", async () => {
    const f = fakes("docker");
    await new ObjectAgentHomeStore(f.prisma, f.artifacts, await tmp()).commit(
      "team-a",
      await source({ "f.txt": "current" }),
      ctx("space-a"),
    );
    const dataDir = await tmp();
    // An old copy on a host that does not run the computer (no record of the current revision).
    await mkdir(path.join(dataDir, "homes/team-a"), { recursive: true });
    await writeFile(path.join(dataDir, "homes/team-a/f.txt"), "stale");
    await writeFile(path.join(dataDir, "homes/team-a/stale-only.txt"), "stale");
    const other = new ObjectAgentHomeStore(f.prisma, f.artifacts, dataDir);
    expect(await other.readFile("team-a", "f.txt", ctx("space-a"))).toBe("current");
    await other.writeFile("team-a", "new.txt", "n", ctx("space-a"));
    const reader = new ObjectAgentHomeStore(f.prisma, f.artifacts, await tmp());
    expect(await reader.readFile("team-a", "f.txt", ctx("space-a"))).toBe("current");
    expect(await reader.readFile("team-a", "new.txt", ctx("space-a"))).toBe("n");
    await expect(reader.readFile("team-a", "stale-only.txt", ctx("space-a"))).rejects.toThrow();
    expect(await readFile(path.join(dataDir, "homes/team-a/f.txt"), "utf8")).toBe("stale");
  });

  it("uploads a legacy live directory once on its first save", async () => {
    const f = fakes("docker");
    const dataDir = await tmp();
    await mkdir(path.join(dataDir, "homes/team-a"), { recursive: true });
    await writeFile(path.join(dataDir, "homes/team-a/old.txt"), "legacy");
    await new ObjectAgentHomeStore(f.prisma, f.artifacts, dataDir).revise("team-a", ctx("space-a"));
    expect(f.calls.put).toBe(1);
  });

  it("keeps only the newest record of what the live directory holds", async () => {
    const f = fakes("docker");
    const dataDir = await tmp();
    const store = new ObjectAgentHomeStore(f.prisma, f.artifacts, dataDir);
    await store.liveDirectory("team-a", ctx("space-a"));
    await store.revise("team-a", ctx("space-a"));
    const last = await store.revise("team-a", ctx("space-a"));
    expect(await readdir(path.join(dataDir, "home-sync/team-a"))).toEqual([last]);
  });

  it("removes scratch and install folders left by a crashed process, but not recent ones", async () => {
    const f = fakes();
    const dataDir = await tmp();
    const old = new Date(Date.now() - HOME_CACHE_LIMITS.leftoverMs - 60_000);
    const paths = {
      oldOp: path.join(dataDir, "home-staging/op-old"),
      newOp: path.join(dataDir, "home-staging/op-new"),
      oldInstall: path.join(dataDir, "homes/.team-a.install-old"),
      newInstall: path.join(dataDir, "homes/.team-a.install-new"),
      oldCache: path.join(dataDir, "home-cache/team-a/homes/.rev.install-old"),
    };
    for (const [name, dir] of Object.entries(paths)) {
      await mkdir(dir, { recursive: true });
      if (name.startsWith("old")) await utimes(dir, old, old);
    }
    const store = new ObjectAgentHomeStore(f.prisma, f.artifacts, dataDir);
    await store.commit("team-a", await source({ "f.txt": "1" }), ctx("space-a"));
    for (const [name, dir] of Object.entries(paths)) {
      expect([name, await isPresent(dir)]).toEqual([name, !name.startsWith("old")]);
    }
  });

  it("keeps a cached revision an export is still reading", async () => {
    const f = fakes();
    const dataDir = await tmp();
    const store = new ObjectAgentHomeStore(f.prisma, f.artifacts, dataDir);
    const files = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`f${i}.txt`, `${i}`]));
    await store.commit("team-a", await source(files), ctx("space-a"));
    const exported: string[] = [];
    for await (const file of store.exportHome("team-a", ctx("space-a"))) {
      exported.push(file.path);
      if (exported.length === 1) {
        await store.commit("team-a", await source({ "g.txt": "g" }), ctx("space-a"));
        expect(await store.readFile("team-a", "g.txt", ctx("space-a"))).toBe("g");
      }
    }
    expect(exported.sort()).toEqual(Object.keys(files).sort());
  });

  it("removes cached revisions unused for a day and the least recently used above the cap", async () => {
    const f = fakes();
    f.rows.push({ ...f.rows[0]!, id: "c3", homeKey: "team-c" });
    const dataDir = await tmp();
    const store = new ObjectAgentHomeStore(f.prisma, f.artifacts, dataDir, 15);
    const cached = (key: string) => readdir(path.join(dataDir, "home-cache", key, "homes"));
    const age = async (key: string, ms: number) => {
      const homes = path.join(dataDir, "home-cache", key, "homes");
      const when = new Date(Date.now() - ms);
      for (const name of await readdir(homes)) await utimes(path.join(homes, name), when, when);
    };
    for (const key of ["team-a", "team-c"]) {
      await store.commit(key, await source({ "f.txt": "0123456789" }), ctx("space-a"));
      await store.readFile(key, "f.txt", ctx("space-a"));
    }
    await age("team-a", HOME_CACHE_LIMITS.ttlMs + 60_000);
    await age("team-c", HOME_CACHE_LIMITS.readerGraceMs + 60_000);
    // A third cached home pushes the total (10 bytes each) past the 15-byte cap.
    f.rows.push({ ...f.rows[0]!, id: "c4", homeKey: "team-d" });
    await store.commit("team-d", await source({ "f.txt": "0123456789" }), ctx("space-a"));
    await store.readFile("team-d", "f.txt", ctx("space-a"));
    expect(await cached("team-a")).toEqual([]); // past the TTL
    expect(await cached("team-c")).toEqual([]); // least recently used, over the cap
    expect((await cached("team-d")).filter((n) => !n.startsWith("."))).toHaveLength(1);
  });
});

async function isPresent(target: string) {
  return stat(target).then(
    () => true,
    () => false,
  );
}

describe("workspace checkpoints use the store interface", () => {
  const computer = { id: "c", botId: "b", kind: "docker", providerRef: "p" } as never;

  it("revises the live directory for Docker and stops browsers only when asked", async () => {
    const execute = vi.fn(async function* () {});
    const sandbox = { exportWorkspace: vi.fn(), importWorkspace: vi.fn(), execute } as never;
    const home = {
      liveDirectory: vi.fn(),
      revise: vi.fn().mockResolvedValue("rev-1"),
      exportHome: vi.fn(),
    } as unknown as AgentHomeStore;
    expect(
      await checkpointComputerWorkspace(home, sandbox, "k", computer, ctx("space-a"), "rev-0"),
    ).toBe("rev-1");
    expect(home.revise).toHaveBeenCalledWith("k", expect.anything());
    expect(execute).not.toHaveBeenCalled();
    await checkpointComputerWorkspace(home, sandbox, "k", computer, ctx("space-a"), "rev-0", {
      quiesceBrowsers: true,
    });
    expect(execute).toHaveBeenCalledTimes(1);
    await restoreComputerWorkspace(home, sandbox, "k", computer, ctx("space-a"), true);
    expect(home.exportHome).not.toHaveBeenCalled();
  });

  it("passes the revision read before the checkpoint to a remote commit", async () => {
    const commit = vi.fn().mockResolvedValue("rev-2");
    const home = { commit } as unknown as AgentHomeStore;
    const remote = { id: "c", botId: "b", kind: "e2b", providerRef: "p" } as never;
    const exportWorkspace = async function* () {};
    await checkpointComputerWorkspace(
      home,
      { exportWorkspace } as never,
      "k",
      remote,
      ctx("space-a"),
      "rev-1",
    );
    expect(commit).toHaveBeenCalledWith("k", expect.any(String), expect.anything(), "rev-1");
  });

  it("records a checkpoint only while the revision is still the one it started from", async () => {
    const commit = vi.fn().mockResolvedValue("rev-2");
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      computer: { findUnique: vi.fn().mockResolvedValue({ homeRevision: "rev-1" }), updateMany },
    };
    const remote = { id: "c", botId: "b", kind: "e2b", providerRef: "p" } as never;
    const exportWorkspace = async function* () {};
    await checkpointAndRecordComputerWorkspace(
      { home: { commit } as never, sandbox: { exportWorkspace } as never, prisma: prisma as never },
      { id: "c1", homeKey: "k" },
      remote,
      ctx("space-a"),
    );
    expect(commit).toHaveBeenCalledWith("k", expect.any(String), expect.anything(), "rev-1");
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "c1", homeRevision: { in: ["rev-1", "rev-2"] } },
      data: { homeRevision: "rev-2" },
    });
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
