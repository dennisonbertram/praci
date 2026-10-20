# Redundancy and information architecture: new features (2026-10-19)

Scope: Connect apps pill, integration agents on MCP and app pages, Carta agent controls, Elio call entry, Gmail rate-limit notice.
Evidence: the "Redundancy candidates" list in `docs/ux-paths/catalog.md`, `docs/ux-paths/topics/new-*.md`, and the walk reports, findings and screenshots under `docs/ux-walker/stories/STORY-{NA,IA,CA,EL,GR}-*`. Only the screenshots named below were opened; other claims rest on the walk reports. Nothing here was re-walked.

## Duplicate Paths

**P1. Four ways to give an app to a bot. Drift, make one canonical.**
- Create agent (IA-1, CA-1), the per-bot Used by switches (IA-8, CA-3), Only this agent (IA-6), and the connect wizard step "Which bots can use Slack?" with every bot pre-checked (`STORY-NA-4/screenshots/step-3.png`). The catalog lists three; the wizard is a fourth.
- Evidence of conflict: IA-8 F-IA-8-01 says the page does not explain how Create agent and Used by differ, and a plain switch gives a bot every tool, including writes, with no risk marker. F-IA-8-02: after Create agent, Chief and Finance helper stay switched on in Used by with nothing showing they are now read-only. CA-3 F-CA-3-2: Only this agent and Used by both control access but sit in different places and replace each other on app pages.
- Recommendation: make the agent the canonical route for apps that can write (Mercury, Carta, Notion). Keep Used by as the sharing control for read-only use. Reuse one sentence on the Create agent button's hint, and mark Used by rows as "read only" once an agent exists. The wizard's all-checked default is the most permissive of the four; default it to unchecked, or reduce it to "All bots / Choose later", before the app has an agent.

**P2. Three entries to Integrations. Deliberate, keep.**
- The pill, the plain "Integrations" row, page search, and `/app/integrations` (NA-1, NA-2, NA-3). The pill replaces the row, and the row shows only while the page is open (`STORY-NA-4/screenshots/step-3.png`, `STORY-IA-1/screenshots/step-2.png` show the two states), so only one sidebar entry is visible at a time. No duplicate on screen. Pass.

**P3. Two page layouts for the same agent controls (CA-7). Drift, make one canonical.**
- F-CA-7-1: Gmail nests the Agent card in the account row beside Rename and Create agent; Carta puts it top-level under the action row (`STORY-CA-7/screenshots/step-1-gmail.png`, `step-2-carta.png`). Used by: gone for a linked Gmail account, kept on Carta (F-CA-3-1 calls the Gmail gap a dead end: Maya cannot see who else has access).
- Recommendation: one structure, with Agent first and Used by always present below it. For multi-account apps, the Agent card per account row is justified; the single-server MCP page can render the same card as a one-row case.

**P4. Reaching Elio. Mostly deliberate; one gap.**
- Call Elio is in the composer of every bot chat, in the Elio chat, in the Elio sidebar entry and on mobile (catalog). It is one component in several places, which is fine. The gap is that Call Elio inside Chief's chat reads as calling Chief (EL-5 report, "Hesitations"). Keep both locations; the button's label or tooltip must say Elio. F-EL-5-3: no tooltip appeared on hover.

**P5. Talking to Mercury or Brex data: Mercury agent, Finance agent, Chief via Only this agent. Partly broken.**
- IA-6 F-IA-6-01 (high): with Only this agent on, Chief does not ask the Mercury agent; it tells Maya to go to the agent's chat. The Finance agent still answers from synced data (`STORY-IA-6/screenshots/step-6.png` per report). The page's promise "Other agents ask the Mercury agent" does not hold, so the control that removes the duplicate path also removes the answer. This is a defect, not a path to prune.

**P6. Retry for a throttled inbox (GR). Deliberate, keep.**
- Try again, tab return, and the one-minute poll all re-run the same sync. Users see one button. No duplication on screen (GR-1 report: "notice appears once").

**P7. Opening the Carta agent: Carta page, Cap table page, chat. Deliberate, keep.**
- CA-4 report: Open Cap table opens the page with the agent panel; the agent link opens the chat. Three views of different content. Keep.

## Duplicate Information

**I1. Carta's Used by repeats the Agent card (CA-4 F-CA-4-1, medium). Remove.**
- `STORY-CA-7/screenshots/step-2-carta.png`: "Only this agent" is on, and directly below Used by lists one row, "Carta agent", with an active switch. The switch can turn off the agent's own access. Hide Used by while Only this agent is on, or show it read-only. The same screen has a hidden-state inconsistency: other bots lose Carta with no note (F-IA-6-02 says the same for Mercury: Used by drops from nine rows to one silently).

**I2. The "Slack connected" dialog restates the page (NA-4 F-NA-4-1, low). Remove.**
- `STORY-NA-4/screenshots/step-4.png`: title "Slack connected", subtitle "Slack is ready.", then "All bots can use Slack." and "Slack now appears under Connected." The first two say the same thing; the third describes the page behind the dialog; the fourth repeats the choice just made in step 2. Keep only the title and Done, or drop the dialog and show the tile as Connected.
- Also: the wizard step 2 text "You can change this later." and the Integrations intro "You choose which bots get access to each one." (`STORY-IA-1/screenshots/step-2.png`) both explain Used by.

**I3. Featured-app status shows in the pill, the Popular grid and the connected cards (catalog).**
- The pill is an entry point, not a status display; its logos are the unconnected apps. The cards carry status. Different facts, so this is deliberate. One risk: the page shows "Used by" avatars on each connected card and again in the detail page. Keep (summary and detail).

