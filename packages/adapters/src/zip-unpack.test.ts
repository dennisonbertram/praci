import { randomBytes } from "node:crypto";
import type { Zippable } from "fflate";
import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import type { ZipEntry, ZipSource } from "./zip-unpack.js";
import {
  bytesZipSource,
  isZipFile,
  listZip,
  streamZipEntry,
  ZIP_MAX_ENTRIES,
  ZipRefusal,
} from "./zip-unpack.js";

const text = (value: string) => new TextEncoder().encode(value);
const list = (zip: Uint8Array) => listZip(bytesZipSource(zip));
const readAll = async (zip: Uint8Array, entry: ZipEntry) => {
  const parts: Uint8Array[] = [];
  for await (const chunk of streamZipEntry(bytesZipSource(zip), entry)) parts.push(chunk);
  return Buffer.concat(parts);
};
const refusal = async (run: () => Promise<unknown>) => {
  try {
    await run();
  } catch (error) {
    return error instanceof ZipRefusal ? error.code : "other";
  }
  return "none";
};

describe("listZip", () => {
  it("lists files with their folders and reads their bytes", async () => {
    const zip = zipSync({
      "a.txt": text("alpha"),
      "docs/b.csv": text("x,y\n1,2"),
      "docs/deep/c.md": text("# c"),
      "empty-folder/": new Uint8Array(),
    });
    const entries = await list(zip);
    expect(entries.map((e) => [...e.folders, e.name].join("/")).sort()).toEqual([
      "a.txt",
      "docs/b.csv",
      "docs/deep/c.md",
    ]);
    const deep = entries.find((e) => e.name === "c.md");
    expect(deep?.folders).toEqual(["docs", "deep"]);
    expect((await readAll(zip, deep as never)).toString()).toBe("# c");
  });

  it("reads stored and deflated entries alike", async () => {
    const zip = zipSync({
      "s.txt": [text("stored"), { level: 0 }],
      "d.txt": text("a".repeat(5000)),
    });
    const read = async (name: string) => {
      const entry = (await list(zip)).find((e) => e.name === name);
      return (await readAll(zip, entry as never)).toString();
    };
    expect(await read("s.txt")).toBe("stored");
    expect(await read("d.txt")).toBe("a".repeat(5000));
  });

  it.each(["../evil.txt", "a/../../evil.txt", "/etc/passwd", "C:/windows/x.txt", "..\\evil.txt"])(
    "refuses the path %s",
    async (name) => {
      expect(await refusal(() => list(zipSync({ [name]: text("x") })))).toBe("unsafe");
    },
  );

  it("refuses a symlink", async () => {
    const zip = zipSync({
      link: [text("/etc/passwd"), { os: 3, attrs: 0o120777 << 16 }],
    } as Zippable);
    expect(await refusal(() => list(zip))).toBe("unsafe");
  });

  it("refuses a zip bomb by its compression ratio", async () => {
    const zip = zipSync({ "bomb.txt": new Uint8Array(8 * 1024 * 1024) });
    expect(zip.length).toBeLessThan(80_000);
    expect(await refusal(() => list(zip))).toBe("too-large");
  });

  it("stops inflating an entry that is bigger than it declared", async () => {
    const zip = zipSync({ "a.txt": text("a".repeat(2000)) });
    const [entry] = (await list(zip)) as [ZipEntry];
    expect(await refusal(() => readAll(zip, { ...entry, size: 10 }))).toBe("too-large");
    expect(await refusal(() => readAll(zip, { ...entry, size: 5000 }))).toBe("invalid");
  });

  it("refuses more than 10,000 files", async () => {
    const files: Zippable = {};
    for (let i = 0; i <= ZIP_MAX_ENTRIES; i++) files[`f${i}.txt`] = text("x");
    expect(await refusal(() => list(zipSync(files)))).toBe("too-many-files");
  });

  it("accepts a zip of 1,104 files", async () => {
    const files: Zippable = {};
    for (let i = 0; i < 1_104; i++) files[`f${i}.txt`] = text("x");
    expect(await list(zipSync(files))).toHaveLength(1_104);
  });

  it("refuses an encrypted zip", async () => {
    const zip = zipSync({ "a.txt": text("secret") });
    const v = new DataView(zip.buffer);
    for (let i = 0; i < zip.length - 4; i++) {
      if (v.getUint32(i, true) === 0x02014b50)
        v.setUint16(i + 8, v.getUint16(i + 8, true) | 1, true);
    }
    expect(await refusal(() => list(zip))).toBe("encrypted");
  });

  it("refuses bytes that are not a zip", async () => {
    expect(await refusal(() => list(text("not a zip at all, just text")))).toBe("invalid");
  });

  it("skips __MACOSX, .DS_Store and hidden files", async () => {
    const zip = zipSync({
      "__MACOSX/._a.txt": text("meta"),
      ".DS_Store": text("meta"),
      "docs/.hidden": text("h"),
      ".git/config": text("h"),
      "a.txt": text("keep"),
    });
    expect((await list(zip)).map((e) => e.name)).toEqual(["a.txt"]);
  });

  it("keeps a nested zip as a file", async () => {
    const inner = zipSync({ "in.txt": text("inside") });
    const zip = zipSync({ "inner.zip": inner });
    const entries = await list(zip);
    expect(entries.map((e) => e.name)).toEqual(["inner.zip"]);
    expect((await readAll(zip, entries[0] as never)).equals(Buffer.from(inner))).toBe(true);
  });
});

