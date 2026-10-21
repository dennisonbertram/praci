# Judge brief: J1 which model-connect method leads on first run

Product: Praci, a planned native iPhone app. Persona: a non-technical founder who has just installed the app and has no model connected. Home shows "Connect a model"; thread with no model shows Not sent with Connect.
Problem: the Connect sheet lists API key (marked Recommended), Local server, Subscription. API key is the universal path, but the screen gives no way to get a key or paste one. Local server only works on the same network and was prefilled with localhost. Subscription Sign in appears as a gray bar next to a dimmed Connect.
Acceptance: one prominent action per frame; Get a key link and Paste on the key frame; Local server Address empty with a LAN placeholder; Home card says Chief cannot reply until a model is connected; no-model thread disables the composer with a plain line and a real Connect button.
Design rules: glass only on floating nav and controls, solid content, at most three glass groups, exactly one tinted prominent action per view.

A (minimal): keep API key first; add a Get a key link and a Paste button; empty Local server address; fix card and thread copy.
B (restructure): sheet opens on one Sign in with Model A button; "Other ways to connect" expands inline to API key and Local server.
C (Mail Add Account pattern): sheet opens on Sign in with Model A; an inset list "Other ways" with API key and Local server rows pushes to detail screens (key screen has Paste and Get a key); each detail has one Connect capsule.

Score each 1-5 on criteria, simplicity, consistency, usability, visual, effort. Pick a winner, at most one graft.
