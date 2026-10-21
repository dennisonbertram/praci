# J1 proposal B (restructure): Subscription leads, other ways expand inline

Idea: one sheet, one decision. The sheet opens on a single prominent "Sign in with Model A" button. A collapsed row "Other ways to connect" expands in place to show API key and Local server fields.

Changes
- PG-A-HomeNoModel: sheet title "Connect a model"; body line "Use your Model A plan." Big capsule "Sign in with Model A" (only prominent action). Below it a disclosure row "Other ways to connect" with a chevron, collapsed by default.
- New frame "Other ways, expanded": the row opens inline to a segmented control (API key | Local server) and the matching field. API key: field with Paste button, "Get a key" link, then a Connect capsule that replaces Sign in as the one prominent action while the section is open.
- Local server: Address empty, placeholder "http://192.168.1.20:8000/v1".
- Remove the header Connect capsule and the three-row radio list. Remove "Recommended".
- Connected card, No-model card and thread no-model line as in A.
- PG-B-Models: Connect sheet gets the same layout; "Sign in with Acme AI instead" link is deleted because sign-in is now the lead.

Cost: sheet is rebuilt, a disclosure that moves content under the sheet when it expands, and the primary button changes meaning inside one view.
Weakness: expanding inline inside a medium-detent sheet pushes the footer and Privacy line down and can force the sheet to the large detent; the primary action swaps from Sign in to Connect, which is a moving target.
