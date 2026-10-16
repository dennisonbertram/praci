# UX Path Catalog: Rakazo app shell (founder persona)

Generated: 2026-10-16
Repository: `rakazo-ux`, branch `docs/ux-pass` (tracks `origin/main`). All file:line references are to `apps/web/src/` unless another root is given.
Total Stories: 25 (13 short, 9 medium, 3 long)
Scope: sign-up and onboarding, sidebar and navigation, Chief and bot chats (composer, hover actions, replies, reactions, tables), command palette, notifications, Integrations (gaps only), Settings (account, model, keys, billing, usage), team/members, and moving between features.

## How this catalog relates to the earlier one

The earlier catalog (`ux-paths-today/catalog.md`, stories STORY-001 to STORY-066) already covers the Data room, mail approval card, Inbox rows, the @mention picker and most of the Integrations catalog flow (connect, reconnect, per-agent access, search chips, member view). This catalog does not repeat those. It points to them by their old id (for example "prior STORY-058") and adds only:

- Integrations: removing/disconnecting, custom MCP servers, the separate "Server integrations" setup page.
- Everything else in the shell, which the earlier catalog did not cover.

New ids use the prefix `APP-` so they cannot collide with the earlier `STORY-` ids.

## Persona (applies to every story)

Maya Chen, cofounder and CEO of "MOCK DEMO DATA — Northwind Robotics" (a 9-person warehouse-robotics startup). She has never seen Rakazo or its code. She does not know the words "bot", "space", "group", "MCP", "routine", "artifact", "provider" or "thinking". She wants one place to run the company: read email, know the cash position, keep the cap table and investor documents straight, and hand repeat work to someone (or something) reliable. Stories record what she would try in her own words and where she would likely hesitate. Hesitation points are marked **[Hesitation]**.

## Mock demo data required (shared seed)

Every story lists its own preconditions, but they all draw from this one seeded account. Every user-visible string in the seed must start with or contain `MOCK DEMO DATA` so a walker never mistakes it for real data.

| Seed item | Value |
|---|---|
| User | Maya Chen, `maya@northwind.example` (MOCK DEMO DATA), password set |
| Space | "MOCK DEMO DATA — Northwind Robotics" (default space) |
| Model | A working model already connected (so onboarding skips "Connect a model") except in APP-001 variant B |
| Bots | "Chief" (first bot, onboarding finished, focus "Day-to-day work"), "MOCK Finance helper" (title "Finance"), "MOCK Hiring helper" (title "Recruiting"), archived bot "MOCK Old intern bot" |
| Group | "MOCK DEMO DATA — Leadership" containing Chief and MOCK Finance helper |
| Section | Sidebar section "MOCK Ops" containing MOCK Hiring helper |
| Chief thread | 12+ messages, including one assistant reply with a Markdown table of 14+ rows ("MOCK DEMO DATA monthly burn by category"), one message with an existing 👍 reaction, one user message that is a reply to an earlier assistant message |
| Integrations | Gmail connected as `maya@northwind.example` (MOCK), Slack connected (MOCK workspace), one custom MCP server "MOCK DEMO DATA Docs MCP" at `https://mcp.mock-northwind.example/sse` |
| Inbox | 20 cached MOCK messages, 3 unread |
| Finance / Cap Table / Data room | At least one MOCK account balance, one MOCK cap table, 3 MOCK documents ("MOCK DEMO DATA — Seed SAFE.pdf", etc.) |
| Artifacts | 2 MOCK artifacts produced by Chief ("MOCK DEMO DATA — Q3 investor update draft") |
| Activity | 1 running run, 1 "Needs input" run, 4 finished runs |
| Billing | Billing enabled on the server, subscription in Trial (for APP-022); a second account with no subscription for APP-004 |

## Summary

| Type | Count |
|---|---|
| Short | 13 |
| Medium | 9 |
| Long | 3 |

## Coverage matrix

| Feature area | Stories | Gaps |
|---|---|---|
| Welcome, sign-up, sign-in, password reset | APP-001, APP-003 | SSO ("Continue with {name}") only as a variation; email-verification "Check your email" only as an edge case |
| Onboarding (model, server integrations, Chief focus card, connect cards) | APP-001, APP-002 | OAuth "subscription sign-in" model path only as a variation |
| Subscription gate / Paywall | APP-004 | None |
| Sidebar: page links, bot list, sections, archived, search, collapse | APP-005, APP-006, APP-007, APP-009, APP-010 | Sidebar density covered in APP-021 |
| Create bot / group / space | APP-010, APP-011 | Bot "Duplicate" and "Export" only as variations |
| Command palette | APP-008 | None (it only lists bots) |
| Chat composer (send, stop, attach, voice, skills, jump to latest) | APP-012, APP-015 | Voice dictation not walked end to end; Call card not covered |
| Message hover actions, reactions, replies | APP-013 | None |
| Chat tables | APP-014 | None |
| @mentions | APP-015 (group delegation); prior STORY-053..055 | None |
| Notifications and Activity | APP-016 | Desktop (Electron) notifications not covered |
| Integrations: catalog/connect/reconnect/agent access | prior STORY-056..066 | Not repeated here |
| Integrations: disconnect/remove, MCP servers, Server integrations | APP-017, APP-018, APP-019 | Local (command) MCP servers only as a variation |
| Settings: account, appearance, language, password | APP-021 | Messaging settings only linked, not walked |
| Settings: models and API keys | APP-020 | Model backups not covered |
| Settings: billing and usage | APP-022 | None |
| Team / members | APP-023 | Feature does not exist; story records the expected failure |
| Moving between features end to end | APP-024, APP-025 | Board (feature-flagged) not covered |

## Story dependency graph

```text
APP-001 (Sign up → first chat with Chief)
├── APP-002 (Focus card choices)
├── APP-005 (Orient in the sidebar)
│   ├── APP-006 (Artifacts vs Data room)
│   ├── APP-007 (Sidebar search)
│   ├── APP-008 (Command palette)
│   └── APP-009 (Hide/show sidebar, phone)
├── APP-010 (Create and organize a bot)
│   ├── APP-011 (Groups and spaces)
│   │   └── APP-015 (@mention a group)
│   └── APP-016 (Notifications and Activity)
├── APP-012 (Chat with Chief)
│   ├── APP-013 (React, reply, copy)
│   └── APP-014 (Tables)
├── APP-017 / APP-018 / APP-019 (Integrations gaps; after prior STORY-058)
├── APP-020 / APP-021 / APP-022 (Settings)
├── APP-023 (Invite a cofounder — not possible)
└── APP-024, APP-025 (long end-to-end; need the full seed)
APP-003 (Sign in again) and APP-004 (Paywall) need only an existing account.
```

