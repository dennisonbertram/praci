# Walk J1: long journeys (iteration 16)

Walker session uxl16-J1, demo stack web :5381, 1440x900. A fresh invented user (walker-j1-<n>@northwind.example.test, random password) was signed up for the first-run stories; the seeded mock founder was used for the Monday and board stories (Hide amounts was turned back off at the end). Screenshots: /tmp/uxloop16/J1/.

## Story verdicts

| Story | Verdict | Steps actual / ideal | Note |
|---|---|---|---|
| STORY-APP-001 sign-up to first useful chat | PASS | 8 / 5 | Sign up (3 clicks incl. form), pick A, Connect Gmail card, ask first question, Allow consent card. No model or server step (demo has a deployment model). |
| STORY-APP-319 model -> Connect your apps -> tour -> first question | PARTIAL: model and Connect-your-apps steps BLOCKED, tour and first question PASS | tour 9 stops + 1 | The demo already has a model and configured apps, so neither onboarding page appeared. The 9-stop tour ran cleanly (fixed card spot, names the item, ring on the row). It only started after leaving Chief (J1-03). |
| STORY-INB-022 first morning, empty to clear Inbox | PASS (adapted: demo mail differs from M1-M11) | about 14 / 18 | Sort, reply (answered mail left Needs reply: good), archive with Undo, "Add to Data room" from the attachment menu (3 clicks, was 5). First sort stalled (J1-01). |
| STORY-INB-109 Monday inbox reset | PASS (partial) | Important, Cleanup, Newsletters, Digest walked | Digest and Cleanup are clear. Updates pile not opened. |
| Runway check before a board meeting (STORY-APP-211 steps 3 to 7, 11) | PASS | 2 / 2 (Finance, Runway card) | Runway on the first screen of Finance; detail page with projection; Hide amounts masks Finance, Runway, Investors and chat text. |
| STORY-APP-211 steps 1, 2, 4, 8 to 10, 12 to 14 | SKIPPED | | Reply-all/Undo, Carta agent prompt, forward and Chief talking points were not run (model-dependent, shared demo data). |
| STORY-APP-024 Monday across the app | SKIPPED | | Overlaps the stories above. |

## Findings

