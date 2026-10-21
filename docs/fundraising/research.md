# Investors and Fundraising: research (2026-10-20)

Evidence labels: [V] vendor documentation, [S] secondary source or search summary,
[O] observed in a repository or package registry. "Unverified" marks claims not
confirmed on a primary page. No figures here are from any real company.

## 1. What a simple cap table needs

- Columns: stakeholder, security type, shares or units, issue date, price per
  share, amount paid, percent issued, percent fully diluted. Sections by class
  (founder common, preferred per round, granted options, unissued pool, SAFEs and
  notes, warrants); subtotals reconcile to the fully diluted total. [S]
  https://www.cakeequity.com/guides/cap-table-spreadsheet-template
- SAFEs and notes are placeholders (cap, discount, MFN), not issued shares; show a
  hypothetical conversion at the cap. The unissued pool counts in the fully diluted
  denominator. Common mistakes: issued-only percent, double-counting the pool,
  omitting SAFEs, stale versions. [S] same source;
  https://promise.legal/templates/cap-table-template
- Carta's views: by stakeholder, share class, category, security type; pool shown as
  issued, outstanding and available; a pro forma that converts SAFEs and notes. [V]
  https://support.europe.carta.com/hc/en-gb/articles/22153937853585-Cap-Table-Overview
- Pulley was reported to be shutting down with an assisted migration to Carta. [S,
  unverified] https://www.bpm.com/insights/pulley-is-shutting-down/ . No Pulley
  integration is planned.

Taken into the plan: holders, security, shares or amount, SAFEs unconverted with an
as-converted-at-cap estimate, fully diluted percent, one source of truth.

## 2. YC post-money SAFE

- Published at https://www.ycombinator.com/documents. Variants: Valuation Cap (no
  discount), Discount (no cap), MFN (no cap, no discount), optional Pro Rata Side
  Letter, user guide. A cap-plus-discount form is not a YC standard form. [V]
- Terms on the page: free to download and use; keep the form unmodified and put
  extras in a side letter; consult a lawyer. A specific license (for example Creative
  Commons) was not found on the page: **unverified**. The plan links to the page and
  does not reproduce or template the text.