## All stories

### Sign-up and onboarding

## APP-001: Maya signs up and gets to her first useful chat

**Type**: long
**Topic**: Sign-up and onboarding
**Persona**: Naive first-time founder (Maya Chen)
**Goal**: "Create an account and get something that helps me run Northwind."
**Preconditions**: No account for `maya.new@northwind.example` (MOCK). Variant A: the server already has a model configured and no server integrations need setup (`me.needsModel=false`, `integrations.needsSetup=false`). Variant B: no model configured. Variant C: Maya is the deployment owner and server integrations need setup. Composio (managed apps) configured so Chief's connect cards work.
**Ideal path**: 5 — Sign up → name/email/password → Create account → pick a focus → connect one app. A product for founders should not need model or server setup in the first minute.
**Alternate paths**: `/sign-in` → "Don’t have an account? Sign up" (`pages/Auth.tsx:296-300`); direct `/sign-up`. After sign-up the router forces `/onboarding` (`App.tsx:143`).

### Steps
1. Open `/`. Sees "Rakazo" and "Your team of always-on agents that you can give real work to." with "Sign up" and "Sign in" (`pages/Welcome.tsx:19-42`). → Thinks "agents?" but clicks Sign up. **[Hesitation]** Nothing says what the agents do for a company.
2. On "Create your Rakazo" (`pages/Auth.tsx:45`), fills Name "Maya Chen", Email "maya.new@northwind.example", Password. → Fields accept input; eye button toggles "Show password".
3. Clicks "Create account". → Redirects to `/onboarding`, shows "Loading…".
4. Variant B only: sees "Connect a model" with "Provider", "Server URL", "Find models", "Model", "Thinking", "Advanced" (`pages/Onboarding.tsx:563-760`). **[Hesitation]** Maya does not know what a provider or a model is, or which one to choose; she expects the product to come with one. She may pick the first provider and look for where to paste a key ("API key", "Optional").
5. Variant B: clicks "Continue" (`pages/Onboarding.tsx:1020`). → Saves, or shows "Could not save model".
6. Variant C only: sees "Server integrations" with options including "Direct MCP", fields "Client ID", "Project ID", "Client secret", "Redirect URI", "Get credentials", and "Skip" (`components/integrations/IntegrationSetup.tsx:49-406`). **[Hesitation]** Maya cannot tell if this is required. Expected: she clicks "Skip".
7. Sees "Opening chat…" (`pages/Onboarding.tsx:1046`). → Lands on `/app/<chiefId>`; a bot named "Chief" (`pages/Onboarding.tsx:60`) greets her: "Hi Maya, I'm Chief, and I'm a blank slate right now, so you get to decide what I become…" (`apps/api/src/onboarding.ts:108`).
8. Sees the card "What do you want me on first?" with A "Day-to-day work", B "Inbox & email", C "Research & writing", D "A bit of everything" (`pages/shell/message-cards.tsx:116-140`). **[Hesitation]** None says "run my company", "finance" or "investors". She picks A.
9. Chief replies "Got it. Slack, calendar, and email…" then shows connect cards for Slack, Gmail, Google Calendar (`apps/api/src/onboarding.ts:260-318`).
10. Clicks the Gmail card. → A sign-in popup opens (`rpc.connections.begin`, `message-cards.tsx:58`). Completes Google consent with the MOCK account. → Card shows "Connected".
11. Closes the Slack card's popup without finishing. → After the wait, "Authorization timed out. Please try again." (`message-cards.tsx:81`).
12. Types in the composer ("Message Chief"): "What should I look at first today?" and presses Enter. → Message appears; Chief streams a reply; "Stop" appears while it runs.
13. Looks at the sidebar: Inbox (with unread count), Finance, Cap Table, Data room, then Chief in the bot list, then Integrations and her name at the bottom. → She now knows where the main areas are.

### Variations
- SSO configured: "Continue with {name}" button replaces/augments the email form (`pages/Auth.tsx:186,292`).
- Email verification required: "Check your email" title after Create account (`pages/Auth.tsx:41,110`); she must click the link before step 4.
- Variant B with a ChatGPT subscription provider: OAuth sign-in with a code to paste back ("Authorization code or callback URL", "Submit", `pages/Onboarding.tsx:819-828`).

### Edge cases
- Bot creation fails: "Could not create your bot" and "Try again" (`pages/Onboarding.tsx:546,1041`).
- Two tabs open onboarding: a Web Lock plus a spawn key keep only one Chief (`pages/Onboarding.tsx:106-115`).
- Already signed in and visiting `/sign-up`: redirected straight to `/onboarding` (`App.tsx:143`).

## APP-002: Maya looks for a "run my company" option on the focus card

**Type**: short
**Topic**: Sign-up and onboarding
**Persona**: Naive first-time founder
**Goal**: "Tell the assistant I want help with finance, the cap table and investor docs."
**Preconditions**: Fresh Chief thread with the unanswered focus card (onboarding started, not chosen). MOCK space "MOCK DEMO DATA — Northwind Robotics".
**Ideal path**: 2 — read the choices, pick "Company operations" (or type it). The real UI has no such choice.
**Alternate paths**: Dismiss the card (`rpc.onboarding.dismissFocus`, `message-cards.tsx:46`) and type a free-text request instead.

### Steps
1. Reads A–D on "What do you want me on first?". → None mentions finance, cap table or investors, though the sidebar shows Finance, Cap Table and Data room. **[Hesitation]**
2. Picks D "A bit of everything". → Chief offers Slack, calendar and email, the same apps as A (`apps/api/src/onboarding.ts:56-62` vs `:35-40`). Maya may think her choice was ignored.
3. Alternative: dismisses the card and types "Help me keep the cap table and investor updates straight". → Card disappears; normal chat reply.

### Variations
- She picks C "Research & writing": Chief suggests Hacker News, Notion, Google Docs. Hacker News looks odd for a company operator.

### Edge cases
- Choosing fails: "Could not save this choice" (`message-cards.tsx:37`); dismiss fails: "Could not dismiss".

