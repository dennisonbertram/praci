# Inbox redundancy and information architecture critique

Critic R. Walked the live inbox read-only at 1440x900 (screens: `R-list.png`, `R-filter.png`, `R-hover.png`, `R-todo.png`, `R-help.png`, `R-dialog.png`; kept outside the repo). Catalog refs are story numbers from `docs/ux-paths/catalog.md` "Redundancy Candidates". No mail content is quoted.

## Duplicate Paths

1. **Search, three engines, one verb.** Sidebar "Search" box, the list's "Search mail" box, and the Inbox agent all find mail (`R-list.png`). The list box is Gmail-live; the agent uses `mail_search`/`mail_grep`; the sidebar box's scope is not visible from its label. Verdict: drift. Keep "Search mail" canonical for finding mail. Retitle or remove the sidebar box if it is only for navigation or chats. (catalog 002, 006, 046)
2. **Archive: row hover, dialog button, `e`.** Hover shows four icons (archive, mark read, mark important, mark noise) with no labels (`R-hover.png`); the dialog shows a labelled Archive (`R-dialog.png`); `e` is listed in help (`R-help.png`). Verdict: deliberate accelerators of one action; keep. The real problem is that the dialog has Mark read but not Mark important or Mark noise, so the same row actions are not equal in both places. (catalog 023, 026, 033)
3. **Open a message.** Click, Enter, `o`, deep link, prev/next chevrons and `j`/`k` in the dialog. Chevrons and `j`/`k` do the same job; both are shown (`R-dialog.png`, `R-help.png`). Verdict: deliberate, keep. Note `o` is not listed in the "?" help, which lists only Enter. (catalog 033, 034)
4. **Clear a narrowed list.** Six controls clear different parameter sets (catalog 010, 014, 017, 021). Not re-walked; confirmed from the catalog only. Verdict: drift. Pick one "reset view" control.
5. **Important toggle vs Filter menu.** The toolbar has an "Important" button and a Filter menu (`R-filter.png`). With triage on, the Filter menu has no "Important" item, so there is no duplicate on screen; with triage off, catalog 017/018 says a Gmail "Important" item appears. Same word, two mechanisms depending on state. Verdict: drift.
6. **Needs-me questions.** Needs reply group, Important toggle, To do card, agent (catalog 018, 025, 028, 046). Four routes; see Overlapping Features.
7. **Mark read/unread.** Row icon and dialog button only; no key (`R-help.png` lists none). Not a duplicate; a gap.

## Duplicate Information

1. **Unread signal repeated three ways.** Bold or dot per row (every visible row had a dot in `R-list.png`), the sidebar "Inbox" count (131), and the Unread filter. When most rows are unread the dot carries no information. Verdict: keep the sidebar count and the filter; the dot is only useful when most rows are read.
2. **Same issue in To do twice.** After expanding the card (`R-todo.png`), two items share the same title and differ only in due date and reason text. This is repeated information inside one card, not just across surfaces. Verdict: remove; collapse near-duplicate items from the same sender.
3. **To do reason line repeats the title.** Each To do item shows a title plus a second line of source and reason (`R-todo.png`); in several items the second line restates the title ("compute exhausted" under a "compute usage" title). Verdict: cut the second line to the source only.
4. **To do item and Needs reply row are not linked.** Catalog 028/048: an email can be both a to-do and a Needs reply row with no cross-reference. In this walk the To do items came from notification-style mail and Needs reply rows from people, so overlap was not observed on screen.
5. **Date repeated.** Row shows time or date (`R-list.png`); group headings "Today" and "Needs reply" sit above; Needs reply rows show full dates ("Oct 13") while the heading is not date-based. Rows under "Today" repeat the heading's day by showing only a time, which is correct and not redundant. Clean.
6. **Dialog header.** Sender name and address, then a separate "to" line, then the date at right (`R-dialog.png`). The "to" line is the user's own address and repeats the account; low value. Verdict: remove or show only for multi-recipient mail.
7. **Classification repeated.** Badges (Newsletter, Junk) on rows, category filters with matching names (`R-filter.png`: Newsletters), and Needs reply grouping. The badge text is singular, the filter plural: one concept, two names (see Hierarchy & IA).

