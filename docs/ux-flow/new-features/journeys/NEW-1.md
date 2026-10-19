# NEW-1: Discovering and connecting apps through the "Connect apps" pill

Verdict: **acceptable**

Evidence: stories STORY-NA-1 to NA-6 (`docs/ux-paths/topics/new-connect-apps.md`) and walker artifacts in `docs/ux-walker/stories/STORY-NA-*/`. Every screenshot was opened. Paths below are relative to `docs/ux-walker/stories/` and written as `NA-n/step-x`.

Limits of the evidence. The walk ran on the mock stack with no internet, so every logo is a grey letter (NA-1/step-1). The real sign-in popup and the "pending / Try again" path were not walked (walk-report NA-4). The slow-network case and the all-five-connected case were not walked (NA-3, NA-5 reports). Real logos are unverified.

## Friction Scorecard

| Measure | Observed | Source |
|---|---|---|
| Steps to notice the entry point | 1 (ideal 1). The pill is visible on load. | NA-1/step-1, walk-report NA-1 |
| Steps to reach the Integrations page | 1 click (ideal 1). | walk-report NA-2 |
| Steps to connect Slack from the pill | 6 clicks against an ideal of 4 in the catalog. The extra two are the "Which bots can use Slack?" dialog (Continue) and the final "Slack connected" dialog (Done). | walk-report NA-4, NA-4/step-2, NA-4/step-4 |
| Decisions a default could carry | One. The bot-access dialog opens with every bot already ticked (NA-4/step-2), so the default exists; the user still has to dismiss the dialog. The dialog's own subtitle says "You can change this later." | NA-4/step-2 |
| Re-entry | None found. The user re-types nothing. After connecting, the user must find Slack again on the page: the pill's logos are not clickable per app. | story NA-2 edge case; walk-report NA-2 |
| Needless confirmations | One. "Slack connected" with a "Done" button guards nothing; the page already shows the app under Connected (NA-4/step-5). | NA-4/step-4, NA-4/step-5 |
| Dead ends | None. The failure case degrades to the plain "Integrations" row, which still works (NA-5/step-3). The failure is silent in the sidebar but the page shows "Could not load the app list. Reload to try again." (NA-5/step-4). | NA-5 |
| Hesitation points | (a) Slack is below the fold after the click: the page shows six Connected cards and the Find an app search first, and Slack is in the Popular grid only after scrolling (NA-2/step-1 vs NA-2/step-2). (b) The logos say "G G G" with no names (NA-1/step-1). This one is partly caused by the offline walk. | screenshots as cited |
| Layout instability | The pill showed two logos (G G), then three (G G N) about 1.5 s later after leaving Integrations. | F-NA-4-2, NA-4/step-6 |

Measured: the step counts, the dialog contents, the below-the-fold position of Slack on desktop in the main demo space, the logo flicker. Suspected: whether real logos make the pill recognizable; whether users hesitate on the pill's low contrast (the walker measured 37,37,35 resting vs 42,41,39 on hover, F-NA-1-2, but nobody timed a hesitation).

## Take-away Pass

**Sidebar pill (NA-1/step-1, NA-2/step-0)**
- The label "Connect apps" is the action. Keep it.
- The three logos are the only removable-looking part. They carry teasing information (which apps are missing) but are not clickable, and without internet they render as "G G G" (NA-1/step-1). They add no step for the user. Keep them only if each logo is a way in, or if a tooltip names the apps. Otherwise they are decoration. Nothing in the walker artifacts shows anyone using them.
- One primary action: yes, the pill is the only call to action in the sidebar. Visual weight is wrong: it is the quietest element (nearly the same background as the sidebar, F-NA-1-2, NA-1/step-2), while it is the only prompt to do something.
- Hidden on the Integrations page, which is right; it would point at the page already open (NA-2/step-1, NA-3/step-1).

**Integrations page (NA-2/step-1, NA-2/step-2)**
- Subtitle "Connect the apps you use so your bots can read and act in them. You choose which bots get access to each one." Persistent explainer above the first action. The second sentence is repeated by the bot-access dialog ("Which bots can use Slack?") in NA-4/step-2. Removable.
- Connected cards come first. For someone who arrived from "Connect apps", this puts the already-done work above the thing they came for. Collapse or move below Popular when the visit came from the pill.
- "Popular" and "Find an app" each stand on their own; no overlap with the pill besides the same app list. No duplicate found.