## APP-003: Maya signs in on a new laptop and forgets her password

**Type**: short
**Topic**: Sign-up and onboarding
**Persona**: Returning founder
**Goal**: "Get back into my account."
**Preconditions**: Maya's MOCK account exists; password reset configured on the server.
**Ideal path**: 4 — Sign in → Forgot password? → email → set new password.
**Alternate paths**: `/forgot-password` directly. From Settings, "Change password" only when already signed in (APP-021).

### Steps
1. `/sign-in`: "Sign in to Rakazo", Email, Password, "Continue with email" (`pages/Auth.tsx:43,276`). Wrong password → error text from `authErrorText`.
2. Clicks "Forgot password?" (`pages/Auth.tsx:261`). → "Reset your password", "Send reset link".
3. Opens the reset email link → "Choose a new password", "New password", "Confirm password", "Reset password" (`pages/Auth.tsx:360-396`).
4. → "Password updated" and "Sign in". Signs in → lands on `/app` (or the `next` destination).

### Variations
- Reset not configured: "Password recovery is not configured for this server" (`pages/Auth.tsx:83`); the "Forgot password?" link is hidden when `passwordReset` is false (`:258`).

### Edge cases
- Expired link: "This reset link is invalid or expired" (`pages/Auth.tsx:332`).
- Server unreachable: "Could not reach the server". A signed-in user whose session lookup fails sees a retry screen, not sign-in (`App.tsx:114,201-210`).

## APP-004: A founder without a subscription hits the paywall

**Type**: short
**Topic**: Sign-up and onboarding
**Persona**: Naive first-time founder
**Goal**: "Start using it."
**Preconditions**: Billing enabled; MOCK account "MOCK DEMO DATA — Paywall tester" with no subscription.
**Ideal path**: 2 — Start trial → back in the app.
**Alternate paths**: "Manage billing" on the paywall; Settings → Billing → "Manage" after a subscription exists (APP-022).

### Steps
1. Signs in. → Any `/app` route or `/onboarding` is wrapped by `SubscriptionGate` (`App.tsx:167-176`) and shows the Paywall: "Subscription required", bullets "Bots with their own computer and browser", "Routines that run while you're away", "Any model, with your own key", "Web, desktop and mobile apps" (`pages/Paywall.tsx:39-47`). **[Hesitation]** "Any model, with your own key" suggests she must also bring a key.
2. Clicks "Start {n}-day free trial" (`pages/Paywall.tsx:76`). → Opens billing checkout.
3. Returns. → Onboarding or app loads.

### Variations
- No trial configured: button reads "Subscribe".
- "Log out" on the paywall (`:105`).

### Edge cases
- Checkout cannot open: "Could not open billing" (`:30`).

### Sidebar and navigation

## APP-005: Maya orients herself in the sidebar

**Type**: medium
**Topic**: Navigation
**Persona**: Naive first-time founder
**Goal**: "Figure out where email, money, equity and documents live, and what everything else is."
**Preconditions**: Full shared seed (Chief, two MOCK helpers, Leadership group, MOCK Ops section, archived bot, 3 unread mails).
**Ideal path**: 1 — one glance at a labeled sidebar.
**Alternate paths**: Command palette lists bots only (APP-008). Artifacts, Settings and Usage are only in the user menu.

### Steps
1. Reads the top row: a bell, a panel icon, and "+" (`pages/Shell.tsx:3203-3240`). Hovers the bell → tooltip "Activity". **[Hesitation]** She expects a bell to mean notifications (see APP-016).
2. Reads the "Search" box, then Inbox (badge "3"), Finance, Cap Table, Data room (`pages/Shell.tsx:3286-3350`). → Clicks each; the main area changes; the link is highlighted.
3. Below: bot list with "MOCK DEMO DATA — Leadership" group, "MOCK Ops" section, Chief and helpers. → Clicks Chief; chat opens at `/app/<id>`.
4. At the bottom: "Integrations", then her initials and "Maya Chen" (`pages/Shell.tsx:3836-3866`).
5. Clicks her name → menu: "Artifacts", "Settings", "Usage", "Log out" ("Board" only if the flag is on) (`pages/Shell.tsx:3870-3932`). **[Hesitation]** "Artifacts" is not near Data room even though both are documents, and both use the same folder icon (`:3344`, `:3894`).
6. Scrolls to "Archived" → sees "MOCK Old intern bot" with "Restore" and "Delete" (`pages/Shell.tsx:3760-3796`).

### Variations
- Feature-flagged Board appears in the user menu, not the sidebar.
- Same information on several surfaces: bot name/title/preview appears in the sidebar row, the command palette row and the chat header.

### Edge cases
- No bots in the space: main area shows only "Create new Bot" (`pages/Shell.tsx:4137-4143`).

## APP-006: Maya looks for the investor update Chief made last week

**Type**: short
**Topic**: Navigation
**Persona**: Naive first-time founder
**Goal**: "Find the document Chief wrote for me."
**Preconditions**: Artifact "MOCK DEMO DATA — Q3 investor update draft" exists; Data room holds 3 MOCK documents but not that artifact.
**Ideal path**: 2 — open a documents area → click the file.
**Alternate paths**: Data room (sidebar), Artifacts (user menu, `/app/artifacts`), scroll Chief's thread to the artifact card, sidebar Search for "investor update" (APP-007).

### Steps
1. Clicks "Data room" (it says documents). → Sees the 3 MOCK docs, not the update. **[Hesitation]**
2. Searches there for "investor". → No match.
3. Opens the user menu, notices "Artifacts", clicks it. → `/app/artifacts` lists the draft.
4. Opens it at `/app/artifacts/<id>`.

### Edge cases
- `/app/artifacts` is a separate page (`App.tsx:187`), not `ShellPage`, so the sidebar may not look the same; note whether a way back to Chief is obvious.

## APP-007: Maya searches the whole space for "SAFE"

**Type**: short
**Topic**: Navigation
**Persona**: Naive first-time founder
**Goal**: "Find where we talked about the SAFE."
**Preconditions**: A Chief message containing "MOCK DEMO DATA SAFE discount 20%".
**Ideal path**: 2 — type, click result.
**Alternate paths**: Command palette "Search" (bots only, APP-008); Inbox "Search mail"; Data room search.

