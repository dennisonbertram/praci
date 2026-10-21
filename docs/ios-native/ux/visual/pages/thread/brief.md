# Brief: Thread screens, round 3

Praci is a planned native SwiftUI iPhone app for founders and small teams. Users chat with AI agents (Inbox agent, Finance agent, Legal agent, Chief) that read mail and documents and draft work. Agents never send mail or spend money without an explicit approval tap. The app is monochrome. Glass is used only on floating navigation and controls, with one prominent action per view and per-agent avatar shapes and colors.

Persona: a startup founder, non-technical, using the phone one-handed between meetings. First visit: they must agree to share data with the AI providers. After that they ask an agent to reply to a customer email, review the draft, and send it.

Screens (static mockups, fixed-size devices; judge each frame of each grid):
- PG-A-Thread: Duo outer display (466x678) frames: thread with a mail draft card, chat menu, clear and delete confirmations, archive with Undo, archived, draft replaced, empty recipient, agent editing the draft. Step: review the drafted reply and press Send.
- PG-A-ThreadStates: 20 frames of thread states (offline, failed, refused, oversize file, file limit, new messages, loading, could not refresh, archived, read only, session ended, reconnecting, first message, no model, computer block, approval scrolled away, running, stopping, approval pending). Step: understand and recover.
- PG-B-Consent: Duo outer. First-use speech consent sheet, after "Not now", model sharing off, Settings AI data sharing.
- PG-A-GroupThread: Duo outer. Group thread with two agents answering, menu, confirmations, archive.
- Inner: Duo inner display (890x626 per half). Inbox list beside the Inbox agent thread, and Finance beside its agent thread.
- DS-06-Chat: design-system spec of chat components.

Round 3: judge whether the gap-fix pass left anything below excellent, and whether earlier findings are fixed.
