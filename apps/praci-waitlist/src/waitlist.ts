import { createHash } from "node:crypto";

const MAX_EMAIL_LENGTH = 254;
const MAX_FIELD_LENGTH = 100;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const RATE_LIMIT = 5; // signups per IP per hour

export type JoinBody = { email: string; name?: string; company?: string; contactNote?: string };

export function parseJoinBody(value: unknown): JoinBody | null {
  if (typeof value === "string") {
    try {
      return parseJoinBody(JSON.parse(value));
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const { email, name, company, contactNote } = value as Record<string, unknown>;
  if (typeof email !== "string") return null;
  for (const field of [name, company, contactNote]) {
    if (field !== undefined && typeof field !== "string") return null;
  }
  return { email, name, company, contactNote } as JoinBody;
}

export function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) return null;
  return email;
}

/** Trims an optional free-text field; null when empty. */
export function cleanField(value: string | undefined): string | null {
  return value?.trim().slice(0, MAX_FIELD_LENGTH) || null;
}

/** Only a hash of the IP is stored, for rate limiting. */
export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}
