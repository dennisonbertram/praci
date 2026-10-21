import { confirmAndRank } from "../src/db.js";
import { siteUrl } from "../src/email.js";
import { json, readPostBody } from "../src/http.js";
import { hashToken, parseTokenBody } from "../src/waitlist.js";

async function me(request: Request) {
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });

  const raw = await readPostBody(request);
  const token = raw === null ? null : parseTokenBody(raw);
  if (!token) return json(400, { error: "Invalid request" });

  try {
    const standing = await confirmAndRank(hashToken(token));
    if (!standing) return json(404, { error: "Not found" });
    const { position, total, referrals, referralCode } = standing;
    return json(200, {
      position,
      total,
      referrals,
      referralUrl: `${siteUrl()}/?ref=${referralCode}`,
    });
  } catch {
    return json(503, { error: "Unavailable" });
  }
}

export default { fetch: me };
