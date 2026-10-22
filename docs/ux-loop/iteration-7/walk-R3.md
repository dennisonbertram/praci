# Walk R3 (iteration 7): verification of pass-6 clusters C21-C31

Walker session uxl7-R3, mock-data demo stack (web :5381), 1440x900 unless stated. Signed in as the mock founder (Maya) and, for empty states and non-admin checks, a throwaway user (walker-r3@northwind.example.test) from an earlier pass. Screenshots are in /tmp/uxloop7/R3/.

Environment note: during the walk the host load average was 400 to 470 (many walkers running Chrome and a Storybook build), so every cold load took 10 to 120 seconds and some API calls failed. Timing findings are marked as suspected environment effects.

## Verdicts

| Story / cluster | Verdict | Steps actual/ideal | Notes |
|---|---|---|---|
| C21 Artifacts header, open sheet, empty toolbars | PASS | 3/3 | Header is one row at 375 loading and loaded. Open 5-row sheet card is 173 px (content plus about 24). Empty Artifacts, Contacts and Inbox show only Ask (Add contact / Connect mail). Remaining nit R3-07. |
| C22 Finance header and stat grids | PASS | 4/4 | Company name shows at 375 on Finance, Burn and Runway; Burn and Runway headers are identical. Sub-page header is tall: R3-06. |
| C23 Digest vs Newsletters | BLOCKED (partial) | 3/3 | Digest is now a separate control at the right, not a fourth tab. By-sender lines and Archive-all Undo could not be seen: the demo newsletters are 8 days old and Digest only lists the last 7 days, so it shows "No mail" (R3-02). |
| C24 Data room phone and wide | PASS | 6/5 | 375: three view icons visible; first file row at y=207 including the 56 px app bar (151 px of page chrome, at the 150 px limit). Status column appears only because one row is Failed. Auto-sort title is "Sort every file in the Data room" (scope named). Preview shows all metadata. No focus ring after pointer close. |
| C25 Settings polish | PASS | 5/5 | Memory empty shows no Filter or Download. X shares the select row at 375. Notifications moved to General. Models has two folds. Sign-in card absent for the throwaway user and present for Maya (admin). |
| C26 Duplicate entry points | PASS | 2/2 | User menu keeps Integrations (owner decision). Task board is absent from user menu and palette. |
| C27 Command palette | PASS | 3/3 | "Halcyon" shows Contacts and Documents (3 files) without scrolling, each with a folder line. "Board Minutes" is found by name. Tour copy now says "page, chat or email". Transient "No results" before results arrive: R3-13. |
| C28 Sidebar polish | PASS (partial) | 3/3 | Data room failed-files badge is red (destructive). No row cut mid-height at rest at 1440x900 or 1920x1080. Status flag glyph has title "Done". Space-header collapse and silent space switch not exercised. |
| C29 Legal badge and header | BLOCKED (partial) | 2/2 | Table starts at y=155 (limit 260). Counts are in tab labels. The badge update after Done could not be tested: the demo has no overdue deadline, so there is no badge to update. |
| C30 A11y names and focus | PASS | 4/4 | h1 present on every page checked; composer label is "Message Chief" (no ellipsis); Legal Done buttons carry the contract name; Tab reaches Archive, Mark unread, Mark important on a focused Inbox row. One empty unnamed aside remains: R3-08. |
| C31 Chat cards width and spacing | PASS | 2/2 | Question card is 640 px, the same as bubbles; share and secret cards match. First-run choice card is 420 px: R3-11. |
| New: email agent panel | PASS | 5/4 | Open email, Ask agent, panel opens beside the email, answer correct. Reply opens the compose dialog; Escape returns to the email with the panel kept. Ask agent is a visible button next to Reply and Archive, not only in More. Draft has no Reply with draft button: R3-01. |
| New: Audience setting | PASS | 3/3 | Internal / External, External badge in the chat header, one-line explanation and "Can message" switches. No Title field. |
| New: Model picker | PASS | 3/3 | Advanced shows Model "System model (OpenAI: GPT-6 Luna)" and Thinking. |
| New: secret request card and dialog | PASS | 4/4 | Card, "Provide secret" dialog (password field), Submit, card collapses to "Saved". Focus starts on the Single line toggle: R3-09. |
| New: held "Share with {name}?" card | PASS | 3/3 | External bot receives a message from Chief; card shows exact text with Share / Don't share; Don't share leaves "Not shared". |
| New: Email chats fold | PASS | 1/1 | One "Email chats" row with unread count expands to the chats. |
| New: connect popup closing | BLOCKED | n/a | Needs a real OAuth provider. |
| New: full-width email cards in chat | SKIPPED | n/a | No email-card message in the demo chats; not triggered. |
| New: Legal model fallback note | SKIPPED | n/a | Not reached. |
| Storybook smoke | PASS | n/a | 1590/1590 stories clean. |

## Findings

