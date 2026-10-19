# Walk report: STORY-EL-2

Verdict: NOT WALKED (blocked).
Reason: the story needs the offline Scripted voice provider connected first. On the mock demo (127.0.0.1:5380) Settings > Voice lists only ElevenLabs, OpenAI, Cartesia and Fish Audio, and a direct voice/connect with provider 'scripted' returned 400 'Unknown voice provider.' Without a ready provider, Call Elio only opens Settings (see STORY-EL-5), and Elio does not exist in the roster, so no call card, hang-up, or Elio chat could be reached. Details and evidence: docs/ux-walker/stories/STORY-EL-5/findings.json (F-EL-5-4).

