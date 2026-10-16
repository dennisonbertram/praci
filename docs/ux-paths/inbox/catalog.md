# UX Path Catalog: Rakazo web app — Inbox

Generated: 2026-10-16
Code read: `/Users/dennison/develop/rakazo-ux` at `458a69e4` (branch `docs/ux-pass`, same commit as `origin/main`).
Total Stories: 24 (short 12, medium 9, long 3)
Prior catalog reused: `/private/tmp/.../ux-paths-today/catalog.md` (STORY-031..055 for the mail card and inbox rows) and `docs/ux-paths/topics/act-on-email.md`. Stories here are rewritten for a first-time founder and re-checked against the current code. Where a prior story already covers a path, this file links to it instead of repeating it.

**Persona for every story.** A naive first-time user: a startup founder who has never seen Rakazo or its code, does not know its words ("triage", "noise", "agent", "Data room", "approval"), and only wants to run their company clearly and consistently. In the stories they are called **Maya**, the founder of the mock company. Steps say what Maya would try, in her words, and mark **Hesitation** where she would likely pause or misread a label.

**Important scope note.** The prior catalog describes Data room "Import from email" and an agent `add_to_data_room` tool (prior STORY-013, 019, 023, 025, 056). Neither exists at this commit: there is no `ImportFromEmail` component in `apps/web/src`, and no Data room tool in `packages/adapters/src/builtin-tools.ts`. On `main` today, the only way to get a mail attachment into the Data room is to download it and upload it again (STORY-IN-016, IN-022).

---

## Mock demo data (shared preconditions)

The walk runs against a seeded mock demo account. Everything below is fake and must be labeled as such in the seed. Stories reference these items by their key (for example `M1`, `T2`).

**Space and person**
- Space / company name: `MOCK DEMO DATA — Northwind Robotics`.
- Signed-in user: `Maya Okafor (MOCK)`, subscription active, onboarding complete, so `/app` loads the Shell.

**Mail accounts** (Gmail connections, provider stubbed)
- `A1` `maya@northwind-robotics.example` — label "Northwind (MOCK)". Connected in every story unless a story says otherwise.
- `A2` `maya.okafor.personal@example.test` — label "Personal (MOCK)". Connected only in stories that say "two accounts".

**Cached messages on `A1`** (all in INBOX, received within the 14-day cache window unless noted)

| Key | From | Subject | State |
|-----|------|---------|-------|
| M1 | Priya Shah `<priya@harbor-vc.example>` | Re: Series A term sheet — redlines | Thread of 4 messages; newest today 08:12; unread; needsReply=true; priority important; attachment `Northwind_TermSheet_v3_redline.pdf` (1.2 MB) on the newest message; earlier messages in the thread contain the original term sheet and Maya's own reply |
| M2 | Stackyard Cloud Billing `<billing@stackyard.example>` | Invoice #4471 — October hosting | today 07:40; unread; category billing; attachment `INV-4471.pdf` (180 KB) |
| M3 | Luis Romero `<luis@acme-logistics.example>` | Can we move Thursday's demo to Friday? | today 09:30; unread; needsReply=true; category scheduling |
| M4 | Robotics Weekly `<news@roboticsweekly.example>` | This week: humanoid grippers, funding roundup | yesterday; read; category newsletter |
| M5 | Google `<no-reply@accounts.google.example>` | Security alert: new sign-in on Mac | yesterday; unread; category security |
| M6 | Luis Romero `<luis@acme-logistics.example>` | Signed MSA — Acme Logistics x Northwind | 4 days ago; read; attachment `Acme_Northwind_MSA_signed.pdf` (3.4 MB) |
| M7 | Dana Kim `<dana@northwind-robotics.example>` | Factory walkthrough video | 3 days ago; read; attachments `factory_walkthrough.mov` (30 MB) and `floorplan.png` (2.1 MB) |
| M8 | Figma `<receipts@figma.example>` | Your Figma receipt | 5 days ago; read; category receipt |
| M9 | Sam Lee `<sam@northwind-robotics.example>` | Board meeting prep — Oct 23 | 2 days ago; read; To Maya, Cc 4 people (Priya Shah, Ken Ito, Ana Duarte, Ravi Menon) |
| M10 | Ken Ito `<ken@ito-cpa.example>` | W-9 for Northwind | **20 days ago** (outside the 14-day cache; findable only by Gmail search) |
| M11 | "Maya Okafor" `<ceo@northwlnd-robotics.example>` (look-alike domain) | Urgent: wire transfer update | today 06:55; unread; category suspicious (row shows the "Suspicious" warning icon) |

**Cached messages on `A2`** (two-account stories only)
- M12 Bright Dental `<appointments@brightdental.example>` — "Reminder: cleaning on Oct 21" — today; unread; category scheduling.

**To-dos from mail** (`InboxTodo`, triage on)
- T1 "Send the redlined term sheet back to Priya" — from Priya Shah, detail "Asked for comments by Friday", due today, priority important, `messageId` = M1.
- T2 "Pay invoice #4471" — from Stackyard Cloud Billing, due in 4 days, `messageId` = M2.
- T3 "Confirm Friday demo time with Luis" — from Luis Romero, no due date, `messageId` = M3.
- T4 "Send W-9 to Ken" — done yesterday, `messageId` = null (left the cache).

**Triage and AI consent**
- State `CONSENT-PENDING`: triage blocked with reason `needs_consent` (recipient = the triage model provider). No categories, no to-dos.
- State `CONSENT-GIVEN`: consent allowed, triage has run, all rows above carry their categories and needsReply.

**Sync states (per story)**
- `SYNC-OK`: `lastSyncedAt` = 2 minutes ago, no errors.
- `SYNC-RECONNECT`: `A1` has `lastErrorAt` set and `needsReconnect=true`.
- `SYNC-RATELIMIT`: `A1` has `lastErrorAt` set and `lastErrorKind=rate_limited`.

**Agents**
- `AGENT-NONE`: no Inbox agent exists yet.
- `AGENT-READY`: Inbox agent exists (spawn key for Maya), empty thread.
- `CARD-PENDING`: in the Inbox agent thread, one pending `mail_send` approval card: To `luis@acme-logistics.example`, subject "Re: Can we move Thursday's demo to Friday?", body "Hi Luis, Friday at 2pm works for us. See you then. — Maya", replyToId = M3.

**Data room**
- `DR-EMPTY`: Data room has no items; Data room AI consent may be off.
- `DR-SEEDED`: Data room contains `Acme_Northwind_MSA_signed.pdf` already (uploaded earlier), for the duplicate edge case.

