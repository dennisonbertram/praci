# Walk W2: STORY-APP-351 to STORY-APP-400

Walker session uxl1-W2, mock-data demo stack (web 5381), 1440x900, signed in as the demo founder. Screenshots are under `/tmp/uxloop1/W2/` (outside the repo).
Steps are shown as actual/ideal. "Observed" means I saw it in the browser. "Suspected" means inferred from code.

## Walk caveats

- The demo is shared with other walkers and already holds state the catalog assumes is absent: a Mercury agent exists with Allow changes on, Gmail/Drive/Notion/Carta/Brex/Coinbase are connected, a "Monday cash check W6" routine exists, and the AI data sharing switch for one model was already on. Several preconditions therefore differ from the catalog.
- Side effects I left on the demo: BlueBubbles saved with a fake local address (tile reads "Needs a server restart"); Slack connected in "Empty space" (a "Slack agent" appeared); one Chief message remembered; several Chief and Mercury chat turns, including one denied and one approved fake payment of $50 to "Acme (Mock)". Temporary test skills and the time zone change were reverted (time zone is back to New York).
- Console showed no errors during the walk. Geometry audit on Integrations: no overflow, no wrapped controls, no spills.

## Story verdicts

| Story | Verdict | Steps | Note |
|---|---|---|---|
| 351 | FAIL | 5/4 | Account zone changed fine ("Time zone updated"). Existing routine keeps its own zone (as the story says), but a NEW routine shows the browser zone, not the account zone (W2-01, W2-02). |
| 352 | PASS with friction | 9/10 | Switch off makes the Inbox card return; Allow turns the switch back on (same permission). Browser switch blocked in headless. Export already "Ready", no way to request a new one (W2-08). Monday-reminder approval card step not walked. |
| 353 | PASS | 8/9 | Works as written. New skill lands at the bottom of 13 built-ins (W2-10). |
| 354 | PASS | 2/3 | Valid file created at once; bad file shows the front matter error. The native file picker was bypassed by setting the hidden input. |
| 355 | BLOCKED | 4/4 | No outbound network. `http://` link gives the right message; an https link ends after about 6 s with "Could not reach the server" (W2-09). |
| 356 | PASS | 7/10 | Edit, switch off (picker drops it), Delete then Confirm delete all work. |
| 357 | SKIPPED | | Needs a model-driven skill draft; not attempted. |
| 358 | SKIPPED | | Needs an agent-proposed revision. |
| 359 | PASS | 4/4 | Switch off on Chief stays on for Finance agent; picker follows. |
| 360 | PASS | 2/2 | Remember works with no toast. A global Memory tab now lists it (the catalog says no list exists; see W2-07). |
| 361 | BLOCKED | | No memory provider, so "Memory scope" is absent with no hint (as the story predicts). |
| 362 | SKIPPED | | Needs a teaching session. |
| 363 | SKIPPED | | Long story; its parts are covered by 353, 356, 359, 360. |
| 364 | SKIPPED | | Network failure not simulated. |
| 365 | PASS | 3/2 | Tools tiles read as described; "Docs & files" chip filters. Letter placeholders instead of logos (W2-11). |
| 366 | BLOCKED | | Granola browser sign-in is real OAuth. Dialog seen: title plus "Sign in with Granola" only. |
| 367 | BLOCKED | | Wispr Flow sign-in is real OAuth. Dialog seen. |
| 368 | BLOCKED | | Success needs a real key. A fake key gives a clear error: "Could not connect to Devin. Check the API key and try again." |
| 369 | BLOCKED | | Needs a real Box app. Form seen (W2-16). |
| 370 | BLOCKED | | Zernio sign-in is real OAuth. |
| 371 | PASS with friction | 6/? | Saved with fake values; Test connection fails as expected. Friction in W2-06. |
| 372 | PARTIAL | | Photon form seen; BlueBubbles Test failure and saved-secret "Replace" seen. |
| 373 | BLOCKED | | Needs a non-owner member account. |
| 374 | PASS | 1/1 | Toast stack fans out on hover, shows Dismiss X, click opens the bot. |
| 375 | PASS | 2/2 | "Blocked in browser settings" appears, Phone and iMessage rows absent. |
| 376 | BLOCKED | | Cannot cause a slow Granola call or a failed scheduled run on this stack. Sidebar shows "Waiting for the model…" and "Waiting in line…". |
| 377 | PASS | 1/1 | Empty space pill shows three logos, all fallback "G" (W2-11). |
| 378 | PASS | 2/2 | Pill goes to Integrations; the sidebar row becomes plain "Integrations". |
| 379 | PASS | 1/1 | Plain row seen while the page is open. All-five-connected state not seeded. |
| 380 | PASS with deviation | 3/4 | Slack connected instantly in the emulator with no pending state; pill dropped Slack; a "Slack agent" was created automatically. |
| 381 | SKIPPED | | No network throttling or blocking done. |
| 382 | PASS | 1/1 | One logo per app; alias case is unit-test only. |
| 383 | BLOCKED | | A Mercury agent already exists, so Create agent cannot be walked. Page layout seen. |
| 384 | PASS (seeded) | | Seeded chat shows a read answer with no approval card; not re-asked. |
| 385 | PASS | 5/5 | Dialog, card, Deny, clear reply "No money moved". Card content is weak (W2-03). |
| 386 | PASS | 1/1 | Allow once, then "submitted and is pending approval. No money has moved yet." |
| 387 | PASS | 1/1 | Switch off with no dialog; on asks for confirmation. |
| 388 | PARTIAL | | The control is now "Share with all agents", not "Only this agent" (W2-05). Chief delegation not run. |
| 389 | SKIPPED | | Archiving the shared Mercury agent would change the demo for others. |
| 390 | PARTIAL | | Used by list seen, not toggled. |
| 391 | SKIPPED | | Notion agent already exists. |
| 392 | BLOCKED | | Notion writes cannot be tried. |
| 393 | SKIPPED | | |
| 394 | SKIPPED | | Needs Carta agent run and email. |
| 395 | SKIPPED | | |
| 396 | BLOCKED | | The Voice list has no Scripted provider (only ElevenLabs, OpenAI, Cartesia, Fish Audio); the stack is not running the scripted runtime. |
| 397 | BLOCKED | | Same. |
| 398 | BLOCKED | | Same. |
| 399 | BLOCKED | | Same. |
| 400 | PASS (case A) | 2/3 | "Call Elio" opens Settings, Voice; closing returns to the chat with no message (W2-13). Case B not run. |

