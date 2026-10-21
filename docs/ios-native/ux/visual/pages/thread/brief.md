# Brief: Thread screens, round 1

Praci is a planned native SwiftUI iPhone app for founders and small teams. Users chat with AI agents (Inbox agent, Finance agent, Legal agent) that read mail and documents and draft work. The agents never send mail or spend money without an explicit approval tap. The app is monochrome, with glass only on floating navigation and controls, one prominent action per view, and per-agent avatar shapes and colors.

Persona: a startup founder, non-technical, using the phone one-handed between meetings. First visit: they must agree to share data with the AI model provider. After that they ask an agent to reply to a customer email, review the draft, and send it.

Screens (static mockups, fixed-size devices):
- PG-A-Thread: Duo outer display (466x678). Single-agent thread. Step: review the agent's drafted reply and press Send or Save.
- PG-A-ThreadStates: three Duo outer panels. Step: understand and recover when a message is waiting offline, failed to send, or was refused.
- PG-B-Consent: Duo outer. Left panel: first-use sheet asking to share data with the model provider. Right panel: Settings, AI data sharing toggles.
- PG-A-GroupThread: Duo outer. Group thread with two agents answering.
- Inner: Duo inner display (890x626). Inbox list beside the Inbox agent thread.
- DS-06-Chat: design-system spec of chat components (bubbles, composer, mail approval card, tool approval, ask card, voice player).
