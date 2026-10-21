# Praci waitlist site

The homepage embeds the real web app as a static demo (`public/demo/`, committed) that answers its own requests from recorded mock data. Rebuild it with `pnpm --filter @rakazo/web build:demo`; refresh the data with `DEMO_SLOT=6 pnpm demo:up` then `pnpm --filter @rakazo/web record:demo`.

## Waitlist and referrals

`POST /api/join` stores the signup in Neon (`hosted_signups`, columns added idempotently on first request; see `schema.sql`) and emails a private status link through Resend. Each signup gets a referral link (`/?ref=CODE`). The status page (`/you?token=...`) calls `POST /api/me`, which confirms the signup and returns its place in line. Each confirmed friend moves the referrer up 10 places. Joining again with the same email sends a fresh link, at most once a minute.

Environment: `DATABASE_URL`, `RESEND_API_KEY` (without it no email is sent and joining still succeeds, for local development), `WAITLIST_FROM_EMAIL` (default `Praci <hello@praci.ai>`), `PUBLIC_SITE_URL` (default `https://praci.ai`, used in email and referral links). See `.env.example`.
