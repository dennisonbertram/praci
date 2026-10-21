# Brief: Devin page mockup v4 (static HTML, Rakazo), round 2

App purpose: Rakazo is a founder-facing app. The Devin page is a read-only view of what the founder's Devin coding agent is working on: sessions grouped Needs you, Working, Earlier, with status, pull request, source and last update. A needs-you row opens the session in Devin (the whole row is the link). A docked chat panel (the "Devin agent") answers questions about sessions. A notification toast announces "Devin needs input".

Persona: a busy founder, not an engineer, glancing between meetings to learn "does Devin need me, and what is it doing?". Mobile use is common.

Already decided, do not re-raise: shared warning/success text colours have low contrast (app-wide tokens, separate change); no scrim behind the narrow-width overlay panel (matches the real app); key-rejected state uses the app's plain red notice with an outline button (the real ErrorNotice); Ask is kept in empty and populated states and hidden in loading, load-error, not-connected; the mockup caption text above each frame and the width/theme toolbar are presentation, not product; dark-mode contrast reported by automated tools for color-mix() values is unreliable.

Screenshots: 1) main page with panel open, 1440 light; 2) first visit at 375 light; 3) key rejected, 1440 light; 4) connect dialog over the page, 1440 light; 5) two stacked notifications over Inbox, 1440 light; 6) agent missing panel, 1440 dark; 7) loading skeleton, 1440 dark; 8) main page with panel open overlaying at 900 light.

Judge as a ruthless senior product designer, but only report problems you can see in these images. Cite the screenshot file name and element. If a surface is excellent, say so.
