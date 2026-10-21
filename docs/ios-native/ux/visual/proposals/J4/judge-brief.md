# Judge brief: J4 Home roster and section noun

Product: Praci, a planned native SwiftUI iPhone app for founders (chat with agents, plus pages such as Inbox, Finance, Legal). Boards are static mockups. Rules: glass only on floating nav; solid content; one tinted prominent action per view; minimal copy; prefer native iOS controls.

Problem: the Home section called PERSONNEL holds agents and a group, and the empty state says "No agents yet". Finance agent and Legal agent appear only in Activity (they have tasks), so they have no list entry without recent work. Standard iPhone 393x852 and Duo outer display 466x678. The Home currently shows four agent rows then PAGES. The New menu and sheet say "New agent". The group member picker lists only four agents.

Acceptance: every agent is reachable from Home; one noun for the section; groups handled; Pages stay reachable; no new copy without need.

Options:
A: rename to AGENTS, list every agent (7 rows) and group, recency sorted. No new control. Pages pushed lower.
B: section becomes RECENT (4 rows); a new "Agents" row in PAGES opens a new alphabetical Agents screen with search. New route and frames.
C: section AGENTS, 4 most recent rows (plus any unread row), then an inline "Show 3 more" disclosure row that expands in place (Things / Apple Mail Show More pattern).

Score each option 1-5 on: criteria (x3), simplicity (x2), consistency (x2), usability (x2), visual (x2), effort and risk (x1; 5 = small and safe). Return JSON with scores per option, winner, optional graft and a short defense.
