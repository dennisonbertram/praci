# Walk report: STORY-EL-5 (call does not start)

Verdict: PASS for Case A (behaviour matches the story), with findings. Case B not walked.
Stack: mock demo at 127.0.0.1:5380, signed in as the mock founder, desktop 1440x900 and mobile 390x844.

## Preconditions
No voice provider is connected (voice/status returned configured:false, ready:false). Elio did not exist in the roster before or after the walk.

## Flow log (Ideal path 3 steps; Case A took 1 click to reach the provider form)
1. Chief chat, composer shows a round mic button named "Call Elio" (step-0.png). Hover for 1s showed no tooltip (step-0b-hover.png).
2. Click Call Elio: no call, Settings > Voice opens (step-1.png). Providers: ElevenLabs, OpenAI, Cartesia, Fish Audio. API key field and disabled Connect. No explanation. See F-EL-5-1, F-EL-5-2. No console errors (only Vite debug lines).
3. Close voice settings (and Escape also closes): back in the chat, no message, no call (step-2.png). A first-time user is not told what to do next.
4. Mobile: Call Elio is in the composer (mobile-0.png); it opens the Voice dialog laid out as a single column, with no overflow (pageOverflowX 0, mobile-1.png). Mic button is 32x32.
5. Geometry audit: no overflow on the new screens; the "wrappedControls" hit is the provider rows with name plus subtitle, which is by design.

Hesitations: Maya asked for a call and got a settings form. Nothing explains what Elio is or how it differs from Chief; the entry sits inside Chief's chat, so it reads as calling Chief (story edge case confirmed).

## Case B
Not walked: needs a connected provider, which is unavailable (F-EL-5-4).
