# UX flow report: new features (2026-10-19)

Screenshots cited here are kept locally and not committed; the written findings are the record.

Scope: the Connect apps pill, integration agents on MCP and app pages, the Carta agent, the Gmail rate-limit notice, and Elio's first call.
Detail lives in `docs/ux-flow/new-features/journeys/NEW-1.md` to `NEW-6.md` and `docs/ux-flow/new-features/redundancy.md`. Screenshot paths below are relative to `docs/ux-walker/stories/`.

## Run Summary

| Item | Value |
|---|---|
| Journeys critiqued | 6 |
| Evidence | /ux-walker artifacts on the mock demo, slot 7, 2026-10-19 (no re-walk during the critique) |
| Acceptable | NEW-1, NEW-4, NEW-5, NEW-6 (provisional) |
| Convoluted | NEW-2, NEW-3 |

| Journey | Verdict |
|---|---|
| NEW-1 Connect apps | acceptable |
| NEW-2 Mercury agent | convoluted |
| NEW-3 App agent | convoluted |
| NEW-4 Carta | acceptable |
| NEW-5 Rate limit | acceptable |
| NEW-6 Elio first call | acceptable, provisional (only EL-5 case A was walked; the Scripted provider is missing on the demo stack, F-EL-5-4) |

## Friction Scorecard

| Journey | Steps actual / ideal | Needless decisions | Re-entry | Dead ends | Verdict |
|---|---|---|---|---|---|
| NEW-1 Connect apps | 6 / 4 to connect Slack from the pill (pill and page are 1 / 1) | 1: the pre-ticked "Which bots can use Slack?" step; plus 1 needless confirmation, the "Slack connected" Done dialog | None | None (failed list load falls back to the plain row and the page explains it) | acceptable |
| NEW-2 Mercury agent | 11 clean, 14 as walked / about 5 (catalog ideal 8) | 3: Allow changes (off by default), Only this agent, Used by (9 rows); plus the Allow changes dialog and the prose confirmation before the card | Refused in chat, leave to the Mercury page, come back; recipient ID typed by the user (demo-dependent) | Empty chat after Create agent; refusal says "create the payment in Mercury" | convoluted |
| NEW-3 App agent | CA-1 5 / 4, CA-2 8 / 7, CA-3 2 / 2 | 3: Only this agent default, Allow changes dialog, which account to create the agent for | Blank chat, then back through Integrations to find the Agent card (below the fold at 1280x800) | Blank chat; no view of who shares an account once it has an agent | convoluted |
| NEW-4 Carta | CA-4 2 / 2, CA-5 2 / 2, CA-6 5 / 3 | 2: the three questions before drafting, recipients in To instead of Bcc | Leaves chat to find the switch the agent names | None; Discard outcome not seen | acceptable |
| NEW-5 Rate limit | 1 / 1 click, plus a silent wait of about 13 s | 1: when to press Try again (the app retries itself) | None | 1 soft: a failed retry looks identical to no retry | acceptable |
| NEW-6 Elio first call | 2 presses / 1 (second press after connecting a provider, suspected) | 2: which of four providers (none preselected); whether to start the call after connecting | Presses Call Elio twice | 1: closing the Voice dialog returns to an unchanged chat | acceptable, provisional |

Sources: Friction Scorecard section of each journey file. NEW-6 step counts after connecting are suspected, not walked.

## Redundancy Map

Source: `docs/ux-flow/new-features/redundancy.md` (7 duplicate paths, 7 duplicate information, 4 overlapping features, 6 hierarchy items).

