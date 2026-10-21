# Brief

Praci is a planned native SwiftUI iPhone app: a startup operating system where the user talks to bots (agents) in spaces. These boards are static iPhone Duo outer-display mockups (466x678, a narrow strip of content beside a floating nav column with the time and glass back/close/confirm buttons).

Persona: Sam, a first-time founder installing Praci, who signs up, connects a model, and later changes voice and integrations settings.

Screens and journey step:
- PG-B-SignIn, PG-B-SignUp: get into the app (SSO or email). Sign in shows its error state.
- PG-B-ForgotPassword: recover a password (two states: request, check email).
- PG-B-Server: sheet to point the app at a custom server address (error state).
- PG-B-Account: view account, sign out, delete account (three states).
- PG-B-Settings: settings root listing Account, Models, Voice, Integrations, AI data sharing.
- PG-B-Models: choose default model and thinking level, add providers/servers.
- PG-B-Voice: device voice, hosted voice provider, sounds.
- PG-B-Integrations: add connectors; advanced server integrations (two states).

Design rules: glass only on floating nav controls, solid content, one tinted prominent action per view, 44 pt targets.
