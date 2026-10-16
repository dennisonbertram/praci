# J1: First look (STORY-030 "Overwhelmed first look", STORY-001 "Spot it in the default list")

Critic ID: J1. Live walk of the real inbox, read-only, at 1440x900, 1920x1080 and 390x844.
Screenshots (kept outside the repo): `J1-1440.png`, `J1-1920.png`, `J1-390.png`.
"Measured" means read from the live page with `getBoundingClientRect` / `scrollWidth` or counted from the DOM. "Suspected" means inferred from code or the catalog and not observed.

Test data note: the list held 139 rows (Needs reply 5, Today 42, Earlier 92). The sidebar badge showed a different, smaller number than the row count (measured; see Clarity Issues).

## Friction Scorecard

| Measure | Ideal | Actual | Evidence |
|---|---|---|---|
| Steps to know "how bad is it and where to start" (STORY-030) | 2 | Not reachable from the page. The user must scroll or ask the agent (4+ steps). | No per-group counts: group headings render only `{title}` (`InboxRow.tsx:52`). |
| Steps to open a known email (STORY-001) | 3 | 3 on a wide screen if the sender or subject is readable; 4+ on phone or when similar rows exist. | `J1-390.png`: subject text is 6-20 chars visible. |
| Decisions before first useful action | 1 (pick a row) | 3: "To do card or list?", "is Needs reply the same as the Important toggle?", "does the red dot mean anything?" | `J1-1440.png`, STORY-030 step 2. |
| Re-entry (same information twice) | 0 | 2: urgency is shown in the To do card (red "Today"/date) and again as the "Needs reply" section; "Needs attention" is a badge elsewhere. | `J1-1440.png`; `InboxRow.tsx:155`. |
| Confirmations | 0 | 0 | none seen |
| Dead ends | 0 | 1: the right pane is empty by default and offers only "Create Inbox agent" (no explanation of what it does). | `J1-1440.png`, `J1-1920.png`; `Shell.tsx:3890`. |
| Hesitations | 0 | 5 (see Take-away Pass) | below |

Measured first-screen load (what fits above the fold):

| Viewport | First row top (px) | Rows fully visible | Sender col (px) | Subject col (px) | Row width (px) | Subject chars visible (rows 1-12) |
|---|---|---|---|---|---|---|
| 1440x900 | 288 | 12 | 140 | 400 | 684 | 47-62 incl. snippet |
| 1920x1080 | 403 | 14 | 180 | 840 | 1164 | 95-206 incl. snippet |
| 390x844 | 400 | 8 | 96 | 118 | 358 | 5-20 incl. snippet |

Other measured facts:
- 130 of 139 rows (94%) carry an unread dot. The dot distinguishes almost nothing.
- 63 of 139 rows (45%) carry a badge: Junk 30, Newsletter 20, Needs attention 13.
- The sender name was cut off (ellipsis) in 9 of the first 40 rows at 1440, 4 of 40 at 1920, 15 of 40 at 390.
- Subject-plus-snippet was cut off in 40 of 40 rows at 1440 and 390, and 37 of 40 at 1920. A row is a single 44px line, so the reason it matters is never visible.
- Position of "Earlier" heading: 2466px down the page at 1440 (about 2.7 screens). 92 of 139 rows are under it.
- The To do card takes about 177px of the 1440 first screen (two items, "3 more") and about 250px on the phone (two items wrap onto two lines each), pushing the first mail row to y=288 / y=400.

## Take-away Pass

Screen: Inbox list, first view.

