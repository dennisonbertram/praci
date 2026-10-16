# UX Path Catalog: Rakazo first-time founder pass

Generated: 2026-10-16
Branch: docs/ux-pass
Total Stories: 135
Sources: `docs/ux-paths/{inbox,finance,legal,captable,dataroom,app}/catalog.md`. This file merges them. The per-area files keep the original story ids; this file is the one `/ux-walker` and `/ux-flow` read.
Persona: a naive first-time founder (Maya Chen, "MOCK DEMO DATA — Northwind Robotics"). Each area lists its own mock data and preconditions.
Evidence: every area was written by reading code. No story was walked in a browser.

The previous catalog (the 2026-10-14 Inbox email audit, STORY-001..062, built from `discovery.md` and `topics/`) moved to `docs/ux-paths/catalog-inbox-email-audit-2026-10-14.md`. References written as "prior STORY-nnn" point to an earlier catalog, not to stories in this file.

## Story ids

Each area has its own prefix, so every id in this file is unique. Cross-references inside each area were rewritten to the new ids.

| Area | Prefix | Old id form | short | medium | long | Total |
|---|---|---|---|---|---|---|
| Inbox | STORY-INB-nnn | STORY-IN-nnn, IN-nnn | 12 | 9 | 3 | 24 |
| Finance | STORY-FIN-nnn | STORY-nnn | 10 | 9 | 4 | 23 |
| Legal | STORY-LEG-nnn | STORY-nnn | 8 | 8 | 4 | 20 |
| Cap Table | STORY-CAP-nnn | STORY-nnn | 12 | 4 | 4 | 20 |
| Data room | STORY-DRM-nnn | STORY-nnn | 12 | 8 | 3 | 23 |
| App shell | STORY-APP-nnn | APP-nnn | 15 | 7 | 3 | 25 |
| **Total** | | | **69** | **45** | **21** | **135** |

Counts come from each story's **Type** field. The App shell area's own summary says 13 short, 9 medium and 3 long; its Type fields say 15, 7 and 3.

## Walk blockers (read before walking)

- **Legal is not in this build.** `docs/ux-pass` (= `origin/main` 458a69e4) has no Legal route or files; the Legal stories were written from `origin/feat/legal` 488048d5. Walk them on a build that includes `feat/legal` (for example `local/legal-integration`), or skip the Legal area. Run STORY-LEG-020 first.
- **Carta needs the real host.** The app recognizes Carta only at `mcp.app.carta.com` (`packages/contracts/src/carta.ts:10-21`), so a mock Carta server on another host will not count as Carta for the Cap Table stories.
- **Data room gap stories.** STORY-DRM-020 to STORY-DRM-023 cover features that are not built (Gmail import, Google Drive import, sharing, agent tools over documents). They record the expected failure.

---

## Area: Inbox (STORY-INB-nnn)

Source: `docs/ux-paths/inbox/catalog.md`.


Generated: 2026-10-16
Code read: `/Users/dennison/develop/rakazo-ux` at `458a69e4` (branch `docs/ux-pass`, same commit as `origin/main`).
Total Stories: 24 (short 12, medium 9, long 3)
Prior catalog reused: `/private/tmp/.../ux-paths-today/catalog.md` (STORY-031..055 for the mail card and inbox rows) and `docs/ux-paths/topics/act-on-email.md`. Stories here are rewritten for a first-time founder and re-checked against the current code. Where a prior story already covers a path, this file links to it instead of repeating it.

**Persona for every story.** A naive first-time user: a startup founder who has never seen Rakazo or its code, does not know its words ("triage", "noise", "agent", "Data room", "approval"), and only wants to run their company clearly and consistently. In the stories they are called **Maya**, the founder of the mock company. Steps say what Maya would try, in her words, and mark **Hesitation** where she would likely pause or misread a label.

**Important scope note.** The prior catalog describes Data room "Import from email" and an agent `add_to_data_room` tool (prior STORY-013, 019, 023, 025, 056). Neither exists at this commit: there is no `ImportFromEmail` component in `apps/web/src`, and no Data room tool in `packages/adapters/src/builtin-tools.ts`. On `main` today, the only way to get a mail attachment into the Data room is to download it and upload it again (STORY-INB-016, STORY-INB-022).

---

### Mock demo data (shared preconditions)

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

### Summary

| Type | Count |
|------|-------|
| Short | 12 |
| Medium | 9 |
| Long | 3 |

### Coverage Matrix

| Feature area | Stories | Gaps |
|---|---|---|
| Mail list (groups, unread, labels, rows) | STORY-INB-001, STORY-INB-002, STORY-INB-003, STORY-INB-021 | Phone width covered by prior STORY-051 |
| Threads | STORY-INB-008 | Thread view does not exist; story records the gap |
| Triage (consent, Important, categories, marks) | STORY-INB-002, STORY-INB-005, STORY-INB-007 | `no_model` blocked state has no UI (nothing to walk) |
| Archive / read / undo | STORY-INB-003, STORY-INB-004 | |
| Reply / reply all / forward | STORY-INB-009, STORY-INB-010, STORY-INB-011 | |
| New message, From picker, attachments | STORY-INB-012, STORY-INB-013 | |
| Approval cards for sending | STORY-INB-019, STORY-INB-020, STORY-INB-023 | Desktop host, auto-allow rules (prior gap) |
| Search, filters, load more | STORY-INB-006, STORY-INB-007 | |
| Sync, rate-limit, reconnect notices | STORY-INB-017, STORY-INB-018 | |
| To-dos from mail | STORY-INB-014 | No way to add, edit or delete a to-do |
| Attachments (download, into Data room) | STORY-INB-015, STORY-INB-016, STORY-INB-022 | No direct "Save to Data room" exists |
| Inbox agent panel, email cards | STORY-INB-019, STORY-INB-023 | |
| Two accounts | STORY-INB-012, STORY-INB-021 | |
| Keyboard | STORY-INB-009 (variation), prior STORY-001 | |

### Story Dependency Graph

```text
STORY-INB-001 (Connect mail from an empty Inbox)
└── STORY-INB-002 (Allow AI sorting)
    ├── STORY-INB-003 (Read, then mark unread)
    ├── STORY-INB-004 (Archive and undo)
    ├── STORY-INB-005 (Mark noise)
    ├── STORY-INB-007 (Filters and Important)
    ├── STORY-INB-014 (To-dos)
    ├── STORY-INB-008 (Read a thread)
    │   └── STORY-INB-009 (Reply) ── STORY-INB-010 (Reply all + Undo) ── STORY-INB-013 (Close and continue a draft)
    ├── STORY-INB-011 (Forward with attachments)
    ├── STORY-INB-015 (Download attachments) ── STORY-INB-016 (Attachment into Data room)
    ├── STORY-INB-006 (Search older mail)
    ├── STORY-INB-019 (Ask the Inbox agent) ── STORY-INB-020 (Approve a mail card)
    └── STORY-INB-017 / STORY-INB-018 (Reconnect / rate-limit notices; independent seeds)
STORY-INB-012, STORY-INB-021 need two accounts (A1 + A2)
Long: STORY-INB-022 (first morning), STORY-INB-023 (agent drafts replies); STORY-INB-024 (term sheet day) uses STORY-INB-008, STORY-INB-011, STORY-INB-016
```

---


### Stories: Getting started

#### STORY-INB-001: "Where is my email?" — connect mail from an empty Inbox

**Type**: short
**Topic**: Inbox first run
**Persona**: Maya, first-time founder, just signed in
**Goal**: See her company email inside the app.
**Preconditions**: MOCK DEMO DATA space; **no mail accounts connected**; AGENT-NONE.
**Ideal path**: 3 — click Inbox, click Connect mail, finish Google sign-in and land back in the Inbox.
**Alternate paths**: Sidebar Integrations page, search "gmail" (`Shell.tsx:4135` uses the same `/app/integrations?q=gmail` URL); Data room and Cap Table have their own connect buttons for other apps.

##### Steps
1. Clicks **Inbox** in the sidebar (`Shell.tsx:3303-3318`) → `/app/inbox`; heading "Inbox", search box "Search mail", a Filter button, and a pen icon (Compose) that is **disabled** (`Inbox.tsx:622-631`).
2. Sees one centered button **Connect mail** (`Inbox.tsx:676-681`) and nothing else. **Hesitation**: no sentence says which providers work, what is read, or why. She wonders whether it will also send mail as her.
3. Clicks **Connect mail** → navigates to `/app/integrations?q=gmail` (the Integrations page, filtered).
4. Connects Gmail on the Integrations page (prior STORY-058 covers that page).
5. Clicks **Inbox** again → skeleton rows while the first sync runs, then mail.

##### Variations
- She clicks the disabled pen icon first → nothing happens and no tooltip says "Connect mail first".
- She presses `c` (compose) → nothing happens (`Inbox.tsx:437` passes no compose handler when there are no accounts).

##### Edge Cases
- After connecting, nothing on the Integrations page sends her back to the Inbox; she must find the sidebar link herself.

#### STORY-INB-002: "Let Rakazo sort your mail" — allow AI sorting

**Type**: short
**Topic**: Triage consent
**Persona**: Maya, cautious about investor email going to an AI provider
**Goal**: Decide whether to let the app sort her mail.
**Preconditions**: A1 connected; CONSENT-PENDING; SYNC-OK; messages M1–M11.
**Ideal path**: 2 — read the card, click Allow.
**Alternate paths**: Settings "AI data sharing" section with one switch per model (`AiDataSharing.tsx:~56-100`, `AiDataSharingSection`).

##### Steps
1. Opens Inbox → rows appear in two groups, **Today** and **Earlier**. No "Needs reply" group, no Important toggle, no To do card.
2. Above the list, a card: "**Let Rakazo sort your mail** — Senders, recipients, subjects and short previews are sent to {model name}." with **Allow** (`AiDataSharing.tsx:36-50`). **Hesitation**: the card does not say what she gets in return (to-dos, Needs reply, categories), and there is no "Not now" button.
3. Clicks **Allow** → the card goes away, the page re-syncs, and within about 30 seconds (polling every 5 s, up to 6 times, `Inbox.tsx:51-52`) a **Needs reply** group, an **Important** toggle and a **To do** card appear.

##### Variations
- She ignores the card: it stays at the top of every visit; nothing else changes.
- She searches first: the card is hidden while a search or filter is active (`Inbox.tsx:718`), so she may never see it.

##### Edge Cases
- Triage takes longer than 6 polls (30 s): the new groups appear only after the next manual visit or sync; no "Sorting your mail…" status is shown.

### Stories: Reading and triage

#### STORY-INB-003: Read an email, then mark it unread to come back later

**Type**: short
**Topic**: Mail list
**Persona**: Maya, wants to flag the hosting invoice for later
**Goal**: Look at an email and keep it bold so she remembers it.
**Preconditions**: A1; CONSENT-GIVEN; SYNC-OK; M2 unread.
**Ideal path**: 3 — open, Mark unread, close.
**Alternate paths**: Row hover button "Mark unread" (wide screens) or row **More** menu (narrow) (`InboxRow.tsx:124-131, 197-253`); dialog button (`InboxMessageDialog.tsx:274-279`).

##### Steps
1. Sees M2 bold with a blue dot (unread) and the sidebar Inbox badge showing an unread count.
2. Clicks the row → a large dialog opens with subject, sender, time, Reply / Reply all / Forward / Archive / **Mark read** buttons, the body, and the `INV-4471.pdf` chip. URL gains `?mail=<id>`.
3. After 0.8 s the message is marked read (`Inbox.tsx:410-421`); the dialog button changes to **Mark unread**. **Hesitation**: the button label flips without any notice; she may not notice the change at all.
4. Clicks **Mark unread** → button flips back to **Mark read**.
5. Presses Esc or the X → back on the list; M2 is bold again; the row has focus.

##### Variations
- She opens and closes within 0.8 s → it stays unread (by design, so stepping with j/k does not mark everything read).

##### Edge Cases
- No toast and no Undo for read/unread changes (prior P3-02).

#### STORY-INB-004: Archive the newsletter, then undo

**Type**: short
**Topic**: Triage actions
**Persona**: Maya, clearing noise
**Goal**: Get the newsletter out of the way, then change her mind.
**Preconditions**: A1; CONSENT-GIVEN; M4 in inbox.
**Ideal path**: 2 — Archive, Undo.
**Alternate paths**: row hover Archive icon, row More → Archive, dialog **Archive** button, key `e` on the list or in the dialog.

##### Steps
1. Hovers M4 → icons appear on the right: Archive, Mark read/unread, a star ("Mark important"), a bell-off ("Mark noise"). **Hesitation**: the icons have no visible text; she must hover each for its name (aria-label only, no tooltip).
2. Clicks the Archive icon → the row disappears; bottom toast "**Archived** · Undo" for 6 s (`Inbox.tsx:53, 467-486`).
3. Clicks **Undo** → the row comes back after the server confirms.

##### Variations
- Archives from inside the dialog → the dialog moves on to the next message instead of closing (`Inbox.tsx:826-833`). She expected to return to the list.

##### Edge Cases
- The archive applies to the whole Gmail thread (`inbox-modify.ts:110`); the toast does not say so.

#### STORY-INB-005: "Mark noise" on one newsletter mutes the sender everywhere

**Type**: short
**Topic**: Triage marks
**Persona**: Maya, wants fewer newsletters at the top
**Goal**: Tell the app this one newsletter is not important.
**Preconditions**: A1 and A2 connected; CONSENT-GIVEN; M4 from `news@roboticsweekly.example`.
**Ideal path**: 1 — click Mark noise.
**Alternate paths**: More menu → "Mark noise" checkbox item (`InboxRow.tsx:254-262`).

##### Steps
1. Hovers M4, clicks the bell-off icon ("Mark noise") → row text dims; toast "**Marked noise** · Undo".
2. **Hesitation / misread**: she believes she marked one email. The server stores the mark on the **sender address**, for all her accounts (`inbox.ts:414-440`). Every future Robotics Weekly email is dimmed and dropped from the Important view.
3. Turns on **Important** → M4 is gone, as expected.

##### Variations
- She marks Priya (an investor) "important" to keep one email visible → every Priya email now counts as important.
- She clicks the star again to unmark → `aria-pressed` toggles; no toast on unmark.

##### Edge Cases
- There is no list of marked senders anywhere, so she cannot review or reverse marks except one row at a time.

#### STORY-INB-006: Find last month's W-9 that is not in the list

**Type**: medium
**Topic**: Search
**Persona**: Maya, her accountant asks "did you get my W-9?"
**Goal**: Find an email from 20 days ago.
**Preconditions**: A1; SYNC-OK; M10 is 20 days old (outside the 14-day cache window, `inbox.ts:36`).
**Ideal path**: 3 — type "W-9" in search, Enter, open the result.
**Alternate paths**: "Search older mail" button at the bottom of the list (focuses the same box, `Inbox.tsx:804-814`); key `/`; ask the Inbox agent (STORY-INB-019).

##### Steps
1. Scrolls the list to the bottom looking for older mail → sees **Search older mail**. **Hesitation**: she expected the list to keep loading older mail when she scrolls.
2. Clicks it → cursor moves to the "Search mail" box at the top.
3. Types `W-9` and presses Enter → URL gets `?q=W-9`; the list becomes one date-ordered list with "1 result" and a **Clear** button.
4. Opens M10 → message dialog.
5. Tries `from:ken` → works because search text goes to Gmail as typed (`Inbox.tsx:65`). Nothing on screen tells her Gmail syntax is supported.
6. Presses Esc in the search box → search clears.

##### Variations
- More than one page of results: "N+ results" and **Load more**; at the end "No more results".
- A typo, `W9 kenn` → "No results for "W9 kenn"" with **Clear**.

##### Edge Cases
- Search results lose the Needs reply grouping and the To do card; returning via Clear restores them.

#### STORY-INB-007: "Show me only the important stuff" — Important toggle, filters, categories

**Type**: medium
**Topic**: Filters
**Persona**: Maya, 30 minutes before a board meeting
**Goal**: See only mail that matters, then only bills.
**Preconditions**: A1; CONSENT-GIVEN; M1–M11; Priya marked important (from STORY-INB-005 variation) optional.
**Ideal path**: 2 — toggle Important; pick "Bills" from Filter.
**Alternate paths**: Ask the Inbox agent "what's important today?" (STORY-INB-019).

##### Steps
1. Clicks **Important** (a toggle button next to search) → URL `?view=important`; list shows M1, M3 and M11 under a result count; Today/Earlier headings disappear.
2. Opens the Filter (funnel icon) menu → items: Unread, Starred, Has attachment; "Gmail tabs": Primary, Promotions, Social, Updates; "Categories": Bills, Receipts, Scheduling, Newsletters, Security, Notifications, Personal.
3. **Hesitation**: with sorting on, Gmail's own "Important" item is removed from this menu (`Inbox.tsx:577-579`) and replaced by the toggle, which means something different (the app's triage, not Gmail's star-arrow marker).
4. Picks **Bills** → Important turns off (they cannot be combined, `inbox-list-input.ts:44-60`); only M2 shows; the filter button now reads "Bills".
5. Picks **Has attachment** → Bills is replaced, not added. **Hesitation**: she expected to combine "Bills" and "Has attachment".
6. Clicks **Clear** → full list.

##### Variations
- With CONSENT-PENDING, the toggle and Categories group are missing entirely and "Important" is back inside the menu.

##### Edge Cases
- Filtering by Unread reads live from Gmail, while Bills reads the 14-day cache; the two lists can disagree about the same message.

#### STORY-INB-008: Read the whole term-sheet thread

**Type**: short
**Topic**: Threads
**Persona**: Maya, needs to see what Priya and she said before replying
**Goal**: Read every message in the "Re: Series A term sheet" conversation.
**Preconditions**: A1; CONSENT-GIVEN; M1 thread with 4 messages.
**Ideal path**: 2 — open the thread, scroll through the messages.
**Alternate paths**: Reply → expand "Show quoted text" (…) to read the quoted history; open Gmail itself.

##### Steps
1. Sees one row for the thread in **Needs reply** (rows are one per thread, `inbox.ts:126-134`).
2. Opens it → the dialog shows only the **newest** message. There is no list of earlier messages, no count, no "4 messages" label (`InboxMessageDialog.tsx:113-310`).
3. **Hesitation**: she scrolls looking for earlier messages and finds none. She cannot see her own earlier reply.
4. Clicks **Reply**, then the small "…" button ("Show quoted text") → the quoted history appears inside the composer. She reads it there and closes the composer without writing.

##### Variations
- Uses the up/down chevrons hoping they step through the thread → they step to the previous/next **row** in the list instead.

##### Edge Cases
- Closing an untouched reply discards it silently (no draft is saved) — correct, but she does not know that.

### Stories: Writing mail

#### STORY-INB-009: Reply to Luis about moving the demo

**Type**: short
**Topic**: Reply
**Persona**: Maya
**Goal**: Say "Friday works" to a customer.
**Preconditions**: A1; M3 unread, needsReply.
**Ideal path**: 4 — open, Reply, type, Send.
**Alternate paths**: keys `r` then Cmd/Ctrl+Enter (prior STORY-001); ask the Inbox agent (STORY-INB-020).

##### Steps
1. Opens M3 from **Needs reply** → dialog.
2. Clicks **Reply** → a second dialog "Reply" with To prefilled (Luis), Subject "Re: …", cursor in the body, formatting bar shown, quoted text hidden behind "…".
3. Types "Hi Luis — Friday at 2pm works. Maya". After a 1.5 s pause: "Draft saved" at the bottom.
4. Clicks **Send** → composer closes; toast "Sending… · Undo" for 5 s, then "Sent" for 3 s; list reloads.
5. **Hesitation**: the message dialog is still open behind; she must press Esc to get back. M3 still sits in Needs reply until triage runs again.

##### Variations
- She tries to change From → no From field on replies (`InboxMessageDialog.tsx:282` passes no accounts).

##### Edge Cases
- The quoted original is sent even though it is hidden (comment at `ComposeEmail.tsx:479`).

#### STORY-INB-010: Reply all to the board prep thread, then pull it back

**Type**: medium
**Topic**: Reply all, Undo send
**Persona**: Maya, replying to 5 people
**Goal**: Send a time change to everyone, notice a mistake, undo it.
**Preconditions**: A1; M9 with 4 Cc recipients.
**Ideal path**: 6 — open, Reply all, type, Send, Undo, fix and Send.
**Alternate paths**: key `a` in the dialog. No way to switch Reply to Reply all inside the composer.

##### Steps
1. Opens M9 → clicks **Reply all**.
2. Recipient rows fold into one line "Sam Lee, Priya Shah, Ken Ito +2 more" while focus is elsewhere (`ComposeEmail.tsx:107, 565-572`). **Hesitation**: she cannot tell which line is To and which is Cc; clicking it opens the full rows.
3. Types "Moving prep to 4pm Thursday." and clicks **Send** → "Sending… · Undo".
4. Realises she meant Wednesday; clicks **Undo** within 5 s → the composer reopens exactly as it was.
5. Fixes the day and sends → "Sent".

##### Variations
- She waits 6 s before clicking Undo → Undo is gone; mail is sent. There is no "Unsend" after the hold.
- She removes Ravi from Cc using the chip X → sent to 4.

##### Edge Cases
- An invalid typed address → "Fix or remove the highlighted addresses." or a specific address error; Send does nothing until fixed.

#### STORY-INB-011: Forward the signed MSA to the company lawyer

**Type**: medium
**Topic**: Forward, attachments
**Persona**: Maya
**Goal**: Send the signed contract to `counsel@ellis-law.example` with a short note.
**Preconditions**: A1; M6 with 3.4 MB PDF; M7 with 30 MB + 2.1 MB attachments for the variation.
**Ideal path**: 4 — open, Forward, add recipient, Send.
**Alternate paths**: key `f`; download then attach manually in a New message.

##### Steps
1. Opens M6 → **Forward**.
2. Composer "Forward": To is empty and focused; the PDF shows as a chip with its size; the forwarded message sits in the body.
3. Types `counsel@ellis-law.example`, presses Enter → chip.
4. Adds "Please file this." above the forwarded block and clicks **Send** → Sending… / Sent.

##### Variations
- Forwards M7 (30 MB video + 2.1 MB PNG) → notice "Attachments can't be over 10 MB." and **no** attachment chips at all: the server drops every attachment when the total is too big (`apps/api/src/inbox-compose.ts:120-123`; limit 10 MB in `contracts/src/inbox.ts:229`). **Hesitation**: she wanted to keep the small floor plan; she has to download it (STORY-INB-015) and attach it by hand.

##### Edge Cases
- Closing a forward after editing keeps a Gmail draft, but there is no Drafts view in the app to find it later.

#### STORY-INB-012: Write a new email from the right account

**Type**: medium
**Topic**: Compose, two accounts
**Persona**: Maya, with work and personal Gmail connected
**Goal**: Email an investor from the work address, attaching the pitch deck.
**Preconditions**: A1 + A2 connected; SYNC-OK; a local file `Northwind_Deck_Oct.pdf` (MOCK, 6 MB) and `Northwind_Demo.mp4` (MOCK, 14 MB) on the test machine.
**Ideal path**: 5 — Compose, check From, To, Subject+body, attach, Send.
**Alternate paths**: key `c`; select an account tab first so From starts on it (`Inbox.tsx:849`).

##### Steps
1. Sees tabs **All / Northwind (MOCK) / Personal (MOCK)** under the heading.
2. Clicks the pen icon (aria-label "Compose"; no visible text) → "New message" with a **From** select, To focused. **Hesitation**: the pen icon has no label; she first looks for a "New" or "Compose" button.
3. From shows the first account. She checks it says Northwind.
4. Fills To `priya@harbor-vc.example`, Subject "Northwind deck — October", body.
5. Clicks the paperclip ("Attach files") → picks the deck → chip "Northwind_Deck_Oct.pdf 6 MB".
6. Drags the demo video in → "Attachments can't be over 10 MB."; the video is not added.
7. **Send** → Sending… / Sent.

##### Variations
- She was on the **Personal** tab → From starts on Personal; easy to miss.

##### Edge Cases
- She closes with an attachment → "Discard attachments?" with **Keep editing** / **Discard**; autosaved drafts never include attachments.

#### STORY-INB-013: Start a reply, get pulled away, continue later

**Type**: medium
**Topic**: Drafts
**Persona**: Maya, interrupted by a call
**Goal**: Not lose a half-written reply.
**Preconditions**: A1; M1.
**Ideal path**: 3 — close, reopen Reply, keep typing.
**Alternate paths**: Gmail's own Drafts folder (outside the app).

##### Steps
1. Opens M1 → Reply → types two sentences → "Draft saved".
2. Closes the composer (X) and the dialog.
3. Later opens M1 → **Reply** → her text is back (session memory keyed by mode + message, `draft-memory.ts:1-27`).
4. **Hesitation**: she clicks **Reply all** instead of Reply → an empty composer; her text is under the Reply key only.
5. Reloads the browser and opens Reply again → empty composer; the earlier text is now only in Gmail Drafts. Sending this one creates a second message; the first draft stays in Gmail.

##### Variations
- A **New message** closed mid-way is never remembered (no key for "new"), only saved as a Gmail draft.

##### Edge Cases
- The trash icon ("Discard") removes the draft after a 5-second "Draft discarded · Undo" toast.

### Stories: To-dos and attachments

#### STORY-INB-014: Work the "To do" list the app made from mail

**Type**: short
**Topic**: To-dos from mail
**Persona**: Maya
**Goal**: Tick off what she did and go to the email behind a to-do.
**Preconditions**: A1; CONSENT-GIVEN; T1–T4.
**Ideal path**: 2 — click a to-do to open its email; tick it.
**Alternate paths**: find the email by hand in Needs reply; ask the agent.

##### Steps
1. Sees the **To do** card at the top: T1 (due "Today", red), T2 (due weekday), T3, then T4 struck through.
2. Clicks T1's text expecting the term-sheet email → nothing happens. The card has no link even though each to-do stores its `messageId` (`TodoCard.tsx:77-87`; `contracts/src/inbox.ts:144`).
3. Finds M1 manually, replies (STORY-INB-009), then ticks T1's checkbox → struck through.
4. On a narrow window only 2 open to-dos show plus "**1 more**".

##### Variations
- She wants to add her own to-do ("Call the bank") → no add field.
- She wants to remove a wrong to-do → only "done" exists.

##### Edge Cases
- A failed tick shows an error line in the card; the checkbox state may not match.

#### STORY-INB-015: Download attachments, including one that is too big

**Type**: short
**Topic**: Attachments
**Persona**: Maya
**Goal**: Save the invoice PDF and the factory video.
**Preconditions**: A1; M2 (180 KB), M7 (30 MB `.mov`).
**Ideal path**: 2 — open, click the attachment.
**Alternate paths**: none found in the web app.

##### Steps
1. Opens M2 → under the body, a chip "INV-4471.pdf 180 kB". Clicks it → file downloads (saved, not opened in the page, `InboxMessageDialog.tsx:351-364`).
2. **Hesitation**: she expected a preview; nothing visible happens except the browser download.
3. Opens M7 → clicks `factory_walkthrough.mov` (30 MB) → red "**Download failed**". The server rejects attachments over 25 MiB with 413 (`inbox.ts:40, 509`), but the message gives no reason or alternative.

##### Variations
- Clicks `floorplan.png` → downloads fine.

##### Edge Cases
- Sizes display in decimal units ("30 MB") while the limit is 25 MiB; the UI never states the limit.

#### STORY-INB-016: Put the signed MSA into the Data room

**Type**: medium
**Topic**: Attachments into the Data room
**Persona**: Maya, building a diligence folder for the Series A
**Goal**: File the signed contract from email into the Data room.
**Preconditions**: A1; M6; DR-EMPTY (and DR-SEEDED for the duplicate edge case).
**Ideal path**: 2 — open the email, click "Save to Data room" (does not exist today).
**Alternate paths**: (a) download, open **Data room**, **Choose files**; (b) download, drag the file onto any app page (global drop zone "Drop to add to Data room", `DropZone.tsx:25-80`); (c) drag onto the Data room page.

##### Steps
1. Opens M6 → looks for a "Save to Data room" or "File" action on the attachment chip → none; the chip only downloads.
2. Clicks the chip → `Acme_Northwind_MSA_signed.pdf` downloads.
3. Clicks **Data room** in the sidebar → empty page "Drop files here" / **Choose files**.
4. Clicks **Choose files** → picks the file → toast "Filed" with **View**.
5. **Hesitation**: she expected the Data room to know the file came from Luis's email; it has no link back.

##### Variations
- She drags the downloaded file straight onto the Inbox list → the overlay "Drop to add to Data room" appears and the file is uploaded, without leaving the Inbox.
- She drags it onto an open composer instead → it attaches to the email, not the Data room (composer takes the drop first).

##### Edge Cases
- DR-SEEDED: uploading the same PDF again → prior P2-03 says the toast still reads "Filed" instead of "already there".

### Stories: Sync problems

#### STORY-INB-017: "Gmail needs to be reconnected"

**Type**: short
**Topic**: Reconnect notice
**Persona**: Maya, Google sign-in expired
**Goal**: Get mail flowing again.
**Preconditions**: A1 with SYNC-RECONNECT; cached rows M1–M9 still present.
**Ideal path**: 2 — click Reconnect, approve Google sign-in.
**Alternate paths**: Integrations → Gmail app detail → reconnect (prior STORY-063).

##### Steps
1. Opens Inbox → red line "**Gmail needs to be reconnected.**" with a **Try again** button (`Inbox.tsx:667-674`, `inbox-sync-error.ts:10`). Old rows still show below.
2. Clicks **Try again** → re-sync fails the same way; the same line returns.
3. **Hesitation**: there is no Reconnect button or link; she does not know reconnecting happens on the Integrations page.
4. Goes to Integrations via the sidebar and reconnects Gmail.

##### Variations
- With two accounts, only one needs reconnecting → the message does not say which one.

##### Edge Cases
- Sending a reply while disconnected → composer reopens with "Not sent. Gmail needs to be reconnected." (`ComposeEmail.tsx:90, 111-112`).

#### STORY-INB-018: "Gmail is limiting requests right now"

**Type**: short
**Topic**: Rate-limit notice
**Persona**: Maya
**Goal**: Understand why mail is not updating.
**Preconditions**: A1 with SYNC-RATELIMIT.
**Ideal path**: 1 — read the message, wait, and the list refreshes by itself.
**Alternate paths**: none found.

##### Steps
1. Opens Inbox → "**Gmail is limiting requests right now. Try again in a minute.**" + **Try again**.
2. Clicks **Try again** at once → same message.
3. Waits a minute, clicks again → message gone, list updates.

##### Variations
- Rate limit and reconnect at the same time on different accounts → only the reconnect text shows (`inbox-sync-error.ts:10-12`).

##### Edge Cases
- Nothing refreshes automatically after the minute; she must click.

### Stories: Agent and approval cards

#### STORY-INB-019: Ask the Inbox agent "what needs my reply today?"

**Type**: medium
**Topic**: Inbox agent
**Persona**: Maya, would rather ask than scan
**Goal**: Get a short list of mail she must answer.
**Preconditions**: A1; CONSENT-GIVEN; AGENT-NONE (then AGENT-READY after step 3).
**Ideal path**: 3 — open the agent panel, ask, open a cited email.
**Alternate paths**: Needs reply group and Important toggle on the page itself (same answer, two surfaces).