| ID | Sev | Cat | What happened vs expected | Evidence | Suspected location | Proposed fix |
|---|---|---|---|---|---|---|
| R3-01 | P2 | flow | Observed: asking the email agent "Draft a short reply" returns a plain-text "Draft:" bubble; no Reply with draft button appears, because the button only shows for a mail_draft card. The user has to copy text into Reply. | e5-draft.png | apps/web/src/components/inbox/EmailAgentPanel.tsx:176-182 (latestPendingDraft) | Make the email agent produce a mail_draft card for draft requests, or show Use as reply on the agent's last text answer. |
| R3-02 | P2 | flow/copy | Observed: Newsletters has 3 messages, but Digest shows "No mail" because digestRows keeps only the last 7 days. The toggle gives no hint why. | c23-news.png, c23-digest2.png | packages/core/src/inbox-sender-groups.ts:132; apps/web/src/pages/Inbox.tsx:1539 | Say "No newsletters in the last 7 days" (or hide Digest when empty). |
| R3-03 | P3 | visual | Observed: with Newsletters selected, the Digest toggle also has a filled pill background, so two controls look active. | c23-news.png | apps/web/src/pages/Inbox.tsx:1345 | Use an outline-only style for the unpressed state and fill only when pressed. |
| R3-04 | P2 | copy | Observed under load: Inbox showed "Internal Server Error" in red with Try again, and the Chief sidebar row said "Retrying: the database connection dropped…". Raw backend text reaches the user. | c28-1920b.png, h3-chief.png | apps/web/src/lib/run-phase.ts:17 (phase name is the raw error); Inbox error line in apps/web/src/pages/Inbox.tsx | Show "Retrying" and "Couldn't load mail. Try again" and keep the raw text in logs. |
| R3-05 | P2 | flow/perf | Observed: for a user with no mail connected, Inbox showed "Reading your mail…" then "First sync can take a minute" with skeleton rows for about 25 s before "No mail connected". Maya's cold loads also sat on "Still opening…" for 10 to 120 s (host load 400+, so timing is suspected environment). The wording claims a sync that does not exist. | n1.png, n3-inbox.png, n4-inbox.png, c24-375.png | apps/web/src/pages/Inbox.tsx:1415-1425 | Decide "no mail connected" from the connections list before showing the sync text. |
| R3-06 | P2 | visual | Observed at 375: Burn and Runway headers use three rows (menu, back + title + picker, Ask on its own row), about 135 px before content; Finance home is one row. | c22-burn-375.png, c22-runway-375.png | Finance sub-page header (PageHeader.tsx and apps/web/src/pages/finance/*) | Put Ask on the title row (icon only at phone width) and drop the second row. |
| R3-07 | P3 | visual | Observed at 375: the Artifacts Ask button appears after load and moves Filters from the right edge (x=282) to x=204. Header height is stable. | c21-375-early.png, c21-375.png | apps/web/src/pages/Artifacts.tsx:286-340 | Reserve the Ask slot while loading. |
| R3-08 | P3 | a11y | Observed: a closed side panel leaves an empty, unnamed aside (width 0) in the DOM. | geometry eval on Legal | apps/web/src/pages/ResizableSidePanel.tsx:81 | Render the aside only when open, or give it a label and aria-hidden. |
| R3-09 | P3 | a11y | Observed: the Provide secret dialog opens with focus on the Single line toggle, not on the secret field, so the user presses Tab before typing. | s3-dialog.png | apps/web/src/components/SecretRequestDialog.tsx:78 | Focus the password input on open. |
| R3-10 | P3 | copy | Observed: the secret card says "API key for api.example.test" and repeats "https://api.example.test" one line below. | s2-secret.png | apps/web/src/components/AskCard.tsx (secret card) | Show the origin once. |
| R3-11 | P3 | visual | Observed: the first-run "What do you want me on first?" card is 420 px wide while bubbles and other cards are 640 px. | n1.png | apps/web/src/components/AskCard.tsx | Use the shared card max width. |
| R3-12 | P3 | flow | Observed once, unconfirmed: I emptied the Chief composer (set to blank through the browser tool) after a stray "Board Minutes" draft; later the draft returned and was sent joined to my next message. May be an artifact of the tool not firing an input event. | h2-chief.png | composer draft storage (draftKey in Composer) | Delete the stored draft when the text becomes empty. |
| R3-13 | P3 | copy | Observed: typing a query in the palette shows "No results" for about a second before results arrive. | c27-halcyon.png | apps/web/src/pages/Shell.tsx palette | Show nothing or a spinner while the search is pending. |
| R3-14 | P3 | flow | Observed: Auto-sort sat on "Looking for changes" for 14 s or more with no progress count (demo; host under load). It can be cancelled. | c24-autosort2.png | apps/web/src/pages/DataRoom.tsx Auto-sort dialog | Show elapsed files or a "taking longer" note after 10 s. |
| R3-15 | P3 | visual | Observed: the Advanced disclosure in bot settings shows a square-cornered focus outline after click, unlike the rounded controls around it. | b4 / q1-ir.png | bot settings disclosure component | Round the focus ring. |

## Praise

- Audience switch: one control, the External badge in the header, and one short sentence that explains what changes.
- Held share card quotes the exact text and collapses to "Not shared" or "Shared" afterwards.
- Secret flow never shows the value; the card ends as "Saved".
- Command palette now answers a customer name with contacts and documents with folder paths in one screen.
- Empty Artifacts, Contacts and Inbox are calm: one action each.

## Storybook smoke

Built Storybook fresh from the worktree (`pnpm build-storybook`, succeeded) and ran `node .storybook/smoke.mjs storybook-static`: 1590 of 1590 stories rendered cleanly, no failing stories. A log left from an earlier run (16:37, not this walk) shows a timeout on `settings-account-access--sso-not-linked` while the host load average was above 400; that story passed in this run.
