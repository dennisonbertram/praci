# Walk report: STORY-MB-5

Verdict: FAIL (static iPhone-frame mockup, judged against native iOS conventions; 390px spot-check not applicable).

Findings: 9 total. Severity {'high': 1, 'medium': 6, 'low': 2}. Kind {'plan': 4, 'mockup': 5}.

## Steps

### Step 1
Voice list (Wispr mockup #screen-mobile): 'THIS DEVICE' group with toggle 'On · Free, works offline', then a Transcription row with value 'Use my voice provider' and chevron, then Providers. Geometry audit: clean. Rows 44-63 px. Native-looking grouped list; toggle is a native-style switch. LOOK pass: fine. 'Use my voice provider' next to a 'This device' toggle that is On is ambiguous about which one transcribes.
Screenshot: screenshots/step-1.png

### Step 2
Picker: pushed screen titled Transcription with two rows and a check on 'Use my voice provider'. Matches a native single-choice list. Wispr Flow is offered with no access check.
Screenshot: screenshots/step-2.png

### Step 3
Wispr Flow, key: Transcription row already reads 'Wispr Flow' before any key is accepted; a field with placeholder 'API key' and a Connect row appear. The placeholder does not name the provider.
Screenshot: screenshots/step-3.png

### Step 4
API access required: same frame plus a 13 px gray line 'API access required' below the Connect row. It appears with the field empty and no attempt shown, and offers no next step. Transcription still reads Wispr Flow.
Screenshot: screenshots/step-4.png

### Step 5
Connected: row 'Connected' plus red Disconnect row; Transcription row still 'Wispr Flow'. No confirmation for Disconnect is drawn.
Screenshot: screenshots/step-5.png

## Flow Log

Ideal 3 steps (Settings, Voice; pick Wispr Flow; paste key and confirm). Mockup shows picker, key, Connect, Connected: 5 taps including picker back-navigation, versus 3. No Verifying state and no Key rejected state on mobile (web has both). Hesitation: provider name absent from the key field; two controls named 'This device' and 'Transcription' without a stated relationship.

## Findings

- F-MB-5-1 [high, plan, NEW] Wispr Flow is offered to every user in the picker with no way to know whether the org has API access; the only handling is a gray 'API access required' line, which in the mockup appears with no attempt made.
- F-MB-5-2 [medium, mockup, NEW] Transcription row shows 'Wispr Flow' as soon as it is picked, before a key is verified; in the blocked state it still reads Wispr Flow although calls cannot use it.
- F-MB-5-3 [medium, mockup, NEW] Key field placeholder is the generic 'API key', the same label the voice providers use; it does not name Wispr Flow.
- F-MB-5-4 [medium, mockup, NEW] No Verifying and no Key rejected state on mobile; web draws both.
- F-MB-5-5 [medium, mockup, NEW] 'API access required' is 13 px neutral gray, not destructive color.
- F-MB-5-6 [medium, plan, NEW] Red Disconnect has no confirmation drawn. Native iOS uses an alert or action sheet for destructive actions; plan is silent.
- F-MB-5-7 [medium, plan, JF-11] 'This device' (On) and 'Transcription' sit together with no stated precedence; story MB-6 shows the call plan ignores Transcription when This device is on.
- F-MB-5-8 [low, plan, NEW] Providers list labels each 'Speak + transcribe' or 'Speak only'; Flow is transcribe-only and fits neither.
- F-MB-5-9 [low, mockup, NEW] Same as MB-1: no Liquid Glass or native glass back control; picker is a pushed list rather than an inline menu.
