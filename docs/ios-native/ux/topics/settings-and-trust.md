# UX stories: Settings and trust

Status: written from the built SwiftUI code in `apps/ios/Sources/Praci` (Settings/, Thread/Approvals/ConnectCardView.swift, Shared/ConsentSheet.swift, App/NotificationRouter.swift, App/Route.swift). Nothing was run on a device or simulator, so every step says what the code does, not what was observed. All people, addresses and figures are invented. Paths are relative to `apps/ios/Sources/Praci`.

Code facts that shape these stories:

- Settings is a sheet over Home (`app.showingSettings`) with the single toolbar control "Done" (xmark). Rows in order: profile row (name, "Account"), Models, Voice, Integrations, AI data sharing, Allowed without asking, then Hide amounts, Appearance, Notifications, Usage, Archived agents, Sign out.
- The Integrations screen has no rename and shows no email address for an account. A connection shows only `displayName` and the app name (or "Needs reconnecting"). Agent access is one switch, "Allow writes". There is no per-agent access control on iOS.
- Sign out appears twice (Settings list "Sign out", Account "Sign out") and neither asks for confirmation.
- Notifications has no row for iOS system permission, and no link to iOS Settings. The system permission prompt is requested at launch.
- Hide amounts and Notifications are saved on the server; Appearance is stored only on this device.

---

## STORY-001: Check what Settings currently says and close it
**Type**: short
**Topic**: Settings and trust
**Persona**: Priya Nair, solo founder with a hosted model connected
**Goal**: See her name, then get back to Home.
**Preconditions**: Signed in, one space.
**Ideal path**: 2 (open Settings, read, Done). The gear opens it and "Done" closes it.
**Alternate paths**: The thread toolbar menu has "Settings", but for a bot it opens the bot's settings, not this sheet (see Manage/BotSettingsScreen). The Integrations screen can also be reached from an agent's "Connect" card (STORY-005). Account is reachable from the profile row only.

### Steps
1. Tap the gear on Home → the Settings sheet opens; a spinner shows until `me` loads, then the list appears.
2. Read the profile row ("Priya Nair" with initials, "Account" under it) → the list continues down to "Sign out".
3. Tap "Done" → the sheet closes onto Home.

### Variations
- `me` fails: the whole sheet shows the failure state with Retry; "Done" is still available.
- Dark appearance already chosen: `onAppear` re-applies the stored choice to every window.

### Edge Cases
- The Settings sheet is reopened after changing a value on another device: the list reloads on open, so Hide amounts follows the server.

---

## STORY-002: Switch the default model and its thinking level
**Type**: medium
**Topic**: Settings and trust
**Persona**: Marcus Webb, founder who cares about cost
**Goal**: Move agents to a cheaper model and lower the thinking level.
**Preconditions**: Two providers connected (for example "OpenRouter" and "Anthropic"), one is the default.
**Ideal path**: 4 (Models, Model row, pick a model, optional Thinking menu).
**Alternate paths**: none found. The model chooser lists only models of connected providers; connecting another provider is a separate path (STORY-003).

### Steps
1. Settings → Models → the "Default model" section shows "Model" with the current model name.
2. Tap "Model" → a searchable list of models of connected providers, each showing its provider name.
3. Type "mini" in the search field → the list narrows by label.
4. Tap a model → it becomes the default, the list pops back, and the Model row shows the new name.
5. Open the "Thinking" menu (only shown if that model has thinking levels) → pick "Low".

### Variations
- A model with no thinking levels: the Thinking row is hidden.
- Choosing a model resets thinking to the server default (`thinking: nil` is sent).

### Edge Cases
- Saving fails: the error appears as the footer of the "Default model" section; the list does not roll back visibly until the next load.
- No default credential has a model id: the whole "Default model" section is absent and only Providers shows.

---

