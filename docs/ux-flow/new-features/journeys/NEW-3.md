# NEW-3: Create and control an agent for a connected app

Stories: CA-1 (create), CA-2 (allow changes, approve), CA-3 (exclusive vs Used by). Mock demo stand-in: the Gmail "Sales mail" account instead of Notion, because Notion is not seeded (docs/ux-paths/topics/new-connected-app-agents.md, "Walk preconditions").

Evidence: `docs/ux-walker/stories/STORY-CA-{1,2,3}/` (walk-report.md, findings.json, screenshots; all screenshots opened). Code: `apps/web/src/components/integrations/{AppDetail,McpDetail,IntegrationAgentSection}.tsx`, `apps/api/src/integration-agent.ts`, `apps/api/src/carta-agent.ts`, `docs/integration-agents/README.md`.

Already filed, not re-proposed here: #150 (one send needs two approvals, CA-2 step-3/step-4) and #151 (raw tool name and JSON in the approval card, CA-2 step-4).

Verdict: **convoluted**. Step count is close to ideal (+1), but the same Agent controls sit in two places with different neighbours, the access controls duplicate each other, and the new agent's defaults leave the app open to every other agent.

## Friction Scorecard

| Story | Actual vs ideal | Evidence |
|---|---|---|
| CA-1 create | 5 vs 4 (walker count). The extra step is going back to the app page to read the defaults, because the chat Create agent opens is blank. | CA-1 walk-report; step-3 (empty thread, only the composer) |
| CA-2 allow changes and approve | 8 vs 7. Counting is generous: the second approval card (#150) is the extra step. | CA-2 walk-report; step-3, step-4 |
| CA-3 exclusive round trip | 2 clicks each way, as intended. But there is no way to see who currently has access once an agent exists. | CA-3 step-1, step-2 |

**Decisions a default could carry**
- "Only this agent": off by default for app agents. The user just asked for a dedicated agent for this account; most will then want it to be the only user. After Create agent on Sales mail, the agent was also switched on in the other Gmail account's Used by list, and all 8 other bots could still use the Sales account (CA-1 step-4, F-CA-1-1). Carta's default is on (migration and `carta-agent.ts:71`).
- "Allow changes": off by default. Keep. Reading is the safe start, and the chat can offer to turn it on (see Simpler Version).
- The "Allow changes" confirmation dialog. Every write still asks for approval afterwards (README decision 5; CA-2 step-3/4), and the switch is reversible with no dialog (CA-2 step-8 walk note: switch off is immediate). So the dialog guards a reversible action that is already gated per write. This is a security-sensitive default, so it is a proposal for the owner, not a certain fix (Confirmation budget heuristic).

**Re-entry:** After Create agent the user lands in a blank chat (CA-1 step-3) and must go back through Integrations, the app card, and scroll to find the Agent card. At 1280x800 the Sales row's Agent card was below the fold; the page needed about 1500px to show it (F-CA-1-4, step-4).

**Needless confirmations:** the "Allow changes" dialog (above); the double approval (#150).

**Dead ends:** the blank chat after Create agent (F-CA-1-2). No way to see which agents share an account once it has an agent (F-CA-3-1).

**Hesitations:**
- "Create agent" appears beside Rename and Remove account with no hint what it makes, in every account row (CA-1 step-1).
- Both accounts show Create agent at once; the user must choose which account first (CA-1 step-1).
- The hint "Other agents ask the Sales mail agent instead of using Sales mail themselves" repeats the account name three times (CA-1 step-5, F-CA-1-5).
- "Denied" is green, same as "Allowed once" (CA-2 step-7, F-CA-2-3).
- After a Deny, the agent proposed the earlier, already-sent email again (CA-2 step-7, F-CA-2-4). May be demo-model behaviour; the walker did not confirm it with a real model.

## Take-away Pass

**App page, before an agent exists (CA-1 step-1)**
- Page-level Used by list of 7 bots. Keep: it is the only access control at this point.
- Tools list (6 rows) with Read/Write groups. Candidate to collapse: no story step uses it; it describes the app, not the agent (story CA-1 step 7 hesitation).
- Create agent in every account row. Move into the shared Agent block (see below).

**App page, after Create agent (CA-1 step-4, CA-2 step-8)**
- The page-level Used by list disappears and reappears inside the first account's row. This is a layout jump. The two accounts now show different things (Used by under one, Agent card under the other).
- Agent card heading "Agent" plus a second title line with the agent name. The link is useful; the heading adds a line. Merge: the agent name as the card title, no separate "Agent" heading.
- "Allow changes in {account}" label: redundant, because the card is inside that account's row. Label can be "Allow changes".
- The two-state hint text ("Off: ... On: ...") shows both states in both states (F-CA-2-5). Show the current state only.
- "Add another account" and "Disconnect Gmail" below. Unrelated to this journey; leave.

**Approval cards (CA-2 step-3/4)**: covered by #150 and #151.

**Mobile (390px)**: account action buttons wrap unevenly between rows (CA-1 mobile-check, F-CA-1-3). Not an extra-element problem; a stacked single group fixes it.

## The Simpler Version

1. Open Integrations, open the app. (2 steps, same as now.)
2. In the Agent block, press **Create agent**. The block is where the controls live from now on; it is the same block on every connection page.
3. The new agent's chat opens with a short intro: what it can read, that changes are off, and a link to turn them on. It uses the same empty-state pattern as the Carta chat (CA-4 step-3), with the duplicates removed.
4. If the user wants changes: switch **Allow changes** on the page. Each change still asks for one approval.
5. Done. No trip back to find the defaults, because the chat told them.

### Concrete changes

**One shared layout (answers "why do they differ?")**

Why they differ today: the app page is built from account rows (`AppDetail.tsx`, one row per Composio account), and the agent is per account, so the Create agent button and the Agent section were put inside each row, with Used by shown only for rows without an agent (`AppDetail.tsx:393-470`). The MCP page (`McpDetail.tsx:190-245`) has one connection per page, so Create agent went in the header action row, the Agent section under it, and Used by was always shown. The same component (`IntegrationAgentSection`) was dropped into two different parents. No product reason for the difference appears in the README or story doc.

Proposed single layout, for both pages, per connection (an app account or an MCP server):
1. Header: name, status, and the actions Rename, Reconnect (when signed out), Remove. No Create agent here.
2. **Agent block**, always the first block under the connection title:
   - No agent: a single **Create agent** button.
   - Agent exists: card with the agent name as a link, **Allow changes** switch, **Only this agent** switch.
3. **Shared with N agents**: shown only when Only this agent is off, as a collapsed disclosure containing today's per-agent toggles. When it is on, nothing is shown (the Agent card already says who has access; this removes the Carta single-row Used by, F-CA-4-1, and the app-page gap, F-CA-3-1).
4. Tools list (apps only): collapsed by default, below.

For multi-account apps the Agent block repeats per account inside the account row, but Used by is not hoisted to page level and then moved; there is no page-level Used by at all, so creating an agent no longer reshuffles the page.

**Defaults**

Why "Only this agent" differs: the Carta migration and `carta-agent.ts:71` set exclusive on and writes off for a new link; the generic create path leaves the integration shared (README decision 5 and the "Only this agent. Off: the integration stays shared, as it is today" line), because existing Mercury, Brex and Gmail connections already have other users. It is a legacy-compatibility choice, not a product rule.

Proposal: make **on** the default for a newly created agent on any app, matching Carta, and say so in the result (the Agent card shows the switch on). Reason: the user's act was "create a dedicated agent for this app". Risk to state plainly: on a shared mail account this takes access away from other agents (Inbox agent, Chief) the moment the agent is created. I did not run this, and the README states Mercury/Brex are handled by an exemption for the Finance agent (README ~line 91), so the owner should decide whether Gmail needs the same care. A middle option with no behaviour risk: keep off, but show the "Shared with N agents" line right on the card so the default is visible. I recommend on-by-default because it removes a decision and matches Carta; the middle option is the fallback.

Also fix the leak seen in CA-1: the new agent should not be added to other accounts' access (Founder mail Used by, step-4).

**Wording**
- Label: "Allow changes" (drop "in {service}"; the card already sits under the service).
- Hint, current state only: Off, "Reads only." On, "Asks you before each change."
- Hint for exclusive: "Other agents ask this agent instead." (one line, no service names).
- Keep one verb for ending a connection: **Remove**. Carta has "Disconnect sign-in" and "Remove Carta"; Gmail has "Remove account" and "Disconnect Gmail" (F-CA-4-2); both pages should use the same two verbs with the same scope.

**Allow changes dialog**: proposal is to drop it (switch is reversible, writes ask anyway). If the owner wants to keep it for consent, make the confirm button neutral, not red (F-CA-5-3 on the Carta page; same component), and drop the single bullet (F-CA-5-2).

**Approvals**: #150 and #151. Not re-proposed. One extra note for #151's design: Carta's mail already gets a readable Mail card with one Send (STORY-CA-6 step-4), so app agents should reuse that card, not a second pattern.

## Clarity Issues

1. The same section means different things by position. On the app page "Agent" is a sub-block inside an account row; on the MCP page it is a top-level section. A founder who learns one page cannot apply it to the other (STORY-CA-7 step-1-gmail vs step-2-carta).
2. "Used by" and "Only this agent" both answer "who can use this app?", in different places, and they replace each other on app pages (F-CA-3-2; CA-1 step-1 vs step-4).
3. "Create agent" gives no hint what it creates. The word "agent" is introduced by this button.
4. The service name appears three times in one card (F-CA-1-5) and is the account display name ("Sales mail"), not the app name, so a user may think it is a different service.
5. A blank first chat (F-CA-1-2) says nothing about being read-only or how to change that.
6. "Denied" shown in green (F-CA-2-3).
7. Not verified in the walk: turning changes off while an approval is pending; the read-only request path; asking a different agent about the app after Only this agent is on (CA-3 walk-report). Behaviour of those is not assessed here.
