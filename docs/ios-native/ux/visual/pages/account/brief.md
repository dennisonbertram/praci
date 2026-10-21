# Brief (round 2)

Praci is a planned native SwiftUI iPhone app: a startup operating system where the user talks to bots (agents) in spaces. These boards are static iPhone Duo outer-display mockups (466x678, a narrow content strip beside a side strip holding the time and floating glass back/close buttons). Each board is a grid of labeled states.

Persona: Sam, a first-time founder installing Praci, who signs up, confirms email, connects a model, then adjusts voice, integrations and privacy settings, and may switch server, sign out or delete the account.

Screens and journey step:
- PG-B-SignIn (8 states), PG-B-SignUp (1 state): get into the app by SSO or email.
- PG-B-ForgotPassword: reset password and confirm email (6 states).
- PG-B-Server: sheet to point the app at a custom server (7 states).
- PG-B-Account: view account, sign out, delete account (7 states).
- PG-B-Settings: settings root, archived bots, AI data sharing (4 states).
- PG-B-Models: default model, thinking level, providers, add server (8 states).
- PG-B-Voice: device voice vs hosted voice, sounds (7 states).
- PG-B-Integrations: connectors, connector detail, server integrations (6 states).

Design rules: glass only on floating nav controls, solid content, one tinted prominent action per view, 44 pt targets, product name Praci. Judge each frame for: does Sam know where he is, what to do next, and is every state (error, loading, empty, disabled) drawn.