## Overlapping Features

1. **To do card vs Needs reply group.** Both are lists of "things that need me", stacked at the top of the same column, both above the full list (`R-list.png`). To do items are model-derived tasks with due dates; Needs reply rows are emails. A user cannot tell which to start with. Verdict: remove or merge; at minimum show the card only when it has items that do not already exist as Needs reply rows.
2. **Important (toolbar) vs Needs reply vs "Needs attention" badge.** Four meanings of "important" (catalog 017, 018, 030); badge text `Needs attention` exists at `components/inbox/InboxRow.tsx:93` but was not visible in this walk. Verdict: one concept needed; rename.
3. **Gmail category tabs vs triage categories.** The Filter menu mixes Gmail tabs (Primary, Promotions, Social, Updates) and triage categories (Bills, Receipts, Scheduling, Newsletters, Security, Notifications, Personal) in one list with only a thin divider (`R-filter.png`). "Updates" vs "Notifications" and "Promotions" vs "Newsletters" overlap. Verdict: merge or hide one set.
4. **Filter menu vs Gmail operators.** Unread, Starred, Has attachment duplicate `is:unread`, `is:starred`, `has:attachment` (catalog 009, 020). Deliberate, keep as the discoverable form.
5. **Inbox agent vs list triage.** Catalog 025, 046. The agent panel is collapsed to a lone "Create Inbox agent" button in the right area (`R-list.png`), so the overlap is latent rather than visible.

## Hierarchy & IA

1. **Layout does not match the viewport.** At 1440 wide the list column is about 685 px (x 343 to 1028) and the right area from x 1060 to 1440 is blank except for a "Create Inbox agent" button floating mid-height (`R-list.png`). The primary content is narrow while about 26 percent of the screen is empty. Subjects truncate (`R-hover.png`: hover icons also cut the subject shorter). Verdict: widen the list or give the right area a real job (reading pane).
2. **To do card outranks the mail.** The card is the first thing under the toolbar, with a bordered, filled surface and red dates, about 180 px tall collapsed and 325 px expanded (`R-list.png`, `R-todo.png`), pushing the first mail row below 300 px. Needs reply, which is the more central inbox job, sits under it. Verdict: re-weight; put Needs reply first or make the card one line.
3. **Emphasis inflation.** Every row has a dot, many have badges, To do dates are red, and the sidebar carries a count (`R-list.png`). Nothing stands out because everything does.
4. **Hover icons are unlabeled and visually identical in weight.** Four icons, one destructive-looking (Mark noise), with no text (`R-hover.png`); 28 px apart. Verdict: add tooltips at least; consider keeping only Archive on the row.
5. **One concept, one name.** "Newsletter" badge vs "Newsletters" filter; "Needs reply" group vs "Needs attention" badge vs "Important" toggle; "Noise" action vs "Junk" badge (`R-list.png`, `R-hover.png`, `R-filter.png`). "Mark noise" produces something called "Junk" elsewhere. Verdict: pick Noise or Junk.
6. **Sidebar.** Global "Search", the Inbox row with unread count, a bot "Chief" with its latest message preview, Integrations, and the user (`R-list.png`). The Chief preview is useful; Integrations at the bottom is correctly demoted. The sidebar "Search" box occupying top position competes with the list's own search box. Clean otherwise.
7. **Keyboard help.** Concise and accurate to what it lists (`R-help.png`); omits `o` and the Important/mark shortcuts. Clean, with the one omission noted above.
8. **Dialog.** Title first, labelled actions, close and prev/next at top (`R-dialog.png`). Clean apart from the redundant "to" line.

## Counts

Duplicate Paths: 7 items (3 deliberate, 3 drift, 1 gap). Duplicate Information: 7 (5 problems, 1 clean, 1 partly clean). Overlapping Features: 5 (3 real, 2 deliberate or latent). Hierarchy & IA: 8 (5 problems, 3 clean).

## Not exercised

Hover only; no clicks on row actions, To do checkboxes, Create Inbox agent, or triage consent. Clear-list controls, search result view, and account tabs were not re-walked.
