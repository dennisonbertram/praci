# Judge brief: J5 where permissions and preferences live in Settings

Product: Praci, a planned native SwiftUI iPhone app for founders (chat with agents, plus pages such as Inbox, Finance). Boards are static mockups. Rules: glass only on floating nav; solid content; one tinted prominent action per view; native iOS controls; minimal copy. Boards: Duo outer display 466x678 and standard iPhone 393x852.

Problem: "Allowed without asking" (tools an agent may run without a prompt) is a row at the bottom of the AI data sharing page. Language, Appearance and Hide amounts (a switch that masks money figures; Finance pages also have an eye button for it) live only in Account. Server has a row in Settings and another in Account, plus a "Use a custom server" link when signed out. Settings root today: profile row, Models, Voice, Integrations, AI data sharing, Server, Archived bots. Account today: email, Change password, Server, Hide amounts, Language, Appearance, Sign out, Delete account. The standard-iPhone Settings frame differs from the Duo one (no Server, profile at bottom). Persona: a founder who wants to dark-mode the app, stop an agent from searching mail without asking, or mask amounts before a screen share.

Acceptance: "Allowed without asking" is a top-level Settings row; Language, Appearance, Hide amounts are in Settings; Server appears once after sign-in; Account keeps identity.

Proposals:
A. Add a top-level "Allowed without asking" row; remove Server from Account; Language, Appearance, Hide amounts stay in Account.
B. New top-level pages "Agent permissions" and "Preferences" (Hide amounts, Appearance, Language); Account is identity only; Server stays at root.
C. Apple Settings pattern: one flat grouped list; "Allowed without asking (3)" row beside AI data sharing; Hide amounts as an inline switch, Appearance as an inline menu row, Language opening iOS per-app Settings; Server once at the bottom; Account is identity only. No new pages. Root has about 10 rows plus the profile row and scrolls.

Score each proposal 1-5 on: (1) meets every acceptance criterion, (2) simplicity, (3) consistency with iOS conventions and the board set, (4) usability for the persona, (5) visual quality on a 466 pt strip, (6) effort and risk (5 = small and safe). Return a winner, an optional graft, and a short defense.