Counts: PASS 24 (incl. variants), FAIL 1, PARTIAL 4, BLOCKED 16, SKIPPED 12 (some of the BLOCKED/SKIPPED are walkable with a different stack setup).

## Praise (observed)

- Settings: "Time zone updated" feedback is immediate; the zone list is searchable.
- Consent loop: switching AI data sharing off makes the Inbox "Let Praci sort your mail" card return; Allow flips the switch back on. One permission, shown consistently.
- Payment flow: Deny gives "No money moved"; Allow once gives "pending approval. No money has moved yet." Both replies are plain and exact.
- Toast stack: fan-out on hover, Dismiss X, click opens the right chat.
- Slash picker puts the new custom skill first and uses friendly names; the skill editor placeholder shows the front matter template.
- Empty-space Inbox: "No mail connected / Connect mail" is a clear next step.

## Findings

| ID | Sev | Cat | Story / page | What happened vs expected | Evidence | Suspected location | Proposed fix |
|---|---|---|---|---|---|---|---|
| W2-01 | P1 | bug | 351 | Observed: with account zone set to Los Angeles, "Create Routine" shows "Eastern Daylight Time" (the browser zone). Expected the account zone, as the Settings card implies. | `/tmp/uxloop1/W2/tz-after.png`, `routine-new.png` | `apps/web/src/pages/Shell.tsx:5526`, `:5624`, `:6131` (`localTimezone()` fallback) | Default new routines to the stored account zone and use the browser zone only when none is stored. |
| W2-02 | P2 | flow | 351 | Observed: an existing routine keeps its own zone (small grey label beside "When to run"); the editor gives no way to change it and nothing says the account zone does not apply. | `routine-edit.png` | `apps/web/src/pages/Shell.tsx:5526` | Make the zone label a control, or say "Runs in {zone}" with a change link. |
| W2-03 | P1 | bug | 385, 386 | Observed: the payment approval card reads "Review before Mercury: Request send money → 1200" with raw ids (`chk-1111`, `recipient_mock_acme`) and no currency symbol or recipient name. Approving money from this is risky. Expected "Send $1,200.00 to Acme (Mock) from Checking". | `merc-chat.png`, `merc-card2.png` | `packages/adapters/src/approval-ask.ts:72`, `executor.ts:3417` (`describeApprovalAction`) | Build the card summary from amount, currency and recipient name for MCP money tools, and keep the raw JSON behind a "Details" disclosure. |
| W2-04 | P1 | bug | 365 | Observed: searching "imessage" shows "No apps match." in the first grid cell next to the two iMessage tiles. | `imsg-list.png` | `apps/web/src/components/integrations/IntegrationsHome.tsx:697-700` (empty message ignores first-party Chat tiles) | Count first-party tile matches before showing "No apps match." |
| W2-05 | P1 | copy | 388 | Observed: the second switch reads "Share with all agents", is on by default, yet "Used by" shows only two agents switched on. No hint under it (the first switch has one). The catalog calls this "Only this agent" with a hint. | `merc-page.png`, `merc-share-off.png` | `apps/web/src/components/integrations/IntegrationAgentSection.tsx:90-98` | Rename to "Let other agents use Mercury directly" and add a one-line hint saying what off does. |
| W2-06 | P2 | flow | 371 | Observed: iMessage (BlueBubbles) "Test connection" is disabled until the first Save, with no reason shown. After Save the dialog says "Restart the Praci server to start using iMessage", which a hosted user cannot do. One Save returned only "Input validation failed" (not reproduced on resubmission; the contract requires a webhook token of at least 32 characters, never stated). Test failure text is "BlueBubbles /ping request failed". Fields have no helper text. | `imsg-bb.png`, `imsg-saved.png`, `imsg-saved2.png`, `imsg-test3.png` | `apps/web/src/components/integrations/IMessageSection.tsx:249-258`, `packages/contracts/src/messaging-setup.ts:16` | Enable Test when fields are filled (or explain "Save first"), name the failing field in errors, and drop the restart line for hosted deployments. |
| W2-07 | P2 | bug | 360 | Observed: Settings, Memory shows "Nothing remembered yet" as a row above real remembered items for Chief, and 20 per-agent groups that are all empty. Stored text shows internal paths such as "(/app/artifac…". | `mem3.png`, `tab-Memory.png` | `apps/web/src/pages/KnowledgeSection.tsx:259-262` | Skip documents with empty previews, hide empty groups, strip link paths from previews. |
| W2-08 | P2 | flow | 352 | Observed: with an export "Ready until Oct 27, 2026" only Download shows; no way to request a fresh export. Suspected: a failed export falls through to the "Request export" button with no error text. | `notif.png` | `apps/web/src/components/DataExport.tsx:75-92` | Add a secondary "Request new export" and show a failed state. |
| W2-09 | P2 | copy | 355 | Observed: "From URL" to an unreachable host ends after about 6 s with "Could not reach the server" (the Praci server is fine; the remote host is not). Save and Cancel only dim while waiting, no progress text. | `fromurl-err2.png` | `apps/web/src/pages/shell/BotSkillsSection.tsx` (import error path), fallback text in `apps/web/src/lib/user-error` | Say "Could not fetch that link" and show "Fetching…" on the button. |
| W2-10 | P2 | flow | 353 | Observed: a new skill is appended below 13 built-in skills inside a 288 px inner scroll area; no toast or highlight, so Maya must scroll to confirm it saved. Built-ins for unconnected apps (devin-sessions, box-files, meeting-notes) are listed. | `skill-list.png` | `apps/web/src/pages/shell/BotSkillsSection.tsx:407` | List custom skills first and scroll to or highlight the new row. |
| W2-11 | P2 | visual | 365, 377, 382 | Observed (demo has no logo CDN): most tiles use a letter placeholder; Gmail, Google Drive, Google Calendar, GitHub and Granola all show an identical "G", and the empty-space pill shows "G G G". Mercury, Blockscout and Coinbase show real logos, so the grid looks mixed. | `tools.png`, `slack4.png` | `apps/web/src/components/integrations/*` (AppLogo fallback) | Bundle logos for the featured apps, or fall back to a distinct colour per app. |
| W2-12 | P3 | visual | 365 | Observed: Finance and Social sections use two columns, Tools uses three then two, leaving a ragged right edge and about 350 px empty on the right. | `tools.png` | `IntegrationsHome.tsx` grid classes | Use one column count for all sections. |
| W2-13 | P2 | flow | 400 | Observed: "Call Elio" (a microphone icon, same as dictation) opens Settings, Voice with no explanation; no provider is selected yet an "API key" field shows; closing returns to the chat with no message. | `elio.png`, `elio-closed.png` | `apps/web/src/pages/Shell.tsx` (voice-settings open), Voice tab component | Show "Connect a voice provider to call Elio", preselect the first provider, and use a distinct call icon. |
| W2-14 | P2 | perf | 377 | Observed: switching into "Empty space" showed a completely black screen for at least 3 s with no skeleton (first screenshot blank, second 3 s later fine). A cold load of `/app/integrations` also took over 10 s once under load; warm load is about 2 s. | `empty-space2.png`, `merc-tile.png` | `apps/web/src/components/ShellSkeleton.tsx` | Keep the previous screen or a skeleton while the space loads. |
| W2-15 | P3 | copy | 385 | Observed: the Allow changes dialog says "change your Mercury data", not that money can move. | `merc-dialog.png` | `IntegrationAgentSection.tsx` (`WritesSwitch` dialog copy) | Name the effect: "move money and change accounts". |
| W2-16 | P3 | flow | 369 | Observed: Box dialog focuses the read-only Callback URL, not Client ID. Empty-field Save in iMessage gives the browser's default "Please fill out this field." bubble over the next label. | `form-box.png`, `imsg-save-empty.png` | Box connect dialog, `IMessageSection.tsx` form | Autofocus Client ID; use inline field errors. |
| W2-17 | P3 | copy | 359 | Observed: Settings lists skills by id (finance-cost-cutting) while the `/` picker shows "Cut costs". | `chief-panel` / `slash.png`, `skill-list.png` | `BotSkillsSection.tsx` | Show the same title in both places. |
| W2-18 | P3 | copy | 354 | Observed: error "SKILL.md must start with YAML frontmatter (--- ... ---)." is jargon for a founder. | `upload-bad.png` | server message surfaced in `BotSkillsSection.tsx` | "This file needs a name and description at the top." |
| W2-19 | P3 | visual | 352 | Observed: Time zone sits inside the "Language" card; AI data sharing shows one switch per model recipient (two) rather than the single switch the catalog describes; General is 11 cards long. | `sg2.png`, `sg3.png`, `set-general.png` | `apps/web/src/pages/AccountSettingsOverlay.tsx` | Give Time zone its own heading; group the rarely used cards under "Advanced". |
| W2-20 | P3 | copy | 375 | Observed: "Blocked in browser settings" gives no steps. | `notif.png` | `apps/web/src/components/NotificationSettings.tsx:80` | Add a short "Allow notifications for this site in your browser" line when blocked. |
| W2-21 | P3 | flow | 365 | Observed: the "Docs & files" chip hides the Connected section, so connected Google Drive and Notion disappear while filtering. | `chip-docs.png` | `IntegrationsHome.tsx` | Keep matching connected apps visible when a chip is active. |
| W2-22 | P3 | visual | 385 | Observed: after Deny, a tool line briefly read "Request send money 204m 3.1s" (duration includes the time the card sat waiting), which reads as a completed action. | `merc-deny.png` | chat tool-step duration | Hide duration for denied or waiting steps. |
| W2-23 | P3 | copy | demo data | Observed: Chief's seeded history says runway 8.9 months from $412,000, while Finance and the Finance agent say 24.2 months and $1,633,221 in cash. Mock-data only, but a demo viewer will notice. | `s0-home.png` | demo seed data | Align seeded chat figures with the Finance fixture. |
