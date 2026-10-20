create table if not exists waitlist_signups (
  id bigserial primary key,
  email text unique not null,
  referral_code text unique not null,
  referred_by_code text null references waitlist_signups (referral_code),
  status_token_hash text unique not null,
  confirmed_at timestamptz null,
  confirmation_sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists waitlist_signups_referred_by_code_idx
  on waitlist_signups (referred_by_code);
