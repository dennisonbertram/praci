# J2 proposal A: minimal change

Keep what the outer and inner boards already do: "Ask Inbox agent" is the one tinted action. Make PH-Inbox and the other boards agree with it, and add the missing More.

- Prominent action: Ask Inbox agent (chat-bubble icon), on the Inbox list and on the message view. Compose and Reply are plain glass.
- Strip set, the same on every size: Back; one actions group of Search, Filter, Compose; spacer; More; the prominent button last. The message view uses Back; Archive, Reply; spacer; More; prominent.
- Cleanup lives in More ("Cleanup", list icon). More is its own capsule below the spacer, not a fourth icon in the actions group (PG-A-Cleanup draws it as the fourth icon today, which breaks the three-icon rule).
- PH-Inbox: remove the tint from Compose; add an Ask Inbox agent circle (tinted) and a More circle. Top bar becomes Back | spacer | [Search, Filter, Compose] | More | Ask. That is three groups plus the prominent one.
- Split: drop Hide amounts and Important only from the strip (leftovers from Finance). Strip becomes [Filter, Compose], More, Ask. Search stays in the header field.
- Inner: the list column is passive. Cleanup is added to the existing Agent actions menu.
- DS-03/DS-04: fix the anatomy order text and the popover rows.

Cost: small. Every board gets a one-line change.
Risk: Compose (manual mail) is two icons deep nowhere, but a person who just wants to write a mail sees the agent as the loudest button.
