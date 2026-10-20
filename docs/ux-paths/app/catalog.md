## Area: App shell A (STORY-APP-nnn)

Generated: 2026-10-17
Code read at: `rakazo-ux` branch `docs/ux-pass`, commit `559a76ad`. All file:line references are to `apps/web/src/` unless another root is given.
Total Stories: 55 (34 short, 17 medium, 4 long)
Scope (part A): sign-up, sign-in and password reset; Welcome and Onboarding (every step and the focus card); Paywall and `SubscriptionGate`; sidebar and navigation (Shell, `SidebarPages`, `AddSidebarPage`, bot ordering, hide/show sidebar, phone drawer); Cmd+K palette and sidebar search; notifications and the Activity list; the Hide amounts toggle; the Artifacts page and chat file cards; agent and settings panels at phone width; window chrome and desktop updates; error boundaries and unknown URLs.
Not in part A (part B owns them): chat composer, hover actions, tables, mentions, bot create/settings, groups and spaces dialogs, Integrations, Settings sections, billing/usage panels, team/members, and the prior end-to-end stories APP-024 and APP-025.

### Changes since the 2026-10-16 catalog

The Shell was reworked after the earlier catalog (commits `bca9a32b`, `72feab12`, `5b0b1dcf`, `b008c2f2`, `1010ad09`, `42bd9d96`, `cc5265f1` and the `ux/*` merges). Many steps in the earlier stories were wrong by now.

**Kept (id unchanged, steps rewritten):**
- STORY-APP-001: sign-up to first chat. New Welcome copy, "Create your account", scripted Chief greeting, five focus choices, "Authorize" button on connect cards, Artifacts now in the sidebar.
- STORY-APP-002: focus card. The old gap is closed: "Run my company" now exists as choice A. Rewritten around what that choice does and where it still falls short.
- STORY-APP-003: sign in and password reset. New "Check your email" screen with "Send again", "Enter a valid email" check, sign-in options loading state.
- STORY-APP-004: paywall. Title is now the price when known, trial button text, recheck on window focus.
- STORY-APP-005: sidebar orientation. Artifacts, Settings, Hide amounts and Usage moved; labels now "Hide sidebar", "Search chats", "Cap table", "Create".
- STORY-APP-006: finding the investor update. Artifacts now has a sidebar link, and search and Cmd+K find it by name.
- STORY-APP-007: sidebar search. Results are now grouped (Pages, Documents, Mail, Chats).
- STORY-APP-008: Cmd+K. The old claim "bots only" is wrong: it now lists bots, groups and pages, titled "Go to".
- STORY-APP-009: hide/show sidebar and phone drawer. New labels, edge handle, swipe-from-edge.

**Dropped:** none. Every earlier story in this range still has a code path.

**Added (STORY-APP-101 to STORY-APP-146):** sign-in edge cases (101-107), onboarding steps and failures (108-112), paywall variants (113-115), bot ordering, two-space sidebar, the dormant "Add page" row, richer search and palette (116-123), notifications and Activity (124-127), Hide amounts (128), Artifacts (129-133), panels at phone width (134-136), window chrome and updates (137-139), unknown URLs and error screens (140-143), and three long journeys (144-146).

**Overlap with part B to settle at merge:** prior STORY-APP-016 (part B) covers browser notifications and the Activity bell. Stories 124-127 here re-walk those from the shell's side with corrected facts (the Activity list no longer replaces the bot list; "needs input" is not a notification event). The assembler should keep one version.

### Persona (applies to every story)

Maya Chen, cofounder and CEO of "Northwind Robotics" (a 9-person warehouse-robotics startup). She has never seen Praci. She does not know the words "bot", "agent", "space", "group", "triage", "routine", "artifact", "Data room", "approval" or "provider". She wants one place to run the company: read email, know the cash position, keep the cap table and investor documents straight, and hand repeat work to someone reliable. **Hesitation** marks where she would pause or misread. "Expects" gives the outcome a first-timer would assume.

### Mock demo data and preconditions (shared seed)

Every user-visible string in the seed contains `MOCK DEMO DATA`.

| Seed item | Value |
|---|---|
| User | Maya Chen, `maya@northwind.example` (MOCK), password set |
| New user (sign-up stories) | `maya.new@northwind.example` (MOCK), no account yet |
| Space | "Northwind Robotics" (default). Second space "Side project" only where a story says so |
| Bots | "Chief" (first bot, onboarding done), "MOCK Finance helper", "MOCK Hiring helper", archived "MOCK Old intern bot"; page agents "Inbox agent", "Finance agent", "Carta agent" once created |
| Group / section | Group "Leadership" (Chief and Finance helper); section "MOCK Ops" |
| Chief thread | 12+ messages, one saying "MOCK DEMO DATA SAFE discount 20%" |
| Inbox | 20 cached MOCK messages, 3 unread |
| Data room | 3 MOCK documents, e.g. "Seed SAFE.pdf" |
| Artifacts | 6 MOCK artifacts made by Chief and the Finance helper, among them "Q3 investor update draft" (3 versions, Markdown), "Board deck.pdf", "Runway dashboard.html" |
| Activity | 1 running run, 1 "Needs input" run, 4 finished runs |
| Server | Billing enabled for paywall stories (second account with no subscription); password reset configured; SSO provider "MOCK Okta" only for story 104 |
| Browser | Notification permission "default" unless a story says otherwise; storage enabled |

### Summary

| Type | Count |
|---|---|
| Short | 34 |
| Medium | 17 |
| Long | 4 |

### Coverage Matrix

| Feature | Stories | Gaps |
|---|---|---|
| Welcome page | 001, 106, 107 | None |
| Sign up (password) | 001, 101, 102 | Name field optional (falls back to email local part), not walked on its own |
| Sign in / out | 003, 105, 106, 107 | None |
| Password reset | 003, 103 | None |
| SSO | 104 | Needs an SSO server; code-read only |
| Onboarding: model step | 108 | OAuth "subscription sign-in" and Cloudflare gateway fields only named |
| Onboarding: server integrations step | 109, 146 | Owner only |
| Onboarding: first bot and greeting | 001, 112, 144 | None |
| Onboarding: focus card (all five choices, dismiss) | 002, 110 | "Research & writing" and "A bit of everything" only as variations |
| Onboarding: app connect cards | 001, 111 | Pipedream-managed provider not covered |
| Paywall / SubscriptionGate | 004, 113, 114, 115 | Checkout page itself is outside the app |
| Sidebar: fixed links, bot list, archived | 005, 118 | Pinned rows and "Mark as unread" are in part B |
| Sidebar: ordering, sections, nested bots | 116 | Cross-section drag is not supported by code; noted |
| Sidebar: two spaces | 117 | None |
| Add page row | 118 | Dormant in this build (only template is unavailable) |
| Sidebar search | 007, 119 | None |
| Cmd+K palette | 008, 120 | None |
| Hide/show sidebar, drawer, swipe | 009, 121, 122, 123 | RTL swipe only noted |
| Notifications: browser | 126, 127 | Desktop (Electron) notification bridge not found in web code |
| Activity list (bell) | 124, 125 | None |
| Hide amounts | 128 | Mobile app is out of scope |
| Artifacts page | 006, 129, 130, 131, 132 | Image preview not walked |
| Chat file card (ArtifactFileCard) | 133 | None |
| Panels at phone width | 134, 135, 136 | Group settings panel is a part B story |
| Window chrome | 137 | macOS traffic lights are native, not testable in web |
| Desktop updates | 138 | Needs the Electron bridge |
| Web software update | 139 | Owner only |
| Unknown URLs, error screens | 140, 141, 142, 143 | None |

### Story Dependency Graph

