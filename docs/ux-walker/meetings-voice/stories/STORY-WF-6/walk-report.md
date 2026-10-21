# Walk report: STORY-WF-6

Walker session: uxw-flow. Static mockups opened over file://; one screen shown at a time, state pills pressed, desktop 1280x800 (dark, OS theme) plus one 390x844 spot-check. Verdict: **fail (1 high plan finding)**.

## Steps

1-2. Settings, Voice (screenshots/step-1.png, Wispr#screen-settings-voice, Default): the new "Transcription" select ("Use my voice provider") sits above the Providers list, at the top of the overlay. This answers the catalog's 'where is the row' gap. The provider list shows ElevenLabs Connected, OpenAI, Fish Audio, Cartesia with the existing labels; Wispr Flow is only in the select, not in the list. LOOK: clean; the providers box has a faint 2 px sliver along its top edge (cosmetic).
3. Choose Wispr Flow, no key (step-3a.png): a key card with "API key" field and a disabled "Connect"; then Verifying (step-3b.png): the button reads "Connecting…", the field is masked: reuses the Voice pattern.
4. Connected (step-4.png): green "Connected" pill, "Replace key", "Disconnect". The ElevenLabs row still says Connected, so two "Connected" marks sit on one screen with no cue of which provider transcribes and which speaks (the plan says speech stays on the old provider).
5. Consent (step-5.png, Wispr#screen-consent, Prompt): a card titled "Voice sharing has changed" with Allow and Not now, shown on an Inbox page with a Research agent, not at the moment of pressing Call Elio. A second state "AI data sharing" (step-5b.png) lists ElevenLabs and Wispr Flow toggles.
6. Call (step-6.png, Wispr#screen-call): Elio call card with Mute and End, caption showing the transcript; the footnote says the call looks the same as today.
7. Vocabulary: invisible by design, no surface.
8. Clear the selection: the Disconnect button is the only control; what the select shows afterwards is not drawn.
Edge: Key rejected (edge-rejected.png): red field border, "Could not connect this voice provider", Connect enabled: reuses existing copy.
Geometry: all states pageOverflowX 0; hits are the state-pill group and the Allow/Not now button pair (53 vs 70 px by label, intended). Mobile spot-check (mobile-check.png, Connected): stacks, select and key card full width, no overflow.

## Flow Log

Ideal 6 (open Settings, Voice; pick provider; paste key; Connect; accept disclosure; start call). Mockup actual 6, but the disclosure appears out of context (Inbox card instead of at call start) and the user sees Connected twice. Data re-entry: Flow key field in the transcription card plus the existing 'API key' field in the unchanged provider pane would let a user paste twice (the provider pane is described but not drawn).

## Findings (5)

- F-WF-6-1 [plan, high, flow] Consent re-prompt trigger and the declined result are undefined; the mockup shows the prompt on an Inbox page, but the story needs it at Call Elio. 'Not now' leads nowhere drawn. (ref: JF-12)
- F-WF-6-2 [plan, medium, consistency] Two places for a provider key and two 'Connected' marks: the transcription card (Wispr key) and the unchanged providers pane (ElevenLabs etc.), with no cue of which provider transcribes or speaks. (ref: NEW (touches JF-13))
- F-WF-6-3 [plan, low, flow] After Disconnect the state of the Transcription select is not drawn; the story step 8 says calls revert to the voice provider. (ref: NEW)
- F-WF-6-4 [plan, low, disclosure] Mockup copy beyond the plan: heading 'Voice sharing has changed', the consent sentence. (ref: JF-33)
- F-WF-6-5 [mockup, low, visual] Author notes inside the frame ('Provider pane unchanged: API key, Voice, Speech model, Hear a sample.', 'Nothing changes for anyone who leaves the default.', footnotes on consent and call screens). (ref: NEW)

## Screenshots

- screenshots/edge-rejected.png
- screenshots/mobile-check.png
- screenshots/step-1.png
- screenshots/step-3a.png
- screenshots/step-3b.png
- screenshots/step-4.png
- screenshots/step-5.png
- screenshots/step-5b.png
- screenshots/step-6.png
