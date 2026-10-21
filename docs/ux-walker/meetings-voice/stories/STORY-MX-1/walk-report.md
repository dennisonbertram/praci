# Walk report: STORY-MX-1

Walker session: uxw-flow. Static mockups opened over file://; one screen shown at a time, state pills pressed, desktop 1280x800 (dark, OS theme) plus one 390x844 spot-check. Verdict: **pass (no high findings; 2 plan mediums)**.

## Steps

1. Sidebar bot list (wispr#screen-flow-meetings, Agent answer; screenshots/step-3b.png). The Wispr mockup shows two bots, "Wispr Flow agent" and "Granola agent", with identical orange avatars (W, G). There are no account labels and nothing says each agent sees every meeting. The Granola mockup (step-3.png) shows only "Granola agent", so the two-Granola-agent case in the story is not drawn. LOOK: pass on alignment; hierarchy fine.
2. Ask the Flow agent. The composer is drawn in the Granola mockup only; the Wispr agent screen has no composer. Not a blocker for a static mockup.
3. Cited answer. Granola mockup (step-3.png): two lines, each followed by a chip "Pricing review, 12 Oct". Wispr mockup (step-3b.png): chips "Security sync, 14 Oct" and "Vendor call, 16 Oct" look identical although one is a Flow meeting and the other a Granola meeting. A muted footnote inside the mockup says "The answer does not say which is which", so the mockup author already flagged it. Geometry: pageOverflowX 0; the only unevenRows hit is the state-pill group (widths follow label length), a false positive.
4. "Only the calls recorded in Flow" (provider filter): no surface. Journey breaks: step 4 has no surface (granola.md Reading, Granola S4 #440).
5. "Is that the same call as the Granola one on the 12th?": no surface. Journey breaks: step 5 has no surface (discovery ambiguity 20).
Mobile spot-check 390x844 (mobile-check.png, Granola agent answer): no horizontal overflow, chips wrap with the text, composer full width. Pass.

## Flow Log

Ideal 3 steps (open agent, ask once, read cited answer). Mockup actual 3 plus one hesitation at step 1 (which agent to open, both look equally capable). Steps 4 and 5 are chat turns with no mocked surface. Duplicated information: the same meeting title and date appear in the answer text and again in the chip; the footnote repeats the provider fact the UI does not show.

## Findings (4)

- F-MX-1-1 [plan, medium, happy-path] Answers mix Granola and Flow meetings but the chips show only title and date, so the user cannot tell which tool a meeting came from. (ref: JF-21)
- F-MX-1-2 [plan, medium, happy-path] Agent names suggest vendor scope ('Wispr Flow agent', 'Granola agent') but every meeting-source agent sees all meetings, so the user may pick the 'wrong' agent or distrust the answer. NEW variant of JF-17: this arises with one agent per vendor, not only with two Granola agents. (ref: NEW)
- F-MX-1-3 [plan, low, flow] Provider filter ('only Flow calls'), same-call comparison and the 90-day window are chat-only; the mockup draws nothing for steps 4 and 5, so the plan must say what the agent answers. (ref: NEW (links discovery ambiguity 20))
- F-MX-1-4 [mockup, low, visual] Author notes render as visible UI text inside the mockup ('...The answer does not say which is which.'). (ref: NEW)

## Screenshots

- screenshots/mobile-check.png
- screenshots/step-3.png
- screenshots/step-3b.png