```text
STORY-APP-001 (Sign up -> first chat)               needs: no account
|-- STORY-APP-002 (Focus card: Run my company)
|-- STORY-APP-110 (Ignore the focus card)
|-- STORY-APP-111 (Connect card failures)
|-- STORY-APP-112 (Onboarding interrupted)
|-- STORY-APP-005 (Orient in sidebar)
|   |-- STORY-APP-006 (Find the investor update)
|   |   `-- STORY-APP-129..133 (Artifacts)
|   |-- STORY-APP-007 -> 119 (Search)
|   |-- STORY-APP-008 -> 120 (Cmd+K)
|   |-- STORY-APP-009 -> 121, 122, 123 (Hide sidebar, drawer, keyboard)
|   |-- STORY-APP-116 (Reorder), 117 (Two spaces), 118 (Add page)
|   `-- STORY-APP-124..127 (Activity and notifications)
|-- STORY-APP-128 (Hide amounts)
|-- STORY-APP-134, 135, 136 (Panels)
`-- STORY-APP-144, 145 (long journeys; need full seed)
STORY-APP-003, 101..107 need only an account or none.
STORY-APP-108, 109, 146 need a server with no model or no integration setup.
STORY-APP-004, 113, 114, 115 need billing on and an unsubscribed account.
STORY-APP-137..143 need nothing from the seed.
```

### Stories: Sign-up, sign-in and password reset

#### STORY-APP-001: Maya signs up and gets to her first useful chat

**Type**: long
**Topic**: Sign-up and onboarding
**Persona**: Naive first-time founder (Maya Chen)
**Goal**: "Create an account and get something that helps me run Northwind."
**Preconditions**: No account for `maya.new@northwind.example` (MOCK). Server already has a deployment model (`me.needsModel=false`) and no integration setup is needed. Composio is configured so Chief's connect cards appear. Variants B and C are separate stories (108, 109).
**Ideal path**: 5 — Sign up, fill the form, pick a focus, authorize one app, ask a question. A product for founders should not ask for model or server setup in the first minute.
**Alternate paths**: `/sign-in` then "Sign up" (`pages/Auth.tsx:318-325`); direct `/sign-up`. After sign-up the router sends a signed-in user to `/onboarding` (`App.tsx:145`).

##### Steps
1. Opens `/`. Sees the Praci logo, "Bots that run your inbox, cash, cap table and investor documents." and two controls, "Sign up →" and "Sign in" (`pages/Welcome.tsx:22-43`). Expects a short explanation or a demo. **Hesitation:** "Bots" is the only noun; she wonders if this is a chatbot or software she must configure. The copy does name her four jobs (inbox, cash, cap table, investor documents), which is better than before.
2. Clicks "Sign up". Sees "Create your account" with Name ("Your name"), Email ("Your email address"), Password and the hint "At least 8 characters." (`pages/Auth.tsx:214-280`). A brief "Loading…" shows first while the server reports which sign-in methods exist (`:192-196`).
3. Types Name "Maya Chen", Email "maya.new@northwind.example", a password. Clicks the eye button ("Show password") to check the typing; the label flips to "Hide password" (`:264-274`).
4. Clicks "Create account". The button reads "Working…" while it runs, then the app goes to `/onboarding` (`:295-305`, `:114-121`). She sees "Loading…" and then "Opening chat…" (`pages/Onboarding.tsx:559,1046`). **Hesitation:** two plain loading screens in a row with no sign that her account was made.
5. Lands on `/app/<chiefId>` in a thread with the bot "Chief". The first message reads "Hi Maya, I'm Chief. I can sort your email, keep an eye on cash and the cap table, find investor documents in the Data room, and draft updates and research for you." (`apps/api/src/onboarding.ts:119-131`). **Hesitation:** "Data room" is still unexplained, but she can see it in the sidebar.
6. Under it, a card asks "What do you want me on first?" with A "Run my company", B "Day-to-day work", C "Inbox & email", D "Research & writing", E "A bit of everything", and an X ("Dismiss") in the corner (`pages/shell/message-cards.tsx:77-125`, options at `apps/api/src/onboarding.ts:34-71`). She picks A (see STORY-APP-002 for what follows).
7. Chief replies with a short text, then a card per app. Each card has the app logo, name, a one-line description and an "Authorize" button (`message-cards.tsx:206-235`). She clicks "Authorize" on Gmail. The button reads "Waiting…" and a popup opens to Google. She approves with the MOCK account; the card switches to "Connected" (`:208-212`).
8. Types "What should I look at first today?" in the composer and presses Enter. A reply streams in.
9. Looks at the sidebar from top to bottom: bell, hide-sidebar icon and "+" in the top row; a "Search chats" box; Inbox, Finance, Cap table, Data room, Artifacts; the bot list with Chief; Integrations; her initials and "Maya Chen" (`pages/Shell.tsx:3354-3532,4058-4080`). She now has a map of the product.

##### Variations
- SSO configured next to passwords: a small "Continue with {name}" link appears under the form (`pages/Auth.tsx:306-317`).
- Browser autofill fills Name and Email; the Name field is optional. If left empty, the name becomes the part of the email before "@" (`:103`), so Chief greets her as "Hi maya.new".
- Phone width (390px): the same flow in a single column; sidebar is a drawer (see STORY-APP-121).

##### Edge Cases
- Bot creation fails: the onboarding page shows "Could not create your bot" with "Try again" (`pages/Onboarding.tsx:546,1041`). See STORY-APP-112.
- Visiting `/sign-up` while signed in goes straight to `/onboarding`, and from there to the existing Chief (`App.tsx:145`, `Onboarding.tsx:60-76`).
- Email verification required: see STORY-APP-102.

#### STORY-APP-002: Maya picks "Run my company" on the focus card

**Type**: short
**Topic**: Onboarding focus card
**Persona**: Naive first-time founder
**Goal**: "Tell the assistant I want help with finance, the cap table and investor docs."
**Preconditions**: Fresh Chief thread with the unanswered focus card. Composio catalog has Gmail and Google Calendar.
**Ideal path**: 2 — read the choices, click A. The earlier gap (no company-wide option) is closed.
**Alternate paths**: Dismiss the card and type the request (STORY-APP-110).

##### Steps
1. Reads A "Run my company", B "Day-to-day work", C "Inbox & email", D "Research & writing", E "A bit of everything" (`apps/api/src/onboarding.ts:34-71`). Expects A to cover finance, cap table and investor documents. The card shows only the label; the summary "cash, cap table, investors, and email" is not shown until after she chooses. **Hesitation:** she cannot tell how A differs from E.
2. Clicks A. The card collapses to just her choice with a check mark, other choices are hidden (`message-cards.tsx:102-123`).
3. Chief replies "Got it. Cash, cap table, investors, and email. I'll see what's already connected so I don't make you set something up twice." then "Gmail and Google Calendar are a good place to start. Connect them here and I'll use what you already have." and two connect cards, then "Hit those two and I'll start pulling the picture." (`onboarding.ts:285-343`).
4. A last message says: "For cash and equity, open Finance and Cap table in the sidebar to connect your bank, card, and Carta. Board decks and investor documents go in the Data room." (`onboarding.ts:44`). She clicks Finance in the sidebar and sees the page that asks for a bank connection. **Hesitation:** Chief's apps are Gmail and Calendar only; bank, Carta and documents are connected somewhere else. She expected Chief to ask for those here.

##### Variations
- B offers Slack, Gmail and Google Calendar. C offers Gmail, Calendar and Slack (same apps, different order). D offers Hacker News, Notion and Google Docs, which looks odd for a company operator. E offers Gmail, Slack and Google Docs.
- If the catalog has none of the named apps, Chief posts only the note, or "What would you like to work on first?" (`onboarding.ts:327-332`).

##### Edge Cases
- Saving the choice fails: "Could not save this choice" under the options; dismiss fails: "Could not dismiss" (`message-cards.tsx:37,52`).
- The card is answered once. A second click is blocked because all options are disabled after an answer (`:90-96`).

#### STORY-APP-003: Maya signs in on a new laptop and forgets her password

**Type**: short
**Topic**: Sign-in and password reset
**Persona**: Returning founder
**Goal**: "Get back into my account."
**Preconditions**: Maya's MOCK account exists; server has password reset configured and email delivery works.
**Ideal path**: 4 — Sign in, "Forgot password?", enter email, click the emailed link and set a password.
**Alternate paths**: `/forgot-password` directly. Settings → Password only while signed in (part B).

##### Steps
1. Opens `/sign-in`: "Sign in to Praci", Email, Password, "Continue with email", and below "Don't have an account? Sign up" (`pages/Auth.tsx:43,295-325`). Types a wrong password. Sees a red message under the fields (`authErrorText`, `lib/user-error.ts:15-31`). **Hesitation:** the button says "Continue with email" though she is typing her email and password; she may think it sends a code.
2. Clicks "Forgot password?" under the password box (`:281-287`). The page becomes "Reset your password" with only Email and "Send reset link".
3. Types her email and clicks "Send reset link". The page changes to "Check your email" with: "If maya@northwind.example has an account, a reset link is on its way. It can take a minute; check your spam folder if it does not arrive." plus "Send again" and "Back to sign in" (`:153-176`).
4. Opens the email, clicks the link: "Choose a new password" with "New password" and "Confirm password" and "Reset password" (`:347-428`). Enters the same password twice.
5. Sees "Password updated" and a "Sign in" link. Signs in; lands on `/app` (Chief or her first bot).

##### Variations
- Reset not configured on this server: "Forgot password?" is hidden (`:281`). If she reaches `/forgot-password` anyway, submit shows "Password recovery is not configured for this server" (`:82-83`).

##### Edge Cases
- Empty or invalid email on any form shows "Enter a valid email"; empty password shows "Enter a password" (`user-error.ts:10-12`, `Auth.tsx:73-77`).
- Server unreachable on submit: "Could not reach the server" (`:123`).
- Expired link: see STORY-APP-103.

#### STORY-APP-004: A founder without a subscription hits the paywall

**Type**: short
**Topic**: Paywall
**Persona**: Naive first-time founder
**Goal**: "Start using it."
**Preconditions**: Billing enabled on the server; account "Paywall tester" with no subscription and permission to manage billing.
**Ideal path**: 2 — click the trial button, finish checkout.
**Alternate paths**: "Manage billing" appears only for past-due, incomplete or canceled customers (STORY-APP-115).

##### Steps
1. Signs in. Every `/onboarding` and `/app` route is wrapped by `SubscriptionGate` (`App.tsx:172-180`), which checks the server's sign-in options and then billing status (`components/SubscriptionGate.tsx:44-58`). While it checks, she sees the shell skeleton ("Opening your Space…") (`App.tsx:282-317`).
2. Sees the paywall. The heading is the price when known, for example "$29 / month" (`lib/billing.ts:8-21`, `pages/Paywall.tsx:44-47`), otherwise "Subscription required". Below: four check-marked lines: "Bots with their own computer and browser", "Routines that run while you're away", "Any model, with your own key", "Web, desktop and mobile apps" (`Paywall.tsx:38-43`). **Hesitation:** "Any model, with your own key" suggests she must bring and pay for a model key on top of the subscription. "Routines" is new vocabulary.
3. Clicks "Start 14-day free trial" (or "Subscribe" if no trial is available) (`:73-80`). The browser goes to the billing page. On desktop the system browser opens and this page stays.
4. Finishes checkout and returns. See STORY-APP-114 for how the gate notices.

##### Variations
- "Log out" at the bottom of the paywall signs her out and goes to `/` (`:94-106`).

##### Edge Cases
- Checkout cannot open: "Could not open billing" in red above the list (`:30,58-62`).
- The status lookup itself fails: the gate lets her into the app instead (`SubscriptionGate.tsx:51`); the server enforces access.

#### STORY-APP-101: Maya makes mistakes on the sign-up form

**Type**: short
**Topic**: Sign-up validation
**Persona**: Naive first-time founder, typing on a phone
**Goal**: "Just get my account made."
**Preconditions**: Sign-up page. A second MOCK account `maya@northwind.example` already exists.
**Ideal path**: 1 — a clear message beside the field that is wrong.
**Alternate paths**: none found.

##### Steps
1. Types "maya" (no @) as the email, a 6-character password, presses "Create account". The browser itself blocks the submit with its own tooltip, because the fields are `type="email"`, `required` and `minLength={8}` (`pages/Auth.tsx:241-242,260-261`). Message wording and position depend on the browser. **Hesitation:** on some phones the tooltip appears off screen.
2. Fixes both. Uses `maya@northwind.example` (taken). Clicks "Create account". Red text appears above the button with the server's reason, or "Could not continue" if the reason is technical (`:290-294`, `user-error.ts:100-110`). **Hesitation:** if the message only says "Could not continue" she does not know she should sign in instead. The page shows "Already have an account? Sign in" below, which helps.
3. Clicks "Sign in" in that line and enters the same email; the form is empty again (the page remounts, `App.tsx:140-145`).

##### Variations
- "Registration is closed" or "Email is not allowed to register" (`user-error.ts:19-20`) on locked-down servers.

##### Edge Cases
- Double-click on "Create account": the button is disabled while "Working…" (`Auth.tsx:295`).

#### STORY-APP-102: The server asks Maya to verify her email

**Type**: short
**Topic**: Sign-up, email verification
**Persona**: Naive first-time founder
**Goal**: "Finish creating my account."
**Preconditions**: Server requires email verification (`signupRequiresEmailVerification`).
**Ideal path**: 3 — see the screen, open the email, click the link.
**Alternate paths**: none found.

##### Steps
1. Submits the sign-up form. The page title becomes "Check your email" and the URL gets `?verify=email` (`pages/Auth.tsx:110-113,35,40-41`). **Hesitation:** under the title there is only a "Back to sign in" link (`:153-176`). No sentence says which address got the email, no spam hint and no "Send again" button. The explanatory text and "Send again" exist only on the password-reset path (`resetSent`).
2. Opens the email, clicks the link, comes back signed in or at sign-in.
3. If she closes the tab and returns to `/sign-up`, the form is empty and she has no record of whether the account exists.

##### Edge Cases
- The email never arrives: the screen offers no recovery. She must try signing in, which may say "Email verification required" (`user-error.ts:21-22`).

#### STORY-APP-103: Maya opens an old password-reset link

**Type**: short
**Topic**: Password reset, failure
**Persona**: Returning founder
**Goal**: "Reset my password."
**Preconditions**: A reset link older than the server's limit, or an already used one.
**Ideal path**: 2 — read the error, request a new link.
**Alternate paths**: Click "Back to sign in" and start again.

##### Steps
1. Clicks the old link. `/reset-password?error=...` shows "Choose a new password" with a red line "This reset link is invalid or expired" already visible (`pages/Auth.tsx:354-356`). The two password boxes are still there. **Hesitation:** the form looks usable, but "Reset password" is enabled only when a token exists (`:416`). She may type a password into a form that cannot work.
2. Clicks "Back to sign in" (`:421`), then "Forgot password?" and requests a new link; the "Check your email" screen offers "Send again" if the first email is slow (`:168-170`).

##### Edge Cases
- Passwords differ: "Passwords do not match" (`:363`).
- Link works but the server refuses: "Could not reset password" or the server's reason (`:371`).

#### STORY-APP-104: Maya's company signs in with SSO only

**Type**: short
**Topic**: SSO
**Persona**: Employee of a company that runs Praci on its own server
**Goal**: "Sign in with my work login."
**Preconditions**: Server has SSO provider "MOCK Okta" and password sign-in turned off.
**Ideal path**: 2 — click the SSO button, approve.
**Alternate paths**: none found.

##### Steps
1. Opens `/sign-in`. The title is "Sign in to Praci" and there is a single large button "Continue with MOCK Okta"; no email or password fields (`pages/Auth.tsx:197-206`).
2. Clicks it. A sign-in window or redirect opens (`lib/sso-flow`, `Auth.tsx:129-149`). On success she lands at `/app`; a new user lands at `/onboarding`.
3. A failure shows red text: "SSO is temporarily unavailable. Try again.", or "Sign in to your existing account to link SSO" when the same email already has a password account (`user-error.ts:17-18`). **Hesitation:** the second message names no way to sign in to the existing account, because password sign-in is off.

##### Edge Cases
- On `/sign-up` with SSO only, the same button appears; there is no separate create step.

#### STORY-APP-105: The sign-in page cannot load its options

**Type**: short
**Topic**: Sign-in, failure
**Persona**: Returning founder on weak hotel Wi-Fi
**Goal**: "Sign in."
**Preconditions**: The request for sign-in options fails (server slow or offline).
**Ideal path**: 2 — read the message, press Retry.
**Alternate paths**: Reload the page.

##### Steps
1. Opens `/sign-in`. The form is not shown; instead "Loading…" appears (`pages/Auth.tsx:192-196`).
2. After the request fails, the message "Could not load sign-in options" and a "Retry" button replace it (`:179-191`). She presses Retry; the options request runs again.
3. Wi-Fi returns; the form appears with Email, Password and "Continue with email".

##### Edge Cases
- She submits while options are missing: nothing happens, because the form is not rendered (`submit` returns when `reset?.passwordAuth` is falsy, `:72`).

#### STORY-APP-106: Maya opens a saved link while signed out, and a signed-in tab opens the welcome page

**Type**: short
**Topic**: Routing and redirects
**Persona**: Returning founder
**Goal**: "Open the Finance page link my cofounder pasted."
**Preconditions**: Maya is signed out. Link: `/app/finance`.
**Ideal path**: 2 — sign in and land on Finance.
**Alternate paths**: none found.

##### Steps
1. Opens `/app/finance` signed out. She is sent to `/sign-in` with nothing remembered about where she wanted to go (`App.tsx:180-182`). Only `/integrations/setup` keeps a `?next=` target (`App.tsx:96-97,165-170`).
2. Signs in. She lands on `/app` and the first bot, not Finance (`pages/Auth.tsx:115-121`). **Hesitation:** she expects the link she clicked to open; she has to find Finance in the sidebar again.
3. In another tab already signed in, she opens `/`. The app skips the Welcome page and goes straight to `/app` (`App.tsx:136`). `/sign-in` and `/forgot-password` do the same.

##### Edge Cases
- `/sign-up` while signed in goes to `/onboarding`, not `/app` (`App.tsx:145`).

#### STORY-APP-107: Maya logs out and signs back in on a shared computer

**Type**: short
**Topic**: Sign-out
**Persona**: Founder on a co-working PC
**Goal**: "Leave nothing behind."
**Preconditions**: Signed in, Chief open.
**Ideal path**: 3 — open the account menu, "Log out", confirm she is signed out.
**Alternate paths**: "Log out" on the paywall (STORY-APP-004).

##### Steps
1. Clicks her initials and "Maya Chen" at the bottom of the sidebar (`pages/Shell.tsx:4077-4080`). A menu opens upward with Settings, "Hide amounts", Usage and "Log out" (and "Task board" only if enabled) (`:4084-4146`).
2. Clicks "Log out". The app signs out, forgets the selected space, and goes to `/` (the Welcome page) (`:4132-4143`). No confirmation.
3. Presses the browser Back button. She expects the signed-out Welcome page; the app redirects any `/app` URL to `/sign-in` (`App.tsx:181`).
4. Signs in again with the same account; lands on `/app`.

##### Edge Cases
- Hide amounts is a browser setting, not an account setting; it stays on after log out for the next person on that browser (`lib/hide-amounts-preference.ts:30-34`).

### Stories: Onboarding steps and failures

#### STORY-APP-108: Maya's server has no model, so setup asks her to connect one

**Type**: medium
**Topic**: Onboarding, model step
**Persona**: Naive first-time founder on a self-hosted Praci
**Goal**: "Get through setup."
**Preconditions**: Fresh account; `me.needsModel=true`; model catalog lists several providers.
**Ideal path**: 4 — pick a provider, paste a key, press Continue. For a first-timer this step should not exist.
**Alternate paths**: Sign-in-based providers (a ChatGPT subscription) replace the key box with a sign-in button.

##### Steps
1. After sign-up she sees "Connect a model" with "Provider" (a dropdown), "Model", and an "API key" box (`pages/Onboarding.tsx:563-980`). **Hesitation:** she does not know what a provider or model is. Expects the product to bring its own.
2. Opens the provider dropdown. The first entry is preselected (`Onboarding.tsx:159-197`). She keeps it and sees the model dropdown fill in.
3. Sees "Thinking" (default "Medium") for some models. **Hesitation:** unexplained.
4. The "API key" box shows the hint `sk-…`. "Continue" is greyed out until a key is entered (`:254-260`). She has none. She looks for help; there is none on the page.
5. Pastes a MOCK key. A "Test API key" button appears for some providers (`components/ModelConnectionPreflightNotice.tsx:33-34`). She clicks it; it reads "Testing…" and then shows a success or failure notice.
6. Clicks "Continue". On success the page moves to the next step (server integrations if needed, otherwise the first bot). On failure a red line says "Could not save model" or the provider's reason (`:508`).

##### Variations
- Provider "OpenAI-compatible server": fields "Server URL", "Find models" ("Finding…"), a model list or "Other model…", and an "API key" disclosure whose box says "Optional" (`:596-690,950-975`). This is the only provider where a key is optional.
- Subscription sign-in providers: a sign-in button ("Sign in" or the provider's own label) opens a window; the page may ask her to paste "Authorization code or callback URL" and press "Submit" (`:819-884`).

##### Edge Cases
- The page remembers nothing if she reloads mid-way; the same page appears again.
- If the request for her account (`me`) fails, the page skips straight to creating Chief (`:197`) without a model check. If only the model list fails, the model step opens with an empty provider list and Continue stays off. (Code reading only.)

#### STORY-APP-109: Maya, the server owner, meets "Server integrations" during setup

**Type**: short
**Topic**: Onboarding, integrations step
**Persona**: Founder who is also the person who installed Praci
**Goal**: "Finish setup quickly; I will connect apps later."
**Preconditions**: Maya is the deployment owner; no app catalog is configured (`integrations.needsSetup=true`); a model is already configured.
**Ideal path**: 1 — Skip.
**Alternate paths**: Settings → Server integrations later (part B).

##### Steps
1. After sign-up she sees "Server integrations" and "Choose how apps connect for everyone on this server." (`components/integrations/IntegrationSetup.tsx:169-174`). Five rows follow: "Apps with their own server", "Popular apps through Composio", "Popular apps through Pipedream", "Google apps", "Your own tool server" (`:52-73`). **Hesitation:** every row is infrastructure vocabulary. She does not know that skipping is allowed.
2. Picks "Popular apps through Composio". Fields appear: "API key", "Get credentials", "Connect" (`:225-302`).
3. Presses "Skip" at the bottom (`:444`). She goes on to "Opening chat…" and Chief.

##### Variations
- "Continue" instead of Skip: it is disabled until credentials are filled in (`:427-441`).
- For someone who cannot configure the server, this step renders nothing at all, with no Skip button (`:164`). Whether the server ever sends such a user here (`needsSetup` for a non-owner) was not checked.

##### Edge Cases
- Failed load: "Could not load integrations" (`:104`).

#### STORY-APP-110: Maya ignores the focus card and just types

**Type**: short
**Topic**: Onboarding focus card
**Persona**: Impatient first-time founder
**Goal**: "Ask my question now."
**Preconditions**: Fresh Chief thread with the focus card showing.
**Ideal path**: 2 — type and send.
**Alternate paths**: Click X ("Dismiss").

##### Steps
1. Ignores the card. Types "Help me keep the cap table and investor updates straight" and presses Enter. Chief answers normally. The focus card remains pending above the conversation.
2. Scrolls up later and clicks "Inbox & email" on the old card. It still works: Chief posts a summary and connect cards below her last message (`onboarding.ts:244-260`). **Hesitation:** a choice made in the middle of an unrelated conversation looks like an interruption.
3. Alternatively clicks X ("Dismiss") in the corner. The card disappears and Chief posts nothing (`message-cards.tsx:45-56,76-93`; the server marks it dismissed, `onboarding.ts:218-241`).

##### Edge Cases
- The card does not reappear after a reload once dismissed or answered. If she sent a message before the card was posted, the server skips the card (`promptFocus` returns when a user message exists, `onboarding.ts:178-182`).

#### STORY-APP-111: A connect card fails when the popup is blocked or closed

**Type**: short
**Topic**: Onboarding, app connect cards
**Persona**: Naive first-time founder with a pop-up blocker
**Goal**: "Connect Gmail."
**Preconditions**: Chief's Gmail and Calendar cards are showing; the browser blocks pop-ups.
**Ideal path**: 2 — click Authorize, approve, see "Connected".
**Alternate paths**: Connect Gmail later in Integrations.

##### Steps
1. Clicks "Authorize" on Gmail. The button changes to "Waiting…" and is disabled (`message-cards.tsx:225-231`). The popup is blocked; nothing opens. The code does not check whether the popup opened (`:177-179`). **Hesitation:** nothing tells her to allow pop-ups.
2. She waits. The card polls every 2 seconds, up to 60 times (`:182-194`). After about 2 minutes: "Authorization timed out. Please try again." in red (`:195`). The button returns to "Authorize".
3. Allows pop-ups for the site and clicks "Authorize" again. Google asks for consent; she approves; the card shows "Connected" with a small pop animation.

##### Variations
- She closes the Google window without finishing: the same timeout path.
- A narrow card (phone) wraps the Authorize button under the name (`:213`).

##### Edge Cases
- Leaving the page cancels the wait (`useEffect` cleanup aborts, `:174`).
- Other failure: "Could not authorize this app" or the server's reason (`:197`).

#### STORY-APP-112: Maya's setup is interrupted and she reopens it

**Type**: medium
**Topic**: Onboarding, resilience
**Persona**: Naive first-time founder
**Goal**: "Pick up where I left off."
**Preconditions**: New account; network drops while the page shows "Opening chat…"; later she opens two tabs.
**Ideal path**: 2 — reload and land in the same Chief chat.
**Alternate paths**: "Try again" button.

##### Steps
1. Signs up. On "Opening chat…" the connection fails. The page shows a red message "Could not create your bot" and a "Try again" button (`pages/Onboarding.tsx:1034-1044`). She presses it; the same step runs again.
2. If the first attempt actually created Chief, the retry finds that bot by its spawn key and opens it instead of making a second one (`Onboarding.tsx:49-76,525-548`). She sees one Chief, not two.
3. She closes the tab, opens `/app` later. The shell finds her bot list and shows Chief with its greeting and the unanswered focus card.
4. She opens `/onboarding` in a second tab at the same time. A browser lock lets only one tab create Chief (`:78-83`); the other waits and reuses it.
5. If she later deletes every bot and group (nothing archived either, and no other space has content), `/app` sends her back to `/onboarding` and a new Chief is made (`Shell.tsx:1106-1119`).

##### Variations
- Creating a second space ("New space" in "+") leads to `/onboarding` again in that space, so the new space gets its own Chief (`Shell.tsx:5180-5190`).

##### Edge Cases
- The focus card is not posted twice: the server locks the thread and checks for an existing card (`onboarding.ts:175-196`).

### Stories: Paywall and subscription gate

#### STORY-APP-113: A teammate without billing rights hits the paywall

**Type**: short
**Topic**: Paywall, non-manager
**Persona**: Employee invited to a company workspace (Maya's cofounder Sam)
**Goal**: "Use the product my cofounder set up."
**Preconditions**: Billing enabled; the space has no active subscription; Sam cannot manage billing (`status.canManage=false`).
**Ideal path**: 1 — a message telling him whom to ask.
**Alternate paths**: none found.

##### Steps
1. Signs in. Sees the heading "Subscription required" (`pages/Paywall.tsx:47`). No price, no list of benefits, no subscribe button (`:63-81` render only for managers). The only control is "Log out".
2. **Hesitation:** nothing says that someone else must subscribe, or who. He expects at least "Ask your admin". He can only log out or wait.
3. When Maya subscribes, Sam switches back to the tab: the gate rechecks billing on focus and opens the app without a reload (`SubscriptionGate.tsx:61-81`).

##### Edge Cases
- Billing status lookup fails when Sam focuses the tab: ignored, he stays on the paywall (`:72`).

#### STORY-APP-114: Maya pays in another window and returns

**Type**: medium
**Topic**: Paywall, checkout round trip
**Persona**: Naive first-time founder
**Goal**: "Start the trial and keep going."
**Preconditions**: Same as STORY-APP-004. Variant A: web. Variant B: desktop app.
**Ideal path**: 3 — click, pay, return to find the app ready.
**Alternate paths**: Pay in the same tab (web).

##### Steps
1. Clicks "Start 14-day free trial". On the web the whole tab navigates to the billing page (`Paywall.tsx:28`).
2. On desktop the system browser opens and the Praci window stays on the paywall. The button is re-enabled after the call returns (`:31-34`). **Hesitation:** nothing says "finish in your browser"; she may click it again and open a second checkout.
3. Pays. Returns to the Praci window. When the window gets focus, the app asks the server again, and the paywall is replaced by the shell skeleton and then the app or onboarding (`SubscriptionGate.tsx:61-81`).
4. If payment is slow to register, nothing changes until the next focus event. She switches windows again and it opens.

##### Edge Cases
- She keeps the paywall open for hours: the gate only rechecks on focus or tab visibility, not on a timer.

#### STORY-APP-115: A lapsed subscriber needs the billing portal

**Type**: short
**Topic**: Paywall, past due
**Persona**: Returning founder whose card failed
**Goal**: "Fix my payment."
**Preconditions**: Customer exists; state is "past_due", "incomplete" or "canceled"; Maya can manage billing.
**Ideal path**: 2 — "Manage billing", update the card.
**Alternate paths**: "Subscribe".

##### Steps
1. Signs in and sees the paywall with the price heading, benefits, a primary button ("Subscribe", or the trial button if the server still offers a trial) and below it a second, lighter button "Manage billing" (`Paywall.tsx:73-93`, `showPortal` at `:17-20`).
2. Clicks "Manage billing". The billing portal opens. She updates the card.
3. Returns; the window focus recheck opens the app. **Hesitation:** two buttons, "Subscribe" and "Manage billing", look like alternatives. She is unsure which one fixes a failed card.

##### Edge Cases
- Portal fails to open: "Could not open billing".

### Stories: Sidebar and navigation

#### STORY-APP-005: Maya orients herself in the sidebar

**Type**: medium
**Topic**: Navigation
**Persona**: Naive first-time founder
**Goal**: "Figure out where email, money, equity and documents live, and what everything else is."
**Preconditions**: Full shared seed (Chief, two helpers, Leadership group, MOCK Ops section, one archived bot, 3 unread mails, 6 artifacts).
**Ideal path**: 1 — one glance at a labeled sidebar.
**Alternate paths**: Cmd+K lists pages, bots and groups (STORY-APP-008); the search box finds pages by name (STORY-APP-007).

##### Steps
1. Reads the top row of the sidebar: a bell (tooltip "Activity"), a panel icon (tooltip "Hide sidebar", desktop only) and a plain "+" (tooltip "Create") (`pages/Shell.tsx:3354-3395`). **Hesitation:** she expects the bell to list notifications; it opens a list of runs (STORY-APP-124). The "+" has no label until she hovers.
2. Reads the search box, "Search chats", with a magnifier (`:3455`). Below it come five links with icons: Inbox (badge "3" when there are unread messages), Finance, Cap table, Data room, Artifacts (`:3471-3531`). She clicks each; the main area changes and the link is highlighted. **Hesitation:** "Data room" and "Artifacts" both hold files. The icons differ now (folder vs stacked files, `:3519-3524`) but the names do not say how.
3. Below the links is the bot list: rows with a colored avatar, name, time and a one-line preview, and a dot when unread (`:3740-3960`). "MOCK Ops" is a heading she can click to collapse (`:3580-3640`); the Leadership group is a row with stacked avatars, listed with the bots. Clicks Chief; the chat opens at `/app/<id>`.
4. Hovers a bot row. A "..." button appears at the right (`:3944`) and the time hides. Right-click opens the same menu. **Hesitation:** on a touch screen that button is hidden (`pointer-coarse:hidden`), so a phone user has no visible way to the menu.
5. Scrolls to "Archived 1" (`:3980`) and expands it: "MOCK Old intern bot" with "Restore" and "Delete".
6. At the bottom, reads "Integrations" and then her initials and name (`:4058-4080`). Clicks the name: menu with Settings, Hide amounts, Usage, Log out ("Task board" appears only if enabled) (`:4084-4146`). **Hesitation:** Settings is not a sidebar link, and Artifacts is no longer in this menu (it moved to the sidebar).

##### Variations
- Density "Compact" (Settings) shortens rows and swaps previews for a status word.
- On a phone every part of this lives in a drawer (STORY-APP-121).

##### Edge Cases
- No bots, groups or archive in the space: she is sent to onboarding (STORY-APP-112). Bots exist but none is selected: the header reads "Select a bot" (`:4267`).
- Only one space exists: no space name is shown; the first section has no heading (`pages/shell/space-sidebar.ts:50-66`).

#### STORY-APP-006: Maya looks for the investor update Chief made last week

**Type**: short
**Topic**: Navigation to Artifacts
**Persona**: Naive first-time founder
**Goal**: "Find the document Chief wrote for me."
**Preconditions**: Artifact "Q3 investor update draft" exists; Data room holds 3 other MOCK documents.
**Ideal path**: 2 — open the documents area and click the file.
**Alternate paths**: Scroll Chief's thread to the file card (STORY-APP-133); type "investor" in the sidebar search; Cmd+K then "Artifacts".

##### Steps
1. Clicks "Data room" because it sounds like documents. Sees her 3 uploaded documents, not Chief's draft. **Hesitation:** nothing there says where Chief's files live.
2. Sees "Artifacts" one line lower in the sidebar and clicks it. The page "Artifacts" opens inside the same shell (`/app/artifacts`, `App.tsx:188`) with cards in a grid.
3. Clicks the "Q3 investor update draft" card. The URL becomes `/app/artifacts/<id>`; a list of artifacts is on the left and the document on the right (STORY-APP-130).

##### Variations
- Types "investor" in the sidebar search: Data room documents are listed, but artifacts are not searched there; only chats, pages and documents (STORY-APP-119). The word "Artifacts" matches the page named Artifacts, not the file.
- Cmd+K, "Arti" shows the Artifacts page under "Pages" (`pages/Shell.tsx:1788-1799`).

##### Edge Cases
- Artifact page empty: "No artifacts found." (STORY-APP-132).

#### STORY-APP-007: Maya searches the sidebar for "SAFE"

**Type**: short
**Topic**: Sidebar search
**Persona**: Naive first-time founder
**Goal**: "Find where we talked about the SAFE."
**Preconditions**: Chief message containing "MOCK DEMO DATA SAFE discount 20%"; Data room document "Seed SAFE.pdf".
**Ideal path**: 2 — type, click a result.
**Alternate paths**: Cmd+K searches names only (STORY-APP-008); Inbox has its own box.

##### Steps
1. Types "SAFE" into "Search chats" (`pages/Shell.tsx:3455`). **Hesitation:** the placeholder says chats, but the results include documents and mail.
2. After about 200 ms (`:1822-1857`) the bot list is replaced by grouped results (`pages/SpaceSearch.tsx:95-163`): "Documents" (the Seed SAFE.pdf), "Mail" ("Search mail for “SAFE”"), and "Chats" (the matching message with the bot name and a snippet). Pages appear first when a page name matches.
3. Clicks the chat hit. The app opens that bot at `?m=<messageId>` and scrolls to the message (`jumpToSearchHit`, `:1859-1869`). The box clears.
4. Pressing Escape in the box, or the X ("Clear search"), clears it and brings the bot list back (`:3447-3470`).

##### Variations
- Clicks the document: opens Data room with that item selected (`/app/data-room?item=<id>`).
- Clicks "Search mail for “SAFE”": opens the Inbox with `?q=SAFE`.

##### Edge Cases
- Nothing matches: only the "Mail" row remains. The text "No results" never appears in the sidebar, because the mail row is always supplied (`SpaceSearch.tsx:80`, `Shell.tsx` passes `onSearchMail` always). See Suspected problems.
- Slow search: "Searching…" shows inside the Chats section while the request runs.

#### STORY-APP-008: Maya presses Cmd+K to go to Finance

**Type**: short
**Topic**: Command palette
**Persona**: Founder who uses Notion/Linear and tries Cmd+K by habit
**Goal**: "Jump to Finance, or to the Finance helper, from the keyboard."
**Preconditions**: Chief, MOCK Finance helper, MOCK Hiring helper, Leadership group exist.
**Ideal path**: 2 — Cmd+K, type "fin", Enter.
**Alternate paths**: Sidebar link; Cmd+1 to Cmd+9 for the first nine bots.

##### Steps
1. Presses Cmd+K (Ctrl+K on Windows and Linux) (`pages/shell/command-palette-hotkey.ts`, listener `pages/Shell.tsx:2966-2973`). A dialog opens with an input "Search" and a list. Nothing on screen taught her this shortcut. **Hesitation:** none visible before she tries.
2. Sees the list in one order: "Bots" (each with avatar, name, optional title badge, a subtitle and its shortcut such as "⌘1"), then "Groups", then "Pages" (Inbox, Finance, Cap table, Data room, Integrations, Artifacts, Settings) (`pages/shell/command-palette.tsx:104-205`). The "Bots" heading shows only when groups or pages are also listed.
3. Types "fin". The list shows "MOCK Finance helper" under Bots and "Finance" under Pages (`:62-66`). Arrow keys move; Enter on "Finance" opens the Finance page. Enter on the helper opens that bot's chat.
4. Opens again, presses Cmd+2. The second bot in the full list opens at once, even if the list is filtered (`:68-83`).

##### Variations
- Types "cap" → "Cap table" page. Types "settings" → "Settings", which opens the settings dialog, not a page (`Shell.tsx:1814-1819`).
- Presses Cmd+K again: the palette closes (it toggles) (`:2970`).

##### Edge Cases
- Typing text that matches nothing shows "No results".
- Inside the email composer, Cmd+K inserts a link and does not open the palette (`components/compose/RichTextEditor.tsx:70-75`). Inside the chat box it opens the palette.

#### STORY-APP-009: Maya hides the sidebar, then uses Praci on her phone

**Type**: short
**Topic**: Hide and show the sidebar
**Persona**: Founder between meetings
**Goal**: "More room for the chat; later, check Chief from my phone."
**Preconditions**: Shared seed.
**Ideal path**: 2 per device.
**Alternate paths**: Drag the sidebar's right edge (STORY-APP-122); phone details in STORY-APP-121.

##### Steps
1. On a laptop, clicks the panel icon at the top right of the sidebar ("Hide sidebar") (`pages/Shell.tsx:3376-3385`). The sidebar slides away. Her choice is saved for her account on this browser (`setBotsSidebarCollapsedPref`, `:2735-2738`).
2. Finds the panel-open icon ("Show sidebar") at the left of the chat header (`:4229-4238`) and clicks it. The sidebar returns. **Hesitation:** labels now say "sidebar", not "bots", which fixes the old mismatch with Inbox and Finance being inside.
3. At 390 px width the sidebar is a drawer. The header shows a menu icon ("Open navigation") (`:4220-4228`). She taps it, taps Inbox; the drawer closes (`:3472-3482`).
4. Taps the dark strip right of the drawer ("Close navigation", `:3335`) to close it without choosing.

##### Edge Cases
- Reloading keeps the hidden state. A different user on the same browser has their own state.
- When the window grows past 768 px with the drawer open, the drawer state resets (`:695-702`).

### Stories: Sidebar details

#### STORY-APP-116: Maya reorders her bots and tames a long sidebar

**Type**: medium
**Topic**: Sidebar ordering and sections
**Persona**: Naive first-time founder with 8 bots
**Goal**: "Put Chief first and the Finance helper under it."
**Preconditions**: 8 MOCK bots; section "MOCK Ops"; one bot has child bots (a bot that created sub-bots).
**Ideal path**: 2 — drag a row up.
**Alternate paths**: Alt+Up/Alt+Down on a focused row; "Pin" and "Move to" in the row menu (part B, STORY-APP-010).

##### Steps
1. Drags "MOCK Finance helper" above "MOCK Hiring helper". The row dims while dragging (`pages/Shell.tsx:3759-3800`). On drop the new order is applied at once and saved (`reorderRosterBot`, `:1753-1766`).
2. Tries to drag a bot into the "MOCK Ops" section. The drop is ignored; drags only work among rows with the same parent and in the same group (`:3770-3795`). She finds "Move to" in the row menu instead. **Hesitation:** the drag handle gives no hint of what is allowed.
3. Clicks the heading "MOCK Ops". The section collapses; the chevron turns and the state is saved per user (`:3590-3600`, `toggleSidebarSection`). Aria label: "Collapse MOCK Ops".
4. Sees a small chevron beside a bot with children. Clicks it ("Collapse {name}"). The children hide; indentation shows the tree (`:3730-3755`).
5. Focuses a row with Tab and presses Alt+ArrowDown. The row moves one place down among its siblings (`:3795-3812`). The row declares `aria-keyshortcuts` for it.

##### Variations
- Failure to save the order silently rolls back when nothing newer is queued (`:1728-1750`); the row jumps back with no message.

##### Edge Cases
- Archived bots, and group rows, cannot be dragged (only bots are draggable, `:3759`).
- Right-click on the "MOCK Ops" heading offers "Rename section" (`:3600-3620`).

#### STORY-APP-117: Maya has two spaces and the sidebar changes shape

**Type**: medium
**Topic**: Sidebar with several spaces
**Persona**: Naive first-time founder
**Goal**: "Keep my side project away from Northwind."
**Preconditions**: A second space "Side project" with one bot; the user is in the first space.
**Ideal path**: 2 — click a bot in the other space.
**Alternate paths**: none found.

##### Steps
1. Sees space names as small upper-case headings with a lock icon, such as "NORTHWIND ROBOTICS · MOCK OPS" for a section, and a separate heading for the second space (`pages/shell/space-sidebar.ts:50-66`, `Shell.tsx:3580-3640`). With only one space, none of this shows. **Hesitation:** the space heading doubles as a collapse button, and the section text is joined to the space name with "·", which gets long.
2. Clicks a bot in the Side project space. If it is another space, the whole page reloads at that bot's URL so every request carries the right space (`openSpaceChat`, `:1710-1725`). She sees a brief skeleton ("Opening your Space…").
3. Clicks "Actions for Northwind Robotics" (the "..." button at the heading) to rename or delete the space (`:3665-3690`).
4. An empty space shows only its heading. Clicking it opens that space's onboarding (`group.emptySpaceId`, `:3590-3595`).

##### Edge Cases
- While searching, spaces with no matching rows disappear (`space-sidebar.ts:82`).
- Right-click on a space heading opens the space menu; on a section heading it opens the section menu.

#### STORY-APP-118: Maya looks for "Add page" in the sidebar

**Type**: short
**Topic**: Sidebar Add page row (dormant)
**Persona**: Naive first-time founder who has heard "you can add pages"
**Goal**: "Add a team health page."
**Preconditions**: Production build as of this commit.
**Ideal path**: 2 — click "Add page" and choose "Team health". The row does not appear.
**Alternate paths**: none found.

##### Steps
1. Looks between "Artifacts" and the bot list. Nothing is there. The component `SidebarPages` is rendered (`pages/Shell.tsx:3532`) but shows no "Add page" row, because its only template, "Team health", is marked `available: false` (`packages/contracts/src/sidebar-pages.ts:4-11`), so the list is never loaded (`components/SidebarPages.tsx:38-41`) and `AddSidebarPage` renders nothing when it has no choices (`AddSidebarPage.tsx:25`).
2. If a template were available, the row would show a plus, "Add page", and a menu with the page name and a one-line description. Added pages would appear as links with a "Page options" menu and "Remove from sidebar" (`SidebarPages.tsx:91-116`).
3. Types `/app/team-health` in the address bar. The route `/app/:botId` takes "team-health" as a bot id, finds nothing, and moves her to the first bot (`Shell.tsx:1130-1133`).

##### Edge Cases
- This story records an absence. When a template ships, the dependent stories are: add page, remove page (with redirect to `/app` if it is open), owner-only restriction, and desktop-only restriction.

#### STORY-APP-119: Maya uses sidebar search to reach a page, a document and mail

**Type**: medium
**Topic**: Sidebar search, result types
**Persona**: Naive first-time founder
**Goal**: "Get to the Seed SAFE file without remembering where it lives."
**Preconditions**: Shared seed; mail with "SAFE" in the subject.
**Ideal path**: 2 — type, click.
**Alternate paths**: Data room's own search; Inbox's own search.

##### Steps
1. Types "cap". The "Pages" section lists "Cap table" (`pages/Shell.tsx:1801-1806`, `SpaceSearch.tsx:97-102`). Clicks it; the box clears and the page opens (`openAppPage`).
2. Types "settings". "Pages" lists "Settings". Clicking it opens the Settings dialog (not a page), and the search box clears (`:1814-1819`).
3. Types "SAFE". "Documents" lists up to 5 Data room files by name or content (`:1830-1840`). She clicks one; Data room opens with it selected.
4. Clicks "Search mail for “SAFE”". The Inbox opens filtered by the text. **Hesitation:** the Mail row is always shown, even when she is not looking for mail.
5. Dollar amounts in labels are hidden when "Hide amounts" is on (`SpaceSearch.tsx:22-34`).

##### Variations
- A failure of the document request hides only the Documents section (`:1836-1838`).
- Types a bot's name: bots have no results section of their own. The bot list is hidden while the box has text (`:3532-3552`), so she reaches a bot only through a "Chat" hit, which shows the bot name beside the snippet.

##### Edge Cases
- Pressing Escape clears the box only when it has text (`:3445-3450`).

#### STORY-APP-120: Maya uses the palette for groups, pages and numbered bots

**Type**: medium
**Topic**: Command palette depth
**Persona**: Founder who learned Cmd+K and wants speed
**Goal**: "Reach the Leadership group and Integrations in seconds, without the mouse."
**Preconditions**: Shared seed; 3 bots; 1 group. Windows laptop for the variation.
**Ideal path**: 2 per target.
**Alternate paths**: Sidebar clicks.

##### Steps
1. Presses Ctrl+K. The dialog opens. Bots are listed with Ctrl1, Ctrl2, Ctrl3 on the right; the group and pages have no shortcut (`command-palette.tsx:60-62,140-155`).
2. Types "lead". The Leadership group appears under "Groups" with its avatar stack. Presses Down and Enter. The group chat opens at `/app/g/<id>` and the sidebar drawer closes if it was open (`Shell.tsx:5162-5180`).
3. Opens the palette, types "integ". Enter on "Integrations" under "Pages" opens that page.
4. With the palette open, presses Ctrl+2. The second bot opens even if the list is showing different rows (`:68-83`). **Hesitation:** the numbers follow the unfiltered bot order, so "Ctrl2" may point to a different bot than the second row she sees.
5. Presses Escape to close. The dialog title for screen readers is "Go to" with the description "Search pages, bots and groups".

##### Variations
- Mac: shows "⌘1". The modifier is detected from the browser platform (`:25-30`).
- On a phone there is no hardware keyboard; the palette cannot be opened (no on-screen button). She uses the drawer instead.

##### Edge Cases
- Archived bots and the Settings subsections (Models, Usage) are not listed.
- The palette stays above the chat box; a draft message in the box is kept.

#### STORY-APP-121: Maya opens the drawer on her phone and swipes

**Type**: medium
**Topic**: Phone drawer
**Persona**: Founder on a 390 px phone
**Goal**: "Switch from Chief to Inbox with my thumb."
**Preconditions**: Shared seed; phone width; touch input.
**Ideal path**: 2 — menu icon, Inbox.
**Alternate paths**: Swipe right from the left edge.

##### Steps
1. Opens `/app`. No sidebar is visible. The header shows a menu icon ("Open navigation") and Chief's name (`pages/Shell.tsx:4220-4228`). The "Hide sidebar" icon is absent on a phone (`hidden md:inline-flex`, `:3378`).
2. Taps the menu icon. The sidebar slides in, 316 px at most and 48 px narrower than the screen, with a dark strip on the right (`:3335-3340`). The chat behind it is inert and hidden from screen readers (`:4195-4199`).
3. Taps Inbox. The drawer closes and Inbox loads (`:3472-3482`).
4. Back on Chief, puts a finger within 32 px of the left edge and swipes right by at least 56 px, moving more sideways than up or down (`:3282-3321`, constants at `:380-381`). The drawer opens. **Hesitation:** nothing hints at the swipe.
5. Taps the dark strip to close ("Close navigation").

##### Variations
- Left-to-right languages only; in right-to-left languages the swipe starts at the right edge (`:3290-3295`).
- Opening a bot, group, search result or Activity run from the drawer also closes it.

##### Edge Cases
- The row "..." menu button is hidden on touch (`pointer-coarse:hidden`, `:3956`); long-press (browser context menu event) is the only path. On iOS Safari this may not fire. Unverified in a real browser.
- Rotating to landscape wider than 768 px resets the drawer (`:695-702`).

#### STORY-APP-122: Maya drags the sidebar edge and uses the keyboard to show it again

**Type**: short
**Topic**: Sidebar edge handle
**Persona**: Founder with a mouse
**Goal**: "Collapse the sidebar quickly."
**Preconditions**: Desktop width; sidebar open.
**Ideal path**: 1 — click or drag the thin line at the sidebar's right edge.
**Alternate paths**: Panel icon (STORY-APP-009).

##### Steps
1. Moves the pointer to the right border of the sidebar (an invisible 8 px strip with a resize cursor, `pages/Shell.tsx:4150-4190`). Drags left. After a short distance the sidebar hides. A click without movement toggles it too. **Hesitation:** the strip has no visible handle; she finds it by accident.
2. The collapsed sidebar is `inert`: nothing in it can be focused (`:3344`). The same edge now sits at the window's left edge. Dragging right shows it.
3. Tabs to the edge control: it is a button named "Show sidebar" or "Hide sidebar" with a pressed state, so keyboard users can toggle it with Enter or Space.

##### Edge Cases
- Hidden while the full-screen computer view is open (`computerOpen || booting`), so the edge never steals clicks there (`:4150`).

#### STORY-APP-123: Maya moves around with only the keyboard

**Type**: medium
**Topic**: Keyboard navigation
**Persona**: Founder who dislikes the mouse
**Goal**: "Open Inbox, then Chief, then search for 'runway', without the mouse."
**Preconditions**: Shared seed; desktop width.
**Ideal path**: 6.
**Alternate paths**: Palette only (STORY-APP-120).

##### Steps
1. Tabs through the sidebar top row: Activity, Hide sidebar, Create (+), the search box, then Inbox, Finance, Cap table, Data room, Artifacts as buttons, then the bot rows (`Shell.tsx:3354-3531`).
2. Presses Enter on Inbox. The page opens. Focus stays on the link.
3. Presses Cmd+K, types "chief", presses Enter. Chief opens.
4. Presses Tab until the search box, types "runway", reads the results with Tab and Enter. Escape clears.
5. On a bot row, presses Alt+ArrowUp to move it (`:3795-3812`).
6. Opens the "..." row menu with Tab then Enter (button is visible on keyboard focus, `:3956`) and closes it with Escape; focus returns to the row (`:716-722`).
7. **Hesitation:** no skip link; she tabs through about 15 controls to reach the chat box.

##### Edge Cases
- The collapsed sidebar is skipped by Tab (`inert`).

### Stories: Notifications and Activity

#### STORY-APP-124: Maya clicks the bell and finds a list of runs, not notifications

**Type**: medium
**Topic**: Activity list
**Persona**: Naive first-time founder
**Goal**: "See what needs me and what finished."
**Preconditions**: Activity seed: 1 running run (Finance helper), 1 "Needs input" run (Chief), 4 finished runs.
**Ideal path**: 2 — click the bell, click the row that needs her.
**Alternate paths**: Open each bot in turn.

##### Steps
1. Hovers the bell: tooltip "Activity" (`pages/Shell.tsx:3354-3376`). Clicks it. The bell turns solid (dark circle) and an "Activity" block appears above the bot list; the bot list is still there beneath it. She expected a drop-down of notifications. **Hesitation:** the earlier catalog said the bot list was replaced; the code now puts the Activity block above it (`:3552-3560`).
2. Sees the block with sections that only show when they have rows: "Needs you" (Chief, "Needs input"), "Working" (Finance helper, "Running"), "Finished" (the four done runs) (`pages/ActivityList.tsx:164-178`). Each row has a colored dot, the bot name (with " · group name" if it ran in a group), a time like "5m ago", a snippet of the request and a status word (`:392-420`). Amber is for waiting, red for failed, green for done.
3. Clicks the "Needs input" row. The app opens Chief's chat (or the group's chat) and the drawer closes on a phone (`Shell.tsx:3553-3560`). The answer to Chief's question is waiting there.
4. The list refreshes itself every 15 seconds (`ActivityList.tsx:57-58`). The mode stays on after a reload (`lib/activity-mode.ts`).
5. Clicks the bell again. The block disappears; only the bot list remains.

##### Variations
- Status words: Queued, Starting, Running, Needs input, Needs takeover, Done, Failed, Cancelled (`:430-450`).
- Run in a group: the title reads "MOCK Finance helper · Leadership".

##### Edge Cases
- The load fails: an alert with the reason and "Try again" (`:235-240`).
- A run on a bot the user archived still appears.

#### STORY-APP-125: Maya filters the Activity list and meets its empty states

**Type**: short
**Topic**: Activity list, filters and empty states
**Persona**: Founder with many runs
**Goal**: "Find the failed run from Tuesday."
**Preconditions**: Activity mode on; 30 MOCK runs of mixed status.
**Ideal path**: 3 — Filter, Status = Failed, click row.
**Alternate paths**: Type in "Search runs".

##### Steps
1. Clicks "Filter" at the right of the block (`ActivityList.tsx:136-148`). A form opens: "Search runs", "Status" (All statuses, and each status), "From" and "To" dates (`:255-325`).
2. Chooses Status "Failed". The list narrows and a chip appears: for example "Search: refund" or "From 2026-10-13" with a clear (x) button each; "Reset all" clears every filter (`:335-372`).
3. Picks a date range that matches nothing. The text "No runs match these filters." shows (`:158-162`).
4. With no runs at all and no filters, the whole block reduces to one line, "Nothing needs you right now." with a bottom rule (`:112-122`). **Hesitation:** "Nothing needs you" reads as a verdict, even though recent finished runs may exist once the first run happens; with zero history it is accurate.

##### Edge Cases
- Filters reset when she turns Activity off and on (state is local to the block).
- While loading the first time: "Loading activity…".

#### STORY-APP-126: Maya switches tabs while Chief works and gets a browser notification

**Type**: medium
**Topic**: Browser notifications
**Persona**: Naive first-time founder
**Goal**: "Tell me when Chief is done so I can do something else."
**Preconditions**: Notification permission "default"; Chief has "Notifications" on (default for new bots, `Shell.tsx:2752`); desktop browser.
**Ideal path**: 2 — allow once, get a notification.
**Alternate paths**: Per-bot "Notifications" switch in bot Settings (part B).

##### Steps
1. Sends Chief a long request ("Draft a 6-month cash forecast"). At that moment the browser asks "Show notifications?" (`Shell.tsx:2350-2356`, `lib/browser-notifications.ts:15-35`). **Hesitation:** the prompt appears without any in-app explanation, right as she presses Enter. She allows it.
2. Switches to another tab. When Chief posts a reply, a system notification shows with the bot's name as title and the reply text (Markdown removed; currency masked if "Hide amounts" is on) as the body (`browser-notifications.ts:71-105`).
3. The same applies when a run fails ("Chief failed", "Failed.") or is cancelled ("Chief stopped", "Stopped.") (`:47-61,106-123`).
4. Comes back and clicks the notification. The code attaches no click handler (`Shell.tsx:1016`), so what the click does (focus the tab or not) depends on the browser.
5. While the tab is visible and the window focused, no notification is sent; she sees the reply in the chat (`browser-notifications.ts:64-68`).

##### Variations
- Group chats always notify, regardless of the per-bot switch (`Shell.tsx:1011`, `groupNotification`).
- If permission is still "default" when a reply lands, the notification waits and is sent after she answers the prompt (`:1056-1066`).

##### Edge Cases
- Only the bot or group she is looking at is watched. The notification stream is tied to the open chat (`Shell.tsx:1521,1652`, `shouldNotifyBrowser` checks the thread). If she leaves Chief for Finance or Inbox (which open their own agents) she hears nothing about Chief. A "Needs input" prompt is not a notification event at all; only bot messages, failures and cancellations are. See Suspected problems.
- No in-app unread count outside the sidebar dot and the Inbox badge; no sound; the tab title does not change.

#### STORY-APP-127: Maya blocked notifications and later wants them

**Type**: short
**Topic**: Browser notifications, denied
**Persona**: Naive first-time founder
**Goal**: "Turn alerts on again."
**Preconditions**: Browser permission "denied" (she clicked Block earlier).
**Ideal path**: 3 — find a setting that explains how.
**Alternate paths**: Browser's site settings.

##### Steps
1. Sends a message. No prompt appears; the app sees "denied" and does nothing (`Shell.tsx:1056`).
2. Switches tabs; Chief answers; nothing happens.
3. Looks in Settings for a notifications section. None exists: Settings lists General, Models, Memory, Voice, Usage, Computer, Billing, Updates (`pages/SettingsOverlay.tsx:137-150`). Bot Settings has a "Notifications" switch, but turning it on does not change the browser block. **Hesitation:** the switch says on while the browser says no; nothing explains.
4. Must open the browser's lock icon and allow notifications for the site.

##### Edge Cases
- On a phone browser notifications are generally unavailable; the app silently skips (`typeof Notification === "undefined"`, `Shell.tsx:1056`).

### Stories: Hide amounts

#### STORY-APP-128: Maya hides amounts before sharing her screen

**Type**: medium
**Topic**: Hide amounts toggle
**Persona**: Founder presenting to a new hire
**Goal**: "Show the product without showing our cash."
**Preconditions**: Finance with MOCK balances; Cap table with MOCK holdings; a Chief message with "$412,300 runway cash"; Activity and sidebar previews contain currency amounts.
**Ideal path**: 2 — click Hide amounts once.
**Alternate paths**: Header eye button on Finance and Cap table; account menu row anywhere.

##### Steps
1. Opens Finance. Next to the title "Finance" (and the space name) is an eye icon (`components/finance/ui.tsx:232`, `pages/Finance.tsx:378`). Hovers: tooltip "Hide amounts. Hides amounts on finance screens and masks currency amounts in chat text. Plain numbers in agent replies may still show." (`components/HideAmountsToggle.tsx:7-8,24-30`).
2. Clicks it. Amounts on the page are masked; the icon changes to an eye-off and the tooltip becomes "Show amounts" (`:13-22`). Charts show "Chart hidden while amounts are hidden" instead of a plot (`pages/shell/message-cards.tsx:238-249`).
3. Goes to Cap table. The same eye button is in its header (`pages/CapTable.tsx:589`); it is already on.
4. Goes to Chief. Currency amounts in messages are masked, and so are sidebar previews, search results and notification bodies (`Shell.tsx:3715-3720`, `SpaceSearch.tsx:22-34`, `browser-notifications.ts:85`). Plain numbers without a currency sign (such as "412300") may still show, as the tooltip warns.
5. On Inbox or Data room there is no eye button in the page header. She opens the account menu (initials at the bottom) and finds a row "Hide amounts" with the same helper text underneath (`HideAmountsToggle.tsx:38-62`, `Shell.tsx:4118`). The menu closes after she clicks.
6. Reloads. The setting persists in this browser (`lib/hide-amounts-preference.ts:7,16-24`). **Hesitation:** it is a browser setting, not an account setting. On a second computer amounts show again.

##### Variations
- Turn off: the same control now reads "Show amounts".

##### Edge Cases
- Storage blocked: the choice applies only until reload (`:26-34`).
- No masking code was found for file names ("Q3 burn $412k.pdf") or for the content of HTML artifacts and PDFs. Treat those as visible.

### Stories: Artifacts

#### STORY-APP-129: Maya browses Artifacts and filters the list

**Type**: medium
**Topic**: Artifacts list
**Persona**: Naive first-time founder
**Goal**: "See every file my assistants made and find the board deck."
**Preconditions**: 6 MOCK artifacts from two bots (Chief and the Finance helper).
**Ideal path**: 2 — open Artifacts, click the card.
**Alternate paths**: Search box in the sidebar does not search artifacts.

##### Steps
1. Clicks "Artifacts" in the sidebar. The page title "Artifacts" appears with a "Filters" button and a pair of view buttons, "Card view" and "List view" (`pages/Artifacts.tsx:210-262`). Cards are in a grid: file icon, the name, up to two lines of description, a short file-type badge, and "v3" when there are several versions, the bot's avatar and name, and a relative time (`:621-688`).
2. Clicks "List view". Rows replace cards; her choice is remembered (`localStorage rakazo:artifacts-view-mode`, `:46-65`).
3. Clicks "Filters". A search box "Search artifacts…", a date menu ("All time", "Today", "This week", "This month") and chips "All bots" plus one per bot appear (`:262-290`). Types "board" in the search box; the list narrows. Clicks the "MOCK Finance helper" chip; the list reloads for that bot only (`:111-128`).
4. Clicks the card "Board deck.pdf". It opens (STORY-APP-130).

##### Variations
- A list of more than 60: "Load more" at the bottom fetches the next page (`:130-153,436-444`). A filter that finds nothing on loaded pages keeps loading pages automatically (`:175-186`).
- Phone: the grid becomes one column; the filter chips wrap.

##### Edge Cases
- The date filter and search only see loaded pages; with a next page waiting and no match the message is "No matching artifacts on this page." with a "Load more" button (`:455-478`).
- Bot filter chips list all bots, including ones that have never made a file.

#### STORY-APP-130: Maya opens an artifact, switches versions and downloads it

**Type**: medium
**Topic**: Artifact preview
**Persona**: Naive first-time founder
**Goal**: "Read the investor update, compare with the older draft, and send it to my accountant."
**Preconditions**: "Q3 investor update draft" with 3 versions (Markdown). A PDF and an HTML artifact exist.
**Ideal path**: 3 — open, read, Download.
**Alternate paths**: Download from the chat file card (STORY-APP-133).

##### Steps
1. Clicks the card. The URL becomes `/app/artifacts/<id>`. The list shrinks to a narrow column at the left (320 px) and the document opens at the right (`pages/Artifacts.tsx:296-320`). The Filters button stays; the view toggle disappears while a file is open.
2. The document header shows the name, description, a "Version" menu ("v3 · 2d ago", "v2 · 5d ago", "v1 · 9d ago"), "Download" and a maximize square (`:776-880`). Markdown renders as a reading column.
3. Selects "v2". The page reloads that version (`:790-815`).
4. Clicks "Maximize" (tooltip). The list hides; the label becomes "Show list". Clicks it again to return.
5. Clicks "Download". The browser saves `Q3 investor update draft` with the original type (`lib/artifact-open.ts:25-32`). No extension is added to the name if the artifact name lacks one. **Hesitation:** on Windows, a file with no extension opens in the wrong app.
6. Opens the HTML artifact. A dark pill at the bottom right reads "Isolated preview — no access to your account" (`:905-918`), and the page runs in a sandbox (`components/SandboxedHtmlViewer.tsx`).

##### Variations
- PDF: shown in the PDF viewer. Images: centered, scaled. Other types: "Preview isn't available for this file type — download it to view it." (`:945-949`).
- Phone width: see Suspected problems (the 320 px list column).

##### Edge Cases
- The file fails to load: red box "Could not load this artifact." (`:830-836`).
- The versions list fails: the page still opens the newest version silently.
- Deleted by someone else while open: the load error appears.

#### STORY-APP-131: Maya deletes an old artifact

**Type**: short
**Topic**: Artifact delete
**Persona**: Naive first-time founder
**Goal**: "Remove the draft I do not want."
**Preconditions**: Artifact with 3 versions; mouse.
**Ideal path**: 2 — trash icon, confirm.
**Alternate paths**: none found.

##### Steps
1. Hovers a card or row. A small trash icon fades in at the bottom right of the card or at the right of the row ("Delete {name}") (`pages/Artifacts.tsx:670-686,738-744`). It also shows when the card has keyboard focus.
2. Clicks it. A dialog: "Delete "Q3 investor update draft"?" and "This deletes all 3 versions of this artifact. This can't be undone." For a one-version file: "This can't be undone." Buttons "Cancel" and "Delete" (`:329-370`). **Hesitation:** deletion removes every version, not only the one on screen.
3. Clicks "Delete". The button reads "Deleting…". On success the card disappears; if that artifact was open, the page returns to `/app/artifacts` (`:191-206`).

##### Edge Cases
- Failure: red text in the dialog, "Could not delete this artifact." or the server reason; the dialog stays open (`:198-202`).
- While deleting, Cancel and Escape are disabled (`:353-358`).
- On a touch screen there is no hover; the icon is invisible until focused (no touch rule in `:681,740`). See Suspected problems.

#### STORY-APP-132: The Artifacts page is empty, slow or broken

**Type**: short
**Topic**: Artifacts states
**Persona**: New founder, day 1
**Goal**: "Check if the assistant made anything yet."
**Preconditions**: A new space with no artifacts; later, a failing network.
**Ideal path**: 1 — a clear empty message.
**Alternate paths**: none found.

##### Steps
1. Opens Artifacts. "Loading…" shows in the middle, then "No artifacts found." (`pages/Artifacts.tsx:371-385,455-462`). **Hesitation:** nothing says what an artifact is or how to get one ("ask Chief to write a document"). She leaves the page.
2. With the network cut, the middle shows the error text "Could not load artifacts." instead of Loading (`:122,371-380`). There is no Retry button; she reloads the page or picks a bot chip, which triggers a new request.
3. Applies a bot chip that has no files: "No artifacts found."

##### Edge Cases
- "Load more" failing is silent; the button just becomes active again (`:143-147`).

#### STORY-APP-133: Maya previews and downloads a file from Chief's chat

**Type**: medium
**Topic**: Chat file card
**Persona**: Naive first-time founder
**Goal**: "Read the term sheet summary Chief just wrote, and keep a copy."
**Preconditions**: Chief's message ends with three file cards: "board-update.md" (Markdown), "runway.html" (HTML), "notes.xlsx" (not previewable).
**Ideal path**: 1 — click the card.
**Alternate paths**: Artifacts page (STORY-APP-130).

##### Steps
1. Sees a rounded card with a file icon, the name and a size like "12 KB", and a download arrow on the right (`components/ArtifactFileCard.tsx:60-108`). Clicks the left side. A large dialog opens with the file name, a download icon and "Close preview" (X) (`:111-190`). Markdown renders as text; HTML runs in a sandbox; PDF in the PDF viewer.
2. While loading: "Loading preview…". Clicks the download arrow in the dialog; the file saves.
3. Closes the dialog. Focus returns to the card.
4. For "notes.xlsx" the card has no arrow and no preview. It shows the name and "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet · 8 KB"; clicking it downloads (`:45-70`). **Hesitation:** the raw MIME type is shown and nothing says "click to download".

##### Edge Cases
- Download fails: red "Could not download notes.xlsx. Try again." under the card (`:38,222-228`).
- A Markdown or HTML file that is not valid UTF-8: "This file is not valid UTF-8 text." (`:143`).
- Preview fails: "Could not load this file." (`:150`).

### Stories: Agent and settings panels at phone width

#### STORY-APP-134: Maya asks the Inbox agent from her phone

**Type**: medium
**Topic**: Page agent panel, phone
**Persona**: Founder on a 390 px phone
**Goal**: "Ask 'what needs a reply?' without losing the inbox."
**Preconditions**: Phone width; Inbox with 20 messages; Inbox agent exists.
**Ideal path**: 3 — tap Ask, type, close.
**Alternate paths**: Finance and Cap table behave alike.

##### Steps
1. Opens Inbox via the drawer. The page shows the list. The agent panel is closed by default and is not remembered open on a phone (`pages/Shell.tsx:487-505`). A button "Ask" with a message icon sits in the page header (`components/AskBotButton.tsx:6-22`, `pages/Inbox.tsx:712`).
2. Taps "Ask". A panel slides over the page from the right, full width up to 384 px (`pages/ResizableSidePanel.tsx:81`). The panel header shows the bot's name and a "Collapse Inbox agent" button (`Shell.tsx:4395-4412`). Inside is the introduction with suggested questions such as "What needs a reply from me today?" (`:2699-2704`).
3. Taps a suggestion. The question is sent and the agent answers in the panel. The inbox is hidden behind it.
4. Taps "Collapse Inbox agent" (a panel-close icon). The inbox is back.
5. Finance works the same with "Collapse Finance agent"; Cap table with "Collapse Carta agent", plus "Try again" if creating the agent failed (`:2706-2735`).

##### Variations
- If no Inbox agent exists, the panel shows a single "Create Inbox agent" button (`:4430-4441`).
- Resizing a desktop window narrower than 768 px collapses the Inbox and Cap table panels so they do not cover the page; the saved preference stays for the desktop (`:2682-2685`, `lib/carta-agent.ts:89-101`).

##### Edge Cases
- Cap table without Carta connected: the panel stays shut; the page shows its own connect card.
- On a phone the panel hides the Ask button underneath, so closing is only through the panel's own button.

#### STORY-APP-135: Maya opens a bot's settings, page or computer on her phone

**Type**: short
**Topic**: Bot panels, phone
**Persona**: Founder on a phone
**Goal**: "Rename the Hiring helper."
**Preconditions**: Phone width; MOCK Hiring helper chat open.
**Ideal path**: 3 — tap the name, edit, close.
**Alternate paths**: none found.

##### Steps
1. Taps the bot name in the chat header (`data-testid="bot-settings-trigger"`, `pages/Shell.tsx:4243`). The settings panel covers the whole chat, like the page agents. Its top line reads "Settings" with a small gear and an X ("Close panel") (`:4455-4505`).
2. Edits the name, taps Save (part B, STORY-APP-010). Taps X. The chat returns.
3. Other header icons open other panels the same way: "Page" (only if the bot has a page), "List" (pins), and the bot computer icon (title "Bot computer") (`:4268-4310`). The computer panel shows a preview and "Open" for full screen.
4. The group "Group settings" panel is the same pattern (part B).

##### Variations
- On a wide window these panels sit beside the chat; a draggable divider changes their width (STORY-APP-136). The panel kind is remembered per bot and returns after reload on wide screens (`pendingPanelRestore`, `:2890-2950`).
- The List icon is hidden on very wide screens when no panel is open, because the list is shown inline there (`:4293`).

##### Edge Cases
- Panel and drawer cannot be open together: the main area is inert while the drawer is open (`:4198`).

#### STORY-APP-136: Maya resizes the side panel with mouse and keyboard

**Type**: short
**Topic**: Resizable side panel, desktop
**Persona**: Founder with a laptop
**Goal**: "Make the Finance agent panel wider."
**Preconditions**: Desktop width; any panel open.
**Ideal path**: 1 — drag the divider.
**Alternate paths**: Keyboard.

##### Steps
1. Moves the pointer onto the left edge of the panel (an 8 px strip with a column-resize cursor) and drags left. The panel width changes live, between 320 and 1000 px, and never leaves less than 320 px for the chat (`pages/ResizableSidePanel.tsx:5-18,84-111`).
2. Focuses the divider with Tab (named "Resize panel") and presses Left or Right arrows: 32 px per press; Home sets the minimum; End the maximum (`:115-126`).
3. Reloads. The width is saved in the browser (`rakazo:right-panel-width`, `:5,48-54`).
4. Hides the sidebar: the maximum width grows by the sidebar's 316 px (`:41,56-63`).

##### Edge Cases
- Not shown on a phone (the divider is `hidden md:block`, `:91`).
- A saved width wider than the new window is clamped; the stored value stays.

### Stories: Window chrome and updates

#### STORY-APP-137: Maya uses the desktop app on Windows

**Type**: short
**Topic**: Window chrome
**Persona**: Founder using the Windows desktop build
**Goal**: "Close or minimize the window."
**Preconditions**: Desktop app on Windows or Linux (frameless window); macOS for comparison.
**Ideal path**: 1 — click a window control.
**Alternate paths**: Keyboard shortcuts of the OS.

##### Steps
1. In the app shell, three small colored circles sit at the top left of the sidebar: red "Close", yellow "Minimize", green "Fullscreen" (`pages/WindowChrome.tsx:18-35`, placed at `Shell.tsx:3354`). Clicking each calls the window action. On macOS the real traffic lights show and the app only leaves a 72 px gap (`:13-17`, `desktop/src/window-options.ts:20-24`).
2. Hides the sidebar. The circles move into the chat header, left of the Show sidebar icon (`Shell.tsx:4219`).
3. Opens the Welcome page signed out: circles are there too (`pages/Welcome.tsx:9-11`).
4. Opens `/sign-in`, `/sign-up`, the paywall or onboarding. No circles, no drag area (`AuthFrame` in `pages/Auth.tsx:430-453` has none; `Onboarding.tsx` has none). **Hesitation:** on a frameless Windows window she cannot close or move the window from these screens. Not verified on a real desktop; see Suspected problems.

##### Edge Cases
- In a normal browser the circles are replaced by an invisible spacer.

#### STORY-APP-138: The desktop app offers an update

**Type**: short
**Topic**: Desktop updates
**Persona**: Founder using the desktop app
**Goal**: "Get the latest version without losing my chat."
**Preconditions**: Desktop app; an update has been downloaded.
**Ideal path**: 2 — click "Restart to update".
**Alternate paths**: Settings → Updates → "Check for updates".

##### Steps
1. A small card appears at the bottom right with "Restart to update" and "Later" (`components/DesktopUpdates.tsx:88-120`). Its label is "Desktop update". The card appears on every screen, including sign-in, because the provider wraps the app (`main.tsx:61`).
2. Clicks "Later". The card hides for this version only (`:92,106-111`); a newer version shows again.
3. Opens Settings → Updates. The "Desktop app" block shows "v1.14.2" (MOCK) and a "Check for updates" button; the button reads "Checking…", "Downloading…" with a percent, or "Restart to update"; a line under it says "Up to date" after a check that finds nothing (`:132-170`, `pages/SettingsOverlay.tsx:144`).
4. Clicks "Restart to update". The app restarts. **Hesitation:** no warning about drafts or running bots. A running bot continues on its own computer.

##### Edge Cases
- A failed check/install shows the message in the card or under the button, and the card offers "Check for updates" again (`:46-68,92-95`).
- In the browser version none of this exists (the block returns nothing, `:128`).

#### STORY-APP-139: The server owner updates the self-hosted app

**Type**: short
**Topic**: Web software update
**Persona**: Maya as deployment owner
**Goal**: "Install the latest Praci."
**Preconditions**: Deployment owner; an update available.
**Ideal path**: 2 — Settings → Updates → update.
**Alternate paths**: none found.

##### Steps
1. Opens Settings → Updates. Under "Software update" the page shows "Up to date" or "Update available" with a button (`components/SoftwareUpdateSection.tsx`). Only the deployment owner sees the action.
2. Starts the update. The page shows progress, then "Waiting for the API to come back…", then "Updated".
3. Failure paths: "Update finished with errors", "Update failed", or "The API did not come back. Refresh this page.".

##### Edge Cases
- Non-owners see no update controls.

### Stories: Unknown URLs and error screens

#### STORY-APP-140: Maya mistypes a URL

**Type**: short
**Topic**: Not found
**Persona**: Naive first-time founder
**Goal**: "Open Finance by typing the address."
**Preconditions**: Signed in.
**Ideal path**: 2.
**Alternate paths**: none found.

##### Steps
1. Types `/app/financee`. The route `/app/:botId` accepts any text as a bot id, finds no such bot, and the app moves her to the first bot (Chief) and rewrites the address (`App.tsx:196`, `pages/Shell.tsx:1127-1133`). No message says the page was not found. **Hesitation:** she lands in a chat and wonders what happened.
2. Types `/app/finance/anything`: that matches the Finance route (`/app/finance/*`) and shows Finance's own "Not found" page inside Finance (`pages/finance/FinanceNotFound.tsx`).
3. Types `/pricing` or `/app/inbox/extra`: no route matches. React Router renders nothing and the page is blank apart from the background (`App.tsx:135-198`, no catch-all route). She must use Back or edit the address.
4. Types `/app/g/not-a-group`: she is moved to the first bot, again silently (`Shell.tsx:1122-1125`).

##### Edge Cases
- Signed out: every `/app...` address goes to `/sign-in` first.

#### STORY-APP-141: A part of the app breaks

**Type**: short
**Topic**: Error boundaries
**Persona**: Naive first-time founder
**Goal**: "Keep working even when something fails."
**Preconditions**: A network blip that fails to load a code chunk; a rendering error in one section.
**Ideal path**: 2 — read, press Refresh.
**Alternate paths**: Close the dialog and keep chatting.

##### Steps
1. Opens Settings while the browser cannot load that screen's code. A dialog titled "Could not load" with "Close" and "Refresh" appears over the chat (`components/ErrorBoundary.tsx:50-82`). Her typed draft and the chat stay. A browser keeps a failed module for the page's life, so only Refresh fixes it. **Hesitation:** the dialog gives no reason or advice like "check your connection".
2. Opens Integrations or Artifacts and the page crashes while rendering. A small red line "Could not load" shows where the page would be; the sidebar and the rest still work (`ErrorBoundary.tsx:31-37`, `Shell.tsx:4316-4332`).
3. A crash outside any inner boundary shows a full-screen "Something went wrong. Try again." with "Refresh" (`App.tsx:258-279`).

##### Edge Cases
- Clicking Refresh reloads and keeps the session.
- Finance and Cap table do not sit inside the small boundary, so a crash there goes to the full-screen error (`Shell.tsx:4333-4350` renders them directly).

#### STORY-APP-142: Maya's connection drops while the app is open

**Type**: short
**Topic**: Session unavailable
**Persona**: Founder on a train
**Goal**: "Keep my place."
**Preconditions**: Signed in; the session lookup fails to reach the server.
**Ideal path**: 1 — the app waits and recovers by itself.
**Alternate paths**: "Retry now".

##### Steps
1. The app shows "Reconnecting" with a spinner and "Can't reach the server." and a "Retry now" button (`App.tsx:232-253`). It does not send her to sign-in, because a failed lookup is not a sign-out (`App.tsx:204-208`).
2. The app retries with growing delays. She presses "Retry now" for an immediate retry (`:243-247`).
3. The connection returns; the app shows the shell again. If the session really ended, she is sent to `/sign-in`.

##### Edge Cases
- While the app is already open, a dropped connection is handled per feature (errors in chat, composer drafts kept); this screen appears only on the initial session lookup.

#### STORY-APP-143: Maya deletes every bot

**Type**: short
**Topic**: Empty sidebar
**Persona**: Naive first-time founder
**Goal**: "Start over."
**Preconditions**: A space with one bot and no groups; nothing archived; no other space with content.
**Ideal path**: 2.
**Alternate paths**: none found.

##### Steps
1. Archives and deletes the last bot. The refresh finds nothing and the app sends her to `/onboarding` (`pages/Shell.tsx:1106-1119`). She meets "Opening chat…" and a fresh Chief with its greeting.
2. If another space has content, she stays in the app. The main area shows a button "New bot" with a plus (`:4358-4366`); the header says nothing useful. Pressing it creates a bot named "New Bot" and opens its settings with the name selected.

##### Edge Cases
- If only archived bots exist, she stays in the app with an empty bot list and the "Archived" block (`:3975-3985`).

### Stories: End-to-end journeys

#### STORY-APP-144: Maya's first day, start to finish, on her phone

**Type**: long
**Topic**: Phone, whole first-run journey
**Persona**: Naive first-time founder, on a 390 px phone in a taxi
**Goal**: "Sign up, connect my email, ask one question, find the document Chief made, and sign out."
**Preconditions**: No account; Composio set up; a phone browser; pop-ups allowed.
**Ideal path**: 14 — sign up, 3 onboarding steps, 3 Chief steps, 5 navigation steps.
**Alternate paths**: Desktop (STORY-APP-001 and 145).

##### Steps
1. Opens the site. Welcome shows the logo, the tagline "Bots that run your inbox, cash, cap table and investor documents." and "Sign up →" / "Sign in" (`pages/Welcome.tsx`). Taps Sign up.
2. Fills Name, Email, Password on the Create your account form. The email keyboard opens (type email). Taps the eye to check the password. Taps "Create account" ("Working…").
3. "Loading…" then "Opening chat…". Lands in Chief's chat. The drawer is closed; the header shows a menu icon, Chief's name and the bot-computer icon.
4. Reads Chief's greeting and the focus card; taps A "Run my company". Sees a Gmail card and a Calendar card; taps "Authorize" on Gmail. The phone opens Google in a new tab or window; she approves and comes back. The card has changed to "Connected" if the polling tab kept running (the page polls every 2 s; browsers may pause timers in a background tab, which is untested here, so she might see "Waiting…" until she returns) (`message-cards.tsx:182-194`). **Hesitation:** unclear whether to wait.
5. Types "What should I look at first today?" with the on-screen keyboard and taps send. The reply streams.
6. Taps the menu icon. The drawer opens: bell, search, Inbox, Finance, Cap table, Data room, Artifacts, bots, Integrations, account. Taps Inbox; the drawer closes and the Inbox loads.
7. Taps "Ask" in the Inbox header; the Inbox agent covers the page; asks "What needs a reply today?"; collapses it (STORY-APP-134).
8. Opens the drawer, types "investor" in "Search chats", taps the Documents result. Data room opens.
9. Opens the drawer again and taps Artifacts. Opens a card, reads on a squeezed screen (see Suspected problems), taps Download.
10. Opens the drawer, taps her name, "Hide amounts" (she is about to show a friend), then "Log out". Lands on Welcome.

##### Variations
- Permission prompt for notifications appears at step 5 on browsers that support it; many phones do not.
- She rotates the phone to landscape at step 9; above 768 px the layout becomes the desktop one and the drawer state resets.

##### Edge Cases
- Network drops at step 3: "Could not create your bot", "Try again" (STORY-APP-112).
- Row "..." menu is not available on touch (STORY-APP-121); she cannot rename or delete a bot without long-press.

#### STORY-APP-145: Maya's Monday on the laptop: palette, search, Activity, hide amounts, artifacts

**Type**: long
**Topic**: Desktop, returning-user journey
**Persona**: Naive founder in week two
**Goal**: "Get ready for the board call: check what happened, find the update and deck, avoid showing cash on the shared screen."
**Preconditions**: Full seed; desktop width; notification permission granted; Activity seed.
**Ideal path**: 12.
**Alternate paths**: Mouse-only, with the sidebar.

##### Steps
1. Opens `/`. Already signed in, the app goes to `/app` and Chief (`App.tsx:136`).
2. Notices a dot beside "MOCK Finance helper" (unread) and the Inbox badge "3".
3. Clicks the bell. "Needs you" shows Chief "Needs input". Clicks it; Chief's chat opens with the question. Answers. Clicks the bell again to close the block.
4. Presses Cmd+K, types "cap", Enter. Cap table opens. Clicks the eye icon in its header ("Hide amounts") so the call does not show holdings.
5. Presses Cmd+K, types "arti", Enter. Artifacts opens. Switches to List view. Opens "Q3 investor update draft", picks version v3, reads it.
6. Clicks "Download". Saves the file.
7. Types "SAFE" in "Search chats". Clicks the Documents result "Seed SAFE.pdf". Data room opens with it selected.
8. Clicks "Search mail for “SAFE”" next time; the Inbox filters the mail.
9. Clicks "Hide sidebar" so the screen share shows only the chat. Opens Chief and sends "Draft the board update opening paragraph" (part B).
10. Switches to another tab; Chief finishes; a notification shows with the first lines of the reply, currency masked because Hide amounts is on (`browser-notifications.ts:85`).
11. Comes back, clicks "Show sidebar" in the header, opens the account menu, reads the Hide amounts row ("Show amounts"), turns it off after the call.
12. Logs out.

##### Variations
- If the call starts at once, she may press Cmd+K repeatedly; the palette toggles.

##### Edge Cases
- At step 3, the Needs input run belongs to a bot she archived; the row still opens its chat.
- At step 10, if she is looking at Finance instead of Chief, no notification arrives (STORY-APP-126).

#### STORY-APP-146: Maya, who installed Praci herself, sets up the whole server

**Type**: long
**Topic**: Self-hosted first run
**Persona**: Maya as both installer and first user
**Goal**: "Get my own Praci running for Northwind, with a model and apps."
**Preconditions**: Fresh deployment; no model; no Composio key; Maya is the first account (deployment owner); billing off.
**Ideal path**: 9.
**Alternate paths**: Configure integrations later in Settings.

##### Steps
1. Opens the site; Welcome; Sign up; fills the form; "Create account".
2. Sees "Connect a model" (STORY-APP-108). Picks the first provider, pastes a MOCK key, presses "Test API key", sees success, presses "Continue".
3. Sees "Server integrations" (STORY-APP-109). Picks "Popular apps through Composio", pastes an MOCK API key, "Connect". The row shows a "Connected" label (`IntegrationSetup.tsx:218`). Presses "Continue".
4. "Opening chat…", then Chief with the greeting and focus card. Picks "Run my company".
5. Chief shows Gmail and Calendar cards because the catalog is now available. Authorizes Gmail.
6. Opens the sidebar's Integrations page; sees Gmail connected.
7. Opens the account menu → Settings → Updates (owner sees "Software update", STORY-APP-139).
8. Invites no one: there is no members screen (part B, STORY-APP-023).
9. Logs out and in again to confirm the account works; lands on `/app`.

##### Variations
- She skips "Server integrations": Chief shows no app cards for the focus choice and instead posts the note or "What would you like to work on first?" (`onboarding.ts:327-332`). She must set up the catalog from Integrations ("Set up app catalog", part B).
- She skips the model (not possible): "Continue" is disabled until a model is ready.

##### Edge Cases
- A wrong MOCK key: "Test API key" reports a failure and Continue stays possible; saving may still fail with "Could not save model".

### Redundancy Candidates (this area)

- **Seven search boxes with different scopes.** Sidebar "Search chats" (chats, pages, documents, a mail row), the palette's "Search" (bot, group and page names only), the "+" picker's "Search" (bots), Inbox "Search mail", Data room search, "Search artifacts…" and Activity "Search runs". A first-timer cannot tell which one finds "the SAFE" (STORY-APP-007, 119, 120, 129, 125).
- **Three controls for hiding the sidebar.** The panel icon in the sidebar header, the invisible edge handle, and the "Show sidebar" icon in the chat header (STORY-APP-009, 122).
- **Hide amounts in three places.** Finance header, Cap table header and the account menu. The first two are the same component and are good; none is in the Inbox or Data room header (STORY-APP-128).
- **Files in two areas.** Data room (files the user uploads) and Artifacts (files bots make) sit side by side and both open documents. The icons now differ; the names do not say how (STORY-APP-006).
- **Settings reached from three places.** Account menu "Settings", palette "Settings" and sidebar search "Settings". "Usage" is both a Settings section and its own account-menu row (STORY-APP-005, 119, 120).
- **Bell, unread dots and Inbox badge.** Three signals for "something needs me": the bell's Activity list (runs), per-row unread dots, and the Inbox count. None of them lists replies from bots (STORY-APP-124).
- **Check-your-email screen reused.** The same title serves password reset and sign-up verification, but only the reset path explains itself and offers "Send again" (STORY-APP-102, 003).
- **Sidebar "Add page" machinery with nothing to add.** `SidebarPages`, `AddSidebarPage`, the API route and a database table exist for one template that cannot be added (STORY-APP-118).
- **Overlap with part B.** Prior STORY-APP-016 (notifications, part B) and stories 124 to 127 cover the same ground; keep one set when merging.

### Suspected problems (this area)

Each item was found by reading code, not by running the app, unless it says otherwise. None has been confirmed in a browser.

1. **Sign-up verification screen gives no help.** After "Create account" with email verification on, the screen is titled "Check your email" and shows only "Back to sign in". The sentence about which address got the mail, and the "Send again" button, are inside the `resetSent` branch only (`pages/Auth.tsx:153-176`, with `sent` true for `?verify=email` at `:35`). A user whose mail does not arrive has no way to resend (STORY-APP-102).
2. **Saved links are lost at sign-in.** A signed-out visit to `/app/finance` goes to `/sign-in` with no `next`; after sign-in she lands on `/app` and the first bot. Only `/integrations/setup` is carried through (`App.tsx:96-97,180-182`, `pages/Auth.tsx:115-121`) (STORY-APP-106).
3. **Unknown addresses fail silently.** `/app/<anything>` becomes "bot not found" and redirects to the first bot with no message (`Shell.tsx:1127-1133`, `App.tsx:196`). Addresses with extra segments such as `/app/inbox/x` or `/pricing` match no route and render a blank page; there is no catch-all route (`App.tsx:135-198`) (STORY-APP-140).
4. **Sidebar search never says "No results".** `SpaceSearchResults` treats a result set as non-empty whenever `onSearchMail` is given, and the Shell always gives it, so a search for nonsense shows only "Search mail for “…”" (`pages/SpaceSearch.tsx:80,118-129`) (STORY-APP-007). The "No results" and "Searching…" branches at `:81-94` are unreachable from the sidebar.
5. **Browser notifications cover less than users expect.** Events that notify are bot messages, failed runs and cancelled runs only; "Needs input" is not one of them (`lib/browser-notifications.ts:47-61`). The stream that triggers a notification belongs to the open chat only (`Shell.tsx:1521,1652`; `shouldNotifyBrowser` checks `subscribedThreadId` at `browser-notifications.ts:63`). If Maya is on Finance or Inbox (which open their own agent), Chief's reply produces no notification (STORY-APP-126). The notification has no click handler (`Shell.tsx:1016`).
6. **The bell is not notifications.** Its tooltip and label are "Activity" and it opens a run list. Users who expect a bell to list replies and approvals will not find them there (`Shell.tsx:3354-3376`, STORY-APP-124). A permission "denied" state is never explained, and the per-bot "Notifications" switch stays on regardless (STORY-APP-127).
7. **Artifact preview on a phone is probably squeezed.** When a file is open, `IndexPane` is a fixed `w-[320px] shrink-0` column with no hide-on-small-screens rule (`pages/Artifacts.tsx:501`), next to the preview. At 390 px that leaves roughly 70 px of preview unless she finds "Maximize" (STORY-APP-130, 144). Not checked in a browser.
8. **Hover-only controls on touch screens.** The Artifacts delete icon shows only on hover or keyboard focus (`pages/Artifacts.tsx:681,740`). The bot row "..." button is hidden on touch (`Shell.tsx:3956`), leaving long-press (browser context menu) as the only way to rename, archive or delete a bot (STORY-APP-005, 121, 131). Whether long-press works on iOS Safari is unverified.
9. **Window chrome is missing on sign-in screens (desktop only).** On Windows and Linux the main window is frameless (`apps/desktop/src/window-options.ts:21`) and the custom close/minimize circles are rendered only in the Shell, Welcome and Board pages (`WindowChrome` usages at `Welcome.tsx:10`, `Shell.tsx:3354,4219`, `Board.tsx:107`). Sign-in, sign-up, forgot-password, onboarding and the paywall have none, so the window cannot be closed or dragged from them (STORY-APP-137). Not run on a real desktop.
10. **A connect card hides a blocked pop-up.** `window.open` is not checked; if the browser blocks it, the card says "Waiting…" for about two minutes before "Authorization timed out. Please try again." (`pages/shell/message-cards.tsx:177-195`) (STORY-APP-111).
11. **Paywall dead end for non-managers.** Without billing rights the user sees only "Subscription required" and "Log out", with no sentence about who can subscribe (`pages/Paywall.tsx:63-81`) (STORY-APP-113).
12. **Server integrations step may render blank.** `IntegrationSetup` returns nothing when `serverSetup` is true and the user cannot configure the server (`components/integrations/IntegrationSetup.tsx:164`), and the Skip button lives inside the part that is not rendered. Whether a non-owner is ever sent there depends on server data not read here (STORY-APP-109).
13. **Sign-in blocks short passwords in the browser.** The password field has `minLength={8}` in every mode, including sign-in (`pages/Auth.tsx:261`). An older account with a shorter password cannot even submit the form, and the browser tooltip does not say why. Possible only if such accounts exist.
14. **Sign-up name defaults to the email prefix and then feeds the greeting.** If Name is left empty, the account name becomes the part before "@" (`pages/Auth.tsx:103`), and Chief's first message says "Hi maya.new" (`apps/api/src/onboarding.ts:122-123`) (STORY-APP-001).
15. **Palette numbers follow the unfiltered list.** Cmd+2 opens the second bot of all bots even when the typed filter shows different rows (`pages/shell/command-palette.tsx:68-83`) (STORY-APP-120). The shortcut hint beside a filtered row is the right number for that bot, but the order on screen differs.
16. **Focus card hides what each choice does.** Options show only labels; the summary that explains what A to E mean ("cash, cap table, investors, and email") appears only in Chief's reply after choosing (`message-cards.tsx:102-123`, `onboarding.ts:34-71`). B and C offer the same three apps in different order (STORY-APP-002).
17. **Artifacts page offers no recovery.** Load failure shows red text with no Retry; an empty list says only "No artifacts found." with no hint what artifacts are (`pages/Artifacts.tsx:122,371-385,455-462`) (STORY-APP-132). Non-previewable chat file cards show a raw MIME type such as `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (`components/ArtifactFileCard.tsx:60-70`) (STORY-APP-133).
18. **Paywall copy.** "Any model, with your own key" can read as "bring and pay for your own model on top" (`pages/Paywall.tsx:41`) (STORY-APP-004).
19. **Sidebar Add page is dead weight.** See Redundancy; `/app/team-health` quietly redirects to the first bot (`sidebar-pages.ts:4-11`, `Shell.tsx:1130-1133`) (STORY-APP-118).
20. **Hide amounts is per browser and partial.** It is stored in the browser (`lib/hide-amounts-preference.ts:7,16-24`), not in the account; it masks currency text and hides charts but the tooltip itself warns that plain numbers can show (`components/HideAmountsToggle.tsx:7-8`). Inbox and Data room have no header button (STORY-APP-128).

## Area: App shell B (STORY-APP-nnn)

Source: `docs/ux-paths/app/catalog-b.md` (part B of the App shell area; part A covers sign-up, sidebar, navigation, command palette and Activity).

Generated: 2026-10-17
Code read at: `559a76ad` (branch `docs/ux-pass`). All file:line references are to `apps/web/src/` unless another root is given.
Total Stories: 55 (33 short, 20 medium, 2 long)
Scope: Chief and bot chats (composer, attachments, reactions, replies, quotes, tables, tool activity, approvals), adding and removing bots, bot settings (credentials, avatar, model, memory, skills, scratchpad, pins, page), group chats and @mentions, peer messages, routines, Integrations (catalog, app detail, MCP servers, custom connection, server setup, OAuth callbacks), Settings (account, models and backups, voice, memory, messaging, approval rules, AI data sharing, updates, language and theme), billing and usage, and members/invites.

### Changes since the 2026-10-16 catalog

Part A owns APP-001..009 and the journeys agent owns APP-024. This file owns APP-010..023, APP-025 and new ids APP-151..199.

**Kept (id and goal unchanged, steps and labels corrected against the code):** STORY-APP-010, 011, 012, 013, 014, 015, 016, 017, 018, 019, 020, 021, 022, 023, 025.

**Changed (what moved in the code):**
- STORY-APP-010: "+" now says "New bot" (not "Create new Bot"). Creating a bot opens its Settings with the Name field selected (`pages/Shell.tsx:2765`, `focusName` at `pages/shell/bot-panel.tsx:96-100,390-391`). The old catalog said the first-time user had no naming step. The sidebar menu says "Edit profile" and "Mark as read" (`pages/BotContextMenu.tsx:126,131`).
- STORY-APP-011: The group copy says "They all reply in the same thread" (`pages/shell/dialogs.tsx:204`), but only the first member answers unless the message names someone (`packages/core/src/group-mentions.ts:52-54`). The old story said "both bots reply". Fixed.
- STORY-APP-012: The microphone no longer dictates; it starts a voice call (`pages/Shell.tsx:3224-3238`). Limits are 4 files and 10 MB each (`packages/contracts/src/attachments.ts:1-2`). Send and Stop are both shown during a run (`pages/Shell.tsx:7098-7122`).
- STORY-APP-013: Reactions are stored as replies, cannot be removed, and the pills are not clickable (`packages/core/src/message-reactions.ts:20-38`, `pages/Shell.tsx:6037-6056`).
- STORY-APP-014: Page size is 10 rows, "Expand table" opens a dialog with "Close table" (`packages/chat-ui/src/markdown-table.tsx:196-262`).
- STORY-APP-015: Mentions now cover bots, groups, routines and apps; a chip-only group mention opens the group without sending (`packages/core/src/composer-mentions.ts:284-298`). A "Sent to {group}" notice with an "Open" link replaces the old silent reroute (`pages/Shell.tsx:3178-3197`).
- STORY-APP-016: The Activity view has sections "Needs you", "Working", "Finished" (`pages/ActivityList.tsx:164-174`).
- STORY-APP-017: Copy says "Bots lose access" and the row button reads "Remove account" (`components/integrations/AppDetail.tsx:109,410`).
- STORY-APP-018: The custom connection form is now URL-only with an "Advanced" disclosure; the "Authentication" dropdown is gone. Connect starts a sign-in window by default (`components/integrations/CustomConnectionDialog.tsx:465-660`).
- STORY-APP-019: Settings → General has a "Server integrations" card with an "Open" button (`pages/AccountSettingsOverlay.tsx:222-244`). The page is inside the app at `/app/integrations/setup` (`pages/Integrations.tsx:19`). A non-owner is sent back to `/app` without a message (`pages/IntegrationSetup.tsx:30-33`).
- STORY-APP-020: Models has "Test API key", "Active model", a "Data room search model" disclosure and "Backup models" (`components/ModelConnectionPreflightNotice.tsx:34`, `pages/ModelSettingsOverlay.tsx:1579`, `pages/ModelBackupsSettings.tsx:249`).
- STORY-APP-021: General now has Account (with Delete account), Password, AI data sharing, Appearance, Language, Avatars, Server integrations (owner) and an "Advanced" disclosure holding Stream replies, Show tool activity, Load web images automatically and Action confirmations (`pages/AccountSettingsOverlay.tsx:100-318`).
- STORY-APP-022: Billing shows price and seat count; Usage shows runs and tokens (`pages/BillingSettingsPanel.tsx:76-102`, `pages/AccountSettingsOverlay.tsx:336-351`).
- STORY-APP-023: Still no invite or members UI. The Billing panel now prints a seat count, which makes the gap more confusing.
- STORY-APP-025: The long investor-update flow now passes through the Quote button, the mail approval card and the Action confirmation setting.

**Dropped:** none. Every earlier story in this range still has a matching surface.

**Added (new ids):** STORY-APP-151..174 and 176..191 (STORY-APP-175 is not used; see the coverage matrix). Reasons: Quote selection, the voice call button, the slash picker, history recall, attachment limits, tool activity disclosure, approval cards, bot credentials, Avatar Studio, per-bot advanced settings, per-bot memory and skills, Open work, List and Page panels, clearing and deleting bots, peer messages, group replies, child bot cards, send failures, routine mentions, routines (create, triggers, pause/delete), Integrations (connect, bot access, first-party tiles, reconnect, OAuth callback, other connection types, Finance tiles), backup models, language, AI data sharing, account deletion, Updates, Memory settings, Voice settings, Messaging, and the Settings window itself.

### Persona (applies to every story)

Maya Chen, cofounder and CEO of "Northwind Robotics" (a 9-person warehouse-robotics startup). She has never seen Praci. She does not know the words "bot", "space", "group", "MCP", "routine", "provider", "thinking", "scratchpad", "webhook" or "token". She wants one place to run the company: read email, know the cash position, keep the cap table and investor documents straight, and hand repeat work to someone reliable. Each story records what she tries in her own words, what she expects, and where she pauses. Pauses are marked **Hesitation:**.

### Mock demo data and preconditions (shared seed)

Every user-visible string in the seed contains `MOCK DEMO DATA` or starts with `MOCK` so a walker never mistakes it for real data.

| Seed item | Value |
|---|---|
| User | Maya Chen, `maya@northwind.example` (MOCK DEMO DATA), password set, deployment owner unless a story says otherwise |
| Space | "Northwind Robotics" |
| Model | One working deployment model; no personal API key |
| Bots | "Chief" (onboarding finished), "MOCK Finance helper" (title Finance), "MOCK Hiring helper" (title Recruiting), archived "MOCK Old intern bot" |
| Group | "Leadership" with Chief and MOCK Finance helper |
| Section | "MOCK Ops" containing MOCK Hiring helper |
| Chief thread | 12+ messages: one reply with a 14-row table ("MOCK DEMO DATA monthly burn by category", columns Category, Amount, Change), one message with a 👍 reaction, one user reply to an earlier message, one peer-message marker "Messaged MOCK Finance helper" |
| Integrations | Gmail connected (`maya@northwind.example`, MOCK), Slack connected (MOCK workspace), one custom connection "MOCK DEMO DATA Docs MCP" at `https://mcp.mock-northwind.example/mcp` |
| Routines | None for Chief at the start; story APP-172 creates "MOCK Monday cash check" |
| Files | Local files: "MOCK DEMO DATA board memo.pdf" (2 MB), "MOCK DEMO DATA cap table.xlsx" (1 MB), "MOCK DEMO DATA deck.docx" (3 MB), "MOCK DEMO DATA raw export.pdf" (14 MB), five 100 KB PNG screenshots |
| Billing | Billing enabled, subscription in Trial (5 days left); a second MOCK member account "Sam Patel" who is not the deployment owner |

### Summary

| Type | Count |
|---|---|
| Short | 33 |
| Medium | 20 |
| Long | 2 |

### Coverage Matrix

| Feature | Stories | Gaps |
|---|---|---|
| Send, stop, attach, drag/paste, history recall, slash picker | 012, 153, 154, 155 | Voice dictation does not exist; the mic is a call button (152) |
| Hover actions: react, reply, copy, speak; quote selection | 013, 151 | Reaction removal does not exist |
| Tables in chat | 014 | Table labels are English-only |
| Tool activity disclosure | 156 | Off by default; only reachable from Settings → Advanced |
| Approvals (tool, secret, mail) | 157, 158, 025 | Mail approval card mechanics are in prior STORY-031..033 |
| Mentions: bots, groups, routines, apps | 015, 168, 171 | `@everyone` only inside a group (168) |
| Group chats | 011, 168 | Adding a bot to a running group is covered in 168 only |
| Peer messages | 167 | The overlay is view-only; no reply path |
| Child bot card and handoff | 169 | Created by a tool, hard to seed by hand |
| Send/stop failures | 170 | Network-offline banner not covered |
| Notifications | 016 | Desktop (Electron) notifications not covered |
| Add, rename, clear, delete, archive bot | 010, 166 | Archive/restore sidebar rows are part A |
| Bot settings: Name/Title/Description/Notifications | 010 | |
| Bot settings: Advanced (Computer, model, thinking, voice, tools) | 161 | Computer panel and teaching are not covered here (no story owns them in this file) |
| Bot credentials | 159 | |
| Avatar Studio | 160 | Image upload not walked end to end |
| Bot Memory tab, Shared skills | 162 | |
| Open work (scratchpad) | 163 | |
| List and Page panels, pins strip | 164, 165 | Pins and Page are created by the bot; no manual create path |
| Routines: create, schedule, test, history | 172 | One-shot arming only as an edge case |
| Routines: triggers and model | 173 | Teams and other "Coming soon" triggers disabled |
| Routines: pause, delete, stop | 174 | |
| Integrations: connect, bot access, disconnect | 176, 177, 017 | |
| Integrations: custom MCP, other types | 018, 181 | Local command only walked as a variation |
| Integrations: first-party tiles, Finance | 178, 182 | |
| Integrations: reconnect, OAuth callback | 179, 180 | |
| Server integrations (owner) | 019 | Desktop `/desktop-settings` page not covered |
| Settings window | 191 | |
| Account: theme, language, password | 021, 184 | |
| Account: delete | 186 | Link SSO only as a variation |
| AI data sharing | 185 | |
| Approval rules | 158 | |
| Models, own key, backups | 020, 183 | OAuth subscription sign-in only as a variation |
| Voice | 152, 189 | |
| Memory | 188, 162 | |
| Messaging | 190 | Behind a server feature flag |
| Updates | 187 | Software update only visible to the owner on a sidecar install |
| Billing and usage | 022 | |
| Members and invites | 023 | Feature does not exist |
| Long journey | 025 | |

### Story Dependency Graph

```text
Seed (shared) ── Chief chat (012)
├── 013 react/reply/copy ── 151 quote
├── 014 table
├── 153 slash ── 154 recall ── 155 attachments
├── 152 mic → Voice settings (189)
├── 156 tool activity ── 157 approvals ── 158 action confirmations
├── 015 mention a group ── 168 group replies ── 011 groups and spaces
├── 171 routine/app mention ── 172 create routine ── 173 triggers ── 174 pause/delete
├── 167 peer messages, 169 child bot card, 170 failures, 016 notifications
├── 010 add a bot ── 160 avatar ── 161 advanced ── 159 credentials
│    ├── 162 memory and skills ── 188 Settings → Memory
│    ├── 163 open work, 164 list, 165 page
│    └── 166 clear / export / delete
├── Integrations: 176 connect ── 177 bot access ── 017 disconnect
│    ├── 018 custom MCP ── 179 reconnect ── 180 callback failures ── 181 other types
│    ├── 178 first-party tiles ── 182 Finance tiles
│    └── 019 Server integrations
├── Settings window 191 ── 021 theme/language/password ── 184 language
│    ├── 020 models ── 183 backups
│    ├── 185 AI data sharing, 186 delete account, 187 Updates, 190 Messaging
│    └── 022 billing and usage, 023 invite a cofounder
└── 025 long investor update (needs 012, 013, 014, 151, 157, 158)
```


### Stories: Adding and managing bots

#### STORY-APP-010: Maya adds a Hiring helper, names it, and puts it under Ops

**Type**: medium
**Topic**: Bots — create, rename, organize, delete
**Persona**: Naive first-time founder
**Goal**: "Get a separate assistant for recruiting, call it what I want, and keep it under Ops."
**Preconditions**: Shared seed without MOCK Hiring helper; section "MOCK Ops" exists; desktop width.
**Ideal path**: 3 — "+" → "New bot" → type the name. The name field is already selected, so the new flow is shorter than the 2026-10-16 version.
**Alternate paths**: empty-state "New bot" button when there are no chats (`pages/Shell.tsx:4360-4366` (label "New bot", line 4364)); "Duplicate" in the row menu (`pages/BotContextMenu.tsx:135`); clicking the chat title opens the same Settings (`pages/Shell.tsx:4243-4248`).

##### Steps
1. Clicks the "+" at the top of the sidebar (title "Create", `pages/Shell.tsx:3386-3392`). → A small picker: "To:", a "Search" box, bot rows, then "New bot", "New group", "New space" with "About groups" and "About spaces" info buttons (`pages/shell/bot-picker.tsx:50-134`). **Hesitation:** "To:" reads like an email address line; she may type a person's name.
2. Clicks "New bot". → A bot named "New Bot" is created and opened at `/app/<id>`. The right panel opens on Settings with the Name field focused and selected (`pages/Shell.tsx:2748-2767`, `pages/shell/bot-panel.tsx:383-391`). The chat shows a fixed greeting: "Hi Maya. I'm a blank slate right now, so you get to decide what I become. What's the main thing you'd want me handling for you?" (`apps/api/src/onboarding.ts:124-126`).
3. Types "MOCK Hiring helper" over the selected name. → Name saves when the field loses focus (`bot-panel.tsx:392`). No confirmation is shown yet.
4. Tabs to Title and types "Recruiting" (placeholder "e.g. Recruiting, Sales, Legal"), then Description "Screens candidates for the warehouse team." → Each saves on blur. **Hesitation:** She cannot tell what Title and Description do. They are what the bot reads as its role (`bot-panel.tsx:396-420`).
5. Clicks "Save". → A "Saved" check appears next to the button (`bot-panel.tsx:628-642`). She now trusts the earlier blur saves.
6. Hovers the new row in the sidebar and clicks "..." ("Actions for MOCK Hiring helper"). → Menu: Pin, Move to, Mark as read/unread, Edit profile, Duplicate, Clear conversation, Archive, Delete (`pages/BotContextMenu.tsx:84-148`). Opens "Move to" and picks "MOCK Ops". → The row moves under that section.
7. Opens the menu on "MOCK Old intern bot" row and chooses "Delete". → Dialog "Delete MOCK Old intern bot?": "Its conversation, files, and routines will be permanently deleted. Bots it created stay in your list." and "What about its memories?" with "Keep memories" (Move them to your shared memory.) selected and "Delete memories too" (This cannot be undone.) (`pages/shell/dialogs.tsx:415-480`). She keeps the default and clicks "Delete". **Hesitation:** She expected "Delete" to ask only yes/no; the memory choice is new vocabulary.

##### Variations
- Phone width: the Settings panel opens full width over the chat (`pages/ResizableSidePanel.tsx:81`); she must use the panel's "Close panel" button to see the greeting.
- "Edit profile" in the row menu and clicking the chat title open the same Settings panel.

##### Edge Cases
- Create fails: "Failed to create bot" appears in the composer error banner of the chat she was in, not near the "+" (`pages/Shell.tsx:2771`).
- Name cleared to blank: the old name is kept (`bot-panel.tsx:257` `nextName || bot.name`).
- Delete fails: "Could not delete bot" inside the dialog (`dialogs.tsx:473`).

#### STORY-APP-011: Maya creates a Leadership group and wonders what a space is

**Type**: medium
**Topic**: Groups and spaces
**Persona**: Naive first-time founder
**Goal**: "Have Chief and the Finance helper work on the board deck together."
**Preconditions**: Chief and MOCK Finance helper exist; no Leadership group.
**Ideal path**: 4 — "+" → New group → name → pick 2 bots → Create group.
**Alternate paths**: none found for creating a group; spaces can also be renamed or deleted from "Actions for space" (`pages/Shell.tsx:4981-5006`).

##### Steps
1. "+" → clicks the "About groups" info button. → Dialog "Groups": "Shared chat with 2-6 bots. They all reply in the same thread." (`pages/shell/dialogs.tsx:200-206`). **Hesitation:** She now expects every bot to answer every message. The behavior is different (see STORY-APP-168).
2. Clicks "About spaces". → "Spaces": "Private workspace with its own bots and groups." She wonders if her cofounder can join one; he cannot (STORY-APP-023).
3. Clicks "New group". → Right panel "New group" with "Name" ("Name this group"), "Members (pick 2–6)", a list of bots, and "Create group" disabled until the name and 2 members are set (`pages/GroupPanel.tsx:83-146`). Types "Leadership", clicks Chief and MOCK Finance helper (check marks appear). → Clicks "Create group"; lands on `/app/g/<id>`.
4. Types "Draft three bullet points on Q3 burn" and sends. → One bot answers (the first member), not both. See STORY-APP-168 for the full behavior.
5. Clicks the group name in the header. → "Group settings": rename, change members, "Save", "Delete group" (`GroupPanel.tsx:228-278`). Rename to "Leadership team" and save; the panel closes after a successful save (`GroupPanel.tsx:221`).
6. "+" → "New space". → Dialog "New space" with "Name" (placeholder "Customer support") and "Create space" (`dialogs.tsx:60-96`). Types "Side project". → Sidebar groups by space (part A).

##### Variations
- Only one bot picked: "Create group" stays disabled; there is no message saying why. **Hesitation:** She cannot tell if the Name or the member count is missing.
- Seventh member: the seventh row ignores the click (`GroupPanel.tsx:36-41`) with no message.

##### Edge Cases
- Create fails: "Could not create group" under the form title (`GroupPanel.tsx:93`).
- Delete group: "Delete {name}?" "This cannot be undone." (`dialogs.tsx:508-511`).
- Delete a space that still has bots: "Only empty spaces can be deleted. Delete its bots and groups first." (`pages/Shell.tsx:5067`).

#### STORY-APP-159: Maya saves a login for the Finance helper in its credentials

**Type**: medium
**Topic**: Bot settings — credentials
**Persona**: Naive founder told "give the bot your bank site login"
**Goal**: "Let the Finance helper log into our bill-pay site without me typing the password each time."
**Preconditions**: MOCK Finance helper exists. Bot Settings open.
**Ideal path**: 5 — Advanced → Add credential → Name → Site → Type "Website login" → Save credential.
**Alternate paths**: The bot can ask in chat (APP-157) and save the secret from the answer card.

##### Steps
1. In the bot Settings panel, clicks "Advanced". → The disclosure opens and the Credentials section loads (`pages/shell/bot-panel.tsx:443-451,620`, `bot-credentials.tsx:227-240`). Shows "Credentials", "Values are encrypted and never shown again." and "No credentials saved for this bot." **Hesitation:** "Advanced" hides this; she may never find it unless a chat card sends her here.
2. Clicks "Add credential". → Form: "Name" (placeholder `github`, hint "Lowercase letters, numbers, hyphens and underscores, starting with a letter."), "Site" (placeholder `https://api.example.com`), "Type" (Bearer token, Custom header, Basic auth, Website login, Command variable) (`bot-credentials.tsx:380-460`).
3. Types name "mock-billpay", Site "https://billpay.mock-northwind.example", chooses Type "Website login". → Fields "Username" and "Password" appear.
4. Types "maya.mock" and a password. Clicks "Save credential". → The row appears with the site and "Updated {time}"; the password is never shown again (`bot-credentials.tsx:230,492`).
5. Clicks "Replace value" on the row, pastes a new password, "Save new value". → Row updated.
6. Clicks "Remove" on the row. → Inline question "Remove mock-billpay? This bot will no longer be able to use it." with "Remove" and "Cancel" (`bot-credentials.tsx:310-340`).

##### Variations
- Type "Command variable": the Site field disappears and a line shows how the bot's shell commands will see it ("Available to this bot's shell commands as $MOCK_BILLPAY"). Reserved names show an error (`bot-credentials.tsx:213`).
- Saved without a username on Basic auth/Website login: "Enter a username and password" (`bot-credentials.tsx:116`).

##### Edge Cases
- Credentials fail to load: "Could not load credentials."
- A saved credential that cannot be read: "These saved settings can't be read. Remove it and add it again." (`bot-credentials.tsx:269`).

#### STORY-APP-160: Maya changes a bot's picture and color in Avatar Studio

**Type**: short
**Topic**: Bot settings — avatar
**Persona**: Naive first-time founder
**Goal**: "Make the Finance helper look different from Chief."
**Preconditions**: Bot Settings open for MOCK Finance helper.
**Ideal path**: 3 — click the avatar → pick a color → Done.
**Alternate paths**: Settings → General → "Avatars" Robot/Organic changes every bot's style at once (STORY-APP-021).

##### Steps
1. Clicks the large avatar at the top of the Settings panel (aria-label "Customize bot avatar"). → Popover "Avatar Studio": "Choose a bot shape, color, or upload an image" with tabs "Bot" and "Upload", and "Reset" (`pages/shell/avatar-studio-popover.tsx:123-192`). **Hesitation:** The avatar is not obviously clickable.
2. Under "Shape", picks one; under "Color", clicks a swatch (aria-label "Color #…"). → Avatar updates and saves on each change (`bot-panel.tsx:371-378`).
3. Clicks "Done". → Popover closes. The sidebar row shows the new color.

##### Variations
- "Upload": "Drag, drop, or paste an image" or "Choose file" (`avatar-studio-popover.tsx:289-292`).

##### Edge Cases
- Reset returns to the default shape and color.

#### STORY-APP-161: Maya picks a different model for one bot and turns off a tool

**Type**: medium
**Topic**: Bot settings — Advanced
**Persona**: Naive founder following a friend's advice ("use a stronger model for finance")
**Goal**: "Make the Finance helper use a stronger model, and stop it browsing the web."
**Preconditions**: Two models connected (deployment default plus one personal key). MOCK Finance helper Settings open.
**Ideal path**: 4 — Advanced → Model → choose → Save.
**Alternate paths**: Space-wide default is in Settings → Models (STORY-APP-020).

##### Steps
1. Opens "Advanced". → Shows "Computer" (Team / Private), Open work (STORY-APP-163), Memory/Shared skills tabs (STORY-APP-162), "Model", "Thinking" (only when the model supports it), "Memory scope" (only when a memory provider is connected), "Read replies aloud", "Voice" (only when voices exist), "Disabled tools", Credentials (`bot-panel.tsx:443-621`). **Hesitation:** "Computer: Team / Private" and "Thinking" mean nothing to her.
2. Opens "Model". → First option "Space default ({model name})", then connected models only (`bot-panel.tsx:470-495`). Picks the stronger one. → The Thinking list resets to "Default (Medium)".
3. Clicks "Save". → "Saved" check. **Hesitation:** Name, Title, Description and the Notifications switch save by themselves, but Model, Thinking, Computer, Read replies aloud, Voice and Memory scope save only when she presses "Save". A change followed by closing the panel is lost with no warning (`bot-panel.tsx:392` blur save versus `:628-642` Save button).
4. Types `web_search` in "Disabled tools" and presses Enter. → A row `web_search` with an on switch appears and the change saves immediately (`bot-panel.tsx:326-345,575-618`). Types `weather` and presses Enter. → "Unknown tool" in red.
5. Turns the `web_search` switch off. → Row disappears; the tool is allowed again.

##### Variations
- Model not in the connected list (e.g. a model she disconnected): kept as a plain entry using its id (`bot-panel.tsx:484-490`).
- "Computer" → "Private" changes the bot's computer on Save; no confirmation.

##### Edge Cases
- Save fails: "Could not save" under the fields (`bot-panel.tsx:315`).
- Model list fails to load: the Thinking field is simply missing, with no error (`bot-panel.tsx:181-196`).

#### STORY-APP-162: Maya reads and edits what a bot remembers, and adds a skill

**Type**: medium
**Topic**: Bot settings — memory and skills
**Persona**: Naive first-time founder
**Goal**: "See what Chief remembers about me and fix one fact; teach it how we write investor updates."
**Preconditions**: Chief has two memory documents (MOCK, e.g. `profile.md`, `investors.md`). Bot Settings → Advanced open.
**Ideal path**: 4.
**Alternate paths**: Settings → Memory shows all bots' memory in one list (STORY-APP-188).

##### Steps
1. In Advanced, finds the tabs "Memory" and "Shared skills" (aria-label "Knowledge") (`pages/KnowledgeSection.tsx:36-47`). "Memory" is selected. → Lists documents by path with "rev N", or "Nothing remembered yet".
2. Clicks the row `investors.md`. → A text box opens under it with "Save" (disabled until she changes the text) and "Cancel"; "Download as markdown" is below the list (`KnowledgeSection.tsx:262-321`). Edits one line and clicks "Save". **Hesitation:** She does not know whether the bot reads this file or just stores it.
3. Switches to "Shared skills". → Rows with a "Built-in" or "Plugin" badge, or "No skills yet" (`KnowledgeSection.tsx:471,335`).
4. Clicks "New skill". → A `SKILL.md` text area pre-filled with a template; "Save" is already enabled (`KnowledgeSection.tsx:520-530,575`). **Hesitation:** She can save the untouched template as a skill. She edits the title and instructions, clicks "Save". → Row appears. Typing "/" in Chief's composer now lists it (STORY-APP-153).
5. Opens a built-in skill. → Read-only; the button says "Close" instead of "Cancel" (`KnowledgeSection.tsx:543`).
6. Opens her own skill and clicks "Delete". → The button changes to "Confirm delete"; a second click removes it.

##### Variations
- Failure strings: "Could not load", "Could not save", "Could not save skill", "Could not delete skill".

##### Edge Cases
- Two people edit one memory document: the revision number differs; the panel shows no merge notice. (Not exercised; only one user in the seed.)

#### STORY-APP-163: Maya keeps a to-do list in a bot's "Open work"

**Type**: short
**Topic**: Bot settings — scratchpad
**Persona**: Naive first-time founder
**Goal**: "Leave Chief a short list of things to remember across chats."
**Preconditions**: Chief Settings → Advanced open.
**Ideal path**: 2 — type an item, Add.
**Alternate paths**: Ask Chief in chat to add to its list.

##### Steps
1. Finds "Open work" with "None yet" (`pages/ScratchpadSection.tsx:106-110`). **Hesitation:** She does not know it is the bot's working list, not hers.
2. Types "Send Q3 investor update by Friday" in "Add item" (aria-label "New open-work item", limit 200 characters) and clicks "Add" (or presses Enter). → A row appears with a check box (aria-label "Complete"), the plain word "open" on the right, a "Park" button and an "X" (aria-label "Remove") (`ScratchpadSection.tsx:114-176`). **Hesitation:** The status shows as a raw lowercase word.
3. Ticks the check box. → Title is struck through; the word changes to "done"; the box label becomes "Reopen". The "Park" button disappears.
4. Adds another item and clicks "Park". → Word changes to "parked"; the button becomes "Open".

##### Edge Cases
- Failures: "Could not add", "Could not update", "Could not remove", "Saved, but list refresh failed".

#### STORY-APP-164: Maya checks the numbers strip and the List panel on a bot

**Type**: short
**Topic**: Bot pins — stats strip and List
**Persona**: Naive first-time founder
**Goal**: "See Chief's headline numbers and tick off its checklist."
**Preconditions**: Chief has pins: stats "Runway 14 mo", "Cash $410,000" (MOCK) and a list "MOCK Q3 to-dos" with 3 items.
**Ideal path**: 2.
**Alternate paths**: Ask Chief to update them.

##### Steps
1. Opens Chief. → Cards in a strip under the header, each with label, big value, small detail; a warning icon appears on a failed value; a "Refresh" icon with the tooltip "Updated {time}" (`pages/shell/bot-pins.tsx:40-100`). She clicks "Refresh". → The icon spins until done. Failed refresh shows nothing.
2. Clicks the "List" icon in the header (`pages/Shell.tsx:4283-4297`). → Panel "List" with the list title, items with check boxes, an "Add item" box (`bot-pins.tsx:215-270`). Ticks an item (strikethrough) and clicks an item's text to edit; Enter saves, Escape cancels, blank text removes it.
3. Types "Review hiring plan" in "Add item" and presses Enter. → Appended at the bottom.

##### Variations
- The "List" icon is hidden at wide widths while the panel is closed, because the list shows beside the chat (`Shell.tsx:4293` `xl:hidden`).

##### Edge Cases
- Save fails twice: "Couldn't save. Try again." (`bot-pins.tsx:262`).
- The bot changed the list in the meantime: "The bot changed this list. Your last edit wasn't saved." (`bot-pins.tsx:267`).
- At 50 items the "Add item" box disappears (`BOT_PINS_MAX_ITEMS`, `packages/contracts/src/pins.ts:11`).

#### STORY-APP-165: Maya edits the page her bot keeps

**Type**: short
**Topic**: Bot page panel
**Persona**: Naive first-time founder
**Goal**: "Fix a typo in the notes page Chief writes for me."
**Preconditions**: Chief has a page ("MOCK board prep notes"); header shows a "Page" icon.
**Ideal path**: 2.
**Alternate paths**: none found.

##### Steps
1. Clicks the "Page" icon in the header (`pages/Shell.tsx:4274-4283`). → Right panel "Page" shows a rich text document (headings, lists, tables, tasks, charts).
2. Clicks into a paragraph and fixes a word. → It saves after a short pause, with no indicator (`pages/shell/bot-page-panel.tsx:128-170`). **Hesitation:** She does not know it saved. There is no "Saved" mark.
3. Chief edits the page in the background. → If she has unsaved typing, a "Page changed. Reload" button appears (`bot-page-panel.tsx:216`); otherwise the page updates silently.

##### Edge Cases
- Save fails: "Could not save the page." in red.
- A chart in the page has a hover "Delete chart" button.

#### STORY-APP-166: Maya clears Chief's chat, exports it, and checks what Delete removes

**Type**: short
**Topic**: Bots — clear, export
**Persona**: Naive first-time founder
**Goal**: "Start Chief over without deleting it, and keep a copy."
**Preconditions**: Chief with a long thread. Settings panel open.
**Ideal path**: 3 — Export → Clear conversation → Clear.
**Alternate paths**: "Clear conversation" in the sidebar row menu (`pages/BotContextMenu.tsx:140`).

##### Steps
1. Clicks "Export" at the bottom of Settings (`bot-panel.tsx:645`). → A file `chief-export.json` downloads (`pages/Shell.tsx:4650-4660`). **Hesitation:** No message says it downloaded or what it contains.
2. Clicks "Clear conversation" (red). → Dialog "Clear Chief’s conversation?": "This permanently removes every message and stops current work. The chat remains available." (`pages/shell/dialogs.tsx:362-368`). Clicks "Clear". → Thread empties; the greeting does not return.
3. Looks for whether the bot's memory and settings survive. **Hesitation:** The dialog only says messages are removed; it does not say what else is kept.

##### Edge Cases
- Clear fails: "Could not clear conversation".
- A run in progress is stopped by Clear (dialog text says so).

### Stories: Chief and bot chats

#### STORY-APP-012: Maya asks Chief for this week's priorities with a file attached

**Type**: medium
**Topic**: Chat composer
**Persona**: Naive first-time founder
**Goal**: "Give Chief our board memo and get a short priority list back."
**Preconditions**: Chief works; local file "MOCK DEMO DATA board memo.pdf" (2 MB).
**Ideal path**: 3 — attach, type, send.
**Alternate paths**: Drag the file onto the composer; paste a copied image; for Word and Excel files see STORY-APP-155.

##### Steps
1. Clicks the round "+" at the left of the message bar (aria-label "Attach file", `pages/Shell.tsx:6903`). **Hesitation:** A "+" in a circle suggests "new chat", not "attach". The sidebar "+" also means "new". → Picks the PDF. A chip with a paperclip, the file name and a small "x" (aria-label "Remove MOCK DEMO DATA board memo.pdf") appears above the bar (`Shell.tsx:6753-6790`).
2. Types "What are my top 3 priorities this week based on this?" in the field labelled "Message Chief". Shift+Enter adds a line; Enter sends. → The up-arrow button (aria-label "Send") turns active.
3. Presses Enter. → The message appears right-aligned with the file card. The bar shows a square Stop button (aria-label "Stop", `Shell.tsx:7112-7122`); an animated bot glyph shows "Starting", then "Thinking" or "Writing" (`Shell.tsx:5588-5597`).
4. While Chief streams, scrolls up. → A pill "Jump to latest" appears at the bottom (`Shell.tsx:6086-6096`). Clicks it. → Back at the newest line.
5. Types a second message while the first is still running. → Both the Send arrow and the Stop square are shown (`Shell.tsx:7098-7122`); sending adds another message. The screen does not say whether Chief picks it up now or after the current run.
6. Clicks Stop on a long answer. → The reply stops; Stop is replaced by Send.

##### Variations
- Phone width: the bar keeps Attach, field, Send; the field grows up to about 100 px then scrolls (`Shell.tsx:7078`).
- Her bot is not Chief but a group: the microphone is absent (`Shell.tsx:3224`).

##### Edge Cases
- Send fails: red banner "Failed to send message" with an "x" (aria-label "Dismiss error") above the bar; the draft and the chip stay (`Shell.tsx:2465,6700-6715`).
- Switching to another chat clears the pending chips and the reply target (`Shell.tsx:2943-2956`) and remounts the composer (its `key` is the chat id, `Shell.tsx:3206`), so text she typed but did not send is lost (`useState("")`, `Shell.tsx:6236`). **Hesitation:** She leaves to check the Finance helper and comes back to an empty bar.

#### STORY-APP-013: Maya reacts to, replies to, and copies one of Chief's answers

**Type**: short
**Topic**: Message hover actions
**Persona**: Naive first-time founder
**Goal**: "Thumbs-up the good answer, ask a follow-up on that exact point, and paste it into Slack."
**Preconditions**: Chief thread with 3 assistant messages; one already has 👍.
**Ideal path**: 3 — hover → react; hover → reply; hover → More → Copy.
**Alternate paths**: "Reply" is both a hover icon and an item under "More" (`pages/Shell.tsx:7305-7338`).

##### Steps
1. Hovers an answer. → Three icons appear beside it: smiley ("React"), arrow ("Reply"), dots ("More"), plus the send time (`Shell.tsx:7268-7330`). On a touch screen the buttons are 44 px instead of 28 px (`Shell.tsx:7277`).
2. Clicks "React". → Six emoji: 👍 👎 ❤️ 😂 🎉 😮 (`packages/contracts/src/reactions.ts:3`). Picks 🎉. → A small pill with 🎉 appears under the message (`Shell.tsx:6037-6056`). **Hesitation:** She taps 🎉 again expecting to undo it; the count becomes "🎉 2". There is no way to remove a reaction, and the pills are not buttons.
3. Clicks "Reply". → A preview bar above the field shows who and what she is replying to, with a close "x"; screen readers hear "Replying to Chief" (`Shell.tsx:6368,6678`). Types "Expand on point 2" and sends. → Her bubble shows a quoted line; clicking the quote scrolls to the original.
4. Clicks "More" → "Copy". → The text is on the clipboard, but nothing changes on screen (`Shell.tsx:7258-7262`). **Hesitation:** She clicks twice to be sure.

##### Edge Cases
- Streaming bubbles ("progress") show no actions (`Shell.tsx:7255`).
- Reaction fails: "Could not update reaction" in the composer banner (`Shell.tsx:2287`).
- A reaction does not start a bot run (`apps/api/src/thread-target.ts:1020-1064`); the bot does not "reply" to a 👍.

#### STORY-APP-151: Maya quotes one sentence from a long answer

**Type**: short
**Topic**: Message quote
**Persona**: Naive first-time founder
**Goal**: "Ask about just one line of Chief's long runway answer."
**Preconditions**: Chief reply with several paragraphs ("MOCK DEMO DATA runway is 14 months at the current burn…").
**Ideal path**: 3 — select text → Quote → type → send.
**Alternate paths**: Reply to the whole message (STORY-APP-013).

##### Steps
1. Drags the mouse across "14 months at the current burn" inside one answer. → A floating button "Quote" appears next to the selection (`pages/Shell.tsx:6130-6175`). **Hesitation:** It only appears when the selection is inside one message's text; selecting across two messages shows nothing.
2. Clicks "Quote". → The selection clears and the reply bar above the field shows the quoted text (`Shell.tsx:3114-3117`).
3. Types "Is that before or after the new hire?" and sends. → Her bubble carries the quote; clicking it jumps to the original.

##### Variations
- Selecting text in her own bubble also offers Quote (user bubbles carry the same quote marker, `pages/Shell.tsx:7853`).
- Phone: the button is placed from the selection rectangle; touch behavior was not checked in code.

##### Edge Cases
- Currency hidden by "Hide amounts": the quote text is masked (`Shell.tsx:6726`).
- Window scrolls: the button re-anchors, flips below the selection if there is no room above.

#### STORY-APP-152: Maya taps the microphone, expecting dictation

**Type**: short
**Topic**: Voice call
**Persona**: Naive first-time founder
**Goal**: "Dictate a message to Chief instead of typing."
**Preconditions**: Voice provider not connected (default). Chief chat, empty field.
**Ideal path**: 2 — tap mic, talk. Real path: the mic starts a call, and without a voice provider it opens Settings.
**Alternate paths**: Type instead.

##### Steps
1. Sees a microphone button (aria-label "Voice") at the right end of the bar while the field is empty (`pages/Shell.tsx:7084-7098`). Clicks it. → Settings opens on "Voice" (`Shell.tsx:3227-3230`) with the providers list ("Providers", each "Speak + transcribe" or "Speak only"). **Hesitation:** She expected to start talking; instead she is asked to choose a provider and paste an API key.
2. Continues in STORY-APP-189 to connect a provider. Closes Settings and clicks the mic again. → A call card appears: "On a call with Chief" with buttons Settings, Transcript, Mute/Unmute, Hang up (`components/call/CallCard.tsx:40-110`).
3. After "Hang up", the chat shows a "Voice chat" card with "Show transcript" / "Hide transcript" (`components/call/VoiceChatCard.tsx:39-49`).

##### Variations
- A provider marked "Speak only" has `transcribe: false` passed to the call (`lib/call-session.ts:105-109`). Whether the call card tells her it cannot hear her was not found in `CallCard.tsx`.
- As soon as she types a character, the microphone disappears and Send takes over (`Shell.tsx:7084`).

##### Edge Cases
- Group chats have no microphone.

#### STORY-APP-153: Maya types "/" and finds Chief's skills and Settings shortcuts

**Type**: short
**Topic**: Chat composer — slash picker
**Persona**: Founder who uses Slack and expects "/" commands
**Goal**: "Open settings without leaving the keyboard; use the skill my engineer added."
**Preconditions**: One shared skill "MOCK Investor update" exists (STORY-APP-162).
**Ideal path**: 2 — type "/", pick.
**Alternate paths**: Clicking the chat title or her name in the sidebar.

##### Steps
1. Types "/" as the first character. → A list opens above the bar: skills ("Skill MOCK Investor update" with a one-line description) then "Chat Settings", "Settings: General", "Settings: Usage" (`pages/Shell.tsx:6849-6880`, `packages/core/src/composer-slash.ts:1-5`). **Hesitation:** Nothing on screen tells her "/" exists.
2. Types "usage". → Only "Settings: Usage" stays. Clicks it. → Settings opens at Usage; the field is cleared.
3. Types "/inv" and picks the skill. → A chip "MOCK Investor update" with an "x" (aria-label "Remove skill …") appears in the field; she adds text and sends.
4. Presses Backspace on an empty field. → The chip is removed (`Shell.tsx:6990-6995`).

##### Edge Cases
- "/" typed after other text does nothing; it only works at the start (`Shell.tsx:6398`).
- The field's key handler wires arrow keys and Enter for the @ list only; the "/" list has no key handling there (`pages/Shell.tsx:6905-7060`). Enter sends the text "/usage" as a message.

#### STORY-APP-154: Maya presses the Up arrow to resend an earlier question

**Type**: short
**Topic**: Chat composer — history
**Persona**: Founder who uses a terminal
**Goal**: "Send the same weekly question again with one small change."
**Preconditions**: She sent "What did we spend on cloud last month?" earlier in this chat.
**Ideal path**: 2.
**Alternate paths**: Copy from the earlier bubble.

##### Steps
1. Clicks into the empty field and presses Up. → The last message she sent appears in the field with the caret at the end (`pages/Shell.tsx:6378-6389,7020-7040`). **Hesitation:** Nothing hints at this.
2. Presses Up again. → An older message. Presses Down → newer, and finally her empty draft.
3. Edits "last month" to "this quarter" and presses Enter.

##### Edge Cases
- Up only starts from an empty field; with text in it, Up moves the caret as usual (`Shell.tsx:7041-7048`).
- Typing any character leaves recall mode (`Shell.tsx:6391-6393`).
- Suspected defect: the history is built from every user message in the thread (`Shell.tsx:1989-1999`). A reaction is stored as a user message with the emoji as its text (`apps/api/src/thread-target.ts:1046`), so Up can recall "🎉" or "👍" in place of a real question. Not run; confirm in a browser.

#### STORY-APP-155: Maya attaches five files, a Word file and a huge PDF

**Type**: medium
**Topic**: Chat attachments — limits
**Persona**: Naive first-time founder
**Goal**: "Give Chief everything for the board pack in one go."
**Preconditions**: Files from the seed: board memo.pdf (2 MB), cap table.xlsx, deck.docx, raw export.pdf (14 MB), five PNG screenshots.
**Ideal path**: 3 — pick all, send.
**Alternate paths**: Add the documents to the Data room and ask Chief to use them.

##### Steps
1. Clicks "Attach file". → The system picker only offers images, PDF, text, Markdown, CSV, HTML, JSON and ZIP; `.docx` and `.xlsx` are greyed out in most pickers (`pages/Shell.tsx:376,6895`). **Hesitation:** She wonders why her Word deck cannot be selected and sees no explanation.
2. Selects the PDF, the 14 MB PDF and five PNGs anyway. → Chips appear for the first 4 acceptable files (the memo and three screenshots). A yellow notice appears: "Skipped MOCK DEMO DATA raw export.pdf (over 10 MB), MOCK screenshot 4.png (max 4 attachments), MOCK screenshot 5.png (max 4 attachments)" with a dismiss "x" (`Shell.tsx:2292-2322`).
3. Drops "MOCK DEMO DATA deck.docx" onto the bar. → Notice: "Skipped MOCK DEMO DATA deck.docx" with no reason (`Shell.tsx:2305-2312`). **Hesitation:** The notice says what was skipped, not why, for unsupported types.
4. Removes a PNG chip with its "x", then adds a skipped screenshot. → It is accepted, because the limit counts current chips only.
5. Sends. → The files upload and appear as cards in her message; a failed send shows "Failed to send message".
6. Drags the Word file onto the main chat area outside the bar. → A full-window overlay "Drop to add to Data room" appears and the file is uploaded to the Data room with a toast, not attached to the chat (`components/data-room/DropZone.tsx:55-60,118-125`). **Hesitation:** Two drop targets look the same; the composer shows a ring, the rest of the window shows the Data room overlay.

##### Variations
- Pasting a screenshot (Cmd+V in the field) adds it as a chip (`Shell.tsx:6569-6585`).
- Phone: the picker opens the camera roll and files app.

##### Edge Cases
- Dropping a folder or a file with no extension and no known type is skipped by name only.

#### STORY-APP-156: Maya turns on tool activity to see what Chief is doing

**Type**: medium
**Topic**: Tool activity disclosure
**Persona**: Naive first-time founder
**Goal**: "Find out why a simple question takes two minutes."
**Preconditions**: Chief runs a task that uses 5+ tools (e.g. "Check our Gmail for investor replies this week").
**Ideal path**: 3 — Settings → Advanced → Show tool activity.
**Alternate paths**: Activity view in the sidebar shows run states, not steps (part A).

##### Steps
1. Sends the request. → Chief shows only the answer text and a status line ("Using Gmail search" etc.). No steps are visible. **Hesitation:** She sees "Using …" in the status line but no list; tool cards are hidden by default (`lib/tool-activity-preference.ts:35-37`).
2. Settings → General → "Advanced" → switch "Show tool activity" on (`pages/AccountSettingsOverlay.tsx:276-295`). Closes Settings.
3. Sends the same request again. → While running, a line "Working… · 3 tools" with a chevron is open, listing the last 6 steps with a ◷ on the current one and "+2 earlier steps" above (`components/ToolActivityDisclosure.tsx:12,62-105`).
4. When the run ends, the card folds to "Done · 7 tools · 1m 42s". She clicks it. → Each step shows a ✓ and a label, with "×3" for repeats (`ToolActivityDisclosure.tsx:46-52`).

##### Variations
- A message with tools only and no text appears as a plain muted line between bubbles instead of a bubble (`StandaloneToolActivity`).
- The setting is stored per browser, not per account (`localStorage` key `rakazo.showToolActivity`), so a second computer shows no tools.

##### Edge Cases
- A manual collapse during a run holds until the run ends (component comment).
- Setting off again hides the cards but not the status line.

#### STORY-APP-157: Chief asks before doing something, and later asks for a password

**Type**: medium
**Topic**: Approvals and questions in chat
**Persona**: Naive first-time founder
**Goal**: "Let Chief act, but only with my OK on the risky part."
**Preconditions**: Chief is allowed to use a tool that needs approval; a task that will ask a question ("Which account should I pay from?").
**Ideal path**: 2 — read the card, press one button.
**Alternate paths**: Rules in Settings → Advanced → Action confirmations (STORY-APP-158); email approvals use the mail card (prior STORY-031..033).

##### Steps
1. Asks Chief to "Pay the MOCK Cloud invoice". → A card (not a bubble) appears with the question text, optionally a grey code box with details, and full-width buttons "Allow once" (highlighted), "Always allow this tool", "Deny" (`components/AskCard.tsx:36-40,147-165`). A notification may arrive if she is in another tab (STORY-APP-016). **Hesitation:** "Always allow this tool" sounds permanent and she cannot tell how to undo it.
2. Clicks "Allow once". → Buttons are replaced with the green line "Allowed once" (`AskCard.tsx:25`). Chief continues.
3. Chief asks "Which account should I pay from?" with a text field "Type your answer" and "Send answer". → She types "Operating" and sends; the card shows "Answered".
4. Chief needs a login password. → A card with a masked field labelled "Password" and a "Save" button; the card shows where it will be used (a site or a command variable) (`AskCard.tsx:105-120,165-190`). She types it and clicks "Save". → "Saved". The text is never shown in chat.
5. Scrolls up to an older card she skipped. → It says "No longer active" with no buttons (`AskCard.tsx:133`).

##### Variations
- "Deny": Chief explains it did not proceed.
- The card answered on another device flips to its answered state.

##### Edge Cases
- Submit fails: "Could not submit this answer".
- Only the newest question is answerable (`latestAnswerableAskMessageId`, `pages/Shell.tsx:2012`).

#### STORY-APP-158: Maya makes Chief always ask before sending email

**Type**: short
**Topic**: Settings — action confirmations
**Persona**: Cautious first-time founder
**Goal**: "Never let a bot email an investor without my OK."
**Preconditions**: Settings open.
**Ideal path**: 3 — General → Advanced → "Ask before sending external email".
**Alternate paths**: Answer each approval card as it comes (STORY-APP-157).

##### Steps
1. Settings → General, scrolls to the bottom, clicks "Advanced". → Opens a section "Action confirmations" with two buttons "Ask before sending external email" and "Ask before purchases", a switch "Flag unexpected actions", and a list of rules (`components/ApprovalRulesSettings.tsx:111-190`). **Hesitation:** These look like actions to run, not settings; she cannot tell if the button is on.
2. Clicks "Ask before sending external email". → A row "Ask before email actions" with "Remove" appears.
3. Clicks the same button again. → Nothing happens, and no message (`ApprovalRulesSettings.tsx:46-58`).
4. Turns on "Flag unexpected actions". → If no model is available: "Add a model in Settings to use this." (`ApprovalRulesSettings.tsx:140`).
5. Clicks "Remove" on the rule. → The row goes away. The screen does not say whether the bot then asks or sends by default.

##### Edge Cases
- Load fails: "Could not load approval rules". Save fails: "Could not save rule".

#### STORY-APP-014: Maya works with a burn table Chief produced

**Type**: short
**Topic**: Chat tables
**Persona**: Naive first-time founder
**Goal**: "Sort by amount and get it into a spreadsheet."
**Preconditions**: Chief message with a Markdown table of 14 rows (Category, Amount, Change).
**Ideal path**: 2 — click the Amount header; Download.
**Alternate paths**: "Copy rows" then paste into Sheets.

##### Steps
1. Clicks the "Amount" header (aria-label "Sort by Amount"). → Sorted; clicking again reverses; a third click clears (`packages/chat-ui/src/markdown-table.tsx:122-135`).
2. Reads the footer "1–10 of 14 rows" with Previous page and Next page icons (`markdown-table.tsx:186-215`).
3. Clicks the expand icon (aria-label "Expand table"). → A larger dialog with all rows and a "Close table" icon (`markdown-table.tsx:245-262`).
4. Clicks "Copy rows". → The icon becomes a check for 1.5 s (`markdown-table.tsx:155-166,232`). Pastes into a sheet: tab-separated, in the sorted order.
5. Clicks "Download CSV". → A file `table.csv` downloads (`markdown-table.tsx:178`). **Hesitation:** A second table also downloads as `table.csv`; the browser renames it "table (1).csv".

##### Edge Cases
- All table labels are fixed English (`markdown-table.tsx:196-262`), even when Language is Español (STORY-APP-184).
- Less than 10 rows: no paging, footer "N rows".

#### STORY-APP-015: Maya hands work to the Leadership group with @ from Chief's chat

**Type**: short
**Topic**: Chat — mention a group
**Persona**: Naive first-time founder
**Goal**: "From Chief's chat, ask the Leadership group to review the deck."
**Preconditions**: Leadership group exists; Chief chat open.
**Ideal path**: 3 — type @Lead, pick, add text, send.
**Alternate paths**: Open the group from the sidebar and type there.

##### Steps
1. Types "@Lead". → A list (aria-label "Mentions") shows "Leadership" with subtitle "Group", and other bots, routines and apps that match (`pages/Shell.tsx:6790-6830`, `packages/core/src/composer-mentions.ts:196-251`). **Hesitation:** The list mixes people-like items and apps; subtitles "Bot", "Group", "Runs on send · …", "Connected" are small.
2. Presses Enter to pick. → A chip is added in the field. Types "please review the deck" and sends. → The message is delivered to the group, and Chief's chat does not show it. A line under the chat says "Sent to Leadership" with an "Open" link (`Shell.tsx:3178-3197`).
3. Clicks "Open". → Goes to `/app/g/<id>`.

##### Variations
- Chip only, no text, Enter: the group opens without sending anything (`composer-mentions.ts:284-298`).
- If she was replying to a Chief message, the reply link is dropped on reroute (`Shell.tsx:2418`). **Hesitation:** "Where did my reply go?"
- No match: "No matches. Press Escape to send as typed." (`Shell.tsx:6839`).

##### Edge Cases
- The notice disappears after a few seconds (`Shell.tsx:391`).

#### STORY-APP-171: Maya mentions a routine and an app in one message

**Type**: medium
**Topic**: Chat — routine and app mentions
**Persona**: Naive first-time founder
**Goal**: "Run my Monday cash check now, and use Slack."
**Preconditions**: Routine "MOCK Monday cash check" exists (STORY-APP-172); Slack connected; Gmail shown as "Needs sign-in" in the picker.
**Ideal path**: 3.
**Alternate paths**: Open the routine in the bot panel and click "Test run".

##### Steps
1. Types "@Mon". → The list shows "MOCK Monday cash check" with the subtitle "Runs on send · Weekdays at 08:00" (`composer-mentions.ts:235-246`). Picks it. → A chip with the label "Runs on send" (`pages/Shell.tsx:6951-6954`).
2. Presses Enter with no text. → The routine starts at once, nothing is posted to chat, and a run starts for its bot (`Shell.tsx:2362-2380`). No confirmation line is shown (`Shell.tsx:2362-2380`).
3. Types "@Slack" and adds "post the summary to #finance". → A chip "Slack". Sends. → The bot receives the message with the app named.
4. Types "@Gmail" for an app not yet signed in. → The chip shows "Needs sign-in"; the message goes out with the line "Use these connectors if relevant: Gmail." added (`composer-mentions.ts:123-140`).

##### Edge Cases
- Routine fails to start: the failure message shows in the composer banner.
- Two routines with one name: the subtitle adds the bot name.

#### STORY-APP-016: Maya wants to know when Chief is done or needs her

**Type**: short
**Topic**: Notifications
**Persona**: Naive first-time founder
**Goal**: "Ping me when the long task finishes, and show me what needs me."
**Preconditions**: Chief with Notifications on (default for new bots); browser permission "default".
**Ideal path**: 2 — allow once; click the notification.
**Alternate paths**: Per-bot "Notifications" switch in Settings (`pages/shell/bot-panel.tsx:424-440`).

##### Steps
1. Sends a long request. → The browser asks for notification permission now, on the first send to a bot with notifications on (`pages/Shell.tsx:2358-2362`). **Hesitation:** No explanation precedes the prompt.
2. Allows; switches tab. → When Chief finishes a notification appears titled "Chief finished" with the body "Finished." (or "{name} failed", "{name} stopped"; a new message shows its text under the bot name) (`lib/browser-notifications.ts:72-104`).
3. Clicks the bell in the sidebar (title "Activity"). → The list shows "Needs you", "Working", "Finished" sections and "Nothing needs you right now." when empty; "Search runs", "Status", "From", "To" and "Reset all" filters (`pages/ActivityList.tsx:119-370`).
4. Opens Chief's Settings and turns "Notifications" off.

##### Edge Cases
- Permission denied once: there is no in-app way to ask again.

### Stories: Group chats, peer messages and chat failures

#### STORY-APP-168: Maya talks to a group and only one bot answers

**Type**: medium
**Topic**: Group chat replies
**Persona**: Naive first-time founder
**Goal**: "Ask both the Finance helper and Chief for a view."
**Preconditions**: Leadership group (Chief first, MOCK Finance helper second).
**Ideal path**: 3 — message, then mention who should answer.
**Alternate paths**: `@everyone` (group only).

##### Steps
1. Sends "Should we hire two more engineers this quarter?" with no names. → Only the first member (Chief) answers (`packages/core/src/group-mentions.ts:52-54`). **Hesitation:** The group dialog promised "They all reply in the same thread". She waits for the Finance helper.
2. Types "@MOCK Finance helper what does that do to runway?" → The list shows each member plus "everyone" ("Everyone in this group", `composer-mentions.ts:207-215`). Picks the helper and sends. → The helper answers, with its name and avatar above the bubble.
3. Types "@everyone summarize in two lines". → Every member replies, one after the other.
4. Clicks the group name → "Group settings", removes Chief, adds "MOCK Hiring helper", clicks "Save". → Panel closes; members change. Past messages stay.

##### Variations
- Typing a name without picking a chip also counts (`hasMentionToken`), but a name written differently from the bot's does not; the first member answers.
- A bot "handed off to" another: a centered line "Chief handed off to MOCK Finance helper" appears (`pages/Shell.tsx:7640-7655`).

##### Edge Cases
- A group needs 2–6 members; saving with 1 is disabled with no message.
- Every group member must be non-archived (`GroupPanel.tsx:30`).

#### STORY-APP-167: Maya opens the conversation between Chief and the Finance helper

**Type**: medium
**Topic**: Peer messages
**Persona**: Naive first-time founder
**Goal**: "See what Chief asked the Finance helper behind my back."
**Preconditions**: Chief's thread has a marker "Messaged MOCK Finance helper" (a bot-to-bot message).
**Ideal path**: 2 — click the marker.
**Alternate paths**: Open the Finance helper's own chat.

##### Steps
1. Sees a small centered marker with two colored dots: "Messaged MOCK Finance helper" (or "Message from …") (`pages/Shell.tsx:7655-7670`, `components/ai/CollaborationMarker.tsx`). **Hesitation:** It looks like a label, not a button.
2. Clicks it. → A full-screen dialog titled "Chief · MOCK Finance helper" with sent and received bubbles, each labelled with the sender's name (`pages/PeerMessagesOverlay.tsx:68-145`).
3. Reads the bottom line "This chat is view-only" (`PeerMessagesOverlay.tsx:149`). **Hesitation:** She wants to answer on the helper's behalf; there is no box.
4. Clicks "Close".

##### Variations
- Loading: "Loading…"; empty: "No messages with MOCK Finance helper yet."
- Phone: the dialog fills the screen.

##### Edge Cases
- Load failure: "Could not load this chat." with "Retry now".

#### STORY-APP-169: Chief creates a helper bot and a card appears in chat

**Type**: short
**Topic**: Child bot card
**Persona**: Naive first-time founder
**Goal**: "Ask Chief to set up a bot that tracks vendor invoices."
**Preconditions**: Chief can create bots.
**Ideal path**: 2 — read the card, click it.
**Alternate paths**: Find the bot in the sidebar.

##### Steps
1. Asks "Create a bot that tracks vendor invoices." → A card in the chat shows the new bot's name, a green tag "bot", and its title or "Opened its thread." (`pages/Shell.tsx:7752-7790`).
2. Clicks the card. → Opens the new bot's chat.
3. Later the bot is archived: the tag turns red "archived" with "Archived. Chat, memory, and files kept." and the card is disabled. If deleted: "deleted" and "Removed with chat, computer, and memory."

##### Edge Cases
- The new bot may carry a "computer" card with its own "Open" button (`Shell.tsx:7973-7995`).

#### STORY-APP-170: Maya's message fails to send, and a Stop does not work

**Type**: short
**Topic**: Chat failures
**Persona**: Naive first-time founder on weak Wi-Fi
**Goal**: "Send a message when the connection drops and recover."
**Preconditions**: Server blocks the next send (stub).
**Ideal path**: 2 — read the banner, resend.
**Alternate paths**: Wait for the app to reconnect.

##### Steps
1. Sends "Update the investor list." → Red banner above the bar: "Failed to send message" with an "x" ("Dismiss error"); the typed text and chips remain (`pages/Shell.tsx:2465,6700-6715`).
2. Presses Send again. → Goes through with the same message id, so nothing duplicates (retry nonce, `Shell.tsx:6516`).
3. While Chief runs, clicks Stop and the server rejects it. → Banner "Failed to stop" (`Shell.tsx:2501`). Stop stays.
4. Dismisses the banner. → Focus returns to the field.

##### Edge Cases
- A run error from the bot (not the send) uses the same banner with the bot's message.

### Stories: Routines

#### STORY-APP-172: Maya sets up a Monday cash check that runs by itself

**Type**: long
**Topic**: Routines — create, test, review
**Persona**: Naive first-time founder; she calls it "a reminder that does the work"
**Goal**: "Every weekday at 8 AM, have Chief tell me what is in the bank and flag bills due this week."
**Preconditions**: Chief exists and works; Gmail/Finance optional; no routines yet.
**Ideal path**: 6 — Chief → Bot computer icon → Routines "+" → fill name and instruction → Add trigger → Save.
**Alternate paths**: Tell Chief in chat to "run this every weekday at 8"; a teach recording can end with "Add to routine" (`components/teach/SkillDraftCard.tsx:150`).

##### Steps
1. Looks for "Routines" in the sidebar and the settings panel and finds nothing. Clicks the monitor icon in Chief's header (title "Bot computer", `pages/Shell.tsx:4299-4316`). → The right panel shows a screen preview of the bot's computer and, below it, a heading "Routines" with a small "+" (title "Create Routine", `pages/RoutineEditor.tsx:145-160`). **Hesitation:** Routines live under the computer picture. Nothing in Settings or the sidebar points there.
2. Clicks "+". → Panel "Routine": back arrow, an "Active" switch (on), "Delete", "Test run" (disabled until saved), "Name" ("Name this routine"), "Instruction" ("What should this routine do each time it runs?"), a "When to run" line with her timezone and a sliders icon (aria-label "Advanced"), a full-width "Add trigger" button, and "Save" (disabled) (`RoutineEditor.tsx:300-625`). A hint reads "Add a schedule, webhook, GitHub, or message trigger to run this routine." **Hesitation:** "Trigger" and "Instruction" are new words; the blank Save button is grey without a reason beyond the hint.
3. Types Name "MOCK Monday cash check" and Instruction "Look at our bank balance and any bills due in the next 7 days. Give me three bullets."
4. Clicks "Add trigger" → "On a schedule" → "Weekdays". → A schedule card "Weekdays at 9:00 AM" with a "How often" select and a time select (`pages/RoutineSchedule.tsx:215-285`, default time `packages/core/src/cron.ts:65`). Changes the time to 8:00 AM. The "Save" button turns on.
5. Clicks "Save". → The panel stays open; "Test run" is now enabled and a "Run history" section with "No runs yet" appears below (`RoutineEditor.tsx:618-640`, `pages/RoutineRunHistory.tsx:168-190`). **Hesitation:** There is no "Saved" message; the new button state is the only sign.
6. Clicks "Test run". → The button reads "Running…" and Chief's chat starts a run (`pages/Shell.tsx:4817-4837`). If she goes Back to the list while it runs, the row shows a "Running · Stop" pill.
7. When done, opens "Run history". → A row with date, the status word, duration, and a "View chat" link that opens `/app/<chief>?m=<message>` at the routine's answer (`RoutineRunHistory.tsx:195-228`).
8. Clicks the back arrow. → The list shows "MOCK Monday cash check" with its schedule summary under the name (`RoutineEditor.tsx:130-141`).
9. Back in chat, types "@Mon" to run it on demand (STORY-APP-171).

##### Variations
- Leaves Name and Instruction blank and presses Save: it saves with the name "Routine" and the instruction "Check in." (`pages/Shell.tsx:4760-4761`). **Hesitation:** She did not choose either.
- Phone width: the panel overlays the chat full width (`ResizableSidePanel.tsx:81`).
- Interval schedule: "every [5] [minutes]" selects with amounts 1, 2, 3, 5, 10, 15, 30, 45 (`cron.ts:68`).
- "Advanced": a cron text box (placeholder `*/3 * * * *`).

##### Edge Cases
- Save fails: "Could not save routine". A schedule-less save is blocked with "Add a schedule, webhook, GitHub, or message trigger" (`Shell.tsx:4716`).
- Test run fails: "Could not run routine".
- Run history fails to load: "Could not load run history"; "Refresh" and "Load older runs" buttons.

#### STORY-APP-173: Maya wants the routine to start when a Slack message arrives

**Type**: medium
**Topic**: Routines — other triggers and model
**Persona**: Naive first-time founder
**Goal**: "When someone posts in #payments, have the Finance helper look at it."
**Preconditions**: MOCK Finance helper Bot computer panel open. Variation A: Slack messaging enabled on the server. Variation B: not enabled.
**Ideal path**: 4.
**Alternate paths**: Webhook or Git event for developer-style triggers.

##### Steps
1. Routines "+" → "Add trigger". → The menu lists "On a schedule", "Slack message", then greyed "Teams message" (tooltip "Teams not enabled"), "Linear issue", "Sentry alert", "PagerDuty incident" (tooltip "Coming soon"), "Git event", "Webhook" (`RoutineEditor.tsx:77-83,550-610`). **Hesitation:** Four greyed items clutter the list.
2. Variation B: "Slack message" is greyed with the tooltip "Slack not enabled"; nothing says how to enable it (`RoutineEditor.tsx:567-580`). She gives up and picks "On a schedule".
3. Variation A: picks "Slack message". → A card "Slack message" with "Runs when this bot receives a verified message from this provider." (`RoutineEditor.tsx:636-660`).
4. Clicks the sliders icon beside "When to run" (aria-label "Advanced"). → A popover with "Model" ("Bot's model" by default) and, when the model supports it, "Thinking". Picks a cheaper model. → A small dot appears on the icon. Saves.
5. Adds "Webhook" instead. → A card "When a webhook fires" with "POST to" (shown after save), "key" ("Available after the routine is saved"), "header" (`RoutineEditor.tsx:700-760`). After Save the key appears once; later it reads "Saved. Rotate to reveal." with a "Rotate key" link. **Hesitation:** If she does not copy the key now, it is hidden.

##### Edge Cases
- "Git event" cards show `X-Hub-Signature-256: sha256=…` and the bot's `/github` address immediately.
- Removing a trigger with the "x" before saving discards it.

#### STORY-APP-174: Maya pauses, stops, and deletes a routine

**Type**: short
**Topic**: Routines — manage
**Persona**: Naive first-time founder
**Goal**: "Stop the Monday check for the holidays, and delete the test one."
**Preconditions**: Routines "MOCK Monday cash check" and "MOCK test routine" exist.
**Ideal path**: 2 per routine.
**Alternate paths**: none found.

##### Steps
1. Opens "MOCK Monday cash check" from the Routines list and turns off "Active". Clicks "Save". → The list row shows a pause icon and the text "Paused" (`RoutineEditor.tsx:133`).
2. Starts "Test run" on a long routine, clicks the back arrow, and clicks the "Running · Stop" pill on the row. → The run stops (`RoutineEditor.tsx:196-208`).
3. Opens "MOCK test routine", clicks "Delete". → Dialog "Delete MOCK test routine?" "This cannot be undone." with Cancel and Delete (`pages/Shell.tsx:5229-5243`, `dialogs.tsx:508-540`). After deleting, the panel returns to the computer view..

##### Edge Cases
- "Active" off but not saved: leaving the panel drops the change.
- A one-shot schedule (specific date) that has never run shows a required "Run at" date-time box; leaving it blank gives "Add a run time for this one-shot."; a past time gives "Run time must be in the future." (`Shell.tsx:4745-4756`).

### Stories: Integrations

#### STORY-APP-176: Maya connects Slack from "Find an app"

**Type**: medium
**Topic**: Integrations — connect an app
**Persona**: Naive first-time founder
**Goal**: "Let my assistants read our #finance channel."
**Preconditions**: App catalog set up; Slack not yet connected; pop-ups allowed.
**Ideal path**: 4 — Integrations → search Slack → Connect → sign in → Continue.
**Alternate paths**: Chief's connect card in chat (part A STORY-APP-001); `@Slack` mention (STORY-APP-171).

##### Steps
1. Clicks "Integrations" at the bottom of the sidebar. → Page "Integrations": "Connect the apps you use so your bots can read and act in them. You choose which bots get access to each one." Sections: "Connected", "Find an app" (search box "Search apps" and category chips All, Email & calendar, Chat, Docs & files, Finance, Developer, Sales & CRM), "Popular", "Finance", "Social", "Equity", "Tools", "Anything else" (`components/integrations/IntegrationsHome.tsx:462-720`). **Hesitation:** Eight sections on one scroll; her app might be in any of them.
2. Types "slack" in "Search apps". → Tile "Slack" with a "Connect" button. Clicks it. → Dialog "Connect Slack" with Cancel and Connect (`ConnectAppDialog.tsx:222-243`).
3. Clicks Connect. → "Step 1 of 3 · Sign in to Slack in the new window. Choose the account to connect, then come back here." with a spinner (`SignInStep.tsx:33-47`). A browser window opens; she signs in to the MOCK workspace and approves.
4. Dialog moves to "Step 2 of 3 · Which bots can use Slack? You can change this later." with every bot checked and "Skip" / "Continue" (`AgentStep.tsx:26-69`). **Hesitation:** All bots start checked, including the Hiring helper, so Continue gives all of them Slack. Clicking Continue is the fast but broad choice.
5. Unchecks MOCK Hiring helper and clicks Continue. → "Slack connected · {workspace} is ready." with ticks "The bots you chose can use Slack." and "Slack now appears under Connected." and "Done" (`ConnectAppDialog.tsx:268-300`). There is no Step 3 label.
6. Clicks "Done". → The Slack card is now under Connected with the account name and "Connected" and a small stack of bot avatars labelled "Used by".

##### Variations
- Pop-up blocked: "Your browser blocked the sign-in window" and "Allow pop-ups for this site, or open the sign-in page directly." with "Open sign-in" (`SignInStep.tsx:80-104`).
- She closes the sign-in window: after a moment "If you closed the sign-in window, try again." with "Try again".
- Catalog not set up and she is not the owner: banner "App connections aren't set up on this server yet. Custom connections still work. Ask the server owner to set up the app catalog." (`IntegrationsHome.tsx:545-556`).

##### Edge Cases
- Sign-in denied or times out: "Sign-in did not finish in time." / "{app} did not accept the sign-in." and "Try again" on the card (`IntegrationsHome.tsx:225-233`).
- "Could not load the app list. Reload to try again."

#### STORY-APP-177: Maya limits Gmail to the Finance helper

**Type**: short
**Topic**: Integrations — which bots can use an app
**Persona**: Naive first-time founder
**Goal**: "Only Chief and the Finance helper should see my mail."
**Preconditions**: Gmail connected; three bots.
**Ideal path**: 2.
**Alternate paths**: The "Continue" step of the connect dialog.

##### Steps
1. Integrations → Gmail card (shows `maya@northwind.example`, "Connected", "Open Inbox", and "Used by" avatars). Clicks the card. → App page with "Accounts", "Add another account", "Used by", "Tools · n" (`components/integrations/AppDetail.tsx:296-360`).
2. In "Used by" turns off the switch for MOCK Hiring helper (aria-label "MOCK Hiring helper can use Gmail"). → Saves at once (`AppDetail.tsx:178-195`). The card's avatar stack drops one.
3. Opens "Tools · 14" and reads "Read — Never changes your account" and "Write — Changes your account".

##### Edge Cases
- Failure: "Could not update bot access".
- Access is per app, not per account (comment at `AppDetail.tsx:183`): two Gmail accounts share one bot list.

#### STORY-APP-017: Maya disconnects her old Gmail address and removes Slack

**Type**: medium
**Topic**: Integrations — remove or disconnect
**Persona**: Naive first-time founder
**Goal**: "Stop the assistants reading my old inbox."
**Preconditions**: Gmail has two accounts (`maya@northwind.example`, `old-maya@northwind.example`); Slack has one.
**Ideal path**: 3 — Gmail page → "Remove account" on the old one → confirm.
**Alternate paths**: "Disconnect Gmail" removes both; Slack uses the same page.

##### Steps
1. Integrations → Gmail. → "Accounts" lists both with "Connected {date}", "Rename" and "Remove account" (`AppDetail.tsx:60-112`).
2. Clicks "Remove account" on `old-maya@`. → Dialog "Remove old-maya@northwind.example?": "Bots lose access to this account.", "Mail data from this account that Praci cached is removed.", "Your data in Gmail is not deleted." (`AppDetail.tsx:404-420`). Confirms "Remove". → Only one account row left.
3. Notices a red "Disconnect Gmail" button at the bottom with "Removes the account and bot access." now that one account is left (`AppDetail.tsx:386-397`). **Hesitation:** With two accounts it said "Removes all 2 accounts and bot access." She misread it as the same as "Remove account".
4. Goes to Slack → "Disconnect Slack" → dialog "Disconnect Slack?" "Every bot loses access to Slack." "Your data in Slack is not deleted." (`AppDetail.tsx:424-445`). Confirms. → Back at Integrations; Slack is gone from Connected.
5. If it was Gmail: the dialog adds "The Inbox page stops showing new mail until you reconnect." (`AppDetail.tsx:438`). The Inbox page later shows its connect state.

##### Variations
- Removing from the Connected list: custom "Remove" on a manual source card shows "Remove {name}?" "Bots lose access to its tools." (`IntegrationsHome.tsx:744-766`).

##### Edge Cases
- Failure: "Could not disconnect" / "Could not remove connector".
- After the last account is removed the page returns to Integrations (`AppDetail.tsx:203`).

#### STORY-APP-018: Maya adds the docs server her engineer sent her

**Type**: medium
**Topic**: Integrations — custom connection
**Persona**: Naive founder forwarding an engineer's instruction ("add this URL")
**Goal**: "Let Chief read our internal docs."
**Preconditions**: URL `https://mcp.mock-northwind.example/mcp` (MOCK stub that accepts OAuth sign-in); Variation B: stub requires a bearer token `mock-token-123`.
**Ideal path**: 3 — Add custom connection → paste URL → Connect.
**Alternate paths**: Settings → Server integrations → "Add server URL" (STORY-APP-019).

