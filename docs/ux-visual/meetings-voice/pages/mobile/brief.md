# Brief: mobile screens of two planned features (static mockups, iPhone frames)

Product: Rakazo, a monochrome (ink primary) startup-OS app with web, Electron and native iOS. Mobile is native-first: SwiftUI grouped inset lists, Liquid Glass back button, 44 pt targets, system keyboard. Copy is minimal on purpose; judge whether visible words are necessary.

Screens (all frames are drawn at 390x780 inside a 1440x900 page; the top page bar and the state pills above each phone are mockup tooling, not product UI):
1. Granola Integrations (left phone in the granola-key shots): a Slack row, then a "GRANOLA" group with a key field and Connect row, footer "Business plan". States: Empty, Connecting, Syncing, Connected ("Synced 42 meetings" + red Disconnect), Key rejected (red line "Granola rejected this key"), Needs reconnect (connected group plus a second empty key group plus the rejection line), Offline ("Could not reach Granola").
2. Granola Inbox (right phone in granola-inbox shots): a "TO DO" group of meeting follow-ups ("From: Pricing review, 12 Oct", due "Fri"/"Today"), a "2 more" row, and "Connect mail". States: Syncing, Empty ("No follow-ups from meetings yet"), With to-dos. Tapping anywhere on a row completes it and the row disappears at once, with no undo.
3. Wispr Flow Voice settings: "This device" check row, "PROVIDERS" list (ElevenLabs Connected, OpenAI, Cartesia, Wispr Flow "Transcribe only"), and a "WISPR FLOW" group with key field, Connect and a footer "Sends your recordings, text near the cursor and workspace names to Wispr Flow." States: Voice, Wispr Flow key, Verifying, Key rejected ("Could not connect this voice provider"), Connected (Disconnect row).

Intended journeys: paste a Granola key on the phone and see meetings sync; fix a rejected key (a free-plan user is the likely cause); see meeting follow-ups in the Inbox even with no mail account; choose Wispr Flow as the transcription provider, paste its key, consent via the footer sentence, and see which provider is active.

Judge against native iOS (inset grouped List, SecureField, glass chrome, 44 pt targets, readable secondary text, footers, destructive rows) and general norms. Give per-finding severity (P0 misleads, P1 a human stumbles, P2 below excellent, P3 polish), cite the screenshot file name and element, and name what is excellent. Do not invent elements you cannot see.