##### Steps
1. On a wide window, no agent panel is visible. Clicks the panel icon (aria-label "**Show Inbox agent**", `Inbox.tsx:632-641`) → a side panel opens with **Create Inbox agent**. **Hesitation**: she does not know what an "agent" is or what creating one costs.
2. Clicks **Create Inbox agent** → a chat thread appears.
3. Types "what needs my reply today?" → the agent searches mail and replies with email cards grouped "Today / Within 3 days / This week / Later" (`EmailCards.tsx:18-23`).
4. Clicks the M1 card → the same message dialog as the Inbox opens, but without Archive or Mark read buttons (`EmailCards.tsx:97-104`).

##### Variations
- Panel collapsed by "Collapse Inbox agent" → the choice is remembered per user.
- On a phone-width window the panel starts collapsed.

##### Edge Cases
- Prior P2-29: with the panel open at 1024 px, the list is about 324 px wide; badges and hover icons disappear.

#### STORY-INB-020: Approve the reply the agent wrote

**Type**: medium
**Topic**: Approval cards for sending
**Persona**: Maya
**Goal**: Let the agent send "Friday works" to Luis, after checking it.
**Preconditions**: A1; AGENT-READY; CARD-PENDING.
**Ideal path**: 2 — read the card, Send.
**Alternate paths**: write it herself (STORY-INB-009); "Open in composer" after a failed send (prior STORY-036).

##### Steps
1. Opens the Inbox agent panel → a card "**Mail** Needs approval · luis@acme-logistics.example" with To, Subject, body, and buttons **Send**, **Discard**, **Edit**, a More (…) menu.
2. **Hesitation**: the agent's own instructions say "You can read mail but not send" (`apps/api/src/inbox-agent.ts:5-6`), yet here it is asking to send. If the agent earlier said "I can't send email", this card contradicts it.
3. Clicks **Edit** → changes "2pm" to "3pm" → **Done** → **Send** → "Sending…" then "Sent".
4. Without editing, a Send folds to "**Approved**" and never says "Sent" (prior P2-23).

##### Variations
- Opens More → a checked "Needs approval" item that does nothing, and "Disable sending for Inbox agent" (prior P2-25, P3-08).
- **Discard** → card reads "Discarded".

##### Edge Cases
- The sent reply does not appear in the Inbox list (sent mail is not in INBOX); M3 stays in Needs reply until triage reruns.

### Stories: Accounts

#### STORY-INB-021: Two inboxes, one morning

**Type**: short
**Topic**: Multi-account
**Persona**: Maya, work and personal Gmail
**Goal**: Look only at work mail, then come back to it after a reload.
**Preconditions**: A1 + A2; SYNC-OK; M1–M12.
**Ideal path**: 1 — click the work tab.
**Alternate paths**: none found.

##### Steps
1. Sees tabs **All / Northwind (MOCK) / Personal (MOCK)**; All mixes M12 (dentist) with investor mail.
2. Clicks **Northwind (MOCK)** → only A1 rows; To do card shows A1 to-dos only.
3. Reloads the page → back on **All**. The tab is not in the URL (`Inbox.tsx:110`, local state), unlike search and filters.

##### Variations
- Rows in All do not say which account they belong to.

##### Edge Cases
- A removed account's tab silently falls back to All (`Inbox.tsx:169-171`).

### Stories: Long end-to-end

#### STORY-INB-022: First morning with the app — from empty Inbox to clear Inbox

**Type**: long
**Topic**: End-to-end
**Persona**: Maya, day one, 40 minutes before a customer call
**Goal**: Connect mail, understand what needs attention, answer two people, file one contract, and leave with nothing urgent left.
**Preconditions**: MOCK DEMO DATA space; no mail connected at start; after connecting, A1 has M1–M11 and CONSENT-PENDING; AGENT-NONE; DR-EMPTY.
**Ideal path**: 14 — connect (3), allow sorting (1), reply to two (4+4), archive two (2), file one attachment (2: if a direct action existed).
**Alternate paths**: the agent route for the replies (STORY-INB-023); keyboard route (prior STORY-001).

##### Steps
1. Sidebar **Inbox** → **Connect mail** → Integrations → connects Gmail (STORY-INB-001).
2. Returns to Inbox by the sidebar → skeleton → Today / Earlier lists.
3. Reads the "Let Rakazo sort your mail" card → clicks **Allow** (STORY-INB-002).
4. Waits; **Needs reply** (M1, M3), **Important** toggle and **To do** card appear.
5. **Hesitation**: M11 "Urgent: wire transfer update" shows a small red warning icon labeled "Suspicious" only for screen readers and on hover. She almost opens it as a real CEO email.
6. Archives M11 with the hover Archive icon → "Archived · Undo".
7. Opens M3 → **Reply** → "Friday 2pm works." → **Send** → "Sending… · Undo" → "Sent".
8. Presses Esc to leave the dialog.
9. Opens M1 → sees only Priya's newest message (STORY-INB-008) → **Reply** → expands "…" to read history → writes "Comments coming tonight." → **Send**.
10. Ticks **T3** in To do. Tries clicking T1 to open its email — nothing (STORY-INB-014).
11. Hovers M4 → clicks bell-off "Mark noise" thinking it is just this email (STORY-INB-005).
12. Opens M6 → downloads the MSA → sidebar **Data room** → **Choose files** → "Filed" (STORY-INB-016).
13. Back to **Inbox** → list reloads; M3 and M1 still sit in Needs reply until triage reruns. **Hesitation**: she replied to both and expected them to leave that group.
14. Turns on **Important** → checks nothing else is urgent → turns it off.
15. Presses `?` → "Keyboard shortcuts" dialog → notes `e` and `r` for tomorrow.

##### Variations
- She says no to sorting (ignores the card) → steps 4, 10, 11, 14 are unavailable; Inbox is a plain list.

##### Edge Cases
- If Gmail rate-limits during the first sync → STORY-INB-018 notice on step 2.

#### STORY-INB-023: "Draft replies to everything that needs one" — let the agent do it

**Type**: long
**Topic**: End-to-end (agent + approval cards)
**Persona**: Maya, wants the app to do the typing
**Goal**: Have the agent prepare replies for every Needs reply email, approve two, throw away one.
**Preconditions**: A1; CONSENT-GIVEN; M1, M3, M9 needsReply; AGENT-READY; mock agent runtime scripted to return three `mail_send` approval cards (to Priya, Luis, Sam).
**Ideal path**: 7 — open panel, ask, review and Send two cards, Discard one, check the Inbox.
**Alternate paths**: reply by hand from each message (STORY-INB-009/010).

##### Steps
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

##### Variations
- At 1024 px, the narrow panel hides the recipient on pending cards (prior P2-26); she approves without seeing who gets it.
- She uses More → "Disable sending for Inbox agent" on the first card → later cards are denied silently (prior P2-25).

##### Edge Cases
- A send whose result is unclear → "Unknown" with "Not confirmed as sent. Check Sent before trying again." and no link to Sent.

#### STORY-INB-024: Term-sheet day — read, file, forward, reply

**Type**: long
**Topic**: End-to-end (threads, attachments, Data room, forward)
**Persona**: Maya, closing a Series A
**Goal**: Read Priya's redlines, file the redlined PDF in the Data room, forward it to counsel, reply to Priya, and close the to-do.
**Preconditions**: A1; CONSENT-GIVEN; M1 thread (4 messages, redline PDF on newest); T1; DR-EMPTY; local Downloads folder writable.
**Ideal path**: 10 — open M1, save PDF to Data room (1 if direct), Forward + recipient + Send (3), Reply + text + Send (3), tick T1 (1), Archive (1).
**Alternate paths**: ask the agent to find the thread; drag the downloaded PDF onto the page instead of Choose files.

##### Steps
1. Searches "term sheet" → 1 result (thread) → opens it.
2. Sees only Priya's newest message (STORY-INB-008). Wants the original term sheet from message 1 → cannot reach it here.
3. Clicks `Northwind_TermSheet_v3_redline.pdf` → it downloads.
4. Sidebar **Data room** → **Choose files** → picks the PDF → "Filed" → **View**.
5. Back to **Inbox**: the search is still in the URL only if she used Back; via the sidebar the search is gone. **Hesitation**: she re-types the search.
6. Opens M1 → **Forward** → To `counsel@ellis-law.example` → "Redlines from Harbor. Can we talk at 5?" → **Send**.
7. Message dialog returns → **Reply** → "Thanks Priya — counsel is reviewing, comments by Friday." → **Send** → "Sent".
8. **Clear** search → To do card returns → ticks **T1**.
9. Opens M1 again → **Archive** → dialog jumps to the next message instead of closing. Presses Esc.
10. Wants to confirm the archived thread is safe (archive is not delete). The "Archived · Undo" toast is gone after 6 s, and the app has no "Archived" or "All mail" view; only a search finds it again.

##### Variations
- Counsel's address typed with a typo (`counsel@ellis-law`) → address error and Send blocked.

##### Edge Cases
- The redline PDF uploaded to the Data room has no record of coming from Priya's email.

---

## Area: Finance (STORY-FIN-nnn)

Source: `docs/ux-paths/finance/catalog.md`.


Generated: 2026-10-16
Source: `/Users/dennison/develop/rakazo-ux` (branch `docs/ux-pass`), read-only.
Scope: `/app/finance/*` (dashboard and detail pages), the Add account dialog, statement upload,
crypto wallets and exchanges, finance tiles on `/app/integrations?category=finance`, the Finance
agent side panel, finance cards in chat, and agent pins and checklists.
Total stories: 23 (short 10, medium 9, long 4)

### Persona (applies to every story)

A first-time user. They are a startup founder who has never seen Rakazo or its code. They do not
know its terms ("burn", "runway scope", "MCP", "Blockscout", "pins"). They want to run their
company clearly and consistently: know how much money they have, what they spend it on, and when it
runs out. Steps are written in their words. **Hesitation** marks a place where a first-timer is
likely to stop, misread a label, or pick the wrong control.

### Demo account (shared preconditions)

The walk runs against a seeded mock demo account. Every visible company, vendor, and person name
must be clearly fake. The baseline seed is called **NW-BASE**:

- Space or company name: `MOCK DEMO DATA — Northwind Robotics`. The signed-in user is the founder
  (for example `Mock Founder`).
- Mercury source with status `ok`, synced within the last 15 minutes. It has:
  - `MOCK Checking ••4821` with about $412,000.
  - `MOCK Treasury ••7730` with about $1,150,000, and Treasury yield rows for the last 6 months
    (dividends, fee, net), so the "Treasury yield" card and the account's Yield table appear.
  - `MOCK Savings ••1190` with about $60,000.
- Brex source with status `ok`. It has the card `MOCK Brex Card ••0001` with about $38,500 owed.
- At least 7 months of transactions, so the 3-month average burn, the Burn chart and the By month
  table have data. Include:
  - Monthly payroll (`MOCK Gusto Payroll`, about $140k/mo, category "Payroll").
  - Rent (`MOCK WeWork`, monthly).
  - SaaS subscriptions with clear monthly cadence: `MOCK AWS`, `MOCK GitHub`, `MOCK Figma`,
    `MOCK Slack`, `MOCK Notion`. Make two of them fall in the same overlap group (for example two
    chat or two docs tools) so the "overlaps" pill shows.
  - At least one vendor with 6+ months of charges and a receipt on the Brex charge (`hasReceipt`).
  - At least one Mercury spend transaction without a known receipt, so "Check for receipt" shows.
  - At least one pending transaction dated in the next 30 days, so Upcoming shows a `pending` row.
  - At least one `bill` item in Upcoming (Brex bill).
  - Revenue deposits (`MOCK Customer — Acme Mock Co`) in some months, and one financing deposit
    (`MOCK Seed Extension`) in one month, so Revenue and Financing bars show.
  - A transfer between the founder's own accounts (Checking to Treasury) and a Brex card payment
    from Checking. These must not count as spend.
  - At least 8 categories, so the Breakdown card shows "Show all N".
- At least one transaction in a non-USD currency, so "1 non-USD not counted" shows in the header.
- Finance agent: **not created yet** in NW-BASE, so the first "Ask agent" creates it.

Extra seeds named in story preconditions:

- **NW-CRYPTO**: NW-BASE plus a Blockscout PRO API key saved; one wallet
  `MOCK Treasury Safe` (type Safe, 2 of 3 owners) on Ethereum holding USDC and ETH; one wallet
  `mock-ops.eth` (type Personal) holding one unpriced token; a Coinbase exchange connection with
  USD, BTC and USDC balances; 90 days of crypto history. The runway scope is `bank`.
- **NW-STATEMENT**: NW-BASE plus one account created from an uploaded statement
  (`MOCK First Mock Bank ••5502`) whose next statement is due, so the reminder banner shows.
  Test files are needed: `mock-firstbank-2026-09.csv` (balances match),
  `mock-firstbank-2026-08.pdf` (balances off by $12.40), `notes.docx` (wrong type), and one file
  over the size limit.
- **NW-EMPTY**: a fresh `MOCK DEMO DATA — Northwind Robotics` space with no finance sources, no
  statement accounts, no wallets and no exchanges.
- **NW-RECONNECT**: NW-BASE with the Mercury source set to `needs_reconnect`.
- **NW-AGENT**: NW-BASE plus an existing Finance agent whose thread holds one earlier turn with 3
  finance tool reads (overview, breakdown by vendor, subscriptions), so a collapsed
  "3 finance lookups" group shows. The agent also has pins: two stat pins
  ("Cash", "Runway") and one checklist ("Month-end close") with 3 items, one of them done.

### Summary

| Type | Count |
|------|-------|
| Short | 10 |
| Medium | 9 |
| Long | 4 |

### Coverage Matrix

| Feature area | Stories | Gaps |
|---|---|---|
| Dashboard: Cash, Monthly burn, Runway, Spend KPIs, refresh | 001, 002, 003, STORY-FIN-019 | — |
| Burn page, month page | 004, 005, STORY-FIN-019 | — |
| Runway page, crypto scope | 006, 015, STORY-FIN-020 | No "what if" scenario in the UI; only the agent can model one |
| Spend page, period tabs, category chips, chart-bar ranges | 007, STORY-FIN-008 | No search, no export |
| Breakdown by category or vendor, category and vendor pages | 008, STORY-FIN-009 | — |
| Subscriptions, Upcoming, recurring page | 010, STORY-FIN-011 | No cancel, rename or "not a subscription" control |
| Transactions and receipts | 012, STORY-FIN-013 | No way to recategorize or add notes |
| Accounts list, source filter, account detail, cards owed | 014, STORY-FIN-019 | Account detail shows only the newest 20 transactions |
| Crypto: wallets, exchanges, Blockscout, Alchemy | 015, 016, STORY-FIN-020 | — |
| Statement upload, reminders, removal | 017, 018, STORY-FIN-021 | No list of past statements after the dialog closes |
| Connecting Mercury and Brex, reconnecting | 001, 019, STORY-FIN-022 | No disconnect in Finance |
| Finance agent panel, finance cards, Ask about this | 020, 022, STORY-FIN-021 | — |
| Pins and checklists | STORY-FIN-022 | Hidden in the Finance side panel |
| Errors, empty states, not found | 001, 013, 018, STORY-FIN-023 | — |

### Story Dependency Graph

```text
NW-EMPTY
└── STORY-FIN-001 (first visit, connect Mercury)
    └── STORY-FIN-019 (long: first morning with Finance)

NW-BASE
├── STORY-FIN-002 (how much cash)
├── STORY-FIN-003 (refresh)
├── STORY-FIN-004 → STORY-FIN-005 (burn → month)
├── STORY-FIN-006 (runway)
├── STORY-FIN-007 → STORY-FIN-008 → STORY-FIN-009 (spend → category → vendor)
├── STORY-FIN-010 → STORY-FIN-011 (subscriptions → upcoming)
├── STORY-FIN-012 → STORY-FIN-013 (transaction → receipt)
├── STORY-FIN-014 (accounts, card owed)
└── STORY-FIN-023 (wrong links, not found)

NW-CRYPTO
├── STORY-FIN-015 (count crypto in runway)
├── STORY-FIN-016 (add, edit, remove wallet and exchange)
└── STORY-FIN-020 (long: investor update with crypto)

NW-STATEMENT
├── STORY-FIN-017 (reminder → upload)
├── STORY-FIN-018 (bad files)
└── STORY-FIN-021 (long: bank without an integration)

NW-RECONNECT + NW-AGENT
└── STORY-FIN-022 (long: monthly review with the agent, pins, reconnect)
```


### Stories: First visit and connecting

#### STORY-FIN-001: Open Finance for the first time and connect the bank

**Type**: medium
**Topic**: Connecting
**Persona**: Naive first-time founder
**Goal**: "I bank with Mercury. I want this app to show my cash."
**Preconditions**: NW-EMPTY. A Mercury OAuth sandbox or stub that completes sign-in for a mock
Mercury org with NW-BASE accounts.
**Ideal path**: 3 — click Finance, click Mercury, approve the sign-in popup.
**Alternate paths**: (a) Integrations page `/app/integrations?category=finance` → Mercury tile
"Connect" (`FinanceSection.tsx:395-404`); (b) Accounts page "Add account" (only reachable later).

##### Steps
1. Click **Finance** in the left sidebar → `/app/finance` shows the Mercury and Brex logos, the
   heading "Finance", the line "Add an account to see cash, burn, runway and spend." and one
   button, **Add account**.
   - Hesitation: only bank logos are shown. A founder who also holds crypto or uses another bank
     does not know those are supported until the dialog opens.