##### Steps
1. Scrolls to the bottom, "Anything else": "Add a custom connection — Connect any app that offers an MCP server URL." (`IntegrationsHome.tsx:698-712`). **Hesitation:** "MCP" is unexplained, but the engineer's note used it.
2. Clicks "Add custom connection". → Dialog "Add a custom connection": "Paste the MCP server URL from the app's documentation." with "Server URL" (placeholder `https://example.com/mcp`) and an "Advanced" disclosure (`components/integrations/CustomConnectionDialog.tsx:465-500`).
3. Pastes the URL and clicks "Connect". → Dialog switches to the sign-in step ("Sign in to … in the new window"). She signs in. → Step "Which bots can use …?" with all bots checked; Continue. → "{name} connected".
4. Variation B (token): opens "Advanced", types `mock-token-123` in "Token" ("Only if the server does not use sign-in"), clicks "Connect". → The sign-in step is skipped and she goes straight to choosing bots (`CustomConnectionDialog.tsx:255-262`).
5. Opens the new card on Integrations. → Page shows "via MCP · mcp.mock-northwind.example" with "Reconnect", "Disconnect sign-in", "Rename", "Used by", and "Remove {name}" (`McpDetail.tsx:134-225`).
6. Asks Chief "What does our onboarding doc say about laptops?" → Chief calls the server's tools.

