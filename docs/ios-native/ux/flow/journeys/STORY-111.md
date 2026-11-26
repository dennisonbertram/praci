# Journey critique: Team computer (STORY-110, 111, 112, 115)

Evidence: `apps/ios/Sources/Praci/Computer/*.swift`, `Home/HomeScreen.swift`, catalog findings 13-15, 54-56, and `docs/ios-native/ux/topics/team-computer.md`. No device walk. M = measured from code, S = suspected, needs device walk. Invented data only.

**Verdict: acceptable** for open and wake (110, 115); **convoluted** for take control and type a code (111) and for answering a takeover request (112).

## 1. Friction scorecard

| Story | Ideal | Actual | Notes |
|---|---|---|---|
| 115 Open from Home | 2 | 2 | M. `HomeScreen.swift:224-228`. Minimal. But it opens the first bot's computer, not necessarily the right one (finding 56). |
| 110 Wake stopped computer | 2 | 2 | M. `ComputerModel.swift:77-80` boots once on open; the "Start computer" button (`ComputerScreen.swift:110`) is a retry for the same call. Minimal. |
| 111 Type a one-time code | 5 | 6 to 7 | M. Open, Take control (`:181`), tap field in the web view, find the keyboard icon at the left of a scrolling bar (`ComputerKeyBar.swift:18`), type, then Release control (`:171`), then Close. The keyboard never opens by itself (`@FocusState focused` starts false, `ComputerKeyBar.swift:13`). |
| 112 Takeover request | 4 | 5 to 6 | M. Nothing in the thread or push names the computer (finding 15, router has no computer target); user finds the thread menu, Open computer, Take control, log in, then "I'm done". |

- **Decisions**: In 112 the user chooses between Skip and I'm done, which is a real choice. In 111 the Ctrl toggle, Esc, Tab and four arrows are always shown (`ComputerKeyBar.swift:23-31`) although a login code needs none of them (S).
- **Re-entry**: none typed. In 112 the user must remember why they were sent (the thread does not say) (M, finding 15).
- **Confirmations**: none. Release has no confirm. Good.
- **Dead ends**: closing while in control does not release (finding 13, M: `ComputerModel.swift:138-141` only stops polling). Silent state: the agent stays blocked until the server times out. This is the worst friction in the set because the user believes they handed back.
- **Hesitations**:
  - After "Take control" the screen looks unchanged except the bottom buttons; no hint to tap the field then the keyboard icon (M).
  - "Skip" and "I'm done" appear only after taking control, and "Take control" is the only visible button before it (`ComputerScreen.swift:152-190`). A user who sees "Waiting for you" does not know that "I'm done" will appear (M for the code, S for confusion).
  - Status text "Waiting for you" appears only once the user holds control (`:144`); before that the line says "Not in use" or "<name> is driving" (`:146-147`), hiding that the agent is asking for help (M).
  - The buttons swap under the thumb when a request arrives while typing (topic edge case, S).

## 2. Take-away pass per screen

**Computer screen (`ComputerScreen.swift`)**
- Screen area: the point of the page. Keep.
- Status line (`:126-140`): one short line. Essential for the takeover case; it should lead, not follow, the controls.
- Key bar: eight buttons plus the keyboard icon. For the typical task (type a code or password) only the keyboard is needed. Esc, Tab, Ctrl and arrows are removable from the default view and could sit behind a long-press or an "More keys" disclosure (S).
- Bottom button: exactly one prominent button per state, which is good (Take control, Release control, or Skip plus I'm done). In the request state there are two buttons and the bordered Skip is correctly demoted (`:156-167`). Minor: "Release control" and the toolbar "Close" (`:42`) overlap in meaning; one releases, one does not (M).
- Toolbar Close duplicates the system back button on a pushed screen (route `.computer` is pushed via the nav stack, `AppShell.swift:24`). `closeComputer` just pops (`ComputerModel.swift:140`). It adds a second way out that behaves like back and does not release (M). Removing it removes the trap.

## 3. The simpler version

Type a login code (111):
1. Open the computer (Home row or thread menu).
2. Tap "Take control". The keyboard opens by itself and the screen is live.
3. Tap the field, type the code.
4. Tap "Release control" (or leave; leaving releases).

Takeover request (112):
1. The thread or the push shows "Priya's agent needs you on the computer" with one action "Open".
2. The computer opens already in control (or "Take control" pre-focused), status reads "Waiting for you".
3. Log in.
4. Tap "I'm done".

Changes: auto-focus the keyboard after control starts; release on leave; add a thread card and push target; show the request in the status before control; hide the extra keys behind a disclosure; drop Close.

## 4. Clarity issues

- Two names for the same screen: "Team computer" / "Private computer" depending on mode (`ComputerScreen.swift:60`), while the topic story calls it "the computer" and the menu "Open computer". Pick one noun in UI (S).
- "Take control" vs "Release control" are clear. "Skip" is ambiguous: skip what? It tells the agent the user could not do it (`ComputerReleaseReason.skipped`). "Can't do it" would be clearer, but that is new copy; keep Skip unless a walk shows confusion (S).
- "Not in use" while the agent is waiting for the user (M, see above).

## Proposals

- **JD-1** Closing keeps the lease (finding 13). Evidence: STORY-111, 113; `ComputerModel.swift:138-141`, `ComputerScreen.swift:48-49` (`.onDisappear` only stops polling). Proposal: release on leave when control is held (best-effort call), and drop the toolbar Close. Steps saved: 1 explicit release plus a hidden failure. Risk: leaving the app briefly (phone call) would release; so only release on pop, not on scenePhase. Size S. Device walk: y.
- **JD-2** Keyboard does not appear after Take control (finding 14). Evidence: `ComputerKeyBar.swift:13,18`. Proposal: focus the hidden field when control starts. Steps saved: 2 (find icon, tap it). Risk: keyboard covers the remote screen (finding 55 says the layout shrinks, M), so keep the icon as the hide toggle. Size S. Device walk: y.
- **JD-3** Takeover request has no thread card or push target (finding 15). Evidence: STORY-112; `App/NotificationRouter.swift` has no computer route. Proposal: add a `.computer(botID)` target for the push and one card in the thread. Steps saved: 2 to 3 (finding the thread menu). Risk: needs a server push payload; not verified. Size M. Device walk: y.
- **JD-4** Request state hidden until control. Evidence: `ComputerScreen.swift:144-147,152-155`. Proposal: show "Waiting for you" and the Skip / I'm done pair as soon as `takeoverRequested`, with Take control as the first action. Steps saved: 0 to 1 (removes hesitation). Risk: low. Size S. Device walk: y.
- **JD-5** Extra keys always visible. Evidence: `ComputerKeyBar.swift:23-31`. Proposal: keyboard icon only by default; Esc/Tab/Ctrl/arrows behind "More". Steps saved: 0 (reduces clutter). Risk: users who need arrows pay one tap. Size S. Device walk: y.
- **JD-6** Home row opens the first bot's computer (finding 56). Evidence: `HomeScreen.swift:224`. Proposal: one computer row per team computer, or open the one with a pending request. Steps saved: 0 to 3 for users whose first bot is not the one asking. Risk: needs the server's mapping of computer to bot, not verified. Size M. Device walk: y.
