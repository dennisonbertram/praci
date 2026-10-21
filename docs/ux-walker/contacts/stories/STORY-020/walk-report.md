# STORY-020: Ask who is our auditor

Status: pass
Session: walk-c (walk-c2 after the first browser session hung)

## Screens
- step-2: progress line 'Reading your contacts' observed while Chief runs.
- step-3: reply names Quinn Auditwell, Auditwell LLP (Mock) and quinn@auditwell.example.test.
- mobile-check: 390px chat wraps bubbles cleanly, email link intact.

Geometry audit: pageOverflowX 0, no wrapped controls; unevenRows hits were the sidebar name/time rows and overflowSpills the message hover action bar, both intentional and not logged.

## Flow Log
Actual 2 steps, ideal 2. No hesitation.