##### Variations
- Wrong text: "Enter the server URL, starting with https://." (`CustomConnectionDialog.tsx:266`).
- Server needs a client ID: the dialog shows "Client ID", "Client secret (optional)" and a "Callback URL" with Copy; message "This server needs an OAuth client ID." (`CustomConnectionDialog.tsx:193,500-540`).
- Unreachable address: the half-created entry is removed and she sees "Could not reach {host}. Check the address and try again." (`CustomConnectionDialog.tsx:205`).

##### Edge Cases
- Sign-in not finished: the entry stays, tagged "Needs reconnect": "{name} was added and shows Needs reconnect until you sign in." (`CustomConnectionDialog.tsx:145`).
- The connection is deleted elsewhere while the page is open: "This connection no longer exists." (`McpDetail.tsx:44`).

#### STORY-APP-178: Maya finds Carta, X, Zernio and Treg tiles

**Type**: short
**Topic**: Integrations — first-party tiles
**Persona**: Naive first-time founder
**Goal**: "Connect Carta so Chief can read our cap table."
**Preconditions**: None of them connected.
**Ideal path**: 2 — Equity → Carta → Sign in.
**Alternate paths**: Cap table page's own connect button (part of Cap table area); `/app/integrations?connect=carta&returnTo=/app/cap-table`.