/** A central directory, end record and optional Zip64 records at a chosen (possibly huge) offset. */
function directorySource(
  files: Array<{ name: string; size: number; localOffset: number; zip64?: boolean }>,
  directoryOffset: number,
  declaredDirectorySize?: number,
): ZipSource {
  const u16 = (n: number) => Buffer.from(new Uint16Array([n]).buffer);
  const u32 = (n: number) => Buffer.from(new Uint32Array([n]).buffer);
  const u64 = (n: number) => Buffer.from(new BigUint64Array([BigInt(n)]).buffer);
  const entries = files.map((f) => {
    const name = Buffer.from(f.name);
    const extra = f.zip64
      ? Buffer.concat([u16(1), u16(24), u64(f.size), u64(f.size), u64(f.localOffset)])
      : Buffer.alloc(0);
    const big = f.zip64 ? 0xffffffff : 0;
    return Buffer.concat([
      u32(0x02014b50),
      u16(45),
      u16(45),
      u16(0),
      u16(0), // stored
      u32(0),
      u32(0),
      u32(big || f.size),
      u32(big || f.size),
      u16(name.length),
      u16(extra.length),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(big || f.localOffset),
      name,
      extra,
    ]);
  });
  const directory = Buffer.concat(entries);
  const zip64 = files.some((f) => f.zip64);
  const record = Buffer.concat([
    u32(0x06064b50),
    u64(44),
    u16(45),
    u16(45),
    u32(0),
    u32(0),
    u64(files.length),
    u64(files.length),
    u64(directory.length),
    u64(directoryOffset),
  ]);
  const locator = Buffer.concat([
    u32(0x07064b50),
    u32(0),
    u64(directoryOffset + directory.length),
    u32(1),
  ]);
  const eocd = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(zip64 ? 0xffff : files.length),
    u16(zip64 ? 0xffff : files.length),
    u32(zip64 ? 0xffffffff : (declaredDirectorySize ?? directory.length)),
    u32(zip64 ? 0xffffffff : directoryOffset),
    u16(0),
  ]);
  const tail = zip64
    ? Buffer.concat([directory, record, locator, eocd])
    : Buffer.concat([directory, eocd]);
  return {
    size: directoryOffset + tail.length,
    async *range(start, end) {
      // Bytes before the directory are never inspected here; they read as zeros.
      if (start < directoryOffset) yield Buffer.alloc(Math.min(end, directoryOffset) - start);
      if (end > directoryOffset) {
        yield tail.subarray(
          Math.max(start, directoryOffset) - directoryOffset,
          end - directoryOffset,
        );
      }
    },
  };
}