### Steps
1. Types "SAFE" into the sidebar "Search". → Bot list is replaced by results; "Searching…", then hits or "No results" (`pages/SpaceSearch.tsx:16-23`; triggers on any non-empty text, `pages/Shell.tsx:1769-1770`).
2. Clicks the hit. → Jumps to the message in its thread (`jumpToSearchHit`).
3. Clears the box. → Bot list returns.

### Edge cases
- Four boxes are all labeled "Search" (sidebar, command palette, bot picker in "+", Inbox uses "Search mail") and search different things. **[Hesitation]**

## APP-008: Maya tries Cmd+K to "go to" Finance

**Type**: short
**Topic**: Command palette
**Persona**: Founder who uses Linear/Notion and tries Cmd+K out of habit
**Goal**: "Jump to Finance, or to the Finance helper, from the keyboard."
**Preconditions**: Chief, MOCK Finance helper, MOCK Hiring helper exist.
**Ideal path**: 2 — Cmd+K, type "fin", Enter.
**Alternate paths**: Sidebar Finance link; sidebar bot row; Cmd+1..9 while the palette is open.

### Steps
1. Presses Cmd+K (Ctrl+K elsewhere) (`pages/shell/command-palette-hotkey.ts`, listener `pages/Shell.tsx:2846-2851`). → Dialog with "Search", bot rows with avatar, title badge, subtitle, and shortcut "⌘1"… (`pages/shell/command-palette.tsx:87-155`). Nothing on screen told her this shortcut exists. **[Hesitation]**
2. Types "finance". → Only "MOCK Finance helper" (matches title). The Finance page is not offered.
3. Presses Enter. → Opens that bot's chat.
4. Opens again, presses Cmd+2 → opens the second bot in the list.

### Variations
- Types "cap table" or "settings": "No bots" (`command-palette.tsx:107`).

### Edge cases
- Pressing Cmd+K inside the email composer is handled by the rich text editor, which says the app palette "listens higher up" (`components/compose/RichTextEditor.tsx:70-72`); check which one wins.

## APP-009: Maya hides the sidebar, then uses Rakazo on her phone

**Type**: short
**Topic**: Navigation
**Persona**: Founder between meetings
**Goal**: "More room for the chat; then check Chief from my phone."
**Preconditions**: Shared seed.
**Ideal path**: 2 per surface.
**Alternate paths**: "Minimize bots" button (`pages/Shell.tsx:3226-3235`); sidebar edge button "Hide bots"/"Show bots" (`:3940-3950`); header "Show bots" (`:4022`).

### Steps
1. Clicks the panel icon ("Minimize bots"). → Sidebar collapses (saved as a preference).
2. Finds "Show bots" in the chat header to bring it back. **[Hesitation]** Labels say "bots" although the sidebar also holds Inbox, Finance, Integrations and her account.
3. At 390px width: sees "Open navigation" (`:4012`); opens the drawer; taps Inbox → drawer closes. Taps the dark area ("Close navigation", `:3184`) or swipes to close.

## APP-010: Maya adds a "Hiring helper" and keeps the sidebar tidy

**Type**: medium
**Topic**: Navigation / bots
**Persona**: Naive first-time founder
**Goal**: "Create a separate assistant for recruiting, name it, and put it under Ops."
**Preconditions**: Shared seed without MOCK Hiring helper; section "MOCK Ops" exists.
**Ideal path**: 3 — New assistant → type name → Save.
**Alternate paths**: "+" → "Create new Bot" (`pages/shell/bot-picker.tsx:74`); empty-state "Create new Bot" (`pages/Shell.tsx:4141`); "Duplicate" from a bot's actions menu (`pages/BotContextMenu.tsx:135`).

### Steps
1. Clicks "+". → Picker with "To:", "Search", "Create new Bot", "Create new Group", "Create new Space" plus info buttons (`bot-picker.tsx:50-134`). **[Hesitation]** "To:" reads like an email field.
2. Clicks "Create new Bot". → A bot named "New Bot" is created at once and opened, with no naming step (`pages/Shell.tsx:2636-2649`).
3. Wants to rename it; clicks the bot name in the chat header (`data-testid="bot-settings-trigger"`, `:4034`). → Right panel "Settings" with Name, Title, Description, Notifications, Computer (Team/Private), Advanced (Model, Thinking, Memory scope, Read replies aloud, Voice, Disabled tools), "Save", "Export", "Clear conversation" (`pages/shell/bot-panel.tsx:60-635`). **[Hesitation]** Clicking a name to reach settings is not obvious.
4. Types Name "MOCK Hiring helper", Title "Recruiting". → Description saves on blur; she looks for and clicks "Save".
5. Right-clicks / opens "Actions for MOCK Hiring helper" in the sidebar → Pin, Move to (Unassigned, MOCK Ops, New section, Rename section), Mark as Read/Unread, Edit Profile, Duplicate, Clear conversation, Archive, Delete (`pages/BotContextMenu.tsx:84-148`).
6. Move to → "MOCK Ops". → Row moves under that section.
7. Archive "MOCK Old intern bot", then "Restore" it from "Archived".
8. Delete a test bot → "Delete {name}?" and "What about its memories?" with "Keep memories" / "Delete memories too" (`pages/shell/dialogs.tsx:415-478`).

### Variations
- "Edit Profile" in the menu and the header-name click open the same settings (duplicate path).

### Edge cases
- Create fails: "Failed to create bot" appears as a send error in the composer area (`pages/Shell.tsx:2652`), far from the "+" she clicked.

## APP-011: Maya sets up a "Leadership" group and wonders what a space is

**Type**: medium
**Topic**: Navigation / groups and spaces
**Persona**: Naive first-time founder
**Goal**: "Have Chief and the Finance helper work on the board deck together."
**Preconditions**: Chief and MOCK Finance helper exist; no Leadership group yet.
**Ideal path**: 4 — New group → name → pick 2 assistants → Create.
**Alternate paths**: none found for groups; spaces also via "Actions for space" (Rename space / Delete space, `pages/Shell.tsx:4734-4760`).

