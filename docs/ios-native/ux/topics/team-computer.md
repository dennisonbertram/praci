# Topic: Team computer (native iOS app)

Read from `apps/ios` source for this pass; nothing was run on a device. Claims are "the code does X". Files: `Sources/Praci/Computer/ComputerScreen.swift`, `ComputerModel.swift`, `ComputerKeyBar.swift`, `ScreenWebView.swift`; `Packages/RakazoCore/Sources/RakazoCore/Computer/*` (session, screen URL, keyboard); entry points in `Home/HomeScreen.swift` and `Thread/ThreadScreen.swift`. All data below is invented.

How the screen works (shared by all stories):
- One screen, `ComputerScreen`, pushed on the stack as `Route.computer(botID:)`. Title is "Team computer", or "Private computer" when the server reports a dedicated computer. Only a trailing "Close" (xmark) button in the bar; the system back swipe also works.
- Layout, top to bottom: the desktop area (rounded card), one status line, then controls. No separate wake button on a sleeping computer.
- While the user does not hold control, the web view ignores touches and is hidden from VoiceOver. Watching is passive.
- Status is polled every 2 s, a heartbeat is sent every 60 s, and the screen URL (a one-hour link) is renewed after 50 minutes without reloading the page while the stream is the same. Polling stops when the screen disappears or the app leaves the foreground, and restarts when the app becomes active.
- Entry points: Home "Team computer" row (opens the computer of the first bot in the list, only when the space has at least one bot); thread top-right menu "Open computer" (that bot's own computer). The thread does not draw a takeover card for the computer, and the push router has no computer target.

## STORY-001: Watch the Finance agent work from the thread
**Type**: short
**Topic**: Team computer
**Persona**: Maya Okafor, solo founder of a bookkeeping startup
**Goal**: See what the Finance agent is doing on its desktop without touching it.
**Preconditions**: Signed in; a "Finance" agent with a running computer; its thread is open.
**Ideal path**: 3 - open the menu, choose Open computer, read the screen.
**Alternate paths**: (a) Home, "Team computer" row (always the first bot's computer, which may not be Finance); (b) a push or thread card is not available for this; (c) none other found.

### Steps
1. In the Finance thread tap the top-right "..." menu, then "Open computer" → Screen pushes; spinner until the first status arrives.
2. Wait about a second → Desktop loads in the card; status line reads "Finance is driving" (when the agent holds it) and only "Take control" is below.
3. Watch, then tap "Close" → Back to the thread; polling stops.

### Variations
- Agent is idle: status line reads "Not in use".
- Space has several bots: the Home row picks only the first bot, so the user cannot choose whose computer from Home.

### Edge Cases
- The user taps the desktop while watching: nothing happens (touches are off); no hint explains why other than the visible "Take control" button.
- Computer title says "Team computer" even when it is one agent's computer, and the status line is the only place the agent's name appears.

## STORY-002: Wake a stopped computer
**Type**: medium
**Topic**: Team computer
**Persona**: Tomas Lindqvist, operator of a two-person logistics software company
**Goal**: Open a computer that is stopped and see the desktop.
**Preconditions**: A bot whose computer state is stopped.
**Ideal path**: 2 - open computer (it starts by itself), read the screen.
**Alternate paths**: (a) tap "Start computer" in the placeholder if the auto start is not wanted to be waited on (it does the same call); (b) "Take control" on a suspended computer wakes it and takes control in one step; (c) none other.

### Steps
1. Open the computer from the thread menu → Placeholder briefly "Computer is stopped" with a "Start computer" button.
2. The app starts it once by itself (first load only) → Spinner and "Starting Team computer", status line "Starting"; "Take control" is disabled. The boot request waits up to 120 s.
3. Computer runs and a screen link is read → Desktop appears, status "Not in use".

### Variations
- State is suspended: placeholder reads "Computer is asleep" and "Take control to wake it."; status "Asleep". Nothing starts automatically.
- State is error: "Computer failed to start" with "Try again"; auto start happens once, so a second failure needs the button.
- Dedicated computer: copy changes to "Starting Private computer".

### Edge Cases
- Boot request times out or fails: the red line under the status shows the error text and the placeholder stays; "Start computer" is available to try again.
- Running but no screen link: "No live screen" with no button; the user can only wait, close, or leave and reopen.
- Leaving mid-boot: polling stops; the boot continues on the server; reopening reads the current state.

## STORY-003: Take control and type a one-time code
**Type**: medium
**Topic**: Team computer
**Persona**: Priya Raman, founder
**Goal**: Fill a login code into a vendor page on the agent's desktop.
**Preconditions**: Computer running, nobody else driving.
**Ideal path**: 5 - Take control, tap the field, Show keyboard, type, Release control.
**Alternate paths**: none found.

### Steps
1. Tap "Take control" → Request is sent; page reloads in control mode (the desktop reconnects); status "You are driving"; key bar appears above a "Release control" button.
2. Tap the code field on the desktop → Pointer click goes to the desktop.
3. Tap the keyboard icon in the key bar (label "Show keyboard") → iOS keyboard opens (it types into a hidden field); icon label becomes "Hide keyboard".
4. Type "482913" → Each character is sent as text to the desktop.
5. Tap "Tab" or the Return key on the keyboard → Moves or submits.
6. Tap "Hide keyboard", then "Release control" → Status returns to "Not in use" or the agent name; key bar disappears; desktop is view-only again.

### Variations
- Key bar buttons: Esc, Tab, Ctrl (toggle, lights up and clears after the next key), arrows Left, Down, Up, Right. Ctrl then a typed letter sends a control chord (for example select all).
- Backspace works through the hidden field, so there is no Backspace button.

### Edge Cases
- Take control fails: red error line under the status; still view-only.
- Keyboard does not show automatically after Take control; the user must find the small keyboard icon at the left of a scrolling row.
- The key bar scrolls sideways; on a narrow phone the arrows may be off screen.
- Dictation, paste, or autocorrect: autocorrection is off; a large paste is treated as an edit (behavior with long text not verified).
- Pointer-only control: no way to scroll the remote page except what the page itself supports (the web view's own scroll is off).

## STORY-004: Answer a takeover request from the agent
**Type**: medium
**Topic**: Team computer
**Persona**: Jordan Reyes, investor-relations lead
**Goal**: The agent needs the user to log in by hand; do it and hand back.
**Preconditions**: A run is waiting; the server marks a takeover request on the computer.
**Ideal path**: 4 - notice the request, Open computer, log in, "I'm done".
**Alternate paths**: (a) open from the thread menu "Open computer"; (b) Home "Team computer" row (only if this is the first bot); (c) tapping a notification does not open the computer (no computer target in the notification router).

### Steps
1. The thread shows the run as waiting for input; the user opens the thread menu → "Open computer" (nothing in the thread names the computer as the reason).
2. Computer screen opens → "Skip" and "I'm done" show only once the user holds control and the request is flagged (status "Waiting for you"). If the user does not yet hold control, the screen shows only "Take control"; after taking control the two buttons replace "Release control". Whether the server hands control over by itself is not verified.
3. Log in using the desktop and key bar → As in STORY-003.
4. Tap "I'm done" → Release with reason done; the agent continues; buttons switch back.

### Variations
- Tap "Skip" when the user cannot log in; the agent is told it was skipped.
- The request arrives while the screen is already open: the next poll (up to 2 s) switches the buttons without a reload.

### Edge Cases
- The user closes the screen without answering: nothing is sent; the agent keeps waiting.
- A takeover request arrives while the user is typing: the buttons change under the thumb.
- The agent stops waiting (timed out, answered elsewhere): next poll changes status; the screen shows normal controls.

## STORY-005: Release control without finishing
**Type**: short
**Topic**: Team computer
**Persona**: Tomas Lindqvist
**Goal**: Hand the computer back to the agent after poking at something.
**Preconditions**: The user holds control, no takeover requested.
**Ideal path**: 1 - "Release control".
**Alternate paths**: (a) "Close" without releasing keeps the lease; the server expires it (the app does not release on close, only stops polling); (b) none other.

### Steps
1. Tap "Release control" → Release call with no reason; desktop reloads view-only; key bar hidden.

### Variations
- Release then Take control again quickly: each toggle reloads the desktop page.

### Edge Cases
- Release fails: red line shows the error and control remains.
- Close with control held: the heartbeat stops; the user still appears to hold control until the lease times out; the app does not warn about this.

## STORY-006: Come back after leaving the app
**Type**: short
**Topic**: Team computer
**Persona**: Maya Okafor
**Goal**: Resume watching after a phone call.
**Preconditions**: Screen open, watching or driving.
**Ideal path**: 1 - return to the app.
**Alternate paths**: none found.

### Steps
1. Switch to another app, then return → Polling and heartbeat restart as the app becomes active; desktop reconnects if the link has been renewed or the stream was lost.

### Variations
- Away for over 50 minutes: a fresh screen link is read before the old one expires.

### Edge Cases
- Network drops: status reads fail; if status was never loaded, the screen shows "Can't connect" with "Try again"; if it was loaded, the last frame and controls remain with no offline notice.
- Desktop page fails to load (HTTP 400 or higher or a network error): placeholder "Couldn't load the desktop" with the error; the next poll reads a new link.
- Rotation: no orientation handling or landscape layout exists; the layout is a plain vertical stack, so landscape shrinks the desktop card, and rotation behavior with the hidden keyboard field is not verified.

## STORY-007: Open the first computer from Home
**Type**: short
**Topic**: Team computer
**Persona**: New user with three agents
**Goal**: Find "the Team computer" from Home.
**Preconditions**: Space has bots; "Team computer" is in the Pages group.
**Ideal path**: 2 - tap Team computer, read the screen.
**Alternate paths**: thread menu "Open computer" (per agent).

### Steps
1. On Home scroll to Pages and tap "Team computer" → Screen opens for the first bot in the list.
2. Read the status line → It names who is driving.

### Variations
- A space with no bots has no row at all.

### Edge Cases
- The row looks like a shared computer but opens whichever bot is first; the order of bots changes what it opens.
- If the first status read fails, "Can't connect" with "Try again" is shown.
