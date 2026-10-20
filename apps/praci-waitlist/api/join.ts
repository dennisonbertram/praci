import { insertSignup, recentFromIp } from "../src/db.js";
import { sendConfirmation } from "../src/email.js";
import { json, readPostBody } from "../src/http.js";
import { RATE_LIMIT, cleanField, hashIp, normalizeEmail, parseJoinBody } from "../src/waitlist.js";

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
    await insertSignup(email, cleanField(body.name), cleanField(body.company), ipHash);
    await sendConfirmation(email);
    return json(200, { ok: true });
  } catch {
    return json(503, { error: "Unavailable" });
  }
}

export default { fetch: join };