### Steps
1. "+" → info button "About groups" → "Shared chat with 2-6 bots. They all reply in the same thread." (`pages/shell/dialogs.tsx:200-204`).
2. "About spaces" → "Private workspace with its own bots and groups." **[Hesitation]** She wonders if Northwind should be a space and whether her cofounder could join it (it cannot; APP-023).
3. "Create new Group" → right panel "New group", Name "MOCK DEMO DATA — Leadership", picks members, "Create group" (`pages/GroupPanel.tsx:103-146`). → Opens `/app/g/<id>`.
4. Sends "Draft three bullet points on Q3 burn". → Both bots reply in one thread.
5. Group header → "Group settings" → rename, "Delete group" (`GroupPanel.tsx:228-278`).
6. "Create new Space" → "New space", Name "MOCK DEMO DATA — Side project", "Create space" (`dialogs.tsx:69-92`). → Sidebar shows space names before group titles (`pages/shell/space-sidebar.ts:69-73`).

### Edge cases
- One bot selected: group needs 2–6 bots; check the message shown.

### Chief and bot chats

## APP-012: Maya asks Chief for this week's priorities with a file attached

**Type**: medium
**Topic**: Chat composer
**Persona**: Naive first-time founder
**Goal**: "Give Chief our board memo and get a short priority list back."
**Preconditions**: Chief exists with model working; local file "MOCK DEMO DATA — board memo.pdf" (<10 MB).
**Ideal path**: 3 — attach, type, send.
**Alternate paths**: Drag the file onto the window (global `DataRoomDropZone`, `App.tsx:172`, may file it into the Data room instead); "Attach file" button (`pages/Shell.tsx:6569`).

### Steps
1. Clicks "Attach file", picks the PDF. → Chip with "Remove {name}" (`:6452`).
2. Types "What are my top 3 priorities this week based on this?" in "Message Chief" (`:6705-6712`). Shift+Enter makes a new line; Enter sends.
3. → Bot status shows running; "Stop" replaces "Send" (`:6749-6770`).
4. Scrolls up while it streams. → "Jump to latest" appears (`:5784`); clicks it.
5. Clicks "Stop" on a second long answer. → Reply stops.
6. Clicks the microphone ("Voice", `:6736`) and dictates a follow-up.

### Variations
- Too many attachments: limit check at `pages/Shell.tsx:2231`.
- Drag-and-drop onto the chat vs onto the page: two drop targets may compete. **[Hesitation]**

### Edge cases
- Send fails: error banner with "Dismiss error" (`:6398`); draft kept until accepted.

## APP-013: Maya reacts to, replies to, and copies one of Chief's answers

**Type**: short
**Topic**: Message hover actions
**Persona**: Naive first-time founder
**Goal**: "Thumbs-up the good answer, ask a follow-up on that exact point, and paste it into Slack."
**Preconditions**: Chief thread with at least 3 assistant messages; one already has 👍.
**Ideal path**: 3 — hover → react; hover → reply; hover → copy.
**Alternate paths**: "Reply" is both a hover icon and an item in "More" (`pages/Shell.tsx:6947-6978`).

### Steps
1. Hovers an assistant message. → "React", "Reply", "More" icons appear (`:6914-6965`), with time metadata.
2. "React" → 👍 👎 ❤️ 😂 🎉 😮 (`packages/contracts/src/reactions.ts:3`). Picks 🎉. → Reaction shows under the message.
3. "Reply" → composer shows the quoted message; screen reader hears "Replying to Chief" (`:6368`). Sends "Expand on point 2". → Sent message links back to the original.
4. "More" → "Copy". → Text is copied, but no toast or check mark confirms it (`:6897-6901`). **[Hesitation]** Maya clicks again to be sure.

### Edge cases
- Progress bubbles while streaming show no hover actions (`:6895`).
- Touch: buttons are 44px on touch, 28px with a fine pointer.

## APP-014: Maya works with a burn table Chief produced

**Type**: short
**Topic**: Chat tables
**Persona**: Naive first-time founder
**Goal**: "Sort by amount and get it into a spreadsheet."
**Preconditions**: Chief message with a Markdown table of 14+ rows "MOCK DEMO DATA monthly burn by category" (columns Category, Amount, Change).
**Ideal path**: 2 — click column header; Download CSV.
**Alternate paths**: "Copy rows" (TSV, paste into Sheets) vs "Download CSV"; "More" → "Copy" copies the whole message instead.

### Steps
1. Clicks the "Amount" header. → Sorted; clicking again reverses (`packages/chat-ui/src/markdown-table.tsx:127`).
2. Sees "1–10 of 14 rows" and "Previous page"/"Next page" (`:186-203`).
3. "Expand table" (`:245`) → all rows.
4. "Copy rows" → icon turns to a check ("Copied", `:227`). Pastes into a spreadsheet.
5. "Download CSV" → file is always named `table.csv` (`:160`). **[Hesitation]** Two downloads overwrite or become "table (1).csv".

### Edge cases
- Non-English UI: these table labels are hard-coded English (`markdown-table.tsx:186-245`).

## APP-015: Maya hands work to the Leadership group with @

**Type**: short
**Topic**: Chat / mentions
**Persona**: Naive first-time founder
**Goal**: "From Chief's chat, ask the Leadership group to review the deck."
**Preconditions**: Leadership group exists; Chief chat open. (Mention picker mechanics are in prior STORY-053..055.)
**Ideal path**: 3 — type @Lead, pick, send.
**Alternate paths**: Open the group from the sidebar and type there.

### Steps
1. Types "@Lead". → Picker lists the group (`aria-label="Mentions"`, `pages/Shell.tsx:6469`).
2. Picks it and types "please review the deck". Sends. → Message is rerouted to the group thread (`plan.rerouteGroupId`, `:2275-2279`); Chief's chat no longer shows it.
3. If she was replying to a Chief message, the reply link is dropped on reroute (`:2346-2347`). **[Hesitation]** "Where did my message go?"

### Notifications and Activity

## APP-016: Maya wants to know when Chief is done or needs her

**Type**: short
**Topic**: Notifications
**Persona**: Naive first-time founder
**Goal**: "Ping me when the long task finishes, and show me what needs me."
**Preconditions**: Chief with `notifyOnFinish` on (default for new bots, `pages/Shell.tsx:2643`); browser notification permission "default"; Activity seed: 1 running, 1 "Needs input", 4 done.
**Ideal path**: 2 — allow notifications once; click a notification to open the chat.
**Alternate paths**: Per-bot "Notifications" switch in bot Settings (`pages/shell/bot-panel.tsx:410-425`); sidebar bell "Activity" (`pages/Shell.tsx:3205`). No app-wide notifications setting found.