---

## Summary

| Type | Count |
|------|-------|
| Short | 12 |
| Medium | 9 |
| Long | 3 |

## Coverage Matrix

| Feature area | Stories | Gaps |
|---|---|---|
| Mail list (groups, unread, labels, rows) | IN-001, IN-002, IN-003, IN-021 | Phone width covered by prior STORY-051 |
| Threads | IN-008 | Thread view does not exist; story records the gap |
| Triage (consent, Important, categories, marks) | IN-002, IN-005, IN-007 | `no_model` blocked state has no UI (nothing to walk) |
| Archive / read / undo | IN-003, IN-004 | |
| Reply / reply all / forward | IN-009, IN-010, IN-011 | |
| New message, From picker, attachments | IN-012, IN-013 | |
| Approval cards for sending | IN-019, IN-020, IN-023 | Desktop host, auto-allow rules (prior gap) |
| Search, filters, load more | IN-006, IN-007 | |
| Sync, rate-limit, reconnect notices | IN-017, IN-018 | |
| To-dos from mail | IN-014 | No way to add, edit or delete a to-do |
| Attachments (download, into Data room) | IN-015, IN-016, IN-022 | No direct "Save to Data room" exists |
| Inbox agent panel, email cards | IN-019, IN-023 | |
| Two accounts | IN-012, IN-021 | |
| Keyboard | IN-009 (variation), prior STORY-001 | |

## Story Dependency Graph

```text
IN-001 (Connect mail from an empty Inbox)
└── IN-002 (Allow AI sorting)
    ├── IN-003 (Read, then mark unread)
    ├── IN-004 (Archive and undo)
    ├── IN-005 (Mark noise)
    ├── IN-007 (Filters and Important)
    ├── IN-014 (To-dos)
    ├── IN-008 (Read a thread)
    │   └── IN-009 (Reply) ── IN-010 (Reply all + Undo) ── IN-013 (Close and continue a draft)
    ├── IN-011 (Forward with attachments)
    ├── IN-015 (Download attachments) ── IN-016 (Attachment into Data room)
    ├── IN-006 (Search older mail)
    ├── IN-019 (Ask the Inbox agent) ── IN-020 (Approve a mail card)
    └── IN-017 / IN-018 (Reconnect / rate-limit notices; independent seeds)
IN-012, IN-021 need two accounts (A1 + A2)
Long: IN-022 (first morning), IN-023 (agent drafts replies); IN-024 (term sheet day) uses IN-008, IN-011, IN-016
```

---

## All Stories

### Getting started

## STORY-IN-001: "Where is my email?" — connect mail from an empty Inbox

**Type**: short
**Topic**: Inbox first run
**Persona**: Maya, first-time founder, just signed in
**Goal**: See her company email inside the app.
**Preconditions**: MOCK DEMO DATA space; **no mail accounts connected**; AGENT-NONE.
**Ideal path**: 3 — click Inbox, click Connect mail, finish Google sign-in and land back in the Inbox.
**Alternate paths**: Sidebar Integrations page, search "gmail" (`Shell.tsx:4135` uses the same `/app/integrations?q=gmail` URL); Data room and Cap Table have their own connect buttons for other apps.

### Steps
1. Clicks **Inbox** in the sidebar (`Shell.tsx:3303-3318`) → `/app/inbox`; heading "Inbox", search box "Search mail", a Filter button, and a pen icon (Compose) that is **disabled** (`Inbox.tsx:622-631`).
2. Sees one centered button **Connect mail** (`Inbox.tsx:676-681`) and nothing else. **Hesitation**: no sentence says which providers work, what is read, or why. She wonders whether it will also send mail as her.
3. Clicks **Connect mail** → navigates to `/app/integrations?q=gmail` (the Integrations page, filtered).
4. Connects Gmail on the Integrations page (prior STORY-058 covers that page).
5. Clicks **Inbox** again → skeleton rows while the first sync runs, then mail.

### Variations
- She clicks the disabled pen icon first → nothing happens and no tooltip says "Connect mail first".
- She presses `c` (compose) → nothing happens (`Inbox.tsx:437` passes no compose handler when there are no accounts).

### Edge Cases
- After connecting, nothing on the Integrations page sends her back to the Inbox; she must find the sidebar link herself.

## STORY-IN-002: "Let Rakazo sort your mail" — allow AI sorting

**Type**: short
**Topic**: Triage consent
**Persona**: Maya, cautious about investor email going to an AI provider
**Goal**: Decide whether to let the app sort her mail.
**Preconditions**: A1 connected; CONSENT-PENDING; SYNC-OK; messages M1–M11.
**Ideal path**: 2 — read the card, click Allow.
**Alternate paths**: Settings "AI data sharing" section with one switch per model (`AiDataSharing.tsx:~56-100`, `AiDataSharingSection`).

### Steps
1. Opens Inbox → rows appear in two groups, **Today** and **Earlier**. No "Needs reply" group, no Important toggle, no To do card.
2. Above the list, a card: "**Let Rakazo sort your mail** — Senders, recipients, subjects and short previews are sent to {model name}." with **Allow** (`AiDataSharing.tsx:36-50`). **Hesitation**: the card does not say what she gets in return (to-dos, Needs reply, categories), and there is no "Not now" button.
3. Clicks **Allow** → the card goes away, the page re-syncs, and within about 30 seconds (polling every 5 s, up to 6 times, `Inbox.tsx:51-52`) a **Needs reply** group, an **Important** toggle and a **To do** card appear.

### Variations
- She ignores the card: it stays at the top of every visit; nothing else changes.
- She searches first: the card is hidden while a search or filter is active (`Inbox.tsx:718`), so she may never see it.

### Edge Cases
- Triage takes longer than 6 polls (30 s): the new groups appear only after the next manual visit or sync; no "Sorting your mail…" status is shown.

### Reading and triage

## STORY-IN-003: Read an email, then mark it unread to come back later

**Type**: short
**Topic**: Mail list
**Persona**: Maya, wants to flag the hosting invoice for later
**Goal**: Look at an email and keep it bold so she remembers it.
**Preconditions**: A1; CONSENT-GIVEN; SYNC-OK; M2 unread.
**Ideal path**: 3 — open, Mark unread, close.
**Alternate paths**: Row hover button "Mark unread" (wide screens) or row **More** menu (narrow) (`InboxRow.tsx:124-131, 197-253`); dialog button (`InboxMessageDialog.tsx:274-279`).

