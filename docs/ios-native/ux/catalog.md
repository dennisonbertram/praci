# UX Path Catalog: Praci iOS (native, planned)

Generated: 2026-10-20. Refreshed: 2026-10-20 (round 1, after the gap-fix pass on the design boards; round 2, after the round-1 fixes to the boards).

Status: planning only. No Swift code exists. Every story below describes planned behavior, built from the design boards in `docs/design-system/ios/boards/`, the build brief and phased plan in `docs/ios-native/`, and the existing Expo app. Nothing here was observed in a running native app. Epic: #427. Phase issues: #412 to #426 (phase N is issue 412+N).

Inputs: `docs/ios-native/ux/discovery.md` and the ten topic files in `docs/ios-native/ux/topics/`. Story IDs below are catalog IDs (STORY-001 to STORY-127; 001 to 108 were assigned in topic order, 109 to 117 were added in round 1 and 118 to 127 in round 2, each at the end of its topic). Each original story keeps a **Source** line pointing to its topic-local ID; the new stories name the boards that enabled them.

**Total Stories**: 124 unique stories (127 written; 3 merged as duplicates, see "Merged stories").

**Coverage**: 25 of 32 feature areas are fully covered (78%); 4 more are partially covered (so 29 of 32, or 91%, have at least one story); 3 have no story. Details are in the Coverage Matrix. Phases #412, #413 and #426 have no user interface to walk, so no story is expected for them.

## Round 2 refresh

The boards grew from 54 to 58 in the round-1 fix pass, and nearly every existing board was edited after the round-1 catalog was written. New boards: `PG-A-Activity`, `PH-GroupThread`, `Inner-Message` and `Desk-Computer`. Largely redrawn as multi-frame state grids: `PG-A-Home` (loading, error, offline, empty space, pinned rows), `PG-A-ThreadStates`, `PG-A-Cleanup`, `PG-A-Compose`, `PG-A-InboxMessage`, `PH-Inbox`, `PG-A-Computer` and `PH-Computer`, `PG-A-Routine`, `PG-A-Image`, `PG-A-HomeNoModel`, `PG-B-Account`, `PG-B-Server`, `PG-B-SignIn`, `PG-B-ForgotPassword`, `PG-B-Models`, `PG-B-Voice`, `PG-B-Integrations`, `PG-B-Finance`, `PG-B-Legal`, `PG-B-CapTable`, `PG-B-DataRoom`, `PG-B-NewBot`, `PG-B-NewGroup`, `PG-B-NewSpace`, `PG-B-BotSettings`, `PG-B-GroupSettings` and `PG-B-Spaces`. Two things changed meaning: `PG-B-Consent` now draws a Speech sheet and the Settings page (the model sheet is gone, and the Connect sheet carries the disclosure), and the mail approval card has "Edit" and "Send" (the draft autosaves, so "Save" is gone). `PG-A-Rules` and `PG-B-Rules` were refreshed in part and still disagree with the boards in a few places (see "Copy and naming conflicts"). Boards were judged from the text of each frame and from screenshots of the new boards; they are static, so transitions, timing and keyboard behavior are still not verified.

The journeys that the task named as new (switching spaces, connecting the first model from Home, deleting the account, resetting a password, composing new mail, cleaning up the Inbox, recovering from offline, failed and refused sends, granting AI data consent) already had stories from round 1 (109 to 117). They were re-checked and rewritten against the new frames instead of being duplicated; STORY-117 changed scenario (see below).

What changed in this file:

- **Stories added (10)**: 118 (Activity list), 119 (unsubscribe from one newsletter from its message), 120 (failed routine and "Run again"), 121 (allow the Inbox agent to read mail), 122 (Team Computer control ended, denied or dropped), 123 (microphone access off), 124 (read-only thread), 125 (the agent revises the mail draft), 126 (switch server while signed in), 127 (a new email does not send).
- **Stories updated (105 of 114)**: Design source, Steps and Design gaps re-checked against the boards. Nine stories needed no change (009, 010, 025, 028, 030, 037, 050, 051, 053). STORY-062 (Cleanup) and STORY-117 were rewritten: 062 because the Cleanup menu, confirmation, failure, History and Done frames replaced the earlier four frames, and 117 because the board no longer draws a model prompt, so it now follows the Speech prompt (dictation).
- **Story-level gaps**: of the 433 gap bullets on the 114 existing stories, 76 were removed because a board now draws the missing part, 147 were rewritten to the part that is still missing (or to a new statement of the same gap), and 43 new gaps were added; the 10 new stories carry 41 gaps. The totals exclude the two rewritten stories (062, 117).
- **Ideal paths re-counted or re-worded**: 005, 007, 012, 018, 019, 039, 040, 047, 055, 059, 062, 063, 095, 112, 115 and 117.
- **Corrections**: STORY-007 and STORY-112 described a "Sign out of Praci?" confirmation that `PG-B-Account` does not draw; deleting the account now ends on Sign up, not Sign in; the Cleanup bulk menu has no "Spam"; `PH-Inbox` already carries the prominent "Ask Inbox agent", a More button and a To do card.


## Round 1 refresh

The boards grew from 40 to 54 in the gap-fix pass. New boards: `PH-Home`, `PH-Thread`, `PH-Inbox`, `PH-Computer`, `PH-Spaces` (standard iPhone, 393 pt), `PG-A-HomeNoModel`, `PG-B-Spaces`, `PG-A-ThreadStates`, `PG-B-Consent`, `PG-B-SignUp`, `PG-B-ForgotPassword`, `PG-B-Account`, `PG-A-Compose`, `PG-A-Cleanup`. Edited boards: `PG-A-Home` (PAGES section, space title menu), `PG-A-Thread` (mail card now "Save" and "Send", "Agent actions" button). Boards were judged from screenshots; they are static, so transitions, pending states and keyboard behavior are not verified. The rule cards in `PG-A-Rules.dc.html` and `PG-B-Rules.dc.html` were not updated and now disagree with several boards (Home PAGES and empty text, the thread's prominent action "Allow", Inbox sections and prominent action, "Failed to send message").

What changed in this file:

- **Stories added (9)**: 109 and 110 (switch spaces on a standard iPhone and on the outer display, with rename and delete), 111 (connect the first model from Home), 112 (delete the account), 113 (resend a password reset link), 114 (compose new mail on a standard iPhone), 115 (clean up the Inbox and undo), 116 (recover from offline, failed and refused sends), 117 (decline, then allow, AI data sharing).
- **Stories updated (70 of the original 105)**: Design source, Steps and Design gaps re-checked against the boards; every story that named a board that now exists, or a mismatch a board settled, was edited.
- **Story-level gaps**: 29 closed in full, 51 narrowed (a board now draws part of it), 7 reworded with board evidence (still open), 27 opened on existing stories, plus the Design gaps of the nine new stories.
- **Ideal paths re-set** where a board changed the count: 007, 015, 019, 039, 059, 062, 086, 087, 089, 094.
- **Correction**: the earlier device table counted one laptop-pose story too many and one outer-display story too few.

## Summary by Type

| Type | Count | Meaning |
| --- | --- | --- |
| short | 41 | One feature exercised in roughly 3 to 6 steps |
| medium | 62 | One flow with variations, roughly 5 to 10 steps |
| long | 21 | End-to-end session across several features or display modes |
| **Total** | **124** | 127 written minus 3 merged (1 long, 2 medium merged away) |

## Summary by Topic

| Topic | Stories | Story IDs | Primary phase issue |
| --- | --- | --- | --- |
| First run: server, sign in and recovery | 13 | 001 to 010, 112, 113, 126 | #414 |
| Home, Personnel and spaces | 14 | 011 to 020, 109 to 111, 118 | #415 |
| Thread: read and live | 13 | 021 to 032, 124 | #416 |
| Thread: send, attachments and offline | 13 | 033 to 044, 116 | #417 |
| Approvals and AI data consent | 12 (13 written, 1 merged) | 045 to 055, 117, 125 | #417 |
| Inbox triage and compose | 16 | 056 to 066, 114, 115, 119, 121, 127 | #418 |
| Team Computer, artifacts, pages, routines | 13 | 067 to 077, 120, 122 | #420 |
| Finance, Legal, Cap table, Data room | 9 | 078 to 086 | #424 |
| Settings, models, voice, integrations | 11 (12 written, 1 merged) | 087 to 097, 123 | #421 |
| iPhone Duo and device adaptation | 10 (11 written, 1 merged) | 098 to 108 | #419 |

## Summary by Device

Counts use the first device named in the Device field of the 124 surviving stories (round 2 moved STORY-117 from a standard iPhone to the outer display, because the board it uses is drawn only there).

| Device | Stories |
| --- | --- |
| Standard iPhone (393 pt) | 85 |
| iPhone Duo outer display (466x678 pt) | 29 |
| iPhone Duo inner display, flat (890x626 pt) | 6 |
| iPhone Duo half-folded (1/2 + 1/2) | 1 |
| iPhone Duo laptop pose (626x890 pt) | 3 |

Duo is the declared primary target, yet 85 stories start on a standard iPhone. Standard layouts are now drawn for Home, Thread, Group thread, Inbox, Computer and the space menu (`PH-*`), but not for Artifacts, Settings, sign-in, compose, Cleanup, the Inbox message, Activity or the Pages, so many of those stories still judge a standard iPhone step against an outer-display board. Several also describe a Duo variation.

## Coverage Matrix

Feature areas come from the Feature Map in `docs/ios-native/ux/discovery.md`, plus four areas that discovery names outside the map (global search, notification list and preferences, onboarding cards, usage and billing). Status: **Covered** means at least one story exercises the main path. **Partial** means a story touches it only as an alternate path, edge case or setting. **None** means no story.

| # | Feature area | Phase | Stories | Status | Gap |
| --- | --- | --- | --- | --- | --- |
| 1 | Scaffold, tokens | #412 | none | N/A (no UI) | Light mode and Dynamic Type are not walked by any story |
| 2 | Contracts export | #413 | 010, 028 (indirect) | N/A (no UI) | Older-server and unknown-block behavior only |
| 3 | Server selection | #414 | 002, 006, 009, 010 | Covered | |
| 4 | Sign in, sign up, reset, SSO | #414 | 001, 003, 004, 005, 008, 113 | Covered | Sign in, sign up, forgot password, "Set new password", "Confirm your email", cooldowns, SSO cancel and failure, loading and failed options, "Session ended": drawn. Not drawn: sign-up errors and pending, how the reset link returns to the app, the first-time SSO setup screen |
| 5 | Home (Inbox row, Activity, Pages, Personnel) | #415 | 011, 013, 012, 111, 118 | Covered | Standard and outer Home drawn with loading, error, offline, empty, pinned and unread frames (outer); Activity list drawn (outer). Standard Home error states, inner Activity and pull to refresh are not |
| 6 | Spaces (list, switch, create, rename, delete) | #415 | 015, 016, 109, 110 | Covered | Title menu, "Switching" state, Space settings and delete confirmation drawn; inner open menu, switch failure and the standard Space settings page are not |
| 7 | Create bot, create group | #415 | 012, 014, 104 | Covered | New bot, New group, New space sheets with working and error frames drawn; menu says "New agent", sheet says "New bot" |
| 8 | Bot and group settings, archive, sections, pins | #415 | 017, 018, 020 | Covered | Chat menu, archive alert, archived banner, Archived bots page and group delete drawn; section headings and "Delete chat" copy are not |
| 9 | Thread read | #416 | 021 to 032, 124 | Covered | |
| 10 | Thread write (composer, attachments, outbox, reactions, replies, stop) | #417 | 033 to 044 | Covered | Offline, failed, refused, oversize file, stop, "Stopping", no model drawn; reactions, mentions and upload progress are not |
| 11 | Approvals (tool, mail, secret, MCP, choice) | #417 | 045, 046, 047, 050, 051, 053, 054, 125 | Covered | Mail card (Edit, Send) with updating, replaced and empty-recipient states and the edit page drawn; no decline control; always-allow review (055) now drawn on the AI data sharing page |
| 12 | AI data consent prompt | #417 | 048, 094, 052, 117, 121 | Covered | Speech sheet, Settings page and the Inbox "Consent needed" prompt drawn; the model sheet is not (the Connect sheet carries a disclosure); the "Not now" outcomes are not |
| 13 | Inbox list (sections, filters, search, swipe) | #418 | 056, 060, 064, 063, 121 | Covered | Standard list drawn with To do, swipe, Undo, failure, zero, writes-off, reconnect, no account, consent and first-sync frames; no standard message view |
| 14 | Inbox message | #418 | 057, 119 | Covered | Preview, thread, unsubscribe, next message, failure frames drawn (outer); standard iPhone view is not |
| 15 | Compose, reply, forward, to-dos | #418 | 058, 059, 061, 065, 114, 127 | Covered | Compose, Reply, Forward menu, Edit draft, Cc suggestions, sending, not sent, unknown and writes-off frames drawn for the outer display; standard iPhone and inner placement are not |
| 16 | Inbox cleanup and unsubscribe | #418 | 062, 115, 119 | Covered | Menu, selection, confirmation, progress, failure, Done, empty and History drawn (outer); bulk unsubscribe confirmation and outcomes, and a standard iPhone Cleanup, are not; scope in phase 6 unconfirmed |
| 17 | Duo layouts (outer, inner, half-folded, laptop) | #419 | 029, 030, 064, 085, 098 to 108 | Covered | Laptop pose only drawn for Finance |
| 18 | Team Computer | #420 | 067, 068, 102, 122 | Covered | Watching, in control, agent waiting, starting, control ended, reconnecting, denied and cannot connect drawn on the standard iPhone and outer display; laptop pose draws only the in-control state |
| 19 | Artifacts (browse, versions, share, delete, image) | #420 | 069, 070, 071, 072, 108 | Covered | Home has an ARTIFACTS section; image viewer with Versions, Delete and "Saved to Photos" drawn; the list at 393 pt and document delete and versions are not |
| 20 | Agent pages and lists | #420 | 073, 074 | Covered | Load-error frames with Retry drawn |
| 21 | Routines | #420 | 075, 076, 120 | Covered | List, detail, Pause and Edit menu, run history, failed run and "Run again" drawn; the edit screen, create, delete and the route to the list are not |
| 22 | Settings (account, models) | #421 | 087, 088, 089, 090, 007, 095, 112, 126 | Covered | Account (delete variants, Hide amounts, Language, Appearance), Models menus and provider detail, Archived bots and AI data sharing drawn; Change password page and a Server row are not |
| 23 | Integrations | #421 | 093, 097 | Covered | |
| 24 | Push | #422 | 106 | Partial | No story for permission prompt, banner suppression for the open thread, or Activity dot |
| 25 | Voice (dictation, call loop, settings, player) | #423 | 091, 092, 052, 123 | Partial | Voice settings states, microphone denied and the Speech consent sheet drawn; no dictation or call-loop story and no call screen board |
| 26 | Finance | #424 | 078, 079, 103 | Covered | Entry drawn (PAGES row) |
| 27 | Legal | #424 | 080, 081 | Covered | Entry drawn (PAGES row with deadline count) |
| 28 | Cap table | #424 | 082 | Covered | Entry drawn (PAGES row) |
| 29 | Data room | #424 | 083, 084 | Covered | Entry drawn (PAGES row) |
| 30 | Platform extras (Live Activities, App Intents, share extension, widgets) | #425 | 106 (mention only) | None | No story; no boards |
| 31 | Release (TestFlight, screenshots) | #426 | none | N/A (no UI) | |
| 32 | Global search (`search.query`, jump) | #416 | 031, 060 (mail search only) | Partial | Cross-thread search results screen is not drawn or walked |
| 33 | Notification list and preferences | #422 | none | None | Only a settings specimen in DS-05 |
| 34 | Onboarding choice cards and focus prompts (`onboarding/*`) | #415 | 054 (choice card only) | Partial | `onboarding/*` flow has no story |
| 35 | Usage and billing | #421 | none | None | Billing decision (in-app purchase vs web) is open |

Counting rule: rows 1, 2 and 31 are not applicable, leaving 32 areas. Covered: rows 3 to 22 and 23, 26 to 29 = 25. Partial: rows 24, 25, 32, 34 = 4. None: rows 30, 33, 35 = 3. Round 2 moved row 21 (Routines) from Partial to Covered: a routines list, history, a failed run, "Run again" and a Pause and Edit menu are now drawn and walked by STORY-120.

## Story Dependency Graph

Read "A -> B" as "B assumes the state A produces". IDs are catalog IDs.

```
Install, signed out
  006 server unreachable / capabilities fail
  002 custom server  (-> back to 001)
  010 older API server
  009 Duo setup with custom server (-> 001)
  001 sign in
    003 SSO              004 sign up (+ verify)      005 reset password -> 113 resend the link
    008 session rejected (re-enter at 001)     126 switch server while signed in (from Settings; ends at 001 on the new host)
    -> 011 Home (needs-me, Activity approve)
         013 Home load failure / recovery   118 Activity list (bell or See all; needs 011)
         012 first bot (empty Home)
           -> 019 no model connected
                -> 111 connect from the Home card (-> 044 first message)
                -> 089 connect hosted provider  -> 088 default model  -> 090 local server
                -> 040 send with no model, connect, resend
           -> 044 first message from empty thread (-> 027 empty thread read)
           -> 033 send
                034 attach -> 035 attach limits / HEIC
                036 reply   042 react   041 stop   037 mention (needs 014)
                038 offline -> 039 refused -> 043 long session (038 + 034 + 036 + 039)
                                           -> 116 offline, failed and refused in one thread (038 + 039)
         014 group (-> 026 group thread read, 037 mention)
         015 second space -> 016 space switch on inner display
                             109 switch on standard iPhone    110 switch, rename, delete on outer
         017 bot settings -> 018 archive -> 095 restore archived bot
         020 organize Personnel (pins, sections)
         Read side (all assume a bot exists, 012)
           021 busy thread -> 022 unread divider -> 031 history, paging, saved chat
           023 live work -> 024 reconnect
           025 long reply     028 unknown block     032 mail draft view     124 read-only thread
         Approvals (assume a running thread, 023)
           045 tool Allow -> 050 CONFLICT (second device) -> 055 review Always allow
           046 mail draft approve -> 047 edit and send (needs 058/065 compose)   -> 125 agent revises the draft
           048 first consent -> 117 decline, then allow in Settings -> 094 review and withdraw consent  (-> 052 voice consent)
           051 secret      053 MCP server      054 choice card + writes on
         Inbox (needs mail connected, 066)
           066 first open / first sync -> 121 allow mail reading -> 056 triage -> 057 read message -> 058 reply -> 059 forward   (057 -> 119 unsubscribe from the message)
           060 search and filter   061 to-do   062 cleanup (-> 115 archive three senders, undo)   063 writes off   065 compose (-> 114 on a standard iPhone, 127 recover from a failed send)
           064 inner-display session (needs 056 to 058)
         Agent surfaces
           067 watch computer -> 068 take control -> 102 laptop pose   (068 -> 122 control ended, denied or dropped)
           069 find artifact -> 070 versions -> 072 image -> 108 image across modes; 071 delete
           073 agent page -> 074 list     075 routine (-> 120 failed routine, run again)     077 load failures
           076 month-end handoff (needs 068, 070, 073, 074, 075)
         Money and documents (need integration connected, 093)
           078 Finance -> 079 hide amounts -> 103 Finance in laptop pose
           080 Legal -> 081 Legal blocked (needs 089)
           082 Carta     083 Data room upload -> 084 share file into chat
           085 four pages on Duo     086 sidebar glance
         Settings
           087 open Settings -> 088, 089, 090, 091 (-> 123 microphone off) -> 092 hosted voice, 093 integrations -> 097 server credentials
           007 sign out and delete account (merged 096)   112 delete account
         Duo device stories (assume the matching base story)
           098 outer approve (045)  099 outer mail (056, 057)  100 unfold (any open thread)
           104 create bot (012)  105 short outer (any)  106 push tap (needs 011)  107 inner Settings (087, 088)
```

Longest chain: 006 or 002 -> 001 -> 011 -> 012 -> 019 -> 089 -> 040 -> 033 -> 023 -> 045 -> 050.

## All Stories

Stories are grouped by topic in the order the topics were written. Headings use catalog IDs. Inside each story, references such as "STORY-003" have been rewritten to catalog IDs. The three-digit gaps in numbering (049, 096, 101) are merged stories, listed next. Stories 109 to 117 were added in round 1 and 118 to 127 in round 2, each at the end of its topic.

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
| Session end and sign out | 007 (merged 096), 008, 106, 112, 126 | Sign out, forced sign out, push token cleanup and a server switch share the 401 and Keychain rules and the question of what happens to unsent messages |
| No model connected | 019, 040, 089, 088, 111 | Same `needsModel` state seen from the Home card, from a send, and from Settings |
| AI data consent | 048, 094 (merged 049), 052, 061, 066, 092, 117, 121 | One consent state surfaces at send, dictation, mail triage and Settings; the Speech sheet, the Settings page and the Inbox prompt are drawn, the model prompt is not |
| Mail draft approval | 032, 046, 047, 099, 125 | One approval card in read-only (phase 4), act (phase 5), edit-and-send, outer display and a revised draft |
| Approval on a tool | 011, 045, 050, 098 | Home Activity approve, thread Allow, CONFLICT, and the outer-display variant |
| Inbox on Duo | 060, 064 (merged 101), 099 | Search and filter, inner two-pane, and outer triage |
| Compose | 058, 059, 065, 114, 047, 127 | Entry points to one compose page (Compose, Reply, the Reply menu, Edit draft) and its failure states; drawn for the outer display only |
| Space switching | 015, 016, 106, 109, 110 | Create, inner display, push tap that switches first, the standard title menu, and the outer menu with Space settings |
| Create bot | 012, 014, 104, 019 | Empty Home, group, per-display, and first run |
| Team Computer | 067, 068, 076, 102, 122 | Phone, Duo outer, handoff session, laptop pose and the loss of control |
| Image viewer | 072, 108 | Standard iPhone and across display modes |
| Finance numbers in several places | 078, 073, 076, 079, 103 | Same runway figures on the page, an artifact, an agent page, a chat card and laptop pose |
| Settings on Duo | 087, 088, 107 | Same pages, nested split on inner display |
| Archived bots | 018, 095 | Archive from a thread, restore from Settings |
| Data room | 083, 084, 085 | Upload and search, share into chat, four pages on Duo |
| Sends that wait or fail | 038, 039, 043, 116 | Offline banner, "Waiting to send", "Not sent" with Retry, "Not sent" with a reason and Edit |
| Mail cleanup | 056, 062, 115 | Swipe archive, the long unsubscribe and spam session, and the short archive-and-undo pass |
| Password reset | 005, 113 | First email arrives, and Resend when it does not |
| Activity | 011, 098, 118 | The Home ACTIVITY card, the bell and "See all", and the Activity list |
| Routines | 075, 076, 120 | A routine reached from Activity, the list with a failed run, and the hand-off conversation |
| Server change | 002, 008, 126 | Before sign-in, after a forced sign-out, and while signed in |
| Mail unsubscribe | 062, 115, 119 | From one message and from the Cleanup list |


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
**Design source**: Sign in screen: `PG-B-SignIn.dc.html` (eight frames: default, "Wrong email or password", "Loading sign-in options", "Could not load sign-in options" with Retry, "Session ended" banner, the iOS SSO consent prompt, "Sign-in was cancelled", and a failed SSO with a long provider name). Default frame: wordmark "Praci", title "Sign in", SSO button, "or", grouped Email and Password, prominent full-width ink "Sign in", then links "Use a custom server", "Forgot password?" and "New to Praci? Sign up"; rule card "Sign in". Home after sign-in: `PG-A-Home.dc.html` and `PH-Home.dc.html` (out of scope here).

#### Steps
1. Launch the app → The root screen shows the wordmark "Praci", the title "Sign in", the SSO button and "or" (the board draws them even though this server reports no SSO), then grouped Email and Password fields. No Back control. Capabilities load first ("Loading…" per the rule card).
2. Tap the "Email" field and type `maya@example.com` → Keyboard opens, field shows text.
3. Tap the "Password" field and type the password → Text is masked.
4. Tap "Sign in" → Button shows a working state, `POST /api/auth/sign-in/email` succeeds, the token goes to the Keychain, the selected space is cleared first, and the app replaces the root with Home.

#### Variations
- Wrong password: the grouped fields get a red outline and a red line under them reads "Wrong email or password" (board frame 2; Expo says "Could not continue"). Fields keep their values.
- Email field empty or password shorter than 8: `credentialIssue` returns a local message before any request (Expo `credentialIssueText`). The board does not show these texts.

#### Edge Cases
- Rate limit (10 attempts per 15 minutes on auth routes) returns an error; no rate-limit message is drawn, only the wrong-credentials line.
- Token arrives only in the `better-auth.session_token` cookie: the client must fall back to it (README section 4).
- Double tap on Sign in: the Expo app ignores a second submit while pending.

#### Design gaps
- No board for the button's pending label (Expo: "Working…") or for local validation messages (empty email, password under 8 characters); the wrong-credentials state is now drawn.
- No board for the Password field Go key behavior or focus order.
- DECISION: which mode (sign in or sign up) the app opens in for a first launch is not decided; Expo opens sign-up. Both modes are now drawn (`PG-B-SignIn`, `PG-B-SignUp`), so the choice no longer needs a board, only a decision.


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
**Design source**: `PG-B-SignIn.dc.html` ("Use a custom server" link); `PG-B-Server.dc.html` (eight frames: nothing entered, "Checking server" with a working Save, "Enter a full address, like https://app.example.com", the http warning with Save still allowed, "This is not a Praci server", "Could not reach this server" with Save relabeled Retry, and the signed-in "Switch server?" alert). Each frame: Cancel xmark, Save prominent, one sentence "Enter your Praci server address.", URL field, "Use default server". Rule card "Server". `PG-B-SignUp.dc.html` carries the same link.

#### Steps
1. On the sign-in screen tap "Use a custom server" → The Server sheet opens at a medium detent.
2. Read "Enter your Praci server address." → The URL field (placeholder `https://app.example.com`, accessibility label "Server address") shows the default host as its placeholder.
3. Type `praci.example.test` → Field accepts input; any earlier error clears. "Use default server" appears once the text differs from the current address.
4. Tap Save → Save shows a spinner while the app probes `POST /rpc/health`; the address is normalized to origin only (scheme, host, port).
5. The sheet closes → Sign in shows the new host. The link now reads "Custom server praci.example.test" (Expo accessibility label "Custom server {host}").
6. Capabilities reload for the new host → SSO button and reset link appear or disappear to match the new server.
7. Enter Email and Password, tap "Sign in" → Signed in against the company server.

#### Variations
- Choose "Use default server" later from the same sheet to go back; the placeholder host returns.
- Plain `http://` is accepted only for loopback, `.local`, private ranges and Tailscale (README section 4). The board draws a warning under the field, "This address is not encrypted. Anyone on the network can read what you send.", with Save still enabled; Expo shows "Public servers need https://. HTTP only works on your local network." for public hosts.

#### Edge Cases
- Unreachable or timed out (8 s): red line under the field ("Could not reach this server" on the board; Expo text is "Could not reach that server"), the typed address is kept and Save becomes "Retry".
- Reachable but not a Praci server: the board draws "This is not a Praci server" (Expo: "That URL did not look like a Praci server").
- Not a URL, empty, or missing host: the board draws one line, "Enter a full address, like https://app.example.com". Expo has four distinct texts ("Enter a server URL", "That doesn’t look like a URL", "That URL is missing a host", "Use an http or https URL"); the board needs one copy decision.
- Changing servers while signed in wipes token, selected space and caches (README section 4): the board draws a "Switch server?" alert ("You will be signed out. Conversations saved on this iPhone are removed and load again from the new server.", Cancel, Switch). See STORY-008.
- Tap Cancel (xmark) with an unsaved address: no change.

#### Design gaps
- Label mismatch: board "Could not reach this server" vs Expo "Could not reach that server". The product name now matches (board and Expo both say "Praci server").
- No Server row on the Settings board even though the rule card says the sheet opens from Settings.
- The same server host is shown on the sign-in link and (planned) Settings; its exact format is only defined in Expo (`displayApiHost`).
- "Use default server" is drawn in every frame, including the empty one where it would do nothing; the steps say it appears only once the text differs from the current address.
- The "Switch server?" alert says saved conversations are removed but not what happens to messages "Waiting to send" or unsent drafts; the Sign in "Session ended" banner promises "Unsent drafts are kept" for a forced sign-out, so the two statements need one rule.


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
**Design source**: `PG-B-SignIn.dc.html` (SSO button at the top of the card, "or" divider; frames for the iOS consent prompt ("“Praci” Wants to Use “sso.example.com” to Sign In", Cancel, Continue), "Sign-in was cancelled", and "Could not sign in. Try again." under a two-line provider name "Continue with Northwind Industries Corporate Single Sign-On"), `PG-B-SignUp.dc.html` (same button), rule card "Sign in". The provider web page itself is system UI (`ASWebAuthenticationSession`): not drawn.

#### Steps
1. Open the app → Sign in shows the button "Continue with Example SSO", then "or", then the email fields.
2. Tap "Continue with Example SSO" → The app calls `POST /api/auth/sign-in/social` with `disableRedirect`, reads the `better-auth.oauth_state` cookie, and opens the Expo authorization proxy in `ASWebAuthenticationSession` with callback scheme `rakazo`. iOS shows its standard consent prompt (drawn: "“Praci” Wants to Use “sso.example.com” to Sign In", Cancel and Continue).
3. Sign in at the provider page → The session closes on the `rakazo://sign-in` callback, the token is parsed from the callback `cookie` parameter, confirmed with `GET /api/auth/get-session`, saved to the Keychain, and the app replaces the root with Home.

#### Variations
- Expo places the SSO button below the form as a quiet button in one layout path and above as a prominent button in another; the board puts it first. Native should follow the board.
- Account created for the first time through SSO may need integration setup (see Design gaps).

#### Edge Cases
- User cancels the system sheet: a quiet line "Sign-in was cancelled" appears under the SSO button and the pending state ends (board frame).
- Provider returns without a token or `get-session` fails: a red line under the button reads "Could not sign in. Try again." (board frame; Expo says "Could not continue").
- Server drops SSO between launches: capabilities no longer include `sso`, so the button disappears.

#### Design gaps
- First-time SSO users: Expo routes sign-up to `/integration-setup` when `integrationSetup/get` says `needsSetup`. The frame labelled "First-time SSO setup" draws only the iOS consent prompt over Sign in. The setup form itself exists as "Server integrations" in `PG-B-Integrations`, but no board or plan line says that a new SSO user is sent there.


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
**Design source**: `PG-B-SignIn.dc.html` ("New to Praci? Sign up"); sign-up form: `PG-B-SignUp.dc.html` (one frame: wordmark "Praci", title "Sign up", SSO button, "or", Name, Email, Password, ink "Create account", "Use a custom server", "Have an account? Sign in"). "Confirm your email" state: `PG-B-ForgotPassword.dc.html` frames 5 and 6 ("Confirm sam@example.com to finish creating your account. We sent a link.", ink "Open Mail", "Resend confirmation", then "Resend confirmation in 0:42" while dimmed, "Back to sign in", strip Back chevron). Mail app and link: system UI.

#### Steps
1. On Sign in tap "Sign up" in "New to Praci? Sign up" → The screen switches to sign-up mode: title becomes "Sign up" (board; Expo says "Sign up for Praci"), a "Name" field appears above Email, the button reads "Create account" (board; Expo says "Sign up"), the link reads "Have an account? Sign in".
2. Type name "Jamal Reyes", email and an 8-or-more character password → Fields accept input. Name is optional; Expo falls back to the part of the email before `@`.
3. Tap "Create account" → `POST /api/auth/sign-up/email` runs.
4. Server answers with verification required and no session → Title becomes "Confirm your email" with "Confirm {email} to finish creating your account. We sent a link.", an ink "Open Mail", a quieter "Resend confirmation" (dimmed as "Resend confirmation in 0:42" during the cooldown) and "Back to sign in"; VoiceOver announces the title.
5. Tap "Open Mail", tap the verification link → The link verifies the account in the browser.
6. Return to Praci → The screen still shows "Confirm your email" with "Resend confirmation" and "Back to sign in".
7. Tap "Back to sign in", enter Email and Password, tap "Sign in" → Signed in.
8. Home loads → New account, no model connected: `PG-A-HomeNoModel` frame 1 shows Chief "Connect a model to chat" and a card "Connect a model to start chatting." (STORY-111); with a model already present, `PG-A-Home` "Empty space" shows "No agents yet" and a "New agent" button.

#### Variations
- Password under 8 characters: local message before the request.
- Email already registered: server error shows in the red line.

#### Edge Cases
- App is killed between steps 4 and 6: it reopens at the default root mode; the user must re-enter the email.
- The verification link opens in Safari, not the app; no `rakazo://` deep link is defined for verification in the plan.
- Rate limit (10 per 15 minutes) applies to sign-up too.

#### Design gaps
- Sign-up form copy and states: the single sign-up frame does not mark Name as optional, shows no password rule (8 or more characters), and draws no error line (email taken, weak password) or pending state on "Create account". The account-deleted banner on this screen is drawn only in `PG-B-Account` (STORY-112).
- No design for returning to the app after verification: the link opens in Safari and the app stays on "Confirm your email" (the Resend cooldown is now drawn).
- Default launch mode (sign-up in Expo, sign-in on the board) is undecided.
- Label mismatch between the board and Expo: "Create account" and "Sign up" (title) vs Expo "Sign up" (button) and "Sign up for Praci" (title).


### STORY-005: Reset a forgotten password
**Type**: medium
**Topic**: First run: server, sign in and recovery
**Source**: topics/first-run.md STORY-005
**Phase issue**: #414 (P2)
**Persona**: Lena Fischer, operations lead who changed phones and forgot her password
**Goal**: Request a reset link, set a new password in the browser, and sign in.
**Preconditions**: Server capabilities report `passwordReset: true` and a `resetUrl`.
**Device**: standard iPhone
**Ideal path**: 7 — Forgot password?, type Email, Send link, Open Mail and tap the link, type the new password twice, Set password, then Sign in if the app does not sign her in (the screen after "Set password" is not drawn).
**Alternate paths**: SSO if the account is linked (STORY-003). Change password from Settings once signed in (STORY-007 mentions it; no screen).
**Design source**: "Forgot password?" link on `PG-B-SignIn.dc.html`. `PG-B-ForgotPassword.dc.html` frames 1 to 4: "Reset password" (Email, ink "Send link", "Back to sign in", strip Back chevron); "Check your email" ("We sent a link to sam@example.com.", "Open Mail", "Resend", "Back to sign in"); the same with "Resend in 0:42" dimmed; and "Set new password" (New password, Confirm password, "At least 8 characters", ink "Set password", Back chevron). The mail link and the page it opens: not drawn.

#### Steps
1. On Sign in tap "Forgot password?" → The screen changes to forgot mode: title "Reset password" (board; Expo says "Reset your password"), only the Email field remains, the ink button reads "Send link" (board; Expo says "Send reset link"), the bottom link reads "Back to sign in", and a Back chevron sits in the strip.
2. Type the email address → Field accepts input.
3. Tap "Send link" → The app calls the server password-reset request with the server's `resetUrl`.
4. Request succeeds → Title becomes "Check your email" with "We sent a link to {email}", "Open Mail", "Resend" and "Back to sign in"; VoiceOver announces the title.
5. Tap "Open Mail", open the reset link → The board draws a "Set new password" screen in the app (New password, Confirm password, "At least 8 characters", "Set password"). Whether the link opens the app (universal link) or the server's web reset page in Safari is not stated, so the screen may be a browser page instead.
6. After "Set password", or when returning to Praci and tapping "Back to sign in" → Sign-in mode returns with the error line cleared. No success state is drawn.
7. Enter Email and the new password and tap "Sign in" → Signed in.

#### Variations
- Same flow from an inner display or half-folded pose: the card is centered at 380 pt on the 2/3 side or the left half (rule card).

#### Edge Cases
- Server has no reset: the link is not shown. If reached anyway, Expo throws "Password recovery is not configured for this server".
- Capabilities request fails: `PG-B-SignIn` now draws "Could not load sign-in options" with a Retry button and the "Use a custom server" link in place of the form.
- Unknown email: the server's behavior is not stated in the plan; the screen would show the same confirmation or an error.

#### Design gaps
- How the reset link reaches the app, and what "Set password" does next (sign in directly, or return to Sign in), is not drawn or decided; if the web page is used, returning to the app is manual.
- Two ways back are drawn on every screen (strip Back chevron and the "Back to sign in" link); one is redundant. Error lines (unknown email, rate limit, mismatched passwords, expired link) and the case of no mail app on the phone are not drawn. The Resend cooldown is now drawn.
- Label mismatch between the board and Expo: "Reset password" and "Send link" vs "Reset your password" and "Send reset link".


### STORY-006: Server is unreachable or capabilities fail on first launch
**Type**: short
**Topic**: First run: server, sign in and recovery
**Source**: topics/first-run.md STORY-006
**Phase issue**: #414 (P2)
**Persona**: Dev Anand, founder on a train with patchy signal
**Goal**: Recover from a failed first load and reach the sign-in form.
**Preconditions**: Fresh install, no connectivity to the default server at first.
**Device**: standard iPhone
**Ideal path**: 3 — see the error, tap Try again, form appears once the network returns.
**Alternate paths**: Open "Use a custom server" and pick another address (STORY-002). Wait for the network and relaunch.
**Design source**: `PG-B-SignIn.dc.html` frames 3 and 4: "Loading sign-in options" (title, a button-shaped row with a spinner, "Use a custom server") and "Could not load sign-in options" (red line, a "Retry" button, "Use a custom server"). Rule card "Sign in".

#### Steps
1. Launch the app with no signal → Sign in shows the title and a spinner row "Loading sign-in options" while `GET /api/auth/capabilities` runs (8 s timeout in the Expo client). No fields are shown yet.
2. The request fails → A red line "Could not load sign-in options" and a "Retry" button replace the form. The "Use a custom server" link stays reachable.
3. Signal returns, tap "Retry" → Capabilities load and the form appears with the right SSO and reset options.

#### Variations
- An old server returns the legacy capabilities shape: the client treats it as password only; the SSO button and "Forgot password?" do not appear.

#### Edge Cases
- Failure repeats: the same message stays; no count or detail is shown.
- Server reachable but returns non-JSON: treated as failure.
- Airplane mode: the only action that does not need the network is opening the Server sheet.

#### Design gaps
- No board for the "sign-in screen when offline" in general; no distinction between "no network" and "server wrong".
- The drawn failure state hides the email fields entirely, so a user with a known-good server cannot even type while retrying; whether that is intended is not stated.


### STORY-007: Sign out, then delete the account
**Type**: long
**Topic**: First run: server, sign in and recovery
**Source**: topics/first-run.md STORY-007
**Phase issue**: #414 (P2), #421 (P9)
**Persona**: Grace Whitfield, founder who is shutting down her test workspace and removing her data
**Goal**: Sign out of the app, sign back in, and permanently delete the account.
**Preconditions**: Signed in with email and password on the default server. Two bots, several saved chats, push enabled.
**Device**: standard iPhone
**Ideal path**: 11 — avatar, profile row, Sign out, then email, password, Sign in; avatar, profile row, Delete account, type password, Delete; land on Sign up. (The board draws no sign-out confirmation; adding one would make it 12.)
**Alternate paths**: Delete without signing out first (STORY-112). Delete an SSO-only account with "Sign in again" (re-authenticate) or "Send deletion code" and the emailed code (steps 9 to 10 variations). Sign out from Duo inner display Settings (detail in the 2/3 pane).
**Design source**: `PH-Home.dc.html` and `PG-A-Home.dc.html` (round "AB" avatar), `PG-B-Settings.dc.html` (profile row "Sam Rivera / Account"), `PG-B-Account.dc.html` (seven frames: Account with Email, Change password, Hide amounts, Language, Appearance, a plain "Sign out" row and a red "Delete account"; the delete alert with an empty password and Delete dimmed; "Wrong password"; the SSO variant "You will confirm with Example SSO first." with "Verify with SSO"; the emailed-code variant with a "6-digit code" field; "Deleting your account" with a spinner; and "After delete", which is the Sign up screen with a "Your account was deleted" banner). There is no sign-out confirmation frame.

#### Steps
1. On Home tap the "AB" avatar at the top left → The Settings sheet opens (rule card: "Opened as a sheet from the sidebar profile"; the avatar is the drawn entry on both standard and outer Home).
2. Tap the profile row showing the user name and "Account" → The Account detail pushes.
3. Tap "Sign out" → The app calls sign-out, clears the Keychain token, selected space, saved chats, outbox and caches, and bumps the session generation. No confirmation sheet is drawn (an earlier catalog described a "Sign out of Praci?" sheet; `PG-B-Account` has none), so one tap discards anything still "Waiting to send".
4. App replaces everything with Sign in → The settings sheet closes at any depth; Sign in is the only screen. Push notification registration for this device should end (not specified).
5. Enter Email and Password, tap "Sign in" → Home loads, caches are empty and refetched.
6. Reopen Settings → profile row → Account.
7. Tap "Delete account" → For a password account an alert titled "Delete your account?" shows "This permanently deletes your account, bots, conversations, memories, files, and saved connections. This cannot be undone.", a secure "Current password" field, Cancel and a dimmed "Delete".
8. Type the current password → The password field is secured.
9. Tap "Delete" → `/api/auth/delete-user` runs with the password.
10. Deletion succeeds → While it runs, a "Deleting your account" card with a spinner shows. The app then clears local state and replaces everything with Sign up carrying the banner "Your account was deleted".
11. Tap "Sign in" and try the old email and password → Sign in shows the red line "Wrong email or password".
12. Confirm Home is not reachable → Only Sign in is available; no cached data appears.

#### Variations
- Account without a password (SSO): the alert drops the field and says "You will confirm with Example SSO first.", with Cancel and "Verify with SSO". An account that uses an emailed code shows a "6-digit code" field, "We emailed a code to sam@example.com." and a dimmed Delete (all drawn).
- Sign-out fails (offline): Expo shows "Could not sign out" and keeps the session.
- Wrong password: a red "Wrong password" line appears inside the alert and Delete is active again (drawn; Expo says "Could not delete account").

#### Edge Cases
- Another device deletes the account first: the next call returns 401 and the session is rejected (STORY-008).
- A queued outbox message exists at sign-out: the outbox is wiped with the session; the user is not warned.
- Delete during a running agent: the plan does not say what happens to runs.
- App Store rule 5.1.1(v) requires in-app deletion; this path satisfies it only if the entry point is visible from the app.

#### Design gaps
- The Account board shows "Change password" but its destination screen (current password, new password, token replacement) has no board.
- The plan does not state whether sign-out unregisters the push token. Sign-out has no confirmation, and nothing warns about messages still "Waiting to send", which are wiped with the session.
- Account now draws Hide amounts, Language and Appearance. The other Expo extras (Notifications, Usage, Avatar style, Live update) still have no home on the iOS boards.
- `PG-B-Rules.dc.html` "Settings" still lists "Change password" as a Settings root row; `PG-B-Settings` no longer draws it. The rule card needs to follow the board.


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
**Design source**: `PG-B-SignIn.dc.html` frame 5 "Session ended" (a card "Your session ended / Sign in again to continue. Unsent drafts are kept." above the normal form with the email kept). `PG-A-ThreadStates.dc.html` "Session ended" (inside a thread: "Session ended / Sign in again to keep chatting.", a "Sign in" button, composer disabled with "Sign in to send messages"). The stale-space recovery: NO BOARD.

#### Steps
1. Open the app from the background and tap a bot → An RPC call returns 401 without a space header.
2. The app treats the session as rejected → It clears the Keychain token and caches and replaces the whole stack with Sign in (Expo `replaceWithSignIn`, explicit mode "in").
3. Sign in shows the "Your session ended" card → "Sign in again to continue. Unsent drafts are kept." and the email field is prefilled. When the 401 arrives inside an open thread, the thread can instead show its own "Session ended" state with a "Sign in" button.
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
- Recovery from a stale space: the space menu (`PH-Spaces`, `PG-B-Spaces`) can host it, but nothing is drawn for the moment a space disappears (which space is selected, whether the user is told).
- "Unsent drafts are kept" is drawn, but not where they reappear after sign-in (thread composer, outbox row, or Home) or what happens to a message that was already "Waiting to send". Step 2 and the thread "Session ended" state describe two different recoveries (replace the stack with Sign in, or stay in the thread and offer Sign in); one rule is needed.
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



### STORY-112: Delete the account from Settings
**Type**: medium
**Topic**: First run: server, sign in and recovery
**Source**: ux-paths round 1 refresh (boards `PG-B-Settings`, `PG-B-Account`)
**Phase issue**: #421 (P9)
**Persona**: Corin Whitlock, founder who is closing a pilot workspace and wants all data removed
**Goal**: Permanently delete the account and its data, and confirm that the app no longer opens it.
**Preconditions**: Signed in with email and password on the default server; two bots, saved chats and push enabled.
**Device**: standard iPhone
**Ideal path**: 6 — tap the "AB" avatar, tap the profile row, tap "Delete account", type the password, tap "Delete", land on Sign up.
**Alternate paths**: (a) Sign out first (STORY-007 covers both). (b) An SSO-only account taps "Verify with SSO", or an emailed-code account types the 6-digit code (both drawn). (c) Ask for a data export first (`account.exportRequest`; no entry is drawn).
**Design source**: `PH-Home.dc.html` ("AB" avatar), `PG-B-Settings.dc.html` (profile row "Sam Rivera / Account"), `PG-B-Account.dc.html` (seven frames, see STORY-007): Account with Email, "Change password", Hide amounts, Language, Appearance, "Sign out" and a red "Delete account"; the delete alert with a "Current password" field and a dimmed Delete; "Wrong password"; the SSO variant "Verify with SSO"; the emailed-code variant; "Deleting your account"; and "After delete" (Sign up with a "Your account was deleted" banner).

#### Steps
1. On Home tap the "AB" avatar → Settings opens as a sheet.
2. Tap the profile row "Sam Rivera / Account" → the Account page pushes.
3. Read the page → profile, Email, "Change password", Hide amounts, Language, Appearance, a plain "Sign out" and "Delete account" in red, set apart at the bottom.
4. Tap "Delete account" → an alert "Delete your account?" with the permanent-deletion text, a secure "Current password" field, Cancel and a "Delete" that stays dimmed until something is typed.
5. Type the password → the field is masked.
6. Tap "Delete" → `/api/auth/delete-user` runs with the password; a card "Deleting your account" with a spinner covers the page.
7. Success → the app clears the Keychain token, the selected space, saved chats, the outbox and caches, and shows Sign up with the banner "Your account was deleted".
8. Tap "Sign in" and try the old email and password → the red line "Wrong email or password".

#### Variations
- Wrong password: a red "Wrong password" line appears in the alert and Delete is active again (drawn; Expo says "Could not delete account"); nothing is deleted.
- Tap Cancel: the alert closes and nothing changes.
- SSO-only account: the alert says "You will confirm with Example SSO first." and offers "Verify with SSO" (drawn). An emailed-code account sees a "6-digit code" field (drawn).

#### Edge Cases
- Offline: the call fails and the account remains; the error copy is not drawn.
- Another device deletes first: the next call returns 401 (STORY-008).
- The user owns a shared space, or has an active hosted plan: what happens to them is not stated.
- Messages still "Waiting to send" are lost with the account; the alert does not mention them.
- App Store rule 5.1.1(v): the path is three taps from Home, so the in-app entry requirement is met by this board.

#### Design gaps
- Nothing says what happens to shared spaces, active runs and routines, or a hosted subscription; "saved connections" is the only mention of integrations.
- No data export entry on the Account page.
- Whether sign-out and deletion unregister the push token is not stated.
- Offline or server-error during delete has no drawn state (only the wrong-password line); the "Deleting your account" card has no cancel or timeout.
- After deletion the user lands on Sign up, but nothing says whether a new account can reuse the same email or whether a data-retention notice should appear.


### STORY-113: Resend the reset link when the email does not arrive
**Type**: short
**Topic**: First run: server, sign in and recovery
**Source**: ux-paths round 1 refresh (board `PG-B-ForgotPassword`); STORY-005 covers the main path
**Phase issue**: #414 (P2)
**Persona**: Maren Kovacs, operations lead whose reset email lands late
**Goal**: Get a working reset link after the first email did not arrive, set a new password and sign in.
**Preconditions**: Server capabilities report `passwordReset: true`. The account exists.
**Device**: standard iPhone
**Ideal path**: 7 — Forgot password?, type Email, Send link, Resend, Open Mail and set the password, Back to sign in, Sign in.
**Alternate paths**: (a) The first email arrives: STORY-005. (b) The address was mistyped: tap the Back chevron, correct it and send again. (c) Give up and use SSO if the account is linked (STORY-003).
**Design source**: `PG-B-ForgotPassword.dc.html` (frame 1: "Reset password", Email, ink "Send link", "Back to sign in", strip Back chevron; frame 2: "Check your email", "We sent a link to sam@example.com.", ink "Open Mail", quieter "Resend", "Back to sign in"; frame 3: the same with "Resend in 0:42" dimmed; frame 4: "Set new password"); `PG-B-SignIn.dc.html` ("Forgot password?").

#### Steps
1. On Sign in tap "Forgot password?" → the Reset password screen shows only the Email field.
2. Type `maren@example.com`, tap "Send link" → the screen becomes "Check your email" with "We sent a link to maren@example.com.".
3. Tap "Open Mail" → the Mail app opens; after a minute there is no message.
4. Return to Praci and tap "Resend" → another reset request is sent and the button dims to "Resend in 0:42" (drawn); no "Sent" message is drawn.
5. The message arrives; open the link in Mail → the board draws a "Set new password" screen (New password, Confirm password, "At least 8 characters", "Set password"); whether it is in the app or on the server's web page is not stated. Set the new password.
6. Return to Praci and tap "Back to sign in" → the sign-in form returns.
7. Enter the email and the new password, tap "Sign in" → Home.

#### Variations
- The address was wrong: the confirmation names the address, so the user sees the typo; the way to fix it is the strip Back chevron (the link "Back to sign in" goes further back).
- Resend twice: both links may work; which one the server honors is not stated.

#### Edge Cases
- Rate limit (10 requests per 15 minutes on auth routes): Resend returns an error; none is drawn.
- No mail app on the phone: "Open Mail" has nothing to open.
- Link expired: the browser page says so; the app cannot tell.
- Unknown email: the server's reply is not stated; the screen would show the same confirmation or an error.
- Offline: the request fails; no error is drawn.

#### Design gaps
- The confirmation has no "Change email" action; Back is the only way to correct the address.
- Two back controls (strip chevron and "Back to sign in") do different things without saying so.
- "Open Mail" opens only the default mail app; webmail users get nothing.
- Whether the link opens the app and what "Set password" does next (sign in, or return to Sign in) is not drawn.
- Error lines for the request (unknown email, rate limit, offline) are not drawn.
- The Resend cooldown is drawn, but not what happens when the timer ends or when a second email is sent while the first link is still valid.


### STORY-126: Switch to another server while signed in
**Type**: medium
**Topic**: First run: server, sign in and recovery
**Source**: ux-paths round 2 (board `PG-B-Server`, frame "Signed in: confirm switch")
**Phase issue**: #414 (P2), #421 (P9)
**Persona**: Idris Falk, consultant who moves from a test server to his client's server
**Goal**: Point the app at the client's server without leaving old data behind.
**Preconditions**: Signed in on the default server; two messages are "Waiting to send"; the client server `https://praci.example.test` is reachable.
**Device**: standard iPhone
**Ideal path**: 6 — open the Server sheet, type the address, Save, confirm "Switch", then sign in on the new server (email, password, Sign in adds 3).
**Alternate paths**: (a) Sign out first and change the server from Sign in (STORY-002). (b) Use a second phone.
**Design source**: `PG-B-Server.dc.html` (frame "Signed in: confirm switch": the sheet with the address typed and an alert "Switch server? / You will be signed out. Conversations saved on this iPhone are removed and load again from the new server." with Cancel and Switch; the other frames show checking, invalid, http warning, not a Praci server and could not reach). The entry from Settings: NO BOARD (the Settings board has no Server row).

#### Steps
1. Open the Server sheet from Settings (no row is drawn, so the route is assumed) → the sheet shows "Enter your Praci server address." and the current address.
2. Type `praci.example.test` → "Use default server" is drawn; Save is active.
3. Tap Save → the app checks the server (Save shows a spinner), then asks "Switch server?".
4. Read the alert → "You will be signed out. Conversations saved on this iPhone are removed and load again from the new server."
5. Tap "Switch" → the app signs out, clears the token, space, saved chats and outbox, and shows Sign in on the new host.
6. Enter email and password, tap "Sign in" → Home loads from the new server.

#### Variations
- Tap "Cancel": the sheet stays with the typed address and nothing is signed out.
- The address is not a Praci server or cannot be reached: the sheet shows the error before the alert and Save becomes "Retry".
- Tap "Use default server": the app switches back, with the same alert.

#### Edge Cases
- Messages "Waiting to send" are discarded at step 5; the alert does not say so (the Sign in "Session ended" card promises "Unsent drafts are kept" for a forced sign-out).
- The push token for the old server should end; not stated.
- The same account on both servers: nothing links them.

#### Design gaps
- There is no Server row in Settings, although the rule card says the sheet opens from Settings.
- The alert says conversations are removed but not unsent messages or drafts; the drafts rule differs from the forced sign-out card.
- The alert's "Switch" is the destructive action but is not drawn in the destructive colour; "Cancel" and "Switch" have equal weight.
- After "Switch" the user lands on Sign in with no note that the server changed.


## Topic: Home, Personnel and space switching: user stories

Source file: `docs/ios-native/ux/topics/home-spaces.md`

### STORY-011: Check what needs me and approve from Home
**Type**: short
**Topic**: Home, Personnel and space switching
**Source**: topics/home-spaces.md STORY-001
**Phase issue**: #415 (P3)
**Persona**: Maya Okafor, solo founder of a 4-person logistics startup
**Goal**: See at a glance whether anything needs her, then approve the Inbox agent's reply without hunting through threads.
**Preconditions**: Signed in, Personal space selected, the Finance agent is waiting for approval of a $1,200 payment, the Legal agent is mid-run.
**Device**: standard iPhone
**Ideal path**: 3 — open the app (Home is the root), tap the "Finance agent" row in ACTIVITY, tap "Allow once" on the approval card in the thread.
**Alternate paths**: (a) Tap the Activity bell in the top bar (standard iPhone) or the side strip (outer display); it carries a dot, reads "Activity, 1 needs you", and opens the Activity list (`PG-A-Activity`), then the same row. (b) PERSONNEL row "Finance agent" then find the approval card in the thread. (c) Push notification tap (phase 10, no board for the banner) routes straight to the thread.
**Design source**: `PH-Home.dc.html` (standard iPhone: "AB" avatar, "Activity, 1 needs you" bell, Search, prominent "New", space title, ACTIVITY with "See all", PERSONNEL, PAGES, ARTIFACTS), `PG-A-Home.dc.html` (outer display; also frames for loading, "Could not load agents", offline saved data, empty space, pinned and unread rows), `PG-A-Activity.dc.html` (the Activity list and its empty state), PG-A-Rules "Home". The approval card: the Finance agent's payment card is drawn only as the MCP approval card in DS-06 ("Allow once", "Deny"); `PH-Thread.dc.html` and `PG-A-Thread.dc.html` draw the mail card ("Edit" and "Send").

#### Steps
1. Launch the app with a saved session → Home shows the saved Home snapshot, then fresh `bootstrap`/`spaces.list` data replaces it; Inbox row reads "Inbox", "3 need reply".
2. Glance at the ACTIVITY card → "Finance agent / Approve $1,200 payment / Needs you" (with a chevron), "Legal agent / Reading contracts / Working" and "Weekly runway / Ran at 8:00 AM / Done". The bell in the bar also announces "1 needs you".
3. Tap the "Finance agent" Activity row → the agent thread opens with the approval card visible; the Activity count clears once nothing needs her.
4. Tap "Allow once" on the card → the card shows the decision; the "Needs you" row leaves ACTIVITY when she navigates Back.

#### Variations
- Nothing running: ACTIVITY card is hidden ("Activity hides when nothing is running"); Home shows the Inbox row, PAGES and PERSONNEL.
- Several approvals: rows stack in ACTIVITY; "See all" opens the Activity list, grouped TODAY and EARLIER, with "Needs you" rows first (outer display drawn; the standard iPhone and inner display are not). With no activity the list reads "No activity / Agents appear here while they work".

#### Edge Cases
- Cold start with no network: the saved Home renders with an "Updated 5 min ago" line (`PG-A-Home` "Offline, saved data").
- Approval was already answered on web: the thread shows the ask as resolved; a second Allow returns CONFLICT (discovery: "A second answer to the same ask returns CONFLICT").

#### Design gaps
- `PG-A-Activity` is drawn for the outer display only; the standard iPhone and the inner sidebar (a row "Activity / 1 needs you" in `Split`) have no drawn destination.
- Expo labels the header controls "Account", "Activity", "Search", "Artifacts", "Create"; `PH-Home` uses "Account", "Activity, 1 needs you", "Search" and "New". Pick one accessible name for the plus control.
- The row subtitle says "Approve $1,200 payment" while the card button says "Allow once" (payment) or "Send" (mail): three words for one decision. The row status is now the neutral "Needs you".
- ACTIVITY on Home shows three rows while the list also has an EARLIER group (Inbox agent, Brex agent); how many rows Home shows and what "TODAY" and "EARLIER" mean are not stated.
- Whether tapping a "Done" row (Weekly runway) opens the routine (STORY-075) or only reads is not drawn.


### STORY-012: Create the first bot from an empty Home
**Type**: short
**Topic**: Home, Personnel and space switching
**Source**: topics/home-spaces.md STORY-002
**Phase issue**: #415 (P3)
**Persona**: Tomas Reyes, first-time founder who just signed up
**Goal**: Create a bot named "Bookkeeper" and be ready to chat with it.
**Preconditions**: A space with no bots (every bot archived or deleted). A brand-new account is drawn with Chief already present (`PG-A-HomeNoModel`).
**Device**: standard iPhone
**Ideal path**: 3 from the empty state's "New agent" button (type Name, Create), 4 through New and "New agent".
**Alternate paths**: (a) Tap the Personnel row for an existing integration agent instead of creating a bot. (b) Create from the empty state's own "New agent" button (drawn). (c) Create via web and wait for sync.
**Design source**: `PG-A-Home.dc.html` frame "Empty space" (PERSONNEL reads "No agents yet" with a "New agent" button; PAGES stays), the New menu frame ("New agent", "New group", "New space"), `PH-Home.dc.html`, PG-A-Rules "Home". `PG-B-NewBot.dc.html` (sheet "New bot": X Cancel, a "Create" text capsule dimmed until Name has text, fields Name, Role and seven color swatches; frames empty, filled, "Creating", and an error "Check your connection and retry"). A brand-new account is drawn with Chief already present (`PG-A-HomeNoModel`).

#### Steps
1. Open a space that has no bots → PERSONNEL reads "No agents yet" with a "New agent" button (`PG-A-Home` "Empty space").
2. Tap "New agent" in the empty state, or the prominent New (plus) and then "New agent" → the menu offers "New agent", "New group" and "New space".
3. The sheet "New bot" rises (medium detent, grabber) with fields Name and Role and seven color swatches; Cancel (xmark) at top-left, "Create" at top-right dimmed.
4. Type "Bookkeeper" in Name → "Create" becomes enabled.
5. Tap Create → the capsule shows a spinner ("Creating"); the sheet dismisses; Bookkeeper appears in PERSONNEL (Expo: also navigates into the new thread, `app/new.tsx`).

#### Variations
- Fill Role ("Describe what this bot does" placeholder in Expo) and pick a color before Create; Expo's Description field is not on the board.
- Swipe down with a dirty form → "dirty form asks before discarding" (alert wording NO BOARD).

#### Edge Cases
- Server rejects or offline: a red line "Check your connection and retry" appears (board; Expo says "Could not create bot"), fields keep input.
- User has no model connected (`me.needsModel`): bot is created but first message will fail; see STORY-019.
- Duplicate bot names: no rule on whether allowed.

#### Design gaps
- Discard-changes confirmation for a dirty New bot sheet is described in the rule card but not drawn (the Compose and DS-04 action sheets show the pattern).
- After Create, is the user taken to the thread or returned to Home? Rules do not say; Expo opens the thread.
- Expo `app/index.tsx` has a fallback that creates a bot literally named "New Bot" without a form; the board has no such path.
- Boards show a new account with Chief already listed (`PG-A-HomeNoModel`), so an empty Personnel list only occurs after archiving or deleting every bot; whether a new space also starts with Chief is not stated.
- The Home menu says "New agent" but the sheet title and rule cards say "New bot"; one term is needed for the same object (Personnel rows and the thread say "agent").
- The empty-state line "Tap + to create a bot" in `PG-A-Rules` no longer matches the board ("No agents yet" and a button).


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
**Design source**: `PG-A-Home.dc.html` frames "Loading" (ACTIVITY and PERSONNEL headers with no rows, PAGES already listed), "Could not load agents" (PERSONNEL reads "Could not load agents" with a "Try again" button; PAGES and ARTIFACTS stay) and "Offline, saved data" (an "Updated 5 min ago" line over the saved Home). PG-A-Rules "Home" still says "Could not load bots". The standard iPhone (`PH-Home`) draws only the loaded and no-model states.

#### Steps
1. Launch app → ACTIVITY and PERSONNEL show their headers with placeholders while `bootstrap`, `me`, `spaces.list` load; PAGES rows are already visible.
2. Request fails → inside PERSONNEL, "Could not load agents" and a "Try again" button; ACTIVITY is hidden; PAGES and ARTIFACTS stay usable.
3. Tap "Try again" → placeholders reappear, then PERSONNEL fills in with Chief, Finance agent, and so on.

#### Variations
- A saved Home snapshot exists: it renders with "Updated 5 min ago" (drawn); the error should not blank it (rule not stated).
- 401 without a space header: user is signed out and lands on Sign in (discovery "Session end").

#### Edge Cases
- 401 with a space header (stale space): client re-probes without the header and recovers to the default space; user sees no error.
- Error on only `spaces.list` while bots loaded: not specified.

#### Design gaps
- The drawn error is scoped to PERSONNEL, so a failure in `spaces.list` or the Inbox summary has no state of its own.
- Pull-to-refresh is not mentioned in the boards or plan.
- Copy conflict: the board says "Could not load agents", the rule card and Expo say "Could not load bots".
- The Loading, error and saved-data frames exist for the outer display only.


### STORY-014: Create a group of agents and send it to the group thread
**Type**: medium
**Topic**: Home, Personnel and space switching
**Source**: topics/home-spaces.md STORY-004
**Phase issue**: #415 (P3), #419 (P7)
**Persona**: Jonas Weber, head of finance and legal at a 15-person SaaS startup
**Goal**: Make a "Closing team" group containing the Finance agent and the Legal agent, then open its thread.
**Preconditions**: Personal space has Chief, Inbox agent, Finance agent, Legal agent.
**Device**: iPhone Duo outer (466x678)
**Ideal path**: 7 — New, New group, type name, tick two members, Create, open the group from Personnel, (thread opens).
**Alternate paths**: (a) Open an existing group's thread and add members from Group settings instead. (b) Create the group on web and see it in Personnel after refresh. None other planned on iPhone.
**Design source**: `PG-A-Home.dc.html` (New menu; frame "Pinned, group, unread" draws a group row "Launch team" with an avatar stack and an "Ana: The draft is ready" preview); `PG-B-NewGroup.dc.html` (sheet "New group": X Cancel, "Create" dimmed until a name and 2 to 6 members, Name field, Members list with an "N selected" count and "Choose 2 to 6 members."; frames empty, one member, ready, "Creating", error "Check your connection and retry"); `PG-A-GroupThread.dc.html` and `PH-GroupThread.dc.html` for the result (title capsule with stacked avatars and the group name, Members, Page and More buttons).

#### Steps
1. On Home tap the prominent New in the side strip → menu: "New bot", "New group", "New space".
2. Tap "New group" → a medium sheet "New group" with Cancel (xmark) and "Create" (dimmed); Name field and Members list (Chief, Inbox agent, Finance agent, Legal agent) with the count "0 selected" and "Choose 2 to 6 members."
3. Type "Closing team" in Name (Expo placeholder "Name this group").
4. Tap "Finance agent" and "Legal agent" in Members → check marks appear.
5. Tap "Create" → the capsule shows a spinner; the sheet closes to Home.
6. See "Closing team" in PERSONNEL (a group row with stacked avatars) → tap it → the group thread opens with stacked avatars in the title capsule; the empty state "Message the group" is only in the rule card.
7. Tap Back → Home still shows the group.

#### Variations
- Same flow on inner display: bot list in 1/3, form in 2/3, and the group thread then fills the 2/3.
- Create with fewer than 2 or more than 6 members: "Create" stays dimmed and "Choose 2 to 6 members." shows (drawn).

#### Edge Cases
- No bots exist: Members shows "one muted line pointing to New bot".
- Create fails: a red line "Check your connection and retry" appears and the selection is kept (board; Expo says "Could not create group").
- Group name left empty: Create stays dimmed (the "Ready" frame has a name and two members).

#### Design gaps
- Expo creates the group then pops; the plan says "Group threads reuse the thread screens"; whether to open the new group directly is open.
- The empty group thread ("Message the group") has no board; `PG-A-GroupThread` and `PH-GroupThread` draw a busy thread only.
- The standard iPhone has no New group sheet board (the sheet is drawn on the outer display).


### STORY-015: Create a second space for a client and switch into it
**Type**: medium
**Topic**: Home, Personnel and space switching
**Source**: topics/home-spaces.md STORY-005
**Phase issue**: #415 (P3)
**Persona**: Leila Haddad, fractional COO who runs her own company and one client
**Goal**: Create the space "Acme Labs" and work in it with a clean Personnel list.
**Preconditions**: Signed in, one space ("Personal") exists.
**Device**: standard iPhone
**Ideal path**: 4 — tap the space title, New space, type name, Create space (the space opens automatically). The prominent New menu also offers "New space".
**Alternate paths**: (a) Create the space on web, then pick it from the space title menu. (b) Accept an invite to a shared space (no API: "space member management" is a missing API in plan.md).
**Design source**: `PH-Spaces.dc.html` (standard iPhone) and `PG-B-Spaces.dc.html` (outer display): tapping the space title opens a menu with the spaces (check on the current one), a divider, "New space" (+) and "Space settings"; PG-A-Home (New menu includes "New space"); `PG-B-NewSpace.dc.html` (medium sheet, Cancel xmark, "Create" text capsule dimmed until Name has text; frames empty, filled, "Creating", "Name already used", and "Check your connection and retry").

#### Steps
1. Tap the space title on Home, then "New space" in the menu (or tap New, then "New space").
2. Medium sheet "New space" slides up with a Name field and a "Create" capsule; detent grows with the keyboard.
3. Type "Acme Labs" → "Create" becomes enabled.
4. Tap "Create" → the capsule shows a spinner; `spaces.create` succeeds, the client sets `x-rakazo-space-id`, wipes or re-keys caches, and reloads Home (the title shows the "Switching" state with empty sections, as in STORY-109).
5. Home now shows "Acme Labs" in the title and its own Personnel ("No agents yet" and a "New agent" button, `PG-A-Home` "Empty space") and no ACTIVITY card.

#### Variations
- Rename later: "Space settings" in the title menu pushes a page with a Name field and a check to save (`PG-B-Spaces`); Expo reuses the New space sheet titled "Rename space".
- Space name limit: contract says 1 to 60 characters, trimmed; the board shows no counter or error for 61+ characters.

#### Edge Cases
- Created but could not be opened: alert with "Try again from the sidebar" (Expo text: "Space created" / "It could not be opened. Try again from the sidebar."). The rule mentions a sidebar that is NOT drawn on iPhone.
- Error: the board draws "Name already used" and "Check your connection and retry" under the field (Expo says "Could not create space"); the field keeps its input.
- The user's Inbox summary row refers to the Personal space's mail; in the new space it should show the new space's own connections (not specified).

#### Design gaps
- The alert text "Try again from the sidebar" points at a sidebar the standard iPhone lacks; it should name the space title menu.
- Space rename and delete are drawn on `PG-B-Spaces` (Space settings: Name, check, red "Delete space", and a delete confirmation), but only on the outer display; the standard iPhone settings page and "default space" (Expo only; the drawn "Personal" settings page has no Delete row) are not drawn.
- Space membership/invite flows have no API (plan.md "Missing server APIs").
- "New space" appears twice: in the space title menu and in the New menu. The switching state is drawn ("Switching to Northwind"); a switch failure and a menu with many spaces are not.


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
**Design source**: Home on the inner book: `Main.dc.html`, `Inner.dc.html`, `Split.dc.html` and PG-A-Rules "Home". `Split` and DS-03 section 6 draw the one inner sidebar: a "Personal ⌄" space control with the accessible name "Space: Personal" and a New button at the top, then an "Activity / 1 needs you" row, PAGES, PERSONNEL and a profile row "Alex Morgan" that opens Settings. The open menu itself is drawn for the standard iPhone and the outer display (`PH-Spaces`, `PG-B-Spaces`); DS-04 says a menu from the leading pane opens to the right of the fold.

#### Steps
1. On the inner display's left third, tap the "Personal ⌄" control at the top of the sidebar → a menu of spaces ("Personal", "Acme Labs") opens to the right of the fold (DS-04 rule; the open menu is not drawn on the inner display).
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
- Inner display: the control is drawn in the sidebar, but the open menu, its loading ("Switching") and failure states are drawn only for the standard iPhone and the outer display.
- Inner display detail pane when the new space has no last thread: undefined.
- Which space is "default" and how to change it: Expo has it, plan does not mention it.
- The boards choose one flat Personnel list per space with a title menu; Expo lists all spaces inline in one list. This is a behavior decision, now made on the boards.


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
**Design source**: `PG-A-Thread.dc.html` and `PH-Thread.dc.html` (More button; frame "Chat menu": Agent settings, Open computer, Clear chat, Archive, Delete chat); `PG-B-BotSettings.dc.html` (title "Bot settings", Name, Role, seven color swatches, Voice group with "Read replies aloud" and "Device voice", an "Advanced" row, a "Save" text capsule dimmed until an edit; frames unchanged, edited, "Saving", and an error "Could not save. No connection." with Retry); DS-04 for pickers.

#### Steps
1. On Home tap "Finance agent" → thread opens.
2. Tap the three-dots button (accessible name "Chat menu", bottom of the outer strip or the top bar on a standard iPhone) → choose "Agent settings" → pushed "Bot settings" with Back and a "Save" capsule (dimmed until something changes).
3. Edit Name to "Money desk" → field updates.
4. Tap a color swatch in Color (seven swatches on the board) → swatch selected (Expo: eight colors plus "Custom image").
5. Turn on "Read replies aloud" → Voice group shows voice choice and "Device voice" option.
6. Tap Advanced → rows "Model" and "Thinking" (Expo values include Minimal, Low, Medium, High, Extra high, Max, plus "Default (medium)" and "Space default"). The Advanced page itself is not drawn.
7. Pick "Low" for Thinking → row updates.
8. Tap Save → spinner on the button, page pops back to the thread, title now "Money desk"; PERSONNEL on Home also shows the new name.

#### Variations
- Edit the Role field ("Describe what this bot does" in Expo); Expo's Description field is not on the board.
- Toggle "Notifications" and the Skills list (Expo only; not on the board).
- Inner display: bot list 1/3, form 2/3 (max 560 pt, left aligned).

#### Edge Cases
- Save fails: a red line "Could not save. No connection." and a Retry button above the toolbar action (drawn), fields keep input.
- Voice list fails to load: Expo "Could not load voices".
- Model settings fail to load: "Could not load model settings".
- Back with unsaved edits: no rule.

#### Design gaps
- Skills and Notifications rows exist in Expo but not on PG-B-BotSettings.
- Unsaved-changes handling and per-field validation are undefined.
- Voice sample button "Hear a sample" belongs to PG-B-Voice, not to this page; Expo plays "Hi, this is how I'll sound." inline.
- The per-bot Advanced page (Model, Thinking) is not drawn; `PG-B-Models` draws the account-wide default only.
- The chat menu says "Delete chat" for an agent; whether that deletes the conversation or the agent is not stated (see STORY-018).


### STORY-018: Archive a bot from its thread and restore it later
**Type**: medium
**Topic**: Home, Personnel and space switching
**Source**: topics/home-spaces.md STORY-008
**Phase issue**: #415 (P3)
**Persona**: Dana Kowalski, COO tidying Personnel before an investor update
**Goal**: Remove "Old Recruiter" from Personnel without losing its chat, then bring it back two weeks later.
**Preconditions**: Bot "Old Recruiter" exists with history.
**Device**: standard iPhone
**Ideal path**: 7 — Old Recruiter row, More, Archive, confirm; later avatar, Archived bots, Restore.
**Alternate paths**: (a) Restore from the archived thread's own banner (Expo shows "Archived. Chat, memory, and files kept." with a restore action). (b) Delete instead of archive ("Delete {name}?" with "Keep memories" or "Delete memories too"); destructive, no board. (c) Archive from web.
**Design source**: `PG-A-Thread.dc.html` and `PH-Thread.dc.html` (Chat menu with Archive; alert "Archive this chat? / It moves to Archived. You can restore it." with Cancel and Archive; the archived thread: title "Archived" with a Restore button, composer disabled "Restore to send messages"; also `PG-A-ThreadStates` "Archived"). `PG-B-Settings.dc.html` (root row "Archived bots"; page "Archived bots" with rows "Close checklist / Archived Oct 3 / Restore" and "Inbox agent / Archived Sep 21 / Restore"; an empty page "No archived bots"). DS-04 draws a different alert for the same action ("Archive Finance agent? Its chats stay readable. You can restore it from Archived.").

#### Steps
1. Tap "Old Recruiter" in PERSONNEL → thread.
2. Tap the three-dots button ("Chat menu") → tap "Archive" → alert "Archive this chat?" with Cancel and Archive.
3. Tap "Archive" → `bots.archive`; the thread shows "Archived" with a Restore button and a disabled composer; Home PERSONNEL no longer lists the bot after Back.
4. Two weeks later: tap the "AB" avatar on Home → Settings sheet; tap "Archived bots" → a list with the archive date and a Restore button per row; with none, "No archived bots".
5. Tap "Restore" on the "Old Recruiter" row → `restoreArchivedBot`; the row leaves the list and the bot returns to Personnel.
6. Back to Home → bot visible again with its history.

#### Variations
- Archive a group instead: `groups.archive` and `groups.listArchived` exist in the API; Expo's archived list covers bots.
- Last bot archived: Home shows "No agents yet" with a "New agent" button.

#### Edge Cases
- Archive fails: alert "Could not archive bot" / "Try again."
- Restore fails: "Could not restore bot"; list load fails: "Could not load bots" + "Try again."
- Archived bot has an active routine or pending approval: behavior not specified.
- A push notification arrives for an archived bot: routing undefined.

#### Design gaps
- Group archive: the group Chat menu also has Archive, but no archived-groups list or restore is drawn.
- Delete: the Chat menu offers "Delete chat" for an agent and "Delete group" for a group (the group alert is drawn); the agent delete alert, the memory choice ("Keep memories" or "Delete memories too") and the difference between Clear chat and Delete chat have no copy.
- Copy conflict: the thread alert says "Archive this chat?" and DS-04 says "Archive Finance agent?"; one alert is needed. The Archived bots page lists only bots and has no error or loading state.


### STORY-019: First run with no model connected: from Home to a working bot
**Type**: long
**Topic**: Home, Personnel and space switching
**Source**: topics/home-spaces.md STORY-009
**Phase issue**: #415 (P3), #417 (P5), #421 (P9)
**Persona**: Ravi Patel, solo founder who signed up with a new account on the default server
**Goal**: Land on Home, understand a model is needed, connect one, and send a first message to Chief (or to a new bot).
**Preconditions**: New account, new Personal space, no model, no integrations, `me.needsModel = true`. The board shows one seeded bot, Chief ("Connect a model to chat").
**Device**: standard iPhone
**Ideal path**: 6 — Connect a model, paste the key, Connect, Message Chief, type, Send. No separate consent step is drawn (the Connect sheet carries the disclosure); creating a bot is optional because Chief is already listed.
**Alternate paths**: (a) Create the bot first and be told at first send ("Connect a model to start a run."). (b) Settings > Models directly from the "AB" avatar. (c) A deployment-provided model (`defaultProvider` without a key) means `needsModel` is false and the flow shortens to step 7 (open Chief).
**Design source**: `PG-A-HomeNoModel.dc.html` (four frames: "New account, no model" with the card "Connect a model to start chatting." and a prominent "Connect a model"; the "Connect a model" sheet with API key (Recommended, checked), Local server, Subscription, a masked key field, a full-width "Connect" and "Connecting sends your messages and attachments to Model A to run your agents. Privacy details"; "Key not accepted" with a red field outline; "After connecting" with "Model A connected." and a prominent "Message Chief", plus the New button back in the strip). `PH-Home.dc.html` frame "No model" (standard iPhone card and Chief "Connect a model to chat"). `PG-A-ThreadStates.dc.html` "First message" (greeting and three suggestion chips) and "No model" (red "Not sent: No model connected" with a Connect button). `PG-B-Consent.dc.html` now draws the speech prompt and the Settings page only. PG-B-Models and PG-B-Settings for the model page; Sign in handoff: PG-B-SignIn. The Connect sheet on a standard iPhone: NO BOARD.

#### Steps
1. Finish Sign in → bootstrap, `me`, `spaces.list` run; Home loads with three placeholder rows.
2. Client notes `me.needsModel` → Home shows the card "Connect a model to start chatting." with a prominent "Connect a model"; PERSONNEL lists Chief with "Connect a model to chat".
3. Tap "Connect a model" → a sheet "Connect a model" rises over Home (dimmed), with a Cancel xmark in the strip, the choices API key (Recommended, checked), Local server and Subscription, a masked key field, a full-width "Connect" and the line "Connecting sends your messages and attachments to Model A to run your agents." with "Privacy details".
4. Paste the API key (secrets are never shown after entry) → the field shows dots.
5. Tap "Connect" → connection succeeds; `needsModel` becomes false; the sheet closes. A rejected key shows "Key not accepted." under the outlined field and the sheet stays.
6. Home now reads "Model A connected." with a prominent "Message Chief"; Chief shows "Hello! How can I help?"; the New button returns to the strip.
7. Tap "Message Chief" (or the Chief row) → the thread opens with the greeting and three suggestion chips ("Summarize my inbox", "Draft a reply to Ana", "What is due this week?").
8. Type "What should I do first?" in the floating composer → tap Send.
9. Tap Send → no model data-sharing sheet is drawn (the Connect sheet already disclosed it); if the server still requires explicit consent, the prompt is undefined here (STORY-048). The message is sent.
10. Working indicator "Chief is working" with a stop control appears.
11. Reply streams in; Home's Activity card (after Back) briefly shows "Working" then "Done".
12. Back to Home → the Chief row preview shows the first reply line and time.

#### Variations
- Tap New at step 6: the menu opens ("New agent", "New group", "New space") and "New agent" opens the New bot sheet (Name, Role, Color).
- Rotate the order: open Chief before connecting a model; the first send fails with "Not sent: No model connected" and a Connect button that opens the Connect sheet (drawn in `PG-A-ThreadStates`).
- Choose "Local server" or "Subscription" in the sheet: their forms are not drawn.
- Use the Server board's custom server: deployment owner may have a model preset.

#### Edge Cases
- User skips the model: Home works but every send fails with "Connect a model to start a run."
- Consent not given: a call fails with "Review AI data sharing in Account settings before continuing."; client should check `aiDataUsesForProcedure` and prompt.
- Network drop between steps 5 and 6: Models shows saved state on reopen.

#### Design gaps
- Local server URL form, the Subscription sign-in flow, a pending state on Connect and a Connect that is disabled until a key is typed are not drawn (the wrong-key error is).
- `PH-Home` draws the no-model card but not the Connect sheet or its error on a standard iPhone.
- Consent is now stated on the Connect sheet, but `PG-B-Consent` draws no model consent sheet and no "Not now" path for models; STORY-048 and STORY-117 need a decision on whether Connect itself grants consent and what "Privacy details" opens.


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
**Design source**: Home Personnel list: `PG-A-Home.dc.html` frame "Pinned, group, unread" (a PINNED section, group row "Launch team" and unread dots), `PH-Home.dc.html` and PG-A-Rules "Home". Organize and member pickers: DS-04 (organize sheet: Pin, Silence notifications, Move to Money, Legal, Unassigned, New section, Cancel; member picker "Choose agents 3 of 6"); DS-03 section 6 (sidebar PERSONNEL collapsed with a count "6"). Group settings: `PG-B-GroupSettings.dc.html` (Name, Members with "N selected", "3 of 4 agents can post in this group.", "Delete group", "Save" dimmed until an edit, frames unchanged, edited, "Saving", delete confirmation "Delete Funding room? / This removes the group and its messages for everyone in it. The agents are not deleted." with Cancel and Delete). `PG-A-GroupThread` Chat menu (Group settings, Clear chat, Archive, Delete group).

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
10. Open the thread's three-dots button ("Chat menu") → "Group settings" pushes in the right pane (rule: "Group thread in 1/3, settings in 2/3").
11. In Members, untick "Mercury agent" → check mark clears.
12. Tap Save → spinner then the pane returns to the thread; the thread's title capsule shows one fewer avatar.
13. Old Mercury bubbles in the thread keep its name ("One member removed: its bubbles keep the name").
14. Back to Personnel: pinned and section layout persists after force quit and reopen (state is server-side).
15. Open "Weekly review" → Group settings → tap "Delete group" → alert "Delete Weekly review?" with "This removes the group and its messages for everyone in it. The agents are not deleted." and Cancel / Delete.
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
- A PINNED heading and the organize sheet are drawn (DS-04); section headings ("Investors"), their collapse affordance on Home, "Rename section" and long-press discoverability are not. "Move to", "New section" and "Unassigned" exist in the DS-04 sheet; "Rename section" only in Expo.
- Long-press has poor discoverability and no VoiceOver action is specified; plan says "sections and pinning" without a gesture.
- The organize and member pickers are drawn in DS-04 over a generic list, not over Home or the inner sidebar.
- The same Personnel organization is rendered on web, Expo, and native; a pinned/section difference between surfaces would be visible to the user, so the native app must match the server order exactly.
- Section removal (`botSections.remove`) and reorder have API but no UI described.
- Two copies of the group delete warning: the Group settings alert ("This removes the group and its messages for everyone in it. The agents are not deleted.") and the group Chat menu alert ("Its messages are removed for everyone. This cannot be undone."). One is enough.



### STORY-109: Switch spaces from the Home title on a standard iPhone
**Type**: short
**Topic**: Home, Personnel and space switching
**Source**: ux-paths round 1 refresh (boards `PH-Home`, `PH-Spaces`)
**Phase issue**: #415 (P3)
**Persona**: Tessa Brandvold, operator who runs her own company and advises another
**Goal**: Move from her "Personal" space to "Northwind" and see only Northwind's Inbox, Pages, Activity and Personnel.
**Preconditions**: Signed in; three spaces exist ("Personal", "Northwind", "Side project"); "Personal" is selected. Network is up.
**Device**: standard iPhone
**Ideal path**: 2 — tap the space title, tap "Northwind".
**Alternate paths**: (a) Tap a push notification from a Northwind agent: the app switches first (STORY-106). (b) Create a space from the same menu (STORY-015). (c) Rename or delete a space (STORY-110, drawn for the outer display only).
**Design source**: `PH-Spaces.dc.html` (title "Personal ⌄" and the open menu: "Personal" with a check, "Northwind", "Side project", a divider, "New space" with a plus, "Space settings"; Home dims behind it; a second frame "Switching to Northwind" with the title already reading "Northwind ⌄" and ACTIVITY and PERSONNEL showing headers only); `PH-Home.dc.html` (the loaded result).

#### Steps
1. Open Home → the large title reads "Personal" with a chevron; the Inbox row, PAGES, ACTIVITY and PERSONNEL belong to Personal. The title carries the accessible name "Space: Personal".
2. Tap the title → a glass menu drops from it listing the three spaces (check beside the current one), then "New space" and "Space settings"; the rest of Home dims.
3. Tap "Northwind" → the client sets `x-rakazo-space-id`, discards or re-keys every cache, reloads Home; the menu closes, the title reads "Northwind" and ACTIVITY and PERSONNEL show empty headers while they load (drawn).
4. Read the ACTIVITY card → rows for Northwind only ("Finance agent / Reading card expenses / Working", "Inbox agent / Reply to Ana is ready to send / Approve", "Weekly runway / Done" in the sample data).

#### Variations
- Choose "New space" in the menu: the New space sheet opens (STORY-015).
- Choose the space that is already checked: the menu closes and nothing reloads.
- Nothing is running in the new space: ACTIVITY is hidden (Home rule card).

#### Edge Cases
- Switch fails: Expo alert "Could not switch spaces" / "Try again."; the previous space stays selected and its title stays.
- A response from the previous space arrives after the switch: it must be dropped (requests are tagged with the space).
- Someone in another space needs the user (an approval): the menu does not say so (see gaps).
- A 401 with a stale space header silently recovers to the default space (STORY-008).
- Two spaces with the same name: the menu shows names only.

#### Design gaps
- The loading state is drawn; the failure alert is not.
- The menu gives no sign that another space has something that needs the user (the outer Activity bell says "2 need you"; whether that counts only the current space is not stated).
- Long space names and many spaces (a menu with 20 rows, scrolling, search) are not drawn.
- "New space" is in this menu and in the New menu; two entries for one action.
- "Space settings" is drawn as an outer-display page only (`PG-B-Spaces`); the standard iPhone page is not drawn.


### STORY-110: Switch, rename and delete a space on the outer display
**Type**: medium
**Topic**: Home, Personnel and space switching
**Source**: ux-paths round 1 refresh (board `PG-B-Spaces`)
**Phase issue**: #415 (P3), #419 (P7)
**Persona**: Mara Osei, founder who runs a side project next to her main company
**Goal**: Switch to "Side project", rename it "Studio", and later delete a space she no longer uses.
**Preconditions**: Signed in; spaces "Personal", "Northwind" and "Side project" exist; "Personal" is selected. iPhone Duo closed (outer display, 466x678 pt).
**Device**: iPhone Duo outer
**Ideal path**: 2 to switch (tap the title, tap the space); rename adds 3 (Space settings, edit the name, tap the check); delete adds 3 (Space settings, Delete space, Delete in the confirmation).
**Alternate paths**: (a) New space from the same menu (STORY-015). (b) On a standard iPhone the menu is drawn (STORY-109) but the Space settings page is not.
**Design source**: `PG-B-Spaces.dc.html` (five frames: "Space menu from the title" with "Personal ⌄" opening "Personal" (check), "Northwind", "Side project", a divider, "New space" and "Space settings", the strip keeping the "AB" avatar and the bell group with the dot "Activity, 1 needs you"; "Switching to Northwind"; "Space settings" for Personal (title, Back chevron, a Name field, a prominent check named "Save name", no Delete row); "Space settings" for Northwind (the same plus a red "Delete space" row); and the alert "Delete Northwind? / This removes its agents, chats and files. This cannot be undone." with Cancel and Delete).

#### Steps
1. On Home tap the title "Personal" → the menu opens in the content column, to the right of the strip.
2. Tap "Side project" → caches are re-keyed, the title reads "Side project" and its sections show empty headers while loading.
3. Tap the title again, then "Space settings" → a page pushes: title "Space settings", the Name field, the Back chevron in the strip and the prominent check ("Save name"); a non-default space also shows a red "Delete space" row at the bottom, the default "Personal" does not.
4. Edit the Name to "Studio" → the field updates.
5. Tap the check → the name is saved, the page pops, the title reads "Studio".
6. Later, with the unused space selected, open the title menu, "Space settings", then tap "Delete space" → the alert "Delete Side project?" says "This removes its agents, chats and files. This cannot be undone." → on Delete the space and its content go.
7. The app selects another space → Home reloads in that space (which one is not drawn).

#### Variations
- Tap Back after editing the Name: whether unsaved edits are kept or dropped is not drawn.
- A name of 61 or more characters: the contract allows 1 to 60, trimmed; no counter or error is drawn.
- Delete the only space: the default "Personal" space has no Delete row, so this cannot happen on the board.

#### Edge Cases
- Another phone is inside the space that is deleted: its next call returns 401 with a space header and recovers to the default space (STORY-008).
- Rename fails: red line "Could not save" (wording not drawn); the field keeps the text.
- Delete fails: not drawn.

#### Design gaps
- Which space is selected after a delete is not drawn, and the alert does not say whether other members lose access.
- Space settings holds only the Name; default space (Expo) and member or invite management (no API) are absent.
- Who may rename or delete a shared space is not stated.
- The standard iPhone Space settings page is not drawn (`PH-Spaces` draws only the menu).


### STORY-111: Connect the first model from the Home card
**Type**: short
**Topic**: Home, Personnel and space switching
**Source**: ux-paths round 1 refresh (board `PG-A-HomeNoModel`)
**Phase issue**: #415 (P3), #421 (P9)
**Persona**: Elif Sandberg, founder who just signed up on her iPhone Duo
**Goal**: Connect a hosted model so the Chief agent can answer.
**Preconditions**: New account; no model connected (`me.needsModel` is true); Chief is listed with "Connect a model to chat". Outer display.
**Device**: iPhone Duo outer
**Ideal path**: 3 — tap "Connect a model", paste the key, tap "Connect".
**Alternate paths**: (a) Settings, Models (STORY-089, 8 taps). (b) Skip: open Chief and send; the send fails with the no-model message (STORY-040). (c) Cancel the sheet and come back later.
**Design source**: `PG-A-HomeNoModel.dc.html` (four frames). Frame 1: title "Personal ⌄", a card "Connect a model to start chatting." with a prominent "Connect a model", PERSONNEL with Chief "Connect a model to chat"; the strip has the "AB" avatar and the bell and search group, and no New button. Frame 2: the dimmed Home with a Cancel xmark and the sheet "Connect a model": API key (Recommended, checked), Local server, Subscription, a masked key field, a full-width "Connect" and "Connecting sends your messages and attachments to Model A to run your agents. Privacy details". Frame 3: the same with a red outline, "Key not accepted.". Frame 4: the card reads "Model A connected." with a prominent "Message Chief"; Chief shows "Hello! How can I help?"; the New button is back. Standard iPhone: `PH-Home` frame "No model" draws the card only.

#### Steps
1. Open Home after signing in → the card "Connect a model to start chatting." is the only prominent action; Chief is listed below.
2. Tap "Connect a model" → the sheet rises over Home; the strip shows Cancel (xmark).
3. Read the choices → "API key" (Recommended) is checked; "Local server" and "Subscription" are the other choices.
4. Paste the API key into the field → dots appear.
5. Tap "Connect" → the key is verified and saved (`models.connect`), `needsModel` becomes false, the sheet closes. A rejected key keeps the sheet open with "Key not accepted." (drawn).
6. Read the card → "Model A connected." with a prominent "Message Chief"; Chief now previews "Hello! How can I help?" and the New button returns.
7. Tap "Message Chief" → the thread opens with suggestion chips (first message: STORY-044; consent: STORY-048).

#### Variations
- Pick "Local server": a URL form is needed (STORY-090); it is not drawn here.
- Pick "Subscription sign-in": a Safari round trip with a code (STORY-089); not drawn here.
- Tap Cancel (xmark) or swipe the sheet down: nothing is saved and the card stays.
- Tap New at step 6: the New menu opens (STORY-012).

#### Edge Cases
- Wrong or revoked key: the sheet shows "Key not accepted." under the outlined field and keeps the typed key (drawn).
- Network drops while connecting: the sheet must not close on a failed call; not drawn.
- The key is never shown again and never stored on the phone beyond the request.
- The deployment already provides a model: `needsModel` is false and the card never appears.

#### Design gaps
- The frames draw no New button while the card is shown, so a user with a model-less space cannot create a bot, group or space; whether that is intended is not stated.
- "Connect" has no pending or disabled-until-filled state drawn (the error state is drawn).
- Only the outer display draws the sheet; `PH-Home` draws the card and Chief row on a standard iPhone but not the sheet or its error.
- The sheet names "Model A" and links "Privacy details" before any model is chosen; what the link opens and whether this sentence counts as consent (STORY-048) are not drawn.


### STORY-118: Review everything the agents are doing from the Activity list
**Type**: short
**Topic**: Home, Personnel and space switching
**Source**: ux-paths round 2 (board `PG-A-Activity`)
**Phase issue**: #415 (P3)
**Persona**: Noor Haddad, founder who has been in meetings all day and opens the app to see what happened
**Goal**: See in one place what needs her, what is still working and what finished, and open the one item that needs her.
**Preconditions**: Signed in, Personal space selected. The Finance agent waits for approval of a $1,200 payment, the Legal agent is reading contracts, the weekly routine ran at 8:00 AM, and the Inbox agent and Brex agent finished earlier.
**Device**: iPhone Duo outer
**Ideal path**: 3 — tap the bell, read the list, tap the "Needs you" row.
**Alternate paths**: (a) Tap "See all" in the ACTIVITY card on Home (standard iPhone and outer). (b) Tap the "Needs you" row on Home directly (STORY-011), which skips the list. (c) Open the list when nothing happened and read the empty state.
**Design source**: `PG-A-Activity.dc.html` (frame "Activity (bell or See all)": title "Activity", a Back button in the strip, group TODAY with "Finance agent / Approve $1,200 payment / Needs you" and a chevron, "Legal agent / Reading contracts / Working", "Weekly runway / Ran at 8:00 AM / Done", group EARLIER with "Inbox agent / Sent your reply to Ana / Done" and "Brex agent / 4 card expenses matched to receipts / Done"; frame "Empty": "No activity / Agents appear here while they work"). Entry: `PG-A-Home.dc.html` (bell "Activity, 1 needs you", ACTIVITY "See all") and `PH-Home.dc.html`.

#### Steps
1. On Home tap the bell in the strip, which reads "Activity, 1 needs you" → the Activity list opens with the title "Activity" and a Back button.
2. Read TODAY → the first row, the Finance agent, carries a "Needs you" capsule and a chevron; the Legal agent row shows a blue dot and "Working"; the routine row shows a green dot and "Done".
3. Read EARLIER → two finished rows, "Inbox agent" and "Brex agent", both "Done".
4. Tap the "Finance agent" row → the thread opens at the approval card (STORY-011, STORY-045).
5. Approve, then tap Back twice → the list no longer marks the row "Needs you", and the bell on Home loses its dot.

#### Variations
- Nothing has happened: the list reads "No activity" with "Agents appear here while they work".
- Tap the "Legal agent" row: the thread opens with the working indicator (STORY-023).
- Tap the routine row: the routine detail opens (STORY-075).

#### Edge Cases
- A run starts or finishes while the list is open: rows should update live; not stated.
- Many rows: paging and the EARLIER cutoff are not stated.
- A row for an agent in another space: not stated (the Home bell counts only the current space, per STORY-109).

#### Design gaps
- Only the outer display draws the list; the standard iPhone and the inner sidebar (which has an "Activity / 1 needs you" row) have no destination board.
- Row order inside TODAY (needs-you first, then working, then done) and the TODAY and EARLIER boundary are not stated.
- "Working" uses a blue dot here, while DS-06 specifies neutral dots for the working indicator (see the colour decision under #412).
- "Done" rows have no chevron, so it is unclear whether they open anything; there is no way to clear or filter the list.
- Home shows three rows from this list and "See all" opens the rest; how Home chooses which three is not stated.


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
**Design source**: Step 1: `PG-A-Home.dc.html` / `PH-Home.dc.html` (Personnel row; Home rule card). Steps 2-3: `PH-Thread.dc.html` (standard iPhone top bar: Back, title capsule with avatar and name, Page, List and More (three dots, "Chat menu"); composer with Attach, field and Dictate), `PG-A-Thread.dc.html`, Thread rules, `DS-06-Chat.dc.html` (user bubble and agent message, tool-call label). `PG-A-ThreadStates.dc.html` draws "Loading" (placeholder bubbles, composer present), "Could not refresh" (a top row "Could not refresh" with "Try again" over the saved messages) and "Archived".

#### Steps
1. On Home, tap the "Inbox agent" row under Personnel → thread opens; the title capsule reads "Inbox agent" and the saved snapshot is on screen immediately, bottom-aligned.
2. Wait for `threads/get` to return → the server snapshot replaces the saved copy with no visible jump; the composer shows "Message Inbox agent".
3. Read the last agent bubble "Reply to Ana: Thursday works, 10am. Here is a draft. I have not sent it." and the collapsed tool label "Searched mail, 12 results" → thread is read; `threads/markRead` fires.

#### Variations
- Same flow from the Activity card row, from "Ask Inbox agent", or from Agent page "Open chat": the same thread, same state.
- Thread has no saved snapshot (first open on this device): step 1 shows placeholder bubbles with the composer already present (`PG-A-ThreadStates` "Loading"), then step 2 content.

#### Edge Cases
- `threads/get` fails and a snapshot exists: a row "Could not refresh" with "Try again" sits above the saved messages (drawn; Expo says "Couldn't refresh — showing the last loaded messages.").
- `threads/get` fails with no snapshot: error text only in Expo; no board.
- The agent was archived while the thread is open: the title capsule reads "Archived" with a "Restore" button and the composer says "Restore to send messages" (drawn). A deleted agent has no drawn state.

#### Design gaps
- The "Could not refresh" frame always has saved messages beneath it; a failed first open with nothing saved has no board.
- A deleted agent (not archived) has no thread state.


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
**Design source**: `PG-A-ThreadStates.dc.html` frame "New messages, scrolled up" (a "NEW" divider above "Ana confirmed 10am." and a "Jump to latest" pill above the composer); `PG-A-Thread.dc.html` (messages, composer); Thread rules.

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
- A new message arrives live while reading older ones: the "Jump to latest" pill shows (drawn; Expo adds a "new messages" pill with a down arrow); staying put avoids losing the reader's place.
- The divider is computed from the first live snapshot only; later events do not move it (discovery: "unread divider computed only from the snapshot").
- Reading from the saved snapshot offline: divider placement is undefined.

#### Design gaps
- Expo has an explicit "Load earlier messages" text button; the rule card shows only a spinner. Planned native behavior (auto-load on scroll vs button) is undecided.
- Unread dots on Personnel rows are drawn in `PG-A-Home` ("Pinned, group, unread") but not on the standard `PH-Home`; the divider reads "NEW" on the board and "New" in Expo.
- Entry point for `threads/markUnread` is not defined.
- "Jump to latest" is drawn only with the divider; whether it also appears when the user scrolls up with nothing unread is not stated.


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
**Design source**: `PG-A-Thread.dc.html`, `PH-Thread.dc.html`, `PG-A-ThreadStates.dc.html` frames "Running", "Running, text typed" and "Stopping" (a bot avatar with a ring and a pill of neutral dots, Stop in the composer slot); `DS-06-Chat.dc.html` (working indicator, tool-call label running state, agent message); Thread rules (Working row).

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
- Working label text differs: the boards draw avatar, ring and dots with no text; Expo shows "{name} is working" plus a status line and "Still waiting on {service}". The status-line behavior has no board; the dots are now neutral on the boards, as DS-06 specifies.
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
**Design source**: `PG-A-ThreadStates.dc.html` frames "Reconnecting" (a top row with a spinner and "Reconnecting"), "Offline, nothing queued" ("Offline. Messages send when you reconnect.") and "Session ended". Working indicator and bubbles: `DS-06-Chat.dc.html`. Behavior: `docs/ios-native/plan.md` Phase 4 and discovery "State Transitions".

#### Steps
1. Train enters a tunnel while the Finance agent streams a reply → no data arrives; after 20 s idle the client sends a heartbeat; nothing returns.
2. At 45 s of silence the watchdog drops the connection → the thread stays on screen with the partial bubble. A "Reconnecting" row appears at the top while the network is up; with no network the "Offline" row shows instead.
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
- Both rows are drawn, but when "Reconnecting" appears (after how many seconds) and whether it replaces "Offline" are not stated.
- The 401 error frame outcome has two designs: the thread's own "Session ended" state with a Sign in button (`PG-A-ThreadStates`), and the whole-app return to Sign in (STORY-008).
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
**Design source**: `PH-GroupThread.dc.html` (standard iPhone: Back, a capsule with stacked avatars and "Funding room", Members, Page and More; frame "Chat menu": Group settings, Clear chat, Archive, Delete group), `PG-A-GroupThread.dc.html` (outer display; also the delete alert "Delete Funding room?"); Group rules; `DS-06-Chat.dc.html` (event label, working indicator).

#### Steps
1. Tap "Funding room" in Personnel → group thread opens; title capsule shows the stacked member avatars and the name "Funding room".
2. Read the history → each bubble has the agent's name above it ("Finance agent", "Legal agent"); identity is the avatar color only, bubbles are not tinted.
3. See the footer → one working line per working agent: "Legal agent is working" (board shows one line; with two agents working, two lines).
4. A tool label "Read 2 documents" appears under the Legal agent's text → tap to expand.
5. An event label "Chief handed off to Finance agent" appears centered between hairlines → read-only system note.
6. Open the member list → tap "Members" (person.2) in the strip or the top bar; what it opens (a list, a sheet, a third pane) is not drawn.

#### Variations
- A member was removed from the group: its old bubbles keep its name; event label "Legal agent left the thread".
- Empty group thread: member avatars with "Message the group".

#### Edge Cases
- Two agents finish within the same second: each working line disappears on its own first token.
- A bot in the group is archived: bubbles keep the name (archived label shown in Expo as "archived").
- Group `Send` is the prominent action (Group rules), unlike Agent thread where Allow is.

#### Design gaps
- Member list: the Members button is drawn on the outer and standard layouts, but what it opens has no board (rule card only: "member list opens as a third pane").
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
**Alternate paths**: (a) from Home's empty state, "New agent" then New bot > Create, which opens the thread; (b) create from New group > "Create" which opens a group thread (empty state "Message the group").
**Design source**: `PG-A-ThreadStates.dc.html` frame "First message" (the agent greeting "Hello! How can I help?" and three suggestion chips "Summarize my inbox", "Draft a reply to Ana", "What is due this week?" above the composer); `PG-B-NewBot.dc.html` for step 1; Thread rules (Empty row).

#### Steps
1. Finish New bot with a name and tap "Create" → thread opens for the new bot.
2. See the empty state → the greeting bubble and three suggestion chips; the composer reads "Message {agent name}".
3. Tap a suggestion → it fills the composer (send behavior belongs to the write-thread topic #417).

#### Variations
- `needsModel` is true (no model connected): the first send shows "Not sent: No model connected" with a Connect button (`PG-A-ThreadStates` "No model"; STORY-040).
- Group with no messages: "Message the group".

#### Edge Cases
- Suggestion list is tall: Expo makes it scroll so the composer stays above the keyboard.
- No network at creation: not covered here.

#### Design gaps
- Whether suggestions send immediately or only fill the composer is undecided.
- The suggestion chips are drawn but their count, wrapping with a long agent name and whether they come from the agent or the app are not stated.


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
1. From Home tap "Inbox agent" → thread opens; the 60 pt left strip shows the Dynamic Island, time, a Back group, Page and List icons, a spacer, and the three-dots "Chat menu" button.
2. Read the content column (starts at x=72): glass title capsule "Inbox agent" at top, messages bottom-aligned, floating composer with "Message Inbox agent".
3. Read the "Needs approval" mail card: title "Re: Pilot timeline", "To Ana Ruiz", body text, and the two actions "Edit" and "Send" (Send is the one prominent button; the card body also opens the editor).
4. Tap the Page icon (doc.text) in the strip → the agent's pinned Page opens, titled with the agent name, with "Open chat" as its prominent button.
5. Tap "Open chat" → return to the thread at the same scroll position.
6. Tap More → a menu lists "Agent settings", "Open computer", "Clear chat", "Archive" and "Delete chat".
7. Tap away → the menu closes; the thread is unchanged.
8. Tap Back (strip) → return to Home.

#### Variations
- Short height (466x420): strip items collapse bottom to top into More; the prominent action collapses last.
- Pins strip: if messages are pinned, a horizontal strip of chips sits under the title capsule (44 pt chips; tap scrolls to the message; long-press "Unpin"); hidden when empty.

#### Edge Cases
- "Archive" asks first (drawn: "Archive this chat?"); "Clear chat" and "Delete chat" have no drawn confirmation.
- The thread has an unread divider while in the strip layout: position relative to the capsule is undefined.
- Back goes to Home or to the Agent page depending on how the thread was entered; stack behavior is not specified.

#### Design gaps
- The mail card agrees across `PG-A-Thread`, `PH-Thread`, `Inner` and DS-06 ("Re: Pilot timeline", "Edit" and "Send"; the earlier "Save" is gone because the draft autosaves), and the rule card now names Send on the card as the prominent control. The tool approval card ("Allow once / Always allow / Deny") is still drawn only in DS-06.
- No message-level context menu is drawn for the strip layout (long-press menu is native, not shown).
- Pins strip placement relative to the glass title capsule on the outer layout is not drawn.


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
**Alternate paths**: (a) Search from Home (Search icon in the outer strip, `PG-A-Home`, or top right on `PH-Home`) and tap a hit to jump with `threads/messages({around})`; (b) tap a pinned-message chip under the title capsule (pins strip, DS-06); (c) open from a notification linking to a specific message (no board).
**Design source**: `PG-A-Thread.dc.html`, `PG-A-ThreadStates.dc.html` ("New messages, scrolled up" with "Jump to latest"; "Loading"), Thread rules (loading earlier); `DS-06-Chat.dc.html` (pins strip). Search results screen: NO BOARD. Pagination boundary and "around" window: NO BOARD.

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
- End-of-history marker and a failure while paging older messages are not drawn (a "Loading" skeleton and a top "Could not refresh" row exist for first load).
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
**Design source**: `PG-A-Thread.dc.html` and `PH-Thread.dc.html` (card "Re: Pilot timeline", "Needs approval", "To", body, "Edit", "Send"; further frames "Draft replaced" ("Replaced by a newer draft"), "Empty recipient" ("Add a recipient"), "Agent editing the draft" (status "Updating")); `PG-A-ThreadStates` "Approval scrolled away" (a "Needs approval" pill above the composer); `DS-06-Chat.dc.html` (Mail approval card: Needs approval, Sent, Not sent). Read-only phase-4 rendering of approval cards: NO BOARD.

#### Steps
1. Open "Inbox agent" → snapshot arrives; the working indicator "Inbox agent is working" is at the bottom.
2. A tool label "Searched mail, 12 results" appears, then the agent bubble "Reply to Ana: Thursday works, 10am. Here is a draft. I have not sent it." streams in.
3. The mail approval card appears: status "Needs approval" in warning color, rows "To Ana Ruiz", subject, body "Hi Ana, Thursday works. Let's start at 10am." and the actions "Edit" and "Send".
4. The run goes to `run.waiting_input` → the working indicator is replaced by the card's waiting state; the composer remains available.
5. Jordan approves and sends the mail on the web app → a product event arrives on the SSE stream.
6. The card status flips to "Sent" with a checkmark and the actions are removed (live update, no refresh).
7. The agent posts a follow-up bubble "Sent." and the run completes → the working state clears.

#### Variations
- Mail is rejected from web: status "Not sent" with an x mark.
- Phase-4-only build: the card renders as read-only or as the unknown-block placeholder (see STORY-028) and "Send" does not act.
- Two devices act at once: a second answer to the same ask returns CONFLICT; the card shows the winning result.

#### Edge Cases
- Stream drops between steps 5 and 6: the reconnect (STORY-024) refetches the snapshot, which already contains "Sent".
- Compose result `unknown`: never auto-retry (brief); card state is not drawn.
- Mail writes are off: "Changing mail is turned off."

#### Design gaps
- Interim behavior of the approval card in the read-only phase (are Edit and Send hidden, dimmed or inert) is undefined; the rule card now names Send on the card as the prominent action.
- Live status flip from another device is not drawn; the "Sent" and "Not sent" specimens exist but no transition.
- "Changing mail is turned off." has no in-thread board (the Inbox and Compose boards draw "Changes to mail are off" and "Sending is off for {address}"); CONFLICT outcomes have no board.
- The same approval is rendered on the thread, on the Inbox message view, on Home Activity (status "Needs you", subtitle "Approve …") and in push; the card says "Send" while Activity says "Approve", so the labels still need one source.


### STORY-124: Read a thread you cannot reply to
**Type**: short
**Topic**: Talking to an agent: read and live thread
**Source**: ux-paths round 2 (board `PG-A-ThreadStates`, frame "Read only")
**Phase issue**: #416 (P4)
**Persona**: Ritu Kapoor, outside advisor who was given view access to a shared agent thread
**Goal**: Read what the agent said and understand that she cannot reply.
**Preconditions**: Signed in; she opens a thread in a space where she is not a member of the conversation.
**Device**: standard iPhone
**Ideal path**: 2 — open the thread, read.
**Alternate paths**: (a) Ask the owner to add her as a member. (b) Read the same content on the web.
**Design source**: `PG-A-ThreadStates.dc.html` frame "Read only" (a row "Read only. Only members can reply." under the title capsule, bubbles, and a disabled composer reading "You can't reply here"). The archived state ("Restore to send messages") and the signed-out state ("Session ended") look alike but mean something else.

#### Steps
1. Open the thread → the saved messages render; a line under the title reads "Read only. Only members can reply."
2. Read the messages → bubbles, tool labels and the working indicator behave as in STORY-021 and STORY-023.
3. Tap the composer → it is disabled and reads "You can't reply here"; Attach and Dictate are not drawn.
4. Tap Back → the previous screen.

#### Variations
- The thread has an approval card: whether Edit and Send are hidden or dimmed is not drawn (STORY-045).
- The thread is archived instead: the title reads "Archived" with "Restore" (STORY-018).

#### Edge Cases
- Membership changes while the thread is open: the composer should enable without a reload (not stated).
- A group thread: the Members and Chat menu buttons for a viewer are not stated.

#### Design gaps
- How a non-member reaches a thread (an invite or share link) is not designed, and the plan has no member-management API.
- The More menu (Agent settings, Clear chat, Delete chat) is drawn for owners; which items a viewer sees is not stated.
- The disabled composer shows a plain placeholder with no explanation of how to get access.



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
**Design source**: `DS-06-Chat.dc.html` Composer (Empty, Typing, Agent running states) and "User bubble and agent message"; `PH-Thread.dc.html` (composer: Attach plus, "Message Inbox agent", Dictate mic); `PG-A-Thread.dc.html`, `PG-A-ThreadStates.dc.html` ("Running"); `PG-A-Rules.dc.html` Agent thread card ("composer Send or Stop").

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
**Design source**: `DS-06-Chat.dc.html` Composer and "Attachment chips and reply preview" specimen (chips "terms.pdf" and "chart.png", message "Check the attached"); `PH-Thread.dc.html` frame "Plus menu" (a glass menu from the Attach plus with "Photos" and "Files"); `PG-A-ThreadStates.dc.html` frame "Composer with an oversize file" (two chips, one outlined red, and "pilot-deck.pdf is over 25 MB. Remove it to send."); `PG-B-DataRoom.dc.html` frame "Thread composer: attachment sources" (Photos, Files, Data room).

#### Steps
1. Tap the 44pt glass circle with `plus` (Attach) at the left of the composer → a source menu opens: "Photos" and "Files" on the board (Expo also has "Camera"; the Data room agent's thread adds "Data room").
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
- Not drawn: Camera in the Attach menu, a per-chip upload progress state, and a chip error for failures other than size (the oversize chip is drawn).
- The chip row has no board state for 4 chips at once (it can need to scroll or wrap inside a capsule that grows to 6 lines).
- A "Data room" source is drawn only in the Data room agent's thread; no picker for artifacts exists even though `threads/send` accepts them.
- Labels differ: the board says "Photos" and "Files", Expo says "Photo library", "Camera" and "File".


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
**Design source**: Chips and Composer in `DS-06-Chat.dc.html`; `PG-A-ThreadStates.dc.html` frame "Composer with an oversize file" (a red-outlined chip and an inline line "pilot-deck.pdf is over 25 MB. Remove it to send." above the field). Notices for unsupported type, too many files and denied permission: NO BOARD. Plan: README section 5 ("convert HEIC photos to JPEG first").

#### Steps
1. Tap `plus`, choose "Photo library", select the HEIC photo and the screen recording → the HEIC is converted to JPEG on the device and shows as a chip. The recording is rejected as over 10 MiB or as an unsupported type.
2. Read the notice → for an oversize file the board puts a red chip in the composer and an inline line naming the file and the limit ("over 25 MB"; Expo says "Skipped {items} (over 10 MiB)"). Other reasons have no drawn style.
3. Tap `plus` again, choose "Photo library", select the four PNG screenshots → three are added (total 4); the fourth is skipped with "(max 4 attachments)".
4. Type a message and tap Send → four attachments upload, then the message is sent.

#### Variations
- Remove one chip, then add the skipped screenshot.
- Share extension path (phase 11): not designed.

#### Edge Cases
- A Live Photo or a HEIC larger than 10 MiB after conversion: the size check order (before or after conversion) is not specified.
- Animated GIF over 10 MiB or a zip with unsupported contents: only the declared MIME list is validated.

#### Design gaps
- Only the oversize case is drawn (inline, per chip, no auto-dismiss). "Unsupported type", "max 4 attachments" and "permission denied" have no drawn notice.
- The spec says HEIC is converted, but no user-visible state ("Converting") is defined for slow conversions.
- The size limit conflicts: the board says 25 MB, Expo says 10 MiB (and the brief says "MB"); the plan needs one limit and one unit.


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
**Design source**: `DS-06-Chat.dc.html` "Failed send bubble and reply line" (Reply line) and Composer "Replying to Ana Ruiz" preview; `PH-Thread.dc.html` frame "Message menu (long press)" (the pressed bubble lifted, a menu with "Reply" and "Copy"); `DS-04-Overlays.dc.html` context menu (Reply, Copy, Delete). React is not drawn (Expo uses native menu items "Reply", "React", "Copy").

#### Steps
1. Long-press the agent bubble → a context menu appears with "Reply" and "Copy" (`PH-Thread`; Expo also has "React").
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
- The long-press menu is drawn (Reply, Copy) but offers no "Select text" or "Pin", which DS-04 and DS-06 rely on; part-message quote and the unavailable-original case have no board.
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
**Design source**: `PG-A-ThreadStates.dc.html` frames "Offline, nothing queued" (a row under the title capsule, "Offline. Messages send when you reconnect.", composer still active) and "Offline, message queued" (a sent bubble captioned "Waiting to send"; the banner is not drawn in this frame); `DS-06-Chat.dc.html` "Failed send bubble and reply line" and caption states (sending 70% opacity). DS-04 also words it as "No connection. Your message is kept and sends when you are back online." Stale-snapshot marker and the 20-entry cap: NO BOARD.

#### Steps
1. Open the thread with no network → the saved chat snapshot shows (last 100 messages) with a banner under the title capsule: "Offline. Messages send when you reconnect."
2. Type "Order 40 crates of oats for Friday." and tap Send → the bubble appears with the caption "Waiting to send" (not "Sending") because the send is stored in the outbox as queued while the server is unreachable.
3. The network returns → the app resends the queued message (the unreachable case "goes back to queued" and is retried automatically; the exact trigger is the reachability subscription seen in `apps/mobile/lib/unsent-sends.ts`).
4. Delivery succeeds → caption changes to "Delivered" and the working indicator for the Ops agent appears.

#### Variations
- Rate limit (429): the entry returns to queued rather than failing; the user sees "Waiting to send" until it passes.
- Kill the app while queued: on relaunch the outbox is restored from disk and the send continues.
- Send three messages offline: all three queue in order.

#### Edge Cases
- Outbox holds 20 entries and 50 MB. At the cap Expo throws "Too many unsent messages"; how the native composer shows this is NO BOARD.
- The outbox lives in the OS cache directory, which the system may evict; a queued message can silently disappear. No warning is designed.
- The user switches space or signs out with queued messages: Expo scopes entries by server, space and user; the user-visible behavior is not designed.

#### Design gaps
- Offline is drawn (banner and "Waiting to send"; two copies of the explanation, one on the banner and one in DS-04). Not drawn: a stale-snapshot marker, how many messages are waiting, a way to cancel a waiting message. A server that is down while the network is up is only covered by "Could not refresh" and "Reconnecting" rows, not by a send-specific state.
- Eviction of the cache directory loses queued sends without notice.


### STORY-039: A send is refused and the user edits and retries
**Type**: long
**Topic**: Sending, attachments and offline
**Source**: topics/thread-send.md STORY-007
**Phase issue**: #417 (P5)
**Persona**: Nadia Karimi, founder of a 5-person compliance startup
**Goal**: Recover from a failed send of a message with an attachment, then send successfully.
**Preconditions**: Thread with "Legal agent" open; a 48 MB PDF is attached; the server returns a 4xx (payload too large) on the first try. (The composer already flags a file over 25 MB: "pilot-deck.pdf is over 25 MB. Remove it to send.", so this path matters when a file passes the local check or fails for another 4xx.)
**Device**: standard iPhone
**Ideal path**: 5 — Send, read "Not sent: File is over the 25 MB limit", tap "Remove file", attach a smaller file, Send.
**Alternate paths**: For a failed (not refused) send, tap "Retry" without editing; discard with a long-press "Delete" (the menu is not drawn); reduce the attachment and send a new message.
**Design source**: `PG-A-ThreadStates.dc.html` frames "Failed" (bubble with a destructive outline, row "Not sent" with "Retry"), "Refused: file too large" (bubble "Attached the pilot deck." with a file chip "pilot-deck.pdf, 48 MB" and a row "Not sent: File is over the 25 MB limit" with "Remove file", no Retry), "Composer with an oversize file" and "No model" ("Not sent: No model connected" with "Connect"); `DS-06-Chat.dc.html` "Failed send bubble and reply line". The rule card line "inline 'Failed to send message' with retry" is stale.

#### Steps
1. Attach the PDF, type "Please review the contract.", tap Send → bubble at 70% opacity, caption "Sending".
2. The server rejects with a 4xx other than 408, 425, 429 → the outbox entry becomes refused; the bubble gets a destructive outline and a row "Not sent: File is over the 25 MB limit" with "Remove file" (no Retry, because a retry would fail again). Message text is not red.
3. Tap "Remove file" → the file leaves the message; whether the text is resent at once or returns to the composer is not drawn.
4. Attach a smaller PDF if still needed → the chip row updates (the composer flags a file over the limit before sending).
5. Tap Send → bubble "Sending", then delivered.
6. (A failed, not refused, send keeps "Not sent" with "Retry": tap it to send again.)

#### Variations
- A failed (not refused) send, for example a 500: stored as failed, same bubble and row, Retry allowed.
- Failure that Expo reports as an alert: Expo shows `Alert` "Failed to send message" plus error text, and also saves the entry; the rule card describes an inline message instead. The native app must pick one.
- Refused for no model: the row reads "Not sent: No model connected" with a "Connect" button (drawn; STORY-040).

#### Edge Cases
- Refused entries count toward the 20-entry cap until deleted; a thread full of refused entries blocks new sends ("Too many unsent messages").
- A refused send with an attachment: whether "Remove file" keeps the uploaded artifacts for the text is not specified.
- The "AI data sharing" consent block ("Review AI data sharing in Account settings before continuing.") is also a 4xx and would land here as refused with no way to fix it from the bubble.

#### Design gaps
- A way to discard a failed or refused message (long-press "Delete") is not drawn; only "Retry", "Remove file" and "Connect" actions are.
- Copy: the boards agree on "Not sent" (with a reason for refused); the Agent thread rule card and Expo still say "Failed to send message".
- Reason copy for a refusal because of consent, and how a failed send becomes refused or gives up after automatic retries, are not drawn (size and no-model are).


### STORY-040: Send with no model connected, then connect one and resend
**Type**: long
**Topic**: Sending, attachments and offline
**Source**: topics/thread-send.md STORY-008
**Phase issue**: #417 (P5)
**Persona**: Ben Adeyemi, a founder trying the self-hosted server for the first time
**Goal**: Understand why the agent is not answering and fix it.
**Preconditions**: New space on a self-hosted server; no model provider connected; thread with "Chief" open.
**Device**: standard iPhone
**Ideal path**: 4 — Send, tap "Connect" on the bubble, paste the key, Connect (the board says the message sends when connecting succeeds).
**Alternate paths**: Connect the model first from Settings, "Models", then open the thread; use a subscription sign-in instead of an API key (see the settings topic).
**Design source**: `PG-A-ThreadStates.dc.html` frame "No model" (greeting-less thread with the bubble "Hello", a row "Not sent: No model connected" and a "Connect" button, and the note "Connect opens the Connect sheet; the message sends when it succeeds."); the sheet itself: `PG-A-HomeNoModel.dc.html` (API key, Local server, Subscription, key field, Connect, "Key not accepted."). Prevention: the Home card "Connect a model to start chatting." (`PG-A-HomeNoModel`, `PH-Home`).

#### Steps
1. Open "Chief" thread → empty state: agent greeting and suggestions (Agent thread rule card).
2. Type "Draft my weekly update." and tap Send → the server returns "Connect a model to start a run" (README). The README names the string; the server source (`packages/adapters/src/executor.ts`) uses "Connect a model in Settings before running bots." The strings differ, so the exact wording the app shows is TBD.
3. The bubble goes to "Not sent: No model connected" with a "Connect" button (drawn; a refused send, not a run error).
4. Tap "Connect" → the Connect sheet opens over the thread (the sheet is drawn on Home; its placement over a thread is not).
5. Paste a key and tap Connect → the sheet closes and the queued message is sent without another tap.
6. The bubble shows "Sending", then the working indicator.
7. The reply arrives and the caption reads "Delivered".

#### Variations
- Server older than the app (404 on `threads/send` fields): "not supported" handling, no board.
- A message sent while a run is already waiting for an approval: the run state `run.waiting_input` is a different flow (approvals topic).

#### Edge Cases
- Model is disconnected while a message is queued offline: the retry later fails with the same error.
- Expo also renders "Waiting for this bot's response." in the thread (line 4257 of `thread.tsx`); its native equivalent is undefined.

#### Design gaps
- The in-thread block and its Connect link are drawn; whether the Connect sheet can open over a thread (it is drawn only on Home) is not.
- Message text conflict: the board says "No model connected", the README says "Connect a model to start a run", the server says "Connect a model in Settings before running bots."


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
**Design source**: `PG-A-ThreadStates.dc.html` frames "Running" (Stop in the composer slot), "Running, text typed" (typed text "Also check Ana" with Stop still in the slot) and "Stopping" (a disabled spinner in the slot); `DS-06-Chat.dc.html` Composer "Agent running (Stop)" and its Stop rule; `PG-A-Rules.dc.html` Agent thread card.

#### Steps
1. The composer's trailing slot shows Stop (`stop.fill`) in the same prominent position as Send → tap it.
2. The client calls `threads/stop`; the slot shows a 20pt spinner for up to 3 s ("Stopping"), then the working indicator disappears, the slot returns to the mic, and an event note may appear (cancelled run).
3. Type "Focus on EU competitors only." and tap Send → bubble "Sending" then "Delivered"; the agent starts a new run.

#### Variations
- In a group thread, several agents work at once; one Stop control ends the thread's runs (the contract takes a thread target; per-agent stop is not designed).
- Stop fails: Expo shows an alert "Failed to stop work" with "Try again."; the native version must keep that.

#### Edge Cases
- The run finishes while the user taps Stop: the button turns back into the mic first; the tap may land on Dictate.
- If text is already typed, Stop keeps the slot for the whole run and the text stays as a draft; Send returns when the run ends or is stopped (drawn: "Running, text typed").

#### Design gaps
- No board for "Work stopped, but the thread could not refresh" (Expo message).
- A stop failure is described in DS-06 (the slot returns to Stop) but no frame or message is drawn; Expo shows the alert "Failed to stop work".
- With a draft kept during a run, a user who wants to send it as a correction must Stop first, then Send: two taps; whether Send could interrupt directly is not decided.


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
1. Long-press the agent bubble → the board menu has "Reply" and "Copy" only; Expo also has "React". With the board menu there is no way to reach step 2.
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
- The drawn long-press menu (`PH-Thread`) has no "React" item, so reactions have no entry point on the boards.


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
**Design source**: `DS-06-Chat.dc.html` (Composer, chips, failed bubble, reply line, working indicator); `PG-A-Thread.dc.html`, `PH-Thread.dc.html` ("Plus menu", "Message menu (long press)"); `PG-A-ThreadStates.dc.html` (offline, failed, refused, oversize composer); inner layouts in `Inner.dc.html` and the Agent thread rule card; upload progress and the reaction picker: NO BOARD.

#### Steps
1. Open the "Finance agent" thread → saved snapshot shows, then the latest page replaces it.
2. Tap `plus` → "Photo library" → pick the HEIC screenshot → converted to JPEG, chip appears.
3. Tap `plus` → "File" → pick `board-deck.pdf` → second chip.
4. Tap `plus` → "File" → pick `q3-summary.pdf` → third chip.
5. Tap `plus` → "File" → pick `cap-notes.pdf` → fourth chip (the limit).
6. Tap `plus` again → the menu still opens; picking any file shows "(max 4 attachments)".
7. Type "Summarize runway risks from these." and tap Send → four uploads then the send; bubble at 70%, caption "Sending".
8. Signal drops during step 7 → the banner "Offline. Messages send when you reconnect." appears and the bubble reads "Waiting to send"; the user keeps reading.
9. Signal returns → delivered; "Finance agent is working" appears with Stop.
10. The reply arrives with a table; tap Expand on the table → full-height sheet opens.
11. Close the sheet; long-press the reply → "Reply" (the board menu lists Reply and Copy).
12. Type "What if hiring slips two months?" and tap Send → reply line quoted above the new bubble.
13. The send is refused as too large → "Not sent: File is over the 25 MB limit" with "Remove file" (a rate limit is retried automatically instead); in the composer the chip reads "[file name] is over 25 MB. Remove it to send."; remove the file and send again → delivered.
14. Open the inner display (unfold) → the thread appears in the 2/3 pane with Personnel in the 1/3 pane; the composer text, chips and queue state must carry over.
15. Long-press the final reply → "React" → thumbs up (the board menu has no "React"; STORY-042).

#### Variations
- App backgrounded during upload: whether uploads continue in the background is not specified (60 s upload timeout in the brief).
- Hide amounts device setting on: finance cards in chat respect it; plain agent text does not.

#### Edge Cases
- Posture change while chips and an unsent draft are in the composer: not specified (discovery map: "how selection and scroll position survive these changes").
- Cache eviction of the outbox during the long session.

#### Design gaps
- NO BOARD for upload progress, the reaction picker, or posture-change continuity of the composer. The Attach menu, long-press menu, offline, "Waiting to send", "Not sent" and "Remove file" are drawn.
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
**Design source**: `PG-A-ThreadStates.dc.html` frame "First message" (greeting "Hello! How can I help?" and chips "Summarize my inbox", "Draft a reply to Ana", "What is due this week?" above a focused composer); `PG-A-Rules.dc.html` Agent thread card ("Empty: agent greeting and suggestions").

#### Steps
1. Open the new thread → agent greeting and suggestions show above the composer.
2. Tap a suggestion → either the text fills the composer or it sends at once; not defined (the frame shows the composer focused, which suggests fill).
3. Tap Send if needed → the bubble appears, working indicator follows.

#### Variations
- Dictation: tap the mic, speak, tap the mic again; text appears in the capsule (Listening state in DS-06).
- Speech permission denied: Expo shows "Allow speech recognition in Settings, or connect ElevenLabs, OpenAI, or Fish Audio."

#### Edge Cases
- No model connected: see STORY-040. First model use also shows the data-sharing sheet (STORY-048).

#### Design gaps
- Whether a chip fills the composer or sends is still undecided.



### STORY-116: Recover from an offline, a failed and a refused send in one thread
**Type**: medium
**Topic**: Sending, attachments and offline
**Source**: ux-paths round 1 refresh (board `PG-A-ThreadStates`); STORY-038 and STORY-039 cover each case alone
**Phase issue**: #417 (P5)
**Persona**: Callum Ferreira, founder replying to a customer from a train
**Goal**: Keep working with the Inbox agent while the signal comes and goes, and know which messages need him.
**Preconditions**: Thread "Inbox agent" open on the outer display; a saved snapshot exists; a model is connected.
**Device**: iPhone Duo outer
**Ideal path**: 7 — send while offline (nothing else to do), tap Retry on the failed one, tap "Remove file" on the refused one, Send.
**Alternate paths**: (a) Wait: the signal returns and the queued message goes out by itself (STORY-038). (b) Delete a failed message instead of retrying (the menu is not drawn).
**Design source**: `PG-A-ThreadStates.dc.html` (frame "Offline, nothing queued": the row "Offline. Messages send when you reconnect." under the title capsule; "Offline, message queued": a bubble "Thursday works for me." captioned "Waiting to send"; "Failed": the bubble has a destructive outline and the row "Not sent" with "Retry"; "Refused: file too large": "Attached the pilot deck." with "Not sent: File is over the 25 MB limit" and "Remove file"; "Composer with an oversize file").

#### Steps
1. Open the thread in a tunnel → the snapshot shows with the banner "Offline. Messages send when you reconnect."
2. Type "Thursday works for me." and tap Send → the bubble appears captioned "Waiting to send"; the composer stays usable.
3. The signal returns → the banner clears and the message is delivered (not drawn).
4. A send fails with a server error → the bubble gets a destructive outline and "Not sent" with "Retry".
5. Tap "Retry" → the row shows "Sending", then the message is delivered.
6. Attach the pilot deck and send → the server refuses it; the bubble reads "Not sent: File is over the 25 MB limit" with "Remove file" and no Retry (the composer would already flag it: "over 25 MB. Remove it to send.").
7. Tap "Remove file" → the file leaves the message; attach a smaller file if still needed.
8. Tap Send → "Sending", then delivered.

#### Variations
- Three messages sent offline: all queue in order and go out together.
- App killed while a message waits: the outbox is restored on relaunch.
- A message hits the rate limit (429): it goes back to "Waiting to send" and is retried without the user.

#### Edge Cases
- 20 queued entries or 50 MB: the composer stops accepting new messages ("Too many unsent messages"); no state is drawn.
- The cache directory is evicted: waiting messages vanish without notice.
- Space switch or sign-out with messages waiting: they are discarded (STORY-007).

#### Design gaps
- The banner says messages will send but not how many are waiting, and there is no way to cancel one. The queued frame draws the caption without the banner.
- "Waiting to send" is a small caption; a message that waits for hours is easy to miss when the banner has gone.
- "Remove file" is drawn as a link; what it does to the text and the other attachments, and the reason copy for a consent refusal, are not drawn (no-model is: "Not sent: No model connected" with "Connect").
- How a failed send turns into a refused one, and when automatic retries stop, are not stated.
- The banner when the network is up but the server is down is not drawn.


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
**Design source**: DS-06-Chat "MCP tool approval" card (all steps; the only board with "Allow once / Always allow / Deny"); `PG-A-Thread` and `PH-Thread` draw only the mail card ("Edit" and "Send"), and the PG-A-Rules Agent thread card now names Send on the card as the prominent control; resolved line from DS-06 "Resolved". `PG-A-ThreadStates` "Read only" draws a disabled composer ("Read only. Only members can reply.") but no card variant.

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
- Read-only approval cards (buttons hidden or dimmed) have no board; only the composer's read-only line is drawn.
- No way to expand truncated arguments before approving a money action.
- "Always allow" still has no confirmation, but the rule can now be reviewed and removed: `PG-B-Settings` draws an "Always allow" list under AI data sharing with a Remove button per rule (STORY-055).


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
**Alternate paths**: (a) Start from Inbox message → "Ask Inbox agent", then land on the same card. (b) On Duo inner display the same card appears in the right 2/3 pane beside the inbox list (Inner board). (c) Tap "Edit" to change the draft first (STORY-047); the draft autosaves, so there is no separate "Save".
**Design source**: `PG-A-Thread`, `PH-Thread` and `Inner` (card "Re: Pilot timeline", "Needs approval", "To Ana Ruiz", body, "Edit", "Send"; further frames "Draft replaced" with a muted "Replaced by a newer draft" row, "Empty recipient" with "Add a recipient", and "Agent editing the draft" with status "Updating"); DS-06-Chat "Mail approval card" (anatomy, states Needs approval, Sent, Not sent, Needs approval with Cc). All boards agree on Edit and Send. `PG-A-ThreadStates` "Approval scrolled away" draws a "Needs approval" pill above the composer that jumps to the card.

#### Steps
1. In the Inbox, tap the row "Re: Pilot timeline" from Ana Ruiz, then tap "Ask Inbox agent" (prominent) → the Inbox agent thread opens with the composer "Message Inbox agent".
2. Type "Reply to Ana: Thursday works, 10am." and tap Send → the agent works ("Inbox agent is working"), "Searched mail, 12 results" appears.
3. The card "Re: Pilot timeline — Needs approval" appears with To Ana Ruiz and the body "Hi Ana, Thursday works. Let's start at 10am." Agent text says "Here is a draft. I have not sent it."
4. Read To, Cc and body → card shows all fields; no auto-send.
5. Tap "Send" (prominent tinted capsule) → status changes to "Sent" with a check mark.

#### Variations
- Tap "Edit" or the card body: the editor opens (STORY-047); there is no "Save" because the draft autosaves.
- Decline the draft: no "Deny" is drawn any more; the user ignores the card or tells the agent in the composer.
- Draft has a Cc: DS-06 shows a Cc row between To and the body.

#### Edge Cases
- Draft has no recipient: the card shows "Add a recipient" in warning color and Send is dimmed (drawn).
- Send result is `unknown` (server cannot confirm): the composer draws "We couldn't confirm this sent. Check Sent before sending again." with "Open Sent" and "Send again"; the approval card has no such state (only Sent and Not sent).
- Mail writes are off on the deployment: the agent cannot draft a send; no drawn state for what the card shows.
- Same information appears on Inbox agent thread, Inbox message (as agent entry) and Duo inner pane; the card is one component.

#### Design gaps
- The card draws "Not sent"; the `unknown` outcome is drawn only on the compose page, not on the card.
- No way to decline a mail draft is drawn (Deny was removed with the old PG-A-Thread card); the card has no "Not now" or dismiss control.
- If the user is scrolled up when the draft arrives, a "Needs approval" pill jumps to it (drawn); a push or Home Activity tap lands at the card, but the scroll position on arrival is not stated.


### STORY-047: Fix the recipient list, then edit and send
**Type**: long
**Topic**: Approvals and AI data consent
**Source**: topics/approvals-consent.md STORY-003
**Phase issue**: #417 (P5), #418 (P6), #419 (P7)
**Persona**: Lena Hartmann, founder of a 4-person climate data startup
**Goal**: Add Jordan Lee on Cc and fix a line in the draft before it goes out
**Preconditions**: Same as STORY-046; the draft body has a wrong time; mail writes on
**Device**: iPhone Duo outer display
**Ideal path**: 6 — tap "Edit", add Jordan on Cc from the suggestion, fix the body, tap "Done", tap "Send".
**Alternate paths**: (a) Tell the agent in the composer "Add Jordan on Cc" (DS-06 shows this exact composer text) and let it produce a new draft, which needs a second approval ("Replaced by a newer draft"). (b) Edit on web, then return. (c) Close the editor; the draft autosaves in the mail account.
**Design source**: `PG-A-Thread` (card with "Edit" and "Send"); `PG-A-Compose.dc.html` frames "Edit draft" (From, To, Cc, Subject, body, a "Done" capsule, Cancel and Attach in the strip), "Cc suggestions" (typing "Jor" lists "Jordan Lee / jordan.lee@example.test"), "Invalid address" (a red chip "ana@@example" and "Not a valid address"), "Discard prompt" ("Discard changes" and "Keep editing") and "Close with typed text"; composer text "Add Jordan on Cc" is from DS-06 composer states.

#### Steps
1. Open the Inbox agent thread at the pending card "Re: Pilot timeline — Needs approval" → card shown with "Edit" and "Send".
2. Tap "Edit" (or the card body) → the "Edit draft" page opens with From, To, Cc, Subject and the body; the capsule at the bottom reads "Done".
3. Tap Cc and type "Jor" → a suggestion "Jordan Lee / jordan.lee@example.test" appears; tap it and the address becomes a chip.
4. Fix the To line if needed → an invalid address shows a red chip and "Not a valid address".
5. Change "10am" to "10:30am" in the body → text updates.
6. Tap "Done" → the page closes to the card, which shows the edited draft; tap "Send" → `threads/answer` with `allow` plus the changed fields; card shows "Sent".
7. Check the sent message in the Inbox → thread shows the edited body (verified on Inbox message screen).

#### Variations
- Recipient suggestions from contacts are drawn ("Cc suggestions").
- Remove the only recipient: "Send" must hide, as DS-06 says for a card with no recipient.

#### Edge Cases
- Invalid email in To or Cc: a red chip and "Not a valid address" show (drawn); whether Done is blocked while an address is invalid is not drawn.
- Keyboard on the outer 466x678 display: the New message frame with the keyboard open shows the fields above it; the Edit draft frames show no keyboard.
- Edits abandoned (Cancel or swipe down): the "Discard prompt" frame asks "Discard changes" or "Keep editing"; for a new message with typed text the choices are "Save draft", "Discard draft" and "Cancel".
- Unsaved edits when the app is backgrounded (the plan says saved chats redact secret asks only).

#### Design gaps
- Duo inner and half-folded layout for the editor is not drawn (`Inner-Message` draws a message beside the list, not an editor); standard iPhone has no Edit draft board.
- The Expo app has no equivalent screen found in the files read, so there is no label to match; the board labels are "Edit draft" and "Done".
- "Done" and the card "Send" are two commits of one draft: whether Done sends nothing and only saves is implied by the card, but the editor offers no direct send, so a user who finishes editing needs two taps on two screens.


### STORY-048: First model use asks for AI data sharing consent
**Type**: medium
**Topic**: Approvals and AI data consent
**Source**: topics/approvals-consent.md STORY-004
**Phase issue**: #417 (P5), #421 (P9)
**Persona**: Tomas Brandt, founder trying the app on a new self-hosted server
**Goal**: Send the first message to an agent and agree to share data with the model provider
**Preconditions**: New account, no recipient allowed in `aiConsent.status`; at least one bot exists
**Device**: standard iPhone
**Ideal path**: 3 — type, tap send, tap "Turn on" on the "Model A sharing is off" card
**Alternate paths**: (a) Pre-grant in Settings → "AI data sharing" (STORY-094) before the first message. (b) A routine run or a mid-run `ai_consent` ask card (effect kind `ai_consent`) shows "Allow" and "Not now" inside the thread. (c) Voice first: needs consent for `voice` (STORY-052).
**Design source**: The model case is the card "Model A sharing is off" with "Turn on" (frame 3 of `PG-B-Consent.dc.html`). The same board draws the Speech variant ("Share recordings with Speech A?", "Recordings and spoken text are sent to Speech A to turn speech into text.", "Allow", "Not now", "Privacy details") and the Settings page. The Connect sheet (`PG-A-HomeNoModel`) carries the line "Connecting sends your messages and attachments to Model A to run your agents. Privacy details". Composer states from DS-06-Chat. The Expo app shows a system alert titled "Share data with {name}?" with buttons "Not now", "Privacy policy", "Allow".

#### Steps
1. Open any agent thread and type "Draft a launch note" in the composer → "Send" becomes prominent (DS-06 Typing state).
2. Tap Send → the client maps `threads/send` through `aiDataUsesForProcedure` to model and memory, calls `aiConsent/status` and finds unallowed recipients.
3. The thread shows the card "Model A sharing is off" with a "Turn on" button (frame 3 of `PG-B-Consent`); the message waits in the composer or queue.
4. Tap "Turn on" → client calls `aiConsent/allow` with scope, version and the recipient key, then sends the message.
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
- The "Model A sharing is off" card is drawn with "Turn on" only; it has no "Not now" or "Privacy details", so declining means leaving the card. Several recipients in a row (Model A, then Memory A) and the sheet hiding the pending message are not drawn.
- Behavior of the composer text after "Not now" is not stated.
- Memory has no first-use wording (the Settings page only says "Summaries and memories"). Whether the Connect sheet's sentence already counts as model consent (so no sheet appears at first send) is undecided (STORY-111).


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
**Design source**: `PG-B-Consent.dc.html` frame "Speech, first use" (over a thread, a bottom sheet "Share recordings with Speech A?", "Recordings and spoken text are sent to Speech A to turn speech into text.", prominent "Allow", "Not now", "Privacy details"); the call screen is NO BOARD (DS-07 lists "Calls", no PG page). Settings page "AI data sharing" lists "Speech A, Recordings and spoken text".

#### Steps
1. Open a thread and start a call (control from the thread header; the call entry has no PG page) → client maps `voice/prepare` to the `voice` use and checks consent.
2. The sheet "Share recordings with Speech A?" appears with "Recordings and spoken text are sent to Speech A to turn speech into text." → user reads.
3. Tap "Allow" → `aiConsent/allow`, then the call begins.

#### Variations
- "Not now": call does not start; message "Review AI data sharing in Account settings before continuing."

#### Edge Cases
- Memory consent also missing: a second prompt for the memory recipient after the first (threads/send maps to model and memory).
- Dictation permission denied: Expo shows "Calls need transcription" with "Not now" and "Open Voice" — a different gate from consent.

#### Design gaps
- The call screen has no PG page. The sheet covers dictation; a call also plays generated speech, and the sheet's sentence mentions only turning speech into text.


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
**Design source**: DS-06-Chat "Choice card" ("Pick a meeting length", "30 minutes", "60 minutes", "Continue") and "Ask card" ("Which calendar should I use?", "Personal calendar", "Skip"); `PG-B-Integrations.dc.html` (connector detail frame: "Mail connector" with an "Allow writes" switch captioned "Read only", and "Remove"); tool approval is DS-06 "MCP tool approval".

#### Steps
1. In the half-folded layout open the group thread on the right half → the Choice card "Pick a meeting length" shows "30 minutes — Fits Ana's open slot" and "60 minutes — Needs a longer slot".
2. Tap "30 minutes" → the row selects.
3. Tap "Continue" → `threads/answer`; the card collapses to a resolved line.
4. The agent asks "Which calendar should I use?" with "Personal calendar" and "Skip" → ask card.
5. Tap "Personal calendar" → answer sent; agent books the slot.
6. Type "Pay the Northwind pilot invoice" and tap Send → agent replies it cannot write because writes are off (message wording not defined).
7. Open Settings → Integrations → Mercury → connector page → the page shows the connection (PG-B-Integrations).
8. Tap the connector row → the detail page shows "Allow writes" with the caption "Read only" and a switch, plus "Remove".
9. Turn "Allow writes" on → the switch is on; the caption and any warning wording are not drawn.
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
- The writes switch is drawn, but no warning copy, no explanation of what "Read only" blocks, and no board for a deployment-level switch that is disabled; `mcp.servers.setWrites` has no iOS screen.
- No message designed for "writes are off" in the thread.
- Choice card multi-select vs single-select, and keyboard handling for free-text answers, are not drawn.


### STORY-055: Review what "Always allow" has already granted
**Type**: short
**Topic**: Approvals and AI data consent
**Source**: topics/approvals-consent.md STORY-011; board added after round 1 (`PG-B-Settings`)
**Phase issue**: #421 (P9) (no phase covers it yet)
**Persona**: Ravi Deshmukh, founder who tapped "Always allow" last week and wants to undo it
**Goal**: See and remove the standing rule for the payment tool
**Preconditions**: A rule exists (`approvalRules.list` has `always_allow` for "Send mail" on the Inbox agent).
**Device**: standard iPhone
**Ideal path**: 3 — avatar, "AI data sharing", Remove on the rule.
**Alternate paths**: Use the web app; or ask the agent in chat (no known tool).
**Design source**: `PG-B-Settings.dc.html` frame "AI data sharing": three switch rows (Model A, Speech A, Memory A) followed by "Always allow" with rows "Archive mail / Inbox agent / Remove", "Send mail / Inbox agent / Remove" and "Create events / Planner agent / Remove". The `autoReview` setting has no board.

#### Steps
1. Tap the "AB" avatar → the root list shows Models, Voice, Integrations, "AI data sharing" and "Archived bots" under the profile row.
2. Tap "AI data sharing" → the three switches, then an "Always allow" list: "Archive mail / Inbox agent", "Send mail / Inbox agent", "Create events / Planner agent", each with "Remove".
3. Tap "Remove" on "Send mail / Inbox agent" → the rule goes (`approvalRules.remove`); the next send asks again.

#### Variations
- Turn auto review on or off (`autoReview.set`): no iOS screen.

#### Edge Cases
- A later "Allow once" on the same tool still appears if the rule was removed.

#### Design gaps
- The list is drawn. Not drawn: a confirmation or undo for Remove, the scope of a rule (a tool name and an agent only; no amount or recipient limits), an empty state when no rule exists, and the auto-review setting.



### STORY-117: Decline data sharing for dictation, then allow it from Settings
**Type**: medium
**Topic**: Approvals and AI data consent
**Source**: ux-paths round 1 refresh (board `PG-B-Consent`); reworked in round 2 because the board now draws the Speech prompt and not a model prompt. STORY-048 and STORY-094 cover the model path and the Settings page.
**Phase issue**: #417 (P5), #421 (P9), #423 (P11)
**Persona**: Rosalind Pereira, careful founder with customer data in her chats
**Goal**: Say "Not now" when asked to share recordings, then allow speech sharing from Settings and dictate.
**Preconditions**: A model is connected and allowed; Speech A is not allowed yet (`aiConsent.status`); the Inbox agent thread is open.
**Device**: iPhone Duo outer (the board is drawn at 466x678); a standard iPhone has no board
**Ideal path**: 7 — tap Dictate, "Not now", avatar, "AI data sharing", switch "Speech A" on, close Settings, tap Dictate.
**Alternate paths**: (a) Tap "Allow" at once (STORY-052 for a call). (b) Open "Privacy details" from the sheet first. (c) Allow nothing and type instead.
**Design source**: `PG-B-Consent.dc.html` frame "Speech, first use" (over the Inbox agent thread, a bottom sheet "Share recordings with Speech A?", "Recordings and spoken text are sent to Speech A to turn speech into text.", prominent "Allow", "Not now", and a link "Privacy details"; no "Change in Settings" link) and frame "Settings, AI data sharing" (switch rows "Model A / Messages and attachments", "Speech A / Recordings and spoken text", "Memory A / Summaries and memories", the note "Turning off Model A pauses all agents.", and "Privacy details"; `PG-B-Settings` adds an "Always allow" list). The earlier model sheet "Share data with Model A?" is no longer drawn.

#### Steps
1. In the Inbox agent thread tap the mic (Dictate) → the sheet "Share recordings with Speech A?" rises over the thread.
2. Read the sheet → one recipient (Speech A), what it receives (recordings and spoken text), and three controls: "Allow", "Not now", "Privacy details".
3. Tap "Not now" → the sheet closes and dictation does not start; what the composer shows is not drawn. (For a model message with Model A off, frame 3 of `PG-B-Consent` shows the card "Model A sharing is off" with "Turn on", not a sheet; STORY-048.)
4. Tap the mic again → the sheet returns (no "remember my choice" is drawn).
5. Dismiss it, tap Back to Home, tap the "AB" avatar, then "AI data sharing" → the page shows the three switches; "Speech A" is off.
6. Switch "Speech A" on → allowed at once (`aiConsent.allow`); "Memory A" stays off.
7. Close Settings, open the thread and tap the mic → no sheet; dictation starts.

#### Variations
- Tap "Privacy details" on the sheet or the page: the privacy policy opens in Safari, then the user returns.
- Starting a call later needs the same consent (STORY-052).
- Switch "Speech A" off again: the next dictation shows the sheet again (STORY-094).
- A model message while "Model A" is off: the thread shows the card "Model A sharing is off" with "Turn on" (STORY-048).

#### Edge Cases
- The consent text changes (a new version): the sheet appears again for that recipient.
- A switch fails to save: the switch must return to its old position; not drawn.
- Consent is revoked while dictation or a run is in progress: not stated.
- Microphone permission is a separate gate (`PG-B-Voice` "Microphone permission denied").

#### Design gaps
- The sheet has no link to Settings, so reaching the page costs four taps (avatar, Settings row if shown, "AI data sharing", switch) from a thread; the earlier board had "Change in Settings".
- What the mic and composer show after "Not now" is not drawn, and nothing tells the user that dictation needs this permission.
- Nothing explains what stops working with "Memory A" off (the page explains only that turning off Model A pauses all agents); memory has no first-use sheet.
- The page has no master switch and no "Withdraw all permissions" (STORY-094); the sheet and the page both have "Privacy details".
- Only the Speech sheet is drawn; the model and memory first-use sheets are not (STORY-048).


### STORY-125: The agent revises the mail draft while you are reading it
**Type**: medium
**Topic**: Approvals and AI data consent
**Source**: ux-paths round 2 (boards `PG-A-Thread`, `PH-Thread`, `PG-A-ThreadStates`)
**Phase issue**: #417 (P5)
**Persona**: Kasimir Orlov, founder who asked the Inbox agent to tighten a reply
**Goal**: Send the final version of the draft and not an old one.
**Preconditions**: The Inbox agent's draft to Ana Ruiz is pending ("Needs approval"); Kasimir has asked for a change in the composer.
**Device**: standard iPhone
**Ideal path**: 3 — wait for the new card, read it, tap "Send".
**Alternate paths**: (a) Tap "Edit" and change it by hand (STORY-047). (b) Ask for another change.
**Design source**: `PG-A-Thread.dc.html` and `PH-Thread.dc.html` frames "Agent editing the draft" (status "Updating", Edit dimmed), "Draft replaced" (the old card collapses to a muted row "Replaced by a newer draft" and a new card shows the new text) and "Empty recipient" (To reads "Add a recipient"); `DS-06-Chat.dc.html` "Mail approval card" states; `PG-A-ThreadStates.dc.html` "Approval scrolled away".

#### Steps
1. In the thread the card "Re: Pilot timeline" shows "Needs approval" with "Edit" and "Send"; Kasimir types "Make it shorter" and sends.
2. The agent starts revising → the card's status becomes "Updating" and "Edit" is dimmed.
3. The agent finishes → the old card collapses to one muted row "Replaced by a newer draft" and a new card appears with the new text, "Needs approval", "Edit" and "Send".
4. Read the new body ("Hi Ana, Thursday works at 10am. I will send an invite shortly.") and the To line.
5. Tap "Send" → the card shows "Sent" (STORY-046).

#### Variations
- The revision drops the recipient: the card shows "Add a recipient" in warning colour and Send is dimmed.
- The card has scrolled off screen: a "Needs approval" pill above the composer jumps to it.

#### Edge Cases
- Kasimir taps "Send" during "Updating": whether Send is dimmed too is not drawn; sending an outdated draft must not be possible.
- Kasimir is inside the editor (STORY-047) when the agent replaces the draft: not drawn.
- Two revisions arrive in a row: each older card collapses; only the newest has actions.

#### Design gaps
- Only "Edit" is drawn dimmed during "Updating"; the state of "Send" is not drawn.
- What happens to hand edits when the agent replaces the draft (a conflict) has no board.
- The collapsed row says "Replaced by a newer draft" but gives no way to see the old text.


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
**Design source**: Inbox list on a standard iPhone: `PH-Inbox.dc.html` (ten frames: the list with a "To do" card above "Needs reply 3", "Today" and "Earlier"; swipe left revealing "Spam" and "Archive"; a toast "Archived / Undo"; "Couldn't archive / Try again" with the row staying; "Inbox zero / Synced 9:41 AM"; and the mail-state frames of STORY-063 and STORY-066). Top bar: Back, a capsule with Search mail, Filter, Compose and More, and the prominent "Ask Inbox agent". Outer display: `Sheet.dc.html` (same frames). Row and swipe: `DS-05-Lists.dc.html` "Mail row" and "Swipe actions".

#### Steps
1. Open the app and tap the Inbox row on Home → Inbox opens with a 28 pt title "Inbox", a "To do" card, and sections "Needs reply" (3), "Today" and "Earlier". The first load shows placeholder rows ("Syncing your mail"), then mail from the cache.
2. Pull the list down → the list calls `inbox.refresh` (with `waitMs`) and then `inbox.list`; new mail appears at the top with a filled unread dot and semibold sender.
3. Swipe the row "Example Weekly / Five tools worth trying" left → two buttons appear, "Spam" and "Archive"; swiping past the threshold commits Archive (`inbox.archive`), the row leaves the list and a toast "Archived" with "Undo" shows.

#### Variations
- Swipe left only part way: `PH-Inbox` and `Sheet` show "Spam" and "Archive"; the DS-05 specimen shows "Archive", "Star", "Mute". Tap "Spam" instead (calls `inbox.moveMany` with `op: spam`).
- Swipe right on an unread row: "Mark read" (calls `inbox.markRead`). On a read row it reads "Mark unread".
- Several accounts connected: Expo shows an "Account" picker with "All"; the boards do not show one.

#### Edge Cases
- Archive fails ("Changing mail is turned off." or a reconnect error): the row stays and a toast "Couldn't archive" with "Try again" shows (drawn; Expo shows an alert "Could not archive {count}").
- The user archives by mistake: the toast "Archived" has an "Undo" button (drawn).
- Offline pull to refresh: the list keeps the cached rows; the board shows "Could not load mail." with retry only for a first load.

#### Design gaps
- "Star" has no write procedure in `rpc.ts`, and "Mute" maps to `inbox.feedback` by inference only. The boards draw Spam and Archive on the swipe while DS-05 lists Archive, Star and Mute; which swipe set ships is undecided.
- Section names now agree on every Inbox board ("Needs reply", "Today", "Earlier"); the Inbox rule card in `PG-A-Rules` still says "Other mail today" and must follow the boards.
- Expo row menu offers Spam and Trash; the swipe draws Spam but no Trash.
- Pull to refresh is not drawn (loading rows are, as "Syncing your mail"); the "Needs attention" and "Junk" label chips are not in the plan.


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
**Alternate paths**: From the Inbox list tap the prominent "Ask Inbox agent" button (opens the general Inbox agent, no message context; `inbox.agent`), now drawn on both `PH-Inbox` and the outer boards. From Home, open "Inbox agent" in Personnel. Expo labels the same message action "Ask agent" and the general one "Inbox agent".
**Design source**: `PG-A-InboxMessage.dc.html` (nine frames: the message; "Reply menu"; "Attachment preview" (title "pilot-timeline.pdf", "212 KB", Close and Share); "Thread" (a conversation of three messages); "Newsletter, Unsubscribe row"; "Unsubscribe confirm"; "After Archive: next message opens"; "Archive failed"; "Ask Inbox agent failed") and the "Inbox message" rule card in `PG-A-Rules.dc.html`. Attachment row: `DS-05-Lists.dc.html`. Agent thread: `PG-A-Thread.dc.html`. The standard iPhone message view: NO BOARD.

#### Steps
1. In Inbox, tap the "Re: Pilot timeline" row from Ana Ruiz → the message opens (push). The title area shows a back button "Back"; the toolbar shows "Archive", "Reply" and the prominent "Ask Inbox agent". A spinner shows in the body while `inbox.get` loads. Opening marks the thread read.
2. Read the 22 pt subject "Re: Pilot timeline", the sender line "Ana Ruiz to me Oct 19, 10:30 AM", and the 15 pt body → the body renders in a no-network web view (scripts off, remote images only through the signed proxy).
3. Tap the attachment row "pilot-timeline.pdf 212 KB" → a preview opens (drawn: title, "Close" and "Share" in the strip; Expo: `inbox-attachment`; "No preview for this file type." for unknown types).
4. Close the preview and tap "kickoff-agenda.md 4 KB" → preview opens in the same way.
5. Tap "Ask Inbox agent" → `inbox.askAgent` for this message runs (idempotent per mail conversation) and the Inbox agent thread opens with the conversation as context.
6. Type "Draft a reply that accepts Thursday morning" in the composer and send → the thread shows the working indicator "Inbox agent is working" with a stop control; the agent answers and may show a mail approval card (covered in the Approvals topic).

#### Variations
- Attachment over the size limit: the row shows the size and a disabled state (rule card).
- Sent mail (the user's own message in a thread): a "Sent" check shows beside the date.
- Plain-text mail: no web view, plain 15 pt text.

#### Edge Cases
- `inbox.get` fails: centered "Could not load mail." (rule card). The card does not say whether a retry control exists on this screen; the list screen has one.
- `askAgent` fails: a toast "Inbox agent didn't respond" with "Try again" shows (drawn). No model connected: no state is drawn.
- Message belongs to a thread with earlier messages: the "Thread" frame lists "Ana Ruiz Oct 17", "You Oct 18" and the open message; how the user reaches it from the message screen is not drawn.
- Tapping a link in the body: Expo opens `expo-web-browser`. The planned equivalent is not specified (Safari view or system browser).

#### Design gaps
- Label mismatch: board "Ask Inbox agent" versus Expo "Ask agent" (message) and "Inbox agent" (list).
- Sender avatar is listed in the rule card ("Domain (sender avatar)") and drawn as initials "AR" on the board, but the plan says nothing about where avatars come from.
- The standard iPhone message view is not drawn (`PH-Inbox` shows only the list); where "Archive", "Reply" and "Ask Inbox agent" sit at 393 pt is unknown.
- The message screen has no drawn control that opens the "Thread" frame, and `inbox.get` failure ("Could not load mail.") has no frame.


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
**Alternate paths**: Ask the Inbox agent to draft and send; approve the card "Send" (Approvals topic). Reply all and Forward are modes of the same screen (`ComposeMode`), reached from the title menu "Reply ⌄" (Reply, Reply all, Forward).
**Design source**: Reply button and "Reply menu": `PG-A-InboxMessage.dc.html`. Compose form: `PG-A-Compose.dc.html` frames "Reply" and "Reply, title menu open" (title "Reply ⌄", From picker, To chip "Ana Ruiz", "Cc, Bcc" row, Subject "Re: Pilot timeline", body, a "…" button for the quoted text; strip: Cancel xmark, Attach paperclip, prominent Send arrow), "Sending" (spinner in the Send slot), "Not sent" (a red row "Not sent. Your message is saved in Drafts." and a Retry button), "Send result unknown", "Mail changes off" and "Close with typed text". Keyboard and sheet patterns: `DS-04-Overlays.dc.html`.

#### Steps
1. On the message, tap "Reply" → a full-height compose page opens titled "Reply ⌄". The app calls `inbox.compose.prefill` with mode `reply` and the device time zone and locale; To is the chip "Ana Ruiz", Subject is "Re: Pilot timeline", and the quote sits behind a "…" button. A `clientId` is generated for idempotency.
2. Type "Thursday morning works. See you then." above the quote → text appears; the draft is held on the device.
3. Tap the prominent Send (up arrow) in the strip → `inbox.compose.send` runs and the Send slot shows a spinner (drawn: "Sending"; the fields dim).
4. The result is `sent` → the sheet closes and the original message shows a confirmation (not designed).

#### Variations
- Tap "Cancel" with typed text: a menu offers "Save draft", "Discard draft" and "Cancel" (drawn).
- Add Cc or Bcc: tap "Cc, Bcc" (the expanded rows are drawn only on "Edit draft": a Cc row with suggestions).
- Add an attachment: up to 20 files, 10 MB together (base64 inside the request).

#### Edge Cases
- Result `unknown`: the send may have gone out and must never be retried automatically. The page shows "We couldn't confirm this sent. Check Sent before sending again." with "Open Sent" and "Send again" (drawn).
- Result `failed` with reason `rejected` or `rate_limited`: nothing was sent; "Not sent. Your message is saved in Drafts." with Retry (drawn).
- Result `reconnect`: the Gmail account lacks permission to send; the user needs a "Reconnect" path.
- Result `disabled`: the page shows "Sending is off for me@example.test." with "Turn on" (drawn).
- `quoteUnavailable` is true: To and Subject come from the cache and the quote is empty.
- App is backgrounded during Send, or the connection drops: no outbox for mail is described (threads have one; mail compose does not).
- Double tap on Send: the same `clientId` makes the second call idempotent.

#### Design gaps
- The compose page is drawn for the outer display only: not drawn are the From account list, expanded Cc and Bcc rows on a reply, compose at 393 pt, and compose inside the inner and half-folded panes.
- Outcome copy for `sent` (the confirmation on the original message), `saved` and `reconnect` is not defined; `unknown`, `failed` and `disabled` are drawn.
- The board shows a full-height page with a Cancel xmark, not a sheet; whether iOS presents it as a large sheet or a pushed page is not stated.
- Reply is an "ordinary glass button" per the rule card, but no standard iPhone message board draws the toolbar group.
- "Not sent. Your message is saved in Drafts." names a Drafts place, but no Drafts view exists in the planned app (the draft lives in the mail account).


### STORY-059: Forward a message with its attachments
**Type**: medium
**Topic**: Inbox triage and compose
**Source**: topics/inbox.md STORY-004
**Phase issue**: #418 (P6)
**Persona**: Jonas Weber, head of sales at a seed-stage SaaS company
**Goal**: Forward the pilot timeline and agenda to a teammate.
**Preconditions**: "Re: Pilot timeline" open, two attachments (212 KB and 4 KB). A second Gmail account is connected.
**Device**: standard iPhone
**Ideal path**: 4 — press Reply, choose Forward, type a recipient, Send. The attachments come along without a step.
**Alternate paths**: Ask the Inbox agent to forward it (agent tools). Long-press the row in the list (menu content not drawn for forward).
**Design source**: Forward entry: `PG-A-InboxMessage.dc.html` frame "Reply menu" (a menu from the Reply button: Reply, Reply all, Forward) and `PG-A-Compose.dc.html` frame "Reply, title menu open" (the same three items under the title "Reply ⌄"). Compose form: `PG-A-Compose.dc.html` (attachment chip "kickoff-agenda.md 4 KB" with a remove control; Cc suggestions). Attachment rows: `DS-05-Lists.dc.html`.

#### Steps
1. On the open message, press "Reply" → a menu lists Reply, Reply all, Forward (the board does not say whether a tap or a long-press opens it; if a tap, plain Reply costs one more tap).
2. Choose Forward → `inbox.compose.prefill` with mode `forward`; the page opens in Forward mode with Subject "Fwd: Re: Pilot timeline", the forwarded header in the body, and the two original files listed as attachments to be re-attached on the server (`forwardOf`).
3. Type a recipient in To (for example `sam@example.com`) → the field accepts a comma-separated list. Contact suggestions are not described.
4. Check the From line, which shows the account the original arrived on → switch it with the picker if needed.
5. Tap Send → `inbox.compose.send` with `forwardOf.attachmentIds`; files are attached by the server and do not travel from the phone.
6. Result `sent` → the page closes.

#### Variations
- Remove one attachment before sending (the list is editable in the API through `attachmentIds`).
- A forward of an HTML mail: `quotedHtml` is returned for display under the forwarded header.

#### Edge Cases
- `attachmentsTooLarge` is true: the sheet should name the files in `attachmentsLeftOut` and send without them.
- Forward from a message whose body cannot be read from Gmail: `quoteUnavailable`.
- Recipient field empty: Send must stay disabled.
- Two accounts: the From account must default to the original's account, and the app must not send from the wrong one.

#### Design gaps
- Forward now has an entry on the message screen (the Reply menu); whether it opens on tap or long-press, and the same menu inside the compose title, give two routes to one action.
- The compose form and attachment chip are drawn; the forward-specific parts (the "Fwd:" subject, the forwarded header, the list of original files with their remove controls, an empty To) are not drawn.
- Recipient suggestions are drawn for the Cc field ("Jor" lists "Jordan Lee"); `contacts.list` is not tied to To on a forward.
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
**Alternate paths**: On a standard iPhone Search and Filter sit in one capsule at the top (`PH-Inbox`). Global Search (`DS-04-Overlays`, "Search across agents, mail and artifacts from anywhere") returns "Mail" results with a message jump, but `search.query` is not planned for this phase. Ask the Inbox agent "find unread mail from Northwind".
**Design source**: `Sheet.dc.html` (side strip: Back, then the group "Search mail", "Filter", "Compose", "More", and the prominent "Ask Inbox agent"). Filter content: `DS-04-Overlays.dc.html`. Search results state: `DS-05-Lists.dc.html` "Results 3". No-results text: `DS-04-Overlays.dc.html` ("No results for pilotx", "Try a sender, agent or file name.").

#### Steps
1. From Home, tap the Inbox row → Inbox opens in the 2/3 content column starting at x=72 with the 28 pt title "Inbox". The side strip has "Back", then the group "Search mail", "Filter", "Compose", "More", and the prominent "Ask Inbox agent".
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
**Design source**: To do card: `PH-Inbox.dc.html` (above "Needs reply 3": a card "To do" with circle checkboxes and rows "Confirm Thursday kickoff / Ana Ruiz · Re: Pilot timeline / Today" and "Add bank details for payroll / Acme Payroll · Payment could not be scheduled / Fri"; `Sheet.dc.html` draws the same), `DS-05-Lists.dc.html` ("To do card"). Consent state: `PH-Inbox` "Consent needed".

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
- When triage is blocked for consent, the Inbox shows "Let the Inbox agent read your mail?" with "Allow" and "Not now" (drawn, `PH-Inbox` "Consent needed"); a block for "no model" has no state, and the outcome of "Not now" is not drawn.
- The to-do due label ("Today" style) has a formatting rule only in Expo (`apps/mobile/lib/mail-inbox.ts`).
- Whether a done to-do can be seen again (history) is undefined.


### STORY-062: Bulk cleanup and unsubscribe from noisy senders
**Type**: long
**Topic**: Inbox triage and compose
**Source**: topics/inbox.md STORY-007
**Phase issue**: #418 (P6)
**Persona**: Ravi Menon, founder with 6,000 unread messages after two years of use
**Goal**: Unsubscribe from two newsletter senders, archive the old mail of three senders, then undo the archive and read the History.
**Preconditions**: Gmail connected, mail writes on, triage enabled. Cleanup list is populated by the server (five senders).
**Device**: iPhone Duo outer (the Cleanup boards are drawn at 466x678); a standard iPhone has the More button but no Cleanup frames
**Ideal path**: 10 — More, Cleanup, tick three senders (3), chevron, "Unsubscribe from 2 senders", then "Archive 101 emails" and confirm; Undo on the Done screen is an 11th tap only when needed.
**Alternate paths**: In Expo, the Newsletters filter has a "Senders" / "Digest" switch with "Archive all". The row menu offers "Archive", "Spam", "Trash" per message. Unsubscribe a single sender from the newsletter message itself (the message shows "Unsubscribe from Example Weekly" and asks "This can't be undone."). Ask the Inbox agent to "archive newsletters older than a week" (DS-05 shows this as an Inbox agent preview).
**Design source**: `PG-A-Cleanup.dc.html` (ten frames: Inbox with the strip button "More" open on "Cleanup"; "Nothing selected" (button "Archive" dimmed, "Select senders to clean up"); "Senders ticked" ("3 senders selected", "Archive 101 emails"); "Bulk action menu" ("Unsubscribe from 2 senders", "Skip inbox for future mail"); "Confirm" (sheet "Archive 101 emails from 3 senders? / You can undo this afterwards."); "In progress" ("Archiving"); "Failed" ("Couldn't archive. Nothing was moved." and "Try again"); "Done" ("3 senders cleaned up", "101 emails archived · 2 unsubscribed", "Undo", "Undo brings back the emails. Unsubscribing can't be undone."); "Empty" ("Nothing to clean up"); "History" (dated rows with Undo)). `PG-A-InboxMessage.dc.html` frames "Newsletter, Unsubscribe row" and "Unsubscribe confirm". Not drawn: a bulk unsubscribe confirmation, per-sender unsubscribe outcomes, "Looks like spam", "% read", "Not spam", "Trash", "Learned / Forget", "Skipping / Stop", the sender-list loading and error states. `PH-Inbox` has the More button but no frame for its menu.

#### Steps
1. Open Inbox, then the "More" button in the strip (ellipsis, beside Search, Filter and Compose) → a menu with one item, "Cleanup" (checklist icon).
2. Tap "Cleanup" → the cleanup screen loads (`inbox.cleanup.list`) with a spinner (not drawn), then the title "Cleanup", a clock button (History) in the strip and a list of senders. Each row shows a circle, the sender name and "{count} emails · last {date}" (Expo: "{count} messages · {percent}% read"). The bottom button reads "Archive", dimmed, with "Select senders to clean up".
3. Tap the first sender "Example Weekly" → the circle fills with a check.
4. Select two more senders → the caption reads "3 senders selected" and the prominent button reads "Archive 101 emails".
5. Tap the chevron beside it → a menu: "Unsubscribe from 2 senders" and "Skip inbox for future mail" (Expo also has "Spam", "Not spam" and "Trash"; the board has none).
6. Choose "Unsubscribe from 2 senders" → `inbox.unsubscribe` runs per sender and returns one of `done`, `opened` (open a link), `sent`, `unknown`, `refused`, `disabled`, `unavailable`. No confirmation is drawn for the bulk action, although the single-message version asks "Unsubscribe from Example Weekly? This can't be undone."
7. For a sender that returns `opened` → the row should offer "Open link" (not drawn); the page opens in a browser and the user returns.
8. For a sender whose unsubscribe is by mail → Expo shows an alert "Send an unsubscribe email to {address}?" with "Cancel" and "Send" (not drawn).
9. For a sender that returns `refused` or `unavailable` → Expo shows "Could not update {name}" and, where possible, "Open link" (not drawn).
10. Tap "Archive 101 emails" → a sheet asks "Archive 101 emails from 3 senders?" with "You can undo this afterwards."; tap "Archive 101 emails".
11. The button shows "Archiving" and the strip keeps only Back → `inbox.cleanup.archive` runs. On failure the bar reads "Couldn't archive. Nothing was moved." with "Try again".
12. The Done screen appears → a check, "3 senders cleaned up", "101 emails archived · 2 unsubscribed", "Undo" and "Undo brings back the emails. Unsubscribing can't be undone."
13. Tap "Undo" → `inbox.actions.undo` returns `restored` and `failed` counts; the archived mail returns to the Inbox (the unsubscribes stay).
14. Go back to Cleanup and tap the clock button → "History" lists "Today, 9:41 AM / 3 senders · 101 emails archived · 2 unsubscribed" with Undo, then older actions.
15. Go back to Inbox → the list reflects the changes after the next `inbox.list`.

#### Variations
- "Skip inbox for future mail" for the ticked senders (a Gmail filter); its consequence is not explained on the board.
- A sender marked with "Gmail filter limit reached" or "Couldn't add Gmail filter": the row shows the message and the action is not applied for future mail (not drawn).
- Mark one sender as spam instead: the swipe in the Inbox offers "Spam" (STORY-056); the Cleanup menu does not.
- "Nothing to clean up" with "Senders that fill your inbox appear here." when the list is empty (drawn).

#### Edge Cases
- `unknown` result on an unsubscribe email: never retried automatically; the row must not say "Done" (the Done line counts "2 unsubscribed" without distinguishing results).
- Partial failure of a bulk action (`failed` list): the board shows only "Nothing was moved."; a partial failure has no state.
- More than 50 messages in one move (`MAX_BULK_ARCHIVE`): the client must batch.
- Account needs reconnect: bulk actions fail with `reconnect`.
- Mail writes off: every action returns `disabled` ("Changing mail is turned off."); Cleanup draws no such state (the Inbox draws "Changes to mail are off").

#### Design gaps
- Drawn now: the list, the bulk menu, the archive confirmation, progress, failure, Done, empty and History. Not drawn: a confirmation or outcome for bulk unsubscribe, per-row results (`opened`, `sent`, `unknown`, `refused`), the sender-list loading and error states, "Looks like spam", "% read", "Learned / Forget" and "Skipping / Stop".
- `PH-Inbox` has the More button, but its menu and a standard-iPhone Cleanup screen are not drawn.
- The main button is "Archive" and the unsubscribe sits in a chevron menu, so the one prominent action is the lower-risk one; unsubscribing, which "can't be undone", has no confirmation while archiving has one.
- "Skip inbox for future mail" is unexplained, and "Spam", "Not spam", "Trash", "Learned" and "Forget" are not in the menu.
- The Done screen counts "2 unsubscribed" but the Undo text says unsubscribing can't be undone; History repeats the same Undo and does not say whether it still works after days.
- DECISION: Cleanup has a full set of boards; confirm it belongs to phase 6 (#418).


### STORY-063: Mail writes are turned off, or the Gmail account needs reconnecting
**Type**: medium
**Topic**: Inbox triage and compose
**Source**: topics/inbox.md STORY-008
**Phase issue**: #418 (P6)
**Persona**: Hannah Berg, operations manager at a company whose admin disabled mail writes
**Goal**: Try to archive and reply, understand why it fails, and still read mail.
**Preconditions**: The deployment has mail writes off (a self-hosted server). One account in `reconnectAccounts` after Google asked for a new permission.
**Device**: standard iPhone
**Ideal path**: 2 — read the card, tap "Turn on" or "Reconnect" (where those lead is not drawn).
**Alternate paths**: Integrations (`PG-B-Integrations.dc.html`, "Continue in setup") to reconnect Gmail. The Expo app surfaces `reconnectAccounts` only through the alert text.
**Design source**: `PH-Inbox.dc.html` and `Sheet.dc.html` frames "Mail changes off" (a card "Changes to mail are off / Archive, spam and replies are paused for me@example.test." with "Turn on" above the list), "Gmail needs reconnecting" (a card "Gmail needs to reconnect / Mail stopped syncing at 8:12 AM." with "Reconnect"), "No mail account" and "Archive failed, row stays"; `PG-A-Compose.dc.html` "Mail changes off" ("Sending is off for me@example.test." with "Turn on"). Integrations screen: `PG-B-Integrations.dc.html` (connector detail "Allow writes").

#### Steps
1. Open Inbox → mail loads normally (reads work), the rows show and a card "Changes to mail are off" sits above them with a "Turn on" button.
2. Swipe left on a row past the threshold → Archive is attempted or blocked; the card says it is paused, and a failed attempt shows the toast "Couldn't archive / Try again" and the row returns.
3. Open a message and tap "Reply" → the compose page opens with a row "Sending is off for me@example.test." and "Turn on".
4. Tap "Turn on" → the user is taken to the connector's "Allow writes" switch (assumed; the target is not drawn). The typed text is kept.

#### Variations
- Reconnect case: sync returns the account in `reconnectAccounts`; the list shows older mail under a card "Gmail needs to reconnect" with "Reconnect" (drawn); where it leads is not.
- `failedAccounts` but not reconnect: a sync problem with a retry; `rateLimitedAccounts` means wait.
- No account connected (`accounts` empty): "No mail account / Connect Gmail to see your inbox here." with "Connect Gmail" (drawn; STORY-066).

#### Edge Cases
- A bulk action where some succeed and some fail with `reconnect`.
- Self-hosted older server returns 404 for `inbox.actions.list` or `moveMany`: the client treats it as not supported and hides the feature.
- Mail writes off while a draft exists: the draft is kept on the device.

#### Design gaps
- A rate-limited account (`rateLimitedAccounts`) and a partial failure across accounts have no state; writes off, reconnect and no account are drawn.
- The card appears before any write fails, so the client must know the setting; whether a capability flag exists is not stated.
- "Inbox zero" with the last sync time and a first-sync state are both drawn now.
- "Turn on" is offered to the user, but on a deployment where an administrator disabled mail writes (this persona) the user cannot turn it on; the card has no wording for that case.


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
**Design source**: `Inner.dc.html` (half-folded: the Inbox list beside the Inbox agent thread with the approval card), `Inner-Message.dc.html` (half-folded: the Inbox list beside the open message, with Archive, Reply, More and "Ask Inbox agent" in the strip), `Split.dc.html` (flat: the one inner sidebar with "Personal ⌄", an "Activity / 1 needs you" row, PAGES, PERSONNEL and a profile row, beside the message list with Filter, Compose, More and "Ask Inbox agent" in the strip), rule cards "Inbox" and "Inbox message" in `PG-A-Rules.dc.html`. Reply and compose form: `PG-A-Compose.dc.html` (outer display only); its place in the inner detail pane: NO BOARD.

#### Steps
1. Open the app on the inner display → the sidebar third shows "Personal ⌄", Activity, PAGES (with the Inbox row) and PERSONNEL; the detail shows the last page or thread.
2. Tap the Inbox row in PAGES → the detail shows the message list (rule card). The sidebar keeps its selection.
3. Tap the first row "Ana Ruiz, Re: Pilot timeline" → the list becomes the sidebar and the message opens in the detail pane; the row shows the selected fill.
4. Read the body → it renders in the web view in the detail pane; the fold zone x 435 to 455 stays empty.
5. Tap "Reply" → a composer opens under the message (half-folded) or as a sheet in the detail pane (flat), prefilled.
6. Type the reply and tap Send → result `sent`; the pane returns to the message.
7. Tap "Archive" in the strip → the message archives and the next row down is selected (rule card: "Archive selects the next row down").
8. Tap the second row "Jordan Lee, Intro: design partner" → the message opens.
9. Tap "Ask Inbox agent" → the detail pane switches to the Inbox agent thread with this conversation as context (`inbox.askAgent`).
10. Send "Reply yes and suggest Tuesday" → the thread shows "Inbox agent is working" with the stop control; the agent returns a draft with an approval card.
11. Tap "view draft", then "Send" on the card → the mail sends (Approvals topic); the card shows outcome `sent`.
12. Tap the list's third row "Northwind Support, Your ticket was updated" → the message opens.
13. Tap "Archive" → archived; "Needs reply" count goes from 3 to 0 and the header hides or shows 0.
14. Tap "Filter" in the strip → a popover opens under the Filter button in the trailing pane, no scrim ("Show in inbox": "Needs reply", "Newsletters", "Read mail").
15. Turn off "Read mail" → read mail leaves the list.
16. Tap "More" → a menu with "Cleanup" (STORY-062); there is no "Important only" control in the current boards.
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
- `PG-A-Compose` draws the form for the outer display only; the inner 2/3 pane (sheet inside the detail) and the half-folded "composer under the message" are not drawn.
- The sidebar third lists PAGES and PERSONNEL, not mail folders; the sections (Needs reply, Today, Earlier) are drawn in the list.
- "Inbox zero" empty state in the two-pane layout is not drawn (what the detail shows).
- "Cleanup" lives in More (drawn on the strip); "Star" and "Mute" have no home in the two-pane layout.


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
**Design source**: "Compose" button: `Sheet.dc.html` (strip) and `PH-Inbox.dc.html` (top capsule). Compose form: `PG-A-Compose.dc.html` frames "New message" (title "New message", From picker "me@example.test ⌄", To chip, "Cc, Bcc" row, Subject, body, attachment chip with a remove control; strip: Cancel xmark, Attach paperclip, prominent Send arrow), "New message, keyboard open", "Send disabled: no recipient" ("Add a recipient", Send dimmed), "Sending", "Not sent", "Send result unknown", "Mail changes off" and "Close with typed text".

#### Steps
1. In Inbox, tap "Compose" in the strip group → a compose page titled "New message" opens in the content area beside the strip. The From line defaults to one account; no `prefill` call is needed for a blank message.
2. Enter `sam@example.com` in To, "Intro" in Subject, and a short message in the body → the fields hold text and a `clientId` is created.
3. Tap the From line and choose the second account → `connectionId` changes.
4. Tap the prominent Send (up arrow) → `inbox.compose.send` with no `replyToMessageId`; result `sent`, the page closes.

#### Variations
- Close with Cancel while there is text: a menu "Save draft", "Discard draft", "Cancel" (drawn).
- Keyboard rises from the bottom; on a short height (466x420) the body field scrolls.

#### Edge Cases
- Invalid address: a red chip and "Not a valid address" are drawn on "Edit draft"; the new-message page is assumed to match.
- Subject empty: Gmail sends without a subject; whether the app warns is not defined.
- Body over 150,000 characters (`MAX_COMPOSE_BODY`).
- Saved drafts are not listed anywhere in the planned app (no Drafts view).

#### Design gaps
- Contact suggestions are drawn for Cc ("Cc suggestions"); To on a new message is assumed to match.
- Saved drafts are not listed anywhere in the planned app (no Drafts view, `draftSave` has no list procedure in `rpc.ts`) although "Not sent" says the message is saved in Drafts. The From account list and any warning for the wrong account are not drawn.


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
**Design source**: `PH-Inbox.dc.html` and `Sheet.dc.html` frames "No mail account" ("Connect Gmail to see your inbox here." with a prominent "Connect Gmail"), "Consent needed" ("Let the Inbox agent read your mail? / It sorts mail and drafts replies. You approve anything it sends." with "Allow" and "Not now"), "First sync" (the line "Syncing your mail" over placeholder rows) and "Inbox zero" ("Synced 9:41 AM"). Integrations: `PG-B-Integrations.dc.html`.

#### Steps
1. Tap the Inbox row on Home → Inbox opens; `inbox.list` returns `accounts: []`.
2. See the empty state → "No mail account" with "Connect Gmail to see your inbox here." and a "Connect Gmail" button (Expo says "Connect mail" and "No mail"); "Inbox zero" is kept for a synced, empty inbox.
3. Tap "Connect Gmail" → the Integrations connect flow starts in `ASWebAuthenticationSession`; after approval the app returns and polls for the connection. The Inbox may then show "Let the Inbox agent read your mail?" with "Allow" and "Not now".
4. Return to the Inbox → "Syncing your mail" and placeholder rows show while the first sync runs (`triagePending` is true, so the client refetches a few times), then mail and sections appear.

#### Variations
- Triage blocked: with consent missing the Inbox shows the "Consent needed" card; with "no model" mail shows without "Needs reply", labels or to-dos and nothing says why.
- Sync fails once: "Could not load mail." with retry (rule card; not drawn on `PH-Inbox`).

#### Edge Cases
- User cancels the Google sign-in: the Inbox returns to the empty state.
- Sync finishes with zero messages: "Inbox zero" with `syncedAt` null (the board always shows a time).
- The user switches space: the Inbox is per space and user, so the empty state may return.

#### Design gaps
- The first-sync line says "Syncing your mail" and does not say that triage may still be running.
- The consent card is drawn, but what "Not now" leaves behind (an Inbox without sorting, or nothing) is not, and nothing connects it to Settings, AI data sharing, where it can be changed.



### STORY-114: Compose a new email from the standard iPhone Inbox
**Type**: short
**Topic**: Inbox triage and compose
**Source**: ux-paths round 1 refresh (boards `PH-Inbox`, `PG-A-Compose`)
**Phase issue**: #418 (P6)
**Persona**: Marguerite Voss, founder who emails a new advisor between meetings
**Goal**: Send a short intro email with one attachment from the second Gmail account.
**Preconditions**: Two Gmail accounts connected, mail writes on, Inbox open on a standard iPhone.
**Device**: standard iPhone
**Ideal path**: 6 — tap Compose, type To, type Subject, type the body, tap Attach and pick a file, tap Send. (Without an attachment: 5.)
**Alternate paths**: (a) Tap the prominent "Ask Inbox agent" and ask it to write the mail. (b) The same on the outer display (STORY-065). (c) Reply from a message (STORY-058).
**Design source**: `PH-Inbox.dc.html` (the top capsule: Search mail, Filter, Compose, More; the prominent control is "Ask Inbox agent"); `PG-A-Compose.dc.html` frames "New message", "New message, keyboard open", "Send disabled: no recipient", "Sending", "Not sent", "Send result unknown", "Mail changes off" and "Close with typed text" (outer layout: title "New message", From picker, To chip, "Cc, Bcc", Subject, body, attachment chip with remove; strip: Cancel xmark, Attach paperclip, prominent Send arrow). Compose at 393 pt: NO BOARD.

#### Steps
1. In Inbox tap Compose (the pencil icon in the top capsule) → a compose page titled "New message" opens.
2. Type the address in To → it becomes a chip (contact suggestions are not drawn).
3. Tap From and pick the second account → the account changes (the list is not drawn).
4. Type the Subject and the body → text appears.
5. Tap Attach (paperclip) → the system picker opens; pick `kickoff-agenda.md` → a chip "kickoff-agenda.md 4 KB" with a remove control appears under the body.
6. Tap Send (prominent up arrow) → `inbox.compose.send` runs; result `sent`; the page closes.

#### Variations
- Tap Cancel (xmark) with text typed: "Save draft", "Discard draft" or "Cancel" (drawn on the outer layout).
- Tap "Cc, Bcc" to reveal the two rows (not drawn expanded).
- Remove the attachment with the x on its chip.

#### Edge Cases
- Invalid address: the API accepts text; validation copy is not drawn.
- Empty subject: Gmail sends without one; the app does not warn.
- Result `unknown`, `disabled` or `failed`: copy is drawn on the outer compose ("We couldn't confirm this sent…", "Sending is off for me@example.test.", "Not sent. Your message is saved in Drafts."); `reconnect` is not (STORY-058, STORY-063).
- Attachments over 10 MB together or more than 20 files: the limit message is not drawn.

#### Design gaps
- Compose at 393 pt is not drawn; the outer board puts Cancel, Attach and Send in the side strip, and the standard iPhone equivalent (toolbar, keyboard accessory) is unknown.
- The From account list and saved drafts (no Drafts view exists) are not drawn; Cc suggestions are.


### STORY-115: Archive three newsletter senders in one pass, then undo
**Type**: medium
**Topic**: Inbox triage and compose
**Source**: ux-paths round 1 refresh (board `PG-A-Cleanup`); STORY-062 covers the long unsubscribe and spam variant
**Phase issue**: #418 (P6)
**Persona**: Aurelia Pike, founder with a crowded Inbox who wants the noise gone before Monday
**Goal**: Archive all mail from three newsletter senders at once, and put one sender back because she still needs it.
**Preconditions**: Gmail connected, mail writes on, triage on; the Cleanup list is populated (five senders). iPhone Duo outer display.
**Device**: iPhone Duo outer
**Ideal path**: 7 — More, Cleanup, tick three senders, "Archive 101 emails", confirm "Archive 101 emails"; read the result. "Undo" is an 8th tap only when needed.
**Alternate paths**: (a) Open the chevron menu and choose "Unsubscribe from 2 senders" or "Skip inbox for future mail" instead (STORY-062). (b) Archive one sender at a time by swiping rows in the Inbox (STORY-056), which is slower for 100 or more messages.
**Design source**: `PG-A-Cleanup.dc.html` (ten frames: Inbox with the strip button "More" open on one item "Cleanup"; "Nothing selected" (button "Archive" dimmed and "Select senders to clean up"); "Senders ticked" ("3 senders selected" and "Archive 101 emails"); the bulk menu ("Unsubscribe from 2 senders", "Skip inbox for future mail"); "Confirm" (a sheet "Archive 101 emails from 3 senders? / You can undo this afterwards." with "Archive 101 emails" and "Cancel"); "In progress" (button "Archiving" with a spinner); "Failed" ("Couldn't archive. Nothing was moved." and "Try again"); "Done" ("3 senders cleaned up", "101 emails archived · 2 unsubscribed", "Undo", "Undo brings back the emails. Unsubscribing can't be undone."); "Empty" ("Nothing to clean up"); "History" (dated rows with Undo)). `PH-Inbox` has the More button but no frame for its menu.

#### Steps
1. In Inbox tap "More" (ellipsis) in the strip → a menu with "Cleanup" opens.
2. Tap "Cleanup" → the list shows five senders, each with a circle, a name and "48 emails · last Oct 19" style counts; the bottom button reads "Archive" (dimmed) with "Select senders to clean up".
3. Tap "Example Weekly", "Northwind Deals" and "Acme Digest" → three circles fill; the caption reads "3 senders selected" and the button reads "Archive 101 emails".
4. Tap "Archive 101 emails" → a sheet asks "Archive 101 emails from 3 senders?" with "You can undo this afterwards."; tap "Archive 101 emails" → the button shows "Archiving" (`inbox.cleanup.archive`).
5. Read the Done screen → a check, "3 senders cleaned up", "101 emails archived" and "Undo" with "Undo brings back the emails."
6. Realize Northwind Deals had a receipt she needs; tap "Undo" → `inbox.actions.undo` restores all the archived mail (undoing one sender is not offered).

#### Variations
- Open the chevron menu instead of tapping the main button: "Unsubscribe from 2 senders" is offered for two of the three ticked senders and "Skip inbox for future mail" for the ticked set; "Spam" is no longer in the menu.
- Tick nothing: the button reads "Archive" dimmed with "Select senders to clean up" (drawn).

#### Edge Cases
- Mail writes are off: every action returns `disabled` ("Changing mail is turned off."); no state is drawn.
- Failure: "Couldn't archive. Nothing was moved." with "Try again" (drawn); a partial failure (some senders moved) is not.
- More than 50 messages in one move: the client batches (`MAX_BULK_ARCHIVE`).
- Undo after leaving the Done screen: a "History" list with an Undo per dated action is drawn, reached from the clock button in the strip.

#### Design gaps
- The sheet before archiving states the count and that it can be undone, but shows no sender preview or sample subject line.
- "Undo" restores all three senders or none; undoing one sender is not offered.
- The menu counts differ ("Unsubscribe from 2 senders" of 3 ticked) without saying why.
- No loading state for the sender list, no "select all", and no sample subject line to recognize a sender; "Nothing to clean up" and the failure state are drawn.
- The Done screen leaves with the Back chevron only; where Back lands and whether the Inbox list refreshes is not stated.
- `PH-Inbox` has the More button, but its menu and a standard-iPhone Cleanup screen are not drawn.


### STORY-119: Unsubscribe from one newsletter from its message
**Type**: short
**Topic**: Inbox triage and compose
**Source**: ux-paths round 2 (board `PG-A-InboxMessage`)
**Phase issue**: #418 (P6)
**Persona**: Cleo Ramsay, founder whose inbox is full of one weekly newsletter
**Goal**: Stop the "Example Weekly" newsletter for good from the message she just opened.
**Preconditions**: Gmail connected, mail writes on. The message "Five tools worth trying" from Example Weekly is in the Inbox.
**Device**: iPhone Duo outer
**Ideal path**: 3 — open the message, tap "Unsubscribe from Example Weekly", tap "Unsubscribe".
**Alternate paths**: (a) Clean up several senders at once (STORY-062). (b) Swipe the row to Archive and leave the newsletter running (STORY-056). (c) Ask the Inbox agent to unsubscribe.
**Design source**: `PG-A-InboxMessage.dc.html` frames "Newsletter, Unsubscribe row" (the message from "Example Weekly" with a row "Unsubscribe from Example Weekly" above the body) and "Unsubscribe confirm" (an alert "Unsubscribe from Example Weekly? / This can't be undone." with "Unsubscribe" and "Cancel"). The result and failure states: NO BOARD.

#### Steps
1. In Inbox tap the row "Example Weekly / Five tools worth trying" → the message opens; a row "Unsubscribe from Example Weekly" sits between the sender line and the body.
2. Tap that row → an alert asks "Unsubscribe from Example Weekly?" and says "This can't be undone."
3. Tap "Unsubscribe" → `inbox.unsubscribe` runs and returns `done`, `opened` (a web page must be opened), `sent` (an unsubscribe email went out), `unknown`, `refused`, `disabled` or `unavailable`; no result is drawn.
4. Tap Archive in the strip → the message leaves the list and the next row opens (drawn: "After Archive: next message opens").

#### Variations
- Tap "Cancel": the alert closes and nothing changes.
- The server answers `opened`: the app should open the sender's page in a browser and return (not drawn).
- Several messages from the same sender: unsubscribing once does not remove them; archiving them is a Cleanup job (STORY-062).

#### Edge Cases
- `unknown` for an unsubscribe email: never retried automatically; the row must not say "Done".
- Mail writes are off: the row should not be offered, or should explain (Inbox shows "Changes to mail are off").
- A message with no unsubscribe information: whether the row is hidden is not stated.

#### Design gaps
- Nothing is drawn after the alert's "Unsubscribe": no progress, no success line, no failure line, and no wording for `opened` or `sent`.
- The alert says "This can't be undone" but does not say what happens (an email, a web page, or both) or that mail already received stays.
- The row appears only on the newsletter frame; the rule for when it is offered is not stated.
- The standard iPhone message view is not drawn.


### STORY-121: Allow the Inbox agent to read mail after connecting Gmail
**Type**: short
**Topic**: Inbox triage and compose
**Source**: ux-paths round 2 (board `PH-Inbox`, frame "Consent needed")
**Phase issue**: #418 (P6), #417 (P5)
**Persona**: Teodor Lindqvist, founder who just connected his Gmail account
**Goal**: Let the Inbox agent sort his mail and draft replies, knowing it cannot send without him.
**Preconditions**: Gmail is connected (STORY-066); mail triage has not been allowed (`aiConsent.status`).
**Device**: standard iPhone
**Ideal path**: 3 — open Inbox, read the prompt, tap "Allow".
**Alternate paths**: (a) Tap "Not now" and read mail without sorting. (b) Allow it later from Settings, "AI data sharing" (STORY-094).
**Design source**: `PH-Inbox.dc.html` and `Sheet.dc.html` frames "Consent needed" (a centred message "Let the Inbox agent read your mail? / It sorts mail and drafts replies. You approve anything it sends." with "Allow" and "Not now" and no toolbar buttons) and "First sync" ("Syncing your mail" with placeholder rows).

#### Steps
1. Tap the Inbox row on Home → the Inbox shows only the title, a Back button and the prompt "Let the Inbox agent read your mail?".
2. Read the text → it says what the agent does (sorts mail, drafts replies) and that sending needs his approval.
3. Tap "Allow" → `aiConsent.allow` runs; the Inbox shows "Syncing your mail" over placeholder rows.
4. Wait → mail appears in "Needs reply", "Today" and "Earlier", with the To do card (STORY-056, STORY-061).

#### Variations
- Tap "Not now": the outcome is not drawn (an unsorted list, or the prompt again on the next visit).
- The consent is already given in Settings: the prompt never appears.

#### Edge Cases
- The consent text changes (a new version): the prompt returns.
- Consent is withdrawn later: the Inbox returns to this prompt, or to an unsorted list (not stated).
- Offline when tapping "Allow": not drawn.

#### Design gaps
- The prompt does not say which recipient receives the mail (the model, memory, or both) and has no "Privacy details" link, while the Speech sheet and the Settings page do.
- What "Not now" leaves behind (and how to change the decision) is not drawn.
- The Inbox hides Search, Filter and Compose while the prompt shows, so a user who says "Not now" cannot read or write mail until a state is chosen.
- It is not stated how this prompt relates to the Connect sheet's line about sharing messages (STORY-111) and the AI data sharing page (STORY-094).


### STORY-127: Recover when a new email does not send
**Type**: medium
**Topic**: Inbox triage and compose
**Source**: ux-paths round 2 (board `PG-A-Compose`)
**Phase issue**: #418 (P6)
**Persona**: Selma Okoye, founder sending a quote to a customer on a weak connection
**Goal**: Know whether the email went out, and send it without sending it twice.
**Preconditions**: Gmail connected; she has written "Pilot kickoff" to Ana Ruiz on the outer display.
**Device**: iPhone Duo outer
**Ideal path**: 3 — tap Send, read the result, tap "Retry".
**Alternate paths**: (a) Close the page and keep the draft ("Save draft"). (b) Ask the Inbox agent to send it (STORY-046).
**Design source**: `PG-A-Compose.dc.html` frames "Send disabled: no recipient" (To reads "Add a recipient", Send dimmed), "Sending" (the Send button shows a spinner and the fields dim), "Not sent" (a red row "Not sent. Your message is saved in Drafts." and a "Retry" button), "Send result unknown" (a row "We couldn't confirm this sent. Check Sent before sending again." with "Open Sent" and "Send again") and "Mail changes off" (a row "Sending is off for me@example.test." with "Turn on").

#### Steps
1. Tap the prominent Send (up arrow) → the button shows a spinner ("Sending") and the fields dim.
2. The request fails → a red row reads "Not sent. Your message is saved in Drafts." and the button becomes "Retry".
3. Tap "Retry" → `inbox.compose.send` runs again with the same `clientId`; on success the page closes.

#### Variations
- The result is unknown: the row reads "We couldn't confirm this sent. Check Sent before sending again." Tap "Open Sent" to look, or "Send again" if it is not there.
- Mail changes are off: the row reads "Sending is off for me@example.test." Tap "Turn on".
- No recipient: Send is dimmed and To reads "Add a recipient".

#### Edge Cases
- The same `clientId` makes a second send idempotent, so a double tap on Retry does not send twice.
- The user closes the page during "Sending": the draft prompt ("Save draft", "Discard draft", "Cancel") is drawn only for typed text.
- The network returns after "Not sent": nothing resends automatically; there is no outbox for mail.

#### Design gaps
- "Open Sent" opens a Sent view that does not exist in the planned app (only the Inbox is planned); where it leads is not stated.
- "Saved in Drafts" names a Drafts place that has no view in the app either.
- "Send again" after "unknown" can produce a duplicate; the row does not warn.
- "Turn on" does not say where it leads, and a member cannot turn it on when an administrator disabled mail writes.
- Only the outer display is drawn; the standard iPhone page has no board.


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
**Design source**: Agent thread: `PG-A-Thread.dc.html` and `PH-Thread.dc.html` (three-dots "Chat menu": Agent settings, Open computer, Clear chat, Archive, Delete chat); `PG-A-ThreadStates.dc.html` "Computer block" (a message "Inbox agent opened Team computer" with a preview card, "Team computer / Inbox agent is using it" and a "Take control" button). Computer: `PH-Computer.dc.html` and `PG-A-Computer.dc.html` frame "Watching" (Close, "Fit to screen", Team/Private picker, caption "Finance agent is driving", prominent "Take control"), PG-A-Rules "Computer".

#### Steps
1. In the Finance agent thread, tap the three-dots "Chat menu", then "Open computer" → Team Computer screen pushes; clear-glass controls over the live screen. If the computer is stopped, the screen reads "Starting Team computer" (STORY-068).
2. Read the screen. The "Team / Private" picker sits at the top and the caption "Finance agent is driving" names who is in control; "Take control" is the prominent button. → The screen is view-only; no key bar is shown. Screen URL comes from `computer/screenUrl`; status is polled about every 2 s.
3. Tap "Close" → Returns to the thread.

#### Variations
- Tap a computer block inside a message instead of the More menu.
- The agent finishes its task while the user watches; the screen stays as the last frame.

#### Edge Cases
- Screen URL is a one-hour capability URL; at 50 minutes it must renew without reloading the web view.
- Backgrounding the app during a long watch: heartbeat (every 60 s) behavior is not specified.

#### Design gaps
- The More menu label is "Open computer" on the boards; the rule card prose still writes "open computer" in lowercase.


### STORY-068: Boot a stopped Team Computer and take control for a login
**Type**: long
**Topic**: Team Computer, artifacts, agent pages and routines
**Source**: topics/computer-artifacts.md STORY-002
**Phase issue**: #420 (P8), #419 (P7)
**Persona**: Tomas Lindqvist, operator of a two-person logistics software company
**Goal**: Open a stopped computer, take control, log in to a vendor portal by hand, type a code, and hand control back so the agent continues.
**Preconditions**: Signed in; a bot whose computer is stopped; the agent has asked for a human login ("Needs you").
**Device**: iPhone Duo outer
**Ideal path**: 12 — open the block, wait for "Starting", Take control, tap the field, Keys, type, Tab, type, return, Hide keyboard, "I'm done", close.
**Alternate paths**: (a) use Release, "I'm done" in the handoff prompt instead of the Release button; (b) Skip in the handoff prompt when the user cannot log in; (c) laptop pose, key bar and Release on the bottom half; (d) inner display, thread beside the screen so the user can tell the agent what happened.
**Design source**: `PG-A-Computer.dc.html` and `PH-Computer.dc.html` (eight frames each: "Watching" with "Take control"; "In control" ("You are driving", a "Keys" button, "Hide keyboard", a key bar Esc, Tab, Ctrl and arrows, prominent "Release control", no Close); "Agent waiting" ("Finance agent is waiting for you", "Sign in to the bank portal, then tap I'm done.", "I'm done" and "Skip"); "Starting" ("Starting Team computer"); "Control ended" ("Your control ended because the screen was idle."); "Reconnecting" ("Your keys are paused until it is back."); "Control denied" ("Jordan has control right now. Try again when they release it."); "Can't connect" ("Couldn't connect to Team computer", Retry)). `Desk-Computer.dc.html` (laptop pose: "You have control", Keyboard, Fit to screen, Release control and the key bar on the bottom half). PG-A-Rules "Computer".

#### Steps
1. In the thread, a "Needs you" computer block appears from the agent; tap it → Computer screen opens.
2. Screen shows "Starting Team computer" with a spinner → the state advances; poll status about every 2 s.
3. Booted; the desktop appears in the web view → View-only. Prominent "Take control" button is last in the side strip.
4. Tap "Take control" → `computer/takeover` returns a lease (default 15 minutes). The prominent button becomes "Release control" (lock.open), the caption reads "You are driving" and Close disappears. A key bar appears at the bottom. The screen URL is re-read because control changed.
5. Tap the login field on the screen → Pointer input goes to `computer/input`; remote field focuses.
6. Tap "Keys" → iOS keyboard appears with the key bar above it; typed characters go to the remote machine.
7. Type the username → Characters show on the screen.
8. Tap "Tab" on the key bar → Focus moves to the password field.
9. Type the password → Characters show (masking is up to the remote page).
10. Press the iOS keyboard's return key (the key bar has no "Return") → Form submits; the vendor page loads.
11. Type the one-time code, then Return → Portal dashboard shows.
12. Tap "Hide keyboard" → Keyboard hides.
13. When the agent asks for the human (the "Agent waiting" state: "Sign in to the bank portal, then tap I'm done."), the same screen shows "I'm done" and "Skip" in the control slot; tapping "Release control" in a plain session returns control without a handoff.
14. Tap "I'm done" → Lease released with reason `done`; the caption returns to "Finance agent is driving"; the thread resumes and the agent says it is continuing.

#### Variations
- Tap "Skip" at step 14: release reason `skipped`; the agent is told the human did not finish.
- Tap "Fit to screen" at step 3 if the remote desktop is larger than the phone (drawn on both layouts).
- Switch the picker from "Team" to "Private" before taking control (Private is a per-user computer; see Edge Cases).

#### Edge Cases
- Lease expires at 15 minutes (or the screen idles): the key bar goes and the caption returns to "Finance agent is driving" with "Your control ended because the screen was idle." and "Take control" (drawn).
- Cannot connect: "Couldn't connect to Team computer" with "Retry" (drawn).
- "Could not load the desktop." at step 3 (screen URL returns null).
- Another viewer already holds the lease: "Jordan has control right now. Try again when they release it." with "Try again" (drawn).
- Network drops while in control: "Reconnecting / Your keys are paused until it is back." with "Release control" (drawn).
- Expo also has computer recovery flows ("Recover computer", "Reset computer", "Update computer", "Recovering Team Computer", "Updating Team Computer", "Update failed"). The boards define none of these.

#### Design gaps
- The handoff is drawn as a state of the screen ("Agent waiting"); not stated: whether it also appears when the user taps Release outside a handoff, and what the agent is told for "Skip".
- Maintenance actions (Recover, Reset, Update computer, update progress) exist in Expo bot settings and the computer screen but are not in the board set or the Phase 8 plan text.
- Phase 8 plan says "keyboard bridge" but the board's key bar lists only Esc, Tab, Ctrl and arrow keys; "Return" is missing (Expo accessibility names: Escape, Return, Control). The board button is "Keys" and "Hide keyboard", the rule card says "Keyboard".
- No pointer affordances (long press for right click, two-finger scroll, drag) are defined, although the API accepts `pointer` and `scroll` input.
- Clipboard input (`kind: "clipboard"`) has an API but no UI for pasting.
- "Could not load the desktop." (a connected session whose screen URL is null) has no frame; "Couldn't connect" covers only the connection.
- Leaving the Computer screen while holding control has no rule (Close is hidden while in control, but Back and a push tap remain).


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
**Design source**: `PG-A-Home.dc.html` and `PH-Home.dc.html` (an ARTIFACTS section with "See all" and two recent rows, "Pilot plan / Doc" and "Runway model / Sheet"). `PG-A-Artifacts.dc.html` (title "Artifacts", chips "All agents", "Finance agent", "Legal agent", "Chief", "Inbox agent", rows with a type tile, name, agent and date, a "Search artifacts" button) and PG-A-Rules "Artifacts" for the list. `PG-A-Artifact.dc.html` and PG-A-Rules "Artifact" for the preview.

#### Steps
1. On Home, tap "See all" in the ARTIFACTS section (both standard and outer Home draw it; the outer strip also has an Artifacts icon) → the Artifacts list opens with a 28 pt title "Artifacts", chip row starting with "All agents" (active chip is ink), then divided rows.
2. Tap the "Chief" chip → the list filters to Chief's artifacts. A row shows "Board update draft", "Chief", "Yesterday" and a type tile.
3. Tap the "Board update draft" row → the preview opens. The title capsule shows "Loading…" then the name, with "Updated yesterday by Chief". The HTML renders in a sandbox inside a preview card; the floating version pill reads "v2 of 2" with older and newer arrows.
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
- The standard iPhone and the outer Home now both have an ARTIFACTS section with "See all"; the Artifacts list at 393 pt is still not drawn.
- The search is only an icon ("Search artifacts") in the strip; how it expands on a standard iPhone, and the empty and error states of the list ("No artifacts yet", "Could not load artifacts."), are not drawn (the board has one frame).
- Chip overflow (more than about four bots) is not drawn.
- Row sort order and date grouping labels ("Today", "Yesterday", "Oct 17") are shown, but the rule is not stated.
- The chip says "All agents" on the board and "All bots" in the rule card.


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
**Design source**: `PG-A-Artifacts`, `PG-A-Artifact` (strip: Back, More, prominent Share; floating pill "v6 of 6" with "Older version" and "Newer version" arrows) and PG-A-Rules "Artifact". `PG-A-Image.dc.html` draws the Versions list for an image (More, "Versions"; a list "Version 3 / Today" checked, "Version 2 / Oct 17", "Version 1 / Oct 15"); the document equivalent is not drawn.

#### Steps
1. In Artifacts, tap the "Runway summary" row ("Finance agent · Markdown · v5", Today) → Preview opens with "Cash [AMOUNT]  Runway [N] mo", the paragraph "Cash fell in the last 30 days, mostly from two vendor payments.", rows "Northwind" and "Acme Payroll", and the pill "v5 of 5".
2. Tap the "Older version" arrow in the pill (or More, Versions, as on the image viewer) → the preview steps to the previous version (list from `artifacts/listVersions` by `familyId`).
3. Arrive at v4 → the pill reads "v4 of 5". Whether an older version is marked read-only is not drawn.
4. Scan the differences → The user compares by eye; no diff view exists.
5. Tap the "Newer version" arrow → back to the latest.
6. Tap "Share", the prominent button → iOS share sheet opens with the file; user picks Messages.

#### Variations
- Share v4 instead of v5.
- Share an HTML artifact: the share target receives an HTML file, not a rendered image.

#### Edge Cases
- Share fails: Expo alert "Could not share this artifact" with "Try again."
- A new version arrives while the user views v5: pill count and content refresh behavior is not specified.
- Versions menu for a single-version artifact: should the Versions button be disabled or hidden?

#### Design gaps
- The Versions list is drawn for the image viewer only; for documents the pill arrows are drawn and a list is not, so jumping from v6 to v2 takes four taps.
- No diff or "what changed" view; the user has to compare by eye (a possible simplification, not a request).
- Behavior when a newer version arrives while viewing is undefined.
- Where "Share" sits on a standard iPhone: the outer strip draws the prominent Share (and the rule card still lists Versions in the strip); the standard layout of the preview is not drawn.


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
**Design source**: PG-A-Rules "Artifacts" ("Long press a row: delete confirm") and "Artifact" (More, delete). `PG-A-Image.dc.html` draws the delete flow for an image (More, "Delete"; an alert "Delete this image? / It is removed from Artifacts for everyone in the space. This cannot be undone." with Cancel and Delete). The same for a document, and the long-press menu on the list: NO BOARD.

#### Steps
1. Long-press the "Filing calendar" row (or open it and tap More, Delete) → a confirmation appears: the image version reads "Delete this image? / It is removed from Artifacts for everyone in the space. This cannot be undone."; Expo mentions the version count.
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
- The alert is drawn for an image only; its text says "for everyone in the space" but not whether all versions go (the rule card says "confirms version count"), and a document alert is not drawn.
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
**Design source**: `PG-A-Image.dc.html` (five frames: the image on black with a Close button, "Share", "Save to Photos" and "More"; "More menu" with "Versions" and "Delete"; the Versions list; the delete alert; and a toast "Saved to Photos"). Row: PG-A-Artifacts; PG-A-Rules "Image". Photos permission prompt: NO BOARD.

#### Steps
1. In Artifacts, tap "Vendor payments Q3" ("Finance agent · Image · v1", Yesterday) → Full-screen image opens on black; 35% dim under the clear controls; name pill "vendor-payments-q3.png" floats at the bottom.
2. Pinch to zoom → Image zooms (Expo: zoom, share or export).
3. Tap "Save to Photos" in the action group → First time, iOS asks for add-to-Photos permission; allowing saves the image and a toast "Saved to Photos" shows.
4. Tap "Close" → Returns to the Artifacts list at the same scroll position.

#### Variations
- Tap "Share" in the same group for the system sheet.
- Tap More: a menu with "Versions" and "Delete" (drawn).

#### Edge Cases
- "Could not load this image." with Close still available.
- Photos permission denied: no copy defined.
- Rotation of the phone: the rule card says Image "rotates freely".

#### Design gaps
- Success feedback ("Saved to Photos") is drawn; a failure or a denied permission is not.
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
**Design source**: `PG-A-AgentPage.dc.html` (the page with the strip: Back, List, prominent "Open chat"; a second frame "Couldn't load this page" with a Retry button) and PG-A-Rules "Agent page". Chat: PG-A-Thread. Hide amounts toggle: NO BOARD on Agent page (it is on the Finance page).

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
- Error: "Couldn't load this page" with a "Retry" button (drawn; an already loaded page stays).
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
**Design source**: `PG-A-AgentList.dc.html` (title "Close checklist" with "2 of 5 done"; open rows with circles; a "DONE" group with struck rows; a floating "Add item" field; strip: Back, Page, "Agent actions", prominent "Open chat"; and a frame "Couldn't load this list" with Retry) and PG-A-Rules "Agent list". Delete confirmation and swipe affordance: NO BOARD.

#### Steps
1. From the thread, tap "List" (checklist) → Agent list opens with capsule "Close checklist" and checklist rows.
2. Tap the checkbox for "Collect missing receipts" → the row moves to the DONE group, muted and struck through, and the header count rises ("3 of 5 done").
3. Tap the checkbox for "Review vendor payments" → Same.
4. Tap the floating field with placeholder "Add item", type "Send invoice reminders" → The prominent add button at the trailing end of the field becomes active.
5. Tap the add button → The new row appears at the bottom; the field clears. The change saves to the server.

#### Variations
- Delete an item through the Expo alert "Delete" with "Cancel" / "Delete".
- Add several items quickly.

#### Edge Cases
- Empty list: only the field with placeholder "Add item".
- "Couldn't load this list" with a "Retry" button (drawn).
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
**Ideal path**: 3 — tap the Activity item, read the routine, tap "Open last run".
**Alternate paths**: (a) search hit of kind `routine` (Expo `search-destination` routes to `/routine`); (b) push notification for a routine run (push taps are phase 10; routine destination not specified); (c) inner display, the agent's routines list in the third, detail beside it.
**Design source**: `PG-A-Routine.dc.html` (six frames: "Routines" for the Finance agent (three rows: "Weekly runway summary / Every Monday, 8:00 AM · Next Oct 26", "Receipt reminders / Every weekday, 9:00 AM · Paused", "Month-end close / 1st of the month · Last run failed"); "Routine" (status, "Updates Runway summary", "Open last run", PROMPT); "More menu" ("Pause routine", "Edit routine"); "Run history" (dated runs with Done or Failed); "Last run failed" (the failure reason and "Run again"); "Couldn't load this routine" with Retry) and PG-A-Rules "Routine". Entry from Home Activity: `PG-A-Home` ("Weekly runway / Ran at 8:00 AM / Done"); `PG-A-Activity` lists it under TODAY.

#### Steps
1. On Home, tap the Activity item for the routine → the routine detail opens. The capsule shows "Weekly runway summary".
2. Read the status card: "Every Monday at 8:00 AM", "Next run Mon, Oct 26", "Last ran Mon, Oct 19 · Done" → the user confirms the last run time.
3. Read the "PROMPT" card: "Summarize cash, burn and runway for the last 30 days. List vendor payments over [AMOUNT] and any card expenses missing receipts. Update the Runway summary page." → The user checks the instruction.
4. Tap "Open last run" (or the prominent "Open chat" in the strip) → the thread produced by the run opens.

#### Variations
- The user then taps "Page" in that thread to see the updated "Runway summary" page (STORY-073).
- Open the same routine from search.

#### Edge Cases
- Loading: spinner. Errors: "Couldn't load this routine" with Retry (drawn); "This routine no longer exists" and "Routine link is incomplete" are rule-card text only.
- A routine that has never run: the last-run line is undefined.
- A run that failed: the detail shows "Last run failed", the reason ("The bank connection could not be reached.") and "Run again" (drawn); the list row shows "Last run failed" in red.

#### Design gaps
- "Run history" is drawn as a list of dated runs with Done or Failed; what a tap on a run opens (its conversation) and paging are not stated.
- The More menu offers "Pause routine" and "Edit routine"; the edit screen, create and delete are not drawn. Confirm what ships.
- The routines list is drawn (outer display only) but nothing shows how to reach it from the agent thread or page; on a standard iPhone it has no board.
- Copy: the strip button is "Open chat" and the detail link is "Open last run"; the rule card says "Open conversation".


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
**Design source**: PG-A-Computer and `Desk-Computer.dc.html` (laptop pose), PG-A-Artifact, PG-A-AgentPage, PG-A-AgentList, PG-A-Routine, PG-A-Activity, PG-A-Rules (laptop pose for Computer is "the main use of the pose"; Agent page, Agent list and Image are laptop-capable; Routine and Artifacts are not applicable and stay full height). Transitions between a laptop-pose screen and a not-applicable screen are NO BOARD.

#### Steps
1. On Home, tap the Activity item "Needs you" for the Finance agent → thread opens; the approval or handoff card sits above the composer.
2. Tap the computer block → Team Computer opens: screen on the top half; key bar, Release and thread composer on the bottom half.
3. Tap "Take control" → "You have control"; key bar appears.
4. Tap the portal's Download button on the screen → File downloads on the remote machine.
5. The agent signals it needs the human ("Finance agent is waiting for you") → the control slot shows "I'm done" and "Skip".
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
21. Tap "Open last run" → the routine's conversation opens.
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
- The routine detail now has "Open last run", which settles which run; "Run history" lets the user choose another.
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
**Design source**: PG-A-Rules "Artifacts" and "Artifact" (error lines; no frames). Frames with a retry: `PG-A-AgentPage` ("Couldn't load this page"), `PG-A-AgentList` ("Couldn't load this list"), `PG-A-Routine` ("Couldn't load this routine") and `PG-A-Computer`/`PH-Computer` ("Couldn't connect to Team computer" with "Retry").

#### Steps
1. Open Artifacts while offline → "Could not load artifacts." with "Try again."
2. Tap "Try again." after the signal returns → List loads.
3. Open the Finance agent page → "Couldn't load this page" with a "Retry" button (no loaded page to keep).
4. Tap "Retry" → Page loads.
5. Open the computer → "Couldn't connect to Team computer" with "Retry".
6. Tap "Retry" → "Starting Team computer" with a spinner, then the desktop.

#### Variations
- Open a routine offline: "Could not load routine".
- Open an artifact offline: "Could not load this artifact."

#### Edge Cases
- Cached artifact lists exist in Expo (integrations and artifact caches are listed in the app map); whether stale rows show with the error is not specified.
- Server older than the app: a 404 on a newer procedure means "not supported"; no copy for it on these screens.

#### Design gaps
- No offline banner on these screens; Home ("Updated 5 min ago") and the thread ("Offline", "Reconnecting") have stale-data markers, these pages do not. The Artifacts list and the artifact preview have no error frame.
- "Not supported by this server" copy is not defined for any of these screens.
- "Could not load the desktop." (screen URL null) has no frame; the connection failure is drawn.
- Copy: the boards write "Couldn't", the rule cards write "Could not".


### STORY-120: Find a failed routine, read why it failed, and run it again
**Type**: medium
**Topic**: Team Computer, artifacts, agent pages and routines
**Source**: ux-paths round 2 (board `PG-A-Routine`)
**Phase issue**: #420 (P8)
**Persona**: Imogen Tait, founder whose month-end routine did not produce its report
**Goal**: See which routine failed and why, run it again, and check the earlier runs.
**Preconditions**: The Finance agent has three routines: "Weekly runway summary", "Receipt reminders" (paused) and "Month-end close" (last run failed).
**Device**: iPhone Duo outer
**Ideal path**: 4 — open the routines list, tap the failed routine, read the reason, tap "Run again".
**Alternate paths**: (a) Come from Home Activity (STORY-075). (b) Open "Run history" to see how often it failed. (c) Pause the routine instead.
**Design source**: `PG-A-Routine.dc.html` (frames "Routines": three rows with the schedule and "Next Oct 26", "Paused" and a red "Last run failed"; "Routine": status, "Updates Runway summary", "Open last run", PROMPT; "More menu": "Pause routine", "Edit routine"; "Run history": dated runs, Done or Failed; "Last run failed": "Mon, Oct 19, 8:00 AM. The bank connection could not be reached." with "Run again"; "Couldn't load this routine" with Retry). How the list is reached from an agent: NO BOARD.

#### Steps
1. Open the Finance agent's routines list (the entry is not drawn) → three rows: "Weekly runway summary / Every Monday, 8:00 AM · Next Oct 26", "Receipt reminders / Every weekday, 9:00 AM · Paused" and "Month-end close / 1st of the month" with a red "Last run failed".
2. Tap "Month-end close" → the detail shows "Last run failed", the date and the reason ("The bank connection could not be reached."), "Next run", "Updates", "Open last run" and "Run again".
3. Tap "Run again" → a new run starts (no feedback is drawn).
4. Tap "Open last run" → the conversation of that run opens (STORY-075).
5. Back, then More → "Pause routine" and "Edit routine" are offered.
6. Tap Back to the list and open "Run history" from the routine detail → dated runs with Done or Failed.

#### Variations
- Tap "Pause routine": the row would show "Paused" (the result is not drawn).
- Tap "Edit routine": the editor is not drawn.
- The routine detail fails to load: "Couldn't load this routine" with Retry.

#### Edge Cases
- "Run again" while a run is in progress: not stated.
- A run that fails for a reason the user cannot fix (the bank connection): the detail offers no link to the connection.
- Offline: the list and detail are not drawn offline.

#### Design gaps
- How the routines list is reached from an agent thread, page or Home is not drawn; on a standard iPhone the list has no board at all.
- "Run again" has no pending, success or failure state, and does not say whether it uses the same prompt or the current one.
- The sample data disagrees between frames: the list marks "Month-end close" as failed, the "Last run failed" detail is titled "Weekly runway summary" with a failure on Oct 19, while "Run history" for that routine shows Oct 19 as Done and Oct 5 as Failed.
- "Edit routine" has no screen; create and delete are absent.
- The strip button is "Open chat" and the detail link is "Open last run".


### STORY-122: Recover when control of the Team Computer ends, is denied or drops
**Type**: medium
**Topic**: Team Computer, artifacts, agent pages and routines
**Source**: ux-paths round 2 (boards `PH-Computer`, `PG-A-Computer`)
**Phase issue**: #420 (P8)
**Persona**: Marlon Pike, operator who takes over the agent's browser to finish a bank login
**Goal**: Get control back, or understand why he cannot, when the session idles, a colleague holds control, or the connection drops.
**Preconditions**: The Finance agent has a running Team Computer; Marlon opened it on a standard iPhone.
**Device**: standard iPhone
**Ideal path**: 2 — read the banner, tap "Take control" or "Try again".
**Alternate paths**: (a) Switch the picker from "Team" to "Private", which has one driver (STORY-068). (b) Close the computer and wait. (c) Ask the colleague in chat to release control.
**Design source**: `PH-Computer.dc.html` and `PG-A-Computer.dc.html` frames "Control ended" ("Your control ended because the screen was idle." with "Take control"), "Control denied" ("Jordan has control right now. Try again when they release it." with "Try again"), "Reconnecting" ("Your keys are paused until it is back." with "Release control"), "Can't connect" ("Couldn't connect to Team computer" with "Retry") and "Starting" ("Starting Team computer").

#### Steps
1. While driving, leave the screen untouched for a while → the key bar goes, the caption returns to "Finance agent is driving" and a line reads "Your control ended because the screen was idle." with "Take control".
2. Tap "Take control" → a colleague is already driving: the caption reads "Jordan is driving" and a line says "Jordan has control right now. Try again when they release it." with "Try again".
3. Tap "Try again" after Jordan releases → control is granted; the caption reads "You are driving" and the key bar returns.
4. The phone loses signal → the screen shows "Reconnecting" and "Your keys are paused until it is back." with "Release control".
5. Signal returns → the screen resumes and the keys work; or tap "Release control" to hand control back to the agent.
6. Close the computer and reopen it with no signal → "Couldn't connect to Team computer" with "Retry"; tap "Retry" → "Starting Team computer", then the desktop.

#### Variations
- The Private scope: nobody else can hold control, so step 2 cannot occur.
- The screen goes idle during a handoff ("Finance agent is waiting for you"): the handoff stays pending (not drawn).

#### Edge Cases
- Text typed during the idle expiry: whether it reached the remote screen is not shown.
- Another viewer takes control the moment Marlon's lease expires: "Control denied" shows without the idle line.
- Backgrounding the app while in control: the lease and heartbeat behavior are not specified (STORY-067).

#### Design gaps
- The idle timeout length and a warning before control ends are not drawn; the line appears only after control is lost.
- "Release control" in "Reconnecting" does not say what happens to a half-typed entry or to the agent's handoff.
- "Try again" in "Control denied" has no waiting state, and there is no way to ask Jordan to release or to see how long he has held control.
- The drawn frames name the other driver but do not say that a colleague, not the agent, holds it.
- The `Desk-Computer` laptop board draws only the in-control state, so none of these states exist in laptop pose.



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
**Design source**: Steps 1-2: Home PAGES section, row "Finance / 6 mo runway" (`PH-Home.dc.html`, `PG-A-Home.dc.html`). Steps 3-5 `PG-B-Finance.dc.html` (frames: 30 days, 90 days, 12 months, "Amounts hidden", "Nothing upcoming"; strip: Back, Hide amounts, prominent "Ask Finance agent"), `PG-B-Rules.dc.html` Finance card. Step 6 `PG-A-Thread.dc.html`, `Desk.dc.html` (reply wording "Why did spend jump last month?").

#### Steps
1. From Home, tap "Finance" under PAGES (the row shows "6 mo runway") → Finance page pushes with a Back chevron. Skeleton KPIs show while `finance.overview` loads (not drawn).
2. Wait for load → "Runway [N] mo", "Cash [AMOUNT]", "Monthly burn", then "Accounts" with "Operating" (Mercury agent) and "Cards" (Brex agent), and "Upcoming" with "Northwind invoice, Due Oct 24" and "Acme Payroll, Oct 31".
3. Tap "90 days" in the period tabs (30 days, 90 days, 12 months) → burn chart and burn figure change to the 90-day range.
4. Read the burn bars; tap the highlighted bar → selection announces "Sep, [AMOUNT]" to VoiceOver and highlights the bar (DS-07 Spend bar chart).
5. Tap "Ask Finance agent" (prominent bubble in the strip or top bar) → Finance agent thread opens with a composer, labeled "Message Finance agent" on the laptop board.
6. Type "Why did spend jump last month?" and send → run starts; reply streams in as text plus an optional finance card ("Two annual renewals landed in the same month...").

#### Variations
- Tap "12 months" and compare Runway to the 30 day figure; runway uses current burn so it may not change with the tab (not specified).
- Same data in chat: the Finance agent can post a `finance` card (overview, breakdown, transactions). The native card must show the same numbers as the page and honor Hide amounts (see STORY-079).
- Refresh: the DS-03 collapse order lists a Finance "Refresh" button, but `PG-B-Finance` draws none (the strip has Back, Hide amounts and Ask Finance agent), and pull to refresh is not drawn.
- Light mode (not drawn; boards are dark only).

#### Edge Cases
- User has no connected model: send fails with "Connect a model to start a run".
- AI consent not granted: send fails with "Review AI data sharing in Account settings before continuing."; client should prompt first.
- Offline: saved snapshot behavior for Finance is not specified; chat message is queued in the outbox.
- Runway is null (no burn data): board shows `[N] mo` only; a null state is not drawn. `finance.runway` can return no figure.
- Non-USD transactions are left out of totals; no indicator is drawn.

#### Design gaps
- Runway/Cash/Burn when value is unavailable (null runway).
- Refresh has no drawn control or progress state.
- Tapping an account row, an Upcoming row, or a burn bar for detail: no screen (account detail, transaction detail have API `finance.account`, `finance.transaction` but no board); the rows show a chevron that goes nowhere.
- The inner book now follows the page ("the one inner sidebar with Finance selected, the page in 2/3"); the earlier "Overview, Accounts, Burn, Spend" list is gone from the rule card.


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
**Alternate paths**: Turn on "Hide amounts" in Settings, Account (a switch; `PG-B-Account`) before opening Finance. Reveal by tapping the same button or switch.
**Design source**: `PG-B-Finance.dc.html` (frame "Amounts hidden": every figure reads "••••"; the strip button changes to "Show amounts"), `PG-B-Account.dc.html` (a "Hide amounts" switch), `DS-07-Domain.dc.html` "Hidden amounts" specimen. Chat card masking: NO BOARD.

#### Steps
1. On Finance, tap the "Hide amounts" button in the strip → every amount becomes "••••" and the label reads "Show amounts"; layout does not shift.
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
- Whether Hide amounts also masks agent-written text, push notification text, the Home previews ("Balance as of this morning: $1,200") and the ACTIVITY row ("Approve $1,200 payment"), which show amounts on the boards with no masked frame, and Live Activities.
- The setting has two homes, the Finance strip button and the Account switch (drawn); the two need to stay in step.
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
**Design source**: Entry: Home PAGES row "Legal / 2 deadlines" (`PH-Home`, `PG-A-Home`). `PG-B-Legal.dc.html` (five frames: the default Contracts list; one contract row "Vendor master agreement / Scan could not read this PDF / Blocked"; "Not scanned yet / Find deadlines in contracts" with "Scan now"; "Scanning / N of N files" with the scan button dimmed; "Scan failed / Could not reach your files" with "Try again"), `PG-B-Rules.dc.html` Legal card, `DS-07-Domain.dc.html` Deadline row and Document card. Result toast: NO BOARD.

#### Steps
1. Tap "Legal" under PAGES (the row reads "2 deadlines") → Back chevron, "Scan now" in the strip, "Ask Legal agent"; segmented "Contracts" and "Deadlines". The default frame draws no "Last scan" summary line.
2. Tap the scan icon in the strip ("Scan now") → `legal.scanNow` starts a run; the page shows "Scanning / N of N files" and the scan button dims.
3. Read the contract rows → "Northwind services agreement, Ends Dec 31, Signed"; "Design partner NDA, Sent to Jordan Lee, Awaiting"; "Office lease renewal, Expired Sep 30, Expired"; "Acme Payroll terms, Updated Oct 12".
4. Tap "Deadlines" → deadline rows with a calendar tile, status chip with clock icon and words: "Due in 3 days" (warning), "Overdue" (destructive), "On track".
5. Tap "File annual report" → deadline edit/detail (`legal.updateDeadline` exists). Screen NO BOARD.

#### Variations
- Tap a contract row → contract detail (parties, dates, deadlines). Drawn only for the inner display (2/3 pane); no outer-display push page.
- Use `legal.itemLinks` to open the source Data room file from a contract; no link control drawn.
- After a successful scan, the "Last scan" line updates and unreviewed documents may remain (`unreviewedDocuments`); the count is not displayed on any board.

#### Edge Cases
- Never scanned: "Not scanned yet / Find deadlines in contracts" with "Scan now" (drawn).
- Scan failed: a row "Scan failed / Could not reach your files" with "Try again", and the previous results stay (drawn).
- No OpenRouter key: "Add your OpenRouter key" opens Models (see STORY-081).
- Legal consent missing: `legal.consent` / `consentGrant` prompt; screen NO BOARD.
- Scan already running when the user taps again: the button is dimmed (drawn).
- Daily scan routine off (`dailyScanActive` false): no indicator drawn.

#### Design gaps
- Scan completed and cancelled states, and a result toast, are not drawn (running and failed are).
- Contract detail and deadline edit on the outer display.
- Legal consent prompt.
- Status text colors for Signed, Awaiting, Expired: only text is drawn, mapping to chips (DS-07) is not stated for contract rows.
- One contract row can be "Blocked" ("Scan could not read this PDF"); whether tapping it explains or retries is not drawn.


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
- The `PG-B-Legal` frame named "Blocker row" is a different blocker (one unreadable PDF); the no-OpenRouter-key blocker is still only rule-card text.


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
**Design source**: `PG-B-CapTable.dc.html` (six frames: the connected page with "Ownership chart", Shares, Holders and an "Add contact" row; "Carta access expired / Showing the last sync" with "Reconnect"; "Carta is not connected" with "Reconnect"; "Syncing with Carta" with placeholders; the "Add contact" sheet (Cancel, "Save", Name, Email, Holder); the holder detail (Shares, Ownership, Vested, Contact email)), `PG-B-Rules.dc.html` Cap table card, `DS-07-Domain.dc.html` Ownership summary and Holder row, `PG-B-Integrations.dc.html` (connect pending), `DS-07-Domain.dc.html` AppConnectCard.

#### Steps
1. Tap "Cap table" under PAGES on Home (no badge) → not-connected state: "Carta is not connected" with a "Reconnect" button (the rule card says "See who owns your company with Connect Carta").
2. Tap "Reconnect" → app opens `authorizationUrl` in Safari (`ASWebAuthenticationSession`).
3. Sign in to Carta and approve in Safari → returns to the app.
4. App shows "Connect pending: alert to finish in browser, then refresh." until `connections.complete` polling (every 2 s) succeeds.
5. Page loads, with "Syncing with Carta" and placeholders while `syncing` is true, then the ownership chart.
6. Read the ownership ring: "Shares [N]", "Founders [N]%", "Option pool", "Seed investors", "Advisors", with a legend. Ring uses monochrome segments, not bot colors.
7. Scroll to "Holders" → holder rows with initials avatar, name, class and share count, percent right-aligned.
8. Tap a holder, for example "Ana Ruiz, Founder" → holder detail (Shares, Ownership, Vested, Contact email) pushes.
9. Go back and tap "Add contact" at the end of the Holders list → the "Add contact" sheet opens (Cancel, "Save", Name, Email, Holder).
10. Enter the name and email and pick a Holder from the list ("Sam Ortiz · Seed investor" is drawn) → fields.
11. Save → `contacts.save`; the contact appears (location of contacts list is not drawn).
12. Tap the refresh icon → `carta.refresh`; syncing indicator, then updated figures.
13. Tap "Ask Carta agent" → Carta agent thread opens.
14. Send "How big is the option pool if we add 2% for hires?" → agent replies; writes (draft changes) wait for approval, and writes are off by default.

#### Variations
- Safari returns an error or the user cancels: connect state stays "See who owns your company".
- Connect from the Carta agent thread's AppConnectCard instead (alternate b).
- On the inner display: holder list 1/3 and holder detail 2/3, with the ring above on a laptop pose (ring top half; holders bottom half).

#### Edge Cases
- Token expired: "Carta access expired / Showing the last sync" with "Reconnect" above the last data (drawn).
- Load error: "Try again".
- Safari returns but polling never completes (user abandoned): keep showing pending with a way to retry; timeout not specified.
- Percent rounding: ring legend shows Founders, Option pool, Seed investors and Advisors; DS-07 specimen shows Founders, Investors, Pool, Other, a label mismatch between board and specimen.
- MCP OAuth is web-only; Carta is a direct integration, so this should be fine, but the plan does not say which.

#### Design gaps
- Not drawn: the error state ("Try again") and the "Connect pending" alert on this page; not-connected, expired and syncing are drawn.
- The contact list and where saved contacts appear are not drawn (the form and the holder detail are).
- Label mismatch: page board uses "Founders / Option pool / Seed investors / Advisors"; DS-07 uses "Founders / Investors / Pool / Other".
- Plan phase 12 does not mention the Safari return-and-poll step for Carta explicitly.
- The "Add contact" form has a Holder field, so a contact links to a holder; what an unlinked contact does is not stated.
- The "Add contact" entry sits as a row after the Holders; the strip no longer carries the plus (the rule card still lists "plus: add contact, refresh").


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
**Design source**: `PG-B-DataRoom.dc.html` (eight frames: the default list with "Recently added", folders and a "Load more" row; "Uploading" (a row "Q3 board deck.pdf / 60%" with a cancel button); "Upload failed" ("Try again"); "Search results" ("2 results" with each file's folder); "Empty room" ("No files yet" with "Add files"); "Open file" ("Pitch deck v3.pdf / PDF · Oct 9" with "Ask about this file"); and the Data room agent's composer with the attach sources Photos, Files, Data room), `PG-B-Rules.dc.html` Data room card, `DS-07-Domain.dc.html` Folder and file rows, Upload progress. File preview: NO BOARD.

#### Steps
1. Tap "Data room" under PAGES on Home (no badge) → search field, "Recently added" rows ("Board materials", "Cap table export.csv, CSV · Ana Ruiz", "Northwind agreement.pdf", "Diligence", "Pitch deck v3.pdf") and a "Load more" row.
2. Tap the plus (add files) in the top bar → system file picker opens.
3. Choose "Term sheet.pdf" → picker closes; an "Uploading" section shows the file name, percent ("60%") and a cancel button.
4. Wait for completion → row becomes a normal file row; upload response is 201 (new). Item processing continues asynchronously.
5. Type "term sheet" in the search field → "N results" rows, each with the file name and its folder.
6. Tap the result → a file page ("Pitch deck v3.pdf / PDF · Oct 9") with "Ask about this file"; no content preview is drawn (README lists `GET …/content` and `…/thumbnail`).

#### Variations
- Upload a ZIP: response 202 with `importId`; the zip is unpacked in the background. The outcome is not drawn.
- Upload the same file again: 200 with `duplicate`; no duplicate message is drawn.
- Upload multiple files at once from the picker.
- Tap "Load more" to page (cursor-based).
- Filter (funnel icon) by facet; "No results" with "Clear filters" if empty.

#### Edge Cases
- Upload fails: the row reads "Upload failed" with "Try again" (drawn).
- User taps cancel (x) mid-upload.
- Large file on cellular: no size limit; streamed body; no warning drawn.
- App is backgrounded during upload: background URLSession behavior not specified.
- Empty room: "No files yet" with "Add files" (drawn).
- Consent missing: `dataRoom.consent` / `consentGrant`, no screen.

#### Design gaps
- Folder navigation (tapping "Board materials"), the file preview, rename, move, delete, retry processing (`dataRoom.itemRetry`), and processing status for newly uploaded items (`dataRoom.processing`) are not drawn; a file page and "Ask about this file" are.
- Duplicate and zip-import outcomes.
- The search loading state is not drawn (the result list is).
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
**Ideal path**: 4 — open Data room, find and tap the file, "Ask about this file", send.
**Alternate paths**: (a) Open the Legal agent thread and attach a Data room item (`threads/send` accepts `dataRoomItemIds`; no picker is drawn). (b) From Legal, tap a contract and "Ask Legal agent" with the contract's Data room link. (c) Ask in Data room agent chat to forward the file.
**Design source**: `PG-B-DataRoom.dc.html` (frame "Open file": "Pitch deck v3.pdf / PDF · Oct 9" with a button "Ask about this file"; frame "Thread composer: attachment sources": the Data room agent's composer with Photos, Files and Data room), `PG-B-Rules.dc.html` Data room card.

#### Steps
1. Open Data room and search "lease" → a matching file row; tap it → the file page with "Ask about this file".
2. Tap "Ask about this file" → the Data room agent thread opens with the file attached (the result is not drawn).
3. Type "Ask the Legal agent to check the renewal terms" and send → message goes out with `dataRoomItemIds`; the agent hands off.
4. Message caption lists the file by name (as the Expo app already does through `splitDataRoomReferences`).

#### Variations
- Tap the file name in the caption: in Expo nothing opens; native should open the Data room item, not designed.

#### Edge Cases
- File still processing: whether the item can be referenced is not specified.
- User lacks access to another owner's item: chips never show other owners' items.

#### Design gaps
- The "Data room" attach source is drawn in the Data room agent's composer only; whether it appears in other threads (the Legal agent, STORY-034) is not stated, and the picker screen behind it is not drawn.
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
**Design source**: `PG-B-Rules.dc.html` rule cards for the four pages (Inner book, Half-folded, Laptop pose), `Inner.dc.html`, `Split.dc.html` (the inner sidebar with a PAGES list), `Desk.dc.html` (Finance laptop desk pose), `PG-B-*.dc.html`. The Legal, Cap table and Data room cards say "No board on purpose" for the laptop pose and describe a muted line "Select a contract, holder, or file." with nothing selected.

#### Steps
1. On the outer display (466x678 pt), tap Finance under PAGES on Home → single column with period tabs, KPIs, burn chart, Accounts, Upcoming.
2. Tap the eye to hide amounts → masked.
3. Unfold to the inner display held as a book (890x626 pt) → page becomes 1/3 + 2/3: the left third is the one inner sidebar (Personal, Activity, PAGES with Finance selected, PERSONNEL), the right two thirds show the page (period tabs, tiles, chart, then Accounts and Upcoming by scrolling).
4. Scroll the page to the burn chart → Hide amounts is still on.
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
- The inner book shows the page itself, so the "Spend" versus "Upcoming" naming no longer arises.

#### Design gaps
- Only Finance has a laptop board; for Legal, Cap table and Data room that is now deliberate (the rule cards say "No board on purpose" and define the muted selection line), so the question is whether the laptop pose for them should ship in phase 12.
- Selection and scroll preservation across posture changes.
- Where Ask [page] agent lives in the inner and laptop layouts (outer: prominent bubble in the top bar).
- The inner sidebar (`Split`, DS-03) now draws a PAGES list, so the inner route to the four pages exists; its row set and glance values are the same open decision as on Home (STORY-086).


### STORY-086: Sidebar glance and badges lead to the right page
**Type**: short
**Topic**: Finance, Legal, Cap table and Data room
**Source**: topics/finance-legal.md STORY-009
**Phase issue**: #424 (P12), #415 (P3)
**Persona**: Colm Brady, founder who checks the app a few times a day
**Goal**: Notice from Home that a legal deadline is near and runway has changed, then open the page.
**Preconditions**: `notifications.glance` returns `financeRunwayMonths`, `legalDueSoon` (2), `dataRoomWaiting`.
**Device**: standard iPhone
**Ideal path**: 2 — open Home, read the "2" beside Legal, tap the row.
**Alternate paths**: (a) Tap the "Legal agent" row (in ACTIVITY or the Personnel list when pinned) to land in the chat instead. (b) Tap the push notification. (c) On the inner display, open Legal from the PAGES row in the one inner sidebar (drawn in `Split`).
**Design source**: `PG-A-Home.dc.html`, `PH-Home.dc.html` and the inner sidebar in `Split.dc.html` and DS-03 (PAGES: "Inbox / 3 need reply", "Finance / 6 mo runway", "Legal / 2 deadlines", "Cap table", "Data room", "Team computer / Online"; Personnel rows), `PG-B-Rules.dc.html` (Presentation). A Data room "waiting" count: NO BOARD.

#### Steps
1. Open the app to Home → Personnel lists Chief, Inbox agent, Carta agent and Mercury agent; the Finance and Legal agents are reached through PAGES and ACTIVITY.
2. Read the PAGES rows → "Inbox" shows "3 need reply", "Finance" shows "6 mo runway", "Legal" shows "2 deadlines", "Team computer" shows "Online"; "Cap table" and "Data room" show no value (the `dataRoomWaiting` count is not drawn).
3. Tap the "Legal" row under PAGES → the Legal page opens (the "Legal agent" Personnel row opens the chat instead).

#### Variations
- Data room "waiting" count after an upload (`dataRoomWaiting`) points at items still processing.

#### Edge Cases
- `glance` values null: nothing shown.
- Two entries for one concept: the default Personnel list no longer repeats Finance and Legal, but "Finance agent" still appears in ACTIVITY and in the pinned and group frames.

#### Design gaps
- DECISION: whether the PAGES rows are always visible or added by the user (`sidebarPages` add/remove exists, only the "team-health" template is defined and it is `available: false`); the boards draw four fixed rows and no Data room or Cap table glance value.
- The page and the agent are different destinations for one capability (a page row for the dashboard, an agent row or Activity row for the chat); the boards do not say which a push for that agent opens.



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
**Ideal path**: 4 — tap the "AB" avatar on Home, read the values on the list, tap "Done" (the X).
**Alternate paths**: Deep link from the Legal page "Add your OpenRouter key", which opens Models directly (not Settings root).
**Design source**: `PG-B-Settings.dc.html` (root frame: one profile row "Sam Rivera / Account", then Models ("Model A"), Voice ("Device"), Integrations ("2"), AI data sharing, Archived bots; an X (Close) in the strip; further frames for Archived bots and AI data sharing), rule card "Settings" (which still lists a "Change password" row). Entry: the round "AB" avatar at the top left of `PH-Home.dc.html` and `PG-A-Home.dc.html`.

#### Steps
1. Tap the "AB" avatar at the top left of Home → Settings opens as a sheet with large title "Settings", the profile row "Sam Rivera" (subtitle "Account"), then "Models", "Voice", "Integrations", "AI data sharing" and "Archived bots".
2. Read the row values → Models shows the default model name ("Model A"), Voice shows "Device", Integrations shows "2". Rows show no value until it loads, then the value appears without moving the row.
3. Tap "Done" (the X in the strip) → the sheet closes and Home is visible again.

#### Variations
- Inner display (890x626 pt): the settings list sits in the 1/3 column with the selected row filled, the detail fills the 2/3 column. Half-folded: list left, detail right, each scrolls alone. Outer display: "Done" is in the left strip group.
- Laptop pose: not applicable, stays one full-height column.

#### Edge Cases
- Values slow to load: rows render with no value first (rule card says so).
- Older self-hosted server returns 404 on a newer procedure: the value stays empty. No board shows how the row should look.
- Signed-out session ends while the sheet is open (401): the app returns to Sign in; the sheet is dismissed.

#### Design gaps
- Expo `account.tsx` also holds Language, Appearance, Avatar style, Hide amounts, Notifications, Phone notifications, Usage and Live update settings. `PG-B-Account` now draws Hide amounts, Language and Appearance; Avatar style, Notifications, Phone notifications, Usage and Live update still have no home on the iOS boards.
- The "Integrations" count value ("2") is drawn; what it counts (connected apps or accounts) is not stated.
- Sample data disagrees: the Home avatar reads "AB" while Settings and Account show "SR / Sam Rivera" for the same signed-in user.
- The Settings rule card still lists "Change password" as a root row; the board has moved it to Account.


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
**Design source**: `PG-B-Models.dc.html` (frames: the page with "Default model" (Model, Thinking) and "Providers" (Hosted provider "Connected", Local server with its URL, Subscription sign-in "Not connected", "Add server"); "Model menu" (Model A checked, Model B, Model C); "After choosing Model B" with a green "Now using Model B."; "Thinking menu" ("Default (Medium)", Low, Medium, High)).

#### Steps
1. Open Settings and tap "Models" → Models pushes inside the sheet with sections "Default model", "Providers", "Add a server".
2. Tap the "Model" row under "Default model" → a menu lists models of connected providers (Model A, Model B, Model C) with a check on "Model A".
3. Choose a different model ("Model B") → green line "Now using Model B." appears under the section (Expo text: "Model updated." / "Now using {label}."); the row value changes.
4. Tap the "Thinking" row, currently "Default (Medium)" → a menu lists "Default (Medium)", Low, Medium and High (Expo: Minimal, Low, Medium, High, Extra high, Max, filtered per model).
5. Choose "Low" → the row shows "Low"; no save button is needed, each change is saved at once.
6. Tap Back (chevron.left) → Settings list shows the new Models value "Model B".

#### Variations
- Choose a model that has no thinking support: the "Thinking" row is hidden or disabled (Expo clamps the level to the model's allowed levels). No board shows this.
- Inner display: Models renders in the 2/3 column while the list stays in the 1/3 column; the back button is not needed.

#### Edge Cases
- Save fails (offline or server error): Expo shows "Could not change the default model"; the Models board draws the success line and none for failure.
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
**Ideal path**: 4 — on the Home card: Connect a model, paste the key, Connect (Hosted provider is preselected). Through Settings it is 8: Settings, Models, tap provider, enter key, Connect, check default.
**Alternate paths**: From Home, tap "Connect a model" (STORY-111). Subscription sign-in ("Subscription sign-in", Safari round trip with a code); OpenRouter OAuth (`models.beginOpenRouterOAuth`); a thread's blocker message "Connect a model to start a run" taking her straight to Models (no board); Legal page "Add your OpenRouter key" taking her to Models.
**Design source**: `PG-B-Models.dc.html` (Providers rows "Hosted provider" Connected, "Local server", "Subscription sign-in" Not connected; a Hosted provider detail with Status, "Models 3", "API key / Paste a replacement key" and "Disconnect"; a Subscription sign-in page with Status and a "Sign in" button). The first-run form for one provider is drawn in the "Connect a model" sheet of `PG-A-HomeNoModel.dc.html` (API key, masked key field, "Connect", "Key not accepted."). The not-connected form inside Models: NO BOARD.

#### Steps
1. Tap "Models" in Settings → Providers shows "Hosted provider", "Local server", "Subscription sign-in", each with a status ("Connected" or "Not connected"). Default model section has nothing to pick.
2. Tap "Hosted provider" → a provider detail appears: for a connected provider "Status Connected", "Models 3", "Paste a replacement key" and "Disconnect" (drawn); the form for a provider that is not connected yet is not drawn (Expo labels: "API key", "Connect API key", placeholder "sk-…").
3. Paste the key → the key is shown masked with a show/hide control.
4. Tap "Connect API key" → spinner, then "Connected and using Model A." (Expo text "Connected and using {label}.") and the row status becomes "Connected".
5. Go back to Models → "Model" row now shows "Model A" and "Thinking" shows "Default (Medium)".
6. Tap "Done" → Home loads; the thread blocker no longer appears.

#### Variations
- Wrong key: the Home sheet draws "Key not accepted." under an outlined field (Expo: "Could not connect this provider"); the Models page draws none.
- Provider can use the server's own credentials: Expo text "Uses this server's own {source} credentials to access {provider}." and an optional "Use your own key" action.

#### Edge Cases
- App backgrounded while pasting from a password manager: the field must keep text (not stated).
- Key must never be logged or stored on the device beyond the request; the API stores it server side (`models.connect`).
- Disconnecting later: Expo alert "Disconnect {name}?" with "This removes the connection from every space." and actions Cancel/Disconnect. No board.

#### Design gaps
- The provider detail is drawn for a connected provider (replace key, Disconnect); not drawn: the not-connected form, show/hide for the key, "Use your own key" and the Disconnect confirmation.
- The Subscription sign-in page is drawn with Status and "Sign in" only; the code steps ("Finish signing in in your browser:", code copy, "Paste its URL or code here", "Waiting for sign-in — the code expires in about {minutes} minutes.") are not.
- The board shows three provider rows only; Expo has a featured list, "Show more" and "All providers" (many providers). The native provider list for more than three providers is undefined.
- Two connect surfaces exist for one job: the Home sheet (three providers plus key) and the Models page (providers, Default model, Add a server); how they relate (same screen, or a trimmed copy) is not stated.


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
**Design source**: `PG-B-Models.dc.html` (frames "Add server" (fields "Server URL" and "API key (optional)", a "Find models" row, "Save server") and "Add server, after Find" ("Found 3 models." with a list Model D, Model E, Model F, then "Save server"); rule card: "Finding models: row shows spinner", "No matching models", a red unreachable line, a green "Now using Model A"). Fields beyond URL and key: NO BOARD.

#### Steps
1. In Models tap "Add server" → fields appear for "Server URL" (Expo label "OpenAI-compatible server URL", placeholder `http://127.0.0.1:8000/v1`) and "API key (optional)", and a "Find models" row.
2. Type the URL → the row "Find models" becomes enabled.
3. Tap "Find models" → the row shows a spinner ("Finding…").
4. Result arrives → "Found 3 models." with a list (Model D, Model E, Model F).
5. Pick a model → it is selected as the connection's model.
6. Tap "Save server" → "Connected and using Model D." and "Local server" shows the URL under it.
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
- NO BOARD for the advanced limits fields or the manual model name state; the list of found models is drawn.
- "Add a server" vs. the existing row "Local server" with a URL: when one is saved, whether "Add a server" is still shown and how a second server is added is not drawn.
- Local network permission prompt and the loopback caveat are undocumented.
- The Home "Connect a model" sheet (`PG-A-HomeNoModel`) offers "Local server" as a provider but draws no URL form for it, so the first-run path to a local model ends at the same undrawn form.


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
**Design source**: `PG-B-Voice.dc.html` (frames: "Speak with" with "This device / Free, works offline / In use" and "Hosted voice / Speak + transcribe"; a hosted-voice connection row; "Hear sample"; "Sounds" with "Call sounds" and "Waiting sound"; further frames: hosted in use, hosted not set up ("Set up"), hosted not connected ("Reconnect"), device unavailable ("Not available on this iPhone"), "Microphone access is off" with "Open Settings", and the hosted connection detail).

#### Steps
1. Tap "Voice" in Settings → Voice page with "Speak with" (This device, Hosted voice), a connection row and "Sounds"; the prominent "Hear sample" (play) button.
2. Choose "This device" under "Speak with" → the row reads "In use" with "Free, works offline" (Expo text: "Your phone's built-in voice. Free, no account needed").
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
- The microphone-denied state is drawn ("Microphone access is off" with "Open Settings"); the permission request prompt itself and the speech-recognition permission have no frame.
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
**Design source**: `PG-B-Voice.dc.html` ("Hosted voice / Not set up" with a "Set up" row; "Not connected" with "Reconnect"; and the connection detail: Status "Connected", "Speech model / Optional", "API key / Paste a replacement key", "Disconnect"). Voice picker and the key form for first setup: NO BOARD.

#### Steps
1. Open Settings > Voice → "Hosted voice" shows "Not set up" with a "Set up" row; tap it → a connection page (the form for a first connection is not drawn; the connected page is).
2. Paste the key and connect → the page shows "Status Connected", "Speech model Optional", "API key / Paste a replacement key" and "Disconnect"; on Voice the row reads "Hosted voice / Speak + transcribe".
3. Tap "Speech model" (value "Optional") → a picker of models (not drawn); choose one → value updates (Expo error "Could not save that speech model").
4. Choose a voice for replies (Expo has a voice list from `voice.voices`) → saved at once.
5. Tap "Hear a sample" → the chosen voice speaks. If AI data consent for voice is missing, the call fails with "Review AI data sharing in Account settings before continuing." (see STORY-094).
6. Choose "Hosted voice" under "Speak with" → replies use the hosted voice.

#### Variations
- Replace key: Expo shows "Replace key" and "Paste a replacement key".
- Disconnect: "Disconnect" on the connection page (drawn) with "Disconnecting…"; then the row returns to "Set up".
- Providers that only speak ("Speak only") vs. speak and transcribe ("Speak + transcribe"): the second also handles dictation fallback upload.

#### Edge Cases
- Wrong key: Expo "Could not connect".
- Pressing "Hear a sample" with nothing connected and the device voice off: Expo says "Connect a voice provider first." (not on the board).
- Load failure: Expo "Could not load voice settings".

#### Design gaps
- NO BOARD for the voice picker, the voice-list state, or the speech model picker contents.
- The Speech consent sheet is now drawn (`PG-B-Consent`: "Share recordings with Speech A?") but its trigger before the first hosted voice use (the sample button simply errors on older servers) and its wording for generated speech are not designed.
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
**Design source**: `PG-B-Integrations.dc.html` (frames: the catalog (search field; "Connected": Mail connector, Calendar connector; "Available": Documents, Banking and Tickets connectors with "Add"; "Show more"; "Advanced"); "Integrations, pending" (the Documents row shows a "Pending" chip); "Connector detail" ("Mail connector", "Allow writes" with the caption "Read only", "Remove")) and PG-B-Rules "Integrations" ("Connect pending: alert to finish in browser, then refresh").

#### Steps
1. Settings > "Integrations" → catalog shows search, "Connected" (Mail connector "Added", Calendar connector "Added" are drawn as the connected state; for this story assume Calendar is not yet added), "Available" (Documents connector, Banking connector, Tickets connector each with "Add"), "Show more", "Advanced".
2. Tap into the search field and type "calendar" → the list filters. If nothing matches the page shows "No apps match your search."
3. Tap "Add" next to "Calendar connector" → the row shows a working indicator, and after the browser step a "Pending" chip while the connection completes (drawn).
4. Safari opens at the provider's authorization page → the user signs in and approves access.
5. Return to Praci (by the app switcher or the redirect) → the app polls `connections.complete` every 2 s while Safari is open.
6. Poll sees "connected" → the Calendar row moves to "Connected" with "Added", the tool count appears (Expo "{count} tools"), and a notice is posted to the agent chat that the app was connected.
7. Tap the Calendar row → the connector detail opens: "Allow writes" (switch, caption "Read only") and "Remove" are drawn; accounts, tools and access per agent are not.
8. Optionally tap "Add another Calendar connector" to connect a second account (Expo "Add another {name}") → the same Safari loop; the row name becomes "Calendar 2".
9. Tap Back → the Settings list shows the Integrations count increased by one.

#### Variations
- Standard iPhone: Back is in the top bar. Inner display: the catalog is in the 2/3 column and the app detail replaces it. Half-folded: catalog left, selected app right.
- The user never completes Safari: after about 90 s of polling (45 tries) Expo shows an alert "Connection pending" with "Finish connecting in the browser, then refresh this page." The user can pull to refresh.
- Reconnect an expired account: Expo shows "Reconnect" (API: `connections.begin` with `reconnect`).
- Rename or remove an account: Expo has "Could not rename connection" and "Remove {name}" / "Could not revoke connection". No board for rename or remove.

#### Edge Cases
- Catalog load failure: message with "Try again" (rule card).
- The Safari sign-in fails or is cancelled: the poll never succeeds; the pending alert is the only feedback. Whether the app returns via a universal link or the user switches back by hand is not specified.
- Revoking an account used by agents: `connections.effectiveAccess` shows which agents lose access; no confirmation is drawn.
- Writes are off by default for connected apps (`connections.setWrites`); the connector detail draws the "Allow writes" switch (STORY-054).
- Older self-hosted server without `connections.*`: 404 means "not supported"; no board.

#### Design gaps
- The connector detail draws "Allow writes" and "Remove"; accounts, tools and access per agent are not drawn. The inner rule card still describes the full detail in words only.
- The in-row "Pending" chip is drawn; the "Connection pending" alert wording is not, and the polling stops after the app leaves the page (Expo aborts on blur), which the native app must decide.
- The search field is drawn; the filtered list, "No apps match your search." and the expanded "Show more" list are not.
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
**Ideal path**: 4 — tap the "AB" avatar, Settings, AI data sharing, switch one service off, Back (no confirmation is drawn).
**Alternate paths**: Accept the prompt shown when an action needs consent (drawn in `PG-B-Consent`, #417); Data room and Legal pages call `consent` and `consentGrant` themselves (their own consent state in #424); "Withdraw all permissions" for a single reset.
**Design source**: `PG-B-Consent.dc.html` frame "Settings, AI data sharing": title "AI data sharing", three rows with switches ("Model A, Messages and attachments" on; "Speech A, Recordings and spoken text" on; "Memory A, Summaries and memories" off), the note "Turning off Model A pauses all agents." and a "Privacy details" link; the first-use sheet in the left frame is the Speech one. `PG-B-Settings.dc.html` draws the same page with an "Always allow" list under the switches (STORY-055). "Withdraw all permissions", empty, loading and error states: NO BOARD.

#### Steps
1. Tap "AI data sharing" in Settings → page lists the services that receive data, each as a row with a name, a one-line description and a green switch ("Model A", "Speech A", "Memory A"), plus a "Privacy details" link (Expo groups them as "AI models", "Memory", "Voice" and adds "Withdraw all permissions", which the board does not draw).
2. Switch off "Speech A" → the switch turns off at once (`aiConsent.revoke`).
3. Open Voice and tap "Hear a sample" (hosted voice) → fails with "Review AI data sharing in Account settings before continuing."
4. Return to AI data sharing and switch it back on → allowed (`aiConsent.allow`).
5. Tap "Withdraw all permissions" (Expo only; not on the board) → alert "Withdraw all permissions?" with Cancel and "Withdraw"; Cancel leaves everything as is.

#### Variations
- Native prompt before an AI data use (required in phase 5): drawn as a bottom sheet for Speech ("Share recordings with Speech A?" with Allow, Not now and "Privacy details"); the model prompt is not drawn (STORY-048, STORY-117).
- Space-scoped vs. account-scoped consent is not stated.

#### Edge Cases
- Load failure: Expo "Could not load permissions." with "Retry". Empty: "No AI services configured."
- Consent change in flight when the sheet is dismissed: unspecified.

#### Design gaps
- Error text uses "Account settings" while the row is under Settings > "AI data sharing"; the label mismatch (and the Account page not listing it in the board) may send a user to the wrong page.
- Expo `account.tsx` also carries an "AI data sharing" row, so the page is reachable from two places in Expo; the board shows only the root row.
- The page has no loading, error or empty state and no "Withdraw all permissions". The note "Turning off Model A pauses all agents." explains Model A; what stops working with Memory A or Speech A off is still not said.


### STORY-095: Change a password and restore an archived bot
**Type**: medium
**Topic**: Settings, models, voice and integrations
**Source**: topics/settings.md STORY-009
**Phase issue**: #421 (P9)
**Persona**: Ben Achterberg, operator who archived a bot and now needs it back
**Goal**: Rotate his password, then bring back the archived "Ledger" bot.
**Preconditions**: Password sign-in account (not SSO only); one archived bot.
**Device**: standard iPhone
**Ideal path**: 8 — Change password (5 steps), then Archived bots, Restore and Back (3).
**Alternate paths**: Forgot password from Sign in (mail link) instead of changing it; SSO users use "Link SSO" (Expo account only); restore from bot settings (#415) while the bot is archived (NO BOARD for the archive state); restore from Home sections (archived bots do not appear there).
**Design source**: Row "Change password" in `PG-B-Account.dc.html`; `PG-B-Settings.dc.html` (the row "Archived bots"; the page "Archived bots" with rows "Close checklist / Archived Oct 3 / Restore" and "Inbox agent / Archived Sep 21 / Restore"; an empty page "No archived bots"). The Change password page: NO BOARD.

#### Steps
1. Tap "Change password" → form with "Current password", "New password", "Confirm password" (Expo labels), Save disabled until all are filled.
2. Fill the fields and mistype confirmation → inline "Passwords do not match".
3. Fix it and tap save → saved; the user stays signed in (other sessions are not described).
4. Return to Settings, tap "Archived bots" → a list of archived bots, each with its archive date and a "Restore" button (Expo loads `bots/listArchived`); empty state "No archived bots".
5. Tap "Restore" on the "Ledger" row → `restoreArchivedBot` runs (no confirmation is drawn).
6. The row leaves the list and the bot returns to Personnel on Home.

#### Variations
- Wrong current password: Expo "Could not change password" under the form.
- Restore fails: "Could not restore bot" with "Try again."; load fails: "Could not load bots".

#### Edge Cases
- SSO-only account has no password: whether the row is hidden or disabled is not drawn.
- Restoring a bot while offline: not specified.
- Archived bot belongs to another space: not specified.

#### Design gaps
- NO BOARD for the Change password page or a restore confirmation; the Archived bots list and its empty state are drawn.
- Password rules (Expo requires 8 characters at sign up) are not given for the change form.
- Restore happens on the list row (drawn); the archived thread also has a Restore button (STORY-018).
- "Change password" is now reachable once (Account); the Settings rule card still lists a second row.


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
**Design source**: `PG-B-Integrations.dc.html` (frames "Server integrations, Hosted connector" (Method: "Hosted connector" or "Direct connection"; Credentials: Project ID, API key; "Get credentials"; "Continue"; "Skip"), "Credentials error with Retry" ("Could not verify or save these credentials" and a Retry button) and "Server integrations, Direct connection" (Server URL, Access token)); PG-B-Rules "Integrations" (setup: "Skip (xmark), Continue prominent").

#### Steps
1. In Integrations scroll to the bottom and tap "Advanced" → a sheet "Server integrations" opens with a "Method" segmented control "Hosted connector | Direct connection".
2. Select "Hosted connector" → a Credentials section appears with "Project ID" and "API key" fields and "Get credentials" (opens the provider site in Safari).
3. Tap "Get credentials" → Safari opens the provider's key page; user copies the key and returns.
4. Paste the key into the field.
5. Tap "Continue" (prominent) → spinner, the server verifies and saves (`integrationSetup.save`).
6. Success → sheet closes and the catalog loads with the apps.
7. Tap "Skip" next time to leave without saving.

#### Variations
- Choose "Direct connection": the fields become "Server URL" and "Access token" (drawn); Expo has "Client ID", "Client secret" and "Project ID" and a note that authorization finishes in the web app.
- A non-owner member: Expo "Ask the server owner to configure this provider."

#### Edge Cases
- Bad credentials: inline red "Could not verify or save these credentials" with a "Retry" button (drawn); the fields keep their values.
- Secret values must never appear in logs or screenshots; the fields should be secure.
- Catalog failure afterwards: "Could not load integrations" with Retry.

#### Design gaps
- The role check (owner vs. member) and its read-only state are not on the board.
- The Direct connection fields on the board ("Server URL", "Access token") differ from Expo ("Client ID", "Client secret", "Project ID"); one set is needed.
- It is not stated whether the setup sheet appears automatically the first time on a server with no provider, or only via "Advanced".
- Medium sheet vs. the rule card's "Advanced pushes setup as a sheet": the detent is not specified.


### STORY-123: Dictate a message when microphone access is off
**Type**: short
**Topic**: Settings, models, voice and integrations
**Source**: ux-paths round 2 (board `PG-B-Voice`)
**Phase issue**: #423 (P11)
**Persona**: Anneli Strand, founder who dictates replies while walking and has denied the microphone once
**Goal**: Turn microphone access back on and dictate.
**Preconditions**: The microphone permission is denied; the device voice is in use; speech sharing is allowed (STORY-117).
**Device**: standard iPhone
**Ideal path**: 5 — Settings, Voice, "Open Settings", turn the microphone on, return.
**Alternate paths**: (a) Tap the mic in a thread and be told (not drawn). (b) Type instead.
**Design source**: `PG-B-Voice.dc.html` frame "Microphone permission denied" (a row "Microphone access is off" with "Open Settings" above "Speak with"); `PG-B-Consent.dc.html` for the speech sharing prompt. The thread's own denied state: NO BOARD.

#### Steps
1. Tap the "AB" avatar, then "Voice" → the Voice page opens with a row "Microphone access is off" and an "Open Settings" button above "Speak with".
2. Tap "Open Settings" → the iOS Settings page for Praci opens (system UI).
3. Turn the Microphone switch on and switch back to Praci → the row has gone; "Speak with" shows "This device" in use.
4. Open a thread and tap the mic → dictation starts (STORY-044, STORY-117).

#### Variations
- Speech recognition is denied separately: a second system prompt applies (not drawn).
- Hosted voice in use: dictation uploads audio to the provider, which needs the speech sharing consent.

#### Edge Cases
- The user returns from iOS Settings without changing anything: the row stays.
- The permission is changed while the Voice page is open: the row should update when the app returns to the foreground.

#### Design gaps
- Tapping the mic in a thread while access is off has no drawn state; the user may never open the Voice page.
- The row sits only on the Voice page, not in Settings, so a user who never opens Voice is not told.
- Which permission is missing (microphone or speech recognition) is not named, and Expo's copy ("Allow speech recognition in Settings, or connect…") differs.



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
**Ideal path**: 3 — tap the agent row, scroll to the approval card, tap "Allow once". No other control is needed.
**Alternate paths**: (a) The Activity bell (a dot, "Activity, 1 needs you") opens the Activity list (`PG-A-Activity`), then the same row. (b) Tap the push notification, which lands in the thread directly (phase 10). (c) Home search (magnifier) then the agent.
**Design source**: Home: `PG-A-Home.dc.html` (ACTIVITY row "Finance agent / Approve $1,200 payment / Needs you"), `PG-A-Activity.dc.html`, PG-A-Rules > Home. Thread: PG-A-Rules > Agent thread (`PG-A-Thread.dc.html` draws the mail card with "Edit" and "Send"; the tool approval card with "Allow once / Always allow / Deny" is drawn only in DS-06-Chat); `PG-A-ThreadStates.dc.html` "Approval scrolled away" (a "Needs approval" pill above the composer).

#### Steps
1. On Home, tap the ACTIVITY row "Finance agent / Approve $1,200 payment / Needs you" (or the Finance agent row when it is pinned or in a group) → Thread opens. The 60 pt strip stays; the content column pushes in. A Back group fades in at the top of the strip.
2. Read the glass title capsule and the latest message. → Messages are bottom-aligned; the composer floats 12 pt above the bottom.
3. Tap "Allow once" on the tool approval card (DS-06). → "Allow once" is the prominent control inside the card. The run resumes (`run.waiting_input` to running); the card collapses to its resolved state.

#### Variations
- The approval card is taller than the visible column: it scrolls with the messages, and Allow stays inside the card, not the strip.
- The agent is an integration agent (Carta, Mercury, Brex): row shows a letter tile instead of a bot shape. Same flow.

#### Edge Cases
- A second tap on Allow after another device answered returns CONFLICT. The board set does not show how this is presented.
- Outbox: if the network drops while the thread is open, an inline "Failed to send message" with retry appears for sent text; approvals are not sent text, so the failure copy for Allow is undefined.

#### Design gaps
- The strip has no prominent button on the thread page (Back, Page, List, More only). If the card is scrolled out of view, a "Needs approval" pill above the composer jumps to it (drawn).
- No board for the post-Allow resolved state of the tool card or the CONFLICT case.


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
**Design source**: `Main.dc.html` (Home), `Sheet.dc.html` (Inbox list and its states), PG-A-Rules > Inbox and > Inbox message (`PG-A-InboxMessage.dc.html`), `Inner.dc.html` for the draft card ("Needs approval", Edit, Send).

#### Steps
1. On Home, tap the "Inbox" row under PAGES ("3 need reply"). → Inbox list opens with a 28 pt "Inbox" title. Sections "Needs reply" (3), "Today" and "Earlier".
2. Look at the strip. → Back, a group of Search mail / Filter / Compose / More, a spacer, and the prominent "Ask Inbox agent" (bubble.left) at the bottom. Aria labels on the board: "Search mail", "Filter", "Compose", "More", "Ask Inbox agent".
3. Tap the row "Ana Ruiz — Re: Pilot timeline". → Message page: 22 pt subject, sender line, body 15 pt. Strip changes to Back, Archive / Reply, spacer, prominent "Ask Inbox agent".
4. Tap "Ask Inbox agent". → Opens the Inbox agent thread (pushed). Composer reads "Message Inbox agent".
5. Type or dictate "Reply to Ana: Thursday works, 10am." and send. → Agent shows "Here is a draft. I have not sent it." and a card "Re: Pilot timeline", "Needs approval", "To Ana Ruiz", with Edit and Send.
6. Tap "Send". → Draft is sent after approval; card resolves. Message page later shows a Sent check beside the date.

#### Variations
- Tap Archive in step 3 first: row leaves "Needs reply"; Back returns to the list.
- Same information (inbox sections, draft card, the same message) is rendered on the outer display, inner book (`Inner.dc.html`, list beside the agent thread) and standard iPhone (large title with inline search).

#### Edge Cases
- Inbox empty: "Inbox zero" with the last sync time. Error: "Could not load mail." with retry.
- Message with an attachment over the size limit: row shows size and a disabled state.
- Unread dot is the only unread marker; no tinted rows.

#### Design gaps
- The Filter menu contents are only in DS-04 ("Sort by", "Show"); `Split.dc.html` no longer draws "Important only".
- The compose page is drawn for the outer display (`PG-A-Compose`); the Reply composer "under the message" for half-folded is not (`Inner-Message` shows the message beside the list).
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
**Design source**: `Split.dc.html` (inner sidebar + list), `Inner.dc.html`, `Inner-Message.dc.html`, PG-A-Rules > Agent thread ("Sidebar third: Personnel list (extra level). Detail: the thread."), DS-03-Navigation section 6 and "Flat, book hold, 890 x 626pt: one third + two thirds".

#### Steps
1. With the outer display showing the Chief thread, unfold the phone to book hold. → The inner display shows a 277 pt floating sidebar: "Personal ⌄" with "New", an "Activity / 1 needs you" row, PAGES, "PERSONNEL" (Chief, Finance agent, Carta agent, Legal agent) and the profile "Alex Morgan" at the bottom. The thread fills the 2/3 detail.
2. Check the thread content. → Same messages, same state, same copy as outer. The sidebar adds one hierarchy level.
3. Check the toolbar. → The side bar moves to the right edge as a vertical bar (Page, List, More). Nothing interactive in the fold zone x 435 to 455.
4. Tap "Finance agent" in the sidebar. → Only the right pane pushes; the sidebar keeps its selection ("Only the right pane pushes").

#### Variations
- Draft preservation: the half-typed message should survive the display change.
- If the user was on Inbox, the sidebar third keeps its selection on the Inbox row in PAGES and the list sits beside the open message (`Inner-Message`).

#### Edge Cases
- Display change while a run is streaming: the SSE subscription should continue or resume from the highest `seq`.
- Unfold while a sheet (New bot) is open: the sheet should re-center over the 2/3 pane at 420 pt width.

#### Design gaps
- Docs do not specify whether the app is relaunched or the scene changes when going outer to inner; draft text, scroll position, and the selected row survival are all unspecified (discovery.md "Duo posture changes").
- Which Personnel row is highlighted in the sidebar for a Group thread, or when the open page is Inbox, is shown only for Inbox (`Split.dc.html` filled "Inbox" row).
- The inner sidebar no longer draws "Search"; where search lives on the inner display (and its results) is not drawn.


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
**Design source**: `PG-A-Computer.dc.html`, `Desk-Computer.dc.html` (laptop pose 626x890: a clear Team/Private picker, the caption "You have control", a "Keyboard" button, "Fit to screen", prominent "Release control" and a key bar Esc, Tab, Ctrl and arrows on the bottom half), PG-A-Rules > Computer ("Top half: the screen (watch). Bottom half: key bar, Release, thread composer. This is the main use of the pose."), DS-03-Navigation laptop pose section. Entry point: `PH-Thread` and `PG-A-Thread` "Chat menu" ("Open computer") and `PG-A-ThreadStates` "Computer block".

#### Steps
1. In the Chief thread, tap the three-dots "Chat menu" and choose "Open computer". → "Starting Team computer" with a spinner, then the live desktop.
2. Fold the phone into laptop pose. → Screen on the top half; controls on the bottom half as horizontal bars. Fold gap y 435 to 455 stays clear of the screen content.
3. Look at the overlays over the screen. → Clear Team/Private picker top-left, control chip top-right; clear glass with 35% dim.
4. Read the handoff state from the agent. → "Finance agent is waiting for you" with the note and "I'm done" and "Skip".
5. Tap "Take control". → Prominent action changes to "Release control" (lock.open); the caption says "You are driving" or "You have control" (the two boards differ); key bar appears.
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
- Standard iPhone (393 pt): `PH-Computer` draws the same controls: "Take control" as a bottom pill while watching, "Release" at the top right and a key bar (Esc, Tab, Ctrl, arrows) at the bottom while in control.
- The same Team Computer information (screen, control state) is shown on outer display (clear strip, thread not visible), inner flat (thread 1/3, screen 2/3), half-folded (1/2 + 1/2), and laptop pose.

#### Edge Cases
- Screen URL capability expires at 1 hour; renewal at 50 minutes should not reload the screen.
- Lease default 15 minutes: expiry while typing needs a visible state. Not on a board.
- Errors: "Could not open computer" with retry; "Could not load the desktop."; Expo adds "This device cannot reach the screen URL."
- Handoff ask answered from another device: CONFLICT.

#### Design gaps
- The laptop pose is drawn (`Desk-Computer`), but only with control held; the watching pose and the bottom-half thread composer are not.
- Lease expiry is drawn ("Control ended"); the "Could not switch computer" error (Expo) has no designed state.
- "Open computer" is in the drawn Chat menu, and a computer block in the thread (`PG-A-ThreadStates`) opens it; the caption copy differs between boards ("You are driving" on the outer and standard boards, "You have control" on `Desk-Computer`).
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
1. On Home, tap "Finance" under PAGES (it shows "6 mo runway"). → Finance page: period tabs, "Runway [N] mo", "Cash [AMOUNT]", and the "Monthly burn" bar chart for 12 months (Nov to Oct, the latest month highlighted).
2. Tap "Hide amounts" (eye) in the horizontal bar. → Amounts show a mask; this is a device-only setting and also hides amounts in chat finance cards.
3. Tap the highlighted Sep bar or read the chart. → Chart detail is shown on the top half (tap behavior on bars is not defined).
4. In the bottom bar, tap "Message Finance agent" and type "Why did spend jump last month?". → The agent replies "Two annual renewals landed in the same month, [AMOUNT] together. Without them, spend was flat." in a compact thread above the composer.
5. Tap "Back". → Returns to Home; the pose is irrelevant there.

#### Variations
- Period tabs and Accounts list are on the bottom half in laptop pose (PG-B-Rules > Finance), so the composer shares the bottom half with them; only `Desk.dc.html` shows the composer and chart, not the accounts list.
- Standard iPhone: same page, horizontal toolbar, "Ask Finance agent" prominent at the bottom.
- Outer display: the strip has Hide amounts (no refresh button is drawn) and the prominent "Ask Finance agent".

#### Edge Cases
- Not connected: empty state "No accounts yet" with "Add account".
- Error: red banner with Refresh; loading: skeleton KPIs.
- Non-USD accounts are left out of totals (discovery note); chart label is not defined for that.

#### Design gaps
- The Desk board and the rule card now agree (page on the top half, Finance agent thread and composer on the bottom half); where Accounts and Upcoming go in the laptop pose (they scroll in the top half) is stated only in the rule card.
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
**Alternate paths**: Home empty state "New agent" button (`PG-A-Home` "Empty space") goes straight to the same sheet. The same menu offers "New group" (sheet) and "New space" (medium sheet).
**Design source**: `Main.dc.html` (prominent New), PG-B-Rules > New bot (`PG-B-NewBot.dc.html`), > New group, > New space, DS-03-Navigation sheet header.

#### Steps
1. On Home (outer), tap the prominent "New" button at the bottom of the strip. → Menu: "New agent", "New group", "New space".
2. Tap "New agent". → A medium sheet "New bot" appears in the content area beside the strip, radius 34, with a grabber. The header shows Cancel (xmark) and a "Create" text capsule (dimmed until Name has text).
3. Type a name. → "Create" enables only when Name has text.
4. Tap "Create". → Button shows "Creating"; sheet dismisses; the new bot appears in PERSONNEL.
5. Repeat on inner flat: tap the "New" button in the sidebar. → A 420 pt-wide sheet is centered over the dimmed 2/3 pane with Cancel top-left and the confirm button top-right.
6. Fold to half-folded while the sheet is open. → The sheet recenters in the right half and does not cross the fold.

#### Variations
- Dirty form: swipe down or Cancel asks before discarding.
- "New space" medium sheet: the detent grows with the keyboard; the sheet is smaller on inner (420 pt, small variant).
- "New group" is a sheet with "Create" (dimmed until a name and 2 to 6 bots are chosen), as drawn in `PG-B-NewGroup`.

#### Edge Cases
- Error line "Check your connection and retry" (drawn; Expo copy: "Could not create bot").
- New group with no bots: Members shows a muted line pointing to New bot.
- New space created but not opened: alert with "Try again" from the sidebar.

#### Design gaps
- Sheet behavior at 466x420 (short outer height) is not drawn.
- The menu says "New agent" but the sheet title and rule cards say "New bot" (STORY-012).


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
**Design source**: DS-03-Navigation "Reduced height, 466 x 420pt" and "COLLAPSE ORDER" (Inbox: Search then Filter; Thread: List then Page; Computer: Fit then Scope; Finance: Refresh then Hide amounts); `PG-A-Thread.dc.html` "Chat menu"; PG-A-Rules > Agent thread.

#### Steps
1. Open the Chief thread. → At 420 pt the strip cannot hold every group.
2. Observe the strip. → Items collapse bottom to top into More: last action in the actions group first; the prominent action collapses last (below about 300 pt). More stays pinned at the bottom.
3. Tap More ("Chat menu"). → Menu lists collapsed items plus the drawn agent actions: "Agent settings" (the page is titled "Bot settings"; Expo says "Chat settings"), "Open computer", "Clear chat", "Archive", "Delete chat". The reduced-height menu with collapsed items is not drawn.
4. Tap "Clear chat". → Confirm alert with "Clear" (not drawn); on confirm the thread empties.

#### Variations
- Page and List (doc.text, checklist) move into More first on a thread; on Inbox the Compose item collapses before Search mail.
- Each toolbar item needs an icon and a title so it can live in the menu.

#### Edge Cases
- Keyboard open on the outer display reduces height; the same collapse should apply.
- "Archive" failure shows "Could not archive bot" (Expo copy).

#### Design gaps
- The menu is drawn at full height; the same action is called "Agent settings" in the menu, "Bot settings" on the page, "Chat settings" in Expo and "Group settings" for groups.
- The collapse order is now listed for Inbox, Thread, Computer and Finance (DS-03); the Finance entry names a Refresh button that `PG-B-Finance` does not draw.
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
**Alternate paths**: Open the app, switch space from the title menu (STORY-109, STORY-110), find the Legal agent row. Or use Home Activity.
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
- NO BOARD for the permission prompt, a Notifications row (Account draws Hide amounts, Language and Appearance only), Live Activity, or the in-app presentation after a push.
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
2. Observe the sheet. → Settings list in 1/3 (selected row filled) and the selected detail in 2/3: profile, Models, Voice, Integrations, AI data sharing, Archived bots. Done (xmark) closes.
3. Tap "Models". → Detail shows Default model, Providers, Add server.
4. Tap "Default model" and choose "Model A" from the menu. → Green line "Now using Model A".
5. Tap "Find models" for a local server. → Row shows a spinner; success or "Server unreachable" red line; "No matching models" for no match.
6. Tap "Done". → Sheet closes; Home returns.

#### Variations
- Outer display: each row pushes inside the sheet with Back; no split.
- Voice shows "Hear a sample" as the prominent button; Integrations "Continue" only inside setup.
- Account (profile detail) holds Change password, sign out and delete account (`PG-B-Account`, drawn for the outer layout only).

#### Edge Cases
- Values load after the list renders; rows show no value until loaded.
- Self-hosted older server: the model procedure returns 404 meaning "not supported".

#### Design gaps
- The Change password destination has no board. Account, AI data sharing and Archived bots are drawn for the outer display only, not inside the inner nested split.
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
**Ideal path**: 3 — Artifacts ("See all" on Home), tap the image row, Share.
**Alternate paths**: Tap an image inside a thread (opens PG-A-Image directly). Save to Photos instead of Share.
**Design source**: PG-A-Rules > Artifacts (`PG-A-Artifacts.dc.html`), > Artifact (`PG-A-Artifact.dc.html`), > Image (`PG-A-Image.dc.html`: image, "More menu" (Versions, Delete), Versions list, delete alert, "Saved to Photos" toast).

#### Steps
1. On Home, tap "See all" in the ARTIFACTS section. → List with 28 pt "Artifacts" title, filter chips ("All agents" first), divided rows with type tiles. No prominent action.
2. Tap the image artifact row. → Full-screen image with a 35% dim under clear-glass controls: Close, Share / Save to Photos, More; a clear name pill at the bottom.
3. Tap "Share" (square.and.arrow.up). → System share sheet.

#### Variations
- Inner display: the bot filter is a vertical list in the 1/3, rows in the detail, and preview as the extra level; the image fills the 2/3 with the thread as the sidebar third.
- Half-folded: image on one half, thread on the other. Laptop pose: image on top, controls on the bottom; rotates freely.
- Non-image artifacts (Artifact page): Share is the prominent action, the version pill with older and newer arrows floats, and More holds the rest.

#### Edge Cases
- "Could not load this image." with Close still available; "No preview for this file type."
- Long press a row in the list: delete confirm lists the version count.

#### Design gaps
- The Image rule says the image page has no prominent action while Artifact has "Share" as prominent; opening an image from the Artifacts list vs from a thread both reach PG-A-Image, but the Artifact page rule does not say when an image artifact uses which screen.
- Laptop pose is applicable to Image but not Artifacts; the transition from the list (full column) to the image (pose) is not specified.
- Save to Photos permission denial state has NO BOARD.


## Redundancy Candidates

Built from the **Alternate paths** fields and the multi-surface notes in the Design gaps. These are candidates to simplify, not decisions. Each entry names a pair or group of stories. Round 2 updated every row against the current boards and added P17, P18, I13 and F11.

### Duplicate paths (several ways to do the same thing)

| # | What the user wants | Paths | Stories | Suggested direction |
| --- | --- | --- | --- | --- |
| P1 | Open the Inbox agent | Inbox message "Ask Inbox agent", the list's prominent "Ask Inbox agent" (now on `PH-Inbox` too), Home Personnel row, the Inbox row in PAGES | 057, 060, 099, 011, 114, 121 | Keep one prominent entry per page; keep the Personnel row as the always-available route |
| P2 | Reach Settings | The "AB" avatar on standard and outer Home (drawn), the inner sidebar profile row, the Account icon (Expo), the Server and Models rows, the message "Review AI data sharing in Account settings" | 087, 094, 107, 002, 117, 126 | The avatar is the one entry; the Server sheet has no Settings row yet; the consent error should deep-link, not name a path |
| P3 | Fix a missing model | Home "Connect a model" card (standard and outer) and sheet (outer), the thread's "Not sent: No model connected" with "Connect", Settings > Models, Legal "Add your OpenRouter key" | 019, 040, 089, 081, 111 | One reusable "Connect a model" sheet that the card, the thread and Legal all open, and that returns to where the user was |
| P4 | Archive mail | Swipe ("Archive" and "Spam"), the "Archived / Undo" toast, message Archive, Cleanup | 056, 057, 060, 062, 115 | Keep swipe and message Archive; bulk only in Cleanup |
| P5 | Grant AI data consent | Settings page, the Speech sheet, the Inbox "Consent needed" prompt, the sentence on the Connect sheet, an in-thread `ai_consent` card, voice start | 048, 094, 052, 066, 117, 121 | One consent component reused in all places; the model prompt itself is not drawn |
| P6 | Open an agent's conversation | Thread from Home, the Activity list, Page "Open chat", Routine "Open chat" and "Open last run", Artifact "Ask", push tap | 011, 073, 075, 106, 118 | Same thread screen; make sure all routes land on the same state |
| P7 | Create a bot | Home New menu ("New agent"), the empty-state "New agent" button, "Message Chief" after a model connects, Expo fallback "New Bot", the inner New button | 012, 104, 019, 111 | Remove the no-form fallback; one New menu; one term for the object |
| P8 | Create a space and switch | "New space" in the New menu, "New space" in the space title menu, inline space groups (Expo) | 015, 016, 109, 110 | The boards chose the title menu; drop one of the two "New space" entries and Expo's inline list |
| P9 | Answer an approval | Thread card ("Edit" and "Send" for mail, "Allow once" for tools), Home Activity row ("Needs you / Approve …"), the Activity list, the "Needs approval" pill, Inbox message view, push | 011, 045, 046, 106, 118 | One source of labels (the Activity subtitle says "Approve", the cards say "Send" and "Allow once") and one outcome handler (including CONFLICT) |
| P10 | Share a file or image | Artifact Share, Image Share and Save to Photos, Data room "Ask about this file", composer attach (Photos, Files, Data room) | 070, 072, 084, 034 | System share sheet everywhere; no separate Data room share control |
| P11 | Hide amounts | Finance strip button, the Account switch, chat finance card | 079, 087 | One device-only setting; the two controls must stay in step |
| P12 | Open a page | PAGES rows (standard, outer and inner sidebar), the ARTIFACTS "See all" row, the More menu | 086, 098, 105, 085 | Keep the same item list on every display; the inner sidebar now has PAGES |
| P13 | Retry a failed load | "Try again" (Home, Inbox, Cleanup, thread refresh, Legal) and "Retry" (sign-in options, Agent page, Agent list, Routine, Computer, send retries on compose), Finance banner Refresh | 006, 013, 077, 078, 127 | One retry label for loads; keep "Retry" for sends (the boards currently mix both) |
| P14 | Finish a Safari round trip | Integration connect, Carta connect, SSO, billing checkout, the password reset link | 003, 005, 082, 093 | Same return handling and polling rules |
| P15 | Write mail | Compose (ordinary glass on every Inbox board), Reply, the Reply menu (Reply all, Forward), Edit draft on an agent card, "Ask Inbox agent" (tinted on every Inbox board) | 058, 059, 065, 114, 057, 047 | One compose page; Compose stays ordinary and "Ask Inbox agent" stays the tinted action |
| P16 | Change a password | "Change password" row in Account only on the boards; the Settings rule card still lists a second row | 095, 007 | Keep the one row; fix the rule card |
| P17 | Unsubscribe | The row on a newsletter message, the Cleanup bulk menu, asking the Inbox agent | 119, 062, 115 | The message row for one sender, Cleanup for many; the same confirmation and result wording |
| P18 | See a routine's result | Activity "Weekly runway Done", the routine detail "Open last run", the strip "Open chat", Run history | 075, 076, 120 | One destination for "the conversation of the last run" and one label |

### Duplicate information (same facts shown in several places)

| # | Information | Where it appears | Stories | Risk |
| --- | --- | --- | --- | --- |
| I1 | Pending approval | Thread card, Home Activity row, Activity list, the "Needs approval" pill, Inbox message, push text | 011, 032, 046, 106, 118 | Mail cards agree (Edit and Send); Activity says "Needs you" with a subtitle "Approve"; tool approvals use a third set (Allow once, Always allow, Deny) |
| I2 | Working state of an agent | Thread indicator, group footer lines, Home Activity row ("Working"), the Activity list, later Live Activities | 023, 026, 011, 118 | Five renderers to keep in sync; the Activity dot is blue, the indicator dots are neutral |
| I3 | Runway and cash figures | Finance page, agent page tiles, "Runway summary" artifact, routine prompt, chat finance card, Home previews and Activity rows ("$1,200") | 078, 073, 070, 075, 079 | No cross-links; Hide amounts must mask all, including plain text |
| I4 | Connected apps | Settings Integrations value, catalog page, connector detail, chat `app_connect` card | 093, 087 | Card rendering undefined |
| I5 | Server host | Sign-in link, Server sheet, Switch alert, Settings (no row) | 002, 126 | Format defined only in Expo |
| I6 | Personnel order and pins | Web, Expo, native | 020 | Native must match server order exactly |
| I7 | Unread state | Home row dot (drawn on the outer Home), the sidebar on the inner display, the thread "NEW" divider, the Activity bell dot | 022, 030, 011 | Four unread indicators, three drawn |
| I8 | Page row and the agent for the same capability | PAGES row, Personnel row (pinned or in a group) and ACTIVITY row; Legal, Carta, Data room | 086, 085 | Two or three entries for one thing; the default Personnel list no longer repeats Finance and Legal |
| I9 | Sections inside Inbox | Every Inbox board: "Needs reply / Today / Earlier"; the Inbox rule card "Other mail today"; filter chips vs Expo categories | 056, 060 | The boards agree; the rule card and Expo do not |
| I10 | Routines and checklists | Routine prompt, agent page lines, list items | 075, 073, 074, 076, 120 | The same task can be tracked in a routine, a page and a list |
| I11 | Consent state | The Connect sheet sentence, the Speech sheet, the Settings page rows ("Model A", "Speech A", "Memory A"), the Inbox prompt, the server error text | 048, 094, 117, 121 | Recipient names and wording must come from one source |
| I12 | Unsent message state | The "Offline" row and the "Waiting to send" caption | 038, 116 | Two signals for one state; fine if the row clears on reconnect and the caption stays until delivery |
| I13 | Where a mail draft lives | The approval card (autosaves), the Edit draft page, "Save draft" on close, "saved in Drafts" after a failed send, Gmail Drafts | 047, 058, 127, 125 | The app has no Drafts view or Sent view, but the copy points at both |

### Overlapping features and tools

| # | Features | Stories | Note |
| --- | --- | --- | --- |
| F1 | Archive (bot) vs delete (bot) vs archive (mail) vs delete (artifact) | 018, 095, 071, 056 | Four meanings of "archive/delete"; two texts for the bot archive alert; "Delete chat" for an agent has no copy |
| F2 | Page vs List vs Artifact vs Data room file | 073, 074, 069, 083 | Four places a bot can leave durable output |
| F3 | Approvals vs choice cards vs secret asks vs consent | 045, 054, 051, 048 | Four card kinds with different buttons; need one visual language |
| F4 | Search: mail search, global search, Artifacts search, Data room search | 060, 031, 069, 083 | Four search fields, one global search not drawn; the inner sidebar no longer draws Search |
| F5 | Device voice vs hosted voice vs dictation | 091, 092, 033, 123 | The bot-level device voice flag and the global "Speak with" choice interact in an unstated way |
| F6 | Open computer vs Page vs List (agent actions) | 067, 073, 074 | Strip actions differ by agent |
| F7 | Mail Compose vs Reply vs Forward vs Edit draft | 058, 059, 065, 047, 114, 127 | One compose page; Forward is now in the Reply menu on the message and on the compose title (two routes); Edit draft has an entry on the card |
| F8 | Settings Account vs Profile row vs Home avatar | 087, 007, 112 | One profile row; the "AB" avatar opens Settings, not Account |
| F9 | Cleanup vs swipe Archive vs Newsletter and Junk labels vs the message's Unsubscribe row | 062, 115, 056, 060, 119 | Four ways to deal with newsletters; the standard iPhone has the More button but no Cleanup frames |
| F10 | Space vs group vs section | 015, 014, 020, 109 | Three grouping levels; the title menu shows spaces, groups are drawn in Personnel, sections are still undrawn |
| F11 | Run again vs Retry vs Try again | 120, 127, 013 | Three verbs for repeating a failed action |

## Design Gaps by Phase

Each bullet is one deduplicated gap. Story IDs cite the stories whose Design gaps named it (catalog IDs; a merged story's gaps are cited under its survivor). **DECISION:** marks a gap that needs a product decision, not just a missing board. "NO BOARD" means no board exists in `docs/design-system/ios/boards/`. Round 2: the lists were rebuilt from the story-level gaps after the boards were re-read; gaps that the 58 boards now close were removed, partly closed gaps were narrowed to what is still missing, and new gaps were added.

### #412 (P0): Scaffold and tokens

- Light-mode layouts: the boards read were dark only; the same layout is claimed for light but not shown (025).
- Dynamic Type and accessibility behavior of long markdown, tables and cards is not verified on any board (025, 087).
- DECISION: status colour for "Working": the thread boards and DS-06 now agree (neutral dots, `statusWorking` ring), but `PG-A-Activity` draws a blue dot labelled "Working". Choose one (023, 118).

### #413 (P1): Contracts export

- DECISION: what the UI does when the server lacks a procedure (404 means "not supported"): hide, disable, or explain; no board and no copy (010, 077).
- Decoders must tolerate missing optional fields from older servers; no board shows which screens degrade (010).

### #414 (P2): Server selection and sign in

- DECISION: which mode the app opens in on first launch: Expo opens sign-up, the board opens sign-in; deleting an account now ends on Sign up (001, 004, 112).
- Sign-in states not drawn: pending button label, local validation messages, Go key and focus order, rate limit (001).
- Sign-up draws only the form: not drawn: Name marked optional, the password rule, an error line (email taken, weak password), the pending state (004).
- Password reset and email confirmation are drawn (forgot, "Check your email", cooldowns, "Set new password", "Confirm your email"); not drawn: error lines (unknown email, rate limit, mismatched passwords, expired link), no mail app, what "Set password" does next, how the link reaches the app (universal link or web page), "Change email", two back controls (004, 005, 113).
- Capabilities: the failed-options frame hides the email fields; no distinction between no network and a wrong server (006).
- Server sheet: drawn: invalid address, http warning, not a Praci server, unreachable (Save becomes Retry), "Switch server?"; not drawn: one copy for Expo's four validation strings, "Use default server" shown even when nothing changed, host display format on the sign-in link (002, 126).
- Server row in Settings: the rule card says the sheet opens from Settings; the Settings board has no row (002, 126).
- DECISION: what happens to unsent messages on a server switch or forced sign-out: the "Session ended" card says drafts are kept, the "Switch server?" alert says saved conversations are removed (007, 008, 126).
- SSO: cancel, failure, long provider name and the system consent prompt are drawn; the first-time SSO setup screen route (`integrationSetup/get` `needsSetup`) has no board (003).
- Session end: two recoveries are drawn (replace the stack with Sign in, or the thread's own "Session ended" with a Sign in button); the stale-space moment and the offline launch before the 401 are not (008, 024).

### #415 (P3): Home, spaces, bots and groups

- Activity: the list is drawn for the outer display; the standard iPhone and the inner sidebar row "Activity / 1 needs you" have no destination; row order, the TODAY and EARLIER rule, how Home picks three rows, and whether "Done" rows open anything are not stated (011, 098, 118).
- Standard Home: only "Connected" and "No model" are drawn; loading, error, offline, empty and pinned frames exist for the outer display only; no pull to refresh (013).
- DECISION: accessible names for Home controls: Expo "Account / Activity / Search / Artifacts / Create" vs board "Account / Activity, 1 needs you / Search / New" (011, 012).
- New agent: the menu says "New agent", the sheet and rule cards say "New bot"; the sheet has Name, Role and Color where Expo has Title and Description; the discard confirmation is not drawn; the Expo "New Bot" fallback has no board path (012, 104).
- DECISION: where Create lands (thread or back to Home) for a new bot and a new group (012, 014).
- Empty space is drawn ("No agents yet" with "New agent"); the rule card text "Tap + to create a bot" is stale; whether a new space starts with Chief is not stated (012, 019).
- New group: the sheet is drawn with its rule ("Choose 2 to 6 members."); the empty group thread ("Message the group") and the sheet on a standard iPhone are not (014).
- Space switcher: the title menu, the "Switching" state, Space settings and the delete confirmation are drawn; not drawn: the open menu on the inner sidebar, a switch failure, many or long space names, a sign that another space needs the user, and "New space" appearing in both this menu and the New menu (015, 016, 109, 110).
- Space settings: the standard iPhone page, which space is selected after a delete, who may rename or delete a shared space (110).
- DECISION: "default space" (the drawn Personal settings page has no Delete row; Expo has a default) and member or invite flows (no API) (015, 016, 110).
- The alert text "Try again from the sidebar" points at a sidebar the standard iPhone lacks (015).
- Inner display detail pane when the new space has no last thread (016, 030).
- Bot settings: drawn with Save states; not drawn: the Advanced page (Model, Thinking), Skills and Notifications rows, unsaved-changes handling; "Delete chat" in the Chat menu for an agent does not say what it deletes (017, 018).
- Archive: the thread alert, archived banner and Archived bots page are drawn; not drawn: archived groups and group restore, the agent delete alert and memory choice; two different archive alert texts (thread and DS-04) (018).
- Connect a model: card and Chief row on a standard iPhone; sheet, wrong-key error and "Model A connected." on the outer display; not drawn: the sheet on a standard iPhone, the Local server and Subscription forms, a pending or disabled Connect, why no New button shows while the card is up, and whether the Connect sheet's sentence counts as consent (019, 089, 090, 111).
- Organize Personnel: a PINNED heading and the DS-04 organize sheet are drawn; not drawn: section headings, collapse, "Rename section", VoiceOver action, section removal and reorder; two group-delete warnings (020).
- Unread dots on Personnel rows are drawn on the outer Home only (022, 030).
- DECISION: onboarding choice cards and focus prompts (`onboarding/*`) have no planned screen (054).

### #416 (P4): Thread read

- Thread states drawn: loading, "Could not refresh", archived, read only, "Session ended", "Reconnecting"; not drawn: a failed first open with nothing saved, a deleted agent (021, 124).
- The standard thread (`PH-Thread`) and group thread (`PH-GroupThread`) are drawn with the More menu; what Members opens, the empty group copy "Message the group" and the viewer's menu are not (026, 124).
- The "NEW" divider and "Jump to latest" are drawn; not drawn: `threads/markUnread` entry, whether "Jump to latest" appears with nothing unread (022, 031).
- DECISION: paging UX: Expo has a "Load earlier messages" button, the rule card shows a spinner only (022).
- End-of-history marker, a paging failure, saved-chat stale signal and retention (031).
- Working indicator: the boards draw no text, Expo shows "{name} is working" and a status line ("Still waiting on {service}"); failed-run note "Last run failed"; partial markdown (023).
- Connection state: "Reconnecting" and "Offline" rows are drawn; when each appears and whether one replaces the other is not stated; the 401 outcome has two designs (024, 008).
- Table Expand and code Expand sheets have no PG board; link tap behavior; image viewer Close and Share placement on standard iPhone (025).
- Group thread: the member list pane, the maximum visible working lines for 6 members (026).
- Suggestion chips are drawn; DECISION: chips send immediately or only fill the composer (027, 044).
- Unknown block placeholder: copy, icon, whether it names the kind, "open on web" path (028).
- DECISION: interim behavior of approval cards in the read-only phase 4 versus phase 5, and in a read-only thread (028, 032, 045, 124).
- Outer strip thread: pins strip placement against the title capsule; the long-press menu lacks "Select text" and "Pin" (029, 031, 036).
- Global search results screen and message jump (`search.query`, `threads.messages({around})`) are not drawn (031).
- A viewer's route into a thread (invite or share link) is not designed (124).
- Inner display: per-agent subscription lifecycle (one stream or several) (030).

### #417 (P5): Thread write, approvals and consent

- Message states drawn: offline, queued, failed, refused ("Remove file"), oversize file, no model, stopping; not drawn: how many messages wait, a way to cancel one, a stale-snapshot marker, the caption with two messages in flight, the banner when the network is up but the server is down (033, 038, 043, 116).
- Cache eviction loses queued sends without notice; the 20-entry cap shows no state (038, 116).
- Attach: the menu (Photos, Files, Data room in the Data room thread) and the oversize chip are drawn on every composer; not drawn: Camera, per-chip upload progress, other chip errors, the four-chip row, a picker for artifacts (034, 043, 084).
- Skipped-attachment notice: only the size case is drawn (limit 25 MB vs Expo 10 MiB); "unsupported type", "max 4 attachments", "permission denied" and HEIC "Converting" are not (035).
- Long-press menu: Reply and Copy are drawn; "React", "Select text" and "Pin" are not; part-message quote, unavailable original, and whether a reply target survives relaunch or posture change (036, 042, 043).
- Mentions: empty popover, token look in composer and bubble (037).
- DECISION: scope of mentions: agents only, or humans too ("Teammate" appears on the board) (037).
- Refused vs failed are drawn differently; not drawn: what "Remove file" does to the text and other files, a way to delete a failed or refused message, the reason copy for a consent refusal, how a failed send becomes refused or gives up; the rule card and Expo still say "Failed to send message" (039, 116).
- No model: the thread block and its Connect button are drawn; not drawn: the Connect sheet over a thread; README text "Connect a model to start a run" vs server text "Connect a model in Settings before running bots." vs board "No model connected" (040, 019).
- Send and Stop: decided (Stop keeps the slot, typed text stays as a draft); a stop failure has no frame; whether Send could interrupt a run directly is not decided (041).
- Reactions: the long-press menu has no "React", so there is no entry; picker, display, mine vs others, offline behavior (042).
- Attachment total (4 files, up to 40 MiB base64) against the 50 MB outbox cap: no warning (043).
- Approval card: read-only state, expanding truncated money arguments before approving, no decline control for mail, `unknown` outcome on the card (045, 046).
- Mail card updates: "Updating" dims Edit but not Send in the frame; editing while the agent replaces the draft; the old text behind "Replaced by a newer draft" (125).
- Edit draft page: Duo inner and half-folded layouts, whether Done is blocked by an invalid address, two commits (Done then Send) (047).
- Consent: the model first-send sheet is not drawn (the Speech sheet and the Settings page are); not drawn: the "Not now" outcomes, a link from the sheet to Settings, memory wording, several recipients in a row; error text says "Account settings" while the row is "AI data sharing" (048, 117, 094, 121).
- CONFLICT: no message designed and thread refetch not specified (032, 050).
- Secret ask: card, destination line, "Saved" and error states, Keychain and AutoFill, retry loses typed value (051).
- Voice-consent wording for a call (the Speech sheet covers speech to text) (052).
- MCP approval: the server-connect card is NO BOARD and is easily confused with the DS-06 MCP card; "MCP settings" destination does not exist (053).
- Choice card: multi- vs single-select and free-text keyboard; warning copy beside the "Allow writes" switch; a "writes are off" message in the thread (054).
- "Always allow" rules: the list with Remove is drawn on the AI data sharing page; not drawn: a confirmation or undo, rule scope, an empty state, and the `autoReview` setting (045, 055).
- Live approval status flip from another device ("Sent" and "Not sent" specimens exist, no transition) (032).

### #418 (P6): Inbox

- Standard iPhone Inbox is drawn with many frames; not drawn: the standard message view, the More menu, pull to refresh (056, 057, 062).
- Swipe: the boards draw "Spam" and "Archive"; the DS-05 specimen has Archive, Star, Mute; Star has no write procedure and Mute maps to `inbox.feedback` by inference; Trash exists in Expo only (056).
- The Inbox rule card still says "Other mail today"; the "Needs attention" and "Junk" label chips are not in the plan (056).
- Message: preview, conversation thread, unsubscribe row and failure toasts are drawn (outer only); not drawn: the control that opens the thread, `inbox.get` failure, where sender avatars come from, "Ask Inbox agent" vs Expo "Ask agent" (057).
- Unsubscribe from one message: no progress, success, failure, `opened` or `sent` wording; when the row is offered (119).
- Compose: states (sending, not sent, unknown, writes off, no recipient) and the Cancel menu are drawn on the outer display; not drawn: the From account list, expanded Cc and Bcc on a reply, `reconnect`, the standard iPhone layout, inner and half-folded placement, a Drafts view and a Sent view that the copy points at (058, 059, 065, 064, 114, 127).
- Forward: reachable from the message's Reply menu and the compose title; whether the message menu opens on tap or long-press, the forward-specific layout and "files left out" copy are not drawn (059).
- Filters: popover items ("Needs reply", "Newsletters", "Read mail") do not match Expo categories; "Read mail" has no `InboxFilter` value; DS-04 places Filter under More while `Sheet` draws it in the strip; "Select messages" bulk mode has no board; own sent-mail rows (060, 064).
- Search overlay empty and error states (099).
- To-do: undo, history, a "no model" explanation, due-label rule (061).
- DECISION: Cleanup: the full flow is drawn (menu, selection, confirmation, progress, failure, Done, empty, History); not drawn: a bulk unsubscribe confirmation and per-sender outcomes, the sender-list loading and error states, "Looks like spam", "Not spam", "Trash", "Learned / Forget", a standard iPhone Cleanup; confirm it belongs to phase 6 (062, 115).
- Mail connection states: writes off, reconnect, no account, consent needed, first sync and zero are drawn on `PH-Inbox` and `Sheet`; not drawn: rate limited, where "Turn on" and "Reconnect" lead, and the case of an administrator who disabled writes (063, 066, 127).
- Consent prompt: the recipient, a "Not now" outcome and a Privacy link are missing (121).
- Inner two-pane Inbox: compose placement, "Inbox zero" detail, a home for Star and Mute, what tapping a label does (064).

### #419 (P7): Duo layouts

- Sign-in and Server sheets have only an outer-display board; inner and half-folded versions, sheet and keyboard placement in half-fold, and state kept while typing across posture change are undrawn (009).
- DECISION: posture change behavior: relaunch vs scene change, and survival of drafts, scroll position, selected row and reply target (100, 076, 085, 043).
- Sidebar: the space control, Activity row and PAGES are drawn in `Split` and DS-03; not drawn: the open space menu, the highlighted row for a group thread, Search (no longer in the sidebar) (100, 016, 085).
- Inner thread: default thread when nothing is selected, per-agent unread in the sidebar, behavior below iOS 27.1, parity of pins strip and unread divider (030).
- Collapse order on a short outer display is listed for Inbox, Thread, Computer and Finance (DS-03; the Finance entry names a Refresh button that is not drawn); a collapsed prominent action is not shown (105).
- Label mismatches between boards: the menu "Agent settings", the page "Bot settings", Expo "Chat settings"; "New agent" vs "New bot"; sheet at 466x420 (104, 105).
- Laptop pose: Finance and Computer (in control) are drawn; Legal, Cap table and Data room are deliberately undrawn; the watching pose, software keyboard covering the bottom half, and transitions between laptop-capable and not-applicable pages (Routine, Artifacts) are not (085, 102, 103, 076, 108, 122).
- Settings on inner display: a sheet containing its own 1/3 + 2/3 split inside a 2/3 area is not drawn, and Account, AI data sharing and Archived bots are drawn for the outer layout only (107).
- Push tap on Duo: which display opens and sidebar selection after a space switch (106).
- Compose, Cleanup and Activity are outer-display boards; their inner and half-folded layouts are not drawn (064, 115, 118).

### #420 (P8): Computer, artifacts, pages, routines

- Computer: all states are drawn on the standard iPhone and outer display (watching, in control, agent waiting, starting, control ended, reconnecting, denied, cannot connect); not drawn: a connected session whose screen cannot load, maintenance actions (Recover, Reset, Update), the Return key (the key bar has Esc, Tab, Ctrl and arrows), pointer, scroll and clipboard input, leaving Computer while holding the lease, an idle-timeout warning, the laptop watching pose (067, 068, 076, 102, 122).
- Artifacts: Home has an ARTIFACTS section with "See all"; the list at 393 pt, search expansion, chip overflow, empty and error states, the chip label ("All agents" vs "All bots") are not drawn (069).
- Versions: the list is drawn for images only; documents use pill arrows; a newer version arriving while viewing; Share placement on a standard iPhone (070).
- DECISION: delete: the image alert is drawn ("for everyone in the space"); the document alert, whether all versions go, undo, multi-select (071).
- Image: "Saved to Photos", More and Versions are drawn; a save failure or denied permission; "Save to Photos" is new vs Expo Share only; back-to-list in inner mode; which screen an image artifact uses (072, 108).
- DECISION: agent page read-only (`pages/save` exists); finding lines have no tap target; Hide amounts on tiles; no cross-link between page, artifact, routine and Finance page (073, 076).
- Agent list: "2 of 5 done" and the DONE group are drawn; conflict alert, reorder and rename, delete affordance, clear done (074).
- DECISION: routines: the list, detail, history, failed run, "Run again" and a Pause and Edit menu are drawn; not drawn: the edit screen, create and delete, the route to the list, "Run again" states, consistent sample data between frames, and one label for "Open chat", "Open last run" and "Open conversation" (075, 076, 120).
- Errors: "Couldn't load …" with Retry is drawn for the Agent page, Agent list, Routine and Computer; the Artifacts list and preview have no frame; no offline marker on these pages; "Not supported by this server" copy (077).

### #421 (P9): Settings

- Settings entry is the "AB" avatar (drawn); the profile row and "Account" are one row; the Integrations count is drawn ("2") but its meaning is not; the avatar initials ("AB") differ from the profile ("SR") in sample data (087).
- DECISION: Expo Account extras: Hide amounts, Language and Appearance are drawn on Account; Avatar style, Notifications, Phone notifications, Usage and Live update have no home (087, 007, 079).
- Account: delete with password, wrong password, SSO, emailed code and "Deleting" are drawn; not drawn: Link SSO, data export (`account.exportRequest`), what deletion does to shared spaces, runs, routines and a hosted plan, an offline delete error (007, 112).
- DECISION: confirmation patterns: delete is an alert with a typed password; sign-out has no confirmation on the board; what happens to the push token and the outbox on sign-out and delete (007, 112).
- Change password: no screen; the Settings rule card still lists a row the board moved to Account (095, 007).
- Models: the model and thinking menus and the provider detail are drawn; backup models, embedding model, the "Thinking" state for non-reasoning models, a save failure (088).
- Provider connection: the form for a provider that is not connected, show/hide for the key, "Use your own key", the subscription sign-in code steps, providers beyond three rows, and how the Home sheet and the Models page relate (089, 019, 111).
- Local server: "Add server" and the found-models list are drawn; limits fields, manual model name, local network permission; the Home sheet's "Local server" has no form (090).
- Voice: states for device only, hosted, not set up, not connected, device unavailable and microphone denied are drawn; not drawn: the first-connection form, voice and speech-model pickers, the interaction between a bot's device-voice flag and the global choice, the Sounds control types (091, 092, 123).
- Integrations: the catalog, the "Pending" chip and the connector detail ("Allow writes", "Remove") are drawn; not drawn: accounts, tools and access per agent, the pending alert wording, polling when the page is left, the filtered and expanded lists, Safari return path, `app_connect` card rendering (093).
- DECISION: server-credentials setup: "Hosted connector" and "Direct connection" are drawn with an error and Retry; the Direct fields ("Server URL", "Access token") differ from Expo ("Client ID", "Client secret", "Project ID"); owner vs member role, whether the sheet auto-opens, detent (097).
- AI data sharing: the page with "Always allow" is drawn; not drawn: loading, error and empty states, "Withdraw all permissions", what stops working when Speech A or Memory A is off (094, 117, 055).
- Writes switch: drawn; warning copy and an MCP settings page are not (053, 054).
- DECISION: usage and billing screens, and in-app purchase vs "manage on web" (no story; discovery).

### #422 (P10): Push

- NO BOARD for the permission prompt, a Notifications settings row, the notification list, or in-app presentation after a tap (106).
- Whether sign-out unregisters the push token (007, 126).
- Whether Hide amounts masks push text (079).

### #423 (P11): Voice

- The microphone-denied row is drawn on the Voice page; the permission prompt itself, a denied state in the thread and the speech-recognition permission are not (091, 123).
- Sounds section ("Call sounds", "Waiting sound") control types and choices (091).
- Active call screen has no PG page; the Speech consent sentence covers speech to text only (052).

### #424 (P12): Finance, Legal, Cap table, Data room

- Entry to the pages: PAGES rows are drawn on the standard, outer and inner sidebar with values ("6 mo runway", "2 deadlines", "3 need reply", "Online"); Cap table and Data room show none (078, 085, 086).
- Finance: DS-03 lists a Refresh button the page does not draw; null runway; account and transaction detail; burn bar detail (078).
- DECISION: Hide amounts scope: Home previews and Activity rows show amounts; plain agent text, push and Live Activities; no masked chat-card frame; two homes for the setting (079).
- Legal: not scanned, scanning, failed and a "Blocked" row are drawn; not drawn: scan completed and cancelled, a result toast, contract detail, deadline edit, status chip mapping, Legal consent (080).
- Legal blocker: the no-key row is not drawn (the frame named "Blocker row" is an unreadable PDF); why an OpenRouter key is needed, consent order, return path from Models (081).
- Cap table: not connected, expired, syncing, the Add contact sheet and the holder detail are drawn; not drawn: the error state, the pending alert, the contact list, the label set mismatch (board vs DS-07), Safari return and poll; "Reconnect" on the board vs "Connect Carta" in the rule card (082).
- Data room: the list, upload, upload failure, search, empty room, file page and attach sources are drawn; not drawn: folder navigation, preview, rename, move, delete, retry processing, processing status, duplicate and zip outcomes, search loading, background upload progress (083).
- DECISION: Data room "Shared / Only me / View only" chips vs README "no share links" (083).
- "Ask about this file" is drawn; the "Data room" attach source appears only in the Data room thread; tapping a Data room reference in a message has no destination (084).
- Legal, Cap table and Data room inner, half-folded and laptop layouts are deliberately undrawn ("No board on purpose"); whether the laptop pose ships for them (085).
- DECISION: PAGES rows are fixed (`sidebarPages` can add or remove); a Data room waiting count and a Cap table value are not drawn; a page row and an agent row for the same capability (086).

### #425 (P13): Platform extras

- Live Activity, App Intents, share extension and widgets have no board; share-extension picker layout on Duo is undefined (106).
- No story covers this phase (see Coverage Matrix).

### #426 (P14): Release

- No gaps from stories. No story covers release; screenshot sets for Duo and standard layouts depend on the #415 and #419 boards.

## Copy and naming conflicts

Conflicts between boards, rule cards, DS-06 and the Expo app that need one chosen string. Round 2 resolved six of the earlier list (the last paragraph) and added eight.

1. Unreachable server: "Could not reach this server" (board) vs "Could not reach that server" (Expo) (002).
2. Home create control: the plus is "New" (aria label); its menu says "New agent", "New group", "New space"; the sheet is titled "New bot"; Expo says "Create" (011, 012, 104, 111).
3. Home control names: Expo "Account / Activity / Search / Artifacts" vs board "Account / Activity, 1 needs you / Search / New / Space: {name}" (011).
4. Agent actions: the menu item "Agent settings", the page "Bot settings", Expo "Chat settings" and "Group settings" (017, 105).
5. Consent error: "Review AI data sharing in Account settings before continuing." vs the Settings row "AI data sharing" (048, 094).
6. No-model text: "Connect a model to start a run" (README) vs "Connect a model in Settings before running bots." (server) vs "Connect a model to start chatting." (Home card) vs "Not sent: No model connected" (thread) (040, 111).
7. Rule cards that lag the boards: `PG-A-Rules` still says "Could not load bots", "Tap + to create a bot", "Failed to send message", "Other mail today" and "Open conversation"; `PG-B-Rules` lists "Change password" in Settings and a "plus, refresh" action group on Cap table (013, 012, 039, 056, 075, 095, 078, 082).
8. Failed send: "Not sent" (boards) vs "Failed to send message" (rule card, Expo alert) (039).
9. Size limit and unit: "25 MB" (board) vs "10 MiB" (Expo) vs "MB" (brief) (035).
10. Working indicator: the boards draw no text; Expo has "{name} is working" and a status line; the Activity list uses a blue "Working" dot (023, 118).
11. Inbox filters: "Needs reply / Newsletters / Read mail" (board) vs All / Important / Updates / Newsletters / Spam (Expo); `PH-Inbox` labels "Needs attention / Newsletter / Junk" (060).
12. Ask agent: "Ask Inbox agent" (every Inbox board) vs "Ask agent" (Expo message) (057, 099).
13. Computer: the key bar "Ctrl / Esc" (boards) vs "Control / Escape / Return" (Expo accessibility names); the button "Keys" (boards) vs "Keyboard" (rule card, Desk-Computer); the caption "You are driving" (standard and outer) vs "You have control" (`Desk-Computer`); "Starting Team computer" (boards) vs "Booting" (rule card) (067, 068, 102).
14. List title: list name (board) vs "List" (Expo) (074).
15. Cap table: groups "Founders / Option pool / Seed investors / Advisors" vs "Founders / Investors / Pool / Other" (DS-07); "Reconnect" (board) vs "Connect Carta" (rule card) (082).
16. Settings: "Account" (Expo Home label) vs the profile row (iOS Settings board); avatar initials "AB" vs "SR" (087, 107).
17. Sign-up and reset copy: "Create account" vs "Sign up", "Send link" vs "Send reset link", "Reset password" vs "Reset your password", "Confirm your email" (004, 005).
18. Activity row: the status "Needs you" and subtitle "Approve …" vs the card buttons "Allow once" and "Send" (011, 032, 046).
19. Cleanup rows say "emails" (board) vs "messages" (Expo) (062).
20. "Retry" vs "Try again": Agent page, Agent list, Routine, Computer, Sign-in options and compose use "Retry"; Home, Inbox, Cleanup, Legal and the thread refresh use "Try again" (006, 013, 077, 127).
21. New: "Couldn't …" (boards) vs "Could not …" (rule cards, Expo) (075, 077).
22. New: two archive alerts: "Archive this chat?" (thread) vs "Archive Finance agent?" (DS-04) (018).
23. New: two group-delete warnings (Group settings and the group Chat menu) (020).
24. New: the routine buttons "Open chat" (strip), "Open last run" (detail) and "Open conversation" (rule card) (075, 120).
25. New: the Artifacts chip "All agents" (board) vs "All bots" (rule card) (069).
26. New: "Direct connection" fields "Server URL / Access token" (board) vs "Client ID / Client secret / Project ID" (Expo) (097).
27. New: "Delete chat" in the Chat menu of an agent, while the object is called an agent elsewhere (017, 018).
28. New: the data-sharing prompt is titled "Share recordings with Speech A?" (board) vs the Expo alert "Share data with {name}?" (048, 117).

Settled in round 2: the working-indicator colour on the thread boards and DS-06 (neutral dots), the mail approval card labels ("Edit" and "Send"; the draft autosaves), the Inbox section names on every board ("Needs reply", "Today", "Earlier"), the Inbox tinted action ("Ask Inbox agent" on every board), the Finance and Cap table section names (the inner book shows the page itself), and the thread's prominent action in the rule card (Send on the approval card). Settled in round 1: product name (boards say "Praci").

## Gaps & Recommendations

Findings from consolidation. These are observations and proposals, not decisions.

1. **The standard iPhone is mostly drawn for Home, Thread, Group thread, Inbox, Computer and the space menu (`PH-*`); everything else still shows only the outer display.** Sign-in, compose, Cleanup, the Inbox message, Activity, Artifacts, Settings, Legal and the other pages have no 393 pt board, and 85 of 124 stories start on a standard iPhone. Draw the Inbox message and compose next, then Cleanup and Settings.
2. **Several drawn screens have no way in.** The Server sheet has no row in Settings (002, 126), the routines list has no route from an agent (120), the conversation view on a message has no control (057), "Members" has no destination (026), and Change password has no page (095). Add the entries before the screens.
3. **Consent is spread over five places and the main one is missing.** The Speech sheet, the Settings page, the Inbox "Consent needed" prompt and the Connect sheet's sentence are drawn; the model first-send sheet is not. Decide whether Connect itself is the consent, give every prompt a "Privacy details" link and a "Not now" outcome, and add a link from the prompt to the Settings page.
4. **Destructive actions confirm in different ways.** Delete account and delete space have alerts with consequences; sign-out has none and discards queued messages; bulk unsubscribe has none ("This can't be undone" appears only on the single-message alert); archive has two texts; "Delete chat" for an agent and "Clear chat" have no copy; group delete has two texts. Pick one pattern and one wording.
5. **Mail is nearly fully drawn.** The list, message, compose, edit draft, Cleanup and every mail state have frames. Missing: a standard iPhone message view and compose, bulk unsubscribe outcomes, `reconnect` and rate-limited states, and the Drafts and Sent places that the copy points at.
6. **Sends and approvals are drawn in detail.** Remaining: a decline control for the mail card, what Send does while the card says "Updating", an edit conflict, CONFLICT, secret asks, choice cards and the model-less consent path.
7. **Sample data disagrees between frames.** The Routine frames mark different routines and dates as failed; the Activity list carries amounts that Hide amounts would not mask; the avatar reads "AB" while the profile reads "SR". Fix the fixtures before they become a build reference.
8. **Laptop pose has two boards.** Finance (`Desk`) and the Computer in control (`Desk-Computer`) are drawn; the watching pose is not, and Legal, Cap table and Data room are deliberately text only.
9. **Update the rule cards.** `PG-A-Rules` and `PG-B-Rules` lag the boards on several strings (see "Copy and naming conflicts", item 7), and no rule card exists for Activity, Compose, Cleanup, the connect sheet or the Server frames.
10. **Cheap fixes.** "Create account" vs "Sign up", "Retry" vs "Try again", "Couldn't" vs "Could not", "Approve" vs "Allow once" vs "Send", the 25 MB vs 10 MiB limit, "emails" vs "messages" and the other string conflicts above cost nothing.
11. **Stories still missing for planned work.** Add stories for the dictation and call loop (#423), notification permission and banner suppression (#422), Live Activities, App Intents, share extension and widgets (#425), global search (#416), the onboarding choice cards (#415), the notification list, and usage and billing (#421) once boards exist. Routines (#420) now have stories.
12. **Unverified.** Everything in this catalog is planned behavior judged from static boards. No story was run against a native build; transitions, pending states, keyboard and posture changes are not shown by any board.