##### Steps
1. Scrolls to "Equity". → Tile "Carta — Cap table, equity and investors" with "Connect" (`IntegrationsHome.tsx:354-362,638-672`). "Social" holds Zernio and X; "Tools" holds Treg.
2. Clicks "Connect". → Dialog "Connect Carta — Sign in with Carta in the window that opens." with a "Sign in with Carta" button (no URL box) (`CustomConnectionDialog.tsx:470-482`).
3. Signs in. → "Carta connected — The Carta agent can now read your cap table." (`CustomConnectionDialog.tsx:812-818`). No bot choice step: Carta belongs to the Carta agent only (`CustomConnectionDialog.tsx:225-228`). **Hesitation:** She had already picked "which bots can use…" for Slack and wonders why not here.
4. Back on Integrations, the Carta card shows "Open Cap table", and its page has "Allow changes in Carta" off by default; turning it on asks "Allow changes in Carta?" with "Allow changes" (`McpDetail.tsx:178-198,251-262`).

##### Variations
- X: the dialog asks for the Client ID of her own X app plus a Callback URL (`IntegrationsHome.tsx:370-380`). A founder will not have one.
- Treg: asks for an API token ("Connect Treg").

##### Edge Cases
- Already connected: tile is hidden from the sections and shows under Connected.

