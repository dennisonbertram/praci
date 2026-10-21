# J2 proposal C: Apple Mail convention (the object's verb is prominent)

Pattern: Apple Mail, Messages and Things put the create verb in the bottom-trailing prominent slot (Compose, New message, "+"). Reply is the prominent action in a message. Everything else is a plain toolbar item or a menu.

- List: prominent = Compose (as PH-Inbox draws it today). Message view: prominent = Reply.
- The agent is reached by the search capsule: the Search field is labelled "Search or ask Inbox agent" and typing a question hands off to the Inbox agent thread (a Linear or Things command bar pattern). The strip gets Search/Ask, Filter; More holds Cleanup.
- Strip set: Back; Search or ask, Filter; spacer; More; prominent Compose.
- Outer and inner boards (Sheet, Split, Inner, message): remove the tinted Ask circle; Compose becomes tinted.
- PH-Inbox keeps its tinted Compose and gains More.

Cost: large. It redefines Search, needs search-or-ask intent detection, and removes the only labeled route to the agent from the strip.
Risk: the product's main differentiator (the agent drafts replies) becomes a hidden behavior of a search field.
