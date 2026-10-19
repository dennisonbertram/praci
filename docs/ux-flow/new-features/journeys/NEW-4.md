# NEW-4: Carta agent controls and an investor email

Stories: CA-4 (Agent section and defaults), CA-5 (allow changes), CA-6 (investor email with approval), CA-7 (compare the two pages).

Evidence: `docs/ux-walker/stories/STORY-CA-{4,5,6,7}/` (walk-report.md, findings.json, screenshots; all opened). Stories: `docs/ux-paths/topics/new-connected-app-agents.md`. Code: `McpDetail.tsx`, `IntegrationAgentSection.tsx`, `apps/api/src/carta-agent.ts`. The shared-layout proposal is in NEW-3.md and applies here unchanged; this file only adds what is specific to Carta.

Already filed, not re-proposed: #150 (double approval, shown for app agents) and #151 (raw tool name and JSON on app-agent approval cards). Carta's mail card (CA-6 step-4) shows neither problem: one Send, readable fields.

Verdict: **acceptable**. The Carta flow is close to ideal on steps and its mail card is the best approval UI in the product. What remains is one redundant list, copy and verb drift against the app page, a duplicated draft, and one recipient-exposure defect (high).

Walk limits: CA-6 stopped at Discard. Approve, the second email, the Sent view and Auto Review behaviour were not exercised. Carta writes (option grant) could not be tested because the emulator exposes reads only; CA-5 step-3 shows the agent saying changes are off right after the switch was on (F-CA-5-1; the walker could not tell demo-model text from a real state bug).

## Friction Scorecard

| Story | Actual vs ideal | Evidence |
|---|---|---|
| CA-4 find the Agent section | 2 vs 2. Agent card visible without scrolling at 1280x800 and 390px. | CA-4 step-1, mobile-check |
| CA-5 allow changes | 2 vs 2 (switch, dialog confirm). | CA-5 step-1, step-2 |
| CA-6 investor email | Walked 5 turns to the approval card: ask, answer the questions with "skip", read draft, "Send it", card. Ideal 3: ask, card, Send. | CA-6 step-1 to step-4 |
| CA-7 compare pages | Not a task, a consistency check. The two pages differ (below). | CA-7 screenshots |

