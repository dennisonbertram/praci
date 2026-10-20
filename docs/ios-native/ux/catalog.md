# UX Path Catalog: Praci iOS (native, planned)

Generated: 2026-10-20

Status: planning only. No Swift code exists. Every story below describes planned behavior, built from the design boards in `docs/design-system/ios/boards/`, the build brief and phased plan in `docs/ios-native/`, and the existing Expo app. Nothing here was observed in a running native app. Epic: #427. Phase issues: #412 to #426 (phase N is issue 412+N).

Inputs: `docs/ios-native/ux/discovery.md` and the ten topic files in `docs/ios-native/ux/topics/`. Story IDs below are catalog IDs (STORY-001 to STORY-108, assigned in topic order). Each story keeps a **Source** line pointing to its original topic-local ID.

**Total Stories**: 105 unique stories (108 written; 3 merged as duplicates, see "Merged stories").

**Coverage**: 24 of 32 feature areas are fully covered (75%); 5 more are partially covered (so 29 of 32, or 91%, have at least one story); 3 have no story. Details are in the Coverage Matrix. Phases #412, #413 and #426 have no user interface to walk, so no story is expected for them.

## Summary by Type

| Type | Count | Meaning |
| --- | --- | --- |
| short | 32 | One feature exercised in roughly 3 to 6 steps |
| medium | 52 | One flow with variations, roughly 5 to 10 steps |
| long | 21 | End-to-end session across several features or display modes |
| **Total** | **105** | 108 written minus 3 merged (1 long, 2 medium merged away) |

## Summary by Topic

| Topic | Stories | Story IDs | Primary phase issue |
| --- | --- | --- | --- |
| First run: server, sign in and recovery | 10 | 001 to 010 | #414 |
| Home, Personnel and spaces | 10 | 011 to 020 | #415 |
| Thread: read and live | 12 | 021 to 032 | #416 |
| Thread: send, attachments and offline | 12 | 033 to 044 | #417 |
| Approvals and AI data consent | 10 (011 written, 1 merged) | 045 to 055 | #417 |
| Inbox triage and compose | 11 | 056 to 066 | #418 |
| Team Computer, artifacts, pages, routines | 11 | 067 to 077 | #420 |
| Finance, Legal, Cap table, Data room | 9 | 078 to 086 | #424 |
| Settings, models, voice, integrations | 10 (11 written, 1 merged) | 087 to 097 | #421 |
| iPhone Duo and device adaptation | 10 (11 written, 1 merged) | 098 to 108 | #419 |

## Summary by Device

Counts use the first device named in the Device field of the 105 surviving stories.

| Device | Stories |
| --- | --- |
| Standard iPhone (393 pt) | 76 |
| iPhone Duo outer display (466x678 pt) | 18 |
| iPhone Duo inner display, flat (890x626 pt) | 6 |
| iPhone Duo half-folded (1/2 + 1/2) | 1 |
| iPhone Duo laptop pose (626x890 pt) | 4 |

