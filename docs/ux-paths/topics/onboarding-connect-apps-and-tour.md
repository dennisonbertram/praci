# Topic: Onboarding "Connect your apps" step and the first-run tour

Code read: `apps/web/src/pages/Onboarding.tsx` (step state, `nextStepAfterModel`, `createFirstBot`), `components/integrations/ConnectAppsStep.tsx`, `ConnectAppDialog.tsx`, `SignInStep.tsx`, `IntegrationSetup.tsx`, `components/tour/FirstRunTour.tsx`, `TourPopover.tsx`, `pages/Shell.tsx` (FirstRunTour mount and "Take the tour" menu item), `apps/api/src/router.ts` (`integrationSetup.get` -> `needsSetup`, `preferences.update` -> `tourSeenAt`, `me.tourSeen`).

Key facts from the code (used below):
- Order on `/onboarding`: model step ("Connect a model") -> "Connect your apps" -> the first bot is created automatically -> `/app/:botId`. The apps step shows only when `integrationSetup.needsSetup` is true. The API sets it only when the user can configure the server (`canConfigure`, the deployment owner) and no provider (Google, Composio, Pipedream) is configured yet. Non-owners and owners who already configured a provider never see it and go straight to the bot step. If the setup request fails, the page treats it as "no setup needed" (`.catch(() => null)`).
- The step title is "Connect your apps". A search box ("Search apps") sits above a list of six rows: Gmail, Google Calendar, Google Drive, Slack, Notion, GitHub. A row whose app exists in the catalog shows an outline "Connect" button (accessible name "Connect {app}"). A row whose app is not in the catalog shows "Set up" (accessible name "Set up {app}"), which opens "Other ways to connect" with the right provider preselected (Google for the three Google apps, Composio for Slack, Notion, GitHub). A connected row shows "Connected" in green text.
- Searching filters the six rows by name, then looks through the whole catalog (at most 8 rows). Nothing matches -> "No matching apps".
- "Other ways to connect" is a collapsed disclosure holding the server-wide provider setup: "Apps with their own server", "Popular apps through Composio", "Popular apps through Pipedream", "Google apps", "Your own tool server". Fields: "Client ID", "Project ID", "API key" or "Client secret", "Server URL".
- The footer shows "Skip for now" always. "Continue" appears only once something counts as connected: an app connected, a server added in this step, or a provider already configured. When "Continue" is shown, "Skip for now" turns into a quiet ghost button.
- Both buttons call the same `onDone`, which goes to the bot step. Servers added in this step are approved for the first bot after it is created.
- The "Connect {app}" dialog during onboarding: confirm -> "Sign in to {app} in the new window" -> "{app} connected". Because no bot exists yet, the "Which bots can use {app}?" step is skipped and the last screen says "No bot uses {app} yet. Choose bots on its page." with "Done". (Apps that get their own agent show no such line.)
- The tour is mounted in the sidebar (`Shell.tsx`). It opens when `me.tourSeen === false` and at least one bot exists, or after "Take the tour" in the user menu. Existing users were marked seen by migration `20261214000000_user_tour_seen`, so only new sign-ups get it automatically.
- Nine steps in order: chat ("Chat with Chief here. Agents ask before they send, pay or change anything."), create ("Create your own agent, group or space."), inbox, finance, legal, files, apps ("Connect the apps you already use."), search, account ("Settings, backups and Export my data are here, and so is Take the tour."). Buttons: "Skip tour" (hidden on the last step), "Back" (from step 2), "Next" (auto-focused), "Done" on the last step. A counter such as "3/9" shows. Escape skips (desktop width only).
- Steps whose anchor element is missing from the page are dropped, and the counter uses the remaining total. If no anchor exists at all, nothing is saved and the tour can run later. "Skip tour", Escape and "Done" call `preferences.update({ tourSeen: true })`; if that request fails the tour still closes locally, and is likely to return on the next load (UNVERIFIED in a real browser).
- Below 1024 px the sidebar is off screen, so the steps show as a "Tour" card fixed at the bottom of the screen, with no ring and no Escape handling in the card.
- Step 9 text mentions "backups", but the discovery notes say no backup UI exists. The same pointer to "Take the tour" appears in text and in the user menu.
- The same information appears on several surfaces: connecting apps is offered in the onboarding step, the sidebar "Connect apps" pill / "Integrations" row (also tour step 7), and the Integrations page; "Take the tour" is both the final tour sentence and a user-menu item.

---

