# Walk W1: STORY-APP-301 to STORY-APP-350

Target: mock-data demo stack (web 5381). Viewport 1440x900. Session uxl1-W1 (fresh invented user, Maya Walker, non-owner) and uxl1-W1f (seeded demo founder, used for sidebar content). Screenshots: `/tmp/uxloop1/W1/` (outside the repo).

Important context: the demo has a deployment default model and the fresh user is not the deployment owner. After sign-up the app skipped "Connect a model" and "Connect your apps" and went straight to Chief (about 7 s, dev server). So the model and connect-apps stories could not be walked on this stack.

Evidence rules: "observed" = seen in a screenshot or measured in the browser. "suspected" = read from code only.

## Story verdicts

| Story | Verdict | Steps actual/ideal | Note |
|---|---|---|---|
| 301 ChatGPT sign-in | BLOCKED | - | Deployment has a default model, so `/onboarding` redirects to Chief; real provider OAuth anyway |
| 302 OpenRouter popup | BLOCKED | - | Same; real provider |
| 303 Paste callback URL | BLOCKED | - | Needs the ChatGPT card |
| 304 Cancel and switch provider | BLOCKED | - | Needs the sign-in card |
| 305 Pop-up blocked | BLOCKED | - | Needs the sign-in card |
| 306 API key | BLOCKED | - | Model step never shown (needsModel false) |
| 307 Default model skips step | PASS | 0/0 | Sign-up lands on Chief with greeting; "Opening your Space..." skeleton shown. Settings > Models shows "Deployment default - Configured by deployment" |
| 308 Add OpenRouter from Settings | BLOCKED | - | Models pane viewed (OpenRouter shown as Connected, "This space already uses OpenRouter"); no sign-in button to click. See W1-08 |
| 309 Long model journey | BLOCKED | - | Needs the model step |
| 310 OpenRouter denied | BLOCKED | - | Real provider |
| 311 Owner skips Connect your apps, tour | PARTIAL | tour 9 steps / ideal 3 | Not owner, so no apps step (BLOCKED). Tour walked: 1/9 to 9/9, Next x8, Done. See W1-02, W1-03 |
| 312 Connect Gmail in onboarding | BLOCKED | - | Real Google OAuth, and step not shown |
| 313 Search apps | BLOCKED | - | Step not shown |
| 314 Set up Slack | BLOCKED | - | Owner-only step |
| 315 Sign-in dialog failures | BLOCKED | - | Real OAuth |
| 316 Non-owner skips | PASS | 2/2 | Sign-up, then Chief with tour; no model or apps step |
| 317 Escape skips tour | PASS | 1/1 | Escape closed it; after reload the tour did not return |
| 318 Take the tour, hidden page | PASS | 3/3 | With Finance hidden the counter read 1/8; no explanation of the missing step (W1-04) |
| 319 First-day long journey | BLOCKED | - | Needs apps step and Gmail |
| 320 Collapse Pages | PASS | 1/1 | Chevron and "Expand Pages" name change correct |
| 321 Page options | PASS | 2/2 | Menu stays open after each toggle; reload kept hidden pages (but see W1-07) |
| 322 Hidden page still in search; Legal missing | FAIL | 4/4 | Cap table found when hidden (good). "legal" gives "No matches" in sidebar search and "No results" in Cmd+K (W1-01) |
| 323 Create folder inline | PASS | 3/3 | Type name, Enter. Menu also has "Rename space" for the personal space (catalog says none) |
| 324 Rename to duplicate name | FAIL | 3/3 | Rename to existing "Fundraising" silently reverted with no message (W1-12) |
| 325 Drag chats into folder | SKIPPED | - | Not run (time) |
| 326 Keyboard move | SKIPPED | - | Not run (time) |
| 327 Auto-group, then Undo | PARTIAL | 2/3 | Auto-group made Agents, Apps, Workspace, Groups folders. Undo button existed but I did not click it before it expired. Chief was filed into "Agents" (W1-14) |
| 328 Delete folder | PASS | 2/2 | No confirmation; chats returned to the unfiled list (order changed from before) |
| 329 Closed folder attention | SKIPPED | - | Not run |
| 330 Numbers and dots | PARTIAL | 3/3 | Hide amounts hides "24 mo" and masks $ in chat; Legal "1" and Data room "1" have no label or tooltip (W1-06) |
| 331 Full tidy-up | SKIPPED | - | Parts covered by 320, 321, 327, 328 |
| 332 Desktop first run | BLOCKED | - | Needs Electron and Docker |
| 333 Docker missing | BLOCKED | - | Needs Electron |
| 334 Local stack fails | BLOCKED | - | Needs Electron |
| 335 Join existing server | BLOCKED | - | Needs Electron |
| 336 One bot runs on Mac | BLOCKED | - | Needs desktop and Docker |
| 337 Bots run on default | BLOCKED | - | Needs desktop and Docker |
| 338 Browser lacks the controls | PASS | 1/1 | Settings > General has no "Bots run on" card (bot settings not opened) |
| 339 Teammate never sees it | SKIPPED | - | Not run |
| 340 Computers panel | BLOCKED | - | Needs host computers |
| 341 Hosted vs local compare | BLOCKED | - | Needs desktop |
| 342 Relaunch desktop | BLOCKED | - | Needs Electron |
| 343 Export my data | PASS | 2/2 | Request export, then about 10 s later "Ready until Oct 27, 2026" with Download. Download file not opened. See W1-11 |
| 344 Export link expiry | SKIPPED | - | Needs expiry |
| 345 Allow mail sort from Inbox | BLOCKED | - | Inbox shows "No mail connected" for a fresh user; needs Gmail |
| 346 Chat consent card | BLOCKED | - | Needs connected mail; chat message did not send in my attempt |
| 347 Decline consent | BLOCKED | - | Same |
| 348 Change time zone | PASS | 4/3 | Click picker, type "berlin", Enter; "Time zone updated" shown; "Berlin (UTC+2)". One extra step because the picker opens from a mouse click only (not in the accessibility snapshot as a combobox) |
| 349 Time zone follows browser | SKIPPED | - | Not run |
| 350 Schedule approval card | SKIPPED | - | Needs an agent run |

