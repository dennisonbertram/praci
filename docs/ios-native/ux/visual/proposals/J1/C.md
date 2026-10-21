# J1 proposal C (convention): Mail "Add Account" pattern, sign in first, "Other options" push to a detail screen

Pattern named: Apple Mail / Settings Add Account. A first screen offers the easy provider sign-in as the one prominent action; secondary methods are a grouped inset list that pushes to a detail screen, which has its own back button. Linear and Things do the same: one primary continue button, and "use a key / other" as a quiet link.

Changes
- PG-A-HomeNoModel, first frame "Connect a model": sheet has only the close X (no header capsule). Body: capsule "Sign in with Model A" (the one tinted prominent action), caption "Uses your Model A plan." Below, an inset grouped list titled "Other ways": rows "API key" and "Local server", each with a chevron. Privacy footer unchanged.
- API key detail (pushed, back chevron "Back"): field with a Paste button on its right, "Get a key" link below it, then a capsule "Connect", dimmed until text exists. Frames: empty, filled, not accepted (red field, "Key not accepted."), connecting (spinner in the capsule).
- Local server detail (pushed): Address empty, placeholder "http://192.168.1.20:8000/v1", helper "Only works on the same network.", capsule "Connect".
- Sign-in states: a Safari handoff frame is reused from PG-B-Models (Acme AI sign-in code sheet).
- After connecting: card "Model A connected. Chief can reply now." with Message Chief. New hidden until first message; Chief row previews the latest message after the first send.
- No-model Home card: "Chief cannot reply until a model is connected." with Connect capsule.
- PG-A-ThreadStates, No model: composer disabled, line "Connect a model to send messages.", real Connect capsule.
- PG-B-Models: Connect sheet uses the same screens; "Sign in with Acme AI instead" link becomes the primary capsule; API key lives under "Other ways".

Cost: sheet becomes a NavigationStack, two detail frames per board. Native: List with insetGrouped style, NavigationLink, PasteButton, Link.
Weakness: API key users need one more tap than today (one tap on the row; the key is then on its own focused screen).
