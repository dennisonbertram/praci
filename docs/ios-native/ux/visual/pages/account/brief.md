# Brief: Praci native iPhone app, account and settings boards (round 3)

Praci is a startup operating system: a chat app where a founder talks to bots (inbox agent, planner, data room, banking) that read mail, files and bank data and ask approval before writing. The native SwiftUI iPhone app is planned; these are static design boards for the iPhone Duo outer display (466x678, one narrow column). Each board is a grid of labeled states.

Persona: Sam Rivera, a founder, first install, signs in on a phone, later connects a model and integrations and checks what bots may do. Not a developer; "server" and "API key" are unfamiliar words.

Screens and journey step:
- PG-B-SignIn: first launch, sign in with SSO or email and password; error, loading, session ended, keyboard states.
- PG-B-SignUp: create an account; field errors, email in use, confirm email hand-off.
- PG-B-ForgotPassword: reset password and confirm email flows.
- PG-B-Server: sheet to point the app at a custom Praci server.
- PG-B-Account: profile, change password, sign out, delete account flows.
- PG-B-Settings: settings hub, archived bots, AI data sharing, allowed-without-asking list.
- PG-B-Models: choose default model, connect a provider, add a local server.
- PG-B-Voice: pick device or hosted voice, sounds, hosted key setup.
- PG-B-Integrations: connect mail/calendar/banking connectors, allow writes, server integrations.

Rules: glass only on floating controls, one prominent action per view, 44 pt targets, product name Praci.
