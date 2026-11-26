import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  access,
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ScannerService, ScannerServiceOptions } from "./scanner.js";
import { createScanner } from "./scanner.js";
import * as setupStore from "./setup-store.js";

const fixtureBin = fileURLToPath(new URL("./fixtures/bin/", import.meta.url));
const scope = { userId: "user-one", spaceId: "space-one" };
const origin = "https://server.example.test";

interface Harness {
  root: string;
  userDataDir: string;
  outboxDir: string;
  scenarioPath: string;
  callsFile: string;
  optionsCallsFile: string;
  listCallsFile: string;
  startedFile: string;
  service: ScannerService;
  setScenario: (scenario: Record<string, unknown>) => Promise<void>;
  scanCalls: () => Promise<number>;
}

const harnesses: Harness[] = [];
let unblockOutboxWrite: (() => void) | null = null;
let unblockScannerSetup: (() => void) | null = null;

async function makeHarness(
  scenario: Record<string, unknown> = {},
  options: {
    now?: () => number;
    scanTimeoutMs?: number;
    pollTimeoutMs?: number;
    missing?: boolean;
    authorizeScope?: ScannerServiceOptions["authorizeScope"];
    prepareScanDirectory?: ScannerServiceOptions["prepareScanDirectory"];
  } = {},
): Promise<Harness> {
  const root = await mkdtemp(join(tmpdir(), "rakazo-scanner-test-"));
  const userDataDir = join(root, "user-data");
  const scenarioPath = join(root, "scenario.json");
  const callsFile = join(root, "scan-calls.txt");
  const optionsCallsFile = join(root, "options-calls.txt");
  const listCallsFile = join(root, "list-calls.txt");
  const startedFile = join(root, "scan-started.txt");
  const completeScenario = (value: Record<string, unknown>) => ({
    ...value,
    callsFile: value.callsFile ?? callsFile,
    optionsCallsFile: value.optionsCallsFile ?? optionsCallsFile,
    listCallsFile: value.listCallsFile ?? listCallsFile,
  });
  await writeFile(scenarioPath, JSON.stringify(completeScenario(scenario)), { mode: 0o600 });
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: options.missing ? "" : `${fixtureBin}${delimiter}${process.env.PATH ?? ""}`,
    RAKAZO_FAKE_SCANIMAGE_SCENARIO: scenarioPath,
  };
  const service = createScanner({
    userDataDir,
    env: environment,
    systemSearchDirectories: options.missing ? [] : undefined,
    pollIntervalMs: 60_000,
    pollTimeoutMs: options.pollTimeoutMs ?? 2_000,
    scanTimeoutMs: options.scanTimeoutMs ?? 5_000,
    now: options.now,
    authorizeScope: options.authorizeScope,
    prepareScanDirectory: options.prepareScanDirectory,
  });
  const result: Harness = {
    root,
    userDataDir,
    outboxDir: join(userDataDir, "scan-outbox"),
    scenarioPath,
    callsFile,
    optionsCallsFile,
    listCallsFile,
    startedFile,
    service,
    setScenario: async (value) =>
      writeFile(scenarioPath, JSON.stringify(completeScenario(value)), { mode: 0o600 }),
    scanCalls: async () => {
      try {
        return (await readFile(callsFile, "utf8")).trim().split("\n").filter(Boolean).length;
      } catch {
        return 0;
      }
    },
  };
  harnesses.push(result);
  return result;
}

async function useScope(service: ScannerService, userScope = scope, serverOrigin = origin) {
  await service.setScope(userScope, serverOrigin);
}