### Steps
1. Sees M2 bold with a blue dot (unread) and the sidebar Inbox badge showing an unread count.
2. Clicks the row → a large dialog opens with subject, sender, time, Reply / Reply all / Forward / Archive / **Mark read** buttons, the body, and the `INV-4471.pdf` chip. URL gains `?mail=<id>`.
3. After 0.8 s the message is marked read (`Inbox.tsx:410-421`); the dialog button changes to **Mark unread**. **Hesitation**: the button label flips without any notice; she may not notice the change at all.
4. Clicks **Mark unread** → button flips back to **Mark read**.
5. Presses Esc or the X → back on the list; M2 is bold again; the row has focus.

### Variations
- She opens and closes within 0.8 s → it stays unread (by design, so stepping with j/k does not mark everything read).

### Edge Cases
- No toast and no Undo for read/unread changes (prior P3-02).

## STORY-IN-004: Archive the newsletter, then undo

**Type**: short
**Topic**: Triage actions
**Persona**: Maya, clearing noise
**Goal**: Get the newsletter out of the way, then change her mind.
**Preconditions**: A1; CONSENT-GIVEN; M4 in inbox.
**Ideal path**: 2 — Archive, Undo.
**Alternate paths**: row hover Archive icon, row More → Archive, dialog **Archive** button, key `e` on the list or in the dialog.

### Steps
1. Hovers M4 → icons appear on the right: Archive, Mark read/unread, a star ("Mark important"), a bell-off ("Mark noise"). **Hesitation**: the icons have no visible text; she must hover each for its name (aria-label only, no tooltip).
2. Clicks the Archive icon → the row disappears; bottom toast "**Archived** · Undo" for 6 s (`Inbox.tsx:53, 467-486`).
3. Clicks **Undo** → the row comes back after the server confirms.

### Variations
- Archives from inside the dialog → the dialog moves on to the next message instead of closing (`Inbox.tsx:826-833`). She expected to return to the list.

### Edge Cases
- The archive applies to the whole Gmail thread (`inbox-modify.ts:110`); the toast does not say so.

## STORY-IN-005: "Mark noise" on one newsletter mutes the sender everywhere

**Type**: short
**Topic**: Triage marks
**Persona**: Maya, wants fewer newsletters at the top
**Goal**: Tell the app this one newsletter is not important.
**Preconditions**: A1 and A2 connected; CONSENT-GIVEN; M4 from `news@roboticsweekly.example`.
**Ideal path**: 1 — click Mark noise.
**Alternate paths**: More menu → "Mark noise" checkbox item (`InboxRow.tsx:254-262`).

### Steps
1. Hovers M4, clicks the bell-off icon ("Mark noise") → row text dims; toast "**Marked noise** · Undo".
2. **Hesitation / misread**: she believes she marked one email. The server stores the mark on the **sender address**, for all her accounts (`inbox.ts:414-440`). Every future Robotics Weekly email is dimmed and dropped from the Important view.
3. Turns on **Important** → M4 is gone, as expected.

### Variations
- She marks Priya (an investor) "important" to keep one email visible → every Priya email now counts as important.
- She clicks the star again to unmark → `aria-pressed` toggles; no toast on unmark.

### Edge Cases
- There is no list of marked senders anywhere, so she cannot review or reverse marks except one row at a time.

## STORY-IN-006: Find last month's W-9 that is not in the list

**Type**: medium
**Topic**: Search
**Persona**: Maya, her accountant asks "did you get my W-9?"
**Goal**: Find an email from 20 days ago.
**Preconditions**: A1; SYNC-OK; M10 is 20 days old (outside the 14-day cache window, `inbox.ts:36`).
**Ideal path**: 3 — type "W-9" in search, Enter, open the result.
**Alternate paths**: "Search older mail" button at the bottom of the list (focuses the same box, `Inbox.tsx:804-814`); key `/`; ask the Inbox agent (IN-019).

### Steps
1. Scrolls the list to the bottom looking for older mail → sees **Search older mail**. **Hesitation**: she expected the list to keep loading older mail when she scrolls.
2. Clicks it → cursor moves to the "Search mail" box at the top.
3. Types `W-9` and presses Enter → URL gets `?q=W-9`; the list becomes one date-ordered list with "1 result" and a **Clear** button.
4. Opens M10 → message dialog.
5. Tries `from:ken` → works because search text goes to Gmail as typed (`Inbox.tsx:65`). Nothing on screen tells her Gmail syntax is supported.
6. Presses Esc in the search box → search clears.

### Variations
- More than one page of results: "N+ results" and **Load more**; at the end "No more results".
- A typo, `W9 kenn` → "No results for "W9 kenn"" with **Clear**.

### Edge Cases
- Search results lose the Needs reply grouping and the To do card; returning via Clear restores them.

## STORY-IN-007: "Show me only the important stuff" — Important toggle, filters, categories

**Type**: medium
**Topic**: Filters
**Persona**: Maya, 30 minutes before a board meeting
**Goal**: See only mail that matters, then only bills.
**Preconditions**: A1; CONSENT-GIVEN; M1–M11; Priya marked important (from IN-005 variation) optional.
**Ideal path**: 2 — toggle Important; pick "Bills" from Filter.
**Alternate paths**: Ask the Inbox agent "what's important today?" (IN-019).

### Steps
1. Clicks **Important** (a toggle button next to search) → URL `?view=important`; list shows M1, M3 and M11 under a result count; Today/Earlier headings disappear.
2. Opens the Filter (funnel icon) menu → items: Unread, Starred, Has attachment; "Gmail tabs": Primary, Promotions, Social, Updates; "Categories": Bills, Receipts, Scheduling, Newsletters, Security, Notifications, Personal.
3. **Hesitation**: with sorting on, Gmail's own "Important" item is removed from this menu (`Inbox.tsx:577-579`) and replaced by the toggle, which means something different (the app's triage, not Gmail's star-arrow marker).
4. Picks **Bills** → Important turns off (they cannot be combined, `inbox-list-input.ts:44-60`); only M2 shows; the filter button now reads "Bills".
5. Picks **Has attachment** → Bills is replaced, not added. **Hesitation**: she expected to combine "Bills" and "Has attachment".
6. Clicks **Clear** → full list.

### Variations
- With CONSENT-PENDING, the toggle and Categories group are missing entirely and "Important" is back inside the menu.

### Edge Cases
- Filtering by Unread reads live from Gmail, while Bills reads the 14-day cache; the two lists can disagree about the same message.

## STORY-IN-008: Read the whole term-sheet thread

