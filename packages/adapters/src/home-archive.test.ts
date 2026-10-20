import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  chmod,
  link,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  readlink,
  stat,
  symlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import * as tar from "tar";
import { afterEach, describe, expect, it } from "vitest";
import { LocalArtifactStore } from "./artifacts.js";
import { packDirectory, removeTree, skipSnapshotPath, unpackArchive } from "./home-archive.js";
import { ObjectAgentHomeStore } from "./object-home.js";

const dirs: string[] = [];
async function tmp() {
  const dir = await mkdtemp(path.join(tmpdir(), "rakazo-archive-"));
  dirs.push(dir);
  return dir;
}
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => removeTree(dir)));
});

type RawEntry = { path: string; type: string; linkpath?: string; data?: string; mode?: number };

/** Writes a raw gzip tar, so tests can build archives `packDirectory` would never make. */
async function rawArchive(entries: RawEntry[]) {
  const blocks: Buffer[] = [];
  for (const entry of entries) {
    const data = Buffer.from(entry.data ?? "");
    const block = Buffer.alloc(512);
    new tar.Header({
      path: entry.path,
      type: entry.type as never,
      linkpath: entry.linkpath,
      size: data.length,
      mode: entry.mode ?? 0o644,
      mtime: new Date(),
    }).encode(block);
    blocks.push(block, data, Buffer.alloc((512 - (data.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  const file = path.join(await tmp(), "crafted.tgz");
  await writeFile(file, gzipSync(Buffer.concat(blocks)));
  return file;
}

async function roundTrip(source: string) {
  const archive = path.join(await tmp(), "home.tgz");
  const result = await packDirectory(source, archive);
  const out = path.join(await tmp(), "out");
  await unpackArchive(archive, out);
  return { out, ...result };
}

async function listTree(dir: string, prefix = ""): Promise<string[]> {
  const names: string[] = [];
  for (const name of (await readdir(dir)).sort()) {
    names.push(prefix + name);
    if ((await lstat(path.join(dir, name))).isDirectory()) {
      names.push(...(await listTree(path.join(dir, name), `${prefix}${name}/`)));
    }
  }
  return names;
}

/** Runs a script in another process, so it really races the code under test. */
function background(script: string, ...args: string[]) {
  const child = spawn(process.execPath, ["-e", script, ...args], { stdio: "ignore" });
  return {
    started: new Promise((resolve) => setTimeout(resolve, 150)),
    stop: () => new Promise((resolve) => child.once("exit", resolve).kill()),
  };
}

describe("home archives", () => {
  it("keeps modes, links, empty directories, mtimes and long or odd names", async () => {
    const src = await tmp();
    const when = new Date("2024-03-04T05:06:07Z");
    await mkdir(path.join(src, "empty/inner"), { recursive: true });
    const modes = [
      ["ro.txt", 0o444],
      ["secret", 0o400],
      ["group.txt", 0o664],
      ["run.sh", 0o755],
    ] as const;
    for (const [name, mode] of modes) {
      await writeFile(path.join(src, name), name);
      await chmod(path.join(src, name), mode);
    }
    await mkdir(path.join(src, "locked"));
    await writeFile(path.join(src, "locked/x.txt"), "x");
    await utimes(path.join(src, "locked"), when, when);
    await chmod(path.join(src, "locked"), 0o555);
    await writeFile(path.join(src, "a.txt"), "A");
    await utimes(path.join(src, "a.txt"), when, when);
    await link(path.join(src, "a.txt"), path.join(src, "a-hard.txt"));
    await symlink("/outside/target", path.join(src, "absolute"));
    await symlink("../rel", path.join(src, "relative"));
    const deep = path.join(src, "a".repeat(90), "b".repeat(90), "c".repeat(90));
    await mkdir(deep, { recursive: true });
    await writeFile(path.join(deep, "long.txt"), "deep");
    await writeFile(path.join(src, "short\nname.txt"), "short");
    // tar's reader cannot read back a long path with a newline, so it is left out and reported.
    await writeFile(path.join(deep, "with\nnewline.txt"), "deep");

    const { out, skipped } = await roundTrip(src);
    expect(skipped).toEqual([path.relative(src, path.join(deep, "with\nnewline.txt"))]);
    for (const [name, mode] of [...modes, ["locked", 0o555] as const]) {
      expect(((await stat(path.join(out, name))).mode & 0o7777).toString(8)).toBe(mode.toString(8));
    }
    expect(await readFile(path.join(out, "locked/x.txt"), "utf8")).toBe("x");
    expect((await stat(path.join(out, "locked"))).mtime.getTime()).toBe(when.getTime());
    expect((await stat(path.join(out, "a.txt"))).mtime.getTime()).toBe(when.getTime());
    const [first, second] = await Promise.all([
      stat(path.join(out, "a.txt")),
      stat(path.join(out, "a-hard.txt")),
    ]);
    expect(second.ino).toBe(first.ino);
    expect(first.nlink).toBe(2);
    expect(await readlink(path.join(out, "absolute"))).toBe("/outside/target");
    expect(await readlink(path.join(out, "relative"))).toBe("../rel");
    expect((await stat(path.join(out, "empty/inner"))).isDirectory()).toBe(true);
    const deepOut = path.join(out, path.relative(src, deep));
    expect(await readFile(path.join(deepOut, "long.txt"), "utf8")).toBe("deep");
    expect(await readFile(path.join(out, "short\nname.txt"), "utf8")).toBe("short");
  });

  it("leaves browser caches out but not ordinary files", () => {
    expect(skipSnapshotPath("./.cache/pip/x")).toBe(true);
    expect(skipSnapshotPath("proj/node_modules/.cache/y")).toBe(true);
    expect(skipSnapshotPath("proj/src/cache.ts")).toBe(false);
  });

  it("extracts only into a directory that does not exist yet", async () => {
    const src = await tmp();
    await writeFile(path.join(src, "f.txt"), "f");
    const archive = path.join(await tmp(), "home.tgz");
    await packDirectory(src, archive);
    await expect(unpackArchive(archive, await tmp())).rejects.toThrow(/EEXIST/);
  });

  it("deletes a tree with read-only directories", async () => {
    const dir = await tmp();
    await mkdir(path.join(dir, "objects/ab"), { recursive: true });
    await writeFile(path.join(dir, "objects/ab/cd"), "o");
    await chmod(path.join(dir, "objects/ab/cd"), 0o444);
    await chmod(path.join(dir, "objects/ab"), 0o555);
    await chmod(path.join(dir, "objects"), 0o555);
    await removeTree(dir);
    await expect(stat(dir)).rejects.toThrow(/ENOENT/);
  });
});

describe("tampered archives", () => {
  const attacks = (out: string): Record<string, RawEntry[]> => ({
    "a file under an absolute symlink": [
      { path: "a", type: "SymbolicLink", linkpath: out },
      { path: "a/pwn.txt", type: "File", data: "pwned" },
    ],
    "a file under a relative symlink": [
      { path: "a", type: "SymbolicLink", linkpath: `${"../".repeat(40)}${out.slice(1)}` },
      { path: "a/pwn.txt", type: "File", data: "pwned" },
    ],
    "a nested file under a symlink": [
      { path: "a", type: "SymbolicLink", linkpath: out },
      { path: "a/sub/pwn.txt", type: "File", data: "pwned" },
    ],
    "a symlink whose case differs from the later path": [
      { path: "A", type: "SymbolicLink", linkpath: out },
      { path: "a/pwn.txt", type: "File", data: "pwned" },
    ],
    "an absolute hard link": [{ path: "h", type: "Link", linkpath: path.join(out, "secret.txt") }],
    "a hard link then a write through it": [
      { path: "h", type: "Link", linkpath: path.join(out, "secret.txt") },
      { path: "h", type: "File", data: "OVERWRITTEN" },
    ],
    "a relative hard link that leaves the target": [
      { path: "h", type: "Link", linkpath: "../outside/secret.txt" },
    ],
    "a hard link to an in-tree symlink": [
      { path: "s", type: "SymbolicLink", linkpath: path.join(out, "secret.txt") },
      { path: "h", type: "Link", linkpath: "s" },
    ],
    "a directory replaced by a symlink": [
      { path: "d/", type: "Directory", mode: 0o755 },
      { path: "d", type: "SymbolicLink", linkpath: out },
    ],
    "an absolute path": [{ path: "/rk-absolute.txt", type: "File", data: "pwned" }],
    "a dot-dot path": [{ path: "x/../../escape.txt", type: "File", data: "pwned" }],
  });

  for (const name of Object.keys(attacks("/x"))) {
    it(`rejects ${name} and leaves everything outside alone`, async () => {
      const out = await tmp();
      await writeFile(path.join(out, "secret.txt"), "precious");
      const before = await listTree(out);
      const archive = await rawArchive(attacks(out)[name]!);
      const root = await tmp();
      await expect(unpackArchive(archive, path.join(root, "files"))).rejects.toThrow(
        /unsafe entry/,
      );
      expect(await listTree(out)).toEqual(before);
      expect(await readFile(path.join(out, "secret.txt"), "utf8")).toBe("precious");
      expect((await stat(path.join(out, "secret.txt"))).nlink).toBe(1);
      expect(await readdir(root)).toEqual(["files"]);
      await expect(stat("/rk-absolute.txt")).rejects.toThrow();
    });
  }

  it("skips devices and FIFOs but extracts the rest", async () => {
    const archive = await rawArchive([
      { path: "fifo", type: "FIFO" },
      { path: "null", type: "CharacterDevice", mode: 0o666 },
      { path: "ok.txt", type: "File", data: "ok" },
    ]);
    const target = path.join(await tmp(), "files");
    await unpackArchive(archive, target);
    expect(await readdir(target)).toEqual(["ok.txt"]);
  });

  it("allows a hard link to a file earlier in the same archive", async () => {
    const archive = await rawArchive([
      { path: "a.txt", type: "File", data: "A" },
      { path: "b.txt", type: "Link", linkpath: "a.txt" },
    ]);
    const target = path.join(await tmp(), "files");
    await unpackArchive(archive, target);
    expect((await stat(path.join(target, "b.txt"))).ino).toBe(
      (await stat(path.join(target, "a.txt"))).ino,
    );
  });
});

describe("archiving a home an agent is changing", () => {
  it("never reads a file outside the home through a directory swapped for a symlink", async () => {
    const outsideDir = await tmp();
    await writeFile(path.join(outsideDir, "host-secret.txt"), "HOST SECRET");
    const home = await tmp();
    await mkdir(path.join(home, "d"));
    await writeFile(path.join(home, "d", "host-secret.txt"), "agent file");
    // Swaps home/d for a symlink to the host directory and back, as fast as it can.
    const swapper = background(
      `const fs=require("fs"),p=require("path");const [h,o]=process.argv.slice(1);
       const d=p.join(h,"d"),r=p.join(h,"d.real");
       const nap=()=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,Math.random()*2);
       for(;;){try{fs.renameSync(d,r);fs.symlinkSync(o,d);nap();fs.unlinkSync(d);fs.renameSync(r,d);nap()}catch{}}`,
      home,
      outsideDir,
    );
    await swapper.started;
    try {
      for (let i = 0; i < 100; i++) {
        const { out } = await roundTrip(home);
        for (const dir of ["d", "d.real"]) {
          // A stored symlink to the host directory is fine; host bytes inside the archive are not.
          if (!(await lstat(path.join(out, dir)).catch(() => null))?.isDirectory()) continue;
          const copy = await readFile(path.join(out, dir, "host-secret.txt"), "utf8").catch(
            () => null,
          );
          expect(copy).not.toBe("HOST SECRET");
        }
      }
    } finally {
      await swapper.stop();
    }
    expect(await readFile(path.join(outsideDir, "host-secret.txt"), "utf8")).toBe("HOST SECRET");
  }, 60_000);

  it("retries or leaves out files that are rewritten, truncated or deleted while read", async () => {
    const home = await tmp();
    const whole = "x".repeat(512 * 1024);
    await writeFile(path.join(home, "busy.txt"), whole);
    await writeFile(path.join(home, "steady.txt"), "steady");
    const churn = background(
      `const fs=require("fs"),p=require("path");const h=process.argv[1];const w="x".repeat(512*1024);
       (function t(){for(let i=0;i<20;i++){try{fs.truncateSync(p.join(h,"busy.txt"),1000);fs.writeFileSync(p.join(h,"busy.txt"),w)}catch{}
       try{fs.writeFileSync(p.join(h,"tmp"+(i%7)),"t")}catch{};try{fs.unlinkSync(p.join(h,"tmp"+((i+3)%7)))}catch{}}setImmediate(t)})();`,
      home,
    );
    await churn.started;
    try {
      for (let i = 0; i < 20; i++) {
        const { out, skipped } = await roundTrip(home);
        expect(await readFile(path.join(out, "steady.txt"), "utf8")).toBe("steady");
        const busy = await readFile(path.join(out, "busy.txt"), "utf8").catch(() => null);
        if (busy === null) expect(skipped).toContain("busy.txt");
        else expect(busy).toMatch(/^x*$/); // one consistent read, never stitched or zero-filled
      }
    } finally {
      await churn.stop();
    }
  }, 60_000);
});

describe("a 300 MB home", () => {
  it("saves and restores with bounded memory and without blocking the event loop", async () => {
    const source = await tmp();
    for (let i = 0; i < 30; i++) {
      const chunk =
        i % 10 === 0 ? randomBytes(10 * 1024 * 1024) : Buffer.alloc(10 * 1024 * 1024, i);
      await writeFile(path.join(source, `file-${i}.bin`), chunk);
    }
    const dataDir = await tmp();
    const artifactDir = await tmp();
    const row = {
      id: "c1",
      spaceId: "s",
      homeKey: "k",
      kind: "docker",
      homeRevision: "empty",
      homeSnapshotId: null,
      homePreviousSnapshotId: null,
    };
    const prisma = {
      computer: {
        findFirst: async () => ({ ...row }),
        updateMany: async ({ data }: { data: Partial<typeof row> }) => {
          Object.assign(row, data);
          return { count: 1 };
        },
      },
    };
    const ctx = {
      operationId: "o",
      traceId: "t",
      spaceId: "s",
      userId: "u",
      signal: new AbortController().signal,
    };
    const store = new ObjectAgentHomeStore(
      prisma as never,
      new LocalArtifactStore(artifactDir),
      dataDir,
    );

    const baseline = process.memoryUsage().rss;
    let peak = baseline;
    let worstLag = 0;
    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      worstLag = Math.max(worstLag, now - last - 50);
      last = now;
      peak = Math.max(peak, process.memoryUsage().rss);
    }, 50);
    try {
      await store.commit("k", source, ctx);
      const other = new ObjectAgentHomeStore(
        prisma as never,
        new LocalArtifactStore(artifactDir),
        await tmp(),
      );
      const live = await other.liveDirectory("k", ctx);
      expect((await stat(path.join(live, "file-29.bin"))).size).toBe(10 * 1024 * 1024);
    } finally {
      clearInterval(timer);
    }
    // A whole-file implementation holds the home several times over (about 900 MB here). Streaming
    // grew about 200 MB at both 300 MB and 600 MB of data, so the growth does not follow home size.
    expect(peak - baseline).toBeLessThan(260 * 1024 * 1024);
    expect(worstLag).toBeLessThan(2000);
  }, 180_000);
});