| id | page/story | sev | cat | what happened vs expected | evidence | suspected code | proposed fix |
|---|---|---|---|---|---|---|---|
| J1-01 | INB-022 step 3 | P1 | perf | OBSERVED: first mail sort for the new user stayed on "Sorting your mail..." then "Sorting is taking longer than usual" for over 70 s; "Try sorting again" then finished in under 30 s. Cause not established. | 10-inbox-first.png, 12-inbox-after.png, 13-retry.png | not located (inbox triage job start after consent) | Find why the first triage run stalls after consent and start it on the Allow click; if it is slow, say so before 15 s. |
| J1-02 | INB-022 step 12 | P2 | flow | OBSERVED: "Add to Data room" in the attachment menu closes the menu with no toast or inline message; the only sign is "Added" when the menu is reopened. | 28-added.png, 29-added2.png | apps/web/src/components/inbox/MailAttachments.tsx:121-138 (add sets state but no message), :454-459 (status line only shows downloads) | Show a short "Added to Data room" status line on success. |
| J1-03 | APP-319 steps 8 to 12 | P2 | flow | OBSERVED: after connecting Gmail and picking "Run my company", the tour did not start on Chief; it started at stop 1/9 only when I opened Inbox, while the Inbox was still sorting. SUSPECTED: Chief's Calendar card left unconnected keeps the tour waiting. | 08-answer2.png, 10-inbox-first.png | apps/web/src/pages/Shell.tsx:2781-2790 (connectCardsWaiting) | Start the tour once the first question is answered, or when any connect card is connected, not only after leaving Chief. |
| J1-04 | INB-022 step 3, new user | P2 | flow | OBSERVED (demo classifier may explain): about 19 of 24 mail rows landed in "Needs reply" (5 shown + "Show 14 more"), including an intro request and a vendor draft; this weakens the one phrase for mail wanting an answer. | 13-retry.png, 23-more2.png | not located (triage prompt/threshold) | Check the triage threshold on the demo mailbox; keep Needs reply for mail that asks a question. |
| J1-05 | APP-211 step 7 / Legal | P2 | visual | OBSERVED: Contracts table truncates the contract name at about 150 px ("MOCK Insurance Poli...", "MOCK Consulting Ag...") while Term and Renewal columns have spare width; names are the row identity. | 37-Legal.png | apps/web/src/pages/legal/LegalContracts.tsx:204-238 (column widths, truncate) | Give the name column the spare width (or let it wrap to two lines). |
| J1-06 | INB-022 step 13 | P3 | flow | OBSERVED: expanding "Show N more" in Needs reply shrinks the To do card from 4 tasks to 1 and the due-today task leaves the top; the tasks reappear as "To do" chips on rows. Intended dedupe, but the card jumps. | 22-more.png, 25-repro.png | apps/web/src/pages/Inbox.tsx:1071-1076 (repeatsRow) | Keep the card height or show "3 tasks shown on rows" instead of dropping them silently. |
| J1-07 | INB-022 step 7 | P3 | flow | OBSERVED: after Send, the "Sending... Undo" toast drops its Undo after a few seconds but "Sending..." stays for about 10 s more before the reply appears under "Later in this conversation". | 16-sent.png, 17-sent2.png, 18-sent3.png | not located (send queue) | Show "Sent" as soon as the provider accepts, or hide the toast once Undo expires. |
| J1-08 | APP-001 step 8 | P3 | copy | OBSERVED: Chief's reply says "Inbox agent is still sorting Maya's mail" to Maya (third person). Model text. | 08-answer2.png | Chief delegation reply prompt (not located) | Tell the model to write "your mail" when relaying to the user. |
| J1-09 | INB-022 | P3 | copy | OBSERVED: "Reply all" is offered in More for a single-recipient mail (Cloudnine invoice). | 20-more.png | mail dialog More menu (not located) | Hide Reply all when there is one recipient. |
| J1-10 | INB-022 step 12 | P3 | a11y | OBSERVED: sidebar link is named "Data room, new" but shows no visible mark after the add. | 30-dataroom.png (snapshot name) | sidebar row in apps/web/src/pages/Shell.tsx (not located) | Show the same new marker visually, or drop it from the name. |
| J1-11 | Legal Deadlines | P3 | copy | SUSPECTED seed mismatch: deadline text says the policy "renews on December 1"; the Contracts row term ends Dec 2, 2026. | 38-deadlines.png, 37-Legal.png | demo seed data (not located) | Align the seed dates. |
| J1-12 | Inbox Cleanup | P3 | visual | OBSERVED: the empty Cleanup view is one line of text top-left on an otherwise empty page, with no header actions. | 41-cleanup.png | Inbox cleanup view (not located) | Center the empty state or keep the page actions. |

## Excellent, keep

- Welcome and sign-up are two short screens; Chief's first card has three options and a dismiss; connect cards flip to "Connected" in place.
- Runway is on the first screen of Finance (24.2 mo, until Oct 2028), matches Chief's answer, and the Runway page explains what is counted (crypto toggle, cash breakdown).
- Hide amounts masks Finance, Runway, Investors and the chat text, with "Amounts hidden - Show" in the header.
- Legal Deadlines: "Overdue by 5 days" is clear, with Ask agent / Done / Dismiss on each row.
- Newsletters Digest with "Archive all 9 messages from 6 senders" is a one-click Monday cleanup.
- After replying, the mail leaves Needs reply (settles the old UNVERIFIED in INB-022 step 13).
- Tour stops: fixed card spot, names the item, ring on the target row; unknown URL shows a clear "Page not found" with "Go to Praci".

Console showed no errors during the walk. Not walked: GTM page for a new user (sidebar row is a button, not a link), Updates pile, Carta agent prompt.
