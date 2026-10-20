# Praci waitlist site

The homepage embeds the real web app as a static demo (`public/demo/`, committed) that answers its own requests from recorded mock data. Rebuild it with `pnpm --filter @rakazo/web build:demo`; refresh the data with `DEMO_SLOT=6 pnpm demo:up` then `pnpm --filter @rakazo/web record:demo`.
