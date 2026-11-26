import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHexRunner, hexCandidates } from "./hex-bridge.js";

const meeting = {
  id: "1790000500000-1002",
  title: "Invented call",
  timestamp_ms: 1_790_000_500_000,
  duration_ms: 600_000,
  application: "Zoom",
  status: "complete",
  in_progress: false,
  transcript_source: "final",
  warnings: [],
};
const list = {
  version: 1,
  meetings: [meeting],
  skipped: [],
  truncated: false,
  extra: "ignored",
};
const show = {
  version: 1,
  meeting,
  notes: null,
  entries: [{ source: "microphone", start_ms: 0, end_ms: 900, text: "Hello" }],
};

const dirs: string[] = [];
function fake(body: string) {
  const dir = mkdtempSync(path.join(tmpdir(), "hex-fake-"));
  dirs.push(dir);
  const file = path.join(dir, "hex");
  writeFileSync(file, `#!/bin/sh\n${body}\n`);
  chmodSync(file, 0o755);
  return file;
}
const prints = (value: unknown) => `printf '%s' '${JSON.stringify(value)}'`;
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("hex candidates", () => {
  it("are exactly the two app bundle paths", () => {
    expect(hexCandidates("/Users/example")).toEqual([
      "/Applications/Hex.app/Contents/MacOS/hex",
      "/Users/example/Applications/Hex.app/Contents/MacOS/hex",
    ]);
  });
});

describe("hex runner", () => {
  it("runs a fixed argument list without a shell and parses the list", async () => {
    const exec = vi.fn(
      (_file: string, _args: string[], _options: object, done: (...args: unknown[]) => void) =>
        done(null, JSON.stringify(list), ""),
    );
    const runner = createHexRunner({
      candidates: ["/hex-a"],
      exists: () => true,
      exec: exec as never,
    });
    const result = await runner.list(1_790_000_000_000);
    expect(result).toEqual({
      state: "ok",
      value: expect.objectContaining({ meetings: [expect.any(Object)] }),
    });
    expect(exec).toHaveBeenCalledTimes(1);
    const [file, args, options] = exec.mock.calls[0] as unknown as [
      string,
      string[],
      Record<string, unknown>,
    ];
    expect(file).toBe("/hex-a");
    expect(args).toEqual([
      "meetings",
      "list",
      "--since",
      new Date(1_790_000_000_000).toISOString(),
      "--json",
    ]);
    expect(options.shell).toBeFalsy();
    expect(options.timeout).toBe(15_000);
    expect(options.maxBuffer).toBe(4 * 1024 * 1024);
  });

  it("builds show arguments from a validated id only", async () => {
    const exec = vi.fn((_f: string, _a: string[], _o: object, done: (...args: unknown[]) => void) =>
      done(null, JSON.stringify(show), ""),
    );
    const runner = createHexRunner({
      candidates: ["/hex-a"],
      exists: () => true,
      exec: exec as never,
    });
    expect((await runner.show("1790000500000-1002")).state).toBe("ok");
    expect(exec.mock.calls[0]?.[1]).toEqual(["meetings", "show", "1790000500000-1002", "--json"]);
    for (const bad of ["latest", "--md", "1-2; rm -rf /", "../1-2", "12", "1-2\n"]) {
      expect(await runner.show(bad)).toEqual({ state: "failed" });
    }
    expect(await runner.list(Number.NaN)).toEqual({ state: "failed" });
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it("never searches PATH: with no candidate present it runs nothing", async () => {
    const exec = vi.fn();
    const runner = createHexRunner({
      candidates: ["/nope-a", "/nope-b"],
      exists: () => false,
      exec: exec as never,
    });
    expect(await runner.list(0)).toEqual({ state: "not_found" });
    expect(await runner.available()).toBe(false);
    expect(exec).not.toHaveBeenCalled();
  });

  it("runs a real executable and parses its output", async () => {
    const file = fake(prints(list));
    const runner = createHexRunner({ candidates: ["/missing", file] });
    expect(await runner.available()).toBe(true);
    const result = await runner.list(1_790_000_000_000);
    expect(result.state).toBe("ok");
  });

  it("records the exact arguments the script receives", async () => {
    const file = fake(`printf '%s\\n' "$@" > "$0.args"\n${prints(show)}`);
    const runner = createHexRunner({ candidates: [file] });
    expect((await runner.show("1790000500000-1002")).state).toBe("ok");
    expect(readFileSync(`${file}.args`, "utf8")).toBe(
      "meetings\nshow\n1790000500000-1002\n--json\n",
    );
  });

  it("answers failed for a non-zero exit, even with valid JSON on stdout", async () => {
    const file = fake(`${prints(list)}\nexit 3`);
    expect(await createHexRunner({ candidates: [file] }).list(0)).toEqual({
      state: "failed",
    });
  });

  it("answers failed for output over the cap", async () => {
    const file = fake(`${prints(list)}`);
    const runner = createHexRunner({ candidates: [file], maxOutputBytes: 50 });
    expect(await runner.list(0)).toEqual({ state: "failed" });
  });

  it("answers failed for output that is not JSON", async () => {
    const file = fake(`printf 'not json'`);
    expect(await createHexRunner({ candidates: [file] }).list(0)).toEqual({
      state: "failed",
    });
  });

  it("answers failed when Hex does not finish in time", async () => {
    const file = fake("while :; do :; done");
    const runner = createHexRunner({ candidates: [file], timeoutMs: 200 });
    expect(await runner.list(0)).toEqual({ state: "failed" });
  });

  it("answers update for another version or a changed shape", async () => {
    const v2 = fake(prints({ version: 2, meetings: [] }));
    expect(await createHexRunner({ candidates: [v2] }).list(0)).toEqual({
      state: "update",
    });
    const changed = fake(prints({ version: 1, meetings: "none", truncated: false }));
    expect(await createHexRunner({ candidates: [changed] }).list(0)).toEqual({
      state: "update",
    });
  });
});
