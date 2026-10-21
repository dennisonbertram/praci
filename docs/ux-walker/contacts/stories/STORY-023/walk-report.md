# STORY-023: Data room agent files a document and saves parties

Status: blocked by data, one finding
Session: walk-c (walk-c2 after the first browser session hung)

## Screens
- step-1: Data room page with the Ask Data room agent control.
- step-3: agent replies it cannot find an Auditwell engagement letter; my sent message shows as a one-letter-wide bubble.
- step-4/5/6: second request about the Pilot Agreement; agent asks which one (Halcyon Logistics or Bolt Freight) with two answer buttons, then says the document has no signer information, so nothing is saved.
- mobile-check: 390px, the agent panel fills the screen and bubbles wrap normally.

Geometry audit: pageOverflowX 0, no wrapped controls; unevenRows hits were the sidebar name/time rows and overflowSpills the message hover action bar, both intentional and not logged.

## Flow Log
No contact could be saved because the story's letter does not exist and the Pilot Agreement names no signer. The clarifying question with buttons was clear. See F-023-01 for the collapsed message bubble.
