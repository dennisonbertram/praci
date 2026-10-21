# STORY-076 flow critique: month-end handoff across computer, artifact, page, list and routine

Previous round: verdict convoluted (22 steps vs 14 simpler; forced second confirm, Close, Back-then-Home detour; no board for pre-control Computer, handoff prompt or laptop pose).

Round 1 (current boards). Target: planned native SwiftUI iPhone app (epic #427, P7 #419, P8 #420). Judged against boards PG-A-Home, PG-A-Thread, PG-A-ThreadStates, PG-A-Computer, PH-Computer, PG-A-Artifact, PG-A-AgentPage, PG-A-AgentList, PG-A-Routine, PG-A-Rules (all screenshots opened). Persona: Jordan Reyes, laptop pose 626x890; only the outer display (466x678) and standard iPhone are drawn.

## 1. Friction scorecard

| Measure | Result |
| --- | --- |
| Steps | 22 as written; 14 in the simpler version below. |
| Forced extra steps | 4: second confirm after Release (step 6), Close (step 8), Back then Back to reach Home (step 18; Home then reaches the routine in one tap via the "Weekly runway" Activity row, PG-A-Home). |
| Needless decisions | 1: "Skip / I'm done" after Release. |
| Re-entry | None. |
| Dead ends | Routine ends on "Open conversation" with no run named; no link from routine to the page it updates. |
| Steps with no board | Step 1 (no Finance "needs you" Activity state; PG-A-Home shows Working / Approve / Done only). Step 2 (PG-A-Thread draws no computer block; it shows an Inbox agent thread). Step 3 on the outer display (PH-Computer now draws "Take control" on the standard iPhone, but PG-A-Computer shows only the in-control state). Step 5 handoff prompt (text only in PG-A-Rules). Step 7 and all laptop-pose screens. Step 11 version list (Versions menu). |
| Data on several screens | Runway figures and "Cash fell in the last 30 days..." on Artifact and Agent page; verification is the point of the journey, so acceptable. |

Fixed since last round: Home now shows the routine row and a Pages section; Agent page tile widths are equal; PH-Computer draws the pre-control state.

## 2. Take-away pass

- PG-A-Computer: Team/Private picker stays visible while in control; hide it once control is taken. One prominent action: Release (ink). Pill "You have control" plus the Release lock icon state control twice; minor.
- PG-A-Artifact: card heading "Runway summary" repeats the capsule title; the Versions button in the strip and the "v5 of 5" pill step through the same versions. No tinted prominent action is drawn although PG-A-Rules names Share. Board says v5 of 5, story says v6.
- PG-A-AgentPage: "At the current burn the runway is [N] mo." repeats the Runway tile. Open chat is the one ink action.
- PG-A-AgentList: nothing removable; Add item is the one prominent action. Page and chat are one tap away in the strip.
- PG-A-Routine: nothing removable; Open conversation is the one ink action.
- PG-A-Thread/Home: fine for this journey; Thread carries no way to reach Computer or Artifact chips in the drawn state.

## 3. Simpler version (14 steps)

1. Home: tap Finance agent row (needs a "Needs you" status). 2. Tap the computer block in the thread. 3. Take control. 4. Tap Download on the remote screen. 5. Tap "I'm done" (Release becomes "I'm done" while the agent waits; one tap releases and closes to the thread). 6. Tap the "Runway summary v6" chip. 7. Read. 8. Back to thread. 9. Page. 10. Read tiles. 11. Tap the checklist icon in the strip. 12. Tick two rows. 13. Back twice, tap "Weekly runway" on Home. 14. Read "Every Monday at 8:00 AM" and "Next run Mon, Oct 26". Optional (not counted): thanks message, compare v5, ask a question, read prompt.

## 4. Beauty check

Glass is limited to the strip, capsules, key bar and version pill; content cards are solid; bot avatar shapes and colors match the shipped set; Computer uses clear glass over the screen. Exceptions: Artifact has no prominent action drawn; Computer outer display has strip, top capsules and key bar as three glass regions, at the limit.

## 5. Verdict: acceptable

Each screen is close to minimal and the page-to-list and Home-to-routine hops are one tap. Remaining friction is the release double-step and the missing links, plus undrawn steps (1, 2, 5, laptop pose) that hide whether the first third of the journey works.

## ISSUES

- STORY-076-R1-1 (high): PG-A-Thread, PG-A-Home. Steps 1-2 have no board: Home Activity has no "Needs you" status for the Finance agent, and the thread draws no computer block or handoff card. Fix: add a "Needs you" row state (amber dot) on PG-A-Home and a computer block with "Take control" on PG-A-ThreadStates.
- STORY-076-R1-2 (high): PG-A-Rules Computer card, PG-A-Computer. Step 5-6 handoff "Skip / I'm done" is undrawn and costs a second confirm. Fix: while the agent waits, label the Release button "I'm done" (one tap releases and returns to the thread), with a quiet "Skip" text action; draw it on PG-A-Computer.
- STORY-076-R1-3 (medium): PG-A-Computer. The outer display shows only the in-control state. Fix: add the "Take control" (ink, bottom, replaces key bar) state; hide the Team/Private picker once control is taken.
- STORY-076-R1-4 (medium): PG-A-Artifact. No prominent action is drawn although PG-A-Rules says Share; the board shows v5 of 5 while the story is v6; the title appears twice. Fix: tint/ink Share or change the rule to "None"; show "v6 of 6"; remove the card heading; drop the strip Versions button or the pill.
- STORY-076-R1-5 (medium): PG-A-Routine. The routine names "the Runway summary page" as plain text and gives no way to open it; "Open conversation" does not say which run. Fix: make "Runway summary page" a tappable row on the status card and label the button "Open last run" (8:00 AM).
- STORY-076-R1-6 (low): PG-A-AgentPage. Paragraph repeats the Runway tile. Fix: delete "At the current burn the runway is [N] mo."
- STORY-076-R1-7 (medium): PG-A-Rules laptop pose. Computer's "main use" pose is described only in text; the thread composer on its bottom half and laptop-to-full-height transitions to Routine are undrawn. Fix: draw one 626x890 Computer board (watch and in-control) in P8.