### Steps
1. Sends a long request. → The browser permission prompt appears only now, on the first send to a bot with notifications on (`pages/Shell.tsx:2280-2285`). **[Hesitation]** The prompt arrives with no explanation.
2. Allows; switches tabs. → When Chief finishes or needs input, a browser notification appears (`lib/browser-notifications.ts`).
3. Clicks the bell. → Sidebar switches to Activity: "Now" and "Recent" runs, "Search runs", "Status", "From", "To", "Reset all"; statuses Queued, Running, Needs input, Done, Failed (`pages/ActivityList.tsx:133-411`). It stays on after reload (`lib/activity-mode.ts`). **[Hesitation]** She expected a notification list, and her bot list is gone until she clicks the bell again.
4. Opens Chief's Settings and turns "Notifications" off for a chatty bot.

### Edge cases
- Permission denied once: no in-app way to re-ask; she must change browser settings.

### Integrations (gaps only; see prior STORY-056..066)

## APP-017: Maya disconnects her old Gmail and removes one Slack account

**Type**: medium
**Topic**: Integrations — remove/disconnect
**Persona**: Naive first-time founder
**Goal**: "Stop the assistants reading my old inbox."
**Preconditions**: Gmail connected with two MOCK accounts (`maya@` and `old-maya@northwind.example`); Slack with one MOCK workspace; Chief and Finance helper use Gmail.
**Ideal path**: 3 — open Gmail → Remove the old account → confirm.
**Alternate paths**: "Remove" on a row in Integrations home (`components/integrations/IntegrationsHome.tsx:215-218`); "Remove" on an account row in AppDetail (`AppDetail.tsx:111`); "Disconnect {name}" for the whole app (`AppDetail.tsx:344`).

### Steps
1. Sidebar "Integrations" → "Connected" list → clicks Gmail. → Detail: accounts, "Add another account", "Used by", "Tools · n" grouped Read/Write ("Never changes your account" / "Changes your account").
2. On `old-maya@`, clicks "Remove". → "Remove old-maya@…?", "Agents lose access to this account.", "Mail data from this account that Rakazo cached is removed.", "Your data in Gmail is not deleted." (`AppDetail.tsx:368-382`). Confirms.
3. Sees "Disconnect Gmail" with "Removes all 2 accounts and agent access." (`:344-350`). **[Hesitation]** Remove vs Disconnect: which one leaves the other account?
4. Back on Integrations, Slack → "Disconnect Slack" → "Every agent loses access to Slack." Confirms.
5. Inbox page later shows the connect empty state (`AppDetail.tsx:402` warns of this).

### Edge cases
- Failure: "Could not disconnect" / "Could not remove connector".

## APP-018: Maya adds the docs MCP server her engineer sent her

**Type**: medium
**Topic**: Integrations — custom MCP
**Persona**: Naive founder forwarding an engineer's instructions ("add this URL")
**Goal**: "Let Chief read our internal docs server."
**Preconditions**: URL `https://mcp.mock-northwind.example/sse` (MOCK, reachable stub with bearer auth); Chief and Finance helper exist.
**Ideal path**: 4 — Add custom connection → paste URL → token → choose agents.
**Alternate paths**: Integrations "Anything else" → "Add custom connection" (`IntegrationsHome.tsx:607-620`); Settings → "Server integrations" (owner, `/integrations/setup`, "Add server URL", "Search integrations.sh") (APP-019); onboarding server-integrations step.

### Steps
1. Scrolls Integrations to "Anything else": "Connect any app that offers an MCP server URL." **[Hesitation]** "MCP" is unexplained.
2. "Add custom connection" → dialog titled "Add a custom connection": "Display name", "URL", "Authentication" (No authentication / Bearer token / API key header) (`CustomConnectionDialog.tsx:350-377`).
3. Pastes the URL, picks "Bearer token", pastes the MOCK token. → Next step asks which agents may use it (agent access, "Could not save agent access" on failure).
4. Opens the new connection → "via MCP · mcp.mock-northwind.example", "Reconnect", "Disconnect sign-in", "Rename", "Used by", "Remove {name}" (`McpDetail.tsx:134-193`).
5. Asks Chief "What does our onboarding doc say about laptops?" → Chief calls the MCP tools.

### Variations
- Wrong URL: "Enter the server URL, starting with https://." (`CustomConnectionDialog.tsx:222`).
- OAuth server: "Sign-in did not finish in time." / "This server needs an OAuth client ID." (`:160-170`).

### Edge cases
- The connection is deleted elsewhere: "This connection no longer exists." (`McpDetail.tsx:42`).

## APP-019: Maya (server owner) finds "Server integrations" and "Integrations" are different pages

**Type**: short
**Topic**: Integrations — setup surfaces
**Persona**: Founder who self-hosts and is the deployment owner
**Goal**: "Set up Slack, Gmail and the rest for the whole company."
**Preconditions**: Maya is deployment owner; app catalog not set up (no Composio key).
**Ideal path**: 3 — Integrations → set up catalog → connect.
**Alternate paths**: Integrations "Set up app catalog" (`IntegrationsHome.tsx:461`); Settings → General → "Server integrations" (`pages/AccountSettingsOverlay.tsx:223-226`, `/integrations/setup`); onboarding step (APP-001 variant C).

### Steps
1. Integrations shows "App connections aren't set up on this server yet." and "Set up app catalog" (`IntegrationsHome.tsx:461-474`).
2. Clicks it → leaves `/app` for `/integrations/setup` ("Server integrations", Client ID / API key / "Get credentials" / "Connect").
3. Later finds the same page from Settings → "Server integrations". **[Hesitation]** Two names ("app catalog", "Server integrations") for one setup.

### Settings

## APP-020: Maya switches Chief to a stronger model with her own API key

**Type**: medium
**Topic**: Settings — models and keys
**Persona**: Founder told by a friend "use your own Anthropic/OpenAI key"
**Goal**: "Make the answers better; use my company's key."
**Preconditions**: A deployment model is active; MOCK API key "sk-MOCK-DEMO-DATA" accepted by a stub provider.
**Ideal path**: 4 — Settings → Models → provider → paste key → Use this model.
**Alternate paths**: Per-bot "Model" in bot Settings → Advanced (`bot-panel.tsx:459`); onboarding "Connect a model".

