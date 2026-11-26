# UX Walker report: native iOS app in the Simulator, 2026-11-04

## Run summary

| Item | Value |
| --- | --- |
| Target | `apps/ios` built from branch `docs/ios-ux-walk` (origin/main), bundle `ai.praci.mobile.dev`, iOS 26.3, iPhone 17 Pro, own simulator |
| Backend | One demo stack (slot 6), mock data, scripted agent runtime, no model connected |
| Method | Maestro taps and drags, `xcrun simctl io screenshot`; every screenshot opened and viewed. Light and dark mode; Dynamic Type at Accessibility Extra Large on Home, New agent and Settings |
| Stories | About 35 of 127 walked (see `stories.md`): 6 clean pass, about 20 pass with defects, 8 fail, 2 blocked. The rest were not walked (below) |
| Code findings | 58 in the catalog: 12 confirmed or partly confirmed, 3 refuted or partly refuted, the rest not tested (table below) |
| Screenshots | Session scratchpad `ios-walk/` (not in the repo); names below |
| Not changed | No code fixed, no issues filed, nothing pushed |

## Owner-reported: the Home agent list does not scroll

Not reproduced. Home scrolled correctly in every case tried: a slow drag starting on an agent row (01), a fast 150 ms swipe (02), a drag after pull to refresh (03), a drag on return from a thread (13), after expanding "Show more", after returning from Settings, from the Chief thread, the Finance and Data room pages and a space switch (92 to 98, 118, 121), and in dark mode. A drag starting on the header (title, gear) was only tried at the top, where the list is already at rest. The Inbox list (14, 15), Settings (50), Finance (61), Legal (63), Data room folder, Artifacts and the thread (05, 78) all scroll too.

Two things that could feel like "does not scroll" and are real:

1. The list is short when collapsed. Home shows 4 to 5 agents plus "Show N more", so there is little to scroll until the roster is expanded; the expand button sits at the end of the list, and the number changed between 6 and 7 as an agent moved (88, x2).
2. The thread cannot dismiss its keyboard (STORY-029): the keyboard stays up after dragging or tapping the transcript, so the transcript is cramped and looks stuck.

I could not test on the owner's device, with their data (many agents, sections, pinned rows) or on an iPhone with a different system version. A fresh run on that data is the next step.

Email: short messages fit on one screen, so scrolling is moot. An expanded two-message thread (23 to 25) scrolled correctly under a drag started on the body. Finding 1(a), the web view height starting at 1 pt, was not exercised because no long HTML mail exists in the seed.

## Defects, ranked

Severity: High means a task cannot be done or the user is misled about something important. Medium means a task is harder than it should be or a result is wrong. Low is polish.

| # | Sev | Defect | Screenshots |
| --- | --- | --- | --- |
| 1 | High | The thread keyboard cannot be dismissed. Dragging the transcript, tapping it and pressing Return leave the keyboard up (Maestro `hideKeyboard` also fails). A third of the screen stays covered and the "Jump to latest" control and composer overlap the transcript. | 06, 07, 07b, 12-thread-tapout |
| 2 | High | Take control on the Team computer shows "Stop the bot first" in red while no control on that screen can stop the bot. Dead end. Screen also has two close controls (back arrow and X). | 74, 75, 76 |
| 3 | High | There is no way to write a new email. Compose is reached only through Reply or Forward on an open message. | 14, 37 |
| 4 | High | A user cannot change servers while signed in; the only route is sign out, which has no confirmation. A fresh install shows "Couldn't reach the server" with only Retry and "Use a custom server". | 49, 50, 107, 111, 112 |
| 5 | Medium | Opening a thread lands at the "New" divider, not the newest reply, so a pending question or approval is several screens down. Only "Jump to latest" gets there. | 04, 77, 79 |
| 6 | Medium | Archive in the message screen leaves the user on the message, with a toast that stays more than 3 s. The archived message is still in the inbox list afterwards. Opened mail also returned as unread after a list reload, and the Home count stayed at 14. | 33, 34, 35, 87, 88 |
| 7 | Medium | Consent card for sharing chats and mail with the AI model: the disclosure text is truncated ("including...") with no way to read the rest before pressing Allow. | 12b, 79, 82 |
| 8 | Medium | Data room: files show "Reading..." with no way to start consent from the Data room itself. | 65, 66, 67 |
| 9 | Medium | Reply body: the quote and the user's text share one box; typing at the centre of the box lands inside the quoted text. Body card is short with blank lines on top. | 27, 28, 29 |
| 10 | Medium | "Save draft" gives no confirmation; Cancel dialog has Save draft and Discard draft but no "keep editing". | 30, 32 |
| 11 | Medium | Rename to blank text closes the alert with no message; failure feedback missing generally. | 119, 120, 121 |
| 12 | Medium | "Reconnect" and every Connect button open Settings at the top level, not at the relevant Integrations or Models screen. | 94, 95 |
| 13 | Medium | Record sheet is a short fixed-height sheet; "Add speech to text" pushes the Voice settings into it and the content is cut off after two rows. | 71, 72 |
| 14 | Medium | Accessibility Extra Large text: Home rows reflow badly (time on its own line, avatar and unread dot misaligned, 3-line preview), the account avatar shows "...", and the New agent colour row sits under the keyboard. | 89, 90, 91 |
| 15 | Medium | Usage: no time period; "Total tokens" shows a dash while input and output are 12 and 40. | 57 |
| 16 | Low | Sign-in screen: lower third of the screen is a different background colour after typing; the form sits at the top with empty space under it. | 114 |
| 17 | Low | Same data differs between surfaces: Finance page shows cash $1,533,221 and runway 23 mo; the Chief thread says $1,633,221 and 24.2 months (mock data, but check the source of both). | 60, 05 |
| 18 | Low | Sign out appears twice and styled differently (red in Settings, black in Account); neither confirms. | 50, 59, 107 |
| 19 | Low | Cap table empty state: "Connect Carta" is a tiny capsule jammed under the title. Inbox reconnect capsule is the same. | 64, 94 |
| 20 | Low | Artifacts list rows run edge to edge; every other list is an inset card. Artifact HTML page is blank for about a second with no loading indicator. | 99, 100 |
| 21 | Low | Inbox sticky section header overlaps the first row under the toolbar; during search the toolbar disappears and only an X remains. | 15, 42 |
| 22 | Low | Copy and labels: "Googlecalendar" provider name; "Add a name to create the agent." repeats the disabled button; "Agent page" offered when none exists; New agent uses X while New space uses Cancel; AI data sharing screen has only one row and no state; API key defaults to Amazon Bedrock. | 53, 46, 116, 48, 54, 97 |
| 23 | Low | Inbox filter icon does not change with the chosen account. | 36, 44 |
| 24 | Low | PDF preview on file detail shows a tiny page at the top of a large white box. | 67 |

