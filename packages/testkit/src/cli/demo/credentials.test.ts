import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { loadOrCreateCredentials } from "./credentials.js";

it("creates the login once with mode 0600, then reuses it", () => {
  const file = path.join(mkdtempSync(path.join(tmpdir(), "demo-cred-")), "creds");
  const first = loadOrCreateCredentials(file);
  expect(statSync(file).mode & 0o777).toBe(0o600);
  expect(loadOrCreateCredentials(file)).toEqual(first);
  writeFileSync(file, "email=a@b.test\npassword=keepme\n");
  expect(loadOrCreateCredentials(file)).toEqual({ email: "a@b.test", password: "keepme" });
  expect(readFileSync(file, "utf8")).toContain("keepme");
});