### Steps
1. User menu → "Settings" → "Models" (`pages/SettingsOverlay.tsx:137-144`). → "Active model", maybe "Configured by deployment", "Thinking: …", "Providers", "Search providers" (`pages/ModelSettingsOverlay.tsx:1141-1215`).
2. Picks a provider → "Use your own key" / "Connect API key" → pastes key → "Save". → "Connected · {label}", "Stored securely. Never shown here." (`:1400-1445`).
3. Chooses a model → "Use this model".
4. Back in Chief's bot Settings → Advanced → Model: confirms which model Chief uses. **[Hesitation]** Space-wide model vs per-bot model is not explained.
5. Later "Disconnect" → "Disconnect {name}?" "This removes the connection from every space." (`:1475-1478`).

### Edge cases
- Member (not owner): "Models for the server owner’s default space." (`:1130`).
- Catalog empty: "No model catalog is available."

## APP-021: Maya changes her password, theme and language

**Type**: short
**Topic**: Settings — account
**Persona**: Naive first-time founder
**Goal**: "Dark mode, compact sidebar, new password."
**Preconditions**: Signed in as Maya.
**Ideal path**: 3.
**Alternate paths**: Password reset via sign-in (APP-003).

### Steps
1. Settings → General: "Account", "Messaging" ("Manage messaging settings"), "Appearance" (System/Light/Dark), "Sidebar density" (Comfortable/Compact), "Language", "Avatars" (Robot/Organic), "Advanced" (Stream replies, Show tool activity, Load web images automatically) (`pages/AccountSettingsOverlay.tsx:114-287`).
2. Picks Dark and Compact. → Applies immediately.
3. "Password": Current / New / Confirm → "Change password" → "Password updated" (`:415-460`).

### Edge cases
- Mismatch: "Passwords do not match".
- Avatars fail: "Couldn't update avatars".

## APP-022: Maya checks what she is paying and how much she has used

**Type**: short
**Topic**: Settings — billing and usage
**Persona**: Founder watching burn
**Goal**: "When does my trial end, and how much model spend did we use?"
**Preconditions**: Billing enabled, subscription in Trial ending in 5 days; MOCK usage data.
**Ideal path**: 2 — Settings → Billing.
**Alternate paths**: User menu "Usage" opens Settings at Usage (`pages/Shell.tsx:3910-3919`); Settings nav "Usage".

### Steps
1. Settings → "Billing" → status "Trial", "Trial ends {day}", "Manage" (`pages/BillingSettingsPanel.tsx:47-101`).
2. "Usage" → "Model spend uses your provider keys." and per-period numbers (`AccountSettingsOverlay.tsx:317-327`). **[Hesitation]** If she never added a key (deployment model), whose key is that?

### Edge cases
- "Past due", "Canceled", "Could not load billing".

### Team and members

## APP-023: Maya tries to invite her cofounder

**Type**: short
**Topic**: Team / members
**Persona**: Naive first-time founder
**Goal**: "Add Sam (cofounder) so we share Chief and the data room."
**Preconditions**: Shared seed; second MOCK person "Sam Patel, sam@northwind.example".
**Ideal path**: 3 — Settings → Members → invite email.
**Alternate paths**: none found. No invite or members UI exists in `apps/web/src` (only messaging channel "invited" status, `pages/MessagingSettingsOverlay.tsx:210`). "Team" in bot Settings refers to a shared computer, not people (`bot-panel.tsx:66-80`).

### Steps
1. Looks in Settings sections (General, Models, Memory, Voice, Usage, Computer, Billing, Updates). → No members.
2. Tries "+" → "Create new Space" hoping it is shareable. → It is a private workspace.
3. Sees "Team" under bot Settings → Computer. **[Hesitation]** Misreads it as sharing with her team.
4. Expected outcome to record: she cannot complete the goal; Sam must sign up separately and becomes a non-owner member with no shared bots.

### End-to-end

## APP-024: Maya's Monday morning across the whole app

**Type**: long
**Topic**: Moving between features
**Persona**: Naive founder, second week of use
**Goal**: "Check email, cash and equity, file the signed SAFE, and leave Chief a to-do."
**Preconditions**: Full shared seed, including 3 unread MOCK mails (one with attachment "MOCK DEMO DATA — Signed SAFE.pdf"), MOCK Finance balances, MOCK cap table.
**Ideal path**: 10 — Inbox → open mail → file attachment → Finance → Cap Table → Chief → ask → done.
**Alternate paths**: Import attachment from Data room "Import from email" (prior STORY-013) vs downloading and dragging; ask the Inbox agent panel vs Chief; Cmd+K to reach bots.

### Steps
1. Signs in → `/app` opens the first thread route (Chief).
2. Clicks Inbox (badge 3). → List grouped; Inbox agent panel on the right ("Collapse Inbox agent").
3. Opens the SAFE mail (`?mail=<id>`). Reads it. **[Hesitation]** Two assistants now visible: Inbox agent and Chief.
4. Wants it in the Data room: goes to Data room → "Import from email" → picks the attachment (prior STORY-013).
5. Clicks Finance → reads balances; the Finance agent panel offers its own chat.
6. Clicks Cap Table → checks the SAFE appears. If not, asks the panel agent.
7. Presses Cmd+K → "Chief" → Enter.
8. Types "Remind me Friday to send the Q3 investor update" → Chief replies (maybe offers a routine).
9. Clicks the bell to see the run → "Done"; clicks bell again to get the bot list back.
10. User menu → Artifacts → opens last week's update draft.
11. Logs out from the user menu.

### Edge cases
- Each feature page (Inbox, Finance, Cap Table, Data room) has its own agent panel, so "the assistant" means a different bot per page (`agentPanel`, `pages/Shell.tsx:4150-4200`).

## APP-025: Maya produces and sends a monthly investor update

**Type**: long
**Topic**: Moving between features
**Persona**: Naive founder before a deadline
**Goal**: "Get a draft investor update with a burn table, check it, and email it to investors."
**Preconditions**: Full seed; Gmail connected; Chief has Gmail access and mail sending set to ask for approval; MOCK investor list "investors@mock-northwind.example".
**Ideal path**: 6 — ask → review → edit table → approve email → confirm sent.
**Alternate paths**: Compose in Inbox ("New message") and paste; ask the Leadership group (APP-015); copy via "Copy rows" into Gmail.

