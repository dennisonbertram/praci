import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const EMAIL = "mock-founder@demo.rakazo.test";

/** Reuses the stored demo login so a saved browser login survives down/up; creates the file (0600) if absent. */
export function loadOrCreateCredentials(file: string): { email: string; password: string } {
  if (existsSync(file)) {
    const text = readFileSync(file, "utf8");
    const email = text.match(/^email=(.+)$/m)?.[1];
    const password = text.match(/^password=(.+)$/m)?.[1];
    if (email && password) return { email, password };
  }
  const password = randomBytes(12).toString("hex");
  writeFileSync(file, `email=${EMAIL}\npassword=${password}\n`, { mode: 0o600 });
  return { email: EMAIL, password };
}
