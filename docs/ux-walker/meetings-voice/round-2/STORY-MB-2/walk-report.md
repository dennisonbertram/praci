# STORY-MB-2: Granola rejects the key on the phone (round 2)

**Verdict: PASS**. Walked the current mockup and plan on 2026-10-20 in session uxw2-flow.

## Steps
1. Key rejected: field keeps dots, Connect active, destructive footnote "Granola rejected this key" (screenshots/steps-rejected-reconnect-offline.png). The "Business plan" footer from the Empty state is gone.
2. Needs reconnect: a "Synced 42 meetings" group with Disconnect, then a second group with an empty key field, dimmed Connect and the rejection line.
3. Offline: key kept, Connect active, "Could not reach Granola" in destructive color (plan marks wording as placeholder).

## Geometry
Run on docs/granola/mockup.html#screen-mobile with the phone frame measured directly (390 x 780 pt frame). Rows 44-63 pt, body 17 px, section header/footer 13 px, large title 34 px, glass back 40 pt. No overflow or spill.

## Native iOS check (mobile frame)
Grouped inset list, uppercase 13 pt section header, 17 pt row text, centered link rows, red Disconnect, large title, round glass back button, home indicator: all match iOS. Gaps against iOS: status bar is three dots, glass back is 40 pt (44 pt recommended), no spinner beside Connecting..., error lines use 13 pt destructive footnotes as iOS does.

## Flow log
Same 3 steps as ideal; the cause is still not stated where the error appears, the hint is only visible before the attempt.

## Round-1 findings
- F-MB-2-1 (high): **still-open**. Hint "Business plan" now exists (FX-24) but only in the Empty state; in the rejected state the footer is not drawn. Downgraded to medium (N1): the hint was seen once before the error.
- F-MB-2-2 (medium): **fixed**. Line is destructive color, 13 pt footnote.
- F-MB-2-3 (medium): **fixed**. Offline and needs_reconnect drawn; 429 retries silently by plan.
- F-MB-2-4 (low): **still-open**. Field shows dots only after a paste; no clear control. A native SecureField has a system clear option on focus; not annotated.

## New findings
- F2-MB-2-1 [mockup, medium] Rejected state drops the "Business plan" footer, which is the only clue to why a valid-looking key fails.
- F2-MB-2-2 [mockup, medium] Needs reconnect reads "Synced 42 meetings" with Disconnect directly above a rejected-key form, with no time. The status row suggests sync works, and a second headerless group repeats Connect.
- F2-MB-2-3 [plan, low] "Could not reach Granola" is a placeholder wording.