**Type**: short
**Topic**: Threads
**Persona**: Maya, needs to see what Priya and she said before replying
**Goal**: Read every message in the "Re: Series A term sheet" conversation.
**Preconditions**: A1; CONSENT-GIVEN; M1 thread with 4 messages.
**Ideal path**: 2 — open the thread, scroll through the messages.
**Alternate paths**: Reply → expand "Show quoted text" (…) to read the quoted history; open Gmail itself.

### Steps
1. Sees one row for the thread in **Needs reply** (rows are one per thread, `inbox.ts:126-134`).
2. Opens it → the dialog shows only the **newest** message. There is no list of earlier messages, no count, no "4 messages" label (`InboxMessageDialog.tsx:113-310`).
3. **Hesitation**: she scrolls looking for earlier messages and finds none. She cannot see her own earlier reply.
4. Clicks **Reply**, then the small "…" button ("Show quoted text") → the quoted history appears inside the composer. She reads it there and closes the composer without writing.

### Variations
- Uses the up/down chevrons hoping they step through the thread → they step to the previous/next **row** in the list instead.

### Edge Cases
- Closing an untouched reply discards it silently (no draft is saved) — correct, but she does not know that.

### Writing mail

## STORY-IN-009: Reply to Luis about moving the demo

**Type**: short
**Topic**: Reply
**Persona**: Maya
**Goal**: Say "Friday works" to a customer.
**Preconditions**: A1; M3 unread, needsReply.
**Ideal path**: 4 — open, Reply, type, Send.
**Alternate paths**: keys `r` then Cmd/Ctrl+Enter (prior STORY-001); ask the Inbox agent (IN-020).

### Steps
1. Opens M3 from **Needs reply** → dialog.
2. Clicks **Reply** → a second dialog "Reply" with To prefilled (Luis), Subject "Re: …", cursor in the body, formatting bar shown, quoted text hidden behind "…".
3. Types "Hi Luis — Friday at 2pm works. Maya". After a 1.5 s pause: "Draft saved" at the bottom.
4. Clicks **Send** → composer closes; toast "Sending… · Undo" for 5 s, then "Sent" for 3 s; list reloads.
5. **Hesitation**: the message dialog is still open behind; she must press Esc to get back. M3 still sits in Needs reply until triage runs again.

### Variations
- She tries to change From → no From field on replies (`InboxMessageDialog.tsx:282` passes no accounts).

### Edge Cases
- The quoted original is sent even though it is hidden (comment at `ComposeEmail.tsx:479`).

## STORY-IN-010: Reply all to the board prep thread, then pull it back

**Type**: medium
**Topic**: Reply all, Undo send
**Persona**: Maya, replying to 5 people
**Goal**: Send a time change to everyone, notice a mistake, undo it.
**Preconditions**: A1; M9 with 4 Cc recipients.
**Ideal path**: 6 — open, Reply all, type, Send, Undo, fix and Send.
**Alternate paths**: key `a` in the dialog. No way to switch Reply to Reply all inside the composer.

### Steps
1. Opens M9 → clicks **Reply all**.
2. Recipient rows fold into one line "Sam Lee, Priya Shah, Ken Ito +2 more" while focus is elsewhere (`ComposeEmail.tsx:107, 565-572`). **Hesitation**: she cannot tell which line is To and which is Cc; clicking it opens the full rows.
3. Types "Moving prep to 4pm Thursday." and clicks **Send** → "Sending… · Undo".
4. Realises she meant Wednesday; clicks **Undo** within 5 s → the composer reopens exactly as it was.
5. Fixes the day and sends → "Sent".

### Variations
- She waits 6 s before clicking Undo → Undo is gone; mail is sent. There is no "Unsend" after the hold.
- She removes Ravi from Cc using the chip X → sent to 4.

### Edge Cases
- An invalid typed address → "Fix or remove the highlighted addresses." or a specific address error; Send does nothing until fixed.

## STORY-IN-011: Forward the signed MSA to the company lawyer

**Type**: medium
**Topic**: Forward, attachments
**Persona**: Maya
**Goal**: Send the signed contract to `counsel@ellis-law.example` with a short note.
**Preconditions**: A1; M6 with 3.4 MB PDF; M7 with 30 MB + 2.1 MB attachments for the variation.
**Ideal path**: 4 — open, Forward, add recipient, Send.
**Alternate paths**: key `f`; download then attach manually in a New message.

### Steps
1. Opens M6 → **Forward**.
2. Composer "Forward": To is empty and focused; the PDF shows as a chip with its size; the forwarded message sits in the body.
3. Types `counsel@ellis-law.example`, presses Enter → chip.
4. Adds "Please file this." above the forwarded block and clicks **Send** → Sending… / Sent.

### Variations
- Forwards M7 (30 MB video + 2.1 MB PNG) → notice "Attachments can't be over 10 MB." and **no** attachment chips at all: the server drops every attachment when the total is too big (`apps/api/src/inbox-compose.ts:120-123`; limit 10 MB in `contracts/src/inbox.ts:229`). **Hesitation**: she wanted to keep the small floor plan; she has to download it (IN-015) and attach it by hand.

### Edge Cases
- Closing a forward after editing keeps a Gmail draft, but there is no Drafts view in the app to find it later.

## STORY-IN-012: Write a new email from the right account

**Type**: medium
**Topic**: Compose, two accounts
**Persona**: Maya, with work and personal Gmail connected
**Goal**: Email an investor from the work address, attaching the pitch deck.
**Preconditions**: A1 + A2 connected; SYNC-OK; a local file `Northwind_Deck_Oct.pdf` (MOCK, 6 MB) and `Northwind_Demo.mp4` (MOCK, 14 MB) on the test machine.
**Ideal path**: 5 — Compose, check From, To, Subject+body, attach, Send.
**Alternate paths**: key `c`; select an account tab first so From starts on it (`Inbox.tsx:849`).

### Steps
1. Sees tabs **All / Northwind (MOCK) / Personal (MOCK)** under the heading.
2. Clicks the pen icon (aria-label "Compose"; no visible text) → "New message" with a **From** select, To focused. **Hesitation**: the pen icon has no label; she first looks for a "New" or "Compose" button.
3. From shows the first account. She checks it says Northwind.
4. Fills To `priya@harbor-vc.example`, Subject "Northwind deck — October", body.
5. Clicks the paperclip ("Attach files") → picks the deck → chip "Northwind_Deck_Oct.pdf 6 MB".
6. Drags the demo video in → "Attachments can't be over 10 MB."; the video is not added.
7. **Send** → Sending… / Sent.

### Variations
- She was on the **Personal** tab → From starts on Personal; easy to miss.

### Edge Cases
- She closes with an attachment → "Discard attachments?" with **Keep editing** / **Discard**; autosaved drafts never include attachments.