describe("listZip with large archives", () => {
  it("lists a Zip64 archive whose entry and offset are past 4 GB", async () => {
    const GB = 1024 ** 3;
    const source = directorySource(
      [
        {
          name: "huge/video.mov",
          size: Math.round(4.5 * GB),
          localOffset: Math.round(4.6 * GB),
          zip64: true,
        },
        { name: "small.txt", size: 10, localOffset: 100, zip64: true },
      ],
      9 * GB,
    );
    const entries = await listZip(source);
    expect(entries).toMatchObject([
      {
        folders: ["huge"],
        name: "video.mov",
        size: Math.round(4.5 * GB),
        localOffset: Math.round(4.6 * GB),
      },
      { folders: [], name: "small.txt", size: 10, localOffset: 100 },
    ]);
  });

  it("accepts entries that declare more than 500 MB in total", async () => {
    const MB = 1024 * 1024;
    const source = directorySource(
      [0, 1, 2].map((i) => ({ name: `part${i}.bin`, size: 400 * MB, localOffset: i * 400 * MB })),
      1200 * MB,
    );
    expect(await listZip(source)).toHaveLength(3);
  });

  it("refuses a central directory over 32 MiB", async () => {
    const source = directorySource(
      [{ name: "a.bin", size: 1, localOffset: 0 }],
      10,
      64 * 1024 * 1024,
    );
    expect(await refusal(() => listZip(source))).toBe("too-large");
  });
});

describe("streamZipEntry", () => {
  it("streams an entry larger than 50 MB reading only bounded ranges", async () => {
    const big = randomBytes(60 * 1024 * 1024);
    const zip = zipSync({ "big.bin": [big, { level: 0 }] });
    const ranges: number[] = [];
    const source: ZipSource = {
      size: zip.length,
      async *range(start, end) {
        ranges.push(end - start);
        for (let at = start; at < end; at += 1024 * 1024)
          yield zip.subarray(at, Math.min(end, at + 1024 * 1024));
      },
    };
    const [entry] = (await listZip(source)) as [ZipEntry];
    let total = 0;
    let largestChunk = 0;
    for await (const chunk of streamZipEntry(source, entry)) {
      total += chunk.length;
      largestChunk = Math.max(largestChunk, chunk.length);
    }
    expect(total).toBe(big.length);
    expect(largestChunk).toBeLessThanOrEqual(1024 * 1024);
    // The directory, the header and the data are separate small requests; none is the whole zip.
    expect(Math.max(...ranges.filter((r) => r !== entry.compressedSize))).toBeLessThan(1024 * 1024);
  });

  it("inflates a large deflated entry in bounded chunks", async () => {
    const data = Buffer.alloc(30 * 1024 * 1024);
    // Half random, half zeros: deflated, but not so well that the zip looks like a bomb.
    for (let i = 0; i < data.length; i += 2048) randomBytes(1024).copy(data, i);
    const zip = zipSync({ "d.bin": [data, { level: 1 }] });
    const [entry] = (await list(zip)) as [ZipEntry];
    expect(entry.method).toBe(8);
    let total = 0;
    let largest = 0;
    for await (const chunk of streamZipEntry(bytesZipSource(zip), entry)) {
      total += chunk.length;
      largest = Math.max(largest, chunk.length);
    }
    expect(total).toBe(data.length);
    expect(largest).toBeLessThan(16 * 1024 * 1024);
  });
});

it("recognises zips by type or name", () => {
  expect(isZipFile("x", "application/x-zip-compressed")).toBe(true);
  expect(isZipFile("data.ZIP", "application/octet-stream")).toBe(true);
  expect(isZipFile("data.docx", "application/octet-stream")).toBe(false);
});
