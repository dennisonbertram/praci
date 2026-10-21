# Walk J3: phone width (375x812) sweep

Stack: mock-data demo (web port 5381), signed in as the demo founder. Screenshots: /tmp/uxloop3/J3/. All stories walked at 375x812 (the assigned phone viewport), not 1440x900. The demo has no working model key, so live agent replies fail ("model provider did not accept your API key"); that is an environment limit, not walked as a finding.

## Story verdicts

| Journey | Verdict | Steps actual/ideal | Note |
|---|---|---|---|
| Sign-in | PASS | 4 / 4 | Form fits, no overflow, show-password present. Landing hero wraps badly (J3-08). |
| Sidebar drawer | FAIL | 3 / 2 | Artifacts page hidden in clipped list (J3-01); toasts cover drawer (J3-05). |
| Inbox triage (open, archive, undo toast) | PASS with issues | 4 / 3 | Archive and Undo work; slow first load (J3-06), count jump (J3-07). |
| Finance overview | PASS | 3 / 3 | Cards, chart, breakdown, upcoming render cleanly; no overflow. |
| Data room browse and preview | PASS with issues | 4 / 3 | Preview works; toolbar crowded (J3-04), Escape needs two presses (J3-03). |
| Agent chat with an approval | PARTIAL | 3 / 3 | Only already-answered approval cards exist in the seed (Chief payment, Finance routine); card layout is clear on phone. A pending Approve/Deny tap was NOT observed. |
| Settings | PASS with issues | 4 / 3 | Opens as inset modal; tab strip is cut (J3-09); ambiguous labels (J3-10). |

## Excellent
- Chief chat on phone: readable bubbles, approval card is plain and states the amount, date and source account.
- Archive gives an immediate toast with Undo. Finance cards are balanced with no overflow. Page overflow was 0 px on every screen measured.

## Findings

| ID | Sev | Cat | Finding | Evidence | Suspected location | Fix |
|---|---|---|---|---|---|---|
| J3-01 | P1 | flow | Observed: in the phone drawer the Pages list is a 325 px box (40vh) with 384 px of content; the Artifacts row is cut off and the next section header sits right below, with no fade or scroll cue. Maya cannot see Artifacts exists. | 05-drawer-open.png; DOM: container clientHeight 325, scrollHeight 384 | apps/web/src/pages/Shell.tsx:4037 (`max-h-[40vh]`) | Remove the 40vh cap or raise it so all 7 pages fit, or add a bottom fade. |
| J3-02 | P1 | a11y | Observed: touch targets under 44 px are systemic: sidebar row action buttons 28x28, mail toolbar (Reply, Archive, Mark unread, Ask agent) 28 px tall, mail dialog close/prev/next 28x28, chat React/Reply/More 28x28, preview dialog icon buttons 28x28, drawer header icons 32x32, hamburger 32x32, settings switches 32x18, Skip tour/Next 28 px tall. | geometry/eval counts at 375 px on Chief, Inbox mail dialog, Data room preview, Settings | Shell.tsx:5088 (hamburger h-8 w-8); components/data-room/PreviewActions.tsx:124 (size icon-sm) | Use a 44 px hit area on coarse pointers (pointer:coarse) for icon buttons and switches. |
| J3-03 | P2 | a11y | Observed: opening a Data room preview puts focus on "Open in new tab", which shows its tooltip; the first Escape only closes the tooltip and the dialog needs a second Escape. | 12-preview.png, 12b.png; activeElement after Escape was still the button | components/data-room/PreviewActions.tsx:163 | Focus the dialog title or Close first, or let Escape close the dialog when a tooltip is open. |
| J3-04 | P2 | visual | Observed: Data room header on phone stacks title, a right-aligned icon row, workspace name, search, two filter rows and a processing banner before the first file (about 300 px of 812). Processing banner text wraps to 3 short lines ("Processing 1 / file", "1 couldn't read"). | 11-dataroom.png | apps/web/src/pages (Data room header and filter bar) | Collapse filters behind one Filters button on phone; keep title and actions on one row. |
| J3-05 | P1 | visual | Observed: agent "finished/failed" toasts stack up to three high (about 360 px) over the open drawer and over the chat composer area, covering the Inbox agent and Finance agent rows for about 20 s; list rows also reorder as agents run, so rows move under the finger. A tap meant for Inbox agent landed on Founder mail agent. | 15c.png, 15d.png, 16.png | toast host in Shell.tsx | Cap visible toasts to 1 on phones, and place them above the composer, not over the drawer. |
| J3-06 | P2 | perf | Observed: Inbox shows five empty skeleton rows for over 3 s on first open (still skeleton at about 3 s, loaded by about 7 s). Single sample on a local stack. | 07-inbox.png, 07b-inbox.png | pages/Inbox.tsx | Re-measure; show cached rows or page-size the first fetch. |
| J3-07 | P2 | flow | Observed: after archiving one mail, "Needs reply" went from 6 to 14 and the list changed (Quinn, Jamie, Landlord moved in). Cause not confirmed (suspected AI sorting finishing). The sidebar badge says 12, the section says 14. | 07b-inbox.png vs 09b.png | pages/Inbox.tsx:1467 | Do not show the section until sorting finishes, or keep one count definition for badge and section. |
| J3-08 | P3 | copy | Observed: landing hero has a hard line break so it wraps as "Bots that run your inbox, / cash, / cap table and investor / documents." with "cash," orphaned. | 01-landing.png | apps/web/src/pages/Welcome.tsx:22-26 (`<br />`) | Drop the `<br />` below sm and use text-wrap: balance. |
| J3-09 | P3 | visual | Observed: Settings opens as an inset modal (16 px margins) with 7 tabs in a strip; only 2.5 tabs show ("Mo..." clipped). A fade hints at scroll but nothing marks the current position. | 21-settings.png | pages/SettingsOverlay.tsx:222 | Make it full-screen on phone and use a list or select for sections. |
| J3-10 | P2 | copy | Observed: Privacy and approvals shows two switches both labelled "Bots, mail, files and contracts" and differing only by a small model name. Also all three "Action confirmations" switches are off while Chief says it asked for approval because the action was a payment, so the setting and the behaviour disagree visibly (may be seed state; unverified). | 22-privacy.png | components/AiDataSharing.tsx:167; components/ApprovalRulesSettings.tsx:131 | Label each row with the model name as the title, and confirm the defaults against the demo seed. |
| J3-11 | P3 | visual | Observed: Finance agent chat pins a Cash / Runway card header about 120 px tall on phone (about 15% of the screen) above the conversation. | 19.png | Finance agent chat header | Collapse to one line on phone. |

## Not covered
- Pending approval tap (Approve / Deny): no unanswered approval in the seed and agents cannot run without a model key.
- 1440x900 pass, other-page phone sweeps (Legal, Cap table, Contacts, Artifacts, Connect apps).