## STORY-APP-311: Owner skips "Connect your apps" and lands in a tour
**Type**: medium
**Topic**: onboarding-connect-apps-and-tour
**Persona**: Maya, first-time founder of Northwind Robotics, who just installed Praci for herself (so she is the deployment owner) and wants to see her inbox first.
**Goal**: Get past setup quickly, then see what the product contains.
**Preconditions**: Fresh deployment, Maya signed up as the first user. She has just finished "Connect a model". No Google, Composio or Pipedream provider is configured, so `needsSetup` is true.
**Ideal path**: 3 — click "Skip for now", wait for the bot to be created, click "Skip tour" or step through with "Next".
**Alternate paths**: Connect one app first (STORY-APP-312). Navigate to `/app/integrations` later (the tour step 7 points there).
### Steps
1. Finish the model step → the page shows "Connect your apps", a "Search apps" box, six rows (Gmail, Google Calendar, Google Drive, Slack, Notion, GitHub) and a collapsed "Other ways to connect". Maya thinks: "I only wanted to try it. Do I have to do this now?"
2. Look at the footer → only "Skip for now" shows (no "Continue", since nothing is connected). She hesitates because the rows say "Connect" or "Set up" and she does not know what happens with her Gmail.
3. Click "Skip for now" → a skeleton shows while the first bot is created and a greeting thread starts; the browser goes to `/app/{botId}`.
4. Wait a moment on the chat page → a popover points at the bot list: "Chat with Chief here. Agents ask before they send, pay or change anything." with "1/9", "Skip tour", "Next".
5. Click "Next" eight times, reading each popover (create menu, Inbox, Finance, Legal, Data room, Connect apps, Search, user menu) → each popover and a ring move to the matching sidebar item. Step 7 reads "Connect the apps you already use." She notes this is the same offer she just skipped.
6. On the ninth popover click "Done" → the popover closes. "Skip tour" is not shown on the last step.
### Variations
- Maya clicks "Skip tour" on step 1 → the tour closes and is recorded as seen; she never sees steps 2-9.
- Maya clicks "Back" from step 4 → step 3 returns with the same text.
- Her browser is narrower than 1024 px → the same steps show as a card labeled "Tour" at the bottom of the screen with no ring on the sidebar.
### Edge Cases
- Maya closes the browser during step 3 → on reload the tour may start again because `tourSeen` was never saved (UNVERIFIED).
- She refreshes during the tour → the tour restarts from step 1 (the step index is only in memory).

---

## STORY-APP-312: Connect Gmail during onboarding, then continue
**Type**: medium
**Topic**: onboarding-connect-apps-and-tour
**Persona**: Maya, first-time founder of Northwind Robotics, with a Gmail account maya@northwind.example.test.
**Goal**: Connect Gmail before she meets the bot, so Inbox has mail on first visit.
**Preconditions**: As STORY-APP-311, and the catalog contains Gmail (a managed provider is available for the catalog; whether a fresh deployment has Gmail in `data.catalog` or shows "Set up" instead depends on the configured providers. UNVERIFIED).
**Ideal path**: 4 — "Connect Gmail", "Connect" in the dialog, sign in in the new window, "Done", then "Continue".
**Alternate paths**: Connect later from the sidebar "Connect apps" pill or the Integrations page (same dialog).
### Steps
1. On "Connect your apps" click "Connect" on the Gmail row (accessible name "Connect Gmail") → a dialog opens. When it opens from this list it starts the sign-in without a confirm screen (the confirm screen is only used when the caller asks for it; UNVERIFIED for this entry point).
2. Read the dialog → "Sign in to Gmail in the new window" with "Choose the account to connect, then come back here." and a "Step 1 of …" label. A window opens at Google. Maya hesitates: "Is the window a real Google page?" The dialog also offers "Didn't open?" with "Open again" and "Cancel".
3. Pick maya@northwind.example.test in the Google window and approve → the dialog changes to "Gmail connected". Because no bot exists yet, the "Which bots can use Gmail?" step is skipped. The line reads "No bot uses Gmail yet. Choose bots on its page."
4. Click "Done" → the dialog closes and the Gmail row now shows green "Connected" instead of a button.
5. Look at the footer → "Continue" now appears as the main button and "Skip for now" is a quiet ghost button. Both do the same thing.
6. Click "Continue" → the first bot is created and she lands on the chat. The tour opens (STORY-APP-311 steps).
### Variations
- Maya types "cal" into "Search apps" → the list narrows to Google Calendar; she clears the box and the six rows return.
- Maya connects Gmail, Google Calendar and Google Drive one after another; each row turns "Connected".
### Edge Cases
- She closes the Google window → the dialog still reads "Sign in to Gmail in the new window" with "If you closed the sign-in window, try again." and "Try again".
- Her browser blocks the pop-up → "Your browser blocked the sign-in window", "Gmail was not connected", "Allow pop-ups for this site, or open the sign-in page directly.", buttons "Cancel", "Open sign-in", "Try again".
- After "Done" the line says "No bot uses Gmail yet." Maya may wonder whether Gmail works. The code does not give access to the first bot automatically for managed apps (only servers added in "Other ways to connect" are approved for it). UNVERIFIED whether the first bot can read Gmail without a visit to the Integrations page.

