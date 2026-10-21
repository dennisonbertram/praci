# Walk R3: verify pass-3 fixes C20-C28

Target: mock-data demo stack (web :5381), 1440x900 unless noted, plus 1280x800, 1920x1080 and 375x812 where the acceptance named them. Screenshots in /tmp/uxloop4/R3/.

Caveat: other walkers use the same demo user at the same time. During my session agents answered questions, ran, and posted on their own (Investor Relations question answered, Chief "What is our runway?", Legal and Carta agents active). I could not attribute those to my clicks, so C26 "opens scrolled to a pending question" could not be tested on a live pending question.

Storybook smoke: built to /tmp, `node .storybook/smoke.mjs`: 1557/1557 stories rendered cleanly. No failing stories.

## Verdicts (steps = actual / ideal)

| Cluster | Verdict | Steps | Notes |
|---|---|---|---|
| C28 chat list groups page agents | PASS | 1/1 | Chief + user bots visible; "Page agents 5" collapsed row; the dot ("Needs you") appeared once another walker's approval was pending. |
| C20 Settings density | FAIL (partial) | 3/3 | Dialog height follows content (326-760 px), active nav has fill, 375 uses a select, user menu has no second line, Models shows Disconnect. Not met: auto-file email setting still in Privacy; Models has no "Replace key" fold; dialog re-centres so nav jumps. |
| C21 Apps page | FAIL (partial) | 1/1 | All cards have a logo or neutral glyph; grid auto-fills at 1440 and stacks at 375. Connected footers still differ; no divider under the title. |
| C22 Artifacts and Contacts | FAIL (partial) | 2/2 | Distinct Doc/Sheet/Page icons; list default at 375; Contacts table right edge = Add contact button at 1440 and 1920; Customer and Advisor kinds exist. No Ask on Contacts or Artifacts. |
| C23 Finance | FAIL (partial) | 3/3 | Overview 1277 px tall (under 1300); 5 KPI tiles fine at 1440 and at 1280 (3+2); Crypto page leads with $105,250. Fails: lone tile at 1280 with Ask open; vendor list and detail show different figures. |
| C24 Landing and auth | PASS | 2/2 | 375 hero balanced, Sign up filled; invalid link reads "Reset link expired"; both inputs get aria-invalid on bad sign-in. |
| C25 Copy and small chrome | PASS (partial, 2 items unchecked) | 4/4 | One Chief bubble above connect cards; delete-bot dialog has no memory question (bot had no memories); Built-in skills show names only; composer is 900 px wide at 1920, same as thread. Not checked: create menu, bot row flag. |
| C26 Chat thread and approval cards | FAIL / PARTIAL | 1/1 | After answering the onboarding question, activeElement was BODY, not the composer. Scroll-to-pending, thinking timer, draft-skill Approve/Discard in chat, attachment preview: not testable on the mock (no live pending item, no real model). |
| C27 Data room Auto-sort and Send to agent | PARTIAL | 3/3 | Send to agent lists Data room, Legal, Finance, Chief first, no thread agents: PASS. Auth-error failure path BLOCKED: the demo model works for Auto-sort, so the error, "Open Models settings" and fail-fast could not be triggered. |

Stories from the catalog were not walked one by one; this pass verified each cluster's acceptance list.

## Findings