| Element | If removed, can the user still succeed? | Verdict |
|---|---|---|
| Unread dot (`InboxRow.tsx:130-134`) | Yes in this inbox: it appears on 94% of rows, so it does not separate anything. It also takes an 8px column plus a 12px gap on every row. | Removable when most rows are unread; better, show an "unread" signal only for the minority (read rows dimmed, unread normal). Measured. |
| Badges "Junk" / "Newsletter" (`InboxRow.tsx:155-161`) | Yes for finding mail. They steal 80-90px of subject width on 36% of rows (measured from `J1-1440.png`, subject ends earlier on badged rows) while the user is reading the subject. | Defer: show only for mail the user should skip, or group them under one collapsed "Newsletters and junk" heading. |
| "Needs attention" badge | Hidden in Needs reply, shown elsewhere (13 rows). Two different words ("Needs reply" section, "Needs attention" badge, "Important" toggle) for overlapping ideas. | Merge to one concept. |
| "Important" toggle (`Inbox.tsx:459`) | Not needed to start. It is the loudest control in the header (filled when pressed, text button next to two icon buttons). | Demote to the filter menu, or rename (see Clarity). |
| Compose pencil, Filter icon, Search | Compose is not part of "read the list". Filter has no label until used. | Keep; Compose is fine as a quiet icon. Filter is acceptable. |
| Empty right pane with "Create Inbox agent" (1440 and 1920 only) | Yes. At 1440 it is a 380px column that is blank except for one button; at 1920 it is a 380px blank column beside a list that is 1164px wide with lines cut off. | Collapse by default until the user asks, or show real content (a summary). Measured from `J1-1440.png`, `J1-1920.png`. |
| Group headings (12px, grey) (`InboxRow.tsx:52`) | Needed, but too quiet: they are the only structure on a 139-row page. | Keep, add counts, make them stronger than rows, not weaker. |
| Row hover icons (4 icons) | Fine: hidden until hover/focus. Already deferred. | Minimal. |
| Time column | Needed. Missing year and weekday is a clarity issue, not removal. | Keep. |

Hierarchy matches importance? No:
- The most prominent element on every row is the sender in white (unread) and everything else grey. Because 94% are unread, white is the default, so the eye gets no ranking at all (`J1-1440.png`).
- The To do card is the largest block on screen (177px) and sits above the list, but its items are not clickable mail; the user cannot tell from the layout whether those items come from the mail below (`J1-1440.png`).
- Red "Today"/"Oct 11" dates in the To do card are the only color on the page except warning badges, so the page's strongest signal is a to-do due date, not "which mail do I need to answer".

One primary action? There is none and there should not be one; the primary act is "open a row". The nearest thing to a primary button is "Important" (filled), which is the wrong thing to emphasise (`J1-1440.png`).

Stated twice:
- Urgency: To do card due date and Needs reply section (both say "this needs you").
- Sender and subject: row and dialog header (STORY-001 edge case). That repeat is expected.
- "Newsletter" badge and the Earlier/Today grouping do not conflict, but a newsletter appears in the date groups instead of one place.

Hesitations found (walking cold at 1440):
1. "Is the To do card part of my inbox or a separate thing?" (no link between a to-do and its mail row).
2. "Why does this row have 'Junk' on it if it is in my inbox?" (badge states a conclusion without an action).
3. "Is 'Needs reply' the same as 'Important'?"
4. "Everything looks unread, so which do I read first?"
5. "What is the blank panel on the right for?"

Density verdict at each width:
- 1440: the list column is only 684px because the sidebar (315px) and the empty agent panel (380px) take 48% of the width. Subject plus snippet get 400px, enough for 47-62 characters, so the snippet (which is the reason the mail matters) is almost never visible.
- 1920: the list is comfortable (95-206 characters), but the same agent panel stays blank and there is no extra information shown per row. The extra width buys longer snippets only.
- 390: 5-20 characters of subject-plus-snippet, 96px sender. One-line rows cannot answer "what is this about". Measured and visible in `J1-390.png`.

## The Simpler Version

Numbered ideal steps, cold start:
1. Land on Inbox. The first thing visible is a single line of orientation per group, for example the heading "Needs reply" with the count of rows, then the first row.
2. Read the first row: who, what, and why it matters on two lines.
3. Open it, or scroll to the next group.

Concrete changes:

