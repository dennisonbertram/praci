# UX Flow Critique, round 2: Granola and Wispr Flow (2026-10-20)

Evidence: the current plans and mockups after the round-1 fixes (commit 34443e36f). Every count is as planned or as mocked; nothing is built or user-tested. Screenshots are in `round-2/screens/` and are not committed.

## Verdicts (round 1 to round 2)

- IF-1: acceptable to minimal on the happy path, and acceptable when consent is off.
- GS-1: acceptable to acceptable.
- MX-8: acceptable to acceptable. MX-3 is obsolete because S7 is deferred.
- WF-6: convoluted to acceptable, near minimal.
- MB-1: convoluted today and acceptable as planned, to minimal as planned. It is not buildable until S6 ships.

## Friction scorecard

The round-1 ideals assumed that the agent chat opens automatically after Connect and that a pasted key submits itself. FX-35 rejected both, so the ideals below are recounted without them.

| Journey | Round 1 actual / ideal | Round 2 actual / ideal | Needless decisions | Dead ends |
|---|---|---|---|---|
| IF-1 | 3 / 2 | 2 / 2 (+1 Allow if consent is off) | 0 to 0 | 3 to 3, all recorded as deliberate in plan S5 |
| GS-1 | 7 / 3 to the first answer; 8 / 4 to the to-do | 6 / 5; 7 / 6. The remaining gap is the agent-link click | 3 to 0 | 3 to 1, deliberate |
| MX-8 | about 13 / 7 | 13 / 12 with the optional agent question; 10 / 9 without it | 4 to 0 | 4 to 1, deliberate |
| WF-6 | 8 / 7 on web; 9 / 7 on the phone | 7 / 7 on web; 7 / 7 on the phone | 2 to 0 | 2 to 2, deliberate |
| MB-1 | 6+ / 4 (not possible today) | 4 / 4 as planned | 1 to 0 | 1 to 1, accepted |

## Round-1 items

All 11 ranked proposals are fixed. Two residuals remain: N3, where the mockup contradicts the plan's precedence rule, and N4, the leftover "From:" prefix.

Of the 19 redundancy findings:

- **Fixed (15):** D1 to D4, I1, I2, I4, O1, O3, O4 and H1 to H4.
- **Partly fixed (3):** D5 is fixed between meeting to-dos; mail-to-meeting linking stays open and is accepted. I3 is fixed for Flow and still open for Granola (N1). O2 is fixed by wording; both tile subtitles stay "Meeting notes", which is accepted.
- **Obsolete (1):** O5.
- **Still open and accepted (1):** H5.

The journey-level items FX-34, FX-35, FX-39 and FX-51 stay rejected, as the fix list recorded.

## New findings

- **N1 (medium).** Granola consent is asked only in the Inbox, using the mail-worded prompt, and a meeting-only user may have no mail at all. When the key is connected first, the agent fails with "AI-data sharing off" and gives no route to the setting.
  - Plan: Granola S5 and S6.
  - Fix: ask at Granola Connect with one sentence under the button, the same pattern as Flow, and drop the Inbox prompt for meeting-only users.
- **N2 (medium).** The Flow consent sentence says "text near the cursor", but calls send no cursor text.
  - Plan: Flow S3a.
  - Fix: write "Sends your recordings and workspace names to Wispr Flow." in all four places.
- **N3 (low).** On the phone mockup the checkmark moves to the Flow row, which contradicts plan S3b.
  - Fix: keep the checkmark on "This device", show only "Connected" on the Flow row, and drop the repeated header.
- **N4 (low).** The mockup to-do rows still show "From:", which FX-22 dropped.
  - Fix: delete the prefix.
- **N5 (low).** The Wispr mockup's state script shows the daily-cap alert in the normal call state. This is in the mockup only.
- **N6 (low).** The Granola detail page draws only the key card, while the plan puts the MCP sign-in first.
  - Fix: draw the existing MCP block above the key card.
- **N7 (low).** On mobile, the plan places "Business plan" after the field label, but the mockup draws it as a footnote. The plan also doesn't say whether the phone shows the key link.
  - Fix: one sentence in the plan, and move the label in the mockup.

The copy added in round 1 passes the take-away test. The one exception is the Flow consent sentence (N2).