#### STORY-APP-179: Maya reconnects a connection whose sign-in expired

**Type**: short
**Topic**: Integrations — reconnect
**Persona**: Naive first-time founder
**Goal**: "Chief says it lost access to our docs server."
**Preconditions**: MOCK Docs MCP status "Needs reconnect".
**Ideal path**: 1 — click Reconnect on the card.
**Alternate paths**: The page's "Reconnect" button (`McpDetail.tsx:146-155`).

##### Steps
1. Integrations → card "MOCK DEMO DATA Docs MCP" with the badge "Needs reconnect" and a "Reconnect" button (`IntegrationsHome.tsx:166-175`). Clicks it. → A sign-in window opens; the badge reads "Connecting…".
2. Finishes sign-in. → Badge returns to "Connected".
3. If the server wants a client ID: the "Add a custom connection" dialog opens with Client ID fields (`useMcpReconnect`).

##### Edge Cases
- "Disconnect sign-in" on the page removes the stored sign-in but keeps the entry; status becomes "Needs reconnect".

#### STORY-APP-180: Maya cancels in the sign-in window and sees the callback page

**Type**: short
**Topic**: OAuth callbacks
**Persona**: Naive first-time founder
**Goal**: "Back out of connecting an app halfway."
**Preconditions**: A connect flow with a sign-in window (STORY-APP-018 or 176).
**Ideal path**: 1 — close the window.
**Alternate paths**: Deny on the provider's page.

##### Steps
1. In the sign-in window she clicks "Cancel" at the provider. → The window lands on Praci's callback page: "OAuth connection failed" with "OAuth authorization was cancelled." (or the provider's own error text) and "You can close this window." (`pages/McpOAuthCallback.tsx:22-72`).
2. Returns to the main window. → The dialog shows the failed state with "Try again".
3. If she opened the callback address in a normal tab rather than a popup: the same text plus a "Return to Praci" button.

##### Variations
- Success: the popup shows "Connected" and closes itself (`McpOAuthCallback.tsx:44`). Google apps use a separate page with the same texts (`pages/GoogleOAuthCallback.tsx`).
- While waiting: "Finishing MCP connection…" and "You can close this tab if it does not redirect automatically."

##### Edge Cases
- Not signed in: both callback pages redirect to `/sign-in` (`App.tsx:148-157`).

#### STORY-APP-181: Maya sees "Local command", "OpenAPI" and "GraphQL" in Advanced

**Type**: short
**Topic**: Integrations — other connection types
**Persona**: Naive first-time founder
**Goal**: "Connect our internal tool; the engineer said any of these would work."
**Preconditions**: Add a custom connection dialog open.
**Ideal path**: 3.
**Alternate paths**: Ask the engineer to do it.

##### Steps
1. Opens "Advanced". → "Transport" (Streamable HTTP, SSE), "Auth header", "Header value", "Token", and "Other connection types": buttons OpenAPI, GraphQL, Executor, "Local command", "Search directory" and, when a feed is enabled, "Search by domain" (`CustomConnectionDialog.tsx:538-640`). **Hesitation:** She cannot tell which, if any, applies; no explanation sits next to any button.
2. Clicks "Search directory", types "linear" and presses "Search". → Results with "Connect" buttons, or "No results"; some say "Manual setup required" (`CustomConnectionDialog.tsx:720-790`).
3. Clicks "Local command". → "Add a local command" with "Display name", "Command" (`/opt/mcp-server`) and "Arguments" and an "Add" button. **Hesitation:** She has no idea what command to enter; the dialog accepts anything and adds it.
4. Clicks "OpenAPI". → "Import an OpenAPI description" with "Credentials are encrypted and never sent to the model." and "Verify and add".

##### Edge Cases
- "Enter the command to run." when empty. "Could not search" on directory failure.

#### STORY-APP-182: Maya connects her bank from the Finance tile

**Type**: short
**Topic**: Integrations — Finance tiles
**Persona**: Naive first-time founder
**Goal**: "Let the Finance helper see our Mercury balance."
**Preconditions**: Mercury not connected.
**Ideal path**: 2.
**Alternate paths**: Connect from the Finance page itself (Finance area).

##### Steps
1. Integrations → section "Finance". → Tiles Mercury ("Read balances and transactions"), Brex ("Read cards, expenses and bills"), plus wallet and exchange tiles ("Wallet balances and history", "Read exchange balances") (`components/integrations/FinanceSection.tsx:369-460`).
2. Clicks "Connect" on Mercury. → A sign-in window; on success the tile moves under Connected with "Open Finance".
3. Cancels: the tile reads "Sign-in was cancelled or did not finish. Try again." with "Try again" (`FinanceSection.tsx:390`).

##### Edge Cases
- Crypto tiles ask for an API key (Blockscout "Get an API key", Alchemy "Optional faster balance reads").

#### STORY-APP-019: Maya finds "Set up app catalog" and "Server integrations" are the same page

**Type**: short
**Topic**: Integrations — server setup
**Persona**: Founder who is the deployment owner
**Goal**: "Set up Slack, Notion and GitHub for the whole company."
**Preconditions**: Maya is the deployment owner; no Composio or Pipedream account configured.
**Ideal path**: 3 — Integrations → "Set up app catalog" → Connect.
**Alternate paths**: Settings → General → "Server integrations" → "Open" (`pages/AccountSettingsOverlay.tsx:222-244`); first-run step (part A).

##### Steps
1. Integrations shows "Connect a Composio or Pipedream account to add apps like Slack, Notion and GitHub." and a button "Set up app catalog" (`components/integrations/IntegrationsHome.tsx:523-557`). **Hesitation:** She has no Composio account and does not know what it is.
2. Clicks it. → Page "Server integrations": "Choose how apps connect for everyone on this server." with five options: "Apps with their own server", "Popular apps through Composio", "Popular apps through Pipedream", "Google apps", "Your own tool server" (`components/integrations/IntegrationSetup.tsx:50-75,168-215`). Selecting Composio shows "API key" and "Get credentials" and "Connect"; Pipedream and Google show "Client ID" (and "Project ID" or "Client secret", "Redirect URI").
3. If she has several bots, a select "Bot that gets the apps you connect here" is at the bottom (`pages/IntegrationSetup.tsx:70-86`). "Back" returns to where she came from (`next` in the address).
4. Later opens Settings → General → "Server integrations — Choose how apps connect for everyone on this server. [Open]". **Hesitation:** Two names ("app catalog" and "Server integrations") for one page.

##### Variations
- Not the owner: Integrations says "App connections aren't set up on this server yet. Custom connections still work. Ask the server owner to set up the app catalog." The setup address sends her back to `/app` without a message (`pages/IntegrationSetup.tsx:30-33`).
- Signed out: `/integrations/setup` goes to `/sign-in?next=/integrations/setup` (`App.tsx:149-165`).

##### Edge Cases
- "Could not load integrations", "Could not connect", "Could not load bots. Reload to try again."

### Stories: Settings

#### STORY-APP-191: Maya opens Settings and looks for where things are

**Type**: short
**Topic**: Settings window
**Persona**: Naive first-time founder
**Goal**: "Find the setting for notifications, the model, and my password."
**Preconditions**: Maya is the deployment owner; billing enabled.
**Ideal path**: 1 — one list with plain names.
**Alternate paths**: Cmd+K "Settings" (part A); "/" then "Settings: General" (STORY-APP-153); mic button when voice is not set up (STORY-APP-152).

##### Steps
1. Clicks her name in the sidebar and chooses "Settings". → A large window titled "General" with a left list: General, Models, Memory, Voice, Usage, Billing, Updates (and "Computer" only if computers are unavailable and she is the owner) (`pages/SettingsOverlay.tsx:136-146`). **Hesitation:** "Notifications" is not in the list; it is a switch per bot (STORY-APP-016). The model is under "Models", but "which bots use it" is under each bot's Settings.
2. Clicks "Usage". → The window keeps its size; the title becomes "Usage" and focus moves into the panel (`SettingsOverlay.tsx:129-134`).
3. Presses Escape or the "x" (aria-label "Close user settings"). → Closes. While a Voice or Memory save is running, both the nav and the close button are disabled (`SettingsOverlay.tsx:97,211,233`).

##### Variations
- Phone width: the list becomes a wrapping row above the panel (`SettingsOverlay.tsx:200`).
- Non-owner: no "Computer" tab (it is for the owner only).

##### Edge Cases
- Billing tab hidden when billing is off; the selection falls back to General (`SettingsOverlay.tsx:120-122`).

#### STORY-APP-021: Maya turns on dark mode, tightens the sidebar and changes her password

**Type**: short
**Topic**: Settings — General
**Persona**: Naive first-time founder
**Goal**: "Dark mode, compact sidebar, a new password."
**Preconditions**: Signed in; password sign-in.
**Ideal path**: 3.
**Alternate paths**: Forgot password from sign-in (part A).

##### Steps
1. Settings → General. → Cards in order: "Account" (name, email, "Delete account"), "Password", "AI data sharing" (if applicable), "Appearance", "Language", "Avatars", "Server integrations" (owner only), "Advanced" (`pages/AccountSettingsOverlay.tsx:100-318`). "Messaging" appears after Password only when the server enables it (STORY-APP-190).
2. In "Appearance" clicks "Dark". → Applies at once. Under it "Sidebar density" has "Comfortable" and "Compact"; picks Compact. → The bot rows tighten.
3. In "Password" types "Current password", "New password", "Confirm password" (each at least 8 characters) and clicks "Change password". → Button reads "Changing…", then a check "Password updated" (`AccountSettingsOverlay.tsx:395-470`). Other sessions are signed out (`revokeOtherSessions: true`, `:417`). **Hesitation:** The screen does not say her other devices were signed out.
4. In "Avatars" picks "Robot" instead of "Organic". → Every bot's picture changes.

##### Edge Cases
- Mismatch: "Passwords do not match". Wrong current password: the server's message or "Could not change password". No server: "Could not reach the server".
- The Password card is missing for an account that signs in only with SSO (`AccountSettingsOverlay.tsx:121`); "Link SSO" appears under Account if SSO exists and is not linked (`components/AccountAccess.tsx:78`).
- Avatars fail: "Couldn't update avatars".

#### STORY-APP-184: Maya switches the app to Español and finds English left over

**Type**: short
**Topic**: Settings — language
**Persona**: Naive founder whose team reads Spanish
**Goal**: "Run the whole app in Spanish."
**Preconditions**: Settings → General.
**Ideal path**: 1 — pick Español.
**Alternate paths**: none found.

##### Steps
1. In "Language" opens the select. → Ten languages in their own names: English, Deutsch, 한국어, Türkçe, हिन्दी, Português (Brasil), 简体中文, Español, Русский, Français (`lib/ui-locale.ts:15-26`). Arrow keys, Home, End and Enter work (`AccountSettingsOverlay.tsx:550-690`).
2. Picks Español. → Most labels switch at once. About half of the 1,739 message ids in the Spanish catalog have no translation yet and fall back to English (counted from `locales/es/messages.po`; approximate).
3. Goes back to Chief's chat. → Table controls ("Copy rows", "Download CSV", "Sort by Amount", "1–10 of 14 rows") stay English (`packages/chat-ui/src/markdown-table.tsx:196-262`). Bot greetings and card text written by the server also stay English (`apps/api/src/onboarding.ts`).

##### Edge Cases
- Two quick picks: only the last one wins (`localeRequestRef`, `AccountSettingsOverlay.tsx:88-95`).

