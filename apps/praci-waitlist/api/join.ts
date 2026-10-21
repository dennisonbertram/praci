import {
  insertSignup,
  isUniqueViolation,
  recentFromIp,
  releaseThrottle,
  rotateToken,
  setToken,
} from "../src/db.js";
import { sendConfirmation } from "../src/email.js";
import { json, readPostBody } from "../src/http.js";
import {
  cleanField,
  generateReferralCode,
  generateToken,
  hashIp,
  hashToken,
  normalizeEmail,
  normalizeRef,
  parseJoinBody,
  RATE_LIMIT,
} from "../src/waitlist.js";

/** Retries once on a referral code collision. */
async function withNewCode<T>(run: (code: string) => Promise<T>): Promise<T> {
  try {
    return await run(generateReferralCode());
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return run(generateReferralCode());
  }
}

async function join(request: Request) {
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });

  const raw = await readPostBody(request);
  const body = raw === null ? null : parseJoinBody(raw);
  if (!body) return json(400, { error: "Invalid request" });

  // A hidden field catches basic form spam without confirming the trap to bots.
  if (body.contactNote?.trim()) return json(200, { ok: true });

  const email = normalizeEmail(body.email);
  if (!email) return json(400, { error: "Enter a valid email address" });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipHash = hashIp(ip);
  try {
    if ((await recentFromIp(ipHash)) >= RATE_LIMIT) {
      return json(429, { error: "Too many signups. Try again later." });
    }
    const token = generateToken();
    const tokenHash = hashToken(token);

    let code = await withNewCode((fresh) => rotateToken(email, fresh));
    const rotated = code !== null;
    if (code === null) {
      const refCode = normalizeRef(body.ref);
      const name = cleanField(body.name);
      const company = cleanField(body.company);
      let inserted = false;
      await withNewCode(async (fresh) => {
        inserted = await insertSignup(email, name, company, ipHash, fresh, refCode, tokenHash);
        code = fresh;
      });
      // An existing email that was mailed recently: same response, no new email.
      if (!inserted) return json(200, { ok: true });
    }
    if (!(await sendConfirmation(email, token, code as string))) {
      await releaseThrottle(email);
      return json(503, { error: "Unavailable" });
    }
    if (rotated) await setToken(email, tokenHash);
    return json(200, { ok: true });
  } catch {
    return json(503, { error: "Unavailable" });
  }
}

export default { fetch: join };