| Id | Finding | Call |
|---|---|---|
| P1, O1 | Four ways to give an app to a bot: Create agent, per-bot Used by, Only this agent, and the wizard's pre-ticked bot step. Used by switches stay on but are ignored for writes once an agent exists. | Make the agent canonical for apps that can write; Used by becomes a read-only sharing list |
| P3, H5 | Two page layouts for the same Agent controls (Gmail nests it in the account row, Carta is top level); Only this agent defaults differ; label and dialog copy differ. | One shared layout and one template |
| P5 | With Only this agent on, Chief does not ask the Mercury agent (F-IA-6-01). | Defect, fix in progress |
| I1 | Carta Used by repeats the Agent card, and its switch can cut the agent from its own server. | Remove while exclusive |
| I2 | "Slack connected" dialog states one fact four ways. | Reduce to title and Done, or drop the dialog |
| I4 | Carta chat shows its intro and the suggested chip twice. | Remove one block |
| I5 | Approval asked in prose, then by the card (#150). | Keep the card |
| I6 | Refusal and dialog never say payments or the switch. | Missing information, not duplication |
| O2, P4 | Call Elio sits in Chief's composer and reads as calling Chief. | Keep both locations, fix the explanation (#153) |
| H1 | "Allow changes" vs "Write" vs "payment action" for one concept. | One name |
| H2 | "Disconnect" and "Remove" mean different scopes on Gmail and Carta pages. | One verb pair |
| H3 | "Agent" and "bot" for the same object, sometimes in one dialog. | One word in user copy |
| H4 | Create agent gives no hint what it makes. | One line on hover or in the empty Agent area |
| Keep | P2 (three entries to Integrations), P6 (retry paths), P7 (Carta views), I3, I7, O3, O4, H6 | Deliberate or no duplicate on screen |

## Simplification Proposals

Ranked. Effort: S small, M medium, L large.

### 1. One shared Agent layout on MCP and app pages (NEW-3, redundancy P3/H5). Effort M.

- Now: the same `IntegrationAgentSection` sits in two different parents. App pages put Create agent and the Agent card inside each account row and show page-level Used by only for rows without an agent, so creating an agent reshuffles the page. MCP pages put Create agent in the header and always show Used by. The Gmail page and the Carta page differ in layout, defaults, label wording and dialog wording.
- Proposed: per connection, header with Rename, Reconnect and Remove only; then an Agent block first (Create agent button, or a card with the agent name as link, Allow changes and Only this agent); then Used by (proposal 3); tools list collapsed. Multi-account apps repeat the Agent block per account row with no page-level Used by. One copy template: "Allow changes" without the service name, a hint showing the current state only.
- Saves: a layout jump, one dead end (no view of who shares), a trip to scroll for the Agent card, one redundant list on Carta, repeated service names in the hint.
- Evidence: `STORY-CA-7/screenshots/step-1-gmail.png`, `STORY-CA-7/screenshots/step-2-carta.png`, `STORY-CA-1/screenshots/step-1.png`, `step-4.png`; F-CA-1-4, F-CA-3-1, F-CA-7-1, F-CA-7-2; `apps/web/src/components/integrations/AppDetail.tsx` (lines 393-470), `McpDetail.tsx` (lines 190-245).

### 2. Mail approval card: Bcc, recipient rows, warning, rendered body (NEW-4). Effort S-M.

- Now: the Carta agent told the user investors would be Bcc'd, but the card has all three investors in To, which exposes each address to the others (F-CA-6-1, high). The card shows only To. The body shows raw markdown (`**Highlights**`) and is clipped at about 5 lines with Send above unread text.
- Proposed: default to Bcc when there are several external recipients; show To, Cc and Bcc rows on the card; warn when several external addresses are in To; render the markdown in the body and label any clip.
- Saves: a data-exposure defect that does not depend on the model; one misleading card state.
- Evidence: `STORY-CA-6/screenshots/step-3.png` (chat text), `step-4.png`, `step-5.png` (card); F-CA-6-1, F-CA-6-2, F-CA-6-3.

### 3. "Shared with N agents" disclosure instead of "Used by" beside an agent (NEW-2, NEW-3, NEW-4, redundancy I1/O1). Effort M.

- Now: Used by is a page-level list of up to nine switches. After an agent exists it stays, with the agent's own switchable row, and other rows still read "on" while being ignored for writes. Rows vanish without a note when Only this agent is on.
- Proposed: drop the agent's own row. Show "Shared with N agents" only when the integration is not exclusive, as a collapsed disclosure holding the per-agent switches, with one line saying how it differs from the agent. Show nothing when exclusive.
- Saves: nine rows that most users never touch, a switch that can cut an agent from its own server, and silent disappearance.
- Evidence: `STORY-IA-1/screenshots/step-5.png`, `STORY-IA-8/screenshots/step-1.png`, `step-5.png`, `STORY-CA-7/screenshots/step-2-carta.png`; F-IA-1-02, F-IA-8-01, F-IA-8-02, F-CA-4-1, F-IA-6-02.

### 4. New integration agent chat lands on a short intro (NEW-2, NEW-3). Effort S.

- Now: Create agent opens an empty thread with only the composer. The user does not learn that the agent is read-only or where to change that, and goes back to the app page to find out.
- Proposed: a short intro in the thread (what it can read, that changes are off, a link to the switch), using the existing Carta chat empty-state pattern with its duplicate block removed (I4). Optionally one starter line.
- Saves: the trip back to the app page (NEW-3 step count 5 / 4) and a hesitation.
- Evidence: `STORY-IA-1/screenshots/step-4.png`, `STORY-CA-1/screenshots/step-3.png`; F-IA-1-06, F-CA-1-2, F-CA-4-3.

### 5. Connect wizard: drop or fold the bot step, de-duplicate the "connected" dialog (NEW-1, redundancy P1/I2). Effort S.

- Now: after sign-in, a "Which bots can use Slack?" dialog (STEP 2 OF 3) opens with all nine bots pre-ticked and Skip and Continue, then a "Slack connected" dialog says the same fact four ways, then Done. 6 clicks against 4.
- Proposed: remove the bot step (access stays editable afterwards) or reduce it to "All bots / Choose later"; replace the final dialog with a toast or a Connected tile, no Done. The open question of what is safe as a default is covered by the owner decision (b) below and redundancy P1 (the all-ticked default is the most permissive of the four routes).
- Saves: 2 clicks and one restated fact.
- Evidence: `STORY-NA-4/screenshots/step-2.png`, `step-3.png`, `step-4.png`, `step-5.png`; F-NA-4-1; walk-report `STORY-NA-4/walk-report.md`.

### 6. One name per concept (redundancy H1, H2, H3). Effort S.

- Now: "Allow changes" vs "Write" (tools list) vs "payment action"; "Disconnect" vs "Remove" mean different scopes on the Gmail and Carta pages and sit in different places; "agent" and "bot" are used for the same object, sometimes in one dialog.
- Proposed: use "changes" everywhere (rename the "Write" group to "Changes"); one pair of verbs, "Disconnect" for revoking the sign-in and "Remove" for deleting the connection, used the same way on both pages and placed together; pick one of "agent" or "bot" for user-facing copy.
- Saves: a vocabulary the user must otherwise decode on every integration page.
- Evidence: `STORY-CA-7/screenshots/step-1-gmail.png`, `step-2-carta.png`, `STORY-NA-4/screenshots/step-3.png`, `STORY-IA-1/screenshots/step-2.png`; F-CA-4-2, F-IA-3-06.

### 7. Rate limit: say it is still limited after a failed retry (NEW-5). Effort S.

- Now: pressing Try again while Gmail is still limiting returns a screen identical to before, after about 13 s. The notice also says "Try again in a minute" while the real pause is 30 s.
- Proposed: after a failed retry, change the line (for example "Still limited. Tried just now.") so the click has a visible result; remove the time from the copy. The spinner and the stable button width are already in progress on `fix/ux-walk-inbox`.
- Saves: the soft dead end where a retry looks like nothing happened.
- Evidence: `STORY-GR-2/screenshots/step-1-notice.png` vs `step-3-after.png`; F-GR-2-002, F-GR-1-002.

### 8. Elio: start the call automatically after a provider connects (NEW-6; related to #153). Effort S.

- Now: Call Elio with no provider opens Settings > Voice with no explanation; after connecting and closing, the chat is unchanged and the user presses Call Elio again (suspected, not walked). Four providers show with none preselected, and the key field and a disabled Connect show before a provider is chosen.
- Proposed: after Connect succeeds from a Call Elio press, close the dialog and start the call. Show the key field only after a provider is chosen, or preselect one. The one-line explanation belongs to #153.
- Saves: the second press and the dead end after closing the dialog.
- Evidence: `STORY-EL-5/screenshots/step-1.png`, `step-2.png`; F-EL-5-1, F-EL-5-2. Unverified whether the call already starts automatically; confirm before building.

## Needs the owner's decision

These are not ranked. Both trade a safety or access property against speed.

- (a) Drop the "Allow changes" confirmation dialog, or add a "Turn on" button inside the agent's refusal (NEW-2, NEW-3). The dialog guards a reversible setting, turning it off needs no dialog, and every write still asks per call. Removing it, or enabling from the chat, saves up to four steps on the Mercury path (11 clean steps against about 5). The cost is removing a deliberate safety step on money-moving writes. Per-call approval remains. If the dialog stays, make the confirm button neutral instead of red and drop the single bullet (F-CA-5-2, F-CA-5-3). Evidence: `STORY-IA-3/screenshots/step-2.png`, `STORY-IA-5/screenshots/step-0.png`, `STORY-IA-2/screenshots/step-3.png`.
- (b) "Only this agent" on by default for new app agents, or off with a sharing count (NEW-3). On matches Carta and removes a decision, since the user just asked for a dedicated agent. The risk: on a shared mail account the new agent takes Inbox and Chief access away at once. The README exempts the Finance agent for Mercury and Brex, so Gmail may need the same care. The fallback is to keep off and show "Shared with N agents" on the card (proposal 3). Also fix the leak where the new agent was switched on in another account's access list (F-CA-1-1). Evidence: `STORY-CA-1/screenshots/step-4.png`, `STORY-CA-7/screenshots/step-1-gmail.png` vs `step-2-carta.png`.

## Already filed

- #150: one send needs two approvals.
- #151: readable approval card (raw tool name and JSON).
- #152: silent re-ask after Deny.
- #153: Elio first run and demo voice.
- #154: logo fallback.

## Already fixed in progress

- Branch `fix/ux-walk-inbox`: the rate-limit notice turning into "No mail", its copy, and the spinner.
- Branch `fix/ux-walk-agents`: finance tiles linking to their pages, other agents shown in Used by, the Denied color, dialog alignment, refusal text, and Chief messaging an exclusive agent.

## Already Minimal

What the critics praised and left alone:

- The Connect apps pill: 1 step to notice and 1 click to reach Integrations; it hides on the Integrations page, which is correct (NEW-1, P2, H6).
- Failure fallback for the pill: it degrades to the plain Integrations row and the page explains the error (`STORY-NA-5/screenshots/step-3.png`, `step-4.png`).
- Carta's mail card: readable fields and one Send, none of the #150 or #151 problems; the best approval UI in the product, and the pattern app agents should reuse (`STORY-CA-6/screenshots/step-4.png`).
- Finding and using Carta controls: Agent card visible without scrolling at 1280x800 and 390px, Allow changes in 2 steps (CA-4, CA-5).
- The rate-limit notice itself: one icon, title, sentence and primary button, shown once at both widths (`STORY-GR-1/walk-report.md`).
- Switching Allow changes off needs no dialog (`STORY-IA-5/screenshots/step-0.png`).
- Deliberate duplicates worth keeping: three ways into Integrations, Call Elio in every chat, and the retry paths behind one Try again button.
- Phone width: no wrapping problems on the Mercury page (`mobile-check.png`).