- Fields: company legal name, investor legal name, purchase amount, post-money
  valuation cap or discount rate, date, state of incorporation, signatories and
  titles. [V, from the form and Mercury's schema below]
- Ownership at conversion for a post-money SAFE is purchase amount divided by the
  post-money cap, before the priced round's dilution. In a priced round the
  conversion price is the lower of the cap price and the round price. [S]
  https://help.pulley.com/articles/4781657-how-do-post-money-safes-convert ,
  https://pulley.com/guides/modeling-dilution

Taken into the plan: amount, cap or discount, MFN, pro rata, date, governing state;
percent per SAFE and combined; no priced-round conversion.

## 3. Mercury SAFEs

- Product: Mercury's Capital page lets a founder enter SAFE terms, send the SAFE to
  the investor and track status; money routes to the Mercury account and SAFEs are
  "automatically linked" to deposits (mechanism not documented). [V]
  https://mercury.com/blog/inside-mercury/october-2023-product-updates ,
  https://support.mercury.com/hc/en-us/articles/43480243196052
- API, read-only: `GET /api/v1/safes` (`getSafeRequests`),
  `GET /api/v1/safes/{id}`, `GET /api/v1/safes/{id}/document` (PDF). Fields: `id`,
  `valuationType` (PreMoney, PostMoney, NoValuation), `valuationCap`,
  `discountRate`, `includesMostFavoredNationClause`,
  `includesProRataRightsLetter`, `investmentAmount`, `investmentDate`,
  `governingState`, `expiresAt`, `canceledAt`, `signedByOwnerAt`,
  `signedByInvestorAt`, `paidAt`, `documentUrl`, `investor` (legal entity name,
  investor type, signatory name, email, title, address), `organization`. No status
  enum; status is derived from the timestamps. No transaction id on the SAFE. [V]
  https://docs.mercury.com/changelog/safe-api-now-available.md ,
  https://docs.mercury.com/reference/getsaferequests.md
- Whether SAFE events exist in Mercury's webhooks: unverified.
  https://docs.mercury.com/reference/webhooks.md

Taken into the plan: read-only sync through the existing Mercury MCP connection,
derived status, best-effort deposit match by amount and date against synced
transactions, no writes.

## 4. Investor updates

- Lead with cash, burn and runway; then KPIs, highlights, lowlights, specific asks;
  email body rather than a deck; monthly at pre-seed and seed, quarterly from Series
  A, monthly or more often with under six months of runway. [S]
  https://visible.vc/blog/investor-updates/ ,
  https://waveup.com/blog/investor-update-template/ ,
  https://500.co/content/investor-update-workshop
- Carta's Communications Center imports the investor list from the cap table,
  controls who sees what and shows updates in the investor's portfolio. [V]
  https://carta.com/product-updates/centralize-investor-updates/
- Visible shares updates by email or in-app and gates data rooms with a secure link,
  optional password, email gate or domain restriction. [V]
  https://visible.vc/blog/how-will-investors-interact-with-the-content-you-share-via-visible/

Taken into the plan: one template (TL;DR, cash/burn/runway, highlights, lowlights,
asks), drafted from synced data, edited by the founder, sent from the founder's
mailbox, stored as history, visible in the portal.

## 5. Investor audit confirmations

- Fund auditors confirm portfolio holdings at year end; the process starts in Q4 and
  runs January to March, with many funds due by the end of April. [S]
  https://visible.vc/blog/venture-capital-audit-process
- Typical asks: shares held, price paid, cap table, latest financials, recent
  financing documents, valuation support, contacts. [S]
  https://www.anchin.com/articles/audit-prep-for-funds-key-steps-to-ensure-timely-and-accurate-financial-reporting/
- Carta offers auditors a confirmation tool where the company signs digitally and
  attaches documents (page returned 403; from a search summary, partly unverified).
  https://carta.com/product-updates/audit-confirmation-tool/

Taken into the plan: a holdings statement per fund from the cap table, documents
from the Data room, requests tracked with due date and state, a weekly routine from
January to March, and no signing on the founder's behalf.

## 6. Board management

- Delaware boards may act by unanimous written consent (DGCL 141(f)); early boards
  often do. [S]
  https://www.dlapiper.com/en-za/insights/publications/accelerate/formation/board-action-meetings-vs-written-consents
- Minute book contents and consent mechanics. [S]
  https://www.nolo.com/legal-encyclopedia/how-to-use-written-consents-to-appoint-your-initial-board-of-directors-and-issue-stock.html

Taken into the plan: board members as contacts and board updates through the same
update mechanism. Consents, minutes and meeting records are out of scope.

## 7. Fundraising pipeline

- Stage sets in common use: Target, Intro, First meeting, Diligence, Term sheet,
  Closed; or Prospect, Contacted, Scheduled, Met, Due diligence, Closed or Passed;
  some add Lead and a stale alert after about a week idle. [S]
  https://www.taskade.com/templates/y-combinator/fundraising-crm ,
  https://itsdart.com/templates/fundraising-tracker ,
  https://www.hustlefund.vc/blog-posts-founders/how-to-create-an-investor-crm

Taken into the plan: Target, Intro, Meeting, Diligence, Committed, Passed; check
size, last contact, next step. No stale alert in v1.

## 8. Open-source cap table and SAFE tooling

| Project | License | Activity | Verdict |
|---|---|---|---|
| captableinc/captable https://github.com/captableinc/captable | AGPL-3.0 | no commits since 2024-09 [O] | Do not copy code or schema (license); its SAFE model shape (type, status, cap, discount, MFN, pro rata, dates) is a sanity check only. |
| Open Cap Format (OCF) https://github.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF | custom schema license, not OSI [O] | active | Event-sourced transaction log; far heavier than needed. Not the internal model; an export is a follow-up. https://github.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/blob/main/LICENSE.md |
| @1984vc/cap-table https://github.com/1984vc/cap-table (npm 0.4.0) | MIT, no runtime deps [O] | active, young, few contributors | Covers stacked post-money SAFEs, pre-money SAFEs, MFN, pool top-up. Not adopted: the plan needs only amount ÷ cap. Optional test oracle if a reviewer asks. Math not audited. |
| papermark https://github.com/mfts/papermark , documenso https://github.com/documenso/documenso | AGPL (plus commercial folders) [O] | active | Reference only for portal and e-sign ideas; no code reuse. |

Not found: a maintained open-source Carta or Pulley export parser; an open-source
SAFE document generator; a maintained open-source investor-update tool. [O,
GitHub search only]

## 9. Magic links and external principals

- better-auth's magic-link plugin stores one verification row per token keyed by
  the token hash, expires in 300 seconds by default, rate-limits the sign-in and
  verify endpoints (5 per 60 seconds by default), and signs the person in as a user,
  creating one unless `disableSignUp` is set. [V] better-auth docs, plugins/magic-link
  (read through Context7 on 2026-10-20 for 1.7.x). The plan copies the hashed-token
  storage pattern in its own table and does not use the plugin, because investors
  must not become users.

## Unconfirmed

- The YC SAFE license terms; Mercury SAFE webhook events; whether Mercury's `paidAt`
  always corresponds to a deposit Mercury matched; `@1984vc/cap-table` correctness;
  the exact Pulley shutdown date; Carta's audit tool details.
