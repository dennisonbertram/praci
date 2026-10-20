import { neon } from "@neondatabase/serverless";

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

let ready: Promise<unknown> | undefined;
function ensureTable() {
  ready ??= sql()`
    create table if not exists hosted_signups (
      id bigserial primary key,
      email text unique not null,
      name text null,
      company text null,
      ip_hash text not null,
      created_at timestamptz not null default now()
    )`.catch((error) => {
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

/** Inserts a signup. A duplicate email is a no-op, so the visitor sees success either way. */
export async function insertSignup(
  email: string,
  name: string | null,
  company: string | null,
  ipHash: string,
): Promise<void> {
  await ensureTable();
  await sql()`
    insert into hosted_signups (email, name, company, ip_hash)
    values (${email}, ${name}, ${company}, ${ipHash})
    on conflict (email) do nothing`;
}
