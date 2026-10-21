# Brief: Devin page mockup v5 (static HTML, Rakazo), round 2

App purpose: Rakazo is a founder-facing app. The Devin page is a read-only view of what the founder's Devin coding agent is working on: sessions grouped Needs you, Working, Earlier, with status, pull request, source and last update. A needs-you row opens the session in Devin (the whole row is the link). A docked chat panel (the "Devin agent") answers questions about sessions. A notification toast announces "Devin needs input".

Persona: a busy founder, not an engineer, glancing between meetings to learn "does Devin need me, and what is it doing?". Mobile use is common.

Already decided, do not re-raise: sidebar count (no dot), title-only header, whole row is the link, PR shown as plain text, full question text, Error rows counted in Needs you with a reason line, dialog label "Organization service-user key", agent has only Session search; shared warning/success text colours have low contrast (app-wide tokens, separate change); no scrim behind the narrow-width overlay panel (matches the real app); key-rejected state uses the app's plain red notice with an outline button (the real ErrorNotice); Ask is kept in empty and populated states and hidden in loading, load-error, not-connected; the mockup caption text above each frame and the width/theme toolbar are presentation, not product; dark-mode contrast reported by automated tools for color-mix() values is unreliable.

Screenshots (in order): 1) f1-1440-light main page with Ask; 2) f0-1440-dark page with panel open; 3) f9-1440-light key rejected; 4) f17-1440-light connect dialog over page; 5) f20-1440-light stacked toasts over Inbox; 6) f4-1440-dark agent missing; 7) f1-375-light first visit at 375; 8) f0-900-light panel overlaying at 900.

Judge as a ruthless senior product designer, but only report problems you can see in these images. Cite the screenshot file name and element. If a surface is excellent, say so.
