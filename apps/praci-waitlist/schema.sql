-- Created on first request by src/db.ts; kept here for reference.
create table if not exists hosted_signups (
  id bigserial primary key,
  email text unique not null,
  name text null,
  company text null,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists hosted_signups_ip_hash_idx on hosted_signups (ip_hash, created_at);
