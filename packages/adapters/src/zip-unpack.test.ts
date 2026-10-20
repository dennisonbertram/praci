import type { Zippable } from "fflate";
import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import type { ZipEntry } from "./zip-unpack.js";
import { isZipFile, listZip, readZipEntry, ZipRefusal } from "./zip-unpack.js";

const text = (value: string) => new TextEncoder().encode(value);
const LIMIT = { maxEntryBytes: 10 * 1024 * 1024 };
const refusal = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return error instanceof ZipRefusal ? error.code : "other";
  }
  return "none";
};

describe("listZip", () => {
  it("lists files with their folders and reads their bytes", () => {
    const zip = zipSync({
      "a.txt": text("alpha"),
      "docs/b.csv": text("x,y\n1,2"),
      "docs/deep/c.md": text("# c"),
      "empty-folder/": new Uint8Array(),
    });
    const { entries } = listZip(zip, LIMIT);
    expect(entries.map((e) => [...e.folders, e.name].join("/")).sort()).toEqual([
      "a.txt",
      "docs/b.csv",
      "docs/deep/c.md",
    ]);
    const deep = entries.find((e) => e.name === "c.md");
    expect(deep?.folders).toEqual(["docs", "deep"]);
    expect(new TextDecoder().decode(readZipEntry(zip, deep as never))).toBe("# c");
  });

  it("reads stored and deflated entries alike", () => {
    const zip = zipSync({
      "s.txt": [text("stored"), { level: 0 }],
      "d.txt": text("a".repeat(5000)),
    });
    const read = (name: string) => {
      const entry = listZip(zip, LIMIT).entries.find((e) => e.name === name);
      return new TextDecoder().decode(readZipEntry(zip, entry as never));
    };
    expect(read("s.txt")).toBe("stored");
    expect(read("d.txt")).toBe("a".repeat(5000));
  });

  it.each(["../evil.txt", "a/../../evil.txt", "/etc/passwd", "C:/windows/x.txt", "..\\evil.txt"])(
    "refuses the path %s",
    (name) => {
      expect(refusal(() => listZip(zipSync({ [name]: text("x") }), LIMIT))).toBe("unsafe");
    },
  );

  it("refuses a symlink", () => {
    const zip = zipSync({
      link: [text("/etc/passwd"), { os: 3, attrs: 0o120777 << 16 }],
    } as Zippable);
    expect(refusal(() => listZip(zip, LIMIT))).toBe("unsafe");
  });

  it("refuses a zip bomb by its compression ratio", () => {
    const zip = zipSync({ "bomb.txt": new Uint8Array(8 * 1024 * 1024) });
    expect(zip.length).toBeLessThan(80_000);
    expect(refusal(() => listZip(zip, LIMIT))).toBe("too-large");
  });

  it("stops inflating an entry that is bigger than it declared", () => {
    const zip = zipSync({ "a.txt": text("a".repeat(2000)) });
    const [entry] = listZip(zip, LIMIT).entries as [ZipEntry];
    expect(refusal(() => readZipEntry(zip, { ...entry, size: 10 }))).toBe("too-large");
  });

  it("refuses more than 1,000 files", () => {
    const files: Zippable = {};
    for (let i = 0; i < 1001; i++) files[`f${i}.txt`] = text("x");
    expect(refusal(() => listZip(zipSync(files), LIMIT))).toBe("too-large");
  });

  it("refuses an encrypted zip", () => {
    const zip = zipSync({ "a.txt": text("secret") });
    const view = new DataView(zip.buffer);
    for (let i = 0; i < zip.length - 4; i++) {
      if (view.getUint32(i, true) === 0x02014b50)
        view.setUint16(i + 8, view.getUint16(i + 8, true) | 1, true);
    }
    expect(refusal(() => listZip(zip, LIMIT))).toBe("encrypted");
  });

  it("refuses bytes that are not a zip", () => {
    expect(refusal(() => listZip(text("not a zip at all, just text"), LIMIT))).toBe("invalid");
  });

  it("skips __MACOSX, .DS_Store and hidden files, and counts oversized ones", () => {
    const zip = zipSync({
      "__MACOSX/._a.txt": text("meta"),
      ".DS_Store": text("meta"),
      "docs/.hidden": text("h"),
      ".git/config": text("h"),
      "a.txt": text("keep"),
      "big.bin": new Uint8Array(2000).map((_, i) => i * 7),
    });
    const { entries, oversized } = listZip(zip, { maxEntryBytes: 1000 });
    expect(entries.map((e) => e.name)).toEqual(["a.txt"]);
    expect(oversized).toBe(1);
  });

  it("keeps a nested zip as a file", () => {
    const inner = zipSync({ "in.txt": text("inside") });
    const zip = zipSync({ "inner.zip": inner });
    const { entries } = listZip(zip, LIMIT);
    expect(entries.map((e) => e.name)).toEqual(["inner.zip"]);
    expect(readZipEntry(zip, entries[0] as never)).toEqual(inner);
  });
});

it("recognises zips by type or name", () => {
  expect(isZipFile("x", "application/x-zip-compressed")).toBe(true);
  expect(isZipFile("data.ZIP", "application/octet-stream")).toBe(true);
  expect(isZipFile("data.docx", "application/octet-stream")).toBe(false);
});