**I4. The Carta agent chat shows its intro and a suggested chip twice (CA-4 F-CA-4-3, low). Remove one.**
- Two empty-state blocks: "The Carta agent reads your cap table..." at the top and "I keep your cap table..." above the input.

**I5. Approval requested twice (IA-3 F-IA-3-04, medium).**
- The agent asks in prose ("Here's the payment request for your approval", then Maya types "Yes, submit it") and then the approval card appears. Keep the card, remove the prose confirmation.

**I6. Page-level refusal text does not mention the switch (IA-2, IA-5 F-IA-5-01).**
- This is the reverse problem: the information is missing where it is needed. The Allow changes dialog also says "change your Mercury data" and never says money moves (F-IA-3-06).

**I7. Gmail notice: no duplication.** One title, one sentence, one button (GR-1 report, `STORY-GR-2/screenshots/step-1-notice.png`). Pass. The notice's own defect (it vanishes after about 25 s and reverts to "No mail", F-GR-1-001) is a state problem, not redundancy.

## Overlapping Features

**O1. Used by vs the integration agent. Overlap, resolve with P1.** Both decide which bots can use an app. After Create agent, the Used by switches stay but are ignored for writes (IA-8 F-IA-8-02, CA-3 steps 2-4). Treat the agent as the owner and Used by as a shared read list; show who holds access in one place.

**O2. Elio vs Chief. Overlap in the entry point.**
- Elio lives inside Chief's composer and does not exist in the roster until a voice provider is connected (EL-1 report). Without a provider, Call Elio opens an API-key form for four vendors with no sentence on why (F-EL-5-1) and a mostly empty right pane (F-EL-5-2). A user asking to call Chief gets a settings form. Recommendation: the first use should say "Calling needs a voice provider" in the dialog, once; keep Elio as a distinct name and avatar so it is not confused with Chief. UNVERIFIED beyond that: Elio's delegate and private-history stories (EL-3, EL-4) were not walked.

**O3. Finance agent and Mercury/Brex agents. Overlap in data, distinct in source.** Both answer balances; the Finance agent uses synced data and can be staler (catalog). Not walked for disagreement. No change recommended until a user sees two numbers; if they can, label the source in the answer.

**O4. Mercury agent plus Mercury's own approval (IA-4).** The Praci card and Mercury's pendingApproval request are two gates by design (IA-4 text). Keep, but the agent's reply should say Mercury still needs approval (UNVERIFIED that it does).

## Hierarchy & IA

**H1. One concept, one name: "Allow changes" vs "write".** UI labels: the switch is "Allow changes in X", the dialog button "Allow changes", the error "Could not update changes", but the Tools list in `STORY-CA-7/screenshots/step-1-gmail.png` groups tools as "Read" ("Never changes your account") and "Write" ("Changes your account"). Choose "changes" (or "read-only"/"can make changes") everywhere user-facing, and rename the "Write" group to "Changes". The IA-2 refusal also says "payment action isn't available here" instead of "changes are off".

**H2. "Remove account" vs "Disconnect sign-in" vs "Remove Carta" vs "Disconnect Gmail" (CA-4 F-CA-4-2).**
- Gmail page: per-row "Remove account"; bottom "Disconnect Gmail  Removes all 2 accounts and bot access." Carta page: top row "Disconnect sign-in"; bottom "Remove Carta (MOCK DEMO)  Removes the connection and bot access." (`step-1-gmail.png`, `step-2-carta.png`). "Disconnect" means opposite scopes on the two pages (all accounts on Gmail, sign-in only on Carta), and Disconnect sign-in sits in the top row beside Reconnect, away from the destructive buttons. Recommendation: one pair of verbs. "Disconnect" = revoke sign-in, keep config and agent; "Remove" = delete connection. Use them the same on both pages and keep both destructive actions together at the bottom. Only "Remove" should carry the confirmation; none of the three walks exercised these dialogs (catalog gap: no disconnect or remove-account story).

**H3. "Agent" vs "bot".** The same object has both words on one screen: the heading "Agent" and "Other agents ask..." next to "Which bots can use Slack?", "Could not update bot access", "Removes the connection and bot access", and the page intro "so your bots can read and act" (`STORY-NA-4/screenshots/step-3.png`, `STORY-IA-1/screenshots/step-2.png`, `step-2-carta.png`). Pick one user word and use it in all copy. The repo uses "bots" for chats and "agent" for the linked integration role, so either rename "agent" copy to "bot" (the Mercury bot) or the reverse; do not keep both.

**H4. Create agent has no hint of what it makes (IA-1 step 2, CA-1 step 2).** It sits among Reconnect, Rename, Remove, with no explanation. Show one line only on hover or in the empty Agent area ("A bot that only works with Mercury"), per the repo's progressive disclosure rule.

**H5. Layout and defaults inconsistent between pages (F-CA-7-1, F-CA-7-2, F-CA-5-3).**
- Only this agent defaults to off on Gmail's linked account and on for Carta (`step-1-gmail.png` vs `step-2-carta.png`). The switch label uses the account name on one and "Carta" on the other. The Allow changes dialog says "The agent" on one and "The Carta agent" on the other; its confirm button is red like a destructive action. Use one template.

**H6. The pill hides on the Integrations page.** A deliberate, reasonable choice (NA-3 variations). Pass.

## Counts

- Duplicate Paths: 7 items (3 findings to act on: P1, P3, P5; 4 pass or keep: P2, P4 with a note, P6, P7)
- Duplicate Information: 7 items (4 to act on: I1, I2, I4, I5; I6 is a missing-information finding; I3 and I7 pass)
- Overlapping Features: 4 items (O1, O2 to act on; O3 and O4 keep, unverified)
- Hierarchy & IA: 6 items (5 to act on: H1 to H5; H6 pass)