#### STORY-APP-185: Maya turns off AI data sharing and the bot stops with an odd message

**Type**: short
**Topic**: Settings — AI data sharing
**Persona**: Privacy-minded first-time founder
**Goal**: "Stop sending our documents to an AI service."
**Preconditions**: The deployment model provider is listed as an AI recipient, consent granted.
**Ideal path**: 2.
**Alternate paths**: Inbox consent prompt "Let Praci sort your mail" with "Allow" / "Not now" (`components/AiDataSharing.tsx:66-85`).

##### Steps
1. Settings → General → "AI data sharing". → Text: "Messages, chat history, bot instructions, memories, attachments, screenshots and connected-app content are sent to run your bots, including routines." and one switch per service named "Allow {name}" (`AiDataSharing.tsx:95-130`, `packages/contracts/src/ai-consent.ts:8-9`). If no service is listed the whole card is absent. **Hesitation:** She cannot tell what turning it off will do to Chief.
2. Turns the switch off. → The change saves at once with no confirmation.
3. Sends Chief a message. → The run is blocked. The text defined for this block is "Review AI data sharing in Account settings before continuing." (`packages/contracts/src/ai-consent.ts:40`, `packages/core/src/ai-consent.ts:65`). Where exactly it appears (composer banner or run error) was not run. **Hesitation:** There is no place called "Account settings"; the card is under Settings → General.
4. Turns it back on and resends.

##### Edge Cases
- Switch fails: the error text shows under the heading.

#### STORY-APP-186: Maya considers deleting her account

**Type**: medium
**Topic**: Settings — delete account
**Persona**: Naive first-time founder who signed up with a test email
**Goal**: "Remove the test account and its data."
**Preconditions**: Test MOCK account with a password; variant with SSO only.
**Ideal path**: 3.
**Alternate paths**: none found (no export before delete).

##### Steps
1. Settings → General → "Account". Clicks the red "Delete account" under her email. → A panel opens with "This permanently deletes your account and data." (`components/AccountAccess.tsx:84-100`). **Hesitation:** Two buttons share the label "Delete account": the first opens the panel, the second does the deletion.
2. Password account: types "Current password". The second "Delete account" button enables only with a password (`AccountAccess.tsx:183-189`). Clicks it. → She is sent to `/sign-in` with no extra confirmation (`AccountAccess.tsx:202`).
3. SSO-only account: sees "Sign in again" first and, if email deletion is on, "Send deletion code" and then a "Deletion code" field (`AccountAccess.tsx:128-176`).

##### Variations
- Wrong password: the server's message or "Could not continue".

##### Edge Cases
- Sign-in options fail to load: "Could not load sign-in options." with "Retry" (`AccountAccess.tsx:96-110`).
- The page does not say what happens to the Northwind data if she is the only owner.

#### STORY-APP-020: Maya switches to a stronger model with her own API key

**Type**: medium
**Topic**: Settings — Models
**Persona**: Founder told by a friend "use your own Anthropic key"
**Goal**: "Make the answers better; use my company's key."
**Preconditions**: A deployment model is active; MOCK key `sk-MOCK-DEMO-DATA-0001` accepted by a stub provider.
**Ideal path**: 4 — Models → provider → key → Use this model.
**Alternate paths**: Per-bot model in bot Settings → Advanced (STORY-APP-161); the first-run "Connect a model" (part A).

##### Steps
1. Settings → Models. → A line "Choose which connected model Praci uses." Then "Active model {name} {provider}" and, when set, "Thinking: …"; "Configured by deployment" when the model comes from the server. Below, a collapsed "Data room search model". Left list "Providers" with "Search providers", groups "Connected" and "All providers" (`pages/ModelSettingsOverlay.tsx:1135-1225`). **Hesitation:** "Thinking", "Providers" and "Data room search model" mean nothing to her.
2. Types "anthropic" in "Search providers" and clicks the provider. → Right pane: "Connect this provider to use it as your personal model." then an "API key" field (placeholder `sk-…`) and, for providers that can be checked, a "Test API key" button (`ModelSettingsOverlay.tsx:1020-1075`, `components/ModelConnectionPreflightNotice.tsx:34`).
3. Pastes the key and clicks "Test API key". → "Testing…", then a success or failure line. Clicks "Connect API key". → "Connected and using {model}." in green (`ModelSettingsOverlay.tsx:1204-1215`, notice at `:139`). Below: "Connected · {label}" and "Stored securely. Never shown here.", plus model and thinking pickers.
4. Picks a model and clicks "Use this model" (`ModelSettingsOverlay.tsx:1103-1130`). → "Now using {model}." and "Active model" updates.
5. Opens a bot's Settings → Advanced → Model. **Hesitation:** Settings → Models changes the default; each bot may still override it ("Space default ({model})").
6. Back to Models → provider → "Disconnect". → Dialog "Disconnect {name}?" "This removes the connection from every space." (`ModelSettingsOverlay.tsx:1485-1512`).

##### Variations
- The provider the server already uses: "This space already uses {name}." with a "Use your own key" disclosure (`ModelSettingsOverlay.tsx:1436-1456`).
- An OpenAI-compatible server: "Server URL", "Find models", "Models from server", "Other model…", "Model id" (`ModelSettingsOverlay.tsx:1240-1335`).
- A subscription provider shows a sign-in button and a code box "Authorization code or callback URL" with "Submit".
- "Data room search model": an "Embedding model" box that saves when she leaves it (`ModelSettingsOverlay.tsx:1543-1600`).

##### Edge Cases
- Short key (under 8 characters): "Connect API key" stays disabled with no message.
- Catalog empty: "No model catalog is available." Save fails: "Could not connect this provider".

#### STORY-APP-183: Maya adds a backup model in case the first one fails

**Type**: short
**Topic**: Settings — backup models
**Persona**: Naive first-time founder
**Goal**: "If the main model is down, still get an answer."
**Preconditions**: Two models connected (APP-020).
**Ideal path**: 3 — pick, Add, Save backups.
**Alternate paths**: none found.

##### Steps
1. Scrolls to the bottom of Models → "Backup models" (`pages/ModelBackupsSettings.tsx:249`). → "Add connected models to use them as backups." (or "Connect a provider to add backups." if none).
2. Opens "Add connected model" (a select with "Select a connected model"), picks one, clicks "Add". → A row with up and down buttons (aria-labels "Move {model} up/down") and "Remove" (`ModelBackupsSettings.tsx:267-330`).
3. Clicks "Save backups". → "Backup models saved." **Hesitation:** Nothing says in what order or after what kind of failure a backup is used.

##### Edge Cases
- Maximum is 10: "Maximum of 10 backup models." A model whose provider was disconnected shows "Not connected".
- Failures: "Could not load backup models", "Could not save backup models" with "Retry"; changing space while open: "Space changed. Reopen Models to save its backup list."

#### STORY-APP-188: Maya opens Memory settings and sees provider jargon

**Type**: medium
**Topic**: Settings — Memory
**Persona**: Naive first-time founder
**Goal**: "See what Praci remembers and make sure it forgets one thing."
**Preconditions**: No memory provider connected. Chief and Finance helper each have memory documents.
**Ideal path**: 2 — scroll to the document list, open one.
**Alternate paths**: Per-bot Memory tab (STORY-APP-162).

##### Steps
1. Settings → Memory. → Text "Manage the Space semantic memory provider." and a form: "Provider" (only when more than one), "Default scope" with "Isolated" / "Shared", and the provider's fields (Supermemory: "Cloud" / "Local", "Base URL", "Organization API key"; Serenity: "MCP endpoint", "Bearer token", "Brain label", "Allow writing") and "Connect" (`pages/MemorySettingsOverlay.tsx:155-246`, `pages/memory-providers/*Form.tsx`). **Hesitation:** She wants to see memories, not set up a service. The words "semantic", "Space", "scope" and "Supermemory" are all new.
2. Scrolls past the form. → The list of documents grouped under "Shared documents" and each bot's name, with a "Filter memory" box (shown once any document exists) and "Download as markdown" (`pages/KnowledgeSection.tsx:63-120`).
3. Types "investor" in "Filter memory". → Matching documents; "No matches" otherwise.
4. Opens a document and edits (same rules as STORY-APP-162).

##### Variations
- A provider is connected: the card reads "Connected", the provider label, "Default scope" and "Disconnect".
- "The selected memory provider is not available in this build."

##### Edge Cases
- Failures: "Could not connect {name}", "Could not disconnect memory provider", "Could not update the default memory scope".

#### STORY-APP-189: Maya connects a voice provider and hears a sample

**Type**: medium
**Topic**: Settings — Voice
**Persona**: Naive first-time founder who arrived from the mic button
**Goal**: "Make the mic work and hear replies read aloud."
**Preconditions**: A MOCK voice API key accepted by a stub.
**Ideal path**: 4.
**Alternate paths**: Per-bot "Read replies aloud" and "Voice" (STORY-APP-161).

##### Steps
1. Settings → Voice (or arrives from the mic). → Left list "Providers", each tagged "Speak + transcribe" or "Speak only"; a "Connected" tag for linked ones (`pages/VoiceSettingsOverlay.tsx:205-255`). Right pane "Loading voice providers…".
2. Clicks a "Speak + transcribe" provider. → "API key" field (placeholder "Paste your API key") and a "Connect" button.
3. Pastes the key and clicks "Connect". → "Connecting…", then "Connected {name}." and the pane gains a "Voice" select, an optional "Speech model" (one provider only), and "Hear a sample".
4. Clicks "Hear a sample". → "Playing…", it speaks "Hi, this is how I'll sound when I read replies out loud.", then "If you heard that, voice is ready." (`VoiceSettingsOverlay.tsx:170-182`).
5. Closes Settings. Clicks the mic in Chief's chat. → The call card appears (STORY-APP-152). Reply bubbles now show a "Speak" link (`pages/Shell.tsx:7603-7612`).

##### Edge Cases
- "Replace key" and "Disconnect" for a linked provider. Failures: "Could not connect this voice provider", "Could not save that voice", "Could not play a test clip".
- While a save is running the Settings nav is locked (STORY-APP-191).

#### STORY-APP-187: Maya opens "Updates" and finds nothing

**Type**: short
**Topic**: Settings — Updates
**Persona**: Naive first-time founder using the web app
**Goal**: "Check that I have the latest version."
**Preconditions**: Web (not the desktop app); hosted server (not a sidecar install).
**Ideal path**: 1.
**Alternate paths**: Desktop app shows "Desktop app" with the version and "Check for updates" (`components/DesktopUpdates.tsx:138-170`).

##### Steps
1. Settings → Updates. → The panel is empty: neither section renders (`pages/AccountSettingsOverlay.tsx:382-392`, `components/DesktopUpdates.tsx:130`, `components/SoftwareUpdateSection.tsx:132-160`). The tab itself is always listed. **Hesitation:** She thinks it is broken.
2. On the desktop app she sees "Desktop app", the version, "Check for updates", then "Up to date" or "Restart to update" (`DesktopUpdates.tsx:138-170`). The owner of a self-hosted install also sees "Software update" with "Check for updates" and "Update" and the messages "Up to date" / "Update available".

##### Edge Cases
- "Checkout has local changes. Clean it before updating." and "The API did not come back. Refresh this page." for the software update.

#### STORY-APP-190: Maya links a chat app (feature flag on)

**Type**: short
**Topic**: Settings — Messaging
**Persona**: Naive first-time founder
**Goal**: "Text Chief from WhatsApp."
**Preconditions**: Server messaging enabled; otherwise the section is absent.
**Ideal path**: 3.
**Alternate paths**: none found.

##### Steps
1. Settings → General → "Messaging" → "Manage messaging settings". → An overlay "Messaging" with "Chat apps", "Channels", "Agent connections", "Team conversations" (`pages/MessagingSettingsOverlay.tsx:98-340`).
2. Under "Chat apps" picks "Choose a bot…" → Chief, clicks "Link a chat app". → "Send 7K4Q to the line from your chat app within 10 minutes. You'll get a confirmation reply once linked." (code is MOCK.) **Hesitation:** "The line" is not defined; the only hint is the list of provider names printed above the buttons.
3. Later a group invite appears under "Channels" with "Approve" and "Decline"; after approval a "Leave" button.

##### Edge Cases
- "No chat apps linked yet.", "No group chats yet.", "No agent connections yet.", "No team conversations yet." "Couldn't load messaging settings".
- Team conversation "Settings" opens per-room options: "Listening" (default, Listen, Mentions only), "Room guidance", "Automated senders" with handling "Ignore / Group updates / Always act / Treat like a person" (`pages/ExternalConversationSettings.tsx:55-235`).

#### STORY-APP-022: Maya checks what she pays and how much she used

**Type**: short
**Topic**: Settings — billing and usage
**Persona**: Founder watching burn
**Goal**: "When does my trial end, and how much did we use?"
**Preconditions**: Billing enabled, Trial with 5 days left; usage of 41 runs and 120k tokens (MOCK).
**Ideal path**: 2.
**Alternate paths**: User menu "Usage" opens Settings at Usage; the slash entry "Settings: Usage" (STORY-APP-153).

##### Steps
1. Settings → Billing. → A card with the heading "Trial", a price line (for example "$20 / month · 2 seats" when there is more than one seat), "Trial ends Oct 22", and a "Manage" button (shown only for an owner of the billing account with a customer record) (`pages/BillingSettingsPanel.tsx:76-120`). Clicks "Manage". → Browser goes to the payment provider's portal; on the desktop app it opens in the system browser and the button re-enables.
2. Settings → Usage. → "41 runs · 120,000 tokens" and the line "Model spend uses your provider keys." (`AccountSettingsOverlay.tsx:336-351`). **Hesitation:** She never added a key; the line suggests she pays a provider herself.

##### Variations
- State words: Trial, Active, Past due, Canceled, Inactive; dates "Ends {date}" or "Renews {date}" (`BillingSettingsPanel.tsx:48-62,74-87`).
- Member who cannot manage billing: no "Manage" button and no explanation.

##### Edge Cases
- "Could not load billing" (the Skeleton disappears), "Could not open billing".
- Usage not loaded: only the key line shows. Tokens unknown: "— tokens".

#### STORY-APP-023: Maya tries to invite her cofounder

**Type**: short
**Topic**: Members and invites
**Persona**: Naive first-time founder
**Goal**: "Add Sam (cofounder) so we share Chief and the data room."
**Preconditions**: Shared seed; second MOCK person "Sam Patel, sam@northwind.example" with no account yet; billing shows 2 seats.
**Ideal path**: 3 — Settings → Members → invite email. This does not exist.
**Alternate paths**: none found. No invite or member screen exists in `apps/web/src`; the only "invited" in the web app is a messaging channel status (`pages/MessagingSettingsOverlay.tsx:210`).

##### Steps
1. Looks in Settings (General, Models, Memory, Voice, Usage, Billing, Updates). → No Members tab.
2. Opens Billing and sees "2 seats" next to the price. **Hesitation:** She assumes seats are people and looks for how to fill them. There is no control (`BillingSettingsPanel.tsx:78-90`).
3. Tries "+" → "New space" hoping it is shareable. → "Private workspace with its own bots and groups." No invite.
4. Sees "Computer: Team / Private" under bot Advanced. **Hesitation:** She reads "Team" as sharing with her team (STORY-APP-161).
5. Result to record: she cannot finish the goal. Sam would have to sign up separately and would see none of her bots.

##### Edge Cases
- Sam signing up with the same email shows the normal sign-up errors (part A).

### Stories: End-to-end

#### STORY-APP-025: Maya produces and sends a monthly investor update

**Type**: long
**Topic**: Chat, tables, quotes, approvals, notifications
**Persona**: Naive first-time founder before a deadline
**Goal**: "Get a draft investor update with a burn table, check it, and email it to investors."
**Preconditions**: Full seed; Gmail connected; Chief can send mail with approval; "Ask before sending external email" set (STORY-APP-158); MOCK investor list `investors@mock-northwind.example`; browser notifications allowed.
**Ideal path**: 6 — ask → review → refine → approve email → confirm sent.
**Alternate paths**: Compose in Inbox ("New message") and paste; ask the Leadership group (STORY-APP-015); copy with "Copy rows" (STORY-APP-014).

##### Steps
1. In Chief: "Draft our September investor update with a burn table from the finance data." → Streams a reply with a table and possibly a file card. Status line says "Thinking", then "Writing".
2. Sorts the table by Amount; "Copy rows" and pastes into a sheet (STORY-APP-014).
3. Selects the sentence "runway is 14 months" and clicks "Quote": "Use the real runway number from Finance." (STORY-APP-151). → Revised version.
4. Reacts 👍 on the final version (STORY-APP-013).
5. "Email this to investors@mock-northwind.example." → An approval card for mail appears (To, Cc, Bcc, Subject, Message with "Edit", "Send", "Discard"; prior STORY-031..033). Edits the subject and clicks "Send". → "Sending…" then "Sent by you" (`components/MailApprovalCard.tsx:190-225`).
6. Switches to Finance while it sends. A browser notification appears when Chief finishes (STORY-APP-016).
7. Opens Inbox → Sent to confirm.
8. Opens Artifacts from the sidebar to find the saved draft for next month.
9. Opens Chief → Bot computer → creates a monthly routine "MOCK Monthly investor update" (STORY-APP-172).

##### Variations
- Mail fails: "Not sent" with "Not confirmed as sent. Check Sent in your mail before trying again." and "Open in composer" (`MailApprovalCard.tsx:460-475`).
- Turn off sending: the "More" menu has "Disable sending for Chief"; a note says "Sending is off for Chief. Turn it back on in its tools." (`MailApprovalCard.tsx:448-492`).

##### Edge Cases
- Approval card answered on another device (prior STORY-044).
- "Copy" in "More" gives no feedback (STORY-APP-013), so she may paste stale text.
- She leaves the chat before sending: her typed follow-up is lost (STORY-APP-012).

### Redundancy Candidates (this area)

- **"Server integrations" vs "Set up app catalog"** are one page reached from three places (Settings card, Integrations banner, sign-in redirect) with two names (STORY-APP-019).
- **Two "Delete account" buttons** in one card (STORY-APP-186).
- **Settings → Voice vs bot "Read replies aloud" / "Voice"** vs the mic call button: three voice entry points with different meanings (STORY-APP-152, 161, 189).
- **Model choice in four places:** Models settings, bot Advanced, routine "Advanced" popover, first-run model step (STORY-APP-020, 161, 173).
- **Memory in two places:** bot Advanced "Memory" tab and Settings → Memory both list and edit documents (STORY-APP-162, 188).
- **"Reply" appears as both a hover icon and a "More" menu entry** (STORY-APP-013).
- **Two ways to open bot Settings:** clicking the chat title and "Edit profile" in the row menu.
- **Chat Settings, Settings: General, Settings: Usage** appear in the slash list while the same screens are in the user menu (STORY-APP-153).
- **Eight sections on Integrations home** where only "Connected", "Find an app" and "Anything else" differ in function; Finance, Social, Equity and Tools are first-party groups (STORY-APP-176, 178, 182).
- **Three save styles in one bot Settings panel:** blur autosave for text fields, an explicit Save for model and voice, immediate save for tools (STORY-APP-161).

### Suspected problems (this area)

Each was read in code; none was run in a browser unless the story says so.

1. **Group copy is wrong.** The "Groups" info says "They all reply in the same thread" (`pages/shell/dialogs.tsx:204`), but with no mention only the first member answers (`packages/core/src/group-mentions.ts:52-54`). (STORY-APP-011, 168)
2. **Reactions cannot be undone and are not buttons.** Every click adds a message; a repeat click raises the count (`packages/core/src/message-reactions.ts:20-38`, `apps/api/src/thread-target.ts:1020-1064`, `pages/Shell.tsx:6037-6056`). (STORY-APP-013)
3. **"Up" recall likely includes reactions.** The history uses every user message, and a reaction is a user message with the emoji as text (`pages/Shell.tsx:1989-1999`, `apps/api/src/thread-target.ts:1046`). (STORY-APP-154)
4. **Typed draft is lost when you switch chats.** The composer is keyed by chat and holds the draft in local state (`pages/Shell.tsx:3206,6236`). (STORY-APP-012)
5. **Unsupported attachments are skipped with no reason.** The notice lists the name only (`pages/Shell.tsx:2305-2312`). Accepted types exclude Word, Excel and PowerPoint (`packages/contracts/src/attachments.ts:14-23`). (STORY-APP-155)
6. **Two drop targets look alike.** The composer accepts files as attachments; anywhere else in the window the file goes to the Data room (`components/data-room/DropZone.tsx:55-60`). (STORY-APP-155)
7. **Slash list has no keyboard handling.** Enter sends "/usage" as a message (`pages/Shell.tsx:6905-7060`). (STORY-APP-153)
8. **Bot Settings mixes autosave and manual save.** Name, Title, Description, Notifications and tools save on their own; Model, Thinking, Computer, Read replies aloud, Voice and Memory scope need "Save", and leaving loses them with no warning (`pages/shell/bot-panel.tsx:392,628-642`). (STORY-APP-161)
9. **Advanced hides credentials and the main model switch.** Credentials, model and tools live under "Advanced" (`bot-panel.tsx:443-621`). (STORY-APP-159, 161)
10. **Routines are only reachable through the "Bot computer" icon,** under a screen preview (`pages/Shell.tsx:4299,4577-4620`). Blank name and instruction save as "Routine" and "Check in." (`Shell.tsx:4760-4761`), and Save gives no confirmation. (STORY-APP-172)
11. **Disabled "Slack message" trigger gives no way to fix it.** Tooltip "Slack not enabled" only (`RoutineEditor.tsx:567-580`). (STORY-APP-173)
12. **"Updates" tab is empty for most users.** It is always listed, but both sections return nothing unless desktop or owner on a sidecar install (`pages/SettingsOverlay.tsx:139`, `components/DesktopUpdates.tsx:130`). (STORY-APP-187)
13. **Consent error names a screen that does not exist.** "Review AI data sharing in Account settings" (`packages/contracts/src/ai-consent.ts:40`); the card is in Settings → General. (STORY-APP-185)
14. **Connect dialog numbering stops at step 2.** "Step 1 of 3", "Step 2 of 3", then an unnumbered done screen; Carta says "of 2" (`components/integrations/SignInStep.tsx:14`, `AgentStep.tsx:26`). All bots start checked in step 2, so the quick path gives every bot the app. (STORY-APP-176)
15. **Two accounts, one bot list.** Access is set per app, not per account (`AppDetail.tsx:183`). (STORY-APP-177)
16. **Remove vs Disconnect wording is easy to confuse** when one account is left (`AppDetail.tsx:386-397`). (STORY-APP-017)
17. **Language switch leaves English** in chat tables and server-written text; about half of the Spanish catalog is untranslated (`locales/es/messages.po`). (STORY-APP-184)
18. **Tool activity is hidden by default and stored only in the browser** (`lib/tool-activity-preference.ts:35-37`), so a long run looks idle on a second device. (STORY-APP-156)
19. **Approval rule buttons look like actions, not toggles,** and a second click is silent (`components/ApprovalRulesSettings.tsx:46-58,117-130`). (STORY-APP-158)
20. **Billing prints a seat count with no way to add a person** (`pages/BillingSettingsPanel.tsx:78-90`). (STORY-APP-023)
21. **Copy gives no feedback.** The message "Copy" and the Export download show nothing (`pages/Shell.tsx:7258-7262`, `bot-panel.tsx:645`). (STORY-APP-013, 166)
22. **Mic button starts a call, not dictation** (`pages/Shell.tsx:3224-3238`); without a voice provider it jumps to Settings. (STORY-APP-152)

## Area: Cross-feature journeys (STORY-APP-nnn)

**Generated**: 2026-10-17. **Code read at**: `559a76ad` (branch docs/ux-pass).
**Total stories**: 16 (short 4, medium 5, long 7). Ids STORY-APP-200 to 214, plus the rewritten STORY-APP-024.
**Source of truth**: the area catalogs written on 2026-10-17: `inbox/catalog.md` (STORY-INB), `finance/catalog.md` (STORY-FIN), `legal/catalog.md` (STORY-LEG), `captable/catalog.md` (STORY-CAP), `dataroom/catalog.md` (STORY-DRM), `app/catalog-a.md` and `app/catalog-b.md` (STORY-APP). Labels and routes are taken from those files and spot-checked against the code (`HideAmountsToggle.tsx:12,58` "Hide amounts"/"Show amounts"; account menu at the bottom of the sidebar; Legal tabs Contracts, Deadlines, Graph).

### Changes since the 2026-10-16 catalog

- **Changed**: STORY-APP-024 "Maya's Monday morning across the whole app" is rewritten. The old version assumed "Import from email" exists on `main`, and it did not name the real card labels. It now follows the area catalogs (Inbox agent panel, Finance Ask panel, Cap table, Data room, Chief) and marks the PR #109 steps.
- **Moved to the area catalog**: STORY-APP-025 (monthly investor update by Chief) stays in `catalog-b.md`. The new STORY-APP-210 is the longer version that starts from the Finance and Cap table pages and ends in an approval-gated Inbox send.
- **Added**: STORY-APP-200 to 214 (all new cross-feature journeys).
- **Dropped**: none.

### Preconditions used by these journeys

