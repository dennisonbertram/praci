# Journey: install to first agent reply

Stories merged: STORY-001 (sign in), STORY-005 (https server), STORY-006 (http LAN server), STORY-007 (back to default server), STORY-013 (first launch, no agents), STORY-014 (connect a model).

Evidence: Swift code in `apps/ios/Sources/Praci` and the steps in `docs/ios-native/ux/topics/sign-in-and-server.md` and `home-and-spaces.md`. No device walk was done. Each claim is tagged "measured from code" (M) or "suspected - needs device walk" (S). Persona: Tomas, an existing-account user on a real phone, company server `praci.example.test`, no agents yet, no model yet.

Verdict: **convoluted**. Sign-in itself is minimal. The route from a fresh install to the first reply is not: a default server that cannot work on a phone, a prefilled field the user must erase, an agent created before the model it needs, and a double "Connect a model".

## 1. Friction scorecard

Count of taps and inputs on the happy path (every tap, every field entry, every handoff to Safari). The catalog "Ideal" figures are STORY-005: 7, STORY-013: 3, STORY-014: 4.

| Phase | Actual | Story ideal | Evidence |
|---|---|---|---|
| A. Point at the server | 5 to 6: tap "Use a custom server", select and erase the prefilled `http://127.0.0.1:3100`, type address, Save | 3 | M `AuthenticationView.swift:32`, `ServerView.swift:28-38,71` (field is prefilled by `onAppear`) |
| B. Sign in | 5: Email field, type, Password field, type, "Sign in" | 5 (ideal 4 in STORY-001 omits field taps) | M `AuthenticationView.swift:116-146,151` |
| C. Create first agent | 4: "New agent", type name, "Create" (Role and Color skipped), thread opens | 3 | M `HomeScreen.swift:136-140`, `NewBotSheet.swift:22-35,48` |
| D. Return to Home | 1 (Back from the empty thread) | 0 | M `NewBotSheet` calls `onCreated`, `HomeScreen.swift:73-77` opens the thread |
| E. Connect a model (API key route) | 7 to 9: "Connect a model" on Home banner, "Connect a model" again on Models, "API key", paste key (Paste button), "Connect", sheet closes, then refresh Home | 4 | M `HomeScreen.swift:111-117,60-61`, `ModelsScreen.swift:24-29`, `ConnectModelSheet.swift:43-44,204-243` |
| E'. Connect a model (provider sign-in route) | 6 to 8: banner, Models list, lead "Sign in" button, "Copy code and open Safari", paste code in Safari, approve, return | 4 | M `ConnectModelSheet.swift:25-37,135-139` |
| F. Open the agent and send | 3: tap agent row, type, Send, plus a possible consent sheet (1 to 2 taps) | not in the stories | M `SendQueue.swift:175` (consent gate runs before the first send); S whether the sheet shows |

Total from install to first sent message: roughly 26 to 30 taps and inputs on a happy path, against a combined ideal of about 14. The first reply then needs no tap.

Decisions the user must make: server (yes, forced), email/password or SSO (only if the server offers SSO), agent name, Role (optional), Color (optional), connection route (sign-in vs API key vs local server), provider (picker defaults to the first one, so it is a decision only when it is wrong), consent (S). Of these, 90 percent of users would pick the same Role (blank), Color (first swatch) and route (the lead sign-in).

Re-entry of known data: the server address, the user's email, and the key are the only items typed; none is known to the app in advance. After "Change server" the email, password and name are cleared (`AuthenticationModel.swift:149-155`, M), so a user who typed their email before discovering the server problem retypes it. The server sheet also shows the current loopback address, which the user must delete (M `ServerView.swift:71`).

Confirmations guarding nothing destructive: the http alert "Use this server?" appears for `http://127.0.0.1:3100` and for "Use default server" even though loopback and LAN hosts are the only http hosts allowed (M `ServerView.swift:63-70`, STORY-007 steps 2-3). It is a real security notice for a LAN address; it is noise for the app's own default. The alert text variant "Change server" is dead code (catalog finding 58).

Dead ends:
1. Fresh install on a phone: the default is `http://127.0.0.1:3100` (M `ServerEndpoint.swift:24`), which cannot be reached, so the first screen is an error plus "Retry connection" (M `AuthenticationView.swift:99-103`). The way out is the small grey "Use a custom server" link at the bottom (M `AuthenticationView.swift:32-36`).
2. After "Create" the user sits in an empty thread, "Say hello to Ops." (M `ThreadScreen.swift:189-194`) that cannot answer. The thread has no "Connect a model" link anywhere (M: no match in `Thread/`). A message typed there is refused with "Not sent: <server message>" and the text is not put back (STORY-009 variation in `agent-thread.md`, M `PendingSendsView.swift:73-79`).
3. After the connect sheet closes, Home may still show "cannot reply until a model is connected" until a pull to refresh: the Home sheet has no `onDismiss` (M `HomeScreen.swift:48`) and `ConnectModelSheet.finished()` only reloads the sheet's own Models state (M `ConnectModelSheet.swift:77-82`). S whether `onAppear` also fires; STORY-014 and catalog finding 27 flag it.

