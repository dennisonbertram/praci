import { insertSignup, isUniqueViolation, releaseThrottle, rotateToken } from "../src/db.js";
import { linkMail, sendEmail } from "../src/email.js";
import { json, readPostBody } from "../src/http.js";
import {
  generateReferralCode,
  generateToken,
  hashToken,
  normalizeEmail,
  normalizeRef,
  parseJoinBody,
} from "../src/waitlist.js";

async function join(request: Request) {
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });

  const raw = await readPostBody(request);
  const body = raw === null ? null : parseJoinBody(raw);
  if (!body) return json(400, { error: "Invalid request" });

  // A hidden field catches basic form spam without confirming the trap to bots.
  if (body.contactNote?.trim()) return json(200, { ok: true });

  const email = normalizeEmail(body.email);
  if (!email) return json(400, { error: "Enter a valid email address" });

  try {
    const token = generateToken();
    const tokenHash = hashToken(token);

    let confirmed: boolean | null = null;
    const rotated = await rotateToken(email, tokenHash);
    if (rotated) {
      confirmed = rotated.confirmed;
    } else {
      const refCode = normalizeRef(body.ref);
      let inserted: boolean | undefined;
      for (let attempt = 0; attempt < 2 && inserted === undefined; attempt++) {
        try {
          inserted = await insertSignup(email, generateReferralCode(), refCode, tokenHash);
        } catch (error) {
          // Retry once on a referral code collision.
          if (attempt === 1 || !isUniqueViolation(error)) throw error;
        }
      }
      if (inserted) confirmed = false;
      // Otherwise the email exists and was mailed recently: stay silent, same response.
    }

    if (confirmed !== null && !(await sendEmail(linkMail(email, token, confirmed)))) {
      await releaseThrottle(email);
      return json(503, { error: "Unavailable" });
    }
    return json(200, { ok: true });
  } catch {
    return json(503, { error: "Unavailable" });
  }
}

export default { fetch: join };