Duo is the declared primary target, yet 76 stories start on a standard iPhone because the standard-iPhone layouts are mostly not drawn (see Design Gaps, #415, #416 and #419). Several of those stories also describe a Duo variation.

## Coverage Matrix

Feature areas come from the Feature Map in `docs/ios-native/ux/discovery.md`, plus four areas that discovery names outside the map (global search, notification list and preferences, onboarding cards, usage and billing). Status: **Covered** means at least one story exercises the main path. **Partial** means a story touches it only as an alternate path, edge case or setting. **None** means no story.

| # | Feature area | Phase | Stories | Status | Gap |
| --- | --- | --- | --- | --- | --- |
| 1 | Scaffold, tokens | #412 | none | N/A (no UI) | Light mode and Dynamic Type are not walked by any story |
| 2 | Contracts export | #413 | 010, 028 (indirect) | N/A (no UI) | Older-server and unknown-block behavior only |
| 3 | Server selection | #414 | 002, 006, 009, 010 | Covered | |
| 4 | Sign in, sign up, reset, SSO | #414 | 001, 003, 004, 005, 008 | Covered | |
| 5 | Home (Inbox row, Activity, Personnel) | #415 | 011, 013, 012 | Covered | Saved snapshot and Activity "See all" have no story outcome |
| 6 | Spaces (list, switch, create) | #415 | 015, 016 | Covered | No switcher board |
| 7 | Create bot, create group | #415 | 012, 014, 104 | Covered | |
| 8 | Bot and group settings, archive, sections, pins | #415 | 017, 018, 020 | Covered | Group delete and section removal only as edge cases |
| 9 | Thread read | #416 | 021 to 032 | Covered | |
| 10 | Thread write (composer, attachments, outbox, reactions, replies, stop) | #417 | 033 to 044 | Covered | |
| 11 | Approvals (tool, mail, secret, MCP, choice) | #417 | 045, 046, 047, 050, 051, 053, 054 | Covered | Always-allow review (055) has no planned screen |
| 12 | AI data consent prompt | #417 | 048, 094, 052 | Covered | Prompt has no board |
| 13 | Inbox list (sections, filters, search, swipe) | #418 | 056, 060, 064, 063 | Covered | |
| 14 | Inbox message | #418 | 057 | Covered | |
| 15 | Compose, reply, forward, to-dos | #418 | 058, 059, 061, 065 | Covered | Compose has no board |
| 16 | Inbox cleanup and unsubscribe | #418 | 062 | Covered | Scope in phase 6 unconfirmed |
| 17 | Duo layouts (outer, inner, half-folded, laptop) | #419 | 029, 030, 064, 085, 098 to 108 | Covered | Laptop pose only drawn for Finance |
| 18 | Team Computer | #420 | 067, 068, 102 | Covered | |
| 19 | Artifacts (browse, versions, share, delete, image) | #420 | 069, 070, 071, 072, 108 | Covered | |
| 20 | Agent pages and lists | #420 | 073, 074 | Covered | |
| 21 | Routines | #420 | 075, 076 | Partial | No routines list, history or create/edit story |
| 22 | Settings (account, models) | #421 | 087, 088, 089, 090, 007, 095 | Covered | Account, password, archived bots have no board |
| 23 | Integrations | #421 | 093, 097 | Covered | |
| 24 | Push | #422 | 106 | Partial | No story for permission prompt, banner suppression for the open thread, or Activity dot |
| 25 | Voice (dictation, call loop, settings, player) | #423 | 091, 092, 052 | Partial | No dictation or call-loop story; no call screen board |
| 26 | Finance | #424 | 078, 079, 103 | Covered | |
| 27 | Legal | #424 | 080, 081 | Covered | |
| 28 | Cap table | #424 | 082 | Covered | |
| 29 | Data room | #424 | 083, 084 | Covered | |
| 30 | Platform extras (Live Activities, App Intents, share extension, widgets) | #425 | 106 (mention only) | None | No story; no boards |
| 31 | Release (TestFlight, screenshots) | #426 | none | N/A (no UI) | |
| 32 | Global search (`search.query`, jump) | #416 | 031, 060 (mail search only) | Partial | Cross-thread search results screen is not drawn or walked |
| 33 | Notification list and preferences | #422 | none | None | Only a settings specimen in DS-05 |
| 34 | Onboarding choice cards and focus prompts (`onboarding/*`) | #415 | 054 (choice card only) | Partial | `onboarding/*` flow has no story |
| 35 | Usage and billing | #421 | none | None | Billing decision (in-app purchase vs web) is open |

Counting rule: rows 1, 2 and 31 are not applicable, leaving 32 areas. Covered: rows 3 to 20, 22, 23, 26 to 29 = 24. Partial: rows 21, 24, 25, 32, 34 = 5. None: rows 30, 33, 35 = 3.

## Story Dependency Graph

Read "A -> B" as "B assumes the state A produces". IDs are catalog IDs.

```
Install, signed out
  006 server unreachable / capabilities fail
  002 custom server  (-> back to 001)
  010 older API server
  009 Duo setup with custom server (-> 001)
  001 sign in
    003 SSO              004 sign up (+ verify)      005 reset password
    008 session rejected (re-enter at 001)
    -> 011 Home (needs-me, Activity approve)
         013 Home load failure / recovery
         012 first bot (empty Home)
           -> 019 no model connected
                -> 089 connect hosted provider  -> 088 default model  -> 090 local server
                -> 040 send with no model, connect, resend
           -> 044 first message from empty thread (-> 027 empty thread read)
           -> 033 send
                034 attach -> 035 attach limits / HEIC
                036 reply   042 react   041 stop   037 mention (needs 014)
                038 offline -> 039 refused -> 043 long session (038 + 034 + 036 + 039)
         014 group (-> 026 group thread read, 037 mention)
         015 second space -> 016 space switch on inner display
         017 bot settings -> 018 archive -> 095 restore archived bot
         020 organize Personnel (pins, sections)
         Read side (all assume a bot exists, 012)
           021 busy thread -> 022 unread divider -> 031 history, paging, saved chat
           023 live work -> 024 reconnect
           025 long reply     028 unknown block     032 mail draft view
         Approvals (assume a running thread, 023)
           045 tool Allow -> 050 CONFLICT (second device) -> 055 review Always allow
           046 mail draft approve -> 047 edit and send (needs 058/065 compose)
           048 first consent -> 094 review and withdraw consent  (-> 052 voice consent)
           051 secret      053 MCP server      054 choice card + writes on
         Inbox (needs mail connected, 066)
           066 first open / first sync -> 056 triage -> 057 read message -> 058 reply -> 059 forward
           060 search and filter   061 to-do   062 cleanup   063 writes off   065 compose
           064 inner-display session (needs 056 to 058)
         Agent surfaces
           067 watch computer -> 068 take control -> 102 laptop pose
           069 find artifact -> 070 versions -> 072 image -> 108 image across modes; 071 delete
           073 agent page -> 074 list     075 routine     077 load failures
           076 month-end handoff (needs 068, 070, 073, 074, 075)
         Money and documents (need integration connected, 093)
           078 Finance -> 079 hide amounts -> 103 Finance in laptop pose
           080 Legal -> 081 Legal blocked (needs 089)
           082 Carta     083 Data room upload -> 084 share file into chat
           085 four pages on Duo     086 sidebar glance
         Settings
           087 open Settings -> 088, 089, 090, 091 -> 092 hosted voice, 093 integrations -> 097 server credentials
           007 sign out and delete account (merged 096)
         Duo device stories (assume the matching base story)
           098 outer approve (045)  099 outer mail (056, 057)  100 unfold (any open thread)
           104 create bot (012)  105 short outer (any)  106 push tap (needs 011)  107 inner Settings (087, 088)
```

Longest chain: 006 or 002 -> 001 -> 011 -> 012 -> 019 -> 089 -> 040 -> 033 -> 023 -> 045 -> 050.

## All Stories

Stories are grouped by topic in the order the topics were written. Headings use catalog IDs. Inside each story, references such as "STORY-003" have been rewritten to catalog IDs. The three-digit gaps in numbering (049, 096, 101) are merged stories, listed next.

### Merged stories

| Merged ID | Original | Kept as | Reason |
| --- | --- | --- | --- |
| STORY-096 | topics/settings.md STORY-010 "Sign out and delete the account" | STORY-007 | Same flow (Account detail, sign out, delete with password, emailed code or SSO). STORY-007 is longer and covers the failure variants. The Settings-side gaps from 096 are kept in Design Gaps under #421. |
| STORY-049 | topics/approvals-consent.md STORY-005 "Review and turn off an AI provider in Settings" | STORY-094 | Same Settings > AI data sharing page and the same blocked-run recovery. STORY-094 also covers withdrawing consent and the error-to-page link. |
| STORY-101 | topics/duo-adaptation.md STORY-004 "Work through the Inbox with list and message side by side" | STORY-064 | Same inner-display two-pane Inbox. STORY-064 is the full triage session and has the same gaps plus selection-after-archive. |

### Cross-references between overlapping stories

Stories kept separate because they differ in device, phase or failure mode, but that a reviewer should read together.

| Cluster | Stories | Why related |
| --- | --- | --- |
| Session end and sign out | 007 (merged 096), 008, 106 | Sign out, forced sign out and push token cleanup share the 401 and Keychain rules |
| No model connected | 019, 040, 089, 088 | Same `needsModel` state seen from Home, from a send, and from Settings |
| AI data consent | 048, 094 (merged 049), 052, 061, 066, 092 | One consent state surfaces at send, voice, triage and Settings; the prompt has no board |
| Mail draft approval | 032, 046, 047, 099 | One approval card in read-only (phase 4), act (phase 5), edit-and-send and outer display |
| Approval on a tool | 011, 045, 050, 098 | Home Activity approve, thread Allow, CONFLICT, and the outer-display variant |
| Inbox on Duo | 060, 064 (merged 101), 099 | Search and filter, inner two-pane, and outer triage |
| Compose | 058, 059, 065, 047 | Four entry points to one compose sheet that has no board |
| Space switching | 015, 016, 106 | Switcher control, inner display, and push tap that switches first |
| Create bot | 012, 014, 104, 019 | Empty Home, group, per-display, and first run |
| Team Computer | 067, 068, 076, 102 | Phone, Duo outer, handoff session, laptop pose |
| Image viewer | 072, 108 | Standard iPhone and across display modes |
| Finance numbers in several places | 078, 073, 076, 079, 103 | Same runway figures on the page, an artifact, an agent page, a chat card and laptop pose |
| Settings on Duo | 087, 088, 107 | Same pages, nested split on inner display |
| Archived bots | 018, 095 | Archive from a thread, restore from Settings |
| Data room | 083, 084, 085 | Upload and search, share into chat, four pages on Duo |


## Topic: First run: server, sign in and recovery

Source file: `docs/ios-native/ux/topics/first-run.md`

### STORY-001: Sign in with email and password on the default server
**Type**: short
**Topic**: First run: server, sign in and recovery
**Source**: topics/first-run.md STORY-001
**Phase issue**: #414 (P2)
**Persona**: Maya Okafor, founder of a 4-person seed-stage startup, returning to the app on a new phone
**Goal**: Get from a fresh install to the signed-in home screen with an existing account.
**Preconditions**: Fresh install, no token in the Keychain. The default server is reachable and `GET /api/auth/capabilities` reports password auth, no SSO.
**Device**: standard iPhone
**Ideal path**: 4 — type Email, type Password, tap Sign in, land on Home.
**Alternate paths**: Press the keyboard Go key (`returnKeyType="go"` in Expo) in the Password field instead of tapping Sign in. Continue with SSO (STORY-003). Sign up first (STORY-004).
**Design source**: Sign in screen: `PG-B-SignIn.dc.html`, rule card "Sign in" (prominent action: "Sign in", full-width ink pill). Home after sign-in: `PG-A-Home.dc.html` (out of scope here).

#### Steps
1. Launch the app → The root screen shows the wordmark, the title "Sign in to Rakazo" and grouped fields. No Back control. Capabilities load first ("Loading…" per the rule card).
2. Tap the "Email" field and type `maya@example.com` → Keyboard opens, field shows text.
3. Tap the "Password" field and type the password → Text is masked.
4. Tap "Sign in" → Button shows a working state, `POST /api/auth/sign-in/email` succeeds, the token goes to the Keychain, the selected space is cleared first, and the app replaces the root with Home.

#### Variations
- Wrong password: a red line above the button reads "Could not continue" or the server message (board shows "Could not continue"). Fields keep their values.
- Email field empty or password shorter than 8: `credentialIssue` returns a local message before any request (Expo `credentialIssueText`). The board does not show these texts.

#### Edge Cases
- Rate limit (10 attempts per 15 minutes on auth routes) returns an error; the board shows only the generic red line.
- Token arrives only in the `better-auth.session_token` cookie: the client must fall back to it (README section 4).
- Double tap on Sign in: the Expo app ignores a second submit while pending.

#### Design gaps
- Title mismatch: board "Sign in to Rakazo" vs Expo "Sign in to Praci".
- No board for the button's pending label (Expo: "Working…") or for local validation messages.
- No board for the Password field Go key behavior or focus order.
- Which mode (sign in or sign up) the app opens in for a first launch is not decided; Expo opens sign-up, the board shows sign-in.


### STORY-002: Switch to a self-hosted server before signing in
**Type**: medium
**Topic**: First run: server, sign in and recovery
**Source**: topics/first-run.md STORY-002
**Phase issue**: #414 (P2)
**Persona**: Tomas Berg, CTO of a 6-person startup that runs its own Praci server on a private network
**Goal**: Point the app at the company server (`https://praci.example.test`) and sign in.
**Preconditions**: Fresh install, signed out. The company server answers `POST /rpc/health` with `json.ok === true`. His phone is on the office network.
**Device**: standard iPhone
**Ideal path**: 7 — open the sheet, type the address, Save, then email, password, Sign in.
**Alternate paths**: Open the same Server sheet later from Settings (rule card: "Sheet, medium detent, from Sign in or Settings"; the Settings board has no visible Server row). Type the address without a scheme; the Expo app adds `https://`.
**Design source**: `PG-B-SignIn.dc.html` ("Use a custom server" link); `PG-B-Server.dc.html`, rule card "Server" (Cancel xmark, Save prominent checkmark, one sentence, URL field, "Use default server").

#### Steps
1. On the sign-in screen tap "Use a custom server" → The Server sheet opens at a medium detent.
2. Read "Enter your Rakazo server address." → The URL field (placeholder `https://app.example.com`, accessibility label "Server address") shows the default host as its placeholder.
3. Type `praci.example.test` → Field accepts input; any earlier error clears. "Use default server" appears once the text differs from the current address.
4. Tap Save → Save shows a spinner while the app probes `POST /rpc/health`; the address is normalized to origin only (scheme, host, port).
5. The sheet closes → Sign in shows the new host. The link now reads "Custom server praci.example.test" (Expo accessibility label "Custom server {host}").
6. Capabilities reload for the new host → SSO button and reset link appear or disappear to match the new server.
7. Enter Email and Password, tap "Sign in" → Signed in against the company server.

#### Variations
- Choose "Use default server" later from the same sheet to go back; the placeholder host returns.
- Plain `http://` is accepted only for loopback, `.local`, private ranges and Tailscale (README section 4). Expo shows "Public servers need https://. HTTP only works on your local network." under the field.

#### Edge Cases
- Unreachable or timed out (8 s): red line under the field ("Could not reach this server" on the board; Expo text is "Could not reach that server"), the typed address is kept.
- Reachable but not a Praci server: Expo says "That URL did not look like a Praci server". The board has no such line.
- Not a URL, empty, or missing host: Expo shows "Enter a server URL", "That doesn’t look like a URL", "That URL is missing a host", "Use an http or https URL". None are on the board.
- Changing servers while signed in wipes token, selected space and caches (README section 4); see STORY-008.
- Tap Cancel (xmark) with an unsaved address: no change.

#### Design gaps
- Label mismatch: board "Could not reach this server" vs Expo "Could not reach that server"; board "Rakazo server" vs Expo "Praci server".
- The other validation errors and the http warning line have no board.
- No Server row on the Settings board even though the rule card says the sheet opens from Settings.
- No design for a confirmation before a server change wipes a signed-in session.
- The same server host is shown on the sign-in link and (planned) Settings; its exact format is only defined in Expo (`displayApiHost`).


### STORY-003: Continue with SSO from the sign-in screen
**Type**: medium
**Topic**: First run: server, sign in and recovery
**Source**: topics/first-run.md STORY-003
**Phase issue**: #414 (P2)
**Persona**: Priya Natarajan, head of operations at a 15-person company whose server has one OIDC provider
**Goal**: Sign in through the company identity provider without typing a password.
**Preconditions**: Server capabilities report `sso: { name: "Example SSO" }`. Fresh install.
**Device**: standard iPhone
**Ideal path**: 3 — tap "Continue with Example SSO", complete the provider page, land on Home.
**Alternate paths**: Email and password if the server also allows password auth (STORY-001). On a server with SSO only, SSO is the only route.
**Design source**: `PG-B-SignIn.dc.html` (SSO button at the top of the card, "or" divider), rule card "Sign in". The provider page and consent sheet are system UI (`ASWebAuthenticationSession`): NO BOARD.

#### Steps
1. Open the app → Sign in shows the button "Continue with Example SSO", then "or", then the email fields.
2. Tap "Continue with Example SSO" → The app calls `POST /api/auth/sign-in/social` with `disableRedirect`, reads the `better-auth.oauth_state` cookie, and opens the Expo authorization proxy in `ASWebAuthenticationSession` with callback scheme `rakazo`. iOS shows its standard sign-in consent prompt.
3. Sign in at the provider page → The session closes on the `rakazo://sign-in` callback, the token is parsed from the callback `cookie` parameter, confirmed with `GET /api/auth/get-session`, saved to the Keychain, and the app replaces the root with Home.

#### Variations
- Expo places the SSO button below the form as a quiet button in one layout path and above as a prominent button in another; the board puts it first. Native should follow the board.
- Account created for the first time through SSO may need integration setup (see Design gaps).

#### Edge Cases
- User cancels the system sheet: the red line shows "Could not continue" or nothing; pending state ends. The board does not say which.
- Provider returns without a token or `get-session` fails: red line "Could not continue".
- Server drops SSO between launches: capabilities no longer include `sso`, so the button disappears.

#### Design gaps
- Cancel and failure handling after the web sheet is not specified.
- The provider name is dynamic; the board shows only "Example SSO". Long provider names are not designed.
- First-time SSO users: Expo routes sign-up to `/integration-setup` when `integrationSetup/get` says `needsSetup`; the plan (phase 3 and 9) and boards have no screen for it. NO BOARD.
- The system consent prompt is outside the app; nothing documents it for review.


### STORY-004: Create an account on a server that requires email verification
**Type**: medium
**Topic**: First run: server, sign in and recovery
**Source**: topics/first-run.md STORY-004
**Phase issue**: #414 (P2)
**Persona**: Jamal Reyes, solo founder trying a hosted private beta
**Goal**: Sign up, verify the email address, and sign in.
**Preconditions**: Fresh install, hosted server with sign-up enabled and email verification on.
**Device**: standard iPhone
**Ideal path**: 8 — switch to sign up, name, email, password, Sign up, read "Check your email", open the mail link, return and Sign in.
**Alternate paths**: A server that does not require verification returns a session directly and Jamal lands on Home after step 5. SSO sign-up (STORY-003).
**Design source**: `PG-B-SignIn.dc.html` ("Don’t have an account? Sign up" link only). Sign-up form with the "Name" field: NO BOARD. "Check your email" state: described in the rule card ("Reset sent: title becomes Check your email") but not drawn, and described for reset only. Mail app and link: system UI.

#### Steps
1. On Sign in tap "Sign up" in "Don’t have an account? Sign up" → The screen switches to sign-up mode: title becomes "Sign up for Praci" (Expo), a "Name" field appears above Email, the button reads "Sign up", the link reads "Already have an account? Sign in".
2. Type name "Jamal Reyes", email and an 8-or-more character password → Fields accept input. Name is optional; Expo falls back to the part of the email before `@`.
3. Tap "Sign up" → `POST /api/auth/sign-up/email` runs.
4. Server answers with verification required and no session → Title becomes "Check your email" and VoiceOver announces it.
5. Open the Mail app, tap the verification link → The link verifies the account in the browser.
6. Return to Praci → The screen still shows "Check your email" with a "Back to sign in" link.
7. Tap "Back to sign in", enter Email and Password, tap "Sign in" → Signed in.
8. Home loads → New account, empty Personnel list (`PG-A-Home` empty state "Tap + to create a bot").

#### Variations
- Password under 8 characters: local message before the request.
- Email already registered: server error shows in the red line.

#### Edge Cases
- App is killed between steps 4 and 6: it reopens at the default root mode; the user must re-enter the email.
- The verification link opens in Safari, not the app; no `rakazo://` deep link is defined for verification in the plan.
- Rate limit (10 per 15 minutes) applies to sign-up too.

#### Design gaps
- No board for sign-up mode (Name field, button, switch links).
- The "Check your email" variant is described only for password reset; verification reuse is a Expo behavior not in the plan.
- No design for returning to the app after verification, or resending the email.
- Default launch mode (sign-up in Expo, sign-in on the board) is undecided.


### STORY-005: Reset a forgotten password
**Type**: medium
**Topic**: First run: server, sign in and recovery
**Source**: topics/first-run.md STORY-005
**Phase issue**: #414 (P2)
**Persona**: Lena Fischer, operations lead who changed phones and forgot her password
**Goal**: Request a reset link, set a new password in the browser, and sign in.
**Preconditions**: Server capabilities report `passwordReset: true` and a `resetUrl`.
**Device**: standard iPhone
**Ideal path**: 7 — Forgot password?, type Email, Send reset link, read confirmation, open mail link and set password, Back to sign in, Sign in.
**Alternate paths**: SSO if the account is linked (STORY-003). Change password from Settings once signed in (STORY-007 mentions it; no screen).
**Design source**: "Forgot password?" link on `PG-B-SignIn.dc.html`. Forgot-password form: NO BOARD (rule card only says "Reset sent: title becomes Check your email"). Web reset page: not part of the app.

#### Steps
1. On Sign in tap "Forgot password?" → The screen changes to forgot mode: title "Reset your password" (Expo), only the Email field remains, the button reads "Send reset link", the bottom link reads "Back to sign in".
2. Type the email address → Field accepts input.
3. Tap "Send reset link" → The app calls the server password-reset request with the server's `resetUrl`.
4. Request succeeds → Title becomes "Check your email"; VoiceOver announces it.
5. In Mail, open the reset link → The browser shows the server's web reset page. Lena sets a new password there.
6. Return to Praci and tap "Back to sign in" → Sign-in mode returns with the error line cleared.
7. Enter Email and the new password and tap "Sign in" → Signed in.

#### Variations
- Same flow from an inner display or half-folded pose: the card is centered at 380 pt on the 2/3 side or the left half (rule card).

#### Edge Cases
- Server has no reset: the link is not shown. If reached anyway, Expo throws "Password recovery is not configured for this server".
- Capabilities request fails: Expo shows "Could not load sign-in options" with "Retry" in place of the form; the rule card names this state ("Options failed: message with Retry") but the board does not draw it.
- Unknown email: the server's behavior is not stated in the plan; the screen would show the same confirmation or an error.

#### Design gaps
- No board for forgot mode, "Check your email", "Back to sign in", or "Retry".
- The confirmation gives no way to resend or to open the Mail app.
- The reset page is in a browser outside the app; returning to the app is manual.


### STORY-006: Server is unreachable or capabilities fail on first launch
**Type**: short
**Topic**: First run: server, sign in and recovery
**Source**: topics/first-run.md STORY-006
**Phase issue**: #414 (P2)
**Persona**: Dev Anand, founder on a train with patchy signal
**Goal**: Recover from a failed first load and reach the sign-in form.
**Preconditions**: Fresh install, no connectivity to the default server at first.
**Device**: standard iPhone
**Ideal path**: 3 — see the error, tap Retry, form appears once the network returns.
**Alternate paths**: Open "Use a custom server" and pick another address (STORY-002). Wait for the network and relaunch.
**Design source**: Rule card "Sign in" ("Loading options: Loading text. Options failed: message with Retry"). The states are not drawn on `PG-B-SignIn.dc.html`: NO BOARD for the visible layout of loading and failed options.

#### Steps
1. Launch the app with no signal → Sign in shows "Loading…" while `GET /api/auth/capabilities` runs (8 s timeout in the Expo client).
2. The request fails → Message "Could not load sign-in options" and a "Retry" button replace the form. The "Use a custom server" link stays reachable.
3. Signal returns, tap "Retry" → Capabilities load and the form appears with the right SSO and reset options.

#### Variations
- An old server returns the legacy capabilities shape: the client treats it as password only; the SSO button and "Forgot password?" do not appear.

#### Edge Cases
- Failure repeats: the same message stays; no count or detail is shown.
- Server reachable but returns non-JSON: treated as failure.
- Airplane mode: the only action that does not need the network is opening the Server sheet.

#### Design gaps
- No drawn layout for loading or the failed-options message; unclear whether the email fields are hidden or disabled.
- No board for the "sign-in screen when offline" in general; no distinction between "no network" and "server wrong".
- "Retry" vs the "Try again" used on Home and Artifacts boards.


### STORY-007: Sign out, then delete the account
**Type**: long
**Topic**: First run: server, sign in and recovery
**Source**: topics/first-run.md STORY-007
**Phase issue**: #414 (P2), #421 (P9)
**Persona**: Grace Whitfield, founder who is shutting down her test workspace and removing her data
**Goal**: Sign out of the app, sign back in, and permanently delete the account.
**Preconditions**: Signed in with email and password on the default server. Two bots, several saved chats, push enabled.
**Device**: standard iPhone
**Ideal path**: 12 — Settings, profile, Sign out, sign in, Settings, profile, Delete account, confirm with password, land on Sign in.
**Alternate paths**: Delete an SSO-only account with "Sign in again" (re-authenticate) or "Send deletion code" and the emailed code (steps 9 to 10 variations). Sign out from Duo inner display Settings (detail in the 2/3 pane).
**Design source**: `PG-B-Settings.dc.html` rule card (profile row "Account"; "Sign-out and delete account live on the profile detail (Account)"). The Account detail screen itself, the delete confirmation and the re-authentication dialog: NO BOARD. `DS-04-Overlays.dc.html` holds the generic alert pattern (confirm with Cancel / Delete, as used in group delete).

#### Steps
1. On Home open the account entry in the sidebar or top bar → The Settings sheet opens (rule card: "Opened as a sheet from the sidebar profile").
2. Tap the profile row showing the user name and "Account" → The Account detail pushes.
3. Tap "Sign out" → The app calls sign-out, clears the Keychain token, selected space, saved chats, outbox and caches, and bumps the session generation.
4. App replaces everything with Sign in → The settings sheet closes at any depth; Sign in is the only screen. Push notification registration for this device should end (not specified).
5. Enter Email and Password, tap "Sign in" → Home loads, caches are empty and refetched.
6. Reopen Settings → profile row → Account.
7. Tap "Delete account" → For a password account the app asks for the current password in a native prompt titled "Delete your account?" with the text "This permanently deletes your account, bots, conversations, memories, files, and saved connections. This cannot be undone." and buttons "Cancel" and "Delete".
8. Type the current password → The password field is secured.
9. Tap "Delete" → `/api/auth/delete-user` runs with the password.
10. Deletion succeeds → The app clears local state and replaces everything with Sign in.
11. Try the old email and password → Sign in shows a red error line.
12. Confirm Home is not reachable → Only Sign in is available; no cached data appears.

#### Variations
- Account without a password (SSO): the dialog offers "Sign in again" (fresh SSO) or "Send deletion code" and a "Deletion code" field instead of "Current password". The delete button stays disabled until one route is complete.
- Sign-out fails (offline): Expo shows "Could not sign out" and keeps the session.
- Wrong password: "Could not delete account" shows in the dialog.

#### Edge Cases
- Another device deletes the account first: the next call returns 401 and the session is rejected (STORY-008).
- A queued outbox message exists at sign-out: the outbox is wiped with the session; the user is not warned.
- Delete during a running agent: the plan does not say what happens to runs.
- App Store rule 5.1.1(v) requires in-app deletion; this path satisfies it only if the entry point is visible from the app.

#### Design gaps
- No board for the Account detail screen, which carries both Sign out and Delete account.
- No board for the delete confirmation or the SSO re-authentication and email-code variants.
- The settings board shows "Change password" but the destination screen (and its token replacement) has no board.
- The plan does not state whether sign-out unregisters the push token, or warns about unsent outbox messages.
- The settings board lists "Account" under the profile; the Expo screen also has appearance, language, notifications. These are not on the iOS Settings board.


### STORY-008: Session rejected by the server while using the app
**Type**: medium
**Topic**: First run: server, sign in and recovery
**Source**: topics/first-run.md STORY-008
**Phase issue**: #414 (P2)
**Persona**: Owen Castillo, operator who is signed in on two phones
**Goal**: Understand and recover when the server stops accepting his session, without losing a newer sign-in.
**Preconditions**: Signed in on the default server. An admin revokes his session, or the session expires after inactivity (default lifetime is an inference, not confirmed).
**Device**: standard iPhone
**Ideal path**: 4 — open the app, a call returns 401, the app returns to Sign in, sign in again.
**Alternate paths**: Opening a thread mid-stream: an SSE `error` frame with status 401 ends the stream and signs out or re-selects the space (README section 4). Changing servers in Settings also returns to Sign in (steps below, variation).
**Design source**: `PG-B-SignIn.dc.html` (destination). The rejection moment itself, any message such as "session ended", and the stale-space recovery: NO BOARD.

#### Steps
1. Open the app from the background and tap a bot → An RPC call returns 401 without a space header.
2. The app treats the session as rejected → It clears the Keychain token and caches and replaces the whole stack with Sign in (Expo `replaceWithSignIn`, explicit mode "in").
3. Sign in shows no explanation → Owen sees the normal form.
4. Enter Email and Password, tap "Sign in" → New token saved, space cleared, Home loads.

#### Variations
- 401 with a space header (the user left the space or it was deleted): the app re-probes without the header. If the session is still valid it drops the stale space and reselects; otherwise it signs out.
- Server changed from the Server sheet while signed in: token, space and caches are wiped and the user lands on Sign in for the new server.

#### Edge Cases
- A 401 from before a newer sign-in arrives late (for example, user signed in again, or switched space A to B to A): the session-generation counter must ignore it so it does not sign out the new session.
- Password change on another device returns a replacement token in the same flow; only the changing device gets it.
- 401 during an upload or send: the outbox item is not resent after sign-in unless the same session returns; behavior is not specified.
- 5xx or offline is not 401: no sign-out; each screen shows its own error.

#### Design gaps
- No message tells the user why they were signed out (Sign in looks the same as a first run).
- No board for recovery from a stale space (space picker or empty state after the space is removed).
- The outbox and unsent drafts after a forced sign-out are undefined.
- Offline-first launch with a saved-chat snapshot while the token is invalid: the plan shows snapshot first, but not what happens before the 401.


### STORY-009: Set up the app on iPhone Duo with a custom server
**Type**: long
**Topic**: First run: server, sign in and recovery
**Source**: topics/first-run.md STORY-009
**Phase issue**: #414 (P2), #419 (P7)
**Persona**: Sofia Marin, founder using an iPhone Duo as her main phone, new to Praci
**Goal**: On the outer display, set a custom server and sign in, then unfold to the inner display and continue.
**Preconditions**: Fresh install, signed out, iPhone Duo closed (outer display). Server `https://praci.example.test` is reachable. SSO is not configured.
**Device**: iPhone Duo outer
**Ideal path**: 10 — outer: open the server sheet, Save, sign in; then unfold and see Home.
**Alternate paths**: Start the setup with the Duo already open on the inner display (steps 6 to 8). Half-folded pose (steps 9 to 10 in a variation).
**Design source**: `PG-B-SignIn.dc.html` and `PG-B-Server.dc.html` for the outer layout ("Island and time only, no toolbars"). Inner display: rule cards in `PG-B-Rules.dc.html` (SignIn: "Centered 380pt card on the 2/3 side; 1/3 shows the wordmark only"; Server: "Form sheet centered on the 2/3 side"). Half-folded: SignIn "Card centered on the left half; right half stays background"; Server "Form sheet in the right half". Laptop pose: "Not applicable". Boards for these inner and half-folded states are not drawn on the canvas for sign-in: NO BOARD for the unfolding transition.

#### Steps
1. Hold the Duo closed and launch Praci → Outer-display Sign in: wordmark, title, grouped Email and Password, ink "Sign in" pill, text links.
2. Tap "Use a custom server" → Server sheet at medium detent. The Cancel and Save controls are in the sheet header.
3. Type `praci.example.test` and tap Save → Spinner in Save, the host is probed, sheet closes.
4. Back on Sign in the link shows "Custom server praci.example.test" → Capabilities reload (password only).
5. Type Email, Password, tap "Sign in" → Signed in. Home shows on the outer display.
6. Unfold the Duo to the inner display → Home becomes the 1/3 sidebar plus 2/3 detail layout with Personnel in the sidebar.
7. The Keychain token and server are shared → No second sign-in is needed.
8. (If unfolding happens on the Sign in screen) the card is centered at 380 pt on the 2/3 side and the 1/3 side shows only the wordmark → The typed Email and Password keep their text.
9. Half-fold the device while the Server sheet is open → The sheet moves to the right half; the Sign in card is on the left half.
10. Tap Save in the sheet → The sheet closes; the Sign in card remains in the left half.

#### Variations
- Server sheet from Settings on the inner display shows as a form sheet centered on the 2/3 side.
- Keyboard use with the fold: nothing interactive crosses the fold (plan phase 7).

#### Edge Cases
- Typed text or an in-flight request must survive a posture change (layout change, not a new screen).
- In the half-folded pose the keyboard may cover the right half sheet; the board does not say where the keyboard appears.
- Laptop pose is "Not applicable"; if the Duo enters it on Sign in, the layout must stay a single column.

#### Design gaps
- The sign-in and server rule cards describe inner and half-folded layouts, but the sign-in board has only the outer-display canvas; inner and half-folded versions need drawings.
- No guidance on state kept across posture changes while typing.
- Sheet and keyboard placement in the half-folded pose.
- The Duo simulator cannot run extensions; first-run needs only the app, so this is not a blocker.


### STORY-010: First run on a server with an older API
**Type**: short
**Topic**: First run: server, sign in and recovery
**Source**: topics/first-run.md STORY-010
**Phase issue**: #414 (P2)
**Persona**: Kenji Watanabe, platform engineer testing a self-hosted server that lags the current release
**Goal**: Sign in against an older server and see only the features it supports.
**Preconditions**: Server returns the legacy capabilities shape (no `sso`, `passwordReset` or `billing` fields). `rpc/health` returns ok.
**Device**: standard iPhone
**Ideal path**: 4 — set the server, see password-only sign in, sign in, land on Home.
**Alternate paths**: None found; no upgrade guidance exists in the plan.
**Design source**: `PG-B-Server.dc.html` and `PG-B-SignIn.dc.html`. Behavior for a missing optional field or a 404 on a newer procedure: NO BOARD.

#### Steps
1. Open "Use a custom server", type the address and Save → Probe succeeds.
2. Sign in loads capabilities → Legacy shape is treated as password-only: no SSO button, no "Forgot password?" link.
3. Enter Email and Password, tap "Sign in" → Signed in.
4. Home loads and a newer procedure returns 404 → The client treats it as "not supported" and tolerates missing optional fields (README section 2), so Home renders without those parts.

#### Variations
- Billing field absent: no billing UI appears (hosted-service features are separate).

#### Edge Cases
- `health` returns a fixed version, so the client cannot detect an old server up front and must handle failures per call.
- Mixed state: SSO missing but user previously signed in with SSO on another server; the account must use a password.

#### Design gaps
- No board or copy for a feature the server does not support (hidden vs disabled vs explained).
- No minimum-version message: the plan says there is no API versioning.
- Contract export (phase 1) generates models for the current server only, so the decoders must tolerate missing optional fields; no board shows which screens degrade.



## Topic: Home, Personnel and space switching: user stories

Source file: `docs/ios-native/ux/topics/home-spaces.md`

### STORY-011: Check what needs me and approve from Home
**Type**: short
**Topic**: Home, Personnel and space switching
**Source**: topics/home-spaces.md STORY-001
**Phase issue**: #415 (P3)
**Persona**: Maya Okafor, solo founder of a 4-person logistics startup
**Goal**: See at a glance whether anything needs her, then approve the Inbox agent's reply without hunting through threads.
**Preconditions**: Signed in, Personal space selected, Inbox agent has a drafted reply waiting for approval, Finance agent is mid-run.
**Device**: standard iPhone
**Ideal path**: 3 — open the app (Home is the root), tap the "Approve" row in ACTIVITY, tap the approval card's Allow in the thread.
**Alternate paths**: (a) Activity icon in the side strip/toolbar (carries a dot when something needs you) then the same row. (b) PERSONNEL row "Inbox agent" then find the approval card in the thread. (c) Push notification tap (phase 10, no board for the banner) routes straight to the thread.
**Design source**: PG-A-Home / PG-A-Rules "Home" (Inbox row card, ACTIVITY card, Personnel rows, Activity dot); PG-A-Thread / PG-A-Rules "Agent thread" for the approval card (prominent action is Allow). Standard iPhone layout of Home: NO BOARD (boards are 466x678 outer display, inner and half-folded only).

#### Steps
1. Launch the app with a saved session → Home shows the saved Home snapshot, then fresh `bootstrap`/`spaces.list` data replaces it; Inbox row reads "Inbox", "3 need reply".
2. Glance at the ACTIVITY card → "Finance agent / Reading card expenses / Working" and "Inbox agent / Reply to Ana is ready to send / Approve".
3. Tap the "Inbox agent" Activity row → the agent thread opens with the approval card visible; Home's Activity dot clears once nothing needs her.
4. Tap Allow in the approval card → run continues; "Approve" row disappears from ACTIVITY when she navigates Back.

#### Variations
- Nothing running: ACTIVITY card is hidden ("Activity hides when nothing is running"); Home shows only the Inbox row and PERSONNEL.
- Several approvals: rows stack in ACTIVITY; "See all" opens the full list (destination of "See all" is NO BOARD).

#### Edge Cases
- Cold start with no network: saved Home snapshot renders; no board shows an "offline" or "stale" marker.
- Approval was already answered on web: the thread shows the ask as resolved; a second Allow returns CONFLICT (discovery: "A second answer to the same ask returns CONFLICT").

#### Design gaps
- "See all" destination (full Activity list) has no board; the Activity icon in the side strip also has no destination board.
- Standard iPhone (393 pt) Home layout is not drawn; where Account/Activity/Search/Artifacts and New sit in the horizontal toolbar is only described in text.
- Expo labels these header controls "Account", "Activity", "Search", "Artifacts", "Create"; the board names the prominent button "New". Pick one accessible name.
- Saved-Home-snapshot behavior (stale marker, timestamp) is in the plan but not drawn.


### STORY-012: Create the first bot from an empty Home
**Type**: short
**Topic**: Home, Personnel and space switching
**Source**: topics/home-spaces.md STORY-002
**Phase issue**: #415 (P3)
**Persona**: Tomas Reyes, first-time founder who just signed up
**Goal**: Create a bot named "Bookkeeper" and be ready to chat with it.
**Preconditions**: New account, Personal space with no bots.
**Device**: standard iPhone
**Ideal path**: 4 — New, New bot, type Name, Create.
**Alternate paths**: (a) Tap the Personnel row for an existing integration agent instead of creating a bot. (b) Create from the empty state itself: the empty copy says "Tap + to create a bot" but is not tappable in the board. (c) Create via web and wait for sync.
**Design source**: PG-A-Home / PG-A-Rules "Home" (empty state, New menu); PG-B-NewBot / PG-B-Rules "New bot" (large sheet; fields Name, Title, Description; Create disabled until Name has text; pending "Creating").

#### Steps
1. Open Home → centered empty line "Tap + to create a bot".
2. Tap the prominent New (plus) → menu with "New bot", "New group", "New space".
3. Tap "New bot" → large sheet "New bot" with grabber and fields Name, Title, Description; Cancel (xmark) top-left, Create prominent but disabled.
4. Type "Bookkeeper" in Name → Create becomes enabled.
5. Tap Create → button shows "Creating"; sheet dismisses; Bookkeeper appears in PERSONNEL (Expo: also navigates into the new thread, `app/new.tsx`).

#### Variations
- Fill Title ("Describe what this bot does" placeholder in Expo) and Description ("What this bot is for") before Create.
- Swipe down with a dirty form → "dirty form asks before discarding" (alert wording NO BOARD).

#### Edge Cases
- Server rejects: red line "Could not create bot" appears, fields keep input.
- User has no model connected (`me.needsModel`): bot is created but first message will fail; see STORY-019.
- Duplicate bot names: no rule on whether allowed.

#### Design gaps
- Discard-changes confirmation for a dirty New bot sheet is described but not drawn.
- After Create, is the user taken to the thread or returned to Home? Rules do not say; Expo opens the thread.
- Empty-state copy "Tap + to create a bot" names a "+" but the board's button is labeled New; also does not mention groups or spaces.
- Expo `app/index.tsx` has a fallback that creates a bot literally named "New Bot" without a form; the board has no such path.


### STORY-013: Recover when Home fails to load, then reach Personnel
**Type**: short
**Topic**: Home, Personnel and space switching
**Source**: topics/home-spaces.md STORY-003
**Phase issue**: #415 (P3)
**Persona**: Priya Nair, operations lead on a train with flaky signal
**Goal**: Get Personnel to load after an error.
**Preconditions**: Signed in, server temporarily unreachable.
**Device**: standard iPhone
**Ideal path**: 2 — open Home and see the error, tap "Try again".
**Alternate paths**: (a) Pull to refresh (not specified in boards). (b) Force quit and relaunch to re-run bootstrap. (c) Switch network and wait for automatic retry (not specified).
**Design source**: PG-A-Rules "Home" empty/loading/error text; no Home error board is drawn. Loading: three placeholder rows (text only). Error: "Could not load bots" plus "Try again" (text only).

#### Steps
1. Launch app → three placeholder rows show while `bootstrap`, `me`, `spaces.list` load.
2. Request fails → centered "Could not load bots" with a "Try again" button; Activity hidden.
3. Tap "Try again" → placeholders reappear, then PERSONNEL fills in with Chief, Finance agent, and so on.

#### Variations
- A saved Home snapshot exists: it renders instead of placeholders, and the error should not blank it (rule not stated).
- 401 without a space header: user is signed out and lands on Sign in (discovery "Session end").

#### Edge Cases
- 401 with a space header (stale space): client re-probes without the header and recovers to the default space; user sees no error.
- Error on only `spaces.list` while bots loaded: not specified.

#### Design gaps
- The error message says "Could not load bots" even when the failure is spaces or Inbox summary; the rule does not separate partial failures.
- No board for loading, error, or snapshot-stale states of Home; only text in the rule card.
- Pull-to-refresh is not mentioned in the boards or plan.


### STORY-014: Create a group of agents and send it to the group thread
**Type**: medium
**Topic**: Home, Personnel and space switching
**Source**: topics/home-spaces.md STORY-004
**Phase issue**: #415 (P3), #419 (P7)
**Persona**: Jonas Weber, head of finance and legal at a 15-person SaaS startup
**Goal**: Make a "Closing team" group containing the Finance agent and the Legal agent, then open its thread.
**Preconditions**: Personal space has Chief, Inbox agent, Finance agent, Legal agent.
**Device**: iPhone Duo outer (466x678)
**Ideal path**: 7 — New, New group, type name, tick two members, Create group, open group from Personnel, (thread opens).
**Alternate paths**: (a) Open an existing group's thread and add members from Group settings instead. (b) Create the group on web and see it in Personnel after refresh. None other planned on iPhone.
**Design source**: PG-A-Home (New menu); PG-B-NewGroup / PG-B-Rules "New group" (push, title "New group", Back, Name field, Members list with check marks, prominent "Create group"); PG-A-GroupThread / PG-A-Rules "Group thread" for the result.

#### Steps
1. On Home tap the prominent New in the side strip → menu: "New bot", "New group", "New space".
2. Tap "New group" → pushed page "New group" with Back (chevron.left) and prominent "Create group"; Name field and Members list (Chief, Inbox agent, Finance agent, Legal agent).
3. Type "Closing team" in Name (Expo placeholder "Name this group").
4. Tap "Finance agent" and "Legal agent" in Members → check marks appear.
5. Tap "Create group" → pending state "Creating…"; page pops back to Home.
6. See "Closing team" in PERSONNEL → tap it → group thread opens with stacked avatars in the title capsule and the empty state "Message the group".
7. Tap Back → Home still shows the group.

#### Variations
- Same flow on inner display: bot list in 1/3, form in 2/3, and the group thread then fills the 2/3.
- Create with zero members: allowed? Not specified.

#### Edge Cases
- No bots exist: Members shows "one muted line pointing to New bot".
- Create fails: red inline "Could not create group" and selection is kept.
- Group name left empty: Create disabled (inferred from New bot; not stated for New group).

#### Design gaps
- Whether Create group is disabled with no name or no members is not stated.
- Where the group appears in Personnel (grouped under bots, sections, pinned) is not drawn.
- Mixed list: board shows only bots in Personnel; groups' row design (avatar stack, preview) appears only in the Expo app (`GroupRow`) and is not on PG-A-Home.
- Expo creates the group then pops; the plan says "Group threads reuse the thread screens"; whether to open the new group directly is open.


### STORY-015: Create a second space for a client and switch into it
**Type**: medium
**Topic**: Home, Personnel and space switching
**Source**: topics/home-spaces.md STORY-005
**Phase issue**: #415 (P3)
**Persona**: Leila Haddad, fractional COO who runs her own company and one client
**Goal**: Create the space "Acme Labs" and work in it with a clean Personnel list.
**Preconditions**: Signed in, one space ("Personal") exists.
**Device**: standard iPhone
**Ideal path**: 5 — New, New space, type name, Create space, (space opens automatically).
**Alternate paths**: (a) Create the space on web, then pull it into the app with a space switcher (NO BOARD). (b) Accept an invite to a shared space (no API: "space member management" is a missing API in plan.md).
**Design source**: PG-A-Home (New menu includes "New space"); PG-B-NewSpace / PG-B-Rules "New space" (medium-detent sheet, Cancel xmark, prominent "Create space", error "Could not create space"). The switcher: NO BOARD.

#### Steps
1. Tap New on Home → menu; tap "New space".
2. Medium sheet "New space" slides up with a Name field and prominent "Create space"; detent grows with the keyboard.
3. Type "Acme Labs" → Create space enabled (inferred).
4. Tap "Create space" → `spaces.create` succeeds, client sets `x-rakazo-space-id`, wipes or re-keys caches, reloads Home.
5. Home now shows Acme Labs' own Personnel (empty state "Tap + to create a bot") and an empty ACTIVITY.

#### Variations
- Rename later: Expo reuses the same sheet titled "Rename space" with button "Rename space"; the board has no rename variant.
- Space name limit: contract says 1 to 60 characters, trimmed; the board shows no counter or error for 61+ characters.

#### Edge Cases
- Created but could not be opened: alert with "Try again from the sidebar" (Expo text: "Space created" / "It could not be opened. Try again from the sidebar."). The rule mentions a sidebar that is NOT drawn on iPhone.
- Error "Could not create space" in red; field keeps input.
- The user's Inbox summary row refers to the Personal space's mail; in the new space it should show the new space's own connections (not specified).

#### Design gaps
- No space switcher board: how a user sees all spaces, which one is current, and how to leave Acme and return to Personal is undesigned (Expo lists spaces as headed groups in the Home list with a per-space actions menu).
- No indicator of the current space's name anywhere on the Home board.
- The rule "Try again from the sidebar" assumes a sidebar that standard iPhone does not have.
- Space rename, delete, and "default space" (all in Expo) have no boards and no confirmation copy.
- Space membership/invite flows have no API (plan.md "Missing server APIs").


### STORY-016: Switch between two spaces while a thread is open elsewhere
**Type**: medium
**Topic**: Home, Personnel and space switching
**Source**: topics/home-spaces.md STORY-006
**Phase issue**: #415 (P3), #419 (P7)
**Persona**: Leila Haddad, fractional COO (same user as STORY-015)
**Goal**: Move from Acme Labs back to Personal and open her Finance agent there, without seeing Acme's data.
**Preconditions**: Two spaces exist; current space is Acme Labs; Personal has Finance agent with a running routine.
**Device**: iPhone Duo inner flat
**Ideal path**: 3 — open switcher, choose Personal, tap Finance agent.
**Alternate paths**: (a) Tap a push notification from a Personal agent: client switches space first, then opens the thread (phase 10, no board). (b) Tap a search hit from another space (search board NO BOARD). (c) Tap that space's bot row directly if the Home list shows all spaces together, as Expo does.
**Design source**: Home on the inner book: Main / Inner boards and PG-A-Rules "Home" (inner: Personnel with Inbox pinned on the left third, Activity and last thread on the right). Space switcher: NO BOARD.

#### Steps
1. On the inner display's left third, open the space control (NO BOARD) → list of spaces ("Personal", "Acme Labs").
2. Choose "Personal" → client calls `spaces.setActive`-style switch, sets `x-rakazo-space-id`, discards or re-keys every cache; Home reloads; the right pane shows Personal's Activity and last thread.
3. Tap "Finance agent" in the left third → right pane shows the Finance agent thread; Home stays visible in the left third.

#### Variations
- Standard iPhone: same two steps in one column; Back from the thread returns to Home of Personal.
- Half-folded: Inbox + Personnel left, selected thread right.

#### Edge Cases
- Switch fails: Expo alert "Could not switch spaces" / "Try again." and the previous space stays selected.
- Stale response from the previous space arrives after the switch: must be dropped (Expo invalidates request ids; plan says "wipe or re-key every cache").
- Open thread belongs to Acme: after the switch, the detail pane should not keep showing it (not specified).
- A 401 with a stale space header recovers to the default space silently.

#### Design gaps
- Entire switcher control (placement, current-space indicator, loading and failure state) has no board.
- Inner display detail pane when the new space has no last thread: undefined.
- Which space is "default" and how to change it: Expo has it, plan does not mention it.
- The same Personnel data is rendered on web, Expo and native; Expo shows all spaces inline in one list, the boards show one flat Personnel list. This is a behavior decision, not a style one.


### STORY-017: Edit a bot's profile, voice and model, and save
**Type**: medium
**Topic**: Home, Personnel and space switching
**Source**: topics/home-spaces.md STORY-007
**Phase issue**: #415 (P3)
**Persona**: Sam Whitfield, head of growth who wants the Finance agent to sound less formal
**Goal**: Rename "Finance agent" to "Money desk", pick a color, turn on spoken replies, and set a lower thinking level.
**Preconditions**: Finance agent exists; a model is connected.
**Device**: standard iPhone
**Ideal path**: 7 — Home, Finance agent row, thread menu, bot settings, edit name, toggle voice, Save.
**Alternate paths**: (a) Long-press the bot row in Personnel (Expo opens the organize sheet, which is pin/move, not settings; settings is not reachable there). (b) Open the agent page's menu (NO BOARD for a settings entry). (c) Account settings > Models for model defaults (PG-B-Models), not per-bot.
**Design source**: PG-A-Thread (More menu, entry point not drawn); PG-B-BotSettings / PG-B-Rules "Bot settings" (large title "Chat settings", grouped fields, Voice group, Advanced row, prominent Save with spinner); DS-04 for pickers.

#### Steps
1. On Home tap "Finance agent" → thread opens.
2. Open the bot menu in the trailing toolbar group → choose settings (menu item label NO BOARD) → pushed "Chat settings" with Back and prominent Save (checkmark).
3. Edit Name to "Money desk" → field updates.
4. Tap a color swatch in Color → swatch selected (Expo: eight colors plus "Custom image").
5. Turn on "Read replies aloud" → Voice group shows voice choice and "Device voice" option.
6. Tap Advanced → rows "Model" and "Thinking" (Expo values include Minimal, Low, Medium, High, Extra high, Max, plus "Default (medium)" and "Space default").
7. Pick "Low" for Thinking → row updates.
8. Tap Save → spinner on the button, page pops back to the thread, title now "Money desk"; PERSONNEL on Home also shows the new name.

#### Variations
- Edit Title and Description fields ("Describe what this bot does", "What this bot is for").
- Toggle "Notifications" and the Skills list (Expo only; not on the board).
- Inner display: bot list 1/3, form 2/3 (max 560 pt, left aligned).

#### Edge Cases
- Save fails: red line above the toolbar action, "Could not save bot", fields keep input.
- Voice list fails to load: Expo "Could not load voices".
- Model settings fail to load: "Could not load model settings".
- Back with unsaved edits: no rule.

#### Design gaps
- How to reach bot settings from a thread or Personnel row is not drawn ("Push from the bot menu" only).
- Board title "Chat settings" vs the object being a bot (rule card calls it "Bot settings"); naming mismatch.
- Skills and Notifications rows exist in Expo but not on PG-B-BotSettings.
- Unsaved-changes handling and per-field validation are undefined.
- Voice sample button "Hear a sample" belongs to PG-B-Voice, not to this page; Expo plays "Hi, this is how I'll sound." inline.


### STORY-018: Archive a bot from its thread and restore it later
**Type**: medium
**Topic**: Home, Personnel and space switching
**Source**: topics/home-spaces.md STORY-008
**Phase issue**: #415 (P3)
**Persona**: Dana Kowalski, COO tidying Personnel before an investor update
**Goal**: Remove "Old Recruiter" from Personnel without losing its chat, then bring it back two weeks later.
**Preconditions**: Bot "Old Recruiter" exists with history.
**Device**: standard iPhone
**Ideal path**: 6 — Old Recruiter row, bot menu, Archive; later Account (Settings), Archived bots, Restore.
**Alternate paths**: (a) Restore from the archived thread's own banner (Expo shows "Archived. Chat, memory, and files kept." with a restore action). (b) Delete instead of archive ("Delete {name}?" with "Keep memories" or "Delete memories too"); destructive, no board. (c) Archive from web.
**Design source**: Archive action and restore: NO BOARD. Archived bots list is part of Settings (PG-B-Settings, not read in depth here; rows beyond the listed ones are undefined). Delete confirmation: DS-04 alert pattern only.

#### Steps
1. Tap "Old Recruiter" in PERSONNEL → thread.
2. Open the bot menu → tap "Archive" → confirmation (Expo uses an alert; wording NO BOARD).
3. Confirm → `bots.archive`; thread closes or shows the archived state; Home PERSONNEL no longer lists the bot.
4. Two weeks later: open Account from the Home side strip → Settings sheet; tap "Archived bots" → list; empty state would read "No archived bots".
5. Tap "Old Recruiter" → restore choice (Expo calls `restoreArchivedBot`); on success the bot returns to Personnel.
6. Back to Home → bot visible again with its history.

#### Variations
- Archive a group instead: `groups.archive` and `groups.listArchived` exist in the API; Expo's archived list covers bots.
- Last bot archived: Home returns to "Tap + to create a bot".

#### Edge Cases
- Archive fails: alert "Could not archive bot" / "Try again."
- Restore fails: "Could not restore bot"; list load fails: "Could not load bots" + "Try again."
- Archived bot has an active routine or pending approval: behavior not specified.
- A push notification arrives for an archived bot: routing undefined.

#### Design gaps
- Archive entry point, confirmation, and the thread's archived banner have no board.
- Archived bots list and its empty/error states are not on any Home board; PG-B-Settings does not draw the "Archived bots" row in the version read.
- Groups can be archived and restored through the API (`groups.archive`, `groups.listArchived`), but Expo's list and the boards cover only bots.
- Delete (separate from archive) has no board and no copy for the memory choice.


### STORY-019: First run with no model connected: from Home to a working bot
**Type**: long
**Topic**: Home, Personnel and space switching
**Source**: topics/home-spaces.md STORY-009
**Phase issue**: #415 (P3), #417 (P5), #421 (P9)
**Persona**: Ravi Patel, solo founder who signed up with a new account on the default server
**Goal**: Land on Home, understand a model is needed, connect one, create a bot, and send a first message.
**Preconditions**: New account, new Personal space, no model, no bots, no integrations, `me.needsModel = true`.
**Device**: standard iPhone
**Ideal path**: 14 — see below; an ideal flow would pre-empt the dead end with a single prompt on Home.
**Alternate paths**: (a) Create the bot first and be told at first send ("Connect a model to start a run."). (b) Settings > Models directly from Account. (c) A deployment-provided model (`defaultProvider` without a key) means `needsModel` is false and the flow shortens to STORY-012.
**Design source**: PG-A-Home empty state; PG-B-NewBot; PG-B-Models and PG-B-Settings for model connection (not read in depth here); Sign in handoff: PG-B-SignIn. The `needsModel` prompt: NO BOARD.

#### Steps
1. Finish Sign in → bootstrap, `me`, `spaces.list` run; Home loads with three placeholder rows then the empty state "Tap + to create a bot".
2. Client notes `me.needsModel` and routes toward connecting a model (destination and prompt copy NO BOARD).
3. Tap Account in the toolbar → Settings opens as a sheet.
4. Tap "Models" → pushed Models page (PG-B-Models); list of providers.
5. Choose a provider and enter an API key (secrets are never shown after entry) → connection succeeds; `needsModel` becomes false.
6. Close Settings → back on Home, empty state remains.
7. Tap New → tap "New bot" → New bot sheet opens.
8. Type Name "Chief of staff", Title "Runs my week" → Create enabled.
9. Tap Create → "Creating", sheet closes, bot in PERSONNEL.
10. Tap the bot row → empty agent greeting and suggestions appear in the thread.
11. Type "What should I do first?" in the floating composer → send.
12. Working indicator "Chief of staff is working" with a stop control appears.
13. Reply streams in; Home's Activity card (after Back) briefly shows "Working" then "Done".
14. Back to Home → bot row preview shows the first reply line and time.

#### Variations
- Rotate the order: create the bot (step 7 to 9) before the model; first send then fails with the no-model error and a path to Models.
- Use the Server board's custom server: deployment owner may have a model preset.

#### Edge Cases
- User skips the model: Home works but every send fails with "Connect a model to start a run."
- Consent not given: a call fails with "Review AI data sharing in Account settings before continuing."; client should check `aiDataUsesForProcedure` and prompt.
- Network drop between steps 5 and 6: Models shows saved state on reopen.

#### Design gaps
- The `needsModel` handoff has no screen: no banner, no empty-state variant, no deep link from Home to Models.
- Expo's `lib/api.ts` carries `needsModel` but no Home UI for it was found (Expo discovers it only as a server error at send time).
- AI data sharing consent prompt: no board; only Account settings text.
- Model picker rows and key entry are on PG-B-Models, outside this topic's scope.
- Home empty state has one line of text and no action; the rule says "Tap + to create a bot" only.


### STORY-020: Organize Personnel with a pin and a section, then trim a group
**Type**: long
**Topic**: Home, Personnel and space switching
**Source**: topics/home-spaces.md STORY-010
**Phase issue**: #415 (P3), #419 (P7)
**Persona**: Hannah Lindqvist, chief of staff at a 30-person fintech, who has 12 agents and 3 groups
**Goal**: Pin "Finance agent", move "Legal agent" and "Carta agent" into a new section "Investors", and remove "Mercury agent" from the "Closing team" group.
**Preconditions**: 12 bots, groups "Closing team" and "Weekly review", no sections yet.
**Device**: iPhone Duo inner flat (1/3 Personnel, 2/3 detail)
**Ideal path**: 16 — see steps; each organize action costs 2 taps (long-press, choose), the section creation 4.
**Alternate paths**: (a) Web Personnel drag-and-drop (not available on iPhone). (b) Group membership via Group settings only; no shortcut from Personnel. (c) On standard iPhone the same actions in a single column.
**Design source**: Home Personnel list: PG-A-Home / PG-A-Rules "Home" (flat list, no sections or pins drawn). Organize and member pickers: DS-04 (listed in discovery as the source, no per-page board). Group settings: PG-B-GroupSettings / PG-B-Rules "Group settings" (Name, Members list, "Delete group", Save prominent, "Delete asks first (alert, Cancel / Delete)").

#### Steps
1. On the inner display's left third find "Finance agent" in Personnel; long-press it → organize sheet (Expo: "Pin", "Silence notifications", "Move to", "New section").
2. Tap "Pin" → sheet closes; Finance agent moves under a "Pinned" heading at the top of Personnel.
3. Long-press "Legal agent" → organize sheet.
4. Tap "New section" → inline field "Section name" with "Create".
5. Type "Investors", tap "Create" → section "Investors" is created (`botSections.add`) and the bot is moved into it.
6. Long-press "Carta agent" → in "Move to" tap "Investors" → bot moves under that section heading.
7. Tap the "Investors" heading → section collapses (`botSections.setCollapsed`); tap again to expand.
8. Long-press a heading's bot → "Rename section" to "Investor tools" → "Save".
9. Tap the "Closing team" group row → group thread opens in the right pane.
10. Open the thread's More menu → "Members" or group settings (More group of the strip) → "Group settings" pushes in the right pane (rule: "Group thread in 1/3, settings in 2/3").
11. In Members, untick "Mercury agent" → check mark clears.
12. Tap Save → spinner then the pane returns to the thread; the thread's title capsule shows one fewer avatar.
13. Old Mercury bubbles in the thread keep its name ("One member removed: its bubbles keep the name").
14. Back to Personnel: pinned and section layout persists after force quit and reopen (state is server-side).
15. Open "Weekly review" → Group settings → tap "Delete group" → alert "Delete this group? Bots and their solo threads are kept." with Cancel / Delete.
16. Tap Delete → group removed from Personnel; its bots remain.

#### Variations
- Unpin by repeating "Unpin" in the organize sheet.
- "Unassigned" in Move to returns a bot to the default area.
- "Silence notifications" / "Resume notifications" toggle from the same sheet.
- Standard iPhone: swipe or long-press then the same sheet.

#### Edge Cases
- Section name empty: Create presumably disabled (Expo has "Section name" placeholder; behavior not documented).
- Section name over 60 characters: contract limit 60.
- Organize action fails: Expo text "Could not update chat".
- Group not found (deleted on web): centered "Group not found" and Back. Save error appears inline in red ("Could not save group").
- Spaces other than the current one: Expo only offers organize actions on the current space's rows (`item.space === meSpaceId`).

#### Design gaps
- Pinned headings, section headings, collapse affordance, and the long-press organize sheet are not drawn on PG-A-Home; the board shows a flat Personnel list. "Pin", "Move to", "New section", "Rename section", "Unassigned" exist only in Expo.
- Long-press has poor discoverability and no VoiceOver action is specified; plan says "sections and pinning" without a gesture.
- Group entry to settings is only "Push from the group thread header"; the control is not drawn.
- DS-04 contains "organize and member pickers" per discovery, but no screen shows them in context.
- The same Personnel organization is rendered on web, Expo, and native; a pinned/section difference between surfaces would be visible to the user, so the native app must match the server order exactly.
- Section removal (`botSections.remove`) and reorder have API but no UI described.



## Topic: Stories: Talking to an agent: read and live thread

Source file: `docs/ios-native/ux/topics/thread-read.md`

### STORY-021: Open a busy agent thread and read the latest reply
**Type**: short
**Topic**: Talking to an agent: read and live thread
**Source**: topics/thread-read.md STORY-001
**Phase issue**: #416 (P4)
**Persona**: Maya Okafor, solo founder of a 3-person logistics startup
**Goal**: Open the Inbox agent from Home and read what it last said.
**Preconditions**: Signed in, a space selected, Inbox agent has a thread with prior messages and a saved-chat snapshot on the device.
**Device**: standard iPhone
**Ideal path**: 3 — tap the agent row on Home, see the saved snapshot at once, then the server snapshot replaces it with no extra action.
**Alternate paths**: (a) tap the Inbox agent's row inside the Activity card on Home (PG-A-Home); (b) tap "Ask Inbox agent" (prominent button) from Inbox or Inbox message, which lands in the same thread; (c) tap a push notification (phase #422, no board); (d) Open chat from Agent page (PG-A-AgentPage).
**Design source**: Step 1: `PG-A-Home.dc.html` (Personnel row; Home rule card). Steps 2-3: `PG-A-Thread.dc.html`, Thread rules, `DS-06-Chat.dc.html` (user bubble and agent message, tool-call label). Standard-iPhone top bar: NO BOARD (boards only draw the Duo outer strip; discovery says ordinary iPhones use a standard top bar).

#### Steps
1. On Home, tap the "Inbox agent" row under Personnel → thread opens; the title capsule reads "Inbox agent" and the saved snapshot is on screen immediately, bottom-aligned.
2. Wait for `threads/get` to return → the server snapshot replaces the saved copy with no visible jump; the composer shows "Message Inbox agent".
3. Read the last agent bubble "Reply to Ana: Thursday works, 10am. Here is a draft. I have not sent it." and the collapsed tool label "Searched mail, 12 results" → thread is read; `threads/markRead` fires.

#### Variations
- Same flow from the Activity card row, from "Ask Inbox agent", or from Agent page "Open chat": the same thread, same state.
- Thread has no saved snapshot (first open on this device): step 1 shows a loading state, then step 2 content (loading is not drawn, see gaps).

#### Edge Cases
- `threads/get` fails and a snapshot exists: Expo shows "Couldn't refresh — showing the last loaded messages." and keeps the saved copy.
- `threads/get` fails with no snapshot: error text only in Expo; no board.
- The agent was archived or deleted while the thread is open: Expo shows a removed state with "Restore" for archived bots.

#### Design gaps
- Initial loading state of a thread with no snapshot is not drawn (only "small spinner when loading earlier messages").
- Failed refresh over a saved snapshot ("Couldn't refresh — showing the last loaded messages.") has no board.
- Standard iPhone top bar for a thread (title, back, agent actions) has no board; the outer strip has Back, Page/List, More only.
- Archived or deleted bot thread state ("Restore") has no board.


### STORY-022: Catch up on unread messages with the "New" divider
**Type**: medium
**Topic**: Talking to an agent: read and live thread
**Source**: topics/thread-read.md STORY-002
**Phase issue**: #416 (P4)
**Persona**: Tomas Brandt, operator at a 12-person fintech seed company
**Goal**: Return to a thread after a few hours and read only what is new.
**Preconditions**: The Finance agent posted 7 messages while the app was closed; the thread has 40 older messages; the user last read up to message 40.
**Device**: standard iPhone
**Ideal path**: 3 — open the thread (lands on the unread position), read down to the latest, done.
**Alternate paths**: (a) open from a push tap; (b) open from Home and use "Jump to latest" immediately to skip the unread; (c) mark unread on a thread from the agent actions (API `threads/markUnread` exists, no planned entry point).
**Design source**: `PG-A-Thread.dc.html` (messages, composer); Thread rules. The "New" divider and the "Jump to latest" control: NO BOARD.

#### Steps
1. Open "Finance agent" from Personnel → saved snapshot shows, then the server snapshot arrives with `unreadCount` of 7.
2. The thread positions at the first unread message and shows a divider labelled "New" above it (Expo label) → older messages sit above the fold.
3. Scroll up slightly → the small spinner at the top shows while earlier messages load (rule card: "Loading earlier messages: small spinner at the top").
4. Scroll down through the 7 new messages → each agent bubble (muted card fill) reads in order, caption under the last bubble of a run only.
5. A tool label "Opened Team Computer" appears mid-run; tap it → it expands to show "Computer: ..." and "Action: ..." detail.
6. Reach the bottom → `threads/markRead` clears the unread state; the Home Personnel row loses its unread indicator when you go Back.

#### Variations
- Nothing unread: no divider, thread opens at the bottom.
- More than one page of unread: the divider stays put while older/newer pages load.

#### Edge Cases
- A new message arrives live while reading older ones: Expo shows a "new messages" pill with a down arrow; staying put avoids losing the reader's place.
- The divider is computed from the first live snapshot only; later events do not move it (discovery: "unread divider computed only from the snapshot").
- Reading from the saved snapshot offline: divider placement is undefined.

#### Design gaps
- The unread divider ("New" in Expo) is planned in phase 4 but not drawn in DS-06 or PG-A-Thread.
- The "new messages" / "Jump to latest" controls are in the Expo app, not on any board.
- Expo has an explicit "Load earlier messages" text button; the rule card shows only a spinner. Planned native behavior (auto-load on scroll vs button) is undecided.
- No Home-row unread indicator is drawn for Personnel rows (only an Activity dot).
- Entry point for `threads/markUnread` is not defined.


### STORY-023: Watch an agent work live, with tool steps and a streamed reply
**Type**: medium
**Topic**: Talking to an agent: read and live thread
**Source**: topics/thread-read.md STORY-003
**Phase issue**: #416 (P4)
**Persona**: Priya Natarajan, founder of a two-person climate-data startup
**Goal**: Send nothing; just keep the thread open while the Legal agent works on a task already started on the web, and read the answer as it arrives.
**Preconditions**: A run started from web is in progress on the Legal agent; the phone has the thread open.
**Device**: standard iPhone
**Ideal path**: 2 — open the thread, watch it fill in live; no taps are needed after opening.
**Alternate paths**: (a) watch the same run from a Group thread member line (STORY-026); (b) the Home Activity card shows the run as working (PG-A-Home) and opens the thread.
**Design source**: `PG-A-Thread.dc.html`; `DS-06-Chat.dc.html` (working indicator, tool-call label running state, agent message); Thread rules (Working row).

#### Steps
1. Open "Legal agent" → snapshot arrives; the footer shows the working indicator: a 28 pt bot avatar with a rotating ring and a pill of three pulsing dots, with the label "Legal agent is working".
2. The agent starts a tool call → a tool label appears with a 14 pt spinner and a present-tense label ("Searching mail" style, per DS-06) → label turns to past tense ("Searched mail") when done.
3. The first token of the reply arrives → the working indicator disappears at once and an agent bubble starts growing with markdown text.
4. The reply finishes → the bubble stops growing; the composer's trailing control returns from Stop to Dictate (empty field).
5. Tap the tool label "Read 2 documents" → expands to the detail card; tap again → collapses (state is local, not persisted).

#### Variations
- Reduce Motion on: no ring rotation, dots static at 60% opacity, VoiceOver label "Working".
- The run needs approval: the run goes to `run.waiting_input` and an approval card appears (belongs to the Approvals topic, #417; this story only observes it).

#### Edge Cases
- Run fails: Expo shows "Last run failed: {error}" in red text after the messages.
- Stream drops mid-reply: see STORY-024.
- Tool label arguments are never shown by default (DS-06 rule).

#### Design gaps
- Working label text differs: board shows "Inbox agent is working" with three dots; DS-06 specimen shows a name-less 36 pt slot; Expo shows "{name} is working" plus a status line and "Still waiting on {service}". The status-line behavior has no board.
- The rule card says "three blue dots" but DS-06 says dots use `mutedForeground` and the ring `statusWorking`; colour needs reconciliation.
- Failed-run note ("Last run failed") has no board; only the failed send bubble is drawn.
- Streaming partial markdown (open code fence, half a table) rendering is not specified.


### STORY-024: Reconnect after the live stream drops in a tunnel
**Type**: medium
**Topic**: Talking to an agent: read and live thread
**Source**: topics/thread-read.md STORY-004
**Phase issue**: #416 (P4)
**Persona**: Lars Eriksen, founder commuting by train with spotty signal
**Goal**: Keep following an agent's reply across a connection loss and see no duplicated or missing messages.
**Preconditions**: Thread open on the Finance agent, run in progress, SSE connected from the highest `seq`.
**Device**: standard iPhone
**Ideal path**: 1 — do nothing; the app reconnects itself. (Zero user taps is the target.)
**Alternate paths**: (a) pull up from Home and reopen the thread to force a fresh `threads/get`; (b) none for manual reconnect is planned.
**Design source**: NO BOARD for reconnecting, offline or stale state. Working indicator and bubbles: `DS-06-Chat.dc.html`. Behavior: `docs/ios-native/plan.md` Phase 4 and discovery "State Transitions".

#### Steps
1. Train enters a tunnel while the Finance agent streams a reply → no data arrives; after 20 s idle the client sends a heartbeat; nothing returns.
2. At 45 s of silence the watchdog drops the connection → the thread stays on screen with the partial bubble; no error is drawn (undefined, see gaps).
3. The client retries with backoff 250 ms, 500 ms, 1 s, 2 s, then 5 s steady → each attempt first refetches the snapshot (`threads/get`) and then resubscribes from the highest `seq`.
4. Signal returns → the snapshot now contains the full reply; the partial bubble is replaced by the final bubble with no duplicate.
5. The stream resumes; the working indicator clears because the run is complete → the thread is quiet again.

#### Variations
- Server restarts (older self-hosted server): subscribe fails; same backoff.
- Stream returns an `error` frame with status 401: the client does not reconnect; it signs out (session ended) or re-selects the space (user left the space).

#### Edge Cases
- Device sleeps in the background: on return, the client refetches the snapshot before subscribing.
- Two quick drops: backoff keeps growing to the 5 s cap and resets after a successful frame (reset rule is implied, not stated).
- The user taps Stop while offline: not covered by this topic.

#### Design gaps
- No board shows an offline, "Reconnecting" or stale-thread indicator; the brief lists it as "required by the brief but no board".
- The 401 error frame outcome (signed out or left space) has no board for the thread.
- Whether the user can see that a heartbeat or retry is happening is undecided; silent retry is assumed.
- Backoff reset behavior is not stated.


### STORY-025: Read a long agent reply with a table, code and an image
**Type**: medium
**Topic**: Talking to an agent: read and live thread
**Source**: topics/thread-read.md STORY-005
**Phase issue**: #416 (P4)
**Persona**: Hana Sato, operations lead at a 6-person marketplace startup
**Goal**: Read an agent's long markdown reply, copy a code snippet, expand a table and open an image.
**Preconditions**: The Inbox agent's last message is the "Pilot checklist" reply: heading, bulleted list, a code block labelled json, a vendor table, a chart image.
**Device**: standard iPhone
**Ideal path**: 6 — each of the four content kinds needs one tap to use it, plus Back from the sheet and viewer.
**Alternate paths**: (a) long-press the message → native context menu with Select and Copy for the whole message; (b) read the same table from the Agent page (PG-A-AgentPage, separate rendering of similar data).
**Design source**: `DS-06-Chat.dc.html` (Agent message, long markdown; inline image attachment); image viewer `PG-A-Image.dc.html`. Table Expand sheet: described in DS-06 text only, no PG board.

#### Steps
1. Scroll to the agent bubble "Pilot checklist" → headings (19 pt h1, 16 pt h2), a bulleted list, and a link row with a 16 pt letter tile all render.
2. Tap "Copy" on the json code block → label changes to "Copied" for 1.5 s; the pasteboard holds the block text.
3. Tap "Expand" (arrow.up.left.and.arrow.down.right) on the "Vendor / Status / Amount" table card → a full-height sheet opens with tabular amounts (shown as `[AMOUNT]` in the board).
4. Dismiss the sheet → back at the same scroll position.
5. Tap the "chart.png" attachment (248 KB) → the full-screen viewer opens with "Share" and "Save to Photos".
6. Tap "Close" → return to the thread.

#### Variations
- Long-press a bubble: "Copy" the whole message.
- Image fails to load: the card shows "Could not load image" with "Retry" (DS-06).
- Image is still loading: spinner on accent fill.

#### Edge Cases
- A link opens outside the app (Safari); the thread keeps its position.
- Code blocks never scroll horizontally; the Expand route is offered instead (DS-06 rule says "offer Expand" but the code block header only shows Copy).
- Dynamic Type at large sizes: only partly specified.

#### Design gaps
- Table Expand sheet and code Expand have no PG board (only described in DS-06).
- Link tap behavior (in-app browser vs Safari) is not specified.
- Dynamic Type and light-mode behavior of the long markdown are not verified on the boards.
- On standard iPhone the image viewer's "Close" and "Share / Save to Photos" placement is drawn only for the Duo outer strip.


### STORY-026: Follow a group thread with several agents working at once
**Type**: medium
**Topic**: Talking to an agent: read and live thread
**Source**: topics/thread-read.md STORY-006
**Phase issue**: #416 (P4)
**Persona**: Ines Duarte, CEO of a 9-person biotech tools startup
**Goal**: Open the "Funding room" group and see what each member agent is saying and doing before a board meeting.
**Preconditions**: A group of three bots (Finance agent, Legal agent, Chief) exists; Finance and Legal runs are in progress at the same time.
**Device**: standard iPhone
**Ideal path**: 2 — open the group row, read; per-agent lines show live state without any further taps.
**Alternate paths**: (a) open from a push notification (group wins over bot, phase #422); (b) open the group from Home Personnel groups; (c) tap "Members" in the side group on Duo outer (PG-A-GroupThread) for the member list.
**Design source**: `PG-A-GroupThread.dc.html`; Group rules; `DS-06-Chat.dc.html` (event label, working indicator).

#### Steps
1. Tap "Funding room" in Personnel → group thread opens; title capsule shows the stacked member avatars and the name "Funding room".
2. Read the history → each bubble has the agent's name above it ("Finance agent", "Legal agent"); identity is the avatar color only, bubbles are not tinted.
3. See the footer → one working line per working agent: "Legal agent is working" (board shows one line; with two agents working, two lines).
4. A tool label "Read 2 documents" appears under the Legal agent's text → tap to expand.
5. An event label "Chief handed off to Finance agent" appears centered between hairlines → read-only system note.
6. Open the member list → on Duo outer, tap "Members" (person.2); on standard iPhone the entry point is undefined.

#### Variations
- A member was removed from the group: its old bubbles keep its name; event label "Legal agent left the thread".
- Empty group thread: member avatars with "Message the group".

#### Edge Cases
- Two agents finish within the same second: each working line disappears on its own first token.
- A bot in the group is archived: bubbles keep the name (archived label shown in Expo as "archived").
- Group `Send` is the prominent action (Group rules), unlike Agent thread where Allow is.

#### Design gaps
- Member list pane has no board (only "extra level: member list opens as a third pane").
- Standard-iPhone entry to Members and to group settings is not drawn.
- The empty-state copy "Message the group" is only in the rule card, not drawn.
- Multiple simultaneous working lines: only one line is drawn; maximum visible count with 6 members is unspecified.
- Same information, different surfaces: working state shows on Home Activity card, the group footer, and (later) Live Activities.


### STORY-027: Start a fresh agent and see the empty thread
**Type**: short
**Topic**: Talking to an agent: read and live thread
**Source**: topics/thread-read.md STORY-007
**Phase issue**: #416 (P4)
**Persona**: Daniel Mercer, first-time founder trying the app on day one
**Goal**: Open a brand-new agent and understand what it can do before typing.
**Preconditions**: A bot just created; no messages exist.
**Device**: standard iPhone
**Ideal path**: 2 — create flow lands on the thread; the greeting and suggestions are readable without tapping.
**Alternate paths**: (a) from Home empty state "Tap + to create a bot" then New bot > Create, which opens the thread; (b) create from New group > "Create group" which opens a group thread (empty state "Message the group").
**Design source**: Thread rules (Empty row: "agent greeting and suggestions"); `PG-B-NewBot.dc.html` for step 1. Greeting and suggestion chips: NO BOARD.

#### Steps
1. Finish New bot with a name and tap "Create" → thread opens for the new bot.
2. See the empty state → an agent greeting and suggestion rows; the composer reads "Message {agent name}".
3. Tap a suggestion → it fills the composer (send behavior belongs to the write-thread topic #417).

#### Variations
- `needsModel` is true (no model connected): "Connect a model to start a run" (brief, no board).
- Group with no messages: "Message the group".

#### Edge Cases
- Suggestion list is tall: Expo makes it scroll so the composer stays above the keyboard.
- No network at creation: not covered here.

#### Design gaps
- Empty agent greeting and suggestion layout is described in the rule card but not drawn.
- "Connect a model to start a run" has no board.
- Whether suggestions send immediately or only fill the composer is undecided.


### STORY-028: Hit an unknown message block from a newer server
**Type**: short
**Topic**: Talking to an agent: read and live thread
**Source**: topics/thread-read.md STORY-008
**Phase issue**: #416 (P4)
**Persona**: Grace Whitfield, founder who self-hosts the server and updates it before the app
**Goal**: Keep reading a thread when an agent posts a block kind the app does not know.
**Preconditions**: Server returns a message whose block kind is not in the app's list (about 25 known kinds); the rest of the thread is normal.
**Device**: standard iPhone
**Ideal path**: 1 — scroll past; the placeholder tells her something is not shown.
**Alternate paths**: open the same message on web, which renders it (no link from the placeholder is planned).
**Design source**: NO BOARD (plan Phase 4: "Unknown block kinds show a neutral placeholder").

#### Steps
1. Scroll to the agent turn with the new block → text blocks render normally; the unknown block shows a neutral placeholder row.
2. Continue reading → surrounding messages are unaffected and the thread keeps streaming.

#### Variations
- A known block with an unknown field: renders as known (contract parsing is lenient).
- Block kinds belonging to later phases (ask, choice, mail approval, MCP approval) in a phase-4-only build: they use the same placeholder until phase 5.

#### Edge Cases
- Message with only unknown blocks: the bubble would contain only the placeholder.
- Unknown product event type on the SSE stream: ignored by the reducer.

#### Design gaps
- The placeholder itself has no board (copy, icon, whether it names the kind).
- Between phase 4 and phase 5, approval cards would show as the placeholder even though the board draws them; the interim behavior should be stated.
- No path to "open on web" from the placeholder.


### STORY-029: Read a thread on iPhone Duo outer display with the side strip
**Type**: long
**Topic**: Talking to an agent: read and live thread
**Source**: topics/thread-read.md STORY-009
**Phase issue**: #416 (P4), #419 (P7)
**Persona**: Rafael Ortiz, founder who carries a folding phone and checks agents between meetings
**Goal**: Read the Inbox agent thread on the outer display, glance at its Page and List, and leave.
**Preconditions**: iPhone Duo, outer display (466x678 pt), closed. Thread has a draft awaiting approval.
**Device**: iPhone Duo outer
**Ideal path**: 4 — open thread, read, tap Page, Back.
**Alternate paths**: (a) Open chat from the Agent page; (b) List (checklist icon) in the strip opens the agent's list; (c) the More group opens agent actions (settings, open computer, clear, archive, delete).
**Design source**: `PG-A-Thread.dc.html`; Thread rules (outer layout); `PG-A-AgentPage.dc.html` for the Page destination; `Main.dc.html` for the outer chrome (not read in full).

#### Steps
1. From Home tap "Inbox agent" → thread opens; the 60 pt left strip shows the Dynamic Island, time, a Back group, Page and List icons, a spacer, and a More group.
2. Read the content column (starts at x=72): glass title capsule "Inbox agent" at top, messages bottom-aligned, floating composer with "Message Inbox agent".
3. Read the "Needs approval" mail card: "Send reply", "To Ana Ruiz", body text, and the two actions "Deny" and "Allow" (Allow is the one prominent button).
4. Tap the Page icon (doc.text) in the strip → the agent's pinned Page opens, titled with the agent name, with "Open chat" as its prominent button.
5. Tap "Open chat" → return to the thread at the same scroll position.
6. Tap More → a menu lists the agent actions (settings, open computer, clear, archive, delete).
7. Tap away → the menu closes; the thread is unchanged.
8. Tap Back (strip) → return to Home.

#### Variations
- Short height (466x420): strip items collapse bottom to top into More; the prominent action collapses last.
- Pins strip: if messages are pinned, a horizontal strip of chips sits under the title capsule (44 pt chips; tap scrolls to the message; long-press "Unpin"); hidden when empty.

#### Edge Cases
- The More menu "clear" and "delete" are destructive and need a confirm (belongs to Home/Settings stories).
- The thread has an unread divider while in the strip layout: position relative to the capsule is undefined.
- Back goes to Home or to the Agent page depending on how the thread was entered; stack behavior is not specified.

#### Design gaps
- The approval card on `PG-A-Thread` is the only card drawn at outer width; its action labels are "Deny" and "Allow" (board) while DS-06 uses "Allow once / Always allow / Deny" for MCP and "Save / Send" for mail; the board's mail card differs from DS-06's mail card (title "Send reply" vs "Re: Pilot timeline").
- No message-level context menu is drawn for the strip layout (long-press menu is native, not shown).
- Pins strip placement relative to the glass title capsule on the outer layout is not drawn.
- Standard-iPhone parity of Page and List is not drawn.


### STORY-030: Read the thread beside the Personnel list on the inner display
**Type**: long
**Topic**: Talking to an agent: read and live thread
**Source**: topics/thread-read.md STORY-010
**Phase issue**: #416 (P4), #419 (P7)
**Persona**: Fatima Rahman, head of operations at a 20-person SaaS startup
**Goal**: Unfold the Duo while reading a thread, switch between agents from the sidebar, and keep reading.
**Preconditions**: iPhone Duo; thread open on the Inbox agent on the outer display; two other agents have unread messages.
**Device**: inner flat
**Ideal path**: 3 — unfold, tap the next agent in the sidebar, read.
**Alternate paths**: (a) half-folded 1/2 + 1/2: Personnel list left, thread with composer right; (b) laptop pose: thread on the top half, composer on the bottom half; (c) outer display: Back to Home then tap another agent (4+ steps).
**Design source**: `Inner.dc.html`, `Split.dc.html`, `Desk.dc.html` (not read in full here); Thread and Group rules for inner, half-folded and laptop descriptions; `PG-A-Thread.dc.html`.

#### Steps
1. Unfold the phone with the thread open → the layout changes to 1/3 + 2/3 (890x626 pt, flat); the sidebar (right-edge side bar) and the third pane show the Personnel list; the thread stays on screen.
2. Read the Inbox agent thread in the two thirds → same bubbles, tool labels and working state as outer.
3. Tap "Finance agent" in the third → the thread pane switches to the Finance agent; its snapshot shows first, then the server snapshot replaces it.
4. See the unread divider in the Finance thread → read down to the latest.
5. Fold halfway → the layout snaps to 1/2 + 1/2 with nothing important at x 435-455; Personnel left, thread with its composer right.
6. Rotate to laptop pose (626x890) → thread on the top half, composer and quick actions as a horizontal bar on the bottom half; an approval card (if any) sits above the composer.
7. Unfold again to inner flat → the same agent stays selected and its scroll position is kept.

#### Variations
- Open a group thread in the third pane: the sidebar lists Personnel and groups; the member list opens as a third pane.
- Agent page open next to the thread: thread in the third, page in the two thirds.

#### Edge Cases
- A live stream is running while the layout changes: the stream must not restart; the reducer state survives the posture change.
- Switching agents quickly: the earlier thread's subscription must stop; unread state of the earlier thread is marked read only if the user reached the bottom.
- Fold line crossing a message bubble in half-folded mode.

#### Design gaps
- Which thread the pane shows when the inner display opens with no selection (the "last opened thread" is only said for Home) is not defined.
- The sidebar unread indicator per agent is not drawn.
- Per-agent subscription lifecycle when switching is not specified (one stream or several).
- Duo APIs sit behind `if #available(iOS 27.1, *)`; behavior on earlier OS versions for a folded device is not drawn.
- The same thread is rendered on outer, inner, half-folded and laptop pose; state and copy must match, but parity of the pins strip and unread divider across them is not drawn.


### STORY-031: Review the full history of an agent: search jump, paging and saved chat
**Type**: long
**Topic**: Talking to an agent: read and live thread
**Source**: topics/thread-read.md STORY-011
**Phase issue**: #416 (P4)
**Persona**: Naomi Feldman, founder reconstructing what the Finance agent said about the Q3 runway three weeks ago
**Goal**: Jump to an old message, read around it, then return to the present without losing her place.
**Preconditions**: Finance agent thread has about 600 messages across many pages. A saved-chat snapshot of the last 50 exists on the device. Global search exists in the API (`search.query`) but is not drawn.
**Device**: standard iPhone
**Ideal path**: 6 — open thread, scroll up with paging, find the message, tap a pin chip if one exists, read, "Jump to latest".
**Alternate paths**: (a) Search from Home side strip (Search icon, PG-A-Home) and tap a hit to jump with `threads/messages({around})`; (b) tap a pinned-message chip under the title capsule (pins strip, DS-06); (c) open from a notification linking to a specific message (no board).
**Design source**: `PG-A-Thread.dc.html`, Thread rules (loading earlier); `DS-06-Chat.dc.html` (pins strip). Search results screen: NO BOARD. Pagination boundary and "around" window: NO BOARD.

#### Steps
1. Open "Finance agent" → saved snapshot of the last 50 messages shows, then the server snapshot replaces it.
2. Scroll up to the top of the loaded messages → a small spinner shows and the next older page (`threads/messages` with `before`) is fetched; messages are inserted above without moving the visible position.
3. Keep scrolling up through three more pages → each page repeats the same spinner and insert.
4. Reach the beginning of the thread → the spinner stops and the first message is visible (end-of-history marker is undefined).
5. Read the message about runway and tap its tool label "Searched mail" → expands the detail card.
6. Long-press the message → native context menu; choose Copy.
7. Tap the "Jump to latest" control (Expo: down arrow button) → the thread scrolls to the newest message.
8. Check that live messages still arrive → the reducer applied them while the older pages were open.

#### Variations
- Jump in from search with `around: {messageId}`: the thread shows a window of messages around the hit with newer pages loadable below; a "Jump to latest" control returns to the live end (Expo has a "pinned page" mode for this).
- Tap a pins-strip chip "Pilot terms": the thread scrolls to the pinned message; the current chip gets a 14% primary tint.
- Pins strip is empty: it is hidden.

#### Edge Cases
- A new message arrives while viewing a window around an old hit: the live message is held and a "new messages" pill appears (Expo behavior).
- Paging fails midway (offline): Expo marks the newer load as failed and stops auto-retry; the native loading state is undefined.
- The saved-chat snapshot is for a different space or user (after space switch or sign-out): it must not display (caches are wiped or re-keyed on switch).
- Thread of 600 messages memory use: unspecified cap.

#### Design gaps
- Global search results screen and message jump are planned in the API but not drawn.
- "Jump to latest" and "new messages" pill have no board.
- End-of-history marker and paging failure are not drawn.
- Pins strip exists on DS-06 but the Thread rule card does not list it in primary data or layout.
- Saved-chat snapshot: when it is stale, whether any signal is shown, and the retention size are not defined.


### STORY-032: Read and approve-view an agent's mail draft while the stream is live
**Type**: long
**Topic**: Talking to an agent: read and live thread
**Source**: topics/thread-read.md STORY-012
**Phase issue**: #416 (P4), #417 (P5)
**Persona**: Jonah Whitaker, founder of a 4-person devtools startup, on a standard iPhone at a coffee shop
**Goal**: Watch the Inbox agent draft a reply to Ana, read the draft and the tool steps, and see the status change when the draft is sent from another device.
**Preconditions**: Thread open; mail writes are enabled; a run is in progress; the same user also has the web app open.
**Device**: standard iPhone
**Ideal path**: 5 — open thread, wait for the card, read, (decide in the write topic), watch the status flip.
**Alternate paths**: (a) approve from the web app; (b) approve from the Inbox message view via "Ask Inbox agent" thread; (c) decide in the phone thread (write behavior is the Approvals topic, #417).
**Design source**: `PG-A-Thread.dc.html` (Needs approval card, "Deny", "Allow"); `DS-06-Chat.dc.html` (Mail approval card: Needs approval, Sent, Not sent). Read-only phase-4 rendering of approval cards: NO BOARD.

#### Steps
1. Open "Inbox agent" → snapshot arrives; the working indicator "Inbox agent is working" is at the bottom.
2. A tool label "Searched mail, 12 results" appears, then the agent bubble "Reply to Ana: Thursday works, 10am. Here is a draft. I have not sent it." streams in.
3. The mail approval card appears: status "Needs approval" in warning color, rows "To Ana Ruiz", subject, body "Hi Ana, Thursday works. Let's start at 10am."
4. The run goes to `run.waiting_input` → the working indicator is replaced by the card's waiting state; the composer remains available.
5. Jordan approves and sends the mail on the web app → a product event arrives on the SSE stream.
6. The card status flips to "Sent" with a checkmark and the actions are removed (live update, no refresh).
7. The agent posts a follow-up bubble "Sent." and the run completes → the working state clears.

#### Variations
- Mail is rejected from web: status "Not sent" with an x mark.
- Phase-4-only build: the card renders as read-only or as the unknown-block placeholder (see STORY-028) and "Allow" does not act.
- Two devices act at once: a second answer to the same ask returns CONFLICT; the card shows the winning result.

#### Edge Cases
- Stream drops between steps 5 and 6: the reconnect (STORY-024) refetches the snapshot, which already contains "Sent".
- Compose result `unknown`: never auto-retry (brief); card state is not drawn.
- Mail writes are off: "Changing mail is turned off."

#### Design gaps
- The thread rule card names "Allow" as the one prominent action, but phase 4 is read only; interim behavior of approval cards in the read-only phase is undefined.
- Board mail card (title "Send reply", actions "Deny" / "Allow") and DS-06 mail card (subject "Re: Pilot timeline", actions "Save" / "Send") do not match.
- Live status flip from another device is not drawn; the "Sent" and "Not sent" specimens exist but no transition.
- "Changing mail is turned off." and CONFLICT outcomes have no board.
- The same approval is rendered on the thread, on the Inbox message view, on Home Activity ("needs approval") and in push; their labels need one source.



## Topic: Stories: Sending, attachments and offline

Source file: `docs/ios-native/ux/topics/thread-send.md`

### STORY-033: Send a plain text message to one agent
**Type**: short
**Topic**: Sending, attachments and offline
**Source**: topics/thread-send.md STORY-001
**Phase issue**: #417 (P5)
**Persona**: Maya Okafor, solo founder of a 3-person logistics startup
**Goal**: Ask the Inbox agent to draft a reply to a customer and see it accepted.
**Preconditions**: Signed in, a model is connected, the thread with "Inbox agent" is open on a standard iPhone, network is up.
**Device**: standard iPhone
**Ideal path**: 3 — type, tap Send, read the reply.
**Alternate paths**: Dictate with the mic in the empty composer (mic becomes Send once text appears); voice call from the thread (see the voice topic); reply to an existing message (STORY-036).
**Design source**: `DS-06-Chat.dc.html` Composer (Empty, Typing states) and "User bubble and agent message"; `PG-A-Thread.dc.html`; `PG-A-Rules.dc.html` Agent thread card ("With nothing pending, send in the composer").

#### Steps
1. Tap the glass capsule labelled "Message Inbox agent" → keyboard rises, composer lifts above the keyboard and home indicator inset. Trailing control is the bare mic (Dictate). Send is not shown yet.
2. Type "Reply to Ana: Thursday works, 10am." → the mic is replaced by the prominent Send arrow (SF `arrow.up`, ink arrow on light fill). The capsule grows up to 6 lines, then scrolls.
3. Tap Send → the bubble appears right-aligned at 70% opacity with caption "Sending"; the composer clears; the working indicator appears ("Inbox agent is working") and the trailing control becomes Stop. When the server echo arrives the bubble goes to full opacity with the caption "Delivered" or a sent time such as "9:41 AM".

#### Variations
- Text longer than 6 lines: capsule stops growing and scrolls inside.
- Empty or whitespace-only text: Send stays disabled (board: "Send is disabled with no text and no attachment").
- The same exchange on iPhone Duo outer display, inner display and half-folded renders the same composer; only the column width changes (see the Duo topic).

#### Edge Cases
- Double tap on Send must not create two messages. The plan uses `clientNonce`, which suggests the server de-duplicates a retry, but the double-tap guard in the UI is not stated.
- Send while the keyboard is dismissing mid-animation: not specified.

#### Design gaps
- The "Sending" caption is described only on the last bubble of a run. What the caption shows when two of my own messages are in flight at once is not defined.
- The rule card says working shows "three blue dots"; DS-06 says the dots are neutral (card fill pill, 6pt dots) and the ring uses `statusWorking`. Rule card and component board disagree on color.


### STORY-034: Attach a photo and a PDF, then send
**Type**: medium
**Topic**: Sending, attachments and offline
**Source**: topics/thread-send.md STORY-002
**Phase issue**: #417 (P5)
**Persona**: Tomas Reyes, founder of a seed-stage hardware company
**Goal**: Send a photographed receipt and a PDF contract to the Finance agent and ask for a summary.
**Preconditions**: Thread with "Finance agent" open, photo library permission already granted, a 2 MB JPEG and a 3 MB PDF available.
**Device**: standard iPhone
**Ideal path**: 7 — Attach, pick photo, Attach, pick file, type, Send, wait.
**Alternate paths**: Take a photo via the Camera source instead of the library; attach an existing artifact or Data room item (the contract has `artifactIds` and `dataRoomItemIds` on `threads/send`, but the plan names no picker for them); share a file into the app from another app (share extension, phase 11, #425, no board).
**Design source**: `DS-06-Chat.dc.html` Composer and "Attachment chips and reply preview" specimen (chips "terms.pdf" and "chart.png", message "Check the attached"). The Attach menu itself: NO BOARD.

#### Steps
1. Tap the 44pt glass circle with `plus` (Attach) at the left of the composer → a source menu opens. Expo labels: "Photo library", "Camera", "File". The native menu is NO BOARD.
2. Choose "Photo library" and pick one photo → a 32pt chip appears inside the capsule above the text, showing the thumbnail and a remove control.
3. Tap `plus` again, choose "File", pick the PDF → a second chip appears with the file name (for example "terms.pdf").
4. Type "Check the attached" → the trailing control becomes Send.
5. Tap Send → the client uploads each file with `artifacts/create` (60 s allowed per upload), then calls `threads/send` with the returned `artifactIds`. The bubble shows the image thumbnail and a file row, caption "Sending".
6. Wait → caption changes to "Delivered"; the Finance agent shows "Finance agent is working".

#### Variations
- Attachment only, no text: Send is enabled ("Send is disabled with no text and no attachment"), so a lone attachment is valid.
- Remove a chip before sending with the chip remove control (Expo accessibility label "Remove {name}").
- Same flow in a group thread: chips and composer are identical; the bubble is not tinted by bot color.

#### Edge Cases
- Upload of the first file succeeds and the second fails: whether the first artifact is reused on retry is not specified (the outbox keeps the attachment payload, per the 50 MB cap, which implies bytes are stored).
- Photo permission denied: Expo shows a skipped notice "{name} (permission denied)". The native equivalent and the Settings deep link are NO BOARD.
- Large file while on cellular: no progress indicator is designed.

#### Design gaps
- NO BOARD for the Attach source menu, a per-chip upload progress state, or a chip error state.
- The chip row has no board state for 4 chips at once (it can need to scroll or wrap inside a capsule that grows to 6 lines).
- No picker for artifacts or Data room items even though `threads/send` accepts them.
- Expo reads "Photo library / Camera / File"; the board shows only the `plus` button and no labels.


### STORY-035: Attach a HEIC photo, a too-large video and a fifth file
**Type**: medium
**Topic**: Sending, attachments and offline
**Source**: topics/thread-send.md STORY-003
**Phase issue**: #417 (P5)
**Persona**: Priya Natarajan, founder of a two-person legal-tech startup
**Goal**: Attach several files and understand which were accepted.
**Preconditions**: Thread open; the library contains one HEIC photo, a 40 MB screen recording, and four small PNG screenshots.
**Device**: standard iPhone
**Ideal path**: 4 — Attach, pick items, read the notice, send what was accepted.
**Alternate paths**: Attach in two batches; pick via Files instead of the library.
**Design source**: Chips and Composer in `DS-06-Chat.dc.html`. Rejection notice: NO BOARD. Plan: README section 5 ("convert HEIC photos to JPEG first").

#### Steps
1. Tap `plus`, choose "Photo library", select the HEIC photo and the screen recording → the HEIC is converted to JPEG on the device and shows as a chip. The recording is rejected as over 10 MiB or as an unsupported type.
2. Read the notice → Expo shows "Skipped {items}" with reasons such as "(over 10 MiB)" or "(unsupported type)". In the native app the place and style of this notice are undefined.
3. Tap `plus` again, choose "Photo library", select the four PNG screenshots → three are added (total 4); the fourth is skipped with "(max 4 attachments)".
4. Type a message and tap Send → four attachments upload, then the message is sent.

#### Variations
- Remove one chip, then add the skipped screenshot.
- Share extension path (phase 11): not designed.

#### Edge Cases
- A Live Photo or a HEIC larger than 10 MiB after conversion: the size check order (before or after conversion) is not specified.
- Animated GIF over 10 MiB or a zip with unsupported contents: only the declared MIME list is validated.

#### Design gaps
- NO BOARD for the "Skipped" notice. Expo shows it as plain text under the composer; no style, position or auto-dismiss rule exists in the native design.
- The spec says HEIC is converted, but no user-visible state ("Converting") is defined for slow conversions.
- Copy for reasons is built by string match in Expo ("over 10 MiB", "unsupported type", "max N attachments", "permission denied"); the boards give none, and the brief says "MB" while Expo says "MiB".


### STORY-036: Reply to one message with a quoted snippet
**Type**: short
**Topic**: Sending, attachments and offline
**Source**: topics/thread-send.md STORY-004
**Phase issue**: #417 (P5)
**Persona**: Jordan Lee, operations lead at a 6-person services startup
**Goal**: Answer one specific message in a long thread so the agent knows which one.
**Preconditions**: A thread with an incoming agent message "Thursday 10am is booked. I will send the invite."
**Device**: standard iPhone
**Ideal path**: 4 — long-press, Reply, type, Send.
**Alternate paths**: Quote a selected part of a message (the contract has `replyQuote`; the Select-text sheet in `DS-04-Overlays.dc.html` lets someone select part of a message but no board connects it to Reply); no swipe-to-reply gesture is planned or designed.
**Design source**: `DS-06-Chat.dc.html` "Failed send bubble and reply line" (Reply line) and Composer "Replying to Ana Ruiz" preview; long-press menu: NO BOARD (Expo uses native menu items "Reply", "React", "Copy").

#### Steps
1. Long-press the agent bubble → a native context menu appears with "Reply", "React", "Copy" (Expo labels; board says only "Selection and Copy for whole message are in the long-press context menu (native)").
2. Tap "Reply" → a glass strip appears above the capsule: 2pt bar, author name, one-line snippet, optional 28pt thumbnail, and a dismiss control (`xmark.circle.fill`, 44pt target).
3. Type "Great, please send it." and tap Send → the new user bubble shows a reply line above it with the quoted author and snippet. `threads/send` carries `replyToMessageId` and `replyQuote`.
4. Tap the reply line later → the thread scrolls to the original message.

#### Variations
- Dismiss the strip with `xmark.circle.fill` and send as a normal message.
- Reply to an image message: the strip and reply line show a 28pt thumbnail.
- Typing "@" while the reply strip is open: the mention popover replaces the strip position until closed (board rule: "Do not stack the popover and reply preview").

#### Edge Cases
- The original message is far above the loaded page: scroll-to-original needs paging; not specified.
- The quoted message was from a member who has since left: the bubble keeps the name (discovery map).

#### Design gaps
- NO BOARD for the message long-press menu, for part-message quote, or for the unavailable-original case.
- Whether the reply target survives an app relaunch or posture change is not specified.


### STORY-037: Mention a teammate-agent in a group thread
**Type**: medium
**Topic**: Sending, attachments and offline
**Source**: topics/thread-send.md STORY-005
**Phase issue**: #417 (P5), #419 (P7)
**Persona**: Aisha Bello, founder of a 4-person climate-data startup
**Goal**: Ask only the Legal agent a question inside the "Funding room" group thread.
**Preconditions**: Group "Funding room" with Finance agent, Legal agent and a human teammate Jordan Lee.
**Device**: iPhone Duo outer
**Ideal path**: 5 — type @, pick member, finish text, Send.
**Alternate paths**: Send without mention so all agents may answer (the group thread shows one working line per agent); open "Members" in the side strip to see who is in the group.
**Design source**: `DS-06-Chat.dc.html` "Mention suggestions" (rows "Finance agent", "Legal agent", "Jordan Lee", typed "@Fi"); `PG-A-GroupThread.dc.html`; `PG-A-Rules.dc.html` Group thread card; Duo outer side strip in `Main.dc.html`.

#### Steps
1. Tap "Message Funding room" and type "@" → a glass popover opens above the composer with 44pt rows: 28pt letter tile, name, role ("Agent", "Teammate"). The first row is selected.
2. Type "Le" → the list filters to "Legal agent".
3. Tap "Legal agent" (or press return on the selected row) → the composer inserts the mention and the popover closes.
4. Type " which filings are due this week?" and tap Send → `threads/send` carries `mentions`. The user bubble shows the mention.
5. Observe the response → only a "Legal agent is working" line appears, not one for Finance agent.

#### Variations
- Dismiss the popover with Escape (hardware keyboard), a tap away, or by deleting the "@".
- Mention a human teammate (`person.fill` circle); whether that sends them a notification is not defined.
- Mention in a one-to-one thread: the popover behavior in a thread with one agent is not specified.

#### Edge Cases
- No match for the typed text: the empty popover state is not designed.
- Mention then edit the name text by hand: how the tag is invalidated is not specified.

#### Design gaps
- NO BOARD for the empty popover and for how a mention token looks inside the capsule and inside the sent bubble.
- The scope of `mentions` (agents only, or humans too) is not stated in the brief; "Teammate" appears on the board.


### STORY-038: Send fails offline, message waits, then delivers
**Type**: medium
**Topic**: Sending, attachments and offline
**Source**: topics/thread-send.md STORY-006
**Phase issue**: #417 (P5)
**Persona**: Luis Ferreira, founder of a food-supply startup, on a train with patchy signal
**Goal**: Send an instruction while offline and have it go out once the signal returns.
**Preconditions**: Thread with "Ops agent" open; saved chat snapshot exists; device goes into a tunnel.
**Device**: standard iPhone
**Ideal path**: 3 — type, Send, wait for reconnection.
**Alternate paths**: Retry by hand with the "Retry" control; background the app and return.
**Design source**: `DS-06-Chat.dc.html` "Failed send bubble and reply line" and caption states (sending 70% opacity). Offline and queued states: NO BOARD (the discovery map lists "offline (saved snapshots and outbox 'queued')" as a state the brief requires and no board shows).

#### Steps
1. Open the thread with no network → the saved chat snapshot shows (last 100 messages). An offline indicator is NO BOARD.
2. Type "Order 40 crates of oats for Friday." and tap Send → the bubble appears at 70% opacity with caption "Sending". The send is stored in the outbox as queued because the server is unreachable.
3. The network returns → the app resends the queued message (the unreachable case "goes back to queued" and is retried automatically; the exact trigger is the reachability subscription seen in `apps/mobile/lib/unsent-sends.ts`).
4. Delivery succeeds → caption changes to "Delivered" and the working indicator for the Ops agent appears.

#### Variations
- Rate limit (429): the entry returns to queued rather than failing; the user sees "Sending" until it passes.
- Kill the app while queued: on relaunch the outbox is restored from disk and the send continues.
- Send three messages offline: all three queue in order.

#### Edge Cases
- Outbox holds 20 entries and 50 MB. At the cap Expo throws "Too many unsent messages"; how the native composer shows this is NO BOARD.
- The outbox lives in the OS cache directory, which the system may evict; a queued message can silently disappear. No warning is designed.
- The user switches space or signs out with queued messages: Expo scopes entries by server, space and user; the user-visible behavior is not designed.

#### Design gaps
- NO BOARD for offline: no banner, no "queued" caption (the board offers only "Sending", "Delivered" and "Not sent"), no stale snapshot marker.
- Treating a message that waits for hours as "Sending" at 70% opacity is misleading; a distinct "Waiting for connection" state is needed.
- Eviction of the cache directory loses queued sends without notice.


### STORY-039: A send is refused and the user edits and retries
**Type**: long
**Topic**: Sending, attachments and offline
**Source**: topics/thread-send.md STORY-007
**Phase issue**: #417 (P5)
**Persona**: Nadia Karimi, founder of a 5-person compliance startup
**Goal**: Recover from a failed send of a message with an attachment, then send successfully.
**Preconditions**: Thread with "Legal agent" open; a 9 MiB PDF is attached; the server returns a 4xx (for example payload too large) on the first try.
**Device**: standard iPhone
**Ideal path**: 6 — Send, see Not sent, long-press, edit, Retry, delivered.
**Alternate paths**: Tap "Retry" directly without editing; long-press then "Delete" to discard; reduce the attachment and send a new message.
**Design source**: `DS-06-Chat.dc.html` "Failed send bubble and reply line" (border `#F46262`, row `exclamationmark.circle` "Not sent", "Retry" `arrow.counterclockwise`, long-press "Retry, Delete"). `PG-A-Rules.dc.html` Agent thread card: "Error: inline 'Failed to send message' with retry". Refused-state copy: NO BOARD.

#### Steps
1. Attach the PDF, type "Please review the contract.", tap Send → bubble at 70% opacity, caption "Sending".
2. The server rejects with a 4xx other than 408, 425, 429 → the outbox entry becomes refused; the bubble gets a 1px destructive border and a right-aligned row "Not sent" with "Retry" below it. Message text is not red.
3. Tap "Retry" immediately → row shows "Sending", then "Not sent" again because the cause is unchanged.
4. Long-press the bubble → a menu with "Retry" and "Delete". The board says failed text stays editable "on Retry via long-press", but no "Edit" item is listed in the menu.
5. Choose "Delete" → the failed bubble and its stored attachment leave the thread and the outbox.
6. Attach a smaller PDF, retype and tap Send → delivered.

#### Variations
- A failed (not refused) send, for example a 500: stored as failed, same bubble and row, Retry allowed.
- Failure that Expo reports as an alert: Expo shows `Alert` "Failed to send message" plus error text, and also saves the entry; the rule card describes an inline message instead. The native app must pick one.
- Refused for "Connect a model to start a run" (no model): see STORY-040.

#### Edge Cases
- Refused entries count toward the 20-entry cap until deleted; a thread full of refused entries blocks new sends ("Too many unsent messages").
- A refused send with an attachment: whether Retry re-uploads the artifacts or reuses ids is not specified.
- The "AI data sharing" consent block ("Review AI data sharing in Account settings before continuing.") is also a 4xx and would land here as refused with no way to fix it from the bubble.

#### Design gaps
- The refused state looks identical to failed, so the user cannot tell that Retry will never work. The brief defines three outbox states but the board has one "Not sent" row.
- The long-press menu on the failed bubble shows "Retry, Delete" but the text says the message is editable via long-press; the edit action is not in the menu.
- Copy mismatch: rule card says "Failed to send message", component board says "Not sent"; Expo uses "Failed to send message" in an alert.
- NO BOARD for the error reason text (where "payload too large" is shown).


### STORY-040: Send with no model connected, then connect one and resend
**Type**: long
**Topic**: Sending, attachments and offline
**Source**: topics/thread-send.md STORY-008
**Phase issue**: #417 (P5)
**Persona**: Ben Adeyemi, a founder trying the self-hosted server for the first time
**Goal**: Understand why the agent is not answering and fix it.
**Preconditions**: New space on a self-hosted server; no model provider connected; thread with "Chief" open.
**Device**: standard iPhone
**Ideal path**: 7 — Send, read error, open settings, connect model, return, Retry.
**Alternate paths**: Connect the model first from Settings, "Models", then open the thread; use a subscription sign-in instead of an API key (see the settings topic).
**Design source**: `DS-06-Chat.dc.html` failed bubble and reply line. The no-model message: NO BOARD. Models setup: `PG-B-Models.dc.html` (settings topic).

#### Steps
1. Open "Chief" thread → empty state: agent greeting and suggestions (Agent thread rule card).
2. Type "Draft my weekly update." and tap Send → the server returns "Connect a model to start a run" (README). The README names the string; the server source (`packages/adapters/src/executor.ts`) uses "Connect a model in Settings before running bots." The strings differ, so the exact wording the app shows is TBD.
3. The bubble goes to "Not sent" with "Retry" (or the message is accepted and a run error appears; which of the two happens is not stated).
4. Open Settings from the Home account control → find "Models" (see the settings topic for the route).
5. Connect a provider key or sign in → return to the thread.
6. Tap "Retry" on the bubble → status "Sending", then the working indicator.
7. The reply arrives and the caption reads "Delivered".

#### Variations
- Server older than the app (404 on `threads/send` fields): "not supported" handling, no board.
- A message sent while a run is already waiting for an approval: the run state `run.waiting_input` is a different flow (approvals topic).

#### Edge Cases
- Model is disconnected while a message is queued offline: the retry later fails with the same error.
- Expo also renders "Waiting for this bot's response." in the thread (line 4257 of `thread.tsx`); its native equivalent is undefined.

#### Design gaps
- NO BOARD for the no-model block or any deep link from the error to "Models".
- Message text conflict between README ("Connect a model to start a run") and server ("Connect a model in Settings before running bots.").
- It is unclear whether this is a refused send (Not sent bubble) or a run error (`run.failed`) with no bubble change.


### STORY-041: Stop a running agent and send a correction
**Type**: short
**Topic**: Sending, attachments and offline
**Source**: topics/thread-send.md STORY-009
**Phase issue**: #417 (P5)
**Persona**: Emi Tanaka, founder of an e-commerce analytics startup
**Goal**: Interrupt a long agent run that is going the wrong way and redirect it.
**Preconditions**: "Research agent" is working on a task started a minute ago.
**Device**: standard iPhone
**Ideal path**: 3 — tap Stop, type a correction, Send.
**Alternate paths**: Stop from the Live Activity or notification (phase 11, no board); type the correction without stopping and send (queued behind the run: behavior not defined).
**Design source**: `DS-06-Chat.dc.html` Composer "Agent running (Stop)" and "Working indicator and agent event label"; `PG-A-Rules.dc.html` Agent thread card ("a stop control in the composer").

#### Steps
1. The composer's trailing slot shows Stop (`stop.fill`) in the same prominent position as Send → tap it.
2. The client calls `threads/stop`; the working indicator disappears, the trailing slot returns to the mic, and an event note may appear (cancelled run).
3. Type "Focus on EU competitors only." and tap Send → bubble "Sending" then "Delivered"; the agent starts a new run.

#### Variations
- In a group thread, several agents work at once; one Stop control ends the thread's runs (the contract takes a thread target; per-agent stop is not designed).
- Stop fails: Expo shows an alert "Failed to stop work" with "Try again."; the native version must keep that.

#### Edge Cases
- The run finishes while the user taps Stop: the button turns back into the mic first; the tap may land on Dictate.
- If text is already typed, the slot must show Send or Stop, not both; the board says "Stop in the same prominent slot" while the user has text. Which wins is undefined.

#### Design gaps
- Conflict: with text typed and an agent running, the one trailing slot cannot be both Send and Stop.
- NO BOARD for the "stopping" intermediate state and for a stop failure.
- No board for "Work stopped, but the thread could not refresh" (Expo message).


### STORY-042: React to an agent message
**Type**: short
**Topic**: Sending, attachments and offline
**Source**: topics/thread-send.md STORY-010
**Phase issue**: #417 (P5)
**Persona**: Carlos Mendez, founder of a pet-supplies startup
**Goal**: Mark an agent's answer as useful with a thumbs up, then change it.
**Preconditions**: Agent message present in an open thread.
**Device**: standard iPhone
**Ideal path**: 3 — long-press, React, pick emoji.
**Alternate paths**: none found (no double-tap shortcut is planned).
**Design source**: NO BOARD. Long-press menu and reaction picker are not in `DS-06-Chat.dc.html`. Behavior from `packages/contracts/src/reactions.ts` and `threads.react`.

#### Steps
1. Long-press the agent bubble → native context menu with "Reply", "React", "Copy".
2. Tap "React" → a picker with the six fixed reactions (thumbs up, thumbs down, heart, laugh, party, surprised). Picker design is NO BOARD.
3. Tap thumbs up → the reaction shows under the bubble after `threads/react` returns and `thread.message.reaction` arrives by SSE.

#### Variations
- Tap the same reaction again to remove it (assumed from Expo; not confirmed in the brief).
- Another member reacts: the event updates the thread live.
- Offline: reactions are not in the outbox (README says nothing works offline except the outbox), so the tap fails.

#### Edge Cases
- Failure shows Expo's alert "Could not update reaction" with "Try again."; native copy is not defined.
- Reactions on a message from a removed member: not specified.

#### Design gaps
- NO BOARD for reaction picker, the reaction display under a bubble, or the "mine vs others" state.
- No optimistic or offline behavior is specified.


### STORY-043: Long founder session across attachment, reply, failure and recovery
**Type**: long
**Topic**: Sending, attachments and offline
**Source**: topics/thread-send.md STORY-011
**Phase issue**: #417 (P5), #419 (P7)
**Persona**: Sofia Marin, founder of a 3-person fintech startup, prepping a board update
**Goal**: In one session, gather documents for the Finance agent, ask questions, survive a connection drop, and end with a reply she trusts.
**Preconditions**: Signed in, model connected, thread with "Finance agent" open, three PDFs and one HEIC screenshot ready.
**Device**: standard iPhone, later moved to iPhone Duo inner display (flat)
**Ideal path**: 22 — about 22 taps for a complete session.
**Alternate paths**: Put the files in the Data room first and ask the agent to read them (Data room topic); send each file as its own message.
**Design source**: `DS-06-Chat.dc.html` (Composer, chips, failed bubble, reply line, working indicator); `PG-A-Thread.dc.html`; inner layouts in `Inner.dc.html` and the Agent thread rule card; offline, notices and menus: NO BOARD.

#### Steps
1. Open the "Finance agent" thread → saved snapshot shows, then the latest page replaces it.
2. Tap `plus` → "Photo library" → pick the HEIC screenshot → converted to JPEG, chip appears.
3. Tap `plus` → "File" → pick `board-deck.pdf` → second chip.
4. Tap `plus` → "File" → pick `q3-summary.pdf` → third chip.
5. Tap `plus` → "File" → pick `cap-notes.pdf` → fourth chip (the limit).
6. Tap `plus` again → the menu still opens; picking any file shows "(max 4 attachments)".
7. Type "Summarize runway risks from these." and tap Send → four uploads then the send; bubble at 70%, caption "Sending".
8. Signal drops during step 7 → the entry is queued; the user keeps reading.
9. Signal returns → delivered; "Finance agent is working" appears with Stop.
10. The reply arrives with a table; tap Expand on the table → full-height sheet opens.
11. Close the sheet; long-press the reply → "Reply".
12. Type "What if hiring slips two months?" and tap Send → reply line quoted above the new bubble.
13. The send is refused (rate or size) → "Not sent" with "Retry"; tap "Retry" → delivered.
14. Open the inner display (unfold) → the thread appears in the 2/3 pane with Personnel in the 1/3 pane; the composer text, chips and queue state must carry over.
15. Long-press the final reply → "React" → thumbs up.

#### Variations
- App backgrounded during upload: whether uploads continue in the background is not specified (60 s upload timeout in the brief).
- Hide amounts device setting on: finance cards in chat respect it; plain agent text does not.

#### Edge Cases
- Posture change while chips and an unsent draft are in the composer: not specified (discovery map: "how selection and scroll position survive these changes").
- Cache eviction of the outbox during the long session.

#### Design gaps
- NO BOARD for offline, queued waiting, upload progress, the Attach menu, the long-press menu, reaction picker, or posture-change continuity of the composer.
- Attachment total (4 files, up to 40 MiB of base64) against the 50 MB outbox cap leaves room for about one such message; no warning is designed.


### STORY-044: First message to an agent from the empty thread with a suggestion
**Type**: short
**Topic**: Sending, attachments and offline
**Source**: topics/thread-send.md STORY-012
**Phase issue**: #417 (P5)
**Persona**: Hannah Cole, a founder who just created her first bot "Chief"
**Goal**: Start a conversation using a suggested prompt.
**Preconditions**: New bot, thread has no messages.
**Device**: standard iPhone
**Ideal path**: 2 — tap a suggestion, then Send (assuming a suggestion fills the composer; if it sends directly the path is 1, but the board does not say).
**Alternate paths**: Type your own first message; tap the mic and dictate.
**Design source**: `PG-A-Rules.dc.html` Agent thread card ("Empty: agent greeting and suggestions"). The suggestion chips themselves: NO BOARD.

#### Steps
1. Open the new thread → agent greeting and suggestions show above the composer.
2. Tap a suggestion → either the text fills the composer or it sends at once; not defined.
3. Tap Send if needed → the bubble appears, working indicator follows.

#### Variations
- Dictation: tap the mic, speak, tap the mic again; text appears in the capsule (Listening state in DS-06).
- Speech permission denied: Expo shows "Allow speech recognition in Settings, or connect ElevenLabs, OpenAI, or Fish Audio."

#### Edge Cases
- No model connected: see STORY-040.

#### Design gaps
- NO BOARD for the suggestion chips and no rule for tap behavior (fill versus send).
- The empty thread is described only in the rule card text.



## Topic: Approvals and AI data consent: user stories

Source file: `docs/ios-native/ux/topics/approvals-consent.md`

### STORY-045: Allow a payment tool once from the agent thread
**Type**: short
**Topic**: Approvals and AI data consent
**Source**: topics/approvals-consent.md STORY-001
**Phase issue**: #417 (P5)
**Persona**: Priya Nandakumar, founder of a 6-person logistics startup, Mercury agent connected
**Goal**: Let the Mercury agent send a pilot invoice payment after reading what it will do
**Preconditions**: Signed in, Mercury agent thread open, connector writes turned on, run is `run.waiting_input` with an `ask` block carrying `approvalEffectId` and actions allow, always, deny
**Device**: standard iPhone
**Ideal path**: 3 — read the card, tap "Allow once", see the resolved line
**Alternate paths**: (a) Answer from the iPhone Duo inner display in the 2/3 thread pane (same card). (b) Answer from the web app or Expo app; the native card then shows the resolved state after the next `threads/get` or event. (c) Tap the push notification, which opens the thread at the card (push tap behavior is not specified for approvals).
**Design source**: DS-06-Chat "MCP tool approval" card (all steps); PG-A-Thread rule card ("Allow in the approval card is the one prominent control"); resolved line from DS-06 "Resolved".

#### Steps
1. Open the Mercury agent thread from Home → the thread shows the "Mercury agent wants to run requestSendMoney" card with Amount, Recipient "Northwind", Memo "Pilot invoice" in an inset well.
2. Tap "Allow once" (prominent) → the button shows a sending state, all three buttons disable, the run resumes.
3. Wait for the answer to land → the card collapses to one line "Allowed once: requestSendMoney" and the agent continues.

#### Variations
- Tap "Always allow" instead: the line reads "Always allowed" (Expo wording). The rule appears under `approvalRules.list`; no iOS screen to see or remove it.
- Tap "Deny": line reads "Denied" and the agent replies it did not proceed.

#### Edge Cases
- Network drops after tapping: error alert "Could not submit answer" (Expo wording), buttons re-enable. DS-06 says this is a native alert.
- The same ask was already answered from the web app: `threads/answer` returns CONFLICT (see STORY-050).
- Arguments longer than 4 lines: DS-06 caps the well at 4 lines; no way to see the full arguments is drawn.
- The thread is opened read-only (Expo has `useThreadReadOnly`): buttons should be hidden; no board.

#### Design gaps
- Read-only thread state for approval cards has no board.
- No way to expand truncated arguments before approving a money action.
- "Always allow" has no confirmation and no screen to review or undo it (`approvalRules.*` has API, no iOS screen planned).


### STORY-046: Approve a drafted reply from the Inbox agent
**Type**: medium
**Topic**: Approvals and AI data consent
**Source**: topics/approvals-consent.md STORY-002
**Phase issue**: #417 (P5), #418 (P6)
**Persona**: Marcus Oyelaran, solo founder answering a design partner while commuting
**Goal**: Send Ana Ruiz a reply the Inbox agent drafted, after checking recipients
**Preconditions**: Inbox agent thread open after asking "Reply to Ana: Thursday works, 10am"; an `ask.mail` of kind `mail_send` is pending; mail writes are on
**Device**: standard iPhone
**Ideal path**: 3 — open the agent thread, check the draft, tap "Send"
**Alternate paths**: (a) Start from Inbox message → "Ask Inbox agent", then land on the same card. (b) On Duo inner display the same card appears in the right 2/3 pane beside the inbox list (Inner board). (c) Tap "Save" to keep only a draft in the mail account. (d) Edit-and-send (STORY-047).
**Design source**: PG-A-Thread (card with "Needs approval", "Deny", "Allow" on the inbox agent thread); Inner (card with "Save" and "Send"); DS-06-Chat "Mail approval card" (anatomy, states Needs approval, Sent, Not sent). The two boards disagree on the buttons: PG-A-Thread shows "Deny"/"Allow", Inner and DS-06 show "Save"/"Send".

#### Steps
1. In the Inbox, tap the row "Re: Pilot timeline" from Ana Ruiz, then tap "Ask Inbox agent" (prominent) → the Inbox agent thread opens with the composer "Message Inbox agent".
2. Type "Reply to Ana: Thursday works, 10am." and tap Send → the agent works ("Inbox agent is working"), "Searched mail, 12 results" appears.
3. The card "Re: Pilot timeline — Needs approval" appears with To Ana Ruiz and the body "Hi Ana, Thursday works. Let's start at 10am." Agent text says "Here is a draft. I have not sent it."
4. Read To, Cc and body → card shows all fields; no auto-send.
5. Tap "Send" (prominent tinted capsule) → status changes to "Sent" with a check mark.

#### Variations
- Tap "Save": outcome `saved`; the card shows a saved state (no board for the word).
- Tap "Deny" (PG-A-Thread version): outcome "Not sent" with an x mark.
- Draft has a Cc: DS-06 shows a Cc row between To and the body.

#### Edge Cases
- Draft has no recipient: DS-06 says do not show "Send".
- Send result is `unknown` (server cannot confirm): no board for this outcome; discovery lists it as an open case.
- Mail writes are off on the deployment: the agent cannot draft a send; no drawn state for what the card shows.
- Same information appears on Inbox agent thread, Inbox message (as agent entry) and Duo inner pane; the card is one component.

#### Design gaps
- Conflict between PG-A-Thread ("Deny"/"Allow") and Inner/DS-06 ("Save"/"Send") for the same card.
- No board for the `unknown` and `failed` outcomes or for the post-save state.
- "View draft" (README mentions it) has no board; unclear whether the body is truncated on the card.


### STORY-047: Fix the recipient list, then edit and send
**Type**: long
**Topic**: Approvals and AI data consent
**Source**: topics/approvals-consent.md STORY-003
**Phase issue**: #417 (P5), #418 (P6), #419 (P7)
**Persona**: Lena Hartmann, founder of a 4-person climate data startup
**Goal**: Add Jordan Lee on Cc and fix a line in the draft before it goes out
**Preconditions**: Same as STORY-046; the draft body has a wrong time; mail writes on
**Device**: iPhone Duo outer display
**Ideal path**: 7 — open card, open editor, change Cc and body, confirm, send
**Alternate paths**: (a) Tell the agent in the composer "Add Jordan on Cc" (DS-06 shows this exact composer text) and let it produce a new draft, which needs a second approval. (b) Edit on web, then return. (c) Save only, edit in the mail account later.
**Design source**: DS-06-Chat "Mail approval card" (static card only); edit-and-send screen is NO BOARD; composer text "Add Jordan on Cc" is from DS-06 composer states.

#### Steps
1. Open the Inbox agent thread at the pending card "Re: Pilot timeline — Needs approval" → card shown with "Save" and "Send".
2. Look for an edit control on the card → NO BOARD. README says edit-and-send exists (`answer: "allow"` plus `mail: {to, cc, bcc, subject, body}`) but no entry point is drawn.
3. Tap into the draft to edit (assumed entry) → an editable form appears (NO BOARD).
4. Add "Jordan Lee" in Cc (comma-separated text per the contract) → field accepts it.
5. Change "10am" to "10:30am" in the body → text updates.
6. Confirm the edit and tap "Send" → `threads/answer` with `allow` plus the changed fields; card shows "Sent".
7. Check the sent message in the Inbox → thread shows the edited body (verified on Inbox message screen).

#### Variations
- Recipient suggestions from contacts: not designed.
- Remove the only recipient: "Send" must hide, as DS-06 says for a card with no recipient.

#### Edge Cases
- Invalid email in To or Cc: no error state drawn; the server may reject.
- Keyboard covers the fields on the outer 466x678 display: sheets sit beside the strip; presentation not drawn.
- Edits abandoned by swiping down: draft discard or keep behavior is not defined.
- Unsaved edits when the app is backgrounded (the plan says saved chats redact secret asks only).

#### Design gaps
- The whole edit-and-send screen (entry point, fields, Bcc, validation) is NO BOARD. Plan says "approve and deny first, edit-and-send after", so this may ship later.
- Duo inner and half-folded layout for the editor is not drawn.
- The Expo app has no equivalent screen found in the files read, so there is no label to match.


### STORY-048: First model use asks for AI data sharing consent
**Type**: medium
**Topic**: Approvals and AI data consent
**Source**: topics/approvals-consent.md STORY-004
**Phase issue**: #417 (P5), #421 (P9)
**Persona**: Tomas Brandt, founder trying the app on a new self-hosted server
**Goal**: Send the first message to an agent and agree to share data with the model provider
**Preconditions**: New account, no recipient allowed in `aiConsent.status`; at least one bot exists
**Device**: standard iPhone
**Ideal path**: 3 — type, tap send, tap "Allow" in the prompt
**Alternate paths**: (a) Pre-grant in Settings → "AI data sharing" (STORY-094) before the first message. (b) A routine run or a mid-run `ai_consent` ask card (effect kind `ai_consent`) shows "Allow" and "Not now" inside the thread. (c) Voice first: needs consent for `voice` (STORY-052).
**Design source**: NO BOARD for the prompt. Composer states from DS-06-Chat; settings row "AI data sharing" only in PG-B-Settings. The Expo app shows a system alert titled "Share data with {name}?" with buttons "Not now", "Privacy policy", "Allow".

#### Steps
1. Open any agent thread and type "Draft a launch note" in the composer → "Send" becomes prominent (DS-06 Typing state).
2. Tap Send → the client maps `threads/send` through `aiDataUsesForProcedure` to model and memory, calls `aiConsent/status` and finds unallowed recipients.
3. A prompt appears: "Share data with {provider}?" with the recipient detail, the disclosure text, and "You can turn this off in Account → AI data sharing." (Expo copy; no iOS board).
4. Tap "Allow" → client calls `aiConsent/allow` with scope, version and the recipient key, then sends the message.
5. The message appears in the thread and the agent starts working.

#### Variations
- Two recipients (model provider and memory provider): the Expo helper prompts once per recipient, in turn, so step 3 repeats.
- Tap "Privacy policy": opens the link, then the prompt returns when the app is foregrounded again.

#### Edge Cases
- Tap "Not now": send is blocked with "Review AI data sharing in Account settings before continuing."; typed text must stay in the composer (not specified).
- Consent status call fails (server unreachable): the Expo helper wraps this as a blocked consent error; what the user sees in native is not drawn.
- An older server without `aiConsent` (404): the client should treat as not supported; not specified.
- Tapping Send twice quickly: pending prompts are coalesced per recipient in `packages/core/src/ai-consent.ts`.

#### Design gaps
- The consent prompt itself has no board (alert, sheet, or inline card?).
- No recipient icon, no layout for several recipients, no placement of the privacy link.
- Behavior of the composer text after "Not now" is not stated.


### STORY-050: Second device answers the same approval first (CONFLICT)
**Type**: short
**Topic**: Approvals and AI data consent
**Source**: topics/approvals-consent.md STORY-006
**Phase issue**: #417 (P5)
**Persona**: Hannah Cho, cofounder who has the laptop open on the web app and the phone in hand
**Goal**: Understand why her tap on "Allow once" did nothing
**Preconditions**: A pending tool ask; cofounder (same user) allowed it on web seconds ago; phone has not yet refreshed
**Device**: standard iPhone
**Ideal path**: 2 — tap, read the message, card updates itself
**Alternate paths**: none found
**Design source**: DS-06-Chat "Ask card" (error: failed submit shows a native alert and re-enables); CONFLICT behavior has NO BOARD.

#### Steps
1. Tap "Allow once" on a card the phone still shows as pending → request sent with `threads/answer`.
2. Server returns CONFLICT → the Expo alert would read "Could not submit answer" with error text; the card should refresh to "Allowed once".

#### Variations
- Another bot or group member answered through a different thread target: same result.

#### Edge Cases
- Buttons re-enable after the alert (DS-06), so a user could tap again and see the same alert; the plan does not say to refetch.
- If the SSE stream already delivered the resolved state, the buttons are gone before the tap.

#### Design gaps
- CONFLICT has no designed message; a refetch of the thread after CONFLICT is not specified in the plan.


### STORY-051: Provide a login secret the agent needs
**Type**: medium
**Topic**: Approvals and AI data consent
**Source**: topics/approvals-consent.md STORY-007
**Phase issue**: #417 (P5)
**Persona**: Kofi Mensah, founder letting the Team Computer agent log in to a vendor portal
**Goal**: Give the agent a username and password without the app storing it
**Preconditions**: Agent thread with an `ask` block `input: "secret"` and a login credential (username and password), destination known
**Device**: iPhone Duo inner display flat
**Ideal path**: 4 — fill username, fill password, tap "Save", see "Saved"
**Alternate paths**: (a) Skip or ignore the ask and tell the agent in text (the secret then travels as a normal message, which the app does not prevent). (b) Answer from web.
**Design source**: NO BOARD for the secret ask. DS-06 has an "Ask card" (question 15pt/600, waiting line 13pt) that is the nearest style. Expo: secure text field, button "Save", destination label from `secretDestinationLabel`.

#### Steps
1. Open the thread, see an ask card naming the destination → the card shows a username field and a secure password field (Expo behavior).
2. Type the username → field accepts, auto-capitalization off.
3. Type the password → dots shown, autocorrect off.
4. Tap "Save" → fields clear at once, `threads/answer` sends `answer` plus `username`.
5. Card shows "Saved" and the agent continues.

#### Variations
- A non-login secret (an API key): one field only; Save enabled when non-empty.

#### Edge Cases
- Send fails: Expo shows "Could not send answer" without the error detail; the field was already cleared, so the user must retype.
- App is killed during the ask: saved chats redact secret asks; the value must never be written to the snapshot, log, or outbox.
- Screenshots and app switcher preview of the card: not addressed.

#### Design gaps
- No board for the secret card, its destination line, the "Saved" state, or error state.
- Keychain and AutoFill interplay is unspecified.
- Retry after failure loses the typed value.


### STORY-052: Voice call blocked until voice consent is granted
**Type**: medium
**Topic**: Approvals and AI data consent
**Source**: topics/approvals-consent.md STORY-008
**Phase issue**: #417 (P5), #423 (P11)
**Persona**: Selin Arslan, founder who dictates replies while walking
**Goal**: Start a call with the agent and share recordings with the transcription provider
**Preconditions**: Voice provider configured, voice not yet allowed
**Device**: standard iPhone
**Ideal path**: 3 — tap call, tap "Allow", call starts
**Alternate paths**: (a) Grant in Settings → "AI data sharing" first (STORY-094). (b) "Not now" and use text only.
**Design source**: NO BOARD for the prompt or the call screen (DS-07 lists "Calls", no PG page). Settings root row "AI data sharing" on PG-B-Settings.

#### Steps
1. Open a thread and start a call (control from the thread header; the call entry has no PG page) → client maps `voice/prepare` to the `voice` use and checks consent.
2. The prompt "Share data with {voice provider}?" appears with the disclosure "Your recordings are sent for transcription, and text you play is sent to generate speech." → user reads.
3. Tap "Allow" → `aiConsent/allow`, then the call begins.

#### Variations
- "Not now": call does not start; message "Review AI data sharing in Account settings before continuing."

#### Edge Cases
- Memory consent also missing: a second prompt for the memory recipient after the first (threads/send maps to model and memory).
- Dictation permission denied: Expo shows "Calls need transcription" with "Not now" and "Open Voice" — a different gate from consent.

#### Design gaps
- Call screen has no PG page; consent prompt in the middle of a call start has no board.


### STORY-053: Approve a new MCP server from the thread
**Type**: short
**Topic**: Approvals and AI data consent
**Source**: topics/approvals-consent.md STORY-009
**Phase issue**: #417 (P5)
**Persona**: Diego Salazar, founder adding a spreadsheet tool server to his agent
**Goal**: Connect the MCP server an agent asked for
**Preconditions**: Thread contains an `mcp_approval` block, status pending, no OAuth needed
**Device**: standard iPhone
**Ideal path**: 2 — read card, tap "Approve"
**Alternate paths**: (a) Tap "Dismiss" and reconnect later from MCP settings. (b) If OAuth is needed, only a web hand-off exists (README: "MCP OAuth is web-only").
**Design source**: DS-06-Chat has the "MCP tool approval" card (a tool call approval, not a server connect) and a letter tile style; the server-connect card is NO BOARD. Expo card: "Connect MCP server {name}", "Approve", "Dismiss".

#### Steps
1. Scroll to the card "Connect MCP server Sheets" with the endpoint or "stdio · {transport}" → card shows "Approve this server to let your agent use its tools."
2. Tap "Approve" → `mcp/assignments/approve`; text "Connected. Its tools are available from your next message."

#### Variations
- OAuth server: Approve hidden, text "Finish MCP authorization in the web app."; no iOS route to open it.
- Dismiss: "Dismissed. Reconnect anytime from MCP settings." Native MCP settings screen is not planned.

#### Edge Cases
- Approve fails: alert "Could not approve this server".
- The block shows the status from the server on reload even if local state said pending.

#### Design gaps
- The server-connect card is NO BOARD, and the DS-06 MCP card is a different thing with a similar name.
- No iOS page for "MCP settings" is planned, so "Reconnect anytime from MCP settings" has no destination.


### STORY-054: Answer a choice card, then turn on connector writes
**Type**: long
**Topic**: Approvals and AI data consent
**Source**: topics/approvals-consent.md STORY-010
**Phase issue**: #417 (P5), #421 (P9)
**Persona**: Aisha Karimi, founder of a 9-person SaaS company, first time using the Mercury agent
**Goal**: Pick a meeting length for a calendar action, then enable money writes and approve one payment request
**Preconditions**: Calendar agent in a group thread with a pending `choice`; Mercury connected with writes off (default); integrations list available
**Device**: iPhone Duo half-folded 1/2 + 1/2 (thread in right half)
**Ideal path**: 14 — answer choice, find the writes switch, turn it on, ask for a payment, approve once
**Alternate paths**: (a) Turn writes on from the web app (`connections.setWrites`). (b) Answer the choice by typing in the composer. (c) Use "Always allow" for the payment tool at step 13 instead of "Allow once".
**Design source**: DS-06-Chat "Choice card" ("Pick a meeting length", "30 minutes", "60 minutes", "Continue") and "Ask card" ("Which calendar should I use?", "Personal calendar", "Skip"); PG-B-Integrations for the connector page (rule card not re-read in detail); the writes switch is NO BOARD; tool approval is DS-06 "MCP tool approval".

#### Steps
1. In the half-folded layout open the group thread on the right half → the Choice card "Pick a meeting length" shows "30 minutes — Fits Ana's open slot" and "60 minutes — Needs a longer slot".
2. Tap "30 minutes" → the row selects.
3. Tap "Continue" → `threads/answer`; the card collapses to a resolved line.
4. The agent asks "Which calendar should I use?" with "Personal calendar" and "Skip" → ask card.
5. Tap "Personal calendar" → answer sent; agent books the slot.
6. Type "Pay the Northwind pilot invoice" and tap Send → agent replies it cannot write because writes are off (message wording not defined).
7. Open Settings → Integrations → Mercury → connector page → the page shows the connection (PG-B-Integrations).
8. Look for the writes switch → NO BOARD; assume a switch calling `connections.setWrites`.
9. Turn writes on → switch reads on; footer wording not defined.
10. Return to the thread and repeat the request → agent works.
11. The card "Mercury agent wants to run requestSendMoney" appears with Amount, Recipient, Memo → card is the same as in STORY-045.
12. Read the amount row (tabular figures) and recipient → verified.
13. Tap "Allow once" → resolved line "Allowed once: requestSendMoney".
14. Confirm in the Finance page or chat finance card that the request was created → NO BOARD for the result of a write inside Finance.

#### Variations
- "Skip" on the ask card: agent proceeds without a calendar.
- Writes off on a deployment-level switch: control is disabled with no drawn explanation.

#### Edge Cases
- Half-folded 1/2 + 1/2 keeps nothing important at x 435-455 (PG-A-Rules): the card must not straddle the fold.
- Writes toggled while a run is waiting for approval: behavior not specified.
- Even with writes on, each write still asks (README), so turning on writes does not remove step 13.

#### Design gaps
- The writes switch and its warning copy have no board; `connections.setWrites` and `mcp.servers.setWrites` have API but no iOS screen.
- No message designed for "writes are off" in the thread.
- Choice card multi-select vs single-select, and keyboard handling for free-text answers, are not drawn.


### STORY-055: Review what "Always allow" has already granted
**Type**: short
**Topic**: Approvals and AI data consent
**Source**: topics/approvals-consent.md STORY-011
**Phase issue**: #421 (P9) (no phase covers it yet)
**Persona**: Ravi Deshmukh, founder who tapped "Always allow" last week and wants to undo it
**Goal**: See and remove the standing rule for the payment tool
**Preconditions**: A rule exists (`approvalRules.list` has `always_allow` for tool requestSendMoney)
**Device**: standard iPhone
**Ideal path**: 3 — find the rules list, open the rule, remove it (if screen exists)
**Alternate paths**: Use the web app (the only place today); or ask the agent in chat (no known tool).
**Design source**: NO BOARD. The Settings root (PG-B-Settings) has no row for approval rules or auto review.

#### Steps
1. Open Settings → the root list shows Account, Models, Voice, Device, Integrations, "AI data sharing", "Archived bots", "Change password" and no approval rules entry.
2. Look inside Integrations → connector page; no approval section drawn.
3. Fall back to the web app → rule removed with `approvalRules.remove`.

#### Variations
- Turn auto review on or off (`autoReview.set`): no iOS screen.

#### Edge Cases
- A later "Allow once" on the same tool still appears if the rule was removed.

#### Design gaps
- Approval rules and auto review are in the API (`approvalRules.list/set/remove`, `autoReview.get/set`) and the README, but no board or plan phase shows them on iOS. A user who taps "Always allow" has no way to undo it on the phone.



## Topic: Topic: Inbox triage and compose

Source file: `docs/ios-native/ux/topics/inbox.md`

### STORY-056: Morning triage with pull to refresh and swipe to archive
**Type**: short
**Topic**: Inbox triage and compose
**Source**: topics/inbox.md STORY-001
**Phase issue**: #418 (P6)
**Persona**: Maya Okafor, solo founder of a 4-person logistics startup
**Goal**: Clear newsletters from the Inbox in one minute before standup.
**Preconditions**: One Gmail account connected. Inbox shows 3 "Needs reply" rows and a list of newer mail. Mail writes are on.
**Device**: standard iPhone
**Ideal path**: 3 — pull to refresh, swipe left on a row, release past the threshold (full swipe commits Archive).
**Alternate paths**: Long-press the row and choose "Archive" from the context menu (DS-05 says every swipe action has a long-press menu item). Open the message and tap Archive in its toolbar. VoiceOver custom action "Archive". In Expo today the only per-row action is the row menu (Archive, Spam, Trash) and the "Archive all" bulk button in the Newsletters digest.
**Design source**: Inbox list on a standard iPhone: NO BOARD (rule card in `PG-A-Rules.dc.html` "Inbox" gives only the outer layout). Row and swipe: `DS-05-Lists.dc.html` "Mail row" and "Swipe actions". Section header: `DS-05-Lists.dc.html` "Section headers".

#### Steps
1. Open the app and tap the Inbox row on Home → Inbox opens with a 28 pt title "Inbox" and sections "Needs reply" (count 3), then the date sections. The list shows placeholder rows while loading, then mail from the cache.
2. Pull the list down → the list calls `inbox.refresh` (with `waitMs`) and then `inbox.list`; new mail appears at the top with a filled unread dot and semibold sender.
3. Swipe the row "Example Weekly / Five tools worth trying" left, past the threshold → "Archive" fills the row and commits (`inbox.archive`); the row leaves the list.

#### Variations
- Swipe left only part way: three buttons appear in this order from the outside: "Archive", "Star", "Mute". Tap "Star" or "Mute" instead (see Design gaps).
- Swipe right on an unread row: "Mark read" (calls `inbox.markRead`). On a read row it reads "Mark unread".
- Several accounts connected: Expo shows an "Account" picker with "All"; the boards do not show one.

#### Edge Cases
- Archive fails ("Changing mail is turned off." or a reconnect error): the row must return and the error must be visible. Expo shows an alert "Could not archive {count}". The board has no error state for a swipe.
- The user archives by mistake: `inbox.unarchive` and `inbox.actions.undo` exist, but no Undo control is drawn for a single swipe.
- Offline pull to refresh: the list keeps the cached rows; the board shows "Could not load mail." with retry only for a first load.

#### Design gaps
- No standard iPhone Inbox board.
- "Star" has no write procedure in `rpc.ts` (`InboxFilter` has `starred` as a read filter only). "Mute" could map to `inbox.feedback` with mark `noise`, but the plan does not say so. Both appear on the swipe specimen.
- No Undo toast after Archive, though the API supports undo.
- Section names differ: board "Other mail today" (Sheet, Inner) versus plan and Expo "Today" and "Earlier". The "Earlier" header is drawn in DS-05 only.
- Expo row menu offers Spam and Trash; the swipe specimen and the row menu text on the board list only Archive, Star, Mute, Mark read.


### STORY-057: Read a message with attachments and ask the Inbox agent
**Type**: medium
**Topic**: Inbox triage and compose
**Source**: topics/inbox.md STORY-002
**Phase issue**: #418 (P6)
**Persona**: Tomas Brandt, operations lead at a 12-person fintech
**Goal**: Read Ana's request to move the kickoff, check the attached timeline, and have the agent propose a reply.
**Preconditions**: Gmail connected. "Re: Pilot timeline" from Ana Ruiz is in "Needs reply". The Inbox agent exists (or will be created on first use). A model is connected.
**Device**: standard iPhone
**Ideal path**: 2 — tap the row, tap "Ask Inbox agent".
**Alternate paths**: From the Inbox list, tap the prominent "Ask Inbox agent" button (opens the general Inbox agent, no message context; `inbox.agent`). From Home, open "Inbox agent" in Personnel. Expo labels the same message action "Ask agent" and the general one "Inbox agent".
**Design source**: `PG-A-InboxMessage.dc.html` (message screen) and the "Inbox message" rule card in `PG-A-Rules.dc.html`. Attachment row: `DS-05-Lists.dc.html`. Agent thread: `PG-A-Thread.dc.html` ("Inbox agent is working"). Attachment preview screen: NO BOARD.

#### Steps
1. In Inbox, tap the "Re: Pilot timeline" row from Ana Ruiz → the message opens (push). The title area shows a back button "Back"; the toolbar shows "Archive", "Reply" and the prominent "Ask Inbox agent". A spinner shows in the body while `inbox.get` loads. Opening marks the thread read.
2. Read the 22 pt subject "Re: Pilot timeline", the sender line "Ana Ruiz to me Oct 19, 10:30 AM", and the 15 pt body → the body renders in a no-network web view (scripts off, remote images only through the signed proxy).
3. Tap the attachment row "pilot-timeline.pdf 212 KB" → a preview opens (Expo: `inbox-attachment`; "Share" button; "No preview for this file type." for unknown types).
4. Close the preview and tap "kickoff-agenda.md 4 KB" → preview opens in the same way.
5. Tap "Ask Inbox agent" → `inbox.askAgent` for this message runs (idempotent per mail conversation) and the Inbox agent thread opens with the conversation as context.
6. Type "Draft a reply that accepts Thursday morning" in the composer and send → the thread shows the working indicator "Inbox agent is working" with a stop control; the agent answers and may show a mail approval card (covered in the Approvals topic).

#### Variations
- Attachment over the size limit: the row shows the size and a disabled state (rule card).
- Sent mail (the user's own message in a thread): a "Sent" check shows beside the date.
- Plain-text mail: no web view, plain 15 pt text.

#### Edge Cases
- `inbox.get` fails: centered "Could not load mail." (rule card). The card does not say whether a retry control exists on this screen; the list screen has one.
- `askAgent` fails, or no model is connected: Expo shows an alert with the error text. The board has no state for it.
- Message belongs to a thread with earlier messages: `InboxMessageSchema` carries `thread` and `later` arrays, but the board shows one message only.
- Tapping a link in the body: Expo opens `expo-web-browser`. The planned equivalent is not specified (Safari view or system browser).

#### Design gaps
- Attachment preview screen has no board (PDFKit and Quick Look are named in the plan).
- Thread of several messages in one conversation has no layout.
- Unsubscribe from the message screen is not drawn, although `inbox.unsubscribe` exists.
- Label mismatch: board "Ask Inbox agent" versus Expo "Ask agent" (message) and "Inbox agent" (list).
- Sender avatar is listed in the rule card ("Domain (sender avatar)") and drawn as initials "AR" on the board, but the plan says nothing about where avatars come from.


### STORY-058: Reply to a customer and send
**Type**: medium
**Topic**: Inbox triage and compose
**Source**: topics/inbox.md STORY-003
**Phase issue**: #418 (P6)
**Persona**: Priya Raman, founder of a developer-tools startup
**Goal**: Accept Ana's proposed Thursday kickoff by replying from her phone.
**Preconditions**: Gmail connected, mail writes on. "Re: Pilot timeline" is open.
**Device**: standard iPhone
**Ideal path**: 4 — tap "Reply", type the reply, tap Send; the sheet closes.
**Alternate paths**: Ask the Inbox agent to draft and send; approve the card "view draft", "Send" (Approvals topic). Reply-all and Forward are modes of the same screen (`ComposeMode`: reply, replyAll, forward), but the entry point for Reply all is not drawn.
**Design source**: Reply button: `PG-A-InboxMessage.dc.html`. Compose sheet, From line, Send, Discard: NO BOARD. Keyboard and sheet patterns: `DS-04-Overlays.dc.html` (sheets).

#### Steps
1. On the message, tap "Reply" → a compose sheet opens. The app calls `inbox.compose.prefill` with mode `reply` and the device time zone and locale; To is Ana Ruiz, Subject is "Re: Pilot timeline", and the body holds the quote. A `clientId` is generated for idempotency.
2. Type "Thursday morning works. See you then." above the quote → text appears; the draft is held on the device.
3. Tap Send → `inbox.compose.send` runs and the sheet shows a progress state.
4. The result is `sent` → the sheet closes and the original message shows a confirmation (not designed).

#### Variations
- Tap "Cancel" with typed text: ask to keep a draft (`draftSave` returns `saved`) or discard (`discard`).
- Add Cc or Bcc: the fields exist in `ComposeFields`; how they appear is not drawn.
- Add an attachment: up to 20 files, 10 MB together (base64 inside the request).

#### Edge Cases
- Result `unknown`: the send may have gone out and must never be retried automatically. The user is told to check Sent. The copy and the screen are not designed.
- Result `failed` with reason `rejected` or `rate_limited`: nothing was sent; retry is safe.
- Result `reconnect`: the Gmail account lacks permission to send; the user needs a "Reconnect" path.
- Result `disabled`: the deployment has mail writes off; Reply should not be offered, or should explain.
- `quoteUnavailable` is true: To and Subject come from the cache and the quote is empty.
- App is backgrounded during Send, or the connection drops: no outbox for mail is described (threads have one; mail compose does not).
- Double tap on Send: the same `clientId` makes the second call idempotent.

#### Design gaps
- Compose sheet has no board: fields, From account picker, Cc/Bcc reveal, attachment picker, formatting (the API takes `html`), sending state, error banner.
- Outcome copy for `saved`, `sent`, `unknown`, `reconnect`, `disabled`, `failed` is not defined.
- Whether the sheet is medium or large, and how it behaves on the outer display, is not stated.
- Reply is an "ordinary glass button" per the rule card, but the glass toolbar group on a standard iPhone has no board.
- Reply-all has no control.


### STORY-059: Forward a message with its attachments
**Type**: medium
**Topic**: Inbox triage and compose
**Source**: topics/inbox.md STORY-004
**Phase issue**: #418 (P6)
**Persona**: Jonas Weber, head of sales at a seed-stage SaaS company
**Goal**: Forward the pilot timeline and agenda to a teammate.
**Preconditions**: "Re: Pilot timeline" open, two attachments (212 KB and 4 KB). A second Gmail account is connected.
**Device**: standard iPhone
**Ideal path**: 6 — find forward, choose forward, enter a recipient, check attachments, send (the entry point is not drawn, so the count is a best estimate).
**Alternate paths**: Ask the Inbox agent to forward it (agent tools). Long-press the row in the list (menu content not drawn for forward).
**Design source**: Forward entry point: NO BOARD. Compose sheet: NO BOARD. Attachment rows: `DS-05-Lists.dc.html`.

#### Steps
1. On the open message, look for a way to forward → the toolbar shows only "Archive" and "Reply" on the board. Open the Reply control's menu if one exists (undefined).
2. Choose Forward → `inbox.compose.prefill` with mode `forward`; the sheet opens with Subject "Fwd: Re: Pilot timeline", the forwarded header in the body, and the two original files listed as attachments to be re-attached on the server (`forwardOf`).
3. Type a recipient in To (for example `sam@example.com`) → the field accepts a comma-separated list. Contact suggestions are not described.
4. Check the From line, which shows the account the original arrived on → switch it with the picker if needed.
5. Tap Send → `inbox.compose.send` with `forwardOf.attachmentIds`; files are attached by the server and do not travel from the phone.
6. Result `sent` → sheet closes.

#### Variations
- Remove one attachment before sending (the list is editable in the API through `attachmentIds`).
- A forward of an HTML mail: `quotedHtml` is returned for display under the forwarded header.

#### Edge Cases
- `attachmentsTooLarge` is true: the sheet should name the files in `attachmentsLeftOut` and send without them.
- Forward from a message whose body cannot be read from Gmail: `quoteUnavailable`.
- Recipient field empty: Send must stay disabled.
- Two accounts: the From account must default to the original's account, and the app must not send from the wrong one.

#### Design gaps
- No Forward control on the message board.
- No compose screen, no attachment list, no From picker.
- No recipient autocomplete; `contacts.list` exists but is not tied to mail.
- No copy for "files left out".


### STORY-060: Find a message by search and filter on the outer display
**Type**: medium
**Topic**: Inbox triage and compose
**Source**: topics/inbox.md STORY-005
**Phase issue**: #418 (P6), #419 (P7)
**Persona**: Dana Kowalski, founder who uses an iPhone Duo folded shut
**Goal**: Find every unread message from Northwind and archive them.
**Preconditions**: Gmail connected, about 200 messages cached, mail writes on.
**Device**: iPhone Duo outer (466x678 pt)
**Ideal path**: 5 — "Search mail", type, open "Filter", pick an option, swipe or archive.
**Alternate paths**: Global Search (`DS-04-Overlays`, "Search across agents, mail and artifacts from anywhere") returns "Mail" results with a message jump, but `search.query` is not planned for this phase. Ask the Inbox agent "find unread mail from Northwind".
**Design source**: `Sheet.dc.html` (side strip: Back, "Search mail", "Filter", "Compose", prominent "Ask Inbox agent"). Filter content: `DS-04-Overlays.dc.html`. Search results state: `DS-05-Lists.dc.html` "Results 3". No-results text: `DS-04-Overlays.dc.html` ("No results for pilotx", "Try a sender, agent or file name.").

#### Steps
1. From Home, tap the Inbox row → Inbox opens in the 2/3 content column starting at x=72 with the 28 pt title "Inbox". The side strip has "Back", then the group "Search mail", "Filter", "Compose", and the prominent "Ask Inbox agent".
2. Tap "Search mail" → a glass search field appears right of the strip and the keyboard rises from the bottom.
3. Type "Northwind" → results show as rows under a "Results 3" header (a Gmail-syntax `query`, read live, up to 50 per account).
4. Tap "Filter" → a medium-detent sheet opens (on the inner display this is a popover) with "Sort by": "Newest first", "Oldest first", "Unread first"; "Show": "Needs reply", "Newsletters", "Read mail"; and "Select messages".
5. Pick "Unread first" → the list reorders; results stay the same.
6. Swipe the top result left past the threshold → Archive commits.

#### Variations
- Clear the search with Cancel → the normal sections return.
- Type a query with no matches → "No results for pilotx" and "Try a sender, agent or file name."
- Scroll to the end of a filtered or searched list with `nextPageToken` → the next page loads. No "loading more" row is drawn.
- Choose "Select messages" → the list enters a selection mode (an "empty list" specimen exists, but the mode itself is not drawn).

#### Edge Cases
- Searching while Gmail is unreachable or rate limited (`rateLimitedAccounts`): no state is drawn.
- Keyboard covering results on a short height (466x420): the strip collapses into "More"; the prominent button collapses last.
- Search text includes Gmail operators (`from:`, `is:unread`): the API passes them through; the field gives no hint, which is fine.

#### Design gaps
- "Filter" popover items ("Show in inbox": "Needs reply", "Newsletters", "Read mail") do not match the Expo categories (All, Important, Updates, Newsletters, Spam {count}, and the Senders/Digest switch under Newsletters). "Read mail" has no matching `InboxFilter` value.
- DS-04 says the Filter sheet is "Opened from More at the bottom of the side strip", but `Sheet.dc.html` puts "Filter" in the strip. These contradict each other.
- `Split.dc.html` has a star-shaped "Important only" button next to Filter. It is not in the rule card or in `Sheet.dc.html`.
- "Select messages" mode, bulk Archive, and its confirmation have no board.
- Search result rows for the user's own sent mail (`fromSelf`) have no distinct treatment.


### STORY-061: Check off a to-do from the Inbox
**Type**: short
**Topic**: Inbox triage and compose
**Source**: topics/inbox.md STORY-006
**Phase issue**: #418 (P6)
**Persona**: Lena Fischer, founder of a design agency
**Goal**: Mark "Send Ana the revised budget" done after replying.
**Preconditions**: The triage model has extracted at least one to-do from mail. Triage is enabled (a model is connected and the recipient is allowed).
**Device**: standard iPhone
**Ideal path**: 2 — open Inbox, tap the checkbox.
**Alternate paths**: Open the to-do's message (the row links to its message when `messageId` is not null). Ask the Inbox agent to mark it done (no such agent tool is documented).
**Design source**: To do card: `DS-05-Lists.dc.html` ("To do card"). Inbox screen on a standard iPhone: NO BOARD.

#### Steps
1. Open Inbox → a "To do" card sits on top of the list (card radius 14, title "To do"). Rows show the text, "sender · detail" and a due label on the right.
2. Tap the 22 pt circle checkbox (44 pt target) on "Send Ana the revised budget" → the circle fills, the row is saved with `inbox.todos.setDone` (done: true), and the row leaves the card.

#### Variations
- Last to-do done: the card disappears (rule: "Do hide the card when there is nothing to do").
- Tap the to-do text: opens the source message.

#### Edge Cases
- `messageId` is null because the message left the 14-day cache: the row cannot open anything. No state is drawn.
- `setDone` fails: the checkbox must revert. Expo's equivalent shows an alert.
- Triage blocked (`no_model` or `needs_consent`): no card appears and nothing says why. The API returns `triageBlocked`; Expo hides triage UI.

#### Design gaps
- No undo for a completed to-do.
- No explanation or "turn on" path when triage is blocked (consent prompt has no board).
- The to-do due label ("Today" style) has a formatting rule only in Expo (`apps/mobile/lib/mail-inbox.ts`).
- Whether a done to-do can be seen again (history) is undefined.


### STORY-062: Bulk cleanup and unsubscribe from noisy senders
**Type**: long
**Topic**: Inbox triage and compose
**Source**: topics/inbox.md STORY-007
**Phase issue**: #418 (P6)
**Persona**: Ravi Menon, founder with 6,000 unread messages after two years of use
**Goal**: Unsubscribe from five newsletter senders, archive their old mail and mark one as spam, then undo one choice.
**Preconditions**: Gmail connected, mail writes on, triage enabled. Cleanup list is populated by the server.
**Device**: standard iPhone
**Ideal path**: 18 — open Cleanup, then per sender select an action, confirm, review the history, undo.
**Alternate paths**: In Expo, the Newsletters filter has a "Senders" / "Digest" switch with "Archive all". The row menu offers "Archive", "Spam", "Trash" per message. Ask the Inbox agent to "archive newsletters older than a week" (DS-05 shows this as an Inbox agent preview).
**Design source**: NO BOARD for the Cleanup screen, its action bar, its confirmations or its history. Entry point: NO BOARD (Expo puts "Cleanup" in the "More" menu of `inbox.tsx`; the boards have no "More" menu in the Inbox strip).

#### Steps
1. Open Inbox, then the "More" menu → Expo shows "Cleanup" with a checklist icon. The boards have no matching control (see gaps).
2. Tap "Cleanup" → the cleanup screen loads (`inbox.cleanup.list`) with a spinner, then a list of senders. Each row shows the sender name and "{count} messages · {percent}% read". Some rows show "Looks like spam".
3. Tap the first sender "Example Weekly" → the row is selected (checkbox).
4. Select four more senders → the selection count updates.
5. Open the action menu → options are "Archive", "Skip inbox", "Unsubscribe", "Spam", "Not spam", "Trash" (Expo labels).
6. Choose "Unsubscribe 5" → a confirmation alert lists the label and offers "Cancel" and the action.
7. Confirm → `inbox.unsubscribe` runs per sender and returns one of: `done`, `opened` (open a link), `sent`, `unknown`, `refused`, `disabled`, `unavailable`.
8. For a sender that returns `opened` → the row shows "Open link"; tap it to open the page in a browser; return to the app.
9. For a sender whose unsubscribe is by mail → an alert "Send an unsubscribe email to {address}?" with "Cancel" and "Send"; tap "Send".
10. For a sender that returns `refused` or `unavailable` → the row shows "Could not update {name}" and, where possible, "Open link".
11. Select two other senders and choose "Archive 2" → a confirmation, then `inbox.cleanup.archive`; the senders leave the list.
12. Select "Deals Daily" ("Looks like spam") and choose "Spam 1" → confirmation, then `inbox.moveMany` with `op: spam`; `batchId` is returned.
13. Scroll to "History" → rows list the past actions (`inbox.actions.list`).
14. Tap the "Spam" history row → an alert with "Cancel" and "Undo".
15. Tap "Undo" → `inbox.actions.undo` returns `restored` and `failed` counts; the sender returns to the Inbox.
16. Tap "Forget" on a sender with "Learned Newsletters" → `inbox.cleanup.forget` clears the learned pile.
17. See a sender with "Skipping" and a "Stop" link → tap "Stop" to stop skipping the Inbox.
18. Go back to Inbox → the list reflects the changes after the next `inbox.list`.

#### Variations
- A sender marked with "Gmail filter limit reached" or "Couldn't add Gmail filter": the row shows the message and the action is not applied for future mail.
- "Nothing to clean up" when the list is empty.
- "Retry" after "Could not load senders".

#### Edge Cases
- `unknown` result on an unsubscribe email: never retried automatically; the row must not say "Done".
- Partial failure of a bulk action (`failed` list): only the failed senders stay selected with an error.
- More than 50 messages in one move (`MAX_BULK_ARCHIVE`): the client must batch.
- Account needs reconnect: bulk actions fail with `reconnect`.
- Mail writes off: every action returns `disabled` ("Changing mail is turned off.").

#### Design gaps
- The whole Cleanup flow has no board (the discovery doc already flagged this).
- No planned entry point from the Inbox on the outer display. The strip has "Search mail", "Filter", "Compose" and "Ask Inbox agent"; no "More".
- "Skip inbox", "Not spam", "Trash", "Learned" and "Forget" have no explanation in the design and no named iOS control (action sheet versus menu).
- The history and Undo flow is only an alert in Expo; the planned native pattern is not defined.
- Whether Cleanup is inside the phase 6 scope (#418 "implied") should be confirmed.


### STORY-063: Mail writes are turned off, or the Gmail account needs reconnecting
**Type**: medium
**Topic**: Inbox triage and compose
**Source**: topics/inbox.md STORY-008
**Phase issue**: #418 (P6)
**Persona**: Hannah Berg, operations manager at a company whose admin disabled mail writes
**Goal**: Try to archive and reply, understand why it fails, and still read mail.
**Preconditions**: The deployment has mail writes off (a self-hosted server). One account in `reconnectAccounts` after Google asked for a new permission.
**Device**: standard iPhone
**Ideal path**: 3 — try Archive, read the error, leave. (For reconnect, the path depends on an undesigned control.)
**Alternate paths**: Integrations (`PG-B-Integrations.dc.html`, "Continue in setup") to reconnect Gmail. The Expo app surfaces `reconnectAccounts` only through the alert text.
**Design source**: NO BOARD for writes-off or reconnect states in the Inbox. Error line "Could not load mail." only: `PG-A-Rules.dc.html` "Inbox". Integrations screen: `PG-B-Integrations.dc.html`.

#### Steps
1. Open Inbox → mail loads normally (reads work) and the list shows rows.
2. Swipe left on a row past the threshold → Archive is attempted; the server answers "Changing mail is turned off." The row returns.
3. Open a message and tap "Reply" → the compose sheet opens and the prefill works, or the control is hidden. The client does not know the setting until a write fails (`compose` returns `disabled` on send).
4. Tap Send → result `disabled`: a message says that mail changes are off, and the typed text is kept.

#### Variations
- Reconnect case: sync returns the account in `reconnectAccounts`; the list shows older mail and needs a "Reconnect" banner with a path to Integrations.
- `failedAccounts` but not reconnect: a sync problem with a retry; `rateLimitedAccounts` means wait.
- No account connected (`accounts` empty): Expo shows "Connect mail" and "No mail".

#### Edge Cases
- A bulk action where some succeed and some fail with `reconnect`.
- Self-hosted older server returns 404 for `inbox.actions.list` or `moveMany`: the client treats it as not supported and hides the feature.
- Mail writes off while a draft exists: the draft is kept on the device.

#### Design gaps
- No banner or inline state for writes off, reconnect, rate limited, or "No mail account connected" (the board's empty state is "Inbox zero" and covers only a synced, empty Inbox).
- The client cannot learn "writes off" before the first failed write; whether a capability flag exists is not stated.
- "Inbox zero" with the last sync time versus never synced (`syncedAt` null) is not distinguished.


### STORY-064: A full triage session on the inner display, from list to reply and back
**Type**: long
**Topic**: Inbox triage and compose
**Source**: topics/inbox.md STORY-009
**Phase issue**: #418 (P6), #419 (P7)
**Persona**: Kenji Watanabe, founder who works mostly on an iPhone Duo opened as a book
**Goal**: Work through Needs reply, archive noise, reply to two messages, delegate one to the agent, and finish at Inbox zero.
**Preconditions**: Gmail connected, mail writes on, triage on. 3 "Needs reply" rows and 24 other messages today.
**Device**: inner flat (890x626 pt, 1/3 sidebar + 2/3 detail, side bar on the right edge)
**Ideal path**: 24 — one tap per list selection plus one tap per action; the steps below are the full session, not a shortcut.
**Alternate paths**: Half-folded 1/2 + 1/2 with the same content. Keyboard shortcuts are not planned. The Inbox agent thread can occupy the detail pane beside the list ("Left: list. Right: selected message or Inbox agent thread").
**Design source**: `Inner.dc.html` (inbox beside the Inbox agent thread), `Split.dc.html` (side strip: "Hide amounts", "Important only", "Filter", "Compose", "Ask Inbox agent"), rule cards "Inbox" and "Inbox message" in `PG-A-Rules.dc.html`. Reply composer in the detail pane: NO BOARD.

#### Steps
1. Open the app on the inner display → Home shows Personnel with the Inbox row pinned in the third and Activity plus the last thread on the right.
2. Tap the Inbox row ("Inbox", count 42) → the third shows folders and sections, and the detail shows the message list (rule card). Which folders exist is not stated.
3. Tap the first row "Ana Ruiz, Re: Pilot timeline" → the list becomes the sidebar and the message opens in the detail pane; the row shows the selected fill.
4. Read the body → it renders in the web view in the detail pane; the fold zone x 435 to 455 stays empty.
5. Tap "Reply" → a composer opens under the message (half-folded) or as a sheet in the detail pane (flat), prefilled.
6. Type the reply and tap Send → result `sent`; the pane returns to the message.
7. Tap "Archive" in the strip → the message archives and the next row is selected (the rule is not stated; the list keeps the order).
8. Tap the second row "Jordan Lee, Intro: design partner" → the message opens.
9. Tap "Ask Inbox agent" → the detail pane switches to the Inbox agent thread with this conversation as context (`inbox.askAgent`).
10. Send "Reply yes and suggest Tuesday" → the thread shows "Inbox agent is working" with the stop control; the agent returns a draft with an approval card.
11. Tap "view draft", then "Send" on the card → the mail sends (Approvals topic); the card shows outcome `sent`.
12. Tap the list's third row "Northwind Support, Your ticket was updated" → the message opens.
13. Tap "Archive" → archived; "Needs reply" count goes from 3 to 0 and the header hides or shows 0.
14. Tap "Filter" in the strip → a popover opens under the Filter button in the trailing pane, no scrim ("Show in inbox": "Needs reply", "Newsletters", "Read mail").
15. Turn off "Read mail" → read mail leaves the list.
16. Tap "Important only" → only important rows remain (what this setting does is not specified).
17. Tap "Acme Payroll, Payment could not be scheduled" (label "Needs attention") → the message opens in the detail pane.
18. Read it and tap "Ask Inbox agent" → the agent thread opens.
19. Tap "Compose" → a new blank compose opens (new mail, no `replyToMessageId`).
20. Type a recipient, subject and body for the payroll provider → fields hold the text.
21. Tap Send → `sent`.
22. Swipe the remaining newsletters left past the threshold, one after another → each commits Archive. Three rows go.
23. Pull to refresh → `inbox.refresh`; no new mail.
24. The list is empty → the page shows "Inbox zero" with the last sync time.

#### Variations
- Half-folded (1/2 + 1/2): left list, right message; Reply opens the composer under the message.
- Posture change mid-compose (unfold, fold): the typed text and selected message must survive.
- Hide a pane: the list can collapse the sidebar to a single column (not stated).

#### Edge Cases
- Archive of the open message when it is the last row: the detail pane must show an empty state. Not drawn.
- The message arrives for the open thread during reading (`later` array): no live update is described.
- Inbox agent thread already shown in the detail pane and a message selected: which one wins is not specified.
- Sheets must not cross the fold (rule); a compose sheet in the detail pane must stay in x 455 to 890.
- A Send in progress when the user switches to another message: the compose state must not be lost or sent twice.

#### Design gaps
- No board for the compose or reply surface on either posture.
- "Important only" appears only in `Split.dc.html` and is not mentioned in rule cards.
- The folders list in the 1/3 sidebar is named but not drawn; sections (Needs reply, Other mail today) are drawn.
- Selection behavior after Archive (next, previous, none) is not defined.
- "Inbox zero" empty state in the two-pane layout is not drawn (what the detail shows).
- Where "Cleanup", "Star" and "Mute" live in the two-pane layout is not defined.


### STORY-065: Compose a new message from scratch
**Type**: short
**Topic**: Inbox triage and compose
**Source**: topics/inbox.md STORY-010
**Phase issue**: #418 (P6), #419 (P7)
**Persona**: Elena Rossi, founder of a climate startup
**Goal**: Send a short intro email to a new advisor.
**Preconditions**: Two Gmail accounts connected. Mail writes on.
**Device**: iPhone Duo outer (466x678 pt)
**Ideal path**: 4 — tap "Compose", fill To, Subject and body, tap Send.
**Alternate paths**: Ask the Inbox agent "email sam@example.com about an intro" (mail approval card). A bot's own thread can draft mail.
**Design source**: "Compose" button: `Sheet.dc.html`. Compose sheet itself: NO BOARD.

#### Steps
1. In Inbox, tap "Compose" in the strip group → a compose sheet opens in the content area beside the strip (sheets stay in the content area on the outer display). The From line defaults to one account; no `prefill` call is needed for a blank message.
2. Enter `sam@example.com` in To, "Intro" in Subject, and a short message in the body → the fields hold text and a `clientId` is created.
3. Tap the From line and choose the second account → `connectionId` changes.
4. Tap Send → `inbox.compose.send` with no `replyToMessageId`; result `sent`, the sheet closes.

#### Variations
- Close with Cancel while there is text: choose to save as draft (`draftSave`, result `saved`) or discard.
- Keyboard rises from the bottom; on a short height (466x420) the body field scrolls.

#### Edge Cases
- Invalid address: the API accepts text; validation and error copy are not defined.
- Subject empty: Gmail sends without a subject; whether the app warns is not defined.
- Body over 150,000 characters (`MAX_COMPOSE_BODY`).
- Saved drafts are not listed anywhere in the planned app (no Drafts view).

#### Design gaps
- No compose sheet board; no way to open saved drafts (`draftSave` has no list procedure in `rpc.ts`).
- No contact autocomplete.
- No guidance for choosing the From account when several accounts exist.


### STORY-066: First open with no mail account, then the first sync
**Type**: short
**Topic**: Inbox triage and compose
**Source**: topics/inbox.md STORY-011
**Phase issue**: #418 (P6)
**Persona**: Owen Fitzgerald, new user who has not connected Gmail
**Goal**: Reach a usable Inbox.
**Preconditions**: Signed in, no mail account connected, no Inbox agent yet.
**Device**: standard iPhone
**Ideal path**: 4 — open Inbox, connect mail, return, wait for the first sync.
**Alternate paths**: Connect Gmail from Settings > Integrations before opening the Inbox. Ask the Inbox agent to connect (Expo disables agent search until an account exists).
**Design source**: Connect mail state: NO BOARD. Integrations: `PG-B-Integrations.dc.html`. Empty "Inbox zero" and loading rows: `PG-A-Rules.dc.html` "Inbox".

#### Steps
1. Tap the Inbox row on Home → Inbox opens; `inbox.list` returns `accounts: []`.
2. See the empty state → Expo shows "Connect mail" and "No mail". The board shows "Inbox zero" only for a synced inbox.
3. Tap "Connect mail" → the Integrations connect flow starts in `ASWebAuthenticationSession`; after approval the app returns and polls for the connection.
4. Return to the Inbox → placeholder rows show while the first sync runs (`triagePending` is true, so the client refetches a few times), then mail and sections appear.

#### Variations
- Triage blocked: mail shows without "Needs reply", labels or to-dos, because `enabled` is false (`no_model` or `needs_consent`).
- Sync fails once: "Could not load mail." with retry.

#### Edge Cases
- User cancels the Google sign-in: the Inbox returns to the empty state.
- Sync finishes with zero messages: "Inbox zero" with `syncedAt` null (the last sync time is unavailable).
- The user switches space: the Inbox is per space and user, so the empty state may return.

#### Design gaps
- "Connect mail" empty state is not drawn; the "Inbox zero" text could mislead a user with no account.
- The first-sync loading state does not say that triage is still running.
- No board for triage blocked states, and the AI data consent prompt has no board.



## Topic: Topic: Team Computer, artifacts, agent pages and routines

Source file: `docs/ios-native/ux/topics/computer-artifacts.md`

### STORY-067: Watch the agent work on its Team Computer
**Type**: short
**Topic**: Team Computer, artifacts, agent pages and routines
**Source**: topics/computer-artifacts.md STORY-001
**Phase issue**: #420 (P8)
**Persona**: Maya Okafor, solo founder of a bookkeeping startup
**Goal**: See what the Finance agent is doing on its desktop without touching it.
**Preconditions**: Signed in, a space with a Finance agent, its computer already booted, thread open.
**Device**: standard iPhone
**Ideal path**: 3 — More menu, Open computer, read the screen.
**Alternate paths**: (a) tap a computer block in the thread (Expo `ComputerCard` opens `/computer`); (b) laptop pose, where the thread stays in the bottom half while the screen is on top.
**Design source**: Agent thread: PG-A-Thread, PG-A-Rules "Agent thread" (More group lists "open computer"). Computer: PG-A-Computer, PG-A-Rules "Computer". The standard-iPhone top bar for Computer is NO BOARD (boards show the Duo outer display).

#### Steps
1. In the Finance agent thread, tap the trailing More group, then "Open computer" → Team Computer screen pushes; clear-glass controls over the live screen; "Booting [name]" is not shown because it is already running.
2. Read the screen. The "Team" picker is top-left, the control chip is top-right. → The screen is view-only; no key bar is shown. Screen URL comes from `computer/screenUrl`; status is polled about every 2 s.
3. Tap "Close" → Returns to the thread.

#### Variations
- Tap a computer block inside a message instead of the More menu.
- The agent finishes its task while the user watches; the screen stays as the last frame.

#### Edge Cases
- Screen URL is a one-hour capability URL; at 50 minutes it must renew without reloading the web view.
- Backgrounding the app during a long watch: heartbeat (every 60 s) behavior is not specified.

#### Design gaps
- No standard-iPhone layout for Computer: the board only shows the 466x678 outer display (side strip, clear glass). The Close, Keyboard, Fit to screen and Take control placement on a 393 pt iPhone is undefined.
- The More menu label "open computer" is lowercase in the rule card; the Expo label is "Open computer". Pick one.


### STORY-068: Boot a stopped Team Computer and take control for a login
**Type**: long
**Topic**: Team Computer, artifacts, agent pages and routines
**Source**: topics/computer-artifacts.md STORY-002
**Phase issue**: #420 (P8), #419 (P7)
**Persona**: Tomas Lindqvist, operator of a two-person logistics software company
**Goal**: Open a stopped computer, take control, log in to a vendor portal by hand, type a code, and hand control back so the agent continues.
**Preconditions**: Signed in; a bot whose computer is stopped; the agent has asked for a human login ("Needs you").
**Device**: iPhone Duo outer
**Ideal path**: 14 — open, boot wait, Take control, tap field, show keyboard, type, tab, enter, hide keyboard, Release, answer handoff, close.
**Alternate paths**: (a) use Release, "I'm done" in the handoff prompt instead of the Release button; (b) Skip in the handoff prompt when the user cannot log in; (c) laptop pose, key bar and Release on the bottom half; (d) inner display, thread beside the screen so the user can tell the agent what happened.
**Design source**: PG-A-Computer and PG-A-Rules "Computer" for screen, control chip, Team/Private picker, key bar (Esc, Tab, Ctrl, arrows), Take control and Release. Handoff Skip / "I'm done": described in the rule card text only, no drawn screen (NO BOARD for the handoff prompt itself). The thread message that asks for the handoff: DS-06-Chat / DS-07-Domain computer and handoff blocks (not verified in detail).

#### Steps
1. In the thread, a "Needs you" computer block appears from the agent; tap it → Computer screen opens.
2. Screen shows "Booting [name]" with a progress bar → Progress advances; poll status about every 2 s.
3. Booted; the desktop appears in the web view → View-only. Prominent "Take control" button is last in the side strip.
4. Tap "Take control" → `computer/takeover` returns a lease (default 15 minutes). Prominent button becomes "Release" (lock.open). Control chip reads "You have control". Clear key bar appears at the bottom. The screen URL is re-read because control changed.
5. Tap the login field on the screen → Pointer input goes to `computer/input`; remote field focuses.
6. Tap "Keyboard" in the action group → iOS keyboard appears; typed characters go to the remote machine.
7. Type the username → Characters show on the screen.
8. Tap "Tab" on the key bar → Focus moves to the password field.
9. Type the password → Characters show (masking is up to the remote page).
10. Tap "Return" on the key bar (Expo label "Return") → Form submits; the vendor page loads.
11. Type the one-time code, then Return → Portal dashboard shows.
12. Tap "Keyboard" again → Keyboard hides.
13. Tap "Release" → Control returns to the agent. Handoff prompt asks "Skip" or "I'm done".
14. Tap "I'm done" → Lease released with reason `done`; control chip clears; the thread resumes and the agent says it is continuing.

#### Variations
- Tap "Skip" at step 14: release reason `skipped`; the agent is told the human did not finish.
- Tap "Fit to screen" at step 3 if the remote desktop is larger than the phone.
- Switch the picker from "Team" to "Private" before taking control (Private is a per-user computer; see Edge Cases).

#### Edge Cases
- Lease expires at 15 minutes while typing: the key bar should disappear and the screen go view-only; expiry copy is not specified.
- "Could not open computer" with retry at step 2.
- "Could not load the desktop." at step 3 (screen URL returns null).
- Another viewer already holds the lease: Expo `takeover` fails; message is "Could not continue" or similar, wording not specified in the boards.
- Network drops while in control: Expo shows "Reconnecting"; no board.
- Expo also has computer recovery flows ("Recover computer", "Reset computer", "Update computer", "Recovering Team Computer", "Updating Team Computer", "Update failed"). The boards define none of these.

#### Design gaps
- Handoff prompt (Skip / "I'm done"): no drawn screen; presentation (alert, sheet, inline chip) is undefined, as is whether it also appears when the user taps Release outside a handoff.
- Lease expiry, "Reconnecting" and takeover-denied states: NO BOARD.
- Maintenance actions (Recover, Reset, Update computer, update progress) exist in Expo bot settings and the computer screen but are not in the board set or the Phase 8 plan text.
- Phase 8 plan says "keyboard bridge" but the board's key bar lists only Esc, Tab, Ctrl and arrow keys; "Return" and "Control" (Expo labels) are not on the board. Label mismatch: board "Ctrl" matches Expo "Ctrl"; Expo has "Escape" and "Return" as accessibility names.
- No pointer affordances (long press for right click, two-finger scroll, drag) are defined, although the API accepts `pointer` and `scroll` input.
- Clipboard input (`kind: "clipboard"`) has an API but no UI for pasting.


### STORY-069: Find last week's board update in Artifacts and read it
**Type**: medium
**Topic**: Team Computer, artifacts, agent pages and routines
**Source**: topics/computer-artifacts.md STORY-003
**Phase issue**: #420 (P8)
**Persona**: Priya Raman, founder preparing a board call
**Goal**: Locate the "Board update draft" HTML artifact and read it.
**Preconditions**: Signed in; the space has artifacts from several bots (Finance agent, Legal agent, Chief, Inbox agent).
**Device**: standard iPhone
**Ideal path**: 4 — Artifacts, tap "Chief" chip, tap row, read.
**Alternate paths**: (a) search with "Search artifacts" and type "board"; (b) open the artifact from the chat message where Chief made it; (c) Duo inner display, bot filter as a vertical list and preview beside the rows.
**Design source**: PG-A-Home / PG-A-Rules "Home" for the Artifacts entry (side-strip group Activity / Search / Artifacts). PG-A-Artifacts and PG-A-Rules "Artifacts" for the list. PG-A-Artifact and PG-A-Rules "Artifact" for the preview.

#### Steps
1. On Home, tap "Artifacts" (side-strip group on Duo; Home on a standard iPhone has an Artifacts entry in Expo at `index.tsx` but its native position is undefined) → Artifacts list opens with large title "Artifacts", chip row starting with "All bots" (active chip is ink), then divided rows.
2. Tap the "Chief" chip → List filters to Chief's artifacts. Row shows "Board update draft", "Chief · HTML · v2", "Yesterday".
3. Tap the "Board update draft" row → Artifact preview opens. Title capsule shows "Loading…" then the name. The HTML renders in a sandbox inside a preview card; floating version pill reads "v2 of 2".
4. Scroll and read → Content scrolls under the capsule and pill.

#### Variations
- Type "board" in the search field first; rows filter and the empty result reads "No matching artifacts".
- Use "All bots" and scroll; paging uses `artifacts/listSpace` with a cursor (limit up to 60).

#### Edge Cases
- "No artifacts yet" for a new space.
- "Could not load artifacts." with "Try again."
- "Could not load this artifact." in the preview.
- "No preview for this file type." for unsupported types.
- Many bots: the chip row must scroll sideways; not drawn.

#### Design gaps
- Standard iPhone entry point to Artifacts is not specified (the Home rule card places it in the outer side strip only).
- The search field on the list is only an icon ("Search artifacts") in the strip; how it expands on a standard iPhone is not drawn.
- Chip overflow (more than about four bots) is not drawn.
- Row sort order and date grouping labels ("Today", "Yesterday", "Oct 17") are shown, but the rule is not stated.


### STORY-070: Compare versions of a runway summary and share it
**Type**: medium
**Topic**: Team Computer, artifacts, agent pages and routines
**Source**: topics/computer-artifacts.md STORY-004
**Phase issue**: #420 (P8), #419 (P7)
**Persona**: Jordan Reyes, investor-relations lead at a seed-stage company
**Goal**: Check that v5 of "Runway summary" differs from v4, then share the markdown file with an advisor.
**Preconditions**: Artifact "Runway summary" has 5 versions.
**Device**: iPhone Duo outer
**Ideal path**: 6 — open row, Versions, pick v4, back to v5, Share, pick target.
**Alternate paths**: (a) Share from a prior version; (b) laptop pose, version pill and Share as a bottom bar; (c) share the artifact from a chat message long-press (Expo message menus; not on a board).
**Design source**: PG-A-Artifacts, PG-A-Artifact and PG-A-Rules "Artifact". The versions menu is named in the rule card (Overlays, versions menu) but its list is NO BOARD.

#### Steps
1. In Artifacts, tap the "Runway summary" row ("Finance agent · Markdown · v5", Today) → Preview opens with "Cash [AMOUNT]  Runway [N] mo", the paragraph "Cash fell in the last 30 days, mostly from two vendor payments.", rows "Northwind" and "Acme Payroll", and the pill "v5 of 5".
2. Tap "Versions" (square.stack.3d.up) in the action group → A versions menu lists v1 to v5 (list from `artifacts/listVersions` by `familyId`).
3. Choose v4 → Preview swaps to v4; pill reads "v4 of 5". Whether an older version is marked read-only is not drawn.
4. Scan the differences → The user compares by eye; no diff view exists.
5. Tap the pill and choose v5 → Back to the latest.
6. Tap "Share", the prominent button → iOS share sheet opens with the file; user picks Messages.

#### Variations
- Share v4 instead of v5.
- Share an HTML artifact: the share target receives an HTML file, not a rendered image.

#### Edge Cases
- Share fails: Expo alert "Could not share this artifact" with "Try again."
- A new version arrives while the user views v5: pill count and content refresh behavior is not specified.
- Versions menu for a single-version artifact: should the Versions button be disabled or hidden?

#### Design gaps
- The versions menu contents and selected-state are not drawn.
- No diff or "what changed" view; the user has to compare by eye (a possible simplification, not a request).
- Behavior when a newer version arrives while viewing is undefined.
- Where "Share" sits on a standard iPhone: the rule card puts the prominent Share in the strip, but the board shows an in-page pill on the standard layout (not verified against the preview).


### STORY-071: Delete an outdated artifact
**Type**: short
**Topic**: Team Computer, artifacts, agent pages and routines
**Source**: topics/computer-artifacts.md STORY-005
**Phase issue**: #420 (P8)
**Persona**: Hana Sato, operations lead
**Goal**: Remove an old "Filing calendar" artifact that has three versions.
**Preconditions**: "Filing calendar" (Legal agent, HTML, v3) exists.
**Device**: standard iPhone
**Ideal path**: 3 — long-press row, confirm Delete.
**Alternate paths**: (a) open the artifact, More menu, Delete, confirm; (b) none other found for deleting several at once.
**Design source**: PG-A-Rules "Artifacts" ("Long press a row: delete confirm") and "Artifact" (More, delete; "Delete confirms version count"). The confirm dialog itself is NO BOARD.

#### Steps
1. Long-press the "Filing calendar" row → Confirmation appears: Expo reads Delete "Filing calendar"? with "This can't be undone." and mentions the version count.
2. Tap "Delete" (destructive) → `artifacts/remove` runs; the row disappears.
3. Check the list → "Filing calendar" is gone; other rows keep their order.

#### Variations
- Tap "Cancel": nothing changes.
- Delete from the preview More menu; on success the preview pops back to the list.

#### Edge Cases
- Failure: alert "Could not delete this artifact" with "Try again."
- The deleted artifact is still referenced in an old chat message: tapping it should show "Could not load this artifact." (not specified).
- Deleting the version the user was viewing on Duo inner display while the preview is open: the preview must clear.

#### Design gaps
- Dialog is described only in text; the exact copy and whether it deletes all versions is not on a board. The rule card says "confirms version count", the API deletes by `artifactId` (it is unclear whether that removes the family).
- No undo.
- No multi-select delete.


### STORY-072: View a generated chart image full screen and save it to Photos
**Type**: medium
**Topic**: Team Computer, artifacts, agent pages and routines
**Source**: topics/computer-artifacts.md STORY-006
**Phase issue**: #420 (P8)
**Persona**: Leila Haddad, founder who posts weekly updates
**Goal**: Open "vendor-payments-q3.png" full screen, zoom in, and save it to Photos.
**Preconditions**: The Finance agent made the image artifact "Vendor payments Q3" (Image, v1).
**Device**: standard iPhone
**Ideal path**: 4 — open row, image opens full screen, Save to Photos, Close.
**Alternate paths**: (a) tap the image block inline in the chat thread; (b) Share instead of Save to Photos; (c) laptop pose, image on top half and controls on the bottom half, free rotation.
**Design source**: PG-A-Image and PG-A-Rules "Image". Row: PG-A-Artifacts. Photos permission prompt: NO BOARD.

#### Steps
1. In Artifacts, tap "Vendor payments Q3" ("Finance agent · Image · v1", Yesterday) → Full-screen image opens on black; 35% dim under the clear controls; name pill "vendor-payments-q3.png" floats at the bottom.
2. Pinch to zoom → Image zooms (Expo: zoom, share or export).
3. Tap "Save to Photos" in the action group → First time, iOS asks for add-to-Photos permission; allowing saves the image. A success confirmation is not drawn.
4. Tap "Close" → Returns to the Artifacts list at the same scroll position.

#### Variations
- Tap "Share" in the same group for the system sheet.
- Tap the More group for any extra actions (contents not defined).

#### Edge Cases
- "Could not load this image." with Close still available.
- Photos permission denied: no copy defined.
- Rotation of the phone: the rule card says Image "rotates freely".

#### Design gaps
- Success and failure feedback for "Save to Photos" is not drawn.
- More group contents on Image are undefined (the card lists "More" but gives no actions).
- Expo has Share only; "Save to Photos" is new in the native app (feature added by the board, label from the board).
- Image viewer in Duo inner mode keeps the thread as the sidebar third; the artifact list is not part of that layout, so "back to the list" may differ.


### STORY-073: Read the Finance agent's pinned page, then jump to chat
**Type**: medium
**Topic**: Team Computer, artifacts, agent pages and routines
**Source**: topics/computer-artifacts.md STORY-007
**Phase issue**: #420 (P8), #419 (P7)
**Persona**: Maya Okafor (see STORY-067)
**Goal**: Read the Finance agent's "Runway summary" page and ask a follow-up about the receipts.
**Preconditions**: The Finance agent has saved a page (`pages/get` returns blocks). Amounts are visible (Hide amounts off).
**Device**: iPhone Duo outer
**Ideal path**: 4 — thread Page button, read, Open chat, ask.
**Alternate paths**: (a) agent thread More menu, Page; (b) inner display, page and thread side by side so the user asks without leaving the page; (c) laptop pose, page on top half and composer on bottom half; (d) Hide amounts (Expo shows "Hide amounts" / "Show amounts" on this screen).
**Design source**: PG-A-AgentPage and PG-A-Rules "Agent page". Chat: PG-A-Thread. Hide amounts toggle: NO BOARD on Agent page.

#### Steps
1. In the Finance agent thread, tap "Page" (doc.text) in the side strip → Agent page opens. Capsule shows "Finance agent".
2. Read the document: title "Runway summary", figure tiles "Cash [AMOUNT]", "Burn [AMOUNT]/mo", "Runway [N] mo", a chart, then "Cash fell in the last 30 days, mostly from two vendor payments. At the current burn the runway is [N] mo." and the lines "4 card expenses need receipts" and "One invoice is due Friday".
3. Tap "Open chat" (prominent) → Returns to the Finance agent thread.
4. Type "Which four card expenses are missing receipts?" and send → The agent replies in the thread. The page is unchanged unless the agent saves a new page.

#### Variations
- On the inner display step 3 is unnecessary; the thread sits in the third.
- Tap "List" (checklist) in the strip to jump to the agent's list (STORY-074).

#### Edge Cases
- Empty: "No page yet."
- Error: "Could not load this page." (an already loaded page stays).
- "Chart could not be drawn." appears in place of the chart.
- The page changes while open (the agent updates it): refresh behavior is not specified; `pages/get`/`pages/save` has no push event in the board.

#### Design gaps
- The page is not editable by the user (no API in the board for edits; `pages/save` exists). Confirm that read-only is intended.
- The bullet-style lines "4 card expenses need receipts" and "One invoice is due Friday" have no tap target; the user cannot go from a finding to the receipts.
- Hide amounts affects the tiles on the page in Expo; the board does not show the control.
- The same runway figures also live on the Finance page, the "Runway summary" artifact and the routine prompt; no cross-link between them is designed.


### STORY-074: Work through the "Close checklist" and add an item
**Type**: medium
**Topic**: Team Computer, artifacts, agent pages and routines
**Source**: topics/computer-artifacts.md STORY-008
**Phase issue**: #420 (P8)
**Persona**: Tomas Lindqvist (see STORY-068)
**Goal**: Tick off finished month-end steps and add "Send invoice reminders".
**Preconditions**: The agent keeps a list titled "Close checklist" with items "Collect missing receipts", "Review vendor payments", "Send runway update to Jordan", "Confirm card limits", "File Q4 tax estimate".
**Device**: standard iPhone
**Ideal path**: 5 — open list, tick two items, type in Add item, add, done.
**Alternate paths**: (a) ask the agent in chat to add the item; (b) laptop pose, Add item field on the bottom half; (c) swipe or long-press to delete (Expo alert "Delete").
**Design source**: PG-A-AgentList and PG-A-Rules "Agent list". Delete confirmation and swipe affordance: NO BOARD.

#### Steps
1. From the thread, tap "List" (checklist) → Agent list opens with capsule "Close checklist" and checklist rows.
2. Tap the checkbox for "Collect missing receipts" → Row becomes muted and struck through.
3. Tap the checkbox for "Review vendor payments" → Same.
4. Tap the floating field with placeholder "Add item", type "Send invoice reminders" → The prominent add button at the trailing end of the field becomes active.
5. Tap the add button → The new row appears at the bottom; the field clears. The change saves to the server.

#### Variations
- Delete an item through the Expo alert "Delete" with "Cancel" / "Delete".
- Add several items quickly.

#### Edge Cases
- Empty list: only the field with placeholder "Add item".
- "Could not load this list."
- Save failure: alert "Could not save this list." and the row reverts.
- The agent edits the list at the same time: Expo shows "The bot changed this list. Your last edit wasn't saved." The board has no design for this conflict.
- Keyboard covers the floating field on a small phone.

#### Design gaps
- Conflict alert ("The bot changed this list. Your last edit wasn't saved.") has no board.
- Reorder and rename are not in either the board or the Expo app.
- Delete affordance (swipe vs long-press) is undefined.
- The boards title the capsule with the list name; the Expo app uses a "List" header title. The native app should use the list name.
- Done items: no "clear done" action.


### STORY-075: Check what a weekly routine did and open its conversation
**Type**: medium
**Topic**: Team Computer, artifacts, agent pages and routines
**Source**: topics/computer-artifacts.md STORY-009
**Phase issue**: #420 (P8), #419 (P7)
**Persona**: Priya Raman (see STORY-069)
**Goal**: See when the "Weekly runway summary" routine last ran and open the conversation it produced.
**Preconditions**: A routine exists on the Finance agent; Home shows an Activity item "routine ran".
**Device**: iPhone Duo outer
**Ideal path**: 3 — tap Activity item, read routine, Open conversation.
**Alternate paths**: (a) search hit of kind `routine` (Expo `search-destination` routes to `/routine`); (b) push notification for a routine run (push taps are phase 10; routine destination not specified); (c) inner display, the agent's routines list in the third, detail beside it.
**Design source**: PG-A-Routine and PG-A-Rules "Routine". Entry point from Home Activity: PG-A-Home / Rules "Home" ("routine ran" activity item). Routines list on the inner display: NO BOARD (rule card says "the agent's routines list").

#### Steps
1. On Home, tap the Activity item for the routine → Routine detail opens. Capsule shows "Weekly runway summary".
2. Read the status card: "Every Monday at 8:00 AM", "Finance agent · Last ran today, 8:00 AM", "Next run Mon, Oct 26" → The user confirms the last run time.
3. Read the "PROMPT" card: "Summarize cash, burn and runway for the last 30 days. List vendor payments over [AMOUNT] and any card expenses missing receipts. Update the Runway summary page." → The user checks the instruction.
4. Tap "Open conversation" (prominent) → The thread produced by the run opens.

#### Variations
- The user then taps "Page" in that thread to see the updated "Runway summary" page (STORY-073).
- Open the same routine from search.

#### Edge Cases
- Loading: spinner. Errors: "Could not load routine", "This routine no longer exists", "Routine link is incomplete".
- A routine that has never run: the last-run line is undefined.
- A run that failed: the status card does not show success or failure.

#### Design gaps
- Routine history is in the API (`routines/history`, with a cursor) and the plan says "routine detail and history", but PG-A-Routine has no history list; "Open conversation" opens one conversation only (which run is unclear).
- No create, edit, pause or delete UI for routines, although `routines/create`, update and remove exist. Confirm that read-only is intended.
- The routines list for an agent (the inner third) has no board; on a standard iPhone there is no way to browse an agent's routines at all.
- No failed-run or paused state on the status card.


### STORY-076: Run a month-end handoff across computer, artifact, page, list and routine
**Type**: long
**Topic**: Team Computer, artifacts, agent pages and routines
**Source**: topics/computer-artifacts.md STORY-010
**Phase issue**: #420 (P8), #419 (P7)
**Persona**: Jordan Reyes, a founder-operator running close alone
**Goal**: Start from a "Needs you" computer request, finish a portal download, check the artifact the agent produced, confirm the page and list are updated, and check the routine that will repeat it.
**Preconditions**: Finance agent has a booted computer, a routine, a page, a list and a new artifact "Runway summary" (v6). Amounts visible.
**Device**: iPhone Duo laptop pose (626x890, fold at y 435 to 455)
**Ideal path**: 22 — one pass through five screens with the thread always available.
**Alternate paths**: (a) skip the computer if the agent can finish without help; (b) use the inner book (890x626) with the thread in the third and the screen beside it; (c) on a standard iPhone every step is a push, with Back between screens.
**Design source**: PG-A-Computer, PG-A-Artifact, PG-A-AgentPage, PG-A-AgentList, PG-A-Routine, PG-A-Rules (laptop pose for Computer is "the main use of the pose"; Agent page, Agent list and Image are laptop-capable; Routine and Artifacts are not applicable and stay full height). Transitions between a laptop-pose screen and a not-applicable screen are NO BOARD.

#### Steps
1. On Home, tap Activity item "needs you" for the Finance agent → Thread opens; the approval or handoff card sits above the composer.
2. Tap the computer block → Team Computer opens: screen on the top half; key bar, Release and thread composer on the bottom half.
3. Tap "Take control" → "You have control"; key bar appears.
4. Tap the portal's Download button on the screen → File downloads on the remote machine.
5. Tap "Release" → Handoff prompt "Skip" / "I'm done".
6. Tap "I'm done" → Control returns; the agent continues.
7. In the bottom-half composer, type "Thanks, check the runway" and send → Message goes to the thread.
8. Tap "Close" → Back to the thread.
9. The agent posts "Runway summary v6" as an artifact chip in the thread; tap it → Artifact preview opens (top half preview, bottom half version pill and Share).
10. Read the preview → Cash falls; the paragraph matches the Runway summary.
11. Tap "Versions" and compare to v5 → v5 shows; return to v6.
12. Close back to the thread (Back).
13. Tap "Page" → Agent page, top half page, bottom half composer.
14. Check the tiles "Cash [AMOUNT]", "Burn [AMOUNT]/mo", "Runway [N] mo" → They match the artifact.
15. In the bottom composer, ask "Which card expenses still need receipts?" → The agent answers.
16. Tap "List" → "Close checklist" opens.
17. Tick "Collect missing receipts" and "Review vendor payments" → Rows mute and strike through.
18. Back to the thread; open Home; tap the routine Activity item → Routine detail goes full height (laptop pose not applicable).
19. Read the status card: "Every Monday at 8:00 AM", "Next run Mon, Oct 26" → The user knows when this repeats.
20. Read the prompt card → It still says "Update the Runway summary page."
21. Tap "Open conversation" → The routine's thread opens.
22. Close the app or lock the phone → Nothing else is pending.

#### Variations
- Steps 9 to 11 replaced by Artifacts list, filter "Finance agent".
- Do steps 13 to 17 on the inner book with the thread alongside.

#### Edge Cases
- Posture change from laptop pose to flat while the computer is under control: the lease and screen state must survive (Duo posture changes are not specified).
- Lease expiry (15 minutes) while the user reads the artifact on another screen: the key bar is gone on return.
- The user leaves the Computer screen while holding control: whether leaving releases control is not defined.

#### Design gaps
- Leaving the Computer screen while holding the lease: no rule or prompt.
- Moving between a laptop-capable screen and a not-applicable one (Routine, Artifacts) in laptop pose is not designed.
- The same Runway data appears on four screens; no deep link from the artifact to the page or from the routine to the artifact.
- The routine's link to "the conversation" does not say which run (see STORY-075).
- Selection and scroll survival across posture changes is not specified in the docs read.


### STORY-077: Recover when artifacts, the page and the computer fail to load
**Type**: medium
**Topic**: Team Computer, artifacts, agent pages and routines
**Source**: topics/computer-artifacts.md STORY-011
**Phase issue**: #420 (P8)
**Persona**: Hana Sato (see STORY-071), on a train with poor signal
**Goal**: Recover from three load failures and get back to a working state.
**Preconditions**: Signed in; the connection drops in and out.
**Device**: standard iPhone
**Ideal path**: 6 — each failure has a retry; three retries.
**Alternate paths**: (a) reconnect and pull to refresh (not designed); (b) close and reopen the screen.
**Design source**: PG-A-Rules "Artifacts", "Agent page", "Computer", "Routine" (empty / loading / error lines). The retry control for Agent page and Routine is NO BOARD.

#### Steps
1. Open Artifacts while offline → "Could not load artifacts." with "Try again."
2. Tap "Try again." after the signal returns → List loads.
3. Open the Finance agent page → "Could not load this page." (no loaded page to keep).
4. Go back and open it again → Page loads. No retry button on the page itself.
5. Open the computer → "Could not open computer" with retry.
6. Tap retry → "Booting [name]" with a progress bar, then the desktop. If the screen cannot load: "Could not load the desktop."

#### Variations
- Open a routine offline: "Could not load routine".
- Open an artifact offline: "Could not load this artifact."

#### Edge Cases
- Cached artifact lists exist in Expo (integrations and artifact caches are listed in the app map); whether stale rows show with the error is not specified.
- Server older than the app: a 404 on a newer procedure means "not supported"; no copy for it on these screens.

#### Design gaps
- Agent page, Agent list and Routine errors show text but no retry control on the boards (only Artifacts and Computer have one).
- No offline banner or stale-data indicator.
- "Not supported by this server" copy is not defined for any of these screens.
- "Could not load the desktop." has no retry or "Try again" action drawn.



## Topic: Stories: Finance, Legal, Cap table and Data room

Source file: `docs/ios-native/ux/topics/finance-legal.md`

### STORY-078: Check runway and cash, then ask the Finance agent why spend jumped
**Type**: medium
**Topic**: Finance, Legal, Cap table and Data room
**Source**: topics/finance-legal.md STORY-001
**Phase issue**: #424 (P12)
**Persona**: Priya Anand, solo founder of a 4-person seed-stage company, checking money before a board call
**Goal**: See current runway and cash, look at the 90-day view, and ask the Finance agent why spend rose.
**Preconditions**: Signed in, space selected, Mercury and Brex connected, Finance agent exists, AI data sharing consent granted.
**Device**: standard iPhone
**Ideal path**: 6 — open Finance, switch period, read KPIs, tap Ask Finance agent, type question, send.
**Alternate paths**: (a) Home > "Finance agent" row in Personnel > ask in the thread directly, which answers with an inline finance card (no Finance page needed). (b) Tap a push notification whose `surface` is "finance" (Expo already routes `/finance` taps; native must too). (c) Ask from the Desk laptop-pose composer "Message Finance agent". (d) Voice: dictate the question into the Finance agent thread.
**Design source**: Steps 1-2 NO BOARD for the entry point (rule card says "Push from sidebar Finance row", no board draws the row). Steps 3-5 `PG-B-Finance.dc.html`, `PG-B-Rules.dc.html` Finance card. Step 6 `PG-A-Thread.dc.html`, `Desk.dc.html` (reply wording "Why did spend jump last month?").

#### Steps
1. From Home, reach the Finance page (entry point undefined; see gaps) → Finance page pushes with a Back chevron. Skeleton KPIs show while `finance.overview` loads.
2. Wait for load → "Runway [N] mo", "Cash [AMOUNT]", "Monthly burn", then "Accounts" with "Operating" (Mercury agent) and "Cards" (Brex agent), and "Upcoming" with "Northwind invoice, Due Oct 24" and "Acme Payroll, Oct 31".
3. Tap "90 days" in the period tabs (30 days, 90 days, 12 months) → burn chart and burn figure change to the 90-day range.
4. Read the burn bars; tap the highlighted bar → selection announces "Sep, [AMOUNT]" to VoiceOver and highlights the bar (DS-07 Spend bar chart).
5. Tap "Ask Finance agent" (prominent bubble in the top bar) → Finance agent thread opens with a composer, labeled "Message Finance agent" on the laptop board.
6. Type "Why did spend jump last month?" and send → run starts; reply streams in as text plus an optional finance card ("Two annual renewals landed in the same month...").

#### Variations
- Tap "12 months" and compare Runway to the 30 day figure; runway uses current burn so it may not change with the tab (not specified).
- Same data in chat: the Finance agent can post a `finance` card (overview, breakdown, transactions). The native card must show the same numbers as the page and honor Hide amounts (see STORY-079).
- Pull to refresh versus the top-bar refresh button (`finance.refresh`): two ways to refresh. Pull-to-refresh is not drawn.
- Light mode (not drawn; boards are dark only).

#### Edge Cases
- User has no connected model: send fails with "Connect a model to start a run".
- AI consent not granted: send fails with "Review AI data sharing in Account settings before continuing."; client should prompt first.
- Offline: saved snapshot behavior for Finance is not specified; chat message is queued in the outbox.
- Runway is null (no burn data): board shows `[N] mo` only; a null state is not drawn. `finance.runway` can return no figure.
- Non-USD transactions are left out of totals; no indicator is drawn.

#### Design gaps
- Entry point to the page on the outer display (no sidebar row drawn).
- Runway/Cash/Burn when value is unavailable (null runway).
- Pull to refresh and refresh progress (top-bar refresh icon has no loading state).
- Tapping an account row, an Upcoming row, or a burn bar for detail: no screen (account detail, transaction detail have API `finance.account`, `finance.transaction` but no board).
- The inner-book rule lists sections "Overview, Accounts, Burn, Spend", but the outer page shows Overview, Accounts and Upcoming; "Spend" and "Upcoming" naming differ and "Spend" has no outer layout.


### STORY-079: Hide amounts before screen sharing, including chat finance cards
**Type**: short
**Topic**: Finance, Legal, Cap table and Data room
**Source**: topics/finance-legal.md STORY-002
**Phase issue**: #424 (P12)
**Persona**: Marcus Webb, founder who often shows his phone to an advisor over coffee
**Goal**: Mask every dollar figure on the phone, then confirm that chat cards are masked too.
**Preconditions**: Finance connected; the Finance agent thread has an earlier `overview` finance card.
**Device**: standard iPhone
**Ideal path**: 2 — tap the eye in the top bar, open the thread.
**Alternate paths**: none found for toggling (the toggle is only drawn on the Finance page). Reveal by tapping the same button.
**Design source**: `PG-B-Finance.dc.html` and rule card (action group "eye: hide amounts, refresh"), `DS-07-Domain.dc.html` "Hidden amounts" and "amounts hidden" specimen. Chat card masking: NO BOARD.

#### Steps
1. On Finance, tap the eye button in the action group → every amount becomes "•••" and the label reads "amounts hidden"; layout does not shift; the icon changes to eye.slash.
2. Go back and open the Finance agent thread → the finance card in the thread shows masked amounts (README: "Hide amounts is client-only; mask chat finance cards too").

#### Variations
- Toggle back with the same button; the setting is device-only, stored locally (Keychain preferences), not synced.
- Transaction rows show "••••" for amounts (DS-07 hidden row).
- Mercury agent text replies ("Balance as of this morning: [AMOUNT]") are plain agent text; masking those is not specified.

#### Edge Cases
- Relaunch the app: persistence of the setting is implied (device preference) but not stated for restart.
- Another surface: Legal figures (decimal strings of minor units) and Cap table share counts are not covered by "amounts".
- VoiceOver on a hidden amount should not read the real value (not specified).

#### Design gaps
- Whether Hide amounts also masks agent-written text, push notification text ("Balance as of..."), the Home Personnel preview line, and Live Activities.
- The toggle exists only on Finance; no setting in Settings.
- Hidden-state card for chat is not drawn.


### STORY-080: Run Scan now on Legal and review contracts and deadlines
**Type**: medium
**Topic**: Finance, Legal, Cap table and Data room
**Source**: topics/finance-legal.md STORY-003
**Phase issue**: #424 (P12)
**Persona**: Dana Ortiz, operator at a 12-person startup who handles contracts
**Goal**: Trigger a fresh scan, see which contracts are expired or awaiting signature, and see this week's deadlines.
**Preconditions**: Legal agent exists, user's own OpenRouter key is set (`modelBlocker` is clear), Legal consent granted, Data room has documents.
**Device**: standard iPhone
**Ideal path**: 5 — open Legal, tap scan, wait, read Contracts, switch to Deadlines.
**Alternate paths**: (a) Home > "Legal agent" row ("2 deadlines due this week") > ask the agent in chat instead of using the page. (b) Push notification that taps through to Legal. (c) Ask Legal agent in the page to explain a specific contract.
**Design source**: `PG-B-Legal.dc.html`, `PG-B-Rules.dc.html` Legal card, `DS-07-Domain.dc.html` Deadline row and Document card. Scan progress and result toast: NO BOARD.

#### Steps
1. Open Legal (entry point undefined) → Back chevron, scan icon, "Ask Legal agent"; segmented "Contracts" and "Deadlines"; summary "Last scan today, 8:05 AM" and "2 deadlines this week".
2. Tap the scan icon in the top bar ("scan now") → `legal.scanNow` starts a run; progress state (not drawn).
3. Read the contract rows → "Northwind services agreement, Ends Dec 31, Signed"; "Design partner NDA, Sent to Jordan Lee, Awaiting"; "Office lease renewal, Expired Sep 30, Expired"; "Acme Payroll terms, Updated Oct 12".
4. Tap "Deadlines" → deadline rows with a calendar tile, status chip with clock icon and words: "Due in 3 days" (warning), "Overdue" (destructive), "On track".
5. Tap "File annual report" → deadline edit/detail (`legal.updateDeadline` exists). Screen NO BOARD.

#### Variations
- Tap a contract row → contract detail (parties, dates, deadlines). Drawn only for the inner display (2/3 pane); no outer-display push page.
- Use `legal.itemLinks` to open the source Data room file from a contract; no link control drawn.
- After a successful scan, the "Last scan" line updates and unreviewed documents may remain (`unreviewedDocuments`); the count is not displayed on any board.

#### Edge Cases
- Never scanned: "Not scanned yet" with "Scan now".
- Scan failed: warning row with "Scan now".
- No OpenRouter key: "Add your OpenRouter key" opens Models (see STORY-081).
- Legal consent missing: `legal.consent` / `consentGrant` prompt; screen NO BOARD.
- Scan already running when the user taps again (`lastScanRun.status` "running"): not specified.
- Daily scan routine off (`dailyScanActive` false): no indicator drawn.

#### Design gaps
- Scan running, completed and cancelled states; the scan icon has no loading state.
- Contract detail and deadline edit on the outer display.
- Legal consent prompt.
- Status text colors for Signed, Awaiting, Expired: only text is drawn, mapping to chips (DS-07) is not stated for contract rows.
- "Never scanned" and "Scan failed" are described in the rule card only, not drawn.


### STORY-081: Legal is blocked until the user adds their own OpenRouter key
**Type**: medium
**Topic**: Finance, Legal, Cap table and Data room
**Source**: topics/finance-legal.md STORY-004
**Phase issue**: #424 (P12)
**Persona**: Tomas Berg, founder on a hosted plan who has never added a model key
**Goal**: Understand why Legal will not scan, add a key, and return to scan.
**Preconditions**: Legal page opened for the first time; user has no OpenRouter key; Legal agent exists.
**Device**: standard iPhone
**Ideal path**: 7 — open Legal, see blocker, open Models, add key, go back, scan.
**Alternate paths**: (a) Go to Settings > Models first and add the key before visiting Legal. (b) Ask the Legal agent in chat; the run would fail with the model blocker. (c) On the inner display, the Settings list in the third and Models beside it avoid leaving Legal.
**Design source**: `PG-B-Legal.dc.html` rule card ("No key: Add your OpenRouter key opens Models"), `PG-B-Models.dc.html` (key entry; read its rule card in the Models story). The blocker row itself: NO BOARD (text only in the rule card).

#### Steps
1. Open Legal → page shows the blocker row "Add your OpenRouter key" instead of contracts, from `modelBlocker`.
2. Tap "Add your OpenRouter key" → Models page opens (push).
3. Enter the key in the provider connect field and save → "Now using Model A"-style success from the Models states.
4. Tap Back to Legal → page should refresh and drop the blocker (refresh trigger is not specified).
5. Observe "Not scanned yet" with "Scan now" → tap it.
6. Wait for the scan → contract rows appear.
7. Read "Last scan today, ..." line → confirms success.

#### Variations
- Key is invalid: Models shows its own error ("Could not verify or save these credentials" belongs to Integrations; Models shows an unreachable red line).
- User with a subscription sign-in model instead of an OpenRouter key: Legal still requires OpenRouter; wording does not explain this.

#### Edge Cases
- Returning from Models via swipe-back versus the Back chevron: both must re-read `legal.overview`.
- The key is removed later: the page returns to the blocker.
- Self-hosted server older than the Legal procedures: 404 means "not supported"; no state drawn.

#### Design gaps
- The blocker row is not drawn (copy and layout appear only in the rule card). The page offers no explanation of why an OpenRouter key specifically is needed.
- Whether Legal consent (`legal.consentGrant`) is asked before or after the key.
- A way back from Models into Legal besides Back (a "Continue" return) is not designed.


### STORY-082: Connect Carta, read ownership, and add a contact
**Type**: long
**Topic**: Finance, Legal, Cap table and Data room
**Source**: topics/finance-legal.md STORY-005
**Phase issue**: #424 (P12)
**Persona**: Lena Fischer, CEO preparing a seed extension who needs to see who owns what
**Goal**: Connect Carta from the phone, read the ownership ring and holders, add an advisor as a contact, and ask the Carta agent about the option pool.
**Preconditions**: Carta not yet connected (`carta.capTable` returns `snapshot: null`); Carta agent exists; web OAuth for Carta is available through the Integrations flow.
**Device**: standard iPhone
**Ideal path**: 14 — open Cap table, tap Connect Carta, finish in Safari, return, read the ring, open Holders, tap plus, fill contact, save, tap Ask Carta agent.
**Alternate paths**: (a) Settings > Integrations > Carta, then open Cap table. (b) Home > "Carta agent" row, which may carry an `app_connect` card inside the thread ("Connect" prominent ink button) and connects without visiting the page. (c) Ask the Carta agent: "The option pool draft is ready" is the Home preview text.
**Design source**: `PG-B-CapTable.dc.html`, `PG-B-Rules.dc.html` Cap table card, `DS-07-Domain.dc.html` Ownership summary and Holder row, `PG-B-Integrations.dc.html` (connect pending alert), `DS-07-Domain.dc.html` AppConnectCard. Not-connected screen is described in the rule card only. Contact form: NO BOARD.

#### Steps
1. Open Cap table (entry point undefined) → not-connected state: "See who owns your company" with "Connect Carta".
2. Tap "Connect Carta" → app opens `authorizationUrl` in Safari (`ASWebAuthenticationSession`).
3. Sign in to Carta and approve in Safari → returns to the app.
4. App shows "Connect pending: alert to finish in browser, then refresh." until `connections.complete` polling (every 2 s) succeeds.
5. Page loads and shows "Carta is connected" (with "Reconnect" available), a syncing state while `syncing` is true.
6. Read the ownership ring: "Shares [N]", "Founders [N]%", "Option pool", "Seed investors", "Advisors", with a legend. Ring uses monochrome segments, not bot colors.
7. Scroll to "Holders" → holder rows with initials avatar, name, class and share count, percent right-aligned.
8. Tap a holder, for example "Ana Ruiz, Common" → holder detail (shares, contact). Outer-display screen: NO BOARD (drawn only as the 2/3 pane).
9. Go back and tap the plus (add contact) in the top bar → contact form. NO BOARD.
10. Enter name "Sam Okafor", role "Advisor", email → fields.
11. Save → `contacts.save`; the contact appears (location of contacts list is not drawn).
12. Tap the refresh icon → `carta.refresh`; syncing indicator, then updated figures.
13. Tap "Ask Carta agent" → Carta agent thread opens.
14. Send "How big is the option pool if we add 2% for hires?" → agent replies; writes (draft changes) wait for approval, and writes are off by default.

#### Variations
- Safari returns an error or the user cancels: connect state stays "See who owns your company".
- Connect from the Carta agent thread's AppConnectCard instead (alternate b).
- On the inner display: holder list 1/3 and holder detail 2/3, with the ring above on a laptop pose (ring top half; holders bottom half).

#### Edge Cases
- Token expired: "Reconnect Carta" in place of "Carta is connected"; "Reconnect" button on the connected row.
- Load error: "Try again".
- Safari returns but polling never completes (user abandoned): keep showing pending with a way to retry; timeout not specified.
- Percent rounding: ring legend shows Founders, Option pool, Seed investors and Advisors; DS-07 specimen shows Founders, Investors, Pool, Other, a label mismatch between board and specimen.
- MCP OAuth is web-only; Carta is a direct integration, so this should be fine, but the plan does not say which.

#### Design gaps
- Not-connected, expired, error and syncing screens are described but not drawn.
- Contact add form and contact list; holder detail on the outer display.
- Label mismatch: page board uses "Founders / Option pool / Seed investors / Advisors"; DS-07 uses "Founders / Investors / Pool / Other".
- Plan phase 12 does not mention the Safari return-and-poll step for Carta explicitly.
- Whether `contacts.save` for an advisor also links to a holder is unspecified.


### STORY-083: Upload a term sheet to the Data room and find it by search
**Type**: medium
**Topic**: Finance, Legal, Cap table and Data room
**Source**: topics/finance-legal.md STORY-006
**Phase issue**: #424 (P12)
**Persona**: Hiro Tanaka, founder who just received a signed PDF by email and wants it kept with deal documents
**Goal**: Add a PDF from the Files app to the Data room and confirm it is searchable.
**Preconditions**: Data room has folders ("Board materials", "Diligence"); AI consent for Data room granted; a PDF exists in the Files app.
**Device**: standard iPhone
**Ideal path**: 6 — open Data room, tap plus, pick file, watch upload, search by name, open result.
**Alternate paths**: (a) Share extension from Files or Mail to "Data room" (phase 13, #425, needs a physical device; no board). (b) Attach to an agent message through the composer (`artifacts/create`, 10 MB limit; not the Data room). (c) Ask the Data room agent to import from email, Drive or Box (server side imports). (d) On the Mac or web (not this app).
**Design source**: `PG-B-DataRoom.dc.html`, `PG-B-Rules.dc.html` Data room card, `DS-07-Domain.dc.html` Folder and file rows, Upload progress. Search result row, file preview: NO BOARD.

#### Steps
1. Open Data room (entry point undefined) → search field, "Recently added" rows ("Cap table export.csv, CSV · Ana Ruiz", "Northwind agreement.pdf", "Pitch deck v3.pdf"), folders ("Board materials, [N] items"; "Diligence"), and "Load more".
2. Tap the plus (add files) in the top bar → system file picker opens.
3. Choose "Term sheet.pdf" → picker closes; upload row appears: file tile, name, 4 pt progress bar and percent ("62%"), cancel (x).
4. Wait for completion → row becomes a normal file row; upload response is 201 (new). Item processing continues asynchronously.
5. Type "term sheet" in the search field → results with highlighted match text (U+0001/U+0002 markers rendered as emphasis).
6. Tap the result → file preview/detail. NO BOARD (README lists `GET …/content` and `…/thumbnail`).

#### Variations
- Upload a ZIP: response 202 with `importId`; the zip is unpacked in the background. The outcome is not drawn.
- Upload the same file again: 200 with `duplicate`; no duplicate message is drawn.
- Upload multiple files at once from the picker.
- Tap "Load more" to page (cursor-based).
- Filter (funnel icon) by facet; "No results" with "Clear filters" if empty.

#### Edge Cases
- Upload fails: row shows destructive "Upload failed" with "Retry"; "Cap table.xlsx" specimen.
- User taps cancel (x) mid-upload.
- Large file on cellular: no size limit; streamed body; no warning drawn.
- App is backgrounded during upload: background URLSession behavior not specified.
- Empty room: "Choose files" button replaces "Drop files here".
- Consent missing: `dataRoom.consent` / `consentGrant`, no screen.

#### Design gaps
- Folder navigation (tapping "Board materials"), item detail and preview, rename, move, delete, retry processing (`dataRoom.itemRetry`), and processing status for newly uploaded items (`dataRoom.processing`).
- Duplicate and zip-import outcomes.
- Search result row layout and search loading state.
- Upload progress in the background and after leaving the page.
- The "Shared / Only me / View only" permission chips are drawn in DS-07 but the README says "no share links" and no sharing API is planned; confirm what the chips mean.


### STORY-084: Share a file from the Data room into a conversation with an agent
**Type**: short
**Topic**: Finance, Legal, Cap table and Data room
**Source**: topics/finance-legal.md STORY-007
**Phase issue**: #424 (P12), #417 (P5)
**Persona**: Nadia Rahman, operations lead who needs the Legal agent to review a lease
**Goal**: Get a Data room file in front of the Legal agent.
**Preconditions**: "Office lease renewal.pdf" is already in the Data room and processed.
**Device**: standard iPhone
**Ideal path**: 4 — open Data room, find file, tap Ask Data room agent, mention the file in chat.
**Alternate paths**: (a) Open the Legal agent thread and attach a Data room item (`threads/send` accepts `dataRoomItemIds`; no picker is drawn). (b) From Legal, tap a contract and "Ask Legal agent" with the contract's Data room link. (c) Ask in Data room agent chat to forward the file.
**Design source**: `PG-B-DataRoom.dc.html`, `PG-B-Rules.dc.html` Data room card. Attaching a Data room item in the composer: NO BOARD.

#### Steps
1. Open Data room and search "lease" → matching file row.
2. Tap "Ask Data room agent" → Data room agent thread opens.
3. Type "Ask the Legal agent to check the renewal terms in the Office lease renewal file" and send → message goes out with `dataRoomItemIds`; the agent hands off.
4. Message caption lists the file by name (as the Expo app already does through `splitDataRoomReferences`).

#### Variations
- Tap the file name in the caption: in Expo nothing opens; native should open the Data room item, not designed.

#### Edge Cases
- File still processing: whether the item can be referenced is not specified.
- User lacks access to another owner's item: chips never show other owners' items.

#### Design gaps
- No way to select a Data room file from a row (long-press, checkmark, or "Ask about this file").
- Composer attachment picker for Data room items does not exist on any board.
- Tapping a Data room reference inside a message has no destination.


### STORY-085: See the four pages on Duo, inner display and laptop pose
**Type**: long
**Topic**: Finance, Legal, Cap table and Data room
**Source**: topics/finance-legal.md STORY-008
**Phase issue**: #424 (P12), #419 (P7)
**Persona**: Isabel Moreno, founder with an iPhone Duo who reviews numbers in a half-open "laptop" posture
**Goal**: Use Finance, Legal, Cap table and Data room across the outer display, book view, half-folded and laptop pose without losing her place.
**Preconditions**: All four integrations connected; Duo device or simulator running the native app; iOS 27.1 Duo APIs available.
**Device**: iPhone Duo outer, inner flat, half-folded, laptop pose
**Ideal path**: 20 — outer-display check, unfold, use 1/3 + 2/3, half-fold, laptop pose.
**Alternate paths**: (a) Stay on one pose. (b) Standard iPhone: top bar only, same pages in a single column (STORY-078 to STORY-083).
**Design source**: `PG-B-Rules.dc.html` rule cards for the four pages (Inner book, Half-folded, Laptop pose), `Inner.dc.html`, `Split.dc.html`, `Desk.dc.html` (Finance laptop desk pose), `PG-B-*.dc.html`. Inner/half-folded layouts for Legal, Cap table, Data room beyond the rule text: NO BOARD (only Finance has a laptop board).

#### Steps
1. On the outer display (466x678 pt), open Finance → single column with period tabs, KPIs, burn chart, Accounts, Upcoming.
2. Tap the eye to hide amounts → masked.
3. Unfold to the inner display held as a book (890x626 pt) → page becomes 1/3 + 2/3: the left third shows Finance sections "Overview, Accounts, Burn, Spend", the right two thirds shows the selected section.
4. Tap "Burn" in the left list → right pane shows the burn chart; Hide amounts is still on.
5. Fold halfway (flat to half-folded) → 1/3 + 2/3 snaps to 1/2 + 1/2: Overview on the left, chart and detail on the right.
6. Rotate to laptop pose (626x890 pt, fold at y 435 to 455) → burn chart on the top half; period tabs, accounts and "Ask Finance agent" on the bottom half. Desk board shows the Finance agent composer "Message Finance agent" below the fold.
7. Open Legal → inner: contract list 1/3, contract detail (parties, dates, deadlines) 2/3.
8. Tap "Office lease renewal" → detail pane shows the lease; laptop pose puts a document preview on top and status and actions on bottom.
9. Open Cap table → holder list 1/3, holder detail (shares, contact) 2/3; laptop pose puts the ownership ring on top and holders list below.
10. Tap "Ana Ruiz" → holder detail.
11. Open Data room → folder tree 1/3, folder contents 2/3; laptop pose puts a file preview on top and the list and Add files below.
12. Tap "Board materials" → contents in the right pane.
13. Tap the plus → system file picker; sheets stay in the content area and never cross the fold.
14. Pick a file → upload row appears in the contents pane.
15. Tap "Ask Data room agent" → Data room agent thread; on inner, the thread opens in the third column (Personnel in the third).
16. Fold back to the outer display with the agent thread open → state restoration (see gaps).
17. Return to the Home outer display via Back.
18. Reopen Finance → hidden-amounts setting persists.
19. Tap a push notification for the Legal agent ("2 deadlines due this week") → opens the agent thread (bot wins), not the Legal page.
20. Switch spaces → all four pages reload for the new space.

#### Variations
- Marked applicable for laptop pose: Finance, Legal, Cap table, Data room (all four).
- Half-folded for Cap table is not stated in the rule card text I read (the line was cut); treat as undefined.

#### Edge Cases
- Selection and scroll position across posture changes: README says not specified.
- Fold crossing a sheet or file picker mid-upload.
- Duo APIs sit behind `if #available(iOS 27.1, *)`; older iPhones get the standard column.
- Left list "Spend" section name versus the outer page "Upcoming" (see STORY-078).

#### Design gaps
- Only Finance has a laptop board (`Desk.dc.html`). Legal, Cap table and Data room inner/half/laptop layouts exist only as rule-card text, with no mockups.
- Selection and scroll preservation across posture changes.
- Finance "Spend" and "Burn" sections are listed for the inner view but the outer page has a single scroll with no equivalent split.
- Where Ask [page] agent lives in the inner and laptop layouts (outer: prominent bubble in the top bar).
- Where the four pages are reached on the inner display; the inner sidebar board would need rows for them.


### STORY-086: Sidebar glance and badges lead to the right page
**Type**: short
**Topic**: Finance, Legal, Cap table and Data room
**Source**: topics/finance-legal.md STORY-009
**Phase issue**: #424 (P12), #415 (P3)
**Persona**: Colm Brady, founder who checks the app a few times a day
**Goal**: Notice from Home that a legal deadline is near and runway has changed, then open the page.
**Preconditions**: `notifications.glance` returns `financeRunwayMonths`, `legalDueSoon` (2), `dataRoomWaiting`.
**Device**: standard iPhone
**Ideal path**: 3 — open Home, spot the Legal glance, tap through to Legal.
**Alternate paths**: (a) Tap the "Legal agent" Personnel row ("2 deadlines due this week") to land in the chat instead. (b) Tap the push notification. (c) Open Legal from a sidebar row (the rule card says this, but no row is drawn).
**Design source**: `PG-A-Home.dc.html`, `Main.dc.html` (Personnel rows), `PG-B-Rules.dc.html` (Presentation). Glance badges and the sidebar rows for the four pages: NO BOARD.

#### Steps
1. Open the app to Home → Personnel list shows "Finance agent: Runway summary for the last 30 days", "Legal agent: 2 deadlines due this week", "Carta agent", "Mercury agent", "Brex agent: 4 card expenses need receipts".
2. Look for the glance (runway months, deadlines due, items waiting) → NO BOARD shows these beside page rows.
3. Tap the Legal entry → either the Legal agent chat or the Legal page, depending on which entry exists.

#### Variations
- Data room "waiting" count after an upload (`dataRoomWaiting`) points at items still processing.

#### Edge Cases
- `glance` values null: nothing shown.
- Two entries for one concept (a Personnel agent row and a page row) could duplicate each other for Finance, Legal and Cap table.

#### Design gaps
- The page rows and glance values the API provides (`notifications.glance`) have no drawn home. This is the biggest gap in the topic.
- Whether the rows are always visible or added by the user (`sidebarPages` add/remove exists but only the "team-health" template is defined, and it is `available: false` and web/desktop only).
- Duplication between the agent row and the page row for the same capability.



## Topic: UX stories: Settings, models, voice and integrations

Source file: `docs/ios-native/ux/topics/settings.md`

### STORY-087: Open Settings and read the current state
**Type**: short
**Topic**: Settings, models, voice and integrations
**Source**: topics/settings.md STORY-001
**Phase issue**: #421 (P9)
**Persona**: Priya Nair, solo founder using a standard iPhone
**Goal**: Find out which model and voice her agents currently use.
**Preconditions**: Signed in, one space, a hosted model connected, voice on the device voice.
**Device**: standard iPhone
**Ideal path**: 3 — tap the profile in the sidebar, read the values on the list, tap "Done".
**Alternate paths**: Opening the Account row instead of the profile row (the board draws both "Sam Rivera" profile row and an "Account" row; see Design gaps). Deep link from the Legal page "Add your OpenRouter key", which opens Models directly (not Settings root).
**Design source**: PG-B-Settings, rule card "Settings" (steps 1-3). The sidebar profile entry point is described in the rule card text only; the Home board does not draw it as a labeled control.

#### Steps
1. Tap the profile at the bottom of the sidebar → Settings opens as a sheet with large title "Settings", the profile row "Sam Rivera", then "Account", "Models", "Voice", "Integrations", "AI data sharing", "Archived bots", "Change password".
2. Read the row values → Models shows the default model name ("Model A"), Voice shows "Device", Integrations shows a connected count. Rows show no value until it loads, then the value appears without moving the row.
3. Tap "Done" → the sheet closes and Home is visible again.

#### Variations
- Inner display (890x626 pt): the settings list sits in the 1/3 column with the selected row filled, the detail fills the 2/3 column. Half-folded: list left, detail right, each scrolls alone. Outer display: "Done" is in the left strip group.
- Laptop pose: not applicable, stays one full-height column.

#### Edge Cases
- Values slow to load: rows render with no value first (rule card says so).
- Older self-hosted server returns 404 on a newer procedure: the value stays empty. No board shows how the row should look.
- Signed-out session ends while the sheet is open (401): the app returns to Sign in; the sheet is dismissed.

#### Design gaps
- Entry point: "sidebar profile" is the only entry in the rule card, but the outer Home board (strip with Activity, Search, Artifacts) does not draw a profile control. The standard-iPhone entry is not drawn either.
- The Settings board has both a profile row and an "Account" row. The rule card says sign-out and delete account "live on the profile detail (Account)". It is unclear whether the two rows open the same page.
- Expo `account.tsx` also holds Language, Appearance, Avatar style, Hide amounts, Notifications, Phone notifications, Usage and Live update settings. None of these are on the Settings board or the Account description. Hide amounts is explicitly a device-only setting in the plan; its home in the native app is undefined.
- The "Integrations" count value "[N]" is a placeholder; what N counts (connected apps, accounts) is not stated.


### STORY-088: Change the default model and thinking level
**Type**: medium
**Topic**: Settings, models, voice and integrations
**Source**: topics/settings.md STORY-002
**Phase issue**: #421 (P9)
**Persona**: Marcus Webb, founder of a three-person dev-tools startup
**Goal**: Switch all agents to a cheaper model and lower the thinking level.
**Preconditions**: A hosted provider is already connected ("Hosted provider" shows "Connected"); default model "Model A", thinking "Default (Medium)".
**Device**: standard iPhone
**Ideal path**: 6 — Settings, Models, tap Model, pick model, tap Thinking, pick level.
**Alternate paths**: Per-bot model and thinking level in bot settings (#415, `PG-B-BotSettings`) overrides the default for one bot. Entry from a thread's "Connect a model to start a run" message (no board).
**Design source**: PG-B-Settings (list), PG-B-Models rule card "Models" (Default model section: "Model", "Thinking"; picker as a menu per the Components line "Overlays (pickers as menus)").

#### Steps
1. Open Settings and tap "Models" → Models pushes inside the sheet with sections "Default model", "Providers", "Add a server".
2. Tap the "Model" row under "Default model" → a menu lists models of connected providers with a check on "Model A".
3. Choose a different model ("Model B") → green line "Now using Model B." appears under the section (Expo text: "Model updated." / "Now using {label}."); the row value changes.
4. Tap the "Thinking" row, currently "Default (Medium)" → a menu lists levels valid for the chosen model (Expo: Minimal, Low, Medium, High, Extra high, Max, filtered per model).
5. Choose "Low" → the row shows "Low"; no save button is needed, each change is saved at once.
6. Tap Back (chevron.left) → Settings list shows the new Models value "Model B".

#### Variations
- Choose a model that has no thinking support: the "Thinking" row is hidden or disabled (Expo clamps the level to the model's allowed levels). No board shows this.
- Inner display: Models renders in the 2/3 column while the list stays in the 1/3 column; the back button is not needed.

#### Edge Cases
- Save fails (offline or server error): Expo shows "Could not change the default model". The red line exists in the error pattern but the Models board draws only the success and unreachable lines.
- Space switched while the page is open: Expo shows "Space changed. Reload Models before saving backups." for backups; the native equivalent for the default model is undefined.
- Deployment-fixed default: Expo labels "Deployment default" and "Configured by deployment"; no board shows a read-only default row.

#### Design gaps
- Backup models ("Backup models", reorder, "Save backups", max 10) exist in Expo and the API (`models.backups`, `models.setBackups`) but not on the board. This is a whole feature without a native design.
- Embedding model and "auto file email" (`models.embeddingModel`, `models.setAutoFileEmail`) are in the API and not in either client list.
- The "Thinking" disabled/hidden state for non-reasoning models is not drawn.


### STORY-089: Connect a hosted model provider with an API key (first run)
**Type**: medium
**Topic**: Settings, models, voice and integrations
**Source**: topics/settings.md STORY-003
**Phase issue**: #421 (P9), #415 (P3)
**Persona**: Hana Ito, new founder who just signed in and has no model connected
**Goal**: Make her first agent run work by connecting a provider.
**Preconditions**: New account, `me.needsModel` is true, no provider connected.
**Device**: standard iPhone
**Ideal path**: 8 — Settings, Models, tap provider, enter key, Connect, check default.
**Alternate paths**: Subscription sign-in ("Subscription sign-in", Safari round trip with a code); OpenRouter OAuth (`models.beginOpenRouterOAuth`); a thread's blocker message "Connect a model to start a run" taking her straight to Models (no board); Legal page "Add your OpenRouter key" taking her to Models.
**Design source**: PG-B-Models rule card (Providers list rows "Hosted provider" Connected, "Local server", "Subscription sign-in" Not connected). The key-entry form: NO BOARD.

#### Steps
1. Tap "Models" in Settings → Providers shows "Hosted provider", "Local server", "Subscription sign-in", each with a status ("Connected" or "Not connected"). Default model section has nothing to pick.
2. Tap "Hosted provider" → a provider detail with an "API key" field and a connect button appears (NO BOARD; Expo labels: "API key", "Connect API key", placeholder "sk-…").
3. Paste the key → the key is shown masked with a show/hide control.
4. Tap "Connect API key" → spinner, then "Connected and using Model A." (Expo text "Connected and using {label}.") and the row status becomes "Connected".
5. Go back to Models → "Model" row now shows "Model A" and "Thinking" shows "Default (Medium)".
6. Tap "Done" → Home loads; the thread blocker no longer appears.

#### Variations
- Wrong key: Expo "Could not connect this provider" in red under the form; the field keeps the value.
- Provider can use the server's own credentials: Expo text "Uses this server's own {source} credentials to access {provider}." and an optional "Use your own key" action.

#### Edge Cases
- App backgrounded while pasting from a password manager: the field must keep text (not stated).
- Key must never be logged or stored on the device beyond the request; the API stores it server side (`models.connect`).
- Disconnecting later: Expo alert "Disconnect {name}?" with "This removes the connection from every space." and actions Cancel/Disconnect. No board.

#### Design gaps
- NO BOARD for the provider detail (API key form, show/hide, "Use your own key", "Replace API key", "Disconnect").
- NO BOARD for the subscription sign-in page ("Finish signing in in your browser:", code copy, "Paste its URL or code here", "Waiting for sign-in — the code expires in about {minutes} minutes.").
- The board shows three provider rows only; Expo has a featured list, "Show more" and "All providers" (many providers). The native provider list for more than three providers is undefined.
- The first-run route from `needsModel` to this page is not drawn (see also the sign-in topic).


### STORY-090: Add a local model server and find its models
**Type**: medium
**Topic**: Settings, models, voice and integrations
**Source**: topics/settings.md STORY-004
**Phase issue**: #421 (P9)
**Persona**: Tomas Lindgren, privacy-minded founder running a model on his Mac mini
**Goal**: Point Praci at `http://192.0.2.10:8000/v1` and use one of its models as the default.
**Preconditions**: Signed in; his server is on the same network (or Tailscale) and allowed by the app's network rules; no local server saved.
**Device**: standard iPhone
**Ideal path**: 7 — Models, Add a server, type URL, Find models, pick model, confirm.
**Alternate paths**: Edit the existing "Local server" row (shows its URL, "http://127.0.0.1:8000/v1" on the board). Type the model name manually after "Server found. Enter a model name." when the server does not list models.
**Design source**: PG-B-Models rule card ("Add a server", "Find models" row with spinner, "Found 3 models.", "No matching models", red unreachable line, green "Now using Model A"). Fields beyond URL: NO BOARD.

#### Steps
1. In Models tap "Add a server" → fields appear for the server URL (Expo label "OpenAI-compatible server URL", placeholder `http://127.0.0.1:8000/v1`) and a "Find models" row.
2. Type the URL → the row "Find models" becomes enabled.
3. Tap "Find models" → the row shows a spinner ("Finding…").
4. Result arrives → "Found 3 models." with a picker listing the models ("Use a found model").
5. Pick a model → it is selected as the connection's model.
6. Tap the save control → "Connected and using Model C." and "Local server" shows the URL under it.
7. Check "Default model" → "Model" row shows the local model.

#### Variations
- Server listing returns no usable model: "Server found. Enter a model name." with a text field (Expo placeholder "exact-model-id", "Other model…").
- Advanced settings in Expo: "Supports thinking", "Supports images", "Context limit", "Maximum output tokens", "Maximum images per request", "Save limits". The board shows none of these.
- Search within a long result list: Expo shows "Search models" for more than 10 results; the board shows "No matching models" only.

#### Edge Cases
- Server unreachable: red line "Could not reach this model server", the typed URL stays.
- Wrong scheme such as plain `http` to a public host: the app's scheme rule (https, or http only for loopback, `.local`, private and Tailscale) should refuse it; the message is undefined.
- On a real iPhone, `127.0.0.1` points at the phone itself, not his Mac. The board's example URL would fail on device unless the server runs elsewhere. The server also needs iOS local network permission (a system prompt); neither is designed.
- Does the phone or the Praci server call the model server? The Expo flow calls the Praci server (`models.probeOpenAiCompatible`), so a LAN address might be unreachable from a hosted Praci server. No explanation is drawn.

#### Design gaps
- NO BOARD for the advanced limits fields, the model picker for found models, or the manual model name state.
- "Add a server" vs. the existing row "Local server" with a URL: when one is saved, whether "Add a server" is still shown and how a second server is added is not drawn.
- Local network permission prompt and the loopback caveat are undocumented.


### STORY-091: Turn on the device voice and play a sample
**Type**: short
**Topic**: Settings, models, voice and integrations
**Source**: topics/settings.md STORY-005
**Phase issue**: #423 (P11), #421 (P9)
**Persona**: Aisha Karim, founder who dictates replies while walking
**Goal**: Make agents read replies aloud using the free on-device voice.
**Preconditions**: No voice provider connected.
**Device**: standard iPhone
**Ideal path**: 4 — Settings, Voice, switch on "Use this device voice", tap "Hear a sample".
**Alternate paths**: Per-bot "device voice" flag in bot settings (#415, `PG-B-BotSettings`; a "voice flag"). In a thread, the voice player reads one message (DS-06). Calls (DS-07 "Calls", NO BOARD for a call screen).
**Design source**: PG-B-Voice rule card (sections "This device", "Voice provider", "Sounds"; prominent "Hear a sample" play button).

#### Steps
1. Tap "Voice" in Settings → Voice page with the sections "This device", "Voice provider", "Sounds"; the toolbar shows the prominent "Hear a sample" (play) button.
2. Switch on "Use this device voice" → the row reads "On · Free, works offline" and the helper "Your phone's built-in voice. Free, no account needed" appears (Expo text).
3. Tap "Hear a sample" → the phone speaks "Hi, this is how I'll sound when I read replies out loud."
4. Tap Back → Settings shows Voice value "Device".

#### Variations
- Standard iPhone: the prominent button is in the trailing group of the top bar. Outer display: it is the last, prominent button in the strip and collapses last. Inner: the page sits in the 2/3 column.
- Silent switch on: playback should still be heard or the user should be told (not specified).

#### Edge Cases
- Playback fails: red line "Could not play a sample".
- Switch change fails: Expo shows "Could not save that preference".
- Voice needs AI data consent for `voice` (see STORY-094) before a provider voice is used; the device voice needs none.

#### Design gaps
- Dictation (the 1.2 s silence endpointer) needs microphone and speech-recognition permission prompts. No board shows the permission request or the denied state.
- The "Sounds" section ("Call sounds", "Waiting sound") is drawn without describing its control types or the sound choices.
- The device voice choice (which iOS voice) is not offered; Expo does not offer it either. Not found to be required.


### STORY-092: Connect a hosted voice provider and pick a speech model
**Type**: medium
**Topic**: Settings, models, voice and integrations
**Source**: topics/settings.md STORY-006
**Phase issue**: #423 (P11), #421 (P9)
**Persona**: Leo Fontaine, founder who wants better voices for investor-update calls
**Goal**: Replace the device voice with a hosted voice and choose a speech model.
**Preconditions**: A voice provider catalog is available; no voice credential saved; AI data consent for voice not yet given.
**Device**: standard iPhone
**Ideal path**: 7 — Voice, key field, Connect, speech model, voice, sample, back.
**Alternate paths**: Skip the speech model (it is "Optional"). Disconnect the provider later with "Disconnect".
**Design source**: PG-B-Voice rule card. Not-connected state: "provider group shows only the key field and Connect" (described, field itself not on the drawn board). Voice picker: NO BOARD.

#### Steps
1. Open Settings > Voice → "Voice provider" group shows the hosted provider with only a key field and "Connect" (not connected state).
2. Paste the key in "Paste your API key" and tap "Connect" → spinner, then the group shows "Hosted voice", "Connected · Speak + transcribe".
3. Tap "Speech model" (value "Optional") → a picker of models; choose one → value updates (Expo error "Could not save that speech model").
4. Choose a voice for replies (Expo has a voice list from `voice.voices`) → saved at once.
5. Tap "Hear a sample" → the chosen voice speaks. If AI data consent for voice is missing, the call fails with "Review AI data sharing in Account settings before continuing." (see STORY-094).
6. Switch "Use this device voice" off → replies use the hosted voice.

#### Variations
- Replace key: Expo shows "Replace key" and "Paste a replacement key".
- Disconnect: "Disconnect" with "Disconnecting…" then the group returns to the key field only.
- Providers that only speak ("Speak only") vs. speak and transcribe ("Speak + transcribe"): the second also handles dictation fallback upload.

#### Edge Cases
- Wrong key: Expo "Could not connect".
- Pressing "Hear a sample" with nothing connected and the device voice off: Expo says "Connect a voice provider first." (not on the board).
- Load failure: Expo "Could not load voice settings".

#### Design gaps
- NO BOARD for the voice picker, the voice-list state, or the speech model picker contents.
- The consent check before the first hosted voice use is not designed (the sample button simply errors on older servers). The client should check `aiDataUsesForProcedure` first (discovery notes).
- Where a bot's own "device voice" flag (bot settings) interacts with this global switch is not stated.


### STORY-093: Connect Calendar from the integrations catalog (Safari round trip)
**Type**: long
**Topic**: Settings, models, voice and integrations
**Source**: topics/settings.md STORY-007
**Phase issue**: #421 (P9)
**Persona**: Dana Okafor, founder who wants her Inbox agent to see her meetings
**Goal**: Add the Calendar connector so agents can read her schedule.
**Preconditions**: Signed in; the Mail connector is already "Added"; Calendar is under "Available"; the server has Composio or Direct MCP credentials configured.
**Device**: standard iPhone
**Ideal path**: 9 — Settings, Integrations, search or scroll, tap "Add", finish in Safari, return, confirm the row moves to Connected.
**Alternate paths**: Search apps to find Calendar; "Show more" to see the rest of the catalog; Add from the agent side: a chat card "app_connect" is flipped to connected after authorization (`mcp.oauth` and card flow, DS-06 partly); MCP OAuth is web only so MCP servers are not offered. Connect from the Calendar-aware agent page (NO BOARD).
**Design source**: PG-B-Integrations rule card "Integrations" (rows "Connected" and "Available", letter tiles "M", "C", "D", "B", "T", "Show more", "Advanced"; "Connect pending: alert to finish in browser, then refresh").

#### Steps
1. Settings > "Integrations" → catalog shows search, "Connected" (Mail connector "Added", Calendar connector "Added" are drawn as the connected state; for this story assume Calendar is not yet added), "Available" (Documents connector, Banking connector, Tickets connector each with "Add"), "Show more", "Advanced".
2. Tap into the search field and type "calendar" → the list filters. If nothing matches the page shows "No apps match your search."
3. Tap "Add" next to "Calendar connector" → the row shows a working indicator ("Working…").
4. Safari opens at the provider's authorization page → the user signs in and approves access.
5. Return to Praci (by the app switcher or the redirect) → the app polls `connections.complete` every 2 s while Safari is open.
6. Poll sees "connected" → the Calendar row moves to "Connected" with "Added", the tool count appears (Expo "{count} tools"), and a notice is posted to the agent chat that the app was connected.
7. Tap the Calendar row → detail with accounts and tools (inner board: "app detail (accounts, tools) replaces catalog on tap").
8. Optionally tap "Add another Calendar connector" to connect a second account (Expo "Add another {name}") → the same Safari loop; the row name becomes "Calendar 2".
9. Tap Back → the Settings list shows the Integrations count increased by one.

#### Variations
- Standard iPhone: Back is in the top bar. Inner display: the catalog is in the 2/3 column and the app detail replaces it. Half-folded: catalog left, selected app right.
- The user never completes Safari: after about 90 s of polling (45 tries) Expo shows an alert "Connection pending" with "Finish connecting in the browser, then refresh this page." The user can pull to refresh.
- Reconnect an expired account: Expo shows "Reconnect" (API: `connections.begin` with `reconnect`).
- Rename or remove an account: Expo has "Could not rename connection" and "Remove {name}" / "Could not revoke connection". No board for rename or remove.

#### Edge Cases
- Catalog load failure: message with "Retry" (rule card).
- The Safari sign-in fails or is cancelled: the poll never succeeds; the pending alert is the only feedback. Whether the app returns via a universal link or the user switches back by hand is not specified.
- Revoking an account used by agents: `connections.effectiveAccess` shows which agents lose access; no confirmation is drawn.
- Writes are off by default for connected apps (`connections.setWrites`); no setting for it exists on the board.
- Older self-hosted server without `connections.*`: 404 means "not supported"; no board.

#### Design gaps
- NO BOARD for the app detail page (accounts, tools, access per agent, writes toggle, remove). The inner rule card describes it in words only.
- NO BOARD for the "Connection pending" alert's wording or the in-row pending state; the polling stops after the app leaves the page (Expo aborts on blur), which the native app must decide.
- "Show more" and search: the board does not show the search field or the expanded list.
- Safari round trip: return path (callback scheme) is not described for connections; only sign in uses `rakazo://sign-in`.
- The same information (connected apps) appears on the Settings list value, the Integrations page, and in agent chats (app_connect card, DS-06). The rendering of the app_connect card is not defined.


### STORY-094: Review and withdraw AI data sharing, then recover a blocked run
**Type**: medium
**Topic**: Settings, models, voice and integrations
**Source**: topics/settings.md STORY-008
**Phase issue**: #421 (P9)
**Persona**: Rosa Delgado, careful founder with customer data in her data room
**Goal**: See which AI services receive data, withdraw one, and understand a blocked action.
**Preconditions**: Some permissions granted earlier; the data room agent is in use.
**Device**: standard iPhone
**Ideal path**: 5 — Settings, AI data sharing, switch off one service, confirm, Back.
**Alternate paths**: Accept the prompt shown when an action needs consent (NO BOARD, #417); Data room and Legal pages call `consent` and `consentGrant` themselves (their own consent state in #424); "Withdraw all permissions" for a single reset.
**Design source**: Only the Settings row "AI data sharing" (PG-B-Settings). The page and the in-flow prompt: NO BOARD.

#### Steps
1. Tap "AI data sharing" in Settings → page lists services that receive data (Expo groups: "AI models", "Memory", "Voice", and recipients such as "Praci"), each with an "Allow {name} on mobile" switch, plus "Privacy policies" and "Withdraw all permissions".
2. Switch off "Allow Voice on mobile" → the switch turns off at once (`aiConsent.revoke`).
3. Open Voice and tap "Hear a sample" (hosted voice) → fails with "Review AI data sharing in Account settings before continuing."
4. Return to AI data sharing and switch it back on → allowed (`aiConsent.allow`).
5. Tap "Withdraw all permissions" → alert "Withdraw all permissions?" with Cancel and "Withdraw"; Cancel leaves everything as is.

#### Variations
- Native prompt before an AI data use (the discovery notes list this as required in phase 5): a card or sheet offering Allow or Not now, with the same recipient names. Not designed.
- Space-scoped vs. account-scoped consent is not stated.

#### Edge Cases
- Load failure: Expo "Could not load permissions." with "Retry". Empty: "No AI services configured."
- Consent change in flight when the sheet is dismissed: unspecified.

#### Design gaps
- NO BOARD for the AI data sharing page and for the consent prompt in the thread/composer; only a row exists.
- Error text uses "Account settings" while the row is under Settings > "AI data sharing"; the label mismatch (and the Account page not listing it in the board) may send a user to the wrong page.
- Expo `account.tsx` also carries an "AI data sharing" row, so the page is reachable from two places in Expo; the board shows only the root row.


### STORY-095: Change a password and restore an archived bot
**Type**: medium
**Topic**: Settings, models, voice and integrations
**Source**: topics/settings.md STORY-009
**Phase issue**: #421 (P9)
**Persona**: Ben Achterberg, operator who archived a bot and now needs it back
**Goal**: Rotate his password, then bring back the archived "Ledger" bot.
**Preconditions**: Password sign-in account (not SSO only); one archived bot.
**Device**: standard iPhone
**Ideal path**: 10 — Change password (5 steps), then Archived bots (4 steps) and Back.
**Alternate paths**: Forgot password from Sign in (mail link) instead of changing it; SSO users use "Link SSO" (Expo account only); restore from bot settings (#415) while the bot is archived (NO BOARD for the archive state); restore from Home sections (archived bots do not appear there).
**Design source**: Rows only in PG-B-Settings ("Archived bots", "Change password"). Pages: NO BOARD.

#### Steps
1. Tap "Change password" → form with "Current password", "New password", "Confirm password" (Expo labels), Save disabled until all are filled.
2. Fill the fields and mistype confirmation → inline "Passwords do not match".
3. Fix it and tap save → saved; the user stays signed in (other sessions are not described).
4. Return to Settings, tap "Archived bots" → list of archived bots (Expo loads `bots/listArchived`); empty state "No archived bots".
5. Tap "Ledger" → the bot detail opens (Expo opens the thread after `threads/get`); the restore action is offered.
6. Restore it → the bot returns to Personnel on Home.

#### Variations
- Wrong current password: Expo "Could not change password" under the form.
- Restore fails: "Could not restore bot" with "Try again."; load fails: "Could not load bots".

#### Edge Cases
- SSO-only account has no password: whether the row is hidden or disabled is not drawn.
- Restoring a bot while offline: not specified.
- Archived bot belongs to another space: not specified.

#### Design gaps
- NO BOARD for Change password, Archived bots list, its empty state, or the restore confirmation.
- Password rules (Expo requires 8 characters at sign up) are not given for the change form.
- Where restore happens (list row action, swipe, or bot detail) is undefined.


### STORY-097: Set up server credentials for an integration provider (Advanced)
**Type**: medium
**Topic**: Settings, models, voice and integrations
**Source**: topics/settings.md STORY-011
**Phase issue**: #421 (P9)
**Persona**: Ines Moreau, founder who runs her own Praci server
**Goal**: Give her server Composio credentials so the catalog can connect apps.
**Preconditions**: Self-hosted server with no provider credentials; Ines is the server owner.
**Device**: standard iPhone
**Ideal path**: 8 — Integrations, Advanced, choose method, credentials, Continue, back to catalog.
**Alternate paths**: Skip (xmark) to leave setup; the web app for Direct MCP OAuth (Expo "Finish MCP authorization in the web app." and "Open web app"); Executor setup is web only ("Set up Executor on your server in the web app.").
**Design source**: PG-B-Integrations rule card (setup: "Skip (xmark), Continue prominent", segmented method, "Get credentials", error "Could not verify or save these credentials").

#### Steps
1. In Integrations scroll to the bottom and tap "Advanced" → a sheet "Server integrations" opens with a "Method" segmented control "Composio | Direct MCP".
2. Select "Composio" → a Credentials section appears with a key field and "Get credentials" (opens the provider site in Safari).
3. Tap "Get credentials" → Safari opens the provider's key page; user copies the key and returns.
4. Paste the key into the field.
5. Tap "Continue" (prominent) → spinner, the server verifies and saves (`integrationSetup.save`).
6. Success → sheet closes and the catalog loads with the apps.
7. Tap "Skip" next time to leave without saving.

#### Variations
- Choose "Direct MCP": fields "Client ID", "Client secret", "Project ID" (Expo) and a note that authorization finishes in the web app.
- A non-owner member: Expo "Ask the server owner to configure this provider."

#### Edge Cases
- Bad credentials: inline red "Could not verify or save these credentials"; the fields keep their values; "Continue" stays enabled.
- Secret values must never appear in logs or screenshots; the fields should be secure.
- Catalog failure afterwards: "Could not load integrations" with Retry.

#### Design gaps
- The role check (owner vs. member) and its read-only state are not on the board.
- Direct MCP fields beyond the drawn "Credentials" section are not shown; the board draws one generic credentials field.
- It is not stated whether the setup sheet appears automatically the first time on a server with no provider, or only via "Advanced".
- Medium sheet vs. the rule card's "Advanced pushes setup as a sheet": the detent is not specified.



## Topic: Stories: iPhone Duo and device adaptation

Source file: `docs/ios-native/ux/topics/duo-adaptation.md`

### STORY-098: Open an agent from Home on the outer display and approve a request
**Type**: short
**Topic**: iPhone Duo and device adaptation
**Source**: topics/duo-adaptation.md STORY-001
**Phase issue**: #419 (P7), #417 (P5)
**Persona**: Maya Okafor, solo founder checking in between meetings
**Goal**: Read the Finance agent's latest message and allow a pending action without unfolding the phone.
**Preconditions**: Signed in, space selected, Finance agent has a message with an approval card pending. Phone closed, outer display (466x678).
**Device**: iPhone Duo outer
**Ideal path**: 3 — tap the agent row, scroll to the approval card, tap Allow. No other control is needed.
**Alternate paths**: (a) Home Activity (bell icon with a dot) opens the "needs approval" item and lands in the same thread. (b) Tap the push notification, which lands in the thread directly (phase 10). (c) Home search (magnifier) then the agent.
**Design source**: Home: `Main.dc.html`, PG-A-Rules > Home. Thread: PG-A-Rules > Agent thread (`PG-A-Thread.dc.html` for the approval card). Activity list: NO BOARD for the Activity screen itself (only the icon and its dot are defined).

#### Steps
1. On Home, find "Finance agent" under PERSONNEL (preview "Runway summary for the last 30 days", time "Yesterday") and tap the row. → Thread opens. The 60 pt strip stays; the content column pushes in. A Back group fades in at the top of the strip.
2. Read the glass title capsule and the latest message. → Messages are bottom-aligned; the composer floats 12 pt above the bottom.
3. Tap "Allow" on the approval card. → "Allow" is the one prominent control on this page. The run resumes (`run.waiting_input` to running); the card collapses to its resolved state.

#### Variations
- The approval card is taller than the visible column: it scrolls with the messages, and Allow stays inside the card, not the strip.
- The agent is an integration agent (Carta, Mercury, Brex): row shows a letter tile instead of a bot shape. Same flow.

#### Edge Cases
- A second tap on Allow after another device answered returns CONFLICT. The board set does not show how this is presented.
- Outbox: if the network drops while the thread is open, an inline "Failed to send message" with retry appears for sent text; approvals are not sent text, so the failure copy for Allow is undefined.

#### Design gaps
- The strip has no prominent button on the thread page (Back, Page, List, More only). Nothing tells the user the approval is waiting if the card is scrolled out of view; no "jump to approval" control exists.
- No board for the post-Allow resolved state or the CONFLICT case.
- Activity screen (opened from the Home strip) has NO BOARD; the dot is defined, the destination is not.


### STORY-099: Triage mail on the outer display, then ask the Inbox agent
**Type**: medium
**Topic**: iPhone Duo and device adaptation
**Source**: topics/duo-adaptation.md STORY-002
**Phase issue**: #419 (P7), #418 (P6)
**Persona**: Tomas Reyes, founder answering customers from a train
**Goal**: Open a reply-needed email, archive it, and ask the Inbox agent to draft a reply, using the vertical toolbar only.
**Preconditions**: Gmail connected, Inbox has 3 in "Needs reply". Outer display, full height.
**Device**: iPhone Duo outer
**Ideal path**: 5 — Home, Inbox row, message row, Ask Inbox agent, Send in the draft card.
**Alternate paths**: (a) Search mail (magnifier in the Inbox strip group) to find Ana's message, then open it. (b) Reply (arrow in the message strip) writes by hand instead of asking the agent. (c) Skip Home and open from a push tap (kind inbox, phase 10).
**Design source**: `Main.dc.html` (Inbox row), `Sheet.dc.html` (Inbox list), PG-A-Rules > Inbox and > Inbox message (`PG-A-InboxMessage.dc.html`), `Inner.dc.html` for the draft card ("Needs approval", Save, Send).

#### Steps
1. On Home, tap the "Inbox" row ("3 need reply", count "42"). → Inbox list opens with a 28 pt "Inbox" title. Sections "Needs reply" (3) and "Other mail today" (24).
2. Look at the strip. → Back, a group of Search mail / Filter / Compose, a spacer, and the prominent "Ask Inbox agent" (bubble.left) at the bottom. Aria labels on the board: "Search mail", "Filter", "Compose", "Ask Inbox agent".
3. Tap the row "Ana Ruiz — Re: Pilot timeline". → Message page: 22 pt subject, sender line, body 15 pt. Strip changes to Back, Archive / Reply, spacer, prominent "Ask Inbox agent".
4. Tap "Ask Inbox agent". → Opens the Inbox agent thread (pushed). Composer reads "Message Inbox agent".
5. Type or dictate "Reply to Ana: Thursday works, 10am." and send. → Agent shows "Here is a draft. I have not sent it." and a card "Re: Pilot timeline", "Needs approval", "To Ana Ruiz", with Save and Send.
6. Tap "Send". → Draft is sent after approval; card resolves. Message page later shows a Sent check beside the date.

#### Variations
- Tap Archive in step 3 first: row leaves "Needs reply"; Back returns to the list.
- Same information (inbox sections, draft card, the same message) is rendered on the outer display, inner book (`Inner.dc.html`, list beside the agent thread) and standard iPhone (large title with inline search).

#### Edge Cases
- Inbox empty: "Inbox zero" with the last sync time. Error: "Could not load mail." with retry.
- Message with an attachment over the size limit: row shows size and a disabled state.
- Unread dot is the only unread marker; no tinted rows.

#### Design gaps
- The Filter menu contents (and "Important only" shown on `Split.dc.html`) are not defined in Rules; only icon names exist.
- Compose screen has NO BOARD. Reply composer is described only as "Reply opens the composer under it" for half-folded.
- Search mail overlay appears in DS-03 (TOP HITS) but not as a page rule with empty/error states.
- Label mismatch: Expo uses `t("inbox")` / "Inbox"; the board "Ask Inbox agent" has no Expo equivalent string found in `apps/mobile/app/index.tsx`.


### STORY-100: Unfold to the inner display mid-task and keep working
**Type**: medium
**Topic**: iPhone Duo and device adaptation
**Source**: topics/duo-adaptation.md STORY-003
**Phase issue**: #419 (P7)
**Persona**: Priya Nair, founder reading a long thread then unfolding for room
**Goal**: Start in an agent thread on the outer display, unfold, and continue in the same thread beside Personnel.
**Preconditions**: Chief agent thread open on the outer display with a half-typed draft in the composer and scroll position mid-thread.
**Device**: iPhone Duo outer, then inner flat
**Ideal path**: 1 — unfold the phone; the app should arrive in the same thread with the Personnel list added as the 1/3 sidebar.
**Alternate paths**: Unfold and then navigate by tapping a Personnel row. Or open the app fresh on the inner display and choose the agent.
**Design source**: `Split.dc.html` (inner sidebar + list), `Inner.dc.html`, PG-A-Rules > Agent thread ("Sidebar third: Personnel list (extra level). Detail: the thread."), DS-03-Navigation "Flat, book hold, 890 x 626pt: one third + two thirds".

#### Steps
1. With the outer display showing the Chief thread, unfold the phone to book hold. → The inner display shows a 277 pt floating sidebar: "Search", "PERSONNEL" with "Chief", "Finance agent", "Carta agent", "Legal agent", and "Connect apps"; profile "Alex Morgan" at the bottom. The thread fills the 2/3 detail.
2. Check the thread content. → Same messages, same state, same copy as outer. The sidebar adds one hierarchy level.
3. Check the toolbar. → The side bar moves to the right edge as a vertical bar (Page, List, More). Nothing interactive in the fold zone x 435 to 455.
4. Tap "Finance agent" in the sidebar. → Only the right pane pushes; the sidebar keeps its selection ("Only the right pane pushes").

#### Variations
- Draft preservation: the half-typed message should survive the display change.
- If the user was on Inbox, the sidebar third shows folders and sections and the list sits beside the open message.

#### Edge Cases
- Display change while a run is streaming: the SSE subscription should continue or resume from the highest `seq`.
- Unfold while a sheet (New bot) is open: the sheet should re-center over the 2/3 pane at 420 pt width.

#### Design gaps
- Docs do not specify whether the app is relaunched or the scene changes when going outer to inner; draft text, scroll position, and the selected row survival are all unspecified (discovery.md "Duo posture changes").
- Which Personnel row is highlighted in the sidebar for a Group thread, or when the open page is Inbox, is shown only for Inbox (`Split.dc.html` filled "Inbox" row).
- Sidebar "Search" has NO BOARD for its results state.


### STORY-102: Hold the phone in laptop pose to watch the Team Computer and take control
**Type**: long
**Topic**: iPhone Duo and device adaptation
**Source**: topics/duo-adaptation.md STORY-005
**Phase issue**: #419 (P7), #420 (P8)
**Persona**: Devon Park, founder supervising an agent filing a form in a web portal
**Goal**: Watch the agent's screen on the top half, talk to the agent on the bottom half, take control to finish one step, then release.
**Preconditions**: Chief agent has a Team Computer session; a handoff ask is pending. Phone half-folded into laptop pose (626x890, fold at y 435 to 455). Standard portrait first.
**Device**: laptop pose
**Ideal path**: 4 — open computer from the agent menu, Take control, do the step, Release. The thread and key bar are already on the bottom half.
**Alternate paths**: (a) Tap a "computer" block inside the thread. (b) Use the handoff card's "I'm done" or "Skip" without taking control (the agent proceeds). (c) Use "Open in full window" (Expo label) in place of the pose.
**Design source**: `PG-A-Computer.dc.html`, PG-A-Rules > Computer ("Top half: the screen (watch). Bottom half: key bar, Release, thread composer. This is the main use of the pose."), DS-03-Navigation laptop pose section. Entry point: PG-A-Rules > Agent thread (More menu).

#### Steps
1. In the Chief thread, tap More (ellipsis) and choose "Open computer". → "Booting [name]" with a progress bar, then the live desktop.
2. Fold the phone into laptop pose. → Screen on the top half; controls on the bottom half as horizontal bars. Fold gap y 435 to 455 stays clear of the screen content.
3. Look at the overlays over the screen. → Clear Team/Private picker top-left, control chip top-right; clear glass with 35% dim.
4. Read the handoff card from the agent. → Card offers "Skip" and "I'm done".
5. Tap "Take control". → Prominent action changes to "Release" (lock.open); control chip says "You have control" (Expo copy); key bar appears.
6. Tap "Keyboard" (SF: keyboard) and type into the portal field. → Characters reach the remote screen; "Fit to screen" resizes the view.
7. Tap the Team/Private picker and choose "Private". → Screen URL is re-read for the private session; the picker shows the new mode.
8. Tap the Team/Private picker and choose "Team" again. → Screen reloads for the team session.
9. Tap "Fit to screen". → Remote screen scales to fit the top half.
10. Tap "Keyboard" again. → Key bar hides.
11. Tap "I'm done" on the handoff card. → Handoff recorded (`done`); the agent resumes and the card resolves.
12. Tap "Release" if still in control. → Back to watch mode; "Take control" returns as the prominent action.
13. Ask in the bottom composer "Is the form submitted?" → Agent replies in the bottom bar; the screen stays on top.
14. Unfold to book hold. → Layout changes to thread 1/3 + screen 2/3; the session continues without reconnecting (not specified; see gaps).
15. Fold back to laptop pose. → Screen top, controls bottom again.
16. Tap "Close" (xmark) in the strip or bar. → Computer closes; thread shows the "computer" block.

#### Variations
- Switch the Team/Private picker: the screen URL is re-read on each control change.
- Rotate to portrait while in control: the pose layout goes away; the thread should move into the sidebar third (inner) or behind a Back (outer). Not defined.
- Standard iPhone (393 pt): same screen and controls in the horizontal bar.
- The same Team Computer information (screen, control state) is shown on outer display (clear strip, thread not visible), inner flat (thread 1/3, screen 2/3), half-folded (1/2 + 1/2), and laptop pose.

#### Edge Cases
- Screen URL capability expires at 1 hour; renewal at 50 minutes should not reload the screen.
- Lease default 15 minutes: expiry while typing needs a visible state. Not on a board.
- Errors: "Could not open computer" with retry; "Could not load the desktop."; Expo adds "This device cannot reach the screen URL."
- Handoff ask answered from another device: CONFLICT.

#### Design gaps
- No board shows the computer page in laptop pose with real controls; `Desk.dc.html` is Finance only, and the Computer page card is text only.
- Lease expiry and the "Could not switch computer" error (Expo) have no designed state.
- "Open computer" is in the planned agent actions menu (PG-A-Rules > Agent thread: "settings, open computer, clear, archive, delete") but the Expo label is the same text, whereas the Computer strip uses "Close" and "Take control". Label match is fine; the entry from a thread's computer block has NO BOARD.
- Keyboard focus and the software keyboard in laptop pose (it would cover the bottom half) is undefined.
- How the 1/3 thread and composer behave for push to a different bot while a computer session is open is not defined.


### STORY-103: Review Finance in laptop pose and ask the Finance agent about a spike
**Type**: medium
**Topic**: iPhone Duo and device adaptation
**Source**: topics/duo-adaptation.md STORY-006
**Phase issue**: #419 (P7), #424 (P12)
**Persona**: Lena Haddad, founder reviewing monthly spend at a standing desk
**Goal**: See the burn chart on the top half and ask why one month jumped, on the bottom half, with amounts masked for a screen share.
**Preconditions**: Finance connected (Mercury or Brex); Finance has data. Laptop pose (626x890).
**Device**: laptop pose
**Ideal path**: 3 — open Finance from the sidebar, tap "Hide amounts" (optional), type the question in "Message Finance agent".
**Alternate paths**: (a) "Ask Finance agent" in the strip on outer display opens the thread instead. (b) From Home, open the Finance agent thread directly. (c) On inner flat, pick "Burn" in the 1/3 section list.
**Design source**: `Desk.dc.html` (laptop pose), PG-B-Rules > Finance, `PG-B-Finance.dc.html`, DS-03-Navigation laptop pose.

#### Steps
1. In the sidebar/Home, open "Finance" (meta "[N] mo"). → Finance page: period tabs, "Runway [N] mo", "Cash [AMOUNT]", "Monthly spend / Last 6 months" bar chart (May to Oct, Sep highlighted).
2. Tap "Hide amounts" (eye) in the horizontal bar. → Amounts show a mask; this is a device-only setting and also hides amounts in chat finance cards.
3. Tap the highlighted Sep bar or read the chart. → Chart detail is shown on the top half (tap behavior on bars is not defined).
4. In the bottom bar, tap "Message Finance agent" and type "Why did spend jump last month?". → The agent replies "Two annual renewals landed in the same month, [AMOUNT] together. Without them, spend was flat." in a compact thread above the composer.
5. Tap "Back". → Returns to Home; the pose is irrelevant there.

#### Variations
- Period tabs and Accounts list are on the bottom half in laptop pose (PG-B-Rules > Finance), so the composer shares the bottom half with them; only `Desk.dc.html` shows the composer and chart, not the accounts list.
- Standard iPhone: same page, horizontal toolbar, "Ask Finance agent" prominent at the bottom.
- Outer display: strip action group (eye, refresh), prominent "Ask Finance agent".

#### Edge Cases
- Not connected: empty state "No accounts yet" with "Add account".
- Error: red banner with Refresh; loading: skeleton KPIs.
- Non-USD accounts are left out of totals (discovery note); chart label is not defined for that.

#### Design gaps
- The Desk board shows a chat bubble pair in the bottom half, but PG-B-Rules says "period tabs, accounts and Ask controls on the bottom half". The two do not agree on where the agent reply goes and where Accounts go.
- Laptop pose with the keyboard open covers the bottom half; no layout shown.
- Hide amounts icon is placed in the bar on Desk but in the strip action group on outer; label "Hide amounts" is consistent.


### STORY-104: Create a new bot from the outer display and from the inner display
**Type**: medium
**Topic**: iPhone Duo and device adaptation
**Source**: topics/duo-adaptation.md STORY-007
**Phase issue**: #419 (P7), #415 (P3)
**Persona**: Isaac Brandt, founder adding a recruiting agent
**Goal**: Create a bot with the "New" menu; confirm the sheet never crosses the fold on the inner display.
**Preconditions**: Signed in; Home visible. Start outer, then repeat on inner flat and half-folded.
**Device**: iPhone Duo outer; inner flat; half-folded
**Ideal path**: 4 — New, New bot, type a name, Create.
**Alternate paths**: Home empty state "Tap + to create a bot" (Expo copy and PG-A-Rules > Home) goes straight to the same sheet. The same menu offers "New group" (push) and "New space" (medium sheet).
**Design source**: `Main.dc.html` (prominent New), PG-B-Rules > New bot (`PG-B-NewBot.dc.html`), > New group, > New space, DS-03-Navigation sheet header.

#### Steps
1. On Home (outer), tap the prominent "New" button at the bottom of the strip. → Menu: "New bot", "New group", "New space".
2. Tap "New bot". → A large-detent sheet appears in the content area beside the strip, radius 34, with a grabber. Strip shows Cancel (xmark) and prominent Create (checkmark).
3. Type a name. → "Create" enables only when Name has text.
4. Tap "Create". → Button shows "Creating"; sheet dismisses; the new bot appears in PERSONNEL.
5. Repeat on inner flat: tap the "Create" (plus) icon in the sidebar bar. → A 420 pt-wide sheet is centered over the dimmed 2/3 pane with Cancel top-left and the confirm button top-right.
6. Fold to half-folded while the sheet is open. → The sheet recenters in the right half and does not cross the fold.

#### Variations
- Dirty form: swipe down or Cancel asks before discarding.
- "New space" medium sheet: the detent grows with the keyboard; the sheet is smaller on inner (420 pt, small variant).
- "New group" is a push, not a sheet. Selecting 2 to 6 bots enables "Create group".

#### Edge Cases
- Error line in red above the actions; "Could not create bot" (Expo copy).
- New group with no bots: Members shows a muted line pointing to New bot.
- New space created but not opened: alert with "Try again" from the sidebar.

#### Design gaps
- The confirm label differs by board: strip uses "Create" (outer), the inner sheet shows "Done" in DS-03 sheet-header examples ("Cancel / New bot / Done"). The label for the same action differs between boards.
- The inner display's "Create" plus icon (aria-label "Create" on `Split.dc.html`) is a different label from the outer "New" prominent button.
- Sheet behavior at 466x420 (short outer height) is not drawn.


### STORY-105: Use a short outer display and recover hidden actions from More
**Type**: short
**Topic**: iPhone Duo and device adaptation
**Source**: topics/duo-adaptation.md STORY-008
**Phase issue**: #419 (P7)
**Persona**: Naomi Castellan, founder using the phone half-open on a table
**Goal**: Reach "Clear conversation" and "Archive" when the outer strip is only 420 pt tall.
**Preconditions**: Agent thread open; height reduced to 466x420.
**Device**: iPhone Duo outer (reduced height)
**Ideal path**: 2 — tap More, tap the item.
**Alternate paths**: Use the inner display, or the standard iPhone toolbar menu ("Bot actions", Expo label).
**Design source**: DS-03-Navigation "Reduced height, 466 x 420pt" and "COLLAPSE ORDER"; PG-A-Rules > Agent thread.

#### Steps
1. Open the Chief thread. → At 420 pt the strip cannot hold every group.
2. Observe the strip. → Items collapse bottom to top into More: last action in the actions group first; the prominent action collapses last (below about 300 pt). More stays pinned at the bottom.
3. Tap More. → Menu lists collapsed items plus agent actions: "Chat settings" (Expo label; the board says "settings"), "Open computer", "Clear conversation", "Archive", "Delete…".
4. Tap "Clear conversation". → Confirm alert with "Clear"; on confirm the thread empties.

#### Variations
- Page and List (doc.text, checklist) move into More first on a thread; on Inbox the Compose item collapses before Search mail.
- Each toolbar item needs an icon and a title so it can live in the menu.

#### Edge Cases
- Keyboard open on the outer display reduces height; the same collapse should apply.
- "Archive" failure shows "Could not archive bot" (Expo copy).

#### Design gaps
- Label mismatch: PG-A-Rules uses "settings" while Expo uses "Chat settings" and, for groups, "Group settings".
- The collapse order is described for one example (Inbox); the order for Agent thread, Computer and Finance is not listed.
- What happens to a prominent action that collapses (e.g., "Ask Inbox agent") on the Inbox is not shown.


### STORY-106: Tap a push notification while the phone is folded or unfolded
**Type**: medium
**Topic**: iPhone Duo and device adaptation
**Source**: topics/duo-adaptation.md STORY-009
**Phase issue**: #419 (P7), #422 (P10)
**Persona**: Rohan Mehta, founder away from the desk; a Legal agent notice arrives in a different space
**Goal**: Tap the notification and land in the right thread in the right space, on whichever display is active.
**Preconditions**: Two spaces ("Personal", "Northwind"); Northwind is not the selected space. APNs token registered (phase 10). App in background.
**Device**: iPhone Duo outer, then inner flat (variation)
**Ideal path**: 1 — tap the notification; the app switches space and opens the thread.
**Alternate paths**: Open the app, switch space from the sidebar, find the Legal agent row. Or use Home Activity.
**Design source**: NO BOARD for the notification itself. Landing screens: `Main.dc.html` Home, PG-A-Rules > Agent thread. Plan: `docs/ios-native/plan.md` phase 10; discovery "Push" transition.

#### Steps
1. A banner "Legal agent: 2 deadlines due this week" arrives (copy invented from the Home preview line "2 deadlines due this week"). → The system shows the banner on the outer display or the inner display, whichever is on.
2. Tap the banner. → The app switches the space first (`x-rakazo-space-id`), wipes or re-keys caches, then opens the thread. Group wins over bot if both are in the payload.
3. Observe the outer display. → Thread pushes over Home: strip with Back, content column with the thread.
4. Fold and unfold the phone. → On the inner display, the thread is the detail and Personnel is the sidebar for the new space.

#### Variations
- Thread already open: banner is suppressed for the open thread.
- Signed out: tap is ignored.
- Live Activity for a running agent (phase 13): shows in the Dynamic Island and in the vertical form on Duo; no board.

#### Edge Cases
- Notification for a space the user left: 401 on the stream; re-select the space.
- Older self-hosted server without APNs support: the app registers as `expo`/none; no push arrives.
- Stale bot id (bot archived): destination undefined.

#### Design gaps
- NO BOARD for permission prompt, notification settings (Account has no board), Live Activity, or the in-app presentation after a push.
- Which display the app opens on, and the sidebar selection after space switch on inner, are unspecified.
- No board for share extension ("sends to an agent or the data room"), so the picker layout on Duo is undefined.


### STORY-107: Open Settings on the inner display and change the default model
**Type**: medium
**Topic**: iPhone Duo and device adaptation
**Source**: topics/duo-adaptation.md STORY-010
**Phase issue**: #419 (P7), #421 (P9)
**Persona**: Sofia Brandão, founder who just switched model providers
**Goal**: Open Settings from the sidebar profile and change the default model with the list and detail visible together.
**Preconditions**: Signed in; inner display flat; at least one provider connected.
**Device**: inner flat
**Ideal path**: 4 — tap the profile, tap Models, pick Default model, choose a model.
**Alternate paths**: (a) On outer display, Settings sheet then Models is a push inside the sheet (Done to close). (b) Legal's "Add your OpenRouter key" row opens Models directly. (c) Half-folded: list left, Models right.
**Design source**: `PG-B-Settings.dc.html`, `PG-B-Models.dc.html`, PG-B-Rules > Settings and > Models, `Split.dc.html` (profile "Alex Morgan" at the sidebar bottom).

#### Steps
1. In the 1/3 sidebar, tap the profile row at the bottom ("Alex Morgan"). → Settings opens as a sheet that stays inside the content area and never crosses the fold.
2. Observe the sheet. → Settings list in 1/3 (selected row filled) and the selected detail in 2/3: profile, Models, Voice, Integrations, AI data sharing, Archived bots, Change password. Done (xmark) closes.
3. Tap "Models". → Detail shows Default model, Providers, Add a server.
4. Tap "Default model" and choose "Model A" from the menu. → Green line "Now using Model A".
5. Tap "Find models" for a local server. → Row shows a spinner; success or "Server unreachable" red line; "No matching models" for no match.
6. Tap "Done". → Sheet closes; Home returns.

#### Variations
- Outer display: each row pushes inside the sheet with Back; no split.
- Voice shows "Hear a sample" as the prominent button; Integrations "Continue" only inside setup.
- Account (profile detail) holds sign out and delete account; no board for the detail.

#### Edge Cases
- Values load after the list renders; rows show no value until loaded.
- Self-hosted older server: the model procedure returns 404 meaning "not supported".

#### Design gaps
- Account, AI data sharing, Archived bots, Change password: NO BOARD (the list rows exist; the details do not).
- Boards show "Settings" as a sheet from the profile, but the inner sidebar bar has no visible entry for it besides the profile row; Expo calls it "Account" (Home icon label "Account").
- A sheet containing its own split view (list 1/3 + detail 2/3) inside a 2/3 content area is not drawn; width of the nested split is unspecified.


### STORY-108: Open an artifact image and share it, across display modes
**Type**: short
**Topic**: iPhone Duo and device adaptation
**Source**: topics/duo-adaptation.md STORY-011
**Phase issue**: #419 (P7), #420 (P8)
**Persona**: Beatrix Lindahl, founder sending a chart to an investor
**Goal**: View an agent-made image full screen and share it.
**Preconditions**: Artifacts list has an image artifact. Outer display, then rotation.
**Device**: iPhone Duo outer
**Ideal path**: 3 — Artifacts (Home strip), tap the image row, Share.
**Alternate paths**: Tap an image inside a thread (opens PG-A-Image directly). Save to Photos instead of Share.
**Design source**: PG-A-Rules > Artifacts (`PG-A-Artifacts.dc.html`), > Artifact (`PG-A-Artifact.dc.html`), > Image (`PG-A-Image.dc.html`).

#### Steps
1. On Home, tap Artifacts (strip group with Activity and Search). → List with 28 pt "Artifacts" title, filter chips (All bots first), divided rows with type tiles. No prominent action.
2. Tap the image artifact row. → Full-screen image with a 35% dim under clear-glass controls: Close, Share / Save to Photos, More; a clear name pill at the bottom.
3. Tap "Share" (square.and.arrow.up). → System share sheet.

#### Variations
- Inner display: the bot filter is a vertical list in the 1/3, rows in the detail, and preview as the extra level; the image fills the 2/3 with the thread as the sidebar third.
- Half-folded: image on one half, thread on the other. Laptop pose: image on top, controls on the bottom; rotates freely.
- Non-image artifacts (Artifact page): Share is the prominent action, Versions in the strip, version pill floats.

#### Edge Cases
- "Could not load this image." with Close still available; "No preview for this file type."
- Long press a row in the list: delete confirm lists the version count.

#### Design gaps
- The Image rule says the image page has no prominent action while Artifact has "Share" as prominent; opening an image from the Artifacts list vs from a thread both reach PG-A-Image, but the Artifact page rule does not say when an image artifact uses which screen.
- Laptop pose is applicable to Image but not Artifacts; the transition from the list (full column) to the image (pose) is not specified.
- Save to Photos permission denial state has NO BOARD.


## Redundancy Candidates

Built from the **Alternate paths** fields and the multi-surface notes in the Design gaps. These are candidates to simplify, not decisions. Each entry names a pair or group of stories.

### Duplicate paths (several ways to do the same thing)

| # | What the user wants | Paths | Stories | Suggested direction |
| --- | --- | --- | --- | --- |
| P1 | Open the Inbox agent | Inbox message "Ask Inbox agent", list prominent action, Home Personnel row, Inbox row on Home | 057, 060, 099, 011 | Keep one prominent entry per page; keep the Personnel row as the always-available route |
| P2 | Reach Settings | Home profile control, sidebar profile, Account icon (Expo), Server/Models rows, "Review AI data sharing in Account settings" message | 087, 094, 107, 002 | Pick one entry (profile) and one name; the error message should deep-link, not name a path |
| P3 | Fix a missing model | Home banner (undrawn), error at send, Settings > Models, Legal "Add your OpenRouter key" | 019, 040, 089, 081 | One reusable "Connect a model" action that opens Models and returns |
| P4 | Archive mail | Swipe, row menu, message Archive, bulk select, Cleanup | 056, 057, 060, 062 | Keep swipe + message Archive; bulk only in Cleanup |
| P5 | Grant AI data consent | Settings page, prompt before first send, in-thread `ai_consent` card, voice start | 048, 094, 052, 066 | One consent component reused in all four places |
| P6 | Open an agent's conversation | Thread from Home, Page "Open chat", Routine "Open conversation", Artifact "Ask", push tap | 011, 073, 075, 106 | Same thread screen; make sure all routes land on the same state |
| P7 | Create a bot | Home New menu, empty-state "+", Expo fallback "New Bot", inner Create icon | 012, 104, 019 | Remove the no-form fallback; one New menu |
| P8 | Create a space and switch | New space sheet, inline space groups (Expo), switcher | 015, 016 | Decide one pattern (see DECISION in #415) |
| P9 | Answer an approval | Thread card, Home Activity "approve", Inbox message view, push | 011, 045, 046, 106 | One source of labels and one outcome handler (including CONFLICT) |
| P10 | Share a file or image | Artifact Share, Image Share and Save, Data room "Ask about this file", composer attach | 070, 072, 084, 034 | System share sheet everywhere; no separate Data room share control |
| P11 | Hide amounts | Finance page toggle, chat finance card, Expo Account screen | 079, 087 | One device-only setting with one home |
| P12 | Open a Duo page | Sidebar rows, Home strip icons, More menu | 086, 098, 105 | Keep the same item list on every display |
| P13 | Retry a failed load | "Try again" (Home, Artifacts), "Retry" (sign-in), Refresh (Finance banner), no control (page, list, routine) | 006, 013, 077, 078 | One retry label and control |
| P14 | Finish a Safari round trip | Integration connect, Carta connect, SSO, billing checkout | 003, 082, 093 | Same return handling and polling rules |

### Duplicate information (same facts shown in several places)

| # | Information | Where it appears | Stories | Risk |
| --- | --- | --- | --- | --- |
| I1 | Pending approval | Thread card, Home Activity, Inbox message, push text | 011, 032, 046, 106 | Labels and states can disagree (Deny/Allow vs Save/Send) |
| I2 | Working state of an agent | Thread indicator, group footer lines, Home Activity card, later Live Activities | 023, 026, 011 | Four renderers to keep in sync |
| I3 | Runway and cash figures | Finance page, agent page tiles, "Runway summary" artifact, routine prompt, chat finance card | 078, 073, 070, 075, 079 | No cross-links; Hide amounts must mask all |
| I4 | Connected apps | Settings Integrations value, catalog page, chat `app_connect` card | 093, 087 | Card rendering undefined |
| I5 | Server host | Sign-in link, Server sheet, Settings | 002 | Format defined only in Expo |
| I6 | Personnel order and pins | Web, Expo, native | 020 | Native must match server order exactly |
| I7 | Unread state | Home row (not drawn), sidebar on inner display, thread divider, Activity dot | 022, 030, 011 | Four unread indicators, only one drawn |
| I8 | Sidebar page rows and the agent for the same capability | Finance row and Finance agent row; Legal; Carta; Data room | 086, 085 | Two entries for one thing |
| I9 | Sections inside Inbox | "Needs reply / Other mail today" vs "Today / Earlier"; filter chips vs Expo categories | 056, 060 | Two vocabularies |
| I10 | Routines and checklists | Routine prompt, agent page lines, list items | 075, 073, 074, 076 | The same task can be tracked in a routine, a page and a list |

### Overlapping features and tools

| # | Features | Stories | Note |
| --- | --- | --- | --- |
| F1 | Archive (bot) vs delete (bot) vs archive (mail) vs delete (artifact) | 018, 095, 071, 056 | Four meanings of "archive/delete"; the memory choice on bot delete has no copy |
| F2 | Page vs List vs Artifact vs Data room file | 073, 074, 069, 083 | Four places a bot can leave durable output |
| F3 | Approvals vs choice cards vs secret asks vs consent | 045, 054, 051, 048 | Four card kinds with different buttons; need one visual language |
| F4 | Search: mail search, global search, Artifacts search, Data room search | 060, 031, 069, 083 | Four search fields, one global search not drawn |
| F5 | Device voice vs hosted voice vs dictation | 091, 092, 033 | The bot-level device voice flag and the global switch interact in an unstated way |
| F6 | Open computer vs Page vs List (agent actions) | 067, 073, 074 | Strip actions differ by agent |
| F7 | Mail Compose vs Reply vs Forward vs Edit-and-send | 058, 059, 065, 047 | Same sheet, four entries |
| F8 | Settings Account vs Profile row vs Home Account icon | 087, 007 | Possibly the same page under two names |
| F9 | Cleanup vs swipe Mute/Star vs Newsletter filter | 062, 056, 060 | Three ways to deal with newsletters |
| F10 | Space vs group vs section | 015, 014, 020 | Three grouping levels; the switcher design decides how visible they are |

## Design Gaps by Phase

Each bullet is one deduplicated gap. Story IDs cite the stories whose Design gaps named it (catalog IDs; a merged story's gaps are cited under its survivor). **DECISION:** marks a gap that needs a product decision, not just a missing board. "NO BOARD" means no board exists in `docs/design-system/ios/boards/`.

### #412 (P0): Scaffold and tokens

- Light-mode layouts: the boards read were dark only; the same layout is claimed for light but not shown (025).
- Dynamic Type and accessibility behavior of long markdown, tables and cards is not verified on any board (025, 087).
- DECISION: working-indicator color: the Thread rule card says "three blue dots", DS-06 says neutral dots with a `statusWorking` ring. Choose the token (023, 033).

### #413 (P1): Contracts export

- DECISION: what the UI does when the server lacks a procedure (404 means "not supported"): hide, disable, or explain; no board and no copy (010, 077).
- Decoders must tolerate missing optional fields from older servers; no board shows which screens degrade (010).

### #414 (P2): Server selection and sign in

- DECISION: product name in strings: board "Sign in to Rakazo" / "Rakazo server" vs Expo "Sign in to Praci" / "Praci server" (001, 002).
- DECISION: which mode the app opens in on first launch: Expo opens sign-up, the board shows sign-in (001, 004).
- Sign-in states without boards: pending button label ("Working..."), local validation messages, Go key and focus order (001).
- Sign-up mode has no board: Name field, button label, mode switch links (004).
- Forgot-password mode has no board: "Check your email" title, "Back to sign in", Retry, resend, opening the Mail app (004, 005).
- Return to the app after email verification or password reset is manual and undesigned (004, 005).
- Loading and failed-options layout for capabilities: whether email fields are hidden or disabled; no distinction between no network and wrong server; "Retry" vs "Try again" (006).
- Server sheet: validation errors ("Enter a server URL", missing host, wrong scheme), the http-on-public-host warning, the "not a Praci server" line and the board's "Could not reach this server" vs Expo "Could not reach that server" (002).
- DECISION: confirmation before a server change wipes a signed-in session (002).
- Server host display format on the sign-in link (Expo `displayApiHost`) is not defined on boards (002).
- SSO: cancel and failure after the web sheet, long provider names beyond "Example SSO", and the first-time SSO setup screen (`integrationSetup/get` `needsSetup`) NO BOARD (003).
- Session end: no message telling the user why they were signed out; recovery from a stale space; offline launch with a saved snapshot before the 401 (008).
- DECISION: what happens to the outbox and unsent drafts after a forced sign-out (008, 007).

### #415 (P3): Home, spaces, bots and groups

- Activity: "See all" destination and the side-strip Activity icon destination have no board (011, 098).
- Standard iPhone (393 pt) Home layout is not drawn; toolbar placement of Account, Activity, Search, Artifacts and New is text only (011).
- DECISION: accessible names for Home controls: Expo "Account / Activity / Search / Artifacts / Create" vs board "New" (011, 012).
- Saved Home snapshot: stale marker and timestamp not drawn (011, 013).
- Home loading, error, stale and partial-failure states; "Could not load bots" is shown even when spaces or Inbox summary fail; pull-to-refresh is not specified (013).
- New bot: discard-changes confirmation not drawn (012); Expo fallback that creates a bot named "New Bot" with no form has no board path (012).
- DECISION: where Create lands (thread or back to Home) for a new bot and a new group (012, 014).
- Empty-state copy "Tap + to create a bot" names a "+" while the board button is "New", ignores groups and spaces, and offers no action (012, 019).
- New group: whether Create is disabled with no name or members; where groups appear in Personnel; group row design (avatar stack, preview) exists only in Expo (014).
- DECISION: space switcher: control, current-space indicator, loading and failure states are NO BOARD; Expo lists spaces as inline headed groups while the boards show one flat Personnel list (015, 016).
- The rule "Try again from the sidebar" assumes a sidebar a standard iPhone lacks (015).
- DECISION: space rename, delete and "default space" (Expo only) and member or invite flows (no API) (015, 016).
- Inner display detail pane when the new space has no last thread (016, 030).
- Bot settings: entry point from a thread or Personnel row; board title "Chat settings" vs "Bot settings"; Skills and Notifications rows missing; unsaved-changes and per-field validation; voice sample button belongs to Voice (017).
- Group settings entry is "push from the group thread header" but the control is not drawn (020).
- Archive: entry point, confirmation, archived banner on the thread, archived groups, and bot delete with its memory choice (018).
- `needsModel` handoff has no screen: no banner, no empty-state variant, no deep link from Home to Models (019).
- Organize Personnel: pinned and section headings, collapse, long-press organize sheet, VoiceOver action, section removal and reorder; DS-04 pickers not shown in context (020).
- Unread indicator on Personnel rows (not drawn; only the Activity dot exists) (022, 030).
- DECISION: onboarding choice cards and focus prompts (`onboarding/*`) have no planned screen (054).

### #416 (P4): Thread read

- Thread states: initial loading with no snapshot, failed refresh over a snapshot, archived or deleted bot with Restore (021).
- Standard iPhone thread top bar (title, back, agent actions) and Page and List parity are not drawn (021, 029).
- Unread divider "New", "Jump to latest" and "new messages" pill are not on any board; entry for `threads/markUnread` undefined (022, 031).
- DECISION: paging UX: Expo has a "Load earlier messages" button, the rule card shows a spinner only (022).
- End-of-history marker, paging failure, saved-chat stale signal and retention (031).
- Working indicator: label text ("Inbox agent is working" vs "{name} is working" + status line "Still waiting on {service}"), failed-run note "Last run failed", and rendering of partial markdown (open code fence, half a table) (023).
- Connection state: no "Reconnecting" or offline indicator; 401 error-frame outcome in a thread; whether heartbeat or retry is visible; backoff reset (024).
- DECISION: silent retry vs visible offline state in a thread (024, 038).
- Table Expand and code Expand sheets have no PG board; link tap behavior (in-app vs Safari) unspecified; image viewer Close and Share placement on standard iPhone (025).
- Group thread: member list pane, standard iPhone entry to Members and group settings, "Message the group" empty copy, maximum visible working lines for 6 members (026).
- Empty agent greeting and suggestion chips layout (027, 044).
- DECISION: suggestion chips send immediately or only fill the composer (027, 044).
- Unknown block placeholder: copy, icon, whether it names the kind, "open on web" path (028).
- DECISION: interim behavior of approval cards in the read-only phase 4 versus phase 5 (028, 032).
- Outer strip thread: message context menu, pins strip placement against the title capsule, pins strip missing from the Thread rule card (029, 031).
- Global search results screen and message jump (`search.query`, `threads.messages({around})`) are not drawn (031).
- Inner display: per-agent subscription lifecycle (one stream or several) (030).

### #417 (P5): Thread write, approvals and consent

- Message states: "Sending" caption with two messages in flight; a distinct "Waiting for connection" or queued state; stale snapshot marker (033, 038, 043).
- Offline: no banner, no queued caption; messages may wait hours at 70% opacity; cache eviction loses queued sends without notice (038, 043).
- Attach: source menu labels, per-chip upload progress, chip error state, four-chip row layout, picker for artifacts or Data room items (034, 043, 084).
- Skipped-attachment notice style and position, "Converting" state for HEIC, reason copy and MB vs MiB (035).
- Message long-press menu, part-message quote, unavailable original, and whether a reply target survives relaunch or posture change (036, 039, 043).
- Mentions: empty popover, token look in composer and bubble (037).
- DECISION: scope of mentions: agents only, or humans too ("Teammate" appears on the board) (037).
- Refused vs failed: both look like "Not sent"; the edit action is missing from the long-press menu; "Failed to send message" vs "Not sent" copy; reason text location (039).
- No-model block and deep link from the error to Models; README text "Connect a model to start a run" vs server text "Connect a model in Settings before running bots."; whether it is a refused send or `run.failed` (040, 019).
- DECISION: one trailing slot cannot be both Send and Stop when text is typed during a run; "stopping" and stop-failure states; "Work stopped, but the thread could not refresh" (041).
- Reactions: picker, display under a bubble, mine vs others, offline behavior (042).
- Attachment total (4 files, up to 40 MiB base64) against the 50 MB outbox cap: no warning (043).
- Approval card: read-only state, expanding truncated money arguments before approving, confirmation for "Always allow" (045).
- DECISION: mail approval card shows "Deny / Allow" (PG-A-Thread) in one board and "Save / Send" (Inner, DS-06) in another; also the card title ("Send reply" vs "Re: Pilot timeline") (029, 032, 046).
- Mail card outcomes `unknown`, `failed`, post-save state, "View draft", draft truncation (046).
- DECISION: edit-and-send screen (entry, fields, Bcc, validation, Duo layouts) is NO BOARD and may ship after approve/deny (047).
- Consent prompt form (alert, sheet or inline card), recipient icons, privacy link placement, composer text after "Not now" (048, 066).
- Error text says "Account settings" while the row is under Settings > "AI data sharing" (048, 094).
- CONFLICT: no message designed and thread refetch not specified (032, 050).
- Secret ask: card, destination line, "Saved" and error states, Keychain and AutoFill, retry loses typed value (051).
- Voice-consent prompt in the middle of starting a call (052).
- MCP approval: the server-connect card is NO BOARD and is easily confused with the DS-06 MCP card; "MCP settings" destination does not exist (053).
- Choice card: multi- vs single-select and free-text keyboard; the writes switch and its warning copy; a "writes are off" message in the thread (054).
- DECISION: "Always allow" rules and auto review (`approvalRules.*`, `autoReview.*`) have API but no planned iOS screen (045, 055).
- Live approval status flip from another device ("Sent" and "Not sent" specimens exist, no transition); "Changing mail is turned off." in the thread (032).

### #418 (P6): Inbox

- Standard iPhone Inbox board (list and toolbar) is not drawn (056).
- Swipe actions: Star has no write procedure; Mute maps to `inbox.feedback` by inference only; no Undo toast after Archive though the API supports it; Spam and Trash exist in Expo but not on the swipe specimen (056).
- DECISION: section names: board "Other mail today" vs plan and Expo "Today" and "Earlier" (056, 060).
- Message: attachment preview (PDFKit, Quick Look), multi-message conversations, Unsubscribe from the message, "Ask Inbox agent" vs Expo "Ask agent", where sender avatars come from (057).
- Compose sheet NO BOARD: fields, From account picker, Cc and Bcc, attachments, formatting (`html`), sending state, error banner, detent, outer-display behavior, reply-all, saved drafts list, contact autocomplete (058, 059, 065, 099).
- Compose outcome copy for `saved`, `sent`, `unknown`, `reconnect`, `disabled`, `failed` (058).
- Forward: no control on the message board, "files left out" copy (059).
- Filters: popover items ("Needs reply", "Newsletters", "Read mail") do not match Expo categories; "Read mail" has no `InboxFilter` value; Filter placement differs between DS-04 and `Sheet.dc.html`; "Important only" star appears only on `Split.dc.html`; "Select messages" bulk mode NO BOARD; own sent-mail rows (060, 064).
- Search overlay empty and error states (099).
- To-do: undo, history, consent-blocked explanation, due-label rule (061).
- DECISION: Cleanup and unsubscribe flow: whole flow NO BOARD, entry point missing on the outer display, action vocabulary ("Skip inbox", "Not spam", "Trash", "Learned", "Forget"), undo pattern; confirm it is in phase 6 (062).
- DECISION: mail connection states: banner for writes off, reconnect, rate limited, "No mail account connected"; the client cannot learn writes-off before a failed write (063, 066).
- "Inbox zero" does not distinguish never synced from synced and empty; first-sync loading does not say triage is running; "Connect mail" empty state (063, 066).
- Inner two-pane Inbox: folders in the 1/3 sidebar, selection after Archive, "Inbox zero" detail, location of Cleanup, Star and Mute, what tapping a label does (064).

### #419 (P7): Duo layouts

- Sign-in and Server sheets have only an outer-display board; inner and half-folded versions, sheet and keyboard placement in half-fold, and state kept while typing across posture change are undrawn (009).
- DECISION: posture change behavior: relaunch vs scene change, and survival of drafts, scroll position, selected row and reply target (100, 076, 085, 043).
- Sidebar: highlighted row for a group thread or an open page; sidebar Search results state (100).
- Inner thread: default thread when nothing is selected, per-agent unread in the sidebar, behavior below iOS 27.1, parity of pins strip and unread divider (030).
- Outer thread strip has no prominent button and no "jump to approval" control when the card is off-screen (098).
- Collapse order on a short outer display for every page (only Inbox is listed) and what happens to a collapsed prominent action (105).
- Label mismatches between boards: "settings" vs Expo "Chat settings" / "Group settings"; Create vs Done vs New for creating a bot; sheet at 466x420 (104, 105).
- Laptop pose: only Finance has a mockup; Computer, Legal, Cap table and Data room are rule-card text; software keyboard covers the bottom half; transition between laptop-capable and not-applicable pages (Routine, Artifacts); where Ask [page] agent and its reply live; where the four pages are reached on the inner display (085, 102, 103, 076, 108).
- Settings on inner display: a sheet containing its own 1/3 + 2/3 split inside a 2/3 area is not drawn (107).
- Push tap on Duo: which display opens and sidebar selection after a space switch (106).

### #420 (P8): Computer, artifacts, pages, routines

- Computer: standard iPhone layout; More label "open computer" vs Expo "Open computer"; entry from a thread's computer block (067, 102).
- Handoff prompt (Skip or "I'm done") presentation; lease expiry, "Reconnecting", takeover-denied and "Could not switch computer" states; maintenance actions (Recover, Reset, Update); key bar labels (Return, Control, Escape); pointer, scroll and clipboard input; leaving Computer while holding the lease (068, 076, 102).
- Artifacts: standard iPhone entry point, search field expansion, chip overflow beyond about four bots, sort order and date grouping rule (069).
- Versions menu contents and selected state, no diff view, newer version arriving while viewing, Share placement on standard iPhone (070).
- DECISION: delete dialog copy and whether it deletes all versions (`artifactId` semantics), undo, multi-select (071).
- Image: Save to Photos feedback, More contents, "Save to Photos" is new vs Expo Share only, permission-denied state, back-to-list in inner mode, which screen an image artifact uses (072, 108).
- DECISION: agent page read-only (`pages/save` exists); finding lines have no tap target; Hide amounts on tiles; no cross-link between page, artifact, routine and Finance page (073, 076).
- Agent list: conflict alert, reorder and rename, delete affordance, list-name title vs Expo "List", clear done (074).
- DECISION: routines are read-only (create, update, remove exist); routine history, routines list, failed or paused state, which run "Open conversation" opens (075, 076).
- Error states: no retry control on Agent page, Agent list and Routine; no offline banner; "Not supported by this server" copy; "Could not load the desktop." retry (077).

### #421 (P9): Settings

- Settings entry: no profile control drawn on the outer Home strip or standard iPhone; profile row vs "Account" row may be one page; "Integrations [N]" count undefined (087).
- DECISION: Expo Account extras (Language, Appearance, Avatar style, Hide amounts, Notifications, Usage, Live update) have no home in the iOS Settings board (087, 007, 079).
- Account screen NO BOARD: profile, sign out, delete flow, Link SSO, export (`account.exportRequest`) (007, 087).
- DECISION: destructive confirmation pattern (alert, sheet or typed), SSO re-authentication and email-code variants; push token and outbox on sign out (007).
- Change password screen and rules; Archived bots list, empty state, restore location (095, 018, 007).
- Server row in Settings (the Server rule card says the sheet opens from Settings) (002).
- Models: backup models (reorder, max 10), embedding model and auto-file email, "Thinking" state for non-reasoning models (088).
- Provider detail (key form, replace, disconnect), subscription sign-in page, provider list beyond three rows, first-run route from `needsModel` (089, 019).
- Local server: limits fields, model picker, manual model name, add-vs-existing row, local network permission (090).
- Voice settings: voice and speech-model pickers, consent check before hosted voice, interaction between a bot's device-voice flag and the global switch (092).
- Integrations: app detail page (accounts, tools, access per agent, writes toggle, remove), pending alert wording, polling stopping when the page is left, Show more and search, Safari return path, `app_connect` card rendering (093).
- DECISION: server-credentials setup: owner vs member role and read-only state, Direct MCP fields, whether the sheet auto-opens, detent (097).
- AI data sharing detail page and its empty, loading and error states; link from the blocked-send error (094, 048).
- Writes switch UI (`connections.setWrites`, `mcp.servers.setWrites`) and an MCP settings page (053, 054).
- Approval rules and auto review screen (055, 045).
- DECISION: usage and billing screens, and in-app purchase vs "manage on web" (no story; discovery).

### #422 (P10): Push

- NO BOARD for the permission prompt, notification settings, notification list, or in-app presentation after a tap (106).
- Whether sign-out unregisters the push token (007).
- Whether Hide amounts masks push text (079).

### #423 (P11): Voice

- Microphone and speech-recognition permission prompts and the denied state (091).
- Sounds section ("Call sounds", "Waiting sound") control types and choices (091).
- Active call screen has no PG page; consent prompt in the middle of starting a call (052).

### #424 (P12): Finance, Legal, Cap table, Data room

- Entry to the pages on the outer display (no sidebar row drawn) and on inner display (078, 085, 086).
- Finance: null runway, refresh progress, account and transaction detail, burn bar detail, "Spend" vs "Upcoming" naming (078, 085).
- DECISION: Hide amounts scope: agent-written text, push, Home Personnel preview, Live Activities; no Settings home; hidden-state chat card not drawn (079).
- Legal: scan running, completed and cancelled states; contract detail and deadline edit; status chips mapping; "Never scanned" and "Scan failed" not drawn; Legal consent (080, 081).
- Legal blocker: row not drawn, why an OpenRouter key is needed, consent order, return path from Models (081).
- Cap table: not-connected, expired, error and syncing screens; contact form and list; holder detail; label set mismatch (board "Founders / Option pool / Seed investors / Advisors" vs DS-07 "Founders / Investors / Pool / Other"); Safari return and poll; whether `contacts.save` links a holder (082).
- Data room: folder navigation, item detail and preview, rename, move, delete, retry processing, processing status, duplicate and zip outcomes, search row and loading, background upload progress (083).
- DECISION: Data room "Shared / Only me / View only" chips vs README "no share links" (083).
- Select a Data room file to ask about it; composer picker; tap on a Data room reference in a message (084).
- Legal, Cap table and Data room inner, half-folded and laptop layouts; where Ask [page] agent sits (085).
- DECISION: sidebar page rows and glance values (`notifications.glance`) have no home; whether rows are fixed or user-added (`sidebarPages`); duplicate agent row and page row (086).

### #425 (P13): Platform extras

- Live Activity, App Intents, share extension and widgets have no board; share-extension picker layout on Duo is undefined (106).
- No story covers this phase (see Coverage Matrix).

### #426 (P14): Release

- No gaps from stories. No story covers release; screenshot sets for Duo and standard layouts depend on the #415 and #419 boards.

## Copy and naming conflicts

Conflicts between boards, rule cards, DS-06 and the Expo app that need one chosen string.

1. Product name: "Rakazo" (Sign in board "Sign in to Rakazo", "Enter your Rakazo server address.") vs "Praci" (Expo "Sign in to Praci", "Praci server") (001, 002).
2. Unreachable server: "Could not reach this server" (board) vs "Could not reach that server" (Expo) (002).
3. Retry label: "Retry" (sign-in), "Try again" (Home, Artifacts), "Refresh" (Finance banner) (006, 013, 078).
4. Home create button: "New" (board) vs "Create" (Expo, inner `aria-label`) vs "+" in "Tap + to create a bot"; inner sheet confirm "Done" vs outer "Create" (011, 012, 104).
5. Home control names: Expo "Account / Activity / Search / Artifacts" vs board icons and strip (011).
6. Bot settings title: "Chat settings" (board) vs "Bot settings" (rule card); More-menu item "settings" vs "Chat settings" / "Group settings" (017, 105).
7. Consent error: "Review AI data sharing in Account settings before continuing." vs the Settings row "AI data sharing" with no Account screen (048, 094).
8. No-model text: "Connect a model to start a run" (README) vs "Connect a model in Settings before running bots." (server) (040).
9. Mail approval buttons and title: "Deny / Allow", "Send reply" (PG-A-Thread) vs "Save / Send", "Re: Pilot timeline" (Inner, DS-06) (032, 046).
10. MCP approval: "Allow once / Always allow / Deny" (DS-06) vs "Deny / Allow" (PG-A-Thread) (029).
11. Failed send: "Failed to send message" (rule card, Expo alert) vs "Not sent" (DS-06) (039).
12. Size unit: "MB" (brief) vs "MiB" (Expo) (035).
13. Working indicator: "Inbox agent is working" (board) vs "{name} is working" with status line (Expo) (023).
14. Inbox sections: "Other mail today" (boards) vs "Today" and "Earlier" (plan, Expo, DS-05) (056).
15. Inbox filters: "Needs reply / Newsletters / Read mail" (board) vs All / Important / Updates / Newsletters / Spam (Expo) (060).
16. Ask agent: "Ask Inbox agent" (board) vs "Ask agent" (Expo message) vs "Inbox agent" (list) (057, 099).
17. Computer menu: "open computer" (rule card) vs "Open computer" (Expo); key bar "Ctrl / Esc" (board) vs "Control / Escape / Return" (Expo accessibility names) (067, 068).
18. List title: list name (board) vs "List" (Expo) (074).
19. Cap table groups: "Founders / Option pool / Seed investors / Advisors" (page) vs "Founders / Investors / Pool / Other" (DS-07) (082).
20. Finance sections: "Spend" (inner rule card) vs "Upcoming" (outer page) (078, 085).
21. Group of settings rows: "Account" (Expo Home label) vs profile row (iOS Settings board) (087, 107).

## Gaps & Recommendations

Findings from consolidation. These are observations and proposals, not decisions.

1. **Draw the standard iPhone first.** 76 of 105 stories start on a standard iPhone but the boards draw the outer Duo display; Home, Thread, Inbox, Computer, Artifacts and the Settings entry have no 393 pt layout. Ship phases 3 and 4 only after a standard layout exists for Home and Thread.
2. **One consent and one approval component.** Consent (no board), approval cards (two conflicting mail cards), CONFLICT, secret asks and choice cards are one visual family. Decide the card vocabulary before #417.
3. **Decide the space switcher before #415.** It blocks stories 015, 016, 106 and every story that assumes a current space.
4. **Mail has the largest undrawn surface.** Compose, forward, cleanup, writes-off banner, connect-mail empty state and the filter vocabulary are all NO BOARD. Confirm Cleanup is in phase 6.
5. **Account is the largest missing screen.** Profile, sign out, delete, change password, archived bots and AI data sharing all hang from rows with no detail boards; they gate stories 007, 094 and 095.
6. **Laptop pose has one board.** Only Finance has a laptop mockup; Computer is the main laptop use and is text only.
7. **Offline is not designed.** No offline banner, queued caption, Reconnecting indicator or stale marker exists, yet 024, 038, 043 and 013 depend on them.
8. **Cheap fixes.** Retry label, "Rakazo" vs "Praci", MB vs MiB, "Today/Earlier" and the 21 conflicts above are string decisions that cost nothing.
9. **Stories missing for planned work.** Add stories for dictation and the call loop (#423), notification permission and banner suppression (#422), Live Activities, App Intents, share extension and widgets (#425), routines list and history (#420), global search (#416), and usage and billing (#421) once boards exist.
10. **Unverified.** Everything in this catalog is planned behavior. No story was run against a native build, and no story has been checked against the full text of every board; gaps reflect what the topic files recorded.