## STORY-IN-013: Start a reply, get pulled away, continue later

**Type**: medium
**Topic**: Drafts
**Persona**: Maya, interrupted by a call
**Goal**: Not lose a half-written reply.
**Preconditions**: A1; M1.
**Ideal path**: 3 — close, reopen Reply, keep typing.
**Alternate paths**: Gmail's own Drafts folder (outside the app).

### Steps
1. Opens M1 → Reply → types two sentences → "Draft saved".
2. Closes the composer (X) and the dialog.
3. Later opens M1 → **Reply** → her text is back (session memory keyed by mode + message, `draft-memory.ts:1-27`).
4. **Hesitation**: she clicks **Reply all** instead of Reply → an empty composer; her text is under the Reply key only.
5. Reloads the browser and opens Reply again → empty composer; the earlier text is now only in Gmail Drafts. Sending this one creates a second message; the first draft stays in Gmail.

### Variations
- A **New message** closed mid-way is never remembered (no key for "new"), only saved as a Gmail draft.

### Edge Cases
- The trash icon ("Discard") removes the draft after a 5-second "Draft discarded · Undo" toast.

### To-dos and attachments

## STORY-IN-014: Work the "To do" list the app made from mail

**Type**: short
**Topic**: To-dos from mail
**Persona**: Maya
**Goal**: Tick off what she did and go to the email behind a to-do.
**Preconditions**: A1; CONSENT-GIVEN; T1–T4.
**Ideal path**: 2 — click a to-do to open its email; tick it.
**Alternate paths**: find the email by hand in Needs reply; ask the agent.

### Steps
1. Sees the **To do** card at the top: T1 (due "Today", red), T2 (due weekday), T3, then T4 struck through.
2. Clicks T1's text expecting the term-sheet email → nothing happens. The card has no link even though each to-do stores its `messageId` (`TodoCard.tsx:77-87`; `contracts/src/inbox.ts:144`).
3. Finds M1 manually, replies (IN-009), then ticks T1's checkbox → struck through.
4. On a narrow window only 2 open to-dos show plus "**1 more**".

### Variations
- She wants to add her own to-do ("Call the bank") → no add field.
- She wants to remove a wrong to-do → only "done" exists.

### Edge Cases
- A failed tick shows an error line in the card; the checkbox state may not match.

## STORY-IN-015: Download attachments, including one that is too big

**Type**: short
**Topic**: Attachments
**Persona**: Maya
**Goal**: Save the invoice PDF and the factory video.
**Preconditions**: A1; M2 (180 KB), M7 (30 MB `.mov`).
**Ideal path**: 2 — open, click the attachment.
**Alternate paths**: none found in the web app.

### Steps
1. Opens M2 → under the body, a chip "INV-4471.pdf 180 kB". Clicks it → file downloads (saved, not opened in the page, `InboxMessageDialog.tsx:351-364`).
2. **Hesitation**: she expected a preview; nothing visible happens except the browser download.
3. Opens M7 → clicks `factory_walkthrough.mov` (30 MB) → red "**Download failed**". The server rejects attachments over 25 MiB with 413 (`inbox.ts:40, 509`), but the message gives no reason or alternative.

### Variations
- Clicks `floorplan.png` → downloads fine.

### Edge Cases
- Sizes display in decimal units ("30 MB") while the limit is 25 MiB; the UI never states the limit.

## STORY-IN-016: Put the signed MSA into the Data room

**Type**: medium
**Topic**: Attachments into the Data room
**Persona**: Maya, building a diligence folder for the Series A
**Goal**: File the signed contract from email into the Data room.
**Preconditions**: A1; M6; DR-EMPTY (and DR-SEEDED for the duplicate edge case).
**Ideal path**: 2 — open the email, click "Save to Data room" (does not exist today).
**Alternate paths**: (a) download, open **Data room**, **Choose files**; (b) download, drag the file onto any app page (global drop zone "Drop to add to Data room", `DropZone.tsx:25-80`); (c) drag onto the Data room page.

### Steps
1. Opens M6 → looks for a "Save to Data room" or "File" action on the attachment chip → none; the chip only downloads.
2. Clicks the chip → `Acme_Northwind_MSA_signed.pdf` downloads.
3. Clicks **Data room** in the sidebar → empty page "Drop files here" / **Choose files**.
4. Clicks **Choose files** → picks the file → toast "Filed" with **View**.
5. **Hesitation**: she expected the Data room to know the file came from Luis's email; it has no link back.

### Variations
- She drags the downloaded file straight onto the Inbox list → the overlay "Drop to add to Data room" appears and the file is uploaded, without leaving the Inbox.
- She drags it onto an open composer instead → it attaches to the email, not the Data room (composer takes the drop first).

### Edge Cases
- DR-SEEDED: uploading the same PDF again → prior P2-03 says the toast still reads "Filed" instead of "already there".

### Sync problems

## STORY-IN-017: "Gmail needs to be reconnected"

**Type**: short
**Topic**: Reconnect notice
**Persona**: Maya, Google sign-in expired
**Goal**: Get mail flowing again.
**Preconditions**: A1 with SYNC-RECONNECT; cached rows M1–M9 still present.
**Ideal path**: 2 — click Reconnect, approve Google sign-in.
**Alternate paths**: Integrations → Gmail app detail → reconnect (prior STORY-063).

### Steps
1. Opens Inbox → red line "**Gmail needs to be reconnected.**" with a **Try again** button (`Inbox.tsx:667-674`, `inbox-sync-error.ts:10`). Old rows still show below.
2. Clicks **Try again** → re-sync fails the same way; the same line returns.
3. **Hesitation**: there is no Reconnect button or link; she does not know reconnecting happens on the Integrations page.
4. Goes to Integrations via the sidebar and reconnects Gmail.

### Variations
- With two accounts, only one needs reconnecting → the message does not say which one.

### Edge Cases
- Sending a reply while disconnected → composer reopens with "Not sent. Gmail needs to be reconnected." (`ComposeEmail.tsx:90, 111-112`).

## STORY-IN-018: "Gmail is limiting requests right now"

**Type**: short
**Topic**: Rate-limit notice
**Persona**: Maya
**Goal**: Understand why mail is not updating.
**Preconditions**: A1 with SYNC-RATELIMIT.
**Ideal path**: 1 — read the message, wait, and the list refreshes by itself.
**Alternate paths**: none found.

### Steps
1. Opens Inbox → "**Gmail is limiting requests right now. Try again in a minute.**" + **Try again**.
2. Clicks **Try again** at once → same message.
3. Waits a minute, clicks again → message gone, list updates.

