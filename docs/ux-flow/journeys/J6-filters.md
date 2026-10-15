# J6 - Filters, Gmail tabs, triage categories, Important, accounts

Stories: STORY-014, 016, 017, 018, 019. Walked read-only at 1440x900 on the live app (one connected account, triage ON). Screenshots (outside the repo): `J6-01-default`, `J6-02-menu`, `J6-10-Bills` (and 03-16 per-option), `J6-20..26` (Gmail filters one by one), `J6-31-menu-active`, `J6-32-important`.

Not exercised: STORY-019 (needs 2 accounts; the live account is single so no account tabs render - code read only, Inbox.tsx:501-522 region `accounts.length > 1`), STORY-016's triage-OFF variant (triage is ON), marking/archiving (forbidden). Archive-disabled-under-filter is from code only.

## Friction Scorecard

| Story | Ideal steps | Actual (measured) | Decisions | Re-entry | Dead ends / hesitations |
|---|---|---|---|---|---|
| 014 Unread, then back to all | 3 | 3 (open menu, Unread, open menu again, Clear = 4 clicks) | 1 of 14 menu items | none | "Clear" only exists inside the menu (J6-31) and is invisible until you reopen it. Re-clicking the checked Unread does not un-select it (code Inbox.tsx:~497 radio group, no toggle-off). |
| 016 Gmail tabs | 2 | 2 | 1 of 14 | none | "Primary/Promotions/Social/Updates" sit next to triage categories with no heading (J6-02); the same real mail appears in Promotions with Newsletter/Junk chips (J6-24). |
| 017 Categories | 5 | 5-6 | 1 of 14 per switch | menu reopen per category (1 radio, no multi-select) | Switching category = 2 clicks each; the Important toggle then silently drops the category (J6-32: Filter button returns to icon-only). |
| 018 Important | 1 | 1 click (toggle) | 0 | none | The toggle has no tooltip or definition. Result mixes a "Needs reply" group, "Today", "Earlier" and "Needs attention" chips (J6-32), so it is not obvious what "Important" means. |
| 019 One account | 3 | not measured | - | - | Code: tab state is not in the URL, so reload resets it while the filter survives. |

Reliability (measured): in the Gmail-backed filters, Unread and Primary each showed "Couldn't reach Gmail." with a Try again button after 25 s on the first attempt (`J6-20-Unread`, `J6-23-Primary`). A second Unread attempt worked (J6-31). Starred, Has attachment, Promotions, Social, Updates loaded in 2-4 s. This looks like transient Gmail latency (suspected), not a menu problem, but the error state shows no "Clear" so the user must open the menu to escape.

