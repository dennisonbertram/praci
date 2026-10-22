# Walk J3: phone width sweep (iteration 18)

Target: mock-data demo stack (web port 5381). Viewport 375x812, Chromium device emulation. Screenshots: /tmp/uxloop18/J3/.
Method note: headless Chromium here does not honour `pointer: coarse`, so touch targets could not be measured under real touch emulation. I injected the repo's `@media (pointer: coarse)` rules from `apps/web/src/styles.css` as plain CSS; Tailwind `pointer-coarse:` variants (for example the sidebar rows in `SidebarPageLink.tsx:80`) were NOT emulated, so target sizes below are marked unverified. I walked the journeys by name; I did not step through the catalog story texts line by line.

## Journey verdicts (steps actual/ideal)

| Journey | Verdict | Steps |
|---|---|---|
| Sign-in (landing, Sign in, email, password, submit) | PASS | 5/5 |
| Sidebar drawer (open, pages, spaces, account menu, Settings) | PASS | 3/3 |
| Inbox triage (open Inbox, wait, open mail, Archive, Undo) | PASS with friction (J3-01) | 6/4 |
| Finance overview (cards, period tabs, burn chart, breakdown) | PASS | 2/2 |
| Data room browse and preview | PASS with friction (J3-02, J3-03) | 3/3 |
| Agent chat with an approval (new bot, ask to send mail, toast, open card) | PASS with friction (J3-04); I did not press Send, the approval card was not mine | 7/5 |
| Settings (account menu, General sheet) | PASS (only General seen; the other four sections not opened) | 3/3 |

Geometry audit: `pageOverflowX` was 0 on every screen. No wrapped control labels that were visible in screenshots (script hits on tabs and chips were forced-min-width artefacts of my CSS injection, confirmed fine by eye). Console: no errors.

## Findings

| id | page | sev | cat | what happened vs expected | evidence | suspected code | fix |
|---|---|---|---|---|---|---|---|
| J3-01 | Inbox | P2 | perf / flow | OBSERVED. On first open the list shows "Sorting your mail..." with a skeleton, then an interim Today/Earlier list, then (after about 20 s) re-groups into a To do card plus "Needs reply" and moves every row. A tap in the interim list can land on a different mail. Expected: one stable layout, or no tappable rows until sorting finishes. | 06-inbox.png, 08-inbox3.png, 09-mail.png | `apps/web/src/pages/Inbox.tsx` (sorting state and grouping) | Keep rows non-interactive (or hold the list) until the sort result arrives so rows do not jump. |
| J3-02 | Data room preview | P2 | perf | OBSERVED. Opening a 711-byte PDF showed an empty grey skeleton for more than 10 s with no progress text, then the sheet shrank (about 430 px to 360 px). The content request itself returned 200 in under a second when I fetched it by hand, so the wait is in the client url resolution (dev stack, cause unconfirmed). | 15-preview.png, 16-preview2.png, 17-preview3.png | `apps/web/src/components/data-room/PreviewActions.tsx:98-104` (skeleton while `file.url` is empty) | Find why `file.url` resolves late; show the phone Open/Download fallback immediately instead of a skeleton. |
| J3-03 | Data room preview | P3 | visual | OBSERVED. On a phone the PDF fallback shows Open and Download buttons directly under icons in the header that do the same two things. | 17-preview3.png | `PreviewActions.tsx` (`PdfPhoneFallback`) | Drop either the header icons or the fallback buttons on phone width. |
| J3-04 | Agent chat | P2 | flow | OBSERVED. After asking a new bot to email Sam, the thread showed only a "Messaged Inbox agent" chip and the composer said "Waiting for approval". The approval card exists only behind the bottom toast, whose title is an unrelated mail subject ("Notice of Stockholder Action needs approval"). The card was already pending before I sent anything, so I could not tell whether it answered my request. SUSPECTED: if the toast is dismissed, the chat gives no path to the card (not tested; owner decision says the agent writes the link in chat, but no link appeared in 25 s). | 21-chat.png, 23-chat.png, 24-approval.png | approval toast and mail card, `apps/web/src/components/MailApprovalCard.tsx` | Name the recipient and the user's request in the toast, and show a card or link in the originating thread. |
| J3-05 | Account menu, 404 page, Finance header | P3 | a11y | UNVERIFIED. Under injected coarse CSS, account-menu items measure 32 px high, the Finance "Accounts" link 32 px high (next to the 44 px Ask button), and "Go to Praci" 32 px. Real touch may differ because Tailwind `pointer-coarse:` classes were not emulated. | 26-account.png, 12-finance.png | menu item component in `packages/ui-web`; Finance header link | Check these three with a real touch device or Playwright `hasTouch`. |

## Praise (observed)
- Sign-in, landing and 404 pages fit 375 px with no overflow.
- Inbox mail dialog on a phone shows labelled Reply, Archive and Ask agent buttons (not icon-only), 44 px high, and Archive gives a clear "Archived ... Undo" toast.
- The mail approval card in chat is full width, with From, To, Send and Discard, and Show more for the body.
- Finance cards, period tabs and the burn chart fit without horizontal page scroll; Settings is a full-screen sheet with a section dropdown and readable rows.

## Skipped / blocked
- Not walked: Settings sections other than General, pressing Send on an approval, the first-run tour on phone (it was skipped by an earlier session), Finance chart sideways scroll with real touch, dark/light check.
- Left behind in the demo: one bot named "J3 walker".