1. **Add a group count and make headings the scan anchors** (`InboxRow.tsx:52`, `Inbox.tsx:645-666`). Pass `rows.length` next to the title, e.g. "Needs reply 5". Raise heading weight from `text-xs text-muted-foreground` to `text-sm text-foreground`. This answers "how bad is it, where do I start" with no new surface (STORY-030 step 1). Suspected benefit; not tested with users.
2. **Use two lines per row on narrow widths and show the existing `reason`** (`InboxRow.tsx:128`, `MailRow.reason` in `packages/contracts/src/inbox.ts:65`). Line 1: sender, time. Line 2: subject. Show `reason` (already in the data) as a quiet third piece for Needs reply rows instead of the snippet. This is the one change that moves "why it matters" into view. Row height rises from 44px to about 60px, so keep one line at 1920. Suspected; `reason` is null until triaged.
3. **Stop showing the unread dot when most rows are unread** (`InboxRow.tsx:130-134`). Rule: render the dot only for the minority state (if more than 50% of the loaded rows are unread, mark the read rows instead, by dimming). This removes an 8px column and the noise measured at 130 of 139 rows. Needs a prop passed from the list.
4. **Move Newsletter and Junk rows into one collapsed group** at the bottom of Today/Earlier (`Inbox.tsx:656-666`, badge at `InboxRow.tsx:155`). Their 50 rows (36%) then stop competing, and the badge column goes away. Suspected; behavior with the category filter needs checking.
5. **Collapse the empty agent panel when no agent exists** (`Shell.tsx:3855-3895`). Show the panel only after the user clicks the existing "Show Inbox agent" button (`Inbox.tsx:538-545`) or when an agent exists. This returns 380px (26% of 1440) to the list. The phone already does this (`Shell.tsx:442-444`).
6. **Demote "Important"** (`Inbox.tsx:459`): it is the only filled-looking text button in the header. Put it in the Filter menu or make it an icon, so the header reads "Inbox, Search, Filter, Compose".
7. **Compact the To do card to one line when closed** (`TodoCard.tsx:50-57`). Show "To do 5" with the first item, expand on click. Today it costs 177px (1440) and about 250px (phone) before any mail.
8. **Add an attachment icon to the row** (the field does not exist in `MailRow`, `inbox.ts:53-70`; needs an API addition). Left as a note; this is outside the first-look scope, but STORY-001's edge case (cannot tell two rows apart) depends on it.

Already minimal (leave as is):
- The row grid and truncation behaviour are correct and consistent (`InboxRow.tsx:128`).
- Hover-only row actions (`InboxRow.tsx:184`): good deferral.
- Search placeholder "Search mail" is plain.
- Phone: agent panel starts collapsed and the page reflows to one column (`J1-390.png`). Note for testers: resizing a desktop window to phone width without a reload leaves the panel open and covering the list, because the collapsed state is read once at mount (`Shell.tsx:443-445`). I hit this myself in the first pass; a real phone load is fine.

## Clarity Issues

1. **"Important" (header toggle) vs "Needs reply" (section) vs "Needs attention" (badge).** Three names for overlapping ideas on one screen (`J1-1440.png`; `Inbox.tsx:459`, `InboxRow.tsx:155`, `Inbox.tsx:645`). The toggle label says nothing about what it filters to.
2. **Badges state a verdict with no reason.** "Junk" on a row inside the inbox invites the question "why is it here, and may I delete it?". A badge should say what to do or be dropped (`InboxRow.tsx:155`).
3. **Dates have no year and no weekday** ("Oct 13"). Measured in `J1-1440.png`. For mail older than a year this is ambiguous (STORY-001 edge case).
4. **Sidebar count differs from the list size** (the sidebar badge was lower than the 139 rows shown, measured). The sidebar number reads as "unread" (its accessible name is "Inbox N unread"), while the page does not say what the number means, and 130 rows have a dot, which does not match either figure. Counts that disagree make the page feel untrustworthy.
5. **The red To do due labels** ("Today", a date) use destructive color for ordinary dates, so red signals "overdue or urgent" for everything, including items due today (`J1-1440.png`).
6. **The blank right panel with "Create Inbox agent"** does not say what an Inbox agent is. A first-time user sees a button with no context (`Shell.tsx:3890`; `J1-1920.png`).
7. **Truncated senders** (e.g. a "<Company> Workspa…" style name, cut before the identifying part) hide the part that identifies the source at 1440 (9 of 40 rows). The sender column is a fixed 140px (`InboxRow.tsx:128`).
8. **No account label on rows.** `MailRow.connectionId` exists, but a row does not say which account it belongs to unless the user switches the account tabs. With one account connected this is fine; with several, the first look cannot answer "which inbox is this from" (suspected, not exercised because only one account is visible in the walk).

## Verdict

**acceptable** leaning **convoluted** on narrow widths. The list mechanics are clean and consistent, but the first look fails the stated goal in STORY-030 (no summary, no counts, no ranking because 94% of rows are unread), shows the "why it matters" field for no row, and wastes 26% of a 1440 screen on an empty panel. On the phone the single-line row leaves 5-20 characters of subject.

Not exercised (read-only walk): row actions, To do checkboxes, Create Inbox agent, opening a message dialog.
