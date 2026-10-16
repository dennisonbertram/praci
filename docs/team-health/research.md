# Team health page: research (2026-10-16)

Evidence labels: [V] vendor documentation, [R] peer-reviewed or independent research, [S] secondary or unverified. Searches were summary-level; items marked "unverified" were not confirmed on the primary page.

## 1. How existing products do it

- **Microsoft Viva Insights.** Personal insights are visible only to the individual, who can opt in or out; manager insights are aggregated with differential privacy so no individual can be picked out. Managers can see how often their team met or sent chat/email outside working hours. [V] https://microsoft.com/microsoft-viva/insights , https://learn.microsoft.com/en-us/viva/insights/org-team-insights/team-insights . I could not confirm a "quiet days" feature, only quiet hours. Minimum group size defaults to 5 and cannot go lower; subject lines can be hashed and domains, addresses and terms excluded. [V, legacy Workplace Analytics page] https://learn.microsoft.com/en-us/viva/insights/Privacy/Privacy-considerations
- **Uplevel "Always On".** Counts Jira, PR, code, meeting and Slack activity in early mornings, late nights, weekends and holidays, bucketed by average daily overtime minutes; "Above Normal" and "High" mean burnout risk "especially when sustained". Reported at individual and team level. [V, via search summary; the Notion page itself did not load] https://uplevelteam.notion.site/Always-On-171d1c56d5c1418f9c57a7af1b6aed23
- **LinearB.** Per-person burnout alert when someone worked 90% of days in a sprint (monitoring starts day 6); WIP-based cognitive overload; "review load imbalance" (how many more reviews the top 20% of reviewers do than everyone else). [V] https://linearb.helpdocs.io/article/m922k2p59d-burnout-indicators , https://linearb.io/blog/engineering-health
- **Swarmia.** Team-owned working agreements; Work Log shows team activity patterns that hurt focus. Deliberately omits lines of code, churn and developer ranking because they invite gaming. Most metrics count weekends; no separate after-hours cycle time. [V] https://help.swarmia.com/features/working-agreements , https://help.swarmia.com/definitions/frequently-asked-questions/how-do-you-treat-weekends-in-metrics , https://help.swarmia.com/features/focus
- **Jellyfish, Code Climate Velocity, DX, Haystack.** I found no verified burnout features for Jellyfish or Velocity. SPACE (the DX/GitHub/Microsoft framework) says productivity cannot be one metric and spans individual, team and system levels, with satisfaction/well-being as its own dimension. [R] https://queue.acm.org/detail.cfm?id=3454124 , https://getdx.com/research/space-of-developer-productivity/
- **Pulse surveys (Lattice, Officevibe, Culture Amp).** Aggregate-only results behind a minimum-respondent threshold. Lattice minimum is 3, adjustable upward only. Officevibe ~5 and Culture Amp ~5 are unverified. [V/S] https://help.lattice.com/hc/en-us/articles/360061207493-Anonymity-in-Surveys-Pulse , https://help.workleap.com/en/articles/10281694
- **PagerDuty.** Splits interruptions into business, off-hours (weeknights 6-10pm, weekend days) and sleep hours (10pm-8am), local time. 2021 report: median responder 2 off-hours interruptions per month, the "burned out" top decile about 19; small companies had a larger share of responders interrupted (46% vs 30% enterprise). [V, dated] https://www.pagerduty.com/newsroom/pagerduty-state-of-digital-operations-report-underscores-business-and-human-costs-of-pandemic/

Pattern: individuals see their own detail; managers get aggregates; per-person views exist mostly in engineering tools (Uplevel, LinearB) and are the ones most open to misuse.

## 2. Which signals have evidence

Stronger:
- **After-hours and long hours.** A 2025 study of 1,465 Norwegian full-time employees tied late-evening work and long hours to lower detachment and more work-home conflict, and weekly hours to burnout. [R] https://www.sjweh.fi/article/4198 , https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11710905/ . Surveys link responding to after-hours messages with exhaustion (correlational). [R/S] https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11710905/
- **Workload, time pressure, low control, low support.** Gallup's top burnout correlates are unfair treatment, unmanageable workload, unclear manager communication, lack of manager support and unreasonable time pressure; workload experience matters more than hours. [S, vendor research] https://www.gallup.com/workplace/288539/employee-burnout-causes-and-cures.aspx . A 2020 systematic review found workload, low control and low social support predict burnout, but most studies are cross-sectional. [R] https://link.springer.com/10.1186/s12960-020-00469-9
- **Fix the work, not the person.** A Southampton evidence brief found individual-focused interventions (resilience, mindfulness) are not supported; fixing work-environment mismatches is. [R] https://eprints.soton.ac.uk/444484/1/Evidence_brief_burnout_Eprints.pdf
- **Off-hours interruptions concentrated on few people** (on-call pages): PagerDuty data above. [V]

Plausible but vendor-asserted, not independently validated: meeting hours, fragmented focus time, WIP, review-queue concentration, days-worked streaks (LinearB), response-latency pressure. I found no validation studies for any of them as burnout predictors.

