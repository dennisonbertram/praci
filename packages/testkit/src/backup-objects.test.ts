import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Runs the real backup and restore scripts against throwaway MinIO and Postgres containers that
// this file starts and removes. Skipped when Docker is unavailable.
const repoRoot = path.resolve(import.meta.dirname, "../../..");
const docker = (() => {
  try {
    const found = execFileSync("/bin/sh", ["-c", "command -v docker"], { encoding: "utf8" }).trim();
    execFileSync(found, ["info"], { stdio: "ignore", timeout: 10_000 });
    return found;
  } catch {
    return "";
  }
})();

const suffix = `${process.pid}-${Date.now()}`;
const minioName = `rakazo-test-minio-${suffix}`;
const pgName = `rakazo-test-pg-${suffix}`;
const accessKey = "testaccesskey1";
const secretKey = "testsecretkey-not-real-1";
const bucket = "rakazo-test";
let root = "";
let checkout = "";
let endpoint = "";
let shimDir = "";

const run = (args: string[], input?: string) =>
  execFileSync(docker, args, { encoding: "utf8", input, timeout: 60_000 });

function curl(method: string, key: string, file?: string) {
  const args = [
    "-sS",
    "--fail",
    "-X",
    method,
    "--aws-sigv4",
    "aws:amz:us-east-1:s3",
    "--user",
    `${accessKey}:${secretKey}`,
  ];
  if (file) args.push("--data-binary", `@${file}`);
  const url = `${endpoint}/${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
  return spawnSync("/usr/bin/curl", [...args, url], {
    encoding: "buffer",
    timeout: 30_000,
    maxBuffer: 64 * 1024 * 1024,
  });
}

function script(name: string, env: Record<string, string> = {}, args: string[] = []) {
  return spawnSync("/bin/bash", [path.join(checkout, "scripts", name), ...args], {
    cwd: root,
    env: { PATH: `${shimDir}:${path.dirname(process.execPath)}:/usr/bin:/bin`, ...env },
    encoding: "utf8",
    timeout: 120_000,
  });
}

function setEnv(lines: string[]) {
  writeFileSync(path.join(checkout, ".env"), `${lines.join("\n")}\n`);
}

const s3Env = () => [
  `RAKAZO_S3_ENDPOINT=${endpoint}`,
  `RAKAZO_S3_BUCKET=${bucket}`,
  `RAKAZO_S3_ACCESS_KEY_ID=${accessKey}`,
  `RAKAZO_S3_SECRET_ACCESS_KEY=${secretKey}`,
  "RAKAZO_S3_FORCE_PATH_STYLE=true",
];

const objects: Record<string, Buffer> = {
  "artifacts/space-1/one.txt": Buffer.from("first invented object"),
  "homes/bot a/nested dir/ünï & co.bin": Buffer.from(
    Array.from({ length: 3_000_000 }, (_, i) => (i * 7) % 251),
  ),
  "empty-file": Buffer.alloc(0),
  "folder-marker/": Buffer.alloc(0),
};

function put(key: string, body: Buffer) {
  const file = path.join(root, "upload");
  writeFileSync(file, body);
  const result = curl("PUT", key, file);
  expect(result.status, result.stderr.toString()).toBe(0);
}

function expectBucketMatches() {
  for (const [key, body] of Object.entries(objects)) {
    if (key.endsWith("/")) continue;
    const result = curl("GET", key);
    expect(result.status, key).toBe(0);
    expect(Buffer.compare(result.stdout, body), key).toBe(0);
  }
}

describe.skipIf(!docker)("object storage backup and restore", () => {
  beforeAll(async () => {
    root = mkdtempSync(path.join(os.tmpdir(), "rakazo-backup-objects-"));
    checkout = path.join(root, "checkout with spaces");
    mkdirSync(path.join(checkout, "infra/compose"), { recursive: true });
    cpSync(path.join(repoRoot, "scripts"), path.join(checkout, "scripts"), { recursive: true });
    // Route `docker compose ... exec postgres ...` to the throwaway Postgres container.
    shimDir = path.join(root, "bin");
    mkdirSync(shimDir);
    writeFileSync(
      path.join(shimDir, "docker"),
      `#!/bin/bash
args=("$@")
for i in "\${!args[@]}"; do
  if [[ "\${args[$i]}" == "postgres" && "\${args[$((i-1))]}" == "-T" ]]; then
    exec ${docker} exec -i ${pgName} "\${args[@]:$((i+1))}"
  fi
done
exit 0
`,
    );
    chmodSync(path.join(shimDir, "docker"), 0o755);

    // Docker picks the host ports, so they are free by construction; readiness proves they work.
    run([
      "run",
      "-d",
      "--name",
      minioName,
      "-p",
      "127.0.0.1::9000",
      "-e",
      `MINIO_ROOT_USER=${accessKey}`,
      "-e",
      `MINIO_ROOT_PASSWORD=${secretKey}`,
      "quay.io/minio/minio:latest",
      "server",
      "/data",
    ]);
    run([
      "run",
      "-d",
      "--name",
      pgName,
      "-e",
      "POSTGRES_USER=rakazo",
      "-e",
      "POSTGRES_PASSWORD=test-not-real",
      "-e",
      "POSTGRES_DB=rakazo",
      "postgres:17-alpine",
    ]);
    const port = run(["port", minioName, "9000/tcp"]).trim().split("\n")[0].split(":").pop();
    endpoint = `http://127.0.0.1:${port}`;
    for (let attempt = 0; ; attempt++) {
      const live =
        spawnSync("/usr/bin/curl", ["-sf", `${endpoint}/minio/health/live`]).status === 0;
      const pg =
        spawnSync(docker, ["exec", pgName, "pg_isready", "-U", "rakazo", "-h", "127.0.0.1"])
          .status === 0;
      if (live && pg) break;
      if (attempt > 60) throw new Error("throwaway containers did not become ready");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    const created = curl("PUT", "");
    expect(created.status, created.stderr.toString()).toBe(0);
    run(
      ["exec", "-i", pgName, "psql", "-U", "rakazo", "-d", "rakazo"],
      "CREATE TABLE example (id integer); INSERT INTO example VALUES (42);",
    );
  }, 180_000);

  afterAll(() => {
    for (const name of [minioName, pgName])
      spawnSync(docker, ["rm", "-f", "-v", name], { stdio: "ignore" });
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it("backs up objects and Postgres, then restores both after the bucket and table are wiped", () => {
    setEnv(s3Env());
    for (const [key, body] of Object.entries(objects)) put(key, body);

    const backed = script("backup.sh", {}, ["one"]);
    expect(backed.status, backed.stderr).toBe(0);
    const out = path.join(checkout, "backups/one");
    const manifest = JSON.parse(readFileSync(path.join(out, "objects.manifest.json"), "utf8"));
    expect(manifest.count).toBe(Object.keys(objects).length);
    expect(manifest.objects.map((o: { key: string }) => o.key).sort()).toEqual(
      Object.keys(objects).sort(),
    );
    for (const entry of manifest.objects) expect(entry.size).toBe(objects[entry.key].length);
    expect(
      readFileSync(path.join(out, "objects/homes/bot a/nested dir/ünï & co.bin")).equals(
        objects["homes/bot a/nested dir/ünï & co.bin"],
      ),
    ).toBe(true);
    expect(existsSync(path.join(out, "objects/folder-marker"))).toBe(true);
    // Nothing secret reaches the output, the manifest, or the log.
    for (const text of [backed.stdout, backed.stderr, JSON.stringify(manifest)]) {
      expect(text).not.toContain(secretKey);
      expect(text).not.toContain(accessKey);
      expect(text).not.toContain(endpoint);
    }

    // Wipe the bucket contents and the table.
    for (const key of Object.keys(objects)) curl("DELETE", key);
    expect(curl("GET", "artifacts/space-1/one.txt").status).not.toBe(0);
    run(["exec", "-i", pgName, "psql", "-U", "rakazo", "-d", "rakazo"], "DROP TABLE example;");

    const restored = script("restore.sh", {}, [out]);
    expect(restored.status, restored.stderr).toBe(0);
    expect(restored.stdout).toContain("Restore complete");
    expectBucketMatches();
    const row = run([
      "exec",
      "-i",
      pgName,
      "psql",
      "-U",
      "rakazo",
      "-d",
      "rakazo",
      "-tA",
      "-c",
      "SELECT id FROM example",
    ]);
    expect(row.trim()).toBe("42");

    // A second backup of the restored bucket lists the same objects.
    expect(script("backup.sh", {}, ["two"]).status).toBe(0);
    const again = JSON.parse(
      readFileSync(path.join(checkout, "backups/two/objects.manifest.json"), "utf8"),
    );
    expect(again.objects).toEqual(manifest.objects);
  }, 180_000);

  it("skips objects when no object storage is configured", () => {
    setEnv(["EXAMPLE_SETTING=fake-value"]);
    const backed = script("backup.sh", {}, ["none"]);
    expect(backed.status, backed.stderr).toBe(0);
    expect(backed.stdout).toContain("No object storage configured");
    expect(existsSync(path.join(checkout, "backups/none/objects"))).toBe(false);
    expect(existsSync(path.join(checkout, "backups/none/objects.manifest.json"))).toBe(false);
    run(["exec", "-i", pgName, "psql", "-U", "rakazo", "-d", "rakazo"], "DROP TABLE example;");
    const restored = script("restore.sh", {}, [path.join(checkout, "backups/none")]);
    expect(restored.status, restored.stderr).toBe(0);
  }, 120_000);

  it.each([
    [
      "an unreachable endpoint",
      (lines: string[]) =>
        lines.map((l) =>
          l.startsWith("RAKAZO_S3_ENDPOINT") ? "RAKAZO_S3_ENDPOINT=http://127.0.0.1:1" : l,
        ),
    ],
    [
      "wrong credentials",
      (lines: string[]) =>
        lines.map((l) =>
          l.startsWith("RAKAZO_S3_SECRET") ? "RAKAZO_S3_SECRET_ACCESS_KEY=wrong-secret-value" : l,
        ),
    ],
    [
      "a partial configuration",
      (lines: string[]) => lines.filter((l) => !l.startsWith("RAKAZO_S3_BUCKET")),
    ],
  ])(
    "fails the backup with %s",
    (_name, change) => {
      setEnv(change(s3Env()));
      const result = script("backup.sh", {}, ["bad"]);
      expect(result.status).not.toBe(0);
      expect(result.stdout).not.toContain("Backup written");
      expect(result.stderr).not.toContain(secretKey);
    },
    60_000,
  );

  it("refuses to restore objects when storage is not configured", () => {
    setEnv(["EXAMPLE_SETTING=fake-value"]);
    const result = script("restore.sh", {}, [path.join(checkout, "backups/one")]);
    expect(result.status).not.toBe(0);
    expect(result.stdout).not.toContain("Restore complete");
  }, 60_000);
});