---

## STORY-APP-313: Search for an app that is not in the popular list
**Type**: short
**Topic**: onboarding-connect-apps-and-tour
**Persona**: Maya, first-time founder of Northwind Robotics, who uses Linear for tasks.
**Goal**: Find whether Linear can be connected here.
**Preconditions**: On "Connect your apps"; the catalog is loaded.
**Ideal path**: 2 — type the name, click "Connect".
**Alternate paths**: "Other ways to connect" with "Apps with their own server" and a pasted server URL.
### Steps
1. Click "Search apps" and type "linear" → the six popular rows disappear; rows that match the whole catalog show (up to 8), each with a logo, a name and "Connect".
2. If Linear is listed, click "Connect" (accessible name "Connect Linear") → the same sign-in dialog opens.
3. If nothing matches → the list is replaced by "No matching apps". Maya thinks: "So I can't?" She has to notice the "Other ways to connect" line under it.
### Variations
- Search "g" → the popular rows containing "g" (Gmail, Google Calendar, Google Drive, GitHub) show first, followed by other catalog items, capped at eight rows.
- Search with only spaces → treated as empty; the six popular rows return.
### Edge Cases
- Catalog items matched by search all use the Composio route ("via: composio") when the catalog lacks them; the code never shows a "Set up" button for a search result (only the six popular rows do).
- "No matching apps" has no suggestion or link; the pointer to the server URL option is only the collapsed line below.

---

## STORY-APP-314: "Set up" on Slack opens the provider form
**Type**: medium
**Topic**: onboarding-connect-apps-and-tour
**Persona**: A solo technical founder (Priya Raman, Northwind Robotics) who installed Praci on her own server and is the deployment owner with no Composio key yet.
**Goal**: Make Slack connectable through one Composio API key.
**Preconditions**: Owner; no provider configured; the catalog does not contain Slack (so the Slack row shows "Set up").
**Ideal path**: 5 — "Set up", paste the API key, "Continue" in the provider form, then the footer "Continue".
**Alternate paths**: Open "Other ways to connect" by hand and choose "Popular apps through Composio".
### Steps
1. On the Slack row click "Set up" (accessible name "Set up Slack") → "Other ways to connect" expands and the form restarts with "Popular apps through Composio" selected. Priya thinks: "I did not ask to configure a server. I wanted to connect Slack."
2. Read the option list → five choices: "Apps with their own server", "Popular apps through Composio", "Popular apps through Pipedream", "Google apps", "Your own tool server", each with a sub-line, for example "Slack, Notion, GitHub and more, with one Composio API key".
3. Type a placeholder key in "API key" → the field accepts it.
4. Click the form's "Continue" → the button reads "Connecting…" while the key is saved, then the setup state reloads and the form shows green "Connected" for the provider; the catalog is refreshed through `data.refresh()`.
5. Scroll up and look at the Slack row → it should become a "Connect" button once the catalog contains Slack (UNVERIFIED; depends on the refresh result).
6. Click "Connect" on Slack and finish sign-in → "Slack connected", "Done".
7. Footer: click "Continue" → the first bot is created.
### Variations
- Choose "Google apps" for a Google row: fields "Client ID" and "Client secret" appear, and the page shows the redirect address to register (from the setup state `webUrl`).
- Choose "Apps with their own server": paste a "Server URL", click "Connect", approve in the OAuth window; the server is approved for the first bot after it is created.
### Edge Cases
- Wrong key → a red message "Could not connect" or the server's text shows under the form.
- The form's own "Skip" button does not exist in this embedded form; only the page's "Skip for now" and "Continue" exist.
- Selecting another option clears the typed key and client ID, so a key typed for Composio is lost if she clicks Pipedream by accident.

---

