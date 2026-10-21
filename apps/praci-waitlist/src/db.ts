import { neon } from "@neondatabase/serverless";
import { REFERRAL_BUMP, RESEND_THROTTLE_SECONDS } from "./waitlist.js";

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

let ready: Promise<unknown> | undefined;
function ensureTable() {
  ready ??= (async () => {
    const db = sql();
    await db`
      create table if not exists hosted_signups (
        id bigserial primary key,
        email text unique not null,
        name text null,
        company text null,
        ip_hash text not null,
        created_at timestamptz not null default now()
      )`;
    await db`
      alter table hosted_signups
        add column if not exists referral_code text unique,
        add column if not exists referred_by_code text,
        add column if not exists status_token_hash text unique,
        add column if not exists confirmed_at timestamptz,
        add column if not exists confirmation_sent_at timestamptz`;
    await db`
      create index if not exists hosted_signups_referred_by_code_idx
      on hosted_signups (referred_by_code)`;
  })().catch((error) => {
    ready = undefined;
    throw error;
  });
  return ready;
}

/** Number of signups from this IP hash in the last hour. */
export async function recentFromIp(ipHash: string): Promise<number> {
  await ensureTable();
  const rows = await sql()`
    select count(*)::int as n from hosted_signups
    where ip_hash = ${ipHash} and created_at > now() - interval '1 hour'`;
  return rows[0].n as number;
}

/**
 * Inserts a signup. Returns false when the email already exists.
 * Throws a unique violation on a referral code collision.
 */
export async function insertSignup(
  email: string,
  name: string | null,
  company: string | null,
  ipHash: string,
  code: string,
  refCode: string | null,
  tokenHash: string,
): Promise<boolean> {
  await ensureTable();
  const rows = await sql()`
    insert into hosted_signups
      (email, name, company, ip_hash, referral_code, referred_by_code, status_token_hash,
       confirmation_sent_at)
    values (
      ${email}, ${name}, ${company}, ${ipHash}, ${code},
      (select referral_code from hosted_signups where referral_code = ${refCode}),
      ${tokenHash}, now()
    )
    on conflict (email) do nothing
    returning id`;
  return rows.length > 0;
}

/**
 * Rotates the token of an existing signup (filling a missing referral code with `newCode`),
 * at most once per throttle window. Returns the referral code, or null when the email is
 * unknown or was mailed too recently.
 */
export async function rotateToken(
  email: string,
  tokenHash: string,
  newCode: string,
): Promise<string | null> {
  await ensureTable();
  const rows = await sql()`
    update hosted_signups
    set status_token_hash = ${tokenHash},
        referral_code = coalesce(referral_code, ${newCode}),
        confirmation_sent_at = now()
    where email = ${email}
      and (confirmation_sent_at is null
           or confirmation_sent_at < now() - make_interval(secs => ${RESEND_THROTTLE_SECONDS}))
    returning referral_code`;
  return rows[0] ? (rows[0].referral_code as string) : null;
}

/** Lifts the resend throttle after a failed send so the visitor can retry right away. */
export async function releaseThrottle(email: string): Promise<void> {
  await sql()`
    update hosted_signups set confirmation_sent_at = 'epoch' where email = ${email}`;
}

export function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "23505";
}

export type Standing = { position: number; total: number; referrals: number; referralCode: string };

/** Confirms the signup behind a token (idempotent) and returns its standing. Null if unknown. */
export async function confirmAndRank(tokenHash: string): Promise<Standing | null> {
  await ensureTable();
  const db = sql();
  const found = await db`
    update hosted_signups set confirmed_at = coalesce(confirmed_at, now())
    where status_token_hash = ${tokenHash}
    returning id`;
  const id = found[0]?.id;
  if (id === undefined) return null;

  // ponytail: this ranks every confirmed row on each lookup (O(n)); fine at waitlist scale,
  // cache or materialize the ranking if the list reaches hundreds of thousands.
  const rows = await db`
    with refs as (
      select referred_by_code as code, count(*) as n
      from hosted_signups
      where confirmed_at is not null and referred_by_code is not null
      group by referred_by_code
    ),
    base as (
      select s.id, s.referral_code, s.created_at,
             row_number() over (order by s.created_at, s.id) as base_rank,
             coalesce(r.n, 0) as referrals
      from hosted_signups s
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
  if (!row?.referral_code) return null;
  return {
    position: Number(row.position),
    total: Number(row.total),
    referrals: Number(row.referrals),
    referralCode: row.referral_code as string,
  };
}