### Variations
- Rate limit and reconnect at the same time on different accounts → only the reconnect text shows (`inbox-sync-error.ts:10-12`).

### Edge Cases
- Nothing refreshes automatically after the minute; she must click.

### Agent and approval cards

## STORY-IN-019: Ask the Inbox agent "what needs my reply today?"

**Type**: medium
**Topic**: Inbox agent
**Persona**: Maya, would rather ask than scan
**Goal**: Get a short list of mail she must answer.
**Preconditions**: A1; CONSENT-GIVEN; AGENT-NONE (then AGENT-READY after step 3).
**Ideal path**: 3 — open the agent panel, ask, open a cited email.
**Alternate paths**: Needs reply group and Important toggle on the page itself (same answer, two surfaces).

### Steps
1. On a wide window, no agent panel is visible. Clicks the panel icon (aria-label "**Show Inbox agent**", `Inbox.tsx:632-641`) → a side panel opens with **Create Inbox agent**. **Hesitation**: she does not know what an "agent" is or what creating one costs.
2. Clicks **Create Inbox agent** → a chat thread appears.
3. Types "what needs my reply today?" → the agent searches mail and replies with email cards grouped "Today / Within 3 days / This week / Later" (`EmailCards.tsx:18-23`).
4. Clicks the M1 card → the same message dialog as the Inbox opens, but without Archive or Mark read buttons (`EmailCards.tsx:97-104`).

### Variations
- Panel collapsed by "Collapse Inbox agent" → the choice is remembered per user.
- On a phone-width window the panel starts collapsed.

### Edge Cases
- Prior P2-29: with the panel open at 1024 px, the list is about 324 px wide; badges and hover icons disappear.

## STORY-IN-020: Approve the reply the agent wrote

**Type**: medium
**Topic**: Approval cards for sending
**Persona**: Maya
**Goal**: Let the agent send "Friday works" to Luis, after checking it.
**Preconditions**: A1; AGENT-READY; CARD-PENDING.
**Ideal path**: 2 — read the card, Send.
**Alternate paths**: write it herself (IN-009); "Open in composer" after a failed send (prior STORY-036).

### Steps
1. Opens the Inbox agent panel → a card "**Mail** Needs approval · luis@acme-logistics.example" with To, Subject, body, and buttons **Send**, **Discard**, **Edit**, a More (…) menu.
2. **Hesitation**: the agent's own instructions say "You can read mail but not send" (`apps/api/src/inbox-agent.ts:5-6`), yet here it is asking to send. If the agent earlier said "I can't send email", this card contradicts it.
3. Clicks **Edit** → changes "2pm" to "3pm" → **Done** → **Send** → "Sending…" then "Sent".
4. Without editing, a Send folds to "**Approved**" and never says "Sent" (prior P2-23).

### Variations
- Opens More → a checked "Needs approval" item that does nothing, and "Disable sending for Inbox agent" (prior P2-25, P3-08).
- **Discard** → card reads "Discarded".

### Edge Cases
- The sent reply does not appear in the Inbox list (sent mail is not in INBOX); M3 stays in Needs reply until triage reruns.

### Accounts

## STORY-IN-021: Two inboxes, one morning

**Type**: short
**Topic**: Multi-account
**Persona**: Maya, work and personal Gmail
**Goal**: Look only at work mail, then come back to it after a reload.
**Preconditions**: A1 + A2; SYNC-OK; M1–M12.
**Ideal path**: 1 — click the work tab.
**Alternate paths**: none found.

### Steps
1. Sees tabs **All / Northwind (MOCK) / Personal (MOCK)**; All mixes M12 (dentist) with investor mail.
2. Clicks **Northwind (MOCK)** → only A1 rows; To do card shows A1 to-dos only.
3. Reloads the page → back on **All**. The tab is not in the URL (`Inbox.tsx:110`, local state), unlike search and filters.

### Variations
- Rows in All do not say which account they belong to.

### Edge Cases
- A removed account's tab silently falls back to All (`Inbox.tsx:169-171`).

### Long end-to-end

## STORY-IN-022: First morning with the app — from empty Inbox to clear Inbox

**Type**: long
**Topic**: End-to-end
**Persona**: Maya, day one, 40 minutes before a customer call
**Goal**: Connect mail, understand what needs attention, answer two people, file one contract, and leave with nothing urgent left.
**Preconditions**: MOCK DEMO DATA space; no mail connected at start; after connecting, A1 has M1–M11 and CONSENT-PENDING; AGENT-NONE; DR-EMPTY.
**Ideal path**: 14 — connect (3), allow sorting (1), reply to two (4+4), archive two (2), file one attachment (2: if a direct action existed).
**Alternate paths**: the agent route for the replies (IN-023); keyboard route (prior STORY-001).

### Steps
1. Sidebar **Inbox** → **Connect mail** → Integrations → connects Gmail (IN-001).
2. Returns to Inbox by the sidebar → skeleton → Today / Earlier lists.
3. Reads the "Let Rakazo sort your mail" card → clicks **Allow** (IN-002).
4. Waits; **Needs reply** (M1, M3), **Important** toggle and **To do** card appear.
5. **Hesitation**: M11 "Urgent: wire transfer update" shows a small red warning icon labeled "Suspicious" only for screen readers and on hover. She almost opens it as a real CEO email.
6. Archives M11 with the hover Archive icon → "Archived · Undo".
7. Opens M3 → **Reply** → "Friday 2pm works." → **Send** → "Sending… · Undo" → "Sent".
8. Presses Esc to leave the dialog.
9. Opens M1 → sees only Priya's newest message (IN-008) → **Reply** → expands "…" to read history → writes "Comments coming tonight." → **Send**.
10. Ticks **T3** in To do. Tries clicking T1 to open its email — nothing (IN-014).
11. Hovers M4 → clicks bell-off "Mark noise" thinking it is just this email (IN-005).
12. Opens M6 → downloads the MSA → sidebar **Data room** → **Choose files** → "Filed" (IN-016).
13. Back to **Inbox** → list reloads; M3 and M1 still sit in Needs reply until triage reruns. **Hesitation**: she replied to both and expected them to leave that group.
14. Turns on **Important** → checks nothing else is urgent → turns it off.
15. Presses `?` → "Keyboard shortcuts" dialog → notes `e` and `r` for tomorrow.

### Variations
- She says no to sorting (ignores the card) → steps 4, 10, 11, 14 are unavailable; Inbox is a plain list.

### Edge Cases
- If Gmail rate-limits during the first sync → IN-018 notice on step 2.