Decision count: 14 radio options in one list with 3 unlabeled groups. The user must decide which source of truth to use before knowing it (Gmail query, Gmail tab, or Rakazo's own sorting).

## Take-away Pass

Per screen (default inbox with menu open, J6-02):

- Filter button: icon-only when idle (aria "Filter"). Idle state gives no hint it holds 14 options. Active state is good: the label replaces the icon ("Unread", "Bills") with a secondary fill (J6-04, J6-10). Active filter IS visible when the menu is closed - this part works.
- Menu: no group headings, only two separators (Inbox.tsx:~478-495). The three groups (Gmail filters / Gmail tabs / Rakazo categories) are never named. If removed: nothing, grouping text would only help. Menu is about 128 px wide and "Has attachment" wraps onto two lines (J6-02, measured).
- "Clear" item at the bottom, only when active (J6-31). Needed, but hidden in the menu. A second "Clear filter" button exists in the empty state (Inbox.tsx:611) and "Clear search" elsewhere - three escape routes for one concept (code).
- Important toggle: placed left of Filter, looks like a peer of the menu items but is a separate system. When pressed, Filter is reset and vice versa (J6-32). Removable only if folded into the menu.
- Row chips "Needs attention", "Newsletter", "Junk" (InboxRow.tsx:93-96, J6-24, J6-32): these are the triage classification. The same classification exists as menu categories (Newsletters, Notifications, Bills...). Chips exist for only 4 values (attention, newsletter, spam, junk); Bills/Receipts/Scheduling/Security/Notifications/Personal have no chip (J6-10: Bills rows carry no chip). So the user cannot see why a row is in a category, and the badge vocabulary differs from the menu vocabulary ("Newsletter" chip vs "Newsletters" category; "Junk"/"Spam" chips have no category).
- Missing information: no count of results anywhere (J6-31 list has no "N unread"); no cue that Gmail filters read live Gmail while categories read the 14-day cache (STORY-015 catalog note, code).

## The Simpler Version

Ideal steps for "show only unread, then back to everything":
1. Click Filter, choose Unread (list narrows).
2. Click the same Filter button (now labeled "Unread") and choose it again, or click an "x" on the button, to return to everything.

Concrete changes (suspected value unless marked measured):

1. Add headings or sorted structure to the filter menu: "Status" (Unread, Starred, Has attachment), "Gmail tabs" (Primary, Promotions, Social, Updates), "Sorted by Rakazo" (Bills...Personal). Change at `apps/web/src/pages/Inbox.tsx:~478-505`; use `DropdownMenuLabel` next to each `DropdownMenuSeparator`. Widen `DropdownMenuContent` (e.g. min-w-44) to stop "Has attachment" wrapping.
2. Make the active filter dismissible from the toolbar: render a small "x" inside or beside the active Filter button that calls the same clear as menu "Clear" (Inbox.tsx:~517-524, and `clearFilters` at :366). Also let re-selecting the checked radio clear it. Removes the reopen-menu step and the "how do I turn this off" hesitation (STORY-014 variation).
3. Merge the Important toggle and the menu into one mechanism: either move "Important" into the menu as the first item of the Rakazo group (and remove the toggle at Inbox.tsx:~455-464), or keep the toggle and make Filter reset visibly consistent. Reason: today `view=important` and `filter/category` are mutually exclusive but look independent (J6-32).
4. Show the same names on rows and in the menu: either chip every classified row with its category name (so Bills shows "Bills") or show a chip only for the exception states. At minimum rename the chip "Newsletter" and the category "Newsletters" to one word (InboxRow.tsx:94 vs Inbox.tsx:80).
5. Name the Important toggle's meaning on hover (title/tooltip), one short phrase, because it is not Gmail's "important" marker (inbox.ts:340-362 per catalog).
6. Add Clear to the error state "Couldn't reach Gmail." so a failed filter has a visible exit (J6-20).

## Clarity Issues

1. Two systems share one menu, unlabeled (J6-02). A person cannot tell Gmail tabs from Rakazo categories. "Updates" (Gmail tab) vs "Notifications" (category) is the clearest collision (measured: both present in the 14-item list).
2. "Important" is undefined and sits outside the menu. It acts as a Rakazo view (needs-reply, marked-important, high priority, minus noise per catalog) but looks like Gmail's marker. Result view adds a "Needs reply" group and "Needs attention" chips (J6-32), which the label does not predict.
3. Group structure changes by filter type (measured): default and Important views show "Needs reply / Today / Earlier" groups; Gmail filters and categories show different groupings (J6-24, J6-10 show only "Today" or "Earlier"); the To do card disappears under every narrowing. Nothing says why.
4. Idle Filter button is icon-only (J6-01). Fine as an icon, but with 14 hidden options a visible text label "Filter" would cost almost nothing at 1440 px.
5. Failure state after a filter pick ("Couldn't reach Gmail.", J6-20) leaves the filter label on the button but no explanation about which filter failed.
6. STORY-019 (code only, not measured): account tab labels truncate at 160 px (`max-w-40`), tab choice is not in the URL, rows do not show account in "All".

## Verdict

acceptable, leaning convoluted on clarity. Step count is near ideal (1 click per filter pick), but the menu has 14 unlabeled options across three concepts, "Important" is a parallel control with undefined meaning, and the row badges and categories name the same classification differently. No bugs were found in the menu itself; the two Gmail failures were transient (retry succeeded).