2. Click **Add account** → dialog "Add account" with a **Bank** section (Mercury "Read balances
   and transactions", Brex "Read cards, expenses and bills", "Upload statements" "PDF, CSV, OFX or
   QFX") and a **Crypto** section (Wallet "Address or ENS", Coinbase, Kraken "Read-only API key").
3. Click **Mercury** → a sign-in popup opens. The Mercury card is disabled while it waits.
4. Approve access in the popup → the popup closes, the dialog closes, and the dashboard reloads.
5. Watch the header → "Syncing…" with a spinning refresh icon, and skeleton cards until the first
   sync finishes.
6. After the sync → KPI cards "Cash", "Monthly burn", "Runway", "Spend this month" show values,
   and a green-dot "Mercury" chip shows next to the title. Because Brex is the only source still
   missing, a small link **Add Brex** shows.

##### Variations
- Close the popup without approving → the dialog stays open with "Sign-in was cancelled or did
  not finish. Try again."
- Connect from Integrations instead → the tile changes to "Connected" with **Open Finance**.

##### Edge Cases
- The first sync fails → a red notice with a retry control shows above the cards.
- **Add Brex** goes to Integrations, not to the Add account dialog where Mercury was connected.
  The founder connects two banks in two different places.

---

#### STORY-FIN-002: "How much cash do we have right now?"

**Type**: short
**Topic**: Dashboard
**Persona**: Naive first-time founder
**Goal**: Read one trustworthy cash number and see what makes it up.
**Preconditions**: NW-BASE.
**Ideal path**: 1 — open Finance and read the Cash card.
**Alternate paths**: Accounts page "Total cash" KPI (`FinanceAccounts.tsx:239`); Runway page
"Cash" KPI (`FinanceBurn.tsx:249`); Finance agent overview card "Cash" (`FinanceCards.tsx:120`).

##### Steps
1. Open **Finance** → the **Cash** card shows about $1,622,000 with the subtitle
   "Checking + Treasury".
   - Hesitation: the subtitle leaves out Savings, but Savings is counted. The Accounts page says
     "Checking + Savings + Treasury" for the same number.
2. Notice the Brex card balance is not part of the number → no hint on the dashboard says card
   debt is excluded.
3. Click the **Cash** card → `/app/finance/accounts` shows "Total cash", "Card balance owed
   $38,500 — Not counted in cash", a "Total balance" chart, and the list of cash accounts.

##### Variations
- Mobile width → the KPIs wrap into a 2-column grid.

##### Edge Cases
- "1 non-USD not counted" shows in the header with no link or explanation of which transaction.

---

#### STORY-FIN-003: Make sure the numbers are current

**Type**: short
**Topic**: Dashboard
**Persona**: Naive first-time founder
**Goal**: "I just paid a contractor. Is that in here yet?"
**Preconditions**: NW-BASE, last sync about 2 hours ago (shows "Updated 2 hours ago").
**Ideal path**: 1 — click refresh.
**Alternate paths**: none found (opening Finance also triggers one sync per visit,
`Finance.tsx:140-144`).

##### Steps
1. Read the header → "Updated 2 hours ago" next to a small refresh icon with no text label.
   - Hesitation: the icon is tiny and only has an aria-label "Refresh".
2. Click the refresh icon → it spins and the text changes to "Syncing…".
3. Wait → the text changes to "Updated just now" (or similar) and the numbers reload.

##### Edge Cases
- Sync service unavailable → red "Finance sync is not available" notice with retry.

---

### Stories: Burn and runway

#### STORY-FIN-004: "What is our burn?"

**Type**: medium
**Topic**: Burn
**Persona**: Naive first-time founder
**Goal**: Understand monthly burn and where it goes.
**Preconditions**: NW-BASE.
**Ideal path**: 2 — click Monthly burn, read the Burn page.
**Alternate paths**: dashboard "Burn ›" section title (`Finance.tsx:487`); Runway page "Monthly
burn" KPI (`FinanceBurn.tsx:250-254`).

##### Steps
1. On the dashboard, read **Monthly burn** → about $205,000 with "3-mo avg".
   - Hesitation: a founder may expect gross spend this month; "3-mo avg" is the only hint.
2. Look at the **Burn** chart → dark "Out", grey "Revenue", and striped "Financing" bars by day
   (Month tab is selected). The last bar has an asterisk and "* So far".
3. Click **Monthly burn** → `/app/finance/burn` shows the KPI, a monthly bar chart, "Where it
   went" (a stacked bar and category rows with swatches), "By account" with percent shares, and
   "By month" (Month, Out, In, Net).
4. Read the **By month** table → Net is red when negative, green when positive. The financing
   month shows a large positive Net.
   - Hesitation: "Net" mixes revenue and financing, while the KPI above excludes them. The
     founder may not understand why the burn KPI and the Net column disagree.

##### Variations
- Choose **Year** on the dashboard period tabs → the dashboard Burn chart changes to monthly bars;
  clicking one opens the month page.

---

#### STORY-FIN-005: Drill into one month

**Type**: short
**Topic**: Burn
**Persona**: Naive first-time founder
**Goal**: "Why was August so expensive?"
**Preconditions**: NW-BASE with a large one-off August charge (`MOCK Hardware Supplier`, $48,000).
**Ideal path**: 2 — open Burn, click August.
**Alternate paths**: dashboard Year tab → click the August bar (`Finance.tsx:510-516`);
Burn page chart bar (`FinanceBurn.tsx:71`).

##### Steps
1. On `/app/finance/burn`, click **August 2026** in By month → `/app/finance/month/2026-08` shows
   "Out", "In", "Net" KPIs, a Categories list, and Transactions.
2. Find `MOCK Hardware Supplier` → it is at or near the top of Transactions.
3. Click **← Burn** (back button) → returns to the Burn page.

##### Edge Cases
- `/app/finance/month/2026-8` (no leading zero) → "Not found" page.

---

#### STORY-FIN-006: "When do we run out of money?"

**Type**: short
**Topic**: Runway
**Persona**: Naive first-time founder
**Goal**: Know the runway in months and the date.
**Preconditions**: NW-BASE.
**Ideal path**: 1 — read the Runway card.
**Alternate paths**: Runway page (`FinanceBurn.tsx:228`); Finance agent overview card
(`FinanceCards.tsx:122`).

##### Steps
1. Read **Runway** on the dashboard → for example "7.9 mo" and "Until May 2027".
2. Click it → `/app/finance/runway` shows Cash, Monthly burn, Runway, Run-out (a full date), a
   "Projected cash" line (solid for history, then projected), and a list: "Burn — 3-mo avg",
   "Revenue — Excluded", "Financing — Excluded", "Treasury yield — Excluded", "Card balance owed —
   Not counted".
   - Hesitation: "Revenue — Excluded" alarms a founder with revenue. The page does not explain
     that runway assumes zero revenue.

##### Edge Cases
- Brex-only company → Cash and Runway cards are hidden on the dashboard, with no message why.

---

### Stories: Spend, categories, vendors

#### STORY-FIN-007: See everything we spent this quarter

**Type**: medium
**Topic**: Spend
**Persona**: Naive first-time founder
**Goal**: "Show me every expense this quarter."
**Preconditions**: NW-BASE.
**Ideal path**: 2 — open Spend, choose Quarter.
**Alternate paths**: dashboard "Spend this month" KPI; the large total next to the period tabs
(`Finance.tsx:466-471`); the "N transactions" header of a chat transactions card
(`FinanceCards.tsx:179-183`).

##### Steps
1. On the dashboard choose **Quarter** in the period tabs → the total and "Spent <range> · +x%
   vs <range>" update. The Burn chart switches to weekly bars.
   - Hesitation: the Breakdown card below still says "Last 90 days" and does not change with the
     tabs; Upcoming and Subscriptions also do not change.
2. Click the bold quarter total → `/app/finance/spend?period=quarter` shows the period tabs, the
   total, chips "All", then one chip per category, and the transaction table (Date,
   Counterparty, Category, Amount, Status).
3. Click the **Software** chip → the URL gets `&cat=software` and the list narrows.
4. Look for a search box or an export button → none exists.

##### Variations
- From the dashboard Burn chart, click one day bar → `/app/finance/spend?period=month&from=…&to=…`
  shows that day only.
- On that day view, click **Week** → the day range is dropped without notice.

##### Edge Cases
- A category with no transactions in the period → the table shows only headers, with no "No
  transactions" message.

---

#### STORY-FIN-008: "What are we spending the most on?"

**Type**: medium
**Topic**: Breakdown
**Persona**: Naive first-time founder
**Goal**: Find the biggest category and the vendors inside it.
**Preconditions**: NW-BASE.
**Ideal path**: 2 — read Breakdown, click the top category.
**Alternate paths**: Burn page "Where it went" (`FinanceBurn.tsx:80-100`); month page Categories;
chat breakdown card (`FinanceCards.tsx:139-175`).

##### Steps
1. On the dashboard read **Breakdown** with **Category** selected → rows with bars, Payroll at
   the top.
2. Click **Show all 9** → all categories show. Click **Show less** → it collapses.
3. Click **Software** → `/app/finance/category/software` shows "Last 90 days" total, a small
   trend line with no axis, a Vendors list, and Recent transactions.
4. Check the breadcrumb → "Finance / Breakdown / Software". Click **← Breakdown** → it goes to the
   dashboard top, not to the Breakdown card.

---

#### STORY-FIN-009: Look at one vendor's history

**Type**: short
**Topic**: Vendor
**Persona**: Naive first-time founder
**Goal**: "Has AWS been going up?"
**Preconditions**: NW-BASE with 6+ months of `MOCK AWS` charges rising.
**Ideal path**: 2 — Breakdown → Vendor → MOCK AWS.
**Alternate paths**: Subscriptions table row (`Finance.tsx:724`); category page Vendors list;
transaction page "Merchant ›" link; recurring page "Vendor ›" link; chat vendor breakdown card.

##### Steps
1. In Breakdown, click **Vendor**, then **MOCK AWS** → `/app/finance/vendor/<key>` shows "Monthly
   avg (6 mo)", "Change (vs 3 mo ago)" in red when up, "First seen", "Paid with", a Monthly
   spend bar chart and a Charges table with a Receipt column.
2. Read the breadcrumb → "Finance / Subscriptions / MOCK AWS" (because AWS is a subscription).

---

### Stories: Subscriptions and upcoming

#### STORY-FIN-010: Find subscriptions to cancel

**Type**: medium
**Topic**: Subscriptions
**Persona**: Naive first-time founder
**Goal**: "What SaaS are we paying for, and is anything redundant?"
**Preconditions**: NW-BASE including two subscriptions in the same overlap group.
**Ideal path**: 1 — read the Subscriptions table.
**Alternate paths**: chat subscriptions card (`FinanceCards.tsx:205-232`), whose rows open the
recurring page instead of the vendor page.

##### Steps
1. Scroll to **Subscriptions** → a table with Vendor, Monthly, "3 mo" sparkline, Last charge, and
   a footer "5 subscriptions · $X/mo".
2. Notice the **overlaps** pill on two rows.
   - Hesitation: the pill does not say what the row overlaps with.
3. Hover a row → a tooltip pill shows "Brex ••0001" (paid with).
4. Click a row → the vendor page opens.
5. Look for a Cancel or "mark as not a subscription" control → none exists. The founder must ask
   the agent or go to the vendor.

---

#### STORY-FIN-011: What bills are coming in the next 30 days?

**Type**: short
**Topic**: Upcoming
**Persona**: Naive first-time founder
**Goal**: Plan cash for the next month.
**Preconditions**: NW-BASE with recurring, pending and bill items in the next 30 days.
**Ideal path**: 1 — read Upcoming.
**Alternate paths**: none found.

##### Steps
1. Read **Upcoming · 30 days** → a total "~$X", then rows of date(s), name, a tag
   (`recurring`, `pending` or `bill`), and amount. Weekly items show "×4".
2. Click a `recurring` row → `/app/finance/recurring/<key>` shows Cadence, Next, Expected, Vendor
   ›, and Past charges.
3. Click a `pending` row → the transaction page opens.
4. Try to click a `bill` row → nothing happens and no chevron shows.
   - Hesitation: bills are not clickable, with no hint why.

---

### Stories: Transactions and receipts

#### STORY-FIN-012: Check one charge and find its receipt

**Type**: medium
**Topic**: Transactions
**Persona**: Naive first-time founder
**Goal**: "My accountant asks for the receipt for the Figma charge."
**Preconditions**: NW-BASE: a Brex `MOCK Figma` charge with `hasReceipt` and an image receipt.
**Ideal path**: 3 — find the charge, open it, open the receipt.
**Alternate paths**: vendor page Charges table (receipt icon column); Spend page; month page;
category Recent; account detail; chat transactions card rows.

##### Steps
1. Open **Breakdown → Vendor → MOCK Figma** → the Charges table shows a receipt icon on the row.
2. Click the row → the transaction page title is the date (for example "September 12, 2026"); the
   amount is large; the merchant shows in small text.
   - Hesitation: the page title is a date, not "MOCK Figma".
3. Read the details → Merchant ›, Date posted, Status, Source "MOCK Brex Card ••0001",
   Cardholder, Category ›, Memo, and **Open in Brex**.
4. Click the receipt thumbnail → `/app/finance/receipt/<id>` shows the image and **Open receipt**.

##### Variations
- Wanting to change the category → no control exists.

---

#### STORY-FIN-013: A Mercury charge with no known receipt

**Type**: short
**Topic**: Receipts
**Persona**: Naive first-time founder
**Goal**: Find out if a receipt exists.
**Preconditions**: NW-BASE: a Mercury spend transaction, one with an attachment upstream and one
without.
**Ideal path**: 2 — open the transaction, click Check for receipt.
**Alternate paths**: none found.

##### Steps
1. Open the Mercury transaction → the Receipt section shows **Check for receipt**.
2. Click it → the button is disabled while checking, then a thumbnail shows (found) or "No
   receipt" (not found).

##### Edge Cases
- The check fails for a reason other than "not found" → the button comes back with no error text.

---

### Stories: Accounts

#### STORY-FIN-014: Look at one account and the card balance

**Type**: medium
**Topic**: Accounts
**Persona**: Naive first-time founder
**Goal**: "How much do we owe on the Brex card, and how much does Treasury earn?"
**Preconditions**: NW-BASE.
**Ideal path**: 2 — open Accounts, click the account.
**Alternate paths**: dashboard "Treasury yield" card links to Accounts; source chip "Mercury"
opens `/app/finance/accounts?source=mercury`; Burn page "By account" rows.

##### Steps
1. Click **Accounts** (top right on the dashboard) → Total cash, Card balance owed, Total balance
   chart with period tabs, Cash accounts with "••last four" and "4.1% yield" pill, and "Card
   balance owed" list.
2. Click **MOCK Treasury ••7730** → Balance, Yield, a Balance chart, a Yield table (Month,
   Dividends, Fee, Net), and Transactions.
   - Hesitation: Transactions shows only the newest 20 with no "See more".
3. Click **← Accounts**, then the **Mercury** chip on the dashboard → the Accounts page with a
   "Mercury ×" badge. Click the badge → the filter clears.

---

### Stories: Crypto

#### STORY-FIN-015: Should crypto count as cash?

**Type**: short
**Topic**: Crypto and runway
**Persona**: Naive first-time founder with a treasury Safe
**Goal**: "Count our USDC in runway, but not ETH."
**Preconditions**: NW-CRYPTO.
**Ideal path**: 2 — open the runway control, choose Stablecoins only.
**Alternate paths**: same control on Accounts (`FinanceAccounts.tsx:249-259`) and Runway
(`FinanceBurn.tsx:261-265`).

##### Steps
1. On **Runway**, click **Count crypto** → it saves "all crypto" at once. The label changes to
   "Counting all crypto ▾".
   - Hesitation: one click immediately counts volatile tokens; there is no choice first.
2. Open the menu and choose **Stablecoins only** → runway and Cash reload; a Cash list shows Bank,
   Stablecoins, Other crypto.
3. Return to the dashboard → the Cash subtitle shows "Checking + Treasury + Stablecoins" and a
   new "Crypto" KPI shows. Hovering Runway shows "Bank only: 7.9 mo".

---

#### STORY-FIN-016: Add, rename and remove a wallet and an exchange

**Type**: medium
**Topic**: Crypto
**Persona**: Naive first-time founder
**Goal**: Track the company Safe and the Kraken account, and remove an old wallet.
**Preconditions**: NW-CRYPTO. A Kraken stub that accepts a mock key.
**Ideal path**: 4 — Add wallet, paste address, Add; Remove via menu.
**Alternate paths**: Add account dialog → Wallet or Coinbase/Kraken; Integrations tiles for
Kraken/Coinbase "Connect" and Blockscout/Alchemy.

##### Steps
1. Open **Crypto** (the Crypto KPI) → "Updated …", Wallets total, rows with type and "2 of 3",
   a Coinbase section, "Balance over time", Chains, Holdings.
2. Click **Add wallet** → enter `mock-ops2.eth`, label "MOCK Ops 2", type Personal → **Add**.
3. Use the "…" menu → **Edit** → change the label → **Save**.
4. "…" → **Remove** → "Remove MOCK Ops 2?" → **Remove**.
5. Go to **Accounts → Add account → Kraken** → enter API key and Private key → **Connect** →
   Kraken shows under Crypto.

##### Edge Cases
- Add the same address twice → "That wallet is already added".
- Unknown ENS → "That ENS name was not found".
- Blockscout key missing → a lone **Connect** button shows at the top of Crypto with no object.
- Integrations shows Blockscout and Alchemy with the same description "Read wallet balances".

---

### Stories: Statements

#### STORY-FIN-017: Upload this month's statement when reminded

**Type**: short
**Topic**: Statements
**Persona**: Naive first-time founder whose second bank has no integration
**Goal**: Keep a non-integrated bank current.
**Preconditions**: NW-STATEMENT; file `mock-firstbank-2026-09.csv`.
**Ideal path**: 2 — click Upload, drop the file.
**Alternate paths**: Add account → Upload statements.

##### Steps
1. See the banner "Upload the September statement for MOCK First Mock Bank ••5502" → click
   **Upload**.
2. Drop the CSV → "Reading…" then a group with period, "opening → closing", "N transactions",
   "Transactions add up to the closing balance", and "Imported".
3. Click **Done** → the banner goes away and totals change.

---

#### STORY-FIN-018: Upload the wrong files

**Type**: medium
**Topic**: Statements
**Persona**: Naive first-time founder
**Goal**: Upload whatever is in the downloads folder.
**Preconditions**: NW-STATEMENT; files `notes.docx`, an oversized PDF, and
`mock-firstbank-2026-08.pdf` with a $12.40 mismatch.
**Ideal path**: 2 — open upload, drop files.
**Alternate paths**: none found.

##### Steps
1. Drop all three → `notes.docx` shows "Upload a PDF, CSV, OFX or QFX file" with **Dismiss**; the
   large file shows "The file is too large".
2. The mismatched PDF is imported straight away and then shows "Transactions are $12.40 off the
   closing balance" in red, plus a bold "Read by an AI model…" warning.
   - Hesitation: it is already imported. The founder expected a review step before accepting
     numbers that do not add up.
3. Click **Remove** on it → it disappears and totals revert.
4. Close the dialog and reopen it → the earlier imports are not listed; there is nowhere to see
   or remove past statements.

---

### Stories: Errors and wrong links

#### STORY-FIN-023: Follow a broken or old link

**Type**: short
**Topic**: Errors
**Persona**: Naive first-time founder
**Goal**: Open a link a teammate pasted.
**Preconditions**: NW-BASE.
**Ideal path**: 1.
**Alternate paths**: none found.

##### Steps
1. Open `/app/finance/transaction/does-not-exist` → a red error with a retry control (not "Not
   found").
2. Open `/app/finance/budget` → "Not found" page with a "← Finance" button.
3. Open `/app/finance/accounts?source=chase` → the full Accounts list with no hint the filter was
   ignored.

---

### Stories: Long end-to-end stories

#### STORY-FIN-019: First morning with Finance

**Type**: long
**Topic**: End to end
**Persona**: Naive first-time founder
**Goal**: Connect both banks and understand cash, burn, runway and the biggest costs before a board
call.
**Preconditions**: NW-EMPTY, Mercury and Brex OAuth stubs that load NW-BASE data.
**Ideal path**: 8 — Finance, Add account, Mercury, approve, Add Brex, approve, read KPIs, open
Breakdown top row.
**Alternate paths**: connect both from Integrations.

##### Steps
1. Click **Finance** → empty state.
2. **Add account → Mercury** → approve → dashboard syncs.
3. Click **Add Brex** in the header → lands on Integrations, not a dialog.
   - Hesitation: the founder thinks they left Finance.
4. Click **Connect** on Brex → approve → tile shows **Open Finance**.
5. Click **Open Finance** → Brex chip shows; "Add Brex" is gone.
6. Read Cash, Monthly burn, Runway, Spend this month.
7. Click **Runway** → read Run-out and the excluded list.
8. Click **← Finance** → Breakdown → **Payroll** → category page.
9. Click a vendor → vendor page → click one charge → transaction page.
10. Use breadcrumbs to go back to Finance.
11. Open **Burn → By month** and compare the last three months.
12. Click **Accounts** → confirm "Card balance owed — Not counted in cash".
13. Return and click **Refresh** to see "Updated just now".
14. Click **Ask agent** → the panel opens and says it is creating the Finance agent ("Create
    Finance agent" label while creating).
15. Type "Summarize cash, burn and runway for my board call" → finance cards show in the chat.
16. Compare the chat card's Runway ("8 mo", rounded) with the dashboard ("7.9 mo").
    - Hesitation: the two numbers look different.

---

#### STORY-FIN-020: Write an investor update that includes crypto

**Type**: long
**Topic**: End to end with crypto
**Persona**: Naive first-time founder
**Goal**: Report cash with and without stablecoins and the biggest cost changes.
**Preconditions**: NW-CRYPTO with Finance agent created.
**Ideal path**: 6.
**Alternate paths**: answer only from the agent.

##### Steps
1. Open Finance → Crypto KPI shows; hover Cash for Bank / Stablecoins / Other crypto / Total.
2. Open **Crypto** → check Holdings; an unpriced token shows "—" and "1 unpriced".
3. Open **Runway → Count crypto → Stablecoins only**.
4. Back on the dashboard, hover Runway → "Bank only: X mo".
5. Open **Breakdown → Vendor**; note vendors with red Change.
6. Open the vendor pages for the top 2 risers.
7. Click **Ask agent** → "Draft an investor update: cash bank-only and with stablecoins, runway,
   top 3 cost increases."
8. Hover a finance card → click **Ask about this** → the composer quotes that message; ask a
   follow-up.
9. Click a card row → the matching Finance page opens.
10. Ask the agent to "Move $50k from checking to treasury" → it replies it cannot move money.
11. Turn counting back off with **Don't count crypto**.

---

#### STORY-FIN-021: Track a bank that has no integration

**Type**: long
**Topic**: End to end with statements
**Persona**: Naive first-time founder
**Goal**: Get a second bank into totals and keep it current.
**Preconditions**: NW-EMPTY plus statement files for 3 months of `MOCK First Mock Bank`.
**Ideal path**: 4.
**Alternate paths**: none found.

##### Steps
1. Finance → **Add account → Upload statements**.
2. Drop 3 monthly files → one group "MOCK First Mock Bank ••5502" with a "New account" badge and
   three rows.
3. Click **Done** → the dashboard now shows KPIs (statement accounts count as data).
4. Open **Accounts** → the statement account is listed.
5. Open it → balance chart and transactions show. There is no Yield table.
6. Next month, see the reminder banner → **Upload**.
7. Try to delete the account → no control exists.
8. Ask the agent "Which statements have I uploaded?".

---

#### STORY-FIN-022: Monthly review with the agent, pins and a reconnect

**Type**: long
**Topic**: Agent, pins, reconnect
**Persona**: Naive first-time founder
**Goal**: Run the month-end close checklist and fix a broken bank link.
**Preconditions**: NW-RECONNECT + NW-AGENT.
**Ideal path**: 6.
**Alternate paths**: open "Finance agent" from the sidebar bot list (not filtered out, see
Suspected problems).

##### Steps
1. Open Finance → the Mercury chip has a yellow dot. Click it → Integrations.
   - Hesitation: the chip has no "Reconnect" text, only an aria-label.
2. On the Mercury tile ("Reconnect" badge) click **Reconnect** → approve.
3. Click **Open Finance** → green dot.
4. Click **Ask agent** → the panel shows the thread with "3 finance lookups" collapsed. Expand it.
5. Look for the "Month-end close" checklist and the Cash/Runway pins → they are not shown in the
   Finance side panel.
6. Find **Finance agent** in the sidebar bot list → open it → the pins strip and List button show.
7. Tick "Reconcile Brex" on the checklist.
8. Ask the agent to "update the Runway pin" → click the pin refresh.
9. Return to Finance → the panel is closed again (it starts closed every visit).

---

## Area: Legal (STORY-LEG-nnn)

Source: `docs/ux-paths/legal/catalog.md`.


Generated: 2026-10-16
Total Stories: 20 (Short 8, Medium 8, Long 4)
Persona for every story: a first-time startup founder ("Alex", MOCK DEMO DATA — Northwind Robotics). Alex has never seen Rakazo, does not know words like "agent", "scan", "consent", "Data room", "node" or "Muse Spark", and wants one thing: run the company without missing a contract date.

### Read this first: where the Legal code is

- **The Legal feature is not on `docs/ux-pass` / `origin/main` (458a69e4).** `git ls-files | grep -i legal` on this branch returns nothing; there is no `/app/legal` route and no Legal sidebar item. The code exists only on `origin/feat/legal` (488048d5, not merged into main) and on the local branch `local/legal-integration` (d0dcfbf1, feat/legal merged into a local main for testing).
- Every file:line below is from `feat/legal` at 488048d5, read with `git show` / the clean files in `/Users/dennison/develop/rakazo-legal` (that worktree has an unrelated half-finished merge in other files; the Legal files match HEAD).
- **The walk can only run these stories against a build that contains feat/legal** (for example `local/legal-integration`). A demo account built from `origin/main` has no Legal page at all; in that case every story below fails at step 1, and that is the finding.
- I re-checked the prior catalog (`/Users/dennison/develop/rakazo-legal/docs/ux-paths/legal/catalog.md`, 39 stories, problems P-01 to P-30). Every line number I spot-checked still matches (Legal.tsx, LegalDeadlines.tsx, LegalContracts.tsx, LegalGraph.tsx, legal-tools.ts:340-385, db/legal.ts:1-20,85-100,155-165, api/legal.ts, legal-agent.ts). This catalog reuses those findings by ID and does not repeat their full evidence. "Prior STORY-nnn" points to the old story a new one replaces or extends.
- Nothing here was run in a browser. All expected results are read from code.

### What the mock demo account contains (from the seed), and what it lacks

Seed source: `/Users/dennison/develop/rakazo-demo/packages/testkit/src/cli/demo/data.ts` and `demo/seed.ts` (untracked files on `feat/mock-demo-env`; they moved from `packages/testkit/src/demo/` while I was reading).

Seeded and relevant to Legal:
- Data room folder **Legal** with four PDFs: `MOCK Master Services Agreement - Halcyon Logistics.pdf` (term 24 months, liability cap 1x fees, termination for convenience on 60 days notice), `MOCK Mutual NDA - Acme Ventures.pdf` (term 3 years), `MOCK Office Lease - 100 Placeholder Street.pdf` (rent 7500 dollars a month, "Renewal date 31 January. Notice of renewal due 30 November."), `MOCK SAFE - Quill Capital.pdf` (250000 dollars, cap 8000000, discount 20 percent). Folders **Finance**, **Fundraising**, **Product** hold five non-legal files (board deck, budget CSV, investor update, cap table CSV, roadmap). Data: `data.ts:499-546`.
- Gmail emulator mail that is legal in nature: "Redlines on the Master Services Agreement" (two messages), "Legal notice: trademark office action response due in 30 days", "Office lease renewal option" ("renews on Jan 31 … tell us by Nov 30"). `data.ts:53-129`.
- An ordinary bot **Legal Desk (mock)**, title "Contracts", description "tracks the demo contracts and their renewal dates" (`data.ts:549-554`), placed in the group chat "Leadership sync (mock)".
- A model key only if the person who starts the demo has `OPENROUTER_API_KEY` or `ANTHROPIC_API_KEY` in their environment (`demo.ts:37,77-87`). Without one, the runtime is "scripted (no model key found)" (`demo.ts:269`).

Not seeded (must be produced by a real scan or added for the walk):
- No `legal_contracts`, `legal_deadlines`, `legal_nodes` or `legal_edges` rows. The Legal page starts empty.
- No Legal agent bot. It is created the first time `/app/legal` loads (`apps/api/src/legal.ts:34`).
- No Legal consent row.

Named demo-data states used in the Preconditions below:
- **D0 (fresh)**: the seed as it is, on a build that includes feat/legal, started with `OPENROUTER_API_KEY` in the environment (so the Legal agent's model, `openrouter / meta/muse-spark-1.2`, resolves).
- **D0-nokey**: D0 but started with no model key, or only `ANTHROPIC_API_KEY`.
- **D1 (scanned)**: D0 after one successful Scan now. Expected from the seed, if the model follows its instructions: 4 contracts (MSA, NDA, Lease, SAFE) and 5 Data room files recorded as not legal. Hypothesis, not observed: few or no deadlines, because the seed documents state no effective dates or years (see Suspected problem S-02).
- **D2 (seeded legal rows)**: D1 plus rows inserted directly for the walk, so date behaviour can be tested without depending on the model. Proposed rows (all MOCK DEMO DATA): Lease contract active, expires 2027-01-31, `autoRenews` true, `renewalNoticeDays` 62 → derived "Renews 2027-01-31" and "Renewal notice deadline 2026-11-30"; MSA active, effective 2026-03-01, expires 2028-02-29, value 12000000 cents USD; NDA active, expires 2029-06-30, `autoRenews` false; SAFE status unknown, no dates; one manual deadline "Trademark office action response" due 2026-11-14 (from the mail); one overdue deadline "Q3 board consent signature" due 2026-10-10. Graph: nodes for Northwind Robotics Mock (company), Halcyon Logistics Mock, Acme Ventures Mock, Landlord Placeholder LLC Mock, Quill Capital Mock (company), the four contracts, and "Delaware" (jurisdiction); edges `party_to`, `governed_by`, `owes` with short source quotes.

### Summary

| Type | Count | Stories |
|---|---|---|
| Short | 8 | 004, 006, 009, 011, 012, 014, 016, STORY-LEG-019 |
| Medium | 8 | 002, 003, 005, 008, 010, 013, 015, STORY-LEG-018 |
| Long | 4 | 001, 007, 017, STORY-LEG-020 |

### Coverage Matrix

| Feature area | Stories | Gaps |
|---|---|---|
| Find Legal in the sidebar, page chrome | 001, STORY-LEG-002 | none |
| Model requirement (OpenRouter key, Muse Spark 1.2), Settings it depends on | 002, 003, STORY-LEG-020 | exact Settings > Models wording not read (prior gap, still open) |
| Consent card (Allow) | 001, STORY-LEG-004 | no review or revoke exists (C-8) |
| Scan now, daily scan, Last scan | 001, 005, 006, STORY-LEG-017 | concurrent routine + manual scan unverified |
| KPI tiles | 001, 007, STORY-LEG-009 | none |
| Contracts tab | 007, 008, STORY-LEG-010 | narrow-screen layout |
| Deadlines tab: read, Done, Dismiss | 011, 012, 013, STORY-LEG-017 | no reopen (P-10) |
| Derived and recurring deadlines | 013, STORY-LEG-017 | none |
| Documents marked not legal | STORY-LEG-010 | no user control exists (S-06) |
| Graph tab | 014, STORY-LEG-015 | none |
| Legal agent chat panel | 016, 018, STORY-LEG-019 | mobile width |
| Mail and Drive findings | STORY-LEG-018 | Drive not seeded |
| Data room link-through | 008, STORY-LEG-011 | none |
| Legal agent vs other bots ("Legal Desk (mock)") | STORY-LEG-019 | none |
| Feature missing from the build | STORY-LEG-020 | none |

### Story Dependency Graph

```text
STORY-LEG-020 (Legal tab missing from the build)  [run first; if it fails, stop]
STORY-LEG-001 (First week: find Legal, set up, first scan, check dates)  [D0]
├── STORY-LEG-002 (Warning about a key, no key)  [D0-nokey]
│   └── STORY-LEG-003 (Add the key, come back)
├── STORY-LEG-004 (Allow card)
├── STORY-LEG-005 (First Scan now, watching for a result)
│   ├── STORY-LEG-006 (Last scan stays old)
│   ├── STORY-LEG-009 (What "Unreviewed documents" means)
│   ├── STORY-LEG-010 (Where did the board deck go? not-legal files)
│   └── STORY-LEG-018 (Contracts found only in email)
├── STORY-LEG-007 (Monday morning legal check)  [D2]
│   ├── STORY-LEG-008 (Open the lease from the table and come back)
│   ├── STORY-LEG-011 (What is due soon?)
│   ├── STORY-LEG-012 (Done vs Dismiss, clicked the wrong one)
│   ├── STORY-LEG-013 (Lease renewed, dates move)
│   ├── STORY-LEG-014 (Who are we signed with? Graph)
│   │   └── STORY-LEG-015 (Big graph, cannot find a party)
│   └── STORY-LEG-016 (Ask the agent "what do we owe this month")
├── STORY-LEG-017 (A quarter of running the company on Legal)  [D2, long]
└── STORY-LEG-019 (Two legal bots: Legal Desk (mock) vs Legal agent)
```

---


### Stories: Setup and first run

#### STORY-LEG-001: First week as a founder: find the legal stuff, set it up, see my dates

**Type**: long
**Topic**: First-time setup, end to end
**Persona**: Alex, founder of Northwind Robotics, first login, has heard "Rakazo keeps track of contracts"
**Goal**: See every contract the company has signed and the next date Alex must act on, without reading legal PDFs
**Preconditions**: D0. Build includes feat/legal. Signed in as the seeded demo user. Four legal PDFs in Data room > Legal are indexed (status `ready`). No Legal agent, no consent row, no legal rows.
**Ideal path**: 3 (open Legal, allow reading documents, read the list once results appear; scanning should start by itself)
**Alternate paths**: open the "Legal Desk (mock)" bot in the sidebar roster and ask it (a different, ordinary bot with no legal tools; see STORY-LEG-019); ask Chief in chat; open Data room > Legal and read each PDF.
**Source**: extends prior STORY-001, 003, 009, 010, 016

##### Steps
1. Alex scans the sidebar for "contracts" → sees Inbox, Finance, **Legal** (scale icon), Data room, Cap Table (`Shell.tsx:3376-3384`). Clicks Legal → URL `/app/legal`; skeleton, then the page. Visiting creates the Legal agent and its daily routine silently (`api/legal.ts:34`, `legal-agent.ts:65-100`).
2. Alex reads the header: "Legal", small grey "Not scanned yet", buttons **Scan now** and **Ask agent** (`Legal.tsx:64-80`). Thinks: "Ask which agent? Is that a person?" (Hesitation: the button does not say "Legal".)
3. Alex sees a warning-bordered card "Let the Legal agent read your documents", a disclosure paragraph, a list of recipients (for example "OpenRouter · …"), and **Allow** (`ConsentPrompt.tsx:39-70`). Hesitation: "Who is OpenRouter? Is my data leaving the company?" There is no Cancel or "Learn more".
4. Alex clicks Allow → card disappears, no confirmation text (P-14).
5. Alex sees five tiles: Contracts 0, Active 0, Open deadlines 0, Overdue 0, Unreviewed documents 9 (`Legal.tsx:98-104`). Thinks: "9? I uploaded 4 contracts." (The count is all ready Data room files, not only legal ones; S-07.)
6. Alex reads the centre text "The Legal agent scans your Data room for contracts and deadlines." and clicks the centre **Scan now** (`Legal.tsx:105-113`) → the header button changes to "Scanning…" for about a second, the centre button does not (P-24). A side panel opens with the Legal agent's chat (`Legal.tsx:48`).
7. Alex watches the panel; the agent's reply arrives after some time. The page behind still shows zeros and "Not scanned yet" (no polling, P-09).
8. Alex, unsure, clicks the sidebar Legal again or refreshes → tiles update: Contracts 4 (expected), Unreviewed 0, "Last scan just now".
9. Alex opens the **Contracts** tab (default) → table with Contract, Parties, Status, Term, Renewal, Value, Next deadline (`LegalContracts.tsx:38-60`). Expected: four rows. Many dashes (S-02, P-22).
10. Alex looks for the lease notice date (Nov 30, which Alex half-remembers from an email) → clicks **Deadlines** tab. Expected with the seed: possibly "No open deadlines." (S-02). Thinks: "So I have nothing due? That can't be right."
11. Alex goes back to the panel and types "When do I have to tell the landlord about the lease?" → the agent answers from `legal_query` or by reading the PDF. Whether it records a deadline now depends on the model.
12. Alex closes the panel with its collapse control ("Collapse Legal agent", `Shell.tsx:2649`) → **Ask agent** returns in the header.

##### Variations
- D0-nokey: step 3 shows no card, both Scan now buttons are disabled with no reason given (P-08); see STORY-LEG-002.
- Only `ANTHROPIC_API_KEY`: the card asks to allow Anthropic; the scan then fails with "runs only on Muse Spark 1.2" (P-13).
- Data room files still processing: Unreviewed counts only `ready` files (`db/legal.ts:94`), so the tile reads lower than the number Alex uploaded.

##### Edge Cases
- Alex clicks Scan now twice quickly → one run (per-bot lock, `api/legal.ts:129-139`); the second click shows nothing different.
- Alex leaves the page while scanning → the panel closes (`Shell.tsx:905-907`); the run keeps going.

#### STORY-LEG-002: "It says I need an OpenRouter key. What is that?"

**Type**: medium
**Topic**: Model requirement
**Persona**: Alex, no AI accounts of their own
**Goal**: Make the Legal page work
**Preconditions**: D0-nokey (no model key in the demo environment, or only `ANTHROPIC_API_KEY`). No legal rows.
**Ideal path**: 2 (click a link in the warning that opens the right Settings screen, paste a key)
**Alternate paths**: open Settings from the sidebar menu and find Models; ask the agent (it replies with `LEGAL_MODEL_REQUIRED_MESSAGE`, `contracts/legal.ts:21-22`).
**Source**: prior STORY-001, 005, 038

##### Steps
1. Open `/app/legal` → small grey line: "The Legal agent cannot run until you add an OpenRouter key in Settings. It runs only on Muse Spark 1.2." (`Legal.tsx:82-88`). Hesitation: three unknown terms (OpenRouter, key, Muse Spark 1.2), no link.
2. Alex looks for a button in the line → none. Looks at Scan now → greyed out with no tooltip when no model resolves (P-08), or still clickable when the model resolves to something else (P-12).
3. Alex clicks Ask agent → panel opens; Alex types "how do I set you up?" → the run fails before any model call and the bot posts "The Legal agent runs only on Muse Spark 1.2. Add an OpenRouter key in Settings." (`executor.ts:3850-3858` per prior catalog).
4. Alex searches the app for "Settings" → finds it in the account menu (exact path not read in this pass).
5. Alex gives up or proceeds to STORY-LEG-003.

##### Variations
- Only Anthropic key: Scan now enabled, consent card asks to allow Anthropic, the scan fails (P-13).

##### Edge Cases
- The warning also shows when the model is merely unresolved (`!data.model?.isPreferred` is true for `null`, `Legal.tsx:82`).

#### STORY-LEG-003: Add the key in Settings and come back

**Type**: medium
**Topic**: Settings dependency
**Persona**: Alex, followed a teammate's advice to "just add an OpenRouter key"
**Goal**: See the warning go away and run the first scan
**Preconditions**: D0-nokey; a valid OpenRouter key available to paste (the walk may use a test key; never print it).
**Ideal path**: 3 (open Settings from the warning, paste the key, return; the page updates by itself)
**Alternate paths**: none found that sets the model from the Legal page.
**Source**: prior STORY-002

##### Steps
1. From `/app/legal`, open Settings > Models (overlay on the same page), choose OpenRouter, paste the key, save.
2. Close Settings → the Legal page still shows the old warning and greyed Scan now (queries load once, `Legal.tsx:34,36`; P-11). Thinks: "It didn't save."
3. Alex re-pastes the key, closes again → same.
4. Alex clicks the sidebar Legal or reloads the browser → warning gone; the Allow card appears (STORY-LEG-004).

##### Variations
- Key added while the Legal agent bot already has a different model chosen by the user: warning stays (`legal-agent.ts:84-99` fills the model only when empty; P-21).

##### Edge Cases
- Bad key: not traced in this pass.

#### STORY-LEG-004: The "Let the Legal agent read your documents" card

**Type**: short
**Topic**: Consent
**Persona**: Alex, careful about investor data in the Data room
**Goal**: Understand what is being shared before clicking Allow
**Preconditions**: D0 with the model resolved; no Legal consent row.
**Ideal path**: 1 (read and click Allow)
**Alternate paths**: the Data room's own AI data sharing control (`AiDataSharing.tsx`, "Allow OpenRouter" switch) covers the space default model, a separate consent (S-05).
**Source**: prior STORY-003, 004

##### Steps
1. Read the card heading, disclosure paragraph, and the recipients list (`ConsentPrompt.tsx:46-59`). Hesitation: "Does this include my cap table and board deck?" The card does not say which folders.
2. Look for "Not now" → none. Only **Allow**.
3. Click Allow → card vanishes; no message. Scan now is enabled.

##### Variations
- Providers changed since the page loaded → Allow re-renders the card with no explanation (`ConsentPrompt.tsx:25-31`; P-14).

##### Edge Cases
- Alex later wants to take the permission back → no control on Legal (C-8).

#### STORY-LEG-005: First Scan now: "is it doing anything?"

**Type**: medium
**Topic**: Scanning
**Persona**: Alex, impatient, expects a progress bar
**Goal**: Know when the scan is finished and whether it worked
**Preconditions**: D0, consent granted, no previous scan.
**Ideal path**: 2 (click Scan now, see a "Scanning… 3 of 9" state that ends in a summary on the page)
**Alternate paths**: wait for the daily scan at 06:00 UTC (never mentioned on the page); ask the agent "scan my documents" in the panel.
**Source**: prior STORY-009, 036

##### Steps
1. Click header **Scan now** → "Scanning…" for about a second (only while the queueing request runs, `Legal.tsx:43-55`), panel opens.
2. Watch the page → no change. "Not scanned yet" stays.
3. Read the panel → the agent's reply lists deadlines due in 60 days first, then what it recorded (`LEGAL_SCAN_PROMPT`, `legal-agent.ts:12-13`).
4. Close the panel and click Scan now again "to make sure" → a second run starts if the first has finished; nothing tells Alex that this re-reads nothing (unreviewed list is empty).
5. Reload → numbers appear.

##### Variations
- Panel already open when clicking Scan now: `onAskAgent` is undefined, nothing visible happens except the one-second label (`Shell.tsx:4172`; P-09).
- Scan fails (model or consent): only the panel shows the failure; the page keeps "Not scanned yet".

##### Edge Cases
- Scan run while another is queued returns the existing run id, no message (`api/legal.ts:139,163`).

#### STORY-LEG-006: "Last scan 3 days ago": why not every day?

**Type**: short
**Topic**: Daily scan
**Persona**: Alex, returning after a long weekend
**Goal**: Trust that new documents are picked up without pressing anything
**Preconditions**: D1; the Daily legal scan routine paused, or its last three runs failed (set in the routine table for the walk).
**Ideal path**: 1 (the caption says "Daily scan paused" or "Last scan failed: reason")
**Alternate paths**: the routine is visible wherever the app lists routines for a bot (not traced in this pass).
**Source**: prior STORY-015, 035

##### Steps
1. Open Legal → "Last scan 3 days ago" (only completed routine-trigger runs count, `api/legal.ts:41-45`).
2. Look for "why" → nothing on the page mentions the daily schedule, 06:00 UTC, pause state or failures (P-21, C-9). No notification was sent (`notify: false`, `legal-agent.ts:50`).
3. Click Scan now → works, caption updates only after reload.

##### Edge Cases
- A routine run that completes with zero documents still updates Last scan; a chat-triggered analysis does not.

#### STORY-LEG-007: Monday morning legal check

**Type**: long
**Topic**: Routine use, all three tabs
**Persona**: Alex, now in week three, wants a five-minute "am I about to miss anything" check
**Goal**: Find anything due in the next month, handle what is already done, and confirm who the company is bound to
**Preconditions**: D2 (seeded legal rows incl. overdue "Q3 board consent signature" 2026-10-10, "Trademark office action response" 2026-11-14, "Renewal notice deadline" 2026-11-30, "Renews" 2027-01-31). Today = 2026-10-16 in the walk browser's time zone.
**Ideal path**: 4 (open Legal, see a "due soon" list on the first screen, mark one done, glance at the graph)
**Alternate paths**: ask the agent "what's due this month?" (STORY-LEG-016); Inbox shows the lease and trademark emails themselves.
**Source**: prior STORY-016, 017, 023, 024

##### Steps
1. Open Legal → tiles: Contracts 4, Active 3, Open deadlines 4, Overdue 1, Unreviewed 0.
2. Thinks "1 overdue, which one?" → clicks the Overdue tile → nothing; tiles are not links (`Legal.tsx:98-104`). Hesitation.
3. Clicks **Deadlines** tab → list soonest first: "Q3 board consent signature" with red pill "Overdue by 6 days", then the trademark response, the lease notice, "Renews" (`LegalDeadlines.tsx:55-117`).
4. Notices the lease notice row looks the same as "Renews" in January: no "in 45 days" text (P-16).
5. Reads the grey quote under the lease rows; the same clause appears under both "Renews" and "Renewal notice deadline" (P-04).
6. Clicks **Done** on the board consent → row disappears, no undo (P-10). Tiles update after the reload: Overdue 0.
7. Clicks **Contracts** tab → "Next deadline" for the lease shows "Nov 30" in short form while the Deadlines tab shows the full date (`LegalContracts.tsx:101-103` vs `LegalDeadlines.tsx:95`). Same fact, two formats.
8. Clicks **Graph** → diagram of companies, contracts and Delaware; clicks "Halcyon Logistics Mock" → "Halcyon Logistics Mock party_to Master Services Agreement" (raw relation key, P-20).
9. Satisfied, Alex closes the tab. Tab state is not remembered; next visit opens on Contracts again (`Legal.tsx:38`).

##### Variations
- Walk browser time zone east of UTC early in the morning: tile and pill can disagree (P-03).

##### Edge Cases
- Done fails (network): error appears above the list, not on the row (P-28).

### Stories: Contracts and documents

#### STORY-LEG-008: Open the lease from the table and come back

**Type**: medium
**Topic**: Data room link-through
**Persona**: Alex, wants to reread the renewal clause
**Goal**: Read the actual lease text and return to the same view
**Preconditions**: D2; lease contract linked to `MOCK Office Lease - 100 Placeholder Street.pdf`.
**Ideal path**: 2 (click the lease, read the clause highlighted, press Back to the same tab)
**Alternate paths**: the contract-title link on a Deadlines row (`LegalDeadlines.tsx:74-80`); Data room > Legal folder directly; graph node (no link, P-20).
**Source**: prior STORY-011

##### Steps
1. Contracts tab → click the lease title → `/app/data-room?item=<id>` opens the file preview (`LegalContracts.tsx:69-74`).
2. Look for the renewal sentence → whole document, no highlight.
3. Press browser Back → Legal opens on the Contracts tab (fine here), but if Alex came from Deadlines, it is Contracts again (P-18).

##### Variations
- File deleted from the Data room after the scan: the Data room opens with no message (`DataRoom.tsx:127-136` per prior; P-18).

#### STORY-LEG-009: What does "Unreviewed documents 9" mean?

**Type**: short
**Topic**: KPI tiles
**Persona**: Alex
**Goal**: Understand a number before trusting it
**Preconditions**: D0 after consent, before any scan.
**Ideal path**: 1 (a tooltip or link explaining it)
**Alternate paths**: none found.
**Source**: prior STORY-008

##### Steps
1. See "Unreviewed documents 9" → hover → no tooltip; click → nothing (`Legal.tsx:103`).
2. Compare with Data room > Legal holding 4 files → confusion: the count covers all ready Data room files, including board deck, budget and roadmap (`db/legal.ts:89-95`; S-07).
3. After the scan it reads 0.

#### STORY-LEG-010: "Where is my board deck? It's not in the list." (documents judged not legal)

**Type**: medium
**Topic**: Marking documents not legal
**Persona**: Alex, expected the SAFE and the cap table to show up together
**Goal**: Check which files Legal ignored and include one it skipped
**Preconditions**: D1; the five non-legal files are recorded as `not_legal`. For the variation, the SAFE is wrongly recorded as `not_legal` (inserted for the walk).
**Ideal path**: 2 (open a "Skipped (5)" list, click "Review again" on one)
**Alternate paths**: ask the agent in the panel to re-read the file (it can re-record with `legal_upsert_contract`; not verified that it does); rename the file in the Data room, which raises its revision and re-queues it (C-6).
**Source**: prior STORY-012

##### Steps
1. Contracts tab shows 4 rows. Alex counts 9 files in the Data room and wonders where the rest went.
2. Looks for a "not legal" or "skipped" list → none; `not_legal` rows are filtered out (`db/legal.ts:11-12,160`).
3. Variation: the SAFE is missing. Alex looks for "Add contract" or "Mark as legal" → none exists; contracts are written only by the agent (C-3).
4. Alex asks the agent "You missed the SAFE from Quill Capital" → outcome depends on the model.

##### Edge Cases
- Uploading a new version of a skipped file re-queues it (revision grows, `db/legal.ts:95`).

### Stories: Deadlines

#### STORY-LEG-011: "What is due soon?"

**Type**: short
**Topic**: Deadlines read
**Persona**: Alex
**Goal**: See the next 30 days at a glance
**Preconditions**: D2.
**Ideal path**: 1 (a "Due this month" list on load)
**Alternate paths**: ask the agent (the scan reply lists 60-day deadlines first, `legal-agent.ts:13`); Contracts tab "Next deadline" column.
**Source**: prior STORY-016

##### Steps
1. Open Legal → lands on Contracts, not Deadlines (`Legal.tsx:38`). Alex scans the Next deadline column.
2. Click Deadlines → full list; only overdue items are marked (P-16). Alex must read each date.

#### STORY-LEG-012: Done vs Dismiss, and clicking the wrong one

**Type**: short
**Topic**: Deadlines write
**Persona**: Alex, on a laptop trackpad
**Goal**: Mark the trademark response as handled by the lawyer, not as irrelevant
**Preconditions**: D2.
**Ideal path**: 1 (click Done; Undo is offered)
**Alternate paths**: ask the agent to reopen the deadline (server accepts `status: "open"`, nothing in the web sends it; P-10).
**Source**: prior STORY-019, 022

##### Steps
1. Alex reads two buttons: **Done** (outline) and **Dismiss** (ghost). Hesitation: "Dismiss like a notification? Or delete?" No hint text (`LegalDeadlines.tsx:98-115`).
2. Clicks Dismiss by mistake → row vanishes; no toast, no undo, no closed list.
3. Looks for it → gone from all tabs; open deadlines only (`api/legal.ts:37`).

#### STORY-LEG-013: The lease gets renewed: do the dates move?

**Type**: medium
**Topic**: Derived deadlines after a document change
**Persona**: Alex, signed the renewal and uploaded the amended lease
**Goal**: See the next renewal and notice dates for the new term
**Preconditions**: D2, with "Renewal notice deadline 2026-11-30" already marked Done. Then a new revision of the lease file stating expiry 2029-01-31 is uploaded to the Data room.
**Ideal path**: 2 (upload the new lease, see new dates after the automatic scan)
**Alternate paths**: tell the agent the new dates in chat.
**Source**: prior STORY-013

##### Steps
1. Upload the amended lease in Data room > Legal (replacing or new version).
2. Return to Legal → Unreviewed documents 1. Click Scan now.
3. After reload: Contracts row shows the new term; Deadlines shows "Renews 2029-01-31" but **no new "Renewal notice deadline"** because the closed row with the same kind and title blocks it (`legal-tools.ts:373-374`; P-01). Alex now has no reminder for the 2028 notice date.

##### Variations
- The notice row had been left open: it moves to the new date (same row id).

### Stories: Graph

#### STORY-LEG-014: "Who are we actually signed with?"

**Type**: short
**Topic**: Graph
**Persona**: Alex, prepping for a board meeting
**Goal**: List the companies Northwind has contracts with
**Preconditions**: D2 graph rows.
**Ideal path**: 1 (a list of counterparties)
**Alternate paths**: Contracts tab "Parties" column (same fact, simpler); ask the agent.
**Source**: prior STORY-025, 026

##### Steps
1. Click Graph → columns: companies left, contracts middle, terms right (`LegalGraph.tsx:10-12`). Hesitation: no legend sentence explains the columns.
2. Click "Quill Capital Mock" → heading plus "Quill Capital Mock party_to SAFE" with a quote.
3. Try clicking the SAFE to open it → no link (P-20).
4. Click again to deselect (only way, P-30).

##### Edge Cases
- Empty graph: "No relationships yet." with no next step (`LegalGraph.tsx:84-89`).

#### STORY-LEG-015: Big graph, cannot find a party

**Type**: medium
**Topic**: Graph cap
**Persona**: Alex, a year later, 60 contracts
**Goal**: Find one supplier on the graph
**Preconditions**: D2 plus at least 150 extra synthetic MOCK nodes and edges inserted for the walk.
**Ideal path**: 2 (type the name in a filter, select it)
**Alternate paths**: Contracts tab Parties column; ask the agent.
**Source**: prior STORY-028

##### Steps
1. Graph shows "Showing the 120 most connected of 160 items." (`LegalGraph.tsx:101-107`).
2. Look for search → none; Ctrl+F finds only drawn labels, cut at 27 characters (P-19, P-30).
3. Fall back to the Contracts table.

### Stories: Legal agent

#### STORY-LEG-016: Ask the agent "what do we owe this month?"

**Type**: short
**Topic**: Agent conversation
**Persona**: Alex
**Goal**: Get a plain answer about payments and obligations
**Preconditions**: D2; model resolved; consent granted.
**Ideal path**: 2 (open the panel, ask)
**Alternate paths**: Deadlines tab; Finance page for payments.
**Source**: prior STORY-033

##### Steps
1. Click **Ask agent** → panel with the Legal agent's thread.
2. Type the question → the agent uses `legal_query` and replies briefly; it says it is not a lawyer only if it chooses to (the "not a lawyer" line is only in its prompt, `legal-agent.ts:9`; P-27).
3. Alex asks "So should I sign the Halcyon redlines?" → the agent should decline legal advice; the page itself has no disclaimer.

#### STORY-LEG-017: A quarter of running the company on Legal

**Type**: long
**Topic**: End-to-end over time
**Persona**: Alex, now relying on Legal instead of a spreadsheet
**Goal**: Never miss the lease notice, the trademark response, or a recurring obligation over three months
**Preconditions**: D2 plus a recurring deadline "Annual Delaware franchise tax report" due 2027-03-01 recorded by the agent. The walk simulates time by moving the browser clock or editing due dates.
**Ideal path**: 6 (weekly visit, Done on each item as handled, new items appear by themselves)
**Alternate paths**: daily scan replies in the Legal agent thread; email reminders do not exist (`notify: false`).
**Source**: prior STORY-020, 023, 035

##### Steps
1. Week 1: open Legal, Deadlines tab, read four items (STORY-LEG-007).
2. Mark trademark response Done when counsel files it.
3. Week 3: forwarded email from the landlord arrives in Inbox. Alex expects Legal to "know". Legal shows nothing new: mail findings are only reported in the agent's chat reply, never recorded as deadlines or added to the Data room (`legal-agent.ts:9`; S-04).
4. Week 6: notice deadline 2026-11-30 approaches. No "due soon" marker (P-16); no notification.
5. Alex sends notice, clicks Done on "Renewal notice deadline".
6. Alex uploads the signed renewal (STORY-LEG-013) → no new notice date (P-01).
7. March: Alex marks the franchise tax report Done → no 2028 occurrence is created (P-02).
8. Alex checks "Last scan" each week; if the routine had been paused by mistake, nothing on the page said so (P-21).
9. End of quarter: Alex wants a list of what was done → there is no closed or history view (P-10).

##### Variations
- Alex works from a phone: the Contracts table needs horizontal scroll (`min-w-[820px]`, `LegalContracts.tsx:33`).

#### STORY-LEG-018: Contracts that are only in email

**Type**: medium
**Topic**: Mail findings
**Persona**: Alex, who keeps signed PDFs as email attachments
**Goal**: Get the MSA redlines and the trademark notice into Legal
**Preconditions**: D1; Gmail emulator mailbox seeded (the four legal emails); the Legal agent's mail tools available (owner's own non-group run, `legal-tools.ts:30-42`).
**Ideal path**: 2 (agent lists the emails, user clicks "Add to Data room")
**Alternate paths**: Data room's email import (feat/dataroom-import-email, merged into feat/legal at 166fc235); Inbox page.
**Source**: prior STORY-034

##### Steps
1. Click Scan now → agent reply includes "found in mail: Office lease renewal option, Legal notice: trademark office action…" (expected from `LEGAL_SCAN_PROMPT` step 2).
2. Alex looks for an "Add" button in the reply → none; the agent "cannot add them to the Data Room" (`legal-agent.ts:9`).
3. Alex goes to Data room and imports from email (separate feature), returns, scans again.
4. The trademark notice is an email, not a contract; it may be recorded as not legal or as a contract with no dates. The 30-day response date lives only in the email body.

#### STORY-LEG-019: Two legal bots: "Legal Desk (mock)" vs "Legal agent"

**Type**: short
**Topic**: Agent identity
**Persona**: Alex, sees bots in the sidebar roster
**Goal**: Talk to "the legal one"
**Preconditions**: D0 after visiting Legal once (Legal agent created). Seeded bot "Legal Desk (mock)", title "Contracts", is also in the roster and in the group "Leadership sync (mock)".
**Ideal path**: 1 (one obvious legal assistant)
**Alternate paths**: Legal page **Ask agent** panel (the real Legal agent with legal tools); sidebar roster "Legal agent"; sidebar roster "Legal Desk (mock)" (ordinary bot, no legal tools); group chat "Leadership sync (mock)" (the Legal agent loses its tools in groups, `legal-tools.ts:30-42`).
**Source**: new

##### Steps
1. Alex sees "Legal Desk (mock) — Contracts" in the roster and opens it → asks "when does my lease renew?" → an ordinary bot answers without `legal_query` and without the Legal page's data.
2. Alex also sees "Legal agent" (created by visiting `/app/legal`; Shell does not filter bots by spawn key) → unsure which is "real".
3. Answers can differ; nothing on either says which one feeds the Legal page.

### Stories: Advanced and failure

#### STORY-LEG-020: The Legal tab is not there

**Type**: long (it gates every other story)
**Topic**: Build contents
**Persona**: Alex, told "click Legal in the sidebar"
**Goal**: Reach the Legal page
**Preconditions**: Demo account built from `origin/main` / `docs/ux-pass` (458a69e4), the branch this pass was assigned.
**Ideal path**: 1 (click Legal)
**Alternate paths**: type `/app/legal` in the address bar.
**Source**: new

##### Steps
1. Sidebar shows Inbox, Finance, Data room, Cap Table, Integrations; no Legal.
2. Alex types `/app/legal` → the route does not exist on this branch (no Legal files tracked: `git ls-files | grep -i legal` is empty).
3. Alex opens Data room > Legal folder → four PDFs, no contract view, no dates.
4. Alex asks Chief "track my contract deadlines" → an ordinary chat answer; nothing is recorded anywhere.
5. Walker: stop here and report that the build lacks feat/legal; run STORY-LEG-001 onwards only on a build such as `local/legal-integration`.

---

## Area: Cap Table (STORY-CAP-nnn)

Source: `docs/ux-paths/captable/catalog.md`.


Generated: 2026-10-16 (read from `docs/ux-pass` at 458a69e4)
Scope: Cap Table page (`/app/cap-table`), Carta connection, the Carta agent panel, contacts, and asking the agent about equity (holders, securities, SAFEs, option pool).
Total Stories: 20

### What actually exists (read before walking)

- **The Cap Table page shows no cap table.** It is a contact list (Name, Email, Organization, Kind) with kind tabs (All / Investors / Auditors / Other), an "Add contact" button, a "Connect Carta" button (only when no connected Carta server), and a "Show Carta agent" icon button when the agent panel is collapsed (`apps/web/src/pages/CapTable.tsx:172-330`).
- **Holders, securities, SAFEs and the option pool are only reachable by chatting with the Carta agent** in the right-hand panel. The agent reads Carta through Carta's MCP server with a fixed read-only tool list: `welcome, discover, fetch, list_contexts, set_context, list_accounts, get_current_user, cap_table_chart, cap_table_healthcheck` (`packages/contracts/src/carta.ts:27-37`). It can never change Carta.
- **Connect Carta leaves the page**: it navigates to `/app/integrations?q=carta`, where the "Carta" tile (section "Equity", description "Cap table, equity and investors") opens the custom-connection dialog prefilled with `https://mcp.app.carta.com/mcp` (`Shell.tsx:4121`, `lib/integrations.ts:124-131`, `IntegrationsHome.tsx:585-597`).
- **A server counts as Carta only by host `mcp.app.carta.com` over https** (`contracts/src/carta.ts:13-21`). There is no "sync" button, no sync status, and no stored cap table data; every answer is a live read by the agent.
- **The agent** ("Carta agent", spawn key `carta-agent:<userId>`) is created with the "Create Carta agent" button in the panel (`Shell.tsx:2556-2567, 2612-2623, 4193`). It can list contacts freely and save contacts only after an approval card ("Save contact “…”", `approval-ask.ts:94-96`). Built-in skills: `carta-investor-update`, `carta-audit-response` (`builtin-skills.ts:155-185`). Every email send needs per-message approval with full recipients and body.
- **Not built** (do not walk as features): cap table dashboard, routine suggestions for audit season / investor updates (planned in `docs/carta/README.md` decision 8, no code found), contact search on the page, bulk import, writes to Carta.

### Mock demo data (seed once for the whole catalog)

Company / space name: **MOCK DEMO DATA — Northwind Robotics**. Signed-in founder: "Maya Chen" (`maya@northwind-robotics.test`), onboarding complete.

| Seed set | Contents |
|---|---|
| `contacts-base` | Investors: "Priya Raman", priya@sequoia-mock.test, "Sequoia Mock Capital"; "Tom Okafor", tom@lighthouse-mock.test, "Lighthouse Mock Ventures"; "Lena Fischer" (angel), lena.fischer@mock.test, no organization. Auditor: "Daniel Ortiz", dortiz@kpmg-mock.test, "KPMG Mock (auditor for Lighthouse Mock Ventures)". Other: "Sam Lee", sam@cooley-mock.test, "Cooley Mock LLP", notes "Company counsel". |
| `contacts-empty` | No contacts. |
| `carta-none` | No MCP server with a Carta endpoint. |
| `carta-connected` | Enabled MCP server with endpoint `https://mcp.app.carta.com/mcp`, OAuth status `connected`. Because Carta is matched by host, the walk needs either a Carta sandbox account or an MCP stub reachable at that host (DNS/proxy override). A stub on another host will NOT count as Carta. |
| `carta-needs-auth` | Same server row, OAuth not completed / expired (status not `connected`). |
| `carta-fixture` (served by the Carta sandbox or stub) | Company "MOCK DEMO DATA — Northwind Robotics", 10,000,000 fully diluted shares. Common: Maya Chen 4,000,000; co-founder "Arjun Patel" 3,000,000. Option pool 1,500,000 reserved (600,000 granted to 4 employees, 900,000 available). Series Seed Preferred: Sequoia Mock Capital 1,000,000. SAFEs not yet converted: Lighthouse Mock Ventures $500,000 post-money cap $10M (2026-03-01); Lena Fischer $50,000 same terms. Second context "MOCK DEMO DATA — Northwind Labs (inactive)" to exercise `list_contexts`/`set_context`. One deliberate healthcheck issue (an unvested grant past its cliff with no vesting event). |
| `agent-none` / `agent-exists` | No Carta agent bot, or a Carta agent already created. |
| `gmail-connected` | Gmail connected with: 2 sent "Northwind investor update" emails (July, August 2026); 1 audit confirmation request from dortiz@kpmg-mock.test asking Lighthouse Mock Ventures' holdings as of 2025-12-31 with figures "SAFE $500,000"; 1 DocuSign envelope email "Please sign: Audit confirmation – Lighthouse Mock Ventures" with no figures. |
| `finance-connected` | Finance source with cash $2.4M, monthly burn $180k (for investor update drafts). |

### Summary

| Type | Count |
|---|---|
| Short | 12 |
| Medium | 4 |
| Long | 4 |

### Coverage Matrix

| Feature area | Stories | Gaps |
|---|---|---|
| Find Cap Table page / first impression | 001, 002, STORY-CAP-017 | none |
| Carta connection | 003, 004, 005, STORY-CAP-017 | no "sync" exists to cover |
| Carta agent panel (create, collapse, reopen, open full) | 006, 007, STORY-CAP-008 | — |
| Contacts CRUD and filtering | 009, 010, 011, 012, STORY-CAP-013 | no search on page (not built) |
| Ask about holders / securities / SAFEs / option pool | 014, 015, 016, STORY-CAP-018 | as-of-date holdings depend on Carta `fetch` (TBD in docs) |
| Agent saves contacts with approval | 016, STORY-CAP-019 | — |
| Investor update / audit skills | 018, 019, STORY-CAP-020 | routine suggestions not built |
| Errors / empty states | 002, 005, 011, STORY-CAP-013 | — |

### Story Dependency Graph

```text
STORY-CAP-001 (find Cap Table)
├── STORY-CAP-002 (empty page) ── STORY-CAP-009 (add first contact) ── STORY-CAP-010/011/012/013
├── STORY-CAP-003 (connect Carta) ── STORY-CAP-004 (back to page) ── STORY-CAP-005 (expired auth)
│   └── STORY-CAP-006 (create agent) ── STORY-CAP-007/008 (panel)
│       └── STORY-CAP-014/015/016 (equity questions) ── STORY-CAP-018/019/020 (long flows)
└── STORY-CAP-017 (long: first visit to working setup)
```


### Stories: Finding the page and first impression

#### STORY-CAP-001: "Where do I see who owns my company?"

**Type**: short
**Topic**: Navigation
**Persona**: First-time founder (Maya), just finished onboarding, has never opened Cap Table.
**Goal**: Find where the product keeps ownership information.
**Preconditions**: `contacts-base`, `carta-none`, `agent-none`.
**Ideal path**: 1 — one sidebar click should land on an ownership view.
**Alternate paths**: Typing `/app/cap-table` directly; none other in the UI.

##### Steps
1. Scan the left sidebar for anything about ownership or equity → finds "Cap Table" (pie-chart icon) under "Finance", above "Data room" (`Shell.tsx:3332-3341`).
2. Click "Cap Table" → URL `/app/cap-table`; heading "Cap Table"; buttons "Connect Carta", "Add contact"; tabs All / Investors / Auditors / Other; a table of 5 people; a right panel with a "Create Carta agent" button.
3. Look for share counts or a pie chart → none. **Hesitation:** the page is titled "Cap Table" with a pie icon, but it lists people and emails. A founder will expect percentages and wonder if data failed to load.

##### Variations
- Phone width: the sidebar is behind a menu; Organization column is hidden below the `@md` container width (`CapTable.tsx:290`).

##### Edge Cases
- If the founder expects "Equity" (the Integrations section name), there is no sidebar item by that name.

#### STORY-CAP-002: Empty Cap Table on day one

**Type**: short
**Topic**: Empty states
**Persona**: First-time founder with nothing set up.
**Goal**: Understand what to do on an empty page.
**Preconditions**: `contacts-empty`, `carta-none`, `agent-none`.
**Ideal path**: 1 — the empty state should say what to do next and offer the button.
**Alternate paths**: none found.

##### Steps
1. Open Cap Table → brief 3-row skeleton, then "No contacts yet" centred; "Connect Carta" and "Add contact" in the header; right panel "Create Carta agent".
2. Decide what to click first → no text explains that Carta is where ownership comes from or what the agent does. **Hesitation:** three equal calls to action with no order.

##### Edge Cases
- Contacts load fails → red "Could not load contacts" (or server text) + "Try again" (`CapTable.tsx:263-269`).

### Stories: Connecting Carta

#### STORY-CAP-003: Connect Carta for the first time

**Type**: medium
**Topic**: Carta connection
**Persona**: Founder whose company is on Carta and who has a Carta login.
**Goal**: Link Carta so the product can see the cap table.
**Preconditions**: `carta-none`, `agent-none`, Carta sandbox/stub reachable at `mcp.app.carta.com` with `carta-fixture`.
**Ideal path**: 3 — click Connect Carta, approve in Carta's OAuth screen, return to Cap Table.
**Alternate paths**: Sidebar → Integrations → search "carta" → Carta tile; or Integrations → "Add custom connection" and paste `https://mcp.app.carta.com/mcp` by hand (counts as Carta because the host matches).

##### Steps
1. On Cap Table, click "Connect Carta" → the app leaves Cap Table and opens Integrations with the search box prefilled "carta" (`Shell.tsx:4121`). **Hesitation:** the founder expected a popup, not a different page.
2. Find the "Carta" tile under "Equity" ("Cap table, equity and investors") → click its connect button.
3. A custom connection dialog opens prefilled with `https://mcp.app.carta.com/mcp` → **Hesitation:** "custom connection" and an MCP URL look technical; a first-timer may think they must change something.
4. Confirm → Carta OAuth sign-in in a new window/redirect → approve.
5. Return to Integrations → Carta shows as connected.
6. Click "Cap Table" in the sidebar → "Connect Carta" button is gone.

##### Variations
- Agent already exists (`agent-exists`): on save, the server gives the existing agent the read tools (`router.ts:4409-4411`).

##### Edge Cases
- Founder cancels OAuth → server row exists but status not `connected`; Cap Table still shows "Connect Carta" (see STORY-CAP-005).

#### STORY-CAP-004: Did the connection work?

**Type**: short
**Topic**: Carta connection
**Persona**: Founder just back from Carta's sign-in.
**Goal**: Confirm Carta is linked and see their data.
**Preconditions**: `carta-connected`, `contacts-base`, `agent-none`.
**Ideal path**: 1 — the Cap Table page should show a connected state or data.
**Alternate paths**: Integrations page connection list.

##### Steps
1. Open Cap Table → "Connect Carta" button is absent. That is the only sign of success.
2. Look for a "Synced" label, last-sync time, or numbers → none. **Hesitation:** "nothing changed — did it import anything?" The page never shows Carta data; the founder has to discover the agent panel.

##### Edge Cases
- `rpc.mcp.servers.list` fails → the page assumes connected and hides "Connect Carta" (`CapTable.tsx:182, 214`).

#### STORY-CAP-005: Carta sign-in expired

**Type**: short
**Topic**: Errors / Carta connection
**Persona**: Founder returning after weeks away.
**Goal**: Ask the agent something and get an answer.
**Preconditions**: `carta-needs-auth`, `agent-exists`, `contacts-base`.
**Ideal path**: 2 — see a "reconnect" notice, click it.
**Alternate paths**: Integrations page.

##### Steps
1. Open Cap Table → "Connect Carta" is shown again even though Carta was connected before (status is not `connected`).
2. Click it → Integrations filtered to "carta"; the founder must find the existing connection and re-authorise rather than add a second one. **Hesitation:** "Connect" not "Reconnect"; risk of creating a duplicate server.
3. Ask the agent "How many shares do I own?" before reconnecting → observe how the agent reports a failed Carta call (record exact text).

### Stories: The Carta agent panel

#### STORY-CAP-006: Create the Carta agent

**Type**: short
**Topic**: Agent panel
**Persona**: First-time founder.
**Goal**: Get the assistant that can answer equity questions.
**Preconditions**: `agent-none`, `carta-connected` (also run with `carta-none`).
**Ideal path**: 1 — one click, or the agent exists already.
**Alternate paths**: none in UI (`bots.create` rejects the reserved key).

##### Steps
1. In the right panel click "Create Carta agent" → button disables; on success the panel header shows avatar + "Carta agent" and the chat appears.
2. Read the empty chat → no starter prompts about Carta. **Hesitation:** what can I ask?

##### Variations
- With `carta-none`: creation still succeeds, but the agent has no Carta tools until Carta is connected (`carta-agent.ts:20-45`). Nothing on screen says so.

##### Edge Cases
- Failure → red text "Could not create the Carta agent" under the button (`Shell.tsx:2563`).

#### STORY-CAP-007: Hide and bring back the agent

**Type**: short
**Topic**: Agent panel
**Persona**: Founder who wants more room for the contact table.
**Goal**: Collapse the side panel and get it back.
**Preconditions**: `agent-exists`, `contacts-base`.
**Ideal path**: 2 — collapse, re-open.
**Alternate paths**: Leaving and returning to Cap Table re-opens the panel automatically (`Shell.tsx:897-899`).

##### Steps
1. Click the panel's "Collapse Carta agent" icon (PanelRightClose) → panel closes; a "Show Carta agent" icon (PanelRightOpen) appears next to "Add contact".
2. Click "Show Carta agent" → panel returns with chat history.
3. Navigate to Inbox and back → panel is open again regardless of previous choice. **Hesitation:** preference not remembered (unlike the Inbox agent, which has a stored collapsed preference).

#### STORY-CAP-008: Open the agent full screen

**Type**: short
**Topic**: Agent panel / navigation
**Persona**: Founder wanting a bigger chat for a long answer.
**Goal**: Chat with the Carta agent on its own page.
**Preconditions**: `agent-exists`.
**Ideal path**: 1.
**Alternate paths**: Panel header name button → `openBot`; the "Carta agent" entry in the bots sidebar list (bot lists are not filtered by spawn key).

##### Steps
1. Click "Carta agent" (name + avatar) in the panel header → app navigates to the bot's own route; Cap Table page is gone.
2. Look for a way back to the contact list → only the sidebar "Cap Table" link.

##### Edge Cases
- Same chat thread shown in two places (panel and bot page) — redundancy noted below.

### Stories: Contacts

#### STORY-CAP-009: Add an investor by hand

**Type**: short
**Topic**: Contacts
**Persona**: Founder who just closed an angel check.
**Goal**: Record "Rita Gomez" (rita@gomez-angel.test, angel) as an investor.
**Preconditions**: `contacts-base`.
**Ideal path**: 3 — open form, fill, save.
**Alternate paths**: Ask the agent "Add Rita Gomez, rita@gomez-angel.test, as an investor" → approval card "Save contact “Rita Gomez”" → approve (STORY-CAP-016).

##### Steps
1. Click "Add contact" → dialog "Add contact" with Name (required), Email, Organization, Kind (defaults to "Investor"), Notes.
2. Fill Name, Email; leave Organization empty; Notes "Angel, $25k SAFE, Oct 2026".
3. Click "Save" → dialog closes, list reloads, "Rita Gomez" appears in alphabetical order.
4. **Hesitation:** the founder typed the check amount in Notes; it does not reach Carta and nothing says Carta is unaffected.

##### Edge Cases
- Invalid email → browser `type=email` validation blocks submit.
- Save disabled until Name has non-space text.

#### STORY-CAP-010: Fix a contact's details

**Type**: short
**Topic**: Contacts
**Persona**: Founder whose investor changed firms.
**Goal**: Change Tom Okafor's organization.
**Preconditions**: `contacts-base`.
**Ideal path**: 3 — click name, edit, save.
**Alternate paths**: Ask the agent to update (it matches by email, never by id; `contact-tools.ts:52-56`).

##### Steps
1. Click "Tom Okafor" (name is a button; only the name is clickable, not the row) → "Edit contact".
2. Change Organization → "Save" → table updates.

##### Edge Cases
- Change email to priya@sequoia-mock.test → red alert "Another contact already has this email." (`db/src/contacts.ts:8`).
- Clear Organization → saved as empty (null).

#### STORY-CAP-011: Add a contact who already exists

**Type**: short
**Topic**: Contacts / error
**Persona**: Founder who forgot Priya was already listed.
**Goal**: Add "Priya R." with priya@sequoia-mock.test, kind Other.
**Preconditions**: `contacts-base`.
**Ideal path**: 2 — the form should warn "already exists — open it?".
**Alternate paths**: none.

##### Steps
1. "Add contact" → Name "Priya R.", Email priya@sequoia-mock.test, Kind "Other", Notes empty → Save.
2. Dialog closes with no warning; the list still has one row for that email, now named "Priya R.", kind Other, organization and notes cleared. **Problem:** a create with a known email silently overwrites the existing contact (`db/src/contacts.ts:63-70`).

#### STORY-CAP-012: See only auditors

**Type**: short
**Topic**: Contacts / filter
**Persona**: Founder in audit season.
**Goal**: List auditor contacts.
**Preconditions**: `contacts-base`.
**Ideal path**: 1.
**Alternate paths**: Ask the agent "Who are my auditor contacts?" (`contacts_list` kind auditor).

##### Steps
1. Click tab "Auditors" → only Daniel Ortiz.
2. Click "Other" → Sam Lee. Click "All" → 5 rows.

##### Edge Cases
- With only investors seeded, "Auditors" shows "No contacts yet" — wrong message when contacts exist (`CapTable.tsx:276-278`).
- Tab choice is not in the URL; reload resets to "All".

#### STORY-CAP-013: Delete a contact by mistake

**Type**: short
**Topic**: Contacts / destructive
**Persona**: Founder tidying the list.
**Goal**: Delete Sam Lee (wanted), then realise it could have been the wrong person.
**Preconditions**: `contacts-base`.
**Ideal path**: 3 — open, delete, confirm (or undo).
**Alternate paths**: none (the agent has no delete tool).

##### Steps
1. Click "Sam Lee" → "Edit contact" → red "Delete" at bottom left.
2. Click "Delete" → contact is removed immediately; no confirmation, no undo (`CapTable.tsx:151-160`).

### Stories: Asking the agent about equity

#### STORY-CAP-014: "Who owns what?"

**Type**: medium
**Topic**: Ask agent — holders
**Persona**: Founder preparing for a board call.
**Goal**: See ownership percentages by holder.
**Preconditions**: `carta-connected` with `carta-fixture`, `agent-exists`.
**Ideal path**: 2 — open page, read a chart (or ask once).
**Alternate paths**: Opening the Carta agent full screen (STORY-CAP-008).

##### Steps
1. In the panel type "Who owns my company and what percent each?" → agent calls Carta (`set_context` if needed, `cap_table_chart`/`fetch`).
2. Expected answer: Maya 40%, Arjun 30%, Sequoia Mock Capital 10%, option pool 15% (6% granted / 9% available), fully diluted 10,000,000; SAFEs listed separately as unconverted.
3. Ask "Is that fully diluted?" → agent explains basis.
4. Check that no figure is invented; missing values should say TBD (agent instructions, `carta-agent.ts:10`).

##### Variations
- Two Carta companies (`list_contexts` returns two) → agent should ask which company or pick "Northwind Robotics" and say so.

#### STORY-CAP-015: SAFEs and the option pool

**Type**: medium
**Topic**: Ask agent — securities, SAFEs, option pool
**Persona**: Founder planning a Series A.
**Goal**: Understand outstanding SAFEs and how much of the pool is left.
**Preconditions**: `carta-connected` + `carta-fixture`, `agent-exists`.
**Ideal path**: 2 questions.
**Alternate paths**: none.

##### Steps
1. Ask "What SAFEs haven't converted yet?" → Lighthouse Mock Ventures $500,000 and Lena Fischer $50,000, $10M post-money cap, dates.
2. Ask "How many options can I still grant?" → 900,000 of 1,500,000.
3. Ask "What happens to ownership if the SAFEs convert at the cap?" → agent should compute (post-money: $550k/$10M = 5.5%) and say it is an estimate.
4. Ask "Grant 50,000 options to our new hire Jo" → agent must say it cannot change Carta (read-only) and tell the founder to do it in Carta.

##### Edge Cases
- `cap_table_healthcheck` → should surface the seeded vesting issue when asked "Anything wrong with my cap table?".

#### STORY-CAP-016: Agent finds investors missing from contacts

**Type**: medium
**Topic**: Ask agent + contacts
**Persona**: Founder who wants the contact list to match Carta.
**Goal**: Add Carta investors that are not in contacts.
**Preconditions**: `carta-fixture`, `carta-connected`, `agent-exists`, `contacts-base` minus Tom Okafor.
**Ideal path**: 3 — ask, approve, see the list update.
**Alternate paths**: Add by hand (STORY-CAP-009).

##### Steps
1. Ask "Are all my Carta investors in my contacts?" → agent compares `contacts_list` with Carta; names Lighthouse Mock Ventures as missing and offers to add.
2. Say "yes" → approval card "Save contact “…”" with name/email/organization/kind lines (`approval-ask.ts:94-123`).
3. Approve → contact saved.
4. Look at the contact table beside the chat → **Hesitation:** the table does not reload by itself (it loads once on mount, `CapTable.tsx:188-199`); the new contact appears only after leaving and returning.

##### Edge Cases
- Carta has no email for the holder → agent may save without email (allowed) or ask for one.
- Reject the card → nothing saved.

### Stories: Long end-to-end stories

#### STORY-CAP-017: First visit to a working setup

**Type**: long
**Topic**: End-to-end onboarding
**Persona**: Maya, first day in the product, company on Carta.
**Goal**: Go from nothing to asking "what's my ownership?" and getting an answer.
**Preconditions**: `contacts-empty`, `carta-none`, `agent-none`, Carta sandbox/stub with `carta-fixture`.
**Ideal path**: 5 — open Cap Table, connect, approve OAuth, create agent (or auto), ask.
**Alternate paths**: Integrations first, then Cap Table.

##### Steps
1. Sidebar → "Cap Table" → empty page, "No contacts yet".
2. Click "Create Carta agent" first (it is the most prominent thing on the right) → agent created.
3. Ask "What's my ownership?" → agent has no Carta tools yet; record what it says (should tell her to connect Carta).
4. Click "Connect Carta" → lands on Integrations, search "carta".
5. Click the Carta tile → prefilled dialog → confirm → OAuth → approve.
6. Back to Integrations → connected.
7. Sidebar → "Cap Table" → "Connect Carta" gone; panel open.
8. Ask again in the same thread → agent now reads Carta (server assigned to existing agent, `router.ts:4411`) → ownership breakdown.
9. Ask "Who are my investors?" → Sequoia Mock Capital, Lighthouse Mock Ventures, Lena Fischer.
10. Ask "Add them to my contacts" → three approval cards, one per contact → approve each.
11. Leave and return to Cap Table → three Investors rows appear.
12. Click "Investors" tab → the three rows.
13. Open "Lena Fischer" → add email lena.fischer@mock.test → Save.
14. Collapse the agent → wider table; "Show Carta agent" to bring it back.
15. **Friction points to record:** leaving the page to connect, no success state on Cap Table, the stale contact table after agent saves, one approval per contact.

#### STORY-CAP-018: Monthly investor update

**Type**: long
**Topic**: Skill carta-investor-update
**Persona**: Founder who owes investors the September update.
**Goal**: Get a draft in Gmail addressed to all investors.
**Preconditions**: `carta-connected`+`carta-fixture`, `agent-exists`, `contacts-base`, `gmail-connected`, `finance-connected`.
**Ideal path**: 4 — ask, give highlights, review draft, approve.
**Alternate paths**: Pick skill "carta-investor-update" in the composer skill selector vs plain request "write my investor update".

##### Steps
1. Ask "Write my September investor update" (or choose the skill) → agent picks period, calls `finance_overview` / `finance_breakdown` → cash $2.4M, burn $180k, runway ~13 months.
2. Agent reads ownership changes from Carta and recipients via `contacts_list` kind investor.
3. Agent flags any Carta investor not in contacts and asks before saving.
4. Agent reads the July and August sent updates for tone.
5. Agent asks for highlights, lowlights, asks → founder answers in chat.
6. Agent saves a Gmail draft to Maya with investors in Bcc; shows it; lists TBD items (e.g. revenue).
7. Founder opens Inbox/Gmail to check the draft.
8. **Hesitation:** whether the update was sent — it is only a draft; the skill never sends.

##### Edge Cases
- Lena Fischer has no email in contacts → recipient missing; agent should say so.

#### STORY-CAP-019: Auditor confirmation request

**Type**: long
**Topic**: Skill carta-audit-response
**Persona**: Founder who got an audit email from Lighthouse's auditor.
**Goal**: Reply with correct holdings.
**Preconditions**: `carta-connected`+`carta-fixture`, `agent-exists`, `contacts-base` minus Daniel Ortiz, `gmail-connected`.
**Ideal path**: 4 — ask, review comparison, approve save, approve send.
**Alternate paths**: skill selector vs "do I have any audit requests?".

##### Steps
1. Ask "Any auditor requests I need to answer?" → `mail_search` + `mail_grep` find the KPMG Mock email and the DocuSign envelope.
2. Agent extracts fund (Lighthouse Mock Ventures), as-of 2025-12-31, items (SAFE $500,000).
3. Agent offers to save Daniel Ortiz as an auditor → approval card → approve.
4. Agent compares with Carta: SAFE dated 2026-03-01 — after the as-of date — so the holding as of 2025-12-31 should be $0; reports the difference exactly.
5. DocuSign email has no figures → agent gives the Carta numbers to check inside DocuSign and does not say "sign it".
6. Agent drafts a reply; "still needed from you" list.
7. Founder asks to send → approval card shows full to/cc/bcc/subject/body → approve → sent.
8. Check Cap Table → "Auditors" tab shows Daniel Ortiz (after reload).

##### Edge Cases
- Agent tries to send by draft id only → refused (`executor.ts:4415`).
- Carta `fetch` cannot answer as-of-date holdings → agent must say so (open risk in `docs/carta/README.md`).

#### STORY-CAP-020: Board prep in one sitting

**Type**: long
**Topic**: Cross-area
**Persona**: Founder with a board meeting tomorrow.
**Goal**: Know the cap table, pool, SAFE exposure, and who to email.
**Preconditions**: `carta-connected`+`carta-fixture`, `agent-exists`, `contacts-base`.
**Ideal path**: 4 questions in one chat.
**Alternate paths**: Finance page agent for cash numbers (separate Finance agent).

##### Steps
1. Cap Table → panel → "Summarise my cap table for the board" → ownership table.
2. "Anything wrong with it?" → healthcheck finding.
3. "Option pool left?" → 900,000.
4. "If we raise $3M at $15M pre, what's the dilution?" → estimate, labelled as such.
5. "Which board members are in my contacts?" → agent can only list contacts; there is no "board member" kind (Investor/Auditor/Other). **Hesitation:** where to put counsel and board members — "Other".
6. Collapse panel, review Investors tab, click "Sam Lee" to check notes "Company counsel".
7. Ask for cash and runway → the Carta agent has `finance_*` tools; compare with the Finance page agent's answer — two agents can answer the same question.

---

## Area: Data room (STORY-DRM-nnn)

Source: `docs/ux-paths/dataroom/catalog.md`.


Generated: 2026-10-16
Repository: `/Users/dennison/develop/rakazo-ux` (branch `docs/ux-pass`, HEAD `458a69e4`)
Total Stories: 23
Persona for every story: a naive first-time founder who has never seen Rakazo, does not know its
vocabulary ("Data room", "facets", "filing", "embedding"), and wants to keep their company's
documents in order.

### What exists in the code (read before walking)

Built and reachable in the web app:

- Route `/app/data-room` (`apps/web/src/App.tsx:194`), sidebar link "Data room" (`apps/web/src/pages/Shell.tsx:3342-3351`).
- Page `apps/web/src/pages/DataRoom.tsx`: empty state "Drop files here" + "Choose files"; header with List view / Grid view toggles and a "+" button (aria "Add files"); filter bar; folder tree ("All items" plus folders) when the page is at least 800 px wide, otherwise a folder picker pill; list, grid, or search results; "Load more"; preview pane (or a dialog when narrow).
- Drop anywhere: a full-window drop overlay "Drop to add to Data room" on every signed-in page, with one toast per file (percentage, then "Filed" + "View", or "Over the 50 MB limit" / "Unsupported file name" / "Upload failed") (`components/data-room/DropZone.tsx`).
- Filter bar (`components/data-room/FilterBar.tsx`): "Search documents" box (debounced 300 ms, server-side), chips "Type", "Party", "Date", "Source", "Sort: …" and an ascending/descending arrow.
- Preview (`components/data-room/Preview.tsx`): name, status or summary, Type / Date / Parties / Amount / Tags / Folder / Source / Size, "Download", and a "…" menu.
- Item menu (`components/data-room/ItemMenu.tsx`): Move, Rename, Delete (dialogs in `ItemDialogs.tsx`).
- Status labels while a background job works: "Pending", "Reading", "Filing", "Failed" (`components/data-room/format.ts`); the list polls every 3 s.
- Automatic filing: when a model is available AND Data room consent is recorded, the classifier sets type/date/parties/amount/tags/summary and files an unfiled item into a folder path it proposes, creating folders as needed (`packages/db/src/data-room.ts:776-778`).
- Settings: "Embedding model" text field in the model settings overlay (`pages/ModelSettingsOverlay.tsx:1526-1590`), which enables semantic search.

Exists in the API only (no web UI calls it): `dataRoom.folderCreate`, `folderRename`, `folderMove`, `folderDelete`, `dataRoom.consent`, `dataRoom.consentGrant` (`packages/contracts/src/rpc.ts:1123-1146`).

Not built (planned in `docs/data-room/README.md:178-215`): Google Drive sync, Gmail attachment/body import, chat and finance import, the "Ask agent" button in the preview, the Data room agent, the `search_data_room` / `read_data_room_item` agent tools, sharing with other members (V1 shows each item only to the person who added it), mobile. Stories below that touch these areas describe what the founder will try and record that nothing in the app answers it. They are gap stories, not feature stories.

### Mock demo data required (seed for "MOCK DEMO DATA — Northwind Robotics")

Every story names the subset it needs. The full seed is:

- **S0 – empty account**: a signed-in user with a completed onboarding and zero Data room items or folders.
- **S1 – filed library** (items owned by the demo user, `source: "upload"`, `status: "ready"`, classified):
  - Folders: `Legal` > `Contracts`; `Finance` > `Invoices`; `Finance` > `Bank statements`; `Investors`; `HR`.
  - `Northwind - Series A term sheet v3.pdf` — docType `investor`, docDate 2026-09-28, parties ["Northwind Robotics", "MOCK Harbor Ventures"], tags ["funding", "series a"], summary "MOCK: draft Series A term sheet, $6M at $24M pre-money.", folder `Investors`.
  - `Northwind HQ lease renewal 2027.pdf` — docType `contract`, docDate 2026-10-03, parties ["Northwind Robotics", "MOCK Pier 9 Properties"], amountCents 2400000 USD, tags ["lease", "renewal"], folder `Legal / Contracts`.
  - `Invoice NW-1042 Acme Servo Supply.pdf` — docType `invoice`, docDate 2026-08-14, parties ["MOCK Acme Servo Supply", "Northwind Robotics"], amountCents 1875000 USD, tags ["hardware"], folder `Finance / Invoices`.
  - `Invoice NW-1043 Acme Servo Supply.pdf` — same party, docDate 2026-09-14, amountCents 920000 USD, folder `Finance / Invoices`.
  - `Mercury statement 2026-09.pdf` — docType `statement`, docDate 2026-09-30, parties ["Northwind Robotics"], folder `Finance / Bank statements`.
  - `Offer letter - Priya Raman (MOCK).docx` — docType `hr`, docDate 2026-07-01, folder `HR`.
  - `Board minutes Q2 2026.pdf` — docType `report`, docDate 2026-06-30, folder: none.
- **S2 – in-progress and failed items**: `Delaware franchise tax notice.pdf` with `status: "extracting"`; `Scan 0007.jpg` with `status: "classifying"`; `Old cap table export.xlsx` with `status: "failed"`, error "Could not read this file"; `Customer NDA - MOCK Bolt Freight.pdf` with `status: "ready"`, error "Classification skipped" (renders "Couldn't classify").
- **S3 – unclassified library** (no consent recorded): five `ready` uploads with all facets null, no folders.
- **S4 – many items**: 60+ ready items so "Load more" appears (list page size 50, search page size 20).
- **Files on the walker's disk** (not in the DB): `MOCK Northwind pitch deck.pdf` (~3 MB), `MOCK Northwind SAFE - Jane Angel.pdf`, `MOCK board-video.mp4` (~60 MB, over the 50 MB cap), and a copy of a file already in S1 (to trigger duplicate handling).
- **Model state**: M0 = no default model; M1 = default chat model set, no embedding model; M2 = default chat model plus an "Embedding model" value. Data room consent recorded or not (only seedable through the API `dataRoom.consentGrant` or the DB, because no web UI grants it).
- **Gmail**: one connected mock Gmail account with a thread "MOCK Acme Servo Supply – invoice NW-1044" carrying a PDF attachment (for the Gmail gap story).

### Summary

| Type | Count |
|------|-------|
| Short | 12 |
| Medium | 8 |
| Long | 3 |

### Coverage Matrix

| Feature area | Stories | Gaps |
|---|---|---|
| Find the Data room / empty state | 001, 002, STORY-DRM-018 | none |
| Upload (button, drop on page, drop anywhere, limits, duplicates) | 002, 003, 004, 005, 006, STORY-DRM-018 | Upload into a chosen folder is not possible |
| Ingestion status (Pending / Reading / Filing / Failed) | 007, 008, STORY-DRM-018 | No retry button for a failed item |
| Consent prompt for documents | 009, STORY-DRM-019 | No web UI for `dataRoom.consentGrant` |
| Automatic filing and folders | 010, 011, STORY-DRM-018 | No create / rename / delete folder in UI |
| Browse (folder tree, picker, list/grid, sort, preview) | 011, 012, STORY-DRM-017 | View choice is not remembered |
| Search and facet filters | 013, 014, 015, STORY-DRM-019 | No search hint text; Type filter is exact match |
| Move / rename / delete / download | 016, 017, STORY-DRM-020 | No undo for delete |
| Gmail attachment import | STORY-DRM-020 | Not built |
| Google Drive import | STORY-DRM-021 | Not built |
| Sharing with a cofounder / investor | STORY-DRM-022 | Not built (owner-only in V1) |
| Agent over documents | STORY-DRM-023 | Not built |

Stories STORY-DRM-020 to STORY-DRM-023 are gap stories: they record what a founder tries in areas that are not built yet.

### Story Dependency Graph

```text
STORY-DRM-001 (Find the Data room, empty)
├── STORY-DRM-002 (First upload with Choose files)
│   ├── STORY-DRM-003 (Drop on another page)
│   ├── STORY-DRM-004 (File too large)
│   ├── STORY-DRM-005 (Same file twice)
│   └── STORY-DRM-007 (Watch it get read and filed)
│       ├── STORY-DRM-008 (A file failed)
│       └── STORY-DRM-009 (Why is nothing tagged? consent)
│           └── STORY-DRM-010 (Auto-filing into folders)
├── STORY-DRM-011 (Browse folders)  [S1]
│   ├── STORY-DRM-012 (List vs grid, sort)
│   ├── STORY-DRM-013 (Search for the lease)
│   │   └── STORY-DRM-014 (Filter invoices from one vendor)
│   │       └── STORY-DRM-015 (Date filter for last quarter)
│   └── STORY-DRM-016 (Rename and move)
│       └── STORY-DRM-017 (Delete a duplicate)
├── STORY-DRM-018 (LONG: first week setting up the company's documents)
├── STORY-DRM-019 (LONG: prepare for an investor diligence request)
├── STORY-DRM-020 (LONG: monthly bookkeeping close with Gmail invoices)  [gap: Gmail import]
├── STORY-DRM-021 (Bring in Google Drive)  [gap]
├── STORY-DRM-022 (Share with cofounder)  [gap]
└── STORY-DRM-023 (Ask the agent about a contract)  [gap]
```


### Stories: Getting started and uploading

#### STORY-DRM-001: Find where documents go

**Type**: short
**Topic**: Navigation / empty state
**Persona**: First-time founder of Northwind Robotics, signed in for the first time, holding a folder of PDFs on their laptop.
**Goal**: Find the place in the app where company documents live.
**Preconditions**: S0 (empty account), any model state.
**Ideal path**: 1 — one clearly named sidebar entry should take them there.
**Alternate paths**: Direct URL `/app/data-room`; the "View" link in an upload toast (`DropZone.tsx:149-151`) once something is uploaded.

##### Steps
1. Scan the sidebar for something like "Documents" or "Files" → They see "Data room" with a folder icon among "Inbox", "Cap Table" and others. **Hesitation:** "Data room" is investor-diligence jargon; a founder who has not raised may not connect it with "all my company files".
2. Click "Data room" → Page titled "Data room" with a dashed box: upload icon, "Drop files here", button "Choose files". No view toggles or filters are shown yet.
3. Read the box for an explanation → There is no sentence saying what the Data room does (reads, tags and files documents automatically). The founder only learns it accepts files.

##### Variations
- Mobile width: sidebar is behind the menu button; "Data room" closes the mobile sidebar on tap (`Shell.tsx:3348`).

##### Edge Cases
- List call fails on first load: the page is not "empty", so the full filter bar shows with an error line and "Retry" instead of the drop box (`DataRoom.tsx:230`, `:305-313`).

#### STORY-DRM-002: Upload the first documents with "Choose files"

**Type**: short
**Topic**: Upload
**Persona**: Same founder; wants to put the term sheet and the lease in.
**Goal**: Get two PDFs into the Data room.
**Preconditions**: S0; walker has `MOCK Northwind pitch deck.pdf` and `MOCK Northwind SAFE - Jane Angel.pdf`.
**Ideal path**: 2 — pick files, see them listed.
**Alternate paths**: Drag onto the page; drag onto any other page (STORY-DRM-003); "+" ("Add files") icon in the header once the room is not empty (`DataRoom.tsx:261`).

##### Steps
1. Click "Choose files" → OS file picker opens; multiple selection is allowed.
2. Select both PDFs and confirm → One toast per file bottom-right with the file name and a percentage and progress bar.
3. Wait → Each toast changes to green "Filed" with a "View" link and disappears after 8 s. **Misread risk:** "Filed" appears as soon as the upload finishes, before the file is read or put in a folder; the founder may expect it to already be in a folder.
4. Look at the page → The empty box is replaced by the filter bar and a list with the two rows; their Type column shows "Pending" or "Reading" in grey.

##### Variations
- Click "View" in the toast → URL becomes `/app/data-room?item=<id>` and that item is pinned in the preview.

##### Edge Cases
- Network drop mid-upload → toast shows "Upload failed" with a Dismiss (X) button; nothing is retried automatically.

#### STORY-DRM-003: Drop a file while on another page

**Type**: short
**Topic**: Upload (drop anywhere)
**Persona**: Founder reading their Inbox who just saved a signed NDA to the desktop.
**Goal**: Store the NDA without leaving the current page.
**Preconditions**: S1; walker has a PDF on disk; current page `/app/inbox` (or a chat).
**Ideal path**: 1 — drop the file.
**Alternate paths**: Data room "Choose files" / "+" button (STORY-DRM-002).

##### Steps
1. Drag the PDF over the Inbox page → A full-window overlay reads "Drop to add to Data room". **Hesitation:** the founder did not know this was possible; nothing on other pages advertises it.
2. Drop → Toast with progress, then "Filed" + "View".
3. Click "View" → Navigates to the Data room with the NDA pinned in the preview.

##### Variations
- Drop onto the chat composer instead: the composer accepts it as a chat attachment and the Data room overlay goes away (`DropZone.tsx:53-57`). The founder may not realise those are two different destinations.

##### Edge Cases
- A dialog is open while dragging: open menus are closed but dialogs are not; the overlay still appears.

#### STORY-DRM-004: Try to upload a file that is too big

**Type**: short
**Topic**: Upload limits
**Persona**: Founder trying to keep the board meeting recording.
**Goal**: Store a 60 MB video.
**Preconditions**: S1; walker has `MOCK board-video.mp4` (~60 MB).
**Ideal path**: 1 — attempt, get a clear refusal before waiting.
**Alternate paths**: none found.

##### Steps
1. Click "+" ("Add files") and choose the video → Toast immediately shows "Over the 50 MB limit" in red with an X; it stays 15 s.
2. Look for a way to store it anyway → None; no compression hint, no link to a larger-file option.

##### Edge Cases
- File just under 50 MB but the server counts more bytes (encoding) → server returns 413 and the toast says the same message.

#### STORY-DRM-005: Upload the same file twice

**Type**: short
**Topic**: Upload duplicates
**Persona**: Founder unsure whether the lease was already uploaded.
**Goal**: Make sure the lease is in the Data room without creating a copy.
**Preconditions**: S1; walker has a byte-identical copy of `Northwind HQ lease renewal 2027.pdf`.
**Ideal path**: 1 — upload and be told it already exists.
**Alternate paths**: Search "lease" first (STORY-DRM-013).

##### Steps
1. Drop the copy on the Data room → Toast shows progress, then "Filed" + "View".
2. Look at the list → No second row appears; the original row is unchanged.
3. Wonder whether it worked → Nothing says "Already in your Data room". The server returned `duplicate: true` (`apps/api/src/data-room.ts:430-433`) but the toast ignores it (`upload-toasts.ts:76-80`).

##### Variations
- Same file under a different name → still treated as a duplicate (hash match); the new name is dropped silently.

##### Edge Cases
- Original item was stuck in Pending or Failed → the duplicate upload restarts its processing (`data-room.ts:400-406`), which is invisible to the founder but may turn a Failed row into Reading.

#### STORY-DRM-006: Upload into a specific folder

**Type**: short
**Topic**: Upload + folders
**Persona**: Founder who has the `Investors` folder open and drops the SAFE into it.
**Goal**: Add the SAFE directly to `Investors`.
**Preconditions**: S1; consent recorded or not (both variants); walker has `MOCK Northwind SAFE - Jane Angel.pdf`.
**Ideal path**: 1 — drop while the folder is selected.
**Alternate paths**: Upload then Move (STORY-DRM-016).

##### Steps
1. Click `Investors` in the folder tree → List shows only the term sheet.
2. Drag the SAFE onto the list → Overlay "Drop to add to Data room"; toast "Filed".
3. Look for the SAFE in `Investors` → It is not there. Uploads always go to the root (`upload-toasts.ts:94-95`, `lib/data-room.ts:49`). The list reloads with the folder still selected and does not show it.
4. Click "All items" → The SAFE appears with no folder (or, with consent, is later filed wherever the classifier chooses).

##### Edge Cases
- Without consent the SAFE stays in "no folder" forever unless moved by hand.

### Stories: Processing and consent

#### STORY-DRM-007: Watch a new document get read and filed

**Type**: medium
**Topic**: Ingestion status
**Persona**: Founder who just uploaded the pitch deck and wants to know if the app "understood" it.
**Goal**: See the document go from uploaded to tagged and filed.
**Preconditions**: S1; model state M1 or M2; Data room consent recorded (seeded via API); walker has `MOCK Northwind pitch deck.pdf`.
**Ideal path**: 2 — upload, then see a single clear status until done.
**Alternate paths**: none found.

##### Steps
1. Upload the deck (any upload path) → New row at the top (sort "Recently added"), Type column "Pending".
2. Wait a few seconds → Type column changes to "Reading" (extracting), then "Filing" (classifying and indexing). The list polls every 3 s (`use-data-room-list.ts:26`). **Misread risk:** "Filing" covers two steps, including search indexing; the folder may already be set while it still says "Filing".
3. Hover the row → Preview shows the status line ("Reading"/"Filing") instead of a summary.
4. When done → Type shows a lowercase value such as "presentation"; Date and Parties fill in; the preview shows a summary, Tags, and Folder (for example `Investors`).
5. Check the folder tree → A folder proposed by the classifier may be new; the founder did not create it.

##### Variations
- Model M2 (embedding model set) vs M1: identical visible flow; only search quality differs.

##### Edge Cases
- Founder navigates away during "Reading": processing continues in the background; no notification when it completes.

#### STORY-DRM-008: A document failed to process

**Type**: short
**Topic**: Ingestion status / errors
**Persona**: Founder scanning the list who sees a red row.
**Goal**: Understand what went wrong and fix it.
**Preconditions**: S1 + S2.
**Ideal path**: 2 — see the reason, click retry.
**Alternate paths**: Re-upload the identical file, which restarts a failed item (`apps/api/src/data-room.ts:400-406`); undocumented.

##### Steps
1. Spot `Old cap table export.xlsx` → Red marker icon and red Type cell reading "Failed"; the reason appears only as a hover tooltip.
2. Click the row → Preview shows "Could not read this file" in red.
3. Look for "Try again" → None in the preview or the "…" menu (only Move, Rename, Delete).
4. Decide to delete and re-upload, or give up.

##### Variations
- `Customer NDA - MOCK Bolt Freight.pdf` (ready with error) → preview shows grey "Couldn't classify" under the name; no reason, no action.

#### STORY-DRM-009: "Why didn't it tag anything?" (consent never asked)

**Type**: medium
**Topic**: Consent prompt
**Persona**: Founder who uploaded five documents yesterday and expected them sorted into folders.
**Goal**: Get the app to read and organise the documents.
**Preconditions**: S3 (five ready, unclassified items, no folders); model state M1; NO Data room consent recorded; general "AI data sharing" switches may be on.
**Ideal path**: 2 — see a prompt explaining what is sent, click Allow, watch items get filed.
**Alternate paths**: Settings > "AI data sharing" switches (`components/AiDataSharing.tsx:57-118`) look relevant but control a different consent key; the Data room requires its own `data-room:` key (`packages/adapters/src/data-room-models.ts:91-111`).

##### Steps
1. Open Data room → Five rows, Type/Date/Parties empty, folder tree shows only "All items". No banner, no prompt.
2. Click a row → Preview shows name, Folder "None", Source "Upload", Size, Download. No summary, no "Couldn't classify" (the skip writes no error, `packages/adapters/src/data-room-jobs.ts:323-328`).
3. Look for a setting → Opens Settings, finds "AI data sharing" with per-model switches; turns the model on.
4. Return to Data room → Nothing changes; items stay unclassified. **This is the expected dead end in the current code**: no web UI calls `dataRoom.consent` or `dataRoom.consentGrant`.
5. Founder concludes the feature is broken or that filing is not real.

##### Variations
- M0 (no model at all): same visible result; nothing says "Choose a model first".
- Walk harness only: grant consent through the API, then reload → items move through "Reading"/"Filing" and get folders (STORY-DRM-010).

##### Edge Cases
- After consent is granted, changing the default model or embedding model changes the consent key, so consent silently lapses for new uploads.

#### STORY-DRM-010: Let the app sort documents into folders

**Type**: medium
**Topic**: Automatic filing
**Persona**: Founder who expects "drop it in, it goes to the right folder".
**Goal**: Upload an invoice and find it in a sensible folder without choosing one.
**Preconditions**: S1; model M1; Data room consent recorded; walker has a mock invoice PDF from "MOCK Acme Servo Supply".
**Ideal path**: 1 — drop the file; it appears in the right folder.
**Alternate paths**: Manual Move (STORY-DRM-016).

##### Steps
1. Drop the invoice anywhere → Toast "Filed".
2. Open the Data room → Row at the top shows "Reading", then "Filing".
3. After processing → Folder column is not in the list; the founder must open the preview to see Folder (likely `Finance / Invoices`).
4. Click `Finance` > `Invoices` in the tree → The invoice is listed with the other Acme invoices.

##### Variations
- Classifier proposes a new path (for example `Finance / Vendor bills`) → a new folder appears that duplicates the intent of `Invoices`. No way in the UI to merge or delete folders.

##### Edge Cases
- Item was manually moved before classification finished → auto-filing only applies when the item has no folder (`packages/db/src/data-room.ts:776`), so the manual choice is kept.

### Stories: Browsing and finding

#### STORY-DRM-011: Browse folders to find the bank statement

**Type**: short
**Topic**: Folder tree / picker
**Persona**: Founder asked by their accountant for September's bank statement.
**Goal**: Find it by browsing.
**Preconditions**: S1; desktop width at least 800 px for the tree.
**Ideal path**: 2 — click folder, click file.
**Alternate paths**: Search "statement" (STORY-DRM-013); Type filter "statement"; narrow window folder picker pill (`FilterBar.tsx:292-321`).

##### Steps
1. Open Data room → First item is auto-pinned in the preview on the right; folder tree on the left shows "All items", `Finance`, `Bank statements` (indented), `Invoices`, `HR`, `Investors`, `Legal`, `Contracts`.
2. Click `Finance` → **Misread risk:** the founder expects to see the statement under Finance, but selecting a parent folder may show only items directly in it (verify during walk whether sub-folder items are included).
3. Click `Bank statements` → `Mercury statement 2026-09.pdf` listed and pinned.
4. Click "Download" in the preview → Browser downloads the PDF; it is never opened inline.

##### Variations
- Narrow window (<800 px): no tree; a pill reading "All items" with a folder icon opens a radio menu of paths such as "Finance / Bank statements".
- Folders cannot be collapsed; every level is always shown.

#### STORY-DRM-012: Switch to grid and change the sort

**Type**: short
**Topic**: Views and sort
**Persona**: Founder who thinks visually and wants the newest-dated contracts first.
**Goal**: See documents as tiles ordered by document date.
**Preconditions**: S1.
**Ideal path**: 2 — choose grid, choose date sort.
**Alternate paths**: none found.

##### Steps
1. Click the grid icon (aria "Grid view") → Tiles with name and type.
2. Open "Sort: Recently added" → Options Date, Name, Type, Recently added. **Misread risk:** "Date" means the date written in the document, not upload date; items without one go last in both directions.
3. Choose "Date" and click the arrow to flip direction → Order changes.
4. Reload the page → View is back to list and sort back to "Recently added" (state is not kept, `DataRoom.tsx:69-74`).

#### STORY-DRM-013: Search for the lease

**Type**: short
**Topic**: Search
**Persona**: Founder on a call with the landlord who needs the renewal terms now.
**Goal**: Find the lease by typing.
**Preconditions**: S1; M1 (keyword) or M2 + consent (semantic).
**Ideal path**: 1 — type "lease", see it.
**Alternate paths**: Browse `Legal / Contracts`; Party filter "MOCK Pier 9 Properties".

##### Steps
1. Type "lease" in "Search documents" → After ~300 ms the list becomes results with highlighted snippets and a "folder · source" line. Grid/list toggle no longer applies.
2. The sort pill changes to "Sort: Relevance" with options Relevance and Date only; the direction arrow is disabled for Relevance.
3. Try a question: "when does our office lease end" → Keyword search may return nothing; with M2 + consent semantic search should find it. Nothing tells the founder which mode is active.
4. Clear the box → List view returns with the previous sort.

##### Edge Cases
- No match → "No results" (no suggestion to clear filters if filters are also set).

#### STORY-DRM-014: Show all invoices from one vendor

**Type**: medium
**Topic**: Facet filters
**Persona**: Founder reconciling hardware spend with MOCK Acme Servo Supply.
**Goal**: List every Acme invoice.
**Preconditions**: S1 (two Acme invoices, classified).
**Ideal path**: 2 — pick type "invoice", pick vendor.
**Alternate paths**: Folder `Finance / Invoices`; search "Acme".

##### Steps
1. Click "Type" chip → Popover with a text box and "Apply"; suggestions come only from rows currently loaded.
2. Type "Invoice" (capital I) and Apply → Chip reads "Type: Invoice"; result "No results". **Likely failure:** the stored value is lowercase "invoice" and the filter is an exact match (`packages/db/src/data-room.ts:151`, `:175`).
3. Remove the chip (X), retry with the suggested "invoice" → Both Acme invoices plus any other invoices.
4. Click "Party", type "Acme" → "No results" again, because the party filter needs the full exact name "MOCK Acme Servo Supply".
5. Pick the full name from the suggestions → Two invoices remain.

##### Variations
- "Source" chip: pick "Google Drive" or "Gmail" → always "No results" in the current build because no import exists.

#### STORY-DRM-015: Contracts signed last quarter

**Type**: medium
**Topic**: Date filter
**Persona**: Founder preparing a quarterly update.
**Goal**: See contracts dated July–September 2026.
**Preconditions**: S1 + S3 (some items with no document date).
**Ideal path**: 3 — type, date range, done.
**Alternate paths**: Sort by Date and scan.

##### Steps
1. Click "Date" → Popover with "From" and "To" date inputs and "Apply".
2. Set 2026-07-01 to 2026-09-30, Apply → Chip shows "Jul 1, 2026 – Sep 30, 2026".
3. Add Type "contract" → Only contracts with a document date in range.
4. Notice an unclassified contract is missing → items without a document date are excluded; nothing says the filter uses the document date, not upload date.

### Stories: Editing and housekeeping

#### STORY-DRM-016: Rename a scan and move it to the right folder

**Type**: medium
**Topic**: Rename / Move
**Persona**: Founder cleaning up `Scan 0007.jpg`, which is actually the Delaware incorporation certificate.
**Goal**: Give it a real name and put it under `Legal`.
**Preconditions**: S1 + S2 (scan is `ready` by now or still `classifying`).
**Ideal path**: 3 — rename, move, confirm.
**Alternate paths**: "…" on the row, "…" in the preview header, "…" on a grid tile; all open the same dialogs.

##### Steps
1. Hover the row and click "…" (aria "More actions for Scan 0007.jpg") → Menu Move / Rename / Delete.
2. Rename → Dialog "Rename" with the name field; type `Delaware certificate of incorporation (MOCK).jpg`; Save.
3. Type a name with a slash, e.g. `Legal/Delaware cert` → Error "Enter a name without slashes". **Hesitation:** founder tried to rename and move in one go.
4. "…" → Move → Dialog "Move" with a native select: "No folder", then paths like "Legal / Contracts"; choose "Legal"; Save.
5. Preview updates: Folder "Legal".

##### Variations
- Founder wants a new folder `Legal / Corporate` → no "New folder" anywhere (API `folderCreate` exists, no UI).
- Renaming a file to drop its extension → allowed; the download keeps the new name with no extension.

#### STORY-DRM-017: Delete a duplicate document

**Type**: short
**Topic**: Delete
**Persona**: Founder who sees two versions of the term sheet.
**Goal**: Remove the old one.
**Preconditions**: S1 plus an extra `Northwind - Series A term sheet v2.pdf` in `Investors`.
**Ideal path**: 2 — delete, confirm.
**Alternate paths**: Row "…", preview "…", grid tile "…".

##### Steps
1. "…" → Delete → Alert "Delete Northwind - Series A term sheet v2.pdf?" with Cancel / Delete. No text says it is permanent.
2. Delete → Dialog closes, list reloads, preview closes if it showed that item.
3. Look for undo or a trash → None; the file and its search index are gone and the stored file is removed about a minute later.

### Stories: Long end-to-end stories

#### STORY-DRM-018: First week: set up the company's document library

**Type**: long
**Topic**: Onboarding to the Data room, end to end
**Persona**: Solo founder of Northwind Robotics, first session, with ~10 PDFs (incorporation docs, a SAFE, invoices, an offer letter) and a 60 MB video in a desktop folder.
**Goal**: Have every company document in one searchable place, sorted into folders.
**Preconditions**: S0; model M1; Data room consent NOT recorded (realistic first-run); walker files listed above.
**Ideal path**: 5 — open the room, allow reading, drop all files, see them filed, search once.
**Alternate paths**: Upload via "Choose files", "+", page drop, drop anywhere.

##### Steps
1. Sign in; look for "Documents" in the sidebar → Finds "Data room" after scanning (STORY-DRM-001 hesitation).
2. Click it → Empty box "Drop files here" / "Choose files".
3. Select all ten PDFs plus the video in Finder and drag them onto the box → Overlay "Drop to add to Data room"; drop.
4. Toasts stack bottom-right: ten progress bars, one red "Over the 50 MB limit" for the video.
5. Toasts turn to "Filed" one by one and disappear after 8 s → Founder believes everything is filed into folders.
6. List shows ten rows, statuses "Pending" → "Reading" → "Filing".
7. After processing, rows are `ready` but Type, Date, Parties are blank and the folder tree has only "All items" (no consent, STORY-DRM-009).
8. Founder clicks a row → Preview: Folder "None", no summary.
9. Founder looks for a "New folder" button to organise by hand → none.
10. Opens Settings, turns on the model under "AI data sharing" → no effect on the Data room.
11. Returns, tries search "SAFE" → keyword search finds the SAFE by its text (search works without consent).
12. Uses "…" → Move on each file → only "No folder" exists in the select, so nothing can be moved anywhere.
13. Outcome in current code: documents are stored and keyword-searchable but never organised; the founder cannot fix this from the UI.
14. (Harness variant) Grant consent via API, reload → items go back through "Reading"/"Filing", folders such as `Legal`, `Investors`, `Finance / Invoices`, `HR` appear, rows get types and dates.
15. Founder opens `Investors` → SAFE is there; confirms the room is now organised.
16. Switches to grid view to admire it; reloads the next day → back to list view.

##### Edge Cases
- One PDF is image-only (scanned): with a vision-capable model and consent it is read; otherwise it is `ready` with no text and cannot be found by search.

#### STORY-DRM-019: Answer an investor's diligence request

**Type**: long
**Topic**: Search, filters, download, sharing expectation
**Persona**: Founder in Series A diligence; MOCK Harbor Ventures asked for "all customer contracts, the cap table, last three bank statements, and board minutes".
**Goal**: Collect and send those documents.
**Preconditions**: S1 + S2 + three monthly statements (July–September) in `Finance / Bank statements`; model M2; consent recorded.
**Ideal path**: 6 — four searches or filters, select all, share one link.
**Alternate paths**: Folder browsing for each item; Type filter; Source filter.

##### Steps
1. Open Data room → auto-pinned newest item in preview.
2. Type Type filter "contract" → contracts listed; the founder must download each one from its preview ("Download"); no multi-select or bulk download.
3. Clear filter; search "cap table" → `Old cap table export.xlsx` shows as Failed; preview has no retry (STORY-DRM-008). Founder downloads it anyway via "Download".
4. Clear search; click `Finance / Bank statements` → three statements; sort "Date" descending; download each.
5. Search "board minutes" → `Board minutes Q2 2026.pdf` (no folder) found; download.
6. Look for "Share" or "Invite investor" → nothing. The word "Data room" set the expectation of an investor-facing room; the code is owner-only (`docs/data-room/README.md:53-55`).
7. Founder attaches the downloaded files to an email in Inbox compose (separate feature; 20 files / 10 MB total cap there) and likely hits the 10 MB attachment limit with statements plus contracts.
8. Outcome: task completed outside the Data room, with many repeated downloads.

##### Edge Cases
- The investor asks for "everything from Harbor Ventures": Party filter needs the exact stored name "MOCK Harbor Ventures".

#### STORY-DRM-020: Monthly close: get vendor invoices out of Gmail into the Data room

**Type**: long
**Topic**: Gmail attachment import (gap) + upload + filters
**Persona**: Founder doing month-end bookkeeping; invoices arrive as Gmail attachments.
**Goal**: Have this month's invoices in `Finance / Invoices` next to last month's.
**Preconditions**: S1; mock Gmail connected with thread "MOCK Acme Servo Supply – invoice NW-1044" (PDF attachment); M1; consent recorded.
**Ideal path**: 2 — "Save to Data room" on the attachment; it gets filed.
**Alternate paths**: Download the attachment from the Inbox message, then drop it anywhere (the only working route). The "Source: Gmail" filter option suggests a direct route exists; it does not.

##### Steps
1. Open Data room, open "Source" chip → sees "Gmail" and "Google Drive" listed and assumes Gmail is connected to the Data room.
2. Choose "Gmail" → "No results".
3. Look for "Import from Gmail" or "Connect" on the Data room → none.
4. Go to Inbox, open the Acme thread → message dialog with the attachment; look for "Save to Data room" → none; only download.
5. Download the PDF, then drag it from the browser's download bar onto the app → overlay "Drop to add to Data room", toast "Filed".
6. Return to the Data room → new row, "Reading" → "Filing"; source icon is "Upload", not Gmail.
7. After filing, open `Finance / Invoices` → three Acme invoices.
8. Apply Type "invoice" and Date 2026-10-01 to 2026-10-31 → the new one only.
9. Ask the Inbox agent "save this invoice to my data room" → no Data room tool exists; the agent cannot do it.
10. Outcome: works only through download and re-upload; "Source: Gmail" never matches anything in this build.

#### STORY-DRM-021: Bring in the company's Google Drive

**Type**: medium
**Topic**: Google Drive import (gap)
**Persona**: Founder whose legal docs already live in a shared Google Drive.
**Goal**: Connect Drive so those files appear in the Data room.
**Preconditions**: S1; Google account connected under Integrations (Drive scopes) or not.
**Ideal path**: 3 — Connect Drive, pick folders, see them appear.
**Alternate paths**: Agents can use `drive_search` / `drive_read` tools on Drive directly (`packages/adapters/src/builtin-tools.ts:949-1010`), but results never enter the Data room.

##### Steps
1. Open "Source" chip, sees "Google Drive" → chooses it → "No results".
2. Look for a connect button on the Data room → none.
3. Open Integrations, connect Google → Drive tools become available to agents; Data room unchanged.
4. Outcome: no Drive sync exists (planned phase 4, `docs/data-room/README.md:207`). Only manual download and upload works.

#### STORY-DRM-022: Share the Data room with a cofounder

**Type**: short
**Topic**: Sharing (gap)
**Persona**: Founder whose cofounder joined the space and needs the same documents.
**Goal**: Let the cofounder see the documents.
**Preconditions**: S1; a second member "MOCK Sam Okafor" in the same space.
**Ideal path**: 2 — share folder, pick member.
**Alternate paths**: none found.

##### Steps
1. Look for "Share" in the preview, "…" menu, or folder tree → none.
2. Cofounder signs in and opens Data room → sees their own (empty) Data room. V1 shows items only to the person who added them.
3. Outcome: founder must download and send files.

#### STORY-DRM-023: Ask an agent about a contract

**Type**: medium
**Topic**: Agent tools over documents (gap)
**Persona**: Founder who wants a quick answer: "What's the notice period in our office lease?"
**Goal**: Get the answer from the stored lease without reading it.
**Preconditions**: S1; M2; consent recorded; any chat agent in the space.
**Ideal path**: 2 — click "Ask agent" on the preview, ask.
**Alternate paths**: Data room search with a question (semantic search returns a snippet, STORY-DRM-013); Download and read.

##### Steps
1. Open the lease preview, look for "Ask" or "Chat about this" → none (planned "Ask agent", `docs/data-room/README.md:186-188`).
2. Open a chat with an agent and ask about "our office lease" → the agent has no `search_data_room` or `read_data_room_item` tool; it says it cannot see the document or asks for an upload.
3. Founder attaches the PDF to the chat instead → works through the chat attachment path, a separate copy outside the Data room.
4. Back in Data room, search "lease notice period" → with semantic search a snippet may show the clause highlighted.

### Gaps & Recommendations
- No stories for mobile; the Data room is not built there.
- Planned features (Data room agent, Ask agent, agent tools, Drive/Gmail sync, sharing) appear only as gap stories (STORY-DRM-020 to STORY-DRM-023). Re-run this catalog when they ship.
- Verify during the walk: whether selecting a parent folder includes sub-folder items (STORY-DRM-011), and whether sidebar space search includes Data room items.

---

## Area: App shell (STORY-APP-nnn)

Source: `docs/ux-paths/app/catalog.md`.


Generated: 2026-10-16
Repository: `rakazo-ux`, branch `docs/ux-pass` (tracks `origin/main`). All file:line references are to `apps/web/src/` unless another root is given.
Total Stories: 25 (13 short, 9 medium, 3 long)
Scope: sign-up and onboarding, sidebar and navigation, Chief and bot chats (composer, hover actions, replies, reactions, tables), command palette, notifications, Integrations (gaps only), Settings (account, model, keys, billing, usage), team/members, and moving between features.

### How this catalog relates to the earlier one

The earlier catalog (`ux-paths-today/catalog.md`, stories STORY-001 to STORY-066) already covers the Data room, mail approval card, Inbox rows, the @mention picker and most of the Integrations catalog flow (connect, reconnect, per-agent access, search chips, member view). This catalog does not repeat those. It points to them by their old id (for example "prior STORY-058") and adds only:

- Integrations: removing/disconnecting, custom MCP servers, the separate "Server integrations" setup page.
- Everything else in the shell, which the earlier catalog did not cover.

New ids use the prefix `APP-` so they cannot collide with the earlier `STORY-` ids.

### Persona (applies to every story)

Maya Chen, cofounder and CEO of "MOCK DEMO DATA — Northwind Robotics" (a 9-person warehouse-robotics startup). She has never seen Rakazo or its code. She does not know the words "bot", "space", "group", "MCP", "routine", "artifact", "provider" or "thinking". She wants one place to run the company: read email, know the cash position, keep the cap table and investor documents straight, and hand repeat work to someone (or something) reliable. Stories record what she would try in her own words and where she would likely hesitate. Hesitation points are marked **[Hesitation]**.

### Mock demo data required (shared seed)

Every story lists its own preconditions, but they all draw from this one seeded account. Every user-visible string in the seed must start with or contain `MOCK DEMO DATA` so a walker never mistakes it for real data.

| Seed item | Value |
|---|---|
| User | Maya Chen, `maya@northwind.example` (MOCK DEMO DATA), password set |
| Space | "MOCK DEMO DATA — Northwind Robotics" (default space) |
| Model | A working model already connected (so onboarding skips "Connect a model") except in STORY-APP-001 variant B |
| Bots | "Chief" (first bot, onboarding finished, focus "Day-to-day work"), "MOCK Finance helper" (title "Finance"), "MOCK Hiring helper" (title "Recruiting"), archived bot "MOCK Old intern bot" |
| Group | "MOCK DEMO DATA — Leadership" containing Chief and MOCK Finance helper |
| Section | Sidebar section "MOCK Ops" containing MOCK Hiring helper |
| Chief thread | 12+ messages, including one assistant reply with a Markdown table of 14+ rows ("MOCK DEMO DATA monthly burn by category"), one message with an existing 👍 reaction, one user message that is a reply to an earlier assistant message |
| Integrations | Gmail connected as `maya@northwind.example` (MOCK), Slack connected (MOCK workspace), one custom MCP server "MOCK DEMO DATA Docs MCP" at `https://mcp.mock-northwind.example/sse` |
| Inbox | 20 cached MOCK messages, 3 unread |
| Finance / Cap Table / Data room | At least one MOCK account balance, one MOCK cap table, 3 MOCK documents ("MOCK DEMO DATA — Seed SAFE.pdf", etc.) |
| Artifacts | 2 MOCK artifacts produced by Chief ("MOCK DEMO DATA — Q3 investor update draft") |
| Activity | 1 running run, 1 "Needs input" run, 4 finished runs |
| Billing | Billing enabled on the server, subscription in Trial (for STORY-APP-022); a second account with no subscription for STORY-APP-004 |

### Summary

| Type | Count |
|---|---|
| Short | 13 |
| Medium | 9 |
| Long | 3 |

### Coverage matrix

| Feature area | Stories | Gaps |
|---|---|---|
| Welcome, sign-up, sign-in, password reset | STORY-APP-001, STORY-APP-003 | SSO ("Continue with {name}") only as a variation; email-verification "Check your email" only as an edge case |
| Onboarding (model, server integrations, Chief focus card, connect cards) | STORY-APP-001, STORY-APP-002 | OAuth "subscription sign-in" model path only as a variation |
| Subscription gate / Paywall | STORY-APP-004 | None |
| Sidebar: page links, bot list, sections, archived, search, collapse | STORY-APP-005, STORY-APP-006, STORY-APP-007, STORY-APP-009, STORY-APP-010 | Sidebar density covered in STORY-APP-021 |
| Create bot / group / space | STORY-APP-010, STORY-APP-011 | Bot "Duplicate" and "Export" only as variations |
| Command palette | STORY-APP-008 | None (it only lists bots) |
| Chat composer (send, stop, attach, voice, skills, jump to latest) | STORY-APP-012, STORY-APP-015 | Voice dictation not walked end to end; Call card not covered |
| Message hover actions, reactions, replies | STORY-APP-013 | None |
| Chat tables | STORY-APP-014 | None |
| @mentions | STORY-APP-015 (group delegation); prior STORY-053..055 | None |
| Notifications and Activity | STORY-APP-016 | Desktop (Electron) notifications not covered |
| Integrations: catalog/connect/reconnect/agent access | prior STORY-056..066 | Not repeated here |
| Integrations: disconnect/remove, MCP servers, Server integrations | STORY-APP-017, STORY-APP-018, STORY-APP-019 | Local (command) MCP servers only as a variation |
| Settings: account, appearance, language, password | STORY-APP-021 | Messaging settings only linked, not walked |
| Settings: models and API keys | STORY-APP-020 | Model backups not covered |
| Settings: billing and usage | STORY-APP-022 | None |
| Team / members | STORY-APP-023 | Feature does not exist; story records the expected failure |
| Moving between features end to end | STORY-APP-024, STORY-APP-025 | Board (feature-flagged) not covered |

### Story dependency graph

```text
STORY-APP-001 (Sign up → first chat with Chief)
├── STORY-APP-002 (Focus card choices)
├── STORY-APP-005 (Orient in the sidebar)
│   ├── STORY-APP-006 (Artifacts vs Data room)
│   ├── STORY-APP-007 (Sidebar search)
│   ├── STORY-APP-008 (Command palette)
│   └── STORY-APP-009 (Hide/show sidebar, phone)
├── STORY-APP-010 (Create and organize a bot)
│   ├── STORY-APP-011 (Groups and spaces)
│   │   └── STORY-APP-015 (@mention a group)
│   └── STORY-APP-016 (Notifications and Activity)
├── STORY-APP-012 (Chat with Chief)
│   ├── STORY-APP-013 (React, reply, copy)
│   └── STORY-APP-014 (Tables)
├── STORY-APP-017 / STORY-APP-018 / STORY-APP-019 (Integrations gaps; after prior STORY-058)
├── STORY-APP-020 / STORY-APP-021 / STORY-APP-022 (Settings)
├── STORY-APP-023 (Invite a cofounder — not possible)
└── STORY-APP-024, STORY-APP-025 (long end-to-end; need the full seed)
STORY-APP-003 (Sign in again) and STORY-APP-004 (Paywall) need only an existing account.
```


### Stories: Sign-up and onboarding

#### STORY-APP-001: Maya signs up and gets to her first useful chat

**Type**: long
**Topic**: Sign-up and onboarding
**Persona**: Naive first-time founder (Maya Chen)
**Goal**: "Create an account and get something that helps me run Northwind."
**Preconditions**: No account for `maya.new@northwind.example` (MOCK). Variant A: the server already has a model configured and no server integrations need setup (`me.needsModel=false`, `integrations.needsSetup=false`). Variant B: no model configured. Variant C: Maya is the deployment owner and server integrations need setup. Composio (managed apps) configured so Chief's connect cards work.
**Ideal path**: 5 — Sign up → name/email/password → Create account → pick a focus → connect one app. A product for founders should not need model or server setup in the first minute.
**Alternate paths**: `/sign-in` → "Don’t have an account? Sign up" (`pages/Auth.tsx:296-300`); direct `/sign-up`. After sign-up the router forces `/onboarding` (`App.tsx:143`).

##### Steps
1. Open `/`. Sees "Rakazo" and "Your team of always-on agents that you can give real work to." with "Sign up" and "Sign in" (`pages/Welcome.tsx:19-42`). → Thinks "agents?" but clicks Sign up. **[Hesitation]** Nothing says what the agents do for a company.
2. On "Create your Rakazo" (`pages/Auth.tsx:45`), fills Name "Maya Chen", Email "maya.new@northwind.example", Password. → Fields accept input; eye button toggles "Show password".
3. Clicks "Create account". → Redirects to `/onboarding`, shows "Loading…".
4. Variant B only: sees "Connect a model" with "Provider", "Server URL", "Find models", "Model", "Thinking", "Advanced" (`pages/Onboarding.tsx:563-760`). **[Hesitation]** Maya does not know what a provider or a model is, or which one to choose; she expects the product to come with one. She may pick the first provider and look for where to paste a key ("API key", "Optional").
5. Variant B: clicks "Continue" (`pages/Onboarding.tsx:1020`). → Saves, or shows "Could not save model".
6. Variant C only: sees "Server integrations" with options including "Direct MCP", fields "Client ID", "Project ID", "Client secret", "Redirect URI", "Get credentials", and "Skip" (`components/integrations/IntegrationSetup.tsx:49-406`). **[Hesitation]** Maya cannot tell if this is required. Expected: she clicks "Skip".
7. Sees "Opening chat…" (`pages/Onboarding.tsx:1046`). → Lands on `/app/<chiefId>`; a bot named "Chief" (`pages/Onboarding.tsx:60`) greets her: "Hi Maya, I'm Chief, and I'm a blank slate right now, so you get to decide what I become…" (`apps/api/src/onboarding.ts:108`).
8. Sees the card "What do you want me on first?" with A "Day-to-day work", B "Inbox & email", C "Research & writing", D "A bit of everything" (`pages/shell/message-cards.tsx:116-140`). **[Hesitation]** None says "run my company", "finance" or "investors". She picks A.
9. Chief replies "Got it. Slack, calendar, and email…" then shows connect cards for Slack, Gmail, Google Calendar (`apps/api/src/onboarding.ts:260-318`).
10. Clicks the Gmail card. → A sign-in popup opens (`rpc.connections.begin`, `message-cards.tsx:58`). Completes Google consent with the MOCK account. → Card shows "Connected".
11. Closes the Slack card's popup without finishing. → After the wait, "Authorization timed out. Please try again." (`message-cards.tsx:81`).
12. Types in the composer ("Message Chief"): "What should I look at first today?" and presses Enter. → Message appears; Chief streams a reply; "Stop" appears while it runs.
13. Looks at the sidebar: Inbox (with unread count), Finance, Cap Table, Data room, then Chief in the bot list, then Integrations and her name at the bottom. → She now knows where the main areas are.

##### Variations
- SSO configured: "Continue with {name}" button replaces/augments the email form (`pages/Auth.tsx:186,292`).
- Email verification required: "Check your email" title after Create account (`pages/Auth.tsx:41,110`); she must click the link before step 4.
- Variant B with a ChatGPT subscription provider: OAuth sign-in with a code to paste back ("Authorization code or callback URL", "Submit", `pages/Onboarding.tsx:819-828`).

##### Edge cases
- Bot creation fails: "Could not create your bot" and "Try again" (`pages/Onboarding.tsx:546,1041`).
- Two tabs open onboarding: a Web Lock plus a spawn key keep only one Chief (`pages/Onboarding.tsx:106-115`).
- Already signed in and visiting `/sign-up`: redirected straight to `/onboarding` (`App.tsx:143`).

#### STORY-APP-002: Maya looks for a "run my company" option on the focus card

**Type**: short
**Topic**: Sign-up and onboarding
**Persona**: Naive first-time founder
**Goal**: "Tell the assistant I want help with finance, the cap table and investor docs."
**Preconditions**: Fresh Chief thread with the unanswered focus card (onboarding started, not chosen). MOCK space "MOCK DEMO DATA — Northwind Robotics".
**Ideal path**: 2 — read the choices, pick "Company operations" (or type it). The real UI has no such choice.
**Alternate paths**: Dismiss the card (`rpc.onboarding.dismissFocus`, `message-cards.tsx:46`) and type a free-text request instead.

##### Steps
1. Reads A–D on "What do you want me on first?". → None mentions finance, cap table or investors, though the sidebar shows Finance, Cap Table and Data room. **[Hesitation]**
2. Picks D "A bit of everything". → Chief offers Slack, calendar and email, the same apps as A (`apps/api/src/onboarding.ts:56-62` vs `:35-40`). Maya may think her choice was ignored.
3. Alternative: dismisses the card and types "Help me keep the cap table and investor updates straight". → Card disappears; normal chat reply.

##### Variations
- She picks C "Research & writing": Chief suggests Hacker News, Notion, Google Docs. Hacker News looks odd for a company operator.

##### Edge cases
- Choosing fails: "Could not save this choice" (`message-cards.tsx:37`); dismiss fails: "Could not dismiss".

#### STORY-APP-003: Maya signs in on a new laptop and forgets her password

**Type**: short
**Topic**: Sign-up and onboarding
**Persona**: Returning founder
**Goal**: "Get back into my account."
**Preconditions**: Maya's MOCK account exists; password reset configured on the server.
**Ideal path**: 4 — Sign in → Forgot password? → email → set new password.
**Alternate paths**: `/forgot-password` directly. From Settings, "Change password" only when already signed in (STORY-APP-021).

##### Steps
1. `/sign-in`: "Sign in to Rakazo", Email, Password, "Continue with email" (`pages/Auth.tsx:43,276`). Wrong password → error text from `authErrorText`.
2. Clicks "Forgot password?" (`pages/Auth.tsx:261`). → "Reset your password", "Send reset link".
3. Opens the reset email link → "Choose a new password", "New password", "Confirm password", "Reset password" (`pages/Auth.tsx:360-396`).
4. → "Password updated" and "Sign in". Signs in → lands on `/app` (or the `next` destination).

##### Variations
- Reset not configured: "Password recovery is not configured for this server" (`pages/Auth.tsx:83`); the "Forgot password?" link is hidden when `passwordReset` is false (`:258`).

##### Edge cases
- Expired link: "This reset link is invalid or expired" (`pages/Auth.tsx:332`).
- Server unreachable: "Could not reach the server". A signed-in user whose session lookup fails sees a retry screen, not sign-in (`App.tsx:114,201-210`).

#### STORY-APP-004: A founder without a subscription hits the paywall

**Type**: short
**Topic**: Sign-up and onboarding
**Persona**: Naive first-time founder
**Goal**: "Start using it."
**Preconditions**: Billing enabled; MOCK account "MOCK DEMO DATA — Paywall tester" with no subscription.
**Ideal path**: 2 — Start trial → back in the app.
**Alternate paths**: "Manage billing" on the paywall; Settings → Billing → "Manage" after a subscription exists (STORY-APP-022).

##### Steps
1. Signs in. → Any `/app` route or `/onboarding` is wrapped by `SubscriptionGate` (`App.tsx:167-176`) and shows the Paywall: "Subscription required", bullets "Bots with their own computer and browser", "Routines that run while you're away", "Any model, with your own key", "Web, desktop and mobile apps" (`pages/Paywall.tsx:39-47`). **[Hesitation]** "Any model, with your own key" suggests she must also bring a key.
2. Clicks "Start {n}-day free trial" (`pages/Paywall.tsx:76`). → Opens billing checkout.
3. Returns. → Onboarding or app loads.

##### Variations
- No trial configured: button reads "Subscribe".
- "Log out" on the paywall (`:105`).

##### Edge cases
- Checkout cannot open: "Could not open billing" (`:30`).

### Stories: Sidebar and navigation

#### STORY-APP-005: Maya orients herself in the sidebar

**Type**: medium
**Topic**: Navigation
**Persona**: Naive first-time founder
**Goal**: "Figure out where email, money, equity and documents live, and what everything else is."
**Preconditions**: Full shared seed (Chief, two MOCK helpers, Leadership group, MOCK Ops section, archived bot, 3 unread mails).
**Ideal path**: 1 — one glance at a labeled sidebar.
**Alternate paths**: Command palette lists bots only (STORY-APP-008). Artifacts, Settings and Usage are only in the user menu.

##### Steps
1. Reads the top row: a bell, a panel icon, and "+" (`pages/Shell.tsx:3203-3240`). Hovers the bell → tooltip "Activity". **[Hesitation]** She expects a bell to mean notifications (see STORY-APP-016).
2. Reads the "Search" box, then Inbox (badge "3"), Finance, Cap Table, Data room (`pages/Shell.tsx:3286-3350`). → Clicks each; the main area changes; the link is highlighted.
3. Below: bot list with "MOCK DEMO DATA — Leadership" group, "MOCK Ops" section, Chief and helpers. → Clicks Chief; chat opens at `/app/<id>`.
4. At the bottom: "Integrations", then her initials and "Maya Chen" (`pages/Shell.tsx:3836-3866`).
5. Clicks her name → menu: "Artifacts", "Settings", "Usage", "Log out" ("Board" only if the flag is on) (`pages/Shell.tsx:3870-3932`). **[Hesitation]** "Artifacts" is not near Data room even though both are documents, and both use the same folder icon (`:3344`, `:3894`).
6. Scrolls to "Archived" → sees "MOCK Old intern bot" with "Restore" and "Delete" (`pages/Shell.tsx:3760-3796`).

##### Variations
- Feature-flagged Board appears in the user menu, not the sidebar.
- Same information on several surfaces: bot name/title/preview appears in the sidebar row, the command palette row and the chat header.

##### Edge cases
- No bots in the space: main area shows only "Create new Bot" (`pages/Shell.tsx:4137-4143`).

#### STORY-APP-006: Maya looks for the investor update Chief made last week

**Type**: short
**Topic**: Navigation
**Persona**: Naive first-time founder
**Goal**: "Find the document Chief wrote for me."
**Preconditions**: Artifact "MOCK DEMO DATA — Q3 investor update draft" exists; Data room holds 3 MOCK documents but not that artifact.
**Ideal path**: 2 — open a documents area → click the file.
**Alternate paths**: Data room (sidebar), Artifacts (user menu, `/app/artifacts`), scroll Chief's thread to the artifact card, sidebar Search for "investor update" (STORY-APP-007).

##### Steps
1. Clicks "Data room" (it says documents). → Sees the 3 MOCK docs, not the update. **[Hesitation]**
2. Searches there for "investor". → No match.
3. Opens the user menu, notices "Artifacts", clicks it. → `/app/artifacts` lists the draft.
4. Opens it at `/app/artifacts/<id>`.

##### Edge cases
- `/app/artifacts` is a separate page (`App.tsx:187`), not `ShellPage`, so the sidebar may not look the same; note whether a way back to Chief is obvious.

#### STORY-APP-007: Maya searches the whole space for "SAFE"

**Type**: short
**Topic**: Navigation
**Persona**: Naive first-time founder
**Goal**: "Find where we talked about the SAFE."
**Preconditions**: A Chief message containing "MOCK DEMO DATA SAFE discount 20%".
**Ideal path**: 2 — type, click result.
**Alternate paths**: Command palette "Search" (bots only, STORY-APP-008); Inbox "Search mail"; Data room search.

##### Steps
1. Types "SAFE" into the sidebar "Search". → Bot list is replaced by results; "Searching…", then hits or "No results" (`pages/SpaceSearch.tsx:16-23`; triggers on any non-empty text, `pages/Shell.tsx:1769-1770`).
2. Clicks the hit. → Jumps to the message in its thread (`jumpToSearchHit`).
3. Clears the box. → Bot list returns.

##### Edge cases
- Four boxes are all labeled "Search" (sidebar, command palette, bot picker in "+", Inbox uses "Search mail") and search different things. **[Hesitation]**

#### STORY-APP-008: Maya tries Cmd+K to "go to" Finance

**Type**: short
**Topic**: Command palette
**Persona**: Founder who uses Linear/Notion and tries Cmd+K out of habit
**Goal**: "Jump to Finance, or to the Finance helper, from the keyboard."
**Preconditions**: Chief, MOCK Finance helper, MOCK Hiring helper exist.
**Ideal path**: 2 — Cmd+K, type "fin", Enter.
**Alternate paths**: Sidebar Finance link; sidebar bot row; Cmd+1..9 while the palette is open.

##### Steps
1. Presses Cmd+K (Ctrl+K elsewhere) (`pages/shell/command-palette-hotkey.ts`, listener `pages/Shell.tsx:2846-2851`). → Dialog with "Search", bot rows with avatar, title badge, subtitle, and shortcut "⌘1"… (`pages/shell/command-palette.tsx:87-155`). Nothing on screen told her this shortcut exists. **[Hesitation]**
2. Types "finance". → Only "MOCK Finance helper" (matches title). The Finance page is not offered.
3. Presses Enter. → Opens that bot's chat.
4. Opens again, presses Cmd+2 → opens the second bot in the list.

##### Variations
- Types "cap table" or "settings": "No bots" (`command-palette.tsx:107`).

##### Edge cases
- Pressing Cmd+K inside the email composer is handled by the rich text editor, which says the app palette "listens higher up" (`components/compose/RichTextEditor.tsx:70-72`); check which one wins.

#### STORY-APP-009: Maya hides the sidebar, then uses Rakazo on her phone

**Type**: short
**Topic**: Navigation
**Persona**: Founder between meetings
**Goal**: "More room for the chat; then check Chief from my phone."
**Preconditions**: Shared seed.
**Ideal path**: 2 per surface.
**Alternate paths**: "Minimize bots" button (`pages/Shell.tsx:3226-3235`); sidebar edge button "Hide bots"/"Show bots" (`:3940-3950`); header "Show bots" (`:4022`).

##### Steps
1. Clicks the panel icon ("Minimize bots"). → Sidebar collapses (saved as a preference).
2. Finds "Show bots" in the chat header to bring it back. **[Hesitation]** Labels say "bots" although the sidebar also holds Inbox, Finance, Integrations and her account.
3. At 390px width: sees "Open navigation" (`:4012`); opens the drawer; taps Inbox → drawer closes. Taps the dark area ("Close navigation", `:3184`) or swipes to close.

#### STORY-APP-010: Maya adds a "Hiring helper" and keeps the sidebar tidy

**Type**: medium
**Topic**: Navigation / bots
**Persona**: Naive first-time founder
**Goal**: "Create a separate assistant for recruiting, name it, and put it under Ops."
**Preconditions**: Shared seed without MOCK Hiring helper; section "MOCK Ops" exists.
**Ideal path**: 3 — New assistant → type name → Save.
**Alternate paths**: "+" → "Create new Bot" (`pages/shell/bot-picker.tsx:74`); empty-state "Create new Bot" (`pages/Shell.tsx:4141`); "Duplicate" from a bot's actions menu (`pages/BotContextMenu.tsx:135`).

##### Steps
1. Clicks "+". → Picker with "To:", "Search", "Create new Bot", "Create new Group", "Create new Space" plus info buttons (`bot-picker.tsx:50-134`). **[Hesitation]** "To:" reads like an email field.
2. Clicks "Create new Bot". → A bot named "New Bot" is created at once and opened, with no naming step (`pages/Shell.tsx:2636-2649`).
3. Wants to rename it; clicks the bot name in the chat header (`data-testid="bot-settings-trigger"`, `:4034`). → Right panel "Settings" with Name, Title, Description, Notifications, Computer (Team/Private), Advanced (Model, Thinking, Memory scope, Read replies aloud, Voice, Disabled tools), "Save", "Export", "Clear conversation" (`pages/shell/bot-panel.tsx:60-635`). **[Hesitation]** Clicking a name to reach settings is not obvious.
4. Types Name "MOCK Hiring helper", Title "Recruiting". → Description saves on blur; she looks for and clicks "Save".
5. Right-clicks / opens "Actions for MOCK Hiring helper" in the sidebar → Pin, Move to (Unassigned, MOCK Ops, New section, Rename section), Mark as Read/Unread, Edit Profile, Duplicate, Clear conversation, Archive, Delete (`pages/BotContextMenu.tsx:84-148`).
6. Move to → "MOCK Ops". → Row moves under that section.
7. Archive "MOCK Old intern bot", then "Restore" it from "Archived".
8. Delete a test bot → "Delete {name}?" and "What about its memories?" with "Keep memories" / "Delete memories too" (`pages/shell/dialogs.tsx:415-478`).

##### Variations
- "Edit Profile" in the menu and the header-name click open the same settings (duplicate path).

##### Edge cases
- Create fails: "Failed to create bot" appears as a send error in the composer area (`pages/Shell.tsx:2652`), far from the "+" she clicked.

#### STORY-APP-011: Maya sets up a "Leadership" group and wonders what a space is

**Type**: medium
**Topic**: Navigation / groups and spaces
**Persona**: Naive first-time founder
**Goal**: "Have Chief and the Finance helper work on the board deck together."
**Preconditions**: Chief and MOCK Finance helper exist; no Leadership group yet.
**Ideal path**: 4 — New group → name → pick 2 assistants → Create.
**Alternate paths**: none found for groups; spaces also via "Actions for space" (Rename space / Delete space, `pages/Shell.tsx:4734-4760`).

##### Steps
1. "+" → info button "About groups" → "Shared chat with 2-6 bots. They all reply in the same thread." (`pages/shell/dialogs.tsx:200-204`).
2. "About spaces" → "Private workspace with its own bots and groups." **[Hesitation]** She wonders if Northwind should be a space and whether her cofounder could join it (it cannot; STORY-APP-023).
3. "Create new Group" → right panel "New group", Name "MOCK DEMO DATA — Leadership", picks members, "Create group" (`pages/GroupPanel.tsx:103-146`). → Opens `/app/g/<id>`.
4. Sends "Draft three bullet points on Q3 burn". → Both bots reply in one thread.
5. Group header → "Group settings" → rename, "Delete group" (`GroupPanel.tsx:228-278`).
6. "Create new Space" → "New space", Name "MOCK DEMO DATA — Side project", "Create space" (`dialogs.tsx:69-92`). → Sidebar shows space names before group titles (`pages/shell/space-sidebar.ts:69-73`).

##### Edge cases
- One bot selected: group needs 2–6 bots; check the message shown.

### Stories: Chief and bot chats

#### STORY-APP-012: Maya asks Chief for this week's priorities with a file attached

**Type**: medium
**Topic**: Chat composer
**Persona**: Naive first-time founder
**Goal**: "Give Chief our board memo and get a short priority list back."
**Preconditions**: Chief exists with model working; local file "MOCK DEMO DATA — board memo.pdf" (<10 MB).
**Ideal path**: 3 — attach, type, send.
**Alternate paths**: Drag the file onto the window (global `DataRoomDropZone`, `App.tsx:172`, may file it into the Data room instead); "Attach file" button (`pages/Shell.tsx:6569`).

##### Steps
1. Clicks "Attach file", picks the PDF. → Chip with "Remove {name}" (`:6452`).
2. Types "What are my top 3 priorities this week based on this?" in "Message Chief" (`:6705-6712`). Shift+Enter makes a new line; Enter sends.
3. → Bot status shows running; "Stop" replaces "Send" (`:6749-6770`).
4. Scrolls up while it streams. → "Jump to latest" appears (`:5784`); clicks it.
5. Clicks "Stop" on a second long answer. → Reply stops.
6. Clicks the microphone ("Voice", `:6736`) and dictates a follow-up.

##### Variations
- Too many attachments: limit check at `pages/Shell.tsx:2231`.
- Drag-and-drop onto the chat vs onto the page: two drop targets may compete. **[Hesitation]**

##### Edge cases
- Send fails: error banner with "Dismiss error" (`:6398`); draft kept until accepted.

#### STORY-APP-013: Maya reacts to, replies to, and copies one of Chief's answers

**Type**: short
**Topic**: Message hover actions
**Persona**: Naive first-time founder
**Goal**: "Thumbs-up the good answer, ask a follow-up on that exact point, and paste it into Slack."
**Preconditions**: Chief thread with at least 3 assistant messages; one already has 👍.
**Ideal path**: 3 — hover → react; hover → reply; hover → copy.
**Alternate paths**: "Reply" is both a hover icon and an item in "More" (`pages/Shell.tsx:6947-6978`).

##### Steps
1. Hovers an assistant message. → "React", "Reply", "More" icons appear (`:6914-6965`), with time metadata.
2. "React" → 👍 👎 ❤️ 😂 🎉 😮 (`packages/contracts/src/reactions.ts:3`). Picks 🎉. → Reaction shows under the message.
3. "Reply" → composer shows the quoted message; screen reader hears "Replying to Chief" (`:6368`). Sends "Expand on point 2". → Sent message links back to the original.
4. "More" → "Copy". → Text is copied, but no toast or check mark confirms it (`:6897-6901`). **[Hesitation]** Maya clicks again to be sure.

##### Edge cases
- Progress bubbles while streaming show no hover actions (`:6895`).
- Touch: buttons are 44px on touch, 28px with a fine pointer.

#### STORY-APP-014: Maya works with a burn table Chief produced

**Type**: short
**Topic**: Chat tables
**Persona**: Naive first-time founder
**Goal**: "Sort by amount and get it into a spreadsheet."
**Preconditions**: Chief message with a Markdown table of 14+ rows "MOCK DEMO DATA monthly burn by category" (columns Category, Amount, Change).
**Ideal path**: 2 — click column header; Download CSV.
**Alternate paths**: "Copy rows" (TSV, paste into Sheets) vs "Download CSV"; "More" → "Copy" copies the whole message instead.

##### Steps
1. Clicks the "Amount" header. → Sorted; clicking again reverses (`packages/chat-ui/src/markdown-table.tsx:127`).
2. Sees "1–10 of 14 rows" and "Previous page"/"Next page" (`:186-203`).
3. "Expand table" (`:245`) → all rows.
4. "Copy rows" → icon turns to a check ("Copied", `:227`). Pastes into a spreadsheet.
5. "Download CSV" → file is always named `table.csv` (`:160`). **[Hesitation]** Two downloads overwrite or become "table (1).csv".

##### Edge cases
- Non-English UI: these table labels are hard-coded English (`markdown-table.tsx:186-245`).

#### STORY-APP-015: Maya hands work to the Leadership group with @

**Type**: short
**Topic**: Chat / mentions
**Persona**: Naive first-time founder
**Goal**: "From Chief's chat, ask the Leadership group to review the deck."
**Preconditions**: Leadership group exists; Chief chat open. (Mention picker mechanics are in prior STORY-053..055.)
**Ideal path**: 3 — type @Lead, pick, send.
**Alternate paths**: Open the group from the sidebar and type there.

##### Steps
1. Types "@Lead". → Picker lists the group (`aria-label="Mentions"`, `pages/Shell.tsx:6469`).
2. Picks it and types "please review the deck". Sends. → Message is rerouted to the group thread (`plan.rerouteGroupId`, `:2275-2279`); Chief's chat no longer shows it.
3. If she was replying to a Chief message, the reply link is dropped on reroute (`:2346-2347`). **[Hesitation]** "Where did my message go?"

### Stories: Notifications and Activity

#### STORY-APP-016: Maya wants to know when Chief is done or needs her

**Type**: short
**Topic**: Notifications
**Persona**: Naive first-time founder
**Goal**: "Ping me when the long task finishes, and show me what needs me."
**Preconditions**: Chief with `notifyOnFinish` on (default for new bots, `pages/Shell.tsx:2643`); browser notification permission "default"; Activity seed: 1 running, 1 "Needs input", 4 done.
**Ideal path**: 2 — allow notifications once; click a notification to open the chat.
**Alternate paths**: Per-bot "Notifications" switch in bot Settings (`pages/shell/bot-panel.tsx:410-425`); sidebar bell "Activity" (`pages/Shell.tsx:3205`). No app-wide notifications setting found.

##### Steps
1. Sends a long request. → The browser permission prompt appears only now, on the first send to a bot with notifications on (`pages/Shell.tsx:2280-2285`). **[Hesitation]** The prompt arrives with no explanation.
2. Allows; switches tabs. → When Chief finishes or needs input, a browser notification appears (`lib/browser-notifications.ts`).
3. Clicks the bell. → Sidebar switches to Activity: "Now" and "Recent" runs, "Search runs", "Status", "From", "To", "Reset all"; statuses Queued, Running, Needs input, Done, Failed (`pages/ActivityList.tsx:133-411`). It stays on after reload (`lib/activity-mode.ts`). **[Hesitation]** She expected a notification list, and her bot list is gone until she clicks the bell again.
4. Opens Chief's Settings and turns "Notifications" off for a chatty bot.

##### Edge cases
- Permission denied once: no in-app way to re-ask; she must change browser settings.

### Stories: Integrations (gaps only; see prior STORY-056..066)

#### STORY-APP-017: Maya disconnects her old Gmail and removes one Slack account

**Type**: medium
**Topic**: Integrations — remove/disconnect
**Persona**: Naive first-time founder
**Goal**: "Stop the assistants reading my old inbox."
**Preconditions**: Gmail connected with two MOCK accounts (`maya@` and `old-maya@northwind.example`); Slack with one MOCK workspace; Chief and Finance helper use Gmail.
**Ideal path**: 3 — open Gmail → Remove the old account → confirm.
**Alternate paths**: "Remove" on a row in Integrations home (`components/integrations/IntegrationsHome.tsx:215-218`); "Remove" on an account row in AppDetail (`AppDetail.tsx:111`); "Disconnect {name}" for the whole app (`AppDetail.tsx:344`).

##### Steps
1. Sidebar "Integrations" → "Connected" list → clicks Gmail. → Detail: accounts, "Add another account", "Used by", "Tools · n" grouped Read/Write ("Never changes your account" / "Changes your account").
2. On `old-maya@`, clicks "Remove". → "Remove old-maya@…?", "Agents lose access to this account.", "Mail data from this account that Rakazo cached is removed.", "Your data in Gmail is not deleted." (`AppDetail.tsx:368-382`). Confirms.
3. Sees "Disconnect Gmail" with "Removes all 2 accounts and agent access." (`:344-350`). **[Hesitation]** Remove vs Disconnect: which one leaves the other account?
4. Back on Integrations, Slack → "Disconnect Slack" → "Every agent loses access to Slack." Confirms.
5. Inbox page later shows the connect empty state (`AppDetail.tsx:402` warns of this).

##### Edge cases
- Failure: "Could not disconnect" / "Could not remove connector".

#### STORY-APP-018: Maya adds the docs MCP server her engineer sent her

**Type**: medium
**Topic**: Integrations — custom MCP
**Persona**: Naive founder forwarding an engineer's instructions ("add this URL")
**Goal**: "Let Chief read our internal docs server."
**Preconditions**: URL `https://mcp.mock-northwind.example/sse` (MOCK, reachable stub with bearer auth); Chief and Finance helper exist.
**Ideal path**: 4 — Add custom connection → paste URL → token → choose agents.
**Alternate paths**: Integrations "Anything else" → "Add custom connection" (`IntegrationsHome.tsx:607-620`); Settings → "Server integrations" (owner, `/integrations/setup`, "Add server URL", "Search integrations.sh") (STORY-APP-019); onboarding server-integrations step.

##### Steps
1. Scrolls Integrations to "Anything else": "Connect any app that offers an MCP server URL." **[Hesitation]** "MCP" is unexplained.
2. "Add custom connection" → dialog titled "Add a custom connection": "Display name", "URL", "Authentication" (No authentication / Bearer token / API key header) (`CustomConnectionDialog.tsx:350-377`).
3. Pastes the URL, picks "Bearer token", pastes the MOCK token. → Next step asks which agents may use it (agent access, "Could not save agent access" on failure).
4. Opens the new connection → "via MCP · mcp.mock-northwind.example", "Reconnect", "Disconnect sign-in", "Rename", "Used by", "Remove {name}" (`McpDetail.tsx:134-193`).
5. Asks Chief "What does our onboarding doc say about laptops?" → Chief calls the MCP tools.

##### Variations
- Wrong URL: "Enter the server URL, starting with https://." (`CustomConnectionDialog.tsx:222`).
- OAuth server: "Sign-in did not finish in time." / "This server needs an OAuth client ID." (`:160-170`).

##### Edge cases
- The connection is deleted elsewhere: "This connection no longer exists." (`McpDetail.tsx:42`).

#### STORY-APP-019: Maya (server owner) finds "Server integrations" and "Integrations" are different pages

**Type**: short
**Topic**: Integrations — setup surfaces
**Persona**: Founder who self-hosts and is the deployment owner
**Goal**: "Set up Slack, Gmail and the rest for the whole company."
**Preconditions**: Maya is deployment owner; app catalog not set up (no Composio key).
**Ideal path**: 3 — Integrations → set up catalog → connect.
**Alternate paths**: Integrations "Set up app catalog" (`IntegrationsHome.tsx:461`); Settings → General → "Server integrations" (`pages/AccountSettingsOverlay.tsx:223-226`, `/integrations/setup`); onboarding step (STORY-APP-001 variant C).

##### Steps
1. Integrations shows "App connections aren't set up on this server yet." and "Set up app catalog" (`IntegrationsHome.tsx:461-474`).
2. Clicks it → leaves `/app` for `/integrations/setup` ("Server integrations", Client ID / API key / "Get credentials" / "Connect").
3. Later finds the same page from Settings → "Server integrations". **[Hesitation]** Two names ("app catalog", "Server integrations") for one setup.

### Stories: Settings

#### STORY-APP-020: Maya switches Chief to a stronger model with her own API key

**Type**: medium
**Topic**: Settings — models and keys
**Persona**: Founder told by a friend "use your own Anthropic/OpenAI key"
**Goal**: "Make the answers better; use my company's key."
**Preconditions**: A deployment model is active; MOCK API key "sk-MOCK-DEMO-DATA" accepted by a stub provider.
**Ideal path**: 4 — Settings → Models → provider → paste key → Use this model.
**Alternate paths**: Per-bot "Model" in bot Settings → Advanced (`bot-panel.tsx:459`); onboarding "Connect a model".

##### Steps
1. User menu → "Settings" → "Models" (`pages/SettingsOverlay.tsx:137-144`). → "Active model", maybe "Configured by deployment", "Thinking: …", "Providers", "Search providers" (`pages/ModelSettingsOverlay.tsx:1141-1215`).
2. Picks a provider → "Use your own key" / "Connect API key" → pastes key → "Save". → "Connected · {label}", "Stored securely. Never shown here." (`:1400-1445`).
3. Chooses a model → "Use this model".
4. Back in Chief's bot Settings → Advanced → Model: confirms which model Chief uses. **[Hesitation]** Space-wide model vs per-bot model is not explained.
5. Later "Disconnect" → "Disconnect {name}?" "This removes the connection from every space." (`:1475-1478`).

##### Edge cases
- Member (not owner): "Models for the server owner’s default space." (`:1130`).
- Catalog empty: "No model catalog is available."

#### STORY-APP-021: Maya changes her password, theme and language

**Type**: short
**Topic**: Settings — account
**Persona**: Naive first-time founder
**Goal**: "Dark mode, compact sidebar, new password."
**Preconditions**: Signed in as Maya.
**Ideal path**: 3.
**Alternate paths**: Password reset via sign-in (STORY-APP-003).

##### Steps
1. Settings → General: "Account", "Messaging" ("Manage messaging settings"), "Appearance" (System/Light/Dark), "Sidebar density" (Comfortable/Compact), "Language", "Avatars" (Robot/Organic), "Advanced" (Stream replies, Show tool activity, Load web images automatically) (`pages/AccountSettingsOverlay.tsx:114-287`).
2. Picks Dark and Compact. → Applies immediately.
3. "Password": Current / New / Confirm → "Change password" → "Password updated" (`:415-460`).

##### Edge cases
- Mismatch: "Passwords do not match".
- Avatars fail: "Couldn't update avatars".

#### STORY-APP-022: Maya checks what she is paying and how much she has used

**Type**: short
**Topic**: Settings — billing and usage
**Persona**: Founder watching burn
**Goal**: "When does my trial end, and how much model spend did we use?"
**Preconditions**: Billing enabled, subscription in Trial ending in 5 days; MOCK usage data.
**Ideal path**: 2 — Settings → Billing.
**Alternate paths**: User menu "Usage" opens Settings at Usage (`pages/Shell.tsx:3910-3919`); Settings nav "Usage".

##### Steps
1. Settings → "Billing" → status "Trial", "Trial ends {day}", "Manage" (`pages/BillingSettingsPanel.tsx:47-101`).
2. "Usage" → "Model spend uses your provider keys." and per-period numbers (`AccountSettingsOverlay.tsx:317-327`). **[Hesitation]** If she never added a key (deployment model), whose key is that?

##### Edge cases
- "Past due", "Canceled", "Could not load billing".

### Stories: Team and members

#### STORY-APP-023: Maya tries to invite her cofounder

**Type**: short
**Topic**: Team / members
**Persona**: Naive first-time founder
**Goal**: "Add Sam (cofounder) so we share Chief and the data room."
**Preconditions**: Shared seed; second MOCK person "Sam Patel, sam@northwind.example".
**Ideal path**: 3 — Settings → Members → invite email.
**Alternate paths**: none found. No invite or members UI exists in `apps/web/src` (only messaging channel "invited" status, `pages/MessagingSettingsOverlay.tsx:210`). "Team" in bot Settings refers to a shared computer, not people (`bot-panel.tsx:66-80`).

##### Steps
1. Looks in Settings sections (General, Models, Memory, Voice, Usage, Computer, Billing, Updates). → No members.
2. Tries "+" → "Create new Space" hoping it is shareable. → It is a private workspace.
3. Sees "Team" under bot Settings → Computer. **[Hesitation]** Misreads it as sharing with her team.
4. Expected outcome to record: she cannot complete the goal; Sam must sign up separately and becomes a non-owner member with no shared bots.

### Stories: End-to-end

#### STORY-APP-024: Maya's Monday morning across the whole app

**Type**: long
**Topic**: Moving between features
**Persona**: Naive founder, second week of use
**Goal**: "Check email, cash and equity, file the signed SAFE, and leave Chief a to-do."
**Preconditions**: Full shared seed, including 3 unread MOCK mails (one with attachment "MOCK DEMO DATA — Signed SAFE.pdf"), MOCK Finance balances, MOCK cap table.
**Ideal path**: 10 — Inbox → open mail → file attachment → Finance → Cap Table → Chief → ask → done.
**Alternate paths**: Import attachment from Data room "Import from email" (prior STORY-013) vs downloading and dragging; ask the Inbox agent panel vs Chief; Cmd+K to reach bots.

##### Steps
1. Signs in → `/app` opens the first thread route (Chief).
2. Clicks Inbox (badge 3). → List grouped; Inbox agent panel on the right ("Collapse Inbox agent").
3. Opens the SAFE mail (`?mail=<id>`). Reads it. **[Hesitation]** Two assistants now visible: Inbox agent and Chief.
4. Wants it in the Data room: goes to Data room → "Import from email" → picks the attachment (prior STORY-013).
5. Clicks Finance → reads balances; the Finance agent panel offers its own chat.
6. Clicks Cap Table → checks the SAFE appears. If not, asks the panel agent.
7. Presses Cmd+K → "Chief" → Enter.
8. Types "Remind me Friday to send the Q3 investor update" → Chief replies (maybe offers a routine).
9. Clicks the bell to see the run → "Done"; clicks bell again to get the bot list back.
10. User menu → Artifacts → opens last week's update draft.
11. Logs out from the user menu.

##### Edge cases
- Each feature page (Inbox, Finance, Cap Table, Data room) has its own agent panel, so "the assistant" means a different bot per page (`agentPanel`, `pages/Shell.tsx:4150-4200`).

#### STORY-APP-025: Maya produces and sends a monthly investor update

**Type**: long
**Topic**: Moving between features
**Persona**: Naive founder before a deadline
**Goal**: "Get a draft investor update with a burn table, check it, and email it to investors."
**Preconditions**: Full seed; Gmail connected; Chief has Gmail access and mail sending set to ask for approval; MOCK investor list "investors@mock-northwind.example".
**Ideal path**: 6 — ask → review → edit table → approve email → confirm sent.
**Alternate paths**: Compose in Inbox ("New message") and paste; ask the Leadership group (STORY-APP-015); copy via "Copy rows" into Gmail.

##### Steps
1. In Chief: "Draft our September investor update with a burn table from the finance data." → Streams a reply with a table (STORY-APP-014) and an artifact card.
2. Sorts the table, clicks "Copy rows" to check numbers in a spreadsheet.
3. Replies on the burn paragraph (hover "Reply"): "Use the real runway number from Finance." → Revised version.
4. Reacts 👍 on the final version.
5. "Email this to investors@mock-northwind.example." → A mail approval card appears (prior STORY-031..033): edits subject, clicks Send; "Sending… Undo" toast (outbox).
6. Switches to Finance while it sends; a browser notification says Chief needs input or finished (STORY-APP-016).
7. Checks Inbox → Sent via Gmail search "in:sent".
8. Opens Artifacts to find the saved draft for next month.

##### Edge cases
- Approval card answered on another device (prior STORY-044).
- Copy in "More" gives no feedback (STORY-APP-013) so she may paste stale text.

---
## Redundancy Candidates (all areas)

Merged from the six area catalogs. Items that more than one area reported appear once, tagged with every area that reported them.

### Duplicate paths (same goal, multiple routes)
- **[Inbox] Archive**: row hover icon, row More menu, dialog button, `e` on the list, `e` in the dialog. All five do the same thing; the dialog version moves to the next message instead of closing, the list version does not (`Inbox.tsx:316-334, 826-833`).
- **[Inbox] Mark read/unread**: row hover icon, row More menu, dialog button, and the automatic 0.8 s read. Same result.
- **[Inbox] Mark important / noise**: hover star/bell icons (pressed buttons) and More menu checkbox items, in a different order (prior P3-04).
- **[Inbox] Search**: search box, `/` key, "Search older mail" button — all focus the same input.
- **[Inbox] Clear filters**: Filter menu "Clear", results-count "Clear", empty-state "Clear", search box X, Esc in the box. Five clears with slightly different scope (the menu Clear removes only filter/category; the others remove search, filter, category, view and the open message, `Inbox.tsx:424-428, 612-619`).
- **[Inbox] "What needs my attention?"**: Needs reply group, Important toggle, To do card, and asking the Inbox agent. Four surfaces built on the same triage data.
- **[Inbox] Replying**: dialog Reply, keys `r`/`a`/`f`, and agent approval cards; "Open in composer" bridges a failed card back to the composer (prior P2-27).
- **[Inbox, Finance, Cap Table, App shell] Connecting an app happens in two or more places.** Gmail: Inbox "Connect mail", Integrations catalog, Integrations app detail (prior redundancy #2). Mercury/Brex: Finance Add account dialog (`AddAccountDialog.tsx:145-155`) and Integrations tiles (`FinanceSection.tsx:356-415`); "Add Brex" and reconnect go to Integrations (`Finance.tsx:63, 237, 342`), so a founder uses both. Coinbase/Kraken: Add account dialog and Integrations tiles; remove only on the Crypto page. Carta: Cap Table "Connect Carta" → Integrations `?q=carta` → Carta tile; Integrations directly; "Add custom connection" with the Carta URL pasted — all produce the same server row. "Set up app catalog" (Integrations) and "Server integrations" (Settings) open the same `/integrations/setup` page under two names.
- **[Inbox, Data room, App shell] Adding a file to the Data room**: Data room "Choose files" (empty state), the "+" "Add files" header button, drop on the Data room page, drop on any app page, and a chat attachment (which may or may not file it). The first four all call `uploadFilesToDataRoom` and land in the root; none upload into the selected folder and none link back to an email. The Data room connect and "Import from email/Drive" buttons described by the prior catalog do not exist on `main`.
- **[Legal, Data room] Giving the AI permission to read documents**: Legal's Allow card (Legal agent's model) and the Settings "AI data sharing" switches (space default model), plus the Data room consent API that the web app never calls. They use different consent keys; a founder sees one and assumes it covers the others.
- **[Finance, Legal, Cap Table, App shell] Talking to a feature's agent**: the page side panel ("Ask agent" / "Show Carta agent"), the agent's own bot page (panel header name button), and the sidebar bot list entry. Legal adds the seeded "Legal Desk (mock)" bot (ordinary bot, no legal tools), the group chat "Leadership sync (mock)" (Legal agent without tools) and Chief; only the panel and the real Legal agent use Legal data. The Cap Table panel also re-opens by leaving and returning to the page.
- **[Finance] Subscription detail**: vendor page (dashboard table `Finance.tsx:724`) vs recurring page (Upcoming `Finance.tsx:658` and chat card `FinanceCards.tsx:216`). Two detail pages for one subscription.
- **[Finance] Crypto scope control** on both Accounts and Runway.
- **[Legal] Start a scan**: header Scan now, empty-state Scan now (two buttons on the same screen with different label behaviour, prior P-24), the daily 06:00 UTC routine, and asking the agent in chat.
- **[Legal] Open the source document**: Contracts title link, Deadlines contract link, Data room folder browse. The graph node has none.
- **[Legal, Data room] Getting legal documents from email**: the Legal agent's chat report of mail findings, and the Data room's email import (described by the prior catalog; not on `main`). Only the import would add files.
- **[Cap Table] Add/update a contact**: the "Add contact" dialog and the agent's `contacts_save`. They behave differently: the dialog upserts by email silently, the agent requires an approval card; the agent can never update by id.
- **[Cap Table] Run an investor update/audit**: skill selector in the composer vs free-text request.
- **[Data room] Item actions**: the "…" menu on list rows, grid tiles, search results and the preview header, all opening the same Move / Rename / Delete dialogs.
- **[Data room] Choosing a folder**: folder tree (wide) vs folder picker pill (narrow) vs Move dialog select. Same folder list, three widgets.
- **[Data room] Finding a document**: folder browsing, free-text search, Type / Party / Date / Source chips, and sort by Type. Type filter and Type sort overlap with classifier folders (`Finance / Invoices` vs Type "invoice").
- **[Data room] Restarting a failed item**: only by re-uploading the identical file (hidden duplicate path); no visible retry.
- **[App shell] Open bot settings**: the bot name in the chat header (`pages/Shell.tsx:4034`) and "Edit Profile" in the bot actions menu (`pages/BotContextMenu.tsx:131`). Same panel.
- **[App shell] Reply to a message**: hover "Reply" icon and "More" → "Reply" (`pages/Shell.tsx:6947-6978`). Same action, two places in one 3-button toolbar.
- **[App shell] Create a bot**: "+" → "Create new Bot", empty-state "Create new Bot", "Duplicate". The first two are identical.
- **[App shell] Usage**: user menu "Usage" and Settings nav "Usage" (`pages/Shell.tsx:3910`, `pages/SettingsOverlay.tsx:141`). Same panel.
- **[App shell] Show/hide sidebar**: "Minimize bots", edge button "Hide bots"/"Show bots", header "Show bots", mobile "Open navigation".
- **[App shell] Add an MCP server**: Integrations "Add custom connection", `/integrations/setup` "Add server URL"/"Search integrations.sh", onboarding server-integrations step. Different forms for the same goal.
- **[App shell] Choose a model**: Settings → Models, bot Settings → Advanced → Model, onboarding "Connect a model".

### Duplicate information (same fact, multiple surfaces)
- **[Inbox] Unread count**: sidebar badge, bold rows and dots, "(unread)" screen-reader text, dialog Mark read/unread label.
- **[Inbox] Needs reply**: group heading on the list, the "Needs attention" badge (hidden in that group, shown elsewhere), the triage reason tooltip (only in the Needs reply group, `InboxRow.tsx:140`), and to-dos that restate the same request (T1 restates M1).
- **[Inbox] Sending state**: one global outbox toast ("Sending… / Sent / Draft discarded") for the Inbox and chat cards, and separate per-card states on the approval card ("Sending… / Sent / Approved / Unknown / Not sent").
- **[Inbox, Data room] Size limits** for the same kind of file, in three places: 10 MB to attach or forward (`contracts/src/inbox.ts:229`), 25 MiB to download (`inbox.ts:40`), 50 MiB for the Data room. Only the 10 MB limit is ever shown in the Inbox.
- **[Inbox] Message view**: the same `InboxMessageDialog` is used by the Inbox and by chat email cards, with fewer buttons in chat (no Archive, no Mark read).
- **[Finance, Cap Table] Cash, burn and runway**: dashboard Cash, Accounts Total cash, Runway Cash, the Finance agent card and the Carta agent (`finance_*` tools), with differing subtitles. Monthly burn on dashboard, Burn page, Runway page, agent card. Runway on dashboard (1 decimal), Runway page, agent card (rounded to whole months).
- **[Finance] Category breakdown**: dashboard Breakdown, Burn "Where it went", month Categories, Spend chips, agent card.
- **[Finance] Transactions table** repeated on Spend, month, category Recent, account, recurring Past charges, vendor Charges (a different table with a Receipt column).
- **[Legal] Next date per contract**: Contracts "Next deadline" (short date) and Deadlines row (full date).
- **[Legal] Counterparties**: Contracts "Parties" column and Graph company nodes plus `party_to` edges.
- **[Legal] Renewal clause quote**: under both "Renews" and "Renewal notice deadline" rows (prior P-04).
- **[Legal] Deadline counts**: Open deadlines and Overdue tiles, the Deadlines list, and the agent's scan reply.
- **[Inbox, Data room, Legal] The lease renewal and Nov 30 date**: Inbox email "Office lease renewal option", the lease PDF in the Data room, and (if the model extracts it) the Legal Deadlines tab.
- **[Cap Table, App shell] Connection status**: Integrations home row, AppDetail/McpDetail, onboarding connect cards, agent-access step, and (indirectly) the presence or absence of "Connect Carta" on Cap Table.
- **[Cap Table] Contact list**: Cap Table table and agent `contacts_list` replies in chat.
- **[Cap Table, App shell] Agent chat thread and bot identity**: the same thread in the side panel and the full bot page; bot name, title and preview in the sidebar row, command palette row, chat header and agent panel header.
- **[Data room] Item facts**: Type, Date, Parties in the list row and again in the preview; status ("Reading", "Filing", "Failed") in the Type column, the row marker icon, the grid tile and the preview.
- **[Data room] Folder path**: preview "Folder" field, search results subtitle, tree selection, narrow picker label.
- **[Data room] Source**: icon on each row (with tooltip) and text in the preview and search result subtitles.
- **[Data room] "Filed" vs "Filing"**: the upload toast and the list status describe different moments with nearly the same word.
- **[App shell] Run state**: bot avatar status dot in the sidebar, Activity list status, chat header status, browser notification.

### Overlapping features/tools
- **[Inbox] Important toggle** (triage view) vs **Gmail "Important"** filter: same word, different meaning; the app hides one when the other is available (`Inbox.tsx:539-549, 577-579`).
- **[Inbox] "Mark important" star** vs Gmail's **Starred** filter: the star marks the sender as important in the app; "Starred" reads Gmail stars.
- **[Inbox] To do card** vs **Needs reply group**: both list things to act on, from the same triage run; neither links to the other.
- **[Inbox] Composer drafts** (Gmail drafts, autosaved) vs **approval card "Save draft"** (agent `mail_draft`): both create Gmail drafts, and the app has no Drafts view for either.
- **[App shell, Inbox, Data room] "Search" means five different scopes**: sidebar Search (messages across the space), command palette (bots only), "+" picker (bots), Inbox "Search mail", Data room search. The sidebar search may not include Data room items (verify during the walk).
- **[App shell, Finance, Legal, Cap Table] Too many assistants with no guidance on which to ask**: Chief, the Inbox agent, the Finance/Legal/Carta panel agents, seeded bots and groups. Finance agent and Carta agent both answer cash and runway questions. "Legal Desk (mock)" predates the Legal feature and is a decoy; consider removing it from `DEMO_BOTS` or renaming it.
- **[App shell, Data room] Documents in two places**: Artifacts (user menu) and Data room (sidebar) are both "documents" to a founder and use the same `FolderOpen` icon (`pages/Shell.tsx:3344`, `:3894`). Data room vs chat attachments: dropping on the composer goes to chat, elsewhere to the Data room. Data room vs agent Drive tools (`drive_search`, `drive_read`): both "find a company document", with no link between them.
- **[Data room, Inbox] Data room "Source" filter vs Inbox attachments**: the filter lists Gmail, Drive, Chat and Finance, but only "Upload" is ever produced.
- **[App shell] Removal verbs**: "Remove" (account or connector) vs "Disconnect" (app) vs "Disconnect sign-in" (MCP OAuth) for overlapping actions.
- **[App shell] Activity (bell) vs per-bot Notifications switch**: both relate to "what needs me", configured and shown in unrelated places.
- **[Finance] Blockscout and Alchemy** tiles both say "Read wallet balances".
- **[Finance] Period tabs** on the dashboard, the Spend page and the Accounts balance range.
- **[Legal] Graph tab vs Contracts table**: for a four-contract startup the graph adds only relation verbs and jurisdiction; it becomes useful only with many contracts, where it caps at 120 nodes with no search (prior P-19).
- **[Cap Table] Contact "Kind" tabs** on the page and the `contacts_list` kind filter in chat.
- **[Cap Table] Contact "Notes" vs Carta holdings**: a founder may record investment amounts in Notes that duplicate and drift from Carta.

---

## Suspected problems (all areas)

Merged and deduplicated from the six area catalogs (Inbox 17, Finance 17, Legal 8 new plus carried-over prior items, Cap Table 14, Data room 13, App shell 13). Each item names the area, the evidence, and the stories that exercise it where the source gave them. All were found by reading code; none was observed in a browser. "Hypothesis" marks items that depend on model output or on code that was not traced.

### Walk blockers
1. **[Legal] Legal is not in the assigned build.** `docs/ux-pass` = `origin/main` 458a69e4 has no Legal files; the code is on `origin/feat/legal` 488048d5 (not merged) and `local/legal-integration` d0dcfbf1. The demo seed (`rakazo-demo`, `feat/mock-demo-env`, also based on main) has no Legal page either. Evidence: `git ls-files | grep -i legal` is empty; `git merge-base --is-ancestor origin/feat/legal origin/main` is false. (STORY-LEG-020)
2. **[Legal] The demo documents give the agent almost no dates, so the Deadlines tab will likely be empty** (hypothesis). The lease has no year, the MSA and NDA have no start date, the SAFE has no dates (`rakazo-demo/packages/testkit/src/cli/demo/data.ts:499-519`). The agent is told never to invent a date (`apps/api/src/legal-agent.ts:9`), and derived deadlines need `expirationDate` (`packages/adapters/src/legal-tools.ts:345`). Fix for the walk: add years and effective dates to the seed, or seed legal rows directly.
3. **[Cap Table] Carta is recognized only at host `mcp.app.carta.com`**, so a mock MCP server on another host cannot stand in for Carta (`packages/contracts/src/carta.ts:10-21`).

### Content a founder cannot reach
4. **[Inbox] Opening a thread shows only its newest message; earlier messages are unreachable.** The list keeps one row per thread (`apps/api/src/inbox.ts:126-134`) and the dialog loads one `messageId` (`apps/web/src/components/inbox/InboxMessageDialog.tsx:113-160`). The only way to read an investor conversation from the start is the quoted text in a Reply composer. (STORY-INB-008, STORY-INB-024)
5. **[Cap Table] The page is titled "Cap Table" but shows only a contact list.** Pie-chart sidebar icon; body is Name/Email/Organization/Kind. Holders, securities, SAFEs and the option pool are chat-only through the Carta agent, and there is no sync step (`apps/web/src/pages/CapTable.tsx:228-230, 281-318`; `apps/web/src/pages/Shell.tsx:3332-3341`).
6. **[Finance] Past statements cannot be seen or removed after the import dialog closes.** Upload state lives only in component state (`StatementImport.tsx:36`); the `finance.statements` list RPC exists (`apps/api/src/finance-statements.ts:487`) but the web app never calls it. A statement-created account cannot be deleted.
7. **[Finance, Cap Table] Agent side panels hide or forget things that the bot page has.** Finance pins and checklists are hidden in the side panel (`apps/web/src/pages/Shell.tsx:2971, 2974, 4076` gate them on `!pageMode`); they show only when the Finance agent is opened from the sidebar bot list. The Cap Table panel's collapse state is not remembered (`Shell.tsx:508-509, 897-899`), unlike the Inbox agent's stored preference.
8. **[Inbox] To-dos do not open their email**, although each stores `messageId` (`apps/web/src/components/inbox/TodoCard.tsx:77-87`; `packages/contracts/src/inbox.ts:144`). There is no way to add, edit or delete a to-do. (STORY-INB-014)
9. **[Finance] Account detail shows only the newest 20 transactions**, with no "See more" (`apps/api/src/finance.ts:589`).
10. **[Finance] Upcoming `bill` rows cannot be clicked** (`Finance.tsx:656-661`).
11. **[Cap Table] Only the name text opens a contact**, not the row, though the row has a hover highlight (`CapTable.tsx:300-308`).

### AI consent and automatic processing
12. **[Data room, Legal] No web UI grants Data room consent, so documents are never classified or filed, and the consents that do exist use other keys.** The classifier skips silently when consent is missing (`packages/adapters/src/data-room-jobs.ts:323-328`). `dataRoom.consent` / `dataRoom.consentGrant` exist (`packages/contracts/src/rpc.ts:1145-1146`, `apps/api/src/data-room.ts:239-283`) but nothing in `apps/web/src` calls them. Settings "AI data sharing" (`apps/web/src/components/AiDataSharing.tsx:57-118`) and Legal's Allow card (`apps/api/src/legal.ts:170-197`, `ConsentPrompt.tsx:47`) use different keys from `data-room:` (`packages/adapters/src/data-room-models.ts:91-111`); re-queued Data room jobs still check their own consent (`legal.ts:172-174`). A founder sees "ready" items with no type, summary or folder, and is asked again by each surface. Changing the model or embedding model changes the consent key and silently revokes consent (`data-room-models.ts:91`). (STORY-DRM-009, STORY-LEG-004)
13. **[Data room] No way to create, rename, move or delete folders in the UI, and uploads ignore the selected folder.** Folders come only from automatic filing (`packages/db/src/data-room.ts:776-778`), which depends on item 12. API routes exist (`packages/contracts/src/rpc.ts:1125-1134`), but `ItemDialogs.tsx` and `FolderTree.tsx` offer nothing; without consent the Move dialog lists only "No folder" (`ItemDialogs.tsx:111-117`). Uploading while a folder is selected puts the file in the root and it vanishes from the view (`upload-toasts.ts:94-95`, `apps/web/src/lib/data-room.ts:49`). (STORY-DRM-006, STORY-DRM-010)
14. **[Inbox] The AI-sorting consent card has no "Not now" and does not say what sorting gives you** (`apps/web/src/components/AiDataSharing.tsx:36-50`). It is hidden whenever a search or filter is active (`Inbox.tsx:718`). (STORY-INB-002)
15. **[Legal] Nobody but the agent can mark a document legal or not legal.** `not_legal` rows are hidden from every list (`packages/db/src/legal.ts:11-12,160`); the only user write is deadline status/notes (`packages/contracts/src/legal.ts:178-182`). (STORY-LEG-010)
16. **[Legal] Recurring obligations and renewed terms do not roll forward.** A closed derived deadline blocks the next term's deadline (prior P-01, `legal-tools.ts:373-374`); recurring obligations get no next occurrence (prior P-02, `legal-agent.ts:9,13`; `db/legal.ts:90-95`). (STORY-LEG-013)
17. **[Legal] Legal dates found in email never reach the Deadlines tab.** The agent only reports mail and Drive findings in its reply and "cannot add them to the Data Room" (`legal-agent.ts:9`). The seeded trademark notice ("response due in 30 days", `data.ts:81-82`) is the kind of item a founder most expects Legal to track. (STORY-LEG-018)

### Actions that do more, or less, than they say
18. **[Inbox] "Mark important" / "Mark noise" on one row changes every email from that sender, in every account**, and neither the label nor the toast says so (`apps/web/src/components/inbox/InboxRow.tsx:114-119`; `apps/api/src/inbox.ts:414-440`). No screen lists marked senders. (STORY-INB-005)
19. **[Cap Table] "Add contact" silently overwrites an existing contact with the same email**, clearing organization and notes and changing kind (`CapTable.tsx:70-79` → `packages/db/src/contacts.ts:63-70`).
20. **[Finance] Mismatched statements are imported without review.** `StatementImport.tsx:69-74` sends `acceptMismatch: true` automatically, and the error appears only after the import.
21. **[Inbox] The Inbox agent is told it cannot send, archive or change mail, while send and draft approval cards exist.** Code verified, runtime behavior unverified: `apps/api/src/inbox-agent.ts:5-6` vs `packages/adapters/src/mail-tools.ts:31-40` and `packages/adapters/src/executor.ts:3521`. (STORY-INB-020, STORY-INB-023)
22. **[Inbox] Forwarding mail whose attachments total over 10 MB silently drops all of them**, including the small ones (`apps/api/src/inbox-compose.ts:120-123`; `ComposeEmail.tsx:284-288`). When attaching local files, the same line does not say which file was left out (`ComposeEmail.tsx:392-416`). `MAX_COMPOSE_ATTACHMENTS = 20` (`packages/contracts/src/inbox.ts:231`) is not checked by the composer. (STORY-INB-011, STORY-INB-012)
23. **[Inbox] Archive from the open message jumps to the next message instead of closing**, unlike archive from the list (`Inbox.tsx:826-833`). (STORY-INB-004, STORY-INB-024)
24. **[App shell] Reply context is dropped when an @group mention reroutes the message** (`pages/Shell.tsx:2346-2347`), and the message leaves the current chat with no notice there. (STORY-APP-015)
25. **[Cap Table] The Carta agent can be created before Carta is connected**, with nothing saying it has no Carta access yet (`Shell.tsx:2556-2567, 4191-4200`; `apps/api/src/carta-agent.ts:20-45`).
26. **[Cap Table] Planned routine suggestions (audit season, investor update) are not implemented**, though `docs/carta/README.md` decision 8 promises them on agent creation.

### Destructive actions without confirmation or undo
27. **[Cap Table, Data room, Finance, Legal] Delete, remove and close actions have no confirmation, undo or history.** Cap Table contact delete (`CapTable.tsx:151-160`). Data room delete shows only "Delete {name}?" and removes the stored file about 60 s later (`ItemDialogs.tsx:64`; `apps/api/src/data-room.ts:229-236`). Finance Alchemy "Remove" has no confirmation (`FinanceSection.tsx:121-129`) though wallet and exchange removals do, and Mercury, Brex and Blockscout cannot be disconnected from Finance. Legal Done and Dismiss have no undo, hint or history (prior P-10, `LegalDeadlines.tsx:26-38,98-115`). (STORY-CAP-013, STORY-DRM-017, STORY-LEG-012)

### Missing or misleading feedback
28. **[Inbox] "Gmail needs to be reconnected." offers only "Try again", which cannot fix it.** No link to Integrations and no account name when several are connected (`apps/web/src/pages/Inbox.tsx:667-674`; `apps/web/src/lib/inbox-sync-error.ts:10`). (STORY-INB-017)
29. **[Cap Table] "Connect Carta" is hidden by default and stays hidden if the server list fails to load** (`CapTable.tsx:182, 200-215`). When shown, it leaves for Integrations and opens a technical "custom connection" dialog with an MCP URL, and the same label is used to re-authorize an expired connection, risking duplicate servers (`Shell.tsx:4121`; `IntegrationsHome.tsx:585-597`). After connecting, only the button disappears: no "connected", last-read time or company name (`CapTable.tsx:231-235`). (STORY-CAP-003, STORY-CAP-004, STORY-CAP-005)
30. **[Cap Table] The contact table does not reload after the agent saves a contact** in the panel beside it (`CapTable.tsx:187-199`). (STORY-CAP-016)
31. **[Legal] Scan now gives no progress, finish or failure signal, and is disabled with no reason when no model resolves** (prior P-08, P-09: `Legal.tsx:34,43-55,74,95,110`; `Shell.tsx:4172`). The key warning is vague, unlinked and does not refresh after Settings; the consent card can ask to approve a model that Legal then refuses (prior P-11 to P-13, `Legal.tsx:34-36,82-96`). The page never mentions the 06:00 UTC daily scan or a paused routine (prior P-21, `legal-agent.ts:16,48-50`). (STORY-LEG-002, STORY-LEG-005, STORY-LEG-006)
32. **[Data room] Upload toasts claim "Filed" too early, and for duplicates.** The toast shows when the upload completes while the item is still "Pending" (`DropZone.tsx:141-152`); the list then says "Filing" for both classification and indexing (`format.ts:13-19`). A duplicate upload returns `duplicate: true` (`apps/api/src/data-room.ts:430-433`) but still shows "Filed" (`upload-toasts.ts:76-80`), with no new row; a different file name on the duplicate is dropped silently. (STORY-DRM-005, STORY-DRM-007)
33. **[Data room] Failed items have no retry**, and "Couldn't classify" gives no reason or action (`ItemMenu.tsx:42-55`; `Preview.tsx:112-114`). (STORY-DRM-008)
34. **[Inbox] "Download failed" gives no reason for attachments over 25 MiB** (`InboxMessageDialog.tsx:357, 398-401`), although the API returns 413 "Attachment is too large" (`apps/api/src/inbox.ts:40, 509`). (STORY-INB-015)
35. **[Inbox] The rate-limit notice never clears on its own.** It says "Try again in a minute", but the sync runs only on mount and on "Try again" (`Inbox.tsx:224-243`). (STORY-INB-018)
36. **[Inbox] Replied mail stays in "Needs reply" until triage runs again** (hypothesis; `alreadyHandled` at `apps/api/src/inbox.ts:362` was not traced). (STORY-INB-009, STORY-INB-022)
37. **[App shell] Copy has no confirmation** and fails silently when `navigator.clipboard` is missing or rejected (`pages/Shell.tsx:6897-6901`), while the table's "Copy rows" shows a check mark (`packages/chat-ui/src/markdown-table.tsx:227`).
38. **[App shell] The browser notification permission prompt appears on the first send** with no explanation (`pages/Shell.tsx:2280-2285`); there is no app-wide notification setting and no way to ask again after a denial.
39. **[Finance] A bad id shows an error with retry instead of "Not found"** (`FinanceTransaction.tsx:137-139`), and an unknown `?source=` is ignored silently (`finance-route.ts:65-67`). (STORY-FIN-023)

### First run and navigation
40. **[App shell] Onboarding asks for developer setup before showing any value, and offers no company-operations focus.** "Provider", "Server URL", "Thinking", "Direct MCP", "Client secret", "Redirect URI" (`pages/Onboarding.tsx:563-760`; `components/integrations/IntegrationSetup.tsx:49-406`); the only guidance is "Skip". The focus choices have no finance, cap table or investor option, and "A bit of everything" gives the same apps as "Day-to-day work" (`apps/api/src/onboarding.ts:33-62`). The welcome page explains nothing for a company operator (`pages/Welcome.tsx:19-42`), and the paywall line "Any model, with your own key" suggests a key is required first (`pages/Paywall.tsx:41`). (STORY-APP-001, STORY-APP-002, STORY-APP-004)
41. **[App shell] The bell icon opens "Activity", not notifications.** It replaces the bot list with a run log, and the mode persists across reloads, so the bots look missing on the next visit (`pages/Shell.tsx:3205-3224`; `lib/activity-mode.ts:1-20`). (STORY-APP-016)
42. **[App shell] There is no way to invite a teammate.** No members UI exists in `apps/web/src`; "Team" in bot Settings means a shared computer (`pages/shell/bot-panel.tsx:66-80`). (STORY-APP-023)
43. **[App shell] The command palette only switches bots and has no visible trigger or shortcut hint**; typing "Finance" or "Settings" returns "No bots" (`pages/shell/command-palette.tsx:87-107`; `pages/Shell.tsx:2846-2851`). (STORY-APP-008)
44. **[App shell] "Create new Bot" creates "New Bot" immediately with no naming step.** Renaming requires clicking the unlabeled bot name in the header (`pages/Shell.tsx:2636-2649, :4034`); a create failure surfaces as a composer send error (`:2652`). (STORY-APP-010)
45. **[App shell] Artifacts sits in the user menu while Data room is in the main nav, with the same icon** (`pages/Shell.tsx:3344,3884-3895`). A founder looking for a document Chief wrote checks the Data room first. (STORY-APP-006)
46. **[Finance] Breadcrumbs name pages that do not exist.** "Breakdown", "Upcoming", "Subscriptions" and "Vendors" all go to the dashboard (`FinanceSpend.tsx:114, 193, 235`; `FinanceTransaction.tsx:55`), and the back button uses these labels (`components/finance/ui.tsx:93-101`).
47. **[Finance] The chat breakdown card header always links to the monthly Spend view**, whatever range the card shows (`FinanceCards.tsx:143-146`).
48. **[Inbox, Data room] View choices are not kept.** The Inbox account tab is component state (`Inbox.tsx:110`), unlike `q`, `filter`, `view` and `category`, so reloading resets to All (STORY-INB-021). Data room view and sort reset on every visit (`DataRoom.tsx:69-74`) (STORY-DRM-012).

### Labels, empty states and wording
49. **[Inbox, Data room] Import from email or Drive does not exist on `main`, but the UI and the prior catalog imply it.** The Inbox attachment chip only downloads (`InboxMessageDialog.tsx:379-395`), and there is no `ImportFromEmail` component in `apps/web/src`. The Data room Source filter lists "Google Drive", "Gmail", "Chat" and "Finance" (`FilterBar.tsx:22-29`), but upload is the only producer (`apps/api/src/data-room.ts:436-438`). (STORY-INB-016, STORY-DRM-020, STORY-DRM-021)
50. **[Data room] Type and Party filters are exact, case-sensitive matches on free text.** "Invoice" or "Acme" returns "No results" (`packages/db/src/data-room.ts:151`, `:175`; `FilterBar.tsx:85-118`). Suggestions come only from rows on screen (`DataRoom.tsx:289-290`), and types display as raw lowercase enum values (`ItemRows.tsx:156`, `Preview.tsx:116`). (STORY-DRM-014)
51. **[Inbox] Two different "Important" features share one word.** With sorting on, the Important toggle is the app's triage view and Gmail's "Important" filter is removed; with sorting off, "Important" is Gmail's (`Inbox.tsx:539-549, 577-579`). (STORY-INB-007)
52. **[Legal] "Ask agent" does not say which agent.** The shared Finance button label (`apps/web/src/components/finance/ui.tsx:34-47`) renders on the Legal page (`Legal.tsx:79`). The seeded "Legal Desk (mock)" bot also appears beside the real Legal agent, because Shell does not hide bots by spawn key (`data.ts:549-554`). (STORY-LEG-019)
53. **[Data room] The name "Data room" sets an investor-sharing expectation the product cannot meet.** Sharing is owner-only in V1 (`docs/data-room/README.md:53-55`), and the empty state never explains what the room does (`DataRoom.tsx:266-278`). (STORY-DRM-022)
54. **[Inbox, Finance, Cap Table] Empty states do not explain.** The empty Inbox shows only "Connect mail", and Compose is a disabled icon with no reason, text or tooltip (`Inbox.tsx:622-631, 676-681`; row icons rely on aria-labels, `InboxRow.tsx:197-232`) (STORY-INB-001, STORY-INB-004). Finance empty tables show only headers (`ui.tsx:346`), the Wallets section is blank with no wallets (`FinanceCrypto.tsx:193-207`), and the Finance empty state shows only bank logos (`Finance.tsx:169-171`). A filtered Cap Table tab says "No contacts yet" even when other kinds have contacts (`CapTable.tsx:276-278`).
55. **[Finance] Runway and cash are shown inconsistently.** The agent card rounds runway to whole months (`FinanceCards.tsx:122`) while the dashboard shows one decimal (`Finance.tsx:288`); the Cash subtitle is "Checking + Treasury" on the dashboard (`Finance.tsx:394-397`) but "Checking + Savings + Treasury" on Accounts (`FinanceAccounts.tsx:175-177`).
56. **[Finance] Dashboard period tabs do not change Breakdown, Upcoming or Subscriptions**; Breakdown is fixed to "Last 90 days" (`Finance.tsx:552`).
57. **[Finance, App shell] Connection labels and verbs are vague or inconsistent.** The Crypto page shows a bare "Connect" (`FinanceCrypto.tsx:170-176`); Blockscout and Alchemy share one description (`FinanceSection.tsx:54, 110`). Removal uses "Remove" / "Disconnect {name}" / "Disconnect sign-in" (`AppDetail.tsx:105-114,344`; `McpDetail.tsx:165,190`), and "Set up app catalog" and "Server integrations" open the same `/integrations/setup` (`IntegrationsHome.tsx:461`; `AccountSettingsOverlay.tsx:223-226`).
58. **[Finance] The "overlaps" pill does not say what the row overlaps with** (`Finance.tsx:733-737`).
59. **[Finance] The transaction page's title is a date instead of the merchant** (`FinanceTransaction.tsx:136`).
60. **[Finance] The Finance agent description mentions only Mercury and Brex** (`apps/api/src/finance-agent.ts:82`), and there is a dead string at `finance-agent.ts:13`.
61. **[Legal] "Unreviewed documents" counts every ready Data room file, legal or not** (`packages/db/src/legal.ts:89-95`), so the seeded account shows 9 before the first scan although only 4 are contracts. (STORY-LEG-009)
62. **[Legal] No "due soon" marker before a deadline is overdue** (prior P-16, `LegalDeadlines.tsx:56-71`). (STORY-LEG-011)
63. **[Legal] The graph shows raw keys such as `party_to`, and nodes do not link to documents** (prior P-20, `LegalGraph.tsx:205`). (STORY-LEG-014)
64. **[Cap Table] Contact kinds are only Investor/Auditor/Other**; board members, counsel and option holders all fall into "Other" (`packages/contracts/src/contacts.ts:4`).
65. **[Data room] "Embedding model" is a bare text field with no explanation** (`ModelSettingsOverlay.tsx:1563-1580`).
66. **[Data room] The disclosure version is dated in the future**: `DATA_ROOM_DISCLOSURE_VERSION = "2026-10-22"` (`packages/contracts/src/data-room-api.ts:111`), later than 2026-10-16.
67. **[App shell] Table controls are not localized and downloads are always `table.csv`** (`packages/chat-ui/src/markdown-table.tsx:160,186-245`). (STORY-APP-014)

Other Legal items carried over from the prior Legal catalog (P-03 to P-07, P-14, P-15, P-17 to P-19, P-22 to P-30, C-1 to C-9) are unchanged; see `/Users/dennison/develop/rakazo-legal/docs/ux-paths/legal/catalog.md`.