## STORY-IN-023: "Draft replies to everything that needs one" — let the agent do it

**Type**: long
**Topic**: End-to-end (agent + approval cards)
**Persona**: Maya, wants the app to do the typing
**Goal**: Have the agent prepare replies for every Needs reply email, approve two, throw away one.
**Preconditions**: A1; CONSENT-GIVEN; M1, M3, M9 needsReply; AGENT-READY; mock agent runtime scripted to return three `mail_send` approval cards (to Priya, Luis, Sam).
**Ideal path**: 7 — open panel, ask, review and Send two cards, Discard one, check the Inbox.
**Alternate paths**: reply by hand from each message (IN-009/010).

### Steps
1. Clicks **Show Inbox agent** → panel opens on the existing thread.
2. Types "Draft replies to everything that needs one. Keep them short." → the agent searches; email cards appear.
3. Three mail cards appear, each "Needs approval · <first recipient>".
4. **Hesitation**: the Inbox agent's instructions say it cannot send and should write drafts in the chat (`inbox-agent.ts:5-6`). If the scripted agent replies with plain text drafts instead of cards, she has no button to send them and must copy-paste into the composer. (Which of the two behaviours a live agent shows is UNVERIFIED; the walk should record what appears.)
5. Card to Luis: reads it, clicks **Send** → folds to "Approved".
6. Card to Priya: clicks **Edit** → adds a line → **Done** → **Send** → "Sending…" → "Sent".
7. Card to Sam: clicks **Discard** → "Discarded".
8. Opens the folded Luis card header → it still says "Approved", not "Sent" (prior P2-23). She is unsure it went out.
9. Goes to the Inbox list → no "Sent" view exists in the app; she cannot confirm here.
10. Asks the agent "did the email to Luis go out?" → the agent answers from its tool result.
11. Opens M9 → there is no sign she skipped it; it stays in Needs reply.
12. Collapses the panel ("Collapse Inbox agent").

### Variations
- At 1024 px, the narrow panel hides the recipient on pending cards (prior P2-26); she approves without seeing who gets it.
- She uses More → "Disable sending for Inbox agent" on the first card → later cards are denied silently (prior P2-25).

### Edge Cases
- A send whose result is unclear → "Unknown" with "Not confirmed as sent. Check Sent before trying again." and no link to Sent.

## STORY-IN-024: Term-sheet day — read, file, forward, reply

**Type**: long
**Topic**: End-to-end (threads, attachments, Data room, forward)
**Persona**: Maya, closing a Series A
**Goal**: Read Priya's redlines, file the redlined PDF in the Data room, forward it to counsel, reply to Priya, and close the to-do.
**Preconditions**: A1; CONSENT-GIVEN; M1 thread (4 messages, redline PDF on newest); T1; DR-EMPTY; local Downloads folder writable.
**Ideal path**: 10 — open M1, save PDF to Data room (1 if direct), Forward + recipient + Send (3), Reply + text + Send (3), tick T1 (1), Archive (1).
**Alternate paths**: ask the agent to find the thread; drag the downloaded PDF onto the page instead of Choose files.

### Steps
1. Searches "term sheet" → 1 result (thread) → opens it.
2. Sees only Priya's newest message (IN-008). Wants the original term sheet from message 1 → cannot reach it here.
3. Clicks `Northwind_TermSheet_v3_redline.pdf` → it downloads.
4. Sidebar **Data room** → **Choose files** → picks the PDF → "Filed" → **View**.
5. Back to **Inbox**: the search is still in the URL only if she used Back; via the sidebar the search is gone. **Hesitation**: she re-types the search.
6. Opens M1 → **Forward** → To `counsel@ellis-law.example` → "Redlines from Harbor. Can we talk at 5?" → **Send**.
7. Message dialog returns → **Reply** → "Thanks Priya — counsel is reviewing, comments by Friday." → **Send** → "Sent".
8. **Clear** search → To do card returns → ticks **T1**.
9. Opens M1 again → **Archive** → dialog jumps to the next message instead of closing. Presses Esc.
10. Wants to confirm the archived thread is safe (archive is not delete). The "Archived · Undo" toast is gone after 6 s, and the app has no "Archived" or "All mail" view; only a search finds it again.

### Variations
- Counsel's address typed with a typo (`counsel@ellis-law`) → address error and Send blocked.

### Edge Cases
- The redline PDF uploaded to the Data room has no record of coming from Priya's email.

---

## Redundancy Candidates