### Steps
1. In Chief: "Draft our September investor update with a burn table from the finance data." → Streams a reply with a table (APP-014) and an artifact card.
2. Sorts the table, clicks "Copy rows" to check numbers in a spreadsheet.
3. Replies on the burn paragraph (hover "Reply"): "Use the real runway number from Finance." → Revised version.
4. Reacts 👍 on the final version.
5. "Email this to investors@mock-northwind.example." → A mail approval card appears (prior STORY-031..033): edits subject, clicks Send; "Sending… Undo" toast (outbox).
6. Switches to Finance while it sends; a browser notification says Chief needs input or finished (APP-016).
7. Checks Inbox → Sent via Gmail search "in:sent".
8. Opens Artifacts to find the saved draft for next month.

### Edge cases
- Approval card answered on another device (prior STORY-044).
- Copy in "More" gives no feedback (APP-013) so she may paste stale text.

## Redundancy Candidates

### Duplicate paths (same goal, multiple routes)
- Open bot settings: click the bot name in the chat header (`pages/Shell.tsx:4034`) and "Edit Profile" in the bot actions menu (`pages/BotContextMenu.tsx:131`). Same panel.
- Reply to a message: hover "Reply" icon and "More" → "Reply" (`pages/Shell.tsx:6947-6978`). Same action, two places in one 3-button toolbar.
- Create a bot: "+" → "Create new Bot", empty-state "Create new Bot", "Duplicate". The first two are identical.
- Usage: user menu "Usage" and Settings nav "Usage" (`pages/Shell.tsx:3910`, `pages/SettingsOverlay.tsx:141`). Same panel.
- Show/hide sidebar: "Minimize bots", edge button "Hide bots"/"Show bots", header "Show bots", mobile "Open navigation".
- Add an MCP server: Integrations "Add custom connection", `/integrations/setup` "Add server URL"/"Search integrations.sh", onboarding server-integrations step. Different forms for the same goal.
- Set up app connections: Integrations "Set up app catalog" and Settings "Server integrations" lead to the same `/integrations/setup` page under two names.
- Choose a model: Settings → Models, bot Settings → Advanced → Model, onboarding "Connect a model".
- Get a document into the Data room: drag onto any page (global drop zone), Data room upload, import from email/Drive, chat attachment (may or may not file it).

### Duplicate information (same fact, multiple surfaces)
- Bot name, title and preview: sidebar row, command palette row, chat header, agent panel header.
- Connection state ("Connected", "Used by"): Integrations home row, AppDetail/McpDetail, onboarding connect cards, agent-access step.
- Run state: bot avatar status dot in sidebar, Activity list status, chat header status, browser notification.

### Overlapping features/tools
- Sidebar "Search" (messages across the space), command palette "Search" (bots only), "+" picker "Search" (bots), Inbox "Search mail", Data room search. Same label, different scopes.
- Artifacts (user menu) and Data room (sidebar): both are "documents" to a founder and use the same `FolderOpen` icon (`pages/Shell.tsx:3344`, `:3894`).
- Chief, the Inbox agent, the Finance/Cap Table panel agents, and groups: several assistants a founder must choose between with no guidance on which to ask.
- "Remove" (account or connector) vs "Disconnect" (app) vs "Disconnect sign-in" (MCP OAuth) — three verbs for overlapping actions.
- Activity (bell) vs per-bot Notifications switch: both relate to "what needs me", configured and shown in unrelated places.

## Suspected problems

1. **The bell icon is "Activity", not notifications** (`pages/Shell.tsx:3205-3224`, `lib/activity-mode.ts:1-20`). A founder clicking a bell expects alerts; instead the bot list is replaced by a run log, and the mode persists across reloads, so on the next visit her bots appear to be missing.
2. **First-run asks for model and server configuration before any value** (`pages/Onboarding.tsx:563-760`, `components/integrations/IntegrationSetup.tsx:49-406`). "Provider", "Server URL", "Thinking", "Direct MCP", "Client secret", "Redirect URI" are developer terms; the only guidance on the integrations step is "Skip".
3. **Onboarding focus choices do not include company operations** (`apps/api/src/onboarding.ts:33-62`). Finance, Cap Table and Data room are in the sidebar but no choice leads to them; "A bit of everything" gives the same apps as "Day-to-day work".
4. **The command palette only switches bots and is undiscoverable** (`pages/shell/command-palette.tsx:87-107`, `pages/Shell.tsx:2846-2851`). There is no visible trigger or shortcut hint, and typing "Finance" or "Settings" returns "No bots".
5. **"Create new Bot" creates "New Bot" immediately with no naming step** (`pages/Shell.tsx:2636-2649`). Renaming requires clicking the bot name in the header, which is not labeled as a settings button (`:4034`). A create failure surfaces as a composer send error (`:2652`).
6. **No way to invite a teammate** (no members UI in `apps/web/src`). "Team" in bot Settings means a shared computer (`pages/shell/bot-panel.tsx:66-80`), which a founder will likely misread as sharing with people.
7. **Copy has no confirmation** (`pages/Shell.tsx:6897-6901`). It also fails silently when `navigator.clipboard` is missing or the write is rejected. The table's "Copy rows" does show a check mark (`packages/chat-ui/src/markdown-table.tsx:227`), so the two copy actions behave differently.
8. **The browser notification permission prompt appears on the first send** with no explanation (`pages/Shell.tsx:2280-2285`). There is no app-wide notification setting and no way to ask again after a denial.
9. **Reply context is dropped when an @group mention reroutes the message** (`pages/Shell.tsx:2346-2347`). The message also leaves the current chat with no notice in that chat.
10. **Inconsistent removal verbs and a two-name setup page**: "Remove" / "Disconnect {name}" / "Disconnect sign-in" (`components/integrations/AppDetail.tsx:105-114,344`, `McpDetail.tsx:165,190`). "Set up app catalog" and "Server integrations" open the same `/integrations/setup` (`IntegrationsHome.tsx:461`, `pages/AccountSettingsOverlay.tsx:223-226`).
11. **Table controls are not localized and downloads are always `table.csv`** (`packages/chat-ui/src/markdown-table.tsx:160,186-245`).
12. **Artifacts sits in the user menu while Data room is in the main nav, with the same icon** (`pages/Shell.tsx:3344,3884-3895`). A founder looking for a document Chief wrote checks the Data room first and does not find it there.
13. **The welcome page explains nothing for a company operator** (`pages/Welcome.tsx:19-42`). The paywall line "Any model, with your own key" (`pages/Paywall.tsx:41`) suggests a key is required before she can start.
