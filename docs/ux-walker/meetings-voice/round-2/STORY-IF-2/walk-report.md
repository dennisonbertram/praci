# STORY-IF-2: Founder with Gmail and Granola sees both kinds of to-dos (round 2)

**Result: FAIL**

Outdated or changed by the plan: Step 4: the plan now returns the same card on every account tab (meeting to-dos regardless of the tab); FX-15.

Mockups walked: current `docs/granola/mockup.html` and `docs/wispr-flow/mockup.html` (dark theme, 1280x900, plus 390x844 spot-check). Screenshots in `screenshots/`.

## Steps

- **1 Open Inbox on the All tab with mail connected.** 'All' and 'acme@example.com' tabs, To do card, then mail rows. Newly drawn since round 1. Screenshot: `screenshots/inbox-mail.png`

- **2 Combined list.** The card contains only three meeting items. No mail to-do (sender plus reason line) appears, so the mixed list the story is about is not drawn. Screenshot: `screenshots/inbox-mail.png`

- **4 Switch to the account tab.** Clicking the account tab only toggles aria-selected; the card and rows stay the same. That matches the plan's 'identical on every tab'. Screenshot: `screenshots/inbox-mail.png`

- **3 Click a meeting item.** Plain text, no action; plan decision. Screenshot: `screenshots/inbox-mail.png`


Geometry audit (scoped to the screen, scratchpad variant of geometry-audit.js plus a 32 px target check), run once per distinct state: pageOverflowX 0 everywhere; overflowSpills none; wrappedControls only the 'Get a key in Granola' link (one line on screen at 1280 px, wraps at 390 px) and the mobile glass back chevron (false positive); unevenRows only mockup chrome (state pills, All/account tabs, Allow/Not now buttons); smallTargets: citation chips 21-24 px and mobile checkbox circles 24 px (inside 44 pt rows).

## Flow Log

Actual 1 step = Ideal 1 for the part that is drawn. The mail plus meeting distinction (source line only) cannot be judged without a mail row in the card.

## Round-1 findings

None for this story.

## New findings (round 2)

- **F2-IF-2-01** (medium, mockup): The 'Mail connected' state shows only meeting to-dos in the To do card. The story is about one list that mixes mail to-dos and meeting to-dos, and how the user tells them apart (plan: only the detail line differs). Fix: Add one mail to-do to the 'Mail connected' state.
