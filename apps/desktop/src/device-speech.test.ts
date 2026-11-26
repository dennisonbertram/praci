import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { DesktopSpeechStatus } from "@rakazo/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDeviceSpeech } from "./device-speech.js";
import { findHex } from "./hex-bridge.js";

const fixture = path.join(import.meta.dirname, "fixtures/fake-hex-service.mjs");
const command = () => [process.execPath, fixture];

function wav(size = 64, overrides: Record<number, number> = {}) {
  const bytes = new Uint8Array(size);
  bytes.set(new TextEncoder().encode("RIFF"), 0);
  bytes.set(new TextEncoder().encode("WAVE"), 8);
  bytes.set(new TextEncoder().encode("fmt "), 12);
  bytes[20] = 1;
  for (const [index, value] of Object.entries(overrides)) bytes[Number(index)] = value;
  return bytes;
}

let dir: string;
let pidFile: string;
const open: Array<{ close: () => Promise<void> }> = [];
const pids = () =>
  existsSync(pidFile) ? readFileSync(pidFile, "utf8").split("\n").filter(Boolean).map(Number) : [];
const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const eventually = async (check: () => boolean) => {
  for (let i = 0; i < 100 && !check(); i++) await new Promise((r) => setTimeout(r, 50));
  expect(check()).toBe(true);
};

function make(options: Partial<Parameters<typeof createDeviceSpeech>[0]> = {}) {
  const statuses: DesktopSpeechStatus[] = [];
  const speech = createDeviceSpeech({
    userDataDir: dir,
    command,
    supported: true,
    onStatus: (status) => statuses.push(status),
    ...options,
  });
  open.push(speech);
  return { speech, statuses };
}

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "device-speech-"));
  pidFile = path.join(dir, "pids");
  process.env.FAKE_HEX_PID_FILE = pidFile;
  process.env.FAKE_HEX_MODE = "ok";
  delete process.env.FAKE_HEX_CRASH_MARKER;
});
afterEach(async () => {
  for (const speech of open.splice(0)) await speech.close();
  for (const pid of pids()) if (alive(pid)) process.kill(pid, "SIGKILL");
  delete process.env.FAKE_HEX_PID_FILE;
  delete process.env.FAKE_HEX_MODE;
  delete process.env.FAKE_HEX_CRASH_MARKER;
  rmSync(dir, { recursive: true, force: true });
});

describe("findHex", () => {
  it("returns the first candidate that exists", () => {
    expect(findHex(["/a", "/b", "/c"], (file) => file !== "/a")).toBe("/b");
    expect(findHex(["/a"], () => false)).toBeUndefined();
  });
});