Counts: PASS 11 (307, 316, 317, 318, 320, 321, 323, 328, 338, 343, 348), PARTIAL 3 (311, 327, 330), FAIL 2 (322, 324), BLOCKED 22, SKIPPED 12. Total 50.

Checks run: geometry audit on the Chief landing screen (no page overflow; hits were the hover action bar and a time/name row, not defects). Console: no errors, only Vite and React DevTools info lines. Phone width (390x844) spot check of the Chief chat: no horizontal scroll, composer and header fit.

## Findings

| ID | Sev | Cat | Story / page | Observed vs suspected | What happened vs expected | Evidence | Suspected code | Proposed fix |
|---|---|---|---|---|---|---|---|---|
| W1-01 | P2 | bug | 322, sidebar search, Cmd+K | Observed (cause suspected) | Typing "legal" in sidebar search shows "No matches in chats, pages, documents or artifacts." and Cmd+K shows "No results", although Legal is a sidebar row. Expected the Legal page to be listed. | /tmp/uxloop1/W1/se2.png, cmdk.png | apps/web/src/pages/Shell.tsx:1949-1966 (`appPages` has no legal entry) | Add a Legal entry (id "legal") to `appPages`. |
| W1-02 | P2 | visual | 311, 316, first-run tour step 1 | Observed | The step 1 popover sits on top of option C ("Research & writing") of the "What do you want me on first?" card, hiding one of four choices while the tour is up. | /tmp/uxloop1/W1/s3.png | apps/web/src/components/tour/TourPopover.tsx (placement beside the anchor) | Place step 1 above or below the anchor, or collision-avoid the chat column. |
| W1-03 | P2 | copy | 311, 318, tour step 9 | Observed | Step 9 says "Settings, backups and Export my data are here". Settings has General, Models, Memory, Voice, Usage; no backups screen. Popover also covers the "Connect apps" pill. | /tmp/uxloop1/W1/tour9.png, set1.png | apps/web/src/components/tour/FirstRunTour.tsx:66 | Drop "backups" from the sentence. |
| W1-04 | P3 | flow | 318 | Observed | With Finance hidden the tour silently becomes 1/8 and skips Finance; nothing says a step was dropped. | /tmp/uxloop1/W1/t318.png | apps/web/src/components/tour/FirstRunTour.tsx (steps without an anchor are dropped) | Acceptable as is; optionally show hidden-page steps against the "Page options" button. |
| W1-05 | P3 | visual | 318, tour step 1 | Observed | With a long chat list the step 1 ring wraps the whole chat list down to the viewport bottom, including the "Connect apps" pill and part of the user row, and is cut off at the bottom edge. | /tmp/uxloop1/W1/t318.png | apps/web/src/components/tour/FirstRunTour.tsx / TourPopover.tsx (anchor is the full list container) | Anchor step 1 to the Chief row or the list header instead. |
| W1-06 | P2 | a11y | 330, sidebar page rows | Observed | Only Inbox has an accessible name for its number ("Inbox, 9 unread"). Legal "1" and Data room "1" have no aria-label or tooltip, so neither sighted nor screen reader users know what the number counts. | DOM check (aria-label null for Finance, Legal, Data room); /tmp/uxloop1/W1/fo2.png | apps/web/src/pages/Shell.tsx (page row value rendering; not located exactly) | Give Legal and Data room values a title and aria-label (for example "1 due soon", "1 waiting"). |
| W1-07 | P3 | perf | 321, any full load of /app/* | Observed | For about 1 s after load the sidebar shows all seven pages (including pages the user hid), no chats, and an "Integrations" row instead of the "Connect apps" pill; then it re-renders and the hidden rows vanish. | Timed DOM polling (cap=true, chief=false at t=0; cap=false, chief=true at t=+1 s); /tmp/uxloop1/W1/inb.png, m.png | apps/web/src/pages/Shell.tsx (hiddenPages default before account settings load) | Hold the Pages group (or render a skeleton) until hiddenPages has loaded. Dev server, so timing may be slower than production. |
| W1-08 | P2 | flow | 308, Settings > Models | Observed | While the catalog loads (first ~2-5 s) the provider list says "No providers found." next to "Loading model catalog...". Expected only the loading state. | /tmp/uxloop1/W1/mod.png vs mod2.png | apps/web/src/pages/ModelSettingsOverlay.tsx:1272-1292 (empty branch shown when list is empty, not when loaded) | Show the "No providers found." text only after the catalog has loaded. |
| W1-09 | P2 | visual | 343, 348, Settings > General | Observed | The Password card appears several seconds after the pane opens and pushes AI data sharing, Notifications and everything else down by about 340 px, while the user may already be reading or toggling. | /tmp/uxloop1/W1/exp1.png (no card) vs exp2.png (card inserted) | apps/web/src/pages/AccountSettingsOverlay.tsx (Password card conditional on an async value) | Reserve the space, or load the auth-method flag before rendering the pane. |
| W1-10 | P3 | visual | 348, Settings > General > Language | Observed (measured) | In the same card the Language select is 36 px high and the Time zone select is 32 px high (same width and radius). | DOM box check: English h=36, New York h=32; /tmp/uxloop1/W1/gen3.png | apps/web/src/pages/AccountSettingsOverlay.tsx:788 (`h-9`) and the time zone trigger near line 649 | Use the same control height for both. |
| W1-11 | P3 | flow | 343, Settings > General > Export | Observed | After "Request export" the button goes grey and disabled with no text for at least 3 s; "Preparing... N%" only shows once a job exists. Ready state about 10 s after the click is clear ("Ready until Oct 27, 2026", Download). | /tmp/uxloop1/W1/exp1.png | apps/web/src/components/DataExport.tsx:51-70 (`pending` has no status text) | Show "Preparing..." while `pending`. |
| W1-12 | P2 | flow | 324, folder rename | Observed | Renaming "fundraising" to "Fundraising" (already exists) shows the new name for a moment, then it reverts with no message. A user cannot tell it failed. | uxl1-W1 session; snapshot shows both names unchanged | Sidebar folder rename handler in apps/web/src/pages/Shell.tsx (rolls back silently) | Show an inline error ("A folder with that name exists") or keep the field open. |
| W1-13 | P3 | visual | 323, sidebar | Observed | Once one folder exists a "Chats" sub-heading appears in bold mixed case, while the space heading is small grey caps ("PERSONAL"). An empty folder shows count 0 and no hint what to do. | /tmp/uxloop1/W1/f2.png | apps/web/src/pages/Shell.tsx (folder and chat group headings) | Style the "Chats" label like the other group labels. |
| W1-14 | P2 | flow | 327, Auto-group | Observed | On the demo founder account Auto-group put Chief (the lead agent, not pinned) into an "Agents" folder with custom bots, so Chief left the top of the sidebar. Auto-group also left no way to see what moved other than reading folders. Expected the lead agent to stay first. | /tmp/uxloop1/W1/ag2.png, ag3.png, ag4.png | Auto-group logic in apps/web/src/pages/Shell.tsx (suspected: only pinned chats are excluded) | Never move Chief, or pin it by default. |
| W1-15 | P3 | visual | sidebar chat rows | Observed (from screenshot, not box-measured) | Bots with a letter avatar (Founder mail agent, Sales mail agent, Carta agent) use a rounded-square avatar and start the name about 4 px further right (x=72 vs 68), and the row is about 60 px high vs 50-56 for others. | /tmp/uxloop1/W1/fo2.png, ag5.png | apps/web/src/pages/Shell.tsx (row avatar for integration bots) | Use the same avatar box size and row height for all bots. |
| W1-16 | P3 | flow | landing on a crowded account | Observed | On first load for an account with 14 chats the sidebar list is scrolled about 340 px to show the selected chat, so Inbox, Finance and Legal are off screen. | /tmp/uxloop1/W1/fo1.png (scrollTop=340) | apps/web/src/pages/Shell.tsx (scroll-into-view of the active chat) | Keep the Pages group outside the scrolled region or scroll only when the active row is hidden. |

## Praise (observed)

- Sign-up to a working Chief chat took one form and no setup screens on this stack (STORY-APP-307, 316).
- Escape ends the tour and it stays gone after a reload (317). Step counter is clear.
- Page options toggles apply at once and are remembered; hidden pages stay reachable by search (321, 322).
- Hide amounts masks both the sidebar runway figure and money in chat previews and chat text, and it is reversible (330).
- Export my data finished in about 10 s with a clear ready state and expiry date (343).
- Time zone picker is searchable, saves on selection and confirms with "Time zone updated" (348).
- Empty Inbox for a new user ("No mail connected" with one "Connect mail" button) and Contacts empty state are short and clear.

## Notes for the catalog

- Personal space menu now includes "Rename space" (catalog 323 says it has none).
- User menu now includes "Task board".
- While testing I (the walker) deleted the Auto-group folders on the shared demo founder account; chat order in its sidebar differs from before. I also changed then restored Finance visibility and Hide amounts on that account.
- Test user walker-w1-a@northwind.example.test left in the demo (its space name picked up a stray character from an early mis-click; ignore).
