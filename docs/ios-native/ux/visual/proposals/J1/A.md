# J1 proposal A (minimal change): keep API key first, make it completable

Idea: the sheet keeps its three-row list and its order (API key, Local server, Subscription). Fix only what blocks a first-time user.

Changes
- PG-A-HomeNoModel, API key frames (empty, not accepted): replace "Create a key in your Model A account under API keys." with a "Get a key" link (opens the provider's key page in Safari). Add a "Paste" text button inside the key field, right side. Connect stays the single capsule in the sheet header.
- Local server frame: Address field empty, placeholder "http://192.168.1.20:8000/v1". Helper line: "A model server on your network."
- Subscription frame: the "Sign in" gray bar becomes the only prominent control and the header Connect is hidden (nothing to confirm yet).
- Connected card (After connecting): "Model A connected. Chief can reply now." with Message Chief. "No model" Home card: "Chief cannot reply until a model is connected."
- PG-A-ThreadStates, No model: composer disabled with the line "Connect a model to send messages." and a Connect capsule (real button), replacing the 9 pt footnote below the frame.
- PG-B-Models, Connect sheet, empty key: same Get a key link and Paste button; keep "Sign in with Acme AI instead" as a link.

Cost: about eight text edits and two small controls. Rules: one prominent action per frame holds.
Weakness: the first thing a non-technical founder sees is "API key", a term they may not know, and the cheapest route for them (their existing subscription) sits third.
