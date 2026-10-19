# NEW-2: Create a Mercury agent, make a payment, let other agents ask it

Stories: STORY-IA-1 to IA-8 (`docs/ux-paths/topics/new-integration-agents.md`).
Evidence: `docs/ux-walker/stories/STORY-IA-*/` (walk-report.md, findings.json, every screenshot opened).
Already filed or being fixed, not re-proposed here: #150 double approval, #151 raw JSON on the approval card, #152 silent re-ask after Deny; in progress: finance tiles linking to pages, "Used by" showing other accounts' agents, refusals mentioning the switch, Chief messaging an exclusive agent.

Verdict: **convoluted**. The path to a first approved payment is 11 steps on a clean run (14 as walked) against an ideal of about 5, and one of the four controls ("Only this agent") promises something the walk showed does not work.

## Friction Scorecard

### Steps, actual vs ideal (first approved payment)

| # | Actual step (IA-1, IA-3, IA-4) | Evidence |
|---|---|---|
| 1 | Integrations | IA-1 step-1.png |
| 2 | Open Mercury page (by typed URL; tile has no link, fix in progress) | F-IA-1-01 |
| 3 | Create agent (chat opens by itself, empty) | IA-1 step-4.png, F-IA-1-06 |
| 4 | Navigate back to the Mercury page to find the write switch | IA-3 step-2.png |
| 5 | Click "Allow changes in Mercury" | IA-3 step-2.png |
| 6 | Confirm in the "Allow changes in Mercury?" dialog | IA-3 step-2.png |
| 7 | Navigate back to the agent chat | IA-3 step-4.png |
| 8-11 | Four chat messages before a card: ask, "I don't know the ID, look it up", give an ID, "Yes, submit it" | IA-3 step-4 to step-7, F-IA-3-03, F-IA-3-04 |
| 12 | Allow once on the card | IA-3 step-7.png |