| id | page / cluster | sev | cat | what happened vs expected | evidence | suspected code | fix |
|---|---|---|---|---|---|---|---|
| R3-01 | Finance subscriptions, C23 | P1 | bug | Observed. Globex Cloud: list column "Usual per month" shows $2,016; detail tile "Average per month" shows $1,728 ("Last 6 full months"). Same vendor, two figures, the list label names no window. Expected one figure, or labels naming the windows. | c23-sub.png, c23-globex.png | apps/web/src/pages/Finance.tsx:947; apps/web/src/pages/finance/FinanceSpend.tsx:321; packages/core/src/finance/metrics.ts | Use one metric for both, or label the list "Median, 3 months" and the detail "Average, 6 months". |
| R3-02 | Finance at 1280 with Ask open, C23 | P2 | visual | Observed. With the Ask panel open the 5 KPI tiles lay out 2+2+1; "Treasury yield" sits alone. Expected no lone tile. | c23-ask.png (compare c23-1280.png, 3+2) | apps/web/src/pages/Finance.tsx:508-516 | Make the KPI grid react to container width so 5 tiles go 3+2 or 5-up, never an odd last tile. |
| R3-03 | Settings Privacy / Data room, C20 | P2 | flow | Observed. "Add email attachments to the Data room" is still a Privacy switch; Data room Add files > Email dialog ("Import from email") has no such control. Expected it in the Import menu. | c20-m1.png, c27-email.png | apps/web/src/pages/AccountSettingsOverlay.tsx (only user of AutoFileEmailSetting.tsx) | Move the switch into the Data room Email import dialog. |
| R3-04 | Settings Models, C20 | P2 | visual | Observed. Connected OpenRouter shows Disconnect, "Sign in with OpenRouter", a Replace API key field, and Test API key and Replace API key buttons all open. Expected one primary key action with a Replace-key fold. | c20-Models.png | apps/web/src/pages/ModelSettingsOverlay.tsx:1029-1127 | Collapse "Sign in", Replace field and buttons behind one "Replace key" fold while connected. |
| R3-05 | Settings dialog, C20 | P2 | visual | Observed. Dialog height follows content, but it re-centres, so the nav list jumps: Models nav item at y=182, Memory view puts it at y=438 (dialog 760 px vs 326 px). Moving between sections shifts the clickable targets. | c20-Models.png vs c20-Memory.png; dialog heights 760/326/403/706 | apps/web/src/pages/AccountSettingsOverlay.tsx:252-270 | Pin the dialog top (align to top with a fixed offset) and let only the bottom edge move. |
| R3-06 | Apps, C21 | P2 | visual | Observed. Connected cards do not share a footer: Gmail, Carta, Mercury, Brex show "Used by"; Coinbase has none but a "Replace key" button; Blockscout has a "..." overflow, the rest do not. | c21-apps.png | apps/web/src/components/integrations/IntegrationsHome.tsx | Give every connected card the same footer (status, primary action, one overflow menu holding Replace key). |
| R3-07 | Apps, C21 | P3 | visual | Observed. Title sits at the right height but has no header bar or divider; Artifacts and Contacts show a divider under the header (Artifacts) / none (Contacts). Pages still do not share one header. | c21-apps.png, c22-artifacts.png, c22-contacts.png | shared page header component | Use the same header component on Apps, Artifacts, Contacts. |
| R3-08 | Contacts and Artifacts, C22 | P2 | flow | Observed. No Ask button on Contacts or Artifacts (Finance and Data room have one). No documented reason in Contacts.tsx. | c22-contacts.png, c22-artifacts.png | apps/web/src/pages/Contacts.tsx, apps/web/src/pages/Artifacts.tsx | Add Ask for Chief, or record why not. |
| R3-09 | Contacts data, C22 | P3 | copy | Observed. Demo customers (Robin Prospect, Sam Samplesworth) and the advisor (Casey Advisor) have Kind "Other" although Customer and Advisor now exist. Suspected seed data, not code. | c22-contacts.png | demo seed fixtures | Set kinds in the demo seed. |
| R3-10 | Chat answer focus, C26 | P2 | a11y | Observed once. After answering the Chief onboarding question, document.activeElement was BODY about 4 s later. Expected the composer. | eval output; fresh user in a second session | apps/web/src/components/AskCard.tsx:109 (focus call exists; focus is lost afterwards, composer may re-render or be disabled while the run starts) | Focus the composer after the run state settles, or keep it enabled. |
| R3-11 | Onboarding Chief, C25 | P3 | copy | Observed. "Run my company: Cash, cap table, investors and email" leads to "Email, calendar, and your company pages", with only Gmail and Google Calendar to connect. Cash and cap table sources are not offered. | c25-onb2.png | onboarding reply copy | Offer finance and cap table connections for that choice, or reword the option. |
| R3-12 | Chat error bar / toast, all agents | P2 | copy | Observed. Red text "The tools finished, but the model did not write a final answer. Rephrase the request and try again." shows in Chief, Investor Relations and as a "Chief failed" toast on pages where I sent nothing. "Rephrase the request" blames the user for a model failure. Likely caused by the demo's placeholder key (Models says "scans fail"). | c25-1920.png, c26-ir.png, c27-file.png | chat error text in pages/shell/composer-error.tsx (suspected) | Reword to "Chief could not finish. Try again." and give a Retry. |
| R3-13 | Auto-sort dialog, C27 | P3 | visual | Observed. Plan view first flashes a flat list of all 50 files with "No change" rows, then becomes a grouped checklist; all 10 proposed moves are unticked (files already in folders) and the primary button reads "Apply 0 changes" disabled with no hint. About 9 s to plan. | c27-auto2.png vs c27-auto3.png | apps/web/src/components/data-room/AutoSortDialog.tsx:117-130, 286-293 | Show one view; when nothing is ticked, say "Tick moves to apply". |
| R3-14 | Apps at 375, C21 | P3 | perf | Observed under load (other walkers and the Storybook smoke ran). Skeleton cards still shown 2.5 s after load; content at about 5 s. Not retested on an idle machine. | c21-apps375.png | IntegrationsHome.tsx data load | Re-measure idle before acting. |

## Praise

- C24: the 375 landing page is balanced and the filled Sign up is clear; error inputs get aria-invalid and a visible red ring.
- C23: the Crypto page opens on the $105,250 total and the wallet subtotal ($47,250) matches its rows.
- C27: Send to agent puts the page agents and Chief first and leaves out thread agents.
- C22: artifact cards show distinct Doc, Sheet and Page icons; phones default to a compact list.
- C28: the Page agents row keeps the chat list short, and the dot appears when an agent needs the person.

## Not verified

C26 scroll-to-pending, thinking timer, draft-skill Approve/Discard, attachment preview; C25 create menu and bot row flag; C27 auth-error failure path (mock model succeeds); C22 "Value (USD)" label; C20 Usage and Updates sections (not shown for this user), 375 full-screen style (dialog is inset, select used).