Weak or misleading: absolute thresholds (a night owl or a different time zone looks "overworked"); commit or message counts; one-off spikes around launches; senior people who review more by role (LinearB's own caveat); activity as a proxy for productivity. Work metadata also misses vacation, sick days and part-time schedules unless the calendar is connected. Design implication: compare each person to their own trailing 8-12 week baseline, require a sustained change (several weeks), and respect each person's stated working hours and time zone. (My synthesis; the sources support "sustained" via Uplevel, and no source validates specific cut-offs.)

## 3. Revenue-critical people

Little product documentation exists for inferring this from work tools, so treat these as proposals:
- **Key-person risk in code:** CodeScene's off-boarding simulator marks hotspots whose knowledge sits with one developer as risk; bus-factor tools estimate this from git authorship, with knowledge decaying over time. [V] https://codescene.io/docs/guides/simulations/offboarding-simulator.html ; [R/S] https://modeling-languages.com/whats-bus-factor-software-project/ . Commit counts do not equal understanding, so show it as a signal.
- **Customer relationships:** single-threaded accounts (one contact, one internal owner) are a recognised churn risk, especially if the champion leaves. Evidence is practitioner writing and anecdotes. [S] https://the-cs-profit-loop.beehiiv.com/p/multi-threading-is-a-cs-power-move-c970 , https://www.staffingindustry.com/editorial/staffing-stream/warning-signs-your-client-relationship-risk
- **Proposed signals:** share of threads with paying-customer domains per person; sole internal owner on a customer's threads; owner of revenue-path services (checkout, billing, auth) by recent authorship and review; escalations or incidents they resolved. Rank by revenue exposure only if a revenue source (CRM, billing) is connected; otherwise say so. I could not verify how Gong or Gainsight detect this.

## 4. Ethics, privacy, legal

- **GDPR.** WP29 Opinion 2/2017: consent is rarely valid in employment; legitimate interest needs a necessity and proportionality test, least-intrusive means, and transparency to employees. [S, summaries of a 2017 opinion that predates GDPR enforcement; confirm against current EDPB guidance] https://www.wr.no/en/news/the-wp29-opinion-2-2017-on-data-processing-at-work , https://www.algoodbody.com/insights-publications/article-29-working-party-opinion-on-data-processing-at-work . Works-council and national-law rules (e.g. Germany) were not verified; get legal review before enabling in the EU.
- **Microsoft's own guardrails:** personal data visible to the individual only, aggregates for managers, minimum group 5, hashed subject lines, term/domain exclusion. [V] links in section 1.
- **Small-company problem.** Viva Insights hides insights for groups below its minimum size (https://learn.microsoft.com/en-us/viva/insights/advanced/setup-maint/manager-settings#minimum-group-size). Showing named individuals on a small team is therefore a deliberate choice, not an unavoidable one. If we make it, it needs its own protections: access limited to the space owner and each person's own view, metadata only, and a disclosure of what is read.
- **Burnout-score risks.** SPACE and Swarmia both argue against single metrics and rankings. [R/V] links above. Use no composite score and no ordering of people.
- **Framing.** Gallup and Southampton point to workload and management conditions, so suggestions should be about changing work (rebalance reviews, protect focus time, 1:1) not about the person.

## 5. Page structure

Summary first, then per-person cards, then coverage. Each card shows 2-3 signals, each with a sparkline against the person's own baseline and the raw evidence behind it. Include confidence, which sources were connected, and a suggested action. Everything is dismissible or correctable.

## Recommended design for our page

1. **Header summary (3 lines max):** "2 people may need support, 1 person is a single point of failure for Customer X." Below it, a coverage strip: connected sources (Slack, Gmail, Calendar, GitHub, Linear) with date range; "Not connected: PTO, CRM" lowers confidence visibly.
2. **Two sections, no ranking:** "Workload signals" and "Key-person risk". Sort by recency of change, never by a score. Show no card unless a signal is sustained for 3+ weeks versus that person's own 8-12 week baseline.
3. **Person card:** name, up to 3 signals, each as a one-line plain-English finding ("Weekend activity up from 1 to 4 days a month over 6 weeks"), a sparkline with the baseline band, a "Show evidence" link to counts and dates (counts only, no content). Tag each signal Low/Medium confidence with the reason ("no calendar, so PTO unknown").
4. **Suggested action per card,** framed as support: 1:1 check-in, move 2 reviews to X, block focus time Thursday. Buttons: "Not an issue" (suppresses for 8 weeks), "Wrong, I know why" (adds a note), "Done".
5. **Key-person card:** the customer or service, why this person (e.g. "the sole owner of 9 of 12 recent threads with Customer X; last 90 days"), exposure if known, and an action (add a second owner, schedule a handover).
6. **Guardrails:** metadata only, never message text; each person can open the same view of their own data; per-user working hours and time zone; an org-level toggle to turn people signals off; an on-page "what we read" disclosure. Any shown figure needs a count and date range. Flag EU deployments for legal review.
7. **Signals to ship first (best evidence, cheapest):** after-hours/weekend trend, meeting-hours trend, review-queue concentration, sole-owner of customer threads. Defer response-latency and any cross-tool composite.