Hesitations (first-time user):
- "Use a custom server" reads as an advanced option, yet it is the only way to make a phone install work (S).
- The server sheet shows `http://127.0.0.1:3100`, which looks like something to keep or edit, not to erase (S).
- The Home banner says "Your agent cannot reply until a model is connected" when there is no agent yet (M `HomeScreen.swift:113`, fallback string "Your agent"). Next to it the empty state offers "New agent". Two prompts, and the first one is not the one to do first.
- "Connect a model" appears twice in a row: the banner button opens the Models list, whose only row to act on is another "Connect a model" (M `HomeScreen.swift:60-61`, `ModelsScreen.swift:24-29`). The second tap does nothing the first could not have done.
- "Models", "Providers", "Connected", "Default model", "Thinking" are headings on the Models screen the user passes through on an empty account (M `ModelsScreen.swift:15,33,72`); the Providers section is empty on a fresh account.
- "Other ways" and "Local server" in the connect sheet assume the user knows what they are (M `ConnectModelSheet.swift:39,45`).
- Device-code sign-in needs three context switches (app, Safari, app) with a code to paste (M `ConnectModelSheet.swift:128-142`); S whether returning to the app reliably completes it.

## 2. Take-away pass per screen

1. Sign-in screen (`AuthenticationView.swift`).
   - Removable: the repeated "Praci" headline above the title (`AuthenticationView.swift:24-26`), because the title already names the page; low value, keep only if branding is required.
   - Primary action: "Sign in" is the one prominent button (M `AuthenticationView.swift:151,172`), but "Sign up" below it is also a full-width bordered button (`AuthenticationView.swift:160-163`), so a new user sees two similar weights. For a first-install screen this is arguably correct.
   - Deferrable: "Use a custom server" is always visible; fine for self-hosters, but it should lead with a meaningful label ("Server: praci.example.test" or the host actually in use) (STORY-007 notes the label never shows the current host).
   - Missing: when capabilities fail (the first state on a phone), the screen shows only "Retry connection" (M `AuthenticationView.swift:99-103`) and no hint that the address is the cause.
2. Server sheet (`ServerView.swift`).
   - Removable: the "Server address" section header repeats the accessibility label and the placeholder (`ServerView.swift:33,38`). Keep the field and the placeholder.
   - Primary action: "Save" in the toolbar. OK.
   - "Use default server" is a full row even when the current server is already the default; hide it unless the current host differs from the default.
   - The field is prefilled with the current address (`ServerView.swift:71`); the common first action is to replace it.
3. Home empty state (`HomeScreen.swift:104-154`).
   - Removable for a zero-agent account: the Inbox row (an empty mailbox with no integration yet), the whole "Pages" section (Finance, Legal, Cap table, Data room, Meetings) which is a long list of destinations that each need setup later. Show them after the first agent exists, or after the first reply.
   - Primary action: two competing calls to action ("Connect a model" prominent button, "New agent" plain). Only one is needed: "New agent" when there are none; "Connect a model" when there is one.
4. New agent sheet (`NewBotSheet.swift`).
   - Removable for the first agent: Role and Color (`NewBotSheet.swift:23-35`). Both are optional and deferrable to agent Settings. The footer "Add a name to create the agent." (line 31-33) repeats what a disabled Create already says; Create only enables on a name (every visible word is UI).
   - Primary action: "Create". OK.
5. Empty thread.
   - "Say hello to Ops." is the only text. If no model is connected the screen should say so once and offer "Connect a model" here.
6. Models screen (as reached from the banner).
   - Removable on the first visit: "Default model" (hidden until a credential exists, M line 12), the Providers header with no rows, and the screen itself. The banner should open the connect sheet directly.
7. Connect sheet (`ConnectModelSheet.swift`).
   - Primary: lead "Sign in" button with footer "Uses your X plan." (`ConnectModelSheet.swift:25-37`). OK; one primary.
   - The footer "Uses your X plan." and the button label `lead.signInLabel` carry the same provider name twice (S, label text not read).
   - "Other ways" group is a good disclosure; keep.

## 3. The simpler version

Target: about 15 taps from install to first sent message, with no Models list and no empty-thread dead end.

1. Launch. The App Store build points at the hosted server by default, so sign-in loads without error. (Dev or self-host builds keep the loopback default.)
2. Tap Email, type, tap Password, type (or autofill), tap Sign in.
3. Home shows one prompt: "New agent". The Inbox row and Pages are hidden until an agent exists.
4. Tap "New agent". The sheet has only Name, prefilled "Assistant", and Create. Tap Create.
5. The thread opens. Because no model is connected, the thread shows one inline "Connect a model" button in place of "Say hello" (and the banner is not needed on Home).
6. Tap it. The connect sheet opens directly (no Models list). Tap the lead sign-in button, finish in Safari, return.
7. The sheet closes and the thread reloads. The composer is live. Type, Send.

