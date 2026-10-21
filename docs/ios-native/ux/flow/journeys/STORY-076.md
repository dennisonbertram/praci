# STORY-076 flow critique: month-end handoff across computer, artifact, page, list and routine

Previous round: R2 verdict minimal (17 steps vs 14 ideal; six issues, mostly undrawn handoff and chip, laptop-pose gaps). R1 was acceptable.

Round 3 (current boards). Target: planned native SwiftUI iPhone app (epic #427, P7 #419, P8 #420). Boards judged (all screenshots opened): PG-A-Home, PG-A-Activity, PG-A-ThreadStates, PG-A-Computer, PH-Computer, Desk-Computer, PG-A-Artifact, PG-A-AgentPage, PG-A-AgentList, PG-A-Routine, PH-Thread. Persona: Jordan Reyes, founder running close alone.

## 1. Friction scorecard

| Measure | Result |
| --- | --- |
| Steps | 18 actual on the drawn boards (Home row, Take control, Download, I'm done, Close, chip, read, more menu, Open page, read tiles, Pages icon, tick, tick, three Backs, routine row, read); 13 ideal. |
| Forced extra steps | 3: the Back chain from the list to Home to reach the routine (page and list never link to it). Artifact to page is now two taps (more menu, Open page), the same count as before, but the menu hides the link. |
| Needless decisions | 0. "I'm done" with a quiet "Skip" is one tap; no second confirm. |
| Re-entry | None. |
| Dead ends | None. Artifact has Open page and Versions; page has Pages (list) and chat; routine has Updates, Open last run and Run now. |
| Steps with no board | Finance handoff card in the thread (only the Inbox agent draws a computer block); the "Runway summary" chip in the thread; the thread composer in the laptop-pose Computer screen (Desk-Computer has only the remote "Type to the computer" field); the Watching / Take control state in laptop pose. |
| Data repeated | Runway figures on Artifact and Agent page; verification is the point, acceptable. |

Fixed since R2: artifact titled "Runway summary" on Artifact and Agent page, matching the routine's "Updates" row (R2-2 title part); "Open page" in the Artifact more menu (R2-5); Agent list draws the two receipt and vendor rows open (R2-4); Desk-Computer has "Release control" labeled plus an "Agent waiting" state with "I'm done" and "Skip" (R2-3 label and state parts); PG-A-Rules says "Full height; no split" for Artifact, Agent page and Agent list (R2-6).

## 2. Take-away pass

- PG-A-Home: one tinted action (New). Nothing removable for this journey.
- PG-A-Computer: one prominent action per state (Take control, Release control, I'm done). In "Agent waiting" the pill ("Finance agent is waiting for you") and the banner ("Sign in to the bank portal, then tap I'm done") both say the agent waits; keep the banner, drop the pill text or shorten it.
- Desk-Computer: the Team/Private picker stays on screen while in control and while the agent waits; PG-A-Computer and PH-Computer hide it then. Remove it in those states.
- PG-A-Artifact: Share is the one light action; nothing removable.
- PG-A-AgentPage: chat is the only action; nothing removable.
- PG-A-AgentList: nothing removable; chat is the only prominent target.
- PG-A-Routine: Open last run and Run now are equal neutral buttons; no ink action, acceptable for a read screen.

## 3. Simpler version (13 steps)

1. Home: tap Finance "Needs you" (copy "Sign in to bank portal"). 2. Tap "Take control" on the thread's handoff card (Computer opens). 3. Tap Download on the remote screen. 4. Tap "I'm done" (control returns, thread resumes). 5. Close; tap the "Runway summary" chip. 6. Read. 7. More, Open page. 8. Read tiles; tap the subtitle "Weekly runway summary, Mondays" (new link). 9. Read schedule. 10. Optionally Open last run. Back on the way to the list: Pages icon, tick two rows. Drop the "Thanks, check the runway" message (step 7 of the catalog): it is not needed to finish the handoff.

## 4. Beauty check

Glass is limited to the side strip, key bar, Take control or Release button and the capsules; three groups on Computer, at the limit. Content cards are solid. Bot avatars match the shipped shapes and colors (Finance amber warning shape, Inbox blue pill, Legal purple drop). Concentric corners hold on cards. The name "Praci" does not appear in this journey. One ink or light action per view. One mismatch: control copy differs by board ("You are driving" on PG-A and PH, "You have control" on Desk-Computer).

## 5. Verdict: minimal

Every drawn screen has one clear next action, no forced confirm, and no dead end. Remaining issues are two undrawn thread states, a laptop-pose inconsistency and a missing page-to-routine link.

## ISSUES

- STORY-076-R3-1 (medium): PG-A-Home, PG-A-ThreadStates. Step 1-2: the Finance row still says "Approve $1,200 payment" (a payment approval, not a portal sign-in) and the only thread computer block is the Inbox agent's, which the user started ("Show me the open invoices"). Fix: draw a Finance row "Sign in to bank portal" with Needs you, and in ThreadStates a handoff card above the composer ("Finance agent is waiting for you", one light "Take control") that opens Computer.
- STORY-076-R3-2 (medium): PG-A-ThreadStates. Step 5-6: no board draws the "Runway summary" artifact chip the agent posts in the thread, so the entry to the Artifact screen is undrawn. Fix: add an "Artifact posted" state with a solid chip "Runway summary, Version 6" that opens PG-A-Artifact.
- STORY-076-R3-3 (low): Desk-Computer, PG-A-Computer, PH-Computer. Step 2-6 in laptop pose: the Team/Private picker shows while in control and while the agent waits (the other two boards hide it), the in-control pill reads "You have control" where the others read "You are driving", and no Watching state with "Take control" exists. Fix: hide the picker once control starts, use "You are driving" everywhere, and add a Watching frame with "Take control".
- STORY-076-R3-4 (low): Desk-Computer, catalog STORY-076. Step 3 and 7: the Agent waiting state shows the key bar and "I'm done" with no Take control tap, so the catalog sequence (Take control, then agent waits) contradicts the boards; and step 7 expects a thread composer, but the laptop board's only text field, "Type to the computer", sends keys to the remote machine. Fix: state in the story that the waiting state grants input directly, and drop the thread-message step (or label the field "Type to the computer" only and draw the thread composer on the other half).
- STORY-076-R3-5 (low): PG-A-AgentPage, PG-A-AgentList, PG-A-Routine. Step 18: nothing links the page or list to the routine that updates them, so the check costs three Backs and a Home tap. Fix: make the Agent page subtitle "Updated today, 8:02 AM" a tappable "Weekly runway summary, Mondays" that opens the routine.