## STORY-003: Connect a first model from the Home banner
**Type**: medium
**Topic**: Settings and trust
**Persona**: New founder, no model connected
**Goal**: Make agents able to answer.
**Preconditions**: Signed in, `needsModel` is true.
**Ideal path**: 3 (banner button, sign in with the lead provider, approve in the browser).
**Alternate paths**: Settings → Models → "Connect a model" opens the same sheet. Legal's "needs a model" prompt also leads here.

### Steps
1. Tap "Connect a model" on Home → the "Connect a model" sheet opens with a large lead button (the provider's sign-in label) and "Uses your <provider> plan."
2. Tap the lead button → the provider screen shows a code and "Copy code and open Safari", or "Open Safari" then a "Code" field and "Continue" depending on the provider.
3. Approve in Safari, return, paste the code, tap "Continue" → "Waiting for approval", then the sheet closes and the banner goes away.

### Variations
- "Other ways": "More sign-in options" (only if several), "API key" (Provider picker, key field with "Paste", "Connect"), "Local server" (address field, "Find models", model picker, "Connect"; footer "Only works on the same network.").
- Failure on the sign-in screen shows the message and "Try again". "Cancel" ends the wait.

### Edge Cases
- Local server on another network: "Find models" fails with an inline error; nothing is saved.
- Closing the sheet with the xmark mid-flow: nothing is connected; the banner stays.

---

## STORY-004: Replace and remove a provider key
**Type**: short
**Topic**: Settings and trust
**Persona**: Marcus Webb
**Goal**: Rotate an API key, then disconnect an unused provider.
**Preconditions**: A key-based provider is connected.
**Ideal path**: 3 for rotating (provider row, paste key, Save key); 2 for removing (provider row, Disconnect, confirm = 3).
**Alternate paths**: none found.

### Steps
1. Settings → Models → tap the provider row (label, value "Connected") → a form with Status, an "API key" field and "Save key".
2. Paste the new key → "Save key" enables; tap it → the field clears on success.
3. Tap "Disconnect" → dialog "Disconnect <label>?" → confirm → the screen pops and the row is gone.

### Variations
- Providers that do not take keys (sign-in plans) hide the key section and show only Status and Disconnect.

### Edge Cases
- Disconnecting the default model's provider: the "Default model" section disappears if no default remains, and `needsModel` makes the Home banner return on next load (not verified).
- A wrong key: the error shows under the key field.

---

## STORY-005: Connect Calendar when an agent asks for it
**Type**: medium
**Topic**: Settings and trust
**Persona**: Priya Nair
**Goal**: Let the Scheduling agent read her calendar.
**Preconditions**: A thread shows a "Connect" card for Google Calendar.
**Ideal path**: 3 (Connect on the card, Add, approve in Safari). Tapping "Connect" opens Integrations, so there is one extra tap to "Add".
**Alternate paths**: Settings → Integrations → Available → "Add". The card and the Settings list are the same screen, shown twice (sheet vs pushed).

### Steps
1. In the thread, tap "Connect" on the Google Calendar card → a sheet opens with Integrations and a "Done" button.
2. In "Available", tap "Add" next to Google Calendar → Safari opens the provider page; the list shows "Connecting Google Calendar" with a spinner and "Cancel"; all other "Add" buttons are disabled.
3. Approve in Safari, return to the app → within about two seconds of finishing, the row moves to "Connected".
4. Tap "Done" → the sheet closes and the thread refreshes; the card shows "Connected".

### Variations
- The Available list shows six entries and a "Show more" button.
- The user taps "Cancel" while connecting: the pending connection is revoked and the list reloads.

### Edge Cases
- Never finishing sign-in: polling runs every 2 s for 5 minutes, then shows "Sign-in did not finish. Try again." and revokes the pending connection.
- Leaving the screen while connecting cancels the pending connection (`onDisappear`).
- The provider reports an error: the message appears at the top of the list.

---

## STORY-006: Review a connected account, allow writes, then reconnect it
**Type**: medium
**Topic**: Settings and trust
**Persona**: Priya Nair
**Goal**: Let bots send mail from her work Gmail, knowing each send still needs her approval.
**Preconditions**: A Gmail connection named "priya@northwind.example" is connected, read only.
**Ideal path**: 3 (Integrations, the account row, Allow writes plus confirm = 4).
**Alternate paths**: Writes can be gated per tool through "Allowed without asking" (STORY-008). An agent's mail approval card also controls single sends.

### Steps
1. Settings → Integrations → "Connected" → tap "priya@northwind.example" → detail with Account, Access "Read only".
2. Turn on "Allow writes" → alert "Allow writes to priya@northwind.example?" with "Bots will be able to ask to send or change things. You still approve each one."
3. Tap "Allow" → Access becomes "Read and write"; the footer reads "Bots can ask to send or change things. You approve each one."
4. Later the row shows "Needs reconnecting" in red; open it and tap "Reconnect" → Safari opens, the screen pops, and the account is replaced when sign-in completes.

### Variations
- Turning writes off applies at once with no alert.
- "Remove" asks "Remove <name>?" with "Bots lose access to this account. You can add it again later."

### Edge Cases
- Rename: not available on iOS. The only name is the account's `displayName`.
- Two accounts of the same app (work and personal) look alike unless their names differ; the list shows the app name as the subtitle for both.
- No per-agent access: writes are per account, for all agents.

---

## STORY-007: Withdraw AI data sharing, then recover a paused agent
**Type**: long
**Topic**: Settings and trust
**Persona**: Marcus Webb, privacy-conscious
**Goal**: Stop sending recordings to a voice provider, and understand why agents stopped when he switched model sharing off.
**Preconditions**: Consent was given for a model provider and a voice provider.
**Ideal path**: 3 (AI data sharing, switch off, done). Re-allowing is 3 (switch on, Allow in sheet).
**Alternate paths**: The same consent sheet appears the first time an agent run needs a recipient (`app.consent.ensure`), so granting is available inside the thread flow and in Settings.

### Steps
1. Settings → AI data sharing → sections "Messages and attachments", "Recordings and spoken text", "Summaries and memories", each with a switch per recipient and a detail line.
2. Switch off the voice provider → consent is revoked at once; no confirmation.
3. Switch off the model provider → the footer under that section reads "Agents are paused until <provider> is on."
4. Go back to a thread and send a message → the consent sheet appears for the paused recipient ("Allow", "Not now", "Privacy details").
5. Tap "Not now" → the message is not sent.
6. Return to AI data sharing, switch the model provider on → the consent sheet opens with the disclosure text; tap "Allow" → the switch turns on.

### Variations
- "Privacy details" at the bottom opens the privacy page in the browser.
- Cancelling the consent sheet from Settings leaves the switch off.

### Edge Cases
- Revoke fails: the error shows in the last section; the switch value follows the server state after the next load.
- A section with no recipients is not shown at all.

---

## STORY-008: Add an approval rule and stop asking for a trusted action
**Type**: medium
**Topic**: Settings and trust
**Persona**: Marcus Webb
**Goal**: Let agents archive mail without asking, but block posting to social sites.
**Preconditions**: At least one connector has been used; no rules yet.
**Ideal path**: 4 (Allowed without asking, add, name and action, Save).
**Alternate paths**: Approving a card in the thread covers one case; "Always allow" style choices on cards may create rules (see the approvals topic). Rules can be edited here by changing a row's menu.

### Steps
1. Settings → "Allowed without asking" → the screen titled "Approval rules" shows the "Review actions automatically" switch and either rules or the empty state "No rules".
2. Tap "Add rule" (plus) → a half-height sheet with "Applies to" (Tool, Connector, Category, Site), a "Name" field, and "Action" (Allow, Ask, Block).
3. Choose "Category", type "archive mail", Action "Allow" → "Save" enables once the name is not blank.
4. Tap "Save" → the sheet closes and the rule appears with its kind as the subtitle and "Allow" on the right.
5. Add a second rule: "Site", "x.example", "Block".
6. Tap the right-hand value on a row → a menu with Allow, Ask, Block changes it in place.

### Variations
- Swipe a row, "Remove" → deleted at once, no confirmation.
- "Review actions automatically" is disabled when the server has no checker.

### Edge Cases
- Same name and kind as an existing rule: the call replaces its action (one `set` call).
- Footer reads "Background runs always ask before they send, change or run anything, except mail changes you always allowed." when there is no error. This is the only explanation of how rules apply to scheduled runs.
- The kind is shown as typed, not validated; a typo creates a rule that never matches.

---

## STORY-009: Choose which alerts reach the phone
**Type**: short
**Topic**: Settings and trust
**Persona**: Priya Nair
**Goal**: Get told when an agent needs her, not when it finishes.
**Preconditions**: A phone is registered on the server for this user.
**Ideal path**: 3 (Settings, Notifications, switch off Finishes).
**Alternate paths**: iOS system settings for the app. There is no link to it from this screen and no row showing whether iOS permission was granted.

### Steps
1. Settings → Notifications → "Tell me when an agent": Finishes, Needs help, Needs takeover.
2. Turn off "Finishes" → the switch flips at once; the server answer replaces it.
3. Read "Send to" → "Phone" (and "iMessage" if available). The section is hidden when the server reports neither.

### Variations
- Turning off "Phone": no push reaches the device even when iOS permission is on.

### Edge Cases
- Server refuses: the switch returns to its old value and the error appears in a red section.
- Push token registration is not wired up yet (`NotificationRouter.didRegister` is unused), so on a fresh install the server may report no phone and the "Send to" section stays hidden (verify).
- If the user refused the iOS permission prompt at launch, nothing in the app says so.

---

## STORY-010: Tap a push and land in the right thread
**Type**: medium
**Topic**: Settings and trust
**Persona**: Marcus Webb
**Goal**: Open the thread an agent pinged him from, in the correct space.
**Preconditions**: Two spaces ("Northwind" active, "Side project"); a push carries a `botId` for a bot in "Side project".
**Ideal path**: 1 (tap the notification).
**Alternate paths**: `rakazo://open/bot/<id>` opens a bot thread but does not switch space; only push payloads carry `spaceId`.

### Steps
1. The app is closed. Tap the notification → the app launches; the tap waits until the session is restored.
2. When startup finishes → the active space switches to "Side project", the navigation stack is cleared, and the bot's thread opens.

### Variations
- App open on that exact thread: the banner is suppressed (`showsBanner`).
- App open elsewhere: banner with sound; tapping it replaces the whole stack with the thread (loses the current screen).
- Group push: `groupId` wins over `botId`.
- Link-only payload with neither id: nothing opens.

### Edge Cases
- Signed out when tapped (after startup): the tap is dropped; the payload names no server, so it cannot be matched.
- A push for a space the user no longer belongs to: `spaceID` is set anyway; behavior depends on the server (verify).
- Deep link while signed out: `RootView.onOpenURL` appends to the path; `app.reset()` clears it on sign-out, but a link tapped while already signed out may show a screen after sign-in (verify).
- Unknown link such as `rakazo://sign-in` is ignored.

---

## STORY-011: Look at usage, hide amounts and set the look
**Type**: short
**Topic**: Settings and trust
**Persona**: Priya Nair, about to share her screen
**Goal**: Hide dollar amounts and use dark mode.
**Preconditions**: Signed in.
**Ideal path**: 3 (Hide amounts switch, Appearance menu, choose Dark).
**Alternate paths**: none found for the switch. Usage is read only.

### Steps
1. Settings → turn on "Hide amounts" → saved on the server; amounts in Finance are masked everywhere.
2. Tap "Appearance" (menu) → System, Light, Dark; choose "Dark" → every window changes at once.
3. Tap "Usage" → rows for Runs, Model calls, Input tokens, Output tokens, Total tokens; "—" where a value is missing.

### Variations
- Pull to refresh on Usage reloads it.

### Edge Cases
- Hide amounts fails: the switch returns and the message shows under the preferences section.
- Appearance is stored on this device only; a second device keeps its own choice.
- Usage shows tokens, not money, and there is no period selector.

---

## STORY-012: Restore an archived agent
**Type**: short
**Topic**: Settings and trust
**Persona**: Priya Nair
**Goal**: Bring back the Research agent she archived last week.
**Preconditions**: One archived bot ("Research") and one archived group.
**Ideal path**: 2 (Archived agents, Restore).
**Alternate paths**: Bot settings has an archive/restore action (Manage/BotSettingsScreen). The Home row menu and thread menu only archive, with an undo toast.

### Steps
1. Settings → Archived agents → list of bots and groups, newest first, each with "Archived Oct 28".
2. Tap "Restore" next to "Research" → the button disables, then the row disappears.
3. Close Settings → "Research" is back on Home (reloads on appear).

### Variations
- Empty list: "No archived agents".

### Edge Cases
- Restore fails: the error appears under the list and the row stays.
- Pressing Restore twice quickly: ignored while the first request runs.

---

## STORY-013: Change the password, then sign out
**Type**: medium
**Topic**: Settings and trust
**Persona**: Marcus Webb
**Goal**: Change the account password and sign out of a shared iPad-style handoff.
**Preconditions**: Password sign-in account with password change enabled.
**Ideal path**: 4 for the password (profile row, Change password, three fields, Save password); 1 for sign out.
**Alternate paths**: "Sign out" is both on the Settings list and on Account.

### Steps
1. Settings → profile row → Account shows initials, name, "Email" and, for password accounts, "Change password".
2. Tap "Change password" → "Current password", "New password", "Confirm new password"; footer "At least 8 characters".
3. Type a different confirmation → footer turns red "Passwords do not match" and "Save password" stays disabled.
4. Fix it and tap "Save password" → the screen pops, and Account shows the notice "Password changed". The person stays signed in on this device.
5. Tap "Sign out" → signs out at once with no confirmation; push is unregistered if a token was stored, the stack and space are cleared, and the sign-in screen shows.

### Variations
- SSO-only accounts: no Change password row.
- Unsent messages stay on disk under their owner.

### Edge Cases
- Wrong current password: the error shows in the footer.
- Session ended by the server while Settings is open: sign-in shows "Your session ended. Sign in again."
- A mistaken tap on "Sign out" has no confirmation or undo.

---

## STORY-014: Delete the account
**Type**: medium
**Topic**: Settings and trust
**Persona**: Marcus Webb, closing the account
**Goal**: Permanently delete the account.
**Preconditions**: Signed in; either a password account or an SSO account that can use an emailed code.
**Ideal path**: 4 (Account, Delete account, enter proof, Delete).
**Alternate paths**: none found.

### Steps
1. Settings → profile row → "Delete account" (red) → a sheet "Delete your account?" with "This permanently deletes your account, agents, conversations, memories, files, and saved connections. This cannot be undone."
2. Password accounts: enter "Current password".
3. Accounts without a password: a code is emailed on open ("We emailed a code to marcus@example.test"); paste it in "Code from email" (spaces and line breaks are stripped); "Resend code" is available.
4. Tap "Delete" → a spinner, then the sheet closes and the sign-in screen shows "Your account was deleted".

### Variations
- A server without account deletion: the sheet says "Account deletion is not available on this server." and Delete stays disabled.

### Edge Cases
- Wrong password or code: the error shows in the form and the account is kept.
- No extra "are you sure" step after typing the password; the typed proof is the confirmation.
- Push is unregistered before the delete call, so a failed delete leaves this device without push until it re-registers (verify).
