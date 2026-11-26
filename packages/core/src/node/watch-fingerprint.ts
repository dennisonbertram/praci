import { createHash } from "node:crypto";

/** sha256 hex of the normalized page text. Lives under core/node because it needs node:crypto. */
export function fingerprintText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
