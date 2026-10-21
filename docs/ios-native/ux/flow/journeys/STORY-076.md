# STORY-076 flow critique: month-end handoff across computer, artifact, page, list and routine

Previous round: R1 verdict acceptable (22 steps vs 14 simpler; seven issues, mostly undrawn steps, the release double step and missing links).

Round 2 (current boards). Target: planned native SwiftUI iPhone app (epic #427, P7 #419, P8 #420). Boards judged (all screenshots opened): PG-A-Home, PH-Home, PG-A-Activity, PG-A-ThreadStates, PG-A-Computer, PH-Computer, Desk-Computer, PG-A-Artifact, PG-A-AgentPage, PG-A-AgentList, PG-A-Routine. Persona: Jordan Reyes, founder running close alone.

## 1. Friction scorecard

| Measure | Result |
| --- | --- |
| Steps | 17 actual on the drawn boards; 14 ideal. |
| Forced extra steps | 2: Back from the artifact to the thread before opening the page (the artifact has no "Open page"), and Back twice then Home to reach the routine. Both are one tap each. |
| Needless decisions | 0. The R1 "Skip / I'm done" second confirm is gone: PG-A-Computer "Agent waiting" draws "I'm done" with a quiet "Skip", and Release is one tap. |
| Re-entry | None. |
| Dead ends | None. Routine now offers "Open last run" and an "Updates: Runway summary" row. |
| Steps with no board | Step 1-2 handoff wording (Home row says "Approve $1,200 payment", a payment approval, not a portal handoff; the thread draws a computer block only for the Inbox agent, user-started). Artifact chip in the thread (no board draws it). Step 7 composer in the Computer bottom half (Desk-Computer shows only the key bar and keyboard). Laptop-pose boards for Artifact, Agent page and Agent list. |
| Data repeated | Runway figures on Artifact and Agent page; verification is the point, acceptable. |

Fixed since R1: Home "Needs you" row (PG-A-Home, PH-Home, PG-A-Activity); Computer states Watching / In control / Agent waiting with I'm done and Skip; picker hidden once in control; artifact shows "v6 of 6" with Share as the ink action and no repeated heading; paragraph duplication on the page is a different sentence, tile repeat removed; routine links to its page and to the last run; Desk-Computer draws the laptop pose.

## 2. Take-away pass

- PG-A-Home / PH-Home: one tinted action (New). Nothing removable for this journey.
- PG-A-Computer: one prominent action per state (Take control / Release control / I'm done). In "Agent waiting" the status pill, banner and button repeat "waiting"; minor. Team/Private picker is correct only before control.
- Desk-Computer: unlabeled lock icon is the release control; it is the one ink action but its meaning is not readable. "You have control" pill is fine.
- PG-A-Artifact: Share is the one ink action; nothing removable. Title is "Cash runway memo" while the story and routine say "Runway summary".
- PG-A-AgentPage: Open chat icon is the only action; nothing removable.
- PG-A-AgentList: Add item is the only prominent target; rows "Collect missing receipts" and "Review vendor payments" are already done, so the step 17 tick has nothing to do.
- PG-A-Routine: "Open last run" is dark neutral, "Run again" is ink only in the failed state; one action each.

## 3. Simpler version (14 steps)

1. Home: tap the Finance "Needs you" row (copy: "Sign in to bank portal"). 2. Take control in the thread's computer card (opens Computer). 3. Tap Download on the remote screen. 4. Tap "I'm done". 5. Tap the "Runway summary" chip. 6. Read. 7. Back. 8. Tap Page. 9. Read tiles. 10. Tap checklist icon. 11. Tick two rows. 12. Back twice to Home. 13. Tap "Weekly runway". 14. Read schedule; optionally "Open last run".

## 4. Beauty check

Glass is limited to the side strip, top capsules, key bar and bottom button (three groups, at the limit on Computer). Content cards are solid. Bot avatars match shipped shapes and colors (Finance amber warning shape, Inbox blue pill, Legal purple drop, Chief teal hex). Name "Praci" does not appear in this journey. Exactly one ink action per view. One mismatch: the Needs you chip color (amber on dark) is a status, not a tint; fine.

## 5. Verdict: minimal

Every drawn screen has one clear next action, no forced confirm, no dead ends, and each hop is one tap. The remaining issues are copy and drawing gaps, not extra steps.

## ISSUES

- STORY-076-R2-1 (medium): PG-A-Home, PG-A-ThreadStates. Step 1-2: the "Needs you" row says "Approve $1,200 payment" and the only thread computer block is the Inbox agent's, started by the user ("Show me the open invoices"). A Finance portal handoff has no row text or thread card. Fix: draw a Finance row "Sign in to bank portal" with Needs you, and a handoff card above the composer with ink "Take control" that opens Computer directly.
- STORY-076-R2-2 (medium): PG-A-Artifact, PG-A-ThreadStates. Step 5: no board draws the "Runway summary v6" chip in the thread, and the artifact is titled "Cash runway memo" (story and routine say Runway summary). Fix: add an artifact chip state to ThreadStates and rename the artifact title to match.
- STORY-076-R2-3 (medium): Desk-Computer. Step 7 and release: the bottom half shows only the key bar and keyboard; no thread composer, and Release is an unlabeled lock icon. Also no Watching or Agent waiting state at 626x890. Fix: add the "Agent waiting" laptop state with "I'm done" and "Skip" labeled, and a one-line composer above the keyboard; label the release control "Release".
- STORY-076-R2-4 (low): PG-A-AgentList. Step 17: "Collect missing receipts" and "Review vendor payments" are already done in the drawn state. Fix: draw them open (move above Done) so the tick step is visible.
- STORY-076-R2-5 (low): PG-A-Artifact. Step 7-8: no link from the artifact to the page it summarizes, costing Back then Page. Fix: add "Open page" to the strip menu (three dots).
- STORY-076-R2-6 (low): PG-A-Artifact, PG-A-AgentPage, PG-A-AgentList. Laptop pose (626x890) boards for these three laptop-capable screens do not exist; only Computer is drawn (Desk-Computer). Fix: draw one board each in P8, or state that they stay full height.