**Decisions a default could carry**
- "Only this agent" is on and writes off: sensible. This is the same combination NEW-3 proposes for every app agent.
- The agent asks three questions first ("What were the Q3 highlights, lowlights, and asks?"), and the user answers "skip" (CA-6 step-1/2). A default would carry it: the draft has TBD sections anyway (step-3), so the agent can draft immediately and mark gaps, the way the prompt rules say. One forced turn.
- Recipients: the agent offered "investors Bcc'd" but the card has all three investors in To (F-CA-6-1, step-3 text vs step-4 card, high severity: each investor's address exposed to the others). Default for an investor update should be Bcc.
- The signature "Alex": the user is Maya Chen (F-CA-6-4). Prefill from the account.

**Re-entry:** none on the Carta page itself. The agent chat tells the user where to find the switch ("Turn on Allow changes in Carta under Integrations -> Carta", CA-5 step-3) as plain bold text, so the user leaves chat, finds the page, and comes back.

**Needless confirmations:** none found on the mail path. The Allow changes dialog (CA-5 step-1) is discussed in NEW-3.md; the same proposal applies. Send then needs its own approval, which is correct for email.

**Dead ends:** the "Open Cap table" and agent links work (CA-4 step-2, step-3). After Discard, the agent keeps working ("Thinking 53.7s", CA-6 step-6) with no stated outcome in the screenshot; the walker did not wait for the result.

**Hesitations**
- "Disconnect sign-in" and "Remove Carta (MOCK DEMO)" are two different exits with different scopes (F-CA-4-2, CA-4 step-1).
- Send is visible before the body is fully shown; the body is clipped at about 5 lines with "Show more" (F-CA-6-3, step-4).
- The body shows raw markdown (`**Highlights**`, `- TBD`) on the card while the chat above renders it (F-CA-6-2, step-5).
- The Allow changes dialog's confirm button is red as for a destructive action (CA-5 step-1).

## Take-away Pass

**Carta page (CA-4 step-1)**
- Used by: one row (Carta agent) with a live switch. It repeats what the Agent card and Only this agent already say, and the switch can turn off the agent that owns the page (F-CA-4-1). Remove when Only this agent is on (same rule as NEW-3's "Shared with N agents").
- "Removes the connection and bot access." next to the Remove button: explains an action by repeating its label. Candidate to remove.
- Header row: Open Cap table, Reconnect, Disconnect sign-in, Rename. Four equal outline buttons and no primary. "Reconnect" matters only when signed out; "Rename" is rare. Candidate: keep Open Cap table visible, move Rename, Reconnect and Disconnect into a "..." menu. Not yet verified that Reconnect is only needed when signed out; the Gmail code shows it only when `lapsed`, Carta shows it always.
- Agent card: agent name as a link (needed), two switches (needed).

**Carta agent chat empty state (CA-4 step-3, F-CA-4-3)**
- Intro appears twice (top "The Carta agent reads your cap table..." and above the composer "I keep your cap table...") and the chip "Draft this month's investor update" twice. Remove one block.

**Mail approval card (CA-6 step-4)**
- Card shows Mail label, Needs approval, first recipient, Edit, subject, To, body, Show more, Send, Discard, "...". Good. Missing: Cc and Bcc rows (only To is shown, so a Bcc default would need a row); a warning for multiple external To addresses (F-CA-6-1).
- The draft is shown first in chat (step-3) and then again in full in the card (step-4/5). Drop the chat copy when a card follows.

**Allow changes dialog (CA-5 step-1, mobile-check)**: single bullet with centered text misaligned on mobile (F-CA-5-2). Drop the bullet.

## The Simpler Version

1. Open Integrations, open Carta (or the cap table page). The Agent card shows who handles Carta, changes off, only this agent on. Nothing else about access is listed. (Same 2 steps as now.)
2. Turn on **Allow changes** only if needed. The switch applies at once; each change still asks (proposal, see NEW-3.md for the risk).
3. In the Carta agent chat, type "Draft the Q3 investor update".
4. The agent drafts at once with TBD gaps (no question round) and shows one Mail card: To empty or Bcc filled with the investors, subject, rendered body, signature from the account, Send and Discard.
5. Review, press **Send** (the one approval). A second email later gets its own card (README rule; not exercised in the walk).

### Concrete changes

1. **Bcc for investor updates by default**, and show To, Cc, Bcc rows on the card, with a note when more than one external address is in To. Fixes F-CA-6-1 (high). The walker saw this with the demo model; whether the real model also does it is not tested, so the card-level warning is the safe fix because it does not depend on the model.
2. **Draft once.** When a send card follows, do not repeat the full draft in the chat message; the card has Edit.
3. **Do not ask the three questions first.** Draft with TBD, ask afterwards what to fill. (One turn saved; the TBD handling already exists in the draft, step-3.)
4. **Render or strip markdown in the card body** (F-CA-6-2). Show the full body up to a longer limit, or label the clip, so Send is not above unread text (F-CA-6-3).
5. **Remove the single-row Used by** when Only this agent is on (F-CA-4-1) and apply the shared layout from NEW-3.md.
6. **One chat intro** (F-CA-4-3).
7. **Same copy as the app page.** Dialog and hints: "The Carta agent will..." vs "The agent will..." (F-CA-5-3). Use one sentence form: "The agent can change your {service} data. It asks before each change."
8. **Same destructive verbs on both pages** (F-CA-4-2).
9. **Make the chat's pointer a link.** "Integrations -> Carta" in the agent's "changes are off" reply should link to the Carta page (CA-5 step-3).
10. Check F-CA-5-1 (agent said changes were off while the switch was on). If it is real state staleness it is a correctness bug; if it is canned demo text, nothing to do. Unresolved.

## Clarity Issues

1. The word "changes" in "Allow changes in Carta" says nothing about sending email, and email approval does not depend on it (stories doc, CA-6 Edge Cases; CA-6 walk shows the mail card with changes off). A user may think the agent cannot send mail when the switch is off, or that turning the switch on is what allows mail. Not verified with a user; flagged from the story and walk. One neutral fix: the mail card says "Needs your approval", already true, so no extra copy is needed unless users show confusion.
2. "Only this agent": Other agents ask the Carta agent. The hint names Carta twice in a sentence where the page is already about Carta (CA-4 step-1).
3. Switch label "Allow changes in Carta" uses the app name ("Carta"), but the page title is "Carta (MOCK DEMO)". On the app page the label uses the account name. Same field, two naming rules (F-CA-7-2).
4. The two defaults for "Only this agent" are not visible as a difference to the user, but the first Carta page they see has it on and the first app page has it off (CA-7 step-1-gmail vs step-2-carta). See NEW-3.md, Defaults.
5. Approve and "Allowed once" labels are not exercised for Carta mail in the walk (only Discard). Clarity of the post-Send state is unverified.
