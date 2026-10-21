# STORY-GS-5: The key stops working (needs_reconnect) (round 3)

**Result: PASS**

Outdated or changed by the plan: Step 1 (stale agent answer) is addressed by the plan (Reading: 'last synced {date}' added when needs_reconnect). Step 3: the key card shows its own status, Disconnect and an editable field (Surfaces, needs_reconnect).

Mockups walked: current `docs/granola/mockup.html` and `docs/wispr-flow/mockup.html` (commit 156dfe61b), dark theme, 1280x900, plus a 390x844 spot-check. Screenshots in `screenshots/`.

## Steps

- 1 Tile in the Reconnect needed frame shows an amber badge 'Reconnect needed' instead of 'Synced 42 meetings'. g-d-integrations-reconnect.png
- 2 Detail card: status row '● Reconnect needed' (warning dot, no 'Synced'), Disconnect, label with 'Business plan', key link, empty field, 'Granola rejected this key', Connect, consent sentence, Granola agent link. g-d-api-key-reconnect.png
- 3-4 Paste a new key (live): the rejection line clears, Connect enables; status stays 'Reconnect needed' until accepted (plan). g-d-api-key-reconnect.png
- 5 After a successful Connect the card returns to 'Synced 42 meetings' (connected frame). g-d-api-key-connected.png
- Mobile: one group with 'Reconnect needed', the key field, rejection line, Connect, consent footer and Disconnect. g-d-mobile0-reconnect.png

Geometry audit (geometry-audit.js, run once per distinct state at 1280x900 and 390x844, other screens hidden): pageOverflowX 0 in every state. wrappedControls: only the 'Get a key in Granola' link at 1280 px (false positive, one line in the screenshot; at 390 px it now sits on its own line above the field with its arrow intact), two-line option rows and the mobile glass back chevron (false positives). overflowSpills: citation Open popover on the desktop frames (popover sits at the frame edge, not clipped at 1280 px). Target sizes measured live: citation chips 32 px tall (were 21-24 px), web to-do checkbox target 32x32, mobile to-do checkbox button 44x44.

**390 px spot-check:** 390x844: reconnect card fits; mobile frame uses one native-style group. g-d-mobile0-reconnect.png

## Flow Log

Ideal 3 actions: open the page, paste, Connect. Actual 3. The status words and the tile now agree, so the user can find the problem from the Integrations list.

## Round-2 findings

| Round-2 id | Status | Evidence |
|---|---|---|
| F2-GS-5-01 | fixed | Status row reads 'Reconnect needed' with an amber dot, never 'Synced' (g-d-api-key-reconnect.png). |
| F2-GS-5-02 | fixed | Tile draws 'Reconnect needed' (g-d-integrations-reconnect.png), matching plan Surfaces. |

## New findings (round 3)

None.
