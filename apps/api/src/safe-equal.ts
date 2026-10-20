import { createHash, timingSafeEqual } from "node:crypto";

/** Constant-time string comparison that is safe for inputs of different lengths. */
export function safeEqual(a: string, b: string): boolean {
  const digest = (v: string) => createHash("sha256").update(v).digest();
  return timingSafeEqual(digest(a), digest(b));
}
