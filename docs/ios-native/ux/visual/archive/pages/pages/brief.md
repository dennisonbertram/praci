# Brief

Praci is a planned native SwiftUI iPhone app. These are static design boards, not live screens. Most boards are grids of labeled frames; each frame is one state of one screen on the iPhone Duo outer display (466x678 pt, one vertical strip of floating glass controls beside the Dynamic Island, content to the right). Desk and Desk-Computer are the laptop pose (626x890: the view on the top half, controls on the bottom half).

Praci is an AI "startup OS". A first-time founder with a small team talks to bots (Chief, Inbox agent, Finance agent, Legal agent). The bots read mail and finance data, keep pages and lists, run routines, make artifacts (documents and images), and share a Team computer (a remote browser that a bot or a person can drive).

Persona: a first-time founder who wants to check runway, contracts, the cap table and files, read what the bots made, take over the Team computer when a bot needs a login, and tune a bot or group, in the fewest taps and without jargon.

Screens in this batch and the step each serves:
- PG-B-Finance: check cash, runway, burn, accounts and upcoming bills; hide amounts.
- PG-B-Legal: see contracts and their status, run a scan, see failures.
- PG-B-CapTable: see who owns what, reconnect Carta, add a contact, open a holder.
- PG-B-DataRoom: find and add files, watch uploads, open a file and ask about it.
- Desk, Desk-Computer: the same Finance page with the Finance agent chat, and the Team computer with the keyboard, in the laptop pose.
- PG-A-Computer: watch the Team computer, take or release control, and recover from errors.
- PG-A-AgentPage, PG-A-AgentList: read a bot's page and tick its checklist.
- PG-A-Artifacts, PG-A-Artifact, PG-A-Image: browse what bots made, read a document with versions, view and share an image.
- PG-A-Routine: see scheduled bot jobs, their history, pause or edit one.
- PG-B-BotSettings, PG-B-GroupSettings: rename and recolor a bot, choose group members, save or delete.

Design rules: glass only on floating nav and controls; solid content; at most three glass groups; exactly one tinted (cream) prominent action per view; concentric corners; product name "Praci".