**Bot-access dialog (NA-4/step-2)**
- Header "STEP 2 OF 3": steps 1 and 3 are the sign-in and the confirmation. Step numbering is useful only if the user can see the whole path; here the other two steps are not dialogs.
- Nine rows of bot names, all ticked, plus Skip and Continue. Two exits that appear to do the same thing: with everything already ticked, "Skip" and "Continue" both seem to leave the default. I did not verify what Skip does. This is a suspicion, not a measurement.

**Success dialog (NA-4/step-4)**
- Four statements for one fact: title "Slack connected", subtitle "Slack is ready.", "All bots can use Slack.", "Slack now appears under Connected." (F-NA-4-1). The first two say the same thing. The last describes what is visible on the page behind it (NA-4/step-5 shows Slack in Connected).

**Tile text (NA-4/step-5, F-NA-5-1)**
- The Slack tile shows name "Slack" and description "Slack". Mock data, but a repeat of the name.

## The Simpler Version

Goal: connect a missing app, starting from the sidebar.

1. Click "Connect apps". The Integrations page opens with the unconnected featured apps at the top, ahead of the Connected cards.
2. Click "Connect" on the app. The sign-in opens.
3. Finish sign-in. The tile changes to Connected and a short message appears on the page ("Slack connected. All bots can use it. Change"). No modal, no Done button.

Three steps against the walked six. The pill itself already needs one step, which is minimal.

Concrete changes, ranked:
1. Remove the "Done" step: show the result as a toast or an inline state on the tile, with the bot-access change as a link. Evidence: NA-4/step-4, F-NA-4-1.
2. Make bot access an opt-in after connecting (default: all bots, which is already the pre-ticked state in NA-4/step-2), not a step in the flow. The dialog itself says the choice can be changed later.
3. When the page is opened from the pill, show the unconnected featured apps above the Connected section (NA-2/step-1 vs step-2).
4. Name the apps on the pill: a tooltip, or make each logo open that app's connect flow. At minimum make the letter fallback distinguishable (F-NA-1-1).
5. Strengthen the pill's contrast so the one prompt in the sidebar is visible (F-NA-1-2).
6. Keep the previous list or the plain row until the reload finishes, to stop the logo flicker (F-NA-4-2).

Not worth changing: the silent fallback to the plain row on a failed request (NA-5/step-3). The page explains the failure, and a sidebar error would add noise.

## Clarity Issues

- One destination, two names: the pill says "Connect apps" and the plain row, page heading and search entry say "Integrations" (NA-1/step-1 vs NA-3/step-1; story NA-3 notes the screen-reader names also differ). The pill is an action label and the row is a place name, so the difference is defensible, but "apps" (pill, subtitle, "Find an app") and "Integrations" (heading, row) name the same thing.
- "Connected" is the status on tiles, a section heading, and the phrase in "Slack now appears under Connected." (NA-4/step-4). Consistent, but the last use is a repeat.
- "Bots" and "agent": the dialog asks "Which bots can use Slack?" while the rows are named "Inbox agent", "Finance agent" (NA-4/step-2). Two words for the same entity in one dialog. The sidebar and mock data also call them "agents" (NA-2/step-0).
- "STEP 2 OF 3" assumes the user knows steps 1 and 3 (NA-4/step-2).
- "Replace key" and "Open" on the Coinbase tile (NA-3/step-1) are unlabeled in what "Open" opens. Outside the pill, noted only.
- "Popular" is a list of unconnected apps, mixed with GitHub, Linear and Airtable (NA-2/step-2). The pill's three logos are the first three of the same list; its meaning ("apps you are missing") is not stated anywhere.
- Letter fallback "G / G / G" for three different Google apps (NA-1/step-1, NA-2/step-2) is ambiguous. Caused by the offline walk, but it is what the user sees whenever a logo fails.

## Verdict

**acceptable.** The sidebar entry itself is minimal: 1 step to notice, 1 click to arrive. The journey as a whole has two extra steps (bot-access dialog, Done), one needless confirmation, a result dialog that states the same fact four times, and a below-the-fold first target on the destination page. Nothing structural; no duplicated surface.