## STORY-APP-315: Step 1 failure paths in the app sign-in dialog
**Type**: medium
**Topic**: onboarding-connect-apps-and-tour
**Persona**: Maya, first-time founder of Northwind Robotics, on a laptop with strict pop-up blocking.
**Goal**: Recover when the sign-in window does not open or she cancels.
**Preconditions**: On "Connect your apps", Gmail row shows "Connect".
**Ideal path**: 3 — "Try again" or "Open sign-in" once pop-ups are allowed.
**Alternate paths**: "Cancel", then retry from the sidebar pill later.
### Steps
1. Click "Connect" on Gmail → the browser blocks the window; the dialog shows "Your browser blocked the sign-in window" and "Gmail was not connected".
2. Read "Allow pop-ups for this site, or open the sign-in page directly." → buttons "Cancel", "Open sign-in", "Try again". Maya hesitates: which one is safe?
3. Click "Open sign-in" → the Google page opens in a tab; she signs in and returns.
4. Back in the dialog → it should flip to "Gmail connected" through polling (the dialog checks every 2 seconds). UNVERIFIED how long it keeps polling before "Sign-in did not finish in time."
5. Click "Done" → row shows "Connected".
### Variations
- Click "Cancel" at step 2 → the dialog closes and the half-made connection row is revoked, so the row still reads "Connect".
- Google rejects the account → a message such as "Gmail did not accept the sign-in." with "Close" and "Try again".
### Edge Cases
- Leaving the dialog open until time-out → "Sign-in did not finish in time."
- On the desktop app the sign-in uses the system browser (`viaSystemBrowser`), so there is no pop-up block path (UNVERIFIED in this checkout).

---

## STORY-APP-316: Non-owner and already-configured installs skip the step
**Type**: short
**Topic**: onboarding-connect-apps-and-tour
**Persona**: Tomas Reyes, an invited teammate at Northwind Robotics (not the deployment owner).
**Goal**: Sign up and reach the product without being asked to configure a server.
**Preconditions**: The owner has set up the deployment. Tomas signs up with tomas@northwind.example.test.
**Ideal path**: 2 — finish the model step (if needed), then the bot appears.
**Alternate paths**: Owner with a configured provider (also skips the step).
### Steps
1. Sign up and reach `/onboarding` → depending on the deployment default model, either "Connect a model" shows or the page goes straight on. Tomas never sees "Connect your apps" because `needsSetup` is false for non-owners.
2. The first bot is created and he lands on `/app/{botId}` → the tour starts since his `tourSeen` is false and he has a bot.
3. Click "Next" until step 7 → the popover "Connect the apps you already use." points at the sidebar row (either the "Connect apps" pill or the plain "Integrations" row).
4. Click "Done" or "Skip tour" → closed.
### Variations
- The owner returns later after configuring a provider through Settings: a new owner onboarding would skip the apps step.
### Edge Cases
- If `integrationSetup.get` fails, the page treats it as "no setup needed" and silently skips the step; an owner who hit an error never learns they missed it.
- Tomas clicks the highlighted row at step 7 while the tour is open → the tour is not modal; the click navigates to Integrations while the popover stays open (UNVERIFIED how the popover behaves when its anchor re-renders).

---

## STORY-APP-317: Skip the tour with Escape and prove it stays gone
**Type**: short
**Topic**: onboarding-connect-apps-and-tour
**Persona**: Maya, first-time founder of Northwind Robotics, on a desktop browser (wider than 1024 px).
**Goal**: Dismiss the tour quickly and not see it again on another device.
**Preconditions**: New user with one bot, `tourSeen` false.
**Ideal path**: 1 — press Escape.
**Alternate paths**: Click "Skip tour".
### Steps
1. Land on `/app/{botId}` → the first popover "Chat with Chief here..." appears with a ring on the bot list.
2. Press Escape → the popover closes and `tourSeen` is saved on the server.
3. Reload the page → the tour does not return.
4. Open the app on a second browser or the desktop app and sign in → no tour (the flag is on the server, not in the browser).
### Variations
- "Skip tour" button at step 3 of 9 → same result.
- Press Escape on a phone-width layout → nothing happens in the bottom "Tour" card; she must tap "Skip tour". UNVERIFIED (the Escape handler is on the desktop popover only).
### Edge Cases
- The save request fails (offline) → the tour closes locally and `tourSeen` is set in memory only; after a reload it comes back.
- Maya presses Escape while a dialog is open on top → UNVERIFIED which layer receives it.

---

