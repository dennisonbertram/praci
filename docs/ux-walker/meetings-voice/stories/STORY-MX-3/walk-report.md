# Walk report: STORY-MX-3

Walker session: uxw-flow. Static mockups opened over file://; one screen shown at a time, state pills pressed, desktop 1280x800 (dark, OS theme) plus one 390x844 spot-check. Verdict: **fail (1 high plan finding)**.

## Steps

1-2. Routine creation and silent run: no surface drawn for the creation moment (the mockup begins with the routine already present). The row "Review new meetings / Weekly - last run Mon 19 Oct" with an on switch exists (screenshots/step-4.png), which gives a visible stop control; it does not show that the routine was created without disclosure.
3. Asking the agent "Did you learn anything?": not drawn (this screen has no composer; the Agent answers screen does).
4. Looking for the Memory view: the mockup draws the routine run as a thread message ("Routine: Review new meetings / Saved 3 notes from 4 meetings", three bullets with citation chips). No Memory section or bot-memory list is drawn. Journey breaks: step 4 has no surface (granola.md S7, discovery ambiguity 11).
5. Delete one wrong entry: the three bullets have no delete or forget control and nothing links to the memory screen. Journey breaks: step 5 has no surface. The sample entry "Dana prefers annual billing" is itself a third-party preference, the exact kind of entry the story says Priya wants to delete.
6. Stop the routine: the switch ("Review new meetings", role switch, accessible name present) is the only drawn control. What off means (paused vs removed) and whether provisioning recreates it is not drawn.
LOOK: pass. Switch is 36x20 px, below 44 px target on desktop (low). Geometry: no hits. Mobile spot-check (mobile-check.png): stacks cleanly, no overflow.

## Flow Log

Ideal 4 steps (open agent, open Memory, read, delete). Mockup supports only: open agent, see a thread message, toggle routine. The remaining two ideal steps (Memory view, per-entry delete) cannot be done: 2 steps missing, user would end in chat asking the agent to forget, which the S4/S7 allowlist forbids. Duplicated information: the memory entries appear in the thread message and (per plan) in a memory screen not drawn.

## Findings (4)

- F-MX-3-1 [plan, high, happy-path] No drawn way to see routine-written memory entries as a list or to delete one; the routine message lists entries but has no per-entry action, and forget_memory is removed from the agent. (ref: JF-9)
- F-MX-3-2 [plan, medium, error-handling] Switch meaning is undrawn: off = paused or removed, and whether agent provisioning recreates a removed routine. (ref: JF-9 (stop-the-routine half))
- F-MX-3-3 [mockup, low, consistency] This agent page has no composer, while the same Granola agent page on the Agent answers screen shows 'Ask Granola agent'. (ref: NEW)
- F-MX-3-4 [mockup, low, a11y] Routine switch measures about 36x20 px. (ref: NEW)

## Screenshots

- screenshots/mobile-check.png
- screenshots/step-4.png