## Findings confirmation (catalog "Code findings to verify")

| # | Result | Notes |
| --- | --- | --- |
| 1 | Not reproduced | Inbox and message scroll; Home scroll not reproduced. See above. Long-HTML case untested. |
| 2 | Confirmed | Defect 1. |
| 3, 4 | Not tested | Need streaming and long history. |
| 5 | Confirmed | Defect 3. |
| 6 | Confirmed | Defect 4. |
| 7 | Partly refuted | Default server does fail on a fresh install (confirmed). The server sheet does show the current host (refuted); the sign-in button does not. |
| 8 | Not tested | Push registration not observable in the Simulator. |
| 9, 10 | Not tested | No such approval in seed. |
| 11, 12, 22, 23 | Not tested | Recording not possible. |
| 13, 14, 15 | Partly | 14: no keyboard test, no Skip. The control flow stopped at "Stop the bot first" (defect 2). |
| 16 | Confirmed (rename) | Blank rename closes silently. Pin and archive failures not tried. |
| 17, 18 | Not tested | Copy, folder create not tried. |
| 19 | Confirmed | Save draft has no confirmation. Reconnect banner names the fix with a button that opens Settings top level. |
| 20, 21, 24, 25 | Not tested | |
| 26 | Not tested | |
| 27 | Partly confirmed | Reconnect opens Settings at top level. Stale pages after closing not tested. |
| 28 | Confirmed (inbox archive) | Other lists not tested. |
| 29, 30, 31, 33, 34, 35, 36, 37, 38, 39 | Not tested | |
| 32 | Refuted here | Cold start went white screen, spinner, Home with no Sign in flash (115-cold-1..5), on a fast local server. |
| 40 | Partly confirmed | Same filter icon for All and a single account. |
| 41, 42, 43, 44 | Not tested | |
| 45 | Confirmed | Notifications screen has no OS permission state. |
| 46 | Confirmed | Sign out twice, neither confirms. |
| 47, 48, 49 | Not tested | |
| 50 | Partly | Cap table empty state shows "Connect Carta" (Carta not connected in this seed). |
| 51 | Partly confirmed | Record sheet cuts Voice settings short (defect 13). Consent sheet not forced. |
| 52, 53, 54, 55 | Not tested | |
| 56 | Refuted | The space title does have a chevron (92). Team computer row exists. |
| 57 | Not tested | |
| 58 | Not tested | https alert not walked. The http alert works (109). |

Confirmed or partly confirmed: 2, 5, 6, 7 (part), 16, 19, 27 (part), 28, 40, 45, 46, 51 (part), plus new defects 2 (Team computer dead end), 5, 7, 14 and others not in the catalog. Refuted: 7 (part), 32, 56.

## Not walked (and why)

- A real model, streaming and tool approvals: the demo has no model, so there were no streaming replies, tool approval cards, mail draft cards, secret requests or MCP requests (stories 026 to 028, 030 to 038, 040 to 045).
- Microphone, speech and recording: dictation, call mute and interruption, meeting capture and everything after it (046 to 055, 077 to 087).
- Real Gmail or Calendar: unsubscribe, rules, send failures, Pub/Sub push (061 to 066, 068, 070, 072 to 075).
- Sign-up, reset, SSO, session expiry, https server: need email or an identity provider (002 to 005, 007, 008).
- Real Docker computer: control, Skip, I'm done, takeover (112 to 115).
- Share sheets, photo picker, push notifications, deep links, Face ID and the device keyboard: not available through Maestro in this setup.
- Hide amounts, delete space, delete account, disconnect model, create group, create space: avoided or not reached.
- A large HTML email and a long thread history: absent from the seed.
