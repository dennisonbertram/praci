# Praci go-to-market

Status: direction agreed with the owner; no dates, prices or targets set yet. Numbers are TBD until there is data.

## Position

Praci is the Startup OS: an AI team for the work that runs a company, built by founders for founders, self-hosted or in our cloud. The homepage line states the opinion: raise money, pitch clients, build software, grow revenue, all in one place. Solo founders are the first audience, which is why "build software" replaced "run your team".

## Plan: teach founders how to build a startup

The main channel is documentation. We publish a large, practical library on praci.ai that founders would want even if they never install Praci, and each piece shows where Praci does the work.

Three content tracks:

1. **How to build a startup.** Incorporation, banking, the first cap table, a SAFE round, a data room, a pitch deck, the first hires. Each guide is a checklist a founder can follow.
2. **How to run your startup.** Weekly operating rhythm: inbox triage, runway and burn reviews, board meetings, investor updates, contracts and deadlines, hiring plans, customer pitches.
3. **Tools we recommend.** Our opinion on the best tools for setting up a startup (banking, cards, cap table, email, notes, issue tracking, code, AI models and agents) and how each one connects to Praci. The homepage "Works with" row is the short version of this list.

Rules for the content:

- Every guide is useful on its own; Praci is the shortcut, not the price of reading.
- Every claim about Praci matches a shipped feature and links to its page in `/docs`. Unshipped features are not described.
- Examples use invented companies (Northwind Robotics and its cast), never real customer data.
- Tool recommendations are opinions we stand behind. Say how we chose, and disclose any paid relationship. TBD: affiliate or partner policy.

## Where it lives

- `apps/praci-waitlist`: the site at praci.ai. Product docs in `/docs`, guides and stories in `/blog`. Guides may move to their own section (for example `/guides` and `/tools`) once there are enough of them.
- The open-source repo (`dennisonbertram/praci`) and its README carry the self-host path; the site carries the Cloud waitlist.

## Funnel

1. A founder finds a guide (search, social, a shared link).
2. The guide shows the step done in Praci and links to the matching docs page.
3. They star the repo, install the desktop app or self-host, or join the Cloud waitlist.

## First pieces

- Blog: "A week running Northwind Robotics on Praci" (published).
- Next, TBD order: setting up a startup's tool stack; preparing a data room for a seed round; a monthly runway review; writing an investor update.

## Open questions

- Publishing cadence and owner: TBD.
- Cloud pricing and launch date: TBD (see `docs/hosted-service/`).
- How we measure the funnel without third-party tracking: TBD.
- Whether the GTM agent (`docs/plans/gtm-bot.md`) is used to distribute our own content.
