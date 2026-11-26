# iOS visual review (2026-11-04)

Method: the `/ux-visual` stance applied to the native iOS app on one simulator (iPhone 17 Pro, iOS 26.3) against the demo stack, light and dark at the default text size, and light at `accessibility-extra-large`. Proposals only; no code was changed. The earlier board-based review is in `archive/`.

Surfaces captured: Home, Inbox, message, compose and reply, thread (with consent card), Settings, Account, Usage, Models and Connect a model, Integrations, Voice, Data room and file detail, Meetings and Record sheet, Team computer, Finance, Legal, Cap table, agent settings, New agent sheet. Screenshots are kept outside the repository; names below refer to those files. Not every surface was captured in every mode: dark mode covers Home, Inbox, message and thread; large text covers Home, Inbox, Settings, compose and New agent.

Severity: P1 a person would stumble, P2 visibly below excellent, P3 polish. Evidence is "observed" in the named screenshot unless stated.

## Proposals (top 15)

| # | Sev | Surface | Problem | Proposal | Screenshot |
|---|---|---|---|---|---|
| 1 | P1 | Thread consent card | Disclosure text is cut at four lines ("including...") with no way to read the rest before pressing Allow; tapping does nothing. | Remove the line limit on consent cards, or add "Read more" that opens the full text. | A05-sent, A07-after-scroll |
| 2 | P1 | Thread | Raw "This content isn't available in this version." card is the first item in a thread. | Hide unrenderable parts, or show a short neutral row with the message time only. | A01-thread |
| 3 | P1 | Inbox at large text | Sender, subject and preview each truncate hard ("Priya Pla...", "Quick questi..."); only three rows fit per screen. | Allow two lines for subject, drop the preview line at accessibility sizes, keep the time under the sender. | V-large-inbox |
| 4 | P1 | Compose at large text with keyboard | From, To, Cc and Subject fill the screen; the body field is hidden behind the keyboard and the From address is middle-truncated ("mock-fo...ple.test"). | Collapse From into the header row at large sizes and keep the body visible above the keyboard (header fields scroll away). | V-large-compose-kb |
| 5 | P2 | Cap table empty state | "Connect Carta" is a small pill about 28 pt tall, below the 44 pt target, and sits tight under the headline. | Use a full-width 50 pt button with 16 pt gap under the headline. | V-CapTable |
| 6 | P2 | Home at large text | Agent row shows the time on its own line between name and preview, so the preview looks detached from the name. | At accessibility sizes put the time on the same line as the preview, or after the name wrapped on line 2. | B04-home-large |
| 7 | P2 | From picker menu | Addresses break mid-word with a hyphen ("north-wind.ex-ample.test"). | Widen the menu or use a single-line, tail-truncated address with the account name as the label. | A12-from-picker |
| 8 | P2 | Thread composer | Composer pill is flush against the home indicator area with about 12 pt below; the "+" and mic circles are larger than the pill and make the row uneven. | Match the circle and pill heights (44 pt) and add 8 pt more bottom inset. | A01-thread |
| 9 | P2 | Models and Voice sheets | Content occupies the top quarter; the rest of the sheet is empty. | Use a medium detent for sheets with short content. | A32-models, A31-usage, A51-voice-settings |
| 10 | P2 | Data room | "Reading..." has no way to refresh or see why it is stuck; a failed file shows red text with a warning icon but no action. | Add a row action for stuck and failed files (Retry), shown only in those states. | V-dataroom, A40-dataroom-file |
| 11 | P2 | Data room file detail | PDF thumbnail renders the page at tiny scale (text unreadable) inside a large white card. | Crop the thumbnail to the content area or scale to fit width. | A40-dataroom-file |
| 12 | P2 | Settings | Server row shows only an address and looks like static text; the 17 pt row has no chevron or value affordance. | If it is changeable, add a chevron; if not, use secondary text color for the value. | A30-settings |
| 13 | P3 | Inbox | The "Search mail" bar floats over the last visible row and obscures it while scrolling; rows have no left unread alignment with section titles. | Reserve bottom inset equal to the bar height; align the unread dot with the section title margin. | A10-inbox |
| 14 | P3 | Team computer | Screen area is a large empty white card with "No live screen"; status "Not in use" is tiny and centered under it. | Shrink the empty state and place the status above the button as a single line of caption text. | V-computer |
| 15 | P3 | Dark mode | Cards and rows sit on near-black with very little separation (card #1c1c1c on #000); dividers almost disappear on the thread consent card. | Raise the card tone by one step or add a 1 pt hairline border in dark mode. | V-dark-home, V-dark-thread |

## Excellent as is

- Message view: clear subject, sender hierarchy and the single primary "Ask Inbox agent" button (A20-message, V-dark-message).
- Finance summary and chart: clear hierarchy and readable at default size (V-Finance).
- Legal list grouping and the segmented control (V-Legal).
- Native menus (New, Reply options), the Save/Discard prompt and the sign-out confirmation use system controls and read well.
- Draft saved and Archived-with-Undo toasts are concise.

## Not covered

Mail with attachments, error and offline states, permission-denied states, iPad sizes, and the remaining pages (Fundraising, Legal deadlines detail, artifacts, routines) were not captured in this run.