Concrete changes:
- Default to a reachable hosted origin in release builds (JA-1).
- Prefill nothing when the saved server is the default; show a clear (x) button when it is a custom value (JA-2).
- Replace the grey "Use a custom server" with a row that shows the current host (JA-3).
- Skip the Models list when the account has no credentials (JA-4) and reload Home and the thread when the sheet closes (JA-5).
- Move the first agent's Role and Color out of the create sheet (JA-6) and prefill the name (JA-7).
- Hide Inbox and Pages until the first agent exists (JA-8).
- Show "Connect a model" in the thread when `needsModel` (JA-9).
- Drop the http alert for the default or loopback address (JA-10).

## 4. Clarity issues

- "Use a custom server": the word "custom" hides that this is the normal path for a company install. Label by outcome: "Server" plus the host, or "Company server".
- "Connect a model" is a developer term. A new user connects "an AI account" or "AI" to the agent; M `HomeScreen.swift:113` says "model". Keep it consistent across Home, Models, sheet and Settings, but consider "Connect AI".
- "Providers", "Thinking", "Default model" are fine on a later screen and should not appear in the first-run path.
- "Local server" in the connect sheet needs a short hint of when to use it; the only text is "Only works on the same network." (M `ConnectModelSheet.swift:275`).
- "Your agent cannot reply until a model is connected." names an agent that does not exist when `bots` is empty (M `HomeScreen.swift:113`).
- Naming is otherwise consistent: "Sign in", "Create", "Save", "Cancel".

## Proposals

| Id | Problem and evidence | Proposal | Steps saved | Risk | Size | Device walk |
|---|---|---|---|---|---|---|
| JA-1 | Default server `http://127.0.0.1:3100` cannot work on a phone, so first launch is an error (M `ServerEndpoint.swift:24`, `AuthenticationView.swift:99-103`; catalog finding 7). | Release builds default to the hosted origin; debug builds keep loopback. If the hosted origin is not decided, show the server field first on a failed first connection. | 5 to 6 on every fresh install | Needs a product decision on the hosted URL | S | n |
| JA-2 | Server field is prefilled with the current address, which the user must erase (M `ServerView.swift:71`). | Leave the field empty (placeholder only) while the saved server equals the default; add a clear button otherwise. | 1 to 2 | Low | S | y |
| JA-3 | "Use a custom server" is a grey link that never shows the current host (M `AuthenticationView.swift:32-36`; STORY-007). | Show "Server: <host>" as a tappable row. | 0 (clarity) | Low | S | n |
| JA-4 | Banner opens the Models list, whose only action is another "Connect a model" (M `HomeScreen.swift:60-61`, `ModelsScreen.swift:24-29`). | When there are no credentials, the banner opens `ConnectModelSheet` directly. | 1 | Low | S | n |
| JA-5 | Closing the sheet does not reload Home; the banner may stay (M `HomeScreen.swift:48`, `ConnectModelSheet.swift:77-82`; catalog finding 27; STORY-014 step 5). | Add `onDismiss` on the Home sheet that calls `model.load`; also reload the open thread after connecting. | 1 (the pull) and removes a stall | Low | S | y |
| JA-6 | Role and Color are shown for the first agent though optional (M `NewBotSheet.swift:23-35`). | First-agent sheet shows only Name; Role and Color live in agent Settings. | 0 taps, 2 fewer fields | Low; Settings must expose them | S | n |
| JA-7 | The first agent needs a name typed. | Prefill "Assistant" (editable) or create with one tap from the empty state. | 1 to 2 | Low | S | n |
| JA-8 | A zero-agent Home shows Inbox and five Pages (M `HomeScreen.swift:119-130,191-231`). | Hide them until the first agent exists. | 0 taps; fewer elements | Medium; deep links and the Pages entry point change | M | y |
| JA-9 | After Create the user is in a thread that cannot answer, with no link to fix it, and the first message is refused (M `ThreadScreen.swift:189-194`, `PendingSendsView.swift:73-79`). | If `needsModel`, the empty thread shows "Connect a model" and opens the connect sheet; after connecting, it reloads in place. This also removes the Back tap. | 1 (Back) and removes a dead end | Low | M | y |
| JA-10 | The http alert appears for the default loopback address (M `ServerView.swift:63-70`, STORY-007). | Skip the alert when the host is loopback or equals the default; keep it for LAN. | 1 | Low | S | n |
| JA-11 | Banner reads "Your agent" when no agent exists (M `HomeScreen.swift:113`). | With no agents, show no banner; the empty state handles it (JA-9 covers the next step). | 0 (clarity) | Low | S | n |
| JA-12 | First send runs the AI consent gate before delivery (M `SendQueue.swift:175`; S whether a sheet shows on a new account). | Present the consent once, inside the connect flow, so the first message has no extra sheet. | 1 to 2 | Needs a legal/product check | M | y |
