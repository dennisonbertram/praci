import { createHash, randomBytes, randomInt } from "node:crypto";

const MAX_EMAIL_LENGTH = 254;
const MAX_FIELD_LENGTH = 100;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const RATE_LIMIT = 5; // signups per IP per hour

// No 0/O/1/I/L so codes survive being read aloud or retyped.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;
// Each confirmed referral moves the referrer up this many places.
export const REFERRAL_BUMP = 10;
export const RESEND_THROTTLE_SECONDS = 60;

export type JoinBody = {
  email: string;
  name?: string;
  company?: string;
  ref?: string;
  contactNote?: string;
};

export function parseJoinBody(value: unknown): JoinBody | null {
  if (typeof value === "string") {
    try {
      return parseJoinBody(JSON.parse(value));
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const { email, name, company, ref, contactNote } = value as Record<string, unknown>;
  if (typeof email !== "string") return null;
  for (const field of [name, company, ref, contactNote]) {
    if (field !== undefined && typeof field !== "string") return null;
  }
  return { email, name, company, ref, contactNote } as JoinBody;
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

export function parseTokenBody(value: unknown): string | null {
  if (typeof value === "string") {
    try {
      return parseTokenBody(JSON.parse(value));
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const token = (value as Record<string, unknown>).token;
  return typeof token === "string" && token.length > 0 && token.length <= 128 ? token : null;
}

export function generateReferralCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

/** Returns the normalized code, or null when it cannot be a real code. */
export function normalizeRef(value: string | undefined): string | null {
  const code = value?.trim().toUpperCase();
  if (!code || code.length !== CODE_LENGTH) return null;
  return [...code].every((c) => CODE_ALPHABET.includes(c)) ? code : null;
}

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
