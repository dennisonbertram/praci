# Walk R3 (iteration 21): verify pass-20 fixes C21-C29

Target: mock-data demo stack, desktop 1440x900. Signed in as the seeded founder; a fresh invented user (walker-r3-21@northwind.example.test) was signed up to check one-space and first-run behaviour. Clusters C30 and C31 do not exist in iteration-20/clusters.json (it ends at C29), so nine clusters were walked. Other walkers worked in the same account at the same time, so counts and chat lists moved during the walk.

Storybook smoke (`node .storybook/smoke.mjs` on a fresh build): 1802/1802 stories rendered cleanly. No failing stories.

## Verdicts

| Cluster | Verdict | Steps (actual/ideal) | Notes |
|---|---|---|---|
| C21 Integrations detail polish | PARTIAL PASS | 4/3 | Back links carry `rk-tap` (code). Gmail account date reads "Oct 22, 2026". One hint per switch on Mercury and Gmail. Mercury/Brex/Blockscout/Coinbase cards still have a "..." menu whose only item is "Manage" (R3-21-01). Coarse-pointer size not measurable: agent-browser's device mode did not set `pointer: coarse`. |
| C22 Toast poller / phone toast | PASS (signed-out) / UNVERIFIED (phone) | 2/2 | Signed-out `/` and `/signin` load made only `auth/get-session`; no notifications or approvals requests, no 401. Phone toast over a sheet not verified (no touch emulation). |
| C23 Inbox and mail cards | PARTIAL PASS | 6/4 | "Sending..." label exists on the approval card (code). Reply from an open mail worked; "Sending..." toast then Sent shown in thread. No "Sent. Moved out of Needs reply" message (R3-21-02). To do checkbox is 16 px on desktop; code gives it a 44 px area only for coarse pointers. Inbox "Not now" persistence: BLOCKED, the demo Inbox shows no sorting prompt. |
| C24 Chat transcript copy | PASS (ask card) / UNVERIFIED (rest) | 3/3 | Answered ask card now reads "Answered: Say 'a logistics customer'" (observed). "From routine: <name>" exists in `transcript.tsx` but no routine message exists on the demo. AI-off sidebar preview not reproducible (AI is on in demo). |
| C25 First-run tour | PASS | 10/9 | Step 1 reads "Search: Find any page, chat or email." Card stayed at y=642, height 140 px, on all nine stops; at stop 9 the ring on the account row is 54 px below the card. Fresh user: dismissing the first-question card starts the tour. |
| C26 GTM | PASS | 2/2 | Opens full width with the agent panel closed. Three reloads, no "Written by GTM agent" card at any point. |
| C27 Artifacts | PASS (dialog) / PARTIAL (grid) | 3/3 | Delete dialog says "MOCK All-hands Notes - October", same as the list. Grid titles are not truncated; the "v2" badge now sits on its own line (R3-21-03). |
| C28 Cmd+K | PARTIAL PASS | 3/3 | Documents has "See all in Data room". Footer key hints still plain text; Artifacts shows 5 of 10 with no "See all"; highlight inconsistent (R3-21-04). Phone scroll cue not checked. |
| C29 Sidebar spaces | PASS | 4/3 | Opening "Empty space" created no chat (shows "Select a bot" and "New bot"). One-space fresh user: Create menu has only New bot and New group. Seeded multi-space account still lists New space, which is correct under the pass-8 rule. |

Excellent: the first-run state for a new user (Chief greeting, three-choice card, dismissable) and the tour copy ("Search: ...", fixed card spot) read clearly; the Artifacts delete dialog is plain and consistent; the Integrations detail pages are short and calm.

## Findings

| id | page | severity | category | what happened vs expected | evidence | suspected location | proposed fix |
|---|---|---|---|---|---|---|---|
| R3-21-01 | C21 Integrations | P3 | flow | Observed: Mercury, Brex, Blockscout and Coinbase cards show a "..." button whose only item is "Manage"; Gmail and Carta cards have none. C21 asked to remove the one-item menu. | c21-2.png | `apps/web/src/components/integrations/parts.tsx` (card menu, about lines 80-105) | Render the menu only when it has more than the Manage item, since the whole card already opens the detail page. |
| R3-21-02 | C23 Inbox | P3 | flow | Observed: after Reply and Send, the "Sending..." pill stays about 10 s, then the row jumps from "Needs reply" to "Other mail today" with no message. No "Moved out of Needs reply" text exists in the web source (grep). | c23-4.png, c23-6.png | `InboxMessageDialog.tsx`, `outbox.ts` (suspected) | Show "Sent. Moved out of Needs reply" when the send completes and the thread leaves the group. |
| R3-21-03 | C27 Artifacts | P3 | visual | Observed: in grid view the card for a versioned artifact shows "v2" on a third line, so it is taller (about 92 px) than its neighbours (about 72 px) and the description truncates. | c27-1.png | `apps/web/src/pages/Artifacts.tsx` (~line 616) | Put the version badge beside the date or title so all cards keep one height. |
| R3-21-04 | C28 Cmd+K | P3 | visual | Observed: footer hints "Move / Open / Close" are plain text next to arrow glyphs, no key caps; Artifacts group lists 5 of 10 with no "See all"; match highlight is applied to contact descriptions but not to bot descriptions ("Mock demo data..."). | c28-1.png, c28-2.png | `apps/web/src/pages/Shell.tsx` (~line 2400, palette groups and footer) | Style the footer keys as key caps, add a See all row to Artifacts like Documents, and highlight matches the same way in every row. |
| R3-21-05 | C28 Cmd+K | P3 | copy | Observed: a Chats result snippet reads "MOCK Q3 Board Deck.md" while the chat message and the Artifacts list show the name without .md. Suspected: indexed message text carries the file name. | c28-2.png | search snippet source for chat messages (suspected) | Strip the extension when building the snippet, or leave it if only seed text has it. |
| R3-21-06 | C24 chat | P3 | flow | Observed once: after answering the Investor Relations ask card, the agent posted two near-identical questions back to back ("Before I draft October, ..." and "What were October's highlights, ..."). Probably the mock model; not confirmed. | c25-0.png | unknown (suspected mock model script) | Check whether the demo model script repeats the question; ignore if it does. |
| R3-21-07 | C25 Tour | P3 | visual | Observed: the fixed 140 px tour card leaves an empty band above the buttons on one-line steps (for example step 1). | c25-n1.png | `apps/web/src/components/tour/FirstRunTour.tsx` | Keep the fixed height (it stops rows moving) but anchor the buttons under the text only if the owner wants less empty space; otherwise leave. |

## Not verified

- Touch-target sizes (back links, To do checkbox, toast on phone): `agent-browser set device` did not enable `pointer: coarse`, so measurements would be invalid.
- Inbox "Not now" memory and the AI-off sidebar preview: the demo state never shows these prompts.
- "From routine" label: no routine-run message in the demo data.