async function waitForFile(file: string) {
  for (let attempt = 0; attempt < 200; attempt++) {
    try {
      await access(file);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  throw new Error("Fake scanimage did not start.");
}

async function countLines(file: string) {
  try {
    return (await readFile(file, "utf8")).trim().split("\n").filter(Boolean).length;
  } catch {
    return 0;
  }
}

afterEach(async () => {
  unblockOutboxWrite?.();
  unblockOutboxWrite = null;
  unblockScannerSetup?.();
  unblockScannerSetup = null;
  vi.restoreAllMocks();
  await Promise.all(
    harnesses.splice(0).map(async ({ service, root }) => {
      await service.close();
      await rm(root, { recursive: true, force: true });
    }),
  );
});

describe("offline SANE scanner service", () => {
  it("drives the fake scanimage, writes a two-page PDF, and persists its digest privately", async () => {
    const scanTime = new Date(2026, 6, 15, 9, 7).getTime();
    const harness = await makeHarness({}, { now: () => scanTime });
    const delivered: unknown[] = [];
    harness.service.onDocument((document) => delivered.push(document));
    await harness.service.start();
    await useScope(harness.service);
    expect(harness.service.state().folder).toEqual(["Scans"]);
    await harness.service.setFolder(["folder_one"]);
    expect(harness.service.state().kind).toBe("ready");

    await harness.service.scan();
    const [document] = await harness.service.pending();
    expect(document).toBeDefined();
    expect(delivered).toHaveLength(1);
    expect(document?.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(document?.name).toBe("Scan 2026-07-15 09.07.pdf");
    expect(document?.pages).toBe(2);
    expect(document?.folder).toEqual(["folder_one"]);
    expect(Object.keys(harness.service.state())).not.toContain("documents");
    expect(document?.sha256).toBe(
      createHash("sha256")
        .update(document?.bytes ?? new Uint8Array())
        .digest("hex"),
    );
    const pdf = Buffer.from(document?.bytes ?? []);
    const pdfText = pdf.toString("latin1");
    expect(pdfText).toContain("/Filter /DCTDecode");
    expect(pdfText.match(/\/Subtype \/Image/g)).toHaveLength(2);
    expect(pdfText).toContain("/MediaBox [0 0 2.88 1.92]");
    expect(pdfText).toContain("/MediaBox [0 0 1.68 2.64]");
    const xrefOffset = Number(pdfText.match(/startxref\n(\d+)\n/)?.[1]);
    expect(pdf.subarray(xrefOffset, xrefOffset + 4).toString("ascii")).toBe("xref");
    expect(await harness.scanCalls()).toBe(1);

    const bundleDir = join(harness.outboxDir, document!.id);
    const pdfPath = join(bundleDir, `${document?.id}.pdf`);
    const metadataPath = join(bundleDir, `${document?.id}.json`);
    expect((await stat(harness.userDataDir)).mode & 0o777).toBe(0o700);
    expect((await stat(harness.outboxDir)).mode & 0o777).toBe(0o700);
    expect((await stat(bundleDir)).mode & 0o777).toBe(0o700);
    expect((await stat(pdfPath)).mode & 0o777).toBe(0o600);
    expect((await stat(metadataPath)).mode & 0o777).toBe(0o600);
    expect(await readdir(harness.outboxDir)).toEqual([document!.id]);
  });

  it("does not scan or auto-scan until a signed-in scope is selected", async () => {
    let now = 0;
    const harness = await makeHarness({ pageLoaded: "on" }, { now: () => now });
    await harness.service.start();
    now = 2_000;
    await harness.service.pollNow();
    expect(await harness.scanCalls()).toBe(0);
    await harness.service.scan();
    expect(await harness.scanCalls()).toBe(0);
    expect(harness.service.state().error).toContain("Sign in");
  });

  it("does not start a scan when the configured scope authorizer denies it", async () => {
    const authorizeScope = vi.fn(() => false);
    const harness = await makeHarness({}, { authorizeScope });
    await harness.service.start();
    await useScope(harness.service);

    await harness.service.scan();

    expect(authorizeScope).toHaveBeenCalledOnce();
    expect(await harness.scanCalls()).toBe(0);
  });

  it("waits for a stable loaded sensor and resets the auto-scan latch after the feeder clears", async () => {
    let now = 0;
    const harness = await makeHarness({ pageLoaded: "on" }, { now: () => now });
    await harness.service.start();
    await useScope(harness.service);

    now = 1_999;
    await harness.service.pollNow();
    expect(await harness.scanCalls()).toBe(0);
    now = 2_000;
    await harness.service.pollNow();
    expect(await harness.scanCalls()).toBe(1);
    now = 3_000;
    await harness.service.pollNow();
    expect(await harness.scanCalls()).toBe(1);

    await harness.setScenario({ pageLoaded: "off" });
    now = 4_000;
    await harness.service.pollNow();
    await harness.setScenario({ pageLoaded: "on" });
    now = 5_000;
    await harness.service.pollNow();
    now = 7_000;
    await harness.service.pollNow();
    expect(await harness.scanCalls()).toBe(2);
  });

  it("reports an empty feeder without creating an outbox document", async () => {
    const harness = await makeHarness({ pages: [] });
    await harness.service.start();
    await useScope(harness.service);
    await harness.service.scan();

    expect(harness.service.state().kind).toBe("error");
    expect(harness.service.state().error).toContain("No pages");
    expect(await harness.service.pending()).toEqual([]);
  });

  it("keeps the latched scan error until the feeder clears", async () => {
    const harness = await makeHarness({
      pageLoaded: "on",
      pages: ["page-one.jpg.b64"],
      scan: { exitCode: 1, stderr: "Paper jam" },
    });
    await harness.service.start();
    await useScope(harness.service);
    await harness.service.scan();
    const failed = harness.service.state().error;
    expect(failed).toContain("Clear the feeder");

    await harness.service.pollNow();
    expect(harness.service.state().kind).toBe("error");
    expect(harness.service.state().error).toBe(failed);

    await harness.setScenario({ pageLoaded: "off" });
    await harness.service.pollNow();
    expect(harness.service.state().kind).toBe("ready");
  });

  it("emits SANE's normal feeder-exhaustion diagnostic from the fake executable", async () => {
    const harness = await makeHarness({ pages: [] });
    const batch = join(harness.root, "page%03d.jpg");
    const child = spawn(
      join(fixtureBin, "scanimage"),
      [
        "-d",
        "fujitsu:ScanSnap iX1600:synthetic",
        "--source",
        "ADF Duplex",
        "--mode",
        "Color",
        "--resolution",
        "300",
        "--format=jpeg",
        `--batch=${batch}`,
        "--swskip=1",
      ],
      {
        env: {
          ...process.env,
          PATH: `${fixtureBin}${delimiter}${process.env.PATH ?? ""}`,
          RAKAZO_FAKE_SCANIMAGE_SCENARIO: harness.scenarioPath,
        },
        stdio: ["ignore", "ignore", "pipe"],
      },
    );
    const stderr: Buffer[] = [];
    child.stderr?.on("data", (chunk: Buffer) => stderr.push(chunk));
    const code = await new Promise<number | null>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    });
    expect(code).toBe(0);
    expect(Buffer.concat(stderr).toString("utf8")).toContain("Document feeder out of documents");
  });

  it("ignores unpublished staging bundles", async () => {
    const harness = await makeHarness();
    await harness.service.start();
    await useScope(harness.service);
    const stagingDir = join(harness.outboxDir, ".staging-incomplete");
    await mkdir(stagingDir, { mode: 0o700 });
    await writeFile(join(stagingDir, "partial.pdf"), "incomplete", { mode: 0o600 });

    expect(await harness.service.pending()).toEqual([]);
  });

  it("rejects a partial batch after a jam and does not expose device diagnostics", async () => {
    const harness = await makeHarness({
      pages: ["page-one.jpg.b64"],
      scan: { exitCode: 1, stderr: "Paper jam; confidential scanned text" },
    });
    await harness.service.start();
    await useScope(harness.service);
    await harness.service.scan();

    expect(harness.service.state().kind).toBe("error");
    expect(harness.service.state().error).toContain("Clear the feeder");
    expect(harness.service.state().error).not.toContain("confidential");
    expect(await harness.service.pending()).toEqual([]);
    expect(
      (await readdir(harness.userDataDir)).filter((name) => name.startsWith(".scan-pages-")),
    ).toEqual([]);
  });

  it("limits discovery to Fujitsu devices and represents a busy scanner safely", async () => {
    const missingVendor = await makeHarness({ device: null });
    await missingVendor.service.start();
    expect(missingVendor.service.state().kind).toBe("not-found");

    const busy = await makeHarness({ busy: true });
    await busy.service.start();
    await useScope(busy.service);
    expect(busy.service.state().kind).toBe("busy");
    await busy.service.scan();
    expect(await busy.scanCalls()).toBe(0);
  });

  it("reports a missing SANE executable", async () => {
    const harness = await makeHarness({}, { missing: true });
    await harness.service.start();
    expect(harness.service.state().kind).toBe("sane-missing");
  });

  it("names the scanner model without exposing its serial", async () => {
    const harness = await makeHarness();
    await harness.service.start();
    expect(harness.service.state().kind).toBe("ready");
    expect(harness.service.state().device).toBe("ScanSnap iX1600");
    expect(JSON.stringify(harness.service.state())).not.toContain("synthetic");
  });

  it("falls back to a generic name for a device without a model", async () => {
    const harness = await makeHarness({ device: "fujitsu:libusb:001:004" });
    await harness.service.start();
    expect(harness.service.state().kind).toBe("ready");
    expect(harness.service.state().device).toBe("Fujitsu scanner");
    expect(JSON.stringify(harness.service.state())).not.toContain("001:004");
  });

  it("points a busy scanner at the app that holds it", async () => {
    const harness = await makeHarness({ busy: true });
    await harness.service.start();
    expect(harness.service.state().kind).toBe("busy");
    expect(harness.service.state().error).toContain("ScanSnap Home");
  });

  it("tells a user without SANE to install the package, not to restart", async () => {
    const harness = await makeHarness({}, { missing: true });
    await harness.service.start();
    expect(harness.service.state().error).toContain("sane-backends");
    expect(harness.service.state().error).not.toContain("restart");
  });

  it("cancels a child scan and removes its temporary JPEG pages", async () => {
    const harness = await makeHarness(
      { startedFile: join(tmpdir(), "unused"), scan: { hold: true } },
      { scanTimeoutMs: 10_000 },
    );
    await harness.setScenario({ startedFile: harness.startedFile, scan: { hold: true } });
    await harness.service.start();
    await useScope(harness.service);
    const scanning = harness.service.scan();
    await waitForFile(harness.startedFile);
    await harness.service.cancel();
    await scanning;

    expect(harness.service.state().kind).toBe("ready");
    expect(await harness.service.pending()).toEqual([]);
    expect(
      (await readdir(harness.userDataDir)).filter((name) => name.startsWith(".scan-pages-")),
    ).toEqual([]);
  });

  it("does not start scanimage when canceled during temporary page setup", async () => {
    let setupEntered!: () => void;
    let releaseSetup!: () => void;
    const setupPaused = new Promise<void>((resolve) => {
      setupEntered = resolve;
    });
    const setupBarrier = new Promise<void>((resolve) => {
      releaseSetup = resolve;
    });
    unblockScannerSetup = releaseSetup;
    const prepareScanDirectory = async (directory: string) => {
      setupEntered();
      await setupBarrier;
      await chmod(directory, 0o700);
    };
    const harness = await makeHarness({}, { prepareScanDirectory });
    await harness.service.start();
    await useScope(harness.service);

    const scanning = harness.service.scan();
    await setupPaused;
    const cancelling = harness.service.cancel();
    releaseSetup();
    unblockScannerSetup = null;
    await Promise.all([scanning, cancelling]);

    expect(await harness.scanCalls()).toBe(0);
    expect(
      (await readdir(harness.userDataDir)).filter((name) => name.startsWith(".scan-pages-")),
    ).toEqual([]);
  });

  it("times out a stalled scan and removes its temporary pages", async () => {
    const harness = await makeHarness(
      { startedFile: join(tmpdir(), "unused"), scan: { hold: true } },
      { scanTimeoutMs: 80 },
    );
    await harness.setScenario({ startedFile: harness.startedFile, scan: { hold: true } });
    await harness.service.start();
    await useScope(harness.service);
    await harness.service.scan();

    expect(harness.service.state().kind).toBe("error");
    expect(harness.service.state().error).toContain("did not respond");
    expect(await harness.service.pending()).toEqual([]);
    expect(
      (await readdir(harness.userDataDir)).filter((name) => name.startsWith(".scan-pages-")),
    ).toEqual([]);
  });

  it("cancels and retains no new document when the selected scope changes mid-scan", async () => {
    const harness = await makeHarness({}, { scanTimeoutMs: 10_000 });
    await harness.service.start();
    await useScope(harness.service);
    await harness.service.scan();
    const [retained] = await harness.service.pending();
    expect(retained).toBeDefined();
    await harness.setScenario({ startedFile: harness.startedFile, scan: { hold: true } });
    const scanning = harness.service.scan();
    await waitForFile(harness.startedFile);
    await useScope(harness.service, { userId: "user-two", spaceId: "space-two" });
    await scanning;

    expect(harness.service.state().kind).toBe("ready");
    expect(await harness.service.pending()).toEqual([]);
    expect(await readdir(harness.outboxDir)).toEqual([retained!.id]);
    await useScope(harness.service);
    expect(await harness.service.pending()).toMatchObject([{ id: retained!.id }]);
  });

  it("finishes an atomic bundle under its captured scope when scope changes during commit", async () => {
    const harness = await makeHarness();
    const delivered: unknown[] = [];
    harness.service.onDocument((document) => delivered.push(document));
    await harness.service.start();
    await useScope(harness.service);

    let enteredWrite!: () => void;
    let releaseWrite!: () => void;
    const writeEntered = new Promise<void>((resolve) => {
      enteredWrite = resolve;
    });
    const writeBarrier = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    unblockOutboxWrite = releaseWrite;
    const originalWritePrivateFile = setupStore.writePrivateFile;
    vi.spyOn(setupStore, "writePrivateFile").mockImplementation(async (destination, contents) => {
      if (destination.includes(".staging-") && destination.endsWith(".json")) {
        enteredWrite();
        await writeBarrier;
      }
      await originalWritePrivateFile(destination, contents);
    });

    const scanning = harness.service.scan();
    await writeEntered;
    const switching = harness.service.setScope(
      { userId: "user-two", spaceId: "space-two" },
      origin,
    );
    releaseWrite();
    unblockOutboxWrite = null;
    await Promise.all([scanning, switching]);

    expect(delivered).toEqual([]);
    expect(await harness.service.pending()).toEqual([]);
    expect(await readdir(harness.outboxDir)).toHaveLength(1);
    await useScope(harness.service);
    const [retained] = await harness.service.pending();
    expect(retained?.name).toMatch(/^Scan \d{4}-\d{2}-\d{2} \d{2}\.\d{2}\.pdf$/);
    expect(delivered).toHaveLength(1);
  });

  it("captures the selected folder when a scan begins", async () => {
    const harness = await makeHarness({}, { scanTimeoutMs: 5_000 });
    await harness.setScenario({ startedFile: harness.startedFile, scan: { delayMs: 100 } });
    await harness.service.start();
    await useScope(harness.service);
    await harness.service.setFolder(["folder-before"]);
    const scanning = harness.service.scan();
    await waitForFile(harness.startedFile);
    await harness.service.setFolder(["folder-after"]);
    await scanning;

    const [document] = await harness.service.pending();
    expect(document?.folder).toEqual(["folder-before"]);
    expect(harness.service.state().folder).toEqual(["folder-after"]);
  });

  it("replays verified pending documents after service restart", async () => {
    const harness = await makeHarness();
    await harness.service.start();
    await useScope(harness.service);
    await harness.service.scan();
    const original = await harness.service.pending();
    expect(original).toHaveLength(1);
    await harness.service.close();

    const replay = createScanner({
      userDataDir: harness.userDataDir,
      env: {
        ...process.env,
        PATH: `${fixtureBin}${delimiter}${process.env.PATH ?? ""}`,
        RAKAZO_FAKE_SCANIMAGE_SCENARIO: harness.scenarioPath,
      },
      systemSearchDirectories: [],
      pollIntervalMs: 60_000,
    });
    const emitted: unknown[] = [];
    replay.onDocument((document) => emitted.push(document));
    await replay.setScope(scope, origin);
    expect(await replay.pending()).toHaveLength(1);
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({ id: original[0]?.id, sha256: original[0]?.sha256 });
    await replay.close();
  });

  it("blocks pending and confirmation across users, spaces, and server origins", async () => {
    const harness = await makeHarness();
    await harness.service.start();
    await useScope(harness.service);
    await harness.service.scan();
    const [document] = await harness.service.pending();
    expect(document).toBeDefined();

    for (const [nextScope, nextOrigin] of [
      [{ userId: "user-two", spaceId: "space-one" }, origin],
      [{ userId: "user-one", spaceId: "space-two" }, origin],
      [scope, "https://other.example.test"],
    ] as const) {
      await useScope(harness.service, nextScope, nextOrigin);
      expect(await harness.service.pending()).toEqual([]);
      expect(await harness.service.confirm(document!.id, document!.sha256)).toEqual({ ok: false });
    }

    await useScope(harness.service);
    expect(await harness.service.confirm("../outside", document!.sha256)).toEqual({ ok: false });
    expect(await harness.service.confirm(document!.id, "not-a-hash")).toEqual({ ok: false });
    expect(await harness.service.confirm(document!.id, "0".repeat(64))).toEqual({ ok: false });
    const bundleDir = join(harness.outboxDir, document!.id);
    await expect(access(join(bundleDir, `${document!.id}.pdf`))).resolves.toBeUndefined();
    expect(await harness.service.confirm(document!.id, document!.sha256)).toEqual({ ok: true });
    expect(await harness.service.pending()).toEqual([]);
    await expect(access(bundleDir)).rejects.toThrow();
  });

  it("does not follow a symlink substituted for an outbox PDF", async () => {
    const harness = await makeHarness();
    await harness.service.start();
    await useScope(harness.service);
    await harness.service.scan();
    const [document] = await harness.service.pending();
    const victim = join(harness.root, "outside.pdf");
    const pdfPath = join(harness.outboxDir, document!.id, `${document!.id}.pdf`);
    await writeFile(victim, "keep this file", { mode: 0o600 });
    await unlink(pdfPath);
    await symlink(victim, pdfPath);

    expect(await harness.service.confirm(document!.id, document!.sha256)).toEqual({ ok: false });
    expect(await readFile(victim, "utf8")).toBe("keep this file");
  });

  it("does not follow a symlink substituted for a ready outbox bundle", async () => {
    const harness = await makeHarness();
    await harness.service.start();
    await useScope(harness.service);
    await harness.service.scan();
    const [document] = await harness.service.pending();
    const bundleDir = join(harness.outboxDir, document!.id);
    const outsideDir = join(harness.root, "outside-bundle");
    const pdf = await readFile(join(bundleDir, `${document!.id}.pdf`));
    const metadata = await readFile(join(bundleDir, `${document!.id}.json`));
    await mkdir(outsideDir);
    await writeFile(join(outsideDir, `${document!.id}.pdf`), pdf, { mode: 0o600 });
    await writeFile(join(outsideDir, `${document!.id}.json`), metadata, { mode: 0o600 });
    await rm(bundleDir, { recursive: true });
    await symlink(outsideDir, bundleDir, "dir");

    expect(await harness.service.pending()).toEqual([]);
    expect(await harness.service.confirm(document!.id, document!.sha256)).toEqual({ ok: false });
    await expect(access(join(outsideDir, `${document!.id}.pdf`))).resolves.toBeUndefined();
  });

  it("validates user-visible metadata names independently of UUID storage paths", async () => {
    const harness = await makeHarness();
    await harness.service.start();
    await useScope(harness.service);
    await harness.service.scan();
    const [document] = await harness.service.pending();
    const metadataPath = join(harness.outboxDir, document!.id, `${document!.id}.json`);
    const metadata = JSON.parse(await readFile(metadataPath, "utf8")) as Record<string, unknown>;
    metadata.name = "../outside.pdf";
    await writeFile(metadataPath, JSON.stringify(metadata), { mode: 0o600 });

    expect(await harness.service.pending()).toEqual([]);
    expect(await harness.service.confirm(document!.id, document!.sha256)).toEqual({ ok: false });
    await expect(
      access(join(harness.outboxDir, document!.id, `${document!.id}.pdf`)),
    ).resolves.toBeUndefined();
  });

  it("does not create or write through a symlinked outbox directory", async () => {
    const harness = await makeHarness();
    await harness.service.start();
    await useScope(harness.service);
    const outsideParent = join(harness.root, "outside-parent");
    const outsideTarget = join(outsideParent, "outbox");
    await mkdir(outsideParent);
    await rm(harness.outboxDir, { recursive: true, force: true });
    await symlink(outsideTarget, harness.outboxDir, "dir");
    await harness.service.scan();

    expect(harness.service.state().kind).toBe("error");
    await expect(access(outsideTarget)).rejects.toThrow();
  });

  it("persists auto-scan and folder settings separately from the outbox", async () => {
    const harness = await makeHarness();
    await harness.service.start();
    await harness.service.setAutoScan(false);
    await harness.service.setFolder(["folder_one", "folder-two"]);
    await harness.service.close();

    const restarted = createScanner({
      userDataDir: harness.userDataDir,
      env: {
        ...process.env,
        PATH: `${fixtureBin}${delimiter}${process.env.PATH ?? ""}`,
        RAKAZO_FAKE_SCANIMAGE_SCENARIO: harness.scenarioPath,
      },
      systemSearchDirectories: [],
      pollIntervalMs: 60_000,
    });
    harnesses.push({ ...harness, service: restarted });
    await restarted.start();
    expect(restarted.state().autoScan).toBe(false);
    expect(restarted.state().folder).toEqual(["folder_one", "folder-two"]);
    const settings = await stat(join(harness.userDataDir, "scanner-settings.json"));
    expect(settings.mode & 0o777).toBe(0o600);
    await restarted.close();
  });

  it("times out polling commands and never overlaps poll cycles", async () => {
    const timeout = await makeHarness({ optionsHang: true }, { pollTimeoutMs: 80 });
    await timeout.service.start();
    expect(timeout.service.state().kind).toBe("error");
    expect(timeout.service.state().error).not.toContain("scanimage:");

    const harness = await makeHarness({ optionsCallsFile: join(tmpdir(), "unused") });
    await harness.setScenario({ optionsCallsFile: harness.optionsCallsFile });
    await harness.service.start();
    const before = await countLines(harness.optionsCallsFile);
    await harness.setScenario({ optionsCallsFile: harness.optionsCallsFile, optionsDelayMs: 100 });
    await Promise.all([harness.service.pollNow(), harness.service.pollNow()]);
    expect(await countLines(harness.optionsCallsFile)).toBe(before + 1);
  });

  it("stops an active poll command when the scanner service closes", async () => {
    const harness = await makeHarness({ optionsHang: true }, { pollTimeoutMs: 10_000 });
    const starting = harness.service.start();
    await waitForFile(harness.optionsCallsFile);
    await harness.service.close();
    await starting;
    expect(await countLines(harness.optionsCallsFile)).toBe(1);
  });

  it("rejects unsafe folder and scope values", async () => {
    const harness = await makeHarness();
    await harness.service.setFolder(["Legal", "Employment Contracts", "Résumé.v2 (final)"]);
    expect(harness.service.state().folder).toEqual([
      "Legal",
      "Employment Contracts",
      "Résumé.v2 (final)",
    ]);
    for (const folder of [
      [""],
      ["   "],
      ["."],
      [".."],
      ["Legal/Work"],
      ["Legal\\Work"],
      ["bad\nname"],
    ]) {
      await expect(harness.service.setFolder(folder)).rejects.toThrow();
    }
    await expect(
      harness.service.setScope({ userId: "../user", spaceId: "space" }, origin),
    ).rejects.toThrow();
    await expect(harness.service.setScope(scope, "file:///tmp")).rejects.toThrow();
  });

  it("lists devices once and keeps using the cached one across polls", async () => {
    const harness = await makeHarness();
    await harness.service.start();
    for (let poll = 0; poll < 5; poll++) await harness.service.pollNow();
    expect(await countLines(harness.listCallsFile)).toBe(1);
    expect(harness.service.state().kind).toBe("ready");
    expect(await countLines(harness.optionsCallsFile)).toBe(6);
  });

  it("reads an unplugged scanner as not-found without flashing an error", async () => {
    const harness = await makeHarness();
    await harness.service.start();
    const kinds: string[] = [];
    harness.service.onState((state) => kinds.push(state.kind));
    await harness.setScenario({ device: null, optionsUnlisted: true });
    await harness.service.pollNow();
    expect(harness.service.state().kind).toBe("not-found");
    expect(kinds).not.toContain("error");
    expect(await countLines(harness.listCallsFile)).toBe(2);

    await harness.setScenario({ device: "fujitsu:ScanSnap iX1600:synthetic" });
    await harness.service.pollNow();
    expect(harness.service.state().kind).toBe("ready");
    expect(harness.service.state().device).toBe("ScanSnap iX1600");
    expect(await countLines(harness.listCallsFile)).toBe(3);
  });

  it("keeps the cached scanner while another app holds it", async () => {
    const harness = await makeHarness({ busy: true });
    await harness.service.start();
    await harness.service.pollNow();
    await harness.service.pollNow();
    expect(harness.service.state().kind).toBe("busy");
    expect(await countLines(harness.listCallsFile)).toBe(1);
  });

  it("re-lists after three consecutive feeder timeouts", async () => {
    const harness = await makeHarness({ optionsHang: true }, { pollTimeoutMs: 80 });
    await harness.service.start();
    await harness.service.pollNow();
    await harness.service.pollNow();
    expect(harness.service.state().kind).toBe("error");
    expect(await countLines(harness.listCallsFile)).toBe(1);

    await harness.setScenario({});
    await harness.service.pollNow();
    expect(await countLines(harness.listCallsFile)).toBe(2);
    expect(harness.service.state().kind).toBe("ready");
  });

  it("reports a listed scanner whose feeder state keeps failing", async () => {
    const harness = await makeHarness({ optionsUnlisted: true });
    await harness.service.start();
    expect(harness.service.state().kind).toBe("error");
    expect(harness.service.state().error).toContain("The scan failed");
    await harness.service.pollNow();
    expect(harness.service.state().kind).toBe("error");
    // Each failing tick lists, retries the same device and lists again.
    expect(await countLines(harness.listCallsFile)).toBe(4);
  });
});
