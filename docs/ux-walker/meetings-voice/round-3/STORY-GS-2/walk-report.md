# STORY-GS-2: Invalid key on a Business plan (round 3)

**Result: PASS**

Outdated or changed by the plan: Step 4: the plan decides one rejection line for every cause (Surfaces, Errors); judged against that decision. Step 1 masking is now defined (type=password, S6 tests).

Mockups walked: current `docs/granola/mockup.html` and `docs/wispr-flow/mockup.html` (commit 156dfe61b), dark theme, 1280x900, plus a 390x844 spot-check. Screenshots in `screenshots/`.

## Steps

- 1 Paste a truncated key: field shows dots (masked). g-d-api-key-entering.png
- 2-3 Connect rejected: status stays empty, line 'Granola rejected this key' in red under the field, Connect dim, link 'Get a key in Granola' still visible. Nothing else appears: no agent, no status row. g-d-api-key-rejected.png
- 5 Edit the field (live): the red line disappears, aria-invalid is removed, the link stays visible, Connect becomes enabled. Checked by script on the rejected and the reconnect frames.
- Edge: Granola unreachable. Frame 'Offline' shows 'Could not reach Granola' with the field value kept and Connect enabled for a retry; the key link is not shown while the field has text (plan: only while empty or rejected). g-d-api-key-offline.png, mobile g-d-mobile0-offline.png

Geometry audit (geometry-audit.js, run once per distinct state at 1280x900 and 390x844, other screens hidden): pageOverflowX 0 in every state. wrappedControls: only the 'Get a key in Granola' link at 1280 px (false positive, one line in the screenshot; at 390 px it now sits on its own line above the field with its arrow intact), two-line option rows and the mobile glass back chevron (false positives). overflowSpills: citation Open popover on the desktop frames (popover sits at the frame edge, not clipped at 1280 px). Target sizes measured live: citation chips 32 px tall (were 21-24 px), web to-do checkbox target 32x32, mobile to-do checkbox button 44x44.

**390 px spot-check:** 390x844: rejected card fits, link on its own line. g-m-api-key-rejected.png

## Flow Log

Ideal 3 actions: paste, Connect, read the line, retry in the same field. Actual 3 plus one edit. The recovery link stays visible after a rejection, so the step 'create the key again' has a target.

## Round-2 findings

| Round-2 id | Status | Evidence |
|---|---|---|
| F2-GS-2-01 | fixed | Link 'Get a key in Granola' is visible in the rejected state and after editing (script: links = ['Get a key in Granola'] in both). One line for all causes remains by plan decision (Surfaces, Errors), so a typo and an expired key still read the same; accepted. |
| F2-GS-2-02 | fixed | Web 'Offline' frame and mobile 'Offline' frame both show 'Could not reach Granola' (plan Errors: same on web and mobile). |
| F2-GS-2-03 | still-open | No reveal control on the masked field in the plan or either mockup. Low, accepted by the plan's secure-field rule. |
| F2-GS-2-04 | fixed | Script: after typing, aria-invalid is null and the alert is gone. |

## New findings (round 3)

None.