## STORY-APP-318: Run the tour again with "Take the tour" and a hidden page
**Type**: medium
**Topic**: onboarding-connect-apps-and-tour
**Persona**: Maya, first-time founder of Northwind Robotics, a week in. She hid Finance from the sidebar via Page options because she has no bank connected.
**Goal**: Replay the tour to remember where things are.
**Preconditions**: `tourSeen` is already true; Finance is hidden through "Page options".
**Ideal path**: 3 — open the user menu, click "Take the tour", press "Next" through the steps.
**Alternate paths**: none found (only the user menu starts it).
### Steps
1. Click her name at the bottom of the sidebar → the user menu opens with Settings, Hide amounts, "Take the tour", Usage, Log out.
2. Click "Take the tour" → the menu closes and the tour opens even though it was seen before.
3. Read the counter → it reads "1/8", not "1/9": the Finance step's anchor is missing, so the step is dropped.
4. Click "Next" three times → the popovers go chat, create, Inbox, then straight to Legal ("Legal and Cap table keep contracts and ownership in one place."). Maya may hesitate: "Where is the Finance step?" and notice nothing explains why it is missing.
5. Continue to the last popover, which sits above the user menu ("Settings, backups and Export my data are here, and so is Take the tour.") → she sees "Done", no "Skip tour".
6. Click "Done" → the tour closes. `tourSeen` is saved again (no visible change).
### Variations
- Hide more pages (Legal, Data room): each missing anchor removes one step.
- Un-hide Finance in "Page options" and replay → 9 steps again.
### Edge Cases
- Step 9 says "backups" but no backup screen exists in the app (see discovery); Maya may look for it in Settings and not find it.
- The tour runs while a chat panel is open; the ring may sit under the panel on narrow screens (UNVERIFIED).

---

## STORY-APP-319: Long first-day journey from model sign-in to using a connected app
**Type**: long
**Topic**: onboarding-connect-apps-and-tour
**Persona**: Maya, first-time founder of Northwind Robotics, deployment owner on the desktop app, with Gmail at maya@northwind.example.test and Slack for the team.
**Goal**: Go from a fresh install to one connected mail account, a seen tour, and a first question to Chief.
**Preconditions**: Fresh install, no provider configured, nothing connected. Model sign-in works (not covered here; see model-sign-in-first-run).
**Ideal path**: 12 — the shortest route that still connects Gmail and finishes the tour.
**Alternate paths**: Skip both onboarding and tour, then connect from the sidebar pill.
### Steps
1. Finish "Connect a model" and click its "Continue" → "Connect your apps" appears (owner, no provider). Maya thinks: "Another setup page? What does 'Set up' mean for Slack?"
2. Read the list → Gmail, Google Calendar and Google Drive show "Connect" or "Set up"; Slack, Notion, GitHub show "Set up" when the catalog lacks them.
3. Click "Connect" on Gmail → the sign-in dialog opens and the Google window follows.
4. Approve the account → the dialog shows "Gmail connected" and "No bot uses Gmail yet. Choose bots on its page."
5. Click "Done" → Gmail reads "Connected".
6. Open "Other ways to connect" to see the options → the disclosure expands to five choices; Maya reads them and closes it (she decides Slack can wait).
7. Click "Continue" → a skeleton shows while the first bot is created and the greeting thread starts.
8. Arrive on `/app/{botId}` → the thread greets her; the tour popover opens at the same time at the bot list.
9. Click "Next" to step 3 → "Inbox sorts your mail and drafts replies you approve." with the ring on the Inbox row. She thinks about the mail she just connected.
10. Click "Next" through Finance, Legal, Data room → three popovers; at the Data room she reads "Artifacts holds what agents make."
11. Click "Next" at step 7 → "Connect the apps you already use." points at the sidebar row. With Gmail connected, the Slack still missing means the "Connect apps" pill still shows (it only turns into the plain "Integrations" row when every featured app is connected).
12. Click "Next" at Search, then "Done" at the last popover → the tour ends and is recorded.
13. Click the Inbox row → the Inbox page opens; mail from Gmail should be loading. UNVERIFIED how long the first sync takes.
14. Return to the chat and ask Chief "What needs a reply from Northwind customers today?" → whether the first bot can read Gmail is UNVERIFIED because the access line said "No bot uses Gmail yet".
### Variations
- Connect Slack through "Set up" first (STORY-APP-314) before Gmail.
- Skip the apps step and use the sidebar pill later; compare the two dialogs (the same `ConnectAppDialog`, but with the "Which bots can use ...?" step once a bot exists).
### Edge Cases
- The same offer appears three times: the onboarding step, the tour step 7, and the pill. Each is a separate click path to the same dialog.
- A returning user who reloads during step 8 gets the tour again; one who finished step 12 does not.