Clean path: 11 steps (3 + 3 + 4 + 1). As walked: 14, because the first card was denied, the agent posted a second card (#152), the second was denied, and Maya had to ask again (IA-4 step-1.png) before approving. Ideal for this journey as I would shape it: 5 (see The Simpler Version). The catalog's own ideal for IA-1 + IA-3 is 8 (3 + 5); the catalog's ideal already includes the switch, the dialog, and a trip back to the chat.

### Decisions a default could carry

- **Allow changes (off by default).** Everyone who creates a bank agent to pay things will turn this on; the creation intent ("handle the bank", IA-1 persona) is already the decision. Nobody who wants only reads asks for a payment. The switch is a setup decision asked in a different place from where the need appears.
- **Only this agent.** Nothing on the path to a first payment needs it. It is a rare setting shown with the same weight as the switch Maya must use. IA-6 persona wants it, but the walk showed it did not work (F-IA-6-01).
- **Used by.** Nine rows of switches (IA-1 step-5.png). 90% of users will not touch it on the Mercury page; Finance agent is already on, and the new agent is on. It is only relevant when someone declines the agent (IA-8).

### Re-entry

- Maya asks for a payment first (the natural thing, IA-2 step-3.png), is refused, then has to leave the chat, find the Mercury page, and come back. The refusal does not carry her to the setting (the "refusals mention the switch" fix would name it, but still makes her leave the chat).
- Recipient ID: the agent asks Maya to type an ID she does not have (IA-3 step-4.png and step-5.png). Possibly a demo gap: the demo Mercury tool list has no recipient lookup (`new-integration-agents.md`, Demo preconditions). Not verified against real Mercury, which exposes `getRecipients` in the connected MCP server tool list; treat as demo-dependent.

### Needless confirmations

- Dialog on "Allow changes" (IA-3 step-2.png) guards a reversible setting; turning it off needs no dialog (IA-5 step-0.png). The real guard is the per-call card.
- Prose confirmation then card: "Yes, submit it" before the card (F-IA-3-04, IA-3 step-6.png). Observed once; the second payment in IA-4 step-3.png showed a different agent-made card (Approve once / Cancel) and then the mandatory card. Both are the #150 family (double approval); counted, not re-proposed.
- A third approval sits outside the product: after Allow once the request is "pending approval" in Mercury (IA-4 step-2.png). That is a real external gate and cannot be removed, but the product does not tell Maya in advance.

### Dead ends and hesitations

- Empty chat after Create agent: no starter, no example (F-IA-1-06, IA-1 step-4.png).
- "Create agent" beside "Reconnect" with no reason to press it (F-IA-1-04, IA-1 step-3.png).
- Refusal when changes are off says "create the payment in Mercury", pointing away from the product (IA-2 step-3.png, IA-5 step-2.png).
- Stale page after archiving the agent (F-IA-7-02, IA-7 step-2.png) and a fresh empty chat on re-create (F-IA-7-01, IA-7 step-4.png).
- Mercury agent reading a read question as a Finance question (F-IA-2-01, IA-2 step-2.png).

## Take-away Pass

Per screen, what can be removed and the user would still succeed.

**Mercury detail page, agent not created (IA-1 step-3.png)**
- "Used by" list of 8 rows: remove from the default view. Nothing in IA-1..IA-5 uses it. Keep behind a "Share with other agents" disclosure (IA-8 path).
- "Disconnect sign-in" next to "Reconnect": two sign-in buttons; not in this journey, out of scope, noted only because it competes with "Create agent" in the same button row.
- Grey "M" tile where the grid shows the real logo (F-IA-1-03): inconsistent, not removable, a fix.

**Mercury detail page, agent created (IA-1 step-5.png, IA-3 step-3.png)**
- "Used by" row for the Mercury agent itself with a live switch (F-IA-1-02): remove; it duplicates the Agent card and can cut the agent from its own server. Also appears as an off row on Brex's page (IA-8 step-1.png): the Mercury agent should not be a Used-by candidate for Brex's page either unless Maya chose it, but that is not established; unverified.
- Hint text under "Only this agent" and "Allow changes": the "Off: ... On: ..." sentence repeats the label. Keep one short line, or drop.
- "Only this agent": hide (see below).
- The card title "Mercury agent" restates the page title and avatar list; weak, keep only if it is the link to the chat.

**Allow-changes dialog (IA-3 step-2.png)**: remove (see below). Its one bullet says "change your Mercury data" without saying payments (F-IA-3-06).

**Agent chat, first load (IA-1 step-4.png)**: blank. Add content, not remove (see changes).

**Approval card (IA-3 step-7.png)**: raw JSON and tool id are #151; not repeated. One more observation: the empty `note: ""` argument (F-IA-4-02) is part of the same card.

**Used-by list after Only this agent (IA-6 step-2.png)**: rows vanish without explanation; if "Only this agent" is hidden, this problem goes away.

## The Simpler Version

Numbered steps from "I want a Mercury agent" to a first approved payment:

1. Integrations, click the Mercury tile (tile links; fix in progress).
2. Click **Create agent**. The chat opens with one starter line, for example "Ask about balances and transactions, or ask me to send a payment." (proposal)
3. Type "Pay Acme $1,200 from checking."
4. If changes are off, the agent replies with a card in the chat: "Payments are off for this agent. Turn on?" with one **Turn on** button (proposal). One tap enables it and the agent continues with the request. No trip to the Mercury page, no dialog.
5. The payment card appears as a sentence (#151) with Allow / Deny. Allow.

That is 5, against 11 clean and 14 as walked. The Mercury page keeps one switch for turning payments off again (IA-5 shows that needs no dialog), and a "Share with other agents" disclosure for the Used by list. "Only this agent" appears inside that disclosure, not beside the payment switch.

Option, not recommended without a product decision: skip the switch entirely and rely on the per-call card. The plan (decision 8 in `docs/integration-agents/README.md`) set writes off on purpose; this critique does not argue against writes being off by default, only against where and how Maya turns them on.

### Concrete changes

1. **Turn on changes from the chat, drop the dialog.** The refusal card carries a "Turn on" button; on tap it flips the same setting the page switch uses. Remove the confirmation dialog because every payment already asks via the card (IA-4 step-1.png) and the opposite direction has no dialog (IA-5 step-0.png). Evidence: steps 4-7 of the scorecard, IA-2 step-3.png, IA-5 step-2.png. Saves 4 steps.
2. **Hide "Only this agent" until it works, then keep it as an advanced setting.** The label promises "Other agents ask the Mercury agent instead" and IA-6 step-3b.png shows Chief telling Maya to go ask herself. Chief delegation is a fix in progress; once fixed, a setting this rare still does not need the weight of the primary switch. It also overlaps with turning off rows in Used by (IA-6 alternate path 2).
3. **Remove the Mercury agent's own row from "Used by"** (F-IA-1-02). Fold the whole list behind a disclosure with one line on what it does and how it differs from the agent (F-IA-8-01).
4. **Starter line in the new agent chat** (F-IA-1-06). Saves a hesitation, not a step.
5. **Ask for the recipient by name, look it up** (F-IA-3-03). Saves two to three messages. Needs a recipient-lookup tool in the demo; on real Mercury unverified.
6. **Say once, before the first payment, that Mercury also approves** (IA-4 step-2.png): the agent's "pending approval; no money has moved yet" is accurate but arrives after Maya has already pressed Allow once.
7. **Restore the archived agent when re-creating, or say its history is archived** (F-IA-7-01). Re-entry cost, not on the first-payment path.

## Clarity Issues

1. **"Allow changes" does not say payments.** Dialog and label say "changes ... your Mercury data" (F-IA-3-06, IA-3 step-2.png). For a bank, "payments" is the word Maya thinks in. Proposed label: "Allow payments", hint "Asks you before each one."
2. **"Only this agent" is ambiguous.** Reads as "this is the only agent that exists" (F-IA-6-02). If kept: "Other agents ask this one". And the hint already says that, so the label should carry it.
3. **"Create agent" has no purpose.** Next to Reconnect (F-IA-1-04, IA-1 step-3.png). Proposed: "Create Mercury agent", with the 1-line value "Chat with your bank" as a tooltip or subtext. Do not add a persistent paragraph (repo rule: every word is UI).
4. **"Used by" vs "Agent".** Two ways to give a bot Mercury, with no stated difference; the riskier route (plain switch, all tools) has no mark (F-IA-8-01, IA-8 step-1.png and step-5.png). After the agent exists, other rows still show "on" while becoming read-only (F-IA-8-02).
5. **Card vocabulary.** "Allow once / Deny" vs "Approve once / Cancel" for the same decision (F-IA-4-01, IA-4 step-3.png and step-4.png); "Denied" in the same green as "Allowed once" (F-IA-3-05, IA-3 step-9.png). The first is part of #150; the colour is not covered by #150-#152 and is a separate small fix.
6. **Agent identity.** The new Mercury agent has the same avatar as Finance agent (F-IA-1-05, IA-1 step-4.png); the second Mercury agent has a different one (IA-7 step-4.png), which is arbitrary. Two agents that both talk about money are hard to tell apart in the sidebar. The name "Mercury agent" is clear; the avatar is the issue.
7. **Refusal copy points away from the product.** "Please create the payment in Mercury" (IA-2 step-3.png). Overlaps the in-progress "refusals mention the switch"; the extra point is that it should offer the action (change 1), not only name it.
8. **Mock markers.** Balance answer carries no "(Mock)" (F-IA-2-03, IA-2 step-1.png); demo-only concern, listed for completeness.

## What was not examined

- Phone-width layout looked fine (all `mobile-check.png`, no wrapping) and has no finding.
- Brex write flow (no write tool in demo), approval card location when Chief delegates a payment (IA-6 step 5 was not walked because Chief never messaged the agent), and behaviour on real Mercury are unverified.
- Step counts are from the walker's logs and screenshots, not a fresh run.
