import { neon } from "@neondatabase/serverless";
import { REFERRAL_BUMP, RESEND_THROTTLE_SECONDS } from "./waitlist.js";

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

export type Rotation = { confirmed: boolean } | null;

/**
 * Rotates the token of an existing signup, at most once per throttle window.
 * Returns null when the email is unknown or was mailed too recently.
 */
export async function rotateToken(email: string, tokenHash: string): Promise<Rotation> {
  const rows = await sql()`
    update waitlist_signups
    set status_token_hash = ${tokenHash}, confirmation_sent_at = now()
    where email = ${email}
      and confirmation_sent_at < now() - make_interval(secs => ${RESEND_THROTTLE_SECONDS})
    returning confirmed_at is not null as confirmed`;
  return rows[0] ? { confirmed: rows[0].confirmed as boolean } : null;
}

/** Lifts the resend throttle after a failed send so the visitor can retry right away. */
export async function releaseThrottle(email: string): Promise<void> {
  await sql()`
    update waitlist_signups set confirmation_sent_at = 'epoch' where email = ${email}`;
}

/** Inserts a new signup. Returns false when the email already exists. Throws on a code collision. */
export async function insertSignup(
  email: string,
  code: string,
  refCode: string | null,
  tokenHash: string,
): Promise<boolean> {
  const rows = await sql()`
    insert into waitlist_signups (email, referral_code, referred_by_code, status_token_hash)
    values (
      ${email}, ${code},
      (select referral_code from waitlist_signups where referral_code = ${refCode}),
      ${tokenHash}
    )
    on conflict (email) do nothing
    returning id`;
  return rows.length > 0;
}

export function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "23505";
}

export type Standing = { position: number; total: number; referrals: number; referralCode: string };

/** Confirms the signup behind a token (idempotent) and returns its standing. Null if unknown. */
export async function confirmAndRank(tokenHash: string): Promise<Standing | null> {
  const db = sql();
  const found = await db`
    update waitlist_signups set confirmed_at = coalesce(confirmed_at, now())
    where status_token_hash = ${tokenHash}
    returning id`;
  const id = found[0]?.id;
  if (id === undefined) return null;

  // ponytail: this ranks every confirmed row on each lookup (O(n)); fine at waitlist scale,
  // cache or materialize the ranking if the list reaches hundreds of thousands.
  const rows = await db`
    with refs as (
      select referred_by_code as code, count(*) as n
      from waitlist_signups
      where confirmed_at is not null and referred_by_code is not null
      group by referred_by_code
    ),
    base as (
      select s.id, s.referral_code, s.created_at,
             row_number() over (order by s.created_at, s.id) as base_rank,
             coalesce(r.n, 0) as referrals
      from waitlist_signups s
      left join refs r on r.code = s.referral_code
      where s.confirmed_at is not null
    ),
    scored as (
      select *, base_rank - ${REFERRAL_BUMP} * referrals as score from base
    ),
    ranked as (
      select *, row_number() over (order by score, created_at, id) as position,
             count(*) over () as total
      from scored
    )
    select position, total, referrals, referral_code from ranked where id = ${id}`;
  const row = rows[0];
  if (!row) return null;
  return {
    position: Number(row.position),
    total: Number(row.total),
    referrals: Number(row.referrals),
    referralCode: row.referral_code as string,
  };
}
