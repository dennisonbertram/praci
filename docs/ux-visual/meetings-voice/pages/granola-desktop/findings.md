# Granola desktop screens: ux-visual findings

Screens: `docs/granola/mockup.html` #screen-integrations, #screen-api-key, #screen-agent, #screen-citation, #screen-disconnect. Session `uxv-granola`. Inspected with agent-browser at 1440x900, 768x1024 and 375x812 in light and dark (18 states x 3 viewports x 2 themes; viewport and full-page shots in `shots/`, named `{viewport}-{theme}-{screen}-{state}.png`). Audits for every shot are in `audit.json` (layout-audit and geometry-audit; the mockup's index nav, state pills and theme toggle ignored, other sections hidden so each audit covers one screen). Interactions were run by hand at 1440 light (tab order, focus, typing a long pasted key, Enter, hover, popover and dialog dismissal). Second opinions: `second-opinion.json` (muse = meta/muse-wonder, argon = google/gemini-4-argon), checked against the screenshots below.

Measured facts: no horizontal scroll at any viewport (pageScrollX 0 everywhere); the only contrast failure is the bot avatar initial (white on #e8743b, 3.0:1); one small target (citation chip, 21 px high); one wrapped control (key link at 375).

## Verdicts per state

| Screen / state | Verdict |
|---|---|
| 1 Not connected | Clear and compact. The tile sits under "Connected apps" and shows no sign that it is clickable (GD-16). |
| 1 Detail page | One field, one link, one button. Clean, but it is the only thing on the page: no MCP route for free or Pro users (GD-04). |
| 1 Sign-in only | Tile reads "Connected". Works. The tile it links to is the key-card screen, not an MCP page (GD-04). |
| 1 Key connected | Tile reads "Synced 42 meetings". Good. A revoked key would look identical here (GD-05). |
| 2 Empty | Good. Connect is disabled until typing; tab order is back, link, field. |
| 2 Entering | Good. Masked key, Connect becomes the one primary button. |
| 2 Connecting | Good: value kept, field disabled. Button grows 78 to 108 px (GD-17). |
| 2 Syncing | Good, but no sense of progress or completeness (GD-27). |
| 2 Connected | Strong. Two lines plus the agent link. Disconnect is louder than it needs to be (GD-08). |
| 2 Key rejected | Good. One plain error, field keeps its value, red border plus words. The key link disappears (accepted by plan). |
| 2 Needs reconnect | Weakest state of the screen: green "Synced" dot over a rejected key (GD-06), no key link (GD-07), no tile signal (GD-05). |
| 3 Pricing question | Good. Citation at the claim. Chip is hard to tell from tool chips (GD-14). |
| 3 Vendor call | Good. Same. Meeting named three times in 40 px (tool chip x2, citation; plan decision FX-58, noted only). |
| 5 Closed | Good. |
| 5 Open | Popover is 411 px away from its chip (GD-03). |
| 5 Delete | Names the cascade ("and its to-dos") but not the meeting or Granola's copy (GD-02). |
| 6 Before | Fine. Frame has no page header (GD-21). |
| 6 After | The right three-surface idea. The sentence in the card answers the wrong question (GD-01). |

## Findings

Level is component, group, page or layout. Target says where the fix lives: mockup (fix in HTML), plan (the plan text must change), design-system (token or shared component). Found by: own, muse, argon. Verified: yes means confirmed against a screenshot, audit metric or a manual interaction.

| id | level | element | problem | norm | evidence | severity | found by | verified | target |
|---|---|---|---|---|---|---|---|---|---|
| GD-01 | group | Disconnect "After" card, line "Your data in Granola is not deleted." | The sentence reassures about Granola's copy. What the user needs is that Rakazo keeps the 42 synced meetings, the agent still answers from them and the to-dos stay (the other two After frames show exactly that). With no confirmation dialog, the empty key form can read as "wiped". Journey GS-7 step 3 predicts this misreading. The card also drops the agent link although the agent still works. | C1, C2 (says the wrong fact), I3 (post-action feedback) | 1440-light-disconnect-after-full.png (top card vs the two frames below); catalog GS-7 step 3 | P1 | own, muse, argon | yes | plan (Surfaces, Disconnect copy) |
| GD-02 | component | Delete confirmation "Delete this meeting and its to-dos?" and popover "Delete" next to "Open in Granola" | The dialog does not name the meeting and does not say the Granola note is untouched. "Delete" sits beside "Open in Granola", so the user can think it deletes in Granola. The cascade is irreversible and there is no undo. | I3, C1 | 1440-light-citation-confirm.png, 1440-light-citation-open.png | P1 | own, muse, argon | yes | plan (S6 copy the PR quotes) |
| GD-03 | component | Citation popover position | Popover opens under the left edge of the message text (x=439) while its chip is at x=850: 411 px apart at 1440. Nothing ties it to the chip. | L7, I1 (actions near what they act on) | 1440-light-citation-open.png; getBoundingClientRect: pop x=439, chip x=850 | P1 | own, argon | yes | mockup (and the Storybook story when built) |
| GD-04 | page | Detail page, Sign-in only and Key connected pages | The plan says the existing MCP controls come first and the key card below, so a user without a key reaches MCP sign-in. The mockup draws only the key card; "Sign-in only" links to the key-card screen. A free or Pro user (GS-4) sees a field they cannot use and no other way in. | I5, P1 (journey GS-4 blocked as drawn) | 1440-light-integrations-detail.png, 1440-light-integrations-mcp.png; plan Surfaces, "Page order" | P1 | own | yes | mockup |
| GD-05 | group | Integrations tile in a needs_reconnect state | The tile shows one status line. For a revoked key the plan does not say what it shows, the mockup draws nothing, and the card state keeps "Synced 42 meetings". The user learns sync stopped only by opening the detail page; meanwhile to-dos silently stop. | C3 (status legible in one predictable place), I2 | 1440-light-integrations-key.png vs 1440-light-api-key-reconnect.png | P1 | own | yes (absence verified) | plan (tile status for needs_reconnect), then mockup |
| GD-06 | component | Status line "● Synced 42 meetings" in Needs reconnect | Green dot and "Synced" above a red field and "Granola rejected this key". Contradicting signals. Muse and argon rated P0; downgraded because the red error line sits directly under it. | H4 (semantic color only for its meaning), C3 | 1440-light-api-key-reconnect.png | P2 | own, muse, argon | yes | plan (keeps the status line) and mockup (neutral or warning dot, history wording) |
| GD-07 | component | Key link "Get a key in Granola" in Needs reconnect | Empty state shows the link; Needs reconnect has an empty field but no link. By the plan's own rule (shown while the field is empty) it should show. The user replacing a revoked key has the most use for it. | I3 (recovery), H5 | 1440-light-api-key-empty.png vs 1440-light-api-key-reconnect.png | P2 | own, muse, argon | yes | mockup |
| GD-08 | component | "Disconnect" red-outline button on Connected, Syncing, Reconnect | The most colorful control on the card, the same treatment as the irreversible Delete, for an action that keeps all data and has no confirmation. Competes with the status line and the agent link. A lighter text-style button, or undo after the click, keeps the decided no-dialog rule. | H2 (destructive distinct but not dominant) | 1440-light-api-key-connected.png | P2 | own, muse, argon | yes | mockup |
| GD-09 | group | Sidebar "Granola agent" in Empty, Entering, Connecting, Key rejected (screen 2) | Plan: the agent is created only after the connection succeeds, never at a rejected key, and FX-5 says no agent in the sidebar until a route connects. Screen 1 "Detail page" has no agent; screen 2 empty shows one. | H5, plan consistency | 1440-light-api-key-empty.png, 1440-light-api-key-rejected.png vs 1440-light-integrations-detail.png | P2 | own | yes | mockup |
| GD-10 | component | Label "Granola API key · Business plan" | The muted fragment can be read as the key's name or type, not as "needs a Business plan". A free user pastes a key into a field they cannot use (GS-4 step 2). Plan fixed this wording (FX-24); a word such as "Requires" costs one word, no new line. | C1 | 1440-light-api-key-empty.png | P2 | own, argon (praised it), muse (P2) | yes | plan |
| GD-11 | layout | Label and key link at 375 | The label wraps ("plan" on line 2) and the link wraps with its arrow alone on the second line. geometry-audit reports a wrapped control. | L6, H6 | 375-light-api-key-empty.png; geometry wrappedControls: "Get a key in Granola ↗" (also in the 768 and 375 details and disconnect frames) | P2 | own, muse, argon | yes | mockup (stack link under label, nowrap arrow) |
| GD-12 | component | Text field boundary | Border #e6e6e6 on #fff (light) and #2a2a2a on #171717 (dark) is about 1.25:1, below 3:1 for the only visible edge of an input. Shared token, not specific to Granola. | A1 | 1440-light-api-key-empty.png, 1440-dark-api-key-rejected.png; computed from tokens | P2 | own | yes | design-system (border token or input style) |
| GD-13 | component | Inbox row detail "From: Pricing review, 12 Oct" in the Disconnect After frame | Plan: detail is "{title}, {date}" with no "From:" prefix, so no new string. The mockup still draws "From:" (also on screen 4). | C4 (copy earns its place), plan consistency | 1440-light-disconnect-after-full.png; plan, Digest section | P2 | own | yes | mockup |
| GD-14 | component | Citation chip vs tool chips; chip size | Tool chips (outline, transparent) and the citation chip (grey fill) differ only by fill, so the one interactive chip does not look interactive. Chip is 21 px high (below 24). Muse's "collapse the tool trace" is a plan decision (FX-58) and not accepted. | I1, I4 | 1440-light-agent-inject.png; layout-audit smallTargets a.cite 136x21 | P2 | own, argon | yes | mockup |
| GD-15 | group | Agent answers after Disconnect | The agent keeps answering from stored meetings. The skill adds "last synced" only for needs_reconnect or failing sync, so after Disconnect nothing says new meetings are not included. Journey GS-7 step 3 again. | C3, I2 | 1440-light-disconnect-after-full.png (middle frame); plan, Reading section | P2 | muse (own confirmed in plan text) | yes | plan |
| GD-16 | component | Granola tile under "Connected apps" | A not-connected app sits under a "Connected apps" heading. The Granola tile is a link, the Slack tile is a div, and they look identical with no hover or chevron. | H5, I1 | 1440-light-integrations-new.png | P3 | own | yes | mockup |
| GD-17 | component | Connect to "Connecting…" | Button grows from 78 to 108 px, text and focus move. | L5 | 1440-light-api-key-entering.png vs -verifying.png | P3 | own | yes | mockup |
| GD-18 | component | Hover on red outline buttons | `.btn.bad` overrides `.btn:hover`; computed background stays transparent on hover (Disconnect, Delete). | I8 | manual hover, 1440-light-api-key-connected-hover-disconnect.png | P3 | own | yes | mockup |
| GD-19 | component | Popover and delete dialog dismissal | Escape and outside click close neither the popover nor the dialog; no focus return; popover is role=dialog but not modal. Base UI supplies this when built, so only a note for the story. | I7 | manual test (afterEsc open=true, afterOutsideClick open=true) | P3 | own | yes | mockup |
| GD-20 | component | Bot avatar initial | White 11 px bold on #e8743b is 3.0:1. | A1 | layout-audit lowContrast ratio 3 in every shot with an avatar | P3 | own | yes | design-system (bot color token) |
| GD-21 | page | Disconnect and citation frames | Before and After card frames omit the back link and page header; the After chat frame omits header and composer. Frames differ in what is drawn. | H5 | 1440-light-disconnect-before.png, -after-full.png | P3 | own, argon | yes | mockup |
| GD-22 | component | Disabled Connect, Enter on the field | Disabled Connect differs from a secondary button only by text color. The mockup has no form, so Enter does nothing; the built field must submit on Enter (the plan says paste alone must not). | I7, I8 | 1440-light-api-key-empty-typed-long.png; manual Enter (state stayed "empty") | P3 | own, argon | yes | mockup |
| GD-23 | layout | Spacing values | Off-scale paddings 5, 6, 10, 14 px; near-duplicates 10/12/14/16. | D3 | layout-audit spacing.offScale in audit.json | P3 | own | yes | mockup |
| GD-24 | component | To-do checkbox in dark | Unchecked native checkbox draws as a solid white square (no color-scheme set), reading as checked. | H5, I8 | 1440-dark-disconnect-after-full.png | P3 | own | yes | mockup |
| GD-25 | layout | Composer "Ask Granola agent" | Sits under the last message, not pinned to the bottom of the pane. Likely a short-frame effect. | P1 (chat convention) | 1440-light-agent-answer.png | P3 | own | partly (frame is 300 px high) | mockup |
| GD-26 | component | Popover line "Dana Reyes, you" | Unlabeled; "you" among attendees is odd. | C1 | 1440-light-citation-open.png | P3 | own | yes | plan (copy) |
| GD-27 | component | Syncing and "Synced 42 meetings" | No hint whether 42 is all or the first batch of the 90-day backfill (GS-1 step 6). Plan chose this on purpose (FX-27); noted only. | C3 | 1440-light-api-key-syncing.png | P3 | own | yes | plan |
| GD-28 | group | Agent link position | Under the status row when connected, after Connect when needs reconnect. | H5 | 1440-light-api-key-connected.png vs -reconnect.png | P3 | own | yes | mockup |

## Counts

By severity: P0 0, P1 5, P2 10, P3 13 (28 total).
By level: component 18, group 5, page 2, layout 3.
By target: plan 7 (GD-01, 02, 05, 10, 15, 26, 27), plan and mockup 1 (GD-06), mockup only 18, design-system 2 (GD-12, GD-20).

## Second-opinion claims not accepted

- muse P1 "no password masking" on the key field: wrong, the field is type=password and masks in Entering.
- muse P1 "no value proposition line on the detail page" and argon P3 the same: contradicts AGENTS.md (no explainer copy) and the plan's no-placeholder rule.
- muse P1 "show last synced time and key identity": decided in FX-27 (no relative time unless late).
- muse P1 "popover needs title and excerpt": decided in FX-13 (no repeated title) and the plan has no meeting page.
- muse P2 low-contrast and "color alone": audit finds no low-contrast text except the avatar; every status has words.
- muse P3 "composer needs a send button": the composer is a stand-in in the mockup.
- argon P2 "modal buttons off-center, no solid red": buttons are right-aligned to the card edge, and the outline destructive style is the shared pattern.
- argon P2 "chat column stops at 68 percent": 640 px column is a reading-measure choice (D1).
- muse and argon P0 on the green dot: kept, rated P2 (GD-06).

## Excellent as is

- The key card in every state is two or three lines with one primary action; Connect is the only filled button and appears only once a key is typed.
- Masked key field that keeps its value while connecting and after rejection; the field disappears once connected, so no stored secret is displayed.
- One plain error line, "Granola rejected this key", with aria-invalid and role=alert, red border plus words, cleared on edit.
- Status uses words as well as color everywhere (badges, "Synced 42 meetings", "Syncing").
- Tab order is logical (back, key link, field), disabled Connect is skipped, focus ring is visible on the filled button.
- Orange is used only on the bot avatar; the app stays monochrome in light and dark, and both themes keep the same structure.
- Citation chip format "Pricing review, 12 Oct" at the claim; the confirm title names the cascade ("and its to-dos").
- The agent link on the connected card closes the GS-1 step 5 gap (the user learns the agent exists and where it is).
- Disconnect After draws consequences on three surfaces (card, chat, Inbox), which is the right test for retention.
- No horizontal overflow at 375, 768 or 1440 in either theme.