### Duplicate paths (same goal, multiple routes)
- **Archive**: row hover icon, row More menu, dialog button, `e` on the list, `e` in the dialog. All five do the same thing; the dialog version moves to the next message instead of closing, the list version does not (`Inbox.tsx:316-334, 826-833`).
- **Mark read/unread**: row hover icon, row More menu, dialog button, and the automatic 0.8 s read. Same result.
- **Mark important / noise**: hover star/bell icons (pressed buttons) and More menu checkbox items, in a different order (prior P3-04).
- **Search**: search box, `/` key, "Search older mail" button — all focus the same input.
- **Clear filters**: Filter menu "Clear", results-count "Clear", empty-state "Clear", search box X, Esc in the box. Five clears with slightly different scope (the menu Clear removes only filter/category; the others remove search, filter, category, view and the open message, `Inbox.tsx:424-428, 612-619`).
- **"What needs my attention?"**: Needs reply group, Important toggle, To do card, and asking the Inbox agent. Four surfaces built on the same triage data.
- **Replying**: dialog Reply, keys `r`/`a`/`f`, and agent approval cards; "Open in composer" bridges a failed card back to the composer (prior P2-27).
- **Connecting Gmail**: Inbox "Connect mail", Integrations catalog, Integrations app detail (prior redundancy #2). The Data room connect buttons in the prior catalog do not exist on `main`.
- **Adding a file to the Data room**: Data room "Choose files", the Data room "+" (Add files) button, drop on the Data room page, drop on any app page. All upload; none link back to the email.

### Duplicate information (same fact, multiple surfaces)
- **Unread count**: sidebar badge, bold rows and dots, "(unread)" screen-reader text, dialog Mark read/unread label.
- **Needs reply**: group heading on the list, the "Needs attention" badge (hidden in that group, shown elsewhere), the triage reason tooltip (only in the Needs reply group, `InboxRow.tsx:140`), and to-dos that restate the same request (T1 restates M1).
- **Sending state**: one global outbox toast ("Sending… / Sent / Draft discarded") for the Inbox and chat cards, and separate per-card states on the approval card ("Sending… / Sent / Approved / Unknown / Not sent").
- **Size limits** for the same kind of file, in three places: 10 MB to attach or forward (`contracts/src/inbox.ts:229`), 25 MiB to download (`inbox.ts:40`), 50 MiB for the Data room (prior catalog). Only the 10 MB limit is ever shown.
- **Message view**: the same `InboxMessageDialog` is used by the Inbox and by chat email cards, with fewer buttons in chat (no Archive, no Mark read).

### Overlapping features/tools
- **Important toggle** (triage view) vs **Gmail "Important"** filter: same word, different meaning; the app hides one when the other is available (`Inbox.tsx:539-549, 577-579`).
- **"Mark important" star** vs Gmail's **Starred** filter: the star icon marks the sender as important in the app; the "Starred" filter reads Gmail stars. Same icon idea, different data.
- **To do card** vs **Needs reply group**: both list things to act on, from the same triage run; neither links to the other.
- **Composer drafts** (Gmail drafts, autosaved) vs **approval card "Save draft"** (agent `mail_draft`): both create Gmail drafts, and the app has no Drafts view for either.

---

## Suspected problems

Each item names what a first-time founder would hit. "VERIFIED" means the behavior was confirmed by reading the code at the cited lines; it was not run in a browser.

1. **Opening a thread shows only its newest message; earlier messages are unreachable in the app.** VERIFIED. The list keeps one row per thread (`apps/api/src/inbox.ts:126-134`), and the dialog loads one `messageId` (`apps/web/src/components/inbox/InboxMessageDialog.tsx:113-160`). A founder cannot read an investor conversation from the beginning except through the quoted text inside a Reply composer. (IN-008, IN-024)
2. **"Gmail needs to be reconnected." offers only "Try again", which cannot fix it.** VERIFIED. `apps/web/src/pages/Inbox.tsx:667-674` renders the message with a retry button only; `apps/web/src/lib/inbox-sync-error.ts:10` gives the text. There is no link to Integrations and no account name when several are connected. (IN-017)
3. **"Mark important" / "Mark noise" on a row changes every email from that sender, in every account, but the label and toast say nothing about the sender.** VERIFIED. `apps/web/src/components/inbox/InboxRow.tsx:114-119` labels; `apps/api/src/inbox.ts:414-440` stores the mark by sender address. No screen lists marked senders. (IN-005)
4. **To-dos do not open their email**, although each one stores `messageId`. VERIFIED. `apps/web/src/components/inbox/TodoCard.tsx:77-87` renders plain text; `packages/contracts/src/inbox.ts:144`. There is also no way to add, edit or delete a to-do. (IN-014)
5. **The Inbox agent is told it cannot send, archive or change mail, while send and draft approval cards exist.** Code VERIFIED, runtime behavior UNVERIFIED. `apps/api/src/inbox-agent.ts:5-6` instructions vs `packages/adapters/src/mail-tools.ts:31-40` (`mail_draft`, `mail_modify`, `mail_send` in the mail tool set) and `packages/adapters/src/executor.ts:3521` (the Inbox agent is limited to mail tools, not excluded from them). The agent may refuse to send, or offer to and then show a card; either contradicts what it said. (IN-020, IN-023)
6. **"Download failed" gives no reason for attachments over 25 MiB.** VERIFIED. `apps/web/src/components/inbox/InboxMessageDialog.tsx:357, 398-401` shows a fixed message; `apps/api/src/inbox.ts:40, 509` returns 413 "Attachment is too large". (IN-015)
7. **No direct way to send an email attachment to the Data room on `main`.** VERIFIED by absence: the attachment chip only downloads (`InboxMessageDialog.tsx:379-395`); no `ImportFromEmail` component exists in `apps/web/src`. The prior catalog's import stories and P1-3 describe code that is not on this branch. (IN-016)
8. **Two different "Important" features share one word.** VERIFIED. With sorting on, the Important toggle is the app's triage view and Gmail's "Important" filter is removed from the menu (`apps/web/src/pages/Inbox.tsx:539-549, 577-579`); with sorting off, "Important" is Gmail's. (IN-007)
9. **Forwarding an email whose attachments total over 10 MB silently drops all of them, including the small ones.** VERIFIED. `apps/api/src/inbox-compose.ts:120-123` returns an empty list when the total is too large; `apps/web/src/components/ComposeEmail.tsx:284-288` shows only "Attachments can't be over 10 MB." When attaching local files (`ComposeEmail.tsx:392-416`), the same line does not say which file was left out. (IN-011, IN-012)
10. **Account tab is not kept in the URL; reloading or coming back resets to All.** VERIFIED. `apps/web/src/pages/Inbox.tsx:110` (`useState`), unlike `q`, `filter`, `view`, `category` which live in the URL. (IN-021)
11. **The empty Inbox shows only "Connect mail" with no explanation, and the Compose icon is disabled with no reason.** VERIFIED. `apps/web/src/pages/Inbox.tsx:622-631, 676-681`. (IN-001)
12. **The AI-sorting consent card has no "Not now" and does not say what sorting gives you.** VERIFIED. `apps/web/src/components/AiDataSharing.tsx:36-50`. It is also hidden whenever a search or filter is active (`Inbox.tsx:718`). (IN-002)
13. **Replied mail stays in "Needs reply" until triage runs again.** PLAUSIBLE. After a send, the page reloads the list (`Inbox.tsx:140-147`) but nothing marks the thread handled; whether the next triage clears it depends on `alreadyHandled` (`apps/api/src/inbox.ts:362`), which was not traced. (IN-009, IN-022)
14. **Compose button is an icon with no visible text or tooltip.** VERIFIED. `apps/web/src/pages/Inbox.tsx:622-631` (aria-label "Compose" only). Row action icons also rely on aria-labels only (`InboxRow.tsx:197-232`). (IN-004, IN-012)
15. **Archive from the open message jumps to the next message instead of closing**, unlike archive from the list. VERIFIED. `apps/web/src/pages/Inbox.tsx:826-833`. A first-timer can end up reading an email they did not choose. (IN-004, IN-024)
16. **Rate-limit notice never clears on its own.** VERIFIED. The sync runs on mount and on "Try again" only (`apps/web/src/pages/Inbox.tsx:224-243`); the notice says "Try again in a minute" but nothing retries. (IN-018)
17. **`MAX_COMPOSE_ATTACHMENTS = 20` is defined but the composer does not check it.** VERIFIED by search: `packages/contracts/src/inbox.ts:231` defines it; `apps/web/src/components/ComposeEmail.tsx:392-416` checks only total bytes. Whether the server rejects a 21st file was not checked. (IN-012)