describe("device speech", () => {
  it("is unavailable off Apple silicon or without Hex", async () => {
    expect(await make({ supported: false }).speech.status()).toEqual({ state: "unavailable" });
    expect(await make({ command: () => undefined }).speech.status()).toEqual({
      state: "unavailable",
    });
    const { speech } = make({ supported: false });
    expect(await speech.prepare()).toEqual({ state: "unavailable" });
    expect(await speech.transcribe(wav())).toEqual({ ok: false, retry: true });
    expect(pids()).toEqual([]);
  });

  it("prepares with progress, remembers the choice, then transcribes", async () => {
    process.env.FAKE_HEX_MODE = "download";
    const { speech, statuses } = make();
    expect(await speech.status()).toEqual({ state: "not-prepared" });
    expect(await speech.prepare()).toEqual({ state: "ready" });
    expect(statuses).toContainEqual({ state: "preparing", progress: 0.5 });
    expect(statuses).toContainEqual({ state: "preparing", progress: null });
    expect(statuses.at(-1)).toEqual({ state: "ready" });
    expect(JSON.parse(readFileSync(path.join(dir, "speech.json"), "utf8"))).toEqual({
      model: "parakeet_unified_en",
    });
    expect(await speech.transcribe(wav(100))).toEqual({ ok: true, text: "heard 100 bytes" });
  });

  it("is ready after a restart and creates the helper lazily", async () => {
    writeFileSync(path.join(dir, "speech.json"), '{"model":"parakeet_unified_en"}');
    const { speech } = make();
    expect(await speech.status()).toEqual({ state: "ready" });
    expect(pids()).toEqual([]);
    expect(await speech.transcribe(wav())).toEqual({ ok: true, text: "heard 64 bytes" });
    expect(pids()).toHaveLength(1);
  });

  it("forget deletes the choice and stops the helper", async () => {
    const { speech } = make();
    await speech.prepare();
    const [pid] = pids();
    expect(await speech.forget()).toEqual({ state: "not-prepared" });
    expect(existsSync(path.join(dir, "speech.json"))).toBe(false);
    await eventually(() => !alive(pid as number));
    expect(await speech.transcribe(wav())).toEqual({ ok: false, retry: true });
  });

  it("a lazy create that would download goes back to not-prepared", async () => {
    process.env.FAKE_HEX_MODE = "download";
    writeFileSync(path.join(dir, "speech.json"), '{"model":"parakeet_unified_en"}');
    const { speech } = make();
    expect(await speech.transcribe(wav())).toEqual({ ok: false, retry: true });
    expect(await speech.status()).toEqual({ state: "not-prepared" });
    expect(existsSync(path.join(dir, "speech.json"))).toBe(false);
    await eventually(() => pids().every((pid) => !alive(pid)));
  });

  it("times out a hung request, retryable, and leaves no helper behind", async () => {
    const { speech } = make({ timeoutMs: 400 });
    await speech.prepare();
    process.env.FAKE_HEX_MODE = "hang";
    // The running helper keeps its prepare-time mode; restart it by forgetting and re-preparing.
    await speech.forget();
    await speech.prepare();
    const result = await speech.transcribe(wav());
    expect(result).toEqual({ ok: false, retry: true });
    await eventually(() => pids().every((pid) => !alive(pid)));
  });

  it("close aborts an in-flight request and kills the helper", async () => {
    process.env.FAKE_HEX_MODE = "hang";
    const { speech } = make();
    await speech.prepare();
    const pending = speech.transcribe(wav());
    await new Promise((r) => setTimeout(r, 200));
    await speech.close();
    expect(await pending).toEqual({ ok: false, retry: true });
    await eventually(() => pids().every((pid) => !alive(pid)));
  });

  it("a crashed helper is retryable and the next call starts a new one", async () => {
    process.env.FAKE_HEX_MODE = "crash";
    process.env.FAKE_HEX_CRASH_MARKER = path.join(dir, "crashed");
    const { speech } = make();
    await speech.prepare();
    expect(await speech.transcribe(wav())).toEqual({ ok: false, retry: true });
    expect(await speech.transcribe(wav(80))).toEqual({ ok: true, text: "heard 80 bytes" });
    expect(pids()).toHaveLength(2);
  });

  it("refuses non-WAV and oversized input before starting a helper", async () => {
    writeFileSync(path.join(dir, "speech.json"), '{"model":"parakeet_unified_en"}');
    const { speech } = make();
    const refused = { ok: false, retry: false };
    expect(await speech.transcribe("not bytes")).toEqual(refused);
    expect(await speech.transcribe(new Uint8Array(10))).toEqual(refused);
    expect(await speech.transcribe(wav(64, { 0: 0x58 }))).toEqual(refused);
    expect(await speech.transcribe(wav(64, { 8: 0x58 }))).toEqual(refused);
    expect(await speech.transcribe(wav(64, { 20: 3 }))).toEqual(refused);
    expect(await speech.transcribe(wav(16 * 1024 * 1024 + 1))).toEqual(refused);
    expect(pids()).toEqual([]);
  });

  it("a failed lazy create is retryable and does not make the state sticky", async () => {
    writeFileSync(path.join(dir, "speech.json"), '{"model":"parakeet_unified_en"}');
    const { speech } = make({ command: () => [process.execPath, path.join(dir, "missing.mjs")] });
    expect(await speech.transcribe(wav())).toEqual({ ok: false, retry: true });
    expect(await speech.status()).toEqual({ state: "ready" });
  });

  it("forget aborts an in-flight prepare and kills its helper", async () => {
    process.env.FAKE_HEX_MODE = "hangprepare";
    const { speech } = make();
    const preparing = speech.prepare();
    await eventually(() => pids().length === 1);
    const started = Date.now();
    expect(await speech.forget()).toEqual({ state: "not-prepared" });
    expect(Date.now() - started).toBeLessThan(5000);
    await preparing;
    await eventually(() => pids().every((pid) => !alive(pid)));
  });

  it("close aborts an in-flight prepare", async () => {
    process.env.FAKE_HEX_MODE = "hangprepare";
    const { speech } = make();
    const preparing = speech.prepare();
    await eventually(() => pids().length === 1);
    await speech.close();
    await preparing;
    await eventually(() => pids().every((pid) => !alive(pid)));
  });

  it("closes the helper when saving the choice fails", async () => {
    const { speech } = make({
      fs: {
        read: async () => null,
        write: async () => {
          throw new Error(`EACCES: ${dir}/speech.json`);
        },
        remove: async () => {},
      },
    });
    expect(await speech.prepare()).toEqual({ state: "error" });
    await eventually(() => pids().every((pid) => !alive(pid)));
  });

  it("maps filesystem failures to statuses without paths", async () => {
    const boom = async () => {
      throw new Error(`EACCES: ${dir}/speech.json`);
    };
    const { speech } = make({ fs: { read: boom, write: boom, remove: boom } });
    const results = [
      await speech.status(),
      await speech.forget(),
      await speech.prepare(),
      await speech.transcribe(wav()),
    ];
    expect(results[0]).toEqual({ state: "error" });
    expect(results[3]).toEqual({ ok: false, retry: true });
    expect(JSON.stringify(results)).not.toContain(dir);
  });

  it("never exposes the helper token", async () => {
    process.env.FAKE_HEX_MODE = "download";
    const { speech, statuses } = make();
    const seen = [await speech.status(), await speech.prepare(), await speech.transcribe(wav())];
    process.env.FAKE_HEX_MODE = "hang";
    const failed = await make({ timeoutMs: 200 }).speech.transcribe(wav());
    expect(JSON.stringify([seen, statuses, failed])).not.toContain("FAKE-TOKEN");
  });
});