- Persona: Maya Chen, "Northwind Robotics", a first-time founder. Mock people: Luis Park at Acme Logistics (`luis@acme-logistics.example`), Priya Shah (investor, Harbor Ventures), counsel Ellis Law (`counsel@ellis-law.example`), cofounder Sam Lee.
- **PR #109 (`origin/feat/legal`)** adds the Data room buttons "Import from email" and "Import from Google Drive" (icon-only on the Data room header), the agent tool `add_to_data_room`, and the Legal page. Every step that uses them is tagged **[needs PR #109]**. On `main` today there is no Legal tab and no import control (STORY-INB-016, STORY-LEG-020, STORY-DRM-041).
- Hide amounts is one browser-side switch (account menu row, the eye on Finance and Cap table). It does not hide everything (see Suspected problems).
- Seeds named as in the area catalogs: A1 Inbox account, M-numbers for mail (M3 Luis demo mail, M6 signed MSA, M9 board prep, M2 Invoice #4471), D2 Legal deadlines, NW-BASE Finance, `carta-connected` Cap table.

### Summary

Fifteen new journeys plus the rewritten Monday morning. Short ones (200, 201, 203, 204) test one seam between two areas. Medium ones (202, 205 to 208) test a repeated assumption: that a thing done in one place shows up in another. Long ones (209 to 214, 024) are whole days a founder would have: first day, investor update, board prep, contract renewal, phone-only day, diligence packet, Monday.

### Coverage Matrix

| Seam | Stories | Linked area stories | Gaps |
| --- | --- | --- | --- |
| Email attachment to Data room to Legal | 200, 205, 212, 214, 024 | INB-016, DRM-020, DRM-043, LEG-018 | Legal does not read mail on its own (S-LEG-04) |
| Hide amounts across areas | 201, 202, 211 | FIN-024..031, INB-034, CAP-021, CAP-033, DRM-034, LEG-026 | no Hide amounts control on Inbox or Legal pages |
| Ask the page agent vs Chief | 203, 209, 213 | FIN-006, APP-157, APP-124 | two assistants with different tools |
| Approval-gated send | 204, 210, 212 | INB-020, INB-028, APP-158 | Inbox agent cannot skip the card; Chief can be set to ask |
| Delete in one area, effect in another | 206 | LEG-028, DRM-017 | no warning on delete |
| Connect once, use everywhere | 207, 209 | INB-001, DRM-041, FIN-001, CAP-003, APP-182 | five doorways, five wordings |
| Consent / AI data sharing | 208 | INB-002, DRM-009, LEG-004 | no single place to see all consents |
| Whole-day journeys | 024, 209..214 | most | none found |

### Story Dependency Graph

200 -> 205 -> 212. 207 -> 209. 201 -> 202 -> 211. 203 -> 210 -> 214. 204 -> 212. 208 -> 206. 024 and 213 stand alone.

---

### Stories: Short seams between two or three features

#### STORY-APP-200: Maya moves a signed contract from an email into Legal

**Type**: short
**Topic**: Inbox to Data room to Legal
**Persona**: Maya, who has a signed MSA in Luis's email and has heard that Praci "knows about contracts"
**Goal**: "Make my signed MSA show up in the contracts list with its dates."
**Preconditions**: **Requires PR #109 (origin/feat/legal).** A1; M6 "Acme_Northwind_MSA_signed.pdf"; Gmail connected; Data room consent given (STORY-DRM-009); Legal consent given.
**Ideal path**: 5 — open mail, Data room, import, Legal, Scan now.
**Alternate paths**: drag the downloaded PDF onto any page (STORY-INB-016); let the Inbox agent do it (STORY-DRM-044); ask the Legal agent (it lists the email but cannot add it, STORY-LEG-018).

##### Steps
1. Opens M6 in the Inbox, sees the chip "Acme_Northwind_MSA_signed.pdf 3.4 MB". She expects a "Save to Data room" action; the chip only downloads (STORY-INB-016). **Hesitation:** she does not know the Data room is where Legal looks.
2. Opens **Data room**, clicks the envelope icon (aria label "Import from email"), searches "Acme", ticks the PDF, clicks **Import** (STORY-DRM-020). A notice reads "Imported 1 file".
3. Opens **Legal** (`/app/legal`). The tile "Unreviewed documents" shows 1. She expects the contract to appear at once. It does not until **Scan now** is clicked (STORY-LEG-005, S-LEG-01).
4. Clicks **Scan now**. The page polls; the row "Master Services Agreement" appears under Contracts with parties and a next deadline.

##### Variations
- Consent not given on Legal: the card "Let the Legal agent read your documents" blocks Scan now until **Allow** (STORY-LEG-004).
- No Gmail connection: the Data room button reads "Connect Gmail" (STORY-DRM-041).

##### Edge Cases
- On `main` (no PR #109) step 2 does not exist; the path is download, drag, upload, and there is no Legal page (STORY-LEG-020).

#### STORY-APP-201: Maya hides amounts, then screenshots Finance and Cap table

**Type**: short
**Topic**: Hide amounts across Finance and Cap table
**Persona**: Maya, about to send a screenshot to an advisor
**Goal**: "Take two screenshots with no dollar figures in them."
**Preconditions**: NW-BASE Finance connected; `carta-connected` with a saved snapshot.
**Ideal path**: 4 — account menu, Hide amounts, Finance screenshot, Cap table screenshot.
**Alternate paths**: eye icon on Finance or Cap table (same switch, STORY-FIN-024, CAP-021).

##### Steps
1. Clicks her name at the bottom of the sidebar, then **Hide amounts** (STORY-FIN-025). The row now reads "Show amounts".
2. Opens Finance: Cash, Burn, Runway show "$•••"; the eye icon is crossed out. Takes screenshot one.
3. Opens Cap table: money cards are masked, the ownership bar still shows Maya 62.0 percent and the others as proportions (STORY-CAP-021, Suspected problems in that catalog). **Hesitation:** she wanted "no figures" and the percentages are figures.
4. Takes screenshot two. Opens the account menu and clicks **Show amounts** when done; both pages unmask without reload.

##### Variations
- Runway "7.9 mo" and "Until May 2027" are not currency, so they show (STORY-FIN-027).

##### Edge Cases
- A different browser profile starts with amounts shown (STORY-CAP-033).

#### STORY-APP-203: Maya asks Chief about runway, then checks it on Finance

**Type**: short
**Topic**: Chief vs Finance page
**Persona**: Maya who does not know there is more than one assistant
**Goal**: "Tell me how long our money lasts, and let me see where that number comes from."
**Preconditions**: Mercury connected (STORY-FIN-001), NW-BASE; Chief has Finance tools.
**Ideal path**: 3 — ask Chief, read answer, open Finance runway.
**Alternate paths**: **Ask** button on Finance (the Finance agent panel).

##### Steps
1. In Chief's chat types "When do we run out of money?" The reply gives a runway and a month.
2. Opens **Finance**, clicks **Runway** (`/app/finance/runway`). Sees Cash, Monthly burn, Runway, Run-out, the dashed projection and the list "Financing — Excluded" (STORY-FIN-006).
3. Compares: Chief said "about 8 months" and the page says "7.9 mo, Until May 2027". She wonders if they are the same number. **Hesitation:** one is Chief's rounding, the other the page's calculation; nothing says so.

##### Variations
- She clicks **Ask** on the runway page instead: the Finance agent panel opens with its own thread, so the earlier answer is not there (STORY-APP-167).

##### Edge Cases
- Mercury token expired: the page shows a yellow dot on the chip and Chief says it cannot read balances (STORY-FIN-022).

#### STORY-APP-204: Maya approves an email, then checks that it left

**Type**: short
**Topic**: Approval card, Activity, Inbox
**Persona**: Maya
**Goal**: "Send Luis 'Friday works' and be sure it went."
**Preconditions**: A1; AGENT-READY; pending card CARD-PENDING (STORY-INB-020).
**Ideal path**: 3 — Send on the card, bell, Inbox Sent.
**Alternate paths**: write it herself (STORY-INB-009).

##### Steps
1. In the Inbox agent panel reads the card "Mail Needs approval · luis@acme-logistics.example" and clicks **Send**. The header folds to "Approved to send" (STORY-INB-020).
2. Switches to Finance. When the run ends, the bell shows the run under "Finished" (STORY-APP-124). **Hesitation:** nothing says the email left; the card still says "Approved to send".
3. Returns to Inbox and opens M3: "Later in this conversation" shows her reply (STORY-INB-027). Now she believes it.

##### Variations
- Tab hidden when the run ends: browser notification "finished" (STORY-APP-126).

##### Edge Cases
- Gmail rate limit: "Gmail is limiting requests right now" (STORY-INB-018); the card stays "Approved to send" while mail waits.

---

### Stories: Medium seams

#### STORY-APP-202: Maya hides amounts and checks every page for leaks

**Type**: medium
**Topic**: Hide amounts sweep
**Persona**: Maya, careful before an investor Zoom
**Goal**: "Make sure no dollar amount shows anywhere on my screen."
**Preconditions**: A1 with M2 "Invoice #4471" ($4,820.00 due Nov 10); NW-BASE; `carta-connected`; DR-SEEDED with "Invoice NW-1042 Acme Servo Supply.pdf"; **Legal part requires PR #109**, D2.
**Ideal path**: 2 per page in the best case; the real path is a sweep of 8 pages because no page says what is covered.
**Alternate paths**: none found.

##### Steps
1. Account menu, **Hide amounts**. Helper text: "Hides amounts on finance screens and masks currency amounts in chat text. Plain numbers in agent replies may still show."
2. Finance dashboard and a month page: masked (STORY-FIN-027).
3. Crypto and accounts: masked (STORY-FIN-028).
4. Cap table: money masked, proportions visible (STORY-CAP-021).
5. Inbox list: M2 still reads "$4,820.00 due Nov 10" in the preview; opening M2 shows "$•••" (STORY-INB-034). **Hesitation:** the helper names "finance screens", not email.
6. Data room: opens the invoice; Amount reads "$•••"; a scanned image reads "Image hidden while amounts are hidden" (STORY-DRM-034).
7. **[needs PR #109]** Legal Deadlines: a row such as "Early termination fee $12,000" is shown unmasked and there is no eye icon on the page (S-LEG-12).
8. Chief's chat: asks "what did we spend on hosting?" The currency amount is masked, a plain "4,820" may not be (STORY-FIN-029).
9. Turns it off in the account menu; everything returns.

##### Variations
- On a phone, the toggle is in the same account menu inside the drawer (STORY-FIN-030).

##### Edge Cases
- Subjects and list previews in Inbox, and the email cards in the Inbox agent panel, are never masked.

#### STORY-APP-205: A Legal deadline sends Maya back to the email

**Type**: medium
**Topic**: Legal to Inbox
**Persona**: Maya
**Goal**: "Legal says a trademark response is due Nov 14. Show me the email that says so and answer it."
**Preconditions**: **Requires PR #109.** D2 with "Trademark office action response" 2026-11-14 (due in 29 days, today 2026-10-16); Gmail connected; the notice email exists only in the Inbox.
**Ideal path**: 4 — Legal, Deadlines, find email in Inbox, forward to counsel.
**Alternate paths**: ask the Inbox agent "find the trademark email" (STORY-INB-019).

##### Steps
1. Opens **Legal**, clicks **Deadlines**. Sees "Trademark office action response · Due in 29 days" with a grey line naming the contract and a quote (STORY-LEG-007).
2. Looks for a link to the email. Only "Open document" appears for Data room files; the notice was found in mail and is only in the Agent's chat reply (S-LEG-04, STORY-LEG-018). **Hesitation:** she assumes the page is built from her mail.
3. Goes to **Inbox**, types "trademark" in the search box, finds the email, opens it (STORY-INB-033).
4. Clicks **Forward**, types `counsel@ellis-law.example`, adds "Please respond by Nov 14", clicks **Send** (STORY-INB-011).
5. Back on Legal, the deadline still shows open. She clicks **Done**: "Marked Trademark office action response done." with **Undo** (STORY-LEG-012). **Hesitation:** she is marking it done because she forwarded it, not because the filing happened.

##### Variations
- She clicks **Dismiss** by mistake and uses **Undo** within 8 seconds.

##### Edge Cases
- Done/Dismiss cannot be reopened after the Undo disappears (S-LEG-06).

#### STORY-APP-206: Maya deletes a Data room file and her Legal dates disappear

**Type**: medium
**Topic**: Data room delete and Legal cascade
**Persona**: Maya tidying folders
**Goal**: "Remove the duplicate lease PDF."
**Preconditions**: **Requires PR #109.** D2; Data room has two copies of "Office lease 2024.pdf" (one scanned in Legal); STORY-DRM-017 setup.
**Ideal path**: 2.
**Alternate paths**: ask the Legal agent to dismiss the date instead (STORY-LEG-029).

##### Steps
1. Opens Data room, searches "lease", sees two rows with identical names. Deletes the one with the older date (STORY-DRM-017).
2. Opens Legal. The lease contract, its "Renews" and "Renewal notice deadline" rows and its graph box are gone (STORY-LEG-028). **Hesitation:** "Did the app lose my renewal date?"
3. She goes back to the Data room; the other copy is present but unscanned; **Unreviewed documents** is now 1.
4. Clicks **Scan now**; the lease and dates return.

##### Variations
- She deleted the scanned copy. Manual deadlines linked to that contract are deleted too (S-LEG-12).

##### Edge Cases
- Two tabs: a folder deleted in another tab makes her next upload fail with "Upload failed" and no reason (STORY-DRM-028).

#### STORY-APP-207: Maya connects Gmail once and expects it everywhere

**Type**: medium
**Topic**: Connection doorways
**Persona**: Maya
**Goal**: "I connected my email. Why does every page still ask?"
**Preconditions**: Fresh account; no connections. **Data room steps need PR #109.**
**Ideal path**: 3 for the first doorway; real path is 5.
**Alternate paths**: connect from Chief's "Authorize" card (STORY-APP-001).

##### Steps
1. Opens **Inbox**: "No mail connected"; clicks **Connect mail** (`/app/integrations?q=gmail`, STORY-INB-001). Connects Gmail.
2. Opens **Data room**: buttons "Choose files", "Connect Gmail", "Connect Google Drive". The Gmail button still says "Connect Gmail" until the page is reloaded; the list of connections is read once (STORY-DRM-041).
3. Opens **Legal**: an agent scan can see mail only for the owner's own run (STORY-LEG-018).
4. Opens **Finance**: "No accounts yet" with **Add account**. Gmail is not a bank, and she cannot tell that Mercury needs a different sign-in (STORY-APP-182).
5. Opens **Cap table**: "Connect Carta" (STORY-CAP-003).
6. Opens Integrations: three separate Connect flows for her three apps; each reads "Connect" and none says it only enables one page.

##### Variations
- Gmail limited to the Finance helper (STORY-APP-177): Chief and the Inbox agent lose mail; Inbox shows the list but the agent says it cannot read it.

##### Edge Cases
- She disconnects Gmail in Integrations (STORY-APP-017): Inbox falls back to "No mail connected"; the Data room button changes after reload.

#### STORY-APP-208: Maya is asked three times to "allow" her documents to be read

**Type**: medium
**Topic**: Consent cards across Inbox, Data room, Legal
**Persona**: Maya who clicks Allow without reading
**Goal**: "Let the app use my documents once, and stop asking."
**Preconditions**: A1 with a model; Data room seeded; **Legal needs PR #109**.
**Ideal path**: 1 if the consent is shared; real path is 3.
**Alternate paths**: Settings, Account, "AI data sharing" (STORY-INB-026).

##### Steps
1. Inbox: card "Let Praci sort your mail"; she clicks **Allow** (STORY-INB-002).
2. Data room: card "Let Praci read your documents"; only **Allow** is offered, no **Not now** (STORY-DRM-009, S-DRM-09).
3. **[needs PR #109]** Legal: card "Let the Legal agent read your documents". The Data room and Legal consent are the same underlying consent, shown with different wording; granting it on one releases waiting items on the other (S-LEG-08, STORY-LEG-004). The Inbox consent is separate (`AiDataSharing` switch per model).
4. She opens Settings, Account, "AI data sharing" to see them all. The page lists one switch per model ("Allow {model name}") and does not list the Data room or Legal grants (STORY-INB-026).
5. She switches the model switch off. The Inbox groups vanish; the Data room card behaviour is not described in any area catalog. **Unverified:** whether the Data room consent changes too.

##### Variations
- She clicks **Not now** in the Inbox card: it returns next visit (STORY-INB-002).

##### Edge Cases
- Providers changed while the Data room page was open: Allow returns CONFLICT with no explanation (S-LEG-08).

---

### Stories: Long journeys

#### STORY-APP-209: Maya's first day, from sign-up to "when do we run out?"

**Type**: long
**Topic**: Onboarding, Gmail, Mercury, Chief
**Persona**: Naive founder, day one
**Goal**: "Sign up, connect my email and my bank, and have the assistant tell me how long our money lasts."
**Preconditions**: Fresh server with a model (STORY-APP-001 setup); MOCK Gmail and MOCK Mercury accounts for Northwind.
**Ideal path**: 14 — sign up, choose "Run my company", Authorize Gmail, Finance, Mercury, ask.
**Alternate paths**: skip the focus card and type (STORY-APP-110); connect Mercury from the Integrations tile (STORY-APP-182); ask the Finance panel instead of Chief.

##### Steps
1. Opens `/`, reads "Bots that run your inbox, cash, cap table and investor documents.", clicks **Sign up →** (STORY-APP-001).
2. Types Name "Maya Chen", Email, Password; clicks the eye ("Show password"); clicks **Create account**. Sees "Loading…" then "Opening chat…". **Hesitation:** two plain loading screens.
3. Lands in Chief's thread. Reads "Hi Maya, I'm Chief. I can sort your email, keep an eye on cash and the cap table…".
4. Sees the card "What do you want me on first?" and clicks **A "Run my company"** (STORY-APP-002).
5. Chief offers Gmail and Google Calendar cards with **Authorize**. Clicks **Authorize** on Gmail; the button reads "Waiting…"; approves in the popup.
6. Chief says to open Finance and Cap table to connect bank and Carta.
7. Clicks **Finance** (`/app/finance`): "No accounts yet" and **Add account** (STORY-FIN-001).
8. Clicks **Add account**: sections Bank (Mercury, Brex, Upload statements) and Crypto. Clicks Mercury; the sign-in window opens; approves.
9. Finance shows "Reading…" then the dashboard with Cash, Burn, Runway. Clicks the refresh icon; "Syncing…" then "Updated just now" (STORY-FIN-003).
10. Clicks **Inbox**: skeleton rows, then mail grouped Today/Earlier. The card "Let Praci sort your mail" appears; she clicks **Allow** (STORY-INB-002) and sees "Sorting your mail…" (STORY-INB-025).
11. Opens **Cap table**: "Connect Carta"; she does not have a Carta account yet. Skips it (STORY-CAP-002).
12. Returns to Chief and types "When do we run out of money?" The reply gives runway and a month.
13. Clicks the bell: "Activity" block lists the run under "Finished" (STORY-APP-124).
14. Opens Finance, **Runway** to compare (STORY-APP-203). **Hesitation:** Chief says "about 8 months", the page "7.9 mo".
15. Sidebar tour: Inbox, Finance, Cap table, Data room, Artifacts, bot list. She asks herself where the Legal page is; it is absent on `main` (STORY-LEG-020).
16. Logs out from the user menu; signs back in; Chief's thread is still there (STORY-APP-107).

##### Variations
- Mercury sign-in cancelled: tile reads "Sign-in was cancelled or did not finish. Try again." (STORY-APP-182).
- Popup blocked: connect card shows a failure (STORY-APP-111).

##### Edge Cases
- Subscription required: paywall appears before step 3 (STORY-APP-004).
- The server has no model: setup asks her to connect one (STORY-APP-108).

#### STORY-APP-210: Maya produces and sends the monthly investor update from the pages

**Type**: long
**Topic**: Finance, Cap table, Data room, Inbox send with approval
**Persona**: Maya, month-end
**Goal**: "Send investors a September update with cash, burn, runway, who owns what, and the board deck attached."
**Preconditions**: NW-BASE Finance; `carta-connected` with snapshot; Gmail connected; Data room has "Board deck Q3.pdf"; contacts list has investors (STORY-CAP-009); Carta agent exists. **The import part needs PR #109.**
**Ideal path**: 10 — figures, draft, attach, approve, confirm.
**Alternate paths**: Chief drafts everything (STORY-APP-025); the Carta agent's skill "Draft this month's investor update" (STORY-CAP-018).

##### Steps
1. Opens **Finance**, reads Cash, Burn, Runway. Clicks **Burn** and clicks a month for the detail page (STORY-FIN-004, 005).
2. Notes the numbers in her head: she will need them as text. Clicks **Ask** on Finance: "How much did we burn last month?" The Finance agent answers.
3. Opens **Cap table**, reads the ownership bar and SAFEs (STORY-CAP-014, 015).
4. Clicks the Carta agent panel suggestion "Draft this month's investor update" (STORY-CAP-018). The agent calls `finance_overview`, reads the cap table and contacts, flags a missing investor, asks for highlights and lowlights.
5. Answers in chat. The agent saves a Gmail draft to Maya with investors in Bcc. **Hesitation:** it is only a draft; it never sends (STORY-CAP-018).
6. Opens **Inbox** and finds the draft. Opens it in the composer (STORY-INB-013).
7. Wants to attach the board deck. Opens **Data room**, searches "board deck", downloads "Board deck Q3.pdf" (STORY-DRM-013).
8. Returns to the composer, attaches the file. A 12 MB deck gives "Attachments can't be over 10 MB." (STORY-INB-011 variation). She compresses it elsewhere, re-attaches.
9. Fixes the subject. Clicks **Send**; "Sending… Undo" shows (STORY-INB-010).
10. Alternatively asks the Inbox agent "send this to investors". A card "Mail Needs approval" appears; she edits the subject with **Edit** and clicks **Send** (STORY-INB-020, 028).
11. Checks the Sent search; opens the thread.
12. Goes back to Cap table and sees nothing changed there; the update is not recorded anywhere in Cap table or Finance (no link between them).
13. **[needs PR #109]** The Data room could instead import the deck from an earlier email thread (STORY-DRM-020).
14. Opens **Artifacts** to see whether the draft was saved; it was not, because the agent saved a Gmail draft, not an artifact (STORY-APP-006).

##### Variations
- Hide amounts on while she reviews with Sam on a shared screen (STORY-APP-201).
- Carta not connected: she types the cap table by hand into the email.

##### Edge Cases
- Send fails: message returns to the composer (STORY-INB-029).
- Chief "Always ask before sending email" is set (STORY-APP-158): changes nothing for the Inbox agent, which always asks.

#### STORY-APP-211: Maya prepares for the board meeting

**Type**: long
**Topic**: Board prep across Inbox, Cap table, Finance, Data room, Legal
**Persona**: Maya, two days before the board call
**Goal**: "Know the numbers, the open issues and the agenda, and not show amounts on the call."
**Preconditions**: A1 with M9 "Board prep" thread; NW-BASE; `carta-connected`; Data room with "Board minutes Q2 2026.pdf"; **Legal needs PR #109** with D2 (overdue "Q3 board consent signature").
**Ideal path**: 12.
**Alternate paths**: Cap table board prep skill (STORY-CAP-020); Chief group "Leadership" (STORY-APP-015).

##### Steps
1. Opens **Inbox**, filters to **Important**, opens M9 "Board prep" and reads the thread (STORY-INB-008, 007).
2. Clicks **Reply all**, writes "Moving prep to 4pm", clicks **Send**; uses **Undo** to change to 4:30 (STORY-INB-010).
3. Opens **Cap table**, checks the Series Seed row and the option pool; "Unallocated pool 900,000" repeats in the card (STORY-CAP-015).
4. Asks the Carta agent "Prepare me for the board" (STORY-CAP-020). It reads ownership, cash and runway from Finance tools, lists open items.
5. Opens **Finance** and **Runway** to confirm the agent's numbers (STORY-FIN-006).
6. Opens **Data room**, searches "board minutes", opens the preview, downloads (STORY-DRM-019 step 5).
7. **[needs PR #109]** Opens **Legal**, **Deadlines**. Sees "Q3 board consent signature" with the red pill "Overdue by 6 days". Clicks **Done** (STORY-LEG-007).
8. Back in Inbox, clicks **Forward** on the board consent email to counsel (STORY-INB-011).
9. Asks Chief "Draft talking points from what we just looked at". Chief does not see the earlier agents' threads (STORY-APP-167). **Hesitation:** she repeats the numbers.
10. Chief replies with a table; she uses **Copy rows** (STORY-APP-014).
11. Turns on **Hide amounts** before the call (STORY-APP-201). Opens Cap table; clicks the Investors tab for names only (STORY-CAP-033).
12. Collapses the agent panel, because a later reply may show plain numbers (STORY-CAP-033 step 6).
13. During the call, a new email arrives; the Inbox list gains it with a small notice (STORY-INB-037).
14. After the call she turns **Show amounts** back on.

##### Variations
- Phone only: skip steps 3 to 7; the list pages work but the dense tables need scrolling (STORY-INB-031, STORY-DRM-030).

##### Edge Cases
- The Inbox agent panel lists "Invoice #4471 … $4,820" in a card even with amounts hidden (STORY-INB-034).

#### STORY-APP-212: A contract renewal, from email to Legal deadline to an approved reply

**Type**: long
**Topic**: Inbox, Data room, Legal, approval-gated reply
**Persona**: Maya, whose office lease renewal notice has arrived by email
**Goal**: "Know when the renewal option expires, tell the landlord yes, and not miss the date."
**Preconditions**: **Requires PR #109.** A1; M-lease "Office lease renewal option" from the landlord (`leasing@halcyon-logistics.example`, MOCK) with the PDF "Office lease renewal option.pdf"; Gmail connected; consents given; Data room empty of the lease.
**Ideal path**: 12.
**Alternate paths**: the Inbox agent files the attachment on its own (STORY-DRM-044); ask Legal agent for the dates (STORY-LEG-016).

##### Steps
1. Opens **Inbox**, sees the notice in "Needs reply". Opens it; reads "Please confirm renewal by 30 November".
2. Taps the PDF chip; it downloads. Only the chip downloads (STORY-INB-015).
3. Opens **Data room**, clicks the envelope ("Import from email"), searches "lease", ticks the PDF, clicks **Import** (STORY-DRM-020). Notice "Imported 1 file". Row shows "Reading".
4. Sets Type to `contract` in the filter to confirm it was classified (STORY-DRM-014).
5. Opens **Legal**. Tile "Unreviewed documents" shows 1. Clicks **Scan now** (STORY-LEG-005).
6. Watches the scan; the **Deadlines** tab now has "Renewal notice deadline · Due in 45 days" and "Renews" in January (STORY-LEG-013). A grey note: "Derived from the expiration date and the notice period."
7. Opens **Graph**, clicks the landlord box to read the quote (STORY-LEG-014).
8. Clicks **Ask agent** and types "What do we owe the landlord and when?" (STORY-LEG-016).
9. Back to **Inbox**, opens the notice, clicks **Reply**, types "We confirm renewal. Please send the countersigned copy." (STORY-INB-009).
10. Instead asks the Inbox agent "reply yes to this". A card "Mail Needs approval" appears; she clicks **Edit**, changes the wording, clicks **Send** (STORY-INB-028). Header reads "Sent by you".
11. A week later the landlord replies with the countersigned PDF. She imports it (steps 2 to 3) and rescans; **Renews** updates to the new date (STORY-LEG-013).
12. In Legal, clicks **Done** on "Renewal notice deadline" (STORY-LEG-012).
13. Asks the Legal agent to "tell me when it renews" next quarter (STORY-LEG-017).

##### Variations
- The scan reads the PDF text with no year ("31 January") and creates no dates (S-LEG-02).
- The landlord's mail has the date only in the body: it is reported in chat and never recorded (S-LEG-04).

##### Edge Cases
- Maya deletes the lease from the Data room: contract and deadlines vanish (STORY-APP-206).
- Gmail needs reconnecting at step 10: "Gmail needs to be reconnected" (STORY-INB-017).

#### STORY-APP-213: Maya runs her day from her phone only

**Type**: long
**Topic**: Phone width across the whole app
**Persona**: Maya at an airport
**Goal**: "Handle email, check cash and equity, and ask for a task without opening the laptop."
**Preconditions**: Full seed (A1, NW-BASE, `carta-connected`, Data room seeded); phone width 390 px.
**Ideal path**: 14.
**Alternate paths**: palette Cmd+K is not available on a phone.

##### Steps
1. Opens the app. The sidebar is a drawer; she taps the menu icon to see Inbox, Finance, Cap table, Data room (STORY-APP-121).
2. Taps **Inbox**. Agent panel is closed even if she left it open on the laptop (STORY-INB-032). Reads the To do card (STORY-INB-040).
3. Taps **Important**, opens M3, taps **Reply**, types "Friday 2pm works.", taps **Send** (STORY-INB-040 step 5).
4. Taps **More** on a newsletter, **Mark noise** (STORY-INB-005).
5. Taps **Ask**; the panel covers the page. Asks "What did Priya say about the term sheet?" (STORY-APP-134).
6. Taps **Finance**. Reads Cash, Burn, Runway. Taps the eye icon to hide amounts because a stranger is looking (STORY-FIN-030).
7. Taps **Runway** and reads the sentence (STORY-FIN-006).
8. Taps **Cap table**. Because Carta is on, the agent panel is a full-screen view; she taps the name button to open it (STORY-CAP-023).
9. Taps **Data room**. The folder is a pill, not a tree; taps it to pick `Finance` (STORY-DRM-030).
10. Searches "lease" in the sidebar search and taps the document result (STORY-APP-119).
11. Taps back; the browser Back goes through folders (STORY-DRM-025).
12. Opens Chief, types "Remind me Friday to send the update" (STORY-APP-153).
13. Chief asks "Allow once / Always allow this tool / Deny" in a card; she taps **Allow once** (STORY-APP-157).
14. Taps the bell: the run is listed under "Working" (STORY-APP-124).
15. Locks her phone. A browser notification arrives when the run ends only if notifications were allowed (STORY-APP-127).
16. Taps **Show amounts** off when done.

##### Variations
- Offline: the app shows a connection banner (STORY-APP-142).

##### Edge Cases
- Dense tables (Cap table, Data room grid) need horizontal scroll (STORY-CAP-022).

#### STORY-APP-214: Maya assembles a fundraising diligence packet

**Type**: long
**Topic**: Data room, Finance, Cap table, Legal, Inbox
**Persona**: Maya in Series A diligence for MOCK Harbor Ventures
**Goal**: "Send Harbor Ventures all customer contracts, the cap table, three bank statements and board minutes."
**Preconditions**: **Parts need PR #109.** S1 + S2 Data room, three statements July to September in `Finance / Bank statements`; model + consent; Gmail connected; `carta-connected`.
**Ideal path**: 18 — the ask is large and the product has no packet or share link (STORY-DRM-022).
**Alternate paths**: share the Data room (not built).

##### Steps
1. Reads Priya's email in Inbox: "Please send customer contracts, cap table, last three bank statements, board minutes." Opens M-diligence (STORY-INB-008).
2. Opens **Data room**, picks Type `contract`; the list shows Contracts (STORY-DRM-015). She cannot select all or bulk download (STORY-DRM-019).
3. **[needs PR #109]** Opens **Legal** to check which contracts are active: Contracts tab, "Active 3" (STORY-LEG-014). Notes two names missing from Data room.
4. Imports the missing two from Gmail with the envelope button (STORY-DRM-020).
5. Back in Data room, searches "cap table"; a file shows **Failed** (STORY-DRM-008). Cannot retry.
6. Opens **Cap table**, with Carta on, clicks **Refresh from Carta** (STORY-CAP-025). Looks for an Export; none. Asks the Carta agent to "summarise the cap table in a table" and uses **Copy rows**.
7. Folders: opens `Finance`, then the sub-folder `Bank statements`; downloads three PDFs (STORY-DRM-011).
8. Searches "board minutes"; downloads (STORY-DRM-019).
9. Opens **Inbox**, **Compose**, picks the From account (STORY-INB-012). Attaches all downloads. Exceeds the size limit; sends two emails instead (STORY-INB-011).
10. Alternatively uploads to Google Drive and shares there; the Data room cannot (STORY-DRM-022).
11. Hides amounts before sharing screen on a call with her lawyer (STORY-APP-201).
12. On the call, asks Chief "Which contracts end in the next 6 months?" Chief answers from what it can read; Legal's table is faster (STORY-LEG-011).
13. Replies to Priya with "Sent in two emails." (STORY-INB-009).
14. Next day Priya asks "everything from Harbor Ventures"; Maya picks the Party "MOCK Harbor Ventures" (STORY-DRM-019 edge).
15. Marks the thread done by archiving; uses Undo once (STORY-INB-004).

##### Variations
- Priya asks to see "the room". Maya looks for **Invite** or **Share** and finds none (STORY-DRM-022).

##### Edge Cases
- Over 50 MB: "Over the 50 MB limit" (STORY-DRM-004).

---

### Stories: Rewritten (kept id)

#### STORY-APP-024: Maya's Monday morning across the whole app

**Type**: long
**Topic**: Moving between features
**Persona**: Naive founder, second week of use
**Goal**: "Check email, cash and equity, file the signed SAFE, and leave Chief a to-do."
**Preconditions**: Full shared seed with 3 unread MOCK mails (one with attachment "Signed SAFE.pdf"); NW-BASE; `carta-connected`. **Steps tagged [needs PR #109] use Data room import.**
**Ideal path**: 10 — Inbox, open mail, file attachment, Finance, Cap table, Chief, ask, done.
**Alternate paths**: download and drag onto any page (STORY-INB-016); ask the Inbox agent panel instead of Chief; Cmd+K to reach bots (STORY-APP-008).

##### Steps
1. Signs in; `/app` opens Chief (STORY-APP-107).
2. Clicks **Inbox**; badge shows 3. Rows grouped by Today/Earlier with a "Needs reply" group when sorting is allowed (STORY-INB-002). The Inbox agent panel is on the right.
3. Opens the SAFE mail (`?mail=<id>`). **Hesitation:** two assistants, the Inbox agent and Chief.
4. Wants it filed. **[needs PR #109]** Data room, envelope ("Import from email"), ticks the PDF, **Import** (STORY-DRM-020). On `main`: downloads it and uses **Choose files** (STORY-INB-016).
5. Clicks **Finance**; reads Cash, Burn, Runway; the Finance panel offers **Ask** (STORY-FIN-002).
6. Clicks **Cap table**; looks for the SAFE in the SAFEs list (STORY-CAP-015). It is not there until Carta syncs; she clicks the **Refresh from Carta** icon (STORY-CAP-025).
7. Presses Cmd+K, types "Chief", Enter (STORY-APP-008).
8. Types "Remind me Friday to send the Q3 investor update". Chief may offer a routine; she accepts (STORY-APP-172).
9. Clicks the bell to see the run, then the bell again (STORY-APP-124).
10. **[needs PR #109]** Opens **Legal**, **Deadlines**, checks that nothing is overdue (STORY-LEG-007).
11. User menu, **Artifacts**, opens last week's update draft (STORY-APP-129).
12. Logs out.

##### Variations
- Phone: STORY-APP-213 and STORY-INB-040.

##### Edge Cases
- Each feature page has its own agent panel, so "the assistant" is a different bot on each page (STORY-APP-167).

---

### Redundancy Candidates (this area)

- Five different "Connect" doorways for five different connections (STORY-APP-207).
- The same document consent appears as three cards with three wordings (STORY-APP-208).
- Hide amounts has three controls (account menu, eye on Finance, eye on Cap table), and none on Inbox, Data room list or Legal (STORY-APP-202).
- Chief, the Inbox agent, the Finance agent, the Carta agent and the Legal agent all answer money and mail questions with different tools (STORY-APP-203, 211).

### Suspected problems (this area)

New ones, found at the seams between areas.

1. **Hide amounts coverage is invisible and uneven.** The helper text names "finance screens" and chat; Inbox subjects, previews and agent cards stay unmasked (STORY-INB-034), Cap table proportions stay visible (CAP-021), and Legal has no eye icon at all (S-LEG-12). A founder cannot learn from the UI which pages are covered. STORY-APP-202.
2. **Legal reads only what is in the Data room, and Data room import does not tell Legal.** After "Imported 1 file", Legal still waits for **Scan now** and the tile only says "Unreviewed documents" (S-LEG-01). No link from the Data room import notice to Legal. STORY-APP-200, 212.
3. **Deleting a Data room file silently deletes contracts and manual deadlines in Legal** (S-LEG-12, STORY-LEG-028) and the Data room's delete confirm does not warn. STORY-APP-206.
4. **Three consent cards for the same idea.** The Inbox "Let Praci sort your mail" consent is stored per model in Settings; the Data room and Legal use a shared consent with a different card. Granting one does not grant the other and there is no combined view. STORY-APP-208.
5. **Each page agent has its own thread, and Chief cannot see them.** A founder who analysed numbers with the Finance panel and then asks Chief gets no context (STORY-APP-167). STORY-APP-203, 211.
6. **Connection state is read once per page open.** Connecting Gmail and returning to the Data room shows "Connect Gmail" until reload (STORY-DRM-041); Finance, Cap table and Legal each re-read at different times. STORY-APP-207.
7. **No packet or share concept anywhere.** A diligence request needs Legal, Data room, Cap table and Finance; the product offers download buttons per file and a per-email 10 MB limit, so the founder repeats many manual steps (STORY-DRM-019, 022; INB-011). STORY-APP-214.
8. **Draft-only investor updates look like sends.** The Carta agent's update ends as a Gmail draft (STORY-CAP-018), the Inbox card says "Approved to send" rather than "Sent" (INB-020), and Chief's mail approval uses a third card. Three outcomes for "email the investors" with different words. STORY-APP-204, 210.
9. **Legal deadlines have no way back to their source email.** Findings in mail are reported only in chat (S-LEG-04), so the deadline row cannot link to the message that created it. STORY-APP-205.
