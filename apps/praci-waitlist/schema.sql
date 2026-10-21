-- Created on first request by src/db.ts; kept here for reference.
create table if not exists hosted_signups (
  id bigserial primary key,
  email text unique not null,
  name text null,
  company text null,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

alter table hosted_signups
  add column if not exists referral_code text unique,
  add column if not exists referred_by_code text,
  add column if not exists status_token_hash text unique,
  add column if not exists confirmed_at timestamptz,
  add column if not exists confirmation_sent_at timestamptz;

create index if not exists hosted_signups_referred_by_code_idx on hosted_signups (referred_by_code);
create index if not exists hosted_signups_ip_hash_idx on hosted_signups (ip_hash, created_at);
